# taskuniverselog.md — RapidTool: the live task-status board

**This file is a MANDATORY READ, first in order: `AGENTS.md` → `RESUME.md` → `taskuniverselog.md` → the dossier named in your task.**

It is the single merged status board for **every task from every dossier** (`100`–`112`) plus the
master plan (`104_factory_upgrade_plan.md`). `RESUME.md` records the session history and the hard
rules; **this file maps the REMAINING WORK** — what is done, what is in flight, what is open, its
size, where it lives, and what the next wave should pick up.

**Snapshot written:** 2026-09-16 (~19:30 local); **§7 changelog + wave-status annotations updated
2026-09-24 (W10 close + W11 dispatch)** — the body's per-task statuses below are still the
2026-09-16 snapshot where not annotated.
**⚠️ STATUSES BELOW ARE SNAPSHOT VALUES — THE DISK IS TRUTH. VERIFY BEFORE TRUSTING.**

> **CORRECTION — 2026-10-02 (W47 record audit).** The snapshot below is from 2026-09-16; the repo is now
> in the **W47** era (HEAD `6575669`). The §0.2 expected baseline ("scripts 195/195 + src 1662/1662") is
> superseded — measured 2026-10-02: `npm test` → **scripts 398/398 · src 2736 tests / 2726 pass / 10
> skipped / 0 fail**; `npm run typecheck` exit 0 (both legs, `scripts/**` now covered); `npm run lint`
> exit 0 / 0 warnings. The "Doctor truth at snapshot … `{stubs: 0, reexports: 5, real: 0}`" note and the
> "two finish lines" arithmetic are historical: the emitted tree is now a **real multi-job product**
> (TA-15 landed W8) and a **keyed run succeeds** — the account is funded; the earlier 401/402s were a
> stale Windows User-scope `DEEPSEEK_API_KEY` shadowing `.env` while nothing loaded it (register
> `AW45-c01`; `START-HERE.md` §CORRECTION). Read the newest `fixes/3xx` logs and `finalsprint.md` for the
> live plan; this board's per-task rows are a 2026-09-16 snapshot.

---

## 0. How a new AI session MUST use this file

1. **Read order (mandatory):** `AGENTS.md` → `RESUME.md` (§0, §1 incl. §1.0/§1.4, §10, §5, then
   §2/§3/§4/§6) → **this file** → the dossier named in your task.
2. **Reproduce the four gates BEFORE changing anything:**
   ```bash
   cd "/c/Users/mnril/Desktop/RapidTool Main"
   npm run typecheck ; npm run lint ; npm test ; npm run build
   ```
   Expected at the 2026-09-16 baseline: typecheck 0 · lint 0 (watch the warning) · scripts 195/195 +
   src 1662/1662 · build 0. Counts GROW with new tests; a DROP is a regression **you** caused.
3. **Verify any 🔄/✅ claim here against disk evidence before trusting it:**
   - landing logs: `ls fixes/ | grep 216` (216a–216h are the current wave's),
   - `git status --short -- src scripts` (62 modified at wave start; grows as lanes land),
   - `grep` the cited anchor; line numbers drift — quote surrounding code, not bare numbers.
   **If this file disagrees with disk, disk wins — correct this file in the same pass.**
4. **Never run the full gate while agents are mid-edit.** Attribute a red gate by comparing the
   failing file's mtime against the run window FIRST (RESUME §5.5 / §12 rule 4).
5. **At EVERY wave boundary: append a changelog line (§7) and flip statuses for what actually
   landed, each with its evidence path.** This file is how the next session carries on.

**Evidence locations**
- Fix landing logs: `fixes/NN_*.md` (216a, 216c exist; 216b-owed; 216d–216h = current wave).
- Dossiers: `research/multiagent/NN_*.md` (100–112 + 104 master plan).
- Live delegation transcripts: `C:\Users\mnril\AppData\Local\hermes\cache\delegation\live\deleg_66c8d4c6\task-{0..4}.log`.
- Gate logs from the 2026-09-16 session: `C:\Users\mnril\_gates\*.log` (session-local, not durable).

---

## 1. Current snapshot (2026-09-16)

- **Wave `deleg_66c8d4c6` (5 flash lanes) IN FLIGHT at write time.** Targets: T-04/T-05 (L1
  scaffold) · T-07 + TA-2 (L2 headless / run-eval.mjs) · T-09/T-10/T-15 (L3 codegen / prompt-engine)
  · 112 T1–T4 (L4 knowledge / judgment.ts) · UI subset of 111 + 110 §5 derivation (L5) · plus
  `fixes/216b` recovery and the oracle-census README fix (L1).
- **WAVE 1 CLOSED (2026-09-16 ~19:40) — all writers stopped; wave-boundary gates: ALL FOUR GREEN.**
  `typecheck 0` (after parent repair: explicit `boolean` annotations on the TS7022 inference-cycle
  lets at `codegen.server.ts:269-270`) · `lint 0 errors / 0 warnings` (the census fix consumed
  `oracleRowLine` — the W1 lint warning is GONE) · `npm test` scripts **195/195** + src
  **1675/1675** (L4's +13 tests) · `build 0`. `scaffold.test.ts` re-verified **32/32** after L1's
  last unverified assertion edit; L3's 9 scratch probes deleted by parent.
  **Lane outcomes:** L4 ✅ complete (T1–T4 core + `judgment.ts` + `judgment.test.ts`); L1 ⚠️
  scaffold code landed + suite green, regression tests + `216b`/`216d` logs owed; L2 ⚠️ T-07
  helpers unwired, TA-2 absent; L3 ⚠️ detectors unwired, T-10 absent; L5 ⚠️ 7/11 UI tasks +
  110 §5 landed, `216h` complete. **W2 (repair/consolidation R1–R5) DISPATCHED — see §4.**
- **WAVE 2 `deleg_cc446a2b` CLOSED (2026-09-16 ~20:11) — boundary gates: ALL FOUR GREEN.**
  `typecheck 0` · `lint exit 0 / 4 warnings` (all = remnants of unfinished lane work: codegen
  render-test unused imports ×2 → W3-L1; verify.server unused `failureLessonFromRecord`/`JsonLog` →
  W3-L3) · `npm test` scripts **215/215** + src **1702/1702, 0 fail** · `build 0`. Parent repairs at
  the boundary (recorded old→new where assertions changed): (a) R3's JSDoc `*/`-in-path syntax error
  fixed (`codegen.server.test.ts`); (b) R2's flagged internal caller audited → `redTree:"probe"` on
  the P6 candidate emit (`headless.ts:1619`) so a red trail cannot kill the repair loop; (c) six
  test-authoring fixes across the two new suites (stub-records-verify, excerpt-vs-line assert,
  one-tautology-one-finding, mask-count, walk-exit-2, json-path suffix); (d) lane scratch files
  deleted. **Lane outcomes:** R1 ✅ complete (4 tests, `216b`+`216d` written); R2 ✅ **P0 pair
  landed+verified** (T-07 wired + TA-2 seat, headless 83/83; `216e` text owed → W3-L2); R3 ✅ landed
  (gates wired, T-10 fixed, codegen 86/86; `216f` text owed → W3-L1); R4 ⚠️ T1/T2 ~60% (types+engine
  verified 73/73; T2 2b + pins → W3-L3); R5 ✅ checker + T-17 (20/20; T-14 → W3-L5, `216j` owed).
- **WAVE 3 `deleg_124a1cf4` CLOSED (2026-09-16 ~20:44) — boundary gates: ALL FOUR GREEN.**
  `typecheck 0` · `lint 0` (0 warnings after parent cleanup) · `npm test` scripts **220/220** +
  src **1737/1737, 0 fail** · `build 0`. Parent repairs: rt-timeline ×2 (case-insensitive
  `rtEventTailStatus`; `openSpans` counts only UNCLOSED starts), `exec.test.ts` scratch-dir
  failure attributed as load-flake (solo 19/19; full re-run green), 4 unused imports removed,
  strays deleted (`probe-l5-coverage.ts`, `_w3l1_recon.mjs`). **Lane outcomes:** L1 ⚠️ mapping
  helpers landed UNWIRED (TA-15 still open → W4-L1); L2 ✅ **T-18 COMPLETE**; L3 ⚠️ wiring
  done+green (95/95), pins owed → W4-L3; L4 ⚠️ TASK-06 ✅ + TASK-07 ✅ + TASK-11 module ✅;
  L5 ⚠️ T-14 core landed. **W4 "product + Wave H primitives" DISPATCHED — per-lane notes at
  `wave_plans/W4/lane-*.md` (§4).**
- **WAVE 4 `deleg_95e01933` CLOSED (2026-09-16 ~21:15) — boundary gates: ALL FOUR GREEN +
  `scripts/gate.sh` RUN GREEN for the first time (TA-23: JSON verdict `ok:true`; the run caught
  and the parent fixed the exec.test.ts scratch-dir flake — 45s grace for T-18's npm-spawning
  siblings; re-run green). Sweep: `typecheck 0` · `lint 0` · `test` scripts **220/220** + src
  **1803/1803** · `build 0`. **Lane outcomes:** L1 ⚠️ doctor `jobScopeShortfall` + 3 tests land
  (15/15); TA-15 rewire fully DESIGNED with probes but still UNWIRED; L2 ✅ **COMPLETE**
  (`patch.ts` 21 + `policy.ts` 27 = 48/48; Wave H cores); L3 ⚠️ 4 lesson-loop pins + accrual pin
  + rt-client fix + gate.sh step all landed/green (verify.server 19/19, report-intake 23/23);
  `216i` half-filled; L4 ✅ **COMPLETE** (`cmd-palette.tsx` + `runtime-timeline-pane.tsx`,
  additive, typecheck+eslint 0); L5 ⚠️ T-14 pins green (packet 47, gates 85) + 5 mop-up edits
 on disk (verified green by the parent sweep); T-15 guard + harvest cap tests owed. **Next:
 docs audit + README/remaining-waves push, then W5 (§4).**
 - **WAVE 5 `deleg_eb3b8b86` CLOSED (2026-09-16 ~21:42) — boundary `gate.sh`: `{"ok":true}`.**
 Sweep: `typecheck 0` · `lint 0` · gaps 0 · scripts **235/235** + src **1811/1811** · build 0.
 **Lane outcomes:** L1 ⚠️ TA-15 partial — `orderTreeChunks` landed + full design in 216k (D1/D2/D3);
 the caller broke arity mid-edit and the PARENT restored it (compile-only; rewire = W6-L1);
 L2 ✅ **COMPLETE** (harvest cap+zero-budget tests, T-15 determinism guard +teeth, 216i/216j
 bodies, doc counts verified); L3 ⚠️ approvals routed through `policy.ts` at all three sites
 (seats byte-identical; headless 84/84; dod 85/85) — bypass pins + 216o owed → W6-L2;
 L4 ⚠️ registry landed (`src/lib/llm/providers/*`, roles main/reasoning/weak, unknown-id
 refusal, seams switched; all suites green) — tests + 216p + doctor surfacing → W6-L3;
 L5 ⚠️ run-side graders + trials/pass@k landed; keyless eval recorded (6 cases, **0 grader
 leaks**, new results.json shape) — 216q body + `--trials=2` evidence → W6-L4. **Parent
 repairs:** caller restore (compile), pass@k expectation old→new (0.5→1, standard formula —
- **WAVE 6 `deleg_7531d596` CLOSED (2026-09-16 ~22:20) — boundary `gate.sh`: `{"ok":true}`.**
  Sweep: `typecheck 0` · `lint 0` · gaps 0 · scripts **235/235** + src **1841/1841** · build 0.
  **THE PRODUCT BLOCKER FELL: TA-15 census triple VERIFIED** (`reexports: 0, stubs: 0, real: 3`
  on a fresh emit; parent probe). **Lane outcomes:** L1 ⚠️ code sound BUT **close report was FALSE
  about tests** (`# pass 83 # fail 3` was its own last line; no tests/216k sections written —
  parent repaired, verified, and wrote them); L2 ⚠️ decidedVia + provenanceConsistent + 6 bypass
  pins landed GREEN (headless 90/90) — 216o body → W7-L2; L3 ⚠️ registry tests + doctor surfacing
  landed (registry 21/21; parent fixed the missing type-only import) — 216p body → W7-L2;
  L4 ✅ **COMPLETE** (keyless --trials=2 recorded; 216q complete; docs synced); L5 ✅ **COMPLETE**
  (TA-1 verdicts: P1-02/P1-03/P1-06 verified, P1-04 stale-fixed; TA-21 deferred w/ reasons;
  216f 45→206 lines). **Parent boundary repairs:** doctor type-only import (compile), 3 stale
  codegen pins → job-keyed contract, barrel-assert dedupe, **gate.sh glob fix — nested
  `src/lib/**/*.test.ts` (registry suite was invisible to every sweep)**, 216k completed +
  parent-verified, board.
- **WAVE 7 `deleg_ce19b316` CLOSED (2026-09-17 ~08:55) — 5/5 lanes incomplete; parent-repaired
  to green. Boundary `gate.sh`: `{"ok":true}`** — typecheck 0 · lint 0 · gaps 0 · build 0 ·
  scripts **235/235** + src **1894/1894** (+53 = compaction 19 + subagent 22 + mock 12).
  **Lane outcomes:** L1 ⚠️ patch wiring landed (baseline held) — tests+216r owed; L2 ⚠️
  compaction.ts+tests written but NEVER RUN (parent fixed 2 assertions + impl guard → 19/19);
  L3 ⚠️ left `README-cli.test.mjs` ERRORING (3 tests, missing helper) — parent removed them to
  `216s` verbatim, scripts leg restored; L4 ⚠️ 4 modules written, never verified (parent fixed
  `../`→`./` paths, LlmResult.model, error?? guards, role:null mapping → typecheck 0, 22/22 +
  12/12 + 21/21); L5 ⚠️ **verification lane** — keyless E2E PASS (honest park/refusals/UNVERIFIED
  typecheck), **scaffold-half claims FALSIFIED** (scaffold.ts untouched since 673e349; corpus
  emit still `reexports: 5, real: 0`; oracle rows all skip; no `p6.jobs.shortfall` producer),
  1 defect (`headless.ts:1467` moduleEmbedded on empty generatedSource), determinism =
  path/log identity only (sha1 withheld). Evidence + falsification record: `fixes/216u`.
- **WAVE 8 `deleg_7335199d` CLOSED (2026-09-17 ~09:45) — TA-15 ACCEPTANCE MET. Boundary
  `gate.sh`: `{"ok":true}`** — typecheck 0 · lint 0 · gaps 0 · build 0 · scripts **238/238** +
  src **1905/1905**. **Lane outcomes:** L1 ⚠️ died mid-edit (scaffold.ts non-compiling; TDZ +
  missing types); L2 ✅ **216o+216p+216v written**; L3 ⚠️ edit arm + T5 arms + 3 tests landed —
  README-cli section/count left red (parent fixed); L4 ✅ **T-107.10 CLOSED** (E2E verified,
  216t complete); L5 ⚠️ 216r tests landed (+11, 97/97) + 2 codegen DEFECT repros (216r §2) —
  log written by parent. **Parent repairs:** scaffold completion (type members, D2 import map +
  guarded row emission, D3 census/README wiring, 2 double-escaped regexes, TDZ hoist + README
  order), 3 stale scaffold pins, README-cli `## Edit` section + count 35, CLI no-dupe-keys
  (`rowsOk`), 216r/216k bodies. **ACCEPTANCE (real runs):** corpus-shaped emit → scaffold →
  **census `{stubs: 0, reexports: 0, real: 3}`**; track/record/lease never-bridged (counted +
  surfaced); spec carries `jobMod_rent` + guarded call; **`orc-4` real**; §3 shortfall log → W9-L1.
- **WAVE 9 `deleg_ea7a2afa` CLOSED (2026-09-17 ~09:45) — patch-path defects FIXED + CLI behavior
  suites LANDED. Boundary `gate.sh`: `{"ok":true}`** — typecheck 0 · lint 0 · gaps 0 · build 0 ·
  scripts **261/261** (+23) + src **1907/1907**. **Lane outcomes:** L1 ⚠️ recon-only (zero
  patches — repo byte-untouched by design; full landing plan + a decision question, below);
  L2 ✅ **COMPLETE** — `codeTokenLineNumbers()` :659 (masked→raw offset map; both
  `patchableDefect` branches rewired :709/:720) + `patchLanded = validation.ok` short-circuits
  (:2504/:2528/:2830/:2854; guard :2534/:2860); tests :2246 (99/99, +2; legacy bytes kept);
  L3 ✅ **COMPLETE** — NEW `rapidtool-cli-edit.test.mjs` (10) + `rapidtool-cli-lesson.test.mjs`
  (13); `rapidtool-cli.mjs` byte-identical; 216s §1-4 filled with real output; L4 ⚠️ recon +
  skeleton (`fixes/216w` IN PROGRESS) + ONE additive doc-comment on token-ledger.ts (:~22);
  L5 ⚠️ (A) **T-11 VERDICT: FAILS today** — live red-seal run captures a lesson from
  `engine.ts:1416-1418` (`!needsHitl && !r.pass`) with tags `['L2','lesson','template-emission']`
  — NO probe id (knowledge.ts:916-931); the feedback half works (selectLessons renders it);
  (B) 108-T7 spike: scratch `npm install` exit 0 (31s), tree-run exit 0 (25.5s, envelope NOT
  read — not claimed); doc NOT written (→ W10-L4 from the analysis + probe). **Parent decision
  (T-11 probe-id):** surface the ids ALREADY inside the lesson row (failureSignature/DoD
  anchors) as an explicit `[probe:<id>]` tag — no row-id re-minting; red-seal lessons stop
  being minted (the signal becomes a `p6.*` log instead).
- **Wave-start gate baseline (reproduced 2026-09-16 19:11–19:13, no writers active):**
  typecheck **0** · lint **0 errors / 1 warning** (the warning IS the census defect — assigned to L1)
  · `npm test` **scripts 195/195 + src 1662/1662, 0 fail** · build **0**.
- **Doctor truth at snapshot:** `autonomousSoftwareFactory: false`; coffeehouse tree inventory
  `{stubs: 0, reexports: 5, real: 0}`. Exact command (the flag needs a dir):
  `node scripts/rapidtool-cli.mjs doctor --tree research/eval-out/coffeehouse2home-property-ledger`
- **Landed before the wave (this session's 216 series):** 109 T-01, T-02, T-03, T-04, T-05, T-06,
  T-12 · 106 T-01, T-02, T-03, T-06, T-08, T-16 · 112 T7, T8, T10 · parent repairs (RESUME §2.4 /
  §10 / §11).
- **§6.3 attributable diffs RESOLVED (parent, 2026-09-16):** `scripts/run-eval.mjs` +32 = fixes/215
  `deliveryKindOf` kind-routing; `src/components/console.tsx` +1 = `else if (res.note) setNotice(...)`
  (dual-channel note surfacing, 208 series). Confirm visually at commit review.

---

## 2. Task universe (status legend)

- ✅ landed — with evidence path · 🔄 **in flight in `deleg_66c8d4c6` — VERIFY before trusting** ·
  ❌ open · ⚠️ partial / unverified clause.
- Sizes are the dossiers' own (legends differ slightly): 106/112 = S ≤ ½–1 day · M 1–2 d · L 3+ d;
  105 = S ≤ 1 d · M 2–5 d · L 1–2+ wk (single engineer, repo-familiar).

### 2.1 dossier 106 — RapidTool deep analysis (`106_rapidtool_deep_analysis.md` §6)

| # | Task | Size | Status | Evidence / note |
|---|---|---|---|---|
| T-01 | `stripCjsExportAssignments` removes the whole CJS construct | S | ✅ | 216 wave (§9); empirical before/after 2-of-4 → 0-of-4 unparseable |
| T-02 | Parse-gate every tree file before it is written | M | ✅ | §10; compile-check +5 tests; gate on the write path |
| T-03 | Atomic tree write (tmp + rename) | S | ✅ | §10 |
| T-04 | Declared tree entry `src/generated.ts` (the *emitted* tree's entry path — `TREE_ENTRY_PATH`, `codegen.server.ts:1514`; **not a file in this repo**) — allow or refuse LOUDLY (no silent drop) | S | ✅ W2 | entry written; refusals → README + `warnings[]`; 4 regression tests (scaffold 36/36) |
| T-05 | Emitted UI imports computed `treeEntryPath`, not the literal | S | ✅ W2 | computed entry pinned (3 shapes; tests) |
| T-06 | Invalidate `lastTest`/`generatedSource` on tree change | S | ✅ | §10; `treeUpgraded` sets `lastTest: null`; one assertion updated old→new (recorded) |
| T-07 | `emit` refuses/banners on an un-cleared red tree-run | M | ✅ W2 | wired: refuse-default / banner / probe; both branches + green control + no-partial-write pinned (4 tests); internal candidate emit = `probe` (parent audit) |
| T-08 | Kill the tautological oracle floor | M | ✅ | 216b (Lane B + parent repair §2.4/§11) |
| T-09 | Reject prose-in-code at synthesis | S | ✅ W2 | wired + refuses (RT_E_VALIDATION); 11/11 real-blob lines (residual gap closed); prose repair prompt; e2e pinned |
| T-10 | Resolve the prompt contradiction (signatures-only vs implement-everything) | M | ✅ W2 | system + chunk prompts scoped per file; T-09/T-15/T-16 bans advertised |
| T-11 | Gate lesson capture on a green seal; tag lessons with target probe | M | ❌ | engine/knowledge; **next-wave candidate** |
| T-12 | Seat check: fail closed on latency + attestation + TTY | S | ⚠️ partial | harness half = TA-2 (W1 L2); latency/attestation clause unverified |
| T-13 | Reconcile declared jobs vs materialised job nodes | S | ⚠️ doctor half ✅ W4 | `jobScopeShortfall()` + 3 tests (15/15); persist+print + engine log → W5-L1 |
| T-14 | P7–P12: report "7 of 13 executed" honestly OR unblock them | M | ✅ W4 | core + 4 packet pins + 2 gates pins green (132/132); census 13/13/**8** (packet row excluded); rail line + `phase_coverage` key live |
| T-15 | Ban `Math.random()` in generated code | S | ✅ W2 | wired + refuses; determinism repair prompt; masked-literal control pinned (e2e) |
| T-16 | Assertion-gap regression (multi-line CJS fixture + parse asserts) | S | ✅ | Wave D |
| T-17 | Assertion-gap LINT (tautology + zero-assertion tests repo-wide) | M | ✅ tooling W2 | `scripts/check-assertion-gaps.mjs` + 20/20 tests; repo scan = 1 finding (`rt-client.test.ts:121`); gate wiring + rt-client fix ✅ W4 (gate.sh runs it; first green run recorded) |
| T-18 | `tree-run`: "parses" → "the product builds and tests" | L | ✅ W3 | treeRun runs the tree's own typecheck+test (additive `project` verdict); failing test can never be ok:true; unavailable toolchain = loud skip+note (no fabricated pass) |

### 2.2 dossier 105 — adversarial critique (`105_plan_critique.md` §8; 23 TAs)

| # | Task | Size | Status | Note |
|---|---|---|---|---|
| TA-1 | Verify the four `[lane-reported]` blockers (`100:37-41`) before tasking | S | ❌ | P1-02/03/04/06 leads |
| TA-2 | Eval harness gets a real LABELLED seat (never bare `decidedBy:"human"`) | S | ✅ W2 | ApproveActor + autopilot default + `RT_HUMAN_SEAT_TOKEN` gate; CLI passes the human actor; 5 tests + CLI probe matrix; README-cli documented |
| TA-3 | Extend T0.9 to EVERY published count + executable drift check | S | ❌ | README/AGENTS/README-cli counts; `fixtures` verb unlisted |
| TA-4 | Co-land + assert P6 `reasoningEffort` | S | ❌ | = 104 T0.4 |
| TA-5 | Provider-aware "configured" predicate (replace `isDeepSeekConfigured()` gates) | S/M | ❌ | Phase 1; must land WITH T1.5 |
| TA-6 | 101 LOW-6/7/8 in the router (retryable codes, Retry-After, aborts, read-back) | S | ❌ | Phase 1 |
| TA-7 | Provenance migration round-trip fixtures (real persisted projects) | S | ❌ | upgrades T1.3 |
| TA-8 | Per-provider probe state on `doctor`; gate the "any provider" claim | S | ❌ | upgrades T1.5 |
| TA-9 | Budget: enumerate surfaces by grep; state default cap policy | S | ❌ | upgrades T2.1 |
| TA-10 | Unattended invocation surface — OR a written non-goal | M/L | ❌ | Phase 2/3 |
| TA-11 | Oracle-strength audit (signal 9) as its own task | S | ❌ | Phase 3 |
| TA-12 | Error-handling audit (signal 10) as its own task | S | ❌ | Phase 3 |
| TA-13 | Split T3.3 into named signals; defer the rest explicitly | S | ❌ | plan hygiene |
| TA-14 | Cross-family, order-swapped judge protocol | S/M | ❌ | Phase 3, needs T1.5 |
| **TA-15** | **Emit a REAL multi-job product (P0-04)** | **M/L** | **✅ VERIFIED (W8) — §3 tail → W9-L1** | **End-to-end through the SCAFFOLD: census `{stubs: 0, reexports: 0, real: 3}` (`src/jobs/rent*.ts`); D3 job nodes never bridged (counted + surfaced: warnings + README); D2 spec imports the job module (`jobMod_rent` + guarded call, ReferenceError fails the row) and `orc-4` is a REAL oracle test. Residual: `p6.jobs.shortfall` engine log (§3) → W9-L1.** |
| TA-16 | `verify-kind`: scratch copy + install + claim strikes (C1) | S/M | ❌ | same commit as T4.1 |
| TA-17 | Git landing detail: `.gitignore`, init, A4 dependency | S | ❌ | inside T4.2 |
| TA-18 | Apply-patch: preservation + conflict semantics | S | ❌ | inside T4.3 |
| TA-19 | Sandboxing: task it OR strike it (explicit non-goal) | L | ❌ | Phase 4/5 |
| TA-20 | Orphan pillars (arch-tools/algo-tools/vector/exportProfiles): wire or descope | S/M | ❌ | Phase 5 |
| TA-21 | P9 deploy-artifact honesty (`template — not executed` marker) | S | ❌ | P1-06 |
| TA-22 | Explicit deferral register (A12, A13 + unmapped) | S | ❌ | plan hygiene |
| TA-23 | Plan hardening on 104 itself (done-whens, rules, `gate.sh` baseline) | S | ❌ | do before Phase 1 |

### 2.3 dossier 109 — core bug hunt (`109_bughunt_core.md` §6)

| # | Task | Size | Status | Note |
|---|---|---|---|---|
| T-01 | Machine harness requires a callable export (kills vacuous pass) | S | ✅ | 216a; "if only one thing lands, land this" |
| T-02 | `identifierHits` over stripped source + must-hit-a-called-identifier | S | ✅ | 216a |
| T-03 | Close the `=` guard hole (`>>=`/`<<=`/`>>>=`); delete dead arrow branch | S | ✅ | 216a; 6 regression rows |
| T-04 | Blocklist `constructor`/`prototype`/`__proto__`; correct the claim | S | ✅ | 216a |
| T-05 | Consume `module` param / support `module.exports = {…}`; diagnose zero exports | S | ✅ | 216a |
| T-06 | Halving probe → loop HEADER only (body-shape → `extras` note) | S | ✅ | 216c |
| T-07 | `intentLattice` frequency: canonical-stem BOTH sides | S | ❌ | `algorithms.ts:373` old anchor |
| T-08 | CJS export regex: only real `module.exports.` (kill `my_module.exports.x` phantom) | S | ❌ | `algo-tools.ts:185` |
| T-09 | Name + enforce harvest candidate cap; fix zero-budget note | S | ❌ | `harvest.ts:430` etc. |
| T-10 | `KnowledgeStore.entries()` returns a defensive copy | S | ❌ | `knowledge.ts:301-304` |
| T-11 | One stemmer, stated once (3 stemmers + unstemmed tokenize) | M | ❌ | overlaps 112 T9 |
| T-12 | verify-safety regression block (6 assertions) | M | ✅ | 216a |
| T-13 | Audit remaining text-level name guards (both directions) | M | ❌ | |
| T-14 | Publish verify lane's real capability contract (prompt + docs) | S | ❌ | |
| T-15 | Source-level determinism guard test | S | ❌ | |
| T-16 | Commit probe evidence as `probe-109-core.ts` | S | ❌ | |

### 2.4 dossier 112 — judgment + durable learning (`112_...md` §6)

| # | Task | Size | Status | Note |
|---|---|---|---|---|
| T1 | Failure-signature ids (one row per repeated failure; `reproducedCount++`) | M | ✅ wiring W3 (95/95 green) | `failureSignature()` + `accrueReproducedCounts`; re-seal logs `lesson.reproduced`; pins → W4-L3 |
| T2 | Counterexample-or-nothing (`refuse:no-proof`, no lesson) | S | ✅ wiring W3 (95/95 green) | `gatedFailureMint` at 3 sites; visible `lesson.refused` row; pins + `216i` → W4-L3 |
| T3 | Pure `judgePhase(project, phase)` in NEW `judgment.ts` (no LLM) | M | ✅ (216g) | 276 lines, 7/7 tests incl. purity scan, all six rungs |
| T4 | Thread store rows into the expansion prompt (`opts.proven` plumbing) | M | ⚠️ resolver landed; hops → W3 | `provenRowsFromStore()` exists; 4 call-site hops deferred (codegen ×3 + engine) |
| T5 | `lesson --advise` / `--verify` read-only verbs | M | ❌ | |
| T6 | Poisoning-guard predicates + tests (P2/P5/P6/P7) | S | ⚠️ | in dossier; NOT in RESUME §4's remaining list — verify before tasking |
| T7 | `estimateTokens` cache key fix + collision pin | S | ✅ | 216c (`fnv1a` collision reproduced) |
| T8 | `fusionRank`/`contiguousRun` cost fix + frozen golden | M | ✅ | 216c; golden byte-identical |
| T9 | Stemmer `-ies → y` | S | ❌ | **MED-HIGH test risk — LAND ALONE, never bundled** |
| T10 | `complexityOf` masked-interpolation honesty + `lineOf` single pass | S–M | ✅ | 216c |
| T11 | Contradiction ⇒ mandatory supersede + `--consolidate` generator | M | ❌ | |
| T12 | Document the judgment contract in `AGENT_GUIDE.md` | S | ❌ | docs last |

### 2.5 master plan 104 — phases (`104_factory_upgrade_plan.md` §5/§7)

| Phase | Tasks | Status | Corrected effort (105 §6) |
|---|---|---|---|
| 0 | T0.1 ✅ · T0.2 ✅ · T0.3 ✅ · T0.4 ❌ · T0.5 ✅ · T0.6 ✅ · T0.7 ✅ · T0.8 ✅ · T0.9 ✅ · T0.10 ❌ (**owner: user**) | 8/10 | ≈6–9 d total; ~1 d left + user key |
| 1 | T1.1–T1.6 ❌ (adapters/router/provenance; upgrades TA-5…TA-8) | 0/6 | ≈12–19 eng-days |
| 2 | T2.1, T2.2 ❌ (token ledger everywhere; budget pre-attempt) | 0/2 | ≈4–7 eng-days |
| 3 | T3.1, T3.2 ❌ · T3.3 ❌ (pending 102 + TA-13) · T3.4 ❌ · T3.5 ✅-ish (one lying double found+fixed; sweep recorded) · T3.6 ❌ (`format:check`) | ~1/6 | ≈10–23 eng-days |
| 4 | T4.1–T4.4 ❌ (verify-kind real install; git; apply-patch; resume) | 0/4 | ≈13–26 eng-days |
| 5 | T5.1–T5.8 ❌ (streaming; review UI; eval verb; provenance fields; plugins; multi-language†; cassette; multi-tenant†) | 0/8 | ≈25–55 eng-days | 
† T5.6/T5.8 are **product decisions**, not engineering tasks — move to the decision register.

### 2.6 Wave H — competitor steals (`107_competitors_agentic.md`, `108_competitors_app_generators.md`; 18 tasks)

🔄 W7: T-107.1 **wired** (repair deltas via `applyStrReplace`; tests owed → W8-L5) · T-107.9 **module+tests ✅** (compaction 19/19; log 216v owed) · T-107.10 **modules ✅** (subagent 22/22 + mock 12/12; log 216t owed). W6: T-107.3 pins ✅ (headless 90/90) · T-107.2 tests+doctor ✅ (registry 21/21) · T-107.5 ✅. Named highlights: **T-107.1** `str_replace` patch primitive (unique-match refusal + graded fuzzy) · **T-107.2** provider registry + role tiers · **T-107.3** one-seam policy engine · **T-107.5** run-side acceptance fixtures + pass@k · **T-107.9** compaction constants · **T-107.10** sub-agent contract + mock-LLM E2E · **108-T1** in-place edit verb (dry-run + ledger attribution) · **108-T2** export registry → synthesis · **108-T3** precondition-vs-failure RT_E split · **108-T5** repair-budget + coded exhausted error · **108-T7** E2E-vs-running-instance feasibility spike. (11 named here; the rest live in the dossiers.)

### 2.7 UI (`110_ui_audit_vs_competitors.md`, `111_ui_design_research.md`)

- 111: **11 tasks (TASK-01…11)**. W1 L5 landed **7/11** (TASK-02/03/04/05/08/09 + TASK-07 partial:
  tooltips done, 2 chip-jargon spots remain) + appended **110 §5** (`216h` complete). Remaining:
  W3 landed TASK-06 ✅ (5/5; README drift 33→34 + `fixtures` + verify-kind claims fixed),
  TASK-07 ✅ (both chips), TASK-11 module ✅ (28/28, parent-fixed); W4 landed **TASK-10 ✅ +
  TASK-11 wiring ✅** (`cmd-palette.tsx` + `runtime-timeline-pane.tsx`, additive, typecheck 0);
  **TASK-01 → W5.**
- 110 §5 task list: 🔄 being DERIVED/APPENDED by W1 L5 (replaces the lost `_(pending)_`; derive from
  110 §1–§4 only — never invent). Remainder + follow-on UI waves = **TBD after W1**.

### 2.8 Housekeeping / owed

| Item | Status |
|---|---|
| `fixes/216b_oracle_floor.md` | ✅ WRITTEN (W2-R1, 85 lines) |
| `fixes/216d_scaffold_waveD.md` | ✅ COMPLETE (W2-R1, 88 lines) |
| `fixes/216e_red_tree_emit_and_seat.md` | ✅ WRITTEN (W3-L2, 10.4 KB) |
| `fixes/216f_synthesis_honesty.md` | ✅ COMPLETE (W6-L5, 45→206 lines) |
| `fixes/216g_judgment_learning.md` | ✅ complete |
| `fixes/216h_ui_wave.md` | ✅ complete |
| `fixes/216i_knowledge_integration.md` | ✅ COMPLETE (W5-L2) |
| `fixes/216j_honesty_tooling.md` | ✅ COMPLETE (W5-L2) |
| `fixes/216k_multi_job_emission.md` | ✅ COMPLETE + parent-verified (census triple) |
| `fixes/216o_policy_integration.md` | ⏳ bodies → W8-L2 (code+pins ✅; suites verified) |
| `fixes/216p_provider_registry.md` | ⏳ body → W8-L2 (registry 21/21 ✅) |
| `fixes/216q_eval_fixtures.md` | ✅ COMPLETE (W6-L4) |
| `fixes/216r_patch_integration.md` | ✅ COMPLETE (defects FIXED W9-L2; tests 99/99) |
| `fixes/216s_cli_wave.md` | ✅ COMPLETE (W9-L3; +23 tests; 216s §1-5) |
| `fixes/216t_subagent_contract.md` | ✅ COMPLETE (W8-L4) |
| `fixes/216u_w7_e2e_verification.md` | ✅ WRITTEN (parent-assembled; carries the falsification record) |
| `fixes/216v_compaction_constants.md` | ✅ WRITTEN (W8-L2) |
| `fixes/216l_tree_run_build_test.md` | ✅ WRITTEN (W3-L2, 14.4 KB) |
| `fixes/216m_ui_wave2.md` | ✅ COMPLETE (W4-L4) |
| `fixes/216n_wave_h_primitives.md` | ✅ COMPLETE (W4-L2) |
| `scripts/check-assertion-gaps.mjs` (new) | ✅ works (20/20 tests); gate wiring + `rt-client.test.ts:121` fix → W4 |
| lint warnings | ✅ RESOLVED (parent, W3 boundary: unused imports removed; lint = 0 warnings) |
| RESUME §1 lint-warning nuance note | ❌ optional |
| `110` §5 derivation | 🔄 W1 L5 |
| `bash scripts/gate.sh` (TA-23) | ✅ FIRST REAL RUN, GREEN (2026-09-16; 6 gates; JSON verdict `ok:true`) |

---

## 3. Counts + effort model (computed 2026-09-16)

- **Remaining unique items ≈ 70–90** (≈95 raw across dossiers, minus obvious double-numbering:
  TA-2≈T-12 · TA-4≈T0.4 · 109 T-11≈112 T9 stemmer family).
- **The dossiers' own math (105 §6 + §8.1):** master-plan Phases 1–5 ≈ **64–130 engineer-days**,
  +8–16 for the TA upgrades, i.e. **≈3–6 engineer-months single-threaded** — plus Wave H (18)
  and UI. That is the *full plan tail*, not the critical path.
- **Wave-cadence estimate (how this project actually runs):** ≈2–3 more waves clear the P0/P1
  honesty cluster + the acceptance path; ≈4–6+ more waves cover Wave H + Phases 3–5 + UI.
- **Two finish lines — do not conflate:**
  1. **Maker test** (friend-usable Coffeehouse2Home app): **TA-15 → T-18 → T-13/T-14 honesty →
     fresh keyed run.** ≈2–3 waves + the user's key.
  2. **`doctor` latch** (`autonomousSoftwareFactory: true`; 105 §8.1 critical path):
     T0.7+T0.8+TA-2 ✅/🔄 → **T1.3+T1.4 → T2.1 → T3.1/T3.2 + TA-15 → fresh keyed run (T0.10)**.

---

## 4. Recommended NEXT WAVE (W2) — candidates (VERIFY after W1 closes)

> Ownership is only valid once every W1 lane has stopped. Re-grep anchors before briefing.
> Keep ≤5 lanes, disjoint files, flash-only, §3.0 guardrails verbatim, skeleton-first.

> **W9 CLOSED (§1 — patch-path fixed, CLI suites in). W10 DISPATCHED 2026-09-17 ~09:48 —
> "engine truth + token ledger + verify-kind" (5 lanes; every brief orders the lane to read its
> own `wave_plans/W10/lane-N.md` FIRST).**
1. **W10-L1 — §3 shortfall log + T-11 LANDING** (`engine.ts` + `knowledge.ts`: green-seal gate
   + `[probe:<id>]` tag per the parent decision; 216k §3).
2. **W10-L2 — T-107.6 token-ledger functional** (finish the W9-L4 plan on disk: additive cache
   fields, TokenBudget seam, recordBudgetSpend, estimateCostUsd; verify/chat/crew/node-runner
   seams + caps; 216w).
3. **W10-L3 — verify-kind install leg (T4.1/TA-16)** (`compile-check.server.ts` + `emit
   --verify-kind`; scratch-copy + real `npm ci` + build/test verdict — the W9-L5 spike proved
   install works in ~31s; honest envelope, no overclaim).
4. **W10-L4 — `fixes/216x` write** (from `w9l5_scratch`: re-run the red-seal probe; T-11
   FAILS-today evidence + the 108-T7 decision doc + spike boundaries).
5. **W10-L5 — TA-11 oracle-strength audit + TA-12 error-handling audit** (docs-only;
   `fixes/216y`; real bytes, report-don't-fix).

> **W3 sketch (after W2):** TA-15 + T-13 (multi-job — THE product blocker; files free after R1/R3)
> · T-18 (tree-run builds+tests; after R2) · T-11 · T4 hops · UI remainder (TASK-01/06/10/11) ·
> 105/109 mop-up. Deferred beyond: Wave H, Phases 1–5, product decisions.

Deferred to W3+: 105 standalones (TA-1/TA-3/TA-21/TA-23), 112 T5/T9/T11/T12, Wave H, Phases 1–5.

---

## 5. Owner (user) items

- **T0.10 — fresh keyed eval run** (`npm run eval -- --keyed` family; needs a valid RapidTool
  `DEEPSEEK_API_KEY`; `.env` holds a 35-char key whose liveness is unverified). Everything
  quality-related ultimately rests on this.
- Product decisions (later): T5.6 multi-language boundary; T5.8 server-side storage/multi-tenant.

---

## 6. Maintenance protocol (mandatory)

1. Flip statuses **only with evidence** (command output / landing log / file:line).
2. Add a §7 changelog line at every wave boundary: date · wave id · what landed · what changed
   here · next wave.
3. Never delete history from §7; append only.
4. If a new dossier or task list lands, add its section here — this file must remain the single
   merged board (do not fork status into other docs).
5. Keep the snapshot header honest: bump "Snapshot written" whenever you edit.
6. **Every wave dispatch: the parent pre-analyzes each lane's tasks and embeds a per-lane
   mini-task plan in its brief** (standing user directive) — lanes start with an explicit
   numbered plan, not a theme.
7. **`hermes verify` LANDMINE (2026-09-16):** `.hermes/environment.json` now exists with the
   auto-detected recipe whose test phase includes `npm run format` (= `prettier --write .`,
   WRITE mode — it would reformat the whole tree). The parent's edit to remove that step was
   BLOCKED (protected agent-instruction file; no user consent — correctly so). **Do NOT run
   `hermes verify` as-is.** Either obtain user approval to neutralize the manifest (remove the
   format step) or delete `.hermes/`. `.hermes/` is an untracked artifact — include it in
   review-before-commit. RESUME §5.2 remains correct until this is resolved.

---

## 7. Changelog

- **2026-09-16** — file created (parent, post-W1 dispatch, pre-W1 verification). Contains the
  merged universe of 106 (18) + 105 (23) + 109 (16) + 112 (12) + 104 phases + Wave H (18) + UI
  boards with snapshot statuses. Next: verify W1 (`deleg_66c8d4c6`) landings, four gates, then
  dispatch W2 per §4.
- **2026-09-16 (later, mid-wave)** — L2 capped mid-edit (`final status=completed` but summary:
  "incomplete, ran out of iteration budget"). Verified by parent: T-07 machinery landed UN-WIRED
  (`headless.ts:1096-1210`, 0 callers); TA-2 untouched; `headless.test.ts` untouched; `fixes/216e`
  skeleton only; `headless.ts` typechecks clean. W2 revised to include the P0 repair lane (§4).
- **2026-09-16 (wave 1 close)** — W1 `deleg_66c8d4c6` verified: L4 complete; L1/L2/L3/L5 partials
  (rows updated); parent repaired the last 2 typecheck errors (boolean annotations, zero behavior
  change) → **all four gates GREEN on the frozen tree** (0 / 0+0w / 195+1675 / 0). W2 repair wave
  R1–R5 dispatched (§4).
- **2026-09-16 (wave 2 close)** — W2 `deleg_cc446a2b` verified: R1 ✅, R2 ✅ (P0 pair), R3 ✅,
  R5 ✅; R4 ⚠️ 60%. Parent boundary repairs (JSDoc fix, `redTree:"probe"` audit, six test fixes,
  cleanup) → **all four gates GREEN** (0 / 0e+4w / 215+1702 / 0). Lint warnings assigned to W3-L1/L3.
  W3 "product wave" dispatched with per-lane mini-task plans (§4).
- **2026-09-16 (wave 3 close + wave 4 dispatch)** — W3 `deleg_124a1cf4` verified: **T-18 ✅
  COMPLETE** (the deepest honesty upgrade: a tree failing its own `npm test` can never be
  `ok:true`); TA-15 mapping helpers landed but UNWIRED; T2 wiring green (95/95) unpinned; T-14
  core landed; UI TASK-06/07 + TASK-11 module landed; README-cli verb-count drift fixed
  (33→34 + `fixtures`). Parent boundary repairs (rt-timeline ×2, exec-flake attribution,
  import cleanup, strays) → **all four gates GREEN** (0 / 0 / 220+1737 / 0; lint back to
  **0 warnings**). W4 dispatched with **per-lane notes files** (`wave_plans/W4/lane-*.md` —
  standing user directive: every lane reads its own plan).
- **2026-09-16 (wave 4 close)** — W4 `deleg_95e01933` verified: **L2 ✅ `patch.ts`+`policy.ts`
  (48/48), L4 ✅ palette + timeline pane, T-14 ✅ pinned, lesson-loop pins ✅, rt-client fixed,
  gate.sh wired**; L1's TA-15 rewire fully designed (probes included) but still UNWIRED; L5's
  5 mop-up edits verified green by the boundary sweep (their new tests partially owed).
  Parent boundary: exec.test.ts flake fixed (45s grace, T-18 rationale), all four gates GREEN
  (0 / 0 / 220+1803 / 0) + **gate.sh first-ever GREEN run**. Next: codebase audit + README/
  remaining-waves docs + push, then W5 dispatch.
- **2026-09-16 (wave 5 close)** — W5 `deleg_eb3b8b86` verified: L2 ✅ complete; L3 approvals
  routed through the policy seam (seats byte-identical); L4 registry landed (roles +
  unknown-id refusal); L5 run-side graders + trials/pass@k + leak scan, keyless run recorded
  (0 leaks); L1 TA-15 partial (orderTreeChunks + design; caller restored by parent). Parent
  repairs: compile restore, pass@k test fix (0.5→1 — standard formula; the TEST was wrong),
  stale results.json regenerated, dedupe. **`gate.sh {"ok":true}`** — scripts 235 + src 1811.
- **2026-09-16 (wave 6 close)** — **TA-15 census triple VERIFIED** (fresh emit → `reexports: 0,
  stubs: 0, real: 3`; parent probe + real doctor census). W6: L2 pins green (headless 90), L3
  registry tests + doctor surfacing (registry 21), L4 ✅, L5 ✅ (TA-1 verdicts; 216f complete).
  Parent repairs: doctor type-only import, 3 stale codegen pins → job-keyed contract, barrel
  dedupe, **gate.sh glob fix (nested suites were invisible)**, 216k completed+verified.
  **`gate.sh {"ok":true}`** — scripts 235 + src **1841**. L1's close report recorded as FALSE
  about tests in 216k (honesty log).
- **2026-09-17 (wave 7 close)** — 5/5 lanes incomplete (two hung ~10h post-cap), everything
  parent-repaired to green: doctor imports, compaction assertions + guard, README-cli red
  restored (tests preserved to 216s), mock/subagent path+type slips, lint items. L5's
  verification FALSIFIED the W5/W6 scaffold-half claims vs bytes (scaffold.ts untouched since
  673e349; corpus emit `reexports: 5`) → TA-15 status corrected to PARTIAL; `fixes/216u`
  written with the full falsification record. **`gate.sh {"ok":true}`** — scripts 235 +
  src **1894** (+53 new tests). W8 dispatched: scaffold completion + closures.
- **2026-09-17 (wave 8 close)** — **TA-15 ACCEPTANCE MET through the real scaffold path**
  (census `{0,0,3}`; D3 never-bridge + counted/surfaced; D2 guarded job-module rows; orc-4
  real). L2 ✅ logs; L4 ✅ T-107.10 closed; L5's patch tests 97/97 + 2 documented patch-path
  defects (→ W9-L2). Parent budget: the big scaffold completion + 3 stale pins + README-cli +
  `rowsOk` lint. **`gate.sh {"ok":true}`** — scripts 238 + src **1905**. W9 dispatched.
- **2026-09-17 (wave 9 close)** — patch-path defects FIXED (masked→raw line map + post-patch
  short-circuit; codegen 99/99) · CLI behavior suites LANDED (edit 10 + lesson 13 tests; scripts
  261) · T-11 verified FAILING today with live evidence (red-seal lesson minted, no probe id) ·
  108-T7 spike: scratch install + tree-run both exit 0 (envelope unread — not claimed). L1/L4
  recon-only (plans complete; budget). **`gate.sh {"ok":true}`** — scripts **261** · src
  **1907**. W10 dispatched: engine truth + token ledger + verify-kind.
- **2026-09-24 (wave 10 close — parent, 7 days late)** — W10 was **never verified or closed** on
  dispatch day: L1/L2/L3 landed code but wrote no landing logs, no gate ran, 7 files sat
  uncommitted. The parent verified all five lanes against bytes, repaired the stale tests, and
  wrote the missing record (**`fixes/216z_w10_landing_record.md`**). **Landed and verified:**
  T-11 green-seal gate (a red seal now mints **zero** lesson rows and records
  `p<phase>.seal.unmet` with the unmet DoD probe ids — proven by a parent probe: only the
  pre-existing non-lesson `Sandbox passed` row appears, `seal log: ["p6.seal.unmet"]`);
  **⚠️ the `probe:<id>`-tag half of T-11 is UNWIRED and this entry originally over-claimed it —
  see the correction at the end of this bullet**; the `p6.jobs.shortfall` production caller; T-107.6 cache-aware ledger +
  budget seam + the 48 000-char runner output clamp **wired** into `runNodeBounded` after
  redaction; T4.1/TA-16 verify-kind real install leg (scratch copy → `npm ci`/`install` →
  declared build/test, `RT_E_VERIFY_KIND_FAILED`, seam marked `mocked:true`) with the CLI
  awaiting it. **Parent repairs (old → new, in-file):** 2 sync call sites in
  `compile-check.server.test.ts` → `await` + honest install-leg assertions; 4 stale tests in
  `lesson-writers.test.ts` that pinned the **pre-T-11** behaviour (red seal mints a lesson) →
  rewritten to the T-11 contract, M5-1's digest assertions relocated byte-exactly onto the seal
  log (lib test count 16 → 15). **Gates after repair:** `npm run typecheck` **exit 0** ·
  `src/lib/**` suite **1919/1919 pass** · eslint 0 on both repaired files · the pre-repair gate
  run was red only on typecheck (3 TS2339 in the sync call sites) + lib (1920 tests / 7 fail).
  **Honest gaps carried forward:** L1/L2/L3 landing logs never landed (216z substitutes and says
  so) · the 7th lib failure is unattributed (only 30 log lines were retained; likeliest = the
  floating Promise's unhandled rejection — labelled a hypothesis) · new W10 exports
  (`p6JobsShortfallLog`, the probe-tag path, `clampRunnerOutput`, `installToolFor`) shipped with
  no dedicated tests → assigned to W11-L2/L1 · nothing W10 landed was exercised keyed.
  **W11 dispatched (6 lanes, `deleg_cbb4ad83`)**: L1 software engineer (T-18 `build` verdict +
  the owed install-leg tests) · L2 watchdog (independent verification + `honesty-guards.test.ts`
  + the T-107.8 isolation probe) · L3 researcher (Phase 5 spec + the T5.6/T5.8 decision register)
  · L4 agentic engineer (G1 CLI dispatch fix + TASK-01 `nextAction`) · L5 coding engineer
  (G2 engine error surface + T4.2 emitted `.gitignore`) · L6 UI/UX (the three S1 console bugs +
  compaction). Per-lane plans: `wave_plans/W11/lane-{1..6}.md`.
- **2026-09-24 (wave 11 return — parent triage; W12 already running)** — the 6 W11 lanes all
  reported at ~10:42 (`deleg_cbb4ad83`, 1480 s). **L1 ✅** verify-kind install-leg tests +
  T-18 `build` verdict (claims 42 tests/41 pass/1 by-design `RT_VERIFYKIND_INSTALL` skip + one
  clean typecheck) · **L2 ✅ watchdog** — the wave's most valuable lane: it confirmed the T-11
  gate, the ledger, the runner cap and the install leg, and **FALSIFIED two things** (see below);
  its `honesty-guards.test.ts` is 4/5 with **one deliberate red** (the F1 pin); it also settled
  **T-107.8: NO isolator on this host** (`docker`/`bwrap` → exit 127; WSL enabled but no distros)
  → `sandbox-policy.ts` wording stays, the task stays skipped · **L3 ✅** `fixes/217c` (734 lines)
  with two real anchor drifts caught (`deepseek.server.ts:233` → `src/lib/llm/providers/deepseek.ts:377`;
  `chat.server.ts:48` → `:53`) · **L4 ⚠️ INCOMPLETE (self-reported)** — G1 patched (4 edits, see
  below) but `nextAction`/TASK-01 **not started**, `217e` is a skeleton · **L5 ⚠️ PARTIAL** — both
  items landed (`engine.ts` `liveLayerFailureRow` + the emitted `.gitignore`) but its final gate
  and log fill did not run · **L6 ✅** UI-01/02/03 + UI-11 + T-22 landed (typecheck 0, eslint 0;
  UI-05/08 were already in the tree and were proven, not re-applied).
  **Parent actions taken:** (a) **G1 verified by the parent on the FINAL bytes** — L4 never re-ran
  its repro, so this was the wave's biggest unverified claim: all three cases now print exactly one
  coded JSON on stdout with **stderr 0 bytes** and exit 1 (`RT_E_PROJECT_MISSING` ×2,
  `RT_E_VALIDATION`), cli md5 `3f1d15fb437e1b03d5d2d7b291f0702e`; (b) the `fixes/216z` §1-L1-item-2
  **over-claim about `probe:<id>` tags is STRUCK** with the falsification recorded, and this
  changelog's own over-claim corrected; (c) `wave_plans/W11/README.md`'s dead citation
  (`217_w10_close_and_w11_plan.md` → `216z_w10_landing_record.md`) fixed.
  **Open repairs (owner: parent, several BLOCKED on W12 ownership):**
  1. **F1 — wire `probeTagsFromSignature` into `lessonRow`'s tag assembly** (`knowledge.ts:911`
     defined, never called) + correct `lessonRow`'s docstring over-claim + the two failing pins
     (`honesty-guards` F1, and any `lesson-writers` tag assertion). **Blocked until W12-LC releases
     `knowledge.ts`.**
  2. **TASK-01 `nextAction`** — L4's recon flagged a real vocabulary divergence: the brief's arm
     names are *states*, 111's `kind` is *action verbs*, and the console already ships `uiNextAction`
     (`console.tsx:292`, kinds `unknown/running/approve/retry/done/fix-gate/run`). **Decision
     (parent, recorded): implement 111's action vocabulary as the wire contract, satisfy the brief's
     seven arms as distinguishable cases, and keep the two computations independent this wave**
     (111 §1 itself says "one derived field, render it twice"). Implementation owner: next wave
     (`headless.ts` is not owned by any W12 lane).
  3. L5's log fill + final gate; the W11 boundary `gate.sh` (parent-only, after all W12 lanes stop).
  **Newly registered (not fixed):** **F2** — `clampRunnerOutput`'s elision marker can truncate for
  custom caps ≈64–118 chars (no production impact at the real 48 000 cap) · G3–G7 confirmed **still
  present** by L2's re-probe → G3/G6 in W12 lanes A/B, G7 in lane A, G4/G5 → W13.

---

## CORRECTION — 2026-10-03 (345-F1 docs-truth fix; HEAD `06cb089`)

This board's per-task rows are the 2026-09-16 snapshot (see the W47 correction at the top). Current
byte-derived state:

- **Gate of record (343 wave, `fixes/343_0_parent.md` §1/§7):** `gate.sh` `ok:true`, `hardFails:[]`,
  `flakes:[]` — scripts **427 pass / 0 fail** · lib **3261 pass / 0 fail / 2 skipped**. The
  "scripts 195/195 + src 1662/1662" and "398/2736" baselines above are historical.
- **Tracked counts:** total **1,933** · `src` 250 · `src/lib` 239 · `scripts` 49 (25 tools + 24 tests)
  · `fixes` 744 · `wave_plans` 139; `.t4scratch/` untracked/removed.
- **Delivered since this board:** TA-15 multi-job emission (keyed), `unattended`/`resume` (W36/341-6),
  MCP transport + doctor surface (340-1/342-5), cassette (340-4), `emit --git` (343-3). The residual
  is **keyed synthesis quality**.
- **CLI truths corrected:** exit taxonomy 0/1/2/3/4/5; the headless CLI reads `<cwd>/.env` (wins over
  the process env); a fresh `emit --run` is verified when its declared scripts resolve from the repo's
  own `node_modules/`. `tsconfig.scripts.json` is CLEAN.
