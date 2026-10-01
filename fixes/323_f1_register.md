# 323 — FIX-1 register (window #4) — src/lib register + V4 continuation

Lane: FIX-1. Window #4 OPEN per `C:/Users/mnril/w44_trial/fix_go4.md` (read 2026-09-30 ~17:0x CDT, 22 lines).
HEAD at open: `20802b1` + uncommitted windows 1–3 edits. X3b window-3 STILL APPLYING concurrently to
`codegen.server.ts` / `knowledge.ts` / `dod.ts` — never touched by this lane. FIX-2 owns `scripts/**` +
`headless.ts` checkpoint logic. No keyed RapidTool runs in flight.
**Real code only — no mocks/stubs/placeholders. One writer per file. Re-read before every edit. Patch-only minimal diffs.**

## Work queue (from fix_go4.md §FIX-1)
1. E3-1 spend-snapshot staleness — packet.ts singleton (~:517-520) / engine callers (~:1247/:1974). Choose: accurate write-through OR explicit labeling w/ pins.
2. F-5 silent reply truncation — wild-mode.server.ts ~:286 `maxTokens:320`; length-stop marker/flag + pin (or exact adjudication).
3. policy.ts typo — grep `a autopilot` → fix phrase to "an autopilot/harness".
4. T9.3 repair-dir variant (fixes/319_f3_promote.md §D.1) — containment check; headless.ts only after FIX-2 log END else adjudicate + defer.
5. V4-DUTY after `=== END 322_x3_fixes` — scoped suite runs + pin-integrity vs 20802b1 + adversarial set → `fixes/322c_v4_verify.md`.

## Status log
- [~] Opened. Recon: fix_go4.md read (present, window open). X3b END marker currently "IN PROGRESS" (not final). `fixes/323_f2_register.md` absent (item 4 precondition unmet for headless.ts).
