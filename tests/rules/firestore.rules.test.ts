import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const OWNER = { uid: 'u-owner', email: 'owner@example.com' };
const DANNY = { uid: 'u-danny', email: 'danny@example.com' };
const IRFAN = { uid: 'u-irfan', email: 'Irfan@Example.com' }; // stored lowercase in the allowlist
const STRANGER = { uid: 'u-stranger', email: 'stranger@example.com' };

const as = (u: { uid: string; email: string }, verified = true): Firestore =>
  env.authenticatedContext(u.uid, { email: u.email, email_verified: verified }).firestore() as unknown as Firestore;
const anon = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ascent',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'config/access'), { admins: ['owner@example.com'], members: ['danny@example.com', 'irfan@example.com'] });
    await setDoc(doc(db, 'goals/g1'), { order: 1, name: 'Danny Nguyen', goal: 'Spread the Word', meaning: 'People know' });
    await setDoc(doc(db, 'steps/g1s1'), { goal: 'g1', order: 1, t: 'Message guide is written' });
    await setDoc(doc(db, 'steps/g1s2'), { goal: 'g1', order: 2, t: 'Launch posts are made' });
    await setDoc(doc(db, 'meta/milestones'), { reached: {}, celebrated: {} });
  });
});

const tick = (db: Firestore, stepId: string, by: string, extra: object = {}) =>
  setDoc(doc(db, 'progress/' + stepId), { goal: stepId.split('s')[0], at: '2026-11-02T15:00:00.000Z', by, ...extra });

describe('signed-out visitors', () => {
  it('cannot read or write anything', async () => {
    const db = anon();
    await assertFails(getDoc(doc(db, 'goals/g1')));
    await assertFails(getDocs(collection(db, 'steps')));
    await assertFails(getDocs(collection(db, 'progress')));
    await assertFails(getDoc(doc(db, 'meta/milestones')));
    await assertFails(getDoc(doc(db, 'config/access')));
    await assertFails(tick(db, 'g1s1', 'nobody'));
    await assertFails(setDoc(doc(db, 'meta/milestones'), { reached: { m1: '2026-11-02' } }, { merge: true }));
  });
});

describe('signed-in accounts not on the allowlist', () => {
  it('cannot read or write anything', async () => {
    const db = as(STRANGER);
    await assertFails(getDoc(doc(db, 'goals/g1')));
    await assertFails(getDocs(collection(db, 'progress')));
    await assertFails(getDoc(doc(db, 'config/access')));
    await assertFails(tick(db, 'g1s1', STRANGER.uid));
    await assertFails(updateDoc(doc(db, 'goals/g1'), { goal: 'Hijacked' }));
    await assertFails(setDoc(doc(db, 'config/access'), { admins: ['stranger@example.com'], members: [] }));
  });

  it('listed emails are refused when the email is not verified', async () => {
    const db = as(DANNY, false);
    await assertFails(getDoc(doc(db, 'goals/g1')));
    await assertFails(tick(db, 'g1s1', DANNY.uid));
  });

  it('nobody gets in while config/access is missing', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => deleteDoc(doc(ctx.firestore() as unknown as Firestore, 'config/access')));
    await assertFails(getDoc(doc(as(OWNER), 'goals/g1')));
  });
});

describe('members', () => {
  it('can read the plan and the allowlist (email match ignores case)', async () => {
    for (const db of [as(DANNY), as(IRFAN)]) {
      await assertSucceeds(getDoc(doc(db, 'goals/g1')));
      await assertSucceeds(getDocs(collection(db, 'steps')));
      await assertSucceeds(getDocs(collection(db, 'progress')));
      await assertSucceeds(getDoc(doc(db, 'meta/milestones')));
      await assertSucceeds(getDoc(doc(db, 'config/access')));
    }
  });

  it('can tick and untick steps', async () => {
    const db = as(DANNY);
    await assertSucceeds(tick(db, 'g1s1', DANNY.uid));
    await assertSucceeds(tick(db, 'g1s2', DANNY.uid));
    await assertSucceeds(deleteDoc(doc(db, 'progress/g1s2')));
  });

  it('cannot spoof who ticked a step', async () => {
    await assertFails(tick(as(DANNY), 'g1s1', IRFAN.uid));
  });

  it('cannot add extra fields or mismatch the goal on a progress doc', async () => {
    const db = as(DANNY);
    await assertFails(tick(db, 'g1s1', DANNY.uid, { points: 10 }));
    await assertFails(setDoc(doc(db, 'progress/g1s1'), { goal: 'g2', at: '2026-11-02T15:00:00.000Z', by: DANNY.uid }));
    await assertFails(setDoc(doc(db, 'progress/g1s1'), { goal: 'g1', by: DANNY.uid }));
    await assertFails(tick(db, 'not-a-step', DANNY.uid));
  });

  it('cannot skip ahead: step 2 needs step 1 done', async () => {
    const db = as(DANNY);
    await assertFails(tick(db, 'g1s2', DANNY.uid));
    await assertSucceeds(tick(db, 'g1s1', DANNY.uid));
    await assertSucceeds(tick(db, 'g1s2', DANNY.uid));
  });

  it('can mark milestones reached and celebrated (merge)', async () => {
    const db = as(DANNY);
    await assertSucceeds(setDoc(doc(db, 'meta/milestones'), { reached: { m1: '2026-11-02' } }, { merge: true }));
    await assertSucceeds(setDoc(doc(db, 'meta/milestones'), { celebrated: { m1: '2026-11-03' } }, { merge: true }));
  });

  it('cannot put anything else into meta', async () => {
    const db = as(DANNY);
    await assertFails(setDoc(doc(db, 'meta/milestones'), { points: { danny: 5 } }, { merge: true }));
    await assertFails(setDoc(doc(db, 'meta/milestones'), { reached: { m9: '2026-11-02' } }, { merge: true }));
    await assertFails(setDoc(doc(db, 'meta/milestones'), { reached: { m1: 'yesterday' } }, { merge: true }));
    await assertFails(setDoc(doc(db, 'meta/other'), { reached: {} }));
    await assertFails(deleteDoc(doc(db, 'meta/milestones')));
  });

  it('cannot edit goals, steps or the allowlist', async () => {
    const db = as(DANNY);
    await assertFails(updateDoc(doc(db, 'goals/g1'), { goal: 'Changed' }));
    await assertFails(setDoc(doc(db, 'goals/g9'), { order: 9, name: 'X', goal: 'X', meaning: 'X' }));
    await assertFails(deleteDoc(doc(db, 'goals/g1')));
    await assertFails(updateDoc(doc(db, 'steps/g1s1'), { t: 'Changed' }));
    await assertFails(setDoc(doc(db, 'config/access'), { admins: ['danny@example.com'], members: [] }));
  });

  it('cannot write to other collections', async () => {
    await assertFails(setDoc(doc(as(DANNY), 'scores/danny'), { points: 100 }));
  });
});

describe('admins', () => {
  it('can edit goals and steps', async () => {
    const db = as(OWNER);
    await assertSucceeds(updateDoc(doc(db, 'goals/g1'), { goal: 'Spread the Word Far' }));
    await assertSucceeds(updateDoc(doc(db, 'steps/g1s1'), { t: 'Message guide v2' }));
    await assertSucceeds(setDoc(doc(db, 'goals/g2'), { order: 2, name: 'Irfan Pasha', goal: 'A Smooth First Step', meaning: 'Sign up works' }));
    await assertSucceeds(setDoc(doc(db, 'steps/g2s1'), { goal: 'g2', order: 1, t: 'Sign-up works' }));
  });

  it('can seed an empty plan, including meta', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => deleteDoc(doc(ctx.firestore() as unknown as Firestore, 'meta/milestones')));
    await assertSucceeds(setDoc(doc(as(OWNER), 'meta/milestones'), { reached: {}, celebrated: {} }));
  });

  it('can update the allowlist', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'config/access'), { admins: ['owner@example.com'], members: ['danny@example.com', 'irfan@example.com', 'kevin@example.com'] }));
  });

  it('still get shape and size checks', async () => {
    const db = as(OWNER);
    await assertFails(updateDoc(doc(db, 'goals/g1'), { points: 5 }));
    await assertFails(updateDoc(doc(db, 'goals/g1'), { goal: 'x'.repeat(121) }));
    await assertFails(updateDoc(doc(db, 'steps/g1s1'), { t: 42 }));
    await assertFails(setDoc(doc(db, 'config/access'), { admins: 'owner@example.com', members: [] }));
  });

  it('can tick steps too', async () => {
    await assertSucceeds(tick(as(OWNER), 'g1s1', OWNER.uid));
  });
});
