import { headers } from "next/headers";
import { auth } from "./modules/auth/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // --- Auth redirect for dashboard ---
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  }

  // --- CSP nonce generation ---
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const cspHeader = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""} https://hm.baidu.com https://zz.bdstatic.com https://www.googletagmanager.com https://www.google-analytics.com`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://cnn.fangc.cc https://*.cos.ap-shanghai.myqcloud.com https://*.fangc.cc https://images.unsplash.com`,
    `font-src 'self' data:`,
    `connect-src 'self' https://*.fangc.cc https://*.cos.ap-shanghai.myqcloud.com https://hm.baidu.com`,
    `frame-ancestors 'self'`,
  ]
    .join("; ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Set CSP on response too (for CDN to forward)
  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
}

export const config = {
  matcher: [
    // Match all page routes, skip static assets and API
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)",
  ],
};
