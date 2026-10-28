import { ClaudeArtifactStore, type ClaudeDb, type ClaudeUser } from './ClaudeArtifactStore';
import { LocalStore } from './LocalStore';
import type { PlanStore } from './PlanStore';

export interface HostWindow {
  claude?: { use?: (name: string) => Promise<unknown> };
}

/** Live store when the claude.ai runtime provides a db, otherwise this-device storage. */
export async function createStore(win: HostWindow | undefined = typeof window === 'undefined' ? undefined : (window as HostWindow)): Promise<PlanStore> {
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
  if (!db) return new LocalStore();
  return new ClaudeArtifactStore(db, user);
}
