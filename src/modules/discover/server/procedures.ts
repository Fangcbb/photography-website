import { z } from "zod";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { desc, eq, isNotNull, and } from "drizzle-orm";
import { photos, videos } from "@/db/schema";

export const discoverRouter = createTRPCRouter({
  getManyPhotos: baseProcedure.input(z.object({})).query(async ({ ctx }) => {
    // 查询有位置的照片
    const photoData = await ctx.db
      .select({
        id: photos.id,
        url: photos.url,
        title: photos.title,
        latitude: photos.latitude,
        longitude: photos.longitude,
        blurData: photos.blurData,
        width: photos.width,
        height: photos.height,
        dateTimeOriginal: photos.dateTimeOriginal,
      })
      .from(photos)
      .where(
        and(
          eq(photos.visibility, "public"),
          isNotNull(photos.latitude),
          isNotNull(photos.longitude),
        ),
      )
      .orderBy(desc(photos.updatedAt));

    // 查询有位置的视频
    const videoData = await ctx.db
      .select({
        id: videos.id,
        videoUrl: videos.videoUrl,
        thumbnailUrl: videos.thumbnailUrl,
        title: videos.title,
        latitude: videos.latitude,
        longitude: videos.longitude,
        videoDuration: videos.videoDuration,
        dateTimeOriginal: videos.dateTimeOriginal,
      })
      .from(videos)
      .where(
        and(
          eq(videos.visibility, "public"),
          isNotNull(videos.latitude),
          isNotNull(videos.longitude),
        ),
      )
      .orderBy(desc(videos.createdAt));

    // 合并照片和视频，添加类型标识
    const photosWithType = photoData.map((p) => ({ ...p, type: "photo" as const }));
    const videosWithType = videoData.map((v) => ({ 
      ...v, 
      type: "video" as const,
      url: v.thumbnailUrl || v.videoUrl,
      blurData: null,
      width: null,
      height: null,
    }));

    // 按时间排序合并结果
    const allData = [...photosWithType, ...videosWithType].sort((a, b) => {
      const timeA = a.dateTimeOriginal?.getTime() || 0;
      const timeB = b.dateTimeOriginal?.getTime() || 0;
      return timeB - timeA;
    });

    return allData;
  }),
});
