import { openDatabaseAsync } from 'expo-sqlite';

import { DATABASE_NAME, initDb, wrapExpoDb } from './client';
import type { DbExecutor } from './executor';
import { createExerciseRepo, type ExerciseRepo } from './repositories/exerciseRepo';
import { createMuscleGroupRepo, type MuscleGroupRepo } from './repositories/muscleGroupRepo';
import { createSessionRepo, type SessionRepo } from './repositories/sessionRepo';
import { createSetRepo, type SetRepo } from './repositories/setRepo';
import { createSettingsRepo, type SettingsRepo } from './repositories/settingsRepo';
import { createStatsRepo, type StatsRepo } from './repositories/statsRepo';

export interface Repos {
  db: DbExecutor;
  muscleGroups: MuscleGroupRepo;
  exercises: ExerciseRepo;
  sessions: SessionRepo;
  sets: SetRepo;
  stats: StatsRepo;
  settings: SettingsRepo;
}

let reposPromise: Promise<Repos> | null = null;

async function openRepos(): Promise<Repos> {
  // useNewConnection: Expo Go / dev reloads can hand back a cached native
  // connection from a dead JS context, which then NPEs on the first prepare.
  const raw = await openDatabaseAsync(DATABASE_NAME, { useNewConnection: true });
  await initDb(raw);
  const db = wrapExpoDb(raw);
  return {
    db,
    muscleGroups: createMuscleGroupRepo(db),
    exercises: createExerciseRepo(db),
    sessions: createSessionRepo(db),
    sets: createSetRepo(db),
    stats: createStatsRepo(db),
    settings: createSettingsRepo(db),
  };
}

/**
 * Single app-wide connection, opened lazily and migrated once. A module-level
 * singleton (not React context) so Zustand actions and screens share the same
 * repositories without plumbing. A failed open clears the cache so the next
 * call retries instead of replaying the cached rejection forever.
 */
export function getRepos(): Promise<Repos> {
  if (!reposPromise) {
    reposPromise = openRepos().catch((error) => {
      reposPromise = null;
      throw error;
    });
  }
  return reposPromise;
}
