import { NextRequest, NextResponse } from "next/server";
import { handlePhotoProxy } from "@/lib/photo-proxy-handler";

export const dynamic = "force-dynamic";

/**
 * 旧路径：/api/photo/[id]
 *
 * 保留以兼容历史分享链接、已抓取的 og:image 与 CDN 旧缓存。
 * 新代码请使用 /api/photo/v2/[id]（见 photoProxyUrl）。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handlePhotoProxy(request.nextUrl.searchParams, id);
}
