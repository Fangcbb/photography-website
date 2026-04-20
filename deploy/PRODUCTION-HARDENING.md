# Production Hardening — 2026-04-20

---

## 1. 本轮已完成的生产加固项

### 部署基础设施

- **precheck / deploy / rollback 三脚本体系** (`/opt/scripts/`)
  - `photo-precheck.sh`: 7 项环境检查（Node ≥20.9, PM2 online, symlink, source dir, disk ≥1G, health API, deploy lock）
  - `photo-deploy.sh`: PM2 reload 零停机发布 + 多层健康检查（HTTP 200 + HTML 关键字 + /api/health）+ 自动回滚
  - `photo-rollback.sh`: 独立回滚脚本（切换 previous symlink）

- **PM2 reload 零停机发布**
  - 使用 `pm2 reload photo` 替代 stop+start，HTTP 不可用窗口从 ~53s 缩短到 ~3s
  - PM2 重启优先级链：reload → restart → stop+start

- **回滚顺序修正**
  - 修正前：PM2 restart → 切换 symlink（PM2 仍加载失败的新 release）
  - 修正后：先切 symlink 回旧版本 → PM2 reload（PM2 加载正确旧版本）

### 应用层

- **auth trustedOrigins 收口**
  - 移除硬编码公网 IP (`http://122.51.140.190:3000`)
  - 移除 `localhost` / `127.0.0.1` 作为生产 trustedOrigins
  - 只保留 `https://fangc.cc` 和 `https://www.fangc.cc`

- **PostgreSQL sslmode 修正**
  - `sslmode=require` → `sslmode=verify-full`
  - 消除 libpq 未来兼容性警告

- **deleted photo → 404**
  - `/p/[id]` 页面在 SSR 层捕获 `TRPCError(NOT_FOUND)` 并调用 `notFound()`
  - 不再向 PM2 日志写入大量 `Photo not found` 错误
  - 用户看到友好的 404 页面而非空白错误

- **首页 ISR**
  - `export const dynamic = "force-dynamic"` → `export const revalidate = 60`
  - 冷 TTFB: ~600ms → ~10ms
  - 管理员修改首页内容后约 60 秒更新（可接受）

### 可观测性与运维

- **PM2 日志轮转**
  - `pm2 set pm2:out_max_size 10M`
  - `pm2 set pm2:error_max_size 10M`
  - 日志超过 10MB 自动轮转，避免磁盘膨胀

- **Watchdog 日志与 state 持久化**
  - 日志：`/tmp/photo-watchdog.log` → `/opt/photo/logs/watchdog.log`
  - 状态：`/tmp/photo-watchdog.state` → `/opt/photo/state/watchdog.state`
  - 解决 /tmp 清理导致 restart 计数归零、误触发 rebuild 的问题

### 配置

- **DATABASE_PROVIDER 语义修正**
  - 生产 `.env`: `DATABASE_PROVIDER=local` → `DATABASE_PROVIDER=neon`
  - `docker-compose.cloud.yml`: `DATABASE_PROVIDER=cloud` → `DATABASE_PROVIDER=neon`
  - `.env.example` 新增注释说明 local / neon 区别

---

## 2. 当前标准生产操作流程

### 发布流程

```bash
# 1. 部署前环境自检
bash /opt/scripts/photo-precheck.sh

# 2. 自检通过后执行发布（自动健康检查 + 失败自动回滚）
bash /opt/scripts/photo-deploy.sh
```

### 回滚流程

```bash
# 仅在 deploy 失败时手动执行
bash /opt/scripts/photo-rollback.sh
```

**Rollback 触发条件：**
- deploy 脚本健康检查三层（HTTP 200 + HTML 关键字 + /api/health）全部失败
- deploy 脚本已自动执行回滚，不建议跳过直接重试

**不需要回滚的情况：**
- 健康检查部分通过（HTML 关键字不符但 HTTP 200）
- 应用正常运行但有功能问题 → 正常发布新版本修复

### 查看日志

```bash
# 部署日志
tail -f /opt/photo/logs/deploy-$(date +%Y%m%d).log

# Watchdog 日志
tail -f /opt/photo/logs/watchdog.log

# PM2 进程日志
pm2 logs photo --lines 100 --nostream
```

---

## 3. 后续观察项

| 项目 | 观察内容 | 预期 |
|------|---------|------|
| ISR 缓存 | 首页内容修改后约 60 秒更新 | 管理员修改内容应在 60s 内可见 |
| Watchdog | restart 计数是否稳定，是否有误触发 | 30min 内重启次数应在合理范围（正常应 <5） |
| PM2 日志轮转 | `/root/.pm2/logs/photo-*.log` 是否正常轮转 | 日志文件大小不超过 10MB |
| Photo 404 | `/p/[id]` 访问不存在照片是否返回 404 | PM2 日志不再出现 `Photo not found` |
| SSL warning | PostgreSQL 连接是否正常，不再出现 libpq warning | PM2 日志无 `SECURITY WARNING` |
| PM2 restart count | photo 进程 restart_time 是否稳定 | 30min 内应 ≤5（正常发布不计） |

### 发现问题时的快速恢复

```bash
# 1. 查看 photo 进程状态
pm2 describe photo

# 2. 查看 PM2 日志
pm2 logs photo --lines 50

# 3. 手动回滚
bash /opt/scripts/photo-rollback.sh

# 4. 如需重建（watchdog 已自动执行，可手动触发）
cd /var/www/photo-site/current && npm run build && pm2 restart photo
```
