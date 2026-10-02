# fixes/335_6_warden.md — W49 lane 335-6 "Warden" — algorithm correctness + guards

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (space in path; terminal grep, never ripgrep on the space).
**HEAD at open:** `9cff073`, tree clean except `?? wave_plans/W49/`. **Runtime:** pinned Node 22.23.2
(`%LOCALAPPDATA%\hermes\node\node.exe`); host Node v24.15.0; every parsed `node --test` run used
`--test-reporter=tap`. Scratch: `%TEMP%\rt335_6\`.
**Rules obeyed:** minimal patches only (two 1-expression fixes + tests); no full gate (siblings mid-edit);
no keyed calls; no `npm run eval`; no secret printed; append-only log; only owned files touched; no probe
file left in the repo (all probes live under `%TEMP%`); guard suites re-run green.

> Step 0 read `fixes/331_6_warden.md`, `fixes/334_6_warden.md`, `fixes/333_1_verifier.md`,
> `fixes/333_2_registrar.md`, `fixes/334_0_parent.md`, then the 14 owned modules + their tests on disk.
> `wave_plans/W49/GUARDRAILS.md` was **not present** at open (checked; only `README.md` +
> `watchdog-7-guardian.md` exist). Re-checked before landing: still absent.

---

## Step 0 — reconciliation

### claimed (what prior passes said)

- **331-6** shipped `scripts/check-assertion-gaps.mjs` (6 tautology rules + zero-assertion) and
  `scripts/check-module-coverage.mjs` (allowlist + allowlist-reason teeth). Did **not** touch the
  algorithm modules; its ownership that wave was `scripts/**`.
- **334-6** (the last Warden pass) added the `always-true-expr` tautology rule, stale-allowlist
  detection, and reported three dead modules + two wrong allowlist reasons. Again: guards only.
- No prior 33x Warden pass audited the pure algorithm modules listed in this lane's brief; this is the
  first pass whose ownership is `src/lib/algorithms.ts` … `bench.ts`.

### on disk (verified today at `9cff073`)

- All 14 owned modules present; every one except `entry-oracle.ts` has a colocated `*.test.ts`.
- Per-module test counts on Node 22 (all green, before this lane's edits):
  `algorithms 80 · algo-tools 48 · arch-tools 13 · ast-mine 9 · entry-oracle 0 (no own test; reached
  transitively by `compile-check.server.test.ts`) · iterate 32 · judgment 7 · planning 16 · maker-score
  74 · vector 36 · swarm 33 · design 31 · diagram 34 · bench 23`.
- Guards green at open: `check-assertion-gaps.mjs` clean (124 test files, 0 findings);
  `check-module-coverage.mjs` 103/122 reached · 19 allowlisted · 0 unallowlisted · 0 stale.
  Their own tests: `check-assertion-gaps.test.mjs` **30/30**, `check-module-coverage.test.mjs` **7/7**
  (Node 22).

### still open (before this lane's edits, with `file:line`)

1. `src/lib/bench.ts:340` — the `ternaryCount` predicate excludes `??` but not `?.`, so optional
   chaining is counted as a ternary (probe: `a?.b?.c?.d` → `ternaryCount: 3`). Defect, fixed here.
2. `src/lib/ast-mine.ts:147` — `parseExportList` records the LOCAL binding for `export { local as public }`
   instead of the exported alias (probe: exports `["localA","helper","thing"]` for
   `export { localA as publicA, helper as runHelper }` + `export { thing as renamed }`). Defect, fixed here.
3. `src/lib/vector.ts:704` — `monogramInitials` can only ever return ≤ 2 chars, so the
   `initials.length >= 3` branch selecting fontSize 26 is **unreachable** (probe: 7 names, max len 2).
   Reported, not fixed (no behavior to test RED-first; see Verdict table).
4. `src/lib/algo-tools.ts:929` — `complexityOf("class C { while(x) {} }")` counts the method name `while`
   as a real loop (`loops: 1`, `O(n)`) although no loop exists. The 330 P3 fix covered a method named `for`
   (head-shape test) and `obj.while(x)` (member access) but **not** a `while` method in a class/object
   body. Reported, not fixed (see Verdict table for why).

---

## Checkpoint — intended patches (written before applying, per hard rule 9)

- **P1 `bench.ts`** (1 expression): add `&& text[i + 1] !== "."` to the `ternaryCount` predicate at :340 so
  an optional-chaining `?.` is not counted; keep the existing `??` exclusion. New test in `bench.test.ts`.
- **P2 `ast-mine.ts`** (1 expression): in `parseExportList`, when a specifier carries `as`, record the
  ALIAS (the last `as` segment) rather than the local name. New test in `ast-mine.test.ts`.

Both patches are single-expression edits; no reformatting, no surrounding rewrite.

### RED evidence (tests added first; shown failing before the patches)

```
=== RED: bench ===
not ok 2 - complexityScore (branch/loop heuristics + artifact weight)
# tests 24
# pass 23
# fail 1
=== RED: ast-mine ===
not ok 1 - mineCodebase — per-file structural extraction
# tests 10
# pass 9
# fail 1
```

---

## Per-module verdict table

"Test count" = the module's OWN colocated test file, measured today on Node 22 (`--test-reporter=tap`).
Every module was read in full; the "probe" column is what I actually ran against it.

| Module | Own tests | Verdict | Probe / evidence |
|---|---|---|---|
| `algorithms.ts` | 80 | **SOUND** | `%TEMP%\rt335_6\probe6.mjs` + `probe8.mjs`: over 7 briefs × 7 domain spellings — nodes weight-desc, ≤18, jobs/entities non-empty, complexity ∈ [0,10], coerced domain; health-ops hipaa+phi defaults; `planSpecGraph.order` a valid topological permutation; feasibility axes ∈ [1,10]; `deriveTypeSignatures` = 2 × distinct jobs; `routeCrew` ≥1 active seat for P0..P12; `fusionRank` limit −5/2.7/NaN/100; `canonicalStem` idempotent on 22 vocabulary words; hyphen/spaced phrase parity + scattered non-fire. **ALL INVARIANTS HOLD.** |
| `algo-tools.ts` | 48 | **DEFECT-FOUND (reported, not fixed)** | `probe4.mjs`: `complexityOf("class C { while(x) {} }")` → `loops 1, O(n)` although no loop exists (the method name `while`). The 330 P3 fix covered a method named `for` (head-shape test) and `obj.while(x)` (member access) but **not** a `while` method in a class/object body. Every other probed shape correct (braceless, do-while, busy-wait `while(c);`, for-of/in, `for await`, `obj.for`, `if(ok)/for/`, template interpolation, nested). See "not done" for why no fix. |
| `arch-tools.ts` | 13 | **SOUND** | `probe4.mjs` + `probe7.mjs`: `scanLocalImports` excludes `obj.from(...)`, comments and regex bodies; `canonicalModuleId` strips `.d.ts`/`.mts`/`.mjs` and Windows slashes; `resolveRelativeImport("a/b/c.ts","../../x.ts")` → `x`; `dependencyGraph` produces the one expected edge; `codebaseMap` sorts bands by phase. |
| `ast-mine.ts` | 10 (was 9) | **DEFECT-FOUND → FIXED** | `probe2.mjs`: `export { localA as publicA, helper as runHelper }` + `export { thing as renamed } from "./thing.ts"` reported `["localA","helper","thing"]` (local bindings) — a name **no consumer can import**. Now `["publicA","runHelper","renamed"]`. |
| `entry-oracle.ts` | 0 (no own test) | **SOUND** | `probe7.mjs`: `validateExpectedBehavior` accepts a valid `entry-runs`, rejects `mode:"import"`+`args`; `manifestHas`/`manifestFind` suffix rule; `entryRunBudget` clamps to [500, 60000]; `entryRunTail` collapses whitespace. Reached (not orphaned) by `compile-check.server.test.ts` and `sweep73-fuzz.test.ts`; module-coverage guard lists it as reached, 0 unallowlisted. Gap noted: no dedicated oracle-spawn test of its own (spawn is exercised through the compile-check suite). |
| `iterate.ts` | 32 | **SOUND** | `probe7.mjs`: `readIterateConfig` arms 0.75, rejects 2, clamps cycles 5→2; `decideIterate` order disabled→no-score→satisfied→budget→bounded→no-seam→fire. |
| `judgment.ts` | 7 | **SOUND** | All six ladder rungs + purity are pinned by `judgment.test.ts` against real `runGate`; read in full: rung 5 is deliberately checked before rung 4, and the `initials`-style unreachable-branch class does not occur (every branch reachable). |
| `planning.ts` | 16 | **SOUND** | `probe7.mjs`: `backtrack` never mutates the input, cuts the failed step + tail, no-ops on an unknown id; parsers are keyed/private but the deterministic-shape contract is pinned by its suite. |
| `maker-score.ts` | 74 | **SOUND** | `probe7.mjs`: card `total` = Σ criteria, `mean` = total/9; `synthesisSucceeded:false` floors M1–M4 with the shared qualifier while M5–M9 are byte-unchanged; `treeRunLooksSkipped(0/0)=true`, `(3/0)=false`. |
| `vector.ts` | 36 | **DEFECT-FOUND (dead branch, reported)** | `probe3.mjs` + `probe5.mjs`: sanitizer rebuild/idempotency/leaf-nesting/case-dup/transform/entity all correct; `monogramInitials` returned length ≤ 2 for 7 names, so `fontSize = initials.length >= 2 ? (initials.length >= 3 ? 26 : 34) : 46` contains an **unreachable `26` branch**. No behaviour to change and no RED-first test is possible → reported only. |
| `swarm.ts` | 33 | **SOUND** | `probe7.mjs`: `parallelDag` frontier/complete partition (`parallelPairs + conflicts` = all run-ready pairs); `branchSuggest` empty on a healthy pipeline. |
| `design.ts` | 31 | **SOUND** | `probe7.mjs`: `designHtml` byte-deterministic, escapes `<script>`, 20-key token set; `design.test.ts` independently re-verifies every WCAG pairing. |
| `diagram.ts` | 34 | **SOUND** | `probe7.mjs`: all three kinds byte-deterministic and free of `NaN`/`Infinity`/`undefined` on a hostile-name project. |
| `bench.ts` | 24 (was 23) | **DEFECT-FOUND → FIXED** | `probe1.mjs`: `const v = a?.b?.c?.d;` reported `ternaryCount: 3` (optional chaining counted as ternaries; `??` was already excluded). Now `0`; a real `a ? b : c` still counts `1`; `a ?? b` counts `0`. |

---

## Per-fix before / after

### F1 — `src/lib/bench.ts:340` — `?.` counted as a ternary

- **Before:** `a?.b?.c?.d` → `{"ternaryCount":3,...}`; a project with 8 optional chains scored to `medium` for a construct that has no branching.
- **After:** `a?.b?.c?.d` → `ternaryCount 0`; `a ?? b` → 0; `a ? b : c` → 1. `score`/`level` now match the branch/loop heuristic's own contract.
- **Patch (1 expression):** added `&& text[i + 1] !== "."` to the predicate + a 2-line comment (the `??` exclusion already looked at the NEXT char, so this makes the intent explicit and complete).
- **Test:** `bench.test.ts` → "counts only real `? :` ternaries — optional chaining (`?.`) and nullish (`??`) never count". RED: `not ok`, 23/24. GREEN: 24/24 on Node 22 **and** 24/24 on Node 24.

### F2 — `src/lib/ast-mine.ts:147` — `export { local as public }` recorded the local name

- **Before:** `mineCodebase` exports `["localA","helper","thing"]` for the probe body — every name is unimportable, so a codebase map / convention packet misnames the module's public surface.
- **After:** `["publicA","runHelper","renamed"]` (the alias, matching `algo-tools.exportedNamesOf`, which already did this correctly).
- **Patch (1 expression):** split on `/\s+as\s+/` and take the **last** segment (alias) when present, else the sole name.
- **Test:** `ast-mine.test.ts` → "records the EXPORTED name for `export { local as public }` (the alias, not the local binding)". RED: `not ok`, 9/10. GREEN: 10/10 on Node 22 **and** 10/10 on Node 24.

### R1 / R2 — reported residuals (no patch)

- **`vector.ts:704` unreachable branch** — proven by `probe3.mjs` (7 names, max initials length 2). A behaviour-identical simplification is possible but unfalsifiable; hard rule 3 forbids shipping a "fix" with no RED-first test, so it is reported, not touched.
- **`algo-tools.ts:929` `while`-method false loop** — proven by `probe4.mjs`. The only lexically reliable discriminator would be class/object-body scope tracking inside `complexityOf` (the `for` case got away with a head-shape test; `while` has no analogue). That is a multi-hunk change to the loop scanner with real over-refusal risk on legitimate `while` loops, beyond the minimal-patch rule and outside a "correctness-first" quick fix; reported with the exact repro so a future pass can decide.

---

## Tests added — real results on both runtimes

| file | before | after | Node 22.23.2 | Node 24.15.0 |
|---|---|---|---|---|
| `src/lib/bench.test.ts` | 23 | **24** | 24/24 / 0 fail | 24/24 / 0 fail |
| `src/lib/ast-mine.test.ts` | 9 | **10** | 10/10 / 0 fail | 10/10 / 0 fail |

Owned-module suite totals after edits (Node 22, every file 0 fail):
`algorithms 80 · algo-tools 48 · arch-tools 13 · ast-mine 10 · iterate 32 · judgment 7 · planning 16 ·
maker-score 74 · vector 36 · swarm 33 · design 31 · diagram 34 · bench 24` = **438**.
Shared suites that import the changed modules, re-run green:
`sweep73-fuzz.test.ts` 52/52, `headless.test.ts` 134/134 (headless wraps `mineCodebase`).

**Typecheck (whole src leg):** `npx tsc --noEmit` → **exit 0, 0 errors**, and specifically 0 in
`bench.ts`/`ast-mine.ts` (run once; siblings' in-flight edits were type-clean at that moment).
**Lint:** `npx eslint` on the four changed files → **exit 0**.

## Guards — status and teeth

- `node scripts/check-assertion-gaps.mjs` → **clean — 124 test files, 0 findings, exit 0**.
- `node scripts/check-module-coverage.mjs` → **103/122 reached · 19 allowlisted · 0 unallowlisted · 0 stale**.
- Their own tests, Node 22: `check-assertion-gaps.test.mjs` **30/30**, `check-module-coverage.test.mjs` **7/7**.
- **Teeth proven today (scratch plant, outside the repo):** `%TEMP%\rt335_6\plant.test.mjs` with
  `assert.ok(1 || true)`, `assert.equal(typeof "x", "string")`, `assert.ok({ a: 1 })` →
  the guard reported **3 findings, exit 1** (`always-true-expr`, `typeof-only`, `presence-only`);
  the live tree re-ran clean, exit 0. The guard is not vacuous.
- **No guard extension this pass.** I looked for a genuinely-missing never-fail class and found only
  low-value, false-positive-prone candidates (`assert.ok(Infinity)`, scientific-notation/bigint
  non-zero literals, `deepEqual(<identical literal>, <identical literal>)` where the identical text
  may contain an impure call). Hard rule: extend only with genuine teeth; none of these justify the
  added false-positive surface, so the guards stay as shipped.

## What I did NOT do, and why

- **Did not fix the two reported residuals** (`vector.ts` dead branch; `algo-tools.ts` `while` method):
  reasoned above — no falsifiable test for the dead branch, and the `while`-method fix needs scope
  tracking that risks over-refusing real loops (a larger change than this correctness pass warrants).
- **Did not add a dedicated `entry-oracle.test.ts`.** It is not orphaned (reached by the compile-check
  and fuzz suites, 0 unallowlisted), and its spawn path is already exercised through those; adding a
  second spawn suite would duplicate coverage rather than close a gap. Reported as a noted gap.
- **Did not edit any unowned file.** `git status` shows my diff is exactly the four owned paths
  (`bench.ts`+test, `ast-mine.ts`+test); every other `M` in the tree is a sibling lane's.
- **Did not run the full gate / `npm run eval` / any keyed call**, and printed no secret — five siblings
  are mid-edit (`codegen.server.ts`, `headless.ts`, `scaffold.ts`, `packet.ts`, `scripts/**` all show
  `M`), so only targeted suites ran.
- **Left no probe file in the repo** — all probes live under `%TEMP%\rt335_6\`.

## Verdict

**Two genuine defects found and fixed with RED-first tests on both runtimes** (`bench.ts` `?.`-as-ternary;
`ast-mine.ts` export-alias), plus **two genuine residuals reported with exact repros** (`vector.ts`
unreachable branch; `algo-tools.ts` `while`-method false loop). The flagship `algorithms.ts` and the
other nine modules are **SOUND** under the probes above. Guards green with teeth re-proven; no guard
extension was warranted.
