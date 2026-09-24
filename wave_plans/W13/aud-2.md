# 224 · AUDITOR 2 — The plan's prosecutor: audit the real task list + the competitor-advantage / RapidTool-disadvantage ledger

**Read this file FIRST.** You are the second auditor. AUDITOR 1 walks the keyed execution path;
you do two other things the inquest still lacks: **(1)** independently audit the overhaul's real task
list *and help finish it*, and **(2)** produce the one analysis nobody has written — **what the
competitors are genuinely BETTER at and what RapidTool is genuinely WORSE at**, ranked by what it
actually costs, with both sides cited.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
COMPETITOR CLONES (read-only; NEVER execute anything from them): /c/Users/mnril/rt-competitors/.
BROWSER: works (local Chromium) — if you use it, every external claim needs URL + quote + date.
TREE STATE: green + committed (7582771); boundary gate green (fixes/218 §5: 261 scripts / 1957 lib).

THE OWNER'S STANDARD (verbatim): "no hallucinations/fake code/… 100% truth." Every competitor claim =
clone path + symbol (or a dossier citation, marked); every RapidTool claim = file:line read today.
A disadvantage you cannot cite is a feeling, not a finding — leave it out or label it UNVERIFIED.

RULES:
1. WRITE ONLY your deliverable (below) + optional attributable corrections to the two files named in
   §Duties-1. Never edit src/scripts/docs; no git mutations; never execute clone code.
2. ALLOWED: read-only reads/greps in repo + clones; ≤3 targeted test runs
   (`node --experimental-strip-types --test --test-concurrency=2 <file>`). FORBIDDEN:
   `npm run typecheck`, `npm test`, `npm run build` (memory-tight host, five siblings running).
3. Scratch outside the repo (`C:/Users/mnril/w13i_scratch/`). Skeleton first, then fill in passes.
```

**Your deliverable:** `research/multiagent/224_advantage_gap_and_plan_audit.md`

## Duties, in priority order

### 1. Audit + help the real task list (the thing the owner will act on)
Inputs: `research/multiagent/220_tasklist_canonical.md` (WATCHDOG D is writing it **in parallel** —
check for it; if present it is written already, so audit it; if not, audit `219e`'s W14/W15/W16 tables
and `220_overhaul_plan.md` §4 and mark what you could not check).
For every row you can reach:
- does the `why` trace resolve (open the cited dossier line / file:line — does it say what the row says)?
- is the status honest? **The dangerous status is `DONE-VERIFIED`** — spot-check at least three such rows
  against `fixes/218` §2/§5 and `219b`'s FALSIFIED list (a row claimed done that the evidence does not
  close is the single worst defect a task list can carry);
- does the `verification command` exist and reference a real entrypoint (`ls scripts/`, grep the target)?
- does the sequencing graph have a cycle or a missing dependency?
- is anything **missing** that the dossiers demand? (Cross-check the coverage proof against the six
  dossiers — name any finding that produced no row.)
Apply corrections **only** in the attributable form:
`> [AUD-2 · 2026-09-24] CORRECTED: <row as written> → <the fact> — evidence: <file:line / command>. (by AUD-2)`
and `> [AUD-2 · …] UNSUPPORTED ROW: <row> — <what you tried>; the parent must re-scope or strike.`
Never rewrite prose, never delete a row silently, never add a row that has no evidence behind it.

### 2. The competitor-advantage / RapidTool-disadvantage ledger (the new analysis)
This is NOT a re-print of `219f`'s matrix (that one was balanced). You write the **prosecution**:
**for each advantage a competitor genuinely holds, what does it BUY them in practice, and what does
RapidTool lose by not having it — in the maker test, in an agent's hands, or in a buyer's judgment?**
Method:
- Source the advantages from `219f` (respect its WD-C markers) + your own reads in the clones.
- For each: `competitor advantage (clone path + symbol) → what it buys in practice (1-2 lines, concrete)
  → RapidTool's corresponding weakness (file:line TODAY, read by you) → the cost of the gap (be specific:
  which maker-test criterion, which agent workflow, which claim) → closeable? (engineering / product
  decision / needs keys+budget) → what it would take (one line)`.
- Cover at minimum: **sandboxed/containerized execution** (OpenHands' runtime — what it buys: running
  what you built, safely), **MCP runtime client** (7 clones — what it buys: real tool ecosystems),
  **provider breadth** (12–22+ — what it buys: no single point of failure, cost/quality routing),
  **repo indexing / context selection at scale** (Roo's Qdrant+8 embedders — what it buys on big repos),
  **per-action allow-lists / permission UX** (what it buys: safe unattended operation),
  **IDE/UX surface + streaming** (what it buys: developer adoption), **their own test/CI discipline**
  (counts you can re-derive — what it buys: trust).
- Then rank the ledger by **what it actually costs RapidTool**, and mark which items are *not* worth
  closing (with the reason — e.g. "structural loss, per `90` §7"). A disadvantage ledger that concludes
  "close everything" is useless; the owner needs the ranked few that matter.
- **Cross-check the advantage claims the plan already leans on**: if the plan's "behind" verdicts are
  softer or harder than the clones show, say so explicitly — the owner's decisions depend on that number
  being real.

### 3. Bottom line at the top of the file (write this FIRST, fill the body after)
- `task-list rows audited: N · corrections: N · unsupported: N · missing-from-list: N`
- `advantage gaps found: N · ranked #1..#3` (one line each)
- The single most consequential thing you found that no earlier agent reported.
