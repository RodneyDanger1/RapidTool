# 345 · LOOKER 2 (L2) — fix validation + extended miss-hunt

**Role:** LOOKER 2 (continuation of V1). **Root:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD:** `06cb089` (clean).
**Mode:** READ-ONLY. **0 keyed calls.** No source/test/config/doc edits; only write is this file.
**Scratch:** `%TEMP%\rt345_l2\rt` (byte copy of `src/` + `scripts/` with a `node_modules` junction). The real tree was never mutated.
**Baseline:** `node22 --experimental-strip-types --test src/lib/{verify.server,node-runner.server,brief-fixtures,maker-score,scaffold}.test.ts` → **296 tests / 296 pass / 0 fail**.

The two fixes are **A2-F1** (verifier verdict forgery) and **A1-01** (placeholder acceptance oracle). Verdicts below are from independent adversarial reproduction, not from the wave's own tests.

---

## 1. Fix-validation table

| Fix | Verdict | Evidence (command → output) |
|---|---|---|
| **A2-F1** verifier verdict forgery | **CONFIRMED-FIXED** (core); see §3 for two low residuals | Scratch probes against the real `runCases`: **(1)** old repro `setTimeout(…'HARNESS_EXPORTS'/'HARNESS_COMPILE pass'); throw` → `{"pass":false,"compileError":"source failed to compile in the harness"}`. **(2)** `process.getBuiltinModule('fs')` + write lookalikes to fd 3 (no nonce) while the case genuinely **fails** → `{"pass":false,"results":[{"id":"c1","pass":false}]}` (G1, `probe-forgery4.ts`). **(3)** hook `fs.writeSync` to harvest any nonce, then forge `ORACLE_RESULT c1 pass` for a failing case → forged line dropped, real fail stands (G1). **(4)** nonce secrecy (`probe-nonce.ts`): `FIRST_READ="<32-hex>"`, `SECOND_READ=""`, `EXECARGV_CONTAINS_NONCE=false`, `ENV_CONTAINS_NONCE=[]`, `PROCESS_BINDING_FS_WRITESYNC=false`, `MAINMODULE_REQUIRE=false` — after the harness consumes stdin the module cannot re-read it, and the nonce is in neither argv nor env. **(5)** fd-3 filter (`probe-fd3-filter.ts`): a custom program writing one authenticated line + one unauthenticated line + a guessed-nonce line → `run.verdict = "HARNESS_EXPORTS add\nORACLE_RESULT c1 pass true"` (only authenticated lines survive). **(6)** control: genuine green module → `{"pass":true}`; genuine syntax error → `{"pass":false,"compileError":"source failed to compile…"}`; a green module logging `HARNESS_*` lookalikes to **stdout** still passes (327 L5 preserved). |
| **A1-01** placeholder acceptance oracle | **PARTIALLY FIXED** — the emit/score paths are fixed (I could not reach a green M1/M2 or a passable emit with a sentinel), **but a sibling surface is left inconsistent** (§2, L2-X1). | `probe-placeholder.ts`: drafted sentinels are flagged (`draftTypedLiterals` → 2/2 placeholder); `fixtureApprovalGate([placeholder]).ok === false` with `placeholderIds:["c1"]`; `approvedAcceptanceFixtures([placeholder]) === null` and mixed-set `=== null`; re-approved (`approveFixtureCases` → approved) and legacy-persisted sets still `=== null`; `compileFixtureAssertion(placeholder).ok === false`; `fixtureMatchHelperSource()` contains no `return true`; `m1Substance` / `m2Runs` on a placeholder bar both `score:0` with the placeholder sentence, while the **real** typed-literal bar (control) still scores `1`/`1` — no weakening. |

### Against the explicit attack list
- **fd-3 without the nonce** → dropped (`probe-fd3-filter.ts`, wave test (e), G1). ✅
- **hook `fs.writeSync` / `process.stdout` / `Function` / `Object.keys` before capture** → the harness captures `__write`, `__Function`, `__keys` at IIFE entry, before the module body; a module hook installed in its own body cannot intercept the harness's writes (`probe-forgery2.ts` #3, wave (e2), G1). ✅ (Note: two *semantically-equivalent* mutations here survive — see §1 note.)
- **read the nonce (stdin / `execArgv` / `/proc` / env)** → all empty/false (`probe-nonce.ts`). ✅
- **call `process.exit` after printing** → refused (`NO_CALLABLE_EXPORTS_REASON`; wave #5 + my probe #5). ✅
- **pass a genuine case but forge another's id** → stdout forgery sets `forged`; unauthenticated fd-3 lines are dropped; the real failing case decides (`probe-forgery.ts` A, G1). ✅
- **a legitimately green module still passes / a genuine compile failure still refuses** → both hold (`probe-forgery.ts` 6/7, `probe-forgery4.ts` G4). ✅
- **placeholder sentinel via real-substring / mixed / re-approved / legacy / CLI** → real-substring not false-flagged (`<draft> note` → false), nested sentinel flagged, mixed/re-approved/legacy all refused by `approvedAcceptanceFixtures` (probe P3/P5/P8/P11). ✅ for M1/M2/emit — but see L2-X1.

**Note (avoid a false report):** two mutations of the fix survived but are **semantically equivalent**, so they are *not* defects: (a) `const channel = run.verdict ?? ""` → `?? out` is dead because `run.verdict` is always a string (never nullish) on the channel path; (b) replacing the capture-bound `__write = __fs.writeSync.bind(__fs)` with a call-time lookup still cannot be exploited, because the module's forged lines are always emitted *after* the harness's real lines (its only async window is after the synchronous case loop), so a forged expected id is always a duplicate → `forged`. I checked both rather than reporting them.

---

## 2. New missed findings

Reproduced at HEAD; none are in the wave's task list.

| id | class | file:line | sev | Reproduction |
|---|---|---|---|---|
| **L2-X1** | Fix incomplete / cross-surface inconsistency (claim-vs-byte) | `doctor.ts:365-379` (`humanFixturesFromProject`), `:391-399` (`evidenceFromProjectRecord`), `:430` (`evidenceFromJobInventory`); doc claim at `doctor.ts:356` | **Med** | A **placeholder-only** bar is refused by the gate/emit/scorer but still **satisfies the doctor's factory human-fixture term**. `probe-doctor-factory.ts` on a genuinely complete 2-job tree + `acceptanceFixtures:[{…, expect:{kind:"shape",value:{id:"<draft>"}}, approval:"approved", decidedBy:"human"}]` → `humanFixturesFromProject: true`, `evidence.humanFixtures: true`, `evidence.productComplete: true`, `factory.autonomousSoftwareFactory: true`, `factory.gaps: []`. For the **same** bar the scorer returns `m1Substance → score:0` ("approved acceptance bar is placeholder-only…"). `doctor.ts:356` claims the bar "is the acceptance gate's own (`fixtureApprovalGate`)" — the bytes never call `fixtureApprovalGate` and apply neither its placeholder rule nor `validateFixtureCase` (e.g. a row with no `given`/`expect` is accepted). So the strongest product claim can be minted on a sentinel bar while the scorer says the bar is empty. **Fix direction:** route `humanFixturesFromProject` through `fixtureApprovalGate`/`fixturesHavePlaceholder` (or `approvedAcceptanceFixtures`). |
| **L2-X2** | Test-teeth gap in the **new** fix | `node-runner.server.ts:304-311` (`authenticatedVerdict`, `if (!nonce) return "";`) | Low | Mutation `if (!nonce) return "";` → `if (!nonce) return raw;` (fail-open on a missing nonce) **survives `node-runner.server.test.ts` 16/16**. The fail-closed branch has no test. Not reachable in normal operation (the parent always writes a fresh nonce), but it is the guard that keeps a broken stdin delivery from admitting unauthenticated fd-3 lines. |
| **L2-X3** | Upstream gap / unwired gate surface | `scripts/rapidtool-cli.mjs:2247-2249` (draft), `:2283-2370` (approve); `brief-fixtures.ts:569` (`fixtureApprovalGate` — no production consumer) | Low-Med | The CLI `fixtures --draft` path feeds `draftTypedLiterals` output straight into `draftBriefFixtures`, so **every** drafted case is a sentinel: `probe-cli-and-m1.ts` → `CLI-draft cases: 3 | placeholders: 3 | redCards: 0`. `fixtures --approve` never consults `fixtureApprovalGate` and never reports the new `placeholderIds`; an operator sees `ok:true` for draft+approve and the emit silently drops the fixture section, so the delivered product has no acceptance fixtures with no signal. (The verdict is honest — emit is not vacuous — but the CLI gives no warning, and the new gate field is dead surface.) |
| **L2-X4** | Mis-classified failure (new) | `verify.server.ts:990-1035` (parse), `node-runner.server.ts:304-311` | Low | A verdict-channel delivery/read failure yields an empty channel, which flows to `callables=""` → `NO_CALLABLE_EXPORTS_REASON` ("module exports no callable names — machine verification is vacuous"). The real cause (channel/fd-3 failure) is masked as a module defect. Fail-closed (safe) but mislabeled — the same class AGENTS.md contract #4 warns about. |
| **L2-X5** | Residual sentinel not covered by the placeholder rule | `brief-fixtures.ts:153-155,669-690`; `draftTypedLiterals` constraint arm | Low | `fixtureCaseIsPlaceholder({expect:{kind:"throws",messagePattern:"invalid"}})` → **false** (`probe-placeholder.ts` P6). The drafter mints `messagePattern:"invalid"` for every constraint row; it is a reserved draft value that asserts only "a throw whose message contains 'invalid'", yet it is not in `BRIEF_FIXTURE_PLACEHOLDERS`, so such a row is approvable and compiles. Weaker than the old always-true shape branch (it does require a throw), hence Low, but it is the same "drafted, not derived" class. |
| **L2-X6** | No-placeholder exemption for a legitimate `"<any>"` wildcard | `brief-fixtures.ts:690-692`, `:758-764` | Info (deliberate) | Any pre-existing approved set that used `"<any>"` as the matcher's wildcard now fails `approvedAcceptanceFixtures`/`fixtureApprovalGate` and scores M1/M2=0, and the emit silently omits the fixture section. No in-repo real set uses it (only comments/tests), so impact is legacy/external only; the change is the correct security posture but is a silent behavioral break for such sets. |

### Re-confirmed from the prior hunt (still open at `06cb089`)
All reproduce unchanged (the wave touched `node-runner.server.ts`/`maker-score.ts` but not these branches/guards):

| id | file:line | Reproduction |
|---|---|---|
| **M1** unvalidated `savedAt` + untested read guard | `checkpoint.server.ts:163` (guard), `:408` (`checkpointAdmits` returns it unvalidated) | `probe-cli-and-m1.ts`: `checkpointAdmits` with no `savedAt` → `{"ok":true}`; `"x"` → `{"ok":true,"savedAt":"x"}`; `NaN` → `{"ok":true,"savedAt":null}`. Mutation `typeof candidate.savedAt …` → `void candidate.savedAt;` survives `checkpoint.server.test.ts` **27/27**. |
| **M2** `runGate` unregistered-phase guard untested | `dod.ts:866` | Mutation `if (!items) {` → `if (false) {` survives `dod.test.ts` **9/9** and `gates.test.ts` **88/88**. |
| **M3** runner finite-timeout guard untested | `node-runner.server.ts:353` | Mutation dropping `Number.isFinite(requestedMs)` survives `node-runner.server.test.ts` **16/16** (test count grew with the new channel tests; still unpinned). |
| **M4** `criteriaMeanExcluding` empty-set guard untested | `maker-score.ts:924` | Mutation `if (ids.length === 0) return 0;` → `if (false) return 0;` survives `maker-score.test.ts` **101/101**. |
| **M5** mock env selector has no production consumer | `llm/providers/mock.ts:52,167,181` | `rg` → `mockSelected`/`selectMockProvider`/`MOCK_SELECT_ENV` appear only in `mock.ts` + `mock.test.ts`; no production caller. (Test-only, so a declared-but-dead env switch, not a reachable mock.) |

**Checked and refuted (not reported as gaps):** the output-bomb guard (`node-runner.server.ts`, `receivedBytes > MAX_BUFFER`) mutation survives `node-runner.server.test.ts` but is caught by `exec.test.ts` (1 fail) — real teeth, no finding. Also re-killed: `doctor.humanFixturesFromProject` rows guard, `io.ts` too-large guard, `compile-check` `specsGreen`, `synthesis-policy` finite guard, and the three placeholder-fix guards (each mutation produced ≥1 fail).

---

## 3. Downside assessment of the two fixes

**A2-F1 (forgery channel) — no real gate weakened; two new low-risk modes.**
- **Intent preserved / strengthened:** the old "no-callables" and "compile-fail" refusals now cannot be bypassed; stdout lookalikes for `HARNESS_*` no longer cause a false refusal (327 L5 pin still green); the `verdict` field is additive and the legacy `runNodeBounded` envelope (no `verdictChannel`) is byte-identical (pinned). Green still passes, compile failure still refuses, `process.exit` fails closed.
- **New failure mode 1 (L2-X4):** a channel delivery failure is fail-closed but **mislabeled** as `NO_CALLABLE_EXPORTS_REASON`.
- **New failure mode 2:** verification now depends on extra OS handles (stdin pipe + fd 3). If fd 3 cannot be opened on some host, **every** verify refuses (fail-closed total outage). Verified working on this Windows/Node-22 host; no cross-platform exercise was possible here.
- **Behavior change:** a module that prints a line beginning `ORACLE_RESULT ` to stdout is refused as impersonation even when otherwise green. This matches the pre-fix outcome class (a stdout ORACLE_RESULT was already suspicious), so it is not a new regression — noted for completeness.
- **No pin weakened:** the two surviving mutations I found are semantically equivalent (documented in §1), and the auth-filter "accepts all" and missing-nonce mutations' *non-equivalent* form was killed by the auth-filter test.

**A1-01 (placeholder oracle) — the real path is unweakened, but the fix is incomplete.**
- **No weakening:** the real typed-literal bar still scores M1/M2 = 1 and still folds into `oracle.spec.ts`; provenance/approval semantics untouched; no legitimate consumer relied on the removed always-true branch (grep shows the matcher was the only user; test fixtures that used the sentinel were updated to real literals, not deleted).
- **Downside 1 (L2-X1, Med):** the fix created a **cross-surface inconsistency** — the doctor's `humanFixtures`/`autonomousSoftwareFactory` still accept a placeholder bar that the gate/emit/scorer now reject. This is the "two stories about one run" class the wave set out to remove (the wave's own 338-4 work pinned M1/M2 to the doctor's sentinel-agnostic bar; this fix moved M1/M2 without moving the doctor).
- **Downside 2 (L2-X6, Info):** legitimate `"<any>"` wildcard sets silently stop emitting/scoring (deliberate, low reachability).
- **Downside 3 (L2-X5, Low):** the `throws` draft sentinel `"invalid"` is not covered, so a constraint-only drafted bar remains approvable and compiles (weak, not vacuous-true).

---

## 4. What I could not determine
- **Cross-platform behaviour of the fd-3/nonce channel** (Linux/macOS): the wave's tests `skip` when no runner is available, and this host is Windows. The channel works here; a platform where `fs.writeSync(3, …)` or sync stdin read fails would (correctly) fail closed but produce L2-X4's mislabeled refusal for every run.
- **The full end-to-end keyed `verifyAndFixServer` → `applyVerifyOutcome` mint** was exercised by the wave's own mocked-key test (I read it and confirmed the logic), but I did not make a keyed call (0-keyed-calls rule). My forgery verdict rests on `runCases` (the verdict-producing function) plus the byte-verified mint gate in `verify.ts:186-221,299-306`.
- **A real-world project whose persisted `acceptanceFixtures` uses `"<any>"`** (L2-X6) — none exists in-repo; impact is inferred for external/legacy records only.
- **Whether the CLI's `--draft`-always-placeholder path is intended** (L2-X3): the CLI test `scripts/rapidtool-cli-fixtures.test.mjs:171` pins the sentinel, so it may be accepted design; I report the UX/signal gap, not a verdict on intent.
- The full gate / `npm test` was deliberately not run (concurrent agents); only targeted suites and scratch probes.

**Net:** both fixes do what they claim on their primary threat — the verifier forgery is genuinely closed (independently reproduced-against), and no sentinel reaches a green M1/M2 or a passable emit. A1-01 is **partial**, because the doctor's factory bar still mints `autonomousSoftwareFactory: true` on a placeholder bar (L2-X1), and the new channel leaves one unpinned fail-closed branch (L2-X2).

---

# 345 · FIXER pass (same agent) — L2-X1 + A1-07 + A1-08 STOP

**Mode:** FIXER, strict ownership (`src/lib/doctor.ts`, `src/lib/doctor.test.ts`, `src/lib/io.ts`, `src/lib/errors.ts`, and their pinning tests). **0 keyed calls. No tracked-file deletion. No full gate.** Scratch `%TEMP%\rt345_l2\`.
**Note:** the working tree carries concurrent lanes' in-flight edits (`store.ts`, `console.tsx`, `dod.ts`, …). My four source files + their tests were clean at HEAD when I started, and I edited nothing outside ownership.

## F1 — L2-X1: the doctor now honours the placeholder rule

**Change:** `doctor.ts:52` imports the shared predicate `fixturesHavePlaceholder` (`brief-fixtures.ts`, zero-dep); `humanFixturesFromProject` (`doctor.ts:386`) returns `false` when any approved row is a draft sentinel; the doc block at `doctor.ts:350-366` no longer claims "the bar is the acceptance gate's own (`fixtureApprovalGate`)" — it now states the exact rules the bytes apply (every row approved · ≥1 `decidedBy:"human"` · no placeholder, via the same predicate maker-score reads).

**RED (before, both runtimes)** — `node --experimental-strip-types --test src/lib/{errors,io,doctor}.test.ts`:
```
not ok 6 - 345 L2-X1: a placeholder-only approved set does NOT close the fixtures gap
not ok 7 - 345 L2-X1: the doctor latch and maker-score agree on a placeholder bar (same project)
not ok 8 - 345 L2 (A1-07): RT_E_IMPORT_TOO_LARGE is registered with an honest doc
not ok 4 - 345 L2 (A1-07): the oversized-payload refusal carries RT_E_IMPORT_TOO_LARGE
# tests 155  # pass 151  # fail 4      (Node 22.23.2 AND host Node 24.15.0, exit 1)
```
**GREEN (after, both runtimes):** `# tests 155  # pass 155  # fail 0`.

### Doctor-vs-scorer agreement proof (same project)
Scratch probe on the fixed bytes (a genuinely product-complete 2-real-job tree + a **placeholder-only** approved bar):
```
doctor humanFixturesFromProject(placeholder bar): false      (was true)
evidenceFromProjectRecord.humanFixtures: false
fixtureApprovalGate.ok: false  placeholderIds: ["orc-1"]
approvedAcceptanceFixtures: null
maker M1 on same bar: {"score":0, "evidence":"… placeholder-only (<draft>/<any> sentinel literals assert nothing real) …"}
```
and the factory consequence, before → after on the same input:
```
factory.autonomousSoftwareFactory: true  → false
factory.gaps: []                          → ['no human-approved fixtures (decidedBy:"human")']
```
The pinning test `345 L2-X1: the doctor latch and maker-score agree on a placeholder bar` asserts BOTH surfaces in one case (`evidenceFromJobInventory(...).humanFixtures === false`, `factoryClaim(...).autonomousSoftwareFactory === false`, `gaps` includes `FACTORY_GAP.fixtures`, and `m1Substance(...).score === 0`). The existing "real census + arch-complete + human fixtures → latch fires" test still passes: its `fixture()` helper carries no `given`/`expect`, so it is not a sentinel (no weakening of the real path).

## F2 — A1-07: `io.ts` too-large arm now carries `RT_E_IMPORT_TOO_LARGE`

**Change:** `errors.ts:117` appends `RT_E_IMPORT_TOO_LARGE` to `ERROR_CODES`; `errors.ts:593` adds the `ERROR_CODE_DOC` entry; `io.ts:486` returns `code: "RT_E_IMPORT_TOO_LARGE"` on the too-large arm (message unchanged, so every `/too large/i` pin holds); the `io.ts:38-43` A1-25 TODO comment is updated to "closed by 345 L2".

**RED:** `not ok 8 - 345 L2 (A1-07): RT_E_IMPORT_TOO_LARGE is registered with an honest doc`; `not ok 4 - … the oversized-payload refusal carries RT_E_IMPORT_TOO_LARGE` (code was `undefined`).
**GREEN:** both pass, both runtimes.

### Registry completeness check
`errors.test.ts` (the registry's own rules) — all sub-tests pass with the new code present:
```
ok 1 - has a doc entry for every code
ok 2 - has exactly the code set as keys (no orphans)
ok 3 - every entry carries a non-empty one-line meaning and agentAction
ok 4 - error codes are RT_E_* prefixed and unique
ok 8 - 345 L2 (A1-07): RT_E_IMPORT_TOO_LARGE is registered with an honest doc
```
The new code satisfies every rule: `^RT_E_[A-Z_]+$`, unique, one-line meaning/agentAction (no embedded newlines), and the doc's `agentAction` names the real escape hatch `maxChars` (the new pin asserts that too). `scripts/cli-exit-taxonomy.test.mjs` (which requires every CLI `RT_E_*` literal to be a registered `ERROR_CODE_DOC` key) → **43/43 pass** on host Node 24.

**STOP-and-REPORT (out of ownership): `scripts/README-cli.md` §"Error codes (RT_E_*)"** mirrors `ERROR_CODE_DOC` ("this table mirrors it — the full registry, one row per code"). It has no row for `RT_E_IMPORT_TOO_LARGE`, so the mirror is now one row stale. No test enforces the table's completeness (cli-exit-taxonomy only checks CLI literals → registry, not registry → README), so this is a doc-drift owed to whoever owns `scripts/README-cli.md` — I did not edit it.

## F3 — A1-08: STOP-and-REPORT (file outside ownership)

`src/lib/token-ledger.ts:575-579` (`recordBudgetSpend`) throws a bare `Error` whose `(RT_E_VALIDATION)` is prose only:
```ts
// src/lib/token-ledger.ts:575-579 (current)
if (!budget || typeof budget !== "object" || !budget.ledger || typeof budget.ledger !== "object") {
  throw new Error(
    "recordBudgetSpend: budget must be a TokenBudget with a ledger object (RT_E_VALIDATION)",
  );
}
```
`classifyError(err, fallback)` reads `err.code`; an `Error` with no code returns the caller's fallback (probe: `classifyError(err, "RT_E_INTERNAL") → "RT_E_INTERNAL"`), never the named `RT_E_VALIDATION`. **Exact owed 3-line shape** (owner: `token-ledger.ts`):
```ts
const err = new Error(
  "recordBudgetSpend: budget must be a TokenBudget with a ledger object (RT_E_VALIDATION)",
) as Error & { code?: string };
err.code = "RT_E_VALIDATION";
throw err;
```
Not edited — `token-ledger.ts` is outside my ownership.

## Downside assessment of this pass
- **No gate weakened.** The doctor's fixtures conjunct is *stricter* (a placeholder bar no longer clears it); the real typed-literal path is byte-unchanged (existing latch test green); `io` gained a code without changing its message or accept/refuse behaviour; `errors` is additive-only (consumers match literals, never positions) — `cli-exit-taxonomy` 43/43 confirms no consumer broke.
- **New import is client-safe:** `brief-fixtures.ts` is zero-runtime-dep (only `import type { OracleTest }`), so `doctor.ts` (client bundle) gains no `node:` surface and there is no cycle (`brief-fixtures` does not import `doctor`).
- **Scope honesty:** `humanFixturesFromProject` still accepts a row lacking `given`/`expect` (the pre-existing `doctor.test.ts` `fixture()` shape); `approvedAcceptanceFixtures` would drop such a row via `coerceAcceptanceFixtures`. That older laxness is a separate, pre-existing disagreement I deliberately did **not** touch (the mandate was the placeholder rule) — recorded here for the next wave.

## Regression counts (both runtimes)
| Suite set | Node 22.23.2 | Node 24.15.0 |
|---|---|---|
| Owned suites: `errors` + `io` + `doctor` | **155 / 155 pass / 0 fail** | **155 / 155 pass / 0 fail** |
| + consumers: `maker-score` + `brief-fixtures` + `fixtures` | **306 / 306 pass / 0 fail** | **306 / 306 pass / 0 fail** |
| `headless.test.ts` (unmodified consumer of `factoryClaim`/`importProject`) | **163 / 163 pass / 0 fail** | — (not re-run) |
| `scripts/cli-exit-taxonomy.test.mjs` (registry/CLI-literal guard) | — | **43 / 43 pass / 0 fail** |

**Concurrent-lane failure, exonerated:** `src/lib/store.test.ts` (dirty, another lane) shows `L3-01: the run screen renders a skeleton…` red. That test only `readFileSync`es `src/components/console.tsx` and regex-matches its JSX (dirty, another lane); none of my four files is read. Proof: with the documented override `RT345_CONSOLE_TX` pointed at **HEAD's** `console.tsx`, `store.test.ts` goes from 1 → **3** red (L3-01/L3-08/A3-14), i.e. the failure is a function of `console.tsx` content alone — an in-flight lane, not my change.

## What I could not determine
- **Typecheck / lint** were not run: the tree is mid-edit by concurrent lanes (`store.ts`, `dod.ts`, `console.tsx`, …), so a project-wide `tsc`/`eslint` would report their in-flight state, not mine. My edits are type-simple (a string literal added to the `ErrorCode` union + `ERROR_CODE_DOC`; a `code?` field on an existing arm; a value import of an exported zero-dep predicate).
- **README-cli.md error-table row** (F2 STOP) is owed but unowned here.
- **token-ledger.ts** A1-08 fix (F3 STOP) is owed but unowned here.
