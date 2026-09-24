# fixes/217l — W12 LANE C: knowledge/algorithms correctness (109's C-02, C-06, C-08, C-09, C-10)

**Lane:** W12 lane-c (Bug hunter 3) · **Date:** 2026-09-24 · **Status:** IN PROGRESS
**Owned files:** `src/lib/knowledge.ts`, `src/lib/knowledge.test.ts`, `src/lib/algorithms.ts`,
`src/lib/algorithms.test.ts`, `src/lib/harvest.ts`, `src/lib/harvest.test.ts`

Method: rule one of `wave_plans/W12/lane-c.md` — FALSIFY BEFORE FIXING. Each C-item gets a probe
run OUTSIDE the repo (`C:/Users/mnril/w12c_scratch/`) or a real test run; only a defect that
reproduces on TODAY's tree gets a patch. "FALSIFIED-today" = the dossier defect does not reproduce
(the command that disproved it is recorded).

## Skeleton (filled below as probes run)

| Item | Claim | Verdict today | Evidence |
|---|---|---|---|
| C-09 | `entries()` returns its live cache array | _pending_ | _pending_ |
| C-06 | stemmer asymmetry in `intentLattice` freq | _pending_ | _pending_ |
| C-08 | harvest cap leaks / zero-budget note lies | _pending_ | _pending_ |
| C-02 | phantom export | _pending_ | _pending_ |
| C-10 | three stemmers under "FusionRank" | _pending_ | _pending_ |

## Live defect found while probing (beyond the C-list)

- **honesty-guards.test.ts is RED today** (`# tests 5 / # pass 4 / # fail 1`): `lessonRow` never
  wires `probeTagsFromSignature` (defined at `knowledge.ts:911`, zero call sites) though its own
  docstring and the W11 test claim the tags exist. Raw: `w12c_scratch/honesty_before.txt`.

## Probes (raw output, w12c_scratch/)

_pending_

## Patches

_pending_

## Anti-regression beat (BEFORE → AFTER)

_pending_

## Typecheck

_pending_

## NOT done / not touched

_pending_

---

## PARENT NOTE (W12 close, 2026-09-24)

**This log stopped as a skeleton — the lane ran out of tool budget before filling it.** The
parent has NOT fabricated a body. This lane's real, first-hand record is:
- its own closing summary: `C:/Users/mnril/AppData/Local/hermes/cache/delegation/subagent-summary-2-20260924_110209_458303.txt`
- its full tool/assistant transcript (every command + output): `C:/Users/mnril/AppData/Local/hermes/cache/delegation/live/<run>/task-*.log`
- the wave's consolidated close record: `fixes/218_w12_close_record.md` (§1–§2 cover this lane's
  outcome, the parent's verification of it, and what was carried forward)

State: C-02/C-06/C-08/C-09 **all FALSIFIED-today** (already correct in the tree — no patch applied, correctly) and **F1 FIXED** (the `probe:<id>` tags are now actually emitted from `lessonRow`, `knowledge.ts:952` — parent-verified). No AFTER runs / typecheck by the lane; the boundary gate covers that.
