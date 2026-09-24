# W15 · WATCHDOGS 1–2 — watch the loose-ends wave + certify the W14 closures (prevent error/obliteration/failure/bad code)

**Both watchdogs share this file.** Read your own section.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → ripgrep FAILS; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.

STATE: W14 closed with 7 completed chat tasks (C-1, C-2, OV-2, TA-3, OV-17, OV-15, OV-12). Boundary-verified
by the parent at 13:10 (run-eval 17/17 · headless 91/91 · browser-verdict 40/40 · README-cli 11/11 ·
typecheck 0). Four W15 lanes are running beside you (`wave_plans/W15/lanes.md`): L1 = C-1's repair-seam
test + guard-harness pin; L2 = RT_E registry gap audit; L3 = browser residuals R1/R3/R5-R7; L4 = the 13
WEAK verification strengthenings (draft only, corpus read-only).
The plan corpus is FROZEN: research/multiagent/{220_tasklist_canonical,220_overhaul_plan,230_task_execution_playbook,235,240}.md + fixes/228*,236*,237*,238*,239* — parent-only.

YOU ARE READ-ONLY: write ONLY your report + scratch. NEVER edit src/scripts/corpus/lane logs. No git
mutations. Allowed: read-only reads/greps, polling with sleep, ≤2 targeted test runs
(`--test-concurrency=2`). FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build`. Every claim =
file:line / command / explicit UNVERIFIED. Skeleton first; bottom line at top.
```

## WD-1 — the W15 lanes' watcher (`fixes/242_wd1_w15_report.md`)
Poll the 4 lanes ≥3 times (`sleep 90`; transcripts under `$HOME/AppData/Local/hermes/cache/delegation/live/`,
newest delegation), then:
1. **Ownership boxes** (per `wave_plans/W15/lanes.md`): any file outside a lane's box = P1 incident w/ git
   evidence. Watch especially: L1's new `scripts/browser-guard.test.mjs`, L2's `errors.ts` edit, L3 staying
   out of console.tsx/styles.css unless a real defect, L4 making ZERO corpus edits.
2. **Verify ≥8 claims vs bytes**: read the cited lines; re-run ONE named test per lane (≤2 runs total);
   confirm L1's headless count actually rose (91 → ≥92) and L2's registry change follows the file's own
   convention (no invented codes).
3. **No-rebuild + bad-code checks**: weak tests (would pass with the change reverted), silent catches,
   unbacked claims, scope creep.
4. **Bottom line:** `lanes polled · incidents · claims ok/wrong/unverifiable · rebuild flags` → are the
   landings safe to keep, is anything misreporting?

## WD-2 — the W14 closure certifier (`fixes/243_wd2_closure_report.md`)
Your job is to certify (or falsify) the **7 completed tasks' evidence** and the two W14 watchdogs' open
items — the parent is about to fold this wave into the plan and commit, so your verdict must be independent:
1. **P1-α-01 (L2's out-of-box edit of `scripts/rapidtool-cli.mjs`)**: WD-α and WD-β both flagged it. The
   parent's adjudication: the W14 brief's box was stricter than the playbook (which names
   `rapidtool-cli.mjs` as TA-3's HOT file), and the result was boundary-verified (README-cli 11/11,
   typecheck 0, `node --check` OK). **Verify that reasoning yourself**: open `wave_plans/W14/lanes.md` +
   `230_task_execution_playbook.md`'s TA-3/OV-15 blocks; is the playbook's naming real? Does the diff
   contain ONLY legitimate hunks (no drive-by edits)? Verdict: RATIFIABLE / NOT with evidence.
2. **WD-β's §5 close conditions**: (a) L1's drain evidence — re-run
   `node --experimental-strip-types --test --test-concurrency=2 scripts/run-eval.test.mjs` yourself
   (expect 17/17) and read `fixes/237_lane1_c2_dod_terminal.md`'s "80 → 1" claim: is the measured claim
   actually shown there (round count before/after), or only asserted? (b) L3's smoke evidence — read
   `fixes/237_lane3_browser_pass.md` §§1-2: is the smoke described with real outputs (exit 0, HTTP 200s,
   file paths written), or claimed? Verdict per item: CERTIFIED / ASSERTED-ONLY (name what's missing).
3. **Reconcile WD-β's own anomaly**: its `headless_test_run1.txt` recorded `TEST_EXIT=1` with zero TAP
   output (env-level death, e.g. no tty under load); the parent's immediate re-run was 91/91, and the
   13:10 boundary run was 91/91 again. Confirm or refute the "environmental, not code" reading with your
   own run.
4. **Guard the corpus + repo**: snapshot the frozen corpus to `C:/Users/mnril/w15wd2_backup/` with a
   manifest; sizes only grow; `git status --short` at start/end — only expected files.
5. **Bottom line:** `W14 closures: N certified / N asserted-only · P1-α-01: RATIFIABLE/NOT · repo+corpus:
   state · bad-code findings: N` → is the wave safe to fold and commit?
