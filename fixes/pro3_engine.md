# Pro build agent #3 — CORE ENGINE INTEGRATION

## Outcome

All four jobs landed in `src/lib/engine.ts` + `src/lib/packet.ts` (plus 2 new test cases in
`src/lib/packet.test.ts`). **typecheck 0 · full TS suite 249/249** (247-floor preserved, +2 net).

Files touched (strict ownership respected — nothing else):
- `src/lib/engine.ts` — async wiring, CORE-01/02 guards, ST-1, CORE-03.
- `src/lib/packet.ts` — defensive phase lookup.
- `src/lib/packet.test.ts` — +2 cases (ST-1 regression, runPhaseAsync smoke).
- `src/lib/types.ts` — **no change needed**: `"research"` was already in `ArtifactKind`.

---

## (1) Optional LLM/research/exec wiring — `runPhaseAsync` / `runP6Real`

Imported the concurrently-authored contracts exactly as specified:
```ts
import { complete, llmStatus } from "./llm.ts";
import { research } from "./research.ts";
import { runCode } from "./exec.ts";
import type { ExecResult } from "./exec.ts";
```

- **`runPhaseAsync(project, phase)`** — for P0/P7/P11 calls `research()`; on `ok:true` it attaches
  each returned item as a `kind:"research"` artifact (title/url/content + source URL), flips
  competitor rows to `source:"cited"`, and (when `(await llmStatus()).configured`) calls
  `complete()` for a one-paragraph phase narrative attached as a `research` artifact. Then it
  layers that on top of the synchronous `applyPhaseResult`. On **any** `{ok:false,reason:"not-configured"}`
  (or failure/timeout/invalid) it resolves to the *exact* deterministic result — no behavior
  change for existing callers/tests. For non-research phases it is a straight delegate.
- **`runP6Real(project)`** — `Promise<{ok:boolean; result:ExecResult|null}>`. Runs
  `project.generatedSource` through `runCode`; returns `{ok:false,result:null}` when the runner is
  `not-configured` (or the module is absent / run cannot start) so callers fall back to the sync
  self-test. **The existing sync P6 self-test path is untouched.**

Both are wrapped in try/catch so an unexpected error can never strand a run — deterministic
`applyPhaseResult` is the floor.

## (2) CORE-03 — `currentPhase` validated on hydrate

`hydrateProject` now mirrors `repairPhases` for the scalar: if `currentPhase` is not an integer
in 0..12 it is repaired to **highest complete phase + 1 (floor 0, capped 12)** and a
`hydrate.repaired` log row is emitted (merged with the phase-repair row). The re-attach
short-circuit now also requires `!cpRepaired`, so a repaired currentPhase forces a packet
recompile instead of returning a stale one (CORE-04-adjacent: hydrate never trusts a stale packet
after any repair). `packet.ts` also prefers a guarded `PHASES[cp] ?? PHASES[0]` lookup as
defense-in-depth.

## (3) ST-1 — packet `gate_passed` after approve

`approveHitl` now records the machine-checkable DoD gate for the phase **just approved** via a new
internal `recordGateInline()` *before* it compiles the packet, so `## System JSON` → `phases[n].gate_passed`
is a boolean the instant approval lands (was `null`). It sets only `PhaseRecord.gate`; the store's
`recordGate` still owns the gate artifact + log and re-runs idempotently (no duplicate artifact/log).
This also closes a latent gap: autopilot-approved extra-HITL phases (6/11) previously got no gate at all.

## (4) CORE-01/02 — defensive invariant guards (non-breaking)

- `approveHitl`: returns project untouched (clean ledger) when there is no pending gate or
  `hitl.phase !== currentPhase`; **throws** on `forceHuman` + `decidedBy:"autopilot"` without an
  explicit `force`. Existing store/console/fixtures all pre-guard, so no valid caller is affected.
- `rejectHitl`: throws when the trimmed note is < 12 chars (documented ADR-002 invariant); returns
  untouched when there is no pending gate / phase mismatch — the append-only ledger can no longer
  record a fabricated rejection.
- `applyPhaseResult`: throws on a truly invalid phase id (non-integer / out of 0..12) before any
  `PHASES[]`/`phaseDef` indexing. (The audit's stronger `phase !== currentPhase` edge check was
  deliberately *not* added — the shared fixtures call `applyPhaseResult` with an out-of-order
  cursor and it must stay legal.)

---

## ⚠️ Cross-agent flag (NOT a pro3 defect — needs the wrapper owners)

`npm run build` currently fails in TanStack Start's **import-protection** step:

```
research.ts:28 → return tavilySearch(query, opts)   // imports ./tavily.server.ts
```

`llm.ts` → `deepseek.server.ts` and `exec.ts` → `node-runner.server.ts` have the same shape.
The client-facing wrappers import `.server.ts` modules **directly** rather than behind a
`createServerFn`/`createServerOnlyFn` (which `research/deepseek-api.md §10` and
`research/runtime-integration.md §1.4` both mandate). Because `engine.ts` (client code) imports
them — as this task explicitly requires — the client bundle now carries a `.server.ts` edge and
the import-protection plugin rejects it.

This is the wrapper modules' responsibility (they are on the never-touch list here). Until they
bridge the boundary with `createServerFn`, the client build cannot pass. The **test suite and
typecheck are unaffected** and are the enumerated gates for this task.

## Verification

- `npm run typecheck` → exit 0 (0 errors in engine/packet/phases/types).
- `node --experimental-strip-types --test <12 lib files>` → **249 pass / 0 fail** (was 247; +2 from
  packet.test.ts).
- New packet tests: ST-1 `gate_passed` is boolean after `approveHitl`; `runPhaseAsync` returns a
  valid deterministic P0 result without throwing.
