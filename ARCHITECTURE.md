# Architecture Documentation

## 系统全景

fangc.cc 是一个**摄影作品集 + 沉浸式音乐播放器**的个人网站，采用 Next.js App Router 全栈架构。

```
                    ┌─────────────────────────────────────────┐
                    │              Vercel / VPS               │
                    │                                         │
  ┌──────────────┐  │  ┌─────────────┐    ┌──────────────┐   │
  │   User       │──┼─▶│  Next.js    │───▶│  PostgreSQL  │   │
  │   Browser    │  │  │  App Router │    │  (Neon/Supa) │   │
  └──────────────┘  │  └──────┬──────┘    └──────────────┘   │
                    │         │                                │
                    │         │  ┌──────────────┐              │
                    │         ├─▶│  S3 Storage  │              │
                    │         │  │ (COS / R2 /S3)│             │
                    │         │  └──────────────┘              │
                    │         │                                │
                    │         │  ┌──────────────┐              │
                    │         └─▶│  Mapbox      │              │
                    │            │  Maps API    │              │
                    │            └──────────────┘              │
                    └─────────────────────────────────────────┘
```

---

## 前端架构

### 路由结构

```
src/app/
├── (home)/              # 首页（瀑布流照片墙）
│   └── page.tsx
├── (photograph)/        # 照片库
│   ├── page.tsx         # 照片网格
│   └── map/             # 地图视图
├── (dashboard)/         # 后台管理
│   └── (auth)/          # 认证页面
│       ├── login/
│       └── logout/
│   └── admin/          # 管理面板
│       ├── photos/     # 照片管理
│       ├── collections/# 精选集
│       └── settings/   # 站点设置
├── api/                 # API 路由
│   ├── music-search/   # 音乐搜索代理
│   ├── trpc/           # tRPC 端点
│   └── auth/           # 认证 API
└── music/              # 音乐播放器页面
    └── page.tsx
```

### 状态管理

```
┌─────────────────────────────────────────────────────────┐
│                    React Context                         │
├─────────────────────────────────────────────────────────┤
│  ThemeContext     — 主题（明/暗）                         │
│  PlayerContext    — 播放器全局状态（当前歌曲、播放列表）    │
├─────────────────────────────────────────────────────────┤
│                    Zustand Stores                         │
├─────────────────────────────────────────────────────────┤
│  useLibraryStore  — 收藏夹、播放历史                      │
│  useSettingsStore — 用户设置                             │
├─────────────────────────────────────────────────────────┤
│                 TanStack Query (Server State)            │
├─────────────────────────────────────────────────────────┤
│  usePhotos()       — 照片列表 + 分页                      │
│  useCollections()  — 精选集                              │
│  useMapPhotos()    — 地图照片                            │
└─────────────────────────────────────────────────────────┘
```

### 关键组件关系

```
App
├── Header (导航栏)
│   ├── Logo
│   └── NavMenu
├── PhotoGrid (照片墙)
│   ├── MasonryLayout
│   ├── GridLayout
│   └── PhotoCard
│       └── Blurhash (占位图)
└── MusicPlayer (全局浮层)
    ├── MiniBar (底部迷你条)
    └── ExpandedView (展开视图)
        ├── AlbumCover (封面)
        ├── AuraShaderBackground (Shader背景)
        ├── PlaybackControls (播放控制)
        ├── ProgressBar (进度条)
        ├── LyricsView (歌词面板)
        └── SearchModal (搜索浮层)
```

---

## 后端架构

### API 层

```
API Routes (Next.js App Router)
│
├── POST /api/auth/[...all]     # Better Auth 认证
│
├── GET  /api/music-search      # 音乐搜索代理
│   │   ?engine=netease&keyword=周杰伦
│   └── Proxies to 网易云音乐 API
│
├── GET  /api/trpc.*            # tRPC 端点
│   │
│   └── photos.*
│       ├── list       — 照片列表
│       ├── getById    — 照片详情
│       ├── collections.list
│       └── map.list   — 地图照片
│
└── Internal API (Server-side only)
    ├── /api/upload  — 上传图片
    └── /api/photos/scan — 扫描照片目录
```

### tRPC 路由

```typescript
// src/server/api/routers/
root.ts
├── photos
│   ├── list      — 分页获取照片
│   ├── get       — 按 ID 获取照片
│   ├── create    — 创建照片记录
│   ├── update    — 更新照片信息
│   └── delete    — 删除照片
├── collections
│   ├── list
│   ├── get
│   ├── create
│   ├── addPhotos
│   └── removePhotos
├── layout
│   ├── get  — 获取当前布局配置
│   └── update
└── music
    ├── config.get
    └── config.update
```

### 数据库 Schema (Drizzle ORM)

```
photos
├── id          UUID (PK)
├── filename    VARCHAR
├── path        VARCHAR
├── blurhash    VARCHAR
├── width       INT
├── height      INT
├── exif        JSONB
├── location    JSONB { lat, lng, name }
├── takenAt     TIMESTAMP
├── createdAt   TIMESTAMP
└── collections photo_collections (M2M)

collections
├── id          UUID (PK)
├── name        VARCHAR
├── slug        VARCHAR (UNIQUE)
├── coverPhoto  UUID (FK → photos)
├── order       INT
├── createdAt   TIMESTAMP
└── photos      photos (M2M)

layout_config
├── id          INT (PK, always 1)
├── layout      VARCHAR { classic, masonry, ... }
├── columns     INT
├── gap         INT
└── updatedAt   TIMESTAMP

music_config
├── id          INT (PK, always 1)
├── mode        VARCHAR { radio, local }
├── radioStations JSON
└── updatedAt   TIMESTAMP
```

---

## 音乐播放器深度解析

### AuraMusic 架构

```
AuraMusic (主容器)
├── usePlayer (播放状态 Hook)
│   ├── currentTrack    — 当前歌曲
│   ├── queue           — 播放队列
│   ├── isPlaying       — 播放状态
│   ├── progress        — 播放进度
│   └── audioRef        — Audio 元素引用
│
├── useNeteaseSearchProvider (搜索)
│   ├── search()
│   ├── results
│   └── selectedEngine
│
├── libraryStore (收藏/历史)
│   ├── favorites
│   ├── history
│   └── likedSongs
│
└── PlayerUI
    ├── AlbumCover (旋转黑胶唱片)
    ├── AuraShaderBackground (Shader 背景)
    ├── PlaybackControls (播放/暂停/上一/下一)
    ├── ProgressBar (可拖拽进度条)
    ├── VolumeControl (音量控制)
    ├── LyricsView (歌词展示)
    └── SearchModal (搜索入口)
```

### Shader 背景工作原理

```
┌─────────────────────────────────────────────────────────┐
│              AuraShaderBackground (Three.js)            │
├─────────────────────────────────────────────────────────┤
│  Scene                                                  │
│  ├── OrthographicCamera (-1,1,1,-1,0,1)                │
│  ├── PlaneGeometry (2,2)                                │
│  └── ShaderMaterial                                     │
│       ├── uniforms:                                     │
│       │   ├── uTime: float (时间驱动动画)                │
│       │   ├── uColors[8]: vec3 (ColorThief提取的8色)   │
│       │   └── uAudioLevel: float (音频电平)            │
│       └── vertexShader + fragmentShader                │
│                                                         │
│  ColorThief (每首新歌触发)                               │
│  └── 提取专辑封面主色调 → 更新 uColors                  │
│                                                         │
│  AudioLevelBridge (音频分析)                             │
│  └── AnalyserNode → uAudioLevel → 控制动画幅度         │
└─────────────────────────────────────────────────────────┘
```

### GLSL 着色器核心逻辑

```glsl
// fragmentShader 伪代码
vec3 getGradient(float t) {
  int idx = int(t * 8.0);  // 8 色渐变
  return mix(uColors[idx], uColors[idx+1], fract(t*8.0));
}

void main() {
  vec2 uv = vUv;
  
  // 基础扭曲
  float wave = sin(uv.y * freq + uTime * speed) * amplitude/100;
  uv.x += wave;
  
  // 旋转（基于播放进度 degree）
  float angle = (degree - 0.5) * rotationSpeed;
  uv = rotate(uv, angle);
  
  // 取颜色
  float t = uv.y + noise(uv * 3.0);
  vec3 color = getGradient(clamp(t, 0.0, 0.999));
  
  // 暗角
  float vignette = smoothstep(0.8, 0.2, length(uv - 0.5));
  color *= mix(1.0, vignette, 0.15);
  
  gl_FragColor = vec4(color, 1.0);
}
```

### 歌词解析流程

```
网易云音乐 API
       │
       ▼
lyricsService.ts
├── fetchLyrics(songId)
│   ├── /lyric?pid={songId}
│   └── 返回 { lyric, tlyric } (原文 + 翻译)
│
├── lyrics/parser.ts
│   ├── parseTTML()   — TTML 格式
│   ├── parseLRC()    — LRC 格式
│   └── mergeLines()  — 原文 + 翻译合并
│
└── LyricsTimeline
    ├── lines: Array<{ time, text, trans? }>
    └── getCurrentLine(time) — 二分查找当前行
```

---

## 部署架构

### 生产环境拓扑

```
                          ┌──────────────────┐
                          │     CDN          │
                          │ (腾讯云 CDN)      │
                          └────────┬─────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                              │
            ┌───────▼────────┐          ┌────────▼────────┐
            │   Static Files │          │   Next.js App   │
            │   (COS/OSS)    │          │   (Vercel/VPS)  │
            └────────────────┘          └────────┬────────┘
                                               │
                              ┌────────────────┼────────────────┐
                              │                │                │
                      ┌───────▼──────┐ ┌───────▼──────┐ ┌──────▼──────┐
                      │  PostgreSQL  │ │   COS Bucket  │ │   Mapbox    │
                      │  (Neon/Supa) │ │  (图片存储)    │ │  (地图服务) │
                      └──────────────┘ └───────────────┘ └─────────────┘
```

### PM2 进程管理

```
┌─────────────────────────────────────────┐
│  photo (主应用)                          │
│  └── Next.js App Router                 │
│      └── Port 3000                       │
│                                          │
├─────────────────────────────────────────┤
│  fangc-photo-admin (后台管理)            │
│  └── 独立 Express 应用                  │
│      └── Port 3600                       │
│                                          │
├─────────────────────────────────────────┤
│  kugou-api (音乐搜索代理)                │
│  └── 酷狗音乐 API 代理                   │
│      └── Port 3001                       │
└─────────────────────────────────────────┘
```

---

## 安全模型

### 认证流程 (Better Auth)

```
用户登录
    │
    ▼
/api/auth/sign-in/password
    │
    ▼
Better Auth 验证邮箱 + 密码
    │
    ▼
创建 Session (HttpOnly Cookie)
    │
    ▼
Session 存入数据库 (Drizzle)
    │
    ▼
返回 Set-Cookie: session_token=xxx
```

### API 保护

```
┌─────────────┐      ┌──────────────┐      ┌────────────┐
│ 未登录用户   │ ───▶ │  tRPC Middleware │ ──▶ │ 401 Unauthorized │
└─────────────┘      └──────────────┘      └────────────┘

┌─────────────┐      ┌──────────────┐      ┌────────────┐
│ 已登录用户   │ ───▶ │  tRPC Middleware │ ──▶ │ 允许访问     │
└─────────────┘      └──────────────┘      └────────────┘
```

### 音乐搜索 API 安全

```
用户请求 /api/music-search?keyword=xxx
           │
           ▼
    Rate Limiting (IP 限流)
           │
           ▼
    验证 engine 参数白名单
           │
           ▼
    代理到网易云 API (服务端)
           │
           ▼
    清洗返回数据 (移除敏感字段)
           │
           ▼
    返回给前端
```

---

## 性能优化

### 前端性能

| 优化项 | 实现方式 |
|--------|----------|
| 图片懒加载 | Intersection Observer + Blurhash 占位 |
| 字体优化 | `next/font` 自动优化字体加载 |
| 代码分割 | Next.js App Router 自动按路由分割 |
| 动画性能 | GPU 加速（transform/opacity）、React Spring 物理动画 |
| Shader 性能 | Three.js OrthographicCamera + 精简 GLSL |
| 歌词渲染 | Virtual List（仅渲染可见行） |

### 后端性能

| 优化项 | 实现方式 |
|--------|----------|
| 数据库 | PostgreSQL 索引、Drizzle 查询优化 |
| 缓存 | TanStack Query 缓存策略（staleTime/retry） |
| 图片处理 | 腾讯云数据万象（服务端处理） |
| CDN | 静态资源托管 COS + CDN 加速 |

### 构建优化

```javascript
// next.config.ts
{
  images: {
    formats: ['image/avif', 'image/webp'],  // 现代格式优先
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
  experimental: {
    optimizeCss: true,  // Tailwind CSS 优化
  }
}
```

---

## 扩展开发

### 添加新的搜索来源

```typescript
// 1. 在 useNeteaseSearchProvider 中添加 provider
const providers = {
  netease: useNeteaseSearchProvider,
  // 添加新的 provider
  qqmusic: useQQMusicSearchProvider,
};

// 2. 实现搜索函数
async function search(keyword: string, engine: string) {
  const results = await providers[engine]?.(keyword);
  return results;
}

// 3. 更新 API 路由 (route.ts)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const engine = searchParams.get('engine') || 'netease';
  // 代理到对应 API
}
```

### 添加新布局

```typescript
// 1. 在 site.config.ts 中添加布局类型
export type LayoutType = 'classic' | 'masonry' | 'magazine' | 
                         'dense' | 'large' | 'fullscreen';

// 2. 在 PhotoGrid 组件中注册布局
const layouts = {
  masonry: MasonryLayout,
  grid: GridLayout,
  magazine: MagazineLayout,
  // 新布局
  timeline: TimelineLayout,
};
```

### 自定义 Shader 效果

```typescript
// 在 AuraShaderBackground.tsx 中修改 uniforms
const uniforms = {
  uTime: { value: 0 },           // 动画时间
  uColors: { value: colors },   // 8 色渐变
  uAudioLevel: { value: 0 },    // 音频电平
  // 添加新 uniform
  uDistortion: { value: 0.5 },  // 扭曲强度
};

// 修改 fragmentShader 添加新效果
// void main() {
//   float wave = sin(...) * uDistortion;
//   ...
// }
```

---

## 监控与日志

### PM2 日志

```bash
# 查看日志
pm2 logs photo

# 实时监控
pm2 monit

# 查看错误
pm2 logs photo --err
```

### 健康检查

```
GET /api/health
Response: { status: "ok", uptime: 3600 }
```

---

*最后更新: 2026-04-11*
