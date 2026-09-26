# 263 · LANE 1 (B1) — bug hunt: `src/lib/` core

Wave: W24 spring-clean (fixes/263 family, lane 1 of 4).
Base HEAD: `b721f9c`. Box: `src/lib/engine.ts`, `store.ts`, `phases.ts`, `dod.ts`,
`gate-stats.ts` (+ `gates.test.ts`), `packet.ts`, `io.ts`, `doctor.ts` and their
`.test.ts`. NOT console/routes (U1/U2), NOT `src/lib/llm/**`/`scripts/**` (B2).

Evidence rule used here: every fix is followed by a targeted FOREGROUND run
(`node --experimental-strip-types --test <one-file>` / `npx eslint <files>`); the
repo-wide gate was never invoked (siblings editing).

## Findings

(being filled in as the hunt progresses — this file is append-only from here)

### F1 — `gate-stats.ts` `approvalHealth`: window applied to `decidedAt` only … CHECKED, NOT A BUG

`src/lib/gate-stats.ts:62-68` — status: not a bug. The A27 comment right at line
65-68 states the request-side window is applied (`d.requestedAt >= cutoff`), and
the code does apply it. Suspicion dissolved; no patch.

Status legend: `FIXED` (patch + foreground check), `NOT-A-BUG` (with reason),
`PROPOSED` (needs a keyed run / out-of-box edit).
