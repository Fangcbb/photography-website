import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";
import { IMAGE_SIZE_LIMIT } from "@/constants";
import { toast } from "sonner";

interface UploadZoneProps {
  isUploading: boolean;
  onUpload: (file: File) => Promise<void>;
  uploadProgress: number;
}

export function UploadZone({
  isUploading,
  onUpload,
  uploadProgress,
}: UploadZoneProps) {
  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        await onUpload(file);
      }
    },
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/heic": [".heic"],
      "image/heif": [".heif"],
      "image/avif": [".avif"],
    },
    onDropRejected: (files) => {
      const tooLarge = files.some(file => file.errors.some(error => error.code === "file-too-large"));
      toast.error(tooLarge ? `照片不能超过 ${IMAGE_SIZE_LIMIT / 1024 / 1024}MB` : "请选择支持的图片格式：JPEG / PNG / WebP / HEIC / HEIF / AVIF");
    },
    disabled: isUploading,
    maxSize: IMAGE_SIZE_LIMIT,
    multiple: false,
  });

  return (
    <div className="w-full flex flex-col items-center space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-full size-32 bg-muted cursor-pointer",
          { "opacity-50": isUploading }
        )}
      >
        <input {...getInputProps()} disabled={isUploading} />
        <div className="flex flex-col items-center justify-center pt-5 pb-6 relative size-32">
          <UploadCloud className="size-20 opacity-70" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <h1 className={cn(isUploading && "opacity-50")}>拖拽照片文件到此处上传</h1>
        <p className="text-xs text-muted-foreground">照片在发布前仅自己可见。</p>
        <p className="text-xs text-muted-foreground">
          最大 {IMAGE_SIZE_LIMIT / 1024 / 1024} MB
        </p>
      </div>
      {isUploading ? (
        <Button
          disabled
          className="relative"
          style={{
            background: `linear-gradient(to right, rgb(34 197 94) ${uploadProgress}%, rgb(15 23 42) ${uploadProgress}%)`,
          }}
        >
          {uploadProgress >= 99 ? "正在确认存储，请稍候…" : `正在上传… ${uploadProgress}%`}
        </Button>
      ) : (
        <Button type="button" disabled={isUploading} onClick={open}>选择文件</Button>
      )}
    </div>
  );
}
