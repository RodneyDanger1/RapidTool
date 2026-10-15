# W355 · lane `reviewer-selfimprove` — code review 6 of 7 (GAP-FILLING WAVE 355b)

**Wave:** W355 / batch **355b** (the gap-filling extension of the audit wave).
**Kind:** read-only code review. **Author:** the wave parent.

## Why this lane exists (the gap it fills)

The campaign's goal is that RapidTool **learns and improves itself and its output every run**. The
whole machinery for that exists in the tree — `selfmod.ts`, `knowledge.ts`, `bench.ts`, `iterate.ts`,
`harvest.ts`, `maker-score.ts`, `judgment.ts`, `algorithms.ts` — and **no W355 lane audits its
behavior**: `cartographer` maps its structure, nobody checks whether it is correct, bounded, safe, or
actually connected.

`cartographer` has landed `research/multiagent/355_6_architecture_map.md` and already found the shape of
this problem: several learning artifacts are **written but never read**, and several drivers have
**zero production callers** (`defectRepairLesson`/`selectDefectRepairLessons`/`applyLessonDemotion`,
`driftLesson`, `iterateToSatisfaction`, `createSubagentContract`, `crewToReport`). **Read that report
first and go deeper — audit behavior and correctness. Do not restate its structural map.**

## Mission

Audit the self-improvement substrate: (a) is the learning loop **closed** — does anything consume what
is written? (b) is the self-modification surface **bounded and safe**? (c) are the scoring/evaluation
**algorithms correct and meaningful**? (d) is the **agent runtime** correct (crew/subagent/swarm/wild/
telemetry purity)? (e) is the **kind-coverage** claim ("any kind of software") true end to end?

## Scope (yours alone)

**Self-modification:** `src/lib/selfmod.ts`, `selfmod.server.ts`, `patch.ts`, `git.server.ts`,
`checkpoint.server.ts` (selfmod-facing reads only), `quarantine.ts`.
**Learning & memory:** `src/lib/knowledge.ts`, `vault.ts`, `harvest.ts`, `compaction.ts`, `settle.ts`,
`brief-fixtures.ts`, `research.ts`, `websearch.server.ts`, `tavily.server.ts`, `vector.ts`,
`repo-map.ts`, `ast-mine.ts`.
**Scoring & evaluation algorithms:** `src/lib/bench.ts`, `iterate.ts`, `maker-score.ts`,
`scorecard.ts`, `judgment.ts`, `algorithms.ts`, `algo-tools.ts`, `arch-tools.ts`, `design.ts`,
`diagram.ts`, `render.ts`, `planning.ts`, `report-intake.ts`, `templates.ts`, `probe.ts`.
**Agent runtime:** `src/lib/crew.ts`, `crew.server.ts`, `swarm.ts`, `subagent.ts`, `handoff.ts`,
`wild-mode.server.ts`, `wild-bridge.ts`, `wild-bridge.server.ts`, `wild-review.ts`, `mcp.server.ts`,
`plugin.ts`.
**Telemetry & bounds:** `src/lib/rt-events.ts`, `rt-ring.ts`, `rt-client.ts`,
`runtime-log.server.ts`, `tracing.ts`, `diagnose.ts`, `exec.ts`, `isolation.server.ts`, `sandbox.ts`,
`sandbox-policy.ts`, `bounded-int.ts`, `one-shot-fetch` bounds (the provider file itself is
`reviewer-platform`'s — you audit the *bound*, not the seam).
**Kind coverage:** the end-to-end matrix for the project kinds the emitter claims to support
(`app`/`game`/`tool`/`service`/`library`) — you own the **matrix and its honesty**; `scaffold.ts`
internals stay `reviewer-synthesis`'s.

## Specific questions to answer

1. **Is the learning loop closed?** For every store that records a lesson, witness, defect class,
   score, or bench result: name its **writer** and its **reader**. Where a reader is absent, say so with
   the zero-result query. Where a reader exists, prove the value actually reaches a prompt, a policy
   decision, or a gate — not just a log line.
2. **Do successes teach?** The docs describe learning from **mistakes and successes**. Does the code
   capture anything from a *successful* run, or only from defect/repair paths?
3. **Is self-modification safe and bounded?** What exactly can `selfmod` change in RapidTool itself?
   Is there a dry-run, a diff, a seat/approval, a rollback, a file scope, a size bound, and a test that
   runs before the change lands? Can a hostile **brief** (LLM input) reach a selfmod write, a `git`
   write, or a patch application? Trace the input path and say yes/no with `file:line`.
4. **Telemetry purity.** The repo's doctrine is "telemetry must NEVER change engine behavior" and "must
   never throw into the code it observes". Verify that on the bytes: is the ring bounded, is capture
   truly non-parsed, can a telemetry failure throw, and is the purity claim test-pinned?
5. **Runtime bounds.** For the bounded runner, the exec/sandbox layer and every fetch: what is the
   actual resource bound (heap, time, fs, process, network), and which claim exceeds it? Keep
   `sandbox:false` honest — do not propose claiming a sandbox.
6. **Concurrency safety.** `subagent.ts` declares concurrency caps and a claim lifecycle but is
   unreferenced; `crew`/`swarm` seats exist with no dispatcher. If these were wired as designed, would
   the caps hold? Is there any live path today where two writers can touch one file?
7. **Scoring validity.** Are `maker-score.ts` / `scorecard.ts` / `judgment.ts` / `bench.ts` scores
   derived from real bytes, or can they be inflated? Is `algorithms.ts` (fusionRank, stemming, the
   quality/effort heuristics) mathematically sound — do its bounds and stated invariants hold? Name any
   score that a hollow output could earn.
8. **Kind coverage.** For each kind, is the end-to-end path real (brief → plan → synthesis → emit →
   the tree's own toolchain → a runnable artifact)? Which kinds are claimed but unproven, and what
   breaks them? (`fixes/353_validation_wave.md` found the non-web entry bug for tool/service/library.)
9. **Grounding quality.** P0/P7/P11 produce "research" artifacts. Is that research real (a live search,
   a citation) or an offline stub? Does anything validate it before it reaches a prompt?

## Do NOT duplicate these (already owned by other W355 lanes)

- `engine.ts`/`phases.ts`/`dod.ts`/`policy.ts`/`headless.ts`/`store.ts`/`watchdog.ts` →
  `reviewer-pipeline` (they own the wild-loop *control plane*; you own the *agent-runtime modules* it
  calls).
- `codegen`/`scaffold`/`synthesis-policy`/`prompt-engine`/`product-quality`/`verify`/`compile-check`/
  `node-runner` → `reviewer-synthesis`.
- The 34 guards, `gate.sh`, the eval corpus and graders, `run-eval.mjs` → `reviewer-proof`. **You audit
  what a lesson/score *means*; they audit how it is *measured and guarded*.**
- `db`/`auth`/`app-data`/`migrations`/`llm`/provider seam/config/build → `reviewer-platform`.
- `console.tsx`, routes, components, preview, `software-export`, `zip`, `rapidtool-cli.mjs` →
  `reviewer-surfaces`.
- Doc-claim drift → `inspector-integrity`. The 20 red items → `inspector-correctness`.
- The structural map → `cartographer` (`355_6_architecture_map.md`) — cite it, do not rebuild it.

## Deliverable

`research/multiagent/355_9_review_selfimprove_runtime.md` — the ONLY file you write. Structure:

1. **Method** — exact commands (incl. the zero-result queries that prove an absence).
2. **Learning-loop closure table** — `store | writer (file:line) | reader (file:line, or ABSENT with
   the query) | does the value reach a prompt/policy/gate?`.
3. **Self-modification safety assessment** — capability, bound, approval, rollback, hostile-input
   reachability (yes/no + `file:line`).
4. **Scoring validity** — per score: source of truth, and whether a hollow output can earn it.
5. **Kind-coverage matrix** — `kind | path real? | what breaks it | evidence`.
6. **Findings** — `id | severity (P0/P1/P2/P3) | title | file:line | evidence | why it matters`.
7. **What is genuinely sound** — with evidence (required).
8. **What I could not verify.**
9. **Recommended owners** for each P0/P1 (Wave 4 `bus`/`dispatch`/`tools`/`crew-live`, Wave 5
   `lessons`/`memory`/`algo`/`bench`).

## Evidence bar (non-negotiable)

Every finding cites `file:line` **and** the command or read that produced it. Every absence claim needs
the query that shows absence. Where a doc and the bytes disagree, the bytes win — and a header comment
that claims a caller exists while `file:line` shows none is itself a finding.

## Do not

- Do not edit any product file, doc, the register, or another lane's report.
- Do not run `npm test`, `npm run build`, `gate.sh`, or a keyed LLM call. Targeted per-file runs only.
- Do not run any git command that writes. Do not invoke `selfmod` or any self-modification path.
