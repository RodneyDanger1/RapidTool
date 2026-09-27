# fixes/277_l3_ui_records.md — W33 · LANE L3 (fused U3+U4) — THE UI SURFACING (REAL) + THE E-25 FIX + THE RECORD PASTES

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD:** `0f85c32` + the W29–W33 uncommitted era. Lane start ~19:10 CDT.
**Box:** `src/components/console.tsx` (additive only, never remove a control) · `src/routes/**` if needed · `src/lib/headless.test.ts` E-25 red (deliverable B) · `scripts/rapidtool-cli-edit.test.mjs` (same-drift extension, see [t0 #3]) · `finalsprint.md` (append-only above the END marker) · this log.
**Rules honored:** CODE ONLY — no test runs, no typecheck, no builds, no gates, no keyed calls · smallest honest patches · `TODO(<id>)` at the exact gap · disabled+reason in `title` is honest, an enabled no-op is not · re-read every target file's region immediately before its patch · finalsprint re-read before EVERY append · log-and-continue.

## [t0 ~19:10] Mandatory reads + probes

- Read: `wave_plans/W33/unlanded-block.md` (my rows = U3 + U4) · `fixes/276_f3_ui_close.md` (t0 probe; F3 log is thin — box + the F1-availability probe) · `fixes/276_f2_integrator.md` (A1–A14 + CW-1..6 audit table) · `fixes/276_f1_real_autonomy.md` (sibling boxes; A4 `readWildPlan` = in progress) · `finalsprint.md` (structure via `grep`: master table :9–33; §S1–§S4 + §S5 placeholders `_(pending)_` :34–44; §WDX-1 :49–242; marker = :244) · `fixes/272_s5_finish_ui.md` (the 6 surfaces) · §R6 worklist region (F3's log points at `thoroughanalysis.md:1370-1378`).
- **finalsprint.md reader note:** the read tool reports it "binary" (a stray control byte somewhere in 44,412 B); all reads/writes done via `grep`/`tail`/patch-tool appends instead. Never edit its existing lines; append above the marker only.

## [t0] Deliverable B — E-25 evidence chain (authoritative, then the verdict)

**The reds (authoritative):** `fixes/276_f2_integrator.md` row A12 (`headless.test.ts` 3 reds: keyless parity · M4-2 driveP6Journey · E-25) + F2's own leg capture at `%TEMP%/f2_e25.log` (2026-09-26 19:06, 11,421 B) — the E-25 suite fails **2 subtests**:
1. `CLI: --i-am-human WITH the out-of-band token records the human seat (exit 0)` — `the keyed human seat path must succeed` → `1 !== 0`.
2. `CLI — an approve landed by the CLI carries the provenance on the row it mints` — `CLI approve must succeed` → `1 !== 0`.

Also on disk: `%TEMP%/wdx3_headless2.log` (WDX-3's 93/96 capture, 18:19) names the same 3-failure class (CF-3).

**The drift (bytes, not logs):** `scripts/rapidtool-cli.mjs` (uncommitted era; mtime 18:12, `git diff` shows the hunks as additions vs `0f85c32`) implements the **R5-f12 Track-1 two-channel seat** (`humanSeatClaim`, :3408–3423): Channel A = `RT_HUMAN_SEAT_TOKEN` env (claim), Channel B = an interactive TTY re-entry; **a non-TTY `--i-am-human` is REFUSED outright** (exit 1, `RT_E_VALIDATION`) because no second channel exists. The spec is explicit (`research/multiagent/thoroughanalysis.md:869-877`): Track 1 recommended; "Non-TTY … REFUSE the human seat by default (exit 1, message pointing at the autopilot gate)"; and — decisive — `:870`: "Tests pinning today's behavior: `rapidtool-cli-edit.test.mjs:300-330` … and `:401-427` … **both must be re-pointed with whichever track lands**." The TTY positive path is manual-only by design (`:877`: "a TTY cannot be faked from the agent — that is the point").
**Verdict: the CLI is per spec; the PINS are the stale side.** The two headless subtests (and the edit-file's 3 same-class cases) still pin the pre-two-channel (vacuous: "env var non-empty" ⇒ human) behavior — the very hole R5-f12 closed ("it must never be VACUOUS again", CLI :3378). Re-point the pins to the landed contract; do NOT reopen the hole. (Also: the CLI comment cites a `scripts/cli-exit-taxonomy.test.mjs` static guard that is NOT on disk — noted, not my row.)

**Extension (#3):** `scripts/rapidtool-cli-edit.test.mjs` (Sep 17; scripts leg last full run = W12) carries 3 cases that CANNOT pass post-Track-1 (statically reasoned, not run): `:300` & `:327` (expect `j.policy.decision === "deny"`; the two-channel refusal fires before the seam ⇒ no `policy` field) and `:401` (expects non-TTY token path to WRITE, status 0). Same drift, same spec sentence ⇒ re-pointed in this lane (deliverable B extension).

## [t0] Deliverable A — the live UI state (bytes)

- `PaneBoundary` EXISTS (`console.tsx:1642-1691`, emits `ui.pane_crash` via `reportRt`); **HomeScreen wrapped** (:1745–1846); **RunScreen NOT wrapped** (single `<PaneBoundary` hit at :1745; `markBoundaryError` dedupe NOT applied in `componentDidCatch` — S4's `fixes/272_s4_floor.md` §3 says re-apply both hunks if clobbered ⇒ re-applying).
- Plan/checkpoint/unattended/stream/cassette: **zero hits** in console.tsx (F2 A11 confirmed; re-grepped). `Project.wildPlan?: WildPlan | null` IS typed (`types.ts:433`; `WildPlan` :172–183) ⇒ the plan surface can read it today, defensively.
- `RT_E_UNATTENDED_UNSUPPORTED` + `RT_E_CHECKPOINT_MISSING` ARE in `errors.ts` (:79–81, :508+) ⇒ usable in titles. **`RT_E_HUMAN_SEAT_UNAVAILABLE` / `RT_E_ISOLATION_UNAVAILABLE` are NOT** ⇒ never name them in the UI.
- S4's seat/isolation seams: `src/lib/seat.ts`, `src/lib/seat.server.ts`, `src/lib/isolation.server.ts` are **NOT on disk** (S4 ended capped) ⇒ the seat surface stays the existing read-only banners; isolation named without an invented code. (This is CF-4's substance — recorded in §MASTER-CORRECTIONS.)
- The FixturesPanel pattern to mirror: state visible · scope stated · refusal named · disabled+reason in `title` (:458–570, :573–624, :3911–3961).

## [t1] Landings (append as they land)

_(in progress — filled below as each patch lands)_
