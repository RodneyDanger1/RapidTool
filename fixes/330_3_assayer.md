# fixes/330 · Persona 3 (Assayer — Verification-Honesty Engineer)

**Wave:** 330 (6-lane, concurrent). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` ·
branch `main` · **HEAD `c024503`** (tree verified at start; siblings' edits were live:
`scripts/rapidtool-cli.mjs`, `src/lib/{codegen.server,compile-check.server,engine,harvest,
knowledge,headless,scaffold}.*`, `fixes/330_{1,2,4,5}_*.md` — none of them mine).
**Runtime:** repo-pinned Node 22.23.2 (`C:\Users\mnril\AppData\Local\hermes\node\node.exe`).

**Owned files (only these):** `src/lib/verify.server.ts`, `src/lib/verify.server.test.ts`,
`src/lib/verify.test.ts` (untouched), `src/lib/algo-tools.ts`, `src/lib/algo-tools.test.ts`.
**I am the only writer of this log.** No `git checkout/stash/reset/clean/commit` was run.

**Method (RESUME §13.2/§13.3):** every finding was reproduced against today's bytes with a
throwaway probe OUTSIDE the repo (`C:\Users\mnril\rt_330_p3\`), fixed with production code +
regression tests with TEETH (the module reverted to `git show HEAD:<path>` in a scratch tree,
run against the new tests — the new assertions go RED there and GREEN on the fix), plus a
false-positive CONTROL that the stricter check still accepts legitimate input.

---

## Verdict summary

| # | Finding | Status | Where |
|---|---|---|---|
| 1 | `runCases` reference gate (328 P3) is forgeable by a DATA-ONLY mention of the export name — object key / regex content — minting a machine pass for a module never touched (109 C-01, re-opened) | **FIXED** (value-position read required) | `verify.server.ts:631`, `:698`, `:750` |
| 2 | `exportedNamesOf` CJS module form omitted `.` from its left boundary → `obj.module.exports.x` advertised a PHANTOM export | **FIXED** | `algo-tools.ts:369` |
| 3 | `exportedNamesOf` missed `module.exports = { … }` (the reassignment style the harness explicitly supports, 109 T-05) and `export * as ns from` → prompt advertised `(none)` for real exports | **FIXED** | `algo-tools.ts:286`, `:377`, `:418` |
| 4 | `complexityOf` counted `obj.for(x)` / `obj.while(x)` / `obj?.do(x)` / a method named `for` as loops → published O(n) for a module with no loops | **FIXED** | `algo-tools.ts:912-918`, `:951-956` |

**Suites (pinned Node 22, TAP):**

| Suite | HEAD baseline (before my tests) | After | Δ |
|---|---|---|---|
| `src/lib/verify.server.test.ts` | 36 / 0 fail | **41 / 0 fail** | **+5** |
| `src/lib/verify.test.ts` (not edited) | 26 / 0 fail | **26 / 0 fail** | 0 |
| `src/lib/algo-tools.test.ts` | 40 / 0 fail | **48 / 0 fail** | **+8** |
| `src/lib/sweep73-fuzz.test.ts` (NOT mine — read-only check) | — | **52 / 0 fail** | 0 |

**Typecheck:** `npm run typecheck` → exit **0** (run after the source edits AND again after the
test edits).

---

## Finding 1 — the reference gate could be forged by a data-only mention of the export name

**File:** `src/lib/verify.server.ts` (328 P3's gate, `:609-628` at HEAD). 109 C-01's original
shape — a case that never touches the module — was closed for `oracleBriefGrounded` (109 T-02,
which explicitly names `({board:1}).board === 1`) but the **new runner-level reference gate used
a bare token scan** (`referencedIdentifiers`), so the same shape re-opened one layer down: an
object-literal KEY that spells an export name is not a read of the export.

### Probe — before (today's HEAD bytes, `C:\Users\mnril\rt_330_p3\probe2.mjs`)

Module `exports.add = (a, b) => a + b;` (exports `add`):

```
control: typeof add === 'function'                       pass=true compileError=-
control: add(2,3) === 5                                  pass=true compileError=-
FORGE object-key: ({add:1}).add === 1                    pass=true compileError=-      <-- VACUOUS PASS
FORGE regex content: ({r:/add/}).r.source.length===3     pass=true compileError=-      <-- VACUOUS PASS
```

`({add:1}).add === 1` evaluates TRUE (it is a self-contained literal) and satisfies the token
scan because the export spelling `add` appears — as a key and as a property — while the module is
never read. The run mints a "machine-verified" pass.

### The fix

The gate now requires an identifier read in a **VALUE position**:

- `referenceIdentifiers` (`verify.server.ts:750`) drops tokens that are a PROPERTY ACCESS
  (`obj.add`, or `?.add`) or an object-literal KEY (`{add: …}`), while keeping a `? :` alternate
  after `?` (a real read) and a spread's `...name` (also a real read). It also calls
  `maskRegexLiterals`.
- `maskRegexLiterals` (`verify.server.ts:698`) blanks `/…/` regex content (length-preserving)
  before the token scan — `stripStringsAndComments` blanks strings/comments but not regex, so
  `/add/` contributed a phantom token. Conservative: only a `/` at an expression-start/operator
  position with a closing unescaped `/` is masked, so division (`add.length / 2`) stays code.

`runCases` (`:631`) consumes the new helper; the doc on `NO_EXPORT_REFERENCE_REASON` (`:495-508`)
was corrected (the allowed forms NAME an export *in a value position*).

### Probe — after

```
control: typeof add === 'function'                       pass=true  compileError=-
control: add(2,3) === 5                                  pass=true  compileError=-
FORGE object-key: ({add:1}).add === 1                    pass=false compileError=no oracle case references an exported callable name — machine verification is vacuous
FORGE regex content: ({r:/add/}).r.source.length===3     pass=false compileError=no oracle case references an exported callable name — machine verification is vacuous
```

### Teeth (scratch `C:\Users\mnril\rt_330_p3\teeth\lib\verify.server.ts` = `git show HEAD:…`)

```
teeth\lib\verify.server.test.ts   # tests 41 / pass 38 / fail 3
  not ok 1 - an object key that spells the export name is NOT a reference
  not ok 2 - regex content that spells the export name is NOT a reference
  not ok 3 - a property access alone is NOT a reference (a value-position read is required)
```
On HEAD the failure is `expected: false / actual: true` on `res.pass` — the forge mints the pass
exactly as the probe showed. **GREEN on the fix** (`41/41`).

### False-positive control (the brief's required control)
The suite row `control: typeof, a call, a property OF the export, division and ternary text all
still reference` runs `typeof add === 'function'`, `add(2,3) === 5`, `add.length === 2`,
`add.length / 2 === 1`, `true ? 1 === 1 : add(1,1) === 2` and
`add.length === 2 && /^\d+$/.test('12')` — **all green on HEAD AND on the fix**. Plus
`control: a mixed set with one real case still passes`. These are the assertions that would go
RED if the stricter scan over-rejected a legitimate form.

### Count change
`verify.server.test.ts` **36 → 41 (+5)**: 3 forge rows (RED on HEAD) + 2 controls.

---

## Finding 2 — `exportedNamesOf` invented a PHANTOM from `obj.module.exports.x`

**File:** `src/lib/algo-tools.ts:369` (HEAD). The CJS module-form regex
`/(^|[^A-Za-z0-9_$])module\.exports\./` allowed `.` before `module`, so a member-chain tail was
reported as a module export — the same phantom class 109 T-08 fixed for the bare `exports.` form,
but the `module.` form kept the hole. The docstring claimed member chains are excluded.

### Probe — before (`probe3.mjs`)

```
obj.module.exports.x = 1;          ["x"]      <-- PHANTOM (a member chain, not a module export)
foo.module.exports.y = 2;          ["y"]
a.b.module.exports.z = 3;          ["z"]
my_module.exports.x = 1;           []
module.exports.z = 3;              ["z"]       (control: still real)
```

### The fix
`cjsModule` boundary → `[^A-Za-z0-9_$.]` (adds `.`), matching the bare form (`algo-tools.ts:369`).

### Probe — after
```
obj.module.exports.x = 1;          []
foo.module.exports.y = 2;          []
a.b.module.exports.z = 3;          []
module.exports.z = 3;              ["z"]       (control preserved)
```

---

## Finding 3 — missing `module.exports = { … }` and `export * as ns from` exports

**File:** `src/lib/algo-tools.ts` (`exportedNamesOf`). The verify harness explicitly supports the
`module.exports = { … }` reassignment style (109 T-05, test at `verify.server.test.ts`), but the
inventory did not, so the property-case prompt line *"The module exports these names ONLY"* said
`(none)` for a module that plainly exported its API. `export * as ns from "…"` (a real named
export) was also absent.

### Probe — before
```
module.exports = { get g(){return 1} };        []        <-- "(none)" for a real export
module.exports = { add, run };                 []
export * as ns from './m';                     []
```

### The fix
- `moduleExportsObjectNames` (`algo-tools.ts:286`, wired `:377`) — balanced scan of a
  `module.exports = { … }` literal; top-level keys only, with `get `/`set `/`async ` modifiers
  stripped; `...spread` and computed `[expr]` keys contribute nothing (not statically knowable),
  as do string keys (the masker blanks them).
- `esmNamespace` (`algo-tools.ts:418`) — `export * as ns from` contributes `ns`.

### Probe — after
```
module.exports = { add, run };                       ["add","run"]
module.exports = { add: (a,b)=>a+b };                ["add"]
module.exports = { add(a,b){return a+b} };           ["add"]
module.exports = { get g(){return 1} };              ["g"]
module.exports = { async load(){}, go };             ["go","load"]
module.exports = { wrap: { inner: 1 }, run };        ["run","wrap"]   (nested key NOT a top-level export)
module.exports = { ...base, add };                   ["add"]          (spread not guessed)
module.exports = { [k]: 1, add };                    ["add"]          (computed not guessed)
export * as ns from './m';                           ["ns"]
obj.module.exports = { a: 1 };                       []               (control: member chain)
'const s = "module.exports = { z }";'                []               (control: string)
// module.exports = { z }                            []               (control: comment)
```

### Teeth
```
teeth\lib\algo-tools.test.ts   # tests 48 / pass 42 / fail 6
  not ok 1 - never reports a member-chain `…module.exports.x` as a module export
  not ok 2 - inventories `module.exports = { … }` keys (shorthand, value, method, getter/async)
  not ok 3 - never invents a nested/spread/computed name and never reads non-code
  not ok 4 - inventories a namespace re-export `export * as ns from` (a real named export)
```
**GREEN on the fix.** The last row's controls (member-chain opener, string and comment lookalikes)
stay green on HEAD AND on the fix — the false-positive control.

### Count change
`algo-tools.test.ts` **+4** from Findings 2+3 (part of 40 → 48).

### Remains (honest)
- `export * from "…"` still contributes nothing: the re-exported set is unknowable, so inventing
  names would be worse. Registered, not fixed.
- `Object.defineProperty(exports, "x", …)`, `exports["x"] = …`, `module.exports["x"] = …` and
  **string** keys in an object literal are not inventoried — the masker blanks string contents by
  design, and reading raw bytes would resurrect the string/comment phantom class T-08 closed
  (`'const s = "exports.str = 3"'` → `[]` today, pinned). Registered residual.

---

## Finding 4 — `complexityOf` counted property/method names `for`/`while`/`do` as loops

**File:** `src/lib/algo-tools.ts` (`complexityOf`). `for`/`while`/`do` are legal property names
after `.` (ES5+) and legal method names; the keyword scan treated them as loops, publishing a
wrong O() for a module with none.

### Probe — before (`probe2.mjs`)
```
obj.for(x)  (property named for)                         loops=1 nest=1 O=O(n)     <-- WRONG
obj.while(x)                                             loops=1 nest=1 O=O(n)
obj.do(x)                                                loops=1 nest=1 O=O(n)
class C { for(x){} }                                     loops=1 nest=1 O=O(n)     <-- WRONG
const o = { for(x){} };                                  loops=1 nest=1 O=O(n)
json.for(...) chain                                      loops=2 nest=1 O=O(n)
getter named for in object                               loops=1 nest=1 O=O(n)
```

### The fix
- `algo-tools.ts:912-918` — a loop keyword preceded (whitespace-skipped) by `.` is a property
  access (`obj.for(x)`, `obj?.do(y)`), never a loop.
- `algo-tools.ts:951-956` — a real `for` head is a `;`-clause / `of` / `in` form; a method or call
  named `for` (`class C { for(x){} }`, `{ for(x){} }`) has none, so it is not a loop.

### Probe — after
```
obj.for(x) / obj.while(x) / obj.do(x)                    loops=0 O=O(1)
class C { for(x){} } / { for(x){} } / { get for(){} }    loops=0 O=O(1)
json.for(...) chain                                      loops=0 O=O(1)
```
Controls unchanged: nested two-`for` O(n^2); `for (…;…;…)` / `for of` / `for in` / `for (;;)` /
`for await` / labelled / braceless / `while` / `do-while` all `loops=1`; the 328 P3 do-while-tail,
empty-body-`while` and `/do/`-regex pins stay green.

### Teeth
```
  not ok 1 - does not count `obj.for(x)` / `obj.while(x)` / `obj?.do(x)` as loops
  not ok 2 - does not count a method named `for` (class body or object literal)
```
**GREEN on the fix.** The two control rows (`every REAL for-form is still counted`,
`while / do-while / labelled while are unchanged`) pass on HEAD AND on the fix.

### Count change
`algo-tools.test.ts` **+4** from Finding 4 (part of 40 → 48).

### Remains (honest)
A **method** named `while` or `do` (`class C { while(x){} }`, `const o = { do(x){} }`) is still
counted as a loop: at token level a method `while(x){}` is byte-indistinguishable from the real
loop `while (x) { }`, and classifying it needs brace-context analysis of the enclosing
class/object literal. Reproduced (`probe2.mjs`: both print `loops=1`), registered as a residual,
**not fixed** — a guessed context rule would risk a real-loop false-negative, which is worse.

---

## Findings that did NOT reproduce (struck, with the falsifying command/observation)

`probe2.mjs` (sanitizer matrix) + reading:

1. **Sanitizer escape via computed `constructor`** — `sanitizeOracleExpression` ACCEPTS
   `this['con'+'structor']('return process')()`. This is NOT a new defect: it is the documented,
   honest scope of a NAME-BASED gate (the function's own docstring, `verify.server.ts:117-124`,
   says "name-based, so it is a hatch-closer, not a proof"; 109 C-05/T-04 landed that wording).
   It cannot forge a PASS: `forged`/duplicate-id detection still owns the verdict lines, and the
   reference gate (Finding 1) still requires a real export read. Struck as a defect.
2. **`lintFailures` cannot forge a pass or refusal** — it has no verdict path at all
   (ADVISORY-ONLY by construction, `verify.server.ts:53-58`); `verifyAndFixServer` appends its
   findings to evidence and never gates on them. Struck.
3. **`HARNESS_EXPORTS` / `HARNESS_COMPILE` forging** — a module's own stdout is emitted BEFORE the
   harness's real markers, and both parsers are last-line-wins; a forged/duplicate `ORACLE_RESULT`
   line sets `forged` and *refuses* the run (it can only cause a red, never a green). Verified by
   reading `runCases` (`:560-600`) and the 327 L5 pin (`verify.server.test.ts:471-495`) — no hole
   found. Struck.
4. **`runCases` callable gate** — `NO_CALLABLE_EXPORTS_REASON` still fires before the reference
   gate; 109 T-12 pins it. No regression from Finding 1.

---

## `fixes/257` OV-13 pin status (checked, per the brief)

`fixes/257_error_ledger_v3.md:230` records residual (2): `verify.server.ts` `:840/:845`
("unparseable oracle payload") vs `:469` ("no cases to run") — "no pin distinguishes the two
today; owed pin". That pin **now exists** as the 328 P3 block in `verify.server.test.ts`
(`parseOracleCases` vs legacy `parseOracleJson`, and the honest empty-vs-unparseable
`generateCases` diagnosis) — I re-ran it green today. The **ledger marker** in `fixes/257`
(append-only, not an owned file of mine) is still owed by that file's owner; I did not touch it.

---

## Verification (all commands run by me, pinned Node 22.23.2)

```
npm run typecheck                                                                  # exit 0
node --experimental-strip-types --test --test-reporter=tap src/lib/verify.server.test.ts   # 41/41, 0 fail
node --experimental-strip-types --test --test-reporter=tap src/lib/verify.test.ts          # 26/26, 0 fail
node --experimental-strip-types --test --test-reporter=tap src/lib/algo-tools.test.ts      # 48/48, 0 fail
node --experimental-strip-types --test --test-reporter=tap src/lib/sweep73-fuzz.test.ts    # 52/52, 0 fail (not mine; read-only)
```

Teeth (scratch tree outside the repo, modules reverted with `git show HEAD:`):
```
teeth\lib\algo-tools.test.ts      # 48 / pass 42 / fail 6   (all 6 = my new fix assertions)
teeth\lib\verify.server.test.ts   # 41 / pass 38 / fail 3   (all 3 = my new forge assertions)
```
**9 new assertions RED on HEAD, all GREEN on the fix; every control green on BOTH.**

No assertion was weakened and no test was deleted. `verify.test.ts` was not edited.

---

## What remains / notes for the parent

- **`sweep73-fuzz.test.ts` exercises `verify.server.ts` and `algo-tools.ts`** (not my file — do
  not let it go unrun in the boundary gate). I ran it read-only: **52/52 green** on my bytes.
- **Residuals registered, not fixed:** `export * from` (unknowable), string-keyed / 
  `Object.defineProperty` / computed exports (masker blanks string keys), and a class/object
  **method** named `while`/`do` (token-indistinguishable from a real loop). All reproduced above.
- **No cross-file fix was needed** — every change stayed inside my owned files (rule 5 satisfied).
- Sibling edits were live throughout; I ran only the targeted suites above, never the full gate.
