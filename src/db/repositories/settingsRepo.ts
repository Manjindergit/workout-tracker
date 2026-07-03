import { nowIso } from '../../utils/dates';
import type { DbExecutor } from '../executor';

export const SETTINGS_KEYS = {
  unit: 'unit', // 'kg' | 'lb'
  weightIncrementKg: 'weightIncrementKg', // stringified number
  promptTemplateCoach: 'promptTemplate.coach',
  promptTemplatePlan: 'promptTemplate.plan',
  promptTemplatePlateau: 'promptTemplate.plateau',
} as const;

export function createSettingsRepo(db: DbExecutor) {
  return {
    async get(key: string): Promise<string | null> {
      const row = await db.getFirstAsync<{ value: string }>(
        `SELECT value FROM settings WHERE key = ?`,
        [key]
      );
      return row?.value ?? null;
    },

    async set(key: string, value: string): Promise<void> {
      await db.runAsync(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, value, nowIso()]
      );
    },

    async getAll(): Promise<Record<string, string>> {
      const rows = await db.getAllAsync<{ key: string; value: string }>(
        `SELECT key, value FROM settings`
      );
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },
  };
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>;
