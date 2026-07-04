import { MG, seedExerciseId } from '../../db/migrations/002_seed';
import { createSessionRepo } from '../../db/repositories/sessionRepo';
import { createSetRepo } from '../../db/repositories/setRepo';
import { createMigratedTestDb, type TestDb } from '../../db/testDb';
import { BackupError, createBackup, parseBackup, restoreBackup } from './backup';

const BENCH = seedExerciseId('01');

async function seedWorkout(db: TestDb) {
  const sessions = createSessionRepo(db);
  const sets = createSetRepo(db);
  const session = await sessions.startSession([MG.chest]);
  await sessions.addExercises(session.id, [BENCH]);
  const detail = await sessions.getSessionDetail(session.id);
  const draft = detail!.exercises[0].sets[0];
  await sets.updateValues(draft.id, 100, 5);
  await sets.setCompleted(draft.id, true);
  await sessions.finishSession(session.id);
  return session.id;
}

describe('backup/restore', () => {
  let source: TestDb;
  let target: TestDb;

  beforeEach(async () => {
    source = await createMigratedTestDb();
    target = await createMigratedTestDb();
  });

  afterEach(() => {
    source.close();
    target.close();
  });

  it('round-trips through JSON into a fresh install losslessly', async () => {
    const sessionId = await seedWorkout(source);

    const backup = parseBackup(JSON.stringify(await createBackup(source)));
    const inserted = await restoreBackup(target, backup);
    expect(inserted).toBeGreaterThan(0);

    const restored = await createSessionRepo(target).getSessionDetail(sessionId);
    expect(restored).not.toBeNull();
    expect(restored!.finishedAt).not.toBeNull();
    expect(restored!.exercises[0].sets[0]).toMatchObject({
      weightKg: 100,
      reps: 5,
      completed: true,
    });
  });

  it('re-restoring the same backup inserts nothing (idempotent merge)', async () => {
    await seedWorkout(source);
    const backup = parseBackup(JSON.stringify(await createBackup(source)));

    await restoreBackup(target, backup);
    const secondRun = await restoreBackup(target, backup);
    expect(secondRun).toBe(0);
  });

  it('restoring into a db that already has its own data merges without clobbering', async () => {
    await seedWorkout(source);
    const targetSessionId = await seedWorkout(target);

    const backup = parseBackup(JSON.stringify(await createBackup(source)));
    await restoreBackup(target, backup);

    const summaries = await createSessionRepo(target).listFinished();
    expect(summaries).toHaveLength(2);
    expect(summaries.some((s) => s.id === targetSessionId)).toBe(true);
  });

  it('refuses newer-app backups, older backups, and non-backup files', async () => {
    const backup = await createBackup(source);

    expect(() => parseBackup(JSON.stringify({ ...backup, schemaVersion: 99 }))).toThrow(
      /newer version/
    );
    expect(() => parseBackup(JSON.stringify({ ...backup, schemaVersion: 1 }))).toThrow(
      /older version/
    );
    expect(() => parseBackup('{"hello":"world"}')).toThrow(BackupError);
    expect(() => parseBackup('not json at all')).toThrow(/not valid JSON/);
  });
});
