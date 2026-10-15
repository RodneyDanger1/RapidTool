# W355 · lane `inspector-correctness` — bug inspector 1 of 2

**Wave:** W355 (the audit/freeze wave). **Kind:** read-only bug inspection. **Author:** the wave parent.
**You are one of 6 Wave 0 lanes** (3 reviewers · 2 bug inspectors · 1 cartographer).

## Mission

Classify and root-cause the **known red baseline**, and hunt the crash/robustness classes that tests
do not cover. The tree on disk is currently red; your job is to say exactly why, per item, with the
command that proves it — and whether each is a genuine regression, a test that drifted, or an
environment artifact.

## The known red baseline (verify these, do not assume them)

**`npx tsc --noEmit` → exit 2, 5 errors:**

```
src/lib/headless.test.ts(5999,15):  TS18048 'res.steps' is possibly 'undefined'
src/lib/scaffold.test.ts(2712,25):  TS2339 Property 'gameTemplate' does not exist on type 'ScaffoldResult'
src/lib/scaffold.test.ts(2719,25):  TS2339 Property 'gameTemplate' does not exist on type 'ScaffoldResult'
src/lib/wild-step.test.ts(1399,44): TS2345 '"complete"' not assignable to '"awaiting_hitl" | "rejected" | "locked"'
src/lib/wild-step.test.ts(1415,44): TS2345 '"complete"' not assignable to '"awaiting_hitl" | "rejected" | "locked"'
```

**`npm test` → exit 1, 622 tests / 607 pass / 15 fail** (log: `%TEMP%\rt-baseline-npm-test.log`).
The src leg never ran (`npm test` chains legs with `&&`). The 15:

```
163  module-coverage: a stale allowlist entry (module now reached) fails the guard
164  module-coverage: the CLI runs green on the live repo and exits 0
204  W49 · 335-4 / 338-2: a fresh tree is now VERIFIED; --require-verified exits 5 when unresolvable
208  341-6 - a SINGLE keyless `unattended` clears the stock gates and seals complete
216  346 P0-3 + W352 R-19 — `emit --run --git` withholds on a RED verdict; green is unchanged
217  346 L4 + W352 R-19 — `emit --check --git` withholds a red-check commit
218  W61 B1 — `emit --run --git` withholds RT_E_SUBSTANCE_EMPTY on empty substance
233  348 (W1): diagnose --project carries real per-phase stages + the pipeline review
246  a GREEN delivery-time tree-run commits, and the idempotent re-emit stays a green noop
345  C-06 emit --run --git must withhold a substance-empty tree
367  C-14 p6-arch must fail closed on a keyed attempt with no tree
407  C-06 real seam: treeSubstanceOf reports the hollow trees as empty
415  single command: the two signals are reported and the gate of record is exact
585  scripts typecheck: no NEW errors beyond the recorded per-file budget
586  scripts typecheck: npm run typecheck runs BOTH legs (src + scripts)
```

Likely-but-unconfirmed first readings to check: `cli-exit-taxonomy.test.mjs:3261` reports
"a green `--run` verdict must still commit at exit 0" while stdout shows `ok:false` with 17 files —
a **functional regression** in the git-landing path. `prevention/replay-harness.test.mjs:153` reports
`fixtureIntegrity.missed: ["C-06"]` — **prevention guard C-06 stopped firing**. `check-module-coverage`
reports a stale allowlist naming new `src/lib/auth/*` modules. `typecheck-scripts.test.mjs` reports
itself as the one red file.

## Specific questions to answer

1. For **each** of the 5 type errors and 15 test failures: which side is wrong — the **source** or the
   **test**? Give the `file:line` and the reasoning. (The repo's rule is declare-or-strike: fix the
   cause, never the claim.)
2. Are the 15 failures **caused by the uncommitted in-flight work** (98 modified + 32 untracked), or do
   they reproduce on a pristine `30bce78`? The safety patch is at
   `%TEMP%\rt-campaign\baseline-working-tree.patch`. You may inspect it; you may **not** apply, stash,
   revert or check out anything.
3. **Root cause** each cluster: the `emit --git` withhold family (216/217/218/246/345), the prevention
   guard `C-06` miss (415, 407), the module-coverage allowlist drift (163/164), the diagnostics/
   driver family (204/208/233).
4. **Crash/robustness classes** beyond the test suite — confirm or refute each with a read or a
   targeted command:
   - `node:fs` imported into a client-safe module (the historical H2 crash class)
   - a caught error with no `RT_E_*` code and no ledger row (a silent swallow)
   - the secret redactor at `src/lib/node-runner.server.ts` treating a single-space key as a secret and
     replacing every space in captured output
   - the RUNLOCK guard refusing a drive while `src/**` changes mid-run
   - the load-sensitive child-spawn flake class (`compile-check.server` / `treeRun` parent)
5. **Flake vs defect.** Which of the 15 are order/timing sensitive (i.e. pass standalone)? Run the
   individual files to find out, and say which command you used.

## Deliverable

`research/multiagent/355_4_bugs_correctness.md` — the ONLY file you write. Structure:

1. **Method** — commands, including which test files you ran individually.
2. **The 20 red items, classified** — a table: `item | source-or-test | regression/drift/env | root
   cause | file:line | the command that proved it | Wave 1 fix owner`.
3. **Crash/robustness classes** — confirmed or refuted, each with evidence.
4. **Flake list** — passes standalone, with the command.
5. **What I could not verify.**
6. **The single highest-risk item** and why.

## Evidence bar (non-negotiable)

Every classification cites a command you actually ran or a `file:line` you actually read. If you cannot
prove a classification, say "unproven" rather than guessing one.

## Do not

- Do not edit any product file, the register, or another lane's report. **Do not fix anything** — this
  is diagnosis; Wave 1's `mender` lane fixes.
- Do not run `gate.sh` / `npm run build` / a full `npm test` (the full baseline is already captured in
  `%TEMP%\rt-baseline-npm-test.log`; re-running it wastes ~6 minutes and contends with other lanes).
  Targeted `node --test --test-reporter=tap <file>` runs are expected.
- Do not apply, stash, revert, or check out anything in git.
