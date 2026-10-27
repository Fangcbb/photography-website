"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { IconTool } from "@tabler/icons-react";
import { toast } from "sonner";

export default function MaintenancePage() {
  const [enabled, setEnabled] = useState(false);
  const [enabledAt, setEnabledAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/maintenance");
      const data = await res.json();
      setEnabled(data.enabled);
      setEnabledAt(data.enabledAt);
    } catch {
      toast.error("Failed to fetch maintenance status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const toggleMaintenance = async () => {
    setToggling(true);
    try {
      const res = await fetch("/api/maintenance", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Request failed");
      }
      const data = await res.json();
      setEnabled(data.enabled);
      setEnabledAt(data.enabledAt);
      toast.success(
        data.enabled ? "维护模式已开启" : "维护模式已关闭，网站已恢复运营"
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "操作失败";
      toast.error(message);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="py-4 px-4 md:px-8">
        <p className="text-muted-foreground">加载中…</p>
      </div>
    );
  }

  return (
    <div className="py-4 px-4 md:px-8 flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">维护模式</h1>
        <p className="text-sm text-muted-foreground">
          One-click toggle to put the site into maintenance mode.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconTool className="size-5" />
            站点状态
          </CardTitle>
          <CardDescription>
            When maintenance mode is enabled, all public pages will show a
            maintenance notice. The dashboard remains accessible.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6 py-8">
          {/* Status indicator */}
          <div className="flex flex-col items-center gap-3">
            <span className="text-6xl">{enabled ? "🔴" : "🟢"}</span>
            <Badge
              variant={enabled ? "destructive" : "default"}
              className="text-base px-4 py-1"
            >
              {enabled ? "维护中" : "运营中"}
            </Badge>
            {enabled && enabledAt && (
              <p className="text-sm text-muted-foreground">
                开启时间: {new Date(enabledAt).toLocaleString("zh-CN")}
              </p>
            )}
          </div>

          {/* Toggle button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="lg"
                variant={enabled ? "default" : "destructive"}
                disabled={toggling}
                className="min-w-48 text-base h-12"
              >
                {toggling
                  ? "处理中..."
                  : enabled
                    ? "关闭维护模式"
                    : "开启维护模式"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {enabled ? "关闭维护模式？" : "开启维护模式？"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {enabled
                    ? "关闭后，网站将恢复正常访问，所有用户都可以浏览。"
                    : "开启后，所有公开页面将显示维护提示，仅管理员可通过 Dashboard 访问。确定继续？"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={toggleMaintenance}>
                  确认
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
