# RapidTool

A **deterministic, governed 13-phase pre-flight workbench** for agent-built software. RapidTool
compiles a client brief into an audited build plan: phase-by-phase research, architecture,
security and code artifacts, a paste-ready **Agent Packet**, a machine-run **verify-fix loop**,
an Obsidian-style knowledge vault, and a cross-project self-learning store — all behind
evidence-hashed DoD gates, an append-only decision ledger, and a hard no-fabrication
**honesty contract**.

**Two surfaces, one engine:** a browser app (TanStack Start + React 19, served at
`http://localhost:8080`) and a file-based headless CLI (`scripts/rapidtool-cli.mjs`, **31
verbs** at this write) that drives the same pure engine with no browser and no server.

> **Status: built, and honest about the rest.** Live gates (2026-09-09): `npm test`
> **1488/1488**, typecheck 0, lint 0 errors / 18 warnings, build 0. RapidTool is **not**
> yet an autonomous software factory that beats Codex/OpenHands/Claude Code — 4/5
> maker-test jobs are still `TODO(E-15)` stubs; Chat is one-shot DeepSeek with no
> tools. The declare-or-strike line is
> [What it does and does not do today](#what-it-does-and-does-not-do-today).

---

## Quickstart

```bash
# Requirements: Node 22 (verified on v22.23.2), npm
npm install

# Browser app → http://localhost:8080 (host/port are a fixed contract in vite.config.ts)
npm run dev

# Production build + deploy-time DB migration (Nitro preset: vercel → .vercel/output)
npm run build
npm run preview        # serves the build on http://127.0.0.1:8081

# Headless CLI — no browser, no server. JSON in, JSON out (single object on stdout).
node --experimental-strip-types scripts/rapidtool-cli.mjs create \
  --brief "Build a field-service dispatch board for HVAC." --name "HVAC Dispatch" --out build.json
node --experimental-strip-types scripts/rapidtool-cli.mjs gate --project build.json --autopilot

# Gates
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm test               # scripts-leg + src/lib-leg (see status note above)
```

The Home tab seeds a demo project so the surface is never empty (labeling it as a *sample*
rather than a build is a pending UI fix — 94 §B7, DF-28).

## What it does (the loop)

1. **Brief → project.** One client brief becomes a project with 13 phases (P0–P12).
2. **Governed advance.** `run`/`gate` advance deterministically; **stock HITL gates P4, P5, P8,
   P9** (and any `forceHuman` gate) always park for a human decision — approve or reject with a
   12+ character note that steers the next attempt. Autopilot never self-approves a human gate.
3. **Outputs.** Agent Packet v3 (paste-ready prompt contract + machine-readable System JSON),
   per-phase handoff prompts, design tokens + standalone HTML preview, SVG diagrams
   (phases / architecture / flow), an Obsidian-style vault with wikilinks, and machine-run
   verification verdicts.
4. **Feedback.** Ingest external agent reports (append-only), run grounded chat copilot turns,
   `deepen` a dead-end research phase (E-13 recovery), or hand the wheel to bounded Wild Mode.
5. **Learning.** Every run feeds the knowledge store: capture → store → retrieve → evaluate /
   evict, scored across projects by `fusionRank`.

## The 13-phase pipeline

Titles verified from `src/lib/phases.ts` (P4/P5/P8/P9 = stock HITL gates, `STOCK_HITL` at
`phases.ts:151`):

| # | Phase | Notes |
|---|---|---|
| P0 | Deep Research & Feasibility | Deterministic scaffold; live keyless search + DeepSeek narrative when configured |
| P1 | Core Orchestration & State Graph | Spec graph + contract artifacts |
| P2 | Memory & Context Consolidation | Memory rows, consolidation rules |
| P3 | Tool Integration & Interoperability | Tool/API surface plan |
| P4 | Security, Isolation & Authorization | **Stock HITL** — human approve/reject |
| P5 | Validation, HITL & Self-Learning | **Stock HITL** — gate + feedback contract |
| P6 | Code Generation, Testing & Deployment | Typed source module; with `DEEPSEEK_API_KEY` the keyed synthesis seam attempts brief-faithful code and the machine **tree-run** verifies whatever stands (see [Verify](#verify--the-trust-axis)); the deterministic template self-test is the keyless floor — and, honestly, the only path with a green machine run so far (fixes/149) |
| P7 | Domain & Market Research | Research phase (deepen-able via E-13) |
| P8 | Dynamic UI/UX Prototyping | **Stock HITL** |
| P9 | CI/CD & Cloud Deployment Routing | **Stock HITL** — deploy runbook sketch |
| P10 | Local Agent & Edge Inference | Edge/agent inference spec |
| P11 | Real-Time Web & Tool Augmentation | Realtime + augmentation research |
| P12 | Documentation & Technical Specs | Docs (e.g. OpenAPI 3.1) |

Every phase ends at a **DoD gate**: machine-checkable exit criteria with an FNV-1a evidence
hash, recorded in the append-only decision ledger with actor and ISO timestamp.

## The CLI verbs (31 today)

Full contract (options, exit codes, RT_E registry, agent loop): [`scripts/README-cli.md`](scripts/README-cli.md).
Count verified at this write: `rapidtool-cli.mjs` has exactly **31 `case "` arms**
(`lesson` included). Three more verbs land **concurrently with this wave** — `repair --dir`,
`tree-run --dir` and `emit --verify-kind` (fixes/149 P0-1/P1-2) — so re-run
`grep -c 'case "' scripts/rapidtool-cli.mjs` before quoting a number, and read their full
rows in README-cli as they dispatch.

| Verb | Purpose | Needs `DEEPSEEK_API_KEY`? |
|---|---|---|
| `create` | New project from a brief (atomic JSON write) | no |
| `run` | Advance exactly one phase (`advanceOnce`) | no (optional live overlay) |
| `gate` | Advance until parked (HITL / complete / blocked) | no (optional live overlay) |
| `approve` / `reject` | Human decision on the parked gate (`--force`, `--note`) | no |
| `retry` | Re-open a rejected/blocked phase (note stays applied) | no |
| `ingest` | Append an external agent report (inline JSON, `@file.json`, or `-` stdin) | no |
| `packet` | Emit the compiled Agent Packet (stdout or `--out file.md`) | no |
| `export` | Full project JSON (stdout or `--out`) | no |
| `emit` | Write the runnable scaffold (project files + embedded module) to a folder (`--out <dir>`; default `<home>/RapidTool Software/<slug>/`); `--check` adds per-file compile verdicts; `--run` executes the emitted tree (parse + every emitted `tests/*.spec.ts` + entry smoke) and exits 1 on a red tree | no |
| `summary` | Compact JSON-safe snapshot (status, phaseCounts, lastGate…) | no |
| `vault` | Materialize the Obsidian-style vault (one .md per note + `_index.md` MOC) | no |
| `search` | Token-overlap vault search (deterministic, no network) | no |
| `crew` | Advisory multi-agent crew critique (never approves/advances) | **yes** |
| `verify` | Machine verify-fix loop over generated source (`--apply` persists verdict) | **yes** |
| `check` | Per-file compile verdicts over an emitted directory (`--dir <path>`) | no |
| `design` | Design tokens + standalone HTML design-system preview (`--html`) | no |
| `diagram` | SVG: `--kind phases \| architecture \| flow` | no |
| `artifacts` | Index of project artifacts (id/phase/kind/title/bytes) | no |
| `doctor` | Capability pre-flight: llm / research / runner / node (no project needed) | no |
| `diagnose` | Telemetry diagnosis: recent log tail, timeline, most-likely-cause heuristic (no project needed) | no |
| `harvest` | Bounded live-source harvest (repos + licenses; never fabricated) | no (LLM query-building when keyed) |
| `swarm` | Deterministic advisory swarm critique (pure state analysis) | no |
| `prompt` | Hyper-prompt expansion of the brief into an implementation spec | **yes** |
| `bench` | Synthetic estimates: tokens / time / complexity / failure points | no |
| `mine` | Bounded structural codebase map + convention map (`--dir`) | no |
| `knowledge` | Cross-project pattern store: `--save` / `--find` (idempotent, append-only) | no |
| `lesson` | Human-gated learning: `--list` / `--propose` (draft-only) / `--accept` (THE cross-project write) / `--supersede` / `--refute` | no (keyed polish when available) |
| `wild` | Bounded wild-mode macro-run + lifecycle (`--start`/`--pause`/`--resume`/`--stop`) | no |
| `chat` | Grounded copilot turn — the same `chat.server.ts` the UI Chat tab calls | **yes** |
| `deepen` | E-13 recovery: re-run research over a completed phase 0/7/11 | no (keyless-honest) |

Every subcommand prints exactly one JSON object (`schema_version: 1`, `cmd`, `exit_code`) and
exits with the machine taxonomy: **0** executed · **1** could not execute (usage/state) · **2**
parked at a HITL gate / blocked (`run`/`gate`; full state on stdout) · **3** backend not
configured · **4** backend runtime failure. Failures carry a stable `RT_E_*` code
(registry: `src/lib/errors.ts`).

## Wild Mode

Bounded autonomous macro-runs. **Bounds are by iteration, not wall-clock**: the browser
driver steps in loops of up to 20 per driver entry (parking at a cap/gate), and the CLI
`wild` verb steps up to 24 per call (`--steps`, clamped 1–48). `wild --start` enables Wild
Mode **and** begins a run; `--pause`/`--resume`/`--stop` control it. A run never outlives
the page that drove it: any run found active on reload is **force-stopped, never left
paused** (session-artifact honesty). Wild Mode **never fabricates progress**: gate decisions
degrade to the deterministic DoD floor or park with an honest log, and the run always parks
at the first stock HITL gate for a human decision.

Two honest edges, both under active repair this wave (fixes/149 F1, P2-2):
- **Wild-mode P6 executes the deterministic floor even with a key configured**
  (`engine.ts:3579-3580` — `applyPhaseResult`, logged "(deterministic floor)"). The wild
  *reviewer* is LLM-backed when keyed but never sees a tree-run outcome. The keyed
  wild-synthesis parity fix (P1-3) lands this wave — verify on disk before claiming it.
- The fixes/109 watchdog heartbeats + auto-pause decision math landed (`watchdog.ts`,
  runtime telemetry), but no wild driver yet enforces a wall-clock budget.

## Verify — the trust axis

The machine **verify-fix loop** (`verify` verb / P6 journey): with a key, DeepSeek writes
executable boolean oracle cases from the brief → the bounded local Node runner executes
them → on failure DeepSeek **re-synthesizes the module** from the failure evidence
(whole-artifact re-prompt — there is no apply-patch/continue primitive that edits code),
re-run up to a bounded budget. **Only a real machine-run pass mints `status: "passed"`.**
No key → honest `not-configured` (exit 3, `RT_E_LLM_NOT_CONFIGURED`) — never a fabricated
verdict. The runner is a bounded local runner (hard timeout, no-network env, temp dir,
output caps), not an OS sandbox.

Two honesty limits to hold onto: (1) the oracle is the pipeline's **self-authored spec**
(the emitted `tests/*.spec.ts` asserts what the emitted scaffold does today), not a replay
of the user's real workflow — capability coverage is scored after the run, and identifier
presence is a proxy, never behavioral proof; (2) no keyed LLM tree has converged green on a
real run yet — the one keyed end-to-end journey (fixes/145, 6/9) failed with
`RT_E_LLM_TIMEOUT` and its green tree-run passed over the deterministic floor. The
`tree-run` verification machinery itself is real and runs whatever stands on disk
(fixes/149 A2).

## The self-learning loop

The store level is landed (`knowledge.ts`: capture → store → retrieve → evaluate/evict, with
`fusionRank` cross-project scoring at `algorithms.ts`); the pillar verbs (`vault`, `search`,
`harvest`, `swarm`, `prompt`, `bench`, `mine`, `knowledge`) feed it. Lesson **capture is
live** at real seams — L1 (vague brief at the P0 reframe), L2 (template emission / refused
keyed P6 synthesis), L5 (run summary). **Read-back is deliberately narrow, and honest about
it**: stored lessons re-inject into keyed P6 prompt *expansion* only when the spec cache
misses (`codegen.server.ts`), never into repair prompts, and no lesson ever changes a
budget/model/temperature. Cross-project writes are **human-gated** (`lesson --accept` is the
only path into the store). The packet tier-1 seed is CLI-only; P0-reframe and
wild-classifier injection are not wired (fixes/149 F2 — dead imports). Nothing here is the
"automatic reuse" of a code agent; it is advisory text on a narrow channel, stamped and
auditable.

## The honesty contract

1. **Never fabricate.** Research, code, runner results, estimates: no invented output, ever.
   Items marked `source: "illustrative"` are scaffolding, not facts.
2. **Keyless floors.** No `DEEPSEEK_API_KEY` → deterministic scaffolds and honest
   `not-configured` envelopes. Fake model text does not exist in this codebase.
3. **DoD gates record exit criteria** — advisory when keyless; **enforced by default when a
   `DEEPSEEK_API_KEY` is configured** (`enforceDod` defaults to `keyedDeepSeekConfigured()`,
   engine.ts), so a failing gate parks the run as a hard DoD block. `create --advisory` (CLI)
   or setting the project's `enforceDod` to false restores advisory-only behavior.
4. **Every surfaced failure carries an `RT_E_*` code** (registry: `src/lib/errors.ts`).
5. **Paper trail.** Decision ledger is append-only (actor + ISO timestamp); evidence hashes
   are FNV-1a (integrity, not cryptography).
6. **Declare-or-strike (P0-04).** No user-visible claim may describe a feature that does not
   exist on disk. This README was written under that rule.

## Deploy

See [`.vercel/README.md`](.vercel/README.md). In short: the build emits a Nitro **vercel**
prebuilt output (`.vercel/output/`), deploy with `npx vercel deploy --prebuilt`. **The only
required environment variable is `DEEPSEEK_API_KEY`.** Optional: `TAVILY_API_KEY` (live web
research) and `DATABASE_URL` (deploy-time migrations; PGLite falls back locally).

## Auth posture

**Local-first, single-tenant** (the G7 decision recorded in 94). better-auth is wired at the
lib layer as latent infrastructure, but there is **no login UI** — accounts ship only as a
later, dedicated lane. State lives in browser `localStorage` (app) or JSON files you own
(CLI); export to back up.

## What it does and does not do today

Written under the declare-or-strike rule (honesty contract #6) against the fixes/149 codebase
audit — every claim below is code-proven on disk at this write.

**It IS an autonomous, governed pipeline over its own emissions.** RapidTool owns a bounded
produce → run → repair → score loop over its *internal* project artifact: keyed synthesis
attempts brief-faithful code (`codegen.server.ts`), the machine **tree-run** executes emitted
trees (per-file parse + every emitted `tests/*.spec.ts` under `node --test` + an entry
smoke) and **mints "tested" only on a real green spec run**, the journey repairs from the red
tail within a budget, and `run-eval` **scores its own runs** on the M1–M9 maker rubric with
loud, honest evidence (`fixes/145`, 6/9). It emits runnable node-executable scaffolds, writes
an Obsidian-style vault, keeps an append-only decision ledger, and **learns via human-gated
lessons** (`lesson --accept` is the only cross-project write — no machine path appends to the
store). Keyless, every AI surface degrades to a deterministic floor with an honest
`RT_E_LLM_NOT_CONFIGURED` envelope; keyed runs default **enforce-DoD ON**.

**It is NOT yet:**

- **A code-editing agent on arbitrary repos.** No verb reads a directory back into a project;
  there is no apply-patch/continue primitive anywhere. `emit` is a one-way projection (a
  re-emit overwrites the target), repair is a whole-artifact re-prompt from failure text, and
  nothing can continue from an edited emitted tree. The emit→edit→re-emit seam
  (`repair --dir`, standalone `tree-run --dir`) lands this wave — fixes/149 P0-1; verify on
  disk at write time.
- **A deployer.** Emitted webapp/game trees *declare* react/vite/tailwind + `build: vite
  build`, but nothing ever installs those dependencies or runs the kind's real build — only
  the node-runnable oracle/entry surface has ever executed. The opt-in `emit --verify-kind`
  install+build leg lands this wave — fixes/149 P1-2; verify on disk at write time.
- **An autonomous semantic-fixer of user workflows.** Verification runs a **self-authored
  oracle spec**, not the user's real workflow; capability coverage is computed post-hoc and
  identifier presence is a proxy, not behavioral proof. A run can converge with
  `treeRunOk: true` while every corpus capability sits unrepaired in `coverage.missing`
  (that is exactly the shape of the 6/9 keyed run). And no keyed LLM tree has converged green
  on a real run yet — the keyed journeys to date failed loudly (`RT_E_LLM_TIMEOUT`) and the
  green machine runs passed the deterministic floor.
- **A wild-mode code generator.** Wild-mode P6 steps execute the deterministic floor even
  with a key configured; the wild reviewer never sees a tree-run outcome (fixes/149 F1, P1-3
  landing this wave).
- No hosted build fleet (verification runs on your machine), no streaming chat (one-shot
  grounded turns; streaming + Stop button on the roadmap — 94 §G2), no undo/checkpoints
  (94 §G3), no server-side project storage (per-browser `localStorage` / per-file JSON only),
  and no login UI (local-first, single-tenant; better-auth is latent — 94 §G7).

## Docs map

- [`AGENT_GUIDE.md`](AGENT_GUIDE.md) — the contract for agents **consuming** RapidTool projects
- [`scripts/README-cli.md`](scripts/README-cli.md) — the full CLI machine contract
- [`.vercel/README.md`](.vercel/README.md) — the deploy story
- `fixes/149_a4_codebase_beyond.md` / `fixes/149_a5_synthesis_fixes.md` — the declare-or-strike
  codebase audit this README's [capability section](#what-it-does-and-does-not-do-today) cites
- `research/multiagent/` — audit dossiers:
  [94 readiness plan](research/multiagent/94_readiness_plan.md) ·
  [96 engineering completion](research/multiagent/96_engineering_completion.md) ·
  [93 design flaws (DF-01…)](research/multiagent/93_design_flaws.md) ·
  [90 LEAPFROG](research/multiagent/90_LEAPFROG.md) ·
  [89 self-learning research](research/multiagent/89_self_learning_research.md) ·
  [42 competitive analysis](research/multiagent/42_competitive_analysis.md) ·
  [13 top-20 gaps](research/multiagent/13_top20_gaps.md) ·
  [21 plain-English guide](research/multiagent/21_plain_english_guide.md) ·
  [10 production pipeline](research/multiagent/10_production_readiness.md)
