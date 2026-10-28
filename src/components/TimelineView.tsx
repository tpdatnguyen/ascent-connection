import { Fragment, type CSSProperties } from 'react';
import { weekOf, weekOfKey, weekStart } from '../domain/dates';
import { firstName, MILESTONES, PLAN_WEEKS, REVIEW } from '../domain/plan';
import type { DerivedGoal } from '../domain/selectors';
import { Avatar } from './common';

const WEEKS = Array.from({ length: PLAN_WEEKS }, (_, i) => i + 1);
const REVIEW_WEEK = weekOfKey(REVIEW.due);

export function TimelineView({ goals, pct, now = weekOf(new Date()) }: { goals: DerivedGoal[]; pct: number; now?: number }) {
  const nowCls = (w: number) => (w === now ? ' now' : '');
  // The grid relies on a flat list of 1 + PLAN_WEEKS (7) cells per row (.tl>div:nth-child(7n)).
  return (
    <>
      <div className="scroll-x">
        <div className="tl">
          <div className="th">Team</div>
          {WEEKS.map((w) => (
            <div key={w} className={'th' + nowCls(w)}>Week {w}<small>{weekStart(w).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small></div>
          ))}
          <div className="nm" style={{ color: 'var(--muted)' }}>Milestones</div>
          {WEEKS.map((w) => {
            const ms = MILESTONES.filter((x) => weekOfKey(x.due) === w);
            return (
              <div key={'m' + w} className={'cell' + nowCls(w)}>
                {ms.map((m) => {
                  const hit = pct >= m.thr;
                  return <span key={m.key} className={'flag' + (hit ? ' hit' : '')}>{m.name}{hit ? ' ✓' : ''}<br />due {m.dueLabel}</span>;
                })}
                {w === REVIEW_WEEK ? <span className="flag gng">Launch Readiness Review<br />{REVIEW.dueLabel}</span> : null}
              </div>
            );
          })}
          {goals.map((g) => (
            <Fragment key={g.id}>
              <div className="nm"><Avatar name={g.name} color={g.color} style={{ width: 24, height: 24, fontSize: 10 }} />{firstName(g.name)}</div>
              {WEEKS.map((w) => (
                <div key={w} className={'cell' + nowCls(w)}>
                  {g.steps.filter((s) => s.at && weekOf(s.at) === w).map((s) => <span key={s.id} className="dotp" style={{ '--c': g.color } as CSSProperties} />)}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="hint" style={{ marginTop: 8 }}>Each dot is a step finished that week.</div>
    </>
  );
}
