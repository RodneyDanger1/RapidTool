# 337 round (W51) — parent / boundary record

**Boundary owner:** parent. **Opened** 2026-10-02 at HEAD `dd6194c`, tree clean. **Three bug hunters plus
two watchdogs**, then a three-agent follow-up round that landed every defect the watchdogs reported.
Contract: `wave_plans/W51/README.md`; guardrails: `wave_plans/W51/GUARDRAILS.md`. Logs:
`fixes/337_1_core.md` … `fixes/337_5_guardian.md`.

**No tracked file was deleted** (verified independently: 0 deletions in the diff, 0 `D` statuses).

## 1. Boundary gates (after every writer stopped)

| Gate | Result |
|---|---|
| typecheck | **exit 0** (both legs) |
| lint | **exit 0**, 0 warnings |
| assertions | **exit 0** |
| tests | **scripts 411 / lib 2889 / 0 fail / 2 skipped**, exit 0 |
| build | **exit 0** |
| `gate.sh` | **`ok:true`, exit 0**, `flakes: []`, `hardFails: []` |

Baseline: 411 scripts + 2848 lib → **+41 tests, all green**.

## 2. The watchdogs' verdicts

**Guardian (337-5): NO DESTRUCTION over 15 checks in ~45 minutes.** Zero tracked files deleted or
truncated; zero do-not-touch paths changed; `git stash` empty and the reflog free of destructive ops at
every check; HEAD never moved. Its baseline was a 2,046-file manifest (path + index blob + size + owner
lane) with 1,868 outside-owned watch paths. Its end audit reproduced **every** hunter's landed claim and
**every** test delta exactly on disk (337-1: +4 tests across 4 files; 337-2: +4; 337-3: +2), and found the
largest proportional edit was 13.4% of one file — no mass rewrites.

**Verifier (337-4): every fix CONFIRMED by independent re-derivation** (each one driven RED with the
pre-fix line restored in a scratch copy, then GREEN on the tree), and it proved the new tests have teeth by
mutation. It also refuted one thing and found five more issues — all landed in §3.

## 3. Defects found and fixed this round

**Hunters (each RED-first, both runtimes):**

1. **`gate-stats.ts` — the fast/rubber flag compared the ROUNDED mean.** Latencies `19999+20000+20000` give a
   raw mean of 19999.67 (below the 20 s line ⇒ "rubber") but round to 20000, so the old code said `ok`; the
   converse case said `fast`. Now branches on the raw mean, keeping the rounded value for display.
2. **`compaction.ts` — caps 64..90 shipped a TRUNCATED elision marker.** 5,676 marker-broken cases across
   caps 64–90: the old `out.slice(0, cap)` cut *through* the marker, leaving an unparseable stub while the
   reported elision under-counted. Falls back to the counted head-cut when the full marker cannot fit.
3. **`planning.ts` — an over-long model step id was silently truncated** (60 → 48 chars, no
   `…[TRUNCATED]`), violating the module's own "a cut is never silent" contract.

**The auth cluster could not load under the node runner** (two independent barriers): extensionless
imports (`server.ts:48`'s `./preview` blocked three live modules) **and** `pglite-dialect.ts`'s TypeScript
**parameter properties** (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`) — the earlier one-line remedy was necessary
and insufficient. All seven modules now load.
4. **`db.ts` — the eager PGLite bootstrap KILLED the process:** it logged the failure then **rethrew**,
   creating an unhandled rejection (child exit 1), and `auth/server.ts` floated a second. Now logs and
   clears the slot, with an explicit `.catch` on the auth kick.
5. **`crew.server.ts` — plan-act ignored the role validation it had just performed**, re-reading raw
   `opts.roles`, so a hostile non-array string indexed into `ROLE_SPECS` and threw a `TypeError`
   mislabelled `RT_E_INTERNAL`. Now threads the validated value.
6. **The "tested" evidence hash conflated its inputs** — `fnv1a(\`${module}${evidence}\`)` with **no
   separator**, so `applyVerifyOutcome`'s dedupe silently dropped a *different* verified source as a
   "duplicate", and the same value became the `evidenceHash` the DoD's `p6-verified` reads. Fixed at three
   twin sites with the repo's `\u0002` separator.

**Follow-up round (landed after the audits):**

7. **A guard that could not fail for the class it claimed to pin** — the new auth import-contract check
   treated `.server`/`.client` name segments as file extensions, leaving two of the three files it was
   written to protect unprotected. Fixed with a real code-extension predicate, and the fix proven by
   reverting each of the four real offenders in a scratch copy (each now trips the pin).
8. **The compaction fix was never mirrored** into its byte-identical twin `node-runner.server.ts`
   (`clampRunnerOutput`) — the same cap-64..90 truncated-marker defect. Fixed, with the torn-marker regime
   the honesty guard pinned (it had said it was "expected to FLIP when the fix lands") rewritten to the
   fixed regime.
9. **A verifier that could not fail:** `entry-oracle.ts`'s `complete` was vacuously true over an empty row
   set (`every()` on `[]`) and `pending` was always 0; the module had **no test of its own**. Fixed and
   given its first test file (0 → 9 tests).
10. **A fabricated score:** `scorecard.ts` stored a present criterion cell with a non-numeric `score` as
    `{score:0}` while its own contract says absence is never defaulted to 0, and `aggregateCriteria`/
    `buildDelta` then emitted a `0 − before` regression with a `"down"` direction; `missingCriteria` had
    **zero consumers**. The cell is now omitted so the aggregates skip it. (Both watchdogs found this
    independently.)
11. **`maker-score.ts:477` threw** (`TypeError … reading 'slice'`) — fixed with a `typeof` guard.
12. **`websearch.server.ts:349` threw on a non-string title**, killing the last-resort Wikipedia provider
    (inconsistent with the file's own hardening) — fixed.
13. **`sandbox.ts`** — `verifyClaims` called `c.expect.toLowerCase()` unguarded (now refuses a malformed
    row), and `runSandboxed` leaked the blob URL if `workerFactory` threw (now revoked).
14. **`preview-embedder-origin.ts`** — the comment and the code disagreed; the code is right (a
    `*.grok-sandbox.com` guest carries no `.preview.` label), so the header was corrected and both arms
    pinned.
15. **`console.tsx:2404`** — a `void rejectAsync(...)` chain with no `onRejected`; now surfaces the failure.
16. **Five allowlist reasons in `scripts/check-module-coverage.mjs` were factually false** (they described
    the exact blockers the round had just fixed) — rewritten to their real remaining class and blocker.

Plus, landed by the follow-up: the `12` → `PHASE_LAST` phase-bound residue across ten sites **with a
falsifiable pin** (a source scrub plus `PHASE_LAST === 12`), the two dead conditions (`compaction.ts`'s
`!out.includes(marker)` — where the Verifier's literal suggested fix turned out to be *also* entailed-dead,
so it was collapsed rather than double-guarded — and its `node-runner` twin, closed by the boundary owner),
`write-set.ts`'s no-op ternary, a softened over-claiming separator comment, and the `repair` →
checkpoint wiring (336-2's proposal, re-reported by the guardian): `repairTreeDir` now accepts a
`checkpointDir` and refreshes/clears the snapshot at its single `finish()` seam, with one granted line in
the CLI's `repair` arm.

## 4. Boundary-owner work

- Corrected my own wave README: the Guardian falsified its "jointly complete ownership" claim — ~20
  functional `src/lib` modules sit in no hunter's lane, and they are now named in the correction.
- Closed the last dead condition in the `node-runner` twin (one line, behaviour-identical) after the
  follow-up copied the round-1 form verbatim.
- Blessed two new test files placed for runner-glob reasons (`db-bootstrap.test.ts`,
  `auth-import-contract.test.ts`, plus `entry-oracle.test.ts`, `preview-embedder-origin.test.ts`).
- Verified independently: 0 deletions; the gate of record (above); and the Verifier's own numbers on the
  settled tree (full lib leg 2860/2850/0, `tsc` 0, `eslint` 0).

## 5. What this means for the "autonomous software factory" question

Measured state, all on disk:

- **`doctor` still reports `autonomousSoftwareFactory: false`**, with two gaps: *"no human-approved fixtures
  (decidedBy:"human")"* and *"product-complete bar not met (skip≠green; stubs≠complete)"*. The two
  multi-job gaps that stood three waves ago ("leftover jobs are reexports or stubs", "no real multi-job
  product") are **gone**: `leftoverJobsAreReexportsOrStubs: false`.
- **With a funded key the pipeline genuinely produces a real product:** a keyed run reached **P6 PASS** with
  `lastTest.label: "tested"` from a green tree-run, `p6-arch` PASS on a 5-file tree,
  `treeRun.substance {stubs:0, reexports:0, real:3}`, `emit --run ok:true`, and advanced to P8.
- **Without a key it cannot complete a product, by design:** the acceptance harness (run for the first time
  this wave, into scratch) scored **all 11 corpus fixtures at mean 0.56 / pass@1 = 0.00**, every one ending
  `dod · RT_E_GATE_PENDING` — the honest signature of a labeled placeholder floor stopping at the
  product-completeness gate instead of sealing a false green.
- **The remaining autonomy gaps are specific:** (a) keyed synthesis coverage is **not deterministic** run to
  run (one run emitted 7 modules and passed `p6-arch`, another emitted 5 and failed it), so an unattended
  run cannot be relied on to reach the same verdict twice; (b) the DoD can pass while the tree's declared
  `typecheck`/`build` never ran (an honest named limit — the tree-run copy excludes `node_modules`), which is
  the "product-complete bar"; (c) fixture acceptance requires a `decidedBy:"human"` stamp by design, and the
  machine door (`--seat autopilot`) deliberately does not claim a human decision; (d) the stock HITL gates
  park for a seat approval, so a fully unattended run needs the autopilot seat and is therefore *governed*
  autonomy rather than unattended autonomy.
- **Not demonstrated anywhere in the record:** a keyed run driven end-to-end from brief to P12 delivery
  unattended, with the delivered artifact then verified.

§6 of the next wave's record carries the work that closes exactly those four gaps.
