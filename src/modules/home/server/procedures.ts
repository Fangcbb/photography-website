import { z } from "zod";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { desc, eq, and, asc, sql, inArray } from "drizzle-orm";
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

      // photoCount 只统计公开照片（防私有照片泄露）
      const sets = await ctx.db
        .select({
          slug: citySets.slug,
          id: citySets.id,
          city: citySets.city,
          country: citySets.country,
          photoCount: sql<number>`(
            select count(*) from ${photos}
            where ${photos.city} = ${citySets.city}
              and ${photos.country} = ${citySets.country}
              and ${photos.visibility} = 'public'
          )`.mapWith(Number),
          coverPhotoId: citySets.coverPhotoId,
        })
        .from(citySets)
        .orderBy(desc(citySets.updatedAt))
        .limit(limit);

      // 组装封面：优先用户指定封面（须为 public），否则回退该城市最新公开照片
      const coverIds = sets.map((c) => c.coverPhotoId).filter((v): v is string => !!v);
      const specified = coverIds.length
        ? await ctx.db
            .select({
              id: photos.id,
              url: photos.url,
              blurData: photos.blurData,
              title: photos.title,
              visibility: photos.visibility,
            })
            .from(photos)
            .where(inArray(photos.id, coverIds))
        : [];
      const specMap = new Map(specified.map((p) => [p.id, p]));

      const data = await Promise.all(
        sets.map(async (c) => {
          const spec = c.coverPhotoId ? specMap.get(c.coverPhotoId) : undefined;
          let cover = spec && spec.visibility === "public" ? spec : undefined;
          if (!cover) {
            const [latest] = await ctx.db
              .select({
                id: photos.id,
                url: photos.url,
                blurData: photos.blurData,
                title: photos.title,
                visibility: photos.visibility,
              })
              .from(photos)
              .where(
                and(
                  eq(photos.city, c.city),
                  eq(photos.country, c.country),
                  eq(photos.visibility, "public"),
                ),
              )
              .orderBy(desc(photos.createdAt))
              .limit(1);
            cover = latest;
          }
          return {
            ...c,
            coverPhotoId: cover && cover.id ? cover.id : null,
            coverPhotoUrl: cover ? cover.url : null,
            coverPhotoBlurData: cover ? cover.blurData : null,
            coverPhotoTitle: cover ? cover.title : null,
          };
        }),
      );

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
