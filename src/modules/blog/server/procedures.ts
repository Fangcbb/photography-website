import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { desc, eq, and, sql } from "drizzle-orm";
import { posts } from "@/db/schema";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const blogRouter = createTRPCRouter({
  getMany: baseProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(10),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;

      // Get total count efficiently using count()
      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .where(eq(posts.visibility, "public"));

      const total = countResult?.count ?? 0;

      // Get paginated data
      const data = await ctx.db
        .select()
        .from(posts)
        .where(eq(posts.visibility, "public"))
        .orderBy(desc(posts.updatedAt))
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
        .from(posts)
        .where(and(eq(posts.slug, input.slug), eq(posts.visibility, "public")));

      if (!data) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return data;
    }),
});
