import { NextResponse } from "next/server";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/modules/auth/lib/get-session";

/**
 * 图片代理的共享实现，被以下两个路由复用：
 *   - /api/photo/[id]      旧路径，保留以兼容历史分享链接与已缓存的 og:image
 *   - /api/photo/v2/[id]   新路径，用于绕过 CDN 对 query 参数的过滤
 *
 * 为什么需要 v2 路径：CDN 配置了参数过滤，`?v=fangb&r=2` 与 `?v=fangb`
 * 会被视为同一个缓存键，导致旧的超大图（1.5~4MB）一直命中缓存无法更新。
 * 把版本放进路径后，缓存键彻底变化，必然回源到新逻辑。
 *
 * 变体 → 腾讯云数据万象（CI）实时处理参数：
 *   fangb   800px 宽 / WebP / q80   （卡片、缩略图、地图标记）
 *   thumb   400px 宽 / WebP / q75   （更小的列表缩略图）
 *   display 1920px 宽 / WebP / q82  （轮播、详情、屏保、地图弹窗）
 *   live    Live Photo 视频，不做图片处理
 */
const VARIANT_PRESETS = {
  fangb: { width: 800, quality: 80 },
  thumb: { width: 400, quality: 75 },
  display: { width: 1920, quality: 82 },
  /**
   * 全屏高度封面（城市详情页左侧大图、旅行列表页当前城市封面）。
   *
   * 这类容器是 `h-screen` + `object-cover`，横版图要填满 1080px 高，
   * 宽度需达到 1080 × 16/9 ≈ 1920px；1440p 屏则需 2560px。
   * 用 800px 会被放大 2.4 倍，肉眼可见模糊，故单列一档。
   */
  hero: { width: 2560, quality: 85 },
} as const;

type VariantKey = keyof typeof VARIANT_PRESETS;

const isPresetVariant = (v: string): v is VariantKey =>
  Object.prototype.hasOwnProperty.call(VARIANT_PRESETS, v);

export async function handlePhotoProxy(
  searchParams: URLSearchParams,
  id: string
): Promise<NextResponse> {
  const requestedVariant = searchParams.get("v") || "display";

  try {
    const [photo] = await db
      .select({
        url: photos.url,
        visibility: photos.visibility,
        livePhotoVideoUrl: photos.livePhotoVideoUrl,
        isLivePhoto: photos.isLivePhoto,
      })
      .from(photos)
      .where(eq(photos.id, id))
      .limit(1);

    if (!photo?.url) {
      return new NextResponse("Photo not found", { status: 404 });
    }

    /**
     * 可见性闸门（重要）。
     *
     * 这个代理曾经只按 id 取 url，不校验 visibility，且响应头是
     * `public, max-age=31536000, immutable` —— 结果是「把照片设为 private」
     * 对任何已拿到 id 的人都不生效，而且 CDN 会把内容缓存一年，事后无法撤回。
     *
     * 现在的规则：
     * - public：任何人可读，允许长缓存
     * - private：必须登录，且响应 private/no-store，绝不进 CDN
     * - 未登录访问 private：返回 404 而不是 403，避免泄露「该 id 存在」
     */
    const isPublic = photo.visibility === "public";
    if (!isPublic) {
      const session = await getSession().catch(() => null);
      if (!session) {
        return new NextResponse("Photo not found", { status: 404 });
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || "";
    let candidates: string[];

    if (requestedVariant === "live") {
      if (!photo.isLivePhoto || !photo.livePhotoVideoUrl) {
        return new NextResponse("Live Photo video not found", { status: 404 });
      }
      candidates = [`${baseUrl}/${photo.livePhotoVideoUrl}`];
    } else {
      const encodedKey = photo.url
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");

      const preset = isPresetVariant(requestedVariant)
        ? VARIANT_PRESETS[requestedVariant]
        : VARIANT_PRESETS.display;

      const ci =
        `imageMogr2/thumbnail/${preset.width}x` +
        `/format/webp/quality/${preset.quality}/strip`;

      candidates = [
        // 首选：数据万象实时处理（等比缩放 + WebP + 质量 + 去元数据）
        `${baseUrl}/${encodedKey}?${ci}`,
        // 次选：COS 命名样式（兼容个别 CI 无法处理的源文件）
        `${baseUrl}/${encodedKey}/${requestedVariant}`,
        // 兜底：原图
        `${baseUrl}/${encodedKey}`,
      ];
    }

    // 依次尝试候选 URL，第一个成功即返回
    let response: Response | null = null;
    for (const candidate of candidates) {
      const attempt = await fetch(candidate, {
        headers: {
          "User-Agent": "FangC-Photo-Proxy/1.0",
          Accept: "image/webp,image/*,*/*;q=0.8",
        },
      });
      if (attempt.ok) {
        response = attempt;
        break;
      }
      attempt.body?.cancel().catch(() => {});
    }

    if (!response) {
      return new NextResponse("Resource not found", { status: 404 });
    }

    const headers = new Headers();
    const contentType =
      requestedVariant === "live"
        ? "video/quicktime"
        : response.headers.get("content-type") || "image/webp";

    headers.set("Content-Type", contentType);
    if (isPublic) {
      // 公开图不依赖 Cookie，允许 CDN 长缓存
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      // 私有图按 Cookie 区分身份，绝不能进共享缓存
      headers.set("Cache-Control", "private, no-store, max-age=0");
      headers.set("Vary", "Cookie");
    }
    headers.set("X-Content-Type-Options", "nosniff");

    return new NextResponse(response.body, { status: 200, headers });
  } catch (error) {
    console.error("Image proxy error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
