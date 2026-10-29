export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { VideoPlayerView, VideoPlayerLoadingState } from "@/modules/video/ui/views/video-player-view";
import { BlogSlugView } from "@/modules/blog/ui/views/blog-slug-view";
import { getQueryClient } from "@/trpc/server";
import { trpc } from "@/trpc/server";
import { keyToUrl } from "@/modules/s3/lib/key-to-url";

type Props = {
  params: Promise<{ slug: string }>;
};

const BASE_URL = "https://www.fangc.cc";

function toSafeJsonLd(value: unknown) {
  // Prevent user-authored title/description from terminating an inline script.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function getVideoPosterUrl(video: { videoUrl: string; thumbnailUrl?: string | null }) {
  if (video.thumbnailUrl) return keyToUrl(video.thumbnailUrl);
  const videoUrl = keyToUrl(video.videoUrl);
  return `${videoUrl}${videoUrl.includes("?") ? "&" : "?"}ci-process=snapshot&time=1&format=jpg`;
}

async function getVideoOrNull(slug: string) {
  const queryClient = getQueryClient();
  try {
    const video = await queryClient.fetchQuery(
      trpc.video.getOne.queryOptions({ slug }),
    );
    return { queryClient, video };
  } catch {
    return { queryClient, video: null };
  }
}

async function getPostOrNull(slug: string) {
  const queryClient = getQueryClient();
  try {
    const post = await queryClient.fetchQuery(
      trpc.blog.getOne.queryOptions({ slug }),
    );
    return { queryClient, post };
  } catch {
    return { queryClient, post: null };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const { video } = await getVideoOrNull(slug);

  if (video) {
    const poster = getVideoPosterUrl(video);
    return {
      title: video.title,
      description: video.description || `${video.title} - 方斌视频`,
      alternates: { canonical: `${BASE_URL}/blog/${encodeURIComponent(slug)}` },
      openGraph: {
        title: video.title,
        description: video.description || `${video.title} - 方斌视频`,
        type: "video.other",
        videos: video.videoUrl ? [keyToUrl(video.videoUrl)] : undefined,
        images: poster ? [poster] : undefined,
      },
    };
  }

  const { post } = await getPostOrNull(slug);
  if (!post) {
    return {
      title: "内容不存在",
      description: "文章或视频不存在，或已被删除。",
      alternates: { canonical: `${BASE_URL}/blog/${encodeURIComponent(slug)}` },
    };
  }

  return {
    title: post.title,
    description: post.description || `${post.title} - 方斌的摄影作品集`,
    alternates: { canonical: `${BASE_URL}/blog/${encodeURIComponent(slug)}` },
    openGraph: {
      title: post.title,
      description: post.description || `${post.title} - 方斌的摄影作品集`,
      type: "article",
      images: post.coverImage ? [keyToUrl(post.coverImage)] : undefined,
    },
  };
}

export default async function BlogDetailPage({ params }: Props) {
  const slug = decodeURIComponent((await params).slug);
  const { queryClient: videoQueryClient, video } = await getVideoOrNull(slug);

  if (video) {
    const poster = getVideoPosterUrl(video);
    return (
      <HydrationBoundary state={dehydrate(videoQueryClient)}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: toSafeJsonLd({
              "@context": "https://schema.org",
              "@type": "VideoObject",
              name: video.title,
              description: video.description || video.title,
              thumbnailUrl: poster,
              contentUrl: keyToUrl(video.videoUrl),
              url: `${BASE_URL}/blog/${encodeURIComponent(slug)}`,
              uploadDate: video.createdAt ? new Date(video.createdAt).toISOString() : undefined,
              duration: video.videoDuration ? `PT${video.videoDuration}S` : undefined,
              author: { "@type": "Person", name: "Fang Bing", url: BASE_URL },
              publisher: { "@type": "Person", name: "Fang Bing" },
            }),
          }}
        />
        <Suspense fallback={<VideoPlayerLoadingState />}>
          <ErrorBoundary fallback={<p className="text-white p-8">视频加载失败，请刷新重试。</p>}>
            <VideoPlayerView slug={slug} />
          </ErrorBoundary>
        </Suspense>
      </HydrationBoundary>
    );
  }

  // /blog hosts both video slugs and written-journal slugs. Fall through to
  // the public post query so Written Journals cards do not resolve as 500s.
  const { queryClient: postQueryClient, post } = await getPostOrNull(slug);
  if (!post) notFound();

  return (
    <HydrationBoundary state={dehydrate(postQueryClient)}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toSafeJsonLd({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description || post.title,
            image: post.coverImage ? [keyToUrl(post.coverImage)] : undefined,
            url: `${BASE_URL}/blog/${encodeURIComponent(slug)}`,
            datePublished: post.createdAt ? new Date(post.createdAt).toISOString() : undefined,
            dateModified: post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
            author: { "@type": "Person", name: "Fang Bing", url: BASE_URL },
            publisher: { "@type": "Person", name: "Fang Bing" },
          }),
        }}
      />
      <Suspense fallback={<VideoPlayerLoadingState />}>
        <ErrorBoundary fallback={<p className="p-8">文章加载失败，请刷新重试。</p>}>
          <BlogSlugView slug={slug} />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
}
