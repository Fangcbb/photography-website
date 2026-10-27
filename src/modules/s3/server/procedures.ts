import { s3Client } from "@/modules/s3/lib/server-client";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { IMAGE_SIZE_LIMIT } from "@/constants";

const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
] as const;

const ALLOWED_VIDEO_CONTENT_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
] as const;

const ALLOWED_AUDIO_CONTENT_TYPES = [
  "audio/mpeg",       // MP3
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/x-m4a",
  "audio/m4a",
] as const;

const VIDEO_SIZE_LIMIT = 500 * 1024 * 1024; // 500MB
const AUDIO_SIZE_LIMIT = 100 * 1024 * 1024; // 100MB

/**
 * 预签名 URL 有效期。
 *
 * 原值 6 分钟对大文件偏紧：一张 20MB 的图在 2Mbps 上行带宽下需要 80 秒，
 * 叠加慢网/弱网抖动很容易在传输途中过期，表现为「上传时网络出错」。
 * 放宽到 15 分钟，与前端 XHR 的 5 分钟超时配合使用。
 */
const PRESIGNED_URL_TTL_SECONDS = 60 * 15;

export const s3Router = createTRPCRouter({
  createPresignedUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.enum([...ALLOWED_IMAGE_CONTENT_TYPES, ...ALLOWED_VIDEO_CONTENT_TYPES, ...ALLOWED_AUDIO_CONTENT_TYPES] as const),
        size: z.number().positive().max(VIDEO_SIZE_LIMIT),
        folder: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const { filename, contentType, size, folder } = input;

        // 按类型做服务端大小兜底校验（客户端已校验，这里防止绕过）
        if (
          (ALLOWED_IMAGE_CONTENT_TYPES as readonly string[]).includes(contentType) &&
          size > IMAGE_SIZE_LIMIT
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `图片不能超过 ${IMAGE_SIZE_LIMIT / 1024 / 1024}MB（当前 ${(size / 1024 / 1024).toFixed(1)}MB）`,
          });
        }
        if (
          (ALLOWED_AUDIO_CONTENT_TYPES as readonly string[]).includes(contentType) &&
          size > AUDIO_SIZE_LIMIT
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `音频不能超过 100MB（当前 ${(size / 1024 / 1024).toFixed(1)}MB）`,
          });
        }

        const uuid = crypto.randomUUID();
        // Lowercase the extension so /fangb (Tencent CI) can process it
        const safeFilename = filename.replace(/(\.[^.]+)$/, (ext) => ext.toLowerCase());
        const key = folder
          ? `${folder}/${uuid}-${safeFilename}`
          : `${uuid}-${safeFilename}`;

        /**
         * 注意：这里刻意**不传 ContentLength**。
         *
         * 一旦把长度写进签名，浏览器实际上传的字节数必须与签名时声明的完全一致，
         * 否则 COS 返回 403 SignatureDoesNotMatch。任何细微差异（文件在签名后
         * 被重新编码、File 对象被包装、Live Photo 拆分成两个 File 等）都会导致
         * 上传失败。大小限制已在上面按类型校验，无需依赖签名绑定长度。
         */
        const command = new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: key,
          ContentType: contentType,
        });

        const presignedUrl = await getSignedUrl(s3Client, command, {
          expiresIn: PRESIGNED_URL_TTL_SECONDS,
        });

        return {
          presignedUrl,
          key,
          expiresIn: PRESIGNED_URL_TTL_SECONDS,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof Error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "生成上传地址失败",
        });
      }
    }),
  deleteFile: protectedProcedure
    .input(
      z.object({
        key: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const { key } = input;
        const command = new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: key,
        });
        await s3Client.send(command);
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "文件删除失败",
        });
      }
    }),
});
