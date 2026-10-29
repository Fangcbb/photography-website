// @ts-nocheck
import * as schema from "./schema";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { PgTransaction } from "drizzle-orm/pg-core";
import { getTableName, type Table, type InferInsertModel } from "drizzle-orm";
import pg from "pg";
import { validateServerEnv } from "@/env";

validateServerEnv();

const isLocal = process.env.DATABASE_PROVIDER === "local";

// ── DB Factory ─────────────────────────────────────────────────────
function createDb(connectionString: string, forceLocal = false) {
  if (isLocal || forceLocal) {
    return drizzlePg(new pg.Pool({ connectionString }), { schema });
  }
  return drizzleNeon(neon(connectionString), { schema });
}

// ── Retry Queue ────────────────────────────────────────────────────
interface PendingWrite {
  id: string;
  label: string;
  fn: () => Promise<unknown>;
  retries: number;
  nextRetryAt: number;
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 30_000;
const queue: PendingWrite[] = [];
let retryTimer: ReturnType<typeof setInterval> | null = null;

function enqueue(label: string, fn: () => Promise<unknown>) {
  queue.push({
    id: Math.random().toString(36).slice(2, 8),
    label,
    fn,
    retries: 0,
    nextRetryAt: Date.now(),
  });
  ensureRetryTimer();
}

function ensureRetryTimer() {
  if (retryTimer) return;
  retryTimer = setInterval(async () => {
    const now = Date.now();
    for (let i = queue.length - 1; i >= 0; i--) {
      const item = queue[i];
      if (now < item.nextRetryAt) continue;
      try {
        await item.fn();
        queue.splice(i, 1);
        console.log(`[dual-write] ✓ Retry succeeded: ${item.label}`);
      } catch (e: any) {
        item.retries++;
        if (item.retries >= MAX_RETRIES) {
          queue.splice(i, 1);
          console.error(`[dual-write] ✗ Gave up: ${item.label}`, e.message);
        } else {
          item.nextRetryAt = now + BASE_DELAY_MS * item.retries;
        }
      }
    }
    if (queue.length === 0) {
      clearInterval(retryTimer!);
      retryTimer = null;
    }
  }, 10_000);
}

// ── Singleton Instances ─────────────────────────────────────────────
const g = globalThis as unknown as {
  __primaryDb: ReturnType<typeof createDb>;
  __primaryTransactionalDb?: ReturnType<typeof createDb>;
  __secondaryDb: ReturnType<typeof createDb> | null;
};

function getPrimary() {
  return (g.__primaryDb ??= createDb(process.env.DATABASE_URL!));
}

/**
 * Neon HTTP is the fast path for ordinary queries but its transaction() throws
 * "No transactions support in neon-http driver". Use a small node-postgres pool
 * against the same primary URL for the few workflows that need real atomicity.
 * This pool is lazy and only opened when dualTransaction() is used.
 */
function getPrimaryTransactional() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for transactions");

  if (!g.__primaryTransactionalDb) {
    // Keep a deliberately small pool: ordinary read/query traffic uses Neon HTTP;
    // only atomic multi-row writes consume direct PostgreSQL connections.
    const pool = new pg.Pool({
      connectionString: url,
      max: 2,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });
    g.__primaryTransactionalDb = drizzlePg(pool, { schema });
  }

  return g.__primaryTransactionalDb;
}

let secondaryWarningLogged = false;
function getSecondary() {
  const url = process.env.DATABASE_URL_SECONDARY;
  if (!url) return null;
  // 双写当前不可靠（重复执行、主从不一致、内存队列丢事件），暂不支持：
  // 单主库为主，配置了备库时降级为主库写入并明确告警。
  if (!secondaryWarningLogged) {
    secondaryWarningLogged = true;
    console.warn(
      "[dual-write] DATABASE_URL_SECONDARY is set but dual-write is not supported; continuing with primary-only writes.",
    );
  }
  return null;
}

// ── Dual-Write Helper ──────────────────────────────────────────────
// Execute a query on primary, fire the same operation on secondary async.
// Works regardless of neon-http vs node-postgres driver differences.

type AnyDb = ReturnType<typeof createDb>;

async function dualExec<T>(
  label: string,
  primaryFn: (db: AnyDb) => Promise<T>,
  secondaryFn: (db: AnyDb) => Promise<T>,
): Promise<T> {
  const primary = getPrimary();
  const secondary = getSecondary();

  // Execute on primary — must succeed
  const result = await primaryFn(primary);

  // Fire secondary async
  if (secondary) {
    secondaryFn(secondary).catch((err: any) => {
      console.warn(`[dual-write] Secondary failed: ${label} — ${err.message}`);
      enqueue(label, () => secondaryFn(secondary));
    });
  }

  return result;
}

// ── Export ──────────────────────────────────────────────────────────
// We export the primary db for reads, plus dualWrite helpers for mutations.
// Usage in procedures:
//   import { db, dualInsert, dualUpdate, dualDelete } from "@/db";
//   await dualInsert(photos, values);
//   await dualUpdate(photos).set({...}).where(eq(photos.id, id)).returning();
//   await dualDelete(photos).where(eq(photos.id, id));

export const primaryDb = getPrimary();
export const secondaryDb = getSecondary();

// Re-export db as primary for backward compatibility (reads/selects)
export const db = primaryDb;

// ── Dual-write wrappers ────────────────────────────────────────────

// INSERT: dualInsert(table, values) — inserts into both databases
// Returns a chainable builder with .returning() and .onConflictDoUpdate()
export function dualInsert<TTable extends Table>(
  table: TTable,
  values: InferInsertModel<TTable>,
) {
  const label = `insert into ${getTableName(table)}`;
  const primary = getPrimary();
  const secondary = getSecondary();

  const pBuilder = primary.insert(table).values(values);
  const sBuilder = secondary?.insert(table).values(values);

  return {
    returning(...args: any[]) {
      const pR = pBuilder.returning(...args);
      let sR: any;
      if (secondary) {
        sR = secondary.insert(table).values(values).returning(...args);
      }
      return dualExec(
        label,
        () => pR as any,
        () => sR as any,
      );
    },
    onConflictDoUpdate(...args: any[]) {
      const pC = pBuilder.onConflictDoUpdate(...args);
      let sC: any;
      if (sBuilder) {
        sC = sBuilder.onConflictDoUpdate(...args);
      }
      return {
        returning(...retArgs: any[]): Promise<any> {
          const pR = pC.returning(...retArgs);
          let sR: any;
          if (secondary) {
            sR = secondary.insert(table).values(values).onConflictDoUpdate(...args).returning(...retArgs);
          }
          return dualExec(label, () => pR as any, () => sR as any);
        },
        then<TResult1 = any, TResult2 = never>(
      onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): PromiseLike<TResult1 | TResult2> {
          if (sC) {
            (sC as any).then().catch((err: any) => {
              console.warn(`[dual-write] Secondary failed: ${label} — ${err.message}`);
              enqueue(label, () => (sC as any).then());
            });
          }
          return (pC as any).then(onfulfilled, onrejected);
        },
      };
    },
    then<TResult1 = any, TResult2 = never>(
      onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): PromiseLike<TResult1 | TResult2> {
      // Fire secondary async
      if (sBuilder) {
        (sBuilder as any).then().catch((err: any) => {
          console.warn(`[dual-write] Secondary failed: ${label} — ${err.message}`);
          enqueue(label, () => (sBuilder as any).then());
        });
      }
      return (pBuilder as any).then(onfulfilled, onrejected);
    },
  };
}

// UPDATE: returns a chainable builder that executes on both databases
export function dualUpdate<TTable extends Table>(table: TTable) {
  const primary = getPrimary();
  const secondary = getSecondary();
  const label = `update ${getTableName(table)}`;

  const pBuilder = primary.update(table);
  const sBuilder = secondary?.update(table);

  return {
    set(values: any) {
      // Capture the values for replaying on secondary
      const pQ = pBuilder.set(values);
      const sQ = sBuilder?.set(values);
      return {
        where(...args: any[]) {
          const pW = pQ.where(...args);
          // Don't chain .where on secondary yet — build fresh
          const sW = sQ?.where(...args);
          return {
            returning(...retArgs: any[]): Promise<any> {
              const pR = pW.returning(...retArgs);
              // Build secondary query fresh
              let sR: any;
              if (secondary) {
                sR = secondary.update(table).set(values).where(...args).returning(...retArgs);
              }
              if (sR) {
                sR.then(
                  (v: any) => console.log(`[dual-write] ✓ Secondary returning success, rows=${v.length}`),
                  (e: any) => console.error(`[dual-write] ✗ Secondary returning error:`, e.message),
                );
              }
              return dualExec(
                label,
                () => pR as any,
                () => sR as any,
              );
            },
            then<TResult1 = any, TResult2 = never>(
      onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): PromiseLike<TResult1 | TResult2> {
              if (sW) {
                (sW as any).then(
                  () => console.log(`[dual-write] ✓ Secondary success: ${label}`),
                  (err: any) => {
                    console.warn(`[dual-write] Secondary failed: ${label} — ${err.message}`);
                    enqueue(label, () => (sW as any).then());
                  },
                );
              }
              return (pW as any).then(onfulfilled, onrejected);
            },
          };
        },
      };
    },
  };
}

// DELETE: returns a chainable builder that executes on both databases
export function dualDelete<TTable extends Table>(table: TTable) {
  const primary = getPrimary();
  const secondary = getSecondary();
  const label = `delete from ${getTableName(table)}`;

  const pBuilder = primary.delete(table);
  const sBuilder = secondary?.delete(table);

  return {
    where(...args: any[]) {
      const pW = pBuilder.where(...args);
      const sW = sBuilder?.where(...args);
      return {
        returning(...retArgs: any[]): Promise<any> {
          const pR = pW.returning(...retArgs);
          let sR: any;
          if (secondary) {
            sR = secondary.delete(table).where(...args).returning(...retArgs);
          }
          return dualExec(
            label,
            () => pR as any,
            () => sR as any,
          );
        },
        then<TResult1 = any, TResult2 = never>(
      onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): PromiseLike<TResult1 | TResult2> {
          if (sW) {
            (sW as any).then(
              () => {},
              (err: any) => {
                console.warn(`[dual-write] Secondary failed: ${label} — ${err.message}`);
                enqueue(label, () => (sW as any).then());
              },
            );
          }
          return (pW as any).then(onfulfilled, onrejected);
        },
      };
    },
  };
}

// Transaction wrapper — runs atomically on the primary database.
// The neon-http driver does not implement session transactions, so transactional
// paths use the same DATABASE_URL through the node-postgres driver. The primary
// remains authoritative; secondary replication is intentionally not mixed into
// a transaction until an outbox-based replication path exists.
export function dualTransaction<T>(
  fn: (tx: any) => Promise<T>,
) {
  if (getSecondary()) {
    throw new Error(
      "Transactional writes do not support DATABASE_URL_SECONDARY yet; refusing a silent primary-only commit.",
    );
  }
  return getPrimaryTransactional().transaction(fn);
}