# 235 · ENGINEERING WATCHDOG 2 — execution readiness: can this plan actually be run, by these agents, on this host?

**Read this file FIRST.** The overhaul plan is written, audited, mapped and now has a per-row playbook.
Nobody has asked the engineering-manager question: **can this plan actually be executed** — as waves, by
flash subagents, on an 8 GB Windows box with no model key, without collisions, with verification that
actually proves each row? You answer that, and you hand the parent a wave-by-wave dispatch design.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.

EVIDENCE OF THE REAL CONSTRAINTS (use these — they are observed, not theoretical):
- **Lane budgets fail in a pattern:** in W13, 4 of 6 work lanes ran out of tool calls BEFORE writing their
  deliverable (lanes 3, 4, and X-1, X-2 — all four recovered by the parent from their summaries). Lanes 1,
  5, 6/X-3 finished. What distinguishes them? (Deliverable size, read volume, whether they wrote their
  skeleton early.) That pattern is the single most important input to lane sizing.
- **The host:** 8 GB RAM; heavy commands (`npm run typecheck`, `npm test`, `npm run build`) are
  boundary/parent-only because a concurrent spike froze the box once already this month. Eight agents ran
  concurrently today without incident under strict command discipline.
- **No key** → any keyed row cannot be *executed*, only prepared.
- **HOT files:** 68 files changed since `aa12c6c` (`222` §4) → the one-lane-per-HOT-file rule.
- **The boundary rule:** lanes stop → one `gate.sh` (parent) → next wave. `gate.sh` ≈ 160 s.

RULES: WRITE ONLY your deliverable. Never edit src/scripts or the plan files (corrections go in your report
for the parent). No git mutations. Allowed: read-only reads/greps; ≤3 targeted test runs
(`--test-concurrency=2`). FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build`. Scratch outside the
repo (`C:/Users/mnril/w13p_scratch/`). Skeleton first, then fill in passes.
Every claim = a file:line, a dossier line, or a command you ran today. UNVERIFIED label where it applies.
```

**Your deliverable:** `research/multiagent/235_execution_readiness_audit.md`

## What to produce

1. **The wave decomposition (the centrepiece).** Take `220_tasklist_canonical.md`'s first-48-hours + the
   `BLOCKED-KEY` rows + WB-1's C-1/C-2 (which must precede Step 0) and produce a **concrete wave plan**:
   `wave | lanes (each: row ids + owned files) | why these lanes are disjoint | boundary gate | what it
   unblocks`. Enforce, and *show* you enforced, the one-lane-per-HOT-file rule (`222` §4). Any row you
   cannot place = a finding (`UNPLACEABLE: <row> — <why>`). Aim for waves of 3–5 lanes; note where a wave
   could be split if a lane looks oversized.
2. **Verification adequacy.** For every row in your waves: does its verify command actually PROVE its
   done-when? Cross-check against `230_task_execution_playbook.md` if it exists by the time you write
   (it is being written in parallel); otherwise check against the row's own text. Classify each:
   `PROVES` / `WEAK (command passes while the row is broken — say how)` / `MISSING (no command — then the
   row is UNVERIFIABLE-NOW)`. The dangerous class is WEAK: a green command that hides a red row.
3. **Lane-sizing guidance from the observed pattern.** Using the four budget failures as data, derive
   concrete rules for how a lane should be scoped and run (e.g. "skeleton + bottom line within the first
   ~10 calls"; "≤N files read in depth"; "write-as-you-go, not at the end"; "one row per lane when the row
   touches >1 HOT file"). Each rule justified by which lane's failure it would have prevented.
4. **The three execution risks** (ranked) with the cheapest mitigation for each: e.g. a lane that collides
   on a HOT file; a wave whose gate fails late; an agent that claims completion with a skeleton file (this
   has happened: `217e/217f/217h` are skeletons on disk). Name the detection signal for each.
5. **The 48-hour critical path** — the single ordering that gets from today's green tree to the owner's
   keyed run with the fewest wasted runs: which rows MUST land before Step 0 (C-1/C-2 per `220` §4.6),
   which SHOULD (kill-safety/run-start marker per `223` WB-6, the Step-0 triage row per `227` Q2a), and
   which can wait. Justify each inclusion with the failure it prevents.

## Bottom line at the top of the file
`waves designed: N · lanes placed: N · UNPLACEABLE: N · verify PROVES/WEAK/MISSING: N/N/N · execution
risks: 3 (named)` — then one paragraph: **the single change to how lanes are scoped that would most
increase the fraction of lanes that finish their own writes, based on the four observed failures.**
