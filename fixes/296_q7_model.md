# fixes/296_q7_model.md — W41 · Q7 · THE MODEL-VISIBILITY PAYOUT (K6's 6 handoffs + G3's remaining items)

**Lane:** W41 Q7 (`deleg_24919d27` task-6; the Q-batch parent brief). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell `grep` only, short one-liners).
**HEAD at start:** `ac6b151` («W41 fins: throws closed (H1 73c/2t), F6 cassette cache-field strip killed, checkpoint in diagnose») — working tree NOT clean (live siblings own dirty files; see the map below).
**Box (mine):** `src/lib/llm/**` (providers `deepseek.ts` / `openai-compatible.ts` / `registry.ts` / `probe.ts`) · `src/lib/llm.ts` · `src/lib/deepseek.server.ts` · `src/lib/llm-tasks.ts` (+ its pins) · the SERVED-model stamp chain (verification; the stamp sites themselves live in live-lane files → handoffs) · the call-tap record · refusal classify sites. **Not mine (live):** `engine.ts`·`store.ts`·`headless.ts`·`phases.ts` (Q1) · `scripts/run-eval.mjs` (Q4) · `scripts/rapidtool-cli.mjs`·`errors.ts` (Q8) · `console.tsx` (P2) · `crew.server.ts` (P1).
**Contract:** NO keyed calls; patch-first on fresh bytes; `node --check` on every edit; scoped foreground legs only (deepseek/llm); `TODO(<id>)`/`for <lane>` where a landing is out of box.
**Sources:** `fixes/290_k6_deepseek.md` (the 6 handoffs) · `fixes/285_g3_model_visibility.md` + its delegation summary (`~/AppData/Local/hermes/cache/delegation/subagent-summary-1-20260926_203820_899655.txt`, the (A)/(B) tables + 2 ready fixes) · `fixes/267_lane4_audit_provider.md` (R4-f05 the model-id validation claim) · neighbour states: `fixes/291_k10_runtime.md`, `fixes/294_n2_pipeline.md`, `fixes/291_k13_pipeline.md`, `fixes/292_l3_eval.md`.

## t0 — recon (2026-09-27 04:08–04:30, fresh reads)

### Live-lane collision map (who is editing what RIGHT NOW)
- `deleg_24919d27` LIVE: Q1 (engine/store/headless/checkpoint/phases — its clamp census explicitly names `codegen.server.ts:2409,2652,3451,3525,3541`), Q2, Q3, Q4 (`scripts/run-eval.mjs` — `passesAcceptance` lives there), Q5, Q6 (io/packet/docs), Q8 (`rapidtool-cli.mjs`, `headless.ts`, `errors.ts`). `deleg_0f4ca363` LIVE: P1 (F2 tail incl. the crew budget seam → `crew.server.ts`), P2 (chat/UI → `console.tsx`, modified 04:21 mid-run), P3 (eval), P4 (sweeps/docs).
- Consequence: **engine.ts / headless.ts / run-eval.mjs / crew.server.ts are OFF-LIMITS** (live writers). `codegen.server.ts` is unclaimed but sits inside Q1's clamp census → cache-discipline landing decided below with a byte-fingerprint guard.

### Byte state of the files in play (md5 · mtime, taken before any edit)
| File | md5 | mtime | Note |
|---|---|---|---|
| `src/lib/llm/providers/deepseek.ts` | `8f91d0fc1e04cdaee546bc6f657f787a` | 01:16 | K6#1 landed (usage parse :554-559) |
| `src/lib/llm/providers/openai-compatible.ts` | `7953a3261a354af263e551da6c0f2d02` | 09-26 17:28 | K6#5 gap CONFIRMED live |
| `src/lib/llm/providers/registry.ts` | `?` | 09-26 18:14 | read-only this lane |
| `src/lib/llm.ts` | `bee7e62534fee3baab168e0c936e57fd` | 09-26 | K6#2 landed (LlmUsage + thinking) |
| `src/lib/llm-tasks.ts` | `1e84049a85c177533628f55b61b187ff` | 09-24 | no `model` on ok arms |
| `src/lib/llm-tasks.test.ts` | `1d594a64aef049aeb896cb31da41002b` | 09-06 | 4 ok-arm deepEqual pins |
| `src/lib/deepseek.server.test.ts` | `c1b8164663a8e28dc34b4669146e7f8f` | 09-26 | usage pin :389 |
| `src/lib/codegen.server.ts` | `e26da17f1531cbef4e64b748c8347e19` | 01:58 | stamp chain + prompt builders |

### K6's 6 handoffs — status at `ac6b151` (fresh verification)
| # | K6 handoff | status on entry |
|---|---|---|
| 1 | codegen `p6SynthesisChunkUserPrompt` prefix-cache reorder (static-first) | **OPEN** — order still BRIEF→REQUIREMENTS→**TYPE SIGNATURES (per-chunk)**→NEGATIVE→EDGE→DATA FLOW→ERROR HANDLING→CONTRACTS→earlier→lessons (`:1400-1447`) |
| 2 | engine `liveLayer` served-route stamp + `llm-tasks` `model` + K15 pins | **OPEN** — `engine.ts:2991 llmRan`, stamped `"deepseek-flash"` at :3020-3023 regardless of the served tier; `llm-tasks.ts` ok arms carry no `model` |
| 3 | cassette usage forwarding | **ALREADY LANDED** by W41 fins (`cassette.ts:311-321` forwards `cachedPromptTokens`/`cacheMissTokens` conditionally) — verified |
| 4 | codegen `accountSynthUsage` + crew/subagent hand-built spends | **OPEN** — `codegen.server.ts:2487-2490` records 2 keys only; token-ledger `recordSpend` merges CACHE_FIELDS automatically once present |
| 5 | openai-compatible cache parse | **OPEN** — body type `:365`, parse `:542-556` |
| 6 | canonicalize the flash request id to `deepseek-flash` | parent decision — deliberately NOT changed (`DEEPSEEK_MODELS.flash` stays the alias) |

### G3's remaining items — status on entry
| G3 item | status on entry |
|---|---|
| served-model stamp end-to-end (`modelRouteForServed` callers) | chain VERIFIED honest (single/chunked/partial all pass the provider's own `res.model`); residual: `modelRouteForServed:2760` uses `id.includes("pro")`, not registry ids |
| call tap installed on the REAL path | VERIFIED (run-eval install + gated fold + the W24/B2 wiring guard); tap record lacks the cache fields → provider half landed here, fold handed to Q4 |
| registry-ids-everywhere (no inline model strings) | `llm.ts:18` union derives from a literal — registry-derive it here; `engine.ts` / `headless.ts` route whitelists + `llm-tasks.ts` request ids remain inline (other live lanes / boundary-limited) |
| refusal texts carry the vendor message | messages VERIFIED; the `/insufficient balance/i` classify residual → fixed here (both providers) |
| 402/refusal vendor-text persistence | 160-char `refuse()` slice in codegen — handoff |
| streaming surface | honest limit VERIFIED (`stream:false`; README's "Shelled / in progress" row is honest) |

<!-- Q7-EOF -->
