# 101 — Pro Fixer P-B: self-learning loop lane (wave: leapfrog learning-loop build)

**Role**: Pro fixer P-B — consumes `fixes/98_leap_analysis_loop.md` LIVE as analyzer H-B
publishes specs; implements the self-learning loop (capture/store/retrieve/evaluate/
evict/correct). Every fix = reasoned, surgical, additive `patch` + regression test.
No renamed/removed exports. Zero new dependencies.

**Owned files (strict)**: src/lib/knowledge.ts · src/lib/vault.ts · src/lib/report-intake.ts ·
src/lib/harvest.ts · src/lib/prompt-engine.ts (+ their test files) · this doc.

## Baseline (2026-09-06 15:05, before any edits this wave)

- `npm run typecheck` → 0 errors
- P-B owned suites: 105 tests, 105 pass / 0 fail / 0 skip
  (knowledge 8 · vault 32 · report-intake 14 · harvest 28 · prompt-engine 23)

## Applied specs

| # | Spec (98 §) | What | Files | Test added | Status |
|---|-------------|------|-------|------------|--------|
| _(waiting on 98)_ | | | | | |

## Spec corrections

_(specs from 98 that were wrong for the on-disk reality; what I applied instead)_

<!-- APPEND -->
