import { NextRequest } from "next/server";
import { handlePhotoProxy } from "@/lib/photo-proxy-handler";

export const dynamic = "force-dynamic";

/**
 * 变体路径段：/api/photo/v2/[id]/[variant]
 *
 * 变体（fangb/thumb/display/hero/live）作为路径段承载，使各变体拥有独立缓存键，
 * 避免 CDN 过滤 query 参数导致 thumb/hero/live 相互污染。语义与旧的 ?v= 完全一致。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variant: string }> }
) {
  const { id, variant } = await params;
  const searchParams = new URLSearchParams();
  searchParams.set("v", variant);
  return handlePhotoProxy(searchParams, id);
}
