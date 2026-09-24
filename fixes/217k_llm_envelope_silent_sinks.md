# fixes/217k — W12 LANE B: the silent LLM/API envelope sinks (G6)

**status: in progress** — skeleton first (W12 lane-b brief rule), filled with real
command output as the work lands.

Lane: W12 · LANE B (bug hunter 2) — defect **G6** from `fixes/216y_oracle_and_error_audits.md` §2.3
(`parseSynthesisPatchEnvelope` and `parseSynthesisEnvelope` return bare `null` on JSON.parse
failure — no log, no code — so an unparseable model reply is indistinguishable from "no output").
Owned files: `src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts`. Landing log path: this file.

## 1. Reproduction (pre-fix, real output)

_(probe + raw output pasted here after the run)_

## 2. The fix — file:line, old → new

_(patch diffs + rationale)_

## 3. Same-class sweep inside `codegen.server.ts`

_(every `JSON.parse` / `catch` in the file classified; genuine instances fixed, rest reported)_

## 4. Tests (keyless — stubs only, no `DEEPSEEK_API_KEY`)

_(before/after counts + real tails)_

## 5. What could break — the callers of each parser

_(named call sites + why each contract is unchanged)_

## 6. What I did NOT do

_(explicitly out of scope + any blockers)_

## 7. Verification commands actually run

_(exact commands + real tails)_

---

## PARENT NOTE (W12 close, 2026-09-24)

**This log stopped as a skeleton — the lane ran out of tool budget before filling it.** The
parent has NOT fabricated a body. This lane's real, first-hand record is:
- its own closing summary: `C:/Users/mnril/AppData/Local/hermes/cache/delegation/subagent-summary-1-20260924_110209_456311.txt`
- its full tool/assistant transcript (every command + output): `C:/Users/mnril/AppData/Local/hermes/cache/delegation/live/<run>/task-*.log`
- the wave's consolidated close record: `fixes/218_w12_close_record.md` (§1–§2 cover this lane's
  outcome, the parent's verification of it, and what was carried forward)

State: **G6 FIXED** — reproduced first (14 cases, zero signals), then a shared coded seam landed (`RT_E_LLM_REJECTED` + `p6.synthesis.envelope.unreadable`, bounded 160-char excerpt) with the caller-visible contract unchanged; WD-2's independent probe confirms it. Suite count is 99, not the plan's stale 72.
