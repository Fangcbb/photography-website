import { MetadataRoute } from "next";
import { db } from "@/db";
import { photos, citySets, videos } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

const BASE_URL = "https://www.fangc.cc";

// 每小时再验证一次，运行后新增的公开内容无需重新部署即可进入站点地图
export const revalidate = 3600;

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
  } catch (error) {
    console.error("sitemap: 照片查询失败", error);
  }

  // 动态页面 — 城市/旅行集
  let travelPages: MetadataRoute.Sitemap = [];
  try {
    const allCities = await db
      .select({ slug: citySets.slug, updatedAt: citySets.updatedAt })
      .from(citySets)
      .orderBy(desc(citySets.updatedAt))
      .limit(100);

    travelPages = allCities.map((c) => ({
      url: `${BASE_URL}/travel/${c.slug}`,
      lastModified: c.updatedAt ?? now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error("sitemap: 城市查询失败", error);
  }

  // 动态页面 — 视频详情
  let videoPages: MetadataRoute.Sitemap = [];
  try {
    const allVideos = await db
      .select({ slug: videos.slug, updatedAt: videos.updatedAt })
      .from(videos)
      .where(eq(videos.visibility, "public"))
      .orderBy(desc(videos.updatedAt))
      .limit(200);

    videoPages = allVideos.map((v) => ({
      url: `${BASE_URL}/blog/${v.slug}`,
      lastModified: v.updatedAt ?? now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch (error) {
    console.error("sitemap: 视频查询失败", error);
  }

  return [...staticPages, ...photoPages, ...travelPages, ...videoPages];
}
