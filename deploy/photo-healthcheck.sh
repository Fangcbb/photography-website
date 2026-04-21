#!/bin/bash
#
# photo-healthcheck.sh — 三重校验独立巡检脚本
#
# 用法:
#   bash /opt/scripts/photo-healthcheck.sh        # 巡检当前状态
#   bash /opt/scripts/photo-healthcheck.sh --json # JSON 输出（便于监控集成）
#
# 三重校验:
#   1. PM2 cwd == current symlink（解析后绝对路径）
#   2. BUILD_TIMESTAMP 版本标识一致
#   3. 资源采样返回 200（no-cache）
#
# 退出码:
#   0  — 全部通过
#   1  — 至少一项失败
#

set -Eeuo pipefail

# ============================================================
# 绝对路径
# ============================================================
PM2="/usr/local/bin/pm2"
CURL="/usr/bin/curl"
READLINK="/bin/readlink"
DATE="/bin/date"

# ============================================================
# 配置
# ============================================================
SITE_DIR="/var/www/photo-site"
BASE_URL="https://www.fangc.cc"
OUTPUT_JSON=false

for arg in "$@"; do
    case "$arg" in
        --json|-j) OUTPUT_JSON=true ;;
    esac
done

# ============================================================
# 获取当前状态
# ============================================================
get_pm2_cwd() {
    $PM2 show photo 2>/dev/null | awk -F'│' '/exec cwd/{gsub(/^[ \t]+|[ \t]+$/,"",$3); print $3; exit}'
}

get_pm2_script() {
    $PM2 show photo 2>/dev/null | awk -F'│' '/script path/{gsub(/^[ \t]+|[ \t]+$/,"",$3); print $3; exit}'
}

# ============================================================
# 日志（JSON 模式抑制终端输出）
# ============================================================
log() {
    if [ "$OUTPUT_JSON" = false ]; then
        echo "[$($DATE '+%Y-%m-%d %H:%M:%S')] $1"
    fi
}

json_escape() {
    # strip trailing newline before python, then json.dumps 输出去掉外层引号
    printf '%s' "$1" | python3 -c "import sys,json; d=json.dumps(sys.stdin.read()); print(d[1:-1])" 2>/dev/null
}

# ============================================================
# 核心校验函数（deploy.sh 通过 source 调用）
#   用法: run_health_check "deploy"   # 来自 deploy.sh，含 log 输出
#   用法: run_health_check "check"   # 来自 --check 模式，轻量输出
# ============================================================
run_health_check() {
    local CALLER="${1:-check}"
    local PM2_CWD SYMLINK_REAL V1 V2 V3 SAMPLE_ERRORS=0
    local V1_MSG V2_MSG V3_MSG
    local EXIT_CODE=0

    # ---- 读取状态 ----
    # PM2 返回的 cwd 可能是 symlink（如 /var/www/photo-site/current），
    # 必须全部解析后再比较，避免 “PM2 cwd != symlink” 假阳性
    PM2_CWD=$(get_pm2_cwd)
    PM2_CWD=$(readlink -f "$PM2_CWD" 2>/dev/null || echo "$PM2_CWD")
    PM2_SCRIPT=$(get_pm2_script)
    SYMLINK_REAL=$($READLINK -f "$SITE_DIR/current" 2>/dev/null || echo "")
    BUILD_TS_FILE="$SITE_DIR/current/BUILD_TIMESTAMP"
    GIT_COMMIT_FILE="$SITE_DIR/current/GIT_COMMIT"
    BUILD_TS=$(cat "$BUILD_TS_FILE" 2>/dev/null || echo "")
    GIT_COMMIT=$(cat "$GIT_COMMIT_FILE" 2>/dev/null || echo "unknown")

    # ---- 校验 1: PM2 cwd == symlink ----
    if [ "$PM2_CWD" = "$SYMLINK_REAL" ]; then
        V1="PASS"
        V1_MSG="PM2 cwd ($PM2_CWD) == symlink ($SYMLINK_REAL)"
        [ "$CALLER" = "deploy" ] && log "  ✅ [校验 1/3] $V1_MSG"
    else
        V1="FAIL"
        V1_MSG="PM2 cwd ($PM2_CWD) != symlink ($SYMLINK_REAL)"
        [ "$CALLER" = "deploy" ] && log "  ❌ [校验 1/3] $V1_MSG"
        EXIT_CODE=1
    fi

    # ---- 校验 2: BUILD_TIMESTAMP ----
    # 从 symlink 读取（因为 PM2 cwd 可能已经不一致）
    PM2_LOADED_TS=""
    PM2_LOADED_COMMIT=""
    if [ -n "$SYMLINK_REAL" ] && [ -f "$SYMLINK_REAL/BUILD_TIMESTAMP" ]; then
        PM2_LOADED_TS=$(cat "$SYMLINK_REAL/BUILD_TIMESTAMP" 2>/dev/null || echo "")
        PM2_LOADED_COMMIT=$(cat "$SYMLINK_REAL/GIT_COMMIT" 2>/dev/null || echo "")
    fi

    if [ "$PM2_LOADED_TS" = "$BUILD_TS" ]; then
        V2="PASS"
        V2_MSG="BUILD_TIMESTAMP ($PM2_LOADED_TS) 一致"
        [ "$CALLER" = "deploy" ] && log "  ✅ [校验 2/3] $V2_MSG"
    else
        V2="FAIL"
        V2_MSG="BUILD_TIMESTAMP 不一致: PM2=$PM2_LOADED_TS, expected=$BUILD_TS"
        [ "$CALLER" = "deploy" ] && log "  ❌ [校验 2/3] $V2_MSG"
        EXIT_CODE=1
    fi

    # ---- 校验 3: 资源采样 ----
    sample_check() {
        local URL="$1"
        local LABEL="$2"
        local CODE
        CODE=$($CURL -s -o /dev/null -w "%{http_code}" \
            -H "Cache-Control: no-cache" \
            -H "Pragma: no-cache" \
            --compressed \
            "${URL}?t=$($DATE +%s)" 2>/dev/null || echo "000")
        if [ "$CODE" = "200" ]; then
            [ "$CALLER" = "deploy" ] && log "  ✅ $LABEL → 200"
            return 0
        else
            [ "$CALLER" = "deploy" ] && log "  ❌ $LABEL → HTTP $CODE"
            return 1
        fi
    }

    [ "$CALLER" = "deploy" ] && log "  [校验 3/3] 资源采样 (no-cache)..."

    sample_check "${BASE_URL}/" "首页 HTML"      || { SAMPLE_ERRORS=$((SAMPLE_ERRORS+1)); EXIT_CODE=1; }
    sample_check "${BASE_URL}/travel" "Travel HTML" || { SAMPLE_ERRORS=$((SAMPLE_ERRORS+1)); EXIT_CODE=1; }
    sample_check "${BASE_URL}/api/health" "健康 API" || { SAMPLE_ERRORS=$((SAMPLE_ERRORS+1)); EXIT_CODE=1; }

    if [ $SAMPLE_ERRORS -gt 0 ]; then
        V3="FAIL ($SAMPLE_ERRORS errors)"
    else
        V3="PASS (3 项采样)"
    fi
    [ "$CALLER" = "deploy" ] && log "  资源采样结果: $V3"

    # ---- 输出 ----
    if [ "$OUTPUT_JSON" = true ] || [ "$CALLER" = "deploy" ]; then
        # JSON 模式或 deploy 调用：输出 JSON，写 summary-latest.json
        local JSON_OUT
        JSON_OUT=$(cat <<EOF
{
  "timestamp": "$($DATE '+%Y-%m-%dT%H:%M:%S%z')",
  "status": "$( [ $EXIT_CODE -eq 0 ] && echo "PASS" || echo "FAIL" )",
  "checks": {
    "cwd_vs_symlink":   { "result": "$V1", "detail": "$(json_escape "$V1_MSG")" },
    "version_marker":   { "result": "$V2", "detail": "$(json_escape "$V2_MSG")" },
    "resource_sample":  { "result": "$V3" }
  },
  "runtime": {
    "pm2_cwd":      "$PM2_CWD",
    "pm2_script":   "$PM2_SCRIPT",
    "symlink":      "$SYMLINK_REAL",
    "build_ts":     "$BUILD_TS",
    "git_commit":   "$GIT_COMMIT"
  }
}
EOF
)
        # deploy 调用时不向 stdout 输出 JSON，只写文件
        if [ "$OUTPUT_JSON" = true ]; then
            echo "$JSON_OUT"
        fi
        # 写 summary-latest.json（供监控快速访问）
        echo "$JSON_OUT" > /opt/photo/logs/summary-latest.json
        {
            echo "photo-site 健康巡检 - $($DATE '+%Y-%m-%d %H:%M:%S')"
            echo "PM2 cwd: $PM2_CWD"
            echo "Symlink: $SYMLINK_REAL"
            echo "BUILD_TIMESTAMP: $BUILD_TS"
            echo "GIT_COMMIT: $GIT_COMMIT"
            echo "[校验 1] cwd==symlink: $V1"
            echo "[校验 2] 版本标识: $V2"
            echo "[校验 3] 资源采样: $V3"
            [ $EXIT_CODE -eq 0 ] && echo "结果: ✅ PASS" || echo "结果: ❌ FAIL"
        } > /opt/photo/logs/summary-latest.txt
        # FAIL 时额外保留失败现场快照（带排障专用字段）
        if [ $EXIT_CODE -ne 0 ]; then
            local FAIL_JSON
            FAIL_JSON=$(cat <<EOF
{
  "timestamp": "$($DATE '+%Y-%m-%dT%H:%M:%S%z')",
  "status": "FAIL",
  "failed_at": "$($DATE '+%Y-%m-%dT%H:%M:%S%z')",
  "release_at_failure": "$SYMLINK_REAL",
  "pm2_cwd_at_failure": "$PM2_CWD",
  "checks": {
    "cwd_vs_symlink":   { "result": "$V1", "detail": "$(json_escape "$V1_MSG")" },
    "version_marker":   { "result": "$V2", "detail": "$(json_escape "$V2_MSG")" },
    "resource_sample":  { "result": "$V3" }
  },
  "runtime": {
    "pm2_cwd":      "$PM2_CWD",
    "pm2_script":   "$PM2_SCRIPT",
    "symlink":      "$SYMLINK_REAL",
    "build_ts":     "$BUILD_TS",
    "git_commit":   "$GIT_COMMIT"
  }
}
EOF
)
            echo "$FAIL_JSON" > /opt/photo/logs/summary-last-fail.json
            {
                echo "photo-site 健康巡检 - $($DATE '+%Y-%m-%d %H:%M:%S')"
                echo "PM2 cwd: $PM2_CWD"
                echo "Symlink: $SYMLINK_REAL"
                echo "BUILD_TIMESTAMP: $BUILD_TS"
                echo "GIT_COMMIT: $GIT_COMMIT"
                echo "[校验 1] cwd==symlink: $V1"
                echo "[校验 2] 版本标识: $V2"
                echo "[校验 3] 资源采样: $V3"
                echo "结果: ❌ FAIL"
            } > /opt/photo/logs/summary-last-fail.txt
        fi
    else
        # 直接巡检模式：人类可读输出
        echo "========================================="
        echo "[$($DATE '+%Y-%m-%d %H:%M:%S')] photo-site 健康巡检"
        echo "========================================="
        printf "  %-20s %s\n" "PM2 cwd:" "$PM2_CWD"
        printf "  %-20s %s\n" "Symlink →:" "$SYMLINK_REAL"
        printf "  %-20s %s\n" "BUILD_TIMESTAMP:" "$BUILD_TS"
        printf "  %-20s %s\n" "GIT_COMMIT:" "$GIT_COMMIT"
        echo "-----------------------------------"
        printf "  %-20s %s\n" "[校验 1] cwd==symlink:" "$V1"
        printf "  %-20s %s\n" "[校验 2] 版本标识:" "$V2"
        printf "  %-20s %s\n" "[校验 3] 资源采样:" "$V3"
        echo "========================================="
        if [ $EXIT_CODE -eq 0 ]; then
            echo "结果: ✅ 全部通过"
        else
            echo "结果: ❌ 有 $SAMPLE_ERRORS 项采样失败"
        fi
        # 写 summary-latest.json + txt
        local JSON_OUT
        JSON_OUT=$(cat <<EOF
{
  "timestamp": "$($DATE '+%Y-%m-%dT%H:%M:%S%z')",
  "status": "$( [ $EXIT_CODE -eq 0 ] && echo "PASS" || echo "FAIL" )",
  "checks": {
    "cwd_vs_symlink":   { "result": "$V1", "detail": "$(json_escape "$V1_MSG")" },
    "version_marker":   { "result": "$V2", "detail": "$(json_escape "$V2_MSG")" },
    "resource_sample":  { "result": "$V3" }
  },
  "runtime": {
    "pm2_cwd":      "$PM2_CWD",
    "pm2_script":   "$PM2_SCRIPT",
    "symlink":      "$SYMLINK_REAL",
    "build_ts":     "$BUILD_TS",
    "git_commit":   "$GIT_COMMIT"
  }
}
EOF
)
        echo "$JSON_OUT" > /opt/photo/logs/summary-latest.json
        {
            echo "photo-site 健康巡检 - $($DATE '+%Y-%m-%d %H:%M:%S')"
            echo "PM2 cwd: $PM2_CWD"
            echo "Symlink: $SYMLINK_REAL"
            echo "BUILD_TIMESTAMP: $BUILD_TS"
            echo "GIT_COMMIT: $GIT_COMMIT"
            echo "[校验 1] cwd==symlink: $V1"
            echo "[校验 2] 版本标识: $V2"
            echo "[校验 3] 资源采样: $V3"
            [ $EXIT_CODE -eq 0 ] && echo "结果: ✅ PASS" || echo "结果: ❌ FAIL"
        } > /opt/photo/logs/summary-latest.txt
        # FAIL 时额外保留失败现场快照（带排障专用字段）
        if [ $EXIT_CODE -ne 0 ]; then
            local FAIL_JSON
            FAIL_JSON=$(cat <<EOF
{
  "timestamp": "$($DATE '+%Y-%m-%dT%H:%M:%S%z')",
  "status": "FAIL",
  "failed_at": "$($DATE '+%Y-%m-%dT%H:%M:%S%z')",
  "release_at_failure": "$SYMLINK_REAL",
  "pm2_cwd_at_failure": "$PM2_CWD",
  "checks": {
    "cwd_vs_symlink":   { "result": "$V1", "detail": "$(json_escape "$V1_MSG")" },
    "version_marker":   { "result": "$V2", "detail": "$(json_escape "$V2_MSG")" },
    "resource_sample":  { "result": "$V3" }
  },
  "runtime": {
    "pm2_cwd":      "$PM2_CWD",
    "pm2_script":   "$PM2_SCRIPT",
    "symlink":      "$SYMLINK_REAL",
    "build_ts":     "$BUILD_TS",
    "git_commit":   "$GIT_COMMIT"
  }
}
EOF
)
            echo "$FAIL_JSON" > /opt/photo/logs/summary-last-fail.json
            {
                echo "photo-site 健康巡检 - $($DATE '+%Y-%m-%d %H:%M:%S')"
                echo "PM2 cwd: $PM2_CWD"
                echo "Symlink: $SYMLINK_REAL"
                echo "BUILD_TIMESTAMP: $BUILD_TS"
                echo "GIT_COMMIT: $GIT_COMMIT"
                echo "[校验 1] cwd==symlink: $V1"
                echo "[校验 2] 版本标识: $V2"
                echo "[校验 3] 资源采样: $V3"
                echo "结果: ❌ FAIL"
            } > /opt/photo/logs/summary-last-fail.txt
        fi
    fi

    return $EXIT_CODE
}

# ============================================================
# 独立运行入口（不在 deploy.sh source 上下文中）
# ============================================================
if [ "${PHOTO_HEALTH_INCLUDED:-}" != "1" ]; then
    run_health_check "standalone"
    exit $?
fi
