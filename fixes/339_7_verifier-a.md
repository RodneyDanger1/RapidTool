# fixes/339_7_verifier-a.md — verifier A (independent) · lanes 339-1 / 339-2 + type-strip

**Verifier:** verifier A. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (HEAD `c4348f4` + uncommitted wave).
**Scope:** independently re-derive the two oracle-seam lanes (339-1, 339-2) and the type-strip fix.
**Runtimes:** host `node v24.15.0`; pinned `%LOCALAPPDATA%\hermes\node\node.exe` v22.23.2.
**Scratch:** `%TEMP%\rt339_va\` (a full copy of `src\lib` + a `node_modules` junction; the pre-fix state was
made by reverting `verify.server.ts`'s `buildHarness` there — **the working tree was never modified**).
**Read first:** `fixes/339_1_oracle-harness.md`, `fixes/339_2_oracle-generation.md`, `fixes/338_0_parent.md`
§4-§5, and the current bytes of `src/lib/verify.server.ts` (`buildHarness` :585, `stripTypeAnnotationsForHarness`
:577, `sanitizeOracleExpression` :248, `finalStatementAfterDeclarations` :124, `undefinedCalledNames` :1007,
`generateCases` binding gate :1364-1400) and `src/lib/codegen.server.ts` (`oracleContractNames` :3170,
`boundedRefusalDetail` :3539, `refuse` :3564, the verify call :4295).

No keyed LLM calls. No secret printed. No full gate run. Only the three targeted test files, both runtimes.

## Baseline (targeted files, both runtimes)

| suite | node 24 | node 22 |
|---|---|---|
| `src/lib/verify.test.ts` + `src/lib/verify.server.test.ts` | **98/98/0** | **98/98/0** |
| `src/lib/codegen.server.test.ts` | **201/201/0** | **201/201/0** |

Command (both legs):
`node --experimental-strip-types --test --test-reporter=tap src/lib/verify.test.ts src/lib/verify.server.test.ts`
and `… src/lib/codegen.server.test.ts` (pinned leg via `& "$env:LOCALAPPDATA\hermes\node\node.exe"`).

---

## Claim 1 — the decisive typed-module harness bug and its fix — **CONFIRMED**

**Mechanism, re-derived from the bytes.** Pre-fix `buildHarness` embedded `JSON.stringify(source)` raw
(`git show HEAD:src/lib/verify.server.ts` → `const __SRC = ${JSON.stringify(source)};`) and compiled it with
`new Function('exports','module','require', __SRC + …)`. A typed module is not JS:

```
$ node -e "const s='function mean(values: number[]): number { return 0; }'; try { new Function('exports','module','require', s+'\n; return exports;'); } catch(e){ console.log(e.name+': '+e.message); }"
SyntaxError: Unexpected token ':'
```

**Pre-fix reproduction in a scratch copy** (`%TEMP%\rt339_va\src\lib\verify.server.ts`, `buildHarness` reverted to
`const __src = source;`; probe `%TEMP%\rt339_va\probe.mjs` calls the real `runCases` on
`function mean(values: number[]): number {…}\nmodule.exports.mean = mean;` + case `mean([1,2,3]) === 2`):
```
TYPED: {"pass":false,"results":[{"id":"mean-avg","pass":false,"detail":"error ReferenceError: mean is not defined"}],"compileError":"source failed to compile in the harness"}
PLAIN: {"pass":true,"results":[{"id":"add","pass":true,"detail":"true"}]}
```
Byte-identical on **both** runtimes, and byte-for-byte the parent's real-run failure (`fixes/338_0_parent.md` §4).

**Post-fix** (probe importing the repo `verify.server.ts`), both runtimes:
```
TYPED: {"pass":true,"results":[{"id":"mean-avg","pass":true,"detail":"true"}]}
```
CONFIRMED: the typed module verifies green; the case set is executed, not refused.

## Claim 2 — plain-JS no-op — **PARTIAL (byte-identity claim REFUTED; a false machine pass demonstrated)**

**Refuted: `stripTypeScriptTypes` is NOT a byte-for-byte no-op on all plain JS.** A closed probe of 17 plain-JS
constructs (`%TEMP%\rt339_va\noop_probe.mjs`) shows 16 identical and **1 changed**, on both runtimes:
```
IDENTICAL arrow / moduleExportsObj / genericLook / objectLiteral / ternary / label / classJs / template /
          optional / regexColon / defaultParam / destructParam / shiftCompare / iife / commentColon / jsxLike
CHANGED   genericsCall     "const g = f(a          (d));\nexports.g = () => g;\n"
TOTAL: 17 plain-JS inputs, changed: 1
```
The input was `const g = f(a < b, c > (d));` — valid JS (`f((a<b), (c>d))`). TypeScript's parser reads
`< b, c > (` as a generic type-argument list and blanks it. `%TEMP%\rt339_va\generic_probe.mjs`:
```
DIFF  in="const g = f(a < b, c > (d));"   out="const g = f(a          (d));"
DIFF  in="if (a < b, c > (d)) {}"          out="if (a          (d)) {}"
DIFF  in="const g = foo(a<b, c>(d));"      out="const g = foo(a      (d));"
SAME  in="const g = f(a < b, c > d);"      (no `>(` — preserved)
```

**This can flip a machine verdict to a FALSE PASS.** `%TEMP%\rt339_va\falsepass2.mjs`:
```
module: function a(x){return true;} function f(x,y){return y===undefined;} function g(x,y){return y===undefined;}
        const b=2,c=1,d=5; module.exports.g=g; module.exports.r=f(a < b, c > (d));
real exports (no strip): {"r":false}
POST-fix runCases: {"pass":true,"results":[{"id":"c1","pass":true,"detail":"true"}]}   (case: r === true && g(1,undefined) === true)
PRE-fix runCases : {"pass":false,"results":[{"id":"c1","pass":false,"detail":"false"}]}
FALSE MACHINE PASS: true
```
The stripper rewrites the module to `f(a(d))` (truthy), the harness runs the corrupted bytes, and `runCases`
returns `pass:true` while the real module's `exports.r` is `false`. The fix therefore **introduces** a
false-attestation vector on this input shape; the pre-fix path ran the real bytes and correctly failed.
Likelihood in practice is low (needs the exact `< id , id > (` ambiguity inside a call), but it is a genuine
honest-attestation hole and refutes the docblock's "Plain-JS input is returned byte-identical (strip is a no-op
— pinned by test)" as written.

**Mutation test (as required).** In the scratch copy:
- **Mutation A** (stripper also mangles `=>` → `:`): the byte-for-byte no-op test fails —
  `not ok 1 - is a byte-for-byte no-op on plain JavaScript` and one `runCases` test (`not ok 1 - machine-passes a correct assertion`), 40/42. **Caught.**
- **Mutation B** (stripper eats object-literal/ternary colons: `.replace(/:\s*[A-Za-z_$][\w$]*/g, "")`):
  **all 42 tests still pass** (`# pass 42 / # fail 0`). **Not caught** — none of the three pinned plain-JS
  inputs contains a colon, so the "no-op" test does not guard the colon-bearing class it claims to.

**Identical behavior** holds for the common forms and for the three pinned inputs; **byte-identity does not hold**
in general, and one plain-JS form silently changes semantics.

## Claim 3 — name-binding enforcement in `generateCases` — **CONFIRMED for the intended shapes; 3 BYPASSES found**

Pure predicate (`%TEMP%\rt339_va\bind_probe.mjs`, contract `["mean"]`):
```
"computeMean([1,2,3]) === 2" => ["computeMean"]
"missingHelper({ job: 'dispatch' }) === true" => ["missingHelper"]
"obj.mean() === 2" => []            # property call — no false positive
'obj["mean"]() === 2' => []         # computed member — no false positive
"typeof mean === 'function'" => []  # typeof is safe even when the name is unbound
"'mean(1) === 1' === 'mean(1) === 1'" => []  # string content — no false positive
"Math.round(mean([1,2,3])) === 2" => []      # method name not mistaken for identifier
```
Integration through the real `generateCases` with a stubbed transport (`%TEMP%\rt339_va\bind_integration.mjs`):
```
[a repair-then-commit] calls=2 ok=true  cases:[{c1, "mean([1,2,3]) === 2"}]
   retry prompt names "c1 → computeAvg"                          -> CONFIRMED repair-once-then-commit
[b refuse]            calls=2 ok=false  code=RT_E_VALIDATION
   error: oracle case(s) call undefined identifier(s): c7 → computeAvg — refused …   -> CONFIRMED
[d pinned-repaired]   calls=2 ok=true   orc-2 repaired in place, orc-1 kept
[e pinned-refuse]     calls=2 ok=false  RT_E_VALIDATION, never dropped
```
Pinned-row drop/rename attempts (`%TEMP%\rt339_va\pin_adv.mjs`): a repair reply that **drops** `orc-2`, **renames**
it, or returns an **empty** case list all leave `orc-2` offending → refusal. A pinned row is never silently
dropped. CONFIRMED.

**Bypasses found (honest report).** The gate only flags identifiers in *call position*; an unbound identifier
reached as a value read is not flagged and the case is **committed with no retry**:
```
[f bypass obj.mean()]      calls=1 ok=true  {c1, "obj.mean() === 2"}
[g bypass missing === 2]   calls=1 ok=true  {c1, "missing === 2 && mean([1,2,3]) === 2"}
[h bypass (0, mean)(…)]    calls=1 ok=true  {c1, "(0, missing)([1]) === 2 && mean([1,2,3]) === 2"}
```
Also unflagged: `obj["mean"]()`, `mean?.call(…)`, `[mean][0](…)`, and the declaration form
`const nums = [1,2,3]; mean(nums) === 2`. Runtime consequence (`%TEMP%\rt339_va\bypass_run.mjs`):
```
"obj.mean() === 2" => pass=false detail="error ReferenceError: obj is not defined"
"(0, missing)([1]) === 2 && mean([1,2,3]) === 2" => fail error (missing is not defined)
"missing === 2 && mean([1,2,3]) === 2" => fail error (missing is not defined)
```
So the bypasses degrade to an **honest runtime case failure**, not a false pass. But the stated guarantee
("a case calling an undefined identifier cannot be committed") is over-broad: a case *reading* an undefined
identifier is committed. Severity: low (no false mint), real.

**Additional hole — the "tolerated repair" is a trap.** `sanitizeOracleExpression` accepts
`declaration(s); final-boolean` but **discards the declarations**, and the name-binding gate does not flag the
discarded names (value reads). `%TEMP%\rt339_va\repairtrap.mjs`:
```
"const nums = [1,2,3]; mean(nums) === 2" => pass=false detail="error ReferenceError: nums is not defined"
"const nums = [1,2,3]\nmean(nums) === 2"  => pass=false detail="error ReferenceError: nums is not defined"
"mean([1,2,3]) === 2"                     => pass=true
```
The model's classic `const nums = [1,2,3]; computeMean(nums) === 2` payload is now *accepted* by the sanitizer
but still **cannot pass** — the fix converts "not run — case payload rejected" into "ReferenceError: nums is
not defined". It only helps when the discarded declarations are unused by the final boolean. Documented in the
lane log (§1/§9.6) as honest scope; flagged here because it means the grammar half alone does not close the
parent's defect #1 for that payload shape.

## Claim 4 — enforcement is not vacuous — **CONFIRMED, with the documented empty-contract boundary**

`%TEMP%\rt339_va\bind_integration.mjs`:
- control fully-bound (`mean(...)`, `Math.abs(mean(...))`, `typeof mean`) → **calls=1, ok=true** (no over-rejection).
- global-allowlist breadth (`%TEMP%\rt339_va\claims456.mjs`): all 17 forms — `Math.max`, `Number.isFinite`,
  `JSON.stringify`, `Object.keys`, `Array.isArray`, `String`, `Boolean`, `Date.now`, `RegExp`, `parseInt`,
  `parseFloat`, `isNaN`, `isFinite`, `encodeURIComponent`, `structuredClone`, a method on the export, and a
  ternary — produced **zero offenders**.
- empty contract (`contract=[]`, brief with no nouns) → **calls=1, ok=true** (gate skipped, as documented;
  `codegen.server.ts:4295` always supplies the measured surface, so the production path enforces).

## Claim 5 — oracle prompt / grammar agreement — **CONFIRMED**

Built the live prompt (`%TEMP%\rt339_va\claim5.mjs`). The prompt asks for "EXACTLY ONE boolean expression per
case … do NOT wrap it in backticks", worked examples `add(2,3) === 5` and `typeof buildPlan === 'function'`, and
states the `declaration(s); final-boolean` tolerated-repair honestly. Checks:
```
prompt has backtick around a case example: false
add(2,3) === 5 accepted: true
typeof buildPlan === 'function' accepted: true
sanitizer rejects a backtick-wrapped expression: TRUE   (.ok === false)
tolerated repair accepted: {"ok":true,"expression":"mean(nums) === 2"}
```
Every shape the prompt *recommends* (single boolean over exported names, the two worked examples, the
identifier-reference grounding, the tolerated repair) is accepted by `sanitizeOracleExpression`; the shapes the
prompt *forbids* (backticks, semicolons/declarations, arrows, template literals) are rejected. No
prompt-recommended shape is rejected by the sanitizer. **Caveat:** the tolerated repair is accepted but, per
claim 3, is a runtime trap when the final expression reads a discarded declaration.

## Claim 6 — codegen contract binding + refusal detail — **PARTIAL (binding measured but incomplete; detail CONFIRMED)**

Bytes: `src/lib/codegen.server.ts:4295` → `signatureNames: oracleContractNames(envelope.module, envelope.exports)`;
`oracleContractNames` (:3170) returns `exportedNamesOf(module)` when non-empty else the validated claimed exports.
The integration pin `codegen.server.test.ts:2343` ("the machine oracle is contracted to the measured exports")
passes in the independently-run suite (201/201 both runtimes).

**Refusal detail — CONFIRMED.** `boundedRefusalDetail` on a 6179-char evidence (`%TEMP%\rt339_va\claims6b.mjs`):
```
len in: 6179 out: 1200 max: 1200 <= max: true
head kept: true  tail kept: true  case id kept: true  elision marker: true
head-only-160 would keep tail? false
out: RT_E_RUNNER_FAILED … case …[elided 5002 chars]… (one or more case expressions failed the harness safety
     check: case-9 — template literals are not allowed)
```
The old 160-char head clip dropped the reason; the new bound preserves head + tail with a visible marker, never
exceeding the documented 1200. `headless.ts`'s `P6_JOURNEY_REFUSAL_MAX` was raised 200 → 1200 (verified by
`git diff`), and the codegen reader `withSynthesisRefusalContext` cap is 1200 (`:1153`).

**HOLE — the measured export surface is incomplete, so the binding can over-reject a real export.**
`exportedNamesOf` (`src/lib/algo-tools.ts:353`) recognises `exports.x =`, `module.exports.x =`,
`module.exports = {…}`, and ESM forms, but **not** computed/member-alias CJS forms
(`%TEMP%\rt339_va\exports_probe.mjs`):
```
["sub"]  <- module.exports.sub = sub
["sub"]  <- exports.sub = sub
["sub"]  <- module.exports = { sub }
[]       <- module.exports['sub'] = sub          <-- real export missed
[]       <- exports['sub'] = sub                 <-- real export missed
[]       <- module.exports = sub                 <-- real export missed
[]       <- Object.assign(module.exports, {sub}) <-- real export missed
```
Because the fallback only fires when the measured list is **empty**, a module mixing a recognised export with a
computed one drops the computed name from the contract:
```
measured: ["add"]
oracleContractNames("…module.exports.add = add; module.exports['sub'] = sub;", ["add","sub"]) => ["add"]
```
An oracle case calling `sub` (a real export the harness would run fine) is then flagged as an undefined
identifier and repaired/refused. Over-rejection vector; and the `sub` case would never be runnable even though
the module binds it. Practically narrow (the synthesis prompt produces `exports.x =`), but real.

---

## Mock / fake census (the two lanes' changed files)

Changed files attributable to 339-1/339-2: `verify.server.ts` (+342/−18), `verify.test.ts` (+155/−0 … per
numstat 155/0), `verify.server.test.ts` (+220/−3), `codegen.server.ts` (+122/−14), `codegen.server.test.ts`
(+272/−4), `headless.ts` (+6/−5). Scan of added lines:

| construct | result |
|---|---|
| `as any` / `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` | **0** |
| empty/silent `catch {}` | **0** |
| `TODO` / `FIXME` / `XXX` | **0** |
| `.only(` | **0** |
| `it.skip` / `t.skip` | **0** |
| `skip:` | 3, all `{ skip: !available }` runner-availability guards in `verify.test.ts` (not skipped-forever) |
| `mock` | 18 in `verify.server.test.ts` added lines — all the `mockChat` global-`fetch` transport stub, which returns a **real `Response`** and injects queued model payloads. Legitimate network fake (repo precedent), not a fake of the computation under test. |
| `fake` | `fakeDeps(` in `codegen.server.test.ts` — pre-existing injected-deps seam (DI), unchanged helper |
| `placeholder` | pre-existing doc comments only |

No test-found-vacuous: I independently reproduced the RED for claim 1 (scratch pre-fix), claim 3
(repair/refuse/pinned), claim 4 (control), and ran the full targeted suites green (98/98, 201/201 both runtimes).
The one coverage gap: the "byte-for-byte no-op on plain JavaScript" test does **not** catch a colon-eating
stripper (Mutation B) and the real stripper's generic-ambiguity corruption passes the whole suite unnoticed.

## Could not verify / boundaries

- **No full gate** (`npm test`, `npm run build`, `scripts/gate.sh`) — not run, per instructions (boundary owner runs it).
- **No keyed LLM calls**; oracle generation was exercised with a stubbed `fetch` and a fake key only.
- The real keyed P6 journey was **not** re-run (parent `fixes/338_0_parent.md` §4 bytes were reproduced
  deterministically instead); whether the typed fix + contract binding actually turn a real P6 cycle green on a
  keyed brief remains unproven here — the deterministic harness path is confirmed green, the model's payload
  distribution is not.
- The scratch pre-fix reproduction used `const __src = source;` in place of the pre-fix
  `JSON.stringify(source)` (behaviorally identical: `source` is stringified on the next line); no other byte changed.
- Line numbers cited are the current working-tree bytes (HEAD + wave), matching the lane logs.

## Verdicts

| claim | verdict |
|---|---|
| 1 — typed-module harness bug + fix | **CONFIRMED** (RED and GREEN re-derived, both runtimes) |
| 2 — plain-JS no-op | **PARTIAL** — common forms identical; byte-identity **REFUTED** (`f(a<b,c>(d))` corruption), and that corruption yields a **false machine pass**; mutation A caught, mutation B not |
| 3 — name-binding enforcement | **CONFIRMED** for the named shapes + repair-once/refuse + pinned-in-place; **3 bypasses** (value-read identifiers), and the tolerated declaration repair remains a runtime trap |
| 4 — not vacuous / no over-rejection | **CONFIRMED** for all tested bound forms; empty-contract skip is as documented |
| 5 — prompt/grammar superset | **CONFIRMED** (no prompt-recommended shape rejected) |
| 6 — codegen binding + un-clipped detail | **PARTIAL** — call site and detail bound CONFIRMED; measured export surface misses computed CJS export forms → over-rejection vector |
