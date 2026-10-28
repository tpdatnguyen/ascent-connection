import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { FirebaseConfig } from './config';
import type { FbBackend, FbError } from './types';

const toError = (e: any): FbError => ({ code: e?.code, message: e?.message });

/** The real Firebase backend. This module is only ever loaded with import(). */
export function createFirebaseBackend(config: FirebaseConfig): FbBackend {
  const app = initializeApp(config);
  const auth = getAuth(app);
  let db: Firestore;
  try {
    // Offline persistence: ticks made during a short connection drop are kept and synced later.
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = getFirestore(app);
  }

  return {
    onAuth: (cb) => onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email, emailVerified: u.emailVerified } : null)),
    signIn: async () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await signInWithPopup(auth, provider);
      } catch (e: any) {
        if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw toError(e);
      }
    },
    signOut: () => signOut(auth),
    watchCollection: (name, ordered, next, error) => {
      const ref = collection(db, name);
      return onSnapshot(
        ordered ? query(ref, orderBy('order')) : ref,
        { includeMetadataChanges: true },
        (s) => next(s.docs.map((d) => ({ id: d.id, data: d.data() })), { fromCache: s.metadata.fromCache }),
        (e) => error(toError(e)),
      );
    },
    watchDoc: (path, next, error) =>
      onSnapshot(
        doc(db, path),
        { includeMetadataChanges: true },
        (s) => next(s.exists() ? { id: s.id, data: s.data() } : null, { fromCache: s.metadata.fromCache }),
        (e) => error(toError(e)),
      ),
    set: (path, data, merge) => setDoc(doc(db, path), data, { merge: !!merge }),
    update: (path, data) => updateDoc(doc(db, path), data as { [field: string]: any }),
    remove: (path) => deleteDoc(doc(db, path)),
  };
}
