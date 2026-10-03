# docs-FOLDER-MAP — RapidTool Main, depth-2, one line per node

> **Generated:** 2026-09-26 by the W32 organizer lane (`fixes/275_organizer.md`) from `git ls-files` +
> spot-reads. Counts are **tracked files at generation time**; live lanes keep adding files (esp. under
> `fixes/` and `src/lib/`) — re-count with `git ls-files <dir> | wc -l` when precision matters.
> Read `START-HERE.md` first; this is the map, not the manual.

> **Re-counted 2026-10-02 (W47 record audit, HEAD `6575669`; `git ls-files`):** tracked files have grown
> — `src/` **233** (was 211) · `src/lib/` **222** (was 201) · `scripts/` **49** (was 45) · `fixes/`
> **654** (was 460) · `wave_plans/` **123** (was 106) · `research/multiagent/` 103 (unchanged) ·
> `research/eval-corpus/` 23 (unchanged). The per-node numbers below are the 2026-09-26 snapshot.

> **Re-counted 2026-10-03 (342-6 sweep, HEAD `686d7b6`; `git ls-files`):** `src/` **246** · `src/lib/`
> **235** · `scripts/` **49** · `fixes/` **719** · `wave_plans/` **139** · `research/` 476 · total tracked
> **2,096** (includes the 192 tracked `.t4scratch/` files).

> **Re-counted again 2026-10-03 (345-F1 docs-truth fix; HEAD `06cb089`; `git ls-files`):** the 2,096
> above is stale — `.t4scratch/` is **untracked/removed** (`git ls-files .t4scratch` = 0), so the live
> total is **1,933**: `src/` **250** · `src/lib/` **239** (123 modules + 112 tests) · `scripts/` **49**
> (25 tools + 24 tests) · `fixes/` **744** · `wave_plans/` **139** · `research/` 476. Re-derive with
> `git ls-files <dir> | wc -l`.

```
RapidTool Main/
│
├─ src/ (211) ................ the product: pure engine + UI surfaces
│  ├─ lib/ (201) ............. engine & logic; tests colocated (*.test.ts). Key files:
│  │  │                        engine.ts (13-phase state machine) · headless.ts (journey driver/CLI backend)
│  │  │                        codegen.server.ts (P6 synthesis) · store.ts (zustand state) · phases.ts
│  │  │                        packet.ts · dod.ts · io.ts · errors.ts (RT_E registry) · verify.server.ts
│  │  │                        compile-check.server.ts + node-runner.server.ts (bounded runner, NOT a sandbox)
│  │  │                        scaffold.ts (tree writer) · policy.ts · algorithms.ts · vault.ts · harvest.ts
│  │  └─ auth/ (19) · app-data/ (7) · llm/ (8, provider seam) · multiplayer/ (2) · og/ (1) · testing/ (1)
│  ├─ components/ (4) ........ UI components — console.tsx is the main console surface
│  ├─ routes/ (3) ............ TanStack Start routes (__root, index, run.$id)
│  └─ routeTree.gen.ts · router.tsx · styles.css
│
├─ scripts/ (45) ............. CLI + build tooling + tests
│  ├─ rapidtool-cli.mjs ...... THE headless CLI (39 verbs; contract: README-cli.md)
│  ├─ gate.sh ................ the stability gate (typecheck→lint→scripts→src→build, JSON verdict)
│  ├─ run-eval.mjs ........... the eval harness (keyless floor / --keyed live)
│  ├─ with-app-env.mjs ....... npm-script env loader (all npm scripts route through it)
│  ├─ migrate.mjs · migration-plan.mjs ...... deploy-time DB migrations (PGLite fallback)
│  ├─ browser-guard / browser-smoke / check-assertion-gaps / check-auth-invariant / brand-check / write-atomic / path-safety …
│  └─ *.test.mjs ............. the scripts test leg (npm test leg 1)
│
├─ migrations/ (2) ........... deploy SQL: auth/0001_auth.sql · auth/0002_account_unique.sql
│
├─ research/ (476) ........... the research + evidence layer
│  ├─ multiagent/ (103) ...... the analysis program: dossiers (01…112), plans (94/96/104), defect ledgers,
│  │                            and THE REGISTER thoroughanalysis.md (append-only; read its header first)
│  ├─ eval-corpus/ (23) ...... the acceptance corpus: 11 brief fixtures + graders/ + README
│  ├─ eval-out/ (345) ........ TRACKED trial outputs: results.json, history.json, per-slug emitted trees/trials
│  └─ 01…03_*research.md · deepseek-api.md · runtime-integration.md .... early deep-dive dossiers
│
├─ fixes/ (460) ............. append-only landing logs, one per lane per wave (NN_ = wave number);
│                             263_index.md = the generated link index of fixes/ + wave_plans/
├─ wave_plans/ (106) ......... per-lane dispatch plans W4→W42 (36 dirs; no W25) + README.md (convention)
│
├─ public/ (10) .............. static assets (favicon.svg, og.jpg) + legacy public/__grok/ install assets
├─ .github/ (1) .............. CI: workflows/gate.yml
├─ server/ (2) ............... LEGACY middleware (grok-pwa) — do not build on it (AGENTS.md)
├─ .grok/ (89) ............... LEGACY scaffolding: skills/ (81), references/ (6) — do not build on it
│
├─ builds/ (50) .............. historical e2e output: recipe-box.json/svg + vault.md/ (48 vault notes)
├─ vault-e2e/ (47) ........... historical vault-dump e2e output (markdown notes)
├─ screenshots/ (16) ......... historical UI screenshots
├─ audit-bugs/ (5) · audit/ (3) · review/ (3) · proposals/ (3) · artifacts/ (1) · attachments/ (1) · .audit-g2/ (1)
│                              historical wave outputs / audit evidence — tracked, not stray
│
├─ node_modules/ · .vercel/ · .tanstack/ · dist (n/a) .... deps + build output (gitignored)
│
└─ root files
   ├─ START-HERE.md .......... this wayfinding entry point
   ├─ docs-FOLDER-MAP.md ..... this file
   ├─ README.md .............. quickstart + capabilities matrix + honest limits (human entry)
   ├─ AGENTS.md .............. the repo working contract for agents (read first)
   ├─ AGENT_GUIDE.md ......... product-level guide: how an agent consumes a RapidTool project
   ├─ RESUME.md .............. session handoff: gate contract, hard rules, decision log
   ├─ taskuniverselog.md ..... live task-status board (snapshot; disk is truth)
   ├─ remainingwaves.md ...... per-wave execution catalogue (W5→W12 lanes/tasks/files)
   ├─ finalsprint.md ......... W30 shell-sprint master table: every remaining capability + shell status
   ├─ agentnotes.md (600K) ... long-running working notes (evidence, referenced)
   ├─ packet-e2e.md · design-e2e.html · arch-e2e.svg · flow-e2e.svg · phases-e2e.svg ... committed e2e artifacts
   ├─ build.json (56K) · w1-source-project.json (68K) ... committed e2e artifact / cited CLI input
   ├─ probe*.ts (9) .......... tracked investigation probes (re-runnable evidence; see fixes/275)
   ├─ package.json · package-lock.json · tsconfig.json · vite.config.ts · eslint.config.mjs · .prettierrc
   ├─ .gitignore · .env.example · LICENSE · .node_modules.lock
   ├─ AGENTS.project.md · startup.sh ... LEGACY scaffolding (protected; do not delete/extend)
   └─ _el217g.log · _tc217g*.log (5) ... run-evidence logs cited by fixes/217g (gitignored, kept on purpose)
```

## Navigation quick answers

| Question | Go to |
|---|---|
| "What is the state of the world / what just changed?" | `git status --short` · newest files in `fixes/` · `fixes/263_index.md` |
| "What's left to build / what's shelled?" | `finalsprint.md` (shell status) → `remainingwaves.md` → the register's IDs |
| "Why is X like this / known defects?" | `research/multiagent/thoroughanalysis.md` (register) · `93_design_flaws.md` |
| "How do I run / drive it?" | `START-HERE.md` §Run commands · `scripts/README-cli.md` (CLI contract) · `README.md` (quickstart) |
| "What did lane N of wave W do?" | `fixes/<W+269-ish number>_lane*.md` · `wave_plans/W<N>/*.md` |
| "What does the acceptance corpus look like?" | `research/eval-corpus/` (briefs + graders) · `research/eval-out/` (results.json / history.json) |
| "Legacy/dead scaffolding to avoid" | `.grok/`, `server/`, `scripts/grok-pwa-*`, `AGENTS.project.md`, `startup.sh`, `public/__grok/` |

## Conventions (so file names make sense)

- `fixes/NN_*.md` — landing logs. `NN` ≈ the wave's tracking number (chronological); **append-only**;
  the file's own header says what was verified and to what evidence bar.
- `wave_plans/W<N>/lane-*.md` (older) / `wave_plans/W<N>/<codename>.md` (newer) — one dispatch note per
  lane, authored by the wave's parent; lanes never edit them.
- `research/multiagent/NN_*.md` — dossiers (01…112 + named plan/ledger files). The live register is
  `thoroughanalysis.md`; its header carries the append protocol.
- Root-level `_*.log`, `probe*.ts`, `*-e2e.*` — deliberately kept evidence artifacts, not junk
  (reasons per item in `fixes/275_organizer.md` §audit). Don't "clean" them without re-checking refs.
