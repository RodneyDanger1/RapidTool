# 15 — Feasibility Review: G-21…G-40 vs the real codebase (Flash evaluator #1)

- **File:** `research/multiagent/15_feasibility_review.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`)
- **Date / agent:** 2026-09-06 · Flash evaluator #1 (FEASIBILITY & LIMITATIONS). **Strictly read-only on source** — no file outside this one was written.
- **Input reviewed:** the G-21…G-40 section of `research/multiagent/13_top20_gaps.md` as written by the deep researcher at 03:43 (63,472 B, verified final at 03:45).
- **⚠ Disk-corruption context:** `13_top20_gaps.md` was **all-zero bytes (81,230 NULs) on disk since 03:12:31** — before this wave started. The researcher correctly diagnosed it (log 03:25-03:30) and rebuilt the file (G-01…G-20 compact/recovered, G-21…G-40 full format). Every line ref below was checked against the live files at review time; `console.tsx` is frequently mid-edit by build waves, so its line numbers are approximate and marked where verified.
- **Method:** every file:line claim in G-21…G-40 was read in the real source; external claims (licenses, graphviz, arXiv, npm registry) spot-checked over the web on 2026-09-06.

**Verdict legend:** VIABLE = implement as specced, evidence holds · VIABLE-WITH-CHANGES = implementable, but spec anchors/claims need the exact corrections below · NOT-VIABLE = as specced it cannot work.

---

## 0. Verdict table + implementation-readiness ranking (evaluator's order)

| # | Item | Verdict | Readiness tier | Key reason |
|---|------|---------|----------------|------------|
| G-32 | ADR automation | **VIABLE** | 1 — ready now (S) | pure new module; decision journal + Project.adr already exist |
| G-24 | Plan-then-act ledger | **VIABLE** | 1 — ready now (S–M) | new module; topo()/planSpecGraph floor real; one thinking-default correction |
| G-29 | Complexity & code-metrics gate | **VIABLE** | 1 — ready now (S) | pure module; DoD additive-probe fixture collateral only |
| G-37 | LLM-as-designer vector/logo on DeepSeek key | **VIABLE** | 1 — ready now (M, standalone) | honest architecture verified; sanitizer is the only defense (no CSP — correction) |
| G-38 | Palette→UI ramp mapping | **VIABLE** | 1 — ready now (S) | chroma.js dual-license claim verified TRUE; zero-dep fallback exists |
| G-25 | Reflexion self-critique loop | **VIABLE-WITH-CHANGES** | 2 | M-08 is CLOSED (factual correction); ArtifactKind ripple |
| G-21 | Hierarchical crew orchestration | **VIABLE** | 2 | crew.server runtime is the right seam; "no per-agent budget" overstates |
| G-23 | Parallel role fan-out | **VIABLE** | 2 | context builder is pure; budget/merge seams real |
| G-34 | Design-token pipeline (SD export) | **VIABLE** | 2 | anchor corrections; LLM pass must hit deepseek.server, not llm.ts |
| G-39 | Agent memory write-back | **VIABLE-WITH-CHANGES** | 2 | half the gap already shipped in report-intake.ts; spec is stale |
| G-27 | Algorithm template library | **VIABLE-WITH-CHANGES** | 3 | kind-taxonomy ripple (ProjectKind 5-way / Project.kind 3-way) |
| G-28 | Property-based test generation | **VIABLE-WITH-CHANGES** | 3 | fast-check cannot be `require`d inside the harness child as specced |
| G-35 | Component catalog + HTML→React | **VIABLE-WITH-CHANGES** | 3 | cva already installed (class-variance-authority 0.7.1); "cva" npm name is a placeholder |
| G-30 | Dep-graph + arch rules on real code | **VIABLE-WITH-CHANGES** | 3 | needs file materialization; SVG output needs graphviz (absent) |
| G-31 | Module-graph image auto-gen | **VIABLE-WITH-CHANGES** | 3 | madge image/SVG **requires graphviz** (verified README) — as specced it cannot render |
| G-33 | AST codebase map (ts-morph) | **VIABLE-WITH-CHANGES** | 3 | typescript becomes a prod dep; temp-dir materialization shared w/ G-30 |
| G-22 | Stateful graph runtime | **VIABLE-WITH-CHANGES** | 4 — core invariant | wrong seam anchors (`advance` isn't in engine.ts); default-linear edges save it |
| G-26 | Snapshot/rollback backtracking | **VIABLE-WITH-CHANGES** | 4 — core invariant | fs model + stale HitlDock anchor; otherwise sound |
| G-40 | Observability, evals, MCP, git export | **VIABLE-WITH-CHANGES** | 4 | storage model decision required; "replay to same verdict" needs trace-replay semantics |
| G-36 | Open canvas (Figma-like) editor | **VIABLE** | 5 — last | honest L/high; fabric.js lazy-load plan is right |

Tier notes: 1 = buildable immediately in a single wave, no cross-module blockers · 2 = small additive seams + spec corrections · 3 = new deps / temp-dir infra / taxonomy ripple, bundle in one wave with care · 4 = touches store/engine invariants or needs a storage decision first (G-40 is the *measurement* precondition for 3's loops — build after tier 1 items so traces capture them) · 5 = deliberate last (matches the researcher's #20).

---

## 1. Cross-cutting findings (read first — they invalidate or qualify several specs)

**C-1. The hosted product has NO server-side filesystem.** The UI is a TanStack Start app whose project state lives client-side (zustand persist `rapidtool.v4`, localStorage/IndexedDB; SSR store always empty — the store never hydrates server-side). Server fns are stateless; fs operations exist only in bare-Node paths (`headless.ts loadProject/saveProject :50-63`, vault writer, CLI). Every spec that writes **files** — G-22 `snapshots/` dir, G-26 forks + snapshot files, G-30/31/33 `archcheck <dir>` materialization, G-40 `<project>.trace` NDJSON + git export — is implementable **in headless/CLI mode only** unless a browser-side variant is added (capped arrays in project state, or IndexedDB). Specs must say which host they target. Evidence: `store.ts` persist config; skill trace `references/ui-entry-trace.md` (SSR store empty, A08); `node-runner.server.ts:87-90` spawns children in an OS tmpdir — a good precedent for "materialize generated code to a temp dir" but it is per-call ephemeral.

**C-2. Client wrappers throw under bare Node.** `llm.ts complete()` and `research()` are `createServerFn` wrappers — they fail with "No Start context found in AsyncLocalStorage" under Node. Any spec that says "LLM pass via `llm.ts complete()`" for a **CLI/headless** path (G-34 `cli design --brief`, G-37 prompts, G-38 `rampFromBrief`) must call `deepseek.server.ts completeDeepSeek` directly via dynamic import, exactly like `crew.server.ts:24` and `headless.ts:899-930` do. UI paths may use the wrappers.

**C-3. `console.tsx` line refs drift** (sibling build waves edit it constantly). Verified today: RunTab union `:91`; `CrewMsgView`/`CrewRunView` `:94-111`; crew tab defs `:185`, tab list `:1446-1449`; `onSpawnCrew` `:718`; `ArtifactPane` `:2011`; `PhaseRail` use `:1034` / def `:1743`; **`HitlDock` def `:1854`** (not 705-758); DesignPane (token swatches + CSS copy + design.html download) ~`:3005+`, no iframe/srcDoc anywhere in the file.

**C-4. Closed-union ripple for new ArtifactKinds.** `ArtifactKind` is a closed 16-member union (`types.ts:23-38`) and `diagram.ts:76` `KIND_THEME: Record<ArtifactKind, KindBoxTheme>` is exhaustive — adding a `"critique"` kind (G-25) or any new kind **requires** a `KIND_THEME` entry or tsc fails. `kindTheme(kind: string)` at `diagram.ts:105` already falls back to `UNKNOWN_KIND_THEME` for strings, so runtime rendering is safe once typed.

**C-5. DoD additive probes have known fixture collateral** (E-07 `p6-verified` precedent, documented in `references/verify-core-surface.md`): adding `p6-metrics` (G-29) or gate-evidence criteria (G-30/31) makes deterministic full-run fixtures fail until promoted (`handoff.test.ts:52` all-green assert; `store.test.ts` P6 autopilot fixture feeding `runGate().pass`). Plan the fixture promotions in the same wave.

**C-6. No CSP exists.** grep for Content-Security-Policy across `src/ scripts/ public/` returns nothing but sandbox.ts **comments** mentioning CSP as an environmental failure mode (deprecated worker path). G-37's "(sanitizer + existing CSP)" is wrong — there is no CSP. The sanitizer is the *only* defense; that is adequate for `<img src=data-url>` (scripts inert in image context) + text-only artifact rendering, but the spec should not claim CSP, and adding a CSP meta would be a genuine hardening add.

**C-7. Graphviz is required by both graph tools for images** — see G-30/G-31.

---

## 2. Per-item verdicts

### G-21 — Hierarchical crew orchestration — **VIABLE** (tier 2)

Verified TRUE: flat deterministic role table `crew.server.ts:51-76` (JSON_ROLES `:51`, DEFAULT_MESSAGE_TYPE `:54-61`, MANDATE `:63-76`); header "One DeepSeek call per turn over a deterministic phase → role table (never an LLM speaker selector)" `:9-10`; advisory contract "never approves, rejects, advances, or deploys" `:15-16` + STANDING_RULE `:89-93`. `handoff` exists in `CrewMessageType` (`:327-336`) and nothing consumes it as a transfer — the run loop's only early-exit is `msg.type === "final"` (`:652-654`) and `nextRole` is pure table walk (`:311-321`, sequence from `CREW_ROLE_BY_PHASE :122-136`). UI: RunTab `"crew"` `console.tsx:91` ✓; headless verb surface `headless.ts:441 runUntilGate` ✓.

Corrections (minor):
1. **"no per-agent budget" overstates** — per-*role* token budgets exist in `ROLE_SPECS crew.server.ts:103-112` (planner 4096 … coder/architect 8192, all flash). What is missing is a per-*task* budget, which is exactly what the manager-task schema adds. Phrase the gap as "no per-task budget / no dynamic allocation."
2. The roles override (`opts.roles`, `:564`) and `maxSteps`/`maxTotalTokens` guards (`:577-580`) already bound a hierarchical run; manager dispatch should reuse `ROLE_SPECS`-style budgets and the existing "cost-limit" stop rather than inventing new accounting.

Honest risk (matches spec): the LLM manager is the first *dynamic* routing in a deliberately deterministic core (`03_crew_design.md` §4.1 chose the deterministic router for a reason). Keep manager output advisory + schema-validated by the existing JSON envelope machinery (`:78-83`); do not let the manager set `phase`/advance. Zero-key behavior falls out of the existing config gate (`:560-562`). Effort M/med honest.

### G-22 — Stateful graph runtime — **VIABLE-WITH-CHANGES** (tier 4)

Verified TRUE: `PHASES` is a fixed linear `PhaseDef[]` `phases.ts:3-109`; scalar `currentPhase` repair clamps `Math.max(0, Math.min(12, highest + 1))` in `hydrateProject` `engine.ts:1225-1230` and `:1244-1248` (cited 1226/1246 ✓); HITL stock list `phases.ts:133-134` ✓; whole-file save/load `headless.ts:50-63` ✓; `awaiting_hitl` runtime mirror `engine.ts:39-40` ✓ (cited :40).

Corrections:
1. **`engine.ts advance (engine.ts:963)` does not exist.** There is no `advance` export in engine.ts. The real progression seams are: `store.ts:235 advanceOnce` (phase complete && phase<12 → `next = phase + 1`, `store.ts:~271-276`), its async mirror `advanceOnceAsync store.ts:390`, `engine.ts:783 applyPhaseResult` (marks the phase, sets `currentPhase: phase`), and the hydrate clamp `engine.ts:1211-1259`. A `plan.next(state)` hook must be consulted in `advanceOnce` (UI/autopilot) **and** the headless run loop (`headless.ts:233 runPhase` / `:441 runUntilGate`), or the two hosts diverge. This is precisely why the item is core-touching.
2. Storage: `snapshots/` next to the project file is headless/CLI-only (C-1). Browser variant = snapshot entries in project state.
3. "27 existing engine/headless tests pass unmodified" — plausible but unverified; the engine suite is larger via `npm test` auto-discovery. Phrase as "all existing engine/headless/store suites pass unmodified."

The design itself (additive `edges` override, default linear) is the right minimal intrusion; E-26's "registry = exactly 13 phases" property test survives because no phase is added. Verdict stands implementable, but the spec's seam list must be corrected before an implementer starts.

### G-23 — Parallel role fan-out — **VIABLE** (tier 2)

Verified TRUE: the run loop is strictly serial (`crew.server.ts:587-657`, `idx++` `:656`); header `:9-10`. `buildAgentContext` (`:246-301`) is pure and reads `session` without mutating it — safe to call N times against a pre-dispatch snapshot before `Promise.all` dispatch. Budget counters (`:646-647`) are plain number fields; JS single-threadedness makes concurrent accumulation safe, but accumulate after all branches settle for clean accounting. Merge = reviewer turn with the existing MANDATE (`:72-73`); synthesis honesty ("only cites real branch message ids") must be enforced by giving the merge prompt the actual branch message list and instructing id-only citation — the reviewer mandate pattern already forbids fabrication (`:89-93`). UI anchors `console.tsx:91, 104-111` ✓. One real wrinkle: `live:true` researcher grounding would fire one `freeWebSearch` per parallel researcher branch (`:600-614`) — cap or disable for parallel researcher seats. Effort M/low-med honest.

### G-24 — Plan-then-act ledger — **VIABLE** (tier 1, small corrections)

Verified TRUE: planner role exists `crew.server.ts:63-65`; plan is only a transcript message — no machine-readable plan artifact is consumed anywhere; phase graph fixed (`phases.ts:3-109`); deterministic floor exists: `topo()` at `algorithms.ts:305` and `planSpecGraph` at `:337` (cited 305-384 ✓); packet compile path `packet.ts` real.

Corrections:
1. **"`thinking: enabled` already default on DeepSeek V4 (`deepseek.server.ts:37`)" is half-right.** Thinking is ON at the API level (comment `deepseek.server.ts:37-39`), but `completeDeepSeek` **explicitly disables it for flash** and enables it only for pro with `reasoning_effort: "high"` (`:163-165`). The default `model` is flash (`:142`). A ledger LLM pass therefore gets thinking OFF unless it passes `model: "deepseek-v4-pro"` (60 s timeout, 8192 max tokens, `:41-43`) — which is fine, but the spec must say so, or the "revisable reasoning plan" claim silently degrades to a flash JSON emit.
2. Zero-key deterministic floor = pre-seed ledger rows from `planSpecGraph`'s topo order — real and cheap. Effort S–M/low honest.

### G-25 — Reflexion self-critique loop — **VIABLE-WITH-CHANGES** (tier 2)

Verified TRUE: `verifyAndFixServer` iterates oracle→fix→retry ≤ `maxIterations` with the machine declaring pass/fail (`verify.server.ts:152-219`); critiques are not persisted (the loop feeds only the next prompt, `:194-214`); P5 def `phases.ts:47-51` ✓; FusionRank `algorithms.ts:214` ✓ (critique rows would rank into packets once they are memory rows — G-39's mechanics).

Corrections:
1. **Factual error: "M-08: `report-intake.ts:142-147` writes no memory" is stale — M-08 is CLOSED.** `applyReportResult` (real fn at `report-intake.ts:246`, facade `applyReport` at `:365`) appends, for `status:"complete"` reports, one semantic memory row + one episodic row per artifact with content-fingerprint ids (`report-semantic-{phase}-{fp8}`), deduped via `dedupeMemoryIds` and capped at 80 — see the in-code comment "M-08: a 'complete' report writes agent lessons back to memory — the first real cross-run learning loop" (`report-intake.ts:~322-343`). Lines 142-147 are the `tests_run` validator, unrelated. The real remaining gap is narrower: critiques/fix-attempt lessons are not threaded into that machinery, and rejected reports mint no rows.
2. New `ArtifactKind "critique"` requires touching the closed union `types.ts:23-38` **and** the exhaustive `KIND_THEME` record `diagram.ts:76` (C-4) plus `engine.ts` `art()` typing if used there. Additive, but not a one-file change as the spec implies ("into a new Artifact kind").
3. `report-intake.ts:142-147 (applyReport) appends an episodic MemoryEntry` — correct the anchor to `report-intake.ts:246-365` (append logic ~`:322-343`).

### G-26 — Snapshot/rollback — **VIABLE-WITH-CHANGES** (tier 4)

Verified TRUE: `retry` is the only backtrack verb (`headless.ts:523`; reject `:518`, approve `:498` — the cited range 518-523 is reject+retry, acceptable); repair only clamps forward (`engine.ts:1225-1248`); decision/log journal append-only inside `approveHitl`/`rejectHitl` (`engine.ts:893+`, journal block ~`:964-985`, cited 969-1016 close enough); `saveProject` overwrites via tmp+rename (`headless.ts:58-63` ✓).

Corrections:
1. **`HitlDock` is at `console.tsx:1854`**, not 705-758 (705-758 is the crew-run state region; the "per audit 02" numbers are stale — audit 02 predates later growth).
2. File-based snapshots/forks are headless/CLI-only (C-1); browser needs a store variant. `io.ts exportProjectJson` + `fnv1a` (`algorithms.ts:733`) make content-hash snapshots trivial and deterministic — the core idea is sound. Rollback-to-byte-identical JSON is achievable because `importProject`/hydrate is a pure round-trip (`engine.ts:1206 hydrateProject`); note hydrate *repairs* corrupt shapes, so a rollback of a corrupt snapshot is impossible by design (fine — snapshots are pre-corruption).

### G-27 — Algorithm template library — **VIABLE-WITH-CHANGES** (tier 3)

Verified TRUE: scaffold emits spec-graph modules with code templates (`scaffold.ts:458-590`, `Console()` emitter `:566`); `projectKindOf` `:229`; `scaffoldProject` `:971`; `buildTestOracle` produces job-shaped oracle rows (`algorithms.ts:449`, cited 449-467 ✓); coder mandate `crew.server.ts:70-71` ✓. TheAlgorithms/Python is MIT (GitHub API 2026-09-06 ✓) — porting with an MIT notice header is license-clean.

Corrections:
1. **Kind-taxonomy ripple:** `ProjectKind` (scaffold.ts:43) is a 5-way union (`webapp|cli-tool|library|game|service`) resolved from `Project.kind` (`types.ts:249`, only `"app"|"tool"|"game"`) by `projectKindOf` (`scaffold.ts:229`) — an `"algorithm"` scaffold kind needs a mapping decision (map `tool`→algorithm variant, or extend both unions + `projectKindOf` + emitter + `scaffold.test.ts` pins). Not free, but additive.
2. The ALGO_INDEX content ("~600 lines vendored/ported") is the real cost; 20 canonical ports is honest. Acceptance criterion 2 ("oracle case executes against it") needs the module to be a valid P6 source (CommonJS `exports` shape, per `verify.server.ts:131`) — the library templates must follow the same `exports.x =` convention the verify harness expects.

### G-28 — Property-based test generation — **VIABLE-WITH-CHANGES** (tier 3)

Verified TRUE: `VerifyCase` is one boolean expression (`verify.server.ts:21`), harness wraps exports via `new Function` with a **stubbed `require`** (`:68-91`, `__fn(__exports, {exports: __exports}, () => {})` `:76`), `runCases` `:94-120`, loop `:152-219`. fast-check MIT ✓ (GitHub API; ~zero transitive deps).

Corrections (implementation-critical):
1. **The harness child cannot `require('fast-check')` as specced.** `runNodeBounded` spawns `node -e` with `cwd` = a fresh `mkdtemp` under the OS tmpdir (`node-runner.server.ts:87-90`, `:104-110`) — Node module resolution walks up from that temp dir and finds no `node_modules`. Options: (a) parent resolves fast-check via `createRequire(import.meta.url).resolve("fast-check")` and **embeds the absolute path** in the harness string (child `require`s the absolute path — machine-local, fine for CLI/desktop; on a serverless host the fn bundle must include fast-check and the resolved path must point inside the bundle — mark as a deployment risk); (b) run `fc.check` in the parent process and use the child only to surface exports — but executing arbitrary generated source in the parent process defeats the bounded-runner boundary; prefer (a). 
2. Property *signatures* must come from parsing the exported functions — the harness currently evaluates expressions against exports, so a "describe exports" pre-pass in-child (JSON dump of `typeof`/arity) is the honest seam; keep it machine-only.
3. Seeded determinism + shrunk-counterexample rendering into `evidence` is consistent with the FNV-1a evidence-hash philosophy (`dod.ts`); zero-key fallback = existing expression cases, unchanged.

### G-29 — Complexity & code-metrics gate — **VIABLE** (tier 1)

Verified TRUE: nothing measures generated code today (only `node-runner.server.ts` executes it); DoD gates never consult metrics; scorecard is lattice-based (`algorithms.ts:578-600 feasibilityScorecard` ✓ — cited 578-600). eslint `complexity` rule MIT ✓ (repo + docs); the dead `simonrenoult/codecomplex` 404 exclusion is correct (verified via GitHub API 404).

Notes: a **token-level** cyclomatic counter without string/comment/template-literal awareness mis-counts (`&&`/`?:` inside strings, regex literals) — budget a small lexer pass (brace + quote-state tracking) to make "15-decision function flagged with exact line refs" actually true. Adding `p6-metrics` to `DOD[6]` is additive but carries the C-5 fixture collateral — promote fixtures in-wave. Zero LLM calls, deterministic, S — honest.

### G-30 — Dependency graph + architecture rules on real code — **VIABLE-WITH-CHANGES** (tier 3)

Verified TRUE: only the *planned* graph exists (`planSpecGraph algorithms.ts:337-384`); architect mandate never machine-enforced on files (`crew.server.ts:68-69`); dependency-cruiser MIT ✓ (GitHub API). `planSpecGraph` bounds check: `topo` `:305`, `planSpecGraph` `:337`, `synthesizeContracts` starts `:417` — cited 337-384 ✓.

Corrections:
1. **Input model:** generated code is an in-memory `{path, body}[]` (`scaffold.ts:971` returns `ScaffoldFile[]`); `cruise()` needs files on disk → materialize to a temp dir first (C-1/C-2 pattern; `node-runner` tmpdir precedent). Scaffolded apps import `react` etc. that won't resolve in a bare temp dir — dep-cruiser reports unresolvable externals; rules over *relative* imports still work, but the spec should scope the ruleset to relative edges or ship a stub `node_modules`/`--tsConfig`.
2. **SVG output requires graphviz.** dep-cruiser's dot/svg reporters render through Graphviz (faq/doc verified 2026-09-06: "GraphViz won't always be able to render a graph with orthogonal edges" in the dot-reporter context). No graphviz binary exists on this host/serverless target. Emit `.dot`/JSON and render SVG with own deterministic layout (diagram.ts is the house pattern — zero-dep), or make graphviz an optional local path in CLI mode.
3. "no-circular / no-orphans / types.ts may not import UI" — the generated webapp has no `types.ts`; phrase rules per-kind. Effort: M is fair, low-med more honest given the materialization + resolution noise.

### G-31 — Module-graph image auto-generation — **VIABLE-WITH-CHANGES** (tier 3)

Verified TRUE: `diagram.ts` exists and takes no real-code input (exports `buildDiagram(project, kind)` `diagram.ts:783`; kinds phases/architecture/flow `:37-38`); spec tab shows a flat list. madge MIT ✓ (GitHub API).

Correction (implementation-critical): **madge cannot produce SVG without the graphviz binary.** madge README (fetched 2026-09-06): "Graphviz is only required if you want to generate visual graphs (e.g. in SVG or DOT format)." So "`renderModuleGraph(dir): Promise<{svg}>` via madge" is NOT-VIABLE as written on a host without graphviz. Fix: use madge only for the dependency *data* (its pure-JS graph pass), then lay out + render the SVG with own deterministic code (diagram.ts precedent — byte-identical SVG acceptance criterion then holds by construction), or drop madge and hand-roll a small import scanner over the emitted file strings (they are deterministic TS; `./x.ts` relative imports are trivial to extract). Given G-30 also needs an SVG renderer, one shared self-rendered module graph serves both — the "do together" note is right.

### G-32 — ADR automation — **VIABLE** (tier 1)

Verified TRUE: approve/reject verbs `headless.ts:498/:518`; append-only decision journal + logs in `approveHitl`/`rejectHitl` (`engine.ts:893+`, journal ~`:964-985`); no ADR *file* is produced anywhere. License diligence correct: `phodal/adr` MIT ✓; `npryce/adr-tools` API NOASSERTION + no LICENSE file on main/master (verified) — pattern-only is the right call.

One nuance: RapidTool is not fully ADR-less — `Project.adr: string` (types.ts) is the P12 destination and `deplyNotes` (`scaffold.ts:855`) embeds it verbatim into generated DEPLOY.md. The genuine gap is **machine-minted per-decision ADR rows** from the journal — phrase it that way. `mintAdr` can dedupe by event hash because the journal is append-only with timestamps. S/low honest; the strongest tier-1 candidate.

### G-33 — AST codebase map (ts-morph) — **VIABLE-WITH-CHANGES** (tier 3)

Verified TRUE: no AST tooling anywhere; only planned spec-graph map (`algorithms.ts:337`); ts-morph MIT ✓ (GitHub API), but it **depends on `typescript` at runtime** — typescript is currently a devDependency only (package.json), so this add promotes ~tens of MB into the prod/serverless bundle. Mitigations the spec must state: dynamic `import()` only post-P6, isolate in `codemap.ts`, and accept Vercel-fn weight or run it only in CLI mode.

Input model: same temp-dir materialization as G-30; the generated TS uses explicit `./x.ts` import extensions — configure the ts-morph `Project` with `allowImportingTsExtensions` (it is a tsconfig-level flag ts-morph honors) or every file fails to load. Acceptance criterion 1 (codemap JSON matches a hand-verified 3-file sample) is the right test. Effort M/med honest.

### G-34 — Design-token pipeline (Style-Dictionary export) — **VIABLE** (tier 2, anchor corrections)

Verified TRUE: deterministic token layer exists — `designTokens` export at `design.ts:471`, `designHtml` at `:563` (the cited `:15-16` is the header contract comment, legitimate); palette name `"<family> · <cast>"` contract in the `DesignTokens` type doc `design.ts:57-63` ✓ (cited 57-63); stable 20-key set — `TOKEN_KEYS` at `design.ts:100-123` (keys `:102-122`; **not** 20-22/57-63 as cited — minor anchor slip); `design.test.ts` exists ✓ (CI guard real); design tab is token swatches + CSS copy + design.html download (`console.tsx` DesignPane ~`:3005+`), no live preview — so "design tab shows brief-derived palette" needs a small UI add, honest. style-dictionary Apache-2.0 ✓ (optional dep framing correct; SD JSON is ~30 lines to emit by hand).

Corrections:
1. **LLM pass must not go through `llm.ts complete()` for CLI paths** (C-2) — `cli design --brief` would throw under bare Node. Call `deepseek.server.ts completeDeepSeek` (`:135`) via dynamic import with `json:true` (`:150-157`), exactly like `headless.ts` crew/verify verbs.
2. The LLM palette must be validated against the same contrast rules design.ts already enforces (the 0.183 white-text rule and ≥4.5:1 pairings live in design.ts internals — reuse them, don't re-derive in the caller).

### G-35 — Component catalog + HTML→React — **VIABLE-WITH-CHANGES** (tier 3)

Verified TRUE: scaffolded Console is a hand-rolled JSX string (`scaffold.ts:566` ✓); no variant system; no HTML→React intake. shadcn pattern-only is consistent with 07 §2.11. html-to-react MIT ✓ (798★, pushed 2026-08-31).

Corrections:
1. **cva is already installed** — `class-variance-authority: ^0.7.1` sits in package.json dependencies today. And the npm name `cva` is an **unowned 0.0.0 placeholder** (registry check 2026-09-06: 362 B, no code) — do not add a `cva` dep. The installed package's repo is joe-bell/cva (Apache-2.0 ✓ per GitHub API). So: import from `"class-variance-authority"`, zero new installs for the variant core.
2. html-to-react is low-activity (last meaningful releases years ago; React 19 untested). For a ~100-line allowlist→`React.createElement` converter the house zero-dep style is arguably safer; if html-to-react is used, keep it behind the same sanitizer boundary the spec already demands. Acceptance criterion 2 ("no raw dangerouslySetInnerHTML outside the sanitized path") is the right invariant; note console.tsx itself currently renders code text-only with escaping (`ArtifactPane ~:2011+`), so nothing in the current UI would regress.
3. Emitter refactor risk (keep old emitter until parity) is correctly flagged; the `Console()` emitter `:566` is inside a template literal — refactor it to data-driven recipes with a byte-parity test before swapping.

### G-36 — Open canvas (Figma-like) editor — **VIABLE** (tier 5)

Verified TRUE: P8 is artifact text (`phases.ts:69-74` ✓); design system is JSON/HTML-string only; no visual surface; fabric.js MIT ✓ (GitHub API, pushed 2026-08-18); Penpot MPL-2.0 exclusion correct (file-scoped copyleft — pattern-only is the right call). Lazy-load behind `React.lazy` keeps the main bundle small — the +≤50 KB gz acceptance is testable via bundle analysis. Effort L/high + a11y/scope-creep risk honestly stated. This is a genuine new UI surface (the design tab has no canvas today, verified). Nothing to correct; build last.

### G-37 — LLM-as-designer vector/logo/icon/badge generation — **VIABLE** (tier 1)

Verified TRUE (this is the most honest spec in the set): DeepSeek is text-only — `completeDeepSeek` posts only to `/chat/completions` (`deepseek.server.ts:174`), vision-exp is excluded from chat (`:13-14`), `DEEPSEEK_MODEL_IDS` is exactly 3 models (`:31-35`), `LlmModel` is two text tiers (`llm.ts:14`); api-docs.deepseek.com fetched 2026-09-06 documents one endpoint family, consistent. No vector/image artifact exists anywhere today. Licenses all verified: iconify MIT, heroicons MIT, simple-icons **CC0-1.0** (correctly flagged), SVG-ORA-Studio **no LICENSE** (correctly flagged, GitHub API `license: null`), lucide-react is already installed (good deterministic-floor suggestion). OmniSVG arXiv:2504.06263 **exists** (verified via arXiv API: "OmniSVG: A Unified Scalable Vector Graphics Generation Model").

Corrections:
1. **"(sanitizer + existing CSP)" — there is no CSP** (C-6). The allowlist sanitizer is the whole defense; that's sufficient given `<img data-URL>` rendering (scripts don't execute in image loads) + text-only artifact rendering, but remove the CSP claim and optionally add a CSP meta as a hardening follow-up.
2. The sanitizer must also reject `style` attribute URLs and `xlink:href` (the spec lists attrs but not `style` — a `style="background:url(...)"` exfil vector worth an explicit block); keep the fuzz-corpus CI test (criterion 2) — it is the right zero-hallucination security pin.
3. Palette-only fills mean generated SVGs depend on `designTokens` — correct coupling, and G-38's ramps feed it. `headless.ts:130-231` bareNodeLiveOverlay citation ✓ (real anchor `:130`).

### G-38 — Palette→UI ramp mapping — **VIABLE** (tier 1)

Verified TRUE: palettes are fixed family·cast pairs — no ramp derivation, no brief-derived palettes (`design.ts:57-63` contract; CASTS `:228`); chroma.js license claim **verified accurate**: raw LICENSE = BSD-3-Clause text (© Gregor Aisch 2011-2025) **plus** an appended Apache-2.0 grant section (lines 33+) — "BSD-3 + Apache-2.0 dual" is correct even though the GitHub API says NOASSERTION (classifier miss on the bundled file); culori MIT ✓, open-color MIT ✓ (API checks). `design.test.ts` exists to extend ✓.

Notes: derived ramps must respect design.ts's existing contrast invariants (≥4.5:1 text pairs, the 0.183 white-on-color rule — reuse the module's own pairing logic rather than importing WCAG math anew); culori is tree-shakeable and tiny — the "OR zero-dep HSL fallback" option is real; the LLM hex step should reuse the G-34/G-37 correction: server-side `completeDeepSeek`, never `llm.ts` on CLI paths (C-2).

### G-39 — Agent memory write-back — **VIABLE-WITH-CHANGES** (tier 2, spec is stale)

Verified TRUE: `MemoryEntry` provenance field landed (`types.ts:100-105`, `source?: "engine"|"agent-report"|"human"|"research"`); FusionRank ranks memory into packets (`algorithms.ts:214`; `packet.ts` compile path); vault is manual notes with scored search (`searchVaultScored` per module header `vault.ts:18`, token-overlap search).

Corrections (two factual errors):
1. **M-08 is closed, not open.** `applyReportResult` (`report-intake.ts:246-365`) already writes agent memory on complete reports — semantic row for the summary + episodic row per artifact, fingerprint ids, `dedupeMemoryIds` + 80-row cap; in-code comment "M-08: a 'complete' report writes agent lessons back to memory — the first real cross-run learning loop" (`~:322-343`). The cited anchor `report-intake.ts:142-147` is the tests_run validator. The real remaining deltas: (a) **rejected** reports mint no rows; (b) G-25 critique lessons are not threaded in; (c) memory→vault MOC export doesn't exist.
2. **`dedupeMemoryIds` is defined at `engine.ts:176`**, not :976 (976 is inside the journal-append region). Also the MOC hub note ("kind index") is built in `buildVaultNotes` (`vault.ts:124`, hub branch ~`:287`) with `vaultIndex` at `:475` — the cited `vault.ts:340-375` sits in `backlinksFor`/`vaultMarkdown` territory; re-anchor.
3. Idempotency: re-ingest already dedupes by content fingerprint (`report-semantic-{phase}-{fp8}` + the duplicate-apply short-circuit at `report-intake.ts:~250`), so acceptance criterion 3 is nearly free — extend the same scheme to lesson rows.

Net: the item shrinks from "M" to "S–M" once the shipped half is credited. Rank #4 as "the memory half of the learning loop" overstates the delta; keep the item but re-scope.

### G-40 — Observability, evals, replay, MCP, git export — **VIABLE-WITH-CHANGES** (tier 4)

Verified TRUE: crew transcripts are not persisted (console keeps `CrewRunView` in useState only, `console.tsx:473`; headless `runCrew` returns results, doesn't store); no trace UI; no LLM-output eval harness; no MCP surface; tests cover the deterministic core only. zod 4.4 installed — `z.toJSONSchema` exists in v4 for eval assertions ✓. Licenses: langfuse core-MIT-with-flagged-ee reading is accurate per raw LICENSE; promptfoo MIT ✓; OpenHands MIT ✓; isomorphic-git MIT ✓; MCP TypeScript SDK MIT→Apache-2.0 transition noted ✓.

Corrections:
1. **Storage model (C-1) is the unstated blocker.** "Append-only NDJSON into `<project>.trace`" only works in headless/CLI mode. In the hosted UI the trace must ride in project state (a capped `TraceSpan[]`-style slice in the store, or reuse the capped `logs: JsonLog[]` pattern) or IndexedDB. The spec must pick a host per feature or define a store-backed span ring.
2. **"Replays trace to same verdict" cannot mean re-running live LLM calls** — DeepSeek is nondeterministic. Replay must mean: replay the *stored* prompts/responses/spans (no live calls), which reproduces the verdict by construction; say that explicitly, and make "live re-run" a separate, honestly-labeled mode.
3. MCP server: wrapping the `headless.ts` verb surface is right (bare-Node importable; approve/reject/ingest/packet all exist `headless.ts:498/:518/:544/:571`), but `npx rapidtool-mcp` needs a real entrypoint — package.json `bin` + a new script next to `scripts/rapidtool-cli.mjs` (the CLI has no bin today either — it's run via node). HITL approve end-to-end over MCP works locally; in the hosted app MCP would have to target the same stateless boundary problem — scope MCP to local/headless first.
4. "Freeze v1 trace schema in types.ts" — right call; do it additively. Eval assertions via zod JSON-schema over stored traces are feasible; "≥1 case per crew role" requires the traces to actually persist role turns (they do — `CrewMessage.role`).
5. Rank #2 framing ("observability is the precondition for every improvement loop") is conceptually sound but its *implementation* depends on the C-1 decision — do the storage decision first, then trace, then the rest.

---

## 3. License spot-checks (evaluator's independent pass, 2026-09-06)

All of the researcher's table entries reproduce correctly. Independent confirmations: madge README graphviz requirement; dependency-cruiser doc graphviz references; chroma.js raw LICENSE dual BSD-3+Apache-2.0; cva npm placeholder (0.0.0, unowned) vs installed class-variance-authority 0.7.1 (repo joe-bell/cva, Apache-2.0); OmniSVG arXiv:2504.06263 exists; npryce/adr-tools has no LICENSE file on main/master (NOASSERTION correct); `microsoft/autogen` CC-BY-4.0 exclusion is prudent (creative-commons, pattern-only) — note for the parent: earlier waves may have recorded autogen as MIT; the API now reports CC-BY-4.0, so the exclusion stands. No unlicensed code is proposed for vendoring anywhere in G-21…G-40; the two "no-license" repos (SVG-ORA-Studio) and CC0 (simple-icons) and MPL (Penpot) are correctly demoted to pattern-only.

## 4. What to fix in 13_top20_gaps.md before an implementer touches it (exact edits)

1. G-22: replace the `engine.ts:963 advance` seam with `store.ts:235 advanceOnce` + `engine.ts:783 applyPhaseResult` + hydrate clamp `engine.ts:1211-1259`, and add a browser-store snapshot variant (C-1).
2. G-25 / G-39: delete the "M-08 open / writes no memory" claims; credit `report-intake.ts:246-365` (memory append ~`:322-343`); re-scope G-39 to rejected-report rows + critique threading + vault memory export; re-anchor `dedupeMemoryIds` to `engine.ts:176`.
3. G-26: HitlDock anchor → `console.tsx:1854`; add host scoping (C-1).
4. G-28: replace "extend runCases with a property runner" with the absolute-path-injected fast-check design (or parent-side fc.check over a child-surfaced export inventory) and note the stub-`require`/tmpdir-cwd facts.
5. G-30/G-31: state that madge/dep-cruiser SVG output needs graphviz and switch to data-extraction + self-rendered SVG (diagram.ts pattern); scope archcheck to a materialized temp dir with relative-import rules.
6. G-33: declare typescript-as-prod-dep consequence + `allowImportingTsExtensions`; CLI-only fallback.
7. G-34/G-37/G-38: server-side LLM calls via `completeDeepSeek` (never `llm.ts`) on headless/CLI paths; G-37: drop the "existing CSP" claim; G-34: TOKEN_KEYS anchor `design.ts:100-123`.
8. G-35: cva already installed (`class-variance-authority ^0.7.1`); do not add the `cva` npm package (placeholder); re-evaluate html-to-react vs zero-dep converter.
9. G-40: storage-model decision first; replay = stored-span replay (no live calls); MCP + git export scoped to local/headless hosts initially.
10. G-24: state the flash thinking-disabled default; pick `pro` explicitly if reasoning rows are wanted.
11. G-21: "no per-agent budget" → "no per-task budget" (per-role budgets exist at `crew.server.ts:103-112`).
12. G-29: note the DoD additive-probe fixture collateral (C-5) and budget a quote/string-aware lexer pass for exact line refs.

---

## 5. Bottom line

- **NOT-VIABLE as specced: none.** Every item is implementable; four need implementation-critical rewrites before coding (G-28 harness injection, G-30/G-31 graphviz, G-40 storage/replay semantics) and two carry factual errors that change their scope (G-25/G-39: M-08 already closed).
- The strongest, cleanest, wave-1-ready items: **G-32, G-24, G-29, G-37, G-38** — all pure-additive new modules with verified seams and keyless deterministic floors. G-36's L/high self-assessment and #20 rank are correct.
- The register's license table survives independent spot-checking; the honest-architecture claims around DeepSeek text-only generation (G-37) are accurate and should be kept verbatim.
- The single biggest cross-cutting risk the register under-weights is **C-1 (no server fs in the hosted product)** — G-22/G-26/G-30/G-31/G-33/G-40 all assume files. One shared "materialize generated code / persist traces" decision unblocks or reshapes six items.
