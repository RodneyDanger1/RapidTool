# 355-6 — the RapidTool architecture map, the wiring matrix, and the capability-gap map

**Wave:** W355 (audit/freeze), lane `cartographer` (the standing architecture lane).
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (path contains a space). **Host:** Node v24.15.0.
**HEAD:** `30bce78` on `main`, **dirty** (132 entries in `git status --short`; `git status --short | Select-String '^ ?D'` = 0, so nothing tracked is deleted).
**Method:** read-only. No product file, doc, register or other lane's file was edited. No `npm test`, no
`npm run build`, no `scripts/gate.sh`. Every structural claim below carries `file:line`; every absence
claim carries the query I ran and its zero result. Where a doc and the bytes disagree, the bytes win.

> **What this map is not.** It is not a fix. The capability gaps it names are *mapped*, not repaired —
> §7 names the smallest honest step for each and defers the build to a later wave. Nothing here lowers a
> bar or claims a capability the tree does not have.

**Baseline I did not re-derive (quoted, not verified):** the wave brief states `npx tsc --noEmit` exits 2
with 5 errors and `npm test` exits 1 (622/607/15). Running either was out of scope for this lane, so
"the tree is RED" is taken as the brief's input, not re-measured here.

---

## 0. Read-this-first: the three things the bytes say loudest

1. **There is no agent-to-agent bus, and nothing on the telemetry path can become one.** `RtEvent`
   (`src/lib/rt-events.ts:64-99`) is a *bounded, redacted, one-way observation row* — its own header
   forbids prompt bodies and project JSON (`rt-events.ts:12-15`) and its `capture` field is "baked per
   hook — never parsed" (`rt-events.ts:85`). Nothing in `src/` reads a row back into a prompt. §6/§7.
2. **No seat selects a tool, because no seat is ever *offered* one.** Neither provider body carries a
   `tools` or `tool_choice` key (`src/lib/llm/providers/deepseek.ts:578-604`,
   `src/lib/llm/providers/openai-compatible.ts:480-493`); the only `tool_calls` mention in the provider
   layer is a `finish_reason` **enum member** (`deepseek.ts:158,167`). DeepSeek function calling is
   live-verified in the dossier (`research/deepseek-api.md:147-172`) — **and unused by this product.**
   §5.
3. **Five load-bearing-sounding seams have zero production callers**: the crew→report ingest bridge
   (`crewToReport`), the sub-agent contract, the swarm's LLM seats, the iterate-until-satisfaction driver,
   and the entire defect→repair lesson loop. Each is *declared* as wired — e.g. "feeds … the next run's
   synthesis/repair prompts" (`src/lib/knowledge.ts:1269-1271`). The bytes say otherwise. §8 B-1…B-5.

---

## 1. Layer map

Four layers, with Layer 3 drawn as its two distinct drivers (browser store / headless journey).
Arrows are **static import direction** unless marked *(lazy)*, which means a computed / dynamic
`import()` inside a function body (the repo's `.server.` boundary device).

```
┌─ Layer 4 · Surfaces (client / operator) ───────────────────────────────────────────────┐
│  src/components/console.tsx · software-preview.tsx · pipeline-rail.tsx · cmd-palette.tsx │
│  src/routes/{__root,index,run.$id,login}.tsx · scripts/rapidtool-cli.mjs                 │
└───────────────┬──────────────────────────────────────────────┬──────────────────────────┘
                │ store actions / createServerFn               │ CLI verb dispatch
┌───────────────▼──────────────────┐            ┌──────────────▼──────────────────────────┐
│ Layer 3 · State + drivers        │            │ Layer 3' · Headless journey driver       │
│  src/lib/store.ts (zustand)      │            │  src/lib/headless.ts                     │
│  src/lib/rt-client.ts            │            │  src/lib/checkpoint.server.ts            │
│  src/lib/wild-bridge.ts (client- │            │  src/lib/git.server.ts                   │
│    safe createServerFn)          │            │  src/lib/runtime-log.server.ts           │
└───────────────┬──────────────────┘            └──────────────┬──────────────────────────┘
                │                                              │
┌───────────────▼──────────────────────────────────────────────▼──────────────────────────┐
│ Layer 2 · Server seams (host-side work: fs, spawn, key)                                  │
│  codegen.server.ts · verify.server.ts · compile-check.server.ts · node-runner.server.ts  │
│  scaffold.ts · knowledge.ts · prompt-engine.ts · planning.ts · harvest.ts · algo-tools.ts│
│  mcp.server.ts · selfmod.server.ts · wild-mode.server.ts · wild-bridge.server.ts         │
│  deepseek.server.ts · websearch.server.ts · llm/providers/**                             │
└───────────────┬─────────────────────────────────────────────────────────────────────────┘
                │ (engine reaches layer 2 ONLY through lazy computed specifiers)
┌───────────────▼─────────────────────────────────────────────────────────────────────────┐
│ Layer 1 · Pure engine (no fs, no network, deterministic)                                 │
│  engine.ts · phases.ts · dod.ts · packet.ts · algorithms.ts · sandbox.ts · patch.ts      │
│  vault.ts · bench.ts · iterate.ts · subagent.ts · swarm.ts · handoff.ts · crew.ts        │
│  rt-events.ts · rt-ring.ts · rt-timeline.ts · diagnose.ts · watchdog.ts · errors.ts      │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

| Layer | Modules (evidence) | Owns | Direction rule |
|---|---|---|---|
| **1 Pure engine** | `engine.ts` (6711 lines), `phases.ts`, `dod.ts`, `packet.ts`, `algorithms.ts`, `sandbox.ts`, `patch.ts`, `vault.ts`, `bench.ts`, `crew.ts`, `swarm.ts`, `handoff.ts`, `subagent.ts`, `iterate.ts`, `rt-events.ts`, `rt-ring.ts`, `diagnose.ts`, `watchdog.ts`, `errors.ts` | phase state machine, DoD probes, packet compile, lexicals, telemetry *shapes* | may import Layer 1 only; reaches Layer 2 via lazy specifiers |
| **2 Server seams** | `codegen.server.ts` (485 KB), `scaffold.ts`, `headless.ts`, `verify.server.ts`, `compile-check.server.ts`, `node-runner.server.ts`, `knowledge.ts`, `prompt-engine.ts`, `planning.ts`, `harvest.ts`, `algo-tools.ts`, `mcp.server.ts`, `git.server.ts`, `wild-*.server.ts`, `deepseek.server.ts`, `websearch.server.ts`, `llm/providers/**` | fs, child spawn, provider I/O, disk-backed store | may import Layers 1–2 |
| **3 State + drivers** | `store.ts` (138 KB, zustand+persist), `rt-client.ts` (browser sinks), `wild-bridge.ts`, `checkpoint.server.ts`, `runtime-log.server.ts` | observable app state, browser wild driver, NDJSON log | Layer 3 may import 1–2; Layer 1 may **not** import 3 |
| **4 Surfaces** | `console.tsx`, `software-preview.tsx`, `routes/*`, `scripts/rapidtool-cli.mjs` | render + verb dispatch | Layer 4 imports 1–3 |

### 1a. The dependency direction holds — with four marked exceptions

Verified by `Get-ChildItem -Recurse -Include *.ts,*.tsx -Path src | Select-String '^import .*from "\./.*\.server\.ts"'`.
Findings, in order of how much they matter:

- **OK · type-only downward imports.** `engine.ts:55` imports **types** from `wild-mode.server.ts`;
  `wild-bridge.ts:24` does the same; `doctor.ts:98` type-only from `mcp.server.ts`. Type-only imports are
  erased by `--experimental-strip-types`, so no runtime edge exists. Not a defect.
- **OK · server→server.** `codegen.server.ts:137,166,170,171` → `verify.server.ts` /
  `compile-check.server.ts` / `scaffold.ts`; `compile-check.server.ts:37` → `node-runner.server.ts`.
  Same layer, no inversion.
- **INVALID-ISH (1) · `knowledge.ts` is a pure-looking, fs-touching module.** `knowledge.ts:30-31`
  statically imports `node:fs` and `node:path`. It is therefore **not** import-safe for the client bundle —
  which is exactly why `engine.ts` and `report-intake.ts` reach it through a lazy surface
  (`engine.ts:141-153`, `report-intake.ts:65-74`) instead of a static import. The type is honest; the
  *name* is not. A lane that imports `knowledge.ts` statically from a client graph breaks the bundle
  (the H2 crash class `AGENTS.md:122` names).
- **INVALID (2) · the lazy lesson surface is a race.** `engine.ts:141-153` initializes `lessonSurface`
  with `void import("./knowledge.ts").then(...)`. Any synchronous caller of `synthesizePhase` /
  `rejectHitl` that runs before that promise settles sees `lessonSurface === null` and **silently skips
  the lesson mint** (`engine.ts:934-940`, `engine.ts:2376`). The code is written defensively (`&&
  lessonSurface`), so it fails *quiet* rather than red — which is the worst kind of failure for a
  learning loop. See §8 item B-6.
- **INVALID (3) · `prompt-engine.ts` is server-only despite its name.** `prompt-engine.ts:44-49`
  statically imports `deepseek.server.ts`. It is consumed by `codegen.server.ts:135` (server) — fine —
  but the name invites a client import. `knowledge.ts:33` imports `sandbox.ts` (pure) so `knowledge.ts`'s
  *pure* half is importable; its fs half is not. Same hazard class as (1).
- **OK · the `.server.` boundary is enforced by a helper, not convention.** `store.ts:27` imports
  `clientSafeServerSpecifier` from `server-spec.ts`; `engine.ts:5365,4059,4074` use it to assemble
  specifiers at runtime so TanStack's import-protection never sees a literal `./x.server.ts` in a client
  graph. `engine.ts:5341-5359`'s own comment records the measured hang (an await on the mock proxy
  starves the event loop; there is no in-process timeout that can fire — the same note as
  `engine.ts:4050-4058`).

**No upward dependency from Layer 1 → Layer 3 exists.** Grep result: no `src/lib/*.ts` engine file
statically imports `store.ts`, `console.tsx`, or any route. (`store.ts` is the only importer of engine,
at `store.ts:21`.)

---

## 2. Wiring matrix — the load-bearing seams

`live?` = **live** (a real call site exists today), **partial** (a call site exists but only on some
hosts / behind a flag), **dead** (exported, zero callers). Every "dead" claim names its query in §8.

| # | Producer | Consumer | Mechanism | Live? | Evidence |
|---|---|---|---|---|---|
| 1 | engine phase execution | store wild driver | `store.startWildRun` loop calls `wildStep` | **live** | `store.ts:1932` (loop, cap 20) → `store.ts:1942` `wildStep(cur, {…})` |
| 2 | engine live layer | headless journey | `headless.runPhase` → `engine.liveLayer` | **live** | `headless.ts:970`; `engine.ts:4159` |
| 3 | codegen | scaffold | `scaffoldProject(project, {allowUnderProduced:true})` for the pre-seal typecheck tree | **live** | `codegen.server.ts:171`, `:6287` |
| 4 | codegen/headless | scaffold (ship path) | `scaffold.scaffoldProject(emitProjectInput)` | **live** | `headless.ts:2836` |
| 5 | DoD gate | project record | `recordGateInto` (fresh `evidenceHash` + gate artifact) | **live** | `dod.ts:1951`; called `engine.ts:4560,5944,6673,6678` |
| 6 | DoD gate | Agent Packet | `stampPacket(recordGateInto(done, phase))` | **live** | `engine.ts:6677-6678` |
| 7 | wild loop | Auto-Review classifier (Node) | `resolveWildReviewer` → `wildClassifierReview` | **partial** (bare-Node + key only) | `engine.ts:5361-5385`; `wild-mode.server.ts:459` |
| 8 | wild loop | Auto-Review classifier (browser) | `createHostWildReviewer` → server bridge | **partial** (server key required) | `wild-review.ts:138-161` → `wild-bridge.ts:59` → `wild-bridge.server.ts:40`; bound at `store.ts:1848`, `engine.ts:5380` |
| 9 | browser wild step | keyed phase edges (P6/P7/all) | `wildEdgeBridge(6/7)` / `wildPhaseEdge` as injected `p6Edge`/`liveEdge`/`livePhaseEdge` | **partial** (server key required) | `store.ts:1863-1871` → `wild-bridge.ts:89,118` → `wild-bridge.server.ts:64-88` |
| 10 | classifier approve | plan execution | `stageWildPlan(project, reviewer, {agentSeal})` | **live** | `engine.ts:5534-5620`; console passes the seal `store.ts:1918` |
| 11 | engine telemetry seeds | browser ring | `opts.onEvent` → `reportRt` | **live** | `store.ts:1949` → `rt-client.ts:310` |
| 12 | engine telemetry seeds | CLI NDJSON | `appendRtLine` into `<dir>/.rapidtool/logs` | **live** | `runtime-log.server.ts:49-56`; `run-eval.mjs:135` |
| 13 | NDJSON log | `diagnose` verb | `parseTimeline` (read-only) | **live** | `diagnose.ts:35-37`; `rt-timeline.ts:32` |
| 14 | lessons (`project.memory`) | P6 synthesis prompts | `selectLessons` → `lessonLinesForBrief` | **live** | `codegen.server.ts:7004-7007, 7103-7107, 7854-7857, 8031-8033, 8288-8290` |
| 15 | lessons (cross-project store) | P6 synthesis prompts | `provenRowsFromStore` → `--knowledge` → `deps.proven` | **partial** (explicit flag) | `rapidtool-cli.mjs:1384-1409, 1700-1715, 2059-2066`; `headless.ts:3173-3188`; `codegen.server.ts:6952` |
| 16 | crew session | project artifacts | console ingest: `runCrew` → `ingestReport` | **live (console only)** | `console.tsx:2712` → `:2746`; `report-intake.ts:321` |
| 17 | crew session | `report-intake` (the designed path) | `crewToReport` | **dead** | `crew.server.ts:1550-1566` — see §8 B-1 |
| 18 | sub-agent contract | any dispatcher | `createSubagentContract(...)` | **dead** | `subagent.ts:335`; zero non-test importers — §8 B-2 |
| 19 | swarm LLM seats | any dispatcher | `SWARM_ROLES[*].system` | **dead** | `swarm.ts:117-172`; only `swarmPlan` is reachable — §8 B-3 |
| 20 | swarm deterministic plan | CLI `swarm` verb | `headless.swarmPlan` → dynamic `import("./swarm.ts")` | **live (CLI only)** | `headless.ts:6400-6402`; `rapidtool-cli.mjs:4450-4454` |
| 21 | harvest (LLM + web search) | CLI `harvest` verb | `headless.harvest` → `harvestForPacket` | **live (CLI only)** | `headless.ts:6384-6387`; `rapidtool-cli.mjs:4420-4426` |
| 22 | iterate driver | regeneration seam | `iterateToSatisfaction(deps)` | **dead** | `iterate.ts:315`; zero callers — §8 B-4 |
| 23 | defect-repair lessons | P6 repair prompts | `selectDefectRepairLessons` | **dead** | `knowledge.ts:1358`; zero non-test callers — §8 B-5 |
| 24 | MCP client | `doctor` surface | `mcpToolsSurface()` | **live, owner-gated OFF** | `doctor.ts:1276`; gate `mcp.server.ts:58,164` |
| 25 | search seam | crew researcher / harvest | `freeWebSearch` | **live** | `crew.server.ts:32,1119`; `harvest.ts:35` |
| 26 | bounded Node runner | `verify` + `tree-run` | `runNodeBounded` (Permission Model) | **live** | `node-runner.server.ts` via `compile-check.server.ts:37`; `verify.server.ts:1066` |
| 27 | git landing | `emit --git` / self-mod | `gitLandEmitted` | **live** | `headless.ts:85`; `selfmod.server.ts:25` |

### 2a. The one line that actually decides "who works next"

It is **not** a planner, a crew and not a bus. It is the deterministic phase graph evaluated three ways:

- `engine.wildStepBody` picks the action off the phase record: `awaiting_hitl` → `wildApproveGate`
  (`engine.ts:6466-6468`), `complete` → `wildLeavePhase` or finalize (`:6470-6473`), otherwise execute
  **one** phase then leave it (`:6499-6678`).
- `phases.canEnter` is the only forward door (`swarm.ts:20-22` states this as the invariant).
- `store.startWildRun`'s `for (let step = 0; step < 20; step++)` (`store.ts:1932`) is the outer bound.

So "who works next" = `currentPhase` +1, gated by a gate result and a classifier verdict. **No seat ever
names the next seat.** The crew's router is the same idea at a different grain:
`nextRole` is explicitly *"Deterministic router — NOT an LLM call"* (`crew.server.ts:539-552`).

---

## 3. Context-assembly table — one row per LLM call site

Sites found by `Select-String 'callModel\(|completeDeepSeek\('` over `src/**` + `scripts/**` (non-test),
cross-checked against every `complete:` binding (`codegen.server.ts:6209-6210`, `crew.server.ts:1519-1520`,
`wild-mode.server.ts:464`). The DeepSeek provider's own defaults: flash `max_tokens` 1024, pro 8192
(`src/lib/llm/providers/deepseek.ts:89-90`), history turns `slice(-6)` × 4000 chars (`:559-570`).

| # | Site (file:line) | Context inputs, in order | Budget | Honest fallback |
|---|---|---|---|---|
| C-1 | **P6 spec expansion** `codegen.server.ts:7004-7011` → `prompt-engine.ts:419` | brief (≤48 000 ch) → policy lines (≤12×240 ch) → prior-run lesson lines (≤12×240 ch, FusionRank-ranked) → `project.notes` (≤240 ch) | `EXPAND_BRIEF_MAX_CHARS 48_000` (`prompt-engine.ts:90`), 12+12 caps (`:91-92,100-101`); output `maxTokens 3000` (`:376`), 90 s | no key → `not-configured` **before** network (`prompt-engine.ts:423`); non-conforming → ONE repair re-prompt then coded refusal (`:437-444`) |
| C-2 | **P6 chunk synthesis (primary)** `codegen.server.ts:2286` `p6SynthesisChunkUserPrompt` | BRIEF → REQUIREMENTS (all) → NEGATIVE CONSTRAINTS → EDGE CASES → DATA FLOW → ERROR HANDLING → DATA CONTRACTS (≤12 rows) → shared TYPE DEFINITIONS (≤40) → **per-chunk** TYPE SIGNATURES → earlier-files block (≤12 prior files: path, exports, async exports, signatures, reqTrace) → lessons (`selectLessons(project.memory, 6, 5)`) | `P6_SYNTH_PROMPT_MAX_CHARS 60_000` (`:292`); `P6_SYNTH_MODULE_MAX_CHARS 60_000` (`:186`); `P6_SYNTH_MAX_TOKENS 32_000` (`:184`); prior files ≤12 (`:275`); repo-map 1 200 ch (`:283`); contracts 12 rows (`:302`); typeDefs 40 (`:1888`) | keyless → the P6 journey is a **declared no-op passthrough** determined by `p6JourneyIsKeyed()` (`headless.ts:3278`, branch `:3989-3998`); refusal → pre-write refusal, zero files (`scaffold.ts` `underProductionRefusalOf`, per `wildmode-diagnosis.md` §4.1) |
| C-3 | **P6 repair prompts** (17 builders) `codegen.server.ts:1354-1793, 5522` | the failed chunk + the specific machine-detected defect (export binding / forbidden token / prose line / arity / JSX / money / size / truncation / ESM / param type / brief-fit) + bounded `treeFailure` tail | prompt ≤60 000 ch; attempts `P6_SYNTH_MAX_ATTEMPTS 2` (`:6117`), backoff 1 000 ms (`:6118`); typecheck repairs ≤3 chunks (`:6223`) | each class refuses coded after its bounded attempt; `verifyAndFix` is strictly subset-monotone (`AGENTS.md` 346 block) |
| C-4 | **P6 pre-dispatch spend guard** `codegen.server.ts:6164-6172` | the session ledger + cap | process session budget (`token-ledger.ts`) | `RT_E_BUDGET_EXHAUSTED`, spend kept |
| C-5 | **Oracle case generation** `verify.server.ts:1838-1857` | module `source` → `brief` → `signatureNames` (contract) → `seeds` (prepended pinned rows) | **no `maxTokens`** → provider flash default 1024 (`providers/deepseek.ts:89`); role tier `weak` (`verify.server.ts:1857`) | keyless → `not-configured` (`:1846`); unparseable → ONE retry (`:1885`) then `RT_E_VALIDATION`/`RT_E_INTERNAL` |
| C-6 | **Oracle pinned-row repair** `verify.server.ts:1916-1928` | the dropped pinned ids, verbatim | as C-5 | repair may return only missing rows; merge by id (`:1932-1936`) |
| C-7 | **Verify verdict/lesson calls** `verify.server.ts:1967, 2013, 2288` | case results + evidence anchors | as C-5 | refusal carries the class |
| C-8 | **Crew role turn (default mode)** `crew.server.ts:1107` → `buildAgentContext` (`:467-537`) | brief (≤2 400 ch) → 13-phase roadmap (≤1 200 ch) → current edge + status → **DoD gate block** (verdict + ≤4 unmet + ≤2 rejection notes, `:265-289`) → *(reviewer only)* change summary of the generated tree (≤1 500 ch, `:436-457`) → **whole pre-compiled Agent Packet cut to 14 000 ch** (`:513-517`) → prior crew artifacts (≤24, 3 000 ch, `:519-524`) → transcript window (**4 000 tokens**, `:382-410`) → role directive | prompt `maxPromptTokens 16_000` (`:475`), enforced by `enforceTokenBudget` (`:365-380`); output per role 2 048–8 192 (`ROLE_SPECS :145-153`); `maxSteps` ≤24 (`:1067`); `maxTotalTokens` 60 000 (`:1068`) | no key → `not-configured` before any dispatch (`crew.server.ts:1029-1031`); guard stops return the honest partial + `stopped` (`:1219-1230`) |
| C-9 | **Crew plan-act planner** `crew.server.ts:1277` → `planActContextFor` (`:827-851`) | brief (≤1 800 ch) → roadmap (≤900 ch) → edge + status → gate block → Agent Packet cut to **9 000 ch** | `enforceTokenBudget(..., 12_000)` (`:851`); output `maxTokens 2048` (`planning.ts:256`) | failed/not-configured plan **stops the run** — never a silent fallback to the default transcript (`crew.server.ts:1279-1292`) |
| C-10 | **Crew plan-act step turn** `crew.server.ts:1371` | as C-8 (researcher grounding headroom 2 000 + directive headroom 800, `:74,78`) + **one-step directive** (`:855`) | prompt ≤16 000; as C-8 | as C-8 |
| C-11 | **Crew closing reflection** `crew.server.ts:1459` → `planning.reflect` | goal + executed steps + session outcome summary (`:879`) | `maxTokens 2048` (`planning.ts:307`) | non-fatal: critique `null`, transcript already complete (`:1448-1450`) |
| C-12 | **Wild plan generation (planner)** `headless.ts:6579-6608` | project name + kind + `currentPhase` title + "13 phases" — **three lines, no packet, no lessons, no gate** | `maxSteps 8`; planner output 2 048 | keyless/absent → engine's honest empty plan with the reason appended to `note` (`:6619-6623`) |
| C-13 | **Auto-Review classifier** `wild-mode.server.ts:200-241` → call at `:376-379` | `Project: name` → `Domain` → **brief ≤400 ch** → phase def → review reason → *(plan mode)* ≤12 plan rows → *(phase mode)* unmet DoD criteria (**blinded** — no PASS/FAIL, `:228-230`) → phase artifacts (**≤8, 1 200 ch each, 6 000 ch total**, omission named `:139-148`) → `lastTest` ≤200 ch → ≤2 rejection notes + steering line | output **`WILD_REPLY_MAX_TOKENS 320`** (`:42`); timeout 120 000 ms (`engine.ts:5317`), ≤2 retries (`:5330`) | not-configured → `{ok:false, reason:"not-configured"}` (`:375`); approve with vacuous feedback → **error, never a rubber stamp** (`:425-441`) |
| C-14 | **Phase narrative (live layer)** `headless.ts:642-644` | 5 research findings × ~200 ch titles/content + brief ≤400 ch | **no `maxTokens`** → flash default 1024 | key IS present but call failed → coded degrade row, narrative stays empty (`:653-660`) |
| C-15 | **Grounded copilot** `chat.server.ts:580` | `buildChatContext(project)` collapsed to ≤3 200 ch (`:60,137,335`) + system prompt + ≤6 history turns ×800 ch (`:63,66`) + user text ≤4 000 ch (`:69`) | output `maxTokens 768` | keyless free-text → `not-configured`; **slash tools run keyless** (`:527-537`) |
| C-16 | **Harvest query builder** `harvest.ts:255-261` | the brief only | output `maxTokens 512` | dual-channel / failure → `{ok:false}`; keys never fabricated (`:263-275`) |
| C-17 | **`knowledge lesson --propose`** `rapidtool-cli.mjs:4834-4839` | raw evidence slice ≤2 000 ch | output `maxTokens 400` | keyless → deterministic keyword draft, labelled `mode:"keyless"` (`:4820-4823`) |
| C-18 | **`specToAlgorithm`** `algo-tools.ts:107,119` | spec + brief | provider default | **unreachable** — zero production callers (§8 B-7) |
| C-19 | **`propertyTestsFor`** `algo-tools.ts:587,603` | source + brief | provider default | **unreachable** — zero production callers (§8 B-7) |
| C-20 | **`generateLogo` / `generateIconSet`** `vector.ts:862,1022,1112` | project + brief + style | provider default (`json:true`) | **unreachable** — `vector.ts` imported only by tests (§8 B-8) |

**Starved vs flooded (the honest read).**

- **Starved:** C-12 (three lines of context to plan an entire governed run), C-14 (five search snippets
  to narrate a phase), C-13 (≤6 000 chars of artifacts to judge a phase, 320 output tokens to critique
  it — a hard cap the code itself admits can truncate the review: `wild-mode.server.ts:445-458`).
- **Flooded / coarsely cut:** C-8 dumps up to 14 000 chars of pre-compiled packet into every crew turn
  while the *transcript* that carries the agents' own prior reasoning is capped at 4 000 **tokens** and
  compressed into one-line summaries (`crew.server.ts:382-410`). The packet is a project snapshot; the
  transcript is the conversation. The budget weights them backwards for a multi-turn protocol.
- **Asymmetry worth flagging:** C-5 (oracle generation, the call whose output decides `p6-verified`) gets
  the *fewest* tokens of any P6 call — no `maxTokens` at all, i.e. the flash default 1024 — while the
  synthesis call that feeds it gets 32 000.

---

## 4. Agent / orchestration inventory

| Module | What it is | Who calls it | Does its output affect the run? |
|---|---|---|---|
| **`crew.ts`** (229 lines) | client-safe contract: typed `runCrew`/`crewStatus` over a `createServerFn` (`crew.ts:172-178,192`), plus the dual-channel fail-close (`:198-208`) | `console.tsx:39` → `:2712` (Spawn-crew button, `console.tsx:3381`); tests | **Advisory only.** The console folds artifacts back via `ingestReport` (`console.tsx:2746-2751`) → `report-intake.ts:321` → `[agent report]` artifacts in `project.artifacts`. Gates/decisions untouched. |
| **`crew.server.ts`** (1 572 lines) | the LLM orchestrator: deterministic `CREW_ROLE_BY_PHASE` table (`:164-178`), 6 personas (`:94-117`), one DeepSeek call per turn (`:1155`), `plan-act` mode (plan → step per row → reflect, `:1248-1509`) | `crew.ts` serverFn; `headless.runCrew` (`headless.ts:5177-5182`) → CLI `crew` (`rapidtool-cli.mjs:4114-4173`) | Advisory. CLI prints only (`:4163-4172`). Session never persisted. |
| **`crewToReport`** `crew.server.ts:1555` | the *designed* ingest bridge: session → `AgentReport` for `report-intake` | **nobody** (its own TODO at `:1550-1554` admits "zero code consumers… wire or de-scope") | **None.** §8 B-1 |
| **`swarm.ts`** (1 037 lines) | 5 seat specs (`:117-172`) + a **pure** deterministic critique pass (`swarmPlan`, `:701`) — no I/O, no dispatch by construction (`:10-18`) | `headless.swarmPlan` (`:6400`) → CLI `swarm` (`rapidtool-cli.mjs:4450`). **Not** called by engine, store, or console | **None on a run.** Deterministic text; the module's own footer says "no LLM turn was dispatched" (`swarm.ts:479`). The **seat prompts** (`SWARM_ROLES[*].system`/`prompt`) are data with no dispatcher — §8 B-3 |
| **`subagent.ts`** (641 lines) | claim-lifecycle contract: coded caps, per-task budget, append-only ledger (`:13-50`) | **nobody.** Header self-declares "STATUS: DE-SCOPED FOR THIS WAVE" + `TODO(R13-f14)` (`:38-51`) | **None.** §8 B-2 |
| **`handoff.ts`** (263 lines) | pure prompt compiler: `phaseHandoff(project, phase)` builds a paste-ready per-phase prompt from prior artifacts + DoD + constraints + provenance (`:80-261`) | `console.tsx:2806` only (a copy button). `console.tsx:2980` records "no CLI verb today" | **None on a run.** A human copies the text into an external agent. |
| **`wild-review.ts`** (163 lines) | reviewer resolution seam: Node (`:86`) vs host bridge (`:138`) | `engine.ts:5380`; `store.ts:1848` | **Yes** — it is the reviewer the wild loop uses. |
| **`wild-bridge.ts` / `wild-bridge.server.ts`** | the browser→server transport for plan/classifier/phase-edge (`wild-bridge.ts:26-119`; `wild-bridge.server.ts:29-88`) | `store.ts:51,1858-1871` | **Yes** — on the console host only; keyless → honest floor + coded warn row (`wild-bridge.ts:104-111`). |
| **`wild-mode.server.ts`** (465 lines) | the Auto-Review classifier: prompt (`:200-241`), parser (`:247-279`), vacuity guard (`:335-355`), dispatch (`:363-459`) | via `engine.resolveWildReviewer` only | **Yes** — a classifier approve/reject decides whether the loop leaves a phase (`engine.ts:5743+`, `:5961+`). |
| **`engine.ts` wild paths** (the wild step/leave/pause portion of the file) | `wildStep`/`wildStepBody` (`:6299`, `:6320`), `resolveWildReview` (`:5404`), `stageWildPlan` (`:5534`), `wildApproveGate` (`:5743`), `wildLeavePhase` (`:5961`), `wildFinalize` (`:6117`), browser `wildPause` (`:5176`) | `store.ts:1942`; `headless.wildStartRun`/`wildStartHeadless`; CLI `wild` (`rapidtool-cli.mjs:5399`) | **Yes** — this IS the orchestration loop. |
| **`store.ts` driver** | `startWildRun`: probe key → reviewer → plan attach → `stageWildPlan` → 20-step loop → commit each step (`:1848-1985`) | the console Wild toggle (`RUNBOOK.md:105-111`) | **Yes** on the console host. |

**Verdict on ask #1.** The delegation chain is wired end-to-end **as a phase loop with a classifier
referee**, and it stops exactly at bookkeeping **the moment a seat is supposed to hand work to another
seat**: `crewToReport` has no consumer, `subagent` has no dispatcher, `swarm`'s seats have no driver.
There is no code path in which one agent's output *causes another named agent to be scheduled*. The only
"who next" decisions are `currentPhase + 1` and `roles[idx + 1]` inside a single crew run.

---

## 5. Tool-use inventory

### 5a. Does any seat choose a tool? **No.** Refutation of the function-calling hypothesis

- **The provider never sends `tools`.** `deepseek.ts:578-604` builds the request body as
  `{model, messages, thinking, max_tokens, [temperature], [seed], [response_format]}` — verified by reading
  the literal. `openai-compatible.ts:480-493` likewise. Query:
  `Select-String -Path src\lib\llm\providers\deepseek.ts,src\lib\llm\providers\openai-compatible.ts -Pattern 'tool_choice|tool_calls:|\btools:'` → **0 matches**.
- **No call site parses a tool call.** Repo-wide: `Select-String 'tool_calls'` finds only
  `deepseek.ts:149,158,167` (a `finish_reason` union member + its switch arm) and the taxonomy test.
  There is no `message.tool_calls` read anywhere.
- **No call site can even *receive* one usefully.** `LlmResult` carries `text`, `usage`, `model` — the
  provider drops `finish_reason` on the success arm except for the empty-content refusal
  (`wild-mode.server.ts:445-448` records this explicitly).
- **The one "tool" surface in chat is user-selected, not model-selected.** `CHAT_TOOLS`
  (`chat.server.ts:373`) is parsed out of the *user's* message text by `parseChatTool` and runs keyless in
  the host (`chat.server.ts:527-537`). The model never picks one.

**Conclusion: `research/deepseek-api.md` §4e (function calling live-verified) is correct about the API and
irrelevant to this product — the feature is unused. Confirmed, not refuted.**

### 5b. Every tool a pipeline seat can *reach* (host-side, model output merely *triggers* it)

| Tool | Reached from | Bound |
|---|---|---|
| **Bounded Node runner** — `runCode` / `runNodeBounded` | `engine.ts:76`; `compile-check.server.ts:37` (tree-run); `verify.server.ts:1066` (verdict channel) | `isolation:"strict"` = Node Permission Model: fs writes confined to a scratch dir, `child_process`/`worker_threads`/native addons denied, 512 MB heap; **not an OS sandbox, no network denial** (`AGENTS.md` 346 block; `doctor` keeps `isolation.sandbox:false`) |
| **Search seam** — `freeWebSearch` | `crew.server.ts:32,1119` (researcher grounding); `harvest.ts:35` | findings marked UNTRUSTED (`crew.server.ts:99-101`) |
| **Vault reader** — `buildVaultNotes`/`searchVault` | `headless.ts:2386,2401,5146`; `console.tsx:5351` | read-only projection of project state; no writer |
| **Knowledge store** — `KnowledgeStore.findPatterns` / `provenRowsFromStore` | `headless.ts:6550`; `rapidtool-cli.mjs:1395,2520` | file-scoped JSON; append-only; corrupt file → coded refusal, never overwrite (`knowledge.ts:471-491`) |
| **Git** — `gitLandEmitted` / `runBoundedChild` | `headless.ts:85`; `selfmod.server.ts:25` | host repo structurally un-landable; `emit --run --git` re-verifies first (`AGENTS.md` 354 block) |
| **MCP client** — `tools/list` + restricted `tools/call` | `doctor.ts:1276` | **owner-gated OFF**: `RAPIDTOOL_MCP_ENABLED` (`mcp.server.ts:58,164`); a tool must have been *listed* by that server (`:486`) |
| **fs writers** — `scaffoldProject`, `write-set.ts` | `headless.ts:2836`; `codegen.server.ts:6287` | staged atomic batch + lock (`write-set.ts:173-177`) |
| **Checkpoint** — read/write `.rapidtool/checkpoint.json` | `headless.ts:73` | bounded, versioned, atomic, corrupt-safe |

**No seat is offered this list.** Every one of these is invoked by host code at a place the *pipeline*
decides, never by a model turn. That is the precise gap for ask #4: the tool layer is real and bounded;
the *tool-selection* layer does not exist.

---

## 6. Learning / memory inventory — writers and, decisively, **readers**

### 6a. Store A · `project.memory` (MemoryEntry rows inside the project JSON)

**Writers**

| Writer | Where | What it mints |
|---|---|---|
| `engine.synthesizePhase` P0 | `engine.ts:934-940` (helper `mem` at `:900-914`) | L1 vague-brief lesson when the lattice sealed vague/empty **and** nouns are absent |
| `engine.rejectHitl` | `engine.ts:2376` | L5 `correctionLesson` — **only** when `decision.decidedBy === "human"` (`:2374`) |
| `engine.applyPhaseResult` | `engine.ts:1910` | merges + dedupes + accrues `reproducedCount`, FIFO-sliced to **80 rows** |
| `report-intake.applyReportResult` | `report-intake.ts:405-413, 441-477` | `[agent report]` memory rows + an L2 `templateEmissionLesson`, gated by `failureLessonFromRecord` (anchor required, `:393-397`) |
| `verify.server.ts` → `verify.ts` | mint at `verify.server.ts:2086` (`failureLessonFromRecord`) / `:2228` (`verifyOutcomeLesson`); **persisted by the caller** at `verify.ts:359-375` (`applyVerifyOutcome` appends `outcome.lesson` to `project.memory`, idempotent, accrues `reproducedCount`) | verify failure / verified-procedure rows |
| `headless.ts` (terminal run paths) | `headless.ts:1655-1678` (`templateEmissionLesson` for a **refused keyed P6**), `:1707-1721` (`runSummaryLesson` at `complete`) | keyed-refusal + run-summary rows |
| `harvest.ts` | `harvest.ts:821` (`lessonRow`) | harvest-derived rows |
| **`engine.applyPhaseResult` red-gate path** | `engine.ts:1929-1960` | **deliberately mints nothing here** — a red gate on the deterministic path writes one `p<phase>.seal.unmet` **log row** instead. `knowledge.ts:1928-1931` confirms the mute is structural. (A *refusal* on the keyed path is a different writer — see the `headless.ts` row above.) |

**Readers — this is the loop's live half**

| Reader | Where | Reads it into |
|---|---|---|
| `codegen.selectLessons → lessonLinesForBrief` | `codegen.server.ts:7006, 7105, 7856, 8033, 8290` | the **P6 expansion prompt** (C-1) and the **P6 synthesis/repair prompts** (C-2, C-3) |
| `engine.lessonSurface.lessonLinesForBrief` | `engine.ts:1038-1043` | the **P0 reframe HITL prompt** |
| `engine.lessonSteeringBlock` | `engine.ts:1830`, called `:1878` | appends the "answers your rejection" block to a regenerated phase artifact |
| `packet.compileAgentPacket` | `packet.ts:787` (memory rows in the Ranked-memory section) | the Agent Packet that *every* consumer reads |
| `vault.buildVaultNotes` | `vault.ts:255` | a read-only note view (console + CLI) |
| `report-intake` | `report-intake.ts:310` | idempotency check on re-ingest |
| CLI `lesson --list/--effect` | `rapidtool-cli.mjs:4700-4713, 4775` | an operator read-out (read-only; `:4781 readOnly:true`) |

**Store A verdict: this is a genuinely closed in-project loop — and the closure has one measured-shaped
hole.** Four of the five writers *do* feed a reader: a human reject (`engine.ts:2376`), an agent report
(`report-intake.ts:405`), a verify outcome (`verify.ts:366-375`) and a **refused keyed P6**
(`headless.ts:1655-1678`) all write rows that a later P6 prompt ranks through `selectLessons`. The hole is
the path the campaign's measured wall actually sits on: on the **deterministic/floor** path a red gate
mints no lesson — `engine.applyPhaseResult` writes a `p<phase>.seal.unmet` **log row**
(`engine.ts:1929-1960`, corroborated by `knowledge.ts:1928-1931`), and log rows are not lesson-tagged, so
`selectLessons` (`knowledge.ts:1249-1252`) can never see them. `fixes/353_validation_wave.md:72-79`'s
6/10-below-floor / 0/10-product-quality sample is therefore only *partially* visible to the loop: the
keyed-refusal half mints, the floor half does not.

### 6b. Store B · the cross-project `KnowledgeStore` (a JSON file the operator names)

**Writers — every one is a human CLI act**

`rapidtool-cli.mjs:4908` (`lesson --accept` → `store.savePattern(acceptedLessonEntry(...))`),
`:4958` (`knowledge --save`), `:4969` (`--supersede`), `:5115`/`:5249`/`:5356` (the store telemetry arms).
The CLI's own comment at `:4882-4884` states the doctrine: *"there is no machine path that appends to the
store."* `KnowledgeStore.savePattern` additionally eval-gates lesson rows (`knowledge.ts:533-546`).

**Readers**

`knowledge.ts:170` `provenRowsFromStore` ← `rapidtool-cli.mjs:1384-1409` `resolveProvenRows` (requires an
explicit `--knowledge <store.json>`; absent flag ⇒ `{present:false}`) ← the `run` / `gate` / `unattended` /
`packet` verbs only (`rapidtool-cli.mjs:1700, 2059, 2520`). `KnowledgeStore.findPatterns` ← CLI
`knowledge` verb (`headless.ts:6550`).

**Store B verdict: a two-flag loop (one to promote, one to consume) that is entirely manual.** The
console never supplies `proven` (no `store.ts` reference to it exists), so a console-driven run can never
receive a cross-project lesson even when the store is full.

### 6c. The eval side — where the loop visibly opens

- `scripts/run-eval.mjs` scores each trial and writes the **tracked** docs `research/eval-out/results.json`
  and `history.json`. It records the iterate driver's *decision* only (`run-eval.mjs:2618-2651,
  2492-2494`).
- Those docs are read by `src/lib/scorecard.ts` (a read-only scorecard, `scorecard.ts:95-330`) and by
  `maker-score.m7Learning`'s prior (`maker-score.ts:697-720`). **Neither feeds a prompt, a memory row, or
  the store.**
- Nothing reads `results.json` / `history.json` back into `project.memory` or `KnowledgeStore`. Query:
  `Select-String -Pattern 'eval-out|results\.json|history\.json'` over `src/**` + `scripts/**` (non-test)
  returns only `scorecard.ts`, `run-eval.mjs`, `rapidtool-cli.mjs`, and code-comment citations of emitted
  trees.

**The measured improvement loop is open at four places:** (i) a red *gate on the deterministic path* mints
no lesson (the keyed-refusal path does); (ii) promotion to the cross-project store requires a human;
(iii) consumption requires a manual flag; (iv) the automatic regeneration driver
(`iterateToSatisfaction`) has no caller at all.

---

## 7. Capability-gap map — the five asks

| # | Ask | State | Evidence | Smallest honest step that would advance it | Wave |
|---|---|---|---|---|---|
| **1** | **Orchestration & delegation** — which module decides "who works on what next" | **partial** | The chain *is* wired as a phase loop: `store.ts:1932` → `engine.ts:6320` → `dod.recordGateInto` (`dod.ts:1951`) → classifier (`wild-mode.server.ts:376`) → `wildLeavePhase` (`engine.ts:5961`). What stops: **no seat schedules another seat.** `crewToReport` dead (`crew.server.ts:1550-1555`), `subagent` unscheduled (`subagent.ts:335`), swarm seats undriven (`swarm.ts:117`). Role routing is explicitly non-LLM (`crew.server.ts:539`) | Wire **one** real delegation edge end-to-end and prove it changes the run: the R13-f14 plan already written in `subagent.ts:44-50` (call `createSubagentContract` from a read-only parallel stage with a ledgered merge) | W4+ (its own lane; needs the budget/invest seam it names) |
| **2** | **A message bus per project** | **absent** | Query: `Select-String -Pattern 'messageBus|MessageBus|inbox|mailbox|pubsub|messageQueue|\boutbox\b'` over `src/**` (non-test) → **0 matches**. `RtEvent` is one-way, redacted, `capture` "never parsed" (`rt-events.ts:85`), budgeted to ≤8 flat keys ≤160 chars (`:12-15`) — **a message cannot physically fit**. `crew` raises the only shared log and it is an in-memory `CrewSession.messages` that dies with the run (`crew.ts:64-88`); `subagent.rows()` is per-call bookkeeping (`subagent.ts:114-129`). `.rapidtool/logs/*.ndjson` is per-directory, appended by the *host*, read only by `diagnose`/timeline | Specify the contract first: a `ProjectMessage {id, from, to, kind, body, evidenceRef, at}` row appended to a per-project led at `<dir>/.rapidtool/bus.ndjson`, with ONE declared consumer. **Consumer is the open question** — the only seat that could act is the wild classifier/planner, which today reads `project` state, not a channel | W4 (bus lane) |
| **3** | **Insight / context use per seat** | **partial (measured)** | §3 is the table: 20 rows — 17 with a live call path (several reachable only from a CLI verb) and 3 unreachable seams (C-18…C-20). Rich where it is keyed (C-2: 60 000 chars / 32 000 tokens); starved where the seat must *judge* (C-13: 6 000 chars in, 320 tokens out; C-12: 3 lines of context; C-14: 5 snippets). The P6→verify asymmetry (C-2 vs C-5) is a real budget inversion | Give the judge calls a budget commensurate with their verdict's blast radius: raise `WILD_REPLY_MAX_TOKENS` (320, `wild-mode.server.ts:42`) and give `generateCases` an explicit `maxTokens` (currently unset, `verify.server.ts:1857`) | W4 `context` lane |
| **4** | **Tool use / tool knowledge** | **absent (selection); real (execution)** | §5. `tools`/`tool_choice` = **0 matches** in both provider bodies; the only `tool_calls` token is a `finish_reason` enum member. Execution-side tools are real and bounded (runner, search, vault, knowledge, git, MCP-gated). `algo-tools`' and `vector.ts`' LLM seams are unreachable | Publish the tool list the host already owns as a *typed catalogue* (`{name, describe, invoke}`) and pass it to **one** seat — the coder — behind a bounded loop with the existing `node-runner` bounds. Do not start with a general agent loop | W4 (tools lane) |
| **5** | **Learning loop & memory** | **partial; open at the join** | §6. Reads and writes both exist and are pinned (8 writer sites, 5 codegen read sites). Open at: a red *gate* on the deterministic path mints nothing while the keyed-refusal path does (`engine.ts:1929-1960` vs `headless.ts:1655-1678`); promotion is human-only (`rapidtool-cli.mjs:4882-4884`); consumption needs `--knowledge` (`rapidtool-cli.mjs:1385`); `iterateToSatisfaction` has **zero callers** (`iterate.ts:315`); the whole defect→repair loop has **zero callers** (`knowledge.ts:1358`) | Make the **failure** path mint on *every* failure mode: one content-addressed lesson row on a red P6 gate keyed by the coded defect class the tree-run already reports — the `headless.ts:1655-1678` pattern, moved to where `engine.applyPhaseResult` records the unmet gate. One writer, one existing reader, no new store | W4 (memory lane) |

**Does anything read what is written? — the decisive answer, item by item.**

| Written thing | Read by a seat? | Evidence |
|---|---|---|
| `project.memory` lesson rows | **YES** — 5 P6 prompt sites + 2 engine sites | `codegen.server.ts:7006,7105,7856,8033,8290`; `engine.ts:1038,1878` |
| cross-project `KnowledgeStore` rows | **YES, if `--knowledge` is passed** | `rapidtool-cli.mjs:1395` → `headless.ts:3173` → `codegen.server.ts:6952` |
| `research/eval-out/results.json` / `history.json` | **NO** — read only by a read-only scorecard + a rubric prior | `scorecard.ts:95`; `maker-score.ts:697` |
| the telemetry ring / NDJSON log | **NO** — read only by UI + `diagnose` | `rt-client.ts:310`; `diagnose.ts:35` |
| `p<phase>.seal.unmet` log rows | **NO** — not lesson-tagged, structurally excluded from the census | `knowledge.ts:1928-1931` |
| defect-repair lesson rows | **NO** — nothing calls the selector | `knowledge.ts:1358`; §8 B-5 |
| `driftLesson` rows | **NO** — the builder itself has no caller | `knowledge.ts:1725`; §8 B-5 |
| `subagent` ledger rows | **NO** — no contract is ever constructed | `subagent.ts:335`; §8 B-2 |

---

## 8. New-bug map — architecture-level defects

Each item: **what is wrong → `file:line` → the command that shows it.**

### B-1 · A declared seam with no consumer (writer with no reader)
`crewToReport` collapses a finished crew session into an `AgentReport` for `report-intake` — the module's
own header calls it *"the designed ingest bridge"*. It is referenced nowhere in the product.
- `crew.server.ts:1555` (definition), `:1550-1554` (`TODO(F2-09): zero code consumers`).
- Command: `Get-ChildItem -Recurse -Include *.ts,*.tsx,*.mjs -Path src,scripts | Where-Object { $_.Name -notmatch '\.test\.' } | Select-String -Pattern 'crewToReport'` → **1 match, the definition itself**. Zero call sites.
- Consequence: the console hand-rolls the ingest (`console.tsx:2746-2751`) with a *different* shape
  (a 400-char summary + artifacts) than `crewToReport` produces, so the two paths can drift.

### B-2 · An orchestration contract with no driver (claim of capability, no caller)
`subagent.ts` implements a full claim lifecycle, coded caps, per-task budget and an append-only ledger.
No production code constructs one.
- `subagent.ts:335` `createSubagentContract`; self-declared de-scope at `:38-51`.
- Command: same filter, `-Pattern 'from "\./subagent\.ts"'` → **0 matches** (repo-wide non-test).
- The comment claims the contract "already satisfies what they will consume" — true, and irrelevant until
  a caller exists. This is the load-bearing item under ask #1.

### B-3 · Seats declared, never dispatched (autonomy claim with no driver)
`SWARM_ROLES` defines five specialists with ROLE_SPECS-compatible system prompts, per-turn directives and
token budgets — "the protocol surface swarm seats **may** emit on". Nothing dispatches them. Only the
*deterministic* `swarmPlan` is reachable, and only from a CLI verb.
- `swarm.ts:117-172` (specs), `:90` ("advisory here — swarm.ts itself never dispatches"),
  `:260` ("Always false: this module never dispatches real LLM seats").
- Command: `-Pattern 'from "\./swarm\.ts"'` (non-test) → **0 matches**; the one real reach is a dynamic
  import: `headless.ts:6401` `await import("./swarm.ts")` inside `swarmPlan`, exposed by
  `rapidtool-cli.mjs:4450` only.
- Consequence: `SWARM_ROLES[*].system` / `.prompt` / `.emit` / `.budgetTokens` are **dead data** — a
  prompt catalogue with no dispatcher.

### B-4 · The bounded improvement driver has no caller
`iterateToSatisfaction` is the re-entry driver: score below threshold → bounded regeneration → re-score.
It is env-armed (`RAPIDTOOL_ITERATE_THRESHOLD`, `iterate.ts:47`) and its decision logic is fully tested.
- `iterate.ts:315` (definition).
- Command: `-Pattern 'iterateToSatisfaction'` (non-test) → **1 match, the definition**.
- What *is* wired is the pure decision, recorded by the eval harness only (`run-eval.mjs:2635`,
  `iterate.ts:204`). So the repo can **measure** that a run fell below threshold and can **decide** to
  regenerate — and nothing performs the regeneration. This is the missing middle of ask #5.

### B-5 · An entire learning loop with no caller on either side
The W61 C7/I5 "defect→repair learning loop" is six symbols: `defectClassOf`, `defectRepairLesson`,
`selectDefectRepairLessons`, `applyLessonDemotion`, `DEFECT_REPAIR_CLASS`, `defectTag`. Its header claims
*"selectDefectRepairLessons feeds the matching rows into the next run's synthesis/repair prompts"*.
- `knowledge.ts:1265-1271` (the claim), `:1300`, `:1332`, `:1358`, `:1385`.
- Command: `Get-ChildItem -Recurse -Include *.ts,*.tsx,*.mjs -Path src,scripts | Select-String -Pattern 'defectRepairLesson|selectDefectRepairLessons|applyLessonDemotion|defectClassOf|DEFECT_REPAIR_CLASS'`
  → matches only `knowledge.ts` + `knowledge.test.ts`. **Zero production callers.**
- Same class, second instance: `driftLesson` (`knowledge.ts:1725`) is a lesson writer with no writer —
  its own comment at `:1876` says "its owning writer must call driftLesson directly"; the query above
  shows no such caller.
- Consequence: the class-keyed remediation knowledge the repo can *derive* from its own TS error codes
  never reaches a prompt.

### B-6 · A lazy module surface that can silently drop a write (race)
`engine.ts:141-153` populates `lessonSurface` from `void import("./knowledge.ts").then(...)`. Every read
is guarded (`&& lessonSurface`), so a caller that runs before the promise resolves **skips the lesson
mint with no error and no log**.
- `engine.ts:141-153` (init), `:934-940` (P0 mint guarded), `:2376` (reject mint guarded).
- Command: `Select-String -Path src\lib\engine.ts -Pattern 'lessonSurface'` → the one lazy init plus the
  guarded reads (`:938`, `:1038-1040`) and the guarded writer (`:2376`).
- Severity is bounded (module import is fast, and the P6 prompt path uses the *static* import at
  `codegen.server.ts:136`), but the failure mode is the worst kind for a learning loop: a dropped write
  that looks like "no lesson was needed". A `await`-once accessor, or a static type-only + lazy-value
  split, closes it.

### B-7 · Unreachable LLM seams in `algo-tools.ts`
`specToAlgorithm` (`:107`, calls the model at `:119`) and `propertyTestsFor` (`:587,603`) are
model-backed features with zero production callers; only the pure helper `exportedNamesOf` is consumed
(`codegen.server.ts:126`).
- Command: `Select-String -Pattern 'specToAlgorithm|propertyTestsFor'` (non-test) → 4 matches: two
  header comments (`:23,25`) and the two definitions. Zero call sites.

### B-8 · An unreachable module whose LLM path is real
`vector.ts` (1 100+ lines) contains two keyed generators (`generateLogo :1022`, `generateIconSet :1112`)
that reach the provider at `:862`. The module has **no non-test importer** — `design.ts` is used by
`console.tsx:85`, but `vector.ts` is not.
- Command: `-Pattern 'from "\./vector\.ts"'` (non-test) → **0 matches**.

### B-9 · Two memory stores, no bridge, and the default path reads neither cross-project store
Store A (`project.memory`, in the project JSON) and Store B (`KnowledgeStore`, a separate file) share no
sync. Promotion A→B is human-only (`rapidtool-cli.mjs:4882-4884`), and consumption B→prompt needs
`--knowledge` (`rapidtool-cli.mjs:1385`). The console supplies neither.
- Command: `Select-String -Path src\lib\store.ts -Pattern 'proven|knowledge'` → **4 matches, all the word
  "provenance"** (`:43,2496,2527,2562` — seat-provenance comments); **zero** references to a
  cross-project lesson row or a `KnowledgeStore`. The only memory touchpoint in the UI is the read-only
  project-memory view.
- Consequence: a browser-driven run can never read a cross-project lesson, so a console user's runs are
  structurally amnesiac even with a populated store on disk.

### B-10 · The judge that decides phase progress has the tightest output budget in the system
The Auto-Review classifier decides whether the loop may leave a phase, yet its reply is capped at **320
tokens** while the code itself warns that a capped reply may be cut (`wild-mode.server.ts:42,445-458`) —
and a cut reply is *still* accepted as a verdict, only annotated with a truncation marker.
- `wild-mode.server.ts:42` (`WILD_REPLY_MAX_TOKENS = 320`), `:379` (the call), `:445-458` (cap detection).
- Command: `Select-String -Path src\lib\wild-mode.server.ts -Pattern 'WILD_REPLY_MAX_TOKENS'`.
- Compare C-2 (synthesis, the thing being judged) at 32 000 tokens: the system spends 100× more tokens
  generating than judging. That imbalance is a plausible contributor to the measured variance
  (`fixes/353_validation_wave.md:130-140`).

### B-11 · Verified **not** a bug: the loops are bounded
Checked because an unbounded loop is a classic architecture defect. All bounds are real:
`store.ts:1932` (20 wild steps) · `crew.server.ts:1067-1068` (24 steps / 60 000 tokens) ·
`crew.server.ts:368` (`for i < 32` in the token cutter) · `engine.ts:5330` (≤2 classifier retries) ·
`codegen.server.ts:6117` (2 synthesis attempts) · `iterate.ts:51` (≤2 cycles) ·
`node-runner.server.ts` (timeout + heap cap). No unbounded retry loop found.

### B-12 · Verified **not** a dependency inversion: the engine never imports upward
`Select-String '^import .*from "\./.*\.server\.ts"'` over `src/**` (non-test) returns **38 rows**; reading
them shows only type-only imports from the engine side (`engine.ts:55`) and same-layer server→server
edges. The two real hazards are the **naming** problems in §1a items (1) and (3) — modules whose names
imply purity but which statically touch `node:fs` / the provider.

---

## 9. What I could not determine

1. **Whether the 354-wave dirty tree's two keyed-RED assertions actually break any module on this map.**
   I did not run `npx tsc --noEmit` (out of scope per the lane brief). If one of the 5 errors lands in
   `engine.ts`/`codegen.server.ts`/`store.ts`, the *line numbers* in this map still hold (they are read
   from the bytes on disk), but a type-level break could mean a seam below does not execute at runtime.
2. **The console's live Wild behavior in a browser.** I read `store.startWildRun` → `wild-bridge` →
   `wild-bridge.server.ts` and the classifier, but I could not exercise a browser host. `fixes/353`'s
   numbers all come from the in-process headless driver, not the console path — so the console's
   end-to-end classifier reach is *read*, not *measured*, here.
3. **The real prompt sizes at runtime.** Every budget cited in §3 is a **cap** from the bytes. How close a
   real keyed run gets to `P6_SYNTH_PROMPT_MAX_CHARS 60_000` or to the 14 000-char packet cut in
   `buildAgentContext` is not measured in this lane (that would need a keyed run, which I did not make).
4. **Whether the `lessonSurface` race (§8 B-6) has ever actually fired.** The guard makes it silent, so
   there is no log row to count. I can prove the mechanism is present; I cannot prove it has bitten.
5. **Whether `RtEvent`'s ≤8-key/≤160-char `ctx` budget is load-bearing for the ring's 64 KB bound** — I
   read the bound (`rt-ring.ts:8-10`) and the redaction rule (`rt-events.ts:12-15,89-90`) but did not
   measure a saturated ring.
6. **The intent behind the unreachable seams.** `subagent.ts`, `swarm.ts`'s seats, `iterate.ts` and the
   defect-repair loop may be deliberately parked owner decisions (the first two say so in their headers;
   the latter two do not). I report them as unreachable-by-bytes, not as abandoned-by-intent.
7. **`fixes/353_validation_wave.md`'s per-brief token figures** are quoted as that lane's measurements; I
   did not re-derive them, and the wave is explicitly a moving-tree snapshot.
