# Make 2/5 — House-Flipping Manager — honest audit dossier (Coffeehouse2Home Phase 1)

Driven by Flash B2 through the REAL pipeline with the REAL key (2026-09-06).
Scratch: `%TEMP%\rapidtool-make-b2\` (flip.json, gate/transcript/verify logs, probe-live.mjs,
design.html, 3 SVGs, vault/49).

## Verdict ≈ 2/10 — honesty 10/10, delivery ~0. 13/13 phases complete, ~zero product.

## WHAT WORKS (real)
Deterministic 13-phase machinery; human gate ledger; packet/export/scaffold pillars; bounded
runner (tests.pass real); **harvest genuinely live** (query source=llm; Babylon77/
real-estate-calculator, abigailGadams/flip-tracker); **prompt expansion excellent** — DeepSeek
understands house flipping (acquisition fields, line-item budgets, contractor bids correct);
crew live with a REAL "Review verdict — FAIL" on P12 (OpenAPI mismatch); honest refusals
(meta.liveUnavailable, RT_E codes, p6.synthesis.refused logs, modelRoute:deterministic never
spoofed).

## WHAT IS BROKEN / FAILED (file:line evidence)
1. **KEYED P6 NEVER FIRES ON THE CLI ROUTE — the biggest lie in the chain.**
   engine.ts:1828-29 gates liveP6Synthesis behind `(await llmStatus()).configured`;
   llm.ts routes llmStatus through a TanStack createServerFn that THROWS under bare Node
   (headless.ts:96-104 documents this). CLI --live → P6 upgrade ALWAYS skipped. Evidence:
   flip.json → modelRoute:deterministic, generatedSource = 1018-byte placeholder, P6 DoD
   gate FAIL (gate-p6-11249666) — yet run reports complete 13/13, gate-FAIL buried.
2. **P0 domain misclassification**: house flipping → `domain: analytics, jobs:[invoice,
   track]`. Cascades: research queries about the WRONG "Flip" (Flipsnack/FlipMantis/G2),
   9/15 research hits off-product, placeholder module jobs.
3. **`verify --apply` = vacuous certification**: LLM wrote SELF-REFERENTIAL oracle cases
   against the placeholder (synthesize({job:'invoice'}).ok) → "5/5 passed" → stamped
   lastTest {label:"tested"} — says nothing about the brief.
4. **liveP6Synthesis 0/6 in direct probe** (all honest p6.synthesis.refused): 2× expandBrief
   20s timeouts, 2× claimed-exports-not-bound, 1× compile-fail after 3 verify iterations,
   1× forbidden-primitive. Honest floor works; the feature effectively non-delivering.
5. **SELF-LEARNING LOOP NOT WIRED (mission-critical)**: full run + verify → 0 lesson rows,
   0 lesson.capture events. Factories exist (knowledge.ts L2 templateEmissionLesson :609,
   L3 verifyFailureLesson :651, L4 verifiedProcedureLesson :695 + selectLessons) but the
   ONLY runtime caller is report-intake.ts:362 (injected L2 on ingest). Engine seal of a
   failed gate, verify pass/fail, run completion NEVER mint lessons.
6. Crew FAIL advisory only; nothing persisted. gate-FAIL + FAILed review invisible in
   "complete".

## Root causes traced to stages
(a) live multiplexer: bare-Node/TanStack server-fn cage kills keyed paths on CLI;
(b) P0 lattice: L1 vague-brief factory exists but no trigger wires it;
(c) verify: oracle cases constructed from whatever source exists (model follows placeholder);
(d) learning: factories orphaned (engine/verify/headless have no call sites);
(e) gate surfacing: summary/lastGate report only the P9 approve.

## Lessons the loop SHOULD capture (and did NOT)
L1 vague-brief/domain-drop (brief nouns absent from lattice); L2 template-emission (P6 gate
unmet with brief nouns missing); L3 verify-vacuity (oracle references only placeholder ids);
P6-synthesis reliability modes (timeout/export-binding); engine-live vs CLI dead-zone (keyed
gates must not depend on server-fn status under bare Node).

## Fix recommendations
headless real keyed path (reuse isDeepSeekConfigured + direct DeepSeek calls — codegen
.server.ts is already bare-Node-safe); wire lesson writers at engine seal (L2 on unmet) +
verify outcome (L3/L4); P0 brief-noun lattice check with L1 capture; surface gate-FAIL in
summary/completion; verify oracle cases brief-grounded + require a compile run.
