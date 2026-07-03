export interface MuscleGroup {
  id: string;
  name: string;
  isCustom: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Exercise {
  id: string;
  primaryMuscleGroupId: string;
  name: string;
  isBodyweight: boolean;
  isCustom: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutSet {
  id: string;
  sessionExerciseId: string;
  position: number;
  weightKg: number;
  reps: number;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A session's exercise joined with its exercise metadata and ordered sets. */
export interface SessionExerciseDetail extends SessionExercise {
  exerciseName: string;
  muscleGroupName: string;
  isBodyweight: boolean;
  sets: WorkoutSet[];
}

/** Full nested view of one session, as needed by the log screen, detail screen, and export. */
export interface SessionDetail extends Session {
  exercises: SessionExerciseDetail[];
}

/** Row for the History list. */
export interface SessionSummary {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  exerciseCount: number;
  completedSetCount: number;
  /** Distinct muscle-group names derived from the session's exercises (never from session_muscle_groups). */
  muscleGroups: string[];
}
