import { create } from 'zustand';

import { getRepos } from '../db/appDb';
import type { SessionDetail, WorkoutSet } from '../types/domain';
import { formatWeight } from '../utils/units';

/**
 * In-memory mirror of the active session. SQLite is the single source of truth:
 * every mutation lands in the db (keystrokes via a debounced flush, everything else
 * immediately); this store only exists so inputs update at memory speed. It is never
 * persisted — relaunch rehydrates from sessionRepo.findActive().
 */

export interface ActiveSet {
  id: string;
  position: number;
  weightKg: number;
  reps: number;
  completed: boolean;
}

export interface ActiveExercise {
  sessionExerciseId: string;
  exerciseId: string;
  name: string;
  muscleGroupName: string;
  isBodyweight: boolean;
  /** e.g. "Last: 80 kg×8, 82.5 kg×6" — from the exercise's previous finished session. */
  lastLabel: string | null;
  sets: ActiveSet[];
}

interface ActiveWorkoutState {
  sessionId: string | null;
  startedAt: string | null;
  exercises: ActiveExercise[];

  startNew(muscleGroupIds: string[], exerciseIds: string[]): Promise<void>;
  repeatLast(): Promise<boolean>;
  resume(): Promise<boolean>;
  addExercises(exerciseIds: string[]): Promise<void>;
  removeExercise(sessionExerciseId: string): Promise<void>;
  setSetValues(sessionExerciseId: string, setId: string, weightKg: number, reps: number): void;
  toggleSet(sessionExerciseId: string, setId: string): Promise<void>;
  addSet(sessionExerciseId: string): Promise<void>;
  removeSet(sessionExerciseId: string, setId: string): Promise<void>;
  /** Flushes pending edits, deletes drafts, closes the session. Returns the id for routing. */
  finish(): Promise<string | null>;
  discard(): Promise<void>;
  clear(): void;
}

const DEBOUNCE_MS = 400;
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingValues = new Map<string, { weightKg: number; reps: number }>();

async function flushSet(setId: string): Promise<void> {
  const timer = pendingTimers.get(setId);
  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(setId);
  }
  const values = pendingValues.get(setId);
  if (!values) return;
  pendingValues.delete(setId);
  const { sets } = await getRepos();
  await sets.updateValues(setId, values.weightKg, values.reps);
}

async function flushAllSets(): Promise<void> {
  const ids = [...pendingValues.keys()];
  for (const id of ids) await flushSet(id);
}

function formatLastLabel(lastSets: WorkoutSet[]): string | null {
  if (lastSets.length === 0) return null;
  const parts = lastSets.map((s) => `${formatWeight(s.weightKg, 'kg')}×${s.reps}`);
  return `Last: ${parts.join(', ')}`;
}

async function toActiveExercises(detail: SessionDetail): Promise<ActiveExercise[]> {
  const { sessions } = await getRepos();
  return Promise.all(
    detail.exercises.map(async (se) => ({
      sessionExerciseId: se.id,
      exerciseId: se.exerciseId,
      name: se.exerciseName,
      muscleGroupName: se.muscleGroupName,
      isBodyweight: se.isBodyweight,
      lastLabel: formatLastLabel(await sessions.getLastCompletedSets(se.exerciseId)),
      sets: se.sets.map((s) => ({
        id: s.id,
        position: s.position,
        weightKg: s.weightKg,
        reps: s.reps,
        completed: s.completed,
      })),
    }))
  );
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => {
  async function hydrate(sessionId: string): Promise<void> {
    const { sessions } = await getRepos();
    const detail = await sessions.getSessionDetail(sessionId);
    if (!detail) {
      set({ sessionId: null, startedAt: null, exercises: [] });
      return;
    }
    set({
      sessionId: detail.id,
      startedAt: detail.startedAt,
      exercises: await toActiveExercises(detail),
    });
  }

  /**
   * Optimistic mirror updates self-heal: if the SQLite write fails, rehydrate the
   * store from the db so the UI snaps back to the truth instead of diverging.
   */
  async function mutateOrResync(mutation: () => Promise<void>): Promise<void> {
    try {
      await mutation();
    } catch (error) {
      console.warn('[activeWorkout] mutation failed; resyncing from SQLite', error);
      const { sessionId } = get();
      if (sessionId) await hydrate(sessionId);
    }
  }

  return {
    sessionId: null,
    startedAt: null,
    exercises: [],

    async startNew(muscleGroupIds, exerciseIds) {
      const { sessions } = await getRepos();
      const session = await sessions.startSession(muscleGroupIds);
      if (exerciseIds.length > 0) await sessions.addExercises(session.id, exerciseIds);
      await hydrate(session.id);
    },

    async repeatLast() {
      const { sessions } = await getRepos();
      const session = await sessions.repeatLastSession();
      if (!session) return false;
      await hydrate(session.id);
      return true;
    },

    async resume() {
      const { sessions } = await getRepos();
      const active = await sessions.findActive();
      if (!active) return false;
      await hydrate(active.id);
      return true;
    },

    async addExercises(exerciseIds) {
      const { sessionId } = get();
      if (!sessionId || exerciseIds.length === 0) return;
      const { sessions } = await getRepos();
      const existing = new Set(get().exercises.map((e) => e.exerciseId));
      const fresh = exerciseIds.filter((id) => !existing.has(id));
      if (fresh.length > 0) await sessions.addExercises(sessionId, fresh);
      await hydrate(sessionId);
    },

    async removeExercise(sessionExerciseId) {
      set((state) => ({
        exercises: state.exercises.filter((e) => e.sessionExerciseId !== sessionExerciseId),
      }));
      await mutateOrResync(async () => {
        const { sessions } = await getRepos();
        await sessions.removeSessionExercise(sessionExerciseId);
      });
    },

    setSetValues(sessionExerciseId, setId, weightKg, reps) {
      set((state) => ({
        exercises: state.exercises.map((e) =>
          e.sessionExerciseId === sessionExerciseId
            ? {
                ...e,
                sets: e.sets.map((s) => (s.id === setId ? { ...s, weightKg, reps } : s)),
              }
            : e
        ),
      }));
      pendingValues.set(setId, { weightKg, reps });
      const existing = pendingTimers.get(setId);
      if (existing) clearTimeout(existing);
      pendingTimers.set(
        setId,
        setTimeout(() => {
          void flushSet(setId);
        }, DEBOUNCE_MS)
      );
    },

    async toggleSet(sessionExerciseId, setId) {
      const exercise = get().exercises.find((e) => e.sessionExerciseId === sessionExerciseId);
      const target = exercise?.sets.find((s) => s.id === setId);
      if (!target) return;
      const completed = !target.completed;
      set((state) => ({
        exercises: state.exercises.map((e) =>
          e.sessionExerciseId === sessionExerciseId
            ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, completed } : s)) }
            : e
        ),
      }));
      // Typed-then-immediately-checked: land the values before the completion flag.
      await mutateOrResync(async () => {
        await flushSet(setId);
        const { sets } = await getRepos();
        await sets.setCompleted(setId, completed);
      });
    },

    async addSet(sessionExerciseId) {
      const { sets } = await getRepos();
      const created = await sets.addSet(sessionExerciseId);
      set((state) => ({
        exercises: state.exercises.map((e) =>
          e.sessionExerciseId === sessionExerciseId
            ? {
                ...e,
                sets: [
                  ...e.sets,
                  {
                    id: created.id,
                    position: created.position,
                    weightKg: created.weightKg,
                    reps: created.reps,
                    completed: false,
                  },
                ],
              }
            : e
        ),
      }));
    },

    async removeSet(sessionExerciseId, setId) {
      pendingValues.delete(setId);
      const timer = pendingTimers.get(setId);
      if (timer) clearTimeout(timer);
      pendingTimers.delete(setId);
      set((state) => ({
        exercises: state.exercises.map((e) =>
          e.sessionExerciseId === sessionExerciseId
            ? { ...e, sets: e.sets.filter((s) => s.id !== setId) }
            : e
        ),
      }));
      await mutateOrResync(async () => {
        const { sets } = await getRepos();
        await sets.removeSet(setId);
      });
    },

    async finish() {
      const { sessionId } = get();
      if (!sessionId) return null;
      await flushAllSets();
      const { sessions } = await getRepos();
      await sessions.finishSession(sessionId);
      get().clear();
      return sessionId;
    },

    async discard() {
      const { sessionId } = get();
      if (!sessionId) return;
      pendingTimers.forEach((t) => clearTimeout(t));
      pendingTimers.clear();
      pendingValues.clear();
      const { sessions } = await getRepos();
      await sessions.discardSession(sessionId);
      get().clear();
    },

    clear() {
      pendingTimers.forEach((t) => clearTimeout(t));
      pendingTimers.clear();
      pendingValues.clear();
      set({ sessionId: null, startedAt: null, exercises: [] });
    },
  };
});
