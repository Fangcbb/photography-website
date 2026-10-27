import { NextRequest, NextResponse } from "next/server";

export const revalidate = 60;

// Picsum Photos（免费、无需 key，图片来自 Unsplash）
// 作为 Unsplash API 的替代（原 UNSPLASH_ACCESS_KEY 未配置，接口失效）
const PICSUM_LIST = "https://picsum.photos/v2/list";

function picsumImage(id: string, w: number, h: number) {
  return `/api/wallpapers/image/id/${id}/${w}/${h}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(
      30,
      Math.max(1, parseInt(searchParams.get("per_page") || "20", 10))
    );

    // Picsum 每页固定 100 条，按页计算起点
    const listPage = Math.floor(((page - 1) * perPage) / 100) + 1;
    const start = ((page - 1) * perPage) % 100;

    const res = await fetch(`${PICSUM_LIST}?page=${listPage}&limit=100`, {
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`Picsum API error: ${res.status}`);
    }

    const list: Array<{
      id: string;
      author: string;
      width: number;
      height: number;
      url: string;
      download_url: string;
    }> = await res.json();

    const slice = list.slice(start, start + perPage);

    const photos = slice.map((p) => {
      const w = 1920;
      const h = Math.round((p.height / p.width) * 1920);
      return {
        id: p.id,
        width: p.width,
        height: p.height,
        blur_hash: null,
        description: `Photo by ${p.author}`,
        alt_description: `Photo by ${p.author}`,
        urls: {
          raw: picsumImage(p.id, w, h),
          full: picsumImage(p.id, w, h),
          regular: picsumImage(p.id, 1280, Math.round((p.height / p.width) * 1280)),
          small: picsumImage(p.id, 640, Math.round((p.height / p.width) * 640)),
          thumb: picsumImage(p.id, 400, Math.round((p.height / p.width) * 400)),
        },
        links: {
          html: p.url,
        },
        user: {
          name: p.author,
          username: p.author,
          links: {
            html: p.url,
          },
        },
      };
    });

    // Picsum 总量约 1000 张
    return NextResponse.json({
      photos,
      total: 1000,
      page,
      perPage,
      topic: "wallpapers",
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Wallpapers API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallpapers" },
      { status: 500 }
    );
  }
}
