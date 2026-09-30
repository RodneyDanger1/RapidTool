# fixes/316_h3_v2findings.md — H3: the V2-findings curer (real p6Edge in the headless wild loop + seal repair alive + `--agent-seal` pointer refusals + pins)

**Lane:** H3. **HEAD at start:** 564db1f ("V-round cured: seal provenance stored … wild-seal.test.ts 10/10, forge-refused pin"). **Baseline:** all gates green (parent: "HEAD=564db1f; all gates green").
**Scope (per parent brief + 315_v2_deepcheck findings #1/#2/#4):**
1. **Production-dead repair (finding #1):** `wildDodRepairOnce` (engine.ts:3959) consumes ONLY `opts.p6Edge`; both headless wild loops (`wildStartRun`/`wildStartHeadless`) pass none ⇒ on a real sealed run the ONE repair pass can never fire. Wire: headless threads the equivalent P6 edge (`runP6Edge` — W-02's route, headless.ts:548/:2611) into `wildStep`'s opts as `p6Edge`, keyed-only (keyless keeps its exact bytes); engine consumes `dodRepair` first (finding #2 — declared, zero consumers) then the ONE `wildExecEdgeFor` picker shared with the execute site (so the two can never drift again).
2. **Silent flag (finding #4):** `approve --agent-seal` / `gate --agent-seal` silently absorbed by parseArgs → coded POINTER refusals (RT_E_VALIDATION + remedy naming the correct door `wild --start|--resume --agent-seal`) + USAGE mentions.
3. **Pins:** the headless opts-thread (keyless, injected edge spy) + the engine repair consumption + the CLI refusals.
4. **Rule:** NO keyed calls. Professional quality only; byte-parity guards for the keyless path.
**Files (one writer per file):** `src/lib/engine.ts`, `src/lib/headless.ts`, `scripts/rapidtool-cli.mjs`, `src/lib/headless.test.ts`, `src/lib/wild-seal.test.ts`, `scripts/cli-exit-taxonomy.test.mjs`, `scripts/README-cli.md`, this log.
**Overlap note:** H1 (316_h1_p7.md) also targets the engine wild P7 region; this lane stays off P7 (`liveEdge` untouched) except note-leaving it to H1.

## Status board
- [ ] Log opened (this file) — FIRST, before any edit
- [ ] Engine: `wildExecEdgeFor` picker + `wildDodRepairOnce` consumes `dodRepair` → picker
- [ ] Headless: both wild loops thread `p6Edge` (keyed `runP6Edge`; `opts.p6Edge` seam passthrough)
- [ ] CLI: `approve`/`gate` `--agent-seal` pointer refusals + USAGE lines (+ README-cli)
- [ ] Pins: headless opts-thread · engine repair consumption · CLI refusals
- [ ] Legs foreground: headless.test.ts · wild-seal.test.ts · wild-step.test.ts · cli-exit-taxonomy.test.mjs · typecheck · lint

## Evidence log (append-only, timestamped)

- [t0 18:52] Log opened. Recon: HEAD=564db1f clean (two untracked sibling logs: 316_h1_p7.md, 316_h4_uitails.md). Read 315_v2_deepcheck (findings #1–#4), 313_d1_seal seam table, engine.ts:3740–4000/4200–4444/4552–4810, headless.ts:500–571/2195–2223/2595–2614/4163–4412, rapidtool-cli.mjs:74–114/668–757/858–960/3431–3545/3953–3996. Key lines: engine.ts:3963 (`opts?.p6Edge` only) · engine.ts:4753–4755 (execute-site resolution) · headless.ts:4197–4201/4390–4394 (wildStep opts — no p6Edge) · CLI:3495 (only `agent-seal` reader).
- [I2 t0 ~19:19] **I2 finisher (deleg_25393c6a/task-1) takes over H3's owed pins** (final rescued in `316_wd3_guard.md` §RESCUES): (a) `approve`/`gate` `--agent-seal` pointer-refusal pins (behavioral spawn, code already landed at HEAD bytes — verified this session), (b) the `dodRepair` seam consumption pins (`wildDodRepairOnce`: repaired ⇒ the DoD-red path proceeds; null ⇒ honest park), (c) the shared `wildExecEdgeFor` picker's 3 states. Landing map + pin results appended here when legs are green. One writer per file: `scripts/cli-exit-taxonomy.test.mjs` + `src/lib/wild-step.test.ts` (I2); engine/headless/CLI bytes untouched.
- [I2 t1 ~19:22] **LANDED-BYTES MAP at HEAD 71154b1 (every H3 row verified present this session):**
  - `src/lib/engine.ts`: `wildExecEdgeFor` shared picker :3973-3989 (P7 arm :3977-3985 — injected `liveEdge` wins any key state, else keyed `wildLiveEdge`, else null; P6 arm :3986-3988 unchanged); `dodRepair` seam CONSUMED by `wildDodRepairOnce` :4001-4033 (seam read :4006, picker delegation :4009, no-edge :4010-4012, declined :4020-4022, re-run verdict :4023-4026, catch :4027-4032); call sites :4406 (`wildApproveGate` post-approval) and :4484 (`wildLeavePhase`).
  - `src/lib/headless.ts`: `p6EdgeForWildStep` :4206-4211 (injected seam wins any key state; keyed ⇒ `runP6Edge`; keyless ⇒ nothing threaded) consumed by BOTH wild loops — :4244 (`wildStartHeadless`, pass :4261) + :4431 (`wildStartRun`).
  - `scripts/rapidtool-cli.mjs`: `refuseAgentSeal` :116-131 (ONE coded refusal re-used by every arm); call sites :693 (`run`/`gate` shared case), :793 (`resume`), :839 (`unattended`), :893 (`approve`); USAGE :3996 (approve) + :4027 (wild) + header :44; `wild`'s own accept :3526-3530.
  - `scripts/README-cli.md` :161-166 (the refusal sentence + the ONE door).
- [I2 t2 ~19:24] **PINS LANDED (probe-locked first, then pinned):**
  - **(a) CLI refusals** — `scripts/cli-exit-taxonomy.test.mjs` Leg 10 (BEHAVIORAL spawns, both verbs): exit 1 · code RT_E_VALIDATION · error `approve|gate: --agent-seal does not apply here` · remedy contains `wild --start --agent-seal` · no Node stack · the refusal fires with NO `--project` passed (pre-load, flag alone) · envelope `exit_code` == process exit; + README refusal-sentence doc guard. Leg green (10/10 file).
  - **(b) repair consumption** — `src/lib/wild-step.test.ts` suite `316 H3 — the seal's repair pass consumes the dodRepair seam` (4 pins on the real leave path, seeded enforceDod P7): repaired ⇒ advanced to P8, seam saw the RED candidate (`runGate(q,7).pass === false`), exactly ONE pass, repaired corpus rides; null ⇒ park, detail `(repair seam declined P7 — honest park)`, park{RT_E_GATE_PENDING, human-gate}; no seal ⇒ seam NEVER called + exact pre-seal pause bytes (no suffix); seal+keyless+no seam ⇒ `(no non-floor repair edge for P7 — honest park)`.
  - **(c) picker's 3 states** — same file, suite `316 H1/H3 — the shared execution-edge picker states (wildExecEdgeFor)`: injected wins keyless AND keyed (selection only); keyless ⇒ null (P7+P6); keyed ⇒ production edge functions, P7 ≠ P6 (selection only); phases outside 6/7 ⇒ null.
- [I2 t3 ~19:26] **LEGS GREEN (foreground):** wild-step 28/28 · cli-taxonomy 10/10 · wild-seal 10/10 · typecheck 0 · lint 0 errors. Recorded, untouched: 1 pre-existing lint warning `wild-seal.test.ts:67 'rejecting' unused` (H-wave file, not this lane's edits). **H3's owed pin row CLOSED.**
