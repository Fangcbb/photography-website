import { NextRequest, NextResponse } from "next/server";
import { handlePhotoProxy } from "@/lib/photo-proxy-handler";

export const dynamic = "force-dynamic";

/**
 * 新路径：/api/photo/v2/[id]
 *
 * 用路径段承载版本号，避免 CDN 的参数过滤把 `?v=fangb&r=2` 与 `?v=fangb`
 * 归为同一个缓存键，导致旧的超大图持续命中缓存。
 *
 * 用法与旧路径一致：/api/photo/v2/{photoId}?v=fangb|thumb|display|live
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handlePhotoProxy(request.nextUrl.searchParams, id);
}
