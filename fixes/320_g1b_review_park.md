# 320 · G1bis — review-park / exit-machinery fixer (W44 Phase-2 wave-2.5, lane G1bis)

Repo: `C:\Users\mnril\Desktop\RapidTool Main` · HEAD `c1049ba` + uncommitted wave-2 edits (G2 diagnose, G3 promotion — untouched by this lane).
Box (one writer): `src/lib/engine.ts` · `src/lib/wild-mode.server.ts` · `src/lib/wild-seal.test.ts` · `src/lib/wild-step.test.ts` · `src/lib/wild-mode.server.test.ts` · `fixes/320_g1b_review_park.md`.
`src/lib/engine.test.ts` does NOT exist (`ls src/lib | grep -i engine` → `engine.ts` + `prompt-engine.test.ts` only) — not added.
Discipline: LOG FIRST (this file, before any edit) · append-only · scoped proofs only (`node --experimental-strip-types --test <file>`, `node --check`, `npx eslint <files>`) · NEVER `npm test`/`build`/`gate.sh` · keyless pins · no keyed calls, key never read.

---

## Ticket (GAP-1 · from fixes/319_keyed_trial.md FINDING-2; BUG-4/BUG-5 from FINDING-3)

A keyed `wild --agent-seal` review-REJECT parks the run (`code:"RT_E_GATE_PENDING"`, `unlock:"human-gate"`, unlockText "A human must approve or reject the open gate (console/CLI)…") **but `hitl` stays null** — CLI `approve` refuses ("No pending gate to approve (status: running)", rapidtool-cli.mjs:932), `reject --note` refuses (:1079), and resume re-views → re-rejects. **Dead end: no human door exists despite the prose promising one.** Companion items: (2) surface truncation `park.reason` 200 @ :3919 + `lastAutoLog` 300 @ :3956 (mirror :4723); (3) review-prompt artifact slice 320 @ wild-mode.server.ts:101; (4) engine.ts:805-808 artifact "backtick defect" — verify/fix iff contained.

## Recon — byte-verified facts (this lane; G1's design re-verified against current bytes)

- **Reject arms (both call `wildPause(next|cur, phase, "warn", "wild.reject", \`P${phase} review REJECTED: ${feedback}\`)`, no `park` arg → `parkIfNull` synthesizes the park):**
  - **:4363-4372** `wildApproveGate` gate-review arm (`const next = wildReviewLog(working, …)` @ 4363; reject @ 4364). By construction this arm ONLY ever sees `source:"classifier"` verdicts: `resolveWildReview` returns `unconfigured-gate` for the no-classifier gate case and `error` for failures; the DoD-floor fallback exists ONLY for `reason:"advance"` (:4173-4191). MINTS UNCONDITIONALLY.
  - **:4469-4478** `wildLeavePhase` advance-review arm. This arm sees BOTH classifier rejects (`source:"classifier"`) AND deterministic DoD-floor rejects (`source:"dod"`, §S3(3ii)). MINTS ONLY IFF `decision.source === "classifier"` — the DoD-floor reject stays byte-identical (parent decision + HARD RULE #5).
- **CLI doors require BOTH project status and hitl** (rapidtool-cli.mjs:930 `if (project.status !== "awaiting_hitl" || !project.hitl) return refuse…`; :1077 same for reject) → the mint must set **`project.status = "awaiting_hitl"` AND phase-record status AND `hitl`** — G1's design's "project/phase into awaiting_hitl" read + confirmed at bytes.
- **Existing machinery does the rest, verified:** `approveHitl` (:1659) throws for `forceHuman`+autopilot unless `force` (:1690-1692, R3/B-03) → completes phase + advances cursor on human approve (:1696-1701, :1757-1763); `wildApproveGate` refuses a forceHuman gate BEFORE any classifier call (:4292-4298) → the seal never self-clears it and a machine resume never re-spends a review; `rejectHitl` (:1785) ≥12-char floor (:1790-1793) → rec `rejected` + `rejectionNote` + `rejectionHistory` + project `blocked` (:1798-1817); `unlockRetry` (:1844) re-opens `ready` only from rejected+blocked; re-run carries `attempt=history.length` + last note into `synthesizePhase` (:1411-1416) → `rejectionResponseBlock(attempt, note)` rides the last artifact body (:1432-1440) and the review prompt steering block reads `rejectionHistory` (wild-mode.server.ts:110-121). `HitlRequest` already imported (engine.ts:65); `types.ts:275-288` has `forceHuman` — NO types.ts change.
- **Resume semantics after mint (verified by trace):** `wildStep` dispatch :4820 (`rec.status === "awaiting_hitl" || hitl?.phase === phase`) → `wildApproveGate` → `gate.forceHuman` refuse arm :4292 → parks `wild.paused_human` (code RT_E_GATE_PENDING via `parkIfNull`) with the minted `hitl` PRESERVED (`wildPause` never touches hitl) → CLI approve/reject still work. **Mint ≠ auto-advance; no re-review spend on resume; the park still parks.**
- **Surfaces:** `wildParkInfo.reason` = `detail.slice(0, 200)` @ :3919 (mid-word cut, T1 F-C bytes "…and (3)"); `wildPause.lastAutoLog` = `detail.slice(0, 300)` @ :3956; `parkIfNull` detail pre-slice `.slice(0, 300)` @ :4723. The envelope `note` is already FULL — untouched.
- **Review slice:** wild-mode.server.ts:98-101 `.slice(0, 8)` artifacts × `.slice(0, 320)` bodies; `maxTokens:320` @ :271 is the REPLY cap — untouched.
- **Cross-suite landmine scan (read-only):** no out-of-box test drives a classifier-source reject: `diagnose.test.ts` uses a frozen parked fixture (G2's, not a live walk); `headless.test.ts`/`store.test.ts` walk gates but never a rejecting reviewer (keyless ⇒ their reject paths are floor/unconfigured, which never mint); `cli-exit-taxonomy.test.mjs` has zero `wild.reject`/`GATE_PENDING` matches; `deny-path.test.ts` = Promise.reject only. `resumeAction` live-pins: none (only static fixtures io.test.ts:790 / store.test.ts:1117).

## Item-4 verdict — engine.ts:805-808 is **NOT a defect** (display/redaction artifact) — NO EDIT

Hex dump of line 805 (`sed -n '805p' | xxd`): `20×14 | 60 | "Authorization:" | 60 | 2c | 0a` = `` `Authorization:`, `` — backticks at cols 14 & 29, balanced, followed by `,`. `grep -F '***' src/lib/engine.ts` → **no matches**; `node --check src/lib/engine.ts` → exit 0. The neighbors (:804 `` ``, `` · :806-808 bullet templates) are well-formed. The `` `Authorization:*** `` fragment quoted in the ticket is what the REPORTING PIPELINE renders when a plain-text view contains `Authorization:` + following chars (secret-scrubber redaction) — the file bytes are clean. Whole-file parse does not "mask" anything; there is nothing to fix.

## Edits (as landed)

1. **engine.ts** — `clipSurface()` helper (600 + `…` when cut, ≤601; short details byte-identical; double-clip idempotent) + applied at :3919, :3956, :4723.
2. **engine.ts** — `mintReviewGatePark(p, phase, feedback)` helper (sets rec status + project status `awaiting_hitl`, mints `{phase, title:"Review rejected — accept the risk or reject with a note", prompt:<full feedback>, stakes, forceHuman:true, requestedAt}`) + called from the two classifier-reject arms (guard `source === "classifier"` on the advance arm).
3. **wild-mode.server.ts** — prompt artifact budget: per-artifact 1200 + total 6000, explicit `…` on cut, documented in-place.
4. **Pins** — wild-seal.test.ts §S6 (mint/refusal/human-approve/reject→history→retry-carry); wild-step.test.ts (advance-arm mint on the F2 harness + floor-reject no-mint control; surface 600/… pins); wild-mode.server.test.ts (1200/6000 pins).

## Proofs

(appended as run — scoped leg counts before/after, decisive pin lines, eslint, git status)

## Proofs (parent-completed 2026-09-30 — lane hit its cap before appending; all bytes re-measured fresh)

- **Scoped legs** (V2's `v2_legs.sh`, executed post-fix): wild-seal **13/13** · wild-step **34/34** · wild-mode.server **12/12** · `node --check` engine + mode.server **0** · `eslint` all 5 files **exit 0**.
- **Adversarial battery** (V2's validated `v2_adv_repro.mjs` — baseline pre-fix: exactly 11 mint-dependent checks FAILED; run post-fix): **ALL PASS (20/20)** — advance-arm + gate-arm mint; `forceHuman:true`; autopilot approve **throws** (R3/B-03); **seal refuses the minted gate with 0 reviewer calls** (no re-spend); human approve completes + advances; note-reject → `rejectionHistory` + `blocked`; `unlockRetry` → re-run → **advanced (cur=1)**; <12-char note refused; DoD-floor rejects (sealed + unsealed) park byte-same with **hitl=null** (scoping preserved).
  - **PARENT CORRECTION to the harness itself (recorded):** A7/A10 initially reported FAIL because the harness stepped a PAUSED run directly — the by-design noop "Wild run is paused." (`engine.ts:4838`). Corrected to the product flow (`wild --resume` = `headless.wildResumeRun`, then step) → both flipped PASS. Harness diff: `C:/Users/mnril/v2_scratch/v2_adv_repro.mjs` (+3 anchors, `[PARENT CORRECTION]` comments).
- **Item-4 verdict STANDS:** `engine.ts:805-808` = secret-scrubber display artifact, not a defect (lane's hex proof; parent re-read agrees).
- **Pin integrity:** all pre-existing pins ran unmodified in the legs above; deletion-line audit across the wave = only designed replacements (old inline blocks / slice sites).
- **Boundary:** typecheck 0 · lint 0 · scripts 359/359 · lib 2482/2481+1 · gate.sh **ok:true** (253s — `w44_gate3.log`).

=== END 320_g1b_review_park — COMPLETE (edits by G1bis; proofs + trailer completed by parent after cap, via V2's validated tooling) ===
