# 233 · IMPROVER GUARDIAN — watch every insertion, prove nothing was lost, and give the editing guidelines

**Read this file FIRST.** A sibling agent (PLAN-IMPROVER, dispatched alongside yours) is doing additive
analysis-driven improvements to the plan corpus. You watch it: snapshot before, verify each insertion,
prove no shrinkage, and publish the **editing guidelines** every future plan-editor must follow.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
IMPROVER'S DELIVERABLE: research/multiagent/232_plan_improvements.md
IMPROVER'S ALLOWED TARGETS (the files you watch): research/multiagent/{220_tasklist_canonical,
  220_overhaul_plan, 220_external_verification, 221_feature_designs, 222_codebase_integration_map,
  223_critical_path_premortem, 224_advantage_gap_and_plan_audit, 229_steering_and_goal_alignment}.md
   (plus 232 itself; the improver may NOT touch 230/228/231/233 or src/scripts — flag anything else it writes)

NOTE: an earlier guardian (deleg_109c3c44 sibling, report `fixes/231_plan_guardian_report.md`, backup
`C:/Users/mnril/w13guard_backup/`) already snapshotted these files once. Your backup is independent AND is
the before/after baseline for THIS improver's run — take it now, before the improver's first write.

THE OWNER'S ASK (verbatim): "A WATCHDOG TO WATCH IT AND HELP PREVENT LOSS/OBLITERATION/COLLISON AND
GUIDELINES TOO."

RULES: write ONLY your report + your backup dir. Do NOT edit the plan files (a guardian that edits what it
guards destroys the audit trail). No src/scripts edits; no git mutations.
Allowed: read-only reads/greps, `cp`, polling with sleep, ≤2 targeted test runs. FORBIDDEN:
`npm run typecheck`, `npm test`, `npm run build`.
```

**Your deliverable:** `fixes/233_improver_guardian_report.md`
**Your backup:** `C:/Users/mnril/w13guard2_backup/<YYYYMMDD-HHMMSS>/` + `MANIFEST.txt` (path, bytes, md5, mtime).

## The numbered plan

1. **SNAPSHOT FIRST** (before anything else — the improver may already be writing). Copy every target file
   that exists + the improver's file if present. Manifest with md5s. ✅ done before any analysis.
2. **Collision check**: at snapshot time, record each file's mtime. Any file younger than ~3 minutes has an
   active writer (PLAYBOOK-A may add ONE pointer line to `220_tasklist_canonical.md`; WD-Z may still be
   writing `228`). Note those as **collision-risk files** and pay extra attention to them at every poll.
3. **Poll ≥3 times** (`sleep 90`), recording: the improver's file size/mtime, each target file's
   size/mtime, and — the key metric — **line counts** (`wc -l`) versus your baseline. Growth is expected;
   any DECREASE, any table-row loss, or any edit to a forbidden file = **P1 incident** (before/after bytes,
   the offending lines if recoverable, and your backup copy's path).
4. **Verify ≥10 insertions** (read them from the target files): is each attributable and additive? Is the
   cited evidence real (open the `file:line` / clone path it names)? Does any insertion **contradict an
   audited fact** (MCP clients = **7**; lesson-writers = **18**; DF-09 = `engine.ts:1629`; WB-1
   parent-verified; `eval --limit=N`; gate 261/1957)? Does any insertion **violate a governing invariant**
   or send a lane into a HOT-file collision (`222` §4)? Did it touch a file it was forbidden to touch?
   Classify each: SAFE / IMPRECISE (correct form) / BAD-INFO (what is true) / UNSAFE (why).
5. **The GUIDELINES section** (the owner asked for these explicitly — write them as a standalone, copyable
   block at the end of your report): **"How to edit the plan corpus safely"** — 8-12 numbered rules
   derived from what you actually observed in this run, e.g.: additive-only; attributable markers; never
   write to a file with mtime < 3 minutes; snapshot before a batch; re-derive counts from a command in the
   same pass; strike-don't-soften; never edit a watchdog's own report; keep a manifest with md5s; prefer a
   companion ledger over in-place rewrites; one writer per file per wave. Each rule gets the incident or
   observation that justifies it (or is marked "convention, from AGENTS/RESUME").
6. **Restorability proof** for every target file: backup path + md5 + the one-line restore command.
7. **Bottom line at the top**: `files snapshotted: N · polls: N · insertions verified: N (safe/imprecise/
   bad-info/unsafe) · P1 incidents: N · restore-ready: N/N` — then one paragraph: **is the plan corpus
   intact after the improver's run (yes / yes-with-corrections / no + what to restore)?**
