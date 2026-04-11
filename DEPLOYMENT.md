# 部署指南

## 目录

- [环境要求](#环境要求)
- [快速部署](#快速部署)
- [Vercel 部署](#vercel-部署)
- [Docker 部署](#docker-部署)
- [手动部署 (Node.js)](#手动部署-nodejs)
- [腾讯云部署](#腾讯云部署)
- [环境变量配置](#环境变量配置)
- [后端服务配置](#后端服务配置)
- [域名与 SSL](#域名与-ssl)
- [运维监控](#运维监控)
- [故障排查](#故障排查)

---

## 环境要求

| 要求 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Node.js | 18.17 | 20.x LTS |
| npm | 9.x | 10.x |
| PostgreSQL | 14 | 15+ |
| Docker | 24 | 25+ |
| Docker Compose | 2.20 | 最新版 |

---

## 快速部署

### 方式一：Vercel（一键部署）推荐

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Fangcbb/photography-website)

**优点**：零配置，自动部署，自动 HTTPS

**缺点**：需自行准备 S3 存储（图片无法上传到 Vercel）

### 方式二：Docker（完全自托管）

```bash
git clone https://github.com/Fangcbb/photography-website.git
cd photography-website
cp .env.example .env
# 编辑 .env 填入配置
docker-compose up -d
```

---

## Vercel 部署

### 1.  Fork 仓库

```bash
# 或在 GitHub 网页操作
gh repo fork Fangcbb/photography-website
```

### 2.  连接 Vercel

1. 访问 https://vercel.com/new
2. 选择刚 Fork 的仓库
3. Framework: `Next.js`
4. Root Directory: `/`

### 3.  配置环境变量

在 Vercel Dashboard → Settings → Environment Variables 添加：

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
BETTER_AUTH_SECRET=your-32-char-secret
BETTER_AUTH_URL=https://your-project.vercel.app
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
S3_ENDPOINT=https://s3.region.cloud.tencent.com
S3_BUCKET_NAME=your-bucket
S3_PUBLIC_URL=https://your-cdn.com
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-token
```

### 4.  安装 Build Command

Vercel 会自动执行 `npm run build`，无需额外配置。

### 5.  部署

点击 `Deploy`，等待 2-3 分钟完成。

### 6.  升级

```bash
# 本地更新代码
git pull origin main

# Vercel 会自动重新部署
# 或手动触发
gh workflow run deploy.yml
```

---

## Docker 部署

### 文件说明

| 文件 | 用途 |
|------|------|
| `Dockerfile` | 多阶段构建，生产镜像 ~200MB |
| `docker-compose.yml` | 开发配置（SQLite） |
| `docker-compose.cloud.yml` | 云端配置（PostgreSQL + COS） |
| `docker-compose.standalone.yml` | 完全独立（PostgreSQL 内置） |

### 开发环境

```bash
# 启动开发环境
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

访问 http://localhost:3000

### 生产环境 (docker-compose.cloud.yml)

```bash
# 编辑 .env.production
cp .env.example .env.production
vim .env.production

# 启动
docker-compose -f docker-compose.cloud.yml up -d

# 查看状态
docker-compose -f docker-compose.cloud.yml ps
```

### 完全独立部署 (docker-compose.standalone.yml)

包含 PostgreSQL，无需外部数据库：

```bash
docker-compose -f docker-compose.standalone.yml up -d
```

### Docker 高级配置

```yaml
# docker-compose.override.yml (本地覆盖)
services:
  photo:
    ports:
      - "3000:3000"
    volumes:
      - ./photos:/app/public/photos  # 持久化照片
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 手动部署 (Node.js)

适用于 VPS、云服务器。

### 1. 服务器准备

```bash
# Ubuntu/Debian
apt update && apt upgrade -y
apt install -y nodejs npm nginx certbot curl git

# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 验证
node --version  # v20.x
npm --version   # 10.x
```

### 2. 安装 PostgreSQL

```bash
# Ubuntu
apt install -y postgresql postgresql-contrib

# 启动
systemctl start postgresql
systemctl enable postgresql

# 创建数据库
sudo -u postgres psql
CREATE DATABASE photography;
CREATE USER admin WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE photography TO admin;
\q
```

### 3. 安装 Nginx

```bash
apt install -y nginx

# 配置
vim /etc/nginx/sites-available/photography-website
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/photography-website /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 4. SSL 证书

```bash
certbot --nginx -d your-domain.com
```

### 5. 部署应用

```bash
# 创建用户
useradd -m -s /bin/bash app
su - app

# 安装
git clone https://github.com/Fangcbb/photography-website.git
cd photography-website
npm install --production

# 配置
cp .env.example .env
vim .env

# 构建
npm run build

# 使用 PM2 运行
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 6. 配置 PM2 开机自启

```bash
# 生成启动脚本
pm2 startup
# 按提示执行输出的命令

# 保存当前进程列表
pm2 save
```

---

## 腾讯云部署

### 架构

```
                    ┌─────────────────┐
                    │  轻量应用服务器   │
                    │  (Node.js + PM2) │
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼──────┐    ┌────────▼───────┐    ┌───────▼──────┐
│ PostgreSQL    │    │  COS 对象存储  │    │  CDN 内容分发 │
│ (云数据库)    │    │  (照片/静态资源)│    │              │
└──────────────┘    └────────────────┘    └──────────────┘
```

### 1. 轻量应用服务器

推荐配置：2核4G Ubuntu 22.04

```bash
# 连接服务器
ssh root@your-server-ip

# 按上方"手动部署"完成基础配置
```

### 2. 配置 COS 存储

```bash
# 安装 cos-cli (可选)
npm install -g cos-cli

# 配置
cos-cli configure --secretId YOUR_ID --secretKey YOUR_KEY --region ap-shanghai
```

或在代码中使用 SDK：

```env
S3_ENDPOINT=https://cos.ap-shanghai.myqcloud.com
S3_BUCKET_NAME=your-bucket-1255949132
S3_PUBLIC_URL=https://your-cdn.fangc.cc
```

### 3. 照片目录同步

```bash
# 本地照片上传到 COS
cos-cli sync ./public/photos/ cos://your-bucket/photos/

# 或使用腾讯云数据万象处理
# 图片处理规则：
# - 缩略图: /photos/thumbs/{filename}
# - 中图: /photos/mids/{filename}
# - 原图: /photos/{filename}
```

### 4. CDN 配置

1. 进入腾讯云 CDN 控制台
2. 添加加速域名：`cdn.your-domain.com`
3. 源站类型：COS
4. 配置缓存规则：
   - 图片：`*.jpg, *.png` 缓存 30 天
   - CSS/JS：`*.css, *.js` 缓存 7 天
   - HTML：`*.html` 缓存 no-cache

### 5. Nginx 反向代理

```nginx
# /etc/nginx/sites-available/photography-website
upstream photo_app {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name www.your-domain.com;

    # 重定向到 HTTPS
    return 301 https://www.your-domain.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.your-domain.com;

    ssl_certificate /etc/ssl/your-domain.com.pem;
    ssl_certificate_key /etc/ssl/your-domain.com.key;

    location / {
        proxy_pass http://photo_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /_next/static {
        proxy_pass http://photo_app;
        proxy_cache_valid 200 7d;
    }
}
```

---

## 环境变量配置

### 完整环境变量清单

```env
# ============ 必需 ============

# 数据库
DATABASE_URL=postgresql://user:password@host:5432/dbname

# 认证
BETTER_AUTH_SECRET=your-secret-key-32-chars-minimum
BETTER_AUTH_URL=https://your-domain.com

# 应用
NEXT_PUBLIC_APP_URL=https://your-domain.com

# ============ 可选 ============

# S3 存储 (用于图片)
S3_ENDPOINT=https://s3.region.cloud.example.com
S3_BUCKET_NAME=your-bucket
S3_PUBLIC_URL=https://cdn.your-domain.com
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret

# 地图 (可选，无则无地图功能)
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your-token

# 管理员账号 (首次部署自动创建)
SEED_USER_EMAIL=admin@example.com
SEED_USER_PASSWORD=your-admin-password
SEED_USER_NAME=Admin

# ============ 开发 ============

NODE_ENV=development
```

### 获取服务

| 服务 | 免费方案 | 地址 |
|------|----------|------|
| PostgreSQL | Neon 3GB / Supabase 500MB | neon.tech / supabase.com |
| S3 存储 | 腾讯云 COS 50GB | cloud.tencent.com |
| CDN | 腾讯云 CDN 10GB | cloud.tencent.com |
| 地图 | Mapbox 5万次/月 | mapbox.com |
| 域名 | 阿里云/腾讯云 | - |
| SSL | Let's Encrypt (免费) | - |

---

## 后端服务配置

### PM2 进程管理

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'photo',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      max_logs: 10
    }
  ]
};
```

### 管理命令

```bash
# 启动
pm2 start ecosystem.config.js

# 重启
pm2 restart photo

# 停止
pm2 stop photo

# 查看日志
pm2 logs photo

# 实时监控
pm2 monit

# 保存进程列表
pm2 save

# 开机自启
pm2 startup
```

---

## 域名与 SSL

### DNS 配置

| 记录类型 | 主机 | 值 | 说明 |
|----------|------|-----|------|
| A | www | 服务器IP | 主站 |
| A | @ | 服务器IP | 根域名 |
| CNAME | cdn | xxx.cos.cloud.tencent.com | CDN 加速 |
| CNAME | music | 服务器IP | 音乐播放器 |
| CNAME | admin | 服务器IP | 后台管理 |

### SSL 证书

```bash
# 使用 Let's Encrypt (Nginx)
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com -d www.your-domain.com

# 自动续期测试
certbot renew --dry-run
```

---

## 运维监控

### PM2 监控

```bash
# 查看所有进程
pm2 list

# 查看详情
pm2 info photo

# 实时日志
pm2 logs photo --lines 100 --nostream

# 监控 CPU/内存
pm2 monit
```

### 健康检查

```bash
# 应用健康检查
curl http://localhost:3000/api/health
# 返回: {"status":"ok","uptime":3600}

# 数据库连接
npm run db:studio
```

### 日志管理

```bash
# 日志轮转 (logrotate)
cat >> /etc/logrotate.d/photography << 'EOF'
/root/.pm2/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 root root
}
EOF
```

### 备份策略

```bash
# 数据库备份脚本
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U admin photography > /backups/db_$DATE.sql
find /backups -name "*.sql" -mtime +7 -delete
```

```bash
# Cron 定时备份
crontab -e
# 每天凌晨 3 点备份
0 3 * * * /opt/backup.sh >> /var/log/backup.log 2>&1
```

---

## 故障排查

### 常见问题

#### 1. 构建失败

```bash
# 清理缓存重新构建
rm -rf .next node_modules/.cache
npm run build
```

#### 2. 数据库连接失败

```bash
# 检查 DATABASE_URL 格式
echo $DATABASE_URL
# 应该是: postgresql://user:password@host:port/dbname

# 测试连接
psql $DATABASE_URL -c "SELECT 1"
```

#### 3. 端口被占用

```bash
# 查看端口占用
lsof -i :3000

# 杀死进程
kill -9 $(lsof -t -i:3000)
```

#### 4. 图片不显示

```bash
# 检查 COS 配置
echo $S3_PUBLIC_URL
# 确认 bucket 权限为公有读

# 检查文件路径
curl -I $S3_PUBLIC_URL/photos/test.jpg
```

#### 5. 地图加载失败

```bash
# 检查 Mapbox Token
echo $NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
# 确认 Token 已激活且有权限
```

#### 6. PM2 启动失败

```bash
# 查看错误日志
pm2 logs photo --err

# 常见原因：
# - PORT 已被占用
# - .env 文件缺失
# - node_modules 未安装
```

### 日志分析

```bash
# Nginx 错误日志
tail -f /var/log/nginx/error.log

# PM2 应用日志
pm2 logs photo --lines 50 --nostream

# 系统日志
journalctl -u nginx -f
```

### 安全检查

```bash
# 检查开放端口
ss -tulpn | grep LISTEN

# 检查防火墙
ufw status

# 检查 Fail2ban (防暴力破解)
fail2ban-client status
```

---

## 性能调优

### Node.js

```bash
# 增加内存限制
NODE_OPTIONS="--max-old-space-size=2048"
```

### Nginx

```nginx
# 启用 gzip
gzip on;
gzip_types text/plain application/json application/javascript text/css image/svg+xml;
gzip_min_length 1000;

# 静态文件缓存
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### 数据库

```sql
-- 创建索引
CREATE INDEX idx_photos_taken_at ON photos(taken_at);
CREATE INDEX idx_photos_location ON photos((location->>'lat'));

-- 分析查询
EXPLAIN ANALYZE SELECT * FROM photos WHERE taken_at > '2024-01-01';
```

---

*最后更新: 2026-04-11*
