"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";

export const description = "每月照片数量图表";

const chartConfig = {
  photos: {
    label: "照片",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

export function ChartAreaView() {
  const trpc = useTRPC();
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("3y");

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("1y");
    }
  }, [isMobile]);

  // Get years from timeRange
  const years = React.useMemo(() => {
    switch (timeRange) {
      case "1y":
        return 1;
      case "3y":
        return 3;
      case "5y":
        return 5;
      default:
        return 3;
    }
  }, [timeRange]);

  const { data: photosCountByMonth } = useSuspenseQuery(
    trpc.dashboard.getPhotosCountByMonth.queryOptions({ years })
  );

  // Transform data for chart
  const chartData = React.useMemo(() => {
    return photosCountByMonth.map((item) => ({
      date: item.month + "-01", // Add day for proper date parsing
      photos: item.count,
    }));
  }, [photosCountByMonth]);

  // Calculate total photos and peak month
  const totalPhotos = React.useMemo(() => {
    return photosCountByMonth.reduce((sum, item) => sum + item.count, 0);
  }, [photosCountByMonth]);

  const peakMonth = React.useMemo(() => {
    if (photosCountByMonth.length === 0) return null;
    const peak = photosCountByMonth.reduce((max, item) =>
      item.count > max.count ? item : max
    );
    return {
      month: new Date(peak.month + "-01").toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      count: peak.count,
    };
  }, [photosCountByMonth]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>照片动态</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {years} 年内共拍摄 {totalPhotos.toLocaleString()} 张照片
            {peakMonth && (
              <span className="ml-2 text-muted-foreground">
                • 高峰：{peakMonth.month}（{peakMonth.count} 张）
              </span>
            )}
          </span>
          <span className="@[540px]/card:hidden">
            {totalPhotos.toLocaleString()} photos • Last {years}y
          </span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="1y">近 1 年</ToggleGroupItem>
            <ToggleGroupItem value="3y">近 3 年</ToggleGroupItem>
            <ToggleGroupItem value="5y">近 5 年</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="选择一个值"
            >
              <SelectValue placeholder="近 3 年" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="1y" className="rounded-lg">
                1 Year
              </SelectItem>
              <SelectItem value="3y" className="rounded-lg">
                3 Years
              </SelectItem>
              <SelectItem value="5y" className="rounded-lg">
                5 Years
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillPhotos" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-photos)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-photos)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  year: years > 1 ? "2-digit" : undefined,
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              defaultIndex={isMobile ? -1 : 10}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    });
                  }}
                  formatter={(value) => [
                    `${value} photo${value !== 1 ? "s" : ""}`,
                    "照片",
                  ]}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="photos"
              type="natural"
              fill="url(#fillPhotos)"
              stroke="var(--color-photos)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export const ChartAreaLoading = () => {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>照片动态</CardTitle>
        <CardDescription>
          <Skeleton className="h-4 w-24" />
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={"3y"}
            onValueChange={() => {}}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="1y">近 1 年</ToggleGroupItem>
            <ToggleGroupItem value="3y">近 3 年</ToggleGroupItem>
            <ToggleGroupItem value="5y">近 5 年</ToggleGroupItem>
          </ToggleGroup>
          <Select value={"3y"} onValueChange={() => {}}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="选择一个值"
            >
              <SelectValue placeholder="近 3 年" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="1y" className="rounded-lg">
                1 Year
              </SelectItem>
              <SelectItem value="3y" className="rounded-lg">
                3 Years
              </SelectItem>
              <SelectItem value="5y" className="rounded-lg">
                5 Years
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <div className="w-full h-[250px] bg-muted rounded-lg animate-pulse" />
      </CardContent>
    </Card>
  );
};
