import type { DbExecutor } from './executor';
import { m001Initial } from './migrations/001_initial';
import { m002Seed } from './migrations/002_seed';
import { m003SeedMore } from './migrations/003_seed_more';

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

/** Append-only. Never edit a shipped entry — add a new one with the next version. */
export const MIGRATIONS: Migration[] = [m001Initial, m002Seed, m003SeedMore];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/**
 * Applies every migration newer than the db's PRAGMA user_version, each in its own
 * transaction with the version bump included, so a kill mid-migration rolls back cleanly.
 */
export async function migrateDb(db: DbExecutor): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
