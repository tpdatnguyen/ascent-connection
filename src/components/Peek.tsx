import { useEffect, useRef } from 'react';
import type { DerivedGoal } from '../domain/selectors';
import { Avatar, GoalBar, StepButton } from './common';

/** Right-hand side panel with one person's goal. `g` is null when closed. */
export function Peek({ g, canProgress, onTick, onClose }: {
  g: DerivedGoal | null;
  canProgress: boolean;
  onTick: (goalId: string, i: number) => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  // Keep showing the last goal while the panel slides out.
  const lastGoal = useRef<DerivedGoal | null>(null);
  if (g) lastGoal.current = g;
  const shown = g ?? lastGoal.current;
  const open = !!g;

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => closeBtn.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, g?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // After a tick from inside the panel, move focus to the new current step
  // (the clicked button may have become disabled).
  useEffect(() => {
    if (!refocus.current || !panel.current) return;
    refocus.current = false;
    const c = panel.current.querySelector<HTMLElement>('.pk-step.cur') || closeBtn.current;
    c?.focus();
  }, [g?.dn]);

  const tick = (goalId: string, i: number) => {
    refocus.current = true;
    onTick(goalId, i);
  };

  return (
    <>
      <div className="scrim" id="scrim" hidden={!open} onClick={onClose} />
      <aside ref={panel} id="peek" className={'peek' + (open ? ' open' : '')} role="dialog" aria-modal="true" aria-label="Goal details" aria-hidden={!open}>
        {shown ? (
          <>
            <button ref={closeBtn} type="button" className="x" onClick={onClose} aria-label="Close">✕</button>
            <div className="gc-top"><Avatar name={shown.name} color={shown.color} /><b>{shown.name}</b></div>
            <div className="pk-goal">{shown.goal}</div>
            <div className="gc-mean">{shown.meaning}</div>
            <div className="pk-pct"><GoalBar pct={shown.pct} color={shown.color} /><b>{shown.pct}%</b></div>
            {shown.steps.map((s, i) => <StepButton key={s.id} g={shown} s={s} i={i} cls="pk-step" canProgress={canProgress && open} onTick={tick} />)}
            <div className="hint" style={{ marginTop: 12 }}>Steps go in order. Tick the next one, or undo the last.</div>
          </>
        ) : null}
      </aside>
    </>
  );
}
