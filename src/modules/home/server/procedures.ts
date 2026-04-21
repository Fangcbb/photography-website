import { z } from "zod";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { desc, eq, and, asc } from "drizzle-orm";
import { citySets, photos } from "@/db/schema";
import { TRPCError } from "@trpc/server";

export const homeRouter = createTRPCRouter({
  getManyLikePhotos: baseProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(10).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit } = input;

      const data = await ctx.db
        .select()
        .from(photos)
        .where(
          and(eq(photos.isFavorite, true), eq(photos.visibility, "public")),
        )
        .orderBy(desc(photos.updatedAt))
        .limit(limit);

      return data;
    }),
  getCitySets: baseProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit } = input;

      const data = await ctx.db.query.citySets.findMany({
        with: {
          coverPhoto: true,
          // photos 未使用，不取回来减轻首页负担
        },
        columns: {
          id: true,
          city: true,
          country: true,
          photoCount: true,
          coverPhotoId: true,
        },
        orderBy: [desc(citySets.updatedAt)],
        limit: limit,
      });

      return data;
    }),
  getPhotoById: baseProcedure
    .input(
      z.object({
        id: z.uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { id } = input;

      const data = await ctx.db.query.photos.findFirst({
        where: and(eq(photos.id, id), eq(photos.visibility, "public")),
      });

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Photo not found",
        });
      }

      return data;
    }),
  getPhotosByCity: baseProcedure
    .input(
      z.object({
        currentPhotoId: z.uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { currentPhotoId } = input;

      // 先获取当前照片的城市信息
      const currentPhoto = await ctx.db.query.photos.findFirst({
        where: and(eq(photos.id, currentPhotoId), eq(photos.visibility, "public")),
      });

      if (!currentPhoto || !currentPhoto.country || !currentPhoto.city) {
        // 如果找不到照片或没有城市信息，返回空列表
        return {
          photos: [],
          currentIndex: -1,
          hasPrev: false,
          hasNext: false,
        };
      }

      // 查询同城市的所有公开照片
      const cityPhotos = await ctx.db
        .select()
        .from(photos)
        .where(
          and(
            eq(photos.country, currentPhoto.country),
            eq(photos.city, currentPhoto.city),
            eq(photos.visibility, "public"),
          ),
        )
        .orderBy(desc(photos.dateTimeOriginal));

      // 找到当前照片在列表中的位置
      const currentIndex = cityPhotos.findIndex(p => p.id === currentPhotoId);

      return {
        photos: cityPhotos,
        currentIndex,
        hasPrev: currentIndex > 0,
        hasNext: currentIndex < cityPhotos.length - 1,
      };
    }),
});
