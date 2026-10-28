import { ClaudeArtifactStore, type ClaudeDb, type ClaudeUser } from './ClaudeArtifactStore';
import type { DocDb } from './DocDbStore';
import { connectFirestore, firebaseConfigFromEnv, FirebaseStore, type FirebaseConfig } from './FirebaseStore';
import { LocalStore } from './LocalStore';
import type { PlanStore } from './PlanStore';

export interface HostWindow {
  claude?: { use?: (name: string) => Promise<unknown> };
}

/**
 * Picks the backend at startup:
 * 1. claude.ai Artifact db, when window.claude.use resolves one;
 * 2. Firebase, when VITE_FIREBASE_* variables were set at build time (e.g. on Vercel);
 * 3. this-device storage otherwise.
 */
export async function createStore(
  win: HostWindow | undefined = typeof window === 'undefined' ? undefined : (window as HostWindow),
  firebase: FirebaseConfig | null = firebaseConfigFromEnv(),
  connect: (c: FirebaseConfig) => Promise<DocDb> = connectFirestore,
): Promise<PlanStore> {
  let db: ClaudeDb | null = null;
  let user: ClaudeUser | null = null;
  try {
    if (win?.claude?.use) {
      db = ((await win.claude.use('db')) as ClaudeDb) || null;
      user = ((await win.claude.use('user')) as ClaudeUser) || null;
    }
  } catch {
    db = null;
  }
  if (db) return new ClaudeArtifactStore(db, user);
  if (firebase) {
    try {
      return new FirebaseStore(await connect(firebase));
    } catch {
      /* SDK failed to load or bad config: keep working on this device */
    }
  }
  return new LocalStore();
}
