import { useEffect, useRef } from 'react';
import type { PlanApi } from '../hooks/usePlan';

/** Sign-in and access-denied screens shown after "Open the Plan" when the backend needs sign-in. */
export function AuthGate({ plan }: { plan: PlanApi }) {
  const session = plan.state.session!;
  const action = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (session.state !== 'checking') action.current?.focus();
  }, [session.state]);

  let body;
  if (session.state === 'signed-out') {
    body = (
      <>
        <b>Sign in to see the plan</b>
        <div>The plan is shared with the team. Use the Google account your team added.</div>
        <button ref={action} type="button" className="btn" onClick={plan.signIn ?? undefined}>Continue with Google</button>
        {session.error ? <div role="alert" style={{ marginTop: 12, color: 'var(--warn)' }}>{session.error}</div> : null}
      </>
    );
  } else if (session.state === 'denied') {
    body = (
      <>
        <b>You do not have access.</b>
        <div>Ask the project owner to add your email.</div>
        {session.email ? <div style={{ marginTop: 6 }}>Signed in as {session.email}</div> : null}
        <button ref={action} type="button" className="btn ghost" onClick={plan.signOut ?? undefined}>Sign out</button>
      </>
    );
  } else {
    body = <div role="status">Connecting...</div>;
  }

  return (
    <section className="screen active" id="s-game">
      <div className="wrap">
        <div className="top">
          <h2>The <span>Ascent</span></h2>
          <span className="kick">6 weeks · Kickoff Day Monday, December 7, 2026</span>
        </div>
        <div className="setup panel">{body}</div>
      </div>
    </section>
  );
}
