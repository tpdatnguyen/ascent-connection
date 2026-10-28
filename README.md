# The Ascent (React)

React + TypeScript plan tracker for Kickoff Day, Monday, November 30, 2026: four goals, five
ordered steps each, three team milestones. Deployed on Vercel (ascent-connection.vercel.app).

## Run

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npm run test:rules   # Firestore security-rules tests in the emulator (needs Java 21)
npm run build        # production build in dist/
npm run build:single # one self-contained dist/index.html (claude.ai Artifact)
```

With no `VITE_FIREBASE_*` variables the app runs in **LocalStore** mode: the plan is kept in
this browser only and the header says "Saved on this device only". Local development and
Vercel previews without the variables work with zero setup.

## Live shared plan: one-time setup (done by the owner)

1. **Create a Firebase project** at https://console.firebase.google.com (the free Spark plan is
   enough). Under Project settings → Your apps, add a **Web app** and keep its config
   (`apiKey`, `authDomain`, `projectId`, `appId`).
2. **Authentication → Sign-in method → Google → Enable.**
3. **Authentication → Settings → Authorized domains**: add `ascent-connection.vercel.app`
   (and any custom domain).
4. **Firestore Database → Create database** in production mode. Then open **Rules**, paste
   the contents of `firestore.rules` and **Publish**.
5. **Create the allowlist**: in Firestore → Data, start a collection `config`, document ID
   `access`, with two fields of type *array*:
   - `admins`: your own Google email
   - `members`: your teammates' Google emails

   Write every email in **lowercase**. Nobody, including you, can open the plan until this
   document exists.
6. **Vercel** → Project → Settings → Environment Variables: add `VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` for
   **Production and Preview**, then **Redeploy** (variables are read at build time).
7. Open the site, click **Open the Plan**, **Continue with Google** as the owner, then
   **Set up the team plan**. That writes the default 4 goals and 20 steps once.

To add or remove someone later, edit the `admins` / `members` arrays of `config/access`.

## How it works

- **Storage adapters.** Components only talk to the `PlanStore` interface
  (`src/store/PlanStore.ts`). `createStore` picks one at startup: claude.ai Artifact db
  (`ClaudeArtifactStore`) when `window.claude` provides one, Firebase (`FirebaseStore`) when all
  four `VITE_FIREBASE_*` variables are set, otherwise `LocalStore`.
- **Firebase is lazy-loaded.** The SDK (`src/store/firebase/backend.ts`) is fetched with
  `import()` only when Firebase is configured, so the LocalStore build stays small.
- **Sign-in and access.** After "Open the Plan", Firebase mode shows a Google sign-in gate. Once
  signed in, the app reads `config/access`: admins can tick steps and edit the plan, members
  can tick steps and celebrate milestones, and anyone else sees "You do not have access."
- **The rules are the real protection** (`firestore.rules`). They require a verified Google email
  on the allowlist for every read and write. They check document shapes and sizes, require
  `progress.by` to be the signer's uid, and only accept step *n* once step *n−1* is done.
  `tests/rules` covers signed-out, non-listed, member and admin access in the emulator.
- **Live updates.** One Firestore listener each on goals and steps (ordered by `order`),
  progress and `meta/milestones`, merged into one `PlanState`. The UI re-renders at most once
  per animation frame. When someone else's tick reaches a milestone, everyone gets the toast.
- **Offline.** Firestore's persistent local cache keeps ticks made during a connection drop
  and syncs them later. The badge shows "Connecting...", "Offline, changes will sync", "Live ·
  everyone sees updates" or "View only".
- **Derived values** (percent, counts, last update, team percent) are always computed in
  `src/domain/selectors.ts` and never stored.

### Data model

```
goals/{goalId}     { order:number, name:string, goal:string, meaning:string }
steps/{stepId}     { goal:goalId, order:number, t:string }        // g1s1 ... g4s5
progress/{stepId}  { goal:goalId, at:ISO-8601, by:uid }            // exists only while done
meta/milestones    { reached:{ m1?, m2?, m3? }, celebrated:{ m1?, m2?, m3? } }  // YYYY-MM-DD
config/access      { admins:string[], members:string[] }          // lowercase emails
```

## Layout

```
src/
  domain/      pure logic: types, plan constants, dates (weekOf), selectors
  store/       PlanStore, LocalStore, FirebaseStore (+ firebase/ SDK facade),
               ClaudeArtifactStore on DocDbStore, createStore
  hooks/       usePlan (store -> React, one render per frame), useToast
  components/  Splash, AuthGate, PlanScreen, TeamProgress, ViewTabs, CardsView, GoalCard,
               TableView, TimelineView, Peek, Mountain, MilestoneList, RecentProgress, Toast
tests/rules/   Firestore security-rules tests (emulator)
```

## Adding another storage adapter

Implement `PlanStore` in a new file under `src/store/`, keep backend SDK types inside it, and
choose it in `createStore.ts`. Reject refused writes with `new ReadOnlyError('plan' | 'progress')`
so the UI hides the matching controls. If the backend needs sign-in, fill
`PlanState.session` and implement `signIn` / `signOut`, and `AuthGate` takes care of the
screens. `src/store/FirebaseStore.test.ts` shows how to test an adapter with a fake backend.
