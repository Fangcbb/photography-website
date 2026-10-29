export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { trpc } from "@/trpc/server";
import { getQueryClient } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { CityView } from "@/modules/travel/ui/views/city-view";
import { photoProxyUrl, photoDisplayUrl } from "@/lib/photo-url";

const BASE_URL = "https://www.fangc.cc";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const queryClient = getQueryClient();

  try {
    const data = await queryClient.fetchQuery(
      trpc.travel.getBySlug.queryOptions({ slug })
    );

    const city = data.city;
    const country = data.country;
    const title = `${city} Photography | ${city} 摄影作品 - Fang Bing`;
    const description = `探索方斌在${city}的摄影作品。${city}的风景、城市景观和迷人瞬间。`;
    const coverPhotoUrl = data.photos?.[0]?.url
      ? photoProxyUrl(data.photos[0].id, "display")
      : `${BASE_URL}/avatar.jpg`;

    return {
      title,
      description,
      alternates: { canonical: `${BASE_URL}/travel/${slug}` },
      openGraph: {
        type: "article",
        title,
        description,
        url: `${BASE_URL}/travel/${slug}`,
        siteName: "Fang Bing Photography",
        locale: "zh_CN",
        images: [
          {
            url: coverPhotoUrl,
            width: 1200,
            height: 630,
            alt: `${city} - Fang Bing Photography`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [coverPhotoUrl],
        creator: "@fangcarry",
      },
    };
  } catch {
    const title = `${slug.charAt(0).toUpperCase() + slug.slice(1)} Travel Photography`;
    return {
      title,
      alternates: { canonical: `${BASE_URL}/travel/${slug}` },
      openGraph: { title, url: `${BASE_URL}/travel/${slug}` },
    };
  }
}

const Page = async ({ params }: Props) => {
  const { slug } = await params;

  const queryClient = getQueryClient();
  let data;
  try {
    data = await queryClient.fetchQuery(
      trpc.travel.getBySlug.queryOptions({ slug }),
    );
  } catch {
    notFound();
  }

  const city = data.city;
  const country = data.country;
  const photos = data.photos || [];

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* Place + ImageGallery 结构化数据 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Place",
            "name": `${city}, ${country}`,
            "url": `https://www.fangc.cc/travel/${slug}`,
            "description": `探索方斌在${city}的摄影作品。${city}的风景、城市景观和迷人瞬间。`,
            "image": photos[0] ? photoDisplayUrl(photos[0].url) : undefined,
            "containedInPlace": {
              "@type": "Country",
              "name": country
            },
            "photo": photos.slice(0, 10).map((p: any) => ({
              "@type": "ImageObject",
              "name": p.title || `${city} Photography`,
              "contentUrl": photoDisplayUrl(p.url),
              "thumbnail": photoDisplayUrl(p.url),
              "url": `https://www.fangc.cc/p/${p.id}`,
              "author": {
                "@type": "Person",
                "name": "Fang Bing"
              }
            }))
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
                "item": "https://www.fangc.cc"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "旅行摄影",
                "item": "https://www.fangc.cc/travel"
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": `${city}, ${country}`,
                "item": `https://www.fangc.cc/travel/${slug}`
              }
            ]
          }),
        }}
      />
      <ErrorBoundary fallback={<p>Something went wrong</p>}>
        <Suspense fallback={<p>Loading...</p>}>
          <CityView slug={slug} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
};

export default Page;
