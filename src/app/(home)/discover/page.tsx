export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { trpc } from "@/trpc/server";
import { getQueryClient } from "@/trpc/server";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import {
  DiscoverView,
  DiscoverLoading,
} from "@/modules/discover/ui/views/discover-view";

export const metadata = {
  title: "发现 - 方斌的摄影作品集",
  description:
    "在交互式地图上探索照片。发现世界各地城市和地点的精彩摄影作品。",
  keywords: [
    // 照片发现
    "照片发现",
    "照片浏览",
    "照片搜索",
    "照片探索",
    "摄影作品浏览",
    // 地图相关
    "照片地图",
    "摄影地图",
    "旅行地图",
    "交互式地图",
    "地理位置",
    // 主题相关
    "城市摄影",
    "地点摄影",
    "旅行摄影",
    "街头摄影",
    "风光摄影",
    // 其他
    "摄影作品集",
    "照片分类",
    "摄影标签",
    "照片位置",
  ],
};

const page = () => {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(trpc.discover.getManyPhotos.queryOptions({}));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<DiscoverLoading />}>
        <ErrorBoundary fallback={<p>Error</p>}>
          <DiscoverView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default page;
