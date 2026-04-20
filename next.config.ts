import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  // Image optimization is disabled — images are served directly from COS via CDN.
  // CosImage component uses <img> tags pointing to cnn.fangc.cc URLs.
  // This avoids Next.js image optimization overhead for large photo assets.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
