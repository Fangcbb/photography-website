import { NextRequest, NextResponse } from "next/server";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/modules/s3/lib/server-client";
import { getSession } from "@/modules/auth/lib/get-session";
import { log } from "@/lib/logger";
import { expectedPartSize, readExactPart, verifyUploadToken, UploadValidationError } from "@/modules/s3/lib/upload-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function PUT(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") || "";
  const uploadId = request.nextUrl.searchParams.get("uploadId") || "";
  const partNumber = Number(request.nextUrl.searchParams.get("partNumber"));
  const started = Date.now();
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "请先登录后再上传" }, { status: 401 });
    const upload = verifyUploadToken(request.headers.get("x-upload-token"), session.user.id, key, uploadId);
    const expected = expectedPartSize(upload, partNumber);
    const lengthHeader = request.headers.get("content-length");
    if (lengthHeader !== null && Number(lengthHeader) !== expected) {
      throw new UploadValidationError("分片长度与声明不匹配");
    }
    const body = await readExactPart(request.body, expected);
    const res = await s3Client.send(new UploadPartCommand({
      Bucket: process.env.S3_BUCKET_NAME, Key: key, UploadId: uploadId,
      PartNumber: partNumber, Body: body, ContentLength: body.length,
    }));
    if (!res.ETag) throw new Error("COS 未返回 ETag");
    await log({ level: "info", source: "upload", path: key, code: "MULTIPART_PART",
      message: `分片 #${partNumber} 完成 ${(body.length / 1024 / 1024).toFixed(2)}MB，耗时 ${Date.now() - started}ms`,
      meta: { partNumber, size: body.length, elapsed: Date.now() - started },
    });
    return NextResponse.json({ etag: res.ETag, partNumber });
  } catch (error) {
    const known = error instanceof UploadValidationError;
    await log({ level: known ? "warn" : "error", source: "upload", path: key,
      code: known ? "MULTIPART_INVALID" : "MULTIPART_PART_FAILED",
      message: `分片 #${partNumber} 上传失败：${error instanceof Error ? error.message : String(error)}`,
      meta: { partNumber, elapsed: Date.now() - started },
    });
    return NextResponse.json({ error: known ? error.message : "分片上传失败，请重试" }, { status: known ? error.status : 500 });
  }
}
