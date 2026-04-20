#!/bin/bash
#
# photo-precheck.sh — 部署前环境自检脚本
# 用法: bash /opt/scripts/photo-precheck.sh
#
# 检查项:
#   1. Node 版本 >= 20.9
#   2. PM2 photo 状态为 online
#   3. current / previous symlink 存在
#   4. 源代码目录存在
#   5. 磁盘空间 >= 1G
#   6. 当前健康检查返回 200
#   7. (可选) deploy 锁是否被占用
#

set -Eeuo pipefail

PM2="/usr/local/bin/pm2"
CURL="/usr/bin/curl"
NODE="/root/.nvm/versions/node/v22.22.1/bin/node"
DF="/usr/bin/df"
LS="/usr/bin/ls"
TEST="/usr/bin/test"
LOG_BASE="/opt/photo/logs"

PASS=0
FAIL=0

# ─────────────────────────────────────────────
# 辅助函数
# ─────────────────────────────────────────────
check() {
    local label="$1"
    local cmd="$2"
    local expect="$3"

    local result
    result=$(eval "$cmd" 2>&1) || true

    if eval "$expect" > /dev/null 2>&1; then
        echo "  ✅ $label"
        echo "     → $result"
        PASS=$((PASS+1))
    else
        echo "  ❌ $label"
        echo "     → $result"
        echo "     期望: $expect"
        FAIL=$((FAIL+1))
    fi
}

pass() {
    echo "  ✅ $1"
    PASS=$((PASS+1))
}

fail() {
    echo "  ❌ $1"
    FAIL=$((FAIL+1))
}

# ─────────────────────────────────────────────
# 头部
# ─────────────────────────────────────────────
echo ""
echo "=========================================="
echo "部署前环境自检"
echo "=========================================="
echo ""

# ─────────────────────────────────────────────
# 1. Node 版本
# ─────────────────────────────────────────────
echo "[1] Node 版本"
NODE_VERSION=$($NODE -v 2>&1)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
NODE_MINOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f2)

if [ "$NODE_MAJOR" -gt 20 ] || { [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -ge 9 ]; }; then
    pass "Node $NODE_VERSION (要求 >= 20.9) ✅"
else
    fail "Node $NODE_VERSION (要求 >= 20.9) ❌"
fi

# ─────────────────────────────────────────────
# 2. PM2 photo 状态
# ─────────────────────────────────────────────
echo ""
echo "[2] PM2 photo 进程状态"
if ! $PM2 describe photo > /dev/null 2>&1; then
    fail "photo 进程不存在"
else
    PM2_STATUS=$($PM2 jlist 2>/dev/null | python3 -c "
import sys, json
p = [x for x in json.load(sys.stdin) if x['name']=='photo']
if p:
    print(p[0].get('pm2_env', {}).get('status', 'unknown'))
" 2>/dev/null)

    if [ "$PM2_STATUS" = "online" ]; then
        pass "PM2 photo 状态: $PM2_STATUS ✅"
    else
        fail "PM2 photo 状态: $PM2_STATUS (要求 online) ❌"
    fi

    # (可选) PM2 使用 Node 版本
    PM2_NODE_VER=$($PM2 describe photo 2>/dev/null | grep "node.js version" | awk '{print $NF}')
    if [ -n "$PM2_NODE_VER" ]; then
        echo "     PM2 Node 版本: $PM2_NODE_VER"
    fi
fi

# ─────────────────────────────────────────────
# 3. current / previous symlink
# ─────────────────────────────────────────────
echo ""
echo "[3] Symlink 检查"

for link_name in current previous; do
    LINK_PATH="/var/www/photo-site/$link_name"
    if [ -L "$LINK_PATH" ]; then
        TARGET=$(readlink -f "$LINK_PATH" 2>/dev/null)
        if [ -d "$TARGET" ]; then
            pass "$link_name → $TARGET ✅"
        else
            fail "$link_name → $TARGET (目录不存在) ❌"
        fi
    else
        fail "$link_name (不是 symlink 或不存在) ❌"
    fi
done

# ─────────────────────────────────────────────
# 4. 源代码目录
# ─────────────────────────────────────────────
echo ""
echo "[4] 源代码目录"
if [ -d "/photography-website-main" ]; then
    pass "/photography-website-main 存在 ✅"
else
    fail "/photography-website-main 不存在 ❌"
fi

# ─────────────────────────────────────────────
# 5. 磁盘空间
# ─────────────────────────────────────────────
echo ""
echo "[5] 磁盘空间"
AVAIL_KB=$(df -k /var/www 2>/dev/null | awk 'NR==2 {print $4}')
AVAIL_GB=$(echo "scale=2; $AVAIL_KB / 1024 / 1024" | bc 2>/dev/null || echo "?")

if [ -n "$AVAIL_KB" ] && [ "$AVAIL_KB" -gt 1048576 ]; then
    pass "剩余空间 ${AVAIL_GB}G (要求 >= 1G) ✅"
else
    fail "剩余空间 ${AVAIL_GB}G (要求 >= 1G) ❌"
fi

# ─────────────────────────────────────────────
# 6. 当前健康检查
# ─────────────────────────────────────────────
echo ""
echo "[6] 当前线上健康检查"
HTTP_CODE=$($CURL -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    pass "HTTP 200 (要求 online 健康) ✅"
else
    fail "HTTP $HTTP_CODE (要求 200) ❌"
fi

# ─────────────────────────────────────────────
# 7. (可选) Deploy 锁状态
# ─────────────────────────────────────────────
echo ""
echo "[7] Deploy 锁状态"
if $TEST -f /tmp/photo-deploy.lock 2>/dev/null; then
    # 锁存在但可能已过期，检查进程是否存在
    LOCK_PID=$(cat /tmp/photo-deploy.lock 2>/dev/null | head -1)
    if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
        echo "  ⚠️  Deploy 锁被 PID $LOCK_PID 持有，可能有部署正在进行"
        echo "     如确认无部署，可手动删除: rm /tmp/photo-deploy.lock"
    else
        echo "  ⚠️  Deploy 锁文件存在但进程已不存在，建议删除"
        echo "     rm /tmp/photo-deploy.lock"
    fi
else
    echo "  ✅ 无部署锁占用"
fi

# ─────────────────────────────────────────────
# 总结
# ─────────────────────────────────────────────
echo ""
echo "=========================================="
echo "检查完成: $PASS 通过, $FAIL 失败"
echo "=========================================="
echo ""

if [ "$FAIL" -gt 0 ]; then
    echo "❌ Precheck 失败，请先修复上述问题再部署"
    exit 1
else
    echo "✅ Precheck OK — 环境正常，可以开始部署"
    exit 0
fi
