import { NextResponse } from "next/server";
import { getSession } from "@/modules/auth/lib/get-session";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "fs";

const MAINTENANCE_FILE = "/var/www/photo-site/shared/.maintenance";
const CURRENT_FILE = "/var/www/photo-site/current/.maintenance";

export async function GET() {
  try {
    const exists = existsSync(MAINTENANCE_FILE);
    let enabledAt: string | null = null;
    if (exists) {
      try {
        const data = JSON.parse(readFileSync(MAINTENANCE_FILE, "utf-8"));
        enabledAt = data.enabledAt ?? null;
      } catch {
        // file exists but is not valid JSON - still consider it enabled
      }
    }
    return NextResponse.json({ enabled: exists, enabledAt });
  } catch {
    return NextResponse.json(
      { error: "Failed to read maintenance status" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sharedDir = "/var/www/photo-site/shared";
    if (!existsSync(sharedDir)) {
      mkdirSync(sharedDir, { recursive: true });
    }

    const isCurrentlyEnabled = existsSync(MAINTENANCE_FILE);

    if (isCurrentlyEnabled) {
      try { unlinkSync(MAINTENANCE_FILE); } catch {}
      try { if (existsSync(CURRENT_FILE)) unlinkSync(CURRENT_FILE); } catch {}
      return NextResponse.json({ enabled: false, enabledAt: null });
    } else {
      const payload = JSON.stringify({
        enabled: true,
        enabledAt: new Date().toISOString(),
      });
      writeFileSync(MAINTENANCE_FILE, payload, "utf-8");
      writeFileSync(CURRENT_FILE, payload, "utf-8");
      return NextResponse.json({ enabled: true, enabledAt: new Date().toISOString() });
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to toggle maintenance mode" },
      { status: 500 }
    );
  }
}
