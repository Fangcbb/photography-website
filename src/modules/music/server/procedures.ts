import { createTRPCRouter, baseProcedure, protectedProcedure } from "@/trpc/init";
import { desc, eq, and, like, or, count, inArray } from "drizzle-orm";
import { music } from "@/db/schema";
import { dualInsert, dualUpdate, dualDelete } from "@/db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/modules/s3/lib/server-client";

// 与 photos.remove 一致：带 CDN 域名的 URL 取 path；失败仅 console.error 不阻断
async function deleteMusicAssets(item: {
  musicUrl?: string | null;
  coverUrl?: string | null;
}) {
  const keys = [item.musicUrl, item.coverUrl].filter(
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

export const musicRouter = createTRPCRouter({
  // 获取公开音乐列表
  getMany: baseProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;

      const data = await ctx.db
        .select()
        .from(music)
        .where(eq(music.visibility, "public"))
        .orderBy(desc(music.createdAt))
        .limit(limit)
        .offset(offset);

      return data;
    }),

  // 获取所有音乐（管理后台用）
  getAll: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset, search } = input;

      const conditions = search
        ? or(
            like(music.title, `%${search}%`),
            like(music.artist, `%${search}%`),
            like(music.album, `%${search}%`)
          )
        : undefined;

      const data = await ctx.db
        .select()
        .from(music)
        .where(conditions)
        .orderBy(desc(music.createdAt))
        .limit(limit)
        .offset(offset);

      // 获取总数 - 使用 COUNT 替代加载所有行，where 与 data 保持一致
      const [countResult] = await ctx.db
        .select({ total: count() })
        .from(music)
        .where(conditions);
      const total = countResult.total;

      return { data, total };
    }),

  // 获取单个音乐（含 musicUrl，仅登录后可用）
  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [data] = await ctx.db
        .select()
        .from(music)
        .where(eq(music.id, input.id));

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "音乐不存在",
        });
      }

      return data;
    }),

  // 创建音乐
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, "标题不能为空"),
        artist: z.string().optional(),
        album: z.string().optional(),
        musicUrl: z.string().min(1, "音乐链接不能为空"),
        coverUrl: z.string().optional(),
        duration: z.number().optional(),
        fileSize: z.number().optional(),
        genre: z.string().optional(),
        visibility: z.enum(["public", "private"]).default("public"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [data] = await dualInsert(music, input).returning() as any;
      return data;
    }),

  // 更新音乐
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1, "标题不能为空").optional(),
        artist: z.string().optional(),
        album: z.string().optional(),
        musicUrl: z.string().min(1, "音乐链接不能为空").optional(),
        coverUrl: z.string().optional(),
        duration: z.number().optional(),
        fileSize: z.number().optional(),
        genre: z.string().optional(),
        visibility: z.enum(["public", "private"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      const [data] = await dualUpdate(music)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(music.id, id))
        .returning();

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "音乐不存在",
        });
      }

      return data;
    }),

  // 删除音乐
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [data] = await dualDelete(music)
        .where(eq(music.id, input.id))
        .returning();

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "音乐不存在",
        });
      }

      // DB 记录已删除，S3/COS 清理失败可接受孤儿文件
      await deleteMusicAssets(data);

      return { success: true, message: "音乐已删除" };
    }),

  // 批量删除音乐
  deleteMany: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string().uuid()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { ids } = input;

      const deleted = await dualDelete(music)
        .where(inArray(music.id, ids))
        .returning();

      // 循环删除 COS 上的音乐与封面文件
      for (const item of deleted) {
        await deleteMusicAssets(item);
      }

      return { success: true, message: `${ids.length} music items deleted` };
    }),
});
