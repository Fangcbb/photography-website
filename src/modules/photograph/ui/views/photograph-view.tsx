"use client";

import BlurImage from "@/components/blur-image";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PhotoPreviewCard } from "@/modules/photos/ui/components/photo-preview-card";
import { keyToUrl } from "@/modules/s3/lib/key-to-url";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";

interface PhotographViewProps {
  id: string;
}

export const PhotographView = ({ id: initialId }: PhotographViewProps) => {
  const router = useRouter();
  const trpc = useTRPC();
  const [currentId, setCurrentId] = useState(initialId);
  const [showArrows, setShowArrows] = useState(true); // 箭头显示状态
  
  // 自动隐藏箭头的 timer
  const hideArrowsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 重置箭头隐藏计时器
  const resetHideArrowsTimer = useCallback(() => {
    setShowArrows(true);
    
    // 清除之前的 timer
    if (hideArrowsTimerRef.current) {
      clearTimeout(hideArrowsTimerRef.current);
    }
    
    // 设置新的 5 秒后隐藏
    hideArrowsTimerRef.current = setTimeout(() => {
      setShowArrows(false);
    }, 5000);
  }, []);

  // 初始显示箭头，5 秒后隐藏
  useEffect(() => {
    resetHideArrowsTimer();
    
    return () => {
      if (hideArrowsTimerRef.current) {
        clearTimeout(hideArrowsTimerRef.current);
      }
    };
  }, [resetHideArrowsTimer]);

  // 获取同城市照片列表
  const { data: cityPhotosData } = useQuery(
    trpc.home.getPhotosByCity.queryOptions({ currentPhotoId: currentId }),
  );

  // 获取当前照片详情
  const { data } = useQuery(
    trpc.home.getPhotoById.queryOptions({ id: currentId }),
  );

  // 预加载相邻照片
  useEffect(() => {
    if (cityPhotosData?.photos) {
      const { currentIndex, photos } = cityPhotosData;
      
      // 预加载下一张
      if (currentIndex < photos.length - 1) {
        const nextPhoto = photos[currentIndex + 1];
        // 触发预加载
        trpc.home.getPhotoById.queryOptions({ id: nextPhoto.id });
      }
      
      // 预加载上一张
      if (currentIndex > 0) {
        const prevPhoto = photos[currentIndex - 1];
        trpc.home.getPhotoById.queryOptions({ id: prevPhoto.id });
      }
    }
  }, [cityPhotosData, trpc.home]);

  // 返回操作
  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

  // 键盘导航
  const handlePrev = useCallback(() => {
    if (cityPhotosData?.hasPrev && cityPhotosData.currentIndex > 0) {
      const prevPhoto = cityPhotosData.photos[cityPhotosData.currentIndex - 1];
      setCurrentId(prevPhoto.id);
      router.replace(`/p/${prevPhoto.id}`, { scroll: false });
    }
    
    // 显示箭头并重置隐藏计时器
    resetHideArrowsTimer();
  }, [cityPhotosData, router, resetHideArrowsTimer]);

  const handleNext = useCallback(() => {
    if (cityPhotosData?.hasNext && cityPhotosData.currentIndex < cityPhotosData.photos.length - 1) {
      const nextPhoto = cityPhotosData.photos[cityPhotosData.currentIndex + 1];
      setCurrentId(nextPhoto.id);
      router.replace(`/p/${nextPhoto.id}`, { scroll: false });
    }
    
    // 显示箭头并重置隐藏计时器
    resetHideArrowsTimer();
  }, [cityPhotosData, router, resetHideArrowsTimer]);

  // 触摸滑动支持
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    // 触摸时显示箭头
    resetHideArrowsTimer();
  }, [resetHideArrowsTimer]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (diff > threshold) {
      handleNext();
    } else if (diff < -threshold) {
      handlePrev();
    }
  }, [handleNext, handlePrev]);

  // 鼠标移动时显示箭头
  const handleMouseMove = useCallback(() => {
    resetHideArrowsTimer();
  }, [resetHideArrowsTimer]);

  // 键盘事件监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "Escape") {
        handleBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext, handleBack]);

  // 当 initialId 变化时同步 currentId
  useEffect(() => {
    if (initialId !== currentId) {
      setCurrentId(initialId);
    }
  }, [initialId]);

  // 加载中状态
  if (!data || !cityPhotosData) {
    return <LoadingState />;
  }

  const imageInfo = {
    width: data.width,
    height: data.height,
    blurhash: data.blurData,
  };

  const hasMultiplePhotos = cityPhotosData && cityPhotosData.photos.length > 1;
  const hasPrev = cityPhotosData?.hasPrev ?? false;
  const hasNext = cityPhotosData?.hasNext ?? false;

  return (
    <div 
      className="h-screen flex justify-center items-center relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
          src={keyToUrl(data.url, "fangb")}
          alt={data.title || "Photo background"}
          fill
          sizes="100vw"
          blurhash={data.blurData}
          className="object-cover blur-lg scale-110"
        />
        <div className="absolute inset-0 bg-background/20" />
      </div>

      {/* 照片主体 */}
      <PhotoPreviewCard
        url={data.url}
        title={data.title}
        imageInfo={imageInfo}
        make={data.make}
        model={data.model}
        lensModel={data.lensModel}
        focalLength35mm={data.focalLength35mm}
        fNumber={data.fNumber}
        exposureTime={data.exposureTime}
        iso={data?.iso}
        dateTimeOriginal={
          data?.dateTimeOriginal ? data.dateTimeOriginal.toString() : undefined
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
