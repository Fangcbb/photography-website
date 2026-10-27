/**
 * 音频代理 API - 网易云直链流式代理
 * GET /api/music/play?id=xxx
 */
import { NextRequest, NextResponse } from "next/server";

const API = process.env.MUSIC_API_BASE || "http://127.0.0.1:3333/api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    // 从本地 music-api 获取网易直链
    const urlRes = await fetch(`${API}/url?id=${id}&br=320000`, {
      signal: AbortSignal.timeout(10000),
    });
    const urlData = await urlRes.json();
    const audioUrl = urlData.data?.url;

    if (!audioUrl) {
      return NextResponse.json(
        { error: "Song unavailable (possibly VIP or no copyright)" },
        { status: 404 }
      );
    }

    // 流式获取音频（http直链需要转发）
    const range = request.headers.get("range");
    const upstreamHeaders: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
    if (range) upstreamHeaders["Range"] = range;
    const response = await fetch(audioUrl, {
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch audio" },
        { status: 502 }
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", "audio/mpeg");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Range");
    headers.set("Cache-Control", "no-store");

    if (response.headers.has("content-range")) {
      headers.set("Content-Range", response.headers.get("content-range") || "");
    }
    if (response.headers.has("accept-ranges")) {
      headers.set("Accept-Ranges", response.headers.get("accept-ranges") || "bytes");
    }

    return new NextResponse(response.body, {
      headers,
      status: response.status,
    });
  } catch (error) {
    console.error("Audio proxy error:", error);
    return NextResponse.json({ error: "Proxy failed" }, { status: 500 });
  }
}

// OPTIONS 请求处理 CORS 预检
export async function OPTIONS() {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Range");

  return new NextResponse(null, { status: 200, headers });
}
