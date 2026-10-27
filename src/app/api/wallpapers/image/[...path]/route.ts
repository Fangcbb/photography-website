import { NextRequest, NextResponse } from "next/server";

// Picsum 图片代理：浏览器直连 picsum.photos 可能被墙，经服务器中转
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const target = `https://picsum.photos/${path.join("/")}`;

  try {
    const range = request.headers.get("range") || undefined;
    const res = await fetch(target, {
      headers: range ? { Range: range } : undefined,
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok && res.status !== 206) {
      return NextResponse.json({ error: "image fetch failed" }, { status: 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("content-type") || "image/jpeg");
    headers.set("Cache-Control", "public, max-age=86400");
    const cr = res.headers.get("content-range");
    if (cr) headers.set("Content-Range", cr);
    const cl = res.headers.get("content-length");
    if (cl) headers.set("Content-Length", cl);

    return new NextResponse(res.body, { status: res.status, headers });
  } catch (e) {
    return NextResponse.json({ error: "proxy failed" }, { status: 502 });
  }
}
