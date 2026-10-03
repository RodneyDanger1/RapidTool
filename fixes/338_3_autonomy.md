# fixes/338_3_autonomy.md — W52 · lane 338-3 · AUTONOMY (the unattended journey + honest doctor)

**Lane:** W52 338-3 ("Autonomy"). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (space in path —
terminal `Select-String`/`git grep` only; ripgrep fails on the space).
**HEAD at open:** `e7da20e`, tree carrying sibling WIP (`codegen.server.ts`, `algorithms.ts` = 338-1;
`fixtures.ts`/`fixtures.test.ts`/`maker-score.ts`/`policy.ts` = 338-4) — read as the live source, not
committed.
**Runtime:** repo-pinned Node **22.23.2** (`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node
**v24.15.0**; every parsed `node --test` run uses `--test-reporter=tap`.
**Scratch (outside the repo):** `%TEMP%\rt338_3\`. No probe file left in the repo.
**Owned (STRICT):** `src/lib/headless.ts`, `src/lib/doctor.ts`, `src/lib/dod.ts` + their tests.
Everything else STOP-and-REPORT (`compile-check.server.ts` 338-2, `fixtures*` 338-4,
`scaffold.ts` 338-5, `codegen.server.ts` 338-1).
**Rules obeyed:** minimal surgical patches; no tracked file deleted; no full gate (siblings mid-edit);
targeted suites only; keyed calls bounded to the contract; never `npm run eval` against the tracked dir;
no secret printed (tail-only); append-only log.

---

## 0. Step 0 — reconciliation (claimed / on disk / still open)

Read this pass: `wave_plans/W52/README.md` (full), `fixes/337_0_parent.md` (§5 + the four gaps),
`fixes/337_3_trust.md` (my predecessor lane), `fixes/318_parent_complete.md` pointer via
`research/multiagent/thoroughanalysis.md` AW45-*/AW46-*/AW47-* (lines 1460-1518), `fixes/319_keyed_trial.md`
(the W44 keyed campaign's park findings), `fixes/210_g1_factory_honest_doctor.md` (the factory latch),
`fixes/213_grok_pack_intake_doctor_wire.md`, and the live sibling logs `fixes/338_1_determinism.md`,
`fixes/338_4_acceptance.md`.

### claimed (what prior waves said they landed)

- **337-0 §5:** the "autonomous software factory" question is four specific gaps, not a mystery:
  (1) keyed synthesis coverage is not deterministic run-to-run; (2) the tree's declared
  `typecheck`/`build` never run (`declaredScriptsVerified:false`); (3) **no keyed run has ever been
  driven end-to-end from brief to P12 delivery unattended**, and no wave classified the parks; (4) fixture
  acceptance requires a `decidedBy:"human"` stamp the machine door deliberately never claims.
- **337-0 §5 (positive):** a keyed run reached **P6 PASS** (`lastTest.label:"tested"` from a green
  tree-run, `p6-arch` PASS, `treeRun.substance {stubs:0,reexports:0,real:3}`), `emit --run ok:true`,
  advanced to P8. The keyless floor scores **mean 0.56 / pass@1 0.00**, every fixture ending
  `dod · RT_E_GATE_PENDING` (honest placeholder).
- **319_keyed_trial (W44):** EXP 04 (a stats library) reached **13/13 phases sealed** through the
  P4/P5/P8/P9 machine door; but that was the `run-eval`/`wild` campaign, and it is not a CLI `create →
  P12 delivery` journey; parks at P0/P6 fired on other experiments. Also: a stock HITL gate is cleared
  by `approve --seat autopilot` (rows `decidedBy:"autopilot"`, note `[seat harness] autopilot seat — no
  human decision claimed`).
- **210/213:** `doctor.factoryClaim` is the factory latch; `headless.doctorStatus` was wired to
  `doctorFactory()` (field truth). Factory remains **false**.

### on disk (measured today at `e7da20e` + sibling WIP)

- `src/lib/headless.ts:609-625` `canAutopilot` refuses `forceHuman`, refuses `STOCK_HITL`
  (`phases.ts:151` = `[4,5,8,9]`), refuses a phase whose own DoD is unmet, refuses a tight schedule.
  So `gate --autopilot` **parks at every stock HITL gate** — by design.
- `src/lib/policy.ts:128-130` `hitl.approve` has `requiresHumanSeat:false` ⇒ the `autopilot` seat is
  ALLOWED to approve a stock gate through `approve --seat autopilot`. A `forceHuman` gate
  (reframe / failed P6 sandbox) is refused for a machine in the CLI
  (`rapidtool-cli.mjs:1565-1575`) and by `policy.ts:129` (`hitl.force` `requiresHumanSeat:true`).
- `src/lib/headless.ts:4783` — the ONLY tree-scan producer calls `doctor.evidenceFromJobInventory(inv)`
  with **NO `extra`**, so `productCompleteFromProject(undefined)` is **false on every `doctor --tree`
  run** even when the emitted tree carries a valid `.rapidtool/project.json`: the product-complete gap can
  never close through the real signal. (`humanFixtures` is likewise `false` on every real run — there is
  no producer; `doctor.ts:313,324`.)
- `src/lib/dod.ts:477-800` — the DoD registry. Stock-gate criteria `p4-approved`/`p5-complete`/
  `p8-complete`/`p9-complete` read `approvalActor()` over the decision ledger and accept a
  policy-consistent `autopilot` row (so a machine seat CAN satisfy them). `p6-verified` needs a
  `lastTest.label:"tested"` + `evidenceHash` (tree-run mint); `p6-brief-fit` needs brief-noun coverage
  ≥ max(1, ceil(0.35·n)); `p6-arch` needs every spec capability covered by a real tree file.
- `createProject` default `enforceDod = keyedDeepSeekConfigured()` (`engine.ts:2039-2040`): a funded
  key ⇒ **hard** DoD gates; a keyless run is advisory.

### still open (before my edits, with `file:line`)

1. `src/lib/headless.ts:4783` — `evidenceFromJobInventory(inv)` drops the project, so `productComplete`
   is a constant `false` on the `--tree` path. **No keyed run / tree state can ever close the gap the
   doctor claims to measure.** (machine-resolvable, MY file).
2. `src/lib/doctor.ts:313,324,339,371,414` — `humanFixtures` has NO producer: it is a hand-fed boolean
   (`RAPIDTOOL_FACTORY_EVIDENCE.humanFixtures:false`); no code derives it from the project's real
   acceptance-fixture state. A genuinely-approved set cannot flip the flag; a broken set cannot be told
   apart from "waiting on a human". (machine-resolvable, MY file).
3. `src/lib/doctor.ts:4755-4768` — `headless.doctorStatus`'s no-tree fallback is the fixed
   `RAPIDTOOL_FACTORY_EVIDENCE` gap list, even when a `--project` record is on disk; the doctor cannot id
   the real gaps of a named project without a `--tree`. (machine-resolvable, MY file).
4. **The unattended journey has never been recorded** — no park census (P4/P5/P8/P9), no DoD block
   census, no exit-code trail from `create` to a P12 `complete`. (the lane's primary proof, below).
5. Gap 4 (fixture acceptance) is 338-4's decision; gap 1 (determinism) is 338-1's; gap 2 (declared
   toolchain) is 338-2/338-5's. Touching `fixtures*.ts` / `codegen.server.ts` / `scaffold.ts` is
   STOP-and-REPORT.

### baseline (measured this open, Node 22.23.2)

`headless.test.ts` **144/144**, `doctor.test.ts` **31/31**, `dod.test.ts` (gates) **3/3** — see §1.

---

---

## 1. THE UNATTENDED JOURNEY (keyed, CLI machine door, ZERO human input)

**Brief** (LEX-clean so P0 does not reframe — probed first, §2):
`"A TypeScript statistics library: compute mean, median, percentile and standard deviation over arrays of numbers; validate inputs and reject empty arrays."`
Project `statlib`, `create` keyed ⇒ `enforceDod:true`. Scratch: `%TEMP%\rt338_3\keyed.json`.
Every command below is a fresh CLI process; `.env` key (tail …19b3) wins over the stale ambient User-scope
key (tail …42ff) and prints the coded `RT_E_LLM_KEY_SHADOWED` notice — expected, never an error.

| # | invocation | exit | state after | notes |
|---|---|---|---|---|
| A | `create --brief … --out keyed.json` | **0** | P0, `enforceDod:true` | keyed default ⇒ hard DoD |
| B | `gate --project keyed.json --autopilot` | **2** | **P4 `awaiting_hitl`** (stock park), steps 5 | P0–P4 deterministic, no model calls |
| C | `approve --project keyed.json --seat autopilot` | **0** | edge → P5 | row `decidedBy:"autopilot"`, note `[seat harness] autopilot seat — no human decision claimed` |
| D | `gate --project keyed.json --autopilot` | **2** | **P5 `awaiting_hitl`** (stock park), steps 1 | |
| E | `approve --project keyed.json --seat autopilot` | **0** | edge → **P6** | |
| F | `gate --project keyed.json --autopilot --live` **(KEYED group 1/2)** | **1** | **P6 DoD hard block**, `outcome:"dod"`, steps 1 | RT_E_GATE_PENDING; 3 synthesis cycles |

**F — what happened inside the one keyed group** (one CLI process, 4 synthesis attempts logged):

- cycles 1–2 (single-module path): `p6.synthesis.refused` = `RT_E_RUNNER_FAILED · machine-run cases still
  failing after 3 iterations: case-1: not run — case payload rejected by harness safety check; case-2: not run
  — case payload rejected by …` (the machine ORACLE rejected the model's case expressions).
- cycle 3 (chunked path): synthesized **3 files** (`src/generated.ts` barrel, `src/generated/mean.ts` 187
  lines, `src/jobs/validate.ts` 32 lines), **`p6-arch: PASS · tree (3 files)`**, then the tree-run went red:
  the emitted project's OWN `npm run typecheck` (exit 2) —
  `src/generated/mean.ts(11,27): error TS7006: Parameter 'values' implicitly has an 'any' type` (and the same
  for every one of the 12 functions: lines 11/23/35/52/63/75/89/103/122/142/168).
- `p6.journey.exhausted` after 3 cycles → `gate.verdict FAIL · 2 unmet · 2426931878` → `dod.blocked`
  `unmet: p6-test, p6-verified`.
- `p6-brief-fit` PASSED, `p6-arch` PASSED; the two unmet criteria are exactly the tree-run-derived pair.

**Outcome: delivery NOT reached.** The run parks at P6 on a hard DoD block (not a HITL park), exit 1
`RT_E_GATE_PENDING`. P8/P9 parks were never reached. Nothing was forced; no human input occurred.

**Named limit (capped evidence):** the codegen refusal detail is clipped at 186 chars by
`p6RefusalDetail`/the synthesis-refusal cap, so the sanitizer's own reason for the rejected oracle case
(`verify.server.ts:551` `expression rejected by harness safety check (<reason>)`) is not visible on the
record — only the aggregate "not run". Reported below.

## 2. KEYLESS DRY RUN (free, for the journey shape) + LEX probes

- Keyless `--advisory` drain (`%TEMP%\rt338_3\dry2.*`): P4 park (2) → approve (0) → P5 park (2) → approve (0)
  → P8 park (2) → approve (0) → P9 park (2) → approve (0) → P10–P12 → **status `complete`, exit 1
  `RT_E_GATES_FAILED`** (2 red gates: `P6(p6-verified,p6-brief-fit)`, `P7(p7-research)`) — the honest keyless
  floor, never a clean 0.
- LEX probe (`%TEMP%\rt338_3\lexprobe.mjs`): the chosen brief → `vague:false`, `verdict:"proceed-with-guards"`,
  14 required nouns (p6-brief-fit needs ≥5). The corpus `invoice-csv-cli` brief also `vague:false`/`proceed`.

## 3. HUMAN-DECISION vs MACHINE-RESOLVABLE CLASSIFICATION

| stop | kind | class | evidence | action |
|---|---|---|---|---|
| P4 `awaiting_hitl` | stock HITL gate (`STOCK_HITL=[4,5,8,9]`) | **machine-resolvable — NOT a bug** (governed autonomy: `canAutopilot` refuses to auto-clear it, but policy `hitl.approve` has `requiresHumanSeat:false`, so the explicit `--seat autopilot` door clears it) | C exit 0; ledger row `decidedBy:"autopilot"` | none |
| P5 `awaiting_hitl` | stock HITL gate | same | E exit 0 | none |
| P0 reframe park | `forceHuman` (vague brief) | **genuine human decision — stays** | `policy.ts:129` `hitl.force requiresHumanSeat:true`; `engine.ts:1496` | none (not hit: brief is LEX-clean) |
| P6 failed-sandbox park | `forceHuman` (R3/B-03) | **genuine human decision — stays** | `engine.ts:993,1490`; CLI refuses `--seat autopilot` | none |
| P6 DoD block `p6-test` | keyed journey did not converge ⇒ no `lastTest` mint (the deterministic floor was replaced by the synthesized tree) | **machine-resolvable IN PRINCIPLE; blocked by sibling defects** | `dod.blocked` p6-test | STOP-and-REPORT (§6.1/6.2) |
| P6 DoD block `p6-verified` | needs `label:"tested"` minted by a GREEN tree-run | **machine-resolvable IN PRINCIPLE; blocked** | tree-run red (tsc TS7006) | STOP-and-REPORT (§6.1) |
| P6 oracle refusal | machine-run case harness rejected the model's case expressions | **machine-resolvable BUG (not mine)** | `RT_E_RUNNER_FAILED`, `verify.server.ts:512-556` | STOP-and-REPORT (§6.2) |
| P8/P9 parks (never reached) | stock HITL gates | machine-resolvable via `--seat autopilot` | keyless drain cleared them | none |
| P7 `p7-research` (never reached; would be met live) | DoD probe | machine-resolvable (live corpus or `meta.liveUnavailable`) | `dod.ts:714` | none |

No genuine-human park was encountered on this brief. The **machine-resolvable-but-blocked** rows are all in
files I do not own; nothing machine-resolvable was fixable inside `headless.ts`/`doctor.ts`/`dod.ts`.

## 4. KEYED USAGE (measured, persisted on the record)

`doctor --project keyed.json` → `spend: 14367 tokens measured (prompt 8484 + completion 5883 · 4 call(s))`.
**1 of the 2 allowed keyed invocation-groups used.** The 2nd is **NOT spent and held in reserve**: the two
blockers measured above are structural, not stochastic — the synthesis prompt's own worked example and rule 2
emit UNTYPED JS (`codegen.server.ts:558-590`) while the emitted tree's tsconfig is `strict:true`
(`scaffold.ts:720-748`), so every generated function trips TS7006, and all 12 functions of the observed
`mean.ts` are untyped; a re-roll cannot change either verdict. Spending the 2nd group would burn tokens for no
information. If the boundary wants a reproducibility sample, the 2nd group is available.

## 5. FIX LANDED — doctor wired to REAL signals (task item 4)

**Bug on disk (before):** `headless.doctorStatus` called `doctor.evidenceFromJobInventory(inv)` with NO
project, so `productCompleteFromProject(undefined)` was a constant `false` and `humanFixtures` had no producer
— the doctor could NEVER report the product-complete or fixtures gap closing, even on a genuine product; and
`--project` (no `--tree`) reported the fixed `RAPIDTOOL_FACTORY_EVIDENCE` gap list regardless of the record.

**Patch (surgical):**

- `doctor.ts` + `humanFixturesFromProject(project)` — the ONE producer of the `humanFixtures` signal, read
  from the project's OWN `acceptanceFixtures` (≥1 case, EVERY case `approval:"approved"`, ≥1 carrying the
  out-of-band `decidedBy:"human"` stamp; a recorded `acceptanceBriefHash` must equal `fnv1a(brief)` or the
  stale set refuses). Fail-closed on absent/garbled state.
- `doctor.ts` + `evidenceFromProjectRecord(project)` — `productComplete` + `humanFixtures` derived from a
  persisted record; the census fields stay fail-closed (leftover true / realMulti false) when no tree is
  scanned.
- `doctor.ts` `evidenceFromJobInventory(inv, {project})` now derives `humanFixtures` from the record (an
  explicit `humanFixtures:true` is still honored); `coerceFactoryClaim` derives it from the project too.
- `headless.ts` + `persistedProjectRecord({treeDir, projectPath})` (parsed `.rapidtool/project.json` or
  `--project`; null on absent/garbled) — and `doctorStatus` now passes it on the `--tree` path and uses
  `evidenceFromProjectRecord` on the `--project`-only path.

**Real-bytes demonstration (the failed keyed record):** `doctor --project keyed.json` now reports
`gaps: ["leftover jobs…", "no human-approved fixtures…", "no real multi-job product"]` — the
**product-complete gap is GONE** because that record's `generatedTree` is genuinely arch-complete
(`p6-arch PASS`). Before the patch it was a constant `false`. (The census gaps stay because no tree dir was
scanned — fail-closed, honest.)

### RED-first (both results), Node 22.23.2

```
# RED — pre-fix derivation restored in place:
not ok 1 - a real two-job census + arch-complete tree + human fixtures closes EVERY gap (the latch fires)
  expected: true
  actual:   false
# tests 1 / pass 0 / fail 1

not ok 1 - W52 · 338-3: doctor --tree derives the factory claim from the real record (product-complete + human fixtures CLOSE)
  error: 'the product-complete gap must CLOSE on a real arch-complete record:
          ["no human-approved fixtures (decidedBy:\"human\")","product-complete bar not met (skip≠green; stubs≠complete)"]'
  expected: true / actual: false
# tests 1 / pass 0 / fail 1

# GREEN — patched:
doctor.test.ts  # tests 36 / pass 36 / fail 0   (baseline 31)
headless.test.ts --test-name-pattern=338-3  # tests 2 / pass 2 / fail 0
```

Both runtimes:

| suite | Node 22.23.2 | Node 24.15.0 |
|---|---|---|
| `doctor.test.ts` (31 → **36**) | 36 / 36 / 0 | 36 / 36 / 0 |
| `headless.test.ts` new `338-3` tests (144 → **146**) | 2 / 2 / 0 | 2 / 2 / 0 |
| `dod.test.ts` (untouched) | 3 / 3 / 0 | — |
| `sandbox-policy.test.ts` | 3 / 3 / 0 | — |

Full `headless.test.ts` on Node 22: **146 tests / 145 pass / 1 fail** — the single failure is
`emit --run: … a green tree exits 0`, which I reproduced with the COMMITTED `headless.ts` (git checkout +
run) ⇒ it is a sibling-WIP interaction (338-1 codegen / 338-2 tree-run), **not** my change. `npx tsc --noEmit`
exit 0 (whole repo). `npx eslint` on my 4 files exit 0, 0 warnings. `check-assertion-gaps.mjs` clean
(133 files, 0 findings).

## 6. STOP-and-REPORT (files I do not own — exact shape)

**6.1 `codegen.server.ts:558-590` (`p6SynthesisSystemPrompt`) vs `scaffold.ts:720-748` (`tsconfigJson`), owner
338-1 / 338-5.** The synthesis prompt's worked example is `function add(a, b) { return a + b; }` and rule 2
says "Plain functions only … every line must be a real JavaScript statement", so the model emits UNTYPED JS;
the emitted tree's tsconfig is `strict:true` (⇒ `noImplicitAny`), so EVERY generated module fails the emitted
project's DECLARED `npm run typecheck`. Measured on the keyed run: `src/generated/mean.ts` 12/12 functions
untyped, TS7006 at 11:27, 23:25, 35:30, 52, 63, 75, 89, 103, 122, 142, 168; tree-run red ⇒ no `tested` mint ⇒
`p6-verified` unmet. **Proposed:** either the prompt requires parameter/return annotations matching the spec's
`typeSignatures`, or the scaffold's emitted tsconfig relaxes `noImplicitAny` for generated files (with the
honest banner). Either closes gap 2's exposure.

**6.2 `verify.server.ts:512-556` (`runCases` / `sanitizeOracleExpression`), owner 338-6 (or the oracle prompt
in 338-1).** The machine-run oracle REFUSED the model's case expressions: `RT_E_RUNNER_FAILED · machine-run
cases still failing after 3 iterations: case-N: not run — case payload rejected by harness safety check`
(cycles 1–2 of the keyed run). The sanitizer's own reason (`expression rejected by harness safety check
(<reason>)`, `:551`) is clipped out of the persisted refusal (`p6RefusalDetail` cap 186). **Proposed:** surface
the rejected expression + reason verbatim in the refusal detail, and confirm whether the model's allowed case
forms (the oracle prompt) are a subset of the sanitizer's grammar — the two disagreeing is the reachable bug
class.

**6.3 (observation)** `emit --run … a green tree exits 0` (headless.test.ts:2643) now fails on the committed
tree due to sibling WIP; the parent's boundary re-run decides it. Not mine; no edit.

## 7. MOCK / FAKE CENSUS (owned files + tests)

Pattern scan `TODO(|FIXME|@ts-ignore|@ts-expect-error|@ts-nocheck|as any|catch {}|placeholder|mock|fake` over
`headless.ts`, `doctor.ts`, `dod.ts`, `headless.test.ts`, `doctor.test.ts`:
**0 prohibited constructs in ANY line I added.** Every hit is pre-existing and honest: the product's
`TODO(E-15)` contract markers, the deterministic-floor "placeholder" doc prose, and injectable test seams
("fakes only in unit tests"). No new `as any`, no `@ts-ignore`, no silent `catch {}`, no test that cannot
fail (the new tests fail on pre-fix bytes — shown §5).

## 8. WHAT I DID NOT DO, AND WHY

- Did not touch `codegen.server.ts` / `compile-check.server.ts` / `scaffold.ts` / `fixtures*.ts` / `policy.ts`
  (siblings' files) — §6 reports them instead.
- Did not spend the 2nd keyed group (§4).
- Did not claim the factory is autonomous: `doctor` on the real keyed record still reports
  `autonomousSoftwareFactory:false` with real gaps; delivery was NOT reached.
- Did not run the full gate / `npm run eval`; no secret printed; no tracked file deleted; all scratch under
  `%TEMP%\rt338_3\`.

## 9. Coordination note (338-4) + honesty posture

- `humanFixturesFromProject` is the `decidedBy:"human"` reader for the CURRENT criterion. If 338-4 lands a
  machine acceptance path (or a machine-checkable proxy) and changes what the fixtures gap MEANS, this reader
  is the single place to extend — the gap string (`FACTORY_GAP.fixtures`) and `factoryClaim`'s requirement
  would move together, so one lane cannot leave the other's signal stranded. Nothing here mints a human stamp:
  only a row already carrying `decidedBy:"human"` + `approval:"approved"` counts.
- The flag is NOT flipped anywhere as a claim: on the repo, in the keyed record, and in every stub/fail-closed
  test it is `false`; it is only `true` in a synthetic unit fixture whose every signal (census, arch-complete
  tree, human-approved set) is genuinely met — the latch's own contract, not a statement about RapidTool.

**Final re-check (same day, after more sibling landings):** full `headless.test.ts` still measures **146 / 145
pass / 1 fail** — the same `emit --run: … a green tree exits 0` subtest, unchanged by my edits and reproduced
with the committed `headless.ts`. `doctor.test.ts` 36/36 and the two new `338-3` headless tests 2/2 on both
runtimes on the current tree.
