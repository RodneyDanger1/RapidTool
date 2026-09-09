# 99 — Coffeehouse2Home (Phase 2) — merged-suite audit dossier

Driven by Flash MERGE-M through the REAL keyed pipeline (2026-09-07). The merged brief
spanned all five products: a Property Ledger shared across CRM · flip · rental ·
showing-booking · field-ops→payroll. Scratch: `%TEMP%\rapidtool-make-merge\` (c2h.json,
c2h-at-p8.json, c2h-final.json 106 KB, envelopes 00–25, vault/, design.html, 3 SVGs).

## Verdict
Product delivery ≈ 1/10 (identical to Phase 1: 0 shipped modules across all six journeys).
Process honesty ≈ 8/10 (refusals/labels real; lessons land — but vacuous verify pass and the
liveUnavailable contradiction remain). Learning-loop before/after: seam + capture wiring are
demonstrably FIXED (P6 fires, L2/L4/L5 land on real keyed runs — first time in the mission);
what the loop still doesn't teach: the product-substance failures are absent from lesson
content (lessons record THAT something failed, never WHAT was missing).

## What WORKED (progress vs Phase 1)
1. **Learning loop fires on a real keyed run — FIRST TIME**: L2 lesson-template-emission-
   a610d748 (seal), L5 lesson-run-summary-3dd6f0dd (completion), L4 lesson-verified-procedure-
   3e176660 (verify) with lesson.capture events.
2. **P6 seam fires**: p6.synthesis.refused logged on a genuine liveP6Synthesis attempt.
3. Product-shape phase bodies held (fixes/118): P0/P1/P2/P4/P12 carry five-domain vocabulary.

## What is STILL BROKEN (new + persistent evidence)
1. **Verify vacuity re-certified UNDER the anti-vacuum guard**: 4/4 "machine-run" pass on the
   deterministic toy (synthesize({job:'track'}).ok===true). Root cause pinned: oracleBriefGrounded
   targets = naive 118-token stoplist from the merged brief (includes has/job/is/per) →
   vacuous identifiers has/job SATISFY it. make-4's rejection did NOT fire here — the guard is
   bypassable.
2. **NEW refusal class**: p6.synthesis.refused | RT_E_LLM_REJECTED · "expandBrief failed: model
   returned an unparseable expansion payload" (previous classes were timeout/signature/brief-fit).
   Standalone prompt failed with the identical class + sloppy RT_E_UNKNOWN; crew failed 2/2 at
   the 20s flash abort — the fixes/121 90s backoff never reached the prompt/crew verbs.
3. **Lesson text hollow**: L2 says "gate unmet (unknown)… nouns… none computed" — the refusal
   class is not recorded; L4 teaches "reuse this module shape next run" about the wrong (toy)
   module. (Same root as A1-03: unmet derived from lastTest, not the recorded gate.)
4. **Red gate + complete coexist**: P6 DoD gate FAIL (brief-fit unmet) yet sealed complete.
   (fixes/125 surfacing landed after this run — the census now exposes it; enforcement of
   "never clean complete" still needs the completion gate.)
5. **Brand-name research pollution**: "Coffeehouse2Home" → 5/15 research items are literal
   coffee-shop hits + LLM narratives hallucinate a coffeehouse retail component — the
   "Coffee…Home" compound poisoned domain classification. Property Ledger never appears as a
   concept. (Compound/brand-name briefs need noun-phrase guarding in the research query builder.)
6. **Meta contradiction persists**: meta.liveUnavailable:true + modelRoute:deterministic
   despite 15 real DDG findings + 3 real LLM narratives.
7. **P8 degeneracy persists**: 10 screens, one per lattice verb, each "over buyer, flipper,
   property, rental" — no showing-calendar/payroll/ledger flow; order relic survives in the
   lattice/ADR vocab (weight 0.9501, outranking lead/crew); junk nouns job/jobs/list/feed/field/
   flag; crew duplicated; P7 matrix boilerplate; P9–P11 engine meta.
8. Scaffold had no CLI surface (scaffoldProject test-only) — CLOSED after this run by the emit
   verb (fixes/126; live-proven: 15 files on disk).

## Lessons the loop SHOULD have taught (before/after evidence for Phase 3)
L2 must record the refusal class + the missing nouns (unmet from the recorded gate, never
lastTest); verify vacuity (oracle stoplist) lesson; red-gate-complete coexistence lesson;
compound-name research pollution lesson; P8 screen degeneracy lesson. None were captured —
the content gap is the Phase-3 target.

## Acceptance gap for the mission
Coffeehouse2Home does not run end-to-end as software (no shipped module, no runnable emit from
a keyed run). The emit verb + pro-tier synthesis + verify-oracle fix + refusal-class recording
are the Phase-3/4 levers.
