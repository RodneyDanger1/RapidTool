# W2 · 348 — persist the tree-run verdict the pipeline computed

Branch `rt348-persist` · base `1395624` · worktree
`C:\Users\mnril\AppData\Local\Temp\rt_final_wt\persist`.

## Seam (read-only confirmation before editing)

- The tree-run verdict is produced by `compile-check.server.ts` `treeRun()`,
  which sets `verdictHash = treeVerdictHash(outcome)` (`compile-check.server.ts:2151`)
  and `outcome.substance = treeSubstanceOf(...)` (`compile-check.server.ts:2147`).
  The `TreeRunOutcome` carries `ok`, `verdictHash`, and `substance.verdict`
  (`TreeSubstanceVerdict = "real" | "mixed" | "stub-skeleton" | "empty"`,
  `compile-check.server.ts:533`).
- The persisted project record is written by `saveProject` →
  `exportProjectJson` (`io.ts:53` = `JSON.stringify(project)`); `hydrateProject`
  spreads `...raw` (`engine.ts:2914`), so an additive unknown top-level field
  survives the export→import round-trip. There is no field whitelist that drops
  `treeRun`/`substance`.
- The ONE headless funnel that applies a computed `TreeRunOutcome` to a project
  that is then persisted/returned is `applyTreeRunTestedMint`
  (`headless.ts:3152`, previously `headless.ts:3146`). It is called only on a
  GREEN verdict by both the `driveP6Journey` converge path (`headless.ts:3681/3735`)
  and `repairTreeDir`'s `recordGreen` (`headless.ts:4389/4401`).
- Consumers that read the missing field today: `acceptance.readMachineEvidence`
  (`acceptance.ts:140-141`, reads `record.treeRun.verdictHash` / `record.verdictHash`)
  and `pipeline-review.treeRunSummary` (`pipeline-review.ts:144-198`, reads
  caller `opts.treeRun` + a substance proxy). The real `testruns/<slug>/build.json`
  artifacts contain `verdictHash` 0 times — hence the honest-unknown readings.

## Change

`src/lib/headless.ts`

- New helper `withTreeRunVerdict(project, verdict)` (additive, cast to `Project`):
  attaches `treeRun: { ok, verdict, verdictHash? }` and, when the run produced a
  census, `substance: { verdict }`. `verdict` mirrors `outcome.ok`
  (`"pass" | "fail"`); `verdictHash` is carried only when the run minted one;
  `substance.verdict` only when a census exists. Nothing is invented — absent
  input ⇒ absent field.
- `applyTreeRunTestedMint` now mints from codegen exactly as before, then
  returns `withTreeRunVerdict(minted, verdict)` — so the converged record (and
  the emitted-dir promotion built from it) carries the verdict.

Additive and backward-compatible: a legacy/older record has no `treeRun`/
`substance`, so the auditors still read `unknown`; no existing field's meaning
changed.

## Commands + output

```
$ node --experimental-strip-types --test --test-reporter=tap src/lib/headless.test.ts src/lib/io.test.ts
# tests 249
# suites 64
# pass 249
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

RED→GREEN proof (new test `W2 · 348` in `headless.test.ts`, inside the
`fixes/144 (M4-2) — driveP6Journey` suite; drives the REAL journey seam with
injected synth/runTree/recordGate fakes and then export→import round-trips):

```
$ git stash push -- src/lib/headless.ts
$ node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="W2 . 348" src/lib/headless.test.ts
    not ok 1 - W2 · 348: a converged tree-run persists treeRun {ok, verdictHash, verdict} + substance {verdict} ...
      name: 'AssertionError'
# tests 1
# pass 0
# fail 1
$ git stash pop
```

## Residuals (honest gaps, not fabricated)

- Only GREEN tree-runs reach the seam that mints `lastTest`; a RED run records
  no tested stamp and therefore persists no `treeRun` — the auditors keep
  reading `unknown` for red journeys. Extending persistence to the red/failed
  return paths (e.g. `keepBestTree`, `repairTreeDir`'s exhausted return) is
  deliberately out of this minimal change and would need the grafted best-tree
  verdict to travel with the grafted tree to stay honest.
- `pipeline-review.treeRunSummary` only reads caller `opts.treeRun`, not
  `project.treeRun`; a caller that wants the persisted verdict still has to pass
  it. The record now carries it for such a caller (and for `acceptance`).
