# W16 · LANES 1–4 + OBSERVER — keep executing the task list (owner: "work on them with more agents/keep working/spawn a watchdog observer to monitor/log/help delegation")

**All readers share this file.** Read your own section. Repo: `C:\Users\mnril\Desktop\RapidTool Main`
(Node v22.23.2; git-bash `/c/Users/mnril/Desktop/RapidTool Main`; SPACE in path → ripgrep FAILS, use `grep`).

```text
TREE: uncommitted on 7582771; C-1 (92/92) · C-2 (17/17) · guard fix (40/40) · doc-truth (11/11) ·
typecheck 0 — all boundary-verified. W15 lanes are finishing beside you (fixes/241_*); their edits touch
ONLY: headless.test.ts (L1), errors.ts+errors.test.ts (L2), browser logs (L3), a new research file (L4).
YOUR BOXES BELOW ARE DISJOINT FROM THEIRS AND EACH OTHER.

⚠️ HOST ARTIFACT (cost 3 runs today): node launched via the BACKGROUND process harness dies with
`stdin is not a tty`, zero output, exit 1. Run node tests in the FOREGROUND; a failure with that message
is the artifact, not your code (parent ledger: C:/Users/mnril/w15_parent_evidence.txt).

RULES: no fake code / no hallucinations / no bad code / no problem causers. "Do not rebuild before all
tasks are done" (do-not-rebuild list: 220_tasklist_canonical.md §2). WRITE EARLY: skeleton + bottom line
within ~10 calls, then fill (`fixes/244_lane<N>_<slug>.md`). Every claim = the command that produced it.
FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build` (parent/boundary only). Scratch outside the
repo (`C:/Users/mnril/w16l<N>_scratch/`). Playbook row blocks: research/multiagent/230_task_execution_playbook.md.
```

## LANE 1 — OV-35 · the Step-0 preflight (the critical path: nothing keyed runs until this lands)
**Owns:** `scripts/run-eval.mjs`, `scripts/run-eval.test.mjs`, `src/lib/doctor.ts` (+ `doctor.test.ts`).
Per `fixes/228` §3 #4/#5: (a) **OV-27 first** — a reachability probe that proves the CLI keyed path can
actually reach a model (the parent's doubt is narrow: the P6 synthesis path imports the provider via a
separate specifier, `engine.ts:2851-2885`; probe THAT path, keyless, with a dummy key; a `configured:true`
+ wire-reach report, honest about what it cannot prove without a key); (b) failure-class triage: a coded
`position`/`outcome` classification for every ending (no silent `stalled`); (c) kill-safety: a run marker
so a killed run cannot be mistaken for a completed one (WB-6: `results.json` then `history.json`, torn
pair — `run-eval.mjs:1177/:1206`). **Do not** re-implement `doctor --tree` (it exists).
**Done-when:** the probe exists + runs keyless with honest output; the triage covers all `RunOutcome`
values; kill-safety has a marker + a test; `run-eval.test.mjs` green (17/17 + your additions).

## LANE 2 — TASK-01 · `nextAction` on the summary envelope
**Owns:** `src/lib/headless.ts` (the summary envelope region ONLY), `scripts/rapidtool-cli.mjs` (the
summary arm ONLY), a doc-contract test file of your choice (`scripts/*.test.mjs`).
Per the playbook's TASK-01 block + IMPROVER anchor: the 7-arm vocabulary is pinned at
`src/components/console.tsx:382 NEXT_ACTION_BUTTON` — read it FIRST; the envelope must emit the same
arm. Add `nextAction` to the summary envelope so a caller (and the UI) never guesses the next step.
**Done-when:** the summary envelope carries `nextAction` from the same vocabulary the UI uses; a test
pins arm-parity between the envelope and `NEXT_ACTION_BUTTON`; keyless `summary`/`run` probes show it.

## LANE 3 — DF-18 + DF-26 · console honesty pair (the two "loud mislabels")
**Owns:** `src/components/console.tsx` (ONLY the `ScorecardBlock` region `≈:3303` and the packet/log
panels), `src/styles.css` if needed.
- **DF-18** (`grep -cE 'feasibility|template-derived|not live research' src/components/console.tsx` = 0
  today): the scorecard's template-estimate caveat was dropped in the UI → the scorecard reads as live
  research. Surface the caveat text where the score is shown.
- **DF-26** (`grep -c TRUNC src/components/console.tsx` = 0 today): the packet's 14 000-char truncation
  (`packet.ts:16/:17/:545-569`) is invisible → a downstream reader silently loses the tail. Surface the
  packet's OWN accounting (`:16/:17/:561`) — never recompute it.
**Done-when:** both greps ≥1; the UI still renders (no layout break — re-read your own render path); a
targeted test if one exists for console behaviour (else state honestly that none does).

## LANE 4 — OV-18 + OV-14 · pin the unpinned honesty windows
**Owns:** `src/lib/honesty-guards.test.ts`, `src/lib/gates.test.ts`, `src/lib/packet.test.ts`.
- **OV-18**: the clamp marker truncates at custom caps ≈64–118 but the window is deliberately UNPINNED.
  Pin it: a test that fixes the window (or the rule) at the exact caps the code uses — read the clamp
  implementation first; if the code's behaviour is wrong, register it (do not silently "fix" semantics).
- **OV-14**: `archProductComplete` is computed but never surfaced (skip≠complete invisible outside tests).
  Extend the gate/packet tests to prove the distinction is observable (name the surface you prove, and if
  the only correct fix is surfacing it in a file outside your box, write the exact patch proposal in your
  log instead of editing).
**Done-when:** both suites green under a foreground targeted run; each row states exactly what is pinned
and what remains unpinned (with why).

---

## OBSERVER — monitor + log all four lanes' actions, verify claims, help the delegator (`fixes/245_observer_report.md`)
**You are the watchdog observer.** Repo/rules as above; you are READ-ONLY (your report + scratch
`C:/Users/mnril/w16obs_scratch/` only; never edit src/scripts/corpus/lane logs; no git mutations; ≤2
targeted foreground test runs).
1. **Poll all four lanes ≥4 times** (`sleep 90`; transcripts: newest delegation dirs under
   `$HOME/AppData/Local/hermes/cache/delegation/live/`). Keep a **timestamped action log** in your report:
   per poll, per lane — last transcript mtime, files touched, current claim count.
2. **Verify ≥10 claims against bytes** (commands exist + ran; cited lines contain what is claimed; boxes
   respected — any out-of-box edit = P1 incident with `git status`/diff evidence).
3. **Re-run ONE named test per lane** (≤2 runs total, FOREGROUND — a `stdin is not a tty` result is the
   host artifact; re-run foreground and say so).
4. **Help-the-delegator section**: per lane, is it on-track/at-risk/stuck? What should the parent do next
   (dispatch? sequence? correct a brief?)? Name concrete collisions BEFORE they happen (check each lane's
   next likely file against the others' boxes).
5. **Bottom line at top:** `lanes polled: N · incidents: N · claims ok/wrong/unverifiable · at-risk lanes:
   N` → are the landings safe, is anything misreporting, what should the parent do next?
