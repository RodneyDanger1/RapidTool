# W10 · LANE 4 — write `fixes/216x` (T-11 evidence + 108-T7 decision)

**Mission.** W9-L5 produced the ANALYSIS but not the file. Your sources:
- `C:\Users\mnril\w9l5_scratch\probe_a_red_seal.mjs` + `probe_a_out.json` (the live red-seal run:
  P0-P5 sealed green; applyPhaseResult(p,6) → phases[6].status 'complete', runGate(p,6).pass
  FALSE with unmet [p6-verified, p6-brief-fit], hitl null; a lesson IS captured: ledger event
  `lesson.capture`, detail `L2 template-emission lesson-template-emission-25f9d888 (P6 sealed
  with unmet DoD: p6-verified, p6-brief-fit)`; tags exactly `['L2','lesson','template-emission']`
  — no probe id; the same row later renders in the prompt via selectLessons: `[episodic 0.217]
  unmet: …`).
- `C:\Users\mnril\w9l5_scratch\npm_install.log` (install_exit=0, 31s) + the `w9l5_run` tree-run
  (exit 0, 25.5s — envelope NOT read; say so, don't claim beyond it).
- L5's full analysis: `C:\Users\mnril\AppData\Local\hermes\cache\delegation\subagent-summary-4-20260917_094306_082696.txt`
  (offset 5, ~12.7 KB) + transcript `deleg_ea7a2afa/task-4.log`.

**Do:** (1) RE-RUN the probe yourself (`cd C:/Users/mnril/w9l5_scratch && node probe_a_red_seal.mjs`)
— paste the real output; if it doesn't reproduce, STOP and record that. (2) Write
`fixes/216x_t11_verification_and_108t7_spike.md`: §1 T-11 verification record (the FAILS-today
evidence + file:line localisation engine.ts:1416-1418 / knowledge.ts:916-931 + the counterexample
floor note); §2 the 108-T7 decision doc (E2E vs RUNNING instance: host requirements proven by the
spike (Node 22 + npm install in a scratch copy), what can/cannot be claimed honestly today, the
recommended shape + gating for T4.1/T-18 — cite 104 T4.1 :605 / T4.2, 107, compile-check.server.ts
:748, doctor's `isolation.note` (node-runner is NOT a sandbox)); §3 boundaries (not verified:
keyed paths, full suites).
Per LA's ongoing W10-L1 work: T-11 gating is landing THIS wave — §2 must state the verification
is of the PRE-landing state (date + commit `aa12c6c`).

**Owned:** `fixes/216x_…md` only. Nothing in src/ or scripts/. No key, no network.
**Verify:** every claim = a command you ran in this session; re-run the probe.
