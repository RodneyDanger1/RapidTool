# 103 — RapidTool: capability-coverage + feature-gap register

**Scope:** read-only census of `C:\Users\mnril\Desktop\RapidTool Main` (git-bash, 2026-09-16).
**Writer:** audit lane (this file is the only write). No source/test file was modified.
**Method:** the bucketing method of `codebase-audit/references/wiring-gap-coverage-register.md` +
`export-census-orphan-audit.md` (WIRED / PARTIAL / ORPHAN / UI-ONLY, import-graph census,
test-only-importer-is-not-a-consumer, dynamic `h.<name>` dispatch counted as a consumer).

## 0. Surfaces snapshot (all re-verified on disk at this write)

| surface | count | command |
|---|---|---|
| CLI verbs (case arms) | **34** | `grep -c 'case "' scripts/rapidtool-cli.mjs` |
| headless.ts export lines | **88** = 55 value exports + 32 type exports + 1 re-export | `grep -c '^export ' src/lib/headless.ts` |
| lib modules (non-test) | 64 | walk census |
| modules with zero non-test importers | 3 (`arch-tools.ts`, `algo-tools.ts`, `runtime-log.server.ts`*) | import-graph census |

\* `runtime-log.server.ts` is WIRED via a dynamic path-string import at
`scripts/rapidtool-cli.mjs:260` — the documented false-positive class; do not re-file it as dead.

**Parent-provided facts re-confirmed:** CLI verbs = 34 ✓ · doctor `factory.autonomousSoftwareFactory: false`
with named `gaps[]` (`src/lib/headless.ts:2690` + `2696-2701`) ✓ · single-provider DeepSeek
(`src/lib/deepseek.server.ts:23` `DEEPSEEK_BASE_URL`, `src/lib/llm.ts:16`
`LlmModel = "deepseek-v4-flash" | "deepseek-v4-pro"`) ✓ · no provider abstraction ✓
(`ls src/lib | grep -iE "provider"` → nothing; `src/lib/auth/providers.ts` is better-auth social
login, not LLM).

**Doc-vs-disk drift found (feeds G1):** README.md:11/99 says "31 verbs" while README.md's own
table lists 33 and README-cli.md:10 says 33; disk has 34 (`fixtures` is dispatched at
`scripts/rapidtool-cli.mjs:825` but has **zero mentions** in `scripts/README-cli.md`). README-cli.md
lines 24–30 + 340–346 + 394–398 say `emit --verify-kind` "has NOT landed / no case arm" — it **is**
on disk (`scripts/rapidtool-cli.mjs:761-770` + `src/lib/compile-check.server.ts:748
export function verifyKindDir`).

---

## 1. Capability coverage table

Verdicts: **WIRED** live production consumer · **PARTIAL** subset wired · **ORPHAN** zero prod
consumers · **UI-ONLY** browser-only reach. "CLI" = reachable from the 34-verb headless driver.

| # | Capability (as advertised) | Verdict | Proof (file:line / command) | CLI? | Note |
|---|---|---|---|---|---|
| 1 | Brief → project (`create`) | WIRED | `headless.ts:143 createProject`; CLI `:401` | yes | atomic JSON write |
| 2 | Governed advance (`run`/`gate`) | WIRED | `headless.ts:548 runUntilGate`; CLI `:424-431` | yes | 13 phases P0–P12 |
| 3 | HITL decisions (`approve`/`reject`/`retry`) | WIRED | `headless.ts:725/745/750`; CLI `:496/533/571` | yes | stock gates P4/5/8/9 never auto-approved |
| 4 | External report `ingest` | WIRED | `headless.ts:785 ingestResult`; CLI `:589` | yes | append-only |
| 5 | Agent Packet v3 + System JSON | WIRED | `headless.ts:817 packet`; `packet.ts:204 compileAgentPacket`; CLI `:658` | yes | `PACKET_VERSION=3` |
| 6 | Six downstream coding-tool handoff profiles (Claude Code/Cursor/Cline/Aider/Devin/Copilot) | **ORPHAN** | `packet.ts:639 exportProfiles`; only importer is `packet.test.ts:3` | no | fully built + tested, zero production consumers |
| 7 | Per-phase handoff prompts | **UI-ONLY** | `handoff.ts:39 phaseHandoff`; only importer `console.tsx:40` | no | "Copy phase handoff" button only |
| 8 | Runnable scaffold `emit` | WIRED | `headless.ts:1132 emitProject`; CLI `:713` | yes | 5 kinds: webapp/cli-tool/library/game/service (`scaffold.ts:70`) |
| 9 | `emit --check` per-file compile verdicts | WIRED | CLI `:770-785`; `compile-check.server.ts` compileCheckDir | yes | |
| 10 | `emit --run` (tree-run in-loop) | WIRED | CLI `:786-812`; `compile-check.server.ts` treeRun | yes | red tree → exit 1 |
| 11 | `emit --verify-kind` (install + kind build) | **PARTIAL** | CLI `:761-770`; `compile-check.server.ts:748` | yes | landed on disk (docs say not); see G2: no `npm install` step, runs **in** the emitted dir (docs promise temp dir, never mutating) |
| 12 | `tree-run --dir` standalone oracle | WIRED | CLI `:888`; `headless.ts:1756 importTreeDir`; treeRun | yes | read-only over existing dir |
| 13 | `repair --dir` (emit→edit→re-emit) | WIRED | CLI `:959`; `headless.ts:1971 repairTreeDir` | yes | hash-checked re-import, bounded cycles |
| 14 | `fixtures` brief-derived acceptance drafting + human approve | WIRED | CLI `:825-880`; `brief-fixtures.ts:588 approveFixtureCases` | yes | never auto-approves |
| 15 | `fixtureApprovalGate` ("functional" licensing) | **ORPHAN** | `brief-fixtures.ts:553`; only consumer `brief-fixtures.test.ts:16` | no | approval state never gates any prod claim |
| 16 | `verify` machine verify-fix loop | WIRED | `headless.ts:2335`; CLI `:1140` | yes (keyed) | exit 3 keyless |
| 17 | `crew` advisory multi-agent | WIRED | `headless.ts:2304 runCrew`; CLI `:1117` | yes (keyed) | |
| 18 | `chat` grounded copilot + keyless slash tools | WIRED | `headless.ts:2979 chatAsk`; CLI `:1911`; `chat.server.ts:357` slash tools | yes | free-text keyed; **no streaming** |
| 19 | `deepen` E-13 recovery | WIRED | `headless.ts:3012 deepenPhase`; CLI `:1970` | yes | |
| 20 | Wild Mode + lifecycle | WIRED | `headless.ts:3073/3141/3159/3187`; CLI `:1832-1890` | yes | run state persists in project JSON |
| 21 | Vault materialize (`vault`) | WIRED | `headless.ts:2233 writeVault`; CLI `:1070` | yes | |
| 22 | Vault search (`search`) | WIRED | `headless.ts:2277 vaultSearch`; CLI `:1099` | yes | |
| 23 | Vault internals (`buildVault`/`vaultMarkdown`/`vaultIndex`/`splitVaultBlocks`/`vaultFileFor`) | PARTIAL | `vaultMarkdown`/`vaultIndex` reached only by `console.tsx` (UI-ONLY); rest internal to `writeVault` | partial | over-exported substrate, not dead |
| 24 | Design tokens + HTML preview | WIRED | `headless.ts:2438/2454`; CLI `:1224` | yes | |
| 25 | SVG diagrams (phases/architecture/flow) | WIRED | `headless.ts:2471`; CLI `:1246` | yes | |
| 26 | Artifact index | WIRED | `headless.ts:2505`; CLI `:1281` | yes | |
| 27 | Doctor capability pre-flight + factory latch | WIRED | `headless.ts:2636 doctorStatus`, latch `:2687-2726`; CLI `:2026` | yes | `autonomousSoftwareFactory:false` + `gaps[]` |
| 28 | `diagnose` telemetry diagnosis | WIRED | CLI `:2046`; `runtime-log.server.ts` via CLI path `:260` | yes | NDJSON log tail + timeline |
| 29 | Runtime crash-capture bootstrap | WIRED | `rt-client.ts:393 installRtClient`; booted at `router.tsx:8` + `routes/__root.tsx:5` | n/a (browser) | was orphaned in the 2026-09-07 audit — now wired |
| 30 | Watchdog heartbeats/auto-pause | WIRED | `watchdog.ts` consumed by `rt-client.ts`, `store.ts`, `console.tsx`, `diagnose.ts` | n/a | no wall-clock budget in wild driver yet |
| 31 | `harvest` live-source | WIRED | `headless.ts:2747`; CLI `:1295` | yes | keyless; honest-empty |
| 32 | `swarm` advisory critique | WIRED | `headless.ts:2763`; CLI `:1325` | yes | pure state analysis |
| 33 | `prompt` hyper-prompt expansion | WIRED | `headless.ts:2773`; CLI `:1350` | yes (keyed) | |
| 34 | `bench` synthetic estimates | WIRED | `headless.ts:2792`; CLI `:1374` | yes | labeled heuristic |
| 35 | `mine` codebase map | WIRED | `headless.ts:2878`; CLI `:1400` | yes | |
| 36 | `knowledge` cross-project store | WIRED | `headless.ts:2901/2908`; CLI `:1432` | yes | append-only |
| 37 | `lesson` family (list/propose/accept/supersede/refute) | WIRED | CLI `:1496-1830`; `knowledge.ts` | yes | human-gated cross-project write |
| 38 | Lesson read-back → keyed P6 prompt expansion | WIRED | `codegen.server.ts:96-97` + `:1316-1323` (`selectLessons`→`lessonLinesForBrief`) | yes (via keyed P6) | narrow channel, as README admits |
| 39 | `runAcceptance` crash stamp (SIGINT/SIGTERM) | WIRED | `headless.ts:116`; CLI `:384` | yes | |
| 40 | Bounded local runner for generated code | WIRED | `node-runner.server.ts:190 runNodeBounded`; consumed by verify/treeRun/exec | yes | **not** a sandbox (declared) |
| 41 | Honest isolation claim | WIRED | `sandbox-policy.ts:21-32`; `headless.ts:2673-2685` | yes (doctor) | always advertises `sandbox:false` |
| 42 | Token ledger + opt-in hard cap (P6 synthesis) | PARTIAL | `token-ledger.ts`; `codegen.server.ts:961-982` ("Session token budget exhausted"); `doctor.ts:174-181 tokenCap` | yes (env `RAPIDTOOL_TOKEN_CAP`) | **only** P6 synthesis paths metered; no USD cost; see A4 |
| 43 | P12 OpenAPI 3.1 artifact | WIRED (artifact-only) | `engine.ts:1085-1120` (deterministic YAML from `project.contracts.endpoints`; `art(12,"docs","OpenAPI 3.1",…)`) | yes (via `artifacts`/`export`) | generated OUT from contracts, never read IN; not written to the emitted tree |
| 44 | A7 oracle / brief-derived tests | PARTIAL | `algorithms.ts buildTestOracle` prose rows; `brief-fixtures.ts` typed probes; emitted `tests/oracle.spec.ts` | yes | oracle is pipeline self-authored (docs honest); fixtures need human approval |
| 45 | Eval harness + M1–M9 maker scorecard | PARTIAL | `package.json:21 "eval"`; `scripts/run-eval.mjs:39-47` (imports headless driver + treeRun + maker-score); `research/eval-corpus/`, `research/eval-out/` | **no** | real, wired, persisted — but npm-script only, not a CLI verb; latest keyed on disk = 4/9 (`results.json`), history shows an earlier 6/9 |
| 46 | Latent auth (better-auth) | PARTIAL | `db.ts`, `auth/*` consumed by `auth/middleware.ts`, `auth/server.ts`; no login UI | no | honestly staged (README §Auth posture) |
| 47 | Runtime telemetry ring | WIRED | `rt-ring.ts` ← `rt-client.ts`/`watchdog.ts`; runtime-log tab in console | yes (log), no (ring) | |
| 48 | `setEnforceDod` enforcement toggle | WIRED | UI toggle `console.tsx:5216`; CLI `create --advisory` `:408` | yes | was reachable-only-by-import in the 2026-09-07 audit — now wired |
| 49 | `arch-tools` architecture surface (dependency graph / codebase map / ADR record) | **ORPHAN** | `arch-tools.ts:221/263/…`; only importer `arch-tools.test.ts` | no | built + tested, zero reach |
| 50 | `algo-tools` algorithm workbench (spec→algorithm, property tests, complexity) | **ORPHAN** | `algo-tools.ts:107/221/500`; importers are tests only | no | includes LLM legs (`specToAlgorithm`) |
| 51 | `vector` brand generation (logo/icon/badge SVG) | **ORPHAN** | `vector.ts:693+`; consumers only scratch probes `probe-r5-misc.ts:4`, `probe-r5-vector.ts:2` | no | LLM-as-designer; sanitizeSvg is its only defense |
| 52 | Multiplayer / P2P | ORPHAN (staged) | `multiplayer/p2p.ts` — no importers outside itself | no | AGENT_GUIDE: staged, no live coturn |
| 53 | `driveP6Journey` full produce→run→repair→score loop | PARTIAL | `headless.ts:1486`; consumer `scripts/run-eval.mjs` only | no | CLI reaches the pieces (`verify`/`repair`/`tree-run`) but not the journey verb |
| 54 | `phaseHandoff`-style over-exports (`runPhase`, `vaultModuleAvailable`, `designModuleAvailable`, `diagramModuleAvailable`, `DIAGRAM_KINDS`, `P6_JOURNEY_DEFAULT_BUDGET`, `p6CycleLiveDeps`, `collectJobSources`) | PARTIAL | export-line grep vs `h.*` dispatch census | no | internal-only or constant re-exports; harmless |
| 55 | UI surfaces: store / render / gate-stats / templates | **UI-ONLY** | importers = `console.tsx` only (import census) | no | by design (browser store) |

**Verdict counts (55 rows):** WIRED 39 · PARTIAL 8 (rows 11, 23, 42, 44, 45, 46, 53, 54) ·
ORPHAN 6 (rows 6, 15, 49, 50, 51, 52) · UI-ONLY 2 (rows 7, 55).

---

## 2. Ranked wiring gaps (P0 → P2)

**P0 — contract-honesty / breaks the agent loop**

- **G1 (doc-vs-disk drift on the CLI contract).** Three independent drifts: (a) verb count — README
  says 31, README-cli says 33, disk = 34 (`grep -c 'case "'`); (b) `fixtures` dispatched at
  `rapidtool-cli.mjs:825` has **zero** mentions in `scripts/README-cli.md` (verified `grep -n
  "fixtures" scripts/README-cli.md` → empty), so an agent reading the contract cannot discover it;
  (c) README-cli lines 24–30/340–346/394–398 declare `emit --verify-kind` "NOT landed — no case
  arm, no verifyKind seam on disk" while `:761-770` + `compile-check.server.ts:748` exist. Fix = docs
  pass; the repo's own declare-or-strike rule makes this P0.
- **G2 (`verify-kind` contract mismatch).** The documented contract (README-cli 394–398) promises
  "bounded `npm install` + `vite build` in a temp dir (never mutating the emitted dir)". Disk:
  `verifyKindDir` runs `npm run build --ignore-scripts` **with `cwd = dir`** and there is **no
  install step** (`compile-check.server.ts:748-780`; only `npm` occurrence in the file is line 764).
  A fresh webapp emit (deps declared, nothing installed) therefore cannot go green, and the dir is
  mutated. Either the doc or the impl must move.

**P1 — capability exists but is unreachable / half-wired**

- **G3 (orphan pillars): `arch-tools.ts`, `algo-tools.ts`, `vector.ts`.** Complete, unit-tested,
  zero production consumers (census + `grep -rn "vector.ts" src scripts` → only its own header).
  These are candidate capabilities (architecture graph, algorithm workbench, brand/logo SVG)
  that already cost engineering and currently ship nothing to any surface.
- **G4 (six coding-tool handoff profiles ORPHAN).** `exportProfiles` (`packet.ts:639`) — the
  Claude Code / Cursor / Cline / Aider / Devin / Copilot wrappers — has no consumer outside
  `packet.test.ts`. One CLI flag (`packet --profile claude-code`) or a UI button would wire all six.
- **G5 (`fixtureApprovalGate` test-only).** The gate that licenses a "functional" claim
  (`brief-fixtures.ts:553`) is consumed only by its test; neither engine nor CLI nor doctor reads
  it, so the fixture-approval state never affects any published claim.
- **G6 (eval harness not agent-reachable).** `npm run eval` (`package.json:21`) drives the
  M1–M9 scorecard with real corpus + persisted results, but no CLI verb exposes it; an agent loop
  cannot ask "score this run". `driveP6Journey` has the same problem (run-eval-only consumer).
- **G7 (budget cap covers one seam).** `RAPIDTOOL_TOKEN_CAP` + hard stop exist only in
  `codegen.server.ts:961-982`; crew / verify / chat / prompt / deepen / wild-reviewer LLM calls
  are unmetered. An agent driving the whole pipeline cannot bound spend.
- **G8 (no LLM key validation).** `doctorStatus` reports `llm.configured` from
  `isDeepSeekConfigured()` (env presence only — `headless.ts:2622-2633`); the research probe is
  live but the LLM key is never actually exercised (no `/models` call). A stale/invalid key
  surfaces only mid-run as exit-4.

**P2 — polish / hygiene**

- **G9 (over-exported headless internals):** `runPhase`, `vaultModuleAvailable`,
  `designModuleAvailable`, `diagramModuleAvailable`, `DIAGRAM_KINDS`, `P6_JOURNEY_DEFAULT_BUDGET`,
  `p6CycleLiveDeps`, `collectJobSources` — no `h.*` dispatch, no external importers; keep-or-de-export.
- **G10 (`repo-root probe*.ts` files):** `probe2-4.test.ts`, `probe-*.ts`, `probe-r5-*.ts` sit at
  repo root and are the **only** consumers of `vector.ts`/`tracing.ts`/`render.ts` in some paths;
  they pollute the import census (must be filtered by humans/agents each time).
- **G11 (UI has no fixtures surface):** fixture drafting/approval exists only as CLI
  (`fixtures`) and the chat `/fixtures` slash tool; the console has no approve control
  (`grep -n "fixture" src/components/console.tsx` → empty).
- **G12 (doc claims "six handoff" but handoff.ts is UI-only, packet profiles orphan):** two
  half-built handoff stories; consolidate.

---

## 3. ABSENT production features (a real autonomous software factory needs these)

Sizes: S ≈ ≤1 day, M ≈ 2–5 days, L ≈ 1–2+ weeks for one engineer familiar with the repo.
"Files it would touch" are the real seams found by census, not guesses.

| # | Absent feature | Why it matters (gap it fills) | Size | Files it would touch | Depends on |
|---|---|---|---|---|---|
| A1 | **Multi-provider BYOK + provider registry + key validation** | The product is hard-wired to one vendor: `DEEPSEEK_BASE_URL` const, `LlmModel` union of exactly 2 DeepSeek ids, every LLM seam imports `deepseek.server.ts` directly. "Plug in any provider" is impossible; keys are never validated (doctor = presence check). | **L** | `src/lib/deepseek.server.ts` (split), new `src/lib/llm/providers/*.ts` registry, `llm.ts`, `llm-tasks.ts`, `codegen.server.ts`, `verify.server.ts`, `crew.server.ts`, `chat.server.ts`, `prompt-engine.ts`, `harvest.ts`, `doctor.ts`, `headless.ts`, `.env.example`/README | none (foundational) |
| A2 | **Real OS-level sandboxing for generated code** | `node-runner.server.ts` is a bounded timeout+env allowlist; `sandbox-policy.ts` *always* advertises `sandbox:false`; `runSandboxed` is deprecated with zero call sites. Running machine-generated code anywhere near a host is the trust axis. | **L** | `node-runner.server.ts` (executor swap: docker/bwrap/nsjail), `sandbox-policy.ts` (claim flip + tests), `doctor.ts`, `compile-check.server.ts`, `README`/`AGENT_GUIDE` | host tooling policy (docker/OS) |
| A3 | **Global cost & token budget with hard stops across every LLM surface** | `token-ledger.ts` + `RAPIDTOOL_TOKEN_CAP` hard-stop exist but only P6 synthesis records spend (`codegen.server.ts:978-982`); crew/verify/chat/prompt/deepen are unmetered, and there is no USD cost. An unattended factory run cannot be bounded today. | **M** | `token-ledger.ts` (extend), `codegen.server.ts`, `verify.server.ts`, `crew.server.ts`, `chat.server.ts`, `prompt-engine.ts`, `engine.ts`, `doctor.ts`, `headless.ts` (surface spend in envelopes) | none |
| A4 | **Dependency install + build verification for emitted projects (finish `verify-kind`)** | `emit --verify-kind` runs the declared build **without installing**; emitted `package.json`s declare react/vite/tailwind that are never vendored. The "kind's real build actually runs" promise is unexecuted on fresh trees. | **M** | `compile-check.server.ts:748` (`verifyKindDir`: scratch copy + `npm ci/install --ignore-scripts`), `scaffold.ts` (lockfile or offline-cache policy), CLI `emit` flags, docs | A2 for untrusted deps; network policy |
| A5 | **Run resumption/checkpointing across processes (step-level)** | Phase-granular resume exists (project JSON + wild lifecycle), but an in-flight phase/LLM call is not journalled; a crash mid-`gate` replays from the phase boundary and multi-process drivers must re-derive state. `dod.ts:722-724` states "no durable checkpoint layer" — honest, but the factory loop needs one. | **M** | `engine.ts` (checkpoint writes at step boundaries), `types.ts` (checkpoint record), `headless.ts` (resume verb), `scripts/rapidtool-cli.mjs`, `runtime-log.server.ts` | atomic write helpers (present) |
| A6 | **Streaming output to UI/CLI** | Zero SSE/`ReadableStream`/`EventSource` in `src/` (grep). Chat is one-shot; long runs are poll-only. Docs admit roadmap §G2. | **M** | `chat.server.ts` (stream API), `src/routes` + `console.tsx` chat tab, `rapidtool-cli.mjs` (NDJSON stream mode), README | none |
| A7 | **Git integration into the emitted tree (init/branch/commit/PR)** | Zero hits for `git commit|branch|checkout|simple-git|isomorphic-git` in `src`+`scripts`; emitted scaffolds have no `.gitignore` (`grep gitignore src/lib/scaffold.ts` → empty). Every real factory must land changes in version control with reviewable units. | **M** | new `src/lib/git.server.ts`, `scaffold.ts` (emit `.gitignore`/init), `headless.ts` + CLI (`emit --git`, `publish`), `repairTreeDir` (commit repaired cycles) | A4 + host git policy |
| A8 | **Deterministic replay/record of LLM calls** | No cassette/replay anywhere (grep "replay|cassette|recorded" → prose only; the only "cache" is a comment at `codegen.server.ts:190`). Keyed runs are inherently irreproducible; the eval harness re-calls the API each time. | **S/M** | `deepseek.server.ts` (record/replay mode keyed by prompt hash), callers in `codegen/verify/crew/chat/prompt-engine`, `scripts/run-eval.mjs` | none |
| A9 | **Incremental/regenerating updates to an existing project (beyond whole-artifact re-prompt)** | `repair --dir` re-imports an edited tree, but synthesis is still whole-artifact (`README` line 168: "no apply-patch/continue primitive"); re-emit overwrites whole files. Regeneration into a *user-edited* project cannot preserve their edits. | **M/L** | `codegen.server.ts` (patch/merge primitive), `headless.ts repairTreeDir`, `importTreeDir` (3-way merge over fnv1a hashes), `scaffold.ts` write policy | A7 (diffing) |
| A10 | **Review UI for approving generated diffs** | Console has 10 tabs (artifacts/packet/spec graph/crew/oracle/design/diagram/chat/vault/runtime log — `console.tsx:2139` aria-label); there is no diff view and no UI to approve fixture cases or repaired cycles. Approvals are CLI/chat only. | **L** | new console tab + store actions (`store.ts`), `console.tsx`, diff computation over `importTreeDir` hashes, `brief-fixtures` approve wiring | A9 hash/diff plumbing; A4 |
| A11 | **Multi-language output beyond TypeScript/JS** | `scaffold.ts:70` kinds are all TS (`webapp|cli-tool|library|game|service`); package.json/tsconfig only; `check`/`treeRun` are Node-only. A factory for arbitrary briefs needs Python/Go/etc. or must declare TS-only as a product boundary. | **L** | `scaffold.ts` (kind registry → language registry), `codegen.server.ts` (synthesis prompt+validation per lang), `compile-check.server.ts` (per-lang compile), `engine.ts` P6, docs | runners/toolchains per language; A2 |
| A12 | **Database/migration generation wired end-to-end** | No schema/migration emission in `scaffold.ts` (grep `.sql|sqlite|postgres|prisma|migration` → none); the repo's own `migrations/` serves RapidTool's deploy only. P12 mentions "database schemas" in prose; nothing produces or runs one. | **M** | `scaffold.ts` (schema + migration files per service kind), `engine.ts` P12 artifact, `compile-check.server.ts` (migrate smoke), docs | DB/driver choice; A4 for running migrations |
| A13 | **Spec-first generation (OpenAPI/schema as INPUT)** | Today OpenAPI is a deterministic *output* artifact (`engine.ts:1085-1120` from `contracts.endpoints`) and is never emitted to the tree or consumed. Contract-first builds (spec → routes/types/tests) are the standard factory workflow. | **M** | new spec parser (`src/lib/openapi.ts`), `engine.ts` P1/P6, `scaffold.ts`, `codegen.server.ts` | None / A11 if target language varies |
| A14 | **Behavioral test generation derived from the brief (not self-authored oracle)** | Emitted `tests/oracle.spec.ts` asserts the pipeline's own spec; `README` lines 175-182 admits "identifier presence is a proxy, never behavioral proof". The typed-literal fixture lane exists but needs human approval and its gate is unwired (G5). | **M** | `brief-fixtures.ts` (typed-literal producer/drafter), `verify.server.ts` (oracle cases), `engine.ts` P6, `headless.ts` (fixtures→tree-run bridge) | A8 for reproducibility; G5 wire-up |
| A15 | **Artifact provenance/attribution** | `Artifact` type = id/phase/kind/title/body/language (`types.ts:41`) — no author/provenance/model/actor. Provenance exists only on harvest rows, chat replies and lesson actor tags; audit trails stop at the project level. | **S** | `types.ts` (add fields), `engine.ts` `art()` writers, `packet.ts`/`vault.ts` renderers, `io.ts` coercion | none |
| A16 | **Plugin/hook extension points** | No `register*`/`addHook`/plugin API in `src/lib` (grep); integration points are hard-coded (`pkgs`/kinds in `scaffold.ts`, pipeline order in `phases.ts`). Third parties cannot extend the pipeline without forking. | **M** | new `src/lib/plugin.ts` registry, `engine.ts` seams, `codegen.server.ts`, CLI, docs | none |
| A17 | **Server-side storage / multi-tenant activation** | Local-first by design (`localStorage`/JSON files); better-auth is latent with no login UI; `DATABASE_URL` only used for deploy migrations. Blocks team use, hosted runs, and durable history. | **L** | `db.ts`, `auth/*`, `migrations/`, `routes/`, `store.ts` | DATABASE_URL + product decision (G7 lane) |
| A18 | **Eval scorecard as an agent-reachable surface** | `npm run eval` exists, but no CLI verb and no envelope; the maker rubric cannot be queried by a driving agent, so "score its own runs" is a human step. | **S** | `scripts/run-eval.mjs` → expose via `headless.ts` + CLI (`eval` verb), reuse `maker-score.ts` | none |

**Top 5 by value:** A1 (multi-provider BYOK) · A2 (real sandboxing) · A3 (global token/cost hard stops) ·
A4 (finish dependency install/build verification) · A5+A6 jointly (checkpoint/resume + streaming
observability of long runs). A7 (git) and A14 (behavioral tests from brief) are the next tier.

---

## 4. Already present — do NOT rebuild

Verified on disk, so a follow-up wave must not re-implement:

1. **`emit --verify-kind` has landed** (`rapidtool-cli.mjs:761-770`, `compile-check.server.ts:748`)
   — docs saying otherwise are stale; the gap is the missing install step (A4), not the verb.
2. **Token ledger + hard cap** (`token-ledger.ts`; `RAPIDTOOL_TOKEN_CAP` at `codegen.server.ts:961-982`;
   reported by `doctor.ts:174-181`). Extend it to all seams (A3) — do not build a second budget system.
3. **`tree-run` / `repair --dir` / `importTreeDir` hash-checked re-import** — the emit→edit→re-emit
   continuation seam already exists (`headless.ts:1756/1971`); A9 needs a patch primitive, not a new importer.
4. **Wild-mode lifecycle across processes** (`wildStartRun/Pause/Resume/Stop`, state persisted in the
   project JSON) — coarse run resumption exists; A5 is step-level journaling, not a new lifecycle.
5. **Eval harness is real and wired** — `research/eval-corpus/*.md`, `research/eval-out/{results,history}.json`,
   `maker-score.ts` M1–M9, `npm run eval [-- --keyed]`, `_keyed-launcher.sh`. Latest keyed on disk =
   **4/9** (M1/M5/M6/M8=1; M2/M3/M4/M7/M9=0 — `results.json` `generatedAt 2026-09-10T06:05:29Z`);
   an earlier keyed row = 6/9, which is the "6/9" the README cites. Do not build a new rubric.
6. **OpenAPI 3.1 generation already exists** (`engine.ts:1085-1120`, deterministic from
   `project.contracts.endpoints`) — A13 is about *reading* specs, not writing them.
7. **Brief-derived test lane exists** — `brief-fixtures.ts` (typed literals, pending→human approve),
   A7 oracle prose rows, emitted `tests/oracle.spec.ts`. The fix is wiring the gate (G5) and the
   typed-literal producer (A14), not a greenfield test framework.
8. **Telemetry is fully booted** — `installRtClient()` at `router.tsx:8` + `routes/__root.tsx:5`,
   watchdog heartbeats, NDJSON logs, `diagnose` verb. (The 2026-09-07 orphan finding is stale.)
9. **`setEnforceDod` is UI + CLI reachable** (`console.tsx:5216`, `create --advisory` CLI:408).
10. **Error taxonomy + exit codes + atomic writes + stdout purity** — 17-code RT_E registry
    (`errors.ts`), exit 0/1/2/3/4, write-then-rename; reuse for any new verb.
11. **Harvest/crew/swarm/prompt/bench/mine/knowledge/lesson** — all CLI-reachable with real bodies;
    do not re-file as orphans.
12. **`runSandboxed` deprecation is deliberate** (documented, zero call sites) — not a bug to "fix"
    by re-wiring; A2 is a new executor.

---

## 5. What I could not verify (explicit limits)

- **Test suite green-state** (`README`: 1632/1632, typecheck 0, lint 0) — not run in this read-only
  pass; UNVERIFIED as of this census.
- **Any keyed end-to-end run** — no `DEEPSEEK_API_KEY` exercised; keyed-path claims (verify, crew,
  chat, verify-kind build) are verified by code reading only. The eval scorecard numbers are read
  from `research/eval-out/results.json`, not reproduced.
- **`verifyKindDir` behavior on a real webapp emit** — predicted to fail without install from code
  inspection (`npm run build` in a dir with no `node_modules`); not executed to avoid mutating an
  emit dir (read-only mandate).
- **UI behavior** — no browser session run; UI-ONLY verdicts rest on import-graph evidence
  (`console.tsx` being the only importer).
- **`.env` contents / doctor live output** — not probed (key material); doctor's code path was read
  instead (`headless.ts:2636-2735`).
- **Items mentioned in older dossiers but not re-verified here** (e.g. `fixes/149` F1/F2 parity
  claims, wild-reviewer visibility of tree-run outcomes) — out of scope; only listed where a
  current consumer grep proved/disproved a wiring claim.
