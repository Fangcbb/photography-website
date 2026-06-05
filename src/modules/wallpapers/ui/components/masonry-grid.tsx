"use client";

import type { WallpaperPhoto } from "../views/wallpapers-view";
import { WallpaperCard } from "./wallpaper-card";

interface MasonryGridProps {
  photos: WallpaperPhoto[];
}

/**
 * CSS column-count masonry layout.
 * Large images, 2 columns on mobile, 3 on desktop.
 * Same visual approach as AnimatedGallery.
 */
export function MasonryGrid({ photos }: MasonryGridProps) {
  return (
    <div className="columns-2 md:columns-3 gap-3 [column-fill:balance]">
      {photos.map((photo) => (
        <WallpaperCard key={photo.id} photo={photo} />
      ))}
    </div>
  );
}
