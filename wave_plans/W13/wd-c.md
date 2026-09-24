# W13 · WATCHDOG C — watch lanes 5 & 6 (the gap answer + the competitor codebases) and make the PLAN true

**Read this file FIRST.** Then `AGENTS.md`, `RESUME.md` §5.4 + §13, and the two lane briefs you watch:
`wave_plans/W13/lane-5.md` (gap-to-best + the plan) and `wave_plans/W13/lane-6.md` (competitor codebases
vs RapidTool). You are the watchdog on the two lanes whose output the owner will actually ACT on.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
COMPETITOR CLONES (read-only dataset): /c/Users/mnril/rt-competitors/ (17 clones). ⚠️ NEVER execute
anything from a clone (one carried a credential-stealer historically) — reading + grepping only.
TREE STATE: RapidTool is green + committed (7582771); the lanes you watch are READ-ONLY and the tree must
STAY clean — a modified src/scripts file during your watch is a headline finding (report path + mtime).

YOUR TWO LANES (delegation `deleg_b77255e7` + a second lane-6 delegation the parent will name):
task-4 = lane 5 → `research/multiagent/219e_gap_to_best_and_plan.md`;
lane 6 → `research/multiagent/219f_competitor_codebases_vs_rapidtool.md` (its transcript is the newest
`live/<delegation>/task-0.log` directory — `ls -dt $HOME/AppData/Local/hermes/cache/delegation/live/*/ | head -2`).

THE OWNER'S STANDARD (verbatim): "no hallucinations/100% factual logic/answers/helpfulness … fix up their
plan with truth." Lane 5 writes the plan; lane 6 supplies the competitor facts. Your job is to make the
plan's factual base airtight and to kill every invented competitor claim before the owner reads it.

RULES:
1. You may WRITE: your report file (below) AND those two dossier files — only under the correction
   protocol. You may NOT edit RapidTool's src/, scripts/, or any other file. No git mutations anywhere
   (including inside the clones).
2. ALLOWED heavy commands: read-only greps/reads in the repo and in the clones, and ≤2 targeted
   RapidTool test runs (`node --experimental-strip-types --test --test-concurrency=2 <file>`).
   FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build`; never execute clone code.
3. Every claim needs a command or a file read behind it (in the clone, for competitor claims). Unknown ⇒
   UNVERIFIED + what you tried.
4. Report file: `fixes/219_wdC_lane56_plan_corrections.md` (skeleton first, then fill).
```

## Protocol — corrections to a plan must survive a hostile reader

```
> [WD-C · 2026-09-24] CORRECTED: <claim/step as written> → <the fact> — evidence: <file:line or command
> + output>. (verified by WD-C, not by the lane)
```

```
> [WD-C · 2026-09-24] UNSUPPORTED CLAIM REMOVED-FROM-USE: <claim> — <why it cannot be cited>; the
> plan step that depended on it is flagged here so the parent can re-scope it.
```

Never rewrite a lane's prose or delete its findings; never add unverified content; if a claim is right,
log CONFIRMED instead. Where a plan step depends on a claim you contradicted, **say so explicitly** —
a plan built on an unchecked claim is the exact thing the owner said he does not want.

## Numbered plan

1. **Skeleton + baseline** (git status, both dossiers' mtimes, transcript mtimes — raw output).
2. **Poll both lanes ≥3 times with `sleep 90`**, real timestamps, current activity, files written.
3. **Verify lane 6's competitor claims independently — this is the highest-risk content in the whole
   inquest.** For at least 8 of its rows: open the SAME file in the clone yourself, paste the evidence
   (path + the symbol/line you actually saw), and mark VERIFIED / CONTRADICTED / UNVERIFIED. Any claim
   about a competitor that lane 6 could not have read (e.g. a mechanism with no file behind it, a
   "they do X" with no path) is CONTRADICTED-as-written and must be corrected or struck. Confirm the
   license check too (read one LICENSE file yourself).
4. **Verify lane 5's plan skeleton**: every step must name a real file (does it exist? `ls`/`grep` it),
   a done-when, and a verification command (is that command real and runnable?). Flag any step whose
   file does not exist, any "done-when" that is not observable, and any claim about RapidTool's current
   state that contradicts `fixes/218_w12_close_record.md` §5 (261 scripts / 1957 lib, gate green) or
   your own spot-checks. Where lane 5 leans on lane 6, cross-check the dependency and say whether it is
   load-bearing and verified.
5. **Cross-check the two dossiers against each other**: any place where lane 5's "the field's bar" is
   HIGHER or LOWER than what lane 6 actually found in the clones is a finding — the owner's decision
   depends on that number being real.
6. **Bottom line at the top of your report**: the plan's readiness verdict (`SOUND / NEEDS-CORRECTION /
   NOT-YET-CITABLE`), the count of competitor claims verified vs struck, and the single most important
   correction you made. That summary is what the parent reads first.
