# The Ascent (React)

React + TypeScript version of `../ascent-scoreboard/index.html`: the 6-week plan tracker
for Kickoff Day, Monday, December 7, 2026. Same look, copy, data and rules as the original page.

## Run

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # Vitest unit tests
npm run build        # normal multi-file build in dist/
npm run build:single # one self-contained dist/index.html (JS + CSS inlined)
```

With no setup the app uses **LocalStore** (this browser's `localStorage`, key
`ascent_plan_local_v2`, the same key and format as the single-file page, so existing data carries over).

## Publish as a claude.ai Artifact

Run `npm run build:single` and publish `dist/index.html`. React is bundled into the file. The
only external request is the Google Fonts stylesheet. When the page runs inside an Artifact
that provides `window.claude.use('db')`, the app switches to **ClaudeArtifactStore**
automatically, so everyone sees live updates.

## Layout

```
src/
  domain/      pure logic, no React: types, plan constants, dates (weekOf), selectors
               (deriveGoals, teamPercent, canTick, milestonesCrossed, milestoneStatus, ...)
  store/       PlanStore interface, LocalStore, ClaudeArtifactStore, createStore (adapter choice)
  hooks/       usePlan (store -> React, one render per animation frame), useToast
  components/  Splash, PlanScreen, TeamProgress, ViewTabs, CardsView, GoalCard, TableView,
               TimelineView, Peek, Mountain, MilestoneList, RecentProgress, Toast
  styles.css   the original stylesheet, same class names
```

Derived values (done count, percent, last update, team percent) are always computed in
`domain/selectors.ts` and never stored.

## Adding another storage adapter

1. Create `src/store/MyBackendStore.ts` with a class that `implements PlanStore`
   (`src/store/PlanStore.ts`). It must keep the data model below and:
   - call `subscribe` listeners with a full `PlanState` right away and after every change
     (`status: 'live'`, `ready` once goals, steps and progress have loaded);
   - make `setStepDone(…, true)` write `progress/{stepId} = { goal, at: ISO }` and
     `setStepDone(…, false)` delete that document;
   - merge `markReached` / `markCelebrated` into `meta/milestones` without dropping existing keys;
   - reject with `new ReadOnlyError('plan' | 'progress')` when the backend refuses a write for
     permission reasons (the UI then hides the controls and shows the usual message);
   - optionally implement `seedDefaultPlan()` (uses `defaultPlan()` from `domain/plan.ts`).
2. Keep backend SDK types inside that file. Components only see `PlanStore` and the
   domain types.
3. Choose it in `src/store/createStore.ts`.
4. Add tests next to `src/store/store.test.ts` (it has an in-memory db mock you can copy).

### Data model

```
goals/{goalId}     { order:number, name:string, goal:string, meaning:string }
steps/{stepId}     { goal:goalId, order:number, t:string }     // g1s1 ... g4s5
progress/{stepId}  { goal:goalId, at:ISO-8601 }                 // exists only while done
meta/milestones    { reached:{ m1?, m2?, m3? }, celebrated:{ m1?, m2?, m3? } }  // YYYY-MM-DD
```

Goals and steps are editor-only. Progress and meta are writable by contributors.
