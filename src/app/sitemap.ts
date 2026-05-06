import { MetadataRoute } from "next";
import { db } from "@/db";
import { photos, citySets } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

const BASE_URL = "https://www.fangc.cc";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 静态页面
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/travel`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/discover`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/music`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/screensaver`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  // �态页面 — 照片详情
  let photoPages: MetadataRoute.Sitemap = [];
  try {
    const allPhotos = await db
      .select({ id: photos.id, updatedAt: photos.updatedAt })
      .from(photos)
      .where(eq(photos.visibility, "public"))
      .orderBy(desc(photos.updatedAt))
      .limit(500);

    photoPages = allPhotos.map((p) => ({
      url: `${BASE_URL}/p/${p.id}`,
      lastModified: p.updatedAt ?? now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    // DB 查询失败时跳过
  }

  // 动态页面 — 城市/旅行集
  let travelPages: MetadataRoute.Sitemap = [];
  try {
    const allCities = await db
      .select({ id: citySets.id, updatedAt: citySets.updatedAt })
      .from(citySets)
      .orderBy(desc(citySets.updatedAt))
      .limit(100);

    travelPages = allCities.map((c) => ({
      url: `${BASE_URL}/travel/${c.id}`,
      lastModified: c.updatedAt ?? now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch {
    // DB 查询失败时跳过
  }

  return [...staticPages, ...photoPages, ...travelPages];
}
