# 342-2 (eval measurement) — append-only log

**Lane:** engineer 342-2 (eval measurement). **Root:** `C:\Users\mnril\Desktop\RapidTool Main` (git `main`, HEAD `686d7b6`, tree clean at open).
**Runtimes:** host `node` v24.15.0 and pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
**Ownership (STRICT):** `scripts/run-eval.mjs`, `src/lib/headless.ts`, `src/lib/headless.test.ts`, `scripts/run-eval.test.mjs`. Nothing else edited.
**Scratch:** `%TEMP%\rt342_2\`. **Keyed budget: 0** (only the real keyless free search ran). No full gate; targeted suites only. No tracked-file deletions.

> Working-tree note: other 342-* lanes were editing the same checkout concurrently during this session (the tree was clean at open; `git status` later showed their in-flight files). `git diff` on **my four files** contains only this lane's changes. `src/lib/headless.ts` and `scripts/run-eval.mjs` have **no** other lane's edits.

---

## 1. The gap, in bytes

The factory's own acceptance harness under-measured the pipeline because its keyed drain never ran the live research layer:

- `drainPipeline` tied `live` to `keyed`: `runUntilGate(p, { autopilot: false, live: keyed, maxSteps: 60 })` — `scripts/run-eval.mjs` (pre-fix).
- The post-journey drain passed `{ keyed: false }`, so `live:false` and `headless.runPhase` returned the deterministic floor directly (`if (!opts.live) return applyPhaseResult(...)`).
- `p7-research` (`src/lib/dod.ts:777`) requires `project.research.length > 0 || meta.liveUnavailable`, and **neither** disjunct was ever written on that path — the overlay `bareNodeLiveOverlay` (the free keyless search) was never dispatched for the research phases. Hence P7 stalled on an empty corpus.

This is a harness **path** gap. The probe and its waiver were correct and test-pinned (`wild-step.test.ts:652`; `lesson-writers.test.ts:284`) and were **not** touched.

## 2. RED-first (measured, host Node 24)

New tests authored first, run against the unpatched tree:

- `src/lib/headless.test.ts` — `describe("342-2 …")`, 3 subtests:
  - `# pass 1 / # fail 2` — the default-floor/byte-identity pin passed; **`researchLive:true` did not land the corpus (0 ≠ 1)** and **`runUntilGate` did not thread it (0 ≠ 1)**.
  - TAP: `not ok 2 - researchLive:true runs the KEYLESS free-search overlay …` (`the free-search corpus landed: 0 !== 1`), `not ok 3 - runUntilGate threads researchLive to P7 …`.
- `scripts/run-eval.test.mjs` — `test("342-2: drainPipeline threads researchLive …")`: `not ok 1 … 'a research phase ran the live overlay'` (`expected: true, actual: false`).

Real before/after output is reproduced in §3/§5/§6.

## 3. The fix (seam edits, `file:line`)

`src/lib/headless.ts` (patch-only; one block re-indented when wrapped):

1. `bareNodeLiveOverlay` — new optional `{ researchOnly = false }` (signature `:396`–`:401`); the DeepSeek narrative block is wrapped in `if (!researchOnly) { … }` (`:447`–`:487`). Default `false` ⇒ the narrative runs exactly as before for every existing `live:true` caller.
2. `runPhase` — new opt `researchLive?: boolean` (`:574`–`:579`); the non-live branch now computes the floor and, when `opts.researchLive === true && RESEARCH_PHASES.has(phase)`, dispatches the **keyless** overlay `bareNodeLiveOverlay(floor, phase, { researchOnly: true })` (`:588`–`:599`); otherwise `return floor` (identical to the old `return applyPhaseResult(...)`).
3. `runReady` — new trailing param `researchLive = false` (`:746`), threaded into `runPhase` (`:760`).
4. `advanceOnce` — new trailing param `researchLive = false` (`:824`), threaded to `runReady` at both call sites (`:881`, `:884`).
5. `runUntilGate` — new opt `researchLive?: boolean` (`:1202`–`:1206`), `const researchLive = Boolean(opts.researchLive)` (`:1212`), threaded to `advanceOnce` (`:1234`).

`scripts/run-eval.mjs`:

6. `drainPipeline(project, { keyed, p6Gate = false, researchLive = false })` (`:1924`) — passes `researchLive` into `runUntilGate` (`:1930`); docstring updated (`:1918`–`:1923`).
7. Post-journey drain (`runTrial`, keyed flow): `drainPipeline(afterJourney, { keyed: false, researchLive: true })` (`:2083`).

**Why `researchOnly`:** the mission requires the dispatched overlay to be keyless ("free search, no LLM"), but `bareNodeLiveOverlay` also fires a DeepSeek narrative when a key is configured. `researchOnly:true` dispatches the overlay's real free-search half and skips the narrative, so the eval's research leg is genuinely 0 keyed calls (the surgical alternative's stated advantage over `keyed:true`, which would also key P8–P12). This is pinned by test (§6): with a dummy key configured, the run makes **no** non-search network call and emits **no** `Phase narrative (LLM)` artifact.

**Not done (deliberately):** no `meta.liveUnavailable` stamp on the deterministic floor (contradicts `wild-step.test.ts:652`); no change to `src/lib/dod.ts`, the `p7-research` probe, or its waiver.

## 4. Byte-identity proof for the default path

- **Code:** every existing caller omits `researchLive`; `runPhase` only diverts when `opts.researchLive === true`, else `return floor` where `floor = applyPhaseResult(project, phase)` — the exact pre-fix expression. `runUntilGate`/`advanceOnce`/`runReady` default the new params to `false`. `bareNodeLiveOverlay`'s `researchOnly` defaults `false`, so the narrative block is unchanged.
- **Test:** `default (unset) and researchLive:false stay the deterministic floor for P7` asserts, under a frozen clock, `JSON.stringify(runPhase(p,7)) === JSON.stringify(runPhase(p,7,{researchLive:false}))` **and** `=== JSON.stringify(applyPhaseResult(p,7))` — i.e. the default path IS the floor, byte-for-byte.
- **Baseline counts (existing tests untouched):** with the new tests skipped, `src/lib/headless.test.ts` = **158 pass / 0 fail** and `scripts/run-eval.test.mjs` = **51 pass / 0 fail** on host — exactly the pre-existing counts (341-2 §20 recorded run-eval 51/51).
- **Test files are pure additions:** `git diff --stat` = `headless.test.ts +110`, `run-eval.test.mjs +53`, **0 deletions** (163 added lines).

## 5. Rewound-project proof (keyless; real fetched finding; no fabrication)

Stored eval project `research/eval-out/field-ops-suite/.rapidtool/project.json` — a real eval output whose **P7 gate is red** and `research` is ABSENT. Rewound to P7 (phases 0–6 complete, 7 ready, 8–12 locked, `research` cleared) and drained via the **harness seam** `drainPipeline` (key cleared; real network free search only):

```
=== stored project (as saved)
research corpus entries: 0
P7 gate pass=false unmet=[{"id":"p7-research","criterion":"Live research corpus exists for P7 (≥1 fetched finding)"}]
P7 record gate.passed=false evidenceHash=425504246

=== rewound -> drainPipeline(keyed:false, researchLive:true)
research corpus entries: 2
P7 gate pass=true unmet=[]
P7 record gate.passed=true evidenceHash=1119028455
  query: construction contractor jobsite project budget list small phase daily task field ops competitors market landscape
  provider: duckduckgo
  [0] title: Free Excel construction templates for every project [2026]
      url:   https://monday.com/blog/construction/free-excel-construction-templates/
      body:  Download free Excel construction templates for budgets , schedules, estimates, daily reports, submittals, materials, and project tracking.
  [1] title: The Construction Contractor CRM Spreadsheet: Bids, Jobs & Costing Guide
      url:   https://viasheet.com/en/blog/construction-crm-job-tracker-guide/
  [2] title: 32 Free Excel Construction Templates - ProjectManager
      url:   https://www.projectmanager.com/blog/8-free-excel-construction-templates
  live research artifacts (id research-7-*): 5
    - Free Excel construction templates for every project [2026] :: Source: https://monday.com/blog/construction/free-excel-construction-templates/
drain ending: position=terminal onTime=true stall=null

=== rewound -> drainPipeline(keyed:false)   [default control]
research corpus entries: 0
P7 gate pass=false evidenceHash=425504246
```

**Reading:** the option turns the same rewound project's P7 from red to green with **real network findings** (`provider: duckduckgo`, real titles/urls/bodies) and re-mints the gate (`evidenceHash 425504246 → 1119028455`); the default control is unchanged (same absent corpus, same red gate hash). No artifact is fabricated: every live artifact body is `# <title> … Source: <fetched url>`. The two corpus entries are P7 and P11 (both research phases). Provider calls: keyless free search only; **0 keyed calls**.

## 6. RED/GREEN both runtimes

| file | host v24.15.0 | pinned v22.23.2 |
|---|---|---|
| `src/lib/headless.test.ts` (full) | **161 pass / 0 fail** (45 suites) | **161 pass / 0 fail** (45 suites) |
| `scripts/run-eval.test.mjs` (full) | **52 pass / 0 fail** | **52 pass / 0 fail** |
| baseline (new tests skipped) | 158 + 51 | — |
| `src/lib/wild-step.test.ts` P7 pins | **3 pass / 0 fail** (waiver pin intact) | — |

The `--test-name-pattern` trap was respected: each run's own `ok N - <name>` line was required, not just exit 0.
Typechecks: `tsc --noEmit` = **0**; `tsc -p tsconfig.scripts.json --noEmit` = **0** (the first scripts run caught a fixture literal-type error in the new run-eval test; fixed type-cleanly with a JSDoc literal-union annotation, no casts).

## 7. Mock / fake census

Added: `+110` lines `headless.test.ts`, `+53` lines `run-eval.test.mjs`, production edits in `headless.ts`/`run-eval.mjs`. **0** `TODO` bodies, **0** `as any`/`@ts-ignore` variants, **0** silent `catch {}`, **0** hardcoded-return fakes, **0** unfalsifiable tests. The only test doubles are the documented `globalThis.fetch` transport stubs (`websearch`/`oneShotFetch` both defer to a replaced global `fetch`), used to feed a real-shaped DDG-Lite page **without the network** — the network proof in §5 uses the real `freeWebSearch` over the real internet.

## 8. Keyed usage

**0 keyed calls this lane.** No secret printed or echoed. Network use limited to the real keyless free search in §5 and the two seam tests' stubbed transports.

## 9. Verdict

**Fixed, and it is the real thing now measuring.** The harness's post-journey drain now runs the keyless research overlay for the research phases (`researchLive`), so P7's live corpus lands and `p7-research` can go green — proven on a stored P7-stalled eval project that flips red→green with real duckduckgo findings while the default control stays byte-identical. The default path is unchanged (asserted byte-for-byte; existing suites at their exact prior counts), no waiver is fabricated, and the live leg costs **0 keyed calls** (cheaper than the `keyed:true` alternative, which would also key P8–P12). Honest caveat: this fixes the **harness's measurement** of P7; it does **not** raise acceptance by itself — 341-2 already measured that the binding pass@1 blocker is stochastic keyed P6 synthesis plus the cold-start `M7` (graders demand `meanAtLeast:1`, unreachable on a first run). The parent should re-measure the combined effect after the wave.

**Remaining / STOP-and-REPORT:**
1. **Decision point (owner):** `researchOnly:true` skips the DeepSeek P7/P11 narrative. If the owner wants the eval to also measure the LLM *narrative* for research phases, that is a separate, **keyed** leg (drop `researchOnly` at `headless.ts:596`) — flagged, not taken, because this lane's mission pinned the overlay as keyless.
2. **Out of scope (not mine):** `classifyLlmPreflight` 401 mapping, `--preflight` without `--keyed` (both `scripts/run-eval.mjs` per 341-2 §8, but not this mission); the P6-synthesis reliability and the corpus 10/10 bar (`engine.ts`/`dod.ts` + graders); `README-cli.md` key-resolution note.
3. No change was needed outside my four files.

---

## 10. RESUME (342-2b) — the declared per-run-kind bar is now CONSUMED by the eval driver

**Sub-task from lane 342-3.** 342-3 declared `passWhen.firstRun` on all 11 graders + the pure bar helpers in `maker-score.ts`, but nothing read it, so the bar was inert end-to-end. This resume wires it through the driver. **Ownership (STRICT): `scripts/run-eval.mjs`, `scripts/run-eval.test.mjs`. Nothing else edited.** Scratch `%TEMP%\rt342_2\`. **0 keyed calls** (recompute reads stored artifacts + graders only). No full gate; only `scripts/run-eval.test.mjs`. No tracked-file deletion.

### 10.1 The four edits (`file:line`)

1. **`parseGrader` firstRun parsing** — `scripts/run-eval.mjs:438-482` (validation; `firstRun` carried into `passWhen` at `:555`; the `Grader` typedef extended at `:415` to type it). Reads `pw.firstRun` → `firstRun: { meanAtLeast, excludeCriteria } | null`; validates `typeof meanAtLeast === "number" && 0 < meanAtLeast <= 1` and every excluded id against `{M1..M9}`; malformed ⇒ `{ ok: false, error }` coded `RT_E_VALIDATION` — never silently dropped. Absent/`null` ⇒ `null` (warm bar for first runs too, v1 back-compat).
2. **`runTrial` run-kind persistence** — `scripts/run-eval.mjs:2328` (`const prior = priorFor(slug)` hoisted once, `const runKind = runKindOf(prior)`) → `prior,` at `:2341` and `runKind,` on the row at `:2410`. scoreMaker's M7 and the persisted kind read the SAME prior.
3. **`passesAcceptance` / `acceptanceFailReason` run-kind selection** — helper `rubricMeanForRow` at `scripts/run-eval.mjs:2522`; `passesAcceptance` uses `{ mean, bar }` at `:2507`; `acceptanceFailReason` uses it and names the run kind + excluded criteria at `:2544-2551`.
4. **Tests** — `scripts/run-eval.test.mjs:312` (`parseGrader` firstRun validated/refused), `:343` (all 11 real graders carry it), `:504` (`passesAcceptance`: first clears 8/9, warm still needs M7, keyless floor fails).

Import extended at `scripts/run-eval.mjs:97` (`runKindOf, barForRunKind, criteriaMeanExcluding`). The warm bar (`meanAtLeast`) and the files/content/behavior/kind clauses are untouched; a row without a `criteria` map (legacy/synthetic callers) falls back to its stored `mean`, so existing warm verdicts are unchanged.

### 10.2 RED-first (real output, both runtimes)

Against the unpatched tree — 3 new failing tests, 52 pre-existing green:

```
not ok 8 - 342-2: parseGrader carries passWhen.firstRun, validated; a malformed block is a coded refusal
not ok 9 - 342-2: every declared corpus firstRun bar reaches the parsed grader (declared ⇒ consumed)
not ok 16 - 342-2: passesAcceptance selects the per-run-kind bar (first clears 8/9; warm still needs M7)
  expected: true
  actual: false
# tests 55
# pass 52
# fail 3
```

### 10.3 GREEN (both runtimes)

```
ok 8 - 342-2: parseGrader carries passWhen.firstRun, validated; a malformed block is a coded refusal
ok 9 - 342-2: every declared corpus firstRun bar reaches the parsed grader (declared ⇒ consumed)
ok 16 - 342-2: passesAcceptance selects the per-run-kind bar (first clears 8/9; warm still needs M7)
# tests 55 · # pass 55 · # fail 0
```

Host `node` v24.15.0 and pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2 — identical output. `tsc -p tsconfig.scripts.json --noEmit` → **exit 0** (the first pass caught the un-extended `Grader` typedef; fixed in-file with a typed predicate, no cast/`as any`).

### 10.4 Stored-result recompute (real modules, 0 keyed calls)

`%TEMP%\rt342_2\recompute.mjs` drives the REAL `loadGrader`/`passesAcceptance`/`acceptanceFailReason` + `barForRunKind`/`criteriaMeanExcluding`/`meetsRunKindBar` over `research/eval-out/{results,history}.json` and the real graders. Identical on both runtimes:

- **Stored warm row** (`coffeehouse2home-property-ledger`, 3/9): kind warm, bar `{1, exclude []}`, effMean 0.3333 → FAIL (unchanged; stored `filesOk:false` also fails).
- **Same stored card re-judged as first**: bar `{1, exclude [M7]}`, effMean **0.3750** (3/8) → FAIL — the floor stays a fail (no false green).
- **Stored keyless first rows** (6 slugs, 4/9 bands `000011011`): first effMean **0.5000** (4/8) → FAIL.
- **Documented keyed 8/9 first runs** (341-2 §2: `arcade-breakout`, `date-rrule-library`, `field-ops-suite`, `showing-booking`; bands `1111110 11`): OLD (raw `row.mean 0.8889 >= 1`) → **FAIL**; NEW (effMean **1.0000** over the 8 scoreable) → **PASS**. This is the arithmetic the bar now consumes — a first run that earns its eight scoreable criteria is judged on them; nothing else is relaxed.

### 10.5 What I did NOT do

- Did not touch the 11 grader JSONs or `src/lib/maker-score.ts` (342-3's files).
- Did not lower the warm bar or relax the files/content/behavior/kind clauses.
- Did not run the eval driver / full gate (only `scripts/run-eval.test.mjs`, per the rules); 0 keyed calls, no network in the recompute.
- Edit 2 (runKind persistence) is verified by source + the `passesAcceptance` pins, not by a pipeline run — running the driver was out of the rules. The recompute uses the same `runKindOf` logic the row now persists.
- Did not delete any tracked file; no production change outside `scripts/run-eval.mjs`.

---

## 11. RESUME (342-2c) — verifier A/B holes in the bar wiring

**Sub-task.** Verifiers A (`fixes/342_7_verifier-a.md` §3c) and B (`fixes/342_8_verifier-b.md` Task 3) found holes in the §10 bar wiring. **Ownership (STRICT): `scripts/run-eval.mjs`, `scripts/run-eval.test.mjs`. Nothing else edited.** Scratch `%TEMP%\rt342_2\`. **0 keyed calls**, no eval driver, no full gate — only `scripts/run-eval.test.mjs` on both runtimes + `src/lib/maker-score.test.ts` read-only. No tracked-file deletion. Runtimes: host `node` v24.15.0 and pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.

> Concurrent-lane note: another 342-3 lane was editing `src/lib/maker-score.ts` / `maker-score.test.ts` during this session (its test count moved 91→99 and it hardened `barForRunKind` to clamp threshold/exclusions). Those files are **not mine** and were not touched; my suites pass against the current working-tree version.

### 11.1 Fix 1 — fail-safe default (both verifiers)

`rubricMeanForRow` defaulted an ABSENT/unknown `runKind` (with a `criteria` map present) to the lenient first-run bar — a legacy/synthetic re-judge could clear 8/9 by dropping M7. Now only an EXPLICIT `"first"` is lenient; absent/unknown ⇒ warm (all nine): `row.runKind === "first" ? "first" : "warm"` (`run-eval.mjs:2539`).

**RED** (two tests added, production unpatched; host v24):
```
not ok 17 - 342-2b: an absent/unknown runKind is judged on the warm bar (all nine), never the lenient first-run bar
  error: |- expected: false, actual: true        # an absent-kind 8/9 row PASSED (the false green)
# tests 58  # pass 55  # fail 3
```

**GREEN** (after):
```
ok 17 - 342-2b: an absent/unknown runKind is judged on the warm bar (all nine), never the lenient first-run bar
# tests 58  # pass 58  # fail 0
```
Pin covers: explicit first 8/9 → PASS; explicit warm 8/9 → FAIL; ABSENT 8/9 → FAIL; unknown `"bogus"` 8/9 → FAIL; and the absent-kind fail reason carries no M7 exclusion claim.

### 11.2 Fix 2 — one list, one comparison (verifier B)

- The driver's own `CRITERIA_IDS` set is gone. `parseGrader` now validates `firstRun.excludeCriteria` against imported `FIRST_RUN_UNSCOREABLE_CRITERIA` and refuses anything else with the coded `RT_E_VALIDATION` (`run-eval.mjs:454-490`) — this also closes verifier B's strongest hole (a loose grader excluding M1–M4 so a floor-shaped card passes). The 11 real graders exclude only M7.
- `passesAcceptance`/`rubricMeanForRow` now delegate the mean comparison to imported `meetsRunKindBar` (`run-eval.mjs:2519`, `2538-2554`); the driver no longer imports `criteriaMeanExcluding`. Legacy rows with NO criteria map keep the exact pre-342-2 stored-`mean` comparison (`ok: !(row.mean < bar.meanAtLeast)`).
- Both exports are now genuinely consumed (grep + a source-pin test).

**RED**:
```
not ok 18 - 342-2b: firstRun.excludeCriteria may name only the first-run-unscoreable criteria (M7)
  expected: false, actual: true        # ["M1"] parsed ok:true
not ok 19 - 342-2b: the driver imports maker-score's shared bar helpers (one list, one comparison)
  actual: 'import { scoreMaker, capabilityCoverage, treeFilesOf, runKindOf, barForRunKind, criteriaMeanExcluding } from "../src/lib/maker-score.ts"'
```

**GREEN**: `ok 18`, `ok 19`; suite 58/58.

### 11.3 Fix 3 — stale comment

`run-eval.mjs:2075` now reads `Project.kind is the 5-way DeliveryKind "app"|"tool"|"game"|"library"|"service" (types.ts DELIVERY_KINDS — widened from the 3-way E-15 shape by 342-4)`.

### 11.4 Recompute after 1–2 (0 keyed calls, both runtimes byte-identical)

`%TEMP%\rt342_2\recompute342_2b.mjs` drives the REAL `loadGrader`/`passesAcceptance`/`acceptanceFailReason` + `barForRunKind`/`criteriaMeanExcluding`/`meetsRunKindBar` over `research/eval-out/{results,history}.json`:

```
[1] stored legacy card (no runKind, criteria present, 3/9):
    OLD default first  effMean 0.3750 (3/8) FAIL
    NEW default warm   effMean 0.3333 (3/9) FAIL     driver: FAIL
[2] same card with EXPLICIT runKind: OLD/NEW agree (warm 0.3333 FAIL; first 0.375 FAIL)
[3] documented keyed 8/9 first run (band 111111011):
    OLD absent runKind PASS  ->  NEW absent runKind FAIL   # the false green is closed
    explicit first PASS / explicit warm FAIL
[4] keyless floor: FAIL under absent / first / warm
[5] results.json sweep: cards 1 | same verdict 1 | newly PASS 0 | newly FAIL 0
[6] history.json sweep: rows 40 | same verdict 40 | newly PASS 0 | newly FAIL 0
```
Real cards (the current driver always persists an EXPLICIT `runKind`) are unchanged; the only verdict that moves is the legacy/unknown-kind 8/9, and it moves PASS→FAIL — no false green is introduced, one is removed.

### 11.5 Suites (both runtimes, TAP, each run's own `ok N` line)

| file | host v24.15.0 | pinned v22.23.2 |
|---|---|---|
| `scripts/run-eval.test.mjs` | **58/58** | **58/58** |
| `src/lib/maker-score.test.ts` (read-only regression) | **99/99** | **99/99** |

`tsc -p tsconfig.scripts.json --noEmit` → exit 0 (one intermediate catch: `new Set<string>` in a checked `.mjs` parses as comparison operators — replaced with `new Set(FIRST_RUN_UNSCOREABLE_CRITERIA.map((id) => String(id)))` + a type predicate, no casts).

### 11.6 What I did NOT do

- Did not edit `src/lib/maker-score.ts` / `maker-score.test.ts` (the concurrent 342-3 lane's files; read-only regression only — no need, their clamp is complementary).
- Did not run the eval driver or the full gate; 0 keyed calls; no network.
- Did not change the warm bar, the files/content/behavior/kind clauses, or the `(0,1]` threshold validation — only the exclusion list is restricted to `FIRST_RUN_UNSCOREABLE_CRITERIA`.
- Did not lower/raise `firstRun.meanAtLeast`.
- No tracked-file deletion; no production change outside `scripts/run-eval.mjs`.
