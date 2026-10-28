import { MILESTONES } from '../domain/plan';
import { nextMilestone } from '../domain/selectors';

export function TeamProgress({ pct }: { pct: number }) {
  const nxt = nextMilestone(pct);
  return (
    <div className="panel prog">
      <div className="prog-head">
        <div><div className="brand">TEAM PROGRESS</div><div className="big">{pct}%</div></div>
        <div className="next">{nxt ? `Next: ${nxt.name} at ${nxt.thr}% · due ${nxt.dueLabel}` : 'Every milestone reached'}</div>
      </div>
      <div className="track">
        <div className="fill" style={{ width: pct + '%' }} />
        {MILESTONES.map((m, i) => {
          const last = i === MILESTONES.length - 1;
          return (
            <div key={m.key} className={'tick' + (pct >= m.thr ? ' hit' : '') + (last ? ' last' : '')} style={last ? undefined : { left: m.thr + '%' }}>
              <span>{m.name}<br />{m.thr}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
