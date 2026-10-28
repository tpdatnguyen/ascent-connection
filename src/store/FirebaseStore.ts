import { todayKey } from '../domain/dates';
import { defaultPlan } from '../domain/plan';
import type { Connection, Goal, Meta, Permissions, PlanState, ProgressDoc, Session, Step } from '../domain/types';
import type { FirebaseConfig } from './firebase/config';
import type { FbBackend, FbDoc, FbError, FbSnapMeta, FbUser, Unsub } from './firebase/types';
import { ReadOnlyError, type PlanStore } from './PlanStore';

export { firebaseConfigFromEnv } from './firebase/config';
export type { FirebaseConfig } from './firebase/config';

/** Loads the Firebase SDK on demand so the LocalStore path stays light. */
export async function connectFirebase(config: FirebaseConfig): Promise<FbBackend> {
  const { createFirebaseBackend } = await import('./firebase/backend');
  return createFirebaseBackend(config);
}

export interface NetworkStatus {
  offline(): boolean;
  onChange(cb: () => void): Unsub;
}

function browserNetwork(): NetworkStatus {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  return {
    offline: () => nav?.onLine === false,
    onChange: (cb) => {
      if (typeof window === 'undefined') return () => {};
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
  };
}

type Role = 'none' | 'member' | 'admin';
type Source = 'access' | 'goals' | 'steps' | 'progress' | 'meta';

const SIGN_IN_FAILED = 'Sign-in did not finish. Try again.';

/**
 * Live shared plan in Cloud Firestore with Google sign-in.
 * Flow: auth state -> config/access allowlist -> data listeners.
 * Firestore security rules are the real protection; this class mirrors them in the UI.
 */
export class FirebaseStore implements PlanStore {
  private user: FbUser | null = null;
  private session: Session = { state: 'checking' };
  private role: Role = 'none';
  private goals: Goal[] = [];
  private steps: Step[] = [];
  private progress: Record<string, ProgressDoc> = {};
  private meta: Meta = { reached: {}, celebrated: {} };
  private metaExists = false;
  private loaded = { goals: false, steps: false, progress: false, meta: false };
  private cached: Partial<Record<Source, boolean>> = {};
  private everOnline = false;
  private accessUnsub: Unsub | null = null;
  private dataUnsubs: Unsub[] = [];
  private listeners = new Set<(s: PlanState) => void>();
  private queue: Record<string, Promise<unknown>> = {};

  constructor(private fb: FbBackend, private now: () => Date = () => new Date(), private net: NetworkStatus = browserNetwork()) {
    fb.onAuth((u) => this.onUser(u));
    net.onChange(() => this.emit());
  }

  /* ---------- auth and access ---------- */

  private onUser(u: FbUser | null) {
    this.stopAccess();
    this.stopData();
    this.user = u;
    this.role = 'none';
    if (!u) {
      this.session = { state: 'signed-out', error: this.session.error };
      return this.emit();
    }
    const email = (u.email || '').toLowerCase();
    if (!email || !u.emailVerified) {
      this.session = { state: 'denied', email: u.email || undefined };
      return this.emit();
    }
    this.session = { state: 'checking', email };
    this.emit();
    this.accessUnsub = this.fb.watchDoc('config/access', (doc, meta) => this.onAccess(email, doc, meta), (e) => this.onAccessError(e));
  }

  private onAccess(email: string, doc: FbDoc | null, meta: FbSnapMeta) {
    this.track('access', meta);
    if (!doc) {
      // Offline with nothing cached yet: keep waiting rather than saying "no access".
      if (meta.fromCache) return this.emit();
      return this.deny();
    }
    const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).toLowerCase()) : []);
    this.role = list(doc.data.admins).includes(email) ? 'admin' : list(doc.data.members).includes(email) ? 'member' : 'none';
    if (this.role === 'none') return this.deny();
    this.session = { state: 'ready', email };
    this.startData();
    this.emit();
  }

  private onAccessError(e: FbError) {
    if (e.code === 'permission-denied') return this.deny();
    this.emit();
  }

  private deny() {
    this.stopData();
    this.role = 'none';
    this.session = { state: 'denied', email: this.session.email };
    this.emit();
  }

  async signIn(): Promise<void> {
    this.session = { ...this.session, error: undefined };
    this.emit();
    try {
      await this.fb.signIn();
    } catch (e) {
      const code = (e as FbError)?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      this.session = { ...this.session, error: SIGN_IN_FAILED };
      this.emit();
    }
  }

  signOut(): Promise<void> {
    return this.fb.signOut();
  }

  /* ---------- data ---------- */

  private startData() {
    if (this.dataUnsubs.length) return;
    const onError = (name: 'goals' | 'steps' | 'progress' | 'meta') => () => {
      this.loaded[name] = true;
      this.emit();
    };
    this.dataUnsubs = [
      this.fb.watchCollection('goals', true, (docs, m) => {
        this.goals = docs.map((d) => ({ ...(d.data as Omit<Goal, 'id'>), id: d.id }));
        this.loaded.goals = true;
        this.track('goals', m);
        this.emit();
      }, onError('goals')),
      this.fb.watchCollection('steps', true, (docs, m) => {
        this.steps = docs.map((d) => ({ ...(d.data as Omit<Step, 'id'>), id: d.id }));
        this.loaded.steps = true;
        this.track('steps', m);
        this.emit();
      }, onError('steps')),
      this.fb.watchCollection('progress', false, (docs, m) => {
        const o: Record<string, ProgressDoc> = {};
        docs.forEach((d) => { o[d.id] = d.data as ProgressDoc; });
        this.progress = o;
        this.loaded.progress = true;
        this.track('progress', m);
        this.emit();
      }, onError('progress')),
      this.fb.watchDoc('meta/milestones', (doc, m) => {
        this.metaExists = !!doc;
        const d = doc?.data || {};
        this.meta = { reached: d.reached || {}, celebrated: d.celebrated || {} };
        this.loaded.meta = true;
        this.track('meta', m);
        this.emit();
      }, onError('meta')),
    ];
  }

  private stopData() {
    this.dataUnsubs.forEach((u) => u());
    this.dataUnsubs = [];
    this.goals = [];
    this.steps = [];
    this.progress = {};
    this.meta = { reached: {}, celebrated: {} };
    this.metaExists = false;
    this.loaded = { goals: false, steps: false, progress: false, meta: false };
    for (const k of ['goals', 'steps', 'progress', 'meta'] as Source[]) delete this.cached[k];
  }

  private stopAccess() {
    this.accessUnsub?.();
    this.accessUnsub = null;
    delete this.cached.access;
  }

  /* ---------- state ---------- */

  private track(source: Source, meta: FbSnapMeta) {
    this.cached[source] = meta.fromCache;
    if (!Object.values(this.cached).some(Boolean)) this.everOnline = true;
  }

  private connection(): Connection {
    if (this.net.offline()) return 'offline';
    const sources = Object.values(this.cached);
    if (sources.length && !sources.some(Boolean)) return 'online';
    return this.everOnline ? 'offline' : 'connecting';
  }

  private perms(): Permissions {
    return { canProgress: this.role !== 'none', canEditPlan: this.role === 'admin' };
  }

  private snapshot(): PlanState {
    const l = this.loaded;
    return {
      status: 'live',
      goals: this.goals,
      steps: this.steps,
      progress: this.progress,
      meta: this.meta,
      ready: this.session.state === 'ready' && l.goals && l.steps && l.progress,
      metaLoaded: l.meta,
      revoked: false,
      session: this.session,
      connection: this.connection(),
      perms: this.perms(),
    };
  }

  private emit() {
    const s = this.snapshot();
    this.listeners.forEach((fn) => fn(s));
  }

  subscribe(onChange: (s: PlanState) => void): () => void {
    this.listeners.add(onChange);
    onChange(this.snapshot());
    return () => {
      this.listeners.delete(onChange);
    };
  }

  async permissions(): Promise<Permissions> {
    return this.perms();
  }

  /* ---------- writes ---------- */

  /** One write at a time per document. A failed write does not block the next one. */
  private enqueue(path: string, scope: 'plan' | 'progress', fn: () => Promise<unknown>): Promise<void> {
    const run = (this.queue[path] || Promise.resolve()).then(fn);
    this.queue[path] = run.catch(() => {});
    return run.then(
      () => undefined,
      (e) => {
        if ((e as FbError)?.code === 'permission-denied') throw new ReadOnlyError(scope);
        throw e;
      },
    );
  }

  setStepDone(goalId: string, stepId: string, done: boolean): Promise<void> {
    const uid = this.user?.uid;
    if (!uid) return Promise.reject(new ReadOnlyError('progress'));
    const path = 'progress/' + stepId;
    return this.enqueue(path, 'progress', () =>
      done ? this.fb.set(path, { goal: goalId, at: this.now().toISOString(), by: uid }) : this.fb.remove(path));
  }

  updateGoal(goalId: string, patch: Partial<Goal>): Promise<void> {
    const { id: _id, ...fields } = patch;
    const path = 'goals/' + goalId;
    return this.enqueue(path, 'plan', () => this.fb.update(path, fields));
  }

  updateStep(stepId: string, text: string): Promise<void> {
    const path = 'steps/' + stepId;
    return this.enqueue(path, 'plan', () => this.fb.update(path, { t: text }));
  }

  markReached(patch: Record<string, string>): Promise<void> {
    return this.enqueue('meta/milestones', 'progress', () => this.fb.set('meta/milestones', { reached: patch }, true));
  }

  markCelebrated(key: string): Promise<void> {
    return this.enqueue('meta/milestones', 'progress', () => this.fb.set('meta/milestones', { celebrated: { [key]: todayKey(this.now()) } }, true));
  }

  async seedDefaultPlan(): Promise<void> {
    const d = defaultPlan();
    const writes: Promise<void>[] = [];
    d.goals.forEach((g) => writes.push(this.enqueue('goals/' + g.id, 'plan', () => this.fb.set('goals/' + g.id, { order: g.order, name: g.name, goal: g.goal, meaning: g.meaning }))));
    d.steps.forEach((s) => writes.push(this.enqueue('steps/' + s.id, 'plan', () => this.fb.set('steps/' + s.id, { goal: s.goal, order: s.order, t: s.t }))));
    // Rules require by == the signed-in uid, so the seed placeholder is replaced with it.
    const uid = this.user?.uid;
    if (!uid) throw new ReadOnlyError('progress');
    Object.entries(d.progress).forEach(([id, p]) => {
      if (this.progress[id]) return;
      writes.push(this.enqueue('progress/' + id, 'progress', () => this.fb.set('progress/' + id, { goal: p.goal, at: p.at, by: uid })));
    });
    if (!this.metaExists) writes.push(this.enqueue('meta/milestones', 'progress', () => this.fb.set('meta/milestones', { reached: {}, celebrated: {} })));
    await Promise.all(writes);
  }
}
