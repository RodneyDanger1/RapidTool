# fixes/352 — CLI boundary + pipeline + workflow-driver defects (W352)

**Lane:** W352 (single lane, this session). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`.
**HEAD at start:** `30bce78` (working tree mid-edit: four sibling agents editing OTHER
files concurrently). **Owned files (edited):**
`scripts/rapidtool-cli.mjs`, `scripts/acceptance-run.mjs`, `scripts/README-cli.md`,
`scripts/launch-rapidtool.mjs`, `scripts/preview.mjs`, `scripts/write-atomic.mjs`,
`scripts/factory-watch.mjs`, `scripts/run-eval.mjs`,
`src/lib/headless.ts`, `src/lib/write-set.ts`,
`src/lib/headless.test.ts`, `src/lib/write-set.test.ts`,
new: `scripts/rapidtool-cli-352.test.mjs`, `scripts/fixes352-pipeline.test.mjs`, this log.
**Not touched:** `scripts/gate.sh`, `scripts/prevention/**`,
`scripts/check-module-coverage.mjs` (sibling-owned);
`src/lib/engine.ts`, `codegen.server.ts`, `scaffold.ts`, `dod.ts`, `doctor.ts`,
`acceptance.ts` (read-only; needed changes reported in §4).
`src/lib/store.ts` / `src/lib/io.ts` were read and needed **no** change (the console
already injects `livePhaseEdge` via `store.ts:1849`; `io.ts` was not implicated).

---

## 1. CLI (`scripts/rapidtool-cli.mjs`)

1. **`diagnose --project <missing>` returned `ok:true`/exit 0** while only
   `persistHealth.ok:false`. The load catch now stores `loadFailure`; before any diagnosis
   is built the arm refuses with the classified code (`RT_E_PROJECT_MISSING` for ENOENT) at
   exit 1 — the same class every other verb refuses. (~`:5695-5730`.)
2. **`resume`/`unattended` bypassed the run/gate protectors.** `respondDriveOutcome` now
   runs the in-run RUNLOCK scan (`RT_E_SRC_EDITED_DURING_RUN`), refuses a no-progress
   `steps:0` drive (`RT_E_GATE_PENDING`), and carries `outcome: res.outcome` on every
   branch (ok / GATES_FAILED / RUNLOCK). Both arms stamp `runlockStartMs` before
   `runUntilGate` and pass it in. `README-cli.md` §In-run RUNLOCK now names
   `run`/`gate`/`resume`/`unattended` (it had claimed `unattended` while only run/gate
   called `runlockEditViolations`).
3. **`acceptance-run.mjs --keyless` did not disable an ambient key.** The keyless branch
   now blanks `DEEPSEEK_API_KEY` (the documented present-but-blank disable) and deletes
   `RAPIDTOOL_LLM_ENV_FILE`, and the envelope carries `keylessEnforced`.
4. **`acceptance-run.mjs` fed corpus YAML front-matter to the lattice.** Added
   `briefFromFrontmatter` + unwrap in `readBriefSpec` (exported), mirroring the CLI's
   `create --brief` unwrap; the payload reports `brief.frontmatterUnwrapped`.
5. **`--token-ledger=` silently disabled the campaign cap.** The pre-dispatch valueless
   guard now also catches the empty-value spelling (`args[key] === ""`) and refuses
   `RT_E_VALIDATION` ("--token-ledger needs a value"), matching the bare-flag refusal.
6. **`emit --red-tree banner --git` without `--run` committed a RED-bannered tree.** The
   substance/red-trail hold's red-trail arm no longer requires `flag(args,"run")` — the
   trail is readable without a run, so an uncleared red trail withholds the commit
   (`RT_E_SUBSTANCE_EMPTY`). Fixed a null deref this exposed (`runVerdict.substance`
   guarded when no `--run`).
7. **`git.verification.committed` was hardcoded `true`** even on `noop:true`. The record
   now takes `committed`/`noop` from the real `landEmittedTree` result and returns
   `committed: committed === true`, `noop: noop === true`.
8. **`scan` findings carried `RT_E_UNKNOWN`.** The findings envelope now sets
   `code: "RT_E_CHECK_FAILED"` explicitly (the check family's any-fail class) instead of
   relying on prose classification. README `scan` section updated.
9. **Bare `saveProject` on approve/reject/retry/ingest/wild/deepen exited 4 on a busy save.**
   Added `saveProjectBusyOrRefuse` (wraps `headless.saveProjectBusyAware`) and routed all
   six verbs through it → busy is the documented `RT_E_BUSY` at exit 1; the ingest
   rejection-trail save uses the same helper.
10. **Ten `--dir`/flag honesty gaps:** `ingest --report @missing` now `RT_E_VALIDATION`
    (was `RT_E_PROJECT_MISSING`); `tree-run`/`check` on a missing/non-directory `--dir`
    refuse `RT_E_VALIDATION` (were synthetic `RT_E_TREE_RUN_FAILED`/`RT_E_CHECK_FAILED`);
    `wild --steps 0` refused (positive bound, doc says clamps 1–48); `emit
    --require-verified` without `--run` refused (`RT_E_VALIDATION`) instead of a silent
    no-op; **unknown flags are refused** pre-dispatch via a `KNOWN_FLAGS` registry
    (rebuilt from every `--flag` the CLI references) → `RT_E_VALIDATION`.

## 2. Pipeline scripts

11. `launch-rapidtool.mjs` — `stopWin` no longer `taskkill /T`s the pidfile pid blindly:
    it corroborates the pid's command line (`looksLikeLaunchProcess`, via
    `winProcessCommandLine` = wmic → PowerShell CIM) exactly as `preview.mjs` does from
    `/proc`. A stale/reused pid is ignored; port owners are still reaped.
12. `launch-rapidtool.mjs` — `winPortPids` now returns `{ok,pids,error}`; a failed
    `netstat` (non-zero / spawn error) is `ok:false` and `stopWin` refuses to claim the
    port free.
13. `preview.mjs` — `resolvePreviewPort(process.env.PORT, 8081)` mirrors
    `vite.config.ts`'s `resolvePort`; the stop/ready checks now scan the port the server
    actually bound.
14. `write-atomic.mjs` — `handOver` records the exact missing ancestors it creates and,
    on a failed rename, removes them deepest-first (non-recursive `rmdir`), so a failed
    hand-over leaves no created parent dirs.
15. `factory-watch.mjs` / `run-eval.mjs` — added `sweepStaleStateTemps` /
    `sweepStaleJsonTemps`: pid-named temp files whose owner pid is dead are reclaimed
    (a live writer's temp is never touched); called before each atomic write.
16. `run-eval.mjs` — the crash tombstone re-derives `evalOutRefusal(OUT_DIR,
    {explicit: OUT_EXPLICIT})`; a refused (tracked) out-dir is never rewritten from the
    crash path.

## 3. Drivers

17. `headless.ts` — `EmitProjectOptions.underProduced: "refuse" | "banner"`. The default
    keeps the pre-write `RT_E_PLAN_UNDERPRODUCED` guard; `banner` passes
    `allowUnderProduced` to `scaffoldProject`, prepends `underProducedBanner` to the
    emitted README, and stamps `underProduced { code, detail }` on the result. The CLI
    threads `underProduced:"banner"` when `--red-tree banner`, and its post-write floor
    seal still sets `ok:false` + `RT_E_PLAN_UNDERPRODUCED` and withholds the commit.
18. `write-set.ts` — `applyWrite` stages (temp + same-fs rename) and `applyWrites` batches
    under a reclaimable `.rapidtool-writeset.lock` (dead-pid lock reclaimed, live lock →
    `RT_E_BUSY`, removed on success/rollback). `headless.emitProject` uses `applyWrites`
    for the file set and excludes the lock from leftover/foreign detection.
19. `headless.ts` — `landEmittedTree` re-runs `treeRun` over the dir immediately before
    landing; a non-green re-verification refuses with `RT_E_TREE_RUN_FAILED` and issues no
    commit (no `.git` is created).
20. `headless.ts` — `wildStartHeadless` / `wildStartRun` gained `livePhaseEdge`, resolved
    by `livePhaseEdgeForWildStep` (injected seam wins in any key state; keyed default =
    `runPhase(p, phase, { live: true })`; keyless = nothing/floor) and threaded into every
    `wildStep`. Keyed CLI wild runs no longer execute floor artifacts for non-P6/P7 phases.

## 4. Needed changes in files this lane does not own (reported, not made)

- `src/lib/git.server.ts` `GitLandFailure` has no `tree-run-red` variant. W352 R-19
  returns that shape from `headless.landEmittedTree` via a narrow cast (the CLI consumes
  `reason`/`code`/`error`). A follow-up should add the union member to keep the type
  honest.
- `src/lib/scaffold.ts` needed no change: its existing `allowUnderProduced` option is the
  seam R-17 consumes.
- **`AGENTS.md` claim drift (not owned, needs the owner):** the 346-wave "Corrections in
  force" still says *"Residual: `emit --git` WITHOUT `--run` still commits — it has no
  verdict to consult (by design)."* R-19 removes exactly that residual. The binding
  contract should be corrected to say bare `emit --git` re-verifies and withholds on a
  non-green tree.

## 4b. Existing contract tests updated for the new behavior

R-19 changes a previously-pinned behavior ("`emit --git` alone lands the commit because
it has no verdict to consult"), so the three tests that pinned it were updated in
`scripts/cli-exit-taxonomy.test.mjs`:

- "346 P0-3 + W352 R-19": the bare-`--git` leg on the red fixture now asserts exit 1,
  `ok:false`, `git.committed:false` / `reason:"tree-run-red"`, and no `.git` on disk.
- "346 L4 + W352 R-19": the same bare-`--git` leg likewise.
- "W61 B1": its stale precondition (`treeRun.ok === false` for the empty-substance
  fixture; the fixture's run leg is now GREEN) was replaced by the invariant that matters
  — the substance branch decides `git.code`, so `RT_E_SUBSTANCE_EMPTY` wins regardless of
  the run verdict. (This precondition drift pre-dates R-19: the substance/withhold branch
  runs before `landEmittedTree`, so R-19 never touches that path.)
- `scripts/rapidtool-cli.mjs`'s land-failure `git` block now reports
  `committed:false` / `skipped:true` (it carried neither), so a refused delivery is
  shape-consistent with every withheld leg.

## 5. Verification (raw results, this box, Node v24.15.0)

```
npx tsc --noEmit                                   -> exit 0
npx tsc -p tsconfig.scripts.json --noEmit          -> exit 0
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor -> exit 0
```

`node --test --test-reporter=tap` (script tests this lane touched/created):

```
scripts/rapidtool-cli-352.test.mjs   # tests 16  pass 16  fail 0
scripts/fixes352-pipeline.test.mjs   # tests  7  pass  7  fail 0
scripts/launch-rapidtool.test.mjs    \  combined run: # tests 61 pass 61 fail 0
scripts/preview.test.mjs             /
scripts/write-atomic.test.mjs        /
scripts/acceptance-run.test.mjs      # tests  9  pass  9  fail 0
scripts/factory-watch.test.mjs       # tests 21  pass 21  fail 0
scripts/run-eval.test.mjs            # tests 58  pass 58  fail 0
scripts/cli-exit-taxonomy.test.mjs   # tests 59  pass 59  fail 0  (the full CLI contract,
                                     #  incl. the 3 emit-git legs updated in §4b)
```

Driver suites:

```
node --experimental-strip-types --test --test-reporter=tap src/lib/write-set.test.ts
  -> # tests 12  pass 12  fail 0
node --experimental-strip-types --test --test-reporter=tap src/lib/headless.test.ts
  -> # tests 197 pass 197 fail 0
```

Keyless below-floor reproduction (scratch project with a real `generatedSource` + a
final `p6.synthesis.refused` `RT_E_PLAN_UNDERPRODUCED` row):

```
node --experimental-strip-types scripts/rapidtool-cli.mjs emit \
  --project <scratch>/build.json --out <scratch>/emitted --red-tree banner
-> exit 1, ok:false, code RT_E_PLAN_UNDERPRODUCED, count 16,
   underProducedBanner:true, underProduced:{code:"RT_E_PLAN_UNDERPRODUCED",detail:...},
   planUnderproduced:{floor:1,emitted:0,modules:0,missing:[src/jobs/record.ts]}
   emitted/README.md begins with "> [!CAUTION]" + "## BELOW-FLOOR PLAN".
```

## 6. Unverified / residual

- The RUNLOCK refusal and the busy-save refusal are pinned by **static** seam tests plus
  the behavioral `outcome` carry (a live mid-run repo edit / a second live writer cannot be
  provoked cheaply in-suite). The run/gate arm's own behavioral RUNLOCK test already
  exists and is unchanged.
- `git.verification.committed` on a real no-op is source-pinned; the re-verify path
  (R-19) is behavioral (a corrupted emitted file refuses with no `.git`).
- `sweepStaleJsonTemps`/`sweepStaleStateTemps` reclaim only dead-pid temps (unit-tested);
  a temp from a pid that was later reused by an unrelated live process is deliberately
  left alone.
