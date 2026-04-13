"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

interface CityPhotosOptions {
  city: string;
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

export function useCityPhotos({ city }: CityPhotosOptions): CityPhotosResult {
  const trpc = useTRPC();
  
  const { data } = useSuspenseQuery(
    trpc.travel.getOne.queryOptions({ city }),
  );

  const coverPhoto = data.photos.find((item: any) => data.coverPhotoId === item.id);

  return {
    cityData: data,
    coverPhoto,
    photos: data.photos || [],
    photoCount: data.photoCount || 0,
  };
}
