"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * 总览页的数据视图。
 *
 * 这些视图全部用 `useSuspenseQuery` 拉管理数据，**不能参与 SSR**：
 * 服务端渲染时 httpBatchLink 会请求自身 tRPC 端点，而此时无法携带
 * 浏览器 session cookie，protectedProcedure 直接抛 UNAUTHORIZED → 整页 500。
 *
 * 因此统一用 `dynamic(..., { ssr: false })` 只在客户端挂载后加载：
 * 浏览器端请求同源接口会自动带 cookie，不存在鉴权问题；
 * 总览页是后台管理页，也不需要 SSR 的 SEO 收益。
 */
const SectionCardsView = dynamic(
  () => import("./section-cards-view").then((m) => m.SectionCardsView),
  { ssr: false, loading: () => <BlockSkeleton height="h-[168px]" /> }
);

const ChartAreaView = dynamic(
  () => import("./chart-area-view").then((m) => m.ChartAreaView),
  { ssr: false, loading: () => <BlockSkeleton height="h-[420px]" /> }
);

const MapView = dynamic(
  () => import("./map-view").then((m) => m.MapView),
  { ssr: false, loading: () => <BlockSkeleton height="h-[520px]" /> }
);

function BlockSkeleton({ height }: { height: string }) {
  return <Skeleton className={`w-full ${height} rounded-xl`} />;
}

export function OverviewView() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCardsView />
      <ChartAreaView />
      <MapView />
    </div>
  );
}
