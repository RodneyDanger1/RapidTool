# 230 · PLAYBOOK AUTHOR — "how to do each task best", written for the agent who will actually do it

**Read this file FIRST.** The overhaul's task list says WHAT to do. Nothing says HOW to do it best, what
the executing agent must know, or where the traps are. You write that — **the execution playbook** —
working from the audited record only. A guardian agent runs beside you, snapshotting the plan files and
verifying your claims; write accordingly (every claim checkable).

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
TREE STATE: green + committed (7582771); boundary gate green (fixes/218 §5).

THE OWNER'S STANDARD (verbatim): "FACTUAL INFO ONLY/LOGICAL INFO … No fake code or hallucinations."
So: every "how" you write must be grounded in a `file:line` you read today, a dossier line, or a command
you ran. **No invented APIs, no invented file paths, no imagined helper functions.** If the best advice is
"read `X` first", say that — an honest pointer beats an invented snippet. Tiny real snippets (2-4 lines)
quoted FROM the codebase are welcome; anything longer, quote the path and line range instead.

RULES:
1. WRITE ONLY your playbook file (below) — plus, at the very end and only if everything else is done,
   ONE small attributable pointer patch in `research/multiagent/220_tasklist_canonical.md` in this form:
   `> [PLAYBOOK · 2026-09-24] Execution guidance for every row lives in `230_task_execution_playbook.md`
   (by PLAYBOOK-A).` Nothing else in that file. No src/scripts edits; no git mutations.
2. ALLOWED: read-only reads/greps; ≤3 targeted test runs
   (`node --experimental-strip-types --test --test-concurrency=2 <file>`). FORBIDDEN: `npm run typecheck`,
   `npm test`, `npm run build`.
3. Scratch outside the repo (`C:/Users/mnril/w13m_scratch/`). Skeleton first, then fill in passes.
   If budget runs short: the TOP 12 rows in full depth beat 42 shallow ones — and say which rows you did
   not reach.
```

**Your deliverable:** `research/multiagent/230_task_execution_playbook.md`

## Inputs (read these first, in this order)

1. `research/multiagent/220_tasklist_canonical.md` — the 42 rows (**read its AUD-2 correction markers: they
   supersede the text they annotate**; e.g. DF-09's anchor is `:1629`, lesson-writers count is 18,
   T5.3's flag is `--limit=N`).
2. `research/multiagent/222_codebase_integration_map.md` — §2 the 32-row **seam table** (your primary
   source: seam `file:line`, helpers to reuse, tests to extend, governing invariant), §3 the 16 invariants,
   §4 the HOT list + the one-lane-per-HOT-file rule, §5 the landmine register.
3. `research/multiagent/221_feature_designs.md` — F1–F5 specs (for the rows that are features).
4. `research/multiagent/220_overhaul_plan.md` — §4.2 the first-48-hours order, §4.6 WB-1 (the deadlock
   finding + its C-1/C-2 fix shapes + the new test each), §4.8 the disadvantage ledger.
5. `fixes/219_wdA/B/C` + `fixes/218` as needed for provenance of any row you describe.

## The required shape — one block per row (rows in the canonical id order; first-48-hours rows first)

```
### <row id> · <title>   [size · owner · status]
**Do it best by:** <the approach in 2-5 lines — the order of operations, the shape of the change, and the
single most important choice; name the seam file:line you verified>
**Files + seam:** <files to touch, each with the seam line read today>
**Reuse (do not rebuild):** <existing helpers with file:line; cite the do-not-rebuild list where relevant>
**Know before you start:** <the 2-4 things that actually matter: the governing invariant (with source),
the relevant HOT-file rule, the landmine(s) that apply, the forbidden-command rule, the house style —
no eslint-disable, TDD, declare-or-strike>
**Traps:** <the specific ways this row goes wrong; where a silent failure could hide; what NOT to do>
**Verify:** <the exact command + the expected observable result + what RED would look like (if the row's
own done-when is unobservable, say so — that is a finding, and the row is `UNVERIFIABLE-NOW`)>
**If blocked:** <what a lane does when it cannot finish — the honest partial shape (skeleton log first,
state what is unfinished, never invent completion)>
```

## Coverage rules
- **Priority order:** the 8 first-48-hours rows → the `BLOCKED-KEY` rows (they unblock the keyed run) →
  `TODO` rows by leverage → `OWNER-*` rows get a SHORT block (what the owner needs to decide, with the
  evidence that makes the decision cheap) → `UNVERIFIABLE-NOW` rows get the block that says **what must be
  defined before they can be dispatched** (that is their "how").
- Cross-reference, don't duplicate: if three rows share a seam, write it once and link.
- **Every fact you state about the codebase must be re-read today** — the integration map is your source,
  but where you assert a seam yourself, open it.
- End with **"the three rows a first-time lane should take, and why"** — the gentlest real on-ramp.

## Do not
- Do not propose new rows or features (X-1/X-2/X-3 own the new-row proposals; WD-Z is merging them).
- Do not restate the plan; the playbook is *how*, not *what*.
- Do not write guidance you cannot ground — an empty "Traps" line is honest; a fabricated one is not.
