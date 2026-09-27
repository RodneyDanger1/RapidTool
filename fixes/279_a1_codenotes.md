# 279 · A1 — THE RUNTIME-HALF CODE-NOTES (read-only)

**Lane:** W34b A1 — runtime-half analyst. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (space in path → `grep`, never ripgrep). HEAD observed at start: `0f85c32` + W29–W33 working-tree era (`store.ts` mtime 19:07, `scaffold.ts`/`headless.ts` 19:42–43 — sibling lanes live).
**Contract:** `wave_plans/W34/code-notes.md` (read in full at start; at first read it was 12 lines / 3178 B with **no marker yet**). Read-only across all of `src/**`; NEVER touched product code. Deliverable = §A1 appended to `wave_plans/W34/code-notes.md` + this log.
**Rules followed:** no test runs; no builds; no keyed calls; log-and-continue; every claim byte-checked by grep/read TODAY; re-read before EVERY append.

## Outcome
- **§A1 LANDED** — `wave_plans/W34/code-notes.md`: 47 findings (A1-01…A1-47) + the 15-rule FOR-THE-CODERS mini-guide + a verification appendix. 12 → **651 lines** / 3,178 → **77,459 B**.
- Coverage: checkpoint.server.ts (10 items, critical review — reader-throws-before-guard, write-outside-try, cap-comment false in both directions, unvalidated run.mode, RT_E_VALIDATION misuse ×2, admit-staleness, fixed-name .tmp race, reader type lie) · wild-review.ts (3) · store.ts (7) · engine.ts hydrate/stamp (9) · packet.ts (4) · dod/gate-stats (4) · rt-client/llm/registry (4) · cross-cutting sweeps (4) · + status note (checkpoint island).
- **Zero product-code modifications by this lane** (only `wave_plans/W34/code-notes.md` + this log were written). `git status -- src scripts` shows 61 entries, all pre-existing W29–W33 era edits from other lanes — byte-verified none are mine.

## Plan
- [x] Read contract + repo state (code-notes.md 12 lines / 3178 B / no marker at first read)
- [x] Read `src/lib/**` core: engine.ts (hydrate 2107-2539, attachAlgorithms, stamp/seal, wild seam refs) · store.ts (full, both halves) · phases.ts (full) · dod.ts (full) · packet.ts (full) · io.ts (full) · checkpoint.server.ts (full) · wild-review.ts (full) · types.ts (full) · errors.ts (full) · rt-client.ts (full) + rt-* refs · llm.ts (full) · llm/providers/registry.ts (callModel + ctor regions) · wild-mode.server.ts (classifier) · node-runner.server.ts · runtime-log.server.ts · compile-check.server.ts (head) · codegen.server.ts (head + catch sweep) · chat.server.ts (head) · verify.server.ts (head)
- [x] Critical review: checkpoint.server.ts · wild-review.ts · W29–W33 patch sites (W23b/W29/W30/W31/W33 comments cited by id)
- [x] Write §A1 (47 items, ①②③④ per item) + mini-guide
- [x] Append to `wave_plans/W34/code-notes.md` (re-read attempted immediately before; file reported **unchanged** since this lane's only prior read → appended §A1 block + the END-OF-FILE-MARKER-NOTES line as the new last line)
- [x] Two precision patches post-append (A1-44 store line-number list trimmed to byte-verified subset; mini-guide rule 15 de-slopped) — both re-read-verified

## Append evidence (post-append verification, 2026-09-26 ~20:05)
- `wc -l -c wave_plans/W34/code-notes.md` → **651 lines / 77,459 B** (was 12 / 3,178).
- `grep -n "END-OF-FILE-MARKER-NOTES" code-notes.md` → **2 hits**: L6 = the contract's own preamble sentence (pre-existing text, not a marker); **L651 = the marker comment, the file's LAST line** (verified by `tail -3`). Marker comment line is unique.
- §A1 header at **L16**, items A1-01…A1-47 in document order (grep count of `^## (✦ )?A1-` headers = **47**), mini-guide at L633; A1/A2 preamble lines (8–14) and the A2 description (L11) untouched.
- File md5 at close of append: `4351da2de2c0bc3539b7dcdd938c4318`.
- No sibling §A2 block present at close; marker left as the last line for A2 to append above.
- Product tree untouched: only writes were `wave_plans/W34/code-notes.md` and `fixes/279_a1_codenotes.md`.

## Key byte-checked evidence used (for the record)
- `grep -rn "writeCheckpoint|readCheckpoint|clearCheckpoint|checkpointAdmits" src scripts` (excl. module) → 0 hits (island, A1-47).
- `grep -rn "tooLargeToPersist" src scripts` → only io.ts:34 comment (A1-25).
- `grep -rn "slice(-200)"` → 30+ sites, 13 files (A1-44); store salvageTrim caps = 200/40 only vs CHECKPOINT_CAPS 5 fields (A1-03).
- `grep -rn "CHAT_LOG_MAX_ROWS" .` → comment-only, no definition (A1-20).
- engine early-return (L2525-2537) vs full repair-flag list (L2446-2459) — six flags missing (A1-21).
- rt-client.ts:676 `input.project?.logs.length` vs :682 `chatLog?.length` (A1-39).
- `git status --short` → `?? src/lib/checkpoint.server.ts`, `?? src/lib/wild-review.ts` (never committed).

## Log
- 19:34 — lane opened; contract read in full; this log created EARLY (per contract).
- 19:35–20:00 — extensive read pass (≈30 reads/greps; every quote re-verified; sibling-file mtimes checked; no product file written).
- 20:03 — §A1 appended above a newly-added END-OF-FILE-MARKER-NOTES line (file unchanged-since-read confirmed first).
- 20:05 — post-append verification (line/marker/md5/preamble checks above); two precision patches landed; this record closed.
- Issues encountered: (1) no marker existed at first read → added it as the new last line, documented here; (2) `grep -c "END-OF-FILE-MARKER-NOTES"` counts the preamble sentence too (L6) — the marker COMMENT is unique (L651); (3) store.ts/scaffold.ts/headless.ts mtimes moved during the pass (sibling lanes) → all quoted line numbers labelled at-read-time.
