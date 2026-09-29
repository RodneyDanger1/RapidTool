# fixes/314_f5_kinks.md — F5: the kink sweeper (SD's remaining product kinks, code-shaped, severity order)

**Lane:** F5 (kink sweeper) · **HEAD at start:** `54c6649` · **Source:** `fixes/311_sd_product.md` §1 (K1–K7 table) + §2 (top-5 friction) + §3 (pay-worthiness gaps) + §4 mechanism recommendations.
**Scope:** non-console UX — CLI text, onboarding/refusal surfaces, error surfaces in CLI/server layers. **console.tsx + pipeline-rail = E3's; nothing here touches them.** K1 × C1 (done-seal), K4 × C6/U1 (done-seal) — F5 verifies, does not re-land.
**Log status:** skeleton written FIRST (311 lesson: reserve the write step). Filled as items land.

## FILE CLAIMS (log-note coordination — one writer per file/region)
- `scripts/rapidtool-cli.mjs` — **F5 region: the `approve` case seat-naming guard + `--seat autopilot` flag + the approve usage line.** Disjoint from C1's wild `--agent-seal` wiring and E4's `respond()` remedy seam (both left byte-untouched by F5).
- `src/lib/doctor.ts` — F5: `FACTORY_GAP` human-readable + explicit next-step clause (K6); `pricesFromEnv` seam wiring in `factoryClaim` (pay gap §3 metering).
- `src/lib/headless.ts` — F5: mirror-only edit of the inline honest-floor gap strings (headless.ts:3839-3842) so the two floors cannot diverge (K6).
- `src/lib/errors.ts` — F5: `RT_E_LLM_NOT_CONFIGURED.agentAction` text gains the `.env`-vs-process-env split + exact command (friction #5). Disjoint from E4's `RT_E_TREE_RUN_FAILED` edit.
- `fixes/314_f5_kinks.md` — this log.

## Status board
- [ ] F5-1 (K2, High/integrity) — TTY bare `approve` must never silently mint `decidedBy:"autopilot"`; explicit `--seat autopilot` for machine attribution (audit rec #2).
- [ ] F5-2 (K5, Med) — approve refusal reworded: names a recovery path that actually works post-K1 (exact commands, call-site `remedy`).
- [ ] F5-3 (K3, High) — verify E4/U2 `emit --run` self-qualification (`substance` census in envelope) with a keyless probe; pin if unpinned.
- [ ] F5-4 (K6, Low) — doctor `factory.gaps[]` human-readable + next-step.
- [ ] F5-5 (friction #5) — key-setup split: keyless refusal text names `.env` vs process env + exact command.
- [ ] F5-6 (§3 pay gap) — metering: operator-supplied prices via env (`RAPIDTOOL_PRICE_*`), honest null default kept.
- [ ] F5-7 — legs: typecheck/lint + targeted suites green; kink ledger complete.

## Kink ledger (every K-row → disposition)
| K | Severity | Disposition |
|---|---|---|
| K1 approval deadlock | Blocker | **Done (C1, sealed in D-wave).** F5 re-verified the doors exist (`gate --autopilot`, wild `--agent-seal`); no re-land. |
| K2 TTY bare approve → autopilot row | High (integrity) | (F5-1, landing) |
| K3 `emit --run` exit 0 on stub tree | High | E4/U2 landed in working tree (envelope `substance`); F5-3 verifies + pins. |
| K4 oracle asserts stub-fails | High | **Done (C6/U1, compile-check `detectOracleStubTrap` at 54c6649).** F5 verifies bytes; no re-land. |
| K5 approved-refusal has no recovery path | Med | (F5-2, landing) |
| K6 doctor gaps machine-readable only | Low | (F5-4, landing) |
| K7 onboarding nextAction good | ✅ | No action (credit stands). |
| §2 (1) approval deadlock | — | = K1. |
| §2 (2) machine-vs-human attribution | — | = K2 (F5-1). |
| §2 (3) no "what do I do now" on coded refusal | — | = K5 + E4/U3 remedy seam (`respond()` ships `ERROR_CODE_DOC.agentAction`). |
| §2 (4) green-is-not-good signal | — | = K3 (E4/U2) + K4 (C6/U1) + F5-3 pin. |
| §2 (5) key setup split (.env vs shell) | — | (F5-5, landing). |
| §3 pay gap: prices ship null | — | (F5-6, landing). |
| §3 pay gaps: real output code, behavioral proof, multi-project, auth, hosting, reliability | — | Not 1-day code fixes (see E3/next-wave notes below); ledger records them as remaining. |
| §4 "no behavioral leg on product path" | High (wiring gap) | Partially addressed: census + oracle-trap detection (C6/U1) + envelope self-qualification (E4/U2). Full `entry-runs` wiring = follow-up wave (recorded below). |

## Evidence ledger
(filled as items land)

## For E3 (console — not touched by F5)
(filled in the handoff section at the end)
