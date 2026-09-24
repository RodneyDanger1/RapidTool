# 220 · WATCHDOG D — from six dossiers to ONE real task list (the canonicaliser)

**Read this file FIRST.** You are the agent that turns ~250 KB of findings into **one real task
list** the owner can act on. Everything else in this inquest produced evidence; you produce the
**work list** — deduplicated, dependency-ordered, honestly statused, and provably traceable.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
TREE STATE: green + committed (7582771) as of 2026-09-24 11:15; a boundary gate is green (fixes/218 §5:
typecheck 0, lint 0, gaps 0, scripts 261/261, lib 1957/1957 +1 by-design skip, build 0).

THE OWNER'S STANDARD (verbatim): "no hallucinations/fake code/ and is zero bullshit 100% truth …
wrap it all into a REAL TASK LIST." For you that means: **no invented tasks, no invented line
numbers, no task whose verification command does not exist.** A task list with one hallucinated item
is worse than a shorter honest one.

RULES:
1. WRITE ONLY your deliverable (below). Never edit src/, scripts/, other dossiers, or docs. No git mutations.
2. ALLOWED: read-only greps/reads; ≤2 targeted test runs (`node --experimental-strip-types --test
   --test-concurrency=2 <file>`). FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build`.
3. Skeleton first, then fill in passes. Honest partial > rushed full.
```

**Your deliverable:** `research/multiagent/220_tasklist_canonical.md`

## Inputs (read these; they are the whole evidence base)

- The six inquest dossiers: `research/multiagent/219a_inventory_and_reality.md`,
  `219b_defects_live_status.md`, `219c_autonomy_blockers.md`, `219d_self_improvement_reality.md`,
  `219e_gap_to_best_and_plan.md`, `219f_competitor_codebases_vs_rapidtool.md`
  (**read the WD-C correction markers in 219e/219f — they supersede the text they annotate**).
- The three watchdog reports: `fixes/219_wdA_lane12_corrections.md`, `219_wdB_lane34_corrections.md`,
  `219_wdC_lane56_plan_corrections.md` (**these are the audited truth — prefer them over any
  contradicting dossier line**).
- The wave records: `fixes/218_w12_close_record.md` (§3 carried-forward + §5 gate numbers),
  `fixes/216z_w10_landing_record.md`, `fixes/217b_watchdog_verification.md`,
  `fixes/217c_phase5_spec_and_decision_register.md` (§3 = the two owner decisions D-1/D-2).
- The standing boards: `taskuniverselog.md` (§2.x statuses + §7 changelog + §6 rules),
  `remainingwaves.md` (all of it), `RESUME.md` §4 (the numbered backlog 1–19) + §6.1 (lanes' own
  unverified-claim list), `AGENTS.md`.

## The deliverable's shape

1. **The task list — one table, stable ids.** Reuse the repo's EXISTING ids wherever an item already
   has one (e.g. `TASK-01`, `T-107.6`, `T-107.7`, `T4.2`, `T4.3`, `TA-18`, `DF-09`, `DF-26`, `DF-18`,
   `G4`, `G5`) — do NOT renumber history. New items get `OV-N` ids (OV = overhaul). Columns:
   `id | title (plain words, ≤12) | why (evidence: dossier + file:line) | files | done-when
   (observable, not a feeling) | verification command (exact) | size S/M/L | deps (ids) |
   owner (lane / parent / OWNER-DECISION / OWNER-RUN) | status`.
   Status vocabulary, used strictly:
   `TODO` · `DONE-VERIFIED` (cite the command/record that closed it — and then do NOT list it as work)
   · `BLOCKED-KEY` · `OWNER-DECISION` · `OWNER-RUN` · `UNVERIFIABLE-NOW` (say what is missing to make
   it verifiable) · `RESEARCH-ONLY`.
2. **The do-not-rebuild list.** Every capability the dossiers confirmed already landed (219e §5 item 8
   names several; 219b's FALSIFIED rows name more). One line each + the proof. This list exists so a
   future wave cannot burn budget re-implementing what is already green.
3. **The sequencing graph.** Text form, e.g. `Step 0 (keyed run) → unblocks {OV-3, OV-7}; OV-1 →
   unblocks {OV-2}`. Every arrow must be justified by a dependency you can name (a shared file, a
   required artifact, a key). Flag any cycle you find instead of smoothing it over.
4. **Reconciliation table.** Any place two documents disagree (e.g. a dossier line vs its WD marker, a
   plan step vs WD-C's correction, `218` §2.6 vs §3.5 — already fixed, verify), one row each:
   `claim A (source) vs claim B (source) → which wins → why`. If you cannot settle it, say so.
5. **The first 48 hours.** The 5–8 items that are (a) unblocked now, (b) need no key and no owner
   decision, and (c) are verifiable in one lane each. Ordered by leverage. This is what the parent will
   dispatch next.
6. **Coverage proof.** For every input document above, one line: what you took from it / nothing
   (and why). This is how the parent knows the list is complete rather than merely long.

## Hard rules that make it real

- Every `verification command` must be one you have seen elsewhere in the record (or run yourself).
  If none exists, the item's status becomes `UNVERIFIABLE-NOW` and you say what is missing — you never
  invent a command.
- Every `files` entry must be a path that exists on disk today (check it). Plan a NEW file only if the
  plan step you are carrying names it.
- Nothing in the table may rest on a claim the watchdogs contradicted, unless the row's `why` cites the
  correction and describes the corrected fact.
- Prefer 40 real rows over 90 padded ones. Cut anything that is "nice to have" with no evidence behind
  it — and say you cut it.
