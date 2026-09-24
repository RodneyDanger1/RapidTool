# fixes/244 — W16 LANE 1 · OV-35: the Step-0 preflight (OV-27 probe · failure-class triage · kill-safety marker)

**Lane:** W16-L1 (owns `scripts/run-eval.mjs`, `scripts/run-eval.test.mjs`, `src/lib/doctor.ts`, `src/lib/doctor.test.ts` — nothing else).
**Brief:** `wave_plans/W16/lanes-and-observer.md` LANE 1. **Intent rows:** `fixes/228` §3 #4 (OV-35) / #5 (OV-27); `227` §2a/§3 (C2/C5); `223` WB-6/WB-7; `235` §2 row 3 (the three unasserted clauses this lane must pin: marker ordering / per-class codes / keyless identity); `241` §OV-35 (definition step first: exported classifier + marker seam).
**Tree at start:** HEAD `7582771` + uncommitted W14/W15 landings (C-1 `fixes/236`, C-2 `fixes/237_lane1`); `run-eval.test.mjs` 17/17 at start.

## BOTTOM LINE (written first; refreshed as claims land)

> **STATUS: IN PROGRESS — skeleton written at lane start.** Nothing keyed may run until (a) the OV-27 reachability probe reports `configured` + wire-reach through the P6 separate-specifier path, (b) every `RunOutcome`/ending has a coded failure class, (c) a killed run cannot be mistaken for a completed one (run marker written before the first corpus entry).
> **The three clauses `235` §2 row 3 names as WEAK and this lane must pin:** (a) marker written before entry 1 (read order), (b) one distinct code per class (stubbed 401/402/400/not-configured), (c) a suite case pinning the keyless path writes nothing new.
> **Claims land here only with the command that produced them.**

## §1 · OV-27 — the reachability probe (P6 separate-specifier path)

_(filling: probe design, keyless dummy-key run, what it proves, what it cannot prove without a real key)_

## §2 · Failure-class triage (every RunOutcome/ending coded — no silent `stalled`)

_(filling: the RunOutcome census from the bytes, the classification table, the wiring site)_

## §3 · Kill-safety run marker (WB-6: `results.json` then `history.json` torn pair)

_(filling: marker write position vs `:1177`/`:1206`, the ordering test, the keyless-identity test)_

## §4 · Tests + commands (every claim = the command)

_(filling: the suite runs, before/after counts, the pinned cases)_

## §5 · Honest limits / what this lane cannot prove

_(filling)_

*Skeleton written at lane start per the wave rules; body filled as evidence lands. Every number below is the output of the command printed beside it.*
