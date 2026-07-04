import type { DbExecutor } from '../../db/executor';
import { SCHEMA_VERSION } from '../../db/migrations';
import { nowIso } from '../dates';

/**
 * Full-fidelity JSON backup: flat arrays mirroring the tables verbatim (snake_case,
 * UUIDs, timestamps intact) so restore is a straight per-table INSERT OR IGNORE —
 * idempotent thanks to the canonical UUID convention. Never meant for LLM pasting.
 */

export const BACKUP_FORMAT = 'workout-tracker-backup';
export const BACKUP_FORMAT_VERSION = 1;

/** FK-safe insert order. */
const TABLES = [
  'muscle_groups',
  'exercises',
  'sessions',
  'session_muscle_groups',
  'session_exercises',
  'sets',
  'settings',
] as const;

type TableName = (typeof TABLES)[number];
type Row = Record<string, string | number | null>;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<TableName, Row[]>;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export async function createBackup(db: DbExecutor): Promise<BackupFile> {
  const tables = {} as Record<TableName, Row[]>;
  for (const table of TABLES) {
    tables[table] = await db.getAllAsync<Row>(`SELECT * FROM ${table}`);
  }
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    tables,
  };
}

export function parseBackup(json: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BackupError('That file is not valid JSON.');
  }
  const backup = parsed as Partial<BackupFile>;
  if (backup.format !== BACKUP_FORMAT || typeof backup.schemaVersion !== 'number') {
    throw new BackupError('That file is not a Workout Tracker backup.');
  }
  if (backup.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError('This backup is from a newer version of the app — update the app first.');
  }
  if (backup.schemaVersion < SCHEMA_VERSION) {
    throw new BackupError(
      'This backup is from an older version of the app and cannot be imported yet.'
    );
  }
  return backup as BackupFile;
}

/** Idempotent merge-restore. Returns the number of newly inserted rows. */
export async function restoreBackup(db: DbExecutor, backup: BackupFile): Promise<number> {
  let inserted = 0;
  await db.withTransactionAsync(async () => {
    for (const table of TABLES) {
      const rows = backup.tables[table] ?? [];
      for (const row of rows) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;
        const placeholders = columns.map(() => '?').join(', ');
        const result = (await db.runAsync(
          `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          columns.map((c) => row[c])
        )) as { changes?: number } | undefined;
        inserted += result?.changes ?? 0;
      }
    }
  });
  return inserted;
}
