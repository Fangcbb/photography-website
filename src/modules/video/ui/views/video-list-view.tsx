"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import CardContainer from "@/components/card-container";
import Footer from "@/components/footer";
import ContactCard from "@/components/contact-card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Play, Clock, Eye } from "lucide-react";
import { keyToUrl } from "@/modules/s3/lib/key-to-url";
import Carousel from "@/components/photo-carousel";
import { useState, useRef, useEffect } from "react";

// 视频卡片组件（单独提取以使用 hooks）
const VideoCard = ({ video, formatDuration }: { video: any; formatDuration: (seconds?: number) => string }) => {
  const [isHovering, setIsHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasStartedPlay = useRef(false);

  useEffect(() => {
    if (!videoRef.current) return;

    if (isHovering && !hasStartedPlay.current) {
      hasStartedPlay.current = true;
      videoRef.current.src = keyToUrl(video.videoUrl);
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    } else if (!isHovering && hasStartedPlay.current) {
      hasStartedPlay.current = false;
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }, [isHovering, video.videoUrl]);

  return (
    <Link
      href={`/blog/${video.slug}`}
      className="aspect-video rounded-xl overflow-hidden relative group"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {video.thumbnailUrl && !isHovering ? (
        <img
          src={keyToUrl(video.thumbnailUrl)}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          loop
          preload="none"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
        <h3 className="font-semibold line-clamp-2 mb-1">{video.title}</h3>
        <div className="flex items-center gap-3 text-xs opacity-80">
          {video.videoDuration && (
            <span>{formatDuration(video.videoDuration)}</span>
          )}
          <span>{video.viewCount} 次观看</span>
        </div>
      </div>
    </Link>
  );
};

export const VideoListView = () => {
  const trpc = useTRPC();
  const { data: { data: videos } } = useSuspenseQuery(trpc.video.getMany.queryOptions({ limit: 20 }));

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-3 lg:gap-0 lg:flex-row w-full">
      {/* LEFT CONTENT - Fixed */}
      <div className="w-full h-[50vh] lg:w-1/2 lg:fixed lg:top-0 lg:left-0 md:h-[80vh] lg:h-screen p-0 lg:p-3 group">
        {videos.length > 0 ? (
          <Carousel
            className="w-full h-full rounded-xl"
            containerClassName="h-full"
            autoplayDelay={5000}
          >
            {videos.map((video) => (
              <div key={video.id} className="flex-[0_0_100%] h-full relative">
                <Link
                  href={`/blog/${video.slug}`}
                  className="block w-full h-full relative group"
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={keyToUrl(video.thumbnailUrl)}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={keyToUrl(video.videoUrl)}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h2 className="text-2xl font-bold mb-2">{video.title}</h2>
                    <p className="text-sm opacity-80 line-clamp-2">{video.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-sm">
                      {video.videoDuration && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDuration(video.videoDuration)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {video.viewCount} 次观看
                      </span>
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="h-8 w-8 text-black ml-1" />
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </Carousel>
        ) : (
          <div className="w-full h-full bg-muted rounded-xl flex items-center justify-center">
            <p className="text-muted-foreground">暂无视频</p>
          </div>
        )}
      </div>

      {/* Spacer for fixed left content */}
      <div className="hidden lg:block lg:w-1/2" />

      {/* RIGHT CONTENT - Scrollable */}
      <div className="w-full lg:w-1/2 space-y-3 pb-3">
        {/* DESCRIPTION CARD */}
        <CardContainer>
          <div className="flex flex-col p-12 gap-[128px]">
            <h1 className="text-3xl">Videos</h1>
            <div className="flex flex-col gap-4 font-light">
              <p>
                Welcome to my channel! Here I share my travel vlogs and daily life. I love experimenting with different photography styles and learning new editing techniques. My earlier videos may be a bit rough in color grading and editing, so I hope you'll bear with me. Let's stay kind and keep loving life.
              </p>
            </div>
          </div>
        </CardContainer>

        {/* VIDEO LIST */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} formatDuration={formatDuration} />
          ))}
        </div>

        {/* CONTACT CARDS */}
        <div className="w-full grid grid-cols-2 gap-3 mt-3">
          <ContactCard title="Instagram" />
          <ContactCard title="TikTok" href="https://v.douyin.com/RXvLrLVkKF0/" />
          <ContactCard title="Xiaohongshu" href="https://xhslink.com/m/20NisqUaKYT" />
          <ContactCard
            title="Contact me"
            href="mailto:fangbing01@alumni.nudt.edu.cn"
            className="bg-primary hover:bg-primary-hover text-white dark:text-black"
          />
        </div>

        {/* FOOTER */}
        <Footer />
      </div>
    </div>
  );
};

export const VideoListLoadingStatus = () => {
  return (
    <div className="flex flex-col gap-3 lg:gap-0 lg:flex-row w-full">
      {/* LEFT CONTENT - Fixed */}
      <div className="w-full h-[50vh] lg:w-1/2 lg:fixed lg:top-0 lg:left-0 md:h-[80vh] lg:h-screen p-0 lg:p-3 group">
        <Skeleton className="w-full h-full rounded-xl" />
      </div>

      {/* Spacer for fixed left content */}
      <div className="hidden lg:block lg:w-1/2" />

      {/* RIGHT CONTENT - Scrollable */}
      <div className="w-full lg:w-1/2 space-y-3 pb-3">
        <CardContainer>
          <div className="flex flex-col p-12 gap-[128px]">
            <Skeleton className="h-10 w-24" />
            <div className="flex flex-col gap-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </CardContainer>

        <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="aspect-3/4 rounded-xl" />
          ))}
        </div>

        <Footer />
      </div>
    </div>
  );
};
