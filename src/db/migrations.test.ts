import { migrateDb, SCHEMA_VERSION } from './migrations';
import { m002Seed } from './migrations/002_seed';
import { createMigratedTestDb, createTestDb } from './testDb';

describe('migrations', () => {
  it('migrates a fresh db to the latest schema version', async () => {
    const db = await createMigratedTestDb();
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(SCHEMA_VERSION);
    db.close();
  });

  it('is a no-op when re-run', async () => {
    const db = await createMigratedTestDb();
    await expect(migrateDb(db)).resolves.toBeUndefined();
    const groups = await db.getAllAsync('SELECT id FROM muscle_groups');
    expect(groups).toHaveLength(8);
    db.close();
  });

  it('seeds 8 muscle groups and 39 exercises with fixed ids', async () => {
    const db = await createMigratedTestDb();
    const groups = await db.getAllAsync<{ id: string; is_custom: number }>(
      'SELECT id, is_custom FROM muscle_groups'
    );
    const exercises = await db.getAllAsync<{ id: string }>('SELECT id FROM exercises');
    expect(groups).toHaveLength(8);
    expect(exercises).toHaveLength(39);
    expect(groups.every((g) => g.is_custom === 0)).toBe(true);
    expect(groups.map((g) => g.id)).toContain('00000000-0000-4000-8000-000000000001');
    db.close();
  });

  it('seed statements are idempotent (INSERT OR IGNORE)', async () => {
    const db = await createMigratedTestDb();
    for (const statement of m002Seed.statements) {
      await db.execAsync(statement);
    }
    const exercises = await db.getAllAsync('SELECT id FROM exercises');
    expect(exercises).toHaveLength(39);
    db.close();
  });

  it('enforces foreign keys — orphan sets are rejected', async () => {
    const db = await createMigratedTestDb();
    await expect(
      db.runAsync(
        `INSERT INTO sets (id, session_exercise_id, position, created_at, updated_at)
         VALUES ('x', 'no-such-se', 1, 't', 't')`
      )
    ).rejects.toThrow(/FOREIGN KEY/i);
    db.close();
  });

  it('rolls back a failing migration atomically', async () => {
    const db = createTestDb();
    await expect(
      db.withTransactionAsync(async () => {
        await db.execAsync('CREATE TABLE will_roll_back (id TEXT)');
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    await expect(db.getAllAsync('SELECT * FROM will_roll_back')).rejects.toThrow();
    db.close();
  });
});
