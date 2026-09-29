# fixes/302_eng_review.md — W42 · THE ENGINEER'S SPEC REVIEW (302)

**Role:** SOFTWARE ENGINEER for W42. Deliverable: `wave_plans/W42/SPEC.md` — the definitive remaining-work spec (strike-list + coder cards + 4 disjoint lanes L1–L4 + boundary plan). DOC-PLUS-VERIFY only — no product edits.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → shell grep only; short one-liners; legs FOREGROUND).
**Baseline:** HEAD `424f9e5` (tree dirty only: `fixes/300_v1_sixpins.md` +4-line append; `?? fixes/302_eng_help.md`). Suite reads 2251/2250/0 (1 legit skip) + scripts 328/328; build 0; boot 200.
**Helper:** ENG-HELP (`fixes/302_eng_help.md`) — appendices A/B/C for the SPEC. I own SPEC.md main body + this log.

## t0 — sources read (this session)

Read in full: `fixes/301_x1_pipeline.md` + X1 summary (`subagent-summary-0-20260928_224909_368803.txt`) · `fixes/301_x2_accept.md` + X2 summary (`-1-…369800`) · X4 summary (`-3-…371795`; `fixes/301_x4_hygiene.md` = t0-only, its ledger never appended) · `fixes/296_q5_register.md` (54 rows; 16 DEFER + partials) · `fixes/296_q8_ops.md` (OPS walk, 7 items walked / 14 pending) · `fixes/296_q2_a2.md`-era ledger (`subagent-summary-1-20260927_043617_513416.txt`; 28 A2 rows; log file never written) · `fixes/283_final_ledger.md` · `wave_plans/W40/CONTINUE-PROMPT.md` §3 (canonical owed list) · `fixes/300_v1_sixpins.md` (CLOSED — strike) · `fixes/298_t2_pins.md` (CLOSED — strike).

## Method

For EVERY candidate: verify against TODAY's bytes (shell grep / read — bytes beat logs); strike what's done with proof; write coder cards (ID · what · where · why · HOW · done-when · traps · size) for the real remainder; cut into 4 disjoint file-box lanes; boundary plan at the end. Log appended as findings land.

## Ledger (append-only)

- **[t0]** Open. Sources read (above). Next: byte-verification sweep of every candidate item against 424f9e5 + working tree.
- **[t1] Verification sweep COMPLETE — 20+ batches of shell greps/reads.** Highlights (bytes read today):
  - packet.ts: F2-04 partial ONLY (imports `:9-18` unused + header note `:32-34`); `packetBudgetBoundary`/`budget` key/`stop_reason` = absent repo-wide; F2-07 TODO absent (`exportProfiles` `:943`, pin `packet.test.ts:676`); F2-09 TODO absent (`crewToReport` `:1406`); `project.acceptance` = 0 hits in packet.ts; `lastTest.label` de-hardcode landed `:707-714`.
  - `npx eslint src/lib/packet.ts` → **4 warnings live** (`budgetCap` :12, `isBudgetExhausted` :14, `sessionTokenBudget` :15, `TokenBudget` :18).
  - run-eval.mjs: Q4-b coded reason live `:2602-2625` (X2's patch; `node --check` OK); `endClass` = history only (`:2849/:2893`); persisted writes non-atomic (`:2874/:2908`) + no `MAX_HISTORY`; crash row `:3240-3256`; crash-stub+exit-0 = deliberate (comment `:3338`).
  - scorecard.ts: `verification`/`endClass`/`behaviorOk`/`kindOk` = 0 hits (reader-side work confirmed unlanded); no scorecard.test.ts on disk; `EvalHistoryRow` lacks endClass.
  - U1 pins: `grep entry-runs|evaluateEntryRunsRow|checkExpectedBehavior scripts/run-eval.test.mjs` → **0** (U1's claimed pins never landed).
  - README: `:317 root 44`(live 42) `:310 fixes 429`(live 450) `:327 total 1,715`(live 1,754) `:588 429`; §10.6 `111+89` stale (live 115+85). START-HERE `191/37/(40)` vs live `200/39/45`. docs-FOLDER-MAP deltas unlanded.
  - OPS walk vs today: #14 resume/unattended `:711/:754` = LANDED; #15 edit-test re-pointed (`:307/:340/:433` titles) = LANDED; #16 dual-channel example LIVE `:837-840`; #17 exit-4 claim live; #18 verifyKind "no seam" claims LIVE-FALSE (`:495/:955`; seam `compile-check.server.ts`); #21 DOCS omits START-HERE (`:33-41`); #11 readRtTail whole-file read LIVE (`runtime-log.server.ts:144`); #12 tree-run swallow LIVE (`:1567-1571`); #13 safe() shape-only LIVE (`:217-226`); #8 doctor spend: `doctorFactory(env, spend?)` `doctor.ts:339` + `claim.spend` exists, headless call `:3637` passes NO spend + DoctorStatus factory lacks it.
  - Fixtures: `reviewState` mints without `f.ok` gate (`fixtures.ts:186-206`) → W-29(g) REAL.
  - gate.sh: `legStats` pass=0-when-absent; no zero-pass anomaly check; tail loop `:221` = 6 ids only.
  - migration-plan.test: local `authSchemaCopies` `:34` + `:98` vacuous return → both REAL.
  - write-atomic: mkdir before try `:67`; browser-guard: win32 fail-closed LANDED `:46-58`, bare `"::1"` still in the set `:19`.
  - docs-module-parity: `--self-check` decorative (`:96-104` fixtures unconditional); DOCS omits START-HERE.
  - package.json: `sideEffects:false` present; no `format:check`, no test-reporter pin; prettier dep exists (a repo-wide check would red — deferred with reason). tsconfig scripts scope deferred-by-design.
  - Strike proofs also gathered: F3-10 bytes `store.ts:1407-1413/:1425-1429`; K7#1/#2/#5/#11 bytes; A-84 writeSync drain `:176-182`; hermes-tmp strays = gone; eval-corpus 11 graders all v2 + 12 md (via ENG-HELP B-16 + my `ls`).
- **[t2] Lane cut + cards WRITTEN into `wave_plans/W42/SPEC.md`** (body §0-§4 inserted before ENG-HELP's appendices; appendices verified intact at :204/:374/:409; final = 452 lines). Cut: L1 eval/acceptance (E-1…E-6), L2 packet/crew budget+lint (P-1…P-8), L3 docs census/truth (D-1…D-6), L4 scripts/guards/CLI (G-1…G-13) — file-box disjoint, one writer per file; partition vs Appendix C differences (headless.ts→L4; store.test.ts→L2) recorded in §2.0.
- **[t3] CLOSED.** SPEC.md = the deliverable; §1 strikes (18 rows), §2 cards, §3 boundary plan, §4 owner/deferred tail. No product edits made by this lane (DOC-PLUS-VERIFY role honored). No keyed calls; no gates re-run (baseline stands; the boundary re-runs everything per §3).
