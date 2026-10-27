import { createTRPCRouter, baseProcedure, protectedProcedure } from "@/trpc/init";
import { desc, eq, and, sql } from "drizzle-orm";
import { videos } from "@/db/schema";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/modules/s3/lib/server-client";

function generateSlug(title: string): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
  return titleSlug + "-" + timestamp + "-" + randomStr;
}

// 与 photos.remove 一致：带 CDN 域名的 URL 取 path；失败仅 console.error 不阻断
async function deleteVideoAssets(video: {
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
}) {
  const keys = [video.videoUrl, video.thumbnailUrl].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );

  for (const raw of keys) {
    try {
      let key = raw;
      if (/^https?:\/\//i.test(raw)) {
        const url = new URL(raw);
        key = url.pathname.replace(/^\/+/, "");
      }
      if (!key) continue;
      const command = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      });
      await s3Client.send(command);
    } catch (error) {
      console.error("S3 delete failed (orphan file):", error);
    }
  }
}

export const videoRouter = createTRPCRouter({
  getMany: baseProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;

      const [countResult] = await ctx.db
        .select({ count: sql`count(*)::int` })
        .from(videos)
        .where(eq(videos.visibility, "public"));

      const total = countResult?.count ?? 0;

      const data = await ctx.db
        .select()
        .from(videos)
        .where(eq(videos.visibility, "public"))
        .orderBy(desc(videos.createdAt))
        .limit(limit)
        .offset(offset);

      return { data, total };
    }),

  getOne: baseProcedure
    .input(
      z.object({
        slug: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [data] = await ctx.db
        .select()
        .from(videos)
        .where(and(eq(videos.slug, input.slug), eq(videos.visibility, "public")));

      if (!data) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // 单条原子自增，避免 read-then-write 竞态；返回自增后的新值
      const [updated] = await ctx.db
        .update(videos)
        .set({ viewCount: sql`${videos.viewCount} + 1` })
        .where(eq(videos.id, data.id))
        .returning();

      return { ...data, viewCount: updated?.viewCount ?? data.viewCount + 1 };
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const data = await ctx.db
      .select()
      .from(videos)
      .orderBy(desc(videos.updatedAt));

    return data;
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        videoUrl: z.string().min(1),
        thumbnailUrl: z.string().optional(),
        videoDuration: z.number().optional(),
        videoSize: z.number().optional(),
        tags: z.array(z.string()).optional(),
        visibility: z.enum(["public", "private"]).default("private"),
        dateTimeOriginal: z.date().optional().nullable(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        country: z.string().optional(),
        countryCode: z.string().optional(),
        city: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = generateSlug(input.title);

      const [video] = await ctx.db
        .insert(videos)
        .values({
          title: input.title,
          slug,
          description: input.description || "",
          videoUrl: input.videoUrl,
          thumbnailUrl: input.thumbnailUrl,
          videoDuration: input.videoDuration,
          videoSize: input.videoSize,
          tags: input.tags || [],
          visibility: input.visibility,
          dateTimeOriginal: input.dateTimeOriginal,
          latitude: input.latitude,
          longitude: input.longitude,
          country: input.country,
          countryCode: input.countryCode,
          city: input.city,
        })
        .returning();

      return video;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        tags: z.array(z.string()).optional(),
        visibility: z.enum(["public", "private"]).optional(),
        dateTimeOriginal: z.date().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      const [video] = await ctx.db
        .update(videos)
        .set(updateData)
        .where(eq(videos.id, id))
        .returning();

      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return video;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [video] = await ctx.db
        .delete(videos)
        .where(eq(videos.id, input.id))
        .returning();

      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // DB 记录已删除，S3/COS 清理失败可接受孤儿文件
      await deleteVideoAssets(video);

      return video;
    }),
});
