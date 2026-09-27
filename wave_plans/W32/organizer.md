# W32 · THE ORGANIZER + its watchdog — make the folder read like professional software to any AI agent

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`).
**THE MOMENT:** 13 sibling lanes (S1–S5, T1–T5, WDX-1/2/3) are LIVE and mid-edit. ~2,500 uncommitted changes exist. **NOTHING here may break them.**

## THE SAFETY CONTRACT (binding — a violation here is worse than any organizational win)
1. **NEVER move, rename, or delete any file under `src/`, `scripts/`, `migrations/`, `research/eval-corpus/`, or any tracked file a lane could be reading** — imports, tests and running lanes rely on exact paths. Reorganization at those layers is OUT OF SCOPE for this wave (it would need a boundary + codemod; record it as a future item instead).
2. **NO commits** (the delegator owns the boundary commit), **no git mutations beyond `git status`/`git ls-files`/`git check-ignore` reads**.
3. **Deleting stray files: ONLY** if ALL hold: untracked-by-git (`git ls-files --error-unmatch <f>` fails) AND zero references (`grep -rn` whole repo + the two shared md files) AND not named in any live lane log (`fixes/271_*`, `fixes/272_*`, `fixes/273_*`, `fixes/274_*`). Anything less → leave it, list it.
4. **Additive only** for everything else: new docs/indexes are welcome; edits to existing docs = append or a clearly-scoped honest correction.

## THE ORGANIZER'S DELIVERABLES
1. **`START-HERE.md` (repo root) — the AI-agent wayfinding doc.** The single entry point for any agent (or human) opening this folder cold: what RapidTool is (one honest paragraph — "a governed 13-phase delivery harness; autonomous-factory capabilities are shelled/in-progress per `finalsprint.md`; the register is `research/multiagent/thoroughanalysis.md`") · the 10-line tour (where the engine lives, where the CLI lives, where the UI lives, where the docs/register/ledgers live, where the corpus lives) · the READ ORDER for agents (AGENTS.md → register → finalsprint → the lane logs) · the run commands (the real ones: `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor`, `npm run typecheck/lint/test`, `npm run eval` keyed note) · the honest-state block (what works / what's shelled / what's blocked, dated) · the never-do list (secret printing, gate-while-agents-edit, keyed calls unfunded...). Verify EVERY command it contains by running the read-only ones.
2. **The root-folder audit + safe cleanup.** `git ls-files` + `ls -la` the root; classify every stray (scratch logs, probe*.ts, _*.txt, w24b3_scratch/, generated dirs): PROPOSE the cleanup for tracked files (list + reasons, no action), DELETE only contract-rule-3 untracked junk. Check `.gitignore` covers what it should (scratch/, *_scratch/, *.log patterns, probe dirs — propose, don't force).
3. **`docs-FOLDER-MAP.md` (or a section in START-HERE.md)** — the full tree map at depth-2 with one-line purposes, generated from `git ls-files` + verified spot-reads, so an agent can navigate without grepping blindly.
4. **Index freshness check** — `fixes/263_index.md` + `wave_plans/README.md`: are they current (new fixes/272–274, wave_plans/W29–W32)? Refresh (append-only style) or record the delta.
5. **The future-item record** — everything that WOULD need real reorganization (src/ layout, script splits, doc consolidation) written into `fixes/275_organizer.md` as a ranked future list with exact moves — for a post-boundary, codemod-backed wave.

## THE WATCHDOG (second agent)
- Poll the organizer (≥4×, ~90s; transcript under `~/AppData/Local/hermes/cache/delegation/live/` — the newest 2-task deleg dir).
- **Verify every claim against bytes**: each file it says it deleted → gone AND was untracked AND unreferenced; each doc it says it wrote → exists with the claimed content; each command in START-HERE.md → actually runs (read-only ones).
- **The no-break audit (its core duty):** `git status --short | wc -l` sampled across polls (should stay ~2,500, never DROP by file deletions beyond the sanctioned ones); `git ls-files | wc -l` unchanged; spot-check that 5 random src/ imports still resolve (`node --check` on files); confirm NO commit landed (`git log -1` same hash); confirm the live lanes' files were untouched by the organizer.
- Any violation → immediate row + (if safe) stop-the-bleed note in `fixes/275_organizer.md`'s log.
- Records: its rows appended to `fixes/275_watchdog_organizer.md` + a bottom line (polls · claims ok/wrong · no-break checks · violations).
- WATCHDOG IS READ-ONLY on the repo (no edits, no git).

**Both:** write logs EARLY; log-and-continue; if something is ambiguous, do less, record more.
