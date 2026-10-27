"use client";

import { useEffect } from "react";

/**
 * 前端异常上报。
 *
 * 捕获三类异常并 POST 到 `/api/log/client-error`，与服务端日志汇入同一份
 * JSONL（`~/logs/errors-YYYY-MM-DD.jsonl`）：
 *   1. window.onerror           —— 同步运行时错误
 *   2. unhandledrejection       —— 未处理的 Promise 拒绝（异步/接口错误）
 *   3. React ErrorBoundary      —— 通过 `reportError()` 手动上报
 *
 * 设计取舍：
 * - 相同错误 10 秒内只报一次，避免错误风暴写爆日志
 * - 过滤掉已知的浏览器噪音（ResizeObserver、扩展脚本报错等）
 * - 上报本身失败时静默，绝不产生二次异常
 */

const DEDUPE_WINDOW_MS = 10_000;
const recent = new Map<string, number>();

/** 已知噪音，不必记录 */
const IGNORE_PATTERNS = [
  /ResizeObserver loop/i,
  /Non-Error promise rejection captured/i,
  /^Script error\.?$/i, // 跨域脚本无法获取详情
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  /Failed to fetch dynamically imported module/i, // 常见于发版后旧 chunk 失效
];

function shouldIgnore(message: string): boolean {
  return IGNORE_PATTERNS.some((re) => re.test(message));
}

function dedupeKey(message: string, stack?: string): string {
  return `${message}::${(stack || "").slice(0, 200)}`;
}

export async function reportError(payload: {
  message: string;
  stack?: string;
  source?: "onerror" | "unhandledrejection" | "error-boundary" | "manual";
  componentStack?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    if (shouldIgnore(payload.message)) return;

    const key = dedupeKey(payload.message, payload.stack);
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUPE_WINDOW_MS) return;
    recent.set(key, now);

    // 控制 Map 大小
    if (recent.size > 200) {
      for (const [k, t] of recent) if (now - t > DEDUPE_WINDOW_MS) recent.delete(k);
    }

    await fetch("/api/log/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // keepalive 让上报在页面卸载/跳转时也能发出去
      keepalive: true,
      body: JSON.stringify({
        message: payload.message,
        stack: payload.stack,
        source: payload.source || "manual",
        componentStack: payload.componentStack,
        url: typeof window !== "undefined" ? window.location.href : undefined,
        meta: payload.meta,
      }),
    });
  } catch {
    /* 上报失败静默 */
  }
}

export function ErrorReporter() {
  useEffect(() => {
    // 开发环境只打印，不污染生产日志
    const isDev = process.env.NODE_ENV === "development";

    const onError = (event: ErrorEvent) => {
      const message = event.message || "未知错误";
      if (isDev) {
        console.error("[ErrorReporter]", message, event.error);
        return;
      }
      void reportError({
        message,
        stack: event.error?.stack,
        source: "onerror",
        meta: { filename: event.filename, lineno: event.lineno, colno: event.colno },
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "未处理的 Promise 拒绝";
      if (isDev) {
        console.error("[ErrorReporter] unhandledrejection", reason);
        return;
      }
      void reportError({
        message,
        stack: reason instanceof Error ? reason.stack : undefined,
        source: "unhandledrejection",
        meta: { reasonType: typeof reason },
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
