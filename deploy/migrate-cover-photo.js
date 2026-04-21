#!/usr/bin/env node
/**
 * migrate-cover-photo.js
 * 
 * 将每个 city_set 的 cover_photo_id 更新为该城市最新上传照片（按 created_at DESC）
 * 
 * 用法: node migrate-cover-photo.js [--dry-run]
 */

const { Pool } = require('pg');
const url = require('url');
const fs = require('fs');
const path = require('path');

// 从 .env 读取 DATABASE_URL（优先）或使用命令行参数
function getDbUrl() {
  // 尝试从环境变量
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  
  // 尝试从 .env 文件读取（支持 workspace 和部署目录）
  const candidates = [
    path.join(__dirname, '..', '..', '.env'),
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
  throw new Error('DATABASE_URL not found. Set env var or place .env');
}

const DRY_RUN = process.argv.includes('--dry-run');
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
      console.log('[DRY RUN] 预览迁移结果：\n');
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
        console.log(`${r.status} ${r.city}: ${(r.current_cover||'NULL').slice(0,15)} → ${(r.new_cover||'NULL').slice(0,15)}`)
      );
      console.log(`\n共 ${rows.rows.filter(r=>r.status.startsWith('🔄')).length}/${rows.rows.length} 个城市需更新`);
    } else {
      await client.query('BEGIN');
      const result = await client.query(`
        UPDATE city_sets cs
        SET
          cover_photo_id = latest.id,
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
      console.log(`✅ 已更新 ${result.rowCount} 个城市`);
    }
  } catch (e) {
    await client.query('ROLLBACK');
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
