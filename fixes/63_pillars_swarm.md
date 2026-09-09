# Fix 63 — Pillars 2 + 9: swarm orchestration + parallel-DAG advisory

> Agent B2 (Flash). Builds the advisory swarm layer (specialized sub-agent seat
> specs, sequential critique loop, parallel-DAG metadata, loop-back heuristic)
> on the crew JSON protocol. Verified: typecheck 0, tests green, build 0.

## What shipped

- **NEW `src/lib/swarm.ts`** — pure, client-safe advisory layer over the crew
  protocol (crew.ts wire types; zero network I/O):
  1. `SWARM_ROLES` — five specialized seat specs (`lead-architect`,
     `secops-sentinel`, `ast-specialist`, `frontend-polish`,
     `integration-tester`), each carrying a ROLE_SPECS-compatible core
     (`model` / `system` / `budgetTokens`) plus `prompt` (per-turn lens),
     `emit` (crew JSON-envelope message kinds the seat may emit:
     `plan|design|review|code|test`, validated against
     `CREW_PROTOCOL_EMITS`) and `focus` (phases the seat critiques;
     lead-architect covers all 13). Seat system prompts embed the crew
     standing honesty rule — dispatch-ready for the config-gated LLM crew,
     never dispatched here.
  2. `swarmPlan(project, opts?)` — sequential debate: lead-architect opens,
     then every specialist whose `focus` covers the edge critiques the packet
     and recorded state. Each critique appends one advisory artifact
     (`CrewArtifact`, `## Findings` body with severities + provenance line);
     verdict `keep|revise` is derived only from recorded evidence. Result
     carries `advisory: true`, `engineLinear: true`, and a deterministic
     `refinedPlan`. The project (phases, gates, decisions) is never mutated.
  3. `parallelDag(project)` — pure DAG metadata from the current state:
     per-phase state tags (complete/active/ready/blocked), the remaining
     strict `+1` chain (edges + reasons), and the run-ready pairs (sealed
     phases ∪ frontier) classified into `parallelPairs` (kind-disjoint
     recorded outputs — wave-safe) and `conflicts` (shared recorded kind —
     serialized writes). Honest by construction: **the engine stays linear**;
     this is metadata for a hypothetical wave scheduler, never a schedule.
  4. `branchSuggest(project)` — pure loop-back heuristic when recorded state
     conflicts with a downstream phase's compile: sealed P1–P3 with no
     contracts/spec-graph (→ architecture lane), a recorded rejection at the
     frontier (→ re-run the edge), an open HITL gate with no recorded
     artifacts (→ resolve first). Returns `suggestions[]` +
     `conflictsDetected`; empty when nothing is recorded. Advisory only.
- **NEW `src/lib/swarm.test.ts`** — 22 tests: determinism, no-mutation purity,
  seat activation per focus table, crew-protocol conformance of every seat,
  honest no-evidence critiques (fresh project → all `keep`, provenance
  `deterministic`, "no LLM turn was dispatched" in every body), sentinel
  revise on secret/PHI markers, AST open-schema-lane detection, exact
  parallel-pair/conflict classification recomputed independently, sealed-pair
  coverage, blocked-phase exclusion, branchSuggest healthy/gap/rejection/HITL
  cases.
- **`src/lib/crew.test.ts`** (+4 tests, additive patch) — swarm↔crew protocol
  conformance: seat specs speak the crew JSON protocol, every phase gets ≥2
  debating seats, critique artifacts are well-formed advisory CrewArtifacts,
  and swarm output never fabricates a session or an LLM dispatch.
- **`src/lib/crew.server.ts`** — untouched (no export changes; consumers
  `console.tsx` / `headless.ts` unaffected).

## Honesty contracts (documented in-code)

- Swarm critiques are **deterministic state analysis** — `provenance:
  "deterministic"` on every critique and an explicit body line that no LLM
  turn ran. A missing backend can never masquerade as live analysis; the
  crew's `{ ok: false, reason: "not-configured" }` gate (crew.server.ts)
  stays the only LLM dispatch gate.
- All four surfaces are advisory (`advisory: true`, `engineLinear: true`):
  nothing mutates the project, DoD gates, decisions, or phase records.
- `parallelDag` reports absence as absence ("(none recorded)") and never
  schedules; `branchSuggest` never fires without recorded evidence.

## Gates

- `tsc --noEmit`: 0 errors (this pillar's files; pre-existing in-flight
  sibling edits may briefly touch other files — re-verified at handoff).
- `npm test`: full suite green (incl. 22 swarm + 4 new crew tests).
- `vite build`: 0 errors.
