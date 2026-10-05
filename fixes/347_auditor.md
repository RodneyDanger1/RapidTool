# 347 · LANE A — auditor / logger (per-phase audit)

Branch `rt347-auditor`, base `841383d`. Worktree `rt_final_wt/auditor` only; the
concurrent session's tree was never touched.

## What changed

`diagnose.ts` gained an **additive** per-phase audit. No existing field's
meaning changed; every new field is optional or additional.

- **Types** (`src/lib/diagnose.ts:75-180`): `DiagnosisStage`,
  `DiagnosisStageGate`, `DiagnosisStageRefusal`, `DiagnosisAudit`. `DiagnosisProject`
  gains `stages?`, `keyed?`, `stagesGap?`; `DiagnosisInput` gains `audit?`.
- **Projector** (`src/lib/diagnose.ts:274`): exported pure `projectDiagnosisStages(audit, errors)`
  → `{ stages, gap }`. Fail-soft (whole body in try/catch → empty stages + named
  `gap`, never a throw). Reads:
  - `audit.phases[]` → per-phase `status`, `gate { passed, unmet, evidenceHash, checkedAt }`,
    plus `keyed` / `treeRun` / `substance` when a record carries them
    (forward-compatible; today's persisted records carry none of the three).
  - `errors[]` → coded refusals (`RT_E_*` code or park marker) attributed by
    `row.phase`.
  - `audit.artifacts[]` → artifact names attributed by `artifact.phase`.
  - Missing facts stay `null` / `[]` and are NAMED in `stage.unknown[]`.
- **Wiring** (`src/lib/diagnose.ts:531`, output at `:784`): `buildDiagnosis`
  projects the audit once into `projectOut` and returns
  `project: projectOut`; `project.keyed` carries project-level `tokenUsage`;
  `project.stagesGap` carries the fail-soft gap string verbatim.

### Per-phase facts: what EXISTs vs. what the auditor used to drop

| fact | source that exists | before 347 | after 347 |
|---|---|---|---|
| phase status | `build.json` `phases[].status` | dropped | `stage.status` |
| gate passed + unmet | `phases[].gate{passed,unmet}` | dropped | `stage.gate` |
| coded refusals | ndjson `cli.invocation` rows | only ranked as errors | `stage.refusals` **when `phase` is present** |
| keyed tokens/calls | `tokenUsage` (project-level only) | dropped | `project.keyed` (per-phase attribution impossible — see residual) |
| tree-run ok + verdictHash | `TreeRunOutcome` at emit (not persisted) | dropped | `stage.treeRun` when supplied; else unknown |
| substance verdict | `TreeRunOutcome.substance` (not persisted) | dropped | `stage.substance` when supplied; else unknown |
| artifact names | `artifacts[]` | dropped | `stage.artifacts` |

## Emitter gaps found (NOT edited — outside OWNED)

1. **`cli.invocation` rows carry `phase: null`.** Verbatim from
   `../testruns/campaign3/bakery-florist-orders/.rapidtool/logs/rapidtool.ndjson`:
   the two coded rows (`RT_E_GATE_PENDING`, `RT_E_TREE_RUN_FAILED`) both read
   `"phase":null`. Per-stage refusal attribution is therefore impossible from
   today's bytes; the projector reports the count in `stagesGap`
   ("N coded refusal row(s) carry no phase") instead of guessing. Emitter seam:
   `scripts/rapidtool-cli.mjs` (the `cli.invocation` seed sets no `phase`).
2. **`cli.invocation` rows omit `capture`** (a required `RtEvent` field). The
   same two rows have no `capture` key; `buildDiagnosis`'s `errors[].capture`
   reads `undefined` for them.
3. **Per-phase keyed usage is never emitted.** `tokenUsage` is project-level;
   no per-phase counter is persisted in `build.json` `phases[]`.
4. **Tree-run verdict + substance verdict are not persisted** on the project
   (`verdictHash` occurs 0× in `build.json`); they exist only in the in-process
   `TreeRunOutcome` / emit envelope, so a later `diagnose` cannot read them.

The CLI diagnostic verb (`scripts/rapidtool-cli.mjs:5390-5400`) also does not
yet pass `audit` — it builds `project` from only `{ref,name,status,currentPhase,wildRun}`.
Until that wiring lands (forbidden path), real `diagnose` envelopes carry
`stages: []` and a `stagesGap` naming the missing audit — honest, not fake.

## Tests (fixture is VERBATIM from the real artifacts)

`src/lib/diagnose.test.ts` — `REAL_P6_PHASE` (build.json `phases[6]`, the red P6
hard-DoD gate), `REAL_P6_ARTIFACTS`, `REAL_TOKEN_USAGE`, and `REAL_CODED_ROWS`
(rapidtool.ndjson) are byte-copied from
`../testruns/campaign3/bakery-florist-orders/{build.json,.rapidtool/logs/rapidtool.ndjson}`.

Commands + results:
- `node --experimental-strip-types --test --test-reporter=tap src/lib/diagnose.test.ts`
  → **31 tests, 31 pass, 0 fail** (6 new 347 cases + 25 pre-existing).
- `node --experimental-strip-types --test --test-reporter=tap src/lib/runtime-log.server.test.ts src/lib/rt-events.test.ts`
  → **21 tests, 21 pass, 0 fail** (unchanged modules).
- `node_modules/.bin/tsc.cmd --noEmit -p tsconfig.json` → **exit 0**.

New cases: real P6 status/gate/unmet/artifacts render; the unpersisted
per-phase facts read `unknown`; project `tokenUsage` verbatim; phase-less real
refusals are never pinned to a fake phase (gap names them); a phase-bearing row
attributes correctly; malformed/truncated audit + junk records fail soft; no
audit reads as explicit unknown.

## Residuals / blockers

- **CLI wiring not landed** (`scripts/rapidtool-cli.mjs:5390-5400` is FORBIDDEN):
  `diagnose` does not supply `audit`, so live envelopes show `stages:[]` + a
  gap. This is the single change needed outside OWNED to light the feature up.
- **Per-phase keyed + tree-run + substance require emitters** (gaps 3/4 above);
  the projector is already forward-compatible (reads `phases[].keyed/treeRun/
  substance` and `audit.treeRun/substance{phase}` the moment they exist).
- No keyed LLM calls were made; no gate was weakened; no forbidden file touched.
