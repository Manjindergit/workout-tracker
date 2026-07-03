import type { Migration } from '../migrations';

/**
 * Initial schema. Design rules (see agent_docs/db-schema.md):
 * - TEXT UUID PKs, TEXT ISO-8601 UTC (ms) timestamps.
 * - ON DELETE CASCADE session -> children; RESTRICT protects reference data.
 * - Reference data (muscle_groups, exercises) is soft-deleted via deleted_at.
 * - position columns are the only source of UI ordering.
 * - sessions.finished_at IS NULL marks the active session (crash-recovery sentinel).
 */
export const m001Initial: Migration = {
  version: 1,
  name: 'initial-schema',
  statements: [
    `CREATE TABLE muscle_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_custom INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE UNIQUE INDEX ux_muscle_groups_name
      ON muscle_groups(name COLLATE NOCASE) WHERE deleted_at IS NULL`,

    `CREATE TABLE exercises (
      id TEXT PRIMARY KEY,
      primary_muscle_group_id TEXT NOT NULL REFERENCES muscle_groups(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      is_bodyweight INTEGER NOT NULL DEFAULT 0,
      is_custom INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE UNIQUE INDEX ux_exercises_name
      ON exercises(name COLLATE NOCASE) WHERE deleted_at IS NULL`,
    `CREATE INDEX idx_exercises_mg ON exercises(primary_muscle_group_id)`,

    `CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX idx_sessions_started ON sessions(started_at DESC)`,
    `CREATE INDEX idx_sessions_finished ON sessions(finished_at)`,

    `CREATE TABLE session_muscle_groups (
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      muscle_group_id TEXT NOT NULL REFERENCES muscle_groups(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, muscle_group_id)
    )`,

    `CREATE TABLE session_exercises (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (session_id, exercise_id)
    )`,
    `CREATE INDEX idx_se_session ON session_exercises(session_id)`,
    `CREATE INDEX idx_se_exercise ON session_exercises(exercise_id)`,

    `CREATE TABLE sets (
      id TEXT PRIMARY KEY,
      session_exercise_id TEXT NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      weight_kg REAL NOT NULL DEFAULT 0,
      reps INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX idx_sets_se ON sets(session_exercise_id, position)`,

    `CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ],
};
