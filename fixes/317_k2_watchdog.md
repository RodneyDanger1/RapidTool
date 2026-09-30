# WATCHDOG-4 (K2) — J-wave live monitor, accuracy net, loss prevention

- **Role**: recorder + accuracy net + zero-loss guard for the 317 J-wave. **AUDIT-ONLY — no product edits by me.** HTTP/file reads + read-only exec (test/probe runs allowed for spot-checks; no product writes).
- **Repo**: `C:\Users\mnril\Desktop\RapidTool Main` @ HEAD `6a9ff96` + in-flight edits.
- **Fleet under guard** (5 lanes, 2 delegations):
  - `deleg_2c97d845` task-0 → **J1** (oracle wire: `src/lib/entry-oracle.ts`, `compile-check.server.ts`, `scripts/run-eval.mjs` + test, CLI emit arm; log `fixes/317_j1_oracle.md`) — the risk lane.
  - `deleg_2c97d845` task-1 → **J2** (pre-flight verifier: probes + `fixes/317_j2_preflight.md` = the keyed-run checklist; runs the full suite/gate — expect long quiet stretches).
  - `deleg_2c97d845` task-2 → **J3** (hygiene: tails E2/H7, probe moves → `fixes/317_*`, W43 status flips; log `fixes/317_j3_hygiene.md`).
  - `deleg_2c97d845` task-3 → **J4** (pins: D1's S-checklist close + `313_d1_seal.md` append + gate.sh verdict; log `fixes/317_j4_pins.md`).
  - `deleg_0e989129` task-0 → **K1** (bug-check all J diffs; tiny fixes in dead files; final gates; log `fixes/317_k1_bugcheck.md`).
- **Transcripts**: `~/AppData/Local/hermes/cache/delegation/live/<deleg>/task-N.log` (append-only live logs; mtimes+bytes per sweep).
- **My log**: this file — written first (20:04), appended per sweep.

## GUARD CONTRACT (duties)
1. **~8 live sweeps**: each lane's transcript mtime + their files' byte-growth (esp. `entry-oracle.ts`/`compile-check.server.ts`/`run-eval.mjs` for J1; W43 doc for J3). Timeline recorded.
2. **DAMAGE WATCH per sweep**: (a) one-writer map enforcement — flag any two lanes on one file; (b) W43 doc hash-guard — J3 flips statuses; a SHRINK beyond a flip = damage class → recovery line recorded (never edited by me); (c) `git status` — unexplained deletion or stray `checkout/clean` = flag immediately; (d) phantom tripwire — any lane's redirected leg reading `stdin is not a tty` → correction appended INTO that file.
3. **≥6 spot-checks**: load-bearing claim per lane (J1: the wrong-output pin FAILS the verdict — negative case run by me; J2: checklist boundary numbers match a fresh gate run; J3: a moved probe still runs from its new path; J4: S-checklist LANDED rows' pins exist at cited lines; K1: landed fixes are real).
4. **NO-LOSS (end)**: every finding in lanes' finals present in their files; summary-only → rescued condensed into this file (state.db path when needed).
5. **End**: inventory table + loss count (target 0) + obstruction record (guard never edits product files).

## ONE-WRITER MAP (from kickoffs; enforce + update)
| Writer | Owns (product) | Owns (docs/probes) |
|---|---|---|
| J1 | `src/lib/entry-oracle.ts`, `src/lib/compile-check.server.ts`, `scripts/run-eval.mjs`, `scripts/run-eval.test.mjs`, CLI emit arm (`scripts/rapidtool-cli.mjs`) | `fixes/317_j1_oracle.md` |
| J2 | none (probes only) | `fixes/317_j2_preflight.md`, `~/j2_*` probes + worklog, THE RUNS (suite/gate) |
| J3 | E2/H7 tail targets (watch git status) | `fixes/317_j3_hygiene.md`, probe moves → `fixes/317_*`, `wave_plans/W43/COMPLETION-TASKS.md` |
| J4 | wild-step/seal legs (watch) | `fixes/317_j4_pins.md`, `fixes/313_d1_seal.md` (S-checklist append) |
| K1 | tiny fixes in DEAD files only (check mtimes first) | `fixes/317_k1_bugcheck.md` |

## BASELINE (sweep 0 @20:03:49)
- W43 doc: **32573 bytes**, sha256 `d25010bca77339c783da8ef56b526b870ba36c218e782a0bcd1394224da1487a`. RECOVERY LINE (not to be run by me — for owner/parent): `git show 6a9ff96:wave_plans/W43/COMPLETION-TASKS.md > wave_plans/W43/COMPLETION-TASKS.md`.
- Live logs @20:03:49 — all 5 present/growing: t0=14087 t1=10235 t2=9237 t3=5338 (deleg_2c97) · k1=7419 (deleg_0e98). No tty-phantoms seen at sweep 0.
- Fix-files: `fixes/317_j1_oracle.md`=2117 B (J1, 20:02), `fixes/317_k1_bugcheck.md`=1681 B (K1, 20:03). j2/j3/j4 docs not yet written.
- Worktree: clean except `?? fixes/317_j1_oracle.md`, `?? fixes/317_k1_bugcheck.md`. No product edits landed yet (J1 still reading).
- src sizes: entry-oracle.ts=22146 · compile-check.server.ts=87274 · run-eval.mjs=167475.
- Baseline sha256: entry-oracle `d09da9fb…` · compile-check `7305a12d…` · run-eval `1937c933…`.

## TIMELINE / SWEEPS
- **S0 @20:03:49** — baseline above. All 5 lanes live (mtimes ≤45s). J1: reading 316_h5_oracle + compile-check (no edits yet). J2: `~/j2_worklog.md` written, reading probes/gate.sh/seal. J3: reading H2 log + W43 doc (137 lines). J4: reading D1 checklist, hunting I2's log. K1: wrote bugcheck skeleton. No anomalies.
- **S1 @20:04:24** — t0=18132 t1=13013 t2=12197 t3=5338 k1=10543 B. J1 reading compile-check + run-eval.test; J2 reading probes/gate; J3 reading H2/W43 (got `wild-mode.server.ts` mtime=22:29 → dead-file check good); J4 quiet 56s (was in 10–22s `find`s); K1 re-reading. W43 sha intact. 0 product edits. 0 phantoms.
- **S2 @20:04:42** — t0=20110 t1=13013 t2=13887 t3=5338 k1=11628 B. J2 worklog (read): 5 conditions = seal-complete / boundary-green (typecheck+lint+suite+gate.sh) / probes-answered (arith + no-mint + class-K1 door) / wallet-funded / user-word. W43 intact. J4 quiet 74s.
- **S3 @20:05:02** — t0=23327 t1=13013 t2=16444 t3=5338 k1=11628 B. W43 intact. J4 quiet 94s → probe: J4's bash (PID 1585, started 20:03:29) alive; **J4 blocked in its own home-dir grep** (`cd /c/Users/mnril && find . … ; grep -rl "entry-oracle" --include="*.txt" . ; grep -rl "193001" … Desktop`) — stall, not crash (see ANS).
- **S4 @20:06:01** — t0=28127 t1=13013 t2=21875 t3=5338 k1=11628 B. **J3 wrote `fixes/317_j3_hygiene.md` (4559 B)** — first J-doc after j1. W43 intact. J2 quiet ~2min: its repo-wide `grep -rn -i "no-mint"` (PIDs 2112/2114) started 20:04:05 still running — long-grep stall, not crash. J4 grep chain advancing (leg 2 started 20:04:54). K1 quiet ~1.4min (thinking/reads). 0 phantoms.
- **S5 @20:06:37** — t0=30860 t1=13136 t2=22967 t3=6317 k1=11628 B. J2+J4 RESUMED (long greps completed). **First product edit landed: `M src/lib/headless.ts` (J3, E2 spend import)**. K1 quiet 2min → explained: K1 ran `terminal(sleep 510 …)` at 20:04:37 = deliberate pacing till ~20:13 (not a stall). W43 intact. 0 phantoms.
- **S6 @20:06:55** — t0=33087 t1=14801 t2=23951 t3=7515 k1=11628 B. J1 reading `compile-check.server.test.ts` (writeEmittedTree/treeRunAsConsumer helpers — prep for its test edits). Still only headless.ts edited. W43 intact.
- **S7 @20:07:28** — t0=34683 t1=17824 t2=25347 t3=7515 k1=11628 B. J3 landed 2nd headless.ts hunk (spend call-site; found sibling mtime-touch left no content delta). J1 still pre-edit. J4 quiet ~38s (reading 316_i3 finisher). W43 intact.
- **S8 @20:07:53** — t0=36195 t1=17824 t2=26259 t3=7515 k1=11628 B. J2 quiet ~31s; J4 quiet ~63s. W43 intact. No phantoms.
- **S9 @20:09:05** — t0=38370 t1=23572 t2=27012 t3=7515 k1=11628 B. **J1 landed 1st product edit: `M src/lib/compile-check.server.ts` (+467 B: imports `checkEntryContract`/`validateExpectedBehavior`/`EntryContractRecord` from entry-oracle)**; **J3 landed `M src/lib/wild-mode.server.ts`** (classifier spend site) → both E2 sites + import landed: `headless.ts` `if (comp && comp.usage) recordSessionSpend(comp.usage)` @bareNodeLiveOverlay; `wild-mode.server.ts` `if (res && res.usage) recordSessionSpend(res.usage)` @createWildClassifier. Both additive/commented (diff-verified clean; LlmResult.usage optional exists). J4 quiet 2.2min (new slow scan). W43 intact.
- **S10 @20:09:39** — t0=39456 t1=25304 t2=30083 t3=7515 k1=11628 B. J1 wiring continues (compile-check 87274→89124 B). J2 active. W43 sha intact; 3 modified files (J1 compile-check; J3 headless+wild-mode). No two lanes on one file ✓. 0 phantoms.

## ANOMALIES / LANE NOTES
- **A3 — J4 second long scan @20:06:50→** (`cd ~ && ls -a ; find . -name "*193001*" -not -path … ` home-wide, lane-side `timeout:240`) — hunting I2's summary txt. Bounded: times out ~20:10:51. **The file J4 seeks exists**: `~/AppData/Local/hermes/cache/delegation/subagent-summary-1-20260929_193001_592679.txt` (located by K2; record-only — no lane interference).
- **A1 — J4 long-grep stall @20:03:29→**: terminal call `cd /c/Users/mnril && find … ; grep -rl "entry-oracle" --include="*.txt" . ; grep -rl "193001" --include="*.md" Desktop` — home-dir recursive scans; leg-1 ran 85s, leg-2 (Desktop) still running at S4. Lane blocked meanwhile (log frozen @5338 B). Not a crash — record, do NOT kill (guard never interferes). If >10 min, escalate in timeline.
- **A2 — J2 repo-wide grep @20:04:05→**: `grep -rn -i "no-mint|no mint"` over repo (PIDs 2112/2114). Log quiet during run. Same class as A1 (slow scan), bounded by repo size.
- Session map (state.db): J1=`20260929_200223_f88e99` · J2=`c7cfdd` · J3=`363c25` · J4=`91ec20` · K1=`20260929_200234_d930a9` · K2(me)=`bcb984`.

## SPOT-CHECKS
(pending — ≥6: J1 neg-case pin / J2 boundary vs fresh gate / J3 moved probe runs / J4 pins at cited lines / K1 landed fixes real)

## RESCUES
(pending)

## NO-LOSS AUDIT (end)
(pending)
