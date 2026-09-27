# 278 · P3 — THE NEXT-WAVE SHAPE + RISK/DEPENDENCY MAP (lane log)

**Started:** 19:32 CDT 2026-09-26 · **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`
**Mode:** READ-ONLY on product code · no test runs · no builds · no keyed calls · append-only where noted.
**Deliverable:** §P3 appended to `wave_plans/W34/prep.md` (above the END-OF-FILE-MARKER-PREP) — **DONE 19:48**, marker intact = last line.

## Timeline / log

- (t0 19:32) Read `wave_plans/W34/prep.md` in full → §P1/§P2 **not landed** at t0 (18-line brief only; no `fixes/277_*`, no `278_p*` siblings). Wrote this log EARLY.
- (t0) `git log`: HEAD `0f85c32` + 111 modified paths uncommitted. No 277/278 lane logs on disk.
- (t1 19:33–19:39) Sources read in full: `START-HERE.md` · `finalsprint.md` (via terminal — UTF-8/very-long-lines; read_file flags binary) · `fixes/274_wdx2.md` · `fixes/276_f1/f2/f3` · `research/multiagent/thoroughanalysis.md` (§W27-WORKLIST 1113-1361 + §W27-D/E/F/G/H + WD-δ additions 1388-1421 + §R3/§R6/§R9/§R11/§R10/§R12 + §R8 671-739 + §R13/§R14 refs).
- (t2 19:33–19:47) THE REDS, byte-verified (captures read: `%TEMP%/f3_headless.log` 19:06 · `%TEMP%/f2_e25.log` 19:06 · `%TEMP%/f2_edit.log` 19:08 · product bytes `scripts/rapidtool-cli.mjs` · tests `src/lib/headless.test.ts` · `scripts/rapidtool-cli-edit.test.mjs`):
  - **E-25 red = 2 stale pins, both since re-pointed** — ① `CLI: --i-am-human WITH the out-of-band token records the human seat (exit 0)` → rewritten 19:06:58 → `headless.test.ts:1608`; ② `CLI — an approve landed by the CLI carries the provenance on the row it mints` → rewritten 19:39:11 → `headless.test.ts:1753` ("mints NO row"). Product = per spec R5-f12 Track-1 (`rapidtool-cli.mjs:579-586`, `:3408-3422` humanSeatClaim, `:615-621` refusal RT_E_VALIDATION/exit 1). Asserted strings all present in product bytes → EXPECTED GREEN, confidence HIGH; no capture newer than 19:06 → **must re-run** (require `ok N` lines — 262 doctrine).
  - **W-02 keyless-floor parity leaf** (in the `fixes/144 M4-2` suite): 19:06 diff = exactly 5 volatile hunks (packet compiled_at text+JSON · phases[6].startedAt/completedAt · traces[].ranAt); `stripVolatiles` at `headless.test.ts:627-656` masks exactly those → EXPECTED GREEN, confidence MEDIUM-HIGH.
  - **edit-test (not in parent's count): 7/10 @19:08** — `:300`/`:327`/`:401` pins unwinnable post-two-channel; mtime Sep 17 → STILL RED, confidence HIGH.
  - **typecheck CF-2**: exit 2 @18:12:28, un-re-verified since → UNKNOWN.
- (t3 19:39–19:45) Fresh fleet read: `fixes/277_l1_universality.md` (board 9/9 DONE — **ahead of bytes**: at 19:41 `scaffold.ts` still webapp-only vite.config `:2633`, no bin/exports/files; file churned again 19:45:00) · `277_l2_integration.md` (C1–C4 all in-progress: checkpoint integration/resume/unattended/readWildPlan; CLI still 37 verbs at 19:44) · `277_l3_ui_records.md` (E-25 evidence chain + "CLI per spec, pins stale" verdict — concurred independently; RunScreen unwrapped; no invented codes) · `wave_plans/W35/factory-notes.md` + `fixes/280_f1/f2/f4/f5` + `279_a1/a2` (W35 = 5 ANALYSIS lanes live; F3's log not yet on disk) · `wave_plans/W34/code-notes.md` appeared 19:34.
- (t4 19:43–19:47) Commit-shape census: `git status` = 65 M + 58 ?? (incl. `.t4scratch/`, `_f1_headless.log` 222,917 B, `_el217g*/_tc217g*` logs at root). AGENTS.md = CLEAN vs HEAD despite the V33/T2 "M AGENTS.md" claim. `scripts/cli-exit-taxonomy.test.mjs` cited by CLI comments but ABSENT. Boundary leg counts sanity-grepped: errors 37 · wild-step 14 · registry 40 · honesty-guards 13 · README-cli 13 `test(` · run-eval 39 `test(` (parent's 12/35 are the last TAP-observed counts — re-derive at boundary).
- (t5 19:46–19:48) §P1 landed into prep.md (P1's own append, ~19:44-19:46). Re-read prep.md in full (15,313 B; §P1 present; §P2 absent) → appended **§P3** above the marker (patch; marker intact). Sibling edit to prep.md observed at 19:45:16 (P1 amending) — no collision; my block landed 19:48. Typo fix "STSANDING"→"STANDING" applied to my own block 19:49.

## What §P3 contains (pointer)

§P3.1 reds' current truth (this log) · §P3.2 the lane cut (C1 autonomy close · C2 pipeline honesty · C3 output factory · C4 UI surfacing · C5 records+docs scribe; disjoint file boxes) · §P3.3 order (freeze → typecheck/lint → reds → L-gaps → scribe → boundary → commit) · §P3.4 boundary load (11 exact legs + the E-25 filtered leg + gate.sh; known reds) · §P3.5 blockers (O-1/O-4 · AGENTS.md consent ×2 · R13-f04 host · NEW: missing taxonomy guard, W35 dedupe, hermes-verify format trap, root hygiene) · §P3.6 commit shape + message skeleton · §P3.7 THE RECOMMENDED DISPATCH (5 lanes, verbatim).

## Notebook / caveats

- §P2 was NOT on disk at my append; §P3 = §P1 + my byte reads. If §P2 lands after, the lane cut (§P3.2) is file-stable — only card text would refine.
- L1/L2/L3 were mid-landing through the whole read (headless.ts 19:44:32 · scaffold.ts 19:45:00); everything "[L# flight]" must be re-read at the next boundary (bytes > boards — L1 ahead-of-bytes again).
- All counts quoted in §P3 are "last observed" with their capture path; none were produced by running anything in this lane.
