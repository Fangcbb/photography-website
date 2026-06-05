import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const UNSPLASH_API = "https://api.unsplash.com";

function getTopic(): string {
  try {
    // Read topic from shared config file
    const configPath = join(process.cwd(), ".wallpaper-topic");
    const topic = readFileSync(configPath, "utf-8").trim();
    return topic || "wallpapers";
  } catch {
    return "wallpapers";
  }
}

async function fetchFromUnsplash(page: number, perPage: number) {
  if (!UNSPLASH_ACCESS_KEY) {
    throw new Error("UNSPLASH_ACCESS_KEY not configured");
  }

  const topic = getTopic();
  const url = new URL(`${UNSPLASH_API}/topics/${topic}/photos`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("order_by", "latest");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
      "Accept-Version": "v1",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Unsplash API error:", res.status, text);
    throw new Error(`Unsplash API error: ${res.status}`);
  }

  const data = await res.json();

  // Topics API returns array directly, Search API returns {results: []}
  const photos = Array.isArray(data) ? data : data.results || [];

  return {
    photos: photos.map((photo: Record<string, unknown>) => ({
      id: photo.id,
      width: photo.width,
      height: photo.height,
      blur_hash: photo.blur_hash,
      description: photo.description,
      alt_description: photo.alt_description,
      urls: {
        raw: (photo.urls as Record<string, string>).raw,
        full: (photo.urls as Record<string, string>).full,
        regular: (photo.urls as Record<string, string>).regular,
        small: (photo.urls as Record<string, string>).small,
        thumb: (photo.urls as Record<string, string>).thumb,
      },
      links: {
        html: (photo.links as Record<string, string>).html,
      },
      user: {
        name: (photo.user as Record<string, unknown>).name,
        username: (photo.user as Record<string, unknown>).username,
        links: {
          html: (photo.user as Record<string, Record<string, string>>).links
            .html,
        },
      },
    })),
    total: data.total,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(
      30,
      Math.max(1, parseInt(searchParams.get("per_page") || "20", 10))
    );

    const result = await fetchFromUnsplash(page, perPage);

    return NextResponse.json({
      photos: result.photos,
      total: result.total,
      page,
      perPage,
      topic: getTopic(),
    });
  } catch (error) {
    console.error("Wallpapers API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallpapers" },
      { status: 500 }
    );
  }
}
