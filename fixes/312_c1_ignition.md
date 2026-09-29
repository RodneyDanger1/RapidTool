# fixes/312_c1_ignition.md — C1: the ignition (agent-seal approval + bounded retries + DoD repair pass + P7 wire + step arithmetic)

**Lane:** C1 (ignition engineer) · **HEAD at start:** 59dc573 · **Baseline:** suite 2649/2648/0, lint 0.
**Scope:** make an UNATTENDED keyed run able to legitimately complete all 13 phases with every safety class honest.
**Log status:** in progress (skeleton written first — 311 lesson: reserve the write step).

## FILE CLAIMS (312 lane coordination — one writer per file)
- `src/lib/engine.ts` — **C1 regions**: `approveHitl` (decidedVia), `WildStepOptions` (agentSeal/liveEdge/retryBackoffMs), `WILD_UNLOCK_TEXT`, `resolveWildReviewBounded` (new), `wildApproveGate` / `wildLeavePhase` bodies, `wildLiveEdge` / `wildDodRepairOnce` / `wildExecEdgeFor` (new), `wildStep` **execute-edge + opts threading**. C3 claims only the wild reviewer resolution + `resolveWildReview` bound; C2 claims `hydrateWildRun`. Reciprocal note: this file is shared — patch-only, re-read before each edit.
- `src/lib/policy.ts` — C1 only (agent-seal seat).
- `src/lib/dod.ts` — C1 only (`classifyRowSeat` agent-seal tag).
- `src/lib/types.ts` — C1 only (WildParkUnlock += "agent-seal").
- `src/lib/headless.ts` — C1 region: `wildStartHeadless`/`wildStartRun` opts threading only (C2/C3 own their named regions).
- `scripts/rapidtool-cli.mjs` — **C1 owns the approval doors** (C3 log-note: "C1 owns approval doors"); C1 region: the `wild` verb `--agent-seal` wiring + usage text + the non-TTY approve hint.
- `src/lib/wild-seal.test.ts` — **NEW, C1 only** (wild-step.test.ts is claimed by C2+C3 — C1 pins live in the new file).
- `fixes/312_c1_ignition.md` — this log.

## Status board
- [ ] S1 — agent-seal approval (STOCK_HITL + keyed classifier approver + coded audit rows)
- [ ] S2 — gate.forceHuman: human-only default, classifier under seal (or precise coded reason to stay)
- [ ] S3 — classifier-REJECT bounded auto-retry (N=2, backoff) before parking
- [ ] S4 — DoD-red parks: ONE repair pass on enforceDod before parking (or honest park)
- [ ] S5 — P7 missing-live-layer in wild path: wire or coded refusal
- [ ] S6 — 20-step arithmetic verification (SE1 count)
- [ ] S7 — no-mint→P6-red path
- [ ] S8 — seam table + unattended-completion verdict

## S6 first — the step arithmetic (probe evidence)
SE1's count (17 = 4 gates×2 + 9×1) is **FALSIFIED by probe** (`probe_c1_arith.mjs`, keyless + injected approve reviewer):
a gated phase costs **1** step, not 2 — `wildApproveGate`'s `approveHitl` moves the cursor in the SAME step
(`wildLeavePhase` never runs for a gated phase). Real minimum = **13 steps** (1/phase), margin vs the store cap
20 = **7**. Probe transcript: P0..P3 = 1 step each; P4/P5/P8/P9 = 1 step each (`wild.approved`); P6..P12 = 1 step each;
P12 step = `wild.complete` (finalize in-step). No raise needed — pin lands in `wild-seal.test.ts`.

## Pin ledger (one pin per seam)
(filled as pins land)

## Seam table (site → before → after → pin)
(filled at the end)


