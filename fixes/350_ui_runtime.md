# 350 · LANE U1 — UI / loading / runtime debug (rt350-ui)

Branch `rt350-ui`, base `3436866`. Isolated worktree
`C:\Users\mnril\AppData\Local\Temp\rt_final_wt\ui` only; the concurrent
`RapidTool Main` tree was never touched. Windows / PowerShell / Node 22.

## Flows exercised (real browser, Playwright chromium)

Served two ways: `npm run build` + `npm run preview` (`127.0.0.1:8081`) and
`npm run dev` (`127.0.0.1:8080`, `PORT=8080`). Fresh load, create → run screen,
every primary + advanced console tab, ⌘K/Ctrl+K command palette (open, filter,
Esc), runtime-log pane + typed-timeline disclosure + Diagnose JSON, pipeline
rail detail, dialogs (Guide / Settings / Keyboard shortcuts), theme toggle +
reload, reload persistence of a created build, `?`/Ctrl+K shortcut suspension
while a dialog is open, mobile 390 px (home/run/sidebar), 404 route, run-not-found
route, export download, invalid report ingest, rapid double-click create,
injected ring error, and crafted run states (blocked-at-P6 with a red gate,
awaiting-HITL, active wild run). Screenshots: `%TEMP%\rt_u1\shots*`.

No hydration/SSR-mismatch warning, no unexpected console error, no blank pane, no
horizontal overflow (390/390), and no state lost on reload were reproducible on
the base in those flows. One real defect was found via an **import** flow.

## Real bug fixed — partial foreign gate crashed the phase-detail panes

- **file:line (before):** `src/components/pipeline-rail.tsx:168`
  (`rec.gate.evidenceHash.slice(0, 8)`), `:170` (`rec.gate.unmet.length`), `:175/177`
  (`rec.gate.unmet.length` / `.map`); `src/components/console.tsx:7179`
  (`rec.gate.evidenceHash.slice(0, 8)`), `:7180` (`rec.gate.unmet.length`), and
  `GateVerdictDetail` `console.tsx:7062` (`gate.unmet ?? []` — a truthy non-array
  `?? []` does not guard, so `.map` throws).
- **symptom (reproduced):** import a project JSON whose P0 record carries a
  partial gate (`gate: { passed: false }` — no `unmet`, no `evidenceHash`) and
  click that phase in the merged rail. React throws
  `TypeError: Cannot read properties of undefined (reading 'slice')` out of
  `PhaseRecordDetail`; the PaneBoundary then replaces the pipeline pane with
  "This area hit a render error — the rest of …". The same import, viewed through
  the left phase rail (PhaseRecordView), crashes identically.
- **root cause:** `repairPhases` (`src/lib/engine.ts:2357`) keeps a record's gate
  **verbatim** (`gate: r.gate ?? null`) — it validates id/status, not the gate's
  inner shape. A hand-edited/incoming `build.json` (the documented
  export→edit→import path) or an older-schema record therefore reaches the UI with
  a partial gate. This is the same foreign-object class the F3 lane fixed for
  `handoff.phaseHandoff`; the two phase-detail surfaces had no guard.
- **fix (patch-only, both files):** coerce the container and guard the scalars —
  `const gateUnmet = gate && Array.isArray(gate.unmet) ? gate.unmet : []` and a
  `typeof gate.evidenceHash === "string" && gate.evidenceHash.length > 0` guard for
  the hash, with `checkedAt` rendered as "unknown" when not a number. A partial
  gate now renders `DoD FAIL · checked unknown · evidence unrecorded` and
  "gate FAIL recorded — no unmet criteria stored" — an explicit unknown, never an
  invented value and never a throw. Valid gates render byte-identically.
- **proving test:** `node --experimental-strip-types --test --test-reporter=tap
  src/components/console.guards.test.ts` → new pin
  `"Phase gate detail survives a PARTIAL foreign gate (350 · U1)"` (7 tests, 7
  pass). Browser proof: after the fix the same import shows the honest text on
  both surfaces with **zero** console/page errors
  (`%TEMP%\rt_u1\probe11.cjs` output; before-fix crash captured in
  `probe10.cjs`).

## Out-of-scope findings (reported, not fixed)

- **Demo build is mock data and store-owned.** `src/lib/store.ts:2752`
  (`seedIfEmpty`) fabricates a project named "Northwind Dispatch" on an empty
  store, and `store.ts:1265-1291` (`onRehydrateStorage`) calls it too. The console
  `HomeScreen` also calls `seedIfEmpty` (`src/components/console.tsx:1826`) but the
  seed definition and the rehydrate call live in `src/lib/store.ts` (forbidden
  here), so the "NO mock/demo/placeholder data" rule cannot be honoured from the
  UI lane alone. Report only.
- **`npm run preview` exit-1 observations were environmental, not an app fault.**
  A preview server I started on 8081 exited ~131 s in; a later `npm run preview`
  reported `Port 8081 is already in use` (strictPort). The sibling `rt350-build`
  launcher (`scripts/launch-rapidtool.mjs`) reaps port-8081 owners with
  `taskkill /T /F`, which explains both. Preview itself serves fine once the port
  is free; no app-level crash was in the log.
- **The 404 console entry** seen on the production preview is the expected HTTP
  404 from the `/definitely-not-a-route` document (the not-found route), not a
  missing asset.

## Commands + results

```
npm run build                       -> exit 0
npm run preview (127.0.0.1:8081)    -> serves; app loads, all flows above pass
npm run dev (PORT=8080)             -> serves; HMR applied the fix live
node --experimental-strip-types --test --test-reporter=tap src/components/console.guards.test.ts
                                    -> tests 7 / pass 7 / fail 0
node_modules/.bin/tsc.cmd --noEmit  -> exit 0
node %TEMP%\rt_u1\probe10.cjs       -> before fix: TypeError at pipeline-rail.tsx:195 (PhaseRecordDetail)
node %TEMP%\rt_u1\probe11.cjs       -> after fix: errors [] ; rail + record render "evidence unrecorded"
```
