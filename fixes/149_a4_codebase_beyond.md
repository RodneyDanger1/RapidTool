# 149 — A4 CODEBASE BEYOND: the beyond-factory surfaces (transcribed from the capped analyst)

Verdict standard: TRUE = code-proven behavior on disk; PARTIAL = real core with dead/absent
consumers; FALSE = claim with no mechanism. No key present in the analyst's env — keyed paths
verified by code-construction + tests, not live runs. (Probe file scratch-a4-probe.ts removed by
the parent.)

## Verdict table
| Surface | Verdict | Evidence |
|---|---|---|
| Vault (2nd brain) | TRUE | Real pure core: buildVaultNotes/vaultMarkdown/vaultIndex/searchVault/backlinksFor/dailyNote/traceNote/lessonNote (vault.ts:15-24); non-dangling wikilinks by construction (:36-38); deterministic headers; 3 real consumers: console Vault tab, headless.writeVault (per-note .md + _index.md MOC, headless.ts:980-999, 1380-1399), CLI vault verb → <home>/RapidTool Software/<slug>/vault; vault.test.ts exists |
| KnowledgeStore file ops | TRUE | savePattern append-only + FNV idempotent (knowledge.ts:353-374); atomic tmp→rename (:376-381); merge-on-save (:332-347); corrupt file refused never wiped (:300-312); findPatterns fusionRank lexical, honestly "NOT a vector DB"; consumers: headless knowledgeSave/knowledgeFind (:1935-1946), CLI knowledge --save/--find |
| injectProven / cross-project learning | PARTIAL | Excludes self-project (knowledge.ts:481-492); ZERO engine/codegen/wild/chat consumers — only opt-in CLI `packet --knowledge`; the automatic-reuse claim is decorative; the store itself works |
| Crews | PARTIAL | Real orchestrator: deterministic phase→role table (crew.server.ts:146), one DeepSeek call/turn, JSON envelopes + markdown sections parsed (:554), researcher grounded with UNTRUSTED web findings, cost/max-step guards → honest partial transcripts (crew.ts:93), no-key not-configured before I/O; UI ingests crew artifacts as [agent report] (console.tsx:1395-1448) — advisory only. Gaps: crewToReport (crew.server.ts:1283-1299) ZERO callers |
| Grounded chat | PARTIAL | Honest no-key refusal RT_E_LLM_NOT_CONFIGURED before network (chat.server.ts:276-283); real deterministic grounding: buildChatContext ≤2500 chars, open-HITL honesty ("no verdict yet"), stale-memory flags, provenance v<N> stamps; consumers: chat.ts server-fn, headless chatAsk, CLI chat. Gap: grounded in project state only — never in knowledge-store rows |
| Research layer | TRUE | liveLayer (engine.ts:2619+): real keyless freeWebSearch (Wikipedia+SearXNG, UNTRUSTED labeling, websearch.server.ts:2-18), LLM narrative when configured; E-13 meta.liveUnavailable, E-14 real modelRoute stamp (:2696-2705); every failure degrades to the deterministic floor; expandBrief keyed JSON honest not-configured; P6 liveP6Synthesis pro model 90s bounded retry + machine-verify seam |
| Telemetry | PARTIAL | Capture REAL: rt-events pure schema + redaction-by-construction; installRtClient boots at router.tsx + __root.tsx; CLI stamps every exit to rapidtool.ndjson. GAP: engine wildStep onEvent sink exists (engine.ts:3408-3458) but store.startWildRun never passes onEvent (store.ts:980) → wild-step rt-rows fire in no live host |
| Agent harness / wild | PARTIAL | Deterministic governance REAL: bounded wildStep (engine.ts:3401-3614) with wild.* ledger, coded guard-rail pauses (locked/rejected/blocked/unsealed), 20-step cap + single-flight latch (store.ts:871-1017). TWO REAL GAPS: (a) wild P6 executes applyPhaseResult floor only (engine.ts:3567) — liveP6Synthesis NEVER called on the wild path; (b) the wild classifier's default binds to llm.ts server-fn (wild-mode.server.ts:311) which fails under bare Node → headless/CLI wild stays on the DoD floor even with a key. Rubber-stamp guard genuinely strong (isVacuousFeedback + evidence-token check) |
| Honesty machinery | TRUE | 15-code RT_E taxonomy additive doc-covered (errors.ts:22-39); classifyError walks cause chains; every keyed entry refuses not-configured before network; no-fabrication enforced IN CODE: unparseable wild verdict → honest error, short feedback never padded, vacuous approve refused, chat context staleness flags, sealHonesty |

## Top 5 REAL strengths (code-proven)
1. Grounded-chat context discipline — deterministic project compaction, honest edge semantics,
   answer-only-from-context rule (chat.server.ts:82-220).
2. Keyless-honest research floor — UNTRUSTED labeling + E-13/E-14 stamps; never fabricates.
3. Enforced honesty/error-code layer — typed ok:false,code on every AI surface; mechanical
   no-fabrication (parse-fail ⇒ error; vacuous-approve guard).
4. Atomic, idempotent, honestly-labeled persistence cores — KnowledgeStore + vault (tmp+rename,
   merge-on-save, corrupt refusal, lexical-NOT-vector labels).
5. Governed wild-step engine — bounded autonomous edges, append-only ledger, coded guard-rails,
   human-HITL preservation, honest failure accounting.

## Top 5 DECORATIVE / declare-or-strike
1. Cross-project knowledge auto-reuse (injectProven) — zero engine/codegen/wild/chat consumers;
   only opt-in CLI packet --knowledge. The tier-1 "lessons ranked into memory" story never runs
   in the product's default path.
2. Keyed P6 synthesis inside Wild Mode — wildStep runs applyPhaseResult only (engine.ts:3567);
   liveP6Synthesis is reachable solely via runPhaseAsync/liveLayer. A keyed wild run never
   produces the machine-verified module.
3. Keyed auto-review for headless/CLI wild runs — classifier binds to a createServerFn
   (llm.ts:34-44) that fails under bare Node → keyed CLI wild silently stays on the DoD floor.
4. crewToReport session→report collapse (crew.server.ts:1283-1299) — zero callers.
5. Engine wildStep onEvent telemetry — sink real, but store.startWildRun never passes onEvent;
   wild-step RtEvent rows are emitted by no live host.
