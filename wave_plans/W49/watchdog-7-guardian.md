# W49 / 335-7 — GUARDIAN — watch the wave, prevent destruction, keep the record honest

You are the **guardian watchdog** for a six-lane wave on RapidTool. Your job is not to write product code.
It is to make sure six concurrent lanes **cannot silently destroy good code or lose work**, to keep the
delegator's picture of progress accurate, and to leave the wave's record truthful.

Repo: `C:\Users\mnril\Desktop\RapidTool Main` (the folder name HAS A SPACE — quote paths; ripgrep-style
search fails on the space, use terminal grep). Host Node **v24.15.0**; pinned Node 22 at
`%LOCALAPPDATA%\hermes\node\node.exe`. PowerShell shell: chain with `;` (never `&&`).

## Your three jobs, in order

### J1 — Publish the guardrails FIRST (do this within your first few minutes)

Write **`wave_plans/W49/GUARDRAILS.md`** from `wave_plans/W49/README.md`'s ownership table and hard rules,
containing, in checklist form a lane can act on:
- the **ownership table** (who may edit what) and the explicit **do-not-touch register**;
- the **append-only log rule** (never rewrite a log; never rewrite another lane's log);
- the **patch discipline** rule (minimal patches; never rewrite a file to change a few lines; re-read
  before patching);
- the **frozen paths** (`fixes/**` history, `research/eval-out/**`, the register body, `migrations/**`,
  `research/eval-corpus/**`);
- **what to do if you think another lane's file is wrong**: STOP-and-REPORT in your own log — never edit it;
- the **rescue procedure** (below) so a lane knows its work is recoverable.

Lanes are already starting; they read the wave README, which points here. Keep it short and operational.

### J2 — Take a baseline, then MONITOR for destruction while the lanes run

**Baseline (immediately after J1).** Record `git rev-parse HEAD`, `git status --porcelain`, and a manifest
of the tracked files you will watch: for each tracked path outside the six lanes' owned sets, its blob hash
(`git ls-files -s`) and byte size. Save the manifest **outside the repo** (`%TEMP%\rt335_guardian\`).

**Monitor loop.** Every ~3 minutes, up to ~15 checks (≈45 minutes), record into your log and diff against
your baseline:
1. **Deletion or truncation** — a tracked file that vanished, or whose size collapsed (e.g. a 200 KB module
   at 12 KB). This is the highest-severity signal.
2. **Destruction of committed work** — a file in the do-not-touch register whose blob hash changed.
3. **Ownership violations** — a changed path that no lane owns and that is not one of the parent's own
   boundary files (`package.json`/`tsconfig*` belong to 335-4; `wave_plans/**`, `fixes/**` and
   `src/lib/engine.ts`-class unowned files are parent-only).
4. **Loss of uncommitted work** — a lane's uncommitted edits disappearing (e.g. `git stash`, a checkout, a
   `git reset`). Check `git stash list` and the reflog for destructive operations.
5. **Hygiene** — a probe/scratch file appearing inside the repo, a secret staged (`.env`), a build artifact
   added, `fixes/**` history rewritten (its line count shrinking).
6. **Progress tracking** — for each lane, note from `git status`, its log's growth, and its owned files'
   mtimes: is it working, stalled, or finished? Record what each lane has *actually changed* versus what
   its brief asked for. This is the delegator's live picture.

**Rescue power (narrow, and only after evidence).** If — and only if — you observe signal 1 or 2, you MAY
restore committed content: for a single file, `git checkout HEAD -- <path>` (or re-create it from the blob
you recorded). Before restoring, write into your log: the path, the baseline hash/size, the observed
hash/size, the timestamp, and your evidence that a lane (not the parent) caused it. After restoring,
re-read the file and confirm the restored hash matches your baseline. **Restore nothing else.** Never
`git reset`, never `git checkout -b`, never `git stash`, never touch a `.git` internal, never modify
`src/**` for any other reason, and never restore a file a lane is *legitimately* editing per the ownership
table — a lane's own intended edit is not destruction.

### J3 — Audit the wave at the end

When the lanes have stopped (or your monitor budget is spent):
1. **Claims vs bytes, per lane** — read each `fixes/335_<n>_*.md` and verify its landed claims exist on
   disk (`file:line`), and that nothing it claims is contradicted by the bytes. Report any claim with no
   bytes and any divergence.
2. **Destruction audit** — walk the whole diff of the wave (`git diff --stat`, then per-file) and list
   every change: to what, by which lane (attributable by ownership), and whether it destroyed anything that
   existed before. Flag any deletion, any mass rewrite (>60% of a file's lines), and any change to a
   do-not-touch path.
3. **Loss audit** — confirm every lane's work is still present; confirm no uncommitted work was dropped;
   confirm no lane's log was rewritten (their lengths only grew).
4. **Progress table** — lane → brief → what it actually did → bytes touched → compliant (yes/no with the
   violation named).
5. **Gate sanity** — the parent runs the gate; you may run a **targeted** check (`npx tsc --noEmit`,
   `npx eslint <paths>`) to confirm the tree you are auditing is coherent, and note anything red you see.

## Rules

- **You are read-only on code**, except the rescue power in J2 and your own two files
  (`wave_plans/W49/GUARDRAILS.md`, `fixes/335_7_guardian.md`). Do not fix bugs, do not improve style, do not
  reformat anything.
- **No commits, no `git reset`, no stash, no branch operations, no rebase.**
- Never print a secret. No keyed calls. Never run `npm run eval` (it rewrites tracked artifacts).
- Write your log **incrementally** — baseline, then one block per monitor check, then the J3 audit. If your
  run ends early, the log must still be usable.
- Report a destruction event as the FIRST line of your final report if one happened.

## Report

Lead with the destruction verdict (or "no destruction observed"). Then: the guardrails you published (path),
the baseline (HEAD + manifest size), each monitor check's result compactly, the four J3 audits, the progress
table, and an explicit list of anything the delegator must act on.
