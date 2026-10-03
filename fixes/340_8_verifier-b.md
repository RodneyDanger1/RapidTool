# fixes/340_8_verifier-b.md — verifier B, W340 wave (adversarial, no trust)

**Root:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD:** `a097fa8` + large uncommitted wave.
**Runtimes:** host `node` v24.15.0; pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
**Scratch:** `%TEMP%\rt340_vb\` (`scratch2` = full `src`+`scripts` copy + `node_modules` junction).
**Constraints honored:** working tree NOT modified (no `src/**`, `scripts/**`, `fixes/**` edits; no
`git checkout/stash/reset/apply`); no full gate; no keyed LLM calls; no secret printed.
**Method:** independent probes importing the repo's own modules (`probe1..7.mjs`), real temp CLI
trees, mutation tests in the scratch copy, plus targeted suites on both runtimes.

Verdict summary: **claims 1–5 CONFIRMED**, with 3 named residual holes (all pre-existing or
out-of-wave), and 2 live comments inside the wave that are now stale.

---

## Claim 1 — 340-2 doctor truth (`doctor.ts` + `headless.ts`) — **CONFIRMED**

### 1.1 Derived, never hand-fed (`%TEMP%\rt340_vb\probe1.mjs`, both runtimes → ALL PROBE1 OK)
- Absent state: `factoryClaim()`, `factoryClaim(RAPIDTOOL_FACTORY_EVIDENCE)`, `doctorFactory({})`
  all read `awaitingHumanAcceptance:false`, `autonomousSoftwareFactory:false`.
- **Injection attempt A (`extra`):** `evidenceFromJobInventory(twoRealJobs(),
  {acceptance:{state:"pending",…}} as never)` → `ev.acceptance === undefined` (the hand-fed value
  is never read; `extra` omits `acceptance` from its type *and* ignores it at runtime). No mint.
- **Injection attempt B (`claim`):** `coerceFactoryClaim({…, acceptance:{state:"pending"…}})` with
  no project → `awaiting:false`; the blob's `acceptance` is ignored, it is re-derived from
  `liveAcceptanceState(project)` only.
- `factoryClaim(evidence)` (the internal pure builder) *does* honor a hand-built `evidence.acceptance`
  — that is the builder, not a hostile-input seam; the two untrusted seams are `extra` and
  `coerceFactoryClaim` and both are closed.

### 1.2 True only when every machine conjunct holds and the sole gap is pending
`probe1` D1: 2 real jobs + arch-complete + `acceptanceFixtures:[{approval:"pending"}]` →
`leftover:false`, `realMultiJobProduct:true`, `productComplete:true`, `acceptance.state:"pending"`,
`awaitingHumanAcceptance:true`, `autonomousSoftwareFactory:false`, `gaps:[FACTORY_GAP.fixtures]`.
D2: human-approved record → latch `true`, awaiting `false`, `gaps:[]` (mutual exclusion by
construction: awaiting needs `human===false`, latch needs `human===true`).

### 1.3 False for the four named shapes
`probe1` E1/E2/E3: stubbed+reexport tree (leftover true) → false; stale brief-hash pending set
(`acceptance === undefined`) → false; matching-hash pending → true; machine-decided / unattributed /
unreadable / absent → all false. Latch false throughout.

### 1.4 CLI `doctor --tree` really carries it (real temp trees)
`node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --tree <tmp>`:
- `tree_a` (2 real modules + arch-complete `project.json` with a pending fixture):
  `"autonomousSoftwareFactory": false, "awaitingHumanAcceptance": true, gaps:["no human-approved fixtures (decidedBy:\"human\")"], inventory {stubs:0,reexports:0,real:2}`, exit 0.
- `tree_b` (TODO(E-15) stub + reexport, same pending record): `awaitingHumanAcceptance:false`,
  `leftoverJobsAreReexportsOrStubs:true`, 4 gaps, exit 0.
- `tree_c` (one real module): `awaiting:false`, `real:1`, `singleJob` wording, no `product` wording.

### 1.5 `singleJob` only for a measured `0/0/1`
`probe1` G1/G2: `0/0/1` → `singleJob`, not `product`; `0/0/2` → neither gap; `0/1/1` → `product`;
unmeasured (`evidenceFromProjectRecord`) → `product`; garbled `stubs:"0"` → `product`. Confirmed on
real CLI bytes (`tree_c`).

### Holes / boundaries (Claim 1)
1. **Pre-existing, not introduced:** `coerceFactoryClaim` still honors a hand-fed
   `humanFixtures:true`. `probe6.mjs`:
   `coerceFactoryClaim({leftover…:false, humanFixtures:true, realMultiJobProduct:true,
   productComplete:true, isolation:{sandbox:false}}, <arch-complete project with pending fixtures>)`
   → `{latch:true, awaiting:false, gaps:[]}`. So the *latch's human conjunct* is forgeable through a
   raw claim blob — but `coerceFactoryClaim` has **zero non-test callers** (`grep` across
   `src/routes`, `src/components`, `scripts` = 0; only `doctor.test.ts`), and it is pre-existing
   338-3 behavior explicitly pinned at `doctor.test.ts:563-577`. Not a 340-2 regression; the new
   `awaitingHumanAcceptance` itself cannot be forged. Flagged for the record.
2. `factoryClaim` reads `evidence.acceptance` directly (by design). Fine for an internal builder.
3. Pre-existing: `acceptanceRecordIsStale` only fires when *both* `acceptanceBriefHash` and `brief`
   are strings; a record with fixtures but no `brief` reads as live (same rule as
   `humanFixturesFromProject`, unchanged).

---

## Claim 2 — 340-3 spine (`verify.ts` + `verify.server.ts`) — **CONFIRMED**

### 2.1 Hollow `tested` closed (`probe2.mjs`, both runtimes → ALL PROBE2 OK)
Absent `cases` → no `tested`; `cases:[]` → no; absent `finalSource` → no; blank `"   \n\t "` → no;
empty evidence → no; non-array `cases:"c1"` → no; full envelope → `tested` minted and
`generatedSource` converged; failed status → no `tested`, source unchanged (correct: convergence is
pass-only).
RED evidence is in the diff itself: pre-fix `emptyCaseSet = Array.isArray(cases) && length===0`
accepted an absent `cases`; no `finalSource` check existed.

### 2.2 The two 337-3 fixtures are still honest (mutation test, scratch copy)
`scratch2` is a full wave copy. (i) Mutating the hash back to naive concat
(`finalSource+evidence+caseCommitment`, boundary `\u0002` removed) →
`not ok 1 - a different verified source is never dropped…` / `error: 'a different verified outcome
is not a duplicate'`. (ii) Mutating the second fixture to `finalSource:"abc", evidence:"DEF"` (i.e.
removing the distinguishing input) → same failure. Both mutations flip the test, so the fixtures
still distinguish the shape they were written for; adding `cases` did not blunt them.

### 2.3 ESM refusal honest; CJS/typed-CJS pass (`probe3.mjs`, both runtimes → ALL PROBE3 OK)
`runCases('export * from "./generated/chunk-0.ts";…')` → `pass:false`,
`compileError === ESM_MODULE_UNSUPPORTED_REASON`, contains `RT_E_RUNNER_FAILED`, does **not** contain
`failed to compile in the harness`. Controls: CJS `exports.add=(a,b)=>a+b` → `pass:true`, `compileError` undefined;
typed-CJS `function mean(values: number[]): number…` → `pass:true`.
**Defeat attempts** — all refused: hidden behind `"use strict";`, a `#!` shebang, leading `//`+`/* */`
comments, mixed CJS+ESM (`exports.x=1;\nexport const…`), ESM after `)`, after `}`.
**No over-refusal** — all `null`: ESM tokens in a string literal, a line comment, a regex literal,
an object-literal key, a template literal, a block comment, and dynamic `import()`.

### 2.4 ESM refusal precedes all model wire (`probe4.mjs`, both runtimes)
With a fake key and a tripwire `fetch` that throws: `verifyAndFixServer('export * from …', brief)` →
`status:"error"`, `iterations:0`, `evidence` = the coded reason, `lesson:null`, **`fetchCalls:0`**.

### Holes / boundaries (Claim 2)
- `import.meta.url` is ESM-only but is **not** matched (`esmModuleUnsupportedReason` → `null`),
  because `import` must sit at a `^`/`;`/`{`/`}` boundary. It then reaches the harness and fails with
  the generic compile marker — honest (no `tested` mint), just less precise than the coded reason.
  It cannot appear in the materialized barrel the seam actually feeds (`export * from …`), so the
  named gap is not reachable via 340-3's path.
- `applyVerifyOutcome` accepts a non-empty but junk `cases` array (e.g. `[null,42,{}]`) and still
  mints `tested`; pre-existing (339-6 accepted any present non-empty array), outside this claim.

---

## Claim 3 — 340-5 headless-gov — **CONFIRMED**

### 3.1 Forced emit quarantines + reports (real CLI, real temp dirs)
`create` a temp project, add `CONTAMINANT.txt`, `emit --force`:
`{"ok":true,"count":14,"quarantined":["CONTAMINANT.txt"],"quarantineDir":"…\\tree_ok\\.rapidtool-quarantine\\2026-10-03T08-23-07-353Z"}`; on disk the file left the tree and sits under the stamp dir with its bytes intact. Module-level `probe7.mjs`: `emitProject(p,dir,{force:true})` → `survivors:[]`, `quarantined:["NOTES.md"]`, `quarantineDir` set.

### 3.2 Failed move refuses + `judgingSkipped` suppresses legs
`.rapidtool-quarantine` is a **file** → forced emit exits **1**:
`{"ok":false,"code":"RT_E_FOREIGN_FILES","foreign":["CONTAMINANT.txt"],"quarantineFailed":[{…copyfile…}],"judgingSkipped":"foreign files could not be quarantined — --verify-kind/--check/--run did not run (the tree is still mixed; R11-f08 · A1-f07)"}`; `CONTAMINANT.txt` remains in place (never dropped). With `--verify-kind --run` also passed, the envelope has **no** `verifyKind`/`run` keys and `judgingSkipped` is present. So no tree-run can mint `tested` over the still-mixed tree.

### 3.3 Park carries real rows and no mutation precedes it (`probe5.mjs`, both runtimes → ALL PROBE5 OK)
Seeded `wildPlan{source:"planner",2 rows}` + injected reviewer via `wildStartRun`:
`outcome:"paused"`, `steps:0`, `wildRun.pause:true`, `park {code:"RT_E_GATE_PENDING",
unlock:"human-gate"}`, ledger has both `wild.plan_review` and `wild.paused_plan`; reviewer called
exactly once and its context carried rows `s1,s2`. **No mutation precedes:** `currentPhase`,
`generatedSource`, `artifacts`, `decisions`, `generatedTree` unchanged, and zero `phase.*`/`wild.step`/
`p6.*` log rows. Idempotent: a project already carrying `wild.plan_review` is never re-reviewed
(`calls:0`). Keyless host: still parks with a `not configured` review row. Classifier **reject**:
still parks, `steps:0`. No planner plan: not parked.

### 3.4 Prompt renders the stored plan
`probe5`: current vs **HEAD** `buildWildReviewPrompt` (HEAD source extracted to scratch) for a
no-plan context are byte-identical. With a planner plan, current renders
`Plan under review (2 step(s)):` + `- s1: do step 1 — reason 1`; 15 rows → 12 shown + `(3 further
step(s) omitted — the prompt shows at most 12)`, `- s13:` absent; non-planner/empty plan adds
nothing; whitespace collapsed one line per row.

### 3.5 CLI `:2032` block cannot double-move
`emitProject` returns `survivors: []` unconditionally (`headless.ts:2398`); the CLI guard
(`rapidtool-cli.mjs:2033`) requires `length > 0` → dead. `probe7`: re-running `quarantineFiles` on an
already-moved rel returns `moved:[] , missing:["NOTES.md"]` (never re-moves), and a second forced
emit re-quarantines nothing (`quarantined:[]`) because `walkEmitRel` skips the quarantine dir.
No double-move on either route.

### Holes / boundaries (Claim 3)
- `stageWildPlan`'s keyless branch parks with a `not configured` review row — an unreviewed plan
  never executes. Honest, but note the **pause is the gate**, not a classifier verdict.
- Console/`store.ts` driver does not call `attachWildPlan`/`stageWildPlan` (already STOP-and-REPORTed
  by the lane; not owned). Out of this verification's scope, unchanged.

---

## Claim 4 — Wave-wide census (added lines of `git diff`, `src/lib/**` + `scripts/**`)

Scope: `2294` added / `112` deleted across `22` tracked files; **plus** the untracked
`src/lib/mcp.server.ts`, `src/lib/mcp.server.test.ts`, `src/lib/mcp/stub-server.ts` scanned directly.

| Pattern | Added-line hits | Disposition |
|---|---|---|
| `as any` | **0** | — |
| `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` | **0** | — |
| `eslint-disable` | **0** | — |
| empty `catch {}` | **0** | the one added `} catch {` (`verify.server.ts:828`) carries an explanatory comment (parse probe) — honest |
| `.only(` / unconditional `.skip(` | **0** | new ESM control uses `{ skip: !available }` (a runner-availability skip), not `.skip(` |
| `TODO`/`FIXME`/`XXX` | **2** | test fixture INPUTS only: `src/lib/doctor.test.ts:796`, `src/lib/headless.test.ts:2800` — `'throw new Error("TODO(E-15) stub: implement board")'` (classifier fixtures). No code TODO body added. |
| hardcoded `return true/false/null/…` | 13 regex hits; 0 violations | all guard clauses or fixture data |

Hardcoded-return hits (all honest):
`src/lib/cassette.ts:820` (mode-off guard), `src/lib/doctor.ts:365` (staleness guard),
`src/lib/doctor.test.ts:868,896` (`return 1` inside fixture source strings),
`src/lib/scaffold.ts:1306,1317,1331,1348,1446` (scaffold parser not-found guards),
`src/lib/verify.server.ts:825,829` (ESM predicate guards),
plus `engine.ts:4364` (union type) / `engine.ts:4374` (returns the real reviewer verdict) /
`headless.ts:5313,5540` (`ok:true` on a real park return, not a fake pass). No production
`return true` faking a computation.

**Comments claiming behavior the bytes do not implement — 2 real (stale) hits:**
1. `src/lib/engine.ts:4352-4357` — `reviewWildPlan` doc says the production prompt
   "renders project artifacts + DoD, not `wildPlan`, so the production classifier does not yet SEE
   the rows — rendering them … is STOP-and-REPORTed in fixes/340_5_headless-gov.md". **False on the
   current bytes:** `wild-mode.server.ts:179-197` renders the rows and `probe5` proves the built
   prompt contains them. Stale after the lane's own resume §7.1; understates capability (no false
   success claim).
2. `src/lib/quarantine.ts:21-23` — says the CLI emit arm "also no longer forwards the report (the
   CLI envelope forwarding is owed on that file, R11-f08)". **False:** `rapidtool-cli.mjs:1992` and
   `:2002` now forward `quarantined`/`quarantineDir`/`quarantineMissing`/`quarantineFailed`/
   `judgingSkipped` (confirmed by the real forced-emit runs, §3.1-3.2).

Those are the only two comment/byte drifts found. Claim 1-3 files' added comments all match their
bytes (re-derived in §1-3). Comment claims in `scaffold.ts` (340-6, out of this assignment's claim
set) read as consistent but were **not** mutation-verified here.

`errors.ts` claim that the MCP stdio transport "is implemented" is honest:
`src/lib/mcp.server.ts` is a real 544-line `StdioMcpClient` (JSON-RPC 2.0 newline framing, spawn,
`tools/list`/`tools/call`), and contains none of the census patterns.

---

## Claim 5 — Destruction audit — **CLEAN**

```
git ls-files | Measure-Object -Line      -> 2075
baseline_tracked.txt                     -> 2075
Compare-Object baseline now              -> (in baseline not now) = empty ; (in now not baseline) = empty
git diff --diff-filter=DR --name-status -> empty
git status --porcelain | where ^[DR]     -> empty
git stash list                           -> empty
```
No tracked file deleted, renamed, or stashed. The only additions are untracked (`src/lib/mcp*`,
`fixes/340_*.md`).

---

## Targeted suites (both runtimes, `--test-reporter=tap`)

| Suite | node v24.15.0 | node v22.23.2 |
|---|---|---|
| `src/lib/doctor.test.ts` | 47/47/0 | 47/47/0 |
| `src/lib/verify.test.ts` + `verify.server.test.ts` | 115/115/0 | 115/115/0 |
| `src/lib/headless.test.ts` + `quarantine.test.ts` + `wild-mode.server.test.ts` | 189/189/0 | 189/189/0 |
| `scripts/cli-exit-taxonomy.test.mjs` | 36/36/0 | 36/36/0 |

No full gate, no build, no `npm test` run. Probe artefacts: `%TEMP%\rt340_vb\{probe1..7,census,
census2,mktree}.mjs`, `scratch2\` (mutation copy), real emit trees under `%TEMP%\rt340_vb\emit\`.

---

## What I could not verify (and why)

- **`scaffold.ts` (340-6) and `cassette.ts` (340-4) behavior** — outside this assignment's four
  claims; only pattern-audited. Their claim-bearing comments were not mutation-verified.
- **`import.meta`-only ESM** is not refused by the coded reason (see §2 hole); confirmed it cannot
  yield a false `tested` mint, but it does not get the precise reason.
- **`coerceFactoryClaim` hand-fed `humanFixtures:true`** fires the latch (§1 hole) — pre-existing,
  and the function has no non-test caller, so it is latent, not a live dishonesty path.
- **Console/`store.ts` wild driver** does not stage the plan review (lane-reported, not owned).
