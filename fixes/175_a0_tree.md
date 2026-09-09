# 175 — A0 real importable multi-file tree (landed)

Parent (grok-4.6) enacted 162/170-B **A0**: multi-chunk trees are real ESM modules with cross-file imports, emitted at their own paths, with `src/generated.ts` as an `export *` barrel that oracle / job-bridges / treeRun already import.

## What changed

`src/lib/codegen.server.ts`
- `materializeImportableTree` — N>1 chunks: relocate chunk 0 to `src/generated/chunk-0.ts`, convert CJS `module.exports.NAME = NAME` → `export { NAME }`, prepend `import { prior… } from "./….ts"` on later files, write ESM barrel at `TREE_ENTRY_PATH`.
- `relTsImport` / `stripCjsExportAssignments` — pure helpers.
- Single-chunk trees are **identity** (legacy disk bytes + IIFE `generatedSource` unchanged).
- `treeUpgraded` / `partialTreeRefuse` consume the materialized file list. Chunk count in logs is the synthesis chunk count (not barrel+files).

`assembleTreeEntry` IIFE concat remains for brief-fit vocabulary scan and single-chunk `generatedSource`.

## Tests

`src/lib/codegen.server.test.ts` — **62/62 pass, fail 0**
- new A0 unit tests (relTsImport, strip, single-file identity, N>1 barrel+imports)
- multi-chunk success/partial/kind/budget counts updated to barrel+chunks

## Not yet (later Phase A)

A1 persist fixtures · A2 emit behavioral spec · A3 assert behavior · A7 emit-dir bind · A4 rekey · A5.0 typed-draft · A5 approve · A6 journey.
