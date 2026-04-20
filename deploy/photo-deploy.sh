#!/bin/bash
#
# photo-deploy.sh — 新版本发布脚本 (增强版)
# 用法: bash /opt/scripts/photo-deploy.sh
#
# 增强项:
#   - flock 互斥锁，防止并发部署
#   - PM2 重启优先级：reload → restart → stop+start
#   - 多层健康检查（HTTP + HTML 关键字 + 健康 API）
#   - release 自动清理（保留 5 个）
#   - 日志规范化 (/opt/photo/logs/)
#   - CDN 失败降级 warning，不触发回滚
#   - 绝对路径
#   - previous 只在构建成功后更新（链路保护）
#

set -Eeuo pipefail

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
SORT="/usr/bin/sort"
TAIL="/usr/bin/tail"
WC="/usr/bin/wc"
TEE="/usr/bin/tee"
TCCLI="/usr/local/bin/tccli"
PKILL="/usr/bin/pkill"
FLOCK="/usr/bin/flock"

# ============================================================
# 目录与路径定义
# ============================================================
SITE_DIR="/var/www/photo-site"
RELEASES_DIR="$SITE_DIR/releases"
SHARED_DIR="$SITE_DIR/shared"
LOG_BASE="/opt/photo/logs"
DEPLOY_LOCK="/tmp/photo-deploy.lock"
HEALTH_URL="http://127.0.0.1:3000/"
HEALTH_RETRIES=6
HEALTH_INTERVAL=3
KEEP_RELEASES=5

# 源代码目录（用于 rsync）
SOURCE_DIR="/photography-website-main"

# ============================================================
# 健康检查关键字（首页 HTML 中稳定存在的标识）
# ============================================================
HEALTH_KEYWORD="Fang Bing"

# ============================================================
# 日志初始化（flock 之后才初始化日志，避免未获锁时产生空日志）
# ============================================================

# ============================================================
# 0. 互斥锁（flock）— 脚本获锁后才继续
# ============================================================
DEPLOY_LOCK_FD=200
eval "exec $DEPLOY_LOCK_FD>\"$DEPLOY_LOCK\""

if ! $FLOCK -n $DEPLOY_LOCK_FD; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: 另一个部署正在进行中，退出。"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 如确认无部署在运行，请手动删除: rm $DEPLOY_LOCK"
    exit 1
fi

# 脚本退出时自动释放锁（OS 关闭 fd，锁自动失效）
trap "flock -u $DEPLOY_LOCK_FD 2>/dev/null; rm -f \"$DEPLOY_LOCK\" 2>/dev/null" EXIT

# 现在初始化日志（已获锁）
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_DIR="$LOG_BASE"
$MKDIR -p "$LOG_DIR"
DEPLOY_LOG="$LOG_DIR/deploy-$(date +%Y%m%d).log"
EXEC_LOG="$LOG_DIR/exec-$(date +%Y%m%d-%H%M%S).log"

exec > >(cat | $TEE -a "$DEPLOY_LOG" | $TEE "$EXEC_LOG")
exec 2>&1

# ============================================================
# 辅助函数
# ============================================================
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_section() {
    log "========================================="
    log "$1"
    log "========================================="
}

log "部署锁已获得 (PID $$)"

# ============================================================
# 1. 前置检查
# ============================================================
log_section "1. 前置检查"

if [ ! -d "$SITE_DIR" ]; then
    log "ERROR: $SITE_DIR 不存在，退出"
    exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
    log "ERROR: 源代码目录 $SOURCE_DIR 不存在，退出"
    log "提示: rsync 源路径无效，请检查 /photography-website-main 是否存在"
    exit 1
fi

CURRENT_LINK="$SITE_DIR/current"
PREVIOUS_LINK="$SITE_DIR/previous"

if [ ! -L "$CURRENT_LINK" ]; then
    log "ERROR: $CURRENT_LINK 不是有效的 symlink，退出"
    exit 1
fi

if [ ! -L "$PREVIOUS_LINK" ]; then
    log "ERROR: $PREVIOUS_LINK 不是有效的 symlink，退出"
    exit 1
fi

CURRENT_REAL=$(readlink -f "$CURRENT_LINK")
PREVIOUS_REAL=$(readlink -f "$PREVIOUS_LINK")
log "当前版本 (current): $CURRENT_REAL"
log "旧版本 (previous): $PREVIOUS_REAL"

# PM2 验证：cwd 必须指向 current（symlink 路径）
PM2_CWD=$($PM2 show photo 2>/dev/null | awk -F'│' '/exec cwd/{gsub(/^[ \t]+|[ \t]+$/,"",$3); print $3; exit}')
PM2_SCRIPT=$($PM2 show photo 2>/dev/null | awk -F'│' '/script path/{gsub(/^[ \t]+|[ \t]+$/,"",$3); print $3; exit}')
log "PM2 cwd:   $PM2_CWD"
log "PM2 script: $PM2_SCRIPT"

if [ "$PM2_CWD" != "$SITE_DIR/current" ]; then
    log "WARN: PM2 cwd ($PM2_CWD) 不是 $SITE_DIR/current，尝试修复..."
    $PM2 stop photo >> "$EXEC_LOG" 2>&1 || true
    $PKILL -f "next-server" >> "$EXEC_LOG" 2>&1 || true
    sleep 2
    $PM2 start photo >> "$EXEC_LOG" 2>&1
    sleep 3
    NEW_CWD=$($PM2 show photo 2>/dev/null | grep "exec cwd" | awk '{print $NF}')
    if [ "$NEW_CWD" != "$SITE_DIR/current" ]; then
        log "ERROR: PM2 cwd 修复失败，退出"
        exit 1
    fi
    log "PM2 cwd 已修复为: $NEW_CWD"
else
    log "PM2 cwd 正确: $PM2_CWD"
fi

# ============================================================
# 2. 创建新 release 目录
# ============================================================
log_section "2. 创建新 release"

RELEASE_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
NEW_RELEASE="$RELEASES_DIR/$RELEASE_TIMESTAMP"
$MKDIR -p "$NEW_RELEASE"
log "新版本目录: $NEW_RELEASE"

# ============================================================
# 3. 复制源代码
# ============================================================
log_section "3. 复制源代码"

$RSYNC -a --exclude='.git' --exclude='node_modules' --exclude='.next' \
    "$SOURCE_DIR/" "$NEW_RELEASE/"

# 复制 shared/.env
if [ -f "$SHARED_DIR/.env" ]; then
    $CP "$SHARED_DIR/.env" "$NEW_RELEASE/.env"
    log ".env 复制完成"
else
    log "WARN: $SHARED_DIR/.env 不存在，跳过"
fi

log "源代码复制完成"

# ============================================================
# 4. 构建（在源代码目录执行，使用其 node_modules）
# ============================================================
log_section "4. 构建"

BUILD_START=$(date +%s)
# 在源代码目录构建（该目录有 node_modules），输出到新 release
cd "$SOURCE_DIR"

if $NPM run build >> "$EXEC_LOG" 2>&1; then
    BUILD_DUR=$(( $(date +%s) - BUILD_START ))
    log "✅ 构建成功，耗时 ${BUILD_DUR}s"

    # 将构建产物 .next 整体复制到 release（覆盖 rsync 产生的空目录）
    log "复制 .next 构建产物到 release..."
    $RM -rf "$NEW_RELEASE/.next"
    $CP -r "$SOURCE_DIR/.next" "$NEW_RELEASE/.next"
    log ".next 构建产物复制完成"
else
    log "❌ 构建失败，请查看: $EXEC_LOG"
    log "❌ 发布中止（旧版本 $CURRENT_REAL 未受影响）"
    exit 1
fi

# ============================================================
# 5. 更新 previous（构建成功后才更新链路）
# ============================================================
log_section "5. 更新 previous 链路"

# previous 指向当前版本（旧 successful release）
$RM -f "$PREVIOUS_LINK"
$LN -s "$CURRENT_REAL" "$PREVIOUS_LINK"
log "previous 已指向: $CURRENT_REAL"

# ============================================================
# 6. 切换 current symlink
# ============================================================
log_section "6. 切换 current symlink"

$RM -f "$CURRENT_LINK"
$LN -s "$NEW_RELEASE" "$CURRENT_LINK"
NEW_CURRENT=$(readlink -f "$CURRENT_LINK")
log "current 已切换到: $NEW_CURRENT"

# ============================================================
# 7. PM2 重启（优先级：reload → restart → stop+start）
# ============================================================
log_section "7. PM2 重启"

PM2_ACTION="unknown"
PM2_ACTION_REASON=""

# ---- 尝试 1: pm2 reload ----
log "尝试 pm2 reload photo ..."
PM2_ACTION="reload"
if $PM2 reload photo >> "$EXEC_LOG" 2>&1; then
    log "✅ pm2 reload photo 成功"
else
    PM2_ACTION_REASON="reload 失败"
    log "⚠️  pm2 reload photo 失败 (${PM2_ACTION_REASON})，尝试 restart ..."

    # ---- 尝试 2: pm2 restart ----
    log "尝试 pm2 restart photo ..."
    PM2_ACTION="restart"
    if $PM2 restart photo >> "$EXEC_LOG" 2>&1; then
        log "✅ pm2 restart photo 成功"
    else
        PM2_ACTION_REASON="restart 失败"
        log "⚠️  pm2 restart photo 失败 (${PM2_ACTION_REASON})，回退到 stop+start ..."

        # ---- 尝试 3: pm2 stop + start ----
        log "执行 pm2 stop photo && pm2 start photo ..."
        PM2_ACTION="stop+start"
        $PM2 stop photo >> "$EXEC_LOG" 2>&1 || true

        # 等待旧进程退出
        sleep 3

        # 清理残留 orphan next-server
        $PKILL -f "next-server" >> "$EXEC_LOG" 2>&1 || true

        # 确认端口已释放
        RETRY=0
        while ss -tlnp 2>/dev/null | grep -q ':3000'; do
            RETRY=$((RETRY+1))
            if [ $RETRY -ge 5 ]; then
                REMAINING=$(ss -tlnp 2>/dev/null | grep ':3000' | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
                log "WARN: 端口 3000 仍被占用 (pid $REMAINING)，强制清理"
                kill $REMAINING 2>/dev/null || true
                sleep 2
                break
            fi
            sleep 2
        done

        if ! $PM2 start photo >> "$EXEC_LOG" 2>&1; then
            log "❌ PM2 start photo 也失败了，执行回滚！"
            $RM -f "$CURRENT_LINK"
            $LN -s "$CURRENT_REAL" "$CURRENT_LINK"
            $PM2 start photo >> "$EXEC_LOG" 2>&1
            log "已回滚到: $CURRENT_REAL"
            exit 1
        fi
        log "✅ pm2 stop+start 成功"
    fi
fi

log "本次使用 PM2 动作: $PM2_ACTION ${PM2_ACTION_REASON:+(原因: ${PM2_ACTION_REASON})}"
log "PM2 photo 已重启（直接进入健康检查...）"

# ============================================================
# 8. 多层健康检查
# ============================================================
log_section "8. 多层健康检查"

HEALTH_OK=false
for i in $(seq 1 $HEALTH_RETRIES); do
    log "健康检查第 ${i} 次..."

    # 8a. HTTP 状态码
    HTTP_FILE="/tmp/http-code-$TIMESTAMP-$i.txt"
    $CURL -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" > "$HTTP_FILE" 2>/dev/null || echo "000" > "$HTTP_FILE"
    HTTP_CODE=$(cat "$HTTP_FILE")
    rm -f "$HTTP_FILE"
    if [ "$HTTP_CODE" != "200" ]; then
        log "  ❌ HTTP $HTTP_CODE (非 200)"
        [ $i -eq $HEALTH_RETRIES ] && break
        sleep $HEALTH_INTERVAL
        continue
    fi
    log "  ✅ HTTP 200"

    # 8b. HTML 内容关键字检查（兼容 exec > >(tee) 环境下的变量替换）
    HTML_FILE="/tmp/health-check-$TIMESTAMP-$i.html"
    $CURL -s "$HEALTH_URL" > "$HTML_FILE" 2>/dev/null || true
    if grep -q "$HEALTH_KEYWORD" "$HTML_FILE" 2>/dev/null; then
        log "  ✅ HTML 包含关键字: $HEALTH_KEYWORD"
    else
        log "  ❌ HTML 不包含关键字: $HEALTH_KEYWORD"
        rm -f "$HTML_FILE"
        [ $i -eq $HEALTH_RETRIES ] && break
        sleep $HEALTH_INTERVAL
        continue
    fi
    rm -f "$HTML_FILE"

    # 8c. 健康 API 检查（验证 app 层正常）
    HEALTH_API=$($CURL -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}api/health" 2>/dev/null || echo "000")
    if [ "$HEALTH_API" = "200" ]; then
        log "  ✅ 健康 API 正常 (HTTP $HEALTH_API)"
    else
        log "  ❌ 健康 API 异常 (HTTP $HEALTH_API)"
        rm -f "$HTML_FILE"
        [ $i -eq $HEALTH_RETRIES ] && break
        sleep $HEALTH_INTERVAL
        continue
    fi

    HEALTH_OK=true
    log "✅ 健康检查通过 (第 ${i} 次尝试)"
    break
done

if [ "$HEALTH_OK" = false ]; then
    log "❌ 健康检查全部失败，执行回滚！"
    log "旧版本: $CURRENT_REAL"
    log "新 release 目录保留供排查: $NEW_RELEASE"

    # 1. 先把 current symlink 切回旧版本（此时 PM2 仍指向新 release，必须先切 symlink）
    log "回滚中：恢复 current symlink 到旧版本..."
    $RM -f "$CURRENT_LINK"
    $LN -s "$CURRENT_REAL" "$CURRENT_LINK"
    log "current 已恢复: $(readlink -f "$CURRENT_LINK")"

    # 2. 再把 previous 切回更旧的版本
    log "回滚中：恢复 previous symlink..."
    $RM -f "$PREVIOUS_LINK"
    $LN -s "$PREVIOUS_REAL" "$PREVIOUS_LINK"
    log "previous 已恢复: $(readlink -f "$PREVIOUS_LINK")"

    # 3. 然后执行 PM2 重启（此时 symlink 已指向正确旧版本，重启后加载旧 release）
    log "回滚中（reload → restart → stop+start）..."
    if $PM2 reload photo >> "$EXEC_LOG" 2>&1; then
        log "✅ 回滚 reload 成功"
    else
        if $PM2 restart photo >> "$EXEC_LOG" 2>&1; then
            log "✅ 回滚 restart 成功"
        else
            log "⚠️  回滚 restart 也失败，执行 stop+start ..."
            $PM2 stop photo >> "$EXEC_LOG" 2>&1 || true
            sleep 3
            $PKILL -f "next-server" >> "$EXEC_LOG" 2>&1 || true
            RETRY=0
            while ss -tlnp 2>/dev/null | grep -q ':3000'; do
                RETRY=$((RETRY+1))
                if [ $RETRY -ge 5 ]; then
                    REMAINING=$(ss -tlnp 2>/dev/null | grep ':3000' | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
                    kill $REMAINING 2>/dev/null || true
                    sleep 2
                    break
                fi
                sleep 2
            done
            $PM2 start photo >> "$EXEC_LOG" 2>&1
            log "✅ 回滚 stop+start 成功"
        fi
    fi

    log "已回滚到: $CURRENT_REAL"
    exit 1
fi

# ============================================================
# 9. Release 清理（保留最近 5 个）
# ============================================================
log_section "9. Release 清理"

RELEASE_COUNT=$(ls -1d "$RELEASES_DIR"/????????-?????? 2>/dev/null | $WC -l)
log "当前 release 数量: $RELEASE_COUNT"

if [ "$RELEASE_COUNT" -gt "$KEEP_RELEASES" ]; then
    log "开始清理旧 release（保留 $KEEP_RELEASES 个）..."
    CANDIDATES=$(ls -1dt "$RELEASES_DIR"/????????-?????? 2>/dev/null | $TAIL -n +$((KEEP_RELEASES + 1)))
    for RELEASE in $CANDIDATES; do
        # 安全检查：绝对不能删 current 或 previous
        if [ "$RELEASE" = "$CURRENT_REAL" ] || [ "$RELEASE" = "$PREVIOUS_REAL" ]; then
            log "SKIP (protected): $RELEASE"
            continue
        fi
        # 防路径穿越二次确认
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
# 10. CDN 刷新（失败降级为 warning，不触发回滚）
# ============================================================
log_section "10. CDN 刷新"

CDN_OK=true
$TCCLI cdn PurgeUrlsCache --Urls '["https://www.fangc.cc/", "https://cdn.fangc.cc/"]' >> "$EXEC_LOG" 2>&1
if [ $? -eq 0 ]; then
    log "✅ CDN 刷新完成"
else
    log "⚠️  CDN 刷新失败（源站已成功，CDN 缓存可能仍有旧内容）"
    log "⚠️  建议手动执行: tccli cdn PurgeUrlsCache ..."
    CDN_OK=false
fi

# ============================================================
# 11. 完成
# ============================================================
log_section "发布完成"

log "✅ 新版本:     $NEW_CURRENT"
log "✅ 旧版本:     $CURRENT_REAL (现为 previous)"
log "✅ 发布日志:   $EXEC_LOG"
log "✅ 部署日志:   $DEPLOY_LOG"

if [ "$CDN_OK" = false ]; then
    log "⚠️  警告: CDN 刷新失败，源站已正常运行，需手动关注"
fi

$PM2 save >> "$EXEC_LOG" 2>&1
log "PM2 状态已保存"
log "========================================="
log "部署流程结束"
exit 0
