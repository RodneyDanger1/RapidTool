# 98 — Readiness Exec Log: Doc-Safe Lanes Landed (B4/B7/M6/G7 docs) + Gate Verification

- **File:** `research/multiagent/98_readiness_exec.md` (repo root `C:\Users\mnril\Desktop\RapidTool Main` — NOT a git repo).
- **Date / agent:** 2026-09-06 · **PRO executor P-94 (READINESS PLAN — doc lanes)**. Executes the parts of `94_readiness_plan.md` whose file ownership is doc-safe; **strictly read-only on `src/`** (the in-flight wave `deleg_ee964d63` owns engine/knowledge/chat/etc. — no source touched this session).
- **Sibling contracts:** 95 (competitor-superiority), 96 (engineering completion) authored in parallel; the in-flight wave owns fixes/97–99; `deleg_5e66e816` designs fixes/109. This file owns the **execution log for the doc lanes** and maps every 94 item to done / why-skipped / pending-elsewhere.
- **0-hallucination rule:** every claim below was read from disk or executed this session (file:line or command output cited). Commands run: `grep` counts on `scripts/rapidtool-cli.mjs` (case arms), `src/lib/phases.ts`, `src/lib/verify.server.ts`, `src/lib/headless.ts`, `vite.config.ts`, `package.json`, `.env` (key names only — values never read), `.vercel/output/*`; `npm run typecheck` and `npm run lint` executed this session. `npm run build` deliberately NOT run (rationale §4).

---

## §0 Verdict

- **No P0 findings in the doc lanes.** Two real CLI-doc drifts found and **fixed** (doctor section missing; `verify --apply` undocumented). Two stale files **flagged, not edited** (out of lane: `AGENTS.project.md`, `startup.sh`).
- **AGENTS.md refresh is BLOCKED by the harness**: AGENTS.md is a protected agent-instruction file and the required approval timed out (subagent context — no interactive approver). Per harness rule I did not retry or use another path. The complete replacement content is **staged verbatim in §6** — one approved write by the parent/user applies it.
- **Gates:** typecheck RED (1 error, `prompt-engine.test.ts:406` — in-flight wave's task-1 file), lint 1 error + 15 warnings (all `src/lib` files owned by the in-flight wave). Neither is caused by this lane (`.md`-only changes; tsc/eslint do not lint markdown). Build deferred per 94 §5/M6.

## §1 What landed (files)

| File | Action | Content |
|---|---|---|
| `README.md` (root) | **NEW** | What RapidTool is; quickstart (real commands from package.json/vite.config); 13-phase table (titles from `phases.ts`); 27-verb table (count verified); Wild Mode; verify loop; self-learning loop; honesty contract; deploy pointer; auth posture (G7); docs map (90/94/96/93/89/42/13/21/10). |
| `scripts/README-cli.md` | **FIXED (2 drifts)** | Added `## Doctor (doctor)` section + numbered entry #17 (renumbered tail → 26 items for 27 verbs); documented `verify --apply` (persistence semantics); ingest `--report` inline/`@file`/`-` stdin note. |
| `.vercel/README.md` | **NEW** | Deploy story verified against on-disk `.vercel/output` + `vite.config.ts`: nitro vercel preset, `npx vercel deploy --prebuilt`, no vercel.json needed, env vars (required: `DEEPSEEK_API_KEY` only; optional `TAVILY_API_KEY`, `DATABASE_URL`), honest notes (localStorage, latent auth, legacy static chrome). |
| `AGENTS.md` | **STAGED, not applied** | Full rewrite (Grok-sandbox contract → current architecture) staged in §6 below; blocked by protected-file approval. |
| `research/multiagent/98_readiness_exec.md` | **NEW** | This log. |

## §2 94-item disposition map

| 94 item | Disposition | Detail |
|---|---|---|
| B1 test gate | **pending — 96's lane** | scripts-leg red (10 failures, legacy chrome). Not mine (test suite + vite.config/src edits). |
| B2 dead controls | **pending — UI fixer post-wave** | Needs fixes/105 (not on disk) + console.tsx sweep; must not collide with wave task-2. |
| B3 empty states | **pending — same UI sweep** | Fold into B2. |
| B4 docs accuracy | **DONE (this lane)** | Root README ✅ · AGENTS.md rewrite ✅ staged (§6, needs one approval) · README-cli vs 27 verbs diffed manually: 27/27 case arms ✅, 2 drifts fixed ✅. Scripted doc-vs-implementation diff test: recorded as future work (script test — better in 96's lane). |
| B5 keyboard/a11y | **pending — UI QA pass** | Not a doc lane. |
| B6 error feedback | **pending — wave task-2 tail** | Classify sweep + inventory test owned by the wave. |
| B7 install/run + first-run | **PARTIAL (this lane) / pending (UI)** | README quickstart with real commands ✅ (scripts + port verified). DF-28 demo-seed "sample" labeling → UI fixer (console.tsx, wave-owned region). |
| M1 runtime telemetry | **pending — fixes/109** | In-design by `deleg_5e66e816`; do not build. |
| M2 chat persistence UI | **pending — wave task-2** | Verify post-wave. |
| M3 verification visibility | **pending — wave task-2** | Oracle-tab verdicts + verify surface. |
| M4 wild-loop watchdog | **pending — fixes/109** | (DF-23 pause-code one-liner → B2 sweep.) |
| M5 enforceDod default | **pending — decision post-wave** | Needs engine/store quiescence; README + AGENTS.md copy already hedged to survive the decision. AGENT_GUIDE.md honesty-contract refresh after the decision is **out of this lane's file list** (flagged). |
| M6 packaging/hosting | **PARTIAL (this lane) / pending (post-wave)** | Deploy doc ✅ (`.vercel/README.md`, verified against `.vercel/output` built 2026-09-06T21:52Z). Fresh `npm run build` + `preview` boot check **deferred** — 94 §5: building while fixers edit the engine is invalid. P9 runbook artifact + E3 bundle → later lanes. |
| G1 codegen Part B | **pending — wave task-0** | `codegen.server.ts` now exists on disk (mid-landing); README P6 copy hedged accordingly. |
| G2 streaming chat | **pending** | Backend stream + Stop (fixes/99 §2 spec). |
| G3 undo/checkpoints | **pending** | Post-wave store semantics. |
| G4 project mgmt at scale | **pending** | Workspace bundle + delete/rename + fidelity test. |
| G5 multi-project workflows | **pending** | Wire knowledge retrieval + handoff profiles. |
| G6 self-learning loop | **pending — wave task-1** | Loop core landed; injection/writer seams in flight. README self-learning section written to match. |
| G7 auth decision | **DONE-documented (this lane)** | README states the posture: local-first single-tenant, auth latent, no login UI. Matches 94's recommendation; no half-surfaced login. |

## §3 Verified-safe baseline (doc claims pinned — do not re-litigate)

- **27 verbs = 27 case arms**: `grep -c 'case "' scripts/rapidtool-cli.mjs` → **27** (create, run, gate, approve, reject, retry, ingest, packet, export, summary, vault, search, crew, verify, design, diagram, artifacts, harvest, swarm, prompt, bench, mine, knowledge, wild, chat, deepen, doctor).
- **Stock HITL gates**: `src/lib/phases.ts:151` → `STOCK_HITL = [4, 5, 8, 9]`; `HITL_PHASES` at :150.
- **13 phase titles**: `phases.ts:7–103` (P0 Deep Research & Feasibility … P12 Documentation & Technical Specs). P5 title still contains "Self-Learning" (`phases.ts:47`) — the DF-20 truthfulness fix is the wave's (P0-04).
- **verify**: `MAX_ITERATIONS = 3` (`verify.server.ts:48`); `--apply` arm exists in `rapidtool-cli.mjs` case "verify" (passed→stamps lastTest+verify artifact, failed→verify.fail, not-configured→no write); exit map passed 0 / failed 1 / not-configured 3 / error 4.
- **doctor**: `headless.ts:1303` `doctorStatus()` → `{ llm, research, runner, node }`; module-missing → honest labels; never throws.
- **ingest**: `--report` inline JSON | `@file.json` | `-` stdin (`readReportSource` in the CLI).
- **Deploy artifacts on disk**: `.vercel/output/config.json` (v3, framework nitro 3.0.260610-beta, routes: assets immutable + catch-all → `__server`), `functions/__server.func/`, `static/` (assets, favicon.svg, og.jpg, `__grok`), `nitro.json` (`preset: vercel`, `deploy: npx vercel deploy --prebuilt`). No root `vercel.json`.
- **Env**: `.env` contains **only `DEEPSEEK_API_KEY`** (names-only grep; values not read). `.env.example` documents `DEEPSEEK_API_KEY` + optional `TAVILY_API_KEY`, no `VITE_` prefix rule. `scripts/migrate.mjs` runs inside `npm run build`, skips when `DATABASE_URL` unset (PGLite fallback).
- **npm scripts**: `package.json:9–21` — dev (port 8080 via with-app-env), build (+db:migrate), preview, typecheck (`tsc --noEmit`), lint (`eslint .`), test (scripts-leg `&&` src/lib-leg — the `&&` short-circuit is the B1 problem, 96's lane), check:auth.
- **Node**: v22.23.2 on this machine (matches README-cli's claim).

## §4 Gate verification run this session

| Gate | Result | Attribution |
|---|---|---|
| `npm run typecheck` | **RED** — 1 error: `src/lib/prompt-engine.test.ts(406,84)` TS2345 (MemoryEntry kind mismatch) | In-flight wave (task-1 owns prompt-engine); not caused by `.md`-only changes. |
| `npm run lint` | **1 error + 15 warnings** — error `src/lib/codegen.server.ts:515` prefer-const; warnings in harvest.ts, vault.ts, store.test.ts, chat files | All in-flight-wave files (task-0/task-1). My lane adds no JS/TS. |
| `npm run build` | **DEFERRED** | 94 §5 wave-coordination rule + M6: engine/store mid-edit → a build now is invalid and would churn `.vercel/output`. Existing `.vercel/output` (2026-09-06T21:52Z) verified structurally valid (§3). |

Docs cannot break any of these gates (no markdown lint rule in `eslint.config.mjs`; tsc covers TS only).

## §5 Decisions + flags (for the parent / post-wave re-plan)

1. **AGENTS.md blocked** — protected-file approval timed out. §6 stages the full replacement; apply with one approved write. Acceptance "AGENTS.md no longer mentions the sandbox contract" is one action away.
2. **Not touched (ownership strict):** `AGENTS.project.md` (262 B, stale sandbox pointer — recommend replacing with a pointer to `README.md`/`AGENT_GUIDE.md` once AGENTS.md approval flows), `startup.sh` (references `/workspace`; restart contract is 96/B7 territory), `AGENT_GUIDE.md` (M5 refresh out of lane), `src/**` (wave-owned).
3. **README phrasing survives the wave**: P6 codegen hedged as "final wiring landing (94 §G1)"; self-learning loop described at the landed store level with injection "being completed (94 §G6)"; DoD advisory status hedged pending M5.
4. **Remaining B4 tail** (scripted README-cli ↔ CLI diff test) recorded for 96's lane.
5. **Post-wave re-verify** (94 §6): re-run typecheck/lint; fresh `npm run build` + `npm run preview` boot check; then flip M6 and B1 dispositions in this file.

## §6 STAGED: AGENTS.md replacement (apply verbatim — one approved write)

```markdown
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
  `/c/Users/mnril/Desktop/RapidTool Main`). **NOT a git repo.** Quote paths. Ripgrep-style
  search tools fail on the space — use terminal `grep` after `cd "/c/Users/mnril/Desktop/RapidTool Main"`.
- **Node 22** required (type-stripping). All npm scripts route through
  `scripts/with-app-env.mjs`; the dev server binds `0.0.0.0:8080` (vite.config.ts). Do not
  change the host/port contracts.

## Read before acting

| Doc | When |
|---|---|
| `AGENT_GUIDE.md` | Always — the honesty contract + how agents consume projects |
| `README.md` | Quickstart, 13-phase pipeline, 27-verb CLI overview, deploy |
| `scripts/README-cli.md` | Any CLI work — verbs, exit-code taxonomy (0/1/3/4), RT_E registry |
| `research/multiagent/94_readiness_plan.md` | Any feature work — the live what-is-left plan + wave-ownership rules (§5) |
| `research/multiagent/93_design_flaws.md` | DF-01…DF-38 ledger of known defects |
| `research/multiagent/90_LEAPFROG.md` | Strategy: competitor-gap ledger + leapfrog axes |
| `research/multiagent/96_engineering_completion.md` | Engineering scorecard (tests/coverage/warnings gates) |
| `fixes/` | Append-only landing logs of the current fix wave (`97`–`101`…) |

## Source layout

- `src/lib/` — the engine, pure modules with colocated `*.test.ts`:
  `engine.ts`, `store.ts`, `phases.ts`, `dod.ts`, `packet.ts`, `io.ts`, `errors.ts`
  (RT_E registry), `knowledge.ts`, `algorithms.ts` (fusionRank), `vault.ts`, `harvest.ts`,
  `report-intake.ts`, `prompt-engine.ts`, `crew*.ts`, `verify.server.ts`, `chat*.ts`,
  `design.ts`, `diagram.ts`, `swarm.ts`, `bench.ts`, `ast-mine.ts`, `node-runner.server.ts`
  (bounded local runner — not an OS sandbox), `deepseek.server.ts`, `tavily.server.ts`,
  `headless.ts` (CLI backend), `codegen.server.ts`.
- `src/routes/` + `src/components/console.tsx` — the TanStack Start UI.
- `scripts/` — CLI + build tooling: `rapidtool-cli.mjs` (27 verbs), `with-app-env.mjs`,
  `migrate.mjs`, `check-auth-invariant.mjs`, plus `*.test.mjs` suites.
- `migrations/` — deploy-time migrations (`migrate.mjs` runs inside `npm run build`;
  PGLite fallback locally when `DATABASE_URL` is unset).

## Commands

- `npm run dev` (port 8080) · `npm run build` (+ `db:migrate`) · `npm run preview` (port 8081)
- `npm run typecheck` / `npm run lint` — the day-to-day gates. Keep them at 0.
- `npm test` — the scripts-leg currently has **known failures in the legacy platform-chrome
  tests** (94 §B1; owned by 96's lane). A red `npm test` is not yours unless you touched a
  script — check 94/96 before chasing it.
- CLI: `node --experimental-strip-types scripts/rapidtool-cli.mjs <verb> …` — single JSON
  object on stdout, exit taxonomy 0/1/3/4.

## Honesty contract (non-negotiable)

1. **No fabrication.** Research, code, runner results, estimates: never invented.
   `source: "illustrative"` = scaffolding, not fact.
2. **Keyless floors.** No `DEEPSEEK_API_KEY` → deterministic scaffold + honest
   `RT_E_LLM_NOT_CONFIGURED` envelope. Never fake model text.
3. **Declare-or-strike (P0-04).** Any user-visible claim must match real behavior on disk;
   strike the claim if it doesn't.
4. **RT_E codes.** Every surfaced failure carries a code from `src/lib/errors.ts`
   (`ERROR_CODE_DOC` is the canonical registry).
5. **DoD gates are advisory** by default — they record exit criteria, they do not silently
   block. An enforce-DoD setting exists; its default is under review (94 §M5). Check 94 before
   writing gate-behavior claims.
6. **Paper trail.** Decision ledger is append-only (actor + ISO timestamp); evidence hashes
   are FNV-1a (integrity, not cryptographic).

## Lane rules (current fix wave)

- The in-flight Pro wave (`deleg_ee964d63`, fixes/97–99) **owns** `engine.ts`, `store.ts`,
  `dod.ts`, `phases.ts`, `sandbox.ts`, `headless.ts`, `chat*.ts`, `verify.server.ts`,
  `errors.ts`, `knowledge.ts`, `vault.ts`, `harvest.ts`, `report-intake.ts`,
  `prompt-engine.ts`, and the chat/oracle regions of `console.tsx`. **Do not edit those files
  while it runs** (94 §5, wave-coordination rule).
- Research missions write **only** `research/multiagent/NN_*.md`, read-only on source; follow
  the conventions in the `rapidtool-development` Hermes skill
  (`references/research-doc-conventions.md`).
- Fix waves land in `fixes/NN_*.md`, append-only.
- Docs lanes own their files strictly (94 §B4: root `README.md`, `AGENTS.md`,
  `scripts/README-cli.md`, `.vercel/` docs, exec logs) — do not collide with another lane's
  file list.

## Legacy scaffolding — do not build on it

`.grok/`, `server/` middleware, `scripts/grok-pwa-*`, `AGENTS.project.md`, and `startup.sh`
are stale scaffolding from the repo's origin. They are **not the contract** (ignore them
unless a named doc above points at them; `AGENTS.project.md` and `startup.sh` reference
sandbox paths that do not exist on this machine). Their keep-or-descope fate is decided in
94 §B1 / 96. Do not delete or extend them until that lands.
```

## Files created/modified

- `README.md` — **created** (root; 12.1 KB)
- `scripts/README-cli.md` — **modified** (doctor section + numbering, verify `--apply`, ingest stdin note)
- `.vercel/README.md` — **created** (deploy story)
- `research/multiagent/98_readiness_exec.md` — **created** (this log)
- `AGENTS.md` — **staged only** (§6 above); on-disk file unchanged (protected-file approval timed out)
- `src/**` — **untouched** (read-only; wave-owned)
