import { MetadataRoute } from "next";
import { db } from "@/db";
import { photos, citySets, posts } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

const BASE_URL = "https://www.fangc.cc";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 并行查询所有数据
  const [publicPhotos, allCitySets, publicPosts] = await Promise.all([
    // 查询所有公开照片
    db
      .select()
      .from(photos)
      .where(eq(photos.visibility, "public"))
      .orderBy(desc(photos.updatedAt)),
    
    // 查询所有城市集合
    db.query.citySets.findMany({
      orderBy: [desc(citySets.updatedAt)],
    }),
    
    // 查询所有公开博客文章
    db
      .select()
      .from(posts)
      .where(eq(posts.visibility, "public"))
      .orderBy(desc(posts.updatedAt)),
  ]);

  // 静态页面
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/discover`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/travel`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  // 照片详情页
  const photoPages: MetadataRoute.Sitemap = publicPhotos.map((photo) => ({
    url: `${BASE_URL}/p/${photo.id}`,
    lastModified: photo.updatedAt || new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // 城市集合页
  const cityPages: MetadataRoute.Sitemap = allCitySets.map((citySet) => ({
    url: `${BASE_URL}/travel/${encodeURIComponent(citySet.city.toLowerCase().replace(/\s+/g, "-"))}`,
    lastModified: citySet.updatedAt || new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // 博客文章页
  const blogPages: MetadataRoute.Sitemap = publicPosts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: post.updatedAt || new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...photoPages, ...cityPages, ...blogPages];
}
