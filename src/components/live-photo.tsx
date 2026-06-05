"use client";

import { useEffect, useRef, useState } from "react";

interface LivePhotoProps {
  photoSrc: string;
  videoSrc: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
}

export function LivePhoto({
  photoSrc,
  videoSrc,
  alt = "",
  className = "",
  width,
  height,
}: LivePhotoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 预加载视频
    const video = videoRef.current;
    if (video) {
      video.addEventListener("loadeddata", () => setIsLoaded(true));
      return () => video.removeEventListener("loadeddata", () => setIsLoaded(true));
    }
  }, []);

  const handleMouseEnter = () => {
    if (videoRef.current && isLoaded) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  // 移动端长按播放
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseEnter();
  };

  const handleTouchEnd = () => {
    handleMouseLeave();
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden group ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 静态照片 */}
      <img
        src={photoSrc}
        alt={alt}
        width={width}
        height={height}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isPlaying ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* 视频层 */}
      <video
        ref={videoRef}
        src={videoSrc}
        muted
        playsInline
        loop
        preload="auto"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          isPlaying ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Live Photo 图标指示器 */}
      <div className="absolute top-3 right-3 z-10">
        <div className="relative">
          {/* 外圈圆环 */}
          <div className="w-8 h-8 rounded-full border-2 border-white/80 flex items-center justify-center">
            {/* 内圈实心圆 */}
            <div className="w-4 h-4 rounded-full bg-white/90" />
          </div>
          {/* 播放时的脉冲动画 */}
          {isPlaying && (
            <div className="absolute inset-0 rounded-full border-2 border-white animate-ping opacity-50" />
          )}
        </div>
      </div>

      {/* 悬停提示 */}
      {!isPlaying && (
        <div className="absolute bottom-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="text-xs text-white bg-black/50 px-2 py-1 rounded">
            悬停播放
          </span>
        </div>
      )}
    </div>
  );
}
