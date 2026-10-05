# 350 — LANE F3: file-by-file bug sweep of the un-swept modules

Branch `rt350-sweep`, base `3436866`. Windows / Node 22.
Scope: the 24 modules owned by lane F3. Only bugs provable with a red-first
keyless test were fixed.

## Files reviewed

Read end-to-end (logic + tests): `store.ts`, `packet.ts`, `algorithms.ts`,
`harvest.ts`, `io.ts`, `vault.ts`, `design.ts`, `diagram.ts`,
`report-intake.ts`, `handoff.ts`, `checkpoint.server.ts`, `watchdog.ts`,
`rt-ring.ts`, `runtime-log.server.ts`, `maker-score.ts`, `acceptance.ts`,
`doctor.ts`, `compaction.ts`, `render.ts`, `ast-mine.ts`, `swarm.ts`,
`bench.ts`, `rt-timeline.ts`, `rt-client.ts`.

All 24 owned test files pass on the base (1035 tests / 1034 pass / 1 runtime
keyless skip) before any edit.

## Real bug fixed (red-first proven)

### handoff.ts — non-array `artifacts` / `decisions` containers throw out of prompt generation

- file:line (before): `src/lib/handoff.ts:100` and `:181`
- wrong: `const priorArts = (project.artifacts ?? []).filter(...)` and
  `const phaseDecisions = (project.decisions ?? []).filter(...)`.
  `?? []` does not guard a non-array CONTAINER (a foreign object from a console
  paste / hand-edited import carrying `artifacts: 5` or `artifacts: {}`), so
  `.filter` threw a `TypeError` out of `phaseHandoff`. The module's stated
  contract (W-16 / CORE sweep) is that prompt generation never throws on a
  foreign object, and every sibling container (`schedule`, `oracle`, `brief`)
  is already guarded — `artifacts`/`decisions` were the two unguarded ones.
- right: coerce a non-array container to the honest empty list
  (`Array.isArray(x) ? x : []`), byte-identical for a valid array.
- proving test: `src/lib/handoff.test.ts`
  `"survives junk artifacts/decisions CONTAINERS (non-array), never a TypeError (F3)"`.
  Red-first verified: with the source edit stashed the new test fails
  (`not ok 20 ... name: 'TypeError'`), restored it passes.

## Candidate findings NOT fixed (not provable as bugs / no behavior defect)

- `store.ts:1516` `reconcileCrossTabProjects` returns `adopted: drifted.length`.
  The field name suggests "remote-only projects adopted", but the value is the
  drift count — which is exactly how the sole consumer
  (`store.ts:2812` → `console.tsx:7322`, "Another tab changed N builds") reads
  it. Consistent behavior; a naming smell only, so no edit.
- `harvest.ts` `harvestRepos` Phase B: when `remainingMs() <= 0` but
  `fetches < maxFetches`, the license spot-check is skipped with no note.
  Minor note gap, not a correctness defect; left alone.
- `algorithms.ts` `extractPatterns`/`collectSchemaKeys`: a single-line object
  literal (`const X = { a: 1 }`) yields no schema keys. Documented best-effort
  "pattern-level structural regex", not an AST claim; no test pins the
  single-line shape. Left alone.
- `vault.ts` `lessonNotes` iterates `project.phases` without an `Array.isArray`
  guard (other vault entry points use `rowsOf`). Exported helper takes a valid
  Project per its contract; low reachability. Logged only.
- `maker-score.ts` `stageQualitySignals` reads `(project.phases ?? [])` without
  an `Array.isArray` container guard (unlike its own logs/artifacts guards).
  Reported, not fixed (out of the current edit's proven scope).

## Commands + results

- baseline (all owned tests): `node --experimental-strip-types --test --test-reporter=tap <24 files>`
  → tests 1035, pass 1034, fail 0, skipped 1.
- touched test file: `node --experimental-strip-types --test --test-reporter=tap src/lib/handoff.test.ts`
  → tests 27, pass 27, fail 0.
- red-first (source stashed): same command → fail 1 (`TypeError`).
- `node_modules/.bin/tsc.cmd --noEmit` → exit 0.
