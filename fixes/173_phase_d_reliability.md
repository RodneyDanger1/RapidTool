# 173 — Phase F: RELIABILITY / PRODUCTION HARDENING

| Field | Value |
|---|---|
| **File** | `fixes/173_phase_d_reliability.md` |
| **Date / role** | 2026-09-09 · agent 173 (Grok 4.6) · reliability-phase spec |
| **Repo root** | `C:\Users\mnril\Desktop\RapidTool Main` (git-bash `/c/Users/mnril/Desktop/RapidTool Main`; **NOT git**) |
| **Audience** | Parent merging into `fixes/162_master_execution_plan.md`; executing model after T0–E land |
| **Write scope** | **This file only.** READ-ONLY on `src/` + `scripts/`. Do **not** edit `fixes/162_master_execution_plan.md` (parent merges). |
| **Name collision** | 162 already owns **Phase D = autonomy/UX**. This wave is **Phase F — RELIABILITY / PRODUCTION HARDENING** (do not call it Phase D). Local ids `F-01…`. Re-number on merge if parent prefers `§20`. |

> **Honest limits.** Parent is mid-T0 on store/io/engine/headless — disk is truth, line numbers drift. Every `file:line` below was grepped this pass; re-grep before any patch. Web pages fetched 2026-09-09 via urllib+browser UA (OpenAI blog 403; r.jina.ai 403 — SWE-bench Verified claims inherit 162 §0 / quality-gates quickref, flagged). No code was changed. No four-gate was run (agents mid-edit — AGENTS.md forbids it).

---

## 0. TL;DR

After Phases A–E of 162 (and 170_b's executor brief) RapidTool can be **feature-complete** and still not **production-ready**. Feature waves add surfaces; they do not prove the factory cannot lie, wipe users, leak the key into the suite, mint `tested` on a red gate, or ship a client bundle that imports `node:fs`. Phase F is the missing post-implementation **bug-test + bug-fix** wave over **everything T0–E will have changed**.

**Verdicts (this pass):**

1. **Phase F is mandatory and last.** It is not a subset of E (E is a keyed re-run + docs sweep). E proves the *claim*; F proves the *machine that produced the claim* still holds under mutation, characterization, contract, keyed/keyless split, and a client-bundle build.
2. **Live T0 is split.** T0.1 persist `version:1`+`migrate`, T0.2 unknown-key round-trip, T0.3 `executeAsync` `dodBlocked`, T0.5 hydrate hole-clamp are **on disk**. T0.4 headless `advanceOnce` enforceDod + `"dod"` outcome and T0.6 mint-after-`gate.passed` are **not**. Tests for the landed items are missing or still pin `version: 0` blobs — characterization debt, not "done".
3. **Production-ready ≠ four gates green.** DoD is: hidden FAIL_TO_PASS + PASS_TO_PASS on a human-approved fixture set the producer never rewrote; floor/refused ≠ LLM-green; keyless byte-parity; client-bundle clean; ledger↔disk hash-bound; no auto-approve; evidence files a human reads. A self-reported "9/9" is data, not proof (162 §8.8).
4. **The bar RapidTool must clear and competitors still fail:** withhold the grader from the producer; one `run.finish(accepted)` writer; keyless honest floor; UI=CLI=eval leave-gate parity; persist/hydrate that cannot wipe users. OpenHands/Codex/MetaGPT/SSSF each own a slice; none own this combination.

**Do not start Phase F until** T0–E have landed *or* the parent explicitly scopes an F-subset at a phase boundary. Each F-item below is still specified so it can run as a **gate after that phase**, not only at the end.

---

## 1. Why Phase F exists (and why it is not D or E)

162 §0 defines functional correctness as: *the produced artifact passes executable, brief-derived, input→output fixtures the producer did not author and did not see, applied by an external harness.*[3] SWE-bench instantiates that as FAIL_TO_PASS + PASS_TO_PASS in a container; a PR's changes are split into a **test patch** and a **gold patch** so solution details do not leak into the grader.[3] Phases A–E of 162 build the factory that *can* say that sentence. They do not **bug-test the factory**.

| 162 phase | What it makes true | What it does **not** prove |
|---|---|---|
| **T0** | Persist versioned; tree keys survive; hard-DoD not recorded as success; hydrate recovers holes; mint-after-gate | Characterization of legacy blobs; every `RunOutcome` mapper handles `"dod"`; repairTreeDir mint order |
| **A** | Behavioral oracle (fixtures persist/emit/run/score/approve/gate) | Producer cannot see/rewrite fixtures; TAP-only scoring under mutation; no auto-approve in wild/eval |
| **B** | `emit --verify-kind`; provenance; real tokens; runner-only exec | Client-bundle still clean after every new import; env-key leak does not flip the suite; kill-honesty |
| **C** | Lessons retrieved + eval-gated promotion | Retired lessons stay retired under prompt-assembly mutation; no secret leak into prompts |
| **D** (autonomy/UX) | Swarm seats, 2nd brain, streaming, resume, budget | Concurrent mid-flight rows; blinded judge actually blind; HITL-refusal parity wild vs autopilot |
| **E** | Full-corpus keyed re-run + docs | The harness itself has a regression suite that fails when *it* lies; flake vs hard-fail census |

Phase E's "honest keyed re-run" is necessary and insufficient. A keyed 9/9 can be: one corpus entry (`run-eval.mjs:634` still `entries.slice(0, 1)`), a self-authored spec the synthesizer just emitted, a `tested` mint that preceded `gate.passed` (live `driveP6Journey` at headless.ts:1402 then :1406), or a foreground shell that sourced `.env` and flipped `enforceDod`. Phase F hunts those classes **after** the features exist.

SSSF's hard rule 10 is the governance primitive F enforces on RapidTool itself: *"phases passing is not the same as the run being accepted. A test phase that ran a red suite succeeded at its job. Pass `accepted=` so the exit code, the session status, and the banner are decided together and cannot disagree."*[7] RapidTool's CLI still saves `status:"complete"` then exits 1 (162 §15.2). F does not re-specify B's `runAcceptance` — it **proves** the single writer cannot disagree, with a characterization + mutation pair.

Anthropic: workflows = LLMs on predefined code paths; agents = LLMs directing themselves; *"finding the simplest solution possible, and only increasing complexity when needed."*[9] Phase F is a **workflow** over the factory: deterministic gates, hidden tests, evidence files. It is not another LLM seat.

---

## 2. Live-tree audit of T0 seams (disk 2026-09-09 — parent may still be editing)

Treat this table as the **characterization baseline**. Phase F's first job after T0 is to pin these behaviors with tests that fail if they regress — Feathers: when you do not know what the code is supposed to do, write tests that *describe what it actually does*, then change it.[10]

| Id | 170_b / 162 §18 intent | Disk this pass | Tests this pass | F implication |
|---|---|---|---|---|
| **T0.1** | zustand `version:1` + `migrate()` before any schema add | **LANDED** `src/lib/store.ts:811-817` (`version: 1`; future `fromVersion > 1` throws; identity migrate otherwise). Name still `"rapidtool.v4"` (:804). | `store.test.ts` still writes blobs with `version: 0` (:825, :1164, :1189). **No** test that a v0 blob identity-migrates, or that v2 throws into `recoverFromCorruptPersistence`. | F-01 characterization + future-version re-seed. Do not "fix" the v0 fixtures — they **are** the legacy corpus. |
| **T0.2** | `generatedTree` preserves unknown per-row keys | **LANDED** `src/lib/io.ts:243-256` and `src/lib/engine.ts:2193-2206` copy extras then overlay `path/source/hash/attempt`. | `io.test.ts:329` well-formed round-trip; junk dropped :342. **No** extra-key (`fixtureIds`) preservation test. | F-02 property: unknown keys survive import/export/hydrate; legacy no-extra path byte-identical. |
| **T0.3** | `executeAsync` stop-reason includes `next.dodBlocked` | **LANDED** `src/lib/store.ts:1241` matches sync `execute` (:1156) and `runUntilHitlAsync` (:1277). | **Zero** `dodBlocked` hits in `*.test.ts`. | F-03: `enforceDod` + failing phase → `executeAsync` `{ok:false}`; mutation of the predicate must kill the test. |
| **T0.4** | headless `advanceOnce` honors `enforceDod`; `RunOutcome` += `"dod"` | **NOT LANDED.** `advanceOnce` :401-447 has `canEnter`/`priorsSealed`, no enforceDod. `RunOutcome` :451 = `"hitl"\|"complete"\|"blocked"\|"error"\|"progress"\|"cap"` — no `"dod"`. `runUntilGate` mapper :507-518 cannot emit it. | `headless.test.ts` covers keyed/keyless `enforceDod` **create defaults** (:92, :104), not leave-gate. | F-04 is a **fix+test** item if T0.4 is still open when F starts; else a regression pair. Every CLI/eval switch on `RunOutcome` must handle `"dod"` (170_b T0.4 gotcha). |
| **T0.5** | hydrate clamps hole-in-phases; `hydrate.repaired` token | **LANDED** contiguous-sealed clamp `engine.ts:2003-2047` (locked-edge + non-locked hole). `hydrate.repaired` event :2311. | `io.test.ts:189` and `store.test.ts:893` assert the log event exists, not the hole clamp. | F-05: payload P0–P2 complete, P3 missing, P4 complete, `currentPhase=4` → edge = 3, token loud, JSON shape unchanged. |
| **T0.6** | mint `tested` only AFTER `gate.passed` | **NOT LANDED.** Comment at :1393-1401 still orders mint → recordGate → read `passed`. Call is :1402 then :1406. `repairTreeDir` `recordGreen` :1829-1845 same order. Failed returns at :1444 still carry the mint. | `headless.test.ts:451` asserts failed journeys *name* `gate.passed`; :817 stamps `lastTest` on pass; :849 no mint on failed *verdict* — not "mint then red gate". | F-06: red-gate + green treeRun → `outcome:"failed"` AND `lastTest.label !== "tested"`. Same for `repairTreeDir`. Keyless passthrough byte-identical (`driveP6Journey` :1324-1335). |

**Other live facts F must not forget:**

- `npm test` = scripts glob then src/lib glob (`package.json:19`). Scripts-leg failure **skips** the lib suite (`&&`). `bash scripts/gate.sh` runs typecheck → lint → tests → build; `--double` is the flake detector (exit 3).
- CLI: 33 `case "` verbs in `scripts/rapidtool-cli.mjs`. No `fixtures` / `corpus` yet (A5/E2).
- `run-eval.mjs:634` keyed leg still `entries.slice(0, 1)` — E1 lifts this; F asserts the flag cannot silently re-slice.
- Client-bundle: `headless.ts:45` and `knowledge.ts:27` **statically** import `node:fs` (server/CLI). Console must not. `store.ts:911` comments the H2 crash class. `npm run build` is the guard (162 §8.3 / 170_b R2).
- Empty `catch {` is dense in `headless.ts` (mint skip :1281, several more) and `engine.ts`. F-20 hunts **silent** ones that swallow honesty failures.
- `DEEPSEEK_API_KEY` in `.env`. Sourcing it in the gate shell flips `keyedDeepSeekConfigured()` → `enforceDod:true` → keyless pipeline tests red (162 §8.1 / 170_b R6).

---

## 3. Testing methodology Phase F actually uses

Do not add a testing-theatre layer. Each method below maps onto a RapidTool seam that already exists. New deps are **opt-in and isolated** (a `src/lib/*.prop.test.ts` or a scripts-leg harness); they must not break the 1447 frozen-baseline pins or the client bundle.

### 3.1 SWE-bench honesty (the grader the producer must not see)

SWE-bench task objects carry `FAIL_TO_PASS` (tests that must go fail→pass) and `PASS_TO_PASS` (tests that must stay pass).[3] Evaluation is containerized via Docker for reproducibility.[2] The public leaderboard is the social proof surface.[1] RapidTool's analog:

| SWE-bench | RapidTool (after A) | Phase F proof |
|---|---|---|
| Hidden FAIL_TO_PASS | Human-approved `acceptanceFixtures` frozen under `briefHash` **before** P6 | Producer (`codegen.server.ts` / journey) never receives fixture `expect` values in the synthesis prompt (grep the prompt assembly). A mutation that interpolates `given`/`expect` into the synthesizer fails F-10. |
| PASS_TO_PASS | Existing `tests/oracle.spec.ts` + emitted self-tests must stay green | treeRun TAP: oracle specs still pass after a behavioral repair. |
| Test patch ≠ gold patch | `tests/brief.spec.ts` (or folded oracle spec — 170_b §12-2) is **not** authored by the synthesizer | Spec bytes hash-equal the emit of `compileFixtureAssertion`; a model-written `tests/*.spec.ts` in the tree is a **foreign file** (A7) and fails without `--force`. |
| Container | `runNodeBounded` subprocess, 30s cap | Generated code never `import()`ed in the engine process (B4 + F-12). |

**Overfitting guard (162 §0 corollary 2):** the fixture suite is frozen before the run and never rewritten by the synthesizer. F-11 is a characterization: snapshot the approved set hash at journey start; assert equality at converge/fail.

### 3.2 Characterization tests (Feathers)

*"Instead of trying to figure out whether code is correct or not, we can try to characterize its behavior to understand what it actually does."*[10] RapidTool's frozen-baseline suite **is** a characterization suite for keyless/floor paths (162 §8.4). Phase F extends it to:

- Persist blob shape (`rapidtool.v4` name + `version` field).
- `sanitizeImportPayload` notes tokens (`generatedTree:dropped`, `acceptanceFixtures:dropped`, `hydrate.repaired`).
- Scaffold emit of the **no-fixture / no-capability** tree (byte-identical).
- `prompt-engine` strings, first-attempt-400, keyless journey passthrough (same-reference).
- CLI JSON envelope keys + exit taxonomy 0/1/2/3/4.

Rule: when a behavior change is **intentional** (T0.1 version bump), update the **legacy fixtures** to still load, and ADD a new test for the new behavior — never weaken the pin (rapidtool-development test-pin discipline).

### 3.3 Property-based tests

fast-check: *"Instead of asking you to hand-pick the inputs your tests run on, it generates them."*[4] Do **not** property-test LLM text. Do property-test **pure deterministic cores**:

| Property | Target | Generator |
|---|---|---|
| Round-trip | `exportProjectJson` ∘ `importProject` preserves well-formed fields; unknown `generatedTree` keys survive; absence ≠ `[]` | Arbitrary well-formed `Project` slices + extra keys |
| Hydrate legality | `hydrateProject` never throws; hole payloads clamp to contiguous sealed+1; tokens loud | Phase-status vectors with holes |
| Fixture emit safety | `JSON.stringify(given)` round-trips; `throws` substring cannot become a regex; `property` always red-cards | Arbitrary plain-JSON `given` including `"); process.exit(1); //` |
| Error registry | `ERROR_CODE_DOC` keys deepEqual the `RT_E_*` union (164-F8) | Enumerate codes |

If adding `fast-check` as a **devDependency** is refused (pin risk), write a 50-case table driver in `node:test` that samples the same space. The property is the requirement; the library is optional.

### 3.4 Mutation testing (who tests the tests)

StrykerJS frames mutation testing as *"Who's testing the tests?"*[5] Phase F does **not** run Stryker over the whole 54-file suite (too slow, too noisy on Windows+space path). It runs **targeted mutants** on honesty predicates — a 20-line script that comments out `\|\| next.dodBlocked`, swaps `gate.passed === true` to `!== false`, deletes `synthesisSucceeded` gates, and asserts the **named F-test goes red**. If the mutant survives, the test is theatre.

Mutant set (minimum):

1. Drop `dodBlocked` from `executeAsync` predicate.
2. Mint `tested` before reading `gate.passed` (the live T0.6 bug).
3. Auto-set `approval:"approved"` in `draftBriefFixtures` / `run-eval`.
4. Score M1 from a `p6.synthesis` log instead of TAP.
5. Static `import "node:fs"` into a console-imported module.
6. Default a new field to `[]` instead of absence.

### 3.5 Contract tests

Pact: *"a code-first consumer-driven contract testing tool"*; *"the contract is generated during the execution of the automated consumer tests"*; unused provider behavior is free to change.[6] RapidTool's consumers are the CLI, the console, `run-eval.mjs`, and `maker-score`. Phase F contracts (no broker required):

| Consumer | Provider | Contract |
|---|---|---|
| `rapidtool-cli.mjs` `respond()` | `errors.ts` `ERROR_CODE_DOC` | Every `{ok:false}` envelope has `code`; `ok:true` never has `code`; exit 3 → `RT_E_LLM_NOT_CONFIGURED` |
| CLI `run`/`gate` mapper | `headless.RunOutcome` | Exhaustive switch; `"dod"` (after T0.4) maps to a non-0 exit + RT_E, never silent 0 |
| `run-eval.mjs` adapter | `TreeRunOutcome` | `behavioral` = `tests[]` entry whose `file` matches the fixture spec; no `testsPass` field invented on the type |
| console | store actions | `approveAcceptanceFixtures` (after A5) exists on the live store object, not only the interface (layered-presence audit) |
| `gate.sh` JSON | four gates | Shape `{ok,double,flakes,hardFails,gates:{typecheck,lint,tests,build}}`; a human reads it |

### 3.6 Keyed vs keyless vs client-bundle (the three legs every F-item reports)

| Leg | How | Forbidden |
|---|---|---|
| **Keyless** | Foreground shell, `unset DEEPSEEK_API_KEY`, `npm test` + CLI `doctor`/`create`/`run` | `. .env`; claiming keyed results |
| **Keyed** | **Child subshell** `.sh` that sources `.env` internally; never the gate shell | Leaving the key exported; recording non-reproducible greens as pins |
| **Client-bundle** | `npm run build` (also runs `db:migrate`) | Skipping build; treating typecheck as a substitute |

---

## 4. What to test after each prior phase

Each subsection: **what / why / where / how-to-test**. Run the **phase gate** before starting the next 162 phase; run the **F-item** if F is executing after that phase has landed. Exact commands assume cwd = repo root, git-bash, quoted paths.

### 4.0 Cross-cutting phase gate (every T0 item and every A–E item)

**What:** four gates + one CLI smoke + env hygiene.
**Why:** 170_b R1 — never claim a gate you did not run; build is the client-bundle guard.
**Where:** `scripts/gate.sh`, `package.json:17-20`, `scripts/rapidtool-cli.mjs`.
**How-to-test:**

```
unset DEEPSEEK_API_KEY
bash scripts/gate.sh --double          # JSON on stdout; exit 0; --double exit 3 = flake
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor
```

Expect: typecheck 0, lint 0 errors (33 warnings baseline), tests 0 with no `not ok`, build 0. Capture `EXIT=` from the file, never from a pipe. Keyed smokes go in `bash rt_f_keyed.sh` that sources `.env` internally and `unset`s on EXIT.

### 4.1 After T0 (foundation)

#### T0.1 persist version — F-01

- **What:** v0 blob identity-migrates; v1 round-trips; v2+ throws into corrupt recovery (clean re-seed, never silent-drop).
- **Why:** a schema bump on zustand `version:0` wipes every user **and re-wipes every reload** (170_b T0.1).
- **Where:** `src/lib/store.ts:803-817` (`persistOptions.version`/`migrate`); recovery `onRehydrateStorage` :825-844; tests `src/lib/store.test.ts` (existing v0 blobs at :825/:1164/:1189).
- **How-to-test:** (a) seed a v0 `rapidtool.v4` blob with a real project → rehydrate → project still there, persisted `version` now 1; (b) seed `version: 2` → `recoverFromCorruptPersistence` ran, demo seed, no throw out of the callback; (c) characterization: partialize keys remain `{projects,activeId,autopilot,demoSeeded}`.

#### T0.2 generatedTree extra keys — F-02

- **What:** well-formed row with `fixtureIds: ["orc-1"]` survives io sanitizer **and** engine hydrate; junk rows still drop; legacy no-extra path byte-identical.
- **Why:** whitelist reconstruction used to strip future per-file fields (170_b T0.2). A1/A0 depend on this.
- **Where:** `src/lib/io.ts:243-256`, `src/lib/engine.ts:2193-2206`, `src/lib/io.test.ts:329-374`.
- **How-to-test:** extend the M2 round-trip: extra key present after `importProject(exportProjectJson(p))`; corrupt container still `generatedTree:dropped`; property: random extra keys on well-formed rows round-trip.

#### T0.3 executeAsync dodBlocked — F-03

- **What:** `enforceDod:true` + DoD-failing phase → `executeAsync` returns `{ok:false}` with the same error wording as sync `execute`; project may persist the `dod.blocked` log.
- **Why:** live honesty bug — hard-DoD block committed success (170_b T0.3). Three predicates; only async was wrong.
- **Where:** `src/lib/store.ts:1241` (also :1156, :1277 — do not re-break those). Tests: **new** in `src/lib/store.test.ts`.
- **How-to-test:** fixture a P6-ready project with `enforceDod:true` and a gate that fails; `await executeAsync(id)` → `ok===false`; mutant dropping `\|\| next.dodBlocked` makes this test fail.

#### T0.4 headless hard-gate — F-04

- **What:** complete-P with failing gate + `enforceDod:true` → `runUntilGate` stops, cursor unmoved, `outcome:"dod"` (additive union). CLI `run`/`gate` and `run-eval` must not drain past P10.
- **Why:** today headless bypasses the UI leave-gate (170_b T0.4). Disk: `advanceOnce` :401-447, `RunOutcome` :451.
- **Where:** `src/lib/headless.ts` `advanceOnce` + `runUntilGate` mapper :507; every `switch` on `RunOutcome` (CLI, tests).
- **How-to-test:** keyless: `enforceDod:true` (injected on the project, not via env) + failing P6 → stopped, phase unmoved, outcome `"dod"`. CLI envelope non-0. Exhaustive mapper test: all union members including `"dod"`. Keyless default `enforceDod:false` still advisory (byte-identical drain).

#### T0.5 hydrate hole clamp — F-05

- **What:** phases 0-2 complete, 3 missing/locked, 4 complete, `currentPhase=4` → clamp to highest contiguous sealed+1 (edge 3), `hydrate.repaired` token, JSON shape unchanged (no new fields).
- **Why:** unrecoverable strand — `priorsSealed` forever (170_b T0.5). Disk clamp: `engine.ts:2024-2047`.
- **Where:** `src/lib/engine.ts` hydrate; `src/lib/io.ts` import path (must copy, not mutate).
- **How-to-test:** import the hole payload; `currentPhase===3`; token in logs; original object not mutated; locked-edge case (T0.5 first branch :2001) still promotes only when priors are genuinely sealed.

#### T0.6 mint-after-gate — F-06

- **What:** green treeRun + red/absent P6 gate → `outcome:"failed"` **and** `lastTest.label !== "tested"`. Green+green → converged + mint. Keyless passthrough same-reference.
- **Why:** red-gate runs carry a `tested` mint today (162 §19.1 residual; disk :1402 before :1406). Same bug in `repairTreeDir` :1829.
- **Where:** `src/lib/headless.ts` `driveP6Journey` :1387-1444; `applyTreeRunTestedMint` :1275; `repairTreeDir` `recordGreen` :1827.
- **How-to-test:** inject `runTree` ok + `recordGate` red → failed, no mint. Inject both green → converged + mint. Keyless: `driveP6Journey(p)` returns `project === p`. Repair path: same pair. Characterization: keyless events string stays pinned.

**T0 phase gate:** 4.0 + F-01…F-06 green + `npm run build` + CLI `doctor` keyless. Do not start A0 until this is true (170_b §18.5).

### 4.2 After Phase A (behavioral oracle) — A0, A1–A6, A7, A5.0

Build order (170_b §18.3, authoritative over 162 §8.9): **A0 → A1 → A2 → A3 → A7 → A4 → A5.0 → A5 → A6**.

#### A0 multi-file tree — F-07

- **What:** each chunk is its own file with cross-file imports, emitted to disk, executed by treeRun; chunks ≥1 are not IIFE orphans; no-capability scaffold byte-identical.
- **Why:** without A0, A2–A4 verify a one-file dump (170_b A0).
- **Where:** `src/lib/codegen.server.ts` `assembleTreeEntry`; `src/lib/scaffold.ts` emit; `src/lib/compile-check.server.ts` `treeRun`; `src/lib/codegen.server.test.ts`, `src/lib/scaffold.test.ts`.
- **How-to-test:** keyed (child shell) journey emits ≥2 files under the work dir; `treeRun` executes chunk 1; frozen-baseline scaffold tests still pass. CLI: `emit` then `tree-run` on the dir.

#### A1 persist fixtures — F-08

- **What:** `acceptanceFixtures` + `acceptanceApprovedAt` + `target` + `briefHash` survive import/export/hydrate; malformed dropped with `acceptanceFixtures:dropped`; legacy absence (never `[]`); brief-hash mismatch → all `pending` + `acceptance.stale` (C6).
- **Why:** canonical home before emit (162 A1). Forgetting the io sanitizer = import crash.
- **Where:** `src/lib/types.ts` Project; `src/lib/engine.ts` hydrate; `src/lib/io.ts` `sanitizeImportPayload`; `src/lib/brief-fixtures.ts` `validateFixtureCase`; `src/lib/io.test.ts`, `src/lib/brief-fixtures.test.ts`.
- **How-to-test:** round-trip approved set; junk case dropped; export of a legacy project string-identical (no `"acceptanceFixtures":[]`); mutate brief → stale.

#### A2 emit spec — F-09

- **What:** ≥1 **all-approved** fixture emits JSON + spec under `tests/`; PKG `test` script branched on the same guard (170_b §12-2 — pin is `tests/oracle.spec.ts` only); `given` via `JSON.stringify`; `shape` = partial match with `"<draft>"`/`"<any>"`; `throws` = substring `includes`; `property` red-card; no `.tsx` entry import; `effect` Given-When-Then harness ships (170_b §13-2, not deferred).
- **Why:** first shipped tree that actually checks input→output. Injection via raw interpolation is the bug class.
- **Where:** `src/lib/scaffold.ts` `emitOracleSpec`; `src/lib/brief-fixtures.ts` `compileFixtureAssertion`; `src/lib/scaffold.test.ts`.
- **How-to-test:** 0-approved → byte-identical emit (parity pin). All-approved → files exist under `tests/`, `node --test` runs them. Payload `given: "\"); process.exit(1); //"` does not kill the process. Partial approval → no emit (the `every` guard).

#### A3 entry behavior — F-10

- **What:** `runEntryFile` asserts data-layer behavior (not a new `dataEntry` field — 170_b §12-1). `TreeRunOutcome.ok` still requires compile + specs + entry pass-or-skip. UI-shell skip remains honest. Bounded 30s.
- **Why:** load-smoke ≠ behavior.
- **Where:** `src/lib/compile-check.server.ts` `treeRun` / `runEntryFile` / `resolveEntry`; `src/lib/compile-check.server.test.ts:204`.
- **How-to-test:** existing green/red/timeout/UI-skip/purity tests stay; add a data-entry whose export returns the wrong shape → `ok:false`. Never import `.tsx` / react.

#### A7 canonical-score + dir reconciliation — F-11

- **What:** after emit, hash-checked re-import; score the bound artifact only; foreign/stale `tests/*.spec.ts` refuse without `--force`; M1/M3/M4 (ledger) and M2/M6 (disk) cannot disagree.
- **Why:** 9/9 run declared a `generatedTree` file that did not exist (170_b A7).
- **Where:** `src/lib/headless.ts` `emitProject` / `importTreeDir`; `scripts/run-eval.mjs`.
- **How-to-test:** emit, delete a declared file, score → red naming the missing path. Drop a stale spec into the dir → refuse. Hash mismatch → `changed` not silent.

#### A4 M1/M2 on TAP — F-12

- **What:** when approved fixtures exist, M1 = all cases pass and `cases>0`; M2 requires `behavioral.passed>0`; `behavioral` from runner TAP of the fixture spec, **never** a synthesis log. No-fixture path byte-identical. M7 integer math unforced.
- **Why:** identifier-stem M1 is not "functional" (162 A4).
- **Where:** `src/lib/maker-score.ts` `m1Substance` / `m2Runs`; `scripts/run-eval.mjs` adapter; `src/lib/maker-score.test.ts` (M1 :80, M2 :231, floor gate :571).
- **How-to-test:** fixtures-all-pass → M1=M2=1 naming the count; one-fail → M1=0 naming the id; no fixtures → existing evidence bytes. Mutant: feed a fabricated `p6.synthesis` "all pass" log → M1 stays 0 without TAP.

#### A5.0 typed-draft + A5 human-approve — F-13

- **What:** `fixtures draft` yields **non-zero** cases (A5.0 LLM typed map; without it drafter red-cards everything — 170_b A5.0). `approve`/`reject`/`--all` are the **only** writers of `"approved"`. Store action sync+idempotent, survives whole-project commit (H39-2.3 `store.ts:240-241`). Draft additive (no clobber of approved ids). Console badge. **No** path auto-approves: grep `driveP6Journey`/`runUntilHitl`/`wildStep`/`run-eval` for `approval: "approved"`.
- **Why:** the one honest human act. Auto-approve is an honesty hole, not a convenience.
- **Where:** `scripts/rapidtool-cli.mjs` new `case "fixtures"`; `src/lib/store.ts` action map :91-157; `src/lib/brief-fixtures.ts` `approveFixtureCases` :497 (already pure, `brief-fixtures.test.ts:461` "never automatically"); `src/components/console.tsx`.
- **How-to-test:** CLI smoke (keyless): `fixtures draft` → pending list; `approve --all` → all approved; second draft does not clobber. Keyed child: A5.0 returns typed rows. Grep-gate: zero matches of auto-approve in journey/eval/wild. Store: approve mid-`executeAsync` survives commit.

#### A6 journey + DoD on behavioral — F-14

- **What:** approved fixtures exist + fixture TAP red → `outcome:"failed"` naming cases, even if identifier gate green. Both green → converged. No fixtures → unchanged. Never mint `tested` on failed fixture run. Repair prompt gets expected-vs-actual delta only. `p6-verified` keys on TAP; `p6-brief-fit` advisory.
- **Why:** A6 without T0.6 builds on a lying mint (170_b §18.5.4).
- **Where:** `src/lib/headless.ts` `driveP6Journey` (after T0.6 reorder); `src/lib/dod.ts` `p6-verified` / `p6-brief-fit`; `src/lib/codegen.server.ts` repair prompts; `src/lib/compile-check.server.ts` red-tail carve-out.
- **How-to-test:** inject green identifier gate + red fixture TAP → failed, no mint. CLI: `tree-run` then journey. `JOURNEY_TOTAL_TIMEOUT_MS` wall-clock cap exists (§13-3) before the keyed Phase-A gate.

**Phase-A gate (162 §18.6 / 170_b):** four gates green **and** a NEW keyed run (two-step: `run-eval` drafts → human `fixtures approve` → re-run with `--fixtures-approved` that **asserts**, never auto-sets) emits a multi-file tree whose fixture spec passes under `treeRun`, M1/M2=1 naming the count. **Read `research/eval-out/results.json` yourself.** Floor/refused still ~5/9 with the floor qualifier.

### 4.3 After Phase B (production readiness)

#### B1 emit --verify-kind — F-15

- **What:** `emit --verify-kind` runs the emitted `package.json` `build` (bound, prefer-offline); red build = red gate; cannot mint `tested`/`shipped`. `RT_E_VERIFY_KIND_FAILED` in `ERROR_CODE_DOC` in the **same** patch (R9).
- **Why:** no webapp emission has ever built (162 B1 / 149_a5 C7).
- **Where:** `scripts/rapidtool-cli.mjs` `case "emit"` :663; `src/lib/compile-check.server.ts`; `src/lib/errors.ts`; `src/lib/scaffold.ts` PKG_SCRIPTS :468-493.
- **How-to-test:** CLI smoke on a known-red tree → exit non-0 + code. Known-green fixture (tiny vite stub) → pass. Timeout bound. Keyless floor emission still stamps floor (B2) and must not claim shipped.

#### B2 provenance — F-16

- **What:** every emitted artifact names producer = LLM|floor|template, packet hash, run-id, `synthesisSucceeded`. DEPLOY.md + headers. Floor/refused cannot be mistaken for software.
- **Why:** 155 R2 + 158_s3 W7: degrade loudly; never let the producer grade itself.
- **Where:** `src/lib/scaffold.ts` emit headers; `src/lib/maker-score.ts` floor discriminator (`maker-score.test.ts:571`).
- **How-to-test:** keyless emit → stamp contains floor / `synthesisSucceeded:false`. Keyed refused → same. Keyed success → LLM + true. Characterization of header bytes for the floor path.

#### B3 real usage metering — F-17

- **What:** `prompt_tokens`/`completion_tokens` accumulate into the run ledger; M8 cites **measured** usage; synthetic `bench.ts` estimates labeled as estimates.
- **Why:** usage is parsed then dropped (`deepseek.server.ts` ~:420-432, 162 §15.1).
- **Where:** `src/lib/deepseek.server.ts` ok-return (additive `usage` — byte-parity of the rest of the shape); `src/lib/headless.ts` / `store.ts` accumulate; `maker-score.ts` M8 (`maker-score.test.ts:465`).
- **How-to-test:** inject fake usage in unit tests (never a live key in the suite). M8 evidence names the numbers. Ok-return without usage stays byte-identical (absence).

#### B4 sandbox honesty + 9.8 repro + runAcceptance/kill — F-18

- **What:** generated code executes only in the runner subprocess; AGENTS.md + runner header say **"resource boundary, NOT a security sandbox"** (Codex *is* OS-enforced Seatbelt/bwrap — RapidTool must not overclaim).[8] Repro: same-packet → byte-identical emission (timestamp-stripped) + sha256 manifest. `runAcceptance()` single writer stamps accepted|failed|aborted; SIGINT/SIGTERM writes `aborted` before exit (SSSF `run.finish(accepted)`).[7] Arg validation + run-id idempotence.
- **Why:** 162 B4/§15.2-15.5. Split-brain complete+exit 1 is an honesty hole F must kill.
- **Where:** `src/lib/node-runner.server.ts:4-17`; `src/lib/verify.server.ts`; `src/lib/compile-check.server.ts`; `scripts/rapidtool-cli.mjs` save-then-exit (~:412-440).
- **How-to-test:** grep `import(` over emitted paths in the engine process → 0. Kill the CLI mid-run → `acceptance:"aborted"` on disk + non-0. Red-gate complete → `acceptance:"failed"` AND exit 1 AND banner agree. Repro: two emits, timestamp-strip, sha256 equal.

**Phase-B gate:** 4.0 + F-15…F-18 + keyed `emit --verify-kind` on the Phase-A tree (child shell) + human-read `DEPLOY.md`.

### 4.4 After Phase C (self-learning)

#### C1 lesson read-back + kill-criterion — F-19

- **What:** every synthesis/repair prompt (verify + P6 synthesize + expandBrief) carries top-N domain lessons; retired lessons never re-enter; sanitize secrets; cap N.
- **Why:** memory helps only when retrieved, evaluated, and discarded (162 C1). 170_b reframes: extend EXISTING read-back, do not rebuild.
- **Where:** `src/lib/knowledge.ts`; `src/lib/codegen.server.ts` (read-back ~:1119 per 162 §19.6); `src/lib/crew.server.ts`; `src/lib/prompt-engine.test.ts` (byte-stable omit when none :341).
- **How-to-test:** keyed: prompt snapshot contains the lesson id. Retired id absent. Keyless: omit-block byte-identical. Secret-looking lesson body does not appear. Mutation: delete the retrieval call → test red.

#### C2 eval-gated promotion — F-20

- **What:** a behavior change records before/after eval delta; negative-delta is retired, never promoted.
- **Why:** LLM-as-judge self-enhancement (162 C2).
- **Where:** `src/lib/maker-score.ts` M6 (`maker-score.test.ts:381`); `src/lib/knowledge.ts`; `scripts/run-eval.mjs` `history.json`.
- **How-to-test:** fixture two `history.json` rows, negative delta → retired. Positive → promoted with both numbers. Never promote from a model-written "I improved" log.

**Phase-C gate:** 4.0 + F-19/F-20 + a keyed re-run whose prompt log (NDJSON under `<dir>/.rapidtool/logs/`) greps the lesson id.

### 4.5 After Phase D (autonomy/UX) — 162 Phase D, not this file

#### D1 real swarm — F-21

- **What:** keyed swarm dispatches bounded LLM seats through the **same** gates as a single-seat run, or the verb is honestly renamed. Deterministic critiquer stays labeled non-LLM.
- **Why:** `swarm` currently "deterministic advisory critique, NO LLM" (162 D1). Name overpromise is an honesty hole.
- **Where:** `src/lib/crew.server.ts`; `src/lib/swarm.ts`; `scripts/rapidtool-cli.mjs` `case "swarm"` :1177; `src/lib/swarm.test.ts`.
- **How-to-test:** keyless swarm → advisory, no fake model text. Keyed: ≥1 real seat, output re-verified by treeRun/DoD. Budget cap per seat. CLI envelope.

#### D2 cross-project knowledge — F-22

- **What:** `rapidtool knowledge search "property ledger"` returns cross-project lessons/decisions; index rebuilds on write; no inappropriate cross-prompt leak.
- **Where:** `src/lib/vault.ts`; `src/lib/knowledge.ts`; CLI `knowledge` :1284.
- **How-to-test:** two projects, search hits both; delete one → index drops it; secret-looking note not returned to the other project's prompt.

#### D3 streaming + resume/checkpoint + concurrency + actor-honesty + blinded judge + budget — F-23

- **What:** keyed synthesis streams to console with **buffer-then-parse** (not per-chunk JSON). Async runs survive process death (persisted cursor + per-cycle checkpoint). Mid-flight engine rows survive concurrent ops. `decidedBy` is the real actor (not inherited `"human"`). Wild loop shares autopilot's HITL-refusal predicate. Judge is blind to the pre-computed DoD verdict. Journey budget hard-stops with `RT_E_BUDGET_EXHAUSTED` + ERROR_CODE_DOC in the same patch. UI items (164-B/165-A/168) have ≥1 console smoke.
- **Why:** 170_b Phase D done-clause. Streaming parse-per-chunk will claim success on a partial retry.
- **Where:** `src/lib/deepseek.server.ts:361` (`stream: false` today); `src/lib/chat.server.ts`; `src/components/console.tsx` WildActivityStrip; `src/lib/wild-step.test.ts`; `src/lib/errors.ts`.
- **How-to-test:** inject a partial SSE then a retry → console does not stamp success on the partial. Kill mid-journey → resume from cursor, no duplicate phase. Concurrent `approve` + `executeAsync` → chat/fixtures survive (H-01 pattern already in `store.test.ts:1288`). Blinded judge: fixture DoD-green, inject contrary evidence → judge does not echo the pre-computed pass. Budget 0 → `RT_E_BUDGET_EXHAUSTED`, journey stops.

**Phase-D gate:** 4.0 + F-21…F-23 + `npm run build` (console-adjacent — R2) + one Playwright/console smoke if UI landed (optional; do not block F on a missing browser).

### 4.6 After Phase E (final honesty)

#### E1 full-corpus keyed re-run — F-24

- **What:** `entries.slice(0, 1)` lifted to a flag; full corpus keyed; behavioral fixtures green on LLM trees; floor ~5/9. Diverse corpus (CLI tool, library, game, agent — not 6× real-estate). Live corpus today: 6 real-estate md files under `research/eval-corpus/`.
- **Where:** `scripts/run-eval.mjs:634`; `research/eval-corpus/`; `research/eval-out/results.json`.
- **How-to-test:** flag `--all` (or equivalent) actually iterates `entries.length`, not 1. Human reads `results.json` (slug, total/9, status, behavioral counts). Floor row present. **Do not** accept a console "ok 9/9" as proof.

#### E2 eval harness regression — F-25

- **What:** `scripts/run-eval.test.mjs` exists (today: **absent** — eval has no suite). Scorer adapter, corpus parser, `--fixtures-approved` assert-not-set, slice-flag, history append.
- **Why:** an unvalidated corpus entry or a buggy scorer silently corrupts every verdict (162 E2).
- **Where:** `scripts/run-eval.mjs`; `src/lib/maker-score.test.ts`; new `scripts/run-eval.test.mjs`.
- **How-to-test:** malformed corpus md skipped loudly; `--fixtures-approved` with all-pending → non-0, does not flip approvals; keyed slice default remains 1 unless flag; history.json append-only.

#### E3 truth-in-docs + E4 audit — F-26

- **What:** README / `scripts/README-cli.md` / AGENTS.md name `fixtures`/`corpus`, human-approve gate, non-sandbox caveat, "no green without LLM + approved fixtures", exit taxonomy. 6-question audit 8–9/10 with human-approve as the **only** residual gap by design.
- **How-to-test:** declare-or-strike grep: every claimed verb has a `case "` arm; "sandbox" in docs is qualified; no "9/9 means functional" leftover. Audit doc is a file the human reads, not a score the machine printed.

**Phase-E gate:** 4.0 + F-24…F-26 + full `gate.sh --double` after all F fixes.

---

## 5. Bug classes to hunt (the F hunt list)

Each class: **what it looks like / why it matters / where it lives / how to test**. Hunt these across the whole T0–E diff, not only the item that introduced them.

### 5.1 Honesty holes — F-H1

- **What:** success recorded past a red/hard gate; `tested`/`shipped`/`9/9` minted from a model log; floor sharing a green path with LLM software; CLI `status:"complete"` + exit 1 disagree.[7]
- **Why:** this is the product. 170_b "5 ways an agent breaks this codebase" #4.
- **Where:** `store.ts` executeAsync predicate :1241; `headless.ts` `advanceOnce` :401, `driveP6Journey` :1402, `repairTreeDir` :1829; CLI save-then-exit; `maker-score.ts` `synthesisSucceeded` gate.
- **How-to-test:** mutants 1–4 in §3.4; CLI contract in §3.5; `sealHonesty` / `sealedWithFailures` (`RunResult` :465-469) cannot be true with exit 0.

### 5.2 Byte-parity — F-H2

- **What:** pinned strings/shapes change; additive field defaulted to `[]`/`false`/`""` instead of absence; no-fixture emit / keyless journey / deepseek ok-return / PKG_SCRIPTS / `prompt-engine` omit-block drift.
- **Why:** ~1447 frozen-baseline tests go red at once (170_b #1). Honesty contract for the floor.
- **Where:** `src/lib/scaffold.test.ts:303-311`; `src/lib/prompt-engine.test.ts:341`; `src/lib/deepseek.server.test.ts`; PKG_SCRIPTS `scaffold.ts:468`.
- **How-to-test:** run frozen-baseline **immediately** after every F patch. On failure, revert the pinned-string edit — do not "fix" the test. Property: legacy export has no new keys.

### 5.3 Client-bundle leaks — F-H3

- **What:** static **or** dynamic `import` of `node:fs` / `*.server.ts` into a module the console graph reaches. H2 crash class. Disk today: `headless.ts:45`, `knowledge.ts:27` are server-ok; engine/report-intake already lazy.
- **Why:** `npm run build` is the guard; typecheck will not catch a Vite client graph error you skipped (162 §8.3).
- **Where:** `src/components/console.tsx`; `src/lib/store.ts:911`; `src/lib/engine.ts:57`; `src/lib/rt-client.ts:10`.
- **How-to-test:** `npm run build` after every console-adjacent change. Grep client graph for `node:fs` / `.server.ts` without concatenated-spec + `typeof window`. Mutant 5 in §3.4.

### 5.4 Env-key leak — F-H4

- **What:** `set -a && . ./.env && set +a` in the foreground gate shell; `DEEPSEEK_API_KEY` persists; `keyedDeepSeekConfigured()` true; `emptyProject` defaults `enforceDod:true`; keyless full-pipeline tests hit P6 hard-DoD and go red; agent then "fixes" green code.
- **Why:** 170_b #3 / 162 §8.1. Also records non-reproducible keyed greens as pins.
- **Where:** any agent shell; `scripts/with-app-env.mjs` (ok — scoped); tests that call `emptyProject`.
- **How-to-test:** F protocol: `unset DEEPSEEK_API_KEY` at the start of every gate; keyed work only in a child `.sh` with EXIT trap. A canary test: `assert.equal(Boolean(process.env.DEEPSEEK_API_KEY), false)` in the lib suite (skip if the test file is the keyed child).

### 5.5 Ledger / disk divergence — F-H5

- **What:** `generatedTree` declares a path that is not on disk; M1/M3/M4 read memory, M2/M6 read disk; stale `tests/*.spec.ts` from a prior cycle re-runs red forever.
- **Why:** 170_b #5. A7 is the fix; F proves it cannot regress.
- **Where:** `headless.ts` `emitProject` :1018, `importTreeDir` :1557; `scripts/run-eval.mjs` slug-dir reuse.
- **How-to-test:** F-11 plus a characterization of `importTreeDir` warnings. Score after a hand-deleted file → red, not 9/9.

### 5.6 Auto-approve — F-H6

- **What:** any path other than human `fixtures approve` flips `pending`→`approved` (`driveP6Journey` / `runUntilHitl` / `wildStep` / `run-eval` / `--fixtures-approved`).
- **Why:** 162 §8.6 / 170_b R4. The human act is the SWE-bench "tests not authored by the producer" analog.[3]
- **Where:** `src/lib/brief-fixtures.ts` (drafter stays pending — already tested :476); CLI; `scripts/run-eval.mjs`; wild.
- **How-to-test:** grep-gate in CI (scripts-leg): those files must not contain `approval: "approved"` assignments except `approveFixtureCases`. `--fixtures-approved` with pending → fail closed.

### 5.7 Silent catch — F-H7

- **What:** `catch {` / `catch (err)` that swallows an honesty failure (gate record, mint, import, persist) and continues as success. Disk: `applyTreeRunTestedMint` :1281 degrades to "deterministic floor stands" — acceptable **only** if the subsequent gate record still runs and can fail the journey. Not acceptable if the catch returns `ok:true`.
- **Why:** a swallowed `recordGate` throw is a green path past a red gate.
- **Where:** `grep -n 'catch {' src/lib/headless.ts src/lib/store.ts src/lib/engine.ts src/lib/compile-check.server.ts` (dense: headless :83,:159,:182,:281,:854,:1160,:1221,:1261,:1281,:1595,:1733,:2125,:2134,:2302).
- **How-to-test:** for each catch on a gate/mint/import/persist path: inject a throw → journey/store result is **failed/ok:false** or a loud token, never a clean 0. Empty catches on *optional* telemetry (rt-ring) may stay if purity-tested (AGENTS.md honesty #7).

### 5.8 Adjacent classes F still hunts

| Id | Class | How-to-test |
|---|---|---|
| F-H8 | **Fixture injection** (`given` raw-interpolated; `throws` as regex) | F-09 payload; `String(err.message).includes` |
| F-H9 | **Layered-presence lie** (interface-typed store action, implementation count 0) | grep `create()` body, not the type; zero `*.test.ts` hits = unwired |
| F-H10 | **Exit-taxonomy drift** (red completion as 0; missing RT_E) | CLI contract; `ERROR_CODE_DOC` deepEqual |
| F-H11 | **Flake laundering** (calling a red a flake) | `gate.sh --double`; prove standalone green before the label (known `exec.test.ts` grandchild only) |
| F-H12 | **Declare-or-strike** (docs claim a verb/sandbox/9/9 the tree does not have) | F-26 grep vs `case "` count (33 today) |

---

## 6. How to prove production-ready (DoD, evidence files, no self-reported green)

### 6.1 Definition of done — Phase F

Phase F is done **only if all of the following hold**. A missing evidence file = not done. A self-reported "green" in an agent transcript = not evidence.

1. **Four gates, real exit codes, `--double`.** `bash scripts/gate.sh --double` stdout JSON has `ok:true`, `flakes:[]`, every nested `gates.*.exit === 0`. The JSON file is copied to `artifacts/phase-f/gate.json`.
2. **T0–E item tests exist and are red under the §3.4 mutants.** Surviving mutant = F not done.
3. **Keyed two-step eval, human-read.** `research/eval-out/results.json` (not a quote of it) shows: ≥1 LLM tree with approved fixtures all-pass, M1/M2=1 naming the count; ≥1 floor/refused row ~5/9 with floor qualifier; `behavioral` counts present. Human (or parent) opens the file.
4. **Keyless characterization intact.** Frozen-baseline still green with `DEEPSEEK_API_KEY` unset. Keyless `driveP6Journey` same-reference. No-fixture emit byte-identical.
5. **Client-bundle clean.** `npm run build` 0 after the last console-adjacent patch. No `node:fs` / `.server.ts` in the client graph.
6. **Single terminal writer.** `Project.acceptance` ∈ {accepted, failed, aborted} agrees with process exit and banner. SIGINT leaves `aborted`.
7. **No auto-approve.** Grep-gate 0 in journey/eval/wild. `--fixtures-approved` asserts.
8. **Docs strike.** README/README-cli/AGENTS.md match the tree (verbs, sandbox caveat, human-approve, exit taxonomy).
9. **Honesty ledger.** `artifacts/phase-f/HUNT.md` lists every F-H1…H12 hunt with pass/fail + file:line. Failures are fixed or explicitly deferred with a reason — never silent.

**Not in DoD (honest residuals, by design):** a real OS sandbox (Codex Seatbelt/bwrap / OpenHands Docker) — RapidTool documents a resource boundary (162 §15.4, P1 upgrade). Fully autonomous "100% functional" on underspecified briefs — the human-approve act is the remaining gap (162 §4.6 / E4).

### 6.2 Evidence files (the only acceptable proof)

Write under `artifacts/phase-f/` (create once; append-only). Do not invent contents.

| File | Produced by | Proves |
|---|---|---|
| `gate.json` | `bash scripts/gate.sh --double` stdout | four gates + flake census |
| `gate-keyless.log` | `unset DEEPSEEK_API_KEY; npm test` captured `EXIT=` | keyless suite |
| `build.log` | `npm run build` | client-bundle guard |
| `cli-smokes.jsonl` | one JSON envelope per verb (`doctor`,`create`,`run`,`gate`,`emit`,`tree-run`,`fixtures`,`diagnose`,`knowledge search`) | CLI contract |
| `results.json` | copy of `research/eval-out/results.json` after the two-step keyed run | behavioral claim (human-read) |
| `history.json` | copy of `research/eval-out/history.json` | C2 delta / M7 |
| `repro.sha256` | timestamp-stripped emit twice | 9.8 repro gate |
| `mutants.md` | §3.4 script output (mutant → test red/survive) | tests actually test |
| `HUNT.md` | F-H1…H12 census | bug-class coverage |
| `bundle-grep.txt` | grep of client graph for `node:fs` / `.server.ts` | F-H3 |
| `auto-approve-grep.txt` | grep of journey/eval/wild for `approval: "approved"` | F-H6 |
| `NDJSON sample` | `<dir>/.rapidtool/logs/` excerpt | paper trail; `diagnose` reads it back |

**Forbidden as proof:** agent "the suite is green"; a prior wave's 1447/1447 header; `console.log("ok 9/9")`; a `results.json` the machine summarized but nobody opened; a keyed run performed in the gate shell.

### 6.3 CLI smoke matrix (exact)

Run from a **temp dir** as cwd when the verb writes (AGENTS.md scripts-leg cwd rule). Capture stdout JSON + exit.

| Verb | Keyless expect | Keyed expect (child shell) |
|---|---|---|
| `doctor` | configured:false, no fake models, RT_E only on failures | configured:true |
| `create` | `enforceDod:false` default | `enforceDod:true` default |
| `run` / `gate` | advisory drain or honest park; never silent past hard-DoD if `enforceDod` set | `"dod"` / HITL park; non-0 on hard-DoD |
| `emit` | floor stamp; `--verify-kind` honest red/green | LLM stamp when `synthesisSucceeded` |
| `tree-run` | TAP-backed `ok` | same |
| `fixtures draft\|approve\|reject` | pending-only draft; approve is the writer | A5.0 typed rows |
| `diagnose` | reads NDJSON; never throws into the observed code | same |
| `knowledge search` | empty-or-hits, no crash | cross-project after D2 |

Exit taxonomy (do not "clean" a red to 0): 0 ok, 1 failure (`RT_E_GATES_FAILED` / `sealedWithFailures`), 2 HITL/`blocked`, 3 `RT_E_LLM_NOT_CONFIGURED`, 4 validation. Envelope: `{ok:false}` ⇒ `code`; `{ok:true}` ⇒ no `code`.

---

## 7. Competitor-surpassing bar

What OpenHands / Codex / MetaGPT / SSSF **still fail or refuse**, that RapidTool **must pass** in Phase F. Cite fetched code/docs, not marketing.

### 7.1 Matrix (live-fetched this pass + 162 §15)

| Axis | OpenHands | Codex | MetaGPT / ChatDev | SSSF | RapidTool must pass in F |
|---|---|---|---|---|---|
| **Grader withheld from producer** | Agent edits then runs tests it can see (CodeAct loop).[11] | Agent runs commands in the workspace; no frozen hidden FAIL_TO_PASS set.[8] | Engineer runs code as executable feedback — tests are not hidden. | `kind="code"` phases run `bun test` in the open.[7] | Frozen human-approved fixtures; producer prompt contains **no** `expect` values; TAP-only scoring (F-12, F-H6). SWE-bench split of test patch vs gold patch.[3] |
| **Completion ≠ acceptance** | Event stream records actions; no single `accepted=` feeding exit+banner.[11] | Session ends; approval policy can be `--ask-for-approval never`.[8] | SOP roles verify intermediates; no run-level accepted triad. | **Has it:** `run.finish(accepted)` — exit, session, banner cannot disagree.[7] | F-18: `runAcceptance` + kill-honesty. SSSF is the bar; RapidTool currently split-brains (162 §15.2). |
| **Keyless honest floor** | Requires a runtime + model; no deterministic "I did not implement the brief" floor. | Needs a model; no keyless scaffold contract. | Same. | Agents always on. | Keyless = deterministic scaffold + `RT_E_LLM_NOT_CONFIGURED`, **never fake model text**. Byte-identical floor paths (F-H2). Floor cannot share LLM-green (F-16). |
| **UI = CLI = eval leave-gate** | UI and runtime share the event stream; still LLM-directed.[11] | CLI flags vs app presets can diverge (`never` vs `on-request`).[8] | No headless/UI parity problem of this shape. | Code owns the loop — closer. | One leave-gate predicate mirrored store `advanceOnce` / headless `advanceOnce` / eval (F-04). Disk today: headless **bypasses**. |
| **OS sandbox** | Docker-sandboxed bash/IPython/browser.[11] | Seatbelt / bwrap+seccomp / Windows sandbox; network off by default.[8] | Not a sandbox product. | `writes:` rollback after the fact, not OS isolation.[7] | **Honest residual:** resource boundary, generated code never in-process (F-18). Do **not** claim Codex/OpenHands-class isolation. Document it (F-26). |
| **Persist / hydrate cannot wipe users** | Event store is the state.[11] | Rollout budget; not a localStorage app. | N/A | SQLite sessions; do not edit `adws/adw_data/sessions/`.[7] | F-01/F-05: versioned persist + hole clamp. A consumer product failure mode competitors do not have — we must not introduce it. |
| **Blinded / independent judge** | Same agent often evaluates. | `approvals_reviewer = auto_review` is a subagent, still model-side.[8] | Roles verify, same model family. | Separate reviewer **prompt template** — better.[7] | F-23: judge blind to pre-computed DoD; evaluator-optimizer order (Anthropic).[9] Human-approve remains the independence guarantee. |
| **Budget hard-stop** | `max_iterations` / `max_budget_per_task` + throttling (tag 0.35.0; 162 §15.1). | `SessionBudgetExceeded` hard stop.[8] | `max_budget → NoMoneyException` (162 §15.1). | Thin ADW scripts; no analog required. | F-23: `RT_E_BUDGET_EXHAUSTED` + ERROR_CODE_DOC same patch. Usage actually accumulated (F-17), not parsed-and-dropped. |

### 7.2 The combination they do not ship

Individually: SSSF owns completion-vs-acceptance;[7] Codex owns OS sandbox + approval policies;[8] OpenHands owns a replayable event stream + Docker runtime.[11]
Anthropic names the workflow/agent split and evaluator-optimizer;[9] SWE-bench owns hidden FAIL_TO_PASS.[3] **None** ship:

1. a **deterministic state machine** that owns transitions (LLM = content only),
2. a **keyless honest floor** that cannot be mistaken for software,
3. **human-approved, producer-blind, TAP-scored** fixtures,
4. **UI=CLI=eval** hard-DoD parity,
5. **versioned persist** that will not wipe the only copy of user work,
6. **declare-or-strike** docs + RT_E taxonomy,

in one factory. Phase F's job is to make (1)–(6) **regression-proof**, not to add a seventh LLM seat.

### 7.3 What RapidTool must **not** copy

- Codex `--ask-for-approval never` as a default (fail-open approvals).[8]
- ChatDev-style dialogue-owned phase progression (contrast case, 158_s1).
- OpenHands confirmation_mode that is optional rather than `forceHuman` (RapidTool already stronger on HITL rights).
- Scoring the producer from its own logs (overfitting; 162 §0).
- Claiming "sandbox" because a subprocess exists (162 §15.4; node-runner self-label).

---

## 8. Execution protocol for Phase F itself

Follow 162 §8 / 170_b R1–R10. Additions that are F-specific:

1. **F runs after T0–E, or at a named phase boundary** with only the matching F-xx items in scope. Do not "start F early" by rewriting A–E.
2. **TDD per F-item:** failing test (RED) → see it fail → fix if the behavior is a bug → green → four gates. Characterization tests that pin **current** (possibly buggy) behavior must be labeled `characterize:` so they are rewritten when the bug is fixed, not treated as sacred pins.
3. **Disk as truth.** Re-grep anchors immediately before each patch (R8). Parent may still be mid-T0 as of this spec.
4. **No four-gate while siblings edit** (AGENTS.md). Integration gate at F boundaries only.
5. **Shell:** `unset DEEPSEEK_API_KEY` first; keyed child `.sh`; no `$(...)`; no `search_files` on this path; MSYS `C:/` for Node, `/c/` for bash.
6. **New files:** `src/lib/*.test.ts` under the existing glob auto-pick up; a **new subdirectory** must be added to `package.json` test globs. `scripts/run-eval.test.mjs` auto-picks up.
7. **RT_E + ERROR_CODE_DOC same patch.**
8. **Evidence files in `artifacts/phase-f/` as you go**, not at the end (a killed F wave must still leave proof).
9. **Do not edit 162.** Parent merges this file. Local ids `F-01…` / `F-H1…`.
10. **Honest failure.** Say what failed. Do not ship a plausible-looking green.

### 8.1 Suggested F wave order (dependency)

P0 (honesty + data loss): F-01, F-03, F-04, F-06, F-H1, F-H6, F-H7 → F-02, F-05, F-H2, F-H3, F-H4
P1 (oracle + score): F-07…F-14, F-H5, F-H8
P2 (production): F-15…F-18, F-H10
P3 (learn + autonomy): F-19…F-23
P4 (prove): F-24…F-26, mutants.md, HUNT.md, full `--double`

If T0.4 / T0.6 are still open when F starts, **implement them as F-04 / F-06** (they are specified as fix+test). Do not wait for a sibling who may have moved on.

---

## 9. Ranked F-item register (merge table)

Effort: S ≤ 1 file + tests · M 2–3 files · L cross-cutting. Ownership: F-wave unless noted.

| Id | One-liner | File targets (re-grep) | Effort | After | Acceptance (DoD) |
|---|---|---|---|---|---|
| F-01 | Persist v0 migrate / v2 re-seed characterization | `store.ts:803-817`, `store.test.ts` v0 blobs | S | T0.1 | v0 kept; v2 re-seeds; partialize keys pinned |
| F-02 | Unknown `generatedTree` keys round-trip | `io.ts:243-256`, `engine.ts:2193-2206`, `io.test.ts` | S | T0.2 | extra keys survive; legacy byte-identical |
| F-03 | `executeAsync` dodBlocked regression + mutant | `store.ts:1241`, `store.test.ts` | S | T0.3 | `{ok:false}` on hard-DoD; mutant dies |
| F-04 | Headless enforceDod + `"dod"` outcome | `headless.ts:401-518`, CLI mapper, `headless.test.ts` | M | T0.4 | cursor unmoved; CLI non-0; union exhaustive |
| F-05 | Hydrate hole clamp test | `engine.ts:2024-2047` | S | T0.5 | edge=3; token; no mutate; shape unchanged |
| F-06 | Mint `tested` only after `gate.passed` (journey+repair) | `headless.ts:1402-1444`, `:1827-1845` | M | T0.6 | red-gate ⇒ no mint; keyless same-ref |
| F-07 | Multi-file tree actually executed | `codegen.server.ts`, `scaffold.ts`, `treeRun` | M | A0 | chunk≥1 on disk + in TAP; parity pins hold |
| F-08 | Fixtures persist + stale-hash | `types.ts`, `engine.ts`, `io.ts`, `brief-fixtures.ts` | M | A1 | absence≠`[]`; dropped token; stale→pending |
| F-09 | Emit spec safety + PKG guard + effect harness | `scaffold.ts` emitOracleSpec, `brief-fixtures.ts` | M | A2 | JSON.stringify; no `.tsx`; 0-approved identical |
| F-10 | Entry behavior (not load-smoke) | `compile-check.server.ts` | M | A3 | wrong return ⇒ `ok:false`; UI skip honest |
| F-11 | Ledger↔disk hash bind | `headless.ts` emit/importTreeDir, `run-eval.mjs` | M | A7 | missing file ⇒ red; stale spec refused |
| F-12 | M1/M2 from TAP only | `maker-score.ts`, `run-eval.mjs` adapter | S | A4 | fabricated log cannot green M1 |
| F-13 | Human-approve only writer + A5.0 non-zero draft | CLI `fixtures`, `store.ts`, `brief-fixtures.ts`, console | M | A5 | grep-gate 0 auto-approve; draft additive |
| F-14 | Journey/DoD on behavioral TAP | `headless.ts` driveP6Journey, `dod.ts` | M | A6 | gate green + fixtures red ⇒ failed, no mint |
| F-15 | `emit --verify-kind` real build | CLI emit, compile-check, `errors.ts` | M | B1 | red build cannot mint shipped |
| F-16 | Provenance stamp floor≠LLM | `scaffold.ts` headers, maker-score floor | S | B2 | keyless stamp = floor |
| F-17 | Real token accumulation | `deepseek.server.ts` usage additive | S | B3 | M8 names measured counts; ok-shape parity |
| F-18 | Runner-only exec + runAcceptance + kill + repro | node-runner, CLI, AGENTS.md caveat | L | B4 | SIGINT⇒aborted; sha256 equal; no in-process import |
| F-19 | Lesson read-back + retire | `knowledge.ts`, `codegen.server.ts` | M | C1 | retired id absent from prompt |
| F-20 | Eval-gated promotion | maker-score M6, `history.json` | S | C2 | negative delta retired |
| F-21 | Swarm real or renamed | `swarm.ts`, crew.server, CLI swarm | M | D1 | keyless not fake-LLM; keyed through same gates |
| F-22 | Cross-project knowledge search | vault.ts, knowledge.ts, CLI | M | D2 | CLI search hits ≥2 projects |
| F-23 | Stream buffer, resume, actor, blind judge, budget | deepseek.server, wild-step, errors.ts | L | D3 | partial SSE ≠ success; `RT_E_BUDGET_EXHAUSTED` |
| F-24 | Full-corpus flag + diverse entries | `run-eval.mjs:634`, eval-corpus | M | E1 | `--all` iterates N; human-read results.json |
| F-25 | Eval harness test suite | **new** `scripts/run-eval.test.mjs` | M | E2 | `--fixtures-approved` cannot auto-set |
| F-26 | Truth-in-docs + audit file | README*, AGENTS.md, audit md | S | E3/E4 | declare-or-strike; sandbox qualified |

**Explicitly NOT in Phase F (coordinate, don't rebuild):** A0–A6 feature work (those waves own the code; F owns tests/gates/proofs — except F-04/F-06 if T0.4/T0.6 still open). New LLM seats. A Docker sandbox. Renaming Phase D. Editing `fixes/162_master_execution_plan.md`.

---

## Sources

Fetched 2026-09-09 (urllib + browser UA). Ledger: `ledger_173.json`. OpenAI SWE-bench Verified blog 403; r.jina.ai 403 — not cited.

[1] https://www.swebench.com — SWE-bench Leaderboards
[2] https://raw.githubusercontent.com/princeton-nlp/SWE-bench/main/README.md — SWE-bench README (Docker containerized harness, 2024-06-27)
[3] https://arxiv.org/html/2310.06770 — Jimenez et al., SWE-bench (FAIL_TO_PASS / PASS_TO_PASS; test patch ≠ gold patch; fail-to-pass filter)
[4] https://fast-check.dev/docs/introduction — fast-check property-based testing (generated inputs, not hand-picked)
[5] https://stryker-mutator.io/docs/stryker-js/introduction — StrykerJS ("Who's testing the tests?")
[6] https://docs.pact.io — Pact consumer-driven contracts (contract generated from consumer tests)
[7] https://raw.githubusercontent.com/disler/super-simple-software-factory/main/.claude/skills/sssf/SKILL.md — SSSF hard rules (`run.finish(accepted)`; gates validate claims; `writes:` rollback)
[8] https://developers.openai.com/codex/agent-approvals-security.md — Codex sandbox modes + `--ask-for-approval never` / Auto preset
[9] https://www.anthropic.com/engineering/building-effective-agents — workflows vs agents; evaluator-optimizer; simplest solution
[10] https://michaelfeathers.silvrback.com/characterization-testing — Feathers, Characterization Testing (2016)
[11] https://arxiv.org/html/2407.16741 — OpenHands (event stream; docker-sandboxed runtime; CodeAct)

Inherited, not re-fetched this pass (162 §0 / §15 / 167_*): SWE-bench Verified (openai.com 403), MetaGPT `NoMoneyException`, Codex `SessionBudgetExceeded` code path, LiteLLM spend-tracking.

---

## Appendix A — file:line verification (this pass)

| Anchor | Pattern on disk | Status |
|---|---|---|
| store.ts:811 | `version: 1` | V |
| store.ts:812-816 | `migrate` / future version throw | V |
| store.ts:804 | `name: "rapidtool.v4"` | V |
| store.ts:1241 | `next.dodBlocked` in `executeAsync` | V |
| store.ts:1156 / :1277 | same predicate on sync / runUntilHitlAsync | V |
| io.ts:243-256 | extra-key copy on generatedTree | V |
| engine.ts:2193-2206 | extra-key copy on hydrate | V |
| engine.ts:2024-2047 | hole-in-phases contiguous clamp | V |
| engine.ts:2311 | `hydrate.repaired` | V |
| headless.ts:401-447 | `advanceOnce` — no enforceDod | V (T0.4 OPEN) |
| headless.ts:451 | `RunOutcome` without `"dod"` | V (T0.4 OPEN) |
| headless.ts:1402 vs :1406 | mint before `recordGate` | V (T0.6 OPEN) |
| headless.ts:1829 | `repairTreeDir` same mint-first | V (T0.6 OPEN) |
| headless.ts:1324-1335 | keyless same-reference passthrough | V |
| run-eval.mjs:634 | `entries.slice(0, 1)` keyed | V |
| package.json:19 | npm test two-leg `&&` | V |
| CLI `case "` count | 33 | V |
| `scripts/run-eval.test.mjs` | absent | V |
| store.test.ts dodBlocked | 0 hits | V |
| io.test.ts extra-key pin | absent (well-formed round-trip only :329) | V |

Drift tolerance: ±5 lines if T0 siblings keep editing. Re-grep before patch.

---

## Appendix B — merge notes for the parent

- **Insert as `## 20. PHASE F — RELIABILITY / PRODUCTION HARDENING`** after 162 §19 (or fold a one-paragraph pointer into §2 / §18.1 as item 20). Do **not** name it Phase D.
- Local ids `F-01…F-26` and hunt ids `F-H1…F-H12` are merge-stable. Do not collide with 162's D0–D3 or 170_b T0.1–T0.6 (those remain the feature ids; F-xx are the *tests/gates/proofs*).
- 170_b §18.6 "Phase E done" is **not** Phase F done. E proves the terminal claim once; F makes it stay true.
- Live T0 split (§2) will be stale within hours — parent should re-run the six-row table before assigning F-04/F-06 as fix vs regression.
- Sibling overlap: any T0 implementer still in `store.ts`/`headless.ts` owns those files until their gate; F waits or takes T0.4/T0.6 only if abandoned.
- This file was the **only write**. `src/` and `scripts/` untouched. `fixes/162_master_execution_plan.md` untouched.

---

*End of 173. Phase F is the wave that makes "production-ready" a property of the factory, not a sentence in a plan.*
