"use client";
import React from "react";
import dynamic from "next/dynamic";

const WallpapersView = dynamic(
  () => import("@/modules/wallpapers/ui/views/wallpapers-view").then((m) => m.WallpapersView),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">加载中 / LOADING...</div>
      </div>
    ),
  }
);

export default function WallpapersPage() {
  return <WallpapersView />;
}
