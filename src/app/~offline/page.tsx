"use client";

import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mb-6 text-6xl">📡</div>
      <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground">
        您当前处于离线状态
      </h1>
      <p className="mb-8 max-w-md text-muted-foreground">
        网络连接似乎已断开。部分已缓存的页面仍可浏览，但图片和最新内容可能无法加载。
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          返回首页
        </Link>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          刷新重试
        </button>
      </div>
    </div>
  );
}
