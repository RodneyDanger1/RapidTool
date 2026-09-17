# 216b — the oracle acceptance floor (106 T-08 / F-05)

**Status: complete (recovered).** This log was written by **W2 · R1 as a parent-assisted recovery** from
lane B's final summary (`subagent-summary-1-20260916_185726_439609.txt`) plus RESUME.md §2.3/§2.4/§2.5 —
lane B delivered the code, hit its tool-budget cap mid-edit, reported honestly, and never reached this
file. **Nothing here is re-derived from memory: every claim is either a probe output recorded in that
summary, a parent repair recorded in RESUME §2.4, or a command W2 · R1 re-ran on the frozen tree.**

**Finding:** 106 §3 **F-05** — the emitted oracle spec accepted *unfailable* rows: a row with no emitted
module surface to assert against still shipped an always-true assertion (`"<id>".length > 0`,
`assert.equal(true, true, …)`), so a keyless/tree-mode run reported **green** over rows that asserted
nothing. **Skip ≠ green**: the fix is to make "no surface to assert" a *visible* skip, never a pass.

## What changed (file:line on the frozen tree)

All in `src/lib/scaffold.ts`:

1. **Both always-true pairs removed** — the old `:1295-1296` (bridged-host, non-template) and `:1331-1332`
   (`else`) branches are gone. The final `else` now emits a visibly-marked
   `test.skip("<id> — NOT IMPLEMENTED")` (name keeps the pinned E-08 id; the body is `assert.fail(...)`
   so it fails loudly if anyone ever un-skips it) — emission site today `scaffold.ts:1462-1522`
   (`test.skip` :1466, the `NOT IMPLEMENTED` comment :1517, `assert.fail` :1522).
2. **Single-source-of-truth census seam** (`OracleRowKind` :978, `OracleRowSurface` :990,
   `oracleRowSurface()` :1002, `oracleRowKind()` :1034, `OracleRowCensus` :1043,
   `censusOracleRows()` :1053). Row branch order preserved exactly (bridge > endpoint seam > host), so
   no existing row's assertion changed. The spec's row loop and the census both call `oracleRowKind()`
   (`:1459` / `:1061`) — a counted row and an emitted row can never drift.
3. **`no-oracle` row fixed** — was `assert.equal(true, true, …)`; now `test.skip(...)` + `assert.fail(...)`.
4. **Tree-entry test fixed** — dropped the unfailable `assert.ok(treeModule, …)` +
   `assert.equal(typeof treeModule, "object")`, kept the real `Object.keys(...).length > 0`.
5. **README counts skips separately** — `commandBlock()` grew the census param (`:1816`) and prints
   `# N row(s) are NOT IMPLEMENTED and appear as skipped in this run (never green)` (`:1830-1832`);
   `readmeBody()` renders the `## Honest boundaries` census bullet (param `:1855`, line `:1896-1903`,
   inserted `:1948`) and `scaffoldProject` classifies rows **once** before rendering (`:2297`,
   `:2308`, call `:2313`).

## Parent repair (RESUME §2.4) — the tree was RED on wave exit

Lane B's honesty (its report said *"INCOMPLETE — the file does not currently typecheck; verification was
NOT run"*) is what made this recoverable in minutes. The parent then fixed **5 type errors → 0**:

1. **TS2554** `scaffold.ts:1896` — the one `commandBlock` call site inside `readmeBody` was not updated
   for the new 3rd parameter. ⚠️ The tempting shortcut (pass `null`) was not taken: it would have read
   `notImplemented` as `0` while the spec skips rows — an honesty bug. The census is always passed.
2. **TS2451 ×4** `scaffold.ts:2210/:2214` vs `:2288/:2293` — a duplicated `jobLabelOf` + `generated`
   pair in one scope; byte-identical bodies → the later pair was deleted (now single at `:2256`/`:2260`).
3. **`scaffold.test.ts:443`** — the hostile-prose test counted only lines starting with `test(`, the
   pre-T-08 tautology count. **Assertion change old → new (recorded):** it now counts **both** `test(`
   and `test.skip(` (the test's stated intent is that rows materialise as single-line entries, not that
   every row is executable) **and** pins the new contract — every `test.skip(` line must contain
   `NOT IMPLEMENTED`.

## Evidence (real commands + observed results)

Lane B (pre-fix baseline + probes, from its summary):

- `node --experimental-strip-types --test src/lib/scaffold.test.ts` → **32 tests, 32 pass, 0 fail** (baseline).
- node:test skip probe: `# tests 2 · # pass 1 · # skipped 1`, **EXIT=0** → skipped rows are counted
  separately, never read as green, and do not red the suite.
- Fixture census probe (pre-edit, the measured F-05 footprint): `fullRun()` **6 rows / 0 tautologies**;
  `primed()` 6 rows / 1; **tree-mode (1-file tree) 6 rows / 6 tautologies** — tree mode was the worst case.

W2 · R1 (post-repair, frozen tree — `node --experimental-strip-types "C:/Users/mnril/_rt_probe4_r1.ts"`):

- `fullRun()` → README bullet: `all 6 pinned row(s) assert the emitted modules' real current behavior —
  no NOT IMPLEMENTED skips.`; emitted spec contains **zero** `test.skip(` lines.
- `primed()` (no generated substance) → bullet: `5 of 6 pinned row(s) assert …; 1 are NOT IMPLEMENTED …
  skipped (never green): \`orc-phase\``; emitted spec contains exactly **1** `test.skip(` line, named
  `"orc-phase — NOT IMPLEMENTED"`.

Regression tests now pinning this (added by W2 · R1, `src/lib/scaffold.test.ts`):

- `216b census: the README bullet renders in BOTH branches and agrees with the emitted spec` — asserts the
  all-assert bullet, the mixed bullet with named ids, that every named id appears in the emitted spec as
  `test.skip("<id> — NOT IMPLEMENTED")`, and that the census count **equals** the spec's skip count
  (`src/lib/scaffold.test.ts:836`). Run: **36/36 pass, 0 fail** (`# tests 36 · # pass 36 · # fail 0`,
  observed 2026-09-16 by W2 · R1).

## Not done / carried

- The remaining half of the ALSO-IN-SCOPE clause was audited by lane B: the module/store/api/capability
  rows are all failable; the two tautology sites plus the `no-oracle` row and the tree-entry pair are the
  full set it identified. No later lane has found a further unfailable emitted assertion.
- The `getContext` test (`spec.includes(JSON.stringify(row.id))`) survives because the skip name keeps the
  pinned id — now implicitly covered by the census test's per-id `test.skip` assertions.
