# 219c — PARENT-RECOVERY NOTE (read this first)

Lane 3 ran out of tool-call budget mid-investigation and could not write this file; it
explicitly asked that its body be pasted verbatim. **Everything below the rule is the LANE's
own content, unedited** — the parent added only this header and the file write. Every anchor in
it was read by the lane on 2026-09-24; its §7 states the verified / traced-not-run / UNVERIFIED
splits honestly (this host has NO model key).

- lane: W13 lane 3, persona "autonomy blockers" · delegation `deleg_b77255e7`, task-2
- source of this text: `%LOCALAPPDATA%\hermes\cache\delegation\subagent-summary-2-20260924_112728_009347.txt`
- full tool transcript: `%LOCALAPPDATA%\hermes\cache\delegation\live\deleg_b77255e7\task-2.log`
- lane scratch: `C:/Users/mnril/w13l3_scratch/`

---

# 219c · Autonomy blockers — why `autonomousSoftwareFactory` is false, traced to code

*Lane 3 of the W13 state-of-the-factory inquest. All anchors read 2026-09-24. Keyless host (`llm.configured:false`) — every keyed behaviour is traced-in-code, labelled **traced-not-run**.*

## Bottom line (plain language)

RapidTool is not an autonomous software factory today for two independent reasons, and only one of them is a defect. First, the factory claim is latched to four pieces of evidence (`src/lib/doctor.ts:218-224`), and **two of those four — human-approved fixtures and product-complete — have no producer anywhere in the codebase**: only a unit test can set them (`doctor.test.ts:81-92`). Second, even granting the evidence, an unattended keyless run **stops dead at phase 4** — I ran it: `gate --autopilot` parks at P4 (exit 2) and `wild --start` pauses with `"Classifier not configured."`. That P4 stop is *policy*, not breakage: `STOCK_HITL = [4,5,8,9]` (`phases.ts:151`) makes those four gates human-only for the headless driver by design. The single highest-leverage blocker is **the missing model key**: it is the only input that lifts P6 off the deterministic placeholder (which fails brief-fit *by construction*, `engine.ts:2896-2897`) *and* the exact switch that lets Wild Mode cross the four stock gates it otherwise pauses on. Without a key, no amount of engineering produces a real app; with one, one env var changes both the artifact ceiling and the loop's reach.

---

## 1. The latch, decoded

`src/lib/doctor.ts:211-236` — `factoryClaim(evidence, env)`:

```ts
const autonomousSoftwareFactory =
  leftover === false &&
  evidence.humanFixtures === true &&
  evidence.realMultiJobProduct === true &&
  evidence.productComplete === true &&
  isolation.sandbox === false &&
  gaps.length === 0;          // doctor.ts:218-224
```

Support lines: `leftover` is `evidence.leftoverJobsAreReexportsOrStubs !== false` (`:215`) — **absent reads as leftover**. `gapsOf` (`:190-201`) pushes one string per unmet field; `FACTORY_GAP` (`:183-188`). `RAPIDTOOL_FACTORY_EVIDENCE` (`:175-181`, frozen) is the live-truth bag: `leftover:true, humanFixtures:false, realMultiJobProduct:false, productComplete:false`. `doctorFactory()` (`:260-264`) = `factoryClaim(RAPIDTOOL_FACTORY_EVIDENCE, env)` → **always false**. `isolation.sandbox===false` is a tautology in practice — `coerceIsolationClaim` returns the frozen honest claim unconditionally (`sandbox-policy.ts:41-43`), so that term can never block; it exists to stop a hostile `sandbox:true` blob minting a claim.

**Live proof (ran today):** `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor` → exit 0, `autonomousSoftwareFactory:false`, all four gaps verbatim, `inventory:null`, `tokenCap:null`, `isolation{sandbox:false,kind:"none",docker:false,bwrap:false}`, `runner{available:true,sandbox:false}`.

**Wiring:** the latch IS live — `headless.doctorStatus` (`headless.ts:3200-3219`) dynamic-imports `doctor.ts`, calls `doctor.doctorFactory(process.env)`, and with `--tree <dir>` scans job sources (`collectJobSources` `:3094-3118`) → `inventoryFromJobSources` → `evidenceFromJobInventory` → `factoryClaim`. CLI surface: `rapidtool-cli.mjs:2768`. (fixes/210's "residual: parent still hardcodes" is closed by fixes/214.)

## 2. The four gaps, each traced

| Gap string (`doctor.ts:184-187`) | What it tests | What would clear it | Producer exists? |
|---|---|---|---|
| `leftover jobs are reexports or TODO(E-15) stubs — not a multi-job product` | `leftover !== false` (`:196`) | every `src/jobs/*.ts`/`jobs/*.ts` classified `real` (`classifyJobSource` `:65-83`: `TODO(E-15)` or `throw new Error("TODO…")` → `stub`; all-statements-reexport → `reexport`) | **Yes** — inventory path (`evidenceFromJobInventory` `:157-172`) |
| `no human-approved fixtures (decidedBy:"human")` | `humanFixtures !== true` (`:197`) | an evidence bag with `humanFixtures:true` (`:166`) | **NO** — `grep -rn humanFixtures src scripts` (non-test) hits **only** `doctor.ts`; no runtime mint |
| `no real multi-job product` | `realMultiJobProduct !== true` (`:198`) | ≥2 real jobs **and** zero stubs/reexports (`:162`) | **Yes** (inventory path) |
| `product-complete bar not met (skip≠green; stubs≠complete)` | `productComplete !== true` (`:199`) | `extra?.productComplete === true && realMulti && !leftover` (`:167`) | **NO** — only caller `headless.ts:3207` passes **no** `extra` |

**Answer to the lane's question:** the latch is **attainable in shape but blocked in fact, by two different classes.** `doctor.test.ts:81-92` proves `factory=true` when all four fields are hand-supplied. But (a) gaps 2 and 4 are **unwired** — no product path can set `humanFixtures`/`productComplete`; and (b) gap 3 is **keyless-unattainable**: the deterministic P6 floor fails `p6-brief-fit` by construction (`engine.ts:2896-2897`), so a real multi-job product cannot be produced without a key.

**The fixtures gap's real provenance model** (why it is unreachable): `brief-fixtures.ts:18-21` — every drafted case is born `approval:"pending"`; `fixtureApprovalGate` (`:553-563`) only *reads*; `approveFixtureCases` (`:588-611`) is the ONLY writer of `"approved"` and **never defaults `decidedBy`** (`:594`, `:608` "deliberately omit decidedBy — never mint decidedBy:human"); the CLI verb calls it **with no opts** (`rapidtool-cli.mjs:939` → `bf.approveFixtureCases(current, ids)`). So `decidedBy:"human"` is never stamped on a fixture by any shipped path — the gap string names a condition the product cannot currently satisfy.

## 3. The keyed dependency — what the missing key disables

**Provider floor:** `llm/providers/registry.ts:31` — *"no key ⇒ the provider returns `{ ok:false, reason:"not-configured", code:"RT_E_LLM_NOT_CONFIGURED" }` before any network I/O. The registry NEVER fabricates model text."* Implementation: `llm/providers/deepseek.ts:309`. Probe: `llm.ts:71-74` (`isDeepSeekConfigured()`).

**Engine default:** `keyedDeepSeekConfigured()` (`engine.ts:1802-1808`) is a plain `process.env.DEEPSEEK_API_KEY` trim read; `engine.ts:1884-1885` sets `enforceDod: typeof input.enforceDod === "boolean" ? input.enforceDod : keyedDeepSeekConfigured()`. **Live proof:** `create` printed `"enforceDod": false`.

**P6 (the artifact ceiling):** `upgradeP6Keyed` (`engine.ts:2851-2887`) — *"Keyless ⇒ the input reference is returned unchanged (byte-identical legacy call)."* `codegen.server.ts:2423 liveP6Synthesis` (header `:1-40`) upgrades the placeholder (`sandbox.ts buildPhase6Module`) to a brief-faithful, machine-verified module; step 0: not configured → return the same reference. Keyless P6 = placeholder that **fails `p6-brief-fit` by construction** (`engine.ts:2896-2897`).

**Other keyed seams (all return `RT_E_LLM_NOT_CONFIGURED` keyless):** `verify.server.ts:788` (the machine verify loop), `chat.server.ts:525,595`, `crew.server.ts:935,1052,1150,1248`, `algo-tools.ts:109,125,233,250`, `vector.ts:934` (deterministic geometric fallback), `subagent.ts:517-520` (*"nothing dispatched, nothing fabricated"*). CLI exit-3: `rapidtool-cli.mjs:127-128` pins the code when `exitCode===3`; example site `:1725-1743` (prompt verb).

**Wild Mode's judgment layer:** `wild-mode.server.ts:256-264` — the Auto-Review Supervisor is **configured-only**; unconfigured returns `RT_E_LLM_NOT_CONFIGURED` and the engine falls back to the deterministic DoD floor *for advance decisions only* (`engine.ts:3470-3488`); at an **open gate** it must not fabricate a judgment, so it **pauses** (`:3522-3530`).

**How much is disabled:** generation (brief-faithful P6), machine verification, prompt expansion, chat/crew/algo-tools/vector model calls, subagent dispatch, and every *qualitative* gate review. **Not** disabled: the 13-phase deterministic engine, DoD gates, scaffolding/tree emission, the bounded runner, and evidence-based DoD advance decisions. **Could anything keyless be equivalent? No** — generation needs a model; the keyless path is the honest deterministic floor and it says so. A key is not an engineering gap.

## 4. One unattended run — machine vs human, step by step

**Measured live (keyless, scratch project `C:/Users/mnril/w13l3_scratch/probe.json`):**

| # | Step | Decides | What stops it | Anchor |
|---|---|---|---|---|
| 1 | P0–P3 run + auto-continue | machine | nothing (`hitl:false`) | `phases.ts:6-37`; `headless.ts:522` |
| 2 | **P4 run → parks** | machine | `STOCK_HITL` includes 4 → `canAutopilot` false | `headless.ts:346`; `phases.ts:151`, `:38` |
| 3 | P4 approve | **HUMAN** | non-TTY approve refused without `--i-am-human`; policy `hitl.approve` | `rapidtool-cli.mjs:531-547`; `policy.ts:88-92` |
| 4 | P5 run → parks | machine | `STOCK_HITL` | `headless.ts:346` |
| 5 | P5 approve | **HUMAN** | idem | idem |
| 6 | P6 synthesis | machine (keyless floor) | keyless → no `liveP6Synthesis`; placeholder fails brief-fit | `engine.ts:2856`, `:2896-2897` |
| 7 | P7 research | machine | keyless corpus absent → gate unmet | live gate census (below) |
| 8 | P8 run → parks | machine | `STOCK_HITL` | `headless.ts:346` |
| 9 | P8 approve | **HUMAN** | idem | idem |
| 10 | P9 run → parks | machine | `STOCK_HITL` | `headless.ts:346` |
| 11 | P9 approve | **HUMAN** | idem | idem |
| 12 | P10 | machine | nothing | `phases.ts` id10 `hitl:false` |
| 13 | P11 run → parks | machine | `schedule.extraHitl` includes 11 | `engine.ts:1109-1116`; live `extraHitl:[11]` |
| 14 | P11 approve | **HUMAN** | idem | idem |
| 15 | P12 seal | machine | keyless → `sealedWithFailures:true`, exit 1 | `headless.ts:669-691` |

**Measured outcome:** 6 `gate` invocations; parks at **P4→P5→P8→P9→P11** (five, not four — `schedule.extraHitl:[11]`, `tightness:9.2`); 5 human-seat approvals (all notes `[seat human-cli-i-am-human] out-of-band RT_HUMAN_SEAT_TOKEN verified`); final `gate` → **exit 1**, `status:"complete"`, `currentPhase:12`, `sealedWithFailures:true`, `code:RT_E_GATES_FAILED`, census `P6(Machine verification promoted a tested verdict …, Brief-conformance: required brief nouns appear as identifiers …); P7(Live research corpus exists for P7 (≥1 fetched finding))`. Then `emit` → exit 0, 17 files, `kind webapp`, `moduleEmbedded:true`.

**Two honest caveats:** (a) the P12-complete run was **attended** — I presented the human seat; the only *truly unattended* runs I proved are `gate --autopilot` → parks at P4 (exit 2, 5 steps) and `wild --start` → `outcome:"paused"`, `steps:1`, **`note:"Classifier not configured."`**. So unattended, today, the machine stops at P4. (b) P7's red gate is **not** obviously key-blocked — `doctor` reports `research.configured:true, probed:true` (free search reachable), so the empty P7 corpus is a path gap, not a key gap. **Root cause UNVERIFIED.**

**Wild-Mode asymmetry (the key finding):** `wildApproveGate` (`engine.ts:3499-3584`) blocks on **`gate.forceHuman` only** (`:3511`) — it has **no `STOCK_HITL` check** (`grep STOCK_HITL` hits only `headless.ts:346,370` and `phases.test.ts`). So *keyed* Wild Mode can cross all four stock gates via the classifier; *keyless* it pauses at the first one (`:3522-3530`, live-proved). The **terminal** human gate is the failed-P6/reframe `forceHuman` gate: `approveHitl` **throws** `"Autopilot may not approve a forceHuman gate (R3/B-03)."` (`engine.ts:1646-1648`), wild pauses (`:3511-3519`), and `policy.ts:95` makes `hitl.force` `requiresHumanSeat:true`. **"Never mint `decidedBy:"human"` from a machine path" (`policy.ts:4-11`, P0-01 forgery fix) is a feature, not a bug** — the one place autonomy *must* stop is the gate that says "a human rejected this".

> [WD-B · 2026-09-24] CORRECTED (support-grep only; the substantive claim is unaffected): "(`grep STOCK_HITL` hits only `headless.ts:346,370` and `phases.test.ts`)" → the full `grep -rn "STOCK_HITL" src/` set is: `phases.ts:151` (the const), `headless.ts:43,346,370`, the UI-store mirrors `store.ts:20,382,399`, and `phases.test.ts`. **Zero hits inside `engine.ts`** — so the load-bearing point stands: `wildApproveGate` has no `STOCK_HITL` check. — evidence: `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -rn "STOCK_HITL" src/` (WD-B run 2026-09-24). (verified by WD-B, not by the lane)

## 5. The execution floor — what the non-sandboxed runner blocks

`node-runner.server.ts:1-20` header (load-bearing): a *bounded* environment, **not** a security sandbox — wall-clock timeout + tree-kill (`taskkill /T /F` on win32), output caps (`MAX_BUFFER` 1 MB `:60`; `RUNNER_OUTPUT_MAX_CHARS` 48 000 `:78`), a scratch cwd *"a courtesy, not a jail"*, proxy-scrubbed child env (best-effort). **Explicitly absent:** filesystem confinement (*"the child can touch anything the OS user can"*), memory/CPU rlimits, real network denial (*"raw sockets bypass proxy env vars"*). *"Only an OS-level boundary (Docker / WSL2 / Windows Sandbox / AppContainer / VM) contains a determined adversary. Do not run untrusted third-party code here."* Every envelope stamps `sandbox:false` (`:66-68`). `sandbox-policy.ts` freezes the claim (`:24-30`) and `coerceIsolationClaim` ignores `sandbox:true` (`:41-43`).

> [WD-B · 2026-09-24] CORRECTED (anchors only — values and substance confirmed): "`MAX_BUFFER` 1 MB `:60`; `RUNNER_OUTPUT_MAX_CHARS` 48 000 `:78`" → `MAX_BUFFER` is at `node-runner.server.ts:57` (`:60` is `DEFAULT_TIMEOUT_MS`); `RUNNER_OUTPUT_MAX_CHARS` is at `:74` (`:78` is inside the `RunnerOutputClamp` type). "Every envelope stamps `sandbox:false` (`:66-68`)" → the stamp sites are `:49` (the `NodeRunResult` type) and `:53` (the envelope builder). — evidence: WD-B reads of `src/lib/node-runner.server.ts` (:49, :53, :57, :74) 2026-09-24. (verified by WD-B, not by the lane)

**Host probe (I ran it today):** `which docker bwrap` → *no docker / no bwrap*; `docker --version` / `bwrap --version` → *command not found*; `wsl.exe -l -v` → *"Windows Subsystem for Linux has no installed distributions."* — **independently reproduces** the recorded W11-L2 verdict (`taskuniverselog.md:513`: *"T-107.8: NO isolator on this host (docker/bwrap → exit 127; WSL enabled but no distros)"*). Note: the decision register's drop-in slot still reads `[W11-L2 PROBE RESULT — UNKNOWN at write time …]` (`fixes/217c:592`) while `:19` still says *"outcome UNKNOWN, awaiting W11-L2 host probe"* — the register was never updated with the settled result.

**What that blocks, unsoftened:** (a) executing generated/emitted code as trusted self-verification is **unsafe by doctrine**, not merely unsupported; (b) **E2E of a running emitted app** needs a browser driver + dev server on a bigger surface than today's bounded child — `fixes/217c:580-590` forbids describing such a run as sandboxed and names the honest ceiling as *"builds and tests"*, never *"E2E"*; (c) no containment of a hostile tree (fs/rlimits/network). **What it does NOT block:** compile-check + `treeRun` (per-file parse verdicts + emitted spec files + one kind-entry smoke) inside a bounded child — that *is* today's verification floor (`emit --run` / `tree-run` / `repair`).

## 6. Ranked blockers

| Rank | Blocker | Code anchor | What it costs | Class |
|---|---|---|---|---|
| **1** | **No model key** — P6 floor is a placeholder that fails brief-fit by construction; every qualitative review refused | `engine.ts:2856`,`:2896-2897`; `codegen.server.ts:2423`; `wild-mode.server.ts:264`; `verify.server.ts:788` | access + tokens | **a KEY** (zero engineering) |
| 2 | Stock HITL gates `[4,5,8,9]` + `schedule.extraHitl` are structurally human-only for the headless driver | `phases.ts:151`; `headless.ts:346,370`; `engine.ts:1109-1116` | 5 human stops per run | **product decision** (by design; wild crosses them *only keyed*) |
| 3 | Fixtures gap has **no producer** — no path stamps `decidedBy:"human"` on a case | `doctor.ts:166`; `brief-fixtures.ts:594,608`; `rapidtool-cli.mjs:939` | build the human-approve surface **+ a human click** | **engineering + human** |
| 4 | `productComplete` has **no producer** in the evidence bag | `doctor.ts:167`; sole caller `headless.ts:3207` passes no `extra` | wire a real product-complete producer | **engineering** |
| 5 | No isolator on this host | `node-runner.server.ts:14-19`; `sandbox-policy.ts:21-22`; live probe + `taskuniverselog.md:513` | an OS boundary (Docker/WSL2/VM) + a policy call | **product decision + host** |
| 6 | Definitional tension: the latch certifies "autonomous" via `humanFixtures` — a **human** artifact | `doctor.ts:220`, `:185` | decide whether that is the intended bar | **product decision** |

**Single highest-leverage blocker: the missing model key (`DEEPSEEK_API_KEY`).** Defence: it is (a) the only input that lifts artifact quality off the deterministic placeholder — live-proved, P6 seals red by construction keyless; (b) the exact switch that turns Wild Mode from *"pauses at the first stock gate"* into *"crosses all four stock gates via the classifier"* (`engine.ts:3499-3531` has no `STOCK_HITL` check); (c) free of engineering cost. The gate policy is the thing that *stops the loop*, but it is a documented feature; the key is the thing that determines whether what the loop produces is a product at all.

## 7. Provenance / honest limits of this dossier

- **Verified today:** every `file:line` above; all live CLI outputs (doctor / create / gate ×7 / approve ×5 / wild --start / emit); the host isolator probe; `taskuniverselog.md:513`; `fixes/210`, `214` logs; `doctor.test.ts:22-183`.
- **Traced-not-run (no key):** `liveP6Synthesis`, `verifyAndFixServer`, the keyed Wild classifier, chat/crew/algo-tools/subagent model calls — read in code, never executed.
- **UNVERIFIED:** (i) the root cause of P7's empty corpus (free search probes true, so it is likely a path gap, not a key gap); (ii) whether `archProductComplete` (`dod.ts:232`) feeds any `FactoryEvidence` — verified only that `evidenceFromJobInventory` never mints `productComplete`; (iii) `emit` exited **0** on a `sealedWithFailures:true` project when invoked without `--run` — exit-code semantics for a red-sealed emit were not fully traced.
- **Gotcha recorded:** the first `create` with an MSYS path wrote to `C:\c\Users\...`; use Windows-style paths (`C:/Users/...`) for CLI `--out`/`--project`.

