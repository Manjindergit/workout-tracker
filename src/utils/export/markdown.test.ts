import type { SessionDetail } from '../../types/domain';
import {
  MARKDOWN_LEGEND,
  serializeExerciseHistoryMarkdown,
  serializeSessionsMarkdown,
} from './markdown';

const T = '2026-07-01T12:00:00.000Z'; // midday UTC keeps the local date stable across timezones

function makeSet(id: string, weightKg: number, reps: number, completed: boolean) {
  return {
    id,
    sessionExerciseId: 'se1',
    position: Number(id.slice(-1)),
    weightKg,
    reps,
    completed,
    completedAt: completed ? T : null,
    createdAt: T,
    updatedAt: T,
  };
}

const session: SessionDetail = {
  id: 's1',
  startedAt: T,
  finishedAt: '2026-07-01T13:00:00.000Z',
  notes: null,
  createdAt: T,
  updatedAt: T,
  exercises: [
    {
      id: 'se1',
      sessionId: 's1',
      exerciseId: 'e1',
      position: 1,
      createdAt: T,
      updatedAt: T,
      exerciseName: 'Bench Press',
      muscleGroupName: 'Chest',
      isBodyweight: false,
      sets: [
        makeSet('st1', 80, 8, true),
        makeSet('st2', 82.5, 6, true),
        makeSet('st3', 85, 4, false), // draft — must never appear
      ],
    },
    {
      id: 'se2',
      sessionId: 's1',
      exerciseId: 'e2',
      position: 2,
      createdAt: T,
      updatedAt: T,
      exerciseName: 'Pull-Up',
      muscleGroupName: 'Back',
      isBodyweight: true,
      sets: [makeSet('st4', 0, 10, true), makeSet('st5', 10, 6, true)],
    },
  ],
};

describe('serializeSessionsMarkdown', () => {
  const output = serializeSessionsMarkdown([session]);

  it('starts with the format legend', () => {
    expect(output.startsWith(MARKDOWN_LEGEND)).toBe(true);
  });

  it('renders one heading per session with derived groups', () => {
    expect(output).toMatch(/## 2026-07-01 \(\w{3}\) — Chest, Back/);
  });

  it('renders weighted and bodyweight sets compactly, kg-labeled', () => {
    expect(output).toContain('- Bench Press (Chest): 80kg×8, 82.5kg×6');
    expect(output).toContain('- Pull-Up (Back): BW×10, BW+10kg×6');
  });

  it('never leaks uncompleted sets, UUIDs, or ISO timestamps', () => {
    expect(output).not.toContain('85kg×4');
    expect(output).not.toContain('s1');
    expect(output).not.toContain('T12:00');
  });

  it('orders multiple sessions oldest-first', () => {
    const older: SessionDetail = { ...session, id: 's0', startedAt: '2026-06-24T12:00:00.000Z' };
    const both = serializeSessionsMarkdown([session, older]);
    expect(both.indexOf('2026-06-24')).toBeLessThan(both.indexOf('2026-07-01'));
  });
});

describe('serializeExerciseHistoryMarkdown', () => {
  it('groups by session and appends the app’s own e1RM', () => {
    const output = serializeExerciseHistoryMarkdown('Bench Press', false, [
      { sessionId: 's1', startedAt: T, weightKg: 100, reps: 5, position: 1 },
      { sessionId: 's1', startedAt: T, weightKg: 80, reps: 10, position: 2 },
    ]);
    expect(output).toContain('## Bench Press — full history (1 sessions)');
    // best of e1RM(100,5)=116.7 and e1RM(80,10)=106.7
    expect(output).toMatch(/100kg×5, 80kg×10 \| best e1RM 116\.7kg/);
  });

  it('uses best reps for bodyweight lifts', () => {
    const output = serializeExerciseHistoryMarkdown('Pull-Up', true, [
      { sessionId: 's1', startedAt: T, weightKg: 0, reps: 8, position: 1 },
      { sessionId: 's1', startedAt: T, weightKg: 0, reps: 11, position: 2 },
    ]);
    expect(output).toContain('BW×8, BW×11 | best reps 11');
  });
});
