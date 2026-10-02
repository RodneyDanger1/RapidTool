# W49 / 335 — GUARDRAILS (published by Guardian, lane 335-7)

Operational checklist for all six lanes. Source of truth: `wave_plans/W49/README.md`.
Baseline HEAD at wave open: `9cff073`. Guardian enforces these; it is read-only on code.

## 1. Ownership table — edit ONLY what you own (+ your own tests)

| Lane | Owned files |
|---|---|
| 335-1 Prompter | `src/lib/codegen.server.ts`, `src/lib/phases.ts`, `src/lib/prompt-engine.ts` + their tests |
| 335-2 Ledger | `src/lib/headless.ts`, `src/lib/doctor.ts`, `src/lib/token-ledger.ts`, `src/lib/io.ts` + their tests |
| 335-3 Transit | `src/lib/scaffold.ts`, `src/lib/compile-check.server.ts`, `src/lib/dod.ts`, `src/lib/packet.ts`, `src/lib/handoff.ts` + their tests |
| 335-4 Switchboard | `scripts/**` (all of it), `tsconfig*.json`, `package.json` |
| 335-5 Chrome | `src/components/**`, `src/routes/**`, `src/lib/fixtures*.ts`, `src/lib/store.ts`, `src/lib/llm.ts` + tests |
| 335-6 Warden | `src/lib/algorithms.ts`, `algo-tools.ts`, `arch-tools.ts`, `ast-mine.ts`, `entry-oracle.ts`, `iterate.ts`, `judgment.ts`, `planning.ts`, `maker-score.ts`, `vector.ts`, `swarm.ts`, `design.ts`, `diagram.ts`, `bench.ts` + their tests; plus `scripts/check-*.mjs` + tests |

## 2. Do-not-touch register

- **Unowned core** — request a change in your own log with the exact shape; the PARENT lands it:
  `src/lib/engine.ts`, `types.ts`, `errors.ts`, `knowledge.ts`, `harvest.ts`, `verify.server.ts`,
  `verify.ts`, `node-runner.server.ts`, `rt-*.ts`, `watchdog.ts`, `diagnose.ts`.
- **Frozen**: `fixes/331_*` … `fixes/334_*` history; `research/eval-out/**`;
  `research/multiagent/thoroughanalysis.md` body; `migrations/**`; `research/eval-corpus/**`.
- **Parent-only**: `wave_plans/**`, `fixes/**`, `src/lib/engine.ts`-class unowned files.
  (`package.json` / `tsconfig*` belong to 335-4, not the parent.)
- **Any file you do not own** → STOP-and-REPORT (rule 5 below). Do not edit it.

## 3. Patch discipline

- Minimal, targeted patch. Never rewrite a whole file to change a few lines.
- Never reformat or "clean up" code you were not asked about.
- **Re-read the file before patching it.**
- Checkpoint before a multi-hunk change: write the intended patch into your log first.

## 4. Append-only logs

- `fixes/335_<n>_<persona>.md` — **append only**. Never rewrite your own log's prior content.
- Never rewrite, truncate, or reorder another lane's log. Logs only grow.

## 5. If you think another lane's file is wrong

STOP-and-REPORT in your OWN log (path, what is wrong, evidence, suggested fix). **Never edit it.**

## 6. Scratch, secrets, eval

- Scratch lives OUTSIDE the repo: `%TEMP%\rt335_<lane>\…`. The repo gains no probe file.
- Never print a secret (keys by last-4 tail only). No keyed calls in a loop; ≤1 bounded keyed call/lane.
- **Never run `npm run eval`** — it rewrites tracked `research/eval-out/**`.
- No commits, no `git reset`, no `git stash`, no branch/rebase operations. Parent runs the full gate.

## 7. Rescue — your work is recoverable

Guardian takes a baseline manifest (blob hash + size) of every tracked path outside owned sets and
re-checks the tree every ~3 min. If a tracked file is **deleted/truncated**, or a **do-not-touch** file's
committed content **changes**, Guardian records the evidence (baseline vs observed hash/size, timestamp,
attribution) and may restore that single file with `git checkout HEAD -- <path>`, then confirms the hash.
A lane's own legitimate in-progress edit is **not** destruction and is never "fixed". Nothing else is
restored.
