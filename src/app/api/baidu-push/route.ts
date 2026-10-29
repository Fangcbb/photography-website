import { NextResponse } from "next/server";
import { db } from "@/db";
import { photos, videos, citySets } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/modules/auth/lib/get-session";

const BAIDU_API = "https://data.zz.baidu.com/urls";
const SITE = "https://www.fangc.cc";
const TOKEN = process.env.BAIDU_PUSH_TOKEN || "";

// 仅管理员可触发的 POST：避免爬虫/预取通过匿名 GET 消耗推送额度
export async function POST() {
  if (!TOKEN) {
    return NextResponse.json({ error: "BAIDU_PUSH_TOKEN not set" }, { status: 500 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 收集所有公开页面 URL
  const urls: string[] = [SITE, `${SITE}/about`, `${SITE}/travel`, `${SITE}/discover`, `${SITE}/blog`];

  try {
    const allPhotos = await db
      .select({ id: photos.id })
      .from(photos)
      .where(eq(photos.visibility, "public"))
      .limit(500);
    allPhotos.forEach((p) => urls.push(`${SITE}/p/${p.id}`));
  } catch {}

  try {
    const allCities = await db
      .select({ slug: citySets.slug })
      .from(citySets)
      .limit(100);
    allCities.forEach((c) => urls.push(`${SITE}/travel/${c.slug}`));
  } catch {}

  try {
    const allVideos = await db
      .select({ slug: videos.slug })
      .from(videos)
      .where(eq(videos.visibility, "public"))
      .limit(200);
    allVideos.forEach((v) => urls.push(`${SITE}/blog/${v.slug}`));
  } catch {}

  // 每批最多 1000 条（百度 API 限制）
  const batches: string[][] = [];
  for (let i = 0; i < urls.length; i += 1000) {
    batches.push(urls.slice(i, i + 1000));
  }

  const results: any[] = [];
  for (const batch of batches) {
    try {
      const res = await fetch(`${BAIDU_API}?site=${SITE}&token=${TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: batch.join("\n"),
      });
      const data = await res.json();
      results.push(data);
    } catch (e: any) {
      results.push({ error: e.message });
    }
  }

  return NextResponse.json({
    total: urls.length,
    batches: batches.length,
    results,
  });
}
