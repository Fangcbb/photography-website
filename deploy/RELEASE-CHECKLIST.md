# Release Checklist

> 适用范围：当前生产环境（PM2 + Next.js + `/opt/scripts` 发布脚本）

---

## 发布前

### 1. 确认代码已同步

```bash
git pull origin main
```

### 2. 运行部署前自检

```bash
bash /opt/scripts/photo-precheck.sh
```

期望结果：

- `✅ Precheck OK`
- 如果失败，先修复，不要直接 deploy

---

## 发布

### 3. 执行发布

```bash
bash /opt/scripts/photo-deploy.sh
```

期望结果：

- deploy 成功
- PM2 动作为 `reload`
- 健康检查通过
- 无 `HTTP 000`

---

## 发布后快速检查

### 4. 检查首页

访问首页，确认：

- 页面正常打开
- 图片正常显示
- 无明显样式异常
- 无空白或报错

### 5. 检查健康接口

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health
```

期望结果：`200`

### 6. 检查 PM2 状态

```bash
pm2 list
pm2 show photo
```

期望结果：

- `photo` 为 `online`
- 无异常重启增长
- `exec cwd` 指向 `/var/www/photo-site/current`

### 7. 检查日志

```bash
tail -n 100 /opt/photo/logs/deploy-$(date +%Y%m%d).log
tail -n 100 /root/.pm2/logs/photo-error.log
```

期望结果：

- deploy 流程正常结束
- 无新的致命错误

---

## 如果发布失败

### 8. 手动回滚

```bash
bash /opt/scripts/photo-rollback.sh
```

然后再次检查：

- 首页是否恢复
- `/api/health` 是否 200
- `pm2 list` 是否正常

---

## 日常观察项

发布后可顺手观察：

- 首页 ISR 是否符合预期（最多约 60 秒更新）
- `/p/[id]` 不存在的页面是否正确返回 404
- PM2 日志是否持续增长异常
- watchdog 是否有误触发记录：

```bash
tail -n 100 /opt/photo/logs/watchdog.log
```

---

## 原则

- **先 precheck，再 deploy**
- deploy 失败时，**优先看日志，不要盲目重试**
- 出现异常时，**先 rollback 恢复站点**
- 服务器上的脚本改动，**尽快同步回仓库**
