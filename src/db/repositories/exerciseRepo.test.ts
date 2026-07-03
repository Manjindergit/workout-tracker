import { MG } from '../migrations/002_seed';
import { createMigratedTestDb, type TestDb } from '../testDb';
import { createExerciseRepo, DuplicateExerciseNameError } from './exerciseRepo';

let db: TestDb;
let exercises: ReturnType<typeof createExerciseRepo>;

beforeEach(async () => {
  db = await createMigratedTestDb();
  exercises = createExerciseRepo(db);
});

afterEach(() => db.close());

describe('exerciseRepo', () => {
  it('creates a custom exercise visible in the picker list', async () => {
    const created = await exercises.createCustom('Cable Fly', MG.chest, false);
    expect(created.isCustom).toBe(true);

    const list = await exercises.listActiveWithGroup();
    const found = list.find((e) => e.id === created.id);
    expect(found).toMatchObject({ name: 'Cable Fly', muscleGroupName: 'Chest' });
  });

  it('rejects duplicate names case-insensitively', async () => {
    await exercises.createCustom('Cable Fly', MG.chest, false);
    await expect(exercises.createCustom('  cable fly ', MG.chest, false)).rejects.toThrow(
      DuplicateExerciseNameError
    );
    // Seeded names are protected too.
    await expect(exercises.createCustom('bench press', MG.chest, false)).rejects.toThrow(
      DuplicateExerciseNameError
    );
  });

  it('soft delete hides from the picker but keeps the row resolvable for history', async () => {
    const created = await exercises.createCustom('Cable Fly', MG.chest, false);
    await exercises.softDelete(created.id);

    const list = await exercises.listActiveWithGroup();
    expect(list.find((e) => e.id === created.id)).toBeUndefined();

    const byId = await exercises.getById(created.id);
    expect(byId?.name).toBe('Cable Fly');
    expect(byId?.deletedAt).not.toBeNull();
  });

  it('a soft-deleted name can be reused (partial unique index)', async () => {
    const first = await exercises.createCustom('Cable Fly', MG.chest, false);
    await exercises.softDelete(first.id);
    await expect(exercises.createCustom('Cable Fly', MG.chest, false)).resolves.toMatchObject({
      name: 'Cable Fly',
    });
  });
});
