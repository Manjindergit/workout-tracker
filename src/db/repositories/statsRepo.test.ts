import { MG, seedExerciseId } from '../migrations/002_seed';
import { createMigratedTestDb, type TestDb } from '../testDb';
import { createSessionRepo } from './sessionRepo';
import { createSetRepo } from './setRepo';
import { createStatsRepo } from './statsRepo';

const BENCH = seedExerciseId('01');
const PULL_UP = seedExerciseId('11');

let db: TestDb;
let sessions: ReturnType<typeof createSessionRepo>;
let sets: ReturnType<typeof createSetRepo>;
let stats: ReturnType<typeof createStatsRepo>;

beforeEach(async () => {
  db = await createMigratedTestDb();
  sessions = createSessionRepo(db);
  sets = createSetRepo(db);
  stats = createStatsRepo(db);
});

afterEach(() => db.close());

async function logFinishedSession(exerciseId: string, completed: [number, number][]) {
  const session = await sessions.startSession([MG.chest]);
  await sessions.addExercises(session.id, [exerciseId]);
  const detail = await sessions.getSessionDetail(session.id);
  const drafts = detail!.exercises[0].sets;
  for (let i = 0; i < completed.length; i++) {
    const draft = drafts[i] ?? (await sets.addSet(detail!.exercises[0].id));
    await sets.updateValues(draft.id, completed[i][0], completed[i][1]);
    await sets.setCompleted(draft.id, true);
  }
  await sessions.finishSession(session.id);
  return session;
}

describe('statsRepo', () => {
  it('e1rmSeries applies Epley with real division — the /30.0 regression test', async () => {
    await logFinishedSession(BENCH, [[100, 5]]);
    const [point] = await stats.e1rmSeries(BENCH);
    // Integer division (reps/30 = 0) would return exactly 100 — must be 116.67.
    expect(point.value).toBeCloseTo(116.67, 2);
    expect(point.value).toBeGreaterThan(100);
  });

  it('takes the best set per session and orders sessions chronologically', async () => {
    const first = await logFinishedSession(BENCH, [
      [80, 8], // e1RM ≈ 101.3
      [100, 3], // e1RM = 110 ← best
    ]);
    const second = await logFinishedSession(BENCH, [[105, 2]]); // e1RM = 112

    const series = await stats.e1rmSeries(BENCH);
    expect(series.map((p) => p.sessionId)).toEqual([first.id, second.id]);
    expect(series[0].value).toBeCloseTo(110, 2);
    expect(series[1].value).toBeCloseTo(112, 2);
  });

  it('excludes active sessions and unchecked sets', async () => {
    await logFinishedSession(BENCH, [[100, 5]]);
    // Active session with a checked set — must not appear until finished.
    const active = await sessions.startSession([MG.chest]);
    await sessions.addExercises(active.id, [BENCH]);
    const detail = await sessions.getSessionDetail(active.id);
    await sets.updateValues(detail!.exercises[0].sets[0].id, 200, 1);
    await sets.setCompleted(detail!.exercises[0].sets[0].id, true);

    const series = await stats.e1rmSeries(BENCH);
    expect(series).toHaveLength(1);
    expect(series[0].value).toBeCloseTo(116.67, 2);
  });

  it('repsSeries reports best-set reps for bodyweight work', async () => {
    await logFinishedSession(PULL_UP, [
      [0, 8],
      [0, 10],
      [0, 6],
    ]);
    const series = await stats.repsSeries(PULL_UP);
    expect(series).toHaveLength(1);
    expect(series[0].value).toBe(10);
    // And the e1RM series is meaningless here: 0kg sets are excluded by weight*…=0 max? No —
    // they produce value 0 rows; the UI must use repsSeries for bodyweight exercises.
  });

  it('listTrackedExercises returns only exercises with completed sets in finished sessions', async () => {
    await logFinishedSession(BENCH, [[100, 5]]);
    await sessions.startSession([MG.back]); // active, no completed sets

    const tracked = await stats.listTrackedExercises();
    expect(tracked).toHaveLength(1);
    expect(tracked[0]).toMatchObject({
      id: BENCH,
      name: 'Bench Press',
      muscleGroupName: 'Chest',
      isBodyweight: false,
      sessionCount: 1,
    });
  });
});
