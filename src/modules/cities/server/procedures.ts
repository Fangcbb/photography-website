import { z } from "zod";
import {
  createTRPCRouter,
  baseProcedure,
  protectedProcedure,
} from "@/trpc/init";
import { citySets, photos } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const cityRouter = createTRPCRouter({
  // Get all city sets
  getMany: baseProcedure.query(async ({ ctx }) => {
    // 仅返回封面为公开照片的城市，photoCount 只统计公开照片（防私有照片泄露）
    const data = await ctx.db
      .select({
        id: citySets.id,
        country: citySets.country,
        countryCode: citySets.countryCode,
        city: citySets.city,
        description: citySets.description,
        photoCount: sql<number>`(
          select count(*) from ${photos}
          where ${photos.city} = ${citySets.city}
            and ${photos.country} = ${citySets.country}
            and ${photos.visibility} = 'public'
        )`.mapWith(Number),
        coverPhotoId: citySets.coverPhotoId,
        createdAt: citySets.createdAt,
        updatedAt: citySets.updatedAt,
        coverPhotoUrl: photos.url,
        coverPhotoBlurData: photos.blurData,
        coverPhotoTitle: photos.title,
      })
      .from(citySets)
      .innerJoin(photos, and(
        eq(citySets.coverPhotoId, photos.id),
        eq(photos.visibility, "public"),
      ))
      .orderBy(desc(citySets.updatedAt), desc(citySets.createdAt));

    return data;
  }),

  /**
   * Get one city set with all photos.
   *
   * 仅后台 dashboard 使用（/dashboard/cities/[city]），返回该城市下**全部**照片，
   * 含 private —— 因此必须是 protectedProcedure。之前误用 baseProcedure，
   * 导致匿名用户按城市名即可拿到全部私有照片的 url / EXIF / GPS。
   */
  getOne: protectedProcedure
    .input(
      z.object({
        city: z.string().max(64),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { city } = input;

      // Get city set info
      const [citySet] = await ctx.db
        .select()
        .from(citySets)
        .where(and(eq(citySets.city, city)));

      if (!citySet) {
        return null;
      }

      // Get all photos in this city（含 private，仅登录后台可见）
      const cityPhotos = await ctx.db
        .select()
        .from(photos)
        .where(eq(photos.city, city))
        .orderBy(desc(photos.dateTimeOriginal), desc(photos.createdAt));

      return {
        ...citySet,
        photos: cityPhotos,
      };
    }),

  // Update city cover photo
  updateCoverPhoto: protectedProcedure
    .input(
      z.object({
        cityId: z.uuid(),
        photoId: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { cityId, photoId } = input;

      // Verify the photo exists
      const [photo] = await ctx.db
        .select()
        .from(photos)
        .where(eq(photos.id, photoId));

      if (!photo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "照片不存在",
        });
      }

      // Verify the city set exists
      const [citySet] = await ctx.db
        .select()
        .from(citySets)
        .where(eq(citySets.id, cityId));

      if (!citySet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "城市不存在",
        });
      }

      // 封面必须是公开照片，否则 getMany 的 innerJoin 会把它隐藏掉
      if (photo.visibility !== "public") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "不能将私有照片设为封面",
        });
      }

      // Verify the photo belongs to this city
      if (photo.city !== citySet.city) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "照片不属于该城市",
        });
      }

      // Update the cover photo
      const [updatedCitySet] = await ctx.db
        .update(citySets)
        .set({
          coverPhotoId: photoId,
          updatedAt: new Date(),
        })
        .where(eq(citySets.id, cityId))
        .returning();

      return updatedCitySet;
    }),

  // Update city description
  updateDescription: protectedProcedure
    .input(
      z.object({
        cityId: z.uuid(),
        description: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { cityId, description } = input;

      // Verify the city set exists
      const [citySet] = await ctx.db
        .select()
        .from(citySets)
        .where(eq(citySets.id, cityId));

      if (!citySet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "城市不存在",
        });
      }

      // Update the description
      const [updatedCitySet] = await ctx.db
        .update(citySets)
        .set({
          description,
          updatedAt: new Date(),
        })
        .where(eq(citySets.id, cityId))
        .returning();

      return updatedCitySet;
    }),
});
