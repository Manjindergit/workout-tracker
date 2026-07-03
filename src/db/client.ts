import type { SQLiteDatabase } from 'expo-sqlite';

import type { DbExecutor, SqlParam } from './executor';
import { migrateDb } from './migrations';

export function wrapExpoDb(db: SQLiteDatabase): DbExecutor {
  return {
    runAsync: (sql: string, params: SqlParam[] = []) => db.runAsync(sql, params),
    getAllAsync: <T>(sql: string, params: SqlParam[] = []) => db.getAllAsync<T>(sql, params),
    getFirstAsync: <T>(sql: string, params: SqlParam[] = []) => db.getFirstAsync<T>(sql, params),
    execAsync: (sql: string) => db.execAsync(sql),
    withTransactionAsync: (fn: () => Promise<void>) => db.withTransactionAsync(fn),
  };
}

/**
 * SQLiteProvider onInit hook: durability pragmas first (expo-sqlite enables neither
 * by default), then the append-only migration chain.
 */
export async function initDb(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');
  await migrateDb(wrapExpoDb(db));
}

export const DATABASE_NAME = 'workout-tracker.db';
