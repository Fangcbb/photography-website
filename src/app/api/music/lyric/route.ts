/**
 * 获取歌词 API - 仅酷我
 * GET /api/music/lyric?id=xxx
 */
import { NextRequest, NextResponse } from "next/server";
import { kuwoProvider } from "@/lib/music/providers/kuwo";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");
  const lyricUrl = searchParams.get("url");

  try {
    let lyric = "";

    if (lyricUrl) {
      // 如果有 lyricUrl，直接获取
      try {
        const response = await fetch(lyricUrl);
        lyric = await response.text();
      } catch {
        lyric = "";
      }
    } else if (id) {
      // 否则通过 provider 获取
      lyric = await kuwoProvider.getLyric({
        id,
        mid: id,
        title: "",
        artist: "",
        album: "",
        cover: "",
        url: "",
        lyric: "",
        source: "kuwo",
        sourceLabel: "酷我",
      });
    }

    return NextResponse.json({ success: true, lyric });
  } catch (error) {
    console.error("Get lyric error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get lyric" },
      { status: 500 }
    );
  }
}
