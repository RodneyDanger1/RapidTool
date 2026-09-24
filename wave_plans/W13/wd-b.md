# W13 · WATCHDOG B — watch lanes 3 & 4 (autonomy + self-improvement), verify, and correct them with truth

**Read this file FIRST.** Then `AGENTS.md`, `RESUME.md` §5.4 + §13, and the two lane briefs you watch:
`wave_plans/W13/lane-3.md` (autonomy blockers) and `wave_plans/W13/lane-4.md` (self-fixing/self-improving).

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
TREE STATE: green + committed (7582771) as of 2026-09-24 11:08 — the lanes you watch are READ-ONLY, so the
tree must STAY clean: if `git status --short` shows a modified src/scripts file during your watch, that is
a headline finding (path + mtime, report only).

YOUR TWO LANES (delegation `deleg_b77255e7`): task-2 = lane 3 → `research/multiagent/219c_autonomy_blockers.md`;
task-3 = lane 4 → `research/multiagent/219d_self_improvement_reality.md`.
Live transcripts: `$HOME/AppData/Local/hermes/cache/delegation/live/deleg_b77255e7/task-2.log` / `task-3.log`.

THE OWNER'S STANDARD (verbatim): "no hallucinations/100% factual logic/… 100% truth." You are the reason
that is true for the two hardest dossiers in this inquest — the two where a plausible-sounding mechanism
is most likely to be invented (there is NO API key on this host, so every keyed behaviour is
traced-not-run and easy to overstate).

RULES:
1. You may WRITE: your report file (below) AND the two dossier files — the latter ONLY under the
   correction protocol. You may NOT edit RapidTool's src/, scripts/, or any other file. No git mutations.
2. ALLOWED heavy commands: read-only greps/reads, ≤2 targeted test runs
   (`node --experimental-strip-types --test --test-concurrency=2 <file>`), and CLI verbs that do not
   modify the repo. FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build` — nine agents share this box.
3. Every claim needs a command or a file read behind it. Unknown ⇒ UNVERIFIED + what you tried.
4. Report file: `fixes/219_wdB_lane34_corrections.md` (skeleton first, then fill).
```

## Protocol — corrections must be attributable and provable

```
> [WD-B · 2026-09-24] CORRECTED: <claim as written> → <the fact> — evidence: <file:line or command +
> output>. (verified by WD-B, not by the lane)
```

and for the unprovable:

```
> [WD-B · 2026-09-24] CONTRADICTED / UNVERIFIED: <claim> — <what you tried and what you got>.
```

Never rewrite a lane's prose, never delete a finding, never add unverified content. If a claim is
right, leave it and log CONFIRMED in your report.

## Numbered plan

1. **Skeleton + baseline** (git status, dossier mtimes, transcript mtimes — raw output pasted).
2. **Poll both lanes ≥3 times with `sleep 90`**, recording real timestamps, current activity, files
   written, and anything written outside the allowed set.
3. **Independently verify 6 claims per lane** (12 total), aimed at the load-bearing mechanisms:
   - lane 3: the exact `doctor.ts` latch conditions (read that function yourself and confirm the four
     gap strings), the `enforceDod`-defaults-to-keyed claim, the exit-3 `RT_E_LLM_NOT_CONFIGURED` path,
     the wild-mode/gate step table (pick 3 steps and confirm each against the code it cites), the
     "no isolator on this host" statement (you may re-run `docker --version` / `bwrap --version` /
     `wsl.exe --status` read-only and paste the output), and the named highest-leverage blocker.
   - lane 4: the lesson-loop chain hop by hop — **verify at least 4 hops yourself** (mint site, store,
     selection, prompt injection) and check the CLOSED/OPEN/PARTIAL verdict against what you find; the
     repair-loop claim (does a repair path exist that needs no human? cite it or contradict it); the
     "single smallest upgrade" proposal's feasibility (does the file it names exist and contain what it
     says?). Pay special attention to any claim that something is "wired" — the W11 watchdog caught a
     canonical instance of `defined-but-never-called` in this exact area (`probeTagsFromSignature`),
     so treat "wired" claims as guilty until a call site is shown.
4. **Hunt the four hallucination shapes** in both dossiers and report each: round numbers no command
   produced · a `file:line` that does not contain the claimed symbol · a mechanism asserted with no
   call site · a keyed behaviour described as if it had been run (there is no key — it cannot have been).
5. **Bottom line at the top of your report**: per lane — `claims checked / confirmed / contradicted /
   unverified`, TRUSTWORTHY-AS-WRITTEN or NEEDS-CORRECTION, and the one thing the parent must know
   before quoting it.
