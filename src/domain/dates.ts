import { PLAN_START, PLAN_WEEKS } from './plan';

const DAY = 864e5;

/** Local midnight of the first Monday of the plan: start of week 1. */
export function planStart(): Date {
  return new Date(...PLAN_START);
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

/** Week 1..PLAN_WEEKS of the plan for a timestamp, clamped. */
export function weekOf(at: string | Date): number {
  const t = typeof at === 'string' ? new Date(at) : at;
  const w = Math.floor((t.getTime() - planStart().getTime()) / (7 * DAY)) + 1;
  return Math.min(PLAN_WEEKS, Math.max(1, w));
}

/** Plan week of a YYYY-MM-DD key, read as a local date. */
export function weekOfKey(k: string): number {
  const [y, m, d] = k.split('-').map(Number);
  return weekOf(new Date(y, m - 1, d));
}

export function weekStart(w: number): Date {
  return new Date(PLAN_START[0], PLAN_START[1], PLAN_START[2] + 7 * (w - 1));
}

/** Timeline column for a due date: its plan week, or KICKOFF_COLUMN once past the last week. */
export const KICKOFF_COLUMN = PLAN_WEEKS + 1;
export function timelineColumn(k: string): number {
  const [y, m, d] = k.split('-').map(Number);
  const [sy, sm, sd] = PLAN_START;
  // Whole days via UTC so DST can't shift the result.
  const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(sy, sm, sd)) / DAY);
  return Math.min(KICKOFF_COLUMN, Math.max(1, Math.floor(days / 7) + 1));
}
