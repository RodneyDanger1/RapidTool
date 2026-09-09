# 54 — Wave 3 (W5 · tracing/observability): pure agent-run trace module + vault trace notes + FusionRank cited-boost verification

**Status:** `src/lib/tracing.ts` + `src/lib/tracing.test.ts` are LIVE; `vault.ts`
gains `traceNote`; E-18 cited-boost verified already-shipped in `algorithms.ts`.
`npm test` glob picks the new suite up automatically — no package.json change.
tracing.test.ts: **23 tests, 0 fail** · vault.test.ts: **31 tests, 0 fail**
(+5 traceNote) · verified gates: `npm run typecheck` 0 errors, full `npm test`
green for `src/lib`, `npm run build` exit 0, eslint on changed files 0 problems.

## Register coverage (this slice)

- **G-40 (agent observability — re-scoped, feasibility tier-4 correction):** the
  register's NDJSON-file trace (`<project>.trace`) is NOT implementable in the
  hosted product (C-1: no server-side fs). This wave ships the re-scope agreed
  in `15_feasibility_review.md` correction #9/#1: a **pure, zero-dep, in-memory
  span model** (`tracing.ts`) whose shape is the "freeze v1 schema" call, plus
  the vault integration. File persistence, store ring, eval runner, MCP and
  git export stay out of scope (host-scoped later waves). Hook points
  (`crew.server.ts`, `headless.ts`, `verify.server.ts`) are NOT this agent's
  files — the module is the contract they will call.
- **G-39-re-scoped (agent memory consolidation):** the remaining delta this
  slice owns is the vault note kind integration — `traceNote(trace, project)`
  files an agent run into the vault as a memory-kind note (tags `["trace"]`)
  with the span timeline, so run outcomes sit next to memory rows.
  M-08 write-back itself is already closed (`report-intake.ts:246-365`) and the
  rejected-report/critique threading is another agent's slice (report-intake).
- **G-23 (parallel fan-out):** no crew wiring here (`crew.server.ts` not owned).
  The span model supports it when it lands: lanes are sibling spans under a
  `crew` root, kinds like `"crew.lane"` — parent-before-child recording is
  exactly the parallel-dispatch shape.
- **E-18 (FusionRank cited-boost):** VERIFIED ALREADY SHIPPED — `fusionRank`
  adds `+0.15` when `MemoryEntry.source === "research"` and lexical overlap
  `ox > 0` (`algorithms.ts:254-261`, deliberate deviation from the register's
  `overlap ≥ 1` documented in-code) with 4 dedicated tests
  (`algorithms.test.ts:250-314`). `MemoryEntry.source/url/tags` provenance
  fields live in `types.ts:97-111`. NO code change was needed; register DoD
  already satisfied. `algorithms.ts`/`algorithms.test.ts` left byte-identical.

## Exact export surface (src/lib/tracing.ts) — compile against these

```ts
export type AgentTrace    = { runId: string; startedAt: number; spans: TraceSpan[] }
export type TraceSpan     = { id: string; parentId: string | null; kind: string;
                              label: string; startTs: number; endTs?: number;
                              status: TraceSpanStatus; detail?: TraceDetail }
export type TraceSpanStatus = "started" | "ok" | "error" | "skipped"
export type TraceDetail   = Record<string, string | number | boolean | null>
export type TraceSummary  = { runId; startedAt; spanCount; openCount; okCount;
                              errorCount; skippedCount; startedCount; rootCount;
                              depth; totalMs: number | null; kinds: Record<string, number> }
export function createTrace(runId: string, startedAt?: number): AgentTrace
export function traceSpan(id, parentId, kind, label, startTs, endTs?, status?, detail?): TraceSpan
export function recordSpan(trace: AgentTrace, span: TraceSpan): AgentTrace   // pure
export function spansAsText(trace: AgentTrace): string                        // markdown timeline
export function traceSummary(trace: AgentTrace): TraceSummary
export function formatDurationMs(ms: number): string                          // "842ms"|"1.23s"|"2m 5s"
```

vault.ts additive export: `traceNote(trace: AgentTrace, project: Project): VaultNote`.

## Semantics the wiring wave can rely on (READ — shapes are precise)

- **Pure + deterministic, zero imports.** No fs, no `Date.now()`, no deps:
  recorders stamp wall-clock at the CALL SITE (`createTrace(runId, Date.now())`
  is the impure edge; the module itself never invents time). Same inputs in ⇒
  byte-identical outputs out (`traceSummary`/`spansAsText` deep-equal).
- **`recordSpan` invariants (recorder bugs throw loudly, never silently):**
  (1) parents precede children — a span whose `parentId` is not yet recorded
  throws; (2) a CLOSED span (`endTs` set) is immutable — re-recording throws;
  an OPEN span may be re-recorded to refresh fields and **closed exactly once**
  by the first record carrying an `endTs` (final status must be
  ok|error|skipped — a closed `"started"` throws, as does `endTs < startTs`);
  (3) timestamps are finite, non-negative epoch ms. `recordSpan` returns a NEW
  `AgentTrace`; input is never mutated. Fresh appends may carry any status —
  `error`/`skipped` without `endTs` is meaningful (crashed / never ran).
- **`traceSpan` defaults:** open (no `endTs`) ⇒ status `"started"`; closed ⇒
  `"ok"`. Undefined optional keys are OMITTED from the object (merge hygiene).
- **`spansAsText`:** markdown bullets, 2-space indent per depth, rows sorted by
  `startTs` (ties keep recorded order — stable sort), orphan spans (parent
  missing, hand-edited payloads) render as roots, no throw. Open spans get
  `— in flight`; closed get `— <duration>`; non-empty flat `detail` rides at
  the end as a code span with SORTED keys, whitespace collapsed, backticks
  neutralized (never prompt bodies — traces stay redacted by construction).
  Empty trace ⇒ `"_no spans recorded_"`.
- **`traceSummary.totalMs`:** wall-clock window over CLOSED spans only (max
  endTs − min startTs); `null` while nothing is closed; `0` for same-instant
  closed spans. An open root never stretches the window. `kinds` keys are
  alphabetically sorted. `depth`: 0 for all-root/empty traces.
- **`traceNote`:** standalone note (kind `"memory"`, tags `["trace"]`,
  `links: []`, `phase` undefined, title `Trace — <runId>` capped/cleaned by the
  vault title rules) — body = `# title`, project/run/counts/total header,
  `## Timeline`, then `spansAsText`. `updatedAt` = newest instant covered
  (closed `endTs`, else `startTs`, else trace `startedAt`). Merging into a
  built vault: consumer owns title de-duplication (dailyNote pattern);
  `vaultIndex` lists it under Memory; tag search finds it.
- **G-40 honesty:** detail payloads are scalar-only; the model does not carry
  prompt/response bodies, so no redaction config is needed at this layer.

## Test plan (landed)

`node --experimental-strip-types --test src/lib/tracing.test.ts src/lib/vault.test.ts`

- tracing.test.ts (23): factory field/default/validation mapping; createTrace
  defaults + rejects; append purity (input untouched); top-down parent rule;
  closed-span immutability; open refresh + close-once; merged-path endTs guard
  (hand-built payload); timeline text (order, nesting, durations, detail JSON,
  orphan root, empty trace, duration formatting edges, multi-line labels);
  summary counts/window/null/empty; determinism.
- vault.test.ts traceNote describe (5): note shape + timeline red-flag of a
  failed run; purity + distinct run titles; updatedAt derivation (closed
  endTs, empty-trace fallback); all-open/skipped rendering; merge into a built
  vault (frontmatter round-trip, MOC, no dangling links, tag search).
- algorithms.test.ts: untouched — E-18 boost coverage pre-exists (4 tests,
  lines 250-314).

## Agent playbook (5 steps) — for the wiring wave (crew.server.ts owner)

```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. import the contract
import { createTrace, recordSpan, traceSpan, spansAsText } from "./tracing.ts"
# 2. open a run trace at dispatch; stamp wall-clock at THIS call site only
let trace = createTrace(`run-${hash}`, Date.now())
trace = recordSpan(trace, traceSpan("crew", null, "crew", "Phase 6 sprint", Date.now()))
# 3. record one span per crew/llm/verify boundary (parent = its turn root);
#    on failure close with status "error" — never "started"
trace = recordSpan(trace, traceSpan(turnId, "crew", "llm", label, t0, t1, "ok", { model, tokensIn, tokensOut }))
# 4. persist the run where the host can keep it (store ring / vault / file per C-1)
const note = traceNote(trace, project)   // vault.ts — kind "memory", tags ["trace"]
# 5. surface it: spansAsText(trace) is the UI/vault timeline; traceSummary(trace) the header counts
```

## Caveats

- `vault.ts` header export-surface comment updated (traceNote added) — do not
  revert; consumers compile against it.
- The full-suite `scripts/*.test.mjs` EPERM symlink failures on Windows are
  pre-existing and unrelated (documented in fixes/42).
