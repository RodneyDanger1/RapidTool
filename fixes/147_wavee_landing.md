# 147 — Wave-E landing log (E2/E3/E4; E1 log on disk)

## E2 — journey verification + tested-stamp (parent transcription — code LANDED, tests/log by parent)
- engine.ts: `LiveLayerDeps = { treeFailure?: string }` + additive optional 3rd param
  `liveLayer(project, phase, deps?)` — absent deps → byte-identical legacy call.
- headless.ts: `p6CycleLiveDeps(ctx)` (ctx.treeFailureTail → {treeFailure} | undefined);
  `defaultP6Synthesize` stamps the durable p6.tree.failure log AND calls
  `liveLayer(p, 6, p6CycleLiveDeps(ctx))` so codegen's `deps?.treeFailure` reads the tail;
  `applyTreeRunTestedMint(project, verdict)` (lazy dynamic codegen import; degrades to the
  unchanged project on failure) — the honest tested-equivalent stamp path after a green
  tree-run (never on UI-shell skips). Integration: typecheck 0 · suite 1353/1353 · lint 0 ·
  build 0 after the E1+E4 fixes. The three regression tests + full gate run are queued in the
  parent's follow-up (the seams are exercised by the passing headless/codegen suites).

## E3 — eval runner + scoring truth (parent transcription — code LANDED + tested)
- maker-score.ts: exported pure `capabilityCoverage(project, caps) → {covered, missing}` +
  `treeFilesOf`; m1Substance's tree branch refactored onto them, byte-identical evidence
  strings (existing tests no-drift). maker-score.test.ts + capabilityCoverage describe:
  covered/missing mapping, stem-form matching (rent-roll phrase → recordRentPayment), path
  hits, empty-tree divergence-1 shape, no-capability, no-drift, treeFilesOf source-skip —
  57/57.
- run-eval.mjs: SINGLE-SYNTHESIS keyed flow — drainPipeline p6Gate mode (approves P4/P5,
  stops with P6 READY); keyed evaluateEntry = floor-drain→P6 gate ⇒ driveP6Journey is THE one
  keyed synthesis ⇒ floor-drain resumes P7→terminal; emit + final treeRun ONCE at the end.
  Post-journey non-complete drain flags onTime:false with stall text (divergence #4 closed).
- OPEN: the keyed run itself (in flight — parent launched the bounded
  coffeehouse2home-property-ledger keyed entry; scorecard quoted on landing).

## E4 — M5 completion code (parent transcription — code LANDED, verbs/docs/logs open)
- knowledge.ts: `topLessonRows(memory, brief, limit)` (fusionRank against the brief;
  blank-brief score-desc/id-asc fallback; [] on junk) + `acceptedLessonEntry({project, actor,
  row})` (actor in content tags `actor:<name>` + body provenance → participates in the
  content fingerprint; re-accept by same actor idempotent). Parent fixed the implicit-any
  (`let ranked: RankedLessonRow[]`).
- packet.ts: `compileAgentPacket(project, opts?: {proven?: PacketProvenSeed[]})` — additive
  2nd param; seeds validated/skipped (never throw), mapped to research-sourced pseudo-memory
  rows (source:"research", tags ["lesson"]) joining the fusionRank pool; empty/absent seeds
  ⇒ byte-identical legacy output. OPEN: the CLI lesson verbs + D2 reframe-lessons test +
  AGENTS.md/console copy sweep + master logs (fixes/144_m2/m4/m5/m6.md) — queued parent
  follow-up with the E2 tests.

## Post-Wave-E gate (parent): typecheck 0 · lint 0 · build 0 · suite 1353/1353.
