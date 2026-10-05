# RapidTool — Agent Contract (repo-level)

The working contract for agents operating **in this repository**. Read this before touching
code. Product-level guidance (how an agent *consumes* a RapidTool project, the honesty
contract in full) lives in **`AGENT_GUIDE.md`**; the CLI machine contract is
**`scripts/README-cli.md`**; the human quickstart is **`README.md`**.

## Reality check (this repo)

- **RapidTool** is a deterministic 13-phase agent-governance harness — TanStack Start /
  React 19, TypeScript, zustand, zod, Tailwind v4, Radix, Nitro (vercel preset), PGLite. The
  app *is* the product: brief → governed 13-phase run → Agent Packet + audit trail. It is not
  a starter-template repo.
- **Windows + space in path.** Root is `C:\Users\mnril\Desktop\RapidTool Main` (git-bash
  `/c/Users/mnril/Desktop/RapidTool Main`). **IS a git repo** (`main`; verified 2026-09-16 — `.git` present, `git log` works). Quote paths. Ripgrep-style
  search tools fail on the space — use terminal `grep` after `cd "/c/Users/mnril/Desktop/RapidTool Main"`.
- **Node 22** required (type-stripping). All npm scripts route through
  `scripts/with-app-env.mjs`; the dev server binds **loopback `127.0.0.1:8080`** by default
  (`vite.config.ts:160`, R11-f01 — the old `0.0.0.0` default was the unauthenticated-RCE surface);
  `RAPIDTOOL_BIND_ALL=1 npm run dev` is the deliberate, explicit opt-in to `0.0.0.0:8080`. Port
  8080 + `strictPort` stay fixed contracts. Do not change the host/port contracts.

## Read before acting

| Doc | When |
|---|---|
| `AGENT_GUIDE.md` | Always — the honesty contract + how agents consume projects |
| `RESUME.md` | **Every session start** — gate contract, hard rules, decision log, lane briefs |
| `taskuniverselog.md` | **Every session start** — the live task-status board (all dossiers' tasks, statuses, next wave) |
| `remainingwaves.md` | **Every session start** — every remaining wave: tasks, files, done-when, estimates, risks |
| `README.md` | Quickstart, capabilities matrix + honest limits (what works / what can't yet), architecture, docs index |
| `scripts/README-cli.md` | Any CLI work — verbs, exit-code taxonomy (0/1/2/3/4/**5**), RT_E registry |
| `research/multiagent/94_readiness_plan.md` | Any feature work — the live what-is-left plan + wave-ownership rules |
| `research/multiagent/93_design_flaws.md` | DF-01…DF-39 ledger of known defects |
| `research/multiagent/90_LEAPFROG.md` | Strategy: competitor-gap ledger + leapfrog axes |
| `research/multiagent/96_engineering_completion.md` | Engineering scorecard (tests/coverage/warnings gates) |
| `fixes/` | Append-only landing logs of the current fix wave (97–114…) |

## Source layout

- `src/lib/` — the engine, pure modules with colocated `*.test.ts`:
  `engine.ts`, `store.ts`, `phases.ts`, `dod.ts`, `packet.ts`, `io.ts`, `errors.ts`
  (RT_E registry), `knowledge.ts`, `algorithms.ts` (fusionRank/stemming), `vault.ts`,
  `harvest.ts`, `report-intake.ts`, `prompt-engine.ts`, `crew*.ts`, `verify.server.ts`,
  `chat*.ts`, `design.ts`, `diagram.ts`, `swarm.ts`, `bench.ts`, `ast-mine.ts`,
  `node-runner.server.ts` (bounded local runner; generated code runs under Node's Permission Model —
  a real resource/process bound, still NOT an OS sandbox), `deepseek.server.ts`,
  `headless.ts` (CLI backend), `codegen.server.ts` (liveP6Synthesis),
  `rt-events.ts`/`rt-ring.ts`/`rt-client.ts`/`watchdog.ts`/`diagnose.ts`/`runtime-log.server.ts`
  (runtime telemetry + the `diagnose` verb).
- `src/routes/` + `src/components/console.tsx` — the TanStack Start UI (9+ tabs incl.
  Runtime log).
- `scripts/` — CLI + build tooling: `rapidtool-cli.mjs` (**39** verbs dispatched today —
  `grep -c 'case "'` is the count source of truth — incl. the `lesson` family +
  `diagnose` + the fixes/150 G1 continuation verbs `tree-run`/`repair`),
  `with-app-env.mjs`, `gate.sh` (the four-gate stability script), plus `*.test.mjs` suites.
  *(Corrected 2026-10-02 by the W47 record audit: this line said 35; `grep -c 'case "'` re-derived = 39.)*
- `migrations/` — deploy-time migrations (`migrate.mjs` runs inside `npm run build`;
  PGLite fallback locally when `DATABASE_URL` is unset).

## Commands

- `npm run dev` (port 8080) · `npm run build` (+ `db:migrate`) · `npm run preview` (port 8081)
- `npm run typecheck` / `npm run lint` — the day-to-day gates. Keep them at 0.
- `npm test` — runs BOTH legs (scripts first, then the full src/lib suite). **Gate of record (346 wave,
  frozen tree; HEAD `c16220b` + the K1–K6 lanes) returned `ok:true`** — scripts 452 pass / 0 fail,
  lib 3507 pass / 0 fail / 2 skipped, `flakes:[]`, `hardFails:[]`. (An earlier mid-wave run in the
  same session returned `ok:false` on one load-sensitive child-spawn `compile-check.server` flake that
  passes standalone; that run overlapped sibling-lane edits of `src/**`, so it was not a frozen-tree
  result. The previous green boundary was 346-V2: `fixes/346_v2_validate.md` §4, scripts 446/0 ·
  lib 3370/0/2.) Earlier records: 343 wave
  `4bd1988` scripts 427/0 · lib 3261/0/2; 2026-10-02 `6575669` scripts 398/398. A red suite is yours to
  fix unless it is the known runner-timing flake class, which passes standalone. Re-derive counts —
  they drift every wave; see the "Corrections in force" append at the end of this file.
- Full gate: `bash scripts/gate.sh` (typecheck → lint → scripts → src suite → build;
  `--double` catches flakes).
- **`node --test` reporter + the `--test-name-pattern` no-op trap** (pinned by
  `scripts/test-name-pattern-guard.test.mjs`): the default `node --test` reporter is
  runtime-dependent — **TAP** on Node 22, **spec** on Node 24 — so any test that parses a
  child `node --test`'s output must pass `--test-reporter=tap` explicitly (`npm test` and
  `gate.sh` already do). Independently: a `--test-name-pattern` matching ZERO tests exits
  **0** and still masks a failing file on BOTH runtimes — never read a filtered run as
  green from its exit code alone; require the expected test's own `ok N - <name>` line in
  the same output.
- CLI: `node --experimental-strip-types scripts/rapidtool-cli.mjs <verb> …` — single JSON
  object on stdout, exit taxonomy 0/1/2/3/4 plus **5** (exit 2 = parked at a HITL gate or
  `blocked`; exit 5 = `--require-verified` on `emit --run`/`tree-run` when the tree is green
  but its declared `typecheck`/`build` could not be resolved/run (a fresh emit whose declared
  scripts resolve from the repo's own `node_modules/` reports `declaredScriptsVerified: true`
  and exits 0 — it is NOT automatically unverified, corrected 2026-10-03 by the 345-F1
  docs-truth fix; the docs' `scripts/README-cli.md`
  §Agent contract owns the full taxonomy); failures carry their `RT_E_*` code on the object.
  *(Exit 5 corrected 2026-10-02 by the W50 boundary owner; the W49 lane-335-4 added it.)*
  Red results are never a clean 0: a red-gate complete seal exits 1 (`RT_E_GATES_FAILED`,
  `sealedWithFailures: true`) and `emit --run` exits 1 when the emitted tree is not ok.
  Every exit stamps an NDJSON event under `<dir>/.rapidtool/logs/`; `diagnose` reads it back.

## Honesty contract (non-negotiable)

1. **No fabrication.** Research, code, runner results, estimates: never invented.
   `source: "illustrative"` = scaffolding, not fact.
2. **Keyless floors.** No `DEEPSEEK_API_KEY` → deterministic scaffold + honest
   `RT_E_LLM_NOT_CONFIGURED` envelope. Never fake model text.
3. **Declare-or-strike (P0-04).** Any user-visible claim must match real behavior on disk;
   strike the claim if it doesn't.
4. **RT_E codes.** Every surfaced failure carries a code from `src/lib/errors.ts`
   (`ERROR_CODE_DOC` is the canonical registry).
5. **DoD gates record exit criteria; enforcement follows the key.** Keyless runs are
   advisory — gates never silently block. Keyed runs default **enforce-DoD ON** (the engine
   defaults `enforceDod` to the keyed state; `create --advisory` or the console toggle
   relaxes to advisory) so a red gate pauses the run instead of sealing past it.
6. **Paper trail.** Decision ledger is append-only (actor + ISO timestamp); evidence hashes
   are FNV-1a (integrity, not cryptographic).
7. **Telemetry.** Runtime crashes/errors land in the bounded ring (client) or the NDJSON log
   (CLI) — telemetry code must NEVER change engine behavior (purity-tested) and must never
   throw into the code it observes.

## Working rules

- **Node imports use explicit `.ts` extensions** in the src chain (strip-types).
- **Never import `node:fs` into client-safe modules** (the H2 crash class) — server-only
  modules use dynamic/lazy import seams.
- **Patch-only on existing files** unless creating something new for the first time; then
  patch thereafter. No export renames without updating every consumer.
- **The four gates green at every wave boundary** (typecheck 0 / lint 0 / full suite green /
  build 0). Never run the full gate while agents are mid-edit.
- **Strict disjoint file ownership** per concurrent wave; cross-wave contracts pre-specified.
- **Fix logs land in `fixes/NN_*.md`**, append-only. Research dossiers in
  `research/multiagent/NN_*.md`. The `rapidtool-development` Hermes skill documents the
  conventions.
- **`npm test` scripts-leg cwd rule**: script tests that touch the platform chrome use
  temp-dir `cwd` isolation — never run them from the repo root as their subject.

## Legacy scaffolding — do not build on it

Most of `.grok/` (18 `skills/*`, 6 `references/*`, and the writer-less stale `.grok/status`)
plus `server/` middleware, `scripts/grok-pwa-*`, `AGENTS.project.md`, and `startup.sh` are
stale scaffolding from the repo's origin. But `.grok/` is **partially load-bearing — do not
delete these reads:** `scripts/with-app-env.mjs:34` reads `.grok/app-env.json` on every
`npm run dev/build/preview` (it ships `VITE_AUTH_ENABLED=false`); `scripts/brand-check.mjs:91`
reads `.grok/skills/og/SKILL.md` and `:44` writes `.grok/og-pending`; `scripts/preview.mjs:33-34`
uses `.grok/preview.{pid,log}`. Their keep-or-descope fate is decided in 94 §B1 / 96; do not
delete or extend until that lands.
*(Corrected 2026-10-02 by the W50 boundary owner from the W48 lane-334-6 audit: the previous
blanket "not the contract" sentence was false for those four live reads.)*

## Corrections in force — appended 2026-10-03 (345-F1 docs-truth fix; HEAD `06cb089`)

This block supersedes stale claims above and in the session-start docs. All values re-derived from
the bytes today; where this file and the bytes disagree, the bytes win.

- **Exit taxonomy is 0/1/2/3/4/5** (the table row above said "(0/1/3/4)"; 2 = park, 5 = the opt-in
  `--require-verified` state). See `scripts/README-cli.md` §Agent contract.
- **Dev server host:** loopback `127.0.0.1:8080` by default, `0.0.0.0` only under
  `RAPIDTOOL_BIND_ALL=1` (the Reality-check line above previously said "binds `0.0.0.0:8080`").
- **Headless CLI reads `<cwd>/.env`** and the `.env` value wins over the process environment
  (present-but-blank process value = intentional keyless disable; a differing non-blank ambient
  value loses behind `RT_E_LLM_KEY_SHADOWED`, tails only). Rule owned by
  `scripts/README-cli.md` §API key resolution.
- **A fresh `emit --run` is not automatically "unverified":** when the declared `typecheck`/`build`
  resolve from the repo's own `node_modules/`, the envelope reports
  `declaredScriptsVerified: true` and exits 0. Exit 5 applies only when those scripts cannot be
  resolved/run (observed at HEAD `4bd1988`; corrected by the 345-F1 fix).
- **Current gate of record (343 wave, `fixes/343_0_parent.md` §1/§7):** scripts 427 pass / 0 fail ·
  lib 3261 pass / 0 fail / 2 skipped; `gate.sh` `ok:true`, `hardFails:[]`, `flakes:[]`. The
  398/2736 values quoted above are the 2026-10-02 record.
- **Tracked counts (2026-10-03):** total 1,933 · `src` 250 · `src/lib` 239 (123 modules + 112
  tests) · `scripts` 49 (25 tools + 24 tests) · `fixes` 744 · `wave_plans` 139. `.t4scratch/` is no
  longer tracked.
- **CI:** `.github/workflows/gate.yml` still runs only the ubuntu leg; the Windows leg remains a
  proposal for the owner (the workflow has never executed). The Node pin is 22.23.2, which is the
  Hermes-bundled runtime, not the dev host (`node -v` → v24.15.0).

## Corrections in force — appended 2026-10-04 (346 wave; HEAD `c16220b`)

This block supersedes the gate/count claims above and in every dated block of the session-start docs.
All values re-derived from the bytes and commands run this session; where a doc and the bytes
disagree, the bytes win.

- **Gate of record — GREEN on the frozen tree (HEAD `c16220b` + the K1–K6 lanes).** `& 'C:\Program
  Files\Git\bin\bash.exe' scripts/gate.sh` returned `ok:true`: typecheck/lint/assertionGaps/build all
  `ok`, `testsScripts {pass:452,fail:0}`, `testsLib {pass:3507,fail:0,skipped:2}`, `flakes:[]`,
  `hardFails:[]`. An earlier mid-wave run in the same session returned `ok:false` on the child-spawn
  `compile-check.server` flake (`purity — subject bodies unchanged…` + its `treeRun` parent) while
  sibling lanes were editing `src/**`; it passes standalone and is the documented load-sensitive class,
  not a frozen-tree result. Exact JSON: `fixes/346_batch5_notes.md` §1. Previous green: 346-V2
  (`fixes/346_v2_validate.md` §4) scripts 446/0 · lib 3370/0/2.
- **Tracked counts (`git ls-files`, 2026-10-04):** total **1,951** · `src` 250 · `src/lib` 239
  (112 colocated test suites) · `scripts` 52 (26 tools + 26 `*.test.mjs`) · `fixes` 759 ·
  `wave_plans` 139 · `research/multiagent` 103 · `research/eval-out` 345 · `research/eval-corpus` 23.
  The 1,933 / fixes 744 / scripts 49 values in the 345-F1 block are superseded. New this wave:
  `scripts/factory-watch.mjs` + `factory-watch.test.mjs`, `scripts/store-crosstab.test.mjs`.
- **Isolation is a real bound now, still not a sandbox.** `exec.generatedRunOptions` runs
  model-generated code with `isolation:"strict"`; `node-runner.server.ts` probes and applies Node's
  Permission Model (`--permission`; fs writes confined to the per-run scratch dir, `child_process` /
  `worker_threads` / native addons denied) plus a 512 MB V8 heap cap. `doctor` reports
  `isolation.bound {mechanism:"node-permission-model", enforcedOnGeneratedCode:true, fsWriteConfined:true,
  subprocessDenied:true, heapCapMb:512}` while `isolation.sandbox` stays **false** — no Docker / bwrap /
  Windows Job Object / AppContainer, and no network denial (raw sockets bypass proxy env vars). Windows
  Job Objects are unavailable from pure Node (they need a native addon or a P/Invoke helper this repo
  does not take).
- **Tree/oracle behavioural parity closed (SB-2).** `compile-check.server.assertionIsShapeOnly` mirrors
  the oracle lane's `behaviouralOracleExpression`: literal tautologies, bare `null`/`undefined`
  operands, and `typeof`/length markers are NOT behavioural on either path; the oracle lane gained the
  full numeric-literal grammar (346 cross-lane parity, `100504c`). Residual: the emitted tree-job probe
  stays deliberately modest (it observes the call outcome, not row-specific cases — `generateCases` owns
  those).
- **Watchdog seams are wired (P2-6).** `watchdog.ts`'s `requiresHumanResume`/`shouldAutopause` are
  consumed by the store wild driver's resume branch (`store.ts` `startWildRun`); `boundedStepWatch` is
  consumed by `engine.wildStep` (`engine.ts:5342`). The old "unwired seams" text is struck.
- **Delivery proof + CLI emit ordering guard.** `factory-watch.mjs` re-executes the emitted tree
  (`emit --run`) and requires `treeRun.ok === true` before it issues `emit --git`, so verification
  precedes the commit; the CLI `emit --run --git` guard (`rapidtool-cli.mjs:2236-2255`) refuses to
  commit when THIS invocation's `--run` verdict is red (`RT_E_TREE_RUN_FAILED`, emitted tree kept on
  disk). Residual: `emit --git` WITHOUT `--run` still commits — it has no verdict to consult (by design).
- **Console seat provenance (enforcement arm landed).** `policy.ts` registers an UNATTESTED `console`
  human seat (`seatTokenPath` false; `console-seat-unattested` for `hitl.approve`, refused for
  `hitl.force`/`fixtures.approve`); `dod.ts` `classifyRowSeat`/`provenanceConsistent` recognise the
  `[seat console]` tag and require `tokenPath:false`; `store.approve` routes the console decision
  through that seat and stamps it (browser-verified desktop+mobile); `headless.ts`'s approve note
  branches on `seatTokenPath`. A console decision is recorded as an UNATTESTED human decision and can
  never read as the token-verified CLI seat. Residual: a forced override keeps the caller's rationale
  verbatim and carries the console seat via `decidedVia` (the `[seat console]` tag applies to standard
  approvals).
- **P7–P12 coverage wording.** The phase edge is gate-blind and the DEFAULT advisory driver advances
  through P7–P12 after a red P6, each tail phase writing its own artifact (measured: 9 tail artifacts);
  only an `enforceDod` run blocks at P6, on the two keyed criteria. The packet's one shared line is
  `Phase coverage: N of 13 / M artifacts from P7–P12` (+ `empty_phases`), derived from the real census.
  The old "P7–P12 often produce no artifacts / unblocking them is roadmap" wording is struck.
- **`doctor` (keyless, this box):** `autonomousSoftwareFactory:false` with its 4 named `gaps[]`,
  `awaitingHumanAcceptance:false` — the autonomy bar requires a human-approved fixture row.
  `fixes/346_audit_autonomy.md` refutes the "100% autonomous factory" claim and lists the remaining
  work (keyed P6 reliability, cross-family failover, isolation, console seat-delivery seam).

## Corrections in force — appended 2026-10-05 (346 wave batch 10; HEAD `2f0e3d7`)

This block supersedes the gate/count claims above and in every dated block. All values re-derived
from the bytes and commands run this session; where a doc and the bytes disagree, the bytes win.

### Gate of record — GREEN on the frozen tree (HEAD `2f0e3d7`, clean tree)

`& 'C:\Program Files\Git\bin\bash.exe' scripts/gate.sh` returned, as its single stdout JSON line:

```json
{"ok":true,"double":false,"flakes":[],"hardFails":[],"quarantined":[],"quarantineCandidates":[],"skips":2,"wallMs":535223,"gates":{"typecheck":{"ok":true,"exit":0,"ms":54129},"lint":{"ok":true,"exit":0,"ms":20283,"problems":5},"assertionGaps":{"ok":true,"exit":0,"ms":1059},"build":{"ok":true,"exit":0,"ms":14581},"prevention":{"ok":true,"exit":0,"ms":3901,"missed":[],"pending":[],"skipped":[],"count":20,"countFloor":20},"testsScripts":{"ok":true,"exit":0,"ms":249046,"pass":513,"fail":0,"skipped":0},"testsLib":{"ok":true,"exit":0,"ms":191241,"pass":3712,"fail":0,"skipped":2}}}
```

`gate.sh`'s own exit logic maps `ok:true` → exit 0. (A PowerShell wrapper may report exit 1: bash's
`[gate] … running…` progress lines on stderr trip PowerShell's `NativeCommandError`, which is a
wrapper artifact, not the gate's code — the JSON verdict is authoritative.)

### Tracked counts (`git ls-files`, 2026-10-05 at `2f0e3d7`)

total **2,014** · `src` 256 · `src/lib` 244 (129 non-test + 115 colocated test suites) · `scripts` 107
(33 `*.test.mjs` suites + 74 tools/guards/prevention) · `fixes` 761 · `wave_plans` 139 ·
`research/multiagent` 103 · `research/eval-out` 345 · `research/eval-corpus` 23 · `research` 476 ·
root (top-level) 41. Superseded: the 2026-10-03 values (total 1,933 · scripts 49 · fixes 744) and the
2026-10-04 values (total 1,951 · scripts 52 · fixes 759).

### The keyless proof layer — what it is, and its exact command

**Command (also an additive stage inside `gate.sh`):**

```bash
node scripts/prevention/verify-prevention.mjs --all --selftest
```

Returned this session:

```json
{"ok":true,"guards":20,"count":20,"countFloor":20,"historical":20,"fixtureIntegrity":{"fired":["C-01","C-02","C-03","C-13","C-09","C-11","C-06","C-04","C-05","C-12","C-14","C-16","C-18","C-15","C-17","C1-01","C1-02","C1-05","C1-06","C1-08"],"missed":[]},"fixPresence":{"enforced":["C-01","C-02","C-03","C-13","C-09","C-11","C-06","C-04","C-05","C-12","C-14","C-16","C-18","C-15","C-17","C1-01","C1-02","C1-05","C1-06","C1-08"],"pending":[]},"fired":["C-01","C-02","C-03","C-13","C-09","C-11","C-06","C-04","C-05","C-12","C-14","C-16","C-18","C-15","C-17","C1-01","C1-02","C1-05","C1-06","C1-08"],"missed":[],"pending":[],"skipped":[],"registry":"present","controlMissed":[],"rubricBaselines":{"ok":true,"present":true,"treeCount":13,"covered":13,"expected":13,"missing":[],"missingTrees":[],"badScores":[]},"heldOut":{"ok":true,"present":true,"slug":"held-out-community-tool-library","disjoint":true,"hasBrief":true,"hasExpected":true,"live":{"domain":"custom-software","kind":"app","name":"Rivertown Tool Library"},"expected":{"domain":"custom-software","kind":"app","name":"Rivertown Tool Library","incidents":[]},"matches":true}}
```

**What it is.** A keyless replay harness over pinned cassettes of persisted artifacts (the historical
`testruns/**` trees plus the campaign-1 trees). Each of the **20** registry guards is replayed and
reports **two orthogonal signals**, never one:

1. **`fixtureIntegrity`** — does the guard's detector still FIRE on the historical/campaign defect it
   was written for? (`fired` / `missed`.)
2. **`fixPresence`** — is the live fixer seam present **and wired**? (`enforced` / `pending`.)

**`countFloor` rule.** `countFloor` is the pinned number of registry guard entries (here 20); the
harness fails if the guard `count` drops below it, so a green reading cannot be reached by deleting a
guard. The gate **fails if a guard stops firing**: `gate.sh`'s additive `prevention` stage requires
`missed:[] ∧ pending:[] ∧ skipped:[] ∧ count ≥ countFloor`. A `pending` fixer, a `skipped` guard, or a
missing guard is a hard failure — "the historical defect is still visible" alone never certifies a fix.

### The autonomy contract (PR-33, decided 2026-10-05 — Open Question 1 = Option A)

**Decided: Option A — a new additive machine-verified reading sits BESIDE the human-gated bar.** The
two flags are distinct and both live in `doctor.ts` (`src/lib/acceptance.ts` owns the machine reading):

- **`autonomousSoftwareFactory`** — the existing human-gated bar: the AND of the machine conjuncts plus
  a **human-approved fixture row** stamped `decidedBy:"human"` through an out-of-band seat. It is
  **byte-identical and never machine-mintable.** `doctor` (keyless, this box) prints it `false`.
- **`autonomousFactoryV2`** — NEW, additive, machine-only; satisfied by machine evidence alone: the
  per-brief persisted P6 tree-run promotion stamp (`lastTest.label === "tested"` with a non-empty
  `evidenceHash`). It never flips the human flag.
- **`fleetAcceptance`** — the aggregate behind `autonomousFactoryV2`: an attributable machine seat
  (`seat:"machine:tree-run"`, `decidedBy:"machine"`), accepted briefs, coded refusals, and a floor of
  5 of 8 (`FLEET_ACCEPTANCE_MIN`/`FLEET_TARGET_BRIEFS`). Fail-closed: absent/hollow/unattributed
  evidence, or two distinct briefs sharing one `evidenceHash`, refuses (false).
- **`fleetMetrics` / `fleetAlarms`** — PR-32 observability: tokens/calls/cache hits/rubric mean with
  `estimatedCostUsd` always `null` (spend is never fabricated), and threshold alarms (cache-cold,
  over-cap calls, rubric below target, `evidenceHash` collision, fabricated spend). `fleetAlarms.tripped`
  is a hard failure.

**A machine path may never mint `decidedBy:"human"`.** The machine reader refuses a record claiming a
human seat outright (`ACCEPTANCE_REFUSAL.humanSeat`) — it is never laundered into machine evidence —
and provenance unit tests assert the machine seat and the human-seat refusal.

**Date:** 2026-10-05. **Rationale:** it preserves the **338-4 anti-self-certification doctrine** — the
human conjunct is deliberate and *the machine may not set the bar it is graded against* — so the
honest move is a new, separately-attributed machine reading that cannot forge a human stamp, not a
redefinition of the existing bar. **Rejected alternative (Option B):** dropping the human-acceptance
conjunct from the factory bar. That would make "autonomous" unfalsifiable and delete the repo's central
honesty doctrine (What-NOT-To-Do #18); it is an owner decision and was not implemented unilaterally.

### Rollout flags (design §10) — default + rollback

| Flag | Default | Meaning | Rollback |
|---|---|---|---|
| `--allow-empty` (opt-in) | **off** | On `emit --run --git`: withhold the commit when the tree's `substance` verdict is `empty` or the trail is red; `--allow-empty` admits a deliberate scaffold-only commit. | Omit it — the default is byte-identical (withhold). |
| `gate --resynthesize` | **off** | Re-opens a red RUNNING P6 (retry) and re-enters the P6 journey once, live, bounded, from the recorded unmet requirements. | Omit it — a red running P6 re-parks at 0 steps. |
| `repair --from-gate` | **off** | Re-opens a red RUNNING P6 first so the bounded repair cycle targets the recorded unmet state instead of refusing `RT_E_PHASE_ILLEGAL`. | Omit it — legacy repair path unchanged. |
| `--token-ledger <file>` / `RAPIDTOOL_LEDGER_FILE` | **off** | The cross-process campaign ledger: each opted-in invocation preflight-loads a persistent JSON, refuses coded once `spent >= cap`, and post-appends its measured session spend. Cap from `RAPIDTOOL_CAMPAIGN_TOKEN_CAP` or the file's own `cap`. | Unset both — the ledger is never read/written/surfaced; every code path and envelope byte is byte-identical. |
| `RAPIDTOOL_CAMPAIGN_TOKEN_CAP` | **unset** | Integer campaign bound for the ledger above; a non-numeric value refuses coded. | Unset it (falls back to the file's own `cap`, else unbounded). |
| `resumeAccepted` | **absent** | A previous cycle's accepted chunks, threaded `P6JourneyCycleContext → p6CycleLiveDeps` for reuse instead of re-buying every chunk. Absent/empty ⇒ no key materialized. | Absent is the default and is byte-identical. |
| machine flag (`autonomousFactoryV2` / `fleetAcceptance`) | **separate** | Additive machine reading; flipping it off leaves `autonomousSoftwareFactory` untouched. | Ignore the reading; the human bar is unchanged. |

No silent default flips. The human door is never removed.

### Honest limits (kept/refreshed)

- **The keyed P6 productivity wall is unbroken.** Campaign #1 (2026-10-05,
  `testruns\_report\CAMPAIGN1.md` + `CAMPAIGN1.json` + `campaign1-score.json`) scored `workingApp`
  **0 of 8** trees (target ≥5/8); 6/8 stall at the P6 DoD gate (`RT_E_GATE_PENDING`). The **delivery-truth**
  target PASSED: **0 empty-substance commits, 0 red-tree commits** (historical: 6 empty + 5 red).
  Spend 615,533 tokens / ~US$0.38 (label-only; `estimatedCostUsd:null`), 1,505 s across 8 projects.
- **No OS isolation beyond the runtime Permission Model bound.** Generated code runs under Node's
  Permission Model (fs writes confined to the per-run scratch dir, `child_process`/`worker_threads`/
  native addons denied, 512 MB heap cap). `doctor` keeps `isolation.sandbox:false`; no network denial
  and no Docker/bwrap/AppContainer/Windows-Job-Object boundary is claimed.
- **The human acceptance door is reserved, unchanged.** `autonomousSoftwareFactory` still requires a
  human-approved fixture row (`decidedBy:"human"`, out-of-band); `doctor` prints it `false` by design.
- **Known residuals.** `resumeAccepted` is plumbed through `headless.ts` but **not yet consumed by
  codegen** (`grep resumeAccepted src/lib/codegen.server.ts` = 0); **5 lint warnings** are reported by the
  gate (`lint.problems:5`) with lint `ok:true`; cross-family failover is genuinely unimplemented
  (the un-armed switch was deleted; `RAPIDTOOL_FALLBACK_PROVIDERS` is inert); the console seat records
  provenance but has no out-of-band delivery seam; prettier drift is measured, not gated.

## Corrections in force — appended 2026-10-05 (346 wave batch 15 / X5 acceptance lane)

This block supersedes the P6-resample, product-position and proof-layer claims above. Every number was
re-derived this session from the file or command named beside it; where a doc and the bytes disagree,
the bytes win.

- **The chunked P6 resample is ARMED BY DEFAULT** (validator-selected; bounded ≤ `P6_SYNTH_CANDIDATES_MAX`
  = 4; the armed chunk-lane default reads `P6_SYNTH_CHUNK_RETRY_CANDIDATES` at
  `src/lib/synthesis-policy.ts:54`, 3 this session). `P6_SYNTH_CANDIDATES=1` (or `deps.candidates: 1`) is
  the explicit opt-out and emits no `p6.synthesis.candidates` row. The **PRIMARY** single-module
  best-of-N + whole-tree pre-seal resample stay **opt-in** (`resolveSynthesisCandidates` default 1).
- **Measured product position, variance stated.** Campaign #2 `workingApp` was **2/8**
  (`testruns\_report\CAMPAIGN2.md` §5); the final keyed samples disagreed —
  `testruns\default-check\TUNING.json` **3/4** vs `testruns\tuning\TUNING.json` **1/6** (combined 4/10).
  `mobile-companion` and `office-stock-tracker` each flip `true`→`false` between the two samples.
  **Variance is the dominant factor; the binding wall is the P6 DoD gate** (`RT_E_GATE_PENDING`).
  Delivery honesty held: **0 empty-substance commits · 0 red-tree commits**.
- **Proof layer: 27 guards.** `node scripts/prevention/verify-prevention.mjs --all --selftest` →
  `ok:true`, `guards:27`, `countFloor:27`, `fixtureIntegrity.missed:[]` ∧ `fixPresence.pending:[]`,
  `skipped:[]`. (Supersedes the batch-10 "20 guards".)
- **Resample telemetry is on the doctor.** `src/lib/acceptance.ts` reads the persisted
  `p6.synthesis.candidates` rows back into `fleetMetrics.resample` (candidates requested/tried,
  winners/no-winner, winner index per event, extra keyed calls = Σ max(0, tried−1)); `doctor.ts`'s
  `fleetTelemetryFromProject` derives a record's telemetry from its own `logs`/`tokenUsage`. Measured
  from the default-check journals: **3/4 runs · 17 events · 34 requested · 25 tried · 14 winners ·
  3 no-winner · 8 extra keyed calls**. `extraTokens` is `null` with
  `tokenAccounting:"not-recorded-in-journal"` — the row records candidates, not token usage; spend is
  never fabricated.
- **The machine reading states its sample count** so one lucky run cannot read as a fleet result:
  `fleetAcceptance.sampleCount` + `evidencedRate`; `fleetMetrics.workingAppSamples` /
  `workingAppPass` / `workingAppRate` / `workingAppByBrief` (per sample; an absent verdict is not
  scored). Lane log: `fixes/346_final_wave.md`.

## Corrections in force — appended 2026-10-05 (346 wave batch 16 / Lane X close-out)

This block supersedes the product-position, resample-token and sample-count claims above. Every number
was re-derived this session from the file or command named beside it; where a doc and the bytes
disagree, the bytes win.

- **Campaign #3 (keyed, 8 briefs, armed default `P6_SYNTH_CANDIDATES` unset ⇒ candidates 3):**
  `workingApp` **4 of 8** (`testruns\_report\CAMPAIGN3.md` + `CAMPAIGN3.json`; per-brief rows in §3).
  Delivery truth held: **0 empty-substance commits · 0 red-tree commits**; 2 trees withheld coded —
  `bakery-florist-orders` red trail (`RT_E_TREE_RUN_FAILED`), `office-invoice-tracker` below-floor
  (`RT_E_PLAN_UNDERPRODUCED`, HITL-parked exit 2). Ledger `testruns\campaign3\ledger.json`: cap
  3,000,000, **spent 948,586 tokens / 179 calls**, bound not tripped; wall 2,347 s;
  `estimatedCostUsd:null`.
- **S-1 two-sample (keyed, armed default, 4 default-check briefs):** sample1 **1/4**, sample2 **2/4**
  — combined **3/8** (`testruns\s5-reliability\sample1\TUNING.json`, `sample2\TUNING.json`).
  `office-stock-tracker` flips `false`→`true`; `mobile-companion` and `bakery-florist-orders` are
  `false` in both; `bakery-website` `true` in both.
- **Combined position + variance.** Fresh final-wave samples (S-1 + campaign #3): **7 / 16 (43.75%)**.
  All campaign/sample history (campaign #1 0/8 · #2 2/8 · default-check 3/4 · tuning 1/6 · S-1 3/8 ·
  #3 4/8): **13 / 42 (≈31.0%)**. The spread across identical armed-default code is the measurement:
  **no single run is the product**. The binding wall is the **P6 DoD gate** (`RT_E_GATE_PENDING`); the
  clause that now fails most is UI wiring (`mobile-companion`, `held-out-community-tool-library`).
- **Candidate-token accounting is measured, not null.** Producer (lane S S-4,
  `src/lib/synthesis-policy.ts` `candidatesLogDetail`) appends an optional trailing ` · tokens <int>`
  to the `p6.synthesis.candidates` row; consumer (lane X X-1, `src/lib/acceptance.ts`
  `parseCandidateJournalRow` → `ResampleUsage`) sums it into `extraTokens` and sets
  `tokenAccounting:"journal"`; a legacy row stays `null` / `"not-recorded-in-journal"`. Measured on
  campaign #3's own journals: **7/8 runs · 28 events · 84 requested · 55 tried · 20 winners · 8
  no-winner · 27 extra keyed calls · `extraTokens` 293,152 (`tokenAccounting:"journal"`)**;
  `doctor.ts` surfaces it via `fleetMetrics.resample.extraTokens` with `estimatedCostUsd` still `null`
  (X-4).
- **Landing corroboration (sibling-lane fixes; cited, not re-derived).** Form-bindable UI decision:
  `src/lib/scaffold.ts:1872-1908` (`wiredFormCallable` / `pickFormCallable`). Persisted-gate recompute:
  `src/lib/headless.ts:3441` (`p6.journey.gate-recomputed`) — campaign #3's `mobile-companion` is the
  live corroboration (drive P6 `RT_E_GATE_PENDING` while the persisted best tree's `treeRunOk` is true
  and it committed).
- **Tests:** `node --experimental-strip-types --test --test-reporter=tap src/lib/acceptance.test.ts
  src/lib/doctor.test.ts` → **108 pass / 0 fail**; `npx tsc --noEmit` exit 0.
