# 86 — Verdict: Team Kanban (RapidTool-produced) vs Planka/Wekan + WHY + Self-Learning Design

## 1. What the makers actually produced (evidence)

- Maker delegation `deleg_9bd5d956` task-0 completed; its log ends 13:00:30 with an **honest stop at the iteration cap** ("Hit the iteration cap mid-probe… Verify PASSED on iteration 1… BUG FOUND #1: `deepen` crashes RT_E_INTERNAL… Finding #2: P6 stored gate stays passed:false after a PASSED apply… Wild P12 path calls recordGateInto but never re-stamps the packet") — those fixes did **not** land because the cap hit.
- Final project record (`rapidtool-make-1/team-kanban.json`, 92 KB): `brief: "a team kanban board web app with drag-and-drop columns, task cards, and localStorage persistence"`, `status: complete`, **all 13 phases `complete`**, `modelRoute: "deterministic"`, 50 artifacts, 18 memory rows, 15 live research items.
- **The 50 artifacts are 100% engine-template prose about RapidTool itself, not a kanban product:** "Dispatcher topology" (`engine.ts:353`), "Isolation policy" (`engine.ts:437`), "Adversarial suite" (`:470`), P6 "Typed synthesis module" (`:528`), "Competitive analysis matrix" claiming "Generators ship UI fast; RapidTool ships a governed lifecycle" (`:569`), "Interface contract" (`:589`), "GitHub Actions workflow" (`:614`), "Tiered inference" (`:659`), "Live search MCP binding" (`:677`), "Architecture Decision Records" (`:746`), "OpenAPI 3.1" (`:747`). Every body hardcodes a description of RapidTool's own orchestration (cgroups, LiteLLM, HITL ≥12 chars, MCP WebSockets) with only the project *name/domain* interpolated.
- **Memory (18 rows) contains zero kanban facts.** All rows are pipeline meta-memory: "HITL reject requires a written reason", "Generated code executes air-gapped inside the isolate", "State transition validation wraps every transfer_to_agent". The grounded chat honestly refused to answer a kanban question: *"The project context … does not contain any decision about drag-and-drop persistence for Team Kanban"* (`28-chat.json`).
- **The schema is generic fallback garbage:** contracts = entities `Operator`, `Record`, `DeliverCoreWorkflow`, each `{id: ulid, status: enum, updatedAt: datetime}`; lattice = jobs `["deliver-core-workflow"]`, entities `["operator","record"]`, `vague: true`; OpenAPI = one `POST /v1/deliver-core-workflow`; oracle = 2 rows about the *pipeline job* ("Authorized operator submits deliver-core-workflow…", "Agent requests P9 while P4 is open"). Nothing names board/column/card/list.
- **I re-emitted the scaffold deterministically (read-only, into TEMP):** 12 files, 107,930 bytes: `src/domain/custom_software.ts` (3 generic interfaces), `src/api/routes.ts` (`route()` literally `throw new Error("TODO(E-15 stub): implement POST /v1/deliver-core-workflow")`), `src/state/store.ts` (generic `CheckpointStore` map), `src/jobs/deliver_core_workflow.ts` (hosts the 42-line P6 `synthesize(spec)` module verbatim), `src/ui/console.tsx` (React shell whose body is `"shell — implement the P8 interface-contract surfaces…"`), `tests/oracle.spec.ts` (**2 TODO stubs pinned to the generic oracle rows**), README/DEPLOY/.env/package/tsconfig/project.json.
- So: **no file anywhere implements drag-and-drop, columns, cards, or localStorage** — the three things the brief names.
- What *was* good: real live web research (3 stored corpus entries, provider duckduckgo, 5 items each, honest `meta.liveUnavailable` handling — `engine.ts:1654+`), real DeepSeek phase narratives with honesty footers, a machine-run P6 verify that genuinely executed the module in an isolate ("6/6 machine-run cases passed on iteration 1" `12-verify-apply.json`), a **real design-token system** (palette/typography/spacing/radius/shadows with WCAG-AA contrast pairs, `13-design.json`), 3 SVGs, a 50-note deterministic vault, ADRs, and extremely honest scaffold boundaries ("The machine-verified core is the generated P6 module… everything else is a typed stub awaiting implementation", `scaffold.ts:806`).
- Also notable: the **`prompt` verb separately produced an excellent exhaustive spec** (`20-prompt.json`: 12 concrete requirements incl. "Implement drag-and-drop… using HTML5", "Persist… to localStorage after every mutating operation", plus edge cases for quota/malformed JSON/schema drift) — **but nothing wired that spec into code generation.** The single best artifact of the run was never used to build.

## 2. Competitor benchmark (evidence from GitHub API + trees, 2026-09-06)

**Reference choice:** Planka (the direct modern Trello-style competitor, 12,513★, 1,381 forks, pushed 2026-09-02) benchmarked primarily; **Wekan** as the true-OSS/MIT reference (21,073★, 3,002 forks, MIT, pushed 2026-09-06 — active *today*, 3876 blobs, ~1,144 test files, 73 Playwright e2e, 234 languages). Focalboard has the most stars (26,447★) but was transferred out of Mattermost's org — don't use it as a clean reference.

**Planka signals:** 1,607 blobs; server (Sails/Node, ~30 model dirs: `Board/Card/List/Comment/Label/Task…` in `server/api`); client (React + Redux-saga: `actions/api/components/reducers/sagas/selectors/models`); 6 GitHub Actions incl. `build-and-test.yml`, `lint.yml`; server mocha tests + client cucumber acceptance tests; README features: real-time sync, markdown, 100+ notification providers, multi-language; caveats: fair-code license (not OSI-OSS), plain JS with no TS.

## 3. Honest scorecard

| Axis | Team Kanban (RapidTool out) | Planka | Wekan | Key evidence for the produced app |
|---|---|---|---|---|
| Architecture | **2.5** | 9 | 8.5 | Typed, deterministic, clean stub layout — but generic; zero kanban domain model (no card/board/column types anywhere in emitted tree) |
| Feature completeness | **0** | 9 | 8 | Drag-drop/columns/cards/localStorage appear in `20-prompt.json` spec only; `src/ui/console.tsx` prints a "shell" notice; `route()` throws TODO |
| Code quality | **4** | 6.5 | 6 | Valid strict TS, clean headers, deterministic; but ~90% of emitted src is TODO stubs or verbatim 42-line module; `var in` P6 module flagged by own linter ("no-var x3") |
| Tests | **1.5** | 6 | 9 | Only 2 `todo:true` oracle stubs + P6 sandbox self-test; no feature test exists (impossible — no feature code) |
| Docs | **6** | 8 | 6.5 | Genuinely honest, well-stamped README/DEPLOY/ADR/vault/design system — but they document the *pipeline*, not how a user uses a kanban board |
| UX | **1** | 9 | 7 | No runnable UI at all; only a design-token preview (`out/design.html`) |
| **Overall** | **≈2.2** | **≈7.9** | **≈7.5** | Verdict: RapidTool shipped a governed **spec record + scaffold skeleton**, **not** the kanban web app the brief requested |

Every "0" is traceable: grep the 12 emitted files for `kanban/Column/Card/localStorage` — the only hits are comments and the brief echo in README.

## 4. WHY — which pipeline stages produced what

**Produced quality:**
- Deterministic phase graph + 13 gates + decision ledger + HITL record — honest process bookkeeping (`store.ts`/`engine.ts:790-869`).
- Real research/narrative layering with M-07 grounding footers and E-13 "unavailable" honesty (`engine.ts:1654-1752`, `headless.ts:150-227`).
- Real machine-run verify that executes the P6 module (`runGenerated`, `engine.ts:493-555`; verb result "6/6… iteration 1").
- Deterministic scaffold with sanitization/escaping and honest E-15/E-27 boundaries (`scaffold.ts:1-1082`).
- Deterministic design tokens + vault + diagrams.

**Produced the weaknesses (root causes, file:line):**
1. **Phase definitions model the wrong product.** `phases.ts` P0–P12 titles/summaries describe building an *agent orchestration platform* ("Core Orchestration & State Graph", "Memory & Context Consolidation", "MCP + A2A") — so every synthesized artifact is platform boilerplate with the user's project name interpolated (`engine.ts:227-758`). Nothing in the phase content is kanban-shaped.
2. **Vocabulary-starved lattice falls back silently.** `LEX` in `algorithms.ts:24-83+` covers dispatch/health/marketplace vocab only — no `kanban/board/column/card`. Result: jobs `["deliver-core-workflow"]`, entities `["operator","record"]`, and `vague: true` (`algorithms.ts:194-209`) — which was stored but **never forced a fix**: the P0 reframe HITL was human-approved in 70s without a tighter brief, and `vague` had no downstream consequence.
3. **The A6/A7 synthesizers are generic.** Contracts/endpoints/oracle are derived from the generic lattice, so entities = Operator/Record and the oracle tests the *pipeline* job, not the product.
4. **The excellent LLM spec is orphaned.** `prompt-engine.ts:155 expandBrief` produced the best kanban requirements in the whole run (`20-prompt.json`), but no engine module consumes `ExpandedSpec` to synthesize features; it's a CLI-verb-only output. There is no product-conformance step anywhere in P0–P12.
5. **P6/P8 are theater for real products.** P6 only synthesizes+verifies a trivial phase-bookkeeping module; P8 "UI/UX Prototyping" emits a text artifact and the scaffold's Console shell (`scaffold.ts:557-580`). DoD gates check artifact *presence* ("Machine verification promoted a tested verdict"), not whether the brief's features exist — so a 0% feature-complete project sails through 13/13 "complete" phases with 1 stale-gate blemish (P6 stored `passed:false` even after a passed verify — maker finding #2, confirmed in `team-kanban.json`; root cause: `headless.ts` vs `recordGate` paths disagree, maker found `packet.ts:106` reads stored gates).
6. **Maker-side process defects** (real bugs the maker found, not yet fixed): `deepen` CLI crash `RT_E_INTERNAL` (envelope mismatch headless vs CLI), P6 stale stored gate, Wild-P12 packet never re-stamped after `recordGateInto`. These are in the RapidTool engine itself, discovered precisely because the maker honestly drove the real CLI.

## 5. Lessons

- **Persist (good practices):** deterministic scaffold with honest boundary stamps; real machine-run verify; live research with provenance footers; decision ledger + phase rail; design tokens; vault export; honesty-on-cap (the maker log and chat refusal are model behaviors worth keeping).
- **Prevent (mistakes):** generic "app" phases must not masquerade as product work; a `vague:true` lattice must block shipping; gate criteria must reference brief features, not artifact counts; scaffold-only output must be labeled "scaffold", not "complete web app"; the maker's iteration cap cost real fixes — cap budget must reserve buffer for verify/fix closure.

## 6. Concrete RapidTool changes + Self-Learning Loop

**A. Product-conformance gate (highest leverage):** after P12 (or at `emit`), run `conformance(project, scaffold)` counting brief-named features (from `ExpandedSpec.requirements` ∪ brief keywords) that appear as implementations vs TODO stubs; if 0 requirements implemented, refuse `status:"complete"` for kind webapp/cli/library or force a loud `meta.conformanceGap` into README + packet.

**B. Feature-directed synthesis:** store `prompt` verb output as `project.implementationSpec` (new field in `types.ts`), inject its requirements into P6 (`buildPhase6Module`) and P8 ("Interface contract" body, `engine.ts:589`) prompts, and emit a `SPEC.md` + README conformance table from `scaffoldProject` (`scaffold.ts:971+`).

**C. Vocabulary + HITL:** extend `LEX` (`algorithms.ts:24`) with consumer-app terms (kanban/board/card/todo/…); when `lattice.vague` is true at P0, make the reframe HITL blockable until the human supplies concrete entities/jobs (today P0 gate is only "verdict resolved to proceed").

**D. Self-learning loop (persistent memory of outcomes) — exact hooks:**
- **Capture hook — `engine.ts` `wildFinalize`/`applyPhaseResult` P12 path:** on completion, synthesize a retro summary (scorecard axes, conformance gap, artifacts-by-kind counts, maker log outcome) and call a new `learnFromProject(project)` in **`knowledge.ts`** (new `KnowledgeStore.savePattern` wrapper, kind `"pattern"`/`"note"`), tagged `[domain, "kanban|webapp", "conformance", outcome]`, body = findings above (e.g. "generic lattice fallback ⇒ 0% feature scaffold; UI shell not a UI"). The store already exists (`knowledge.ts:20-30`, idempotent fingerprint dedupe, CLI surface `rapidtool-cli.mjs:786-838`).
- **Retrieval hook — `prompt-engine.ts` `expandBrief` prompt build and `engine.ts` `synthesizePhase` head (`engine.ts:243-279`):** call `KnowledgeStore.findPatterns(query)` seeded with `[domain, kindLabel, "webapp"]` and inject the top 2–3 matched rows as `## Proven pattern (prior run)` advisory lines *before* the LLM/synthesis does its work — e.g. "prior kanban run: lattice fell back (vague) and shipped scaffold only; enumerate columns/cards first or fail conformance".
- **Minimal-change alternative:** since reading a JSON file per synthesis is I/O-heavy, load the knowledge store once in `attachAlgorithms` (`algorithms.ts`, runs on every stamp via `stampPacket`) and merge matched rows into the `episodic/semantic` memory stream that `compileAgentPacket` already ranks (extension of the FusionRank pipeline `algorithms.ts:232+`).
- **Verify hook:** add the conformance check as an oracle class so `verify` (the only part of the engine that actually runs code) executes `countImplementedRequirements(scaffoldFiles) >= 1` per app-kind project.

