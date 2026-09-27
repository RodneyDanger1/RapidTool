# fixes/285_g3_model_visibility.md — W38 · LANE G3 · THE MODEL-VISIBILITY GUARANTOR

**Lane:** W38 G3 (deleg_d2de3167 task-1). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · HEAD `0f85c32` + the W29–W37 uncommitted era.
**Mission (two directions):**
- **(A) what the AI API MODEL SEES** — contracts/spec/memory/notes threading at EACH prompt builder in the synthesis chain; the chunked path's prior/context completeness+cap.
- **(B) what RapidTool sees OF the model** — served-model stamps (`modelRoute`, provenance `servedModel`) reflecting the model that actually served; the usage/token call tap (installed + folded on the real path); model-id comparisons/whitelists using registry ids (not inline strings); 402/refusal texts carrying the vendor message.
**Box (mine):** the seams AROUND `codegen.server.ts` (Y1 LIVE — read fresh, never edit) · `src/lib/llm/**` (providers/registry/ledger — read-mostly; tiny fixes only if Y1's bytes untouched) · prompt-builder callers · registry ids · refusal classify sites.
**Contract:** CODE-ONLY — no test runs, no typecheck, no builds, no gates, no keyed calls. TINY, honest, additive fixes only. `TODO(<id>)` at the logic line. Log-and-continue.

## [t0] Byte-state (verified reads — before any edit)

| File | Bytes / lines | mtime | Note |
|---|---|---|---|
| `src/lib/codegen.server.ts` | 180,055 B / **3,690 lines** · git blob `90939eb7…` | Sep 26 **20:28** | Y1's box — RECENT mtime (live lane); read-only for me |
| `src/lib/store.ts` | (Y2 box) | | `contracts` mentioned only in a comment `:255` |
| `src/lib/types.ts` | `DataContract` `:300` · `Project.contracts: DataContract \| null` `:381` | | the shape R10-f01 threads |
| `src/lib/engine.ts` | `contracts` threaded `:1133, :1210, :2133-2143, :2449-2545` | | engine regenerates + repairs; nothing reaches codegen |

- **R10-f01 re-verified at t0:** `grep -c "contracts" src/lib/codegen.server.ts` → **0**. The synthesis chain does not read `project.contracts` at all (matches the register: "never read by codegen.server.ts (zero grep hits)"). Status: **OPEN** at t0 → wire or for-Y1, decided below.
- **FM-08 landed (Y1, W37):** `p6SynthesisChunkUserPrompt` now renders DATA FLOW + ERROR HANDLING blocks behind non-empty gates (`codegen.server.ts:1330-1352`); `p6SynthesisUserPrompt` (the ≤8-signature legacy delegate, `:1245-1258`) forwards through the same builder → both builders render all SIX spec fields.
- **R12-f01 caps (verified at t0):** `P6_SYNTH_PRIOR_MAX_FILES` (`codegen.server.ts:165`) + `P6_SYNTH_PROMPT_MAX_CHARS` (`:174`) + visible `…[PRIOR-ELIDED …]` markers at both cuts (`:1367-1395`).
- **Functions of record:** `liveP6Synthesis` `:2786` · `synthesizeSingleModule` `:2907` · `synthesizeChunkedTree` `:3203` · `synthesizeChunkEnvelope` `:3335` · `partialTreeRefuse` `:3479` · `modelProvenance` `:2579` · `modelRouteForServed` `:2656` · `accountSynthUsage` `:2386` · `accountRepairUsage` `:2420`.

## Findings (append-only)

STATUS legend: ✓ verified-true-today · FIXED = this lane's patch · for-<lane> = recorded, owned elsewhere · OPEN = unaddressed.

_(rows land below as verified)_

## [W40 K8 · 2026-09-27] THE OWED FINDINGS ROWS — appended from the lane's delegation summary

**Why here:** G3 (W38) ran out of iterations mid-sweep; its log carries only the t0 byte-state ("**Findings rows + the 'not landed' note were not appended** (iteration cap)"). The delegation summary (`~/AppData/Local/hermes/cache/delegation/subagent-summary-1-20260926_203820_899655.txt`) is the only persisted record — re-landed below verbatim. **Critical context (verbatim):** Y1 was a LIVE sibling (`deleg_31f708fd`, active patches at 20:32–20:35; `codegen.server.ts` mtime 20:28, blob `90939eb7…`, 3,690 lines) — G3 deliberately did **not** edit it; two candidate tiny fixes lived there → deferred. Byte-verified at lane time; **later waves (Y1 et al.) may have landed some — re-verify before acting**. Appended by W40 K8 as the Z4 payout's G-map record. *(Note: the K8 source-matrix had mislabeled this summary as "G2"; it is G3's.)*

### G3 · (A) WHAT THE MODEL SEES

| Item | file:line | Status | Evidence |
|---|---|---|---|
| **R10-f01** `project.contracts` reaches synthesis prompt builders | `codegen.server.ts` (whole file) | **OPEN** | `grep -c contracts` → **0**. Y1 has NOT closed it. |
| …but contracts ARE a real, consumed seam elsewhere | `scaffold.ts:758,802,1390-1394,1924-1926,2961` · `packet.ts:567-572,625` · `engine.ts:1133` · `diagram.ts:424` | ✓ | So the wire target exists; binding seam = `liveP6Synthesis(project, deps)` — `project` already carries `contracts` (`types.ts:381`, `DataContract` `:300`). |
| Spec threading — all SIX fields at BOTH builders | `codegen.server.ts:1310-1352` (chunk), `:1245-1258` (user → delegates `:1257`) | ✓ | FM-08 landed (`dataFlow`/`errorHandling` behind non-empty gates `:1339-1352`); no sibling builder drops a field. |
| Memory (lessons) threading at every builder | `:2836-2843` (expansion), `:2919-2924` (single), `:3251-3256` (chunked) | ✓ | Same `lessonLinesForBrief(selectLessons(memory,6,LIMIT))` at all three. |
| `project.notes` threading | `:2841-2842` only | ✓ partial | Reaches the **expansion** prompt (240-char slice); never reaches synthesis prompts. |
| Chunk prior/context complete-but-bounded | caps `:165` (`PRIOR_MAX_FILES=12`) + `:174` (`PROMPT_MAX_CHARS=60_000`) + markers `:1367-1395` | ✓ | Both cuts carry visible `…[PRIOR-ELIDED …]`; exports+reqTrace rendered; the assembled module binds *all* prior exports regardless of the render cut (`:1354-1396`). |
| Spec-level blind spot worth recording | `codegen.server.ts:75` doc comment | ✓ (as documented) | `contracts` was never in the builders' input contract at all; `crew.server.ts:425,757` (packet-fed) and `verify.server.ts:793+` DO consume contracts via packet/oracle — so only the synthesis hop is blind. |

### G3 · (B) WHAT RAPIDTOOL SEES OF THE MODEL

| Item | file:line | Status | Evidence |
|---|---|---|---|
| `modelRoute` from the SERVED id (not a constant) | `:2656 modelRouteForServed` → `:2735`, `:3498`, `:3586` | ✓ FM-04 landed | Single-module passes `res.model` (`:3152`); chunked passes first accepted chunk's served id (`:3236`, `:3295`); partial-tree passes it (`:3287`). |
| provenance `servedModel` fail-closed | `:2579-2583 modelProvenance` | ✓ | blank/NaN served id ⇒ `null` stamp (never a guessed producer); called at `:2684`/`:3543`. |
| Route heuristic vs registry ids | `:2658` `id.includes("pro")` else flash | **not registry-id-driven** | Substring match, not exact `KNOWN_MODEL_IDS`. |
| Inline route strings instead of registry ids | `engine.ts:1992-1993,3009-3011,3236-3239` · `headless.ts:333-336` | **not registry-id-driven** | 3 duplicate whitelists; today's default `P6_SYNTH_MODEL` is flash so behavior is right, but any pro-pinned serve + one of these sites = wrong label. |
| **Call tap installed on the REAL path** | `run-eval.mjs:2718` (`installLlmCallTap`, `KEYED_OK`-gated), window `:1786/:1956`, fold `:1957`→`:737 llmEvidenceFromCallRecords` | ✓ (W24/B2 landed) | Row gains `servedModels/usage/estimatedCostUsd/llmCalls/failedCalls/noBalance` (`:777-785`); tap = one funnel `deepseek.ts:596-651`, never throws, async-rejection contained (`:607-628`). |
| Tap records — cache-field gap | `deepseek.ts:640-649` vs `token-ledger.ts:150-188` | **gap** | The tap carries only `promptTokens/completionTokens`; `cachedPromptTokens/cacheWriteTokens/reasoningTokens` exist in the ledger but never reach run-eval, so its price estimate can't take the cheaper cache-hit bucket (`run-eval.mjs:691-699` says so). |
| Registry ids are the single source | `registry.ts:129-140`, `:625`, refusals `:612`; provider pre-network check `deepseek.ts:354` | ✓ | `isKnownModelId`/`KNOWN_MODEL_IDS`; unregistered ids refused before I/O. |
| …but inline literals elsewhere | `llm.ts:18` (union), `llm-tasks.ts:127,157,188`, `algo-tools.ts:120,245`, `dod.ts:953` | **not registry-derived** | Legal ids only today; provider still refuses unknowns pre-network. |
| 402/refusal texts carry the vendor message | `deepseek.ts:281-295` (`error.message`, else labeled ≤200-char body), `:302-303`, `:458-465`; mirror `openai-compatible.ts:340-341,499-504` | ✓ | Same `describeError` text rides the refusal; code splits on `status===402 || /insufficient balance/i`. |
| Refusal-text precision residual | `deepseek.ts:459`, `openai-compatible.ts:499` | **residual** | Bare vendor phrase "Insufficient Balance" (no key/message shape) → `/insufficient balance/i` misses ⇒ generic `RT_E_LLM_REJECTED`. Also nothing *persists* the vendor phrase beyond the 160-char `refuse()` slice (`codegen.server.ts:2468-2483`) and run-eval's `noBalance` boolean. |

### G3 · TWO TINY FIXES READY TO LAND (NOT landed at lane death)
1. **`deepseek.ts:459` + `openai-compatible.ts:499`** (not Y1's box): `/insufficient[" ](?:balance|funds)/i` (+ keep `status===402`) so a bare vendor phrase classifies as `RT_E_LLM_NO_BALANCE`; optionally persist `refusalText.slice(0,160)` into the refusal log detail at `codegen.server.ts:2479`. ~2 lines each.
2. **`codegen.server.ts:2656-2660`** (Y1's box → `for-Y1`, 3-line instruction): make `modelRouteForServed` match exact registry ids (`deploy: registry KNOWN_MODEL_IDS`, `pro` ∈ registry pro ids, `flash` ∈ flash ids, else fail-closed) instead of `id.includes("pro")`; and dedupe the three inline `"deepseek-pro"/"deepseek-flash"` whitelists at `engine.ts:1992-1993,3009-3011,3236-3239` + `headless.ts:333-336` onto it.

### G3 · OWED TO THE PARENT (verbatim)
1. Append the (A)/(B) tables above into `fixes/285_g3_model_visibility.md` (append-only; file has a `## Findings (append-only)` stub waiting). ← _done by this append_
2. Land fix #1 (does not touch `codegen.server.ts`); route fix #2 to Y1 or the boundary.
3. Decide R10-f01's wire: `for-Y1` with the 3-line instruction — thread a capped `DATA CONTRACTS` block (`entities: name (fields…)` / `endpoints: METHOD path (job)`, ≤12 rows, marker on cut, non-empty gate so byte-parity holds) into `p6SynthesisChunkUserPrompt` from `project.contracts` at the `liveP6Synthesis` seam (`:2786`) → `synthesizeSingleModule`/`synthesizeChunkedTree`; done-when = a contract entity name appears in the emitted tree.

_— appended by W40 K8, 2026-09-27 (markerless append at EOF; the lane's own sections above were not edited)._
