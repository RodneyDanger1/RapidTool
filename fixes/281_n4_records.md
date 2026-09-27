# fixes/281_n4_records.md — N4 · THE RECORDS CONSOLIDATOR (W36 lane N4)

**Lane:** W36 N4 — doc-only records consolidation. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`, HEAD `0f85c32` + W29–W36 uncommitted era.
**Task (from `wave_plans/W36/completion.md` §N4):** paste EVERY owed section VERBATIM into `finalsprint.md` (above `<!-- END-OF-FILE-MARKER-SPRINT … -->`), `wave_plans/W35/factory-notes.md` (above END-OF-FILE-MARKER-FACTORY), `wave_plans/W34/code-notes.md` (above END-OF-FILE-MARKER-NOTES), `wave_plans/W34/prep.md` (above END-OF-FILE-MARKER-PREP) + §MASTER-CORRECTIONS + fix the binary control byte. Doc-only; NO product code; NO full gates; NO keyed calls. Re-read before EVERY append.
**Started:** 2026-09-26 ~19:55 CDT.

## STATE AT LANE START (verified reads)

- **Targets inspected (grep, 19:5x):**
  - `finalsprint.md` — markers live at `:244` (`<!-- END-OF-FILE-MARKER-SPRINT · every lane appends ABOVE this line · never edit or delete this line -->` = last line). Sections live: §S1–§S4 headers (pending placeholders from creation), §WDX-1 only. **§T1–§T5 / §WDX-2 / §WDX-3 / §MASTER-CORRECTIONS / §S5 = NOT live → owed.**
  - `wave_plans/W35/factory-notes.md` — marker at `:22`; §F1–§F5 NOT live (only the protocol note at `:4`).
  - `wave_plans/W34/code-notes.md` — marker at `:651`; §A1 live (`:16`), §A2 NOT live.
  - `wave_plans/W34/prep.md` — marker at `:191`; §P1 (`:20`) + §P3 (`:71`) live; §P2 NOT live.
- **Sources verified on disk (`wc -c`):** `fixes/273_t1_register_rows.md` 7,806 B · `273_t2_r15.md` 4,229 B · `273_t3_r13.md` 3,338 B · `273_t4_defined.md` 6,282 B · `273_t5_board.md` 15,648 B · `274_wdx2.md` 9,389 B · `274_wdx3.md` 3,328 B.
- **Delegation summaries verified (`ls ~/AppData/Local/hermes/cache/delegation/`):** `subagent-summary-0..4-20260926_195114_767464/772471/773501/775540.txt` (14,214 / 9,898 / 11,769 / 8,003 / 6,733 B) → §F1–§F5 · `subagent-summary-1-20260926_195032_506645.txt` (10,525 B) → §A2 · `subagent-summary-1-20260926_194745_119606.txt` (10,745 B) → §P2.

## BINARY-BYTE FIX

_(finding + fix pending — hunting the control byte)_

## PASTE LOG (append per paste; evidence = command + observed output)

_(pending — starting pastes)_
