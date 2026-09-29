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
(filled at the end — E1, below)

---

# E1 — THE SEAL FINISHER (D1's tail) · appended by lane E1

**Lane:** E1 (D1's tail finisher). **HEAD at start:** 54c6649 (tree clean). **Baseline:** typecheck 0 / lint 0 / suite 2669/2668/0 (scripts 348 + src 2321 legs — D-wave boundary).
**Scope:** (1) `--agent-seal` CLI wiring + threading → `wildStep` opts; (2) the keyless-safest seal pins (provenance: classifier/`agent-seal` seat, never `human`; `gate.forceHuman` refusal without/under the seal; bounded retry N=2 on a classifier-source reject); (3) D1's S1–S8 walked with evidence (below); (4) S6 step-arithmetic pin (13 steps / store cap 20 / margin 7 — pin only).
**Files owned (D1's claims inherited):** `scripts/rapidtool-cli.mjs`, `src/lib/headless.ts` (wild opts threading), `src/lib/engine.ts` (C1/D1 regions: `wildLiveEdge`/`wildExecEdgeFor` new + `wildDodRepairOnce` completion + `wildStep` execute-edge), `src/lib/wild-seal.test.ts` (NEW), `scripts/README-cli.md`, `scripts/cli-exit-taxonomy.test.mjs` (Leg 10 additive), `fixes/313_d1_seal.md`, `probe_c1_arith.mjs` (delete at end).

## E1 plan of record (locked before implementation)
- **CLI semantics resolution (recorded because D1's claim line reads `wild`/`approve`/`gate --agent-seal wiring`):** the seal is a WILD-MODE policy (it lives in `WildStepOptions.agentSeal` and can only take effect on the `wildStep` carrier) — so:
  - `wild --agent-seal` = THE wiring: threads `agentSeal: true` into headless (`wildStartRun`/`wildStartHeadless`) → `wildStep` opts. Valid on `--start` and bare step/`--resume`.
  - `approve --agent-seal` / `gate --agent-seal` = **coded pointer refusals**: both verbs drive drivers that can never carry the seal (`approve` = the human seat door; `gate` = `runUntilGate` autopilot, which never self-approves stock HITL gates by design R3/B-03). A silent ignore of a governance flag would let a caller believe the seal applied when it did not — the refusal names the correct door (`wild --resume --agent-seal`). `approve`'s non-TTY hint (C1's noted item) also names the seal.
  - README-cli.md §27 + USAGE + top comment updated; `wild` remains the only verb that can carry the flag into effect.
- **Engine completion (D1 docstrings honored — declare-or-strike):** `opts.liveEdge` / `opts.dodRepair` were declared in `WildStepOptions` but not consumed (false claims): E1 wires `wildLiveEdge` (P7 live layer — the same `headless.runPhase(…, {live:true})` the sequential driver runs; keyless floor) + consumes `dodRepair` in `wildDodRepairOnce` + routes the execute-edge through one `wildExecEdgeFor` picker (P6 bytes identical — pinned by wild-step.test.ts).
- **Pins (all keyless, injected reviewer):** `src/lib/wild-seal.test.ts` — provenance rows (never `human`), forceHuman refusal both modes, N=2 bounded retry + non-retry classes, repair seam, P7 live seam, full-run step arithmetic.
- **Evidence log:** each block below lands with its command + observed output.

## Seam table (site → before → after → pin) — filled
| Site | Before | After | Pin |
|---|---|---|---|
| `policy.ts` `PolicySeat` | `autopilot: harness\|autopilot` | `+ agent-seal` (D-wave) | `policy.test.ts` (D) + E1 provenance pins |
| `dod.ts` `classifyRowSeat` | harness/autopilot tags | `+ [seat agent-seal]` arm (D-wave) | E1 full-run: `runGate(…, gate).pass` post-seal |
| `engine.ts` `wildApproveGate` | plain `decidedBy:"autopilot"` row | sealed row: `[seat agent-seal]` + `decidedVia` (D-wave) | `wild-seal.test.ts` §S1 |
| `engine.ts` `resolveWildReviewBounded` | n/a | N=2 classifier-reject retry + `wild.review_retry` rows (D-wave) | `wild-seal.test.ts` §S3 |
| `engine.ts` `wildExecEdgeFor` + `wildLiveEdge` | P6 inline pick; P7 floor-only | one picker (P6 bytes identical) + P7 live seam wired | `wild-step.test.ts` P6 pins (unchanged) + `wild-seal.test.ts` §S5 |
| `engine.ts` `wildDodRepairOnce` | p6Edge-only consumed (D-wave) | `dodRepair` seam first, then `wildExecEdgeFor(phase)` (production non-floor edge) | `wild-seal.test.ts` §S4 |
| `headless.ts` wild loops | no seal knob | `opts.agentSeal` threaded to `wildStep` | E1 CLI Leg 10 + `headless.test.ts` |
| `rapidtool-cli.mjs` `wild` | no flag | `--agent-seal` → `opts.agentSeal:true`; usage | E1 CLI Leg 10 (behavioral spawn) |
| `rapidtool-cli.mjs` `approve`/`gate` | flag silently ignored | coded pointer refusal + hint; usage | E1 CLI Leg 10 + README-cli docs |

## E1 evidence (filled as it lands)
- (E1a) probe_c1_arith.mjs re-run @54c6649 (pre-edit): **13 steps, 1/phase** — transcript tail: step 13 `in=P12(ready) out=completed`, `gate.verdict,wild.review,wild.advance` … `wild.complete`; FINAL `complete`. [S6 evidence]
- (E1b) — engine completion edits + diff summary.
- (E1c) — CLI wiring + usage diffs.
- (E1d) — wild-seal.test.ts pins green (foreground run).
- (E1e) — CLI legs (cli-exit-taxonomy incl. Leg 10, README-cli, scripts suite) foreground.
- (E1f) — headless/wild-step regression legs foreground.
- (E1g) — S1–S8 walk verdicts + gates (typecheck/lint) + probe deletion.
