# W6 · LANE 5 — TA-1 + TA-21 + complete `216f`

**Mission.** Close three verification/hygiene items: (TA-1) verify the four `[lane-reported]`
blockers from dossier 100 (:37-41) against real code instead of trusting the labels;
(TA-21) the plan-hygiene sweep from the board; (`216f`) finish the codegen landing log that
stayed half-written.

**Done-when:** each of the four blockers is VERIFIED with file:line + a command or explicitly
struck (with evidence); TA-21 items either fixed or explicitly deferred with reasons in the
board's terms; `fixes/216f_synthesis_honesty.md` body complete (work log, commands, results,
old→new, not-done — source material: the R3 + W3-L1 summaries in
`C:\Users\mnril\AppData\Local\hermes\cache\delegation\`).

**Owned:** verification only — you may read everything; you EDIT: `fixes/216f_synthesis_honesty.md`
+ (if TA-21 requires it) ONLY files nobody else owns this wave. Check the other four lanes'
ownership before any edit; when in doubt, REPORT instead of editing.

**MINI-TASK PLAN:**
1. Read `research/multiagent/100_factory_blockers.md` :37-41 (the four `[lane-reported]` rows)
   + `105` TA-1 row. For EACH: locate the live code (grep), determine current truth
   (verified/stale/different), and write a one-paragraph verdict with file:line + the command
   output you used. TA-1's deliverable = a truth table in `fixes/216f` (or a new short log
   section; keep it in 216f to avoid file sprawl).
2. TA-21: read the board's TA-21 row/notes; sweep the named items; fix only safe/disjoint
   things, else record exact deferral reasons.
3. `216f` body: materialize from the R3 summary (`subagent-summary-2-20260916_203741_062948.txt`)
   + W3-L1's partial (`subagent-summary-0-20260916_203741_059957.txt`): what landed (detector
   wiring, prompt fixes, :342 residual closure), commands+results, old→new, not-done.
**Verify:** any file you touch: `npm run typecheck` + the relevant suite; otherwise no gate
runs needed (verification lane). DO NOT run the full suite (siblings mid-edit).
Budget death ⇒ plain statement of which verdicts landed.
