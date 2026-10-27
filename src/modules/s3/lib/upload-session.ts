import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { UPLOAD_CHUNK_SIZE } from "./upload-limits";

const schema = z.object({
  userId: z.string().min(1),
  key: z.string().min(1).max(512),
  uploadId: z.string().min(1).max(256),
  size: z.number().int().positive(),
  expires: z.number().int(),
});
export type UploadSession = z.infer<typeof schema>;

export class UploadValidationError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function signature(payload: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Upload signing secret is not configured");
  return createHmac("sha256", secret).update(`multipart:${payload}`).digest();
}

/** 无进程内状态，跨 PM2 worker 生效；凭证仅放请求头，不进入访问日志。 */
export function createUploadToken(input: Omit<UploadSession, "expires">): string {
  const payload = Buffer.from(JSON.stringify({ ...input, expires: Date.now() + 2 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function verifyUploadToken(token: string | null, userId: string, key: string, uploadId: string): UploadSession {
  if (!token || token.length > 4096) throw new UploadValidationError("缺少上传凭证，请重新选择文件", 403);
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra) throw new UploadValidationError("上传凭证无效", 403);
  const actual = Buffer.from(mac, "base64url");
  const expected = signature(payload);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new UploadValidationError("上传凭证无效", 403);
  }
  let parsed: UploadSession;
  try {
    parsed = schema.parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
  } catch {
    throw new UploadValidationError("上传凭证格式无效", 403);
  }
  if (parsed.userId !== userId || parsed.key !== key || parsed.uploadId !== uploadId || parsed.expires < Date.now()) {
    throw new UploadValidationError("上传凭证已失效或与当前文件不匹配", 403);
  }
  return parsed;
}

export function expectedPartSize(upload: UploadSession, partNumber: number): number {
  const count = Math.ceil(upload.size / UPLOAD_CHUNK_SIZE);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > count) {
    throw new UploadValidationError("分片序号不合法");
  }
  return Math.min(UPLOAD_CHUNK_SIZE, upload.size - (partNumber - 1) * UPLOAD_CHUNK_SIZE);
}

/** 每次仅缓冲一个有严格上限的分片；不依赖代理是否保留 Content-Length。 */
export async function readExactPart(body: ReadableStream<Uint8Array> | null, expected: number): Promise<Buffer> {
  if (!body) throw new UploadValidationError("分片内容为空");
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > expected) {
        await reader.cancel();
        throw new UploadValidationError("分片大小超过声明值", 413);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (size !== expected) throw new UploadValidationError("分片不完整，请重新上传该分片");
  return Buffer.concat(chunks, size);
}
