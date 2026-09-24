# 228 · WATCHDOG Z — the ledger-keeper: watch everything, judge what is dangerous, and leave a record that survives context loss

**Read this file FIRST.** You are the last watchdog of the W13 inquest and the only agent whose job is the
**whole record**: index every deliverable, judge which findings are *dangerous* (not merely wrong), improve
the plan where you can prove the improvement, and leave a ledger a future session can start from without
re-deriving anything. Five siblings are running right now; you watch them too.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
TREE STATE: green + committed (7582771); boundary gate green (fixes/218 §5: 261 scripts / 1957 lib).
RUNNING SIBLINGS (poll these; find their dirs under $HOME/AppData/Local/hermes/cache/delegation/live/):
  deleg_7ff1f821 → research/multiagent/223_critical_path_premortem.md   (keyed pre-mortem)
  deleg_77801a52 → research/multiagent/224_advantage_gap_and_plan_audit.md (plan prosecutor + disadvantage ledger)
  deleg_471d953e → research/multiagent/225_field_failures_forensics.md · 226_shortcomings_and_plan_stress.md
                  · 227_plan_gaps_adversarial.md

THE OWNER'S ASK (verbatim): "watch/help all agent findings/evaluate bad things or dangerous things
intelligently/improve things and help the plan patches/plan itself be better and log their findings and
work etc to prevent loss of productivity/false info."

THE STANDARD: no hallucinations, no fake code, 100% truth. For you specifically:
- an index entry is only real if the file exists today (verify with ls/wc — paste the numbers);
- a risk is only a risk if you can name what it would destroy (a claim, a decision, a lane's budget, the
  user's trust) and cite the evidence;
- your own improvements follow the attributable protocol below — never a silent edit.

RULES:
1. WRITE: your deliverable (below) + SMALL attributable corrections in the plan/list files in exactly this
   form: `> [WD-Z · 2026-09-24] CORRECTED: <text> → <fact> — evidence: <file:line/command>. (by WD-Z)`.
   Corrections only; never rewrite prose; never delete a row. No src/scripts edits; no git mutations.
2. ALLOWED: read-only reads/greps; polling with `sleep 90` (≥3 cycles across the run); ≤2 targeted test
   runs. FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build`.
3. Scratch outside the repo (`C:/Users/mnril/w13z_scratch/`). Skeleton first, then fill in passes; if your
   budget runs out, the §1 ledger and §2 top-five risks must be complete — say what is unfinished.
```

> [WD-Z · 2026-09-24] CORRECTED (scope): "TREE STATE: green + committed (7582771); boundary gate green" → the tree is committed at `7582771` and green as of the **11:08 gate of record** (`fixes/218` §5), but `src/components/console.tsx` was last written **11:09:23** — 75 s AFTER that gate — and was committed at 11:15:16 with no re-run, so "green on the committed bytes" is UNVERIFIED for `console.tsx` (no component test exists; full typecheck is boundary-only; WD-Z's parse-only probe = 0 syntax diagnostics). Settle it at the next boundary: `bash scripts/gate.sh`. — evidence: `stat -c "%y" src/components/console.tsx` = 2026-09-24 11:09:23; `git log -1 --format=%ci` = 11:15:16; `219b` §5/§6; `fixes/228` §2 D1.2. (by WD-Z)

**Your deliverable:** `fixes/228_ledger_and_risk_register.md`

## §1 — THE LEDGER (the anti-loss artifact; write this first, keep it current)

One table, one row per deliverable of the whole inquest — **20 rows**:
`219a` `219b` `219c` `219d` `219e` `219f` · `219_wdA` `219_wdB` `219_wdC` · `220_tasklist_canonical`
`220_external_verification` `220_overhaul_plan` · `221_feature_designs` `222_codebase_integration_map`
`223_critical_path_premortem` `224_advantage_gap_and_plan_audit` `225_field_failures_forensics`
`226_shortcomings_and_plan_stress` `227_plan_gaps_adversarial` · `fixes/218` (the W12 close, the baseline).
Columns: `file | author/lane | status (COMPLETE / SKELETON / PARTIAL / NOT-WRITTEN) | size on disk (measured) |
what it contributes (1 line) | corrections applied to it (ids, with by-whom) | its PROPOSED ROWS (count,
id range) | caveats a reader must know`.
**Verification:** every size measured today by a command; every "COMPLETE" justified by a read of the file's
last section (not by the author's claim). Where a sibling is still running, mark `IN-FLIGHT` + last
transcript mtime, and update it at your next poll.
End §1 with **"the three files a future session must read first, in order"** — and why.

## §2 — THE DANGER REGISTER (the intelligent part; rank by what it would destroy)

Sweep every deliverable for the four danger classes. For each hit:
`id | class | the finding | what it would destroy | evidence | what to do | who should do it`.
1. **Thin-but-load-bearing claims** — assertions that would change a decision if someone quoted them, but
   whose evidence is a single un-rerun read or a dossier citation. (Test: could a skeptic falsify it in one
   command? If yes and nobody ran that command, it is thin — name the command that would settle it.)
2. **Plan steps that could create new problems** — rows/patches that would introduce a silent failure,
   violate an invariant (`policy.ts`, `errors.ts:72`, `sandbox:false`, declare-or-strike), collide on a HOT
   file, or widen blast radius. Cross-check X-2's stress test when it lands; if X-2 has not landed, do it
   yourself for the rows you can see.
3. **Bad ideas presented as tasks** — proposed rows (from `226`/`227`/`225` when they land, and from `221`'s
   F1–F5) that should NOT be accepted. Say why, and what to do instead. (You are allowed to reject an idea
   your author-sibling proposed — that is the point of you.)
4. **Productivity loss / false info already in the record** — skeleton-only deliverables still on disk
   (`217e`, `217f`, `217h`… check which remain), a lane that burned its budget without writing its file,
   duplicated work between agents, any count that two files disagree on (the 6-vs-7 MCP count is already
   corrected in `220` §4.5 — find any OTHERS), and anything that would be *false info* if quoted verbatim.

## §3 — THE MERGE TABLE (make the parent's final pass mechanical)

When `225`/`226`/`227` land (poll for them), consolidate their **PROPOSED ROWS** into one table:
`row id | title | author | evidence-quality (strong/medium/thin) | duplicates an existing row? | collides on
a HOT file? | recommendation (ACCEPT / MODIFY → how / REJECT → why)`. Order by what most improves the
maker-test odds. Where two agents proposed the same thing, say so and keep the better-argued one.

## §4 — WORK LOG (your own record; the owner asked for it explicitly)

Append-only, timestamped: each poll (with the real transcript mtimes you saw), each verification you ran,
each correction you applied, each file you wrote, and anything you could not finish. This log is what
prevents the parent from re-doing your work after a context loss.

## §5 — BOTTOM LINE at the TOP of the file (write it first, refresh it last)
`deliverables indexed: N/20 · complete: N · in-flight: N · danger findings: N (by class) · proposed rows
consolidated: N · corrections applied: N` — then one paragraph: **the single most dangerous thing in the
whole record right now, and the one-line fix.**
