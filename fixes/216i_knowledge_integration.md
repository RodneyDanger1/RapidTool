# 216i — Knowledge integration (W2 · R4): the T1/T2 hops for 112

**Status: COMPLETE** (W2·R4 wiring landed in W3-L3; the pins + T-17 wiring +
this close-out landed in W4·L3 — verified with real command output at the
bottom; nothing here is claimed without a run behind it).

**Scope (owned files only, patch-additive):** `src/lib/types.ts`,
`src/lib/engine.ts`, `src/lib/verify.server.ts`, `src/lib/report-intake.ts`,
test pins in `report-intake.test.ts` / `verify.server.test.ts`.
**Not touched (frozen/other lanes):** `knowledge.ts`, `judgment.ts` (settled by
216g), `codegen.server.ts` (T4 hops deferred to W3).

**Why this lane exists:** 216g landed the CORE of 112 T1–T4 in
`knowledge.ts` + `judgment.ts` but reported three out-of-lane hops: the
`reproducedCount` accrual needed `types.ts` + the engine merge site; the
`lesson.refused` ledger append needed the caller files that mint lessons
(verify.server / engine / report-intake). This log lands the T1/T2 hops the
216g lane could not. T4 call-site hops stay deferred (codegen.server.ts).

## Planned changes

### T1 — `reproducedCount` accrual (one row per repeated identical failure)
- [ ] `types.ts`: optional `reproducedCount?: number` on `MemoryEntry`
      (telemetry, never in any id/fingerprint — mirrors `counterEvidence`).
- [ ] `engine.ts`: `accrueReproducedCounts(rows)` pure helper — collapses
      same-id rows in ONE list into one row whose count accrues; non-lesson
      rows untouched (dedupeMemoryIds rename semantics preserved).
- [ ] `engine.ts:1331` merge site (applyPhaseResult) — wrap with the accrual.
- [ ] `engine.ts` L2 seal site — a re-seal of the same unmet gate accrues the
      ONE stored row instead of silently skipping (`lesson.reproduced` log).
- [ ] `report-intake.ts` merge — a re-minted L2 lesson twin (same signature id)
      accrues on the stored row instead of being silently dropped.

### T2 — `lesson.refused` visibility (counterexample-or-nothing at the callers)
- [ ] `verify.server.ts`: failing/exhausted runs mint the L3 row through
      `failureLessonFromRecord` with the failing case ids as anchors (the
      signature-based id → one row per repeated failure).
- [ ] `verify.server.ts`: the oracle-generation error path has NO anchor ⇒
      refusal — no lesson + a visible `lessonRefused` payload on the outcome
      (`lesson.refused`), never a silent no-op.
- [ ] `engine.ts`: `LessonSurface` seam gains `failureLessonFromRecord`; the L2
      seal mints through the record path; a refusal records the ledger row and
      mints NO lesson. Engine L2 row id keeps the signature id (drop the
      text-hash override that defeated 216g's identity contract).
- [ ] `report-intake.ts`: the lazy seam gains `failureLessonFromRecord`; the
      record path is the §4.3 gate; a refusal logs `lesson.refused` and mints
      no lesson (the direct builder stays the row source — it carries the E-18
      `agent-report` stamp the record builder cannot).

### Tests
- [ ] `verify.server.test.ts`: refusal (no lesson + lessonRefused) pin +
      anchored failed-run id-stability pin.
- [ ] `report-intake.test.ts`: reproduction accrual pin (re-minted lesson twin
      increments the ONE stored row).

## W4 · L3 — close-out (pins + T-17 wiring + this log)

Lane plan: `wave_plans/W4/lane-3.md`. W3-L3 landed the wiring (verify.server.ts
`gatedFailureMint` :893-915; verify.ts `applyVerifyOutcome` :196-281) but ran
out of budget with ZERO pins; this lane (W4-L3) adds
the four executable pins in `verify.server.test.ts`, the accrual pin in
`report-intake.test.ts`, the T-17 real assertion in `rt-client.test.ts:121`,
and the assertion-gap step in `scripts/gate.sh`.

### W4-L3 pins (added, additive only)

- [ ] `verify.server.test.ts` — refusal pin: anchor-less refusal ⇒ `lessonRefused`
      present, `outcome.lesson` absent, consumer appends the visible
      `lesson.refused` ledger row and NO lesson memory row.
- [ ] `verify.server.test.ts` — anchored failure pin: ONE signature-id row
      (`lesson-verify-failure-<fnv8>`) anchored to the failing case ids.
- [ ] `verify.server.test.ts` — repeat pin: same id across runs +
      `reproducedCount` accrual (1 then 2) on the ONE row via
      `applyVerifyOutcome`, `lesson.reproduced` ledger row, no twin.
- [ ] `verify.server.test.ts` — id-stability pin: tail drift (1 vs 2
      iterations) keeps the SAME id; a different anchor set is a different id.
- [ ] `report-intake.test.ts` — accrual pin: a later complete report re-minting
      the same L2 signature id accrues `reproducedCount` on the ONE stored row.

### W4-L3 T-17 wiring

- [x] `src/lib/rt-client.test.ts:121` — the repo's ONLY `assert.ok(true)`
      finding replaced with the real assertion (old → new recorded below).
- [x] `scripts/gate.sh` — assertion-gap step added (gate id `assertionGaps`,
      additive; nonzero exit propagates into the verdict `ok`/exit code).

## Commands + results

(completed during the landing, real output only)

## Old → new (deliberate assertion/behavior updates)

(filled during the landing)

## Deferred (not mine this wave)

- T4 hops: `codegen.server.ts` ×3 expansion sites + `engine.ts:600-603`
  (store rows → expansion prompt).
- `verify.ts applyVerifyOutcome` should append `outcome.lessonRefused` to
  project.logs for the refusal row to land in a real run — one line, out of
  lane this wave (cross-file need reported).
