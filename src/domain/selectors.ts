import { weekOf } from './dates';
import { COLORS, MILESTONES, PLAN_WEEKS } from './plan';
import type { Meta, Milestone, MilestoneKey, PlanState } from './types';

export interface DerivedStep {
  id: string;
  t: string;
  done: boolean;
  at: string | null;
}

export interface DerivedGoal {
  id: string;
  name: string;
  goal: string;
  meaning: string;
  color: string;
  steps: DerivedStep[];
  /** number of steps done */
  dn: number;
  /** ISO timestamp of the latest finished step */
  last: string | null;
  pct: number;
}

/** Goals in order with their steps, done count, percent and last update. Never stored. */
export function deriveGoals(s: Pick<PlanState, 'goals' | 'steps' | 'progress'>): DerivedGoal[] {
  return s.goals
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((g, gi) => {
      const steps = s.steps
        .filter((st) => st.goal === g.id)
        .sort((a, b) => a.order - b.order)
        .map((st) => ({ id: st.id, t: st.t, done: !!s.progress[st.id], at: s.progress[st.id]?.at || null }));
      const dn = steps.filter((st) => st.done).length;
      const last = steps.filter((st) => st.at).map((st) => st.at as string).sort().pop() || null;
      return {
        id: g.id,
        name: g.name,
        goal: g.goal,
        meaning: g.meaning,
        color: COLORS[gi % COLORS.length],
        steps,
        dn,
        last,
        pct: steps.length ? Math.round((dn / steps.length) * 100) : 0,
      };
    });
}

/** Share of all steps done, rounded to a whole percent. */
export function teamPercent(goals: DerivedGoal[], extraDoneFor?: string): number {
  let d = 0;
  let t = 0;
  goals.forEach((g) => {
    d += g.dn + (g.id === extraDoneFor ? 1 : 0);
    t += g.steps.length;
  });
  return t ? Math.round((d / t) * 100) : 0;
}

/** Steps go in order: only the next step can be ticked, and only the last done step can be unticked. */
export function canTick(goal: Pick<DerivedGoal, 'dn' | 'steps'>, index: number): boolean {
  if (index < 0 || index >= goal.steps.length) return false;
  return index === goal.dn || index === goal.dn - 1;
}

/** Milestones newly crossed if the next step of `goalId` is ticked now. */
export function milestonesCrossed(goals: DerivedGoal[], goalId: string, reached: Meta['reached']): Milestone[] {
  const np = teamPercent(goals, goalId);
  return MILESTONES.filter((m) => np >= m.thr && !reached[m.key]);
}

export function reachedPatch(hits: Milestone[], today: string): Record<string, string> {
  const patch: Partial<Record<MilestoneKey, string>> = {};
  hits.forEach((m) => (patch[m.key] = today));
  return patch;
}

export function nextMilestone(pct: number): Milestone | undefined {
  return MILESTONES.find((m) => pct < m.thr);
}

export type Timing = 'early' | 'on time' | 'late';

export type MilestoneStatus =
  | { kind: 'reached'; timing: Timing | null; celebratedOn: string | null }
  | { kind: 'behind' }
  | { kind: 'not-yet' };

/** Status of one milestone given team percent, stored meta and today's YYYY-MM-DD. */
export function milestoneStatus(m: Milestone, pct: number, meta: Meta, today: string): MilestoneStatus {
  if (pct >= m.thr) {
    const rAt = meta.reached?.[m.key];
    const timing: Timing | null = rAt ? (rAt < m.due ? 'early' : rAt === m.due ? 'on time' : 'late') : null;
    return { kind: 'reached', timing, celebratedOn: meta.celebrated?.[m.key] ?? null };
  }
  if (today > m.due) return { kind: 'behind' };
  return { kind: 'not-yet' };
}

export interface FeedItem {
  at: string;
  name: string;
  t: string;
  c: string;
}

/** Latest finished steps across the team, newest first. */
export function recentProgress(goals: DerivedGoal[], limit = 6): FeedItem[] {
  const items: FeedItem[] = [];
  goals.forEach((g) => g.steps.forEach((s) => { if (s.at) items.push({ at: s.at, name: g.name.split(' ')[0], t: s.t, c: g.color }); }));
  items.sort((a, b) => b.at.localeCompare(a.at));
  return items.slice(0, limit);
}

/** Climber position on The Climb SVG: interpolated between base camp and the three milestone nodes. */
export const CLIMB_POINTS: [number, number][] = [[70, 262], [225, 222], [350, 150], [470, 48]];
const CLIMB_MARKS = [0, 30, 65, 100];

export function climberPosition(v: number): { i0: number; cx: number; cy: number } {
  let i0 = 2;
  for (let i = 0; i < 3; i++) { if (v <= CLIMB_MARKS[i + 1]) { i0 = i; break; } }
  const ff = Math.min(1, Math.max(0, (v - CLIMB_MARKS[i0]) / (CLIMB_MARKS[i0 + 1] - CLIMB_MARKS[i0])));
  const p = CLIMB_POINTS;
  return { i0, cx: p[i0][0] + (p[i0 + 1][0] - p[i0][0]) * ff, cy: p[i0][1] + (p[i0 + 1][1] - p[i0][1]) * ff };
}

export function climbNodeReached(i: number, v: number): boolean {
  return i === 0 || v >= CLIMB_MARKS[i];
}

/** Finished-step dots per plan week for one person; index 0 is week 1. */
export function stepDotsByWeek(g: DerivedGoal): number[] {
  const dots = new Array<number>(PLAN_WEEKS).fill(0);
  for (const s of g.steps) if (s.at) dots[weekOf(s.at) - 1]++;
  return dots;
}
