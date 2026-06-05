/**
 * 统一音乐搜索 API - 仅酷我
 * GET /api/music/search?keyword=xxx
 */
import { NextRequest, NextResponse } from "next/server";
import { kuwoProvider } from "@/lib/music/providers/kuwo";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const keyword = searchParams.get("keyword") || "";
  const limit = parseInt(searchParams.get("limit") || "35", 10);

  if (!keyword) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }

  try {
    // 只使用酷我音乐
    const result = await kuwoProvider.search(keyword, limit);

    return NextResponse.json({
      success: true,
      data: {
        tracks: result.tracks,
        sources: ["kuwo"],
        total: result.tracks.length,
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { success: false, error: "Search failed" },
      { status: 500 }
    );
  }
}
