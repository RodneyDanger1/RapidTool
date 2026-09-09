# 08 — Enhancement Register: the next implementation wave (build-ready, ranked E-01…E-30)

- **File:** `research/multiagent/08_enhancement_register.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`; NOT a git repo)
- **Date / agent:** 2026-09-05 ~23:50–00:10 · Flash research agent #3 (read-only on source; this file is the only artifact written)
- **Purpose:** the blueprint for the next implementation wave — 30 ranked, build-ready enhancements (E-01…E-30) that make RapidTool (a) trivially drivable by AI agents, (b) self-improving via its 2nd-brain vault, and (c) able to go from packet → shipped, tested artifact. Each entry: problem with file:line evidence from the real tree, exact fix/spec (files, functions, data shapes), effort (S/M/L), risk, priority (P0–P3), and DoD.
- **Evidence snapshot:** every anchor was read from the tree between 23:30 and 00:10. **The sibling build wave was live-editing during recon** (`src/lib/vault.ts` mtime 23:44, `src/lib/headless.ts` 23:43, `src/components/console.tsx` 23:38, `scripts/rapidtool-cli.mjs` 23:46, `src/lib/vault.test.ts` appeared mid-session). Re-verify anchors ±2 lines before patching; if a cited behavior has already been fixed, mark the entry done and move on.
- **Extends, does not repeat:** `research/multiagent/02_capability_audit.md` (§C E1–E4 — status tracked per entry), `03_crew_design.md` (§8 P1–P4), `04_verification_design.md` (§8–§10), `05_live_guidance.md` + `05_guide_research.md` §2.3 (⚠️ STATUS UPDATE 23:43: the **landed** vault.ts API is authoritative, not the advisory §2.3 shape). Bug cross-refs: `audit-bugs/05_multiagent.md` M-01…M-12.

---

## 0. Ranking summary (value ÷ effort)

| Rank | ID | Title | Area | Effort | Risk | Priority |
|---|---|---|---|---|---|---|
| 1 | E-01 | Stop `validateReport` silently dropping `tests_run` | 1,6 | S | low | P0 |
| 2 | E-02 | Headless DoD gate parity (`recordGate` in the CLI path) | 1,6 | S | low | P0 |
| 3 | E-03 | Wire `runP6Real` gate convergence into the store/UI real-run path | 3,6 | S | low | P0 |
| 4 | E-04 | Reconcile headless vault adapter with the landed title-keyed vault.ts | 2 | M | med | P0 |
| 5 | E-05 | Auto-discover test files (`vault.test.ts` is silently excluded from `npm test`) | 6 | S | low | P0 |
| 6 | E-06 | `cli verify --apply`: persist verify outcomes into the project | 1,6 | S | low | P1 |
| 7 | E-07 | Verify-fix promotion into the product loop + `p6-verified` probe + `lastTest` label | 3,6 | M | med | P1 |
| 8 | E-08 | Executable oracle: seed + pin A7 rows in every verify run | 3,6 | M | med | P1 |
| 9 | E-09 | Idempotent report ingestion (content fingerprint, deterministic ids) | 1 | S–M | low | P1 |
| 10 | E-10 | Phase-checked ingest on headless/CLI paths | 1 | S | low | P1 |
| 11 | E-11 | Packet System JSON: capabilities + report schema + corpus hash | 1 | S | low | P1 |
| 12 | E-12 | Delete the duplicated headless live layer (M-10 closure) | 3 | S | med | P1 |
| 13 | E-13 | P7 DoD deterministic dead-end + `deepen` research seam | 3,6 | M | med | P1 |
| 14 | E-14 | `modelRoute` honesty (stop claiming grok-4.5 / local-edge) | 3,7 | S | low–med | P1 |
| 15 | E-15 | Project kinds + scaffold emitter (packet → code on disk) | 5 | M–L | med | P1 |
| 16 | E-16 | Report ↔ DoD cross-check on ingest (`report.gate_unmet`) | 6 | S | low | P2 |
| 17 | E-17 | Vault search: token-overlap ranking + score surfaced to consumers | 2 | S–M | low | P2 |
| 18 | E-18 | Memory provenance fields + FusionRank cited-boost | 2 | S | low | P2 |
| 19 | E-19 | Regression-scoped advancement from the spec graph | 3,6 | M | med | P2 |
| 20 | E-20 | Log autopilot gate denials (M-09 completion) | 1,4 | S | low | P2 |
| 21 | E-21 | Console gate/verdict honesty UI (unmet drill-down, self-test labels) | 4 | M | low | P2 |
| 22 | E-22 | Align packet/handoff output contracts with the JSON report schema | 1 | S | low | P2 |
| 23 | E-23 | Honesty-lattice lint (`scripts/honesty-check.mjs`) | 7 | S | low | P2 |
| 24 | E-24 | `researchStatus` honesty: probe, don't promise | 7 | S | low | P2 |
| 25 | E-25 | CLI machine contract: exit-code taxonomy, stdin/`@file`, `doctor` | 1 | S | low | P2 |
| 26 | E-26 | DoD registry property tests (all 13 phases, no throws, hash stability) | 6 | S | low | P2 |
| 27 | E-27 | Shipped-artifact pass: bounded repo build + DEPLOY.md | 5 | M | med | P2 |
| 28 | E-28 | Crew transcript persistence + cost surfacing (03 §8 P2/P4 minimal) | 4 | S–M | low | P3 |
| 29 | E-29 | `runSandboxed`: give it a product consumer or deprecate honestly | 3 | S | low | P3 |
| 30 | E-30 | Remove retired `ai.ts` shim + stale doc pointers | 7 | S | low | P3 |

**Sequencing waves:** Wave A (quick correctness, ~½ day): E-01→E-05, E-06, E-09→E-12. Wave B (verification core, ~1–2 d): E-07, E-08, E-13, E-16. Wave C (packet→artifact, ~1–2 d): E-15, E-27. Wave D (honesty/UX polish, ~1 d): E-14, E-17→E-26, E-28→E-30. Every entry's DoD = the listed test command goes green + a behavior probe from its spec passes.

Area key — 1 agent-driving perfection · 2 memory/2nd-brain · 3 backend/logic/algorithm · 4 UI (humans AND agents) · 5 CODE/GAME production · 6 verification/quality · 7 safety/honesty.

---

## E-01 — Stop `validateReport` silently dropping `tests_run` (agent evidence loss + a lying warning) — area 1,6 · S · low · P0

**Problem (evidence):** `AgentReport` declares `tests_run?: AgentTestRun[]` (`src/lib/report-intake.ts:37-38`) but `validateReport`'s constructed report copies only `phase/status/summary/artifacts/files` (`report-intake.ts:120-123`) — `raw.tests_run` is never read, never validated, never attached. Consequences: (a) `store.ingestReport` warns `"complete report with no tests_run evidence"` when `v.report.tests_run?.length` is falsy (`src/lib/store.ts:501-509`) — the warning fires even for reports that **did** supply evidence, a machine-visible false claim; (b) real evidence silently vanishes (never in artifacts, logs, or memory); (c) the headless/CLI path loses it too (no warn, no record).

**Fix/spec:**
1. In `validateReport` (`report-intake.ts:56-124`) add a `raw.tests_run` branch: must be an array when present; each row `{command: non-empty string; pass: boolean; evidence?: string}`; malformed rows → `{ok:false, error:"Report tests_run[N] …"}` (house style, mirrors `files` validation at :106-118).
2. Attach `report.tests_run` in the constructed object (after :122).
3. `applyReport` (`report-intake.ts:126-201`): include `${(report.tests_run ?? []).length} test run(s)` in the `agent.report` log detail (:139-146) and, on `status:"complete"`, prefix the semantic memory row with pass/fail counts.
4. Store warn (:501-509) then only fires when genuinely absent — add the same warn to `headless.ingest` for parity.

**DoD:** extend `src/lib/report-intake.test.ts` — a report with valid `tests_run` round-trips; one bad row rejects with a specific error; store warn does not fire for an evidence-carrying complete report. `node --experimental-strip-types --test src/lib/report-intake.test.ts src/lib/store.test.ts` green.

---

## E-02 — Headless DoD gate parity: record gate verdicts + gate artifacts on every headless phase — area 1,6 · S · low · P0

**Problem (evidence):** `store.finishPhase` records the DoD verdict after every phase via `recordGate` (`src/lib/store.ts:197`, impl :83-124 → `PhaseRecord.gate` + `gate` artifact + `gate.verdict` log). `headless.finishPhase` (`src/lib/headless.ts:257-275`) has **no** equivalent: it goes straight to `advanceTo`/`stampPacket`. `recordGateInline` only runs inside `approveHitl` (`src/lib/engine.ts:848-869, 958`) — phases that never need HITL therefore never get a recorded verdict in headless/CLI runs. Result: `rapidtool-cli gate` runs produce `phases[].gate_passed: null` in the packet System JSON (`src/lib/packet.ts:59`) for completed deterministic phases; nothing in the headless path can ever enforce or even report the DoD, and E-13/E-16/E-20 (which build on recorded gates) have no foundation CLI-side.

**Fix/spec:**
1. Export the gate-recording helper from the engine (pure): move the body of `store.recordGate` (`store.ts:83-124`) to a new `export function recordGateInto(project, phase): Project` in `src/lib/dod.ts` (or engine.ts) — it already only uses `runGate`/`gateArtifact`/types. `store.recordGate` becomes a thin delegate (store keeps its own log/artifact side-effects — keep byte-identical behavior; `store.test.ts` must stay green unmodified).
2. `headless.finishPhase` (`headless.ts:257-275`): after the phase resolves not-blocked and before `stampPacket`, call `p = recordGateInto(p, phase)` when the phase record is `complete`.
3. Assert in `src/lib/headless.test.ts`: after `runUntilGate` over ≥1 phase, `phase.gate != null` and a `gate` artifact exists for it.

**DoD:** headless.test.ts + store.test.ts + gates.test.ts green; a CLI `gate` run's `export` shows non-null `gate_passed` for every completed phase.

---

## E-03 — Wire `runP6Real`'s gate convergence into the store/UI real-run path — area 3,6 · S · low · P0

**Problem (evidence):** `engine.runP6Real` returns `{ok, result, project?}` where the returned project carries `lastTest` stamped from the real exit code (`src/lib/engine.ts:1416-1438`, esp. :1429-1434) — documented as "callers re-run DoD (runGate) against that shape". Its **only** caller, `store.runModuleReal`, ignores `out.project` and uses `out.result` only (`src/lib/store.ts:452-495`, call at :458) → `lastTest` never reflects real runs; the `p6-test` DoD probe (`src/lib/dod.ts:118-125`) keeps describing the template self-test verdict; the UI/evidence dock renders the stale row as `sandbox pass/fail` (`src/components/console.tsx:110-114`, footer :1322-1324).

**Fix/spec:**
1. `store.runModuleReal` (:458-489): when `out.project` is present, merge it (`updated = {...out.project, artifacts: <real-run artifact appended>, logs: …}`) so `lastTest` = real exit-code verdict; then re-run `recordGate(updated, 6)` (E-02's shared helper) so the recorded P6 gate + artifact reflect the real run; log `runner.real` (exists) plus `gate.verdict` re-eval.
2. Honest labels: evidence-dock row text becomes `self-test (template) …` vs `real run: exit N …` based on where the verdict came from (see E-07 for the `lastTest.label` field; until then use a `label` on the run artifact body — do NOT print "sandbox").
3. UI "Run module (bounded)" button (`console.tsx:1085`) keeps semantics (manual side-channel, never auto-opens HITL retroactively) but now visibly converges the gate when the run executed.

**DoD:** store.test.ts + gates.test.ts green; probe: runModuleReal with a failing real exit code flips `lastTest.ok` to false and the P6 gate artifact to FAIL.

---

## E-04 — Reconcile the headless vault adapter with the landed title-keyed `vault.ts` — area 2 · M · med · P0

**Problem (evidence):** The authoritative landed contract (per `05_guide_research.md` §2.3 STATUS UPDATE 23:43) is: `VaultNote = {title, body, tags, links, phase?, updatedAt, kind:"project"|"memory"|"decision"|"research"|"artifact"|"index"}` (`src/lib/vault.ts:45-56`); `vaultIndex(notes): string` (MOC markdown, :334-369); `searchVault(notes, query): VaultNote[]` (:376-388). But `src/lib/headless.ts` still mirrors the **advisory id-keyed §2.3 shape**: `VaultNote.id` required + `score/source/url` (`headless.ts:448-460`), `VaultIndex` as an object (`headless.ts:462-469`), `vaultIndex → VaultIndex`, `searchVault(a,b) → {note?, score?}[]` (`headless.ts:471-476`). Concrete breakage:
- (a) `headless.vaultSearch` (`headless.ts:709-735`) maps real `VaultNote[]` rows through `{row, score: row?.score ?? -1}` then `asSearchHit(row)` which reads `row.note` (`headless.ts:686-698`) → every hit is filtered → **CLI `search` always prints `count: 0`** (`scripts/rapidtool-cli.mjs:238-248`).
- (b) `writeVault`/`vaultFileFor` key filenames and frontmatter on `note.id` (`headless.ts:537-572`, esp. `:540` `id: ${…note.id…}` and `:561-571` slug from id) which real notes lack → every file is written as `note.md`, `note-2.md`… with an empty `id:` frontmatter, while `_index.md` links `[[title]]` (`headless.ts:592-643`) → **Obsidian wikilinks (filename-resolved) are dead**; per-note files are content-less names.
- (c) `headless.buildVault` returns the real `vaultIndex` **string** typed as a `VaultIndex` object (`headless.ts:514-519`) — the MOC string is thrown away and the object shape is fabricated.

**Fix/spec (single source of truth = landed vault.ts; console VaultPane already consumes the real API correctly — do not touch it):**
1. `headless.ts`: replace the §2.3 mirror types (:448-476) with the landed types (title-keyed). Keep the runtime export-shape validation (:496-511) but extend it to check return shapes: `vaultIndex` returns a string, `searchVault` returns an array of notes.
2. `vaultFileFor` (:554-572): slug from `note.title` (reuse the same sanitizer), frontmatter drops the `id:` line and keeps `title/kind/phase/tags/updatedAt`.
3. `vaultIndexMarkdown` (:592-643): drop `isIdGroups`/object fallbacks; consume the real MOC string when building `_index.md` — simplest correct move: `writeVault` writes `vault.vaultMarkdown(notes)` as a single `vault.md` **and** per-note files derived from `vaultFileFor` + real `vaultIndex` string as `_index.md`.
4. `vaultSearch` (:709-735): map the real `VaultNote[]` directly (`{title, kind, tags}`), keep `limit`; add `score` passthrough via E-17's scored variant when it lands.
5. Add contract tests to `src/lib/headless.test.ts` **and** `src/lib/vault.test.ts`: `searchVault(notes, query)` round-trip over a seeded fixture (`src/lib/testing/fixtures.ts` `seedProject()`), `writeVault` file names = title slugs, `_index.md` contains `[[<title>]]` rows that exist as files.

**DoD:** `node --experimental-strip-types --test src/lib/headless.test.ts src/lib/vault.test.ts` green; `node --experimental-strip-types scripts/rapidtool-cli.mjs search --project <seed>.json --query memory` returns hits with count ≥ 1; `vault --out` produces title-named files whose `_index.md` links resolve to written filenames.

---

## E-05 — Auto-discover test files: `vault.test.ts` is silently excluded from `npm test` — area 6 · S · low · P0

**Problem (evidence):** `src/lib/vault.test.ts` exists on disk (appeared during this wave) but `package.json`'s `test` script is an **explicit file list** (`package.json` `scripts.test`) with zero `vault` matches (grep `vault` → 0 hits). Every new suite must be hand-appended or it is silently never run — `npm test` was green while the brand-new vault module had no coverage; the same trap awaits E-07/E-08/E-23 modules.

**Fix/spec:**
1. Replace the list with Node 22 test globs: `node --test "scripts/**/*.test.mjs"` and `node --experimental-strip-types --test "src/**/*.test.ts"` (verify glob quoting under git-bash on Windows; Node ≥ 22 supports globs in `--test`).
2. If globs misbehave on this host, keep the explicit list but add `scripts/check-test-coverage.mjs` (pure, unit-tested like `scripts/brand-check.test.mjs`) that diffs the package.json list against on-disk `*.test.ts`/`*.test.mjs` and exits 1 on drift; wire into `npm test` before the suites.
3. Add `"check:honest"`/future scripts here too (E-23).

**DoD:** `npm test` executes vault.test.ts (assert by temporarily counting `--test` output or a console log in the suite) and stays green.

---

## E-06 — `cli verify --apply`: persist verify outcomes into the project file — area 1,6 · S · low · P1

**Problem (evidence):** CLI `verify` streams the outcome to stdout only (`scripts/rapidtool-cli.mjs:271-286` via `headless.verifyGeneratedSource` `src/lib/headless.ts:774-781`). Nothing writes it into the project: no artifact, `lastTest` untouched, no `Project.verify`. The evidence dies with the process — a later `gate`/`packet`/agent session cannot see that machine verification passed, and the agent must hand-craft a report to carry the claim (E-01/E-16 make that claim checkable, but the underlying data is gone).

**Fix/spec:**
1. New pure helper in `src/lib/headless.ts` (or `verify.server.ts`): `applyVerifyOutcome(project, outcome: VerifyOutcomeShape): Project` — when `status==="passed"`: stamp `lastTest = {ok:true, detail: outcome.evidence, label:"tested", evidenceHash: String(fnv1a(outcome.finalSource + outcome.evidence))}` (fields per E-07), append a `"verify"` artifact (`ArtifactKind` per E-07; body = evidence + cases + iterations), log `verify.pass`. `failed`/`error` → append a `verify.fail` artifact with evidence, no labels minted. `not-configured` → no artifact, no state change.
2. CLI: `verify --project X [--apply]` loads the project, runs the loop, and when `--apply` saves via the existing atomic `saveProject` (`headless.ts:51-67`) and prints `{ok, status, evidence, applied:true}`.

**DoD:** unit test on `applyVerifyOutcome` (pass stamps tested-label + artifact; fail never labels); `node --experimental-strip-types scripts/rapidtool-cli.mjs verify --project X --apply` writes the fields into X.

---

## E-07 — Verify-fix promotion into the product loop + `p6-verified` probe + `lastTest` label upgrade — area 3,6 · M · med · P1

**Problem (evidence):** `verify.server.ts`'s `verifyAndFixServer` (`src/lib/verify.server.ts:152-223`) can machine-mint `status:"passed"` but is reachable only via CLI (E-06). The engine's P6 path (`src/lib/engine.ts:464-526`) never calls it; `lastTest` is `{ok, detail}` (`src/lib/types.ts:258`) with no provenance label; `DOD[6]` has `p6-test/p6-source/p6-artifact` only (`src/lib/dod.ts:118-135`) — no `p6-verified`; `ArtifactKind` has no `"verify"` member (`types.ts:15-31`); the fixer uses the flash tier (`verify.server.ts:199-210`) for code repair.

**Fix/spec (implements `04_verification_design.md` §8.1–8.4):**
1. `types.ts`: `lastTest: {ok; detail; label?: "self-test"|"real-run"|"tested"; evidenceHash?: string} | null` (superset — old payloads hydrate fine); add `"verify"` to `ArtifactKind`; optional `Project.verify?: {status:"pass"|"fail"|"fallback"; evidenceHash?; iterations?; checkedAt:number} | null`.
2. `engine.runP6Real` (`engine.ts:1416-1442`): after the existing real self-test, when `llmStatus().configured && runnerAvailable()`, run `verifyAndFixServer(source, brief)`; **only on `status:"passed"`** promote into the returned project: `generatedSource = finalSource`, `lastTest = {ok:true, detail:evidence, label:"tested", evidenceHash}`, `verify={…}` + a `"verify"` artifact. Every other path leaves the deterministic floor untouched (04 §8.1 invariant — promotion happens only inside the pass branch).
3. `dod.ts` DOD[6]: additive `p6-verified` probe (pass iff `lastTest.label==="tested" && evidenceHash?.length`); `p6-test` remains the floor; a "tested-or-block" policy is a project-level toggle (schedule.notes / E-15 kind settings), not a default.
4. `store.runModuleReal` merges the promoted project (E-03) so UI real-runs benefit.
5. Fixer tier: switch the patch call to `deepseek-v4-pro` with the pro timeout (`src/lib/deepseek.server.ts` `DEEPSEEK_MODELS`/timeouts) — code repair is reasoning work.

**DoD:** existing suites green (deterministic floor unchanged); new tests: a fake `Completer`/runner fixture drives runP6Real to a promoted pass and to a fallback; `runGate` passes `p6-verified` only for promoted projects.

---

## E-08 — Executable oracle: seed + pin the deterministic A7 rows in every verify run — area 3,6 · M · med · P1

**Problem (evidence):** Oracle rows are prose `{id,name,given,expect,job}` (`src/lib/algorithms.ts:438-463`; type `src/lib/types.ts:198-204`); the spec-graph `tests` node names `tests/oracle.spec.ts` that nothing generates (`algorithms.ts:365-371`); `verify.server.generateCases` (`src/lib/verify.server.ts:122-150`) asks the LLM for fresh cases every run and **never sees the deterministic A7 oracle**; nothing persists passing cases across generations (04 §10 E1 open). An LLM may drop coverage of a stated constraint — nothing anchors it.

**Fix/spec:**
1. New pure mapper (e.g. in `verify.server.ts`): `oracleToCaseSeeds(oracle: OracleTest[]): string` rendering each A7 row as `# orc-… name — given ⇒ expect` comment lines.
2. `generateCases` prompt (:127-138) prepends the seeds: "KEEP every oracle row below as a case with its exact `id` (map prose to executable expressions where possible; `typeof <export> === 'function'` style allowed). Add at most 3 adversarial cases. Never drop an id."
3. `parseOracleJson`-level validation: returned ids must include all seeded `orc-*` ids; missing → one retry with the diff listed; still missing → `{ok:false, reason:"error", error:"oracle dropped N seeded cases"}` (no blind pass).
4. Persist pinned cases: when E-07 promotion lands, `Project.verify.pinnedCases` stores the winning `VerifyCase[]`; every later run concatenates pinned + fresh (regression memory across generations — Reflexion-style, machine-checkable).

**DoD:** unit tests: seeds present in prompt, parser rejects dropped ids, retry-once then honest error; verify.server.test extends without network (DI completeDeepSeek).

---

## E-09 — Idempotent report ingestion (content fingerprint, deterministic ids) — area 1 · S–M · low · P1

**Problem (evidence):** `applyReport` mints artifact ids from `Date.now()` (`src/lib/report-intake.ts:131` `report-${phase}-${i}-${now}`, memory rows :177/:184) and appends logs + memory unconditionally (:194-200). An agent that retries the same report (timeout, re-send) duplicates artifacts/memory/logs; `headless.saveProject` writes the whole file atomically (`headless.ts:51-67`) so a duplicate ingest visibly forks state; no `applied` signal exists for callers.

**Fix/spec:**
1. Compute `fp = String(fnv1a(JSON.stringify({phase, status, summary, artifacts, files, tests_run})))` (fnv1a from `algorithms.ts:709-716`) inside `applyReport`.
2. Deterministic ids: `report-${phase}-${i}-${fp.slice(0,8)}`; memory ids `report-semantic-${phase}-${fp.slice(0,8)}` — identical reports now collide by construction and `dedupeMemoryIds` (:191) + a new artifact-id `used` set (project.artifacts.some(id match)) make re-application a no-op.
3. Return value becomes `{project, applied: boolean; reason: "new"|"duplicate"|"error"}` (keep a deprecated plain-Project return only if callers demand; update `headless.ingest` :359-363 and `store.ingestReport` :495-513 + CLI `ingest` to surface `applied:false` with exit 0 — idempotency is success).

**DoD:** report-intake.test.ts: apply twice → second is `duplicate`, artifact/memory counts unchanged; headless.test.ts round-trip.

---

## E-10 — Phase-checked ingest on headless/CLI paths — area 1 · S · low · P1

**Problem (evidence):** `store.ingestReport` passes `project.currentPhase` into `validateReport` (`src/lib/store.ts:497-498`; check at `src/lib/report-intake.ts:77-82`) — the same-edge rule. `headless.ingest` calls `validateReport(rawReport)` **without** the phase (`src/lib/headless.ts:359-363`), and the CLI goes through it (`scripts/rapidtool-cli.mjs:170-181`) → a P3 report is accepted while the project sits on P9, letting stale/wrong-edge claims land with `[agent report]` authority.

**Fix/spec:** `headless.ingest(project, raw)` → `validateReport(raw, project.currentPhase)`; add a headless.test.ts case (wrong-phase report throws with the :79-81 message). Also emit the `autopilot.gate_denied`-style log when a report is rejected so the trail is visible.

**DoD:** test green; `ingest --report '{"phase":3,…}'` against a P9 project exits 1 with the phase-mismatch error.

---

## E-11 — Packet System JSON: capabilities + report schema + corpus hash — area 1 · S · low · P1

**Problem (evidence):** `systemJson` (`src/lib/packet.ts:21-65`) exposes state but no agent **capabilities** — the packet never tells the agent that `ingest`/`verify`/vault-search exist or that the oracle is runnable; the "Required output schema" prose (`packet.ts:232-241`) and `handoff.ts:101-107` name five markdown headings while the ingest seam validates the JSON `AgentReport` (`report-intake.ts:31-39`) — two disjoint output contracts the agent must reconcile by hand (02 E2#4 still open); research rows reach the packet (`packet.ts:89-91`) but nothing lets an agent detect corpus change between packets.

**Fix/spec:**
1. Extend `systemJson` with: `schema_version: 1`; `capabilities: {ingest:true, verify:"config-gated", vault_search:true}`; `report_schema: {phase, status:"complete|blocked|partial", summary, files?, tests_run?:[{command,pass,evidence?}], artifacts?:[{title,body,language?}]}`; `research_hash: String(fnv1a(sorted corpus URLs))`.
2. Replace the prose heading block (`packet.ts:232-241`) + `handoff.ts` Expected output (:101-107) with: "Return your work as ONE JSON report matching `report_schema` (see ## System JSON). The five markdown headings (Phase work / Files / Patch / Tests / Risks) remain the recommended structure of your artifacts' bodies for human review." (Full alignment is E-22.)
3. Bump `PACKET_VERSION` to 3 (`packet.ts:7`).

**DoD:** packet.test.ts asserts the JSON block parses and contains the new keys; handoff.test.ts updated.

---

## E-12 — Delete the duplicated headless live layer (M-10 closure) — area 3 · S · med · P1

**Problem (evidence):** M-10 is still open: `headless.liveLayer` (`src/lib/headless.ts:102-195`) re-implements `engine.fetchResearch`+`engine.liveLayer` (`src/lib/engine.ts:1249-1384`) — duplicated query builders (`headless.ts:90-94` vs `engine.ts:1226-1230`), duplicated artifact/narrative builders, duplicated footers (`headless.ts:166-170` vs `engine.ts:1240-1242`). Already drifted: engine's corpus entry records `provider` (`engine.ts:1329-1333`); headless's omits it (`headless.ts:180-192`).

**Fix/spec:** `headless.runPhase`'s live branch (`headless.ts:207`) delegates to the engine: dynamic `import("./engine.ts").liveLayer` (headless already statically imports engine pure fns; `liveLayer` is exported, bare-Node-safe, and degrades to `applyPhaseResult` on every failure). Delete `headless.liveLayer` + local `researchQueryFor`/builders. Audit `headless.test.ts` live-mode tests (they must still pass — engine.liveLayer under bare Node with no keys resolves to the deterministic result, same contract headless tests already assert).

**DoD:** headless.test.ts + engine tests green; grep shows a single `liveLayer` definition.

---

## E-13 — P7 DoD deterministic dead-end + a `deepen` research seam — area 3,6 · M · med · P1

**Problem (evidence):** `p7-research` requires ≥1 live corpus entry (`src/lib/dod.ts:144-147`) — a deterministic run (no `--live`, no keys) can **never** satisfy it. `store.finishPhase` records the FAIL post-completion (`store.ts:83-124,197`) so P7 completes with `gate_passed:false`, and there is no remediation: completed phases cannot re-run (`headless.ts:295-303`, `store.ts:154-166`), `unlockRetry` only reopens rejected phases (`engine.ts:1019-1025`), and live research only fires during synthesis of P0/P7/P11 (`engine.ts:1221-1222`). Agents running `gate --autopilot` without `--live` hit a permanent FAIL with no recovery path.

**Fix/spec:**
1. Honest gate semantics: `p7-research` probe passes when corpus ≥1 **or** `project.meta?.liveUnavailable === true` (new optional field; engine.liveLayer sets it when `fetchResearch` returns null because research was not configured — deterministic `applyPhaseResult` leaves it unset, so a deterministic run's FAIL stays an honest "live research was never attempted"). Criterion wording updated in `dod.ts:144-147`.
2. New seam `deepenResearch(project, phase)` (phase ∈ {0,7,11}) in engine/headless: runs `liveLayer` over the **completed** phase, appends a corpus entry **deduplicated by query+URL set** (idempotent re-runs), appends research/narrative artifacts, re-stamps the packet, re-records the gate (`recordGateInto`, E-02) with a fresh evidenceHash, logs `research.deepened`.
3. CLI `deepen --project X --phase 7` (always live) + store action + console phase-rail button "Run live research (P7)" when the recorded gate failed with `p7-research` unmet (see E-21).

**DoD:** dod/gates tests green; deterministic P7 records an unmet-but-explained gate; a fake-search `deepen` flips the recorded gate to PASS and appends exactly one corpus entry on double-run.

---

## E-14 — `modelRoute` honesty: stop claiming grok-4.5 / local-edge — area 3,7 · S · low–med · P1

**Problem (evidence):** `ModelRoute = "grok-4.5"|"local-edge"|"failover"` (`src/lib/types.ts:13`); every project defaults to `"local-edge"` (`src/lib/engine.ts:1059`); the packet prints `model: local-edge` (`src/lib/packet.ts:191`); the P1 artifact prose narrates "failover.LiteLLM (grok-4.5 → local-edge → failover)" as if present (`engine.ts:331`). The **actual** LLM backend is DeepSeek (`src/lib/deepseek.server.ts`, `DEEPSEEK_MODELS` flash/pro) and no LiteLLM/failover code exists anywhere. A packet that says `local-edge` mislabels the provenance of any LLM narrative the agent reads — a small but real honesty-lattice violation.

**Fix/spec:**
1. `types.ts:13`: `ModelRoute = "deepseek-flash" | "deepseek-pro" | "deterministic" | "none"` (keep the string union — small blast radius).
2. `engine.ts:1059` default `"deterministic"`; the first successful `completeDeepSeek` in `liveLayer`/crew stamps `modelRoute` (e.g. `deepseek-flash`) on the returned project; hydrate maps legacy `"grok-4.5"|"local-edge"|"failover"` → `"deterministic"` unless a `logs` entry shows a deepseek call (`engine.ts:1136-1209` hydrate path).
3. Packet `## System` line (`packet.ts:191`) prints the actual route; P1 artifact prose (`engine.ts:326-336`) is target-architecture spec — leave, but add "(target architecture)" to the `failover.LiteLLM` line.
4. Console chip: grep `modelRoute` consumers in `console.tsx` and label "deterministic engine" when no LLM ever ran.

**DoD:** hydrate test for legacy values; typecheck + packet.test.ts green.

---

## E-15 — Project kinds + scaffold emitter (packet → code on disk) — area 5 · M–L · med · P1

**Problem (evidence):** the spec graph names typed files (`schema/api/store/job-*/ui/tests`, `src/lib/algorithms.ts:329-373`) but **nothing materializes them**: engine phases 6–12 emit markdown artifacts only (`engine.ts:464-726`); `io.ts` exports JSON or packet markdown only (`io.ts:118-120`); the CLI emits project JSON / packet / vault md only (USAGE `scripts/rapidtool-cli.mjs:296-313`). The pipeline is a governed spec — the actual repository, package.json, build, and deploy scaffold are still hand-made. No project-kind notion exists (only domain, `engine.ts:92`).

**Fix/spec:**
1. `types.ts`: `Project.kind: "webapp"|"cli-tool"|"library"|"game"|"service"` (default "webapp", hydrate legacy); new pure `inferProjectKind(brief, latticeJobs): ProjectKind` in `algorithms.ts` (keyword scoring: ui/dashboard/board/desk/portal→webapp; parse/convert/cli/agent/script→cli-tool; sdk/package/library→library; game/play/level/arcade→game; api/service/webhook/worker→service).
2. New pure module `src/lib/emit.ts` (byte-deterministic, mirrors `buildPhase6Module` conventions):
   - `emitScaffold(project, dir)` writes, per spec-graph node in `order` (`algorithms.ts:373`), a typed stub: `schema` → domain types from `contracts.entities/fields` (`types.ts:190-196`); `api` → endpoint skeletons from `contracts.endpoints`; `store` → checkpoint-store stub; `job-N` → contract-header stub naming its oracle expectations (`oracle` rows); `ui` → kind-appropriate shell; `tests` → `oracle.spec.ts` with A7 rows as TODO stubs + verify-harness pointer (E-08).
   - Plus `package.json` per kind (webapp→vite+react+tailwind script set, cli-tool→tsx/node:test, library→tsc+test, game→vite), `README.md` (mission, phase rail, packet path, build/test commands), `.env.example` (no secrets), `.rapidtool/project.json` (the exported project) — every file stamped `machine-generated from RapidTool packet <id>; regenerate, don't hand-edit`.
   - `emitScaffold` pure (strings + writeFileSync at the CLI boundary): CLI `emit --project X --out dir [--kind]`.
3. Unit tests byte-compare emitted files for a seeded fixture.

**DoD:** emit.test.ts byte-equality green; CLI `emit` produces a typecheckable webapp scaffold for a fixture project (smoke: files exist and README lists build/test commands).

---

## E-16 — Report ↔ DoD cross-check on ingest (`report.gate_unmet`) — area 6 · S · low · P2

**Problem (evidence):** `applyReport` lands `status:"complete"` without consulting `runGate` (`src/lib/report-intake.ts:126-201` — no dod import at all); the only record is the `agent.report` log (`:148-154`). An agent can claim complete while the phase's DoD probes still fail, and nothing refutes it (02 E2#2 still open).

**Fix/spec:** when `report.status === "complete"`, compute `runGate(project, report.phase)` (`dod.ts:224-251`, pure); if unmet, append `{event:"report.gate_unmet", level:"warn", detail:"P<n> claim complete but DoD unmet: id1, id2"}` and prefix the summary memory row (`report-intake.ts:175-182`) with `(DoD unmet: …)`. Export `reportGateDelta(project, report)` for the store notice + CLI ingest output field `gate_unmet: [...]`. Advisory — never blocks (gates are advisory by design, `console.tsx:188`).

**DoD:** report-intake.test.ts case: complete report on a failing-DoD phase logs `report.gate_unmet` with ids.

---

## E-17 — Vault search: token-overlap ranking + scores surfaced to consumers — area 2 · S–M · low · P2

**Problem (evidence):** `searchVault` is substring-only (title 4 / tag 2 / body 1, `src/lib/vault.ts:376-388`); §2.3 S8 asked for token-overlap reusing `tokenizeWords`/`stemToken` (`src/lib/algorithms.ts:724-779`) plus FusionRank adjacency; consumers lose ranking entirely: CLI prints `{title,kind,tags}` with no score (`src/lib/headless.ts:680-698`, `scripts/rapidtool-cli.mjs:238-248`).

**Fix/spec:** additive — keep the landed `searchVault(notes, query): VaultNote[]` contract; add `searchVaultScored(notes, query): {note: VaultNote; score: number}[]` with tokenized overlap (title tokens ×4, tag exact ×2, body ×1, stemmed via `stemToken`) and make `searchVault` a thin wrapper over it. Headless `vaultSearch` uses the scored variant and extends `VaultSearchHit` with `score`; CLI prints `score`; console list may show a score chip. Tests: ordering + tie-stability + stem invariance.

**DoD:** vault.test.ts ordering tests green; CLI search output rows carry `score`, sorted desc.

---

## E-18 — Memory provenance fields + FusionRank cited-boost — area 2 · S · low · P2

**Problem (evidence):** `MemoryEntry = {id,kind,phase,text,score}` (`src/lib/types.ts:89-95`); engine rows are boilerplate with fixed scores (`engine.ts:238-248` `mem()`, `bootstrapMemory` `algorithms.ts:532-556`); `fusionRank` blends overlap + base score + kind prior (`algorithms.ts:214-261`) with no way to distinguish research-backed rows (report intake rows `report-intake.ts:175-190`) from template rows; vault memory notes therefore carry no URL/source either (`vault.ts:45-56` has no url/source fields) — honesty labels degrade in the 2nd brain except where the body text happens to keep them.

**Fix/spec:** additive optional `MemoryEntry.source?: "engine"|"agent-report"|"human"|"research"; url?: string; tags?: string[]`; `mem()` gains a `source` param; report rows → `source:"agent-report"`, `approveHitl`/`rejectHitl` rows → `"human"` (`engine.ts:923-933, 1006-1015`); fusionRank adds +0.15 when `source==="research"` and overlap ≥ 1; vault memory notes copy `url`/`source` into frontmatter when present (additive optional `VaultNote.url/source`, header comment updated). Hydrate keeps unknown-kind filtering (`engine.ts:1183`) untouched (additive fields only).

**DoD:** algorithms.test.ts ranking fixture; hydrate round-trip; vault note frontmatter carries url when present.

---

## E-19 — Regression-scoped advancement from the spec graph — area 3,6 · M · med · P2

**Problem (evidence):** the spec graph carries file-level dependencies (`algorithms.ts:326-373`); report `files` come back as strings (`report-intake.ts:31-39,106-118`); recorded gate verdicts include `evidenceHash` (`types.ts:140`, `store.ts:92-100`) but nothing ever re-runs `runGate` for a prior phase when a later phase's report touches the same file — TDAD-style regressions (6.08%→1.82% with pre-change impact analysis) are unguarded (02 B2/E4#1 open).

**Fix/spec:** pure `verifyPriorPhases(project, touchingPhase, files: string[])`: for each complete phase `p < touchingPhase`, intersect `files` with `specGraph.nodes[].file` + artifact titles of phase p; on overlap, re-run `runGate(project, p)` and compare `evidenceHash` to `p.gate.evidenceHash`; return `{phase, drift: boolean, unmetNow, wasPassed}[]`. Call it in `store.ingestReport` and `headless.ingest` when `report.files` present; log `regression.drift` (warn) per flip; surface in CLI ingest output + console notice (E-21). Never blocks (advisory), never mutates prior records.

**DoD:** unit tests: same-file report flips a prior gate → drift reported; no overlap → no entries.

---

## E-20 — Log autopilot gate denials (M-09 completion) — area 1,4 · S · low · P2

**Problem (evidence):** `canAutopilot` returns false silently on forceHuman / stock / **DoD-fail** / tight (`src/lib/store.ts:126-134`, headless twin `headless.ts:221-226`); M-09's spec ("log `autopilot.gate_denied`") was half-implemented — the DoD check landed (`store.ts:132`) but grep shows **no** `gate_denied` event anywhere. An autopilot run that parks on a failing DoD leaves only "Waiting on human approval" (`store.ts:152`, `headless.ts:293`) — no machine-readable reason.

**Fix/spec:** where autopilot is enabled and a gate exists but `canAutopilot` is false *because the DoD fails*, append `{event:"autopilot.gate_denied", level:"warn", detail:"P<n> unmet: <ids>"}` (logs already capped/sliced everywhere); in `headless.finishPhase`/`advanceOnce` push the same text into the returned `events` so CLI `gate` prints it (`runUntilGate` events, `headless.ts:326-335`). Human-facing text unchanged.

**DoD:** store.test + headless.test assert the event/string for a failing-DoD autopilot park; CLI output contains the unmet ids.

---

## E-21 — Console gate/verdict honesty UI (unmet drill-down, self-test labels, deny reasons) — area 4 · M · low · P2

**Problem (evidence):** evidence dock rows label `lastTest` "sandbox pass/fail" (`src/components/console.tsx:110-114`, footer :1322-1324); the phase rail shows only an 8-char evidence hash per gate (`console.tsx:~2505`); a completed phase with a recorded FAIL (deterministic P7, E-13) shows no reason; autopilot parks have no visible cause (E-20).

**Fix/spec:**
1. Relabel lastTest rows by the E-07 `label` field: "self-test (template)", "real run (bounded)", "tested (machine-run)" — never "sandbox".
2. Gate panel: clicking a phase's gate hash expands `gate.unmet` criteria (already stored, `types.ts:140`) with the caption "advisory — recorded, not blocking" and, when unmet includes `p7-research`, a "Run live research" button wired to E-13's deepen action.
3. When the run parked and the last `logs` event is `autopilot.gate_denied` (E-20), render the reason under the dock.

**DoD:** typecheck + build green; manual probe against a deterministic P7 project shows the drill-down and the deepen button.

---

## E-22 — Align packet/handoff output contracts with the JSON report schema — area 1 · S · low · P2

**Problem (evidence):** packet "Required output schema" = five markdown headings (`src/lib/packet.ts:232-241`); `handoff.ts` "Expected output" = same prose (`src/lib/handoff.ts:101-107`); the ingest seam validates JSON `AgentReport` (`report-intake.ts:31-39`). Two contracts, reconciled by hand (E-11 #2 is the packet-half; this entry makes handoff + report-intake consistent and documents the mapping).

**Fix/spec:**
1. `handoff.ts:101-107`: mirror E-11's instruction — JSON report per schema, markdown headings as artifact-body convention.
2. `report-intake.ts` validateReport: tolerate `artifacts[].body` that contains the five headings (no-op) and validate `files` against `specGraph.nodes[].file` prefixes **advisory** (log `report.file_outside_spec` when a file matches no node — catches invented paths, 02 B5 class).
3. Update `scripts/README-cli.md` ingest docs with a worked JSON example matching the schema.

**DoD:** handoff.test.ts + report-intake.test.ts green; packet text for a seeded project parses as instructions an agent can follow to produce a valid ingest payload.

---

## E-23 — Honesty-lattice lint (`scripts/honesty-check.mjs` + `npm run check:honest`) — area 7 · S · low · P2

**Problem (evidence):** honesty is enforced by comments and one-off fixes (M-01…M-12) with no machine check; each past violation (bulk `cited` promotion, "sandbox" wording, unverified narratives, "always available" status) required a human audit. Markers already exist in artifact bodies: `Source: <url>` (engine.ts:1234), `> generated prose — grounded/not grounded` (engine.ts:1240-1242), `> external report — unverified by engine` (report-intake.ts:50), `Illustrative competitor templates` (engine.ts:540).

**Fix/spec:** deterministic checker over an exported project JSON (mirror `scripts/brand-check.mjs` structure + `.test.mjs`):
1. every artifact whose title contains "narrative"/"LLM" and kind `research`/`docs` carries a `generated prose` footer;
2. every non-narrative `research` artifact carries `Source: http` or a title matching a `project.research` corpus item;
3. no `competitors[]` row has `source:"cited"` (field is reserved — per `types.ts:63-69`);
4. `lastTest.ok === true` ⇒ non-empty `detail` (mirrors dod p6-test);
5. every artifact id prefixed `report-` carries the unverified footer;
6. `modelRoute` ∈ the E-14 allowed set.
CLI: `node scripts/honesty-check.mjs --project file.json` → exit 0/1 + JSON findings; npm script `check:honest`; pure/unit-tested.

**DoD:** test fixtures pass/fail per rule; a deterministic P7 export passes rule set except the documented p7 caveat (rule 0 exempts gate artifacts).

---

## E-24 — `researchStatus` honesty: probe, don't promise — area 7 · S · low · P2

**Problem (evidence):** `research.ts` statusServer returns `{configured:true, label:"free search", provider:"duckduckgo"}` whenever Tavily is unset (`src/lib/research.ts:58-67`) with **no reachability check** — an offline host still shows green; provider hardcodes `"duckduckgo"` while the fallback chain is DDG/SearXNG/Wikipedia (`src/lib/websearch.server.ts`) and the provider union has four values (`research.ts:34`).

**Fix/spec:** status handler performs a tiny live probe (HEAD/GET a keyless endpoint, ~2.5 s timeout, 60 s cache): success → `{configured:true, label:"free search (ddg/searxng/wiki)", provider, probed:true}`; failure → `{configured:false, reason:"probe-failed", label:"unreachable"}` so the console chip (M-02's green chip) goes red honestly. Tavily-keyed path probes Tavily only when a key exists (else falls through).

**DoD:** websearch.test/research tests with injected fetch success/failure; console chip renders honest states.

---

## E-25 — CLI machine contract: exit-code taxonomy, stdin/`@file` input, `doctor` subcommand — area 1 · S · low · P2

**Problem (evidence):** every CLI result prints one JSON object and exits 0 or 1 only (`scripts/rapidtool-cli.mjs:69-72` `print()`; `run`/`gate` print `ok:true` even when `events` carry errors or `stopped:"blocked"`, `cli.mjs:118-140`); `ingest` requires `--report '<inline JSON>'` (`cli.mjs:170-181`) — long payloads fight shell quoting; README-cli's "Output contract" (`scripts/README-cli.md:86`) is prose with no exit-code table; agents cannot pre-flight capability state.

**Fix/spec:**
1. Every result gains `schema_version:1` + `cmd` + `exit_code`.
2. Exit-code taxonomy (documented in README-cli Output contract): `0` ok / terminal state reached; `1` usage/validation/unknown; `2` parked awaiting human or blocked (state fully on stdout); `3` backend not configured (verify/crew); `4` internal error with stack in stderr only. (Backward-compat: `ok` field kept.)
3. `--report` accepts `@file.json` or `-` (stdin) — read via `node:fs`/`readline` in the CLI layer; project paths unchanged.
4. New `doctor` subcommand: `{llm:{configured,label}, research:{configured,probed}, runner:{available}, node:process.version}` so agents branch before driving.

**DoD:** cli tests (mjs harness) assert exit codes per state; `ingest --report @r.json` round-trips.

---

## E-26 — DoD registry property tests — area 6 · S · low · P2

**Problem (evidence):** `DOD` (`src/lib/dod.ts:40-205`) is a hand-maintained registry; `evaluate` defensively swallows probe throws (`dod.ts:207-217`) — a probe that throws for a *realistic* project shape (not the seeded happy path) silently reports unmet, and a phase with no registration fails loudly only via the A22 guard (`dod.ts:231-243`). No property test asserts: every `PHASE_IDS` key registered, probes never throw across a phase-walk, evidenceHash stable across an io.ts JSON round-trip.

**Fix/spec:** extend `src/lib/gates.test.ts` with property tests over `seedProject()` (`src/lib/testing/fixtures.ts`): (1) `Object.keys(DOD).length === 13` and all ids unique; (2) walking `runUntilGate`-style through each phase with a phase-appropriate project never throws in any probe (wrap: run `runGate` after every phase completion); (3) `runGate(p).evidenceHash === runGate(JSON.parse(exportProjectJson(p))).evidenceHash` per phase; (4) every `GateItem` has a non-empty criterion.

**DoD:** property tests green and included in `npm test` via E-05's glob.

---

## E-27 — Shipped-artifact pass: bounded repo build + DEPLOY.md + asset notes — area 5 · M · med · P2

**Problem (evidence):** P9 emits a GH Actions YAML + IaC sketch **as artifacts** (`engine.ts:579-623`); nothing validates or executes them; CLI `verify` only runs the isolated P6 module (`headless.ts:774-781`), never an emitted repo; P12 openapi/adr stay in-project (`engine.ts:676-726`); P8 UI contract is prose (`engine.ts:554-578`) with no generated preview/assets; no deploy notes file exists for the human who just finished the pipeline.

**Fix/spec:**
1. Extend the bounded runner with `runCommandBounded(cmd, args, opts)` in `src/lib/node-runner.server.ts` (same caps: wall-clock timeout + tree-kill, output caps, scratch cwd, scrubbed env — header already says "bounded runner, NOT a security sandbox"); client seam in `exec.ts` (`runCommand` with `createServerFn`) + honest `{ok:false, reason}` shape.
2. `cli build --project X --dir D [--command "npm run typecheck && npm test"]`: after E-15's `emit`, runs the command via the server seam, returns `{exitCode, stdoutHead, stderrHead}`; never auto-installs deps without `--install`.
3. `cli ship-notes --project X [--out DEPLOY.md]`: composes DEPLOY.md from P9/P12 artifacts + kind defaults (webapp → firebase/GCP preview steps), stamped `> template derived from P9/P12 artifacts — verify credentials before any deploy` (deploy remains human-gated: HITL P9 semantics unchanged).
4. Asset handling note: P8 stays contract-level this wave; document in DEPLOY.md that assets/ and public/ are expected at the emitted scaffold and are not engine-generated (honest boundary).

**DoD:** node-runner tests for the new seam; `build` against a fixture scaffold returns real exit codes; DEPLOY.md contains the honesty stamp.

---

## E-28 — Crew transcript persistence + cost surfacing (03 §8 P2/P4 minimal) — area 4 · S–M · low · P3

**Problem (evidence):** `CrewSession` tracks `promptTokens/completionTokens/status/steps` (`src/lib/crew.ts` types) but the session is never persisted; console holds the run in memory only (`src/components/console.tsx:700-728` `setCrewRun`) — a reload loses the transcript; token costs are tracked but never shown or exported; the ingest lands artifacts only, not the transcript (console.tsx:707-728).

**Fix/spec:**
1. Console wrapper (or `crew.server.runCrewServer` return, `crew.server.ts:~583-672`): on ok runs, also ingest a `"Crew transcript"` docs artifact (roles/turns/stopped/tokens; footer "advisory LLM crew — unverified by engine").
2. `CrewRunResult`/console notice surface `≈N turns · prompt M · completion K tokens`.
3. CLI `crew --out crew.json` persists the raw session JSON (headless.runCrew returns messages/artifacts already — add tokens/status).

**DoD:** a stubbed crew run produces the transcript artifact via ingestReport; notice text shows token counts; `--out` writes JSON.

---

## E-29 — `runSandboxed`: give it a product consumer or deprecate honestly — area 3 · S · low · P3

**Problem (evidence):** `runSandboxed` (`src/lib/sandbox.ts:242-324`) — declared "the ONLY legal executor for non-template source" (:79-83, :169-175) — has zero product call sites (grep: only `sandbox.test.ts`); all product execution goes through `runCode`→`runNodeBounded` server-side (`src/lib/exec.ts`, `node-runner.server.ts`), which the module's own header admits is not a security sandbox. The worker isolate cannot run on the Node host (no DOM Worker). The doc/claim surface (`sandboxClaim` worker branch `sandbox.ts:163-165`) overstates what the product can do today.

**Fix/spec:** (a) preferred small move: add a browser-only "Run code in worker isolate (network stubbed)" affordance in the run dock (`console.tsx:~1085` area) — new store action `runSnippetSandboxed` executing pasted snippets via `runSandboxed` with an honest artifact label; or (b) declare `runSandboxed` deprecated with a header note and delete the "only legal executor" claims from comments/packet claim text (`sandbox.ts:79-83,169-175,163-165`). Either way, update 02_capability_audit §A6/B4 references afterward.

**DoD:** choice (a): UI action executes a snippet and returns the worker verdict; choice (b): grep shows no stale "only legal executor" claim.

---

## E-30 — Remove retired `ai.ts` shim + stale doc pointers — area 7 · S · low · P3

**Problem (evidence):** `src/lib/ai.ts` is a RETIRED shim re-exporting `llm.ts`, documenting the removed `VITE_AI_API_KEY` era, and stating "nothing in the app imports this module today" (`ai.ts:1-16`); keeping it invites future agents to import the wrong module, and AGENT-facing docs may still name the old wiring (grep AGENT_GUIDE.md/AGENTS.md for `ai.ts`/`VITE_AI_API_KEY`/`local-edge` before editing — per E-14 the model story changed to DeepSeek).

**Fix/spec:** grep-confirm zero importers (`grep -rn "lib/ai\|from \"./ai\"\|from \"@/lib/ai\"" src scripts research`), delete the file, patch only the AGENT docs paragraphs that name the retired wiring (never the historical fixes/ notes), and add a one-line "ai.ts retired on <date> — use llm.ts" pointer in the fixes ledger for archaeology.

**DoD:** typecheck + build green after deletion; grep finds no importers.
