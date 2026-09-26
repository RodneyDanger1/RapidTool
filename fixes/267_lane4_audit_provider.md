# fixes/267_lane4_audit_provider.md — W27 R4 · provider layer + server seams + telemetry

**Lane:** R4 (`wave_plans/W27/mass-investigation.md` §R4). **Read window:** 2026-09-26, HEAD `e3d3fe4` (all evidence read at these bytes).
**Box:** `src/lib/llm/**`, all `*.server.ts`, `rt-*.ts`, `watchdog.ts`, `diagnose.ts`, `errors.ts` (+ tests, + the committed H3/H1 probes).
**Rules honored:** no product edits · no keyed calls (both probe runs keyless by construction: dummy keys + injected fetch, and the not-configured path) · no full-gate runs (one targeted leg, one `--test-name-pattern` run).

## Deliverable checklist
- [x] B3-f02 CONFIRMED UNFIXED at HEAD + exact fix spec (R4-f01) — re-proven live with `probe-h3-balance.ts`
- [x] B3-f01 re-check executed + gap/spec for the async regression test (R4-f02)
- [x] A2-f07 process-scoped ledger design spec (R4-f03)
- [x] C1-f08 (R4-f04) + C1-f09 (R4-f05) CONFIRMED, refined, spec'd
- [x] `node:`-import boundary map over client-reachable modules (R4-f08)
- [x] Telemetry purity sweep — 2 breaches (R4-f06, R4-f07) + verified-clean list
- [x] Timeout/abort handle audit — clean (verified-clean list)
- [x] §R4 appended to `research/multiagent/thoroughanalysis.md` (R4-f01…f10)

**© LANDED (verified after append):** §R4 block starts at `thoroughanalysis.md:741`; file 671→803 lines / 148,061 B; END-OF-FILE-MARKER-W25 intact and the file's LAST line (re-read post-append); sibling blocks (§R1 @430, §R2 @371, §R8 @671, §R13 @495) untouched; no product files modified by this lane (`git status --short -- src scripts` → empty).

## Findings (final; the §R4 append is the deliverable)
| ID | Sev | What | Fix shape | Where |
|---|---|---|---|---|
| R4-f01 | P1 | xAI/OpenAI-compatible 402 → `RT_E_LLM_REJECTED` (wallet ≠ generic refusal) | mirror `deepseek.ts:437-444` (402 or /insufficient balance/i → `RT_E_LLM_NO_BALANCE`) | `openai-compatible.ts:488-495` |
| R4-f02 | — | B3-f01 async-tap containment: fix CONFIRMED landed + contained; async REGRESSION TEST missing | add async-twin test (spec in §R4) | `deepseek.ts:585-607`; `run-eval.test.mjs:1029` |
| R4-f03 | P2 | `RAPIDTOOL_TOKEN_CAP` is per-call, not a session cap; T-107.6 budget seam has 0 production callers | process-scoped `sessionTokenBudget()` singleton + defaults + verify threading; delete `p6TokenCapFromEnv` dup | `codegen.server.ts:2310-2317,2282-2288`; `token-ledger.ts:298-303`; `headless.ts:3025-3027` |
| R4-f04 | P3 | `complete()` facade opts omit `thinking` (validator has it; runtime forwards) | add documented `thinking?: boolean` to the public type | `llm.ts:77-84` vs `:47-63` |
| R4-f05 | P3 | no model-id validation in `completeDeepSeekInner`; header claims "refused before any network I/O" (rule lives only in registry.ts) | validate against `DEEPSEEK_MODEL_IDS` pre-network → `RT_E_VALIDATION` | `deepseek.ts:343-347,49-51` |
| R4-f06 | P2 | poisoned crash-snapshot `at` (JSON `1e999` → Infinity) survives the swallow and throws the OBSERVER in `diagnose.ts:281` | finiteness guard at both sites | `rt-client.ts:264-266,273`; `diagnose.ts:281` |
| R4-f07 | P3 | `rtHydrate` bypasses `RING_CAP`/`RING_BYTES` (unbounded rows from a user-writable blob) | `rows.slice(-RING_CAP)` at hydrate | `rt-ring.ts:182-236` |
| R4-f08 | P3 | `knowledge.ts` (node:fs) is inside the CLIENT graph via lazy seams; `write-set.ts`/`ast-mine.ts` carry node: imports without `.server.ts` | header contracts + guard test; optional rename wave | `knowledge.ts:27-28`; `engine.ts:97`; `report-intake.ts:63` |
| R4-f09 | P4 | `probe.ts` "never throws" has one reachable throw (bad injected clock before the try) | validate the hook result | `probe.ts:113` |
| R4-f10 | P4 | 4 scratch probes committed at repo root in e3d3fe4 (2 are the R4 re-check vehicles) | keep tap-crash + balance; drop the other 2 at housekeeping | `git show --stat e3d3fe4` |

## Evidence log (commands actually run today; outputs verbatim in §R4)
1. `node --experimental-strip-types probe-h3-tap.ts` → `case1 … survived: true code: RT_E_LLM_NOT_CONFIGURED` / `case2 … survived: true code: RT_E_LLM_NOT_CONFIGURED` / `case2 unhandledRejection fired: []` / `VERDICT: contained` (EXIT=0).
2. `node --experimental-strip-types probe-h3-tap-crash.ts` → `call survived: true` / `REACHED-END (process did not crash)` (EXIT=0).
3. `node --experimental-strip-types probe-h3-balance.ts` → `DeepSeek 402 → code: RT_E_LLM_NO_BALANCE` / `xAI 402 → code: RT_E_LLM_REJECTED` / message `xAI account balance exhausted (HTTP 402: Insufficient Balance) — requested model: "probe-model-id"`.
4. `node --experimental-strip-types --test --test-name-pattern="W24/B2" scripts/run-eval.test.mjs` → `# tests 4 # pass 4 # fail 0`.
5. `node -e 'const at = JSON.parse("{\"at\":1e999}").at; …'` → `parsed at: Infinity finite: false` / `THROWS: RangeError Invalid time value`.
6. Repo greps: `createTokenBudget` production callers = 0 (only `verify.server.test.ts:711`); `RAPIDTOOL_TOKEN_CAP` production references = codegen.server.ts + token-ledger.ts only; `node:`-importing non-`.server.ts` modules = {knowledge.ts, write-set.ts, ast-mine.ts} with zero non-test client importers.

## Files read (in full unless noted)
`llm.ts` · `llm/providers/deepseek.ts` · `llm/providers/openai-compatible.ts` · `llm/providers/registry.ts` (structured + selective) · `llm/providers/probe.ts` · `deepseek.server.ts` · `token-ledger.ts` · `codegen.server.ts` (budget/synthesis seam: 2270-2420, 2790-2840, 3140-3200) · `verify.server.ts` (775-1002) · `headless.ts` (seam greps + 3015-3045) · `rt-events.ts` · `rt-ring.ts` · `rt-client.ts` · `rt-timeline.ts` (head) · `watchdog.ts` · `diagnose.ts` · `errors.ts` (140-335, 385-430 + registry greps) · `runtime-log.server.ts` · `llm-tasks.ts` · probes ×3 · `run-eval.test.mjs` (1024-1068, 583-663) · `package.json` test-glob check.

**Status:** COMPLETE — §R4 landed; no product edits made.
