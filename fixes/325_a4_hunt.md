# 325 — A4 BUG-HUNTER lane (drivers / store / checkpoint / diagnose box) — W44 six-professional wave

Lane: A4 (bug-hunter). Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash
`/c/Users/mnril/Desktop/RapidTool Main`). Base: commit `e2fbd9d` (boundary GREEN: typecheck 0,
lint 0, scripts 365/365, lib 2513 pass +1 skip). Scratch: `C:/Users/mnril/a4_scratch/` (probes live
outside the repo — no tree dirt; no key, no network, keyless only).

Box (edit surface): `src/lib/headless.ts` · `store.ts` · `checkpoint.server.ts` · `diagnose.ts` ·
`io.ts` · `phases.ts` · `types.ts` + their test files (`headless.test.ts`, `store.test.ts`,
`checkpoint.server.test.ts`, `diagnose.test.ts`, `io.test.ts`, `phases.test.ts`). Nothing outside
this box is edited — out-of-box finds are registered below as `[OTHER-BOX: …]`.

**Already-fixed register (NOT re-reported — map in fixes/319/320/322/323 + this wave's siblings):**
diagnose disk-truth (`projectWildRun`/`preserveWildRun`), checkpoint staleness ignore-with-notice
(5 axes), honest-park levels + diagnose honest-park verdict (`isParkRow`), reject seam R-A
(`reject(actor)`), T9.3 promotions (`promoteEmittedTreeTested` / `promoteRepairedDirTested`),
io `ImportResult.code` threading, M3 hostile-input throws already triaged.

**Scoped proofs only:** `node --experimental-strip-types --test <file>` (foreground), `node --check`
(Windows-style), scoped `npx eslint`. Never `npm test` / `npm run build` / `gate.sh`.

Baseline (green, all box suites re-run at HEAD before hunting): `checkpoint.server.test.ts` +
`diagnose.test.ts` + `phases.test.ts` = 52 pass / 0 fail; `store.test.ts` + `io.test.ts` = 144 pass /
0 fail; `headless.test.ts` = 110 pass / 0 fail.

---

## A4-1 · [HIGH · persisted-state loss] checkpoint staleness misses the REJECTION axis ⇒ `resume`/`unattended` rewrites a rejected project file from the snapshot and silently drops the human rejection

- **Status:** FIXED (patch + pin landed, proofs below).
- **Evidence (bytes, pre-fix):**
  - `src/lib/headless.ts:932-980` — `checkpointSupersededBy(snapshot, snapshotPhase, file)` with 5
    axes (id · file complete · brief · `filePhase > snapshotPhase` · `fileSealed > snapSealed`).
    A rejection keeps every one of them equal.
  - `src/lib/engine.ts:1796-1845` — `rejectHitl` sets the edge record `status: "rejected"`,
    `rejectionNote: note`, `rejectionHistory:[…]`, project `status: "blocked"`, `hitl: null`, and
    appends a `decision` row + `hitl.rejected` warn log + an episodic memory row
    (`reject-<phase>-<now>`).
  - `scripts/rapidtool-cli.mjs:1265-1266` — the `reject` verb `h.saveProject(path, updated)`; the
    per-phase snapshot (written earlier by the drive at the same edge) knows nothing of it.
  - `scripts/rapidtool-cli.mjs:869-901` (resume) / `:944-998` (unattended) — when
    `checkpointSupersededBy` says not-superseded, the arm drives `resumed.project` and then
    `h.saveProject(t.file, res.project)`.
- **Repro (keyless, real modules, `C:/Users/mnril/a4_scratch/probe2.mts`):** create → `runUntilGate([checkpointDir])`
  parks at P4/awaiting_hitl (snapshot P4) → save file → `reject(file, note)`
  (blocked / P4 rejected / 1 reject decision / 10 memory rows) → save → compare → drive + save
  (the CLI arm's exact sequence). Real output:
  - pre-fix: `staleness verdict: {"superseded":false,"reason":null}` →
    `post-resume drive: {"outcome":"hitl","steps":0,…}` →
    `FILE AFTER RESUME: {"status":"awaiting_hitl","phase":4,"recStatus":"awaiting_hitl","decisions":0,"rejectRows":0,"rejectionNote":null,"hitlOpen":true,"memoryRows":9}`
    — the rejection note, rejection history, the reject decision row and the `reject-4-…` memory row
    are gone from disk, and the gate re-opened.
  - post-fix: `staleness verdict: {"superseded":true,"reason":"the project file records a rejected P4 (status blocked) — the snapshot predates the human rejection; resuming would drop it"}`
    (the file is not driven/rewritten by the ignore path).
- **Impact:** any `resume`/`unattended`/scheduler re-invocation after a `reject` silently rolls the
  file back to the pre-rejection gate — the human's rejection feedback (the steering input the next
  retry consumes) is destroyed, and a scheduled driver could even auto-approve past it. Silent
  persisted-state loss, the exact class this wave hunts.
- **Fix (`src/lib/headless.ts` · `checkpointSupersededBy`, new axis 6, inserted after the phase
  axis):** supersede when the file's record at the snapshot's re-entry phase (matched by id) is
  `rejected`, or the file's project status is `blocked` (the status `rejectHitl` stamps) — with a
  reason naming the phase. Untouched: running / ready / locked / awaiting_hitl files at the same
  edge (the crash-recovery lag shape stays resumable — pinned).
- **Pin (`src/lib/checkpoint.server.test.ts` · FIX-2c describe · "325 A4: a file REJECTED …"):**
  rejected-record shape → superseded + `/rejected P4/` reason; blocked-status-only payload →
  superseded; `running` and retried `ready` shapes → NOT superseded (no false positives).
- **Proofs:** `node --experimental-strip-types --test src/lib/checkpoint.server.test.ts` → `# tests 18
  # pass 18 # fail 0` (was 17); probe2 re-run shows the fix; no other box files touched.

END

=== END 325_a4_hunt — COMPLETE (lane A4; proofs in-log; cross-verified by V6/V7) ===
