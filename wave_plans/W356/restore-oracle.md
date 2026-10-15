# W356 · lane `restore-oracle` — the oracle emitter: honest, counted, and not an unavoidable red

**Wave:** W356 (green recovery + ratchet). **Persona:** `quill`. **Author:** the wave parent.
**You are 1 of 6 lanes.** Read this FIRST — it is your authoritative plan.

## Mission

Keep the 354 wave's honesty intent, remove its side effect, and restore the safety default for
below-floor emission.

Verified facts (parent + adversarial panel, `fixes/355_0_audit_wave.md` §2.2):

- The working tree's `src/lib/scaffold.ts` replaced `test.skip` with a reachable
  `assert.fail("<id> is NOT IMPLEMENTED")` for unwired oracle rows (WT `:6219` header + `:6374`;
  HEAD `:2813` emitted `test.skip`). Counts: HEAD `test.skip`=14 / `assert.fail`=5 / `skipDominated`=6
  → WT `test.skip`=4 / `assert.fail`=7 / `skipDominated`=0.
- Measured: a partial emission's own `npm test` → `not ok 10 - orc-phase`, `# pass 9 # fail 1`, exit 1.
- **Panel correction:** a *complete* keyless run (`runHeadless(seed, ALL_PHASES)`) is **15/15 pass** —
  so "no emission can ever be green" is false. The defect is conditional on an emission carrying an
  unwired row, and it makes `emit --git` withhold for those.
- The working tree's `underProduced` default flipped to `"partial"` (`:8535-8536`; HEAD `:4141` default
  was **refuse**), so a caller asking for refusal still gets files.

## Owned files (yours alone)

- `src/lib/scaffold.ts` + `src/lib/scaffold.test.ts` — you own the test file too, **including** its two
  drifted cases at `:2712` / `:2719` (`Property 'gameTemplate' does not exist on type 'ScaffoldResult'`;
  the parent's audit classified both **test-wrong** — `okFiles()` never narrows the union, so fix the
  test's narrowing, not the source).

## MINI-TASK PLAN

1. **An unwired row must not condemn the tree.** Change the emitter so an unwired oracle row is
   emitted as an honest **skip that is surfaced and counted** (a row-level shortfall marker + a counted
   total on the emitted README/spec header) rather than an `assert.fail` that fails the whole tree. Keep
   the 354 intent: the shortfall must be **visible and never silent** — the point is honesty, and a
   skip plus a counted banner is the honest form that still lets a real product be delivered.
2. **Restore the safety default.** `underProduced` absent ⇒ **`"refuse"`**; `"refuse"` ⇒ **write zero
   files**; `"banner"` / `"partial"` ⇒ land the partial **with** the unmissable RED TREE banner. Keep
   the banner code path intact — a caller may still deliberately ship a labeled partial.
   The cross-lane contract: `restore-census` makes `headless.ts` forward the policy explicitly on every
   path; you make `scaffold.ts` honor it. Both halves must land.
3. **Re-verify both directions.** After your change the repo's own test
   `--test-name-pattern="default refuses before writing"` must pass; a partial emission whose rows are
   all wired must reach `treeRun.ok === true`; a partial with unwired rows must be **green while
   reporting its shortfall**.
4. **No regressions in the emitted tree's shape.** The emitted `tests/oracle.spec.ts` must still be
   real, runnable, and honest; keep every existing assertion for rows that *are* wired. Do not weaken
   an assertion to reach green — the honesty doctrine and the prevention guards both depend on this.

## Verification (exact commands)

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts
node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="default refuses before writing" src/lib/headless.test.ts
# then one bounded KEYLESS emit + the emitted tree's own toolchain, into %TEMP% (never the repo)
```

## Logging

`fixes/356_restore_oracle.md` — skeleton first, then append. Record: the old→new row semantics, both
measured emission outcomes (partial-with-unwired-rows and complete), and anything deferred.

## Do not

- Do not edit `src/lib/headless.ts` or `compile-check.server.ts` (`restore-census`), `scripts/**`
  (`restore-guards`, `restore-tests`), any doc, the register, or another lane's log.
- Do not delete an assertion to reach green. Do not run `gate.sh` / `npm run build` / full `npm test`.
  Do not make a keyed LLM call. No git writes.
- **No mock/stub/fake/demo code on a production path** — test doubles only in test files.
