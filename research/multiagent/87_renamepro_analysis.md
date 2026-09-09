# 87 — RenamePro CLI: honest verdict vs best OSS renamer + why RapidTool produced it + self-learning loop

**Analyst:** Flash A2 (RENAMEPRO CLI verdict) · **Date:** 2026-09-06 · **Mode:** read-only on RapidTool source; write of this file only.
**Scope:** CLI-tool delegation lane (task-1 of deleg_9bd5d956), scratch `C:\Users\mnril\rapidtool-make-2\`, project `renamepro.json` (brief: *"a batch file-renamer CLI with dry-run, regex rules, and undo"*). All six delegation tasks were completed (manifest 2026-09-06 13:23) before this analysis was finalized; no file under `rapidtool-make-2\` changed after 13:03 (verified).

---

## 0. Verdict up front

**RenamePro CLI is not a CLI and not a renamer.** The pipeline emitted a 12-file, mostly-TODO scaffold (`rapidtool-make-2\renamer-scaffold\`) whose only executable code is a 30-line *phase-gate simulator* unrelated to renaming. There is no argument parser, no dry-run, no regex rule, no undo log, no `bin` entry. The one place the pipeline produced excellent, brief-faithful requirements engineering (envelope `21-prompt.json`) is the place the output was **orphaned** — never stored on the project, never shown to the code stage.

**Overall score vs npm `renamer` (the most-used OSS bulk-renamer CLI): ≈ 1/10.** Not a close race; a category absence. Every claim below carries file evidence.

| Axis (0–10) | RenamePro (produced) | npm `renamer` 5.0.3 | Evidence (produced) | Evidence (competitor) |
|---|---|---|---|---|
| CLI ergonomics | **0** — no executable, no argv handling | **9** — `renamer [options] [file...]`, globs + stdin, plugin chain, views, `-h` | `renamer-scaffold\package.json` (scripts: only typecheck/test, no `bin`, no deps); `src\ui\console.tsx:10-13` `main()` throws `TODO(E-15 stub)` | `75lb/renamer` `lib/cli-options.js` (files defaultOption, `-d/--dry-run`, `-s`, `-v`, `-h`, view, chain); README synopsis |
| Correctness (dry-run / regex / undo) | **0** — no implementation of any promised feature | **8** — find/replace, `/regex/i` literals, replace-chain plugins; dry-run preview + per-run summary | `src\jobs\deliver_core_workflow.ts:11-16` only real code = `synthesize()` validating phase 0–12 / job name; package.json `description` promises features that exist nowhere | `75lb/renamer` README ("`--find "/one/i" --replace two`", "Rename complete: 2 of 6 files renamed."); `lib/chain/find-replace.js`, `lib/chain/index-replace.js` |
| Safety (overwrite/conflict) | **1** — nothing to be unsafe *with*; only honest labels | **8** — refuses to overwrite existing target unless `--force`; dry-run tracks intra-batch collisions (`dryRunLog`); README "always use `--dry-run`" disclaimer | README.md:62-65 "Honest boundaries" (admits stubs) — truthful but describes a non-product | `lib/rename-file.js` (`isFileAccessible(to) && !options.force` → err.code `'exists'`; dryRunLog collision check); `lib/cli-options.js` `--force` help text |
| Tests | **1** — `npm test` green-empty (2 `todo:true` stubs); `npm run typecheck` **fails**; "6/6 machine-run cases" are circular self-assertions | **9** — 8 test files (api, cli, bad-input, internals incl. `util-win32`, views, plugins) + CI workflow | `tests\oracle.spec.ts:12-18` both `{todo:true}`; typecheck: TS2688 (as shipped, `@types/node` unresolvable) **and** TS7006 `src/jobs/deliver_core_workflow.ts:11:21` (`spec` implicit any, strict); `22-verify.json` cases 1–6 all assert `synthesize(...)` | repo tree `test/*.js`; `.github/workflows/node.js.yml` |
| Docs | **3** — README/DEPLOY well-formed, honest, self-aware… about a stub; wrong OpenAPI (HTTP endpoint for a CLI) | **9** — README + wiki (usage examples, plugin how-tos, full CLI docs), Windows double-quote guidance, release notes | `README.md` (phase rail incl. "P0 … gate unmet", honest boundaries); `DEPLOY.md:41-46` honest "human-gated, nothing automatic"; `DEPLOY.md:104-116` OpenAPI `POST /v1/deliver-core-workflow` | 75lb/renamer README + wiki links; © 2012-26 |
| **Overall** | **0.9 / 10** — "honest empty scaffold for the wrong product" | **8.6 / 10** (48,501 downloads/wk, v5.0.3 2026-03-19) | — | npm registry + api.npmjs.org |

**Context rows:** `itchyny/mmv` (Go, 805★) — editor-driven renames, **cycle support** via temp-file two-phase rename + error rollback, table-driven `TestRename` incl. "swap two files"/"two swaps" (`mmv_test.go`); Perl `rename` (`ap/rename`, 136★) — `-n` dry-run. None of the three ships persistent undo, so the brief's undo requirement was a *differentiator RenamePro also failed to deliver* (0/10 on undo specifically). Runner-up fairness note: `renamer` is a mature 2012–2026 product; the point is not parity but that the pipeline's **only code output shares zero semantics with the brief**.

---

## 1. What the pipeline actually produced (evidence inventory)

12 files, 1,941 lines total (`.rapidtool\project.json` alone is 1,575) — `rapidtool-make-2\renamer-scaffold\`:

| File | Content (evidence) |
|---|---|
| `package.json` | name `renamepro`, `"description": "a batch file-renamer CLI with dry-run, regex rules, and undo"`, **no `bin`**, scripts `typecheck`/`test` only, zero deps, `generatedBy: "RapidTool scaffold emitter"` |
| `src/ui/console.tsx:10-13` | `main(ctx)` → `throw new Error("TODO(E-15 stub): implement the console entry per the oracle")` — the CLI entry point is a throwing stub |
| `src/api/routes.ts:15-22` | `route()` → throws TODO; endpoint `POST /v1/deliver-core-workflow` — an **HTTP contract for a batch file renamer** |
| `src/domain/custom_software.ts` | entities `Operator`, `Record`, `DeliverCoreWorkflow` = `{id:ulid, status:enum, updatedAt:datetime}` — generic, not file/rename domain |
| `src/state/store.ts` | `CheckpointStore` (phase/status/updatedAt) — a copy of RapidTool's own checkpoint concept |
| `src/jobs/deliver_core_workflow.ts:11-16` | **the only real code**: `synthesize(spec)` rejects `phase<0||phase>12`, unknown jobs, then returns `{ok:true,name,job,addressed}` — a gate/phase simulator |
| `tests/oracle.spec.ts:12-18` | both rows `{todo:true}`: "orc-1 … deliver-core-workflow ⇒ 200 + persisted entity + checkpoint", "orc-phase … P9 while P4 is open" — **zero rename assertions** |
| `README.md` / `DEPLOY.md` | honest, well-written — about a scaffold for "the deliver-core-workflow job"; README:30 "P0 … gate unmet", :36 "P6 … gate unmet" |
| `.rapidtool/project.json` | full record: `verdict:"reframe"`, `lattice.vague:true`, `competitors: [Cursor, v0/Bolt/Lovable]` (`source:"illustrative"`), `openapi` = deliver-core-workflow, `generatedSource` = the 30-line simulator, `lastTest:{label:"tested", evidenceHash:"212163304"}` |

**Live checks (run 2026-09-06):** `npm test` → `# todo 2`, **0 pass / 0 fail** (green-empty). `tsc -p … --noEmit` → `TS2688: Cannot find type definition file for 'node'` (deps never installed, as shipped); standalone strict compile → `TS7006: Parameter 'spec' implicitly has an 'any' type` at `deliver_core_workflow.ts:11:21`. So the advertised `npm run typecheck` fails and the only module is non-strict-clean.

---

## 2. Why the pipeline produced this — stage-by-stage dissection (engine file:line)

The failure is a **compounding pipeline: one wrong classification at A1, faithfully amplified by every downstream stage**, wrapped in governance ceremony that recorded but never corrected it.

**S1 — A1 Intent Lattice misclassified the brief (root cause).** `src/lib/algorithms.ts:24-111` `LEX` register contains actors (shop/tech/nurse/…), jobs (dispatch/quote/invoice/…), objects (job/parts/sku/lead/…), constraints, risks — **zero CLI/dev-tool vocabulary**: no `rename`, `cli`, `regex`, `undo`, `dry-run`, `batch`, `file(s)`. The brief matched nothing → `intentLattice` (`algorithms.ts:145-210`) produced no job/entity nodes → `vague = jobs.length === 0 && entities.length === 0` (`:200`, `vague:true` recorded) → **fallbacks fired**: `jobs: ["deliver-core-workflow"]` (`:203`), `entities: ["operator","record"]` (`:204`), domain default `custom-software` (`:149`), complexity 3/10 (`:207`). Fallback is test-pinned behavior (`algorithms.test.ts:131,165`). Task-1 driver independently root-caused this (task-1.log 13:00:33-13:01:03: "LEX register has zero CLI/dev-tool vocabulary"). **Post-run check:** task-4 edited `algorithms.ts` (13:04) but the LEX register still contains no CLI/rename terms — defect persists in the final tree.

**S2 — Scorecard verdict `reframe` + canned HITL approval.** The P0 scorecard artifact grades the *platform's own architecture*, not the brief (axes: "Typed contracts + sequential graph", "Stateless workers + durable checkpoints", bottlenecks "Long-running tools must stream over WebSocket MCP"; `competitors: Cursor, v0/Bolt/Lovable`). `dod.ts:57` criterion → **P0 DoD gate FAIL** (gate artifact, evidence hash 536716187). Then HITL decision `hitl-0 "Reframe the brief"` was **approved with no note 15 s after being requested** (`vault\Reframe the brief.md`: requested 17:54:01.719 → decided 17:54:16.562, "_No note recorded._"; `approve-01.json`, `note: null`, `decidedBy: "human"`). The "human" was the delegation driver agent whose goal was literally *"Keep gates green"* (task-1 goal; approvals were pre-written canned JSON `approve-0X.json`). Approvals need no reason by design (ADR-002: *rejection* requires ≥12 chars) — so the single most consequential decision of the run (accepting a reframe) happened with zero recorded reasoning, and approval overrode the failed DoD.

**S3 — Research + narrative: same-name hijack, laundered as a "pivot".** P0/P7/P11 research fetched the *real commercial Revit add-in* **"Rename Pro"** (`rename-pro.com`, `github.com/egsoiiu/RenamePro`, CNET "Renamer Pro" — P0 research artifacts; packet.md:251-270, :322-339). The per-phase LLM narrative call (`engine.ts:1610-1633`, prompt at `:1623` "Write a concise one-paragraph phase narrative … Brief: …") then wrote fiction bridging the two products: *"RenamePro is now advancing from its established foundation as a Revit add-in … pivots toward a powerful batch file-renamer CLI…"* (packet.md:272-273, artifact "Phase narrative (LLM)"). That paragraph is the **only text in the entire packet** (besides the brief itself) mentioning dry-run/regex/undo — the desired product appears only as a hallucinated transition story. Nothing downstream detects the mismatch between research subject (Revit plugin) and brief (CLI).

**S4 — A5/A6/A7 architecture tools derived contracts & oracle from the wrong lattice.** Deterministic arch tools turned `deliver-core-workflow` into the spec graph (packet.md:199-204: `src/api/routes.ts`, `src/state/store.ts`, `src/ui/console.tsx`, job file…), A6 contracts (Operator/Record/DeliverCoreWorkflow, `POST /v1/deliver-core-workflow`; packet.md:206-210), and A7 oracle rows ("Authorized operator submits deliver-core-workflow ⇒ 200 + persisted entity + checkpoint written"; packet.md:212-214). Scaffold files and oracle stubs are derived straight from these (`scaffold.ts:4-10` header: files "derived from the spec graph (generatedSource embedded verbatim)", "tests/oracle.spec.ts TODO stubs from the A7 oracle") — hence `console.tsx`, `routes.ts`, `store.ts`, and oracle rows about operators/checkpoints. **One wrong turn at S1, faithfully compiled into every downstream artifact.**

**S5 — P6 "Code Generation" is deterministic template theater.** `engine.ts:493-530` (phase 6): `buildPhase6Module({ name, jobs, rejectionNote, variant })` (`sandbox.ts:125-155`) — inputs are **name + job list + rejection note only; the brief never enters**. Output: `JOBS=[...]`, `REJECTION=…`, `synthesize()`, self-tests (`test_happy`, `test_no_skip`, optional `test_rejection_addressed`); `healSource` (`sandbox.ts:105-110`) can even inject `test_happy` into a failing module. Sandbox `runGenerated` → `lastTest` → "Sandbox passed: …" memory. The promised "machine-verified core" is therefore a **phase-gate simulator that verifies its own phase logic**, not the product.

**S6 — Verify is a closed loop with no ground truth.** `verify.server.ts:1-18`: DeepSeek writes boolean expressions "that assert behavior of the source's exports" (generateCases); the harness runs them via `with(exports)`; "the machine — never the LLM — declares pass/fail" (a genuinely good harness). But the oracle it is asked to satisfy (A7) was generated in S4 from the wrong lattice, and the cases it writes (22-verify.json case-1..6) all assert `synthesize(...)` behavior **against the module's own exports** — the brief never appears in the loop. `parseOracleJson` (`verify.server.ts:191`) tolerantly accepts whatever the model returns. Result: `lastTest {label:"tested", evidenceHash:"212163304"}`, P6 criterion `p6-verified` (`dod.ts:153`; E-07 semantics in `gates.test.ts`) satisfied by `verify --apply`, "All 13 phases sealed" (`delivery.complete` log). **6/6 passed = the module agrees with itself about itself.**

**S7 — The one excellent artifact was orphaned.** `prompt` cmd → `promptExpand` (`headless.ts:1352-1359`) → `expandBrief(brief, policies)` (`prompt-engine.ts:155`; DeepSeek) produced `21-prompt.json`: a genuinely good, brief-faithful spec — 12 requirements, 17 edge cases (collisions, case-only renames, interrupted runs, concurrent instances…), error handling, **type signatures** (`renameFiles`, `planRenames`, `applyRenames`, `undoRenames`, `generateNewName`, …), data flow, negative constraints. It was **returned to the caller and written only to the envelope** — never stored on the project (no field in `renamepro.json`), never included in the packet (packet.md has no requirements section), never fed to P6 (S5), never fed to verify (S6), and the crew ran *before* prompt anyway (task-1.log: crew 12:57:27, prompt 12:57:49). The pipeline's best thinking about the actual product was a dead letter.

**S8 — Oversight layers were ceremony.** Swarm critiques: "provenance: deterministic — no LLM turn was dispatched; live crew LLM seats remain config-gated (runCrew)" (`12-swarm.json`; `swarmPlan` headless.ts:1342) — findings are info-level ("edge is sealed"). Crew *did* fire a genuine, correct negative review at P12 ("critical gaps… OpenAPI minimal… **Verdict: FAIL — must remedy before gate acceptance**", `20-crew.json` reviewer) and the architect then patched *contract docs* — still for the wrong product — while "DoD gate for P12 was marked PASS by the engine". Crew/swarm verdicts are advisory; DoD gates are engine-deterministic (`dod.ts`) and never consult them. Bench = "synthetic dry-run estimate — heuristic, not a measured run" (`13-bench.json` disclaimer).

**S9 — Scaffold & export are honest and deterministic.** `scaffold.ts` (E-15/E-27) is well-engineered: pure/byte-identical output, escaping, PLACEHOLDER-only env, DEPLOY honesty stamp (`scaffold.ts:20-24, 70-75`); README honestly lists "P0 … gate unmet", "P6 … gate unmet" and "everything else is a typed stub awaiting implementation" (`renamer-scaffold\README.md:30,36,62-65`). Driver verified byte-identical export (task-1.log 13:02:07 "BYTE-IDENTICAL"). **The record-keeping is excellent; the record is of the wrong product.** Kind inference even worked (`projectKindOf` → `cli-tool` via keyword `cli`, `scaffold.ts:64`) — only the content layer failed.

**Quality that DID come from specific stages:** prompt-expansion spec (S7, LLM) · narrative grounding seam exists (engine.ts:1623, LLM) · verify harness + expression sanitizer (S6, engine) · deterministic emitter + honest labels (S9) · LLM crew can produce correct FAIL reviews (S8) — each is a hook for the improvement plan below.

---

## 3. Lessons

**Persist-good**
1. `promptExpand`/`expandBrief` yields excellent brief-faithful specs → persist on the project and wire into every downstream consumer.
2. Verify harness discipline (machine-runner declares pass, sanitized expressions, honest `not-configured`) → keep, but ground it in the brief/spec.
3. Scaffold honesty machinery (E-27 DEPLOY stamp, README "stub" boundaries, PLACEHOLDER env) → keep as the standard.
4. LLM crew reviews can be genuinely negative and correct → make them binding or surface them in the phase rail (currently invisible after PASS).
5. Deterministic byte-identical emitter + materializer probes → keep (they made this whole analysis possible).

**Prevent-bad**
1. **Lexicon gap**: LEX has no CLI/dev-tool/job vocabulary (`algorithms.ts:24-111`) → dev-tool briefs always fall to `deliver-core-workflow`.
2. **Silent fallback**: vague briefs get plausible generic jobs/entities/oracles — nothing downstream knows the lattice is fabricated.
3. **Oracle circularity**: oracle & verify-cases derive from the same fabricated lattice and the module's own exports; the brief is the only ground truth and never enters.
4. **Null-note approvals overriding failed DoD** — "Reframe the brief" decided in 15 s by a gate-green-seeking driver.
5. **Same-name research hijack** (Revit "Rename Pro") laundered via LLM "pivot" narrative (`engine.ts:1623` call site).
6. **Orphaned high-value artifacts** (S7) — envelope-only outputs.
7. Advisory theater (swarm/crew/bench) presented alongside engine PASS verdicts without clear binding semantics.
8. **P6 is not code generation** — deterministic phase-simulator template, brief never an input.

---

## 4. Improvement plan + self-learning loop (exact module hooks)

RapidTool already ships the persistence half: `src/lib/knowledge.ts` — `KnowledgeStore` (`:122`; append-only `savePattern`, deterministic `findPatterns`, advisory `injectProven` → `ProvenRow`), headless wrappers `knowledgeSave` (`headless.ts:1476`) / `knowledgeFind` (`:1483`), per-project `vault/` with ranked search, per-phase `memory` rows (engine.ts:319-668) ranked into the packet (FusionRank, A2). **Gap: `injectProven` has no production consumer** (only `knowledge.test.ts:120-148`), and CLI `knowledge` is manual.

**Loop design:** run → analyst verdict (files like this one) → `knowledge save` entries → future runs retrieve them into A1/prompt-expansion/verify/narrative → new verdicts → new entries. Plus engine wiring so retrieval is automatic:

| # | Hook (file:line) | Change |
|---|---|---|
| H1 | `algorithms.ts:24-111` LEX | Add dev-tool register: job `rename|bulk-rename|find-replace|convert|parse`, object `file(s)|folder|name|glob`, constraint `dry-run|undo|regex|case-insensitive`; entities `file`, actor `user/operator` (operator already exists). Extend `algorithms.test.ts` with a renamer-brief case asserting no fallback fires. |
| H2 | `algorithms.ts:145-210` `intentLattice` | When `vague && brief non-empty`: (a) auto-log the brief to the knowledge store (`kind:"note"`, tags `[vague-brief]`) so lexicon gaps self-record; (b) consult knowledge `findPatterns(brief)` for job/entity suggestions (kind `brief` entries store brief→lattice mappings) before falling back. |
| H3 | `headless.ts:1352-1359` + `prompt-engine.ts:155` `expandBrief(brief, policies)` | Policies parameter already exists (CLI `--policies`, driver log 12:57:27). Auto-append top `knowledge.injectProven` advice + top vault-search notes for the brief into `policies`/ground. **Persist the returned spec onto the project** (new `project.spec`; hydrate/export seams `io.ts:25/47`, `engine.ts:1454`). |
| H4 | packet compilation (packet.md structure, A2 ranked memory) | Emit `## Requirements (spec)` + `## Required API` (typeSignatures) sections from `project.spec` so every downstream agent (crew/implementer) sees the brief-faithful contract. |
| H5 | `engine.ts:493-530` P6 | If `project.spec` exists and LLM configured: real synthesis — LLM implements the spec's typeSignatures in the isolate (`sandbox.ts` `runGenerated`), `healSource` (`sandbox.ts:105-110`) bound to spec-API failures; deterministic `buildPhase6Module` demoted to fallback/no-key path. |
| H6 | `verify.server.ts:6-11` (generateCases prompt) | Include `brief` + `spec.requirements` + `spec.typeSignatures` in the case-generation prompt; require ≥1 case per required API the module claims to export; **fail when a required signature is absent** (kills the self-referential loop). |
| H7 | `dod.ts:57` (P0 criterion) + approve seam (`headless.ts` approve cmd, `approve-0X.json` shape) | New criterion `p0-brief-grounded`: unmet when `lattice.vague && brief non-empty`. Approve-over-unmet-DoD requires a written note ≥12 chars (mirror ADR-002's rejection rule) — kills null-note reframe approvals. |
| H8 | `crew.server.ts` verdicts vs `dod.ts` gates | Make crew FAIL binding on the phase gate (human override with note), or label reviews "advisory — does not affect gate" in the phase rail so the record cannot read as checked. |
| H9 | `engine.ts:1623` narrative call site | Extend `{ground}` with lattice jobs/entities + verdict; instruct: "if research describes a different product than the brief, state the mismatch; never invent a transition." Add a post-check: narrative must not assert product features absent from `spec.requirements`. |
| H10 | Research intake (P0/P7/P11) | Name/entity-collision guard: flag when dominant research sources' product ≠ brief domain terms (Revit add-in vs batch CLI) → surface as HITL question instead of a narrative bridge. |
| H11 | Global lesson seeding | Default knowledge-store path gets seeded from this run: `knowledge save` entries — `fix: LEX dev-tool vocabulary gap (algorithms.ts:24-111)`, `pattern: vague-brief fallback → deliver-core-workflow`, `fix: verify oracle circularity (verify.server.ts)`, `fix: promptExpand spec orphaned (headless.ts:1352)`, `note: name-collision hijack (rename-pro.com)`, `pattern: approval-over-FAIL needs note` — so the next `create --brief "...renamer..."` run retrieves them via H2/H3/H6 and *cannot* reproduce this trajectory silently. |

**Loop closure:** future verdict pass (this delegation's `89_self_learning_research.md` family) → curator converts accepted fixes into knowledge entries → H1-H7 make them load-bearing. Vault (per-project) carries run-specific ADRs; knowledge.ts carries cross-project patterns; both are already ranked-retrievable — the missing piece is only that A1/expandBrief/verify/narrative currently *ignore* them.

---

## 5. Limits of this analysis

- Competitor data fetched live 2026-09-06 (GitHub API, npm registry, raw sources); npm download window 2026-08-23→29.
- Only the CLI lane's outputs analyzed; RT engine read read-only. `algorithms.ts` (13:04) and `dod.ts` (13:12) were edited by sibling delegation tasks after the RenamePro run but before this analysis; all citations were re-verified against the final file contents, and the LEX-gap claim holds on the final tree.
- The delegation driver (task-1) hit its iteration cap at 13:23 without writing `fixes/81_m2_clitool.md`; its root-cause finding is quoted from its live log.
