FROM node:22-alpine AS base

# ---- Install dependencies ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false

# ---- Development / Standalone mode (runtime build) ----
FROM base AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]

# ---- Build stage (for cloud mode pre-built images) ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG DATABASE_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_S3_PUBLIC_URL
ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
# SSG 页在构建期会导入 db 触发 validateServerEnv，需要提供构建期占位值
# （真实密钥在运行时注入，不要烘焙进镜像）
ARG S3_ENDPOINT
ARG S3_BUCKET_NAME
ARG S3_ACCESS_KEY_ID
ARG S3_SECRET_ACCESS_KEY
ARG BETTER_AUTH_SECRET
ARG BETTER_AUTH_URL
ENV S3_ENDPOINT=$S3_ENDPOINT \
    S3_BUCKET_NAME=$S3_BUCKET_NAME \
    S3_ACCESS_KEY_ID=$S3_ACCESS_KEY_ID \
    S3_SECRET_ACCESS_KEY=$S3_SECRET_ACCESS_KEY \
    BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET \
    BETTER_AUTH_URL=$BETTER_AUTH_URL
RUN npm run build

# ---- Production runner (optimized standalone output) ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# 健康检查使用 curl，需要在基础镜像中安装
RUN apk add --no-cache curl

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
