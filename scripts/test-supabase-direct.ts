import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";
import { aboutContent } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_SECONDARY! });
  const db = drizzle(pool, { schema });

  const testId = `direct_test_${Date.now()}`;
  console.log(`Inserting into Supabase: ${testId}`);

  await db.insert(aboutContent).values({
    id: testId,
    name: "Direct Test",
    role: "test",
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

  const rows = await db.select().from(aboutContent).where(eq(aboutContent.id, testId));
  console.log("Found after insert:", rows.length > 0 ? "✅ YES" : "❌ NO");
  console.log("Row:", rows[0] ? `name="${rows[0].name}"` : "null");

  // Test update
  console.log("\nUpdating...");
  await db.update(aboutContent).set({ name: "Updated Direct Test", updatedAt: new Date() }).where(eq(aboutContent.id, testId));
  const rows2 = await db.select().from(aboutContent).where(eq(aboutContent.id, testId));
  console.log("After update:", rows2[0] ? `name="${rows2[0].name}"` : "NOT FOUND");

  // Cleanup
  await db.delete(aboutContent).where(eq(aboutContent.id, testId));
  console.log("\nCleaned up ✅");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
