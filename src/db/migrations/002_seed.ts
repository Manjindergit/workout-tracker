import type { Migration } from '../migrations';

/**
 * Seed library. UUIDs are HARDCODED and canonical: every install gets identical ids,
 * which is what lets a future sync/merge identify seeded rows across devices and lets
 * later migrations reference them. Never regenerate these; never reuse a retired id.
 * Seeded rows have is_custom = 0; user-created rows default to 1.
 */
const SEED_AT = '2026-01-01T00:00:00.000Z';

// Muscle groups occupy the ...0000000000NN range.
export const MG = {
  chest: '00000000-0000-4000-8000-000000000001',
  back: '00000000-0000-4000-8000-000000000002',
  shoulders: '00000000-0000-4000-8000-000000000003',
  biceps: '00000000-0000-4000-8000-000000000004',
  triceps: '00000000-0000-4000-8000-000000000005',
  legs: '00000000-0000-4000-8000-000000000006',
  glutes: '00000000-0000-4000-8000-000000000007',
  core: '00000000-0000-4000-8000-000000000008',
} as const;

// Exercises occupy the ...00000001NN range (NN = two decimal digits, hex-safe).
export const seedExerciseId = (nn: string) => `00000000-0000-4000-8000-0000000001${nn}`;

const GROUPS: [id: string, name: string][] = [
  [MG.chest, 'Chest'],
  [MG.back, 'Back'],
  [MG.shoulders, 'Shoulders'],
  [MG.biceps, 'Biceps'],
  [MG.triceps, 'Triceps'],
  [MG.legs, 'Legs'],
  [MG.glutes, 'Glutes'],
  [MG.core, 'Core'],
];

// [id suffix, name, muscle group, isBodyweight]
const EXERCISES: [nn: string, name: string, group: string, bw: 0 | 1][] = [
  ['01', 'Bench Press', MG.chest, 0],
  ['02', 'Incline Bench Press', MG.chest, 0],
  ['03', 'Dumbbell Bench Press', MG.chest, 0],
  ['04', 'Chest Fly', MG.chest, 0],
  ['05', 'Cable Crossover', MG.chest, 0],
  ['06', 'Push-Up', MG.chest, 1],
  ['07', 'Deadlift', MG.back, 0],
  ['08', 'Barbell Row', MG.back, 0],
  ['09', 'Seated Cable Row', MG.back, 0],
  ['10', 'Lat Pulldown', MG.back, 0],
  ['11', 'Pull-Up', MG.back, 1],
  ['12', 'Chin-Up', MG.back, 1],
  ['13', 'Overhead Press', MG.shoulders, 0],
  ['14', 'Dumbbell Shoulder Press', MG.shoulders, 0],
  ['15', 'Lateral Raise', MG.shoulders, 0],
  ['16', 'Rear Delt Fly', MG.shoulders, 0],
  ['17', 'Face Pull', MG.shoulders, 0],
  ['18', 'Barbell Curl', MG.biceps, 0],
  ['19', 'Dumbbell Curl', MG.biceps, 0],
  ['20', 'Hammer Curl', MG.biceps, 0],
  ['21', 'Preacher Curl', MG.biceps, 0],
  ['22', 'Triceps Pushdown', MG.triceps, 0],
  ['23', 'Skull Crusher', MG.triceps, 0],
  ['24', 'Overhead Triceps Extension', MG.triceps, 0],
  ['25', 'Dip', MG.triceps, 1],
  ['26', 'Squat', MG.legs, 0],
  ['27', 'Front Squat', MG.legs, 0],
  ['28', 'Leg Press', MG.legs, 0],
  ['29', 'Romanian Deadlift', MG.legs, 0],
  ['30', 'Leg Extension', MG.legs, 0],
  ['31', 'Leg Curl', MG.legs, 0],
  ['32', 'Calf Raise', MG.legs, 0],
  ['33', 'Walking Lunge', MG.legs, 0],
  ['34', 'Hip Thrust', MG.glutes, 0],
  ['35', 'Glute Bridge', MG.glutes, 0],
  ['36', 'Cable Crunch', MG.core, 0],
  ['37', 'Russian Twist', MG.core, 0],
  ['38', 'Sit-Up', MG.core, 1],
  ['39', 'Hanging Leg Raise', MG.core, 1],
];

export const m002Seed: Migration = {
  version: 2,
  name: 'seed-library',
  statements: [
    ...GROUPS.map(
      ([id, name]) =>
        `INSERT OR IGNORE INTO muscle_groups (id, name, is_custom, created_at, updated_at)
         VALUES ('${id}', '${name}', 0, '${SEED_AT}', '${SEED_AT}')`
    ),
    ...EXERCISES.map(
      ([nn, name, group, bw]) =>
        `INSERT OR IGNORE INTO exercises
           (id, primary_muscle_group_id, name, is_bodyweight, is_custom, created_at, updated_at)
         VALUES ('${seedExerciseId(nn)}', '${group}', '${name.replace(/'/g, "''")}', ${bw}, 0, '${SEED_AT}', '${SEED_AT}')`
    ),
  ],
};
