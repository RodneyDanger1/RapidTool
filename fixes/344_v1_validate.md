# 344 · validator V1 — independent validation of A1 (core) & A2 (model/verification)

**Validator:** V1 · **Root:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD:** `4bd1988` (clean)
**Inputs:** `fixes/344_a1_core.md` (A1, 18 241 B) and `fixes/344_a2_model.md` (A2, 17 899 B), both landed
11:11–11:12. **Mode:** read-only. **0 keyed calls.** No source/test/config/doc edits by me; scratch only.
**Scratch:** `%TEMP%\rt344_v1\rt` (a byte-identical `src/` + `scripts/` copy with a `node_modules` junction)
used for mutation probes; **the real tree was never mutated.**

Baseline I established before validating: the A1+A2 colocated suites are green at HEAD —
`node22 --experimental-strip-types --test src/lib/{doctor,dod,checkpoint.server,cassette,mcp.server,node-runner.server,verify.server}.test.ts`
→ **259 tests / 259 pass / 0 fail** (Node 22.23.2). Host Node 24 agrees on the smaller suites I ran.

---

## 1. Validation table

Verdicts are mine, derived from an independent probe or a byte-read — never from the auditor's text.

| Finding | Auditor | My verdict | My evidence (command → output) | Correction |
|---|---|---|---|---|
| **A2-F1** verifier verdict forgery | A2 | **CONFIRMED (Critical)** | Scratch probe `probe-f1.ts` calls the real `runCases` with the hostile module from the finding and case `typeof exports === 'object'` → `RESULT {"pass":true,"results":[{"id":"c1","pass":true,"detail":"true"}]}`. The module body `throw`s on load and exports nothing; the `setTimeout(…'HARNESS_EXPORTS exports' / 'HARNESS_COMPILE pass')` lines land **after** the harness's real `HARNESS_COMPILE fail` and win the last-wins parse (`verify.server.ts:968-989`). Downstream mint byte-verified: `verify.ts:186-221,299-306` mints `lastTest{label:"tested",evidenceHash}` on `status:"passed"` given a runnable case + `finalSource`, both present here. | None on the core; severity **and** mechanism both stand. See work-plan critique (§3) — the report's "minimum viable" fix would **not** close it. |
| **A2-F2** failover unarmed | A2 | **CONFIRMED**, severity inflated | `rg probeProviderModels\|applyProbedModels` → only `registry.ts` comments + `registry.test.ts`; no production registration seam. `registry.ts:740-763` returns `RT_E_VALIDATION` with the derived `failoverArmingGap` whenever `RAPIDTOOL_FALLBACK_PROVIDERS` names a chain. | Real single-provider limitation, but it **fails loudly and is explicitly declared unarmed**. "High" overstates a documented, coded refusal — this is **Medium** (resilience gap, not a correctness lie). |
| **A2-F3** repo map missing on single-module lane | A2 | **CONFIRMED** | `rg -n withRepoMapContext src/lib/codegen.server.ts` → exactly two hits: `:1233` (definition) and `:4894` (chunk lane). `codegen.server.ts:4403-4410` builds the single-module `user` prompt with no map wrapper. | None. |
| **A2-F4** retry-set asymmetry | A2 | **CONFIRMED (byte)**, severity inflated | `deepseek.ts:103` `new Set([429,500,503])`; `openai-compatible.ts:274` `new Set([429,500,502,503,504])`. | A deliberate, documented per-provider policy (A2 itself cites DeepSeek §6). Not a bug — **Info**, not Low-Med. |
| **A2-F5** 327-L2 crash class on 3 paths | A2 | **PARTIAL** | Bytes confirmed: `tavily.server.ts:84` `await fetch(url, init)`; `harvest.ts:373,388` `await fetch(...)` (the default legs); `probe.ts:175` `opts.fetch ?? ((...a)=>fetch(...a))`. The migrated seams do use `oneShotFetch` (`deepseek.ts:256`, `openai-compatible.ts:491`). | The *usage* fact is true and the risk is plausible, but the crash claim was **not reproduced** (needs a keyed/network CLI run) and the auditor labels it unverified. Treat as an unverified risk (Low), not a confirmed defect. |
| **A2-F6** redaction coverage gap | A2 | **CONFIRMED** | `probe-f6-f10.ts`: `redactSecrets("xai-"+A×48)` → unchanged; `tvly-` unchanged; `sk-or-` → `[secret-hidden]`. | None. |
| **A2-F7** non-injective delimiters | A2 | **CONFIRMED** | `knowledge.ts:331-345` `fingerprint` joins fields with `\u0000`; `failureSignature` at `:930-931` joins with `|`/`,`. Unescaped. | None (theoretical; low). |
| **A2-F10** `selectBestOfN(NaN)` = 0 samples | A2 | **CONFIRMED** | `probe-f6-f10.ts`: `selectBestOfN(NaN,…)` → `{"winner":null,"chosen":null,"outcomes":[]}`, `produced: 0`. | None; unreachable in production (codegen passes the sanitized resolver). Info. |
| **A1-01** placeholder acceptance oracle | A1 | **CONFIRMED (High)** | `brief-fixtures.ts:163,173` mints `expect:{kind:"shape",value:{id:"<draft>"}}`; `:693` `if (expected === "<any>" \|\| expected === "<draft>") return true;`; `:553-560` `fixtureApprovalGate` checks **only** `approval`, not sentinel content → a drafted-then-approved placeholder set passes. | None. Genuinely degrades the "machine-verified" claim. |
| **A1-02** factory flag needs a human | A1 | **CONFIRMED (byte)**, severity overstated | `doctor.ts:520-523` `autonomousSoftwareFactory = … && human === true …`; `:489` derives `human` from `humanFixturesFromProject`; `:365-379` requires an `approval:"approved"` row with `decidedBy:"human"`; `policy.ts:155-162` makes `fixtures.approve` `requiresHumanSeat`. | The *code fact* is true, but this is a **deliberate, honestly-surfaced ceiling** (`awaitingHumanAcceptance`, `doctor.ts:531-538`). It is a **claim/documentation** issue (Low-Med), not a High code defect. |
| **A1-03** `verifyPriorPhases` unwired | A1 | **CONFIRMED** | `rg verifyPriorPhases src scripts` → only `engine.ts:3620` (definition) + two `knowledge.ts` comments. No `regression.drift` emitter. | None. |
| **A1-04** `oracleToCaseSeeds`/`missingOracleCaseIds` unwired | A1 | **PARTIAL** | Fact confirmed: `rg oracleToCaseSeeds\|missingOracleCaseIds` → call sites only in `*.test.ts` + comments in `dod.ts`/`verify.server.ts`. **But** the E-08 enforcement *is* implemented on the verify side: `verify.server.ts:1372` `droppedPinnedOracleIds`, called at `:1482`/`:1508` inside `generateCases`, which refuses a dropped pinned id. Production is dormant only because **no caller passes `pinnedOracleIds`** (`rg pinnedOracleIds src scripts` → only verify.server + its test; `headless.ts:4288` and `codegen.server.ts:3634` pass none). | The "unwired exports" fact is right; the implied "E-08 capability does not exist at runtime" is **overstated** — a wired mirror exists and is only un-fed. Downgrade the consequence. |
| **A1-05** four mutation-invisible guards | A1 | **CONFIRMED** | Scratch mutations (real→`if(false)`): `engine.ts:5137` pause guard, `engine.ts:5220` `!priorsSealed`, `engine.ts:1813` `approveHitl` forceHuman throw, `store.ts:542` `canAutopilot` forceHuman — each left its suite green: `wild-step.test.ts` 35/35 (×2), `engine.test.ts` 20/20, `store.test.ts` 94/94. | None. |
| **A1-06** console wild executes with no plan review | A1 | **CONFIRMED (code-level)** | `store.ts:1357` calls `stageWildPlan(cur, reviewer)`; `engine.ts:4446-4452` returns `staged:false` unless `plan.source === "planner"`; the browser has no planner, so `project.wildPlan` is absent and `readWildPlan` returns the empty shell (`engine.ts:3938-3949`). No other plan guard exists on the path (`rg "plan_review"` shows only `stageWildPlan`). | Confirmed at the store/engine seam. I did **not** verify whether the console UI offers a gated button only when a plan exists; the byte-level gap is real but UI reachability is asserted, not measured. |
| **A1-07** uncoded too-large import | A1 | **CONFIRMED** | `io.ts:486-488` returns `{ok:false,error:"Import payload too large …"}` with no `code`; the module's own TODO (`io.ts:39-46`) names the missing `RT_E_IMPORT_TOO_LARGE`. | None (Low). |
| **A1-08** uncoded throw in `recordBudgetSpend` | A1 | **CONFIRMED**, one correction | Probe: `recordBudgetSpend(null,null)` throws `Error` whose text contains `(RT_E_VALIDATION)` but `"code" in err === false`; `classifyError(err,"RT_E_INTERNAL")` → `"RT_E_INTERNAL"`. | The auditor wrote the mapping is to `RT_E_UNKNOWN`; in fact it returns the **caller-supplied fallback** (here `RT_E_INTERNAL`). The defect (named code is prose only) stands; the stated consequence is slightly wrong. |
| **A1-10** `evidenceHash` is a verdict vector | A1 | **CONFIRMED**, but it is a documented limit, not drift | Probe: two projects with wholly different `generatedSource`/`generatedTree` but identical P0 verdicts → both `evidenceHash 1542080820` (`same hash despite different content? true`). `dod.ts:850-857` **already states** exactly this ("cannot attest artifact content … two distinct projects … share a hash"). | Real, but **explicitly documented** (322 X3/OBS-6). Calling it DRIFT/mis-framing; it is a scoped limitation → **Info**, not Low. |
| **A1-12** console approve mints `decidedBy:"human"` | A1 | **CONFIRMED (Info)** | `store.ts:1887-1889` hardcodes `decidedBy:"human"`; no `[seat …]` tag is written (`engine.ts:1846` copies `note` verbatim), and `dod.ts:156` `if (claim.kind === "untagged") return true;` accepts it. CLI/headless go through `evaluatePolicy`. | None; the report's Info severity is right. |
| **A1-13 / A2-F8 / A2-F9** | A1/A2 | **CONFIRMED (spot-check)** | `wild-review.ts` TODO present; `mcp.server.ts:478-486` gates only on the server's self-declared `annotations.readOnlyHint === true`; `RT_E_NOT_IMPLEMENTED` has no emitter (`rg` → only `errors.ts` + the README line that admits it); `crewToReport` (`crew.server.ts:1469`) has no consumer. | None. |

### False positives / overreach / mis-severity (honest flag)
- **A1-02 (High → Low-Med):** inflated. The latch is deliberate and the honest `awaitingHumanAcceptance` already names it. The defect is the *claim*, which the auditor admits.
- **A1-10 (DRIFT → Info/documented):** the module documents the exact limitation the finding "discovers". Listing it as a defect overstates it.
- **A1-04 (Med → Low/partial):** the runtime consequence is overstated; a wired enforce path exists and is only un-fed.
- **A2-F2 (High → Medium):** a loud, documented, coded refusal is not a High defect.
- **A2-F4 (Low-Med → Info):** a deliberate documented per-provider retry policy, not a bug.
- **A2-F5:** honestly hedged ("not reproduced"), but the framing still lists it among findings; keep it as an unverified risk.
- **No fabricated finding found.** Every one of the auditors' top findings that I re-derived is a real observation; the problems are severity/consequence inflation, not invention.

---

## 2. Missed findings (mine)

All confirmed with the real bytes or a scratch mutation; none appear in either log.

| id | class | file:line | sev | evidence |
|---|---|---|---|---|
| **M1** | Boundary defect **+** test-teeth gap | `checkpoint.server.ts:163` (`isRunCheckpoint` `savedAt` finite guard) and `:407` (`checkpointAdmits` returns `checkpoint.savedAt`) | Low-Med | `checkpointAdmits` never validates `savedAt`. Probe on HEAD: `{run:{phase:1,step:0,mode:"keyless"},project:{id:"p",phases:[…]}}` with no `savedAt` → `{"ok":true}`; `savedAt:"x"` → `{"ok":true,"savedAt":"x"}`; `savedAt:NaN` → `{"ok":true,"savedAt":null}`. A caller applying a max-age policy computes `Date.now() - undefined/NaN = NaN`, whose comparisons are false, so an unknown-age snapshot is admitted. The doc at `:346-348` says `savedAt` is "surfaced so the caller can … apply a max-age policy". Reachability: `readCheckpoint` does gate `savedAt` finite, so the file path is safe — only direct/foreign callers of the exported `checkpointAdmits` hit it. Mutation `if (typeof candidate.savedAt !== "number" || !Number.isFinite(candidate.savedAt)) return false;` → `void candidate.savedAt;` survives `checkpoint.server.test.ts` **27/27** — the write/read `savedAt` guard has no test at all. |
| **M2** | Test that cannot fail (uncoded-failure reachability) | `dod.ts:864-877` (`runGate` unregistered-phase guard A22) | Low | Mutation `if (!items) {` → `if (false) {` survives `dod.test.ts` **9/9** **and** `gates.test.ts` **88/88**. No test calls `runGate` with an out-of-graph phase (`rg "unregistered\|runGate(...,1[3-9])"` over tests → 0). With the guard inert, `evaluate(project, undefined)` throws `TypeError` instead of returning the coded `pass:false` refusal the doc promises. The guard is correct on HEAD; the gap is that CI cannot catch its removal. |
| **M3** | Test-teeth gap (W40·K4 regression risk) | `node-runner.server.ts:317-319` | Low | Mutation dropping `Number.isFinite(requestedMs)` survives `node-runner.server.test.ts` **14/14**. The W40·K4 comment claims "Finite + floored + timer-bounded now"; without the guard `Infinity` no longer falls back to `DEFAULT_TIMEOUT_MS` (30 s) but clamps to `2^31-1 ms ≈ 24.8 days`. No test pins the finite clause. |
| **M4** | Test-teeth gap (documented invariant) | `maker-score.ts:900` (`criteriaMeanExcluding`) | Low | Mutation `if (ids.length === 0) return 0;` → `if (false) return 0;` survives `maker-score.test.ts` **99/99**. The doc says "0, never NaN, when every criterion is excluded"; the guard is unpinned. Currently unreachable through `barForRunKind` (only M7 is excludable, so ≥8 ids remain), i.e. a latent-invariant gap, not a live bug. |
| **M5** | Declared selector with no production consumer (dead surface A2 missed) | `llm/providers/mock.ts:52,167,185` (`RAPIDTOOL_MOCK_LLM` / `mockSelected` / `selectMockProvider`) | Info | `rg mockSelected\|MOCK_SELECT_ENV\|selectMockProvider src scripts` → all hits inside `mock.ts` + `mock.test.ts`; **no production path selects the mock.** A2's dead-surface census listed `probeProviderModels`, `RT_E_NOT_IMPLEMENTED` and `crewToReport`, but not this env selector, which the module itself documents as "the env half of explicit selection". Either wire it or strike the env switch so the surface stops implying a reachable toggle. |

**Not missed / already covered (checked to avoid double-reporting):** cassette key+response binding, MCP UTF-8 frame cap, `one-shot-fetch` cross-origin strip, `NO_CALLABLE_EXPORTS` teeth, salvage-trim scope (A1-11), `p6-arch` absent-tree skip (A1 §"Not findings") — all confirmed as the auditors characterised them. The two slices also contain **0** `as any` / `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` (my own `rg -c` over the 18 slice source files = 0), matching the hygiene claim in both logs.

---

## 3. Work-plan critique

**A1 plan — complete for the slice, correctly prioritised; two additions.**
- Ordering (High placeholder oracle → claim reconciliation → unwired seams → mutation gaps → console gate → coding → capacity) is sound and matches leverage. No listed item is already done.
- **Missing:** M1 (the `checkpointAdmits`/`savedAt` guard test) and M2 (the `runGate` unregistered-phase pin) — both are cheap test additions that belong in the A1-05 test-teeth bundle.
- **Better order:** A1-02 is a High-severity *claim* item but a trivial edit; the plan places it #2 purely on severity. Given that A1-05/M1/M2 protect load-bearing enforcement, run A1-05 **before** A1-02. Also A1-07's "extend `errors.test.ts`" is right but the item conflates it with an `io.ts:524` message nit that should be dropped or folded silently.

**A2 plan — correctly ranks F1 first, but its F1 "minimum viable" fix is likely ineffective; two additions.**
- **F1 fix defect:** the plan's fallback suggestion — "snapshot `callables`/`compileMarker` immediately after the module body and freeze them" — **does not close the hole**. `runCases` calls `runNodeBounded`, which resolves only after the child's event loop drains; the module's `setTimeout(…,0)` forged lines are written *before the process exits* and are already in the captured `stdout` when the parent's parse loop (last-wins, `verify.server.ts:962-989`) runs. Freezing after the body changes nothing about which line the post-exit parse sees. The real fix must change the **channel** (fd 3 / IPC / a result file the module cannot name) or bind the markers to a per-run nonce the module body cannot read — note the harness embeds `__SRC` in the same `new Function`, so a nonce must not be reachable from the module's global scope either. Add the scheduled-forgery regression regardless.
- **Missing:** M3 (node-runner finite-timeout pin) and M5 (the unwired mock env selector), both cheap.
- **Fine as written:** F2's "arm or de-scope", F3's byte-parity gating, F4/F5 bundling, F6/F7/F9 cleanup, F8 text-only, F10 not-worth-doing.

---

## 4. Overall assessment — how much can be trusted as written

**Qualitatively: nearly all of the auditors' observations are real, but about a quarter carry inflated severity or an overstated consequence, and two work-plan items need correction.**

- **A1 (~75% usable as written):** all 13 findings I checked are byte-true; A1-01 (placeholder oracle) and A1-03 (unwired `verifyPriorPhases`) are solid, valuable catches, and A1-05's four mutation gaps reproduce exactly. But **A1-02 (High)** and **A1-10 (DRIFT)** are severity/framing inflation, and **A1-04** overstates its runtime consequence. Treat the A1-01/A1-03/A1-05/A1-06 set as authoritative; de-rate A1-02/A1-04/A1-10.
- **A2 (~80% usable as written):** the marquee **A2-F1 (Critical) is genuine and independently reproduced** — a module that throws on load and exports nothing is `pass:true`, and the mint path is byte-verified. F3/F6/F7 are clean catches. F2/F4 are real facts with inflated severity; F5 is honestly hedged and remains unverified; F8/F9/F10 are accurate but low-impact. The single most important correction is that **A2's own proposed F1 remediation would not fix it**.
- **Net:** ≈**75–80% of the auditors' output can be trusted verbatim**; ≈100% of the *observations* are non-fabricated, so the logs are usable as a work queue once severities are de-rated and the A2-F1 fix is re-designed around an unforgeable channel. Neither auditor found the checkpoint-`savedAt`/`checkpointAdmits` defect (M1) or the four test-teeth gaps (M1–M4), and A2 missed the unwired mock env selector (M5).

### Scope / limits of this validation
- I re-derived **18** findings (10 from A1, 8 from A2) with a probe or a byte-read; I did **not** re-run every claim (e.g. A1-09/A1-11/A1-13 and A2-F8/F9 rest on spot-checks; A2-F5's crash was not reproduced because it needs a keyed/network CLI run).
- Targeted suites only; the full gate / `npm test` was deliberately not run (concurrent agents), and **0 keyed calls** were made. No secrets were printed (`xai-`/`tvly-` probes used synthetic values).
- The only file I wrote is this one. The real tree, all tests, and both auditor logs were left byte-untouched.
