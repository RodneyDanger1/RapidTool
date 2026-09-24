# W14 · LANES 1–3 — execute these tasks (read your lane's section; the playbook is your how-to)

**All three lanes share this file.** Read your own section + `research/multiagent/230_task_execution_playbook.md`
(the per-row how-to, traps, verification, honest-partial shape — **your row's block is your spec**) +
`research/multiagent/220_tasklist_canonical.md` (the row's canonical definition).

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
TREE: uncommitted on top of 7582771 — **C-1 has just landed** (headless.ts both seams + a new
headless.test.ts test): 91/91 + typecheck 0. Do NOT revert or touch C-1's seams beyond what your row says.

⚠️ THE OWNER'S RULES FOR THIS WAVE (verbatim fragments):
- "Do not rebuild before all tasks are done." → the do-not-rebuild list (`220_tasklist_canonical.md` §2,
  23 capabilities) is BINDING. If your row looks like it re-implements something on that list, STOP and
  report it instead — do not rebuild it.
- No fake code, no hallucinations, no bad code, no problem causers.
- **Write early (ENG-WD2's measured rule: 5/5 lanes that reached their write finished; 0/4 that deferred
  it produced anything).** Put your landing log skeleton + bottom line down within the first ~10 calls,
  then write as you go. Your landing log: `fixes/237_lane<N>_<slug>.md`.
- Forbidden: `npm run typecheck`, `npm test`, `npm run build` (boundary/parent-only). Allowed: targeted
  test runs `node --experimental-strip-types --test --test-concurrency=2 <file>`.
- ONE lane per HOT file: you own ONLY the files in your box below. If you need a file outside it, stop
  and report instead of editing.
- Every claim in your log needs the command that produced it. No keyed runs possible (no key on this host).
```

## LANE 1 — C-2: a hard-DoD stop must be a coded terminal stop (kills the 80-round spin → M9)
**Owns:** `scripts/run-eval.mjs`, `scripts/run-eval.test.mjs`, and `src/lib/headless.ts` **only** in the
`"dod"` outcome region (~`:587-606`) — C-1's seams (`:1916-1958`, `:2502-2515`) are OFF LIMITS.
**The task (223 §4 C-2, playbook Part 1):** today a hard-DoD stop returns `outcome:"dod"` with
`stopped:true`, but the driver's terminal set is `{complete, blocked, error}` (`run-eval.mjs:692-696`), so
the drain treats a hard stop as "progress" and re-enters the block for its full 80-round guard, appending
~80 `dod.blocked` rows, then returns `position:"stalled", onTime:false` → **M9 = 0** and an observer sees a
run that looks alive while it can never advance.
**Fix shape:** treat `"dod"` as terminal in the drain; set `position:"dod"`, `stall = <the hard-Dod
message>`, and map it to a coded stop (e.g. `RT_E_GATE_PENDING`, the code the wild path already uses) so
M9's loud-stop branch applies. Consider exporting a pure `isTerminalDrainOutcome(outcome)` for direct unit
testing. **Keep `status:"dod"` semantics honest** — do not convert a hard stop into "complete".
**Done-when:** the drain exits on the FIRST `dod` round (exactly one round), the stop carries a code, and
a test pins the predicate for all seven `RunOutcome` values.
**Verify:** `node --experimental-strip-types --test --test-concurrency=2 scripts/run-eval.test.mjs`
(and `src/lib/headless.test.ts` must stay 91/91).

## LANE 2 — Doc-truth sweep (TA-3 + OV-17 + OV-15): make every count on disk match the code
**Owns:** `README.md`, `AGENTS.md`, `scripts/README-cli.md`, `scripts/rapidtool-cli.mjs` **+**
`scripts/README-cli.test.mjs` (added 2026-09-24 by parent correction — the playbook designates the CLI file
for TA-3/OV-15 and its doc-contract test is the receipt; the docs-only box as first written was imprecise
and caused the P1-α-01/02 flags WD-α had to raise), `taskuniverselog.md`, `remainingwaves.md`,
`fixes/217c_phase5_spec_and_decision_register.md` (register text only), `fixes/217d*.md` if its counts drifted.
**The task (playbook Part 1):**
1. **TA-3** — the CLI dispatches **35** verbs (`grep -c 'case "' scripts/rapidtool-cli.mjs`) but `USAGE`
   has **34** keys: `diagnose` is dispatched and missing from USAGE. Fix the USAGE gap (add `diagnose`)
   and make README.md (:9,:14,:80,:101) + AGENTS.md say **35** — every count re-derived by a command in
   the same pass.
2. **OV-17** — the README Quickstart is broken: `new` is not a verb (`Unknown subcommand`, exit 1) and
   `--until-hitl` exists only at README.md:37. Rewrite the Quickstart against the real `USAGE`.
3. **OV-15** — the unreachable `redTree:"banner"` advice: find it (playbook gives its seam), and either
   make it reachable or strike it with the falsification recorded (declare-or-strike).
4. **The register's stale slot** (`fixes/217c`): the isolation drop-in still reads
   `[W11-L2 PROBE RESULT — UNKNOWN at write time …]` while the result is settled (no docker/bwrap on this
   host; WSL has no distros). Fill it with the settled result + its evidence line.
**Done-when:** every changed count/number is produced by a command IN THE SAME COMMIT'S EVIDENCE (paste it
in your log); the README-cli doc-contract test (if it pins counts) is extended/passes.
**Verify:** the greps + `node --experimental-strip-types --test --test-concurrency=2 scripts/rapidtool-cli.test.mjs`
(if it exists — check; else name what you ran instead).

## LANE 3 — OV-2: the first real browser pass on the console (fix the guard first)
**Owns:** `scripts/browser-guard.mjs`, `scripts/browser-smoke.mjs` (only if its own arg handling is wrong),
and — ONLY for defects the smoke actually reveals — `src/components/console.tsx` / `src/styles.css`
(registration instead, if the fix is risky).
**The task (WD-C's verified findings + playbook):**
1. **Fix the guard:** `checkedOutputPath` (`scripts/browser-guard.mjs:34-42`) compares a resolved
   `C:\…` path against the literal `/workspace\` prefix → **unsatisfiable on Windows** (reproduced:
   `"screenshot path must be under /workspace, got C:\workspace\…"`). Resolve each allowed dir before
   comparing (or accept the Windows scratch dir honestly).
2. **Then run:** `node scripts/browser-smoke.mjs http://localhost:8080/ C:/workspace/screenshots/w14.png`
   against a dev server (`npm run dev` — start it in the background, kill it when done; args are
   POSITIONAL, not `--url`/`--out-png`). Chromium IS installed (`%LOCALAPPDATA%\ms-playwright\`).
3. **Then report what the pixels show** — this retires `218` §4's "nobody has looked at these pixels".
   Every finding: fixed (with its own verify) or registered (declare-or-strike). Never claim a visual
   pass you did not run.
**Done-when:** the smoke command returns ok against the running app, AND its screenshot/verdict is
attached or its content described in your log (with the path it was written to).
**Verify:** the smoke command itself + `npx eslint scripts/browser-guard.mjs` if you changed it.
