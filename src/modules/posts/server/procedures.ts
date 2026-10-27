import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { count, desc, eq, ilike } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import { posts, postsInsertSchema, postsUpdateSchema } from "@/db/schema";
import { dualInsert, dualUpdate, dualDelete } from "@/db";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/modules/s3/lib/server-client";

export const postsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(postsInsertSchema)
    .mutation(async ({ ctx, input }) => {
      const values = input;

      const existingPost = await ctx.db
        .select()
        .from(posts)
        .where(eq(posts.slug, values.slug));

      if (existingPost.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "该 URL 别名已存在",
        });
      }

      const [newPost] = await dualInsert(posts, values).returning() as any;

      return newPost;
    }),
  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [data] = await dualDelete(posts)
        .where(eq(posts.id, input.id))
        .returning();

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文章不存在",
        });
      }

      // S3 delete after DB — orphan file is acceptable, inconsistent DB is not
      try {
        const raw = data.coverImage;
        if (raw && raw.length > 0) {
          let key = raw;
          if (/^https?:\/\//i.test(raw)) {
            const url = new URL(raw);
            key = url.pathname.replace(/^\/+/, "");
          }
          if (key) {
            const command = new DeleteObjectCommand({
              Bucket: process.env.S3_BUCKET_NAME,
              Key: key,
            });
            await s3Client.send(command);
          }
        }
      } catch (error) {
        console.error("S3 delete failed (orphan file):", error);
      }

      return data;
    }),
  update: protectedProcedure
    .input(postsUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      if (!id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const [updatedPost] = await dualUpdate(posts)
        .set({
          ...input,
        })
        .where(eq(posts.id, id))
        .returning();

      if (!updatedPost) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updatedPost;
    }),
  getOne: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [data] = await ctx.db
        .select()
        .from(posts)
        .where(eq(posts.slug, input.slug));

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文章不存在",
        });
      }

      return data;
    }),
  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().default(DEFAULT_PAGE),
        pageSize: z
          .number()
          .min(MIN_PAGE_SIZE)
          .max(MAX_PAGE_SIZE)
          .default(DEFAULT_PAGE_SIZE),
        search: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search } = input;

      const data = await ctx.db
        .select()
        .from(posts)
        .where(search ? ilike(posts.title, `%${search}%`) : undefined)
        .orderBy(desc(posts.createdAt), desc(posts.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const [total] = await ctx.db
        .select({
          count: count(),
        })
        .from(posts)
        .where(search ? ilike(posts.title, `%${search}%`) : undefined);

      const totalPages = Math.ceil(total.count / pageSize);

      return {
        items: data,
        total: total.count,
        totalPages,
      };
    }),
});
