# fixes/313_d1_seal.md — D1: the seal implementer (agent-seal approval + bounded retry + DoD repair + P7 + step arithmetic + pins)

**Lane:** D1 (seal implementer — C1's frozen design, 85% remainder). **HEAD at start:** de7deae. **Baseline:** suite 2660/2659/0, lint 0, tree clean.
**Scope:** LAND the agent-seal path end-to-end (CLI flag → threading → classifier-as-approver → coded seats → bounded retry → DoD repair → P7 edge → step arithmetic) + pins in `src/lib/wild-seal.test.ts`.
**Log status:** in progress (skeleton written first — 311/312 lesson: reserve the write step).

## FILE CLAIMS (D1 — one writer per file; inherits C1's claims)
- `src/lib/policy.ts` — **D1 only** (agent-seal seat + classifier vocabulary).
- `src/lib/dod.ts` — **D1 only** (`classifyRowSeat` agent-seal arm).
- `src/lib/types.ts` — **D1 only** (`WildParkUnlock` += `"agent-seal"`).
- `src/lib/engine.ts` — **D1 regions (C1's)**: `approveHitl` (decidedVia), `WildStepOptions` (agentSeal/…), `WILD_UNLOCK_TEXT`, `resolveWildReviewBounded` (new), `wildApproveGate`/`wildLeavePhase` bodies, `wildLiveEdge`/`wildDodRepairOnce` (new), `wildStep` execute-edge + opts threading. C3 owns the wild reviewer resolution + `resolveWildReview`; C2 owns `hydrateWildRun`. **Patch-only + re-read before each edit.**
- `src/lib/headless.ts` — **D1 region**: `wildStartHeadless`/`wildStartRun` opts threading only.
- `scripts/rapidtool-cli.mjs` — **D1**: `wild`/`approve`/`gate` `--agent-seal` wiring + usage text. (C1 owns approval doors; re-read — C2 touched opts construction.)
- `src/lib/wild-seal.test.ts` — **NEW, D1 only** (wild-step.test.ts claimed by C2+C3).
- `probe_c1_arith.mjs` — delete at the end (scratch, repo root).
- `fixes/313_d1_seal.md` — this log.

## Status board
- [ ] S1 — agent-seal approval (STOCK_HITL + keyed classifier approver + coded audit rows + decidedVia)
- [ ] S2 — gate.forceHuman: human-only + precise coded reason documented (C1 finding #4)
- [ ] S3 — classifier-REJECT bounded auto-retry (N=2, backoff) before parking
- [ ] S4 — DoD-red parks: ONE repair pass before parking (or honest park)
- [ ] S5 — P7 missing-live-layer in wild path: wire or coded refusal
- [ ] S6 — step arithmetic re-verify (probe on disk; raise cap only if needed)
- [ ] S7 — pins in wild-seal.test.ts (keyless-safest; injected reviewer)
- [ ] S8 — seam table + verdict + gates (typecheck/lint/suite)

## Lane notes ('for <lane>')
- for C2/C3: D1 patches engine.ts only in C1 regions (approveHitl / WildStepOptions / wildApproveGate / wildLeavePhase / wildStep execute-edge + new additive helpers). Re-read before your own edits.
- for C2: CLI `opts` construction — D1 adds `--agent-seal` flag handling near your `wild` opts block; additive only.

## Seam table (site → before → after → pin)
(filled at the end)
