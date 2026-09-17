# fixes/216q — T-107.5 run-side acceptance fixtures + trials/pass@k (Wave H, L5)

**Status:** COMPLETE — code landed in W5-L5 (`deleg_eb3b8b86`); the W6-L4 tail recorded the real keyless
`--trials=2` evidence, confirmed the results.json shape, and filled this body.

**Lane:** W5-L5 · `wave_plans/W5/lane-5.md` · task `T-107.5` (`research/multiagent/107_competitors_agentic.md:330`,
steal §5/:95 "freeze the grader outside the agent, then score across trials").
**Owned files:** `scripts/run-eval.mjs`, `research/eval-corpus/**`, `src/lib/brief-fixtures.ts`
(path constants only), `scripts/run-eval.test.mjs` (NEW), this log (NEW).

## 1. Mission (from the lane plan)

Make acceptance testing agent-proof: the per-case acceptance bar moves OUT of the
agent-writable corpus fixture into RUN-SIDE grader files read only by `scripts/run-eval.mjs`,
and the harness scores across configurable trials with honest pass@k / flakiness accounting.
`redTreeBanner` + the CLI contract stay intact (additive only).

## 2. Recon (facts with refs)

- **Task source:** `research/multiagent/107_competitors_agentic.md:330` (T-107.5) — "Move acceptance
  fixtures out of the agent-writable project into run-side grader files; add trials +
  pass@k/flakiness"; steal §5/:95 *"freeze the grader outside the agent, then score across
  trials"*. Maps to `100` P0-05 + `103` G5/A14.
- **Where a fixture was readable from inside the emitted project before the move:** the corpus
  frontmatter (`research/eval-corpus/<slug>.md` — acceptance / expectedNouns /
  expectedCapabilities) WAS the grading source, and it lives in the same repo the emitted tree is
  built from — an agent able to edit the fixture could lower its own bar. After the move the
  driver grades only from `research/eval-corpus/graders/<slug>.grader.json`
  (`scoringCorpusFor`, `scripts/run-eval.mjs:349`); graders are never handed to
  `createProject`/`emitProject` and never written under the out dir, and every emitted tree is
  re-scanned (`graderLeakScan`, `:608`). The frontmatter copies stay as D3's documented brief
  contract (documentation, not the bar).
- **Preserved harness contracts:** `redTreeBanner` handover evidence (`:836`), the
  "results are data — exit 0 always" contract (`:41-43`, `:1323`), legacy JSON keys
  (`entries`, `summary.entries`, `summary.meanTotal`, `mode`, `corpusDir`) — all additive-only.
- **Layout on disk (verified):** 6 corpus fixtures (coffeehouse2home-property-ledger, field-ops-suite,
  house-flip-manager, real-estate-crm, rental-portfolio, showing-booking) + 6 run-side graders
  under `research/eval-corpus/graders/`. `src/lib/brief-fixtures.ts` needed NO path-constant move
  (verified: it holds no eval-corpus/grader references).

## 3. What landed (files + line refs)

- **`scripts/run-eval.mjs`** (W5-L5, additive; CLI contract unbroken):
  - run-side grader layer — `graderFileFor` `:260` · `parseGrader` `:266` (trust guards: undeclared
    bar / non-array lists / slug mismatch never grade) · `loadGrader` `:318` (missing grader =
    honest SKIP, never an undeclared bar) · `planTargets` `:333` · `scoringCorpusFor` `:349`.
  - trials + pass@k — `choose` `:428` · `passAtK` `:438` (`1 − C(n−c,k)/C(n,k)`) ·
    `passCaretK` `:449` (`C(c,k)/C(n,k)`, reliability) · `trialsSummary` `:461` (flaky = 0<c<n;
    1 trial ⇒ flakiness **UNMEASURABLE**, stated, never a fabricated zero).
  - run-side acceptance — `checkAcceptance` `:504` (expectedFiles/expectedContent applied from
    OUTSIDE the tree) · `passesAcceptance` `:1005` (grader threshold AND file/content assertions;
    a crash/missing mean is a FAIL).
  - per-trial isolation — `trialEmitDir` `:544` (1 trial = legacy `<out>/<slug>/` byte-identical;
    N>1 = fresh `<slug>--trial-<i>` workspaces) · `evaluateEntry` `:1018` (per-trial rows +
    FLAKY banner `:1067-1073`).
  - leak scan — `treeTextFiles` `:551` · `graderLeakMarkers` `:596` · `graderLeakScan` `:608`;
    a leak prints LOUDLY and rides `summary.graderLeaks` (`:1136`).
  - honest mode text — `keylessSkipNotices` `:629`.
  - CLI additions — `--trials=N` (1..9, default 1 = legacy) `:91-97`; `--k=N` (default 1) `:102-104`;
    `--keyed`/`--all`/`--limit=` unchanged.
  - JSON contract (additive keys) — top-level `graderDir` (`:1169`); per-entry `trial` `:972`,
    `emitDir`, `grader{path,hash,barChars,requiredIdentifiers,requiredCapabilities}` `:974-982`,
    `acceptance`, `graderLeak`, `perTrial[]` `:1055-1065`, `trials{...}` `:1048`,
    `rowSource:"trial-1"` `:1047`; `summary.trials` / `summary.passAtK{...}` / `summary.flakyCases` /
    `summary.graderLeaks` / `summary.skipped+skips` (`buildSummary` `:1144`); history rows add
    `trial` / `trials` / `pass` (`:1184-1203`).
- **`research/eval-corpus/graders/*.grader.json`** — NEW: 6 run-side graders (acceptanceBar +
  requiredIdentifiers + requiredCapabilities + expectedFiles/expectedContent + `passWhen`).
- **`scripts/run-eval.test.mjs`** — NEW, 466 lines / 15 tests: (a) graders are run-side and
  unreachable from the tree (incl. a real-artifact leak scan over `research/eval-out`),
  (b) pass@k / pass^k / flakiness math + acceptance ANDing, (c) honest keyless notices/skips +
  the recorded results.json contract.
- **Not changed:** `src/lib/*` (no src code change was required), `src/lib/brief-fixtures.ts`.

## 4. Real command output (W6-L4 tail, 2026-09-16)

**1) Keyless trials run** — `npm run eval -- --trials=2` (no key; exercises the multi-trial path on
all 6 cases; full log kept outside the repo at `C:\Users\mnril\w6l4-eval-trials2.log`):

```
rapidtool eval · mode=keyless · corpus=...\research\eval-corpus
graders: run-side acceptance bars under ...\research\eval-corpus\graders (read by this driver only — never emitted into a project tree) · trials=2
note: keyless floor: no model calls and no live synthesis — M1..M4 score the deterministic scaffold + the P6 floor journey; no language-model claim is made and no model text is fabricated
     trial 1/2: complete · 6/9 (mean 0.67) · pass=no · 13.5s
     trial 2/2: complete · 6/9 (mean 0.67) · pass=no · 11.5s
ok   coffeehouse2home-property-ledger: complete · 6/9 (mean 0.67) · 2 trial(s) · pass@1=0 · 24.9s
     trial 1/2: complete · 6/9 (mean 0.67) · pass=no · 8.6s
     trial 2/2: complete · 6/9 (mean 0.67) · pass=no · 6.2s
ok   field-ops-suite: complete · 6/9 (mean 0.67) · 2 trial(s) · pass@1=0 · 14.8s
     trial 1/2: complete · 6/9 (mean 0.67) · pass=no · 6.7s
     trial 2/2: complete · 6/9 (mean 0.67) · pass=no · 7s
ok   house-flip-manager: complete · 6/9 (mean 0.67) · 2 trial(s) · pass@1=0 · 13.7s
     trial 1/2: complete · 6/9 (mean 0.67) · pass=no · 4.1s
     trial 2/2: complete · 6/9 (mean 0.67) · pass=no · 6.8s
ok   real-estate-crm: complete · 6/9 (mean 0.67) · 2 trial(s) · pass@1=0 · 10.9s
     trial 1/2: complete · 6/9 (mean 0.67) · pass=no · 15.6s
     trial 2/2: complete · 6/9 (mean 0.67) · pass=no · 8.5s
ok   rental-portfolio: complete · 6/9 (mean 0.67) · 2 trial(s) · pass@1=0 · 24.1s
     trial 1/2: complete · 6/9 (mean 0.67) · pass=no · 8.8s
     trial 2/2: complete · 6/9 (mean 0.67) · pass=no · 7.1s
ok   showing-booking: complete · 6/9 (mean 0.67) · 2 trial(s) · pass@1=0 · 16.0s

slug                               dm  M1  M2  M3  M4  M5  M6  M7  M8  M9  total  baseline     n  pass@k
---------------------------------------------------------------------------------------------------------
coffeehouse2home-property-ledger   1   0   1   0   0   1   1   1   1   1   0.67   delivery ≈ 1 2  0.00
field-ops-suite                    1   0   1   0   0   1   1   1   1   1   0.67   delivery ≈ 1 2  0.00
house-flip-manager                 0   0   1   0   0   1   1   1   1   1   0.67   delivery ≈ 2 2  0.00
real-estate-crm                    1   0   1   0   0   1   1   1   1   1   0.67   delivery 1/1 2  0.00
rental-portfolio                   1   0   1   0   0   1   1   1   1   1   0.67   delivery ≈ 1 2  0.00
showing-booking                    1   0   1   0   0   1   1   1   1   1   0.67   delivery 1/1 2  0.00
trials: 2 per case · k=1 (effective ≤ trials) · pass@1: ...=0.00 (×6) · pass^n(all trials): ...=0.00 (×6)
trials: pass@1 mean=0.000 · flaky=none · grader leaks=none

wrote ...\research\eval-out\results.json · 6 entries · history appended to ...\history.json
skips recorded: 1 — corpus
exit 0 — results are data, not failures
```

Exit code: **0** (`EVAL_EXIT=0`).

**2) results.json shape** (regenerated by that run — `generatedAt 2026-09-17T02:49:36.070Z`,
`mode keyless`) — `trials=2` + perTrial arrays confirmed for every entry:

```
summary.trials = 2 | cases 6 | passAtK {"k":2,"cases":6,"passed":0,"passedSlugs":[],"meanPassAt1":0} | flakyCases [] | graderLeaks [] | skipped 1
coffeehouse2home-property-ledger | trials 2 passes 0 flaky false flakinessMeasurable true passAt1 0 passAtK 0 passAll 0 | perTrial n 2 | t1:fail/0.6667 t2:fail/0.6667 | leak false scanned 38
field-ops-suite                  | trials 2 passes 0 flaky false flakinessMeasurable true passAt1 0 passAtK 0 passAll 0 | perTrial n 2 | t1:fail/0.6667 t2:fail/0.6667 | leak false scanned 30
house-flip-manager               | trials 2 passes 0 flaky false flakinessMeasurable true passAt1 0 passAtK 0 passAll 0 | perTrial n 2 | t1:fail/0.6667 t2:fail/0.6667 | leak false scanned 38
real-estate-crm                  | trials 2 passes 0 flaky false flakinessMeasurable true passAt1 0 passAtK 0 passAll 0 | perTrial n 2 | t1:fail/0.6667 t2:fail/0.6667 | leak false scanned 38
rental-portfolio                 | trials 2 passes 0 flaky false flakinessMeasurable true passAt1 0 passAtK 0 passAll 0 | perTrial n 2 | t1:fail/0.6667 t2:fail/0.6667 | leak false scanned 36
showing-booking                  | trials 2 passes 0 flaky false flakinessMeasurable true passAt1 0 passAtK 0 passAll 0 | perTrial n 2 | t1:fail/0.6667 t2:fail/0.6667 | leak false scanned 36
```

12 per-trial emit workspaces exist on disk (`research/eval-out/<slug>--trial-1|2/`) — the visible
artifact of the multi-trial path. The 1-trial legacy run's `<slug>/` dirs are untouched; the
legacy single-trial path itself is byte-identical by construction (`trialEmitDir`).

**3) Gate legs** — `npm run typecheck` → **exit 0**; `node --test "scripts/**/*.test.mjs"` →
**# tests 235 · # pass 235 · # fail 0** (run-eval.test.mjs contributes 15). No `src/` file was
touched by this lane; the full src suite was last green at the W5 boundary (src 1811/1811,
`gate.sh {"ok":true}`). Note: the scripts leg must run with a TTY-capable shell — under a
background/piped shell one test exits `stdin is not a tty` (environment artifact, not a repo
failure; reproduced green in the normal foreground terminal in the same session).

## 5. Not done / residual limits

- **KEYED run — user-owned (T0.10).** Needs a valid RapidTool `DEEPSEEK_API_KEY`. The keyless run
  is the honest floor: every case 6/9 (mean 0.67) and **pass@1 = 0** — the graders demand
  `meanAtLeast: 1`, which keyless software cannot reach. Keyless scores improve ONLY with a keyed
  run; nothing here is a fabricated pass.
- **Flakiness evidence is "none observed at 2 trials"** (both trials failed on all 6 cases) — NOT
  "no flakiness exists". A keyed run (and/or more trials) is the real flakiness probe.
- W5's 1-trial `results.json` was superseded by this run (the recorded baseline is now the
  `trials=2` file); the legacy single-trial CLI path is pinned by tests and unchanged.
- **No W6 code defect was exposed:** the >1-trial path ran clean end-to-end on the first honest
  run (no crash, no false metric, 0 leaks), so `scripts/run-eval.mjs` needed no fix and no new
  test beyond the W5-L5 suite this lane executed.
