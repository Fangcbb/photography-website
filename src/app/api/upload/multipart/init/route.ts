import { NextRequest, NextResponse } from "next/server";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { s3Client } from "@/modules/s3/lib/server-client";
import { getSession } from "@/modules/auth/lib/get-session";
import { log } from "@/lib/logger";
import { createUploadToken } from "@/modules/s3/lib/upload-session";
import {
  buildObjectKey,
  classifyContentType,
  sizeLimitFor,
} from "@/modules/s3/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 分片上传 —— 第一步：初始化。
 *
 * 已观测：一次整体代理上传在 nginx 留下 499，但 COS 对象随后写入成功。
 * 说明调用方连接先于响应关闭；尚不能仅据此确定浏览器、CDN 或代理谁关闭。
 * 分片缩短单请求处理时间并允许单片重试，降低这类故障的影响。
 */

const bodySchema = z.object({
  filename: z.string().min(1).max(255),
  folder: z.string().max(64).optional(),
  contentType: z.string().min(1).max(128),
  size: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "请先登录后再上传" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "参数不合法" }, { status: 400 });
    }

    const { filename, folder, contentType, size } = parsed.data;

    const kind = classifyContentType(contentType);
    if (!kind) {
      return NextResponse.json(
        { error: `不支持的文件类型：${contentType || "未知"}` },
        { status: 400 },
      );
    }

    const limit = sizeLimitFor(kind);
    if (size > limit) {
      return NextResponse.json(
        {
          error: `文件 ${(size / 1024 / 1024).toFixed(1)}MB 超过 ${limit / 1024 / 1024}MB 上限`,
        },
        { status: 413 },
      );
    }

    const key = buildObjectKey(folder || "photos", filename);

    const res = await s3Client.send(
      new CreateMultipartUploadCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000",
      }),
    );

    if (!res.UploadId) {
      throw new Error("COS 未返回 UploadId");
    }

    void log({
      level: "info",
      source: "upload",
      message: `分片上传初始化 ${(size / 1024 / 1024).toFixed(2)}MB`,
      path: key,
      code: "MULTIPART_INIT",
      meta: { contentType, size, kind, uploadId: res.UploadId },
    });

    const token = createUploadToken({ userId: session.user.id, key, uploadId: res.UploadId, size });
    return NextResponse.json({ key, uploadId: res.UploadId, token });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void log({
      level: "error",
      source: "upload",
      message: `分片上传初始化失败：${message}`,
      code: "MULTIPART_INIT_FAILED",
      stack: error instanceof Error ? error.stack?.slice(0, 4000) : undefined,
    });
    return NextResponse.json({ error: "初始化上传失败，请重试" }, { status: 500 });
  }
}
