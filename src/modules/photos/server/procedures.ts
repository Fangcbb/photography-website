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
import { db, dualUpdate, dualTransaction } from "@/db";
import { buildCitySlug } from "@/modules/photos/server/city-slug";
import { TRPCError } from "@trpc/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/modules/s3/lib/server-client";

function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

// If the stored URL carries a CDN domain prefix, keep only the path part as the S3 key
function toS3Key(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) {
    try {
      return new URL(url).pathname.replace(/^\/+/, "");
    } catch {
      return url;
    }
  }
  return url;
}

// JP/TW 城市集以 region 作为 cityName，其余以 city，与 create 保持同一口径
function citySetCityKey(
  photo: { countryCode?: string | null; region?: string | null; city?: string | null }
): string | null {
  const key =
    photo.countryCode === "JP" || photo.countryCode === "TW"
      ? photo.region
      : photo.city;
  return key || null;
}

// JP/TW 的照片按 region 关联城市集，其余按 city
function photoCityEq(countryCode: string | null, cityKey: string) {
  return countryCode === "JP" || countryCode === "TW"
    ? eq(photos.region, cityKey)
    : eq(photos.city, cityKey);
}

export const photosRouter = createTRPCRouter({
  create: protectedProcedure
    .input(photosInsertSchema)
    .mutation(async ({ ctx, input }) => {
      const values = input;
      const cityName = citySetCityKey(values);

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
            const isPublic = insertedPhoto.visibility === "public";

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
                photoCount: isPublic ? 1 : 0,
                coverPhotoId: isPublic ? insertedPhoto.id : null,
              })
              .onConflictDoUpdate({
                target: [citySets.country, citySets.city],
                set: {
                  countryCode: insertedPhoto.countryCode,
                  photoCount: sql`${citySets.photoCount} + ${isPublic ? 1 : 0}`,
                  ...(isPublic
                    ? { coverPhotoId: insertedPhoto.id }
                    : {}),
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

        const cityKey = citySetCityKey(photo);

        await dualTransaction(async (tx) => {
          // city set related
          if (photo.country && cityKey) {
            const [citySet] = await tx
              .select()
              .from(citySets)
              .where(
                and(
                  eq(citySets.country, photo.country),
                  eq(citySets.city, cityKey),
                ),
              );

            if (citySet) {
              // Real-time public photo count for this city (excluding the photo
              // being deleted) — stored photoCount may have drifted.
              const [remaining] = await tx
                .select({ count: count() })
                .from(photos)
                .where(
                  and(
                    eq(photos.country, photo.country),
                    photoCityEq(photo.countryCode, cityKey),
                    eq(photos.visibility, "public"),
                    sql`${photos.id} != ${photo.id}`,
                  ),
                );

              if (remaining.count === 0) {
                // last public photo in city — delete the city set
                await tx.delete(citySets).where(eq(citySets.id, citySet.id));
              } else {
                // find new cover photo if current cover is being deleted
                const newCoverPhotoId =
                  citySet.coverPhotoId === photo.id
                    ? (
                        await tx
                          .select({ id: photos.id })
                          .from(photos)
                          .where(
                            and(
                              eq(photos.country, photo.country),
                              photoCityEq(photo.countryCode, cityKey),
                              eq(photos.visibility, "public"),
                              sql`${photos.id} != ${photo.id}`,
                            ),
                          )
                          .orderBy(desc(photos.createdAt))
                          .limit(1)
                      )[0]?.id
                    : undefined;

                // 以实时公开计数为准，避免私有照片删除被错误扣减计数
                await tx.update(citySets)
                  .set({
                    photoCount: remaining.count,
                    ...(newCoverPhotoId
                      ? { coverPhotoId: newCoverPhotoId }
                      : {}),
                    updatedAt: new Date(),
                  })
                  .where(
                    and(
                      eq(citySets.country, photo.country),
                      eq(citySets.city, cityKey),
                    ),
                  );
              }
            }
          }

          // delete photo record (S3 deletion happens after the transaction)
          await tx.delete(photos).where(eq(photos.id, id));
        });

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

        // Live photo video object — best-effort, never blocks deletion
        if (photo.livePhotoVideoUrl) {
          try {
            const command = new DeleteObjectCommand({
              Bucket: process.env.S3_BUCKET_NAME,
              Key: toS3Key(photo.livePhotoVideoUrl) ?? undefined,
            });
            await s3Client.send(command);
          } catch (error) {
            console.error("S3 live photo video delete failed:", error);
          }
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

      const [existing] = await ctx.db
        .select()
        .from(photos)
        .where(eq(photos.id, id));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
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

      // Keep citySet photoCount in sync when visibility flips.
      const cityKey = citySetCityKey(updatedPhoto);
      if (
        updatedPhoto.country &&
        updatedPhoto.countryCode &&
        cityKey &&
        existing.visibility !== updatedPhoto.visibility
      ) {
        try {
          const becamePrivate =
            existing.visibility === "public" &&
            updatedPhoto.visibility === "private";
          const becamePublic =
            existing.visibility === "private" &&
            updatedPhoto.visibility === "public";

          if (becamePrivate) {
            await dualUpdate(citySets)
              .set({
                photoCount: sql`greatest(${citySets.photoCount} - 1, 0)`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(citySets.country, updatedPhoto.country),
                  eq(citySets.city, cityKey),
                ),
              );

            // If this photo was the cover, re-pick the latest public photo;
            // if none exists, clear the cover reference.
            const [citySet] = await ctx.db
              .select({ id: citySets.id })
              .from(citySets)
              .where(
                and(
                  eq(citySets.country, updatedPhoto.country),
                  eq(citySets.city, cityKey),
                  eq(citySets.coverPhotoId, updatedPhoto.id),
                ),
              );

            if (citySet) {
              const [newCover] = await ctx.db
                .select({ id: photos.id })
                .from(photos)
                .where(
                  and(
                    eq(photos.country, updatedPhoto.country),
                    photoCityEq(updatedPhoto.countryCode, cityKey),
                    eq(photos.visibility, "public"),
                    sql`${photos.id} != ${updatedPhoto.id}`,
                  ),
                )
                .orderBy(desc(photos.createdAt))
                .limit(1);

              await dualUpdate(citySets)
                .set({
                  coverPhotoId: newCover?.id ?? null,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(citySets.country, updatedPhoto.country),
                    eq(citySets.city, cityKey),
                    eq(citySets.coverPhotoId, updatedPhoto.id),
                  ),
                );
            }
          } else if (becamePublic) {
            // 恢复公开：城市集可能已被删除，用 upsert 重建并恢复封面
            await db.insert(citySets)
              .values({
                country: updatedPhoto.country,
                countryCode: updatedPhoto.countryCode,
                city: cityKey,
                slug: buildCitySlug(
                  updatedPhoto.countryCode,
                  updatedPhoto.country,
                  cityKey,
                ),
                photoCount: 1,
                coverPhotoId: updatedPhoto.id,
              })
              .onConflictDoUpdate({
                target: [citySets.country, citySets.city],
                set: {
                  countryCode: updatedPhoto.countryCode,
                  photoCount: sql`${citySets.photoCount} + 1`,
                  coverPhotoId: updatedPhoto.id,
                  updatedAt: new Date(),
                },
              });
          }
        } catch (error) {
          console.error("citySet photoCount sync failed:", error);
        }
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
