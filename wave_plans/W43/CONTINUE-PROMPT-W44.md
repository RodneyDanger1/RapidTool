# RAPIDTOOL — CONTINUATION & KEYED-TRIAL PROMPT (W44)

> Hand this whole file to a fresh session. It is self-contained. Read it fully, then execute.

## 0 · THE MISSION

Finish RapidTool to ready-to-run, then run THE KEYED TRIAL: real builds driven end-to-end with the owner's DeepSeek API key, watched by a three-way triage team. RapidTool is powered by the **DeepSeek key** — NOT by Hermes; the operator agent only *drives* RapidTool.

## 1 · THE STATE — VERIFY FIRST (do not trust; re-read)

- Repo: `C:\Users\mnril\Desktop\RapidTool Main` — **SPACE in path ⇒ ripgrep/`search_files` FAIL**; always `cd "/c/Users/mnril/Desktop/RapidTool Main"` + `grep`.
- Last known HEAD: **`ba5a392`** (37 commits). First commands: `git log --oneline -3` + `git status --short` (expect: clean or only W43-flip edits). **The repo may have moved — trust the live bytes.**
- Last known gates: `typecheck` 0 · `lint` 0 errors (10 cosmetic warnings) · `npm test` **2816/2815/0** · `bash scripts/gate.sh` → `ok:true` (all 6 gates). Re-run before believing.
- **The master list:** `wave_plans/W43/COMPLETION-TASKS.md` — the 43-task canon; statuses may lag the bytes; the MERGE RULE (keyed run's 5 conditions) is its top block.
- **THE KEYED-RUN CHECKLIST:** `fixes/317_j2_preflight.md` — the 5 conditions with commands + verbatim outputs. Conditions 1–3 = MET as of the state above; 4 (wallet) + 5 (owner's word) = OWNER.
- **The code remainder (the only owed rows):**
  - `fixes/317_j1_oracle.md` — J1: the **wrong-output behavioral pin** (the negative case must FAIL the verdict), run-eval's **9 dead imports** (see `fixes/317_k1_bugcheck.md` R2/R3 for the exact names), **T5.4** (run-eval rt-events import + emissions + pin).
  - `fixes/317_l1_silent.md` + `fixes/317_l1w_watch.md` — L1's indicted uncoded catches (`store.ts:1003/1039/1092/1604` class) — check which L1W landed; finish the rest.
  - `fixes/316_h7_survive.md` — the RECORDED nitpicks (crew `--max-steps`, MAX_FILES) + L2W's 3 documented nitpicks (`fixes/317_l2w_watch.md`).
- **The oracle:** `src/lib/entry-oracle.ts` (the shared behavioral check; `compile-check.server.ts` consumes it via `treeBehaviorOf`; run-eval imported it — the dedup's tail is the dead imports above).
- Sealed-run surfaces: `--agent-seal` on the CLI's wild verb → classifier-as-approver for STOCK_HITL [4,5,8,9]; seat rows `[seat agent-seal]`, `decidedVia.label = "autopilot/agent-seal"` — **never 'human'**; 13 steps to `wild.complete`; cap 20 (margin 7).
- Wallet history: 402 `balance-exhausted` (top-up: platform.deepseek.com/top_up). Key lives in the repo's server-side `.env` (`DEEPSEEK_API_KEY`); browser reads `.env`, CLI needs the shell export.

## 2 · THE HARD RULES (violating these has cost this project real time)

1. **Legs FOREGROUND, never backgrounded** — backgrounded `node --test` dies to `stdin is not a tty` with exit 1 **before running any test** (a fake failure — struck 6+ times). If you find one, append `[PARENT CORRECTION]` INTO its log.
2. **Never pipe a gate** — `… | tail` makes `$?` the pipe's, not the tool's (a lane fell for this). Unpiped or redirected-with-checks only.
3. **One writer per file** — state box ownership in each lane's log ('for <lane>' notes for cross-file wishes).
4. **Log FIRST** — write the lane's `fixes/318_*.md` before any edit (the cap-death-at-the-write killed 10+ lanes; log-first preserved every finding).
5. **Patch-only + re-read before every edit** — V4A hunks are literal; siblings move files under you.
6. **NO keyed calls until Phase 2** — Phase 1 is keyless-safe only.
7. **Self-report ≠ evidence** — every claim = a file:line read or a command run *today*. `COULD-NOT-TRACE` is a valid answer.
8. **No mock/fake/bad code, ever** — a stub must return a coded refusal with `TODO(<row>)`; a fake success is the worst possible code.
9. **A pin NEVER gets weaker to buy a green** — re-point asserting MORE.
10. **Boundary discipline:** mid-fleet = `typecheck`+`lint` only; full `npm test` + commit ONLY on a quiet tree, all-green. ≤1 typecheck per lane; `--test-concurrency=2`; 8 GB machine.
11. **Shared docs:** append-only above the end-marker; corrections cite IDs; W43 = status/evidence columns only, never restructure.
12. **Piped/redacted surprises:** never judge syntax from redacted output (`node --check` is truth); the `patch` auto-lint reports a benign `TS6053` on this space path.

## 3 · PHASE 1 — THE SIX COMPLETION AGENTS (one batch, six lanes)

Each: log-first (`fixes/318_<id>.md`), box-delimited, done-when proven. Parent: boundary + commit (#38) when they land.

- **A1 — THE ORACLE FINISHER** (`src/lib/compile-check.server.ts` + `scripts/run-eval.mjs` + tests): (1) **the wrong-output pin** — scratch emitted tree with a declared `expectedBehavior` whose entry produces wrong output ⇒ assert the tree-run verdict FAILS (`behavior.ok:false` + the coded error); the good case passes; the absent case stays byte-stable; (2) clear run-eval's 9 dead imports (K1-R2/R3 list — remove or use; lint 0 without suppressions); (3) T5.4 — the rt-events import + run-level emissions (bounded; mirror the wildStep seed shape) + `grep -c rt-events > 0` pin. Done-when: the negative pin FAILS the wrong case + run-eval leg green + typecheck/lint 0.
- **A2 — THE SILENT-ERROR FINISHER** (`src/lib/store.ts` + 2–3 same-class files): land the remaining uncoded catches from `317_l1_silent.md` as `code: classifyError(err, "RT_E_INTERNAL")` + propagation; each with a small pin (the catch path's coded outcome reaches the envelope). Done-when: grep shows no uncoded catch in the indicted set + pins green.
- **A3 — THE STANDARD-BEARER** (docs + the recorded nits): resolve H7's crew `--max-steps` + MAX_FILES nits and L2W's 3 nitpicks — **each: fix tiny+prove, or a written one-line why-not**; the T3.4 write-path disposition table if still unwritten; the README/START-HERE counts re-derived to this HEAD. Done-when: every listed nit is fixed or annotated; count greps match.
- **A4 — THE HYGIENE+LISTS FINISHER** (`wave_plans/W43` + repo root): flip W43's statuses to reality (status/evidence columns only); update the checklist count line; root probe-file hygiene (`probe*.mjs` → `fixes/318_*` with MOVED headers or deletion notes); `.gitignore` sanity for scratch dirs. Done-when: W43 = truth; `ls probe*.mjs` empty.
- **A5 — THE VERIFIER-GENERAL**: independently run EVERY A1–A4 done-when command on the frozen tree (verdict per claim: VERIFIED/WRONG/UNSUPPORTED) + the full `bash scripts/gate.sh` on quiet — record its real verdict. Done-when: the verdict table exists; any WRONG → ticketed with fix or exact blocker.
- **A6 — THE WATCHDOG**: the standard guard (watchdog-1..4's bar): ~8 sweeps, one-writer map enforced, W43 hash-guarded (recovery line `git show <HEAD>:wave_plans/W43/COMPLETION-TASKS.md`), phantom tripwire, ≥5 spot-checks (including *running A1's negative case itself*), zero-loss rescue (state.db `messages` + the summary files under `~/AppData/Local/hermes/cache/delegation/subagent-summary-*.txt`).

**PHASE 1 EXIT:** boundary green (typecheck 0 · lint 0 · full suite 0 fail · `gate.sh ok:true`) + commit + `fixes/317_j2_preflight.md` conditions 1–3 re-verified at the new HEAD.

## 4 · PHASE 2 — THE KEYED TRIAL (three-man triage; owner pre-steps first)

**OWNER PRE-STEPS (the user does these locally):** top up the wallet; confirm `DEEPSEEK_API_KEY` in the repo `.env`; run the preflight (`node scripts/run-eval.mjs --preflight` or the command in `317_j2_preflight.md` §4) → no `balance-exhausted`; then dispatch the trio.

- **T1 — THE OPERATOR (computer-use style, WITH the key).** Drives RapidTool as a real agent-user would — the DeepSeek key powers RapidTool; the operator never does the app's work itself. Three real builds, in order: **(a) a website** (static marketing page class), **(b) a game** (arcade class), **(c) a small program** (CLI tool class). Per build: `create` → drive to P12 (**`wild --project <p> --start --agent-seal`** for the unattended path; the console/preview server may be used for UI verification) → `emit --run` → the emitted tree's own tests → the `eval` scorecard → record EVERY envelope, exit code, score, and the seat rows. Also runs `diagnose` on each finished project. Deliverable: its transcript-level log (every command + verbatim output).
- **T2 — THE APP-RESPONSE MONITOR.** Watches T1's interactions AND the app's replies live: the envelopes, the rail/console states (screenshot via Playwright if the console is driven — the dev-server quirks: ~78s boot; `curl localhost` not `127.0.0.1`), error texts, timings, the emitted artifacts' structure. Catalogues UX/response anomalies with exact bytes; runs `diagnose`/`doctor` on T1's projects independently. Deliverable: the anomaly catalogue + the response-quality verdict.
- **T3 — THE BACK-END MONITOR.** Watches what RapidTool actually RUNS while T1 works: child processes (and the reap behavior), the NDJSON event streams, the engine's phase transitions (the sealed rows), the API usage (requests/402s/budget ledger), and **reads the EMITTED CODE** — is the generated software real and working (not the one-module-wearing-filenames skeptic case: run `doctor --tree`; expect `real ≥ 3` for multi-module ambition or record the truth). Deliverable: the backend narrative + the code-quality verdict.
- **THE TRIAGE LOOP:** any bug found → the parent fixes code-shaped bugs (keyed-safe, small, pinned) → T1 re-runs the affected build → until it completes end-to-end (emitted tree green) or the bug is ticketed with its exact reason. **Every fix rides a fresh boundary + commit.**
- **PHASE 2 DELIVERABLE:** `fixes/319_keyed_trial.md` — the full record: per-build outcomes (scores, mint state, tree-test results), the three monitors' findings, every bug + its fate, and the one-paragraph honest verdict: **"does RapidTool produce working software powered by a DeepSeek key?"**

## 5 · THE COMMANDS (copy-paste)

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
npm run typecheck                          # unpiped; expect exit 0
npm run lint                               # expect 0 errors
npm test                                   # FOREGROUND; expect 0 fail
bash scripts/gate.sh                       # the full gate; expect ok:true

# RapidTool itself (keyless-safe unless noted):
node scripts/rapidtool-cli.mjs create --brief "…" --project build.json
node scripts/rapidtool-cli.mjs gate --project build.json
node scripts/rapidtool-cli.mjs approve --project build.json --seat autopilot   # non-TTY machine seat
node scripts/rapidtool-cli.mjs wild --project build.json --start --steps 20 --agent-seal   # the sealed unattended run
node scripts/rapidtool-cli.mjs emit --project build.json --out emitted --run
node scripts/rapidtool-cli.mjs doctor --tree emitted
node scripts/rapidtool-cli.mjs diagnose --project build.json
node scripts/rapidtool-cli.mjs eval
node scripts/run-eval.mjs --preflight       # wallet check
node scripts/run-eval.mjs --keyed           # PHASE 2 ONLY, funded
```

## 6 · WHAT "DONE" MEANS

1. Phase 1's exit above (all-green boundary at the new HEAD, commit banked).
2. A real keyed build completed end-to-end: emitted tree's tests green, eval scored, mint state honest, no faked rows.
3. `fixes/319_keyed_trial.md` answers the one question with bytes.

*Provenance: this prompt was written at commit `ba5a392` (2026-09-29) from the W43/J/K/L wave state; every path and claim above traces to a log under `fixes/`. The repo moves — verify before acting.*
