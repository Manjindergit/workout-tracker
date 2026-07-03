import { newId } from '../../utils/ids';
import { elapsedMs, nowIso } from '../../utils/dates';
import type {
  Session,
  SessionDetail,
  SessionExerciseDetail,
  SessionSummary,
  WorkoutSet,
} from '../../types/domain';
import type { DbExecutor } from '../executor';
import {
  mapSession,
  mapSet,
  type SessionExerciseRow,
  type SessionRow,
  type SetRow,
} from '../rows';

export class ActiveSessionExistsError extends Error {
  constructor() {
    super('An active session already exists — resume or discard it first');
    this.name = 'ActiveSessionExistsError';
  }
}

export const STALE_SESSION_MS = 12 * 60 * 60 * 1000;
export const DEFAULT_DRAFT_SETS = 3;

export type StaleCloseResult =
  | { outcome: 'none' } // no active session
  | { outcome: 'active'; session: Session } // fresh active session — offer resume
  | { outcome: 'closed'; session: Session; completedSets: number } // stale, auto-finished
  | { outcome: 'deleted' }; // stale with zero completed sets — removed

type SessionExerciseDetailRow = SessionExerciseRow & {
  exercise_name: string;
  muscle_group_name: string;
  is_bodyweight: number;
};

export function createSessionRepo(db: DbExecutor) {
  async function findActive(): Promise<Session | null> {
    const row = await db.getFirstAsync<SessionRow>(
      `SELECT * FROM sessions WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1`
    );
    return row ? mapSession(row) : null;
  }

  /** Most recent finished session's completed sets for this exercise, in position order. */
  async function getLastCompletedSets(exerciseId: string): Promise<WorkoutSet[]> {
    const rows = await db.getAllAsync<SetRow>(
      `SELECT st.* FROM sets st
       WHERE st.session_exercise_id = (
         SELECT se.id FROM session_exercises se
         JOIN sessions s ON s.id = se.session_id
         WHERE se.exercise_id = ? AND s.finished_at IS NOT NULL
         ORDER BY s.started_at DESC LIMIT 1
       ) AND st.completed = 1
       ORDER BY st.position ASC`,
      [exerciseId]
    );
    return rows.map(mapSet);
  }

  /** Inserts one session_exercises row plus its draft sets. Caller provides the transaction. */
  async function insertExerciseWithDrafts(
    sessionId: string,
    exerciseId: string,
    position: number
  ): Promise<void> {
    const now = nowIso();
    const sessionExerciseId = newId();
    await db.runAsync(
      `INSERT INTO session_exercises (id, session_id, exercise_id, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionExerciseId, sessionId, exerciseId, position, now, now]
    );

    // Prefill drafts from the exercise's last outing; fall back to empty drafts.
    const lastSets = await getLastCompletedSets(exerciseId);
    const drafts =
      lastSets.length > 0
        ? lastSets.map((s) => ({ weightKg: s.weightKg, reps: s.reps }))
        : Array.from({ length: DEFAULT_DRAFT_SETS }, () => ({ weightKg: 0, reps: 0 }));

    for (let i = 0; i < drafts.length; i++) {
      await db.runAsync(
        `INSERT INTO sets (id, session_exercise_id, position, weight_kg, reps, completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        [newId(), sessionExerciseId, i + 1, drafts[i].weightKg, drafts[i].reps, now, now]
      );
    }
  }

  async function addExercisesInTransaction(
    sessionId: string,
    exerciseIds: string[]
  ): Promise<void> {
    const maxRow = await db.getFirstAsync<{ max_pos: number | null }>(
      `SELECT MAX(position) AS max_pos FROM session_exercises WHERE session_id = ?`,
      [sessionId]
    );
    let position = maxRow?.max_pos ?? 0;
    for (const exerciseId of exerciseIds) {
      position += 1;
      await insertExerciseWithDrafts(sessionId, exerciseId, position);
    }
  }

  async function finishInTransaction(sessionId: string, finishedAt: string): Promise<void> {
    await db.runAsync(
      `DELETE FROM sets WHERE completed = 0 AND session_exercise_id IN
         (SELECT id FROM session_exercises WHERE session_id = ?)`,
      [sessionId]
    );
    await db.runAsync(`UPDATE sessions SET finished_at = ?, updated_at = ? WHERE id = ?`, [
      finishedAt,
      nowIso(),
      sessionId,
    ]);
  }

  return {
    findActive,
    getLastCompletedSets,

    /**
     * Creates the session skeleton eagerly — this is what makes crash recovery possible.
     * session_muscle_groups is written once here and never updated (planned-groups snapshot).
     */
    async startSession(muscleGroupIds: string[]): Promise<Session> {
      const existing = await findActive();
      if (existing) throw new ActiveSessionExistsError();

      const now = nowIso();
      const session: Session = {
        id: newId(),
        startedAt: now,
        finishedAt: null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      };
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO sessions (id, started_at, created_at, updated_at) VALUES (?, ?, ?, ?)`,
          [session.id, now, now, now]
        );
        for (const groupId of muscleGroupIds) {
          await db.runAsync(
            `INSERT INTO session_muscle_groups (session_id, muscle_group_id, created_at, updated_at)
             VALUES (?, ?, ?, ?)`,
            [session.id, groupId, now, now]
          );
        }
      });
      return session;
    },

    async addExercises(sessionId: string, exerciseIds: string[]): Promise<void> {
      await db.withTransactionAsync(() => addExercisesInTransaction(sessionId, exerciseIds));
    },

    async removeSessionExercise(sessionExerciseId: string): Promise<void> {
      await db.runAsync(`DELETE FROM session_exercises WHERE id = ?`, [sessionExerciseId]);
    },

    /** Deletes unchecked drafts and closes the session, atomically. */
    async finishSession(sessionId: string): Promise<void> {
      await db.withTransactionAsync(() => finishInTransaction(sessionId, nowIso()));
    },

    /** Removes the session and (via CASCADE) its junction rows and sets. */
    async discardSession(sessionId: string): Promise<void> {
      await db.runAsync(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
    },

    /**
     * Launch-time policy for a forgotten Finish tap. Fresh active sessions are offered
     * for resume; stale ones are finished at their last real activity or deleted if empty.
     */
    async closeStaleActiveSession(staleAfterMs: number = STALE_SESSION_MS): Promise<StaleCloseResult> {
      const active = await findActive();
      if (!active) return { outcome: 'none' };

      const lastSet = await db.getFirstAsync<{ last: string | null }>(
        `SELECT MAX(st.completed_at) AS last FROM sets st
         JOIN session_exercises se ON se.id = st.session_exercise_id
         WHERE se.session_id = ? AND st.completed = 1`,
        [active.id]
      );
      const lastActivity = lastSet?.last ?? active.startedAt;
      if (elapsedMs(lastActivity, nowIso()) < staleAfterMs) {
        return { outcome: 'active', session: active };
      }

      const countRow = await db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM sets st
         JOIN session_exercises se ON se.id = st.session_exercise_id
         WHERE se.session_id = ? AND st.completed = 1`,
        [active.id]
      );
      const completedSets = countRow?.n ?? 0;

      if (completedSets === 0) {
        await db.runAsync(`DELETE FROM sessions WHERE id = ?`, [active.id]);
        return { outcome: 'deleted' };
      }
      await db.withTransactionAsync(() => finishInTransaction(active.id, lastActivity));
      return { outcome: 'closed', session: { ...active, finishedAt: lastActivity }, completedSets };
    },

    /**
     * One-tap repeat: new session copying the latest finished session's planned groups and
     * exercises. Drafts prefill from that same session automatically (it is the most recent).
     */
    async repeatLastSession(): Promise<Session | null> {
      const last = await db.getFirstAsync<SessionRow>(
        `SELECT * FROM sessions WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`
      );
      if (!last) return null;

      const existing = await findActive();
      if (existing) throw new ActiveSessionExistsError();

      const groupRows = await db.getAllAsync<{ muscle_group_id: string }>(
        `SELECT muscle_group_id FROM session_muscle_groups WHERE session_id = ?`,
        [last.id]
      );
      const exerciseRows = await db.getAllAsync<{ exercise_id: string }>(
        `SELECT exercise_id FROM session_exercises WHERE session_id = ? ORDER BY position ASC`,
        [last.id]
      );

      const now = nowIso();
      const session: Session = {
        id: newId(),
        startedAt: now,
        finishedAt: null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      };
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO sessions (id, started_at, created_at, updated_at) VALUES (?, ?, ?, ?)`,
          [session.id, now, now, now]
        );
        for (const g of groupRows) {
          await db.runAsync(
            `INSERT INTO session_muscle_groups (session_id, muscle_group_id, created_at, updated_at)
             VALUES (?, ?, ?, ?)`,
            [session.id, g.muscle_group_id, now, now]
          );
        }
        await addExercisesInTransaction(
          session.id,
          exerciseRows.map((r) => r.exercise_id)
        );
      });
      return session;
    },

    async getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
      const sessionRow = await db.getFirstAsync<SessionRow>(
        `SELECT * FROM sessions WHERE id = ?`,
        [sessionId]
      );
      if (!sessionRow) return null;

      const exerciseRows = await db.getAllAsync<SessionExerciseDetailRow>(
        `SELECT se.*, e.name AS exercise_name, e.is_bodyweight, mg.name AS muscle_group_name
         FROM session_exercises se
         JOIN exercises e ON e.id = se.exercise_id
         JOIN muscle_groups mg ON mg.id = e.primary_muscle_group_id
         WHERE se.session_id = ?
         ORDER BY se.position ASC`,
        [sessionId]
      );
      const setRows = await db.getAllAsync<SetRow>(
        `SELECT st.* FROM sets st
         JOIN session_exercises se ON se.id = st.session_exercise_id
         WHERE se.session_id = ?
         ORDER BY st.position ASC`,
        [sessionId]
      );

      const setsBySe = new Map<string, WorkoutSet[]>();
      for (const row of setRows) {
        const list = setsBySe.get(row.session_exercise_id) ?? [];
        list.push(mapSet(row));
        setsBySe.set(row.session_exercise_id, list);
      }

      const exercises: SessionExerciseDetail[] = exerciseRows.map((r) => ({
        id: r.id,
        sessionId: r.session_id,
        exerciseId: r.exercise_id,
        position: r.position,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        exerciseName: r.exercise_name,
        muscleGroupName: r.muscle_group_name,
        isBodyweight: r.is_bodyweight === 1,
        sets: setsBySe.get(r.id) ?? [],
      }));

      return { ...mapSession(sessionRow), exercises };
    },

    async listFinished(limit = 50, offset = 0): Promise<SessionSummary[]> {
      const rows = await db.getAllAsync<{
        id: string;
        started_at: string;
        finished_at: string | null;
        exercise_count: number;
        completed_set_count: number;
      }>(
        `SELECT s.id, s.started_at, s.finished_at,
           COUNT(DISTINCT se.id) AS exercise_count,
           COUNT(DISTINCT CASE WHEN st.completed = 1 THEN st.id END) AS completed_set_count
         FROM sessions s
         LEFT JOIN session_exercises se ON se.session_id = s.id
         LEFT JOIN sets st ON st.session_exercise_id = se.id
         WHERE s.finished_at IS NOT NULL
         GROUP BY s.id
         ORDER BY s.started_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      if (rows.length === 0) return [];

      // Group labels derive from actual exercises, never from session_muscle_groups.
      const placeholders = rows.map(() => '?').join(', ');
      const groupRows = await db.getAllAsync<{ session_id: string; name: string }>(
        `SELECT DISTINCT se.session_id, mg.name
         FROM session_exercises se
         JOIN exercises e ON e.id = se.exercise_id
         JOIN muscle_groups mg ON mg.id = e.primary_muscle_group_id
         WHERE se.session_id IN (${placeholders})
         ORDER BY mg.rowid ASC`,
        rows.map((r) => r.id)
      );
      const groupsBySession = new Map<string, string[]>();
      for (const g of groupRows) {
        const list = groupsBySession.get(g.session_id) ?? [];
        list.push(g.name);
        groupsBySession.set(g.session_id, list);
      }

      return rows.map((r) => ({
        id: r.id,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        exerciseCount: r.exercise_count,
        completedSetCount: r.completed_set_count,
        muscleGroups: groupsBySession.get(r.id) ?? [],
      }));
    },
  };
}

export type SessionRepo = ReturnType<typeof createSessionRepo>;
