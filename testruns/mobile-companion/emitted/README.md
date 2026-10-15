> [!CAUTION]
> ## RED TREE-RUN — THIS ARTIFACT IS NOT VERIFIED (RapidTool T-07 / F-07)
>
> The last machine tree-run over this project's generated tree FAILED: 3 failed tree-runs on the
> project's own log trail (see `logs` in the run JSON), with **no green tree-run since**.
> Any phase rail below that reads P6 `complete` is the engine's phase RECORD — it is
> written independently of the tree verdict and is NOT evidence of a passing build.
> Last failure: `the emitted project's own 'npm run typecheck' fail (exit 2) — src/generated/suggest-reorder-quantity.ts(69,40): error TS2448: Block-scoped variable 'globalThisStore' used before its declaration. src/generated/suggest-reorder-quantity.ts(69,72): error TS2448: Block-scoped variable 'globalThisStore' used before its declaration. src/generated/suggest-reorder-qu; the emitted project's own 'npm run test' fail (exit 1) — file:///C:/Users/mnril/AppData/Local/Temp/rt-treerun-tCvn6h/src/generated/suggest-reorder-quantity.ts:69 const globalThisCounter      = (typeof globalThisStore === 'object' && globalThisStore !== null) ? globalThisStore : null;                                ^  ReferenceError: Cannot access 'globalT`
>
> Clear it by reaching a green tree-run (`rapidtool tree-run --dir <dir> --project <run.json>`)
> and re-emitting. Until then, do not treat this tree as a verified deliverable.

> [!WARNING]
> ## DECLARED SCRIPTS NOT RUN — `typecheck` IS UNVERIFIED (RapidTool W48 / 334-3)
>
> The emitted `package.json` declares `typecheck`, but this emitter NEVER runs it over the tree it writes — no `npm install`, no declared-script execution. It is a scaffold claim — NOT verified behavior. Run `npm install && npm run typecheck` yourself (or re-emit with `--verify-kind`, which installs and builds a scratch copy) before treating this scaffold as build-verified. A tree-run executes these declared tools when it can resolve them (the emitted tree's own `node_modules`, else the emitting repo's own installed root): a type-clean tree reports `declaredScriptsVerified: true`, and a tool it cannot resolve reports `declaredScriptsVerified: false` + `unverifiedDeclaredScripts: [...]` in its JSON — never a silent pass.

# # Crumb & Bloom

> machine-generated from RapidTool packet f13debeb-b530-445b-9f52-85b82ad7839e; regenerate, don't hand-edit.

# Crumb & Bloom Companion — Mobile App ## What this is A mobile-optimised companion for the Crumb & Bloom back-office. It is a phone-first version of the counter workflow: staff on their feet take orders, check stock at a glance, and receive alerts when something needs restocking. ## Form factor - Designed for a 360–430px portrait viewport; works one-handed. - Bottom tab bar navigation with four tabs: **Today**, **New Order**, **Stock**, **Alerts**. - Large tap targets (min 44×44px), sticky prim…

## Status
- **Kind:** library — library (kind library (mapped from declared kind "library"))
- **Status:** running · **Current phase:** P6 · **Model route:** deepseek-flash
- **Created:** 2026-10-05T02:16:20.677Z

## What ships in this scaffold

| File | Origin |
| --- | --- |
| `README.md` | this file — mission + commands |
| `DEPLOY.md` | run/test/env/deploy notes (honest local-only framing) |
| `.env.example` | PLACEHOLDER env template — copy to .env, never commit real values |
| `.gitignore` | keeps an install/build/verify run (node_modules/, dist/, .rapidtool/logs/) out of the review diff |
| `package.json` | per-kind skeleton (scripts/deps) + tsconfig.json |
| `.rapidtool/project.json` | the full exported project (packet, artifacts, oracle, contracts) |
| `src/main.ts` | runnable entry declared by package.json (main/bin/start) |
| `src/domain/real_estate.ts` | schema — Typed entities from the lattice |
| `src/api/routes.ts` | api — HTTP contracts bound to jobs |
| `src/state/store.ts` | store — Checkpointed client/server state |
| `src/jobs/alert.ts` | job-0 — Implement job “alert” against the contract |
| `src/jobs/show.ts` | job-1 — Implement job “show” against the contract |
| `src/jobs/search.ts` | job-2 — Implement job “search” against the contract |
| `src/jobs/sync.ts` | job-3 — Implement job “sync” against the contract |
| `src/jobs/record.ts` | job-4 — Implement job “record” against the contract |
| `src/ui/console.tsx` | ui — Operator surfaces bound to store fields |
| `tests/oracle.spec.ts` | tests — Acceptance tests from the oracle |
| `src/generated.ts` | generated tree file — brief capability module (project.generatedTree, fixes/144 M2) |
| `src/generated/compute-cart-total-pence.ts` | generated tree file — brief capability module (project.generatedTree, fixes/144 M2) |
| `src/generated/render-tab-bar.ts` | generated tree file — brief capability module (project.generatedTree, fixes/144 M2) |
| `src/generated/suggest-reorder-quantity.ts` | generated tree file — brief capability module (project.generatedTree, fixes/144 M2) |

## Phase rail

- P0 Deep Research & Feasibility — complete · gate passed
- P1 Core Orchestration & State Graph — complete · gate passed
- P2 Memory & Context Consolidation — complete · gate passed
- P3 Tool Integration & Interoperability — complete · gate passed
- P4 Security, Isolation & Authorization — complete · gate passed
- P5 Validation, HITL & Self-Learning — complete · gate passed
- P6 Code Generation, Testing & Deployment — complete · gate unmet (Machine verification promoted a tested verdict (lastTest.label === "tested" with evidenceHash), Tree architecture: every expanded-spec capability maps to a real generatedTree file carrying its stemmed identifier; no tree file is a template stub or an out-of-tree reexport-only leftover (an assembly barrel whose targets all resolve in-tree is exempt; absent tree = single-module legacy path))
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
  # 1 row(s) are NOT IMPLEMENTED and appear as skipped in this
  # run (never green) — see the oracle-row census under Honest boundaries
  npm test
```

## Machine record

- `.rapidtool/project.json` is the live exported project: packet, artifacts, oracle, contracts.
- Regenerate this scaffold from it with the RapidTool emit command — hand-edits are overwritten.

## Honest boundaries

- The machine-verified substance is the generated tree under `src/` + `tests/` (project.generatedTree — fixes/144 M2): every file was emitted verbatim at its own repo-relative path and content-hashed at P6; `tests/oracle.spec.ts` imports the tree's ENTRY module (the file at the path the legacy P6 host would have used) so `npm test` executes the real tree. Scaffold infrastructure outside the tree is exactly that — infrastructure.
- Oracle rows (`tests/oracle.spec.ts`): 7 of 8 pinned row(s) assert the emitted modules' real current behavior; 1 are NOT IMPLEMENTED — emitted as visibly-marked `test.skip("<id> — NOT IMPLEMENTED")`, reported by `npm test` as skipped (never green): `orc-phase`.
- 3 non-job module(s) are thin bridges to the tree entry (counted, never silent): `src/domain/real_estate.ts`, `src/api/routes.ts`, `src/state/store.ts`.
- `src/ui/` is a contract-level shell (P8 interface contract), not a finished UI.
- Deploy templates from P9/P12 are recorded artifacts only — see DEPLOY.md; nothing here deploys by itself.
- `assets/` and `public/` are expected at the emitted scaffold and are NOT engine-generated.
