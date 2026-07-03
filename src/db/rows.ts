import type { Exercise, MuscleGroup, Session, SessionExercise, WorkoutSet } from '../types/domain';

/** Raw snake_case row shapes as returned by SQLite, mapped to camelCase domain types here. */

export interface MuscleGroupRow {
  id: string;
  name: string;
  is_custom: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseRow {
  id: string;
  primary_muscle_group_id: string;
  name: string;
  is_bodyweight: number;
  is_custom: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionExerciseRow {
  id: string;
  session_id: string;
  exercise_id: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface SetRow {
  id: string;
  session_exercise_id: string;
  position: number;
  weight_kg: number;
  reps: number;
  completed: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const mapMuscleGroup = (r: MuscleGroupRow): MuscleGroup => ({
  id: r.id,
  name: r.name,
  isCustom: r.is_custom === 1,
  deletedAt: r.deleted_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const mapExercise = (r: ExerciseRow): Exercise => ({
  id: r.id,
  primaryMuscleGroupId: r.primary_muscle_group_id,
  name: r.name,
  isBodyweight: r.is_bodyweight === 1,
  isCustom: r.is_custom === 1,
  deletedAt: r.deleted_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const mapSession = (r: SessionRow): Session => ({
  id: r.id,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const mapSessionExercise = (r: SessionExerciseRow): SessionExercise => ({
  id: r.id,
  sessionId: r.session_id,
  exerciseId: r.exercise_id,
  position: r.position,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const mapSet = (r: SetRow): WorkoutSet => ({
  id: r.id,
  sessionExerciseId: r.session_exercise_id,
  position: r.position,
  weightKg: r.weight_kg,
  reps: r.reps,
  completed: r.completed === 1,
  completedAt: r.completed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
