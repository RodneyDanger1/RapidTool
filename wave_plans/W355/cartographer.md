# W355 · lane `cartographer` — architecture analysis (1 of 1)

**Wave:** W355 (the audit/freeze wave). **Kind:** read-only architecture + bug mapping.
**Author:** the wave parent.
**You are one of 6 Wave 0 lanes** (3 reviewers · 2 bug inspectors · 1 cartographer), and you are the
**standing architecture lane** that will recur in every later wave.

## Mission

Produce the authoritative **architecture map** of RapidTool, the **wiring matrix** (what actually calls
what), and the **capability-gap map** for the things the campaign must build: agent orchestration, a
per-project message bus, per-seat context and tool use, and the learning/memory loop.

You are the wave's cartographer: you draw the territory and mark the unexplored parts. Other lanes
review code quality; **you own the shape of the system.**

## What this campaign needs from you (the user's own asks, restated precisely)

The campaign must eventually make these true. Your job is to map **how far each one is from true**,
with `file:line` evidence — not to build them.

1. **Orchestration & delegation.** Which module decides "who works on what next"? Is the delegation
   chain (`engine.wildStep` → phase → `crew`/`swarm` seats → `subagent` claims → dispatch) wired end
   to end, or does it stop at bookkeeping? Where exactly does it stop?
2. **A bus for every project.** Agents are supposed to communicate on a shared channel per project.
   Does any project-scoped message channel exist? (`rt-events.ts`/`rt-ring.ts` are a telemetry
   currency; `crew.ts` is a turn-based protocol; `subagent.ts` is claim bookkeeping.) Specify the
   **absence** precisely: what a message would have to be, and which consumer would act on it.
3. **Insight / context use.** For each live LLM call site, what context does it actually receive
   (which artifacts, decisions, memory, constraints, in what order, under what token budget)? Build
   the **context-assembly table**. Is any seat starved of context it needs, or flooded?
4. **Tool use / tool knowledge.** Inventory every tool a pipeline seat can call today (the bounded
   node-runner, the search seam, the vault/knowledge readers, git, MCP). Does any seat choose tools
   autonomously? (DeepSeek function-calling is live-verified in `research/deepseek-api.md` §4e but the
   provider sends no `tools` — confirm or refute.)
5. **Learning loop & memory.** Trace the loop: evaluation (`run-eval.mjs`, graders) → lesson capture
   (`knowledge.ts`, lesson verbs) → application to the next run (`codegen`/`prompt-engine`) → measured
   improvement. Where is the loop **open**? Is memory persisted per project, per corpus, or not at all?
   Is any recorded lesson ever *consumed*, or only written?

## Scope (read anything; edit only your report)

You may read all of `src/lib/**`, `scripts/**`, `migrations/**`, `.github/**` and the root docs.
Your deliverable is the only file you write.

## Deliverable

`research/multiagent/355_6_architecture_map.md`. Structure:

1. **Layer map** — the layers (pure engine · server seams · persistence/state · surfaces · scripts)
   with the module list per layer and the dependency direction. Mark any upward/invalid dependency.
2. **Wiring matrix** — a table of the load-bearing seams: `producer | consumer | mechanism | live? |
   evidence (file:line)`. Include the engine→store, engine→headless, codegen→scaffold, gate→packet,
   wild loop→classifier bridge, telemetry→sinks, and every LLM call site.
3. **Context-assembly table** — one row per LLM call site: `site | context inputs | budget | honest
   fallback`. This is the seed of Wave 4's `context` lane.
4. **Agent/orchestration inventory** — `crew.ts`/`crew.server.ts`, `swarm.ts`, `subagent.ts`,
   `handoff.ts`, `wild-review.ts`/`wild-bridge*`, `engine` wild paths, `store` driver. For each: what
   it is, who calls it, whether its output affects the run or is advisory-only.
5. **Tool-use inventory** — every tool reachable by a seat, and whether the seat *selects* it.
6. **Learning/memory inventory** — writers and, decisively, **readers** of each memory store.
7. **Capability-gap map** — for each of the five asks above: `state (absent/partial/real) | evidence |
   the smallest honest step that would advance it | which later wave it belongs to`.
8. **New-bug map** — architecture-level defects (a seam that is declared but never called, a reader
   with no writer, a writer with no reader, a claim of autonomy with no driver, an unbounded loop, a
   dependency inversion). Each with `file:line` + a command.
9. **What I could not determine.**

## Evidence bar (non-negotiable)

Every structural claim cites `file:line`. For "X is never called", name the search you ran and its
zero result — an absence claim needs the query that shows absence. Where a doc's architecture diagram
disagrees with the bytes, the bytes win.

## Do not

- Do not edit any product file, the register, another lane's report, or any doc. You **map**; you do
  not build. Wave 4's lanes build the bus/tools/context.
- Do not run `npm test`, `npm run build`, or `gate.sh`; reads and targeted greps only.
- Do not assume a module is live because it exports a function — trace a caller, or report it as
  unreferenced.
