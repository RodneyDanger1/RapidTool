# fixes/314_f6_residue.md — F6 · THE RESIDUE SWEEPER + THE INDEPENDENT VERIFIER

**Lane:** F6 (314 wave). **HEAD at start:** 54c6649. **Mode:** verify-only on live lanes' bytes (E1–E4/E3 live — uncommitted); fix only F6-owned residue files. **NO keyed calls.** **Bytes or it didn't happen.**
**Scope:** (1) sweep the last unowned rows from the 308/311 maps [last M3 throw survivor · M7-04 · M6-07 · M4-17]; (2) independently re-verify TEN key claims from the recent landings (C/D-wave + E-lane partials) with F6's own commands; (3) any WRONG claim → cause + precise record (fix may be 'for <lane>').

## Status board
- [ ] R1 — last M3 throw survivor (`~/rt308_m3/hostile1.ts` re-run → isolate the 1 throw; site; fix if in a free file else 'for <lane>')
- [ ] R2 — M7-04 saveProject throw doc (record-only per its own note)
- [ ] R3 — M6-07 flake-pin note (comment-level honesty fix or leave; note exec/git/compile-check pins)
- [ ] R4 — M4-17 tok-estimate label verdict (console.tsx; if E3 didn't take it → 'for E3' spec)
- [ ] V1..V10 — the ten independent re-verifications (table below, filled with commands + observed bytes)
- [ ] Close-out — residue ledger + fix log + gates touched

## The ten claims picked for independent re-verification (locked before verifying)
| # | Claim (from recent landings) | Source landing | My verification plan (own command) | Verdict |
|---|---|---|---|---|
| V1 | The seal's provenance pins: classifier/`agent-seal` seat, **never `human`** | 313 E1 seal finisher (`src/lib/wild-seal.test.ts`) | read pins + run wild-seal.test.ts; grep for provenance assertions | TBD |
| V2 | `settle.ts` mock refusal: mock-shaped callables refused; never-`human`/host-gated resolves | 312-C3/C5 (`settle.ts`, `deny-path.test.ts`) | read settle.ts bytes; run deny-path.test.ts | TBD |
| V3 | Descendant reap: the D-wave reap **taskkill**s the process tree on Windows | D-wave commit (54c6649) + reap code | locate reap impl; read taskkill bytes; run keyless reap test if exists | TBD |
| V4 | Hydrate preservation / stop-park invariants (C2/C3) | 312 C2/C3 landings | read hydrateWildRun + stop-park pins; run their test legs | TBD |
| V5 | Mobile overflow fix (D4: min-width:0 chain) | 313-D4 + D-wave | read styles/pipeline-rail bytes; run the D4 probe measure if serverless-able | TBD |
| V6 | Budget porting (token-ledger seam) | C5 §2 / E-lane partial | read token-ledger.ts seam bytes; run its pins | TBD |
| V7 | Mock-hang root-cause fix: no keyed call settles via mock proxy (host-gated) | de7deae C-wave | read engine.ts settleWithin sites; run deny-path leg | TBD |
| V8 | `wildDodRepairOnce` parent-cured engine red (D-wave) | 54c6649 commit text | read wildDodRepairOnce bytes + pin; run leg | TBD |
| V9 | CLI `--agent-seal` refusal semantics on `approve`/`gate` (coded pointer refusals) | E1 (313_d1_seal.md) | read cli bytes (live: verify-only); run keyless CLI refusal | TBD |
| V10 | Unit suite count claim / pins closed (2669/2668/0 at 54c6649) | E1 baseline line + D-wave pins | run targeted suite (NOT whole-suite if 402-risk); pin files count | TBD |

*(final verdicts + commands appended below as they are run)*

## Residue ledger (308/311 open rows → disposition)
| Row | Source cite | Disposition | Evidence |
|---|---|---|---|
| last M3 throw | 310_b5 `hostile1_b5.log` → ok=97 throw=1 (`store.converge-junk-all` @ store.ts:351) | TBD | TBD |
| M7-04 | 308_bugmap:282 / 308_map7:12 — saveProject hostility, recorded not re-hunted | TBD | TBD |
| M6-07 | 308_map6:15 — load-flake pins (exec/git/compile-check) | TBD | TBD |
| M4-17 | 308_bugmap:269 / map4:27 — `≈ tok` label honesty | TBD | TBD |

---

## R1 — the last M3 throw survivor (re-run evidence)
*(appended)*

## R2 — M7-04
*(appended)*

## R3 — M6-07
*(appended)*

## R4 — M4-17
*(appended)*

## V1–V10 — the ten independent re-verifications
*(appended; each with command + observed output)*

## F6's own fixes this lane
*(appended — file, before/after, why safe)*

## Close-out
*(appended)*
