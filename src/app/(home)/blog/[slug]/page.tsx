import { Metadata } from "next";
import { VideoPlayerView, VideoPlayerLoadingState } from "@/modules/video/ui/views/video-player-view";
import { getQueryClient } from "@/trpc/server";
import { trpc } from "@/trpc/server";
import { HydrationBoundary } from "@tanstack/react-query";
import { dehydrate } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

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
  
  await queryClient.fetchQuery(
    trpc.video.getOne.queryOptions({ slug: decodedSlug })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<VideoPlayerLoadingState />}>
        <ErrorBoundary fallback={<p className="text-white p-8">加载失败</p>}>
          <VideoPlayerView slug={decodedSlug} />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
}
