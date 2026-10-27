import { NextRequest, NextResponse } from "next/server";

// Picsum 图片代理：浏览器直连 picsum.photos 可能被墙，经服务器中转
// PERF-02 加固：picsum 偶发抖动（连接重置/超时），失败自动重试 2 次；
// 上游成功时向 CDN 声明 7 天缓存（nginx 已放行该前缀），降低回源次数。
const UPSTREAM_TIMEOUT_MS = 15000;
const RETRIES = 2;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const target = `https://picsum.photos/${path.join("/")}`;
  const range = request.headers.get("range") || undefined;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(target, {
        headers: range ? { Range: range } : undefined,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        // picsum 会 302 到 fastly，跟随即可
        redirect: "follow",
      });

      if (!res.ok && res.status !== 206) {
        lastError = new Error(`upstream ${res.status}`);
        // 4xx（除429）重试无意义
        if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
        continue;
      }

      const headers = new Headers();
      headers.set("Content-Type", res.headers.get("content-type") || "image/jpeg");
      headers.set("Cache-Control", "public, max-age=604800");
      const cr = res.headers.get("content-range");
      if (cr) headers.set("Content-Range", cr);
      const cl = res.headers.get("content-length");
      if (cl) headers.set("Content-Length", cl);

      return new NextResponse(res.body, { status: res.status, headers });
    } catch (e) {
      lastError = e;
      // 短退避后重试
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }

  return NextResponse.json(
    { error: "image fetch failed", detail: String(lastError).slice(0, 200) },
    { status: 502 }
  );
}
