import type { Metadata } from "next";

// 与 (home)/music/layout.tsx 同理：use client 页面若被静态预渲染，
// 内联 RSC payload / 主题脚本无 nonce 会被 CSP 拦 → hydration 失败。
// server layout 加 force-dynamic 强制动态渲染注入 nonce。
export const dynamic = "force-dynamic";

export default function ToolsFrameLayout({ children }: { children: React.ReactNode }) {
  return children;
}
