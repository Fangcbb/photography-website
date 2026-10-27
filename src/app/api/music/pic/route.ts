/**
 * 封面图片代理 API - 网易封面同源代理（供 colorthief canvas 取色，避免跨域污染）
 * GET /api/music/pic?u=<https://pX.music.126.net/...>
 *
 * 安全：仅允许 https://*.music.126.net 的 URL（严格正则白名单），无通用转发。
 */
import { NextRequest, NextResponse } from "next/server";

const ALLOWED = /^https:\/\/p\d?\.music\.126\.net\/[\w=/-]+\.(jpg|jpeg|png|webp|gif)(\?.*)?$/;

export async function GET(request: NextRequest) {
  const u = request.nextUrl.searchParams.get("u");
  if (!u || !ALLOWED.test(u)) {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }
  try {
    const sized = u + (u.includes("?") ? "&" : "?") + "param=1024y1024";
    const upstream = await fetch(sized, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://music.163.com" },
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "upstream error" }, { status: 502 });
    }
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
