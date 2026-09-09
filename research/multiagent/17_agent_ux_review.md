# 17 — Agent-UX & Integration-Depth Review: build-ready agent-facing cards for G-21…G-40

- **File:** `research/multiagent/17_agent_ux_review.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`)
- **Date / agent:** 2026-09-06 · Flash evaluator #3 (AGENT-USABILITY + INTEGRATION DEPTH; strictly read-only on source — the only file written this pass is this one)
- **Inputs:** live register `research/multiagent/13_top20_gaps.md` (rebuilt 2026-09-06 03:43, G-21…G-40 full format at `13_top20_gaps.md:94-355`) + live researcher transcript `…\hermes\cache\delegation\live\deleg_f4d9790b\task-0.log` + direct source verification of every anchor below.
- **0-hallucination rule:** every `file:line` in this document was re-verified by this evaluator against the working tree on 2026-09-06. Where the register's citation is stale or imprecise, the card says so and gives the corrected anchor (`↯ CORRECTION`).
- **Scope:** one build card per gap G-21…G-40. Each card = (1) exact agent-visible public surface, (2) idempotency + error surface, (3) file-by-file change list with insertion anchors, (4) test plan, (5) 5-step agent playbook. Register line for each card: `13_top20_gaps.md:<line>`.

## 0. Machine-contract glossary (the conventions every card builds on — all verified)

| Convention | Verified anchor |
|---|---|
| CLI stdout purity: exactly ONE JSON object per invocation, no chatter; envelope always `schema_version:1`, `cmd`, `exit_code` | `scripts/rapidtool-cli.mjs:33-34, 84-89` (`respond()`) |
| Exit taxonomy: `0` payload delivered (incl. honest `ok:false` when the JSON *is* the outcome) · `1` usage/validation/state/missing module · `2` parked at HITL/blocked (`run`/`gate`) · `3` backend not configured · `4` internal/backend runtime error (stack to STDERR only) | `rapidtool-cli.mjs:169-182, 339-341, 372-379, 451-456`; full contract `scripts/README-cli.md:277-292` |
| Shared project loader: missing/bad project file = usage error exit 1, never exit 4 | `rapidtool-cli.mjs:133-143` |
| Dynamic-import loader pattern for sibling/server modules: availability probe + memoized import + frozen-export-surface runtime check → readable contract-drift error; CLI/UI compile against the frozen surface only | `src/lib/headless.ts:680-710` (vault), `1030-1069` (design), `1077-1087` (diagram), passthrough wrappers `1093-1138` |
| Atomic project write: `saveProject` writes temp then renames (write-then-rename), serialization via `exportProjectJson` | `headless.ts:58-63`; `src/lib/io.ts:25` |
| Honesty lattice: no key → `{ok:false, reason:"not-configured"}` before any network I/O; never fabricated text/verdicts/sessions | `src/lib/deepseek.server.ts:55-61, 135-140`; `crew.server.ts:18-21`; `verify.server.ts:15-17` |
| `passed` verdicts only from real machine runs; `applyVerifyOutcome` stamps `lastTest {label:"tested", evidenceHash}` on pass only, `not-configured` changes nothing | `headless.ts:943-997`; `verify.server.ts:152-219` |
| External agent intake: validation-first, append-only, `[agent report]` prefix + fingerprint ids → re-apply same report is a no-op (`applied:false, reason:"duplicate"`) | `src/lib/report-intake.ts:1-27` (header), `65` (`validateReport`), `246` (`applyReportResult`), `235` (fp collision), `329-344` (semantic/episodic rows) |
| DoD honesty lattice: pure `runGate` probes + `recordGateInto` side-effect-free gate recording | `src/lib/dod.ts:260, 293, 321, 358`; DOD[6] keys `dod.ts:126-153` |
| Packet System JSON envelope (`schema_version`, `capabilities`, `report_schema`, `research_hash`, `sandbox`, `verdict`, `phases[]` w/ `gate_passed`) — new agent-visible fields land here; `PACKET_VERSION = 3` | `src/lib/packet.ts:12, 35-105, 116` |
| Server boundary: key read only in `*.server.ts` via `process.env`; client contract `src/lib/llm.ts` (`LlmModel` = flash/pro only, `llm.ts:14`) | `llm.ts:1-40`; `deepseek.server.ts:1-16` |
| DeepSeek request body: pro tier sends `thinking:{type:"enabled"}, reasoning_effort:"high"`, flash disables thinking; `json:true` → `response_format json_object` | `deepseek.server.ts:163-169` |
| Console tab pattern: `RunTab` union at `src/components/console.tsx:91`; trigger block `console.tsx:1422-1480`; every panel `Tabs.Content value=… forceMount`; pane components `VaultPane` `console.tsx:2392`, `DesignPane` `2994`, `DiagramPane` `3293`, `ArtifactPane` `2011`, `HitlDock` `1854` | — |
| Test invocation: `node --test "scripts/**/*.test.mjs" && node --experimental-strip-types --test "src/lib/*.test.ts" …` (`package.json scripts.test`) | `package.json:14` |

Register status note: `13_top20_gaps.md` was found zeroed (81,230 NUL bytes, mtime 03:12) at delegation start; the researcher rebuilt it in full (write at 03:43, 63,472 bytes, verified on disk). All G-21…G-40 headings below mirror the rebuilt file exactly. Ranks/areas are copied from the register; card content is this evaluator's own deepening.

---

## G-21 — Hierarchical crew orchestration (manager → workers, budgets, handoffs) — register `13_top20_gaps.md:96` · area 1 · rank #2

**Public surface (agent sees).** Extends the existing `crew` verb — no new subcommand name, backward-compatible flags:
`rapidtool-cli crew --project <file.json> [--process sequential|hierarchical] [--max-steps N]`.
Stdout JSON (schema_version/cmd/exit_code always present):
```json
{ "ok": true, "process": "hierarchical",
  "tasks": [ { "id": "t1", "goal": "…", "owner": "architect", "tokenBudget": 2400,
               "status": "done", "reportArtifactId": "report-…" } ],
  "messages": [ { "role": "manager", "type": "plan", "content": "…", "artifacts": [] } ],
  "artifacts": [ { "phase": 4, "title": "…", "body": "…" } ], "stopped": "done" }
```
`--process` defaults to `sequential`; anything else is a hard usage error exit 1 (mirror `diagram --kind` validation at `rapidtool-cli.mjs:411-412`). Manager task rows are minted as a JSON artifact (`title: "task list"`) so `packet`/`vault` carry them. `tasks[].reportArtifactId` is filled when the worker turn's artifact lands via the existing envelope (`crew.server.ts:78-89` `JSON_SCHEMA`).

**Idempotency + error surface.** Crew runs are advisory and stateless (they never mutate the project file — same as today), so a retry is safe by construction; a retry re-runs the full session (no partial-write risk). Failures: no `DEEPSEEK_API_KEY` → `{ok:false, reason:"not-configured"}` exit 3 (existing `rapidtool-cli.mjs:339-341`); manager emits non-JSON/unparseable task list → one re-prompt with the parse error in context, then honest `{ok:false, reason:"error", error:"manager task list unparseable after retry"}` exit 4 — never a silent fallthrough to sequential. Per-worker budget: manager's own turn counts against a manager budget (`ROLE_SPECS` token caps, `crew.server.ts:103-121`); `tokenBudget` per task is advisory metadata the cost-limit stop enforces (`CrewStopReason "cost-limit"`, `crew.ts:93`). Manager can never approve/advance (honesty contract unchanged, `crew.server.ts:15-21`).

**Change list (file:line anchors).**
1. `src/lib/crew.ts:24-113` — add `CrewProcess = "sequential" | "hierarchical"` (after `CrewRole`, :24) and `CrewTask = { id: string; goal: string; owner: CrewRole; tokenBudget: number; status: "pending"|"running"|"done"|"failed"; reportArtifactId?: string }`; extend `CrewRunOptions` (:113) with `process?: CrewProcess`; extend the `ok:true` branch of `CrewRunResult` (:103) with `process` + `tasks`.
2. `src/lib/crew.server.ts` — upgrade `MANDATE.planner` (:63-65) to emit a JSON task list (same `JSON_SCHEMA` machinery, :78-89); add `dispatchManagerTurn(project, session, budget)` + `delegateTurn(task, ctx)` after `nextRole` (:311); route in `createCrewRuntime`'s turn loop (:548-689); plumb `opts.process` through `runCrewServer` (:690-700) and `createCrew` DI factory (:702-713). Add `CrewSession.tasks?: CrewTask[]` beside the session type (`crew.server.ts:535-546`).
3. `src/lib/headless.ts:902-908` — `runCrew(project, opts)` opts type widens `{maxSteps?, process?}`; the loader body needs no change (dynamic import at :906 stays).
4. `scripts/rapidtool-cli.mjs:323-344` — parse `--process` (validate against the two values, usage error exit 1 otherwise) and pass into `h.runCrew`.
5. `src/components/console.tsx` — hierarchical runs render as org-tree: extend `CrewMsgView` (:94-111) with optional `taskId`; Crew tab trigger already exists (:91/:1446-1451); per-task budget meter reads `tasks[].tokenBudget`.

**Test plan.** Suite: `src/lib/crew.test.ts` (exists — drives `createCrew` with a stub completer, `crew.server.ts:702-713` pattern) + `scripts/README-cli.md` contract prose. Key cases: (1) stub manager emits a valid 2-task list → run produces 2 worker turns + `tasks[].status:"done"` and one report artifact per task; (2) manager emits garbage → exactly one re-prompt, then `{ok:false, reason:"error"}`; (3) zero-key completer → `not-configured` from the first dispatch; (4) worker turn exceeding `tokenBudget` stops with `cost-limit`; (5) sequential `--process` run output is byte-identical in shape to today's envelope (regression). Command: `node --experimental-strip-types --test src/lib/crew.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. pre-flight: is the crew backend alive?  2. advisory hierarchical run over the parked phase
$B doctor                                   # {llm:{configured:true,…}} or stop and surface the key requirement
$B crew --project build.json --process hierarchical --max-steps 12   # {ok:false,reason:"not-configured"}→exit 3→stop
# 3. branch on the JSON: tasks all done? 4. ingest the advisory output through the governed seam
#    (crew is advisory — its artifacts enter as [agent report], gates stay the only approver)
$B export --project build.json | jq .summary  # confirm still awaiting_hitl — manager never advanced
# 5. human decision on the parked gate, as always
$B approve --project build.json             # or reject --note "<12+ chars>"
```

---

## G-22 — Stateful graph runtime (durable checkpoints, HITL interrupts, conditional branching) — register `13_top20_gaps.md:109` · area 1 · rank #1

**Public surface (agent sees).** Two new verbs + one flag, all additive over the current phase machine:
- `rapidtool-cli plan --project <file.json> [--out plan.mmd]` → `{ "ok": true, "nodes": [ { "id": 3, "code": "P3", "next": 6, "via": "conditional", "hitl": false } ], "snapshotHash": "<fnv1a>" }`. `snapshotHash` = content hash of the project JSON (FNV-1a, `algorithms.ts:733`) at compile time. Default (no edges file) = today's linear graph: `next: id+1` for every node — byte-stable vs. today.
- `rapidtool-cli resume --project <file.json> --snapshot <hash>` → `{ "ok": true, "restored": true, "summary": {…}, "snapshotHash": "<hash>" }` — rewrites the project file from `snapshots/<hash>.json` via the atomic `saveProject` path.
- `rapidtool-cli gate --project <file.json> --snapshot <hash>` — optional: before advancing, verify the on-disk project still matches `<hash>`; mismatch → exit 1 `{ok:false, error:"project drifted from snapshot <hash> (state fork) — resume first"}`.
`plan --out` additionally writes a mermaid file (deterministic; pairs with the existing `diagram` kinds, `headless.ts:1018`).

**Idempotency + error surface.** `resume` is a pure restore: applying it twice in a row is a no-op on the second call only if the file already equals the snapshot (compare content hash; if equal → `{restored:false, reason:"already-at-snapshot"}` exit 0 — idempotency is success). Missing snapshot file → exit 1 `{ok:false, error:"snapshot not found: <hash>"}`. Corrupt snapshot JSON → exit 1 with `io.importProject`'s error text (`io.ts:47`). Snapshot writes are atomic per-file (write-then-rename); a crashed `resume` leaves the project file untouched. Conditional edges that would leave a phase unsealed are rejected at compile time by the same priors logic `priorsSealed` (`phases.ts:122`) — an invalid edge map is a usage error exit 1, never a runtime surprise.

**Change list (file:line anchors).**
1. NEW `src/lib/plan.ts` — `PlanNode = { id: PhaseId; next: PhaseId | "hitl" | "end"; via: "linear"|"conditional" }`; `compilePlan(project, edges?): PlanNode[]` (default linear — reuses `PHASES` `phases.ts:3-109`); `snapshot(project): string` (FNV-1a over `exportProjectJson`, `io.ts:25`); `resume(project, hash): Project` (reads `snapshots/<hash>.json`, `importProject` `io.ts:47`); `snapshotsDirFor(projectPath)` — sibling `snapshots/` dir of the project file.
2. `src/lib/headless.ts` — `advanceTo` (`:313-320`) consults `compilePlan(...).find(n => n.id === project.currentPhase)?.next` when an edges override exists, else `next` unchanged; new passthroughs `buildPlan(project)` / `resumeProject(project, hash)` added beside the vault/design/diagram wrappers (`:1093-1138` pattern, incl. module-availability probe + contract-drift error if `plan.ts` absent — same shape as `vaultModuleAvailable` `:681-687`).
3. `src/lib/types.ts` — `PhaseDef` (end of file, `:302-310`) gains optional `edges?: Partial<Record<PhaseId, PhaseId | "hitl" | "end">>` (additive — hydrate/repair untouched).
4. `src/lib/engine.ts` — the repair clamp `currentPhase = Math.max(0, Math.min(12, highest + 1))` (`:1223-1226, :1240-1242`) stays as the *fallback* only for payloads without an edges override (invariant B.3.3 preserved by default-linear).
5. `scripts/rapidtool-cli.mjs` — add `case "plan"` / `case "resume"` after the `summary` case (`:289-293`); both follow the `loadProjectFor` pattern (`:135-143`).
6. Snapshot writes land next to the project file via `mkdirSync(recursive)` + `writeFileSync` — same mechanics as `writeVault` (`headless.ts:831-852`).

**Test plan.** Suite: `src/lib/headless.test.ts` (all existing engine/headless tests must pass **unmodified** — default-linear invariant) + NEW `src/lib/plan.test.ts`. Key cases: (1) no edges override → `compilePlan` output equals `id+1` for all 13 phases; (2) conditional edge map skips P10 → `gate --autopilot` run never marks P10 ready and `summary.phases` shows it `locked`; (3) kill-mid-P6 simulation: `saveProject` → `resume(hash)` → same `summary` + same next phase (deterministic replay); (4) resume of unknown hash → exit 1 error text; (5) project drifted between snapshot and gate → `--snapshot` guard exits 1. Command: `node --experimental-strip-types --test src/lib/plan.test.ts src/lib/headless.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. snapshot the state before a risky delegation run  2. read the compiled graph (agent sees edges, not just phase N)
$B plan --project build.json --out plan.mmd     # {ok, nodes:[…], snapshotHash:"abc123"}
$B gate --project build.json                    # advance; parked or complete
# 3. something went sideways — roll the project back to the pre-run state
$B resume --project build.json --snapshot abc123 # {ok, restored:true, summary:{…}}
# 4. verify the restore is honest (status + phase + hash all match pre-run)
$B summary --project build.json                  # compare currentPhase/status with the plan output
# 5. re-run with the guard so drift is impossible
$B gate --project build.json --snapshot abc123
```

---

## G-23 — Parallel role fan-out with merge (message pool) — register `13_top20_gaps.md:122` · area 1 · rank #6

**Public surface (agent sees).** New flag on the existing verb:
`rapidtool-cli crew --project <file.json> --parallel <comma-roles> [--max-steps N]` e.g. `--parallel architect,reviewer,tester`.
Stdout JSON (extends the crew envelope):
```json
{ "ok": true, "process": "parallel", "lanes": [
    { "role": "architect", "messages": 2, "stopped": "done", "error": null },
    { "role": "reviewer",  "messages": 2, "stopped": "done", "error": null } ],
  "messages": [ …synthesized ordered transcript… ], "artifacts": [ … ], "stopped": "done" }
```
`lanes[].error` is non-null only for a branch-level backend failure; the synthesis (reviewer) turn never fabricates cross-branch citations — it may only cite real branch message ids (`CrewMessage.id`-style references, `crew.server.ts:399-469` `parseAgentOutput`).

**Idempotency + error surface.** Stateless advisory run (project file untouched) → retry-safe. Role list parsing: unknown role → usage error exit 1 (mirror `--kind` handling `rapidtool-cli.mjs:411-412`); empty list → exit 1. Branch failure semantics: a branch that fails (backend error) is reported in `lanes[].error` and its absence is noted in the synthesis turn; `ok` is `true` only if ≥1 branch produced messages AND synthesis completed; all branches `not-configured` → `{ok:false, reason:"not-configured"}` exit 3 (unchanged). Per-branch budget = `floor(totalBudget / roles.length)` via the existing cost-limit stop — a single runaway branch can't exceed its slice.

**Change list (file:line anchors).**
1. `src/lib/crew.server.ts` — add `runParallelTurn(roles, budget)` after `nextRole`/`dispatch` machinery (`:311-326`): build each role's scoped context from the same prior transcript (existing `buildAgentContext` `:246-310`), dispatch `Promise.all`, then a reviewer synthesis turn merges into ordered `CrewMessage[]` (reviewer `MANDATE` `:74-75`). Extend `CrewRunOptions` (`:514-534`) with `parallel?: CrewRole[]`. Wire into `createCrewRuntime` loop (`:548-689`) and `runCrewServer` (`:690-700`).
2. `src/lib/crew.ts` — `CrewRunOptions` (:113) gains `parallel?: CrewRole[]`; `CrewRunResult` ok-branch (:103) gains `lanes?: { role; messages: number; stopped: string; error: string | null }[]`.
3. `src/lib/headless.ts:902-908` — opts passthrough gains `parallel`.
4. `scripts/rapidtool-cli.mjs:323-344` — parse `--parallel` into a validated `CrewRole[]`; usage error on unknown role.
5. `src/components/console.tsx` — Crew pane (`:1558-1572` renders `project.crew` seats) + transcript view (`CrewRunView` at `:94-111` types) gains lane columns when `process==="parallel"`.

**Test plan.** Suite: `src/lib/crew.test.ts`. Key cases: (1) stub completer records concurrent dispatch — 3 parallel roles each get 1 turn, synthesis cites only real ids; (2) one branch's completer rejects → `lanes[role].error` set, `ok:true` still when others succeeded; (3) all branches `not-configured` → exit-3 shape; (4) budget split: 3 roles, total 3000 → each branch capped at 1000 (`cost-limit` honored); (5) sequential regression: `--parallel` absent → byte-compatible legacy transcript. Command: `node --experimental-strip-types --test src/lib/crew.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. fan out three specialist reviews of the parked phase in one call
$B crew --project build.json --parallel architect,reviewer,tester --max-steps 9
# 2. branch on lanes: any lane errored?  (backend flake → retry is safe: advisory + stateless)
# 3. read the synthesis message (reviewer merge) — it cites real branch ids only
# 4. convert the useful lanes into the governed intake seam (append-only, fingerprint-deduped)
$B ingest --project build.json --report @crew-report.json   # report-idempotent: re-send = applied:false, exit 0
# 5. proceed to the parked gate decision
$B approve --project build.json
```

---

## G-24 — Plan-then-act ledger (sequential-thinking scaffold) — register `13_top20_gaps.md:135` · area 2 · rank #5

**Public surface (agent sees).** New verb:
`rapidtool-cli think --project <file.json> [--phase N] [--llm]` → prints/patches the thinking ledger:
```json
{ "ok": true, "phase": 6, "source": "deterministic", "budget": 8, "version": 1, "thoughts": [
  { "n": 1, "text": "…topo-derived step…", "status": "draft", "branchOf": null } ] }
```
`--phase` defaults to `project.currentPhase`; `--llm` (requires key) replaces/augments rows with planner-emitted JSON plan rows; without `--llm` the ledger is the deterministic spec-graph order (`topo()` `algorithms.ts:305`, `planSpecGraph` `:337-384`) pre-seeded as rows — keyless and byte-stable. The ledger is emitted into the packet (`compileAgentPacket` `packet.ts:116` path) as a new `## Plan ledger` section + a `plan_ledger` key in the System JSON envelope (insert in the envelope object `packet.ts:66-104`), so external agents receive a machine plan, not prose.

**Idempotency + error surface.** `think` without `--llm` is pure: repeated calls return the identical ledger (`version` unchanged). With `--llm`, a re-run *appends* a new version (rows from the prior run keep `status`); a failed LLM call (no key → exit 3 `not-configured`; unparseable JSON after one re-prompt → exit 4 with evidence) leaves the deterministic ledger intact — the machine never fabricates a plan (`crew.server.ts:18-21` honesty contract). Deviation recording: engine/headless phase events may append rows with `status:"revised"` (see change list 3) — `think` never mutates the project's phase state, only the ledger field.

**Change list (file:line anchors).**
1. NEW `src/lib/think.ts` — `ThinkingLedger` type + `deterministicLedger(project, phase)` (maps `topo()`/`planSpecGraph` output rows) + `llmLedger(project, phase, complete)` (planner prompt via the `JSON_SCHEMA`-style envelope; validated rows only) + `patchLedger(project, ledger): Project` (pure).
2. `src/lib/types.ts` — additive optional `Project.thinking?: { ledger: ThinkingLedger }` beside `meta` (`types.ts:283-289` area — insert after the `meta?` field, ~:289).
3. `src/lib/engine.ts` — in `applyPhaseResult` (`:783-868`) and `approveHitl` (`:893-985`) record deviations: when the executed path differs from ledger row n's expectation, append `{n, status:"revised", text:…}` (pure, via a small helper in `think.ts` — engine stays deterministic).
4. `src/lib/packet.ts` — `systemJson` envelope (`:66-104`) gains `plan_ledger` (rows + `revision_count`); prose section inserted near `## Ranked memory` (`:265-266`).
5. `src/lib/headless.ts` — passthrough `thinkLedger(project, phase, llm)` next to the design/diagram wrappers (`:1093-1138`); availability probe `thinkModuleAvailable()` (pattern `:681-687`).
6. `scripts/rapidtool-cli.mjs` — `case "think"` after `summary` (`:289-293`).
7. `src/components/console.tsx` — new tab: extend `RunTab` (`:91`), trigger block (`:1422-1480`), `Tabs.Content` after the spec pane (`:1537-1557`); pane renders numbered rows + status chips.

**Test plan.** Suite: NEW `src/lib/think.test.ts` + `src/lib/packet.test.ts` (packet parse asserts). Key cases: (1) P1 project, no key → ledger rows equal `topo()` order, byte-identical across two calls; (2) `--llm` with stub completer emitting 3 valid rows → rows land, `source:"llm"`; (3) stub emits garbage twice → `{ok:false, reason:"error"}` and deterministic ledger preserved; (4) deviation: simulate an advance that skips a planned row → `status:"revised"` row appended; (5) packet JSON block parses with `plan_ledger` + `revision_count`. Command: `node --experimental-strip-types --test src/lib/think.test.ts src/lib/packet.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. get the machine plan for the current phase before doing work (deterministic floor, no key needed)
$B think --project build.json --phase 6
# 2. (optional) ask the planner tier for a richer plan on the same phase
$B think --project build.json --phase 6 --llm        # exit 3 without key → keep deterministic rows
# 3. execute the phase; the ledger records deviations as revised rows
$B gate --project build.json --autopilot
# 4. re-read the ledger: revision_count tells you how much reality diverged from the plan
$B think --project build.json
# 5. hand the plan to an external agent — it is in the packet System JSON, not prose
$B packet --project build.json --out packet.md
```

---

## G-25 — Reflexion self-critique → revise → retry loop — register `13_top20_gaps.md:148` · area 2 · rank #4

**Public surface (agent sees).** No new verb — the existing `verify` outcome schema grows additively, and `--apply` persists critiques:
`rapidtool-cli verify --project <file.json> [--apply]` →
```json
{ "ok": false, "status": "failed", "iterations": 2, "evidence": "…",
  "critiques": [ { "iteration": 1, "symptom": "…", "hypothesis": "…", "fix": "…" } ],
  "finalSource": "…", "cases": [ … ] }
```
(`ok/status/…` shape unchanged — additive key `critiques`. `--apply` persists a `critique` artifact + `verify.fail` log exactly as `applyVerifyOutcome` does today for failures, `headless.ts:943-997`.) Packet System JSON gains `critique_count` (envelope insert `packet.ts:66-104`).

**Idempotency + error surface.** `verify` never mutates without `--apply` (unchanged). Re-running `verify --apply` after a pass: `applyVerifyOutcome` no-ops on `not-configured` (`headless.ts:944`) and appends one artifact per outcome otherwise — a repeated *failed* run appends another `verify.fail` artifact (append-only by design; the artifact id carries the evidence hash `verify-<status>-<hash8>` `headless.ts:965`, so an identical outcome rerun produces a *colliding id* → make the apply path skip when `project.artifacts` already holds that id — one-line guard, keeps the register's E-09 philosophy). Zero-key: `{ok:false, reason:"not-configured"}` exit 3, nothing persisted (`headless.ts:944`). Critique step failure is non-fatal: deterministic template `{symptom:"(deterministic)", hypothesis:…, fix:…}` from the failing case list keeps the loop moving — the machine never claims an LLM critique it didn't get.

**Change list (file:line anchors).**
1. `src/lib/verify.server.ts` — in `verifyAndFixServer`'s fail path (`:165-190`, before the fixer prompt at `:179-189`): call new `critique(source, brief, failures, cases)` → `{symptom, hypothesis, fix}` (LLM via `completeDeepSeek` `:179` pattern when configured; deterministic template otherwise); thread the critique text into the NEXT `generateCases` call (prompt assembly `:127-138`) — attempt N+1 demonstrably contains attempt N's critique; collect into `critiques[]` on the outcome (type `:23-29` gains `critiques?: {iteration; symptom; hypothesis; fix}[]`).
2. `src/lib/headless.ts` — `applyVerifyOutcome` (`:943-997`): append a `"critique"` artifact (kind — see 3) carrying `critiques` when present; add the artifact-id collision guard described above (next to `:964-975`); pass critiques through `VerifyOutcomeShape` (`:910-916`).
3. `src/lib/types.ts` — `ArtifactKind` (`:23-31`) gains `"critique"` (additive; the `"verify"` member precedent at `headless.ts:970-971` shows the double-cast pattern for mid-flight type safety).
4. `src/lib/report-intake.ts` — on `applyReportResult` failure/lesson paths, prefix a critique-backed episodic row (the memory-write machinery already exists at `:329-344` — reuse, do not duplicate).
5. `src/lib/packet.ts` — `systemJson` envelope (`:66-104`) gains `critique_count` (count of critique artifacts).
6. `src/components/console.tsx` — `ArtifactPane` (`:2011+`) renders `critique` kind with a distinct caption (kind-theme fallback already handles unknown kinds in `diagram.ts:96-107` — mirror that tolerance).

**Test plan.** Suite: `src/lib/verify.test.ts` (exists) + `src/lib/headless.test.ts`. Key cases: (1) stub completer: first run fails 1 case → outcome carries `critiques[0]` and the next `generateCases` prompt contains its `fix` text (DI capture); (2) `applyVerifyOutcome` on a failed outcome with critiques appends exactly one critique artifact + `verify.fail` log, mints NO labels (`lastTest` untouched); (3) identical failed outcome applied twice → second apply skips (id collision guard), artifact count unchanged; (4) zero-key → `not-configured`, no artifacts (existing contract `headless.ts:944` regression); (5) packet System JSON parses with `critique_count`. Command: `node --experimental-strip-types --test src/lib/verify.test.ts src/lib/headless.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. machine verify-fix the generated source (only after codegen phases ran)
$B verify --project build.json --apply            # exit 0 pass / 1 failed / 3 not-configured
# 2. loop on status !== "passed": failed → read critiques[] (why + fix hypothesis per iteration)
# 3. steer the next phase from the evidence, then re-verify (attempt N+1 already saw attempt N's critique)
$B verify --project build.json --apply
# 4. persist the learning into the project trail (critique artifact + memory row are applied above)
# 5. hand off: packet now carries critique_count so the next agent sees the loop history
$B packet --project build.json --out packet.md
```

---

## G-26 — Snapshot/rollback backtracking — register `13_top20_gaps.md:161` · area 2 · rank #9

**Public surface (agent sees).** Two new verbs:
- `rapidtool-cli snapshot --project <file.json> [--note "<why>"]` → `{ "ok": true, "hash": "<fnv1a>", "path": "…\\snapshots\\<hash>.json", "summary": {…} }` — writes `snapshots/<hash>.json` beside the project file (atomic) and appends a `snapshot.taken` log row with the hash.
- `rapidtool-cli rollback --project <file.json> --hash <hash> [--fork]` → `{ "ok": true, "hash": "<hash>", "forked": false, "summary": {…} }`. Without `--fork`: restores the project file from the snapshot (atomic `saveProject`). With `--fork`: writes a NEW sibling project file `<slug>.fork-<hash8>.json` (parent untouched; the fork's ledger gains a `fork.of: <hash>` link row) and does not touch the original.
- Existing `retry`/`reject` semantics unchanged (`headless.ts:518-523 retry`, `engine.ts:986-1044 rejectHitl`); HITL rejection panel optionally offers "fork alternative".

**Idempotency + error surface.** Snapshot of identical state: content-hash means two snapshots of the same project bytes are the same hash — second write is a no-op (`{ok:true, hash, path, duplicate:true}`). Rollback of an already-rolled-back state: after restore the file hash EQUALS the snapshot → re-running rollback with the same hash returns `{ok:true, restored:false, reason:"already-at-snapshot"}` exit 0. Unknown hash → exit 1 `{ok:false, error:"snapshot not found: <hash>"}` (list available hashes in the error via `snapshot ls`). Corrupt snapshot → exit 1 with `importProject` error text (`io.ts:47`). Fork name collision → deterministic suffix (`slugName` dedupe pattern `io.ts:106-116`). Snapshot/rollback are pure file ops — zero LLM calls, keyless.

**Change list (file:line anchors).**
1. NEW `src/lib/snapshots.ts` — `takeSnapshot(project, dir, note?)` (hash via `fnv1a` `algorithms.ts:733` over `exportProjectJson` `io.ts:25`; write-then-rename); `rollback(projectFile, hash)` (import → validate → atomic save via `headless.ts:58-63` mechanics); `forkProject(project, hash)` (new `Project` clone, ledger/log rows); `listSnapshots(dir)`.
2. `src/lib/headless.ts` — passthroughs + availability probe beside design/diagram wrappers (`:1093-1138`); `retry` (`:523-531`) gains optional `{ fromSnapshot?: string }`.
3. `src/lib/engine.ts` — `rejectHitl` (`:986-1044`) note/memory rows unchanged; fork link row is written by `snapshots.ts`, not engine (keep engine pure).
4. `scripts/rapidtool-cli.mjs` — `case "snapshot"` / `case "rollback"` after `summary` (`:289-293`); `--fork` flag parse (boolean-flag helper `flag()` `:78-80`).
5. `src/components/console.tsx` — `HitlDock` (`:1854+`) gains "Try alternative approach (fork)"; Builds list shows fork badges (reads the fork link row).

**Test plan.** Suite: NEW `src/lib/snapshots.test.ts` + `src/lib/headless.test.ts`. Key cases: (1) `takeSnapshot` then mutate then `rollback` → project JSON byte-identical to snapshot; (2) same-state double snapshot → same hash, `duplicate:true`, one file on disk; (3) rollback twice → second returns `already-at-snapshot`; (4) fork never mutates parent file (byte-compare) and ledger carries the link row; (5) unknown hash → exit-1 error naming the hash. Command: `node --experimental-strip-types --test src/lib/snapshots.test.ts src/lib/headless.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. checkpoint before an expensive/risky phase
$B snapshot --project build.json --note "before P6 codegen"   # {ok, hash:"a1b2c3", …}
# 2. run; the phase gets rejected at the HITL gate
$B gate --project build.json --autopilot && $B reject --project build.json --note "…"
# 3. explore an alternative without losing the rejected state
$B rollback --project build.json --hash a1b2c3 --fork          # new sibling file, original intact
# 4. continue the fork
$B gate --project fork-*.json --autopilot
# 5. or, if the fork path failed too: roll the original back and retry from the checkpoint
$B rollback --project build.json --hash a1b2c3 && $B gate --project build.json
```

---

## G-27 — Algorithm template library + spec→algorithm synthesis + benchmark harness — register `13_top20_gaps.md:174` · area 3 · rank #8

**Public surface (agent sees).** New verb (mirrors `design`/`diagram` loader pattern):
`rapidtool-cli scaffold --project <file.json> [--kind app|tool|game|algorithm] [--out <dir>]` →
```json
{ "ok": true, "kind": "algorithm", "algorithm": { "name": "deadline-schedule", "class": "greedy", "bigO": "O(n log n)" },
  "files": [ { "path": "src/schedule.ts", "bytes": 2140 }, … ], "out": "C:\\…\\out" }
```
`--kind algorithm` requires the brief to map to an `ALGO_INDEX` class (sort|greedy|dp|graph|hash); no mapping → exit 1 `{ok:false, error:"brief does not map to an ALGO_INDEX class — closest: …"}` (deterministic, keyless — matching runs on the same stem/token machinery as `librariesFor` `algorithms.ts:803`). The emitter wraps the vendored template with a docstring complexity claim and a `benchmark()` timing harness (zero-dep `performance.now()`).

**Idempotency + error surface.** Deterministic + keyless: same project in → byte-identical `files` out (pure function over the project). Writing is the only side effect and goes to `--out` (default `./scaffold-out/`, created recursively like `writeVault` `headless.ts:837`); re-running overwrites the same files atomically (write-then-rename per file). Missing `src/lib/algolib.ts` (sibling module mid-flight) → clean `{ok:false, error:"…"}` exit 1 — same contract as the design/diagram modules (`headless.ts:1093-1138`). No LLM in the default path; the *crew* coder role (see change 4) is where synthesis language lives.

**Change list (file:line anchors).**
1. NEW `src/lib/algolib.ts` — vendored/ported ~20 canonical TS implementations with MIT notice header; exports `ALGO_INDEX: { name; class: "sort"|"greedy"|"dp"|"graph"|"hash"; bigO; code: string }[]` and `matchAlgo(brief, domain): AlgoRef | null` (token/stem matching consistent with `stemToken`/`tokenizeWords` `algorithms.ts:748-802`).
2. NEW `src/lib/algolib.test.ts` + vendoring provenance note (license header mirrors `scaffold.ts`'s header style `scaffold.ts:1-35`).
3. `src/lib/scaffold.ts` — `projectKindOf` (`:229`) taxonomy gains `"algorithm"` (header comment at `:30-35` documents the 5-way map — update it); `scaffoldProject` dispatcher (`:971-977`) branches to a new emitter written beside the existing emitters (`:458-590` region; keep `Console()` `:566` and `bootGame` `:590` untouched).
4. `src/lib/crew.server.ts` — coder mandate (`MANDATE.coder`, `:70-71`) gains: "when the job maps to an ALGO_INDEX class, reuse the library template and state its complexity" (prompt-level, zero code change).
5. `src/lib/headless.ts` — `scaffoldProject` passthrough + `scaffoldModuleAvailable()` next to `designModuleAvailable` (`:1030-1046`); loader block `:1054-1087` pattern duplicated for `./scaffold.ts` (non-literal specifier).
6. `scripts/rapidtool-cli.mjs` — `case "scaffold"` before `design` (`:390`).

**Test plan.** Suite: `src/lib/algolib.test.ts` (new) + `src/lib/scaffold.test.ts` (exists). Key cases: (1) "schedule jobs by deadline" brief → `matchAlgo` returns a greedy ref; scaffold output file contains the Big-O claim + `benchmark()`; (2) brief with no algorithm job → exit-1 no-mapping error naming the closest class; (3) scaffold output is TypeScript-only (no Python — grep the emitted strings); (4) `buildTestOracle`-style case (`algorithms.ts:449`) executes against the emitted module via `runCases` (`verify.server.ts:94-120`); (5) determinism: two runs, byte-identical. Command: `node --experimental-strip-types --test src/lib/algolib.test.ts src/lib/scaffold.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. brief mentions a computational job — ask the machine for the algorithm scaffold
$B scaffold --project build.json --kind algorithm --out ./gen
# 2. branch on ok/error: no mapping → the error names the closest class → re-brief or accept CRUD
# 3. machine-verify the emitted module (keyed path only)
$B verify --project build.json --apply
# 4. read the artifact: complexity claim + benchmark() harness are in the file header
# 5. ingest any external agent's edits through the governed seam
$B ingest --project build.json --report @agent-report.json
```

---

## G-28 — Property-based test generation — register `13_top20_gaps.md:187` · area 3 · rank #7

**Public surface (agent sees).** New flag on the existing verb:
`rapidtool-cli verify --project <file.json> [--properties] [--apply]` →
```json
{ "ok": false, "status": "failed", "iterations": 1,
  "evidence": "property sort-idempotent failed: counterexample [3,1,2] (shrunk from [9,7,1,2,3,8]) …",
  "properties": [ { "id": "sort-permutation", "pass": true }, { "id": "sort-idempotent", "pass": false, "counterexample": "[3,1,2]" } ],
  "cases": [ …deterministic expression cases… ], "finalSource": "…" }
```
Deterministic seed per run (derived from the evidence-hash input, FNV-1a `algorithms.ts:733`) → same seed, same verdict — preserving the register's determinism philosophy. Without `--properties`, behavior is byte-identical to today.

**Idempotency + error surface.** Same `--apply` semantics as G-25 (one artifact per outcome, id-collision guard). Property failures never crash the run: they render into `evidence` (with the shrunk counterexample) and `status:"failed"`. `fast-check` import failure (server-only dep) → `status:"error"`, exit 4, evidence names the module. Zero-key → property *generation* skipped, deterministic expression cases still run (`not-configured` only when nothing can run). Property run budget capped (`fc.check` attempts/size caps) so a pathological property can't hang a verify loop.

**Change list (file:line anchors).**
1. `package.json` deps — `fast-check` (server-only import sites; client bundle untouched by construction — no client file imports `verify.server.ts`).
2. `src/lib/verify.server.ts` — `generatePropertyCases(source, brief)` beside `generateCases` (`:122-150`): parse exported function signatures from the harness context and emit `fc.property(fc.integer(), …)`-style cases; `runCases` (`:94-120`) or a sibling `runProperties` executes `fc.check` with the fixed seed; `VerifyOutcome` (`:23-29`) gains `properties?`.
3. `src/lib/headless.ts` — `verifyGeneratedSource` (`:924-931`) opts passthrough `{ properties?: boolean }`.
4. `scripts/rapidtool-cli.mjs` — `verify` case (`:346-388`): parse `--properties`, pass through; payload spread already forwards unknown outcome keys (`:369`).
5. `src/components/console.tsx` — Oracle tab (`:1573-1595`) renders property rows + shrunk counterexamples when present.

**Test plan.** Suite: `src/lib/verify.test.ts` + `src/lib/headless.test.ts`. Key cases: (1) sort module fixture → permutation + idempotence properties expressible and runnable; (2) injected failing property → evidence contains the shrunk counterexample; (3) same seed twice → identical verdict/evidence strings; (4) zero-key → expression cases still run, properties omitted; (5) regression: `--properties` absent → outcome JSON byte-compatible. Command: `node --experimental-strip-types --test src/lib/verify.test.ts src/lib/headless.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. strengthen the machine verdict with properties on the same source
$B verify --project build.json --properties --apply
# 2. read status + evidence: shrunk counterexample tells the agent the exact failing input
# 3. if failed: steer a fix via the critique trail (G-25) or a fresh delegation, then re-verify
$B verify --project build.json --properties --apply
# 4. on passed: the verdict is machine-run (label "tested" + evidenceHash) — trust it for the gate
# 5. record the outcome in the packet trail for the next agent
$B packet --project build.json --out packet.md
```

---

## G-29 — Complexity & code-metrics gate — register `13_top20_gaps.md:200` · area 3 · rank #11

**Public surface (agent sees).** New keyless verb + a DoD probe:
`rapidtool-cli metrics --project <file.json>` (metrics over the project's generated code artifacts, no dir needed) →
```json
{ "ok": true, "files": [ { "id": "6-code-…", "loc": 214, "complexity": 9, "maxComplexity": 11, "violations": [ { "line": 88, "complexity": 11, "limit": 10 } ] } ], "verdict": "fail" }
```
`verdict` = `"pass"` when every file's max cyclomatic complexity ≤ 10; `"fail"` otherwise (gate-facing). Also `rapidtool-cli metrics --dir <path>` for arbitrary agent output (same JSON over `.ts`/`.js`/`.mjs` files). DoD: new `p6-metrics` probe in `DOD[6]` (register-consistent; additive over `p6-test/p6-source/p6-artifact/p6-verified` `dod.ts:126-153`).

**Idempotency + error surface.** Pure + keyless + deterministic: same input → same JSON. No project mutation (read-only verb). Missing/unreadable dir or no code artifacts → exit 1 with a specific error; `--project` with no code artifacts → `{ok:true, files:[], verdict:"pass"}` (nothing to gate — explicit, not an error). Violations are evidence-only: the probe fails the gate but never auto-edits source (honesty: machines report, humans/agents fix via verify loops).

**Change list (file:line anchors).**
1. NEW `src/lib/metrics.ts` — `scoreModule(source): { loc; complexity; maxComplexity; exports; violations: {line; complexity; limit}[] }` (token-level cyclomatic counter: count `if/for/while/case/&&/||/?` decision points + 1, with line tracking); `scoreFiles(files): rows`.
2. `src/lib/dod.ts` — `DOD[6]` (phase-6 gate block, keys at `:126-153`) gains additive probe `p6-metrics` (pass iff every code artifact's `maxComplexity ≤ 10`; probes are `(p: Project) => boolean` — `GateItem` type `dod.ts:25`).
3. `src/lib/packet.ts` — System JSON envelope (`:66-104`) gains `code_metrics` block (per-file loc/complexity + verdict) — E-11 seam.
4. `src/lib/headless.ts` — passthrough `scoreProjectCode(project)` + optional `scoreDir(dir)`; keyless, module-probe pattern (`:1030-1046`).
5. `scripts/rapidtool-cli.mjs` — `case "metrics"` near `artifacts` (`:429-434`); supports `--project` XOR `--dir` (usage error exit 1 if both/neither).
6. `src/components/console.tsx` — gate verdict drill-down renders per-file complexity (ArtifactPane/evidence dock area `:139-192` evidence builders).

**Test plan.** Suite: NEW `src/lib/metrics.test.ts` + `src/lib/gates.test.ts` (DoD registry, exists). Key cases: (1) a 15-decision function → `complexity 16`, violation with exact line refs; (2) clean module → `verdict:"pass"`, probe true; (3) gate registry contains `p6-metrics` and `runGate` (`dod.ts:260`) evaluates it; (4) zero LLM calls — assert no import of `llm`/`deepseek` in metrics.ts (static grep in CI); (5) packet System JSON parses with `code_metrics`. Command: `node --experimental-strip-types --test src/lib/metrics.test.ts src/lib/gates.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. before handing code to a reviewer, get the machine number
$B metrics --project build.json                     # verdict fail + file:line violations
# 2. target the exact violation lines in the next fix delegation (no guesswork)
# 3. re-measure after the fix
$B metrics --project build.json                     # verdict pass
# 4. the P6 gate now reports p6-metrics pass in the DoD trail
# 5. confirm via the packet (code_metrics block is machine-readable for the next agent)
$B packet --project build.json
```

---

## G-30 — Dependency graph + architecture rules on REAL generated code — register `13_top20_gaps.md:213` · area 4 · rank #12

**Public surface (agent sees).** New keyless verb:
`rapidtool-cli archcheck --project <file.json> [--out report.json]` →
```json
{ "ok": true, "violations": [ { "rule": "no-circular", "cycle": ["types.ts", "engine.ts", "types.ts"] },
  { "rule": "no-cross-layer", "from": "components/console.tsx", "to": "lib/deepseek.server.ts" } ],
  "modules": 24, "edges": 61, "verdict": "fail", "artifactId": "p6-archcheck-…" }
```
Runs dependency-cruiser's `cruise()` (server-side ESM) over a temp materialization of the project's real generated code (see change 2); violations become P6 gate evidence (`p6-arch` probe family, additive to `dod.ts:126-153`) + a `p6-archcheck` artifact. Rule set v1: `no-circular`, `no-orphans`, and a RapidTool layer rule (`src/lib/*.server.ts` may be imported only from server/headless/test code; client files may not import `*.server.ts` — the invariant `crew.server.ts:2` and `deepseek.server.ts:3-4` already document).

**Idempotency + error surface.** Deterministic for a fixed dependency-cruiser version (pin the dep). Read-only on the project; the only side effect is the appended artifact on… no — `archcheck` is read-only; the *gate* records evidence via the existing `recordGateInto` (`dod.ts:358`) when the phase completes. No code → exit 1 `{ok:false, error:"no generated code to check — run codegen phases first"}`. dependency-cruiser unavailable (mid-flight dep) → clean exit-1 module error (loader pattern). Zero LLM calls by construction. A retry is a re-run: same input → same violations (no state).

**Change list (file:line anchors).**
1. `package.json` deps — `dependency-cruiser` (server-only import).
2. NEW `src/lib/archcheck.ts` — `materializeGenerated(project, dir)` (write `generatedSource` `types.ts:289` + `kind:"code"` artifacts `types.ts:23-31` to a temp dir — file paths parsed from artifact titles per `Artifact` shape `types.ts:41-49`); `runArchCheck(project)` → violations via `cruise()`; `RULES` constant; `renderDot(violations)` optional.
3. `src/lib/dod.ts` — P6 block (`:126-153`) gains additive `p6-arch` probe (pass iff no violations recorded on the phase's last check — evidence stored with the gate via `recordGateInto` `dod.ts:358`).
4. `src/lib/headless.ts` — passthrough + availability probe (loader pattern `:1030-1087`).
5. `scripts/rapidtool-cli.mjs` — `case "archcheck"` near `metrics` (new, after `artifacts` `:429-434`).
6. `src/components/console.tsx` — Diagram tab (`:1605-1611`) renders the dependency SVG when the artifact exists.

**Test plan.** Suite: NEW `src/lib/archcheck.test.ts` + `src/lib/gates.test.ts`. Key cases: (1) fixture with a circular import → violation names the full cycle; (2) fixture with a client→`*.server.ts` import → `no-cross-layer` violation; (3) clean fixture → `verdict:"pass"`, probe true; (4) no generated code → exit-1 error; (5) determinism: two runs identical violation lists (dep version pinned). Command: `node --experimental-strip-types --test src/lib/archcheck.test.ts src/lib/gates.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. enforce architecture on what the pipeline actually produced
$B archcheck --project build.json                    # violations with named cycles
# 2. fix the cycle via the verify/critique loop (G-25) or a fresh codegen
# 3. re-check until verdict pass
$B archcheck --project build.json
# 4. the P6 gate trail records p6-arch pass
# 5. diagram the now-clean module graph for the human review (pairs with G-31)
$B graph --project build.json --out modules.svg
```

---

## G-31 — Module-graph image auto-generation — register `13_top20_gaps.md:226` · area 4 · rank #13

**Public surface (agent sees).** New keyless verb (ships in the same module as G-30):
`rapidtool-cli graph --project <file.json> [--out modules.svg]` →
```json
{ "ok": true, "bytes": 21483, "modules": 24, "edges": 61, "svgWritten": "C:\\…\\modules.svg", "artifactId": "p6-dependency-graph" }
```
Without `--out` only `bytes`/counts are reported and the SVG is attached to the project as artifact `p6-dependency-graph` (stdout stays one JSON object — same rule as `diagram`, `rapidtool-cli.mjs:409-427`). Deterministic layout: pin `madge`'s version; same input → byte-identical SVG.

**Idempotency + error surface.** Same materialization + loader conventions as G-30 (`archcheck.ts` is the shared home, per the register). Re-running `graph` appends/updates one artifact — the artifact id is deterministic (`p6-dependency-graph`), so the append path must replace the existing id rather than duplicate (guard on `project.artifacts.some(a => a.id === "p6-dependency-graph")`). No code → exit 1 specific error. madge unavailable → clean exit-1 module error. Zero LLM calls.

**Change list (file:line anchors).**
1. `package.json` deps — `madge` (server-only; same review as `dependency-cruiser`, G-30).
2. `src/lib/archcheck.ts` (shared with G-30) — `renderModuleGraph(project): Promise<{ svg: string; modules: number; edges: number }>` via madge over the G-30 materialization; artifact builder `dependencyGraphArtifact(svg)` (id `p6-dependency-graph`, kind `"docs"` — `types.ts:23-31`).
3. `src/lib/headless.ts` — passthrough `renderGraph(project)` beside `buildDiagram` (`:1126-1138`).
4. `scripts/rapidtool-cli.mjs` — `case "graph"` after `archcheck`; `--out` handling mirrors `diagram` (`:416-421`).
5. `src/components/console.tsx` — Diagram tab (`:1605-1611`) shows the artifact when present (same surface as G-30).

**Test plan.** Suite: NEW `src/lib/archcheck.test.ts` (both G-30 and G-31 share it). Key cases: (1) same fixture twice → byte-identical SVG; (2) artifact id deterministic + no duplicates on re-run; (3) no generated code → exit-1 error; (4) SVG contains one node per module in the fixture; (5) zero LLM imports (static grep). Command: `node --experimental-strip-types --test src/lib/archcheck.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. picture the codebase for the human reviewer before the gate decision
$B graph --project build.json --out modules.svg        # {ok, bytes, svgWritten}
# 2. read the counts; a 40-node module graph with 3 edges is suspicious → dig with archcheck (G-30)
# 3. after fixes, regenerate
$B graph --project build.json
# 4. the artifact is attached (p6-dependency-graph) — verify via the artifacts index
$B artifacts --project build.json
# 5. reference it in the next packet for the downstream agent
$B packet --project build.json --out packet.md
```

---

## G-32 — ADR automation (machine-minted decision records) — register `13_top20_gaps.md:239` · area 4 · rank #10

**Public surface (agent sees).** New keyless verb family:
- `rapidtool-cli adr list --project <file.json>` → `{ "ok": true, "adrs": [ { "id": 1, "title": "…", "status": "accepted", "hash": "<fnv1a8>", "date": "2026-09-06" } ] }`
- `rapidtool-cli adr show --project <file.json> --id 1` → `{ "ok": true, "id": 1, "path": "adr/0001-<slug>.md", "body": "# 1. …\n## Context …\n## Decision …\n## Consequences …" }`
- `rapidtool-cli adr new --project <file.json> --title "<t>" --context "<c>" --decision "<d>"` → `{ "ok": true, "id": 2, "path": "…", "hash": "…" }`
ADRs are auto-minted from HITL approve/reject events (see change 2); `adr list`/`show`/`new` are the read/append surface. Every ADR id is monotonic and deduped by event hash (`fnv1a` `algorithms.ts:733` over the source event), so one event = one ADR. License note (register `13_top20_gaps.md:241`): npryce/adr-tools is NOASSERTION — pattern-only, do not copy code; phodal/adr (MIT) is the fallback reference.

**Idempotency + error surface.** Minting is event-hash-deduped: replaying the same approve/reject (e.g., a restored project from G-26) cannot double-mint — the hash row already exists → `{ok:false, error:"ADR already exists for event <hash>", id: N}` exit 0? No — exit 0 with `duplicate:true` (idempotency is success, E-09 philosophy). `adr new` with the same title+context+decision fingerprint returns the existing id + `duplicate:true`. Malformed `--context`/`--decision` (empty) → exit 1 usage error. Files live in `adr/` beside the project file; write is atomic (write-then-rename). Keyless, deterministic, zero LLM calls.

**Change list (file:line anchors).**
1. NEW `src/lib/adr.ts` — `mintAdr(project, event: {kind:"approve"|"reject"|"manual"; phase; note?; hashSeed}): { project; adr }` (pure: returns the appended-project + ADR record; ADR body follows the context/decision/consequences format); `listAdrs(project)`, `adrFileFor(adr, dir)`, `writeAdr` (atomic), `eventHash(kind, phase, note)`.
2. Hook points: `src/lib/headless.ts` `approve` (`:498-517`) and `reject` (`:518-522`) — after the existing state transition, call `mintAdr` (approve → ADR with the gate title + decision note; reject → ADR whose consequences = the rejection note). Keep the engine (`engine.ts:893-1044`) untouched to avoid double-minting on the UI path — the UI store path mints through `store.ts` call sites; the register's acceptance ("every HITL approve/reject mints exactly one ADR row") is satisfied at the headless boundary first, UI store second (same helper).
3. `src/lib/packet.ts` — decisions section of the System JSON (`:90-99` area) gains `adr_id` per decision row when minted.
4. `src/lib/io.ts` — `downloadFilename` ext union (`:118`) widened only if ADR export joins the download menu (optional; do not widen until the UI wants it).
5. `scripts/rapidtool-cli.mjs` — `case "adr"` (sub-parse `list|show|new` from `args._[1]`, mirroring the top-level dispatch shape `:149-448`).
6. `src/components/console.tsx` — new "ADR" tab or artifact-list filter; simplest: render `adr/` files in the Artifacts pane filter set (`:1482-1519` filter UI).

**Test plan.** Suite: NEW `src/lib/adr.test.ts` + `src/lib/headless.test.ts`. Key cases: (1) approve → exactly one ADR, id 1, hash matches event; (2) same event replayed (restored project) → `duplicate:true`, no new file; (3) reject with note → ADR consequences contain the note verbatim; (4) `adr new` empty decision → exit-1 usage error; (5) monotonic ids across approve+reject+manual (`2, 3` never collide). Command: `node --experimental-strip-types --test src/lib/adr.test.ts src/lib/headless.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. gates were decided — the ADRs were auto-minted from those events; list them
$B adr list --project build.json                     # every HITL decision has an id + hash
# 2. show the decision behind gate P4 for the next agent
$B adr show --project build.json --id 1
# 3. record a decision the pipeline cannot infer (manual architecture call)
$B adr new --project build.json --title "Vault storage" --context "…" --decision "…"
# 4. confirm monotonicity + dedupe (re-running the same new is a no-op)
$B adr new --project build.json --title "Vault storage" --context "…" --decision "…"   # duplicate:true
# 5. the packet's decisions now carry adr_id links for downstream traceability
$B packet --project build.json
```

---

## G-33 — AST codebase map + refactor planning — register `13_top20_gaps.md:252` · area 4 · rank #14

**Public surface (agent sees).** New keyless verb:
`rapidtool-cli codemap --project <file.json>` →
```json
{ "ok": true, "files": [ { "path": "src/lib/engine.ts", "loc": 1731, "exports": 17, "imports": 9,
    "findings": [ { "rule": "oversized-module", "detail": "1731 LOC > 400 limit" } ] } ],
  "findings": [ … ], "verdict": "warn" }
```
`verdict`: `"ok"` (no findings) | `"warn"` (findings — oversized modules, >7 exports, orphan exports) — advisory, never gate-blocking by default (the G-29 metrics gate stays the blocking one). Emits artifact `p6-codemap.json` (machine-readable map for agents) + optional `proposeRefactors` output as review *suggestions* only — never auto-applied (honesty: machines propose, agents/humans apply through the verify loop).

**Idempotency + error surface.** Read-only + keyless + deterministic: same project → identical codemap JSON. No generated code → exit 1 specific error. ts-morph unavailable (server-only dep, mid-flight) → clean exit-1 module error (loader pattern). Re-run replaces the `p6-codemap.json` artifact (deterministic id guard as G-31).

**Change list (file:line anchors).**
1. `package.json` deps — `ts-morph` (server-only; heavy — isolated in `codemap.ts`, never imported by client code).
2. NEW `src/lib/codemap.ts` — `buildCodeMap(project): CodeMap` over the G-30/G-31 materialization helper (share `materializeGenerated` from `archcheck.ts`); `CodeMap = { files: { path; loc; exports: string[]; imports: string[]; findings: {rule; detail}[] }[]; findings }`; deterministic rules: `oversized-module` (>400 LOC), `many-exports` (>7), `orphan-export` (exported but never imported, only provable for the generated set — scope the rule to intra-set references); `proposeRefactors(map): { file; suggestion }[]` (deterministic rules only: hoist duplicated literals, split oversized module — never applied).
3. `src/lib/headless.ts` — passthrough + availability probe (loader pattern `:1030-1087`).
4. `scripts/rapidtool-cli.mjs` — `case "codemap"` after `archcheck`.
5. `src/components/console.tsx` — Spec tab (`:1537-1557`) gains an "actual vs planned" toggle (planned = `project.specGraph`, actual = codemap rows).

**Test plan.** Suite: NEW `src/lib/codemap.test.ts`. Key cases: (1) hand-verified 3-file fixture → codemap JSON matches exactly (exports/imports/loc); (2) 500-LOC fixture → `oversized-module` finding; (3) orphan export detected within the generated set; (4) no generated code → exit-1 error; (5) zero LLM imports (static grep). Command: `node --experimental-strip-types --test src/lib/codemap.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. map the actual (not planned) codebase before the next delegation
$B codemap --project build.json                       # p6-codemap.json artifact + findings
# 2. target oversized modules in the next verify/refactor loop
# 3. re-map after the refactor
$B codemap --project build.json                       # verdict ok
# 4. cross-check planned vs actual in the spec tab (human review)
# 5. feed the codemap JSON artifact to the next agent (machine-readable input for G-27/G-28 work)
$B export --project build.json
```

---

## G-34 — Design-token pipeline upgrade (Style-Dictionary-compatible export) — register `13_top20_gaps.md:265` · area 5 · rank #15

**Public surface (agent sees).** Extends the existing `design` verb:
`rapidtool-cli design --project <file.json> [--html <out.html>] [--brief "<text>"]` →
```json
{ "ok": true, "tokens": { "palette": { "name": "logistics · rust", "base": "#9a3412", "source": "llm", "model": "deepseek-v4-flash", "tokens": { "bg": "#f5f0e6", … } }, "typography": {…}, "spacing": […], "radius": […], "shadows": […] },
  "tokenJsonWritten": "C:\\…\\tokens.json", "htmlWritten": "C:\\…\\design.html" }
```
`--brief` (optional, needs key) runs the LLM palette pass; `tokens.palette.source` is `"llm"` or `"deterministic"` — never ambiguous. `tokens.json` (Style-Dictionary-shaped) + `tokens.css` are emitted into scaffold output (change 3). Zero-key: `--brief` ignored with exit 0 and `source:"deterministic"` (honesty floor — never a fabricated LLM claim). Without `--brief`, output is byte-identical to today (regression invariant, guarded by `design.test.ts`).

**Idempotency + error surface.** Deterministic when keyless. With key: LLM output is validated against the frozen 20-key contract (`design.ts:57-63` `TOKEN_KEYS`); invalid hexes/keys → one re-prompt, then deterministic fallback with `source:"deterministic"` + a `note` field — exit 0 (content quality is not a machine failure; the fallback is the honest floor, mirroring `verify`'s never-fabricate rule). No project mutation by `design` (existing contract); `tokenJsonWritten` only present when the scaffold emitter wrote files. Re-running with the same `--brief` and key may return a different palette (LLM nondeterminism) — agents must treat `source:"llm"` tokens as advisory and the deterministic ones as the floor (same epistemic rule as crew artifacts).

**Change list (file:line anchors).**
1. `src/lib/design.ts` — additive `designTokensFromBrief(brief, project, complete)` (LLM JSON `{base, accent, neutral, family}` → validated → merged into the existing deterministic construction at `designTokens` `:471-563`); `exportTokenJson(tokens)` (SD-format, ~30 lines); header freeze comment (`:13-17`) extended with the two new exports (the header is the contract — update it in the same commit).
2. `src/lib/llm.ts` — no change needed: `complete()` with `json:true` is the existing seam (`llm.ts:14-40`); the *caller* lives server-side (design runs under the CLI/bare-Node path via `headless.ts` loader — use `deepseek.server.ts` directly there, exactly as `verify.server.ts:19` does).
3. `src/lib/scaffold.ts` — the generated-app emitter (region `:458-590`) writes `tokens.json` + `tokens.css` from `exportTokenJson` when tokens exist.
4. `src/lib/headless.ts` — `designTokens(project, opts?: {brief?})` (`:1093-1102`) passes opts through; contract-drift checks unchanged.
5. `scripts/rapidtool-cli.mjs` — `design` case (`:390-407`): parse `--brief`; add `tokenJsonWritten` to the result when scaffold emission happened.
6. `src/components/console.tsx` — `DesignPane` (`:2994+`) shows palette swatches + `source` badge + "Regenerate (deterministic)" button.

**Test plan.** Suite: `src/lib/design.test.ts` (exists — CI-guards the 20-key contract). Key cases: (1) keyless `--brief` → byte-identical tokens, `source:"deterministic"`; (2) stub LLM palette with valid hexes → tokens pass the existing `design.test.ts` constraints; (3) stub LLM palette with invalid hex/keys → one re-prompt then deterministic fallback + `note`; (4) `exportTokenJson` output parses as SD JSON and `tokens.css` variables reference only the 20 keys; (5) regression: no `--brief` → existing test suite passes unmodified. Command: `node --experimental-strip-types --test src/lib/design.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. ask the same key for brand direction on this brief (exit 3/keyless → deterministic floor)
$B design --project build.json --brief "field-service dispatch for HVAC crews" --html design.html
# 2. branch on palette.source: llm (advisory) vs deterministic (floor)
# 3. the scaffold now ships tokens.json + tokens.css (SD-shaped) for the generated app
# 4. human previews design.html; regenerate deterministically if the palette misses
$B design --project build.json --html design.html
# 5. next builder agent consumes tokens JSON inline from stdout — no file juggling
```

---

## G-35 — Component-generation catalog + HTML→React conversion — register `13_top20_gaps.md:278` · area 5 · rank #16

**Public surface (agent sees).** Extends the `scaffold` verb (G-27 introduces it) + one design-tab intake path:
`rapidtool-cli scaffold --project <file.json> --kind app --components button,card,field,table,badge [--out <dir>]` →
```json
{ "ok": true, "kind": "app", "components": ["button", "card", "field", "table", "badge"],
  "files": [ { "path": "src/components/button.tsx", "bytes": 1420 }, … ], "out": "C:\\…\\out" }
```
Unknown component → exit 1 usage error listing the catalog. HTML draft intake: agents attach HTML in a report artifact (`report-intake.ts` intake, `[agent report]` prefix `report-intake.ts:57-59`); the design tab's "Import HTML draft" pane converts it through the sanitized html-to-react path and renders the tree — no raw `dangerouslySetInnerHTML` outside the sanitizer.

**Idempotency + error surface.** Same as G-27 (deterministic emission; `--out` atomic overwrite; re-run idempotent). HTML intake is validation-first: non-HTML / over-size / disallowed-element input → honest error in the pane + `{ok:false}` log row; the sanitizer allowlist is the single gate (DOMPurify-style; G-01 companion). Deps (`cva`, `html-to-react`) are tiny/MIT+Apache-2.0 and server/build-time — client impact only through the already-generated TSX.

**Change list (file:line anchors).**
1. `package.json` deps — `cva`, `html-to-react`.
2. NEW `src/lib/components-catalog.ts` — `CATALOG: { name; variants; tsx(themeTokens): string }[]` (12–15 recipes: button/card/field/table/badge…); every recipe emits token-classed TSX (reads `designTokens` output shape `design.ts:56-63`).
3. NEW `src/lib/html-intake.ts` — `sanitizeHtmlDraft(html): {ok:true; tree}|{ok:false; error}` (allowlist: headings/p/ul/ol/li/table/thead/tbody/tr/th/td/button/input/form/label/a[href^=https]/img[src^=data:image] + token classnames only; strip scripts/iframes/event attrs); `htmlToReactTree(sanitized)` via html-to-react.
4. `src/lib/scaffold.ts` — the `Console()` emitter (`:566`) consumes catalog recipes when `--components` selects them (keep the legacy emitter until parity — register risk note).
5. `src/components/console.tsx` — Design tab (`DesignPane` `:2994+`) gains "Component catalog" gallery + "Import HTML draft" (paste → sanitized tree preview).
6. `scripts/rapidtool-cli.mjs` — `scaffold` case (G-27's) parses `--components` (comma list, validated against `CATALOG`).

**Test plan.** Suite: NEW `src/lib/components-catalog.test.ts` + NEW `src/lib/html-intake.test.ts`. Key cases: (1) Button recipe ships 3 variants, focus-visible + token classes (string assertions on emitted TSX); (2) catalog emission is deterministic; (3) HTML draft with table+form → React tree, no raw `dangerouslySetInnerHTML` outside the sanitized path; (4) adversarial HTML (script, iframe, `onclick`, `javascript:` href) → stripped or rejected with error; (5) unknown `--components` value → exit-1 usage error. Command: `node --experimental-strip-types --test src/lib/components-catalog.test.ts src/lib/html-intake.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. scaffold the app shell with the catalog selected
$B scaffold --project build.json --kind app --components button,card,field,table,badge --out ./gen
# 2. branch on ok/error (unknown component name → usage error names the catalog)
# 3. an agent-drafted HTML mock arrives via the governed intake seam (report artifact)
$B ingest --project build.json --report @html-draft-report.json
# 4. the design tab converts it through the sanitized path → rendered, previewable tree
# 5. differences between draft and catalog feed the next delegation as evidence
```

---

## G-36 — Open canvas (Figma-like) editor — register `13_top20_gaps.md:291` · area 5 · rank #20

**Public surface (agent sees).** UI-only (no CLI verb — the register says none required; agent side stays the token JSON). The design tab hosts the canvas behind `React.lazy` (bundle rule: main bundle +≤ 50KB gz — the same lazy rule as mermaid per 07 §2.2). Canvas state is export-only: "Export SVG/PNG" lands a `wireframe` artifact via the existing download plumbing (`io.ts` download path `:118-123` + artifact append). License note (register `13_top20_gaps.md:293`): fabric.js is MIT — usable; **Penpot is MPL-2.0 — pattern-only, do not vendor any Penpot code**.

**Idempotency + error surface.** No project state mutated by the canvas; exports append artifacts with deterministic ids (`wireframe-<fnv1a8>` from canvas JSON state — re-exporting the same canvas state is `duplicate:true`). Export failure (SVG serialization error) → pane-level error, project untouched. Zero LLM calls. Lazy chunk failure (network/disk) → the design tab shows the token swatches (existing surface) and a "canvas unavailable" note — never a blank tab.

**Change list (file:line anchors).**
1. `package.json` deps — `fabric` (client dep, lazy chunk only).
2. NEW `src/components/DesignCanvas.tsx` — token swatches from `designTokens` (export shape `design.ts:56-63`), spec-graph wireframe boxes (`planSpecGraph` `algorithms.ts:337-384`), drag/resize, SVG/PNG export via a small pure helper `canvasStateToArtifact(state)` (deterministic id) + the existing artifact append mechanics (mirror `Artifact` shape `types.ts:41-49`).
3. `src/components/console.tsx` — `DesignPane` (`:2994+`) mounts `<DesignCanvas>` via `React.lazy`; export menu joins the download cluster (near `:790-837` download handlers).
4. `src/lib/io.ts` — `downloadFilename` ext union (`:118`) widened with `"png"`/`"svg"` when the export menu needs them (same commit, additive).

**Test plan.** Suite: unit tests only for the pure helpers (canvas itself is browser-QA): NEW `src/lib/design-canvas-state.test.ts` or extend `design.test.ts`. Key cases: (1) `canvasStateToArtifact` deterministic id + `duplicate:true` on same state; (2) export payload contains only token-palette colors; (3) typecheck + existing suites green; (4) build gate: `vite build` output shows the canvas in a separate chunk (assert chunk list, pattern: preview/brand checks in `scripts/*.test.mjs`); (5) main bundle delta ≤ 50KB gz (build-metric check). Command: `npm run build && npm test` + manual browser pass on the design tab.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. agent side stays JSON: read the tokens the canvas renders
$B design --project build.json
# 2. human drags a wireframe; export lands a wireframe artifact (deterministic id)
# 3. agent sees the export in the artifacts index
$B artifacts --project build.json
# 4. agent consumes the exported state (machine-readable) for the next codegen delegation
# 5. no agent-side canvas dependency — visual-only surface by design
```

---

## G-37 — LLM-as-designer vector/logo/icon/badge generation on the SAME DeepSeek key — register `13_top20_gaps.md:304` · area 6 · rank #3

**Public surface (agent sees).** New verb (loader pattern; the module is pure + a server key seam):
`rapidtool-cli vector --project <file.json> --kind logo|icon|badge|monogram [--prompt "<extra>"] [--out brand.svg]` →
```json
{ "ok": true, "kind": "logo", "source": "llm", "sanitized": true, "bytes": 812,
  "svg": "<svg viewBox=\"0 0 96 96\">…</svg>", "svgWritten": "C:\\…\\brand.svg", "artifactId": "vector-logo-…" }
```
`source` is `"llm"` (DeepSeek emitted, sanitizer passed) or `"deterministic-monogram"` (keyless OR LLM output rejected — same exit 0; the fallback is the honest floor). LLM output that fails `sanitizeSvg` is never returned — the fallback is returned with `note:"LLM output rejected by sanitizer: <reason>"`. SVG travels as artifact text (packet-safe). Zero new services — calls go through the existing `deepseek.server.ts` (`/chat/completions`, `deepseek.server.ts:174`), consistent with the register's honest-architecture finding (no image endpoint exists; this is text-emitted SVG code).

**Idempotency + error surface.** Keyless → deterministic monogram: same project + seed → byte-identical SVG (mirror honesty contract `crew.server.ts:18-21`). Keyed runs are LLM-nondeterministic — agents treat them as advisory; the deterministic monogram is the reproducible floor (`--seed` flag optional for byte-stable monograms). Sanitizer contract: allowlist tags/attrs (register spec), strip `<script>`, `<foreignObject>`, event attrs, `url()`/`href` refs; unbalanced/oversized input rejected with evidence. Backend failure (exit 3 not-configured / 4 runtime) behaves like `crew` (`rapidtool-cli.mjs:339-341`). Export file write is atomic; re-run overwrites deterministically for monogram, appends a new artifact for LLM outputs (id carries fnv1a of the SVG — self-dedupe).

**Change list (file:line anchors).**
1. NEW `src/lib/vector.ts` (pure) — `promptLogo(brief, tokens)` (strict SVG prompt: single `<svg viewBox="0 0 96 96">`, ≤12 elements, palette fills only, no gradients/defs v1); `sanitizeSvg(svg): {ok:true; svg}|{ok:false; reason}` (whitelist parser, ~120 lines, per the register spec `13_top20_gaps.md:310`); `renderSvgToDataUrl(svg)`; `geometricMonogram(name, seed)` (byte-stable fallback).
2. NEW `src/lib/vector.server.ts` — `generateVector(kind, brief, tokens)` → `{source:"llm", svg}` or `{source:"deterministic-monogram", svg, note?}`: calls `completeDeepSeek` (`deepseek.server.ts:135`) with `json:true`-free strict-text prompt, then `sanitizeSvg`; rejection → fallback + note. Server-only key read (boundary rule, `llm.ts:1-8` / `deepseek.server.ts:1-16`).
3. `src/lib/types.ts` — `ArtifactKind` (`:23-31`) gains `"vector"` (additive; `"critique"` precedent in G-25 applies the same double-cast pattern).
4. `src/lib/headless.ts` — passthrough `generateVector(project, opts)` + availability probes (`vector.ts`, `vector.server.ts`); loader pattern `:1030-1087`.
5. `scripts/rapidtool-cli.mjs` — `case "vector"` after `design` (`:407`); `--kind` validated (usage error exit 1 on unknown — mirror `diagram --kind` `:411-412`); `--out` mirror of `diagram` (`:416-421`).
6. `src/components/console.tsx` — `DesignPane` (`:2994+`) gains "Brand kit": logo `<img>` on data URL (sanitized), monogram toggle, "Export SVG" (download cluster `:790-837`).
7. `src/lib/io.ts` — `downloadFilename` ext union (`:118`) gains `"svg"`.

**Test plan.** Suite: NEW `src/lib/vector.test.ts` (sanitizer + monogram determinism) + `src/lib/headless.test.ts` (loader). Key cases: (1) fuzz corpus (script tag, foreignObject, `onload=`, `javascript:`, event attrs, unbalanced tags, 10MB blob) → all stripped or rejected with reason — security test in CI; (2) keyless same seed twice → byte-identical monogram; (3) stub LLM emitting valid SVG → `source:"llm"`, sanitizer passes; (4) stub LLM emitting malicious SVG → fallback + `note`, never the raw output; (5) unknown `--kind` → exit 1. Command: `node --experimental-strip-types --test src/lib/vector.test.ts src/lib/headless.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. one key, one call: brand logo from the project brief + palette
$B vector --project build.json --kind logo --out brand.svg
# 2. branch on source: llm (sanitized, advisory) vs deterministic-monogram (floor, byte-stable)
# 3. if llm output is close but not right, iterate with --prompt constraints (same key, no new services)
$B vector --project build.json --kind logo --prompt "single flat mark, no gradients"
# 4. the artifact is packet-safe SVG text — reference it in the handoff
# 5. ship the deterministic monogram whenever reproducibility outranks novelty
$B vector --project build.json --kind monogram --out monogram.svg
```

---

## G-38 — Palette→UI ramp mapping — register `13_top20_gaps.md:317` · area 6 · rank #17

**Public surface (agent sees).** New keyless verb:
`rapidtool-cli palette <hex>` → `{ "ok": true, "hex": "#9a3412", "ramp": ["#fdf3ee", …, "#9a3412", …, "#4a1503"],
  "steps": 10, "pairs": [ { "bg": "#fdf3ee", "fg": "#4a1503", "contrast": 7.9, "aa": true, "aaa": true } ] }`
Invalid hex → exit 1 `{ok:false, error:"invalid hex color: <value> — expected #rgb/#rrggbb"}`. `rampFromBrief` (LLM hex choice) lives in the design pipeline (G-34's seam) — this CLI is the deterministic ramp + contrast surface. Zero LLM calls here.

**Idempotency + error surface.** Pure + deterministic: same hex → identical ramp bytes. Read-only. Ramp derivation: culori LCH interpolation (tree-shaken ~2KB) or the zero-dep HSL fallback — pick one and pin it; contrast math (`accessiblePair`) is zero-dep WCAG relative-luminance. Every returned pair carries `aa`/`aaa` booleans so agents can assert accessibility without re-implementing WCAG.

**Change list (file:line anchors).**
1. `package.json` deps — `culori` (optional: zero-dep HSL fallback acceptable — decide in review).
2. NEW `src/lib/palette.ts` — `deriveRamp(baseHex, steps=10)`; `accessiblePair(bg, fg)` (WCAG contrast, zero-dep); `rampFromBrief(brief, complete)` (LLM JSON → `{base, accent, neutral}` validated hexes — G-34 seam); `openColorSeed()` (vendored open-color ramps, MIT — deterministic seed set, register `13_top20_gaps.md:319`).
3. `src/lib/design.ts` — `designTokens` (`:471-563`) consumes ramp values where palette.tokens feed UI steps (additive keys only if the 20-key contract is extended — otherwise map ramp steps onto existing keys; do NOT break `TOKEN_KEYS` `:57-63`).
4. `src/lib/vector.ts` (G-37) — fills reference `palette.ts` ramps (hover/active steps for badges).
5. `scripts/rapidtool-cli.mjs` — `case "palette"` (positional `<hex>` arg from `args._[1]`, near `metrics`).
6. `src/components/console.tsx` — `DesignPane` (`:2994+`) ramp strip + contrast badges per token key.

**Test plan.** Suite: NEW `src/lib/palette.test.ts` + extend `src/lib/design.test.ts`. Key cases: (1) any valid hex → 10-step ramp, all steps valid hex; (2) each ramp's step-0/step-9 pair passes AA (assertion over a corpus of 20 hexes incl. edge lightness); (3) invalid hex → exit-1 error text; (4) `accessiblePair` known-value check (white on black = 21.0); (5) determinism: same hex → identical ramp. Command: `node --experimental-strip-types --test src/lib/palette.test.ts src/lib/design.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. take any brand hex to a usable UI ramp in one keyless call
$B palette "#9a3412"
# 2. read pairs[]: AA/AAA booleans are machine-asserted — no re-implementation
# 3. feed ramp steps into the design pipeline (G-34) or vector fills (G-37)
# 4. re-check contrast after a palette change without waiting for the UI
$B palette "#b3541e" | jq .pairs[0].aa
# 5. the deterministic ramp is the floor; LLM-chosen hexes stay advisory (G-34 source field)
```

---

## G-39 — Agent memory consolidation: write-back + ranking — register `13_top20_gaps.md:330` · area 7 · rank #4

↯ **CORRECTION (stale register premise).** The register claims "M-08 open: `applyReport` writes no memory (`report-intake.ts:142-147`)". That line range is stale — M-08 has since landed: `applyReportResult` (`report-intake.ts:246`) writes semantic + episodic memory rows at `report-intake.ts:323-344` (semantic summary row `:329-336`, per-artifact episodic rows `:336-344`, deduped by the content-fingerprint id at `:235`), and the module header documents the loop (`report-intake.ts:22-27`). FusionRank already ranks memory into every packet (`algorithms.ts:214-261`, packet calls at `packet.ts:123-125`). The register's UI claims also predate reality (memory-derived notes: `vault.ts` already has note machinery `buildVaultNotes` `:124`). The card below therefore scopes the *remaining delta*.

**Public surface (agent sees).** No new verb — changes ride existing seams: (a) `ingest` responses gain a `memory` field; (b) rejected-report ingests persist lesson rows; (c) vault export gains memory-derived notes; (d) packet memory section (existing `## Ranked memory` `packet.ts:265-266`) shows the new rows automatically.
`rapidtool-cli ingest --project <file.json> --report <json|@file|->` →
```json
{ "ok": true, "path": "…", "applied": true, "reason": "new", "memory": { "added": 2, "rows": ["report-semantic-4-…", "report-episodic-4-0-…"] }, "summary": {…} }
```
`applied:false, reason:"duplicate"` on re-send (exit 0 — idempotency is success, E-09). Rejected report → `{ "ok": true, "applied": true, "reason": "rejected-lesson", "memory": { "added": 1, … } }` with the lesson row linked to the rejection ledger hash.

**Idempotency + error surface.** Content-fingerprint dedupe already exists (`report-intake.ts:235`, artifact + memory ids carry `fp8`) — the delta must keep it (regression-guarded). Memory writes are capped/deduped exactly like engine rows (`dedupeMemoryIds` `engine.ts:176`; `engine.ts:976-983` pattern). A rejected report with a note <12 chars is rejected before any memory write (existing rule `rapidtool-cli.mjs:204-209`). No key required anywhere in this card — all deterministic.

**Change list (file:line anchors).**
1. `src/lib/report-intake.ts` — in `applyReportResult` (`:246-344`): on the rejected/lesson path (the `blocked`/rejection branch around `:311-323`), append one episodic lesson row `kind:"episodic"`, text = `HITL/agent lesson P<phase>: <note>` prefixed from the rejection trail, linked by ledger event hash; expose `memory` on the result type (return shape near `:246`).
2. `src/lib/headless.ts` — `ingest` (`:544-570`) passes the result through; response gains the `memory` field (CLI spreads result fields — check `rapidtool-cli.mjs:236-258` payload shape and extend `applied`-style reporting).
3. `src/lib/vault.ts` — additive `exportMemoryNotes(project): VaultNote[]` beside `buildVaultNotes` (`:124`): map memory rows to note kind rows (provenance in body); fold into the vault export path (`vaultMarkdown`/`vaultIndex` `:446/:475`) so the vault MOC lists learned lessons.
4. `scripts/rapidtool-cli.mjs` — `ingest` case (`:216-259`): add `memory` to the success payload (`:239`).
5. No ranking change: FusionRank already consumes memory (`algorithms.ts:214-261`) — add a test asserting new rows rank into the next packet (regression for the register's acceptance #1).

**Test plan.** Suite: `src/lib/report-intake.test.ts` (exists) + `src/lib/headless.test.ts` + `src/lib/vault.test.ts`. Key cases: (1) approved complete report → 2 memory rows, ids carry fp8, ranked into next packet's FusionRank output; (2) rejected report → 1 lesson row whose text contains the ledger hash; (3) re-ingest same report → `applied:false, reason:"duplicate"`, memory count unchanged; (4) vault export contains memory-derived notes with provenance; (5) deterministic-only path: no LLM anywhere (static grep). Command: `node --experimental-strip-types --test src/lib/report-intake.test.ts src/lib/headless.test.ts src/lib/vault.test.ts`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. an agent report arrives; ingest returns memory.added + row ids
$B ingest --project build.json --report @agent-report.json
# 2. re-send on timeout → applied:false, reason:"duplicate" (exit 0 — safe retry)
# 3. a rejected phase's lesson is now a memory row linked to the ledger hash (no extra work)
# 4. the next packet ranks those rows into context automatically (FusionRank)
$B packet --project build.json
# 5. the vault MOC lists learned lessons for the human/next agent
$B vault --project build.json --out vault/
```

---

## G-40 — Agent observability, evals & replay (+ MCP server + git export) — register `13_top20_gaps.md:343` · area 7 · rank #2

**Public surface (agent sees).** Three new surfaces:
- `rapidtool-cli trace show [--project <file.json> | --run <id>]` → `{ "ok": true, "run": "run-…", "spans": [ { "id": "s1", "parent": null, "phase": 6, "role": "verify", "model": "deepseek-v4-flash", "tokensIn": 412, "tokensOut": 88, "latencyMs": 1240, "verdict": "passed" } ], "redacted": true }`
- `rapidtool-cli replay --run <id> --project <file.json>` → `{ "ok": true, "replayed": true, "verdictMatch": true, "spans": N, "summary": {…} }` — re-runs from the run's snapshot (G-26) and asserts the same gate verdict (`verdictMatch` — the honesty claim).
- MCP server: `npx rapidtool-mcp` (stdio) exposing `create/run/gate/approve/reject/ingest/packet/export/summary/think/vector/…` as MCP tools whose JSON I/O is the CLI contract verbatim (envelope + exit-code → `isError`). External agents (Claude Code etc.) drive a governed build without the shell.
- `npm run eval` — promptfoo-style assertion suite over stored traces (`{name, filter, asserts:[{type:"contains"|"json-schema", …}]}`) + git export: `rapidtool-cli git export --project <file.json> --out <dir>` (isomorphic-git, from G-26 snapshots).

**Idempotency + error surface.** Traces are append-only NDJSON (`<project>.trace` next to the project file; a run id = the run's snapshot hash — deterministic). Replay of a run whose snapshot is missing → exit 1 `{ok:false, error:"snapshot not found — replay requires G-26 snapshots"}`. `verdictMatch:false` is a successful *report* (exit 0) — the machine states the divergence, it doesn't crash on it. Trace files carry zero secrets: prompts/config are redacted at write time (redaction config; assert in tests). MCP tool errors map 1:1 to CLI exit codes: `not-configured` → MCP `isError:true` with the same message (agents branch identically). Evals never mutate traces (read-only runner).

**Change list (file:line anchors).**
1. NEW `src/lib/trace.ts` — `traceStart(project, runId)`, `span(parent, {phase, role, model, tokensIn, tokensOut, latencyMs, verdict})`, append-only NDJSON writer (atomic per-line append; mirror ledger append style `engine.ts:1019`), `redact(text)` (config: key patterns, prompt bodies), `readTrace(runId)`. Freeze v1 span schema in `types.ts` (additive `TraceSpan` type near `JsonLog` `types.ts:113-121`).
2. Hook points — every engine/crew/verify boundary writes spans: `headless.ts` `runUntilGate` (`:441-497`), `runCrew` (`:902-908`), `verifyGeneratedSource` (`:924-931`); crew turns in `crew.server.ts` runtime loop (`:548-689`).
3. NEW `src/lib/eval-runner.ts` — assertions (`contains` / zod `toJSONSchema` — zod already installed per 07 §2.9) over stored traces + packet outputs; `npm run eval` script in `package.json:14` region.
4. NEW `src/lib/mcp-server.ts` + `scripts/rapidtool-mcp.mjs` — MCP TypeScript SDK (dep, MIT→Apache-2.0 transition — allowed) wrapping the `headless.ts` verb surface; each tool validates args, calls the passthrough, returns the CLI envelope; `npx rapidtool-mcp` bin in `package.json`.
5. NEW `src/lib/git-export.ts` — isomorphic-git (dep, MIT) commit/export from G-26 snapshot files.
6. `scripts/rapidtool-cli.mjs` — `case "trace"` / `case "replay"` / `case "git"` (sub-parse pattern from G-32's `adr`).
7. `src/components/console.tsx` — new "Trace" tab: extend `RunTab` (`:91`), trigger (`:1422-1480`), content after Diagram pane (`:1605-1611`); waterfall render, click-through to span payload.

**Test plan.** Suite: NEW `src/lib/trace.test.ts` + `src/lib/eval-runner.test.ts` + `src/lib/mcp-server.test.ts` (protocol-level: in-process client calls `approve` on a fixture awaiting_hitl → tool result `ok:true`). Key cases: (1) every hook writes a span; run file is append-only NDJSON, parses clean; (2) replay from trace+snapshot → same gate verdict, `verdictMatch:true`; diverged fixture → `verdictMatch:false` reported honestly; (3) redaction: seeded secret string in a prompt never appears in trace bytes; (4) eval suite ≥1 case per crew role over stored traces, `json-schema` assert via zod; (5) MCP `approve` end-to-end on a HITL phase + `not-configured` tool returns `isError` with the CLI message; (6) git export produces a valid repo (clone-verify). Command: `node --experimental-strip-types --test src/lib/trace.test.ts src/lib/eval-runner.test.ts src/lib/mcp-server.test.ts` + `npm run eval`.

**Agent playbook (5 steps).**
```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"
# 1. every run already wrote a trace (hooks are automatic) — inspect a failed run
$B trace show --project build.json
# 2. replay it to confirm the failure reproduces deterministically
$B replay --run <id> --project build.json               # verdictMatch tells the truth
# 3. drive the fix through the governed surface — either CLI or MCP from another agent tool
npx rapidtool-mcp                                      # external agents: approve/reject/ingest as MCP tools
# 4. measure the improvement: eval suite over stored traces
npm run eval
# 5. export the project history for the human repo
$B git export --project build.json --out ./history
```

---

## Closing: cross-card verification notes (Flash evaluator #3)

- **Every `file:line` anchor above was read directly from the working tree on 2026-09-06** (files: `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md`, `src/lib/headless.ts`, `verify.server.ts`, `crew.ts`, `crew.server.ts`, `deepseek.server.ts`, `packet.ts`, `report-intake.ts`, `dod.ts`, `design.ts`, `diagram.ts`, `algorithms.ts`, `engine.ts`, `scaffold.ts`, `vault.ts`, `llm.ts`, `io.ts`, `types.ts`, `phases.ts`, `sandbox.ts`, `node-runner.server.ts`, `exec.ts`, `store.ts`, `src/components/console.tsx`, `package.json`). The register's citations were spot-checked; confirmed drift is flagged inline with `↯ CORRECTION` (G-39) or handled by citing the corrected anchor (e.g. console `HitlDock` is at `console.tsx:1854`, not `:705-758`; report memory rows at `report-intake.ts:323-344`, not `:142-147`).
- **Register sync:** headings/ranks/areas mirror `13_top20_gaps.md:96-355` as rebuilt at 03:43 (previously the file was 81,230 bytes of NULs on disk — see preamble). No G-21…G-40 item was left PRE-DRAFT: all 20 items were present in the live register before this document was finalized.
- **Deterministic-floor rule applied consistently:** every keyed surface in these cards has an explicit keyless floor (deterministic ledger G-24, monogram G-37, palette G-34 fallback, expression cases G-28) and every "passed/approved"-style claim stays machine-verifiable (DoD probes, real runner, evidence hashes).
- **Sibling-wave alignment:** cards reference E-06/E-09/E-11/E-16/E-21 seams (`research/multiagent/08_enhancement_register.md`) and the 14-roadmap (`14_agi_aggregation.md`, being written in parallel) only where the register does; no card invents a new cross-file dependency outside the register's own integration specs.

