/**
 * 音频代理 API - 解决 CORS 问题（流式传输）
 * GET /api/music/play?id=xxx
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    // 酷我音频 URL
    const audioUrl = `https://kw-api.cenguigui.cn/?id=${id}&type=song&level=exhigh&format=mp3`;
    
    // 流式获取音频
    const response = await fetch(audioUrl);
    
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch audio" }, { status: 500 });
    }

    // 获取原始 URL（重定向后的 URL）
    const audioUrlFinal = response.url || audioUrl;
    
    // 流式传输响应
    const headers = new Headers();
    headers.set("Content-Type", "audio/mpeg");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Range");
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("X-Audio-Url", audioUrlFinal);
    
    // 支持 Range 请求（播放器 seek 时需要）
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
