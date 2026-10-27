"use client";

import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTRPC } from "@/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";

export function SectionCardsView() {
  const trpc = useTRPC();
  const { data: stats } = useSuspenseQuery(
    trpc.dashboard.getDashboardStats.queryOptions()
  );
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>照片总数</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.totalPhotos.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {stats.thisYearPercentChange >= 0 ? (
                <>
                  <IconTrendingUp />+{stats.thisYearPercentChange}%
                </>
              ) : (
                <>
                  <IconTrendingDown />
                  {stats.thisYearPercentChange}%
                </>
              )}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {stats.thisYearPercentChange >= 0
              ? "今年增长"
              : "今年下降"}{" "}
            <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {Math.abs(stats.thisYearPercentChange)}%{" "}
            较去年{stats.thisYearPercentChange >= 0 ? "上升" : "下降"}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>今年照片</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.thisYearPhotos.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {stats.thisYearPercentChange >= 0 ? (
                <>
                  <IconTrendingUp />+{stats.thisYearPercentChange}%
                </>
              ) : (
                <>
                  <IconTrendingDown />
                  {stats.thisYearPercentChange}%
                </>
              )}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {stats.thisYearPercentChange >= 0
              ? "同比增长"
              : "同比下降"}{" "}
            <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {Math.abs(stats.thisYearPercentChange)}%{" "}
            较去年{stats.thisYearPercentChange >= 0 ? "上升" : "下降"}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>到访国家</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.totalCountries}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {stats.countriesPercentChange >= 0 ? (
                <>
                  <IconTrendingUp />+{stats.countriesPercentChange}%
                </>
              ) : (
                <>
                  <IconTrendingDown />
                  {stats.countriesPercentChange}%
                </>
              )}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {stats.countriesPercentChange >= 0
              ? "新增国家"
              : "国家减少"}{" "}
            <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {Math.abs(stats.countriesPercentChange)}%{" "}
            较去年{stats.countriesPercentChange >= 0 ? "上升" : "下降"}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>城市总数</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.totalCities}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {stats.citiesPercentChange >= 0 ? (
                <>
                  <IconTrendingUp />+{stats.citiesPercentChange}%
                </>
              ) : (
                <>
                  <IconTrendingDown />
                  {stats.citiesPercentChange}%
                </>
              )}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {stats.citiesPercentChange >= 0 ? "新增城市" : "城市减少"}{" "}
            <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {Math.abs(stats.citiesPercentChange)}%{" "}
            较去年{stats.citiesPercentChange >= 0 ? "上升" : "下降"}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export const SectionCardsLoading = () => {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="@container/card">
          <CardHeader>
            <CardDescription>
              <Skeleton className="h-4 w-20" />
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              <Skeleton className="h-8 w-32 mt-2" />
            </CardTitle>
            <CardAction>
              <Skeleton className="h-8 w-24" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="text-muted-foreground">
              <Skeleton className="h-4 w-32" />
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};
