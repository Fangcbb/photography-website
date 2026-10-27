import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { and, eq, desc, asc, sql, ilike, count } from "drizzle-orm";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import {
  citySets,
  photos,
  photosUpdateSchema,
  photosInsertSchema,
} from "@/db/schema";
import { dualUpdate, dualDelete, dualTransaction } from "@/db";
import { buildCitySlug } from "@/modules/photos/server/city-slug";
import { TRPCError } from "@trpc/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/modules/s3/lib/server-client";

function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

export const photosRouter = createTRPCRouter({
  create: protectedProcedure
    .input(photosInsertSchema)
    .mutation(async ({ ctx, input }) => {
      const values = input;
      const cityName =
        values.countryCode === "JP" || values.countryCode === "TW"
          ? values.region
          : values.city;

      try {
        // Photo + city aggregate must commit or roll back together. The previous
        // dualInsert/compensating-delete sequence could leave photoCount drift,
        // and compensation itself could fail. The primary production database
        // is the source of truth; dualTransaction intentionally wraps its native
        // transaction (the secondary database is not configured in production).
        return await dualTransaction(async (tx) => {
          const [insertedPhoto] = await tx
            .insert(photos)
            .values(values)
            .returning();

          if (insertedPhoto.country && cityName && insertedPhoto.countryCode) {
            await tx
              .insert(citySets)
              .values({
                country: insertedPhoto.country,
                countryCode: insertedPhoto.countryCode,
                city: cityName,
                slug: buildCitySlug(
                  insertedPhoto.countryCode,
                  insertedPhoto.country,
                  cityName,
                ),
                photoCount: 1,
                coverPhotoId: insertedPhoto.id,
              })
              .onConflictDoUpdate({
                target: [citySets.country, citySets.city],
                set: {
                  countryCode: insertedPhoto.countryCode,
                  photoCount: sql`${citySets.photoCount} + 1`,
                  coverPhotoId: insertedPhoto.id,
                  updatedAt: new Date(),
                },
              });
          }

          return insertedPhoto;
        });
      } catch (error) {
        console.error("照片创建出错：", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "照片创建失败",
        });
      }
    }),
  remove: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      if (!id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      try {
        const [photo] = await ctx.db
          .select()
          .from(photos)
          .where(eq(photos.id, id));

        if (!photo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "照片不存在",
          });
        }

        // city set related
        if (photo.country && photo.city) {
          const [citySet] = await ctx.db
            .select()
            .from(citySets)
            .where(
              and(
                eq(citySets.country, photo.country),
                eq(citySets.city, photo.city),
              ),
            );

          if (citySet) {
            if (citySet.photoCount === 1) {
              // last photo in city — delete the city set
              await dualDelete(citySets).where(eq(citySets.id, citySet.id));
            } else {
              // find new cover photo if current cover is being deleted
              const newCoverPhotoId =
                citySet.coverPhotoId === photo.id
                  ? (
                      await ctx.db
                        .select({ id: photos.id })
                        .from(photos)
                        .where(
                          and(
                            eq(photos.country, photo.country),
                            eq(photos.city, photo.city),
                            eq(photos.visibility, "public"),
                            sql`${photos.id} != ${photo.id}`,
                          ),
                        )
                        .orderBy(desc(photos.createdAt))
                        .limit(1)
                    )[0]?.id
                  : undefined;

              await dualUpdate(citySets)
                .set({
                  photoCount: sql`${citySets.photoCount} - 1`,
                  ...(newCoverPhotoId ? { coverPhotoId: newCoverPhotoId } : {}),
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(citySets.country, photo.country),
                    eq(citySets.city, photo.city),
                  ),
                );
            }
          }
        }

        // delete photo record first, then S3
        await dualDelete(photos).where(eq(photos.id, id));

        // S3 delete after DB — orphan file is acceptable, inconsistent DB is not
        try {
          const command = new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: photo.url,
          });
          await s3Client.send(command);
        } catch (error) {
          console.error("S3 delete failed (orphan file):", error);
        }

        return photo;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("照片删除出错：", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "照片删除失败",
        });
      }
    }),
  update: protectedProcedure
    .input(photosUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      if (!id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const [updatedPhoto] = await dualUpdate(photos)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(photos.id, id))
        .returning();

      if (!updatedPhoto) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updatedPhoto;
    }),
  getOne: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { id } = input;

      const [photo] = await ctx.db
        .select()
        .from(photos)
        .where(eq(photos.id, id));

      return photo;
    }),
  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().default(DEFAULT_PAGE),
        orderBy: z.enum(["asc", "desc"] as const).default("desc"),
        pageSize: z
          .number()
          .min(MIN_PAGE_SIZE)
          .max(MAX_PAGE_SIZE)
          .default(DEFAULT_PAGE_SIZE),
        search: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, orderBy } = input;

      const data = await ctx.db
        .select()
        .from(photos)
        .where(
          search ? ilike(photos.title, `%${escapeLike(search)}%`) : undefined,
        )
        .orderBy(
          orderBy === "asc"
            ? asc(photos.createdAt)
            : desc(photos.createdAt),
        )
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const [total] = await ctx.db
        .select({
          count: count(),
        })
        .from(photos)
        .where(
          search ? ilike(photos.title, `%${escapeLike(search)}%`) : undefined,
        );

      const totalPages = Math.ceil(total.count / pageSize);

      return {
        items: data,
        total: total.count,
        totalPages,
      };
    }),
});
