# 345 wave (W59) — 3 lookers + 3 fixers, then 3 follow-up fixes

**Opened** 2026-10-03 at HEAD `06cb089`, clean tree, 1933 tracked. **Eight agents resumed from the 344
audit** (same agents, new tasks): three lookers (find) and three fixers (close), then three follow-up
fixer resumes for the strongest new findings. Logs: `fixes/345_l1_looker.md`, `345_l2_looker.md`,
`345_l3_looker.md`, `345_f1_fixer.md`, `345_f2_fixer.md`, `345_f3_fixer.md`.

## 1. Lookers — new findings

- **L1 (trust chain, adversarial).** Confirmed the fd-3 forgery fix is sound (could not re-forge; also
  attacked `applyVerifyOutcome`, `p6-verified`/M4, the wrapper-envelope parse, the spec-file verdict
  parse, the land/host/nested-repo guards, quarantine, the emit red-tree refusal, the eval graders,
  maker-score floors, and the typed-strip path — all held). Found **L1-F2 (Med): oracle
  self-certification** — a module whose only export returns `NaN` plus a shape-only case
  (`boardAdd(1) !== null`) earned `passed` → `tested`; the same model authors the module and the cases.
  Also L1-F1 (the land seam trusts the caller's manifest — a file absent from the manifest is committed
  as `foreign:[]`), L1-F3 (latent exit-0 trust), L1-F4 (`moduleEmbedded` true for an empty source),
  L1-F5 (empty `expect.shape {}`).
- **L2 (fix-validation + misses).** The forgery fix **CONFIRMED-FIXED** under adversarial probes; the
  placeholder fix **PARTIALLY FIXED** — it left **L2-X1 (Med): `doctor` still accepted a placeholder-only
  bar** (factory latch true while the scorer returned 0 — a cross-surface contradiction). Plus L2-X2…X6
  (an untested fail-closed branch, CLI `fixtures --draft` minting placeholders with no warning, a
  mislabeled channel failure, an uncovered `throws` sentinel).
- **L3 (deeper UI/UX, driven in a browser).** Independently re-validated the stall-latch and now-line
  fixes as landed. Found **L3-03 (Med-High): a reload mid-run wedged the build permanently** (phase stuck
  `RUNNING`, Execute disabled, no recovery control); L3-01 (a ~1 s false "build doesn't exist" flash
  before hydration); L3-02 (no cross-tab sync → a silently lost rename); L3-04 (run spend invisible), L3-05
  (eager hidden-tab server calls), L3-06 (a success notice on a no-op ingest), L3-07 (corrupt storage
  silently replaces builds), L3-08 (duplicate builds on queued clicks), L3-10/11/12.

## 2. Fixers — landed

- **F1 (docs/config truth).** ~20 false or stale claims corrected with append-only "CORRECTION —
  2026-10-03 (345-F1)" blocks, every count re-derived from `git ls-files` at `06cb089`: the false
  "the CLI does not read `.env`" (three files), the exit taxonomy (**0/1/2/3/4/5**), "no git landing /
  no resume" (both real), "*every* `emit --run` is unverified" (false), the auth-migration claim (never
  applied), "1030 pre-existing" scripts errors (actual **0**), suite/module/catalog counts
  (1,933 · 239 = 123+112 · 49 · 744 · 139), the RT_E live-emitter notes, `--verify-kind` refs,
  `START-HERE.md`'s shelled list, `.env.example` (+6 live knobs), the dev-server bind claim (loopback),
  and the false CI pin comment. `README-cli.test.mjs` 12/12. The CI Windows leg left as an owner call.
- **F2 (core wiring).** **A1-03 E-19 `verifyPriorPhases` WIRED** into the real report-ingest path, emitting
  a `regression.drift` row (RED 216 → GREEN 219/219). **A1-06** the console wild start now performs the
  attach step and records `wild.plan_absent` when no plan exists. **A1-05 + V1-M2** pins added with
  mutation proof (5/5 guards now CAUGHT). **A1-04** the false E-08 claim struck + STOP-and-REPORTed
  (the caller feeds live in `headless.ts`/`codegen.server.ts`).
- **F3 (UI robustness + test teeth).** **A3-02 stall latch FIXED** (a heartbeat caller `clearStall`s on
  stop/pause) and **A3-01 now-line FIXED** (`pickNowLine` extracted to `rt-client.ts`, preferring real run
  rows); **9 new pins**, each mutation-killed (artifact cap, body cap, fingerprint participation,
  empty-set invariant, finite-timeout, `savedAt`, Long-Tasks floor + coalescing, the 5 000 ms boundary).
  Browser-verified.

## 3. Follow-up fixes (the strongest new findings)

- **L1-F2 (oracle self-certification) — FIXED.** A deterministic **behavioural-assertion floor**
  (`behaviouralOracleExpression` / `oracleHasBehaviouralCase`) at the case-commit seam: a set with no case
  that ties a module read to a concrete expected value (or a relational predicate) gets one bounded repair
  then a coded `RT_E_VALIDATION` refusal — never a pass. The prompt now requires a behavioural assertion.
  The `()=>NaN` stub is refused; behavioural controls still pass (98/98 + `codegen` 224/224 both
  runtimes). Residual (STOP-and-REPORTed): the tree lane's `scaffold.ts` rows still lean shape-only.
- **L2-X1 (doctor vs scorer) — FIXED.** `doctor.humanFixturesFromProject` now uses the shared
  `fixturesHavePlaceholder`, so a placeholder-only bar no longer closes the fixtures gap or sets the latch
  — the two surfaces name the same bar (155/155; consumers 306/306).
- **A1-07 — FIXED.** `RT_E_IMPORT_TOO_LARGE` minted in the registry and returned by `io.ts`.
- **L3-03/L3-01/A3-14/L3-08 — FIXED and browser-verified.** Hydrate now resets an interrupted phase to
  `ready` with a `run.interrupted` row (the wedge is gone; Execute works again); the run screen renders a
  skeleton until hydrated (no false not-found flash); rail badges no longer bleed; `launch()` has a
  synchronous latch (3 queued clicks → 1 build). 301/301 both runtimes.

## 4. Gate of record

`{"ok":true,"hardFails":[],"flakes":[],"gates":{"typecheck":ok,"lint":ok,"assertionGaps":ok,"build":ok,
"testsScripts":{"pass":427,"fail":0},"testsLib":{"pass":3329,"fail":0,"skipped":2}}}`.
**0 tracked-file deletions.**

## 5. Remaining (out-of-ownership STOP-and-REPORTs + open items)

- **A1-04 caller feeds:** `headless.ts` / `codegen.server.ts` must pass `seeds`/`pinnedOracleIds` so E-08
  oracle pinning is live (the claim was struck meanwhile).
- **A1-08:** `token-ledger.ts:575` should attach `.code = "RT_E_VALIDATION"` (3-line shape reported).
- **`checkpointAdmits` `savedAt`** (`checkpoint.server.ts:407`) still unvalidated; `requiresHumanResume`
  (`watchdog.ts`) still unconsumed.
- **Tree-lane oracle:** `scaffold.ts:2586-2593` tree-job rows assert only `typeof … === "function"` and
  swallow non-`ReferenceError` throws — the emitted spec can earn `tested` from its weakest assertion.
- **Open audit items not in this wave's briefs:** L3-02 (cross-tab sync), L3-04 (run spend invisible),
  L3-05 (eager hidden-tab fetches), L3-06 (no-op ingest notice), L3-07 (corrupt-storage rescue), L3-10/11;
  A1-02 (claim wording), A1-09…A1-13; A2-F2/F4/F5/F6/F7/F8/F9; A4's process/infra items (F-15 `strictPort`,
  F-16 prettier gate, F-17 CI leg, F-18 orchestrator, F-19 coverage debt, F-20 flake class).
- Unchanged declared limits: no OS isolation; the human acceptance stamp by design; MCP owner-gated;
  failover unarmed by evidence.

## 6. Log index

`345_l1_looker.md` · `345_l2_looker.md` · `345_l3_looker.md` · `345_f1_fixer.md` · `345_f2_fixer.md` ·
`345_f3_fixer.md`.
