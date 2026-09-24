# fixes/217f — W11 LANE 5: engine failure visibility (G2) + emitted-tree `.gitignore` (T4.2)

**Lane:** W11 L5 (coding engineer) · **Date:** 2026-09-24 · **Status:** IN PROGRESS (skeleton first)
**Owned files:** `src/lib/engine.ts`, `src/lib/lesson-writers.test.ts`, `src/lib/scaffold.ts`,
`src/lib/scaffold.test.ts` · **Baseline counts recorded BEFORE any edit** (see §3).

## §1 Item 1 — G2: `runPhaseAsync`'s silent catch-all

_(to fill: what changed, file:line, command, observed result)_

## §2 Item 2 — T4.2: emitted `.gitignore`

_(to fill: what changed, file:line, command, observed result)_

## §3 Evidence — commands actually run

- BEFORE (pre-edit) `node --experimental-strip-types --test --test-concurrency=2 src/lib/lesson-writers.test.ts`
  → `# tests 15 / # pass 15 / # fail 0 / # skipped 0`
- BEFORE (pre-edit) `src/lib/scaffold.test.ts` → _(to fill)_

## §4 Old → new, what could break, what was NOT done

_(to fill)_

---

## PARENT NOTE (W12 close, 2026-09-24)

**This log stopped as a skeleton — the lane ran out of tool budget before filling it.** The
parent has NOT fabricated a body. This lane's real, first-hand record is:
- its own closing summary: `C:/Users/mnril/AppData/Local/hermes/cache/delegation/subagent-summary-4-20260924_104246_669417.txt`
- its full tool/assistant transcript (every command + output): `C:/Users/mnril/AppData/Local/hermes/cache/delegation/live/<run>/task-*.log`
- the wave's consolidated close record: `fixes/218_w12_close_record.md` (§1–§2 cover this lane's
  outcome, the parent's verification of it, and what was carried forward)

State: both code items landed (`engine.ts` `liveLayerFailureRow` warn row + the emitted `.gitignore`); the lane's own final gate and log fill did not run. WD-1 marked it PARTIAL; a parent verification of the two items is owed (`fixes/218` §3 item 3/5).
