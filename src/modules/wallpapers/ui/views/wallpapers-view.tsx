"use client";

import { useState, useEffect, useCallback } from "react";
import { MasonryGrid } from "../components/masonry-grid";
import { Loader2 } from "lucide-react";

export interface WallpaperPhoto {
  id: string;
  width: number;
  height: number;
  blur_hash: string | null;
  description: string | null;
  alt_description: string | null;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  links: {
    html: string;
  };
  user: {
    name: string;
    username: string;
    links: { html: string };
  };
}


export function WallpapersView() {
  const [photos, setPhotos] = useState<WallpaperPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchPhotos = useCallback(
    async (pageNum: number, append = false) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/wallpapers?page=${pageNum}&per_page=20&cb=${Date.now()}`
        );

        if (!res.ok) throw new Error("壁纸获取失败");

        const data = await res.json();

        if (append) {
          setPhotos((prev) => [...prev, ...data.photos]);
        } else {
          setPhotos(data.photos);
        }

        setHasMore(data.photos.length === 20);
      } catch (err) {
        setError(err instanceof Error ? err.message : "出了点问题");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchPhotos(1);
  }, [fetchPhotos]);

  // infinite scroll
  useEffect(() => {
    if (loadingMore || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchPhotos(nextPage, true);
        }
      },
      { rootMargin: "600px" }
    );

    const sentinel = document.getElementById("wallpapers-sentinel");
    if (sentinel) observer.observe(sentinel);

    return () => observer.disconnect();
  }, [page, loadingMore, hasMore, loading, fetchPhotos]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Spacer for fixed header */}
      <div className="h-14 flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 scrollbar-thin">
        {error && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-3">{error}</p>
            <button
              onClick={() => fetchPhotos(1)}
              className="text-sm text-primary hover:underline cursor-pointer"
            >
              重试
            </button>
          </div>
        )}

        {!error && photos.length > 0 && (
          <MasonryGrid photos={photos} />
        )}

        {loading && <WallpapersLoading />}

        {/* Infinite scroll sentinel */}
        {hasMore && !loading && <div id="wallpapers-sentinel" className="h-4" />}

        {loadingMore && (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {!hasMore && photos.length > 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">
            — End —
          </p>
        )}
      </div>
    </div>
  );
}

export function WallpapersLoading() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-1">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        <div className="h-3 w-48 bg-muted rounded animate-pulse mt-2" />
      </div>
      <div className="flex-1 px-4">
        <div className="columns-2 md:columns-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted rounded-lg animate-pulse mb-3 break-inside-avoid"
              style={{ height: `${200 + (i % 3) * 100}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
