# 216d — Lane 1, Wave D scaffold fixes (T-04 + T-05)

**Status: complete (W2 · R1 finishing lane, 2026-09-16).** The 216d code (T-04/T-05/oracle-census) landed in the
previous lane; W2 · R1 appended the 4 owed regression tests, wrote `fixes/216b_oracle_floor.md`, and completed
this log with real command output. Final gates observed: `npm run typecheck` **0**; `scaffold.test.ts` **36/36**;
`sweep73-fuzz.test.ts` **52/52**. Full gate deliberately NOT run (wave rule 4 — siblings mid-edit).

**Lane:** 1 of the RESUME.md §3 wave. **Owned files:** `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`.
**Spec:** `research/multiagent/106_rapidtool_deep_analysis.md` §6 tasks T-04/T-05 (findings F-03, F-07 scaffold half);
RESUME.md §3.1.

## Tasks

- [x] T-04 — `src/generated.ts` declared tree entry refused by `TREE_ALLOWED_ROOTS` and dropped in silence → **allowed by exact match** (`TREE_ALLOWED_FILES`, `src/lib/scaffold.ts:216`) and every refusal is **loud**: README line (`:1911-1914`) + `warnings[]` (`:2466`) + summary note in tree mode (`:2460`). Regressions: `src/lib/scaffold.test.ts:756` and `:803`.
- [x] T-05 — emitted UI import uses a literal path instead of computed `treeEntryPath` → the shell imports the module the emitter **actually writes** (`generatedEntryPath`, `scaffold.ts:2286-2294`; emission `emitUi` `:828-830`). Regression: `src/lib/scaffold.test.ts:887`.
- [x] Parent addendum — orphaned `oracleRowLine` census const is now **consumed**: the `## Honest boundaries` bullet renders in both branches (`scaffold.ts:1896-1903`, inserted `:1948`) and `commandBlock`'s cross-reference (`:1831-1832`) is true.
- [x] Owed recovery — `fixes/216b_oracle_floor.md` **written by this lane** (states plainly it is a parent-assisted recovery from lane B's summary + RESUME §2.3/§2.4/§2.5).
- [x] Verification — `npm run typecheck` **exit 0**; `scaffold.test.ts` **36/36**; `sweep73-fuzz.test.ts` **52/52** (real outputs below).

## Evidence

### Work log

**Code (previous lane — verified on disk by read-only probes, NOT re-edited by this lane).** All in `src/lib/scaffold.ts`:
the exact-match entry allow-list `TREE_ALLOWED_FILES` (`:216`) consulted by `treePathRefusal` (`:247-251`);
refusal recording into `treeRefusals` (`:2204-2213`); `treeEntryPath` computation (`:2227-2237`);
`generatedEntryPath` (`:2294`); `readmeBody` refusal line (`:1904-1914`); `warnings[]` on the result (`:2466`).

**Tests (THIS lane — the owed 216d regressions, new `it(...)` blocks appended at `src/lib/scaffold.test.ts:751-962`):**

| it(...) | Line | Pins |
|---|---|---|
| `T-04: a refused non-empty tree row is surfaced in the README AND warnings[] — never a silent drop` | :756 | refused row's bytes in no emitted file; `warnings[]` deep-equals the verdict string; README refusal line names path + reason; summary note `1 refused (see warnings)` in the mixed tree |
| `T-04: the declared src/generated.ts entry lands verbatim; the look-alike stays refused` | :803 | `src/generated.ts` assembled verbatim (pre-fix: refused by construction); `src/generated.ts.bak` still refused (exact match, no prefix hole) + absent from disk + in README |
| `216b census: the README bullet renders in BOTH branches and agrees with the emitted spec` | :836 | all-assert branch (`all N … no NOT IMPLEMENTED skips`) + mixed branch (`K of N … are NOT IMPLEMENTED …: \`id\``); every named id is `test.skip("<id> — NOT IMPLEMENTED")` in the spec; **census count === spec skip count** |
| `T-05: the emitted shell imports the computed tree entry — exactly the module the oracle spec imports` | :887 | 2 tree cases (declared barrel → `../generated.ts`; single `src/generated/entry.ts` → `../generated/entry.ts`): UI specifier === computed entry, spec + UI resolve to the same module, entry really lands; legacy case: UI target === first job node's file and is emitted |

### Assertion changes (old → new), all recorded

1. **`scaffold.test.ts:~104` — previous lane's deliberate update (recorded in-file at `:103-123`), just re-verified by this lane:**
   - OLD: `assert.ok(ui.includes("../generated"), …)` — pinned the literal the tree allow-list refuses and nothing writes (exactly the T-05 bug).
   - NEW: capture the `import * as generated from "…"` specifier, resolve it against the emitted file set, assert the target is an **emitted file**, plus the teeth check `specifier !== "../generated.ts" || emitted files include "src/generated.ts"`.
2. **`scaffold.test.ts:443` — parent repair of lane B's T-08 (recorded in RESUME §2.4 and `fixes/216b_oracle_floor.md`):**
   - OLD: count only lines starting with `test(` (the pre-T-08 tautology count).
   - NEW: count `test(` **and** `test.skip(` (rows must materialise as single-line entries — not every row must be executable), **and** every `test.skip(` line must contain `NOT IMPLEMENTED`.
3. **Within this lane's new T-04 test — one first-draft assertion corrected against observed behaviour (no weakening):**
   - First run of `scaffold.test.ts` after appending the tests: `# tests 36 · # pass 35 · # fail 1`, `not ok 1 … 'the CLI-facing summary flags the refusal too'` (`scaffold.test.ts:782`).
   - Cause (verified in source, not guessed): the summary appends `, N refused (see warnings)` **only in tree mode** (`scaffold.ts:2459-2461`); a refused-ONLY tree leaves `treeMode=false` (no accepted row) → legacy summary sentence.
   - Adjusted: the refused-only tree asserts README + `warnings[]` (the required surfaces); the summary note is asserted in a **mixed** accepted+refused tree. The required T-04 surfaces (README line + `warnings[]`) are asserted in both cases.

### Verification — commands run + real observed results (2026-09-16, W2 · R1)

```
$ cd "/c/Users/mnril/Desktop/RapidTool Main" && node --experimental-strip-types --test src/lib/scaffold.test.ts
# tests 36 · # suites 10 · # pass 36 · # fail 0 · # cancelled 0 · # skipped 0     (exit 0)
```
Baseline before this lane: 32 tests (parent-verified 32/32). This lane appended **+4** → 36. No existing test was weakened or deleted.

```
$ npm run typecheck
npm notice run tsc --noEmit        (no diagnostics)                              (exit 0)
```

```
$ node --experimental-strip-types --test src/lib/sweep73-fuzz.test.ts
# tests 52 · # suites 21 · # pass 52 · # fail 0 · # cancelled 0 · # skipped 0     (exit 0)
```

Read-only probes outside the repo (never part of the suite):
- `node --experimental-strip-types "C:/Users/mnril/_rt_probe3_216d.ts"` (previous lane; re-run by parent) — tree `[src/generated.ts + chunk-0 + check-reorder]` → UI `../generated.ts`, spec `../src/generated.ts`; refused `README.md` → `warnings(1)` + README refusal line; `src/generated.ts.bak` still refused.
- `node --experimental-strip-types "C:/Users/mnril/_rt_probe4_r1.ts"` (this lane) — `fullRun()` bullet `all 6 pinned row(s) … no NOT IMPLEMENTED skips` + spec has **0** `test.skip(`; `primed()` bullet `5 of 6 … 1 are NOT IMPLEMENTED …: \`orc-phase\`` + spec has exactly **1** `test.skip(`; legacy UI import `../jobs/dispatch.ts` === first job node file.

NOT run, per wave rule 4: full `npm test`, `npm run build`, `npm run lint` (siblings mid-edit).

## Files changed

| File | By | Change |
|---|---|---|
| `src/lib/scaffold.ts` | previous lane (verified, not re-edited) | T-04 allow-list/refusals; T-05 computed entry; census consumption |
| `src/lib/scaffold.test.ts` | **this lane** | new describe block `:751-962`, 4 regression tests (+114 lines); the pinned T-05 assertion at `:103-123` (previous lane) re-verified |
| `fixes/216b_oracle_floor.md` | **this lane** | new — parent-assisted recovery of lane B's T-08 log |
| `fixes/216d_scaffold_waveD.md` | **this lane** | this log, completed with real figures |

## Not done / carried

- **Coded hard-fail for refusals (`RT_E_*`)**: the only semantically apt code (`RT_E_FOREIGN_FILES`) lives in `src/lib/errors.ts` and is consumed in `headless.ts` (Lane 2 / R2's file) — reported by the previous lane, not made. Today's loudness contract (README + `warnings[]`) is satisfied and now regression-pinned. If the parent wants the coded hard-fail, it needs a `headless.ts` edit.
- **Refused-only trees** leave `treeMode=false`, so the summary keeps the legacy sentence (no refusal note) while README + `warnings[]` still carry it. Not changed here (verified code, cosmetic); pinned with a comment in the new test.
- Compile-check note: `compile-check.server.test.ts` does **not** import `scaffold.ts` (only mentions it in a docstring); actual scaffold importers are `headless.ts`, `codegen.server.ts`, `sweep73-fuzz.test.ts`. Parent should re-run `headless.test.ts` + `codegen.server.test.ts` at the wave boundary.
