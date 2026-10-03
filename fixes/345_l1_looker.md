# 345 — LOOKER 1: adversarial hunt of the whole trust chain

**HEAD:** `06cb089`. **Mode:** READ-ONLY (only write is this log). **Keyed calls: 0.** Scratch: `%TEMP%\rt345_l1\`.
**Not re-reported (already fixed):** A2-F1 verifier marker forgery (now on the fd-3 nonce channel) and A1-01 placeholder acceptance oracle.

**Method.** Read the bytes of the verification, emit/land, eval/score and packet chains; for each
candidate wrote a probe under `%TEMP%\rt345_l1\` and attempted a real reproduction. Theories that did
not reproduce are logged as **unproven** and marked.

**Verdict up front.** The fd-3 rebuild is sound — I could not re-forge a verdict, and the
gate/mint/floor structure is unusually honest. The strongest remaining "claim more than earned" is
**oracle self-certification**: the same model authors the implementation *and* the cases, and a module
whose only export returns `NaN` earns a genuine `status:"passed"` → `lastTest {label:"tested"}` via a
case that merely *calls* the export (`boardAdd(1) !== null`). Two concrete byte-level gaps follow
(caller-manifest trust in the land seam; a false `moduleEmbedded` claim), plus latent hardening items.

---

## 1. Findings table

| id | class | file:line | sev | reproduction | why it breaks the trust chain | recommended fix | effort |
|----|-------|-----------|-----|--------------|-------------------------------|-----------------|--------|
| **L1-F1** | Land seam trusts the caller's manifest — "emitted files only" is not enforced | `git.server.ts:1565` (`gitLandEmitted`), `:1685-1688` (`git add -- …manifest.files`), `:1699-1700` (`foreign = untracked.filter(p => !manifestSet.has(p))`), `:1495` (`normalizeManifest` checks shape only) | **Med** | `probe-land-manifest.mjs`: emitted dir with `.rapidtool/project.json` + `index.ts` + a never-authored `backdoor.sh`; call `gitLandEmitted(…, { files: [".rapidtool/project.json","index.ts","backdoor.sh"] })` → `ok:true committed:true`, `files:[…,"backdoor.sh"]`, `foreign:[]`, and `git ls-files` = all three. The docblock and CLI help (`rapidtool-cli.mjs:5034`) promise "a foreign file is reported, never committed". | The seam verifies the dir carries an emitted record but never binds the manifest to that emission. Any caller (or future caller) passing a superset manifest silently commits bytes the factory never authored — a delivery tree that is not the emitted tree. | Bind the manifest to the emit: have `emitProject` record the emitted path list (or a manifest hash) in `.rapidtool/project.json`, and require `gitLandEmitted`'s `files` to be an exact subset/match of it; or refuse any manifest path not present in the emitted record. | S |
| **L1-F2** | **Oracle self-certification — machine-verified can be earned by shape-only cases** (same model writes code and cases) | `verify.server.ts:1259` (`oracleBriefGrounded`), `:1038-1058` (runCases reference gate), `:1079` (`calledIdentifiers`); `scaffold.ts:2586-2593` (tree-job rows: shape-only + swallow non-ReferenceError) | **Med** | `probe-weak-oracle.mjs` (keyless, fetch-stubbed): module `exports.boardAdd = function(){ return NaN; }` + model case `boardAdd(1) !== null` → `verifyAndFixServer` `STATUS = passed`, `EVIDENCE = 1/1 machine-run cases passed`, and `applyVerifyOutcome` mints `lastTest {label:"tested", evidenceHash:"813174017"}`. The T-02 gate requires a *call* to a brief-noun export — not a behavior assertion — so a stub satisfies it. | "Machine-verified" is the factory's headline claim; here it is earned by an API-shaped stub with a model-authored case that cannot fail. If the cases are weak (or the model is the same one that wrote the code and thus blind to its bug), a broken product seals. Correlated-error self-certification. | Require oracle substance beyond a call: ≥1 case per declared requirement/typeSignature whose expression constrains the return (not just `typeof`/`!== null`/`!== undefined`); reject a case set where every case is shape/identity-only; the tree-job rows should not swallow non-ReferenceError throws as a pass. Keep the existing gates. | M |
| **L1-F3** | `runSpecFile` trusts exit status 0 and never checks `summary.fail` | `compile-check.server.ts:1151-1172` | **Low (latent, unproven)** | Not reproduced. The success branch requires `status === 0` plus `specSourceHasAssert` and `summary.pass>0`/`tests>0`, but never `summary.fail === 0`. I tried to force `status 0` with a failing test via `process.on("exit"/"beforeExit")` (`fail0.spec.mjs`, `fail0b.spec.mjs`) — Node kept exit 1. Production generated modules cannot reach `process` (`validateSynthesisModule` forbids it) and factory specs do not do this, so it is not currently reachable. | If any future producer makes a spec exit 0 with `# fail N`, the tree reads GREEN and can mint `tested`. A one-line hole in an otherwise fail-closed verdict. | Add `(summary?.fail ?? 0) === 0` (and `cancelled === 0`) to the success condition; defense in depth. | XS |
| **L1-F4** | `moduleEmbedded` false-positive claim | `headless.ts:2457` (`files.some(f => f.body.includes(emitProjectInput.generatedSource ?? ""))`) | **Low** | `probe-moduleembedded.mjs`: `emitProject(seedProject({generatedSource:"", generatedTree:[]}), dir, {redTree:"probe"})` → `emit ok:true, moduleEmbedded:true`, `generatedSource length = 0`. `String.includes("")` is always true. Surfaced on the CLI envelope (`rapidtool-cli.mjs:2022`). | Operator-facing claim that the emitted tree embeds the generated module, for a project with no module at all. No gate consumes it (and W35 already logged the sibling false-negative), but it is a claim the bytes do not support. | Guard for a non-empty `generatedSource` before the `includes`, or compute against the actual emitted entry file. | XS |
| **L1-F5** | Near-vacuous but non-sentinel shape fixture | `brief-fixtures.ts:743-752` (`shape`) + `:765-774` (`__fxPartialMatch`) | **Low** | By inspection + `fixtureCaseIsPlaceholder` (`:686`): an approved fixture `expect:{kind:"shape", value:{}}` is NOT flagged (no sentinel string), and `__fxPartialMatch(actual, {})` returns true for any object actual. So an empty-shape row asserts only "returns an object". | A1-01 removed the `<draft>`/`<any>` escape hatch, but an empty (or all-optional) shape value remains a near-always-true assertion that is not caught by the sentinel scan. | Reject `expect.shape` with an empty object value (no typed leaf) in `compileFixtureAssertion` / `fixtureCaseIsPlaceholder`. | XS |
| **L1-F6** | Stale-state observation (not a clear overclaim) | `codegen.server.ts` `refuse()` (leaves `lastTest`/`generatedTree`), `headless.ts:2203` (`treeRunTrail`) | **Info / unproven** | Reasoning, not reproduced as an overclaim: a *synthesis* refusal logs no `p6.tree.failure`, so a project that was previously verified keeps its green trail + `tested` stamp and can still be emitted (delivering the last-known-good tree). If a refused re-synthesis is followed by emit, the delivered bytes are the earlier verified set, not the failed attempt. | Not established as a false claim (the earlier tree was genuinely verified, and the refusal is in the logs). Listed for completeness. | Optional: on a refused synthesis, record a scoped "latest attempt refused" note the emit/land surfaces. | — |

**Probes (all keyless):** `%TEMP%\rt345_l1\probe-land-manifest.mjs` (F1), `probe-weak-oracle.mjs` (F2),
`probe-moduleembedded.mjs` (F4), `fail0.spec.mjs` / `fail0b.spec.mjs` (F3 attempts).

---

## 2. The five most important (with evidence)

1. **L1-F2 (Med) — a broken module earns a genuine `tested` stamp.** `probe-weak-oracle.mjs`
   (fetch-stubbed model transport; no keyed call):
   ```
   module:  exports.boardAdd = function () { return NaN; };
   case:    boardAdd(1) !== null            // calls the export, asserts nothing behavioral
   => verifyAndFixServer: STATUS = passed; EVIDENCE = 1/1 machine-run cases passed on iteration 1
   => applyVerifyOutcome: lastTest {"ok":true,"label":"tested","evidenceHash":"813174017"}
   ```
   The T-02 gate (`oracleBriefGrounded` → `calledIdentifiers`) requires a *call* to a brief-noun
   export; it does not require the case to constrain the result. Because the same model authors the
   implementation and the cases, "machine-verified" can be true of a stub.
2. **L1-F1 (Med) — the land seam commits a never-authored file named in the caller's manifest.**
   `probe-land-manifest.mjs`: `files:[".rapidtool/project.json","index.ts","backdoor.sh"]` →
   `ok:true`, `foreign:[]`, `git ls-files` includes `backdoor.sh`. The documented guarantee ("a foreign
   file is reported, never committed") holds only for files absent from the manifest; the manifest
   itself is unverified against the emit. The production CLI is honest here
   (`rapidtool-cli.mjs:2206` passes `res.files`), so this is a seam-level hardening gap.
3. **L1-F3 (Low, latent) — `runSpecFile` reads exit 0 as green without checking `summary.fail`.**
   `compile-check.server.ts:1151-1172`. I could not reach it (Node kept exit 1 under exit-handler
   overrides; generated modules cannot use `process`), so it is **unproven** as an exploit — but the
   one-line guard is cheap defense in depth for the exact class the 344 wave was about.
4. **L1-F4 (Low) — `moduleEmbedded:true` for an empty module.** `probe-moduleembedded.mjs`:
   `generatedSource` length 0 → `moduleEmbedded:true` (the `includes("")` tautology), surfaced at
   `rapidtool-cli.mjs:2022`.
5. **L1-F5 (Low) — an empty `expect.shape` value slips past the A1-01 sentinel scan** and compiles to a
   near-always-true partial match (`__fxPartialMatch(actual, {})`).

---

## 3. What I attacked and could **not** break (real evidence too)

- **The fd-3 verdict channel (A2-F1 fix).** No leak path found: the nonce is read from stdin at the
  top of the harness IIFE before the module runs; the module cannot read fd 0 (already drained) or fd 3
  (write end), the nonce is not in the `-e` source, argv or env, and the harness captures `fs.writeSync`
  before the module runs. Even a hypothetical nonce leak is neutralized: `HARNESS_EXPORTS`/`HARNESS_COMPILE`
  are first-wins (a duplicate sets `forged`), and a duplicate `ORACLE_RESULT` id also sets `forged`.
  A module printing `ORACLE_RESULT` to stdout is treated as impersonation and fails the run.
- **`applyVerifyOutcome` mint** (`verify.ts:184-222`): a `passed` envelope with absent/empty `cases`,
  no runnable expression, or no `finalSource` is a no-op; dedupe is hash-keyed. Could not mint `tested`
  from a hollow outcome.
- **`p6-verified` / `M4`** (`dod.ts:683-703`, `maker-score.ts:590-609`): both require
  `ok && detail && label==="tested" && evidenceHash`; the M3 "derived convergence" path requires a
  passed gate + `lastTest.ok`. Could not satisfy either from a record without a real run.
- **`parseWrapperEnvelope`** (`compile-check.server.ts:1022-1041`, `lastIndexOf('{"kind":')`): a spec's
  lookalike envelope is captured inside the wrapper's JSON `tail` and therefore JSON-escaped
  (`{\"kind\":`), so it cannot displace the wrapper's own last-written envelope; the wrapper envelope is
  also preserved by the last-1 MB stdout slice.
- **`runSpecFile` no-assert / no-TAP-pass gate** (`:1159-1170`): skip-only and load-only specs are
  refused (`summary.pass===0`/`tests===0` or no `assert.` in source). A spec that forces exit 0 with a
  failing test did not reproduce (see L1-F3).
- **`sanitizeOracleExpression`** (`verify.server.ts:340-497`): could not smuggle statements/arrows/
  template literals/`function`/`eval`/`constructor`/`__proto__` past the gate; the declaration-prefix
  repair drops the prefix and refuses a final that reads a bound name.
- **`treeRunTrail` treats `p6.tree.tested.skipped` as green** (`headless.ts:2217-2220`): consistent, not
  a hole — the event is emitted by `mintTreeRunTested` only when `outcome.ok === true` (an ok tree-run
  that merely executed no specs), so "green" describes the tree-run, which is exactly what the emit
  refusal is about.
- **`gitLandEmitted` host-repo refusal / foreign-not-committed** (`git.server.ts:1610-1640`,
  `:1699-1700`): could not land into the RapidTool repo, a nested work tree, or a foreign `.git`; files
  absent from the manifest are reported, not committed. Only the manifest-inclusion path (L1-F1) bites.
- **`normalizeManifest`** (`:1495-1513`): rejects `..`, absolute, drive-letter, backslash, NUL and empty
  segments — no traversal.
- **Quarantine** (`quarantine.ts`): refuses escapes, reports missing/failed, never deletes; a failed
  move makes `emitProject` return `RT_E_FOREIGN_FILES` + `judgingSkipped`.
- **Emit red-tree refusal** (`headless.ts:2360-2371`): a `p6.tree.failure` with no green since refuses
  with `RT_E_TREE_RUN_FAILED`; `p6.journey.converged` requires `gate.passed === true`
  (`headless.ts:3268-3279`).
- **Eval/score**: graders are run-side, frozen and leak-scanned; M1/M2 refuse a placeholder-only bar
  (`maker-score.ts` A1-01 helpers) and a bar without a human acceptance decision; the keyless/refused
  floor forces M1–M4 to 0 (`maker-score.ts:244-266`). Could not score a floor run above the corpus bar.
- **Typed-strip path** (`verify.server.ts:696-710`): parse-first returns bytes verbatim when the JS
  parser accepts; the harness compiles the same stripped bytes it runs, and `validateSynthesisModule`
  forbids the primitives on the original. No divergence found.

## 4. Coverage

**Read:** `verify.server.ts` (fd-3 harness, sanitizer, runCases, generateCases), `verify.ts`,
`node-runner.server.ts` (verdict channel), `compile-check.server.ts` (compile/spec/entry/behavior/
project legs, treeRun, treeVerdictHash), `dod.ts` (p6-test/p6-verified), `maker-score.ts` (M1–M7),
`headless.ts` (emitProject, treeRunTrail, materializeEmitTree, driveP6Journey), `scaffold.ts`
(`emitOracleSpec`, capability section, fixtures section), `brief-fixtures.ts`, `quarantine.ts`,
`git.server.ts` (gitLandEmitted + helpers), `packet.ts` (P6 verification line), `scripts/run-eval.mjs`
(grader parse/freeze), `scripts/rapidtool-cli.mjs` (emit --git / --require-verified wiring).
**Keyless probes:** 4 (results above) + 2 exit-code attempts. **Not run:** the full gate / `npm test`.

---

# FIXER — L1-F2 closed (345 wave, same agent)

**Ownership honoured:** only `src/lib/verify.server.ts` and `src/lib/verify.server.test.ts` were edited
(+248 / +178 lines; no other file touched). Scratch: `%TEMP%\rt345_l1\`. **0 keyed calls** (all model
transports injected via the `globalThis.fetch` stub). No full gate run.

## 5. Design and why

The defect is self-certification: the oracle is authored by the same model that wrote the module, and a
set of presence/type cases (`typeof add === "function"`, `boardAdd(1) !== null`, `!== undefined`)
certifies nothing. T-02 (`oracleBriefGrounded`) required a *call*, not a behavioural constraint.

The fix adds a **deterministic behavioural-assertion floor** at the authoring/commit seam
(`generateCases`), plus a prompt requirement:

- **`behaviouralOracleExpression(expression)`** (new export) — a pure classifier. A case is behavioural
  iff one `&&`/`||` fragment ties a **module read** (call or identifier/property read that is not a
  language literal) to a **concrete expected value** (masked string literal, number, or `true`/`false`)
  via `===`/`!==`, or applies a relational predicate (`>`,`<`,`>=`,`<=`) to a module read. A `typeof`
  fragment is a type check and is never behavioural. `null`/`undefined`/`void 0` are deliberately
  **not** concrete, so `f(x) !== null` (the exact defect form) is shape-only. Masking replaces each
  string literal with a non-identifier marker (so a concrete string expectation is detectable while
  quoted prose can never look like an operand); comments are blanked; the `declaration(s); final`
  tolerated repair is classified at its FINAL statement only (the prefix is discarded by the sanitizer).
- **`shapeOnlyOracleCaseIds(cases)` / `oracleHasBehaviouralCase(cases)`** (new exports) — the set view.
- **The gate in `generateCases`** — after the existing name-binding gate (so a name repair keeps
  priority) and before the brief-grounding gate: if no case is behavioural, **ONE bounded repair
  re-prompt** (budget-metered via `runBudgetedCall`, merged by id so no case — pinned or otherwise — is
  dropped) demanding a behavioural assertion; if the set is still shape-only, a coded
  `RT_E_VALIDATION` refusal naming the offending ids. It **never** returns a pass.
- **The prompt** (`buildOracleCasesPrompt`) now carries a `BEHAVIOURAL ASSERTION REQUIRED` block before
  the grounding line, with worked examples and the explicit instruction that if the brief defines no
  observable result for a name, that gap must be **stated in the case, not certified by shape** — the
  mandated "say so explicitly and record it". The refusal message records the same.
- **Nothing weakened:** every existing gate is untouched and still runs (callable inventory,
  no-export-reference, vacuous-brief grounding, pinned-id, forged-id, budget, typed-strip, fd-3
  verdict channel). The new gate only *adds* a refusal; it never relaxes one.

**Why unconditional (no pass escape hatch):** a pass mints `lastTest {label:"tested", evidenceHash}`
→ `p6-verified` → the factory's "machine-verified" claim. No reachable legitimate state has *only*
shape to offer: even a data-only export supports `X.prop === v`, and a callable supports
`f(...) === <value>` or `f(...).length === n`. Where the brief states no observable result, the refusal
records the gap explicitly rather than certifying it — which is the honest outcome.

## 6. RED → GREEN (real before/after, both runtimes)

**RED (host Node v24.15.0, before the fix):** `node --test --test-name-pattern="shape-only"` →
`# tests 5 / # pass 2 / # fail 3`; the e2e assertion printed the defect verbatim:
`a shape-only oracle must not pass: {"status":"passed","iterations":1,"evidence":"1/1 machine-run cases passed on iteration 1",...,"lesson":{"id":"lesson-verified-procedure-8d5a26db",...}}`.

**External probe (before):** `probe-weak-oracle.mjs` (module `exports.boardAdd = () => NaN`, case
`boardAdd(1) !== null`) → `STATUS = passed`, `EVIDENCE = 1/1 machine-run cases passed on iteration 1`,
`lastTest = {"ok":true,"label":"tested","evidenceHash":"813174017"}`.

**GREEN (after):** same probe → `STATUS = error`;
`EVIDENCE = oracle case set is SHAPE-ONLY: no case constrains an exported result beyond presence/type
(case id(s): c1). … refused — never a machine pass on a self-certifying oracle. …`;
`lastTest = undefined` (no `tested` stamp).

**Control (behavioural still passes):** `add(2,3) === 5` → `generateCases` commits with **1** model call
(no repair); the mixed set `[typeof add === 'function', add(2,3) === 5]` also commits with 1 call. e2e
control `exports.add = (a,b) => a+b` + `add(2,3) === 5` → `status:"passed"` and `lastTest.label =
"tested"` (unchanged).

## 7. Regression counts (before/after, both runtimes)

| suite | host Node v24.15.0 | Node v22.23.2 | role |
|---|---|---|---|
| `src/lib/verify.server.test.ts` (owned) | **98 pass / 0 fail** (post-fix full suite); the RED-first filtered run pre-fix was **2 pass / 3 fail** (`--test-name-pattern="shape-only"`) | **98 pass / 0 fail** | the fix + classifier table + e2e |
| `src/lib/codegen.server.test.ts` (read-only consumer) | **224 pass / 0 fail** | **224 pass / 0 fail** | harness/pipeline consumer |
| `src/lib/verify.test.ts` (consumer, sanity) | **60 pass / 0 fail** | — | exports unchanged (additive only) |

New owned tests: 5 red-first refusal/repair/control tests, 22-entry classifier table (11 behavioural +
9 shape-only + hostile-input + set-view). No existing test expectation was weakened; one payload was
changed from a literal-only `1 === 1` to `x === 1` in the prompt byte-parity test (its subject is the
prompt bytes, not the payload) with an explanatory comment. `LEGACY_PROMPT` was updated deliberately
for the new prompt lines.

## 8. What remains uncaught (honest)

1. **The tree lane's oracle is separate and still shape-leaning** — `scaffold.ts` `emitOracleSpec`'s
   tree-job rows (`scaffold.ts:2586-2593`) assert only `typeof … === "function"` and swallow any
   non-`ReferenceError` throw, and the emitted `tests/oracle.spec.ts` can earn `tested` from its weakest
   passing assertion. Closing that needs files I do **not** own (`scaffold.ts`, possibly
   `compile-check.server.ts`). **STOP-and-REPORT shape:** require ≥1 behavioural assertion in the
   emitted spec's tree-job rows (compare a documented return property, or call the function with real
   inputs and assert the returned value) and let `treeRunTestedEvidence` require a behavioural
   assertion, not merely `assertions > 0`.
2. **Direct `runCases` callers** bypass `generateCases` and can still pass a shape-only set — the
   existing `fixes/328 P3` control pins `typeof buildPlan === 'function'` passing `runCases`. No
   production caller feeds `runCases` cases it did not get from `generateCases`
   (`verifyAndFixServer` always generates first), so the production trust path is closed; this is
   defence-in-depth residual, deliberately left so the lower-level seam's documented contract
   (`runCases` = "run these cases") is unchanged.
3. **The constraint is required, not guaranteed correct** — a stub returning `0` still passes
   `f() === 0`. The floor stops "no constraint at all"; the model still authors the expected values, so
   oracle *quality* remains model-bounded. This is inherent to same-model self-certification and is now
   at least a real assertion.
4. **Deliberate strictness trade-off:** a legitimate sole assertion that the module's only observable
   behaviour is emptiness (`lookup('x') === null`) is classified shape-only and forced to add a
   non-null comparison. This is intended (presence is the defect form), the repair prompt makes the
   requirement explicit, and a genuine behavioural case always satisfies the floor.
