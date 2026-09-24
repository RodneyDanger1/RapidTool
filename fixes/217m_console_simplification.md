# 217m — W12 Lane D: console simplification (TASK-05 tab tiering · T-20 current-step line · UI-16 hierarchy · UI-10 export menu)

**Status:** in-progress (skeleton — written before the first edit, per lane-d.md rule 8)
**Lane:** W12 Lane D (UI/UX simplification) — `wave_plans/W12/lane-d.md`
**Owned file (ONLY):** `src/components/console.tsx`. This log is the only other file this lane writes.
**Inputs read:** `wave_plans/W12/lane-d.md`, `AGENTS.md`, `RESUME.md` §11.8, `research/multiagent/110_ui_audit_vs_competitors.md` §1–§5, `research/multiagent/111_ui_design_research.md` §TASK-03/§TASK-05/§6.0, `fixes/217g_console_s1_bugs_and_compaction.md`.

## 0. Preconditions honoured

- Machine memory-tight: ONE `npm run typecheck` at the very END; NEVER `npm test` / `npm run build`.
- Patch-only targeted edits on `console.tsx`; region re-read immediately before each patch.
- No git checkout/stash/reset/clean/commit.
- No mock/stub/placeholder code. No browser in this environment → interactive paths listed as
  NOT EXERCISED by hand; evidence = exact `grep -n` before/after + typecheck.
- THE HARD RULE: every change additive / re-ranked / re-worded / wrapped. `RunTab` union
  byte-identical; all ten panes render.

## 1. L6 verification pass (217g) — to be filled

## 2. TASK-05 — tab tiering (families wrapper) — to be filled

## 3. T-20 — plain-language current-step line — to be filled

## 4. UI-16 — single visual hierarchy — to be filled

## 5. UI-10 — single Export menu (all code paths wired) — to be filled

## 6. Capability-preservation checklist — to be filled

## 7. Verification evidence (typecheck + greps before/after) — to be filled

## 8. Proposals (things NOT done because they would cost capability) — to be filled

---

## PARENT NOTE (W12 close, 2026-09-24)

**This log stopped as a skeleton — the lane ran out of tool budget before filling it.** The
parent has NOT fabricated a body. This lane's real, first-hand record is:
- its own closing summary: `C:/Users/mnril/AppData/Local/hermes/cache/delegation/subagent-summary-3-20260924_110209_459302.txt`
- its full tool/assistant transcript (every command + output): `C:/Users/mnril/AppData/Local/hermes/cache/delegation/live/<run>/task-*.log`
- the wave's consolidated close record: `fixes/218_w12_close_record.md` (§1–§2 cover this lane's
  outcome, the parent's verification of it, and what was carried forward)

State: TASK-05 tiering was **already in-tree** (verified, not redone), all six of L6's items re-verified PRESENT; 6 additive patches landed (the Export menu is real: `ExportMenuItem` `console.tsx:1501`, `DropdownMenu.Root` `:2488`). ⚠️ The lane's single permitted `typecheck` was NOT run — and its last hunk left `console.tsx` with an **unclosed `<>` fragment**, which the parent repaired (`fixes/218` §2 item 1).
