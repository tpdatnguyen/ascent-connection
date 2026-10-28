/* The slice of Firebase that FirebaseStore uses, as plain types. The real
   implementation (backend.ts) is loaded lazily; tests use a fake. */

export type Unsub = () => void;

export interface FbUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

export interface FbDoc {
  id: string;
  data: Record<string, any>;
}

export interface FbSnapMeta {
  /** true while the data comes from the local cache, not the server */
  fromCache: boolean;
}

export interface FbError {
  code?: string;
  message?: string;
}

export interface FbBackend {
  onAuth(cb: (user: FbUser | null) => void): Unsub;
  /** Google sign-in. Rejects with an FbError (code 'auth/...') on failure. */
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  watchCollection(name: string, orderByOrder: boolean, next: (docs: FbDoc[], meta: FbSnapMeta) => void, error: (e: FbError) => void): Unsub;
  watchDoc(path: string, next: (doc: FbDoc | null, meta: FbSnapMeta) => void, error: (e: FbError) => void): Unsub;
  set(path: string, data: object, merge?: boolean): Promise<void>;
  update(path: string, data: object): Promise<void>;
  remove(path: string): Promise<void>;
}
