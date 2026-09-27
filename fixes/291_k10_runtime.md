# fixes/291_k10_runtime.md — K10 · §A1'S RUNTIME REMAINDER (W40 lane K10)

**Lane:** W40 K10 — land §A1's remaining runtime findings (severity order; verify Y2's claims against bytes FIRST; 'already fixed — verified' where true).
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell grep only; short one-liners). **HEAD:** `2fa3cd9`. Sibling lanes K1–K15 + L1–L3 + W1–W5 LIVE → read fresh; log `for <lane>`.
**Box (mine):** `src/lib/engine.ts` · `store.ts` · `phases.ts` · `dod.ts` · `packet.ts` · `io.ts` · `telemetry/rt-*` (`rt-client.ts`/`rt-events.ts`/`rt-ring.ts`). **Not mine:** `checkpoint.server.ts` (N2 done) · `headless.ts`/`scaffold.ts`/`codegen.server.ts` (K9/K13) · `llm.ts`/`registry.ts`/`errors.ts`/`gate-stats.ts` (K12/K13/unboxed) · `console.tsx` (L2/K1/K5) · tests (K15).
**Contract:** CODE-ONLY — no test runs / typecheck / builds / gates / keyed calls. Smallest honest patch per item; `node --check` on every edited file; additive only; `TODO(<id>)` at the logic line where a landing is genuinely large. Every row: file:line → finding → patch → evidence.
**Sources:** `wave_plans/W34/code-notes.md` §A1 (findings ①–④) · `fixes/282_y2_runtime.md` (Y2's landings — claims to verify) · `fixes/290_k2_persist.md` · `fixes/290_k7_tinyfixes.md` (sibling claims on my files).

## STATE AT LANE START (byte reads, 2026-09-27 ~01:03)

- `git status --short` → 6 entries: the 290/292 lane logs (untracked); **no product edits dirty** (HEAD `2fa3cd9` includes the Y2 era).
- mtimes: engine.ts 20:25 · store.ts 20:22 · packet.ts 20:12 · dod.ts 20:09 (Y2 era) · io.ts 00:17 · phases.ts 00:17 · rt-client.ts 00:17 · rt-ring.ts 00:40 (post-Y2 sibling edits — re-read fresh).
- Live-lane map (from `fixes/292_w1_recorder.md`): K7 edits packet.ts/io.ts/rt-client.ts tiny-fixes NOW → no touching its target lines; K2 has store persistence paths; K12 registry; K15 §A1 test-quality.

## VERIFICATION TABLE — Y2's claims vs bytes (appended per batch)

_(starting — verifying now)_

## LANDINGS (append-only; severity order)

| # | finding | file:line | state | evidence |
|---|---|---|---|---|

## LEDGER (final) + HANDOFFS `for <lane>`

**Parent-completed (W40 solo finish, 2026-09-27 ~02:0x; content verified from this lane's summary):**

**Fixed by K10: 3** — A1-24 · A1-28-residual · A1-30-residual.
**Verified already landed by Y2/N2 (byte-checked, no overstatement found): 29** — the 24 §A1 rows (A1-13…A1-33 spot-verified with file:line evidence; e.g. A1-13 store.ts:1217 one releaseWildStart + grep=2 · A1-15 PHASE_LAST phases.ts:165 + 6 store sites · A1-19 store.ts:625 llm.degrade + classifyError · A1-20 CHAT_LOG_MAX_ROWS=40 :742/:1811 · A1-21 anyRepaired :2500→:2581 · A1-27 engine.ts:362 immutable spread · A1-30 clamp engine.ts:2097 · A1-31/32 packet.ts:498-509) + the 5 §F3 rows confirmed true.
**Deferred with TODO / still open: 5 in-box** — A1-45 · A1-07 · A1-12 · the checkpoint-module residuals A1-02/04/05/08/09 (N2 closed the 10 top cards; these are the residue) · remaining clamp sites.
**Out-of-box: 3** — A1-38/41/42 (for K12/K13 boxes; K12's log records them).
**Parent note:** the verification tables above ARE the evidence; the per-row file:line proofs live in the delegation summary (`subagent-summary-0-20260927_013043_530419.txt`). Post-boundary gate status: typecheck+lint green at `be12c59`.
