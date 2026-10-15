> [!WARNING]
> ## DECLARED SCRIPTS NOT RUN — `typecheck` and `build` ARE UNVERIFIED (RapidTool W48 / 334-3)
>
> The emitted `package.json` declares `typecheck` and `build`, but this emitter NEVER runs them over the tree it writes — no `npm install`, no declared-script execution. They are scaffold claims — NOT verified behavior. Run `npm install && npm run typecheck && npm run build` yourself (or re-emit with `--verify-kind`, which installs and builds a scratch copy) before treating this scaffold as build-verified. A tree-run executes these declared tools when it can resolve them (the emitted tree's own `node_modules`, else the emitting repo's own installed root): a type-clean tree reports `declaredScriptsVerified: true`, and a tool it cannot resolve reports `declaredScriptsVerified: false` + `unverifiedDeclaredScripts: [...]` in its JSON — never a silent pass.

# # Shiftline — Office

> machine-generated from RapidTool packet 7251ab87-21e1-4271-a724-f88294177871; regenerate, don't hand-edit.

# Shiftline — Office Shift & Appointment Scheduler ## What this is An internal tool for scheduling office shifts and appointments. A manager builds a weekly rota for staff and books rooms for appointments; staff see their own upcoming shifts and any conflicts are surfaced before they happen. ## Users - **Manager** — builds the rota, assigns shifts, books appointments. - **Staff** — view their own shifts and request time off. - **Reception** — books appointments into rooms. ## Core domain - **Sta…

## Status
- **Kind:** webapp — web app (kind webapp (mapped from declared kind "app"))
- **Status:** running · **Current phase:** P6 · **Model route:** deepseek-flash
- **Created:** 2026-10-05T02:30:31.070Z

## What ships in this scaffold

| File | Origin |
| --- | --- |
| `README.md` | this file — mission + commands |
| `DEPLOY.md` | run/test/env/deploy notes (honest local-only framing) |
| `.env.example` | PLACEHOLDER env template — copy to .env, never commit real values |
| `.gitignore` | keeps an install/build/verify run (node_modules/, dist/, .rapidtool/logs/) out of the review diff |
| `package.json` | per-kind skeleton (scripts/deps) + tsconfig.json |
| `.rapidtool/project.json` | the full exported project (packet, artifacts, oracle, contracts) |
| `index.html` | vite HTML entry — mounts src/main.tsx (fixes/135 bootability) |
| `vite.config.ts` | vite config — react + tailwindcss plugins (the declared devDeps) |
| `src/main.tsx` | browser entry that mounts the UI shell (src/ui) |
| `src/styles.css` | Tailwind v4 CSS entry compiled by the declared @tailwindcss/vite plugin |
| `src/domain/real_estate.ts` | schema — Typed entities from the lattice |
| `src/api/routes.ts` | api — HTTP contracts bound to jobs |
| `src/state/store.ts` | store — Checkpointed client/server state |
| `src/jobs/approve.ts` | job-0 — Implement job “approve” against the contract |
| `src/jobs/schedule.ts` | job-1 — Implement job “schedule” against the contract |
| `src/jobs/assign.ts` | job-2 — Implement job “assign” against the contract |
| `src/jobs/scan.ts` | job-3 — Implement job “scan” against the contract |
| `src/jobs/sync.ts` | job-4 — Implement job “sync” against the contract |
| `src/ui/console.tsx` | ui — Operator surfaces bound to store fields |
| `tests/oracle.spec.ts` | tests — Acceptance tests from the oracle |
| `src/generated.ts` | generated tree file — brief capability module (project.generatedTree, fixes/144 M2) |
| `src/generated/chunk.ts` | generated tree file — brief capability module (project.generatedTree, fixes/144 M2) |

## Phase rail

- P0 Deep Research & Feasibility — complete · gate passed
- P1 Core Orchestration & State Graph — complete · gate passed
- P2 Memory & Context Consolidation — complete · gate passed
- P3 Tool Integration & Interoperability — complete · gate passed
- P4 Security, Isolation & Authorization — complete · gate passed
- P5 Validation, HITL & Self-Learning — complete · gate passed
- P6 Code Generation, Testing & Deployment — complete · gate unmet (Brief-conformance: required brief nouns appear as identifiers in the generated source (single-module, or the union of the tree files in tree mode) — keyed tree synthesis ran (2 file(s)) but its union dropped the brief's required nouns (missing: shiftline, office, scheduler, internal, scheduling, manager, builds, rota, see, own, upcoming, conflicts, …), Tree architecture: every expanded-spec capability maps to a real generatedTree file carrying its stemmed identifier; no tree file is a template stub or an out-of-tree reexport-only leftover (an assembly barrel whose targets all resolve in-tree is exempt; absent tree = single-module legacy path))
- P7 Domain & Market Research — locked · gate unrecorded
- P8 Dynamic UI/UX Prototyping — locked · gate unrecorded
- P9 CI/CD & Cloud Deployment Routing — locked · gate unrecorded
- P10 Local Agent & Edge Inference — locked · gate unrecorded
- P11 Real-Time Web & Tool Augmentation — locked · gate unrecorded
- P12 Documentation & Technical Specs — locked · gate unrecorded

## Commands

```text
  # install + verify the emitted tree (Node >= 22)
  npm install
  npm run typecheck
  # oracle spec = REAL assertions over the emitted modules (no todo stubs);
  # green means the scaffold modules are intact + every oracle seam is still
  # honestly stubbed — a seam test fails the moment that seam is implemented,
  # which is the cue to replace it with the row's real acceptance assertion.
  # 9 row(s) are NOT IMPLEMENTED and appear as skipped in this
  # run (never green) — see the oracle-row census under Honest boundaries
  npm test
  
  # dev server — index.html + src/main entry + vite config are emitted; the UI
  # itself is a contract-level shell per the P8 interface contract
  npm run dev
```

## Machine record

- `.rapidtool/project.json` is the live exported project: packet, artifacts, oracle, contracts.
- Regenerate this scaffold from it with the RapidTool emit command — hand-edits are overwritten.

## Honest boundaries

- The machine-verified substance is the generated tree under `src/` + `tests/` (project.generatedTree — fixes/144 M2): every file was emitted verbatim at its own repo-relative path and content-hashed at P6; `tests/oracle.spec.ts` imports the tree's ENTRY module (the file at the path the legacy P6 host would have used) so `npm test` executes the real tree. Scaffold infrastructure outside the tree is exactly that — infrastructure.
- Oracle rows (`tests/oracle.spec.ts`): 0 of 9 pinned row(s) assert the emitted modules' real current behavior; 9 are NOT IMPLEMENTED — emitted as visibly-marked `test.skip("<id> — NOT IMPLEMENTED")`, reported by `npm test` as skipped (never green): `orc-1`, `orc-2`, `orc-3`, `orc-4`, `orc-5`, `orc-c-same-day`, `orc-c-deterministic`, `orc-c-local-first`, `orc-phase`.
- 5 declared spec-graph job node(s) were NOT materialised by the generated tree (never bridged — a re-export at a job path would read as a leftover job): `src/jobs/approve.ts`, `src/jobs/schedule.ts`, `src/jobs/assign.ts`, `src/jobs/scan.ts`, `src/jobs/sync.ts`.
- 3 non-job module(s) are thin bridges to the tree entry (counted, never silent): `src/domain/real_estate.ts`, `src/api/routes.ts`, `src/state/store.ts`.
- `src/ui/` is a contract-level shell (P8 interface contract), not a finished UI.
- Deploy templates from P9/P12 are recorded artifacts only — see DEPLOY.md; nothing here deploys by itself.
- `assets/` and `public/` are expected at the emitted scaffold and are NOT engine-generated.
