import Database from 'better-sqlite3';

import type { DbExecutor, SqlParam } from './executor';
import { migrateDb } from './migrations';

/**
 * In-memory better-sqlite3 implementation of DbExecutor for Jest. Mirrors the
 * device setup in client.ts: foreign keys on, full migration chain applied.
 * Test-only — never import from app code.
 */
export interface TestDb extends DbExecutor {
  raw: Database.Database;
  close(): void;
}

export function createTestDb(): TestDb {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');

  return {
    raw,
    close: () => raw.close(),
    async runAsync(sql: string, params: SqlParam[] = []) {
      return raw.prepare(sql).run(...params);
    },
    async getAllAsync<T>(sql: string, params: SqlParam[] = []) {
      return raw.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlParam[] = []) {
      const stmt = raw.prepare(sql);
      const row = stmt.reader ? stmt.get(...params) : stmt.run(...params);
      return (row ?? null) as T | null;
    },
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async withTransactionAsync(fn: () => Promise<void>) {
      raw.exec('BEGIN');
      try {
        await fn();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

/** Fresh in-memory db with the full migration chain applied. */
export async function createMigratedTestDb(): Promise<TestDb> {
  const db = createTestDb();
  await migrateDb(db);
  return db;
}
