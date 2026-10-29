import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { s3Client } from "@/modules/s3/lib/server-client";

/** 腾讯万象对处理源文件有 32MB 上限，超过会导致 display/thumb 变体生成失败。
 *  上传侧保险：图片超过该阈值时在上传通道内压缩后再入库。 */
export const CI_PROCESS_LIMIT = 30 * 1024 * 1024;

export const SHARP_CAPABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

/** 压缩单张图片 buffer：6000 长边 / q85 / 去元数据 */
export async function compressOversizeImage(
  buf: Buffer,
): Promise<{ out: Buffer; width: number; height: number }> {
  const out = await sharp(buf)
    // 按 EXIF 方向自动旋转，避免超大图压缩后横躺或颠倒
    .rotate()
    .resize({ width: 6000, height: 6000, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const meta = await sharp(out).metadata();
  return { out, width: meta.width || 0, height: meta.height || 0 };
}

/** COS 对象下载到内存（仅用于受限大小校验后的对象） */
export async function downloadObject(key: string): Promise<Buffer> {
  const res = await s3Client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}


/** 超限对象压缩后的新 key（原扩展名替换为 .c.jpg） */
export function compressedKey(key: string): string {
  return key.replace(/(\.[^.]+)$/, ".c.jpg");
}

/** 把 COS 上超限的对象替换为压缩后的 .c.jpg，返回新 key */
export async function replaceWithCompressed(key: string): Promise<string> {
  const raw = await downloadObject(key);
  const { out } = await compressOversizeImage(raw);
  const newKey = compressedKey(key);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: newKey,
      ContentType: "image/jpeg",
      Body: out,
      CacheControl: "public, max-age=31536000",
    }),
  );
  await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: key }));
  return newKey;
}
