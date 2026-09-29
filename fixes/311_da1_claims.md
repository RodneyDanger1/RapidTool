# fixes/311_da1_claims.md — RESCUED from the auditor's final summary (file write hit the iteration cap; content verbatim)
# DA1 — the claim-auditor truth-table

## DA1 status — ⚠️ FILE NOT WRITTEN (iteration cap)

I ran out of tool-calling iterations while still gathering evidence, so **`fixes/311_da1_claims.md` was never created**. No product edits were made (audit-only honored); my only writes were scratch under `~/rt311_da1`. Below is the full truth-table I had assembled — the parent can paste it into the file.

**HEAD confirmed:** `b3161da` (2026-09-29 14:41:16) — matches context.

### Truth-table (verdict · evidence)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Keyless pipeline e2e + 28KB checkpoint + NDJSON | **PARTIAL** | Fresh `~/rt311_da1`: `create` exit 0 (p.json 15,922B); `.rapidtool/logs/rapidtool.ndjson` 294B **written**; **`checkpoint.json` = 28,274 bytes** ✓ mode `keyless`; 2nd project (corpus brief, verdict `proceed`) `gate` advanced **P0→P4** then parked. I did **not** drive a full 13-phase complete seal — parks at stock HITL. 39 `case "` verbs in the dispatch table (grep -c). |
| 2 | Autonomy spine: W-01 seam / W-02 mint / green-seal gate at engine.ts:1474 | **TRUE** | `engine.ts:1474` comment *"GREEN-SEAL GATE: a RED seal never mints a lesson row"*; red seal at `:1486-1517` writes a `p${phase}.seal.unmet` **log**, never a row. W-01: `engine.ts:4416` `phase === 6 ? (opts?.p6Edge ?? (keyedDeepSeekConfigured() ? wildP6Edge : null)) : null`; `wildP6Edge` `:4119`. W-02: `headless.ts:500` routes phase 6 → `runP6Edge` (`:2563` → `driveP6Journey`; keyless → floor). |
| 3 | p6.repair.delta/refused + per-row attempts; **expandBrief retries 2 attempts** | **PARTIAL (one sub-claim FALSE)** | Delta: `codegen.server.ts:777-788`; refusal: `:790-801`; per-row `attempt` on `GeneratedTreeFile` `:1866`; ✓. **But expandBrief = 3 attempts, not 2**: `P6_EXPAND_MAX_ATTEMPTS = 3` (`:2429`), backoff `500*2**(a-1)` = 500/1000ms. The "2 attempts" figure belongs to **synthesis**: `P6_SYNTH_MAX_ATTEMPTS = 2` (`:2468`). |
| 4 | `step < 20` at store.ts:1231 | **TRUE (verbatim)** | `store.ts:1231` `for (let step = 0; step < 20; step++)`; comment `:1222-1224` "Cap = 20 steps". |
| 5 | Guards: 20+ throws closed; reclaimable locks; M7-01 byte-parity; real entry-runs | **PARTIAL** | Commit evidence only: `1af7f88` "20 throw-guards landed"; `b3161da` "stale-lock reclamation, round-trip byte-parity…"; `4af061a` "U1: entry-runs is REAL". Probes **not re-run**. |
| 6 | 2649 tests / 0 fail / typecheck 0 / lint 0 / build 0 | **UNVERIFIED** | Not run — honest gap. |
| 7 | "No structural blocker remains" | **AGAINST found** | (a) `headless.ts:533-547` `canAutopilot`: forceHuman or `STOCK_HITL=[4,5,8,9]` → never machine-approvable; a `reframe` brief mints `forceHuman:true` ⇒ **P0 park, no unattended path**; `approve --force` non-TTY → `RT_E_VALIDATION` exit 1. (b) Newest keyed run (09-25) = **3/9, `preflightClass:"balance-exhausted"`, evidence "all synthesis calls refused … no LLM-produced software exists"**; M6 0 "foreign files in emit dir". |
| 8 | "Funded keyed run never happened post-overhaul" | **TRUE (with caveat)** | `history.json` n=40 = **10 keyed / 30 keyless**; keyed: 09-08×2, 09-09×2, 09-10×2, **09-24×2 (5/9, 6/9)**, **09-25 (3/9)**. `results.json` generatedAt **2026-09-25T00:03:43Z**; `run-in-progress.json` 09-25 keyed, `decision:"retrace-first"`. Overhaul plan = `research/multiagent/220_overhaul_plan.md` (09-24). **No keyed run after 09-25**; last eval-out activity = a `diagnose` call 09-28. "Never happened" is too strong — keyed runs occurred at overhaul onset. |
| 9 | No iterate-until-satisfaction driver | **TRUE** | No score<threshold regen path found. Nearest: bounded tree-run repair cycle — `headless.ts:2576-2587` (treeRun→red tail→1 repair call→re-run; "budget exhausted → honest FAILED"; default budget 3), + `synthWithBackoff` (2). Keyed on **tree-run failure**, not score, and bounded. |
| 10 | No self-modification loop | **TRUE (as searched)** | `REPAIR_TREE_ALLOWED_ROOTS` (`headless.ts:2592-2600`) restricts writes to `src/{api,domain,jobs,state,ui,generated}/` + `tests/`; `emit` targets `<home>/RapidTool Software/<slug>/`; `edit --write` gated by `evaluatePolicy("repair.apply")` — writes the *emitted dir*, never the harness repo. Exhaustive-write-path grep not done. |

### Honest gaps
- Claim 6 suite/gates not run; claim 5 probes not re-run; full 13-phase complete seal not achieved (HITL parks + non-TTY approve refusal); claim 10 not exhaustively grepped.
- **Deliverable `fixes/311_da1_claims.md` missing** — write it from the table above.