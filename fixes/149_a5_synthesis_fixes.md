# 149 — A5 SYNTHESIS + FIX LIST: is RapidTool an autonomous software factory today?

Analyst: A5 (SYNTHESIS + FIX LIST) · lane: analysis-only (read-only; this log is the only write) ·
Date: 2026-09-08 · Evidence basis: disk state at analysis time — fixes/145 (M7 proof), 146 (code
research), 147 (E1/E2/E3/E4 landed) verified against `src/lib/*`, `scripts/*`, `research/eval-out/`.
NOTE: the concurrent fixes/148 wave (F1–F4: codegen/headless/tests) had **not** landed a log yet when
this was written; anchors below reflect the pre-148 disk. Suite was green 1353/1353 at 147 landing;
no re-run here (other lanes gate).

---

## 1. THE BAR — irreducible capabilities of an "autonomous software factory", measured against code

| # | Irreducible capability (definition used here) | Verdict | Evidence anchor (verified on disk) |
|---|---|---|---|
| C1 | **Loop ownership** — the harness, not the human, drives produce→verify→repair→repeat to a defined terminal state, and can be left alone | **TRUE** (internal loop) / **FALSE** (artifact loop — see F-A) | `driveP6Journey` bounded produce→run→repair, budget 3, headless.ts:1270-1378 (`P6_JOURNEY_DEFAULT_BUDGET` :1112); wild driver loop caps at 20 steps store.ts:978-1001; run-eval single-synthesis keyed flow scripts/run-eval.mjs:13-20, :343-350. But NO verb can take an *emitted dir* and continue — see F-A |
| C2 | **Produce→verify→repair with the artifact itself as feedback** — failures observed by running the artifact feed a repair that changes the artifact | **PARTIAL** — feedback reaches prompts, never edits code | Tree-failure tail → next synthesis context: headless.ts:1068-1072 (`p6CycleLiveDeps`), :1172-1186 (`defaultP6Synthesize` stamps `p6.tree.failure` + passes `deps.treeFailure`), codegen.server.ts:972/:177-180 (repair tail reader). Repair is **whole-artifact re-prompt**: verify.server.ts:650-668 ("Return ONLY the complete corrected module source"); codegen re-synthesizes per repair class codegen.server.ts:1073+. **No apply-patch/continue primitive exists anywhere** (no dir→project ingest, no `--open`); per-cycle tree dirs are deleted after the verdict headless.ts:1192-1227 |
| C3 | **Bounded resources + honest stop** — every loop has a budget; failure parks loudly with a code, never a fake pass | **TRUE** | `P6_SYNTH_TIMEOUT_MS` 90s / `P6_SYNTH_MAX_ATTEMPTS` 2 / backoff codegen.server.ts:98/:764-765; journey budget headless.ts:1112; wild cap 20 store.ts:978; tail caps 1500; keyed run evidence M8=1 (3/3 inside budget), M9=1 (`RT_E_LLM_TIMEOUT` parked loudly — results.json) |
| C4 | **Cross-run learning that changes future behavior** — a past failure alters a future synthesis parameter or prompt | **PARTIAL** — advisory text only, one narrow channel, never a parameter | Lessons re-inject into the P6 *expansion prompt* when the spec cache misses: codegen.server.ts:1004-1016 (`selectLessons` → `lessonLinesForBrief`, gated on `spec === null`; spec is cached by briefHash :996-1002, so a re-run of the same brief never re-consults lessons). Reframe branch engine.ts:600-625 (D2, untested branch per 146). Human-gated store + verb family landed: rapidtool-cli.mjs:1168+ (list/propose/accept/supersede/refute). Tier-1 packet seed wired: rapidtool-cli.mjs:613-620. **No lesson ever changes a budget/model/temperature.** Bug: wild-mode.server.ts:28-29 imports `EXPAND_LESSON_RANK_LIMIT, lessonLinesForBrief, selectLessons` — **zero consumers in the file** |
| C5 | **Human gates where judgment is irreplaceable** | **TRUE** | HITL approval/rejection headless.ts:637/:657; forceHuman P6 sandbox is human-only codegen.server.ts:979-981; lesson cross-project writes human-gated (cli `--accept`, cli:1176-1177); enforce-DoD is a hard block when enabled (146 M4 row) |
| C6 | **Runs the user's real workflow as the oracle** — verification executes the actual thing the brief demanded | **FALSE** — the oracle is a self-generated spec, never the user's workflow | treeRun = per-file parse + emitted `tests/*.spec.ts` under node:test + entry smoke (compile-check.server.ts:603 `treeRun`). The spec asserts *what the emitted modules do today* — module-truth of the deterministic template, CheckpointStore round-trips, ENDPOINTS↔contract equality, stub-reject rows (scaffold.ts:864-884) — generated from `project.oracle`, which is authored by the pipeline's own A7 research, not by replaying the user's workflow. Corpus `expectedCapabilities` never enter the emitted oracle spec (maker-score computes coverage only at eval time) |
| C7 | **Dependency/install reality** — what was emitted can actually run as its kind (webapp build/dev) | **FALSE** | Emitted `package.json` declares react/vite/tailwind deps + `build: vite build` for webapp (scaffold.ts:440-486), but emit writes files only — no `npm install`, no build step, ever (headless.ts:1015-1044). treeRun's TS compile uses the *repo's* devDeps (compile-check.server.ts:87). An emitted webapp tree has never run under vite; only node-runnable oracle specs + entry smoke are executed |

### F-A (the single biggest factory gap, stated precisely)
**The emit→edit→re-emit continuation loop does not exist.** The emitted directory is a one-way
projection of the in-memory project: `emitProject` writes `scaffoldProject(project).files` wholesale
(headless.ts:1026-1043; `emit --run` re-emits **over** the target before running — rapidtool-cli.mjs:678
then :712-715, clobber warning at :690-694). No verb reads a directory back, no verb runs tests over an
arbitrary dir (`check` is compile-only, README-cli; `treeRun` is reachable only via `emit --run` on a
just-re-emitted dir or the journey's throwaway temp dir). An agent who edits the emitted tree has no
oracle, and the factory cannot learn from those edits. C1-artifact and C2 are FALSE for exactly this reason.

---

## 2. THE VERDICT

**RapidTool is not yet an autonomous software factory. It is an autonomous *pipeline* with a
factory-shaped front door: it owns a bounded produce→verify→repair loop over its own internal
project artifact, runs it honestly within budgets, and now scores itself — but the repair loop
edits prompts, never code; the artifact it verifies is a self-authored oracle scaffold, not the
user's workflow; nothing can continue from an edited emitted tree; and on the one real keyed run,
the LLM produce→verify→repair loop did not converge at all.** What the 6/9 keyed run proved: the
*drain + emit + treeRun + scoring* machine works end-to-end on a real brief with a real key — the
final emission's oracle suite ran green (15/0) and the run scored itself loudly and honestly
(M5=1 red-gate surfacing, M6=1 handover dir with DEPLOY.md, M8=1 budget, M9=1 loud timeout stop,
M7=1 above the keyless baseline). What it did **not** prove: the green 15/0 treeRun ran over the
**deterministic floor scaffold** — the keyed journey itself FAILED (`RT_E_LLM_TIMEOUT · chunk 1/3
refused`, 3/3 cycles exhausted → floor stands, no `generatedTree` → M1=0, no tested-mint → M3/M4=0;
results.json + eval-out/coffeehouse2home-property-ledger/). "Autonomously produces + verifies +
scores software for ≤8-signature single modules" is therefore true for the *deterministic*
single-module path only; keyed LLM trees have never yet converged green on a real run, and the
7 demanded capabilities (the brief's actual semantics) are still listed, unrepaired, in
`coverage.missing` while `treeRunOk: true` sits beside them.

> **factory: 4/10** — autonomously runs a bounded, honest, self-scoring produce→verify pipeline whose
> deterministic emissions execute green, but it cannot autonomously FIX a failing emitted app's
> semantics (repair re-prompts from failure text and never edits code), has no continue-from-artifact
> loop (emit is a one-way projection), never runs the user's real workflow (oracle = self-authored
> spec), never installs/ builds a webapp emission, and its only keyed end-to-end run converged to the
> floor, not to LLM-produced code. 6/9 on the maker rubric is real and honest — but 3 of the 6 points
> (M5/M8/M9) measure honesty and budget discipline, not production.

---

## 3. FINDINGS REGISTER (bug-level, read from code — no guessing)

- **F1 (P1) — Wild-mode keyed P6 parity is FALSE by construction.** `wildStep`'s execute branch runs
  `applyPhaseResult(running, phase)` — the deterministic floor — even when a key is present
  (engine.ts:3562-3568). `liveLayer`/codegen is never invoked on a wild P6 step. The wild reviewer is
  LLM-backed when keyed (wild-mode.server.ts:25, `complete` facade) but judges artifacts + `lastTest`
  + DoD verdict only (buildWildReviewPrompt wild-mode.server.ts:87-135) — **it never sees a treeRun
  outcome or capability coverage**. So wild mode can approve a green-looking floor artifact that
  satisfies none of the brief's capabilities. 146 flagged this "PARTIAL / NO LOG"; code says: no keyed
  synthesis path exists in wild mode at all.
- **F2 (P2) — `wild-mode.server.ts:28-29` imports `EXPAND_LESSON_RANK_LIMIT`, `lessonLinesForBrief`,
  `selectLessons` with zero consumers in the file** (only the two import lines match). Either dead
  imports (lint/typecheck exposure) or a half-wired intent to put lessons into the wild reviewer's
  context. Concurrent-wave caution: 148 F-lanes own codegen/headless/tests, not this file.
- **F3 (P2) — Pause is not durable across reload, by design, and the UI can't say so precisely.**
  `hydrateWildRun` force-stops **every** persisted active run — including an intentionally *paused*
  one (engine.ts:1959-1964 stops `active:true` regardless of `pause`). After reload the console shows
  "Run paused after reload… a stopped run stays stopped" (console.tsx:822-826) and the Resume button
  is gone (`active !== true`), so an operator who paused a long run, then closed the tab, cannot
  resume — only restart. Declared design (session-artifact honesty), but the copy calls a stopped run
  "paused", which is misleading.
- **F4 (P2) — Multi-tab wild-run divergence is unguarded.** Project state + the `wildRun` surface
  persist per tab; the single-flight latch is per-realm module state with a `window.setTimeout`
  backstop (rt-client.ts:360-380). No BroadcastChannel / storage-event coordination was found in
  store.ts or console.tsx. Tab A driving a run and tab B (hydrated from an earlier persist) both
  render RUNNING; Stop in B cannot stop A's loop; a stale unpaused `active:true` in B refuses
  `startWildRun` (store.ts:900-916). The *resume-path* class this descends from was real and is now
  fixed with a regression pin — console.tsx:692-709 comment + store.test PA-01 — but the
  driverless-RUNNING class survives across tabs.
- **F5 (P2) — The journey converges on `treeRun.ok` only; capability coverage is post-hoc.**
  `driveP6Journey`'s green branch (headless.ts:1339-1362) has no coverage probe; M1's coverage map is
  computed by run-eval *after* the journey and only printed loudly (run-eval.mjs header :21-31;
  maker-score.ts `capabilityCoverage`). A converged run can ship with `treeRunOk:true` and every
  corpus capability missing — exactly the 6/9 run's shape (results.json: `coverage.missing` = all 7
  caps alongside `treeRunOk: true`). The 146 "Divergence #1 (M1 ungated)" is now *reported* but still
  *unrepaired*.
- **F6 (P2) — M2's green run in the 6/9 evidence was earned by the deterministic floor, not by
  keyed LLM code.** Journey failed (`RT_E_LLM_TIMEOUT`), the drained project kept the floor
  `generatedSource` (codegen refusal returns the unchanged project; headless.ts:1183-1185 falls back
  to `applyPhaseResult`), and the final emit's 15/0 treeRun passed the *template's* module-truth rows
  (scaffold.ts:864-884 `hostOk` assertions). fixes/145's "first machine-verified… on a real keyed run"
  is true about the machinery but overstates the artifact: the verified module was the deterministic
  template, and no LLM-generated code has ever passed a machine tree-run yet.
- **F7 (P3) — The tree/single-module route decision is signature-count-only.** codegen.server.ts:1046-1050:
  `chunkGroups.length <= 1 → synthesizeSingleModule`, no kind/capability-scope term — so a
  multi-capability webapp whose expansion collapses to ≤8 signatures takes the single-module path and
  ships no real tree (the 6/9 M1=0 mechanism per 145; the keyed journey's own refusal log shows the
  chunked path *was* attempted with "chunk 1/3" — evidence the routing oscillates with spec shape).
  This is the M1 blocker and the fix is scoped in P1-1.
- **F8 (P3) — Webapp emissions declare deps nothing ever installs.** scaffold.ts:440-462 emits
  react/vite/tailwind + `build: vite build` for webapp kind; treeRun never installs or builds. The
  "runnable app" claim holds for the node-runnable oracle/entry surface only (see C7).

---

## 4. THE FIX/CHANGE LIST — prioritized P0/P1/P2

### P0-1 — The emit→edit→re-emit continuation seam (closes F-A; moves C1-artifact, C2, C6)
The minimal seam to make the emitted tree a *first-class artifact the factory can repair*:

1. **`emit --open <dir>`** (or `emit --out <dir> --open`): after writing, return the dir + a
   machine-readable manifest (`{dir, entry, kind, files[]}`) and **stop treating the dir as
   disposable** — default `<home>/RapidTool Software/<slug>/` already qualifies; the point is the
   *contract*, not the location.
2. **New verb `repair --dir <dir> --project <file.json>`**: loads the project, **re-imports the
   edited tree files from the dir** into `project.generatedTree` (path→content, hash-checked;
   refused paths listed — mirrors io.ts:224-254 tree hydrate discipline), re-runs the oracle via
   `treeRun(dir)` **without re-emitting** (compile-check.server.ts:603 is already dir-based — expose
   it as a CLI verb, e.g. `tree-run --dir`), and feeds the red tail into
   `driveP6Journey`-style cycles (P0-2) — or, when the edit fixed it, mints via `mintTreeRunTested`
   (codegen.server.ts:1493).
3. Guard: `emit --run` and `emitProject` keep the overwrite warning (rapidtool-cli.mjs:690-694) but
   `repair`/`tree-run` must **never** write over the dir before reading it (the current
   emit→then-run ordering at :678→:714 is exactly what makes edits unreachable).

Why it matters: without this, an agent's only "continuation" is to re-prompt the LLM from failure
text — no code-level iteration is possible, and C2's "artifact as feedback" stays FALSE.
Risk: dir↔project divergence (edited dir vs stale project fields) — mitigate with the hash check +
a `dirDirty` flag; treat refused files as warnings, never silent drops.
Test idea: emit a fixture tree, hand-edit one file to a compile error, `repair` → assert the edit is
imported (not clobbered), treeRun reports the file red, and a green edit converges + mints.

### P0-2 — Semantic-failure repair: feedback when the tree RUNS but does the wrong thing (moves C2/C6, F5)
What exists today: a red *test* tail (headless.ts:1149-1159) and a post-hoc coverage report
(run-eval). What is missing: any in-loop signal for "runs green, wrong semantics". Design:
1. **Executable capability rows in the emitted oracle.** Corpus `expectedCapabilities` are already
   stem-matched to identifiers by maker-score (`capabilityCoverage`, treeFilesOf). Emit one
   oracle row per expected capability into `tests/oracle.spec.ts` that (a) imports the tree entry
   and asserts an identifier hit exists *and* (b) for rows whose seam is a stub, asserts the stub
   reject — so capability absence is a **red test**, not a post-hoc report. (Scaffold owns the spec
   writer: scaffold.ts:864+; the corpus truth already lives in maker-score probes.)
2. **Coverage-gated convergence**: `driveP6Journey`'s green branch (headless.ts:1339-1362) runs
   `capabilityCoverage` before declaring converge; uncovered caps join the cycle context
   (`ctx.coverageGap`) and become a bounded "implement missing capability N" repair prompt — the
   journey only converges when treeRun is green **and** the brief's capability set has identifier
   presence (or the cap set is honestly refused after budget).
3. Keep the honesty rule: identifier presence is a *proxy* for semantics — the oracle row's assert
   must say what it checks (name/behavior), never claim behavioral proof from a stem hit.

Why: this is the difference between "code that passes its own tests" and "software that does what
the brief demanded" — the core factory criterion. Risk: capability-row false reds on legitimate
naming variance (stemming already handles most; keep rows advisory-scored, not hard-DoD, for one
cycle). Test idea: fake synthesize returning a green-but-capability-empty module → assert journey
does NOT converge and the gap prompt appears; then a fake with the identifier → converges.

### P1-1 — Tree-trigger scoping: kind + capability scope, not signature count (F7; M1 blocker)
Change codegen.server.ts:1046-1050: route to `synthesizeChunkedTree` when kind is webapp/service
with multi-capability corpus OR >8 signatures; reserve `synthesizeSingleModule` for genuinely
single-module library kinds (145's root cause, now code-anchored). Also raise/reconsider the 90s
timeout × 3-cycle budget for the 3-chunk path that timed out on the keyed run (chunk retry with
backoff exists codegen.server.ts:771+; journey budget policy is headless.ts:1112) — the keyed
journey must survive one 90s timeout per chunk without burning the whole budget on cycle 1.
Files: codegen.server.ts, headless.ts (budget policy), maker-score.test.ts expectation rows.
Risk: byte-parity churn on the ≤8 legacy path — keep the single-module branch byte-identical and
gate the new routing behind the kind/capability term. Test: reuse the property-ledger corpus entry —
expect M1→1 and, with P0-2, a converging keyed journey (the 9/9-in-reach claim in 145 is exactly
this fix + the E2 mint).

### P1-2 — Dependency/install reality (C7, F8)
Either (a) `emit --run`/`treeRun` gains an install+`vite build` leg for webapp/game kinds
(npm-install into the emitted dir, build, then assert), or (b) strike the build/dev scripts from the
emitted webapp package.json and say plainly the emission is a node-runnable scaffold + oracle suite
whose vite build is *unverified* (declare-or-strike, AGENTS.md honesty contract). Recommend (a) as
an opt-in `--verify-kind` flag first (bounded install in a temp dir; never mutates the user's dir),
because C7 is a hard factory criterion: shipping code whose declared build has never run is not
"shipping software". Files: rapidtool-cli.mjs, compile-check.server.ts, scaffold.ts (PKG_SCRIPTS
honesty comment). Risk: install time/flakiness — keep it opt-in and time-bounded. Test: emit the
smallest webapp fixture, run the flag, assert `vite build` exit 0 or an honest RT_E.

### P1-3 — Wild-mode keyed P6 parity + reviewer context (F1)
Wire the keyed seam into wild P6: `wildStep`'s execute branch (engine.ts:3562-3568) should call the
same live-layer path the store run uses when a key is configured (codegen refusal → floor stands —
already the safety net), and the wild reviewer's context (wild-mode.server.ts:87-135) should include
the treeRun outcome + coverage summary when one exists. Also delete or wire the dead lesson imports
(F2). Why: wild mode is the product's "leave it alone" face; today it silently produces floor-grade
artifacts under a key while the reviewer praises them. Risk: wild steps become slow/expensive —
bound with the existing cap + a keyed-step budget. Test: fake-complete reviewer + fake treeRun:
assert a wild P6 step with a key invokes the synthesis seam once and that a red treeRun flips the
review verdict.

### P2-1 — Lesson loop that changes behavior (C4)
Make learning observable: (1) wire lessons into the *journey repair prompts* (they currently only
reach a fresh expansion, codegen.server.ts:1004-1016 — the repair re-prompts at :1073+ never see
them), (2) add a `meta.lessonInfluence` stamp on the P6 record when lesson lines entered a prompt
(so M7-style comparisons can show behavior change), (3) test the D2 reframe branch (engine.ts:600-625,
flagged untested by 146), (4) resolve F2. Do NOT let lessons alter budgets/models yet — advisory
prompt influence with an auditable stamp is the honest first step. Files: codegen.server.ts,
knowledge.ts, engine.ts, wild-mode.server.ts. Test: seed two lessons with opposite guidance, run the
expansion fake, assert the prompt text differs and the influence stamp fires.

### P2-2 — Wild-resume residual class (F3/F4)
(1) Decide pause durability: either persist `pause:true` runs as resumable across reload
(hydrateWildRun engine.ts:1959-1964 keeps active:true when pause:true, console Resume re-enters via
the tested PA-01 path store.ts:900-916) or change the copy to "Stopped after reload — start a new
run" (console.tsx:822-826). (2) Cross-tab: add a storage-event/BroadcastChannel guard so a second
tab showing an active run either adopts the driver or renders read-only "running in another tab" —
never a Stop button that cannot stop. Files: engine.ts, console.tsx, rt-client.ts. Test: simulate
two stores on one storage key; assert a non-driving tab cannot render an actionable RUNNING without
a driver.

### P2-3 — Honest M2/M4 wording + single-module M4 scope
The 6/9 M2 evidence ("treeRun ok… tests 15 pass/0 fail") is true but must state the module was the
deterministic floor when the journey failed (F6) — add a `journey: "failed"` qualifier line to the
M2 evidence string (maker-score.ts) so future runs cannot read "green tree" as "keyed code green".
Also decide M4 for the ≤8 single-module success path: its `upgraded()` mint (codegen.server.ts:930)
already stamps `tested` + evidenceHash — the journey's `applyTreeRunTestedMint` (headless.ts:1236)
plus a green 1-file treeRun should carry M3/M4 for that path once P1-1 routes correctly; pin with a
maker-score.test expectation. Files: maker-score.ts, maker-score.test.ts.

---

## 5. What would move the score (one-paragraph honest arc)
P0-1 + P0-2 turn the repair loop from prompt-editing into artifact-editing with a semantic oracle
(C2/C6); P1-1 makes the keyed journey actually produce trees for the real brief (M1/M3/M4);
P1-2 makes "runs green" mean the kind's real build runs; P1-3 makes the unattended face honest.
With those landed, re-running the coffeehouse2home-property-ledger keyed entry is the experiment
that decides "factory" — 145's own 9/9-in-reach claim is contingent on exactly this list, and the
current evidence says the ceiling is not the scorer but the missing artifact loop + coverage signal.
