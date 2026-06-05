import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const variant = request.nextUrl.searchParams.get("v") || "display";

  try {
    // 查询照片 URL
    const [photo] = await db
      .select({ url: photos.url })
      .from(photos)
      .where(eq(photos.id, id))
      .limit(1);

    if (!photo?.url) {
      return new NextResponse("Photo not found", { status: 404 });
    }

    // 构建 COS URL
    const baseUrl = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || "";
    const cosUrl = variant
      ? `${baseUrl}/${photo.url}/${variant}`
      : `${baseUrl}/${photo.url}`;

    // 代理请求 COS
    const response = await fetch(cosUrl, {
      headers: {
        "User-Agent": "FangC-Photo-Proxy/1.0",
      },
    });

    if (!response.ok) {
      return new NextResponse("Image not found", { status: 404 });
    }

    // 转发响应，隐藏 COS 来源
    const headers = new Headers();
    headers.set("Content-Type", response.headers.get("content-type") || "image/jpeg");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("X-Content-Type-Options", "nosniff");

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
