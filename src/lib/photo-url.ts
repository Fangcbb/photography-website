/**
 * 图片代理 URL（对外展示用）
 *
 * 变体语义（服务端 /api/photo/v2/[id]/[variant] 内部映射为腾讯云数据万象实时处理参数）：
 *   display → 1920px 宽 / WebP / q82  （首页轮播、照片详情、屏保、地图弹窗）
 *   fangb   → 800px 宽 / WebP / q80   （卡片、缩略图、地图标记）
 *   thumb   → 400px 宽 / WebP / q75   （更小的列表缩略图）
 *   hero    → 2560px 宽 / WebP / q85  （全屏高度封面）
 *   live    → Live Photo 视频，不做图片处理
 *
 * 变体作为路径段而非 query 参数：CDN 配置了参数过滤，query 参数变化不会产生
 * 新的缓存键，只有路径变化才能让旧缓存失效、并让各变体相互隔离。详见
 * lib/photo-proxy-handler.ts。
 *
 * 用途：页面 <img> src、og:image 等用户可见的图片地址
 * 不用于：JSON-LD 结构化数据（百度需要真实 COS 地址，见 photoDisplayUrl）
 */
const PHOTO_PROXY_BASE = "/api/photo/v2";

export function photoProxyUrl(photoId: string, variant?: string): string {
  return variant
    ? `${PHOTO_PROXY_BASE}/${photoId}/${variant}`
    : `${PHOTO_PROXY_BASE}/${photoId}`;
}

/**
 * Live Photo 视频代理 URL
 */
export function livePhotoVideoProxyUrl(photoId: string): string {
  return `${PHOTO_PROXY_BASE}/${photoId}/live`;
}

/**
 * 生成图片展示 URL（完整 COS 地址）
 * 仅用于 JSON-LD 结构化数据和百度 SEO
 *
 * 注意：这里刻意保留 COS 命名样式地址，不做压缩改写——
 * 搜索引擎抓取原图更有利于图片收录与画质判定。
 */
export function photoDisplayUrl(url: string): string {
  const BASE_URL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || "";
  const encodedKey = url
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${BASE_URL}/${encodedKey}/fangb`;
}
