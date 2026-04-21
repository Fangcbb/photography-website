#!/usr/bin/env node
/**
 * migrate-cover-photo.js
 *
 * 将每个 city_set 的 cover_photo_id 更新为该城市最新上传照片（按 created_at DESC）
 *
 * 用法:
 *   node migrate-cover-photo.js [--dry-run]
 *   node migrate-cover-photo.js [--log-dir /path/to/logs]
 */

const { Pool } = require('pg');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { mkdirSync, appendFileSync } = fs;

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const candidates = [
    path.join(__dirname, '..', '.env'),
    path.join('/var/www/photo-site/shared', '.env'),
    '/root/.openclaw/workspace/photography-website/.env',
  ];
  for (const envPath of candidates) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/DATABASE_URL=(.+)/);
      if (match) return match[1].trim();
    } catch {}
  }
  throw new Error('DATABASE_URL not found');
}

const DRY_RUN = process.argv.includes('--dry-run');
const LOG_DIR_IDX = process.argv.indexOf('--log-dir');
const LOG_DIR = LOG_DIR_IDX !== -1 ? process.argv[LOG_DIR_IDX + 1] : '/opt/photo/logs';
const EXECUTED_AT = new Date().toISOString();
const LOG_FILE = path.join(LOG_DIR, 'migrate-cover-photo.log');

function log(msg) {
  const line = `[${EXECUTED_AT}] ${msg}`;
  console.log(line);
  try { mkdirSync(LOG_DIR, { recursive: true }); appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

const parsed = url.parse(getDbUrl());
const auth = (parsed.auth || '').split(':');
const pool = new Pool({
  user:     auth[0],
  password: auth[1],
  host:     parsed.hostname,
  port:     parsed.port || 5432,
  database: parsed.pathname.replace(/^\//, ''),
  ssl:      { rejectUnauthorized: true },
});

async function main() {
  const client = await pool.connect();
  try {
    if (DRY_RUN) {
      log('[DRY RUN] 预览迁移结果：');
      const rows = await client.query(`
        SELECT
          cs.city,
          p.title        AS current_cover,
          latest.id      AS new_id,
          latest.title   AS new_cover,
          CASE WHEN cs.cover_photo_id IS DISTINCT FROM latest.id THEN '🔄 CHANGE' ELSE '✅' END AS status
        FROM city_sets cs
        LEFT JOIN photos p ON p.id = cs.cover_photo_id
        CROSS JOIN LATERAL (
          SELECT id, title
          FROM photos
          WHERE city = cs.city AND visibility = 'public'
          ORDER BY created_at DESC
          LIMIT 1
        ) latest
        ORDER BY cs.city
      `);
      rows.rows.forEach(r =>
        log(`${r.status} ${r.city}: ${(r.current_cover||'NULL').slice(0,15)} → ${(r.new_cover||'NULL').slice(0,15)}`)
      );
      log(`共 ${rows.rows.filter(r=>r.status.startsWith('🔄')).length}/${rows.rows.length} 个城市需更新`);
      return;
    }

    // 预览结果
    const previewQuery = `
      SELECT
        cs.city,
        p.title        AS old_title,
        latest.id      AS new_id,
        latest.title   AS new_title
      FROM city_sets cs
      LEFT JOIN photos p ON p.id = cs.cover_photo_id
      CROSS JOIN LATERAL (
        SELECT id, title FROM photos
        WHERE city = cs.city AND visibility = 'public'
        ORDER BY created_at DESC LIMIT 1
      ) latest
      WHERE latest.id IS NOT NULL AND cs.cover_photo_id IS DISTINCT FROM latest.id
    `;
    const preview = await client.query(previewQuery);

    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE city_sets cs
      SET cover_photo_id = latest.id,
          photo_count    = latest.cnt,
          updated_at     = NOW()
      FROM (
        SELECT city, id,
          COUNT(*) OVER (PARTITION BY city) AS cnt,
          ROW_NUMBER() OVER (PARTITION BY city ORDER BY created_at DESC) AS rn
        FROM photos
        WHERE visibility = 'public'
      ) latest
      WHERE latest.city = cs.city
        AND latest.rn = 1
        AND (cs.cover_photo_id IS DISTINCT FROM latest.id OR cs.photo_count IS DISTINCT FROM latest.cnt)
    `);

    await client.query('COMMIT');

    // 写执行日志
    log(`EXECUTED | updated=${result.rowCount} | cities=${preview.rows.length}`);
    preview.rows.forEach(r =>
      log(`  ${r.city}: ${(r.old_title||'NULL').slice(0,15)} → ${(r.new_title||'NULL').slice(0,15)}`)
    );

    console.log(`✅ 已更新 ${result.rowCount} 个城市，日志: ${LOG_FILE}`);
  } catch (e) {
    await client.query('ROLLBACK');
    log(`ERROR: ${e.message}`);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error('❌ 迁移失败:', e.message);
  process.exit(1);
});
