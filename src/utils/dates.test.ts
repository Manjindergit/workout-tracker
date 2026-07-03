import { elapsedMs, formatLocalDate, nowIso } from './dates';

describe('dates', () => {
  it('nowIso returns sortable ISO-8601 UTC with milliseconds', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('formatLocalDate renders date with weekday', () => {
    // Noon UTC avoids local-timezone day rollover for offsets within ±12h.
    expect(formatLocalDate('2026-07-03T12:00:00.000Z')).toMatch(
      /^2026-07-0[234] \((Thu|Fri|Sat)\)$/
    );
  });

  it('elapsedMs computes differences', () => {
    expect(elapsedMs('2026-07-03T12:00:00.000Z', '2026-07-03T12:01:30.000Z')).toBe(90_000);
  });
});
