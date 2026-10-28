import { Fragment, type CSSProperties } from 'react';
import { weekOf, weekStart } from '../domain/dates';
import { firstName, MILESTONES } from '../domain/plan';
import type { DerivedGoal } from '../domain/selectors';
import { Avatar } from './common';

const WEEKS = [1, 2, 3, 4, 5, 6];
/** Which milestone is due in which week. */
const FLAGS: Record<number, number> = { 2: 0, 4: 1, 6: 2 };

export function TimelineView({ goals, pct, now = weekOf(new Date()) }: { goals: DerivedGoal[]; pct: number; now?: number }) {
  const nowCls = (w: number) => (w === now ? ' now' : '');
  // The grid relies on a flat list of 7 cells per row (.tl>div:nth-child(7n)).
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
            const m = FLAGS[w] !== undefined ? MILESTONES[FLAGS[w]] : null;
            const hit = m ? pct >= m.thr : false;
            return (
              <div key={'m' + w} className={'cell' + nowCls(w)}>
                {m ? <span className={'flag' + (hit ? ' hit' : '')}>{m.name}{hit ? ' ✓' : ''}<br />due {m.dueLabel}</span> : null}
                {w === 5 ? <span className="flag gng">Go / No-Go<br />Mon, Nov 30</span> : null}
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
