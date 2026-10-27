import { readLogs, summarizeLogs, pruneOldLogs, LOG_DIR_PATH, type LogSource, type LogLevel } from "@/lib/logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "错误日志",
  description: "系统错误与异常日志",
};

type Props = {
  searchParams: Promise<{
    source?: string;
    level?: string;
    days?: string;
    q?: string;
    expected?: string;
  }>;
};

const SOURCE_LABEL: Record<LogSource, string> = {
  trpc: "tRPC",
  api: "API",
  client: "浏览器",
  rsc: "服务端渲染",
  upload: "上传",
};

const LEVEL_STYLE: Record<LogLevel, string> = {
  error: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
};

function fmtTime(iso: string) {
  // 用固定格式避免服务端/客户端时区不一致导致的 hydration 差异
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default async function LogsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const days = Math.min(Math.max(Number(sp.days) || 3, 1), 14);
  const source = sp.source as LogSource | undefined;
  const level = sp.level as LogLevel | undefined;
  const includeExpected = sp.expected === "1";

  const [entries, summary] = await Promise.all([
    readLogs({ days, limit: 200, source, level, includeExpected, search: sp.q }),
    summarizeLogs(7),
  ]);

  // 借访问日志页的机会清理过期文件（保留 14 天），无需额外的定时任务
  await pruneOldLogs();

  return (
    <div className="py-4 px-4 md:px-8 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">错误日志</h1>
        <p className="text-muted-foreground text-sm mt-1">
          最近 {days} 天，共 {entries.length} 条 · 日志目录{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">{LOG_DIR_PATH}</code>
        </p>
      </div>

      {/* 概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>近 7 天总计</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{summary.total}</CardTitle>
          </CardHeader>
        </Card>
        {Object.entries(summary.bySource).map(([k, v]) => (
          <Card key={k}>
            <CardHeader className="pb-2">
              <CardDescription>{SOURCE_LABEL[k as LogSource] || k}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{v}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* 错误码分布 */}
      {Object.keys(summary.byCode).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>错误码分布（近 7 天）</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(summary.byCode)
              .sort((a, b) => b[1] - a[1])
              .map(([code, n]) => (
                <Badge key={code} variant="outline" className="font-mono text-xs">
                  {code} · {n}
                </Badge>
              ))}
          </CardContent>
        </Card>
      )}

      {/* 筛选 */}
      <form className="flex flex-wrap items-center gap-2 text-sm" action="/dashboard/logs">
        <select
          name="days"
          defaultValue={String(days)}
          className="border rounded-md px-2 py-1 bg-background"
        >
          {[1, 3, 7, 14].map((d) => (
            <option key={d} value={d}>
              最近 {d} 天
            </option>
          ))}
        </select>
        <select
          name="source"
          defaultValue={source || ""}
          className="border rounded-md px-2 py-1 bg-background"
        >
          <option value="">全部来源</option>
          {Object.entries(SOURCE_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="level"
          defaultValue={level || ""}
          className="border rounded-md px-2 py-1 bg-background"
        >
          <option value="">全部级别</option>
          <option value="error">error</option>
          <option value="warn">warn</option>
          <option value="info">info</option>
        </select>
        <input
          name="q"
          defaultValue={sp.q || ""}
          placeholder="搜索消息 / 路径 / 错误码"
          className="border rounded-md px-2 py-1 bg-background w-56"
        />
        <label className="flex items-center gap-1.5 text-muted-foreground">
          <input type="checkbox" name="expected" value="1" defaultChecked={includeExpected} />
          含预期内错误
        </label>
        <button type="submit" className="border rounded-md px-3 py-1 hover:bg-muted">
          筛选
        </button>
      </form>

      {/* 列表 */}
      <div className="flex flex-col gap-2">
        {entries.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              没有匹配的日志。系统运行正常 🎉
            </CardContent>
          </Card>
        )}

        {entries.map((e, i) => (
          <details
            key={`${e.ts}-${i}`}
            className="border rounded-lg bg-card px-3 py-2 group"
          >
            <summary className="cursor-pointer list-none flex flex-wrap items-center gap-2 text-sm">
              <span className={`text-xs px-1.5 py-0.5 rounded border ${LEVEL_STYLE[e.level]}`}>
                {e.level}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                {SOURCE_LABEL[e.source] || e.source}
              </span>
              {e.path && (
                <code className="text-xs text-muted-foreground">{e.path}</code>
              )}
              {e.code && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  {e.code}
                </Badge>
              )}
              <span className="flex-1 truncate">{e.message}</span>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {fmtTime(e.ts)}
              </span>
            </summary>

            <div className="mt-2 pt-2 border-t text-xs space-y-1.5">
              {e.url && (
                <div>
                  <span className="text-muted-foreground">URL：</span>
                  <span className="break-all">{e.url}</span>
                </div>
              )}
              {e.user && (
                <div>
                  <span className="text-muted-foreground">用户：</span>
                  {e.user}
                </div>
              )}
              {e.userAgent && (
                <div>
                  <span className="text-muted-foreground">UA：</span>
                  <span className="break-all">{e.userAgent}</span>
                </div>
              )}
              {e.meta && Object.keys(e.meta).length > 0 && (
                <div>
                  <span className="text-muted-foreground">附加信息：</span>
                  <pre className="mt-1 whitespace-pre-wrap break-all bg-muted/50 p-2 rounded text-[11px]">
                    {JSON.stringify(e.meta, null, 2)}
                  </pre>
                </div>
              )}
              {e.stack && (
                <div>
                  <span className="text-muted-foreground">堆栈：</span>
                  <pre className="mt-1 whitespace-pre-wrap break-all bg-muted/50 p-2 rounded text-[11px] max-h-64 overflow-auto">
                    {e.stack}
                  </pre>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
