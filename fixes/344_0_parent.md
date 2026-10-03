# 344 wave (W58) — whole-codebase audit, honest remaining-work list, and work plan

**Method:** 4 read-only whole-codebase auditors (A1 core pipeline · A2 model/verification · A3 UI/client ·
A4 process/infra/docs/tests) + **2 independent validators** (V1 core+model, V2 UI+process+cross-cutting)
who re-derived the findings and hunted for what was missed. HEAD `4bd1988`, clean tree, 1926 tracked.
Nobody edited source during the audit; the only writes were the six logs. Logs: `fixes/344_a1_core.md`,
`344_a2_model.md`, `344_a3_ui.md`, `344_a4_process.md`, `344_v1_validate.md`, `344_v2_validate.md`.

**Validator trust assessment (theirs, not mine):** A3 and A4 are trustworthy as written (no false
positives, no fabricated evidence) subject to corrections; ≈75–80% of A1/A2 is trustworthy verbatim —
observations are non-fabricated, but about a quarter need severity de-rating, and one proposed
remediation was itself ineffective. Those corrections are applied below.

## 1. THE VERIFIED BLOCKER LIST (what actually stands between RapidTool and "autonomous software factory")

Validator V2's cross-cutting verdict, corrected and de-duplicated:

| # | Blocker | Evidence | Kind |
|---|---|---|---|
| **B1** | **The verifier can be defeated by the module it verifies** — a module that throws on load and exports nothing can schedule lookalike `HARNESS_EXPORTS`/`HARNESS_COMPILE pass` lines on stdout; the last-wins parse accepts them → `status:"passed"` → mints `lastTest{label:"tested"}`. Confirmed by A2, V1 and V2, each with an independent reproduction. | `verify.server.ts` harness + `runCases` parse | **DEFAULT — FIXED THIS WAVE (§4)** |
| **B2** | Human-acceptance door is required **by design** — `autonomousSoftwareFactory` needs a `decidedBy:"human"` fixture approval; the machine must not set its own bar. The literal zero-human claim is unreachable. | `doctor.ts:520-523`, `policy.ts:155-162` | Governance decision — fix the *claim*, not the gate |
| **B3** | **No walk-away orchestrator** — no scheduler/daemon/queue exists; `unattended` is explicitly "NOT a daemon" and `emit --git` is opt-in, so "walk away and it ships" needs an operator-authored hook plus a manual emit; one project at a time. | `README-cli.md:1004-1008`; no scheduler in `src/lib` | Real gap |
| **B4** | **Synthesis quality** — keyed pass@1 0.182 (342 measure) → **0.364** with the new best-of-N lever (343 measure, §5). Still short of a passing product on every brief. | §5 eval | Capability (model output) |
| **B5** | No OS isolation — the node-runner is a bounded runner, not a sandbox. | `doctor.ts` `runnerIsSandbox:false` | Declared limit |
| **B6** | Single provider / failover unarmed — the chain is resolved but refuses loudly; `probeProviderModels` has zero production consumers. | `registry.ts:740-763` | Resilience gap |

Polish, **not** blockers: doc drift, `strictPort`, CI, the formatter gate, coverage debt, the flake class,
MCP owner-gating, redaction scope, fingerprint injectivity.

## 2. FINDINGS BY SEVERITY (consolidated, validator-corrected)

### Critical
- **C1 = B1** verifier verdict forgery — **fixed this wave**.

### High
- **H1** Placeholder acceptance oracle: `fixtureMatchHelperSource` returns `true` for `<draft>`/`<any>`, so
  an approved fixture set can be vacuous yet score M1/M2 green (`brief-fixtures.ts`, `scaffold.ts`).
  **Fixed this wave.**
- **H2 = B3** no orchestrator (above).
- **H3** Docs claim the CLI does **not** read `.env` (`README.md:142-144`, `.env.example:14-16`,
  `README-cli.md:349-351`) while `rapidtool-cli.mjs:624-670` reads `<cwd>/.env`; the same file documents
  the true rule at `:74-118`. Credential-precedence hazard.
- **H4** `authMiddleware` (`auth/middleware.ts:28`) has **zero importers** while `isolation.server.ts:29`
  claims enforcement; 12 `createServerFn` sites mount no middleware. *(V2 correction: the isolation half
  `assertSameSiteRequest` **is** wired at `app-data/client.server.ts:4,202` → de-rated to Med.)*
- **H5 = B2** human-acceptance door (above; claim-level).

### Medium
- **M-A** Unwired verification seams: `verifyPriorPhases` (E-19 regression-drift) has no production caller
  (`engine.ts:3620`); the A7 oracle case seeds (`dod.ts:1110/1121`) are test-only and never feed the
  verify run (`pinnedOracleIds` un-passed) — so E-19 does not exist at runtime and seeded oracle cases
  are not pinned **(V1: PARTIAL — the mirror wiring exists, it is just un-fed)**.
- **M-B** The console wild driver executes with **no plan review** (`stageWildPlan` is a browser no-op
  without a planner), so R13-f02's "no execution without an approved plan" is vacuous on the UI path
  (`store.ts:1357`).
- **M-C** **Mutation-invisible guards** — guards whose tests cannot fail: `engine.ts:5137/5220/1813`,
  `store.ts:542` (A1-05); plus V1's misses: `checkpointAdmits` never validates `savedAt`
  (`checkpoint.server.ts:407`), the `runGate` unregistered-phase guard (`dod.ts:864-877`, throws a bare
  `TypeError`), `node-runner.server.ts:317-319` finite-timeout clause, `maker-score.ts:900` empty-set rule.
- **M-D** The console stall latch never clears: `clearStall` (`rt-client.ts:359-363`) has zero production
  callers, so one ≥10 s lag pins a `<Stalled>` row into localStorage across runs and reloads (A3-02).
- **M-E** Unwired features with real consumers absent: `plugin.ts` (T5.5 hook registry), `compaction.ts`
  (T-107.9), `watchdog.ts` decision math (`watchdogDecision`/`shouldAutopause`/`requiresHumanResume`), the
  auth UI subtree (also a **dangling `/login`**: no route file exists), `chat.ts` streaming, the console
  fixture-approval seat, and `swarm.ts`'s DAG/loop-back layer (A3-03/04/05/06/08/17/18).
- **M-F** Doc drift batch (A4's table): exit-code taxonomy missing **5**; "no git landing / no
  checkpoint-resume" false; "*every* fresh `emit --run` is unverified" false (observed
  `declaredScriptsVerified:true`, exit 0); auth migration never applied (non-recursive `migrate.mjs`);
  "1030 pre-existing" scripts typecheck errors (actual **0**); suite/module counts stale (93→112,
  46→49, 22→24, 1908→1926); `START-HERE.md` still lists delivered features as in-progress;
  `AGENTS.md:18` says the dev server binds `0.0.0.0:8080` (it binds loopback); `.env.example` misses 6
  live knobs; `README-cli.md` RT_E status notes stale (`RT_E_GIT_UNAVAILABLE`, `RT_E_MCP_DISABLED` have
  live emitters now); CI pin comment false (host is v24.15.0); session-start baselines stale in
  `AGENTS.md`/`RESUME.md`/`remainingwaves.md`/`taskuniverselog.md`.
- **M-G** Process/tooling: `strictPort` on 8080/8081 blocks a second `npm run dev` (a lane hit it);
  prettier ships unenforced (no `format:check` in `gate.sh`, `.prettierignore:6-8`); the GitHub workflow
  has never executed and cannot catch the Windows-path class; module-coverage allowlist covers the whole
  Better Auth surface + dead barrels (`app-data/index.ts`, `multiplayer/index.ts`); a load-sensitive
  child-spawn flake class (`exec.test.ts` grandchild; 343-3's interim `landEmittedTree` red under load).
- **M-H** transport/policy: the retry set differs (`{429,500,503}` vs `{429,500,502,503,504}` — V1:
  Info); three paths still use the undici `fetch` (tavily/harvest/probe) in the in-tick-exit crash class
  (V1: PARTIAL, crash unreproduced).

### Low / Info
Redaction covers only `DEEPSEEK_API_KEY` (A2-F6); `knowledge.fingerprint` delimiter is non-injective
(A2-F7); MCP trusts the server's `readOnlyHint` (A2-F8); dead exports (`crewToReport`,
`RT_E_NOT_IMPLEMENTED`, `token-ledger` helpers, `dod.ts:1098`, `planning.ts:375`, `fixtures.ts`
readers); `io.ts:486` too-large import returns no code; `token-ledger.ts:575` throws a bare `Error`
(loses `.code`); `runGate.evidenceHash` covers verdicts only (**documented limit → Info**); the console
`approve()` mints `decidedBy:"human"` without a token (untagged-tolerance path; Info); `salvageTrim`
bounds only logs/chatLog; rail badges bleed ~11 px at ≥1024 (A3-14); a seeded demo build reads as user
data (A3-13); dead `rt-events` constants.

## 3. THE FULL WORK PLAN

**P0 — restore the factory's core promise (blockers).**
1. ✅ **C1** unforgeable verdict channel in the harness (this wave).
2. ✅ **H1** kill the placeholder acceptance oracle (this wave).
3. **B3/H2 orchestrator:** ship a documented host-hook recipe + a `factory/watch` wrapper that drains
   briefs through `unattended` → `emit --git` with a checkpoint per project (or explicitly scope the
   daemon out and say so in `README`). *(M–L)*
4. **B2/H5 claim honesty:** make `doctor` state the machine-complete ceiling in words (it already exposes
   `awaitingHumanAcceptance`); never let a machine mint `decidedBy:"human"`. *(S)*

**P1 — honesty & claims (cheap, high trust value).**
5. Fix the doc-truth batch (M-F) with the "Corrections in force" convention; re-derive every count; fix
   `.env.example` (6 knobs) and the three `.env`-precedence claims; state the 0/1/2/3/4/**5** taxonomy in
   `README` **and** `AGENTS.md`; correct the deploy/migration story (copy-up step). *(S)*
6. **H4:** wire `authMiddleware` or strike the enforcement claim, and add a guard test *(owner decision:
   the repo pins 12 server fns with no middleware — a posture choice)*. *(M)*

**P2 — wiring gaps (make built things reachable).**
7. Wire or strike: `verifyPriorPhases` (E-19) and the A7 oracle pins (M-A); the console plan gate (M-B);
   `plugin.ts`, `compaction.ts`, `watchdog.ts` drivers, the auth UI + `/login`, `chat` streaming, the
   console seat, `swarm` sub-features (M-E). Each: wire with a real consumer **or** delete and strike the
   doc — no third option. *(M each)*

**P3 — verification teeth (protect the fix from regression).**
8. Add the missing pins for every mutation-surviving guard (M-C: 4 in A1 + V1's 4) and the three UI
   test-teeth gaps (A3-10/11/12: artifact cap, Long-Tasks floor, fingerprint participation). *(S each)*

**P4 — polish & resilience.**
9. Console: clear the stall latch (M-D), prefer run rows over diagnostic scopes in the now-line (A3-01),
   fix the rail bleed, label the demo seed. *(XS–S)*
10. Transport/policy: one transient-retry set; migrate the remaining undici call sites; extend redaction;
    length-prefix the knowledge fingerprint; document the MCP trust boundary. *(S)*
11. Infra: honour `PORT`, add `prettier --check` to `gate.sh`, fix the CI pin comment / decide the Windows
    leg, root-cause the child-spawn flake, propose the dead-barrel deletions. *(S–M)*

**Explicitly not worth doing:** re-architecting chat around streaming while the provider is one-shot;
browser-side quarantine controls without a server emit seam; deleting the honest shell-surface
disclosures; removing the legacy `untagged ⇒ true` tolerance (would retro-fail pre-216o payloads).

## 4. FIXES LANDED THIS WAVE

**C1 (Critical) — verifier verdict forgery: FIXED.** Authority moved off stdout onto a dedicated **fd 3**,
authenticated by a **per-run nonce delivered out-of-band on the child's stdin** (`runCases` reads only
`run.verdict`; stdout is non-authoritative detail). Unforgeability rests on: a separate stream (the
`console.log` forgery has nowhere to land; a stdout `ORACLE_RESULT` is treated as impersonation), an
out-of-band nonce (discovery: `process.execArgv` exposes the `-e` program, so any secret embedded in the
harness bytes is module-readable — stdin avoids it), an IIFE-local nonce (a top-level `-e` const IS
visible to `new Function`, an IIFE local is not), real writers captured before the module runs, and
fail-closed on a closed fd / `process.exit` / a failed write. RED (forgery admitted, `status:"passed"`,
`tested` minted) → **GREEN 8/8**: throwing module, plain lookalike, module-written fd-3 line without the
nonce, and a module hooking `fs.writeSync` to harvest the nonce are all refused; the genuine-green control
still passes and mints `tested`. 147/147 owned + 224/224 `codegen` (read-only) + 19/19 `exec`, both
runtimes; `tsc` 0. Residual: the harness is bounded, not a sandbox (declared, B5).

**H1 (High) — placeholder acceptance oracle: FIXED.** The always-true sentinel branch
(`if (expected === "<any>" || "<draft>") return true`) is deleted; `compileFixtureAssertion` red-cards a
placeholder case; `approvedAcceptanceFixtures` returns `null` for a placeholder-only approved set (the
emit guard then refuses byte-identically to no-fixtures); the approval gate reports `placeholderIds`; and
`maker-score` reads the project's own fixtures to force **M1=0/M2=0** for a vacuous bar. Provenance is
untouched (a sentinel can still be approved, it is simply inert), and the real path is unweakened (real
typed-literal fixtures still score 1/1). RED 204/209 → **GREEN 209/209**, both runtimes; adjacent
read-only consumers 460/460 + 176/176; the CLI fixtures suite 4/4.

**Two low residuals STOP-and-REPORTed:** `headless.ts:3241` should say *placeholder/refused* rather than
*fixtures pending*; `fixtures.ts` `fixtureAcceptanceState` still reads a placeholder set as
`human-approved` (durable fix, not required for correctness).

## 5. KEYED MEASUREMENT — the 343 best-of-N lever
`P6_SYNTH_CANDIDATES=2` keyed eval over 11 fixtures: **pass@1 mean = 0.364 (4/11: date-rrule-library,
field-ops-suite, permit-inspection-tracker, showing-booking), mean 6.45/9**, flaky=none, grader
leaks=none — versus the 342 N=1 baseline **pass@1 0.182 (2/11), mean 6.09/9**. The lever measurably
raises the factory's own grade.

## 6. LOG INDEX
`344_a1_core.md` · `344_a2_model.md` · `344_a3_ui.md` · `344_a4_process.md` · `344_v1_validate.md` ·
`344_v2_validate.md`.
