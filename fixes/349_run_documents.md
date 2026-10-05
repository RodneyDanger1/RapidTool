# 349 — Run documents: every run now emits real, visible, plain-English documents (Lane 1)

**Date:** 2026-10-05 · **Branch:** `rt349-docs` · **Base:** `e06595d`

## What changed

Real run dirs carried `brief.md`, `build.json` and the emitted tree, but the per-phase
`Artifact`s lived only inside `build.json` and no plain-English report existed. This lane adds
two pure modules and wires them into the run's own persistence path.

### NEW `src/lib/run-report.ts`
- `renderRunReport(project, opts?)` → plain-English markdown for the whole run
  (`renderRunReport` at `run-report.ts:112`). Per phase P0–P12: phase number/name, status,
  recorded DoD gate (passed + evidence hash, or FAILED with the unmet criteria in the
  criteria's own words via `dod.DOD`), any coded `RT_E_*` refusal with the log's own
  "what went wrong" detail, artifact titles, and keyed spend. A header carries the run-level
  keyed spend and identity fields.
- It reuses the ONE stage derivation (`pipeline-review.buildPipelineReview`, which itself uses
  `maker-score.stageQualitySignals` and `phases.phaseDef`) — it cannot drift from the pipeline
  rail's view. Pure: no clock, no LLM, no I/O; same record ⇒ byte-identical output.
- Honest by construction: any absent fact reads **"not recorded"**; nothing is invented.
- `reportedStageIds(project)` (`run-report.ts:198`) exposes the covered stage set for tests.

### NEW `src/lib/artifacts.ts`
- `materializeArtifacts(project)` → `{ path, body }[]`, one markdown document per phase artifact
  at `artifacts/P<phase>-<id>.md` (`artifacts.ts:46`). Each document is a plain-English title
  header (title, phase name/number, kind, language) followed by the artifact's **own body,
  verbatim**. Empty/absent bodies are annotated honestly (`> No body was recorded…`), never
  padded with invented prose. Paths are sanitized and de-duplicated; the module is pure.

### WIRED `src/lib/headless.ts`
- Imports the two pure modules (`headless.ts:125-126`).
- `runHasDocuments(project)` (`headless.ts:136`): true only for a record an actual run produced
  (a started/completed/awaiting phase or ≥1 artifact) — a fresh `createProject` is not one.
- `writeRunDocuments(runDir, project)` (`headless.ts:164`): writes `<runDir>/RUN_REPORT.md` and
  `<runDir>/artifacts/*.md`. Fail-soft: it never throws and returns `{ok:false, reason}` on any
  failure. Refuses to clobber an unrelated file: a non-directory at `RUN_REPORT.md` or
  `artifacts/` is refused, not overwritten.
- `saveProject` (`headless.ts:336`) now takes optional `{ documents?: boolean }` and, for a
  started run (default `runHasDocuments`), writes the documents beside the persisted project.
  A document-write failure appends a `run.documents.failed` warn row to the persisted record
  (reason recorded — never pretended). Additive + fail-soft: a fresh/unstarted save stays
  byte-identical on disk; the project bytes are otherwise untouched.

### Tests
- NEW `src/lib/run-report.test.ts` (8 tests): names every phase P0–P12; honest "not recorded";
  passed gate; failed gate in the criteria's words; coded refusal + what went wrong; artifact
  titles; per-phase spend (supplied + absent); purity/determinism.
- NEW `src/lib/artifacts.test.ts` (5 tests): one doc per artifact, path shape, title + verbatim
  body, honest empty-body annotation, collision de-dup, sanitization + determinism.
- `src/lib/headless.test.ts` (`describe` at `headless.test.ts:5599`, 4 tests): wiring writes
  report + artifacts; `saveProject` documents a started run and never a fresh one; fail-soft
  refusal preserves an unrelated file; a REAL persisted fixture round-trips.

## Verification (real output)

### Typecheck
```
> node_modules\.bin\tsc.cmd --noEmit
TSC_EXIT:0
```

### Tests — exact command from the brief
```
> node --experimental-strip-types --test --test-reporter=tap src/lib/run-report.test.ts src/lib/artifacts.test.ts src/lib/headless.test.ts
1..54
# tests 204
# suites 57
# pass 204
# fail 0
# skipped 0
TESTS_EXIT:0
```
The 4 new Lane 1 subtests all pass, including the REAL-fixture one (not skipped):
```
ok 52 - Lane 1 (349) — run documents
  ok 1 - writeRunDocuments writes RUN_REPORT.md naming all phases plus one artifacts/*.md per artifact
  ok 2 - saveProject writes the run documents for a started run, and never for a fresh project
  ok 3 - writeRunDocuments is fail-soft: it refuses to clobber an unrelated file and never throws
  ok 4 - REAL fixture: office-scheduler/build.json round-trips to RUN_REPORT.md + artifacts/*.md
```

### REAL end-to-end write against the persisted fixture
Ran `loadProject('../testruns/campaign2/office-invoice-tracker/build.json')` then
`writeRunDocuments(dir, project)` into a fresh temp dir:
```
ok=true
runDir=C:\Users\mnril\AppData\Local\Temp\rt349-e2e-UX74K5
artifacts=23
artifacts/P0-0-scorecard-feasibility-architecture-scoreca.md
artifacts/P0-0-algorithm-intent-lattice-a1.md
artifacts/P0-research-0-0-1791192704152.md
artifacts/P0-research-0-1-1791192704152.md
artifacts/P0-research-0-2-1791192704152.md
artifacts/P0-research-0-3-1791192704152.md
artifacts/P0-research-0-4-1791192704152.md
artifacts/P0-narrative-0-1791192704152.md
artifacts/P0-gate-p0-32696329.md
artifacts/P1-1-graph-execution-topology-this-build.md
namesAllPhases=true
artifactsOnDisk=23
```
The generated report's P6 section (real refusals + honest spend):
```
### P6 — Code Generation, Testing & Deployment

- **Status:** awaiting_hitl
- **DoD gate:** not recorded (this phase carries no persisted DoD gate)
- **Coded refusals (5):**
  - RT_E_PLAN_UNDERPRODUCED, RT_E_VALIDATION — RT_E_PLAN_UNDERPRODUCED · chunk 1/8 refused · accepted tree has 0 module(s) but the brief demands >= 8 — the plan is under-produced; missing module(s): src/jobs/…
  - RT_E_LLM_REJECTED — src/generated/compute-outstanding.ts · RT_E_LLM_REJECTED · parseSynthesisEnvelope: the reply was received but could not be read …
  …
- **Artifacts (4):** P6 placeholder module (deterministic template); Sandbox result; P6 architecture trace (reqTrace); Agent packet (A4)
- **Keyed spend:** not recorded per phase (run total: 8 call(s), 20104 prompt token(s), 17495 completion token(s))
```

### Lint (touched files)
```
> node_modules\.bin\eslint src/lib/run-report.ts src/lib/run-report.test.ts src/lib/artifacts.ts src/lib/artifacts.test.ts src/lib/headless.ts src/lib/headless.test.ts
LINT_EXIT:0
```

## Residuals / honest limits

- **Per-phase keyed spend is not on the persisted record** — only the run-level `tokenUsage`
  slice is. The report therefore prints the run total in the header and each phase reads
  "not recorded per phase"; `renderRunReport` accepts a caller-supplied `spendByPhase` when a
  future driver measures it. No per-phase number is invented.
- **`materializeArtifacts` skips malformed rows** (a non-object artifact entry is ignored), so
  the document count equals the count of usable artifacts; the report's artifact tallies come
  from the same record.
- The write is triggered from `saveProject`; the CLI's run/gate arms call it, so a completed run
  writes the documents. A caller that wants a byte-identical directory can pass
  `{ documents:false }` (no production caller does today).
