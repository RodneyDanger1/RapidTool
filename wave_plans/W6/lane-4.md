# W6 · LANE 4 — eval tail (216q body + `--trials=2` evidence + docs sync)

**Mission.** W5 landed run-side graders + trials/pass@k and the parent recorded a keyless
1-trial run (0 leaks). Close the tail: prove the >1-trial path with real evidence, complete
`216q`, and sync the user-facing docs to the W5 reality.

**Done-when:** a real keyless `npm run eval -- --trials=2` run recorded (flakiness path
exercised honestly; 0 grader leaks; new keys present); `216q` body complete; README.md's
"Progress so far" + `remainingwaves.md`'s W5 section updated to match disk; scripts leg green.

**Owned:** `scripts/run-eval.mjs` (+ its test only if a real defect is found), `fixes/216q_eval_fixtures.md`,
the "Progress so far" bullets in `README.md`, the W5/W6 status lines in `remainingwaves.md`.
NOT yours: src/lib anything (L1/L2/L3), research/eval-corpus layout beyond what evidence needs.

**MINI-TASK PLAN:**
1. Run `npm run eval -- --trials=2` (keyless). Record the REAL output tail: per-case trial rows,
   pass@k block, flaky list, leak scan. Paste into 216q. (If `--trials=2` exposes a crash or
   false metric, fix ONLY that defect in run-eval.mjs + add a focused test; else no code change.)
2. Confirm `research/eval-out/results.json` now carries trials=2 + perTrial arrays; note the
   honest keyless scores as the baseline (they will improve only with a keyed run).
3. `fixes/216q` body: what moved run-side, CLI additions (`--trials`, `--k`), the code contract
   (additive keys), the evidence, not-done (keyed run = user-owned).
4. DOCS SYNC: README "Progress so far" — add the W5 line (policy routing, registry, run-side
   graders; test counts now scripts 235 + src 1811; gate.sh green twice); `remainingwaves.md` —
   mark W5 outcomes on its W5 section + tighten W6 wording to match this dispatch. Keep numbers
   EXACT (re-derive from gate.sh output if unsure).
5. Re-run `node --test "scripts/**/*.test.mjs"` after any change; must stay 235/235 (or grow).
**Verify:** `npm run typecheck` (no src changes expected); scripts leg command above; keyless
eval exit 0. Budget death ⇒ plain statement.
