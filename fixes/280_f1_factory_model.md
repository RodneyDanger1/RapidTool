# 280 · LANE F1 — THE MODEL PATH (W35 factory analysis · "how RapidTool talks to the AI")

Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash). HEAD `0f85c32` + the W29–W35 in-flight era.
Contract: `wave_plans/W35/factory-notes.md` §F1 (read in full). Card shape ① WHAT & WHERE · ② WHY IT'S WRONG ·
③ HOW TO FIX · ④ DONE-WHEN · ⑤ TRAPS. READ-ONLY on product code · no test runs · no builds · no keyed calls ·
log-and-continue. Append target: `wave_plans/W35/factory-notes.md` §F1 (above END-OF-FILE-MARKER-FACTORY,
re-read before EVERY append).

## Slice
`src/lib/llm/**` (providers/registry/failover/cassette/streaming seams) · `codegen.server.ts` synthesis chain
(prompts, chunking, `materializeImportableTree`, CJS-residue guard, partial semantics) · `token-ledger.ts` +
`synthWithBackoff` · `wild-review.ts` + reviewer path · `deepseek.server.ts` + `openai-compatible.ts` ·
redaction · model-id routing.

## Recon at lane start (t0)
- `wave_plans/W34/prep.md` + `code-notes.md` contain **charters only** (no §P2/§A1 append bytes at t0) →
  nothing to dedupe against yet; **re-checked at every append** (they may land beside me).
- `fixes/276_f1_real_autonomy.md` is the W33 lane that landed wild-review.ts + the S2 universality items —
  read for what those items already fixed (per-item dedupe).
- Slice census: `src/lib/llm/providers/{registry.ts 35085B, openai-compatible.ts 24578B, deepseek.ts 28115B,
  probe.ts, mock.ts, registry.test.ts, registry-failover.test.ts, mock.test.ts}` · `src/lib/{llm.ts,
  llm-tasks.ts, codegen.server.ts 3543L, token-ledger.ts 530L, wild-review.ts 114L, deepseek.server.ts 42L}`.

## Status board (as-landed)
| Item | Files | State | Proof |
|---|---|---|---|
| Recon + read contract | — | done | W35/factory-notes.md read in full |
| Card F1-01 … F1-nn | — | in progress | — |

## Log
- (t0) Lane start. Read `wave_plans/W35/factory-notes.md` full + W34 prep/code-notes (charters only) +
  `fixes/276_f1_real_autonomy.md` (W33 F1 precedent). Wrote this log early.
- (t0) File census + first byte reads of the llm/providers layer.

## What remains (to fill at the end)
- (filled as cards land)
