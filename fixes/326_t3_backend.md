# 326 · T3 BACKEND MONITOR — W44 FINAL RUN

Lane T3 (backend monitor). Trial dir: `C:/Users/mnril/w44_trial`; operator T1 drives
`exp2/01..10` via `rt.sh` (keyed; **T3 never invokes keyed verbs**). Repo
`C:\Users\mnril\Desktop\RapidTool Main` stays frozen; **my only write = this log**.

Mission (~3-4 min cadence): (1) detect newly completed emits under `exp2/*/emitted/`;
(2) hand-read each emitted tree (file list; real-vs-shell audit; TODO/placeholder scan;
run its oracle tests + entry smoke, foreground); (3) re-run `rt.sh doctor --tree <emitted>`
and compare vs T1's recorded output; (4) review runtime logs/NDJSON/envelopes for silent
failures; (5) record wall times (first→last envelope). Findings appended below;
[NEW-BUG] flags carry byte-anchored evidence. No fixes; no keyed calls; repo read-only.

- Baseline t0: **2026-09-30 20:25 CDT**
- Repo `6924dde`; `git status --short` = clean; node procs at t0: **0**
- `exp2/` does NOT exist at t0 — campaign not started.
- Tooling: `pgrep` absent (`ps -W | grep` substitute, as in 319/322 lanes); envelope
  reader adapted from `e3_scratch/x_env.py`; lane scratch = `w44_trial/t3_scratch/`.

Status: **OPEN** — awaiting exp2 creation.

## Poll log (timestamped)

| # | time | exp2 state | node procs | notes |
|---|---|---|---|---|
| P0 | 20:25:25 | absent | 0 | baseline; repo clean @6924dde |
| P1 | 20:26:04→20:32:35 (20s ticks) | **EXP2 APPEARED 20:27:05**; 01_website 20:27:46→20:28:33 (full stop); 02_game 20:31:09→ legs 01–05 | 0↔1 | change-diff watch; last live tick 20:32:35 |
| P2 | 20:32:35 → Oct 1 10:01:48 | **host suspended ≈13h29m** — no monitoring possible [ENV-T3-1] | — | watcher's next printed line: `TIMEOUT_NO_CANDIDATE 10:01:48` (resume) |
| P3 | Oct 1 10:01:4x→10:1x | 02 legs 06–08 complete 10:01:37–10:01:43; 02 closed STOP_RED; no 03 dir yet | 0 | post-resume reads + audits of 01/02; T1 idle between exps |
| P4 | 10:05→10:33 (2 watch chunks, 20s ticks) | **T1 IDLE since 10:01:44** (no 03); F1/F2 preps live; no `fix_go5`; repo HEAD unchanged | 0↔1 (short blips) | T2's log matches my audit independently; F2 reproduced [OBS-T3-1] keyless; my audit tooling dry-run-validated on E1 04 tree |

## Per-exp backend audits

### 01_website — **STOP_RED @P6** (no emit; not an emit-audit target)
- Verdict (driver `summary.txt`): `STOP_RED`, 1 unmet (`p6-brief-fit`) — one-hit near-miss (probe hits 7 vs bar 8; T1's independent recheck in `exp2/_logblock_01.md`, source-equal probe fns). Tree 3 files (`src/generated.ts`, `src/generated/render-menu-page.ts`, `src/jobs/publish.ts`). 8 legs; spend Σ=12,438; wall 52.5s (clean, all pre-jump).
- Envelope integrity (my `t3_scratch/x_env.py` over 8 `.out`): **8/8 parse clean, trail=0B**; `07_approve_on_red` = 316B `RT_E_GATE_PENDING` refusal class; caps 5,000,000 on all budget envelopes; no 402/cap/stop_reason bytes.
- NDJSON: 8 rows, all `json.loads`-clean; 7 leg rows + 1 extra `diagnose exit 0` @20:30:55 (T1 prep; session `cli-muouy8sy`); **no `create` row** → repo log (see [OBS-T3-1]); parks → `warn/parked` (see [OBS-T3-2]).
- diagnose[08]: ok=true, 4 rows (2 park warns + 2 expected errors), cause=unclassified-errors (expected: gate rows miss heuristics); checkpoint present. **No silent failure.**

### 02_game — **STOP_RED @P6** (no emit)
- Verdict: `STOP_RED`; 2 unmet (`p6-brief-fit, p6-arch`); tree 2 files (`src/generated.ts`, `src/generated/create-initial-game.ts`); 8 legs; spend Σ=23,868.
- Wall: **raw `wall_total=48636.1s` spans the host-suspend discontinuity** — leg06 `WALL=48617.1s` artifact. Refined forensics (build.json log ts pair): last pre-freeze row `1790818354062` (20:32:34.062 — `chunk 1/5 · attempt 1 · ok`), first post-resume row `1790866880231` (10:01:20.231 — `chunk 2/5 refused`). Real compute ≈ **90s** (≥73s pre-suspend live-observed + ≈17s post-resume tail to envelope @10:01:37.6). Clean legs sans P6 = 19.0s. See [ENV-T3-1].
- Envelope integrity: **8/8 clean, trail=0B**; `07` = 316B refusal class; caps clean; `06_gate_c2` spent=23242 (vs 01's 11901 on same P6 class).
- NDJSON: 7 rows clean (8 legs − create → repo log [OBS-T3-1]). diagnose[08]: ok=true, 4 rows (2 park warns + P6 red + approve-on-red), cause=unclassified-errors. **No silent failure.**
- Read-timing note: my 10:01:4x read caught `08_diagnose_stop.out` at 0B mid-write → 4139B on re-read; transient, not a defect.

### Emit audits (completed builds — oracle + smoke + doctor + real-vs-shell)
_(none yet — 01/02 both stopped red at P6 before the completion branch; awaiting first COMPLETE→`emit --run` under exp2/)_

## Wall-time table

| exp | files | real-vs-shell | oracle | doctor | silent failures | wall |
|---|---|---|---|---|---|---|
| 01_website | no emit (stopped red) | n/a | n/a | n/a | none (8/8 env clean; 4 expected diag rows) | 52.5s (driver; clean) |
| 02_game | no emit (stopped red) | n/a | n/a | n/a | none (8/8 env clean) | raw 48636.1s **incl. ~13h29m suspend artifact**; clean legs 19.0s + P6(≥75s) |

## Run-level findings

- **[ENV-T3-1 · wall-clock discontinuity ≈13h29m — host suspend/resume, NOT a product fault].** Byte anchors: watch log last live tick `[20:32:35] node=1 | 01_website:10 02_game:0` → next printed line `TIMEOUT_NO_CANDIDATE 10:01:48`; `date` Sep 30 20:24:43 → Oct 1 10:02:18 (-0500); `stat` 02/`06_gate_c2.out` mtime `2026-10-01 10:01:37 -0500` vs 01 same leg `2026-09-30 20:28:33 -0500`; NDJSON ts jump `1790818280541 → 1790866897630` (Δ=48,617,089ms); **build.json log brackets the freeze to one second: `1790818354062` (20:32:34.062) → `1790866880231` (10:01:20.231)**. ⇒ Driver `summary.txt` wall for 02 is artifact-inflated; 01 unaffected. All post-jump wall numbers across the campaign need this footnote.
- **[OBS-T3-1 · `create` telemetry row scoping].** Both projects' own NDJSON start at `gate_c0`; the `create exit 0` rows land in the CWD (repo) log `Desktop/RapidTool Main/.rapidtool/logs/rapidtool.ndjson` — tail rows `ts=1790818066228` (01), `ts=1790818269504` (02). Consistent 2/2; row EXISTS (not a silent failure). Adjudication: product/T1 — should create seed the new project's log? Monitor does not fix.
- **[OBS-T3-2 · honest parks log as `warn`+`parked:true`, code:null]** — matches `rapidtool-cli.mjs:202-208` (323 FIX-2c) design comment; not a bug.
- **[OBS-T3-3 · `02_game:0` blip at suspend onset — EXPLAINED]** — watch tick 20:32:35 counted 0 root files right after 7 @20:32:14; build.json's last pre-freeze row is 20:32:34.062 ⇒ freeze onset hit mid-`find` (empty count = command casualty; all files intact on post-resume reads). Not data loss.
- **[OBS-T3-4 · post-suspend network casualty (external, honest handling)]** — 02 leg06 `p6.synthesis.attempt` `chunk 2/5` refused with `RT_E_INTERNAL · DeepSeek returned a non-JSON 200 response` (ts 10:01:20.231) — the in-flight model call died across the suspend. Handled: logged, journey continued honestly, green tree-run minted, gate FAILed on real unmet criteria, `lesson.capture` recorded. No crash/retry-storm. Caveat for 02's record: one P6 chunk's refusal is suspend-caused, not synthesis quality.

## [NEW-BUG] flags

- **01/02: none** — both are honest P6-red stops (documented pre-existing pattern: synthesis stochasticity vs brief-fit bar). No product defect surfaced in the audited window.

- **(parent-appended from T3's capped record — evidence-complete, was not yet in-log at lane end) [NEW-BUG · `doctor --tree` path handling · HIGH honesty class]:**
  1. **Nonexistent path → false-clean:** `doctor --tree` with a non-existent path returns `ok:true, exit 0, stubs:0, files:[]` — **empty inventory, no error, no code** (a false bill of health). Evidence: `t3_scratch/dryrun_doctor_nopath.txt`.
  2. **MSYS-style path silently mangled:** `--tree "/c/Users/.../game/emitted"` → scanned `"C:\\c\\Users\\mnril\\w44_trial\\game\\emitted"` (mangled), `stubs:0, files:[]` **false-empty** — while the SAME tree via its Windows-form path returns `stubs:1, files:[{path:"src/jobs/deliver_core_workflow.ts",kind:"stub"}]`. Evidence: `t3_scratch/dryrun_doctor_game_msys.txt` vs `dryrun_doctor_game_win.txt`.
  - Class: false-clean / silent-wrong-path (the project's top honesty class). No fix prepared at lane level (T3 does not fix) — routed to the post-window fixer wave (F2d). Byte anchors above are complete for reproduction.

=== END 326_t3_backend — PARTIAL (parent-closed; campaign produced no emits to audit — both exps stopped honest red pre-emit; emit-audit harness `t3_audit.sh` dry-run-validated against the E1-era 04_library tree [12 tests / 6 pass / 6 skip / exit 0], ready for the resumed campaign; doctor defect logged above for the fixer wave) ===
