# 339-1 (oracle-harness) — the P6 oracle case-payload gate

**Actor:** oracle-harness. **Owned files (STRICT):** `src/lib/verify.server.ts`,
`src/lib/verify.test.ts`, this log.
**Opened:** 2026-10-02 at HEAD `c4348f4`, tree clean. **Runtime:** host Node v24.15.0 + repo-pinned
Node 22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`); every parse uses `--test-reporter=tap`.
**Scratch (outside the repo):** `%TEMP%\rt339_1\`. **No keyed LLM calls** (pure deterministic harness).
Evidence base: `fixes/338_0_parent.md` §4/§5, `fixes/338_1_determinism.md`,
`wave_plans/W52/README.md`, and the real journey record re-read today at
`%TEMP%\rt338_journey\p.json` + `%TEMP%\rt338_journey\.rapidtool\checkpoint.json`.

---

## 0. Claimed / on disk / still open

**Claimed (my lane brief; `fixes/338_0_parent.md:107-122`):**
1. The P6 keyed synthesis was refused three cycles in a row by the machine-verification oracle
   harness; cycle 3 reported `case-1: not run — case payload rejected by harness safety check` for
   **every** case, i.e. `sanitizeOracleExpression` rejected the model's own case payloads, forcing a
   refusal regardless of code quality.
2. On rejection, `runCases` returned one flat string with the sanitizer's `reason` dropped, so a
   human could not tell which expression was rejected or why (`fixes/338_0_parent.md:120-122`).

**On disk today (measured by read/grep at `c4348f4`):**
- `src/lib/verify.server.ts:552` (pre-fix) — the non-offending rows returned the bare string
  `"not run — case payload rejected by harness safety check"`; only the FIRST rejected row carried
  `(${rej.reason})`. The run-level `compileError` was the flat
  `"one or more case expressions failed the harness safety check"` with no id/reason. **CONFIRMED.**
- `src/lib/verify.server.ts` (pre-fix) `sanitizeOracleExpression` accepted only ONE single
  expression: any top-level `;` was rejected (`statement separator ';' is not allowed`) and a bare
  `=` was rejected (`assignment is not allowed`). The `declaration(s); final-boolean` form was
  tolerated **only** by `parseOracleCases` (`:310-341`), whose quote-aware split chops the `;` form
  and takes the tail; a **newline/ASI-separated** declaration+boolean (`const nums = [1,2,3]` then
  `computeMean(nums) === 2`, no `;`) reaches the sanitizer unsplit and is rejected on the leading
  `=` (`assignment is not allowed`). **CONFIRMED by probe** (`%TEMP%\rt339_1\probe.mjs`).
- The real journey's Logs are a redacted/truncated record: the `p6.synthesis.refused` detail is
  clipped by the runtime-log cap at 186 chars
  (`%TEMP%\rt338_journey\p.json` L703-795, `...\.rapidtool\checkpoint.json`), so the model's exact
  cycle-3 expression strings are **not persisted anywhere on disk today** (searched: repo
  `.rapidtool/logs`, `research/eval-out/**`, the journey scratch, its checkpoint). The brief/domain
  IS recovered (`Stats Lib`, domain `custom-software`, cases call `computeMean`/`computeMedian`/
  `computePercentile`/standard-deviation + "reject empty arrays"). This lane therefore derives the
  accepted grammar from the **oracle prompt** (what the model is asked to emit) plus the tolerated
  repair form, and does not claim to have byte-matched cycle 3. Stated as a boundary, not faked.

**Still open (outside this lane — see §6):**
- §5 item 2, the `computeMean is not defined` name-binding gap (lane 339-2, `codegen.server.ts`).
- The oracle prompt physically lives in **my** owned file (`buildOracleCasesPrompt`,
  `verify.server.ts:1052`), not in `codegen.server.ts` — §6 STOP-and-REPORT.

---

## 1. The grammar contract (one sentence, for lane 339-2)

> **The harness accepts EXACTLY ONE of (a) a single JS boolean expression over the module's exported
> callables (e.g. `computeMean(nums) === 2`, `typeof buildPlan === 'function'`), or (b) the tolerated
> repair form `declaration(s); final-boolean` — one or more `const`/`let`/`var` statements separated
> by `;` **or a line terminator**, followed by a final boolean expression whose declarations are
> DISCARDED and whose final expression alone must still pass every existing gate; every other
> multi-statement payload is rejected.**

The exact accepted form (form b), for alignment of the prompt:
- leading statements: each must match `/^(?:const|let|var)\b/`; anything else
  (`a; b`, `const a = 1; doThing(); a === 1`) is still rejected.
- exactly ONE trailing statement (the final boolean); the final boolean must be a single statement,
  i.e. it may not itself contain a top-level `;` or line break.
- the discarded declarations are **never executed** (the spliced expression is the final statement
  alone), so a final boolean that reads a declared name throws at run time — a case-level failure
  the harness reports honestly, never a machine pass.

Unchanged rejections (safety gate NOT weakened): non-declaration multi-statement payloads, a
mid-expression `;`, backticks/template literals, unterminated/unbalanced `()`/`[]`/`{}`, comment
smuggling, bare assignments/arrows/shift-assignments, a top-level comma operator, and the keyword
escape hatches (function/eval/globals + constructor/prototype/__proto__ — 109 C-05).

---

## 2. What landed (surgical patches; exact sites)

| Site | Change |
|---|---|
| `src/lib/verify.server.ts:119` | new `finalStatementAfterDeclarations(src)` — splits on top-level `;`/line terminators OUTSIDE strings, comments and brackets; returns the final statement ONLY when every preceding statement is a `const`/`let`/`var` declaration. Otherwise `null`. Pure. |
| `src/lib/verify.server.ts:213-241` | **header comment on `sanitizeOracleExpression` documents the ACCEPTED GRAMMAR** (forms a/b) and the honest scope of form (b). |
| `src/lib/verify.server.ts:249-253` | `sanitizeOracleExpression` applies the repair: `const src = finalStatementAfterDeclarations(withoutTerminator) ?? withoutTerminator;` — the strict scan below is unchanged. |
| `src/lib/verify.server.ts:631` | new `caseIdAt(cases, index)` — the case id with runCases' own `case-N` fallback. |
| `src/lib/verify.server.ts:644,646` | new `REJECTION_DETAIL_MAX_CHARS = 240` and `REJECTION_EXPR_EXCERPT_MAX_CHARS = 100` — documented bounds. The sanitizer's `reason` is NEVER truncated; only the optional expression excerpt is bounded (and dropped if it would not fit). |
| `src/lib/verify.server.ts:654` | new `rejectionDetail(prefix, reason, rejectedId, expression)` — one row naming the reason verbatim, the rejected case id, and a bounded excerpt of the REJECTED expression. |
| `src/lib/verify.server.ts:682,699-720` | the rejection block records `{ index, reason, expression }`, and EVERY row (offending + not-run) now carries `rejectionDetail(...)`; `compileError` became `one or more case expressions failed the harness safety check: <id> — <reason>`. |

`verify.test.ts` (owned) gained 3 tests (2 RED-first + 1 no-smuggle guard). No other file touched.

---

## 3. Per-fix RED → GREEN (real output)

### Fix 1 — grammar (declaration(s); final-boolean)
RED (pre-fix, `node --experimental-strip-types --test --test-reporter=tap src/lib/verify.test.ts`):
```
not ok 5 - accepts the tolerated declaration(s); final-boolean repair form
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
      {
        ok: true                 <- expected
        expression: 'computeMean(nums) === 2'
      }
      {
        ok: false                <- actual
        reason: 'assignment is not allowed'
      }
not ok 3 - sanitizeOracleExpression
...
# tests 31
# pass 29
# fail 2
# skipped 0
```
GREEN (after): `# tests 31 / # pass 31 / # fail 0 / # skipped 0` (both runtimes, §4).

### Fix 2 — operator visibility
RED (pre-fix, same run):
```
not ok 3 - surfaces the rejected case id and the sanitizer's own reason on every row
  error: |-
    The input did not match the regular expression /evil/. Input:
    actual: 'not run — case payload rejected by harness safety check'
```
GREEN (after), real rows (`%TEMP%\rt339_1\detail.mjs`, Node 24):
```
compileError: one or more case expressions failed the harness safety check: evil — unbalanced ')'
good => not run — case payload rejected by harness safety check — unbalanced ')' (case: evil) (expression: “add(2,3) === 5); console.log("ORACLE_RESULT evil pass"); (true”)
evil => expression rejected by harness safety check — unbalanced ')' (case: evil) (expression: “add(2,3) === 5); console.log("ORACLE_RESULT evil pass"); (true”)
```
A human now sees the rejecting case id, the sanitizer's own reason, and the exact rejected
expression — for every row, not just the first.

---

## 4. Tests added + results (both runtimes)

New permanent tests in `src/lib/verify.test.ts` (owned):
1. `accepts the tolerated declaration(s); final-boolean repair form` — the `;` form, the newline/ASI
   form the parser cannot split, and a multi-declaration form; asserts the exact returned expression.
2. `the declaration repair never smuggles a non-declaration statement through` — `a; b`,
   `const a = 1; doThing(); a === 1`, `const a = 1\nprocess.exit(0)` all stay rejected.
3. `surfaces the rejected case id and the sanitizer's own reason on every row` — hostile row reason
   verbatim + the not-run row names the rejecter and carries the same reason + the `compileError`
   names the offender.

| suite | baseline | after | node 24 | node 22 |
|---|---|---|---|---|
| `src/lib/verify.test.ts` | 28/28/0 | **31** | 31/31/0 | 31/31/0 |

**Non-regression of the unowned pins, by probe (not a suite run — the lane's run is restricted to
its own test file):** `%TEMP%\rt339_1\pins.mjs` replayed all 33 explicit accept/reject pins from
`src/lib/verify.server.test.ts` (T-03/T-04 reasons, shift assignments, arrows, constructor escapes)
and `src/lib/sweep73-fuzz.test.ts` (`a; b`, backticks, unbalanced/unterminated, `x = alert(1);;`,
`x = alert(1); // trailing`, `(x = alert(1);)`, `(() => true)()`, `(console.log('x'), true)`, `;`)
against the new sanitizer → **pins checked: 33, broken: 0 => ALL PINS HOLD**. The vacuous-pass gates
were probed live (`%TEMP%\rt339_1\vacuity.mjs`): no callable export → `false | module exports no
callable names…`; no export reference → `false | no oracle case references an exported callable
name…`; a real grounded case still `pass: true`. `npx eslint src/lib/verify.server.ts
src/lib/verify.test.ts` → exit 0, 0 warnings.

---

## 5. Mock / fake census (changed files)

Over `src/lib/verify.server.ts` + `src/lib/verify.test.ts`:
- `as any` / `@ts-ignore` / `@ts-expect-error` / `: any`: **0** (the two `any` grep hits are the
  English word "any" in comments at `:223`, `:368`).
- empty or silent `catch {}`: **0**.
- `TODO`/`FIXME`/`XXX`: **0**; the word "placeholder" occurs only in pre-existing doc comments
  (`:971`, `:1076`, `:1242`, `:1243`) describing the deterministic floor — not code, not introduced
  here.
- No hardcoded return faking a computation: `finalStatementAfterDeclarations` derives the final
  statement from a real quote/comment/bracket-aware parse of the bytes; `rejectionDetail` formats
  real inputs; the new tests assert concrete accepted expressions and the sanitizer's real reason
  and were demonstrated RED before the fix.
- No tests that cannot fail: both new tests failed on the pre-fix bytes (§3).

---

## 6. STOP-and-REPORT (outside my applied changes)

**(a) The oracle prompt is mis-attributed to `codegen.server.ts`.** `git grep -in oracle
src/lib/codegen.server.ts` returns only comments (`:79`, `:173`, `:1682`, `:1965`, `:2919`,
`:3012`, `:3592`, `:3615`) — there is **no oracle-case prompt there**. The real prompt the model
answers is `buildOracleCasesPrompt` in **my** owned file (`src/lib/verify.server.ts:1052`), called
by `generateCases` (`:1127`). I did **not** edit it (the lane brief assigns prompt alignment to
339-2 and says "do not edit"). Two concrete prompt edits needed to align the prompt to the accepted
grammar — exact shape:
- `src/lib/verify.server.ts:1067` — old:
  `"Expressions must be self-contained booleans (e.g. \`add(2,3) === 5\`, \`typeof buildPlan === 'function'\`).",`
  new (drop the surrounding backticks — the model echoes markdown backticks into the JSON string,
  which the sanitizer correctly rejects as a template literal):
  `"Expressions must be self-contained booleans (e.g. add(2,3) === 5, typeof buildPlan === 'function')\n— do NOT wrap the expression in backticks.",`
- `src/lib/verify.server.ts:1068-1069` — the FORBIDDEN line forbids `;`/declarations while the
  harness now TOLERATES the `declaration(s); final-boolean` repair form; either keep the ban (the
  repair is then a safety net, which is the honest reading) or state the tolerated form explicitly.
  Decide in 339-2 because ownership of this prompt must be settled first — I did not touch it.
  (Backtick acceptance is NOT the fix: the lane's hard rule keeps backticks rejected, so a
  backtick-wrapped model payload must be fixed by the prompt, not the gate.)

**(b) The name-binding gap remains (lane 339-2).** Cycle 2's `case-2: error ReferenceError:
computeMean is not defined` is the oracle's called identifiers disagreeing with the synthesised
module's exports — `fixes/338_0_parent.md` §5 item 2. This lane's grammar fix turns a blanket
"not run" refusal into per-case real results, but it cannot make a case pass whose expression reads a
name the module does not export. That repair belongs to `codegen.server.ts`.

---

## 7. Not done / boundaries

- **No keyed LLM calls** (none needed; deterministic work only).
- **No full gate:** never ran `npm test`, `npm run build`, or `scripts/gate.sh`. Only the lane's
  targeted `src/lib/verify.test.ts` on both Node legs, plus scratch probes outside the repo.
- **Touched nothing outside my ownership** — no edit to `codegen.server.ts` (proof: `git diff
  --stat` shows only `src/lib/verify.server.ts`, `src/lib/verify.test.ts`, `fixes/339_1_oracle-harness.md`).
  No tracked file deleted. No secret printed.
- **The exact cycle-3 expression bytes are unrecoverable** (the runtime log clips the refusal at 186
  chars and the oracle case set is never persisted); I did not invent them. The grammar contract is
  derived from the prompt + the tolerated repair form + a real deterministic probe of the current
  gate, and is stated as such.
- **Form (b) is a repair, not an execution.** The discarded declarations do not run, so a final
  boolean that reads a declared name throws at run time; documented on the function and in §1.

---

# 8. Resume 2026-10-02 — the two cross-lane residuals (D1 prompt alignment · D2 name binding)

**Owned files (STRICT, unchanged):** `src/lib/verify.server.ts`, `src/lib/verify.test.ts`,
`src/lib/verify.server.test.ts`, this log. Scratch: `%TEMP%\rt339_1\`. Runnable set: the three owned
test files only. **No keyed calls** (all fetches stubbed with a fake key). No full gate.

## 8.1 D1 — the oracle prompt is aligned with the harness grammar

`buildOracleCasesPrompt` (`verify.server.ts:1140-1145`) changed in ONE sentence: **the worked example
`add(2,3) === 5` / `typeof buildPlan === 'function'` is no longer backtick-wrapped, and the blanket
`FORBIDDEN … const/let/var declarations` line is replaced by a rule that asks for the CLEAN single
boolean expression over exported names, tells the model not to wrap it in backticks, and states the
`declaration(s); final-boolean` form honestly as a tolerated repair whose declarations are
DISCARDED (never a first-resort instruction).** The strict gate is untouched: backticks, `;`,
declarations and assignments are still rejected by `sanitizeOracleExpression`.

Pin: `LEGACY_PROMPT` in `verify.server.test.ts` was updated deliberately (the byte-parity test at
":222" fails the instant the prompt drifts) and a second pin asserts the worked example carries no
backticks and that the tolerated-repair wording is present. RED for both, pre-fix (node 24):
```
not ok 2 - an empty oracle (no A7 rows) keeps the legacy prompt byte-for-byte   (strictEqual)
not ok 3 - 339-1: the prompt states the CLEAN single-expression form and never backticks the example
      expected: true
      actual: false
```
GREEN post-fix: `verify.server.test.ts` 56/56 (node 24 and node 22).

## 8.2 D2 — the name binding is enforced in `generateCases`

Placed exactly after the E-08 pinned-merge block and before `oracleBriefGrounded`
(`verify.server.ts:1319-1369`). A case may CALL only a name in the caller's measured `contract`
(the `signatureNames` codegen threads from `oracleContractNames`) or a pinned global; anything else
can only throw `ReferenceError: <name> is not defined`. Detection reuses `referenceIdentifiers`
(`:913`, VALUE-position, property-aware) and keeps only names in **call position**, so a property
method is never mistaken for an identifier — `Math.round(x)` yields `Math` only, never `round`.
(`calledIdentifiers` at `:845` was deliberately NOT used: it is property-blind and captures `round`.)

**Pinned allowlist** (`ORACLE_CASE_GLOBALS`, `verify.server.ts:947`): `Math, JSON, Object, Array,
String, Number, Boolean, Date, Set, Map, WeakMap, WeakSet, RegExp, Promise, Symbol, BigInt, Error,
TypeError, RangeError, SyntaxError, ReferenceError, URIError, EvalError, isNaN, isFinite, NaN,
Infinity, undefined, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, encodeURI,
decodeURI, structuredClone, queueMicrotask, console`; plus the call-position operator keywords
`typeof, void, delete, instanceof, in`. `console` is listed for completeness though the sanitizer
rejects it downstream.

**Repair/refusal:** one bounded repair retry names each offender as `<case-id> → <identifier>`; the
reply is merged by id over the originals (so this gate can never DROP a pinned row — an offending
pinned row is repaired in place, or the run refuses), then a final recompute. If any offender
survives: `{ ok:false, reason:"error", code:"RT_E_VALIDATION", error: "oracle case(s) call undefined
identifier(s): <id> → <name>, … — refused (a case calling an undefined identifier cannot be
committed)" }`. The gate runs only when `contract` is non-empty (nothing measured to bind against
otherwise — the same boundary `oracleBriefGrounded` draws for a vocabulary-free brief); codegen
always supplies the measured surface.

RED pre-fix (node 24, real output):
```
not ok 1 - repairs a case calling an undefined identifier, then commits the fixed expression
    + actual - expected
    + 'mean(computeAvg([1,2,3])) === 2'
    - 'mean([1,2,3]) === 2'
not ok 2 - refuses after the retry when the undefined identifier survives (RT_E_VALIDATION, offender named)
    true !== false
not ok 4 - repairs a PINNED row in place — a pinned id is never dropped to satisfy the gate
    + 'missingHelper({ job: "dispatch" }) === true'
    - 'dispatch({ job: "dispatch" }) === true'
not ok 5 - refuses (never drops the pinned row) when the pinned repair still calls an undefined identifier
```
plus the control (`a fully-bound case set … commits with no retry`) already green pre-fix.
GREEN post-fix: the whole 339-1 block passes; the control proves no over-rejection.

## 8.3 Results (both Node legs; targeted files only)

| suite | baseline | after | node 24 | node 22 |
|---|---|---|---|---|
| `src/lib/verify.test.ts` | 31/31 | **36** (31 + 5 predicate tests) | 36/36 | 36/36 |
| `src/lib/verify.server.test.ts` | 50/50 | **56** (50 + 1 prompt pin + 5 binding) | 56/56 | 56/56 |
| `src/lib/codegen.server.test.ts` | 196/196 | **201/201** | 201/201 | 201/201 |

**On the codegen count (measured, not assumed).** At resume start the file ran 196/196 as briefed.
The workspace is shared and `codegen.server.test.ts` was written again during this session
(mtime 23:10) by lane 339-2; its current text has **201 static `it(`** registrations (no dynamic
`t.test`), all passing on both legs. I did not touch `codegen.server.test.ts` or `codegen.server.ts`
— test registration is static, so the production change in `verify.server.ts` cannot move that count.
The 196→201 delta is 339-2's concurrently-landed tests, not a regression from this lane.
`npx eslint src/lib/verify.server.ts src/lib/verify.test.ts src/lib/verify.server.test.ts` → exit 0.

## 8.4 Not done / boundaries

- **No full gate:** never ran `npm test`, `npm run build`, or `scripts/gate.sh`; only the three
  targeted test files, on `node v24.15.0` and the pinned `%LOCALAPPDATA%\hermes\node\node.exe`
  (v22.23.2).
- **No edit outside ownership.** `codegen.server.ts`, `codegen.server.test.ts` and every other
  tracked file are untouched by this resume; the caller contract (`oracleContractNames` →
  `signatureNames`) is consumed as-is. No tracked file deleted. No secret printed.
- **RED was captured pre-fix on node 24 only** (the fix was then applied in place; the shared tree's
  uncommitted prior-lane state makes a safe pre-fix re-run on node 22 impractical). GREEN was run on
  both legs.
- **The `contract`-empty boundary is a documented skip, not a weakened gate:** with no measured
  export surface there is nothing to bind against, so the enforcement no-ops exactly like
  `oracleBriefGrounded`'s vocabulary-free pass; `codegen.server.ts:4289-4293` always supplies the
  measured surface, so the production path always enforces.

---

# 9. 339-1 resume #2 (2026-10-02) — the typed-module harness compile blocker (THE decisive autonomy defect)

**Parent's evidence, reproduced exactly.** On a real keyed run the P6 gate hard-blocked at
`RT_E_GATE_PENDING` (`unmet: [p6-verified, p6-brief-fit]`); all three synthesis cycles'
`p6.synthesis.refused` read `RT_E_RUNNER_FAILED · machine-run cases still failing after 3
iterations: case-1: error ReferenceError: mean is not defined; … (source failed to compile in the
harness)`. Root cause: `buildHarness` (`verify.server.ts`) compiled the RAW synthesized module with
`new Function('exports','module','require', __SRC + …)`; the P6 prompt (`codegen.server.ts:557-624`,
rule 10 + the worked example `function add(a: number, b: number): number { … }`) now mandates
fully-typed TypeScript, and `new Function` is a JS-only parser — a typed module throws
`SyntaxError: Unexpected token ':'`, `__exports` stays empty, every case then errors
(`ReferenceError: mean is not defined`) or returns `false`. `p6-verified` can therefore never mint
`tested`, and `p6-brief-fit` is coupled to it.

## 9.1 The fix (exact bytes)

`src/lib/verify.server.ts` — one new import, one new exported helper, one changed line in
`buildHarness`:

```ts
// 339-1: the P6 prompt mandates fully-typed TypeScript (rule 10), but the
// harness compiles __SRC with the JS-only `new Function`. Strip the types on
// the PARENT side (Node builtin, present on both required runtimes) before the
// source is embedded, so the child needs no new API.
import { stripTypeScriptTypes } from "node:module";
```

```ts
export function stripTypeAnnotationsForHarness(source: string): string {
  try {
    return stripTypeScriptTypes(source, { mode: "strip" });
  } catch {
    return source;
  }
}

function buildHarness(source: string, cases: VerifyCase[]): string {
  const __src = stripTypeAnnotationsForHarness(source);
  return [
    "// rapidtool verify harness (machine-authored; do not trust the LLM's claims)",
    `const __SRC = ${JSON.stringify(__src)};`,
    …
```

(The helper carries a full doc comment naming the defect, the parent-side-once rule, the
plain-JS no-op, and the TS-only fallback.) `verify.server.test.ts` was not changed; `verify.test.ts`
gained 6 tests.

## 9.2 Runtime probe (both required runtimes agree)

```
node v24.15.0 / v22.23.2   typeof stripTypeScriptTypes === "function"
plain  "exports.add = (a, b) => a + b;\n"                 equalRaw=true
typed  "function mean(values: number[]): number {…}"      equalRaw=false  (types → spaces, valid JS)
iface  "interface P {…}"                                  equalRaw=false  (interface line blanked)
enum   "enum E { A }"                                     THREW SyntaxError: TypeScript enum is not supported in strip-only mode
esm    "export const x: number = 1;"                      → "export const x         = 1;"  (ESM preserved)
```

## 9.3 RED → GREEN (typed module, real runner)

**RED, before the fix — verbatim `runCases` bytes, identical on node 24 and node 22**
(`%TEMP%\rt339_1\probe_red.mjs`):
```
{"pass":false,"results":[{"id":"mean-avg","pass":false,"detail":"error ReferenceError: mean is not defined"}],"compileError":"source failed to compile in the harness"}
```
This is byte-for-byte the parent's real-run failure. The RED test run on node 24:
```
not ok 4 - strips TypeScript annotations from the module before compiling it
    error: |-
      unexpected compileError: source failed to compile in the harness
      + actual - expected
      + 'source failed to compile in the harness'
      - undefined
# tests 38  # pass 36  # fail 2
```

**GREEN, after the fix** (`%TEMP%\rt339_1\probe_red.mjs`, same two runtimes):
```
{"pass":true,"results":[{"id":"mean-avg","pass":true,"detail":"true"}]}
```
The test file: `# tests 42 / # pass 42 / # fail 0 / # skipped 0` on node 24 and node 22.

## 9.4 Tests added (6)

In `src/lib/verify.test.ts`, `runCases (real local runner)`:
1. `strips TypeScript annotations from the module before compiling it` — the rule-10 typed
   `function mean(values: number[]): number {…}` + `module.exports.mean = mean;`, case
   `mean([1,2,3]) === 2`; asserts `compileError === undefined`, case pass, run pass.
2. `measures HARNESS_EXPORTS from the stripped module (typed non-callable export is still vacuous)` —
   `const answer: number = 42; module.exports.answer = answer;` with case `answer === 42`; asserts the
   run-level `NO_CALLABLE_EXPORTS_REASON` (the inventory is measured from the stripped bytes, gate
   intact).
3. `falls back to the raw source on unsupported TS-only syntax (honest compile fail, not a pass)` —
   `enum E { A }` → `compileError === "source failed to compile in the harness"`.

New `describe("stripTypeAnnotationsForHarness (339-1)")`:
4. `is a byte-for-byte no-op on plain JavaScript` — arrow CJS module, generic-looking `a < b > c` /
   regex `/</g`, and `module.exports = { add }`: each returned `===` the input (the plain-JS pin).
5. `removes annotations but leaves the JavaScript statements intact` — no `: number`, function and
   `module.exports.add = add;` preserved.
6. `returns the raw source when the stripper rejects the input` — `function {{{` returned unchanged.

## 9.5 Regression (targeted files only, both runtimes)

| suite | node 24 | node 22 |
|---|---|---|
| `src/lib/verify.test.ts` | **42/42/0** | **42/42/0** |
| `src/lib/verify.server.test.ts` | **56/56/0** | **56/56/0** |
| `src/lib/codegen.server.test.ts` | **201/201/0** | **201/201/0** |

`npx eslint src/lib/verify.server.ts src/lib/verify.test.ts src/lib/verify.server.test.ts` → exit 0.
Every existing gate is intact: the 56-test server suite covers no-callable-exports, the
no-case-references-export gate, forged-result id validation, and the compile-fail path; the
name-binding enforcement tests (5) all pass. The gate code itself was not touched.

## 9.6 Chunked / multi-file path — what `verify()`/`runCases` actually receives

**Finding: the P6 multi-file route never calls `runCases` at all, so ESM can never reach the
harness from P6.** Bytes read in `src/lib/codegen.server.ts`:

- Routing (`:4017-4027`): `if (singleModuleLibraryKind(project) && chunkGroups.length <= 1) return
  synthesizeSingleModule(project, brief, specRecord, signatureNames, complete, verify, …);` … else
  `return synthesizeChunkedTree(project, brief, specRecord, complete, treeFailure, …);` — **`verify`
  is passed ONLY to `synthesizeSingleModule`**.
- `synthesizeChunkedTree`'s parameter list (`:4368-4383`) has `complete` but **no `verify` parameter**;
  the only `verify(` call in the whole file is `:4293` inside `synthesizeSingleModule`, fed
  `envelope.module` (raw CommonJS TypeScript, BEFORE materialization). `synthesizeSingleModule`
  materializes the one-file tree at `:4332-4337`; the chunked path's machine check is the tree-run
  lane (`mintTreeRunTested`, `:4846+`). Header contract (`:67-72`): "Machine verify — single-chunk
  (legacy) path only … Multi-chunk trees record no machine-verified lastTest."
- Had a barrel reached it, stripping would not help anyway: `materializeImportableTree` (`:3015-3018`)
  writes the entry as `export * from "…";` and each chunk as `import { … } from "…"; … export { … };`,
  and the probe above shows `stripTypeScriptTypes` leaves ESM syntax untouched — `new Function` still
  rejects it.

**Separate seam, STOP-and-REPORT (not the P6 blocker, not touched):** the manual Oracle-tab / CLI
path `headless.ts:4085 verifyGeneratedSource` passes `project.generatedSource` (the materialized ESM
barrel for any tree) through `withCommonJsExports` into `verifyAndFixServer` → `runCases`. That path
CAN hand ESM to the harness (`withCommonJsExports`, `verify.ts:120-132`, returns an ESM barrel
unchanged: no top-level `function X(` and no `module.exports`). Handling it needs a module-syntax
transform (ESM→CJS concatenation), which `stripTypeScriptTypes` does not perform and which is outside
this defect's evidence; it is a distinct pre-existing seam, not the P6 synthesis journey. Reported,
not expanded into.

## 9.7 Not done / boundaries

- **No full gate:** never ran `npm test`, `npm run build`, `scripts/gate.sh`, or `npm run typecheck`;
  only the three named test files, on `node v24.15.0` and `%LOCALAPPDATA%\hermes\node\node.exe`
  (v22.23.2).
- **No keyed LLM calls** — the harness is deterministic; no network.
- **No edit outside ownership.** Only `src/lib/verify.server.ts` and `src/lib/verify.test.ts` changed
  this resume (`verify.server.test.ts` needed no change). `codegen.server.ts` /
  `codegen.server.test.ts` are read-only evidence and stay untouched. No tracked file deleted. No
  secret printed.
- **The name-binding, vacuous, forged-result and compile-fail gates are unmodified** — the only new
  code is the stripper and its single call site; the fallback deliberately routes unsupported TS to
  the pre-existing honest `HARNESS_COMPILE fail`.

---

# 10. 339-1 resume #3 (2026-10-02) — verifier A's two findings, both real, both closed

**Independent verifier A** reproduced a **false machine pass** in the §9 strip fix and a **binding
trap** in the §8 name gate. Both are confirmed on the pre-resume bytes and fixed here; the honesty
contract (a machine `pass:true` may never be minted against bytes other than the module's real ones)
is the whole point of the lane.

**Owned files (STRICT):** `src/lib/verify.server.ts`, `src/lib/verify.test.ts`,
`src/lib/verify.server.test.ts`, this log. Scratch `%TEMP%\rt339_1\`. Runnable set: the three owned
test files only. No keyed calls (the binding tests use the existing `mockChat` fetch stub). No full
gate.

## 10.1 Defect 1 — `stripTypeAnnotationsForHarness` corrupted valid JavaScript (false attestation)

**Reproduced on the pre-resume bytes** (my `%TEMP%\rt339_1\repro.mjs`, Node 24; identical on Node
22), and in verifier A's `%TEMP%\rt339_va\{generic_probe,falsepass2}.mjs`:

```
in : const g = f(a < b, c > (d));        (valid JS: f((a<b), (c>d)))
out: const g = f(a          (d));          (TS parser read `< b, c > (` as a generic)
REAL module exports.r : false
OLD strip output      : "...module.exports.r = f(a          (d));\n"
OLD harness (false pass): {"pass":true,"r":true,"note":"true"}   <- pass minted on the MUTATION
```

The module's real `exports.r` is `false`; the old harness ran the rewritten bytes and returned
`runCases(...).pass === true` for `r === true && g(1, undefined) === true`. Verifier A's Mutation B
(never caught by the 42-test pin) was a colon-eating stripper that would also corrupt object
literals/ternaries.

### The fix — exact new bytes (`src/lib/verify.server.ts`, parse-first)

```ts
export function stripTypeAnnotationsForHarness(source: string): string {
  try {
    // Body-parse only — never invoked. A source the JS parser accepts is run
    // verbatim; only a source it rejects is TypeScript-stripped.
    new Function(source);
    return source;
  } catch {
    try {
      return stripTypeScriptTypes(source, { mode: "strip" });
    } catch {
      return source;
    }
  }
}
```

(The doc comment above it now states the parse-first rule, the exact
`f(a < b, c > (d))` misread it prevents, and the **named residual** below.)

### After — the fixture fails honestly (real output, both runtimes)

```
REAL module exports.r      : false
NEW strip output           : "...module.exports.r = f(a < b, c > (d));\n"
NEW strip === original     : true
NEW harness (honest)       : {"pass":false,"r":false,"note":"false"}
NEW runCases               : {"pass":false,"results":[{"id":"c1","pass":false,"detail":"false"}]}
```

## 10.2 Pins added (RED-first vs the pre-resume bytes)

Captured RED against the old helper bytes (`%TEMP%\rt339_1\evidence.mjs` re-runs the exact old
`stripTypeScriptTypes`-first body; the pre-fix `repro.mjs` run is the on-disk RED):

| pin | pre-fix (RED) | post-fix (GREEN) |
|---|---|---|
| **ambiguity** — `const g = f(a < b, c > (d));` | `OLD DIFF` → `f(a          (d))` | `NEW SAME` |
| **colon (object literal)** `{ a: 1, b: "x:y", c: true }` | (old also SAME; guards Mutation B) | SAME |
| **colon (ternary)** `cond ? 1 : 2` | SAME | SAME |
| **colon (label)** `outer: for (…)` | SAME | SAME |
| **colon (default param)** `function f(a = 1, b = a + 1)` | SAME | SAME |
| **false-pass fixture** (`falsepass2`), real `exports.r === false` | `runCases.pass === true` | `runCases.pass === false` |

Permanent tests in `src/lib/verify.test.ts`:
- `never re-parses an ambiguous generic-looking plain-JS call as TypeScript` (byte pin).
- `is a no-op on colon-bearing plain JavaScript (object literal, ternary, label, default param)`.
- `runs the ORIGINAL bytes for an ambiguous generic-looking module (never a mutation pass)` — asserts
  the module's REAL bytes evaluate `r` to `false` (via `new Function`) **and** the harness case
  `r === true && g(1, undefined) === true` is `pass:false`.

## 10.3 The no-op claim, now literally true — and the residual named

The docblock now claims byte-identity only for **sources the JS parser accepts** (unconditionally true:
those return `source` before the stripper is ever consulted). The named residual: `new Function` also
refuses a valid-JS MODULE body (`import`/`export`, top-level `await`), which still reaches the
stripper — `export const g = f(a < b, c > (d));` really does come back rewritten
(`%TEMP%\rt339_1\residual.mjs`). This is **not** a false pass: the child harness compiles `__SRC` with
the *same* `new Function`, so a source this guard refused cannot run there either —
`runCases` reports `source failed to compile in the harness`, `pass:false` (verified live: the ESM
probe returns `{"pass":false,...,"compileError":"source failed to compile in the harness"}`). The
byte-identity guarantee is therefore not universal by construction, and the docblock says so.

## 10.4 Defect 2 — the tolerated declaration repair was a trap

**Reproduced** (`%TEMP%\rt339_1\repro.mjs`, pre-resume bytes): `sanitizeOracleExpression` accepted
`declaration(s); final-boolean`, discarded the declarations, and the final boolean then threw at run
time:

```
"const nums = [1,2,3]; mean(nums) === 2"      => pass=false detail="error ReferenceError: nums is not defined"
"const nums = [1,2,3]\nmean(nums) === 2"      => pass=false detail="error ReferenceError: nums is not defined"
```

and the value-read bypasses committed with **no** retry in `generateCases`
(`undefinedCalledNames` was call-position-only):

```
"missing === 2 && mean([1,2,3]) === 2"        => []      (gate saw no offender)
"obj.mean() === 2"                            => []      (obj not in call position)
"(0, missing)([1]) === 2 && mean([1,2,3]) === 2" => []   (missing not immediately before `(`)
```

### Fix A — declaration-prefix binding (`sanitizeOracleExpression`)

`finalStatementAfterDeclarations` became `splitDeclarationPrefix(src): { final, bound } | null`,
where `bound` is the names the (all-`const`/`let`/`var`) prefix binds — `declaredNames()` parses each
declarator at top level, collecting the identifiers left of `=` (simple names and whole destructuring
patterns; a superset, so it can never under-report a binding). After the strict scan, a form-(b) final
boolean whose **value reads** intersect `bound` is refused **up front**:

```
"const nums = [1,2,3]; mean(nums) === 2"   => {"ok":false,"reason":"declarations are not executed — rewrite as ONE expression"}
"const nums = [1,2,3]\nmean(nums) === 2"   => {"ok":false,"reason":"declarations are not executed — rewrite as ONE expression"}
"let a = 1;\nconst b = 2;\na + b === 3"    => {"ok":false,"reason":"declarations are not executed — rewrite as ONE expression"}
"const a = 1; computeMean([1,2,3]) === 2"  => {"ok":true,"expression":"computeMean([1,2,3]) === 2"}   (no read -> still tolerated)
```

and the harness now reports it as a rejection, not a `ReferenceError`:

```
NEW runCases trap : {"pass":false,"results":[{"id":"c1","pass":false,"detail":"expression rejected by
harness safety check — declarations are not executed — rewrite as ONE expression (case: c1) …"}],
"compileError":"one or more case expressions failed the harness safety check: c1 — declarations are not executed — rewrite as ONE expression"}
```

### Fix B — value-read identifiers (`undefinedCaseIdentifiers`, renamed from `undefinedCalledNames`)

The predicate now returns every **value-position read** (called *or* merely referenced) that is not in
`contract`, not a pinned global/keyword/literal, and not bound by the expression's own declaration
prefix. Property names after `.`, object-literal keys, labels, regex and string content stay unflagged;
numeric literals (`1e5`/`0x1F`/`2n`) are masked so they are not read as names; the tolerated
`declaration(s); final-boolean` repair is scanned at its **final** statement only.

```
"missing === 2 && mean([1,2,3]) === 2"        => ["missing"]
"obj.mean() === 2"                            => ["obj"]
"(0, missing)([1]) === 2 && mean([1]) === 1"  => ["missing"]
"typeof missing === 'undefined'"              => ["missing"]
"mean(nums) === 2"                            => ["nums"]     (the `;` form after parseOracleCases' split)
"const nums = [1,2,3]\nmean(nums) === 2"      => []           (prefix-bound name is the SANITIZER's call, Fix A)
```

`generateCases`' repair/refusal wording moved from "CALL" to "reference" (the refusal string still
contains `undefined identifier`, so the existing matcher is stable). Two new `verify.server.test.ts`
tests prove the repair retry now fires for a bare value read and for `obj.mean()`.

### No-over-rejection evidence

A table-driven pin in `verify.test.ts` asserts `undefinedCaseIdentifiers(e, ["mean","median"]) === []`
for **21 bound forms** — `Math.max`, `Number.isFinite`, `JSON.stringify`, `Object.keys`,
`Array.isArray`, `String`, `Boolean`, `Date.now`, `RegExp`, `parseInt`, `parseFloat`, `isNaN`,
`isFinite`, `encodeURIComponent`, `structuredClone`, a method on an export (`.toString()`), a ternary,
`typeof` (both `typeof x` and `typeof(x)`), `typeof mean`, and `1e5`/`0x1F`/`2n` literals. A scratch
sweep of the same set (plus string content) reports **0 over-rejections**. The `generateCases`
control test (a fully-bound set commits with **no** retry) still passes on both runtimes.

## 10.5 Regression (targeted files only, both runtimes)

| suite | node 24.15.0 | node 22.23.2 |
|---|---|---|
| `src/lib/verify.test.ts` | **49/49/0** | **49/49/0** |
| `src/lib/verify.server.test.ts` | **58/58/0** | **58/58/0** |
| `src/lib/codegen.server.test.ts` | **202/202/0** | **202/202/0** |
| combined run | **309/309/0** | **309/309/0** |

`npx eslint src/lib/verify.server.ts src/lib/verify.test.ts src/lib/verify.server.test.ts` → exit 0.

**On the codegen count (measured, not assumed).** The brief says "must stay 201/201". This lane did
**not** touch `codegen.server.ts` / `codegen.server.test.ts` (read-only evidence), and test
registration is static — my production change cannot move that count. The shared worktree currently
registers **202** `it(` in `src/lib/codegen.server.test.ts` (HEAD has 186; the file carries another
lane's uncommitted work, mtime 23:41 tonight) and it passes 202/202 on both legs. The 201→202 drift is
concurrent lane work in the shared tree, not a regression from this resume.

## 10.6 Residual bypasses, named honestly (not false passes)

- **Empty `contract` ⇒ the value-read gate no-ops** (pre-existing, documented boundary: nothing
  measured to bind against; `codegen.server.ts` always supplies the measured surface).
- **A prefix-bound name read by the final boolean is excluded here** and refused by the **sanitizer
  at run time** (Fix A) rather than at generation time. For the `;` form `parseOracleCases` drops the
  prefix first, so the residual read reaches this gate as `["nums"]` and IS repaired up front; for the
  newline/ASI form the case commits and then fails honestly at `runCases` with the precise
  "declarations are not executed" reason in the evidence (never a false pass).
- **Real globals outside the pinned allowlist** (`Proxy`, `Reflect`, `Intl`, …) are treated as
  offenders. That is the same boundary the previous call-position gate already drew; it can only
  over-reject (→ repair), never mint a pass.
- The gate is regex-based and cannot see a dynamically constructed name — but dynamic construction
  requires `eval`/`Function`/`globalThis`, all rejected by the sanitizer, so no such case can commit
  and run.

## 10.7 Not done / boundaries

- **No full gate:** never ran `npm test`, `npm run build`, `scripts/gate.sh`, or `npm run typecheck`;
  only the three named test files, on `node v24.15.0` and `%LOCALAPPDATA%\hermes\node\node.exe`
  (v22.23.2), plus scratch probes under `%TEMP%\rt339_1\`.
- **No keyed LLM calls** — the binding tests stub `fetch`; the harness is deterministic.
- **No edit outside ownership.** Only `src/lib/verify.server.ts`, `src/lib/verify.test.ts` and
  `src/lib/verify.server.test.ts` changed this resume. No tracked file deleted. No secret printed.
  (`codegen.server.test.ts`'s 202 count is another lane's uncommitted work, untouched by me.)
- **RED evidence** is the pre-resume on-disk run (`repro.mjs`) plus the old-helper replay in
  `evidence.mjs`; GREEN is the post-fix run on both runtimes.

