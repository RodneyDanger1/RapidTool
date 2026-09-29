# 308 — THE BUG MAP (RapidTool)

**Tracer:** BUG-TRACER (308 wave) · trace window: 2026-09-29
**Tree:** HEAD `800a40d` + live working tree. ⚠️ **`src/lib/engine.ts` was mid-edit by a sibling 308 fixer during this trace** (`M`, +20/−4: `parkIfNull` added at engine.ts:4147-4165). Every engine.ts line number below is the WORKING TREE at trace end; re-verify after fixer lanes land. All other cited files = HEAD-clean.
**Rules honored:** map-only · zero product edits · zero commits · no keyed calls. Only repo file touched: `fixes/308_bugmap.md` (this). Scratch lives outside the repo (`~/rt308_tracer`, `~/rt308_m3`, `~/w39q1_scratch`).

---

## 0. Instrument battery — raw results (all fresh today)

| # | Instrument | Result | Evidence |
|---|-----------|--------|----------|
| I1 | `dead-exports.mjs` | 478 rows; notable zero-external-ref: `SignInButtons`, `handleAuthPopupRequest`, `readSessionToken`, `STALE_TURN_PREFIX`, `wildOperatorPark`, `RtScope`, `WILD_STEP_AUTOPAUSE_MS`, `LONGTASK_REPORT_MS`, `LONGTASK_COALESCE_MS` | `~/w39q1_scratch/out_dead-exports.txt:39-42,92,185,360-363` |
| I2 | `dead-fns.mjs` | 13 zero-external-ref fns; 2 truly dead (`handleAuthPopupRequest`*=wired via vite dynamic — see N-4, `readSessionToken`); 10 internal-only exports | `~/w39q1_scratch/out_dead-fns.txt` |
| I3 | `n6_emit_census.mjs` | 79 non-test `event:` sites (two systems — see N-6). `pipeline-rail.tsx:145 "wild.auto"` is a synthetic DISPLAY row, not an emitter | `~/w39q1_scratch/out_n6_emit_census.txt` |
| I4 | `n6_event_scan.mjs` | **registered=56 · never-or-test-only=34** (28 NEVER + 6 TEST-ONLY) | `out_n6_event_scan.txt:58` |
| I5 | `npm run typecheck` | **exit 0** (clean) | fresh run today |
| I6 | `npm run lint` | **exit 0** (clean) | fresh run today |
| I7 | grep classes | FIXME 0 · XXX 0 · `as any`/`@ts-ignore` = tests+routeTree.gen only · bare `catch {}` 0 (same-line) · empty bodies 2 (both `? {}` ternaries, benign) · `console.log` non-test = generated-code strings + CLI tool output (benign) | `~/w39q1_scratch/todo_census.txt` |
| I8 | consumer-check (18 tokens) | 2 hard gaps: `factory.spend` (treeDir arm), `park` operator/hydrate paths. Others wired | `~/w39q1_scratch/consumer_check.txt` |
| I9 | dependency traces | 4 chains walked; broken hops at: onEvent sink (B-02), hydrate (B-01c), operator bypass (B-01a), doctor spend (B-05) | §3 |
| I10 | behavioral probes | keyless e2e 8/8 shapes ran; park:null live-proven; H1 hostile probe 98 cases/22 throws | §4 |
| I11 | TODO census | 99 total hits src+scripts · **73 non-test** (matches B4's 73) · 45-file scan family | §5 |

---

## 1. THE MAP — ranked bug table

### P1 — breaks trust (ship-blockers for the wave)

**BUG-308-01 · class: null-that-shouldnt-be / not-wired · "park:null class" (B1's find, WIDER than first mapped — three uncovered slices remain)**
- **Contract:** `types.ts:155-186` + `:224-241` — `WildParkInfo` "present on `WildRunState.park` **whenever `pause === true`**"; hydrate "keeps them only when shaped right".
- **Live proof (today):**
  - `wildPauseRun` (operator/CLI pause) → `{pauseAfter:true, parkAfter:"NULL", lastAutoLog:"Wild run paused from the CLI."}` — probe `~/rt308_tracer/probe_park2.mjs`.
  - raw `engine.wildPause()` with no 6th arg → `parkAfter:"NULL"` (same probe).
  - CLI `wild --stop` then read `proj.json` → `wildRun` had **no `park`/`lastStep` keys at all** (`~/rt308_tracer/e2e/proj.json`).
- **Broken hops:**
  - **(a) Operator paths bypass the park stamp:** `headless.ts:4228` (`wildPauseRun` → `wildPause(...)` no park); `store.ts:1244` (20-step cap pause, no park); `store.ts:1275-1282` `toggleWildPause` — a bare `pause: !pause` flip, **no park, no ledger row, no lastAutoLog at all**. Designed fix `wildOperatorPark` (`engine.ts:3729-3731`) produces a correct record (`probe_park2 (2)`: `{code:null, unlock:"resume", resumePhase:4, resumeAction:"gate"}`) but has **ZERO call sites** (repo-wide grep).
  - **(b) Engine arms omit park:** of 19 `wildPause` call sites in engine.ts, **exactly one passes a park arg** (`:4227`, blocked path `{code:"RT_E_PHASE_ILLEGAL", unlock:"human-retry"}`). The rest (e.g. `:3853` gate-mismatch, `:3880` review error, `:3946` classifier-not-configured, `:4270` locked, `:4301` guard) stamp `park:null` — the F5 doctrine comment at `engine.ts:3736-3740` says "Pass `park` on every coded pause (engine arms)".
  - **(c) Hydrate DROPS both F5 fields:** `hydrateWildRun` (`engine.ts:2096-2123`) rebuilds `wildRun` as a fixed shape — `{active, phase, startedAt, lastAutoLog, lastAutoAt, stoppedAt, pause}` — and **never carries `park` or `lastStep`**, on any branch (incl. `preserveActive`). Every CLI load→save cycle and every browser reload loses them. (types.ts:227 claims hydrate "keeps them when shaped right" — it keeps them never.)
- **Decisive CLI-cycle proof (today):** `wild --resume` (exit 0) → `proj.json` **`park` KEY GONE + `lastStep` KEY GONE** while the run continues; then `wild --pause` (exit 0, changed) → **`pause:true, park:NULL, lastStep absent`**. Net: the operator pause cycle leaves a paused run that cannot say WHY, and the resume cycle erases the record a prior step had stamped.
- **In-flight sibling fix (working tree):** `parkIfNull` (`engine.ts:4147-4165`) stamps an uncoded/miscoded park when a wildStep pause left it null — **live-proven working**: after `wild --start` (keyless, parks at P4 gate) `proj.json` now carries `park:{code:"RT_E_LLM_NOT_CONFIGURED", event:"wild.paused", unlock:"human-retry", resumePhase:4, resumeAction:"gate"}`. **Remaining gaps after that fix:** (a) operator paths, (c) hydrate. **Fix-quality notes:** the unlock mapper maps everything non-`RT_E_GATE_PENDING` → `human-retry`, but `WILD_UNLOCK_TEXT["configure-key"]` (`engine.ts:3677`) exists precisely for `RT_E_LLM_NOT_CONFIGURED` (park says "human decision required" when the real unlock is "configure the LLM key"); `park.event` is hardcoded `"wild.paused"` while the ledger event may be `wild.paused_classifier`/`wild.paused_dod` — event should mirror the pause's own ledger row.
- **Verify (one command):** `node --experimental-strip-types ~/rt308_tracer/probe_park2.mjs` (expects `parkAfter:"NULL"` on slices a; after fix expect an object).
- **Box: FIX-A** (engine/store/headless).

**BUG-308-02 · class: not-wired (dead sink) · `wild.step_*` telemetry can never fire in production**
- **Trace:** `wildStep` (`engine.ts:4129-4132`) `const emit = opts?.onEvent` — but **no caller ever passes it**: `headless.ts:4008` + `headless.ts:4195` + `store.ts:1221` all call `wildStep(cur, reviewer ? { reviewer } : undefined)`. Repo-wide `grep -rn "onEvent" src scripts` (non-test) = 3 hits, **all in engine.ts itself** (def + use).
- **Effect:** `wild.step_start` / `wild.step_ok` / `wild.step_paused` / `wild.step_error` — documented at `engine.ts:3598-3600` + `types.ts:192-193` as "flattened into the `wild.step_*` telemetry payloads" — are **never emitted anywhere** (the event-scan "ok" tag for these names is a presence-not-emission false-positive: hits = the dead emit sites + readers + tests). Only `wild.step_timeout` fires (watchdog.ts:137). `wildSummaryPayload` (`engine.ts:4097-4116`) is dead code behind the dead sink.
- **Verify:** `grep -rn "onEvent" src scripts --include='*.ts' --include='*.tsx' --include='*.mjs' | grep -v test` → only engine.ts.
- **Box: FIX-A.**

**BUG-308-03 · class: fake-claim / lying-doc · healthy park (exit 2) is logged `level:"error"` → diagnose reports an incident for a success state**
- `rapidtool-cli.mjs:156`: `level: exitCode === 0 ? "info" : "error"` — exit 2 = "parked at HITL gate, `ok:true`, by design" (README-cli taxonomy) maps to error.
- **Live proof:** my e2e `gate --autopilot` → `{"ok":true,…, "exit_code":2}` (`~/rt308_tracer/e2e/gate.out.json`); B4 reproduced diagnose's false `unclassified-errors` class citing `{"level":"error",…,"event":"cli.invocation","message":"gate exit 2"}` (fixes/307_b4_sweep.md §F-2b, re-verified today at same line 156).
- **Suggested fix:** `level: exitCode === 0 || exitCode === 2 ? "info" : "error"` (owner's call; no test pins the mapping — grep).
- **Box: FIX-C.**

**BUG-308-08 · class: not-wired · delivered component renders nowhere: `PipelineRail` has ZERO imports**
- `src/components/pipeline-rail.tsx` was delivered (commit 800a40d) but `grep -rn "PipelineRail" src scripts` (today) → **0 hits outside its own file** — console.tsx never imports it; no route mounts it. Parent's P-4 confirmed live today ("console.tsx needs the 3-line import").
- **Impact:** every rail display is dark in the shipped app — park block (`:350/415/489`), `lastStep` block (`:337-342`), stall latch (`:420`, fixes/307 U2's "first real reader"), attention strip — including B-01's own rail consumers.
- **Verify:** `grep -rn "PipelineRail" src scripts | grep -v pipeline-rail.tsx` → empty.
- **Box: FIX-D** (console.tsx import + render slot).

### P2 — correctness / hygiene with real consequences

**BUG-308-04 · class: dead-code · rt-events catalogue: 34/56 names never really emitted + 4 dead constants**
- Scan today: **28 NEVER** (`sys.memory`, `boundary.crash`, `ui.action_error`, `wild.driver_*` ×5, `llm.ok/not_configured/transport_error/late_settle`, `chat.send_error`, `verify.error/ok`, `crew.turn_ok/error`, `runner.ok`, `cli.error`, `hydrate.ok/empty`, `persist.salvaged/ok`, `watcher.error/refused`, `harvest.error`, `search.unavailable`, `diagnose.ran`) + **6 TEST-ONLY** (`store.action_error`, `engine.phase_error`, `wild.driver_error`, `llm.timeout`, `llm.rejected`). Self-documented at `rt-events.ts:205-224` ("Emit one, or trim it").
- Dead consts (re-verified): `RtScope` (`rt-events.ts:59`), `WILD_STEP_AUTOPAUSE_MS` (`:250`), `LONGTASK_REPORT_MS` (`:262`), `LONGTASK_COALESCE_MS` (`:263`) — 0 external refs. **Contradiction beside them:** the LONGTASK comment says rt-client "coalesces on RT_COALESCE_MS (5 000 ms) while its own :456 comment claims '10 s coalesce'" — constant + comment drift (`rt-events.ts:256-261`).
- **Verify:** `node ~/w39q1_scratch/n6_event_scan.mjs` (from repo root) + `out_dead-exports.txt:360-363`.
- **Box: FIX-C.**

**BUG-308-05 · class: not-wired · doctor measured spend dropped when `--tree-dir` is used**
- **Trace:** `doctorStatus` (`headless.ts:3666-3689`): non-treeDir arm threads spend — `doctorFactory(process.env, opts?.spend ?? sessionTokenBudget().ledger)` (`:3672`); the treeDir arm **replaces the claim without spend** — `claim = doctor.factoryClaim(evidence, process.env)` (`:3677`; signature `doctor.ts:275` takes optional 3rd `spend`; `:343` is the 3-arg form). Result: `claim.spend = doctorSpend(undefined)` → `measured:false`, every token field null (doctor.ts:556-571) even when the session ledger has data. CLI path that supplies treeDir: `rapidtool-cli.mjs:3538` (`h.doctorStatus(tree ? { treeDir: tree } : undefined)`).
- **Verify:** `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --project proj.json --tree-dir <dir>` then read `factory.spend` (expect `measured:false` despite ledger rows). Or dev-read `headless.ts:3672` vs `:3677`.
- **Box: FIX-A** (headless.ts one-line + test).

**BUG-308-06 · class: dead-code · truly-dead exports**
- `readSessionToken` — `src/lib/auth/server.ts:255`, **0 refs** in src/scripts/server/vite.config (repo-wide scoped grep today). Dead export.
- `wildOperatorPark` — `engine.ts:3729`, 0 call sites (covered by B-01a; listed as the wiring hunk of that fix).
- Batch of internal-only exports (used in-file, exported unnecessarily — hygiene): `SignInButtons` (gates.tsx:63 use), `STALE_TURN_PREFIX` (chat.server.ts:568 use), `resolveGateEndpoints`, `p6BriefFitPasses` (maker-score.ts:386 use), `parseJsonDocument`, `isInsufficientFundsText`, `missingSignatureNames`, `tavilyApiKey`, `getSessionUser`, `handleAuthPopupRequest` (NOT dead — dynamic via `vite.config.ts:113-115`; dead-fns false positive).
- **Box: FIX-D** (auth/routes) for `readSessionToken`; **FIX-C** for scorecard/tavily trims; **FIX-A** owns `wildOperatorPark` wiring.

### P3 — hardening / notes (map rows, low heat)

**BUG-308-07 · class: crash-risk (hostile-input hardening) · H1 probe: 98 cases → 76 ok / 22 throws** (script: `~/rt308_m3/hostile1.ts`, re-run today, `~/rt308_m3/probe1_rerun.log`)
- Groups: `rt-ring` rtPush/rtTail/rtStats/rtSerialize on null/junk/negative-cap (5 throws, e.g. `rt-ring.ts:117/:139/:240`); `checkpoint.server` `checkpointAdmits(null)`/`boundProjectForCheckpoint(null)` (`:324`/`:137`); `diagnose` `buildDiagnosis(null)` + junk rows/timestamps `RangeError: Invalid time value` (`diagnose.ts:283`); `packet` `compileAgentPacket(null/junk)` ×5 (`packet.ts:514/:603/:687/:736`) + `packetInputHash(null)` (`:290`); `store.convergeRealRun(null/junk-base)` (`store.ts:406`).
- **Reachability triage (all guarded at real call sites):** NDJSON read validates `event:string`+`ts:number` before rows are pushed (`runtime-log.server.ts:173-183` + `sanitizeRtEvent`); CLI passes `crashSnapshot:null` always (`rapidtool-cli.mjs:3703`); client wraps snapshot import in try/catch (`rt-client.ts:~288`); `convergeRealRun` callers pass a live store project (`store.ts:1533`); `reportRt` wraps `rtPush` (`rt-client.ts:310`). ⇒ **no live crash path found; these are P3 hardening candidates** (defensive guards in pure helpers). The task's "2 by-design throws" expectation under-counts this surface (22 observed) — but none survives the reachability walk as a shipping crash.
- **Box: FIX-B** (packet/store/crew hardening) + **FIX-A** (rt-ring/checkpoint guards).

**NOTE-308-01 · quarantine lift-into-`emitProject` pending (tracked):** only the CLI forces-then-moves (`rapidtool-cli.mjs:1215-1221` via `quarantineDriver`); `emitProject` returns `survivors` (`headless.ts:1857`) but any non-CLI forced caller leaves them in place. Self-documented `quarantine.ts:16` TODO(R11-f08). **Box: FIX-B** (io/emit).

**NOTE-308-02 · `input_hash`: emit-only:** produced at `packet.ts:148` (`packetInputHash`), comment `:283` says it fingerprints packets — **zero non-test readers** (grep `input_hash` = packet.test/wild-step.test/headless.test only). Envelope field for external agents; keep-or-consume is an owner call. **Box: FIX-B.**

**NOTE-308-03 · rail `wild.auto`:** `pipeline-rail.tsx:145` builds a synthetic display row (`source:"wild"`, honest note "the wild loop's own newest activity line") — not an emitter, not a registry row. Census conflation explained. No fix needed; keep the note honest. (Parent's P-3 flagged it as an unregistered EMIT; re-read today shows it is a display-only row in the rail's `now` builder — no host emit, no registry pin exposure. Accurate disposition = no-fix note.)

**NOTE-308-04 · dead-fns false positive:** `handleAuthPopupRequest` IS wired — `vite.config.ts:64/113-115` dynamically imports and calls it. Do not delete.

**NOTE-308-05 · live-edit caveat:** engine.ts changed under this trace (sibling `parkIfNull` fix). After fixer lanes land, re-run `probe_park2.mjs` + `n6_event_scan.mjs` before closing any row.

**NOTE-308-06 · two event systems:** (1) rt-events catalogue rows (ring/NDJSON, registry-bound, `isKnownRtEvent` gate read-side only — single consumer `rt-timeline.ts:202`); (2) project-ledger `JsonLog` events (`{ts,phase,level,event,detail}` on `project.logs`, free-form BY DESIGN — e.g. `store.ts:625 "llm.degrade"`, `headless.ts:158 run.${status}`, all `hitl.*`/`p6.*`/`gate.verdict` census hits). The registry guardrail binds only system 1.

---

## 2. Consumer-check matrix (W40–W43 fields)

| Field | Producer | Real consumer(s) | Verdict |
|---|---|---|---|
| `budget` (packet envelope) | `packet.ts:426-441` → `:198-201` | console (packet tab), CLI `packet`; B4 live-proof (`"budget": null` keyless honest) | ✅ WIRED |
| `endClass` | `run-eval.mjs:2575/:2931/:3298` | `scorecard.ts:685-757` census → CLI `eval` | ✅ WIRED |
| `verification` | acceptance rows | `scorecard.ts:249/:345` → CLI | ✅ WIRED |
| `behaviorOk` / `kindOk` | `run-eval.mjs:1076-1078` | `scorecard.ts:247-248` → CLI `eval` | ✅ WIRED |
| `park` | `wildParkInfo` engine | `pipeline-rail.tsx:350/415/489`, diagnose summary | 🔴 **BROKEN** — null on operator+hydrate paths (B-01) |
| `WildStepSummary` / `lastStep` | `wildStampSummary` (`engine.ts:4091-4093`) | rail `:337-342` reads it; **hydrate drops it** (B-01c); telemetry payload dead (B-02) | 🔴 **PARTIAL** |
| `summary` (on WildStepResult) | `summarized()` `engine.ts:4140-4143` | rail, store loop (`store.ts:1229` pause check) | ✅ (in-memory) |
| `quarantine*` | `quarantine.ts` | CLI forced-emit only (`rapidtool-cli.mjs:1215-1221`) | ⚠️ CLI-only (NOTE-01) |
| `checkpoint*` | `checkpoint.server.ts` | CLI `resume` arm + `diagnose` read-only (`rapidtool-cli.mjs:3630-3643`); console = honest "no read seam yet" (TODO(N2)) | ✅ WIRED (CLI) |
| `input_hash` | `packet.ts:148` | tests only | ⚠️ emit-only (NOTE-02) |
| `factory.spend` | `headless.ts:3672` | CLI `doctor` `:3538` | 🔴 **BROKEN on treeDir arm** (B-05) |
| `ring.stall` latch | `rt-client.ts:345/528` | `pipeline-rail.tsx:420` (first real reader, W307 U2) | ✅ WIRED |
| `wild.auto` | rail display row only | — | ⚠️ not a wire (NOTE-03) |
| `WILD_STEP_BUDGET_MS` | `rt-events.ts:244` | console `:1207`, CLI `:3688` | ✅ WIRED |
| `WILD_STEP_AUTOPAUSE_MS` / `LONGTASK_*` / `RtScope` | `rt-events.ts` | none | 🔴 dead (B-04) |

---

## 3. Dependency traces (spine walks)

**T1 · wildStep spine:** `wildStep (engine.ts:4125)` → `emitStart/emitPaused/finishStep` → `parkIfNull → summarized → wildStampSummary` → `wildStepSummaryOf (4097+park flatten)` → store commit `commitWild (store.ts:1195-1206)` → `saveProject` → hydrate on next load.
- Broken hops: **(1)** sink absent at entry (`emit=opts?.onEvent` never passed — B-02); **(2)** `hydrateWildRun` rebuild drops `park`+`lastStep` on load (B-01c); **(3)** operator calls (`wildPauseRun`, `toggleWildPause`, cap) never pass through `finishStep` (B-01a).

**T2 · P6 edge chain:** `headless runPhase seam (:389)` → `runP6Edge (:2430)` → synthesis (`codegen.server.ts`) → `materializeEmitTree (:1731) → codegen.materializeImportableTree → scaffold.scaffoldProject` → `emitProject (:1764)` → `treeRunTrail (:1635, consumed :1774)`. No dead consumer found in this chain (all hops read; `runP6Edge` + `treeRunTrail` both have real consumers). **Clean.**

**T3 · emit → CLI arms:** `case "emit" (cli.mjs:1123)` → `headless.emitProject (:1764)` → `survivors (:1857)` → CLI quarantine move (`:1215-1221`). Broken hop: non-CLI forced callers never quarantine (NOTE-01). CLI arms parity (approve/refuse) verified live (approve refusal works: `RT_E_VALIDATION`).

**T4 · doctor/diagnose → fields:** `cli doctor (:3533-3538)` → `doctorStatus (headless:3590)` → `doctorFactory/factoryClaim` → `spend`. Broken hop: treeDir arm drops spend (B-05). `cli diagnose (:3553)` → checkpoint read `:3630-3643` (ok), `buildDiagnosis` with `crashSnapshot:null` (`:3703`) — guarded. **One break: B-05.**

---

## 4. Behavioral probes (raw evidence)

**P-1 · keyless e2e (mine, `~/rt308_tracer/e2e`, script `~/rt308_tracer/tracer_e2e.sh`):**
- `create` exit 0 → `{"ok":true,"path":"…proj.json","enforceDod":false}` (keyless honest default)
- `gate --autopilot` **exit 2** (by-design park) → `{"ok":true,…, "status":"awaiting_hitl", "currentPhase":4, "steps":5, "exit_code":2}`
- `approve --force` **exit 1** → refused `RT_E_VALIDATION` ("never mint decidedBy:human from an agent") ✅
- `diagnose` exit 0 ✅ · `packet` exit 0 (10,241 B md) ✅ · `eval` exit 0 ✅
- `wild --start` exit 0 → `{"outcome":"paused","steps":1,"note":"Classifier not configured."}`; `wild --stop` exit 0
- Envelopes contain **no nulls that shouldn't be null** except the park record (B-01).

**P-2 · park:null proof (mine, `~/rt308_tracer/probe_park2.mjs`):** output verbatim:
```
(1) operator pause (wildPauseRun): {ok:true, changed:true, pauseAfter:true, parkAfter:"NULL", lastAutoLog:"Wild run paused from the CLI."}
(2) wildOperatorPark() would produce: {code:null, event:null, unlock:"resume", resumePhase:4, resumeAction:"gate"}
(3) engine wildPause() with NO park arg: {pauseAfter:true, parkAfter:"NULL"}
```
After the sibling `parkIfNull` fix (live), `wild --start` park = `{code:"RT_E_LLM_NOT_CONFIGURED", event:"wild.paused", unlock:"human-retry", resumePhase:4, resumeAction:"gate"}` — proof the fix works for wildStep pauses; operator paths still NULL.

**P-3 · H1 hostile probe (re-run today):** `cases=98 ok=76 throw=22 coded=0` — triaged in B-07 (all guarded at real call sites).

**P-4 · event scan (today):** `registered=56 never-or-test-only=34`.

---

## 5. TODO census triage (99 hits src+scripts · 73 non-test)

| Class | Count | Disposition |
|---|---|---|
| `TODO(` total | 99 (73 non-test) | triaged below |
| … E-15 stub vocabulary (`scaffold.ts` ×34 + tests) | 34+ | **by-design** emitted refusal vocabulary, censused by doctor/dod |
| … tracked coded-shell rows (FM-03b/FM-04b · R13-f02 ×4 · R13-f09 · R13-f14 · R11-f08 · A1-17/A1-25 · R3-f03/f06 · A3-f07 · R14-f01 ×2) | ~25 | each names its owning row; **not-wired-but-tracked**; the load-bearing ones: `llm/providers/registry.ts:701` (failover chain "ARM here" — failover not armed), `headless.ts:3897/:3938` (pause-before-first-mutation pending), `quarantine.ts:16` (NOTE-01), `wild-review.ts:95` (keyed evidence run pending — reviewer itself binds the real provider, verified) |
| … rt-events dead-const notes | 4 | B-04 (re-verified) |
| … console honest disclosures (`:6778/:6840/:6843/:6888/:6899`) | 5 | honest UI "not wired" titles — KEEP |
| … zero-consumer KEEP-notes (`packet.ts:1005` F2-07, `crew.server.ts:1460` F2-09) | 2 | documented de-scope; consistent with my grep (0 consumers) |
| `FIXME`/`XXX`/`coming soon` | 0/0/0 | clean |

---

## 6. Fixer partition — 4 boxes

| Box | Owns files | Rows |
|---|---|---|
| **FIX-A** engine/store/headless | `src/lib/engine.ts` · `src/lib/store.ts` · `src/lib/headless.ts` | **B-01** (finish operator paths: wire `wildOperatorPark` into `headless.wildPauseRun:4228` + `store.ts:1244` cap + `store.ts:1275` toggle; fix `hydrateWildRun:2096` to carry `park`/`lastStep` when shaped right; verify sibling `parkIfNull` unlock map — `configure-key` for `RT_E_LLM_NOT_CONFIGURED`, park.event mirrors pause's ledger event) · **B-02** (pass a real `onEvent` sink at `store.ts:1221` + `headless.ts:4008/:4195` — e.g. reportRt/NDJSON appender) · **B-05** (thread spend at `headless.ts:3677`) · B-07 rt-ring/checkpoint guards |
| **FIX-B** packet/llm/crew/io | `src/lib/packet.ts` · `src/lib/io.ts` · `src/lib/loader/`* (`llm/providers/*`) · `src/lib/crew.server.ts` · `src/lib/quarantine.ts` | NOTE-01 (lift quarantine into `emitProject` or document CLI-only) · NOTE-02 (`input_hash` consume-or-note) · B-07 packet hardening · `registry.ts:701` failover arm (tracked) |
| **FIX-C** cli/rt-events/diagnose/scorecard/run-eval | `scripts/rapidtool-cli.mjs` · `src/lib/rt-events.ts` · `src/lib/diagnose.ts` · `src/lib/scorecard.ts` · `scripts/run-eval.mjs` | **B-03** (`rapidtool-cli.mjs:156` exit-2 level map) · **B-04** (echo-or-trim the 34 never-emitted names + 4 dead consts + LONGTASK comment drift) |
| **FIX-D** UI/console/rail/routes | `src/components/*` · `src/routes/*` · `src/lib/auth/*` | **B-08 mount `PipelineRail` (console.tsx 3-line import — renders nowhere today)** · B-06 `readSessionToken` removal · rail: gate the Parked block on `wr.pause === true` (stale-park render at `pipeline-rail.tsx:474-490` — pairs with FIX-A hydrate fix) · internal-only export trims |

> Box routing for the WD-rescued rows in §R (each row's own tag governs): FIX-A ← M4-03…M4-08 + M3 checkpoint/store rows · FIX-B ← M4-09/M4-10/M4-16 + M3 packet rows · FIX-C ← M4-11…M4-14 + M3 rt-ring/diagnose rows · FIX-D ← M4-01/M4-02/M4-15/M4-17.

---

## 7. Top-10 insanely-fast wins (small diffs, big trust)

1. `rapidtool-cli.mjs:156` — one-line level map (`exit 2 → info/warn`); kills the false `unclassified-errors` diagnose class. (FIX-C)
2. Wire `wildOperatorPark` into the 3 operator paths (3 small call-site edits). (FIX-A)
3. `hydrateWildRun` — carry `park`/`lastStep` through load when object-shaped (~10 lines). (FIX-A)
4. `headless.ts:3677` — pass `opts?.spend ?? sessionTokenBudget().ledger` into `factoryClaim` (1 line + existing tests). (FIX-A)
5. Re-map `parkIfNull` unlocks (`RT_E_LLM_NOT_CONFIGURED → configure-key`) + `park.event` from the pause row (verify sibling fix; ~5 lines). (FIX-A)
6. Pass an `onEvent` sink at the 3 wildStep call sites → 4 dead events instantly live (`wild.step_start/ok/paused/error`). (FIX-A)
7. Trim-or-annotate the 4 dead rt-events consts + fix the LONGTASK 5s/10s comment drift (single file). (FIX-C)
8. Batch-trim the 28 never-emitted registry names OR file them as emitters in one pass (owner decision; single file). (FIX-C)
9. Delete `readSessionToken` (1 line) — or wire its intended middleware read. (FIX-D)
10. **Mount `PipelineRail`** in console.tsx (3-line import — B-08; fully built, renders NOWHERE today) + gate its Parked block on `wr.pause === true` (stale-park guard). (FIX-D)

---

## 8. Trace hygiene notes

- **Nothing edited by the tracer**: `git status` delta attributable to me = `?? fixes/308_bugmap.md` only (plus pre-existing sibling files: `M src/lib/engine.ts`, `?? err2.txt`, `?? eslint.probe2.config.mjs`, `?? tsconfig.probe2-*.json`, `?? fixes/308_map5_parent.md` — NOT mine, left untouched).
- Scratch locations (all outside repo): `~/rt308_tracer/` (my probes), `~/rt308_m3/` (M3-era probe material re-used/re-verified), `~/w39q1_scratch/` (instrument outputs `out_*.txt`, `tc.txt`, `lint.txt`, `todo_census.txt`, `consumer_check.txt`).
- Legs run FOREGROUND; keyless only; no commits.
- **Collaboration note:** this file also carries the watchdog's rescued §R sections (Mapper-3 runtime + Mapper-4 claim-vs-code rows, whose own files were never written). Amended per WD protocol: my sections stay above, rescues below. The WD damage note records that my earlier full-file write (10:35:27) transiently overwrote a 10:33-10:37 rescue append — re-applied at 10:37; recoverable copies at `~/rt308_wd/recovered_m3.md` / `recovered_m4.md`. The file shows `M` in git index (staged by a sibling) — **zero commits were made by anyone**.
- **Cross-refs:** `fixes/308_map5_parent.md` — their P-1/P-2 (wildStep-pause park fix, parent-proven 10:32) ↔ my B-01 which documents the fix and the REMAINING slices (operator paths + hydrate erase → `wild --pause` ⇒ `park:NULL`; `wild --resume` ⇒ park+lastStep keys gone); P-4 ↔ my B-08 (confirmed 0 importers); P-3 restated in NOTE-03; P-5 agreed owner-gated. §R below ← M3/M4 rows (box routing in §6 note).

---

## R. WATCHDOG RESCUES — summary-only findings (`WD-RESCUE`)

> **[WD-308 · 2026-09-29 10:37]** RESCUE-1 (re-applied): MAPPER-3 and MAPPER-4 both hit the iteration cap BEFORE writing their files (`fixes/308_map3_runtime.md`, `fixes/308_map4_claims.md` **do not exist**). Their complete row sets lived only in their final summaries → rescued here condensed (ID · class · file:line · evidence · box). Full verbatim summaries preserved at `~/rt308_wd/recovered_m3.md` / `~/rt308_wd/recovered_m4.md` (+ in the Hermes messages DB; delegation delivers them to the parent).
> **Damage note:** this section + the marker block were first appended 10:33–10:37, then **overwritten by the tracer's full-file `write_file` (10:35:27, 24 319 B — its own collision warning: "A sibling modified `fixes/308_bugmap.md` mid-write and I've overwritten it")**. Re-applied per protocol; recoverable copies above.

### R1. MAPPER-3 (runtime/dynamic) — 18 rows · deliverable file NEVER WRITTEN

*(cross-ref: the tracer's **BUG-308-07** is the aggregate P3 view of this same probe material — per-row detail kept here, nothing dropped.)* All repros via strip-types scratch scripts importing `src/lib/<mod>.ts` (probe: 98 hostile cases → 76 ok / 22 raw throws, 0 coded refusals). HIGH = reachable from hand-edited/foreign project or CLI input.

| ID | class | file:line | evidence (repro → observed) | sev | box |
|----|-------|-----------|------------------------------|-----|-----|
| M3-01 | throw-not-refusal | `rt-ring.ts:117` | `rtPush(ring,null)` / `(ring,undefined)` → `TypeError: reading 'ts'` | MED | C |
| M3-02 | throw-not-refusal + **spin** | `rt-ring.ts:139` | `rtPush(ring,row,{cap:-3})` → **~7.8 s busy loop then** `RangeError: Invalid array length` (timed, `t_capneg.mjs`) | **HIGH** | C |
| M3-03 | silent-wrong | `rt-ring.ts:138` | `rtPush(ring,row,{cap:NaN})` → row uncapped (NaN compare always false) | LOW | C |
| M3-04 | throw-not-refusal | `rt-ring.ts:127` | `rtPush(null,row)` → `TypeError: reading 'rows'` | MED | C |
| M3-05 | throw-not-refusal | `rt-ring.ts:240` | `rtTail(null,3)` → TypeError | LOW | C |
| M3-06 | throw-not-refusal | `rt-ring.ts:245/250` | `rtStats(null)` → TypeError; `rtStats({rows:[null]})` → TypeError `reading 'level'` | MED | C |
| M3-07 | throw-not-refusal | `rt-ring.ts:156` | `rtSerialize(null)` → TypeError | LOW | C |
| M3-08 | throw-not-refusal | `checkpoint.server.ts:324` | `checkpointAdmits(ckpt,null)` → `TypeError: reading 'projectId'` (guard covers `checkpoint`, not `ask`) | MED | A |
| M3-09 | throw-not-refusal | `checkpoint.server.ts:137` | `boundProjectForCheckpoint(null)` → `TypeError: reading 'logs'` (writeCheckpoint guards this; the export does not) | MED | A |
| M3-10 | throw-not-refusal | `diagnose.ts:144` | `buildDiagnosis(null)` → `TypeError: reading 'errors'` (input itself not `?? default`-guarded) | **HIGH** | C |
| M3-11 | throw-not-refusal | `diagnose.ts:212` | `buildDiagnosis({errors:[null,5,{…}]})` → `TypeError: reading 'scope'` (junk rows unfiltered) | **HIGH** | C |
| M3-12 | throw-not-refusal | `diagnose.ts:283` | crashSnapshot `{at:"y"}` → `RangeError: Invalid time value` (`new Date(…).toISOString()`) | MED | C |
| M3-13 | throw-not-refusal | `packet.ts:514` | `compileAgentPacket(null)` → TypeError | MED | B |
| M3-14 | throw-not-refusal | `packet.ts:603` | `compileAgentPacket({})` → `TypeError: reading 'filter'` | MED | B |
| M3-15 | throw-not-refusal | `packet.ts:687` | `compileAgentPacket({brief:42})` / `{brief:null}` → `TypeError: brief.trim` / `reading 'trim'` | **HIGH** | B |
| M3-16 | throw-not-refusal | `packet.ts:736` | `{schedule:{tightness:"x"}}` → `TypeError: reading 'length'` | MED | B |
| M3-17 | throw-not-refusal | `packet.ts:290` | `packetInputHash(null)` → TypeError | LOW | B |
| M3-18 | throw-not-refusal | `store.ts:406` | `convergeRealRun(null,null,null)` → TypeError; junk `artifacts` → `not iterable` | MED | A |

**M3 NOT-CLEAN caveat (do NOT report as green):** full 195-case CLI fuzz launched (`proc_0fbe2ea0dfd4`) and **never read**; keyless e2e real envelopes (`~/rt308_m3/e2e/*.out.json`) **unread**; CLI-leg unhandled-rejection sweep **not run**. Silent-wrong candidates: `rtStats` leaks non-row entries; `packetSpendSummary(1e308*10)` → null (arguably honest); NaN/999 phase passes by design (`PHASES[..] ?? PHASES[0]`). PASS: `packetSpendSummary`/`packetBudgetBoundary` hostile inputs → null.

### R2. MAPPER-4 (claim-vs-code) — 17 rows · deliverable file NEVER WRITTEN

*(cross-refs vs tracer map: M4-03/M4-06 ↔ **BUG-308-01**; M4-14 ↔ **BUG-308-04**; M4-11/M4-12 ↔ **BUG-308-04/06** class; M4-01 ↔ **map5 P-4**; M4-09/M4-10 ↔ **map5 §2** B-lane handoffs.)*

| ID | class | file:line | claim vs bytes | sev | box |
|----|-------|-----------|----------------|-----|-----|
| M4-01 | half-landing | `pipeline-rail.tsx:384` (whole file) | 800a40d claims rail "delivered"; `grep -rn "PipelineRail" src/` → **0 importers** (= map5 P-4) | HIGH | D |
| M4-02 | lying-doc | `pipeline-rail.tsx:416-419` | "First real reader [of stall latch]" — never mounted ⇒ still zero readers; also reads `snap.ring.stall`, not `peekStall()` | HIGH | D |
| M4-03 | lying-type | `types.ts:170-186, 239-240` | `WildParkInfo` "present iff pause"; bytes: 19 `wildPause(` sites, exactly 1 passes park; `grep -n "unlock:"` = 2 hits ⇒ **18 sites stamp `park:null`** (= map5 P-1/P-2; = BUG-308-01) | HIGH | A |
| M4-04 | half-landing (K3) | `types.ts:212-213` vs `engine.ts:4086-4089` | `lastStep.park` "iff action==='park'"; bytes: `paused ? after.wildRun?.park ?? null : null` ⇒ absent on the 18 park paths | MED | A |
| M4-05 | half-landing | `store.ts:1244` | step cap calls bare `wildPause(…)` → park null; UI "parked · uncoded · …" branch unreachable for it | MED | A |
| M4-06 | half-landing | `engine.ts:3729-3740` vs `headless.ts:4228` | `wildOperatorPark` has **0 call sites repo-wide**; CLI pause passes no park ⇒ `park:null` | MED | A |
| M4-07 | lying-doc | `engine.ts:4147` | "W43 repair" implies rewire landed; only 1 of 5 `finishStep` sites got the park arg | LOW | A |
| M4-08 | lying-type | `types.ts:106-118` | `retireMemory` **does not exist** (2 comment hits only); `LESSON_RETIRE_COUNTER` bites only `knowledge.ts:692`; memory `supersedes`/`counterEvidence` no consumer | MED | A |
| M4-09 | lying-doc | `scripts/run-eval.mjs:1179-1193` | B2's cache emit + read-side spec; `grep -c cachedPromptTokens run-eval.mjs` = **0** ⇒ cache spend invisible end-to-end | MED | B |
| M4-10 | half-landing (K3) | `307_b2_backends.md:41` vs `307_b4_sweep.md:5` | `run-eval.mjs` read-sides claimed by BOTH lanes; B4 closed "ALL GREEN" without the fold ⇒ ownership twice, done zero | MED | B |
| M4-11 | lying-doc | `AGENTS.md:50` | "35 verbs" vs `grep -c 'case "'` = **39**; README:9 + README-cli:10 both say 39 | MED | C |
| M4-12 | lying-doc (counts) | `README.md:403-406, 311, 591` | "4 components"/"211 src"/"460 fixes" vs bytes **5/212/475** (+15 W42 logs) | LOW | C |
| M4-13 | lying-doc | `rt-events.ts:204-223` vs `:144` | dead-name census pins "38 of 56"; table gained `ui.boundary_crash` (:144) at HEAD+3 ⇒ arithmetic not re-derived | LOW | C |
| M4-14 | lying-doc | `rt-events.ts:257-263` | rt-client.ts:454 comment "10 s coalesce" but :465 uses `RT_COALESCE_MS`=5000 (:276); `LONGTASK_COALESCE_MS`=10000 has 0 refs | LOW | C |
| M4-15 | half-landing | `rapidtool-cli.mjs:288-296` + `headless.ts:1571-1574` | quarantine wire REAL but 307_u1 log is a 26-line stub; 800a40d claims "U1 UI sweep clean" without bytes | MED | D |
| M4-16 | half-landing (candidate) | `packet.ts:1005-1009` (`exportProfiles`), `scaffold.ts:2669` (`deployNotes`) | TODO(F2-07) additions with 0 callers (`scaffold.ts:2986` still calls `deplyNotes`) | LOW | B |
| M4-17 | doc-drift (candidate, **unverified**) | `console.tsx:3379, 3408` | `≈{tokenEst.tokensEst} tok` next to byte-true chars; estimator basis not yet read — flag only | LOW | D |

**M4 CLEAN list (do not re-hunt):** entry-runs real (`run-eval.mjs:795` + spawnSync env allowlist `:162`) · crew budget seam (`crew.server.ts:947-1000` → `runPlanAct`; `RT_E_BUDGET_EXHAUSTED` :1198) · quarantine CLI wire (`cli.mjs:285-300, 1215-1230`; `EMIT_SKIP_DIRS`) · doctor spend (`headless.ts` + `DOCTOR_SPEND_FLOOR`) · `safe()` registry gate (`cli.mjs:205-233`) · `growth.counts` CLOSED (`console.tsx:4477-4483` → `rt-client.ts:674`) · chat restore count honest (`console.tsx:5918`) · packet `input_hash`/`budget`/`acceptance` real · `ui.boundary_crash` registered+emitted (`error-component.tsx:60`) · rail label words match `console.tsx:87-125` · docs flipped post-wire at `79f35b1`.

### R3. TRACER-6 (boundary/adversarial) — 9 rows + 1 coverage gap · deliverable file NEVER WRITTEN

> **[WD-308 · 2026-09-29 10:46]** RESCUE-3: TRACER-6 (`deleg_0474ca8f/task-1`) hit the iteration cap (10:43:01, 842s) BEFORE writing `fixes/308_map7_boundary.md` (**file does not exist**). Its row set lived only in its final summary (which itself hands off: "the full row set is handed over below for the parent/watchdog to rescue"). Full verbatim: `~/rt308_wd/recovered_t6.md` + re-runnable probes `~/rt6/probes/p1_fs.mjs · p1_cli.sh · p2_emit.mjs · p3_roundtrip.mjs`.

| ID | class | file:line | recipe → output | sev | box |
|----|-------|-----------|------------------|-----|-----|
| M7-01 | round-trip NOT byte-exact (additive drift) | `engine.ts:1979` (`kept.push({...r, rejectionHistory: r.rejectionHistory ?? [], gate: r.gate ?? null})`) + `:2311` research + `:2339` implementationSpec + `:1983` | `importProject(exportProjectJson(p))` on a real keyless run: `R2 {"equal":false,"len1":46603,"len2":47221}`; 24 structured diffs, all "key ADDED" (`rejectionHistory:[]` ×13, `gate:null` ×9, `research:[]`, `implementationSpec:null`); `hydrateProject(p)` alone same drift; fixed point after one hop; `packet()` stable (R6); a reloaded clone emits a detectably different `.rapidtool/project.json` (`p2 clone-2 changed`). | MED | A |
| M7-02 | uncoded throw escaping `emitProject`'s `{ok:false}` contract | `headless.ts:1818` (`mkdirSync`) | `emitProject(proj, "<parent-is-a-FILE>/out")` → **THREW** `ENOTDIR`; CLI `emit --out afile/out` → `exit=4 RT_E_INTERNAL` (c7); every other emit failure is coded (`RT_E_FOREIGN_FILES`/`RT_E_BUSY`) | low-med | A |
| M7-03 | uncoded throw — read-only target dir | `headless.ts:1818/1822` | `emitProject(roDir)` (icacls-deny) → **THREW** `EPERM … .rapidtool-emit.lock`; CLI maps correctly (`c8 exit=4 RT_E_PERMISSION_DENIED`) but the API-level throw bypasses the emit contract. | low | A |
| M7-04 | uncoded throw — `saveProject` path hostility | `headless.ts:102/106` | parent-is-a-FILE → `EEXIST: mkdir '…\afile'` (C1); read-only dir → `EPERM … .lock` (E7). `saveProject` has no coded-refusal contract (throws by design) — recorded so it is not re-hunted. | low | A |
| M7-05 | wrong error class on directory-as-file read | `errors.ts:236-262` (`EISDIR` matches no matcher) | `loadProject(<dir>)` → `EISDIR`; CLI `run --project .` → `exit=1 RT_E_VALIDATION` (c6) — a wrong-KIND path reported as a validation failure, not a path-class refusal. | low | C/A |
| M7-06 | env failure reported as "missing" | `checkpoint.server.ts:239` | `.rapidtool` is a **FILE** → `readCheckpoint` returns `RT_E_CHECKPOINT_MISSING` when the true condition is `ENOTDIR` (c12/D2); `clearCheckpoint` on the same shape correctly returns `RT_E_VALIDATION` (D3) → **inconsistent class between siblings**. | low | A |
| M7-07 | force-emit rolls the whole emit back on file-where-dir | `headless.ts:1836-1870` | `.rapidtool` FILE + `force:true` → `{ok:false, code:"RT_E_INTERNAL", "emit rolled back: EEXIST … mkdir '….rapidtool'"}` (E1f); default policy correctly coded (`RT_E_FOREIGN_FILES`, E1) — but generic INTERNAL for a boundary condition. | low | A |
| M7-08 | env-cap hostility: metered-looking unmetered, permissive spellings | `token-ledger.ts:138-145` | `"0"/"-1"/"NaN"/""/"  "/"Infinity"` → unmetered ✔; but `"0x10"` → **16**, `"1e99"` → **1e99** accepted (`isUnmetered(1e99)===false`) — a `1e99` cap silently can never trigger while the envelope reports a cap in force. | low | B |
| M7-09 | **COVERAGE GAP (honesty row, not a product defect)** | — | **Scale probes NOT executed:** 1,000-artifact/5,000-log project timing, diagnose/packet/gate O(n²) measurement, ring at 10k rows, `readRtTail` at 256KB±1 (`runtime-log.server.ts:135-166` read but unprobed); `RAPIDTOOL_BIND_ALL=1` (`vite.config.ts:160`, opt-in) unprobed at runtime. Do not report scale as clean. | — | — |

**M7 VERIFIED CLEAN (do not re-hunt — evidence today):** emit idempotence FIXED end-to-end (same project → two dirs byte-identical, 18/17 files; in-place re-emit identical; `treeRun` does not mutate subject; re-emit after treeRun identical) · `writeCheckpoint` model citizen (coded on every hostile shape, D1–D8) · `importProject` string hostility coded, no throws (A1–A5) · locks coded (`RT_E_BUSY`, C4/E5) · Unicode + spaces + trailing-dot dir names work (C2/C2b/C3/E2/E3) · `HOME/TEMP/TMP/USERPROFILE` unset → `create` exits 0 (c14) · ledger round-trip byte-stable incl. cache fields (R12–R15) · eval-out JSON exact (R16) · `packet()` deterministic across calls + reload (R5/R6) · checkpoint bytes JSON-stable (R9) · `diagnose` on 0-byte json degrades `ok:true` (c10). **Cap note:** M7-01 line refs confirmed by grep/read; the `research`/`implementationSpec` normalization tail was not fully traced.

---

> **[WD-308 · 2026-09-29 10:38]** PROTOCOL: append-only — new rows/sections go ABOVE the WATCHDOG-END marker; the marker stays the LAST line. The watchdog relocates it if a writer appends below, re-applies it if a writer overwrites it (see Damage note above), and rescues any finding that lives only in a summary (rescued rows carry a `WD-RESCUE` tag).

<!-- WATCHDOG-END (unchanged; append ABOVE this line only) -->
