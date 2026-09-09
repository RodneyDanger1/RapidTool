# 10 — Production Readiness: End-State Gap Map, Production Pipeline + Game Variant, File-Mapped Enhancements

- **File:** `research/multiagent/10_production_readiness.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main` — NOT a git repo)
- **Date / agent:** 2026-09-05 · **Flash research agent #5 (PRODUCTION-READINESS — software / tools / code / GAMES)** · strictly **read-only** on source; the only file written this pass is this one
- **Audience:** orchestrator + Pro build agents. This is a **build-ready design + gap analysis**: no fabricated code — only type-level proposals (signatures/schemas, matching the convention of `04_verification_design.md`) and deterministic content sketches. Every external claim is cited in §5.
- **Sibling contract:** Flash docs 05–09 are authored in parallel (07 landed; 06/08/09 in flight). §4 *extends* the enhancement set of the sibling docs — above all whatever `research/multiagent/08` covers — and does **not** duplicate their items. Where an E-item below shares a surface with a sibling doc, ownership is flagged inline so builders can reconcile. If a sibling doc already lists an equivalent item, keep the sibling's and drop this one.
- **Honest local reality (read first):** RapidTool has **no cloud deploy, no billing, no hosted runner**. Its only executors are (a) the synchronous engine-template self-test (`runGenerated`), (b) the **bounded** local Node runner (`node-runner.server.ts` — explicitly *not* a security sandbox), (c) a browser Worker isolate (`runSandboxed`, blob-URL, network stubbed), and (d) config-gated DeepSeek/Tavily backends. Everything below therefore treats **"production" as: pack a verified, governed artifact bundle locally that a human or an external coding agent can take to a real host** — never an auto-deploy claim. That mirrors what Bolt/Lovable/Replit actually do at the boundary (export → host), minus their hosted infra, which RapidTool must never fake (B-18/B-23 honesty contract).

---

## 0. TL;DR (read this first)

1. **RapidTool today ends at "governed handoff material", not "shippable thing".** A completed P0→P12 run yields: 13 phases of spec artifacts, a compiled Agent Packet (paste-ready agent prompt + machine-readable System JSON), the full project JSON, a vault of markdown notes, agent reports (two-way packet loop), and — on the only real code path — a **deterministic engine-template module** (not application code). Competitor platforms (Lovable, Bolt, v0, Replit) all terminate in a **URL or a repo the user owns** (L1–L3, L5). RapidTool terminates in a packet + JSON + notes. That gap is a *packaging and convergence* gap, not an engine gap.
2. **The pieces for a production pipeline already exist but never connect:** `runP6Real` (engine.ts:1416) already re-stamps `lastTest` from the real bounded runner, yet `store.runModuleReal` (store.ts:454) **throws that verdict away** (`out.project` is ignored) — a real failing run never flips the DoD `p6-test` gate (dod.ts:118). Agent reports already carry `files: string[]` (report-intake.ts:36) but `applyReport` **only logs the names** (report-intake.ts:141–142) — no file content, no tree, nothing materialized. P9 emits CI/IaC *text sketches* (engine.ts:579–623) with no runbook artifact, no env manifest, no host-routing decision. Closing these three seams is §2 and §4.
3. **Game production needs almost no graph surgery.** Phases 0–12 are structurally fixed (`PHASES`, `PHASE_IDS`, `canEnter`, `priorsSealed`, `repairPhases`, `DOD`, packet, store and the UI all hard-code 13). The minimal honest change is **not** a new phase set — it is a `variant: "app" | "game"` key on `Project` + one pure `variants.ts` module that deterministically re-targets *content* (vocabulary, brief seeds, P6 module, P8 UI/asset spec, P9 deploy runbook for static/itch.io/Expo-EAS hosting) and a couple of DoD probes. Phases stay 0–12.
4. **Enhancement payload (11 items, §4):** E1 `Project.build` + `deploy` artifact kind + variant key (types.ts/dod.ts/engine.ts) · E2 report file-content materialization (report-intake.ts) · E3 release-bundle materializer (headless.ts/io.ts + CLI) · E4 real-run → DoD convergence (store.ts, engine.ts) · E5 P9 honest deploy runbook + `.env.example` manifest (engine.ts) · E6 P12 production handoff memo (engine.ts/dod.ts) · E7 game variant module + templates (variants.ts, engine.ts, templates.ts) · E8 Release surface in console UI (console.tsx) · E9 packet/System-JSON production fields (packet.ts) · E10 game asset/scene spec contract (types.ts/engine.ts) · E11 headless end-to-end "produce" command + README-cli.md. All are S–M effort, additive, and hydration-safe (`_v: 3`).
5. **Citation core (§5):** Lovable ownership/hosting docs, Replit Publish docs, Bolt→Vercel Drop KB, v0 docs, GitHub Copilot coding-agent PR flow, Supabase production checklist, Expo EAS Build/Submit, Cursor reviewing/testing, itch.io HTML5 + butler (game path).

---

## 1. Current end-state map — what RapidTool produces today, and the gap to "shippable"

### 1.1 The production loop as built today (verified read of the tree)

```
brief ─► P0..P12 deterministic/LLM-layered synthesis (engine.synthesizePhase)
           │  per phase: Artifact[] (markdown/JSON/YAML bodies) + MemoryEntry[] + logs
           │  P6: generatedSource (engine-template module) ─► runGenerated self-test
           │      ─► optional real bounded run: exec.runCode → node-runner.server.ts
           │      ─► optional config-gated DeepSeek verify-fix loop (verify.server.ts)
           ▼
     compileAgentPacket (packet.ts)  ──►  packet string + "packet" artifact (sealed, B-19)
           │
           ▼
     Surfaces:
      • UI console.tsx tabs: artifacts | packet | spec | crew | oracle | vault
        (RunTab at console.tsx:81; vault tab added this wave) + copy/download
      • io.ts: exportProjectJson / exportPacketText / importProject (13-phase strict, io.ts:67)
      • headless.ts + scripts/rapidtool-cli.mjs: create/run/gate/approve/reject/retry/ingest/
        packet/export/summary (+ vault/search/crew/verify landing this wave)
      • report-intake.ts: external coding agent returns AgentReport → [agent report]
        artifacts + memory rows (two-way packet loop, R-4/M-05/M-08)
      • vault (src/lib/vault.ts, this wave): atomic markdown notes + _index.md on disk
```

### 1.2 What a completed project actually contains (the end-state inventory)

| Output | Where | Form | Shippable? |
|---|---|---|---|
| 13 × spec/validation artifacts (scorecard, graph, memory, MCP, security, validation, code×2, research, ui, cicd×2, edge, tools, docs…) | `Project.artifacts` (types.ts:233) | markdown/JSON/YAML bodies, capped 900-char trim inside packet | Docs-grade only |
| `generatedSource` | types.ts:257, engine.ts case 6 | **engine-authored template module** (`const JOBS=[…]`, test_happy/test_no_skip) | Not application code — by design (B-01); sandbox claim is honest about it |
| `lastTest` | types.ts:258, dod.ts:118 `p6-test` | `{ok, detail}` from the **template self-test** — the real-run verdict is only merged when callers use `runP6Real`'s returned project (engine.ts:1434) | Evidence-grade only |
| Agent Packet | `project.packet` (sealed artifact) | prompt + `## System JSON` (packet_version, phases, gate_passed, decision ledger, sandbox claim) | **The real production artifact** — a governed agent work order + audit trail |
| Full project JSON | io.ts:25 | importable/exportable, hydration-repaired | Archive/portability |
| Agent reports | report-intake.ts | `[agent report]` artifacts; `files: string[]` names only | Metadata; contents lost |
| Vault notes | headless.ts:658 / vault.ts | `.md` files + `_index.md` | Knowledge base |
| OpenAPI 3.1 / ADRs | types.ts:246–247, engine.ts case 12 | text (P12) | Spec-grade |
| P9 CI/IaC | engine.ts:579–623 | static YAML/IaC *sketches* | Not wired to any repo; illustrative |
| Bounded real-run artifact | store.ts:479 `"Real module run (bounded)"` | docs artifact from runModuleReal | Log-grade |

### 1.3 The end-state gap — five concrete deltas between "run complete" and "shippable"

Compare with what the cited platforms guarantee at their exit boundary (§5):

- **G1 — No file tree.** Bolt exports a `.zip` you can drop on Vercel (L3); Lovable exports a standard Vite project you own (L1); RapidTool never materializes a single file of the target product — `generatedSource` is one module string, agent-report `files` are names without bodies. There is no `dist/`, no `package.json`, no `README` standing next to the project.
- **G2 — Real tests don't converge into the gate.** The DoD `p6-test` probe reads `lastTest`, which the *template* path writes; the real bounded run's verdict is discarded by the store (store.ts:454–489 ignores `runP6Real`'s returned `project`, which already carries the stamped `lastTest` at engine.ts:1434). Result: P6 can be gate-green while the real run fails — the opposite of Replit's "release check before promote" (L2) and Cursor's "run it, screenshot it, attach evidence" (L7).
- **G3 — No deploy decision artifact.** P9 writes GitHub Actions + IaC *sketches* (engine.ts:579–623) but nothing an operator can execute or adapt: no build command, no host-routing choice (static vs full-stack vs app-store — the bolt.deployhq decision table, L9), no env manifest, no smoke-test step, no "who does this" note. The packet even says "Do not deploy without HITL on P9" but P9 itself never says *how*.
- **G4 — P12 hands off paperwork, not a product.** The final edge emits ADRs + OpenAPI and seals. The natural production handoff — a "here is what is shippable now, here is what a human/agent must do next (repo init, secrets, hosting account)" memo — does not exist. GitHub's coding agent ends in a draft PR with CI gating (L5); RapidTool ends in a JSON file.
- **G5 — Games are unaddressable.** No `game` vocabulary in `inferDomain` (engine.ts:80–113 — a "build a game" brief lands in `custom-software`), no game brief seeds in `templates.ts`, no asset/scene spec anywhere, and the P9 runbook has no static/itch.io/Expo path. Yet the *graph* needs no change (§3).

### 1.4 What is *already* honest and must not regress

- `sandboxClaim()` (sandbox.ts:158) truthfully labels the runtime; P4 artifact quotes it (engine.ts:421) and the packet carries it (packet.ts:37).
- `runGenerated` refuses non-template source (sandbox.ts:81); `runSandboxed` is documented as the only legal executor for non-template code; `node-runner.server.ts` header is an explicit "NOT a security sandbox".
- Report intake footers (`> external report — unverified by engine`, report-intake.ts:50), packet "no secrets / no scope widening" tail (packet.ts:243), M-01 illustrative-vs-cited discipline. **Any production feature proposed below must preserve all four.**

---

## 2. Production pipeline design — P6 (code) → real test run → package/deploy → P12 handoff

### 2.1 The pipeline shape (one diagram)

```
P6 synthesize ──► generatedSource (today: engine template; tomorrow: verified LLM module per 04)
   │
   ├─(a) sync self-test    runGenerated()                      → lastTest (template floor)
   ├─(b) REAL bounded run  runP6Real() → exec.runCode → node   → REAL lastTest + stdout/exit
   │        └─ converge into DoD: recordGate re-runs p6-test against the REAL verdict (E4)
   ├─(c) verify-fix loop   verify.server.ts (config-gated)     → finalSource + cases
   ▼
P7–P8 research/UI  (unchanged; game variant re-targets content, §3)
   ▼
P9 PACKAGE + DEPLOY-PLAN (rewritten case 9, E1/E5):
   • artifacts stay: cicd (GH Actions YAML) + NEW deploy artifact kind
   • deploy artifact = deterministic runbook: framework-class decision →
       static/SPA : build cmd + Netlify/Vercel/Cloudflare drop or GitHub-connect
       full-stack : build cmd + Dockerfile-or-managed-host + DB notes
       game/web   : single-file or static export → itch.io zip (butler) / static host (E7/E10)
       game/mobile: Expo EAS profiles preview|production (runbook only — no EAS call from RapidTool)
   • .env.example derived from contracts/apiDelta — placeholder names only, never secrets
   • "executed by operator, not by RapidTool" footer — P9 stays stock-HITL (phases.ts:133)
   ▼
P10–P11 (unchanged)
   ▼
P12 HANDS OFF: docs artifacts + NEW "production handoff memo" (E6) —
   shippable-now list · owner actions (repo init, secrets, hosting account, custom domain)
   · verification URL checklist · pointer to deploy artifact · project JSON + bundle export
```

### 2.2 Concrete type proposals (proposals only — signatures for the builder)

```ts
// types.ts (additive; all optional so hydration of existing payloads is a no-op; _v → 3)
export type ProjectVariant = "app" | "game";                 // E1/E7  (default "app")
export type DeployTarget = "static" | "fullstack" | "game-html5" | "game-expo";

export type DeployPlan = {                                   // E1/E5  — content of the deploy artifact
  target: DeployTarget;                 // deterministic from variant + contracts/apiDelta
  buildCmd: string;                     // e.g. "npm run build" (target product, not RapidTool)
  outputDir?: string;                   // "dist/" | "out/" | "build/" — static family
  hostOptions: string[];                // human choices, e.g. ["netlify drop", "vercel drop", "gh-pages"]
  envVars: string[];                    // NAMES ONLY (VITE_/PUBLIC_ prefix note) — zero values
  runbook: string[];                    // operator steps, incl. smoke-test URL + rollback note
  executedBy: "operator";               // honesty: RapidTool never deploys (B-18)
};

// Project gains (all optional):
//   variant?: ProjectVariant            // E7
//   build?: { deploy?: DeployPlan; bundle?: { dir: string; files: string[]; exportedAt: number } } // E1/E3
//   files?: { path: string; body: string; phase: PhaseId; source: "agent" | "engine" }[]  // E2 — the real tree

// ArtifactKind adds: "deploy" | "assets" | "scene"      // E1/E10 — additive union members
//   (safe: artifact kinds are NOT validated on import/hydration — only memory kinds are,
//    engine.ts:1183; packet compile filters only "packet" by equality, packet.ts:81)

// report-intake.ts AgentReport.files becomes content-carrying (E2):
//   files?: { path: string; body: string }[]   // old string[] shape still accepted (legacy)
```

`Project.files` is the single most important addition: it is the **materialized target-product tree** (agent patches in, engine docs out), and it is what E3's bundle writer turns into an on-disk folder.

### 2.3 Why this mirrors the cited platforms without overclaiming

| Platform move (cited) | RapidTool analog |
|---|---|
| Lovable: you own the code; standard Vite project; git-sync anytime (L1) | E2/E3: agent report file bodies → `Project.files` → real folder, importable into any git repo the *operator* owns |
| Replit: Preview ≠ Production; publish = package + checks + promote at a stable URL (L2) | E4: template self-test (preview-grade) vs real bounded run (release-grade) are *labeled* differently in `lastTest` and the DoD evidence; P9 runbook is the promote step |
| Bolt→Vercel Drop: export `.zip`, host detects framework, env vars must be re-added after export (L3) | E3 bundle + E5 `.env.example` + explicit "env vars do not survive export" warning in the runbook |
| GitHub coding agent: work streams to a draft PR; human approval gates CI/CD; reviewer ≠ author (L5) | Packet "required output schema" (packet.ts:232) already demands Files/Patch/Tests; E2 makes those patches real content; HITL ledger already records who approved |
| Supabase prod checklist: RLS, env, rate limits as *pre-launch gates* (L6) | P4 security artifact + E5 env manifest + P9 stock HITL stay as the "go-live checklist" layer |
| Expo EAS: preview vs production build profiles; submit to stores (L8) | Game/mobile variant runbook references EAS *profiles*; RapidTool only writes the plan |
| itch.io: HTML5 game = zip upload, butler for updates (L10) | Game variant runbook: `npm run build` → zip `dist/` → upload; butler push snippet in the runbook text |

**Pipeline contract (non-negotiable):** RapidTool produces the *bundle and the plan*; an operator or external agent performs the deploy. No cloud credentials, no deploy API calls, no billing — and the packet/deploy artifact says so out loud.

---

## 3. GAME production path — adapting the 13-phase graph with the minimal honest change

### 3.1 Honest constraint: phases are fixed 0–12

`PHASE_IDS` is a closed literal union (types.ts:1), `PHASES` is a fixed 13-row registry (phases.ts:3), and **13 is load-bearing everywhere**: `importProject` rejects any payload without exactly 13 records (io.ts:67), `repairPhases` re-inserts missing ids up to 12 (engine.ts:1125), `canEnter`/`priorsSealed` walk 0→12 (phases.ts:118–131), `DOD` is a `Record<PhaseId, GateItem[]>` (dod.ts:40), `STOCK_HITL` pins 4/5/8/9, and the packet/CLI/store/UI all index by `PhaseId`. **Widening or re-templating the graph for games is a high-touch rewrite (dozens of files + every persisted payload) and is not proposed.** The minimal change is a *variant switch that re-targets content inside the existing 13 edges*.

### 3.2 Proposed minimal change (E7, E10)

1. `types.ts`: `variant?: "app" | "game"` on `Project` (absent ⇒ "app"; hydration default in `hydrateProject`, `_v: 3`). `emptyProject` may take it from the brief via a vocabulary sniff.
2. **New pure module `src/lib/variants.ts`** (mirrors dod.ts style — deterministic, unit-testable, no deps):
   - `variantForBrief(brief): ProjectVariant` — game vocabulary (`play, level, arcade, score, canvas, pixel, rpg, platformer, endless, match-3…`); reuses `tokenizeWords`/`stemToken` (algorithms.ts) exactly like `inferDomain`.
   - `phaseVariantLines(project, phase): string[]` — deterministic per-phase content deltas for the game variant (table below). Engine synthesis appends/replaces those lines in the phase's primary artifact (same mechanism as `rejectionResponseBlock`, engine.ts:168 — no new synthesis machinery).
   - `variantDoD(project): Partial<Record<PhaseId, GateItem[]>>` — a few probe *overrides/extensions* consulted by `runGate` (dod.ts) so game runs gate on game-shaped evidence.
   - `deployTargetFor(project): DeployTarget` — feeds the P9 deploy artifact (E5).
3. `engine.ts`: `inferDomain` adds a `game` vocabulary entry (engine.ts:80); case 6 consults variants for a **game module variant** (`buildPhase6Module` already takes a `variant: number`, sandbox.ts:110–155 — a variant-2 "game loop" template stays engine-authored and bounded); case 8 UI artifact gains asset/scene lines for games; case 9 (E5) picks the runbook from `deployTargetFor`.
4. `templates.ts`: add 2 game brief seeds (`arcade` one-screen canvas game; `endless-runner`/`match-3` with localStorage high score — note AGENTS.md §0.5: **auth stays OFF** for a localStorage score; database OFF unless leaderboards are demanded).

### 3.3 Game-variant phase map (what each fixed phase means for a game)

| Phase | App meaning (today) | Game-variant content delta (deterministic, variants.ts) |
|---|---|---|
| P0 scorecard | feasibility axes | axes notes re-targeted: scope = one playable loop; bottlenecks list asset/audio risk; libraries table → `phaser`/`pixi`/`three` or **zero-dep canvas** (abstract/geometric games stay procedural — AGENTS.md art doctrine) |
| P1 graph | dispatcher topology | unchanged (engine of record) — game is the payload, not the topology |
| P2 memory | checkpoint plan | unchanged |
| P3 MCP/tools | MCP contracts | tools artifact lists asset/SFX/font loading strategy instead of API servers |
| P4 security | isolation policy | unchanged — **generated game code still executes air-gapped** (deny-network in isolate) |
| P5 validation | adversarial suite | oracle examples become gameplay oracles: spawn/score/input edge cases (A7 oracle rows, packet.ts:185) |
| P6 code | template module | variant-2 module: bounded game-loop functions (update/render tick, score clamp, input guard) — engine-authored, self-tested, real-run through the same bounded runner |
| P7 research | market matrix | competitor rows become game-genre rows (illustrative-only, same M-01 rule); live queries re-targeted |
| P8 UI/UX | React+Tailwind contract | **scene/asset spec** (E10): canvas/WebGL vs DOM chrome decision, screen list, input map (WASD/arrows/tap), HUD binding to store fields — same "every control binds a named store field" rule |
| P9 CI/deploy | GH Actions + IaC sketches | deploy runbook = **game-html5** (static export → zip → itch.io, butler push snippet; or static host) or **game-expo** (EAS `preview`/`production` profile names only) |
| P10/P11 | edge/tools | unchanged |
| P12 docs | ADRs + OpenAPI | ADRs gain a "game payload" ADR line; OpenAPI stays (score API future); + production handoff memo (E6) |

**Honest note for the orchestrator:** this gives RapidTool *playable-game *specifications* and *governed handoff bundles* — the actual canvas/pixel game code is produced by the external coding agent through the packet loop (or a future real LLM codegen behind the 04 verify-fix design). RapidTool never claims to render the game itself; `preview-host-bridge` (src/lib/preview-host-bridge.ts) only activates when framed by the Grok embedder and noops for top-level runs — the repo's own preview infra is platform chrome, not a game runtime.

---

## 4. Enhancements E1–E11 (file-mapped; extends `research/multiagent/08` — reconcile, don't duplicate)

Effort: S = < half-day, M = 1–2 days. All additive/optional-field changes with hydration defaults; `_v: 3` bump in `emptyProject` (engine.ts:1081) + `hydrateProject` (engine.ts:1162). Every item preserves the honesty markers of §1.4.

| # | Enhancement | Files (anchors) | Effort | Ownership note |
|---|---|---|---|---|
| E1 | `Project.build`/`DeployPlan` + `variant` + `ArtifactKind "deploy"` (types §2.2) | `src/lib/types.ts` (15–31, 215–261), `engine.ts` hydrate/empty (1081, 1162) | S | Foundation for E5/E7 — land first |
| E2 | Agent-report **file bodies** → `Project.files` + pure `materializeFiles(project, dir)` | `src/lib/report-intake.ts` (31–39, 56–124, 126–201), new `src/lib/materialize.ts` (pure, file:line conventions of vault.ts) | M | Extends R-4 two-way loop; distinct from 04 verify loop and 08 report schemas — check 08 before building |
| E3 | Release-bundle writer: `<slug>/` folder = README(packet) + openapi.yaml + adr.md + generatedSource file + `Project.files` tree + `vault/` (reuse `writeVault`, headless.ts:658) + `manifest.json`; wired to `io.ts` `slugName` | `headless.ts` (new `bundle()` near exportJson:371), `io.ts`, CLI `bundle` subcommand in `scripts/rapidtool-cli.mjs` + `scripts/README-cli.md` | M | CLI surface owned by build agent C this wave — coordinate; sibling doc 08 may carry the CLI contract |
| E4 | **Real-run → DoD convergence**: `runModuleReal` must adopt `runP6Real`'s returned project (`out.project`, engine.ts:1434) so `lastTest` reflects the real exit code, then `recordGate` re-runs `p6-test` (dod.ts:118) and a "Real module run (bounded)" artifact keeps honest detail; `lastTest` gains a `via: "template" \| "real"` discriminator | `src/lib/store.ts` (454–490), `engine.ts` (1416–1442), `dod.ts` (109–136) | S | Single highest-leverage fix in this doc — today's gate can be green while the real run fails (G2) |
| E5 | P9 rewrite: keep `cicd` artifact, add **`deploy` artifact** (DeployPlan runbook + `.env.example` names + "executed by operator" footer); stock HITL unchanged; DoD `p9-cicd` probe extended (deploy artifact present) | `src/lib/engine.ts` case 9 (579–623), `src/lib/dod.ts` (161–172), types E1 | M | Builds on 02_capability_audit/04 DoD conventions; do not touch 06–08 CI items if they cover workflows |
| E6 | P12 "production handoff memo" docs artifact: shippable-now list, owner next-actions (repo init, secrets, hosting account, domain), verification checklist, bundle pointer; optional new DoD criterion `p12-handoff` (memo artifact exists) — **advisory, gates never block** (dod.ts header) | `src/lib/engine.ts` case 12 (676–726), `src/lib/dod.ts` (187–204) | S | |
| E7 | Game variant: vocabulary + `variantForBrief`, `phaseVariantLines`, `deployTargetFor`; `inferDomain` game terms; P6 variant-2 game module (bounded); `templates.ts` game briefs | new `src/lib/variants.ts`; `src/lib/engine.ts` (80–113, 464–527); `src/lib/sandbox.ts` (110–155); `src/lib/templates.ts` | M | §3 spec; pure module → bare-Node testable like dod.ts |
| E8 | UI Release surface: new tab in `RunTab` union (console.tsx:81) rendering deploy runbook + env manifest + bundle manifest + "real run verdict" badge (E4) + download-bundle button | `src/components/console.tsx` (81, 1384–1536 tab rails), store selectors | M | UI owner = build agent D this wave; coordinate — sibling 05_live_guidance carries console anchors |
| E9 | Packet production block: System JSON (packet.ts:21) + prose add `variant`, deploy status (`deploy: { planned: true, target, executed_by: "operator" }`), real-run verdict line replacing the current template-only self-test line (packet.ts:195) | `src/lib/packet.ts` (21–65, 188–231) | S | Keeps the packet the single paste-ready source of production truth |
| E10 | Game asset/scene contract (types §2.2): `assets`/`scene` artifact kinds + deterministic spec (screen list, input map, HUD bindings, asset inventory w/ procedural-art fallback rule); feeds P8/P9 game variants | `src/lib/types.ts` (15–31), `src/lib/variants.ts`, `src/lib/engine.ts` case 8 (554–578) | M | Pure content/spec — no runtime asset pipeline; honest "no gen-art in RapidTool" note |
| E11 | Headless produce-loop: CLI `produce` = run-until-complete + verify-fix + real-run convergence + bundle (E3) in one file-backed pass, printing the handoff memo path; extend `scripts/README-cli.md` §"Driving to completion" | `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md`, `src/lib/headless.ts` (runUntilGate:316, verifyGeneratedSource:774) | M | CLI owned by agent C — verify against their in-flight vault/search/crew/verify sections before adding |

**Suggested sequencing:** E1 → E4 → E5/E6 → E2/E3 → E7/E10 → E9 → E8/E11. E1+E4 are the two fixes that move the DoD from "template self-test" to "real run verdict" — everything else layers on top.

---

## 5. Sources — how real AI builders ship production artifacts (cited 2026-09-05)

| # | Platform / source | URL | What RapidTool steals (production lesson) |
|---|---|---|---|
| L1 | Lovable — Deployment, hosting & ownership | https://docs.lovable.dev/tips-tricks/deployment-hosting-ownership | **You own code + data; apps are standard Vite+React projects; git-sync anytime; hosted ≠ locked-in.** Export must be lossless → E2/E3. Companion: https://docs.lovable.dev/tips-tricks/external-deployment-hosting (Supabase migration, Docker path) |
| L2 | Replit — Publish your app | https://docs.replit.com/build/publish-your-app | **Preview ≠ Production.** Publish = package + resource provision + release check + promote to stable URL; you can keep iterating without touching the live release → E4 separation of template vs real verdicts, E5 runbook promote step |
| L3 | Vercel KB — Deploy a Bolt.new app (Vercel Drop) | https://vercel.com/kb/guide/bolt-vercel-drop | **Zip export → framework-detected build → live URL; env vars do NOT survive export** (must be re-added); GitHub connect for auto-deploys → E3 bundle + E5 `.env.example` + explicit env warning |
| L4 | v0 (Vercel) — Docs/FAQs + blog | https://v0.app/docs/faqs · https://vercel.com/blog/introducing-the-new-v0 | "Deploy with one click to Vercel **or export code and deploy elsewhere**" — deployment must never be a lock-in; RapidTool's runbook lists host options, not one vendor |
| L5 | GitHub — Copilot coding agent / cloud agent | https://github.blog/news-insights/product-news/github-copilot-meet-the-new-coding-agent/ · https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent | Agent streams work into a **draft PR with commit trail + PR description; human approval before CI/CD; author ≠ approver** → packet Files/Patch/Tests schema (packet.ts:232) + HITL ledger are the right shape; E2 makes report patches real |
| L6 | Supabase — Production checklist | https://supabase.com/docs/guides/deployment/going-into-prod | Go-live = explicit security/availability gates (RLS, env, rate limits) — RapidTool equivalent: P4 artifact + E5 env manifest + P9 stock HITL as the promotion gate |
| L7 | Cursor — Reviewing & testing code (Learn) | https://cursor.com/learn/reviewing-testing | Agents must **verify before claiming done**: dev server, browser clicks, screenshots attached as PR evidence → E4 (real run verdict in DoD) and E6 (verification checklist in handoff memo) |
| L8 | Expo — EAS Build / Submit (app & game production) | https://docs.expo.dev/build/introduction/ · https://docs.expo.dev/deploy/submit-to-app-stores/ | **Production = build profiles (preview vs production) + store submission**; `eas.json` profiles are the artifact → game/mobile runbook (E5/E7) names EAS profile semantics without calling EAS |
| L9 | DeployHQ — Deploy Bolt.new apps | https://www.deployhq.com/guides/bolt | The **static-vs-full-stack decision drives the host** (framework → output dir `dist/`/`out/`/`build/`) → E5 `DeployTarget` routing in the runbook |
| L10 | itch.io — Uploading HTML5 games + butler | https://itch.io/docs/creators/html5 · https://itch.io/docs/butler/ | HTML5 game release = **zip the build, upload, butler for incremental pushes** → E10/E7 game-html5 runbook lines |

**Research method note:** URLs verified reachable and content-read on 2026-09-05 (full-text extraction for L1/L2; SERP summaries + targeted snippets for L3–L10). Claims in §2.3 are grounded in these pages; anything not in them is marked as RapidTool design rationale, not external fact.

---

## Appendix A — verification of key claims (file:line, read-only pass)

- `PHASE_IDS` closed union / `PhaseId` — types.ts:1–2; `Project` (generatedSource:257, lastTest:258, `_v`:260, sandbox:240–245, packet:251) — types.ts:215–261; `ArtifactKind` has no deploy/assets/scene — types.ts:15–31.
- `PHASES` 13 rows — phases.ts:3–108; `canEnter` phases.ts:118–120; `priorsSealed` phases.ts:122–131; `STOCK_HITL=[4,5,8,9]` phases.ts:134.
- Engine: case 6 module synthesis + self-test + heal — engine.ts:464–527; case 9 cicd/IaC sketches — engine.ts:579–623; case 12 ADR/OpenAPI — engine.ts:676–726; `runP6Real` returns re-stamped project — engine.ts:1416–1442 (1434); `applyPhaseResult` merge — engine.ts:761–840; `emptyProject` defaults (sync-template) — engine.ts:1060–1067, `_v:2` 1081; `hydrateProject` fills/gates `_v` — engine.ts:1158–1162.
- Sandbox: template-only gate — sandbox.ts:81–83; denylist 12–13; `buildPhase6Module` variant param — sandbox.ts:146–153; `sandboxClaim` honesty — sandbox.ts:158–167; Worker isolate — sandbox.ts:242–324.
- Bounded runner honest label — node-runner.server.ts:1–21; `runNodeBounded` 74–170. Client wrapper `exec.ts:39–65`.
- Packet: System JSON — packet.ts:21–65; artifact trim to 8 × 900 chars — packet.ts:80–87; "no secrets / P9 HITL" tail — packet.ts:243; required output schema — packet.ts:232–243.
- DoD: `p6-test` reads `lastTest` — dod.ts:118–125; `p9-cicd`/`p9-complete` — dod.ts:161–172; P12 probes — dod.ts:187–204; gates advisory — dod.ts header + store.ts:78–82.
- Store: `runModuleReal` builds `updated` from `project` (not `out.project`) — store.ts:454–489 (475–482); `recordGate` — store.ts:83–124; autopilot runs DoD before approving (M-09) — store.ts:132; persist name `rapidtool.v4` — store.ts:762.
- Report intake: `AgentReport.files?: string[]` (names only) — report-intake.ts:31–39; files logged but not stored — 139–146, 194–201; validation 56–124; report footer 50.
- io.ts: strict 13-phase import — io.ts:67–69; export helpers — io.ts:25–27, 93–97; slug — 106–115.
- headless.ts: runUntilGate — 316–336; ingest/exportJson — 359–373; vault write — 658–678; verify — 774–781; crew — 752–758.
- UI: RunTab union — console.tsx:81; tab rail — 1384–1536; packet copy/download/export — 505, 782–810. Preview bridge noops top-level — src/lib/preview-host-bridge.ts header.
- Domain vocabulary has no game terms — engine.ts:80–113; templates.ts has no game briefs — templates.ts:1–27.

## Appendix B — merge notes for the orchestrator

1. **`research/multiagent/08` (in flight):** if 08 already proposes report-file bodies, bundle export, or a deploy artifact, keep 08's wording and treat E2/E3/E5 here as the production-pipeline framing that references it — do not double-own the same builder ticket.
2. **Sibling surface owners this wave:** vault/headless-CLI (agent C) and console UI (agent D) — E3/E8/E11 must be scheduled after their files land (typecheck order matters; console.tsx anchors above are from 05_live_guidance 23:29 entries).
3. **Honesty invariants to re-verify after any of E1–E11 lands:** `sandboxClaim` text still matches the packet; the deploy artifact says `executedBy: "operator"`; `.env.example` carries names only; game variant never claims in-house rendering; report artifacts keep the unverified footer; P9 remains stock-HITL.
