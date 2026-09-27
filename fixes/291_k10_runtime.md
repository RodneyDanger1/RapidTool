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

_(written at close)_
