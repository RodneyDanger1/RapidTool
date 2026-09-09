# Make 4/5 — Rental Portfolio Manager — honest audit dossier (Coffeehouse2Home Phase 1)

Driven by Flash B4 through the FIXED pipeline with the real key (2026-09-07).
Scratch: `%TEMP%\rapidtool-make-b4\` (rental.json + rental-final.json 98.6KB + pre-verify
snapshot, design.html, 3 SVGs, vault/50, packet.md).

## Verdict ≈ 1/10 product delivery vs brief (still zero runnable rental software);
process honesty ≈ 9/10. The make_1-3 seam verdicts are FIXED (P6 fires, bodies
product-shaped, lessons L3/L5 fire) — but the product bar is unchanged.

## What WORKS now (fixed since make_1-3)
1. **Keyed P6 synthesis FIRES on the CLI** (fixes/116): `p6.synthesis.refused` log event at
   P6 proves liveP6Synthesis ran under bare Node with the real key — structurally
   unreachable in make_3.
2. **expandBrief produced PERFECTLY brief-faithful typeSignatures**: createProperty,
   createLease, recordPayment, createMaintenanceRequest, createWorkOrder, getVacantUnits,
   getCashFlowDashboard… — DeepSeek understands the product.
3. **Phase bodies are PRODUCT-shaped** (fixes/118): P1 "Sequential pipeline: rent →
   schedule → track → lease…"; P2 records/operations; P8 "one distinct responsibility each
   — never one screen per entity"; P12 ADRs/OpenAPI mention the product. Engine
   self-descriptions gone.
4. **Lesson capture PARTIALLY fires** (fixes/117): lesson-verify-failure-1b9c2da2 (L3) +
   lesson-run-summary-3dd6f0dd (L5) landed with lesson.* tags + lesson.capture log events.
5. **Anti-vacuity verify works**: verify --apply on the placeholder was REJECTED ("oracle
   cases reference no brief noun or contract function… expected at least one of: rental,
   portfolio, manager, properties, units, tenants, leases, rent"), exit 4 — no more fake
   "5/5 passed".
6. Crew verdict FAIL on P12 → genuinely product-aware repair artifacts (openapi.yaml with
   $ref schemas, schema.sql, ADRs).

## What is STILL BROKEN (the product bar)
1. **THE delivery blocker — missing-signature repair class has NO re-prompt**:
   expandBrief returns perfect signatures; the module refused RT_E_VALIDATION
   "typeSignature functions not exported:…"; codegen.server.ts repair only covers
   unbound-claimed-exports + soft-forbidden — NOT signature-missing. Effective
   liveP6Synthesis success on real journeys: 0/7.
2. **Deterministic 1036-byte placeholder shipped, P6 DoD gate FAIL (2 unmet) recorded,
   project still sealed `complete`** — red gate + complete coexist.
3. **Lattice e-commerce relic contamination**: entities include `order` with
   buyerId/totalCents (a template relic) contaminating OpenAPI schemas + crew schema.sql;
   brief nouns (unit, maintenance request, work order, vacancy, lease renewal, reminder)
   never become entities. P8 screens still = 4 lattice verbs, not the ~9 brief flows.
4. **L2 template-emission did NOT fire** despite P6 sealing with gate.passed:false — the
   fixes/117 engine-seal L2 site is bypassed on the real CLI/autopilot path (ordering or
   path gap).
5. **verifyAndFixServer drops signatureNames** when calling generateCases → oracle
   grounding can't use contract-function names. RT_E_UNKNOWN error code sloppy.
6. **Standalone `prompt` verb timed out 2/2** at the 20s flash-tier abort (RT_E_LLM_TIMEOUT)
   — no backoff (unlike P6's expandBriefWithBackoff).

## Lessons the loop SHOULD capture
L2 on the LIVE synthesis failure path (refusal/timeout at P6 = template-emission lesson);
signature-missing = reliability lesson; lattice-relic = schema-contamination lesson.
