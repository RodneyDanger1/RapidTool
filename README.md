# RapidTool

A **deterministic, governed workbench for building software with AI agents**. RapidTool compiles
a client brief into an audited, phase-by-phase build: research → architecture → interface →
synthesis → verification → a paste-ready **Agent Packet** — all behind evidence-hashed DoD
gates, an append-only decision ledger, and a hard no-fabrication **honesty contract**.

**Two surfaces, one engine:** a browser app (TanStack Start + React 19, `http://localhost:8080`)
and a file-based headless CLI (`scripts/rapidtool-cli.mjs`, **39 verbs** — re-derived:
`grep -c 'case "' scripts/rapidtool-cli.mjs` = 39) that drives the same
pure engine with no browser and no server.

> **Status (2026-10-05, committed HEAD `2f0e3d7`, clean tree).** The full boundary gate on the frozen
> tree is GREEN: `bash scripts/gate.sh` → `ok:true` (typecheck 0 · lint 0 with **5 warnings** ·
> assertion-gap lint 0 · **prevention 20/20 guards** · scripts **513/0** + lib **3712 pass / 0 fail /
> 2 skipped** · build 0). The gate script emits a single JSON verdict; every number here is re-runnable
> by you, and the exact JSON is quoted in the "Corrections in force" block below. RapidTool is **not
> yet** an autonomous software factory that beats Codex/OpenHands/Claude Code — and it **tells you that
> itself**: `doctor` reports `autonomousSoftwareFactory: false` with named `gaps[]`, and keyed campaign
> #1 scored `workingApp` **0 of 8** trees. A new **additive** machine reading (`autonomousFactoryV2` +
> `fleetAcceptance`, seat `machine:tree-run`) now sits BESIDE the human-gated bar — PR-33, Owner Open
> Question 1 = **Option A**; see [The autonomy contract (PR-33, 2026-10-05)](#the-autonomy-contract-pr-33-2026-10-05).
> The remaining code-level work is catalogued wave-by-wave in **[`remainingwaves.md`](remainingwaves.md)**.

---

## Table of contents

1. [For AI agents — read this repo in this order](#for-ai-agents--read-this-repo-in-this-order)
2. [Quickstart](#quickstart)
3. [Environment](#environment)
4. [What RapidTool is (and its architecture in one screen)](#what-rapidtool-is-and-its-architecture-in-one-screen)
5. [What it does today — capabilities that pass tests right now](#what-it-does-today--capabilities-that-pass-tests-right-now)
6. [What it does **not** do yet — the honest limits](#what-it-does-not-do-yet--the-honest-limits)
7. [Current state — 2026-09-26 (works / shelled / blocked)](#current-state--2026-09-26-works--shelled--blocked)
8. [Progress so far (the paper trail)](#progress-so-far-the-paper-trail)
9. [Verification — how to check every claim above](#verification--how-to-check-every-claim-above)
10. [**THE CATALOG — every tracked file**](#the-catalog--every-tracked-file-2088-today)
11. [Docs index](#docs-index)
12. [License](#license)

---

## For AI agents — read this repo in this order

This repository is worked by AI agents, so the reading order is part of the contract. Read top to
bottom, and mind the **trust order**: bytes on disk beat every document; where documents disagree,
the newest byte-read and the finding register's corrections win.

1. **`README.md`** (this file) — what RapidTool is, the honest state, and **the catalog of every
   tracked file** (§10). Start here so you know what exists before you touch anything.
1b. **`RUNBOOK.md`** — the operator runbook (added 2026-10-05): install, launch, the console
   tour, how to run Wild Mode correctly (enable → run → what a park means → resume), how to
   export/download the product, how to run the CLI verbs, and a plain-English "known limits"
   section. Read it before promising anyone a running product.
2. **`START-HERE.md`** (tracked; written as a working-tree file 2026-09-26) — the cold-start map: the 10-line
   tour, the read order, the run commands (each verified or explicitly marked why not), the
   never-do hard rules.
3. **`AGENTS.md`** — the repo working contract: source layout, commands, the honesty contract
   (non-negotiable), strict file-ownership rules.
4. **`research/multiagent/thoroughanalysis.md`** — **the register**: the deep audit's mission
   preamble + every finding (`A*`/`C*`/`W-*`/`R*`/`T*`) with `file:line` evidence. Read its header
   PROTOCOL before appending anything — it is append-only via its end-marker.
5. **`finalsprint.md`** (tracked) — the W30 shell-sprint master table: every
   remaining capability, its shell status, and what it needs to become real. Its publisher-listed
   `§MASTER-CORRECTIONS` append is **owed, not yet landed** — until it lands, treat the master
   table plus the RS-01…RS-04 correction rows in `fixes/274_wdx2.md` as the audited record, and
   never trust a lane log's "landed" list over the bytes.
6. **The current-wave dispatch** — `wave_plans/W37/master-pack.md` (the X1–X6 lane packs naming
   every remaining task) and `wave_plans/W38/NEW-SESSION-PROMPT.md` (the finish-RapidTool task
   list; both tracked).
7. **The live lane logs** — `fixes/` (newest number = current wave; `fixes/271–286` are the W29–W38
   era). Each log is a claim + evidence; verify before building on it (the audits found lanes that
   overstated — e.g. `finalsprint.md`'s CF-1/CF-2 rows).
8. **`RESUME.md`** → **`taskuniverselog.md`** → **`remainingwaves.md`** — the session-start set
   named by `AGENTS.md`; then `docs-FOLDER-MAP.md` (working tree) for a depth-2 navigation map.

**What to trust, in order:** (1) bytes you read today / commands you ran today; (2) the register's
corrections and the audit rows in `fixes/265–282` + `finalsprint.md`'s byte-census notes;
(3) dated status blocks (they are snapshots, not promises); (4) prose anywhere — the honesty
contract (`AGENTS.md` §Honesty) makes a stale claim a defect, so when you find one, fix it and log
the before/after in your `fixes/NN_*.md` lane log.

**Path gotcha:** the repo folder has a space — `cd "/c/Users/mnril/Desktop/RapidTool Main"`; ripgrep-style
tools fail on it, use terminal `grep`. Node **22** required (verified v22.23.2).

---

## Quickstart

```bash
# Requirements: Node 22 (verified on v22.23.2), npm
npm install

# Browser app → http://127.0.0.1:8080 (loopback by default, R11-f01; port + strictPort stay a fixed contract in vite.config.ts)
# Live-preview panel/iframe cases need the LAN bind — opt in explicitly:
#   RAPIDTOOL_BIND_ALL=1 npm run dev   → http://0.0.0.0:8080
npm run dev

# Full stability gate (6 checks + JSON verdict; --double adds a flake detector)
bash scripts/gate.sh

# Headless CLI — the same engine without a browser (one JSON object per call; full contract: scripts/README-cli.md)
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor                     # environment truth
node --experimental-strip-types scripts/rapidtool-cli.mjs create --brief "your brief here" --out build.json  # intake → project file
node --experimental-strip-types scripts/rapidtool-cli.mjs gate --project build.json  # advance until parked (awaiting_hitl → exit 2)
export RT_HUMAN_SEAT_TOKEN="$(head -c 24 /dev/urandom | base64)"                     # the human seat's out-of-band token (TA-2)
node --experimental-strip-types scripts/rapidtool-cli.mjs approve --project build.json --i-am-human  # pass the parked HITL seat
node --experimental-strip-types scripts/rapidtool-cli.mjs emit --project build.json --out emitted/   # write the runnable scaffold
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --tree emitted/     # job-file census for an emitted tree
```

### The truthful smoke — reading the verdict, not trusting it

The quickstart above is the whole keyless path; what makes it a *smoke* rather than a demo is that every
step prints one machine-checkable JSON envelope, and the emitted tree can be re-verified at any time
without re-emitting:

```bash
# Re-run the emitted tree AS-IS (read-only oracle — never re-emits, never clobbers edits):
node --experimental-strip-types scripts/rapidtool-cli.mjs tree-run --dir emitted/
```

Read what comes back truthfully:

- **Green (exit 0) `emit --run` / `tree-run`** means the emitted **files parse, the emitted tests
  pass as emitted, and the entry loads** — never that the brief's jobs work.
- Every runnable verdict carries a **`substance` census** (`stubs:N reexports:N real:N`). When the
  tree ships stub or reexport-only job modules, a loud **`SUBSTANCE MARKING`** note rides the
  envelope and `greenWhileStubbed: true` says it plainly: **exit 0 here is not product quality**
  (K3). `doctor --tree` shows the same census in the same classifier vocabulary.
- **Implementing a stubbed seam reddens the emitted `tests/oracle.spec.ts`** until its assertion is
  replaced — the K4 oracle trap; the same note says so, never silently.
- **Red is never a fake 0:** a red `--run` exits 1 with `RT_E_TREE_RUN_FAILED` plus the first not-ok
  tail on the envelope, and `treeRun.verdictHash` (FNV-1a over the decisive verdict fields —
  integrity, not cryptography) lets a re-run prove whether the machine verdict changed: same hash,
  same verdict.
The CLI's full verb reference — all **39 verbs**, the exit-code taxonomy (0/1/2/3/4/**5**), the `RT_E_*`
registry, and the Hermes-style agent loop — lives in **`scripts/README-cli.md`** (doc-contract
tested by `scripts/README-cli.test.mjs`: the count, the verb list, and the `edit`/`emit` sections
are pinned to the dispatcher's bytes). Read it there; it is not duplicated here.

### Environment

**Browser app:** `DEEPSEEK_API_KEY` in `.env` enables LLM-backed phases (P6
synthesis, Chat, expansion); the app's dev/build tooling loads `.env` for you. **Headless CLI:**
it resolves `DEEPSEEK_API_KEY` from **`<working directory>/.env` first, then the process
environment** — the `.env` value WINS when both are non-blank (a stale ambient key loses behind
the coded `RT_E_LLM_KEY_SHADOWED` signal, tails only), and a present-but-blank process value is an
intentional keyless disable. Run it from the repo root to use the repo's own `.env`
(`scripts/README-cli.md` §API key resolution owns the rule). Without a key the engine still runs
and is honest about skips. Research probes use free keyless sources (duckduckgo/searxng/wikipedia)
and report what they could not reach. `.env.example` documents the common knobs (keys, model pins,
`RAPIDTOOL_TOKEN_CAP`, `RT_HUMAN_SEAT_TOKEN`, pricing, log dirs, eval dirs, timeouts, MCP gate,
provider selection, best-of-N, cassette, dev LAN bind) — `.env` itself is gitignored and
**never printed**.

---

## What RapidTool is (and its architecture in one screen)

```
brief ──► intake ──► P0..P12 phase engine (pure, deterministic, headless-capable)
                        │
                        ├─ P0-P6  research → architecture → interface → SYNTHESIS (the build)
                        │           · chunked LLM synthesis, validated + bounded repair
                        │           · compile-check, oracle rows (A7), tree-run verdicts
                        ├─ P7-P12 tail artifacts (gate-blind edge; the default advisory driver advances them)
                        │
                        └─► DoD gates (evidence-hashed) · decision ledger (append-only)
                            · verify-fix loop (machine) · Agent Packet (paste-ready)
                            · knowledge vault (Obsidian-style) · self-learning store
```

- **Engine:** pure TypeScript modules in `src/lib/*.server.ts`, driven by
  `headless.ts` (journey/runHeadless) and `engine.ts` (phase state machine). The browser and
  CLI are both thin surfaces over it.
- **Governance:** every approval carries a **seat** (`autopilot` vs a human seat that requires
  an out-of-band token), every phase transition needs evidence, and refusals are **coded**
  (`RT_E_*`) rather than silent.
- **Synthesis:** P6 asks a model for module code in **signature-bound chunks**, then
  compile-checks and runs each job module's own oracle. Prose-in-code, `Math.random`, and
  forbidden primitives are **refused** (with one bounded repair attempt each, then a coded
  refusal — never a fabricated pass).
- **Trust model:** byte-level. If the product's own `npm test` fails, `tree-run` can never
  report `ok: true`; a red verdict survives in the durable trail and `emit` refuses (or
  banners, on the eval path) — it cannot be shipped quietly.

Key files: `src/lib/engine.ts` · `headless.ts` · `codegen.server.ts` (P6 + chunk planning) ·
`scaffold.ts` (tree writer) · `compile-check.server.ts` + `node-runner.server.ts` (bounded
runner — applies Node's Permission Model to generated code, still **not a security sandbox**) ·
`verify.server.ts` + `dod.ts` (oracles) · `doctor.ts` (environment
truth) · `packet.ts` + `phases.ts` · `console.tsx` (UI) · `scripts/rapidtool-cli.mjs` (39 verbs).

---

## What it does today — capabilities that pass tests right now

| Capability | State | Proof |
|---|---|---|
| 13-phase engine, resumable state, append-only ledger | ✅ | `src/lib/engine.ts` + suite; `runHeadless` tests |
| Brief → plan → architecture → interface artifacts | ✅ | P0–P5 module suites |
| Chunked LLM synthesis with gates + bounded repair | ✅ | `codegen.server.test.ts` (119 tests; counted `it(`/`test(` today) incl. refusal e2e |
| Prose-in-code / `Math.random` / forbidden-primitive refusal | ✅ | T-09/T-15 wiring + e2e pins (Wave 2–3) |
| Oracle rows: each job module must pass its OWN behavioral test | ✅ (engine) | `verify.server.ts`; tree-run executes them |
| **tree-run = the product builds and tests** | ✅ | T-18 (Wave 3): runs the tree's own `npm run typecheck`+`npm test`; a failing tree can never be `ok:true` |
| Honest emission: refuse/banner on an uncleared red tree | ✅ | T-07 (Wave 2): `redTree` policy; refusal leaves nothing on disk |
| HITL seats: no machine path can mint `decidedBy:"human"` | ✅ | TA-2 (Wave 2): `ApproveActor` + out-of-band token |
| Lesson loop: failure signatures, refusal rows, accrual | ✅ wired+pinned | 112 T1/T2 (Waves 3–4); `knowledge.ts`/`engine.ts`/`verify.server.ts` |
| Assertion-gap lint (tautology detection repo-wide) | ✅ | `scripts/check-assertion-gaps.mjs`; wired into `gate.sh`; 0 findings |
| `str_replace` patch primitive (unique-match + graded fuzzy) | ✅ wired | `src/lib/patch.ts` (25 test blocks today). **Wired into P6 synthesis repair** (`codegen.server.ts:127` imports `applyStrReplace`, applied at `:1083`) **and the CLI `edit` verb** (`rapidtool-cli.mjs:2860`) |
| One-seam policy engine (default-deny approvals) | ✅ core | `src/lib/policy.ts` (33 test blocks today). **Routing wired in W5** (all 3 sites, seats byte-identical; bypass pins → W6-L2) |
| UI: console, phase rail, HITL dock, runtime log, **command palette (⌘K)**, typed timeline | ✅ | `console.tsx` + `cmd-palette.tsx` + `runtime-timeline-pane.tsx` |
| Headless CLI: 39 verbs, JSON output, doctor, eval harness + the read-only `eval` scorecard verb | ✅ | `scripts/rapidtool-cli.mjs`; `README-cli.md` (doc-contract tested) |
| Stability gate with flake detection | ✅ | `bash scripts/gate.sh [--double]` (first green run 2026-09-16) |

## What it does **not** do yet — the honest limits

1. **The emitted product is still ONE module wearing several filenames — on the KEYLESS floor.**
   *(Qualifier added 2026-10-02 by the W47 record audit: the flat claim is superseded — a keyed run emits a
   real multi-job product, see "Corrections in force" below.)*
   The headline open item (TA-15). On the reference corpus trials (2026-09-16):
   `doctor --tree research/eval-out/coffeehouse2home-property-ledger--trial-1` →
   `{stubs: 0, reexports: 4, real: 1}` — of the 5 declared job paths ONE hosts the P6 module
   (`track.ts`) and four re-export it; a fresh keyless emit (2026-09-26) reads the same shape
   (`{0,4,1}`, host `schedule.ts`). The all-reexport vintage `{0,5,0}` lives in
   `…run-2026-09-10`. Until a run covers the other job paths with real modules, RapidTool
   does **not** emit a real multi-job product, and it must not be claimed to.
2. **P7–P12 coverage is honest, not uniform.** The phase edge is gate-blind: the default advisory
   driver advances through P7–P12 after a red P6, and each tail phase writes its own artifact
   (measured: 9 tail artifacts). Only an `enforceDod` run blocks at P6, on the two keyed criteria.
   Every packet carries the real census ("Phase coverage: N of 13 / M artifacts from P7–P12", plus
   `empty_phases`) so no surface implies all 13 ran.
3. **The runner applies a real resource/process bound — but it is NOT a security sandbox.**
   Generated code (`exec.runCode`) runs with `isolation:"strict"`: Node's Permission Model confines
   filesystem writes to the per-run scratch dir, denies `child_process`/`worker_threads`/native
   addons, and caps the V8 heap at 512 MB; timeouts + a scrubbed env still apply. What is NOT
   provided (and must never be claimed): network denial, fs-READ confinement when strict is off, and
   any OS boundary — Docker / bwrap / AppContainer / Windows Job Object (Node exposes no Job Object
   API without a native addon this repo does not take). `doctor` says `isolation.sandbox: false` with
   the real `isolation.bound` named honestly.
4. **Git landing and checkpoint+resume are now REAL** (updated 2026-10-03 by the 345-F1 docs-truth
   fix — this limit was written before `emit --git` landed in the 343-3 wave and before
   `resume`/`unattended` landed in W36). `emit --git` lands the emitted tree as one
   Conventional-Commits commit (`src/lib/git.server.ts: gitLandEmitted`), idempotently and with the
   host repo structurally un-landable; `resume`/`unattended` re-enter from the per-phase checkpoint
   under `<dir>/.rapidtool/`. **Delivery proof (346):** the walk-away orchestrator
   (`scripts/factory-watch.mjs`, `npm run factory`) re-executes the emitted tree (`emit --run`) and
   requires `treeRun.ok === true` before it issues `emit --git`, and the CLI `emit --run --git` guard
   refuses the commit when this invocation's `--run` verdict is red (`RT_E_TREE_RUN_FAILED`).
   What is still roadmap: no in-product scheduler/daemon (an external Windows Task Scheduler / cron
   hook is the scheduler by design) and no branch/remote/push/PR delivery.
5. **LLM work needs a key.** Without `DEEPSEEK_API_KEY` the phases that call a model skip
   honestly; a *keyed* full run also costs tokens — budgets/ledger unification is roadmap
   (T-107.6).
6. **Chat is grounded tools + one-shot model text.** No shell, no disk patch, no agents from
   chat.
7. **Verification is deep but local.** 2000+ tests run on this machine; CI wiring, cross-machine
   reproducibility, and *keyed* eval evidence are roadmap (the run-side graders + trials/pass@k
   harness shipped in W5; a keyed run still needs a live `DEEPSEEK_API_KEY` — T0.10; the tracked
   scorecard `research/eval-out/results.json` shows the last keyed attempt).
8. **English-only.** The console UI and every app the factory emits are hardcoded en-US strings —
   there is no i18n library, no locale tables, and no `Intl` usage; brief-level locale support is
   future work (R15-f11).
9. **The keyed P6 productivity wall is unbroken (campaign #1, 2026-10-05).** A real keyed acceptance
   campaign over the seven briefs plus a held-out brief (615,533 tokens / ~US$0.38 label-only /
   1,505 s) scored **`workingApp` 0 of 8** trees against the plan's target of ≥5/8; **6 of 8 stall at
   the P6 DoD gate** (`RT_E_GATE_PENDING`), and the synthesis gate refuses below-floor trees **by
   default** (`emit --red-tree banner` is the deliberate opt-in that ships the partial WITH a README
   caution banner). The
   **delivery-truth** half DID pass: **0 empty-substance commits and 0 red-tree commits** (historical:
   6 empty + 5 red). Raw evidence: `testruns\_report\CAMPAIGN1.md`, `CAMPAIGN1.json`,
   `campaign1-score.json`. Do not read a green gate as a working app.
10. **Known residuals.** `resumeAccepted` **IS** now consumed by codegen (`codegen.server.ts`
    `resumeByPath` / the `p6.synthesis.reused` event, with `headless.resumeAcceptedFromTree` /
    `driveP6Journey` threading the previous cycle's accepted chunks — corrected 2026-10-05); the gate
    reports **5 lint warnings** (`lint.problems:5`, lint still `ok:true`); cross-family failover is
    genuinely unimplemented (the un-armed switch was deleted; `RAPIDTOOL_FALLBACK_PROVIDERS` is
    inert); the console seat records provenance but has no out-of-band delivery seam; prettier drift
    is measured, not gated.
11. **The gates measure internal consistency, not product quality — so quality is now measured
    separately (2026-10-05).** Verified this session: `p6-brief-fit` is a lexical identifier test
    (`src/lib/dod.ts`); `p6-verified` only means the emitted tree's own tests went green
    (`dod.ts:790`); and `p6-arch` **passes vacuously when no tree exists** — the code itself calls
    that a SKIP, not product-complete (`archTrace`/`archProductComplete`). That vacuous pass is now
    surfaced honestly: `runGate` returns an `advisories` list and the recorded gate artifact prints
    *"Qualified passes (**NOT** product-complete): p6-arch: SKIP…"* — **no bar was lowered and no
    criterion removed**. A NEW additive, byte-derived reading (`src/lib/product-quality.ts`,
    surfaced as `doctor.productQuality` and `fleetAcceptance.productQuality`) reports a real web
    entry, router + pages, styled layout, a working ordering flow for an ordering brief, real
    (non-stub, non-reexport) modules, artifacts/phase, and the `--no-empty-tree` /
    `--no-placeholder-only-tree` flags. Nothing is guessed: absent evidence is reported absent. On
    a real keyed bakery run (`%TEMP%\bloedow-e2e\bloedow-bakery.json`, 9-file tree, 8 real modules)
    it reads `quality:false` with five named reasons — no web entry, no router, 0 pages, no styled
    layout, no wired form — the exact gap the internal gates miss. Operator steps and the full
    limits: **`RUNBOOK.md`**.

### The autonomy contract (PR-33, 2026-10-05)

**Owner Open Question 1 is decided as Option A:** a NEW additive machine-verified reading sits BESIDE
the human-gated `autonomousSoftwareFactory`, which is byte-identical and never machine-mintable.

- **`autonomousSoftwareFactory`** — the existing human-gated bar: the AND of the machine conjuncts plus
  a **human-approved fixture row** stamped `decidedBy:"human"` through an out-of-band seat. Unchanged;
  **a machine path may never mint `decidedBy:"human"`** (the machine reader refuses a human-seat claim
  outright and never launders it). `doctor` prints it `false` by design.
- **`autonomousFactoryV2`** — the NEW, additive, machine-only reading; satisfied by machine evidence
  alone: the per-brief persisted P6 tree-run promotion stamp (`lastTest.label === "tested"` with a
  non-empty `evidenceHash`). It never flips the human flag.
- **`fleetAcceptance`** — the aggregate behind `autonomousFactoryV2`, reported under its own
  attributable seat `machine:tree-run` with `decidedBy:"machine"`; fail-closed when evidence is absent,
  hollow, unattributed, or colliding (two briefs sharing one `evidenceHash`), floor 5 of 8.
- **`fleetMetrics` / `fleetAlarms`** — fleet observability (tokens/calls/cache/rubric; `estimatedCostUsd`
  always `null`) plus threshold alarms that hard-fail the wave. Owned by `src/lib/acceptance.ts`.

**Date:** 2026-10-05. **Rationale:** it preserves the **338-4 anti-self-certification doctrine** — the
machine may not set the bar it is graded against, so the machine reading gets its own flag and its own
seat rather than redefining the human bar. **Rejected alternative (Option B):** dropping the
human-acceptance conjunct — it would make "autonomous" unfalsifiable and delete the repo's honesty
doctrine (an owner decision, not a code-lane change).

### Rollout flags — defaults and rollback

| Flag | Default | Meaning | Rollback |
|---|---|---|---|
| `--allow-empty` | **off** | On `emit --run --git`: withhold the commit on `substance:"empty"`/red; `--allow-empty` admits a deliberate scaffold-only commit. | Omit it (byte-identical default). |
| `gate --resynthesize` | **off** | Re-opens a red RUNNING P6 and re-enters the P6 journey once, live, bounded, from the recorded unmet requirements. | Omit it (a red running P6 re-parks). |
| `repair --from-gate` | **off** | Re-opens a red RUNNING P6 first so the bounded repair targets the recorded unmet state instead of `RT_E_PHASE_ILLEGAL`. | Omit it (legacy repair path). |
| `--token-ledger <file>` / `RAPIDTOOL_LEDGER_FILE` | **off** | Cross-process campaign ledger: preflight-load, refuse coded when `spent >= cap`, post-append measured spend. | Unset both (never read/written/surfaced; byte-identical). |
| `RAPIDTOOL_CAMPAIGN_TOKEN_CAP` | **unset** | Integer campaign bound for the ledger above. | Unset (falls back to the file's `cap`). |
| `resumeAccepted` | **absent** | A previous cycle's accepted chunks threaded for reuse (now CONSUMED by codegen: `resumeByPath` / `p6.synthesis.reused`). | Absent is the default and is byte-identical. |

The machine flag is separate from `autonomousSoftwareFactory`; no silent default flips; the human door
is never removed.

## Current state — 2026-09-26 (works / shelled / blocked)

_Sources: `START-HERE.md` §"Honest state" (verified on this machine the same day), `finalsprint.md`
(master table + §WDX polls + §S5), and byte-checks performed while writing this README
(`git ls-files`, `grep -c 'case "'`, file heads; log: `fixes/286_readme_catalog.md`)._

**Works today** (pinned by tests/commands you can re-run): the 13-phase deterministic engine with
resumable state + append-only ledger · brief→plan→architecture→interface artifacts · chunked LLM
synthesis with gates + bounded repair (keyless = honest floors + `RT_E_LLM_NOT_CONFIGURED`, never
fake text) · banned-primitive refusals (prose-in-code / `Math.random`) · oracle rows + `tree-run`
(the emitted product must pass its OWN `npm run typecheck`+`npm test`; a red tree can never be
`ok:true`) · honest emission (redTree refuse/banner) · HITL two-channel seats (no machine path
mints `decidedBy:"human"`) · CLI 39 verbs incl. `doctor`/`diagnose`/read-only `eval` scorecard ·
the console UI (9+ tabs, ⌘K palette, runtime log) · `gate.sh` with flake detection (first green
run 2026-09-16; W12 boundary gate = latest full green).

**Shelled / in progress** (per `finalsprint.md`; shells only — no fake behavior, each has
`TODO(<row-id>)` at its gap): the autonomy spine (wild keyed seam W-01 · mint reachability W-02 ·
emit materialization W-03, landed-by-E1b per the RS-01 correction) · wild supervisor Node-side
completer (R14-f01) · **unattended run (W-47 — REAL, W36; self-sufficient since 341-6: stock gates
auto-clear, only `forceHuman`/red-DoD parks)** · plan-before-execute (R13-f02 — real:
`stageWildPlan`/`engine.ts:4398` is the one staging site, `store.ts:1357`) · **checkpoint+`resume`
(T-107.7 — REAL, W36)** · **4 kind emitters (S2 — landed by 341-1); real graders + emitted UI seam (S2 —
recovery owed)** · **cassette replay (T5.7 — wired at the provider seam, 340-4)** · streaming surface (T5.1) · MCP client (F1) ·
second provider (F2 — registry entry already on disk per RS-02) · per-action allow-lists (F4) ·
per-run token ledger · dev-server bind hardening (R11-f01 — loopback default now in
`vite.config.ts`) · `--force` quarantine (R11-f08 — CLI wire landed W42; in-engine lift owed) · pane error boundary (R6-f12, partially
landed) · human-seat console surface.

**Blocked / known limits** (honest, not bugs to paper over): no isolation boundary — the bounded
node-runner is **NOT a sandbox** (R13-f04 = honest refusal; needs a host isolator that does not
exist here) · **CORRECTED 2026-10-02: keyed runs are NOT funding-blocked** — the account is funded and
the repo `.env` key works; the earlier 401/402 reports came from a stale Windows User-scope
`DEEPSEEK_API_KEY` shadowing it while nothing loaded `.env` (see `START-HERE.md` §CORRECTION and
`wave_plans/W45/parent-keyed-findings.md`). A keyed run now emits a **real multi-job product**
(`treeRun.substance {stubs:0, reexports:0, real:3}`, `p6-arch` PASS); the remaining gap is a
generated-code async defect recorded in `fixes/331_0_parent.md` §6.8 ·
the emitted product is still ONE module wearing several filenames on the KEYLESS floor (TA-15) · P7–P12 phases often
produce no artifacts · git landing + checkpoint-resume landed (the residual gap is the missing
in-product scheduler/host-hook and remote/PR delivery, not local landing) · Chat = grounded tools +
one-shot text, no shell/agents.

**Corrections in force:** `finalsprint.md`'s §S1 board over-claimed (3 of 4 items not in the
bytes — CF-1) and its `§MASTER-CORRECTIONS` self-append is still owed; the RS-01…RS-04 audited
corrections live in `fixes/274_wdx2.md`. Where any doc and the bytes disagree, the bytes win.

**Corrections in force — appended 2026-10-02 (W47 record audit; HEAD `6575669`):** the status banner
and "Current state" block above are dated 2026-09-26 and their counts have drifted — the current tree
measures **scripts 398/398 · src 2736 tests / 2726 pass / 10 skipped**, `npm run typecheck` exit 0
(both legs, `scripts/**` now covered as a per-file ratchet), `npm run lint` exit 0 / **0 warnings**,
CLI **39** verbs (`grep -c 'case "'`). W29–W46 are **committed** (no longer "uncommitted working
tree"), and limit #1 above holds only on the **keyless floor**: a keyed run emits a real multi-job
product (`treeRun.substance {stubs:0, reexports:0, real:3}` in `fixes/331_0_parent.md` §2;
`{stubs:0, reexports:0, real:2}` in `fixes/332_0_parent.md` §4).

**Corrections in force — appended 2026-10-03 (342-6 sweep; HEAD `686d7b6`):** the §10 census below is a
2026-09-30 snapshot and has drifted — live `git ls-files` reads **src 246 · src/lib 235 · scripts 49 ·
fixes 719 · wave_plans 139 · total 2,096**. `.t4scratch/` is still **192 tracked files** and still owes a
parent-signed `git rm` (it fails its own cleanup precondition — tracked, and named in live lane logs; see
`fixes/342_6_sweep.md`).

**Corrections in force — appended 2026-10-03 (345-F1 docs-truth fix; HEAD `06cb089`):** this block
supersedes the counts in the two corrections above and in every dated status block of this file. All
values re-derived from the bytes today:

- `git ls-files | wc -l` = **1,933** (was 1,908 / 2,096 in the snapshots); `.t4scratch/` is now
  **untracked/absent** (`git ls-files .t4scratch` = 0 — it was removed in the 342 wave, `73f660a`), so
  the "192 tracked files still owes a git rm" note above is closed.
- **scripts 49** tracked = 25 tools + 24 `*.test.mjs`; **src 250**; **src/lib 239** = 123 modules
  (90 direct + 33 subdirectory) + 112 colocated tests; **fixes 744**; **wave_plans 139**;
  **research/multiagent 103**; **research/eval-corpus 23**; **research/eval-out 345**.
- `tsc -p tsconfig.scripts.json --noEmit` exits **0** (the scripts program is clean; `ERROR_BUDGET`
  is empty) — the "1030 pre-existing" note is retired.
- The exit-code taxonomy is **0/1/2/3/4/5** (2 = park, 5 = the opt-in `--require-verified` state).
- The headless CLI **does** read `<cwd>/.env` (it wins over the process env by documented
  precedence); the older "does not read `.env`" lines are retired.
- Latest gate of record (the 343 wave, `fixes/343_0_parent.md` §1/§7): **scripts 427 pass / 0 fail ·
  lib 3261 pass / 0 fail / 2 skipped**, `gate.sh` `ok:true`, `hardFails:[]`, `flakes:[]` — the
  398/2736 values above are the 2026-10-02 record, not the current one.

**Corrections in force — appended 2026-10-04 (346 wave; HEAD `c16220b`):** this block supersedes the
counts and limits above. All values re-derived from the bytes this session.

- **Gate:** GREEN on the frozen tree (HEAD `c16220b` + the K1–K6 lanes) — scripts 452/0 · lib **3507
  pass / 0 fail / 2 skipped**, `ok:true`, `flakes:[]`, `hardFails:[]`. An earlier mid-wave run in this
  session returned `ok:false` on one child-spawn `compile-check.server` test that passes standalone and
  in isolation (the documented load-sensitive flake class) while sibling lanes were editing `src/**`,
  so it was not a controlled frozen-tree result. Exact JSON: `fixes/346_batch5_notes.md` §1.
- **Tracked counts (`git ls-files`):** total **1,951** · `src` 250 · `src/lib` 239 (112 test suites) ·
  `scripts` 52 (26 tools + 26 `*.test.mjs`) · `fixes` 759 · `wave_plans` 139 · `research/multiagent` 103.
  The 1,933 / fixes 744 / scripts 49 values above are superseded. New this wave:
  `scripts/factory-watch.mjs` + `factory-watch.test.mjs`, `scripts/store-crosstab.test.mjs`.
- **What landed this wave (346):** the walk-away orchestrator `scripts/factory-watch.mjs` (bounded
  intake → `create` → `unattended` → `emit --git`, durable checkpoint/resume, honest refusal, idempotent
  skip; `npm run factory`); the real Permission-Model bound for generated code (`isolation:"strict"`);
  tree/oracle behavioural parity (SB-2); injective knowledge fingerprints (SB-1); cross-tab lost-update
  fix + corrupt-blob rescue; console spend chip + honest seat provenance; CLI `emit --run --git` red-tree
  commit guard; honest P7–P12 coverage naming. Details: `fixes/346_e1…e4`, `346_v1/v2`,
  `fixes/346_batch5_notes.md`.
- **Honest limits that remain:** keyed P6 synthesis can still miss the P6 DoD and stall a keyed run;
  cross-family failover is NOT implemented (the un-armed switch was deleted; `RAPIDTOOL_FALLBACK_PROVIDERS`
  is inert); the autonomy flag needs a human-approved fixture row (`autonomousSoftwareFactory:false` by
  design — see `fixes/346_audit_autonomy.md`); the console approval still lacks an out-of-band
  seat-delivery seam (provenance recorded, not verified); Windows Job Objects are unavailable from pure
  Node; P7 `p7-research` is offline; prettier drift (244 `[warn]` files) is measured but NOT gated.

**Corrections in force — appended 2026-10-05 (346 wave batch 10; HEAD `2f0e3d7`):** this block
supersedes the counts, gate, and limits above. All values re-derived from the bytes and commands run
this session.

- **Gate of record — GREEN on the frozen tree (HEAD `2f0e3d7`, clean tree).**
  `& 'C:\Program Files\Git\bin\bash.exe' scripts/gate.sh` returned, as its single stdout JSON line:
  ```json
  {"ok":true,"double":false,"flakes":[],"hardFails":[],"quarantined":[],"quarantineCandidates":[],"skips":2,"wallMs":535223,"gates":{"typecheck":{"ok":true,"exit":0,"ms":54129},"lint":{"ok":true,"exit":0,"ms":20283,"problems":5},"assertionGaps":{"ok":true,"exit":0,"ms":1059},"build":{"ok":true,"exit":0,"ms":14581},"prevention":{"ok":true,"exit":0,"ms":3901,"missed":[],"pending":[],"skipped":[],"count":20,"countFloor":20},"testsScripts":{"ok":true,"exit":0,"ms":249046,"pass":513,"fail":0,"skipped":0},"testsLib":{"ok":true,"exit":0,"ms":191241,"pass":3712,"fail":0,"skipped":2}}}
  ```
  `gate.sh`'s own exit logic maps `ok:true` → exit 0. (A PowerShell wrapper may report exit 1 because
  bash's stderr progress lines trip PowerShell's `NativeCommandError`; that is a wrapper artifact, not
  the gate's code — the JSON verdict is authoritative.)
- **Tracked counts (`git ls-files`, re-derived 2026-10-15 at HEAD `30bce78` + the uncommitted
  W356/W357 lanes):** total **2,088** · `src` 262 · `src/lib` 250 (132 non-test + 118 colocated test
  suites) · `scripts` 152 (39 `*.test.mjs`) · `fixes` 783 · `wave_plans` 139 · root 42. The
  2,014 / `src` 256 / `src/lib` 244 / `scripts` 107 / `fixes` 761 / root 41 values above (the
  2026-10-05 snapshot at `2f0e3d7`) and the 1,951 values before them are superseded. Commands:
  `(git ls-files).Count`, `(git ls-files src).Count`, `(git ls-files src/lib).Count`,
  `(git ls-files "src/lib/*.test.ts").Count`, `(git ls-files scripts).Count`,
  `(git ls-files "scripts/*.test.mjs").Count`, `(git ls-files fixes).Count`,
  `(git ls-files wave_plans).Count`, `(git ls-files | Where-Object { $_ -notmatch '/' }).Count`.
  (Host: `node -v` → v24.15.0; the `engines` contract is `>=22`.)
- **Prevention harness (the keyless proof layer — the gate of record).**
  `node scripts/prevention/verify-prevention.mjs --all --selftest` → `ok:true`, `guards:20`,
  `countFloor:20`, both signals clean (`fixtureIntegrity.missed:[]`, `fixPresence.pending:[]`),
  `skipped:[]`. It is a wired additive `gate.sh` stage: the gate fails if a guard stops firing, a fixer
  seam stays `pending`, a guard is `skipped`, or the guard count drops below the floor.
- **Autonomy decision (PR-33, 2026-10-05):** Owner Open Question 1 = **Option A** — the additive
  `autonomousFactoryV2` + `fleetAcceptance` (seat `machine:tree-run`) beside the byte-identical
  human-gated `autonomousSoftwareFactory`; a machine path may never mint `decidedBy:"human"`. Rationale:
  the 338-4 anti-self-certification doctrine. Rejected: dropping the human conjunct. Full text and the
  rollout-flag defaults/rollback are in §"What it does **not** do yet" above.
- **Campaign #1 (keyed, 2026-10-05):** `workingApp` **0/8** (target ≥5/8); 6/8 stall at the P6 DoD gate;
  delivery truth PASSED (**0 empty-substance commits, 0 red-tree commits**). Evidence:
  `testruns\_report\CAMPAIGN1.md` / `CAMPAIGN1.json` / `campaign1-score.json`.
- **Honest limits that remain:** the keyed P6 productivity wall (above); no OS isolation beyond the
  runtime Permission Model bound (`isolation.sandbox:false`); the reserved human acceptance door;
  `resumeAccepted` now consumed by codegen (accepted-chunk reuse is effective — corrected
  2026-10-05); 5 lint warnings; cross-family failover unimplemented; the console seat-delivery seam
  open; P7 `p7-research` offline; prettier drift measured, not gated.

**Corrections in force — appended 2026-10-05 (346 wave batch 15 / X5 acceptance lane).** This block
supersedes the product-position, proof-layer-count and P6-resample claims above. Every number below was
re-derived this session from the file or command named beside it; where a doc and the bytes disagree,
the bytes win.

- **The chunked P6 resample is ARMED BY DEFAULT.** A refused chunk is retried with the SAME primary
  prompt (per-chunk acceptance) and the compiler-named fail-fast offender is re-synthesized with the
  SAME compiler-informed repair prompt; a deterministic validator selects the winner, so a chunk whose
  FIRST pipeline validates pays nothing. It is bounded ≤ **4** (`P6_SYNTH_CANDIDATES_MAX`); the armed
  chunk-lane default is **3** this session (`src/lib/synthesis-policy.ts:54`
  `P6_SYNTH_CHUNK_RETRY_CANDIDATES = 3`, guard `S4-01`). **`P6_SYNTH_CANDIDATES=1`** (or
  `deps.candidates: 1`) is the explicit opt-out and emits no `p6.synthesis.candidates` row. The
  **PRIMARY** single-module best-of-N + whole-tree pre-seal resample stay **opt-in**
  (`resolveSynthesisCandidates` default 1) — the armed lever is the chunk lane only.
- **The measured product position — with the variance stated.** Campaign #2 scored `workingApp`
  **2 of 8** (`testruns\_report\CAMPAIGN2.md` §5). The final keyed samples disagreed: the
  no-env-override confirmation `testruns\default-check\TUNING.json` scored **3 / 4** (generatedAt
  2026-10-05T12:57:59Z; ledger 966,170 tokens / 173 calls), and the opt-in tuning run
  `testruns\tuning\TUNING.json` scored **1 / 6** (generatedAt 2026-10-05T11:42:16Z; ledger 1,052,563
  tokens / 177 calls) — combined **4 / 10**. The same brief flips across runs: `mobile-companion` and
  `office-stock-tracker` are each `true` in default-check and `false` in the tuning sample;
  `bakery-website` is `true` in both, `bakery-florist-orders` `false` in both. **Variance is the
  dominant factor**; the binding wall is the **P6 DoD gate** (`RT_E_GATE_PENDING`), not the resample
  lever. Delivery honesty held throughout: **0 empty-substance commits · 0 red-tree commits**.
- **The proof layer at its current guard count: 27.** `node
  scripts/prevention/verify-prevention.mjs --all --selftest` → `ok:true`, `guards:27`,
  `countFloor:27`, both orthogonal signals clean (`fixtureIntegrity.missed:[]` ∧
  `fixPresence.pending:[]`), `skipped:[]`. The gate fails if a guard stops firing, a fixer seam stays
  `pending`, a guard is `skipped`, or the count drops below the floor. (The batch-10 block's "20
  guards" is superseded: the S4-01/S4-02/S4-03 wave guards rode in.)
- **Resample telemetry now rides the doctor, read from the persisted journal.** `fleetMetrics.resample`
  reports, per run and in aggregate, candidates requested / tried, winners / `noWinner`, the winner
  index per event, and the extra keyed calls (`Σ max(0, tried−1)`). Measured this session from the
  default-check journals: **3 of 4 runs recorded rows · 17 events · 34 requested · 25 tried · 14 winners
  · 3 no-winner · 8 extra keyed calls**; the single `doctor --project
  testruns\default-check\bakery-florist-orders\build.json` reading is `events:9, requested:18,
  tried:15, winners:6, noWinner:3, extraKeyedCalls:6`. `extraTokens` is **`null`** with
  `tokenAccounting:"not-recorded-in-journal"` — the candidate row records candidates, not token usage,
  and spend is never fabricated.
- **The machine reading reports its sample count.** `fleetAcceptance.sampleCount` + `evidencedRate` and
  `fleetMetrics.workingAppSamples` / `workingAppPass` / `workingAppRate` / `workingAppByBrief` (per
  sample) mean a single lucky run can no longer read as a fleet result; an absent `workingApp` verdict
  is not scored.

**Corrections in force — appended 2026-10-05 (346 wave batch 16 / Lane X close-out).** This block
supersedes the product-position, resample-token and sample-count claims above. Every number was
re-derived this session from the file or command named beside it; where a doc and the bytes disagree,
the bytes win.

- **Campaign #3 (keyed, 8 briefs, armed default `P6_SYNTH_CANDIDATES` unset ⇒ candidates 3):**
  `workingApp` **4 of 8** (`testruns\_report\CAMPAIGN3.md` + `CAMPAIGN3.json`; per-brief rows in §3).
  Delivery truth held: **0 empty-substance commits · 0 red-tree commits**; 2 trees withheld coded —
  `bakery-florist-orders` red trail (`RT_E_TREE_RUN_FAILED`), `office-invoice-tracker` below-floor
  (`RT_E_PLAN_UNDERPRODUCED`, HITL-parked exit 2). Campaign ledger
  `testruns\campaign3\ledger.json`: cap 3,000,000, **spent 948,586 tokens / 179 calls**, bound not
  tripped; wall 2,347 s; `estimatedCostUsd:null`.
- **S-1 two-sample (keyed, armed default, 4 default-check briefs):** sample1 **1/4** and sample2
  **2/4** — combined **3/8** (`testruns\s5-reliability\sample1\TUNING.json`,
  `sample2\TUNING.json`). `office-stock-tracker` flips `false`→`true` between the samples;
  `mobile-companion` and `bakery-florist-orders` are `false` in both; `bakery-website` `true` in both.
- **Combined position + variance.** Fresh final-wave samples (S-1 + campaign #3): **7 / 16
  (43.75%)**. All campaign/sample history (campaign #1 0/8 · #2 2/8 · default-check 3/4 · tuning 1/6
  · S-1 3/8 · #3 4/8): **13 / 42 (≈31.0%)**. The spread across identical armed-default code is the
  measurement: **no single run is the product**. The binding wall is the **P6 DoD gate**
  (`RT_E_GATE_PENDING`); the clause that now fails most is UI wiring (`mobile-companion`,
  `held-out-community-tool-library`).
- **Candidate-token accounting is measured, not null.** The producer (lane S S-4,
  `src/lib/synthesis-policy.ts` `candidatesLogDetail`) appends an optional trailing
  ` · tokens <int>` to the `p6.synthesis.candidates` row; the consumer (lane X X-1,
  `src/lib/acceptance.ts` `parseCandidateJournalRow` → `ResampleUsage`) sums it into `extraTokens`
  and sets `tokenAccounting:"journal"`. A legacy row stays `null` / `"not-recorded-in-journal"` —
  never estimated. Measured on campaign #3's own journals: **7/8 runs · 28 events · 84 requested ·
  55 tried · 20 winners · 8 no-winner · 27 extra keyed calls · `extraTokens` 293,152
  (`tokenAccounting:"journal"`)**; `doctor.ts` surfaces it via `fleetMetrics.resample.extraTokens`
  with `estimatedCostUsd` still `null` (X-4).
- **Landing corroboration (owned by sibling lanes; cited, not re-derived).** The form-bindable UI
  decision is in the working tree (`src/lib/scaffold.ts:1872-1908`, `wiredFormCallable` /
  `pickFormCallable`); the persisted-gate recompute is in the working tree
  (`src/lib/headless.ts:3441`, `p6.journey.gate-recomputed`) — campaign #3's `mobile-companion` is
  the live corroboration (drive P6 `RT_E_GATE_PENDING` while the persisted best tree's `treeRunOk`
  is true and it committed).
- **Tests:** `node --experimental-strip-types --test --test-reporter=tap src/lib/acceptance.test.ts
  src/lib/doctor.test.ts` → **108 pass / 0 fail**; `npx tsc --noEmit` exit 0.

## Progress so far (the paper trail)

Five multi-agent waves ran 2026-09-16 (25 flash subagents, every wave closed with `gate.sh`-class
green): W1 corruption-class fixes → W2 repair/consolidation (T-07/TA-2, gates wired) → W3
tree-run builds+tests (T-18), lesson-loop wiring, UI wave → W4 Wave-H cores + UI finish + T-14
pins + gate.sh's first green run → W5 policy routing through the approval seam, provider registry
+ role tiers, run-side eval graders with trials/pass@k — test counts at W5 close: scripts
**235/235** + src **1811/1811** (current counts: the dated Status block above). Second `gate.sh`
green. Since then: W6–W24 landing waves (logs `fixes/216*`–`fixes/247*`) → the **W25–W28 deep
audit** (`research/multiagent/thoroughanalysis.md`, ~230 finding IDs; HEAD commit `0f85c32`) →
**W29–W30** coder + shell sprints (`fixes/271*`, `fixes/272*`; the shell master table is
`finalsprint.md`) → **W31–W37** completion lanes (`fixes/273*`–`fixes/282*`; the current packs
are `wave_plans/W34/prep.md`, `W35/factory-notes.md`, `W36/completion.md`, `W37/master-pack.md`).
**Every landing is verified against bytes and logged:** the lane-log "landed" lists are claims —
the audits (CF-1/CF-2 rows, `fixes/274_wdx1.md`) byte-check them, and the register's corrections
win. The trail:

- `taskuniverselog.md` — the live board: every task, status, and what remains, per dossier.
- `fixes/` — append-only per-lane landing logs (convention + key numbers in §10.9).
- `wave_plans/` — the per-lane dispatch plans the agents actually followed (§10.10).
- `RESUME.md` — full session handoff + hard rules + settled decisions.
- `research/multiagent/` (103 files today — `git ls-files research/multiagent/ | wc -l` = 103) — the analysis program behind all of it (§10.8).
- **`remainingwaves.md` — every remaining wave, task by task, with the files each touches,
  estimates, likely bugs, and the tests each needs.** ← start there for "what's left".
- `finalsprint.md` + `wave_plans/W37/master-pack.md` + `wave_plans/W38/NEW-SESSION-PROMPT.md` —
  the current finish-line set (all tracked).

## Verification — how to check every claim above

```bash
bash scripts/gate.sh          # the one command: 6 gates, JSON verdict, exit 0 required
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor   # env/factory truth incl. autonomousSoftwareFactory
node --experimental-strip-types scripts/run-eval.mjs --out <dir>   # acceptance harness (fixtures) into YOUR dir
```

*(Corrected 2026-10-02 by the W50 boundary owner, from the W49 lane-336-4 work: the bare
`npm run eval` line used to be shown unqualified. A bare run now **refuses with exit 2** —
it would rewrite the tracked `research/eval-out/**`, which is why no wave had dared run it.
Pass `--out <dir>` (or `EVAL_OUT_DIR`) to write the scorecard into a scratch directory; an
explicit `--out research/eval-out` still regenerates the tracked copy on purpose. Keyless runs
are the deterministic floor; `--keyed` needs a funded key.)*

Nothing in this README is a promise — each row above is pinned by a test or a command you can
re-run. Where reality is behind, the docs say so, the packets say so, and `doctor` says so.

---

# THE CATALOG — every tracked file (2,088 today)

**What this is:** the literal catalog of the repository's tracked universe. Counts re-derived
2026-10-15 (W357 · `fix-preview` docs-truth; HEAD `30bce78` + the uncommitted lanes): `git ls-files` =
**2,088** (the prior 2026-10-05 value, 2,014, the 2026-10-04 value, 1,951, the 2026-10-03 value, 1,933,
and the earlier 1,908/2,096
values are superseded — `.t4scratch/` is no longer tracked). Every **root file, every script, every route,
every migration, every config** is named below; mass-produced classes (tests, wave plans, fix
logs, vault notes, eval trees, vault/E2E outputs) are described **by convention with their full
membership derivable from one command** — stated inline — because each member's purpose is its
category's purpose. Descriptions are evidence-based (file heads/comments read on 2026-09-26); a
genuinely unclear file says so. Re-count any directory with
`git ls-files <dir> | wc -l`; counts read the tracked index at HEAD `091b389` + the W44 wave's
staged changes (re-derived 2026-09-30 by the W44 wave — the W44 commit moved `fixes/`, `src/`,
`wave_plans/`, `scripts/` and root + Total together: 7 lane logs, 5 probe relocations, and the
eval/telemetry + MAX_FILES + store + seal/nit files. Re-count for the live truth).

## 10.1 Census (tracked, re-derived 2026-10-15 at HEAD `30bce78` + the uncommitted lanes)

| Area | Files | What it is |
|---|---:|---|
| `research/` | 476 | Analysis program + eval corpus + eval outputs (`multiagent/` 103 · `eval-corpus/` 23 · `eval-out/` 345 · 5 top-level research docs) |
| `fixes/` | 783 | Append-only per-lane landing logs (§10.9) |
| `src/` | 262 | The product: engine + UI (§10.6) |
| `wave_plans/` | 139 | Per-lane dispatch plans, W4–W24 · W26–W38 · W40 · W42 · W43 + the convention README (§10.10) |
| `.grok/` | 89 | Legacy platform chrome — **do not build on it** (§10.12) |
| `builds/` | 50 | Legacy sample build outputs (vault export + sample project) (§10.11) |
| `vault-e2e/` | 47 | Vault export of the HVAC Dispatch E2E project (§10.11) |
| `scripts/` | 152 | CLI + gates + guards + the keyless prevention/replay corpus + their tests (§10.7) |
| root | 42 | Every root file named in §10.2 |
| `screenshots/` | 16 | QA/app screenshots (§10.11) |
| `public/` | 10 | Static assets served as-is (§10.4) |
| `audit-bugs/` | 5 | Bug-audit reports (§10.12) |
| `audit/` · `review/` · `proposals/` | 3 + 3 + 3 | Audits, deep reviews, enhancement proposals (§10.12) |
| `server/` | 2 | Deployed-app PWA middleware + OG types (§10.4) |
| `migrations/` | 2 | Deploy SQL (§10.3) |
| `.github/` | 1 | CI workflow (§10.3) |
| `attachments/` · `artifacts/` · `.audit-g2/` | 1 + 1 + 1 | Historical artifact + stored image + G2 probe (§10.12) |
| `.t4scratch/` | 0 | Untracked/removed (was 192 tracked at `ac6b151`; stripped in the 342 wave, `73f660a`) |
| **Total** | **2,088** | `git ls-files \| wc -l` (per-area rows sum to the total) |

## 10.2 Root files (all 42 tracked — named)

| File | Purpose (evidence: head/comments read 2026-09-26/27) |
|---|---|
| `README.md` | This file — the catalog + honest state. |
| `AGENTS.md` | Repo-level agent working contract: layout, commands, honesty contract, ownership rules. |
| `AGENT_GUIDE.md` | Product-level guide: how an AI agent consumes a RapidTool project + the honesty contract in full. |
| `START-HERE.md` | The cold-start map (10-line tour, read order, verified commands, hard rules). |
| `LAUNCH.md` | Plain-English "how to start/use/close the app" guide (the Desktop shortcut + `scripts/launch-rapidtool.cmd`). Added after the 2026-09-26 catalog pass — the 42nd root file. |
| `RESUME.md` | Session handoff: gate contract, hard rules, settled decisions (written 2026-09-16). |
| `taskuniverselog.md` | Live task-status board: every dossier task, status, next wave. |
| `remainingwaves.md` | The execution catalogue: every remaining wave with tasks/files/estimates/tests. |
| `finalsprint.md` | W30 shell-sprint master table + lane polls + §S5; §MASTER-CORRECTIONS owed. |
| `docs-FOLDER-MAP.md` | Depth-2 map, one line per node, generated from `git ls-files` (W32). |
| `agentnotes.md` | Historical master working doc (pre-W5); banner says do not read as current. |
| `AGENTS.project.md` | Stale scaffolding: a Grok-project mount note ("files at /workspace/artifacts"). Ignore. |
| `LICENSE` | MIT (Copyright 2026 RapidTool contributors). |
| `package.json` | npm scripts + deps; name `app-builder-workspace`; engines node ≥22; scripts route through `with-app-env.mjs`; `test` runs both legs. |
| `package-lock.json` | npm lockfile (carries the linux optional bindings the CI `npm ci` resolves). |
| `.env.example` | Env template: `DEEPSEEK_API_KEY`, `TAVILY_API_KEY` + every advanced knob (documented inline). |
| `.gitignore` | Ignore rules: node_modules/dist, secrets (`.env*`), `*.log`, `.hermes/`, `**/.rapidtool/logs/`. |
| `.prettierrc` | Prettier config (`semi: true`, `singleQuote: false`, …). |
| `.prettierignore` | Prettier ignores (R15-f05). |
| `.node_modules.lock` | An **empty** marker file (0 bytes) — platform tooling sentinel. |
| `eslint.config.mjs` | ESLint flat config (js + prettier + react-hooks plugins). |
| `tsconfig.json` | TS config: strict, ES2022, bundler resolution, `allowJs`/`checkJs` for the migration-plan import. |
| `tsconfig.scripts.json` | Scripts-program TS config (R15-f04); puts the whole `scripts/**` tree inside a real `tsc` program. It is **CLEAN as of 2026-10-03** — `tsc -p tsconfig.scripts.json --noEmit` exits **0** and `scripts/typecheck-scripts.test.mjs`'s `ERROR_BUDGET` is empty (the old "1030 pre-existing" note was retired by W48 · 334-4). |
| `vite.config.ts` | Vite + TanStack Start + Nitro + Tailwind config: port 8080 + `strictPort` fixed contract; dev bind loopback by default (R11-f01), `RAPIDTOOL_BIND_ALL=1` opts out; PGLite bootstrap; serverDir `./server`. |
| `build.json` | Sample project file: "HVAC Dispatch" (the CLI quickstart's output, tracked as a fixture). |
| `w1-source-project.json` | Sample project file: "W1 Boot Probe" (used by W1-era probes). |
| `packet-e2e.md` | Sample **Agent Packet v2** ("HVAC Dispatch") — an E2E artifact kept as reference. |
| `design-e2e.html` | Sample design-system preview output ("HVAC Dispatch · Design system") from the `design` verb. |
| `phases-e2e.svg` | Sample `diagram` output: "HVAC Dispatch — phase pipeline". |
| `arch-e2e.svg` | Sample `diagram` output: "HVAC Dispatch — architecture". |
| `flow-e2e.svg` | Sample `diagram` output: "HVAC Dispatch — gate flow". |
| `startup.sh` | Legacy platform boot script (`cd /workspace` — this repo's root is elsewhere; ignore per AGENTS.md). |
| `probe-b2-before.ts` | Probe: legacy scaffold-emission baseline (fixes/144 M2/B2 before-evidence). |
| `probe-b2-runspec.ts` | Probe: materialize tree-mode scaffold + run the emitted oracle spec under `node --test`. |
| `probe-b2-tree.ts` | Probe: exercise tree-mode assembly (fixes/144 M2/B2). |
| `probe-h3-tap.ts` | W26 probe: does an async LLM call-tap escape its try/catch containment? |
| `probe-h3-tap-crash.ts` | W26 probe: same tap without an unhandledRejection listener (process-death path). |
| `probe-h3-balance.ts` | W26 probe: error class for HTTP 402 (the `RT_E_LLM_NO_BALANCE` doctrine). |
| `probe-r5-misc.ts` | Probe: tracing validation + render/vector fuzz. |
| `probe-r5-vector.ts` | Probe: `vector.ts` sanitizeSvg fuzz hypotheses. |
| `probe_h1_libcrash.ts` | W26 temp probe (hostile-input sweep); its own header says "deleted after the run" — it wasn't; kept for the record. |
| `err2.txt` | **Empty** (0-byte) stray — named like an stderr capture, never written to; tracked since `70108c6`; nothing references it (kept for the record). |
(2026-09-30: the W41/W44 `probe*.mjs` scratch probes now live under `fixes/` — `318_probe_*` from the W44 relocation; removed rows: `probe-k9-kinds.mjs` · `probe_n2_f316.mjs` · `probe_311_shots.mjs` · `probe_c1_arith.mjs` — see `fixes/318_a4_hygiene.md`)

## 10.3 `.github/` · `migrations/`

- `.github/workflows/gate.yml` — the ONE CI workflow: runs `scripts/gate.sh` unchanged, keyless by
  design. **Honest limit (in-file):** it has never executed (landed without a push run), and the
  ubuntu leg cannot catch this repo's Windows-path bug class; a commented windows leg exists but
  is deliberately not enabled.
- `migrations/auth/0001_auth.sql` — Better Auth schema (identity + sessions), generated by the
  Better Auth CLI; applied by `scripts/migrate.mjs` in `npm run build`, or by PGLite in dev.
  - `migrations/auth/0002_account_unique.sql` — the account-uniqueness migration (tracked).

## 10.4 `public/` · `server/`

- `public/favicon.svg`, `public/og.jpg` — site icon + OpenGraph image.
- `public/__grok/icon-180.png`, `public/__grok/install/styles.css`,
  `public/__grok/install/assets/homescreen/{glass-puzzle.svg, glass-share.svg, logo-grok.svg,
  ob-ipad.png, ob-phone.png, plus.svg}` — legacy platform PWA chrome assets (install page +
  home-screen tutorial imagery). Not product logic.
- `server/middleware/grok-pwa.ts` — deployed-app (Nitro) half of the platform PWA chrome
  (auto-registered because `vite.config.ts` sets `serverDir: "./server"`).
- `server/virtual-grok-og-identity.d.ts` — type declarations for the `virtual:grok-og-identity`
  module.

## 10.5 `src/` — top level

- `src/router.tsx` — the TanStack router factory (error components + telemetry client install).
- `src/routeTree.gen.ts` — **generated** by the TanStack router plugin; never hand-edit.
- `src/styles.css` — Tailwind v4 entry (`@import "tailwindcss"` + `@theme` tokens).
- `src/components/` (5): `console.tsx` (the main console surface — ~6.8k lines),
  `cmd-palette.tsx` (⌘K command palette over run actions), `runtime-timeline-pane.tsx` (typed
  timeline sibling of the Runtime log tab), `pipeline-rail.tsx` (the pipeline-visibility rail —
  P0→P12 rows from `project.phases`, the Now-line from the newest real event, and per-phase
  detail incl. the wild/park record), `preview-host-bridge.tsx` (mounts once in `__root` so the
  preview chrome can drive navigation; noops when not embedded).
- `src/routes/` (3): `__root.tsx` (root layout + auth provider), `index.tsx` (HomeScreen from
  `console.tsx`), `run.$id.tsx` (RunScreen from `console.tsx`).

## 10.6 `src/lib/` — the engine (250 files = 132 non-test + 118 colocated tests; re-derived 2026-10-15)

**90 direct `.ts` modules** (one line each; the module's comments read 2026-09-26/27; re-counted 2026-10-03):

- **Core:** `engine.ts` (13-phase state machine: applies phase results, gates, repairs, sealing) ·
  `phases.ts` (phase graph defs + coverage/transition helpers) · `store.ts` (zustand store — the
  console's state driver) · `types.ts` (core project/phase types) · `errors.ts` (the `RT_E_*`
  registry; `ERROR_CODE_DOC` is canonical) · `dod.ts` (machine-checkable DoD gate registry) ·
  `io.ts` (project import/export + packet export; shape validation + repair) · `packet.ts` (Agent
  Packet v3 compiler) · `headless.ts` (file-based headless driver; the CLI backend) ·
  `judgment.ts` (phase verdict ladder) · `scorecard.ts` (read-only eval scorecard) ·
  `gate-stats.ts` (approval-health gate).
- **Synthesis / emit / run:** `codegen.server.ts` (keyed P6 synthesis, chunked + bounded repair) ·
  `scaffold.ts` (the emitted-tree writer; E-15 emitter + kind entry wiring) ·
  `compile-check.server.ts` (per-file compile verdicts + dir tree-run) · `node-runner.server.ts`
  (bounded local code runner — NOT a sandbox) · `sandbox.ts` (banned-primitive denylist scan) ·
  `sandbox-policy.ts` (runner isolation-claim text) · `exec.ts` (client-facing bounded-runner
  contract) · `write-set.ts` (SSSF-style write-set rollback) · `patch.ts` (`str_replace`
  primitive) · `verify.server.ts` (machine verify-fix loop) · `verify.ts` (its client-safe seam) ·
  `maker-score.ts` (pure M1..M9 rubric) · `token-ledger.ts` (spend vs hard cap) · `compaction.ts`
  (compaction constants + summary template) · `checkpoint.server.ts` (versioned atomic run
  checkpoint — resume after a crash/kill, T-107.7) · `quarantine.ts` (the forced-emit quarantine-move
  seam — module + test landed; **CLI wire landed** (W42: `emit --force` moves survivors aside +
  reports `quarantined`/`quarantineDir`); the in-engine lift for every forced caller owed, R11-f08).
- **LLM / providers / research:** `llm.ts` + `llm-tasks.ts` (client-facing LLM contract +
  helpers) · `deepseek.server.ts` (thin re-export of the provider) · `tavily.server.ts` (Tavily
  search) · `websearch.server.ts` (keyless free web search) · `bounded-int.ts` (the one bounded-
  integer knob sanitizer shared by both search providers, W40 N4) · `research.ts` (client web-research
  contract) · `harvest.ts` (bounded live-source harvester) · `cassette.ts` (deterministic LLM
  record/replay) · `chat.ts` + `chat.server.ts` (copilot chat contract + grounded server core) ·
  `prompt-engine.ts` (hyper-prompt expansion + policy constraints).
- **Governance / learning / advisory:** `policy.ts` (the ONE approval seam, default-deny) ·
  `knowledge.ts` (cross-project pattern store) · `planning.ts` (plan-then-act scaffold) ·
  `subagent.ts` (bounded delegation contract) · `crew.ts` + `crew.server.ts` (multi-agent crew
  contract + orchestrator) · `swarm.ts` (advisory swarm layer) · `bench.ts` (synthetic dry-run
  estimates) · `ast-mine.ts` (structural codebase map) · `arch-tools.ts` (architecture surface) ·
  `algo-tools.ts` (algorithm workbench) · `vector.ts` (vector/logo generation) · `design.ts`
  (design tokens + preview HTML) · `diagram.ts` (standalone SVG diagrams) · `tracing.ts` (trace
  model) · `watchdog.ts` (wild-loop freeze decisions) · `diagnose.ts` (diagnosis builder) ·
  `doctor.ts` (environment/factory truth incl. `autonomousSoftwareFactory`) ·
  `wild-mode.server.ts` (wild auto-review supervisor classifier) · `wild-review.ts` (node-side wild
  supervisor completer seam, R14-f01).
- **Telemetry:** `rt-events.ts` (types) → `rt-ring.ts` (bounded ring) → `rt-client.ts` (browser
  glue) → `rt-timeline.ts` (NDJSON→timerows) · `runtime-log.server.ts` (NDJSON disk appender) ·
  `error-scan.server.ts` (error scan).
- **Plumbing / features:** `report-intake.ts` (external report validate/apply) · `handoff.ts`
  (per-phase handoff prompts) · `vault.ts` (Obsidian-style vault export) · `render.ts` (XSS-safe
  markdown blocks) · `templates.ts` (brief templates) · `brief-fixtures.ts` (fixture core) ·
  `fixtures.ts` + `fixtures.server.ts` + `fixtures.review.ts` (fixtures review data/server/client)
  · `git.server.ts` (git landing tail, W18) · `plugin.ts` (hook registry v1) ·
  `server-spec.ts` (the ONE runtime-assembled `*.server.*` specifier helper, A1-12) ·
  `algorithms.ts` (fusionRank/stemming/tokenizer) · `db.ts` (PGLite/Postgres bridge; applies
  migrations) · `error-component.tsx` (route error UI) · `preview-embedder-origin.ts` +
  `preview-host-bridge.ts` (preview postMessage trust model + guest side).

**35 subdirectory modules** (33 `.ts` + 2 `.tsx`; re-derived 2026-10-03 — `app-data/` 6 · `auth/` 17 · `llm/providers/` 8 · `mcp/` 1 · `multiplayer/` 2 · `testing/` 1; the flagged `auth/.hermes-tmp.*` stray temp is no longer tracked —
`git ls-files src/lib | grep -i tmp` is empty): `app-data/` (6: `index.ts` barrel, `server-only.ts` guard,
`client.server.ts` connector client, `errors.ts`, `login.ts`, `types.ts` — platform app-data
bridge) · `auth/` (17: `client.ts`, `server.ts` (self-hosted Better Auth), `gates.tsx`,
`middleware.ts`, `provider.tsx`, `providers.ts` (upstream IdPs), `email-password.ts`,
`gate-identity.server.ts` + `gate-session.server.ts` + `gate-session-marker.ts`,
`isolation.server.ts`, `pglite-dialect.ts`, `popup.server.ts`, `preview.ts`, `sign-in-gate.ts`,
`use-current-user.ts`, `verify.server.ts` — the whole sign-in/gate stack) · `llm/providers/`
(8: `registry.ts` — provider registry + role tiers; `deepseek.ts`; `openai-compatible.ts`;
`probe.ts`; `mock.ts` — deterministic zero-network mock; `key-resolution.ts` + `key-source.server.ts`
— the W45 `.env`-wins key precedence; `one-shot-fetch.server.ts`) · `mcp/` (`stub-server.ts` —
spawned stdio test fixture for the MCP client, not production code) · `multiplayer/` (`index.ts`,
`p2p.ts` — WebRTC full-mesh room client; staged, no live coturn) · `og/site.json` (OG metadata) ·
`testing/fixtures.ts` (shared deterministic engine fixtures for tests).

**112 colocated test suites** (the "how it's verified" map — each test file pins its
subject-named contract; count re-derived 2026-10-03: `git ls-files src/lib | grep -c '\.test\.'` = 112 — 99 top-level + 13 subdir):
`algo-tools` · `algorithms` · `arch-tools` · `ast-mine` · `bench` · `bounded-int` · `brief-fixtures` ·
`cassette` · `chat` · `checkpoint.server` · `codegen.server` · `compaction` · `compile-check.server` ·
`crew` · `deepseek.server` ·
`design` · `determinism-guard` · `diagnose` · `diagram` · `doctor` · `emitted-honesty` ·
`error-scan.server` · `errors` · `exec` · `fixtures` · `gate-stats` · `gates` · `git.server` ·
`handoff` · `harvest` · `headless` · `honesty-guards` · `io` · `judgment` · `knowledge` ·
`lesson-writers` · `llm` · `llm-tasks` · `maker-score` · `node-runner.server` · `packet` · `patch`
· `patch-preservation` · `phases` · `planning` · `plugin` · `policy` · `policy-overlay` ·
`preview-host-bridge` · `prompt-engine` · `quarantine` · `render` · `report-intake` · `research` · `rt-client` ·
`rt-events` · `rt-ring` · `rt-timeline` · `runtime-log.server` · `sandbox` · `sandbox-policy` ·
`scaffold` · `scorecard` · `store` · `subagent` · `swarm` · `sweep73-fuzz` · `token-ledger` · `tracing` ·
`typed-failures` · `vault` · `vector` · `verify` · `verify.server` · `watchdog` · `websearch` ·
`wild-mode.server` · `wild-step` · `write-set` · `zero-byte-guard` (each `.test.ts`); subdir
suites: `app-data/app-data.test.ts`, `auth/gate-identity.test.ts`, `auth/sign-in-gate.test.ts`,
`llm/providers/mock.test.ts`, `llm/providers/registry.test.ts`,
`llm/providers/registry-failover.test.ts`. Note: a few modules are pinned
from sibling suites rather than a same-named file (e.g. there is **no** `engine.test.ts` — the
engine's contracts are pinned from `headless.test.ts`, `gates.test.ts`, `judgment.test.ts` and
others). (The enumerated names above are the last full hand-list; the count of record is the live
`git ls-files src/lib | grep -c '\.test\.'` = 112 — re-derive rather than trusting this list.)

## 10.7 `scripts/` — CLI, gates, guards, tooling (107 tracked = 74 tools/guards/prevention + 33 `*.test.mjs`; re-derived 2026-10-05)

> **Correction (2026-10-05):** the 2026-10-04 count was 52 (26 tools + 26 tests). Batches 9–10 added the
> keyless proof layer to `scripts/` — `scripts/prevention/**` (the replay harness, `guard-registry.json`,
> and the campaign-1 cassette corpus under `scripts/prevention/cassettes/campaign1/`), plus the new
> `scripts/guards/campaign-invariants.mjs` + `campaign-pins.test.mjs`. The per-directory enumeration
> below is the last hand-list; the count of record is the live `git ls-files scripts | wc -l` = 107.
> Test-suite count of record: `git ls-files scripts | grep -c '\.test\.mjs$'` = 33.

- **CLI:** `rapidtool-cli.mjs` — the headless driver, **39 verbs** (count source of truth:
  `grep -c 'case "'`), one JSON object per call, exit taxonomy 0/1/2/3/4/**5**.
  `README-cli.md` — its agent-facing machine contract (verbs, exits, `RT_E_*`, the `edit`/`emit`
  sections; doc-contract tested). `README-cli.test.mjs` — that doc-contract test: binds the
  README-cli headline count + verb list + USAGE parity + edit/emit sections to the dispatcher's
  bytes (do not edit either file without re-running it).
- **Factory/orchestration:** `factory-watch.mjs` — the walk-away orchestrator (346): ONE bounded tick
  that drains a brief intake through `create → unattended → emit --run (verify) → emit --git
  (deliver)`, with durable checkpoint/resume, idempotence, honest refusal, and corrupt-state refusal;
  `npm run factory` runs it. Not a daemon — a host hook (Task Scheduler / cron) is the scheduler.
- **Gate:** `gate.sh` — the stability gate: typecheck → lint → assertion-gap lint → both test
  legs → build; one JSON verdict on stdout; `--double` = flake detector (exit 3); `--quarantine` =
  bounded opt-in retry for the allowlisted load-sensitive child-spawn class (default OFF).
- **Eval:** `run-eval.mjs` — the maker-loop eval driver (keyless deterministic floor; `--keyed`
  for real runs; grades corpus fixtures, writes `results.json` + `history.json` into `--out`
  (or `EVAL_OUT_DIR`); a bare run against the tracked `research/eval-out` is **refused with
  exit 2** unless you name it explicitly — W49 lane 336-4, corrected 2026-10-02).
- **DB:** `migrate.mjs` (deploy-time migrator, `pg`; runs inside `npm run build`) ·
  `migration-plan.mjs` (bookkeeping shared by migrate.mjs + `src/lib/db.ts`; pure).
- **Env/tooling:** `with-app-env.mjs` (merges `.grok/app-env.json` into npm script envs) ·
  `app-env-plugin.mjs` (dev-only `/__app-env` endpoint) · `write-atomic.mjs` (stage→rename file
  handover for agents) · `sign-out-plan.mjs` (pure sign-out sequence used by
  `auth/client.ts`) · `path-safety.mjs` (physical-containment helper R11-f07) ·
  `docs-module-parity.mjs` (advisory doc-vs-disk scanner — never a gate).
- **Preview/browser:** `preview.mjs` (owns :8081 built-output QA preview; restart/stop) ·
  `preview-thumbnail.mjs` (1280×800 preview PNG capture) · `browser-smoke.mjs` (Playwright smoke) ·
  `browser-smoke-verdict.mjs` (verdict normalization seam) · `browser-guard.mjs` (target checks
  shared by the capture scripts; loopback-only guard) · `brand-check.mjs` (brand-asset gate for
  canvas apps).
- **Platform PWA (legacy chrome):** `grok-pwa-plugin.mjs` (Vite half — `?install=1` tutorial +
  manifest) · `grok-pwa-shared.mjs` (shared head-chrome source) · `grok-pwa-shared.d.mts` (types)
  · `install-page.html` (the Home-Screen install tutorial page).
- **Guards:** `check-assertion-gaps.mjs` (T-17 tautology/zero-assertion lint, wired into
  gate.sh) · `check-auth-invariant.mjs` (dev-vs-build `VITE_AUTH_ENABLED` agreement: fail loudly).
- **Test suites (26):** `README-cli.test.mjs` (CLI doc-contract) · `factory-watch.test.mjs`
  (orchestrator contract + keyless E2E) · `store-crosstab.test.mjs` (cross-tab store merges) ·
  `rapidtool-cli-edit.test.mjs` +
  `rapidtool-cli-lesson.test.mjs` (verb contracts) · `rapidtool-cli-fixtures.test.mjs` (fixtures
  verb contract) · `cli-exit-taxonomy.test.mjs` (exit-code class guard, OPS-3) ·
  `cli-run-busy.test.mjs` (busy-flag exits + the crew `--max-steps` key leg, H7/317) ·
  `gate-verdict.test.mjs` (a red leg can never produce a green verdict) · `chat-stream.test.mjs`
  (chat streaming) · `next-action-arm-parity.test.mjs` (next-action ↔ dispatcher parity) ·
  `test-name-pattern-guard.test.mjs` (the `--test-name-pattern` no-op trap) ·
  `check-module-coverage.test.mjs` (the R9-f05 reachability ratchet) ·
  `typecheck-scripts.test.mjs` (the scripts-tree tsc coverage + per-file budget ratchet) ·
  `run-eval.test.mjs` · `migration-plan.test.mjs` · `brand-check.test.mjs` ·
  `browser-guard.test.mjs` · `browser-smoke-verdict.test.mjs` · `check-assertion-gaps.test.mjs` ·
  `check-auth-invariant.test.mjs` · `grok-pwa-plugin.test.mjs` · `preview.test.mjs` ·
  `sign-out-plan.test.mjs` · `with-app-env.test.mjs` · `write-atomic.test.mjs`.

## 10.8 `research/` (476)

- **`research/multiagent/` (103)** — the analysis program. The register/ledger trio:
  `thoroughanalysis.md` (**the finding register** — mission preamble + append-only protocol;
  read it before writing), `thoroughaction.md` (live action ledger of the W25 watchdogs),
  `vault-notes-sample.md` (sample vault output). The dossier sets, newest goals first:
  **factory upgrade (100–112)** — `100_factory_blockers`, `101_provider_integration`,
  `102_code_quality_signals`, `103_feature_gaps`, `104_factory_upgrade_plan` (the master plan),
  `105_plan_critique`, `106_rapidtool_deep_analysis`, `107_competitors_agentic`,
  `108_competitors_app_generators`, `109_bughunt_core`, `110_ui_audit_vs_competitors`,
  `111_ui_design_research`, `112_code_judgment_and_learning`; **overhaul/audit era (219–263)** —
  `219a…219f` (inventory→reality→defects→autonomy blockers→self-improvement→competitor codebases),
  `220_overhaul_plan` + `220_tasklist_canonical` + `220_external_verification`, `221_feature_designs`,
  `222_codebase_integration_map`, `223_critical_path_premortem`,
  `224_advantage_gap_and_plan_audit`, `225_field_failures_forensics`,
  `226_shortcomings_and_plan_stress`, `227_plan_gaps_adversarial`,
  `229_steering_and_goal_alignment`, `230_task_execution_playbook`, `232_plan_improvements`,
  `234_engineering_depth_audit`, `235_execution_readiness_audit`, `240_missing_tasks_audit`,
  `241_weak_verification_strengthenings`, `249_define_first_specs`,
  `262_agents_md_proposal` (the unlanded AGENTS.md doctrine patch), `263_state_of_play`;
  **competitor/type studies (86–99)** — `86_kanban_analysis`, `87_renamepro_analysis`,
  `88_statkit_analysis`, `89_self_learning_research`, `90_LEAPFROG`, `91`/`92_software_types`,
  `93_design_flaws` (DF ledger), `94_readiness_plan`, `95_leapfrog_continuation`,
  `96_engineering_completion`, `97`/`99_coffeehouse2home*` (the mission app),
  `98_make_1…98_make_5` + `98_readiness_exec`, `99_engineering_exec`; **early waves (01–43)** —
  the origin dossiers (`01_open_source_harnesses`, `02_capability_audit`, `03_crew_design`,
  `04_verification_design`, `05_guide_research`, `05_live_guidance`, `06_competitor_survey`,
  `07_opensource_steal_catalog`, `08_enhancement_register`, `09_agent_perfection_audit`,
  `10_production_readiness`, `11_agency_plan`, `11_live_fixes`, `13_top20_gaps`,
  `14_agi_aggregation`, `15_feasibility_review`, `16_utility_review`, `17_agent_ux_review`,
  `18_chat_ux_research`, `19_chat_integration_plan`, `20_wave3_verification`,
  `21_plain_english_guide`, `23_debug_lead`…`34_cli_anchors` (the debug/hunt series),
  `37_production_proof`…`43_hunt_pipeline_memory`). Full list: `git ls-files research/multiagent | sort`.
- **`research/eval-corpus/` (23)** — the acceptance corpus: `README.md` (contract) + **11 brief
  fixtures** (`arcade-breakout.md`, `coffeehouse2home-property-ledger.md`, `date-rrule-library.md`,
  `field-ops-suite.md`, `house-flip-manager.md`, `invoice-csv-cli.md`, `order-webhook-service.md`,
  `permit-inspection-tracker.md`, `real-estate-crm.md`, `rental-portfolio.md`,
  `showing-booking.md`) + **11 frozen graders** (`graders/<slug>.grader.json`).
- **`research/eval-out/` (345)** — tracked trial outputs. Top level: `results.json` (the
  acceptance scorecard — last written 2026-09-25 in keyed mode), `history.json` (run history),
  `run-in-progress.json`, `_keyed-launcher.sh` (the keyed-run launcher). The other 341 files are
  19 emitted trees — 6 corpus slugs × {base, `--trial-1`, `--trial-2`} plus
  `coffeehouse2home-property-ledger.run-2026-09-10` (the `{0,5,0}` vintage) — each tree carrying
  the emitted scaffold's standard set: `package.json`, `tsconfig.json`, `vite.config.ts`,
  `index.html`, `README.md`, `DEPLOY.md`, `.env.example`, `.rapidtool/project.json`, `src/**`,
  `tests/oracle.spec.ts`. (`permit-inspection-tracker` has a brief + grader but no tracked trial
  output yet.)
- **Research top level (5):** `01_parallel_repos_research.md`, `02_industry_sdlc_grading_research.md`,
  `03_tech_deep_dives_research.md` (the origin research set, 2026-09-04) · `deepseek-api.md`
  (live-verified API spec) · `runtime-integration.md` (runtime/hosting research).

## 10.9 `fixes/` — the append-only landing-log ledger (759 tracked; re-derived 2026-10-04)

**Convention:** one `fixes/NN_<lane>.md` per lane per wave; append-only; each log carries
what/why + `file:line` evidence + before/after. The numbering is chronological: the newest number
is the current wave. Tracked today: the `01`–`99` early series, the **`216a`–`216t` Wave-4/5 set**
(incl. `216j_honesty_tooling.md`, `216n_wave_h_primitives.md`, `216s_cli_wave.md`), the
`100`–`270` era (233 three-digit logs; **`218_*` §5 = the W12 boundary gate of record**), and
`pro1`–`pro4_*.md`. The **W29–W41 set (`271`–`294`)** is tracked too: `271_lane*`, `272_s1…s5`
shell lanes, `273_t1…t5`, `274_wdx1/wdx2/wdx3` watchdogs, `275_organizer`, `276`–`283` completion
lanes + `283_final_ledger.md`, `284_wiring_guarantee`, `285_g2…g4`, `286_readme_catalog.md`,
`287_z5_runtime_tail.md`, `288`–`289` pickups, `290`–`294` per-lane wave-41 logs; the `295`–`304`
tail set (wave-41/42 logs + probes + the eng-review pair + the C/D-wave lane logs) is tracked too —
the `305_*` round-3 lane logs arrive untracked from the live W42 tail).
**How to search them:** `git ls-files fixes | sort | tail -30` (newest); `grep -l "<term>"
fixes/*.md`; or grep the register's fix references (`R*`/`A*` IDs cite their fix logs).

## 10.10 `wave_plans/` — dispatch plans (139 tracked; W4–W24 · W26–W38 · W40 · W42 · W43; re-derived 2026-10-03)

**Convention:** `wave_plans/README.md` owns it — every wave dispatch ships ONE notes file per lane
(`wave_plans/W<N>/lane-<K>.md` or a named lane doc), ordered for speed: mission → owned files →
numbered mini-task plan → parent findings/traps → verification commands → logging rules. Tracked
waves: **W4–W24 + W26–W38 + W40 + W42 + W43** (139 files incl. `README.md`; W4–W10 five lane files each, W11 7,
W12 8, **W13 25** (its audit/design/eng/guard/improver/playbook/wd/x lanes), W14 3, W15 2, W16–W28
one file each; then the former working-tree set, now tracked): `W29/coders.md`,
`W30/shell-sprint.md`, `W31/gap-finshers.md`, `W32/organizer.md`, `W33/unlanded-block.md`,
`W34/{prep,code-notes}.md`, `W35/factory-notes.md`, `W36/completion.md`, `W37/master-pack.md`,
`W38/NEW-SESSION-PROMPT.md` · `W42/SPEC.md` · `W43/COMPLETION-TASKS.md`.

## 10.11 `builds/` · `vault-e2e/` · `screenshots/`

- **`builds/` (50)** — legacy sample build outputs: `recipe-box.json` (a sample project file for
  the "recipe box" brief — its first 103 keys are a character-indexed dump of the brief string, an
  early-serializer artifact, followed by the normal project fields), `recipe-box.svg` (its phase
  pipeline diagram), and `vault.md/` — **48 markdown notes** (a full vault export: index, P0–P12
  notes, gate-decision notes, ADR/context notes). Note: several vault filenames contain `·`/`–`
  (unicode) and spaces — quote paths in every command.
- **`vault-e2e/` (47)** — the same vault shape, exported for the **"HVAC Dispatch"** E2E project
  (`HVAC Dispatch · Vault Index.md` + P0–P12 + gate notes). All `.md`; unicode filenames as above.
- **`screenshots/` (16)** — QA capture set: `app-builder-built.png` + `-mobile` + `.json` and
  `app-builder-preview.png` + `-mobile` + `.json` (builder screens + capture metadata),
  `clinic-p4.png`, `console-algos.png`, `console-run.png`, `crew.png`, `crew-active.png`,
  `oracle.png`, `packet.png`, `sandbox-pass.png`, `spec.png`, plus `.gitkeep`.

## 10.12 audits, proposals, legacy, misc

- `audit/` (3): `01_core_engine_algorithms_audit.md`, `02_ui_console_multiplayer_audit.md`,
  `03_auth_appdata_platform_audit.md` — the 2026-09-04-era module audits.
- `audit-bugs/` (5): `01_core.md`, `02_ui_store.md`, `03_server_hosting.md`,
  `04_scripts_integration.md`, `05_multiagent.md` — per-area bug lists.
- `review/` (3): `01_deep_audit_current.md`, `02_purpose_walkdown_gap.md`,
  `03_competitor_usefulness_agentinputs.md` — deep-review records.
- `proposals/` (3): `01_ux_product_enhancements.md` (E-101…E-118), `02_algo_engine_repairs.md`,
  `03_arch_quality_enhancements.md` — evidence-cited enhancement candidates.
- `attachments/RapidTool_Complete_Master.md` — a historical persona/prompt artifact; its banner
  says do NOT load it as this product's behavior (it asserts capabilities RapidTool lacks).
- `artifacts/imagine_images/a825da57-…jpg` — one stored image artifact from an early
  image-generation experiment.
- `.audit-g2/probe.mjs` — the G2 auditor's probe (deterministic refused-P6 journey + lesson
  read-back, keyless).
- **`.grok/` (89) — legacy platform chrome; per `AGENTS.md` do not build on it:** `app-env.json`
  (shipped `VITE_AUTH_ENABLED: "false"` + deploy block), `status` (workspace-server READY JSON),
  `references/` (6 integration references: `browser-qa.md`, `data-and-auth.md`,
  `deploy-target.md`, `generated-art.md`, `hibernate-revive.md`, `scaffold.md`), `skills/`
  (18 skill packs: `auth`, `building-games`, `controls`, `design-ui`, `game-animation-frames`,
  `game-asset-core`, `game-character-consistency`, `game-tilesets`, `game-ui-icons`,
  `generate2dmap`, `generate2dsprite`, `imagine`, `multiplayer-p2p`, `neon`, `og`, `threejs`,
  `video2dsprite`, `xai-api` — each a `SKILL.md` + references (+ 5 `.py` helper scripts under
  `generate2dmap`/`generate2dsprite`/`video2dsprite`)). Keep-or-descope is decided in
  `research/multiagent/94` §B1 / `96`; do not delete or extend until that lands.

## 10.13 Working-tree state — the former "not yet tracked" set (superseded 2026-09-27)

The W29–W41 era was committed at HEAD `ac6b151` and the formerly-untracked set is now **tracked**:
the docs (`START-HERE.md`, `finalsprint.md`, `docs-FOLDER-MAP.md`, `tsconfig.scripts.json`,
`.prettierignore`), the `src/lib/` set (`checkpoint.server.ts` + test, `quarantine.ts` + test,
`wild-review.ts`, `llm/providers/registry-failover.test.ts`), the scripts guards
(`cli-exit-taxonomy.test.mjs`, `gate-verdict.test.mjs`, `rapidtool-cli-fixtures.test.mjs`,
`path-safety.mjs`, `docs-module-parity.mjs`), `migrations/auth/0002_account_unique.sql`,
`wave_plans/W29…W38/*`, `fixes/271…286` (50 logs) and `.t4scratch/` (192 — it has its own §10.1 row
now). Gitignored and never printed: `.env` (secrets), `.env.bak-*`, `_*.log` scratch captures
(kept on purpose — `docs-FOLDER-MAP.md`), `.hermes/`.

---

## Docs index

| Doc | Purpose |
|---|---|
| `README.md` | This file — quickstart + honest state + **the full tracked-file catalog** (§10). |
| `START-HERE.md` | Cold-start map + verified run commands + hard rules. |
| `RESUME.md` | Session handoff: gates contract, hard rules, settled decisions. |
| `AGENTS.md` | Agent contract: mandatory reads, working rules, honesty contract. |
| `AGENT_GUIDE.md` | How an agent consumes a RapidTool project (product-level). |
| `remainingwaves.md` | **Every remaining wave** with tasks/files/estimates/bugs/tests. |
| `taskuniverselog.md` | Live task board (status of every task from every dossier). |
| `finalsprint.md` | W30 shell-sprint master table (what's REAL vs shelled) + lane polls. |
| `docs-FOLDER-MAP.md` | Depth-2 folder map, one line per node. |
| `research/multiagent/thoroughanalysis.md` | **The register** — mission preamble + all findings (read the protocol first). |
| `research/multiagent/94_readiness_plan.md` · `93_design_flaws.md` · `90_LEAPFROG.md` · `96_engineering_completion.md` | The plan/defects/strategy/scorecard set `AGENTS.md` sends feature work through. |
| `research/multiagent/104_factory_upgrade_plan.md` | The factory-upgrade master plan (`RESUME.md` indexes it). |
| `scripts/README-cli.md` | CLI verb reference + exit taxonomy + `RT_E_*` (doc-contract tested). |
| `packet-e2e.md` · `design-e2e.html` · `*-e2e.svg` | Sample outputs (packet / design system / diagrams). |
| `fixes/` | Append-only landing logs (newest number = current wave). |
| `wave_plans/` | Per-lane dispatch plans (convention in `wave_plans/README.md`). |

## Corrections in force — appended 2026-10-05 (quality-system lane: gate honesty + evidence class + determinism)

This block supersedes every earlier claim in this file that disagrees with the bytes below. All
values were re-derived this session; where a doc and the bytes disagree, the bytes win.

- **The gate accepts skips no longer silently, and is no longer blind to untested modules.**
  `scripts/gate.sh` gained an ADDITIVE `moduleCoverage` stage (`node scripts/check-module-coverage.mjs
  --json`) folded into the verdict — an unallowlisted `src/lib` gap or a stale allowlist entry is a
  hard failure — and a **skipped-test registry**: every TAP `# SKIP` leaf name must be an explicitly
  reviewed, justified entry in the NEW `scripts/skip-registry.json`, or the gate fails; a `# skipped
  N` summary with no parsed `# SKIP` line fails closed. The two registered skips today are the
  opt-in `RT_VERIFYKIND_INSTALL=1` real-npm leg and the keyed-host `promptExpand not-configured` path.
- **`gate.sh --double` now folds run 2's exit.** A run-1-green / run-2 runner-crash (non-zero exit,
  no TAP failure lines) is a hard failure, not `ok:true`; both test legs' run-2 exit codes are
  consulted (fixes the `testsScripts2.exit`-written-but-never-read hole; self-check pins in
  `scripts/gate-verdict.test.mjs`).
- **The prevention count floor is now immutable and reviewed.** It lives in the NEW
  `scripts/prevention/cassettes/guard-floor.json` (34 pinned guard ids), NOT in the mutable
  `scripts/guards/guard-registry.json`; `verify-prevention.mjs` asserts the pinned floor and the
  pinned guard-id set independently, so deleting a guard AND lowering the registry `countFloor` in
  one edit still fails. The registry `countFloor` may only RAISE the effective floor.
- **A green gate records the EVIDENCE CLASS it accepted.** `runGate(...).evidenceClass` names what
  each PASS verified and sets `productBuildVerified:false` for P6 — `p6-verified` accepts executed
  tree-run spec tests (NOT the emitted `package.json`'s declared `typecheck`/`build`), so a green
  gate can no longer be read as "the emitted product builds". It is rendered into the recorded gate
  artifact; `pass`/`unmet`/`advisories`/`evidenceHash` are unchanged.
- **Determinism is now measured, additively.** `product-quality.ts` gained a `determinism` reading
  (`determinismReading` / `acceptance.determinismOfProject`): which fields are reproducible from the
  brief alone, which are not, and their sources (`id` ← `crypto.randomUUID()`;
  `createdAt`/`logs[].ts`/`traces[].ranAt` ← `Date.now()`; `lastTest.evidenceHash` ← `fnv1a` over
  timestamped rows; the emitted `package.json`/`README.md` UUID + ISO stamp). Emitted bytes are not
  changed (codegen is another owner's surface), and the `quality` verdict is unaffected.
- **Docs corrected to the bytes:** `RUNBOOK.md` §6a/§9.7 (a below-floor run now DOES produce a ZIP,
  with the RED TREE banner on the README) and §9.9 (`resumeAccepted` IS consumed by codegen);
  `research/multiagent/wildmode-diagnosis.md` gained a corrections block for its stale park semantics
  and scaffold/dod line references.

## Corrections in force — appended 2026-10-06 (354 wave · B2 docs-truth)

This block supersedes the campaign claims above — the limits-list **item 9** and the summary
blockquote line that cite campaign #1's `workingApp` **0/8** as the current product limit. Values
re-derived from the named artifacts; where a doc and the bytes disagree, the bytes win.

- **Latest measured `workingApp` is 4 of 8 (campaign #3), not 0 of 8.** Campaign #1 scored **0/8**
  (`testruns\_report\CAMPAIGN1.md`), campaign #2 **2/8** (`CAMPAIGN2.md` §5), campaign #3 **4/8**
  (`CAMPAIGN3.md` §3.3). Delivery truth held across all three: **0 empty-substance commits ·
  0 red-tree commits**. The binding wall in every campaign is the P6 DoD gate (`RT_E_GATE_PENDING`).
- **No campaign has scored the current tree.** Every scored tree predates HEAD `30bce78`:
  campaign #3 ran at `841383d`, which is **20 commits behind** HEAD (`git rev-list --count
  841383d..30bce78` → 20); campaigns #1/#2 are older still. The evidence supports "4/8 on a
  20-commits-older tree" — it does **not** support any number for the current tree. Do not cite
  4/8 as the current product's score.
- **The campaign evidence lives outside the repo.** `C:\Users\mnril\Desktop\testruns\_report\` is a
  sibling of the repo, not tracked (`git ls-files testruns` → 0), so those numbers reproduce only on
  this host.

## License

MIT (see `LICENSE`).
