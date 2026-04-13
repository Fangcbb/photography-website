"use client";

import BlurImage from "@/components/blur-image";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PhotoPreviewCard } from "@/modules/photos/ui/components/photo-preview-card";
import { keyToUrl } from "@/modules/s3/lib/key-to-url";
import { usePhotoNavigation } from "@/modules/photograph/hooks/use-photo-navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

interface PhotographViewProps {
  id: string;
}

export const PhotographView = ({ id: initialId }: PhotographViewProps) => {
  const {
    currentPhoto,
    cityPhotosData,
    hasPrev,
    hasNext,
    hasMultiplePhotos,
    handlePrev,
    handleNext,
    handleBack,
    showArrows,
    touchHandlers,
    handleMouseMove,
  } = usePhotoNavigation({
    initialPhotoId: initialId,
  });

  // 加载中状态
  if (!currentPhoto || !cityPhotosData) {
    return <LoadingState />;
  }

  const imageInfo = {
    width: currentPhoto.width,
    height: currentPhoto.height,
    blurhash: currentPhoto.blurData,
  };

  return (
    <div 
      className="h-screen flex justify-center items-center relative overflow-hidden"
      {...touchHandlers}
      onMouseMove={handleMouseMove}
    >
      {/* 返回按钮 */}
      <div 
        className={`absolute top-4 left-4 z-10 transition-opacity duration-300 ${showArrows ? 'opacity-100' : 'opacity-0'}`}
      >
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="back (Esc)"
          onClick={handleBack}
          className="bg-black/30 hover:bg-black/50 text-white/80 hover:text-white backdrop-blur-sm border-white/20"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* 左箭头 - 仅 PC 端显示 */}
      {hasMultiplePhotos && (
        <div 
          className={`hidden md:block absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-300 ${showArrows ? 'opacity-100' : 'opacity-0'}`}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous photo (←)"
            disabled={!hasPrev}
            onClick={handlePrev}
            className="h-10 w-10 rounded-full bg-black/30 hover:bg-black/50 text-white/80 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* 右箭头 - 仅 PC 端显示 */}
      {hasMultiplePhotos && (
        <div 
          className={`hidden md:block absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-300 ${showArrows ? 'opacity-100' : 'opacity-0'}`}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next photo (→)"
            disabled={!hasNext}
            onClick={handleNext}
            className="h-10 w-10 rounded-full bg-black/30 hover:bg-black/50 text-white/80 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm transition-all"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* 移动端底部导航箭头 */}
      {hasMultiplePhotos && (
        <div 
          className={`md:hidden absolute bottom-16 left-0 right-0 z-10 flex justify-center gap-4 transition-opacity duration-300 ${showArrows ? 'opacity-100' : 'opacity-0'}`}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous photo"
            disabled={!hasPrev}
            onClick={handlePrev}
            className="h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next photo"
            disabled={!hasNext}
            onClick={handleNext}
            className="h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* 背景模糊图 */}
      <div className="absolute inset-0 -z-10">
        <BlurImage
          src={keyToUrl(currentPhoto.url, "fangb")}
          alt={currentPhoto.title || "Photo background"}
          fill
          sizes="100vw"
          blurhash={currentPhoto.blurData}
          className="object-cover blur-lg scale-110"
        />
        <div className="absolute inset-0 bg-background/20" />
      </div>

      {/* 照片主体 */}
      <PhotoPreviewCard
        url={currentPhoto.url}
        title={currentPhoto.title}
        imageInfo={imageInfo}
        make={currentPhoto.make}
        model={currentPhoto.model}
        lensModel={currentPhoto.lensModel}
        focalLength35mm={currentPhoto.focalLength35mm}
        fNumber={currentPhoto.fNumber}
        exposureTime={currentPhoto.exposureTime}
        iso={currentPhoto?.iso}
        dateTimeOriginal={
          currentPhoto?.dateTimeOriginal ? currentPhoto.dateTimeOriginal.toString() : undefined
        }
      />
    </div>
  );
};

export const LoadingState = () => {
  const aspectRatio = 3 / 2;
  const containerWidth = `min(65vh * ${aspectRatio}, 90vw)`;

  return (
    <div className="h-screen flex justify-center items-center relative overflow-hidden bg-background">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-muted blur-2xl scale-110" />
        <div className="absolute inset-0 bg-background/40" />
      </div>

      <div className="flex justify-center pb-14 w-full">
        <div
          className="bg-background relative shadow-2xl rounded-lg w-full border"
          style={{
            maxWidth: containerWidth,
            aspectRatio: aspectRatio,
            maxHeight: "65dvh",
          }}
        >
          <Skeleton className="w-full h-full rounded-lg" />

          <div className="absolute -bottom-12 left-0 px-6 py-3 w-full bg-background flex justify-between items-center select-none shadow-md rounded-b-lg border-t">
            <div className="flex flex-col text-center gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>

            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="hidden sm:flex flex-col gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
