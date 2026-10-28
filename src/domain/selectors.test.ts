import { describe, expect, it } from 'vitest';
import { weekOf, weekOfKey } from './dates';
import { defaultPlan, MILESTONES } from './plan';
import { canTick, climberPosition, deriveGoals, milestonesCrossed, milestoneStatus, recentProgress, teamPercent } from './selectors';
import type { Meta } from './types';

/** Default plan with the first `counts[i]` steps of goal i done. */
function planWith(counts: number[], at = '2026-10-27T10:00:00.000Z') {
  const p = defaultPlan();
  p.goals.forEach((g, gi) => {
    for (let s = 1; s <= (counts[gi] ?? 0); s++) p.progress[g.id + 's' + s] = { goal: g.id, at };
  });
  return deriveGoals(p);
}

describe('deriveGoals', () => {
  it('orders goals and steps, counts done, computes percent and last update', () => {
    const p = defaultPlan();
    p.goals.reverse();
    p.steps.reverse();
    p.progress.g2s1 = { goal: 'g2', at: '2026-10-27T09:00:00.000Z' };
    p.progress.g2s2 = { goal: 'g2', at: '2026-10-28T09:00:00.000Z' };
    const g = deriveGoals(p);
    expect(g.map((x) => x.id)).toEqual(['g1', 'g2', 'g3', 'g4']);
    expect(g[1].steps.map((s) => s.id)).toEqual(['g2s1', 'g2s2', 'g2s3', 'g2s4', 'g2s5']);
    expect(g[1].dn).toBe(2);
    expect(g[1].pct).toBe(40);
    expect(g[1].last).toBe('2026-10-28T09:00:00.000Z');
    expect(g[0].last).toBeNull();
    expect(g.map((x) => x.color)).toEqual(['#154230', '#A6824A', '#5D1E21', '#3D3F3E']);
  });
});

describe('canTick (sequential rule)', () => {
  const g = planWith([2])[0];
  it('allows the next step', () => expect(canTick(g, 2)).toBe(true));
  it('allows undoing the most recent step', () => expect(canTick(g, 1)).toBe(true));
  it('locks earlier completed steps', () => expect(canTick(g, 0)).toBe(false));
  it('blocks later steps', () => {
    expect(canTick(g, 3)).toBe(false);
    expect(canTick(g, 4)).toBe(false);
  });
  it('on a fresh goal only step 1 is allowed', () => {
    const f = planWith([0])[0];
    expect([0, 1, 2, 3, 4].map((i) => canTick(f, i))).toEqual([true, false, false, false, false]);
  });
  it('on a finished goal only the last step can be undone', () => {
    const f = planWith([5])[0];
    expect([0, 1, 2, 3, 4].map((i) => canTick(f, i))).toEqual([false, false, false, false, true]);
    expect(canTick(f, 5)).toBe(false);
  });
});

describe('teamPercent', () => {
  it('is 0 with nothing done or no steps', () => {
    expect(teamPercent(planWith([]))).toBe(0);
    expect(teamPercent([])).toBe(0);
  });
  it('rounds the share of all steps', () => {
    expect(teamPercent(planWith([1]))).toBe(5); // 1/20
    expect(teamPercent(planWith([1, 1, 1, 1, 0]))).toBe(20);
    expect(teamPercent(planWith([5, 5, 3]))).toBe(65); // 13/20
    expect(teamPercent(planWith([5, 5, 5, 5]))).toBe(100);
  });
  it('rounds half up and to nearest with uneven step counts', () => {
    const p = defaultPlan();
    p.steps = p.steps.filter((s) => s.goal === 'g1').slice(0, 3); // 3 steps total
    p.progress.g1s1 = { goal: 'g1', at: '2026-10-27T00:00:00.000Z' };
    expect(teamPercent(deriveGoals(p))).toBe(33); // 33.33
    p.progress.g1s2 = { goal: 'g1', at: '2026-10-27T00:00:00.000Z' };
    expect(teamPercent(deriveGoals(p))).toBe(67); // 66.67
  });
  it('can include one pending tick', () => {
    expect(teamPercent(planWith([1]), 'g1')).toBe(10);
  });
  it('equals the average of personal percents with 5 steps each', () => {
    const gs = planWith([1, 2, 3, 4]);
    expect(teamPercent(gs)).toBe(gs.reduce((a, g) => a + g.pct, 0) / 4);
  });
});

describe('milestonesCrossed', () => {
  it('fires exactly at 30, 65 and 100', () => {
    expect(milestonesCrossed(planWith([2, 2, 1, 0]), 'g4', {}).map((m) => m.key)).toEqual(['m1']); // 6/20 = 30
    expect(milestonesCrossed(planWith([5, 5, 2, 0]), 'g4', { m1: '2026-11-01' }).map((m) => m.key)).toEqual(['m2']); // 13/20 = 65
    expect(milestonesCrossed(planWith([5, 5, 5, 4]), 'g4', { m1: 'x', m2: 'x' }).map((m) => m.key)).toEqual(['m3']); // 20/20
  });
  it('does not fire just below a threshold', () => {
    expect(milestonesCrossed(planWith([2, 2, 0, 0]), 'g4', {})).toEqual([]); // 5/20 = 25
    expect(milestonesCrossed(planWith([5, 5, 1, 0]), 'g4', { m1: 'x' })).toEqual([]); // 12/20 = 60
  });
  it('skips milestones already reached and returns every newly crossed one', () => {
    expect(milestonesCrossed(planWith([5, 5, 2, 0]), 'g4', {}).map((m) => m.key)).toEqual(['m1', 'm2']);
    expect(milestonesCrossed(planWith([5, 5, 2, 0]), 'g4', { m1: 'x', m2: 'x' })).toEqual([]);
  });
});

describe('milestoneStatus', () => {
  const [m1, m2, m3] = MILESTONES;
  const meta = (reached: Meta['reached'] = {}, celebrated: Meta['celebrated'] = {}): Meta => ({ reached, celebrated });

  it('labels early / on time / late from the first reached date', () => {
    expect(milestoneStatus(m1, 30, meta({ m1: '2026-11-08' }), '2026-11-08')).toMatchObject({ kind: 'reached', timing: 'early' });
    expect(milestoneStatus(m1, 30, meta({ m1: '2026-11-09' }), '2026-11-09')).toMatchObject({ kind: 'reached', timing: 'on time' });
    expect(milestoneStatus(m1, 30, meta({ m1: '2026-11-10' }), '2026-11-10')).toMatchObject({ kind: 'reached', timing: 'late' });
    expect(milestoneStatus(m3, 100, meta({ m3: '2026-11-30' }), '2026-11-30')).toMatchObject({ timing: 'on time' });
  });
  it('has no timing label when no reached date is stored', () => {
    expect(milestoneStatus(m2, 70, meta(), '2026-11-01')).toEqual({ kind: 'reached', timing: null, celebratedOn: null });
  });
  it('reports the celebration date', () => {
    expect(milestoneStatus(m1, 40, meta({ m1: '2026-11-02' }, { m1: '2026-11-04' }), '2026-11-05')).toEqual({ kind: 'reached', timing: 'early', celebratedOn: '2026-11-04' });
  });
  it('is Behind only after the due date and while not reached', () => {
    expect(milestoneStatus(m1, 25, meta(), '2026-11-09')).toEqual({ kind: 'not-yet' });
    expect(milestoneStatus(m1, 25, meta(), '2026-11-10')).toEqual({ kind: 'behind' });
    expect(milestoneStatus(m1, 30, meta(), '2026-11-10').kind).toBe('reached');
  });
  it('follows current percent, so un-ticking below a reached milestone shows Not yet / Behind again', () => {
    expect(milestoneStatus(m2, 60, meta({ m2: '2026-11-13' }), '2026-11-14')).toEqual({ kind: 'not-yet' });
    expect(milestoneStatus(m2, 60, meta({ m2: '2026-11-13' }), '2026-11-17')).toEqual({ kind: 'behind' });
  });
});

describe('weekOf', () => {
  const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
  it('clamps dates before the start to week 1', () => {
    expect(weekOf(local(2026, 10, 18))).toBe(1);
    expect(weekOf(local(2026, 10, 18, 23, 59))).toBe(1);
    expect(weekOf(local(2026, 1, 1))).toBe(1);
  });
  it('starts week 1 at local midnight Mon Oct 19', () => {
    expect(weekOf(local(2026, 10, 19))).toBe(1);
    expect(weekOf(local(2026, 10, 19, 12))).toBe(1);
    expect(weekOf(local(2026, 10, 25))).toBe(1);
    expect(weekOf(local(2026, 10, 25, 23, 59))).toBe(1);
  });
  it('rolls over each Monday', () => {
    expect(weekOf(local(2026, 10, 26))).toBe(2);
    expect(weekOf(local(2026, 10, 28))).toBe(2);
    expect(weekOf(local(2026, 11, 2))).toBe(3);
    expect(weekOf(local(2026, 11, 9))).toBe(4);
    expect(weekOf(local(2026, 11, 16))).toBe(5);
    expect(weekOf(local(2026, 11, 23))).toBe(6);
  });
  it('clamps Kickoff Day and later to week 6', () => {
    expect(weekOf(local(2026, 11, 29, 23, 59))).toBe(6);
    expect(weekOf(local(2026, 11, 30))).toBe(6);
    expect(weekOf(local(2026, 12, 1))).toBe(6);
    expect(weekOf(local(2027, 3, 1))).toBe(6);
  });
  it('accepts Date objects', () => {
    expect(weekOf(new Date(2026, 10, 3))).toBe(3);
  });
  it('places milestones and the review by date', () => {
    expect(weekOfKey('2026-11-09')).toBe(4);
    expect(weekOfKey('2026-11-16')).toBe(5);
    expect(weekOfKey('2026-11-23')).toBe(6);
    expect(weekOfKey('2026-11-30')).toBe(6);
  });
});

describe('recentProgress and climber', () => {
  it('returns the latest 6 finished steps, newest first', () => {
    const p = defaultPlan();
    for (let i = 1; i <= 5; i++) p.progress['g1s' + i] = { goal: 'g1', at: `2026-10-2${i + 3}T00:00:00.000Z` };
    for (let i = 1; i <= 3; i++) p.progress['g2s' + i] = { goal: 'g2', at: `2026-11-0${i}T00:00:00.000Z` };
    const feed = recentProgress(deriveGoals(p));
    expect(feed).toHaveLength(6);
    expect(feed[0]).toMatchObject({ name: 'Irfan', t: 'Tested on several phones' });
    expect(feed[5].at).toBe('2026-10-26T00:00:00.000Z');
  });
  it('places the climber on the milestone nodes', () => {
    expect(climberPosition(0)).toMatchObject({ cx: 70, cy: 262 });
    expect(climberPosition(30)).toMatchObject({ cx: 225, cy: 222 });
    expect(climberPosition(65)).toMatchObject({ cx: 350, cy: 150 });
    expect(climberPosition(100)).toMatchObject({ cx: 470, cy: 48 });
    expect(climberPosition(15).cx).toBeCloseTo(147.5);
  });
});
