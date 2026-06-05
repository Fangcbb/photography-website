"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

interface CityPhotosOptions {
  id?: string;
  slug?: string;
}

interface CityPhotosResult {
  // 城市数据
  cityData: any;

  // 封面照片
  coverPhoto: any;

  // 照片列表
  photos: any[];

  // 照片数量
  photoCount: number;
}

export function useCityPhotos({ id, slug }: CityPhotosOptions): CityPhotosResult {
  const trpc = useTRPC();

  const { data } = useSuspenseQuery(
    slug
      ? trpc.travel.getBySlug.queryOptions({ slug })
      : trpc.travel.getOne.queryOptions({ id: id! }),
  );

  const coverPhoto = data.photos.find((item: any) => data.coverPhotoId === item.id);

  return {
    cityData: data,
    coverPhoto,
    photos: data.photos || [],
    photoCount: data.photoCount || 0,
  };
}
