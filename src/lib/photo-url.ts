/**
 * 图片代理 URL（对外展示用）
 *
 * /api/photo/{photoId}?v=display → COS 原图 + /fangb
 * /api/photo/{photoId}?v=fangb   → COS 缩略图
 *
 * 用途：页面 <img> src、og:image 等用户可见的图片地址
 * 不用于：JSON-LD 结构化数据（百度需要真实 COS 地址）
 */
export function photoProxyUrl(photoId: string, variant?: string): string {
  const params = variant ? `?v=${variant}` : "";
  return `/api/photo/${photoId}${params}`;
}

/**
 * 生成图片展示 URL（完整 COS 地址）
 * 仅用于 JSON-LD 结构化数据和百度 SEO
 */
export function photoDisplayUrl(url: string): string {
  const BASE_URL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || "";
  const encodedKey = url
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${BASE_URL}/${encodedKey}/fangb`;
}
