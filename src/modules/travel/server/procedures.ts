import { z } from "zod";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { desc, eq, and } from "drizzle-orm";
import { citySets, photos } from "@/db/schema";
import { TRPCError } from "@trpc/server";

export const travelRouter = createTRPCRouter({
  getCitySets: baseProcedure.query(async ({ ctx }) => {
    const data = await ctx.db.query.citySets.findMany({
      with: {
        coverPhoto: true,
        photos: true,
      },
      orderBy: [desc(citySets.updatedAt)],
    });

    return data;
  }),
  getOne: baseProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Get city set info by stable UUID primary key
      const [citySet] = await ctx.db
        .select()
        .from(citySets)
        .where(eq(citySets.id, input.id));

      if (!citySet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "City not found",
        });
      }

      // Get all photos in this city
      const cityPhotos = await ctx.db
        .select()
        .from(photos)
        .where(and(eq(photos.city, citySet.city), eq(photos.visibility, "public")))
        .orderBy(desc(photos.dateTimeOriginal), desc(photos.createdAt));

      return {
        ...citySet,
        photos: cityPhotos,
      };
    }),
});
