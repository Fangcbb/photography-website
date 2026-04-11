import { Suspense } from "react";
import { trpc } from "@/trpc/server";
import { getQueryClient } from "@/trpc/server";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import {
  VideoListView,
  VideoListLoadingStatus,
} from "@/modules/video/ui/views/video-list-view";

export const metadata = {
  title: "视频 - 方斌的摄影作品集",
  description: "观看方斌的旅行视频、摄影技巧和幕后花絮。通过视频探索美丽的风景目的地。",
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

const page = () => {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(trpc.video.getMany.queryOptions({ limit: 20 }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<VideoListLoadingStatus />}>
        <ErrorBoundary fallback={<p>Error</p>}>
          <VideoListView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default page;
