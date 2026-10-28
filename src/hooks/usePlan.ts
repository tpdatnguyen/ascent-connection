import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { todayKey } from '../domain/dates';
import { canTick, deriveGoals, milestonesCrossed, reachedPatch, teamPercent } from '../domain/selectors';
import type { Goal, Permissions, PlanState } from '../domain/types';
import { LOADING_STATE, ReadOnlyError, type PlanStore } from '../store/PlanStore';

/**
 * Connects a PlanStore to React. Snapshots that arrive together are coalesced
 * into one render per animation frame.
 */
export function usePlan(storePromise: Promise<PlanStore>, toast: (msg: string) => void) {
  const [store, setStore] = useState<PlanStore | null>(null);
  const [state, setState] = useState<PlanState>(LOADING_STATE);
  const [perms, setPerms] = useState<Permissions>({ canProgress: true, canEditPlan: true });

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
  const canProgress = perms.canProgress && !state.revoked;
  const canEditPlan = perms.canEditPlan;

  const onError = useCallback((e: unknown) => {
    if (e instanceof ReadOnlyError) {
      if (e.scope === 'plan') {
        setPerms((p) => ({ ...p, canEditPlan: false }));
        toast('Only editors can change the plan.');
      } else {
        setPerms((p) => ({ ...p, canProgress: false }));
        toast('You can view the plan but not change it. Ask the owner for access.');
      }
    } else toast('Could not save. Try again in a moment.');
  }, [toast]);

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
      store.markReached(reachedPatch(hits, todayKey())).catch(onError);
      const m = hits[hits.length - 1];
      toast(m.name + ' reached! Time to celebrate: ' + m.reward);
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

  return { state, goals, pct, canProgress, canEditPlan, tick, celebrate, updateGoal, updateStep, seed };
}

export type PlanApi = ReturnType<typeof usePlan>;
