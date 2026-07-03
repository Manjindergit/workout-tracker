export type SqlParam = string | number | null;

/**
 * The minimal database surface repositories are written against.
 * On device this is backed by expo-sqlite (see client.ts); in Jest by better-sqlite3
 * (see testDb.ts), which is what makes the crash-recovery suite runnable in Node.
 */
export interface DbExecutor {
  runAsync(sql: string, params?: SqlParam[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  execAsync(sql: string): Promise<void>;
  /** Runs fn inside BEGIN/COMMIT with rollback on throw. Must not be nested. */
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}
