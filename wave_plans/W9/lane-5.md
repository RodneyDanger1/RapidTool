# W9 · LANE 5 — T-11 verification + 108-T7 feasibility spike

**Mission.** One verification + one decision document. No production code.

**(A) T-11 verification:** once W9-L1 lands its gating (or if it hasn't by your budget mid-point,
verify the CURRENT state and report honestly): confirm NO lesson is recorded from a red seal and
every lesson carries its probe id — evidence = file:line + a command output (a synthetic red-seal
run + the lesson store read; reuse the engine's test seams, injected deps, no network).
**(B) 108-T7 spike (108:688):** E2E verification of an emitted app against a RUNNING instance +
the isolation-boundary honesty decision. Deliverable = a DECISION DOC: what running an emitted
app requires on this host (npm install in a scratch copy — T4.1's verify-kind territory; the
node-runner is NOT a sandbox — quote doctor's `isolation.note`), what can/cannot be claimed
honestly today, and the recommended shape + gating for a future T4.1/T-18 integration. Cite
dossiers 104 §T4.1/T4.2 + 107 + the current verify.server/compile-check seams.

**Deliverables:** NEW `fixes/216x_t11_verification_and_108t7_spike.md` (or two files if cleaner —
record your choice). Verification-lane rules: report defects, don't fix; probes outside the repo;
no key.
**Owned:** the new log file(s) + scratch under `C:\Users\mnril\`. Nothing in src/ or scripts/.
**Verify:** every claim = a command you ran; where unverifiable, say so explicitly.
