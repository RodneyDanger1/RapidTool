# 217e — W11 L4: `nextAction` (TASK-01) + CLI dispatch defect G1

**Wave:** W11 · **Lane:** L4 — agentic engineer (`src/lib/headless.ts`, `src/lib/headless.test.ts`,
`scripts/rapidtool-cli.mjs`).
**Sources:** `wave_plans/W11/lane-4.md`; `fixes/216y_oracle_and_error_audits.md` §2.3 G1 (the bug);
`research/multiagent/111_ui_design_research.md` TASK-01 (the spec); `scripts/README-cli.md` (machine
contract + exit taxonomy); `RESUME.md` §5 (hard rules).

**Status at skeleton write:** in progress — G1 fix pending, TASK-01 pending, proofs pending.
Every claim below will be overwritten with the real command output before this lane closes.

## §1 G1 — CLI dispatch falls through a handled project-load refusal

*(to fill: file:line of the two `respond(...)` sites, the patch, the defect-class sweep, the
real stdout/stderr/exit for the 3 repro commands)*

## §2 TASK-01 — derived `nextAction` on the summary envelope

*(to fill: the `NextAction` type, the precedence order, `summary()` field, test arms, purity)*

## §3 Proofs

*(to fill: `summary --project build.json` output, typecheck, test tail + old→new test count)*

## §4 Deliberately NOT done

*(to fill: console `uiNextAction` unification (sibling file, out of scope), etc.)*

---

## PARENT NOTE (W12 close, 2026-09-24)

**This log stopped as a skeleton — the lane ran out of tool budget before filling it.** The
parent has NOT fabricated a body. This lane's real, first-hand record is:
- its own closing summary: `C:/Users/mnril/AppData/Local/hermes/cache/delegation/subagent-summary-3-20260924_104246_667423.txt`
- its full tool/assistant transcript (every command + output): `C:/Users/mnril/AppData/Local/hermes/cache/delegation/live/<run>/task-*.log`
- the wave's consolidated close record: `fixes/218_w12_close_record.md` (§1–§2 cover this lane's
  outcome, the parent's verification of it, and what was carried forward)

State: G1 landed (4 CLI edits) and was **parent-verified on the final bytes** (coded JSON, stderr 0 B, exit 1; success path + NDJSON log intact). `nextAction`/TASK-01 was NEVER started; the vocabulary decision it raised is recorded in `fixes/218` §3 item 1.
