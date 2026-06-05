const BASE_URL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || "";

/**
 * 将 COS key 转换为完整 URL
 * @param key - COS 文件 key（如 "photos/xxx-IMG_5359.jpg"）
 * @param suffix - 可选后缀（如 "fangb"）
 * @returns 完整 URL，自动处理特殊字符编码
 */
export const keyToUrl = (key: string | undefined | null, suffix?: string) => {
  if (!key) {
    return "";
  }

  // 对 key 中的每个路径段单独编码（保留 / 分隔符）
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  if (suffix) {
    return `${BASE_URL}/${encodedKey}/${suffix}`;
  }

  return `${BASE_URL}/${encodedKey}`;
};
