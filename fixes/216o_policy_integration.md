# 216o — Policy engine INTEGRATION (W5 · LANE 3 · Wave H T-107.3 routing) — SKELETON

**Status:** IN PROGRESS (skeleton-first, work log appended as steps land).

**Mission.** W4-L2 landed the pure core (`src/lib/policy.ts`, `evaluatePolicy`, 27 tests) but
nothing routed through it. This lane routes EVERY approval through the seam:
`src/lib/headless.ts` `approve()` (≈:750), `scripts/rapidtool-cli.mjs` approve verb (≈:517),
`src/lib/dod.ts` approval criteria (:337-483 + the `approvalActor` reader at :54).

**Owned files:**
- `src/lib/headless.ts` (approve() seat/token decision only)
- `scripts/rapidtool-cli.mjs` (approve verb guards only — no verb-count changes)
- `src/lib/dod.ts` (approval criteria + reader only)
- `src/lib/headless.test.ts` / `src/lib/gates.test.ts` (pins)
- `fixes/216o_policy_integration.md` (THIS file)

## 1. Work log (append-only)

- [ ] 1. RECON: policy.ts contract + W4/lane-2 + 216n §4 wiring list + W2 pins.
- [ ] 2. Baseline runs (headless / gates / README-cli / typecheck).
- [ ] 3. headless.ts `approve()` → `evaluatePolicy`.
- [ ] 4. rapidtool-cli.mjs approve verb → `evaluatePolicy`.
- [ ] 5. dod.ts approval criteria → policy-seam consistency.
- [ ] 6. Pins: denied-not-bypassable (both seats), `hitl.force` self-approval refused;
      positive paths stay green.
- [ ] 7. Final verification + this file's bodies filled.

## 2. Old→new string/behavior ledger

(fill as deliberate changes land)

## 3. Real command output

(fill with the actual runs)

## 4. Cross-file needs (NOT this lane's files)

(fill)

## 5. Not done / deferred

**W7 boundary status (parent, 2026-09-17):** code + the 6 bypass pins landed W6-L2; all suites
re-verified green (headless 90/90, gates/dod 85/85, README-cli 5/5, typecheck 0; full W7 sweep
src 1894/1894). Sections 1-2 (work log / old→new) + real-output evidence STILL OWED → W8-L2.
