import { describe, expect, it, vi } from 'vitest';
import type { PlanState } from '../domain/types';
import { ClaudeArtifactStore } from './ClaudeArtifactStore';
import { createStore } from './createStore';
import { LOCAL_KEY, LocalStore, type KeyValue } from './LocalStore';
import { ReadOnlyError } from './PlanStore';

function memoryKV(init: Record<string, string> = {}): KeyValue & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}

/** Tiny in-memory imitation of window.claude.use('db'). */
function mockDb(opts: { failWith?: string } = {}) {
  const docs: Record<string, Record<string, any>> = {};
  const listeners: { path: string; fn: (s: any) => void }[] = [];
  const calls: string[] = [];
  const notify = () => listeners.forEach(({ path, fn }) => {
    if (path.includes('/')) {
      const [c, id] = path.split('/');
      const d = docs[c]?.[id];
      fn({ id, exists: !!d, data: () => d });
    } else {
      fn({ docs: Object.entries(docs[path] || {}).map(([id, d]) => ({ id, data: () => d })) });
    }
  });
  const write = (path: string, op: string, fn: () => void) => {
    calls.push(op + ' ' + path);
    if (opts.failWith) return Promise.reject({ code: opts.failWith });
    fn();
    notify();
    return Promise.resolve();
  };
  const db = {
    collection: (name: string) => ({ onSnapshot: (fn: (s: any) => void) => { listeners.push({ path: name, fn }); notify(); } }),
    doc: (path: string) => {
      const [c, id] = path.split('/');
      return {
        set: (d: object) => write(path, 'set', () => { (docs[c] ||= {})[id] = { ...d }; }),
        update: (d: object) => write(path, 'update', () => { (docs[c] ||= {})[id] = { ...docs[c][id], ...d }; }),
        delete: () => write(path, 'delete', () => { delete docs[c]?.[id]; }),
        onSnapshot: (fn: (s: any) => void) => { listeners.push({ path, fn }); notify(); },
      };
    },
  };
  return { db, docs, calls, listeners };
}

const last = (store: { subscribe(fn: (s: PlanState) => void): () => void }) => {
  let s!: PlanState;
  store.subscribe((x) => (s = x))();
  return s;
};

describe('LocalStore', () => {
  it('seeds the default plan when storage is empty', () => {
    const s = last(new LocalStore(memoryKV()));
    expect(s.status).toBe('local');
    expect(s.ready).toBe(true);
    expect(s.goals).toHaveLength(4);
    expect(s.steps.map((x) => x.id)).toContain('g4s5');
  });

  it('works with no storage at all', async () => {
    const store = new LocalStore(null);
    await store.setStepDone('g1', 'g1s1', true);
    expect(last(store).progress.g1s1.goal).toBe('g1');
  });

  it('persists ticks, undo, plan edits and milestones in the original format', async () => {
    const kv = memoryKV();
    const now = new Date(2026, 10, 9, 15, 0);
    const store = new LocalStore(kv, () => now);
    await store.setStepDone('g1', 'g1s1', true);
    await store.setStepDone('g1', 'g1s2', true);
    await store.setStepDone('g1', 'g1s2', false);
    await store.updateGoal('g1', { goal: 'New title' });
    await store.updateStep('g1s3', 'New step');
    await store.markReached({ m1: '2026-11-09' });
    await store.markCelebrated('m1');
    const saved = JSON.parse(kv.data[LOCAL_KEY]);
    expect(Object.keys(saved.progress).sort()).toEqual(['g1s1', 'g2s1', 'g3s1', 'g4s1']); // g1s1 re-ticked; the rest are the seed
    expect(saved.progress.g1s1).toEqual({ goal: 'g1', at: now.toISOString() });
    expect(saved.goals[0].goal).toBe('New title');
    expect(saved.steps.find((s: any) => s.id === 'g1s3').t).toBe('New step');
    expect(saved.meta).toEqual({ reached: { m1: '2026-11-09' }, celebrated: { m1: '2026-11-09' } });

    // a new store reads it back
    const again = last(new LocalStore(kv));
    expect(again.goals[0].goal).toBe('New title');
    expect(again.progress.g1s1).toBeTruthy();
  });

  it('ignores corrupt storage', () => {
    expect(last(new LocalStore(memoryKV({ [LOCAL_KEY]: '{oops' }))).goals).toHaveLength(4);
  });

  it('notifies subscribers and stops after unsubscribe', async () => {
    const store = new LocalStore(memoryKV());
    const fn = vi.fn();
    const off = store.subscribe(fn);
    await store.setStepDone('g1', 'g1s1', true);
    off();
    await store.setStepDone('g1', 'g1s2', true);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('createStore', () => {
  it('uses LocalStore without window.claude or Firebase config', async () => {
    expect(await createStore(undefined, null)).toBeInstanceOf(LocalStore);
    expect(await createStore({}, null)).toBeInstanceOf(LocalStore);
  });

  it('uses LocalStore when the runtime has no db', async () => {
    expect(await createStore({ claude: { use: async () => null } }, null)).toBeInstanceOf(LocalStore);
    expect(await createStore({ claude: { use: async () => { throw new Error('no'); } } }, null)).toBeInstanceOf(LocalStore);
  });

  it('prefers the claude.ai db over Firebase', async () => {
    const { db } = mockDb();
    const connect = vi.fn();
    const store = await createStore({ claude: { use: async (n: string) => (n === 'db' ? db : null) } }, { apiKey: 'k', authDomain: 'd', projectId: 'p', appId: 'a' }, connect);
    expect(store).toBeInstanceOf(ClaudeArtifactStore);
    expect(connect).not.toHaveBeenCalled();
  });

  it('uses ClaudeArtifactStore when window.claude.use resolves a db', async () => {
    const { db } = mockDb();
    const user = { can: async () => true, canEdit: async () => false };
    const use = vi.fn(async (name: string) => (name === 'db' ? db : user));
    const store = await createStore({ claude: { use } }, null);
    expect(store).toBeInstanceOf(ClaudeArtifactStore);
    expect(use.mock.calls.map((c) => c[0])).toEqual(['db', 'user']);
    expect(await store.permissions()).toEqual({ canProgress: true, canEditPlan: false });
  });
});

describe('ClaudeArtifactStore', () => {
  it('subscribes once per collection and maps snapshots to plan state', async () => {
    const m = mockDb();
    const store = new ClaudeArtifactStore(m.db, null);
    expect(m.listeners.map((l) => l.path)).toEqual(['goals', 'steps', 'progress', 'meta/milestones']);
    let s = last(store);
    expect(s.status).toBe('live');
    expect(s.ready).toBe(true);
    expect(s.goals).toEqual([]);

    await store.seedDefaultPlan();
    s = last(store);
    expect(s.goals).toHaveLength(4);
    expect(s.steps).toHaveLength(20);
    expect(s.goals[0]).toEqual({ id: 'g1', order: 1, name: 'Danny Nguyen', goal: 'Spread the Word', meaning: 'People in Springfield know about the kickoff' });
    expect(Object.keys(s.progress).sort()).toEqual(['g1s1', 'g2s1', 'g3s1', 'g4s1']);
    expect(s.progress.g1s1).toEqual({ goal: 'g1', at: expect.any(String) });
    expect(m.listeners).toHaveLength(4);
  });

  it('writes progress docs and deletes them to undo', async () => {
    const m = mockDb();
    const store = new ClaudeArtifactStore(m.db, null, () => new Date('2026-10-27T12:00:00.000Z'));
    await store.setStepDone('g1', 'g1s1', true);
    expect(m.docs.progress.g1s1).toEqual({ goal: 'g1', at: '2026-10-27T12:00:00.000Z' });
    await store.setStepDone('g1', 'g1s1', false);
    expect(m.docs.progress.g1s1).toBeUndefined();
  });

  it('creates meta on first write, then updates it without dropping earlier keys', async () => {
    const m = mockDb();
    const store = new ClaudeArtifactStore(m.db, null);
    await store.markReached({ m1: '2026-11-05' });
    await store.markReached({ m2: '2026-11-20' });
    expect(m.calls).toEqual(['set meta/milestones', 'update meta/milestones']);
    expect(m.docs.meta.milestones).toEqual({ reached: { m1: '2026-11-05', m2: '2026-11-20' }, celebrated: {} });
  });

  it('runs writes to the same document one at a time', async () => {
    const m = mockDb();
    const order: string[] = [];
    const orig = m.db.doc;
    m.db.doc = (path: string) => {
      const ref = orig(path);
      return { ...ref, set: (d: object) => { order.push('start'); return new Promise<void>((r) => setTimeout(() => { order.push('end'); r(ref.set(d) as any); }, 5)); } };
    };
    const store = new ClaudeArtifactStore(m.db, null);
    await Promise.all([store.setStepDone('g1', 'g1s1', true), store.setStepDone('g1', 'g1s1', true)]);
    expect(order).toEqual(['start', 'end', 'start', 'end']);
  });

  it('maps invalid_argument to a read-only error with the right scope', async () => {
    const store = new ClaudeArtifactStore(mockDb({ failWith: 'invalid_argument' }).db, null);
    await expect(store.setStepDone('g1', 'g1s1', true)).rejects.toEqual(new ReadOnlyError('progress'));
    await expect(store.updateStep('g1s1', 'x')).rejects.toMatchObject({ scope: 'plan' });
    await expect(store.updateGoal('g1', { goal: 'x' })).rejects.toMatchObject({ scope: 'plan' });
    await expect(store.markCelebrated('m1')).rejects.toMatchObject({ scope: 'progress' });
  });

  it('passes other errors through and keeps the queue moving', async () => {
    const m = mockDb({ failWith: 'unavailable' });
    const store = new ClaudeArtifactStore(m.db, null);
    await expect(store.setStepDone('g1', 'g1s1', true)).rejects.toEqual({ code: 'unavailable' });
    await expect(store.setStepDone('g1', 'g1s1', true)).rejects.toEqual({ code: 'unavailable' });
    expect(m.calls).toHaveLength(2);
  });

  it('reads permissions from user.can and user.canEdit', async () => {
    const { db } = mockDb();
    const viewer = new ClaudeArtifactStore(db, { can: async () => false, canEdit: async () => false });
    expect(await viewer.permissions()).toEqual({ canProgress: false, canEditPlan: false });
    const broken = new ClaudeArtifactStore(db, { can: async () => { throw new Error(); }, canEdit: async () => true });
    expect(await broken.permissions()).toEqual({ canProgress: true, canEditPlan: true });
  });
});
