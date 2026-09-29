# fixes/314_f3_merge.md — F3 · THE MERGE EXECUTOR (the definitive completion list)

**Lane:** F3 (314 wave, `deleg_0c2424e6` task-2). **HEAD at start:** `54c6649` (tree dirty with live E/F lane bytes — read-only on their files; **ZERO product edits**; the only files F3 writes are `wave_plans/W43/COMPLETION-TASKS.md` + this log). **NO keyed calls.**
**Log status:** skeleton written FIRST (311/312 lesson: reserve the write step) — filled as the merge lands.

## Intent
Replace every PENDING-AUDIT marker in `wave_plans/W43/COMPLETION-TASKS.md` with its verdict + task, compiled from the 311 audit set + 312 C-lane logs + 313 D/E lane logs. Method per factor: (a) verdict (PASS/CONDITIONAL/BLOCKED + source file:line); (b) every CONDITIONAL/BLOCKED → numbered task ID · what · file/box · done-when (one command) · status (LANDED/LANDING/OWED — what the C/D/E/F waves already closed, verified against today's bytes where cheap); (c) NEW factors F8 (PRODUCT/UX — SD kink list), F9 (MARKET — MA outshine-moves), F10 (DESIGN — 10 modernizations' status) each with tasks; (d) a top-block: the keyed-run critical path; (e) end checklist count (total · landed · owed). Every task cites its source finding.

## Sources read (full)
- **311 (8):** `da1_claims` · `da2_data` · `se1_pipeline` · `se2_surfaces` · `ma_competitive` · `sd_product` · `ui_design` · `wd_guard` (incl. its §2 spot-check table + §4 merge-coverage).
- **312 (6):** `c1_ignition` · `c2_state` (+D2 append) · `c3_lifecycle` (+D3/E2 appends) · `c4_ui` (+D4/E3 appends) · `c5_trust` (+D5) · `c6_ux` (+E4).
- **313 (1):** `d1_seal` (D1 + E1 plan-of-record + seam table).
- **F-wave cross-reads:** `314_f6_residue.md` (in flight), `314_g1_tail.md` (landed mid-merge), `314_wd2_guard.md` (fleet guard).
- **Skeleton:** `wave_plans/W43/COMPLETION-TASKS.md` (50 lines) — read first, compiled over.

## Cheap byte-verifications run before writing (today's tree: HEAD `54c6649` + live E/F uncommitted edits)
| # | Check (the examples the brief named + status-critical) | Command | Result |
|---|---|---|---|
| 1 | K1 post-seal — engine core | `grep -n "agentSeal" src/lib/engine.ts` | seal arms LANDED (D-wave: `:3802` opt, `:4217` seal, `:4281` `[seat agent-seal]`, `:4350` bounded branch) |
| 2 | K1 post-seal — CLI wiring | `grep -n "agent-seal" scripts/rapidtool-cli.mjs` | **0 hits** → E1 wiring NOT yet landed (LANDING) |
| 3 | Seal pins | `ls src/lib/wild-seal.test.ts` | absent → E1 LANDING |
| 4 | Mock-hang post-`settle.ts` | `ls src/lib/settle.ts src/lib/settle.test.ts src/lib/deny-path.test.ts` | all present (C-wave `de7deae`); pins re-run 2/2 at `de7deae` (D5 §1) → LANDED |
| 5 | Mobile overflow post-fix | `grep -n "lg:hidden\|run-sidebar" src/components/console.tsx` | drawer + scroll-strip landed (`:3083-3085/:3627-3643`); D-wave "mobile overflow fixed (2955→390px)"; E3 probe `docScrollW 390` → LANDED |
| 6 | Substance verdict (U1/K3/K4) | `git log --oneline -3 -- src/lib/compile-check.server.ts` | landed in `de7deae` (substance + trap + hash) → LANDED |
| 7 | U2 emit self-qualification | `grep -n "stubs" scripts/rapidtool-cli.mjs` | bytes present in tree (`:1298-1304` payload.substance) → LANDING (E4) |
| 8 | U3 coded remedies | `grep -n "agentAction" scripts/rapidtool-cli.mjs` | remedy seam bytes present (`:269-277`) → LANDING (E4) |
| 9 | E2 busy-aware save | `grep -n "saveProjectBusyAware" src/lib/headless.ts` | helper present (`:270`); CLI wiring + pins not yet → LANDING (E2) |
| 10 | E2 budget envelope | `grep -n "packetBudgetBoundary" src/lib/packet.ts` | present (`:208`) → LANDING (E2) |
| 11 | E2 spend wiring | `grep -ln "recordSessionSpend" src/lib/*.ts` | token-ledger + engine so far (headless/wild-mode pending) → LANDING (E2) |
| 12 | E1 engine completion | `grep -n "wildLiveEdge\|wildExecEdgeFor" src/lib/engine.ts` | docstring only (`:3816`); function not defined → E1b pending (LANDING) |
| 13 | S6 step arithmetic | `probe_c1_arith.mjs` on disk + C1 §S6 | 13 steps / cap 20 / margin 7 — probe falsified SE1's 17 (1 gated phase = 1 step); pin owed (E1) |
| 14 | probes hygiene | `ls probe_c1_arith.mjs` | still at root → E1's "delete at the end" owed (LANDING) |
| 15 | F-lane landings | `ls fixes/314_*` | at write: `f6_residue` (skeleton), `g1_tail` (skeleton), `wd2_guard`; F1/F2/F4/F5 logs not yet on disk → those lanes LANDING |
| 16 | K2 (silent autopilot seat) | `grep -n "decidedBy" scripts/rapidtool-cli.mjs` | `:934` still falls through to `{decidedBy:"autopilot", seat:"harness"}` → OWED |

## Planned task inventory (before write — recount at close-out)
F1 ×6 · F2 ×3 · F3 ×4 · F4 ×5 · F5 ×5 · F6 ×4 · F7 ×1 · F8 ×7 · F9 ×6 · F10 ×2 = **43 tasks**.

## Close-out (filled after the merge write)
*(appending now)*
