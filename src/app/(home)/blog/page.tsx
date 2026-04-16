import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
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
// ISR 模式下每 60s 重新验证，build 时若 DB 不可用则返回空数组不阻塞构建
async function getSeoVideos() {
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
}

const page = async () => {
  const seoVideos = await getSeoVideos();

  return (
    <>
      {/* SEO fallback: Googlebot sees完整视频列表 */}
      <div className="sr-only">
        {seoVideos.map((v) => (
          <a key={v.id} href={`/blog/${v.slug}`}>
            {v.thumbnailUrl && (
              <img src={keyToUrl(v.thumbnailUrl)} alt={v.title} />
            )}
            <h2>{v.title}</h2>
          </a>
        ))}
      </div>

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
