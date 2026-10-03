# 346 · autonomy audit — is RapidTool a "100% working autonomous software factory"?

**Auditor:** independent subagent (read-only on product code; scratch under `%TEMP%\rt346_audit\`).
**Base:** `9a8e5a3` (pause commit) + the resumed 346 work. **Keyed calls: 0 · network: 0.**
**Question asked:** verify or refute the claim "RapidTool is a 100% working autonomous software factory";
if false, what coding/bug-fixing would make it true.

## Verdict: FALSE (self-refuted by the product)

- `doctor` (keyless, on this box) prints **`"autonomousSoftwareFactory": false`** with 4 named gaps and
  `runner.sandbox:false`. The README already says it is "not yet" one.
- A real keyless factory tick: `{"ok":false,"exit_code":1,"action":"drive-stalled","status":"stalled",
  "phase":12,"code":"RT_E_GATES_FAILED","delivered":false}` — nothing delivered.
- The bar is **human-in-the-loop by construction**: `autonomousSoftwareFactory` requires
  `humanFixtures === true`, which needs an approved fixture row stamped `decidedBy:"human"`
  (`doctor.ts:370-387`, `:512-533`). A fully machine-completed run stays `false` by design (`doctor.ts:15-20`).
  So "no human in the loop" and the repo's own flag definition are mutually exclusive.
- **Conditionally true only under a redefinition** (drop the human-acceptance conjunct) **plus**: keyed-P6
  reliability, delivery-time verification, and an isolation boundary.

## Evidence table (declared limit → demonstrated on this box)

| # | Limit | Demonstrated |
| --- | --- | --- |
| 1 | No autonomy | `doctor` → `autonomousSoftwareFactory:false`, `gaps[]` = leftover job stubs · no human-approved fixtures · no real multi-job product · product-complete bar unmet |
| 2 | Keyless never delivers | real tick → `drive-stalled`, `RT_E_GATES_FAILED`, `delivered:false` |
| 3 | A KEYED run can still stall at the P6 DoD gate | claimed in `346_e3` §9.1; **not reproduced** (0 keyed calls) — the gate itself is real |
| 4 | No OS isolation | `isolation:{sandbox:false,kind:"none",docker:false,bwrap:false}` |
| 5 | `requiresHumanResume`/`shouldAutopause` unwired | `watchdog.ts:6-7` says no production consumer; `store.ts:1431/1464` does not gate on it |
| 6 | Cross-family failover unimplemented | symbols appear only in comments/`registry-failover.test.ts`; every role tiers to `deepseek` |
| 7 | Console run records no spend | grep `tokenUsage` in `store.ts` → 0 writers; only `headless.ts` `accumulateSpend` writes it |
| 8 | Human acceptance stamp | `humanFixturesFromProject` needs `decidedBy:"human"` |
| 9 | Tree-lane probe modest | stands; SB-2 parity landed (this wave) |
| 10 | "Delivered" proves a commit, not a rebuilt/tested artifact | the deliver step is `emit --project … --out … --git` — **no `--run`/`--check`** |
| 11 | P7–P12 reachable only after a green P6 | `phases.ts:126-132` strictly linear `canEnter` |

Incidental: the audit observed the orchestrator suite **transiently red** (10th test, `alpha.status`),
caused by a whole-map state overwrite on concurrent ticks; a `dirtySlugs` lock-commit fix landed in the
same wave (`factory-watch.mjs`), and the suite is now 10/10 on both runtimes.

## Prioritized work plan (what is left for the claim)

- **P0-1 Definitional** — the flag requires a human-approved fixture row; either land a machine-verifiable
  acceptance path with its own attributable seat/stamp (and update the bar + dod provenance rules without
  weakening the forgery guards), or stop asserting autonomy. `doctor.ts`, `policy.ts`, `dod.ts`, `handoff.ts`.
- **P0-2 Keyed P6 reliability** — model synthesis must reliably satisfy the P6 DoD
  (`p6-arch`/`p6-test`/`p6-verified`), else keyed runs stall and nothing delivers. `codegen.server.ts`,
  `verify.server.ts`, `dod.ts`, `scaffold.ts`.
- **P0-3 Strengthen delivery proof** — add tree re-run/verification to the deliver step (or persist the P6
  tree-run verdict hash) so "delivered" proves a rebuilt/tested artifact, not just a commit.
  `factory-watch.mjs` deliver step + `rapidtool-cli.mjs` `emit` flags + `headless.ts`.
- **P1-4 Isolation** — a real sandbox/isolator; `doctor` reports it only when one executes.
  `node-runner.server.ts`, `exec.ts`.
- **P1-5 Console-run spend metering** — a server-side spend tap writing `tokenUsage`; `store.ts`,
  `chat.server.ts`/`rt-client.ts`.
- **P2-6 Wire the watchdog seams** — gate the store resume branch on `requiresHumanResume(stallLatch)` /
  `shouldAutopause`; `watchdog.ts` + `store.ts` + `headless.ts`.
- **P2-7 Cross-family failover** — registered second-family descriptor + transient router + served-provider
  provenance on `LlmResult` (owner-gated on keyed evidence).
- **P2-8 P7–P12 coverage** — execute/unblock the tail or keep the honest "N of 13 / M artifacts" report.
- **P3-9 Scheduling + land the wave** — the host hook is the scheduler by design; fill the validator's gate
  section and commit (done for this wave).

## Residual uncertainty

Keyed behaviour was not reproduced (mandate: 0 keyed calls). Keyed log claims (a real delivery commit
`976afe8`, a keyed `RT_E_GATE_PENDING` stall, keyed multi-job substance) are unverified here. The full
gate was not run by the auditor (run centrally). The tree moved under the auditor (parallel lanes).
