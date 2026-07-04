import type { Migration } from '../migrations';
import { MG, seedExerciseId } from './002_seed';

/**
 * Seed pack 2. Same rules as 002: canonical hardcoded UUIDs (continuing the
 * ...0000000001NN sequence), INSERT OR IGNORE, is_custom = 0. Append-only —
 * never fold these back into 002.
 */
const SEED_AT = '2026-07-04T00:00:00.000Z';

// [id suffix, name, muscle group]
const EXERCISES: [nn: string, name: string, group: string][] = [
  ['40', 'Landmine Row', MG.back],
  ['41', 'Hip Adduction', MG.legs],
  ['42', 'Hip Abduction', MG.legs],
];

export const m003SeedMore: Migration = {
  version: 3,
  name: 'seed-library-2',
  statements: EXERCISES.map(
    ([nn, name, group]) =>
      `INSERT OR IGNORE INTO exercises
         (id, primary_muscle_group_id, name, is_bodyweight, is_custom, created_at, updated_at)
       VALUES ('${seedExerciseId(nn)}', '${group}', '${name}', 0, 0, '${SEED_AT}', '${SEED_AT}')`
  ),
};
