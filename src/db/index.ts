import * as schema from "./schema";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { PgTransaction } from "drizzle-orm/pg-core";
import { getTableName, type Table } from "drizzle-orm";
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
  __secondaryDb: ReturnType<typeof createDb> | null;
};

function getPrimary() {
  return (g.__primaryDb ??= createDb(process.env.DATABASE_URL!));
}

function getSecondary() {
  const url = process.env.DATABASE_URL_SECONDARY;
  if (!url) return null;
  return (g.__secondaryDb ??= createDb(url, true));
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
  values: Parameters<AnyDb["insert"]>[0] extends Table<infer T> ? T : never,
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
        returning(...retArgs: any[]) {
          const pR = pC.returning(...retArgs);
          let sR: any;
          if (secondary) {
            sR = secondary.insert(table).values(values).onConflictDoUpdate(...args).returning(...retArgs);
          }
          return dualExec(label, () => pR as any, () => sR as any);
        },
        then(onfulfilled: any, onrejected: any) {
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
    then(onfulfilled: any, onrejected: any) {
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
            returning(...retArgs: any[]) {
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
            then(onfulfilled: any, onrejected: any) {
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
        returning(...retArgs: any[]) {
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
        then(onfulfilled: any, onrejected: any) {
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

// Transaction wrapper — only runs on primary (dual-write in transactions is complex)
export function dualTransaction<T>(
  fn: (tx: any) => Promise<T>,
) {
  return primaryDb.transaction(fn);
}
