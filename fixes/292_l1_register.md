# fixes/292_l1_register.md — W40 · LANE L1 · THE REGISTER/BOARD FINAL SWEEP

**Lane:** W40 L1 (`deleg_1eb6fe2b` task-0). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell grep only; keep one-liners SHORT).
**Mission:** verdict-map EVERY `§W27-WORKLIST` row (W-01…W-54 + WA-01…WA-04 + O-1…O-6) not demonstrably covered by the K/L waves or the N/Y/Z/B/Q/C waves: fix-small / verify-done / defer-with-TODO, each with byte evidence. The board's last word.
**Contract:** CODE + `node --check`; NO gates / keyed calls; smallest honest patch per row; log EARLY (this file), append after every batch; log `for <lane>` on files other lanes own; lower-ID wins on collisions.
**Baseline HEAD:** `2fa3cd9` (clean at lane start; live lanes K1–K15 + L2/L3 writing concurrently).

## Sources read at open

- `research/multiagent/thoroughanalysis.md` §W27-WORKLIST (lines 1113–1420: §W27-A…H + §R3/§R6/§R9/§R10/§R11/§R12 folds).
- `fixes/273_t1_register_rows.md` (T1's row verdicts) · `fixes/273_t3_r13.md` (T3's scope) · `fixes/278_p1_remainders.md` (the honest remainders list).
- `fixes/289_wd1_progress.md` · `fixes/289_wd2_verify.md` · `fixes/292_w1_recorder.md` (the live 18-lane map: K1–K15, L1–L3).
- `fixes/290_k2/k3/k4/k6/k7/k8` (landing as read) · `wave_plans/W38/NEW-SESSION-PROMPT.md` · `wave_plans/W37/master-pack.md`.

## Wave-coverage map (who owns which register rows) — established at open

| Wave | Scope | Register rows it demonstrably covers |
|---|---|---|
| E1b (W33) | `runP6Edge` seam + wild p6Edge + emit materialization | W-01 · W-02 · W-03 (RS-01 verified) |
| N1–N6 (W36–38) | rescue/checkpoint/UI/records/ops/pins | W-40 (module) · W-48 (engine) · W-09/W-10/W-17 (partial) |
| Y1–Y3 (W38–39) | model/runtime/agent layer | W-20-ish (verify) · W-25 partial · R10-f01 wire (Z2) |
| Z1–Z5 (W39) | boundary close · contracts · tinyfixes · records · runtime tail | Z3/Z5 item lists (→ K7 payout) |
| B1–B4/Q1–Q2/C1–C2 (W39) | components · persistence · scripts · backends · chat · deepseek | → K1–K6 payout |
| K1–K9 (W40) | finish B/Q/C/Z lanes + universality + records | W-14/W-15 (K9) · W-36? (hygiene) · doc rows |
| K10–K15 (W40) | §A1 runtime · §A2 periphery · §F2 governance · §F3/§F5 · §P2 cards · tests | W-19…W-33 partials · W-51/52/53 |
| L2 (W40) | R6 rows + S5 Part B + in-app help | W-29 rest · R6-f12 → WA-01 |
| L3 (W40) | eval/acceptance/observability | W-14/W-15 residuals · checkpoint visibility |

**Method:** every row below re-verified against CURRENT BYTES (grep/read at t≈01:00–01:40), never against a log's words. Rows whose fixing waves are still mid-flight are marked `[lane-flight]` with the byte state at check time; the verdict column says what bytes showed.

## Verdict map (t≈01:05 first pass — refined as bytes move)

_(appending row-by-row as verified)_

## Counts

_(final section, written at close)_

## [EXT-FAIL] / deviations

_(append)_
