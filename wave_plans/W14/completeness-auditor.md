# 240 · COMPLETENESS AUDITOR — is any task missing from the chat's 17-item list? (then hand the parent the additions)

**Read this file FIRST.** The owner is executing the overhaul from a 17-item chat task list (the parent's
`todo`, visible in the Hermes desktop chat). Their instruction: *"ensure no tasks are missing/add them to
the 17 total/then work on them. make sure the added/found tasks are on the chat-visible task list."* You
find the gap. The parent merges your findings into the visible list.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
TREE: C-1 has landed (uncommitted on 7582771): headless.ts both seams + headless.test.ts (+1 test);
typecheck 0 · headless.test.ts 91/91 · lint 0. Three W14 lanes (C-2, doc-truth, browser pass) + two
watchdogs are running; the plan corpus is FROZEN (220_tasklist_canonical, 220_overhaul_plan,
230_task_execution_playbook, fixes/228_* — read-only for you).

THE OWNER'S STANDARD: no hallucinations, 100% factual. Every "missing" task you report must trace to a
source line you cite (a canonical row id, a proposed row in 225/226/227 or a WD report, a wave-plan row
in 235, or a record-step named in 227). Do NOT invent tasks; do NOT pad. If the 17-item list genuinely
covers things you suspected were missing, say so and cite where each is covered.

RULES: WRITE ONLY your deliverable (below). Never edit src/scripts/plan files/the todo. No git mutations.
Allowed: read-only reads/greps; ≤2 targeted test runs. FORBIDDEN: `npm run typecheck`, `npm test`,
`npm run build`. Scratch outside the repo (`C:/Users/mnril/w14c_scratch/`). Skeleton first (bottom line +
the table headers within ~10 calls), then fill — the write-early rule.
```

**Your deliverable:** `research/multiagent/240_missing_tasks_audit.md`

## The 17-item chat list (what the parent is tracking today)

```
w0-c1 C-1 break the gate-before-mint deadlock [DONE]        w0-c2 C-2 coded terminal DoD stop
w0-ov35 OV-35 Step-0 preflight (OV-27 probe first)          w0-docs doc-truth sweep (in flight as lane 2)
w2-ov2 OV-2 browser pass (in flight as lane 3)              w1-task01 TASK-01 nextAction
w1-t52a T5.2-A fixtures review UI                           w2-t53 T5.3 eval verb
w2-ov13 OV-13 (+OV-29) silent-degrade rows                  w3-think OV-36/OV-37
w3-ci CI workflow                                           step0 Step 0 (owner keyed run)
w5-zeros OV-3/OV-5/OV-4 (the zeros)                         ov11 OV-11 red seal teaches (owner)
w5-accept OV-38/39/40                                       features F2/F4/F1
merge parent's merge pass
```

## What to do

1. **Build the universe of real tasks** from (all read-only):
   - `research/multiagent/220_tasklist_canonical.md` — the 42 canonical rows (§1) + its AUD-2 markers;
   - `research/multiagent/226` (OV-27…31) · `227` (OV-35…43 + the four record-steps R1–R4) · `225`
     (OV-19/20/21/OV-TBD) — the proposed rows;
   - `fixes/228_ledger_and_risk_register.md` §3 — WD-Z's ACCEPT/MODIFY/REJECT merge table (the accepted
     set is the authoritative one; REJECT = F5, do not re-propose it);
   - `research/multiagent/235_execution_readiness_audit.md` — its wave plan (W0…W6) and the rows it placed;
   - `220_overhaul_plan.md` §4.4 (owner decisions) + §4.6/§4.9/§4.10 (C-1/C-2/C-3, OV-27's residual);
   - `research/multiagent/229_steering_and_goal_alignment.md` §5 (the parent's own sequence).
2. **Diff against the 17-item list**: produce a table `id | title | source (cited) | status in canonical
   list (TODO/…/accepted) | in the 17? yes/no | if yes, which item covers it`. Be exact about **coverage
   by grouping** (e.g. "OV-3/OV-5/OV-4 are one grouped item `w5-zeros`") — grouped coverage is coverage.
3. **The MISSING list** — only rows that are (a) accepted or canonical-TODO, (b) NOT covered by any of the
   17 items, and (c) have a verification command or a named definition step. For each: canonical-schema
   row + one line on why it matters now (ordered by leverage; maker-test-relevant first).
4. **The coverage proof** — one line per source document: what you took from it / nothing (and why). Plus
   an explicit statement of the total: `universe: N tasks · covered by the 17: M · MISSING: K`.
5. **Bottom line at the top**: `universe: N · covered: M · missing: K (ids…)` + one paragraph naming the
   single most important missing item and its one-line why.

## Hard rules
- A row that is `DONE-VERIFIED`, `OWNER-RUN`, `OWNER-DECISION`, `RESEARCH-ONLY` or `UNVERIFIABLE-NOW` is
  NOT "missing work" in the same sense — put those in a separate short table (`not-lane-work`) with the
  reason, so the parent can decide whether a chat item should still exist for owner-visibility.
- Never propose F5 (REJECT per WD-Z) or anything on the do-not-rebuild list.
- If two sources disagree about a row's status, cite both and prefer `fixes/228` §3 (the audited merge).
