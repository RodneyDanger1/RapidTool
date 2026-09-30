# fixes/316_i4_stragglers.md — I4: THE STRAGGLER FINISHER

**Lane:** I4. **HEAD at start:** `71154b1` ("H-wave: P7 seam honored (probe) + wildExecEdgeFor shared picker + repair edge WIRED, wild.paused_policy live, spend envelope, UI first-run, cron root-caused"). **Tree at start:** clean (to re-verify).
**Read first (done):** `fixes/316_h2_policy.md` (final — T3.4 owes the disposition table; census 57/19/38), `fixes/313_d1_seal.md` (S-checklist remaining rows), `fixes/312_c3_lifecycle.md` (E2 owed tail: M6-04 + budget verification), `fixes/316_wd3_guard.md` (rescue ledger).
**Rules:** NO keyed calls. Professional quality only. Log written FIRST. Short one-liners / cd before grep (space in path). Legs FOREGROUND. One writer per file.

## Scope (the five straggler rows)

| # | Row | Status |
|---|---|---|
| R1 | T3.4 — write-path disposition table (`src/` + `scripts/`) appended to `fixes/316_h2_policy.md` §4 | TODO |
| R2 | E2's owed M6-04 half — coded busy (RT_E_BUSY) at the run verb + work-preserved path + pin (`scripts/cli-run-busy.test.mjs`) | TODO |
| R3 | E2 budget verification — run the token-ledger + packet legs E2 never ran; append its log | TODO |
| R4 | Census pin — verify rt-events.test.ts sorted-list pin (57/19/38) + the wild-step leg | TODO |
| R5 | Owed-with-no-owner rows in 312/313/316 logs → land tiny or record precisely | TODO |

## Evidence ledger (appended as rows land)

- [t0] Log opened (skeleton first). HEAD `71154b1` confirmed; recon begins.
- [t1] **R2 pre-fix baseline (probe-i4-busy.mjs @71154b1, foreground, keyless):** `[A]` live-lock `run` → **exit=4**, `{ok:false, code:"RT_E_BUSY", exit_code:4, preserved:null}`, raw Node stack on stderr (global-net path), project on disk unchanged (`currentPhase:0,status:intake`) — the M6-04 lost update, verbatim; a checkpoint file DID survive at `<dir>/.rapidtool/checkpoint.json` (the run committed per-phase) but nothing pointed at it. `[B]` control no-lock → exit 0, phase advances. `[C]` dead-pid orphan lock → exit 0 (reclaim discipline reached through the bare save). Seam intact: CLI run/gate arm `scripts/rapidtool-cli.mjs:715` still calls bare `h.saveProject(path, res.project)`.
- [t2] **R2 LANDED.** `scripts/rapidtool-cli.mjs` run/gate arm: bare save → `await h.saveProjectBusyAware(path, res.project)` + coded refusal block (code `RT_E_BUSY`, **exit 1**, `preserved {checkpoint, present, resume}`, `steps/stopped/outcome`) using the existing `checkpointDriver()` + `checkpointPath()`. Post-fix probe: `[A] exit=1`, `preserved.checkpoint` = `<dir>/.rapidtool/checkpoint.json` `present:true`, `resume:"resume --project …"`, **stderr empty (no stack)**; `[B]`/`[C]` unchanged. Also landed H7's carried row: crew now reads `args["max-steps"]` (was `args.maxSteps` — silent no-op). NEW pin `scripts/cli-run-busy.test.mjs` (4 tests) — **4/4 PASS** foreground (source leg + unit battery [free/live-refuse/transient/dead-pid-reap] + behavioral live-second-writer spawn [exit 1 + RT_E_BUSY + preserved checkpoint + no stack] + crew key leg).
- [t3] **R4 VERIFIED (census pin + wild-step leg).** Independent re-count `python ~/a5_census.py "<repo>"` → `catalogue=57 emitted=19 dead=38` — byte-matches the rt-events.ts:238-242 H2 comment (57/19/38, `wild.paused_policy` emitted @ `engine.ts:4319` on the live tree). Pin mechanism read: `rt-events.test.ts:40` `assert.deepEqual(Object.keys(RT_EVENT_NAMES).sort(), […].sort())` with `wild.paused_policy` at :94 ("adding/removing names without updating this test fails"). Legs foreground: `rt-events.test.ts` + `wild-step.test.ts` → **35/35 pass, 0 fail** (incl. the behavioral refusal-path pin: park `wild.paused_policy` + event sequence + onEvent row).
