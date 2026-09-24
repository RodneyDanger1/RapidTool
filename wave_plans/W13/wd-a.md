# W13 · WATCHDOG A — watch lanes 1 & 2 (inventory + defects), verify, and correct them with truth

**Read this file FIRST.** Then `AGENTS.md`, `RESUME.md` §5.4 + §13, and the two lane briefs you watch:
`wave_plans/W13/lane-1.md` (inventory / claim-vs-evidence) and `wave_plans/W13/lane-2.md` (defects).

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
TREE STATE: green + committed (7582771) as of 2026-09-24 11:08 — the lanes you watch are READ-ONLY, so
the tree must STAY clean: if `git status --short` ever shows a modified src/scripts file during your
watch, that is a headline finding (report it with the path + mtime, do not fix it).

YOUR TWO LANES (delegation `deleg_b77255e7`): task-0 = lane 1 → `research/multiagent/219a_inventory_and_reality.md`;
task-1 = lane 2 → `research/multiagent/219b_defects_live_status.md`.
Live transcripts: `$HOME/AppData/Local/hermes/cache/delegation/live/deleg_b77255e7/task-0.log` and `task-1.log`.

THE OWNER'S STANDARD (verbatim): "no hallucinations/100% factual logic/… 100% truth." Your job is to be
the reason that is true for these two dossiers.

RULES:
1. You may WRITE: your report file (below) AND the two dossier files above — the latter ONLY under the
   correction protocol in §Protocol. You may NOT edit RapidTool's src/, scripts/, or any other file.
   No git mutations of any kind.
2. ALLOWED heavy commands: read-only greps/reads and ≤2 targeted test runs
   (`node --experimental-strip-types --test --test-concurrency=2 <file>`). FORBIDDEN: `npm run typecheck`,
   `npm test`, `npm run build` — nine agents share this 8 GB machine.
3. Every claim you make needs a command or a file read behind it. Unknown ⇒ UNVERIFIED + what you tried.
4. Report file: `fixes/219_wdA_lane12_corrections.md` (skeleton first, then fill).
```

## Protocol — how to "fix up their plan with truth" without breaking the record

For every correction you apply to a lane's dossier, use this exact, attributable form:

```
> [WD-A · 2026-09-24] CORRECTED: <the claim as written> → <the fact> — evidence: <file:line or
> command + output>. (verified by WD-A, not by the lane)
```

and, where the claim is simply unprovable:

```
> [WD-A · 2026-09-24] CONTRADICTED / UNVERIFIED: <claim> — <what you tried and what you got>.
```

Hard rules for corrections: never rewrite a lane's prose; never delete a lane's finding; never add
content you did not verify yourself; if a lane's claim is right, leave it alone (log it as CONFIRMED in
your report instead). A correction that is itself wrong is worse than the original error.

## Numbered plan

1. **Skeleton + baseline.** Create your report; snapshot `git status --short`, the mtimes of both
   dossiers, and the two transcripts' mtimes. Paste raw output.
2. **Poll both lanes at least 3 times with `sleep 90` between polls**, recording real timestamps: what
   each lane is doing right now, what files it has written, anything written outside its allowed set.
3. **Independently verify 6 claims per lane** (12 total), chosen to cover the *load-bearing* ones —
   for lane 1: the `doctor` gaps decode, the verb count, the claim-vs-evidence verdicts on the
   README's biggest claims, the emitted census; for lane 2: the status of each register item it marks
   FIXED/OPEN (spot-check at least one FIXED and two OPEN), the silently-broken hits, and the
   "three loudest examples". For each: the command you ran, the raw result, and
   VERIFIED / CONTRADICTED / UNVERIFIED. Put the table in your report and apply §Protocol corrections
   to the dossiers where needed.
4. **Test the two dossiers for the tell-tale hallucination shapes** and report each instance you find:
   round numbers that no command produced; a `file:line` that does not contain what is claimed; a
   "FIXED" verdict with no command behind it; a competitor/summary claim that came from memory; a
   count that contradicts `fixes/218_w12_close_record.md` §5 (the gate numbers are authoritative —
   261 scripts, 1957 lib).
5. **Bottom line at the top of your report**: per lane — `claims checked / confirmed / contradicted /
   unverified`, whether the dossier is TRUSTWORTHY-AS-WRITTEN or NEEDS-CORRECTION, and the single most
   important thing the parent should know before quoting either dossier in the final answer.
