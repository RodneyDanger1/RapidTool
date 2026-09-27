# fixes/290_k8_records.md — K8 · Z4'S PAYOUT — THE RECORDS + THE CONTINUATION PROMPT (W40 lane K8)

**Lane:** W40 K8 — finish the records Z4/WD-3 died before landing + write the fresh-session continuation prompt.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash). **HEAD:** `2fa3cd9` (clean tree at lane start).
**Box:** DOC-ONLY + ONE `scripts/**` creation allowed (none needed unless noted); no product edits; no gates/keyed calls/full runs; append-only above each END-MARKER; re-read every marker before every append.
**Log discipline:** this file lands EARLY and is appended after every paste batch (evidence = command + observed output).

## STATE AT LANE START (verified reads, 2026-09-27)

- `git status --short` → empty (clean) · `git log --oneline -1` → `2fa3cd9 W29-W39: the completion era — spine real, gates registered green`.
- `finalsprint.md` (262 lines, 48,371 B): live = §S1–§S4 shells (`:34–:43`), §WDX-1 (`:49–:243`), §S5 (`:244`). **NOT live → OWED (this lane): §T1 · §T2 · §T3 · §T4 · §T5 · §WDX-2 · §WDX-3 · §MASTER-CORRECTIONS.** Marker `END-OF-FILE-MARKER-SPRINT` intact = line 262 (last line).
- `wave_plans/W34/code-notes.md` (651 lines): §A1 live; **§A2 NOT live → OWED**. Marker `-NOTES` intact = line 651 (last).
- `wave_plans/W34/prep.md` (191 lines): §P1 + §P3 live; **§P2 NOT live → OWED**. Marker `-PREP` intact = line 191 (last).
- `wave_plans/W35/factory-notes.md` (34 lines): lane briefs F1–F5 + §Y1 live (Z2's append). **§F3 · §F4 · §F5 NOT live → OWED** (check §F1/§F2 non-dup first: Z2's §Y1 block covers the F1/Y1 record). Marker `-FACTORY` intact = line 34 (last).
- `fixes/287_z4_records2.md` = lane-start matrix ONLY (paste log `_(starting)_` — Z4 did NOT land pastes; its "verified matrix" = the source/section inventory this lane executes).
- `fixes/283_final_ledger.md` does NOT exist → to create (this lane).
- `wave_plans/W40/` does NOT exist → to create (this lane: CONTINUE-PROMPT.md).
- Sources on disk (sizes re-verified): `273_t1_register_rows.md` 7,806 B · `273_t2_r15.md` 4,229 B · `273_t3_r13.md` 3,338 B · `273_t4_defined.md` 6,282 B · `273_t5_board.md` 15,648 B · `274_wdx2.md` 9,389 B · `274_wdx3.md` 3,328 B.
- Delegation summaries present: §A2 `-1-195032_506645.txt` · §P2 `-1-194745_119606.txt` · §F3/F4/F5 `-2-195114_772471.txt` / `-3-…773501.txt` / `-4-…775540.txt` · G1 `-0-203728_538352.txt` · G2 `-1-203820_899655.txt` · G4 `-2-203820_900651.txt` (all under `~/AppData/Local/hermes/cache/delegation/`).
- Handoff sources for part B: `fixes/289_wd3_handoff.md` · `fixes/289_wd1_progress.md` · `fixes/289_wd2_verify.md` (plus read-at-write-time K1–K9 logs + W38's `NEW-SESSION-PROMPT.md` as the shape precedent).

## PASTE LOG (append per paste; evidence = command + observed output)

_(starting — pastes logged as they land)_
