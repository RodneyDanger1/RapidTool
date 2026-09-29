# wave_plans/W43/COMPLETION-TASKS.md — THE FACTORIAL COMPLETION TASK LIST

**Created by:** the parent (commander lane) · **Status:** SKELETON — verdict columns fill when the 4 auditors land (`fixes/311_da1_claims.md` · `311_da2_data.md` · `311_se1_pipeline.md` · `311_se2_surfaces.md`).
**Law:** every task = real code, a file/box, a done-when command, and a dependency. No task exists without a byte-traceable reason.

---

## THE SEVEN FACTORS (every dimension completion must cover)

### F1 · PROVE — the keyed end-to-end demonstration
*The single unproven link: key → synthesis → app → tree-green → acceptance → mint.*
- [ ] T1.1 — Pre-flight: the funded key present + balance-checked; the exact command chosen (`run-eval --keyed` vs a wild-run vs both) · done-when: the command + env recorded.
- [ ] T1.2 — THE RUN, logged byte-for-byte (envelope per phase, tree-run verdict, acceptance rows, mint state) · done-when: a run transcript exists with a real score.
- [ ] T1.3 — The post-mortem: every zero/refusal read at its line — WAS it a code gap or model quality? · done-when: fixes/312 keyed-postmortem.md.
(PENDING-AUDIT: DA1 #8, DA2's run-table + SE1's chain verdicts.)

### F2 · COMPLETE THE LOOP — iterate-until-satisfaction driver
*Does not exist today. Buildable at eval/scorecard ↔ wild-step (SE2's design lands here).*
- [ ] T2.1 — design frozen (SE2's concrete design → cards)
- [ ] T2.2 — the driver: score < threshold → bounded critique+regenerate (with the budget caps respected)
- [ ] T2.3 — pins + a keyless dry of the driver's decision logic
(PENDING-AUDIT: SE2 #4a + DA1 #9.)

### F3 · SELF — RapidTool improving its own repo
*Not an architecture today (DA1 #10). Outside-the-box: the honest minimum = the pipeline as a bounded delegate + guard rails; scope TBD from SE2 #4b.*
- [ ] T3.1 — scope decision: what self-edits are allowed, what's guard-railed (the AGENTS.md consent class)

### F4 · SURFACES — UI-keyed parity + unattended
*Whether the console can drive a keyed build, and the zero-touch path's remaining human touchpoints (SE2 #1/#2).*
- [ ] T4.1 — the capability-diff fixes (whatever the audit names)
- [ ] T4.2 — unattended zero-touch: close every human-touchpoint SE2 finds

### F5 · OPS — budget, telemetry, cron
- [ ] T5.1 — the budget ceiling verdict (SE2 #3) + any unmetered path wired
- [ ] T5.2 — the cron `last_status:error` diagnosis (2 fires errored — root cause + fix)
- [ ] T5.3 — the spend ledger completeness (crew/websearch/synthesis — M4-10-class check)

### F6 · QUALITY — the generated app must actually run green
*The acceptance gate now fails a dead entry — but "the emitted tree's own tests pass" is the mint's precondition and was last known red pre-overhaul.*
- [ ] T6.1 — the tree-test baseline: what the emitted tree's tests check; the acceptance/`meanAtLeast` reachability on a FIRST run (DA2 #3 + SE1 #3)
- [ ] T6.2 — close every structural gap between tree-run-red and mint-blocked (SE1 #3's list)

### F7 · LEARNING — lessons improve the NEXT synthesis
*The green-seal mints lessons — verify the consumer: does the next run's packet/synthesis actually CONSUME minted lessons? (Nobody has audited this end.)*
- [ ] T7.1 — the lesson-consumption trace: mint site → packet → synthesis prompt · done-when: a grep-proven chain or the named missing hop.

---

## MERGE RULE
When the 4 auditors land: each factor's PENDING-AUDIT becomes a verdict (PASS/CONDITIONAL/BLOCKED + evidence), each CONDITIONAL/BLOCKED spawns a numbered task with file/box/done-when, and this file becomes the coder-wave brief. The keyed run (F1) happens ONLY after the user reviews this completed list.
