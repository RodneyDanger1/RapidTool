# fixes/296_q1_a1tail.md — Q1 · §A1's DEFERRED FIVE + THE CLAMP-SITE RESIDUE (W41)

**Lane:** Q1 (W41 fleet; 12 lanes live). **Sources:** `fixes/291_k10_runtime.md` (deferred list) · §A1 `wave_plans/W34/code-notes.md` (cards A1-02/04/05/07/08/09/12/30/45).
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → rg FAILS; short one-liners). **HEAD:** `ac6b151`.
**Box (mine):** `src/lib/engine.ts` · `store.ts` · `checkpoint.server.ts` (+ the new tiny helper module this lane creates). NOT mine: packet.ts/crew* (P1) · headless.ts/wild-review.ts (handoffs) · console/ui · scripts.
**Contract:** verify each vs bytes FIRST (several may have moved since W40) · smallest honest patch per item · `node --check` per edited file · the relevant leg foreground · evidence line per row · additive only · `for <lane>` handoffs.

## t0 — state at lane start (byte reads, 2026-09-27 ~02:2x)

- `git status --short` → only `?? fixes/296_q8_ops.md` (Q8's log); product tree clean at HEAD `ac6b151`.
- mtimes: engine.ts 01:26 · store.ts 01:38 · checkpoint.server.ts 20:18 · headless.ts 20:10 · phases.ts 00:17 (all committed at/after the W41 commit, none dirty at t0).
- Sibling lanes P1–P4 + Q2–Q8 live → re-read target regions immediately before each patch.

## Verification table (appended per item; done-when from the §A1 cards)

| item | state at this read | evidence |
|---|---|---|
| A1-07 · `checkpointAdmits` phase sanity + `savedAt` | **LANDED (verify)** | checkpoint.server.ts:302-335 — integer phase in P0..PHASE_LAST, step>=0, id/mode match, returns `{ok:true, savedAt}` (L334) |
| A1-02 · writeCheckpoint throw outside try | pending read | |
| A1-04 · unvalidated run.mode written | pending read | |
| A1-05 · I/O misclassified as VALIDATION | pending read | |
| A1-08 · fixed-name .tmp staging | pending read | |
| A1-09 · minimal-read contract + hydrate pointer | pending read | |
| A1-12 · concatenated dynamic-import idiom | pending read | |
| A1-45 · sync/async mirror pairs | pending read | |
| A1-30 residue · clamp sites | pending read | |

## Ledger (append-only — file:line → finding → patch → evidence)
