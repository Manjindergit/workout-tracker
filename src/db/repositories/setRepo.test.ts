import { MG, seedExerciseId } from '../migrations/002_seed';
import { createMigratedTestDb, type TestDb } from '../testDb';
import { createSessionRepo } from './sessionRepo';
import { createSetRepo } from './setRepo';

const BENCH = seedExerciseId('01');

let db: TestDb;
let sessions: ReturnType<typeof createSessionRepo>;
let sets: ReturnType<typeof createSetRepo>;
let sessionExerciseId: string;

beforeEach(async () => {
  db = await createMigratedTestDb();
  sessions = createSessionRepo(db);
  sets = createSetRepo(db);
  const session = await sessions.startSession([MG.chest]);
  await sessions.addExercises(session.id, [BENCH]);
  const detail = await sessions.getSessionDetail(session.id);
  sessionExerciseId = detail!.exercises[0].id;
});

afterEach(() => db.close());

describe('setRepo', () => {
  it('addSet appends with the previous set’s values ("add a 4th set" flow)', async () => {
    const detail = await sessions.getSessionDetail((await sessions.findActive())!.id);
    const third = detail!.exercises[0].sets[2];
    await sets.updateValues(third.id, 55, 10);

    const added = await sets.addSet(sessionExerciseId);
    expect(added.position).toBe(4);
    expect(added.weightKg).toBe(55);
    expect(added.reps).toBe(10);
    expect(added.completed).toBe(false);
  });

  it('check-off toggle is an idempotent UPDATE on one row', async () => {
    const detail = await sessions.getSessionDetail((await sessions.findActive())!.id);
    const set = detail!.exercises[0].sets[0];

    await sets.setCompleted(set.id, true);
    await sets.setCompleted(set.id, true); // double-tap race: same terminal state
    await sets.setCompleted(set.id, false);

    const after = await sessions.getSessionDetail((await sessions.findActive())!.id);
    const toggled = after!.exercises[0].sets[0];
    expect(toggled.completed).toBe(false);
    expect(toggled.completedAt).toBeNull();

    const count = await db.getAllAsync('SELECT id FROM sets WHERE session_exercise_id = ?', [
      set.sessionExerciseId,
    ]);
    expect(count).toHaveLength(3); // toggling never inserts or deletes
  });

  it('removeSet deletes exactly one row', async () => {
    const detail = await sessions.getSessionDetail((await sessions.findActive())!.id);
    await sets.removeSet(detail!.exercises[0].sets[0].id);
    const after = await sessions.getSessionDetail((await sessions.findActive())!.id);
    expect(after!.exercises[0].sets).toHaveLength(2);
  });
});
