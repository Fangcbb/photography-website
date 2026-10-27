/* eslint-disable @next/next/no-img-element */
"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { FileRejection, useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { s3Client } from "@/modules/s3/lib/upload-client";
import { keyToUrl } from "@/modules/s3/lib/key-to-url";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CloudUpload, ImageIcon, Upload, XIcon } from "lucide-react";

interface FileUploaderProps {
  onUploadSuccess?: (key: string) => void;
  folder?: string;
  value?: string;
}

const FileUploader = ({
  onUploadSuccess,
  folder = "uploads",
  value,
}: FileUploaderProps) => {
  const [files, setFiles] = useState<
    Array<{
      id: string;
      file: File;
      uploading: boolean;
      progress: number;
      key?: string;
      isDeleting: boolean;
      error: boolean;
      objectUrl?: string;
    }>
  >([]);
  const [imageLoading, setImageLoading] = useState(true);
  const [deletedKey, setDeletedKey] = useState<string | null>(null);

  const trpc = useTRPC();
  const createPresignedUrl = useMutation(
    trpc.s3.createPresignedUrl.mutationOptions()
  );

  const deleteFile = useMutation(trpc.s3.deleteFile.mutationOptions());

  const uploadFile = useCallback(
    async (file: File, fileId: string) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, uploading: true } : f))
      );

      try {
        const { publicUrl } = await s3Client.upload({
          file,
          folder,
          onProgress: (progress) => {
            setFiles((prev) =>
              prev.map((f) => (f.id === fileId ? { ...f, progress } : f))
            );
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

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  uploading: false,
                  progress: 100,
                  error: false,
                  key: publicUrl,
                }
              : f
          )
        );

        toast.success("文件上传成功");
        // new successful upload, clear any previously deleted key marker
        setDeletedKey(null);
        onUploadSuccess?.(publicUrl);
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  uploading: false,
                  error: true,
                  progress: 0,
                }
              : f
          )
        );

        toast.error(
          `Failed to upload ${file.name}: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
      }
    },
    [createPresignedUrl, onUploadSuccess, folder]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      // Do something with the files
      if (acceptedFiles.length > 0) {
        const newFiles = acceptedFiles.map((file) => ({
          id: crypto.randomUUID(),
          file,
          uploading: false,
          progress: 0,
          isDeleting: false,
          error: false,
          objectUrl: URL.createObjectURL(file),
        }));

        setFiles(newFiles);

        // when new file(s) selected, show image loading placeholder again
        setImageLoading(true);

        // Auto upload after adding files
        newFiles.forEach((fileItem) => {
          uploadFile(fileItem.file, fileItem.id);
        });
      }
    },
    [uploadFile]
  );

  useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.objectUrl) {
          URL.revokeObjectURL(f.objectUrl);
        }
      });
    };
  }, [files]);

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    if (fileRejections.length > 0) {
      const tooManyFiles = fileRejections.find(
        (fileRejection) => fileRejection.errors[0].code === "too-many-files"
      );

      const fileInvalidType = fileRejections.find(
        (fileRejection) => fileRejection.errors[0].code === "file-invalid-type"
      );

      if (tooManyFiles) {
        toast.error("文件过多");
      }

      if (fileInvalidType) {
        toast.error("不支持的文件类型");
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDropRejected,
    maxFiles: 1,
    noClick: true,
    noKeyboard: true,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    },
  });

  const handleDeleteFile = useCallback(
    async (key: string | undefined) => {
      if (!key) return;

      const fileToDelete = files.find((f) => f.key === key);

      if (fileToDelete?.uploading) {
        toast.error("上传中无法删除文件");
        return;
      }

      // DATA-03：value 是父表单当前已保存引用的对象。立即物理删除会导致
      // 「替换封面后取消编辑」原图永久丢失（DB 仍指向已删对象）。
      // 这里只解除引用，物理删除交给服务端延迟回收任务。
      if (key === value) {
        setDeletedKey(key);
        toast.success("已移除引用，原文件将在后台延迟回收");
        return;
      }

      try {
        setFiles((prev) =>
          prev.map((f) => (f.key === key ? { ...f, isDeleting: true } : f))
        );

        await deleteFile.mutateAsync({ key });

        setFiles((prev) => {
          const remaining = prev.filter((f) => f.key !== key);
          const removed = prev.find((f) => f.key === key);
          if (removed?.objectUrl) {
            URL.revokeObjectURL(removed.objectUrl);
          }
          return remaining;
        });

        // remember which key was deleted so we don't keep showing it via `value`
        setDeletedKey(key);

        toast.success("文件删除成功");
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) => (f.key === key ? { ...f, isDeleting: false } : f))
        );

        toast.error(
          error instanceof Error ? error.message : "文件删除失败"
        );
      }
    },
    [deleteFile, files]
  );

  const currentFile = files[0];
  const displayImageUrl = currentFile?.objectUrl
    ? currentFile.objectUrl
    : value && value !== deletedKey
    ? keyToUrl(value) || "/placeholder.svg"
    : undefined;

  const hasImage = !!displayImageUrl;
  const hasError = files.some((file) => file.error);

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "group relative overflow-hidden rounded-xl transition-all duration-200 border border-border",
          isDragActive
            ? "border-dashed border-primary bg-primary/5"
            : hasImage
            ? "border-border bg-background hover:border-primary/50"
            : "border-dashed border-muted-foreground/25 bg-muted/30 hover:border-primary hover:bg-primary/5"
        )}
      >
        <input {...getInputProps()} className="sr-only" />

        {hasImage ? (
          <div className="relative aspect-21/9 w-full">
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImageIcon className="size-5" />
                  <span className="text-sm">图片加载中…</span>
                </div>
              </div>
            )}

            <img
              src={displayImageUrl}
              alt="预览"
              className={cn(
                "h-full w-full object-cover transition-opacity duration-300",
                imageLoading ? "opacity-0" : "opacity-100"
              )}
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
            />

            <div className="absolute inset-0 bg-black/0 transition-all duration-200 group-hover:bg-black/40" />

            {!currentFile?.uploading && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div className="flex gap-2">
                  <Button
                    onClick={open}
                    variant="secondary"
                    size="sm"
                    className="bg-white/90 text-gray-900 hover:bg-white"
                    type="button"
                  >
                    <Upload className="mr-1 size-4" />更换图片</Button>
                  {(value || currentFile?.key) && (
                    <Button
                      onClick={() =>
                        value
                          ? handleDeleteFile(value)
                          : handleDeleteFile(currentFile?.key)
                      }
                      variant="destructive"
                      size="sm"
                      type="button"
                    >
                      <XIcon className="mr-1 size-4" />移除</Button>
                  )}
                </div>
              </div>
            )}

            {currentFile?.uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="relative">
                  <svg className="size-16 -rotate-90" viewBox="0 0 64 64">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-white/20"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${
                        2 * Math.PI * 28 * (1 - currentFile.progress / 100)
                      }`}
                      className="text-white transition-all duration-300"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {Math.round(currentFile.progress)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex aspect-21/9 w-full cursor-pointer flex-col items-center justify-center gap-4 p-8 text-center"
            onClick={open}
          >
            <div className="rounded-full bg-primary/10 p-4">
              <CloudUpload className="size-8 text-primary" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">上传封面图</h3>
              <p className="text-sm text-muted-foreground">拖拽图片到此处，或点击选择</p>
            </div>

            <Button variant="outline" size="sm" type="button">
              <ImageIcon className="mr-1 size-4" />浏览文件</Button>
          </div>
        )}
      </div>

      {hasError && (
        <Alert variant="destructive" className="mt-2">
          <AlertTitle>上传失败</AlertTitle>
          <AlertDescription>
            <p>上传出了点问题，请重试。</p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default FileUploader;
