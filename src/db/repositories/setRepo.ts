import { newId } from '../../utils/ids';
import { nowIso } from '../../utils/dates';
import type { WorkoutSet } from '../../types/domain';
import type { DbExecutor } from '../executor';
import type { SetRow } from '../rows';

/**
 * All mutations are UPDATEs keyed by the set's UUID: idempotent and last-write-wins,
 * which is what kills the rapid check-off/uncheck race and makes post-check-off
 * edits durable (History and the e1RM chart see corrections immediately).
 */
export function createSetRepo(db: DbExecutor) {
  return {
    /** Appends a draft set, copying weight/reps from the previous set in the group. */
    async addSet(sessionExerciseId: string): Promise<WorkoutSet> {
      const prev = await db.getFirstAsync<SetRow>(
        `SELECT * FROM sets WHERE session_exercise_id = ? ORDER BY position DESC LIMIT 1`,
        [sessionExerciseId]
      );
      const now = nowIso();
      const set: WorkoutSet = {
        id: newId(),
        sessionExerciseId,
        position: (prev?.position ?? 0) + 1,
        weightKg: prev?.weight_kg ?? 0,
        reps: prev?.reps ?? 0,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      await db.runAsync(
        `INSERT INTO sets (id, session_exercise_id, position, weight_kg, reps, completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        [set.id, sessionExerciseId, set.position, set.weightKg, set.reps, now, now]
      );
      return set;
    },

    /** Debounced target for keystrokes — also the edit path for already-completed sets. */
    async updateValues(setId: string, weightKg: number, reps: number): Promise<void> {
      await db.runAsync(`UPDATE sets SET weight_kg = ?, reps = ?, updated_at = ? WHERE id = ?`, [
        weightKg,
        reps,
        nowIso(),
        setId,
      ]);
    },

    async setCompleted(setId: string, completed: boolean): Promise<void> {
      const now = nowIso();
      await db.runAsync(
        `UPDATE sets SET completed = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
        [completed ? 1 : 0, completed ? now : null, now, setId]
      );
    },

    async removeSet(setId: string): Promise<void> {
      await db.runAsync(`DELETE FROM sets WHERE id = ?`, [setId]);
    },
  };
}

export type SetRepo = ReturnType<typeof createSetRepo>;
