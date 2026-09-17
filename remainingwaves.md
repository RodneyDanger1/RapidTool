# remainingwaves.md — every remaining wave, what it must do, where, and why

**Purpose.** This is the execution catalogue for everything RapidTool still needs. It is
written to be handed to a fresh session (or a fresh engineer) verbatim: each wave lists its
lanes, the exact tasks, the files each touches, the done-when, the tests required, and the
known risks. Pair it with `taskuniverselog.md` (live per-task status board) and
`RESUME.md` (hard rules + settled decisions).

**Current state (2026-09-16, post-Wave-4).** `bash scripts/gate.sh` → `ok:true` (typecheck 0,
lint 0, assertion-gap lint 0, tests 220 scripts + 1803 src, build 0). Factory honest but
incomplete: `doctor` → `autonomousSoftwareFactory: false`; emitted tree census on the
reference corpus: `{stubs: 0, reexports: 5, real: 0}` (THE blocker, TA-15).

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
| **M-A · Maker test** | A real, friend-usable Coffeehouse2Home/Property-Ledger app emitted: `reexports: 0, stubs: 0, real ≥ 3` + ≥3 job modules pass their own oracle rows + a keyed end-to-end run | **W5** (rewire) + 1 keyed run |
| **M-B · Doctor latch** | `doctor` reports `autonomousSoftwareFactory: true` with no `gaps[]` fabrications | ≈W8–W10 (needs Phases 1–4 honest + TA-15) |
| **M-C · Full clear** | Every task in `taskuniverselog.md` done/verified or explicitly deferred-as-product-decision | ≈W11–W12 |

Rough arithmetic: ~7 waves remain (W5→W11) + a buffer wave. Each ≈1–3h of wall time with 5
flash lanes; parent boundary work ≈30–60 min per wave.

---

## W5 — "TA-15 rewire + integration starts" (next; ≈1.5–2h)

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
  `src/generated.ts`; zero-job graphs must return the EXACT legacy mapping.

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

**W5 boundary:** verify vs bytes (parent), four gates + `scripts/gate.sh`, board update,
push to GitHub, then W6.

---

## W6 — "Wave H integrations + honesty leftovers" (≈1.5–2h)

- **L1 — patch.ts integration (T-107.1 suite):** wire `applyStrReplace` into the P6 emit
  path (per-file deltas) in `codegen.server.ts` + `headless.ts repairTreeDir` so repair
  attempts produce diffs-as-results; pins that a >1-match edit REFUSES end-to-end.
- **L2 — T-11 + T4 hops (engine):** gate lesson capture on a green seal; tag lessons with the
  target probe; thread store rows into the expansion prompt (`opts.proven` plumbing: codegen
  ×3 + `engine.ts:600-603`). Files: `engine.ts`, `codegen.server.ts`, `knowledge.ts` tests.
- **L3 — T-107.9 compaction constants:** adopt the `SUMMARY_TEMPLATE` + compaction constants
  (new `src/lib/compaction.ts`), verify compaction BY EFFECT (3-outcome enum). Files: engine.ts
  helper + codegen caller.
- **L4 — 108-T3 + T-107.10:** precondition-vs-failure `RT_E` split; sub-agent contract +
  claim lifecycle for `crew.server.ts` + a deterministic mock-LLM E2E in the scripts leg.
- **L5 — doctor surfacing + TA-1/TA-21:** provider-team surfacing in `doctor.ts`; verify the
  four lane-reported blockers (TA-1); hygiene items (TA-21).
- **Boundary risks:** codegen.ts becomes the contention point this wave — serialize via lane
  notes (L1 owns codegen; L2/L3 report instead of editing).

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
