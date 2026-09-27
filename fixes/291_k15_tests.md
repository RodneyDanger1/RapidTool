# fixes/291_k15_tests.md — K15 · THE TEST-QUALITY + COVERAGE REMAINDER (W40 lane K15)

**Lane:** W40 K15. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell grep only; short one-liners). **HEAD:** `2fa3cd9`; K1–K15 + L1–L3 + W1–W5 LIVE → read fresh before every patch; log `for <lane>`.
**Mission:** (1) H1's hostile-shape throws — triage all 11 (probe `probe_h1_libcrash.ts`, W26-H1 report in `~/AppData/Local/hermes/cache/delegation/subagent-summary-0-20260926_160103_332633.txt`); (2) the coverage gaps (`vault.backlinksFor` 1/10 · the 4 bench utilities — check K3 · `mock.test.ts` if any); (3) §A1's test-quality items (never weaken; re-point to verified contracts). Sources: `wave_plans/W34/code-notes.md` §A1 · `fixes/281_n6_pins.md` · `research/multiagent/thoroughanalysis.md` W-16/W-34/W-35.
**Contract:** test files only + tight product fixes where a test exposes a TRUE bug; run ONLY the specific legs I add/fix (foreground, single file); `node --check` on every edited product file; never weaken an assertion; no full gates / keyed calls. Box: `src/lib/*.test.ts` (vault/handoff/token-ledger/verify/bench/ast-mine/algorithms) + the product files those tests expose.

## t0 — recon (2026-09-27, byte reads)

- Probe re-run TODAY (`node --experimental-strip-types probe_h1_libcrash.ts`): **cases=73 throws=7** (was 11 for H1). Remaining: `ast.respectConventions-empty` (ast-mine.ts:572) · `algs.runAlgorithms-junk-project` (algorithms.ts:705 planSpecGraph) · `tl.totalTokens-junk` (token-ledger.ts:114) · `verify.withCommonJsExports-junk` (verify.ts:121) · `verify.applyVerifyOutcome-junk` (verify.ts:158) · `ws.assertSafeRelPath-empty` (write-set.ts:36, by design) · `ws.assertSafeRelPath-dotdot` (write-site.ts:48, by design).
- The 4 no-longer-throwing (H1's list → fixed since): TBD verify (handoff brief×2, vault.backlinksFor; 4th to pin).

## Triage ledger (one evidence line per throw)

_(appending as each lands)_
