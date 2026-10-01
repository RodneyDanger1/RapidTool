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
  `scripts/with-app-env.mjs`; the dev server binds `0.0.0.0:8080` (vite.config.ts). Do not
  change the host/port contracts.

## Read before acting

| Doc | When |
|---|---|
| `AGENT_GUIDE.md` | Always — the honesty contract + how agents consume projects |
| `RESUME.md` | **Every session start** — gate contract, hard rules, decision log, lane briefs |
| `taskuniverselog.md` | **Every session start** — the live task-status board (all dossiers' tasks, statuses, next wave) |
| `remainingwaves.md` | **Every session start** — every remaining wave: tasks, files, done-when, estimates, risks |
| `README.md` | Quickstart, capabilities matrix + honest limits (what works / what can't yet), architecture, docs index |
| `scripts/README-cli.md` | Any CLI work — verbs, exit-code taxonomy (0/1/3/4), RT_E registry |
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
  `node-runner.server.ts` (bounded local runner — not an OS sandbox), `deepseek.server.ts`,
  `headless.ts` (CLI backend), `codegen.server.ts` (liveP6Synthesis),
  `rt-events.ts`/`rt-ring.ts`/`rt-client.ts`/`watchdog.ts`/`diagnose.ts`/`runtime-log.server.ts`
  (runtime telemetry + the `diagnose` verb).
- `src/routes/` + `src/components/console.tsx` — the TanStack Start UI (9+ tabs incl.
  Runtime log).
- `scripts/` — CLI + build tooling: `rapidtool-cli.mjs` (35 verbs dispatched today —
  `grep -c 'case "'` is the count source of truth — incl. the `lesson` family +
  `diagnose` + the fixes/150 G1 continuation verbs `tree-run`/`repair`),
  `with-app-env.mjs`, `gate.sh` (the four-gate stability script), plus `*.test.mjs` suites.
- `migrations/` — deploy-time migrations (`migrate.mjs` runs inside `npm run build`;
  PGLite fallback locally when `DATABASE_URL` is unset).

## Commands

- `npm run dev` (port 8080) · `npm run build` (+ `db:migrate`) · `npm run preview` (port 8081)
- `npm run typecheck` / `npm run lint` — the day-to-day gates. Keep them at 0.
- `npm test` — runs BOTH legs (scripts first, then the full src/lib suite); both are green
  (scripts 261/261; src ~1957 tests — the W12 boundary gate of record, `fixes/218` §5). A red suite is yours to fix unless it is the known
  runner-timing flake (`exec.test.ts` grandchild test) which passes standalone.
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
  object on stdout, exit taxonomy 0/1/2/3/4 (exit 2 = parked at a HITL gate or
  `blocked` — the docs' `scripts/README-cli.md` §Agent contract owns the full
  taxonomy); failures carry their `RT_E_*` code on the object.
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

`.grok/`, `server/` middleware, `scripts/grok-pwa-*`, `AGENTS.project.md`, and `startup.sh`
are stale scaffolding from the repo's origin. They are **not the contract** (ignore them
unless a named doc above points at them). Their keep-or-descope fate is decided in
94 §B1 / 96. Do not delete or extend them until that lands.
