import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, APIError } from "better-auth/api";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { nextCookies } from "better-auth/next-js";
import { count } from "drizzle-orm";

export const auth = betterAuth({
  trustedOrigins: [
    "https://fangc.cc",
    "https://www.fangc.cc",
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60 * 60, max: 5 },
    },
  },

  plugins: [nextCookies()],

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // 彻底禁用注册接口（但保留登录功能）。仅在显式设置 ALLOW_SIGNUP=true 时
      // 放开，用于 seed:user 首次初始化管理员。
      if (
        ctx.path.endsWith("/sign-up/email") &&
        process.env.ALLOW_SIGNUP !== "true"
      ) {
        throw new APIError("FORBIDDEN", {
          message: "已停用注册。",
        });
      }
    }),
  },
});
