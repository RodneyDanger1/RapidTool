# wave_plans/ — per-lane dispatch notes (parent-authored)

**Convention (standing user directive):** every wave dispatch ships with ONE notes file per
lane at `wave_plans/W<N>/lane-<K>.md`. The lane's dispatch brief points at it as its
AUTHORITATIVE action plan ("Read wave_plans/W4/lane-1.md FIRST — your full mini-task plan").

Each lane file is ordered for speed and contains:

1. **Mission** — what done looks like, with the exact done-when check.
2. **Owned files** — yours alone; plus the neighbors you must NOT touch (disjointness).
3. **MINI-TASK PLAN** — numbered, parent-analyzed steps with real anchors (file:line),
   ordered so the lane never re-derives what the parent already knows.
4. **Parent findings & traps** — what the parent learned this session that touches your
   lane: repairs already made, settled decisions you must not revert, known pitfalls,
   old→new assertion records, and the do-not-do list.
5. **Verification** — exact copy-paste commands for this lane (suites + baselines).
6. **Logging** — skeleton-first rule + your landing-log path (you are its only writer).

Rules: parent owns these files and refreshes them each wave. Lanes must NOT edit them —
report corrections in the final message instead. Files stay in the repo so the next session
(and the user) can see exactly what each lane was told.

---

## Current-wave index (appended 2026-09-26 by the W32 organizer — append-only; log: `fixes/275_organizer.md`)

Wave dirs on disk beyond the convention above (newest first): **W32** `organizer.md` (the organizer +
its watchdog) · **W31** `gap-finshers.md` · **W30** `shell-sprint.md` (its master table lives in
`finalsprint.md`, repo root) · **W29** `coders.md` · **W28** `extension.md` · **W27**
`mass-investigation.md`. (W25 has no directory — its findings live in
`research/multiagent/thoroughanalysis.md`.) A full, machine-generated link index of every `fixes/` and
`wave_plans/` file: **`fixes/263_index.md`** (refreshed 2026-09-26).
