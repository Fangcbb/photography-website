import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
  // 禁用生产环境 source map
  productionBrowserSourceMaps: false,
};

const withPWAConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheStartUrl: true,
  dynamicStartUrl: true,
  reloadOnOnline: true,
  extendDefaultRuntimeCaching: true,
  // 旧播放器音频不参与预缓存，访客未进入音乐页也不应下载约 14MB 的 MP3
  publicExcludes: ["!music-player/assets/music/*.mp3"],
  fallbacks: {
    document: "/~offline",
  },
  workboxOptions: {
    cleanupOutdatedCaches: true,
    skipWaiting: true,
    clientsClaim: true,
    // 敏感路径不缓存：认证/后台查询/私有图片只走网络，避免登出或转私有后仍命中旧缓存
    runtimeCaching: [
      { urlPattern: /\/api\/trpc\/.*/i, handler: "NetworkOnly", method: "GET" },
      { urlPattern: /\/api\/auth\/.*/i, handler: "NetworkOnly", method: "GET" },
      { urlPattern: /\/api\/photo\/.*/i, handler: "NetworkOnly", method: "GET" },
      { urlPattern: /\/dashboard\/.*/i, handler: "NetworkOnly", method: "GET" },
    ],
  },
});

export default withPWAConfig(nextConfig);
