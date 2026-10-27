import { S3Client } from "@aws-sdk/client-s3";

/**
 * 服务端 S3/COS 客户端，用于生成预签名 URL 与删除对象。
 *
 * 关键配置说明：
 *
 * 1. `region: "ap-nanjing"` —— 腾讯云 COS 不是 AWS，必须用真实地域。
 *    之前写成 `"auto"`（Cloudflare R2 的写法）会让签名 scope 变成
 *    `/auto/s3/aws4_request`，COS 虽能容忍，但不符合规范、易在边缘场景失败。
 *
 * 2. `requestChecksumCalculation: "WHEN_REQUIRED"` —— AWS SDK v3 较新版本
 *    默认会给 PutObject 预计算 CRC32 并写进预签名 URL
 *    （`x-amz-checksum-crc32` / `x-amz-sdk-checksum-algorithm`）。
 *    但签名时并没有真实文件内容，算出来的是空 body 的校验值，
 *    浏览器上传真实文件后该校验值必然不匹配。COS 多数情况下忽略该参数，
 *    但一旦某个节点严格校验就会返回 400 —— 而在浏览器里表现为
 *    「上传时网络出错」（错误响应若无 CORS 头，XHR 只能拿到 onerror）。
 *    这里显式关闭，只在接口强制要求时才计算。
 */
export const s3Client = new S3Client({
  region: "ap-nanjing",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
