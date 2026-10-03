# 346 · lane E1 — VERIFICATION & ORACLE COMPLETENESS (fixer log)

**Lane:** E1 (verification & oracle completeness). **Base:** `main` @ `988b158`.
**Scope (STRICT, owned):** `src/lib/codegen.server.ts`, `src/lib/headless.ts`, `src/lib/scaffold.ts`,
`src/lib/compile-check.server.ts`, `src/lib/brief-fixtures.ts`, `src/lib/verify.server.ts`,
`src/lib/node-runner.server.ts`, + their colocated tests. **Keyed LLM calls: 0** (all model
transport is a `globalThis.fetch` stub; the 2 headless/codegen tests that reach an LLM stub the key
and the wire). **Scratch:** `%TEMP%\rt346_e1\`. **No tracked-file deletion.**

> Note: the working tree carries concurrent edits from neighbouring lanes (40 files / ~1.9k lines at
> read time). No file outside the ownership list above was modified by this lane. Within the ownership
> list, `src/lib/node-runner.server.ts` + `node-runner.server.test.ts` carry a **neighbouring lane's**
> `fixes/346 A2-F6` redaction edit (xAI/Tavily key prefixes) — left untouched here; the owned
> `node-runner.server.test.ts` suite is green over it on both runtimes.

---

## 1. Items

| # | Item | file:line | Result |
|---|------|-----------|--------|
| 1 | **A1-04** — E-08 oracle pinning dead (callers never pass the seeds) | `codegen.server.ts:169,3421–3437,4694`; `headless.ts:47,4295–4301` | **FIXED** (feed wired; `dod.ts` claim → STOP-and-REPORT) |
| 2 | Tree-lane oracle shape-only (tree-job rows + tree-run evidence) | `scaffold.ts:2595–2603`; `compile-check.server.ts:327,1081,1195,1288–1300`; `codegen.server.ts:5493–5536` | **FIXED** |
| 3 | **L1-F4** — `moduleEmbedded` true for an empty `generatedSource` | `headless.ts:2457–2460` | **FIXED** |
| 4 | **L1-F5** — empty `expect.shape {}` near-vacuous | `brief-fixtures.ts:685,702,722` | **FIXED** |
| 5 | **L1-F3** — `runSpecFile` trusts a zero exit | `compile-check.server.ts:1081,1277,1291` | **FIXED** |
| 6 | **L2-X4** — verdict-channel failure mislabeled `NO_CALLABLE_EXPORTS_REASON` | `verify.server.ts:799,808,1054` | **FIXED** |

---

## 2. Per-item detail (RED → GREEN, both runtimes)

Runtimes: **host v24.15.0** (`node`) and **Node 22.23.2** (`%LOCALAPPDATA%\hermes\node\node.exe`),
both `--experimental-strip-types --test --test-reporter=tap`.

### Item 1 — A1-04: feed the E-08 oracle seeds + pinned ids

**Change.** `codegen.server.ts` now imports `oracleToCaseSeeds` from `dod.ts`; `P6SynthesisDeps.verify`'s
`opts` is widened with `seeds?: string` / `pinnedOracleIds?: readonly string[]` (additive); the single-module
verify call at `:4691` passes `seeds: oracleToCaseSeeds(project.oracle)` + `pinnedOracleIds: project.oracle.map(o => o.id)`.
`headless.ts` `verifyGeneratedSource` passes the same two to `verifyAndFixServer`. Empty/absent oracle ⇒ the
legacy no-seed bytes (byte-parity). The CLI `verify` path routes through `h.verifyGeneratedSource` (`rapidtool-cli.mjs:3201`), so it is covered too.

**RED (Node 24).** `codegen`: stub verify calls recorded, `seen.seeds` undefined → `not ok 1 … "the rendered A7 seed block is fed"`, `# pass 0 # fail 1`.
`headless`: fetch-stub captures the generation prompt, no seed block → `error: 'the E-08 seed header is present'`, `not ok 1 … # pass 0 # fail 1`.

**GREEN (both runtimes).** `A1-04` pattern over `codegen.server.test.ts` + `headless.test.ts`:
`ok 1 … ok 2 … # tests 2 # pass 2 # fail 0` on v24.15.0 and v22.23.2.

**Pins added.** `codegen.server.test.ts` "346 E1 A1-04: feeds the verify seam the A7 oracle seeds + pinned ids"
(spy records the opts: `seeds === oracleToCaseSeeds(base.oracle)`, `pinnedOracleIds` deep-equals the ids).
`headless.test.ts` "346 E1 A1-04 - verifyGeneratedSource feeds the A7 oracle seeds" (asserts the captured
prompt carries `PINNED A7 ORACLE ROWS (E-08)` + a `# <id> ` line for every row, and the run still passes).

### Item 2 — tree-lane behavioural assertion + tree-run evidence

**Change (scaffold).** `scaffold.ts:2586` tree-job row: the guarded probe no longer swallows every
non-`ReferenceError` throw. It now assigns `__jobOutcomeOk` (return is not `NaN`, or the throw is an
`Error`) and emits `assert.equal(__jobOutcomeOk, true, …)` — ≥1 behavioural assertion; the L1-F2 `() => NaN`
stub shape now fails the row.

**Change (compile-check).** New pure `specSourceHasBehaviouralAssert(source)` (masked source; classifies each
`assert.*` — `ok`/`notOk` reject bare presence + typeof/length/`Array.isArray`; the equality family is
behavioural only when it ties a module read to a concrete value (a number, boolean, masked string, or
object/array literal) — a literal tautology, a presence comparison, and a type/length marker are NOT
behavioural; `throws`/`rejects`/`match` are call-outcome and always behavioural). *(Corrected post-pause
under SB-2 — the first cut accepted literal tautologies/presence operands; see §6.)*
`runSpecFile` now requires it (a shape-only spec → `run:"fail"`, `behavioural:false`, detail
`"no behavioral assertion ran"`); a pass sets `behavioural:true`. `TreeSpecVerdict.behavioural?: boolean` added.

**Change (codegen evidence).** `treeRunTestedEvidence` computes `behaviouralSpecs = specs.filter(t => t.behavioural !== false)`
and requires `behaviouralSpecs.length > 0` for `executed`. An **absent** field is treated as legacy-counted, so
the existing pinned hashes (`2834449053`, `3655235467`) keep their bytes; `runSpecFile` always sets the field on
real runs, so a shape-only tree-run cannot mint `tested`.

**RED (Node 24).** With the scaffold hunk stashed and the compile-check gate temporarily reverted to the old
`specSourceHasAssert`: `not ok 1 - 346 E1 item 2 - a shape-only spec is not a behavioural pass`,
`not ok 2 - scaffoldProject …` (`error: 'the emitted row asserts the call outcome'`), `# tests 4 # pass 2 # fail 2`.
The codegen evidence test separately: `shape-only cannot certify tested` → `# fail 1`.

**GREEN (both runtimes).** item-2 pattern over `compile-check.server.test.ts` + `scaffold.test.ts`:
`# tests 4 # pass 4 # fail 0` on both. Codegen evidence test `# tests 1 # pass 1 # fail 0`.

**Pins added.** `compile-check.server.test.ts`: classification unit test; `treeRun` integration over a shape-only
spec (run=fail, `behavioural:false`, detail exact) and a behavioural spec (run=pass, `behavioural:true`, tree ok).
`scaffold.test.ts`: the emitted tree-job row carries `assert.equal(__jobOutcomeOk, true,` + `Number.isNaN(__jobResult)`,
and the whole emitted `tests/oracle.spec.ts` satisfies `specSourceHasBehaviouralAssert`.
`codegen.server.test.ts`: shape-only `behavioural:false` spec ⇒ `executed:false`; mixed ⇒ `true`; absent field ⇒ legacy `true`.

### Item 3 — L1-F4 (`moduleEmbedded`)

**Change.** `headless.ts:2457`: `embeddedSource.length > 0 && files.some(f => f.body.includes(embeddedSource))`
(was `includes("")`, always true).

**RED (Node 24).** `not ok 1 - L1-F4: a project with no generated module reports moduleEmbedded false`
(`no module bytes were emitted to embed`, expected `false`, actual `true`); `# pass 0 # fail 1`.
**GREEN (both runtimes).** `ok 1 … # tests 1 # pass 1 # fail 0` on v24.15.0 and v22.23.2.
**Pin added.** `headless.test.ts` in the A7 emitProject describe.

### Item 4 — L1-F5 (empty `expect.shape`)

**Change.** `brief-fixtures.ts`: new exported `fixtureShapeValueIsVacuous(v)` (`{}` / `[]`);
`fixtureCaseIsPlaceholder` folds it in (so the approval gate / doctor / maker-score name the same bar);
`compileFixtureAssertion` red-cards it with a precise reason before the sentinel check.

**RED (Node 24).** `SyntaxError: The requested module './brief-fixtures.ts' does not provide an export named 'fixtureShapeValueIsVacuous'`; `# pass 0 # fail 1`.
**GREEN (both runtimes).** `L1-F5` block: `# tests 4 # pass 4 # fail 0` on both.
**Pins added.** `brief-fixtures.test.ts` "346 E1 L1-F5 — an empty expect.shape is near-vacuous and refused"
(4 tests: predicate, approval gate, `approvedAcceptanceFixtures`/compile red-card, non-empty control).

### Item 5 — L1-F3 (zero-exit trust)

**Change.** New pure `specExitIsGreen(status, summary)` = `status === 0 && summary !== null && summary.fail === 0 && summary.cancelled === 0`;
`runSpecFile`'s pass branch now keys on it, and a zero-exit-with-fail surfaces `exit 0 but TAP reported N failing test(s)`.

**RED (Node 24).** `SyntaxError: … does not provide an export named 'specExitIsGreen'`; `# pass 0 # fail 1`.
**GREEN (both runtimes).** `L1-F3` block: `# tests 4 # pass 4 # fail 0` on both.
**Pin added.** `compile-check.server.test.ts` "346 E1 L1-F3 - specExitIsGreen …" (clean / fail / cancelled / non-zero / null summary).

### Item 6 — L2-X4 (verdict-channel classification)

**Change.** `verify.server.ts`: new exported `VERDICT_CHANNEL_FAILED_REASON` (carries `RT_E_RUNNER_FAILED`)
+ pure `verdictChannelFailed(sawExports, sawCompile)`; `runCases` returns this reason when the authenticated
channel delivered neither `HARNESS_EXPORTS` nor `HARNESS_COMPILE` — before the `!callables` check that used to
mislabel it `NO_CALLABLE_EXPORTS_REASON`.

**RED (Node 24).** `SyntaxError: … does not provide an export named 'VERDICT_CHANNEL_FAILED_REASON'`; `# pass 0 # fail 1`.
**GREEN (both runtimes).** `L2-X4` block: `# tests 2 # pass 2 # fail 0` on both.
**Pin added.** `verify.server.test.ts` "346 E1 L2-X4 — a verdict-channel failure is not a module defect"
(classifier truth table + distinct coded reason).

---

## 3. Owned-suite gate (both runtimes)

```
v24.15.0 : # tests 719  # pass 718  # fail 0  # skipped 1
v22.23.2 : # tests 719  # pass 718  # fail 0  # skipped 1
```

Suites: `codegen.server.test.ts`, `headless.test.ts`, `scaffold.test.ts`, `compile-check.server.test.ts`,
`brief-fixtures.test.ts`, `verify.server.test.ts`, `node-runner.server.test.ts`. Baseline before this lane was
**701 / 700 pass / 0 fail / 1 skipped** on both; **+18 tests** added, all green. Neighbouring checks re-run
because they pin the changed seams: `verify.test.ts` 60/60 and `wild-step.test.ts` 35/35 (the `3655235467`
tree-run evidence hash pin), plus the direct consumers of the changed predicates —
`doctor.test.ts` + `maker-score.test.ts` 155/155 (`fixturesHavePlaceholder`) and
`emitted-honesty.test.ts` + `sweep73-fuzz.test.ts` 57/57 (the emitted `oracle.spec.ts`) — all green on both
runtimes. No existing gate or pin was weakened.

## 4. STOP-and-REPORT (not owned)

1. **`src/lib/dod.ts:1113-1120`** — the E-08 comment block still asserts the pinning is **DORMANT** / "nothing
   here claims a live consumer", naming `headless.ts verifyGeneratedSource` and `codegen.server.ts defaultDeps.verify`
   as non-forwarders. That is now **stale**: both call sites forward `oracleToCaseSeeds(project.oracle)` +
   the pinned ids. `dod.ts` is not owned by this lane — the owner must update/strike the claim.
2. **`fixes/345_0_parent.md` §5** — the open item "A1-04 caller feeds" is now closed by this lane.
3. **`src/lib/verify.ts:42`** — the client seam (`verifyAndFix` `createServerFn` handler) still calls
   `verifyAndFixServer` with no `seeds`/`pinnedOracleIds`. It has only `{source, brief}` in scope (no
   `Project`/`oracle`), so E-08 cannot be wired there without widening the UI/Oracle-tab contract. Reported,
   not changed (out of ownership and a contract decision).
4. **Typecheck not run** (rule: no full gate while neighbours are mid-edit). The two `src` type changes are
   additive: `TreeSpecVerdict.behavioural?: boolean` and the widened `P6SynthesisDeps.verify` `opts`. Consumers
   are codegen/headless + tests only.

## 5. Remaining (honest)

- The tree-lane tree-job behavioural probe is deliberately modest: it observes the call outcome (usable return
  that is not `NaN`, or a well-formed `Error`), because the A7 row's `given ⇒ expect` is prose and cannot be
  machine-translated at emit time. Row-specific behavioural cases remain the P6 single-module oracle's job
  (`verify.server.ts generateCases`). It closes the "weakest assertion" hole (a shape-only spec no longer earns
  `tested`) without false-reddening a genuinely behavioural module.
- L1-F3 remains latent-until-forced: no producer in the repo exits 0 with a TAP `# fail N`, so the guard is
  defense in depth, pinned at the pure `specExitIsGreen` seam rather than reproduced through a real child.
- A1-04 is closed for the codegen + headless + CLI paths; the browser `verify.fix` seam (stop #3) remains.

---

## 6. Post-pause completion — SB-2 (tree-lane behavioural parity)

V1 refuted the item-2 sentence above: the tree-lane equality classifier counted literal tautologies and bare
presence operands as behavioural (`assert.equal(1, 1)`, `assert.equal(true, true)`, `assert.equal(undefined,
undefined)`, `assert.equal(x, undefined)`, `assert.notStrictEqual(ep, null)`), while the oracle lane rejects
the equivalent `1 === 1`. Fixed after the wave resumed.

**Change (`compile-check.server.ts`).** `assertionIsShapeOnly` now mirrors the oracle-lane rule
(`verify.server.ts behaviouralOracleExpression`):
- `ok`/`notOk` reject a bare read, a shape marker, **and** an expression with no module read at all
  (`assert.ok(1 === 1)`).
- the equality family is behavioural **only** when one operand is a module read (an identifier that is not a
  pure literal — `{a: 1}` is a literal, not a read) and the other is a concrete expected value (number,
  boolean, masked string literal, or an object/array literal). A literal tautology, a bare
  `null`/`undefined`/`void 0` operand, and a type/length marker are shape-only.
- the module doc comment and the item-2 sentence above were corrected.

**RED (host v24.15.0).** The new classifier pins are red pre-change (the eight forms classify `true`). Both
the comma-in-a-tag and the NUL/`|` pins are red against the committed pre-fix `knowledge.ts` baseline too
(see E2 §SB-1).
**GREEN (both runtimes).** `compile-check.server.test.ts` **96 tests · 95 pass · 0 fail · 1 skipped** on
v24.15.0 and v22.23.2. Consumers re-run: `scaffold.test.ts` + `codegen.server.test.ts` +
`emitted-honesty.test.ts` **308/308**; `wild-step.test.ts` + `sweep73-fuzz.test.ts` + `verify.server.test.ts`
**187/187**.

**Pins added.** `346 SB-2: literal tautologies and presence-only operands are not behavioural` (eight
true-negative forms + two real-module controls, incl. `assert.deepEqual(JOBS, ["a"])`); `346 SB-2: treeRun
refuses a spec whose only assertion is a literal tautology` (`run:"fail"`, `behavioural:false`, detail exact).
The shared `PASSING_SPEC` fixture and the `purity` fixture now carry a genuine behavioural assertion (a read
tied to a concrete value) so their tree-run stays green — the previous vacuous filler was exactly the defect.
The emitted-spec shapes stay behavioural: `assert.deepEqual(JOBS, [...])` / `assert.deepEqual(ENDPOINTS, ...)`
tie a module read to an object/array literal, so real scaffolded projects are unaffected.
