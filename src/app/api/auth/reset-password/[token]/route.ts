import { NextResponse } from "next/server";

// better-auth 生成的邮件链接落在 API 路径 /api/auth/reset-password/<token>，
// 这里把 GET 转发到真正的重置页面 /reset-password/<token>。
// POST（无 token 段）仍由 better-auth 的 API 处理，不受影响。
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const url = new URL(request.url);
  const search = url.searchParams.toString();
  const target = `/reset-password/${encodeURIComponent(token)}${search ? `?${search}` : ""}`;
  // 相对 Location，避免反代/CDN 环境下生成 localhost 绝对地址
  return new NextResponse(null, {
    status: 307,
    headers: { Location: target },
  });
}
