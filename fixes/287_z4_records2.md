# fixes/287_z4_records2.md — Z4 · THE RECORDS FINISHER (W39 lane Z4)

**Lane:** W39 Z4 — doc-only records finish. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash).
**Task:** finish every owed record — paste missing `finalsprint.md` sections (§T1–§T5 / §WDX-2 / §WDX-3 / §MASTER-CORRECTIONS w/ F3's CF-4), §A2 → `wave_plans/W34/code-notes.md`, §P2 → `wave_plans/W34/prep.md`, §F3–§F5 → `wave_plans/W35/factory-notes.md`; append G-lane maps (G1 → `fixes/284_wiring_guarantee.md`; G2/G4 status tables → `fixes/285_g2_agent_visibility.md`, `fixes/285_g4_operator_visibility.md`); create `fixes/283_final_ledger.md`; log `fixes/287_z4_records2.md`.
**Constraints:** DOC-ONLY; no product code; no tests/gates/keyed calls; append-only above each END-MARKER; re-read before EVERY append; `finalsprint.md` misdetects as binary → use terminal grep/tail/sed.

**Started:** 2026-09-27 (W39).

## STATE AT LANE START (verified reads)

- `finalsprint.md` (262 lines): live sections = §S1–§S4 placeholders, §WDX-1, §S5 (`:244`). **NOT live at start: §T1–§T5 · §WDX-2 · §WDX-3 · §MASTER-CORRECTIONS → all owed (this lane).** Marker `END-OF-FILE-MARKER-SPRINT` intact as last line.
- `fixes/281_n4_records.md`: skeleton only (no pastes landed — its "PASTE LOG" is `_(pending)_`).
- Owning source docs on disk: `fixes/273_t1_register_rows.md` (7,806 B) · `273_t2_r15.md` (4,229 B) · `273_t3_r13.md` (3,338 B) · `273_t4_defined.md` (6,282 B) · `273_t5_board.md` (15,648 B) · `274_wdx2.md` (9,389 B) · `274_wdx3.md` (3,328 B).
- Delegation summaries for the remaining pastes verified present in `~/AppData/Local/hermes/cache/delegation/`: §A2 `-1-195032_506645.txt` · §P2 `-1-194745_119606.txt` · §F3/F4/F5 `-2-195114_772471.txt` / `-3-...773501.txt` / `-4-...775540.txt` · G1 `-0-203728_538352.txt` · G2 `-1-203820_899655.txt` · G4 `-2-203820_900651.txt`.
- G-targets: `fixes/284_wiring_guarantee.md` (3,342 B) · `fixes/285_g2_agent_visibility.md` (3,046 B) · `fixes/285_g4_operator_visibility.md` (1,732 B). `fixes/283_final_ledger.md` does NOT exist yet → to create.

## PASTE LOG (append per paste; evidence = command + observed output)

_(starting — pastes logged as they land)_
