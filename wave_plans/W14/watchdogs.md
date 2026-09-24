# W14 · WATCHDOGS α + β — watch all work (lanes AND the delegator), prevent error/obliteration/failure/bad code

**Both watchdogs share this file.** Read your own section.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.

CONTEXT (what just happened, so you can verify it):
- The delegator (parent) executed W0 lane 0 = **C-1**: the WB-1 gate-before-mint deadlock fix in
  `src/lib/headless.ts` (journey seam ~:1916-1958 + repairTreeDir seam ~:2502-2515) with a RED-first test
  in `src/lib/headless.test.ts`. Reported evidence: RED (`not ok 3`, 90/91) → fix → GREEN (91/91,
  typecheck_errors=0), logged in `fixes/236_c1_wb1_deadlock_fix.md`.
- Three lanes are running beside you (`wave_plans/W14/lanes.md`): L1 = C-2 (run-eval.mjs + headless.ts
  "dod" region), L2 = doc-truth sweep (README/AGENTS/board/register — docs only), L3 = OV-2 browser pass
  (browser-guard.mjs first, then the smoke against a dev server; console.tsx/styles.css only for defects).
- The plan corpus is FROZEN: `research/multiagent/220_tasklist_canonical.md`, `220_overhaul_plan.md`,
  `230_task_execution_playbook.md`, `fixes/228_*`. No lane may edit them; only the parent does (at merge).
- UNCOMMITTED tree: base `7582771` + C-1's changes + whatever the lanes land. `git status --short` is
  your truth meter.

THE OWNER'S ASK (verbatim fragments): "watch all work done/all agents work etc and delegator's work and
prevent error/obliteration/failure/etc/bad code" · "Do not rebuild before all tasks are done."

RULES (both): write ONLY your report file (below) + scratch outside the repo (`C:/Users/mnril/w14wd_<X>_scratch/`).
NEVER edit src/, scripts/, the plan files, or a lane's log — your corrections live in your report for the
parent to apply. No git mutations. Allowed: read-only reads/greps, polling with sleep, ≤2 targeted test runs
(`--test-concurrency=2`). FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build`.
Every claim = a file:line you read, a command you ran, or an explicit UNVERIFIED label.
```

## WD-α — the lanes' watcher (`fixes/238_wd_alpha_report.md`)

1. **Poll the three lanes ≥3 times** (`sleep 90`): find their transcripts under
   `$HOME/AppData/Local/hermes/cache/delegation/live/` (the newest delegations; lanes write
   `fixes/237_lane*_*.md`). Record real mtimes + what each has produced so far (file sizes).
2. **Ownership check:** for every file the lanes touch, verify it is inside their box
   (`wave_plans/W14/lanes.md`). A file outside a lane's box = **P1 incident** (name it, with `git status`
   evidence). In particular: nobody but the parent may touch C-1's seams or the plan corpus.
3. **Verify each lane's claims against bytes** (≥8 spot-checks total): the command in their log actually
   exists and was run (their log must paste its output); the `file:line` they cite contains what they say;
   their tests pass when you re-run the ONE file they name (≤2 runs total, budget them).
4. **The no-rebuild check:** for each lane's landing, ask "is this re-implementing something on the
   do-not-rebuild list (`220_tasklist_canonical.md` §2)?" — flag any instance.
5. **Bad-code check:** the classic shapes — a test that would pass with the fix reverted (weak), a claim
   without a command, a `skip`/catch that hides a failure, an edit that makes a HOT file unowned.
6. **Bottom line at the top:** `lanes polled: 3 · incidents: N · claims checked: N (ok/wrong/unverifiable)
   · rebuild flags: N` → **are the lanes' landed changes safe to keep, and is anything misreporting?**

## WD-β — the delegator's auditor + repo/plan guardian (`fixes/239_wd_beta_report.md`)

1. **Audit the delegator's C-1 work — adversarially.** This is your primary duty ("...and delegator's
   work"). Verify, with your own commands and reads:
   - the RED→GREEN claim: **run the new test file yourself** (`node --experimental-strip-types --test
     --test-concurrency=2 src/lib/headless.test.ts`) → must be 91/91; and read the diff of
     `src/lib/headless.ts` (`git diff -- src/lib/headless.ts`) → is the mint REALLY before the gate in
     **both** seams, and is the post-gate mint genuinely idempotent (`mintTreeRunTested` early-return at
     `codegen.server.ts:3212`)?
   - the honesty claim: does the fix preserve "never mint on red/unexecuted" (read `mintTreeRunTested`
     `:3209-3216` — `outcome.ok !== true` → no mint; `!ev.executed` → skip log, no stamp)? If the fix
     minted from a red or unexecuted run, that is a **P1 falsification** — say so with the line.
   - the "no conflict with :489" claim: open `headless.test.ts` around the red-gate test and the :489
     assertion; is the delegator's explanation (that verdict carries `tests: []`) actually true?
   - `fixes/236` vs the code: does the log overstate anything? Strike-list anything it cannot back.
2. **Guard the repo state.** `git status --short` at start and end: the ONLY expected modifications are
   C-1's two files + the lanes' own files (per their briefs). Any unexpected modification, any deletion,
   any shrinking file = incident with the diff.
3. **Guard the plan corpus** (the frozen files above): sizes must only grow (or stay), never shrink;
   md5s must not change except by the parent. Snapshot to `C:/Users/mnril/w14wd_beta_backup/` with a
   manifest at start; re-measure at end; prove restorability.
4. **Sweep for "bad code" introduced by ANY actor in this wave** (parent included): weak tests, silent
   catches, unbacked comments, claims without commands, edits to files nobody owns. Quote each.
5. **Bottom line at the top:** `C-1: CONFIRMED / FALSIFIED (why) · repo: clean/unexpected-changes ·
   plan corpus: intact/shrunk · bad-code findings: N` → **is the delegator's work sound, and is the wave
   safe to continue?**
