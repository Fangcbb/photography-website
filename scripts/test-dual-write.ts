import "dotenv/config";
import path from "path";
import { config } from "dotenv";
config({ path: path.resolve(__dirname, "../.env") });

import { primaryDb, secondaryDb, dualInsert, dualUpdate, dualDelete } from "../src/db";
import { aboutContent } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("=== FULL DUAL-WRITE VERIFICATION ===\n");

  const testId = `dualtest_${Date.now()}`;
  const testRole = `role_${Date.now()}`;

  // ── Step 1: dualInsert ──────────────────────────────────────────
  console.log("Step 1: dualInsert — insert into both databases\n");

  await dualInsert(aboutContent, {
    id: testId,
    name: "Dual Write Test",
    role: testRole,
    bio: "test",
    aboutHeading: "test",
    aboutParagraphs: ["test"],
    cameraHeading: "test",
    cameraSubheading: "test",
    cameraDescription: "test",
    gear: "[]",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log("Waiting 3s for async secondary insert...");
  await new Promise((r) => setTimeout(r, 3000));

  const [neonInserted] = await primaryDb.select().from(aboutContent).where(eq(aboutContent.id, testId));
  const [supaInserted] = await secondaryDb!.select().from(aboutContent).where(eq(aboutContent.id, testId));

  console.log("Neon     →", neonInserted ? `name="${neonInserted.name}" ✅` : "NOT FOUND ❌");
  console.log("Supabase →", supaInserted ? `name="${supaInserted.name}" ✅` : "NOT FOUND ❌");

  // ── Step 2: dualUpdate ──────────────────────────────────────────
  console.log("\nStep 2: dualUpdate — update in both databases\n");

  const newName = `Updated ${Date.now()}`;

  const [updated] = await dualUpdate(aboutContent)
    .set({ name: newName, updatedAt: new Date() })
    .where(eq(aboutContent.id, testId))
    .returning();

  console.log(`Primary returned: name="${updated.name}"`);

  console.log("Waiting 3s for async secondary update...");
  await new Promise((r) => setTimeout(r, 3000));

  const [neonUpdated] = await primaryDb.select().from(aboutContent).where(eq(aboutContent.id, testId));
  const [supaUpdated] = await secondaryDb!.select().from(aboutContent).where(eq(aboutContent.id, testId));

  console.log("Neon     →", neonUpdated ? `name="${neonUpdated.name}"` : "NOT FOUND ❌");
  console.log("Supabase →", supaUpdated ? `name="${supaUpdated.name}"` : "NOT FOUND ❌");

  const updateOk = neonUpdated?.name === newName && supaUpdated?.name === newName;

  // ── Step 3: dualDelete ──────────────────────────────────────────
  console.log("\nStep 3: dualDelete — delete from both databases\n");

  await dualDelete(aboutContent)
    .where(eq(aboutContent.id, testId))
    .returning();

  console.log("Waiting 3s for async secondary delete...");
  await new Promise((r) => setTimeout(r, 3000));

  const [neonDeleted] = await primaryDb.select().from(aboutContent).where(eq(aboutContent.id, testId));
  const [supaDeleted] = await secondaryDb!.select().from(aboutContent).where(eq(aboutContent.id, testId));

  console.log("Neon     →", neonDeleted ? "STILL EXISTS ❌" : "✅ Deleted");
  console.log("Supabase →", supaDeleted ? "STILL EXISTS ❌" : "✅ Deleted");

  // ── Verdict ─────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════");
  if (updateOk && !neonDeleted && !supaDeleted) {
    console.log("✅ DUAL-WRITE FULLY WORKING!");
    console.log("   INSERT → both databases ✅");
    console.log("   UPDATE → both databases ✅");
    console.log("   DELETE → both databases ✅");
  } else {
    console.log("⚠️  Some operations failed:");
    console.log(`   INSERT: ${neonInserted && supaInserted ? "✅" : "❌"}`);
    console.log(`   UPDATE: ${updateOk ? "✅" : "❌"}`);
    console.log(`   DELETE: ${!neonDeleted && !supaDeleted ? "✅" : "❌"}`);
  }
  console.log("══════════════════════════════════════\n");

  process.exit(0);
}

main().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
