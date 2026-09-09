# 133 — Functional-gap audit (F1): what is NOT working/finished/wired RIGHT NOW

Transcribed by the parent from F1's capped summary (probe evidence in
`C:\Users\mnril\AppData\Local\Temp\rt-f1\`: probe-journey.ts, probe2-lessons.ts, emit-out/).

## 1. Prior-dossier diff — CLOSED since fixes/124/122 (verified on disk)
A3-01 installRtClient installed (router.tsx:3,8; __root.tsx:5,22) · A3-03 lesson read-back
keyed-P6 wired (codegen.server.ts:59-60,743-753) · A3-07 wild shim collapsed, no lying
labels · A1-01 research item-level junk filter · A1-02 scorecard shape guard · A1-03 L2
real-unmet + seal-dedupe · A1-04/05 stripComments + async/gen/class binders.

## 2. STILL OPEN on the current tree
- **A3-02 setEnforceDod — DEAD STORE ACTION** (store.ts:112/817 only; engine enforcement
  engine.ts:2874,2932 unreachable; zero console/CLI setters; docs claim the setting exists).
- **A3-04 — all 10 orphan lesson writers still orphaned** (correctionLesson, driftLesson,
  pressureAt, lessonLog, manualLesson, dismissLessonRows, proposeLessonFallback,
  buildSupersedeEntry, consolidatedRunNote, LESSON_RETIRE_COUNTER).
- **A3-05 verify.ts shim 0 importers**; verify headless-only; UI shows results, no trigger.
- **A3-06 watcher.ts dead.**
- **129_z1 compile-check module + CLI check verb NOT landed.**
- **129_z2 P8 flow-cluster rewrite NOT landed.**

## 3. Real deterministic journey truth (keyless drain)
Honesty machinery WORKS: sealedWithFailures:true + failedGates:[P6(2),P7] in summary,
per-phase gates recorded, run.complete.with.failed.gates warn, 3 lesson rows with REAL unmet
text. But the run still seals "complete" and what ships is not real software:
1. **Emitted webapp scaffold CANNOT BOOT** — 14 files, NO index.html + NO vite.config.ts for
   kind=webapp → the emitted package.json's dev/build scripts cannot run. UNFINISHED.
2. **Oracle spec = 4 tests, all todo:true, 0 assertions** (npm test → 4 todo/0 pass) — E-15
   stub language baked in. UNFINISHED.
3. **Domain module emits template junk**: src/domain/real_estate.ts for a MAINTENANCE TRACKER
   brief contains Landlord/Dashboard/Showing interfaces, all the identical {id,status,
   updatedAt} shape — lattice-template leak.
4. **P6 generatedSource = 1019-byte generic template** (JOBS=[track,assign,show], synthesize
   returns {ok:true}); api/store/ui files are TODO stubs; src/ui/console.tsx is a static
   "shell — implement…" notice.
5. **P8 contradicts its own honesty line** ("never one screen per entity") then emits Screen:
   track/assign/show over all-entity template junk.
6. Packet is v3 on disk; README/AGENT_GUIDE advertise "Agent Packet v2" — doc drift.

## 4. UI
10 tabs rendered; sole dead store action = setEnforceDod. **Green "Delivery sealed" + green
progress rail shown even when gates failed** (console.tsx:1744-1748 treats all complete as
ok) — console never consumes sealedWithFailures/failedGates; per-phase FAIL only deep in gate
records. Misleading dominant affordance.

## 5. Learning loop
Capture live + honest (L2/L5 real failure text, deduped). Read-back is keyed-P6-ONLY —
engine liveLayer, crew, and UI expansion paths consume no lessons; retirement never runs →
memory grows to slice(-80). Write-mostly for every non-keyed path.

## 6. Ranked TOP-10 (fresh prompt → REAL software)
1. Emitted webapp cannot boot (no index.html/vite.config; dev/build dead). UNFINISHED.
2. Compiler/check pass never landed (no module, no CLI check, no emit --check). UNWIRED.
3. Emitted oracle tests are 100% TODO stubs — feedback loop unmeasurable. UNFINISHED.
4. P8/domain derivation defects (one-screen-per-verb; landlord/showing in a maintenance
   tracker). BROKEN.
5. setEnforceDod dead action (A3-02). UNWIRED.
6. Learning loop write-mostly (read-back keyed-P6-only; orphans + retirement dead). UNFINISHED.
7. Fresh machine-verify unwired in UI (verify.ts shim orphaned). UNWIRED.
8. Green "Delivery sealed" for failed-gate runs (console ignores the census). MISLEADING.
9. Deterministic P6 module is a verbatim template — brief-conformance correctly fails every
   keyless run, so no-key (the 95% case) never genuinely produces software. HONEST-BUT-HOLLOW.
10. Packet/doc drift + orphan surface (watcher.ts, A3-08/09/10, staged auth/P2P claims). UNFINISHED.
