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

项目使用 Next.js `output: "standalone"` 模式。构建后产物位于 `.next/standalone/`：

```
.next/standalone/
├── server.js              # PM2 启动入口
├── package.json
├── .next/
│   ├── static/            # SSR 静态资源（由 npm run build 自动复制）
│   └── server/             # Next.js SSR chunks
└── public/                # 静态公共资源（由 npm run build 自动复制）
```

**deploy.sh 部署逻辑：**
1. rsync 源代码（排除 `.git`、`node_modules`、`.next`）
2. 在服务器执行 `npm run build`（在源代码目录）
3. 将构建后的 `.next` 整体复制到 release 目录

> ⚠️ 不要在 rsync 时同时复制 `.next/`（会导致嵌套 .next/.next/ 结构）

## 重要说明

- 所有脚本运行在 **生产服务器** `/opt/scripts/` 目录
- `docker-compose*.yml` 为容器化方案，本项目目前使用 PM2 + standalone 架构
- 不要将 CI / Docker 配置文件与服务器运维脚本混淆
