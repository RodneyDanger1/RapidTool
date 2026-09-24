# 231 · PLAN GUARDIAN — snapshot first, then verify everything the playbook author writes

**Read this file FIRST.** You are the guardian of the plan corpus. A sibling agent (PLAYBOOK-A,
delegation dispatched alongside yours) is writing `230_task_execution_playbook.md` and — only at the very
end — may add ONE pointer line to `research/multiagent/220_tasklist_canonical.md`. Your job is to make
**obliteration, loss, failure and bad-info impossible to miss**: snapshot before, verify after, and check
every load-bearing claim it makes.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
PLAN CORPUS UNDER GUARD (the files that must not be lost or corrupted):
  research/multiagent/220_tasklist_canonical.md   (48 KB, 42 rows — THE list; has 5 AUD-2 markers)
  research/multiagent/220_overhaul_plan.md        (the plan; §4.6 WB-1; §4.8 ledger)
  research/multiagent/220_external_verification.md
  research/multiagent/221_feature_designs.md      (F1-F5)
  research/multiagent/222_codebase_integration_map.md (the seam map)
  research/multiagent/223_critical_path_premortem.md  (WB-1 deadlock — parent-verified)
  research/multiagent/224_advantage_gap_and_plan_audit.md
  research/multiagent/229_steering_and_goal_alignment.md
  fixes/228_ledger_and_risk_register.md           (WD-Z, may still be writing — include what exists)
  research/multiagent/230_task_execution_playbook.md  (the sibling's file — guard it too)
NOTE: these files are UNTRACKED in git (created after commit 7582771) — a clobber would be unrecoverable
except by backup. That is why step 1 exists.

THE OWNER'S ASK (verbatim): "WATCHDOG THIS ONE/THE FILES TOUCHED AND ALL PLAN FILES TO PREVENT
OBLITERATION/LOSS/FAILURE/BAD INFO BEING ADDED."

RULES:
1. You may WRITE: your report (below) + the backup directory. You may NOT edit the plan files themselves
   (a guardian that edits what it guards destroys the audit trail) — corrections go in your report as
   recommendations with evidence, for the parent to apply.
2. ALLOWED: read-only reads/greps; `cp` for backups; ≤2 targeted test runs. FORBIDDEN: `npm run typecheck`,
   `npm test`, `npm run build`; no git mutations (no add/commit/stash — the repo state is evidence).
3. Skeleton first, then fill in passes.
```

**Your deliverable:** `fixes/231_plan_guardian_report.md`
**Your backup:** `C:/Users/mnril/w13guard_backup/<YYYYMMDD-HHMMSS>/` (outside the repo) — one copy of every
file in the list above that exists at your start, plus a `MANIFEST.txt` with each file's size + md5.

## The numbered plan

1. **SNAPSHOT FIRST (before anything else).** `mkdir -p` the backup dir; copy every file in the guard list
   that exists; write `MANIFEST.txt` (path, bytes, md5, mtime) with the exact commands used. Paste the
   manifest head into your report. *This is the obliteration insurance — do it before you read anything
   else.*
2. **Poll the sibling ≥3 times** (`sleep 90` between), recording real mtimes of
   `230_task_execution_playbook.md` and — if it changes — `220_tasklist_canonical.md` from your manifest
   baseline. At the end, re-measure both: **size must grow, never shrink; md5 must change only for the
   files the sibling was allowed to touch.** Any shrinkage, truncation, table-row loss, or edit to a file
   outside its permission = **a P1 incident** in your report, with the before/after bytes and the recovered
   copy's path.
3. **Verify the sibling's load-bearing claims (≥10 spot-checks).** For each: open the file/line it cites
   and check it says what the playbook says. Priority targets:
   - any seam `file:line` (does the symbol exist there?);
   - any invariant it asserts (e.g. `policy.ts`, `errors.ts:72`, `sandbox:false`, declare-or-strike) —
     quote the source you find;
   - any command it gives (does the script/entrypoint exist? is it one of the known-broken ones —
     `browser-smoke.mjs` flags, `hermes verify`'s format step, `--limit=N` vs `--limit 1`?);
   - any count it repeats (MCP clients = **7** — the 6 was an undercount, parent-verified; lesson-writers
     = **18**; DF-09 anchor = **engine.ts:1629**; gate numbers 261/1957 — all must match).
   Classify each: VERIFIED / IMPRECISE (say the correct form) / WRONG (say what is) / UNVERIFIABLE (what
   you tried).
4. **Hunt the four bad-info shapes** in the sibling's file and in any file it touched: an invented path or
   helper · a command that cannot run · a claim that contradicts an audited fact (list the audited facts
   from `220` §4.5/§4.6/§4.8 and `220_tasklist_canonical`'s markers) · guidance that would violate a
   governing invariant or send a lane into a HOT-file collision (cross-check `222` §4).
5. **Restorability proof.** For each guarded file, state: backup path + md5, and the one-line restore
   command (`cp <backup> <target>`). If any file was modified during your watch, show it is byte-identical
   to the backup or report the diff.
6. **Bottom line at the top of your report**: `files snapshotted: N · incidents: N · claims checked: N
   (verified/imprecise/wrong/unverifiable) · restore-ready: N/N` — then one paragraph: **is the plan
   corpus intact and is the playbook safe to follow as written? (yes / yes-with-corrections-list / no).**
