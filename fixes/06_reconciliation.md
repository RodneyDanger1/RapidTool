# Parent reconciliation — cross-agent findings, false positives, and the final gate

## Findings disposition (from review/01 + audit/01 + audit/03)

| ID | Severity | Verdict | Action |
|---|---|---|---|
| A01 | P1 | **False positive** | `store.ts` passes the correct pre-advance phase id and `approveHitl` marks the phase `complete`; `recordGate` fires for HITL phases. Locked with a regression test (store.test.ts: "DoD gate verdicts are recorded on completion AND on HITL approval"). |
| A02 | P1 | **Fixed (both halves)** | Root: sandbox `FORBIDDEN` regex now masks string literals + comments (`maskLiteralsAndComments`) so injected prose can't trip it (Flash 3). UI: HitlDock now shows an "I reviewed the failure" override checkbox gating Approve, and `onApprove(force)` passes it (parent). |
| A13/A14 | P3 | **Fixed** | Denylist widened to word-boundary `fetch|WebSocket|self|window`; `runSandboxed` wires worker `onerror` → honest "worker crashed" instead of a 30s lie (Flash 3). |
| A22/A27/A03 | P2/P3 | **Fixed** | `runGate` no vacuous pass; gate-stats window + zero-mean handling (Pro B). |
| audit/03 A,B,D,F,G,H | P1–P3 | **Fixed** | auth/app-data: uniqueness gap, structured fail-closed errors, memo identity-bleed (Flash 4). |
| ai.ts orphaned | — | **Honesty-fixed** | config-gated provider stub, no fabricated output (Flash 5). |
| 10 script-suite failures | env | **Out of scope** | og tests couple to real `site.json` identity; 2 symlink tests need POSIX privilege — pass on platform Linux CI. |

## Parent's own edits this pass
1. `scripts/` untouched. `sandbox.ts` comment fixed (a `/*…*/` in a block comment + a zero-width
   space — see below).
2. `console.tsx` — `onApprove(force)`, HitlDock `forceOverride` checkbox + disabled state, prop type.
3. `store.test.ts` — +1 A01 regression test.
4. Removed 2 unused `emptyProject` imports (io.test.ts / handoff.test.ts).

## A self-inflicted bug worth recording
Stripping a zero-width space (U+200B) from `sandbox.ts:17` exposed that the comment text
`/*…*/` inside a `/** … */` block had been silently *masked* by that ZWSP — removing it turned
`*<ZWSP>/` back into a real `*/` and terminated the block comment mid-line (45 syntax errors).
Fixed by rewording the comment. **Lesson: never let a block-comment body contain a literal `*/`.**

## Final gate (this pass)
typecheck 0 · full TS suite **247/247** (12 files) · lint 0 · `npm run build` exit 0 · dev-server
browser smoke 0 console/page errors (Export / Download packet / Import / Copy phase handoff all live).
