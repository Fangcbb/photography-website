import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { cache } from "react";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { keyToUrl } from "@/modules/s3/lib/key-to-url";
import ProfileCard from "@/modules/home/ui/components/profile-card";
import LatestTravelCard from "@/modules/home/ui/components/latest-travel-card";
import Footer from "@/components/footer";
import {
  CitiesView,
  CitiesViewLoadingStatus,
} from "@/modules/home/ui/views/cities-view";
import {
  SliderViewLoadingStatus,
  SliderView,
} from "@/modules/home/ui/views/slider-view";

export const revalidate = 60;

export const metadata = {
  title: "Fang Bing Photography | 方斌的摄影作品集",
  description:
    "探索方斌的旅行与街头摄影作品。一位来自安徽的摄影师，记录世界各地的美丽风景、城市景观和迷人的瞬间。",
  keywords: [
    "Fang Bing Photography",
    "方斌的摄影作品集",
    "方斌摄影",
    "方斌摄影师",
    "摄影作品集",
    "摄影作品展示",
    "旅行摄影作品",
    "街头摄影作品",
    "安徽摄影师",
    "中国摄影师",
    "安徽摄影",
    "人文摄影",
    "纪实摄影",
    "城市摄影",
    "风光摄影",
    "摄影约拍",
    "商业摄影",
    "摄影服务",
    "独立摄影师",
    "自由摄影师",
    "摄影作品在线展览",
  ],
};

// SSR fallback: 服务端直接获取少量数据，渲染到 HTML
// cache() 确保单次请求内多次调用只查一次 DB
const getSeoPhotos = cache(async () => {
  try {
    return await db
      .select({
        id: photos.id,
        title: photos.title,
        url: photos.url,
        description: photos.description,
      })
      .from(photos)
      .where(eq(photos.visibility, "public"))
      .orderBy(desc(photos.dateTimeOriginal))
      .limit(8);
  } catch {
    return [];
  }
});

export default async function HomePage() {
  const seoPhotos = await getSeoPhotos();

  return (
    <>
      {/* JSON-LD structured data for Google SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Fang Bing Photography",
            description: "探索方斌的旅行与街头摄影作品",
            url: "https://www.fangc.cc",
            author: {
              "@type": "Person",
              name: "Fang Bing"
            },
            mainEntity: {
              "@type": "ItemList",
              itemListElement: seoPhotos.map((p, i) => ({
                "@type": "Photograph",
                position: i + 1,
                name: p.title,
                description: p.description || "",
                image: keyToUrl(p.url),
                url: `https://www.fangc.cc/p/${p.id}`,
                contentUrl: keyToUrl(p.url),
              }))
            }
          })
        }}
      />

      {/* 实际 UI: client components 通过 useSuspenseQuery 加载完整数据 */}
      <div className="relative z-10 flex flex-col lg:flex-row min-h-screen w-full">
        {/* LEFT CONTENT - Fixed */}
        <div className="w-full lg:w-1/2 h-[50vh] sm:h-[60vh] lg:fixed lg:top-0 lg:left-0 lg:h-screen p-0 lg:p-0 rounded-xl">
          <div className="h-full lg:p-3 rounded-xl overflow-hidden">
            <Suspense fallback={<SliderViewLoadingStatus />}>
              <ErrorBoundary fallback={<p>Something went wrong</p>}>
                <SliderView />
              </ErrorBoundary>
            </Suspense>
          </div>
        </div>
        {/* Spacer for fixed left content */}
        <div className="hidden lg:block lg:w-1/2" />
        {/* RIGHT CONTENT - Scrollable */}
        <div className="w-full mt-3 lg:mt-0 lg:pt-0 lg:w-1/2 space-y-3 pb-3">
          <ProfileCard />
          <LatestTravelCard />
          <Suspense fallback={<CitiesViewLoadingStatus />}>
            <ErrorBoundary fallback={<p>Error</p>}>
              <CitiesView />
            </ErrorBoundary>
          </Suspense>
          <Footer />
        </div>
      </div>
    </>
  );
}
