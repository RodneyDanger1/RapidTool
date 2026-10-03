# W51 (337 wave) — GUARDRAILS (published by lane 337-5, Guardian)

Published 2026-10-02 by the integrity watchdog. The wave contract is
`wave_plans/W51/README.md`; this file is the binding operating rules for all three hunters
(337-1 Core, 337-2 Pulse, 337-3 Trust) and both watchdogs. Where this file and the README
disagree, the README wins and the Guardian is wrong — report it.

Baseline (T0, verified by the Guardian): HEAD `dd6194c`, tree clean apart from the new
`wave_plans/W51/`; 2046 tracked files. Gate baseline: typecheck 0 both legs · lint 0 warnings ·
411 scripts + 2848 lib tests / 0 fail / 2 skipped · build 0 · `gate.sh ok:true`.

## 1. Ownership table (strict, disjoint)

| Lane | Owns (exclusive write) |
|---|---|
| 337-1 **Core** | `src/lib/`: `engine.ts`, `headless.ts`, `io.ts`, `checkpoint.server.ts`, `phases.ts`, `planning.ts`, `gate-stats.ts`, `bounded-int.ts`, `compaction.ts`, `handoff.ts` + their `.test.ts` |
| 337-2 **Pulse** | `src/components/**`, `src/routes/**`, `src/lib/`: `store.ts`, `llm.ts`, `chat.ts`, `chat.server.ts`, `crew.ts`, `crew.server.ts`, `llm-tasks.ts`, `db.ts`, `llm/**`, `auth/**`, `app-data/**`, `multiplayer/**` + their tests |
| 337-3 **Trust** | `src/lib/`: `codegen.server.ts`, `scaffold.ts`, `compile-check.server.ts`, `dod.ts`, `packet.ts`, `verify.ts`, `verify.server.ts`, `entry-oracle.ts`, `knowledge.ts`, `harvest.ts`, `maker-score.ts`, `report-intake.ts`, `patch.ts`, `quarantine.ts`, `algorithms.ts`, `algo-tools.ts`, `arch-tools.ts`, `ast-mine.ts`, `iterate.ts`, `judgment.ts`, `vector.ts`, `swarm.ts`, `design.ts`, `diagram.ts`, `bench.ts`, `cassette.ts`, `exec.ts`, `node-runner.server.ts`, `runtime-log.server.ts`, `rt-*.ts`, `watchdog.ts`, `diagnose.ts`, `error-scan.server.ts`, `plugin.ts`, `preview-*.ts`, `vault.ts`, `render.ts`, `research.ts`, `git.server.ts`, `policy.ts`, `deepseek.server.ts`, `errors.ts`, `types.ts` + their tests |
| 337-4 **Verifier watchdog** | read-only; its own log `fixes/337_4_verifier.md` only |
| 337-5 **Guardian watchdog** | read-only; this file + log `fixes/337_5_guardian.md` + the narrow rescue in §7 |

**Write nothing outside your lane.** There are functional `src/lib/*.ts` files in *no* lane this
round (`prompt-engine.ts`, `scorecard.ts`, `sandbox.ts`, `sandbox-policy.ts`, `selfmod.ts`,
`selfmod.server.ts`, `settle.ts`, `subagent.ts`, `token-ledger.ts`, `tracing.ts`, `templates.ts`,
`server-spec.ts`, `doctor.ts`, `write-set.ts`, `wild-mode.server.ts`, `wild-review.ts`,
`websearch.server.ts`, `tavily.server.ts`, `fixtures*.ts`, `brief-fixtures.ts`, the `*-guards.test.ts`
files). Treat them as frozen: read them, report findings in your log, do not edit them.

## 2. Do-not-touch list (frozen for everyone, no exceptions)

- `fixes/**` — history is **append-only**; never edit, reorder, truncate or delete an existing log.
- `research/eval-out/**` (345 tracked files).
- The register body `research/multiagent/thoroughanalysis.md` — append only, at its end-marker.
- `migrations/**`.
- `research/eval-corpus/**` (23 tracked files).
- `package.json`, `tsconfig*.json` (all legs), `scripts/gate.sh`.
- `scripts/**` — owned by **nobody** this round. A defect there is **STOP-and-REPORT**, not a patch.
- Any file whose owner column in `%TEMP%\rt337_guardian\baseline_all.tsv` is empty (see §1).

## 3. Append-only logs

Each agent writes only its own log `fixes/337_<n>_<persona>.md`, appending incrementally as it
works (do not buffer the whole round into one write and do not rewrite earlier sections). Logs are
untracked scratch-per-round records; they are never committed by the hunters. The Guardian records
baseline + each check in its own log and in `%TEMP%\rt337_guardian\monitor_log.txt`.

## 4. Patch discipline

Minimal, surgical hunks. Re-read the file before patching. Never rewrite a file to change a few
lines; never reformat; never "clean up" code you were not asked about. `engine.ts` (231 KB),
`codegen.server.ts` (234 KB), `headless.ts` (250 KB) and `console.tsx` (315 KB) are patch-only.
No `as any`, no `@ts-ignore`/`@ts-expect-error`, no `TODO` bodies, no silent `catch {}`, no
hardcoded returns that fake a computation, no test that cannot fail. Run the mock/fake census over
every file you touch and report it. RED-first: ship a test that fails before and passes after, and
show both outputs. A skip is never a pass; evidence is a command's real output or bytes read today.

## 5. Wiring rule (owner's explicit instruction)

When you patch a file, trace what it calls and what calls it — imports, dynamic `import()`, event
emitters, store actions, server functions, provider seams — and inspect those places too. If the
target is in **your** lane, fix it there. If it is in **another** lane, do **not** touch it: report
the exact `file:line` and the proposed patch in your log; the boundary owner routes it after the
round. Two writers on one file in one round is how good code gets destroyed.

## 6. No deletions

**No deletions of tracked files, ever** — not even code you believe is dead. Prove it is dead and
propose removal; the owner declined the dead-code question, so the sign-off rule stands. No
`git rm`, no `git mv` out of a lane, no emptying a file.

## 7. Rescue procedure (Guardian only, narrow)

If and only if a hunter has provably deleted or truncated committed work, the Guardian may restore
that **single** file with `git checkout HEAD -- <path>`, after first recording in its log the
evidence: baseline path+blob+size, the observed state, the timestamp, and why it is destruction
(not a legitimate in-progress edit). The Guardian then confirms the restored blob matches the
baseline. The Guardian never runs `git reset`, `git stash`, `git checkout -b`, rebase, or any
`.git`-internal operation, and never "fixes" a hunter's legitimate in-progress edit. Everything
else that looks wrong is **reported**, not repaired.

## 8. Prohibited operations (all agents)

No commits, no `git reset`/`stash`/`checkout -b`/`rebase`/`merge`/`revert`/`cherry-pick`, no
touching `.git` internals, no branch creation or deletion. No keyed calls in a loop (at most one
bounded call per hunter, usage reported). **Never run `npm run eval`.** Never print a secret; tails
only. Scratch lives outside the repo in `%TEMP%\rt337_<agent>\…`; the repo gains no probe file.

## 9. Gate ownership

While siblings are mid-edit: **targeted suites only** (the specific `node --test` files for the
modules you touched, with `--test-reporter=tap`). Do **not** run `npm test`, `npm run build`, or
`bash scripts/gate.sh` — the **parent** runs typecheck, lint, both test legs, build and `gate.sh`
at the boundary. The Guardian's end audit runs only `npx tsc --noEmit`, `npm run lint`, and the
targeted suites.

## 10. STOP-and-REPORT

Stop and report (do not patch) when: the defect is in `scripts/**` or another lane; the fix would
require a new dependency, a `package.json`/`tsconfig` edit, a migration, or a signature change that
crosses a lane boundary; or you cannot make the change without deleting or rewriting a file.

## 11. Guardian contact

The Guardian runs a read-only monitor every ~3 minutes, diffing the tree against
`%TEMP%\rt337_guardian\baseline_all.tsv` (path + index blob + size + owner). It flags deletions,
truncations, outside-owned edits, `fixes/**` loss, and secret/probe/binary additions, and it may
rescue a destroyed single file (§7). Nothing here changes what you were asked to do; it only
constrains how.
