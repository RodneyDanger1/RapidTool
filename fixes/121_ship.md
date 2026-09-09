# 121 — Make P6 Ship — fix log + live-proof evidence

## What landed this wave (P-D4 + parent completion)
1. **Signature-missing repair class wired** (`p6SynthesisSignatureRepairPrompt`): a module
   whose exports omit typeSignature contract names gets ONE bounded re-prompt listing the
   exact missing functions (was an instant refusal).
2. **Synthesis retry-with-backoff**: `synthWithBackoff` (2 attempts, 1s backoff, honest
   RT_E_LLM_TIMEOUT only after both) swapped into the main synthesis call.
3. **L2 lesson on the live failure path**: headless run-completion mints the L2
   template-emission lesson when a keyed P6 synthesis refused (the liveLayer refusal
   returned a pre-seal project, bypassing the deterministic-seal L2 site).
4. **Lattice relic removed**: the `order` FIELD_BANK is now a neutral work-order shape
   (title/status/note — no marketplace buyerId/totalCents); field-ops construction vocab
   added (crew/timesheet/payroll/supply/vendor/budget/job-cost/site/subcontractor).
5. **Verify signature grounding**: verifyAndFixServer now plumbs `opts.signatureNames` into
   generateCases so oracle grounding references contract-function names.
6. **Prompt verb + expansion backoff**: the standalone prompt verb routes through
   expandBriefWithBackoff; expandBrief's completeDeepSeek gets a 90s budget (the 20s flash
   default aborted 3000-token expansions 3/3).
7. **Brief-fit repair re-prompt** (`p6SynthesisBriefFitRepairPrompt`): a module missing the
   brief's vocabulary gets ONE bounded re-prompt carrying the missing nouns.

## Live-proof (rental portfolio brief, real key, 2026-09-07)
Stage progression across attempts this session:
- Attempt A: refused at brief-fit pre-check (module ignored brief vocabulary) →
  repair class added.
- Attempt B: refused at expansion (20s timeout ×3) → 90s expansion budget added.
- Attempt C: **expansion OK + synthesis OK + signature OK + brief-fit OK → reached
  machine verification**; refused only at the runner: `case-2: ReferenceError:
  createProperty is not defined` after 3 repair iterations — the model's module passes
  static validation but does not bind every exported name at runtime.

## Remaining class (honest)
The last mile is module RUNTIME correctness: flash-tier one-shot JSON envelopes of a
~20-function module can pass regex/static validation yet fail binding at execution. Next
increments (queued): (a) verify repair prompt must echo the exact runtime ReferenceError
list back at the model on EVERY failed iteration (already partially does); (b) module
decomposition — split large typeSignature sets into 2-3 sequential synthesis calls of
~5-8 functions (MetaGPT-style) so each envelope is small enough for flash to get right;
(c) allow the runner repair to return a PATCHED module (inject missing
module.exports.X = X lines deterministically when the source declares the function but
forgets the export assignment — a mechanical, honest repair).

## Live-proof attempt log (2026-09-07 evening, rental brief, real key)
- Attempt A: refused at brief-fit pre-check → brief-fit repair class added.
- Attempt B: refused at expansion (20s timeout ×3) → 90s expansion budget added.
- Attempt C: expansion+synthesis+signature+brief-fit OK → machine verify reached;
  `ReferenceError: createProperty is not defined` after 3 repair iterations →
  **mechanical export-injection repair added** (injectMissingExports, 3 unit tests).
- Attempt D (post-injection): synthesis+validation+brief-fit+injection OK → refusal
  moved to ORACLE generation: "oracle cases reference no brief noun or contract function
  (vacuous self-referential certification)" — the anti-vacuity gate correctly rejected
  DeepSeek's off-grounding cases. Remaining failure classes rotate through LLM output
  quality at the oracle + runtime stages.

## Structural recommendation (next lever)
Single-shot flash-tier 20-function synthesis is at the edge of feasibility — the failure
class keeps rotating (expansion → brief-fit → runtime binding → oracle grounding). The
two structural levers: (1) **pro-tier synthesis** for the main call (deepseek-v4-pro is a
materially stronger coder; the user's key supports it; one-line model change + honest
modelRoute label); (2) **module decomposition** (5-8 functions per envelope). Both queued.

## Gates after this wave
typecheck 0 · lint 0 · full suite 1214/1214 · build 0.
