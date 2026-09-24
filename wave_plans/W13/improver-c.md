# 232 · PLAN IMPROVER — fresh codebase + competitor analysis, applied as ADDITIVE improvements to the plan files

**Read this file FIRST.** Every other agent *produced* plan material; you **improve** it — by doing fresh,
parallel analysis of RapidTool's codebase and the 17 competitor clones, and inserting what you find into
the plan files **without ever deleting or rewriting a single line**. A guardian agent (delegation
`deleg_109c3c44` sibling) snapshots and verifies everything you touch.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
COMPETITOR CLONES: /c/Users/mnril/rt-competitors/ — READ-ONLY, NEVER execute anything from them.
TREE STATE: green + committed (7582771).

⚠️ THE ANTI-OBLITERATION CONTRACT (your guardian enforces it; a violation invalidates your whole run):
1. **ADDITIVE ONLY.** You may INSERT text. You may not delete, reorder, or rewrite existing lines,
   tables, or paragraphs — not even to "fix" them. If something is wrong, INSERT a correction marker
   underneath it (the parent applies real edits at the merge).
2. Every insertion carries its attribution on the line itself:
   `> [IMPROVER · 2026-09-24] <what + why> — evidence: <file:line / clone path+symbol / command>. (by PLAN-IMPROVER)`
3. **Never write to a file whose mtime is younger than ~3 minutes** (another agent is probably mid-write).
   Re-check mtime immediately before every write. If a file is hot, wait one poll cycle or skip it and say so.
4. **Never touch** `230_task_execution_playbook.md`, `228_ledger_and_risk_register.md`,
   `231_plan_guardian_report.md`, `233_*`, any `wave_plans/**` brief, or anything under `src/`/`scripts/`.
5. Your own new file is where the bulk of the "why" lives (`232_plan_improvements.md`); inline insertions
   stay SHORT (1–4 lines each).

THE OWNER'S STANDARD: "no fake code or hallucinations/bad ideas/problem causers … FACTUAL INFO ONLY."
Every improvement must be grounded in a read you did TODAY. No invented seams, no invented competitor
facts, no speculative rewrites. If an improvement would change a row's meaning rather than strengthen its
evidence, do not make it — list it for the parent instead.

RULES: read-only greps/reads + ≤3 targeted test runs (`--test-concurrency=2`). FORBIDDEN: `npm run
typecheck`, `npm test`, `npm run build`. Scratch outside the repo (`C:/Users/mnril/w13n_scratch/`).
Skeleton first (your own file), then analyse, then insert in passes.
```

**Your deliverable:** `research/multiagent/232_plan_improvements.md` (the improvement ledger — every
improvement, its target file, the evidence, and what it prevents) **+ short attributable insertions** in:

| may improve | with what kind of insertion |
|---|---|
| `220_tasklist_canonical.md` | per-row evidence/seam/verification-strengthening notes below the affected row's section (NOT inside the table rows) |
| `220_overhaul_plan.md` | improvements to §4.2/§4.6/§4.8 — sequencing evidence, competitor lessons, missing traps |
| `220_external_verification.md` | additional verified external facts ONLY if you re-verify them yourself with URL+quote+date |
| `221_feature_designs.md` | competitor-mechanism detail from the clones that sharpens a design's "field's version" line |
| `222_codebase_integration_map.md` | corrected/added seams you read today; HOT-list member corrections |
| `223_critical_path_premortem.md` | additional will-break evidence or a confirming/falsifying trace |
| `224_advantage_gap_and_plan_audit.md` | additional disadvantage evidence from the clones |
| `229_steering_and_goal_alignment.md` | evidence that sharpens the ladder placement or a steer decision |

## The improvement classes (stay inside these; max ~15 improvements total — quality over count)

1. **Missing evidence** — a row/section should cite a `file:line` or command it does not; you find and
   insert the exact citation (verified today).
2. **Better verification** — a row's done-when/verify command can be made observable; insert the exact
   command and where it lives.
3. **Competitor lesson** — a specific mechanism in a clone (path + symbol) that changes how a row should be
   built (e.g. a permission model, an edit-format trick, an index strategy, a CI habit); insert the lesson
   + the evidence, and connect it to the row.
4. **Missing trap/risk** — something in RapidTool's own code that will bite that task (adjacent silent
   failure, coupling, HOT collision); insert the trap with its `file:line`.
5. **Consistency fixes** — counts/ids/anchors that contradict the audited facts (MCP clients = **7**,
   lesson-writers = **18**, DF-09 = `engine.ts:1629`, gate 261/1957, WB-1 as parent-verified).

## Mandatory for each improvement in your ledger
`id | target file | the insertion (short form) | evidence (read today) | class (1-5) | what it prevents |
self-rejection (why it might be unnecessary or wrong)`.

## Bottom line at the top of your ledger
`improvements inserted: N (by class) · files touched: N · files skipped (hot/other) — and why · rejected
by self-rejection: N` — then one paragraph: **the single most valuable improvement you made, and the one
you wanted to make but did not (with the reason).**
