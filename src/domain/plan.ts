import type { Goal, Milestone, PlanState, Step } from './types';

/** First Monday of the plan as [year, monthIndex, day], local time. */
export const PLAN_START = [2026, 9, 19] as const;
export const PLAN_WEEKS = 6;

/** Launch Readiness Review, shown on the timeline. */
export const REVIEW = { due: '2026-11-23', dueLabel: 'Mon, Nov 23' };

export const MILESTONES: Milestone[] = [
  { key: 'm1', name: 'Foundation', thr: 30, due: '2026-11-02', dueLabel: 'Mon, Nov 2', reward: 'Team Treat' },
  { key: 'm2', name: 'Built', thr: 65, due: '2026-11-16', dueLabel: 'Mon, Nov 16', reward: 'Team Lunch' },
  { key: 'm3', name: 'Kickoff-ready', thr: 100, due: '2026-11-30', dueLabel: 'Mon, Nov 30', reward: 'Mini golf' },
];

export const COLORS = ['#154230', '#A6824A', '#5D1E21', '#3D3F3E', '#4F7A64', '#8C6A3A'];

const DEF = [
  { id: 'g1', name: 'Danny Nguyen', goal: 'Spread the Word', meaning: 'People in Springfield know about the kickoff', steps: ['Message guide for Springfield is written', 'Launch posts and videos are made', 'Feedback form for early users is ready', 'Content is scheduled', 'Everything is ready to post on Kickoff Day'] },
  { id: 'g2', name: 'Irfan Pasha', goal: 'A Smooth First Step', meaning: 'A new person can sign up and get started', steps: ['Sign-up works with no blocking bugs', 'Onboarding screens are clear', 'Tested on several phones', 'Early feedback fixes are done', 'App is stable for launch'] },
  { id: 'g3', name: 'Kevin Parker', goal: 'Open the Doors', meaning: 'The app is live and we can see what happens', steps: ['Tracking of sign-ups works', 'App Store listing is ready', 'Google Play listing is ready', 'Website matches the app', 'Launch-day monitoring is set up'] },
  { id: 'g4', name: 'Logan Taylor', goal: 'The Kickoff Playbook', meaning: 'The kickoff plan is final and partners are ready', steps: ['Kickoff plan outline is written', 'Springfield partner list is ready', 'Partners have been contacted', 'Kickoff-day schedule is final', 'Team has rehearsed the kickoff'] },
];

export type PlanData = Pick<PlanState, 'goals' | 'steps' | 'progress' | 'meta'>;

/** Placeholder `by` on seeded ticks; stores that need a real uid replace it. */
export const SEED_BY = 'seed';
/** Seeded first-step ticks fall this many days after the plan start (Wed..Sat of week 1), at noon local. */
const SEED_DAY_OFFSETS = [2, 3, 4, 5];

/** The default plan used to seed an empty store: each person's first step is already done in week 1. */
export function defaultPlan(start: readonly [number, number, number] = PLAN_START): PlanData {
  const goals: Goal[] = [];
  const steps: Step[] = [];
  DEF.forEach((d, gi) => {
    goals.push({ id: d.id, order: gi + 1, name: d.name, goal: d.goal, meaning: d.meaning });
    d.steps.forEach((t, i) => steps.push({ id: d.id + 's' + (i + 1), goal: d.id, order: i + 1, t }));
  });
  const progress: PlanData['progress'] = {};
  goals.forEach((g, gi) => {
    const at = new Date(start[0], start[1], start[2] + SEED_DAY_OFFSETS[gi % SEED_DAY_OFFSETS.length], 12).toISOString();
    progress[g.id + 's1'] = { goal: g.id, at, by: SEED_BY };
  });
  return { goals, steps, progress, meta: { reached: {}, celebrated: {} } };
}

export function initials(name: string): string {
  return String(name).split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
}

export function firstName(name: string): string {
  return name.split(' ')[0];
}
