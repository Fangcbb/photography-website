import { db } from "@/db";
import { cache } from "react";
import superjson from "superjson";
import { initTRPC, TRPCError } from "@trpc/server";
import { getSession } from "@/modules/auth/lib/get-session";
import { log } from "@/lib/logger";

export const createTRPCContext = cache(async () => {
  return { db };
});

type Context = {
  db: typeof db;
  /** protectedProcedure 注入，用于错误日志关联用户 */
  auth?: { id: string; email: string } | null;
};

/**
 * 这些错误码属于"业务预期内"的拒绝，不是系统故障：
 * 未登录访问受保护接口、找不到资源、参数校验失败等。
 * 单独标记 expected=true，查询日志时默认折叠，避免淹没真正的异常。
 */
const EXPECTED_CODES = new Set([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "BAD_REQUEST",
  "PARSE_ERROR",
  "TOO_MANY_REQUESTS",
]);

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  /**
   * 全局错误记录：任何 tRPC 调用失败都会落一条结构化日志，
   * 包含 procedure 路径、错误码、堆栈、关联用户。
   */
  errorFormatter({ shape, error, path, ctx }) {
    const code = error.code;
    const expected = EXPECTED_CODES.has(code);
    const cause = error.cause instanceof Error ? error.cause : null;

    void log({
      level: expected ? "warn" : "error",
      source: "trpc",
      message: cause?.message || error.message || "tRPC 调用失败",
      path,
      code,
      // 预期内的拒绝（未登录、找不到等）不记堆栈：量最大且无诊断价值，
      // 记下来会让日志文件膨胀十几倍，真正需要看堆栈的异常反而被淹没。
      stack: expected ? undefined : (cause?.stack || error.stack)?.slice(0, 4000),
      user: ctx?.auth?.email ?? null,
      expected,
      meta: {
        trpcCode: code,
        // Zod 校验失败时附上字段问题，便于定位表单报错
        ...(code === "BAD_REQUEST" && error.cause
          ? { cause: JSON.stringify(error.cause).slice(0, 1000) }
          : {}),
      },
    });

    return shape;
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    const session = await getSession();

    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
      });
    }

    return next({
      ctx: {
        ...ctx,
        auth: { id: session.user.id, email: session.user.email },
      },
    });
  })
);
