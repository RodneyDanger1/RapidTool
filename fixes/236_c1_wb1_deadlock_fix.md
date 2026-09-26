# fixes/236 — C-1 landed: the WB-1 gate-before-mint deadlock is defused (with RED-first proof)

**Landed:** 2026-09-24, by the parent/delegator, executing W0 lane 0 (the plan's own first move).
**Files changed:** `src/lib/headless.ts` (2 seams) · `src/lib/headless.test.ts` (+1 test).
**Tree:** uncommitted at write time; base commit `7582771`. typecheck 0 · `headless.test.ts` 91/91.

## What the deadlock was (verified, not theorised)
`p6-verified` requires `lastTest.label === "tested"` + a non-empty evidenceHash (`dod.ts:500-517`). The
chunked keyed synthesis nulls `lastTest` and states its only re-mint runs "after a genuinely green
tree-run" (`codegen.server.ts:3142`). But the P6 gate was recorded **before** the mint was applied
(`headless.ts:1917` then `:1958`; pre-fix numbering), and a red gate returns `failed` (`:1968-1986` pre-fix →
`:1980-1998` post-fix; the range was 2 lines short as first written — struck by WD-β's audit) — so the mint was gated
on the very flag it is needed to satisfy. For every chunked keyed tree (webapp/tool/game, incl.
coffeehouse2home) the journey could never converge: M3/M4 certain zeros (223 §4; the 2026-09-10 keyed
ledger on disk shows the exact shape — P6 complete, no green gate, 50+ `dod.blocked`).

## The fix (shape, both seams)
Mint the tested-equivalent from **this cycle's genuinely green tree-run** FIRST, then record the gate:
- journey seam — `applyTreeRunTestedMint(finalProject, verdict)` inserted before `recordGate(...)`;
- repair seam — same, before `recordGateInto(finalProject, 6)` in `repairTreeDir`'s `recordGreen`.
T0.6's intent is **preserved untouched**: the mint is never forced — `mintTreeRunTested()` self-guards on
`outcome.ok === true` **and** ≥1 executed assertion, and a green-but-unexecuted run mints nothing and logs
`p6.tree.tested.skipped` (`codegen.server.ts:3210/3215`). **The only semantic change is the order — with
one observable delta WD-β's audit caught and this log must state:** on a green-but-unexecuted run, the
`p6.tree.tested.skipped` log can now be emitted at the pre-gate seam as well (the skip is reachable
earlier than before); **no "tested" stamp is ever created without executed assertions** in any ordering.
The post-gate mint call
stays (idempotent: `mintTreeRunTested` returns early when already tested, `:3212`).

## The proof (RED first — this is the part that matters)
New test in `headless.test.ts`: *"C-1 (WB-1): a genuinely green tree-run that EXECUTED specs mints the
tested-equivalent before the gate"*, using the **default** `recordGate` (the old suite's green-branch test
injects a fake green gate at `:492-510` and structurally could not catch this) and a verdict carrying one
passing `tests/oracle.spec.ts` with 1 executed assertion:
- BEFORE the fix: `not ok 3 - C-1 (WB-1) …` · `# tests 91 · # pass 90 · # fail 1` ← the deadlock,
  reproduced in a unit test for the first time;
- AFTER the fix: `ok 3` · `# tests 91 · # pass 91 · # fail 0` · `typecheck_errors=0`.

## Corrections to earlier claims (declare-or-strike, self-applied)
1. The parent initially flagged a "direct conflict" with `headless.test.ts:489`
   (`notEqual(lt?.label, "tested")` on a red-gate failure). **That flag was wrong**: that test's cycle-3
   "green" verdict carries `tests: []`, so `treeRunTestedEvidence().executed === false` and the mint
   refuses regardless of ordering — no conflict exists, and the assertion passes unchanged.
2. The parent's earlier "the test asserts on a fake green gate" note is correct and is now the *reason*
   the new test exists.

## What this unlocks / what it does not
- **Unlocks:** M4 becomes satisfiable (the mint is the promotion path for chunked trees), and M3 becomes
  reachable whenever the gate's other probes pass — i.e. the journey can actually converge keyed.
- **Does not:** fix the other probes (`p6-brief-fit` etc. still decide convergence honestly), touch
  `verifyAndFixServer`, or claim any keyed run happened. **Step 0 is still unrun and still required.**
- **Next in W0:** C-2 (make a `dod` hard stop a coded terminal stop → M9), then OV-35's preflight.

---

## Post-audit (WD-β, 2026-09-24) — verdict + corrections applied

WD-β (`fixes/239_wd_beta_report.md`) independently audited this fix adversarially:
**C-1: CONFIRMED · no falsification found.** Its own run: `headless.test.ts` 91/91, exit 0; both seams
verified against base `7582771` via `git show` (old order `:1917`/`:1958` + `:2498`/`:2509`); the
never-mint-on-red (`codegen.server.ts:3210`) and never-mint-unexecuted (`:3215`) guards confirmed
intact; the `:489` no-conflict explanation confirmed TRUE (`greenVerdict.tests: []`, `headless.test.ts:411-417`).

Strikes it raised against THIS document, and their disposition:
1. `:1968-1984` range was 2 lines short → **fixed in place** (now `:1968-1986` pre-fix → `:1980-1998` post-fix).
2. "Only the ORDER changed" overstated → **fixed in place** (the green-but-unexecuted skip-log reachability
   delta is now stated; no stamp is ever created without executed assertions).
3. One typo flagged but not named by WD-β → **not located by the parent; recorded as open-cosmetic** (no
   semantic impact found in a full re-read).

Also noted by WD-β: its first test invocation died with zero TAP output (`stdin is not a tty`, exit 1 —
environment-level under concurrent load; the foreground re-run 91/91 is authoritative; parent re-runs at
13:05 and 13:10 also 91/91). The audit's "do not close" conditions (L1 drain evidence, L3 smoke evidence)
were satisfied by the parent boundary run at 13:10: `run-eval` 17/17 and L3's smoke ledger in
`fixes/237_lane3_browser_pass.md`.
