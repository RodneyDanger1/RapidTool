# 290 · K9 — THE UNIVERSALITY + OUTPUT-TRUTH FINISH (`scaffold.ts` emit + `run-eval.mjs` graders + `eval-corpus/**`)

**Lane:** W40 K9. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; short one-liners). HEAD `2fa3cd9` (W29–W39 era committed).
**Sibling lanes LIVE (read, don't collide):** K1 components · K2 persist · K3 scripts · K4 backends · K5 chat · K6 deepseek · K7 tinyfixes · K8 records · K10 runtime · K12 agents (`F2-06 no verification label → "K9 box — log"`) · K13 pipeline · L1 register · L2 uiux · L3 eval (`run-eval schemas` — possible same-file neighbour: re-read bytes before every patch).
**Sources:** `wave_plans/W38/NEW-SESSION-PROMPT.md` §2.4 (X4) + §2.8 (universality close) · `wave_plans/W37/master-pack.md` §X4 · `research/multiagent/thoroughanalysis.md` §R7-f03 (grader v2 spec) / §R7-f04 (missing-kind fixtures spec) / §A3-f05 / §A3-f06 / §R3-f06 / §R11-f12 · `fixes/277_l1_universality.md` (L1 board) · `fixes/281_n1_rescue.md` (N1: structure only) · `fixes/281_n5_ops.md` (N5: item 3 NOT landed — no `checkExpectedBehavior` in bytes) · `fixes/280_f4_factory_output.md`.
**Contract:** CODE + `node --check`; targeted node --test legs allowed; **NO gates / NO keyed calls** (parent runs the final boundary). Smallest honest patches · additive · attribution comments · do NOT redo N1/Z2 landings — verify bytes first.

## t0 byte-truth (verified before edits)

| Claim | Byte truth at t0 |
|---|---|
| N1 kind wiring (R3-f06) | **LANDED** — `packageJson` per-kind `main`/`bin`/`exports`/`files` (`scaffold.ts:668-687`); `emitKindEntry` (`:2142`) + `emitBinLauncher` (`:2232`) with call sites (`:3011`, `:3013`); `emitViteConfig(kind)` (`:1999`) at `:2994`; `PKG_SCRIPTS.service.start` (`:631`) |
| N5 grader item 3 | **NOT landed** — `grep checkExpectedBehavior run-eval.mjs` → 2 hits, both COMMENTS (`:345`, `:351`); no evaluation, no `behavior.rows`, no `verification` label anywhere |
| `parseGrader` expectedBehavior | **SHAPE only** (N1) — validates rows (`run-eval.mjs:343-380`), returns `expectedBehavior` + `passWhen.requireExpectedBehavior`; nothing consumes them |
| 7 graders | NOT identical byte-wise (7 distinct md5s) but all webapp-shaped: `expectedFiles [package.json,index.html,README.md]` + one `expectedContent` (`package.json` has `"test"`), **no `expectedBehavior`** |
| corpus fixtures | 7/7 `kind: webapp` (game/cli/library/service MISSING) |
| `deliveryKindOf` | `run-eval.mjs:1750-1765`: webapp/app→app · game→game · tool/cli-tool→tool · **library/service/""→undefined** (keyword inference decides) |

## Board

- [ ] 1. Verify the 4 kinds' runnable emission with a REAL keyless emit probe (per-kind package fields + entries on disk + cli `--help` runs + bin launcher runs + library imports + service PORT/refusal). Complete anything missing.
- [ ] 2. `run-eval.mjs`: land `checkExpectedBehavior` (file-exists / package-target-exists / entry-runs) + wire into `checkAcceptance` (+`behavior` + honest `verification` label) + `passesAcceptance`/`acceptanceFailReason` clauses → a broken artifact FAILS.
- [ ] 3. `run-eval.test.mjs` pins for the new logic + any re-points the new corpus files require.
- [ ] 4. The 4 missing-kind fixtures (game/cli/library/service) + graders with real `expectedBehavior` (per §R7-f04).
- [ ] 5. §F4/§A3 remaining in this area (per §R7-f03): webapp grader upgrade (kind-correct expectedFiles/content + expectedBehavior), `expectedKind` assertion if cheap; `verification` label reaches the row/packet output end-to-end.
- [ ] 6. Targeted verification + log landings with evidence.

## Log (append-only, newest last)

- **(t0) start** — read the W38 prompt §2.4/§2.8, master-pack §X4, thoroughanalysis §R7-f03/f04, L1/N1/N5/F4 logs, sibling K-lane logs (boxes checked; no one else owns run-eval graders / eval-corpus / the kind entries). Byte-truth table above verified by grep/sed TODAY. This log written EARLY, before any edit.
