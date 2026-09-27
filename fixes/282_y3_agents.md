# fixes/282_y3_agents.md — W37 Y3 · THE AGENT-LAYER CODER (packet/crew/policy/handoff/report-intake + AGENT_GUIDE)

**Lane:** W37 · Y3. **Box:** `src/lib/packet.ts` (coord w/ Y2 — read fresh; prefer the governance items), `src/lib/crew.ts`, `src/lib/crew.server.ts`, `src/lib/policy.ts`, `src/lib/handoff.ts`, `src/lib/report-intake.ts`, agent-facing doc texts (`AGENT_GUIDE.md`).
**Payload:** F2's 31 findings (`subagent-summary-1-20260926_195114_767464.txt`) + `wave_plans/W37/master-pack.md` (X6-adjacent subset).
**Contract:** CODE-ONLY (no test runs / typecheck / builds / keyed calls) · smallest honest patches · additive only · `TODO(<id>)` at the logic line · log-and-continue · never touch a file a live lane holds → log `for N-x`.

## Running table (status per F2 finding)

| F2 | Sev | Item | Status | Evidence (file:line → what → why) |
|---|---|---|---|---|
| F2-14 | P0 | console approve bypasses policy seam | OUT-OF-BOX (store.ts) — verify + log for parent | — |
| F2-18 | P1 | two-channel seat CLI-only (`headless.ts:942`) | OUT-OF-BOX (headless.ts, N2-adjacent) | — |
| F2-17 | P1 | missing `cli-exit-taxonomy.test.mjs` citation | OUT-OF-BOX (scripts — N5 owns OPS-3) | — |
| F2-15 | P1 | F4 overlay zero consumers | PARTIAL BOX (policy.ts ✓; engine/console out) | — |
| F2-19 | P2 | DoD teeth on note substring | OUT-OF-BOX (dod.ts) | — |
| F2-01 | P1 | packet machine block hides seat provenance | TODO | — |
| F2-02 | P1 | `lastTest.ok` truthiness | TODO | — |
| F2-03 | P1 | stale-packet re-stamp (3 ways) | TODO | — |
| F2-31 | P1 | model_route names wrong model | OUT-OF-BOX (llm-tasks/engine/headless) | — |
| F2-04 | P2 | no budget boundary in packet | TODO (packet face only) | — |
| F2-06 | P2 | no verification label | X4/N5 territory (packet face only) | — |
| F2-07 | P2 | exportProfiles dead surface | TODO (wire or de-scope note) | — |
| F2-09 | P2 | two shapes of one conversion (crewToReport dead) | TODO | — |
| F2-10 | P1 | crew spend escapes ledger | TODO | — |
| F2-13/30 | P2 | packet crew ≠ live crew | TODO | — |
| F2-12 | P3 | subagent.ts orphaned | record only (TODO(R13-f14) honest) | — |
| F2-22 | P1 | closed loop broken (notes → stale packet) | TODO (overlaps F2-03b) | — |
| F2-21 | P2 | agent blocks masquerade as human rejections | TODO | — |
| F2-20 | P3 | phase handoff carries no provenance | TODO | — |
| F2-23 | P2 | "the packet" is three byte strings | TODO (io.ts out-of-box → log) | — |
| F2-27 | P1 | honesty lie on four surfaces | PARTIAL (AGENT_GUIDE in box; README/START-HERE → log) | — |
| F2-25 | P1 | AGENT_GUIDE "does not build software itself" | TODO | — |
| F2-24 | P1 | AGENT_GUIDE "no live feedback channel" | TODO | — |
| F2-26 | P3 | AGENTS.md 35 verbs / START-HERE 191 files | out (AGENTS.md owner-blocked) | — |
| F2-29 | P3 | 263_state_of_play orphaned | record only | — |
| F2-05/08/11/16/28 | ? | (not in the 9.7 KB summary verbatim — verify from broader F2 log if needed) | — | — |

## Timeline
- [t0] Recon: read `wave_plans/W37/master-pack.md` + F2 payload; `git log` (HEAD `0f85c32`); `fixes/` newest = 281_n4/n5/n6 (W36 lanes live); no 282_* yet; `policy.ts` read fresh — `fixtures.approve` (requiresHumanSeat) + two-channel `isVerifiedHumanSeatToken` LIVE; `applyPolicyOverlay` live + narrow-only.

## Changes landed
(pending)

## for other lanes / notes
(pending)
