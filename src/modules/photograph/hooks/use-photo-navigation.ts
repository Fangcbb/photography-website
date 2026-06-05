"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

interface PhotoNavigationOptions {
  initialPhotoId: string;
}

interface PhotoNavigationResult {
  // 当前照片 ID
  currentPhotoId: string;
  
  // 照片数据
  currentPhoto: any;
  cityPhotosData: any;
  
  // 导航状态
  hasPrev: boolean;
  hasNext: boolean;
  hasMultiplePhotos: boolean;
  
  // 操作方法
  handlePrev: () => void;
  handleNext: () => void;
  handleBack: () => void;
  
  // UI 状态
  showArrows: boolean;
  
  // 触摸事件处理器
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  
  // 鼠标移动处理器
  handleMouseMove: () => void;
}

export function usePhotoNavigation({
  initialPhotoId,
}: PhotoNavigationOptions): PhotoNavigationResult {
  const router = useRouter();
  const trpc = useTRPC();
  const [currentId, setCurrentId] = useState(initialPhotoId);
  const [showArrows, setShowArrows] = useState(true);
  
  // 自动隐藏箭头的 timer
  const hideArrowsTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 触摸滑动
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // 重置箭头隐藏计时器
  const resetHideArrowsTimer = useCallback(() => {
    setShowArrows(true);
    
    if (hideArrowsTimerRef.current) {
      clearTimeout(hideArrowsTimerRef.current);
    }
    
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
  const { data: currentPhoto } = useQuery(
    trpc.home.getPhotoById.queryOptions({ id: currentId }),
  );

  // 预加载相邻照片
  useEffect(() => {
    if (cityPhotosData?.photos) {
      const { currentIndex, photos } = cityPhotosData;
      
      if (currentIndex < photos.length - 1) {
        trpc.home.getPhotoById.queryOptions({ id: photos[currentIndex + 1].id });
      }
      
      if (currentIndex > 0) {
        trpc.home.getPhotoById.queryOptions({ id: photos[currentIndex - 1].id });
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

  // 上一张
  const handlePrev = useCallback(() => {
    if (cityPhotosData?.hasPrev && cityPhotosData.currentIndex > 0) {
      const prevPhoto = cityPhotosData.photos[cityPhotosData.currentIndex - 1];
      setCurrentId(prevPhoto.id);
      router.replace(`/p/${prevPhoto.id}`, { scroll: false });
    }
    resetHideArrowsTimer();
  }, [cityPhotosData, router, resetHideArrowsTimer]);

  // 下一张
  const handleNext = useCallback(() => {
    if (cityPhotosData?.hasNext && cityPhotosData.currentIndex < cityPhotosData.photos.length - 1) {
      const nextPhoto = cityPhotosData.photos[cityPhotosData.currentIndex + 1];
      setCurrentId(nextPhoto.id);
      router.replace(`/p/${nextPhoto.id}`, { scroll: false });
    }
    resetHideArrowsTimer();
  }, [cityPhotosData, router, resetHideArrowsTimer]);

  // 触摸事件
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
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

  // 键盘事件
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
    if (initialPhotoId !== currentId) {
      setCurrentId(initialPhotoId);
    }
  }, [initialPhotoId]);

  // 派生状态
  const hasMultiplePhotos = cityPhotosData && cityPhotosData.photos.length > 1;
  const hasPrev = cityPhotosData?.hasPrev ?? false;
  const hasNext = cityPhotosData?.hasNext ?? false;

  return {
    currentPhotoId: currentId,
    currentPhoto,
    cityPhotosData,
    hasPrev,
    hasNext,
    hasMultiplePhotos: hasMultiplePhotos ?? false,
    handlePrev,
    handleNext,
    handleBack,
    showArrows,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    handleMouseMove,
  };
}
