import { appendFile, mkdir, readdir, readFile, unlink } from "fs/promises";
import os from "os";
import path from "path";

/**
 * 结构化错误日志。
 *
 * 为什么需要它：这个站点的错误过去只出现在 `pm2 logs` 的滚屏里，
 * 排查时要靠翻日志、猜时间点，AI 接手时更无从下手。
 * 这里把所有异常（服务端 / tRPC / 前端上报）统一写成 JSONL，
 * 一条错误一行 JSON，便于 grep、jq、脚本统计和后续 AI 分析。
 *
 * 存储位置：`$LOG_DIR` 或 `~/logs/`（**不放在项目目录内**，
 * 否则 `output: standalone` 重新构建时会被清掉）。
 * 文件按天切分：`errors-YYYY-MM-DD.jsonl`，保留 14 天。
 */

const LOG_DIR = process.env.LOG_DIR || path.join(os.homedir(), "logs");
const RETENTION_DAYS = 14;

export type LogLevel = "error" | "warn" | "info";

/** 错误来源，便于按通道过滤 */
export type LogSource =
  | "trpc"        // tRPC procedure 抛出的错误
  | "api"         // Route Handler 内部异常
  | "client"      // 浏览器上报（onerror / unhandledrejection / ErrorBoundary）
  | "rsc"         // React Server Component 渲染异常
  | "upload";     // 上传链路

export interface LogEntry {
  level: LogLevel;
  source: LogSource;
  message: string;
  /** tRPC 的 procedure 路径，如 `video.getAll` */
  path?: string;
  /** 错误码，如 UNAUTHORIZED / INTERNAL_SERVER_ERROR / 具体 HTTP 状态 */
  code?: string;
  stack?: string;
  /** 关联用户，便于判断是否与权限相关 */
  user?: string | null;
  /** 请求 URL */
  url?: string;
  userAgent?: string;
  /** 是否属于预期内错误（如未登录导致的 UNAUTHORIZED），查询时可过滤 */
  expected?: boolean;
  /** 任意附加信息 */
  meta?: Record<string, unknown>;
}

interface StoredEntry extends LogEntry {
  ts: string;
}

function todayFile(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return path.join(LOG_DIR, `errors-${ymd}.jsonl`);
}

async function ensureDir() {
  try {
    await mkdir(LOG_DIR, { recursive: true });
  } catch {
    /* 目录已存在 */
  }
}

/**
 * 写入一条日志。**永不抛错** —— 日志失败不能影响主流程。
 */
export async function log(entry: LogEntry): Promise<void> {
  const stored: StoredEntry = { ts: new Date().toISOString(), ...entry };

  // 同时输出到 stderr/stdout，保留 pm2 logs 里的可读性
  const line = `[${stored.level.toUpperCase()}][${stored.source}] ${stored.path ? stored.path + " " : ""}${stored.message}`;
  if (stored.level === "error") console.error(line);
  else if (stored.level === "warn") console.warn(line);
  else console.log(line);

  try {
    await ensureDir();
    // JSONL：单行追加，并发写入下也是原子的（小于 PIPE_BUF）
    await appendFile(todayFile(), JSON.stringify(stored) + "\n", "utf8");
  } catch (e) {
    console.error("[logger] 写入日志文件失败:", e);
  }
}

/** 便捷方法：记录错误 */
export function logError(
  source: LogSource,
  message: string,
  extra: Partial<Omit<LogEntry, "level" | "source" | "message">> = {}
) {
  // fire-and-forget，调用方无需 await
  void log({ level: "error", source, message, ...extra });
}

/** 便捷方法：记录警告 */
export function logWarn(
  source: LogSource,
  message: string,
  extra: Partial<Omit<LogEntry, "level" | "source" | "message">> = {}
) {
  void log({ level: "warn", source, message, ...extra });
}

/** 清理超过保留期的日志文件 */
export async function pruneOldLogs(): Promise<number> {
  try {
    const files = await readdir(LOG_DIR);
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const f of files) {
      const m = f.match(/^errors-(\d{4}-\d{2}-\d{2})\.jsonl$/);
      if (!m) continue;
      const t = new Date(`${m[1]}T00:00:00Z`).getTime();
      if (Number.isFinite(t) && t < cutoff) {
        await unlink(path.join(LOG_DIR, f));
        removed++;
      }
    }
    return removed;
  } catch {
    return 0;
  }
}

export interface ReadLogsOptions {
  /** 只读最近 N 天，默认 3 */
  days?: number;
  /** 最多返回条数，默认 200 */
  limit?: number;
  /** 按 level 过滤 */
  level?: LogLevel;
  /** 按 source 过滤 */
  source?: LogSource;
  /** 是否包含 expected（预期内）错误，默认 false */
  includeExpected?: boolean;
  /** 关键字匹配（message/path/code） */
  search?: string;
}

/** 读取最近的日志（倒序，最新在前） */
export async function readLogs(opts: ReadLogsOptions = {}): Promise<StoredEntry[]> {
  const { days = 3, limit = 200, level, source, includeExpected = false, search } = opts;

  let files: string[] = [];
  try {
    files = (await readdir(LOG_DIR))
      .filter((f) => /^errors-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .sort()
      .slice(-days);
  } catch {
    return [];
  }

  const entries: StoredEntry[] = [];
  for (const f of files) {
    try {
      const content = await readFile(path.join(LOG_DIR, f), "utf8");
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line) as StoredEntry;
          if (level && e.level !== level) continue;
          if (source && e.source !== source) continue;
          if (!includeExpected && e.expected) continue;
          if (search) {
            const hay = `${e.message} ${e.path || ""} ${e.code || ""} ${e.stack || ""}`.toLowerCase();
            if (!hay.includes(search.toLowerCase())) continue;
          }
          entries.push(e);
        } catch {
          /* 跳过损坏行 */
        }
      }
    } catch {
      /* 文件读不到就跳过 */
    }
  }

  // 时间倒序
  entries.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  return entries.slice(0, limit);
}

/** 统计概览：按 source / code 分组计数 */
export async function summarizeLogs(days = 7): Promise<{
  total: number;
  bySource: Record<string, number>;
  byCode: Record<string, number>;
  byDay: Record<string, number>;
}> {
  const entries = await readLogs({ days, limit: 10000, includeExpected: true });
  const bySource: Record<string, number> = {};
  const byCode: Record<string, number> = {};
  const byDay: Record<string, number> = {};

  for (const e of entries) {
    bySource[e.source] = (bySource[e.source] || 0) + 1;
    const code = e.code || "(none)";
    byCode[code] = (byCode[code] || 0) + 1;
    const day = e.ts.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }

  return { total: entries.length, bySource, byCode, byDay };
}

export const LOG_DIR_PATH = LOG_DIR;
