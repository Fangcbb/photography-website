<div align="right">
  <a href="README.md">English</a> · <a href="README.zh-CN.md"><b>简体中文</b></a>
</div>

<h1 align="center">方斌摄影 · Fang Photography</h1>

<p align="center">
  一个自托管的摄影作品集、旅行记录与音乐播放器 —— 一个 Next.js 应用，从上传到 CDN 全链路自己做。
</p>

<p align="center">
  <a href="https://www.fangc.cc"><b>www.fangc.cc</b></a>
</p>

<p align="center">
  <img src="screenshots/home.webp" alt="首页" width="860">
</p>

## 这是什么

给摄影师自己用的站点：发布照片、按城市归档、在地图上浏览、写文章，顺便还能听歌。后台、上传管线、图片分发和错误日志都在同一个代码库里，背后没有第三方 CMS。

整个项目围绕一个现实约束设计：**原图非常大**（3～18MB 的 RAW 导出）。所以你看到的每一张图都是按需生成的，缓存在 CDN 边缘，加载期间用 blurhash 占位，不会白屏也不会糊。

## 功能

**摄影**
- 全屏首图轮播、城市瀑布墙、沉浸式照片页，带 EXIF 浮层（机身、镜头、焦段、光圈、快门、日期）
- BlurHash 占位 + 主色背景，图片没加载完也不难看
- 键盘翻页；不用 `next/image`，改走自有变体接口

**旅行**
- 城市合集：全屏封面、城市简介、实时照片计数
- 后台可点星设封面，再点取消；没有指定封面时自动回退到最新的公开照片

**音乐（Aura Music）**
- 网易云搜索，经同源代理流式播放（支持 `Range` / 206）
- 逐字歌词、封面取色主题、GLSL 着色器背景、键盘快捷键、Media Session 接入
- 可选网易云 Cookie 解锁 VIP 音源；直链 403 时自动换镜像节点

**后台与运维**
- 仪表盘：照片 / 文章 / 视频 / 城市管理，城市封面选择器
- 错误日志页：落盘 JSONL，可按来源、级别、日期、关键字筛选，CLI 也能查
- 分片上传（4MiB 一片、HMAC 会话签名、单片重试），进度停在 99% 显示"正在确认存储"而不是假装完成
- `/api/health` 返回当前运行的 `buildId`

**平台能力**
- tRPC v11 端到端类型、Drizzle ORM + PostgreSQL、better-auth 会话
- 基于 nonce 的 CSP、照片可见性控制、歌词接口 SSRF 防护、客户端错误上报限流
- PM2 + nginx + 腾讯云 CDN，PWA、RSS、sitemap、JSON-LD

## 界面

<table>
  <tr>
    <td width="50%"><img src="screenshots/city.webp" alt="城市合集"><br><sub><b>城市合集</b> —— 全屏封面、城市简介、照片墙</sub></td>
    <td width="50%"><img src="screenshots/music.webp" alt="音乐播放器"><br><sub><b>Aura Music</b> —— 着色器背景、逐字歌词、网易云搜索</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="screenshots/about.webp" alt="关于页"><br><sub><b>关于</b> —— 全幅人像、器材清单、技术栈</sub></td>
    <td width="50%">
      <sub><b>后台仪表盘</b> —— 统计、照片/文章/视频/城市管理、错误日志。<br><br>
      此处不放截图：后台需要登录态，不在自动截图流程里。你可以自己登录 <a href="https://www.fangc.cc/dashboard">/dashboard</a> 查看。</sub>
    </td>
  </tr>
</table>

## 技术栈

| 层次 | 选型 |
|---|---|
| 框架 | Next.js 16（App Router）+ React 19 |
| 语言 | TypeScript |
| 接口 | tRPC v11 + Zod |
| 数据库 | PostgreSQL（Neon）+ Drizzle ORM |
| 认证 | better-auth |
| 存储 | S3 兼容对象存储（腾讯云 COS）+ 数据万象实时处理 |
| UI | Tailwind CSS v4 + shadcn/ui + Radix |
| 数据请求 | TanStack Query v5 |
| 状态 | Zustand |
| 动效 / 3D | Framer Motion、Three.js + GLSL |
| 地图 | Mapbox GL JS（瓦片与地理编码走同源代理） |
| 分发 | PM2 + nginx + 腾讯云 CDN |

## 图片管线

原图原封不动留在对象存储里。页面上每张图都走 `/api/photo/v2/{id}?v={variant}`：

| 变体 | 宽度 | 质量 | 用途 |
|---|---|---|---|
| `thumb` | 400px | 75 | 极小缩略图 |
| `fangb` | 800px | 80 | 卡片、地图标记、占位 |
| `display` | 1920px | 82 | 轮播、照片详情、地图弹窗 |
| `hero` | 2560px | 85 | 全屏高度封面 |

处理器向数据万象请求 `imageMogr2/thumbnail/{w}x/format/webp/quality/{q}/strip`，失败时依次回退到命名样式和原图。图片响应带一年 `immutable` —— 正因为如此，版本号放在**路径**里（`/v2/`）而不是查询参数：CDN 生成缓存键时会忽略 query。

## 目录结构

```
src/
├── app/
│   ├── (home)/            # 首页、关于、博客、音乐、发现
│   ├── (photograph)/      # /p/[id] 照片页
│   ├── (dashboard)/       # 后台
│   └── api/               # tRPC、图片代理、上传、音乐、日志
├── modules/               # 按功能拆分（photos、cities、travel、music、s3 …）
│   ├── */server/          # tRPC 路由与业务逻辑
│   ├── */ui/              # 视图与组件
│   └── */lib/             # 公共工具
├── components/            # 设计系统 + AuraMusic 播放器
├── db/                    # Drizzle schema 与连接
└── lib/                   # logger、图片代理、音乐 provider
scripts/                   # 审计、日志 CLI、种子数据
```

## 本地运行

```bash
git clone https://github.com/Fangcbb/photography-website.git
cd photography-website
npm install
npm run db:push      # 应用 Drizzle schema
npm run dev
```

### 环境变量

| 变量 | 用途 | 说明 |
|---|---|---|
| `DATABASE_URL` | 全局 | PostgreSQL 连接串 |
| `BETTER_AUTH_SECRET` | 认证 | 会话签名密钥 |
| `NEXT_PUBLIC_APP_URL` | 认证、tRPC | 站点外部地址，如 `https://www.fangc.cc` |
| `S3_ENDPOINT` / `S3_BUCKET_NAME` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | 上传 | 任意 S3 兼容存储 |
| `NEXT_PUBLIC_S3_PUBLIC_URL` | 图片 | 公开访问 / CDN 基地址 |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | `/discover` | Mapbox token |
| `MUSIC_API_BASE` | `/music` | 自建网易云代理地址 |
| `MUSIC_U`、`MUSIC_R_U`、`MUSIC_R_T`、`MUSIC_A_T` | 可选 | 网易云 Cookie 字段，用于 VIP 音源 |
| `NEXT_PUBLIC_GA_ID` | 可选 | GA4 |
| `LOG_DIR` | 可选 | JSONL 错误日志目录（默认 `~/logs`） |
| `DATABASE_URL_SECONDARY` | 可选 | 双写副库 |

### 构建与启动

```bash
export BETTER_AUTH_SECRET=build-only-placeholder-not-for-runtime
npm run build
pm2 start npm --name photo -- start -- -H 127.0.0.1
```

这两个坑一定会遇到：

- `NEXT_PUBLIC_*` 是**构建期内联**的，改了值必须重新 build，光重启没用。
- `next start` **不认 `HOSTNAME` 环境变量**，要用 `-H` 显式绑定；另外 `pm2 restart` 不会重载 standalone 产物，构建后请用 `pm2 delete` + `pm2 start`。

## 常用脚本

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建（webpack、PWA、剔除 source map） |
| `npm run lint` / `test` | 代码检查 / 单元测试 |
| `npm run db:push` / `db:studio` | 应用 schema / 浏览数据 |
| `npm run photos:audit` | 逐条核对照片记录与存储是否一致 |
| `npm run photos:audit:fix` | 按相机文件名把记录回链到孤儿文件 |
| `npm run logs` / `logs:summary` | 用 CLI 查询 JSONL 错误日志 |

## 许可

[MIT](LICENSE) © Fang Bing
