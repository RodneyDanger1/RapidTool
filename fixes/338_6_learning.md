# 338-6 · Learning — the "continuously improves" claim + the `tested` spine

**Lane:** 338-6 (Learning). **Opened:** 2026-10-02. **HEAD at open:** `e7da20e`, tree clean.
**Owned (STRICT):** `src/lib/verify.server.ts`, `verify.ts`, `entry-oracle.ts`, `harvest.ts`,
`knowledge.ts` + their tests. **Boundary:** `codegen.server.ts` (338-1), `dod.ts` (338-3),
`compile-check.server.ts` (338-2). **Scratch:** `%TEMP%\rt338_6\`.

## Step 0 — claimed / on disk / still open

**Claimed (the mission's two claims):**
1. The factory "continuously improves": lessons are harvested from failures, ranked, seeded into
   later runs, and measurably affect P6's expansion. No wave has shown the loop changes an outcome.
2. `label:"tested"` (and the `evidenceHash` the DoD's `p6-verified` reads) come from
   `verify.server.ts` + `entry-oracle.ts`, so the verification spine must not mint a false `tested`.

**On disk (verified today, file:line):**
- Lesson ranking/seeding primitives are real: `knowledge.ts:91` `rankBriefLessons`, `:129`
  `lessonLinesForBrief`, `:1056` `selectLessons`.
- The ACTUAL P6 expansion sites consume `project.memory` lessons and pass them to `expand`:
  `codegen.server.ts:3752` (spec expand), `:3843` (single module), `:4209` (each tree chunk).
- The harvest half is wired on the automated driver: `verify.server.ts:1090` `gatedFailureMint`
  mints the anchored L3 row; `verify.ts:160-300` `applyVerifyOutcome` persists `outcome.lesson`
  into `project.memory`; `headless.ts:1217` mints the L2 template-emission row from a
  `p6.synthesis.refused` log inside `runUntilGate` (`headless.ts:1093`, called by the CLI
  `run`/`gate`/`resume` verbs).
- The `tested` stamp: `verify.server.ts:1201` mints `passed` only after `runCases` returns
  `pass:true` (`:640-650`), and `runCases` refuses zero cases (`:521`), no callables (`:614`), no
  export reference (`:640`), and forged/duplicate `ORACLE_RESULT` lines (`:569-608`).
- `entry-oracle.ts`'s vacuously-true `complete` was fixed by 337-3 (`:389`); `pending` is
  structurally 0.

**Still open (file:line):**
- `codegen.server.ts:3586-3615` — `upgraded()` (the automated single-module P6 PASS) builds `memory`
  WITHOUT `outcome.lesson`: the L4 `verified-procedure` row `verify.server.ts:1217` mints is dropped
  by the factory's own loop. Only the manual `verify --apply` (`rapidtool-cli.mjs:3166`) and the
  Oracle tab (`store.ts:1141`) persist it. `codegen.server.ts:3368` `refuse()` likewise drops
  `outcome.lesson` (L3) — but that failure class IS harvested as the headless L2 row.
- `knowledge.ts:1400` `driftLesson` — no production caller (already struck/registered by 331-2).
- `harvest.ts:718`/`:765` `harvestEvidenceLesson`/`harvestResultLesson` — no production caller
  (already declared-or-struck by 330-4).
- `codegen.server.ts:3497`/`:3586` — the evidence-hash twins still hash `finalSource+evidence`
  only; `verify.ts` now also commits the oracle case set (this lane). One formula needs both files.

## Gap 1 verdict — the learning loop is REAL and LOAD-BEARING (proven)

Deterministic probe (`%TEMP%\rt338_6\learning_loop_probe.ts`, no network, 0 keyed calls):
a REAL `runCases` failure → its failing case id anchors a REAL `failureLessonFromRecord` L3 row →
`applyVerifyOutcome` persists it to `project.memory` → the ACTUAL expansion site
(`codegen.server.ts liveP6Synthesis`) passes the lesson line into `expand`'s `lessons` argument.

```
RUN.pass = false | failingIds = ["kanban-column-order"]
LESSON.refused = false | id = lesson-verify-failure-be692c97
MEMORY lesson rows = [ "lesson-verify-failure-be692c97" ]
EXPAND(called) no-lesson = true | lessons = null
EXPAND(called) lesson    = true | lessons = ["[episodic 0.235] L3 verify-failure: ... kanban-column-order: false; evidenceHash=433b6b00."]
CHANGED = true | lesson-line-present = true
```

**Boundary named honestly:** this settles the loop up to the MODEL boundary. The harvested lesson
demonstrably changes the expansion INPUT bytes; whether the model then emits a better spec is not
deterministically testable without a keyed A/B, which this lane did not run (0 keyed calls). It is
no longer "unshown" that the loop changes an outcome input — it was unshown before this wave.

**Decorative links (named, not wired — unowned files):**
1. L4 `verified-procedure` rows are dropped by the automated P6 synthesis (`codegen.server.ts:3586`).
2. `driftLesson` / the harvest lesson builders have no production caller (prior lanes, re-confirmed).

## Gap 2 — verification-spine invariants (probes)

`%TEMP%\rt338_6\spine_invariants_probe.ts` (deterministic):

| Invariant | Probe result |
|---|---|
| forged verdict cannot pass | module printing `ORACLE_RESULT c1 pass` → `pass=false` ✓ |
| zero cases never pass | `runCases(src, [])` → `pass=false` ✓ |
| `entry-oracle` zero rows not complete | `{declared:0, ok:true, complete:false}` ✓ |
| **oracle rows not vacuously satisfied** | `uiShell:true` + `expectExit/expectStdout/args/mode` was ACCEPTED and silently ignored → **FIXED** |
| **evidence hash covers every verdict input** | same source+evidence, DIFFERENT case set → SAME hash → 2nd verification silently deduped → **FIXED in `verify.ts`; codegen twin reported** |
| replay is a dedupe (not a second mint) | exact replay → same reference ✓ |

### Fix 1 — `entry-oracle.ts`: a declaration is never silently dropped (RED → GREEN)
`validateExpectedBehavior` accepted fields its check never evaluates (a `uiShell` row's declared
`expectExit`/`expectStdout`/`args`/`mode`/`timeoutMs`, or a runtime field on
`file-exists`/`package-target-exists`), so the row read green (or "skip") without the thing it
declared — the same "a verifier that cannot fail" class as 337-3's vacuous `complete`, one layer
down. Now each check declares exactly the field set it evaluates; an out-of-scope field is refused.

- **RED:** `entry-oracle.test.ts` `# tests 12 / pass 10 / fail 2`.
- **GREEN:** `entry-oracle.test.ts` **9 → 12 / 12 / 0** on both runtimes.

### Fix 2 — `verify.ts`: the case set is part of the verdict commitment (RED → GREEN)
`evidenceHash` was `fnv1a(finalSource \u0002 evidence)`. 337-3 separated the two fields; the ORACLE
CASE SET — the other `runCases()` input — was not committed, so two outcomes with the same
source+evidence but a different case set minted ONE hash and the second genuine verification was
dropped as a "duplicate". The hash now also commits the `[id, expression]` pairs.
**KNOWN LIMIT (reported, unowned):** the `codegen.server.ts` twins (`:3497`, `:3586`) still hash
source+evidence; aligning them needs `codegen.server.ts` (338-1).

- **RED:** `verify.test.ts` `# tests 28 / pass 27 / fail 1`.
- **GREEN:** `verify.test.ts` **27 → 28 / 28 / 0** on both runtimes.

### Tests added (permanent, both runtimes)
- `entry-oracle.test.ts`: +3 (the vacuity-class block).
- `verify.test.ts`: +1 (case-set commitment).
- `verify.server.test.ts`: +3 forge pins + 1 learning-loop integration pin (imports
  `codegen.server.ts liveP6Synthesis`, injects every model seam, fetch tripwire proves no network).

## Mock/fake census (owned files)
No `TODO`/`FIXME`/`as any`/`@ts-ignore`/`@ts-expect-error`/silent `catch {}`/`assert.ok(true)`/
`.only(`/unconditional `.skip` in any owned file (scripted search). The only "placeholder" hits are
prose in the anti-vacuity comments/strings of `verify.server.ts` and its test. The `skip: !available`
guards (25) are runner-conditional and the runner IS available.

## Keyed usage
**0 / 2.** The loop was settled with a deterministic probe, so no keyed call was needed; `npm run
eval` was never run.

## STOP-and-REPORT (unowned)
1. `codegen.server.ts:3586-3615` `upgraded()` must fold `outcome.lesson` (L4) into `memory`
   (idempotent by row id) — `upgraded` receives the outcome but ignores `.lesson`.
2. `codegen.server.ts:3497`/`:3586` evidence-hash twins must adopt
   `fnv1a(finalSource \u0002 evidence \u0002 JSON.stringify(cases.map(c=>[id,expression])))` to keep
   ONE verdict-stamp formula with `verify.ts:176`.

## Verification (real command output)

Owned suites, pinned Node **22.23.2** and host Node **24.15.0** — identical:

```
verify.test.ts         27 -> 28 tests  28/28/0
verify.server.test.ts  42 -> 46 tests  46/46/0
entry-oracle.test.ts    9 -> 12 tests  12/12/0
harvest.test.ts        45 tests       44 pass / 0 fail / 1 skip  (unchanged)
knowledge.test.ts      51 tests       51/51/0                   (unchanged)
```

Consumer regressions: `compile-check.server.test.ts` 81 tests / 0 fail;
`scripts/run-eval.test.mjs` 51/51/0. Targeted `eslint` on every edited file: 0 warnings.
Filtered `tsc --noEmit` over the tree reports **0 errors in any file this lane touched** (the full
project typecheck is a boundary-gate step; siblings are mid-edit, so it was not run as a gate).

**Observed, NOT this lane:** running `headless.test.ts` + `lesson-writers.test.ts` +
`store.test.ts` (Node 22) → `# tests 262 / pass 261 / fail 1`:
`not ok 4 - emit --run: treeRun{compile,tests,run} ... a green tree exits 0 (fixes/147 E-15)`
(`headless.test.ts:2035`, exit 1 ≠ 0). That subtest exercises `emit --run` → `compile-check.server.ts`
treeRun, which sibling **338-2** has 53 uncommitted lines in on disk (the toolchain-resolution gap)
— it is a mid-edit cross-lane state, not a regression from this lane's files (none of
`verify.ts`/`entry-oracle.ts`/`verify.server.ts`/`harvest.ts`/`knowledge.ts` is on that path, and
the compile-check suite itself is green).

