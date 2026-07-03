import { MG, seedExerciseId } from '../migrations/002_seed';
import { createMigratedTestDb, type TestDb } from '../testDb';
import { ActiveSessionExistsError, createSessionRepo } from './sessionRepo';
import { createSetRepo } from './setRepo';

const BENCH = seedExerciseId('01');
const SQUAT = seedExerciseId('26');
const PULL_UP = seedExerciseId('11');

let db: TestDb;
let sessions: ReturnType<typeof createSessionRepo>;
let sets: ReturnType<typeof createSetRepo>;

beforeEach(async () => {
  db = await createMigratedTestDb();
  sessions = createSessionRepo(db);
  sets = createSetRepo(db);
});

afterEach(() => db.close());

/** Check off the first `count` sets of a session-exercise, returning their ids. */
async function checkOffSets(sessionId: string, exerciseId: string, count: number) {
  const detail = await sessions.getSessionDetail(sessionId);
  const se = detail!.exercises.find((e) => e.exerciseId === exerciseId)!;
  const ids: string[] = [];
  for (const set of se.sets.slice(0, count)) {
    await sets.setCompleted(set.id, true);
    ids.push(set.id);
  }
  return ids;
}

async function backdate(sessionId: string, hoursAgo: number) {
  const past = new Date(Date.now() - hoursAgo * 3600_000).toISOString();
  await db.runAsync('UPDATE sessions SET started_at = ? WHERE id = ?', [past, sessionId]);
  await db.runAsync(
    `UPDATE sets SET completed_at = ? WHERE completed = 1 AND session_exercise_id IN
       (SELECT id FROM session_exercises WHERE session_id = ?)`,
    [past, sessionId]
  );
}

describe('session lifecycle', () => {
  it('startSession eagerly persists the skeleton with the planned-groups snapshot', async () => {
    const session = await sessions.startSession([MG.chest, MG.triceps]);

    const active = await sessions.findActive();
    expect(active?.id).toBe(session.id);
    expect(active?.finishedAt).toBeNull();

    const smg = await db.getAllAsync<{ muscle_group_id: string }>(
      'SELECT muscle_group_id FROM session_muscle_groups WHERE session_id = ?',
      [session.id]
    );
    expect(smg.map((r) => r.muscle_group_id).sort()).toEqual([MG.chest, MG.triceps].sort());
  });

  it('refuses a second active session', async () => {
    await sessions.startSession([MG.chest]);
    await expect(sessions.startSession([MG.back])).rejects.toThrow(ActiveSessionExistsError);
  });

  it('addExercises creates 3 empty drafts when the exercise has no history', async () => {
    const session = await sessions.startSession([MG.chest]);
    await sessions.addExercises(session.id, [BENCH, SQUAT]);

    const detail = await sessions.getSessionDetail(session.id);
    expect(detail!.exercises.map((e) => e.exerciseId)).toEqual([BENCH, SQUAT]);
    expect(detail!.exercises.map((e) => e.position)).toEqual([1, 2]);
    for (const se of detail!.exercises) {
      expect(se.sets).toHaveLength(3);
      expect(se.sets.map((s) => s.position)).toEqual([1, 2, 3]);
      expect(se.sets.every((s) => !s.completed && s.weightKg === 0 && s.reps === 0)).toBe(true);
    }
  });

  it('finishSession deletes unchecked drafts and stamps finished_at atomically', async () => {
    const session = await sessions.startSession([MG.chest]);
    await sessions.addExercises(session.id, [BENCH]);
    await checkOffSets(session.id, BENCH, 2);

    await sessions.finishSession(session.id);

    expect(await sessions.findActive()).toBeNull();
    const detail = await sessions.getSessionDetail(session.id);
    expect(detail!.finishedAt).not.toBeNull();
    expect(detail!.exercises[0].sets).toHaveLength(2);
    expect(detail!.exercises[0].sets.every((s) => s.completed)).toBe(true);
  });

  it('discardSession cascades to junction rows and sets', async () => {
    const session = await sessions.startSession([MG.chest]);
    await sessions.addExercises(session.id, [BENCH]);
    await sessions.discardSession(session.id);

    expect(await sessions.getSessionDetail(session.id)).toBeNull();
    const orphans = await db.getAllAsync('SELECT id FROM sets');
    const junctions = await db.getAllAsync('SELECT session_id FROM session_muscle_groups');
    expect(orphans).toHaveLength(0);
    expect(junctions).toHaveLength(0);
  });
});

describe('crash-recovery kill matrix', () => {
  it('kill after start, before exercises: full session state is recoverable', async () => {
    const session = await sessions.startSession([MG.back]);
    // "Kill" = drop all in-memory state; only the db survives.
    const recovered = createSessionRepo(db);
    const active = await recovered.findActive();
    expect(active?.id).toBe(session.id);
    expect((await recovered.getSessionDetail(session.id))!.exercises).toHaveLength(0);
  });

  it('kill mid-workout: drafts, edits, and completed sets all survive', async () => {
    const session = await sessions.startSession([MG.chest]);
    await sessions.addExercises(session.id, [BENCH]);
    const detail = await sessions.getSessionDetail(session.id);
    const draft = detail!.exercises[0].sets[0];
    await sets.updateValues(draft.id, 82.5, 8); // debounced keystroke flush
    await sets.setCompleted(draft.id, true);

    const recovered = await createSessionRepo(db).getSessionDetail(session.id);
    const recoveredSets = recovered!.exercises[0].sets;
    expect(recoveredSets[0]).toMatchObject({ weightKg: 82.5, reps: 8, completed: true });
    expect(recoveredSets[0].completedAt).not.toBeNull();
    expect(recoveredSets.slice(1).every((s) => !s.completed)).toBe(true);
  });

  it('editing a set after check-off persists the correction', async () => {
    const session = await sessions.startSession([MG.chest]);
    await sessions.addExercises(session.id, [BENCH]);
    const [setId] = await checkOffSets(session.id, BENCH, 1);

    await sets.updateValues(setId, 90, 5); // was typed as 0x0, corrected after completion

    const detail = await sessions.getSessionDetail(session.id);
    expect(detail!.exercises[0].sets[0]).toMatchObject({
      weightKg: 90,
      reps: 5,
      completed: true,
    });
  });

  it('fresh active session is offered for resume, not auto-closed', async () => {
    const session = await sessions.startSession([MG.chest]);
    const result = await sessions.closeStaleActiveSession();
    expect(result).toMatchObject({ outcome: 'active', session: { id: session.id } });
  });

  it('stale session with completed sets auto-closes at its last activity', async () => {
    const session = await sessions.startSession([MG.chest]);
    await sessions.addExercises(session.id, [BENCH]);
    const detail = await sessions.getSessionDetail(session.id);
    const draft = detail!.exercises[0].sets[0];
    await sets.updateValues(draft.id, 60, 10);
    await sets.setCompleted(draft.id, true);
    await backdate(session.id, 26);

    const result = await sessions.closeStaleActiveSession();
    expect(result.outcome).toBe('closed');
    if (result.outcome === 'closed') {
      expect(result.completedSets).toBe(1);
      const closed = await sessions.getSessionDetail(session.id);
      // Finished at the last completed set's timestamp, not "now" — no 26-hour workouts.
      expect(closed!.finishedAt).toBe(closed!.exercises[0].sets[0].completedAt);
      expect(closed!.exercises[0].sets).toHaveLength(1); // drafts purged
    }
    expect(await sessions.findActive()).toBeNull();
  });

  it('stale session with zero completed sets is deleted', async () => {
    const session = await sessions.startSession([MG.chest]);
    await sessions.addExercises(session.id, [BENCH]);
    await backdate(session.id, 26);

    const result = await sessions.closeStaleActiveSession();
    expect(result.outcome).toBe('deleted');
    expect(await sessions.getSessionDetail(session.id)).toBeNull();
  });

  it('no active session: closeStaleActiveSession is a no-op', async () => {
    expect(await sessions.closeStaleActiveSession()).toEqual({ outcome: 'none' });
  });
});

describe('prefill and repeat', () => {
  async function finishBenchSession(weights: [number, number][]) {
    const session = await sessions.startSession([MG.chest]);
    await sessions.addExercises(session.id, [BENCH]);
    const detail = await sessions.getSessionDetail(session.id);
    const drafts = detail!.exercises[0].sets;
    for (let i = 0; i < weights.length; i++) {
      await sets.updateValues(drafts[i].id, weights[i][0], weights[i][1]);
      await sets.setCompleted(drafts[i].id, true);
    }
    await sessions.finishSession(session.id);
    return session;
  }

  it('drafts prefill from the exercise’s most recent finished session', async () => {
    await finishBenchSession([
      [80, 8],
      [82.5, 6],
      [82.5, 5],
    ]);

    const next = await sessions.startSession([MG.chest]);
    await sessions.addExercises(next.id, [BENCH]);

    const detail = await sessions.getSessionDetail(next.id);
    expect(detail!.exercises[0].sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [80, 8],
      [82.5, 6],
      [82.5, 5],
    ]);
    expect(detail!.exercises[0].sets.every((s) => !s.completed)).toBe(true);
  });

  it('getLastCompletedSets ignores unfinished sessions and unchecked sets', async () => {
    await finishBenchSession([[100, 5]]);
    // A newer, still-active session must not leak into prefill.
    const active = await sessions.startSession([MG.chest]);
    await sessions.addExercises(active.id, [BENCH]);

    const last = await sessions.getLastCompletedSets(BENCH);
    expect(last).toHaveLength(1);
    expect(last[0]).toMatchObject({ weightKg: 100, reps: 5 });
  });

  it('repeatLastSession copies groups and exercise order, prefilled', async () => {
    await finishBenchSession([[60, 10]]);

    const repeated = await sessions.repeatLastSession();
    expect(repeated).not.toBeNull();

    const detail = await sessions.getSessionDetail(repeated!.id);
    expect(detail!.finishedAt).toBeNull();
    expect(detail!.exercises.map((e) => e.exerciseId)).toEqual([BENCH]);
    expect(detail!.exercises[0].sets[0]).toMatchObject({ weightKg: 60, reps: 10 });

    const smg = await db.getAllAsync<{ muscle_group_id: string }>(
      'SELECT muscle_group_id FROM session_muscle_groups WHERE session_id = ?',
      [repeated!.id]
    );
    expect(smg.map((r) => r.muscle_group_id)).toEqual([MG.chest]);
  });

  it('repeatLastSession returns null with no history and throws when one is active', async () => {
    expect(await sessions.repeatLastSession()).toBeNull();
    await finishBenchSession([[60, 10]]);
    await sessions.startSession([MG.back]);
    await expect(sessions.repeatLastSession()).rejects.toThrow(ActiveSessionExistsError);
  });
});

describe('history summaries', () => {
  it('listFinished derives group labels from exercises, not the planned snapshot', async () => {
    // Planned as Chest-only, but a back and a bodyweight exercise were added mid-workout.
    const session = await sessions.startSession([MG.chest]);
    await sessions.addExercises(session.id, [BENCH, PULL_UP]);
    await checkOffSets(session.id, BENCH, 2);
    await checkOffSets(session.id, PULL_UP, 1);
    await sessions.finishSession(session.id);

    const [summary] = await sessions.listFinished();
    expect(summary.exerciseCount).toBe(2);
    expect(summary.completedSetCount).toBe(3);
    expect(summary.muscleGroups).toEqual(['Chest', 'Back']); // derived, in seed order
  });

  it('excludes active sessions', async () => {
    await sessions.startSession([MG.chest]);
    expect(await sessions.listFinished()).toHaveLength(0);
  });
});
