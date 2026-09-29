# fixes/311_sd_product.md — RESCUED from the SD-Product auditor's final summary (write step hit the cap; content verbatim)
# SD-PRODUCT — kinks, usability, pay-worthiness, the good-vs-bad-code mechanism audit

## ⚠️ Status first (honest)
**`fixes/311_sd_product.md` was NOT written** — I exhausted my tool-call budget on evidence-gathering (the mechanism trace was deep: dod.ts, compile-check.server.ts, headless.ts repair seam, run-eval graders). Everything below is real, byte-traced, from **keyless / no-keyed-call** runs in `~/rt311_sd`. A follow-up turn can land the file verbatim from this summary.

## Environment hazard found (affects siblings)
The `terminal` shell is **shared across auditor sessions** — cwd raced mid-run (jumped to `research/eval-out`, then `rt311_da1`), and MSYS→node path translation turned `"/c/..."` into `C:\c\...` (MODULE_NOT_FOUND). Siblings using relative paths or `/c/` args will break silently.

---

## 1. KINKS (file:line + what the user hits)

| # | Kink | Bytes | Severity |
|---|---|---|---|
| K1 | **Both approval doors are mutually exclusive** → an autonomous agent can **never** finish a 13-phase run. Non-TTY `--i-am-human` is refused; `gate --autopilot` refuses every stock gate. | `rapidtool-cli.mjs:3811-3819` (`isTTY!==true` ⇒ error) + `headless.ts:536` `if (STOCK_HITL.includes(phase)) return false` + `phases.ts:151` `STOCK_HITL=[4,5,8,9]` | **Blocker** |
| K2 | **A bare `approve` on a TTY silently mints `decidedBy:"autopilot"`** — the ternary falls through to the harness seat when `--i-am-human` is absent, so a human approving a *high-stakes* P4 gets a machine-attributed ledger row. | `rapidtool-cli.mjs:899-908` (`humanSeat ? {...} : { actor:{decidedBy:"autopilot", seat:"harness"} }`) | **High (integrity)** |
| K3 | **`emit --run` exits 0 on a tree that is 100% TODO stubs.** Verified: emitted tree green (`treeRun.ok:true`, compile 11/11, `tests/oracle.spec.ts` pass) while every job module is a 12-line `throw new Error("RT_E_VALIDATION · TODO(E-15) stub…")`. Exit 0 reads as "success" to any driver. | `emitted/src/jobs/{assign,dispatch,schedule,track}.ts` (12 lines each); `emit1.json` `ok:true exit 0`; `doctor --tree emitted` → `stubs:4 real:0` | **High** |
| K4 | **The emitted oracle spec asserts the code CANNOT work** — `await assert.rejects(route(...), /TODO\(E-15\) stub/)`. It *fails the moment you implement the feature*. Anyone running `npm test` on their new tree gets a red that means "you succeeded". | `emitted/tests/oracle.spec.ts:73, 89, 105, 121` | **High** |
| K5 | `approve` non-TTY refusal is **precise but gives no recovery path** for a non-expert (it names `gate --autopilot`, which K1 proves can't pass). | `rapidtool-cli.mjs:864` | Med |
| K6 | `doctor` gaps are machine phrase (`leftoverJobsAreReexportsOrStubs`, `product-complete bar not met`) — honest, not human-readable. | `doctor` envelope `factory.gaps[]` | Low |
| K7 | Onboarding is actually **good**: `create`/`gate` both return `nextAction{kind,cmd,phase,why}` (`create.json`, `gate1.json`). Credit where due. | — | ✅ |

**Journey walk (real):** `create` → `gate` parks at P4 (exit 2) → `approve` refused (non-TTY) → `gate --autopilot` steps 0 and re-parks → dead end. Confirmed twice.

## 2. USABILITY — verdict per persona
- **Non-expert human:** reaches 40% — create/park/emit, then hits a three-way stuck state at the approve ceremony. **Cannot** go brief → built app.
- **Autonomous agent:** **structurally blocked** (K1). Cannot complete a run at all.
- **Top-5 friction:** (1) K1 the approval deadlock; (2) K2 machine-vs-human attribution ambiguity; (3) no "what do I do now" on a coded refusal; (4) K3/K4 green-is-not-good signal confusion; (5) key setup split (browser reads `.env`; **CLI does not** — must export in shell).

## 3. PAY-WORTHINESS — honest verdict
**Not sellable yet.** What a business *would* pay for **today**: a governed, auditable **pre-flight** — evidence-hashed DoD gates, append-only ledger with seat provenance, paste-ready Agent Packet. That's a compliance artifact, worth money to a regulated team.
**Missing (gap list):** real output code (stubs, K3), behavioral proof of the built app, multi-project/portfolio management, auth/multi-tenant, hosting/deploy inputs, billing/metering (token ledger exists but prices ship as `null`), reliability guarantee, and any unattended path (K1).
**Verdict:** *not yet — sellable as a governed pre-flight spec compiler to a compliance-minded engineering team, not as an AI software factory.*

## 4. GOOD-vs-BAD CODE — mechanism by mechanism ⭐

| Mechanism | Where | Verdict |
|---|---|---|
| **DoD gates** | `dod.ts:469-740`, hash `:759-786`, provenance `:108-160` | **Strong mechanism, weak criteria.** FNV-1a evidence hash, actor-truthful approval (newest row, policy-seam re-ask, fails closed on forged seat tags — `:131-160`). But the criteria are **presence/binary**: `hasArtifact(p,1,"graph")`, `p6-source` = `generatedSource.length > 0`. Process conformance, not code quality. |
| **p6-brief-fit / p6-arch** | `dod.ts:619-666`, `archTrace :401-460`, `isStubSource :217`, template-stub byte-compare `:387` | **Medium-strong.** Best quality probe in the set: capability→file identifier mapping, + genuine *stub* detection (TODO markers, byte-identical template floor, out-of-tree reexports). Still **lexical** — `function createBoard(){throw}` satisfies a capability map. |
| **treeRun** | `compile-check.server.ts:1073-1213`; `ok = compile.ok && specsGreen && entryGreen && projectLeg.ok` `:1206` | **Strong as truth-teller, weak as quality gate.** Real: temp-copy (never clobbers), node_modules junction, `node --test` on every spec, tree's own `npm run typecheck/test/build`, fail-closed (no fabricated passes, honest skips `:1190-1197`). **But green ≠ works** (K3/K4), and `entryGreen` accepts a `ui-shell` skip `:1202-1205`. |
| **`checkExpectedBehavior` / `entry-runs`** | `run-eval.mjs:884-971`, spawn `:780-864` (`expectExit`/`expectStdout`/`expectStderr`, bounded timeout) | **STRONGEST mechanism — the only true behavioral oracle.** It runs the emitted entry and asserts observable outcomes. Caveat: **eval-side only** — it never fires on the user's emit/run/repair path. |
| **Graders** (acceptanceBar, expectedFiles/Content, `meanAtLeast`) | `run-eval.mjs:1037-1074`, frozen outside the tree `:1449`, leak check `:2374` | **Strong design** (the agent cannot read the bar it's graded against). Content checks are substring `text.includes(want.contains)` — cheap but real. |
| **Eval scorecard M1-M9** | `maker-score.ts` (pure), driver `run-eval.mjs` | **Medium.** Pure rubric; driver itself admits "CONVERGED but M1=0" anomalies (`:24-27`). The no-balance guard (402 ⇒ *not scored*, fixes/262) is a genuine honesty win. |
| **Repair loop** | `headless.ts:2981-3109` `repairTreeDir`; mint guard `codegen.server.ts:3752-3766` | **Strong — and it really is closed.** red treeRun → tail → `deps.treeFailure` → bounded synthesis repair → apply in place → re-import → re-treeRun; green → mint; budget(3) exhausted → honest `RT_E_REPAIR_FAILED`. Mint is self-guarded (`outcome.ok && ≥1 spec pass && ≥1 executed assertion`). Yes: **a red verdict DOES trigger repair.** |
| **Runtime probe / "500ms health check"** | — | **DOES NOT EXIST — theater/nonexistent.** Grepped `health` across `scripts/*.mjs`, `compile-check.server.ts`, `engine.ts`: only domain-vocabulary hits (`health-ops` brief class). The `Math.max(500, …)` hits (`:780/:976/:1521`) are bounded-runner **inner-timeout floors**. **Correct this out of the report.** |

### THE SUM
> **RapidTool knows what BROKEN STRUCTURE is. It does not know what BAD CODE is.**

Every mechanism on the **product path** is structural: does it parse, does the file exist, does the folder agree with the ledger, is the brief's vocabulary present. The *one* primitive that could distinguish functionally-useless code — behavioral `entry-runs` — is **already built** (`run-eval.mjs:780-864`) and **not wired into emit/run/repair**. And because the emitted oracle tests **assert the stubs fail** (K4), the system's own green light is actively misleading on a tree whose every entry point throws. It is **honest** about this (`doctor`: `stubs:4 real:0`; README: "pre-flight compiler, not a builder") — honesty is not capability.

## 5. MY TWO CENTS ON THE PARENT'S REPORT
- **"No structural blocker remains" — DISAGREE.** K1 is a structural blocker: the two approval doors are mutually exclusive, so *no agent can complete a run*. That's **unreachable**, not unproven.
- **"Unproven not unbuilt" — AGREE for F1** (keyed synthesis genuinely never exercised). **DISAGREE for the quality loop.**
- **"Two vision-gaps (iterate-until-satisfaction, self-mod)" — half-correct.** The system **already iterates** (`repairTreeDir`, budget 3, red→repair→retest). What's missing is a *satisfaction threshold*, and the primitive for it (`entry-runs`) is **already written**. That's a **wiring gap, not a vision gap** — materially cheaper than the report implies. Self-mod **is** a real vision gap.
- **Strike the "500ms health check"** from any mechanism list — it isn't real.

## Ranked product-truth table

| Rank | Kink | Verdict | Severity | Gap |
|---|---|---|---|---|
| 1 | K1 approval deadlock | Blocker | **Critical** | no agent-completable path |
| 2 | K3 stub-green `emit --run` exit 0 | Theater | **Critical** | green ≠ works |
| 3 | K4 oracle asserts stub-fails | Trap | **High** | red means success |
| 4 | K2 silent autopilot on TTY `approve` | Integrity bug | **High** | seat mis-attribution |
| 5 | No behavioral leg on product path | Wiring gap | **High** | primitive exists, unwired |
| 6 | Missing business rails (multi-project/auth/hosting/billing/prices) | Absent | Med | not sellable |
| 7 | K5 no recovery guidance on coded refusal | UX | Med | agent/human stall |

## Top-5 tasks I'd add to the completion list
1. **Unblock the agent path** — legal autopilot route through STOCK_HITL for `--advisory`/unattended projects (or a documented `--seat harness` non-TTY approval). F1 can't be driven until this lands.
2. **Fix `approve` on a TTY** (`rapidtool-cli.mjs:899-908`) — require explicit `--seat autopilot` for machine attribution; never guess the seat.
3. **Wire `entry-runs`-class behavioral assertion into emit/run/repair** — reuse `run-eval.mjs:780-864` as a post-tree-run acceptance leg so green means "the entry ran and produced the declared outcome."
4. **Make `emit --run` self-qualifying** — surface `stubs:N real:M` (doctor already computes it) in the emit envelope so exit 0 can't be read as quality.
5. **Neutralize the stub-fail oracle trap** — mark it loudly in the tree-run verdict / README, or emit the assertion as a skip with the "implement me" signal.

## Files
- **Created:** `~/rt311_sd/{build.json, gate1.json, gate2.json, emit1.json, emitted/**}` (throwaway evidence scratch)
- **Not written:** `fixes/311_sd_product.md` ← owes a follow-up; this summary is the content.