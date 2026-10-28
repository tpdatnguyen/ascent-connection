import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { todayKey } from '../domain/dates';
import { MILESTONES } from '../domain/plan';
import { canTick, deriveGoals, milestonesCrossed, reachedPatch, teamPercent } from '../domain/selectors';
import type { Goal, Permissions, PlanState } from '../domain/types';
import { LOADING_STATE, ReadOnlyError, type PlanStore } from '../store/PlanStore';

const toastFor = (m: (typeof MILESTONES)[number]) => m.name + ' reached! Time to celebrate: ' + m.reward;

/**
 * Connects a PlanStore to React. Snapshots that arrive together are coalesced
 * into one render per animation frame.
 */
export function usePlan(storePromise: Promise<PlanStore>, toast: (msg: string) => void) {
  const [store, setStore] = useState<PlanStore | null>(null);
  const [state, setState] = useState<PlanState>(LOADING_STATE);
  const [perms, setPerms] = useState<Permissions>({ canProgress: true, canEditPlan: true });
  // Rights withdrawn after a write was refused.
  const [refused, setRefused] = useState({ progress: false, plan: false });

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    let raf = 0;
    let pending: PlanState | null = null;
    storePromise.then(async (s) => {
      const p = await s.permissions();
      if (cancelled) return;
      setPerms(p);
      setStore(s);
      unsub = s.subscribe((next) => {
        pending = next;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (pending) setState(pending);
        });
      });
    });
    return () => {
      cancelled = true;
      unsub?.();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [storePromise]);

  const goals = useMemo(() => deriveGoals(state), [state]);
  const pct = useMemo(() => teamPercent(goals), [goals]);
  const base = state.perms ?? perms;
  const canProgress = base.canProgress && !state.revoked && !refused.progress;
  const canEditPlan = base.canEditPlan && !refused.plan;

  // A new sign-in starts with a clean slate.
  const email = state.session?.email;
  useEffect(() => setRefused({ progress: false, plan: false }), [email]);

  const onError = useCallback((e: unknown) => {
    if (e instanceof ReadOnlyError) {
      if (e.scope === 'plan') {
        setRefused((r) => ({ ...r, plan: true }));
        toast('Only editors can change the plan.');
      } else {
        setRefused((r) => ({ ...r, progress: true }));
        toast('You can view the plan but not change it. Ask the owner for access.');
      }
    } else toast('Could not save. Try again in a moment.');
  }, [toast]);

  // Milestones reached by someone else's tick get the same toast.
  const seenReached = useRef<Set<string> | null>(null);
  const toastedHere = useRef(new Set<string>());
  useEffect(() => {
    if (!state.ready || !state.metaLoaded) {
      seenReached.current = null;
      return;
    }
    const keys = Object.keys(state.meta.reached || {});
    if (!seenReached.current) {
      seenReached.current = new Set(keys);
      return;
    }
    const seen = seenReached.current;
    const fresh = MILESTONES.filter((m) => keys.includes(m.key) && !seen.has(m.key));
    fresh.forEach((m) => seen.add(m.key));
    const remote = fresh.filter((m) => !toastedHere.current.has(m.key));
    if (remote.length) toast(toastFor(remote[remote.length - 1]));
  }, [state, toast]);

  // Latest values for stable callbacks.
  const live = useRef({ goals, state, canProgress });
  live.current = { goals, state, canProgress };

  const tick = useCallback((goalId: string, i: number) => {
    const { goals: gs, state: st, canProgress: cp } = live.current;
    if (!store || !cp) return;
    const g = gs.find((x) => x.id === goalId);
    if (!g || !canTick(g, i)) return;
    const done = i === g.dn;
    store.setStepDone(goalId, g.steps[i].id, done).catch(onError);
    if (!done) return; // un-ticking never clears reached
    const hits = milestonesCrossed(gs, goalId, st.meta.reached || {});
    if (hits.length) {
      hits.forEach((m) => toastedHere.current.add(m.key));
      store.markReached(reachedPatch(hits, todayKey())).catch(onError);
      toast(toastFor(hits[hits.length - 1]));
    }
  }, [store, onError, toast]);

  const celebrate = useCallback((key: string) => {
    if (store && live.current.canProgress) store.markCelebrated(key).catch(onError);
  }, [store, onError]);

  const updateGoal = useCallback((goalId: string, patch: Partial<Goal>) => {
    store?.updateGoal(goalId, patch).catch(onError);
  }, [store, onError]);

  const updateStep = useCallback((stepId: string, text: string) => {
    store?.updateStep(stepId, text).catch(onError);
  }, [store, onError]);

  const seed = store?.seedDefaultPlan && canEditPlan && state.status === 'live'
    ? () => { store.seedDefaultPlan?.().catch(onError); }
    : null;

  const signIn = store?.signIn ? () => { store.signIn?.(); } : null;
  const signOut = store?.signOut ? () => { store.signOut?.().catch(() => toast('Could not sign out. Try again in a moment.')); } : null;

  return { state, goals, pct, canProgress, canEditPlan, tick, celebrate, updateGoal, updateStep, seed, signIn, signOut };
}

export type PlanApi = ReturnType<typeof usePlan>;
