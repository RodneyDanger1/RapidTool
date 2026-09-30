# 316 — H5: the behavioral oracle reaches the product path (T6.3) + eval-run telemetry blind spot closed (T5.4)

Lane: H5 (behavioral oracle + eval telemetry). Repo: `C:\Users\mnril\Desktop\RapidTool Main`.
HEAD at entry: `564db1f` (V-round cured: seal provenance stored; wild-seal.test.ts 10/10; forge-refused pin).
Tree at entry: clean (`git status --short` empty). Siblings live — one writer per file.
Owns (per lane brief): `scripts/run-eval.mjs`, `scripts/run-eval.test.mjs`, the tree-run verdict path
(if H6 is absent). No keyed calls. All legs FOREGROUND.

## Scope (from `wave_plans/W43/COMPLETION-TASKS.md`)

- **T6.3** · Wire the ONE behavioral primitive into the product path: the `entry-runs`-class assertion
  (`run-eval.mjs:780-864` — expectExit/expectedStdout/expectedStderr; the only true behavioral oracle)
  is **eval-side only; never fires on emit/run**. Done-when: a green tree whose entry misbehaves can no
  longer exit 0. Brief's prescribed wire: the tree-run spawn (which already runs the entry with the
  `ENTRY_RUN_TIMEOUT_MS` 15s allowlisted env) should ALSO assert expected exit/stdout when the emitted
  spec declares them — coded outcome, honest skip when absent.
- **T5.4** · Eval-run telemetry blind spot: `run-eval.mjs` imports zero `rt-events` (grep 0) ⇒ eval runs
  write NO run telemetry; `diagnose` can never audit an eval run. Done-when: `grep -c "rt-events"
  scripts/run-eval.mjs` > 0 + run-level emissions (mirror the wildStep seed shape; bounded) + smoke.

## Verdict table (filled as work completes)

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| R1 | Eval-side machinery read: entry-runs oracle + spec shape (`expectExit`/`expectedStdout`) | PASS | Recon (prior session, watchdog-verified 5/5): `evaluateEntryRunsRow` `run-eval.mjs:811-877`; `checkExpectedBehavior` `:900-987`; row validate `:385-463`. |
| R2 | Tree-run/emit path read: where the entry is spawned with ENTRY_RUN_TIMEOUT_MS | PASS | `compile-check.server.ts:1264 treeRun` → `resolveEntry :1059-1105` → `runEntryFile :1108-1133` = load-import only; `outcome.ok` :1397; consumers CLI `emit --run :1380-1421` + `tree-run :1718-1786` exit 1 on `!ok` for free. |
| W1 | Oracle reaches product path: entry-run verdict asserts declared exit/stdout, coded outcome, honest skip | LANDING | |
| P1 | Pin: good tree passes the new verdict | PENDING | |
| P2 | Pin: entry-with-wrong-output FAILS the tree verdict (oracle bites) | PENDING | |
| T1 | rt-events import + run-level emissions in run-eval.mjs (bounded, non-throwing) | LANDING | |
| T2 | Pin: `grep -c rt-events run-eval.mjs` > 0 + telemetry smoke | PENDING | |
| G1 | Gates: typecheck / lint / scoped tests / build | PENDING | |

## Log

- Entry: HEAD `564db1f` confirmed; clean tree. W43 briefs located (T6.3 line 78, T5.4 line 69).
- Next: read `run-eval.mjs` 700–900 (oracle), the tree-run verdict seam, and the rt-events emit API.
- **Landing pass (HEAD 71154b1).** Recon confirmed as H5 left it (watchdog-verified). Settled wire, keyless:
  1. **One shared primitive, no second truth source**: new `src/lib/entry-oracle.ts` = the moved
     `evaluateEntryRunsRow` body (`runEntryOracle`), the `checkExpectedBehavior` body
     (`checkEntryContract`), and the parseGrader expectedBehavior row validation
     (`validateExpectedBehavior`) — **verbatim moves**, so run-eval.mjs keeps byte-identical
     output. `run-eval.mjs` delegates to it (its exported `checkExpectedBehavior` stays).
  2. **The product wire**: `treeRun` reads a declaration from the emitted tree's own ledger
     `.rapidtool/project.json` (top-level `expectedBehavior`, the same row shape graders use);
     when declared, it runs a REAL bounded `spawnSync` per `entry-runs` row (15s clamp,
     allowlisted env, cwd = the temp-copy subject) and the verdict gains a `behavior` factor
     that ANDs into `outcome.ok`. Absent declaration ⇒ no factor, byte-stable (nothing new in
     the outcome, nothing new in `treeVerdictHash`).
  3. **T5.4**: `run-eval.mjs` imports `rt-events.ts` + `runtime-log.server.ts` and emits a
     BOUNDED run-level telemetry set (`eval.run_start` / `eval.run_end` / crash `eval.run_error`,
     ≤3 rows) in the wildStep seed shape; catalogue additions are additive + pinned.
- Baseline claim re-checked at 71154b1: `grep -c "rt-events" scripts/run-eval.mjs` = 0 (T5.4 gap
  real); `expectedBehavior` present only in run-eval.mjs + graders (no product-path carrier
  exists — the in-tree `.rapidtool/project.json` declaration is the wire).
