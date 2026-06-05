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

  plugins: [nextCookies()],

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // 彻底禁用注册接口（但保留登录功能）
      if (ctx.path.endsWith("/sign-up/email")) {
        throw new APIError("FORBIDDEN", {
          message: "Registration is disabled.",
        });
      }
    }),
  },
});
