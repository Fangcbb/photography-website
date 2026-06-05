#!/bin/bash
#
# photo-rollback.sh — 版本回滚脚本 (增强版)
# 用法: bash /opt/scripts/photo-rollback.sh
#
# 增强项:
#   - flock 互斥锁
#   - 多层健康检查
#   - 日志规范化
#   - previous 链路保护（只回滚到 previous，不回滚到半成品）
#   - 绝对路径
#

set -uo pipefail

# ============================================================
# 绝对路径定义
# ============================================================
PM2="/usr/local/bin/pm2"
CURL="/usr/bin/curl"
LN="/usr/bin/ln"
RM="/usr/bin/rm"
MKDIR="/usr/bin/mkdir"
TEE="/usr/bin/tee"
PKILL="/usr/bin/pkill"
FLOCK="/usr/bin/flock"

# ============================================================
# 目录与路径定义
# ============================================================
SITE_DIR="/var/www/photo-site"
LOG_BASE="/opt/photo/logs"
ROLLBACK_LOCK="/tmp/photo-rollback.lock"
HEALTH_URL="http://127.0.0.1:3000/"
HEALTH_RETRIES=5
HEALTH_INTERVAL=3

# 健康检查关键字
HEALTH_KEYWORD="Fang Bing Photography"

# ============================================================
# 0. 互斥锁（flock）
# ============================================================
ROLLBACK_LOCK_FD=200
eval "exec $ROLLBACK_LOCK_FD>\"$ROLLBACK_LOCK\""

if ! $FLOCK -n $ROLLBACK_LOCK_FD; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: 另一个回滚正在进行中，退出。"
    exit 1
fi

trap "flock -u $ROLLBACK_LOCK_FD 2>/dev/null; rm -f \"$ROLLBACK_LOCK\" 2>/dev/null" EXIT

# ============================================================
# 日志初始化
# ============================================================
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_DIR="$LOG_BASE"
$MKDIR -p "$LOG_DIR" 2>/dev/null || true
DEPLOY_LOG="$LOG_DIR/deploy-$(date +%Y%m%d).log"
EXEC_LOG="$LOG_DIR/rollback-$TIMESTAMP.log"

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

log "回滚锁已获得 (PID $$)"

# ============================================================
# 1. 前置检查
# ============================================================
log_section "1. 前置检查"

CURRENT_LINK="$SITE_DIR/current"
PREVIOUS_LINK="$SITE_DIR/previous"

if [ ! -L "$CURRENT_LINK" ] || [ ! -L "$PREVIOUS_LINK" ]; then
    log "ERROR: current 或 previous symlink 无效，退出"
    exit 1
fi

CURRENT_REAL=$(readlink -f "$CURRENT_LINK")
PREVIOUS_REAL=$(readlink -f "$PREVIOUS_LINK")

log "当前版本 (current): $CURRENT_REAL"
log "回滚目标 (previous): $PREVIOUS_REAL"

if [ "$CURRENT_REAL" = "$PREVIOUS_REAL" ]; then
    log "WARN: current 和 previous 指向同一版本，无需回滚"
    exit 0
fi

# ============================================================
# 2. 切换 symlink
# ============================================================
log_section "2. 切换 symlink"

$RM -f "$CURRENT_LINK"
$LN -s "$PREVIOUS_REAL" "$CURRENT_LINK"
log "current 已切换到: $PREVIOUS_REAL"

# ============================================================
# 3. PM2 重启
# ============================================================
log_section "3. PM2 重启"

log "重启 PM2 photo (cluster restart)..."
if ! $PM2 restart photo >> "$EXEC_LOG" 2>&1; then
    log "❌ PM2 启动失败，请立即手动检查！"
    exit 1
fi
log "PM2 photo 已重启（等待服务就绪...）"
sleep 5

# ============================================================
# 4. 多层健康检查
# ============================================================
log_section "4. 健康检查"

HEALTH_OK=false
for i in $(seq 1 $HEALTH_RETRIES); do
    log "健康检查第 ${i} 次..."

    HTTP_FILE="/tmp/http-code-rollback-$i.txt"
    $CURL -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" > "$HTTP_FILE" 2>/dev/null || echo "000" > "$HTTP_FILE"
    HTTP_CODE=$(cat "$HTTP_FILE")
    rm -f "$HTTP_FILE"
    if [ "$HTTP_CODE" != "200" ]; then
        log "  ❌ HTTP $HTTP_CODE"
        [ $i -eq $HEALTH_RETRIES ] && break
        sleep $HEALTH_INTERVAL
        continue
    fi
    log "  ✅ HTTP 200"

    HTML_FILE="/tmp/health-check-rollback-$i.html"
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

    HEALTH_OK=true
    log "✅ 健康检查通过"
    break
done

if [ "$HEALTH_OK" = false ]; then
    log "❌ 健康检查全部失败，请立即手动检查！"
    log "current 现指向: $(readlink -f "$CURRENT_LINK")"
    exit 1
fi

# ============================================================
# 5. 完成
# ============================================================
log_section "回滚完成"

log "✅ 回滚后版本: $(readlink -f "$CURRENT_LINK")"
log "✅ 执行日志:   $EXEC_LOG"
log "✅ 部署日志:   $DEPLOY_LOG"

$PM2 save >> "$EXEC_LOG" 2>&1
log "PM2 状态已保存"
log "========================================="
log "回滚流程结束"
exit 0
