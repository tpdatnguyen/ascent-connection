import { fmtISO } from '../domain/dates';
import type { DerivedGoal } from '../domain/selectors';
import { Avatar, GoalBar } from './common';

export function TableView({ goals, onOpen }: { goals: DerivedGoal[]; onOpen: (goalId: string) => void }) {
  return (
    <div className="scroll-x">
      <table className="tbl2">
        <thead><tr><th>Person</th><th>Goal</th><th>Progress</th><th>Next step</th><th>Last update</th></tr></thead>
        <tbody>
          {goals.map((g) => {
            const nx = g.steps[g.dn];
            return (
              <tr key={g.id} tabIndex={0} onClick={() => onOpen(g.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(g.id); }}>
                <td><span className="who"><Avatar name={g.name} color={g.color} />{g.name}</span></td>
                <td className="goalc">{g.goal}</td>
                <td><span className="pbar"><GoalBar pct={g.pct} color={g.color} /><b>{g.pct}%</b></span></td>
                <td>{nx ? nx.t : 'All steps done'}</td>
                <td>{g.last ? fmtISO(g.last) : 'Not started'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
