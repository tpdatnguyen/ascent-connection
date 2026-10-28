import type { Goal, Permissions, PlanState } from '../domain/types';

/**
 * Backend-agnostic plan storage. Components only ever see this interface and
 * the plain domain types; adding Firebase/Supabase/etc. means writing a new
 * class that implements it.
 */
export interface PlanStore {
  /** Calls `onChange` immediately with the current state and again on every change. */
  subscribe(onChange: (s: PlanState) => void): () => void;
  setStepDone(goalId: string, stepId: string, done: boolean): Promise<void>;
  updateGoal(goalId: string, patch: Partial<Goal>): Promise<void>;
  updateStep(stepId: string, text: string): Promise<void>;
  markReached(patch: Record<string, string>): Promise<void>;
  markCelebrated(key: string): Promise<void>;
  permissions(): Promise<Permissions>;
  /** Writes the default plan into an empty backend (optional). */
  seedDefaultPlan?(): Promise<void>;
  /** For backends with sign-in (PlanState.session is set). */
  signIn?(): Promise<void>;
  signOut?(): Promise<void>;
}

/** A write was refused because the user may not change this part of the plan. */
export class ReadOnlyError extends Error {
  constructor(public readonly scope: 'plan' | 'progress') {
    super(scope === 'plan' ? 'Only editors can change the plan.' : 'Read-only access.');
    this.name = 'ReadOnlyError';
  }
}

export const LOADING_STATE: PlanState = {
  status: 'loading',
  goals: [],
  steps: [],
  progress: {},
  meta: { reached: {}, celebrated: {} },
  ready: false,
  metaLoaded: false,
  revoked: false,
};
