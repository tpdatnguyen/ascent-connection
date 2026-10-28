import { fmtISO } from '../domain/dates';
import { recentProgress, type DerivedGoal } from '../domain/selectors';

export function RecentProgress({ goals }: { goals: DerivedGoal[] }) {
  const items = recentProgress(goals, 6);
  if (!items.length) return <div className="empty">Nothing finished yet. The first tick will show up here.</div>;
  return (
    <>
      {items.map((i) => (
        <div key={i.at + i.t} className="fi">
          <span className="dotp" style={{ background: i.c }} />
          <span><b>{i.name}</b> finished {i.t}</span>
          <time dateTime={i.at}>{fmtISO(i.at)}</time>
        </div>
      ))}
    </>
  );
}
