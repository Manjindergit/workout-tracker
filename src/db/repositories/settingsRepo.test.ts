import { createMigratedTestDb, type TestDb } from '../testDb';
import { createSettingsRepo } from './settingsRepo';

let db: TestDb;
let settings: ReturnType<typeof createSettingsRepo>;

beforeEach(async () => {
  db = await createMigratedTestDb();
  settings = createSettingsRepo(db);
});

afterEach(() => db.close());

describe('settingsRepo', () => {
  it('returns null for unset keys', async () => {
    expect(await settings.get('unit')).toBeNull();
  });

  it('round-trips and upserts values', async () => {
    await settings.set('unit', 'kg');
    await settings.set('unit', 'lb');
    expect(await settings.get('unit')).toBe('lb');
  });

  it('getAll returns every stored pair', async () => {
    await settings.set('unit', 'kg');
    await settings.set('weightIncrementKg', '2.5');
    expect(await settings.getAll()).toEqual({ unit: 'kg', weightIncrementKg: '2.5' });
  });
});
