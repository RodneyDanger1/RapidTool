# 51 — Wave-3 orchestration core: plan-then-act planning + plan-act crew mode

Wave 51 lands the plan-then-act/reflect/backtrack core of the multi-agent
orchestration register (items G-21/G-22/G-24/G-25/G-26 — *core slice* per the
delegation brief, not the full register entries) as a new pure planning module
plus an optional plan-act orchestration mode in the crew. Everything is
additive — no existing export was renamed or removed, no file outside the
ownership list was touched.

- Register: `research/multiagent/13_top20_gaps.md` G-21 (:96), G-22 (:109),
  G-24 (:135), G-25 (:148), G-26 (:161).
- Corrections honored: `research/multiagent/15_feasibility_review.md`
  G-24/G-25/G-26 verdicts + correction 10 (thinking is OFF on flash — the
  planner/reflect calls are explicit `deepseek-v4-flash` JSON emits) and
  G-21 corrections (per-role budgets exist; this wave adds NO new budget
  accounting — the existing cost-limit/max-steps stops bound plan-act).
- Build cards read: `research/multiagent/17_agent_ux_review.md` G-21 (:32),
  G-22 (:72), G-24 (:147), G-25 (:187), G-26 (:225).

## Scope of this wave (and what is deliberately NOT here)

This wave implements the **orchestration core**: a machine-readable plan object
(G-24), a Reflexion-style critique pass (G-25 core), a pure rewind primitive
(G-26 core), and a crew mode that binds them into one bounded run. Explicitly
**not** in this wave (later waves / other agents): the deterministic `topo()`
ledger floor, packet `plan_ledger`/`critique_count` keys, CLI verbs
(`think`/`plan`/`snapshot`/`rollback`), console plan tabs, engine
snapshot/resume, and `verify.server.ts` critique threading.

## 1. src/lib/planning.ts (NEW) — plan-then-act scaffold

Server-only at runtime (imports `./deepseek.server.ts`); client modules may
import its **types** only, via `import type`. `crew.ts` deliberately mirrors
the two result shapes structurally (`CrewPlanStep`, `CrewCritique`) so the
client-facing module never gains a runtime edge to a server module.

### Exports

| Export | Type | Purpose |
| --- | --- | --- |
| `PlanStep` | `{ id; action; why }` | One planned step (register G-24 row shape). |
| `Plan` | `{ goal; steps: PlanStep[] }` | The machine plan execution is measured against. |
| `PlanVerdict` | `"keep" \| "revise"` | Reflexion verdict (G-25 core). |
| `PlanCritique` | `{ verdict; summary; issues; revised? }` | Normalized critique. |
| `PlanStepsResult` | `ok:true \| ok:false` union | Honest plan result. |
| `ReflectResult` | `ok:true \| ok:false` union | Honest critique result. |
| `PlanBacktrack` | `{ plan; failedStep; rewound }` | Pure rewind result (G-26 core). |
| `MAX_PLAN_STEPS` | `8` | Plan-row cap (G-24 ledger budget default). |
| `createPlanning(completer?)` | factory | DI — inject a stub completer (tests); defaults to `completeDeepSeek`. |
| `planSteps(goal, context, opts?)` | async | Default binding: flash `json:true` plan emit. |
| `reflect(goal, steps, outcome)` | async | Default binding: flash `json:true` critique emit. |
| `backtrack(plan, failedStepId)` | sync, pure | Rewind before the failed step. |

### Semantics

- **planSteps** — one flash JSON call (`response_format: json_object`,
  thinking disabled by the API layer for flash, maxTokens 2048) with the
  honesty rules of the crew `STANDING_RULE`. Reply must be `{"steps":
  [{id, action, why}]}`. Normalization is deterministic: only non-empty
  `action` strings survive; ids are trimmed and deduped with canonical
  `step-N` fallbacks; rows capped at `maxSteps` (1..8, default 8).
- **reflect** — same transport; reply must be `{"verdict": "keep"|"revise",
  "summary", "issues", "revisedSteps"}`. `revisedSteps` are normalized the
  same way and only carried when verdict is `revise`.
- **Parse discipline** — unparseable model JSON gets exactly ONE bounded
  re-prompt (with the parse error stated), then an honest
  `{ok:false, reason:"error", error:"…unparseable after retry"}`. Never a
  silent fallback, never fabricated rows. `not-configured` short-circuits
  before any retry.
- **backtrack** — pure and deterministic: removes `failedStepId` and every
  step after it (`rewound`, failed first; `plan` = last known-good prefix).
  Unknown id → no-op. Never mutates its input.

## 2. src/lib/crew.ts (patch) — client contract additions

- `CrewRunOptions` gains `mode?: "default" | "plan-act"` (default `"default"`
  = today's fixed phase→role table — byte-identical behavior when absent).
- `CrewRunResult` ok-branch gains additive optional fields `mode`,
  `plan?: CrewPlanStep[] | null`, `critique?: CrewCritique | null`
  (plan-act runs only; default-mode runs omit them).
- New exported structural types `CrewPlanStep` / `CrewCritique` mirror
  `planning.ts` shapes (see §1 rationale).

## 3. src/lib/crew.server.ts (patch) — plan-act mode

`runCrewServer(project, opts)` accepts `opts.mode === "plan-act"`. The run
(inside `createCrewRuntime`, sharing every existing helper — measured context
builder, role table, JSON envelope machinery, grounding contract):

1. **Plan** — `planSteps(goal, context)` via `createPlanning(deps.complete)`
   (so stub-completer DI works). `goal` = phase title/summary + project
   name/brief; `context` = brief + roadmap + current edge + agent packet,
   built with the same marked cuts and `enforceTokenBudget` as per-turn
   prompts. The normalized plan is minted as artifact
   `Plan steps (plan-act)` (language json). Plan failure (incl.
   `not-configured`) stops the run with the honest `{ok:false}` — **never a
   silent fallback to the default transcript** (G-21 card rule).
2. **Act** — one crew role turn per planned step; the executing role rotates
   deterministically over the phase's `CREW_ROLE_BY_PHASE` table
   (`roles[i % roles.length]`), keeping the deterministic router (never an
   LLM speaker selector). Each turn's prompt appends a step directive
   ("Execute exactly this step…" with id/action/why + the remaining steps) so
   turns cannot silently re-plan. Researcher turns keep the same UNTRUSTED
   live-grounding contract. Per-turn dispatch is byte-identical in shape to
   default mode (same `ROLE_SPECS` budgets, `maxTokens`, cost accounting,
   `final` early-exit).
3. **Bounded** — planned steps ≤ `maxPlanSteps` (1..8, default 8); executed
   steps additionally ≤ `maxSteps` turn cap (default 12, clamp 1..24). When
   the turn cap truncates the plan the run stops with `stopped: "max-steps"`
   and the honest partial transcript; the full machine plan is still returned
   in `plan` + artifact. `maxTotalTokens` cost-limit stop unchanged.
4. **Reflect once at end** — one `reflect(goal, executedSteps, outcome)` call
   where `outcome` is a deterministic tail of the actual session transcript
   (last ≤5 messages, marked cuts — the machine never summarizes beyond the
   session). On success the critique is returned in `critique` AND appended
   to the transcript as a genuine model emission (`reviewer`/`review` message
   + `Reflection critique (plan-act)` json artifact). On failure the run
   stays `ok:true` with `critique: null` — reflection is non-fatal, nothing
   is padded (a failed critique never rewrites the transcript). Skipped when
   the cumulative cost guard was already hit. `backtrack()` is exported from
   `planning.ts` for callers/UI to rewind failed runs; the run loop itself
   does not auto-retry (bounded, single reflect — no loops this wave).

Session accounting: `session.steps` counts transcript entries (role turns +
the reflection entry); token counters count role turns as in default mode.
Advisory contract unchanged: plan-act never approves, rejects, advances, or
deploys; the engine gates stay the only approver.

## 4. Tests (all deterministic, no network)

- **NEW `src/lib/planning.test.ts`** (15 tests): canonical normalization
  (junk/duplicate-id rows), step caps, one-re-prompt-then-honest-error,
  second-chance recovery, `not-configured` short-circuit without re-prompt,
  input validation, keep/revise critique parsing + revisedSteps
  normalization, invalid-verdict retry discipline, backtrack purity/
  no-op/truncation, and the default binding's honest `not-configured`
  (env-key pattern from `research.test.ts`; per-file process isolation).
- **`src/lib/crew.test.ts`** (patched, +9 plan-act tests over the existing
  routing/parse suites): happy path (plan → 2 step turns on the P6
  coder/tester rotation → 1 reflection; 4 LLM calls total; artifact + plan +
  critique assertions), step-directive threading into turn prompts, plan-act
  `not-configured` at the FIRST planning call (1 call, no fabricated
  transcript), unparseable plan → honest error (no silent fallback),
  non-fatal reflection failure (critique null, nothing padded), `maxSteps`
  truncation → honest `max-steps`, and two default-mode regressions
  (byte-identical role-table transcript, no mode fields; not-configured at
  first dispatch).

Command: `node --experimental-strip-types --test src/lib/planning.test.ts src/lib/crew.test.ts`.

## 5. Files

| File | Change |
| --- | --- |
| `src/lib/planning.ts` | NEW — planSteps/reflect/backtrack + `createPlanning` factory + types. |
| `src/lib/planning.test.ts` | NEW — 15 tests. |
| `src/lib/crew.ts` | patch — `mode` option, `plan`/`critique`/`mode` result fields, `CrewPlanStep`/`CrewCritique` types. |
| `src/lib/crew.server.ts` | patch — plan-act orchestration (`runPlanAct` in `createCrewRuntime` + helpers). |
| `src/lib/crew.test.ts` | patch — plan-act + regression tests. |

## 6. Gate results

- `npx tsc --noEmit`: 0 errors attributable to this wave's files. (At the
  time of writing, two errors exist in `src/lib/vector.ts` /
  `src/lib/vector.test.ts` — files created concurrently by another wave-3
  agent mid-flight, outside this wave's ownership list.)
- Full test suite + build: see the wave report (re-run after all wave-3
  agents land).

## 7. Follow-on notes for the next waves

- The deterministic floor for G-24 (`topo()`/`planSpecGraph` pre-seeded rows)
  belongs in the ledger UI/packet wave — `planning.ts` stays LLM-keyed with
  honest not-configured.
- Packet `plan_ledger` / `critique_count` keys and the `think` CLI verb can
  now read the plan/critique straight off `CrewRunResult` / the
  `Plan steps (plan-act)` artifact.
- `backtrack` is ready for G-26 fork/retry UI wiring (snapshot files and
  engine resume remain separate, headless/CLI-scoped per C-1).
- In plan-act mode the executed-role rotation is deterministic per the phase
  table; a later hierarchical wave (G-21 full) may let plan steps carry an
  explicit owner role.
