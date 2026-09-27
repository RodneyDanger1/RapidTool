# fixes/296_q4_output.md — W41 · LANE Q4 · F4's ACCEPTANCE-TRUTH

**Lane:** W41 Q4. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → shell grep only; short one-liners; legs FOREGROUND).
**Mission:** (1) `passesAcceptance` hardening — the gate must FAIL an artifact whose generated code is broken (real per-kind `expectedBehavior` evaluation if N4/P3 left it structural-only); (2) the `verification` label END-TO-END (acceptance computation → results.json/history.json → CLI `eval`/`gate` render); (3) F4's remaining acceptance/compile-check cards (skip cards P3/N4 landed).
**Contract:** verify vs bytes FIRST · smallest honest patch · additive · `node --check` per edited file · targeted legs foreground (run-eval.test.mjs + gate-verdict.test.mjs at the end) · NO keyed runs · log `for P3` on conflicts (P3 owns fixtures + grader JSONs; I own acceptance logic + the label).
**Baseline HEAD:** `ac6b151`. **Sources:** `wave_plans/W35/factory-notes.md` §F4 · `fixes/294_n4_eval.md` · `fixes/290_k9_universality.md` (K9 board) · `fixes/292_l3_eval.md` · `fixes/295_p3_eval.md` (**NOT ON DISK at t0** — re-check each pass).

## t0 byte-truth (2026-09-27 ~04:1x, verified before edits)

- **P3's log `fixes/295_p3_eval.md` does NOT exist yet** (only `295_p1_f2tail.md` is on disk; `git status` clean at `ac6b151`). ⇒ P3 has landed nothing; coordinate by re-reading bytes + mtimes before every patch of `run-eval.mjs` / `research/eval-corpus/**`.
- **`checkExpectedBehavior` IS on disk** (`scripts/run-eval.mjs:676-751`, W40·N4 attribution): rows `file-exists` / `package-target-exists` are REAL; **`entry-runs` is `pending` — never evaluated, never fails** (`:721-729`, `TODO(A3-f05)`). ⇒ the "broken generated code" channel is still OPEN: N4 left it structural-only.
- `checkExpectedKind` (:757-796), `verificationLabel` (:801-807), `checkAcceptance` returns `{behavior, behaviorOk, kind, kindOk, verification}` (:846-857).
- `passesAcceptance` (:2353-2361) + `acceptanceFailReason` (:2373-2396) already bite on `behaviorOk===false` / `kindOk===false` — but only when the grader declares `passWhen.requireExpectedBehavior` / `requireExpectedKind` AND behavior rows can actually FAIL.
- `entryRow.acceptance = { ...acceptance, pass }` (:2308/:2428) ⇒ if the label rides `acceptance.verification` it already reaches `results.json` rows — verify at persist; `history.json` + the CLI render are unverified.
- `grep -n verification scripts/rapidtool-cli.mjs` → **0 hits** ⇒ the label is NOT rendered in the CLI `eval`/`gate` output (end-to-end broken at the render tail).
- The 7 corpus graders (P3's box): all webapp-shaped, no `expectedBehavior`/`expectedKind` (K9 t0 table) — re-check when P3 lands.

## Ledger (append-only; evidence = command + observed output)

- **(t0) open** — sources read (F4 §full, 294_n4, 290_k9, 292_l3, 295_p1, W40 CONTINUE-PROMPT); byte-truth table above. This log written early, before any edit.
