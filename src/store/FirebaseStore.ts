import { DocDbStore, type DocDb } from './DocDbStore';

export interface FirebaseConfig {
  apiKey: string;
  projectId: string;
  appId: string;
  authDomain?: string;
}

/** Reads VITE_FIREBASE_* build variables; null when they are not set. */
export function firebaseConfigFromEnv(env: Record<string, string | undefined> = import.meta.env): FirebaseConfig | null {
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const appId = env.VITE_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !appId) return null;
  return { apiKey, projectId, appId, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com` };
}

/** Adapts Firestore to the DocDb shape. The SDK is loaded only when Firebase is configured. */
export async function connectFirestore(config: FirebaseConfig): Promise<DocDb> {
  const [{ initializeApp }, fs] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
  const db = fs.getFirestore(initializeApp(config));
  return {
    collection: (name) => ({
      onSnapshot: (next, error) => fs.onSnapshot(fs.collection(db, name), (s) => next({ docs: s.docs.map((d) => ({ id: d.id, data: () => d.data() })) }), error),
    }),
    doc: (path) => {
      const ref = fs.doc(db, path);
      return {
        set: (d) => fs.setDoc(ref, d),
        update: (d) => fs.updateDoc(ref, d),
        delete: () => fs.deleteDoc(ref),
        onSnapshot: (next, error) => fs.onSnapshot(ref, (s) => next({ id: s.id, exists: s.exists(), data: () => s.data() }), error),
      };
    },
  };
}

/**
 * Live shared plan in Cloud Firestore. There is no sign-in: what people may
 * change is decided by the Firestore security rules, and a refused write
 * (permission-denied) hides the matching controls, like on claude.ai.
 */
export class FirebaseStore extends DocDbStore {
  constructor(db: DocDb, now?: () => Date) {
    super(db, {
      readOnlyCodes: ['permission-denied'],
      permissions: async () => ({ canProgress: true, canEditPlan: true }),
      now,
    });
  }
}
