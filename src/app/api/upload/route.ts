import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { s3Client } from "@/modules/s3/lib/server-client";
import { getSession } from "@/modules/auth/lib/get-session";
import { log } from "@/lib/logger";
import { IMAGE_SIZE_LIMIT } from "@/constants";
import { CI_PROCESS_LIMIT, SHARP_CAPABLE, compressOversizeImage } from "@/modules/s3/lib/compress-oversize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 大文件上传可能超过默认函数超时（部署在 Node 长驻进程时无影响，保留以防平台限制）
export const maxDuration = 300;

/**
 * 同源代理上传（直传 COS 失败时的兜底通道）。
 *
 * 为什么需要它：浏览器直传走 `fangyy-*.cos.ap-nanjing.myqcloud.com`，
 * 属于跨域请求。实测在干净环境下正常，但用户侧可能因为
 * 广告拦截扩展、企业代理、DNS 污染、旧浏览器 CORS 实现等原因失败，
 * 表现为 XHR 的 `onerror`（浏览器不暴露具体原因，只说"网络中断"）。
 *
 * 本路由让文件先 POST 到自己的域名（完全同源，无 CORS），
 * 再由服务器流式转发到 COS。代价是占用服务器出网带宽，
 * 因此只在直传失败时降级使用。
 *
 * 协议：直接把文件二进制作为 body POST 过来（不用 multipart，避免整包缓冲）
 *   POST /api/upload?filename=xxx.jpg&folder=photos
 *   Content-Type: image/jpeg
 *   Content-Length: 文件字节数
 */

const ALLOWED_IMAGE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
]);

const ALLOWED_VIDEO = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
]);

const ALLOWED_AUDIO = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/x-m4a",
  "audio/m4a",
]);

const MAX_VIDEO = 500 * 1024 * 1024;
const MAX_AUDIO = 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const started = Date.now();
  const { searchParams } = request.nextUrl;
  const filename = searchParams.get("filename");
  const folder = searchParams.get("folder") || "photos";
  const contentType = request.headers.get("content-type") || "";
  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = Number(contentLengthHeader || 0);

  try {
    if (contentLengthHeader === null || contentLengthHeader === "") {
      return NextResponse.json(
        { error: "Length Required" },
        { status: 411 }
      );
    }

    // 必须登录 —— 否则等于开放了一个匿名写入 COS 的接口
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "请先登录后再上传" }, { status: 401 });
    }

    if (!filename) {
      return NextResponse.json({ error: "缺少 filename 参数" }, { status: 400 });
    }
    if (!request.body) {
      return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    }

    const isImage = ALLOWED_IMAGE.has(contentType);
    const isVideo = ALLOWED_VIDEO.has(contentType);
    const isAudio = ALLOWED_AUDIO.has(contentType);

    if (!isImage && !isVideo && !isAudio) {
      return NextResponse.json(
        { error: `不支持的文件类型：${contentType || "未知"}` },
        { status: 400 }
      );
    }

    const limit = isImage ? IMAGE_SIZE_LIMIT : isVideo ? MAX_VIDEO : MAX_AUDIO;
    if (contentLength > limit) {
      return NextResponse.json(
        { error: `文件 ${(contentLength / 1024 / 1024).toFixed(1)}MB 超过 ${limit / 1024 / 1024}MB 上限` },
        { status: 413 }
      );
    }

    const uuid = crypto.randomUUID();
    const safeFilename = filename.replace(/(\.[^.]+)$/, (ext) => ext.toLowerCase());
    let key = `${folder}/${uuid}-${safeFilename}`;
    let uploadContentType = contentType;
    let uploadLength = contentLength;

    // 大图保险：超过万象 32MB 处理上限的照片，先压缩再入库（6000 长边 / q85）
    let body: Readable | Buffer;
    if (isImage && contentLength > CI_PROCESS_LIMIT && SHARP_CAPABLE.has(contentType)) {
      const raw = Buffer.from(await request.arrayBuffer());
      const { out } = await compressOversizeImage(raw);
      key = key.replace(/(\.[^.]+)$/, ".c.jpg");
      uploadContentType = "image/jpeg";
      uploadLength = out.length;
      body = out;
      void log({
        level: "info",
        source: "upload",
        path: key,
        code: "OVERSIZE_COMPRESSED",
        message: `大图自动压缩 ${(contentLength / 1048576).toFixed(1)}MB -> ${(out.length / 1048576).toFixed(1)}MB`,
        meta: { contentType, originalSize: contentLength, compressedSize: out.length },
      });
    } else {
      // 流式转发，避免把大文件整个读进内存
      body = Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]);
    }

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        ContentType: uploadContentType,
        Body: body,
        // 流式上传必须声明长度，否则 SDK 无法确定分块
        ContentLength: uploadLength || undefined,
        CacheControl: "public, max-age=31536000",
      })
    );

    void log({
      level: "info",
      source: "upload",
      message: `代理上传成功 ${(uploadLength / 1024 / 1024).toFixed(2)}MB，耗时 ${Date.now() - started}ms`,
      path: key,
      code: "OK",
      meta: { contentType, size: uploadLength, via: "proxy" },
    });

    return NextResponse.json({ key });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    void log({
      level: "error",
      source: "upload",
      message: `代理上传失败：${message}`,
      path: filename || "(unknown)",
      code: "PROXY_UPLOAD_FAILED",
      stack: error instanceof Error ? error.stack?.slice(0, 4000) : undefined,
      meta: { contentType, size: contentLength, folder, elapsed: Date.now() - started },
    });

    return NextResponse.json({ error: "上传失败，请稍后重试" }, { status: 500 });
  }
}
