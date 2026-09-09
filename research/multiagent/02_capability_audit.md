# 02 — Capability Audit: RapidTool as a zero-hallucination, correct-tested-code harness for agents

- **File:** `research/multiagent/02_capability_audit.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`)
- **Date / agent:** 2026-09-05 · Flash audit agent (read-only; the ONLY files written this pass are this one + `audit-bugs/05_multiagent.md`)
- **Question:** can RapidTool, *as it exists on disk today*, help an AI coding agent produce **effective, zero-hallucination, logically-correct, tested code**? Where does it already help, what is missing, and what are the highest-leverage changes?
- **Method:** every claim below is file:line-verified against the current tree (full reads of `engine.ts`, `algorithms.ts`, `packet.ts`, `sandbox.ts`, `dod.ts`, `store.ts`, `headless.ts`, `handoff.ts`, `report-intake.ts`, `io.ts`, `exec.ts`, `node-runner.server.ts`, `llm.ts`, `llm-tasks.ts`, `deepseek.server.ts`, `research.ts`, `websearch.server.ts`, `phases.ts`, `types.ts`, `gate-stats.ts`, `AGENT_GUIDE.md`, `scripts/rapidtool-cli.mjs`; targeted reads of `console.tsx`); external claims cite URLs. Bug details cross-referenced to `audit-bugs/05_multiagent.md` (M-01..M-12). Prior-adjacent research: `research/02_industry_sdlc_grading_research.md` §4 (verification-driven dev) and `review/03` §2 (packet agent-usefulness) — this doc builds on both, at code level.

---

## A. What RapidTool already does well for correct-code (verified)

**A1. A spec-first, phase-locked pipeline that an agent cannot skip.**
The 13-phase graph is enforced by `canEnter` (only `from+1`, `phases.ts:118-120`), `priorsSealed` (`phases.ts:122-131`), DoR checks in every advance path (`store.ts:152-164, 249-251, 283-286`; `headless.ts:224-226`), and status machines that only ever move locked→ready→running→awaiting_hitl→complete. Illegal jumps are structurally rejected before synthesis. This is the "confinement" half of review/03 §2.1(1), and it is real code, not copy.

**A2. Deterministic pre-build artifacts that anchor the agent: intent lattice, contracts, oracle, spec order.**
`runAlgorithms` (`algorithms.ts:614-670`) produces: intent lattice with word-boundary/stemmed matching (`algorithms.ts:145-192`); a constraint scheduler with domain risk tables and extra-HITL injection (`algorithms.ts:264-284`, `113-123`); a typed spec graph with dependency order and owner roles incl. a `tests` node (`algorithms.ts:326-374`); data contracts with entity field banks and endpoints (`algorithms.ts:406-435`); a test oracle (`algorithms.ts:438-463`); a crew table with per-phase active roles (`algorithms.ts:470-530`). All of it is compiled into the packet (`packet.ts:150-222`) so a fresh agent session gets a coherent, deterministic blueprint instead of re-deriving structure from a brief — the MetaGPT-style "intermediate documents improve downstream execution" bet (see research/01 §3.3).

**A3. A machine-readable, honesty-labeled packet envelope.**
`## System JSON` (`packet.ts:21-65`) exposes `packet_version`, per-phase `status`/`rejections`/`gate_passed` (`packet.ts:55-60`), the decision ledger with actor + ISO timestamps (`packet.ts:47-54`), and `rejection_loop` metadata (`packet.ts:43-46`). The prose packet names the current edge, forbids jumps, demands a fixed output schema (Phase work / Files / Patch / Tests / Risks, `packet.ts:225-236`), says out loud when truncated (`packet.ts:242-244`), and prints the *honest* execution claim (`packet.ts:188` ← `sandboxClaim`, `sandbox.ts:158-167`). Machine-parseable steering history is exactly what a stateless agent cannot reconstruct from a raw brief (review/03 §2.1(2)).

**A4. DoD exit criteria as deterministic, re-verifiable probes.**
Every phase 0–12 has machine-checkable criteria (`dod.ts:40-194`) evaluated by `runGate` with an FNV-1a evidence hash over sorted `id:pass|fail` pairs (`dod.ts:213-240`); verdicts are recorded on the phase record, emitted as `gate` artifacts/logs (`store.ts:83-124`), surfaced as the HITL dock "evidence" panel (`console.tsx:77-127, 1614-1648`), and embedded in per-phase handoff prompts as checkboxes (`handoff.ts:28-33, 65-69`). Hash-verifiable exit criteria are rare in agent tooling and genuinely useful.

**A5. A governed rejection loop with append-only history.**
Rejections require ≥12 chars of qualitative feedback (`engine.ts:966-969`; enforced in the UI `console.tsx:1661,1677`), are appended to an immutable per-phase history (`engine.ts:973`), logged to the ledger (`engine.ts:979-1016`), and deterministically steer regeneration: P6 flips a code variant off `fnv1a(note)+attempt` (`engine.ts:469-470`, `sandbox.ts:146-153`); text phases append a visible keyword-matched "Rejection response" block (`engine.ts:787-795, 156-171`). Rubber-stamp risk is *measured* (`gate-stats.ts:38-74`) and surfaced in the rail (`console.tsx:1904-1920`).

**A6. Honest-execution primitives with real boundaries.**
- P6 template self-test with one-shot self-heal and a `forceHuman` gate on failure (`engine.ts:463-526`; `healSource` `sandbox.ts:99-104`; deny-list scanning of code *after* masking literals/comments, `sandbox.ts:24-67`).
- A bounded local Node runner (`node-runner.server.ts:74-170`) with wall-clock timeout + Windows tree-kill (`:48-55`), output caps (`:32-34,121-126`), scratch cwd, proxy-scrubbed env (`:59-72`), and an honest "NOT a security sandbox" header (`:1-21`) — reachable via `runModuleReal` ("Run module (bounded)", `store.ts:452-488`, `console.tsx:970-979`).
- A real worker-isolate sandbox implementation with network stubs and terminate-timer (`runSandboxed`, `sandbox.ts:242-324`) — currently unused by product flows (see B4).
- Every failure mode returns a typed, non-throwing, non-fabricating result (`exec.ts:39-65`, `llm.ts:44-62`, `research.ts:49-62`, honest `{ok:false,reason:"not-configured"}` contract throughout).

**A7. Real grounding exists and is wired end-to-end when it fires.**
Server functions chain Tavily → keyless DuckDuckGo/SearXNG/Wikipedia with URL dedupe and Wikipedia intro enrichment (`research.ts:29-38`; `websearch.server.ts:300-357, 90-118, 215-241, 253-298`); findings land as `research` artifacts carrying `Source: <url>` bodies (`engine.ts:1302-1304`, `headless.ts:149-156`) and (optionally) ground an LLM narrative with the fetched snippets (`engine.ts:1265-1271`). `source:"illustrative"` markers distinguish template rows from real ones in the data model (`types.ts:63-64`).

**A8. Report intake exists with validation-first + distinguishability.**
`validateReport` rejects malformed payloads before any state change (`report-intake.ts:43-101`); ingested text lands as `[agent report]` artifacts with an "external report — unverified by engine" footer (`report-intake.ts:35-37, 103-148`) so engine output is never confused with agent output. Headless + CLI (`headless.ts`, `scripts/rapidtool-cli.mjs`) let an agent drive the full pipeline from files with JSON stdout.

**A9. Defensive repair on every boundary.**
Hydration repairs corrupt phase arrays/statuses loudly (`engine.ts:1095-1207`), import validates shape before hydrating (`io.ts:47-90`), and algorithm consumers skip (never crash on) malformed memory rows (`algorithms.ts:230-234`). Robustness is a precondition for agent automation and is unusually thorough here.

---

## B. What is MISSING to go from "governed scaffold" to "correct, tested code" (each gap file:line-evidenced; bug register: audit-bugs/05)

**B1. No verification loop: nothing can execute a test against agent-built code, and nothing checks "did the tests really pass?".**
The DoD "test" gate trusts `lastTest` (`dod.ts:111-114`), which is only ever set by the P6 **template self-test** (`engine.ts:471-481`; `sandbox.ts:71-97` refuses non-template source at `:81-83`). The test oracle is prose with no executable form (`algorithms.ts:438-463`; packet lists it as bullets `packet.ts:181-182`); the spec graph's tests node is a description of a file that is never generated or run (`algorithms.ts:365-371`). `runSandboxed` exists but has zero product call sites (verified by grep). Agent reports may claim `status:"complete"` with **no test evidence field at all** (`report-intake.ts:20-26`) and the report is never checked against the phase's DoD or the current edge (`report-intake.ts:46-49`, M-05). Result: the product can prove its *template* runs, never that the *agent's deliverable* works. Industry framing: Anthropic's verification-driven rule — give the agent "a check it can run… the difference between a session you watch and one you walk away from" (https://code.claude.com/docs/en/best-practices); a static packet with no runnable check leaves "'looks done' as the only signal" (research/02 §4.1 quotes with corroborating sources https://www.datacamp.com/tutorial/claude-code-best-practices, https://harper.blog/2025/05/08/basic-claude-code/). Tests-first is not decoration: TDD-Bench Verified shows LLMs *can* write fail-to-pass tests from issue text, and that doing so improves fix correctness (https://arxiv.org/abs/2412.02883), and execution-feedback repair of generated tests outperforms non-executing generators (https://arxiv.org/html/2508.06365v1).

**B2. No fail-to-pass / regression discipline — nothing protects previously passing behavior.**
There is no "freeze the failing tests, then converge" step anywhere: no oracle checkpoint before codegen, no pass-to-pass re-run when a later phase modifies earlier files, no "do not disable existing tests" rule. The engine's own P6 convergence is a *code* self-heal (`healSource` adds a missing test, `sandbox.ts:99-104`), which can make the harness pass by weakening what it checks. Empirical stakes: TDAD found LLM agents break previously passing tests at scale and graph-based pre-change impact analysis cut that regression rate from 6.08% → 1.82% on SWE-bench Verified instances (https://arxiv.org/html/2603.17973v1; practitioner summary https://www.augmentcode.com/guides/spec-tdd-shippable-ai-generated-code). Microsoft's Azure SDK AGENTS.md pattern (agents barred from removing/disabling existing tests unless instructed) is the same discipline in production (https://github.com/Azure/azure-sdk-for-net/blob/main/AGENTS.md). RapidTool's spec graph (`algorithms.ts:326-374`) is exactly the dependency map such an impact analysis needs — it is just never used for regression scoping.

**B3. Test inversion risk is unguarded: the same agent writes code *and* the "tests" that must pass.**
The packet tells the agent to return "Tests — commands and expected pass condition" (`packet.ts:230`) but nothing independent produces those tests. Practitioner evidence is consistent that when one model authors both implementation and tests, it tends to "hallucinate consistency" — making tests pass by aligning them with the (possibly wrong) code (Augment "Spec + TDD": the agent "made the test suite pass by changing the specification while leaving the underlying code incorrect", https://www.augmentcode.com/guides/spec-tdd-shippable-ai-generated-code; Endor Labs test-first prompting for the same reason, https://www.endorlabs.com/learn/test-first-prompting-using-tdd-for-secure-ai-generated-code; community replication of the "maintenance spiral", e.g. r/ClaudeAI threads on AI-driven TDD). RapidTool's *scaffold* oracle (`algorithms.ts:438-463`) was designed to be the independent oracle (research/02 §4.2 calls it "genuinely ahead of most agent harnesses") but is never frozen, never emitted as executable tests, and never run against agent output — so its independence is unused.

**B4. Grounding is disconnected from verification and decays mid-build.**
- Template competitor rows are bulk-relabeled `cited` on any research hit with no per-row evidence, and the UI renders no source column (M-01: `engine.ts:1309`, `headless.ts:174`, `console.tsx:1581-1587`).
- The P7 DoD passes on template artifacts with zero live research (`dod.ts:128-137` satisfied by `engine.ts:534`).
- Research citations live only as artifacts and age out of the packet's last-8/900-char window (`packet.ts:80-87`) plus the 14k hard cap (`packet.ts:242-244`) just as the build phase begins (M-06).
- LLM phase narratives can be pure invention (prompt: "reason from the brief and lattice only" when research is empty, `engine.ts:1271`) and carry no unverified marker (M-07), unlike agent reports (`report-intake.ts:37`).
Grounding literature consensus: provenance (URL, date, snippet) must travel *with* the claim and be machine-checkable or the "grounded" label is noise (survey framing in https://arxiv.org/html/2508.00083v1 §V-A; hallucination-to-consensus multi-agent test oracle work, https://arxiv.org/abs/2505.03753 per that survey's ref [114]).

**B5. Structured output is skeletal — on the provider side and on the agent side.**
- Provider side: DeepSeek calls use `response_format:{type:"json_object"}` (`deepseek.server.ts:150-157,167`) — prompt-shaped JSON, *not* schema-constrained decoding — and the only consumer (`extractConstraints`) validates with a hand-rolled tolerant parser returning `null` on any deviation (`llm-tasks.ts:86-109`). Industry evidence: schema-constrained decoding eliminates whole classes of structural hallucination (wrong keys, invented functions) that plain "JSON mode" still emits (https://arxiv.org/html/2606.09395v1 §5.1.3; mechanism explained at https://platform.openai.com/docs/guides/structured-outputs and https://decagon.ai/glossary/what-is-structured-output; caveat: token-cap truncation survives both, https://www.reddit.com/r/Python/comments/1tagc2g/).
- Agent side: the required output headings (`packet.ts:225-236`) are prose; the report schema (`report-intake.ts:20-26`) accepts arbitrary artifact bodies and a self-declared status with no `tests_run`, no evidence strings, no file↔contract mapping, and no phase-edge check (M-05). Two disjoint output contracts (markdown headings vs. report JSON) must be reconciled by hand today.

**B6. Agent memory is write-only-by-engine: no cross-run learning.**
Memory rows originate only in engine code (`engine.ts` synthesis rows, `algorithms.ts:532-556`, override/reject rows), never from agent outcomes (M-08: `applyReport` `report-intake.ts:142-147` writes no memory; P5's "Self-Learning" title `phases.ts:47-51` has no loop behind it). The A2 FusionRank engine (`algorithms.ts:214-261`) that ranks memory into every packet (`packet.ts:75-79, 203-206`) is therefore ranking mostly boilerplate. Multi-session agent systems improve precisely by persisting what worked/failed across runs (the checkpoint/memory story RapidTool's own P2 artifact narrates, `engine.ts:354-365`).

**B7. Enforcement is human-only by design; the autopilot path inherits no machine check.**
DoD gates are recorded after completion (`store.ts:83-124`), never consulted to block; `canAutopilot` (`store.ts:126-132`) checks forceHuman/stock/tightness only (M-09). Advisory gates are the right call for humans (AGENT_GUIDE.md:13) but the wrong posture for the autonomous path this product markets — an autopilot approving against a recorded `gate.passed:false` is the product contradicting itself.

---

## C. Ranked enhancement proposals (built on A, closing B; each maps to audit-bugs/05)

### E1 — Executable acceptance oracle + fail-to-pass verification loop (closes B1+B3; the highest-value change)
- **Why:** it converts RapidTool from "spec that the agent may honor" to "spec whose checks the agent must pass" — the single move every consulted source agrees on (Anthropic verification-driven rule; TDD-Bench F→PF; execution-feedback repair; Spec-Kit-style convergence loops, https://github.com/github/spec-kit).
- **How:**
  1. Emit oracle cases as runnable artifacts: extend `OracleTest` (`types.ts:176-182`) with `file`, `asserts` (typed expectations: status, persisted entity, no-side-effect), and emit a generated `tests/oracle.<ext>` scaffold at P5/P6 via a new pure module (mirroring `buildPhase6Module`, `sandbox.ts:119-155`), listed in the spec-graph tests node (`algorithms.ts:365-371`).
  2. Add an execute-verification seam on the honest runner: `runAgentTests(project, {command, files})` server fn over `exec.ts`/`node-runner.server.ts` (timeouts/tree-kill already there), returning a `TestRunResult {passed, failed[], evidence}` type.
  3. Thread the result into `lastTest` (so DoD `p6-test`, `dod.ts:111-114`, and packet line `packet.ts:191` reflect the real run — fixing M-03/M-11), open `forceHuman` HITL on red (mirror `engine.ts:513-524`), and record raw evidence in the log + artifact (Anthropic "show evidence rather than asserting success").
  4. Wire it into headless: `rapidtool-cli.mjs` `verify` subcommand (`scripts/rapidtool-cli.mjs:91-230` pattern).
- **Target files:** `src/lib/types.ts` (oracle/test-result types), new `src/lib/oracle-run.ts` + `src/lib/verify.server.ts`, `src/lib/engine.ts` (P6 converge branch), `src/lib/dod.ts` (p6-test on real run), `src/lib/report-intake.ts` (`tests_run` field), `src/lib/store.ts` (`runAgentTests` action), `src/lib/headless.ts` + `scripts/rapidtool-cli.mjs`.
- **Rough cost:** medium (one new server seam + schema changes; no new infra).

### E2 — Evidence-carrying, phase-checked agent report contract with structured delivery (closes B5-agent-side + M-05)
- **Why:** the current report intake accepts self-declared `complete` with no evidence and no phase-edge check; structured output is the cheapest hallucination-reduction lever on the *input* side (schema-constrained reports are parseable, diffable, and force the agent to commit to claims).
- **How:**
  1. Extend `AgentReport` (`report-intake.ts:20-26`) with required-on-complete `tests_run: [{command, passed, evidence?}]`, optional `oracle_results: [{id, pass}]`, and enforce `report.phase === project.currentPhase` in `validateReport` (`:46-49`); keep the envelope backward-compatible (optional fields, strict when present).
  2. Validate against the phase DoD probes (`dod.ts:40-194`): `applyReport` (`report-intake.ts:103-148`) computes `runGate` deltas and logs `report.gate_unmet` — the report becomes an evidence claim the DoD can refute.
  3. Make `blocked` reports append a real history entry so attempt counting, packet `rejection_loop` (`packet.ts:43-46, 196-201`) and the P6 variant stay truthful (M-05 fix).
  4. Align the two output contracts: have the handoff/packet output schema (`packet.ts:225-236`, `handoff.ts:87-93`) list the JSON report keys the agent should fill.
- **Target files:** `src/lib/report-intake.ts`, `src/lib/store.ts` (`ingestReport`), `src/lib/engine.ts` (blocked-history conversion in `unlockRetry`), `src/lib/packet.ts`/`handoff.ts` (schema pointers).
- **Rough cost:** low-medium, mostly schema + validation logic (pure, unit-testable).

### E3 — Research corpus + grounding lifecycle (closes B4 + M-01/M-06/M-07)
- **Why:** grounding only helps if citations survive to the code-writing phase and are never mislabeled; today they decay (M-06) and template rows are falsely promoted (M-01).
- **How:**
  1. Add `project.research: {query, provider, ts, items: {title,url,content}[]}[]` to `Project` (`types.ts:193-232`), populated by `runPhaseAsync`/`liveLayer` (`engine.ts:1241-1284`, `headless.ts:101-177`) — survives artifact trimming, exported/imported via `io.ts` unchanged.
  2. Packet: emit a compact `## Research sources (live)` block (URL + one-line summary per item) whenever the current edge ≥ P6, independent of the last-8 artifact window (`packet.ts:80-87`) — fixes the citation decay.
  3. Kill the contentless promotion: competitor rows stay `illustrative`; "cited" requires per-row evidence URLs (or drop the field and let the research corpus speak) — fixes M-01 in both `engine.ts:1309` and `headless.ts:174`; add a `Source` column to the scorecard table (`console.tsx:1570-1591`).
  4. Mark LLM narratives unverified/grounded with a footer + `grounded:boolean` (M-07), mirroring the report footer pattern (`report-intake.ts:37`).
  5. Tighten P7 DoD: `p7-research` requires a cited finding when live research is configured (`dod.ts:133-136`).
- **Target files:** `src/lib/types.ts`, `src/lib/engine.ts`, `src/lib/headless.ts`, `src/lib/packet.ts`, `src/lib/dod.ts`, `src/components/console.tsx`.
- **Rough cost:** low-medium; mostly data-model + rendering changes on top of existing research plumbing.

### E4 — Regression-protected advancement + memory write-back + autopilot enforcement (closes B2+B6+B7 + M-08/M-09)
- **Why:** the two biggest *operational* failure modes for long agent runs are regressions (TDAD: 6.08%→1.82% via impact analysis, https://arxiv.org/html/2603.17973v1) and an autopilot that never checks its own exit criteria; memory write-back is what makes repeated runs compound.
- **How:**
  1. Regression scoping from the spec graph: when a phase's artifacts/files would touch spec-graph nodes (`algorithms.ts:326-374`) whose dependents were already delivered, the advance path re-runs those phases' `evidenceHash`-protected checks (recorded verdicts `store.ts:92-100`) and warns on drift — a lightweight TDAD-style pre-change impact gate using the graph the engine already builds.
  2. Autopilot enforcement: in `canAutopilot` (`store.ts:126-132`, `headless.ts:203-208`), require `runGate(project, hitl.phase).pass` before approval; log `autopilot.gate_denied` otherwise (M-09). Humans keep advisory gates unchanged.
  3. Memory write-back: `applyReport` (`report-intake.ts:142-147`) appends semantic/episodic rows for approved complete reports (summary + artifact titles), flowing into FusionRank (`packet.ts:75-79, 203-206`) on the next compile — the first real "self-learning" loop (M-08).
- **Target files:** `src/lib/store.ts`, `src/lib/headless.ts`, `src/lib/engine.ts` (`approveHitl`/`advanceOnce`), `src/lib/report-intake.ts`, `src/lib/dod.ts` (export `runGate` result reuse), `src/lib/algorithms.ts` (graph-adjacency helper).
- **Rough cost:** medium; pure logic, testable under `node --experimental-strip-types --test`.

**Ranking rationale:** E1 first because without an executable oracle nothing else can verify "correct tested code" (B1/B3 are the load-bearing gaps); E2 second because it is the cheapest fix that makes agent claims auditable and closes the loop contract; E3 third because honest grounding is this product's differentiator and is currently decaying/mislabeled; E4 fourth as the operational hardening that turns E1–E3 into a self-improving, regression-safe loop.

---

## D. Bottom line

RapidTool is unusually strong on the **contract side of correctness** — deterministic spec scaffolds, machine-readable packets, DoD evidence hashes, an honest no-fabrication execution layer, and governed reject/retry steering (A1–A9). It is nearly absent on the **verification side of correctness** — no executable oracle, no fail-to-pass loop, no test-evidence report schema, no regression protection, no memory write-back (B1–B7). The product today can reliably produce a *governed scaffold* and audit trail, but it cannot itself determine whether agent-built code is correct, and nothing it emits should be read as "tested" beyond the P6 template self-test (M-03/M-04/M-11). The four enhancements in §C close that in ascending order of cost with no new external services.
