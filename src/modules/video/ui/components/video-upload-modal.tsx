"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";

interface VideoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const VideoUploadModal = ({ open, onOpenChange }: VideoUploadModalProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [dateTimeOriginal, setDateTimeOriginal] = useState<string>("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFile, setUploadingFile] = useState<string>("");

  // 获取 S3 上传 URL
  const createVideoUploadUrl = useMutation(
    trpc.s3.createPresignedUrl.mutationOptions()
  );
  const createThumbnailUploadUrl = useMutation(
    trpc.s3.createPresignedUrl.mutationOptions()
  );

  // 创建视频记录
  const createVideo = useMutation(
    trpc.video.create.mutationOptions({
      onSuccess: () => {
        toast.success("视频上传成功");
        queryClient.invalidateQueries({ queryKey: trpc.video.getAll.queryKey() });
        handleClose();
      },
      onError: () => {
        toast.error("创建视频记录失败");
        setUploading(false);
      },
    })
  );

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoPreview(url);

      // 自动从文件名提取标题（去除扩展名）
      if (!title.trim()) {
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        setTitle(fileName);
      }
    }
  };

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const url = URL.createObjectURL(file);
      setThumbnailPreview(url);
    }
  };

  const uploadFile = async (file: File, type: "video" | "thumbnail") => {
    // 生成文件名
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const folder = type === "video" ? "videos" : "video-thumbnails";

    // 设置当前上传文件
    setUploadingFile(type === "video" ? "视频" : "缩略图");

    // 获取上传 URL
    const uploadUrlMutation = type === "video" ? createVideoUploadUrl : createThumbnailUploadUrl;
    const { presignedUrl, key } = await uploadUrlMutation.mutateAsync({
      filename: fileName,
      contentType: file.type as any,
      size: file.size,
      folder,
    });

    // 使用 XMLHttpRequest 上传文件以跟踪进度
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(key);
        } else {
          reject(new Error(`上传 ${type} 失败`));
        }
      };

      xhr.onerror = () => {
        reject(new Error(`上传 ${type} 失败`));
      };

      xhr.open("PUT", presignedUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        resolve(Math.floor(video.duration));
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => resolve(0);
      video.src = URL.createObjectURL(file);
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("请输入标题");
      return;
    }
    if (!videoFile) {
      toast.error("请选择视频文件");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadingFile("");

    try {
      // 上传视频
      const videoKey = await uploadFile(videoFile, "video");

      // 上传缩略图（可选）
      let thumbnailKey = "";
      if (thumbnailFile) {
        thumbnailKey = await uploadFile(thumbnailFile, "thumbnail");
      }

      // 获取视频时长
      const duration = await getVideoDuration(videoFile);

      // 创建视频记录
      await createVideo.mutateAsync({
        title,
        description,
        videoUrl: videoKey,
        thumbnailUrl: thumbnailKey || undefined,
        videoDuration: duration,
        videoSize: videoFile.size,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        visibility: "public",  // 默认公开
        dateTimeOriginal: dateTimeOriginal ? new Date(dateTimeOriginal) : null,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        city: city || undefined,
      });
    } catch (error) {
      toast.error("上传失败，请重试");
      setUploading(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setTags("");
    setDateTimeOriginal("");
    setLatitude("");
    setLongitude("");
    setCity("");
    setVideoFile(null);
    setThumbnailFile(null);
    setVideoPreview("");
    setThumbnailPreview("");
    setUploading(false);
    setUploadProgress(0);
    setUploadingFile("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>上传视频</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 视频文件选择 */}
          <div className="space-y-2">
            <Label>视频文件 *</Label>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => videoInputRef.current?.click()}
              className="w-full h-32 border-dashed"
            >
              {videoPreview ? (
                <video
                  src={videoPreview}
                  className="h-full w-full object-contain rounded"
                  controls
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <span>点击选择视频文件</span>
                </div>
              )}
            </Button>
          </div>

          {/* 缩略图选择 */}
          <div className="space-y-2">
            <Label>缩略图（可选）</Label>
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/*"
              onChange={handleThumbnailSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => thumbnailInputRef.current?.click()}
              className="w-full h-20 border-dashed"
            >
              {thumbnailPreview ? (
                <img
                  src={thumbnailPreview}
                  alt="缩略图预览"
                  className="h-full w-full object-contain rounded"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-6 w-6" />
                  <span className="text-sm">点击选择缩略图</span>
                </div>
              )}
            </Button>
          </div>

          {/* 标题 */}
          <div className="space-y-2">
            <Label htmlFor="title">标题 *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入视频标题"
            />
          </div>

          {/* 描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入视频描述"
              rows={3}
            />
          </div>

          {/* 拍摄时间 */}
          <div className="space-y-2">
            <Label htmlFor="dateTime">拍摄时间</Label>
            <Input
              id="dateTime"
              type="datetime-local"
              value={dateTimeOriginal}
              onChange={(e) => setDateTimeOriginal(e.target.value)}
            />
          </div>

          {/* 拍摄地点 */}
          <div className="space-y-2">
            <Label>拍摄地点（可选）</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="城市"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <Input
                placeholder="纬度"
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
              <Input
                placeholder="经度"
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          </div>

          {/* 标签 */}
          <div className="space-y-2">
            <Label htmlFor="tags">标签（逗号分隔）</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="旅行, 风光, 摄影"
            />
          </div>

          {/* 按钮 */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  上传中...
                </>
              ) : (
                "上传"
              )}
            </Button>
          </div>

          {/* 上传进度条 */}
          {uploading && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>正在上传{uploadingFile}...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
