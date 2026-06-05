-- migrate-cover-photo.sql
-- 用途：将每个 city_set 的 cover_photo_id 更新为该城市最新上传照片（按 created_at DESC）
-- 依赖：psql 或 Node.js pg 客户端
--
-- Node.js 用法:
--   node -e "$(cat migrate-cover-photo.sql | sed 's/--.*//g' | tr '\n' ' ')"

-- 预览（不修改）
SELECT
  cs.city,
  p.title AS current_cover,
  latest.title AS new_cover,
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
ORDER BY cs.city;

-- 执行迁移
-- UPDATE city_sets cs
-- SET
--   cover_photo_id = latest.id,
--   photo_count    = latest.cnt,
--   updated_at     = NOW()
-- FROM (
--   SELECT city, id, COUNT(*) OVER (PARTITION BY city) AS cnt
--   FROM photos
--   WHERE visibility = 'public'
--   ORDER BY created_at DESC
-- ) latest
-- WHERE latest.city = cs.city
--   AND latest.id = (SELECT id FROM photos WHERE city = cs.city AND visibility = 'public' ORDER BY created_at DESC LIMIT 1);
