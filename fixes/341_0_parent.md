# 341 wave (W55) — parent / boundary record + the honest 100% evaluation

**Boundary owner:** parent. **Opened** 2026-10-03 at HEAD `2d5ee35`, tree clean. **Six engineers (one
per slice) + three blocker resumes + two independent verifiers + four hole resumes.** Logs:
`fixes/341_1_kinds.md` … `fixes/341_8_verifier-b.md`.

**The question this wave was asked:** *what is preventing RapidTool from being a 100% real, working
autonomous software factory powered by a DeepSeek API key — and what is still not wired?* This record is
the measured answer, including what does **not** work.

## 1. Boundary gates

| Gate | Result |
|---|---|
| typecheck | **exit 0** |
| lint | **exit 0**, 0 warnings |
| assertionGaps | **exit 0** |
| tests | **scripts 414 pass / 0 fail · lib 3152 pass / 0 fail / 2 skipped** (gate of record) |
| build | **exit 0** |
| `gate.sh` | **`ok:true`, `hardFails: []`, `flakes: []`** |

Diff: **30 tracked files, +1938 / −201**, 8 new logs, **0 tracked-file deletions** (verifier audit:
baseline 2087 = current 2087; `git stash` empty).

## 2. What the six engineers settled (each with real keyed/keyless evidence)

- **341-1 emitted product across kinds** — all five kinds emit runnable trees that pass their own
  declared `typecheck`/`test` (and `build` for webapp/game) on the keyless floor; per-kind `main`/`bin`/
  `exports`/`files`/scripts all resolve (15/15 scenarios tree-run green). Found and fixed two real
  emitted-UI drifts (a barrel-entry blind spot; an uncapped field list). **Keyed finding below (§4).**
- **341-2 provider + key path** — fixed the eval driver's stale-key read and its libuv-abort class, and a
  wallet-class misclassification shared by both providers. **Ran the factory's own acceptance scorecard
  keyed for the first time in the record.**
- **341-3 evidence → delivery** — removed a dead export, made `VerifyOutcome.lint` actually render,
  widened the CJS-binding transform to async/generators, closed a junk-`cases` mint, and made
  `packetInputHash` cover `brief`; proved the packet on a real run carries every continuation field.
- **341-4 console** — browser-verified 36/36 assertions at desktop + mobile; corrected two now-false
  on-screen claims; confirmed every pane renders real engine state.
- **341-5 governance** — closed the `coerceFactoryClaim` forge path (a hand-fed blob could set the
  factory latch) and its sibling; fixed a **false-green** in `maker-score`'s M4 (a hollow verdict scored 1
  while the gate refused it); proved the 0.35 bar parity byte-true and the limits honest.
- **341-6 autonomy loop** — proved crash-resume real (SIGKILL → `resume` → `complete`) and closed the
  console/store plan-review dead seam. **Found the "walk away" gap: the `unattended` verb parked forever.**

## 3. The three blocker resumes (the wave's real leverage)

1. **`unattended` is now self-sufficient (341-6).** One `unattended --project` invocation clears the
   stock gates (P4/P5/P8/P9) through the ledgered machine actor and drives to a terminal state — keyless
   (honestly exit 1 `RT_E_GATES_FAILED` on the floor) and keyed (exit 0 `complete`). `forceHuman` gates and
   red DoD gates still park; the default `gate --autopilot` path is byte-identical (proven).
2. **P6 now typechecks before it seals (341-1).** Both the chunked and single-module paths run the
   emitted tree's OWN declared `typecheck` through the real `tsc` seam before accepting it; a typed-red
   artifact is repaired (bounded) or refused with `RT_E_VALIDATION` — never sealed as `tested`.
3. **The P7 stall is an eval-harness gap, not a probe gap (341-2).** `drainPipeline` ties `live` to
   `keyed`, so the keyed eval's post-journey drain never runs the live research layer. Named with the
   exact fix; also measured that the **binding blocker is stochastic keyed P6**, not P7.

## 4. THE DECISIVE EVIDENCE

### 4a. The single unattended command (parent-run, keyed, zero human input)
`create` then **one** `unattended --project` invocation: 7 steps, all stock gates auto-cleared (each with
a `decidedBy:"autopilot"` ledger row, `[seat harness]` note), reaching P6 — where it **refused**:
```
p6.synthesis: LLM module machine-verified · 1 iteration · 10/10 machine-run cases passed on iteration 1
p6.tree.failure: the emitted project's own `npm run typecheck` fail (exit 2) — src/jobs/validate.ts(46,11):
                 error TS2322: Type 'Record<string, unknown>' is not assignable to type 'number'
p6.synthesis.refused: RT_E_VALIDATION · the emitted module fails its OWN declared `typecheck` — refusing
                 to seal a machine-run-green but type-red artifact
```
Terminal: `RT_E_GATE_PENDING`, `sealedWithFailures:true`, exit 1. **Before this wave the factory would
have sealed that type-red tree as `tested`** (machine-run green, compiler red). It now refuses — which
is correct and is why runs stop more often.

### 4b. The factory's own acceptance scorecard (keyed, 11 corpus fixtures)
`npm run eval -- --keyed --out <scratch> --all`:
```
mean 6.27/9 (0.6970) · pass@1 = 0.000 (0/11) · every run hard-stopped at a coded gate
taxonomy: M7 = 0 universally (cold start, no prior — honest); the 10/10 bar (meanAtLeast:1) is
          unreachable on a first run (ceiling 8/9 by arithmetic); dominant synthesis failure is the
          oracle-contract refusal + real emitted TS errors (TS2554/TS2323).
```
A second run with zero code change moved the stop set (mean 5.91/9; P6 stalls 5→6, P7 stops 6→5) — i.e.
**the binding blocker is stochastic keyed P6 synthesis, not any single gate.**

## 5. Honest evaluation — is RapidTool 100%?

**The plumbing is complete, wired, and verified. The product-generation capability is not.**

**Works (evidence above and in the lane logs):**
- One command, zero human input, to a terminal state; every park classified; `forceHuman`/red-DoD never
  cleared; a real ledger row per machine decision (no human stamp ever minted).
- Crash-resume is real (SIGKILL → resume → `complete`); the checkpoint is phase-granular (documented).
- Machine verification is real (10–14/14 oracle cases), evidence-hashed DoD gates, and the pipeline
  **refuses rather than ships a false green** — including the new type-red refusal.
- All five kinds emit wired, runnable trees (keyless floor tree-run green, both runtimes).
- Governance is honest: the factory latch is non-forgeable, the human acceptance door is deliberate and
  visible (`awaitingHumanAcceptance`), and every claim audited this wave matches its bytes.

**Does not work (the real remaining blockers):**
1. **Keyed P6 synthesis reliability — the dominant blocker.** DeepSeek's synthesized TypeScript does not
   reliably pass the tree's strict `tsc`/brief-fit within the bounded repair budget, so runs stop at P6
   (exit 1). Measured: pass@1 = 0/11, mean ≈ 6/9. This is model-output quality, not a wiring defect.
2. **The corpus bar is unreachable on a first run.** Every grader requires `meanAtLeast: 1` while M7
   (prior-less) is 0 by construction → first-run ceiling 8/9, so `pass@1 = 0` is partly arithmetic.
3. **The eval harness under-measures the pipeline.** Its keyed drain runs keyless, so P7's live research
   never runs (fix named: `run-eval.mjs` drain flow).
4. **MCP is not wired to a live consumer** (module + 23 tests real; enablement is an owner trust decision).
5. **Second provider/failover is resolved-but-unarmed** (no key on this host, no per-call router).
6. **No OS isolation boundary** — the node-runner is not a sandbox (declared limit).
7. **The human acceptance stamp is required by design** — `autonomousSoftwareFactory:true` is
   intentionally unreachable without a human (the machine drafts the bar it would be graded against).
8. Kind resolution has two resolvers (`uiKindOf` private 3-way vs `projectKindOf` 5-way) kept aligned by
   hand; the single-source-of-truth fix belongs in `engine.ts`/`types.ts` (STOP-and-REPORTed).

**Verdict:** RapidTool is an **autonomous, governed, self-refusing factory pipeline** — a brief goes in
and a machine-gated, evidence-hashed delivery or an honest refusal comes out, with no human input at any
park. It is **not** a factory that produces a passing product on demand: on its own 11-fixture corpus it
scores mean ≈6/9 with pass@1 0. "Wired and working end to end" = yes. "Produces a working product every
time" = not yet, and the gap is the model's TypeScript synthesis quality plus the corpus bar's cold-start
arithmetic — not the harness.

## 6. Remaining tasks (prioritized, with the owner's decision points)

1. **Keyed P6 convergence (highest value).** Options: prompt guidance targeting the strict-`ts` error
   classes (TS2322/TS2749/TS2440 seen live); more/better-fed repair cycles (the offender file is now
   named and fed); a deterministic post-fix pass; or a stronger synthesis model for P6.
2. **Re-measure after 1** with `npm run eval -- --keyed --out <scratch>`; the scorecard is the metric.
3. **Decide the corpus bar:** either make M7 achievable on a first run or keep the 10/10 bar and accept
   that `pass@1` cannot be 1 first-run by construction.
4. **Fix the eval drain** to exercise the live layer (or document its keyless-drain semantics).
5. **Kind resolution single source of truth** (`engine.ts`/`types.ts`); align stem/exact matching.
6. **MCP wiring** to a consumer (owner trust decision) and **failover arming** (needs a key + router).
7. Housekeeping: `.t4scratch/` cleanup; `README-cli.md:300` / README doc drifts; the `skip`-typecheck
   seals-by-design note.

## 7. Wave log index

`fixes/341_1_kinds.md` · `341_2_provider-key.md` · `341_3_evidence-delivery.md` · `341_4_console.md` ·
`341_5_governance.md` · `341_6_autonomy.md` · `341_7_verifier-a.md` · `341_8_verifier-b.md`.
