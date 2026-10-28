import { Fragment, type CSSProperties } from 'react';
import { KICKOFF_COLUMN, timelineColumn, weekOf, weekStart } from '../domain/dates';
import { firstName, MILESTONES, PLAN_WEEKS, REVIEW } from '../domain/plan';
import { stepDotsByWeek, type DerivedGoal } from '../domain/selectors';
import { Avatar } from './common';

const WEEKS = Array.from({ length: PLAN_WEEKS }, (_, i) => i + 1);
const COLUMNS = [...WEEKS, KICKOFF_COLUMN];
const REVIEW_COLUMN = timelineColumn(REVIEW.due);
const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function TimelineView({ goals, pct, now = weekOf(new Date()) }: { goals: DerivedGoal[]; pct: number; now?: number }) {
  const nowCls = (w: number) => (w === now ? ' now' : '');
  // The grid relies on a flat list of 1 + PLAN_WEEKS + 1 (8) cells per row (.tl>div:nth-child(8n)).
  return (
    <>
      <div className="scroll-x">
        <div className="tl">
          <div className="th">Team</div>
          {COLUMNS.map((c) => c === KICKOFF_COLUMN ? (
            <div key={c} className="th kick">Kickoff Day<small>{shortDate(weekStart(c))}</small></div>
          ) : (
            <div key={c} className={'th' + nowCls(c)}>Week {c}<small>{shortDate(weekStart(c))}</small></div>
          ))}
          <div className="nm" style={{ color: 'var(--muted)' }}>Milestones</div>
          {COLUMNS.map((c) => {
            const ms = MILESTONES.filter((x) => timelineColumn(x.due) === c);
            return (
              <div key={'m' + c} className={'cell' + nowCls(c)}>
                {ms.map((m) => {
                  const hit = pct >= m.thr;
                  return <span key={m.key} className={'flag' + (hit ? ' hit' : '')}>{c === KICKOFF_COLUMN ? '⚑ ' : ''}{m.name}{hit ? ' ✓' : ''}<br />due {m.dueLabel}</span>;
                })}
                {c === REVIEW_COLUMN ? <span className="flag gng">Launch Readiness Review<br />{REVIEW.dueLabel}</span> : null}
              </div>
            );
          })}
          {goals.map((g) => {
            const dots = stepDotsByWeek(g);
            return (
              <Fragment key={g.id}>
                <div className="nm"><Avatar name={g.name} color={g.color} style={{ width: 24, height: 24, fontSize: 10 }} />{firstName(g.name)}</div>
                {COLUMNS.map((c) => (
                  <div key={c} className={'cell' + nowCls(c)}>
                    {Array.from({ length: dots[c - 1] ?? 0 }, (_, i) => <span key={i} className="dotp" style={{ '--c': g.color } as CSSProperties} />)}
                  </div>
                ))}
              </Fragment>
            );
          })}
        </div>
      </div>
      <div className="hint" style={{ marginTop: 8 }}>Each dot is a step finished that week.</div>
    </>
  );
}
