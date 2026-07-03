const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Current instant as ISO-8601 UTC with milliseconds — the storage format for all timestamps. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Render a stored ISO timestamp as a local date with weekday, e.g. "2026-07-03 (Fri)". */
export function formatLocalDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day} (${WEEKDAYS[d.getDay()]})`;
}

/** Render a stored ISO timestamp as a local time, e.g. "14:32". */
export function formatLocalTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Milliseconds elapsed between two ISO timestamps (b - a). */
export function elapsedMs(a: string, b: string): number {
  return new Date(b).getTime() - new Date(a).getTime();
}
