import type { HistorySetRow } from '../../db/repositories/statsRepo';
import type { SessionDetail } from '../../types/domain';
import { formatLocalDate } from '../dates';
import { epley1Rm } from '../oneRepMax';

/**
 * Compact Markdown for pasting into an LLM. Deliberately different from the JSON
 * backup: no UUIDs, no timestamps-per-row, no junction tables — a year of history
 * must stay in the tens of thousands of tokens, not hundreds.
 * Always kg (the storage unit) with an explicit legend so models never guess lb.
 */

export const MARKDOWN_LEGEND =
  'Units: kg. Format: one line per exercise — weight×reps per completed set. ' +
  'BW = bodyweight; BW+Nkg = bodyweight plus added load.';

function formatSet(weightKg: number, reps: number, isBodyweight: boolean): string {
  if (isBodyweight) {
    return weightKg > 0 ? `BW+${weightKg}kg×${reps}` : `BW×${reps}`;
  }
  return `${weightKg}kg×${reps}`;
}

/** One `## date — groups` block per session, oldest first. */
export function serializeSessionsMarkdown(details: SessionDetail[]): string {
  const blocks = details
    .slice()
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((session) => {
      const groups = [...new Set(session.exercises.map((e) => e.muscleGroupName))];
      const lines = session.exercises
        .map((exercise) => {
          const sets = exercise.sets.filter((s) => s.completed);
          if (sets.length === 0) return null;
          const rendered = sets
            .map((s) => formatSet(s.weightKg, s.reps, exercise.isBodyweight))
            .join(', ');
          return `- ${exercise.exerciseName} (${exercise.muscleGroupName}): ${rendered}`;
        })
        .filter(Boolean);
      if (lines.length === 0) return null;
      const heading = `## ${formatLocalDate(session.startedAt)}${groups.length ? ` — ${groups.join(', ')}` : ''}`;
      return [heading, ...lines].join('\n');
    })
    .filter(Boolean);

  return [MARKDOWN_LEGEND, '', ...blocks.flatMap((b) => [b as string, ''])].join('\n').trimEnd();
}

/**
 * Full history of one lift, one line per session with the app's own e1RM appended so
 * the LLM doesn't re-derive it with a different formula and contradict the chart.
 */
export function serializeExerciseHistoryMarkdown(
  exerciseName: string,
  isBodyweight: boolean,
  history: HistorySetRow[]
): string {
  const bySession = new Map<string, HistorySetRow[]>();
  for (const row of history) {
    const list = bySession.get(row.sessionId) ?? [];
    list.push(row);
    bySession.set(row.sessionId, list);
  }

  const lines = [...bySession.values()].map((rows) => {
    const sets = rows.map((r) => formatSet(r.weightKg, r.reps, isBodyweight)).join(', ');
    if (isBodyweight) {
      const bestReps = Math.max(...rows.map((r) => r.reps));
      return `- ${formatLocalDate(rows[0].startedAt)}: ${sets} | best reps ${bestReps}`;
    }
    const best = rows.reduce<number | null>((max, r) => {
      const e = epley1Rm(r.weightKg, r.reps);
      return e !== null && (max === null || e > max) ? e : max;
    }, null);
    const suffix = best !== null ? ` | best e1RM ${Math.round(best * 10) / 10}kg` : '';
    return `- ${formatLocalDate(rows[0].startedAt)}: ${sets}${suffix}`;
  });

  return [
    MARKDOWN_LEGEND,
    '',
    `## ${exerciseName} — full history (${bySession.size} sessions)`,
    ...lines,
  ].join('\n');
}
