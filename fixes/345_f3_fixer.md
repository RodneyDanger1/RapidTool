# 345 · lane f3 — FIXER (UI/robustness + test teeth)

**Lane:** f3 (fixer). **Base:** `main` @ `06cb089`. **Scope (STRICT):** `src/lib/rt-client.ts`,
`src/lib/report-intake.ts`, `src/components/pipeline-rail.tsx`, and the tests `rt-client.test.ts`,
`report-intake.test.ts`, `checkpoint.server.test.ts`, `node-runner.server.test.ts`,
`maker-score.test.ts`, `rt-events.test.ts`. **Keyed LLM calls: 0.** **Scratch:** `%TEMP%\rt345_f3\`
(browser probe + a repo copy for mutation tests). No out-of-scope production file was edited.

---

## 1. Items

| # | Item | file:line | Result |
|---|---|---|---|
| 1 | A3-02 — stall latch never clears | `src/lib/rt-client.ts:514,528,589` (heartbeat) | **FIXED** (production caller added in `rt-client.ts`; no store/console change needed) |
| 2 | A3-01 — now-line narrates UI jank | `src/lib/rt-client.ts:658,710` (`pickNowLine`) + `src/components/pipeline-rail.tsx:53,316` | **FIXED** |
| 3 | A3-14 — rail badges bleed ~11 px | `src/components/console.tsx:4207-4232` | **STOP-and-REPORT** (console.tsx not owned) |
| 4a | `checkpointAdmits` never validates `savedAt` | `src/lib/checkpoint.server.ts:407` | **STOP-and-REPORT** (source not owned); the live read→admit guard is **PINNED** in `checkpoint.server.test.ts:170` |
| 4b | node-runner finite-timeout clause | `src/lib/node-runner.server.test.ts:219` | **PINNED** |
| 4c | maker-score empty-set `return 0` | `src/lib/maker-score.test.ts:1129` | **PINNED** |
| 4d | report-intake caps ≤12 / ≤50 000 | `src/lib/report-intake.test.ts:58` | **PINNED** |
| 4e | report-intake fingerprint `tests_run` | `src/lib/report-intake.test.ts:169` | **PINNED** |
| 4f | rt-client Long-Tasks floor + coalesce | `src/lib/rt-client.test.ts:642` | **PINNED** |
| 4g | rt-events exact 5 000 ms boundary | `src/lib/rt-events.test.ts:115` | Already pinned at `343`; re-verified (mutation KILLED) |

---

## 2. Fixes, RED → GREEN

### A3-02 — the stall latch now clears (`src/lib/rt-client.ts:514-530,585-590`)
The heartbeat is the production caller. On each 1 s tick:
- a **registered probe** reporting `null` (the console probe returns null once the wild run is not
  active — the reload/stop path), a stopped run, or a paused run ⇒ `clearStall()` (any latch);
- a **healthy active tick** (`lagClass === "ok"`) ⇒ `clearStall()` only for the `mainthread-stall`
  latch the heartbeat itself owns (a driver-owned `step-timeout`/`step-overdue` latch is left alone);
- **no probe registered** ⇒ leave the latch untouched (silence is not health);
- `clearStall` is only called when a latch is actually present (no localStorage churn).

RED/GREEN (real tree, both runtimes): reverting the clear blocks produced
`not ok 17 - A3-01 …` / `not ok 18 - A3-02 …` (19 tests, 17 pass, 2 fail); restored ⇒ **19/19 pass on
Node 22.23.2 and Node 24.15.0**.

### A3-01 — the now-line prefers run rows (`src/lib/rt-client.ts:658-790`)
`pickNowLine` moved into `rt-client.ts` (exported; the component imports it — the 344 audit's own
recommendation, and the only way to unit-test it: the `node --experimental-strip-types` runner cannot
load a `.tsx`). New fallback order: newest **non-diagnostic** ring row → project ledger → wild loop →
newest **diagnostic-only** ring row (`sys`/`boot`/`ui-render`, LAST resort) → honest idle. The component
keeps only rendering (`pipeline-rail.tsx:316`).

RED/GREEN: with the old ring-first behavior the new test failed (`not ok 17 - A3-01 …`); after the
ordering fix **19/19 on both runtimes**.

---

## 3. New pins + mutation-kill evidence

Guards that already existed are pinned so each can now fail. Every mutation was applied in the scratch
copy `%TEMP%\rt345_f3\repo\` (a real copy + a `node_modules` junction), the named test failed, and the
file was restored; the scratch baseline re-ran **199/199 pass** afterwards.

| Mutation (scratch) | File | Pin that failed | Result |
|---|---|---|---|
| `REPORT_MAX_ARTIFACTS 12 → 1000` | `report-intake.ts` | `enforces the artifact caps …` | **KILLED** |
| `REPORT_MAX_ARTIFACT_BODY 50_000 → 100_000` | `report-intake.ts` | same | **KILLED** |
| fingerprint `tests_run: report.tests_run ?? []` → `[]` | `report-intake.ts` | `fingerprints tests_run …` | **KILLED** (assertion message named the test) |
| `criteriaMeanExcluding`: `if (ids.length === 0) return 0` removed | `maker-score.ts` | `excluding EVERY criterion returns 0 …` | **KILLED** |
| finite-timeout clause removed (`Number.isFinite` + clamp) | `node-runner.server.ts` | `non-finite / <=0 timeouts …` | **KILLED** |
| reader `savedAt` finite check removed (`isRunCheckpoint`) | `checkpoint.server.ts` | `A1-07 savedAt boundary …` | **KILLED** |
| Long-Tasks floor `250 → 0` | `rt-client.ts` | A3-11 floor assertion | **KILLED** |
| Long-Tasks coalesce `< RT_COALESCE_MS → < 0` | `rt-client.ts` | A3-11 coalesce assertion | **KILLED** |
| `shouldCoalesce` `<= RT_COALESCE_MS → <` | `rt-events.ts` | `coalesce window math …` | **KILLED** |
| `pickNowLine` ring-first revert | `rt-client.ts` | A3-01 | **KILLED** |
| heartbeat clears muted (`if (false) clearStall()`) | `rt-client.ts` | A3-02 | **KILLED** |

Honest limit on the node-runner pin: removing **only** `Number.isFinite` while keeping the
`Math.min(…, MAX_TIMEOUT_MS)` clamp is behaviorally inert for any observable run (Infinity → MAX, not an
immediate kill). The pin kills the documented pre-fix shape (finite clause **and** clamp absent ⇒
`setTimeout(fn, Infinity)` fires on the first tick) and the "requestedMs ignored" shape.

---

## 4. Browser check

Sibling dev server on `http://127.0.0.1:8080` (already up; used, not restarted), headless Chromium,
desktop 1280×900 + mobile 390×844. Created a build (`/` → "Field dispatch" → "Open intake" →
`/run/ba2d60c9-84cb-4d9d-b827-165be20854d9`), then seeded `localStorage["rapidtool.rt.v1"]` per case
and reloaded. **0 console errors, 0 page errors.**

| Case | Now-line / state |
|---|---|
| ring = one diagnostic `sys.longtask` jank row | `LEDGER 16:51:10 project.created P0 logistics` — note `newest entry of the project ledger (no run rows in the client ring)` (pre-fix this was `RING … sys.longtask`) |
| + a real run row (`wild.step_ok`) | `RING 16:51:12 wild.step_ok sealed P3` — note `newest run row of the client telemetry ring · 3 rows this page session` |
| seeded `stall: mainthread-stall` | after 4 s: `localStorage.rapidtool.rt.v1.stall === null`; no `Stalled ·` row |
| mobile 390×844 | no horizontal overflow; now-line `LEDGER …` |

A3-02's clear is observable end-to-end because the console registers the busy probe and the parked build
makes it return null (run not active) → the next heartbeat tick clears + persists.

---

## 5. STOP-and-REPORTs (out of ownership)

1. **A3-14 — rail badge bleed.** `src/components/console.tsx:4207-4234` (`PhaseRail`): the button
   `className` has `lg:min-w-0` but no clipping, and the badge `<span className="ml-auto hidden shrink-0
   lg:inline-flex">` (`:4232`) paints ~11 px past the 240 px rail column. Minimal patch (console owner):
   add `overflow-hidden` to the button class at `:4207` (children clip; the element's own focus ring is a
   box-shadow and is unaffected) and/or `min-w-0` to the badge span. No owned file can fix this.
2. **`checkpointAdmits` `savedAt`.** `src/lib/checkpoint.server.ts:407` returns `{ ok: true, savedAt:
   checkpoint.savedAt }` for a snapshot whose `savedAt` is absent/`"x"`/`NaN`. Proposed source change
   (checkpoint owner), before the success return:
   ```ts
   const savedAt = (checkpoint as unknown as { savedAt?: unknown }).savedAt;
   if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) {
     return { ok: false, code: "RT_E_VALIDATION",
       error: `checkpoint: savedAt ${String(savedAt)} is not a finite timestamp — refusing this re-entry point` };
   }
   return { ok: true, savedAt };
   ```
   The owned pin at `checkpoint.server.test.ts:170` covers the live `readCheckpoint` → `loadResumableCheckpoint`
   path (the reader's `isRunCheckpoint` finite guard is what protects production resume); a direct
   `checkpointAdmits` refusal pin would be RED until the source change above lands.
3. **`requiresHumanResume`** (`watchdog.ts`) still has no production consumer — the "never auto-resume"
   invariant (A3-05) needs the store wild driver (`store.ts`, not owned).

---

## 6. What remains

- The three STOP-and-REPORTs above (console badge; `checkpointAdmits` `savedAt`; `requiresHumanResume`).
- A3-05's `boundedStepWatch`/`shouldAutopause` driver wiring (store.ts) — untouched.
- No full gate run (rule); only the owned suites (199/199 both runtimes), `tsc --noEmit` (exit 0),
  `eslint` on changed files (0 problems), and the source guards that read `pipeline-rail.tsx`
  (`ui-surface-guards`/`ui-shell-guards`, 14/14) were run.

---

# 345 · lane f3 — FIXER resume (L3-01 / L3-03 / L3-08 / A3-14)

**Base:** `main` @ `06cb089` (unchanged). **Scope this resume:** `src/components/console.tsx`,
`src/lib/store.ts`, `src/lib/store.test.ts`, plus my prior `rt-client.ts` / `pipeline-rail.tsx` / test set.
**Keyed LLM calls: 0.** Scratch `%TEMP%\rt345_f3\`.

## 1. Items

| # | Item | file:line | Result |
|---|---|---|---|
| 1 | L3-03 — reload mid-run permanently wedges the build | `src/lib/store.ts:1022` (`markInterruptedRuns`), applied `:2210` | **FIXED** |
| 2 | L3-01 — ~1 s false "build doesn't exist" flash | `src/components/console.tsx:2008,2282` | **FIXED** |
| 3 | A3-14 — rail badges bleed ~11 px at ≥1024 | `src/components/console.tsx:4239,4260` | **FIXED** |
| 4 | L3-08 — queued clicks create duplicate builds | `src/components/console.tsx:1772,1784` | **FIXED** |

## 2. Fixes, RED → GREEN

### L3-03 — hydrate resets an interrupted `running` phase (`src/lib/store.ts:1022-1050`)
`markInterruptedRuns(project)` runs on the hydrate pass (`seedIfEmpty` → `hydrateProject`): every phase
record with status `running` is reset to `ready`, and ONE `run.interrupted` warn ledger row naming the
phases is appended. That restores the exact `canExecute` conditions (`console.tsx:356-363`): not running,
not blocked/complete, no open HITL. `project.status` is left as the engine leaves a ready frontier
("running" = build in progress) — the wedge is the per-phase record `canExecute` reads.
- RED (scratch, application reverted with Node `fs`): `not ok 46 - L3-03 …`, 101/102.
- GREEN: `ok 46`, 102/102.
- Pin: `store.test.ts:936` — the real repro (create → execute P0 flips the record to `running` → reload).

### L3-01 — skeleton until hydrated (`src/components/console.tsx:2008,2276-2298`)
`RunScreen` now reads `hydrated`; the `!project` branch renders a neutral
`role="status"` skeleton ("Loading build…") until the store reports hydrated, and only then the genuine
not-found screen. The route head already guarded; this mirrors it in the body.

### A3-14 — clip the rail badge (`src/components/console.tsx:4239,4260`)
The phase button gains `overflow-hidden` (children clip; the element's own focus ring is a box-shadow and
is unaffected) and the badge span gains `min-w-0`.

### L3-08 — synchronous launch latch (`src/components/console.tsx:1772,1784-1795`)
`HomeScreen.launch()` gains `launchRef` (flips synchronously, mirroring the run actions' `busyRef`),
released in `nav(...).finally()` so a failed/aborted navigation cannot strand it.

## 3. Pins + mutation-kill evidence

The repo's test glob (`src/lib/**/*.test.ts`) mounts no component, so the Console JSX invariants are
pinned as SOURCE assertions in `store.test.ts:2429-2443` (the instrument `ui-shell-guards` /
`ui-surface-guards` use on console.tsx). `RT345_CONSOLE_TX` points a guard at a copy.

| Guard | Pre-fix variant (scratch) | Result |
|---|---|---|
| L3-01 skeleton gate (`store.test.ts:2429`) | `if (!hydrated)` → `if (false)` | **KILLED** (`not ok 100`) |
| L3-08 launch latch (`store.test.ts:2435`) | latch check removed | **KILLED** (`not ok 101`) |
| A3-14 overflow clip (`store.test.ts:2440`) | `overflow-hidden` removed | **KILLED** (`not ok 102`) |
| L3-03 hydrate reset (`store.test.ts:936`) | `markInterruptedRuns(...)` application reverted | **KILLED** (`not ok 46`) |

## 4. Browser verification

Sibling dev server `http://127.0.0.1:8080` (used, not restarted); headless Chromium; desktop 1280×900 +
mobile 390×844; probe `%TEMP%\rt345_f3\probe.cjs` run against the fixed tree and against the four
reverted fixes. **0 page errors in every run.**

| Scenario | BEFORE | AFTER |
|---|---|---|
| L3-01 hard-load existing `/run/<id>` | false "This build doesn't exist or was archived." visible **500 ms** (desktop) / **540 ms** (mobile); skeleton 0 ms; content 1626 / 1911 ms | notFound **0 ms**; skeleton **~600 ms**; content 1618 / 1719 ms |
| L3-03 reload with a persisted `running` P0 | rail shows **RUNNING**, `Execute P0` **disabled**, no `run.interrupted`, `anyRunning:true` | phase **ready**, Execute **enabled**, now-line `LEDGER … run.interrupted …`, `anyRunning:false` |
| L3-08 3 clicks in ONE task on "Open intake" | **3** duplicates persisted (`delta:3`, three identical names) | **1** build (`delta:1`) |
| A3-14 rail button @1024 and @1280 | `getComputedStyle(.rt-phase).overflow === "visible"` (badge paints past the button) | `"hidden"` (clipped by the rail column) |

## 5. Regression counts

Owned suites (`store`, `rt-client`, `report-intake`, `checkpoint.server`, `node-runner.server`,
`maker-score`, `rt-events`): **301 pass / 0 fail / 0 skipped** on Node 22.23.2 **and** Node 24.15.0.
`tsc --noEmit` exit 0; `eslint` on `console.tsx` / `store.ts` / `store.test.ts` 0 problems; the sibling
console-reading guards (`ui-surface-guards` + `ui-shell-guards`) 14/14. No full gate (rule).

## 6. Incident + recovery (disclosed)

While producing RED evidence I ran a PowerShell `Get-Content -Raw | Set-Content -Encoding UTF8`
round-trip on `src/lib/store.ts`. PS5 decoded the UTF-8 file as Windows-1252 and re-encoded it,
double-encoding every non-ASCII character (`—` → `â€”`), which broke 4 sibling store tests. I restored
`store.ts` from this session's scratch repo copy (`%TEMP%\rt345_f3\repo\src\lib\store.ts`), verified it
is ASCII-identical to the corrupted file apart from my two edits, then confirmed **0 U+FFFD** and the
em-dash present, and that sibling lane f2's `store.ts` work survived (`verifyPriorPhases` at `:1847`,
`stageWildPlan` at `:1439`). All subsequent file edits used Node `fs` or `search_replace` (UTF-8 safe).
No sibling-owned file was affected; nothing outside my owned set was written.

## 7. What remains / STOP-and-REPORTs

- No open STOP-and-REPORT from this resume (A3-14's blocker is gone — `console.tsx` is now owned).
- Still open from the prior resume, out of this scope: `checkpointAdmits` `savedAt` validation
  (`checkpoint.server.ts:407`); `requiresHumanResume` remains unconsumed (`watchdog.ts`/`store.ts`).
- L3-02 / L3-05 / L3-06 / L3-07 / L3-10 / L3-11 from the looker report were not assigned to this lane.
