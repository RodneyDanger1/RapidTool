# fixes/310_b5_verify.md — B5 · THE RE-VERIFICATION + REGRESSION SWEEP (round 2's honest mirror)

**Lane:** B5 (probe-driven verification — round 2's honest mirror). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`.
**HEAD at open:** `1af7f88`. Siblings live: A-wave logs `309_a1/a2/a3/a5/a6`; B-lanes `310_b3_boundary.md` (live edits in `headless.ts`/`errors.ts`/`checkpoint.server.ts`/`token-ledger.ts`).
**Box (read-side):** re-run every on-disk probe FOREGROUND against the CURRENT tree — `~/rt308_m3/{cli_fuzz.mjs,hostile1.ts,t_capneg.mjs}`, `~/rt6/probes/{p1_fs.mjs,p1_cli.sh,p2_emit.mjs,p3_roundtrip.mjs}`, `node ~/w39q1_scratch/(dead-exports|dead-fns).mjs`. Probe scripts NOT edited. Small fixes only in files no sibling touches. **BUGS ONLY. NO keyed calls.**
**Rules honored:** legs FOREGROUND (background run = no-tty death, see `~/rt308_m3/cli_fuzz.log` parent correction); log opened pre-runs.

---

## t0 — baselines (the "before" column, cited)

| # | Probe | Before | Source of record |
|---|---|---|---|
| 1 | `~/rt308_m3/cli_fuzz.mjs` (195 cases, 39 verbs × 5 scenarios) | **SUSPECT=4** | `fixes/309_a1_wildverb.md` + `cli_fuzz.log` parent correction (wild-verb STACK exit 4 class) |
| 2 | `~/rt308_m3/hostile1.ts` (98 cases) | **ok=76 throw=22 coded=0** | `~/rt308_m3/probe1_full.log` / `probe1_rerun.log` |
| 3 | `~/rt308_m3/t_capneg.mjs` | **7.8 s spin** then `RangeError: Invalid array length` | `fixes/309_a2_throwguards.md` M3-02 |
| 4 | `~/rt6/probes/p1_fs.mjs` (33 fs cases + E6-E8 conditional) | M7-02/03/05/06/07 red rows | `fixes/308_map7_boundary.md` |
| 5 | `~/rt6/probes/p1_cli.sh` (14 CLI cases) | c1/c8 ro-dir + c7 STACK-class rows per M7 | `fixes/308_map7_boundary.md` |
| 6 | `~/rt6/probes/p2_emit.mjs` | M7-01 class: reloaded-clone emit drift (key-ADDED) | `fixes/308_map7_boundary.md` |
| 7 | `~/rt6/probes/p3_roundtrip.mjs` | R2 `equal:false` (46603→47221), 24 key-ADDED diffs; fixed point R3; packet stable R6 | `fixes/308_map7_boundary.md` M7-01 |
| 8 | `~/w39q1_scratch/dead-exports.mjs` | baseline captured (see §1) | `out_dead-exports.txt` |
| 9 | `~/w39q1_scratch/dead-fns.mjs` | baseline captured (see §1) | `out_dead-fns.txt` |
| 10 | M4-17 candidate (`console.tsx:3379/3408`, `tokensEst` label) | open question → check basis | task brief §2 |
| 11 | `RT_E_BUSY` sweep (`headless.ts` / `rapidtool-cli.mjs`) post-B1/B4 | verify-only | task brief §3 |

## §1 — THE RE-RUNS (verbatim counts appended as each lands)

_(running — results land below as each probe completes)_

