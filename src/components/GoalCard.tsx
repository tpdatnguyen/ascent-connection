import type { CSSProperties } from 'react';
import { fmtISO } from '../domain/dates';
import type { DerivedGoal } from '../domain/selectors';
import type { Goal } from '../domain/types';
import { Avatar, CommitInput, GoalBar, StepButton } from './common';

const cssColor = (c: string) => ({ '--c': c }) as CSSProperties;

export function GoalCard({ g, canProgress, onTick, onOpen }: {
  g: DerivedGoal;
  canProgress: boolean;
  onTick: (goalId: string, i: number) => void;
  onOpen: (goalId: string) => void;
}) {
  return (
    <div className="gc" style={cssColor(g.color)}>
      <button type="button" className="gc-open" onClick={() => onOpen(g.id)} aria-label={`Open details for ${g.name}`}>
        <Avatar name={g.name} color={g.color} /><b>{g.name}</b><span className="gc-pct">{g.pct}%</span>
      </button>
      <GoalBar pct={g.pct} color={g.color} block />
      <div className="gc-goal">{g.goal}</div>
      <div className="gc-mean">{g.meaning}</div>
      {g.steps.map((s, i) => <StepButton key={s.id} g={g} s={s} i={i} cls="step" canProgress={canProgress} onTick={onTick} />)}
      {g.last ? <div className="gc-last">Last update {fmtISO(g.last)}</div> : null}
    </div>
  );
}

export function GoalCardEdit({ g, onGoal, onStep }: {
  g: DerivedGoal;
  onGoal: (goalId: string, patch: Partial<Goal>) => void;
  onStep: (stepId: string, text: string) => void;
}) {
  return (
    <div className="gc" style={cssColor(g.color)}>
      <div className="gc-top" style={{ marginBottom: 6 }}><Avatar name={g.name} color={g.color} /><b>{g.name}</b></div>
      <CommitInput className="field gc-goal-in" label="Goal title" value={g.goal} onCommit={(v) => onGoal(g.id, { goal: v })} />
      <CommitInput className="field" label="Meaning" value={g.meaning} onCommit={(v) => onGoal(g.id, { meaning: v })} />
      {g.steps.map((s, i) => <CommitInput key={s.id} className="field" label={`Step ${i + 1}`} value={s.t} onCommit={(v) => onStep(s.id, v)} />)}
    </div>
  );
}
