# 348 · W1 — LANE 1 (CLI + diagnose wiring)

Branch `rt348-cli` (base `1395624`), worktree `…/rt_final_wt/cli`. Patch-only;
only the four OWNED files were touched (no deletes/renames/moves).

## What was broken (verified)

1. The CLI `diagnose` verb never passed `audit` to `buildDiagnosis`, so
   `DiagnosisJson.project.stages` was ALWAYS `[]` with the
   `no per-phase audit supplied` gap — even when the loaded project held the
   facts. `src/lib/diagnose.ts` already exported the pure fail-soft projector
   `projectDiagnosisStages`; only the CLI wiring was missing.
2. `src/lib/pipeline-review.ts`'s `buildPipelineReview` had no consumer.
3. Every `cli.invocation` exit row omitted the REQUIRED `capture`
   (`src/lib/rt-events.ts:110`) and carried `phase: null`.

## Changes (NEW seam → consumer)

### `src/lib/diagnose.ts`
- NEW `auditFromProject(project: unknown): DiagnosisAudit` (`:502`) — thin, pure,
  fail-soft projection of a loaded `Project` to the raw audit the projector
  consumes: `phases` (+ status/gate), `artifacts` (names attributed by `phase`),
  `tokenUsage` (project-level keyed spend). Junk input (null/non-object/array)
  → `{}`, never a throw. Coded refusal rows are NOT read here — they reach
  `projectDiagnosisStages` as `buildDiagnosis`'s `errors`, attributed by
  `row.phase`, so no fact is duplicated onto a phase.
- Export-surface header updated (`:30`).

### `scripts/rapidtool-cli.mjs`
- `diagnose` handler imports `pipeline-review.ts` lazily (`RT_REVIEW_PATH`
  `:800`, `rtReview` `:813`, import `:5375`), then from the SAME loaded project:
  `audit = rtDiag.auditFromProject(p)` (`:5442`) and
  `review = rtReview.buildPipelineReview(p)` (`:5446`, wrapped in try/catch so a
  projection failure degrades to `review: null` — the verb's "never throws"
  contract). `audit` rides `buildDiagnosis` (the `audit,` input); the review
  rides the envelope additively: `respond({ ok: true, ...diagnosis, checkpoint,
  review }, 0)` (`:5555`). No `--project` → `audit` undefined (named gap) and
  `review: null` (never a fabricated empty project).
- `cli.invocation` seed now carries `capture: "scripts/rapidtool-cli.mjs:415"`
  (`:433`, the emit site — line 415 is `cliLogEvent({`) and
  `phase: CLI_PHASE` (`:436`). NEW module var `CLI_PHASE` (`:819`), set by
  `makeLoader` from the loaded project's `currentPhase` (`:1326`, covers every
  `loadProjectFor` verb) and by the diagnose load (`:5441`); honest `null` when
  no project was loaded.

## Exact commands + observed output

```
$ node --experimental-strip-types scripts/rapidtool-cli.mjs diagnose --project ../testruns/campaign2/office-invoice-tracker/build.json
# exit 0
stagesCount 13
stagesGap "3 coded refusal row(s) carry no phase — not attributed"   # legacy rows already on disk
stage6 {"phase":6,"status":"awaiting_hitl","gate":null,"refusals":[],
        "keyed":null,"treeRun":null,"substance":null,
        "artifacts":["6-code-p6-placeholder-module-determinis","6-code-sandbox-result",
                     "6-docs-p6-architecture-trace-reqtrace","packet-6"],
        "observed":true,"unknown":["keyed","treeRun","substance"]}
reviewPresent true reviewStages 13 losses 1
keyed {"calls":8,"promptTokens":20104,"completionTokens":17495}

# newest exit row (temp RAPIDTOOL_LOG_DIR during the guard; fixture untouched):
{"...","event":"cli.invocation","message":"diagnose exit 0",
 "capture":"scripts/rapidtool-cli.mjs:415","phase":6,...}
```

```
$ node --experimental-strip-types --test --test-reporter=tap src/lib/diagnose.test.ts
1..33  # pass 33  # fail 0
```

```
$ node --test --test-reporter=tap scripts/diagnose-audit.test.mjs
1..2  # pass 2  # fail 0
```

```
$ node --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs
1..57  # pass 57  # fail 0
```

## Tests landed
- `scripts/diagnose-audit.test.mjs` (NEW, behavioral): spawns the real CLI on a
  COPY of the real fixture with `RAPIDTOOL_LOG_DIR` in a temp dir (the fixture
  is never mutated) and pins: non-empty `project.stages` with the real P6
  `awaiting_hitl` / null gate + P0 green gate, `project.keyed` from tokenUsage,
  a present `review`, and a `cli.invocation` row whose `capture` resolves to the
  REAL emit line (`cliLogEvent(` at the named line) with `phase === project.currentPhase`.
  Second leg: no `--project` → `stages: []` + named gap, `review: null`, `phase: null`.
- `src/lib/diagnose.test.ts`: added `auditFromProject` unit cases (real P6
  fixture record → real stages; junk → `{}`, fail-soft).

## Residuals (honest)
- Legacy `cli.invocation` rows already on disk keep `phase: null` and no
  `capture`; only NEW rows carry them. The per-phase `stagesGap` therefore still
  names `N coded refusal row(s) carry no phase` for the campaign-2 fixture's
  pre-fix rows — the projector refuses to attribute them to a guessed phase.
- `audit.phases` maps only the facts the persisted `PhaseRecord` carries
  (status/gate). Per-phase `keyed`/`treeRun`/`substance` stay `unknown` — the
  pipeline persists none of them per phase (347's existing contract).
- The review reaches the CLI envelope only; no other consumer was added.
