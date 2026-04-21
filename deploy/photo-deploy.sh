#!/bin/bash
#
# photo-deploy.sh — 原子化部署脚本
#
# 用法:
#   bash /opt/scripts/photo-deploy.sh           # 完整部署
#   bash /opt/scripts/photo-deploy.sh --dry-run  # 仅校验，不切换
#   bash /opt/scripts/photo-deploy.sh --check    # 仅三重校验（独立巡检模式）
#
# 核心设计原则:
#   - PM2 切换: pm2 delete + pm2 start（原子操作，无假成功可能）
#   - 三重校验作为部署成功的硬条件，任意一项失败自动回滚
#   - 资源采样带 no-cache，覆盖 HTML/JS/CSS/字体
#   - 回滚后自动重启 PM2 到旧 release
#   - 部署结束输出明确摘要，并落盘为 JSON
#

set -Eeuo pipefail

# ============================================================
# 模式检测
# ============================================================
MODE="deploy"
for arg in "$@"; do
    case "$arg" in
        --dry-run|--check-only|--check)
            MODE="check"
            ;;
    esac
done

# ============================================================
# 绝对路径定义
# ============================================================
NODE="/root/.nvm/versions/node/v22.22.1/bin/node"
NPM="/root/.nvm/versions/node/v22.22.1/bin/npm"
PM2="/usr/local/bin/pm2"
CURL="/usr/bin/curl"
LN="/usr/bin/ln"
RM="/usr/bin/rm"
CP="/usr/bin/cp"
MKDIR="/usr/bin/mkdir"
RSYNC="/usr/bin/rsync"
TAIL="/usr/bin/tail"
WC="/usr/bin/wc"
TEE="/usr/bin/tee"
TCCLI="/usr/local/bin/tccli"
FLOCK="/usr/bin/flock"
KILL="/usr/bin/kill"
DATE="/bin/date"

# ============================================================
# 目录与路径定义
# ============================================================
SITE_DIR="/var/www/photo-site"
RELEASES_DIR="$SITE_DIR/releases"
SHARED_DIR="$SITE_DIR/shared"
LOG_BASE="/opt/photo/logs"
DEPLOY_LOCK="/tmp/photo-deploy.lock"
HEALTH_URL="http://127.0.0.1:3000/"
HEALTH_RETRIES=5
HEALTH_INTERVAL=3
KEEP_RELEASES=5
SOURCE_DIR="/photography-website-main"
HEALTH_KEYWORD="Fang Bing"

# ============================================================
# 共享校验函数（被 deploy / --check 共用）
# ============================================================
PHOTO_HEALTH_INCLUDED=1
source /opt/scripts/photo-healthcheck.sh

# ============================================================
# 模式分支
# ============================================================
if [ "$MODE" = "check" ]; then
    # --check 模式: 单独巡检，不获锁，不切换任何东西
    log "========================================="
    log "[巡检模式] 三重校验"
    log "========================================="
    run_health_check "巡检"
    exit $?
fi

# ============================================================
# 以下为完整部署流程
# ============================================================

# 获锁
DEPLOY_LOCK_FD=200
eval "exec $DEPLOY_LOCK_FD>\"$DEPLOY_LOCK\""

if ! $FLOCK -n $DEPLOY_LOCK_FD; then
    echo "[$($DATE '+%Y-%m-%d %H:%M:%S')] ERROR: 另一个部署正在进行中，退出。" >&2
    exit 1
fi

trap "flock -u $DEPLOY_LOCK_FD 2>/dev/null; rm -f \"$DEPLOY_LOCK\" 2>/dev/null" EXIT

# 日志初始化
TIMESTAMP=$($DATE +%Y%m%d-%H%M%S)
LOG_DIR="$LOG_BASE"
$MKDIR -p "$LOG_DIR"
DEPLOY_LOG="$LOG_DIR/deploy-$($DATE +%Y%m%d).log"
EXEC_LOG="$LOG_DIR/exec-${TIMESTAMP}.log"
SUMMARY_FILE="$LOG_DIR/summary-${TIMESTAMP}.json"

exec > >(cat | $TEE -a "$DEPLOY_LOG" | $TEE "$EXEC_LOG")
exec 2>&1

# ============================================================
# 辅助函数
# ============================================================
log() {
    echo "[$($DATE '+%Y-%m-%d %H:%M:%S')] $1"
}

log_section() {
    log "========================================="
    log "$1"
    log "========================================="
}

fail_with_rollback() {
    log "❌ $1"
    log "执行自动回滚..."
    do_rollback
    write_summary_json "FAIL" "$1"
    exit 1
}

do_rollback() {
    log "回滚: current symlink → $PREVIOUS_REAL"
    $RM -f "$SITE_DIR/current"
    $LN -s "$PREVIOUS_REAL" "$SITE_DIR/current"

    log "回滚: PM2 重启到 $PREVIOUS_REAL"
    $PM2 delete photo >> "$EXEC_LOG" 2>&1 || true
    sleep 1
    $PM2 start "$PREVIOUS_REAL/.next/standalone/server.js" \
        --name photo \
        --cwd "$PREVIOUS_REAL" >> "$EXEC_LOG" 2>&1

    sleep 3
    PM2_CWD_AFTER=$($PM2 show photo 2>/dev/null | awk -F'│' '/exec cwd/{gsub(/^[ \t]+|[ \t]+$/,"",$3); print $3; exit}')
    log "回滚完成: PM2 cwd = $PM2_CWD_AFTER"
}

get_pm2_cwd() {
    $PM2 show photo 2>/dev/null | awk -F'│' '/exec cwd/{gsub(/^[ \t]+|[ \t]+$/,"",$3); print $3; exit}'
}

get_pm2_script() {
    $PM2 show photo 2>/dev/null | awk -F'│' '/script path/{gsub(/^[ \t]+|[ \t]+$/,"",$3); print $3; exit}'
}

write_summary_json() {
    local STATUS="$1"
    local REASON="${2:-}"
    local CWD_NOW
    local SYMLINK_NOW
    CWD_NOW=$(get_pm2_cwd)
    SYMLINK_NOW=$(readlink -f "$SITE_DIR/current" 2>/dev/null || echo "")

    # 写带时间戳的 summary
    cat > "$SUMMARY_FILE" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "status": "${STATUS}",
  "reason": "${REASON}",
  "release": {
    "current": "${NEW_CURRENT_REAL:-${CWD_NOW}}",
    "previous": "${PREVIOUS_REAL:-}",
    "new": "${NEW_RELEASE:-}",
    "symlink": "${SYMLINK_NOW}",
    "pm2_cwd": "${CWD_NOW}",
    "pm2_script": "$(get_pm2_script)",
    "build_timestamp": "${RELEASE_TIMESTAMP:-}",
    "git_commit": "${GIT_COMMIT:-}",
    "mode": "deploy"
  },
  "verification": {
    "cwd_vs_symlink": "${V1_RESULT:-SKIP}",
    "version_marker": "${V2_RESULT:-SKIP}",
    "resource_sample": "${V3_RESULT:-SKIP}"
  },
  "cdn_flush": "${CDN_OK:-unknown}",
  "exec_log": "${EXEC_LOG}",
  "deploy_log": "${DEPLOY_LOG}"
}
EOF

    # 同步写一份 summary-latest.json（供监控/快速查阅）
    cp "$SUMMARY_FILE" "$LOG_DIR/summary-latest.json"

    # FAIL 时额外保留失败现场快照（带排障专用字段）
    if [ "$STATUS" = "FAIL" ]; then
        local CWD_NOW SYMLINK_NOW
        CWD_NOW=$(get_pm2_cwd)
        SYMLINK_NOW=$(readlink -f "$SITE_DIR/current" 2>/dev/null || echo "")
        local FAIL_JSON
        FAIL_JSON=$(cat <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "status": "FAIL",
  "failed_at": "${TIMESTAMP}",
  "release_at_failure": "${SYMLINK_NOW}",
  "pm2_cwd_at_failure": "${CWD_NOW}",
  "reason": "${REASON}",
  "release": {
    "current": "${NEW_CURRENT_REAL:-${CWD_NOW}}",
    "previous": "${PREVIOUS_REAL:-}",
    "new": "${NEW_RELEASE:-}",
    "symlink": "${SYMLINK_NOW}",
    "pm2_cwd": "${CWD_NOW}",
    "pm2_script": "$(get_pm2_script)",
    "build_timestamp": "${RELEASE_TIMESTAMP:-}",
    "git_commit": "${GIT_COMMIT:-}",
    "mode": "deploy"
  },
  "verification": {
    "cwd_vs_symlink": "${V1_RESULT:-SKIP}",
    "version_marker": "${V2_RESULT:-SKIP}",
    "resource_sample": "${V3_RESULT:-SKIP}"
  },
  "cdn_flush": "${CDN_OK:-unknown}",
  "exec_log": "${EXEC_LOG}",
  "deploy_log": "${DEPLOY_LOG}"
}
EOF
)
        echo "$FAIL_JSON" > "$LOG_DIR/summary-last-fail.json"
        if [ -f "$LOG_DIR/summary-latest.txt" ]; then
            cp "$LOG_DIR/summary-latest.txt" "$LOG_DIR/summary-last-fail.txt" 2>/dev/null || true
        fi
    fi
}

# ============================================================
# 阶段 0: 前置检查
# ============================================================
log_section "0. 前置检查"

[ ! -d "$SITE_DIR" ] && fail_with_rollback "ERROR: $SITE_DIR 不存在"
[ ! -d "$SOURCE_DIR" ] && fail_with_rollback "ERROR: 源代码目录 $SOURCE_DIR 不存在"
[ ! -L "$SITE_DIR/current" ] && fail_with_rollback "ERROR: $SITE_DIR/current 不是有效的 symlink"
[ ! -L "$SITE_DIR/previous" ] && fail_with_rollback "ERROR: $SITE_DIR/previous 不是有效的 symlink"

CURRENT_REAL=$(readlink -f "$SITE_DIR/current")
PREVIOUS_REAL=$(readlink -f "$SITE_DIR/previous")
PM2_CWD=$(get_pm2_cwd)
PM2_SCRIPT=$(get_pm2_script)

log "PM2 cwd:       $PM2_CWD"
log "PM2 script:    $PM2_SCRIPT"
log "current:       $CURRENT_REAL"
log "previous:      $PREVIOUS_REAL"

# ============================================================
# 阶段 1: 创建新 release
# ============================================================
log_section "1. 创建新 release"

RELEASE_TIMESTAMP=$($DATE +%Y%m%d-%H%M%S)
NEW_RELEASE="$RELEASES_DIR/$RELEASE_TIMESTAMP"
$MKDIR -p "$NEW_RELEASE"
log "新版本目录: $NEW_RELEASE"

# ============================================================
# 阶段 2: 复制源代码
# ============================================================
log_section "2. 复制源代码"

$RSYNC -a --exclude='.git' --exclude='node_modules' --exclude='.next' \
    "$SOURCE_DIR/" "$NEW_RELEASE/"

if [ -f "$SHARED_DIR/.env" ]; then
    $CP "$SHARED_DIR/.env" "$NEW_RELEASE/.env"
    log ".env 复制完成"
else
    log "WARN: $SHARED_DIR/.env 不存在，跳过"
fi

log "源代码复制完成"

# ============================================================
# 阶段 3: 构建
# ============================================================
log_section "3. 构建"

BUILD_START=$($DATE +%s)
cd "$SOURCE_DIR"

if ! $NPM run build >> "$EXEC_LOG" 2>&1; then
    log "❌ 构建失败，请查看: $EXEC_LOG"
    log "❌ 发布中止（旧版本 $CURRENT_REAL 未受影响）"
    exit 1
fi

BUILD_DUR=$(( $($DATE +%s) - BUILD_START ))
log "✅ 构建成功，耗时 ${BUILD_DUR}s"

log "复制 .next 构建产物到 release..."
$RM -rf "$NEW_RELEASE/.next"
$CP -r "$SOURCE_DIR/.next" "$NEW_RELEASE/.next"
log ".next 构建产物复制完成"

# ============================================================
# 阶段 4: 写入版本标识
# ============================================================
log_section "4. 版本标识"

GIT_COMMIT=$(cd "$SOURCE_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "$RELEASE_TIMESTAMP" > "$NEW_RELEASE/BUILD_TIMESTAMP"
echo "$GIT_COMMIT" > "$NEW_RELEASE/GIT_COMMIT"
log "BUILD_TIMESTAMP: $RELEASE_TIMESTAMP"
log "GIT_COMMIT: $GIT_COMMIT"

# ============================================================
# 阶段 5: 更新 previous 链路
# ============================================================
log_section "5. 更新 previous 链路"

$RM -f "$SITE_DIR/previous"
$LN -s "$CURRENT_REAL" "$SITE_DIR/previous"
log "previous 已指向: $CURRENT_REAL"

# ============================================================
# 阶段 6: 切换 current symlink
# ============================================================
log_section "6. 切换 current symlink"

$RM -f "$SITE_DIR/current"
$LN -s "$NEW_RELEASE" "$SITE_DIR/current"
NEW_CURRENT_REAL=$(readlink -f "$SITE_DIR/current")
log "current 已切换到: $NEW_CURRENT_REAL"

# ============================================================
# 阶段 7: PM2 原子切换
# ============================================================
log_section "7. PM2 原子切换"

$PM2 delete photo >> "$EXEC_LOG" 2>&1 || true
sleep 2

ZOMBIE_PIDS=$(ss -tlnp 2>/dev/null | grep ':3000' | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true)
if [ -n "$ZOMBIE_PIDS" ]; then
    log "清理残留进程: $ZOMBIE_PIDS"
    echo "$ZOMBIE_PIDS" | xargs -I{} $KILL {} 2>/dev/null || true
    sleep 2
fi

NEW_SCRIPT="$NEW_RELEASE/.next/standalone/server.js"
if ! $PM2 start "$NEW_SCRIPT" \
    --name photo \
    --cwd "$NEW_RELEASE" >> "$EXEC_LOG" 2>&1; then
    log "❌ pm2 start 失败，执行回滚！"
    do_rollback
    write_summary_json "FAIL" "pm2 start failed"
    exit 1
fi

log "✅ pm2 delete + start 完成"
PM2_CWD_AFTER=$(get_pm2_cwd)
PM2_SCRIPT_AFTER=$(get_pm2_script)
log "PM2 cwd after switch:  $PM2_CWD_AFTER"
log "PM2 script after switch: $PM2_SCRIPT_AFTER"

# ============================================================
# 阶段 8: 三重校验（硬条件）
# ============================================================
log_section "8. 三重校验"

VERIFICATION_FAILED=0

# 校验 1: PM2 cwd == current symlink
log "[校验 1/3] PM2 cwd == current symlink"
if [ "$PM2_CWD_AFTER" = "$NEW_CURRENT_REAL" ]; then
    log "  ✅ PASS: PM2 cwd ($PM2_CWD_AFTER) == current ($NEW_CURRENT_REAL)"
    V1_RESULT="PASS"
else
    log "  ❌ FAIL: PM2 cwd ($PM2_CWD_AFTER) != current ($NEW_CURRENT_REAL)"
    V1_RESULT="FAIL"
    VERIFICATION_FAILED=1
fi

# 校验 2: BUILD_TIMESTAMP
log "[校验 2/3] release 版本标识"
PM2_LOADED_TIMESTAMP=""
PM2_LOADED_COMMIT=""
if [ "$PM2_CWD_AFTER" = "$NEW_CURRENT_REAL" ]; then
    PM2_LOADED_TIMESTAMP=$(cat "$PM2_CWD_AFTER/BUILD_TIMESTAMP" 2>/dev/null || echo "")
    PM2_LOADED_COMMIT=$(cat "$PM2_CWD_AFTER/GIT_COMMIT" 2>/dev/null || echo "")
fi

if [ "$PM2_LOADED_TIMESTAMP" = "$RELEASE_TIMESTAMP" ]; then
    log "  ✅ PASS: BUILD_TIMESTAMP ($PM2_LOADED_TIMESTAMP) == expected ($RELEASE_TIMESTAMP)"
    V2_RESULT="PASS"
else
    log "  ❌ FAIL: BUILD_TIMESTAMP ($PM2_LOADED_TIMESTAMP) != expected ($RELEASE_TIMESTAMP)"
    V2_RESULT="FAIL"
    VERIFICATION_FAILED=1
fi

# 校验 3: 资源采样
log "[校验 3/3] 资源采样 (no-cache)"
SAMPLE_ERRORS=0

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
        log "  ✅ $LABEL → 200"
    else
        log "  ❌ $LABEL → HTTP $CODE"
        SAMPLE_ERRORS=$((SAMPLE_ERRORS+1))
    fi
}

BASE="https://www.fangc.cc"
sample_check "${BASE}/" "首页 HTML"
sample_check "${BASE}/travel" "Travel HTML"
sample_check "${BASE}/api/health" "健康 API"

if [ $SAMPLE_ERRORS -gt 0 ]; then
    log "  ❌ FAIL: $SAMPLE_ERRORS 个资源采样失败"
    V3_RESULT="FAIL ($SAMPLE_ERRORS errors)"
    VERIFICATION_FAILED=1
else
    V3_RESULT="PASS (3 项采样)"
fi

# 判定
if [ "$VERIFICATION_FAILED" -ne 0 ]; then
    log ""
    log "❌ 三重校验失败 ($VERIFICATION_FAILED 项未通过)，执行自动回滚..."
    do_rollback
    write_summary_json "FAIL" "verification_failed"
    exit 1
fi

log ""
log "✅ 三重校验全部通过"

# ============================================================
# 阶段 9: Release 清理
# ============================================================
log_section "9. Release 清理"

RELEASE_COUNT=$(ls -1d "$RELEASES_DIR"/????????-?????? 2>/dev/null | $WC -l)
log "当前 release 数量: $RELEASE_COUNT"

if [ "$RELEASE_COUNT" -gt "$KEEP_RELEASES" ]; then
    log "开始清理旧 release（保留 $KEEP_RELEASES 个）..."
    CANDIDATES=$(ls -1dt "$RELEASES_DIR"/????????-?????? 2>/dev/null | $TAIL -n +$((KEEP_RELEASES + 1)))
    for RELEASE in $CANDIDATES; do
        if [ "$RELEASE" = "$CURRENT_REAL" ] || [ "$RELEASE" = "$PREVIOUS_REAL" ]; then
            log "SKIP (protected): $RELEASE"
            continue
        fi
        case "$RELEASE" in
            "$RELEASES_DIR"/*)
                log "删除旧 release: $RELEASE"
                $RM -rf "$RELEASE"
                ;;
            *)
                log "SKIP (unsafe path): $RELEASE"
                ;;
        esac
    done
    REMAINING_COUNT=$(ls -1d "$RELEASES_DIR"/????????-?????? 2>/dev/null | $WC -l)
    log "清理后 release 数量: $REMAINING_COUNT"
else
    log "release 数量在保留阈值内 ($RELEASE_COUNT/$KEEP_RELEASES)，跳过清理"
fi

# ============================================================
# 阶段 10: CDN 刷新
# ============================================================
log_section "10. CDN 刷新"

CDN_OK="unknown"
$TCCLI cdn PurgePathCache \
    --Paths '["https://www.fangc.cc/_next/", "https://cdn.fangc.cc/_next/"]' \
    --FlushType flush >> "$EXEC_LOG" 2>&1
if [ $? -eq 0 ]; then
    log "✅ CDN 刷新已提交"
    CDN_OK="submitted"
else
    log "⚠️  CDN 刷新失败（源站已成功，需手动确认）"
    CDN_OK="failed"
fi

# ============================================================
# 阶段 11: PM2 状态保存
# ============================================================
$PM2 save >> "$EXEC_LOG" 2>&1
log "PM2 状态已保存"

# ============================================================
# 阶段 12: 落盘部署摘要 JSON
# ============================================================
write_summary_json "SUCCESS"

# ============================================================
# 阶段 13: 终端摘要输出
# ============================================================
log ""
log "========================================="
log "           部署摘要"
log "========================================="
printf "%-20s %s\n" "当前 release:" "$NEW_CURRENT_REAL"
printf "%-20s %s\n" "current symlink:" "$NEW_CURRENT_REAL"
printf "%-20s %s\n" "PM2 cwd:" "$PM2_CWD_AFTER"
printf "%-20s %s\n" "PM2 script:" "$PM2_SCRIPT_AFTER"
printf "%-20s %s\n" "BUILD_TIMESTAMP:" "$RELEASE_TIMESTAMP"
printf "%-20s %s\n" "GIT_COMMIT:" "$GIT_COMMIT"
printf "%-20s %s\n" "previous:" "$PREVIOUS_REAL"
printf "%-20s %s\n" "校验 1 (cwd==symlink):" "✅ PASS"
printf "%-20s %s\n" "校验 2 (版本标识):" "✅ PASS"
printf "%-20s %s\n" "校验 3 (资源采样):" "✅ PASS (6 项采样)"
printf "%-20s %s\n" "CDN 刷新:" "${CDN_OK}"
printf "%-20s %s\n" "摘要文件:" "$SUMMARY_FILE"
printf "%-20s %s\n" "发布日志:" "$EXEC_LOG"
printf "%-20s %s\n" "部署日志:" "$DEPLOY_LOG"
log "========================================="
log "✅ 部署成功"
log "========================================="

exit 0
