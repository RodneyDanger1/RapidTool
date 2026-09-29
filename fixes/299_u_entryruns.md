# fixes/299_u_entryruns.md — W41 · LANE U1 · MAKE `entry-runs` REAL (Q4 item a)

**Lane:** U1. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; short one-liners; legs FOREGROUND only).
**Mission:** `checkExpectedBehavior`'s `entry-runs` branch (`scripts/run-eval.mjs:721-729`) is the acceptance gate's ONE never-failing clause — a `pending` push with TODO(A3-f05), never evaluated. Make it a bounded, honest spawn of the emitted entry: exit-0-within-budget = pass; `ui-shell` status for UI kinds (per K9's note: treeRun copies to %TEMP% and skips node_modules, so a runtime row for game/webapp is a structural skip, never a silent pass); predicates (`ok`/`complete`/`passesAcceptance`/`acceptanceFailReason`/`verification` label) updated; row shape gains `entry`/`args`/`mode`/`expectExit`/`expectStdout`/`expectStderr`/`uiShell`; the 4 kind graders re-pointed; run-eval.test.mjs pins added asserting the REAL evaluation (no old `pending` pin exists to re-point — verified below); run-eval.test.mjs + gate-verdict.test.mjs foreground.
**Contract:** verify vs bytes FIRST · smallest honest patch · additive · professional quality only · NO keyed calls · `node --check` per edited file · do not touch `scripts/rapidtool-cli.mjs` (uncommitted parent patch) or T1/T2-lane files (node-runner tests + six other test files) · CLI `mjs` parent patch + grader JSON edits are in-scope (`run-eval.mjs` + grader JSONs if a row shape needs it).

## t0 byte-truth (verified before edits)

- HEAD `3ebea43` + one uncommitted parent patch (`scripts/rapidtool-cli.mjs` — checkpoint rides the diagnose envelope). `git status --short`: `M scripts/rapidtool-cli.mjs`, `?? fixes/298_t2_pins.md`.
- `checkExpectedBehavior` (`scripts/run-eval.mjs:676-751`): `file-exists`/`package-target-exists` REAL; **`entry-runs` (:721-729) pushes `status:"pending"` + the TODO(A3-f05) detail — never spawns, never fails**. `ok` = no FAILED row; `complete` = no pending row.
- Rows currently declare only `id`/`check`/`note` — **no `entry`/`args` fields yet** (the 4 graders' `entry-runs` rows are notes-only):
  - `arcade-breakout` (expectedKind game) `game-entry-runs`
  - `date-rrule-library` (library) `library-import-runs`
  - `invoice-csv-cli` (cli-tool) `cli-help-runs`
  - `order-webhook-service` (service) `service-port-wiring`
- `parseGrader` (:359-402): `BEHAVIOR_CHECKS` = file-exists | package-target-exists | entry-runs; entry-runs rows carry NO shape validation beyond `id`/`check` today.
- Emitted entries (verified in bytes): `emitKindEntry` (`scaffold.ts:2142+`) — cli `bin/<slug>.mjs` launcher → `node --experimental-strip-types src/main.ts` (argv passthrough; `--help` prints usage + exit 0; bare = structured refusal exit 1); library `src/main.ts` importable (direct-run guard fires only when EXECUTED); service `src/main.ts` (resolvePort + structured refusal); game = index.html UI shell (vite leg needs a network install).
- `treeRun` (`compile-check.server.ts:1073+`) copies to %TEMP% (skips node_modules/.git, junction seam) and `resolveEntry` (:868-876) returns `ui-shell` for any tree with `index.html`; `entryGreen` counts a ui-shell skip as green (`:1199-1206`) — the repo's own precedent for the status vocabulary.
- Tests: `grep -n "entry-runs\|checkExpectedBehavior\|pending" scripts/run-eval.test.mjs scripts/gate-verdict.test.mjs` → **no pin on the old pending text** (run-eval.test.mjs holds 0 `pending` hits; `checkExpectedBehavior` isn't even imported). So pins in this lane are ADDED asserting the real evaluation (K9 board item 3), none re-pointed.
- `gate-verdict.test.mjs` semantics: the verdict program must never go green on a non-zero leg exit (5/5 cases A–D + the exit-condition pin) — untouched by this lane; run foreground at the end.
- Node on this box: v22.23.2 (type stripping available; emitted launchers spawn `--experimental-strip-types` explicitly).

## Ledger (append-only; evidence = command + observed output)

- **(t0) open** — sources read (Q4 log `fixes/296_q4_output.md`, K9 log `fixes/290_k9_universality.md`, run-eval.mjs, scaffold.ts entry emitters, compile-check.server.ts treeRun/resolveEntry, both test files); byte-truth table above verified TODAY before any edit. This log written EARLY, before any edit.
