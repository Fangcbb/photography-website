"use client";

import { useState, useRef, useEffect } from "react";
import { Blurhash } from "react-blurhash";
import type { WallpaperPhoto } from "../views/wallpapers-view";

interface WallpaperCardProps {
  photo: WallpaperPhoto;
}

const DOWNLOAD_SIZES = [
  { label: "小尺寸", sub: "640 × 640", w: 640 },
  { label: "中等", sub: "1920 × 1920", w: 1920 },
  { label: "大尺寸", sub: "2400 × 2400", w: 2400 },
  { label: "原始尺寸", sub: "原始分辨率", w: 0 },
];

function buildDownloadUrl(rawUrl: string, width: number): string {
  if (width === 0) return rawUrl;
  const url = new URL(rawUrl);
  url.searchParams.set("w", String(width));
  url.searchParams.set("h", String(width));
  url.searchParams.set("fit", "crop");
  url.searchParams.set("q", "85");
  return url.toString();
}

export function WallpaperCard({ photo }: WallpaperCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const aspectRatio = photo.height / photo.width;
  const hasBlurHash = photo.blur_hash && photo.blur_hash.length > 0;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleDownload = (width: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = buildDownloadUrl(photo.urls.raw, width);
    window.open(url, "_blank");
    setMenuOpen(false);
  };

  return (
    <div className="relative mb-3 break-inside-avoid group">
      {/* Image container */}
      <div
        className="block overflow-hidden cursor-pointer"
        onClick={() => window.open(photo.urls.regular, "_blank")}
      >
        {/* Aspect ratio container */}
        <div className="relative w-full" style={{ paddingBottom: `${aspectRatio * 100}%` }}>
          {/* BlurHash placeholder */}
          {hasBlurHash && !loaded && !error && (
            <div className="absolute inset-0">
              <Blurhash
                hash={photo.blur_hash!}
                width="100%"
                height="100%"
                resolutionX={32}
                resolutionY={32}
                punch={1}
              />
            </div>
          )}

          {/* Fallback placeholder */}
          {!hasBlurHash && !loaded && !error && (
            <div className="absolute inset-0 bg-muted animate-pulse" />
          )}

          {/* Actual image */}
          {!error && (
            <img
              src={photo.urls.regular}
              alt={photo.alt_description || "壁纸"}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                loaded ? "opacity-100 scale-100" : "opacity-0 scale-105"
              } group-hover:scale-[1.03]`}
            />
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 bg-muted flex items-center justify-center">
              <span className="text-xs text-muted-foreground">加载失败</span>
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-white text-sm font-medium truncate">
                {photo.user.name}
              </p>
              <p className="text-white/60 text-xs">Unsplash</p>
            </div>
          </div>
        </div>
      </div>

      {/* Download button - top right corner */}
      <div ref={menuRef} className="absolute top-2 right-2 z-10">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-black/70"
          title="下载"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div className="absolute top-10 right-0 w-48 bg-background/95 backdrop-blur-md border rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 duration-150">
            {DOWNLOAD_SIZES.map((size) => (
              <button
                key={size.w}
                onClick={(e) => handleDownload(size.w, e)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex justify-between items-center"
              >
                <span>{size.label}</span>
                <span className="text-muted-foreground text-xs">{size.sub}</span>
              </button>
            ))}
            <div className="border-t my-1" />
            <a
              href={photo.links.html}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 text-sm hover:bg-accent transition-colors text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              在 Unsplash 查看
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
