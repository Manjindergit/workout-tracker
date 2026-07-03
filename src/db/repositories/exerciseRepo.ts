import { newId } from '../../utils/ids';
import { nowIso } from '../../utils/dates';
import type { Exercise } from '../../types/domain';
import type { DbExecutor } from '../executor';
import { mapExercise, type ExerciseRow } from '../rows';

export class DuplicateExerciseNameError extends Error {
  constructor(name: string) {
    super(`An exercise named "${name}" already exists`);
    this.name = 'DuplicateExerciseNameError';
  }
}

export interface ExerciseWithGroup extends Exercise {
  muscleGroupName: string;
}

type ExerciseWithGroupRow = ExerciseRow & { muscle_group_name: string };

const mapWithGroup = (r: ExerciseWithGroupRow): ExerciseWithGroup => ({
  ...mapExercise(r),
  muscleGroupName: r.muscle_group_name,
});

export function createExerciseRepo(db: DbExecutor) {
  return {
    /** Picker list: active exercises with group names, grouped by seed order then name. */
    async listActiveWithGroup(): Promise<ExerciseWithGroup[]> {
      const rows = await db.getAllAsync<ExerciseWithGroupRow>(
        `SELECT e.*, mg.name AS muscle_group_name
         FROM exercises e
         JOIN muscle_groups mg ON mg.id = e.primary_muscle_group_id
         WHERE e.deleted_at IS NULL
         ORDER BY mg.is_custom ASC, mg.rowid ASC, e.name COLLATE NOCASE ASC`
      );
      return rows.map(mapWithGroup);
    },

    async getById(id: string): Promise<Exercise | null> {
      const row = await db.getFirstAsync<ExerciseRow>(`SELECT * FROM exercises WHERE id = ?`, [
        id,
      ]);
      return row ? mapExercise(row) : null;
    },

    async createCustom(
      name: string,
      primaryMuscleGroupId: string,
      isBodyweight: boolean
    ): Promise<Exercise> {
      const trimmed = name.trim();
      const now = nowIso();
      const exercise: Exercise = {
        id: newId(),
        primaryMuscleGroupId,
        name: trimmed,
        isBodyweight,
        isCustom: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await db.runAsync(
          `INSERT INTO exercises
             (id, primary_muscle_group_id, name, is_bodyweight, is_custom, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?)`,
          [exercise.id, primaryMuscleGroupId, trimmed, isBodyweight ? 1 : 0, now, now]
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE')) {
          throw new DuplicateExerciseNameError(trimmed);
        }
        throw error;
      }
      return exercise;
    },

    /**
     * Soft delete: hides the exercise from pickers while History/Progress/export keep
     * resolving its name. The RESTRICT FK makes a hard DELETE impossible while referenced.
     */
    async softDelete(id: string): Promise<void> {
      const now = nowIso();
      await db.runAsync(`UPDATE exercises SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
        now,
        now,
        id,
      ]);
    },
  };
}

export type ExerciseRepo = ReturnType<typeof createExerciseRepo>;
