# W31 · THE GAP-FINISHERS — 5 builder-analysts + 3 watchdogs. All findings/sections into `finalsprint.md`.

**All readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`).
**WHO ELSE IS LIVE:** lanes S1–S5 (the W30 shell sprint — `wave_plans/W30/shell-sprint.md`; their appends are §S1–§S5 in `finalsprint.md`) may still be running — READ FRESH before editing any shared file; never touch a file another lane is visibly mid-editing (record "for <lane>" in your log instead).
**THE JOB (builders):** "other things RapidTool will need" — ANALYZE first (carefully, sequentially: read the register, the board, the code), THEN land what is safely landable with the smallest honest patches, THEN record everything. Think like the mission: a truly autonomous software factory / best-in-class harness. The SHELL CONTRACT from W30 applies verbatim: compiles · wired to ≥1 real call site OR honest coded refusal · `TODO(<id>)` at the exact logic line · NO fake behavior · additive only.
**READ FIRST:** `finalsprint.md` (the master table — what's already shelled/needed) · `wave_plans/W30/shell-sprint.md` (the contract) · `research/multiagent/thoroughanalysis.md` (the register: §W27-A..H + §R1–R15 — find YOUR rows) · AGENTS.md.
**RECORD (builders):** lane log `fixes/273_t<n>_*.md` EARLY → then APPEND your section (§T1–§T5) to `finalsprint.md` above the END-OF-FILE-MARKER-SPRINT (append-only; RE-READ before every append — many writers; never edit another section). Each entry: what · files+lines · seam/call-site or refusal · TODO markers placed · ANALYSIS: what's still needed after and why (1-2 lines each, in great detail).
**RULES:** targeted checks only (NO full gates — the boundary follows the waves); NO keyed calls; log-and-continue ([EXT-FAIL] + keep moving); no removals; no fake wiring.

## T1 — THE REGISTER'S UNTOUCHED ROWS
Sweep §W27-B/C/D rows for those with NO lane reference yet (grep the section text for lane names/T-ids; compare vs S1–S5's appends). For each: verify current state in the code (has a sibling already landed it? — check bytes), then land the safe ones (smallest patch) or record the precise reason it must wait. Deliver: §T1 with a per-row verdict table (LANDED-BY-ME / ALREADY-DONE / FOR-LANE-X / OWNER / BLOCKED + why). Highest-value first: the rows feeding the keyed run.

## T2 — R15's EVERYTHING-ELSE (14 rows, no lane owns them)
Read §R15 in full. Analyze each finding against today's bytes (configs, the tsconfig chain, migrations recursion + the `account` index, dependency hygiene, i18n, a11y, logging, versioning, backups, the og manifest). Land the safe ones (e.g. the migration recursion fix, the unique index, config hygiene) with evidence; record the rest with exact needed-after notes. Deliver: §T2.

## T3 — R13's REMAINING BEST-IN-WORLD ROWS (f05→f15, minus S1/S3's coverage)
Read §R13 + §R8's tail. For every row NOT already shelled or landed by S1/S3/S5: analyze the smallest complete design per the register, land the shell where safe (per the contract), record the rest. These are the "best of its kind" differentiators — be precise about what each unlocks. Deliver: §T3.

## T4 — THE DEFINED SPECS (249_define_first_specs.md)
Read `research/multiagent/249_define_first_specs.md` (DF-09 check DEFINED · T4.3 preservation probe · G4 scan+runner). Implement each per its spec: shells first (compiles + wired/refusal + TODO), with the spec's own pins as the done-when. DF-09 is RED-by-design — keep that honest. Deliver: §T4.

## T5 — THE OV BOARD SWEEP (the preserved task list)
For every pending board item (ov1/ov13/ov29/ov16/ov41/ov30/ov20/ov3/ov5/ov4/ov11/ov38/ov39/ov40/f2/f4/f1/ov7/t1077/t51/t57/df09/t43/g4...): assess against today's bytes — LANDED / SHELLED (by whom) / SAFE-TO-LAND-NOW / BLOCKED (on what) / OWNER. Land the safe ones; update nothing destructively. Deliver: §T5 with the board-wide verdict table (this becomes the honest completion map).

---
## THE WATCHDOGS (3 of the 8) — monitor · verify · wire
**READ FIRST:** `wave_plans/W30/shell-sprint.md` + the `thoroughaction.md` protocol (§WD-1..7 style: append-above-marker, re-read before EVERY append, record shape = timestamp · actor · action · files · the why in the actor's own words). Sections §WDX-1/2/3 in `finalsprint.md` (append-only; re-read first; never edit others).

### WDX-1 · the lane watcher
Poll the 5 builder lanes (≥5×, ~90s; find their transcripts under `~/AppData/Local/hermes/cache/delegation/live/` — newest deleg dirs) + a sweep of the still-live S-lanes. Verify ≥10 claims against the actual bytes (not the logs' words); box-enforcement; flag silent lanes; counter-findings welcome. Record every row into §WDX-1.

### WDX-2 · THE TRUTH AUDITOR of the sprint md files
Your sole deliverable: **verify `finalsprint.md`'s every entry is TRUE and COMPLETE** — for each §S/§T claim: does the seam exist at the claimed line? is the status honest (SHELL vs LANDED vs TODO)? do the TODO markers actually sit where claimed? is the "needed after" column accurate and detailed enough for a coder to act? ZERO false statements allowed: anything overstated → a correction row; anything missing → an addition row; anything vague → the specifics. Check the marker protocol held (append-only, 0 obliteration — diff the file's sections against their last-known states where evidence exists). Deliver: §WDX-2 = the audit report (per-entry verdict + corrections/additions) — this is the document's integrity guarantee.

### WDX-3 · THE WIRING HELPER
Hunt for shells that are ONE WIRE away from working (a defined function with no caller, a guard that just needs the flag passed, a refusal that could be the real path safely). For each: land the wire (smallest additive patch, honest, with a targeted check) or write the exact 3-line wire instruction into §WDX-3 under "for the next wave". Do NOT fake capability — a wire that turns an honest refusal into a fake success is the one thing forbidden. Log every wire: file+line · before → after · proof.
