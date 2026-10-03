# 344 A1 — core-pipeline audit (engine + governance)

**Auditor:** A1 · **Root:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD:** `4bd1988` (clean)
**Slice:** `src/lib/` — `engine.ts`, `types.ts`, `phases.ts`, `dod.ts`, `judgment.ts`, `store.ts`, `io.ts`,
`checkpoint.server.ts`, `token-ledger.ts`, `quarantine.ts`, `planning.ts`, `wild-mode.server.ts`, `wild-review.ts`,
`policy.ts`, `errors.ts`, `maker-score.ts`, `scorecard.ts`, `doctor.ts`, `fixtures{,.server,.review}.ts`,
`brief-fixtures.ts`, and colocated tests.
**Method:** read every byte of every slice file + its tests; static `tsc --noEmit` (0) and `eslint` on the slice (0);
targeted slice suite (579 tests / 0 fail, Node 22.23.2); mutation (test-teeth) harness on a scratch copy under
`$env:TEMP\rt344_a1\repo`. **0 keyed calls. No source edits. Only write: this file.**

> Advisory note on `wild-step.ts`: the mandate lists it, but no such file exists at HEAD (only `wild-step.test.ts`;
> the wild step lives in `engine.ts`). Confirmed via `git ls-files src/lib`.

---

## 1. Findings

Class codes: **PLACEHOLDER** · **UNWIRED** (declared capability with no production caller) · **DRIFT**
(claim-vs-byte) · **TESTGAP** · **DROP** (dead export) · **BLOCKER** (obstructs the zero-human factory claim) ·
**SEC** · **HONESTY**.

| id | class | file:line | sev | evidence | why it matters to the autonomous-factory claim | recommended fix | eff |
|---|---|---|---|---|---|---|---|
| A1-01 | PLACEHOLDER | `brief-fixtures.ts:152,637-638,691-694`; `scaffold.ts:2738-2748`; `rapidtool-cli.mjs:2248` | **High** | `draftTypedLiterals` mints every shape case as `given:{}`, `expect:{kind:"shape",value:{id:"<draft>"}}` (and throws cases as substring `"invalid"`/constraint name). `fixtureMatchHelperSource` emits `if (expected === "<any>" \|\| expected === "<draft>") return true;` so the compiled `tests/oracle.spec.ts` assertion only checks the export returns an object carrying an `id` key. The chain is real: CLI `fixtures --draft` → `draftTypedLiterals` → human `fixtures --approve` → `scaffold` emits the spec (`approvedAcceptanceFixtures` + `compileFixtureAssertion` + `fixtureMatchHelperSource`); `brief-fixtures.test.ts:605` pins the floor as intentional. | **Degrades the core "machine-verified" claim.** An approved fixture set can be entirely placeholder literals yet the behavioral TAP passes; maker-score M1/M2 then score 1 on a bar that tests none of the brief's semantics. A "verified delivery" can be a placeholder smoke test. | Make placeholder provenance explicit and non-acceptable: mark sentinel rows (e.g. `placeholder:true` when `expect` contains `"<draft>"`/`"<any>"`) and have `fixtureApprovalGate` / `approvedAcceptanceFixtures` refuse them (red-card back to the human), or delete the always-true branch so the emitted assertion fails until real literals exist. | M |
| A1-02 | BLOCKER (by design) | `doctor.ts:520-523,365-379,531-538`; `policy.ts:155-162` | **High** | `factoryClaim` = `leftover===false && human===true && real===true && complete===true`; `human === true` requires `humanFixturesFromProject` (≥1 approved row with `decidedBy:"human"`); `fixtures.approve` is `requiresHumanSeat:true` (autopilot denied — `policy.ts:155-162`, `dod.ts` provenance). Hence `autonomousSoftwareFactory` is **false on every machine-only run by construction**; `awaitingHumanAcceptance` names the single remaining door. | **Directly blocks the literal claim** "a brief goes in and a machine-verified delivery comes out with zero human input" — the product's own factory flag cannot certify that. This is deliberate and correct (a machine must not set the bar it is graded against); the defect is the *claim*, not the gate. | Do **not** remove the human seat. Reconcile the claim: state the machine-complete ceiling (`awaitingHumanAcceptance` already does) and, if a true zero-human path is wanted, grade against an externally frozen oracle the machine cannot author (the run-eval corpus graders are exactly that) rather than the machine-drafted fixture set. | S |
| A1-03 | UNWIRED | `engine.ts:3620` | Med | `verifyPriorPhases` has no production caller — repo-wide grep returns only its definition, its own docblock, and `knowledge.ts:1390-1394` (which states the scanner "is itself unwired — no …"). No `regression.drift` event is emitted anywhere. | **Degrades:** the E-19 "a later phase touching an earlier phase's file space invalidates its exit evidence" guard does not exist at runtime; the drift is computed by nobody. | Wire it into the report-ingest seam that holds `report.files` (`store.ingestReport` / headless ingest) and emit `regression.drift` + the lesson row the doc promises, or delete the export and strike the E-19 claim. | M |
| A1-04 | UNWIRED / DRIFT | `dod.ts:1110,1121` (claim at `dod.ts:17-18`) | Med | `oracleToCaseSeeds` / `missingOracleCaseIds` are consumed only by `brief-fixtures.test.ts`; the header says they are "the seam the verify loop consumes". No verify-loop caller (grep `src` + `scripts`). | **Degrades:** the seeded A7 oracle cases are never pinned into the machine verify run, so a verify pass can silently drop them — the exact vacuity E-08 was written to prevent. | Wire both into the verify loop's case generation (prepend seeds, reject/retry while `missingOracleCaseIds` is non-empty) or strike the claim. | M |
| A1-05 | TESTGAP | `engine.ts:5137,5220,1813`; `store.ts:542` | Med | Mutation harness on the scratch copy made each guard inert (`if (…) {` → `if (false) {`, `return false` prepends). **All relevant suites stayed green:** `wildStep` pause guard (wild-step + wild-seal + store), `wildStep` execute priors-sealed guard (same), `approveHitl` autopilot+forceHuman throw (engine + store). `canAutopilot`'s forceHuman line is masked in `store.test.ts:312` by the later `runGate` DoD guard (the only fixture there also fails DoD). No test constructs an active+paused run or an execute edge with unsealed priors. | **Degrades CI confidence:** a regression in pause semantics, the priors-sealed guard, or the forceHuman policy could ship green. Not a runtime bug today. | Add four focused tests: (1) active+paused run ⇒ `noop`; (2) ready edge with unsealed priors ⇒ `RT_E_PHASE_ILLEGAL`; (3) `approveHitl(autopilot)` on a `forceHuman` gate ⇒ throws; (4) `canAutopilot` with `forceHuman` but a PASSING DoD gate ⇒ false. | S |
| A1-06 | DRIFT / UNWIRED (path) | `store.ts:1357,1379`; `engine.ts:3938-3950,4446-4453`; `console.tsx:7389` | Med | `store.startWildRun` calls `stageWildPlan(cur, reviewer)`, but the browser has no planner: `generateWildPlan` is server-side (`headless.ts:5245`) and the record carries no `wildPlan`, so `readWildPlan` returns the empty shell and `stageWildPlan` returns `staged:false`. The console loop therefore executes with **no plan review at all**. (CLI/headless drivers do generate + stage.) | **Degrades:** the R13-f02 pin "no execution without an approved plan / park before the first mutation" is vacuous on the console wild path — the path the UI advertises. | Either refuse console wild-start when the record carries no planner plan (`staged:false` ⇒ honest "plan required" refusal), or fetch/attach a server-generated plan before looping. | M |
| A1-07 | HONESTY | `io.ts:486-488` (TODO `io.ts:39-46`) | Low | The too-large import arm returns `{ ok:false, error:"Import payload too large …" }` with **no `code`**; `RT_E_IMPORT_TOO_LARGE` is not in `ERROR_CODES`. 319_f1 coded the parse/hydration arms but left this one. | **Degrades:** an agent driver cannot branch on too-large; violates AGENTS honesty contract #4 ("every surfaced failure carries an RT_E code"). | Mint `RT_E_IMPORT_TOO_LARGE` (+ `ERROR_CODE_DOC`) and thread it through `ImportResult`; update `errors.test.ts`. | S |
| A1-08 | HONESTY | `token-ledger.ts:575-579` | Low | `recordBudgetSpend` throws `new Error("… (RT_E_VALIDATION)")` with **no `.code`**; `classifyError` maps it to `RT_E_UNKNOWN`, not the named class. | **Degrades:** the named code is prose only; a caught misuse is misclassified. | Set `err.code = "RT_E_VALIDATION"` (the `phases.ts` coded-throw pattern) or throw a coded shape. | S |
| A1-09 | DROP | `token-ledger.ts:364,679,690,700`; `dod.ts:1098`; `planning.ts:375`; `fixtures.ts:33-54,259` | Low | Repo-wide grep: `billableInputTokens`, `wouldExceed`, `assertWithinBudget`, `recordSpendWithinCap`, `b18Tail`, `backtrack`, `fixtureDecisionEntry`/`FixtureVerdict` have **no production consumer** (tests/comments only); `token-ledger.ts:20-27` admits the three ledger helpers have no call site; `fixtures.ts:33-54` is an explicit de-scope note. | Polish, not factory-blocking: dead surface invites drift and lets readers over-read wired capability (e.g. a budget gate that nothing enforces). | Either wire (the budget helpers into the seams that should enforce `RAPIDTOOL_TOKEN_CAP`) or delete/strike the exports + explanatory comments. | S/M |
| A1-10 | HONESTY | `dod.ts:850-857,893-900` | Low | `runGate.evidenceHash` is FNV-1a over sorted `id:pass\|fail` pairs only; documented (322 X3/OBS-6) that a content change leaving probes unchanged — and two projects with equal verdict sets — share the hash. | **Degrades verifiability:** `PhaseRecord.gate.evidenceHash` is framed as integrity but cannot attest artifact content; a re-recorded gate can look unchanged across materially different trees. | Hash the judged artifact bytes (or carry a second content hash) so a verdict binds to the artifact, not only the probe vector. | M |
| A1-11 | DROP / HONESTY | `store.ts:863-867` (TODO `A1-17`) | Low | `salvageTrim` bounds only `logs`/`chatLog`; a >localStorage payload whose bulk is `decisions`/`memory`/`artifacts`/`research` can fail both writes, leaving in-memory-only state and a `persistStorageHealth()` warning. | **Degrades durability** of long unattended runs (state lost on reload). | Extend the salvage trim to the checkpoint caps (`checkpoint.server.ts` `CHECKPOINT_CAPS`) from ONE shared caps source. | M |
| A1-12 | SEC / Info | `store.ts:1884-1890`; `dod.ts:157` | Low | The console `approve()` hardcodes `decidedBy:"human"` with no out-of-band token; the minted row has no `[seat …]` tag, so `policyConsistentApproval`'s deliberate `untagged ⇒ true` tolerance accepts it as an approval. CLI/headless are routed through `evaluatePolicy`; the store path is not. | Info: the store IS the console human seat by design, but any scriptable caller of the store action mints human rows (the P0-01 class), so the "human-approved" evidence is not cryptographically attributable on that path. | Route the store approve through `evaluatePolicy("hitl.approve", …)` with the human-seat token, or document the console action as the sole, trusted human seat. | M |
| A1-13 | DRIFT | `wild-review.ts:35-39,95-99` | Info | R14-f01 TODO for "the keyed boundary run's `wild.review (classifier)` evidence + remaining driver threading" remains, though the seam is wired (`createNodeWildReviewer` consumed by `store.ts:1351` / `headless.ts:5381,5587`). | Info: keyless hosts fall back honestly; no fabrication. | Land the keyed evidence run or strike the TODO. | S |

### Not findings (checked, deliberate, do not "fix")
- **`p6-arch` passes vacuously on an absent tree** (`dod.ts:757-760`): intentional keyless-floor skip; the strict bar is `archProductComplete` used by `doctor.productCompleteFromProject`. Removing it would hard-break keyless runs. Leave.
- **`judgment.ts` rung 5 checked before rung 4** (`judgment.ts:236-266`): documented and correct (a "risky pass" must not print as a clean deterministic pass).
- **`oracleToCaseSeeds` claim text** is A1-04 (above), not a second finding.
- **`io.ts:524` "between 0 and 12"** while the check uses `PHASE_COUNT-1`: message drift only if the count ever changes; low enough to fold into A1-07.

---

## 2. Work plan (ordered by severity × leverage)

1. **A1-01 — kill the placeholder acceptance oracle (High).**
   Files: `src/lib/brief-fixtures.ts` (marker + gate), `src/lib/scaffold.ts` (emit path), `src/lib/maker-score.ts`
   (M1/M2 accept only non-sentinel bars), tests `brief-fixtures.test.ts`, `scaffold` tests, `scripts/rapidtool-cli-fixtures.test.mjs`.
   Change: sentinel `"<draft>"`/`"<any>"` cases become non-approvable red cards; the match helper loses its always-true branch.
   Test: a drafted-then-approved placeholder set must NOT satisfy `fixtureApprovalGate` / must score M1=0 with the A1
   vacuity reason. Risk: touches the CLI fixtures contract + an eval-scored path; land with the fixtures tests updated
   in the same change. **Highest leverage on the "machine-verified" claim.**

2. **A1-02 — reconcile the factory claim (High, docs/policy only).**
   Files: `src/lib/doctor.ts` (wording), `README.md`/`AGENT_GUIDE.md` claim text. No gate removal.
   Change: state the machine-complete ceiling beside `awaitingHumanAcceptance`; if a zero-human bar is wanted,
   specify grading against the externally frozen corpus graders. Do not let a machine mint `decidedBy:"human"`.
   Risk: low (claims only), but it is the honest resolution of the mandate's core question.

3. **A1-03 / A1-04 — wire or strike the two unwired seams (Med).**
   Files: `src/lib/engine.ts` (`verifyPriorPhases`), `src/lib/dod.ts` (`oracleToCaseSeeds`/`missingOracleCaseIds`),
   plus the ingest/verify call sites (`store.ts`/`headless.ts`/`verify.server.ts`). Prefer wiring; if not funded,
   delete exports and strike the E-19/E-08 claims in the same change so no comment promises runtime behavior that
   does not exist. Risk: wiring touches the verify loop; strike-only is trivial.

4. **A1-05 — close the four mutation gaps (Med).** Add the four focused tests
   (`wild-step.test.ts`, `engine.test.ts`, `store.test.ts`). Low risk, immediate CI teeth.

5. **A1-06 — console wild plan gate (Med).** `store.ts:1357` refuse start (or fetch a plan) when `staged:false`
   and no stored plan. Risk: console UX; keep the refusal honest and coded.

6. **A1-07 / A1-08 — code the two uncoded failures (Low).** `io.ts` mint `RT_E_IMPORT_TOO_LARGE`; `token-ledger.ts`
   attach `.code`. Small, contract-clean.

7. **A1-09 / A1-11 / A1-12 / A1-10 / A1-13 — as capacity (Low/Info).** Delete or wire dead exports; extend the
   salvage trim; route the store approve through the policy seam; content-hash gate evidence.

**Genuinely not worth doing:** A1-14-style wording nits (none block anything), the `p6-arch` skip, and the
`untagged ⇒ true` legacy tolerance (removing it would retro-fail pre-216o payloads; A1-12 is the scoped fix).
Do **not** "fix" A1-02 by letting the autopilot approve fixtures — that would replace an honest ceiling with a
self-certifying lie.

---

## 3. Coverage statement

**Files audited (read in full):** `src/lib/types.ts`, `phases.ts`, `judgment.ts`, `quarantine.ts`, `io.ts`,
`planning.ts`, `wild-review.ts`, `fixtures.review.ts`, `fixtures.server.ts`, `errors.ts`, `policy.ts`,
`wild-mode.server.ts`, `checkpoint.server.ts`, `engine.ts`, `dod.ts`, `fixtures.ts`, `brief-fixtures.ts`,
`token-ledger.ts`, `doctor.ts`, `scorecard.ts`, `maker-score.ts`, `store.ts`.
**Tests read/pinned:** `engine.test.ts`, `phases.test.ts`, `dod.test.ts`, `judgment.test.ts`, `store.test.ts`
(autopilot/forceHuman sections), `wild-step.test.ts`, `brief-fixtures.test.ts`, `fixtures.test.ts`,
`doctor.test.ts`, `maker-score.test.ts`, and the CLI fixtures test (referenced).
**Static:** `tsc --noEmit` = 0; `eslint` on all slice files = 0.
**Dynamic:** slice suite 579 tests / 0 fail (Node 22.23.2, TAP). Mutation harness: 9 + 5 mutations run; results in
A1-05 (4 not caught) and the table above.
**Not audited / limits:**
- `wild-step.ts` does not exist (only `wild-step.test.ts`).
- Deep behavioural fuzzing of the full 13-phase keyed path was out of scope (0 keyed calls mandated); only the
  keyless/deterministic and injected-seam paths were exercised.
- Cross-module consumers outside the slice (`headless.ts`, `codegen.server.ts`, `scaffold.ts`, `packet.ts`,
  `algorithms.ts`, `sandbox.ts`, `knowledge.ts`, `verify.ts`) were read only at the call sites needed to judge
  slice findings (A1-01/03/04/06/12); those modules' own internals are other auditors' slices.
- The full `npm test` gate was not run (other agents + a keyed eval were in flight), per instruction.

---

## 4. Five most important findings

1. **A1-01 — placeholder acceptance oracle (`brief-fixtures.ts:152,637-638,691-694` + `scaffold.ts:2738-2748`).**
   `draftTypedLiterals` manufactures `{id:"<draft>"}` inputs/expectations, and the emitted oracle matcher returns
   `true` for those sentinels — so an approved fixture set can pass the behavioral TAP while testing only "the export
   returns an object with an `id`". This is placeholder code in the exact artifact the factory calls "machine-verified".
2. **A1-02 — the factory flag is unreachable with zero human input (`doctor.ts:520-523,365-379`).**
   `autonomousSoftwareFactory` requires a `decidedBy:"human"` fixture approval, and `fixtures.approve` is
   human-seat-only by design. The zero-human claim is therefore false by construction; the honest fix is to state the
   ceiling, not to remove the gate.
3. **A1-03/A1-04 — two declared verification seams are unwired (`engine.ts:3620`, `dod.ts:1110,1121`).**
   E-19 regression-drift and E-08 oracle-pinning are documented as consumed by the run but have no production caller;
   a later-phase file mutation can invalidate prior evidence, and seeded oracle cases can be dropped, with no signal.
4. **A1-05 — four load-bearing guards are mutation-invisible (`engine.ts:5137,5220,1813`; `store.ts:542`).**
   Scratch-copy mutations that make the wildStep pause guard, the wildStep priors-sealed guard, the `approveHitl`
   autopilot+forceHuman throw, and `canAutopilot`'s forceHuman exclusion inert all left their suites green.
5. **A1-06 — the console wild driver executes with no plan review (`store.ts:1357,1379`).**
   `stageWildPlan` is a no-op in the browser (no planner, empty `readWildPlan`), so R13-f02's "no execution without an
   approved plan" pin does not hold on the UI path; only the CLI/headless drivers actually generate and stage a plan.

---

# 5. Engineer landing — A1-01 (fixes/344)

**Engineer:** A1 (resumed, engineer mode) · **Root:** `C:\Users\mnril\Desktop\RapidTool Main`
**Owned files only:** `src/lib/brief-fixtures.ts`, `src/lib/scaffold.ts`, `src/lib/maker-score.ts` + colocated tests.
**0 keyed calls. No full gate.** Scratch `$env:TEMP\rt344_a1\`. Runtimes: Node 22.23.2 (`…\hermes\node\node.exe`) and Node 24.15.0.

## 5.1 Design chosen and why

A draft sentinel (`"<draft>"` / `"<any>"`) is now **non-substantive at every layer that could make it an acceptance bar**,
rather than relying on any one of: approval refusal, emit refusal, or matcher removal. The bytes support literal
detection over a persisted marker: `draftTypedLiterals` mints exactly two reserved sentinels, so `fixtureCaseIsPlaceholder`
(`given` or `expect` carries a sentinel) is a complete, deterministic test of "this row asserts nothing real". A new
persisted `placeholder:true` field was rejected because it would ripple through `validateFixtureCase`,
`coerceAcceptanceFixtures`, the engine/io persistence round-trip, and the CLI fixtures contract for no extra coverage.
The human-approval provenance rules are untouched (`approveFixtureCases`/`decidedBy` unchanged — a sentinel row can still
be flipped to `approval:"approved"`, it is simply inert).

Enforcement, all within owned files:
1. `fixtureMatchHelperSource()` — **deleted the always-true branch** (`if (expected === "<any>" || "<draft>") return true;`).
   The emitted partial-match helper now compares a sentinel exactly like any value.
2. `compileFixtureAssertion()` — red-cards a placeholder case; `scaffold.ts` turns a red card into a visible `assert.fail`.
3. `approvedAcceptanceFixtures()` — returns `null` when any approved row is placeholder-only, so the A2 emit guard
   refuses a vacuous set byte-identically to a partial/no-fixture set.
4. `fixtureApprovalGate()` — adds `placeholder`/`placeholderIds`; `ok` is false when any approved row is placeholder,
   so no "functional" claim can rest on sentinels.
5. `maker-score.ts` M1/M2 — `placeholderBarQuestion(project)` reads the project's own `acceptanceFixtures`; when the
   approved bar is placeholder-only it forces **M1=0 and M2=0** with one shared honest sentence, *before* the seat
   question (no decision seat can make a sentinel substantive). This makes the scorer agree with the emit guard even
   without any new driver input.

The real fixture path is unchanged: a fixture with real typed literals still gets `gate.ok=true`,
`approvedAcceptanceFixtures` folds it, `compileFixtureAssertion` compiles, and M1/M2 score 1.

## 5.2 RED → GREEN (real output, both runtimes)

Suites: `brief-fixtures.test.ts maker-score.test.ts scaffold.test.ts` (TAP).

RED (pre-fix), identical on Node 22 and Node 24:
```
not ok 6 - A1-01 — placeholder sentinels are not substantive fixtures
not ok 9 - M2 runs
not ok 27 - A2 — approved fixtures fold into tests/oracle.spec.ts
# tests 209 / # pass 204 / # fail 5
```
Key assertions that red'd: `fixtureApprovalGate(placeholderApproved).ok` expected false got **true**;
`approvedAcceptanceFixtures([placeholder])` expected null got the set; `compileFixtureAssertion(placeholder).ok`
expected false got **true** (the vacuous shape compiled); `m1Substance`/`m2Runs` over a placeholder bar expected 0 got
**1**; the scaffold spec still contained `fx.orc-1` and the matcher carried the `"<draft>"` escape.

GREEN (post-fix), identical on Node 22 and Node 24:
```
# tests 209 / # pass 209 / # fail 0 / # skipped 0
```

Scratch probe (`$env:TEMP\rt344_a1\probe.mjs`, both runtimes byte-identical):
```
gate placeholder: ok=false  placeholderIds=["orc-draft"]      gate real: ok=true
approvedAcceptanceFixtures(placeholder): null (refused)       real: 1 (folded)
compileFixtureAssertion(placeholder): ok=false "placeholder sentinel literal (<draft>/<any>) …"
matcher carries sentinel escape: false
M1/M2 placeholder: 0 / 0 ("…acceptance bar is placeholder-only…")   M1/M2 real: 1 / 1
```

## 5.3 Pins moved

- `src/lib/maker-score.test.ts` (in "M2 runs"): **new** `A1-01: a placeholder-only approved bar cannot score M1/M2 green`
  (pin a) and `A1-01: a real typed-literal bar still scores M1/M2 = 1 (no weakening)` (pin b). Existing 338-4 tests untouched.
- `src/lib/scaffold.test.ts` (in "A2 — approved fixtures fold into tests/oracle.spec.ts"): **new**
  `A1-01: an approved placeholder set is refused at emit — no vacuous fx. test` (pin c); the shared `fx` fixture's
  `expect.value` changed from `{id:"<draft>"}` to the real `{id:"p-1"}` (it was itself a placeholder — the emitted
  assertion could never have failed). `bodyOf` remains the only reader.
- `src/lib/brief-fixtures.test.ts`: **new** describe `A1-01 — placeholder sentinels are not substantive fixtures`
  (gate/emit/compiler/matcher pins); the `compileFixtureAssertion` shape test's expect literal changed `<draft>` → `p-1`.
- No pin moved in `codegen.server.test.ts` (read-only; re-ran green).

## 5.4 Regression counts (both runtimes, Node 22.23.2 / Node 24.15.0)

- Owned suites: **209 / 209 pass, 0 fail** on both; the pre-pin baseline was **203 / 203** (both runtimes).
- Read-only adjacent consumers (not edited): `codegen.server.test.ts` + `headless.test.ts` + `fixtures.test.ts` +
  `doctor.test.ts` + `emitted-honesty.test.ts` = **460 / 460 pass** both; `chat.test.ts` + `store.test.ts` = **176 / 176** both;
  `scripts/rapidtool-cli-fixtures.test.mjs` (the live draft→approve CLI contract) = **4 / 4 pass** both.
- **Not run** (per instruction): full gate / `tsc` / `eslint` / whole-suite.

## 5.5 What remains / STOP-and-REPORT

- **STOP-and-REPORT (message drift, not needed for the fix): `src/lib/headless.ts:3241`.** `driveP6Journey` calls
  `approvedAcceptanceFixtures`; a placeholder-approved set now returns `null` and the journey refuses to converge —
  correct — but it reports `"fixtures pending (<count>)"` although every row is `approved` (the pending list is empty).
  The seam should distinguish "pending" from "placeholder/refused". Left untouched (outside ownership).
- **STOP-and-REPORT (shared derivation): `src/lib/fixtures.ts` `fixtureAcceptanceState`.** It reads only
  `approval`/`decidedBy`, so a placeholder-approved set still reads `state:"human-approved"` there. Not required now —
  maker-score reads the project's `acceptanceFixtures` directly and the emit guard/gate refuse — but a future caller
  building acceptance from the state alone would miss it. A placeholder-aware state would be the durable fix.
- **Unwired in production (pre-existing): `scripts/run-eval.mjs` never passes the `behavioral` evidence** to
  `scoreMaker`, so M1/M2 behavioral re-keying is latent today (the A1-04 class). The fix is correct for when it is wired.
- **Concurrent foreign edits observed, untouched by me:** `src/lib/node-runner.server.{ts,test.ts}` and
  `src/lib/verify.server.{ts,test.ts}` were modified in the working tree by another lane *during* this session (they were
  clean at session start). My diffstat is limited to the six owned files above.
