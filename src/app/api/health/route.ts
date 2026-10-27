import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

// OPS-01 修复：返回运行中进程实际加载的 BUILD_ID，
// 供 photo-healthcheck.sh 通过 HTTP 比对「运行版本」与「磁盘版本」是否一致。
function getBuildId(): string {
  try {
    // standalone 模式下 BUILD_ID 位于 standalone 根目录（= pm2 cwd）
    return readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return "unknown";
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    buildId: getBuildId(),
    timestamp: Date.now(),
  });
}
