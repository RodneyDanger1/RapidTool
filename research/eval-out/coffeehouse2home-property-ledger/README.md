> [!CAUTION]
> ## RED TREE-RUN — THIS ARTIFACT IS NOT VERIFIED (RapidTool T-07 / F-07)
>
> The last machine tree-run over this project's generated tree FAILED: 3 failed tree-runs on the
> project's own log trail (see `logs` in the run JSON), with **no green tree-run since**.
> Any phase rail below that reads P6 `complete` is the engine's phase RECORD — it is
> written independently of the tree verdict and is NOT evidence of a passing build.
> Last failure: `the emitted project's own 'npm run test' fail (exit 1) — TAP version 13 # file:///C:/Users/mnril/AppData/Local/Temp/rt-treerun-w5Fih8/src/generated/get-property.ts:250 # module.exports.getProperty = getProperty; # ^ # ReferenceError: module is not defined in ES module scope #     at file:///C:/Users/mnril/AppData/Local/Temp/rt-treerun-w5Fih8/src/generated`
>
> Clear it by reaching a green tree-run (`rapidtool tree-run --dir <dir> --project <run.json>`)
> and re-emitting. Until then, do not treat this tree as a verified deliverable.

# Coffeehouse2Home Property Ledger

> machine-generated from RapidTool packet 6007f9af-f6d5-4b2e-9eaa-ede6f800cb6e; regenerate, don't hand-edit.

Coffeehouse2Home is one software suite for a property-services company that does brokerage, house flipping, rentals, and field services, run by one shared Property Ledger: every property has a single record (ownership, address, status, full history) shared across all five domains. The real-estate CRM tracks contacts, buyer and seller leads, and a deal pipeline with stages; any listing, flip, or rental property can publish showing slots (private showings and open houses) that buyers book with ema…

## Status
- **Kind:** webapp — web app (kind webapp (mapped from declared kind "app"))
- **Status:** running · **Current phase:** P6 · **Model route:** deepseek-flash
- **Created:** 2026-09-24T19:45:35.969Z

## What ships in this scaffold

| File | Origin |
| --- | --- |
| `README.md` | this file — mission + commands |
| `DEPLOY.md` | run/test/env/deploy notes (honest local-only framing) |
| `.env.example` | PLACEHOLDER env template — copy to .env, never commit real values |
| `.gitignore` | keeps an install/build/verify run (node_modules/, dist/, .rapidtool/logs/) out of the review diff |
| `package.json` | per-kind skeleton (scripts/deps) + tsconfig.json |
| `.rapidtool/project.json` | the full exported project (packet, artifacts, oracle, contracts) |
| `index.html` | vite HTML entry — mounts src/main (fixes/135 bootability) |
| `vite.config.ts` | vite config (kind-appropriate plugins) — emitted for webapp |
| `src/main` | browser entry that mounts the UI shell (src/ui) |
| `src/domain/real_estate.ts` | schema — Typed entities from the lattice |
| `src/api/routes.ts` | api — HTTP contracts bound to jobs |
| `src/state/store.ts` | store — Checkpointed client/server state |
| `src/jobs/track.ts` | job-0 — Implement job “track” against the contract |
| `src/jobs/record.ts` | job-1 — Implement job “record” against the contract |
| `src/jobs/flip.ts` | job-2 — Implement job “flip” against the contract |
| `src/jobs/show.ts` | job-3 — Implement job “show” against the contract |
| `src/jobs/lease.ts` | job-4 — Implement job “lease” against the contract |
| `src/ui/console.tsx` | ui — Operator surfaces bound to store fields |
| `tests/oracle.spec.ts` | tests — Acceptance tests from the oracle |
| `src/generated/get-property.ts` | generated tree file — brief capability module (project.generatedTree, fixes/144 M2) |

## Phase rail

- P0 Deep Research & Feasibility — complete · gate passed
- P1 Core Orchestration & State Graph — complete · gate passed
- P2 Memory & Context Consolidation — complete · gate passed
- P3 Tool Integration & Interoperability — complete · gate passed
- P4 Security, Isolation & Authorization — complete · gate passed
- P5 Validation, HITL & Self-Learning — complete · gate passed
- P6 Code Generation, Testing & Deployment — complete · gate unrecorded
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
  # 6 row(s) are NOT IMPLEMENTED and appear as skipped in this
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
- Oracle rows (`tests/oracle.spec.ts`): 0 of 6 pinned row(s) assert the emitted modules' real current behavior; 6 are NOT IMPLEMENTED — emitted as visibly-marked `test.skip("<id> — NOT IMPLEMENTED")`, reported by `npm test` as skipped (never green): `orc-1`, `orc-2`, `orc-3`, `orc-4`, `orc-5`, `orc-phase`.
- 5 declared spec-graph job node(s) were NOT materialised by the generated tree (never bridged — a re-export at a job path would read as a leftover job): `src/jobs/track.ts`, `src/jobs/record.ts`, `src/jobs/flip.ts`, `src/jobs/show.ts`, `src/jobs/lease.ts`.
- 3 non-job module(s) are thin bridges to the tree entry (counted, never silent): `src/domain/real_estate.ts`, `src/api/routes.ts`, `src/state/store.ts`.
- `src/ui/` is a contract-level shell (P8 interface contract), not a finished UI.
- Deploy templates from P9/P12 are recorded artifacts only — see DEPLOY.md; nothing here deploys by itself.
- `assets/` and `public/` are expected at the emitted scaffold and are NOT engine-generated.
