# fixes/282_y2_runtime.md — Y2 · THE RUNTIME-CODER (W37 lane Y2)

**Lane:** W37 Y2 — runtime remainder. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`, HEAD `0f85c32` + the W29–W37 uncommitted era.
**Box (mine):** `src/lib/engine.ts` · `store.ts` · `phases.ts` · `dod.ts` · `packet.ts` · `io.ts` · `rt-*.ts`. **Not mine:** `checkpoint.server.ts`/`headless.ts`/CLI (N2) · `scaffold.ts`/`codegen.server.ts` (N1/X1) · `console.tsx` (N3) · `run-eval.mjs`/scripts (N5) · tests/pins (N6) · `llm.ts`/`registry.ts`/`gate-stats.ts`/`errors.ts` (unboxed).
**Contract honored:** CODE-ONLY — zero test runs / typecheck / builds / gates / keyed calls. Log-and-continue. All patches smallest-honest; comments tightened to match bytes; `TODO(<id>)` added only where a landing is genuinely deferred.
**Started** ~20:03 CDT · **closed** ~20:26 CDT. State at start: store.ts mtime 19:56, engine.ts 19:52 (settled 20+ min; F3-10 + readWildPlan had landed before me — verified, not re-done). Patch tool note: its per-file tsc probe fails with TS6053 (space-path artifact) and two runs timed out at 30s — NOT evidence of introduced errors; boundary gates are the arbiter.

## RUNNING TABLE (item → file:line → landed/TODO → evidence)

| # | item | file:line | state | evidence |
|---|---|---|---|---|
| A1-21 | hydrateProject early-return omitted 7 repair flags → stale packet shipped | engine.ts hydrateProject (~:2491-2585) | **LANDED** | ONE `anyRepaired` list (12 flags + new shapeRepaired) now drives BOTH the log-if and the early-return; hole/chatLog/research/impl/scorecard/tree/fixtures repairs now re-stamp (attachAlgorithms) instead of returning the pre-repair packet |
| A1-22 | specGraph/contracts inner-shape undefended engine-side (whole-store-wipe vector) | engine.ts ~:2116-2143 + literal ~:2447 | **LANDED** | new `usableSpecGraph`/`usableContracts` mirror io's import checks (order+nodes arrays w/ id; entities need name+fields arrays); broken → null + `shapeRepaired` → logged (`specGraph/contracts:dropped`) + re-stamp. Persist path (localStorage→hydrate) now defended like io |
| A1-27 | `sealPacketArtifact` mutated its arg | engine.ts ~:361-380 | **LANDED** | returns `{ ...project, artifacts: [...] }`; comment names the aliasing class |
| A1-28 | sandbox `timeoutS`/`isolated` accepted type-junk (`?? 30`, `?? false`) | engine.ts ~:2430-2440 | **LANDED** | `typeof number && finite ? : 30`; `=== true` |
| A1-30 | hydrateWildRun clamp magic 12 / `WildRunState.phase: number` | engine.ts ~:2096 | **LANDED (clamp)** | `Math.min(PHASE_LAST, …)`; types.ts `phase: number` left deliberately (legacy tolerance — documented) |
| A1-46 | `dedupeMemoryIds` 10k suffix cap → could re-mint a colliding id | engine.ts ~:303-310 | **LANDED** | cap removed; loop terminates (finite `occupied`, monotonic suffix); comment names the old invariant break |
| A1-16/F3-19 | positional `project.phases[phase]` ×3 | store.ts advanceOnce ~:452, advanceOnceAsync ~:645, reject ~:1651 | **LANDED** | `.find(p => p.id === phase)` + A20 comments (mirrors phases.ts law/repairPhases) |
| A1-13 | double `releaseWildStart(id)` (nested try/finallys) | store.ts startWildRun ~:1210-1218 | **LANDED** | one outer `finally` on the post-latch try; nesting verified by read — single call (`grep` = 1 call + import); PA-01/PB-04/174-2 semantics preserved in comment |
| A1-14 | `runVerifyAsync`/`runP6Journey` skipped ST-6 `serialized(id, …)` | store.ts ~:944/~:972 | **LANDED** | both now `(id) => serialized(id, async () => …)` like their 5+ peers; keyless passthrough unchanged |
| A1-15 | magic `12`/`13` under a "derives from the graph" comment | phases.ts (`PHASE_LAST` export) + store.ts ~:486/:554/:672/:1268/:1367 | **LANDED** | new `PHASE_LAST` in phases.ts; `phase < PHASE_LAST`, `(PHASE_LAST + 1 - start.currentPhase) * 2 + 2`; comment now true |
| A1-17 | salvageTrim comment claimed engine parity / "loses nothing" | store.ts ~:709-726 | **LANDED (truth)** | comment states exactly what is bounded + `TODO(A1-17)` to extend via one shared caps source (with A1-03/A1-44) |
| A1-18 | `clone()` copied an ACTIVE wildRun (phantom run, blocked startWildRun) | store.ts clone ~:1762-1783 | **LANDED** | copy's run stopped (`active:false, pause:false, stoppedAt`) + `wild.stop` info row — hydrate doctrine mirrored |
| A1-19 | `synthesizeAsync` catch swallowed a THROW silently | store.ts ~:609-630 | **LANDED** | fallback kept; now stamps a `llm.degrade` warn row w/ `classifyError(err)` (imported from errors.ts) — keyless quiet path untouched |
| A1-20 | comment cited nonexistent `CHAT_LOG_MAX_ROWS` | store.ts ~:709-726 + appendChatRows ~:1804 | **LANDED** | constant defined; `RESCUE_CHAT_CAP = CHAT_LOG_MAX_ROWS`; `.slice(-CHAT_LOG_MAX_ROWS)`; cited symbol exists |
| A1-23 | io comment claimed research engine-half "lands later" | io.ts ~:142-145 | **LANDED** | now "normalized engine-side since fixes/122 … AHEAD of hydration" |
| A1-25 | io promised `tooLargeToPersist` machine code; none exists | io.ts ~:32-42 | **LANDED (comment truth)** | comment describes message-only refusal + `TODO(A1-25)`: mint `RT_E_IMPORT_TOO_LARGE` + registry entry when the errors pass lands (errors.ts out of box) |
| A1-26 | repair-log `-200` slice silently dropped old rows | io.ts ~:396-419 | **LANDED** | `dropped` computed; detail gains `logs:-N` only when rows actually drop; clamp now `PHASE_COUNT - 1` |
| A1-31/32 | packet junk-research guard overstated; `- undefined — url` | packet.ts ~:486-505 | **LANDED** | non-array `items` / null row → contribute nothing; title-less → `(untitled)`; comment restated to weakest-covered-case |
| A1-33 | `truncateToBudget` legacy cuts exceeded budget by the marker | packet.ts ~:761-779 | **LANDED** | both legacy cuts reserve `markerLine.length`; doc invariant true on every path |
| A1-34 | `rejectionHistory` non-null asserts on persisted data | packet.ts ~:519-527 | **LANDED** | asArray locals; `!` pair removed |
| A1-35 | `approvalActor` first-wins + unvalidated `decidedBy` type lie | dod.ts ~:145-159 | **LANDED** | newest-first scan (mirrors refusalClassOf) + `actor === "human" \|\| "autopilot"` validation. **Pin owed to N6**: two-approve-rows winner test |
| A1-36 | "PURE gate-recorder" doc vs Date.now() stamps | dod.ts ~:846-856 | **LANDED** | doc now "DETERMINISTIC … host clock stamps checkedAt/ts (A1-36)" |
| A1-37 | CAPABILITIES + phases P2 "No durable checkpoint layer" vs shipped module | dod.ts ~:941-951 · phases.ts:25 | **LANDED** | both claims now "No WIRED durable checkpoint layer (T-107.7 in-tree, no call site yet)" + same-commit flip note |
| A1-39 | `buildClientDiagnosis` `input.project?.logs.length` throws | rt-client.ts ~:660-680 | **LANDED** | `projectLogs` + `Array.isArray` guard at use site |
| A1-40 | `stampSeed` throwaway-ring sessionId orphan | rt-client.ts ~:195-200 | **LANDED** | `ring ?? (ring = getRtRing())`; recursion-safety traced (ring assigned before the corrupt-path stampSeed call) |
| F3-05 | wild driver `stoppedReason: null` on honest external stops | store.ts ~:1191-1195 | **LANDED** | `"stopped"` named; union + doc extended |
| F3-06 | ok:true dual-channel `code: res.code` (185-H1 violation) | store.ts ~:1182-1187 + type ~:72-79 | **LANDED** | pause class rides `note`; `code` only on ok:false. **⚠ Pin owed to N6**: `store.test.ts:972` asserts `res.code === "RT_E_LLM_NOT_CONFIGURED"` on ok:true → re-point to `res.note` (asserts the NEW contract; do not weaken) |
| F3-08 | `runModuleReal` guard branch generic error, no code | store.ts ~:1470-1477 + decl ~:156-159 | **LANDED** | returns `code: "RT_E_RUNNER_UNAVAILABLE"`; declaration widened with `code?: ErrorCode` |
| F3-10 | unguarded commit @old:1309 | store.ts ~:1350-1356 | verified holding | already `keepLiveWildRun(rebaseUserFields(next.project, live), live)` (landed before me @19:56) |
| F3-20a | `phaseCoverageLine` positional `PHASES[tailStart]` | phases.ts ~:225-236 | **LANDED** | `PHASE_BY_ID` lookups (byte-identical output today) |
| F3-20b | HITL_PHASES consumption | phases.ts:150 | verified holding | pinned by phases.test:34/:37 + diagram.test:241; store imports STOCK_HITL from phases (no dup literal) |
| F3-15 | mode-probe parity | engine.ts:1830-1836 | verified (engine half) | `keyedDeepSeekConfigured` = typeof-guarded, trimmed env read; headless/server-side parity remains a boundary check (not my box) |
| F3-18 | journey-gate vs finishPhase-gate two-hash divergence | dod.ts recordGateInto / engine driveP6Journey | DECISION RECORDED | `recordGateInto` no-ops unless `rec.status==="complete"` (dod.ts ~:874) ⇒ journey returns `gate:null` on awaiting_hitl; `finishPhase` then records the fresh verdict — intentional consequence of record-into-complete-only; no code change (no drift bug, two records = two moments) |
| F3-17 | phase-6 live bypasses liveLayer's P6 branch | headless.ts:380 (not my box) | **for N2** | suggest a coupling comment at `runP6Edge` / `liveLayer` P6 branch — engine-side comment not added to avoid cross-lane churn |
| C4 (§P2) | `readWildPlan` engine export | engine.ts:3538 | verified present | landed pre-me (N2/parent); headless import resolves |
| A1-44 | `slice(-200)` ×30 sites / shared `LOG_CAP` | cross-file | **DEFERRED** | needs one shared caps module decision touching codegen/headless (not my box); do not add a 3rd vocabulary piecemeal. Related literal fixed where local: io clamp→PHASE_COUNT |
| A1-38/41/42 | round2 name · llm.complete `thinking` · registry `process.env` | gate-stats.ts / llm.ts / registry.ts | **for boundary (unboxed files)** | one-liners per §A1 ③ |
| — | `Math.min(12, …)` remaining sites in engine hydrate/hole repairs (~:2137/:2163/:2186) | engine.ts | noted | same constant-swap class as A1-30; left to a mechanical sweep (each is behavior-safe only with the full hydrate read) |

## Files modified by this lane (all product code; no tests, no docs except this log)
`src/lib/{engine,store,phases,dod,packet,io,rt-client}.ts` — additive/smallest patches above; no export renames; `PHASE_LAST` + `CHAT_LOG_MAX_ROWS` are the only new names.

## Owed to other lanes / boundary (do NOT let these float)
1. **N6**: re-point `src/lib/store.test.ts:972` → `assert.equal(res.note, "RT_E_LLM_NOT_CONFIGURED", …)` (F3-06 contract). Nothing else in my diff should redden tests: io :75 matches `/too large/i` (untouched); packet truncation pins (:318-331) assert marker+length — still true; store :954/:1009 pin ok:false codes — untouched.
2. **N6**: add the A1-35 winner pin (two approve rows → newest wins; junk `decidedBy` → null).
3. **Boundary**: `PHASE_LAST`/`anyRepaired`/`usableSpecGraph` are new symbols — a scoped `tsc` on engine+store is the cheapest first check after lanes freeze.

## VERIFICATION (contract-scoped, honest)
- **No project gate was run** — the W37 pack + this lane's dispatch are explicit: CODE-ONLY, **no test runs / typecheck / builds / gates / keyed calls**; the boundary legs (`typecheck · lint · the leg list`) belong to the PARENT after freeze (master-pack §THE ORDER + THE BOUNDARY), and W36 lanes (N1/N2/N5/N6) were live mid-edit beside me — a gate now would report *their* in-flight breaks, not this lane's.
- **Targeted check run instead:** `node --experimental-strip-types --check` on all 7 edited files → `PARSE_OK` ×7 (`engine · store · phases · dod · packet · io · rt-client`). This is a syntax parse only (proves no structural breakage from the V4A hunks — the store.ts try/finally collapse and the engine helper inserts were also re-read byte-level), NOT a typecheck.
- **Test-pin deltas are enumerated, never silent** — see "Owed to other lanes / boundary" above (store.test.ts:972 re-point for F3-06 is the only expected red from this diff; io/packet/store pin checks were read before patching).
- **Second pass (~20:27):** race check clean — all 7 files still at lane edit times (20:09–20:25), no sibling writes since; symbol-resolution verified: `PHASE_LAST` (phases.ts:165 → store ×6 / engine ×2), `CHAT_LOG_MAX_ROWS` (store.ts:742-743), `classifyError` (errors.ts:288), `RT_E_RUNNER_UNAVAILABLE` (ERROR_CODES:29 + doc:393 → store). Residual risk = type-level only, owned by the parent's freeze→typecheck boundary step.
