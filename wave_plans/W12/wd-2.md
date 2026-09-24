# W12 · WATCHDOG 2 — live audit of the W12 run (5 lanes) while it runs

**Read this file FIRST.** Then `AGENTS.md`, `RESUME.md` §5.4 + §13, and the five lane briefs
(`wave_plans/W12/lane-a.md` … `lane-e.md` — read them so you know what each lane *promised*).

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2, git-bash /c/Users/mnril/Desktop/RapidTool Main).
PATH HAS A SPACE → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
MANDATORY RULES (the parent rejects violations):
1. YOU ARE READ-ONLY everywhere except your own report file. You fix NOTHING.
2. PATCH-ONLY for the report (create once with write_file, extend with `patch`).
3. NEVER run git checkout/stash/reset/clean/commit, and never `git add`/`git commit`.
4. Allowed heavy commands: `node --experimental-strip-types --test --test-concurrency=2 <file>`
   and read-only `grep`/`node -e` probes. NO `npm run typecheck`, NO `npm test`, NO `npm run build` —
   five lanes and this watchdog share one 8 GB machine.
5. Every claim needs a command you ran + its output. Unknown ⇒ UNVERIFIED + what you tried.
6. Deliverable: `fixes/217i_w12_watchdog_register.md`
```

**Mission.** Five W12 lanes are running concurrently right now (3 bug hunters, 2 UI/UX). Your job is
the one nobody else can do from inside a lane: **watch for collisions, ownership violations, and
unbacked claims while there is still time to stop them.** You are the independent observer; treat
every lane summary as a self-report.

## The W12 ownership map — the contract you enforce

| Lane | May write ONLY these |
|---|---|
| lane-a (bugs: classifier/bare catches) | `src/lib/errors.ts`, `src/lib/errors.test.ts`, `src/lib/auth/popup.server.ts`, `src/routes/__root.tsx`, `fixes/217j_*.md` |
| lane-b (bugs: LLM silent sinks) | `src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts`, `fixes/217k_*.md` |
| lane-c (bugs: knowledge/algorithms) | `src/lib/knowledge.ts`, `src/lib/knowledge.test.ts`, `src/lib/algorithms.ts`, `src/lib/algorithms.test.ts`, `src/lib/harvest.ts`, `src/lib/harvest.test.ts`, `fixes/217l_*.md` |
| lane-d (UI: console simplification) | `src/components/console.tsx`, `fixes/217m_*.md` |
| lane-e (UI: shell/a11y/audit) | `src/styles.css`, `src/routes/index.tsx`, `src/routes/run.$id.tsx`, `src/components/cmd-palette.tsx`, `src/components/runtime-timeline-pane.tsx`, `fixes/217n_*.md` |

**Anything else modified in `src/` or `scripts/` during the wave is a violation** — including a file
one of these lanes touches "just once". Two known baseline classes that are NOT violations: the W11
files listed below, and each lane's own landing log. Everything else gets listed with file + mtime.

## Numbered plan

1. **Create the report skeleton FIRST.**
2. **Take a baseline snapshot immediately** (before the lanes land much), and paste it raw:
   ```
   cd "/c/Users/mnril/Desktop/RapidTool Main"
   git status --short
   ls -la --time-style=+%H:%M:%S src/lib/*.ts src/components/*.tsx src/routes/*.tsx src/styles.css | head -80
   ```
   Record the file **set** and mtimes; note that W11 already left modified files (that is the
   baseline, not a violation): `scripts/rapidtool-cli.mjs`, `src/lib/compile-check.server.ts`,
   `src/lib/compile-check.server.test.ts`, `src/lib/engine.ts`, `src/lib/knowledge.ts`,
   `src/lib/lesson-writers.test.ts`, `src/lib/node-runner.server.ts`, `src/lib/scaffold.ts`,
   `src/lib/scaffold.test.ts`, `src/lib/token-ledger.ts`, `src/lib/token-ledger.test.ts`,
   `src/lib/headless.ts`, `src/lib/headless.test.ts`, `src/components/console.tsx`, plus
   `fixes/216x|216y|216z|217b..217g` and `wave_plans/W10|W11`.
3. **Watch the lanes live.** Each W12 lane streams a transcript at
   `C:\Users\mnril\AppData\Local\hermes\cache\delegation\live\<delegation_id>\task-<N>.log`
   (`ls -la --time-style=+%H:%M:%S` for mtimes; the parent will give you the delegation id — if you
   cannot find it, `ls -dt $HOME/AppData/Local/hermes/cache/delegation/live/*/ | head -1` and
   identify the newest run whose `manifest.json` mentions W12). **Poll at least 4 times with
   `sleep 120` between polls**, and build a table: `lane → last transcript write → what it is doing
   right now → any file written outside its map`. Timestamps must be real ones you observed.
4. **Independently reproduce the headline defects, at least twice across the wave** (once early,
   once late), so the register shows before → after rather than a lane's word:
   - **G3 classifier** (`lane-a`): a small probe OUTSIDE the repo (`C:/Users/mnril/w12wd_scratch/`)
     that classifies real Node error shapes — `EACCES`, `ENOSPC`, `ECONNREFUSED`, `ENOTFOUND`,
     `EADDRINUSE`, a `fetch failed` error, a JSON parse error, plus one genuinely unknown error —
     and prints each `code`. Record whether the unknown-error fallback still holds.
   - **G6 silent sinks** (`lane-b`): `grep -n` the two parser functions and record what a malformed
     envelope produces (null with no signal = defect still present).
   - **C-09** (`lane-c`): does `KnowledgeStore.entries()` (or the equivalent accessor) return a copy
     or the live array? Prove it with a `node -e` mutation probe outside the repo.
   - **UI capability count** (`lane-d`): count `Tabs.Content value=` occurrences and the ten
     `RunTab` values in `console.tsx`, and the `SHORTCUTS` entries — these numbers must not *drop*.
     This is the anti-regression check for "simpler without losing ability".
5. **Verify claims as landing logs appear.** For each `fixes/217{j,k,l,m,n}_*.md` that exists when
   you check: does its length/structure show a real body (not a skeleton)? Take ONE concrete claim
   from it and check it against the bytes yourself; mark VERIFIED / CONTRADICTED / UNVERIFIED.
6. **Report (top of the file, updated on your final poll):**
   - a `lane → status → signature of progress` table with timestamps;
   - every ownership violation, with file + mtime + which lane's window it falls in;
   - the before → after probe table for the four checks in item 4;
   - anything a lane claimed that you could not verify, stated plainly;
   - a short "what the parent should do next" list. Never soften a finding; never invent one.
