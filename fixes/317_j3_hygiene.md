# fixes/317_j3_hygiene.md — J3: THE HYGIENE + TAILS FINISHER

**Lane:** J3 (317 J-wave). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`. **HEAD at entry:** `6a9ff96` (I-wave). **Tree at entry:** clean (`git status` = only sibling log `?? fixes/317_j1_oracle.md`; K1/K2 logs appeared at 20:04).
**Read first (done):** `fixes/316_i4_stragglers.md` (its ledger: R1/R3/R5 still open — R2/R4 closed by I4), `fixes/312_c3_lifecycle.md` (E2 section ends at "E2 evidence ledger" — never appended), `fixes/316_h7_survive.md` (RECORDED ledger: crew `--max-steps` + `MAX_FILES` nits), `fixes/316_h2_policy.md` (§4 = placeholder only, T3.4 table unwritten), `wave_plans/W43/COMPLETION-TASKS.md` (137 lines; I3 flipped T1.4/T3.3/T5.2/T5.5/T7.1/T8.3/T8.5/T8.6; count line 14/12/17).
**Coordination (K2's one-writer map, read at 20:04):** J1 owns `compile-check.server.ts` + `run-eval.mjs` + CLI emit arm + `entry-oracle.ts` (LIVE — the `MAX_FILES` nit site is under J1 byte-ownership ⇒ record-with-blocker, never edit). J4 owns wild-step/seal legs + `313_d1_seal.md`. J2 = probes only. K1 = dead files only. K2 = audit only. **I (J3) own:** probe moves → `fixes/317_*`, `wave_plans/W43/COMPLETION-TASKS.md`, this log, and the E2/H7 tail targets.
**Rules honored:** NO keyed calls. Legs FOREGROUND. One writer per file — every file below re-read immediately before patching. Short one-liners / `cd` before grep (space in path).

## Deliverable board

| # | Item | Status |
|---|---|---|
| D1 | E2's owed: land the two missing CF-SE2-3b spend sites (`headless.ts` narrative · `wild-mode.server.ts` classifier) + NEW `src/lib/budget-coverage.test.ts` pins | TODO |
| D2 | E2's owed: run the budget legs E2 never ran (`token-ledger.test.ts` + `packet.test.ts`) + append E2's evidence ledger to `fixes/312_c3_lifecycle.md` | TODO |
| D3 | E2's owed: `loadProject`-busy "second half" — verify whether anything is owed (R2 closed check) | TODO |
| D4 | T3.4 disposition table (§4.0 scan + §4.1 table) appended to `fixes/316_h2_policy.md` | TODO |
| D5 | H7 nit 1 — crew `--max-steps`: verify I4's landing + pin (run) | TODO |
| D6 | H7 nit 2 — `MAX_FILES` silent truncation: RECORD precisely (J1 byte-ownership blocker) + ready-to-apply patch text | TODO |
| D7 | Probe hygiene: 5 root `probe-*.mjs` → `fixes/317_probe_*.mjs` (MOVED header, runnable preserved) + delete `C:\Users\mnril\_rt_v1_seal_probe.ts` (outside repo) | TODO |
| D8 | W43 status flips (status + evidence columns only) + count line | TODO |

## Recon findings (read-only, verified on bytes at 20:04–20:10)

- **E2 spend wiring = 1/3 sites.** `recordSessionSpend` call sites on disk: `engine.ts:2997` only (fetchResearch narrative, with the CF-SE2-3b comment). `headless.ts` = comments only (`:89`, `:1474`); `wild-mode.server.ts` = no call. Helper `token-ledger.ts:387` LANDED; envelope `packet.ts:441` + pins `packet.test.ts:990-1043` LANDED. `src/lib/budget-coverage.test.ts` = ABSENT. `fixes/314_f3_merge.md:29` byte-check confirms the split ("token-ledger + engine so far (headless/wild-mode pending) → LANDING (E2)").
- **R2 (M6-04) closed:** `headless.ts:278 saveProjectBusyAware` + `rapidtool-cli.mjs:726` wiring + `scripts/cli-run-busy.test.mjs` (4 tests) present. Re-verified by running the pin (see ledger).
- **H7 nit 1 (crew):** fixed by I4 — `rapidtool-cli.mjs:2332-2336` reads `args["max-steps"]` with the carried-by-I4 comment; pin = `cli-run-busy.test.mjs` crew key leg. Verify-by-run only.
- **H7 nit 2 (MAX_FILES):** still live — `src/lib/compile-check.server.ts:75` (`const MAX_FILES = 2000`) + `:176` (`if (filesSeen >= MAX_FILES) return;` — silent partial walk; contrast `MAX_CHECK_BYTES` which fails loud). **Blocker: J1 owns this file, LIVE mid-edit (K2 map).** Record + ready patch.
- **T3.4:** table unwritten — §4 has method + classes only, ends `*(Table: §4.1; scan command + raw counts: §4.0.)*`. H2 log mtime 18:51, no sibling owner.
- **Probes at root:** `probe_n2_f316.mjs`, `probe-h1-p7.mjs`, `probe-h6-lessonchain.mjs`, `probe-i4-busy.mjs`, `probe-k9-kinds.mjs` (tracked). `probe_c1_arith.mjs` = already deleted (T10.2's core). Outside file `C:\Users\mnril\_rt_v1_seal_probe.ts` (5895 B) exists.
- **W43 candidates:** T10.1 counts now 0/0 (`f270b38`); T10.2 core landed; T3.4/T5.1/T5.3 complete iff D1/D2/D4 land; T5.4 = J1 live (check at end); T4.4/T6.2/T8.2/T8.4 evidence still needs its own byte-check (see §W43 later).

## Evidence ledger (appended as items land)

- [t0] Entry; recon complete (findings above). HEAD `6a9ff96`.
