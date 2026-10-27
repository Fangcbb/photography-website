/**
 * 获取歌词 API
 *
 * GET /api/music/lyric?id=xxx
 *
 * 安全说明（2026-10 修复）：
 * 旧实现接受任意 `url` 查询参数并直接 fetch + 原样返回响应体，构成
 * **匿名、有回显的 SSRF**（可读取 127.0.0.1:3333 的 music-api、云元数据端点、
 * 内网 HTTP 服务）。这里彻底移除该能力：只允许通过 provider + id 取歌词。
 *
 * 如果将来确实需要拉取外部歌词 URL，必须满足全部条件后再加回来：
 *   1. 协议仅 https
 *   2. host 命中允许列表
 *   3. DNS 解析后所有 IP 均非私网/环回/链路本地
 *   4. redirect: "manual"，逐跳重新校验
 *   5. 5s 超时 + 256KB 读取上限
 */
import { NextRequest, NextResponse } from "next/server";
import { neteaseProvider } from "@/lib/music/providers/netease";

const MAX_ID_LENGTH = 64;

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  // 旧客户端可能仍带 url 参数：显式拒绝，避免被当成「静默忽略」后继续误用
  if (request.nextUrl.searchParams.has("url")) {
    return NextResponse.json(
      { success: false, error: "url 参数已停用，请改用 id" },
      { status: 400 },
    );
  }

  if (!id || id.length > MAX_ID_LENGTH) {
    return NextResponse.json(
      { success: false, error: "缺少或非法的 id" },
      { status: 400 },
    );
  }

  try {
    const lyric = await neteaseProvider.getLyric({
      id,
      mid: id,
      title: "",
      artist: "",
      album: "",
      cover: "",
      url: "",
      lyric: "",
      source: "netease",
      sourceLabel: "网易云",
    });

    return NextResponse.json({ success: true, lyric });
  } catch (error) {
    console.error("Get lyric error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get lyric" },
      { status: 500 },
    );
  }
}
