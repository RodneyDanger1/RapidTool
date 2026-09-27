# fixes/287_z5_runtime_tail.md — W39 · LANE Z5 · THE RUNTIME-TAIL CODER

**Lane:** W39 Z5. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell grep only).
**Mission:** (1) G1's 5 verified pointer items — the 2 event-name/scope mismatches + the 3 reachability gaps;
(2) settle the registry cross-check question (~30 registered events with no client-side emitter — grep the
CLI/server emitters; ✓ where emitted server-side; `TODO(<row>)` comment only for genuinely never-emitted names);
(3) §A1's remaining non-checkpoint findings (`wave_plans/W34/code-notes.md` §A1) in severity order — smallest
honest fix each, `TODO` tightened + one evidence line; 'already fixed — verified <where>' where the Y/N waves
landed it; (4) the 2 README minors from `fixes/286_readme_catalog.md` (§10.6 heading split 78+32=110 · 'root 35'
wording).
**Contract:** CODE-ONLY — no tests, no typecheck, no builds, no gates, no keyed calls. Read fresh;
byte-check every claim before coding (lanes have overstated). `node --check` on every file edited.
**Baseline HEAD:** `0f85c32` + the W29–W39 uncommitted era (153 changed paths at lane start).

## Item ledger (append-only — one evidence line per fix, file:line → before → after)

### Part 1 — G1's 5 pointer items (from `fixes/284_wiring_guarantee.md` + G1's summary)
1. `console.tsx` `sys.heartbeat` emit scope `"wild-driver"` vs registry `sys` — PENDING
2. `error-component.tsx` emits `ui.boundary_crash` (unregistered; twin `boundary.crash`) — PENDING
3. R6-f12 gap — `PaneBoundary` wraps HomeScreen only; RunScreen unwrapped — PENDING
4. W-38 — `store.runP6Journey` zero console callers (dead edge) — PENDING
5. R14-f04 — deepen seam string lookup (`DEEPEN_ACTION_NAMES`) degrades silently on rename — PENDING

### Part 2 — registry cross-check (never-emitted question)
6. ~30 registered events with no client emitter — settle via CLI/server greps — PENDING

### Part 3 — §A1 runtime tail (non-checkpoint findings, severity order)
7. TBD after byte-verification pass — PENDING

### Part 4 — README minors
8. §10.6 heading split (78 direct + 32 subdir = 110) — PENDING
9. 'root 35' wording note — PENDING

## Log (append-only)

### [t0] log opened — mandatory reads in progress

- Read: `fixes/284_wiring_guarantee.md` (48 lines — [t0] only; pointer rows never appended) + G1's delegation
  summary (`subagent-summary-0-20260926_203728_538352.txt`) = the 5-item source of truth for Part 1.
- Read: `fixes/286_readme_catalog.md` + its summary (`-0-20260926_204219_515388.txt`) = Part 4 source.
- Read: `wave_plans/W34/code-notes.md` §A1 in full (651 lines; 47 findings A1-01…A1-47; A1-01…A1-09 +
  A1-47 are checkpoint — out of scope per the brief).
- Read: W38 NEW-SESSION-PROMPT (context); Z3/Z4 sibling logs (wave context: Z4 owns the G1 map paste into 284).
