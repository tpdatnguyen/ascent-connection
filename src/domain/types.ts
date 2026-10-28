// Database documents. These mirror the live collections exactly:
//   goals/{goalId}     { order, name, goal, meaning }
//   steps/{stepId}     { goal, order, t }
//   progress/{stepId}  { goal, at }   (exists only while the step is done)
//   meta/milestones    { reached, celebrated }
export interface Goal {
  id: string;
  order: number;
  name: string;
  goal: string;
  meaning: string;
}

export interface Step {
  id: string;
  goal: string;
  order: number;
  t: string;
}

export interface ProgressDoc {
  goal: string;
  at: string; // ISO-8601
  by?: string; // uid of who ticked it (Firebase only)
}

export type MilestoneKey = 'm1' | 'm2' | 'm3';

export interface Meta {
  reached: Partial<Record<MilestoneKey, string>>; // YYYY-MM-DD
  celebrated: Partial<Record<MilestoneKey, string>>; // YYYY-MM-DD
}

export type StoreStatus = 'loading' | 'live' | 'local';

/** Sign-in state for backends that require it (absent otherwise). */
export interface Session {
  state: 'checking' | 'signed-out' | 'denied' | 'ready';
  email?: string;
  /** last sign-in problem to show on the gate */
  error?: string;
}

export type Connection = 'connecting' | 'online' | 'offline';

export interface Permissions {
  canProgress: boolean;
  canEditPlan: boolean;
}

export interface PlanState {
  status: StoreStatus;
  goals: Goal[];
  steps: Step[];
  progress: Record<string, ProgressDoc>;
  meta: Meta;
  /** goals, steps and progress have all loaded at least once */
  ready: boolean;
  /** meta/milestones has loaded (or failed) at least once */
  metaLoaded: boolean;
  /** the backend revoked write access while the page was open */
  revoked: boolean;
  /** present when the backend needs sign-in */
  session?: Session;
  /** present when the backend reports its connection; absent means connected */
  connection?: Connection;
  /** present when permissions can change while the page is open (e.g. after sign-in) */
  perms?: Permissions;
}

export interface Milestone {
  key: MilestoneKey;
  name: string;
  thr: number;
  due: string; // YYYY-MM-DD
  dueLabel: string;
  reward: string;
}
