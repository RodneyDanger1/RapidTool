# W355 · lane `reviewer-pipeline` — code review 1 of 3

**Wave:** W355 (the audit/freeze wave). **Kind:** read-only code review. **Author:** the wave parent.
**You are one of 6 Wave 0 lanes** (3 reviewers · 2 bug inspectors · 1 cartographer).

## Mission

Review the **engine and pipeline control plane** of RapidTool and report, with evidence, everything
that is wrong, inconsistent, dishonest, or fragile — and everything that is genuinely well-built, so
the later waves do not "fix" what already works.

The engine is the product's spine: a 13-phase governed run (P0→P12) behind evidence-hashed DoD gates,
an append-only decision ledger, HITL seats, and a bounded autonomous "wild" loop.

## Scope (yours alone — do not read-review other lanes' files as your primary subject)

- `src/lib/engine.ts` — the phase state machine, `wildStep`, `wildLeavePhase`, `stageWildPlan`, the
  reviewer resolution, `forceHuman` gates
- `src/lib/phases.ts` — the phase graph and `canEnter` edges
- `src/lib/dod.ts` — the DoD gate registry, criteria probes, `classifyRowSeat`, `provenanceConsistent`
- `src/lib/policy.ts` — the seat/action policy and provenance
- `src/lib/headless.ts` — the journey driver / CLI backend (`driveP6Journey`, `keepBestTree`,
  `respondDriveOutcome`, `runlockEditViolations`, `landEmittedTree`)
- `src/lib/store.ts` — the zustand run store + the console driver
- `src/lib/watchdog.ts` — the autonomy seams
- their colocated `*.test.ts`

## Specific questions to answer

1. **Gate integrity.** Can any path read a gate `green` off a stale or earlier cycle's tree? Is
   `sealedWithFailures` computed correctly on every terminal path? Does `evidenceClass` always name
   the real evidence?
2. **Seat provenance.** Is there any machine path that can mint `decidedBy:"human"`? Are the console
   seat, the CLI seat and the machine seat distinguishable on every recorded decision?
3. **Phase edges.** Are the P6→P7 `canEnter` guards and the "advisory vs `enforceDod`" split coherent?
   On the keyed path P7–P12 stay `locked` — is every surface honest about that?
4. **The `forceHuman` class.** Enumerate every gate that no machine seat can clear, and state exactly
   what each one protects. (Wave 6 needs this list; do not propose removing them.)
5. **The wild loop.** Does `stageWildPlan` / `wildStep` / the console driver agree about what a park
   means? Is any park silently unrecoverable?
6. **The driver.** Are the RUNLOCK guard, the no-progress guard, the step cap and the outcome stamp
   coherent, or can one mask another?
7. **Error discipline.** Does every surfaced failure carry an `RT_E_*` code from `src/lib/errors.ts`?
   Name any swallow (a caught error with no code and no ledger row).
8. **Tests.** Which engine behaviors are unpinned by tests? Name the specific missing case, not a
   general "coverage is low".

## Deliverable

`research/multiagent/355_1_review_pipeline.md` — the ONLY file you write. Structure:

1. **Method** — the exact commands you ran (targeted `node --test --test-reporter=tap <file>`,
   `grep`/`Select-String` reads, `npx tsc --noEmit` if useful).
2. **Findings** — a table: `id | severity (P0/P1/P2/P3) | title | file:line | evidence | why it matters`.
   P0 = broken/dishonest behavior reachable in normal use.
3. **What is genuinely sound** — with evidence. This section is required; it stops later waves breaking
   working design.
4. **What I could not verify** — stated plainly.
5. **Recommended owners** — which later-wave lane should carry each P0/P1.

## Evidence bar (non-negotiable)

Every finding cites `file:line` **and** the command or read that produced it. Where a doc and the bytes
disagree, **the bytes win** — say so explicitly. Never restate a doc claim as fact.

## Do not

- Do not edit any product file. Do not edit `research/multiagent/thoroughanalysis.md` (the register) —
  the wave parent consolidates. Do not edit another lane's report.
- Do not run `npm test`, `npm run build`, or `bash scripts/gate.sh` — the tree is red and other lanes
  are working; targeted per-file runs only.
- Do not propose changing `forceHuman` gates; report them.
