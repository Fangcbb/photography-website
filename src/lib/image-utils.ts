/**
 * 腾讯云数据万象（CI）图片处理
 * 
 * 自定义样式：fangb
 * 使用方式：图片URL/fangb
 */

/**
 * 获取带图片处理参数的 URL
 * @param url 原始图片 URL
 * @param style 自定义样式名称，默认 "fangb"
 * @returns 带处理参数的 URL
 */
export function getImageUrl(
  url: string | undefined | null,
  style: string = "fangb"
): string {
  if (!url) return "";
  
  // 检查是否是 COS URL（包含 cnn.fangc.cc 或 cos 域名）
  const isCOSUrl = 
    url.includes("cnn.fangc.cc") || 
    url.includes("cdn.fangc.cc") || 
    url.includes("fangyy-1255949132") ||
    url.includes("fangc-1255949132") ||
    url.includes("cos.ap-shanghai.myqcloud.com") ||
    url.includes("cos.ap-nanjing.myqcloud.com");

  // 如果不是 COS URL，直接返回原 URL
  if (!isCOSUrl) return url;

  // 使用 / 分隔符添加自定义样式
  return `${url}/${style}`;
}

/**
 * 获取音乐封面图片 URL
 */
export function getMusicCoverUrl(url: string | undefined | null): string {
  return getImageUrl(url, "fangb");
}

/**
 * 获取背景图片 URL
 */
export function getBackgroundUrl(url: string | undefined | null): string {
  return getImageUrl(url, "fangb");
}
