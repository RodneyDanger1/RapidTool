# W22 · BUG-FIX WAVE (lanes 1–3 + WD) — fix what the last waves made/left, correct the ledger, then the armed watcher runs #3

**All readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`).

```text
⚠️ A WATCHER IS ARMED (proc_e87697cee804): after ALL agent activity stops ≥5 min it runs typecheck +
`npm run eval -- --keyed` and notifies with the score. Your work DELAYS that run correctly — that is the
design: fix first, then measure. Do not leave half-applied edits; if you must stop, say so LOUDLY.

WHAT JUST LANDED (W21, verified):
- THE FIX: single-chunk emitted trees now materialize importable under "type":"module" —
  `codegen.server.ts` + `codegen.server.test.ts`: RED pinned (`ReferenceError: module is not defined`)
  → GREEN; suite 118/118 (base 112); the REAL run-#2 bytes probe: exit 1 → exit 0 with the full export
  surface (`TREE_IMPORT_OK exports=[…]`). scaffold.ts untouched.
- F2 finished: scoped typecheck 0 errors; registry 39/39 · llm 14/14 · mock 12/12; eslint 0.

TWO CORRECTIONS TO RECORD (the watchdog's independent check vs my brief):
1. My brief said "29 latent type errors" (from W20-L4's handoff) — the watchdog's scoped typecheck of the
   same box found EXACTLY 1 (TS2322 openai-compatible.ts:163), now fixed. **W20-L4's "29" was inflated;
   the ledger must say so.** Never propagate an unchecked count again.
2. The W21 watchdog could not certify RUN3-readiness before its cap; its stated precondition ("wait for
   L1's fix + confirm the W21-258 test GREEN") is NOW SATISFIED by L1's own 118/118 + probe run.

⚠️ HOST ARTIFACT: node under Hermes's BACKGROUND harness dies `stdin is not a tty` exit 1 — FOREGROUND only.
QUALITY: production-ready, RED-first where a defect is real, no stubs/mocks/eslint-disable.
WRITE EARLY: skeleton + bottom line within ~10 calls (`fixes/260_lane<N>_<slug>.md`).
FORBIDDEN: npm run typecheck/test/build (the watcher owns the full typecheck). Scratch: C:/Users/mnril/w22l<N>_scratch/.
```

## LANE 1 — the ledger's READY-TO-FIX-NOW queue (fix in severity order, each with a test)
**Owns:** whatever the six items require — READ `fixes/257_error_ledger_v3.md`'s "ready-to-fix-now" shortlist
(**#52 → #24 → #14 → #62 → #50 → #28**, plus flagged #37/#51), and for EACH: read its row (attribution +
batch-fix note), fix it, pin it with a test or a command, and mark the row `FIXED-APPLIED (W22-L1)` in
`fixes/257` **append-only** (add a one-line status marker; never rewrite a row).
If an item's fix would collide with another box, SKIP it with a written reason and continue — the queue is
ordered, not all-or-nothing. Report per item: `#id → fixed/struck/skipped (why) + the command`.
**Done-when:** every one of the six has a disposition + evidence; the ledger carries your markers.

## LANE 2 — certify THE FIX end-to-end (the two un-run items) + the emitted-tree consequence
**Owns:** `src/lib/codegen.server.test.ts` region (read-only unless a defect demands a patch), your log.
W21-L1 left two items needing one foreground run. Do them:
1. **The un-run verifications**: run the full `codegen.server.test.ts` foreground (expect 118/118) and any
   scratch probe W21-L1 cited (`C:/Users/mnril/w21l1_scratch/probe.mjs`, `strip_probe.mjs`) — paste outputs.
2. **The independent consequence check**: take the REAL run-#2 tree
   (`research/eval-out/coffeehouse2home-property-ledger/`), re-materialize its single-chunk tree in a
   SCRATCH temp tenant with `"type":"module"`, and prove the spec now imports clean (or name why not).
   Then answer one question in one line: **"with this fix, would run #3's tree-run be green?"** — honest,
   evidence-based, no prediction beyond the evidence (the spec's ASSERTIONS still have to pass; state that).
**Done-when:** both items' outputs pasted; the one-line answer is backed by the probes.

## LANE 3 — ledger corrections + the residuals register
**Owns:** `fixes/257_error_ledger_v3.md` (append-only markers ONLY), your log `fixes/260_lane3_ledger_corrections.md`.
1. **The "29 vs 1" correction**: add a `> [W22-L3] CORRECTED: …` marker to the affected row(s) — W20-L4's
   handoff claim (inflated count) + my brief that propagated it; cite the watchdog's scoped typecheck
   evidence (`C:/Users/mnril/w21wd_scratch/tsc_baseline_union.txt`).
2. **Sweep the ledger for other unverified counts/claims** copied from handoffs into briefs/logs (the
   watchdog's method: re-derive each with one scoped command; correct or confirm). Cap: the 10 most
   load-bearing counts only; list them.
3. **The W20/W21 residuals register**: one table of every still-open item from W20/W21 (L1's finished items,
   WD-α's 4 incidents incl. the P1-flagged one, WD-β's 6 ready-to-fix items' post-L1 status, the
   p6-brief-fit/p6-arch proposals from `fixes/255_lane2_probe_truth.md` §P1/§P2) with owner + status.
**Done-when:** the markers are in `fixes/257`; the corrections are evidence-cited; the residuals table is complete.

---

## WD — bug-fix-wave watchdog (`fixes/261_w22_wd.md`)
READ-ONLY (report + `C:/Users/mnril/w22wd_scratch/`; no repo edits; no git mutations; ≤2 FOREGROUND runs).
Poll all 3 lanes ≥3×; verify ≥8 claims against bytes (boxes respected; `fixes/257` must show ONLY additive
markers — `git diff` its row count before/after); re-run ONE named test per lane (≤2 total); no-mock hunt;
then **the RUN3-readiness re-certification the W21 watchdog could not finish**: `git status` review + a
scoped typecheck of the union of W21+W22 boxes (the W17-L5 pattern; W21's configs are in
`C:/Users/mnril/w21wd_scratch/`). Deliver `READY-FOR-RUN3: yes/no + why` — this is the gate the armed
watcher's run #3 implicitly relies on. Bottom line at top.
