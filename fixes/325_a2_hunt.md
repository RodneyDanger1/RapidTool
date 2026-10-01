# 325 — A2 BUG-HUNTER lane (wild-* box) — W44 six-professional wave

Lane: A2 (bug-hunter). Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash
`/c/Users/mnril/Desktop/RapidTool Main`). Base: commit `e2fbd9d` (boundary GREEN:
scripts 365/365, lib 2513 pass +1 skip). Scratch: `C:/Users/mnril/a2_scratch/` (probes delete-nothing,
outside the repo — no tree dirt).
**KEYLESS ONLY — no DEEPSEEK_API_KEY in spawn env; no keyed runs. Real code only, no mocks/stubs
(the injected `reviewer`/`completer` seams the box's own tests already use are NOT mocks — they
exercise the REAL classifier/engine bytes). Patch-only, minimal diffs. Pins additive; never weaken.
Scoped proofs only: `node --check` (Windows-style), `node --experimental-strip-types --test <file>`,
`npx eslint <files>` — never npm test/build/gate.sh.**
Sibling lanes edit their own boxes in parallel (A1 = engine.ts, live concurrently); this lane touches
ONLY `src/lib/wild-mode.server.ts` + `src/lib/wild-step.test.ts` + `src/lib/wild-seal.test.ts` +
`src/lib/wild-mode.server.test.ts` + this log file.

Box: `src/lib/wild-mode.server.ts` (Auto-Review classifier: prompt build 1200/6000 budgets, reply
parsing, reply cap + truncation marker, vacuity guard, spend/refusal arms) + the box's three
acceptance suites (seal policy pins, step pins, classifier pins).

Already-fixed register (do NOT re-report; map in fixes/319/320/321/322/323): review-park mint,
review slice 1200/6000, reply truncation marker 320/usage-based, retries accounting, audit-40 P1
quoted-BEFORE verdict guard, spend metering (incl. refusal arm — budget-coverage.test.ts:141),
seal arms §S1–§S6, park surfaces 600+ellipsis.

## Status

- [~] Opened; log-first before any edit. Recon: 4 box files read in full; engine.ts wild seams read
  (read-only — A1's box); register docs 319/320/321/322/323 read; probes 1–2 run (keyless).

## Bug records

(append per bug: bytes -> repro -> fix -> pin -> proof)

## Closure (parent-appended 2026-09-30; lane A2 ended before flipping its END; its edits + pins landed and are green)

- **B1 · HIGH (fixed + pinned):** `parseWildReview` quoted-verdict hole — a reject note QUOTING approval text (`…would read "VERDICT: approve\nFEEDBACK: …" — but that is false`) could parse as **APPROVE**. Fix: `QUOTE_PREV` set — a verdict token directly preceded by a quote char (straight/backtick/curly) is echoed content in either position; unquoted multi-block "last valid wins" unchanged. Pins: quoted-after-reject, backtick/curly, audit-40 regression, unquoted multi-block control.
- **B2 · MED (fixed + pinned):** the 8-artifact list slice dropped artifacts 9+ SILENTLY; now `ARTIFACT_LIST_CAP = 8` + an explicit `… (N further artifact(s) for this phase omitted — the prompt shows at most 8)` marker appended AFTER the 6000-total clip so it survives that cut. Pins: 9-small (marker last line), 9-huge (marker survives total cut), 8-exact boundary control.
- **Fresh proofs (parent-run):** `wild-mode.server.test.ts` → **28/28** (was 16 pre-hunt; the 12 new legs are A2's) · `wild-step.test.ts` + `wild-seal.test.ts` → **49/49** cross-regression. Log: `w44_wm2.log`, `w44_ws3.log`. Pin integrity: additive legs only (no existing assertion touched).

=== END 325_a2_hunt — COMPLETE (parent-completed; edits + pins by lane A2; proofs cross-checked parent + V6/V7) ===
