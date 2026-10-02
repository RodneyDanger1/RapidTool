# 332 wave (W46) — parent / boundary log

**Boundary owner:** parent. **Opened** 2026-10-02 at HEAD `6cd5123`, tree clean. **Six lanes + one
follow-up**, all landed. Contract and briefs: `wave_plans/W46/README.md`. Register append:
`AW46-c01…c09`.

## 1. Boundary gates (after every writer stopped)

| Gate | Command | Result |
|---|---|---|
| typecheck | `npm run typecheck` | **exit 0** (now covers `src`+`server` strictly **and** the `scripts/**` ratchet) |
| lint | `npm run lint` | **exit 0**, 0 warnings |
| assertions | `scripts/check-assertion-gaps.mjs` | **exit 0** |
| tests | `npm test` | **scripts 398 / lib 2734 / 0 fail / 2 skipped**, exit 0 |
| build | `npm run build` | **exit 0** |
| gate of record | `bash scripts/gate.sh` | **`ok:true`, exit 0**, `flakes: []`, `hardFails: []` |

Baseline at wave open: 394 scripts + 2672 lib (+ 10 skipped in the combined run) — **+66 tests, all
green**. The `scripts` leg grew because the wave added 6 tests to `cli-exit-taxonomy.test.mjs`, 2 to
`typecheck-scripts.test.mjs`, 6 to `check-module-coverage.test.mjs`, and the lib leg from the six
lanes' suites.

## 2. What landed

**The last mile to a verified product (the wave's headline).** The keyed run's single remaining spec
failure was generated code reading a property off a non-awaited async sibling call, so the rejection
floated past the test and reddened the whole spec file — and `p6-test`/`p6-verified` can only mint from
a **green tree-run**. That shape is now a deterministic `RT_E_VALIDATION` refusal in
`validateSynthesisModule` across four value-position forms, advertised in both prompts, and routed into
the existing **one bounded repair re-prompt** on the single-module and chunked paths (`codegen.server.test.ts`
148 → 161). Legal `await` and `.then/.catch/.finally` chains are accepted; the lexical limit (a sibling
returning a Promise without `async` is undetectable) is recorded.

**Coverage legibility.** The plan census now partitions by job label and reconciles against `p6-arch`,
so a declared job that no signature binds is named in one persisted `p6.tree.shortfall` row instead of
being dropped silently. Both recorded run shapes are pinned against their real bytes; the census counts
job labels while `archTrace` demands typeSignature names, so no false equality is claimed.

**Spend truth.** `Project.tokenUsage` was never written, so `summary.budget.spent` reported one
invocation (`446` → `0` → `77654` across three `gate` calls) and `doctor` read `calls: 0`.
`headless.runUntilGate` now folds each invocation's delta into the record; `doctor --project` reports
the run (verified: 77654 tokens / 12 calls). The persisted spend never feeds the cap (pinned).

**Emitted-tree honesty.** A clean GAME tree no longer reds the tree-run: `resolveHeadlessEntry` was
resolving the browser boot `src/main.ts`, which bare node cannot load; it now falls through to the
generated core when a root `index.html` marks the tree a UI shell (`ok false → true`,
`core src/main.ts/fail → src/jobs/dispatch.ts/pass`), and a corrupted core still reds. The tree-run's
unverified state is now machine-readable (`TreeRunOutcome.verified` / `.unverified`, folded into the
verdict hash), so a declared-but-unrun `typecheck`/`build` can no longer be read as a pass. The last
three silent cleanup swallows in `verifyKindDir` are gone, replaced by a leak note on every verdict.

**CLI + toolchain.** `tsc -p tsconfig.scripts.json`: 173 errors / 16 files → **134 / 14**, with
`rapidtool-cli.mjs` and its taxonomy test at **0** and inside a per-file ratchet that fails on any new
error. `create --brief <path>` now refuses a bare file path (`RT_E_VALIDATION`, naming both forms) and
`--brief @file` reads the brief, unwrapping the corpus front-matter. A central guard refuses 19 value
flags parsed valueless. Empty catches: 0 truly empty (audited).

**Console honesty.** The chip reflected key **presence**, so a rejected key still read "configured".
It now renders the last keyed outcome class (narrowed to the key-failure set), from the live provider
tap, the persisted chat thread, and the console's own crew result, returning to `configured` after a
real success — with the key source shown tail-only. Proved in a browser on desktop and mobile. The
T5.2-A fixtures honesty surface (`fixtures.review.ts` + `fixtures.server.ts`) now has a real test, and
its two coverage-allowlist entries were **removed** so a regression fails the guard.

**Runtime telemetry.** `R12-f05`'s residual is fixed: the stale-run row was emitted every ~11 s while
the coalescer windows on 5 s, so writes never merged — measured 3 rows before, **1** after, via an
edge-triggered emit (`RT_COALESCE_MS` untouched). `R12-f04`, `R12-f06`, `R12-f07` and `R11-f02` were
verified **already resolved** on disk; the register text was stale and is corrected (`AW46-c01`).

## 3. Boundary-owner changes (files no lane owned)

1. **`package.json`** — `typecheck` now runs `tsc --noEmit` (strict, src+server) **and** the
   `scripts/**` ratchet test; the budget-blind program stays available as `typecheck:scripts:strict`.
   Lane 332-4's literal two-`tsc` wiring left `npm run typecheck` (and therefore `gate.sh`, which runs
   it) red on the 134 reviewed errors; this keeps the gate honest and green while still failing on any
   **new** error. `scripts/typecheck-scripts.test.mjs`'s own pin was updated to the new shape.
2. **`src/lib/types.ts`** — `tokenUsage` widened from a 2-key literal to the writer's own `SpendSlice`
   (332-2's request), so the type stops under-describing what `accumulateSpend` stores.
3. **`scripts/rapidtool-cli.mjs`** — the `doctor` arm now passes `projectPath`, so `doctor --project`
   reports the project's persisted run spend (332-2's request; verified).
4. **`scripts/check-module-coverage.mjs`** — removed the two now-dead `fixtures*` allowlist entries
   (332-5's request). The guard cannot detect a stale entry, so leaving them would have let a future
   regression silently fall back to a recorded exemption.
5. **`START-HERE.md`** — appended a dated CORRECTION superseding the "account unfunded / keyed calls
   402" claims and hard rule 3 (the 331 wave's finding).
6. **`README.md`** — corrected the same false limit in the human quickstart.
7. **`research/multiagent/thoroughanalysis.md`** — `AW46-c01…c09` (the stale-row corrections plus the
   wave's new findings).

## 4. Owed / reported, not fixed (honest)

1. **`TreeRunOutcome.verified` has no consumer flip.** A fresh emitted tree now carries
   `verified:false, unverified:["typecheck","build"]`, but no consumer refuses on it yet — the CLI exit
   code, the DoD mint, and the README banner are outside lane 332-3's files. Measured constraint:
   flipping `outcome.ok` inside `treeRun` alone would red every fresh tree and block the P6 mint
   (the P6 journey emits to a temp dir with no `node_modules`, so `tsc` is always a skip). A single
   `npm install` in that leg measured **46,964 ms**, so the install-on-demand route is a product
   decision, not a mechanical fix.
2. **134 type errors remain budgeted in `scripts/**`** across 14 files (`run-eval.test.mjs` 64,
   `run-eval.mjs` 25, others single digits). The ratchet fails on any new error; retiring the debt is
   the untyped-`.mjs` migration.
3. **`run` / `runUntilHitlAsync` still expose no `code`**, so a P6-synthesis 401 cannot move the
   console's status chip (needs the `RunResult`/store shape).
4. **The async guard is lexical.** A sibling chunk that returns a Promise without being declared
   `async` is not detectable, and the pre-existing already-materialized trees are not retroactively
   repaired — the refusal prevents future emission.
5. **`R11-f01` (the dev server binds `0.0.0.0` with no auth middleware) remains open** and is a product
   decision: the host/port binding is a documented fixed contract, so changing it needs the owner.
6. **`npm run eval` still not run** — it rewrites tracked `research/eval-out/**`. The keyed scorecard
   and the `{0,0,3}` trial evidence remain un-refreshed.
7. **The stale User-scope `DEEPSEEK_API_KEY`** is still set on the machine; the repo wins over it and
   says so by tail. Clearing it is the owner's call.
8. **No consumer of the persisted spend in `packet.ts`** — its disk envelope still carries the process
   snapshot under its own `PACKET_BUDGET_SCOPE` label (honest by that label).
