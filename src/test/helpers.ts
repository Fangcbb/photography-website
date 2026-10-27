import { appRouter } from "@/trpc/routers/_app";
import { createCallerFactory } from "@/trpc/init";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * 测试数据库护栏（2026-10 修复）
 *
 * 背景：旧版 helpers 直接 `import { db } from "@/db"`，而 `@/db` 由
 * `DATABASE_URL` 建立连接。于是 `npm test` 在生产目录执行时，测试里的
 * `db.delete(photos)` 会清空**生产**照片表。`TEST_DATABASE_URL` 当时只写在
 * 注释里，从未被读取。
 *
 * 现在的规则（任一不满足就直接抛错，测试无法启动）：
 *   1. 必须显式设置 TEST_DATABASE_URL
 *   2. DATABASE_URL 必须与 TEST_DATABASE_URL 完全一致
 *      （否则 @/db 会连到别的库，护栏形同虚设）
 *   3. 实际连接的数据库名必须以 `_test` 结尾
 */

const TEST_DB_URL = process.env.TEST_DATABASE_URL;

if (!TEST_DB_URL) {
  throw new Error(
    [
      "TEST_DATABASE_URL 未设置，测试已中止。",
      "测试会写入并清理数据，绝不能指向生产库。",
      "请先创建独立测试库，然后：",
      "  TEST_DATABASE_URL=postgres://.../photography_test \\",
      "  DATABASE_URL=$TEST_DATABASE_URL npm test",
    ].join("\n"),
  );
}

if (process.env.DATABASE_URL !== TEST_DB_URL) {
  throw new Error(
    [
      "DATABASE_URL 与 TEST_DATABASE_URL 不一致，测试已中止。",
      "`@/db` 会使用 DATABASE_URL 建立连接，若它指向生产库，测试清理会删掉真实数据。",
      "请让二者指向同一个测试库：",
      "  DATABASE_URL=$TEST_DATABASE_URL npm test",
    ].join("\n"),
  );
}

const createCaller = createCallerFactory(appRouter);

/** 创建一个已认证的测试 caller（依赖 better-auth 的 session mock）。 */
export const createAuthedCaller = () => createCaller({ db });

let verifiedDatabase: string | null = null;

/**
 * 断言当前连接的是测试库。每个测试文件在 beforeEach 里调用一次即可（结果会缓存）。
 * 这一层是「最后一道闸」：即使前两个 env 检查被绕过，库名不含 _test 也会拒绝执行。
 */
export async function assertTestDatabase(): Promise<void> {
  if (verifiedDatabase) return;

  const result = (await db.execute(
    sql`select current_database() as name`,
  )) as unknown as { rows?: Array<{ name: string }> } | Array<{ name: string }>;

  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  const name = rows[0]?.name ?? "";

  if (!/_test$/i.test(name)) {
    throw new Error(
      `拒绝在数据库 "${name || "(unknown)"}" 上运行测试：库名必须以 _test 结尾。`,
    );
  }

  verifiedDatabase = name;
}

/**
 * 只清理本测试套件产生的数据。
 *
 * 绝不使用无条件 `db.delete(table)`：那会清空整张表，一旦连错库就是灾难。
 * 测试照片的 url 统一以 `photos/test-` 开头，先删引用它们的 citySets
 * （存在外键），再删照片。
 */
export async function cleanupTestData(): Promise<void> {
  await assertTestDatabase();

  await db.execute(sql`
    delete from city_sets
    where cover_photo_id in (
      select id from photos where url like 'photos/test-%'
    )
  `);
  await db.execute(sql`delete from photos where url like 'photos/test-%'`);
}

/**
 * Helper to build a minimal valid photo input for testing.
 * Override any field by passing partial values.
 */
export function buildPhotoInput(overrides: Record<string, unknown> = {}) {
  return {
    url: "photos/test-photo.jpg",
    title: "Test Photo",
    description: "A test photo",
    aspectRatio: 1.5,
    width: 1500,
    height: 1000,
    blurData: "data:image/png;base64,test",
    visibility: "public" as const,
    ...overrides,
  };
}
