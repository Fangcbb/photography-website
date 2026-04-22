import { createTRPCRouter, baseProcedure, protectedProcedure } from "@/trpc/init";
import { desc, eq, and, like, or, count, inArray } from "drizzle-orm";
import { music } from "@/db/schema";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

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

      let query = ctx.db.select().from(music);

      if (search) {
        const conditions = or(
          like(music.title, `%${search}%`),
          like(music.artist, `%${search}%`),
          like(music.album, `%${search}%`)
        );
        query = query.where(conditions);
      }

      const data = await query
        .orderBy(desc(music.createdAt))
        .limit(limit)
        .offset(offset);

      // 获取总数 - 使用 COUNT 替代加载所有行
      const [countResult] = await ctx.db
        .select({ total: count() })
        .from(music);
      const total = countResult.total;

      return { data, total };
    }),

  // 获取单个音乐
  getOne: baseProcedure
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
          message: "Music not found",
        });
      }

      return data;
    }),

  // 创建音乐
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, "Title is required"),
        artist: z.string().optional(),
        album: z.string().optional(),
        musicUrl: z.string().min(1, "Music URL is required"),
        coverUrl: z.string().optional(),
        duration: z.number().optional(),
        fileSize: z.number().optional(),
        genre: z.string().optional(),
        visibility: z.enum(["public", "private"]).default("public"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [data] = await ctx.db.insert(music).values(input).returning();
      return data;
    }),

  // 更新音乐
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1, "Title is required").optional(),
        artist: z.string().optional(),
        album: z.string().optional(),
        musicUrl: z.string().min(1, "Music URL is required").optional(),
        coverUrl: z.string().optional(),
        duration: z.number().optional(),
        fileSize: z.number().optional(),
        genre: z.string().optional(),
        visibility: z.enum(["public", "private"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      const [data] = await ctx.db
        .update(music)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(music.id, id))
        .returning();

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Music not found",
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
      const [data] = await ctx.db
        .delete(music)
        .where(eq(music.id, input.id))
        .returning();

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Music not found",
        });
      }

      return { success: true, message: "Music deleted" };
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

      await ctx.db.delete(music).where(inArray(music.id, ids));

      return { success: true, message: `${ids.length} music items deleted` };
    }),
});
