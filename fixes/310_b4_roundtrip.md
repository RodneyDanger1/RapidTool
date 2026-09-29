# fixes/310_b4_roundtrip.md — B4 lane log (M7-01 round-trip parity · M6-04 lost-update classification · M6-03 descendant reap)

**Lane:** B4. **Owner box:** `engine.ts` hydrate/import/normalizers + `headless.ts` project-level serialize/emit-clone path + `scripts/with-app-env.mjs` (M6-03). B2 owns hydrateWildRun; do not touch.
**Baseline:** HEAD `1af7f88`; suite green at entry. **Bugs only. No keyed calls.**
**Sources:** `fixes/308_map7_boundary.md` (M7-01), `fixes/308_map6_time.md` (M6-03/04).

## Status

- [ ] M7-01 — round-trip byte parity (`importProject(exportProjectJson(p))` == p bytes on FIRST pass)
- [ ] M6-04 — `ingest ∥ run`: run verb classifies saveProject busy-refusal as coded RT_E_BUSY; phase work not silently lost
- [ ] M6-03 — `with-app-env.mjs`: taskkill /T descendant reap on win32 + heartbeat-stops pin

## Recon (verbatim evidence)

**M7-01 baseline reproduced** (probe `~/rt6/probes/p3_roundtrip.mjs`, keyless, re-runnable):

```
CASE R2 :: import(export(p)) === p ? => {"equal":false,"len1":46605,"len2":47223}
CASE R2c :: structured diff count => {"n":24}
  .research key ADDED; .implementationSpec key ADDED;
  .phases[0..12].rejectionHistory key ADDED (×13);
  .phases[4..12].gate key ADDED (×9)
CASE R3 :: fixed point after one hop => {"equal":true}
CASE R4 :: hydrateProject(p) byte-stable vs p => {"equal":false}
```

Root: `emptyProject` (engine.ts:1848) creates phase rows as `{id, status}` and the base carries no `research`/`implementationSpec`; the hydrate normalizers (`repairPhases` engine.ts:1979 `?? []`/`?? null`; engine.ts:2311 `research`; engine.ts:2339 `implementationSpec`) stamp the defaults at IMPORT time → persisted bytes ≠ re-serialized bytes on the first hop.

**M6-04 baseline:** `headless.ts:100-140` `saveProject` throws `RT_E_BUSY` (EEXIST on `<project>.lock`, `wx`); no stale-lock reclamation present at HEAD (B1 not landed here) → run verb path must classify. (CLI-side recon pending.)

**M6-03 baseline:** `with-app-env.mjs:120-124` — `process.on(signal, () => child.kill(signal))`; on win32 with `shell:true` this kills only the cmd.exe shim; grandchildren (vite) survive. Repo's documented pattern: `node-runner.server.ts:164-171` `treeKill` via `taskkill /pid <pid> /T /F`.

(append-only; filled as items land)
