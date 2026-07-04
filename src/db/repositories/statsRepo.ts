import type { DbExecutor } from '../executor';

export interface SeriesPoint {
  sessionId: string;
  startedAt: string;
  value: number;
}

export interface TrackedExercise {
  id: string;
  name: string;
  muscleGroupName: string;
  isBodyweight: boolean;
  sessionCount: number;
}

export interface HistorySetRow {
  sessionId: string;
  startedAt: string;
  weightKg: number;
  reps: number;
  position: number;
}

export function createStatsRepo(db: DbExecutor) {
  return {
    /**
     * Best estimated 1RM (Epley) per finished session. reps/30.0 — the .0 matters:
     * integer division would silently zero the bonus term.
     */
    async e1rmSeries(exerciseId: string): Promise<SeriesPoint[]> {
      return db.getAllAsync<SeriesPoint>(
        `SELECT s.id AS sessionId, s.started_at AS startedAt,
           MAX(st.weight_kg * (1 + st.reps / 30.0)) AS value
         FROM sets st
         JOIN session_exercises se ON se.id = st.session_exercise_id
         JOIN sessions s ON s.id = se.session_id
         WHERE se.exercise_id = ? AND st.completed = 1 AND st.reps > 0
           AND s.finished_at IS NOT NULL
         GROUP BY s.id
         ORDER BY s.started_at ASC`,
        [exerciseId]
      );
    },

    /** Best-set reps per finished session — the progress metric for bodyweight exercises. */
    async repsSeries(exerciseId: string): Promise<SeriesPoint[]> {
      return db.getAllAsync<SeriesPoint>(
        `SELECT s.id AS sessionId, s.started_at AS startedAt, MAX(st.reps) AS value
         FROM sets st
         JOIN session_exercises se ON se.id = st.session_exercise_id
         JOIN sessions s ON s.id = se.session_id
         WHERE se.exercise_id = ? AND st.completed = 1 AND st.reps > 0
           AND s.finished_at IS NOT NULL
         GROUP BY s.id
         ORDER BY s.started_at ASC`,
        [exerciseId]
      );
    },

    /** Every completed set of one exercise across finished sessions — feeds the single-exercise export. */
    async exerciseSetsHistory(exerciseId: string): Promise<HistorySetRow[]> {
      return db.getAllAsync<HistorySetRow>(
        `SELECT s.id AS sessionId, s.started_at AS startedAt,
           st.weight_kg AS weightKg, st.reps AS reps, st.position AS position
         FROM sets st
         JOIN session_exercises se ON se.id = st.session_exercise_id
         JOIN sessions s ON s.id = se.session_id
         WHERE se.exercise_id = ? AND st.completed = 1 AND s.finished_at IS NOT NULL
         ORDER BY s.started_at ASC, st.position ASC`,
        [exerciseId]
      );
    },

    /** Progress-tab root: every exercise with at least one completed set in a finished session. */
    async listTrackedExercises(): Promise<TrackedExercise[]> {
      return db.getAllAsync<TrackedExercise>(
        `SELECT e.id, e.name, mg.name AS muscleGroupName,
           e.is_bodyweight AS isBodyweight,
           COUNT(DISTINCT s.id) AS sessionCount
         FROM exercises e
         JOIN muscle_groups mg ON mg.id = e.primary_muscle_group_id
         JOIN session_exercises se ON se.exercise_id = e.id
         JOIN sessions s ON s.id = se.session_id AND s.finished_at IS NOT NULL
         JOIN sets st ON st.session_exercise_id = se.id AND st.completed = 1
         GROUP BY e.id
         ORDER BY mg.rowid ASC, e.name COLLATE NOCASE ASC`
      ).then((rows) =>
        rows.map((r) => ({ ...r, isBodyweight: (r.isBodyweight as unknown as number) === 1 }))
      );
    },
  };
}

export type StatsRepo = ReturnType<typeof createStatsRepo>;
