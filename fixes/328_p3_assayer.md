# fixes/328 · Persona 3 (Assayer — Verification & Oracle Honesty Engineer)

**Wave:** 328 (5-lane, concurrent). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` ·
branch `main` · HEAD `a1f4f10`. **Tree at wave start:** my owned files were untouched
(`git status` showed only sibling edits: `scripts/rapidtool-cli.mjs`, `src/components/console.tsx`,
`src/lib/codegen.server.ts`, `src/lib/headless.ts`, `src/lib/quarantine.ts`, `fixes/328_p1_ledger.md`,
`fixes/328_p4_switchboard.md` — none of them mine).
**Runtime:** pinned Node 22 (`C:\Users\mnril\AppData\Local\hermes\node\node.exe`, v22.23.2).

**Owned files:** `src/lib/verify.server.ts`, `src/lib/verify.server.test.ts`, `src/lib/algo-tools.ts`,
`src/lib/algo-tools.test.ts`, `src/lib/compile-check.server.ts` (no defect found — coverage report
below). I am the only writer of this log.

**Method (RESUME §13.2/§13.3):** every finding was reproduced against today's bytes with a throwaway
probe OUTSIDE the repo (`C:\Users\mnril\rt_328_p3\`), fixed with production code + regression tests
with TEETH (revert the module to `git show HEAD:<path>` in a scratch tree, run the new tests, show
the new assertion goes RED there / GREEN on the fix). No `git checkout/stash/reset/clean/commit`
was run at any point.

---

## Verdict summary

| # | Finding | Status | Where |
|---|---|---|---|
| 1 | `parseOracleJson` collapses "unparseable" vs "zero cases" | **FIXED** (return-type change via a new discriminating API; legacy kept byte-stable) | `verify.server.ts:268-357`, `:910-938` |
| 2 | `exportedNamesOf` under-inventories ESM (multi-declarator / destructured) | **FIXED** | `algo-tools.ts:170-343` |
| 3 | `complexityOf` residuals: extra `while (cond);` not counted; phantom `/do/` regex | **FIXED** (both) | `algo-tools.ts:664-733`, `:786+` |
| 4 | `runCases` vacuity for a vocabulary-free brief | **TIGHTENED** (a runner-level reference gate — feasible without false-rejecting the prompt's allowed forms) | `verify.server.ts:494-509`, `:609-628`, `:677-687` |

**Suites (pinned Node 22, TAP):**

| Suite | HEAD baseline (before my *tests*) | After | Δ |
|---|---|---|---|
| `src/lib/verify.server.test.ts` | 27 / 0 fail | **36 / 0 fail** | **+9** |
| `src/lib/verify.test.ts` (not owned; run per brief) | 26 / 0 fail | **26 / 0 fail** | 0 |
| `src/lib/algo-tools.test.ts` | 28 / 0 fail | **38 / 0 fail** | **+10** |

**Typecheck:** `npm run typecheck` → exit **0**, zero `error TS` (ran after the source edits and again
after the test edits).

---

## Finding 1 — `parseOracleJson` collapsed "unparseable" with "zero cases"

**File:** `src/lib/verify.server.ts:269` (HEAD). Registered owed by the 327 lane
(`fixes/327_l5_verify_packet.md` §N-1; `fixes/257_error_ledger_v3.md:230` OV-13 residual).

### Probe — before (today's bytes, `%TEMP%`-class scratch: `C:\Users\mnril\rt_328_p3\probe1.mjs`)

```
=== FINDING 1: parseOracleJson collapse ===
  "not json"                                    => null
  "{}"                                          => null
  "{\"cases\":[]}"                              => null          <-- valid JSON, zero cases
  "{\"cases\":[{\"id\":\"\",\"expression\":\"x\"}]}" => null      <-- all rows skipped
  "{\"cases\":[{\"id\":\"a\",\"expression\":\"1===1\"}]}" => [{"id":"a","expression":"1===1"}]
  "[1,2,3]"                                     => null
```

`{"cases":[]}` is indistinguishable from `not json`.

### The fix (return-type change, done without touching a non-owned pin)

`parseOracleJson`'s `VerifyCase[] | null` contract is branched on by `sweep73-fuzz.test.ts`
(NOT my file: `parseOracleJson(...) === null` on junk rows). Changing the signature in place would
force an edit there → rule 5 says stop. So the discriminating form is a **new export** and the legacy
function delegates to it, keeping its bytes and behavior identical:

- `verify.server.ts:268` — `export type OracleCasesParse = { ok: true; cases } | { ok: false; reason: "empty" | "unparseable" }`.
- `verify.server.ts:287` — `export function parseOracleCases(text): OracleCasesParse` (the moved body).
- `verify.server.ts:354` — `export function parseOracleJson(text)` now `return parsed.ok ? parsed.cases : null` — **byte-stable**.

`"unparseable"` = no case array decoded (non-string / bad JSON / wrong-typed `cases`).
`"empty"` = a case array decoded but produced **zero usable rows** (explicitly `[]`, or every row
skipped for a missing id/expression). `ok: true` always carries ≥1 case.

**Wired the distinction where it changes a verdict** — `generateCases` (`verify.server.ts:907-938`):
an empty-but-valid reply now gets an **honest retry prompt** ("valid JSON but carried no cases") and,
if it persists, the coded refusal `RT_E_VALIDATION` + `/empty oracle/` message — instead of the old
false "your previous reply was not valid JSON" and `RT_E_INTERNAL`. `propertyTestsFor`
(`algo-tools.ts:401-414`) now uses `parseOracleCases` too: `empty property set` vs
`unparseable property payload`.

### Probe — after

```
  "not json"          cases={"ok":false,"reason":"unparseable"} legacy=null
  "{}"                cases={"ok":false,"reason":"unparseable"} legacy=null
  "{\"cases\":[]}"    cases={"ok":false,"reason":"empty"}       legacy=null   <-- discriminated
  all-junk rows       cases={"ok":false,"reason":"empty"}       legacy=null
  valid               cases={"ok":true,"cases":[...]}           legacy=[...]
```

### Teeth (scratch `C:\Users\mnril\rt_328_p3\teeth\lib\verify.server.ts` = `git show HEAD:…` + an
old-semantics shim exposing the new names; see §"Teeth method" below)

- RED on HEAD: `not ok 1 - a valid-but-empty reply is 'empty' — NOT 'unparseable' (the owed pin)`;
  `not ok 1 - a valid-but-empty reply gets the EMPTY repair prompt, never 'not valid JSON'`
  (expected `RT_E_VALIDATION`, actual `RT_E_INTERNAL`).
- GREEN on the fix: `verify.server.test.ts` 36/36.

### Count change
`verify.server.test.ts` **27 → 36 (+9)**: 3 parseOracleCases tests + 2 generateCases empty/unparseable
tests (the other +4 belong to finding 4).

---

## Finding 2 — `exportedNamesOf` under-inventories ESM

**File:** `src/lib/algo-tools.ts:177` (HEAD). Registered by the 327 lane
(`fixes/327_l4_algorithms.md` §"Reproduced but intentionally NOT fixed").

### Probe — before

```
  "export const a = 1, b = 2;"        => ["a"]     <-- b missed
  "export let a, b, c;"               => ["a"]
  "export const {x} = o;"             => []
  "export const {a: b, c: d} = o;"    => []
  "export const [p, q] = arr;"        => []
  "export const {a = 1, ...rest} = o;" => []
  "export const m = 1, {n} = o, [r] = arr;" => ["m"]
```

The only consumer is `propertyTestsFor`'s prompt line *"The module exports these names ONLY — never
invent others: …"* (`algo-tools.ts:355`). **Precise blast radius (honest scope):** this is a
**generation-time prompt inventory**, not a refusal path — `runCases`' "no callable names" verdict
reads the harness's own runtime `HARNESS_EXPORTS` (`verify.server.ts`), never `exportedNamesOf`. So
the brief's "false vacuum verdict" phrasing overstates it: the defect is that the prompt can assert
`(none)` (or a partial list) for a module that does export callables, pushing the model to write
cases against a wrong inventory. Real, fixed; the refusal-path claim does not reproduce.

### The fix

Replace the single-name regex with a declarator-list + binding-pattern parser over `maskNonCode`'s
masked view (strings/comments/regex already blanked → a separator can only be real code):
`esSkipWs`/`esReadIdent`/`esSkipBalanced`/`esSkipDefault`/`esCollectBindingNames`/`esmDeclaratorNames`
(`algo-tools.ts:170-299`), then `exportedNamesOf` runs `esmDecl` (function/class) and `esmVar`
(`const|let|var` → declarator list) at `:337-343`.

### Probe — after

```
  "export const a = 1, b = 2;"        => ["a","b"]
  "export let a, b, c;"               => ["a","b","c"]
  "export const {x} = o;"             => ["x"]
  "export const {a: b, c: d} = o;"    => ["b","d"]        (renames: the TARGET binds)
  "export const [p, q] = arr;"        => ["p","q"]
  "export const {a = 1, ...rest} = o;" => ["a","rest"]
  "export const m = 1, {n} = o, [r] = arr;" => ["m","n","r"]
  "export const a = f(1, 2), b = [3, 4];"  => ["a","b"]   (initializer commas do not leak)
  "export default function f() {}"    => []               (control: no hoisted name)
```

### Teeth
- RED on HEAD: all three new `exportedNamesOf — ESM multi-declarator + destructuring (328 P3)` tests.
- GREEN on the fix; the pre-existing T-08 CJS tests and `sweep73-fuzz` mixed-name test remain green.

### Count change
`algo-tools.test.ts` **+3** from this finding (part of 28 → 38).

### Remains (honest)
`export { a, b as c }` re-export lists are STILL not inventoried (out of the finding's named scope:
multi-declarator + destructured). Registered here as a known residual, not fixed.

---

## Finding 3 — `complexityOf` residuals

**File:** `src/lib/algo-tools.ts:~620` (HEAD; `fixes/327_l4_algorithms.md` §"Reproduced but
intentionally NOT fixed"). Both residuals reproduce.

### Probe — before

```
  empty-body while (standalone)   loops=0  O(1)   <-- a real busy-wait loop, missed
  do-while braced (control)       loops=1
  do-while unbraced (control)     loops=1
  plain while braced (control)    loops=1
  phantom /do/ after if-block     loops=1  O(n)   <-- phantom
  phantom /do/ statement pos      loops=1  O(n)   <-- phantom
  real do + regex body (control)  loops=1
```

### The fix
- **(a) `while (cond);`** — the old rule skipped EVERY `while (...)` whose body is `;` (meant for
  do-while tails). Now the terminator is identified by the `do` that owns it:
  `doWhileTerminatorIdx` (`algo-tools.ts:698`) computes the `while` index from the `do` body
  (braced → matching `}`; unbraced → statement `;`); a `Set doTerminators` (`:788`) records it and the
  skip fires **only** for a recorded terminator. A standalone `while (cond);` now counts.
- **(b) phantom `/do/`** — `do` has no parenthesized head to key on (326's guard for `for`/`while`),
  so a statement-position regex literal the masker left as code still matched. A real `do` keyword is
  never flanked by a regex literal's `/` delimiters: skip when `masked[kwIdx-1] === "/"` or
  `masked[kwEnd] === "/"` (`algo-tools.ts:~819`).

### Probe — after

```
  empty-body while (standalone)   loops=1  lines=[1]  O(n)   <-- FIXED
  do-while braced (control)       loops=1
  do-while unbraced (control)     loops=1
  plain while braced (control)    loops=1
  phantom /do/ after if-block     loops=0  O(1)              <-- FIXED
  phantom /do/ statement pos      loops=0  O(1)              <-- FIXED
  real do + regex body (control)  loops=1                    <-- not regressed
```

### Teeth
- RED on HEAD: `counts a standalone while (cond); empty-body loop`, `does not phantom-count a
  statement-position /do/ regex literal`, and `control: a do followed by a SEPARATE empty-body while
  counts BOTH` (the last one catches the naive "skip every `while(…);`" regression).
- GREEN controls on HEAD **and** on the fix: braced + unbraced do-while stay `loops=1`; real `do`
  with a regex body stays `loops=1`. This is the false-positive control the brief required.

### Count change
`algo-tools.test.ts` **+5** from this finding (3 RED-on-HEAD + 2 controls).

---

## Finding 4 — `runCases` vacuity for a vocabulary-free brief

**Where the 327 lane left it:** `fixes/327_l5_verify_packet.md` §N-4 (it labelled the item
`oracleBriefGrounded`, not `runCases`, and recorded it as a deliberate floor because tightening at
the *briefing* layer would false-reject the prompt's allowed form `typeof buildPlan === 'function'`).

### Probe — before (`probe2.mjs`)

```
oracleBriefGrounded(literal, brief="", no sigs, callable src) => {"ok":true}
runCases:
  literal-only case (1===1)              pass=true  compileError=undefined   <-- VACUOUS PASS
  object-bookkeeping literal             pass=true  compileError=undefined   <-- VACUOUS PASS
  typeof export (allowed form)           pass=true
  calls export (allowed form)            pass=true
```

A module that exports callables, with a case set that never touches it, minted a "machine-verified"
pass. The 327 lane was right that a **briefing-layer** requirement to *call* an export would
false-reject `typeof buildPlan === 'function'`; but the tighter verdict belongs in the **runner**,
where the module's export inventory is measured, not guessed (109 C-01's original design: intersect
the case identifiers with the runner's own `HARNESS_EXPORTS`).

### The fix (tightening, not a strike)
After the existing no-callables gate, `runCases` requires **at least one case to NAME a measured
callable export** — reference, not call (`verify.server.ts:609-628`; helper `referencedIdentifiers`
`:677-687`; reason `NO_EXPORT_REFERENCE_REASON` `:501`). Because the inventory is measured from what
actually compiled, it cannot be forged.

### Probe — after

```
  literal-only (1===1)                  pass=false  compileError="no oracle case references an exported callable name — machine verification is vacuous"
  object-bookkeeping literal            pass=false  compileError=<same>
  typeof export (allowed form)          pass=true   <-- allowed form preserved
  calls export (allowed form)           pass=true   <-- allowed form preserved
  mixed good+literal                    pass=true
  real compile error still reported     pass=false  compileError="source failed to compile in the harness"
```

### Teeth
- RED on HEAD: `a literal-only set can no longer mint a machine pass` and `an object-bookkeeping
  literal is refused too`.
- GREEN on HEAD **and** on the fix: both prompt-allowed controls (`typeof buildPlan === 'function'`,
  `add(2,3) === 5`) and the mixed-set control. `verify.test.ts` (not owned) stays 26/26 — all its
  `runCases` cases reference their export, and its compile-failure / zero-cases rows return before the
  new gate.

### Scope note / residual
The gate is **set-level** ("≥1 case references an export"), chosen over per-case strictness to avoid
false-rejecting a set with one real case; a set of one real + several literal cases still passes. The
briefing-layer floor at `oracleBriefGrounded` (`targets.length === 0 → ok`) is unchanged.

### Count change
`verify.server.test.ts` **+4** from this finding.

---

## Teeth method (the exact scratch procedure)

`C:\Users\mnril\rt_328_p3\` (outside the repo):

1. `make_teeth.ps1` copies `src/lib` → `teeth\lib`, junctions `teeth\node_modules` →
   the repo's `node_modules` (package resolution for the copied tree).
2. `extract.bat` writes `git show HEAD:src/lib/{algo-tools,verify.server}.ts` **byte-exactly** via
   `cmd` redirection (a first attempt used PowerShell string round-tripping, which re-encoded the
   UTF-8 em-dashes and broke the pre-existing E-08 byte-parity tests — caught and corrected; the
   final runs are byte-faithful).
3. `verify.server.ts` gets an **old-semantics shim** appended so the new tests LOAD against HEAD:
   `parseOracleCases` maps `parseOracleJson`'s `null` to `"unparseable"` (never `"empty"`), and
   `NO_EXPORT_REFERENCE_REASON` is a constant (HEAD's `runCases` has no reference gate). The shim
   encodes HEAD's behavior through the new names; it is not part of the shipped fix.
4. Run the **new** test files from the scratch tree.

Results (pinned Node 22):
```
teeth\lib\algo-tools.test.ts      # tests 38 / pass 31 / fail 7   (7 = the new fix assertions)
teeth\lib\verify.server.test.ts   # tests 36 / pass 32 / fail 4   (4 = the new fix assertions)
```
Every pre-existing test passed on the reverted modules; **11 new assertions went RED on HEAD** and all
are **GREEN on the fix** (`38/38`, `36/36`).

---

## Verification (all commands run by me, pinned Node 22)

```
npm run typecheck                                                # exit 0, no error TS
node --experimental-strip-types --test --test-reporter=tap src/lib/verify.server.test.ts  # 36/36, 0 fail
node --experimental-strip-types --test --test-reporter=tap src/lib/verify.test.ts          # 26/26, 0 fail
node --experimental-strip-types --test --test-reporter=tap src/lib/algo-tools.test.ts      # 38/38, 0 fail
```

No assertion was weakened and no test was deleted; the legacy `parseOracleJson` contract is
byte-stable, so `sweep73-fuzz.test.ts` (not mine) is unaffected.

---

## `compile-check.server.ts` — no defect found; coverage report (for the parent)

No dossier finding in my brief names this file, and I made no change to it. Suites that exercise it
(the parent should run these; the private suite is **not** mine):

| Suite | How it uses the seam |
|---|---|
| `src/lib/compile-check.server.test.ts` | the private suite (per-file verdict + `treeRun`/`verifyKindDir`) |
| `src/lib/honesty-guards.test.ts` | imports `verifyKindDir` |
| `src/lib/headless.test.ts` | `treeRun` via headless + the `TreeRunOutcome` type |
| `src/lib/maker-score.test.ts` | `TreeRunOutcome` type |
| `src/lib/wild-step.test.ts` | `TreeRunOutcome` type |
| `scripts/rapidtool-cli.mjs` / `scripts/run-eval.mjs` | lazy/real consumers (`tree-run`, `emit --run`) — their `*.test.mjs` suites exercise the path |

Non-test consumers: `src/lib/codegen.server.ts` (type), `src/lib/headless.ts` (treeRun seam),
`src/lib/error-scan.server.ts`, `src/lib/entry-oracle.ts` (docs/comments).

---

## What remains / notes for the parent

- **`fixes/257` pin is still owed.** The register entry (`fixes/257_error_ledger_v3.md:230`, OV-13)
  asked for a pin distinguishing `:840/:845` ("unparseable oracle payload") from `:469` ("no cases to
  run"). The code now distinguishes them, but `fixes/257` is **append-only and outside my file
  ownership** — I did not touch it. The pin lands in `verify.server.test.ts` (this log's Finding 1);
  whoever owns the ledger should add the `[W31/328-P3]` marker.
- **`exportedNamesOf` still misses `export { a, b as c }` re-export lists** (Finding 2 "Remains").
- **`runCases` reference gate is set-level**, not per-case (Finding 4 "Scope note").
- Sibling edits were live during this wave; I ran only targeted checks, never the full gate.
