<!-- CLI-ANCHOR-DOSSIER — research/multiagent/34_cli_anchors.md -->
# 34 · CLI wiring anchor map — module surfaces + per-subcommand build cards

**Role:** Flash helper F2 (anchor pre-computation), read-only on source.
**Produced:** 2026-09-06 ~09:35 CDT. **For:** the new-CLI-wiring wave's Pro agents (wiring the landed pillar modules into `scripts/rapidtool-cli.mjs`).
**Verification standard:** every file:line below was re-grepped/re-read against on-disk bytes this pass. Zero invented anchors. Where a fix queue item is still open, it is marked **OPEN** with its dossier pointer — do not re-derive it.

---

## 0 · Anchor-drift warning (read first — a fix wave touched the repo minutes before this doc)

Source mtimes at write time (`stat`, 09:28 CDT):

| file | mtime | meaning |
|---|---|---|
| `src/lib/store.ts` | 09:17 | wild actions just landed (dossier-23 B0 queue being applied by an in-flight builder) |
| `src/lib/engine.ts` | 09:14 | wild guards/finalize fixes landed; wild anchors below are POST-fix and current |
| `src/components/console.tsx` | 09:10 | B0 queue (not a CLI anchor) |
| `src/lib/chat.server.ts` | 08:57 · `wild-mode.server.ts` 08:58 | stable since |
| `scripts/rapidtool-cli.mjs` | 09:01 | **`retry` case + approve/reject `RT_E_GATE_PENDING` literals already landed** (C1/C2 queue partially applied) |
| `src/lib/headless.ts` | 05:48 | **UNCHANGED since before the pillar wave — exports nothing for swarm/prompt-engine/bench/mine/knowledge/watcher/wild/harvest** (dossier-23 C1 matrix still fully open for these) |
| pillar modules (`swarm/prompt-engine/bench/ast-mine/knowledge/watcher`) | 07:52–08:54 | landed, stable |

**Rule for every Pro agent: verify each anchor by re-grep at apply time** (repo-wide practice, dossier-23 §Appendix). If a sibling is mid-edit on `engine.ts`/`store.ts`, `stat -c '%y'` first and attribute.

---

## 1 · CLI anatomy — insertion points, envelope choke point, loader seams (scripts/rapidtool-cli.mjs, 573 lines, verified 09:35)

### 1.1 Case-insertion map (switch at `:204-531`)

Current cases, verified this pass:

| verb | case line | verb | case line |
|---|---|---|---|
| create | `:205` | search | `:390` |
| run / gate (shared) | `:215-216` | crew | `:405` |
| approve | `:241` | verify | `:428` |
| reject | `:255` | design | `:472` |
| **retry (LANDED 09:01)** | `:277` | diagram | `:491` |
| ingest | `:295` | artifacts | `:511` |
| packet | `:343` | doctor | `:518` |
| export | `:357` | default (unknown verb) | `:529` |
| summary | `:371` | USAGE object | `:549-571` |
| vault | `:377` | `main()` call | `:573` |

- **Recommended single insertion point for ALL new cases:** between the `artifacts` block end (`:516`) and `case "doctor"` (`:518`). One diff site, one review.
- **USAGE:** add one row per verb inside `commands` (`:551-570`), after the `artifacts` row (`:568`), before `doctor` (`:569`). Style = `verb: "verb --project <file.json> [flags]   # one-line hint"` (see `:552-569`).
- **Missing subcommand** → `respond({ok:false, error, usage: USAGE}, 1)` `:183-186`; unknown verb → same at `:529-530` (auto-`code` via classify, falls to `RT_E_UNKNOWN`).

### 1.2 The `respond()` choke point (exact contract — `:89-110`)

```js
function respond(result, exitCode) {
  const out = { schema_version: SCHEMA_VERSION, cmd: CMD ?? null, ...result };
  if (out.ok === false && typeof out.code === "undefined") {
    if (exitCode === 3) { out.code = "RT_E_LLM_NOT_CONFIGURED"; }   // exit-3 pin :94-95
    else { out.code = classify(text-from-error-or-reason) || omit; } // :96-105 (text classifier)
  }
  out.exit_code = exitCode;
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  process.exit(exitCode);
}
```

Facts new verbs must honor:
- One JSON object on stdout, then `process.exit` — never return after `respond`.
- `schema_version`/`cmd`/`exit_code` are auto-added; `ok:true` envelopes NEVER gain `code`.
- Pre-supplying `code:` in the result object passes through untouched (`:91`) — precedent: approve/reject no-gate literals `RT_E_GATE_PENDING` (`:245`, `:259`), retry wrong-state `RT_E_PHASE_ILLEGAL` (`:284`). **Use literals for every arm you can name; the text classifier (`classify`) only fires on ENOENT/report-rejection prose and otherwise yields `RT_E_UNKNOWN`.**
- `classify` is a **text-only** wrapper (`ensureErrorCodes` `:119-142` — it calls `classifyError(text)` on a string; error objects never reach it; dossier-23 C2/27 P0-1 still **OPEN**: `:128-138`). Don't design around object classification.

### 1.3 Exit taxonomy (README-cli.md `:284-294`, `:296-332`)

| exit | meaning | usage in envelopes |
|---|---|---|
| 0 | executed, payload produced | estimates, advisory output, complete runs |
| 1 | could not execute (args/project/missing module/validation/state guard) | `loadProject` failure via `makeLoader` `:190-198`, `requireArg` `:72-78`, approve/reject/retry state guards |
| 2 | parked awaiting human / blocked | run/gate parked arm `:226-237` |
| 3 | backend not configured | crew `:422`, verify `:459-461`; auto-pins `RT_E_LLM_NOT_CONFIGURED` |
| 4 | internal/backend runtime failure, stack to STDERR only | outer catch `:532-539`, crew `:422`, verify `:461-468` |

### 1.4 Argument helpers

- `parseArgs` `:42-70` — `--flag value` | `--flag=value` | bare booleans; **last occurrence wins, no repeatable flags**; positionals accumulate in `args._` (so `args._[1]` is available for a `knowledge` subcommand). Unknown flags are silently collected (validate manually per verb).
- `requireArg(args, key, cmd)` `:72-78` → `{error}` when missing/blank (exit 1 with the error text).
- `flag(args, key)` `:80-82` — accepts `true|"true"|"1"`.
- `loadProjectFor(cmd)` = `makeLoader(h)` `:190-198` — missing/bad project → exit 1 (ENOENT prose → `RT_E_PROJECT_MISSING`); throws inside are caught by the outer handler → exit 4. Every project-taking verb MUST use it (or `requireProjectPath` `:543-547` for the path string) before any writer.
- Writers: `h.saveProject(path, project)` atomic write-then-rename (headless.ts `:58-74`). Mutating verbs (`run/gate/approve/reject/retry/ingest`) all persist then respond; read-only verbs never save.
- Multi-line payload ingestion precedent: `readReportSource` `:159-171` (`'@file'`, `'-'` stdin, or inline). Reuse for `--policies`/`--tags`-file style inputs.

### 1.5 Dynamic-import seams in the CLI (the pattern new module loaders copy)

The CLI is `.mjs`; everything it needs from `src/lib/*.ts` arrives via cached runtime imports built on `pathToFileURL` (requires `node --experimental-strip-types`, see header `:12-29`):

- Headless driver loader — `DRIVER_PATH` `:148-150` + `driver()` `:152-156`:
  ```js
  const DRIVER_PATH = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "headless.ts")).href;
  let headless = null;
  async function driver() { if (!headless) headless = await import(DRIVER_PATH); return headless; }
  ```
- errors.ts loader — `ensureErrorCodes()` `:119-142`: same pathToFileURL shape, try/catch-null resilience, memoized.
- **Copy this exact cached-promise + try/catch pattern for each new module import** (e.g. a `swarmModule()`/`benchModule()` helper per verb or one shared `loadLib(name)`). All seven pillar modules below are already on disk (no availability probe needed); `harvest.ts` is NOT (§4).
- Note the fs imports at `:31-33` (`mkdirSync/readFileSync/writeFileSync`, `dirname/join/resolve`, `pathToFileURL/fileURLToPath`) — extend there if a verb walks directories (`readdirSync`/`statSync` are NOT yet imported; `mine` needs them).

### 1.6 CLI test harness (the "test" half of every build card)

CLI contract tests live in **`src/lib/headless.test.ts`** (headless.test.ts owns the suite; comment at `:458-462`). Reusable spawn harness verified this pass:

- `REPO_ROOT`/`CLI_ENTRY` `:463-464`; `runCli(args, opts)` `:466-492` — `spawnSync(process.execPath, ["--experimental-strip-types", CLI_ENTRY, ...args], {cwd: REPO_ROOT, encoding:"utf8", env:{...process.env, DEEPSEEK_API_KEY:"", TAVILY_API_KEY:"", ...opts.env}, timeout:120_000, maxBuffer:64MB})`, asserts spawn OK + stdout parses as ONE JSON object, returns `{code, json, stderr}`.
- `tempDir()` fixture helper in use at `:508`; E-25 describe block starts `:494` (usage errors `:495-505`; create/gate exit-2 parking `:507+`).
- New-verb tests: add describes beside the E-25 block using `runCli` + `tempDir()`. Deterministic verbs need no env; keyed verbs keep the blanked-key default (exit-3 arms are then deterministic).

---

## 2 · headless.ts — the dynamic-import seam for a sibling/new module (src/lib/headless.ts, 1,294 lines, mtime 05:48)

headless.ts currently exports (verified `grep ^export`): `loadProject :50 · saveProject :58 · createProject :81 · runPhase :233 · runUntilGate :441 · approve :498 · reject :518 · retry :523 · ReportRejectedError :533 · ingest :544 · packet :571 · exportJson :576 · summary :607 · filename :641 · vault* :681-875 · runCrew :902 · verifyGeneratedSource :942 · applyVerifyOutcome :961 · designTokens :1111 · designHtml :1127 · buildDiagram :1144 · listArtifacts :1178 · doctorStatus :1256`. **None of the seven pillar module surfaces below are re-exported** — the CLI either gains headless passthroughs (dossier-23 C1 step 1 listed `runBench(project)` / `emitScaffold` / `harvestForPacket` / `wildRunOnce` / `setEnforceDod` as the sanctioned additive plan) or the verbs import the pillar modules directly (§5 loader copy). Both seams are legal under bare Node; **prefer direct module imports for pure/sync modules (swarm/bench/ast-mine/knowledge/watcher) — zero headless churn — and headless-passthrough only if a verb must stay behind one driver facade.**

The canonical "load a sibling module at runtime with a frozen surface" seam is the vault block `:643-710`, the pattern a `harvest`/`wild` passthrough would clone:

- `LIB_DIR = dirname(fileURLToPath(import.meta.url))` `:678`; availability probe `vaultModuleAvailable()` `:681-687` (`existsSync(join(LIB_DIR, "vault.ts"))`); memoized `loadVaultModule()` `:695-710` — `const spec = "./vault.ts"; const mod = (await import(spec)) as Record<string, unknown>;` then per-export `typeof mod[name] !== "function" → throw contract-drift error`.
- Same pattern repeated for design/diagram (`:1028-1098`) and, without a probe, for `.server.ts` modules: `await import("./crew.server.ts")` `:906`, `"./verify.server.ts"` `:947`, `"./tavily.server.ts"` `:138`/`:1237`, `"./websearch.server.ts"` `:139`/`:1223`, `"./deepseek.server.ts"` `:159`/`:1259` (bareNodeLiveOverlay `:130-165` + doctor probes).
- **TanStack rule (only for CLIENT-bundled code):** static `import("./x.server.ts")` is denied by the import-protection plugin; the escape is the computed specifier `"./wild-mode." + "server.ts"` (engine.ts `:2340-2346`). The CLI is bare-Node — plain literal dynamic imports are fine (crew/verify precedent above); do NOT need the concatenation trick in cli.mjs.

---

## 3 · Module export anchors (each pillar module, verified against source 09:30 CDT)

### 3.1 `src/lib/swarm.ts` (886 lines, mtime 08:06) — pure, client-safe, zero deps beyond crew/types

| export | line | signature / shape (verified) |
|---|---|---|
| `SWARM_ROLE_IDS` / `SWARM_ROLES` / `SWARM_STANDING_RULE` | `:70`/`:117`/`:104` | seat specs (5 roles) |
| `seatsForPhase(phase: PhaseId): SwarmRoleId[]` | `:180` | critique seats for a phase |
| `phaseRecord(project, phase): PhaseRecord \| undefined` | `:197` | read-only |
| `frontierOf(project): PhaseId \| null` | `:202` | first non-complete phase |
| `kindsRecorded(project, phase): ArtifactKind[]` | `:210` | recorded kinds per phase |
| `scanForMarkers(text): {severity: "info"\|"warn"\|"block"; note: string}[]` | `:292` | secret/PHI marker scan (advisory) |
| `swarmPlan(project: Project, opts?: {phase?: PhaseId}): SwarmPlanResult` | `:590` | **sync, pure**; `SwarmPlanResult = {ok:true, advisory:true, engineLinear:true, phase, critiques: SwarmCritique[], artifacts: CrewArtifact[], refinedPlan: string}` (`:250-262`; `SwarmCritique` `:233-243` carries `{role, phase, verdict:"keep"\|"revise", summary, findings, provenance:"deterministic", artifact}`) |
| `parallelDag(project: Project): ParallelDagResult` | `:687` | **sync, pure**; `{ok:true, advisory:true, engineLinear:true, frontier, ready: PhaseId[], nodes: PhaseDagNode[] (13), chain: DagChainEdge[], parallelPairs: ParallelPair[], conflicts: ParallelPair[]}` (`:651-676`) |
| `branchSuggest(project: Project): BranchSuggestResult` | `:809` | **sync, pure**; `{ok:true, advisory:true, engineLinear:true, frontier, suggestions: LoopBackSuggestion[], conflictsDetected: number}` (`:788-797`) |
| `isCrewProtocolEmit(type: string): boolean` | `:884` | helper |

All three main functions are **read-only, never throw on well-formed projects, always `ok:true`** → CLI envelope is always exit 0; only project-load/arg failures can exit non-zero. Do not pass an LLM key anywhere — swarm never calls a network.

### 3.2 `src/lib/prompt-engine.ts` (206 lines, mtime 07:52) — **server-only module** (static `import ... from "./deepseek.server.ts"` `:33`); bare-Node import IS safe (CLI may import `.server.ts`-adjacent modules directly; only TanStack `createServerFn` *calls* throw under bare Node, and this module calls `completeDeepSeek` directly, not the server-fn facade)

| export | line | signature / shape |
|---|---|---|
| `ExpandedSpec` | `:36-49` | `{requirements, edgeCases, errorHandling, typeSignatures, dataFlow, negativeConstraints: string[]}` |
| `ExpandBriefResult` | `:51-53` | `{ok:true, spec} \| {ok:false, reason:"not-configured"\|"error", error?}` — **no `code` field**; CLI maps reason |
| caps | `:56-58` | `EXPAND_BRIEF_MAX_CHARS=4000 · EXPAND_POLICY_MAX_CHARS=240 · EXPAND_POLICY_MAX_COUNT=12` |
| `parseExpandedSpecJson(text): ExpandedSpec \| null` | `:84` | tolerant parser, null on no usable requirements |
| `expandBrief(brief: string, policies?: readonly string[]): Promise<ExpandBriefResult>` | `:154` | one flash `json:true` call (maxTokens 3000); not-configured pre-network `:158`; blank-brief validation `:159-161`; unparseable → honest `{ok:false, reason:"error"}` (single attempt, no re-prompt) |
| `applyPolicies(spec: ExpandedSpec, policies?: readonly string[]): ExpandedSpec` | `:189` | PURE negative-constraint injection, fresh object/arrays, dedupe first-wins, model constraints first |

Envelope mapping (mirror the `crew` case `:405-426`): `not-configured` → exit 3 (respond auto-pins `RT_E_LLM_NOT_CONFIGURED`); `reason:"error"` → exit 4 (add optional `code:"RT_E_LLM_REJECTED"`-family literal only if the arm is provably a provider failure — otherwise let classify fall to `RT_E_UNKNOWN`, README `:311`). Success → exit 0 with `spec` (optionally `applyPolicies`-merged when `--policies` given; appending `policies` count in the envelope is honest and additive).

### 3.3 `src/lib/bench.ts` (523 lines, mtime 08:54) — pure, zero-dep, **all exports listed below** (verified `grep ^export` + read)

Types/facts first: `BenchProject` is an all-optional structural subset `{brief?, generatedSource?, artifacts?: readonly BenchArtifactLike[]|null, phases?: readonly BenchPhaseLike[]|null}` (`:25-32`) — **a real `Project` object is assignable and passes straight through** (`loadProjectFor` output can be handed to every estimator unchanged). `BenchArtifactLike = {body?: unknown}`, `BenchPhaseLike = {id?: number|string, status?: string}`. Phase-status weights: complete/rejected = full, running/awaiting_hitl = half, ready/locked = 0 (`:197-209` `phaseStatusWeight`). Every result carries `estimate:true` + exact `method` string + honest `label` (`:35-39` exported label constants).

| export | line | result shape (all fields verified) |
|---|---|---|
| `stripStringsAndComments(source): string` | `:96` | 1:1 index-preserving scrubber (shared with verify.server) |
| `countLooseEquals(scrubbed): number` | `:157` | loose `==` scanner |
| `phaseStatusWeight(status): number` | `:197` | 1 / 0.5 / 0 |
| `participatedPhases(project): PhaseParticipation[]` | `:218` | `{id, status, weight}` rows |
| `minutesForPhase(id): number` | `:235` | `PHASE_MINUTES` table (`:44-58`) |
| `multiplierForPhase(id): number` | `:240` | `PHASE_TOKEN_MULTIPLIERS` (`:63-78`) |
| `estimateTokenCost(project): TokenCostEstimate` | `:267` | `{estimate:true, method, label, tokenEstimate, briefChars, sourceChars, artifactChars, totalChars, sourceTokenEstimate, phaseOverheadTokens, artifactCount, participatedPhases, perPhase:[{id,status,multiplier,tokens}]}` (`:251-265`) |
| `complexityScore(project): ComplexityEstimate` | `:330` | `{estimate:true, method, label, score, level:"low"\|"medium"\|"high", detail:{ifCount,loopCount,switchCount,catchCount,ternaryCount,logicalOpCount,functionCount,artifactCount}}` (`:310-328`) |
| `failurePointScan(project): FailurePointScan` | `:393` | `{estimate:true, method, label, count, advisories:[{code:"missing-exports"\|"long-function"\|"eqeqeq"\|"no-unused-decl", severity:"low"\|"medium"\|"high", message, line:number\|null, occurrences}]}` (`:373-387`) |
| `projectedTime(project): TimeEstimate` | `:500` | `{estimate:true, method, label, minutes, completedPhases, inFlightPhases, participatedPhases, contributions:[{id,status,minutes}]}` (`:489-498`) |
| constants | `:35-82` | `ESTIMATE_DISCLAIMER`, `*_LABEL` ×4, `PHASE_MINUTES`, `DEFAULT_PHASE_MINUTES=30`, `PHASE_TOKEN_MULTIPLIERS`, `DEFAULT_PHASE_TOKEN_MULTIPLIER=1`, `PHASE_OVERHEAD_TOKENS=250`, `LONG_FUNCTION_NEWLINES=40` |

All sync, deterministic, never throw on a real project. exit 0 always (after successful load).

### 3.4 `src/lib/ast-mine.ts` (572 lines, mtime 07:57) — pure (imports `node:path` posix only)

| export | line | signature / shape |
|---|---|---|
| `MineSourceFile` | `:25-28` | `{path: string; body: string}` — the ONLY input type |
| `CodebaseMap` | `:68-81` | `{files: MineFileEntry[], dependencyGraph:{nodes, edges:[{from,to,specifier}], externals, unresolved}, stats:{files, imports, internalEdges, externals, unresolved}}` |
| `mineCodebase(files: MineSourceFile[]): CodebaseMap` | `:383` | deterministic; files/nodes sorted by path; structural mini-lexer — honest scope label in header (`:1-22`) |
| `ConventionsMap` | `:430-442` | `{project: string, fileStyles, functionStyles: Record<string,number>, namedVsDefault:{named, defaultFiles}, topImports:[{specifier,count}] (≤8), notes: string[] (sorted)}` |
| `nameStyle(name): string` | `:444` | kebab-case/snake_case/PascalCase/camelCase/other |
| `conventionsMap(project: string, files: MineSourceFile[]): ConventionsMap` | `:468` | `project` label is caller-chosen (CLI: project `name`); internally calls `mineCodebase` |
| `ConventionPacket` / `ConventionVerdict` | `:518-534` | packet `{name, kind:"function"\|"component"\|"file"\|"symbol", path?}`; verdict `{advisories: string[], injected: string}` (empty when conforming; advisory-only, never enforcement) |
| `respectConventions(packet: ConventionPacket, map: ConventionsMap): ConventionVerdict` | `:541` | pure; dominant-style comparison, ≥2 count floor |

CLI file-collection duty (no helper exists — the verb must walk): recursive `readdirSync` over `--dir`, filter `.ts/.tsx/.js/.json` (reuse `watcher.ts`'s `WATCH_EXTENSIONS` list `:30` as the shared vocabulary — but note `.json` bodies are legal input to the scanner only as inert content), read each `body`, build `MineSourceFile[]`. Deterministic → exit 0.

### 3.5 `src/lib/knowledge.ts` (278 lines, mtime 07:53) — class + types; file format `{version: 1, entries: KnowledgeEntry[]}` (`STORE_VERSION=1` `:77`); atomic tmp+rename writes (`:184-189`); corrupt store REFUSED with throw (`:141-162` — CLI must surface, never repair silently)

| export | line | signature / shape |
|---|---|---|
| `KnowledgeKind` | `:31` | `"brief"\|"pattern"\|"fix"\|"note"` |
| `KnowledgeEntry` | `:33-46` | `{id: "K"+fnv1a-hex, project, kind, title, tags (sorted at save), body, sourcePath?, savedAt: ISO}` |
| `NewKnowledgeEntry` | `:48` | `Omit<KnowledgeEntry, "id"\|"savedAt">` |
| `SaveResult` | `:50-54` | `{entry, appended: boolean}` — idempotent duplicate = `appended:false` |
| `KnowledgeMatch` | `:56-60` | `{entry, score ∈ [0,1]}` |
| `ProvenRow` | `:62-70` | `{source:"knowledge-store", entryId, project, title, score, advice}` |
| `class KnowledgeStore` | `:122` | **constructor `(filePath: string)` `:126`** |
| `entries(): KnowledgeEntry[]` | `:132` | newest last; read-once cache |
| `count(): number` | `:137` | |
| `savePattern(input: NewKnowledgeEntry): SaveResult` | `:166` | append-only, idempotent, throws only on corrupt store/fs errors |
| `findPatterns(query: string, limit = 5): KnowledgeMatch[]` | `:196` | idf-weighted token overlap (title ×2 / tags ×1.5 / body ×1), deterministic tiebreak (`:242-253`); honest label: lexical, NOT embeddings (`:16-20`) |
| `injectProven(project: string, opts?: {limit?, minScore?}): ProvenRow[]` | `:263` | cross-project advisory rows; defaults limit 3, minScore 0.12; self-project rows excluded |

Store path is caller-supplied — the CLI verb needs a `--store <file.json>` flag (default suggestion `./rapidtool-knowledge.json`); `mkdirSync(dirname, {recursive:true})` happens inside `writeStore` `:185`. Sync methods, no LLM, no network → exit 0 on success.

### 3.6 `src/lib/watcher.ts` (225 lines, mtime 07:54) — node:fs `watch` wrapper

| export | line | signature / shape |
|---|---|---|
| `WATCH_EXTENSIONS` | `:30` | `[".ts",".tsx",".js",".json"]` |
| `DEFAULT_DEBOUNCE_MS` / `PENDING_CAP` | `:31`/`:33` | 800 / 200 |
| `WatcherOptions` | `:35-40` | `{debounceMs?, persistent?}` (persistent default true) |
| `WatcherChange` | `:44-48` | `{path: absolute, kind: "created"\|"changed"\|"removed"\|"unknown"}` |
| `WatcherHandle` | `:50-57` | `{id, dir, active, stop(): boolean}` (idempotent close) |
| `startWatcher(dir: string, onChange: (changes: WatcherChange[]) => void, options?: WatcherOptions): WatcherHandle` | `:116` | throws `"watcher.ts: cannot watch ..."` on unwatchable dir `:140`; per-batch debounced flush `:85-99`; fs-level errors recorded on the internal rec, not thrown (`:170-173`) |
| `stopWatcher(handle: WatcherHandle): boolean` | `:179` | true iff it was running |
| `watcherNotes(dir?: string): WatcherNotes` | `:197` | `{active: number, dirs: string[], notes: string[]}` |

**Design caveat for a `watch` verb:** `stop()` cancels the debounce timer and drops the pending batch without calling `onChange` (`stopById` `:101-109`) — a CLI that stops immediately can lose the final in-flight batch. Collect batches in `onChange`, and stop only after an idle gap > debounce (or a grace `setTimeout` past the wall-clock deadline) so the last quiet window flushes first.

### 3.7 `src/lib/engine.ts` — Wild Mode exports (2,425 lines, mtime 09:14, POST-fix)

| export | line | signature / shape (verified post-fix) |
|---|---|---|
| `WildStepOutcome` | `:2006` | `"advanced"\|"completed"\|"paused"\|"noop"` |
| `WildStepResult` | `:2008-2014` | `{project: Project, outcome: WildStepOutcome, ran: boolean, error?: string}` — **NO `code` field** (dossier-23 B5 `code` stamping is still **OPEN** — the CLI must map arms itself) |
| `WildReviewer` | `:2017` | `(ctx: WildReviewContext) => Promise<WildClassifierResult>` |
| `wildLog(p: Project, phase: PhaseId, level: JsonLog["level"], event: string, detail: string): Project` | `:2019` | append log row, `slice(-200)` |
| `wildPause(p: Project, phase: PhaseId, level, event, detail): Project` | `:2043-2052` | `pause:true` + `lastAutoLog` (300-cap) + ledger row |
| `wildStep(project: Project, opts?: {reviewer?: WildReviewer}): Promise<WildStepResult>` | `:2316` | **the headless primitive.** Default reviewer = runtime `await import("./wild-mode." + "server.ts")` → `wildClassifierReview` (`:2344-2346`; computed specifier beats the client-bundle import protection). Never mutates input. One phase per call. Guard arms: no active run → `noop` "No active wild run." (`:2321-2322`); paused → `noop` (`:2324-2325`); blocked project → pause `wild.paused` (`:2327-2335`); already complete → `noop` (`:2337-2338`); missing record → pause `wild.error` (`:2349-2351`); open gate (`awaiting_hitl` or `hitl.phase===phase`) → `wildApproveGate` (`:2354-2355`); complete phase 12 → `wildFinalize` (`:2357-2359`, fn at `:2295`); locked/rejected → pause `wild.paused`/`wild.error` (`:2361-2374`); else execute deterministic floor (`applyPhaseResult`), then gate-approve or `wildLeavePhase` (`:2379-2411`); catch-all → pause `wild.error` (`:2412-2424`) |
| `wildFinalize` (module-local) | `:2295` | stamps `active:false, stoppedAt` + `wild.complete` |

Supporting engine facts a `wild` verb needs:
- Engine imports from wild-mode.server.ts are **type-only** (`:17`); the real reviewer is loaded lazily. Under bare Node the module imports fine; its default `statusFn = llmStatus` (llm.ts `createServerFn` wrapper — throws under bare Node, caught inside `createWildClassifier` `:139-147` → `configured:false`) so the classifier always reports `not-configured` on the CLI host → gate decisions pause with `"Classifier not configured."` (`:2163-2172`), non-gate decisions fall to the deterministic DoD floor (`:2111-2130`). **`createBareWildClassifier` (dossier-23 B2, wild-mode.server.ts `:25`/`:134-181` region) is still OPEN** — until it lands, a keyed CLI host still cannot self-approve gates. Do NOT build the verb around classifier self-approval; build it around honest parking.
- `WildClassifierResult`/`WildReviewContext` live in `wild-mode.server.ts` (`:36-58`) — engine does not re-export them.
- There is NO exported engine/headless "start a run" helper. The canonical start shape is store.ts `startWildRun` `:528-579`: guard `wildMode===true` else error (`:531-532`), guard not-already-active (`:533-534`), complete → `{ok:true, ran:0, stoppedReason:"complete"}` (`:535`), then initial state (`:536-547`):
  ```js
  wildRun: { active: true, phase: p.currentPhase, startedAt: Date.now(),
             lastAutoLog: `Wild run started at P${p.currentPhase}`, lastAutoAt: Date.now(),
             stoppedAt: null, pause: false }
  ```
  then `wildLog(..., "info", "wild.start", ...)` (`:549`) and the driver loop `:555-575`: `for step < 20: res = await wildStep(cur); if (!res.ran) break;` pause → return `paused`; status complete → `complete`; after cap → `wildPause(...,"warn","wild.cap",...)` + `{ok:true, ran, stoppedReason:"cap"}`. `setWildMode` (`:522-527`) turns `wildRun` null when off. Types: `Project.wildMode?: boolean` (types.ts `:334`), `Project.wildRun?: WildRunState | null` (`:336`); session-hydration force-stop precedent engine.ts `:1315-1319`.

---

## 4 · harvest — module ABSENT; Pillar-1 contract (do not invent)

- **On disk: NO `src/lib/harvest.ts`, NO `harvest.test.ts`** (verified `ls src/lib` + `find` this pass; dossier-23 §0 task-0 cap-death; dossier-29 ledger row 5). `src/lib/research.ts` has zero harvest references (mtime 04:08, unchanged).
- **The settled Pillar-1 design contract** is the skill reference `rapidtool-development/references/harvest-pillar-recon.md` (recon-complete/nothing-landed; the wave's parent holds it). Key contract points a harvest verb must compile against (from that reference — type names/fields, keyword-floor query builder, bounded fetcher, row shapes):
  - `HarvestQuery {query, priority:"P0"|"P1"|"P2", focus, source:"keyword-floor"|"llm"}` · `HarvestHit {repo, license: string|null, snippet, url, query, priority, querySource}` · `HarvestRow {kind:"research", provenance:"harvest", title, url, content, repo, license, query, querySource, priority, patterns?}` · `HarvestPattern {type:"function"|"export"|"schema", name, line, excerpt}` · `HarvestTrendNote {severity:"info"|"warning", title, detail, evidence: string[]}`.
  - `buildHarvestQueries(brief, {llm?}) → Promise<HarvestQuery[]>` — deterministic keyword floor (cap 4) + optional LLM json path (cap 8; zero-valid → full floor; `""` brief → `[]`).
  - `harvestRepos(queries, opts {maxQueries=3, maxFetches=4, timeoutMs=12_000, search=freeWebSearch, fetchFn=globalThis.fetch}) → ok-false `RT_E_RESEARCH_UNAVAILABLE` when every search fails; honest empty `{ok:true, hits:[]}` otherwise` — DI knobs are the hermetic-test seam.
  - `extractPatterns(text)` (col-0 regex heuristic, NOT an AST) · `trendNotes(brief, hits)` (curated deprecation rules; no matches → `[]`).
  - `harvestForPacket({brief, name?, domain?}, opts) → {ok, queries, querySource, hits, rows, notes, searches, fetches, code?, error?}` — rows deduped by lowercased URL, priority inherited from query.
  - research.ts additive wiring (when the pillar lands): `export type HarvestPacketInput = {brief: string; llm?: boolean}` + POST createServerFn `harvestPacket(input)` (handler dynamic-imports `./harvest.ts` and `./deepseek.server.ts`; pre-round-trip validation → `RT_E_VALIDATION`).
- **CLI implication:** a `harvest` verb MUST call the bare `src/lib/harvest.ts` functions directly (dynamic import) once the module lands — never the `research.ts` server-fn wrapper (TanStack `createServerFn` calls throw under bare Node). Until the module exists, the verb's loader import throws → honest `{ok:false, error: "harvest module not present"}`, exit 1 (module-missing = documented exit-1 class, README `:290`). Gate the verb's test on module presence or land it in the same change as the pillar re-dispatch.

---

## 5 · Export-name conflict scan (done — none blocking)

- Current `rapidtool-cli.mjs` top-level locals: `parseArgs requireArg flag respond classify(→ensureErrorCodes) driver(→headless) readReportSource main requireProjectPath USAGE` + `SCHEMA_VERSION CMD DRIVER_PATH`. None collide with any planned module export.
- Planned module exports are pairwise disjoint across modules: swarm (`swarmPlan/parallelDag/branchSuggest/seatsForPhase/phaseRecord/frontierOf/kindsRecorded/scanForMarkers`), prompt-engine (`expandBrief/applyPolicies/parseExpandedSpecJson`), bench (`estimateTokenCost/complexityScore/failurePointScan/projectedTime/...`), ast-mine (`mineCodebase/conventionsMap/respectConventions/nameStyle`), knowledge (`KnowledgeStore`), watcher (`startWatcher/stopWatcher/watcherNotes`), engine wild (`wildStep/wildLog/wildPause`), harvest (`harvestForPacket/...`). No duplicates; no shadowing of `headless.*` (headless exports none of these names).
- **Namespacing discipline (recommended, cheap):** one cached loader per module (`const swarm = await loadLib("swarm.ts")` then `swarm.swarmPlan(...)`) instead of destructuring — keeps `frontierOf`/`phaseRecord`-style generic names unambiguous and makes the conflict scan trivially repeatable.
- Only sibling-module import today: `verify.server.ts:20` pulls `countLooseEquals/stripStringsAndComments` from `bench.ts` — do not rename those two.

---

## 6 · Per-subcommand build cards

Common skeleton for every new case (insert before `case "doctor"` at `cli.mjs:518`):
`await ensureErrorCodes()` already ran in `main()` (`:181`) → `classify` is live. Load the project via `loadProjectFor(cmd)` when the verb is project-scoped. Every envelope goes through `respond()`. Every verb gets one USAGE row (`:568` slot), one README-cli.md subsection (insert before `## Agent contract` at `README-cli.md:279`), and one `headless.test.ts` describe beside the E-25 block (`:494`+).

### Card 1 — `swarm` (module swarm.ts → swarmPlan/parallelDag/branchSuggest)
- **Call:** load project; `swarm.swarmPlan(project, {phase: args.phase ? Number(args.phase) : undefined})` (`:590`); optional `--view plan|dag|branch` (default `plan`): `dag` → `parallelDag(project)` (`:687`), `branch` → `branchSuggest(project)` (`:809`). All sync.
- **Arg validation:** `--phase` must parse to an integer 0–12 if given (else exit 1, literal `code:"RT_E_VALIDATION"`).
- **Envelope (exit 0):** `{ok:true, view, phase|frontier, critiques, artifacts, refinedPlan}` (plan) / `{ok:true, view:"dag", frontier, ready, nodes, chain, parallelPairs, conflicts}` / `{ok:true, view:"branch", frontier, suggestions, conflictsDetected}`. Keep the module's field names verbatim — do not rename/nest.
- **Exit codes:** 0 always (after load); project-load → 1 (loader); bad `--phase` → 1 `RT_E_VALIDATION`. Never 2/3/4.
- **Test:** spawn `swarm --project` on a `create`d fixture → exit 0, single JSON, `json.ok===true`, `Array.isArray(json.critiques)`, `json.artifacts.length===json.critiques.length`, `engineLinear===true`; `--view dag` → `nodes.length===13`; `--view branch` returns suggestions array. No env keys needed.

### Card 2 — `expand` (module prompt-engine.ts → expandBrief/applyPolicies)
- **Call:** `pe.expandBrief(brief.value, policies)` where `--brief` required (exit 1 on missing, `:72-78`); `--policies` optional single string (comma/newline-separated; the parser cannot repeat flags — `:42-70`; cap enforcement documented at `:56-58`, slice defensively to `EXPAND_POLICY_MAX_COUNT=12` × `EXPAND_POLICY_MAX_CHARS=240` before sending). On `{ok:true, spec}` optionally apply `pe.applyPolicies(spec, policyArray)` (`:189`) when policies were given and respond the merged spec.
- **Envelope:** success (exit 0): `{ok:true, spec, policiesApplied: n}`. `reason:"not-configured"` → exit 3 (`respond` pins `RT_E_LLM_NOT_CONFIGURED`, `:94-95`); `reason:"error"` → exit 4 with `error` text (classify fallback `RT_E_UNKNOWN` is honest per README `:311`; add literal `code:"RT_E_LLM_REJECTED"` only when `res.error` proves a provider refusal).
- **Test:** blanked-key default → exit 3 + `code:RT_E_LLM_NOT_CONFIGURED` + one-JSON; (keyed path optional — assert exit 0/`spec.requirements` array via `opts.env` DEEPSEEK_API_KEY when a real key exists in the harness env; otherwise keep the not-configured arm as the deterministic assertion). `--policies "A,B"` shape test.

### Card 3 — `bench` (module bench.ts → ALL exports: estimateTokenCost + complexityScore + failurePointScan + projectedTime; shared primitives stay module-internal)
- **Call:** load project, then the four estimators on the loaded `Project` directly (structural assignability, bench.ts `:18-32`): `b.estimateTokenCost(project)`, `b.complexityScore(project)`, `b.failurePointScan(project)`, `b.projectedTime(project)`. Optional `--view token|complexity|failure|time|all` (default `all`).
- **Envelope (exit 0):** `{ok:true, estimates:{tokenCost:<TokenCostEstimate>, complexity:<ComplexityEstimate>, failurePoints:<FailurePointScan>, projectedTime:<TimeEstimate>}}` — or the single estimator object under its field name for `--view`. Every nested result already carries `estimate:true`/`method`/`label` — do not strip.
- **Exit codes:** 0 (after load); load failure 1. Never 2/3/4.
- **Test:** `create` a fixture → `bench --project` → exit 0; assert `json.estimates.tokenCost.estimate===true`, `typeof tokenEstimate==="number"`, `complexity.level ∈ low|medium|high`, `failurePoints.count===advisories.length`, `projectedTime.minutes>=0`; `--view complexity` returns only that shape.

### Card 4 — `mine` (module ast-mine.ts → mineCodebase/conventionsMap/respectConventions)
- **Call:** `--dir <path>` required (default `.`); walk recursively (add `readdirSync`/`statSync` to the fs import at `cli.mjs:31`), collect `{path, body}` for `.ts/.tsx/.js` (watcher `WATCH_EXTENSIONS` vocabulary minus `.json` if you only want code); `am.mineCodebase(files)`; plus `am.conventionsMap(project.name, files)` when the verb is project-scoped (`--project` optional; `conventionsMap`'s `project` string is a caller label). Optional `--check-name <name> --check-kind function|component|file|symbol [--check-path <path>]` → `am.respectConventions(packet, map)` (`:541`).
- **Envelope (exit 0):** `{ok:true, dir, files: n, map:<CodebaseMap>, conventions:<ConventionsMap>}` (+ `{verdict:{advisories, injected}}` when `--check-name` given). Empty dir is honest `files:0` + empty structures — exit 0, never an error.
- **Exit codes:** missing/invalid `--dir` → exit 1 (`RT_E_VALIDATION` literal); unreadable file → exit 1 with path in error (or skip+count — pick and document; recommend honest skip with `skipped: n` in the envelope). 0 otherwise.
- **Test:** temp dir + 2 written fixture files (one `camelCase` fn file, one `kebab-case` path) → exit 0; `stats.files===2`; `conventions.functionStyles` tallies; `--check-name snake_case_fn --check-kind function` on a camelCase-dominant fixture yields `verdict.advisories.length>=1`; conforming name → `[]` and `injected===""`.

### Card 5 — `knowledge` (module knowledge.ts → KnowledgeStore ctor + entries/count/savePattern/findPatterns/injectProven)
- **Shape:** `knowledge <add|query|proven|count> --store <file.json>` with the action as `args._[1]` (positionals already available, parseArgs `:42-70`). `--store` defaults to `./rapidtool-knowledge.json`.
- **Calls (all sync):** `new KnowledgeStore(storePath)` (`:126`); `add` → `savePattern({project, kind, title, body, tags, sourcePath?})` with `--project` (required), `--kind brief|pattern|fix|note`, `--title`, `--body` required; `--tags a,b,c` (split, trim); envelope `{ok:true, appended, entry:{id, savedAt, ...}}` — `appended:false` is a SUCCESS (idempotent no-op, `:166-182`); `query` → `findPatterns(query, limit)` `--query` required, `--limit` digits (default 5): `{ok:true, count, matches:[{entry, score}]}`; `proven` → `injectProven(project, {limit?, minScore?})`: `{ok:true, count, rows: ProvenRow[]}`; `count` → `{ok:true, count}`.
- **Exit codes:** missing action or required arg → 1 (`RT_E_VALIDATION` literal); corrupt/unrecognized store file → 1 with the store's own error text (module throws `:147-158` — never overwrite); 0 on success. Note `savePattern` with a nonexistent file path creates it (including parent dirs).
- **Test:** temp `store.json`; add → exit 0 `appended:true` + `entry.id` starts `K`; re-add identical → `appended:false` same id; query → ranked matches; count → `count===1`; corrupt store file → exit 1 with error text (do not clobber).

### Card 6 — `watch` (module watcher.ts → startWatcher/stopWatcher/watcherNotes)
- **Call:** `watch --dir <path> [--debounce-ms N] [--timeout-ms N]`. `startWatcher(dir, cb, {debounceMs, persistent:false})` (`:116`); `cb` appends each `WatcherChange[]` batch to a local array. Idle-stop design per §3.6 caveat: after wall-clock `--timeout-ms` (default 5000) or after an idle gap > debounce with ≥1 batch, call `stopWatcher(handle)` (`:179`) and respond. Include `watcherNotes(dir)` (`:197`) state in the envelope.
- **Envelope (exit 0):** `{ok:true, dir, batches: n, changes: WatcherChange[], watcher:{active:false, ...notes}}`. Zero changes within timeout is an honest `changes:[]` exit 0 (timeout is not an error).
- **Exit codes:** unwatchable dir (module throws `:140`) → exit 1 with the throw text; 0 otherwise. **Never run this verb with `persistent:true`** — the process must exit (the outer `respond` exits, but a persistent watcher would keep the event loop alive; force `persistent:false`).
- **Test:** temp dir; write a `.ts` file → spawn `watch --dir tmp --timeout-ms 3000` → exit 0, one JSON, `changes` contains the created path with `kind:"created"` (Windows fs.watch rename semantics give created/removed — assert path presence and kind ∈ set rather than exact kind if flaky).

### Card 7 — `wild` (module engine.ts → wildStep/wildLog/wildPause + store.ts start-shape precedent)
- **Call (mutating verb — mirrors run/gate, `:215-239`):**
  1. `loadProjectFor("wild")` + `requireProjectPath(args,"wild")`.
  2. Start state: clone project; set `wildMode: true` and stamp the canonical initial `wildRun` (`store.ts:536-547` shape from §3.7 — `active:true, phase: project.currentPhase, startedAt/lastAutoAt: Date.now(), lastAutoLog: \`Wild run started at P${n}\`, stoppedAt:null, pause:false`), then `engine.wildLog(started, currentPhase, "info", "wild.start", ...)` — exact store parity `:549`.
  3. Driver loop (mirror store `:555-575`, CLI-side since headless has no `wildRunOnce`): `let steps=0; while (steps < maxSteps) { const res = await engine.wildStep(cur); cur = res.project; steps++; if (!res.ran) break; if (cur.wildRun?.pause || cur.status==="complete" || !cur.wildRun?.active) break; }` with `maxSteps = digits(--max-steps) || 20` (store's cap constant is 20, `:557`).
  4. `h.saveProject(path, cur)` then respond.
- **Envelope:** `{ok:true, path, summary: h.summary(cur), steps, stoppedReason: <"paused"|"complete"|"cap"|null>, lastOutcome: res.outcome, parked: boolean}`.
- **Exit codes:** `parked` = `cur.wildRun?.pause===true || cur.status==="awaiting_hitl" || cur.status==="blocked"` → **exit 2** (run/gate parked semantics, README `:287-294` + `:226-237` precedent); complete/cap → exit 0 (cap is a successful honest stop — store returns `ok:true, stoppedReason:"cap"`); already-complete project at start → exit 0 `stoppedReason:"complete", steps:0` (store `:535` parity); wrong state (e.g. `wildRun.active` on a project that cannot run) → 1 with literal code where nameable; unexpected engine throw → outer catch exit 4.
- **Honesty notes for the envelope/README:** with no `DEEPSEEK_API_KEY` (or on this bare-Node host even WITH a key — B2 still OPEN, §3.7), open approval gates pause with `wild.paused_classifier` (`engine.ts:2163-2172`) and the DoD floor drives non-gate phases (`:2111-2130`) — `wild` never fabricates an approval; surface `lastAutoLog`/`stoppedReason` so an agent sees why it parked.
- **Test (deterministic, no key):** `create` fixture → `wild --project --max-steps 40` → exit 2 (parked at the first stock gate), `json.steps>=1`, `json.stoppedReason==="paused"`, project file on disk has `wildRun.pause===true` + `wild.start`/`wild.exec` log rows; `summary.status` reads parked state. Second card: cap arm via a tiny max-steps (`--max-steps 1`) on a fresh project → exit 0 `stoppedReason:"cap"` only if the first step parked nothing (assert either exit 0-cap or exit 2-paused with steps===1; both honest).

### Card 8 — `harvest` (module harvest.ts — **ABSENT**, §4; contract below is the Pillar-1 spec, land AFTER the pillar re-dispatch)
- **Call (once the module exists):** `--brief <text>` required (project-scoped alternative: load project and use `project.brief`); optional `--llm` (default false — LLM query path only when keyed; module falls back to the keyword floor honestly). Dynamic-import `harvest.ts` directly and call `harvestForPacket({brief, name?, domain?}, opts?)` — NEVER the `research.ts` server-fn wrapper (bare-Node throws).
- **Envelope:** success → exit 0: `{ok:true, queries, querySource, hits, rows, notes, searches, fetches}` (module result verbatim). `{ok:false, code:"RT_E_RESEARCH_UNAVAILABLE"}` (all searches failed) → exit 1 with the module's own `error` (research-unavailable is a validation-class/backend failure for a one-shot verb — pick 1 and document, or 3 if the wave's README row says backend-unavailable; **the exit-3 pin forces `RT_E_LLM_NOT_CONFIGURED`, which is the WRONG code for research-unavailable, so prefer exit 1 with the literal code**). Empty-brief → exit 1 `RT_E_VALIDATION` pre-network.
- **Test:** gate on module presence (skip cleanly until harvest lands); then fixture-free hermetic runs need the module's DI knobs (`search`, `fetchFn`) which the CLI cannot inject — so CLI-level tests assert only the honest-failure/empty-brief arms + a mocked-`fetch`-free smoke; the deep hermetic coverage belongs to `harvest.test.ts` (≥12 tests, per the Pillar-1 plan).

---

## 7 · Non-code collateral (every verb, one change each)

1. **`scripts/README-cli.md`** — one subsection per verb inserted before `## Agent contract` (`:279`), styled after the sibling sections (`:37-277`): invocation, envelope fields, exit-code row, RT_E_* additions. The error-code table (`:317-332`) needs rows only for codes that can newly appear; new literals must also be added to `ERROR_CODE_DOC` in `src/lib/errors.ts` **only if genuinely new** — prefer reusing the 14 existing codes (dossier-26/27: table is the canonical registry; do not fork).
2. **`cli.mjs` USAGE** (`:549-571`) + header usage block (`:14-29`).
3. **README "Full agent loop"** (`:334-388`) only for verbs that belong in the canonical loop (`wild`, `harvest`; advisory verbs get a mention, not a loop step).
4. **`headless.test.ts`** — one describe per verb beside the E-25 block (harness §1.6); keep the blanked-key env default except keyed-arm tests.
5. `npm run typecheck` (0), lib suite via `node --experimental-strip-types --test src/lib/*.test.ts src/lib/app-data/app-data.test.ts src/lib/auth/*.test.ts`, then `npm run lint`/`npm run build` only after ALL verbs land (never mid-wave, skill rule).

---

## Appendix · Anchor drift log

- `scripts/rapidtool-cli.mjs` mtime 09:01 — retry case (`:277-293`) + approve/reject `RT_E_GATE_PENDING` literals (`:245`,`:259`) LANDED vs dossier-23 C1/C2; ingest `applied:true` hardcode (`:318`) and reject short-note code (`:265-270`) still open. If a sibling edits cli.mjs after 09:35, re-verify the case map before inserting.
- `src/lib/engine.ts` mtime 09:14 — wild section post-fix (guards, finalize, computed-specifier reviewer `:2344-2346`); WildStepResult still carries no `code` (B5 OPEN). Any further engine edit shifts §3.7 line numbers only.
- `src/lib/store.ts` mtime 09:17 — wild actions implemented (B0 landed). If a builder re-touches it, the §3.7 start-shape (`:536-547`) and driver loop (`:555-575`) anchors move; re-grep `startWildRun`.
- `src/lib/headless.ts` mtime 05:48 — unchanged; if the wiring wave adds passthroughs (C1 step 1: `runBench`/`emitScaffold`/`harvestForPacket`/`wildRunOnce`/`setEnforceDod`), §2/§6 cards stay valid but the CLI would call `h.*` instead of direct module imports — prefer direct imports for the seven modules unless the parent brief mandates passthroughs.
- Pillar modules swarm/prompt-engine/bench/ast-mine/knowledge/watcher stable since 07:52-08:54 (verified mtimes); `harvest.ts` absent — re-check `ls src/lib/harvest.ts` before the harvest card is applied.
- Typecheck state at 09:17: repo was green-post-fix per the 09:1x wave activity; run the gates per §7 before claiming anything.
