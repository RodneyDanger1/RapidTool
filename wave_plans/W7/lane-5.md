# W7 · LANE 5 — E2E verification lane (keyless run + W6 claims vs bytes + determinism)

**Mission.** Independent verification, not construction. Prove or falsify three things against
live bytes and report EVERY verdict with file:line + command output in a new log.

**Done-when:** `fixes/216u_w7_e2e_verification.md` (NEW) contains: (1) a real KEYLESS
end-to-end run (the repo's own CLI brief→run flow with NO API key available) with the actual
output — honest skips/refusals only, zero fabricated success; (2) W6 scaffold-bridge claims
checked vs bytes (bridge counting + warning + README surfacing + job-node-never-bridged —
grep the 216k markers in `src/lib/scaffold.ts`; state where each is enforced and by which test);
(3) determinism: TWO fresh emits from the SAME injected-model probe → byte-identical trees
(hash-compare each file), reported with the two tree hashes; (4) any OVERSTATED claim found
anywhere in `fixes/216k` → flagged with its correction.

**Owned:** `fixes/216u_w7_e2e_verification.md` ONLY (plus scratch scripts under
`C:\Users\mnril\` — OUTSIDE the repo). If you find a code defect, DO NOT fix it — report it
with a minimal repro; the parent schedules the fix.
NOT yours: everything else (L1-L4 own code this wave).

**MINI-TASK PLAN:**
1. Keyless E2E: unset DEEPSEEK_API_KEY for the run (do NOT touch `.env`; run with
   `DEEPSEEK_API_KEY= node ...` env override per repo norms; if the CLI flow needs a brief,
   use the kanban brief `"A kanban board tool with columns, cards and drag."`). Record the
   exact command + full output. Expected honest shape: synthesis unavailable → coded refusal or
   skip, no tree fabrication. VERIFY the emitted state on disk.
2. Scaffold bytes: `grep -n "216k\|bridge\|job" src/lib/scaffold.ts` — locate the bridge
   allow-list/count/surfacing + the job-node skip; name the tests that pin each (scaffold 36).
3. Determinism: copy `C:\Users\mnril\w6_census_probe.ts` → `_w7l5_probe2.ts`, run BOTH, hash
   every emitted file (sha1 via `certutil -hashfile` or node crypto), compare; ALSO extend one
   run to assert ≥3 oracle job rows pass (the D2 rows) if the probe can reach them keylessly —
   else report exactly why not.
4. Write 216u; every claim = a command you ran. Where you CANNOT verify (e.g. keyed paths),
   say so explicitly — never fill with assumption.
**TRAPS:** do not edit repo code; do not use the real key; probes live outside the repo.
