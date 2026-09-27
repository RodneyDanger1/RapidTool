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
