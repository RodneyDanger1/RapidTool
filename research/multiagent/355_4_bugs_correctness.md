# W355 · lane `inspector-correctness` — the red baseline, classified

**Wave:** W355 (audit/freeze). **Kind:** read-only bug inspection. **HEAD:** `30bce78` + 98 modified /
32 untracked uncommitted files (the never-boundary-verified "354 wave").
**Scope:** the 5 typecheck errors + the 15 failing scripts-leg tests, plus the crash/robustness classes
the suite does not cover. **I fixed nothing** — every claim below is either a command I ran or a
`file:line` I read.

---

## 1. Method

Baseline facts were taken from the captured log, **not** re-run:
`C:\Users\mnril\AppData\Local\Temp\rt-baseline-npm-test.log` (191 575 bytes, 4 604 lines;
15 `not ok` lines at 1000/1043/1324/1572/1644/1860/1954/2065/2157/2773/2925/3186/3250/4294/4344).
No full `npm test`, no `npm run build`, no `gate.sh`, no `--test-name-pattern` (the no-op trap) —
every short/filtered output below was read for its own `ok N - <name>` / `not ok N - <name>` line,
never for an exit code.

Commands actually run (all read-only; the only writes were to `%TEMP%` scratch and to this file):

| Purpose | Command |
|---|---|
| confirm the 5 type errors | `npx tsc --noEmit` (exit 2, same 5 lines) |
| scripts-leg typecheck | `node node_modules/typescript/bin/tsc -p tsconfig.scripts.json --noEmit` |
| per-file standalone runs | `node --test --test-reporter=tap <file>` for `scripts/prevention/replay-harness.test.mjs`, `scripts/guards/delivery-gate.test.mjs`, `scripts/guards/gate-invariants.test.mjs`, `scripts/check-module-coverage.test.mjs`, `scripts/diagnose-audit.test.mjs`, `scripts/factory-watch.test.mjs`, `scripts/cli-exit-taxonomy.test.mjs`, `scripts/typecheck-scripts.test.mjs` |
| src-leg flake probe | `node --experimental-strip-types --test --test-reporter=tap src/lib/compile-check.server.test.ts` |
| census probe | `node --experimental-strip-types --input-type=module -e "…treeSubstanceOf(dir,{green:true})…"` over 4 cassette trees |
| real CLI probe (hollow tree) | `emit --project testruns/office-scheduler/build.json --out %TEMP%\rt355-probe\out2 --run --git` (temp out only) |
| real CLI probe (fresh tree) | `create --brief … --name VerifyProbe --out %TEMP%\…` + `emit` → read the emitted `tests/oracle.spec.ts` |
| drift attribution | `git show HEAD:<file>` (byte comparison; no checkout/stash/apply) |

---

## 2. The 20 red items, classified

`regression` = a documented behaviour broke. `drift` = introduced by the uncommitted 354-wave edits.
`env` = an artifact of the host/harness. **Every one of the 20 is dirty-tree-introduced**: for each
root cause I compared the HEAD bytes (`git show HEAD:<file>`) or measured the current bytes; the
pristine-`30bce78` re-run itself is the one thing I could not execute (§5).

### 2a. The 5 typecheck errors — all TEST-side, all drift

| # | item (file:line) | source-or-test | regression/drift/env | root cause | the command that proved it |
|---|---|---|---|---|---|
| T1 | `src/lib/headless.test.ts(5999,15)` `'res.steps' is possibly 'undefined'` | **TEST** | drift | `WildLifecycleShape`'s `ok:true` arm declares `steps?: number` (`src/lib/headless.ts:6905`), so `assert.ok(res.steps >= 1, …)` cannot typecheck; the line is new | `git show HEAD:src/lib/headless.test.ts \| Select-String 'steps >= 1'` → **empty**; the assertion is at `headless.test.ts:5999` today |
| T2 | `src/lib/scaffold.test.ts(2712,25)` `Property 'gameTemplate' does not exist on type 'ScaffoldResult'` | **TEST** | drift | `gameTemplate?: true` is declared only on the `ok:true` arm (`src/lib/scaffold.ts:180`, inside the union at `:136-137`); the test reads it on the raw union. `okFiles()` (`scaffold.test.ts:32-35`) asserts `result.ok` but **casts** the value, so it never narrows `result`; the field is `scaffold.ts:9385` (`kind === "game" ? { gameTemplate: true } : {}`) | `npx tsc --noEmit` (both 2712 + 2719); `git show HEAD:src/lib/scaffold.test.ts \| Select-String 'gameTemplate'` → **empty** (both sides new) |
| T3 | `src/lib/scaffold.test.ts(2719,25)` same property | **TEST** | drift | same as T2 (`assert.equal(result.gameTemplate, undefined)` on the union) | as T2 |
| T4 | `src/lib/wild-step.test.ts(1399,44)` `'"complete"' is not assignable to '"awaiting_hitl" \| "rejected" \| "locked"'` | **TEST** | drift | the local helper is narrowed to 3 statuses (`wild-step.test.ts:18`) while `PhaseStatus` has 6 incl. `"complete"` (`src/lib/types.ts:4`); the call site is new | `git show HEAD:src/lib/wild-step.test.ts \| Select-String 'wildFixture\("complete"\)'` → **empty**; `Select-String 'wildFixture'` shows the current calls at `:1399` and `:1415` |
| T5 | `src/lib/wild-step.test.ts(1415,44)` same | **TEST** | drift | as T4 (second call site, the unsealed control) | as T4 |

Fix direction (mender, test files only): narrow at the use site (`res.steps ?? 0`, `result.ok && …`) or
widen the helper param to `PhaseStatus` — the helper's own body already handles the non-hitl branch
(`wild-step.test.ts:31`).

### 2b. The 15 failing tests

| # | item (test) | source-or-test | regression/drift/env | root cause | file:line | the command that proved it | Wave-1 fix owner (file) |
|---|---|---|---|---|---|---|---|
| 163 | `module-coverage: a stale allowlist entry (module now reached) fails the guard` | **SOURCE** (allowlist data) | drift | 7 `src/lib/auth/*` allowlist entries are stale: the new untracked `src/lib/auth/account.test.ts` dynamically imports `./verify.server.ts` (`:22`) and `./account.ts` (`:34`), and `account-default.test.ts:18` imports `./verify.server.ts` — the guard's own rule is "delete the entry" | `scripts/check-module-coverage.test.mjs:122`; allowlist in `scripts/check-module-coverage.mjs` | standalone: `node --test --test-reporter=tap scripts/check-module-coverage.test.mjs` → `not ok 6` / `not ok 7` (5 pass / 2 fail); the guard's own stdout (baseline-log line 1043) lists all 7 | `mender · scripts/check-module-coverage.mjs` |
| 164 | `module-coverage: the CLI runs green on the live repo and exits 0` | **SOURCE** (same) | drift | same cause — the CLI-level assertion is correct and exits 1 because the guard refuses | `scripts/check-module-coverage.test.mjs:132-136` | same standalone run (`not ok 7`); guard stdout: `131/140 … 7 stale allowlist entries` | `mender · scripts/check-module-coverage.mjs` |
| 204 | `W49 · 335-4 / 338-2: a fresh tree is now VERIFIED (exit 0 …)` | **SOURCE** | drift → **regression** | **A2-F2**: the emitted `tests/oracle.spec.ts` now carries, for every row with no targeting module surface, `assert.fail("<id> is NOT IMPLEMENTED …")` (`src/lib/scaffold.ts:6374`, comment `:6360-6366`), where HEAD emitted `test.skip("<id> — NOT IMPLEMENTED")` (`git show HEAD:src/lib/scaffold.ts:3687-3692` and `:3700`). So a fresh emission's own `npm run test` exits 1 → `treeRun.ok:false` (`RT_E_TREE_RUN_FAILED`) → `emit --run` exit 1 | `scripts/cli-exit-taxonomy.test.mjs:2758-2798` | baseline-log failure detail (the emitted `orc-phase` row + `"code": "RT_E_TREE_RUN_FAILED"`); my fresh-emit probe read `<tmp>/tree/tests/oracle.spec.ts` → `test("orc-phase") { … assert.fail("orc-phase is NOT IMPLEMENTED …") }` (`assert.fail` commented `fixes/354 A2-F2`) | `mender · src/lib/scaffold.ts` (or the tree-run contract) |
| 208 | `341-6 - a SINGLE keyless unattended … seals complete` | **SOURCE** (contract rename) | drift → regression | `terminalStatusOf` is new (`src/lib/engine.ts:2025-2028`) and `summary.status` now carries `complete_with_failures` (`src/lib/headless.ts:1755-1756`), which did **not exist at HEAD** (`git show HEAD:src/lib/headless.ts \| Select-String complete_with_failures` → empty). The test's claim (`cli-exit-taxonomy.test.mjs:3050`) and the published driver loop `if summary.status == "complete" or "blocked": stop` (`scripts/README-cli.md:332`) are both unchanged → a doc-following driver never stops | `scripts/cli-exit-taxonomy.test.mjs:3050`; `scripts/README-cli.md:332` | standalone `cli-exit-taxonomy` run → `not ok 44`: `'complete_with_failures' !== 'complete'`; the assertion lines are untouched by the dirty tree (`git diff HEAD -- scripts/cli-exit-taxonomy.test.mjs` shows no `summary.status` hunk) | owner decision, then `mender · src/lib/headless.ts` + `scripts/README-cli.md:332` + the test — keep `summary.status` and add a new field, or reconcile all three |
| 216 | `346 P0-3 + W352 R-19 — emit --run --git … a GREEN verdict is unchanged` | **SOURCE** | drift → regression | same A2-F2 root: the fixture's emitted tree fails its own `npm run test` on the `orc-phase` `assert.fail` row, so the red-tree guard withholds (`reason:"tree-run-red"`) and `emit --run --git` exits 1 | `scripts/cli-exit-taxonomy.test.mjs:3261` | standalone `cli-exit-taxonomy` → `not ok 52`; its stdout has 4 `orc-phase` lines + `RT_E_TREE_RUN_FAILED`; own probe (`emit --run --git` on `testruns/office-scheduler/build.json`) reproduced `git:{committed:false,reason:"tree-run-red"}` | `mender · src/lib/scaffold.ts` |
| 217 | `346 L4 + W352 R-19 — emit --check --git withholds a red-check commit; a green … unchanged` | **SOURCE** | drift → regression | same A2-F2 root; the refusal text names the re-verify: "the emitted tree did not re-verify green immediately before the commit (the emitted project's own `npm run test` fail (exit 1))" | `scripts/cli-exit-taxonomy.test.mjs:3378` | standalone `cli-exit-taxonomy` → `not ok 53` (key fields: `"reason":"tree-run-red"`, `"code":"RT_E_TREE_RUN_FAILED"`) | `mender · src/lib/scaffold.ts` |
| 218 | `W61 B1 — emit --run --git withholds RT_E_SUBSTANCE_EMPTY on empty substance …` | **SOURCE** (census) | drift → regression | **A2-F3**: the top-level census now walks **all** code modules (`collectTreeCodeSources`, `src/lib/compile-check.server.ts:719-757`) instead of the job dirs, so the historical hollow fixture reads `mixed`, not `empty`; the CLI's withhold compares the top-level verdict (`scripts/rapidtool-cli.mjs:3008`, `:3026`) | `scripts/cli-exit-taxonomy.test.mjs:3501` | standalone → `not ok 54`: `precondition: the census reads the tree empty — 'mixed' !== 'empty'`; direct probe: `treeSubstanceOf('testruns/office-scheduler/emitted')` → `verdict:"mixed"` while `jobScoped.verdict:"empty"` | `mender · src/lib/compile-check.server.ts` (+ the CLI withhold) |
| 233 | `348 (W1): diagnose --project … stamps capture/phase on its exit row` | **SOURCE** | drift | the hard-coded `capture: "scripts/rapidtool-cli.mjs:455"` (`scripts/rapidtool-cli.mjs:539`) is stale — the CLI grew 608 lines in the dirty tree, so the real `cliLogEvent({` emit site is now `:519`; the test's rule (the pointer must land on a `cliLogEvent(` line) is correct | `scripts/rapidtool-cli.mjs:539` vs `:519`; `scripts/diagnose-audit.test.mjs:108-116` | standalone: `node --test --test-reporter=tap scripts/diagnose-audit.test.mjs` → `not ok 1`: `capture must point at the REAL emit site — line 455 reads: "      const text ="`; `Select-String 'cliLogEvent\('` → 519 | `mender · scripts/rapidtool-cli.mjs` |
| 246 | `a GREEN delivery-time tree-run commits, and the idempotent re-emit stays a green noop` | **SOURCE** | drift → regression | same A2-F2 root: `deliverVerified`'s verify stage re-runs the emitted tree, whose own `npm test` fails, so nothing commits (`first.committed` is `undefined`) | `scripts/factory-watch.test.mjs:674-690` (assert at `:683`) | standalone `scripts/factory-watch.test.mjs` → `not ok 12`, `a green tree must deliver. undefined undefined / false !== true`; the shared mechanism is proven by my fresh-emit probe (every emission carries the `assert.fail` row) | `mender · src/lib/scaffold.ts` |
| 345 | `C-06 emit --run --git must withhold a substance-empty tree` | **SOURCE** (census) | drift → regression | same A2-F3 root — the fixture no longer reproduces the historical empty census | `scripts/guards/delivery-gate.test.mjs:71-81` (assert at `:74`) | standalone: `node --test --test-reporter=tap scripts/guards/delivery-gate.test.mjs` → `not ok 1` (`'mixed' !== 'empty'`), control `ok 2` | `mender · src/lib/compile-check.server.ts` |
| 367 | `C-14 p6-arch must fail closed on a keyed attempt with no tree` | **TEST** (stale fixture) | drift | `newestSynthesisEvent` + the probe now fail closed on a recorded terminal `p6.synthesis.refused` (`src/lib/dod.ts:1420-1421`); HEAD was `return !(newest && newest.event === "p6.synthesis.attempt")`. The new rule is deliberate + documented (A3-E7 / W61-C8, `dod.ts:1396-1407`). But the test's `keylessNoTree = {...base, generatedTree: []}` (`scripts/guards/gate-invariants.test.mjs:207`) keeps the fixture's **8** `p6.synthesis.*` rows (newest = `refused` — measured), so it is not the keyless floor its assertion claims | `src/lib/dod.ts:1420-1421`; `scripts/guards/gate-invariants.test.mjs:203-208` | standalone `gate-invariants` → `not ok 9` (`false !== true` at `:208`); fixture dump: 8 synthesis rows, newest `p6.synthesis.refused` ("chunk 2/8 refused · typeSignature functions not exported") | `mender · scripts/guards/gate-invariants.test.mjs` |
| 407 | `C-06 real seam: treeSubstanceOf reports the hollow trees as empty` | **SOURCE** (census) | drift → regression | same A2-F3 root | `scripts/prevention/replay-harness.test.mjs:78-88` (assert at `:84`) | standalone `replay-harness` → `not ok 4`; measured `office-scheduler/emitted` = `mixed` (real:4 / reexports:4, job `empty`), `flower-shop-website/emitted` = `mixed`, and the **control** `bakery-website/emitted` = `mixed` too (its `:87` claim `"real"` is now also false) | `mender · src/lib/compile-check.server.ts` |
| 415 | `single command: the two signals are reported and the gate of record is exact` | **SOURCE** (census) | drift → regression | `DRIVERS["substance"]` fires only on `verdict === "empty"` (`scripts/prevention/replay-harness.mjs:1190-1205`), which A2-F3 made unreachable for any emitted tree → `fixtureIntegrity.missed:["C-06"]` | `scripts/prevention/replay-harness.mjs:1196`; `scripts/prevention/replay-harness.test.mjs:153-172` | standalone `replay-harness` → `not ok 12`: `no fixture-integrity miss + ['C-06'] - []` (13 pass / 2 fail) | `mender · src/lib/compile-check.server.ts` |
| 585 | `scripts typecheck: no NEW errors beyond the recorded per-file budget` | **SOURCE** (new red line) | drift | `scripts/typecheck-scripts.test.mjs(219,16): error TS2339: Property 'NODE_TEST_CONTEXT' does not exist on type '{ RT_TYPECHECK_NESTED: string; }'` — the `delete env.NODE_TEST_CONTEXT;` line is new; `ERROR_BUDGET` is intentionally `{}` (`typecheck-scripts.test.mjs:52`), so any new error reddens the ratchet | `scripts/typecheck-scripts.test.mjs:217-219` | `node node_modules/typescript/bin/tsc -p tsconfig.scripts.json --noEmit` → exactly that one line; `git show HEAD:scripts/typecheck-scripts.test.mjs \| Select-String NODE_TEST_CONTEXT` → empty | `mender · scripts/typecheck-scripts.test.mjs:219` |
| 586 | `scripts typecheck: npm run typecheck runs BOTH legs (src + scripts)` | **SOURCE** (the 5 src errors + 585) | drift | the test is correct; it spawns the real `npm run typecheck`, whose leg 1 (`tsc --noEmit`) is red on the 5 errors, so the `&&` chain never reaches leg 2 | `scripts/typecheck-scripts.test.mjs:202-239` | standalone `typecheck-scripts` → `not ok 3` printing all 5 src errors; the standalone log's own tail (`not ok 2`) is 585 | `mender · the 5 test files in §2a` |

**Tally:** source-wrong **14** · test-wrong **6** (the 5 type errors + 367) · environment **0**.
Genuine functional regressions: 204, 208, 216, 217, 218, 246, 345, 407, 415 (**9**). Pure drift
(no behaviour breach): 163, 164, 233, 367, 585, 586 + the 5 type errors.

---

## 3. Crash/robustness classes

**(a) `node:fs` into a client-safe module (the H2 crash class) — REFUTED.**
Three non-`.server.` modules import `node:fs` statically: `src/lib/entry-oracle.ts:33`,
`src/lib/knowledge.ts:30`, `src/lib/write-set.ts:14`. None is reachable from the client chain: grepping
`src/components/console.tsx`, `src/components/*.ts{,x}`, `src/routes/*.tsx`, `src/router.tsx` and
`src/lib/store.ts` for those modules returns **no import**, and `src/lib/engine.ts:11` imports
`knowledge.ts` **type-only** (`import type { RankableLessonRow }`) — erased by strip-types. The
client→`headless` path uses the documented dynamic seam (`src/lib/store.ts:1626-1651`,
`clientSafeServerSpecifier`; comment `:1635-1639`). *Caveat:* a bundle-level proof needs `npm run build`,
which is out of scope for this wave — so this is refuted by source inspection, not by a build.

**(b) A caught error with no `RT_E_*` code and no ledger row — CONFIRMED (one live site).**
`scripts/rapidtool-cli.mjs:2682-2687`:
```js
let seal = null;
try { seal = await h.planUnderproductionSeal(project); }
catch { /* the refusal already carries its registered code */ }
```
A throw leaves `seal === null`, so the below-floor delivery seal is **silently skipped** — no code, no
row, no note. Impact is bounded (the scaffold refuses a below-floor partial pre-write regardless,
`rapidtool-cli.mjs:2987`), but the swallow is real and the comment's justification is false for the
throw path. Two neighbouring sites are **not** silent: `:2914-2919` surfaces
`payload.tested.ledgerSaved = false`; `:4861-4863` leaves `mode:"keyless"` + the honest
deterministic-floor `note` (`:4820-4823`), so the keyed-polish failure is reported as keyless rather
than hidden. Census for context: 277 one-line `} catch {` blocks under `src/lib` (inspected, not
individually audited).

**(c) The secret redactor treating a single-space key as a secret — REFUTED.**
`redactSecrets` (`src/lib/node-runner.server.ts:437-469`) requires `apiKey.trim().length > 0` before the
`split/join` substitution — with the comment naming exactly this failure mode and citing fix 347
(`:446-449`). A `" "` / blank env value therefore cannot replace every space, and the shape regexes are
length-floored (`sk-or-` ≥34 more, `xai-`/`tvly-` ≥16).

**(d) The RUNLOCK guard refusing a drive while `src/**` changes mid-run — CONFIRMED, and over-broad.**
`runlockEditViolations(root, runStartMs)` (`src/lib/headless.ts`) walks **both** `src/**` and
`scripts/**` by default and flags **any** file with `mtimeMs > runStartMs`. It is wired into the
`run`/`gate`/`resume`/`unattended`/`tree-run` arms by the CLI (`scripts/rapidtool-cli.mjs:1140-1156`,
`:1766-1782`, `:1923`, `:1949`, `:2060`), so in this repo — 98 files already dirty and sibling lanes
still writing `src/**` — any drive whose window contains one write refuses with
`RT_E_SRC_EDITED_DURING_RUN`. The standalone preflight is correct in itself (`--selftest`: historical
overlap refuses, clean window allows, absent lock refuses), but the in-run form is a false-refusal
generator under concurrency. Not the cause of any of the 15 (their failure text names tree-run/substance
/status causes).

**(e) The load-sensitive child-spawn flake class (`compile-check.server` / its `treeRun` parent) — did
not reproduce.** See §4.

---

## 4. Flake list — EMPTY

Every one of the 15 reproduces **standalone**, so none is order/timing sensitive. Command used in each
case: `node --test --test-reporter=tap <file>` from the repo root (or
`node --experimental-strip-types --test --test-reporter=tap src/lib/compile-check.server.test.ts`).

| file | result (standalone) | covers items |
|---|---|---|
| `scripts/check-module-coverage.test.mjs` | 5 pass / **2 fail** | 163, 164 |
| `scripts/cli-exit-taxonomy.test.mjs` | 57 pass / **5 fail** (412 s) | 204, 208, 216, 217, 218 |
| `scripts/diagnose-audit.test.mjs` | 1 pass / **1 fail** | 233 |
| `scripts/factory-watch.test.mjs` | 20 pass / **1 fail** | 246 |
| `scripts/guards/delivery-gate.test.mjs` | 1 pass / **1 fail** | 345 |
| `scripts/guards/gate-invariants.test.mjs` | 12 pass / **1 fail** | 367 |
| `scripts/prevention/replay-harness.test.mjs` | 13 pass / **2 fail** | 407, 415 |
| `scripts/typecheck-scripts.test.mjs` | 4 pass / **2 fail** | 585, 586 |

The documented load-sensitive probe, run standalone, is **green**: `compile-check.server.test.ts` →
`# tests 110 / # pass 109 / # fail 0 / # skipped 1`. So the class is an environment/load artifact of a
full-suite run, not a defect — and it was never actually exercised in the baseline, because the src leg
**never ran**: `npm test` chains the legs with `&&` (log line: `npm notice run node --test … && node
--experimental-strip-types --test …`) and the scripts leg exited 1.

---

## 5. What I could not verify

- **A pristine-`30bce78` re-run.** I may not check out, stash, or apply the safety patch. I substituted
  `git show HEAD:<file>` byte comparisons for every root cause — each mechanism above is absent from
  HEAD (the `wildFixture("complete")` calls, `gameTemplate`, `res.steps >= 1`, `complete_with_failures`,
  `NODE_TEST_CONTEXT`, the `test.skip`→`assert.fail` oracle row). So "reproduces on a pristine tree" is
  **unproven by execution**, though proven by bytes.
- **The rest of the src leg.** `src/lib/**` + `src/components/**` (~115 suites) never ran in the
  baseline and I did not run them; only `compile-check.server.test.ts` (green) and the `tsc` leg were
  measured. A hidden src-leg failure is not excluded.
- **Item 246's own printed reason.** Its assertion prints `undefined undefined` (no envelope), so I
  attribute it to the A2-F2 mechanism via the shared fresh-emit probe, not via its own output.
- **H2 at bundle level** (§3a) — needs `npm run build`.
- **Item 585's underlying typing.** In the scripts program the object literal infers as
  `{ RT_TYPECHECK_NESTED: string }` (the `process.env` spread contributes nothing under
  `tsconfig.scripts.json`); I did not chase whether that is a `@types/node` resolution nuance.
- **Per-item Wave-1 owner names.** I name the file to change, not a lane/person.

---

## 6. The single highest-risk item

**The A2-F2 "not implemented" oracle row — `src/lib/scaffold.ts:6374`** (the row emitted where HEAD
emitted `test.skip`, `git show HEAD:src/lib/scaffold.ts:3687-3692`/`:3700`).

It is the root of 204, 216, 217 and 246, and it is worse than every other item because it does not
degrade one guard — it makes the delivery path **impossible for every emission of every kind**. A fresh
keyless `emit` carries a real `test("orc-phase") { … assert.fail(…) }`, so the emitted product fails its
**own** `npm run test` by construction; `treeRun.ok` can therefore never be `true`, `emit --run` exits 1,
`--git` withholds (`reason:"tree-run-red"`), and `factory-watch` delivery never commits (proven live on
`testruns/office-scheduler/build.json` and on a fresh `create`+`emit` probe). The failure mode is
self-concealing: the headline delivery metric "0 empty-substance commits · 0 red-tree commits" becomes
trivially true when *nothing* can commit. By contrast the C-06 defeat (218/345/407/415, the second
highest) is at least masked in production by the red-tree circuit breaker — my own probe on the hollow
fixture was still withheld, only as `RT_E_TREE_RUN_FAILED` instead of `RT_E_SUBSTANCE_EMPTY`.

The fix is a design decision Wave 1 must make explicitly: keep the honest "not implemented" marking
(declare-or-strike) **without** reddening the emitted tree's own suite — e.g. emit the marked skip again
and surface the unwired-row census through the substance/trap metadata plus a coded row, or make the
tree-run's green bar key on the assertable rows while `substance`/`oracleStubTrap` still name the gaps —
and, in the same change, re-point the C-06 withhold (CLI `:3008`/`:3026`) and the `substance` driver
(`replay-harness.mjs:1196`) at a census that a scaffold can actually produce.
