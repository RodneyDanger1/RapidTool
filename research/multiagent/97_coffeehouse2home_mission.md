# Coffeehouse2Home Mission — QUEUED (executes after all in-flight tasks complete)

Trigger: user directive (2026-09-06). Launch ONLY after deleg_ee964d63 (3 Pro
fixers), deleg_5e66e816 (log-designer), deleg_b28ecc55 (3 planners) all land,
the parent integrates them, the four gates are green, and the runtime-log
system is implemented. THEN execute this mission, then bug-fix everything new
found.

## Phase 1 — Five products, one at a time (deep UI→backend audit each)
For EACH product below, drive the FULL RapidTool pipeline with the real key
(create → 13 phases → gates → crew → verify --apply → design → diagram →
scaffold → vault → harvest → prompt → swarm → bench → summary → export →
packet), then AUDIT the result front-to-back (UI → backend): what works, what
is broken/fake/non-working (file:line evidence), what went right vs wrong:
1. Real estate CRM software
2. Construction / house-flipping manager
3. House showing / booking software
4. Rental portfolio manager
5. Project management + payroll + task list + supply list tool

After EACH: write the analysis (research/multiagent/98_make_N_<name>.md):
wrong/right ledger, root causes traced to pipeline stages, and the learning
lessons. Verify the self-learning loop ACTUALLY captures those lessons (check
knowledge.ts lesson rows / vault notes landed — and if not, fix the loop).

## Phase 2 — Combine into Coffeehouse2Home
Merge the 5 into ONE suite ("Coffeehouse2Home") — one piece of software from
five. Build it, audit it end-to-end (UI→backend), find what went wrong/right,
learn from it (research/multiagent/99_coffeehouse2home.md).

## Phase 3 — Improve the learning loop + RapidTool production capability
Examine deeply: wherever the runs went wrong → fix RapidTool's functionality/
production capability; wherever they went right → amplify a tad. Improve the
learning loop so Phase-1 lessons demonstrably improve Phase-2 output
(before/after evidence).

## Phase 4 — Fix everything found
Bug-fix all new findings from Phases 1-3. Comprehensive back-to-back UI-to-
backend audit + fix for broken/fake/non-working things. Four gates green.

Acceptance: Coffeehouse2Home runs end-to-end; the learning loop shows
before/after improvement evidence; no fake/mock/non-working surface remains.
