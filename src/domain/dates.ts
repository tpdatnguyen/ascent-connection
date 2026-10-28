const DAY = 864e5;

/** Monday, October 26, 2026, local midnight: start of week 1. */
export function planStart(): Date {
  return new Date(2026, 9, 26);
}

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function todayKey(now: Date = new Date()): string {
  return dateKey(now);
}

/** "Oct 27" from an ISO timestamp. */
export function fmtISO(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Oct 27" from a YYYY-MM-DD key, read as a local date. */
export function fmtKey(k: string): string {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Week 1..5 of the plan for a timestamp, clamped. */
export function weekOf(at: string | Date): number {
  const t = typeof at === 'string' ? new Date(at) : at;
  const w = Math.floor((t.getTime() - planStart().getTime()) / (7 * DAY)) + 1;
  return Math.min(5, Math.max(1, w));
}

export function weekStart(w: number): Date {
  return new Date(2026, 9, 26 + 7 * (w - 1));
}
