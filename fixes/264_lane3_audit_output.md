# fixes/264_lane3_audit_output.md — W25 · LANE A3 (OUTPUT QUALITY + UNIVERSALITY)

**Lane:** A3 — deep audit of what RapidTool EMITS: emit templates (`src/lib/scaffold.ts`),
emitted tests/spec/README/UI, P6 codegen shapes (`src/lib/codegen.server.ts`), corpus fixtures
+ graders (`research/eval-corpus/**`), and the UNIVERSALITY claim (games/websites/programs/
applications/tools ⇄ the `kind` field + phase/lattice templates).
**Status:** IN PROGRESS — skeleton first, findings appended as traced.
**Rules honoured:** read-only commands; NO keyed calls; NO full-gate runs; NO product edits;
every finding cites file:line read today; guesses are labelled COULD-NOT-TRACE.

## Scope map (what I looked at)
- `src/lib/scaffold.ts` — emitted file/README/spec/test templates
- `src/lib/codegen.server.ts` — liveP6Synthesis emitted artifact shapes
- `research/eval-corpus/**` — 7 fixtures + 7 graders (what they demand)
- `research/eval-out/coffeehouse2home-property-ledger/` — the run-#2 emitted tree on disk
- kind/domain handling: `kind` enum, phase templates, lattice/design phases
- Shared log: `research/multiagent/thoroughanalysis.md` §A3 (append-only, end-marker protocol)

## Bottom line (to be finalised at close)
TBD — written last, kept honest.

## Findings (mirror of the §A3 appends; canonical text lives in the shared log)
TBD

## Verification log (commands run, read-only)
TBD
