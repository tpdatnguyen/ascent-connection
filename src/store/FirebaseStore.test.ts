import { describe, expect, it, vi } from 'vitest';
import { deriveGoals, teamPercent } from '../domain/selectors';
import type { PlanState } from '../domain/types';
import { createStore } from './createStore';
import type { FbBackend, FbDoc, FbError, FbSnapMeta, FbUser } from './firebase/types';
import { firebaseConfigFromEnv, FirebaseStore, type NetworkStatus } from './FirebaseStore';
import { LocalStore } from './LocalStore';
import { ReadOnlyError } from './PlanStore';

type CollListener = { next: (docs: FbDoc[], m: FbSnapMeta) => void; error: (e: FbError) => void; ordered: boolean; active: boolean };
type DocListener = { next: (d: FbDoc | null, m: FbSnapMeta) => void; error: (e: FbError) => void; active: boolean };

/** In-memory stand-in for the Firebase SDK facade. Tests push snapshots by hand. */
function fakeFirebase() {
  let authCb: (u: FbUser | null) => void = () => {};
  const colls: Record<string, CollListener[]> = {};
  const docs: Record<string, DocListener[]> = {};
  const writes: { op: string; path: string; data?: object; merge?: boolean }[] = [];
  const ctl = { failWith: null as string | null, signInError: null as FbError | null, signedOut: 0 };
  const write = (op: string, path: string, data?: object, merge?: boolean) => {
    writes.push({ op, path, data, merge });
    return ctl.failWith ? Promise.reject({ code: ctl.failWith }) : Promise.resolve();
  };
  const fb: FbBackend = {
    onAuth: (cb) => { authCb = cb; return () => {}; },
    signIn: async () => { if (ctl.signInError) throw ctl.signInError; },
    signOut: async () => { ctl.signedOut++; authCb(null); },
    watchCollection: (name, ordered, next, error) => {
      const l = { next, error, ordered, active: true };
      (colls[name] ||= []).push(l);
      return () => { l.active = false; };
    },
    watchDoc: (path, next, error) => {
      const l = { next, error, active: true };
      (docs[path] ||= []).push(l);
      return () => { l.active = false; };
    },
    set: (path, data, merge) => write('set', path, data, merge),
    update: (path, data) => write('update', path, data),
    remove: (path) => write('delete', path),
  };
  const activeColl = (n: string) => (colls[n] || []).filter((l) => l.active);
  const activeDoc = (p: string) => (docs[p] || []).filter((l) => l.active);
  return {
    fb,
    ctl,
    writes,
    activeColl,
    activeDoc,
    login: (u: FbUser | null) => authCb(u),
    access: (data: object | null, fromCache = false) => activeDoc('config/access').forEach((l) => l.next(data ? { id: 'access', data: data as any } : null, { fromCache })),
    accessError: (code: string) => activeDoc('config/access').forEach((l) => l.error({ code })),
    coll: (name: string, items: Record<string, object>, fromCache = false) =>
      activeColl(name).forEach((l) => l.next(Object.entries(items).map(([id, data]) => ({ id, data: data as any })), { fromCache })),
    meta: (data: object | null, fromCache = false) => activeDoc('meta/milestones').forEach((l) => l.next(data ? { id: 'milestones', data: data as any } : null, { fromCache })),
  };
}

const onlineNet = (): NetworkStatus & { off: boolean; fire: () => void } => {
  let cb = () => {};
  const n = { off: false, offline: () => n.off, onChange: (f: () => void) => { cb = f; return () => {}; }, fire: () => cb() };
  return n;
};

function setup() {
  const f = fakeFirebase();
  const net = onlineNet();
  const store = new FirebaseStore(f.fb, () => new Date('2026-11-02T15:00:00.000Z'), net);
  let s!: PlanState;
  store.subscribe((x) => (s = x));
  return { ...f, net, store, state: () => s };
}

const ACCESS = { admins: ['owner@example.com'], members: ['danny@example.com', 'Irfan@Example.com'] };
const member: FbUser = { uid: 'u-danny', email: 'Danny@Example.com', emailVerified: true };
const admin: FbUser = { uid: 'u-owner', email: 'owner@example.com', emailVerified: true };

function loadPlan(t: ReturnType<typeof setup>) {
  t.coll('goals', { g1: { order: 1, name: 'Danny Nguyen', goal: 'Spread the Word', meaning: 'm' }, g2: { order: 2, name: 'Irfan Pasha', goal: 'A Smooth First Step', meaning: 'm' } });
  t.coll('steps', Object.fromEntries(['g1', 'g2'].flatMap((g) => [1, 2, 3, 4, 5].map((i) => [`${g}s${i}`, { goal: g, order: i, t: `${g} step ${i}` }]))));
  t.coll('progress', { g1s1: { goal: 'g1', at: '2026-10-27T10:00:00.000Z', by: 'u-danny' } });
  t.meta({ reached: { m1: '2026-10-30' }, celebrated: {} });
}

describe('FirebaseStore: sign-in and access', () => {
  it('starts in checking, then shows the sign-in gate when signed out', () => {
    const t = setup();
    expect(t.state().session).toEqual({ state: 'checking' });
    t.login(null);
    expect(t.state().session?.state).toBe('signed-out');
    expect(t.state().ready).toBe(false);
    expect(t.activeDoc('config/access')).toHaveLength(0);
    expect(t.activeColl('goals')).toHaveLength(0);
  });

  it('denies accounts without a verified email without reading anything', () => {
    const t = setup();
    t.login({ uid: 'x', email: 'danny@example.com', emailVerified: false });
    expect(t.state().session).toEqual({ state: 'denied', email: 'danny@example.com' });
    expect(t.activeDoc('config/access')).toHaveLength(0);
  });

  it('gives members progress rights but not plan editing (emails compared lowercase)', () => {
    const t = setup();
    t.login(member);
    expect(t.state().session).toEqual({ state: 'checking', email: 'danny@example.com' });
    t.access(ACCESS);
    expect(t.state().session).toEqual({ state: 'ready', email: 'danny@example.com' });
    expect(t.state().perms).toEqual({ canProgress: true, canEditPlan: false });
  });

  it('gives admins plan editing', async () => {
    const t = setup();
    t.login(admin);
    t.access(ACCESS);
    expect(t.state().perms).toEqual({ canProgress: true, canEditPlan: true });
    expect(await t.store.permissions()).toEqual({ canProgress: true, canEditPlan: true });
  });

  it('denies signed-in accounts that are not on the allowlist', () => {
    const t = setup();
    t.login({ uid: 'x', email: 'stranger@example.com', emailVerified: true });
    t.access(ACCESS);
    expect(t.state().session).toEqual({ state: 'denied', email: 'stranger@example.com' });
    expect(t.state().perms).toEqual({ canProgress: false, canEditPlan: false });
    expect(t.activeColl('goals')).toHaveLength(0);
  });

  it('denies when the rules refuse to read the allowlist', () => {
    const t = setup();
    t.login({ uid: 'x', email: 'stranger@example.com', emailVerified: true });
    t.accessError('permission-denied');
    expect(t.state().session?.state).toBe('denied');
  });

  it('keeps waiting (not denied) when offline with no cached allowlist', () => {
    const t = setup();
    t.login(member);
    t.access(null, true);
    expect(t.state().session?.state).toBe('checking');
  });

  it('drops data and stops listening when a member is removed while the page is open', () => {
    const t = setup();
    t.login(member);
    t.access(ACCESS);
    loadPlan(t);
    expect(t.state().goals).toHaveLength(2);
    t.access({ admins: ['owner@example.com'], members: [] });
    expect(t.state().session?.state).toBe('denied');
    expect(t.state().goals).toEqual([]);
    expect(t.activeColl('goals')).toHaveLength(0);
    expect(t.activeDoc('meta/milestones')).toHaveLength(0);
  });

  it('signing out clears the plan and returns to the gate', async () => {
    const t = setup();
    t.login(member);
    t.access(ACCESS);
    loadPlan(t);
    await t.store.signOut();
    expect(t.ctl.signedOut).toBe(1);
    expect(t.state().session?.state).toBe('signed-out');
    expect(t.state().goals).toEqual([]);
    expect(t.activeDoc('config/access')).toHaveLength(0);
  });

  it('reports a failed sign-in but ignores a closed popup', async () => {
    const t = setup();
    t.login(null);
    t.ctl.signInError = { code: 'auth/popup-closed-by-user' };
    await t.store.signIn();
    expect(t.state().session?.error).toBeUndefined();
    t.ctl.signInError = { code: 'auth/unauthorized-domain' };
    await t.store.signIn();
    expect(t.state().session).toEqual({ state: 'signed-out', error: 'Sign-in did not finish. Try again.' });
  });
});

describe('FirebaseStore: snapshots to PlanState', () => {
  it('subscribes once to goals and steps (ordered), progress and meta after access is granted', () => {
    const t = setup();
    t.login(member);
    t.access(ACCESS);
    t.access(ACCESS); // allowlist changes must not add listeners
    expect(t.activeColl('goals').map((l) => l.ordered)).toEqual([true]);
    expect(t.activeColl('steps').map((l) => l.ordered)).toEqual([true]);
    expect(t.activeColl('progress').map((l) => l.ordered)).toEqual([false]);
    expect(t.activeDoc('meta/milestones')).toHaveLength(1);
  });

  it('merges the four listeners into one PlanState', () => {
    const t = setup();
    t.login(member);
    t.access(ACCESS);
    expect(t.state().ready).toBe(false);
    loadPlan(t);
    const s = t.state();
    expect(s.status).toBe('live');
    expect(s.ready).toBe(true);
    expect(s.metaLoaded).toBe(true);
    expect(s.goals[0]).toEqual({ id: 'g1', order: 1, name: 'Danny Nguyen', goal: 'Spread the Word', meaning: 'm' });
    expect(s.steps.find((x) => x.id === 'g2s3')).toEqual({ id: 'g2s3', goal: 'g2', order: 3, t: 'g2 step 3' });
    expect(s.progress).toEqual({ g1s1: { goal: 'g1', at: '2026-10-27T10:00:00.000Z', by: 'u-danny' } });
    expect(s.meta).toEqual({ reached: { m1: '2026-10-30' }, celebrated: {} });
    const goals = deriveGoals(s);
    expect(goals[0].pct).toBe(20);
    expect(teamPercent(goals)).toBe(10);
  });

  it('is ready only after goals, steps and progress have all loaded', () => {
    const t = setup();
    t.login(member);
    t.access(ACCESS);
    t.coll('goals', {});
    t.coll('steps', {});
    expect(t.state().ready).toBe(false);
    t.coll('progress', {});
    expect(t.state().ready).toBe(true);
    expect(t.state().goals).toEqual([]); // empty plan: admins get "Set up the team plan"
  });

  it('a remote tick shows up in the next state', () => {
    const t = setup();
    t.login(member);
    t.access(ACCESS);
    loadPlan(t);
    t.coll('progress', { g1s1: { goal: 'g1', at: 'a', by: 'u-danny' }, g2s1: { goal: 'g2', at: 'b', by: 'u-irfan' } });
    expect(teamPercent(deriveGoals(t.state()))).toBe(20);
  });

  it('reports connecting, online and offline', () => {
    const t = setup();
    t.login(member);
    expect(t.state().connection).toBe('connecting');
    t.access(ACCESS, true);
    loadPlan(t);
    expect(t.state().connection).toBe('connecting'); // allowlist still from cache
    t.access(ACCESS, false);
    expect(t.state().connection).toBe('online');
    t.coll('progress', {}, true);
    expect(t.state().connection).toBe('offline');
    t.coll('progress', {}, false);
    expect(t.state().connection).toBe('online');
    t.net.off = true;
    t.net.fire();
    expect(t.state().connection).toBe('offline');
  });
});

describe('FirebaseStore: writes', () => {
  async function ready(user: FbUser = member) {
    const t = setup();
    t.login(user);
    t.access(ACCESS);
    loadPlan(t);
    return t;
  }

  it('ticks write {goal, at, by: uid}; undo deletes the doc', async () => {
    const t = await ready();
    await t.store.setStepDone('g1', 'g1s2', true);
    await t.store.setStepDone('g1', 'g1s2', false);
    expect(t.writes).toEqual([
      { op: 'set', path: 'progress/g1s2', data: { goal: 'g1', at: '2026-11-02T15:00:00.000Z', by: 'u-danny' }, merge: undefined },
      { op: 'delete', path: 'progress/g1s2', data: undefined, merge: undefined },
    ]);
  });

  it('milestones merge into meta/milestones', async () => {
    const t = await ready();
    await t.store.markReached({ m2: '2026-11-02' });
    await t.store.markCelebrated('m1');
    expect(t.writes).toEqual([
      { op: 'set', path: 'meta/milestones', data: { reached: { m2: '2026-11-02' } }, merge: true },
      { op: 'set', path: 'meta/milestones', data: { celebrated: { m1: '2026-11-02' } }, merge: true },
    ]);
  });

  it('plan edits use update and never send the id', async () => {
    const t = await ready(admin);
    await t.store.updateGoal('g1', { id: 'g1', goal: 'New' });
    await t.store.updateStep('g1s1', 'New step');
    expect(t.writes.map((w) => [w.op, w.path, w.data])).toEqual([['update', 'goals/g1', { goal: 'New' }], ['update', 'steps/g1s1', { t: 'New step' }]]);
  });

  it('seeding writes 4 goals, 20 steps and an empty meta when none exists', async () => {
    const t = setup();
    t.login(admin);
    t.access(ACCESS);
    t.coll('goals', {}); t.coll('steps', {}); t.coll('progress', {}); t.meta(null);
    await t.store.seedDefaultPlan();
    expect(t.writes.filter((w) => w.path.startsWith('goals/'))).toHaveLength(4);
    expect(t.writes.filter((w) => w.path.startsWith('steps/'))).toHaveLength(20);
    expect(t.writes.find((w) => w.path === 'meta/milestones')?.data).toEqual({ reached: {}, celebrated: {} });
  });

  it('runs writes to the same document one at a time', async () => {
    const t = await ready();
    const order: string[] = [];
    let release!: () => void;
    t.fb.set = vi.fn((path: string) => { order.push('start ' + path); return new Promise<void>((r) => { release = () => { order.push('end ' + path); r(); }; }); });
    const a = t.store.setStepDone('g1', 'g1s2', true);
    const b = t.store.setStepDone('g1', 'g1s2', true);
    await Promise.resolve(); await Promise.resolve();
    expect(order).toEqual(['start progress/g1s2']);
    release(); await a; await Promise.resolve(); await Promise.resolve();
    release(); await b;
    expect(order).toEqual(['start progress/g1s2', 'end progress/g1s2', 'start progress/g1s2', 'end progress/g1s2']);
  });

  it('maps permission-denied to a read-only error with the right scope', async () => {
    const t = await ready();
    t.ctl.failWith = 'permission-denied';
    await expect(t.store.setStepDone('g1', 'g1s2', true)).rejects.toEqual(new ReadOnlyError('progress'));
    await expect(t.store.markCelebrated('m1')).rejects.toEqual(new ReadOnlyError('progress'));
    await expect(t.store.updateGoal('g1', { goal: 'x' })).rejects.toEqual(new ReadOnlyError('plan'));
    await expect(t.store.updateStep('g1s1', 'x')).rejects.toEqual(new ReadOnlyError('plan'));
  });

  it('passes other errors through', async () => {
    const t = await ready();
    t.ctl.failWith = 'unavailable';
    await expect(t.store.setStepDone('g1', 'g1s2', true)).rejects.toEqual({ code: 'unavailable' });
  });

  it('refuses to tick when signed out', async () => {
    const t = setup();
    t.login(null);
    await expect(t.store.setStepDone('g1', 'g1s1', true)).rejects.toBeInstanceOf(ReadOnlyError);
    expect(t.writes).toEqual([]);
  });
});

describe('Firebase adapter selection', () => {
  const config = { apiKey: 'k', authDomain: 'p.firebaseapp.com', projectId: 'p', appId: 'a' };

  it('needs all four VITE_FIREBASE_* variables', () => {
    const env = { VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_AUTH_DOMAIN: 'p.firebaseapp.com', VITE_FIREBASE_PROJECT_ID: 'p', VITE_FIREBASE_APP_ID: 'a' };
    expect(firebaseConfigFromEnv(env)).toEqual(config);
    for (const k of Object.keys(env)) expect(firebaseConfigFromEnv({ ...env, [k]: '' })).toBeNull();
    expect(firebaseConfigFromEnv({})).toBeNull();
  });

  it('uses FirebaseStore when configured', async () => {
    const connect = vi.fn(async () => fakeFirebase().fb);
    expect(await createStore({}, config, connect)).toBeInstanceOf(FirebaseStore);
    expect(connect).toHaveBeenCalledWith(config);
  });

  it('falls back to LocalStore without config or when the SDK fails to load', async () => {
    expect(await createStore({}, null)).toBeInstanceOf(LocalStore);
    expect(await createStore({}, config, async () => { throw new Error('chunk failed'); })).toBeInstanceOf(LocalStore);
  });
});
