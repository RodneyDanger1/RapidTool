# fixes/216j — honesty tooling: T-17 assertion-gap lint + T-14 phase-coverage honesty + W4-L5 109 mop-up

**Lanes:** W2 · R5 (T-17 checker + T-14 core) → W3 · L5 (T-14 core landed) → **W4 · L5 (this lane:
T-14 pins + 109 mop-up ×5 + completing this log)** · **Date:** 2026-09-16 ·
**Status: W4-L5 in progress (skeleton extended first — rule: skeleton-first)**

**Owned files (only these):** NEW `scripts/check-assertion-gaps.mjs`, NEW
`scripts/check-assertion-gaps.test.mjs`, `src/lib/phases.ts`, `src/lib/packet.ts`,
`src/lib/packet.test.ts`, `src/lib/gates.test.ts` · **Log (sole writer):** this file.

**Specs:**
- `research/multiagent/106_rapidtool_deep_analysis.md` §6 **T-17** (finding **F-12**)
- `research/multiagent/106_rapidtool_deep_analysis.md` §6 **T-14** (finding **F-11**)

**Baselines noted before any edit** (`node --experimental-strip-types --test <suite>`):
- `src/lib/packet.test.ts` — **43 tests, 0 fail**
- `src/lib/gates.test.ts` — **83 tests, 0 fail** (14 suites)
- `src/lib/phases.ts` — 151 lines, untouched at start

---

## Tasks

### T-17 — assertion-gap lint (`scripts/check-assertion-gaps.mjs`)

Scans `src/lib/*.test.ts` + `scripts/*.test.mjs` for tautological assertions
(`assert.ok(x.length >= 0)`, `assert.ok(true)`, `assert.equal(true, true)`, same-operand
equality) and zero-assertion `it(...)`/`test(...)` blocks; prints `file:line — reason`
findings and exits non-zero. **REPORTS ONLY — never edits a flagged file.**

### T-14 — phase coverage honesty (packet rail)

P7–P12 produced 0 artifacts and `canEnter` is strictly linear (`phases.ts`), so no surface
may imply all 13 phases ran. Preferred: honest report (`N of 13 phases executed / 0
artifacts from P7–P12`) in the packet rail, pinned by tests. If `engine.ts` were needed —
STOP (R4 owns it).

---

## Work log (append as I go)

_(pending — no source edits made yet)_

## Verification

_(pending)_

## Files changed

_(pending)_

## Not done / blockers

_(pending)_
