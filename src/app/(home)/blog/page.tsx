import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { cache } from "react";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import {
  VideoListView,
  VideoListLoadingStatus,
} from "@/modules/video/ui/views/video-list-view";
import { keyToUrl } from "@/modules/s3/lib/key-to-url";

export const revalidate = 60;

export const metadata = {
  title: "视频 - 方斌的摄影作品集",
  description:
    "观看方斌的旅行视频、摄影技巧和幕后花絮。通过视频探索美丽的风景目的地。",
  keywords: [
    // 视频相关
    "旅行视频",
    "旅行Vlog",
    "旅行记录",
    "摄影视频",
    "视频作品",
    "视频博客",
    "旅行日记",
    // 主题相关
    "城市探索",
    "中国旅行",
    "旅行纪录片",
    "摄影教程视频",
    "摄影技巧分享",
    // 地点相关
    "苏州旅行视频",
    "江南水乡视频",
    "古镇旅行",
    "水乡古镇",
    // 其他
    "摄影师Vlog",
    "独立摄影师",
    "旅行摄影视频",
  ],
};

// SEO fallback: 少量视频数据，供 Google 索引
// cache() 确保单次请求内多次调用只查一次 DB
const getSeoVideos = cache(async () => {
  try {
    return await db
      .select({
        id: videos.id,
        slug: videos.slug,
        title: videos.title,
        thumbnailUrl: videos.thumbnailUrl,
      })
      .from(videos)
      .where(eq(videos.visibility, "public"))
      .orderBy(asc(videos.dateTimeOriginal))
      .limit(6);
  } catch {
    return [];
  }
});

const page = async () => {
  const seoVideos = await getSeoVideos();

  return (
    <>
      {/* SEO fallback: 可见背景视频缩略图，hydration 后 VideoListView 覆盖 */}
      {seoVideos.length > 0 && (
        <div className="fixed inset-0 z-0 select-none pointer-events-none overflow-hidden">
          {seoVideos.map((v) => (
            v.thumbnailUrl && (
              <img
                key={v.id}
                src={keyToUrl(v.thumbnailUrl)}
                alt={v.title}
                className="w-full h-full object-cover opacity-10"
              />
            )
          ))}
        </div>
      )}
      {seoVideos.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              "itemListElement": seoVideos.map((v, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "name": v.title,
                "url": `/blog/${v.slug}`,
                ...(v.thumbnailUrl && {
                  "image": keyToUrl(v.thumbnailUrl),
                }),
              })),
            }),
          }}
        />
      )}

      {/* 实际页面：客户端 React Query 获取完整数据 */}
      <Suspense fallback={<VideoListLoadingStatus />}>
        <ErrorBoundary fallback={<p>Error</p>}>
          <VideoListView />
        </ErrorBoundary>
      </Suspense>
    </>
  );
};

export default page;
