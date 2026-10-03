# W51 (the 337 wave) — three bug hunters + two watchdogs

**Opened:** 2026-10-02. **HEAD at open:** `dd6194c`, tree clean.
**Baseline gates:** typecheck 0 (both legs) · lint 0 warnings · assertion-gaps 0 ·
**411 scripts + 2848 lib tests / 0 fail / 2 skipped** · build 0 · `gate.sh ok:true`.
Node 22.23.2 at `%LOCALAPPDATA%\hermes\node\node.exe`; host Node **v24.15.0**. Always pass
`--test-reporter=tap` when parsing `node --test` output. For `gate.sh` use
`& "C:\Program Files\Git\bin\bash.exe"`.

## The owner's brief

> Run three professional bug-hunting engineers to analyse the **functional parts** of RapidTool for bugs,
> errors and bad code, and write patches with professional code. **If the code they touch extends or
> pings/talks/wires to other places, go to that place and look for and fix bad code** — proper wiring.
> Only professional, working code. No bad code. Spawn **two watchdogs** to peruse RapidTool for
> bugs/errors/nonsense too and report back when the round is done.

So: three hunters with **disjoint ownership of the functional surface**, and two watchdogs that work
independently and report at the end.

> **CORRECTION (337-5 Guardian, F1).** This document originally claimed the hunters' ownership was
> "complete … every functional file belongs to exactly one hunter, so following a wire always lands
> inside somebody's domain". **That claim is false.** The guardian measured ~20 functional `src/lib`
> modules in no hunter's lane, so a wire followed out of a lane can land in nobody's domain:
> `prompt-engine.ts`, `scorecard.ts`, `sandbox.ts`, `sandbox-policy.ts`, `selfmod.ts`,
> `selfmod.server.ts`, `settle.ts`, `subagent.ts`, `token-ledger.ts`, `tracing.ts`, `templates.ts`,
> `server-spec.ts`, `doctor.ts`, `write-set.ts`, `wild-mode.server.ts`, `wild-review.ts`,
> `websearch.server.ts`, `tavily.server.ts`, `fixtures*.ts`, `brief-fixtures.ts`. Findings there were
> reported by the watchdogs and landed by the follow-up round; any future round must name them
> explicitly rather than assume the table is total.

## Step 0 — every agent does this FIRST

Read the relevant lane logs from the six previous waves (`fixes/331_*` … `fixes/336_*`), the boundary
records (`fixes/333_0_parent.md`, `fixes/334_0_parent.md`, `fixes/335_0_parent.md`,
`fixes/336_0_parent.md`), and the register's `AW45-*`/`AW46-*`/`AW47-*` appendices in
`research/multiagent/thoroughanalysis.md`. Open your log with **claimed / on disk / still open**
(`file:line` for the last). Do not re-litigate a finding a previous wave already fixed — verify it holds
and move on. **Your value this round is the code nobody has audited yet:** the files listed against your
name below have not been systematically read, and several have no test coverage at all.

## The hunters (STRICT, disjoint, and jointly complete over the functional surface)

| Hunter | Persona | Owns |
|---|---|---|
| 337-1 | **Core** — the engine, drivers and persistence | `src/lib/engine.ts`, `headless.ts`, `io.ts`, `checkpoint.server.ts`, `phases.ts`, `planning.ts`, `gate-stats.ts`, `bounded-int.ts`, `compaction.ts`, `handoff.ts` + their tests |
| 337-2 | **Pulse** — the surface, the AI runtime, the transports | `src/components/**`, `src/routes/**`, `src/lib/store.ts`, `llm.ts`, `chat.ts`, `chat.server.ts`, `crew.ts`, `crew.server.ts`, `llm-tasks.ts`, `llm/**`, `auth/**`, `db.ts`, `app-data/**`, `multiplayer/**` + their tests |
| 337-3 | **Trust** — emissions, verification, the learning loop | `src/lib/codegen.server.ts`, `scaffold.ts`, `compile-check.server.ts`, `dod.ts`, `packet.ts`, `verify.ts`, `verify.server.ts`, `entry-oracle.ts`, `knowledge.ts`, `harvest.ts`, `maker-score.ts`, `report-intake.ts`, `patch.ts`, `quarantine.ts`, `algorithms.ts`, `algo-tools.ts`, `arch-tools.ts`, `ast-mine.ts`, `iterate.ts`, `judgment.ts`, `vector.ts`, `swarm.ts`, `design.ts`, `diagram.ts`, `bench.ts`, `cassette.ts`, `exec.ts`, `node-runner.server.ts`, `runtime-log.server.ts`, `rt-*.ts`, `watchdog.ts`, `diagnose.ts`, `error-scan.server.ts`, `plugin.ts`, `preview-*.ts`, `vault.ts`, `render.ts`, `research.ts`, `git.server.ts`, `policy.ts`, `deepseek.server.ts`, `errors.ts`, `types.ts` + their tests |
| 337-4 | **Verifier watchdog** (adversarial) | read-only; its own log only |
| 337-5 | **Guardian watchdog** (integrity) | read-only; its own log + `wave_plans/W51/GUARDRAILS.md`, with a narrow rescue power |

**Frozen / do-not-touch for everyone:** `fixes/**` history (append-only logs), `research/eval-out/**`,
the register body (append only via its end-marker), `migrations/**`, `research/eval-corpus/**`,
`package.json`, `tsconfig*.json`, `scripts/gate.sh`. `scripts/**` is owned by nobody this round — a
finding there is a STOP-and-REPORT.

## The wiring rule (the owner's explicit instruction)

When you patch a file, **trace what it calls and what calls it** — imports, dynamic `import()`, event
emitters, store actions, server functions, provider seams — and inspect those places too. If the target
is inside your ownership, fix it there (that is the "proper pings/wiring" the owner asked for). If it is
in another hunter's domain, **report it with the exact `file:line` and the proposed patch** and leave it:
two writers on one file in one round is how good code gets destroyed. The boundary owner routes those
after the round.

## Hard rules

1. **NO DELETIONS of tracked files** — the owner declined the dead-code question, so the repo rule stands
   (sign-off required). Prove dead code is dead and propose it.
2. **Patch discipline.** Minimal, surgical patches; re-read before patching; never rewrite a file to
   change a few lines; never reformat; never "clean up" code you were not asked about. `engine.ts`
   (231 KB), `codegen.server.ts` (234 KB), `headless.ts` (250 KB) and `console.tsx` (315 KB) are
   patch-only.
3. **No mock, fake or placeholder code.** The owner's standard is absolute: no `TODO` bodies, no `as any`,
   no `@ts-ignore`/`@ts-expect-error`, no silent `catch {}`, no hardcoded return that fakes a computation,
   no test that cannot fail, no comment claiming behaviour the bytes do not have. Run the **mock/fake
   census** over every file you touch and report it. The emitted product's `TODO(E-15)` marker is the
   product contract — leave it.
4. **No fabrication.** Evidence is a command's real output or bytes read today. A skip is never a pass.
5. **RED-first.** Every fix ships a test failing before and passing after — show both. Where a test is
   impossible, show the probe and say what is uncovered.
6. **No full gate while siblings are mid-edit.** Targeted suites only; the **parent** runs typecheck,
   lint, both test legs, build and `gate.sh` at the boundary.
7. **No keyed calls in a loop** (at most one bounded call per hunter, usage reported). **Never run
   `npm run eval`**; the keyless harness is run by the parent into scratch.
8. **Never print a secret**; tails only.
9. **Append-only logs** at `fixes/337_<n>_<persona>.md`.
10. **Scratch outside the repo** (`%TEMP%\rt337_<agent>\…`); the repo gains no probe file. Checkpoint an
    intended large patch into your log before applying it.

## What "functional parts" means for the hunters' focus

Prioritise **behaviour that a user or an agent depends on**: a path that silently returns success, a
handler that drops a result, an error that loses its code, a state field written but never read, a retry
or budget that cannot fire, a boundary that is off by one, a cache/hash that ignores an input, a guard
that cannot fail, a promise that floats, a lock that is not released, a cleanup that cannot happen.
Cosmetic style is out of scope; correctness, wiring and honesty are in scope. A **clean verdict backed by
a probe is a valid and valuable result** — say what you read and what you ran, and do not invent a defect
to look busy.
