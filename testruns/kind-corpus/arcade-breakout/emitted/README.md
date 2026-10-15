> [!WARNING]
> ## DECLARED SCRIPTS NOT RUN — `typecheck` and `build` ARE UNVERIFIED (RapidTool W48 / 334-3)
>
> The emitted `package.json` declares `typecheck` and `build`, but this emitter NEVER runs them over the tree it writes — no `npm install`, no declared-script execution. They are scaffold claims — NOT verified behavior. Run `npm install && npm run typecheck && npm run build` yourself (or re-emit with `--verify-kind`, which installs and builds a scratch copy) before treating this scaffold as build-verified. A tree-run executes these declared tools when it can resolve them (the emitted tree's own `node_modules`, else the emitting repo's own installed root): a type-clean tree reports `declaredScriptsVerified: true`, and a tool it cannot resolve reports `declaredScriptsVerified: false` + `unverifiedDeclaredScripts: [...]` in its JSON — never a silent pass.

# A Browser Arcade Game

> machine-generated from RapidTool packet 4a2c2dc2-9537-46ef-9cd2-8ebd9ba44272; regenerate, don't hand-edit.

A browser arcade game for players: drag the paddle to bounce the ball and break rows of bricks across three levels of increasing speed; track the score live and persist the high score between sessions; keyboard controls, pause and resume, and win or lose screens — canvas only.

## Status
- **Kind:** game — game (kind game (inferred from brief/domain — no declared kind yet))
- **Status:** intake · **Current phase:** P0 · **Model route:** deterministic
- **Created:** 2026-10-15T21:56:15.901Z

## What ships in this scaffold

| File | Origin |
| --- | --- |
| `README.md` | this file — mission + commands |
| `DEPLOY.md` | run/test/env/deploy notes (honest local-only framing) |
| `.env.example` | PLACEHOLDER env template — copy to .env, never commit real values |
| `.gitignore` | keeps an install/build/verify run (node_modules/, dist/, .rapidtool/logs/) out of the review diff |
| `LICENSE` | MIT licence text (year + holder derived from this project's own record) |
| `.github/workflows/ci.yml` | CI — installs, typechecks and tests THIS emitted tree (fixes/352) |
| `package.json` | per-kind skeleton (scripts/deps) + tsconfig.json |
| `.rapidtool/project.json` | the full exported project (packet, artifacts, oracle, contracts) |
| `index.html` | vite HTML entry — mounts src/main.ts (fixes/135 bootability) |
| `vite.config.ts` | vite config — plain (this kind declares no framework plugin) |
| `src/main.ts` | browser entry that mounts the UI shell (src/ui) |
| `src/domain/custom_software.ts` | schema — Typed entities from the lattice |
| `src/api/routes.ts` | api — HTTP contracts bound to jobs |
| `src/state/store.ts` | store — Checkpointed client/server state |
| `src/jobs/track.ts` | job-0 — Implement job “track” against the contract |
| `src/jobs/drag.ts` | job-1 — Implement job “drag” against the contract |
| `src/jobs/persist.ts` | job-2 — Implement job “persist” against the contract |
| `src/ui/console.tsx` | ui — Operator surfaces bound to store fields |
| `tests/oracle.spec.ts` | tests — Acceptance tests from the oracle |
| `assets/manifest.json` | expected asset roster — NOT engine-generated |

## Phase rail

- P0 Deep Research & Feasibility — ready · gate unrecorded
- P1 Core Orchestration & State Graph — locked · gate unrecorded
- P2 Memory & Context Consolidation — locked · gate unrecorded
- P3 Tool Integration & Interoperability — locked · gate unrecorded
- P4 Security, Isolation & Authorization — locked · gate unrecorded
- P5 Validation, HITL & Self-Learning — locked · gate unrecorded
- P6 Code Generation, Testing & Deployment — locked · gate unrecorded
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
  # ORACLE SHORTFALL: 1 row(s) are NOT IMPLEMENTED and are emitted
  # as MARKED skips (a skip is not a pass — each prints its marker on its
  # own TAP line) — see the oracle-row census under Honest boundaries
  npm test
  
  # dev server — index.html + src/main entry + vite config are emitted; the UI
  # itself is a contract-level shell per the P8 interface contract
  npm run dev
```

## Lockfile & reproducibility

- **No `package-lock.json` is shipped.** This emitter is pure and offline: it cannot know the resolved transitive versions or their integrity hashes, and a lockfile carrying fabricated hashes would violate the scaffold's no-invention rule. Emitting none is the honest choice.
- `npm install` (the step CI runs) resolves and writes `package-lock.json` on its first run; commit that file, then switch the workflow to `npm ci`, for a byte-reproducible install.
- The `dependencies`/`devDependencies` ranges in `package.json` are the only version claim this tree makes.

## Machine record

- `.rapidtool/project.json` is the live exported project: packet, artifacts, oracle, contracts.
- Regenerate this scaffold from it with the RapidTool emit command — hand-edits are overwritten.

## Honest boundaries

- The machine-verified core is the generated P6 module under `src/` (project.generatedSource); everything else is a typed stub awaiting implementation.
- Oracle rows (`tests/oracle.spec.ts`): ACCEPTANCE SHORTFALL — 1 of 4 pinned row(s) are NOT IMPLEMENTED and are emitted as MARKED skips under their pinned ids (`{ skip: ... }` — the marker prints on each row's own TAP line, and the same total is counted in the emitted spec's header); the remaining 3 assert the emitted modules' real current behavior. A skip is not a pass: the shortfall is named here and never silent: `orc-phase`.
- The emitted browser game module is a DETERMINISTIC SCAFFOLD TEMPLATE — a fixed platformer shell, byte-identical across briefs, with no mechanics derived from this brief. Treat it as a starting harness, not as generated product work; replace it with the brief's real mechanics before shipping (`gameTemplate:true` rides the emit envelope).
- `src/ui/` is a contract-level shell (P8 interface contract), not a finished UI.
- Deploy templates from P9/P12 are recorded artifacts only — see DEPLOY.md; nothing here deploys by itself.
- `assets/` and `public/` are expected at the emitted scaffold and are NOT engine-generated.
