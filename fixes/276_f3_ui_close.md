# fixes/276_f3_ui_close.md — W33 · LANE F3 — MAKE THE UI SURFACING REAL + CLOSE THE REDS + LAND THE RECORDS

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD:** `0f85c32` + ~2,700 uncommitted insertions (W29–W32 era).
**Box:** `src/components/console.tsx` (additive UI only — re-read before EVERY edit) · `scripts/rapidtool-cli.mjs` E-25 red · `src/lib/headless.test.ts` red if F1 hasn't fixed it · `finalsprint.md` (append-only, above the END-OF-FILE-MARKER-SPRINT) · this log.
**Rules:** smallest honest patches · additive only · `TODO(<row-id>)` at the gap · no fake behavior (disabled+reason in `title` is honest; an enabled no-op is not) · targeted checks only · NO full gates · NO keyed calls · log-and-continue · re-read finalsprint.md before EVERY append.

## [t0] Lane start — mandatory reads

- `wave_plans/W33/unlanded-block.md` (this lane = U3+U4 fused, upgraded to REAL) ✓
- `fixes/272_s5_finish_ui.md` (S5's plan: the 6 surfaces) ✓
- `finalsprint.md` (244 lines / 44,412 B): only §WDX-1 is live; master table intact; marker `END-OF-FILE-MARKER-SPRINT` = last line. **§S1–§S5 placeholders still `_(pending)_`; §T1–§T5, §WDX-2, §WDX-3 NOT LANDED → all owed to me.**
- `START-HERE.md` (the W32 wayfinding doc; hard rules = no full gates, no keyed calls, no keyed LLM, don't move files) ✓
- §R6 worklist in `research/multiagent/thoroughanalysis.md:1370-1378` (the UI worklist) ✓

## [t0] F1-availability probe (W33 concurrent lane)

- `src/lib/checkpoint.server.ts` — **NOT ON DISK** (ls fails).
- `engine.readWildPlan` — **NOT on disk** (grep: only the two doc-comment mentions in `types.ts:163/:429`).
- `scripts/unattended-shell.mjs` + CLI `resume`/`unattended` verbs — **NOT on disk** (grep: only a comment at CLI :577).
- Landed by earlier lanes and usable NOW: `errors.ts` carries `RT_E_UNATTENDED_UNSUPPORTED` / `RT_E_CHECKPOINT_MISSING` / `RT_E_NOT_IMPLEMENTED`; `types.ts:172-183` defines `WildPlan`/`WildPlanStep`; `types.ts:433` `wildPlan?: WildPlan | null`; `wild-review.ts` (5,712 B).
- **Decision:** code against the DOCUMENTED shapes (`WildPlan` type + `project.wildPlan` field + the error codes), and coordinate via a `for F1` note in this log + a `TODO(R13-f02)`/`TODO(T-107.7)` marker at the exact UI gap. No imports of not-yet-existing modules (that would break typecheck).

## [t0] Ongoing log (append-only)

