# W357 · lane `fix-tests` — attribute and close the residual test failures

**Wave:** W357. **Persona:** `quill`. **Author:** the wave parent. Read this FIRST.

## Mission

Attribute every residual failure to the right file and close the ones you own, plus the surviving
reachable `assert.fail` the cartographer found.

## The evidence

The W356 boundary gate (`fixes/356_0_boundary.md` §2) measured:
`testsScripts {pass:643, fail:7}` · `testsLib {pass:4215, fail:5, skipped:2}`.

**Neither set has been attributed to files yet** — the gate logged only stage tails, and the src leg had
never run before, so some of these may be pre-existing and some may be new. **Attribution is your first
task.** Known candidates already on the record:

- the cartographer measured `scaffold.test.ts` **130/133** (tests 10/20/26 red) and
  `wild-step.test.ts` **43/44** (test 11 red) at its pin, and traced `scaffold.test.ts:1771` / `:2762`
  (the pre-existing UI-generation reds) to `scaffold.ts:8915-8952` (351/353 site precedence,
  byte-identical to the audit baseline);
- `restore-oracle` reported that a second gate, `RT_E_SPEC_SKIP_VACUOUS` at `scaffold.ts:8284`, can still
  redden the "green while reporting its shortfall" boundary;
- **R-7:** a reachable `assert.fail` survives at `scaffold.ts:6323` / `:6396`.

## Owned files (yours alone)

`src/lib/scaffold.ts` · `src/lib/scaffold.test.ts` · `src/lib/wild-step.test.ts` ·
`src/lib/headless.test.ts` · plus any residual test file that no other W357 lane owns

## MINI-TASK PLAN

1. **Attribute first.** Run both legs and produce the full failing list, then assign each to a file and
   state whether the **source** or the **test** is wrong. Record in your log: `item | file:line | source
   or test | new or pre-existing | owner`. Where the owner is another lane (`fix-build`, `fix-lint`,
   `fix-gates`, `fix-preview`), report it and leave the file alone.
2. **Close the ones you own.** Fix the cause each time — and where a test's expectation is the wrong
   side, fix the test and say so explicitly.
3. **R-7:** remove the surviving reachable `assert.fail` at `scaffold.ts:6323/6396` if it can still fail
   a tree; the `restore-oracle` semantics are that an unwired row is a surfaced, counted skip, so a
   reachable `assert.fail` left behind contradicts them. Verify no assertion for a **wired** row changes.
4. **The `RT_E_SPEC_SKIP_VACUOUS` boundary:** prove whether a "green while reporting" emission can still
   be reddened by that gate, and if so, either fix it or record it precisely as a named residual with the
   input that triggers it.
5. **The 351/353 site-precedence reds:** do **not** paper over them. If they are pre-existing and out of
   your judgement, record them as a named residual with the evidence and the exact decision needed.

## Verification

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
node --test --test-reporter=tap "scripts/**/*.test.mjs"
node --experimental-strip-types --test --test-reporter=tap "src/lib/**/*.test.ts" "src/components/**/*.test.ts"
```
(These are the two real legs. If a sibling lane is mid-edit, attribute any transient red by file mtime and
re-run before believing it.)

## Logging

`fixes/357_fix_tests.md` — skeleton first, then append: the attribution table, each fix (old→new), the
R-7 outcome, the `RT_E_SPEC_SKIP_VACUOUS` finding, and every residual with its owner.

## Do not

- Do not edit `vite.config.ts`/`migrations/**` (`fix-build`), `eslint.config.mjs` (`fix-lint`),
  `scripts/check-module-coverage.mjs`/`quality-ratchet*` (`fix-gates`), `src/lib/software-export*` or any
  doc (`fix-preview`), the register, or another lane's log.
- Do not delete, skip, or loosen an assertion to reach green. A skip must be registered with its reason.
- No keyed LLM call. No git writes. **No mock/stub/fake/demo code on a production path.**
