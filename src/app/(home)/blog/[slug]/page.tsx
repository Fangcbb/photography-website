export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { VideoPlayerView, VideoPlayerLoadingState } from "@/modules/video/ui/views/video-player-view";
import { getQueryClient } from "@/trpc/server";
import { trpc } from "@/trpc/server";
import { HydrationBoundary } from "@tanstack/react-query";
import { dehydrate } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { keyToUrl } from "@/modules/s3/lib/key-to-url";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const decodedSlug = decodeURIComponent(slug);
  const queryClient = getQueryClient();
  
  try {
    const data = await queryClient.fetchQuery(
      trpc.video.getOne.queryOptions({ slug: decodedSlug })
    );

    return {
      title: data.title,
      description: data.description || `${data.title} - 方斌视频`,
      openGraph: {
        title: data.title,
        description: data.description || `${data.title} - 方斌视频`,
        type: "video.other",
        videos: data.videoUrl ? [data.videoUrl] : undefined,
        images: data.thumbnailUrl ? [data.thumbnailUrl] : undefined,
      },
    };
  } catch {
    return {
      title: "视频不存在",
      description: "视频不存在或已被删除",
    };
  }
}

export default async function page({ params }: Props) {
  const slug = (await params).slug;
  const decodedSlug = decodeURIComponent(slug);
  const queryClient = getQueryClient();
  
  const data = await queryClient.fetchQuery(
    trpc.video.getOne.queryOptions({ slug: decodedSlug })
  );

  const BASE_URL = "https://www.fangc.cc";

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* VideoObject 结构化数据 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoObject",
            "name": data.title,
            "description": data.description || data.title,
            "thumbnailUrl": data.thumbnailUrl ? keyToUrl(data.thumbnailUrl) : undefined,
            "contentUrl": data.videoUrl ? keyToUrl(data.videoUrl) : undefined,
            "url": `${BASE_URL}/blog/${decodedSlug}`,
            "uploadDate": data.createdAt ? new Date(data.createdAt).toISOString() : undefined,
            "duration": data.videoDuration ? `PT${data.videoDuration}S` : undefined,
            "author": {
              "@type": "Person",
              "name": "Fang Bing",
              "url": BASE_URL
            },
            "publisher": {
              "@type": "Person",
              "name": "Fang Bing"
            }
          }),
        }}
      />
      {/* BreadcrumbList 结构化数据 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "首页",
                "item": BASE_URL
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "视频",
                "item": `${BASE_URL}/blog`
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": data.title,
                "item": `${BASE_URL}/blog/${decodedSlug}`
              }
            ]
          }),
        }}
      />
      <Suspense fallback={<VideoPlayerLoadingState />}>
        <ErrorBoundary fallback={<p className="text-white p-8">加载失败</p>}>
          <VideoPlayerView slug={decodedSlug} />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
}
