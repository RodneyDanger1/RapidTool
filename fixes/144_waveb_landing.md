# 144 — M2/M3 wave-B landing log (parent transcription of capped lanes)

## B1 — chunked synthesis driver (codegen.server.ts) — LANDED + INTEGRATED
- `P6_SYNTH_CHUNK_SIZE=8`, `TREE_ENTRY_PATH="src/generated.ts"`, `chunkTypeSignatures`
  (20 sigs → 8/8/4; dupes/junk collapsed), `p6SynthesisChunkUserPrompt` (appends the
  EARLIER-FILES block with prior paths/exports/covered reqs), `treePathForChunk`/collision
  suffix, `assembleTreeEntry` (wrapper params thread earlier exports cross-file),
  `toGeneratedTreeFile` (fnv1a + attempt 0).
- ≤8 signatures → SINGLE pro call, byte-identical to legacy; the result is ALSO recorded as
  the one-file generatedTree. Chunk refusal keeps prior chunks + `p6.synthesis.refused`
  with the chunk index (honest partial). Fake-caller tests: 44/44.
- Integration: 1 type fix in its appended test (evalEntry cast). Suite green.

## B2 — tree→scaffold assembly (scaffold.ts) — LANDED + INTEGRATED
- `ScaffoldResult.ok:true` gains optional `warnings?: string[]` (loud tree refusals).
- Path validation: `TREE_ALLOWED_ROOTS` (src/api|domain|jobs|state|ui|generated/, tests/),
  `TREE_RESERVED` (tests/oracle.spec.ts), per-segment charset, `treePathRefusal()` rejects
  `..`, empties, absolute/backslash/Windows-drive paths, reserved files, junk, duplicates.
- Tree state block: parse/validate once → accepted sorted by path, refusals loud, entry =
  first job node file → src/generated.ts → first accepted file (legacy host contract kept);
  README rows for uncovered tree files. No-tree path = byte-identical legacy (suite green).

## B3 — tree-run mode (compile-check.server.ts) — MECHANICS LANDED, WIRING QUEUED (Wave C-1)
- `TreeRunVerdict`/`TreeSpecVerdict {file, compile, tests:{pass,fail}, run, detail?,
  durationMs?}`/`TreeEntryVerdict`/`TreeRunOutcome {ok, dir, compile, tests, run, error?}`
  landed. Probe-validated: spec-under-runner (spawnSync node --test inside runNodeBounded)
  returns TAP counts + first not-ok tail; syntax-broken spec → fail + diagnostics; entry
  dynamic import smoke works; webapp = honest UI-shell skip. REMAINING: CLI `emit --run`
  wiring, the test suite additions, live proof, log (Wave C-1 mandate).

## B4 — p6-arch probe + reqTrace (dod.ts + engine.ts) — LANDED + INTEGRATED
- dod.ts: `ArchTrace` machinery — signaturePrimaryName/proseCapabilityTokens/archCapabilities/
  templateStubTexts + exported `archTrace()`; keyless floor protected twice (vacuous pass on
  no-tree + engine stamp no-op on same-reference).
- engine.ts: `stampP6ReqTrace` (:1237) wired into the phase-6 seal path (:1222) — reqTrace
  artifact (`P6 architecture trace (reqTrace)`, body `p6-arch: PASS` + capability→file rows)
  + `dod.reqtrace` log; idempotent re-stamp.
- gates.test.ts: full p6-arch fixture suite (archTree/archProject/ARCH_* files) — imports
  repaired by the parent (archTrace/ArchTrace/buildPhase6Module/stampP6ReqTrace); 1262/1262.

## Post-wave gate (parent): typecheck 0 · lint 0 · build 0 · suite 1262/1262.
