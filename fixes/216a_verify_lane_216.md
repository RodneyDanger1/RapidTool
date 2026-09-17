# fixes/216a — verify-lane correctness (109's T-01…T-05 + T-12)

**Recovered by the parent** from the lane's final summary (the lane completed all code work and
verification but hit its iteration cap before writing this file). Content below is the lane's own
reported work; the parent re-verified the end state on the frozen tree (see §Verification).

Files changed — patch-only, exclusively the lane's two owned files:

- `src/lib/verify.server.ts`
- `src/lib/verify.server.test.ts` (+6 tests; imports extended)

## Finding → edit

| Task | Finding | Change |
|---|---|---|
| **T-04** | C-05 — `[].constructor.constructor("return console")()` passed the sanitizer, making the "can never break out" docblock false | `constructor` / `prototype` / `__proto__` added to the keyword blocklist (~L216). The false docblock replaced with an **honest-scope** note: this is a *statement-form gate, not a sandbox*, and execution bounds live in `node-runner.server.ts` (~L75-90). |
| **T-03** | C-04 — `>>=` / `<<=` / `>>>=` were accepted as "not assignments" (shared exemption with `>=` / `<=`); plus a dead branch | Now rejected explicitly by a `regular` check `(?:<<|>>|>>>)=$` placed **before** the `>=`/`<=` exemption. Dead branch `prev === "=" && next === ">"` deleted; arrows detected via `next === ">"` (~L150-170). |
| **T-01** | C-01 — a machine **pass** was mintable for a module that exports nothing; 109 said *"if only one thing lands from that lane, land this"* | `buildHarness` emits `HARNESS_EXPORTS <callable names>` after compile; `runCases` fails with `compileError: "module exports no callable names — machine verification is vacuous"` (`NO_CALLABLE_EXPORTS_REASON`, exported) when the inventory is empty. **Last-inventory-line-wins**, so a hostile source cannot displace it (~L377-392, ~L483-520). |
| **T-05** | C-07 — `module.exports = {…}` compiled clean but exported nothing, so every case failed with a bare `ReferenceError` and the repair prompt then asked the model to fix *correct* code | The `module` param is no longer a decoy: `__mod` is retained and `Object.keys(__mod.exports)` folded onto `__exports` (a no-op for `exports.x` modules) (~L379-390). |
| **T-02** | C-01 second half — `identifierHits` matched substrings, so object-literal *data* could ground a case that never calls the module | `identifierHits` now runs over `stripStringsAndComments(joined)`; when `sourceExportsCallables(source)` (new **optional** 4th arg, wired from `generateCases`) at least one hit must be on an identifier the cases **call** (`calledIdentifiers`). The reason keeps the `fixes/116` prefix; non-callable / vocabulary-free sources keep legacy behaviour. |
| **T-12** | — | Six-assertion regression block in `verify.server.test.ts` (~L358-451) + module header note. |

## Commands run and real results (lane-reported)

- `npm run typecheck` → **exit 0**; the sole diagnostic was *another agent's* file
  (`scaffold.ts(1882,8): error TS2554: Expected 3 arguments, but got 2`).
- `node --experimental-strip-types --test src/lib/verify.server.test.ts` →
  **# tests 15 / # pass 15 / # fail 0 / # skipped 0** (all 9 pre-existing tests unmodified and green;
  T-12 subtests `ok 1..6`).
- Live probe against the production exports: zero-export → `pass:false` + the exact vacuity reason
  while `results[0].pass === true`; `module.exports = {…}` → `pass:true`; `exports.add` → `pass:true`;
  `>>=` / `<<=` / `>>>=` rejected; `>=` / `<=` / `==` accepted; `a => a` rejected with the arrow
  reason; both `constructor.constructor` probes rejected; `typeof f === 'function'` still accepted;
  literal-only grounding rejected with `/reference no brief noun or contract function/`.
- **Revert-check** (temp tree *outside* the repo, `verify.server.ts` reverted to `git HEAD`):
  baseline **8 of 9** fix assertions **RED** (T-05, T-01, T-03 ×4, T-04, T-02) with the `exports.add`
  control green; current file **9/9 GREEN**. This substantiates T-12's "fails if reverted" claim
  rather than asserting it.

## Not touched / not needed / not run (lane-reported)

- **No existing test assertion was updated or weakened.**
- `codegen.server.test.ts`, `verify.test.ts`, `sweep73-fuzz.test.ts` were argued safe (widening an
  optional param, preserving the vacuity prefix, preserving both rejection reasons) but were **not
  executed** by the lane — flagged as low-risk, unverified. **Resolved by the parent**: the full
  frozen-tree suite is green, so all three pass.
- No change was needed outside the lane's two files (`sandbox.ts` deliberately left untouched, as
  109 §6 directs).
- `npm test` / `npm run build` deliberately not run while siblings were editing.

## Verification (parent, on the frozen tree after all lanes stopped)

| Gate | Result |
|---|---|
| `npm test` | scripts **195/195** · src **1662/1662** · **0 fail** |
| `npm run typecheck` | **exit 0** |
| `npm run lint` | **exit 0** |
| `npm run build` | **exit 0** |
