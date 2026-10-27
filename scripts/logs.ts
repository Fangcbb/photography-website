/**
 * 错误日志查询 CLI。
 *
 * 用法：
 *   npx tsx scripts/logs.ts                        # 最近 20 条（折叠预期内错误）
 *   npx tsx scripts/logs.ts --days 7 --limit 50
 *   npx tsx scripts/logs.ts --source trpc --level error
 *   npx tsx scripts/logs.ts --q upload             # 关键字搜索
 *   npx tsx scripts/logs.ts --expected             # 包含 UNAUTHORIZED 等预期内错误
 *   npx tsx scripts/logs.ts --summary              # 按来源/错误码/日期统计
 *   npx tsx scripts/logs.ts --json                 # 输出原始 JSON（供程序/AI 解析）
 */
import { readLogs, summarizeLogs, LOG_DIR_PATH, type LogSource, type LogLevel } from "../src/lib/logger";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : "";
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const SOURCE_LABEL: Record<string, string> = {
  trpc: "tRPC",
  api: "API",
  client: "浏览器",
  rsc: "SSR",
  upload: "上传",
};

async function main() {
  const asJson = flag("json");
  const summary = flag("summary");

  if (summary) {
    const s = await summarizeLogs(Number(arg("days")) || 7);
    if (asJson) {
      console.log(JSON.stringify(s, null, 2));
      return;
    }
    console.log(`日志目录: ${LOG_DIR_PATH}\n`);
    console.log(`总计: ${s.total}\n`);
    console.log("按来源:");
    for (const [k, v] of Object.entries(s.bySource).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${(SOURCE_LABEL[k] || k).padEnd(8)} ${v}`);
    }
    console.log("\n按错误码:");
    for (const [k, v] of Object.entries(s.byCode).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(28)} ${v}`);
    }
    console.log("\n按日期:");
    for (const [k, v] of Object.entries(s.byDay).sort()) {
      console.log(`  ${k}  ${v}`);
    }
    return;
  }

  const entries = await readLogs({
    days: Number(arg("days")) || 3,
    limit: Number(arg("limit")) || 20,
    source: arg("source") as LogSource | undefined,
    level: arg("level") as LogLevel | undefined,
    includeExpected: flag("expected"),
    search: arg("q") || undefined,
  });

  if (asJson) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  if (entries.length === 0) {
    console.log("没有匹配的日志。");
    return;
  }

  console.log(`日志目录: ${LOG_DIR_PATH}`);
  console.log(`共 ${entries.length} 条（最新在前）\n`);

  for (const e of entries) {
    const time = e.ts.replace("T", " ").slice(0, 19);
    const src = (SOURCE_LABEL[e.source] || e.source).padEnd(6);
    const lvl = e.level.padEnd(5);
    const path = e.path ? ` ${e.path}` : "";
    const code = e.code ? ` [${e.code}]` : "";
    console.log(`${time}  ${lvl} ${src}${path}${code}`);
    console.log(`  ${e.message}`);
    if (e.url) console.log(`  url: ${e.url}`);
    if (e.stack) {
      const firstFrame = e.stack.split("\n").find((l) => l.trim().startsWith("at "));
      if (firstFrame) console.log(`  at ${firstFrame.trim().slice(3)}`);
    }
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
