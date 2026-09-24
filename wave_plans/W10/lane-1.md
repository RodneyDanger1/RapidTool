# W10 · LANE 1 — §3 shortfall log + T-11 LANDING (recon complete in W9-L1)

**Your W9-L1 recon is authoritative — it landed ZERO patches. Read your own W9-L1 summary middle:
`C:\Users\mnril\AppData\Local\hermes\cache\delegation\subagent-summary-0-20260917_094306_075651.txt`
(offset 5, ~11 KB) + transcript `deleg_ea7a2afa/task-0.log`. All anchors below are from it.**

**(A) §3 — `p6.jobs.shortfall` production caller.**
- `jobScopeShortfall` at `doctor.ts:126-149` (type :114-123); no production caller.
- SAFE to import in engine.ts: `grep 'from "./engine' doctor.ts` → none ⇒ no cycle (doctor imports
  only sandbox-policy, token-ledger, + a type-only registry import). If you judge doctor→engine
  out of bounds anyway, mirror the 24-line helper locally as `jobScopeShortfallLocal` with a
  byte-parity TSDoc.
- Caller site: `applyPhaseResult` (engine.ts:1327), inside the `!needsHitl && lessonSurface` seal
  block (:1416); P6-branch tail/return at :1487-1493 (`stampP6ReqTrace`).
- Contract: append `{phase: 6, level: "warn", event: "p6.jobs.shortfall", detail}` ONLY when
  declared lattice jobs > materialised job files; zero-shortfall runs byte-identical.

**(B) T-11 — PARENT DECISION (use this, no re-litigating):**
1. "probe id" = the DoD criterion ids ALREADY inside the lesson row (failureSignature anchors /
   the `p6-verified`-style ids) — surface them as an explicit `[probe:<id>]` tag built from those
   existing anchors. **NO row-id re-minting** (protect the 167-suite churn surface).
2. Green-seal GATE: stop minting the red-seal lesson at `engine.ts:1416-1418`
   (`!needsHitl && !r.pass` — the F-08 branch; L5's live probe proved it mints
   `lesson-template-emission-…` with tags `['L2','lesson','template-emission']`). The red-seal
   signal becomes a `p6.*` LOG (honest, not a lesson). The feedback half (selectLessons) works —
   don't touch it; keep the `refuse:no-proof` floor intact.
- knowledge.ts:916-931 builds tags + content-addressed id — the tag goes in there.
- Update any 167-suite pin that encodes the OLD behavior, old→new with the T-11 citation.

**Owned:** `engine.ts` + `knowledge.ts` + their tests; `fixes/216k` §3 section.
**NOT:** token-ledger.ts + verify/chat/crew/node-runner (L2), compile-check + scripts/rapidtool-cli.mjs (L3).
**Verify:** typecheck 0; `node --experimental-strip-types --test src/lib/packet.test.ts src/lib/gates.test.ts src/lib/knowledge.test.ts`
(baseline 167) + any engine-exercising suite. Budget death ⇒ PLAIN state (never non-compiling).
