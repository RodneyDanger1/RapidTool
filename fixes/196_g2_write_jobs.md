# 196 G2 — write-set rollback library + remaining job nodes re-export hosted generated

Owned files only:
- `src/lib/write-set.ts` + `src/lib/write-set.test.ts` (CREATE)
- `src/lib/scaffold.ts` + `src/lib/scaffold.test.ts`
- `fixes/196_g2_write_jobs.md` (this log)

TRUTH: RapidTool is NOT a factory. Remaining job-* nodes after the hosted P6 module must re-export that module — never invented flip/record/show/publish bodies. Keyless leftover jobs stay the byte-identical TODO(E-15) stub floor. Write-set is a library (174-F8); emit wiring is parent/headless later. This is NOT a sandbox.

## Status

- LANDED. Owned tests green.

## Task 1 — SSSF-style write-set (174-F8 library)

Created `src/lib/write-set.ts` (pure-ish Node fs, not a sandbox):

- `snapshotPaths(root, relPaths)` → `Map<path, { existed: boolean; bytes: string | null }>`
- `rollback(root, snapshot)` restores prior bytes or unlinks files that did not exist
- `applyWrite(root, rel, body, snapshot?)` records prior bytes (first write wins) then writes

Missing root does not throw. Emit copy wiring stays parent/headless.

## Task 2 — remaining job-* nodes re-export hosted generated

In `scaffoldProject` (non-tree path):

- First `job-*` with non-empty `generatedSource` still takes `emitGeneratedHost`
- Remaining `job-*` nodes `emitTreeBridge` the hosted module — `export * from` the host, no TODO throw, no invented job bodies
- No `generatedSource`: leftover jobs stay `emitJobStub` (keyless floor)
- `generatedTree` / treeMode path coverage still `continue`s (no double-emit)

## Oracle (emitOracleSpec)

- Bridged leftover job labels skip the `assert.rejects(route…, /TODO(E-15) stub/)` path
- Stub leftover jobs (no generatedSource) still MAY assert that throw
- Host/API TODO throw-assert is NOT deleted globally
- Did not fake-implement flip/record/show/publish

## Test run

```
node --experimental-strip-types --test src/lib/scaffold.test.ts src/lib/write-set.test.ts
```

`# tests 36` `# pass 36` `# fail 0` (Node v22.23.2). No full `npm test`.

## Files

- CREATE `src/lib/write-set.ts`
- CREATE `src/lib/write-set.test.ts`
- PATCH `src/lib/scaffold.ts`
- PATCH `src/lib/scaffold.test.ts`
- This log
