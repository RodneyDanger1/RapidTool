# fixes/241 — W15 LANE 1: C-1's repairTreeDir seam gets its own RED-first test + the guard harness becomes a real pin

**Run:** 2026-09-24 by W15-L1 (Hermes subagent). Task ref: `wave_plans/W15/lanes.md` §LANE 1.
**Owns (only these):** `src/lib/headless.test.ts` (repair region: one new test, nothing else touched) · `scripts/browser-guard.test.mjs` (**new**) · this log.
**Scratch:** `C:/Users/mnril/w15l1_scratch/` (RED-proof copy + evidence files). HEAD = `7582771`.

## BOTTOM LINE (at top, per plan)

- **TASK A — DONE, RED-first.** `repairTreeDir`'s `recordGreen` mint-before-gate seam had **zero** coverage (command below); a refactor could silently revert C-1 there. One new test now pins it: green tree-run carrying an executed spec ⇒ `lastTest.label === "tested"` **and** the returned gate reflects the mint (p6-verified **not** unmet). RED proven twice against the pre-C-1 `headless.ts` (failing assert `+ undefined - 'tested'`; base-order gate `unmet` **contains** p6-verified); GREEN in the repo.
- **TASK B — DONE.** Lane 3's scratch-only 4-case harness is now `scripts/browser-guard.test.mjs` (**4/4 green**, exit 0). Sensitivity proven: against the pre-fix guard at HEAD the accept case is RED (`1 fail`) — the pin catches the L2/L3 Windows resolve-both-sides bug.
- **Count:** headless suite **92/92, 0 fail** (was 91; +1 exactly). `headless.test.ts` diff = **96 insertions / 0 deletions** — no existing assertion touched.
- **`src/lib/headless.ts` NOT touched by me** — md5 `36d0a670e6eafc295644730156004a08`, byte-identical to the file WD-β audited (fixes/239 §1.1).
- **One read-only note for the parent:** the F1 under-report from `fixes/239` reproduces in my probe (`repairTreeDir` on green-tree-run + red gate returns `minted: false` while `project.lastTest` carries a fresh `"tested"` stamp) — observed, not asserted, not my box to fix.

## TASK A — the repair seam test

### A.1 The coverage gap (the "absence" evidence)
```
$ cd "/c/Users/mnril/Desktop/RapidTool Main"
$ grep -c "repairTreeDir" src/lib/headless.test.ts
0
$ grep -rn "repairTreeDir" src/lib/*.test.ts
(nothing)
```
`repairTreeDir` (`src/lib/headless.ts:2452`) was exercised by **no** test file — the journey seam's C-1 test (`headless.test.ts:513-547`) covers `driveP6Journey` only. A revert of the repair-seam fix would pass 91/91.

### A.2 What the new test asserts (headless.test.ts, new describe after the journey block)
- Writes `src/generated/hvac.ts` into a temp dir (a real artifact dir; path is inside `REPAIR_TREE_ALLOWED_ROOTS` so the re-import reads it).
- `base = drainToComplete(createProject({brief: FIXTURE_BRIEF}))` → P6 record `complete`, `lastTest {ok:true, detail:"tests.pass"}` (no label).
- Candidate project: base + one `generatedTree` row (`src/generated/hvac.ts`).
- Injected `deps.runTree` → the executed-green fixture (1 spec file `run:"pass"`, 1 assertion — `treeRunTestedEvidence().executed === true`; same fixture discipline as the journey C-1 test).
- Asserts: `outcome === "failed"` (green tree-run + honestly-red gate — the fixes/159 F4 shape), `cycles === 0`, `lastTest.label === "tested"` + non-empty `evidenceHash`, `gate.passed === false`, `gate.unmet.length > 0` (non-vacuous), and `!gate.unmet.some(u => u.includes('lastTest.label === "tested"'))` — **the p6-verified criterion must not be unmet**, i.e. the gate was recorded *after* the mint.

### A.3 RED — proven, not claimed
Scratch copy of `src` (`C:/Users/mnril/w15l1_scratch/red/`, node_modules = junction to the repo's) with **`src/lib/headless.ts` replaced by `git show HEAD:src/lib/headless.ts`** — the true pre-C-1 bytes, no hand-editing. Test file byte-identical to the repo's (`md5 57fb08f5dd713df185fab22d88970bdd` both sides).
```
$ cd /c/Users/mnril/w15l1_scratch/red
$ node --experimental-strip-types --test --test-name-pattern="C-1 repair seam" src/lib/headless.test.ts
not ok 1 - a green tree-run carrying an executed spec mints lastTest "tested" BEFORE the gate — …
    error: green tree-run with executed specs ⇒ tested-equivalent minted before the gate (C-1, repair seam)
      + actual - expected
      + undefined
      - 'tested'
# pass 0 · # fail 1  (exit 1)
```
Second facet (base-order gate contents, same fixture via `red/probe_base.mjs`): `lt = {ok:true, detail:"tests.pass"}` (no mint) and `gate.unmet` = **[p6-verified, p6-brief-fit, p6-arch]**, `p6VerifiedUnmet: true`. So under the pre-C-1 order **both** assertions of the test are genuinely RED.
Evidence files: `evidence/red_run.txt`, `evidence/base_probe.txt`.

### A.4 GREEN
```
$ cd "/c/Users/mnril/Desktop/RapidTool Main"
$ node --experimental-strip-types --test --test-name-pattern="C-1 repair seam" src/lib/headless.test.ts
# pass 1 · # fail 0  (exit 0)
$ node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts
# tests 92 · # pass 92 · # fail 0  (exit 0)   ← was 91; +1, no other assertion touched
```
- Full-run TAP: `evidence/headless_full_run.txt` — `FULL_EXIT=0`, `# tests 92 · # suites 28 · # pass 92 · # fail 0`, tail `# duration_ms 95915.71`; the new test rides the suite as `ok 11 - C-1 repair seam — repairTreeDir's recordGreen mints before the gate (W15-L1)` (its subtest `ok 1` at TAP line 284).
- **Fresh re-run at close (both done-when commands):** guard `# tests 4 · # pass 4 · # fail 0` exit 0 (850 ms); headless `# tests 92 · # pass 92 · # fail 0` exit 0 (`duration_ms 62721.20`) — TAP `evidence/headless_full_rerun.txt`, new test `ok 11` again at line 290.
- **Scoped lint (only the two changed files):** `./node_modules/.bin/eslint scripts/browser-guard.test.mjs src/lib/headless.test.ts` → exit 0, no findings. Whole-repo `npm run lint` / `npm test` / `npm run typecheck` / `npm run build` are boundary/parent-only per the wave rules — not run by this lane (repo is mid-wave with other lanes' uncommitted edits; the parent's boundary gate owns them).

## TASK B — `scripts/browser-guard.test.mjs` (new pin)

- Ported from `C:/Users/mnril/w14l3_scratch/guard-check.mjs` (WD-α finding R2). Each case runs in a child of the test file (`node <self> --case <name>`) because the guard's `fail()` calls `process.exit(1)` — an in-process refusal would kill the runner. Child cwd pinned to `C:\` so `resolve("/workspace")` is deterministic; `allowedDirs` stays the literal `["/workspace"]` the real callers pass (`scripts/browser-smoke.mjs:30-41`), which is what makes the accept case pin the Windows resolve-both-sides fix. Cases 2–4 additionally assert `stdout === ""` (a refused path never prints the success JSON) and the refusal message names `/workspace` + `screenshot`.
- **Green (done-when command):**
```
$ node --experimental-strip-types --test --test-concurrency=2 scripts/browser-guard.test.mjs
ok 1 - accepts a screenshot path under the POSIX-literal allowed dir (Windows resolve-both-sides)
ok 2 - refuses a `..`-escape …   ok 3 - refuses a path outside …   ok 4 - refuses the allowed dir itself …
# tests 4 · # pass 4 · # fail 0  (exit 0)
```
- **Sensitivity (bonus RED):** same test file + the **pre-fix** guard (`git show HEAD:scripts/browser-guard.mjs`) in scratch `guard_red/`:
```
not ok 1 - accepts a screenshot path under the POSIX-literal allowed dir …
# pass 3 · # fail 1  (exit 1)
```
The pin catches the bug Lane 3 fixed. Evidence: `evidence/guard_green_run.txt`, `evidence/guard_red_run.txt`.

## Files & ownership (git evidence)

```
$ git diff --numstat -- src/lib/headless.test.ts src/lib/headless.ts
96      0       src/lib/headless.test.ts
19      1       src/lib/headless.ts      ← pre-existing C-1 diff (not mine)
$ git status --short -- scripts/browser-guard.test.mjs src/lib/headless.test.ts src/lib/headless.ts
 M src/lib/headless.test.ts
 M src/lib/headless.ts
?? scripts/browser-guard.test.mjs
$ md5sum src/lib/headless.test.ts scripts/browser-guard.test.mjs src/lib/headless.ts
57fb08f5dd713df185fab22d88970bdd *src/lib/headless.test.ts
8d6cb86d43f343f6546e9b75ac1933a9 *scripts/browser-guard.test.mjs
36d0a670e6eafc295644730156004a08 *src/lib/headless.ts   ← == WD-β's audit md5 (fixes/239 §1.1)
```
Only the two owned files + this log were created/edited. `headless.ts` has 0 bytes changed by me (md5 proof). Scratch lived only under `C:/Users/mnril/w15l1_scratch/` (the `red/` copy uses a directory **junction** for `node_modules` — a link, no copies of deps).

## Method & limits

- Ran: `grep`, `git show/diff/status`, `md5sum`, `cp -r` to scratch, 4 `node --test` invocations (2 RED-proof in scratch, 2 GREEN in repo — guard + filtered + full) + 2 scratch probes + 1 guard-sensitivity run. No `npm run typecheck` / `npm test` / `npm run build` (forbidden, boundary/parent).
- The new test uses the **real** `recordGateInto` — `RepairTreeDeps` exposes only `synthesize`/`runTree`, so the honest red gate over the fixture content (F4 shape) is the real shape; assertions are on the mint + the gate's unmet list, not on a faked gate.
- `headless.test.ts` diff is 96 insertions / **0 deletions** — the only existing lines added are one import (`repairTreeDir`); every pre-existing assertion byte-unchanged.
- Not asserted anywhere: `res.minted` (its `false` on the FAILED return is the known `fixes/239` F1 under-report — observed in my probe, out of this lane's box).
- Editor-lint artifact only: the patch tool's `tsc` sanity run reports `TS6053 … not found` for this repo path (space in path, unquoted) — an environment artifact, not a real error; the parent's boundary typecheck owns type truth.
- RED-proof copy caveat: `git show HEAD:` is the pre-C-1 `headless.ts` of commit `7582771` (md5 of the scratch copy `32f5f2aff0b71a8167a7e17d0c4afd9a`); the conclusion "the pre-C-1 order fails this test" is drawn from that real file, not from a hand-edited simulation.
- Wrapper artifact (declare-or-strike applied to myself): one attempt to launch the full suite as a background/redirected process died with only `stdin is not a tty` / `FULL_EXIT=1` and zero TAP output — the exact artifact WD-β hit (fixes/239 §1.1). The **foreground** run is the authoritative one (above); the evidence file was overwritten by it.
- Final state check (`md5sum` again at close): `headless.ts` `36d0a670…` (unchanged), `headless.test.ts` `57fb08f5…`, `browser-guard.test.mjs` `8d6cb86d…`.
