import { NextRequest, NextResponse } from "next/server";
import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, HeadObjectCommand, ListPartsCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { s3Client } from "@/modules/s3/lib/server-client";
import { getSession } from "@/modules/auth/lib/get-session";
import { log } from "@/lib/logger";
import { UPLOAD_CHUNK_SIZE } from "@/modules/s3/lib/upload-limits";
import { verifyUploadToken, expectedPartSize, UploadValidationError, type UploadSession } from "@/modules/s3/lib/upload-session";

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
    if (await isComplete(upload)) return NextResponse.json({ key, recovered: true });
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
    await log({ level: "info", source: "upload", message: `分片上传完成，共 ${count} 片，耗时 ${Date.now() - started}ms`,
      path: key, code: "MULTIPART_COMPLETE", meta: { parts: count, size: upload.size, elapsed: Date.now() - started },
    });
    return NextResponse.json({ key });
  } catch (error) {
    // COS 合并成功但响应/随后校验瞬时失败，也先检查原对象而不是重传全文件。
    if (upload && !(error instanceof UploadValidationError)) {
      try { if (await isComplete(upload)) return NextResponse.json({ key: upload.key, recovered: true }); } catch { /* 记录原始错误 */ }
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
    await log({ level: "warn", source: "upload", code: "MULTIPART_ABORT_FAILED", message: `取消分片上传失败：${error instanceof Error ? error.message : String(error)}` });
    return NextResponse.json({ error: known ? error.message : "清理未完成分片失败" }, { status: known ? error.status : 500 });
  }
}
