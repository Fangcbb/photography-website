import { z } from "zod";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { desc, eq, and } from "drizzle-orm";
import { citySets, photos } from "@/db/schema";
import { TRPCError } from "@trpc/server";

// JP/TW 的城市集以 region 作为 cityName，其余以 city；照片匹配按同一口径
function photoCityMatch(citySet: { countryCode: string; city: string }) {
  const isJpTw = citySet.countryCode === "JP" || citySet.countryCode === "TW";
  return isJpTw ? eq(photos.region, citySet.city) : eq(photos.city, citySet.city);
}

export const travelRouter = createTRPCRouter({
  getCitySets: baseProcedure.query(async ({ ctx }) => {
    const data = await ctx.db.query.citySets.findMany({
      with: {
        coverPhoto: true,
        // photos 未使用，不取回来减轻列表页负担
      },
      columns: {
        id: true,
          slug: true,
        city: true,
        country: true,
        photoCount: true,
        coverPhotoId: true,
      },
      orderBy: [desc(citySets.updatedAt)],
    });

    // 公开接口不得泄露私有封面：私有封面置空，交由前端 fallback 处理
    return data.map((row) =>
      row.coverPhoto && row.coverPhoto.visibility === "public"
        ? row
        : { ...row, coverPhoto: null },
    );
  }),
  getOne: baseProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [citySet] = await ctx.db
        .select()
        .from(citySets)
        .where(eq(citySets.id, input.id));

      if (!citySet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "城市不存在",
        });
      }

      const cityPhotos = await ctx.db
        .select()
        .from(photos)
        .where(
          and(
            eq(photos.country, citySet.country),
            photoCityMatch(citySet),
            eq(photos.visibility, "public"),
          ),
        )
        .orderBy(desc(photos.dateTimeOriginal), desc(photos.createdAt));

      return {
        ...citySet,
        photos: cityPhotos,
      };
    }),
  getBySlug: baseProcedure
    .input(
      z.object({
        slug: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [citySet] = await ctx.db
        .select()
        .from(citySets)
        .where(eq(citySets.slug, input.slug));

      if (!citySet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "城市不存在",
        });
      }

      const cityPhotos = await ctx.db
        .select()
        .from(photos)
        .where(
          and(
            eq(photos.country, citySet.country),
            photoCityMatch(citySet),
            eq(photos.visibility, "public"),
          ),
        )
        .orderBy(desc(photos.dateTimeOriginal), desc(photos.createdAt));

      return {
        ...citySet,
        photos: cityPhotos,
      };
    }),
});
