# 26 — Debug Contract Gaps: definitive capability → CLI/headless coverage register

- **File:** `research/multiagent/26_debug_contract_gaps.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`)
- **Date / agent:** 2026-09-06 · F3 debug-helper (Flash), read-only pass
- **Purpose:** the definitive map of whether an **autonomous agent (CLI / bare-Node headless)** can reach **every capability** the repo builds. Feeds the final 6-agent audit wave's wiring work.
- **Method / honesty pledge:** every row below was verified by reading the file named. Full reads: `src/lib/headless.ts` (1294 L), `scripts/rapidtool-cli.mjs` (545 L), `scripts/README-cli.md` (394 L), `src/lib/errors.ts` (184 L), `src/lib/chat.ts`, `src/lib/chat.server.ts` (imports), `src/lib/engine.ts` (targeted export reads), `src/lib/store.ts` (imports + surface), `src/lib/swarm.ts` header. Export surfaces of every `src/lib/*.ts` module enumerated by grep; production call sites of every pillar function verified by repo-wide grep (tests excluded). **No source file was modified.**
- **Contract under test:** single JSON object per CLI invocation on stdout (`schema_version`, `cmd`, `exit_code`, `ok`), exit-code taxonomy 0/1/2/3/4, `code` = `RT_E_*` on failure envelopes, atomic write-back, no fabrication.

---

## 0. Executive summary (the gaps, ranked)

| # | Gap | Rank | One-line impact |
| --- | --- | --- | --- |
| G1 | CLI has **no `retry`** subcommand (`headless.retry` exists, is tested, is unwired) | **P0** | A `reject`ed phase parks `blocked` with "retry with the note applied" — the CLI agent loop is a dead end exactly where the product wants iteration |
| G2 | CLI failure envelopes collapse to **`RT_E_UNKNOWN`** for every domain error the prose classifier cannot match (≈11 of 14 registry codes are unreachable from the CLI) | **P0** | README-cli.md:317-332 promises code-first branching the CLI cannot deliver (`RT_E_GATE_PENDING`, `RT_E_REPORT_INVALID`, `RT_E_VALIDATION`, `RT_E_RUNNER_FAILED`, `RT_E_PHASE_ILLEGAL` never appear) |
| G3 | **Wild Mode** (`engine.wildStep` + `wild-mode.server` classifier) reachable **only via the browser store** | **P1** | The flagship autonomous step loop has no headless driver / CLI command |
| G4 | **Post-hoc deepen-research** (`engine.deepenResearch`) reachable **only from console UI** | **P1** | An agent cannot refresh live research on a completed P0/P7/P11 from the CLI |
| G5 | **Swarm advisory planner** (`swarm.ts`, 886 L) has **zero production consumers** (crew tests import it as fixtures only) | **P1** | A whole advisory-planning layer (swarmPlan / parallelDag / branchSuggest) is unreachable by anyone; wiring wave must decide wire-vs-prune |
| G6 | **Chat copilot** (`chatOnce`) is UI-only via a TanStack `createServerFn` — cannot run under bare Node | **P1** | No grounded Q&A over a project for agents; `chatOnceServer` itself is bare-Node friendly, so a thin wrapper is cheap |
| G7 | Ten pillar modules with **zero production call sites** (orphans, tests-only) | **P2** | algo-tools, arch-tools, ast-mine, knowledge, prompt-engine, scaffold, vector, bench(public API), watcher, engine.verifyPriorPhases |
| G8 | `engine.verifyPriorPhases` (drift re-check of sealed phases) — **zero call sites repo-wide** | **P2** | Dead export; wire into an audit command or prune |
| G9 | `planning.ts` standalone API reachable only inside `crew.server` | **P2** | Optional `plan`/`reflect` CLI |
| G10 | `tracing.ts` never records spans on headless/CLI runs → vault trace notes can never appear from CLI flows | **P2** | Optional `--trace` on run/gate |

Also verified non-gaps that look like gaps: `gates.ts` does **not** exist (`gates.test.ts` is the DoD property suite over `dod.ts`); **`harvest.ts` does not exist anywhere**; `engine.runPhaseAsync`'s absence from headless is deliberate and covered (headless `runPhase` = same liveLayer + deterministic floor + bare-Node overlay).

---

## 1. The two surfaces that exist right now (verified)

### 1.1 `src/lib/headless.ts` — the file-backed driver (42 exports)

loadProject, saveProject, createProject, runPhase, runUntilGate, approve, reject, **retry** (523-525), ReportRejectedError, ingest, packet, exportJson, summary, filename, buildVault, vaultMarkdown, vaultIndex, splitVaultBlocks, vaultFileFor, writeVault, vaultSearch, runCrew, verifyGeneratedSource, withCommonJsExports, applyVerifyOutcome, designTokens, designHtml, buildDiagram, listArtifacts, doctorStatus + availability guards (vaultModuleAvailable, designModuleAvailable, diagramModuleAvailable) + types. Engine internals imported read-only: applyPhaseResult/approveHitl/emptyProject/inferName/liveLayer/rejectHitl/stampPacket/unlockRetry (headless.ts:25-34), dod (recordGateInto/runGate), io (import/export), report-intake, phases.

**Dynamic-import seams** (the pattern new subcommands must copy — non-literal specifiers + availability guards, headless.ts:138-139,159,701,906,947,1078,1098,1223,1237,1259,1271,1287): `tavily.server`, `websearch.server`, `deepseek.server`, `vault.ts`, `crew.server.ts`, `verify.server.ts`, `design.ts`, `diagram.ts`, `node-runner.server.ts`.

### 1.2 `scripts/rapidtool-cli.mjs` — 17 subcommands (verified case-by-case, cli.mjs:204-503)

| cmd | driver fn | exit 0 payload | parked / special exit |
| --- | --- | --- | --- |
| create | createProject+saveProject | path, summary | brief missing → 1 |
| run (1 step) | runUntilGate maxSteps=1 | summary, steps, stopped, events | awaiting_hitl\|blocked → 2 |
| gate | runUntilGate | summary, steps, stopped, events | awaiting_hitl\|blocked → 2 |
| approve | approve (+--force) | path, summary | no pending gate → 1 |
| reject | reject | path, summary | note <12 chars / no gate → 1 |
| **retry** | **— NOT PRESENT** (headless.retry exists) | | **P0-G1** |
| ingest | ingest | path, summary, applied | rejected report → 1 (trail persisted) |
| packet | packet | packet text or --out file | — |
| export | exportJson | full JSON + summary | — |
| summary | summary | summary | — |
| vault | writeVault | count, dir | module absent → 1 |
| search | vaultSearch | query, count, results | — |
| crew | runCrew | messages, artifacts, stopped | not-configured → 3; error → 4 |
| verify | verifyGeneratedSource (+--apply) | status/iterations/evidence/cases/finalSource | no source → 1; failed → 1; not-configured → 3; error → 4 |
| design | designTokens (+--html) | tokens (+htmlWritten) | module absent → 1 |
| diagram | buildDiagram | kind, bytes (+svgWritten) | unknown kind/module → 1 |
| artifacts | listArtifacts | count, items | — |
| doctor | doctorStatus | llm/research/runner/node | — |

Mutating commands write back atomically (write-then-rename, headless.ts:58-74); read-only commands never touch the project file.

---

## 2. Module inventory + consumer state (the ground truth for the audit wave)

Every `src/lib/*.ts` production module, its export surface theme, and **who actually calls it** (repo-wide grep, tests excluded, 2026-09-06). Buckets: **WIRED** (has a live consumer), **PARTIAL** (consumed for a subset of its API), **ORPHAN** (zero production call sites), **UI-ONLY** (browser/console consumer, no headless path).

| module | surface theme | consumers | state |
| --- | --- | --- | --- |
| engine.ts | synthesis, gates, liveLayer, deepenResearch(1775), verifyPriorPhases(1892), runPhaseAsync(1928), runP6Real(1949), wildStep(2304) | store.ts, headless.ts, dod.ts(runP6Real), console(deepenResearch), gates.test | WIRED — but 4 exports not headless-reachable (G3/G4/G8) |
| store.ts | zustand+persist browser driver (localStorage), wild-run actions, dynamic runPhaseAsync (store.ts:396-415) | console.tsx (UI) | UI-ONLY by design — browser driver, never headless |
| phases.ts / dod.ts / io.ts / packet.ts / report-intake.ts / algorithms.ts / sandbox.ts / types.ts | 13-phase graph; DoD gates+evidence hash; JSON import/export; agent packet; report validation; lattice/spec/oracle; P6 template+self-test | engine, headless, store | WIRED (engine internals) |
| headless.ts | file driver (see 1.1) | rapidtool-cli.mjs | WIRED |
| crew.ts / crew.server.ts | advisory crew orchestrator (planning-backed) | console (crew.ts), headless+CLI (crew.server) | WIRED |
| verify.ts / verify.server.ts | machine verify-fix loop, oracle cases, lint | headless+CLI (verify.server); verify.ts = UI server-fn | WIRED (CLI path via .server) |
| vault.ts | Obsidian vault notes, MOC, search, trace notes | console, headless(+CLI), **tracing.ts** | WIRED |
| design.ts / diagram.ts | design tokens + HTML; 3 SVG diagrams | console, headless(+CLI) | WIRED |
| tracing.ts | pure agent-run trace model | vault.ts (traceNote) | PARTIAL (see G10) |
| planning.ts | planSteps/reflect/backtrack, critique system | crew.server.ts only | PARTIAL (G9) |
| deepseek.server / tavily.server / websearch.server / node-runner.server / research.ts / llm.ts / llm-tasks.ts / exec.ts | live backends (env+fetch or server-fn), statuses, bounded runner | engine, store, headless (doctor/overlay), chat.server, wild-mode.server | WIRED (bare-Node friendly where headless needs them) |
| wild-mode.server.ts | DeepSeek wild classifier | engine.wildStep | WIRED — but only reachable via store (G3) |
| chat.ts / chat.server.ts | grounded copilot | console only (`chatOnce` = createServerFn, chat.ts:24-41) | UI-ONLY (G6) |
| errors.ts | 14-code RT_E registry, classifyError, ERROR_CODE_DOC | all result paths; CLI via prose classifier | WIRED — CLI reachability broken (G2) |
| **swarm.ts** | advisory swarm: SWARM_ROLES/seats, swarmPlan, parallelDag, branchSuggest (886 L, pure) | **none** (crew.test.ts imports fixtures only) | ORPHAN (G5) |
| **algo-tools.ts** | spec→algorithm, property tests, complexity, bench harness (G-27..29) | none | ORPHAN (G7) |
| **arch-tools.ts** | dependency graph, codebase map, ADR (G-30..32) | none | ORPHAN (G7) |
| **ast-mine.ts** | codebase mining, convention map (Pillar 5) | none | ORPHAN (G7) |
| **knowledge.ts** | JSON cross-project pattern store (Pillar 11) | none | ORPHAN (G7) |
| **prompt-engine.ts** | hyper-prompt expansion + policies | none | ORPHAN (G7) |
| **scaffold.ts** | scaffold emitter + deploy notes (E-15/E-27) | none | ORPHAN (G7) |
| **vector.ts** | logo/icon/badge/brand SVG gen + sanitize (G-37/38) | none | ORPHAN (G7) |
| **bench.ts** | dry-run estimates (token/time/complexity/failure) | verify.server.ts imports only 2 scrub helpers | PARTIAL-ORPHAN (G7) |
| **watcher.ts** | bounded reverse-handoff fs.watch (Pillar 7) | none (header: explicit opt-in) | ORPHAN (G7) |
| db.ts, gate-stats.ts, handoff.ts, render.ts, templates.ts, preview-*, auth/*, app-data/*, multiplayer/*, og/*, testing/* | infra / console helpers / preview bridge / auth | console + engine paths | WIRED (not agent-facing) |

Absent (verified): **no `harvest.ts`**, **no `gates.ts`** (`gates.test.ts` is the DoD property suite importing `dod.ts`), **no `wild-mode.ts`** (classifier is `.server.ts`).

---

## 3. Master capability → coverage matrix

Legend — CLI: subcommand present? Headless: export present? JSON: single-JSON envelope? Exit: exit-code contract? RT_E: does a *useful* RT_E_* code reach the envelope on failure (not UNKNOWN)? Idem: safe/deterministic re-run? Verdict: **WIRED / PARTIAL / GAP(P0-P2)**.

### A. Lifecycle & gates (the core agent loop)

| Capability | Owner | CLI | Headless | JSON | Exit | RT_E | Idem | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| create project from brief | headless.createProject | create | ✓ | ✓ | 0/1 | ✓ (ENOENT→MISSING) | ✓ | WIRED |
| load/save project file (atomic) | headless.load/saveProject | (implicit) | ✓ | ✓ | 0/1 | ✓ | ✓ | WIRED |
| advance exactly one phase | runUntilGate(1) | run | ✓ | ✓ | 0/2 | – (ok:true) | ✓ | WIRED |
| advance until parked / complete | runUntilGate | gate | ✓ | ✓ | 0/2 | – (ok:true) | ✓ | WIRED |
| deterministic phase synthesis (all 13) | engine.applyPhaseResult via headless | run/gate | ✓ | ✓ | 0/2 | – | ✓ | WIRED |
| live research + narrative during run | headless bareNodeLiveOverlay (research phases 0/7/11) | run/gate --live | ✓ | ✓ | 0/2 | ✓ degraded to deterministic (never throws, headless.ts:253-255) | ✓ | WIRED |
| autopilot gate decisions (policy-safe) | headless canAutopilot + deniedGateLog | gate --autopilot | ✓ | ✓ | 0/2 | – | ✓ | WIRED |
| approve gate (+ --force) | headless.approve | approve | ✓ | ✓ | 0/1 | ✗ RT_E_GATE_PENDING unreachable → UNKNOWN (G2) | ✓ (guarded) | WIRED* |
| reject gate with ≥12-char note | headless.reject | reject | ✓ | ✓ | 0/1 | ✗ UNKNOWN (G2) | ✓ (guarded) | WIRED* |
| **retry a rejected phase** | headless.retry (523) | **–** | ✓ | – | – | – | – | **GAP P0 (G1)** |
| ingest external agent report (append-only) | headless.ingest | ingest (@file/-/inline) | ✓ | ✓ | 0/1 | ✗ name-based codes lost — CLI passes `err.message` string only, so REPORT_INVALID/PHASE_MISMATCH → UNKNOWN (G2) | ✓ (duplicate-safe) | WIRED* |
| compile agent packet | headless.packet | packet | ✓ | ✓ | 0 | – | ✓ | WIRED |
| full project JSON export | headless.exportJson | export | ✓ | ✓ | 0 | – | ✓ | WIRED |
| compact summary snapshot | headless.summary | summary | ✓ | ✓ | 0 | – | ✓ | WIRED |
| artifact index (id/phase/kind/title/bytes) | headless.listArtifacts | artifacts | ✓ | ✓ | 0 | – | ✓ | WIRED |
| stdout purity / single JSON / no chatter | respond() cli.mjs:89-110, 505-512 | all | – | ✓ | – | – | – | WIRED (verified incl. internal-error path: stack → stderr only) |

### B. Knowledge layer

| Capability | Owner | CLI | Headless | JSON | Exit | RT_E | Idem | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| materialize Obsidian vault (1 md/note + MOC) | headless.writeVault | vault | ✓ | ✓ | 0/1 | ✗ module-absent → UNKNOWN (G2) | ✓ deterministic | WIRED* |
| vault search (token-overlap) | headless.vaultSearch | search | ✓ | ✓ | 0 | – | ✓ | WIRED |
| vault markdown / index / blocks / per-file split | headless.vaultMarkdown/vaultIndex/splitVaultBlocks/vaultFileFor | via vault | ✓ | – | – | – | ✓ | WIRED (headless-level) |
| **trace notes in vault** | tracing→vault.traceNote | – | buildVault only | – | – | – | – | GAP P2 (G10: no spans recorded on headless runs) |

### C. Agent / verification layer

| Capability | Owner | CLI | Headless | JSON | Exit | RT_E | Idem | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| advisory crew over current phase | crew.server.runCrewServer | crew | ✓ | ✓ | 0/3/4 | ✓ exit-3 pin = LLM_NOT_CONFIGURED; runtime failures → UNKNOWN (G2) | ✓ advisory, no state write | WIRED* |
| machine verify-fix loop on generatedSource | verify.server.verifyAndFixServer | verify | ✓ | ✓ | 0/1/3/4 | ✗ failed/error → UNKNOWN (RT_E_RUNNER_FAILED unreachable) (G2) | ⚠ --apply appends verify artifact per run (by design) | WIRED* |
| persist verify outcome (lastTest label "tested" + evidenceHash) | headless.applyVerifyOutcome | verify --apply | ✓ | ✓ | 0 | – | ⚠ append-per-run | WIRED |
| CommonJS-export shim for verify harness | headless.withCommonJsExports | internal | ✓ | – | – | – | ✓ | WIRED |
| capability pre-flight (llm/research/runner/node, real probes) | headless.doctorStatus | doctor | ✓ | ✓ | 0/4 | ✗ (never throws by design) | ✓ | WIRED |
| **Wild Mode autonomous step** | engine.wildStep (2304) + wild-mode.server classifier | **–** | **–** | – | – | – | – | **GAP P1 (G3)** — store.ts-only (store.ts:8, wildRun actions) |
| **post-hoc deepen research on completed P0/P7/P11** | engine.deepenResearch (1775) | **–** | **–** | – | – | – | – | **GAP P1 (G4)** — console-only (console.tsx:4467) |
| **re-verify sealed phases for drift** | engine.verifyPriorPhases (1892) | **–** | **–** | – | – | – | – | **GAP P2 (G8)** — zero call sites |
| live engine phase run w/ server backends | engine.runPhaseAsync (1928) | – | (equiv: runPhase liveLayer+overlay) | – | – | – | – | NOT A GAP — headless parity deliberate (headless.ts:20-23, 233-256); browser store uses dynamic runPhaseAsync (store.ts:396-415) |
| P6 real bounded run of generated module | engine.runP6Real (1949) | – | – | – | – | – | – | COVERED BY SUBSTITUTE — verify cmd runs the same source through node-runner cases bare-Node; runP6Real itself stays browser/dod-internal (consumers dod.ts, store.ts) |

### D. Design / artifact layer

| Capability | Owner | CLI | Headless | JSON | Exit | RT_E | Idem | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| design tokens (deterministic) | design.ts via headless.designTokens | design | ✓ | ✓ | 0/1 | ✗ module-absent → UNKNOWN (G2) | ✓ | WIRED* |
| standalone design-system HTML | design.ts via headless.designHtml | design --html | ✓ | ✓ | 0/1 | ✗ | ✓ | WIRED* |
| SVG diagrams (phases/architecture/flow) | diagram.ts via headless.buildDiagram | diagram --kind | ✓ | ✓ | 0/1 | ✗ unknown kind → UNKNOWN (G2; registry says VALIDATION) | ✓ | WIRED* |
| generated-source scaffold / deploy notes | scaffold.ts | – | – | – | – | – | – | GAP P2 (G7) |
| vector logo/icon/badge/brand generation | vector.ts | – | – | – | – | – | – | GAP P2 (G7) |

### E. Live backends / copilot

| Capability | Owner | CLI | Headless | JSON | Exit | RT_E | Idem | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| grounded chat copilot | chat.server.chatOnceServer (bare-Node friendly: imports deepseek.server/phases/errors/types only) | **–** | **–** | – | – | – | – | **GAP P1 (G6)** — chat.ts wraps it in createServerFn (chat.ts:24-41), unusable under bare Node |
| live research primitives (tavily/free/deepseek) | .server.ts modules | via --live + doctor | dynamic imports | ✓ | – | – | ✓ | WIRED (indirect; direct deepen = G4) |
| algorithm workbench (spec→algo, property tests, complexity) | algo-tools.ts | – | – | – | – | – | – | GAP P2 (G7) |
| codebase mining + conventions | ast-mine.ts | – | – | – | – | – | – | GAP P2 (G7) |
| architecture surface on real code (dep graph, codebase map, ADR) | arch-tools.ts | – | – | – | – | – | – | GAP P2 (G7) |
| dry-run bench estimates | bench.ts public API | – | – | – | – | – | – | GAP P2 (G7; scrub helpers only are wired to verify.server) |
| swarm advisory plan / parallel DAG / loop-back | swarm.ts | – | – | – | – | – | – | GAP P1 (G5) |
| standalone plan / reflect / backtrack | planning.ts | via crew only | – | ✓ (crew) | 0/3/4 | – | ✓ | PARTIAL (G9) |
| cross-project pattern store | knowledge.ts | – | – | – | – | – | – | GAP P2 (G7) |
| prompt expansion + policy constraints | prompt-engine.ts | – | – | – | – | – | – | GAP P2 (G7) |
| reverse-handoff output watcher | watcher.ts | – | – | – | – | – | – | GAP P2 (G7, header-declared opt-in) |

### F. Cross-cutting contracts

| Contract | State | Evidence |
| --- | --- | --- |
| exit-code taxonomy (0 ok / 1 usage-validation / 2 parked / 3 not-configured / 4 internal) | WIRED (16 of 17 cmds; retry cmd missing) | cli.mjs:183-511; README-cli.md:279-294 |
| RT_E_* on every failure envelope | **PARTIAL — G2 (P0)**: only ENOENT→PROJECT_MISSING, timeout-prose→LLM_TIMEOUT, exit-3 pin→LLM_NOT_CONFIGURED ever appear; every other failure = RT_E_UNKNOWN fallback (classifyError default, errors.ts:64-67) | cli.mjs:89-110 |
| honest not-configured / degraded-to-deterministic everywhere | WIRED | headless.ts:130-228, 253-255; doctor never throws (1256-1294) |
| stdout purity | WIRED | cli.mjs:108, 505-512 |
| atomic writes / no partial state | WIRED | headless.ts:58-74; ReportRejectedError trail persists (cli.mjs:299-309) |
| module-availability guards degrade cleanly (vault/design/diagram) | WIRED | headless.ts:681-687, 1049-1064; exit 1 |

---

## 4. Ranked wiring gaps (this feeds the audit wave's wiring work)

### P0 — must fix in the wiring wave

**G1. CLI has no `retry` — rejected phases are a CLI dead end.**
- Evidence: `headless.retry` exists and is unit-tested (`headless.ts:523-525`; `headless.test.ts:211` "reject → retry → regenerate applies the note and unblocks"); the reject path parks the project `blocked` with error `"Phase rejected — retry with the note applied."` (`headless.ts:381-383`); `rapidtool-cli.mjs` switch (204-503) has cases for approve/reject but none for retry; README-cli.md:334-382 agent loop has no reject/retry branch at all.
- Impact: any agent that honestly `reject`s a phase (the product's core governed-iteration mechanic, engine.ts:966-1016) can never resume that project through the CLI — the loop dies exactly where iteration is supposed to happen.
- Fix (small, mechanical): add `case "retry"` → `loadProjectFor`, state-guard (phase record `rejected` / status `blocked`), `h.retry(project)`, `h.saveProject`, respond `{ok:true, path, summary}` exit 0; wrong state → exit 1. Add CLI-level test mirroring `headless.test.ts:211` + a reject→retry→gate exit-taxonomy test. Optional `--note` no (note is already applied at reject time).

**G2. CLI `code` field is `RT_E_UNKNOWN` for nearly every domain failure — the branch-on-code contract is fiction today.**
- Evidence: `respond()` sets `code` only by (a) pinning `RT_E_LLM_NOT_CONFIGURED` when exit 3 (cli.mjs:93-95) or (b) running the *prose* through `classifyError` (cli.mjs:97-104), whose matchers are ENOENT / timeout prose / `ReportRejectedError` **by error name** (errors.ts:64-106) — and the CLI passes `err.message` (a string), so the name branch can never fire. Result: approve-no-gate → should be `RT_E_GATE_PENDING` (README-cli.md:322), is `RT_E_UNKNOWN`; ingest rejection → should be `RT_E_REPORT_INVALID/PHASE_MISMATCH`, is `RT_E_UNKNOWN`; verify `failed` → should be `RT_E_RUNNER_FAILED`, is `RT_E_UNKNOWN`; unknown diagram kind → should be `RT_E_VALIDATION`, is `RT_E_UNKNOWN`; module-absent vault/design/diagram → `RT_E_UNKNOWN`. README-cli.md:296-332 documents "codes never replace the exit-code taxonomy… agents should branch on `code` first" — unverifiable on real envelopes.
- Fix: two options, cheapest first — (1) CLI-level domain pins per call site exactly like the exit-3 pin (approve/reject guard → `RT_E_GATE_PENDING`; ingest ReportRejectedError → `REPORT_INVALID`/`REPORT_PHASE_MISMATCH`; verify failed/error → `RUNNER_FAILED`; diagram unknown kind & missing-module and vault/design module-absent → `RT_E_VALIDATION`); (2) stronger — make `headless.ts` throw a `CodedError` carrying `code` (errors.ts `codeError` shape) and have `respond()` pass `err.code` through, which also fixes engine-thrown phase errors on run/gate (`RT_E_PHASE_ILLEGAL`). Update README-cli.md table only after codes actually appear.

### P1 — capabilities that exist but no agent can reach

**G3. Wild Mode has no headless driver / CLI.**
- Evidence: `engine.wildStep` (engine.ts:2304, one bounded macro-action + classifier review + ledger) is imported only by `store.ts` (store.ts:8) and its types; the classifier `wildClassifierReview` comes from `wild-mode.server.ts` (bare-Node friendly — env+fetch DeepSeek). Nothing in headless.ts or the CLI touches it.
- Fix: headless `runWild(project, {maxSteps, enforceDod})` mirroring `runUntilGate` (loop `wildStep`, stop on `outcome: advanced→hitl park?/completed/paused/noop/cap`) + CLI `wild` cmd (exit 0 advance / 2 parked / 3 not-configured / 4 error; needs DEEPSEEK_API_KEY, honest not-configured). Test: keyless → exit 3 shape; with stub reviewer → capped loop.

**G4. Post-hoc "deepen research" is console-only.**
- Evidence: `engine.deepenResearch` (engine.ts:1775, refreshes live corpus + narrative on a *completed* P0/P7/P11) is invoked from console only (console.tsx:4467 `DEEPEN_ACTION_NAMES`); headless only fires research *during* synthesis via `bareNodeLiveOverlay` (headless.ts:130-228) — a completed phase can never be re-deepened from the CLI.
- Fix: headless wrapper reusing the existing overlay primitives (`tavilySearch`/`freeWebSearch`/`completeDeepSeek`, researchQueryFor parity at headless.ts:117-121) gated to completed research phases, + CLI `research --project <f> [--phase 0|7|11]` exit 0 (artifacts added) / 1 (not a research phase or not complete) / 3 (no backend reachable — honest).

**G5. `swarm.ts` (886 L advisory planner) has zero production consumers — wire or prune decision needed.**
- Evidence: repo-wide grep — only `crew.test.ts` imports `./swarm.ts` (crew.test.ts:21, for SWARM_ROLES/seats/swarmPlan fixtures). Header declares Pillars 2+9 advisory layer, pure, "never dispatches" (swarm.ts:1-12). `crew.server.ts` uses `planning.ts` (crew.server.ts:29-30), not swarm.
- Fix (decision first): if swarm is the intended next-gen crew planner, wire headless `swarmPlanFor(project)` + CLI `swarm plan` (pure — no key needed) and route crew's planner through it; otherwise file an explicit prune/absorb note so the audit wave does not re-discover it. Either way, register the decision in this doc's successor.

**G6. Chat copilot is UI-only and cannot run under bare Node.**
- Evidence: `chat.ts` is a thin `createServerFn` wrapper (chat.ts:24-41) — "No Start context found in AsyncLocalStorage" under bare Node; its server body `chatOnceServer` (chat.server.ts) imports only deepseek.server/phases/errors/types = **bare-Node friendly**, exactly like crew.server/verify.server which headless already dynamic-imports.
- Fix: headless `chatTurn(project, text, history?)` dynamic-importing chat.server.ts directly (crew pattern, headless.ts:906-908) + CLI `ask --project <f> --text "…"` exit 0 (reply+grounded flag) / 3 (not-configured) / 4. Cheap, high agent value (grounded Q&A beats re-reading packets).

### P2 — orphan pillars / polish (wire only if the wave has budget; else register + defer)

**G7. Ten modules with zero production call sites (verified by grep, tests excluded).** Each is complete + unit-tested but unreachable by any user or agent:
- `algo-tools.ts` (spec→algorithm G-27..29: specToAlgorithm, propertyTestsFor, complexityOf, benchmarkHarness) — natural fit: a headless `algo-spec` + `algo-test` pair or inclusion in the verify cmd's oracle seeding (verify.server already imports bench.ts scrub helpers — same family).
- `arch-tools.ts` (dependencyGraph, codebaseMap, adrRecord) + `ast-mine.ts` (mineCodebase, conventionsMap, respectConventions, Pillar 5) — natural fit: one CLI `audit`/`map --project-dir` capability over generated/agent code (note: both expect *files on disk*, so they fit CLI better than headless-in-memory).
- `knowledge.ts` KnowledgeStore (Pillar 11, JSON-backed cross-project) — fits an agent-facing `knowledge add|query` if the wiring wave wants cross-project memory; otherwise defer.
- `prompt-engine.ts` expandBrief/applyPolicies — fits `create --expand` before phase 0.
- `scaffold.ts` scaffoldProject/deplyNotes (E-15/E-27) — the only emitter of runnable project scaffolds + honest deploy notes; fits CLI `scaffold --project <f> --out <dir>` + `deploy-notes`.
- `vector.ts` generateLogo/generateIconSet/generateBadge + sanitizeSvg (G-37/38) — deterministic floor is headless-safe; LLM path needs keys; fits `design --logo`/`design --icons` extension of the existing design cmd.
- `bench.ts` public estimate API (estimateTokenCost/complexityScore/projectedTime/failurePointScan) — fits `bench --project <f>` dry-run (zero keys, pure).
- `watcher.ts` startWatcher (Pillar 7, header-declared opt-in) — by design not auto-wired; leave opt-in but document the CLI-less state.
**G8. `engine.verifyPriorPhases` (engine.ts:1892) — zero call sites repo-wide.** Dead export today; wiring wave: either surface as headless `auditDrift(project, files)` + CLI `audit --files …` (feeds the regression-discipline goal from 02 §B2) or delete. Register the choice.
**G9. planning.ts standalone (planSteps/reflect/backtrack)** is only reachable through `crew` (crew.server.ts:29). Optional `plan --project <f>` / `reflect` CLI; low urgency since crew covers the loop.
**G10. Tracing never fires on headless runs.** vault.ts consumes tracing for `traceNote` (vault.ts:74-75) but nothing in the headless/CLI path calls `createTrace`/`recordSpan` — CLI vaults therefore never contain trace notes. Optional `--trace` on run/gate + trace note in vault; low urgency.

### Explicit non-gaps (so the audit wave does not re-invent them)
- **No `harvest.ts`** anywhere (checked `src/lib` + `find`); the advisory layer is swarm.ts/crew.
- **No `gates.ts`** — `gates.test.ts` is the DoD property suite over `dod.ts` (verified imports, gates.test.ts:10-22).
- **`store.ts` is browser-only by design** (zustand + persist/localStorage, store.ts:456) — do not port it; headless.ts is the agent surface. Its one headless-relevant behavior (engine.runPhaseAsync dynamic use, store.ts:396-415) has an explicit headless equivalent (headless.ts:233-256).
- **`runP6Real`** (real bounded run of the P6 module) stays browser/dod-internal; the bare-Node equivalent for agents is the `verify` cmd (same source through node-runner oracle cases). Wiring wave should not double-expose it.
- **exit-2 semantics are honest**: parked `awaiting_hitl`/`blocked` = exit 2 with full state on stdout; `cap`/0-progress runs exit 0 with `steps:0`/`stopped:false` — agents must read `steps`/`stopped`, never `ok` alone (README-cli.md:91-94, cli.mjs:215-239).

---

## 5. Feed-forward checklist for the final 6-agent wiring wave

1. **G1 first** (tiny, unlocks the reject loop), then **G2** (code pins at respond sites / CodedError pass-through).
2. **G3 + G4** share one pattern (headless loop/wrapper over existing engine/bare-Node primitives + honest exit-3) — one agent can land both plus **G6** (same dynamic-import pattern as crew).
3. **G5** needs a product decision (wire swarm as crew planner vs prune) — assign to the audit lead, not a builder.
4. **G7** batch: prefer the *cheap consumer* approach — one new `map`/`audit`/`scaffold`/`bench` CLI each only where the module takes file paths (arch-tools/ast-mine/scaffold/bench); defer knowledge/prompt-engine/vector/watcher with an explicit defer note.
5. Regression anchors to keep green: `node --experimental-strip-types --test src/lib/headless.test.ts` (43 it-cases incl. CLI exit-taxonomy tests at headless.test.ts:495-666), `gates.test.ts`, and sibling suites (vault/crew/verify/design/diagram/errors). Every new CLI case must add a taxonomy test (0/1/2/3/4) in headless.test.ts's CLI describe block.
6. Update `scripts/README-cli.md` command list + RT_E table **in the same change** that adds codes — the doc is the agent-facing contract and already drifts (no retry, code table aspirational).
