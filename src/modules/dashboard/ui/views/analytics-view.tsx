"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  Card,
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
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const chartConfig = {
  pv: { label: "浏览量 PV", color: "var(--primary)" },
  uv: { label: "访客 UV", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

export function AnalyticsView() {
  const trpc = useTRPC();
  const [days, setDays] = React.useState(30);
  const { data } = useSuspenseQuery(
    trpc.dashboard.getGa4Overview.queryOptions({ days }),
  );

  if (!data.configured) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>网站访问数据</CardTitle>
          <CardDescription>
            Google Analytics 4 尚未接入服务端
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            需要在 Google Cloud 创建服务账号，并将以下三个变量加入项目
            .env 后重启服务：
          </p>
          <pre className="rounded-md bg-muted p-3 text-xs leading-relaxed">
{`GA4_PROPERTY_ID=<GA4 属性 ID>
GA4_CLIENT_EMAIL=<服务账号邮箱>
GA4_PRIVATE_KEY=<私钥 PEM>`}
          </pre>
          <p>
            服务账号邮箱需在 GA4「管理 → 资产访问管理」中授予「查看者」权限。
          </p>
          <Button variant="outline" size="sm" className="w-fit" asChild>
            <a
              href="https://analytics.google.com/"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              前往 Google Analytics 查看
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalPv = data.totalPv.toLocaleString();
  const totalUv = data.totalUv.toLocaleString();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>网站访问数据</CardTitle>
        <CardDescription>
          近 {days} 天共 {totalPv} 次浏览 • {totalUv} 位访客
        </CardDescription>
        <div className="flex items-center gap-2">
          <Select
            value={String(days)}
            onValueChange={(v) => setDays(Number(v))}
          >
            <SelectTrigger className="w-32" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="7" className="rounded-lg">
                近 7 天
              </SelectItem>
              <SelectItem value="30" className="rounded-lg">
                近 30 天
              </SelectItem>
              <SelectItem value="90" className="rounded-lg">
                近 90 天
              </SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" asChild>
            <a href="https://analytics.google.com/" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              GA4 后台
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[220px] w-full"
        >
          <AreaChart data={data.daily}>
            <defs>
              <linearGradient id="fillPv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-pv)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-pv)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillUv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-uv)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-uv)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <Area
              dataKey="uv"
              type="natural"
              fill="url(#fillUv)"
              stroke="var(--color-uv)"
              strokeWidth={2}
              stackId="a"
            />
            <Area
              dataKey="pv"
              type="natural"
              fill="url(#fillPv)"
              stroke="var(--color-pv)"
              strokeWidth={2}
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
        {data.sources.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2">
            {data.sources.map((s) => (
              <span
                key={s.source}
                className="rounded-full border px-3 py-1 text-xs text-muted-foreground"
              >
                {s.source} · {s.sessions} 次访问
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
