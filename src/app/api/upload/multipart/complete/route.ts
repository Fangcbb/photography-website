import { NextRequest, NextResponse } from "next/server";
import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, HeadObjectCommand, ListPartsCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { s3Client } from "@/modules/s3/lib/server-client";
import { getSession } from "@/modules/auth/lib/get-session";
import { log } from "@/lib/logger";
import { UPLOAD_CHUNK_SIZE } from "@/modules/s3/lib/upload-limits";
import { verifyUploadToken, expectedPartSize, UploadValidationError, type UploadSession } from "@/modules/s3/lib/upload-session";
import { CI_PROCESS_LIMIT, SHARP_CAPABLE, replaceWithCompressed, compressedKey } from "@/modules/s3/lib/compress-oversize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  key: z.string().min(1).max(512), uploadId: z.string().min(1).max(256),
  parts: z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string().min(1).max(256) })).min(1).max(125),
});

async function isComplete(upload: UploadSession): Promise<boolean> {
  try {
    const h = await s3Client.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: upload.key }));
    return h.ContentLength === upload.size;
  } catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
    throw error;
  }
}

// 大图压缩后原 key 已被删除并替换为 .c.jpg；重试时据此识别已存在的终态对象
async function recoverCompressed(upload: UploadSession): Promise<string | null> {
  try {
    const candidate = compressedKey(upload.key);
    const h = await s3Client.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: candidate }));
    return h.ContentLength !== undefined ? candidate : null;
  } catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

async function resolveExistingObject(upload: UploadSession): Promise<string | null> {
  if (await isComplete(upload)) return upload.key;
  return recoverCompressed(upload);
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  let upload: UploadSession | undefined;
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "请先登录后再上传" }, { status: 401 });
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new UploadValidationError("合并参数不合法");
    const { key, uploadId, parts } = parsed.data;
    upload = verifyUploadToken(request.headers.get("x-upload-token"), session.user.id, key, uploadId);
    const count = Math.ceil(upload.size / UPLOAD_CHUNK_SIZE);
    const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    if (sorted.length !== count || sorted.some((p, i) => p.partNumber !== i + 1)) {
      throw new UploadValidationError("分片列表不完整或有重复序号");
    }
    // 响应丢失后重试同一请求：已存在且大小一致则直接确认，避免生成重复对象。
    const existing = await resolveExistingObject(upload);
    if (existing) return NextResponse.json({ key: existing, recovered: true });
    const listed = await s3Client.send(new ListPartsCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key, UploadId: uploadId, MaxParts: 125 }));
    const remote = listed.Parts || [];
    if (listed.IsTruncated || remote.length !== count || remote.some((p, i) =>
      p.PartNumber !== sorted[i].partNumber || p.ETag !== sorted[i].etag || p.Size !== expectedPartSize(upload!, sorted[i].partNumber))) {
      throw new UploadValidationError("COS 分片不完整，请重新上传");
    }
    await s3Client.send(new CompleteMultipartUploadCommand({
      Bucket: process.env.S3_BUCKET_NAME, Key: key, UploadId: uploadId,
      MultipartUpload: { Parts: sorted.map(p => ({ PartNumber: p.partNumber, ETag: p.etag })) },
    }));
    if (!(await isComplete(upload))) throw new Error("合并后文件大小校验未通过");

    // 大图保险：合并后超过万象 32MB 处理上限的照片，压缩并替换对象（6000 长边 / q85）
    let finalKey = key;
    const ext = key.toLowerCase().match(/\.(jpe?g|png|webp)$/);
    const sharpCapable = !!ext;
    if (upload.size > CI_PROCESS_LIMIT && (sharpCapable || SHARP_CAPABLE.size === 0)) {
      finalKey = await replaceWithCompressed(key);
      await log({
        level: "info", source: "upload", path: finalKey, code: "OVERSIZE_COMPRESSED",
        message: `大图自动压缩 ${(upload.size / 1048576).toFixed(1)}MB`,
        meta: { originalKey: key, originalSize: upload.size },
      });
    }

    await log({ level: "info", source: "upload", message: `分片上传完成，共 ${count} 片，耗时 ${Date.now() - started}ms`,
      path: finalKey, code: "MULTIPART_COMPLETE", meta: { parts: count, size: upload.size, elapsed: Date.now() - started },
    });
    return NextResponse.json({ key: finalKey });
  } catch (error) {
    // COS 合并成功但响应/随后校验瞬时失败，也先检查原对象而不是重传全文件。
    if (upload && !(error instanceof UploadValidationError)) {
      try {
        const recovered = await resolveExistingObject(upload);
        if (recovered) return NextResponse.json({ key: recovered, recovered: true });
      } catch { /* 记录原始错误 */ }
    }
    const known = error instanceof UploadValidationError;
    await log({ level: known ? "warn" : "error", source: "upload", path: upload?.key,
      message: `分片合并失败：${error instanceof Error ? error.message : String(error)}`, code: "MULTIPART_COMPLETE_FAILED" });
    return NextResponse.json({ error: known ? error.message : "合并文件失败，请重试" }, { status: known ? error.status : 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    const key = request.nextUrl.searchParams.get("key") || "";
    const uploadId = request.nextUrl.searchParams.get("uploadId") || "";
    verifyUploadToken(request.headers.get("x-upload-token"), session.user.id, key, uploadId);
    try {
      await s3Client.send(new AbortMultipartUploadCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key, UploadId: uploadId }));
    } catch (error) {
      if ((error as { name?: string }).name !== "NoSuchUpload") throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const known = error instanceof UploadValidationError;
    await log({ level: known ? "warn" : "error", source: "upload", code: "MULTIPART_ABORT_FAILED", message: `取消分片上传失败：${error instanceof Error ? error.message : String(error)}` });
    return NextResponse.json({ error: known ? error.message : "清理未完成分片失败" }, { status: known ? error.status : 500 });
  }
}
