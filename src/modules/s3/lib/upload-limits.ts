import { IMAGE_SIZE_LIMIT } from "@/constants";

/**
 * 上传类型 / 大小限制（服务端权威定义）。
 *
 * 抽成独立模块是因为现在有两条上传通道共用同一套规则：
 * - `/api/upload`（单请求整体代理上传）
 * - `/api/upload/multipart/*`（分片上传，默认通道）
 * 规则散落在两处必然漂移，所以集中在这里。
 */

export const ALLOWED_IMAGE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
]);

export const ALLOWED_VIDEO = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
]);

export const ALLOWED_AUDIO = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/x-m4a",
  "audio/m4a",
]);

export const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
export const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB

/** 分片大小：4MB。COS 要求除最后一片外每片 >= 1MB，4MB 在弱网下单片耗时可控。 */
export const UPLOAD_CHUNK_SIZE = 4 * 1024 * 1024;

export type UploadKind = "image" | "video" | "audio";

export function classifyContentType(contentType: string): UploadKind | null {
  if (ALLOWED_IMAGE.has(contentType)) return "image";
  if (ALLOWED_VIDEO.has(contentType)) return "video";
  if (ALLOWED_AUDIO.has(contentType)) return "audio";
  return null;
}

export function sizeLimitFor(kind: UploadKind): number {
  if (kind === "image") return IMAGE_SIZE_LIMIT;
  if (kind === "video") return MAX_VIDEO_SIZE;
  return MAX_AUDIO_SIZE;
}

/** 只允许往这些前缀下写，防止构造 key 覆盖站点其他对象 */
export const ALLOWED_FOLDER_PATTERN = /^[a-z0-9][a-z0-9-]{0,40}$/i;

export function normalizeFolder(folder: string | null | undefined): string {
  const f = (folder || "photos").trim();
  return ALLOWED_FOLDER_PATTERN.test(f) ? f : "photos";
}

export function buildObjectKey(folder: string, filename: string): string {
  const uuid = crypto.randomUUID();
  // 扩展名统一小写，腾讯云 CI 的命名样式依赖小写后缀
  const safeFilename = filename
    .replace(/[\\/:*?"<>|\s]+/g, "_")
    .replace(/(\.[^.]+)$/, (ext) => ext.toLowerCase())
    .slice(-120);
  return `${normalizeFolder(folder)}/${uuid}-${safeFilename}`;
}
