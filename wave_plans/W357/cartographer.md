# W357 · lane `cartographer` — verify W357, and map the road to the factory's stated purpose

**Wave:** W357. **Persona:** `cartographer`. **Author:** the wave parent. Read this FIRST.

## Mission

Three jobs: verify the five W357 lanes against the bytes; map the regressions this wave introduces; and
advance the two architecture questions the W356 map opened, which are the direct road to the factory the
owner described (a prompt + goal + kind in, the best version of that kind out).

## Owned files (findings only)

`research/multiagent/357_cartographer.md` (the only file you write). Read anything.

## Job 1 — verify the five lanes (adversarial)

Read `fixes/357_fix_build.md`, `357_fix_lint.md`, `357_fix_gates.md`, `357_fix_preview.md`,
`357_fix_tests.md`. They may still be in progress; pin the revision window and report what exists.
Verify each claim by measurement, never by reading the lane's log:

- **`fix-build`**: `npm run build` exits 0 **and** the migrations are genuinely applied at runtime (the
  PGLite fallback path), with no `.sql` in the bundle. Check the built output, not just the exit code.
- **`fix-lint`**: `npm run lint` exit 0, and the residual problem count is real. Re-derive how many
  problems come from source after the ignore, and confirm no rule was weakened to reach zero (read the
  config diff).
- **`fix-gates`**: `moduleCoverage` green with `stale:[]` and no entry wrongly removed (a reached module
  must not stay allowlisted, and an unreached one must not be dropped); the ratchet's R-3/R-4/R-5/R-8
  fixes each provably able to fire (plant the case); the `src/**` `realProductOnly` reader at zero false
  positives on the real tree.
- **`fix-preview`**: a below-floor run's Preview surfaces the tree **with** the banner and returns a ZIP,
  while a differently-red run still returns the coded refusal with no archive. Verify both branches.
- **`fix-tests`**: the attribution table is correct (spot-check at least three rows by re-running them),
  and no assertion was loosened or skipped without a registered reason.

Report each as **CONFIRMED / REFUTED / PARTLY / UNDECIDED** with the deciding command.

## Job 2 — the W357 regression map

New bugs from this wave's diffs: an ignore that now hides a real source problem; a build fix that breaks
the PGLite fallback or the migration order; a coverage allowlist entry removed that was still needed; a
Preview opt-in that now surfaces a tree a different refusal was meant to withhold; a ratchet floor pinned
at a value a regression cannot move. Each with `file:line` + the query that shows it.

## Job 3 — advance the road to the owner's purpose (the highest-value mapping you can do)

The W356 map found **no synthesis prompt contains the delivery kind** and named eight default/ignore
sites. Take that to the next level of usefulness: produce a **sequenced, file-level plan** for making the
factory deliver the best version of the *requested* kind.

- For each of the five kinds (app/game/tool/service/library): what the pipeline must do differently
  (spec expansion, synthesis prompt content, emitted entry shape, declared scripts, the kind's required
  surface, the gates that must bind). Cite the current `file:line` that does the wrong/absent thing.
- Name the single highest-leverage insertion point for the kind (the map suggests
  `codegen.server.ts` / `prompt-engine.ts` context assembly) and what context must be added, with the
  token budget it would need (the W356 map measured P6 at 60,000 chars / 32,000 tokens).
- Name the CLI `kind` flag's inert path (`rapidtool-cli.mjs:1632`), the keyed-only stamp
  (`engine.ts:4073`) and `headless.ts:6590`'s `(kind: undefined)` as the three places an honestly-resolved
  kind must be threaded.
- State, per kind, whether a **real** corpus case exists today (tool/service/library each have one; do
  they still fail their own `tsc`?).

This plan is the input to the next wave's dispatch, so make it file-level and sequenced.

## Evidence bar

Every claim cites `file:line` and the command or read that produced it; every absence claim carries its
zero-result query; where a lane's log and the bytes disagree, the bytes win and you record a correction.
State plainly what you could not determine, and include a mid-tree disclaimer for anything judged while a
lane was editing.

## Do not

- Do not edit any product file, doc, script, the register, or another lane's log.
- Do not run a keyed LLM call. Do not run the full gate (the parent runs the boundary). No git writes.
