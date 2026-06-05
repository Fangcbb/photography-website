/**
 * 获取音乐播放链接 API - 仅酷我
 * GET /api/music/url?id=xxx&url=xxx
 */
import { NextRequest, NextResponse } from "next/server";
import { kuwoProvider } from "@/lib/music/providers/kuwo";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");
  const url = searchParams.get("url");
  const trackJson = searchParams.get("track");

  try {
    // 如果有 track 对象，直接从中获取 URL
    if (trackJson) {
      try {
        const track = JSON.parse(trackJson);
        if (track.url) {
          return NextResponse.json({ success: true, url: track.url });
        }
      } catch {
        // ignore parse error
      }
    }

    // 如果有 url 参数，直接返回
    if (url) {
      return NextResponse.json({ success: true, url });
    }

    // 否则通过 provider 获取
    if (id) {
      const playUrl = await kuwoProvider.getPlayUrl({
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
      return NextResponse.json({ success: true, url: playUrl });
    }

    return NextResponse.json({ success: true, url: "" });
  } catch (error) {
    console.error("Get url error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get url" },
      { status: 500 }
    );
  }
}
