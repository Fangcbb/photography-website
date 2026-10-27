/**
 * 照片存储健康检查
 *
 * 背景：COS 上曾出现「数据库有记录、源文件已丢失」的情况——页面表现为
 * 图片一直停留在 blurhash 模糊色块。本脚本用于定期体检。
 *
 * 用法：
 *   npx tsx scripts/audit-photos.ts            # 只检查，输出报告
 *   npx tsx scripts/audit-photos.ts --fix      # 尝试用 COS 孤儿文件回填缺失项
 *
 * --fix 的匹配规则：按相机文件名特征（IMG_5359 / DSC_3451 / WH1_9774 等）
 * 在 COS 孤儿文件中查找同名原始文件，复制到数据库记录的 key 上。
 * 历史原因：2026-10 曾有一批图片以 `{timestamp}-{hash}-{uuid}-{filename}`
 * 的格式重新上传，但数据库 url 未同步更新，形成「孤儿文件 + 缺失记录」。
 */
import { S3Client, ListObjectsV2Command, HeadObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env" });

const BUCKET = process.env.S3_BUCKET_NAME!;
const s3 = new S3Client({
  region: "ap-nanjing",
  endpoint: process.env.S3_ENDPOINT || "https://cos.ap-nanjing.myqcloud.com",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: false,
});

const FIX = process.argv.includes("--fix");

/** 提取相机文件名特征，如 IMG_5359 / DSC_3451 / WH1_9774 */
function feature(key: string): string | null {
  const base = key.split("/").pop() || "";
  const m = base.match(/(IMG_\d+|DSC_\d+|WH1_\d+|TYJ_\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

async function listAllObjects(): Promise<{ Key: string; Size: number }[]> {
  const out: { Key: string; Size: number }[] = [];
  let token: string | undefined;
  do {
    const r = await listPage(token);
    out.push(...r.items);
    token = r.token;
  } while (token);
  return out;
}

async function listPage(token?: string) {
  const r = await s3.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "photos/", ContinuationToken: token, MaxKeys: 1000 })
  );
  return {
    items: (r.Contents || []).map((o) => ({ Key: o.Key!, Size: o.Size || 0 })),
    token: r.IsTruncated ? r.NextContinuationToken : undefined,
  };
}

async function exists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function copyObject(from: string, to: string) {
  const src = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: from }));
  const chunks: Buffer[] = [];
  // @ts-expect-error Body 是流
  for await (const chunk of src.Body) chunks.push(Buffer.from(chunk));
  const buf = Buffer.concat(chunks);

  const ext = to.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "heic" ? "image/heic" : "image/jpeg";

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: to,
      Body: buf,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000",
    })
  );
  return buf.length;
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const { rows } = await db.query("SELECT id, title, url, visibility FROM photos ORDER BY created_at DESC;");
  console.log(`数据库照片: ${rows.length} 张`);

  const objects = await listAllObjects();
  console.log(`COS photos/ 对象: ${objects.length} 个\n`);

  // 1. 检查缺失（数据库有、COS 无）
  const missing: typeof rows = [];
  for (const row of rows) {
    if (!(await exists(row.url))) missing.push(row);
  }

  console.log(`=== 缺失源文件: ${missing.length} ===`);
  for (const m of missing) console.log(`  ${m.visibility}\t${m.id}\t${m.title}`);

  // 2. 孤儿文件（COS 有、数据库无）
  const dbKeys = new Set(rows.map((r) => r.url));
  const orphans = objects.filter((o) => o.Key !== "photos/" && !dbKeys.has(o.Key));
  console.log(`\n=== 孤儿文件: ${orphans.length} ===`);
  for (const o of orphans.slice(0, 20)) {
    console.log(`  ${(o.Size / 1024 / 1024).toFixed(1)}MB\t${o.Key.split("/").pop()}`);
  }
  if (orphans.length > 20) console.log(`  ... 另有 ${orphans.length - 20} 个`);

  // 3. 按特征匹配可回填的项
  const fixable: { row: (typeof rows)[0]; source: string; size: number }[] = [];
  for (const row of missing) {
    const f = feature(row.url);
    if (!f) continue;
    const candidates = orphans.filter((o) => feature(o.Key) === f);
    if (candidates.length) {
      const best = candidates.sort((a, b) => b.Size - a.Size)[0];
      fixable.push({ row, source: best.Key, size: best.Size });
    }
  }

  if (fixable.length) {
    console.log(`\n=== 可回填: ${fixable.length} 张 ===`);
    for (const f of fixable) {
      console.log(`  ${f.row.title}  ←  ${f.source.split("/").pop()}  ${(f.size / 1024 / 1024).toFixed(1)}MB`);
    }
  }

  if (FIX && fixable.length) {
    console.log("\n=== 执行回填 ===");
    for (const f of fixable) {
      try {
        const n = await copyObject(f.source, f.row.url);
        console.log(`  ✓ ${f.row.title}  ${(n / 1024 / 1024).toFixed(2)}MB`);
      } catch (e) {
        console.log(`  ✗ ${f.row.title}  ${(e as Error).message}`);
      }
    }
  } else if (!FIX && fixable.length) {
    console.log("\n提示：加 --fix 可自动回填上述可修复项。");
  }

  await db.end();

  if (missing.length === 0) console.log("\n✅ 全部照片源文件正常");
  else process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
