import { useEffect, useRef, type CSSProperties } from 'react';
import { fmtISO } from '../domain/dates';
import { initials } from '../domain/plan';
import type { DerivedGoal, DerivedStep } from '../domain/selectors';

export function Avatar({ name, color, style }: { name: string; color: string; style?: CSSProperties }) {
  return <span className="av" style={{ background: color, ...style }}>{initials(name)}</span>;
}

export function GoalBar({ pct, color, block }: { pct: number; color: string; block?: boolean }) {
  const fill = <i style={{ width: pct + '%', background: color }} />;
  return block ? <div className="gbar">{fill}</div> : <span className="gbar">{fill}</span>;
}

/** One step row. Only the next step and the last finished step are enabled. */
export function StepButton({ g, s, i, cls, canProgress, onTick }: {
  g: DerivedGoal;
  s: DerivedStep;
  i: number;
  cls: 'step' | 'pk-step';
  canProgress: boolean;
  onTick: (goalId: string, i: number) => void;
}) {
  const cur = i === g.dn;
  const later = i > g.dn;
  const disabled = !canProgress || !(cur || i === g.dn - 1);
  const className = [cls, s.done && 'on', cur && 'cur', later && 'later'].filter(Boolean).join(' ');
  return (
    <button type="button" className={className} disabled={disabled} aria-pressed={s.done} onClick={() => onTick(g.id, i)}>
      <span className="ck" aria-hidden="true">✓</span>
      <span className="tx">{s.t}{cls === 'pk-step' && s.at ? <span className="when">Done {fmtISO(s.at)}</span> : null}</span>
    </button>
  );
}

/** Text input that saves on the native change event (blur or Enter), like the original page. */
export function CommitInput({ value, label, className, onCommit }: {
  value: string;
  label: string;
  className?: string;
  onCommit: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = () => commit.current(el.value);
    el.addEventListener('change', h);
    return () => el.removeEventListener('change', h);
  }, []);
  // Show remote edits unless the person is typing in this field.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.value !== value) el.value = value;
  }, [value]);
  return <input ref={ref} type="text" className={className} aria-label={label} defaultValue={value} />;
}
