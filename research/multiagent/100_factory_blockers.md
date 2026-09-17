# 100 — RapidTool Factory Blocker Register

**Why this file exists.** Lane `task-0` of wave `deleg_9272975b` performed the verification
work below but hit the 50-iteration cap **before** its final write. The parent (`104`
synthesis) carried the write from the lane's frozen evidence and **independently re-verified
every P0 in this file against current bytes**. Nothing here is invented; every claim carries
either a parent-verification mark or an explicit `[lane-reported]` marker.

**Verification legend**
- ✅ **PV** = parent-verified against bytes this session (command + output observed).
- 🔶 `[lane-reported]` = surface-verified by the lane only; parent did not re-run it. Treat as
  a strong lead, not a fact.
- ❓ = flagged uncertain by the lane itself, or unverifiable without a keyed run.

---

## Verdict

**RapidTool is not an autonomous software factory, and cannot become one by prompt-tuning
alone.** Its governance, telemetry and honesty *scaffolding* is genuinely strong and
tested — but three structural facts block the claim: (1) an agent can mint a
person-indistinguishable human approval with no guard on the normal path, (2) the emitted
"multi-job product" is five re-export bridges to one module, and (3) its own keyed eval
scores **4/9** and the run is logged as `dod.blocked`.

## Ranked blocker table

| ID | Sev | Blocking finding | Anchor | Verification |
|---|---|---|---|---|
| **P0-01** | P0 | **Actor-seam forgery is live.** An agent can mint `decidedBy:"human"` with no TTY, no note, no `--force`, no seat evidence | `headless.ts:734`; guard only at `rapidtool-cli.mjs:517` | ✅ **PV** |
| **P0-02** | P0 | **Self-referential DoD criteria.** A criterion asserting a *human* approved is satisfied by any phase record with `status:"complete"` — i.e. by a *machine* approval | `dod.ts:337,349,471,483`; probe `dod.ts:48` | ✅ **PV** |
| **P0-03** | P0 | **Judge/producer tier inversion.** Auto-Review judge is flash-tier while P6 producer is pro-tier — an asymmetric judge | `wild-mode.server.ts:32`; `codegen.server.ts:133` | ✅ **PV** (see inversion note in §P0-03) |
| **P0-04** | P0 | **No multi-job product.** All five emitted jobs are byte-identical re-exports of one generated module | `src/jobs/{flip,publish,record,show,track}.ts:10`; `doctor --tree` inventory | ✅ **PV** |
| **P0-05** | P0 | **It cannot pass its own gates.** Latest keyed eval **4/9**, `status: dod`, run logged `dod.blocked` | `research/eval-out/results.json` (2026-09-10T06:05Z) | ✅ **PV** (parent read `results.json` + `history.json` independently) |
| **P0-06** | P0 | Forged-approval → gate-advance path: the unguarded approval also satisfies the P0-02 criteria, so the two compose into real gate advancement | `headless.ts:734` + `dod.ts:337` | ✅ **PV** (composition is parent-inferred from two verified facts — see §P0-06) |
| P1-01 | P1 | **Provider monoculture** — zero `OPENAI_/XAI_/ANTHROPIC_/OPENROUTER_/OLLAMA` hits repo-wide; base URL hardcoded, no env override | `deepseek.server.ts:23` | ✅ **PV** (parent ran the grep; zero hits) |
| P1-02 | P1 | **No unattended scheduling** — no cron/daemon/queue surface; nothing can run the factory on its own | repo-wide grep | 🔶 `[lane-reported]` |
| P1-03 | P1 | `acceptanceFixtures` **absent** in the keyed project, and `humanFixtures` has **no writer anywhere** — the human-approval bar can never be met by the product itself | keyed project JSON; `humanFixtures` grep | 🔶 `[lane-reported]` |
| P1-04 | P1 | **The benchmark's "human seat" is performed by the harness stamping `human`** — `run-eval.mjs:273` labels the driver the eval's human seat and `run-eval.mjs:295` does `p = approve(p)` | `scripts/run-eval.mjs:273,295` | 🔶 `[lane-reported]` — *high impact if true; verify before publishing* |
| P1-05 | P1 | `RAPIDTOOL_TOKEN_CAP` unset by default (`doctor` `tokenCap: null`) and meters only the P6 path | `doctor` output; `codegen.server.ts:978-982` | ✅ **PV** (`tokenCap: null` observed; narrow metering corroborated by two lanes, see `104` §4.5) |
| P1-06 | P1 | P9 emits canned `rapidtool-gate` GitHub-Actions YAML + a GCP/Firebase sketch — deploy artifacts are templates, not executed pipelines | `engine.ts` P9 artifact writers | 🔶 `[lane-reported]` |
| P1-07 | P1 | No user-facing checkpoint/undo | — | 🔶 `[lane-reported]` (corroborated by `103` A5: phase-granular only) |
| **P2-01** | P2 | **Doc drift, three-way.** `AGENTS.md:15` asserts "**NOT a git repo**" but `.git` exists and `git log` works; verb counts: `AGENTS.md:47` says **33**, `README.md:11-12` says **31**, `README.md:96` says **31**, `README.md:98-99` says **31**, reality is **34**; `README.md:15` claimed 1632 tests vs a real **1634** | `AGENTS.md:15,47`; `README.md:11-12,15,96,98-99` | ✅ **PV** — **all fixed 2026-09-16 (216 T0.9)** |
| P2-02 | P2 | **M1=1 evidence is degenerate** — the same 4 files are listed as evidence for all 7 capabilities. ❓ May already be closed by `fixes/215c` (landed 01:00, one minute before that `results.json` at 01:05) — needs a fresh keyed run to know whether M1=1 is earned | `results.json` M1 evidence | ❓ uncertain (lane-flagged, parent concurs) |

## Detailed findings

### P0-01 — Actor-seam forgery (✅ parent-verified)

```ts
// src/lib/headless.ts:734
const base = approveHitl(project, { decidedBy: "human", force: opts.force });
```

The **only** guard sits on the `--force` path:

```js
// scripts/rapidtool-cli.mjs:517
if (flag(args, "force") && process.stdin.isTTY !== true && !flag(args, "i-am-human")) {
// :521  error: "approve --force from a non-TTY requires --i-am-human (never mint decidedBy:human from an agent)",
```

The repo's own error string states the invariant — *"never mint decidedBy:human from an
agent"* — while the **non-`--force`** path hardcodes `decidedBy: "human"` with no guard at
all. The lane reproduced it non-interactively in a temp dir: `create` → `gate --autopilot`
(parked at P4, `forceHuman: undefined`) → `approve --project probe.json` (no `--force`, no
`--i-am-human`) ⇒ **exit 0**, ledger row `P4 approve | decidedBy: human | note: undefined`.

**Why it blocks autonomy.** Autonomy requires a *trustworthy* human seat. Here the seat can
be occupied by the very process being governed, with a ledger that reads exactly like a real
person's approval. Every downstream claim built on that ledger inherits the forgery.

### P0-02 — Self-referential DoD criteria (✅ parent-verified)

```ts
// src/lib/dod.ts — four instances
:337  criterion: "P4 HITL approved — phase record complete",
:349  criterion: "P5 HITL approved — phase record complete",
:471  criterion: "P8 HITL approved — phase record complete",
:483  criterion: "P9 HITL approved — phase record complete",
```

and the probe the criterion runs:

```ts
// src/lib/dod.ts:47-48
const phaseComplete = (p: Project, phase: number): boolean =>
  (p.phases ?? []).some((r) => r.id === phase && r.status === "complete");
```

The criterion *asserts* a human approval and *tests* only that the phase record is complete.
A machine approval satisfies it. The criterion therefore cannot fail for the reason it names.

### P0-03 — Judge/producer tier inversion (✅ parent-verified, with an important inversion)

```ts
// src/lib/wild-mode.server.ts:32   (used at :266, :328)
export const WILD_CLASSIFIER_MODEL: LlmModel = "deepseek-v4-flash";
// src/lib/codegen.server.ts:133    (used at :1401, :1575)
export const P6_SYNTH_MODEL = DEEPSEEK_MODELS.pro;
```

⚠️ **Parent correction to the lane's framing.** The lane called the judge "weaker than the
producer". That was true when V4-Pro was the frontier tier, but **DeepSeek-V4.1-Flash now
beats V4-Pro on every agentic/coding benchmark** (DeepSWE 74.2 vs 62.7; TB2.1 90.6 vs 87.9 —
see `104` §1.0, fetched from the model card). So today the *judge* is the stronger tier and
the *producer* is the weaker one. Two consequences:

1. The asymmetry is still a real defect, but the direction has flipped — the fix is **not**
   "upgrade the judge tier".
2. **`104` T0.1 (switch P6 to flash) collapses this asymmetry**: judge and producer land on
   the same strongest tier. That in turn re-raises the *judge == producer* archetype, so the
   durable fix is **cross-family judging** (e.g. judge via a different provider) once `101`'s
   adapter work (T1.5) lands — not a tier bump.

### P0-04 — No multi-job product (✅ parent-verified)

```
research/eval-out/coffeehouse2home-property-ledger/src/jobs/
  flip.ts:10     export * from "../generated/check-reorder-flags.ts";
  publish.ts:10  export * from "../generated/check-reorder-flags.ts";
  record.ts:10   export * from "../generated/check-reorder-flags.ts";
  show.ts:10     export * from "../generated/check-reorder-flags.ts";
  track.ts:10    export * from "../generated/check-reorder-flags.ts";

doctor --tree … → inventory: { "stubs": 0, "reexports": 5, "real": 0 }
```

Five job names, one implementation. `00:00` of the honest factory claim is "a real multi-job
product"; the artifact is a naming layer over a single module.

### P0-05 — It cannot pass its own gates (✅ parent-verified)

`research/eval-out/results.json` (`generatedAt 2026-09-10T06:05:29Z`, mode `keyed`):
1 entry, **total 4 / 9**, mean `0.4444`, status `dod`; M2, M3, M4, M7, M9 = 0. The project log
repeats `dod.blocked :: P6 advance blocked — unmet: p6-verified, p6-brief-fit, p6-arch`.
Chunked synthesis genuinely fired (`p6.synthesis.attempt :: chunk 1/4 … 4/4`, "5 file(s) in
4 chunk(s)") — **the mechanism is real; the output still fails.** Historical rows: an earlier
keyed run scored 6/9 — the number the README cites.

### P0-06 — Composition: the two P0s make each other worse (✅ both facts PV; composition inferred)

P0-01 lets a machine mint `decidedBy:"human"`; P0-02 accepts exactly that as evidence of a
human approval. Composed, an autonomous loop can satisfy its own human-gate criteria and
advance — with a ledger that reads correct. The parent labels the *composition* as inferred
(both halves are verified individually; the end-to-end forged-advance was not re-run).

## Already good — be fair (each lane-verified; suite re-run by parent)

- `npm test` → **1634 / 1634 pass, 0 fail, 0 skip** (✅ **PV**, parent ran it; ~116 s).
- `npm run lint` → exit 0; `npm run typecheck` → 0.
- `factoryClaim()` (`doctor.ts:160-185`) is a real 5-condition latch, and `coerceFactoryClaim`
  coerces a hostile `true` → `false`. The doctor can refuse to flatter the product. ✅ **PV**
  (`autonomousSoftwareFactory: false` with named gaps on every run).
- **A5 closed:** `wild-mode.server.ts` carries "Blinded judge (185-U8): do NOT inject a
  pre-chewed PASS/FAIL DoD machine verdict".
- `approveFixtureCases` never defaults `decidedBy` **and** strips forged values
  (`brief-fixtures.ts:585-608`) — the pattern P0-01 needs.
- `p6-verified` / `p6-brief-fit` / `p6-arch` are substantive probes (evidenceHash +
  capability→file mapping + stub detection), not string greps.
- Isolation is honest **everywhere**: `NodeRunResult = NodeRunCore & { sandbox: false }`,
  doctor `sandbox:false kind:"none"`, and a plain-English note that the runner is not Docker/bwrap.
- `dualChannelFailDetail` fail-closes hostile dual payloads (`ok:true` never carries `error`).
- `skip≠green` / `stubs≠complete` landed (210).

## Could NOT verify (do not present as fact)

1. Whether the wild loop **writes** `rejectionHistory` on its own rejects (readers verified,
   writers not) — the A7 dead-letter steering question. ❓
2. Whether persisted run state carries `stepsTotal` / `maxSteps` so a tripwire could trip
   (the probe returned `wild: null`). ❓
3. The semantics of a P6 record `{status:"complete"}` coexisting with blocked gate logs —
   observed in JSON, not traced to a writer. ❓
4. `bash scripts/gate.sh` (the four-gate script) was **not** run — only `npm test` + `lint`.
5. The `M1=1` stopword/degenerate-evidence question (P2-02) — needs a fresh keyed run.

## Fix direction (feeds `104` §5)

| Blocker | Fix |
|---|---|
| P0-01 | Route **every** approval through one `canSelfApprove`/seat predicate; make `decidedBy:"human"` require an out-of-band human token, not a default. Mirror the existing `brief-fixtures.ts:585-608` forge-stripping. |
| P0-02 | Criteria must test the *claim*, not a proxy: assert the approval row's actor + provenance, not `status === "complete"`. |
| P0-03 | Not a tier bump — see the inversion note. Land `104` T0.1 (both tiers converge), then cross-family judging via `101` T1.5. |
| P0-04 | The chunk→file mapping must emit real per-job modules, or the job names must stop being advertised as jobs. |
| P0-05 | Close the three unmet probes (`p6-verified`, `p6-brief-fit`, `p6-arch`) — the eval is the acceptance test for the whole plan. |
| P2-01 | Strike or correct the stale claims (`AGENTS.md:15,47`; `README.md:96`) under the repo's own P0-04 declare-or-strike rule. |
| P2-02 | Re-run the keyed eval on a working key to learn whether M1=1 is earned or inherited from `215c`. |
