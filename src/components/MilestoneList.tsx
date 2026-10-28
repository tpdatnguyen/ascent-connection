import { fmtKey, todayKey } from '../domain/dates';
import { MILESTONES } from '../domain/plan';
import { milestoneStatus } from '../domain/selectors';
import type { Meta } from '../domain/types';

export function MilestoneList({ pct, meta, canProgress, onCelebrate, today = todayKey() }: {
  pct: number;
  meta: Meta;
  canProgress: boolean;
  onCelebrate: (key: string) => void;
  today?: string;
}) {
  return (
    <>
      {MILESTONES.map((m) => {
        const st = milestoneStatus(m, pct, meta, today);
        let pill;
        let extra = null;
        if (st.kind === 'reached') {
          pill = <span className="pill ok">Reached</span>;
          const timing = st.timing ? ' · reached ' + st.timing : '';
          extra = st.celebratedOn
            ? <small>Celebrated {fmtKey(st.celebratedOn)}{timing}</small>
            : (
              <div className="celebrate">
                <span>Time to celebrate: <b>{m.reward}</b>{timing}</span>
                {canProgress ? <button type="button" className="btn sm" onClick={() => onCelebrate(m.key)}>We celebrated</button> : null}
              </div>
            );
        } else if (st.kind === 'behind') {
          pill = <span className="pill m3">Behind</span>;
          extra = <small>Past the due date. Talk about who needs help.</small>;
        } else {
          pill = <span className="pill">Not yet</span>;
        }
        return (
          <div key={m.key} className="msr">
            <div className="msr-top"><div><b>{m.name}</b><br /><small>{m.thr}% of the goal · due {m.dueLabel}</small></div>{pill}</div>
            {extra}
          </div>
        );
      })}
      <div className="keydates">
        <span>Launch Readiness Review: <b>Monday, November 23</b></span>
        <span>Kickoff Day: <b>Monday, November 30, 2026</b></span>
      </div>
    </>
  );
}
