#!/usr/bin/env node
/**
 * Safe script to clean photo URLs in database with backup and rollback functionality
 * Removes domain prefix from URLs and keeps only the key
 * Example: https://photograph.ecarry.uk/photos/DJI_0471.jpg -> photos/DJI_0471.jpg
 */

import "dotenv/config";
import { db } from "../src/db";
import { photos } from "../src/db/schema";
import { sql } from "drizzle-orm";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

// Check environment variables
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  console.log("💡 Please check your .env file and make sure DATABASE_URL is configured");
  console.log("📝 Example: DATABASE_URL=postgresql://user:password@host:port/database");
  process.exit(1);
}

const DOMAIN_TO_REMOVE = "https://photograph.ecarry.uk/";
const BACKUP_FILE = join(process.cwd(), "scripts", "photo-urls-backup.json");

interface PhotoBackup {
  id: string;
  originalUrl: string;
  cleanedUrl: string;
  title: string;
}

async function createBackup(): Promise<PhotoBackup[]> {
  console.log("💾 Creating backup of current photo URLs...");
  
  const photosWithDomain = await db
    .select({
      id: photos.id,
      url: photos.url,
      title: photos.title,
    })
    .from(photos)
    .where(sql`${photos.url} LIKE ${DOMAIN_TO_REMOVE + '%'}`);

  const backup: PhotoBackup[] = photosWithDomain.map(photo => ({
    id: photo.id,
    originalUrl: photo.url,
    cleanedUrl: photo.url.replace(DOMAIN_TO_REMOVE, ""),
    title: photo.title,
  }));

  writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
  console.log(`✅ Backup created: ${BACKUP_FILE} (${backup.length} photos)`);
  
  return backup;
}

async function cleanPhotoUrls() {
  console.log("🚀 Starting safe photo URL cleanup...");
  
  try {
    // Create backup first
    const backup = await createBackup();

    if (backup.length === 0) {
      console.log("✅ No photos need URL cleanup");
      return;
    }

    // Show examples
    console.log("\n📋 Examples of URLs to be cleaned:");
    backup.slice(0, 3).forEach((photo, index) => {
      console.log(`${index + 1}. "${photo.title}"`);
      console.log(`   Before: ${photo.originalUrl}`);
      console.log(`   After:  ${photo.cleanedUrl}`);
    });

    console.log(`\n⚠️  This will update ${backup.length} photo URLs`);
    console.log("✅ Backup created, changes can be rolled back");
    console.log("Press Enter to continue or Ctrl+C to cancel...");
    
    // Wait for user confirmation
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    // Perform the update
    console.log("🔄 Updating photo URLs...");
    const result = await db.execute(
      sql`
        UPDATE photos 
        SET url = REPLACE(url, ${DOMAIN_TO_REMOVE}, ''),
            updated_at = NOW()
        WHERE url LIKE ${DOMAIN_TO_REMOVE + '%'}
      `
    );

    console.log(`✅ Successfully updated ${result.rowCount} photo URLs`);

    // Verify the changes
    const remainingPhotos = await db
      .select({
        id: photos.id,
        url: photos.url,
      })
      .from(photos)
      .where(sql`${photos.url} LIKE ${DOMAIN_TO_REMOVE + '%'}`);

    if (remainingPhotos.length === 0) {
      console.log("🎉 All photo URLs have been successfully cleaned!");
    } else {
      console.log(`⚠️  ${remainingPhotos.length} photos still have domain prefix`);
    }

    console.log(`\n💡 To rollback changes, run: bun scripts/rollback-photo-urls.ts`);

  } catch (error) {
    console.error("❌ Error cleaning photo URLs:", error);
    process.exit(1);
  }
}

async function rollbackPhotoUrls() {
  console.log("🔄 Starting photo URL rollback...");
  
  if (!existsSync(BACKUP_FILE)) {
    console.error("❌ Backup file not found:", BACKUP_FILE);
    process.exit(1);
  }

  try {
    const backup: PhotoBackup[] = JSON.parse(readFileSync(BACKUP_FILE, 'utf-8'));
    console.log(`📋 Found backup with ${backup.length} photos`);

    console.log("\n⚠️  This will restore original URLs");
    console.log("Press Enter to continue or Ctrl+C to cancel...");
    
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    // Restore URLs one by one for safety
    let restored = 0;
    for (const photo of backup) {
      await db.execute(
        sql`
          UPDATE photos 
          SET url = ${photo.originalUrl},
              updated_at = NOW()
          WHERE id = ${photo.id}
        `
      );
      restored++;
    }

    console.log(`✅ Successfully restored ${restored} photo URLs`);

  } catch (error) {
    console.error("❌ Error during rollback:", error);
    process.exit(1);
  }
}

// Check command line arguments
const command = process.argv[2];

if (command === 'rollback') {
  rollbackPhotoUrls()
    .then(() => {
      console.log("\n🏁 Rollback completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Rollback failed:", error);
      process.exit(1);
    });
} else {
  cleanPhotoUrls()
    .then(() => {
      console.log("\n🏁 Cleanup completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Cleanup failed:", error);
      process.exit(1);
    });
}
