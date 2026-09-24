# W10 · LANE 5 — TA-11 oracle-strength audit + TA-12 error-handling audit

**Mission.** Two dossier-named audits, docs-only, report-don't-fix. Sources: dossier 105
(`research/multiagent/105_plan_critique.md`) — TA-11 at :576 (Oracle-strength audit, signal 9),
TA-12 at :585 (Error-handling audit, signal 10). Also 106 for context.

**Do:** (1) Oracle strength: sample the emitted oracle spec + census machinery vs the claims —
what the rows REALLY assert today (choose 5+ representative pins from
`src/lib/scaffold.ts` emitOracleSpec + `codegen.server.ts` + `doctor.ts` census) — classify each
(real assertion / guarded probe / skip) with file:line + a run where possible. Report the honest
strength envelope + the weakest classes. (2) Error handling: audit the error paths the dossiers
name (coded refusals, catch-all swallows, `RT_E_*` coverage) across the seams — grep-verified
inventory + the top N gaps ranked by blast radius, each with file:line. NO fixes.

**Deliverable:** NEW `fixes/216y_oracle_and_error_audits.md` (TA-11 §1, TA-12 §2, both with real
command output or explicit "not run — static read only"). Keep it ≤ ~200 lines; dense, cited.

**Owned:** `fixes/216y_…md` only. Nothing in src/ or scripts/.
**Rules:** verification-lane discipline — report defects, don't fix; probes outside the repo;
every claim = file:line or a command you ran.
