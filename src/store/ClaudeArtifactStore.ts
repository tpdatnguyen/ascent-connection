import type { Permissions } from '../domain/types';
import { DocDbStore, type DocDb } from './DocDbStore';

/** window.claude.use('db') already has the DocDb shape. */
export type ClaudeDb = DocDb;
export interface ClaudeUser {
  can(permission: string): Promise<boolean>;
  canEdit(): Promise<boolean>;
}

async function claudePermissions(user: ClaudeUser | null): Promise<Permissions> {
  const p = { canProgress: true, canEditPlan: true };
  try {
    if (user) {
      if ((await user.can('data.write')) === false) p.canProgress = false;
      if ((await user.canEdit()) === false) p.canEditPlan = false;
    }
  } catch {
    /* unknown permissions: allow and let the backend refuse */
  }
  return p;
}

/** Live shared plan backed by a claude.ai Artifact's db. */
export class ClaudeArtifactStore extends DocDbStore {
  constructor(db: ClaudeDb, user: ClaudeUser | null, now?: () => Date) {
    super(db, { readOnlyCodes: ['invalid_argument'], revokedCode: 'revoked', permissions: () => claudePermissions(user), now });
  }
}
