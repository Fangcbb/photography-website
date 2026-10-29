import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { cache } from "react";
import Link from "next/link";
import { db } from "@/db";
import { videos, posts } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import {
  VideoListView,
  VideoListLoadingStatus,
} from "@/modules/video/ui/views/video-list-view";
import { keyToUrl } from "@/modules/s3/lib/key-to-url";

export const dynamic = "force-dynamic";

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

// 公开文字游记（服务端预取，保证 SEO 可爬）
const getPublicPosts = cache(async () => {
  try {
    return await db
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        description: posts.description,
        updatedAt: posts.updatedAt,
      })
      .from(posts)
      .where(eq(posts.visibility, "public"))
      .orderBy(desc(posts.updatedAt))
      .limit(12);
  } catch {
    return [];
  }
});

// 文字游记区块（服务端渲染，样式与视频卡片风格一致）
const WrittenJournals = ({ items }: { items: {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  updatedAt: Date;
}[] }) => {
  if (items.length === 0) return null;

  return (
    <section className="w-full">
      <div className="bg-muted rounded-xl">
        <div className="p-8">
          <h2 className="text-2xl mb-6">Written Journals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="block rounded-xl overflow-hidden bg-background/50 p-4 hover:bg-background/80 transition-colors group"
              >
                <h3 className="font-semibold line-clamp-2 mb-1 group-hover:underline">
                  {post.title}
                </h3>
                <div className="flex items-center gap-3 text-xs opacity-80 mb-2">
                  <span>
                    {new Date(post.updatedAt).toISOString().slice(0, 10)}
                  </span>
                </div>
                {post.description && (
                  <p className="text-sm font-light line-clamp-2">
                    {post.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const page = async () => {
  const [seoVideos, publicPosts] = await Promise.all([
    getSeoVideos(),
    getPublicPosts(),
  ]);

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
          <VideoListView journals={<WrittenJournals items={publicPosts} />} />
        </ErrorBoundary>
      </Suspense>

      {/* 文字游记区块（服务端渲染，SEO 可爬） */}    </>
  );
};

export default page;
