# fangc.cc — Photography Portfolio with Immersive Music Player

一个融合摄影作品展示与沉浸式音乐播放的个人网站。照片库采用瀑布流布局，支持地图定位；音乐播放器拥有 WebGL 着色器背景、专辑封面色彩驱动、同步歌词等特性。

> **在线演示**: https://www.fangc.cc  
> **音乐播放器**: https://www.fangc.cc/music

---

## ✨ 特性

### 摄影作品库
- 📷 **瀑布流照片墙** — 支持 6 种布局（经典网格、瀑布流、杂志风等）
- 🗺️ **地图定位** — Mapbox 交互式地图，旅行照片按地理位置展示
- 📁 **照片管理后台** — 后台管理系统，支持精选集、布局配置
- 🖼️ **图片处理** — 腾讯云数据万象（图片质量评估、超分辨率）
- 📱 **响应式设计** — 适配移动端与桌面端

### 🎵 Aura Music 播放器
- 🎨 **沉浸式 Shader 背景** — WebGL GLSL 着色器动画，随专辑封面色彩动态变化（ColorThief 提取）
- 🎤 **多语言同步歌词** — 支持逐字时间轴，原始语种 + 翻译双语显示
- 🔍 **音乐搜索** — 聚合搜索（网易云音乐）
- 📡 **网络电台** — 内置 7 个高质量电台，每日自动切换
- ⌨️ **全局快捷键** — 方向键控制播放、Shift+N 收藏、ESC 退出

### 技术栈
| 分类 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 |
| 类型安全 | tRPC v11 + Zod |
| 数据库 | PostgreSQL (Neon/Supabase) + Drizzle ORM |
| 文件存储 | S3 兼容存储 (腾讯云 COS / AWS S3 / R2) |
| 地图 | Mapbox GL JS + react-map-gl |
| UI | Tailwind CSS v4 + shadcn/ui + Radix UI |
| 状态管理 | Zustand + TanStack Query v5 |
| 认证 | Better Auth |
| 动画 | Framer Motion + React Spring |
| 3D/Shader | Three.js + GLSL |
| 图片处理 | ColorThief + 腾讯云数据万象 |
| 歌词解析 | 自研 TTML/LRC 解析器，支持逐字时间 |

---

## 🏗️ 项目架构

```
photography-website/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (home)/             # 首页路由组
│   │   ├── (photograph)/       # 照片库路由组
│   │   ├── (dashboard)/       # 后台管理路由组
│   │   ├── api/                # API 路由
│   │   │   ├── music-search/   # 音乐搜索 API
│   │   │   └── trpc/           # tRPC 端点
│   │   └── music/              # 音乐播放器页面
│   ├── components/
│   │   ├── AuraMusic/          # 音乐播放器核心
│   │   │   ├── components/     # UI 组件（播放器、歌词、搜索等）
│   │   │   ├── hooks/          # React Hooks
│   │   │   ├── services/       # 业务逻辑（音频处理、歌词解析）
│   │   │   └── shaders/        # GLSL 着色器
│   │   ├── home/               # 首页组件
│   │   ├── photograph/         # 照片库组件
│   │   └── ui/                 # 通用 UI 组件
│   ├── lib/                    # 工具函数
│   └── site.config.ts          # ⚠️ 唯一需要编辑的配置文件
├── public/                     # 静态资源
├── drizzle/                    # 数据库迁移
├── scripts/                    # 运维脚本
└── docker-compose.*.yml        # Docker 部署配置
```

### 核心模块

**AuraMusic 播放器 (`src/components/AuraMusic/`)**
- `App.tsx` — 播放器主容器，管理播放状态、队列、收藏
- `components/SearchModal.tsx` — 搜索浮层，支持多引擎聚合搜索
- `components/AuraShaderBackground.tsx` — WebGL 着色器背景（Three.js + GLSL）
- `components/LyricsView.tsx` — 歌词面板，支持逐字高亮
- `services/lyricsService.ts` — 歌词获取（网易云 API）
- `services/audioLevelBridge.ts` — 音频分析与动画桥接
- `hooks/usePlayer.ts` — 播放状态管理
- `hooks/useNeteaseSearchProvider.ts` — 网易云搜索提供者

**照片库 (`src/components/photograph/`)**
- `components/PhotoGrid.tsx` — 瀑布流/网格布局
- `components/MapView.tsx` — Mapbox 地图展示

---

## 🚀 快速部署

### 方式一：Vercel（一键部署）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Fangcbb/photography-website)

部署前需配置环境变量（见下方）。

### 方式二：Docker（自托管）

```bash
# 克隆仓库
git clone https://github.com/Fangcbb/photography-website.git
cd photography-website

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入所需配置

# 启动（使用 SQLite 本地开发）
docker-compose up -d

# 或使用 PostgreSQL
docker-compose -f docker-compose.yml up -d
```

### 方式三：Node.js 手动部署

> ⚠️ **推荐方式**：生产环境应使用项目自带的部署脚本，见 [deploy/README.md](./deploy/README.md)。以下仅作参考。

```bash
git clone https://github.com/Fangcbb/photography-website.git
cd photography-website
npm install

# 配置环境变量
cp .env.example .env

# 构建
npm run build

# 启动
npm start
```

---

## ⚙️ 环境变量

在 `.env` 中配置以下变量：

```env
# ========== 数据库 ==========
DATABASE_URL=postgresql://user:password@host:5432/dbname
# 或使用 Neon/Supabase 连接字符串

# ========== 认证 ==========
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=https://your-domain.com

# ========== 应用 ==========
NEXT_PUBLIC_APP_URL=https://your-domain.com

# ========== S3 存储 ==========
S3_ENDPOINT=https://s3.region.cloud.tencent.com
S3_BUCKET_NAME=your-bucket
S3_PUBLIC_URL=https://your-cdn-url.com
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key

# ========== 地图（可选） ==========
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-token

# ========== 管理员账号 ==========
SEED_USER_EMAIL=admin@example.com
SEED_USER_PASSWORD=your-password
SEED_USER_NAME=Admin
```

### 获取第三方 API Key

| 服务 | 获取地址 | 用途 |
|------|----------|------|
| Neon (PostgreSQL) | https://neon.tech | 免费托管数据库 |
| Supabase | https://supabase.com | 免费托管数据库 |
| Mapbox | https://mapbox.com | 地图功能 |
| 腾讯云 COS | https://cloud.tencent.com | 图片存储/CDN |

---

## 🎨 自定义配置

**编辑 `src/site.config.ts`** — 所有品牌信息集中于此：

```typescript
export const siteConfig = {
  name: "Your Name",           // 姓名
  tagline: "Photo",             // 标语
  role: "Photographer",         // 职业
  bio: "Your bio here...",     // 个人简介
  avatar: "/avatar.jpg",       // 头像（放于 public/）
  initials: "YN",              // 头像备用文字
  socialLinks: [               // 社交链接
    { title: "Instagram", href: "https://instagram.com/..." },
    { title: "GitHub", href: "https://github.com/..." },
  ],
}
```

---

## 📂 照片管理

1. 将照片放入 `public/photos/` 目录
2. 或使用后台管理：访问 `/admin` 扫描照片目录
3. 支持 EXIF 数据读取、自动生成缩略图
4. 可创建精选集（Collections）分组展示

---

## 🎵 音乐播放器

音乐播放器集成于摄影网站，提供沉浸式体验：

- **Shader 背景**：GPU 加速的 GLSL 着色器动画
- **ColorThief**：从专辑封面提取主色调，驱动动画色彩
- **歌词解析**：支持 TTML/LRC 格式，逐字时间轴
- **搜索来源**：网易云音乐 API

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Space` | 播放 / 暂停 |
| `←` `→` | 上 / 下一首 |
| `Shift+N` | 收藏当前歌曲 |
| `L` | 切换歌词面板 |
| `Esc` | 退出播放器 |

---

## 🐳 Docker 部署详解

### 文件说明

| 文件 | 用途 |
|------|------|
| `Dockerfile` | 多阶段构建，生产镜像 |
| `docker-compose.yml` | 开发/演示配置（SQLite） |
| `docker-compose.cloud.yml` | 云端生产配置（PostgreSQL） |
| `docker-compose.standalone.yml` | 完全独立部署 |

### 生产环境建议

- 使用 PostgreSQL 而非 SQLite（`docker-compose.cloud.yml`）
- 配置 Nginx 反向代理 + SSL
- 使用腾讯云 COS 作为存储后端
- 启用 CDN 加速静态资源

---

## 📜 许可证

[MIT License](LICENSE) — 可自由使用、修改和分发。

---

## 🙏 致谢

- [Next.js](https://nextjs.org/) — React 全栈框架
- [shadcn/ui](https://ui.shadcn.com/) — 精美 UI 组件库
- [Three.js](https://threejs.org/) — 3D 图形库
- [ColorThief](https://github.com/lokesh/color-thief) — 色彩提取
- [网易云音乐 API](https://github.com/Binaryify/NeteaseCloudMusicApi) — 音乐数据

---

*Built with ❤️ by [Fangcbb](https://github.com/Fangcbb)*
