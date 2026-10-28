import { todayKey } from '../domain/dates';
import { defaultPlan } from '../domain/plan';
import type { Goal, Meta, Permissions, PlanState, ProgressDoc, Step } from '../domain/types';
import { ReadOnlyError, type PlanStore } from './PlanStore';

/* The small document-database shape both live backends are adapted to
   (claude.ai's db as-is, Firestore through a thin wrapper). Kept here so no
   backend SDK types leak into the rest of the app. */
export interface DocSnapshot {
  id: string;
  exists?: boolean;
  data(): any;
}
export interface QuerySnapshot {
  docs: DocSnapshot[];
}
export type ErrorCb = (e: { code?: string } | undefined) => void;
export interface DocRef {
  set(data: object): Promise<unknown>;
  update(data: object): Promise<unknown>;
  delete(): Promise<unknown>;
  onSnapshot(next: (s: DocSnapshot) => void, error?: ErrorCb): unknown;
}
export interface CollectionRef {
  onSnapshot(next: (s: QuerySnapshot) => void, error?: ErrorCb): unknown;
}
export interface DocDb {
  collection(name: string): CollectionRef;
  doc(path: string): DocRef;
}

export interface DocDbOptions {
  /** Error codes that mean "you may not write this" for this backend. */
  readOnlyCodes: string[];
  /** Snapshot error code that means write access was withdrawn while open. */
  revokedCode?: string;
  permissions: () => Promise<Permissions>;
  now?: () => Date;
}

type Scope = 'plan' | 'progress';

/** Live shared plan on top of any DocDb: subscriptions once, one write at a time per document. */
export class DocDbStore implements PlanStore {
  private goals: Goal[] = [];
  private steps: Step[] = [];
  private progress: Record<string, ProgressDoc> = {};
  private meta: Meta = { reached: {}, celebrated: {} };
  private loaded = { goals: false, steps: false, progress: false, meta: false };
  private metaExists = false;
  private revoked = false;
  private listeners = new Set<(s: PlanState) => void>();
  private queue: Record<string, Promise<unknown>> = {};
  private perms: Promise<Permissions> | null = null;
  private now: () => Date;

  constructor(private db: DocDb, private opts: DocDbOptions) {
    this.now = opts.now ?? (() => new Date());
    // Subscriptions are created once, for the life of the store.
    const err = (name: 'goals' | 'steps' | 'progress'): ErrorCb => (e) => {
      this.loaded[name] = true;
      if (e && opts.revokedCode && e.code === opts.revokedCode) this.revoked = true;
      this.emit();
    };
    db.collection('goals').onSnapshot((snap) => {
      this.goals = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      this.loaded.goals = true;
      this.emit();
    }, err('goals'));
    db.collection('steps').onSnapshot((snap) => {
      this.steps = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      this.loaded.steps = true;
      this.emit();
    }, err('steps'));
    db.collection('progress').onSnapshot((snap) => {
      const o: Record<string, ProgressDoc> = {};
      snap.docs.forEach((d) => { o[d.id] = d.data(); });
      this.progress = o;
      this.loaded.progress = true;
      this.emit();
    }, err('progress'));
    db.doc('meta/milestones').onSnapshot((snap) => {
      this.metaExists = !!snap.exists;
      const d = (snap.exists && snap.data()) || {};
      this.meta = { reached: d.reached || {}, celebrated: d.celebrated || {} };
      this.loaded.meta = true;
      this.emit();
    }, () => {});
  }

  private snapshot(): PlanState {
    const l = this.loaded;
    return {
      status: 'live',
      goals: this.goals,
      steps: this.steps,
      progress: this.progress,
      meta: this.meta,
      ready: l.goals && l.steps && l.progress,
      revoked: this.revoked,
    };
  }

  private emit() {
    const s = this.snapshot();
    this.listeners.forEach((fn) => fn(s));
  }

  /** One write at a time per document. A failed write does not block the next one. */
  private enqueue(key: string, scope: Scope, fn: () => Promise<unknown>): Promise<void> {
    const run = (this.queue[key] || Promise.resolve()).then(fn);
    this.queue[key] = run.catch(() => {});
    return run.then(
      () => undefined,
      (e) => {
        if (e && this.opts.readOnlyCodes.includes(e.code)) throw new ReadOnlyError(scope);
        throw e;
      },
    );
  }

  subscribe(onChange: (s: PlanState) => void): () => void {
    this.listeners.add(onChange);
    onChange(this.snapshot());
    return () => {
      this.listeners.delete(onChange);
    };
  }

  setStepDone(goalId: string, stepId: string, done: boolean): Promise<void> {
    const ref = this.db.doc('progress/' + stepId);
    return this.enqueue('pr' + stepId, 'progress', () => (done ? ref.set({ goal: goalId, at: this.now().toISOString() }) : ref.delete()));
  }

  updateGoal(goalId: string, patch: Partial<Goal>): Promise<void> {
    const { id: _id, ...fields } = patch;
    return this.enqueue('plgoals' + goalId, 'plan', () => this.db.doc('goals/' + goalId).update(fields));
  }

  updateStep(stepId: string, text: string): Promise<void> {
    return this.enqueue('plsteps' + stepId, 'plan', () => this.db.doc('steps/' + stepId).update({ t: text }));
  }

  private writeMeta(field: 'reached' | 'celebrated', patch: Record<string, string>): Promise<void> {
    return this.enqueue('meta', 'progress', () => {
      // Merge with the last known map so a shallow update never drops earlier keys.
      const value = { ...this.meta[field], ...patch };
      const ref = this.db.doc('meta/milestones');
      return this.metaExists ? ref.update({ [field]: value }) : ref.set({ reached: {}, celebrated: {}, [field]: value });
    });
  }

  markReached(patch: Record<string, string>): Promise<void> {
    return this.writeMeta('reached', patch);
  }

  markCelebrated(key: string): Promise<void> {
    return this.writeMeta('celebrated', { [key]: todayKey(this.now()) });
  }

  permissions(): Promise<Permissions> {
    if (!this.perms) this.perms = this.opts.permissions();
    return this.perms;
  }

  async seedDefaultPlan(): Promise<void> {
    const d = defaultPlan();
    const writes: Promise<void>[] = [];
    d.goals.forEach((g) => writes.push(this.enqueue('pl-g' + g.id, 'plan', () => this.db.doc('goals/' + g.id).set({ order: g.order, name: g.name, goal: g.goal, meaning: g.meaning }))));
    d.steps.forEach((s) => writes.push(this.enqueue('pl-s' + s.id, 'plan', () => this.db.doc('steps/' + s.id).set({ goal: s.goal, order: s.order, t: s.t }))));
    writes.push(this.enqueue('meta', 'progress', () => this.db.doc('meta/milestones').set({ reached: {}, celebrated: {} })));
    await Promise.all(writes);
  }
}
