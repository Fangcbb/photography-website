export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getQueryClient } from "@/trpc/server";
import { trpc } from "@/trpc/server";
import { HydrationBoundary } from "@tanstack/react-query";
import { dehydrate } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  LoadingState,
  PhotographView,
} from "@/modules/photograph/ui/views/photograph-view";
import { photoProxyUrl, photoDisplayUrl } from "@/lib/photo-url";

const BASE_URL = "https://www.fangc.cc";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).id;
  const queryClient = getQueryClient();
  let data;
  try {
    data = await queryClient.fetchQuery(
      trpc.home.getPhotoById.queryOptions({ id })
    );
  } catch (e) {
    notFound();
  }

  const title = `${data.title} | Fang Bing Photography`;
  const description = data.description?.trim() || `${data.title} - 方斌摄影作品`;
  const imageUrl = photoProxyUrl(data.id, "display");

  return {
    title,
    description,
    openGraph: {
      type: "article",
      title: data.title,
      description,
      url: `${BASE_URL}/p/${id}`,
      siteName: "Fang Bing Photography",
      locale: "zh_CN",
      images: [
        {
          url: imageUrl,
          width: data.width || 1200,
          height: data.height || 800,
          alt: data.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description,
      images: [imageUrl],
      creator: "@fangcarry",
    },
  };
}

const page = async ({ params }: Props) => {
  const id = (await params).id;
  const queryClient = getQueryClient();
  let data;
  try {
    data = await queryClient.fetchQuery(trpc.home.getPhotoById.queryOptions({ id }));
  } catch (e) {
    notFound();
  }

  const description = data.description?.trim() || `${data.title} - 方斌摄影作品`;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* 结构化数据 - 百度/Google 图片富摘要 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ImageObject",
            "name": data.title,
            "description": description,
            "contentUrl": photoDisplayUrl(data.url),
            "url": `${BASE_URL}/p/${id}`,
            "thumbnail": photoDisplayUrl(data.url),
            "author": {
              "@type": "Person",
              "name": "Fang Bing",
              "url": BASE_URL
            },
            "copyrightHolder": {
              "@type": "Person",
              "name": "Fang Bing"
            },
            "width": data.width || 1200,
            "height": data.height || 800,
            ...(data.city && data.country ? {
              "contentLocation": {
                "@type": "Place",
                "name": `${data.city}, ${data.country}`
              }
            } : {}),
            ...(data.dateTimeOriginal ? {
              "datePublished": new Date(data.dateTimeOriginal).toISOString()
            } : {})
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
              ...(data.city ? [{
                "@type": "ListItem",
                "position": 2,
                "name": data.city,
                "item": `${BASE_URL}/travel/${data.city.toLowerCase().replace(/\s+/g, '-')}`
              }] : []),
              {
                "@type": "ListItem",
                "position": data.city ? 3 : 2,
                "name": data.title,
                "item": `${BASE_URL}/p/${id}`
              }
            ]
          }),
        }}
      />
      <Suspense fallback={<LoadingState />}>
        <ErrorBoundary fallback={<p>Error</p>}>
          <PhotographView id={id} />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default page;
