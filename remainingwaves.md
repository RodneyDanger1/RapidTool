# remainingwaves.md — every remaining wave, what it must do, where, and why

**Purpose.** This is the execution catalogue for everything RapidTool still needs. It is
written to be handed to a fresh session (or a fresh engineer) verbatim: each wave lists its
lanes, the exact tasks, the files each touches, the done-when, the tests required, and the
known risks. Pair it with `taskuniverselog.md` (live per-task status board) and
`RESUME.md` (hard rules + settled decisions).

**Current state (2026-09-16, post-Wave-5).** `bash scripts/gate.sh` → `ok:true` (typecheck 0,
lint 0, assertion-gap lint 0, tests 235 scripts + 1811 src, build 0; second green run). Factory
honest but incomplete: `doctor` → `autonomousSoftwareFactory: false`; emitted tree census on the
reference corpus: `{stubs: 0, reexports: 5, real: 0}` (THE blocker, TA-15 → W6-L1).

> **CORRECTION — 2026-10-02 (W47 record audit).** This state line and the whole W6→W12 catalogue below
> are from 2026-09-16; the repo is now in the **W47** era (HEAD `6575669`). The "THE blocker" is closed:
> **TA-15 landed (W8, `{stubs: 0, reexports: 0, real: 3}`)** and a **keyed run now emits a real
> multi-job product** (`inventory {stubs:0, reexports:0, real:2}`, `leftoverJobsAreReexportsOrStubs:false`
> in `fixes/332_0_parent.md` §4; 7 real job modules in `fixes/331_0_parent.md` §2). The
> `{stubs:0, reexports:5, real:0}` census and the "Never claim multi-job emission before TA-15 lands"
> standing rule (§Cross-cutting #1) are **historical**. Tests today (2026-10-02, HEAD `6575669`):
> scripts **398/398** · src **2736 tests / 2726 pass / 10 skipped**. For the live plan read
> `finalsprint.md`, the register appends, and the newest `fixes/3xx` logs — not the W6→W12 sketches here.

**Wave conventions (from RESUME §3 / board §6).** ≤5 lanes; `deepseek-v4-flash` only (never
Pro); disjoint file ownership; §3.0 guardrail block verbatim in every brief; skeleton-first
landing logs (`fixes/…`); every lane reads its own `wave_plans/W<N>/lane-<K>.md`; boundary =
verify landings vs bytes → attribute any red by mtime → parent repairs → four gates +
`scripts/gate.sh` green → board update → next wave. Estimated per-wave wall time is for all
5 flash lanes in parallel on this machine.

---

## Milestones & the big picture

| Milestone | Meaning | Distance |
|---|---|---|
| **M-A · Maker test** | A real, friend-usable Coffeehouse2Home/Property-Ledger app emitted: `reexports: 0, stubs: 0, real ≥ 3` + ≥3 job modules pass their own oracle rows + a keyed end-to-end run | **W6** (TA-15 completion) + 1 keyed run |
| **M-B · Doctor latch** | `doctor` reports `autonomousSoftwareFactory: true` with no `gaps[]` fabrications | ≈W8–W10 (needs Phases 1–4 honest + TA-15) |
| **M-C · Full clear** | Every task in `taskuniverselog.md` done/verified or explicitly deferred-as-product-decision | ≈W11–W12 |

Rough arithmetic: ~6 waves remain (W6→W11) + a buffer wave. Each ≈1–3h of wall time with 5
flash lanes; parent boundary work ≈30–60 min per wave.

---

## W5 — "TA-15 rewire + integration starts" (CLOSED 2026-09-16 — outcome below; ≈1.5–2h planned)

**W5 OUTCOME (closed 2026-09-16 ~21:42 — `gate.sh {"ok":true}`; typecheck 0 · lint 0 · gaps 0 ·
scripts 235/235 + src 1811/1811 · build 0):** L1 ⚠️ partial — TA-15: `orderTreeChunks` + full
design landed in `216k`; the caller was restored to the legacy pairing by the parent (rewire →
**W6-L1**) · L2 ✅ complete (harvest cap + zero-budget tests, T-15 determinism guard, `216i`/`216j`
bodies, doc counts verified) · L3 ⚠️ approvals routed through `policy.ts` at all three sites
(seats byte-identical) — bypass pins + `216o` → **W6-L2** · L4 ⚠️ provider registry + role tiers
landed — tests + `216p` + `doctor` surfacing → **W6-L3** · L5 ⚠️ run-side graders + trials/pass@k
+ leak scan landed; keyless run recorded (6 cases, 0 grader leaks) — `216q` body + `--trials=2`
evidence → **W6-L4**.

**Theme:** land the multi-job emission (THE product blocker), close the W4 tails, start the
Wave-H integrations, and finish the honesty-doc bodies. 5 lanes, all files free post-W4.

### W5-L1 — TA-15 rewire + T-13 fin (CRITICAL PATH)
- **Files:** `src/lib/codegen.server.ts` + test, `src/lib/scaffold.ts` + test, `src/lib/engine.ts`,
  `src/lib/doctor.ts` (minor), `fixes/216k_multi_job_emission.md` (body).
- **Tasks:** (a) rewire `synthesizeChunkedTree` (~:2118, currently `treePathForChunk` at :2176)
  onto the already-landed `treeChunkPlan` helpers (codegen ~:830-1010) so job-node files are
  written per job; (b) scaffold: `emitTreeBridge` (:792-809) + node loop (:2355-2423) bridge
  ONLY genuinely unmapped nodes, count + surface (warning + README line); (c) oracle ctx
  (:2451-2454) passes job-node paths so ≥3 job modules get their OWN rows; (d) T-13: engine
  `p6.jobs.shortfall` log + printed shortfall (declared 10 vs 5 nodes); (e) doctor
  `jobScopeShortfall` already landed (15/15) — extend if needed.
- **Done-when:** probe on a corpus-shaped fixture → `reexports: 0, stubs: 0, real ≥ 3` AND ≥3
  job modules pass their own oracle row (no shared hash); typecheck 0; codegen 86→grow,
  scaffold 36→grow, doctor 15→grow suite green.
- **Tests needed:** per-job mapping (codegen); real-emission + bridge-only-when-unmapped +
  visible warning (scaffold); census triple (doctor); shortfall log (engine).
- **Risks / possible bugs:** ⚠ *chunk-order tension* — the corpus's `record` signatures split
  non-contiguously (first 8-sig chunk splits at index 8), so sibling chunks must import
  earlier files **in reverse signature-index order** or the tree emits a forward call
  (W4-L1 recorded this; decide + note in 216k). ⚠ *emitted oracle spec typing* — tree ESMs
  are named exports while the spec pins bare entry names; planned fix = typed cast
  `const <slug> = treeModule as unknown as Record<string, (...a: never[]) => unknown>;`
  (no assertion weakened). ⚠ `materializeImportableTree`'s ESM barrel must stay at
  `src/generated.ts` — the *emitted* tree's barrel path (`TREE_ENTRY_PATH`, `codegen.server.ts:1514`;
  not a file in this repo); zero-job graphs must return the EXACT legacy mapping.

### W5-L2 — Test-tails + log bodies + counts drift
- **Files:** `src/lib/harvest.ts` + test, `src/lib/algorithms.test.ts` (T-15 guard new test),
  `fixes/216i_knowledge_integration.md` + `fixes/216j_honesty_tooling.md` (bodies),
  docs counts (README/AGENTS/README-cli) for TA-3.
- **Tasks:** (a) `harvest.test.ts` — the imported `HARVEST_MAX_CANDIDATES` needs its real cap
  test + the two zero-budget note-branch tests (cap enforcement at loop top ~:413, note branch
  ~:506); (b) T-15 determinism guard test — scan `design.ts`/`diagram.ts`/`vector.ts`/
  `brief-fixtures.ts` for `Date.now(`/`Math.random(`, with **algorithms.ts as the documented
  exception** (6 real `ranAt` stamps :1046-1076) + a planted-violation teeth test; (c) re-run
  algorithms/algo-tools/knowledge suites (W4 edits verified green by the parent sweep but their
  new tests deserve a dedicated pass + the T-07 `ws >= 0.54` bound re-derived honestly);
  (d) fill 216i/216j bodies (commands, results, old→new, deferred); (e) TA-3: verify doc counts
  (test totals, verb counts) match reality — fix drifted numbers.
- **Done-when:** named suites green (grow), 216i/j bodies complete, no doc count lies.
- **Risks:** the T-07 weight bound may be wrong (it was derived, not observed — if the new
  algorithm test fails, fix the TEST expectation to the real weight, recording old→new).

### W5-L3 — Policy engine integration (Wave H · T-107.3 routing)
- **Files:** `src/lib/headless.ts` (~:734 approval seam), `scripts/rapidtool-cli.mjs` (:517),
  `src/lib/dod.ts` (:337-483), + tests in their suites; `fixes/216o_policy_integration.md`.
- **Tasks:** route EVERY approval through `evaluatePolicy(action, resource, ctx)` from the
  W4-landed `src/lib/policy.ts` (seats: autopilot / human+token; default-deny); keep the
  `ApproveActor` shape (TA-2) compatible; make `hitl.force` un-self-approvable; add pins that a
  denied action cannot be bypassed by either seat path.
- **Done-when:** typecheck 0; headless/dod/cli suites green; a denial is NOT bypassable (pin).
- **Risks:** CLI exit-code contract (`emit --run` exits 1 when not ok) must not change; seat
  label strings are pinned in tests — record old→new if any label text must change.

### W5-L4 — T-107.2 provider registry + role tiers (Wave H)
- **Files:** NEW `src/lib/llm/providers/*.ts`, `src/lib/llm.ts`, `src/lib/deepseek.server.ts`
  (→ migrated/moved behind the registry), seam switches in `src/lib/verify.server.ts`,
  `src/lib/chat.server.ts`, `src/lib/crew.server.ts`; `fixes/216p_provider_registry.md`.
  `codegen.server.ts`'s seam hop is DEFERRED (owned by W5-L1) — list it in the log.
- **Tasks:** registry with role tiers (main/reasoning/weak) + explicit-model rule; one
  `callModel(role, …)` seam; DeepSeek via the registry; keyless behavior unchanged (honest
  skip); `doctor` surfacing deferred to W6.
- **Done-when:** all existing LLM-seam tests green with env stubs; no behavior change keyless;
  registry unit tests + one seam migration test per switched file.
- **Risks:** model-id rules (V4.1-Flash `deepseek-flash` API id; version-tagged ids rejected
  by api.deepseek.com — see `rapidtool-development` skill reference); keep `fetch` stubbing
  patterns the tests already use.

### W5-L5 — T-107.5 run-side acceptance fixtures + pass@k (Wave H)
- **Files:** `scripts/run-eval.mjs`, `research/eval-corpus/` (fixtures out of the
  agent-writable project → run-side grader files), `src/lib/brief-fixtures.ts`; tests in
  `scripts/*.test.mjs`; `fixes/216q_eval_fixtures.md`.
- **Tasks:** move acceptance fixtures to run-side files the agent cannot write; add trials +
  pass@k/flakiness accounting; keep `run-eval.mjs`'s honest `redTreeBanner` metric.
- **Done-when:** eval harness reports trials/pass@k honestly; fixtures unreachable from the
  emitted project; `npm run eval` keyless run still completes with honest skips.
- **Risks:** eval harness is the maker-test path — don't break its CLI contract; corpus
  fixtures feed TA-15's probe (coordinate wording with W5-L1's census expectations).

**W5 boundary (DONE 2026-09-16):** verified vs bytes (parent) → four gates + `scripts/gate.sh`
`{"ok":true}`; board updated; W5 landed as commit `e97e72d` on `main`, then W6 dispatched.

---

## W6 — "TA-15 completion + W5 tails" (DISPATCHED 2026-09-16 ~21:55; 5 lanes, ≈1.5–2h)

Re-scoped at dispatch: W4–W5 landed the **cores** this section originally sketched
(`patch.ts` + `policy.ts` 48/48, provider registry + roles, run-side eval graders), so W6
finishes **TA-15** (THE product blocker) and closes the five W5 lane tails. Each lane reads its
own `wave_plans/W6/lane-N.md` FIRST.

- **L1 — TA-15 COMPLETION (THE product blocker):** finish the chunked-tree rewire W4 designed /
  W5 began (`orderTreeChunks` + full design landed in `216k`; the caller was restored to the
  legacy pairing so the tree compiles) — per-job emission → scaffold bridge allow-list/count →
  oracle job-row ctx → engine shortfall log → tests → census probe. Files: `codegen.server.ts`
  + test, `scaffold.ts` + test, `engine.ts`, `fixes/216k`. Done-when: probe (outside the repo) on
  a corpus-shaped fixture → `reexports: 0, stubs: 0, real ≥ 3` AND ≥3 job modules each pass their
  OWN oracle row (no shared hash).
- **L2 — policy tail:** bypass pins (a denied action is un-bypassable by BOTH seats; `hitl.force`
  cannot self-approve) + ledger provenance (seat label + token-path bool on the `HitlDecision`
  shape). Files: `types.ts` (one additive field), `headless.ts` + test, `rapidtool-cli.mjs`
  (approve path), `dod.ts` + pins, `fixes/216o`.
- **L3 — registry tail:** provider-registry unit tests + one migration test per switched seam;
  `doctor` provider-team surfacing (keyless ⇒ honestly not-configured); `fixes/216p` — the
  `codegen.server.ts` seam hop stays DEFERRED to L1's file (do not edit codegen).
- **L4 — eval tail:** `fixes/216q` body + the keyless `npm run eval -- --trials=2` evidence +
  README/`remainingwaves.md` sync.
- **L5 — TA-1 + TA-21 + `216f`:** verify (or strike, with evidence) the four `[lane-reported]`
  blockers from `100:37-41`; TA-21 hygiene items fixed or explicitly deferred; complete the
  `216f` log body.
- **Carried past W6** (pre-dispatch sketch items not in this dispatch; disk check 2026-09-16:
  `applyStrReplace` has no production caller, `src/lib/compaction.ts` does not exist, no provider
  surfacing in `doctor.ts`, `opts.proven` not plumbed): patch.ts integration into the P6 emit
  path / `repairTreeDir`, T-11 green-seal lesson gating + T4 `opts.proven` prompt hops, T-107.9
  compaction constants, T-107.6 token-ledger rollout.
- **Boundary risk:** `codegen.server.ts` is the contention point — L1 owns it; L2/L3 report
  instead of editing. Boundary = `gate.sh` + the board update.

## W7 — "108 steals + ledger" (≈2h)

- **L1 — 108-T1 in-place edit verb** (dry-run + ledger attribution; CLI + new engine path).
- **L2 — 108-T2 export registry → synthesis** (`codegen.server.ts`, `prompt-engine.ts`).
- **L3 — 108-T5 repair-budget + coded exhausted error** + 108-T7 E2E-vs-running-instance
  feasibility spike (script + memo).
- **L4 — T-107.6 token ledger everywhere** (`token-ledger.ts` + every LLM seam; output caps on
  tool/runner results). **L5 — 112 T5** (`lesson --advise` / `--verify` verbs) + UI TASK-01.
- **Risks:** CLI verb-count doc contract (`README-cli.test.mjs`) — every new verb must update
  the README count in the same commit.

## W8 — "Phase 1: adapters + router + provenance" (≈2–3h)

- Provider adapter layer + model router (104 Plan Phase 1, T1.3/T1.4 provenance migration);
  105 standalones TA-5…TA-8 (provider-aware "configured" predicate replaces
  `isDeepSeekConfigured()` gates; co-land P6 `reasoningEffort`). Touches: new
  `src/lib/llm/*`, `codegen.server.ts`, `verify.server.ts`, `doctor.ts`.
- **Risks:** the "configured" predicate switch flips doctor output — land WITH TA-5 per plan.

## W9 — "Phase 2 + Phase 3 start" (≈2–3h)

- Token ledger unification + budget pre-attempt (Phase 2); judge rungs T3.1/T3.2 (Phase 3);
  TA-9/TA-10. **Risks:** judge protocol needs cross-family models — key availability gates
  real tests; keep keyless paths honest.

## W10 — "Phase 3 tail + Phase 4 start (verify-kind, git)" (≈2–3h)

- TA-11/TA-12/TA-14 judge hardening; **T4.1/TA-16 verify-kind real install** (scratch copy +
  `npm ci` + claim strikes — this also unblocks *honest* full-run claims) and **T4.2/TA-17 git
  landing** (`.gitignore`, init, commit surface). **Risks:** network/toolchain availability —
  verify-kind must fail LOUDLY, never fake installs; git landing must never run on the user's
  repo without a seat.

## W11 — "Phase 4 tail + Phase 5" (≈2–3h)

- T4.3/TA-18 apply-patch preservation + conflict semantics; T-107.7 checkpoint + `resume`
  verb; T-107.8 real executor **only if** docker/bwrap provably available (otherwise keep
  `sandbox-policy.ts` claims truthful and skip); Phase 5 (T5.x) minus product decisions.

### W11 AS DISPATCHED (2026-09-24, `deleg_cbb4ad83` — 6 lanes, per-lane plans in `wave_plans/W11/`)

The plan above was re-scoped at dispatch to the wave that actually clears the honesty backlog the
W10 close exposed plus the audit's ranked defects. **L1** software engineer — T-18 (`build` verdict
in `tree-run`) + the owed verify-kind install-leg tests · **L2** watchdog — independent
verification of the W10/W11 landings, the T-107.8 isolation probe, and the additive
`honesty-guards.test.ts` · **L3** researcher — Phase 5 (T5.1–T5.7) as a verified spec + the
T5.6/T5.8 decision register · **L4** agentic engineer — G1 (CLI dispatch falls through a handled
refusal) + TASK-01 (`nextAction` on the summary envelope) · **L5** coding engineer — G2 (engine
silent catch-all) + T4.2 (emitted `.gitignore`) · **L6** UI/UX — UI-01/02/03 (the three S1 console
bugs) + compaction (UI-05/08/11, T-22).

**Pushed to W12 (not dropped):** T4.3/TA-18 patch preservation (spans `codegen.server.ts` +
`headless.ts` + `io.ts` — collides with W11's ownership), T-107.7 checkpoint + `resume`, T-107.8
(gated on L2's isolation probe), the `store.ts` half of G2, G5 (emitted RT_E codes), G6 (unlogged
LLM-shape swallows), T-21 (TASK-05 tab tiering), and every T5.x that L3's spec turns runnable.

## W12 — buffer / polish (as needed)

- Doc re-sync (README/board/remaining), UI polish leftovers (TASK-01 if not done), eval-corpus
  expansion, CI wiring spike, **product decisions** T5.6/T5.8 (USER-owned), final keyed
  maker-test run + report.

---

## Cross-cutting risks & standing rules for every remaining wave

1. **Never claim multi-job emission before TA-15 lands** (`reexports:5, real:0` is the truth
   until `doctor --tree` shows otherwise on a real tree).
2. **Never claim sandbox/Docker/bwrap isolation** — `node-runner.server.ts` is bounded, not
   sandboxed; `sandbox-policy.ts` claims flip only when provably true (T-107.8).
3. **Never mint `decidedBy:"human"` from a machine path** — seats only (TA-2/policy).
4. **`hermes verify` landmine:** `.hermes/environment.json` holds an auto-detected recipe with
   a write-mode `npm run format` step; do not run as-is (board §6 rule 7). T3.6 = add a
   `format:check` script and wire THAT into verification when the user approves touching it.
5. **Keyed-run costs:** real LLM runs need `DEEPSEEK_API_KEY` (present in `.env`, never
   printed, never committed) — batch model calls through the registry (W5-L4) so the ledger
   (W9) can account for them.
6. **Flash-only delegation** — `deepseek-v4-flash`; never Pro tier.
7. **Gate discipline** — `bash scripts/gate.sh` green at every boundary; attribute any red by
   file+mtime before believing it's a defect; never run gates while lanes are mid-edit.
8. **Doc-truth drift** — any count/verb claim in README/AGENTS/README-cli must be re-verified
   in the wave that changes it (the README-cli doc-contract test is the model to copy).

---

## CORRECTION — 2026-10-03 (345-F1 docs-truth fix; HEAD `06cb089`)

Everything in the W6→W12 catalogue above is the 2026-09-16 sketch. Current byte-derived values:

- **Gate of record (343 wave, `fixes/343_0_parent.md` §1/§7):** scripts **427 pass / 0 fail** · lib
  **3261 pass / 0 fail / 2 skipped**; `gate.sh` `ok:true`. The `235/1811` and `398/2736` pairs quoted
  above are historical.
- **Tracked counts:** total **1,933** · `src` 250 · `src/lib` 239 · `scripts` 49 · `fixes` 744 ·
  `wave_plans` 139. `.t4scratch/` is no longer tracked.
- **Delivered since this catalogue was written:** TA-15 multi-job emission (keyed), `unattended`
  (341-6), checkpoint+`resume` (W36), MCP transport + doctor surface (340-1/342-5), cassette (340-4),
  kind emitters (341-1), `emit --git` landing (343-3). The residual constraint is **keyed synthesis
  quality**, not the W6→W12 lane list here.
- **CLI truths corrected:** exit taxonomy 0/1/2/3/4/5; headless CLI reads `<cwd>/.env`; a fresh
  `emit --run` is verified when its declared scripts resolve from the repo's own `node_modules/`.
  `tsconfig.scripts.json` is CLEAN (`tsc -p tsconfig.scripts.json --noEmit` exits 0).

---

## CORRECTION — 2026-10-05 (346 wave batch 10; HEAD `2f0e3d7`)

Everything in the W6→W12 catalogue above is the 2026-09-16 sketch; the 2026-10-03 correction is stale.
Current byte-derived values (commands run this session):

- **Gate of record — GREEN on the frozen tree (HEAD `2f0e3d7`, clean):** `ok:true`, `flakes:[]`,
  `hardFails:[]`; typecheck 0 · lint 0 (**5 warnings**) · assertion-gap lint 0 · **prevention 20/20**
  (`missed:[]`, `pending:[]`, `skipped:[]`, `count:20`, `countFloor:20`) · scripts **513/0** · lib
  **3712 pass / 0 fail / 2 skipped** · build 0. Exact JSON in `README.md` / `AGENTS.md`.
- **Tracked counts:** total **2,014** · `src` 256 · `src/lib` 244 (129 non-test + 115 tests) ·
  `scripts` 107 (33 tests) · `fixes` 761 · `wave_plans` 139 · `research/multiagent` 103.
- **Landing state:** the 346 wave ran **batches 1–10** (`7db4d7d`, `100504c`, `128a539`, `c16220b`,
  `f4eb883`, `136b1dd`, `91f47f2`, `886f155`, `b3baef8`, `2f0e3d7`); all committed, tree clean. See the
  append-only summary in `fixes/346_wave_log.md`.
- **Autonomy contract (PR-33, 2026-10-05):** Owner Open Question 1 = **Option A** — the additive machine
  reading (`autonomousFactoryV2` + `fleetAcceptance`, seat `machine:tree-run`) beside the byte-identical
  human-gated `autonomousSoftwareFactory`; a machine path may never mint `decidedBy:"human"`. Rationale:
  the 338-4 anti-self-certification doctrine. Rejected: dropping the human conjunct.
- **Rollout flags (design §10), all default off / byte-identical when omitted:** `--allow-empty`,
  `gate --resynthesize`, `repair --from-gate`, `--token-ledger <file>` / `RAPIDTOOL_LEDGER_FILE` +
  `RAPIDTOOL_CAMPAIGN_TOKEN_CAP`, `resumeAccepted`. Defaults + rollback table in `README.md` / `AGENTS.md`.
- **Campaign #1 (keyed, 2026-10-05; `testruns\_report\CAMPAIGN1.md`):** `workingApp` **0/8** (target
  ≥5/8); 6/8 stall at the P6 DoD gate; delivery truth PASSED (0 empty-substance commits, 0 red-tree
  commits). **The remaining constraint is the P6 synthesis wall**, not a W6→W12 lane.
- **Residuals:** `resumeAccepted` plumbed but not consumed by codegen; 5 lint warnings; cross-family
  failover unimplemented; console seat-delivery seam open; no OS isolation beyond the runtime Permission
  Model bound; P7 `p7-research` offline; prettier drift measured, not gated.
