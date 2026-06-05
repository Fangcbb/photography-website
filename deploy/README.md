# Production Deploy Scripts

Server-side operational scripts for fangc.cc photo site deployment.

## 目录说明

| 脚本 | 用途 |
|------|------|
| `photo-precheck.sh` | 部署前环境自检（Node 版本、PM2 状态、symlink、磁盘、health）|
| `photo-deploy.sh` | 生产发布脚本（PM2 reload 零停机、多层健康检查、自动回滚）|
| `photo-rollback.sh` | 独立回滚脚本（切换到 previous symlink） |

## 标准发布流程

```bash
# 1. 部署前自检
bash /opt/scripts/photo-precheck.sh

# 2. 自检通过后执行发布
bash /opt/scripts/photo-deploy.sh

# 3. 如需回滚（仅在 deploy 失败时）
bash /opt/scripts/photo-rollback.sh
```

## 构建产物结构

项目使用 Next.js `output: "standalone"` 模式。构建后：

1. `npm run build` 在源码目录产出 `.next/standalone/server.js`
2. postbuild 自动复制 `server.js` 到项目根目录（与 `.next/` 同级）
3. 最终部署产物（在 release 目录）结构：

```
{release}/
├── server.js              # PM2 启动入口（postbuild 复制到根目录）
├── .next/
│   ├── standalone/         # Next.js standalone 产出（仅作备份）
│   ├── static/             # SSR 静态资源
│   └── server/             # Next.js SSR chunks
└── public/                # 静态公共资源
```

### 启动规则（唯一真相）

| 配置项 | 值 |
|--------|-----|
| cwd | /var/www/photo-site/current |
| script | ./server.js（postbuild 复制到根目录）|

**发布**：切 symlink，**不改 script 路径**。
**回滚**：切 symlink 到 previous，**不改 script 路径**。

> postbuild 步骤：`cp .next/standalone/server.js .`
> 这确保 server.js 始终在根目录，与 ecosystem.config.js 的 ./server.js 一致。

```js
// ecosystem.config.js — 唯一正确配置
module.exports = {
  apps: [{
    name: 'photo',
    script: './server.js',       // postbuild 复制到根目录
    cwd: '/var/www/photo-site/current',
    instances: 1,
    exec_mode: 'cluster',
    wait_ready: true,
    listen_timeout: 30000,
  }]
}
```

## 重要说明

- 所有脚本运行在 **生产服务器** `/opt/scripts/` 目录
- `docker-compose*.yml` 为容器化方案，本项目目前使用 PM2 + standalone 架构

## 重要说明

- 所有脚本运行在 **生产服务器** `/opt/scripts/` 目录
- `docker-compose*.yml` 为容器化方案，本项目目前使用 PM2 + standalone 架构
- 不要将 CI / Docker 配置文件与服务器运维脚本混淆
