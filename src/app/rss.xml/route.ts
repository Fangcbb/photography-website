import { db } from "@/db";
import { photos, videos } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

const BASE_URL = "https://www.fangc.cc";
const SITE_TITLE = "Fang Bing Photography | 方斌的摄影作品集";
const SITE_DESCRIPTION =
  "我是方斌，一名业余摄影师。在业余时间，我喜欢用镜头记录生活和旅行中的美好瞬间。";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(date: Date): string {
  return date.toUTCString();
}

export async function GET() {
  const items: string[] = [];

  // ── Recent photos ──────────────────────────────────────
  try {
    const recentPhotos = await db
      .select({
        id: photos.id,
        title: photos.title,
        description: photos.description,
        url: photos.url,
        city: photos.city,
        country: photos.country,
        dateTimeOriginal: photos.dateTimeOriginal,
        createdAt: photos.createdAt,
      })
      .from(photos)
      .where(eq(photos.visibility, "public"))
      .orderBy(desc(photos.createdAt))
      .limit(30);

    for (const photo of recentPhotos) {
      const pubDate = photo.dateTimeOriginal ?? photo.createdAt;
      const location = [photo.city, photo.country].filter(Boolean).join(", ");
      const link = `${BASE_URL}/p/${photo.id}`;
      const photoUrl = photo.url.startsWith("http")
        ? photo.url
        : `https://cnn.fangc.cc/${photo.url}`;

      items.push(`
    <item>
      <title>${escapeXml(photo.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${toRfc822(pubDate)}</pubDate>
      <description>${escapeXml(photo.description)}</description>
      ${location ? `<category>${escapeXml(location)}</category>` : ""}
      <enclosure url="${escapeXml(photoUrl)}" type="image/jpeg" />
    </item>`);
    }
  } catch {
    // DB unavailable — skip photos
  }

  // ── Recent videos ──────────────────────────────────────
  try {
    const recentVideos = await db
      .select({
        id: videos.id,
        title: videos.title,
        slug: videos.slug,
        description: videos.description,
        thumbnailUrl: videos.thumbnailUrl,
        createdAt: videos.createdAt,
      })
      .from(videos)
      .where(eq(videos.visibility, "public"))
      .orderBy(desc(videos.createdAt))
      .limit(10);

    for (const video of recentVideos) {
      const link = `${BASE_URL}/blog/${video.slug}`;

      items.push(`
    <item>
      <title>${escapeXml(video.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${toRfc822(video.createdAt)}</pubDate>
      ${video.description ? `<description>${escapeXml(video.description)}</description>` : ""}
      ${video.thumbnailUrl ? `<enclosure url="${escapeXml(video.thumbnailUrl)}" type="image/jpeg" />` : ""}
    </item>`);
    }
  } catch {
    // DB unavailable — skip videos
  }

  // ── Sort all items by pubDate descending ───────────────
  // Items are already appended in order per section, but we keep
  // the per-section order since each query is already sorted.

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${BASE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>zh-cn</language>
    <lastBuildDate>${toRfc822(new Date())}</lastBuildDate>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${BASE_URL}/favicon.ico</url>
      <title>${escapeXml(SITE_TITLE)}</title>
      <link>${BASE_URL}</link>
    </image>
${items.join("\n")}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
