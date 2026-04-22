"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { VideoUploadModal } from "../components/video-upload-modal";
import { toast } from "sonner";
import { keyToUrl } from "@/modules/s3/lib/key-to-url";

export const DashboardVideosView = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const { data: videos } = useSuspenseQuery(trpc.video.getAll.queryOptions({}));

  const deleteMutation = useMutation(
    trpc.video.delete.mutationOptions({
      onSuccess: () => {
        toast.success("视频已删除");
        queryClient.invalidateQueries({ queryKey: trpc.video.getAll.queryKey() });
      },
      onError: () => {
        toast.error("删除失败");
      },
    })
  );

  const updateVisibilityMutation = useMutation(
    trpc.video.update.mutationOptions({
      onSuccess: () => {
        toast.success("状态已更新");
        queryClient.invalidateQueries({ queryKey: trpc.video.getAll.queryKey() });
      },
    })
  );

  const handleDelete = (id: string) => {
    if (confirm("确定要删除这个视频吗？")) {
      deleteMutation.mutate({ id });
    }
  };

  const toggleVisibility = (id: string, currentVisibility: string) => {
    updateVisibilityMutation.mutate({
      id,
      visibility: currentVisibility === "public" ? "private" : "public",
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">视频管理</h1>
        <Button onClick={() => setUploadModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          上传视频
        </Button>
      </div>

      {videos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无视频，点击"上传视频"添加第一个视频
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <Card key={video.id} className="overflow-hidden">
              <div className="aspect-video bg-muted relative">
                {video.thumbnailUrl ? (
                  <img
                    src={keyToUrl(video.thumbnailUrl)}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <video
                      src={keyToUrl(video.videoUrl)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    onClick={() => toggleVisibility(video.id, video.visibility)}
                  >
                    {video.visibility === "public" ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {formatDuration(video.videoDuration || 0)}
                </div>
              </div>
              <CardHeader className="p-4">
                <CardTitle className="text-base line-clamp-1">{video.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {video.description || "暂无描述"}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span>{video.viewCount} 次观看</span>
                  <span>{formatFileSize(video.videoSize)}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(`/blog/${video.slug}`, "_blank")}
                  >
                    预览
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(video.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <VideoUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
      />
    </div>
  );
};

export const LoadingStatus = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="aspect-video" />
            <CardHeader className="p-4">
              <Skeleton className="h-5 w-3/4" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3 mb-3" />
              <div className="flex gap-2">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 w-8" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export const ErrorStatus = () => {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-muted-foreground">加载失败，请刷新页面重试</p>
    </div>
  );
};
