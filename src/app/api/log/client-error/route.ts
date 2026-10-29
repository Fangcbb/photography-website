import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 浏览器端异常上报端点。
 *
 * 前端 `ErrorReporter` 会把 window.onerror / unhandledrejection /
 * React ErrorBoundary 捕获到的异常 POST 到这里，与服务端日志汇入同一份 JSONL。
 *
 * 防滥用：
 * - 单条字段长度截断（防止超长堆栈写爆磁盘）
 * - 同 IP 每分钟最多 30 条，超出静默丢弃并返回 204
 */

const MAX_MESSAGE_LEN = 2000;
const MAX_STACK_LEN = 8000;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_META_LEN = 8192;
const RATE_LIMIT_PER_MIN = 30;

const bodySchema = z.object({
  message: z.string().min(1),
  stack: z.string().optional(),
  source: z.enum(["onerror", "unhandledrejection", "error-boundary", "manual"]).default("onerror"),
  url: z.string().optional(),
  line: z.number().optional(),
  column: z.number().optional(),
  componentStack: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

// 简单的进程内限流（PM2 cluster 下每个 worker 独立计数，足以防误报刷屏）
const buckets = new Map<string, { count: number; resetAt: number }>();

function hitRateLimit(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + 60_000 });
    // 顺手清理过期桶，避免 Map 无限增长
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
    }
    return false;
  }
  b.count += 1;
  return b.count > RATE_LIMIT_PER_MIN;
}

function clip(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max) + "…(truncated)" : s;
}

// meta 是任意对象，序列化前限制总长度，避免匿名上报放大磁盘/内存消耗
function clipMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {};
  const s = JSON.stringify(meta);
  if (s.length <= MAX_META_LEN) return meta;
  return { truncated: true, preview: s.slice(0, MAX_META_LEN) };
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (hitRateLimit(ip)) {
    return new NextResponse(null, { status: 204 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "body too large" }, { status: 413 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    parsed = bodySchema.parse(json);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  await log({
    level: "error",
    source: "client",
    message: clip(parsed.message, MAX_MESSAGE_LEN)!,
    stack: clip(parsed.stack, MAX_STACK_LEN),
    url: clip(parsed.url, 1000),
    userAgent: clip(request.headers.get("user-agent") || undefined, 400),
    meta: {
      // 客户端 meta 先展开，服务端可信字段最后赋值，防止覆盖 ip/kind/componentStack
      ...clipMeta(parsed.meta),
      kind: parsed.source,
      line: parsed.line,
      column: parsed.column,
      componentStack: clip(parsed.componentStack, 4000),
      ip,
    },
  });

  return NextResponse.json({ ok: true });
}
