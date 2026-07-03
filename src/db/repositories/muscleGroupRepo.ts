import type { MuscleGroup } from '../../types/domain';
import type { DbExecutor } from '../executor';
import { mapMuscleGroup, type MuscleGroupRow } from '../rows';

export function createMuscleGroupRepo(db: DbExecutor) {
  return {
    /** Seeded groups first in seed order, then customs, for the picker chips. */
    async listActive(): Promise<MuscleGroup[]> {
      const rows = await db.getAllAsync<MuscleGroupRow>(
        `SELECT * FROM muscle_groups WHERE deleted_at IS NULL ORDER BY is_custom ASC, rowid ASC`
      );
      return rows.map(mapMuscleGroup);
    },

    async getById(id: string): Promise<MuscleGroup | null> {
      const row = await db.getFirstAsync<MuscleGroupRow>(
        `SELECT * FROM muscle_groups WHERE id = ?`,
        [id]
      );
      return row ? mapMuscleGroup(row) : null;
    },
  };
}

export type MuscleGroupRepo = ReturnType<typeof createMuscleGroupRepo>;
