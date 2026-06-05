import { useState } from "react";
import { toast } from "sonner";
import { s3Client } from "@/modules/s3/lib/upload-client";
import {
  type TExifData,
  type TImageInfo,
  getPhotoExif,
  getImageInfo,
} from "@/modules/photos/lib/utils";
import { DEFAULT_PHOTOS_UPLOAD_FOLDER } from "@/constants";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

interface UsePhotoUploadProps {
  folder?: string;
  onUploadSuccess?: (
    url: string,
    exif: TExifData | null,
    imageInfo: TImageInfo,
    livePhotoVideoUrl?: string
  ) => void;
}

export function usePhotoUpload({
  folder = DEFAULT_PHOTOS_UPLOAD_FOLDER,
  onUploadSuccess,
}: UsePhotoUploadProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [exif, setExif] = useState<TExifData | null>(null);
  const [imageInfo, setImageInfo] = useState<TImageInfo | null>(null);

  const trpc = useTRPC();
  const createPresignedUrl = useMutation(
    trpc.s3.createPresignedUrl.mutationOptions()
  );

  const handleUpload = async (file: File, livePhotoVideo?: File) => {
    try {
      setIsUploading(true);

      const [exifData, imageInfo] = await Promise.all([
        getPhotoExif(file),
        getImageInfo(file),
      ]);
      setExif(exifData);
      setImageInfo(imageInfo);

      // 上传主照片
      const { publicUrl } = await s3Client.upload({
        file,
        folder,
        onProgress: (progress) => {
          setUploadProgress(progress);
        },
        getUploadUrl: async ({ filename, contentType, folder }) => {
          const data = await createPresignedUrl.mutateAsync({
            filename,
            contentType,
            size: file.size,
            folder,
          });

          return {
            uploadUrl: data.presignedUrl,
            publicUrl: data.key,
          };
        },
      });

      // 上传 Live Photo 视频（如果有）
      let livePhotoVideoUrl: string | undefined;
      if (livePhotoVideo) {
        const videoFolder = "live-photos";
        const { publicUrl: videoUrl } = await s3Client.upload({
          file: livePhotoVideo,
          folder: videoFolder,
          onProgress: () => {},
          getUploadUrl: async ({ filename, contentType, folder }) => {
            const data = await createPresignedUrl.mutateAsync({
              filename,
              contentType,
              size: livePhotoVideo.size,
              folder,
            });

            return {
              uploadUrl: data.presignedUrl,
              publicUrl: data.key,
            };
          },
        });
        livePhotoVideoUrl = videoUrl;
      }

      setUploadedImageUrl(publicUrl);
      toast.success("Photo uploaded successfully!");
      onUploadSuccess?.(publicUrl, exifData, imageInfo, livePhotoVideoUrl);
    } catch (error) {
      setExif(null);
      setImageInfo(null);
      setUploadedImageUrl(null);

      console.error("Upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload photo"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return {
    isUploading,
    uploadProgress,
    uploadedImageUrl,
    exif,
    imageInfo,
    handleUpload,
  };
}
