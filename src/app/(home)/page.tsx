import { Suspense } from "react";
import { trpc } from "@/trpc/server";
import { getQueryClient } from "@/trpc/server";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

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

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Fang Bing Photography | 方斌的摄影作品集",
  description: "探索方斌的旅行与街头摄影作品。一位来自安徽的摄影师，记录世界各地的美丽风景、城市景观和迷人的瞬间。",
  keywords: [
    // 个人品牌
    "Fang Bing Photography",
    "方斌的摄影作品集",
    "方斌摄影",
    "方斌摄影师",
    // 核心服务
    "摄影作品集",
    "摄影作品展示",
    "旅行摄影作品",
    "街头摄影作品",
    // 地理位置
    "安徽摄影师",
    "中国摄影师",
    "安徽摄影",
    // 特色内容
    "人文摄影",
    "纪实摄影",
    "城市摄影",
    "风光摄影",
    // 服务
    "摄影约拍",
    "商业摄影",
    "摄影服务",
    // 其他
    "独立摄影师",
    "自由摄影师",
    "摄影作品在线展览",
  ],
};

const page = async () => {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.home.getManyLikePhotos.queryOptions({ limit: 10 })
  );
  void queryClient.prefetchQuery(
    trpc.home.getCitySets.queryOptions({ limit: 12 })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col lg:flex-row min-h-screen w-full">
        {/* LEFT CONTENT - Fixed */}
        <div className="w-full lg:w-1/2 h-[70vh] lg:fixed lg:top-0 lg:left-0 lg:h-screen p-0 lg:p-3 rounded-xl">
          <Suspense fallback={<SliderViewLoadingStatus />}>
            <ErrorBoundary fallback={<p>Something went wrong</p>}>
              <SliderView />
            </ErrorBoundary>
          </Suspense>
        </div>
        {/* Spacer for fixed left content */}
        <div className="hidden lg:block lg:w-1/2" />
        {/* RIGHT CONTENT - Scrollable */}
        <div className="w-full mt-3 lg:mt-0 lg:w-1/2 space-y-3 pb-3">
          {/* PROFILE CARD  */}
          <ProfileCard />

          {/* LAST TRAVEL CARD  */}
          <LatestTravelCard />

          {/* CITY SETS CARD  */}
          <Suspense fallback={<CitiesViewLoadingStatus />}>
            <ErrorBoundary fallback={<p>Something went wrong</p>}>
              <CitiesView />
            </ErrorBoundary>
          </Suspense>

          <Footer />
        </div>
      </div>
    </HydrationBoundary>
  );
};

export default page;
