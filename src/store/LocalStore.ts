import { todayKey } from '../domain/dates';
import { defaultPlan, type PlanData } from '../domain/plan';
import type { Goal, MilestoneKey, Permissions, PlanState } from '../domain/types';
import type { PlanStore } from './PlanStore';

/** Same key and shape as the single-file version, so existing device data carries over. */
export const LOCAL_KEY = 'ascent_plan_local_v2';

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): KeyValue | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Plan saved in this browser only. Works with zero setup. */
export class LocalStore implements PlanStore {
  private data: PlanData;
  private listeners = new Set<(s: PlanState) => void>();

  constructor(
    private kv: KeyValue | null = browserStorage(),
    private now: () => Date = () => new Date(),
  ) {
    this.data = this.load() ?? defaultPlan();
  }

  private load(): PlanData | null {
    try {
      const raw = this.kv?.getItem(LOCAL_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (d && d.goals && d.goals.length) {
        return {
          goals: d.goals,
          steps: d.steps || [],
          progress: d.progress || {},
          meta: { reached: d.meta?.reached || {}, celebrated: d.meta?.celebrated || {} },
        };
      }
    } catch {
      /* corrupt or blocked storage: fall back to the default plan */
    }
    return null;
  }

  private commit(next: PlanData) {
    this.data = next;
    try {
      this.kv?.setItem(LOCAL_KEY, JSON.stringify(next));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
    const s = this.snapshot();
    this.listeners.forEach((fn) => fn(s));
  }

  private snapshot(): PlanState {
    return { status: 'local', ...this.data, ready: true, metaLoaded: true, revoked: false };
  }

  subscribe(onChange: (s: PlanState) => void): () => void {
    this.listeners.add(onChange);
    onChange(this.snapshot());
    return () => {
      this.listeners.delete(onChange);
    };
  }

  async setStepDone(goalId: string, stepId: string, done: boolean): Promise<void> {
    const progress = { ...this.data.progress };
    if (done) progress[stepId] = { goal: goalId, at: this.now().toISOString() };
    else delete progress[stepId];
    this.commit({ ...this.data, progress });
  }

  async updateGoal(goalId: string, patch: Partial<Goal>): Promise<void> {
    this.commit({ ...this.data, goals: this.data.goals.map((g) => (g.id === goalId ? { ...g, ...patch, id: g.id } : g)) });
  }

  async updateStep(stepId: string, text: string): Promise<void> {
    this.commit({ ...this.data, steps: this.data.steps.map((s) => (s.id === stepId ? { ...s, t: text } : s)) });
  }

  async markReached(patch: Record<string, string>): Promise<void> {
    const meta = this.data.meta;
    this.commit({ ...this.data, meta: { ...meta, reached: { ...meta.reached, ...patch } } });
  }

  async markCelebrated(key: string): Promise<void> {
    const meta = this.data.meta;
    this.commit({ ...this.data, meta: { ...meta, celebrated: { ...meta.celebrated, [key as MilestoneKey]: todayKey(this.now()) } } });
  }

  async permissions(): Promise<Permissions> {
    return { canProgress: true, canEditPlan: true };
  }
}
