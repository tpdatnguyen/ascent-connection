import { useCallback, useState } from 'react';
import type { PlanApi } from '../hooks/usePlan';
import { CardsView } from './CardsView';
import { MilestoneList } from './MilestoneList';
import { Mountain } from './Mountain';
import { Peek } from './Peek';
import { RecentProgress } from './RecentProgress';
import { TableView } from './TableView';
import { TeamProgress } from './TeamProgress';
import { TimelineView } from './TimelineView';
import { ViewTabs, type View } from './ViewTabs';

const VIEW_KEY = 'ascent_view';

function savedView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'cards' || v === 'table' || v === 'timeline') return v;
  } catch {
    /* storage blocked */
  }
  return 'cards';
}

function StatusBadge({ plan }: { plan: PlanApi }) {
  const { status, connection } = plan.state;
  let text = 'Saved on this device only';
  let on = false;
  if (status === 'loading') text = 'Loading...';
  else if (status === 'live' && connection === 'connecting') text = 'Connecting...';
  else if (status === 'live' && connection === 'offline') text = 'Offline, changes will sync';
  else if (status === 'live' && plan.canProgress) { text = 'Live · everyone sees updates'; on = true; }
  else if (status === 'live') text = 'View only';
  return <span className={'live' + (on ? ' on' : '')} role="status">{text}</span>;
}

export function PlanScreen({ plan }: { plan: PlanApi }) {
  const { state, goals, pct, canProgress, canEditPlan } = plan;
  const [view, setViewState] = useState<View>(savedView);
  const [editing, setEditing] = useState(false);
  const [peekId, setPeekId] = useState<string | null>(null);

  const setView = (v: View) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked */ }
  };
  const closePeek = useCallback(() => setPeekId(null), []);
  const toggleEdit = () => {
    const next = !editing;
    setEditing(next);
    if (next) { setViewState('cards'); setPeekId(null); }
  };

  let body;
  if (!state.ready) body = <div className="setup">Loading the plan...</div>;
  else if (!goals.length) {
    body = (
      <div className="setup panel">
        <b>No plan yet</b><div>The team goals have not been set up.</div>
        {plan.seed ? <button type="button" className="btn" onClick={plan.seed}>Set up the team plan</button> : null}
      </div>
    );
  } else if (view === 'table') body = <TableView goals={goals} onOpen={setPeekId} />;
  else if (view === 'timeline') body = <TimelineView goals={goals} pct={pct} />;
  else body = <CardsView goals={goals} editing={editing} canProgress={canProgress} onTick={plan.tick} onOpen={setPeekId} onGoal={plan.updateGoal} onStep={plan.updateStep} />;

  const showEdit = canEditPlan && state.status !== 'loading' && goals.length > 0;

  return (
    <>
      <section className="screen active" id="s-game">
        <div className="wrap">
          <div className="top">
            <h2>The <span>Ascent</span></h2>
            <span className="kick">5 weeks · Kickoff Day Monday, November 30, 2026</span>
            <div className="sp" />
            <StatusBadge plan={plan} />
            <button type="button" className="btn ghost sm" hidden={!showEdit} onClick={toggleEdit}>{editing ? 'Done editing' : 'Edit plan'}</button>
            {state.session && plan.signOut ? (
              <button type="button" className="btn ghost sm" onClick={plan.signOut} title={state.session.email ? 'Signed in as ' + state.session.email : undefined}>Sign out</button>
            ) : null}
          </div>
          <TeamProgress pct={pct} />
          <ViewTabs view={view} onChange={setView} />
          <div id="view" role="tabpanel" aria-labelledby={'tab-' + view}>{body}</div>
          <div className="climbrow">
            <div>
              <div className="panel"><h3 className="t">The Climb</h3><div className="mtn"><Mountain pct={pct} /></div></div>
              <div className="panel" style={{ marginTop: 20 }}><h3 className="t">Recent progress</h3><div className="feed" style={{ marginTop: 8 }}><RecentProgress goals={goals} /></div></div>
            </div>
            <div className="panel"><h3 className="t">Milestones</h3><div style={{ marginTop: 10 }}><MilestoneList pct={pct} meta={state.meta} canProgress={canProgress} onCelebrate={plan.celebrate} /></div></div>
          </div>
        </div>
      </section>
      <Peek g={goals.find((x) => x.id === peekId) ?? null} canProgress={canProgress} onTick={plan.tick} onClose={closePeek} />
    </>
  );
}
