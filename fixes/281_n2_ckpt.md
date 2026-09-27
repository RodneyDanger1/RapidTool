# 281 · LANE N2 (W36) — CHECKPOINT HARDENING + REAL `resume`/`unattended` + `readWildPlan` residue

Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → grep). HEAD `0f85c32` + W29–W36 era.
Sources read first: `wave_plans/W36/completion.md` (N2 brief) · `wave_plans/W34/code-notes.md` §A1 (A1-01…A1-09 + A1-47 verbatim) · `fixes/277_l2_integration.md` · `wave_plans/W33/unlanded-block.md` §U2 · `fixes/272_s1_autonomy.md` (seam map) · `fixes/276_f1_real_autonomy.md` (W-01/W-02 landed).
Box: `src/lib/checkpoint.server.ts` · `src/lib/headless.ts` (checkpoint helpers) · `scripts/rapidtool-cli.mjs` (resume/unattended verbs + USAGE + README-cli row) · lane log here.

## Recon (byte-verified at lane start)

- `checkpoint.server.ts` untracked; no consumer outside `headless.ts` (`clearCheckpoint`/`writeCheckpoint` imported at :56; `commitRunCheckpoint`/`clearRunCheckpoint` at :641/:653; `runModeFor` at :1964) + the CLI's lazy `checkpointDriver()` (rapidtool-cli.mjs:261 — defined, **unused** until this lane).
- **No `case "resume"` and no `case "unattended"` arm exists**; `resolveCheckpointTarget` (CLI:407) was written by L2 but had **zero call sites**. CLI arm count today: **37** (`grep -c 'case "'` = 37; README claims sync). L2's C1 write-half is LIVE; C2/C3/C4 are this lane's.
- **engine.ts NOW exports `readWildPlan` (:3538)** and `store.ts` imports it (:9, used at :1505) — the F3-01 residue is only headless's stale inline copy + two stale comments (:33-34, :3811).
- `errors.ts` RT_E_CHECKPOINT_MISSING doc (:514-519) is STALE: names `.rapidtool/checkpoints/` (real path: `.rapidtool/checkpoint.json`), a "guarded shell (default OFF)" writer and `RAPIDTOOL_CHECKPOINT=1` env guard that exist nowhere (grep: errors.ts only). Fixed as part of the resume verb's honesty (small, logged).
- Sibling lanes are LIVE in `scripts/rapidtool-cli.mjs` (file grew 3519→3532 lines while reading; N5 owns OPS-1/OPS-3 in the same file) — re-grep anchors before every patch; USAGE keys + `case` arms must stay in exact parity (`scripts/README-cli.test.mjs` — read, NOT run per brief).
- Doc-parity arithmetic if both verbs land: arms 37 → **39**; README must update: `**N subcommands**` (:10), the verb-list block tokens, the `grep -c`-quoting lines (:31, :376-377, :445, :447), `rapidtool-cli.mjs:768` refs (already stale — verify-kind call actually at :989) re-pointed, USAGE keys, Commands-table rows #35/#36.

## Plan (mapped to §A1 cards)

1. A1-01/A1-06: `refuseBadDir()` first on all three ops (before any `join()`); junk/empty `projectDir` = `RT_E_VALIDATION` everywhere (argument class), `path: ""` — no fabricated relative path.
2. A1-02: `boundProjectForCheckpoint` total (`asArray` on all six heavy arrays); bound-pass + payload assembly inside the try; write gate refuses non-array `logs`/`decisions` + missing id/phases (partial-project class).
3. A1-03: caps comment reworded to the truth (+ `chatLog: 40` bound added); shared-HISTORY_CAPS marked as the cross-lane follow-up (store/io out of box).
4. A1-04: writer validates `run` in the reader's terms (integer phase/step ≥ 0, mode whitelist) before any write.
5. A1-05: `classifyError(error, "RT_E_VALIDATION")` on all fs catch paths (read/write/clear).
6. A1-07: `checkpointAdmits` phase/step sanity + returns `{ok:true, savedAt}`.
7. A1-08: pid+ms staging name (`.${pid}.${ts}.tmp`), honest atomicity comment (no fsync over-claim), best-effort staging sweep + extended clear sweep.
8. A1-09/A1-47: `CheckpointReadResult` documents the minimal shape + hydrate law; `headless.loadResumableCheckpoint` = read → admit → hydrate → re-entry, consumed by both new CLI verbs (the wiring the island needed).
9. `readWildPlan`: re-point headless to the real engine export (it landed) — inline copy + stale comments deleted.
10. CLI: `case "resume"` (real: read→admit→hydrate→runUntilGate at `cp.run.phase`; prints snapshot age) + `case "unattended"` (real scheduler drive: resume-from-checkpoint else start-from-file, autopilot+live, parks honestly at stock HITL) + USAGE + README-cli parity edits.

## Log

- (t0) Lane start; sources read; bytes re-verified. Wrote this log EARLY (before any patch).
