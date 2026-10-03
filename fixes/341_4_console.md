# fixes/341_4_console.md — lane 341-4 (persona: console / UI wiring)

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **branch** `main` · **HEAD** `2d5ee35` (unchanged by this lane).
**Runtimes:** host `node` v24.15.0; pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
**Scratch:** `%TEMP%\rt341_4\`. **Owned (edited):** `src/components/console.tsx` only.
**Not owned / not edited:** `src/lib/types.ts`, `src/lib/store.ts`, the engine, `src/lib/headless.ts`, `src/lib/packet.ts`.
**No keyed LLM calls. No full gate. No tracked-file deletion.**

The working tree carried sibling lanes' in-flight edits throughout (`doctor*`, `verify*`, `packet.ts`,
`maker-score*`, `run-eval.mjs`, `llm/providers/*`) — none touched by this lane. `git diff --stat` at close:
`src/components/console.tsx | 30 ++++---` is the only file this lane changed.

---

## 1. The question, answered

**Does the console surface the engine's REAL state?** Yes on every pane that reads the store/ring —
verified by driving the live dev server, including a real keyless wild park
(`RT_E_LLM_NOT_CONFIGURED`, rail row `Parked · RT_E_LLM_NOT_CONFIGURED · Classifier not configured.`).

**Does every datum the engine produces have a consumer?** For the console's own surfaces, yes with two
named exceptions:
1. the plan-review/park datum cannot be produced on the console's own driver path (the store driver
   never attaches a plan) — STOP-and-REPORT §7.1;
2. `Project.wildPlan` has **no packet consumer** (`packet.ts` never renders it) — STOP-and-REPORT §7.2.
Everything else read from the store has a renderer (see the table); `Project.tokenUsage` is consumed by
`packet.ts`/`doctor.ts` (not by the console — an additive UI opportunity, not a broken pane).

## 2. Per-surface reality table (bytes, on screen)

| Surface (`src/components/console.tsx` unless noted) | Shows real engine state? | Notes / fixed how |
|---|---|---|
| Home intake (brief, build list, `PROJECT_STATUS_LABEL`, Phase N/13) | **Real** | reads `projects`/`status`/`currentPhase`. |
| Home/route titles — `governed 13-phase delivery harness` (not "factory") | **Real** | `index.tsx` + `run.$id.tsx` meta; matches `doctor` (R6-f02). |
| Run header status chips (domain, LLM probe, research probe, sandbox, token **estimate** labelled `(est)`, saved clock) | **Real** | estimate is explicitly labelled; no measured-spend chip (see §7.2). |
| Autopilot toggle | **Real** | static store contract. |
| Wild toggle + `WildConsole` feed | **Real** | copied live: driver parked at P4 with a real park record; feed carried `wild.exec`/`wild.review`/`wild.paused_classifier`. |
| Phase header (code, `PHASE_STATUS_META`, `StatusBadge`, brief) | **Real** | `phases`/`currentPhase`. |
| Action bar (Execute, Run-to-gate, Approve/Reject, Retry, Archive, Export, Ingest report) | **Real** | bound to typed store actions; no-op controls absent. |
| `PhaseProgressRail` + `PipelineRail` (now-line, attention, park, phase detail) | **Real** | rail rendered the live engine park; detail reads `gate.passed/unmet`, `rejectionNote/History`, decisions, artifacts, `wildRun.lastStep/park`, `hitl`. |
| Tabs: artifacts / spec / crew / oracle / design / diagram / chat / vault / fixtures | **Real** | each reads its store slice; FixturesPanel is read-only with a named refusal (no fake seat). |
| **Agent packet** tab | **Real, except plan** | packet renders; `Project.wildPlan` is **not** rendered here (datum gap → §7.2). |
| Runtime log tab (`RuntimeLogPane`) + typed timeline (`RuntimeTimelinePane`) | **Real** | `rtSnapshot()` ring; Diagnose produced real JSON; typed timeline expands. |
| Sidebar: Enforce-DoD, Notes, Memory, Gate log (decisions), GateHealthCard, Diagnostics (logs) | **Real** | direct store reads. |
| **Sidebar: `ShellSurfacesCard`** (plan · checkpoint · unattended · stream · cassette · seat · isolation) | **2 rows were STALE** | Plan ("planner is not wired yet") and Cassette ("zero wire points / recording is not available") corrected — §3. Remaining rows (checkpoint N2, unattended, stream, seat, isolation) re-verified against bytes and honest. |
| Modals: Guide, Settings, Shortcuts; `ExportSoftwareBlock` | **Real** | export names the CLI command instead of faking a browser folder write. |
| Pane boundaries (`PaneBoundary`) Home header/screen, Run header, Phase rail, Run screen, Run sidebar | **Real** | each wraps a pane; the Run screen is wrapped (RS-04's owed half) and emits `ui.pane_crash`. No component-level test harness exists in-repo to pin a forced throw (see §6). |

## 3. Fixes (each with before/after)

All three are in `src/components/console.tsx` (`ShellSurfacesCard`). Behavior is unchanged — this is a
declare-or-strike copy pass, so no RED test applies (no runtime path changed).

### 3.1 Wild-plan row — stale "not wired" (the named residual)
- **Before (screen):** `no plan on record — the planner is not wired yet; the wired reader returns an honest empty plan (source: "empty"), never invented steps.`
  with `title="…the planner is not wired — engine.readWildPlan returns an honest empty plan…"`.
- **After (screen):** `no plan on record — a console-started build is not planned (the planner runs on the CLI/headless wild path and parks at the plan review); the reader returns an honest empty plan (source: "empty"), never invented steps.`
  with a `title` naming the real chain (`generateWildPlan → attachWildPlan → stageWildPlan`, parking at
  `wild.plan_review` before the first mutation) and the real gap (the console store driver calls neither).
- **Why:** 340-5 shipped the planner + classifier plan review + pre-mutation park in `headless.ts`
  (`attachWildPlan` :5162, `stageWildPlan` :5196, called by `wildStartHeadless` :5307/:5309 and
  `wildStartRun` :5534/:5536); the CLI is the only caller (`rapidtool-cli.mjs:4393/:4400`). The console's
  `store.startWildRun` (`store.ts:1228`) loops `wildStep` directly. "The planner is not wired" was false
  on the product; "a console-started build is not planned" is true on the bytes (proved live: after
  enabling Wild, the persisted record had `wildPlan: null`).

### 3.2 Cassette row — stale "library only"
- **Before (screen):** `library only — no wire points; recording is not available`
  (`title="…zero wire points — no callModel wrapper…a replay can never pass as live."`).
- **After (screen):** `wired at the provider seam — arm it with RAPIDTOOL_CASSETTE_MODE + RAPIDTOOL_CASSETTE_TAPE; no console control yet`
  with a `title` naming the seam (`deepseek.ts` / `openai-compatible.ts`), the armed-mode semantics, the
  coded refusals (miss / tampered / cross-family), and the honest remainder (no console control, no
  run-eval/CLI flags).
- **Why:** 340-4 wired `cassette.ts` around both provider entry functions. "Recording is not available"
  was false; recording is available via env. The honest residual is the missing driver UI/flags.

### 3.3 `ShellSurfacesCard` doc comment
Rewrote the plan + cassette bullets to match the bytes above and the truth-source line now reads
`re-verified on disk for W54 341-4; log fixes/341_4_console.md`. No other bullet changed.

## 4. Browser verification log (MANDATORY; behaviour driven, not screenshots)

`npm run dev` → `http://127.0.0.1:8080` (Vite ready). Playwright chromium 1.62.1. Scripts:
`%TEMP%\rt341_4\verify.mjs` (29 checks/29 pass, 0 page/console errors) and
`%TEMP%\rt341_4\verify-wild.mjs` (7 checks/7 pass, 0 errors). Screenshots:
`%TEMP%\rt341_4\{desktop-seeded,desktop-wild,mobile-drawer}.png`.

**Desktop 1440×900**
- Home loads (title + brief textarea) → typed a brief → clicked **Open intake** → URL `/run/<id>`.
- Sidebar (static at `lg`) shell card: plan row no longer contains "planner is not wired"; contains
  "console-started build is not planned"; cassette row contains "wired at the provider seam" and the two
  env tokens and **not** "library only"; checkpoint/seat/isolation rows unchanged and honest.
- Clicked **More panels (7)** → **Runtime log** tab → **Diagnose** → real JSON snapshot rendered;
  **Typed timeline** toggle expanded `#rt-timeline-body`.
- Phase rail P0 segment present.
- **Real driver exercise:** clicked the **Wild** switch → `store.startWildRun` ran keyless → parked at
  **P4** with `park = {code:"RT_E_LLM_NOT_CONFIGURED", event:"wild.paused_classifier", unlock:"human-retry", resumePhase:4, resumeAction:"gate"}`; rail rendered `Parked · RT_E_LLM_NOT_CONFIGURED · Classifier not configured.`; ledger held `wild.advance/phase.enter/wild.exec/wild.review/.../wild.paused_classifier`. Persisted `wildPlan: null` (proves the §7.1 gap).
- **Reload honesty:** injected a stored planner plan + an ACTIVE paused plan-review park into
  `localStorage["rapidtool.v4"]`, reloaded → the card rendered `source: planner · 2 step(s) · planned 3s`
  (wildPlan survives hydrate) while the run was force-stopped (`STOPPED` + "Run stopped after reload"),
  and the rail correctly did **not** claim `Parked` (engine session-break honesty, `engine.ts:2323-2332`).
  Diagnostics showed the seeded `wild.plan_review` / `wild.paused_plan` rows.

**Mobile 390×844 (isMobile, hasTouch)**
- Home → brief → **Open intake** → run screen.
- **Status & options** disclosure toggles `#run-status-strip` open.
- **Sidebar** button opens the drawer; the shell card is visible inside it and carries the corrected plan
  + cassette copy; **Close** dismisses it.
- **More panels** → **Runtime log** reachable; Diagnose present.

**Could not exercise in-browser:** a real plan-review park from the console (the store driver cannot
produce one — §7.1); a keyed path (no keyed calls permitted). The plan-review park is the same
`WildParkInfo` shape as the live keyless park I *did* render, so the rail renderer is exercised.

## 5. Byte-truth corrections

Exactly the two on-screen claims in §3 (plus the doc comment they were derived from). Re-verified as
already-honest and left untouched: the R6-f02 "governed 13-phase delivery harness" titles, the seat row
(no `seat.ts` on disk, no `RT_E_HUMAN_SEAT_*` in `errors.ts`), the isolation row (no
`isolation.server.ts`; never "sandboxed"), the streaming row (`chat.ts` keeps the provider one-shot),
the checkpoint row (`checkpoint.server.ts` is server-only; no console read seam), and the unattended row.

## 6. Targeted suites (both runtimes, `--test-reporter=tap`)

| Suite | node v24.15.0 | node v22.23.2 |
|---|---|---|
| `src/lib/store.test.ts` (the wild-driver path audited) | `# tests 93 / # pass 93 / # fail 0` | `# tests 93 / # pass 93 / # fail 0` |
| `npx tsc --noEmit` | exit 0 | — |
| `npx eslint src/components/*.tsx src/routes/*.tsx` | exit 0, 0 warnings | — |

No component-test harness (no jsdom / react testing-library in `package.json`; zero `*.test.tsx` in
`src/components`/`src/routes`) — so the UI is verified by the browser exercise above, and adding a
harness was out of scope. No behaviour changed, so no RED test was written.

## 7. STOP-and-REPORT (needs a store/engine/type change — not my files)

### 7.1 `src/lib/store.ts` `startWildRun` does not stage the plan review
- **Bytes:** `store.ts:1228` `startWildRun` builds `started` (:1289-1304), calls
  `commitWild(withStartLog, null)` (:1341), then binds `createNodeWildReviewer()` (:1350) and loops
  `wildStep` (:1352). It never calls `attachWildPlan`/`stageWildPlan`.
- **Engine side:** the plan staging exists only in `src/lib/headless.ts` (`attachWildPlan` :5162,
  `stageWildPlan` :5196) and is reached only by `wildStartHeadless`/`wildStartRun`, whose only caller is
  the CLI. `headless.ts` statically imports `node:fs` (:63), so client-safe `store.ts` **cannot** import it
  (AGENTS.md §"never import node:fs into client-safe modules").
- **Exact shape to fix (either):**
  - **(A, preferred)** move `stageWildPlan`'s body (`headless.ts:5196-5246`) into `engine.ts` (it already
    imports `reviewWildPlan`, `wildLog`, `wildPause` from engine) as a client-safe
    `export async function stageStoredWildPlan(project, reviewer: WildReviewer | null)`; keep a thin
    caller in `headless.ts`. Then in `store.startWildRun`, after `commitWild(withStartLog, null)` and
    before the loop:
    ```ts
    const staged = await stageStoredWildPlan(cur, reviewer);
    cur = staged.project;
    commitWild(cur, withStartLog);
    if (staged.staged) {
      return { ok: true, ran: 0, stoppedReason: "paused", note: "RT_E_GATE_PENDING" };
    }
    ```
    In the browser `reviewer` is null (`createNodeWildReviewer` is server-only), so the honest keyless
    branch writes the `wild.plan_review` "not configured" row and parks — which is correct
    (an unreviewed plan must not execute), and it is the exact behavior verified server-side in 340-5.
  - **(B)** route console-initiated wild runs through a TanStack Start server function wrapping
    `headless.wildStartRun` (new server module + `store.ts` change).
- Until this lands, a console-started build carries no `wildPlan` and cannot produce a plan-review park
  (proved live — §4). The console UI side is ready: `WildConsole` already surfaces
  `wild.plan_review`/`wild.paused_plan` rows and `pipeline-rail` already renders any park.

### 7.2 `src/lib/types.ts` TODO/comment drift
- `types.ts:521` `TODO(R13-f02)` ("UI/packet surfacing is TODO"). The **UI half is now consumed**:
  `ShellSurfacesCard` → `store.wildPlanFor` → `engine.readWildPlan`, the `WildConsole` feed carries the
  `wild.plan_review`/`wild.paused_plan` ledger rows, and `pipeline-rail` renders the park. The **packet
  half is still absent** — `packet.ts` never renders `wildPlan` (a 341-3 sibling is editing `packet.ts`
  for artifact census, not plan). Suggest the `types.ts` owner retire the UI half of the TODO and, if the
  packet is meant to carry the plan, split the packet half into its own row.
- `types.ts:253` ("the planner is NOT wired yet"), `:266` ("`[]` while the planner is unwired") and `:269`
  ("null while the shell holds no real plan") are stale post-340-5. Not mine to edit.

## 8. 340-verifier logs — UI-relevant findings, fixed / not

| Finding (source) | Status at close |
|---|---|
| `340_8` §3 hole: "Console/`store.ts` driver does not call `attachWildPlan`/`stageWildPlan`" | **Open** → §7.1. UI surface no longer mislabels it (§3.1). |
| `340_0` §4 residual: "Console/store wild driver does not stage the plan review (UI surface owed); `types.ts:521` carries an unconsumed UI TODO" | **UI half closed** (§3.1, §7.2); store half **open** → §7.1. |
| `340_8` §"comments claiming behaviour the bytes do not implement" #1: `engine.ts` `reviewWildPlan` doc said the production prompt doesn't render `wildPlan` | **FIXED at HEAD** — bytes now state the prompt renders the rows (verified `engine.ts:4352-4357`). |
| `340_8` same #2: `quarantine.ts` header said the CLI no longer forwards the report | **FIXED at HEAD** — header now states the CLI forwards `quarantined`/`quarantineDir`/`quarantineFailed`/`judgingSkipped` (verified `quarantine.ts:14-26`). |
| `340_1` residual: MCP has "engine / console — no consumer" | **Open, unchanged** — no MCP console surface exists; enablement is the owner's trust call and there is no store field to render. Named, not hidden. |
| `340_7` verifier A | No UI findings (claims 1/4/6); nothing to act on. |

## 9. Mock / fake census (this lane)

`git diff -U0 src/components/console.tsx | added lines` for
`as any|@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable|catch {}|TODO|FIXME|XXX|mock|fake|placeholder`
→ **0 hits**. No marker removed (none of the touched claims carried a `TODO(<row>)`); no marker added; no
comment claims unimplemented behaviour. The pre-existing `TODO(N2)` and `TODO S4` strings left in the
untouched checkpoint/seat rows are accurate names of genuine gaps and were deliberately not struck.

## 10. What this lane did NOT do / could not do

- Did not edit `store.ts`, `types.ts`, `headless.ts`, `engine.ts`, `packet.ts`, `wild-mode.server.ts`, or
  any doc other than this log — the needs are §7.
- Did not run the full gate, `npm test`, `npm run build`, or any keyed/network path; ran only
  `store.test.ts` on both runtimes plus `tsc`/`eslint` (§6) and the browser drive (§4).
- Did not add a component-test harness (no such deps exist in-repo); did not delete any tracked file.
- Did not create an MCP/measure-spend UI surface (no store field / owner-gated; named in §1).

## 11. Verdict

**Works, with two named, non-UI gaps.** Every console pane that reads the engine's store renders real
state — re-driven live, including a genuine keyless wild park. The two stale on-screen claims the wave
named (wild plan, cassette) are corrected to the bytes. The console still cannot *produce* a plan-review
park because the store driver doesn't stage one (§7.1), and `wildPlan` still has no packet consumer
(§7.2) — both require files outside this lane's ownership and are reported with exact shapes rather than
papered over.

---

## 12. Resume (341-4 console) — verifier-B holes corrected to the bytes

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **branch** `main` · **HEAD** `2d5ee35`.
**Runtimes:** host `node` v24.15.0; pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
**Scratch:** `%TEMP%\rt341_4\`. **Owned (edited):** `src/components/console.tsx` + this log only.
**No keyed LLM calls. No full gate. No tracked-file deletion.**

Verifier B (`fixes/341_8_verifier-b.md` §"Claim 3") refuted two of this lane's on-screen strings: the
341-6 resume landed `stageWildPlan` in the store driver AFTER this lane closed (§7.1 was implemented by a
sibling lane), and 341-6's `machineGates` changed the `unattended` behavior. Both copies are rewritten to
the current bytes below. §7.1 and §11's "cannot *produce* a plan-review park" residual are **superseded
by 341-6** — the store driver now stages a stored plan.

### 12.1 Wild-plan row — hole 1 (`console.tsx` `ShellSurfacesCard`)
False claim: the console driver "calls neither, so a console-started build carries no stored plan".

- **Before (`title`):** `R13-f02: planning + classifier review are real on the server-side headless/CLI wild path (generateWildPlan → attachWildPlan → stageWildPlan, which parks at the wild.plan_review row before the first mutation). The console's store driver (store.startWildRun) calls neither, so a console-started build carries no stored plan. engine.readWildPlan returns the honest empty shape (steps: [], source: 'empty') — steps are never invented.`
- **After (`title`):** `R13-f02: planning + classifier review are real on the server-side headless/CLI wild path (generateWildPlan → attachWildPlan → stageWildPlan, which parks at the wild.plan_review row before the first mutation). The console's store driver (store.startWildRun) stages a stored plan through that SAME stageWildPlan seam — engine.ts's one staging site for both real wild drivers — so a record carrying a planner plan is reviewed and parks at the plan review before the first mutation (the browser reviewer is null, so the row is the honest 'Auto-Review classifier not configured' review); no stored planner plan stages nothing (staged: false, no write). engine.readWildPlan returns the honest empty shape (steps: [], source: 'empty') — steps are never invented.`
- **Before (screen):** `no plan on record — a console-started build is not planned (the planner runs on the CLI/headless wild path and parks at the plan review); the reader returns an honest empty plan (source: "empty"), never invented steps.`
- **After (screen):** `no plan on record — the reader finds no planner plan to stage, so a console start carries none (plan generation runs on the keyed server-side headless/CLI path, not in the browser); when a stored planner plan IS on the record the console driver reviews it and parks at the plan review before the first mutation. The reader returns an honest empty plan (source: "empty"), never invented steps.`
- **Byte evidence:** `store.ts:1350-1360` binds `const reviewer = await createNodeWildReviewer();`, then `let cur = withStartLog;` and `const staged = await stageWildPlan(cur, reviewer);` — on `staged.staged` it `commitWild(staged.project, null)` and returns `{ ok: true, ran: 0, stoppedReason: "paused", note: "RT_E_GATE_PENDING" }` BEFORE the `wildStep` loop. `engine.ts:4380-4446` documents `stageWildPlan` as "the ONE staging site for both real wild drivers (headless … and the console store's `startWildRun`)"; `reviewer === null` (browser) writes the honest "Auto-Review classifier not configured" `wild.plan_review` row and `wildPause(... "wild.paused_plan" ..., { code: "RT_E_GATE_PENDING", unlock: "human-gate" })` before the first mutation; `staged: false` (no plan / already reviewed) writes nothing. `store.test.ts:1040-1069` pins it: "341-6: a stored planner plan parks the console wild driver for review before any mutation (R13-f02)" → `wild.plan_review` + `wild.paused_plan` ledger rows, park code `RT_E_GATE_PENDING`, and **no** `wild.exec` before the review.

### 12.2 Unattended row — hole 2 (pre-existing text made false by 341-6)
False claim: the CLI `unattended` verb parks at every stock HITL gate, and end-to-end completion is blocked on W-01/W-02.

- **Before (`title`):** ``W-47: there is no scheduler/daemon/queue in this product. `unattended --project` is the scheduler-facing CLI drive (it re-enters from the run checkpoint when one exists, else starts from the file, and drives autopilot+live until parked — a stock HITL gate still parks with exit 2). The console has no schedule control. End-to-end unattended completion stays blocked while W-01 (keyed wild P6 seam) and W-02 (mint reachability) are unlanded keyed.``
- **After (`title`):** ``W-47: there is no scheduler/daemon/queue in this product. `unattended --project` is the scheduler-facing CLI drive (it re-enters from the run checkpoint when one exists, else starts from the file, and drives autopilot+live until parked). 341-6: it passes machineGates: true, so a stock HITL gate (P4/P5/P8/P9) whose DoD passes is cleared through the ledgered machine actor — only a forceHuman gate or a red DoD gate still parks (exit 2), never a fake completion. The console has no schedule control.``
- **Before (screen):** `no in-product scheduler — the CLI unattended verb resumes from a checkpoint when an external hook invokes it; stock HITL gates still park`
- **After (screen):** `no in-product scheduler — the CLI unattended verb resumes from a checkpoint when an external hook invokes it and clears stock HITL gates through the machine actor; only a forceHuman or red DoD gate parks`
- **Byte evidence:** `headless.ts:660-691` `machineApproveGate(project, autopilot, machineGates)`: returns `null` unless `autopilot && machineGates`, and `null` for `gate.forceHuman`, non-stock gate, or a red DoD (`runGate(approved, gate.phase).pass` false); otherwise approves through `approve(project, { actor: HARNESS_APPROVE_ACTOR })` (the ledgered machine actor). `headless.ts:711-712` threads `machineGates` through `runReady`. `scripts/rapidtool-cli.mjs:1139-1162` (run/gate arm) passes `machineGates: true` for `--unattended` and documents "a genuine human gate (forceHuman) or a red DoD gate still parks (exit 2), never a fake completion"; `:1445-1451` (the `unattended` verb arm) sets `machineGates: true`. The honest remaining limit kept: no in-product scheduler/daemon/queue — an external host invokes the verb.

### 12.3 Doc-comment truth-source bullet (`console.tsx:7256-7267`)
The `W36 N3` doc comment above `ShellSurfacesCard` carried the identical false "calls neither, so a
console-started build carries no stored plan" claim in the `- plan` bullet. Reflowed to match 12.1
(the store driver stages a stored plan through the same `stageWildPlan` seam; browser reviewer null ⇒ the
honest "not configured" row; no plan ⇒ `staged: false`). Same owned file, same false claim — corrected
rather than left to contradict the row above it.

### 12.4 Targeted checks (no full gate)
- `src/lib/store.test.ts` — node v24.15.0: `# tests 94 / # pass 94 / # fail 0 / # skipped 0`, exit 0; node v22.23.2: `94 / 94 / 0 / 0`, exit 0 (`--test-reporter=tap`; logs `%TEMP%\rt341_4\store_n{24,22}.tap`).
- `npx tsc --noEmit`: exit 0, zero `error TS` lines (`%TEMP%\rt341_4\tsc.log`).
- `npx eslint src/components/console.tsx`: exit 0, no findings (`%TEMP%\rt341_4\eslint.log`).

### 12.5 What this resume did NOT do
- Edited only `src/components/console.tsx` and appended this log; no other file touched (not `store.ts`,
  `headless.ts`, `engine.ts`, `rapidtool-cli.mjs`, `types.ts`, or other logs).
- No behavior change (copy-only); no `npm test` / full gate / build / keyed or network call.
- Did not touch the cassette / stream / checkpoint / seat / isolation rows; did not delete any tracked file.
