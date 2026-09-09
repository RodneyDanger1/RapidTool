# Make 1/5 — Real-Estate CRM — honest audit dossier (Coffeehouse2Home Phase 1)

Driven by Flash B1 through the REAL pipeline with the REAL key (2026-09-06).
Scratch evidence: `%TEMP%\rapidtool-make-b1\` (34 envelopes + project + vault/53 + design/SVGs).

## Verdict ≈ 1/10 — the RenamePro bar is met. Product = governed spec record + generic
engine-boilerplate artifacts, NOT a CRM web app; no runnable app code exists anywhere.

## WHAT WORKS (real)
- Live DeepSeek narratives with real-estate content; governance ledger intact; rejection →
  retry cycle + decision journal.
- 15 real research items with provenance (P0/P7/P11); genuine machine-run P6 verify (6/6
  executed); real deterministic pillars (design tokens, SVGs, vault 53 notes).
- Honest `chat` refusal ("no contact management, pipeline stages… are specified") — airtight
  evidence the project record lacks the brief's product.
- `prompt` output is excellent brief-faithful GOLD (exact stages 'new'…'closed-lost',
  `ShowingNote`, `parseInboundEmail` types) — **orphaned**, never stored/wired.
- Live LLM verbs all real (harvest 2 OSS repos w/ provenance, crew reviewer FAIL verdict).

## WHAT IS BROKEN / FAKE
1. **P1–P4/P6/P10/P12 artifact bodies = RapidTool self-descriptions** ("Dispatcher topology",
   isolation policy, HITL rules, `POST /v1/schedule|follow-up|parse`) — the brief never
   enters deterministic phase synthesis.
2. **P8 contract degenerates to ONE SCREEN PER LATTICE ENTITY** (lead/buyer/seller/manager/
   listing/task — "Screen: lead", "Screen: manager"), each showing the same 7 entities.
3. **P6 module is a phase-gate simulator** (`synthesize(spec)` over `phase 0–12`/`JOBS`).
4. OpenAPI/ADRs describe the pipeline, not the CRM.
5. **Rejection → retry does NOT improve conformance**: regenerated P8 merely appended
   "Rejection response (attempt #1)" with a stray `D` — no product conformance.

## SELF-LEARNING LOOP — partially broken
- Lesson row DID land for the P8 rejection (memory 3→20; episodic row in vault). ✅
- **CROSS-PROJECT KNOWLEDGE STORE READ-BACK IS DEAD**: `knowledge --save` reports
  `appended:true` + file persists the entry, but `knowledge --find` returns **0 matches for
  every query** (even exact entry tokens). `KnowledgeStore.entries()` on the saved file
  returns `[]` without throwing — the read-back filter (`isEntryRow`) rejects saved rows or
  a path/cache mismatch. A write-only store with a dead retrieve path.

## Root causes (traced)
Template-emission phases (deterministic bodies never consult the brief); one-screen-per-
entity P8 (lattice-driven UI degeneracy); orphaned `prompt` spec (excellent expansion never
stored); knowledge-store write-only bug. CLI MSYS path mangling for `--out` (C:\c\Users…).

## Lessons the loop SHOULD capture
(1) brief-nouns absent from artifact bodies → template-emission lesson per phase;
(2) UI-degeneracy (screen count == entity count) → contract lesson; (3) knowledge
save-without-retrievable = store defect lesson; (4) rejection-retry-no-conformance lesson.
