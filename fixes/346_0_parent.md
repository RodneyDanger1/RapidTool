# 346 wave (W60) — PAUSED. Where we left off.

**Status: PAUSED by owner instruction, 2026-10-03.** Opened at HEAD `988b158`, clean tree, 1940 tracked.
**Reason for pausing: explicit owner request. No work is running.** All agents and background tasks are
stopped; this file is the resume map.

## 1. What is on disk (uncommitted at pause)

- **41 modified files, +2012 / −378**, plus **7 new files** (`scripts/factory-watch.mjs`,
  `scripts/factory-watch.test.mjs`, and the logs `fixes/346_e1_verification.md`,
  `346_e2_resilience.md`, `346_e3_orchestrator.md`, `346_e4_ui.md`, `346_v1_validate.md`).
- **0 tracked-file deletions** (destruction watch ran 1,274 s and exited clean).
- **Gate of record (run on this exact tree before the last fix attempt):**
  `{"ok":true,"flakes":[],"hardFails":[],"quarantined":[],"skips":2,"gates":{"typecheck":ok,"lint":ok,
  "assertionGaps":ok,"build":ok,"testsScripts":{"pass":440,"fail":0},
  "testsLib":{"pass":3361,"fail":0,"skipped":2}}}`.
- **In-flight, unverified edits preserved (NOT reverted):** two files a killed fixer touched *after* the
  gate — `src/lib/knowledge.ts`, `src/lib/knowledge.test.ts`, `src/lib/llm/providers/one-shot-fetch.test.ts`.
  Re-checked at pause: **65/65 pass**, so the tree is not broken; the fix's RED-first proof and its
  `E2` log entry were never written.

## 2. What the wave completed (4 engineers, all reported)

- **E1 verification completeness:** E-08 oracle pinning is now **live** at both call sites
  (`codegen.server.ts:4694`, `headless.ts:4298` feed `seeds`/`pinnedOracleIds`); the **tree-lane oracle
  now requires a behavioural assertion** (`scaffold.ts:2595-2603`, `specSourceHasBehaviouralAssert`,
  `TreeSpecVerdict.behavioural`, `treeRunTestedEvidence` requires ≥1 passing behavioural spec);
  `moduleEmbedded` empty-source guard; empty-`expect.shape` rejection; `specExitIsGreen`
  (`fail===0 && cancelled===0`); `VERDICT_CHANNEL_FAILED_REASON`. Owned suites 719/718/0/1 both runtimes.
- **E2 provider resilience:** one shared `TRANSIENT_RETRY_STATUS` (`{429,500,502,503,504}`); the three
  remaining undici `fetch` sites migrated to the one-shot seam; redaction extended (`xai-`/`tvly-`
  shapes, exact key values); `token-ledger` `.code`; `checkpointAdmits` validates `savedAt`; the
  watchdog doc claim struck; **`A2-F2` failover: the un-armed shell was DELETED** (evidence: `xai` has
  `requestModelIds: []`, nothing registers a descriptor, `LlmResult` has no provenance — it could never
  be armed with 0 keyed calls). Owned suites 341/340/0/1 both runtimes.
- **E3 orchestrator + process (the headline):** **`scripts/factory-watch.mjs`** — the walk-away factory:
  an intake (dir/queue) drained `create → unattended (machine seat) → emit --git` per brief, with durable
  checkpoint/resume (`state/factory-state.json`), idempotence (`already-delivered` in 0.3 s, no duplicate
  commit), **honest refusal** (a keyless/red run reports `drive-stalled` + its code and delivers nothing),
  and corrupt-state refusal. Tests `factory-watch.test.mjs` 9/9 both runtimes. Docs + a host-hook recipe
  (Task Scheduler/cron) in `scripts/README-cli.md` + `npm run factory`. Bounded keyed proof (~$0.032):
  one real delivery (`feat(expense-tracker)`), one honest stall. Also `PORT` honoured; prettier measured
  (244 warns → documented, not gated); CI honesty text; an opt-in `--quarantine` flake path (default
  byte-identical); README-cli `--git` prose.
- **E4 UI completeness:** cross-tab lost updates **fixed** (`mergeCrossTabProject`/`reconcileCrossTabProjects`
  + a `storage` listener + a drift notice); hidden-tab eager fetches **fixed** (0 `fixturesServer`/
  `chatContextServer` on load, fire on activation); a **SpendChip** surfaces `tokenUsage` (absent →
  "spend not recorded"); the no-op ingest notice fixed; **corrupt-blob rescue** (no silent data loss);
  artifact list windowed (800 → 101 rendered); the chat thinking row announced (`role="status"`); the
  console human stamp **attributed honestly** (`hitl.console_decision` row naming `human-seat-unverified`).
  `store.test.ts` 112/112 both runtimes; browser-verified.

## 3. What was IN FLIGHT when paused (exact briefs to resume)

1. **SB-1 (High) — `knowledge.ts` fingerprint is still non-injective for a delimiter inside an array
   element.** Validator V1 reproduced it: the tags/supersedes elements are joined with `,` **before**
   escaping, so `["a,b"]` and `["a","b"]` collide and the second distinct row is silently swallowed
   (`appended:false`, wrong tags). The fix: escape reserved characters **inside each element before
   joining**; keep delimiter-free inputs byte-identical; RED-first pins for the collision pair, the
   NUL/`|` cases, the `anchors` round-trip, and the no-churn case; also tighten the `one-shot-fetch`
   static guard (evadable via `globalThis.fetch(`). **Status: partial edits landed and pass 65/65; the
   RED-first proof + log entry are owed.**
2. **SB-2 (Med) — the tree-lane behavioural floor accepts literal tautologies.** V1 showed
   `assert.equal(1,1)` and presence-only operands are counted "behavioural" by the tree lane while the
   oracle lane rejects the equivalent `1 === 1`. The fix: bring the tree lane to parity with the oracle
   rule (a module read tied to a concrete value / relational predicate; literal-vs-literal, `typeof`-only,
   and `null`/`undefined` expectations are not behavioural), share one classifier if the code allows,
   correct the overstatement in the E1 report/comment. **Status: NOT STARTED** (`compile-check.server.ts`
   was untouched by the killed fixer).
3. **V2 validation never ran** (killed at pause). Its scope must be redone: validate the orchestrator
   adversarially (never invents success, idempotence, resume, corrupt-state refusal, ≤2 keyed calls) and
   at least three E4 UI fixes in a real browser; plus a whole-codebase census (`tsc`/`eslint` at zero,
   prohibited constructs, 5 exports with real consumers) and a destruction audit vs the 1940 baseline.

## 4. Resume plan (in order)

1. Finish **SB-2** (E1's brief above) — it is the last trust-chain gap V1 found.
2. Finish **SB-1** (E2's brief above) — write the RED-first proof and the log entry.
3. Run **V2's validation** (orchestrator + UI + codebase census + destruction audit).
4. Re-run the boundary gate; then commit this wave (the 41+7 file state is otherwise uncommitted).
5. Lower-priority disclosures still open from V1: SB-3 (guard evasion — part of SB-1), SB-4
   (`dod.ts:1113-1120` stale DORMANT comment), SB-5 (an A2-F5 line-number drift), SB-6 (the failover
   removal traded a loud refusal for silence — disclosed, intentional).
6. Standing known gaps (unchanged): no OS isolation (declared); the human acceptance stamp by design;
   the emitted tree-lane probe is deliberately modest (row-specific behavioural cases remain
   `generateCases`'s job); cross-family failover is genuinely unimplemented (deleted switch, not a
   capability); `requiresHumanResume`/`shouldAutopause` stay unwired until the store driver lands.

## 5. Log index

`346_e1_verification.md` · `346_e2_resilience.md` · `346_e3_orchestrator.md` · `346_e4_ui.md` ·
`346_v1_validate.md` · (this file). Prior waves: `345_0_parent.md`, `344_0_parent.md`, …
