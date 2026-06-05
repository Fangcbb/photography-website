import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  WallpapersView,
  WallpapersLoading,
} from "@/modules/wallpapers/ui/views/wallpapers-view";

export const metadata = {
  title: "Wallpapers - 方斌的摄影作品集",
  description:
    "每日精选壁纸，来自 Unsplash 的高质量摄影作品。自然风光、城市景观、旅行摄影，每日自动更新。",
  keywords: [
    "壁纸",
    "wallpaper",
    "每日壁纸",
    "高清壁纸",
    "风景壁纸",
    "摄影作品",
    "Unsplash",
    "每日精选",
  ],
};

const page = () => {
  return (
    <Suspense fallback={<WallpapersLoading />}>
      <ErrorBoundary fallback={<p>Something went wrong.</p>}>
        <WallpapersView />
      </ErrorBoundary>
    </Suspense>
  );
};

export default page;
