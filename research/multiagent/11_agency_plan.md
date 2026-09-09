# 11 — Agency Plan: Top-10 Competitor Audit · 20 Things They Do That RapidTool Does Not · design.ts / diagram.ts Deep Specs

- **File:** `research/multiagent/11_agency_plan.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main` — NOT a git repo)
- **Date / agent:** 2026-09-06 · Flash research agent #1 (AUDIT LEAD + PLAN). **Strictly read-only on source** — the only files written this pass are this one and `11_live_fixes.md`.
- **Audience:** orchestrator + the 5 live sibling builders (wave `deleg_7439ec60`: task-1 `design.ts`, task-2 `diagram.ts`, task-3 CLI verbs, task-4 console tabs, task-5 core bug sweep). **Gaps 07/08 are the contracts tasks 1–4 are executing RIGHT NOW** — read §5/§6 before writing code.
- **Sibling map:** this file **extends, never repeats**: 01 harness digests · 02 capability audit (A/B/E) · 03 crew design · 04 verification design · 05 guide/live · 06 competitor survey (the field audit — this doc's §2 is the ranked **top-10 distillation** of it, with a fresh 2026-09-06 verification pass) · 07 open-source steal catalog (license-verified borrow list — gap specs below cite `[07 §x]` instead of re-verifying) · 08 enhancement register E-01…E-30 (internal gaps — the competitor-driven list below re-anchors the *same seams* to named competitors) · 09 agent-contract audit · 10 production readiness.
- **Honest limits box:** every RapidTool claim below carries a `file:line` anchor read **between 00:15–00:35 on 2026-09-06 while sibling builders were live-editing** (`src/lib/store.ts`, `packet.ts`, `report-intake.ts` all changed during this window — prior wave's bug-wave-27 fixes are visible). Re-verify anchors ±5 lines before patching; if a cited behavior is already fixed, mark the gap done and move on (the wave is moving fast: M-05 warn, M-08 memory, M-09 autopilot-DoD, packet blank-line bug were all closed **before** this pass). External URLs were fetched 2026-09-06 unless marked `[06]` (fetched 2026-09-05 by doc 06). License data via GitHub REST API 2026-09-06 (SPDX ids below); MIT/Apache-2.0/BSD-* only — anything else is flagged in place.

---

## 0. TL;DR (read this first)

1. **RapidTool's moat is process, not pixels** — sealed 13-phase graph, structured HITL, hash-verified DoD gates, machine-readable packet, deterministic replay ([06 §5]). No competitor in the audited ten has that. But the field beats it on **rendering, retrieval, verification breadth, and termination** (their runs end in a URL/repo/PR; RapidTool's ends in a JSON file). This plan's 20 gaps are exactly those four fronts, each tied to a named competitor capability and a license-verified repo to borrow from.
2. **The 20** (full specs §4): 6×P0 (rendering/search/gate-parity — half-day each), 8×P1 (incl. the two **new modules this wave**: `design.ts` §5 and `diagram.ts` §6, plus release-bundle materialization), 6×P2 (MCP client, diagram fences, graph viz, streaming, git, cross-project memory).
3. **This wave's sibling tasks already implement gaps 07/08** (modules), their CLI verbs (gap 07/08 headless wiring), and their console tabs (gap 07/08 UI wiring). §5/§6 are written as **build contracts**: exact export names, type shapes, determinism rules, XML/CSS-safety rules, and DoD test lists — aligned to the manifest goals each sibling already received (`fnv1a` reuse, zero deps, ≥12 tests for design.ts, ≥10 for diagram.ts, dynamic-import CLI pattern matching the vault layer).
4. **Live-corrective log:** `research/multiagent/11_live_fixes.md` (same pass) tails `deleg_7439ec60/task-1..5.log` and records dated, agent-addressed corrections. Siblings: check it when you park.
5. **Sequencing:** P0 items 01–06 are independent of the engine (pure UI/headless additive work, zero risk to the phase contract) — the one exception is 05 which touches `store.runModuleReal` but only to *converge* an existing verdict, never to re-route it. Gaps 07/08 must land **before** tasks 3–4 finish (they consume the exports). 09–14 build on 01/07/08 surfaces. 15–20 are follow-wave.

---

## 1. Method (what was read/verified this pass)

- **Source recon (read-only, file:line):** `src/lib/` types.ts, phases.ts, engine.ts (P6/P8/P9 regions), store.ts (autopilot/gates/runModuleReal), dod.ts (registry + probes), packet.ts (section map + tail), report-intake.ts (applyReport), io.ts (export/Ext), vault.ts (landed API), headless.ts (vault adapter + CLI seams), `src/components/console.tsx` (RunTab map + spec/packet panes), `scripts/rapidtool-cli.mjs` (verb dispatch), package.json (dep inventory).
- **Absence greps (2026-09-06, whole `src/`+`scripts/`+`server/`):** `marked`, `markdown-it`, `mermaid`, `minisearch`, `shiki`, `highlight`, `jsdiff`, `pdfmake`, `docx`, `xterm`, `design-token`, `EventSource|text/event-stream`, `isomorphic-git|simple-git|child_process` → **zero product-code hits** (the only hits are prose strings: MCP appears solely as *phase content* — tool-name strings `algorithms.ts:504,607`, artifact text, `dod.ts:80-86` probe `p3-mcp` reads artifact presence — and "diff/highlight" as UI words). `diff`/`mcp` hits are string literals, not modules.
- **Fresh web pass 2026-09-06** (4 pages extracted, claims quoted in §4): onlook.com/features/ai · replit.com/blog/introducing-agent-3-our-most-autonomous-agent-yet · vercel.com/blog/v0-app · docs.lovable.dev/introduction/welcome. Everything else inherits doc 06's 2026-09-05 fetches (`[06]`).
- **License pass 2026-09-06 (GitHub REST API unless noted):** see roll-up table §3.2 and per-gap entries. 25 repos checked; 23 clean MIT/Apache-2.0/BSD-3-Clause; `design-tokens/community-group` is NOASSERTION → cited as **spec reference only, never vendored**; `marked` repo file is a CLA but the npm package is MIT (same finding as [07 §2.1]); `modelcontextprotocol/typescript-sdk` is in a documented MIT→Apache-2.0 transition (dual, both allowed).
- **House rules honored:** type-level proposals only (signatures/shapes, no fabricated code); no claim without anchor or URL; honest constraints stated where a gap is structurally bigger than it looks.

---

## 2. Top-10 competitor audit (distilled from [06]; ranked by threat to RapidTool's wedge)

Selection: the ten with the closest capability overlap to RapidTool — six AI app builders (prompt→app) and four coding agents (prompt→repo change). **Excluded with reasons:** Devin, Goose, AutoGPT, Notion AI, Obsidian, Warp were fully audited in [06 §1–3] but are farther from the wedge (hosted black-box / general-purpose / non-build) — they resurface where one capability matters (Devin's fleet & visual QA [06 §6#10], Notion's org-wide Q&A → gap 20). Replit's *Agent 3* post (fetched fresh today) and the newer *Customize Replit Agent with Skills & Custom Instructions* post ([06] §2 sibling link on the same blog) anchor the Replit row.

### 2.1 The table

| # | Competitor | Core loop (one line) | Wins on | Loses on | Copy → gap |
|---|---|---|---|---|---|
| 1 | **Bolt.new** (StackBlitz) | prompt → full-stack app in browser WebContainers → deploy/export ([06 §1.1]; https://github.com/stackblitz/bolt.new) | instant live preview, speed-to-shiny | no spec, no gates, no audit | **12, 17, 19** |
| 2 | **Lovable** | NL → "production-grade" app w/ auth/db/integrations, **GitHub/GitLab sync**, publish (~10 min) (https://docs.lovable.dev/introduction/welcome, fetched 09-06) | breadth + real code ownership via git | chat-as-process | **12, 14, 19** |
| 3 | **v0.app** (Vercel) | one prompt → agent that "research[es], reason[s], debug[s], plan[s]"; plan/to-dos, web search with citations, checks work (https://vercel.com/blog/v0-app, fetched 09-06) | plan+to-do discipline, cited search | plan is LLM-internal, unreplayable | **04, 11, 13, 20** |
| 4 | **Replit Agent 3/4** | hosted agent that **periodically tests the app in a real browser** (buttons/forms/APIs), fixes what it finds; Max Autonomy 200 min; Skills/Custom Instructions (https://replit.com/blog/introducing-agent-3-our-most-autonomous-agent-yet, fetched 09-06) | real-browser verification energy | agent *decides when* to test — self-supervision | **05, 10** |
| 5 | **Tempo** | agents draft from issue+design on parallel worktrees; humans craft; ships as PR with CI ([06 §1.5]; https://www.tempo.new/) | design/code convergence; PR-native | any-model = no uniform process | **09, 19** |
| 6 | **Onlook** | visual editor whose AI "understands your React components, **your design tokens**, and your project architecture" (https://www.onlook.com/features/ai, fetched 09-06) | design-token-native editing | frontend-only, no process | **07** |
| 7 | **Claude Code** | terminal agent; CLAUDE.md/memory are context, but **PreToolUse hooks enforce policy at the tool boundary**; subagents/SDK ([06 §2.1]; https://code.claude.com/docs/en/memory) | harness ecosystem, enforcement seams | memory advisory, no deterministic gates | **06, 13** |
| 8 | **Cursor** | AI IDE + parallel **Cloud Agents** on env snapshots ([06 §2.2]; https://cursor.com/docs/cloud-agent) | parallelism, IDE recall | proprietary, IDE-centric | **03, 18, 20** |
| 9 | **GitHub Copilot cloud agent** | research repo → implementation plan → branch → **executes tests/linters in ephemeral CI env** → PR ([06 §2.3]; https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent) | plan→branch→PR with machine-run tests | GitHub-only, prose plan | **04, 05, 09, 19** |
| 10 | **Cline** | open-source agent runtime; explicit **Plan then Act** modes; CLI/SDK for "scripts, cron jobs, and CI pipelines"; MCP client ([06 §2.5]; https://cline.bot/, https://github.com/cline/cline) | plan/act separation, BYO-model, MCP | plan is conversation, gates are toggles | **11, 15** |

### 2.2 What the audit says, in one paragraph

The app builders win on **termination** (URL/repo/PR — gaps 12/14/19) and **live surfaces** (preview, browser testing, streaming — gaps 05/10/17/18); the coding agents win on **enforcement seams** (tool-boundary hooks, CI-executed tests — gaps 04/06/13), **retrieval** (semantic recall of your own corpus — gaps 03/20), and **plan visibility** (gaps 11). Nobody wins on governance — which is why RapidTool keeps its wedge while closing these four fronts. Full capability matrices and the honest loss register: [06 §4–§7].

## 3. The 20 — "20 things they do that RapidTool definitely does not"

### 3.1 Summary table (full specs §4, deep specs §5–§6)

| # | Competitor anchor (they do…) | Capability RapidTool lacks | RapidTool evidence (this pass) | Borrow from (license 09-06) | P | Effort |
|---|---|---|---|---|---|---|
| 01 | all builders/agents | render markdown (packets/artifacts are raw `<pre>` text) | `console.tsx` packet pane `<pre>` (doc [07 §2.1] `:1470-1474`); no md lib in deps | marked (npm MIT) + DOMPurify (Apache-2.0) | P0 | S |
| 02 | Cursor/Devin/Copilot | syntax-highlighted code anywhere | no highlighter in src (grep 0); plain `<pre>` | shiki (MIT) | P0 | S–M |
| 03 | Cursor/Obsidian | fuzzy FTS over own corpus (vault + artifacts) | `searchVault` substring scorer `vault.ts:376-388` | minisearch (MIT) | P0 | S |
| 04 | Copilot cloud agent | recorded gate verdicts on the headless path + CI-recheckable (`check`) | headless `finishPhase` records no gate (`headless.ts:257-275` per [08 E-02]); `recordGate` store-only `store.ts:135,249` | in-house (dod.ts exports) + patterns from Copilot docs | P0 | S |
| 05 | Replit Agent 3 / Copilot | real-run verdict converges into the DoD gate | `store.runModuleReal` drops `out.project` (`store.ts:518-557`; contract `engine.ts:1416-1438`) | in-house | P0 | S |
| 06 | Claude Code | memory + evidence from *every* agent report | `applyReport` memory rows only when `status:"complete"` (`report-intake.ts:163-181`); detail omits `tests_run` (`:138-148`) | in-house | P0 | S |
| 07 | Onlook / v0 | design tokens & a real design-system surface for the generated UI | P8 emits 6 prose lines (`engine.ts:570-594`); no token/theme code anywhere | open-props, radix colors/themes, shadcn (all MIT) | P1 | M |
| 08 | GitHub/Tempo/DeepWiki | deterministic architecture & pipeline diagrams of the project | no diagram code (grep 0); spec tab is a flat `<ol>` (`console.tsx:1476-1493`) | mermaid, kroki, excalidraw, dagre (MIT) | P1 | M |
| 09 | Tempo / Copilot PR | human gate reviews a *diff*, not prose | no diff lib (grep 0); HITL prompt is text (`types.ts:105-118`) | jsdiff (BSD-3-Clause) | P1 | S |
| 10 | Replit Agent 3 | browser smoke verification at the P8 gate | P8 DoD probes only check artifact presence (`dod.ts:151-161`); playwright is devDep + `scripts/browser-smoke.mjs` exists but no probe | in-house over installed playwright | P1 | M |
| 11 | Cline / v0 | plan-mode dry run before state advances | `runPhase` synthesizes then applies atomically; no preview flag (`headless.ts` run path) | in-house | P1 | S |
| 12 | Lovable / Bolt | a materialized file tree + runbook the user owns | project ends as JSON + prose artifacts ([10 §1.3 G1/G3/G4]); report `files` are names only (`report-intake.ts:141-142`) | in-house scaffold emitter | P1 | M–L |
| 13 | Copilot / Claude hooks | intake cross-checked against DoD + deny-list | `ingestReport` validates shape/phase only (`store.ts:566-570`); no `runGate` on ingest ([08 E-16]) | in-house | P1 | S |
| 14 | Lovable / Notion | shareable export formats (PDF/DOCX) of the governed trail | downloads are `.json`/`.md` blobs (`io.ts:25,93,118`) | pdfmake (npm MIT), docx (MIT) | P1 | S–M |
| 15 | Claude Code / Cline | real MCP client (not phase prose about MCP) | MCP = string literals + `p3-mcp` artifact probe (`algorithms.ts:504,607`, `dod.ts:80-86`) | modelcontextprotocol/typescript-sdk (MIT/Apache-2.0) | P2 | M |
| 16 | GitHub docs / Notion | render agent-authored mermaid code fences in artifacts | markdown absent (01) → fences can't render | mermaid (MIT), lazy | P2 | M |
| 17 | Cursor/Tempo graphs | interactive node-edge spec-graph view | flat `<ol>` (`console.tsx:1476-1493`) | xyflow (MIT), lazy | P2 | M |
| 18 | Replit live console | streaming run output / terminal surface | runner is request/response; no push channel ([07 §2.5]) | xterm.js (MIT) | P2 | L |
| 19 | Lovable / Copilot / Tempo | git sync & PR handoff of produced artifacts | no git anywhere (grep 0); no child_process exec | isomorphic-git (MIT) | P2 | L |
| 20 | Notion AI / v0 | search across *all* projects (org memory) | vault is per-project; `vaultSearch` takes one project (`headless.ts:684-690`) | in-house over fusionRank | P2 | S–M |

### 3.2 License roll-up (GitHub REST API, 2026-09-06 — SPDX / ★ / last push)

MIT: argyleink/open-props (5.5k, 2026-08-11) · shikijs/shiki (13.8k, 08-10) · lucaong/minisearch (6.1k, 2025-09-16) · dolanmiu/docx (5.9k, 08-07) · mermaid-js/mermaid (90.1k, 09-04) · xyflow/xyflow (38.3k, 09-05) · xtermjs/xterm.js (21.1k, 09-05) · radix-ui/colors (1.7k, 2025-12-17) · radix-ui/themes (8.7k, 2026-04-11) · shadcn-ui/ui (123.1k, 09-04) · excalidraw/excalidraw (131.2k, 09-04) · yuzutech/kroki (4.3k, 08-23) · dagrejs/dagre (5.8k, 08-08) · isomorphic-git/isomorphic-git (8.3k, 09-03) · tailwindlabs/tailwindcss (97.5k, 09-02) · marked npm package (MIT, 0 deps — repo LICENSE file is a CLA, see [07 §2.1]) · pdfmake npm package (MIT — repo NOASSERTION, fonts bundled, see [07 §2.10]).
Apache-2.0: cure53/DOMPurify (17.4k, 09-05) · modelcontextprotocol/typescript-sdk (13.3k, 09-06 — documented MIT→Apache-2.0 transition; both allowed).
BSD-3-Clause: highlightjs/highlight.js (25.0k, 08-30) · kpdecker/jsdiff (9.2k, 08-24).
Spec reference only (NOASSERTION, not vendored): design-tokens/community-group (2.1k) — the W3C Design Tokens Community Group format spec.
**Zero GPL/AGPL/SSPL entries. All picks carry forward [07 §3]'s hygiene notes (marked CLA, pdfmake fonts, shiki WASM — server-side use avoids client cost).**

## 4. Gap-by-gap integration specs

Format per gap: **They do** (competitor + cited URL) · **RapidTool lacks it** (honest file:line evidence) · **Borrow** (repo, license-verified) · **Integration spec** (type-level: files/functions/shapes) · **UI wiring** · **Headless/agent wiring** · **Acceptance (DoD)** · Priority + effort. House style: no fabricated code — signatures only; existing conventions win (zod at module boundaries, `{ok:false, error}` honesty shapes, `fnv1a` from `algorithms.ts:723`).

### 01 — Markdown rendering of packet & artifacts (P0 · S)

- **They do:** every builder/agent console renders markdown-rich output; RapidTool's own competitors' docs are md-rendered. Even the humblest surface (GitHub) renders README/packets. ([06 §1-2]; https://github.com/stackblitz/bolt.new)
- **RapidTool lacks it:** packet tab prints raw text in a `<pre>` (console.tsx ~`:1470-1474`, [07 §1 ground truth]); artifact bodies render as preformatted text (`ArtifactPane` `console.tsx:1914+`). No markdown library in `package.json`; grep `marked|markdown-it|remark` over src = 0. A 13-phase packet with `## System JSON` fences, tables and ledgers is currently an undifferentiated monospace wall — the single highest daily-visibility loss.
- **Borrow:** **marked** — https://github.com/markedjs/marked — npm package MIT, 0 runtime deps (repo LICENSE is a CLA; consume the package — [07 §2.1]) + **DOMPurify** — https://github.com/cure53/DOMPurify — Apache-2.0 (mandatory before any `dangerouslySetInnerHTML`; do NOT copy the static-theme pattern in `__root.tsx:46` for artifact HTML).
- **Integration spec (new file `src/lib/markdown.ts`):** export `renderMarkdown(src: string): string` = `marked.parse(src, {gfm: true, breaks: false})` → `DOMPurify.sanitize(html)` (client) / a server-safe allowlist pass for SSR; export `renderMarkdownSafe(src)` used by both worlds. Keep `.md` download bytes untouched (`io.ts:93 exportPacketText`).
- **UI wiring:** packet tab pane (`console.tsx:1470-1474`) and `ArtifactPane` body (`console.tsx:1914+`) render through `renderMarkdown` inside a `prose`-styled container; language/copy affordances preserved. Raw-view toggle optional (P2).
- **Headless wiring:** none needed — CLI `packet --out` already writes raw `.md` (correct: agents want bytes). Server components may pre-render HTML in TanStack Start later.
- **Acceptance:** seeded project → packet pane shows rendered headings/fences, no raw `#` leakage; artifact containing `<script>` renders inert (sanitizer test); typecheck + `packet.test.ts`/console build green. Dep install is the only package.json change.
- **Ownership:** task-5 adjacent (console) — coordinate; task-4's Design tab will want `renderMarkdownSafe` for artifact previews.

### 02 — Syntax highlighting (P0 · S–M)

- **They do:** Cursor, Copilot, Devin and Claude Code all show code with real syntax highlighting; PR review surfaces highlight diffs natively (https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent).
- **RapidTool lacks it:** no highlighter in src (grep 0); every code body (P6 module, agent patches, YAML/OpenAPI artifacts) is plain mono text.
- **Borrow:** **shiki** — https://github.com/shikijs/shiki — MIT, 13.8k★, pushed 2026-08-10 ([07 §2.4]): TextMate-grade, SSR-friendly via cached `createHighlighter`; curated subset ts/js/json/md/bash/sql/yaml/css/html. Server-side render → ships highlighted HTML, ~0 client JS. (If WASM is a hard no: highlight.js BSD-3-Clause [07 §2.4].)
- **Integration spec:** in `markdown.ts` (01) add fence handling `highlightFence(lang, code)` (server: cached highlighter, theme pair follows `data-theme`, `__root.tsx:44-47`; client fallback: no-op → plain `<pre>`); plus `highlightBlock(code, lang)` for the non-markdown `<pre>` surfaces.
- **UI wiring:** code fences inside 01's rendered markdown + the existing `<pre>` code blocks (packet pane, `ArtifactPane`, oracle tab `console.tsx:1512`).
- **Headless wiring:** none (SSR/static). CLI keeps raw text (agents prefer bytes).
- **Acceptance:** a `ts` fence in a seeded artifact renders `<span class="shiki…">`; unknown languages fall back gracefully; no CLS on navigation; bundle impact ≈ 0 (server-side).
- **Note:** shiki's oniguruma WASM loads server-side — fine under Vite asset handling ([07 §2.4]); verify at install.

### 03 — Fuzzy full-text search over the vault + artifacts (P0 · S)

- **They do:** Cursor indexes your repo for semantic recall; Obsidian ranks note search; Claude Code memory retrieval ([06 §3.2]; https://obsidian.md/, https://cursor.com/docs/cloud-agent).
- **RapidTool lacks it:** `searchVault` is case-insensitive **substring** scoring over title(4)/tag(2)/body(1) (`vault.ts:376-388`) — "phase 5" misses "phase five", plural/prefix variants return nothing; artifacts aren't indexed at all; ⌘/ artifact search is the same substring mechanic (`console.tsx:269` focus, per [07 §1]).
- **Borrow:** **minisearch** — https://github.com/lucaong/minisearch — MIT, 6.1k★ (mature, quiet since 2025-09-16 — that is stability at this scale, [07 §2.3]). ~10 KB, synchronous, in-memory — vault + current-project artifacts are already fully client-side.
- **Integration spec:** in `src/lib/vault.ts` add `buildSearchIndex(notes: VaultNote[]): MiniSearch` and `searchNotes(index, query, limit)` while **keeping `searchVault(notes, query): VaultNote[]` byte-compatible** (headless.ts validates export names — `headless.ts:497`; the CLI `search` verb consumes it `headless.ts:684-690`). Second index over artifacts (title+body) feeds ⌘/.
- **UI wiring:** VaultPane search box (`console.tsx:2126+`) and the ⌘/ palette swap to the index; surface `score` in tooltips.
- **Headless wiring:** CLI `search --query` output unchanged in shape (`{ok, query, hits:[…]}`), better recall; add `--artifacts` flag later.
- **Acceptance:** query "phase 5 gate" returns the "P5 validation gate" note; ranking puts title hits first; `searchVault` old signature still passes `vault.test.ts` + `headless.test.ts` unmodified.
- **No-dep alternative** (if dep budget is zero): trigram index ~120 lines inside `vault.ts` — loses ranking/stemming ([07 §2.3]).

### 04 — Headless DoD gate parity + CI-recheckable verdicts (`cli check`) (P0 · S)

- **They do:** GitHub Copilot cloud agent executes tests/linters in the same ephemeral CI environment that produces the PR — the machine's verdict travels with the change (https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent); Claude Code enforces policy at the tool boundary via PreToolUse hooks (https://code.claude.com/docs/en/memory).
- **RapidTool lacks it:** `recordGate` exists **only in the store path** (`store.ts:135` impl, called `store.ts:249`); `headless.finishPhase` (`headless.ts:257-275`) advances and stamps the packet with **no recorded gate** — CLI/`gate` runs produce `gate_passed: null` in the packet System JSON (`packet.ts:59`) for completed deterministic phases ([08 E-02]). Consequence: the hash-verifiable DoD machinery ([06 §5#11]) is unreachable from the file/CLI world an agent or CI can actually drive. **Status check this pass:** E-02 has NOT landed (headless.ts has no `recordGate` symbol).
- **Borrow:** in-house — refactor the pure body of `store.recordGate` into `export function recordGateInto(project: Project, phase: PhaseId): Project` in `src/lib/dod.ts` (it only uses `runGate`/`gateArtifact`/types); `store.recordGate` becomes a thin delegate keeping byte-identical store behavior (store.test.ts green unmodified). Then call it from `headless.finishPhase` before `stampPacket` when the phase record is `complete`.
- **Integration spec:** new CLI verb `check` in `rapidtool-cli.mjs` (dispatch `case "check"`, same one-JSON contract): loads project, re-runs `runGate` over every recorded `PhaseRecord.gate`, compares `evidenceHash` (`dod.ts:224`, FNV-1a over sorted pairs `dod.ts:213-240`), re-runs `verify` status if a generated module exists; exits `0` all-green / `1` on drift, printing `{ok, gate: {phase, passed, unmet, hashOk}[], drift: n}`. This makes the evidence hash **enforceable in CI** — the Copilot move ([06 §6#4]).
- **UI wiring:** gate/verdict honesty panel shows a "re-verify all" button calling the same pure path client-side ([08 E-21] E-item stays separate).
- **Headless wiring:** `check` verb (above) + E-02 assertion in `headless.test.ts`: after `runUntilGate` over ≥1 phase, `phase.gate != null` and a `gate` artifact exists.
- **Acceptance:** `headless.test.ts` + `store.test.ts` + `gates.test.ts` green; CLI `gate` run → `export` shows non-null `gate_passed`; a hand-tampered project.json flips `check` to exit 1 with `hashOk:false`.
- **Also log denials** (E-20 remainder): when store autopilot is refused (`canAutopilot` false at `store.ts:178-186` — forceHuman `:181`, stock HITL `:182`, **DoD-fail `:184`**, tightness `:185`), append `log("autopilot.gate_denied", reason)` so the ledger explains *why* the machine parked.

### 05 — Real-run verdict converges into the P6 DoD gate (P0 · S)

- **They do:** Replit Agent 3 tests the app it builds in a real browser and fixes what it finds — "checks buttons, forms, APIs… ensuring every part of your app works" (https://replit.com/blog/introducing-agent-3-our-most-autonomous-agent-yet, fetched 09-06); Copilot runs tests before the PR is minted (same page as 04).
- **RapidTool lacks it:** `engine.runP6Real` returns `{ok, result, project?}` where the returned project already carries `lastTest` stamped from the real exit code (`engine.ts:1416-1438`; contract doc at `:1429-1434`). Its only caller `store.runModuleReal` **drops `out.project`** — it builds its own artifact/log from `out.result` only (`store.ts:523-547`) and never re-runs `recordGate`, so the DoD `p6-test` probe (`dod.ts:118-125`) keeps describing the *template self-test* while the real run may be failing ([10 §1.3 G2], [08 E-03]). Verified this pass: still open at `store.ts:518-557`.
- **Borrow:** in-house (convergence, not a library).
- **Integration spec:** in `runModuleReal` (`store.ts:518`): when `out.project` is present, merge it (`lastTest` from the real verdict) instead of hand-building `updated`; append the "Real module run (bounded)" artifact (`:544`) onto that merged project; re-run `recordGate(updated, 6)` (via 04's `recordGateInto`); log `runner.real` plus a `gate.verdict` re-eval row.
- **UI wiring:** honest labels in the evidence dock — the stale "sandbox pass/fail" row (`console.tsx` footer ~`:1322-1324`) becomes "self-test (template)" vs "real run: exit N" sourced from `lastTest` provenance ([08 E-03 #2]).
- **Headless wiring:** CLI `verify --apply` (E-06, P1) later persists verify outcomes through the same converged path; this item itself is store/UI-side.
- **Acceptance:** `store.test.ts` + `gates.test.ts` green; probe — a failing real exit code flips `lastTest.ok` to false and the recorded P6 gate artifact to FAIL (per [08 E-03] DoD).

### 06 — Agent-report evidence & memory on every outcome, not just "complete" (P0 · S)

- **They do:** Claude Code distills corrections into memory continuously — memory is written from *interaction outcomes*, not only from successful runs (https://code.claude.com/docs/en/memory); Copilot's agent reports what it ran, tests included (https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent).
- **RapidTool lacks it:** `applyReport` writes memory rows **only when `report.status === "complete"`** (`report-intake.ts:163-181`) — `blocked`/`partial` reports (the ones with the lessons) leave a rejectionHistory note at most (`:152-161`) and no memory; the log detail line omits `tests_run` entirely (`:138-148` detail = status/summary/files/artifacts). **Landed since 08 was written:** M-05's store warn now consults the raw payload (`store.ts:126,574-598` `rawReportCarriesTests`) so the false "no evidence" warning is gone, and M-08's complete-report memory rows exist — the remaining hole is *blocked/partial* reports and `tests_run` surfacing.
- **Borrow:** in-house.
- **Integration spec:** (a) `validateReport` constructed report copies `tests_run` (verify current state — if still dropped at `report-intake.ts:120-123`, attach the validated rows); (b) `applyReport` detail gains `${n} test run(s): ${pass}/${n}` when present; (c) when `status !== "complete"`, append one capped episodic row (`kind:"episodic", text: "report blocked/partial: <summary 200 chars>", score: 0.5`) via the existing `dedupeMemoryIds`/cap path (`:177-180`); (d) report `files` keep the "names only, no body" honesty (that is gap 12).
- **UI wiring:** artifacts/ledger already render `[agent report]` rows; memory tab gains the new rows automatically — no console change strictly required.
- **Headless wiring:** `ingest` verb benefits automatically (it calls `validateReport`+`applyReport`); add `tests_run` count to the `summary` output's last-report line for parity with the UI.
- **Acceptance:** extended `report-intake.test.ts`: blocked report → exactly one new episodic memory row + no semantic row; complete report with tests → detail contains "test run(s)"; store warn does not fire for evidence-carrying complete reports (regression).

### 07 — Design tokens & a real design-system surface (P1 · M — **new module this wave, deep spec §5**)

- **They do:** Onlook's AI "understands your React components, your design tokens, and your project architecture, so every change fits seamlessly into the codebase" (https://www.onlook.com/features/ai, fetched 09-06); v0 ships on-brand, editable design from a prompt (https://vercel.com/blog/v0-app, fetched 09-06); Tempo treats design as code in your repo (https://www.tempo.new/ [06 §1.5]).
- **RapidTool lacks it:** the P8 "Interface contract" is **six prose lines** — "Framework: React + Tailwind (component agents)…" (`engine.ts:570-594`) — no color, no type ramp, no radius/spacing, no theme artifact. Zero token/theme code anywhere in src (grep `design-token|theme|palette` = prose only). The P8 DoD probes check that a `ui` artifact exists (`dod.ts:151-155`), not that it has any design content. The console's own tokens live in `styles.css` `@theme` (dark-only, hard-coded hexes).
- **Borrow (3+ license-verified repos, deep spec §5.2):** **argyleink/open-props** (MIT — token taxonomy: color/type/spacing/radius as plain CSS custom properties), **radix-ui/colors** (MIT — accessible, stepped color scales; dark/light pairs), **shadcn-ui/ui** (MIT — Tailwind-theme token mapping patterns: `--background/--foreground/--primary/--muted…`), **radix-ui/themes** (MIT — token-driven component theming), and the **design-tokens/community-group** format spec (https://github.com/design-tokens/community-group — NOASSERTION license → **spec reference only**, use for the JSON shape `$type/$value`, never vendored code).
- **Deliverable:** `src/lib/design.ts` — deterministic, zero-dep, pure functions of `Project` — **exact contract in §5**. Do NOT add a dependency; the tokens are vendored constant tables + `fnv1a`.
- **UI wiring (this wave, task-4):** new **Design** tab in the run console (extend `RunTab` union `console.tsx:80`): token swatch grid, type-ramp scale preview, CSS-variable block with copy, and an `<iframe srcDoc={designHtml(project)}>` self-contained design-system preview (no network).
- **Headless wiring (this wave, task-3):** `design` CLI verb → `{ok, path, bytes}` writing `<slug>.design.html` + `<slug>.tokens.json` beside the project (dynamic-import pattern matching the vault layer, `headless.ts:497-510`).
- **Next wave (not this one):** engine P8 synthesis (`engine.ts:570-594`) emits the token set as a real `theme` artifact (kind `"ui"`, JSON body) + the P8 HITL prompt shows the preview — making design a *contract* like every other phase ([06 §6#16]).
- **Acceptance:** §5's list — ≥12 tests, determinism byte-identical, no disallowed globals, typecheck + full suite green.

### 08 — Deterministic architecture & pipeline diagrams (P1 · M — **new module this wave, deep spec §6**)

- **They do:** GitHub renders mermaid in every issue/PR; Tempo and Copilot ship visual plans; DeepWiki-style architecture pages are diagram-first (https://www.tempo.new/; mermaid is the de-facto doc-diagram standard — https://github.com/mermaid-js/mermaid).
- **RapidTool lacks it:** no diagram code anywhere (grep `mermaid|diagram` = 0 product hits); the spec tab renders the dependency-ordered file list as a **flat `<ol>`** (`console.tsx:1476-1493`); the 13-phase rail exists only as DOM chips. The deterministic graph data (`project.specGraph`, `project.phases`, `DOD` registry) is already there — nothing draws it.
- **Borrow (3+ license-verified repos, deep spec §6.2):** **mermaid-js/mermaid** (MIT — flowchart grammar/layout *patterns*), **yuzutech/kroki** (MIT — server-side diagram-to-SVG service pattern), **excalidraw/excalidraw** (MIT — SVG hygiene/packaging patterns), **dagrejs/dagre** (MIT — ranked layered layout pattern). **Patterns only**: `diagram.ts` is zero-dep deterministic SVG, not a wrapper.
- **Deliverable:** `src/lib/diagram.ts` — `buildDiagram(project, kind)` — **exact contract in §6**.
- **UI wiring (this wave, task-4):** new **Diagram** tab (RunTab union `console.tsx:80`): kind selector (phase pipeline / architecture / gate flowchart), inline `<svg>` render, copy-SVG + download buttons.
- **Headless wiring (this wave, task-3):** `diagram` CLI verb → `{ok, path, bytes, kind}` writing `<slug>.<kind>.svg` (same dynamic-import pattern).
- **Next wave:** mermaid *fence* rendering inside 01's markdown (gap 16) can reuse the same kind registry for agent-authored diagrams.
- **Acceptance:** §6's list — ≥10 tests, byte-determinism, XML-safety, typecheck + suite green.

### 09 — Human gates review a *diff*, not prose (P1 · S)

- **They do:** Tempo ships agents' work "as a pull request, because it was never a mockup" (https://www.tempo.new/); Copilot's flow ends in a reviewable PR diff (https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent); Devin's PRs carry visual QA (https://devin.ai/ [06 §2.4]).
- **RapidTool lacks it:** no diff library or view (grep `jsdiff|diff` = UI words only); the P5/P8/P9 HITL prompts are text (`types.ts:105-118 HitlRequest`), and agent report bodies are ingested as markdown artifacts — a reviewer cannot see *what changed* against the spec graph.
- **Borrow:** **kpdecker/jsdiff** — https://github.com/kpdecker/jsdiff — BSD-3-Clause, 9.2k★ ([07 §2/§4#4]).
- **Integration spec:** new `DiffView` component (`src/components/`) over `diffLines(oldText, newText)`; in `packet.ts`, add a machine **diff summary block** to the Phase-work section (`packet.ts:225-236` region): files touched (from report `files`) vs spec-graph order (`project.specGraph.order`), count of changed lines, `+/-` balance — the *contract delta* for the human gate ([06 §6#6]). Type-level: `summarizeDelta(project, report): {files: {file, status:"match"|"unexpected"|"missing"}[]; added: number; removed: number}` in `report-intake.ts`.
- **UI wiring:** HITL dock and `ArtifactPane` gain "Diff" toggle when a prior variant/artifact body exists (P6 variant flips `engine.ts:469-470` are the first candidate pair).
- **Headless wiring:** `ingest` output gains the delta summary; `packet` embeds it — agents get the same contract delta the human does.
- **Acceptance:** `report-intake.test.ts` delta cases; DiffView renders unified +/- rows for a seeded pair; typecheck green.

### 10 — Browser smoke verification at the P8 gate (P1 · M)

- **They do:** Replit Agent 3: "the Agent will periodically decide to test your application… It checks buttons, forms, APIs, data sources etc" in a real browser and fixes what it finds (https://replit.com/blog/introducing-agent-3-our-most-autonomous-agent-yet, fetched 09-06).
- **RapidTool lacks it:** P8 DoD probes `p8-ui`/`p8-complete` only assert artifact presence + phase record (`dod.ts:151-161`); nothing ever runs or clicks the produced UI. Playwright **is** installed (devDependency `^1.62.0`) and `scripts/browser-smoke.mjs` exists — but no DoD probe or product surface consumes them ([06 §6#3] calls this the "biggest verification gap").
- **Borrow:** in-house over installed playwright + `scripts/browser-smoke.mjs`; verification seam pattern from `verify.server.ts` (honest `not-configured` when no browser).
- **Integration spec:** `src/lib/verify.server.ts` gains `runBrowserSmoke(project, {timeoutMs})` beside `runCases`; new optional DOD probe `p8-smoke` (`dod.ts` P8 list) that is **server-gated**: `{id:"p8-smoke", criterion:"P8 UI smoke passed in a real browser", probe: (p) => p.lastBrowserSmoke?.ok === true}` — probe passes only when evidence exists; absent runner/key ⇒ honest not-configured, never fabricated pass ([06 §6#3], [04 §10]).
- **UI wiring:** oracle tab gains a "Browser smoke (P8)" row with status + screenshot link when run.
- **Headless wiring:** CLI `verify --smoke` later; this item lands the probe + server function.
- **Acceptance:** `gates.test.ts` green (probe false on seeded project without evidence); smoke of the console's own demo project (playwright) returns pass/fail with evidence text; no fabricated pass path.

### 11 — Plan-mode dry run (`--plan`) (P1 · S)

- **They do:** Cline's explicit **Plan then Act** modes — align on strategy before execution (https://cline.bot/, https://github.com/cline/cline); v0.app "Plan out work: Makes a step-by-step plan… To-do management" (https://vercel.com/blog/v0-app, fetched 09-06).
- **RapidTool lacks it:** headless `runPhase` synthesizes and applies atomically; there is no preview mode that shows what a phase *would* produce without advancing state. The engine already separates synthesis from application (`applyPhaseResult` vs `finishPhase`, `store.ts:233-234`), so a preview is a thin seam ([06 §6#5]).
- **Borrow:** in-house.
- **Integration spec:** `src/lib/headless.ts` — new exported `planPhase(project): {ok, plan: {phase, artifacts: {kind,title,summary}[], hitl: {title,prompt}|null, dod: GateItem[]}}` (pure, no state write); CLI `run --plan` prints the plan JSON and exits without mutating the project file.
- **UI wiring:** phase-rail context menu "Preview phase" opens a modal with the same payload.
- **Headless wiring:** `run --plan` / `gate --plan` verbs.
- **Acceptance:** `headless.test.ts`: `planPhase` returns artifact summaries for the current phase; project file byte-identical after a `--plan` run; typecheck green.

### 12 — Release-bundle materializer: files + runbook + env manifest (P1 · M–L)

- **They do:** Lovable gives you "a codebase that can be synced to GitHub or GitLab" — the user owns real files (https://docs.lovable.dev/introduction/welcome, fetched 09-06); Bolt exports a deployable bundle ([06 §1.1]); v0 deploys (https://vercel.com/blog/v0-app).
- **RapidTool lacks it:** a completed run terminates in project.json + packet + vault notes. **No file of the target product is ever materialized**: agent-report `files` are names without bodies (`report-intake.ts:141-142` — logged, discarded); P9 CI/IaC are *sketch text* (`engine.ts:595-639`); the P12 handoff is ADR/OpenAPI prose with no operator memo ([10 §1.3 G1/G3/G4 — the end-state gap, quoted verbatim there]).
- **Borrow:** in-house scaffold emitter ([08 E-15] project kinds + [10 §2.2 pipeline + E3/E5/E6]); patterns from any MIT starter (e.g. vite templates, tailwindlabs/tailwindcss MIT) — **no new runtime dep**; writers already exist (`io.ts` atomic export + `headless.ts:51-71` atomic write).
- **Integration spec (type-level):** new `src/lib/release.ts`: `materializeRelease(project, dir): {ok, files: {path, bytes}[], runbook: string, manifest: {env: {key, required, note}[]}}` — deterministic: writes the P6 generated module as `<slug>/src/module.ts`, P9 YAML sketches as real `.github/workflows/…`, `.env.example` from P9/P12 content, a `DEPLOY.md` runbook (build command, host-routing options, smoke step, "who does this"), and a `HANDOFF.md` P12 memo ([10 E6]). Content stays **template-grade honest**: no fabricated deploy claims; sandbox claim (`sandbox.ts:158`) reproduced in DEPLOY.md.
- **UI wiring:** "Export release bundle" button in the artifacts tab header (downloads a folder-shaped JSON manifest or zip via existing blob pattern `console.tsx:790-810`).
- **Headless wiring:** CLI `release --out <dir>` verb; `--dry-run` lists files without writing.
- **Acceptance:** seeded P0–P12 fixture (src/lib/testing/fixtures.ts `seedProject`) → materialize → every declared path exists with non-empty bytes; `.env.example` contains no secrets; DEPLOY.md contains the sandbox claim; `io.test.ts`-style round-trip test green.
- **Honest constraint:** this is a *packaging* win (Lovable export parity), NOT auto-deploy — RapidTool must never fake hosting ([10 §0.2] B-18/B-23 honesty contract).

### 13 — Intake cross-checked against DoD + deny-list (P1 · S)

- **They do:** Copilot's agent works inside CI where tests actually run, so its "done" is machine-checked (https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent); Claude Code hooks can block an action "regardless of what Claude decides" (https://code.claude.com/docs/en/memory); Warp's denylist keeps certain commands out of NL handling (https://www.warp.dev/ai [06 §3.1]).
- **RapidTool lacks it:** `ingestReport` validates shape + currentPhase match only (`store.ts:566-570`, `report-intake.ts:77-82`); a report claiming `status:"complete"` for a phase whose DoD is unmet is accepted with at most a warn — no `runGate` cross-check, no deny-list scan of `files`/commands ([08 E-16]).
- **Borrow:** in-house; sandbox deny-list scanner already exists (`sandbox.ts:24-67`, [06 §6#8]).
- **Integration spec:** in `validateReport` (`report-intake.ts:56-124`), when `status:"complete"`, evaluate `runGate(project, report.phase)`; on unmet criteria return `{ok:false, error:"Report claims complete but DoD unmet: p8-ui, …"}` **unless** the report explicitly declares `gate_unmet: true` (honest override → accepted with warn log, per E-16). Scan `report.files` + artifact bodies against the sandbox deny-list; hits reject with the offending pattern named.
- **UI wiring:** reject toast explains DoD unmet list (already rendered pattern).
- **Headless wiring:** `ingest` verb inherits both checks automatically; errors already exit 1 with `{ok:false, error}`.
- **Acceptance:** `report-intake.test.ts` — complete-claim-with-unmet-DoD rejected; `gate_unmet:true` accepted-with-warn; deny-list hit rejected naming pattern; store suite green.

### 14 — PDF/DOCX export of the governed trail (P1 · S–M)

- **They do:** every competitor hands you a shareable/publishable artifact — Lovable's "build and publish" (https://docs.lovable.dev/introduction/welcome, fetched 09-06), Obsidian/Notion export pipelines ([06 §3.2/3.3]).
- **RapidTool lacks it:** downloads are `.json`/`.md` blobs only — `exportProjectJson`/`exportPacketText`/`downloadFilename(project, ext)` with `Ext = "json" | "md"` (`io.ts:25,93,118`). The governed paper trail (ledger, gates, packet) has no document format for non-technical stakeholders.
- **Borrow:** **bpampuch/pdfmake** — https://github.com/bpampuch/pdfmake — npm MIT (repo NOASSERTION; bundles Apache-2.0 Roboto fonts, code-split — [07 §2.10]) + **dolanmiu/docx** — https://github.com/dolanmiu/docx — MIT. **Zero-dep first slice ships before either**: `@media print` stylesheet + `window.print()` from the packet tab covers ~80% of the ask ([07 §4#5]).
- **Integration spec:** widen `downloadFilename`'s `Ext` union to `"json" | "md" | "pdf" | "docx"` (`io.ts:118`); add `exportPacketPdf(project): Promise<Buffer>` + `exportPacketDocx(project): Buffer` in a new `src/lib/export.server.ts` (lazy `import()` — never in the main bundle); the document-definition maps 1:1 onto the packet's structured sections (status table → decision ledger → per-phase gates).
- **UI wiring:** extend the existing download menu (`console.tsx:790-810`) with "Download packet as PDF/DOCX".
- **Headless wiring:** CLI `packet --format pdf|docx|md|json` (default md) → writes the file; same one-JSON contract.
- **Acceptance:** pdf/docx export of a seeded packet opens/parses (smoke: file starts with `%PDF` / `PK`); print stylesheet renders the packet tab cleanly at 100% zoom; typecheck green.

### 15 — Real MCP client module (P2 · M)

- **They do:** Claude Code, Cline and Cursor all connect to MCP servers as first-class tools; MCP is the agent-tool standard they ship (https://code.claude.com/docs/en/overview, https://cline.bot/, https://github.com/cline/cline).
- **RapidTool lacks it:** MCP appears **only as phase content**: crew tool-name strings `"mcp.search"` (`algorithms.ts:504`), phase prose "Long-running tools must stream over WebSocket MCP" (`algorithms.ts:607`), a "FastMCP" role row (`algorithms.ts:772`), and the `p3-mcp` DoD probe that checks an artifact *exists* (`dod.ts:80-86`). There is no client module, no transport, no tool registry — P3 validates prose about MCP, not an MCP integration ([06 §7#2] loss register).
- **Borrow:** **modelcontextprotocol/typescript-sdk** — https://github.com/modelcontextprotocol/typescript-sdk — MIT/Apache-2.0 (documented transition; both allowed), 13.3k★, pushed 09-06. Server-side only (never in the browser bundle).
- **Integration spec (type-level):** new `src/lib/mcp.server.ts`: `connectMcp(config: {command?, url?, headers?}): Promise<McpSession>` exposing `listTools()`, `callTool(name, args)` returning `{ok:true, content} | {ok:false, reason:"not-configured"|"timeout"|"error", error?}` — house honesty shape. Registry on `Project` stays out of scope (types.ts unchanged this wave); first consumer is the **crew researcher seat** (`crew.server.ts` researcher turn) and/or a `tools` CLI verb listing discovered tools.
- **UI wiring:** crew tab shows "N MCP tools available" when configured; oracle tab lists tool calls.
- **Headless wiring:** `tools --list|--call <name> --args <json>` verbs (server-gated like `crew`, honest `not-configured` without config).
- **Acceptance:** with a local stdio MCP server fixture (tests spawn none — use a mock transport), list/call round-trips; no key ⇒ `not-configured`; typecheck + crew suite green.
- **Honest constraint:** P3's phase contract also wants *A2A* and *FastMCP microservices* — the sdk covers client transport only; do not fake the rest.

### 16 — Mermaid-fence rendering in artifacts (P2 · M)

- **They do:** GitHub, Notion and most doc tools render mermaid code fences inline — agent-authored diagrams are table stakes for artifact readability (https://github.com/mermaid-js/mermaid).
- **RapidTool lacks it:** no markdown rendering (01) and no diagram engine, so a mermaid-fenced code block inside an agent report or artifact renders as raw text forever.
- **Borrow:** mermaid (MIT, [07 §2.2] — lazy `import()` only, never the main bundle; code-split behind render).
- **Integration spec:** depends on 01 + 08: in `markdown.ts`, detect `mermaid` fences during `renderMarkdown`, emit a placeholder element; a client `MermaidBlock` component (`src/components/`) lazy-imports mermaid and renders on mount; the deterministic `diagram.ts` kinds stay the *default* when mermaid is unavailable (offline/keyless floor).
- **UI wiring:** artifact pane + packet pane render fences automatically after 01 lands.
- **Headless wiring:** none (render is client-side); `diagram` verb remains the deterministic server/CLI path.
- **Acceptance:** seeded artifact with a mermaid fence renders an SVG in-app; with mermaid import failing (test mock), placeholder shows + deterministic SVG fallback; main bundle size unchanged (dynamic import assertion).
- **Dependency map:** 16 → 01 → 08 → this wave's design/diagram modules.

### 17 — Interactive node-edge spec-graph view (P2 · M)

- **They do:** Cursor/Tempo/Devin all show agent work as navigable graphs/plans, not ordered lists (https://cursor.com/docs/cloud-agent, https://devin.ai/).
- **RapidTool lacks it:** spec tab = flat `<ol>` of `specGraph.order` (`console.tsx:1476-1493`) — dependency edges (`SpecNode.dependsOn`, `types.ts:177-188`) exist in data but are never drawn.
- **Borrow:** **xyflow/xyflow** — https://github.com/xyflow/xyflow — MIT, 38.3k★ ([07 §2.7]): `@xyflow/react` v12, lazy-loaded; React 19 peer support verified at install.
- **Integration spec:** new `SpecGraphView` component consuming `project.specGraph` directly (nodes = `SpecNode` file+owner+purpose; edges = `dependsOn`); DoD state per node from `PhaseRecord.gate` where files map to phases. Recharts covers data charts; xyflow covers graph drawing — no overlap.
- **UI wiring:** replaces/augments the spec tab content (`console.tsx:1476-1493`) with a lazy-loaded canvas + list toggle.
- **Headless wiring:** none (view-only). Packet `## Spec graph order (A5)` stays the agent contract.
- **Acceptance:** seeded project renders node-edge layout; pan/zoom works; tab switch adds ≤50 KB gz lazy chunk; typecheck + build green.

### 18 — Streaming run output + live terminal (P2 · L, two-phase)

- **They do:** Replit's live console and Devin's session view stream agent/run output as it happens (https://replit.com/blog/introducing-agent-3-our-most-autonomous-agent-yet; https://devin.ai/).
- **RapidTool lacks it:** the bounded runner is request/response — output returns when the run ends; no server→client push channel exists (grep `EventSource|text/event-stream` = 0; [07 §2.5]).
- **Borrow:** **xtermjs/xterm.js** — https://github.com/xtermjs/xterm.js — MIT ([07 §2.5]); Phase A is the real cost (SSE/WS from `node-runner.server.ts`), Phase B is the xterm surface with fit addon.
- **Integration spec:** Phase A: server function `streamRun(id)` yielding chunks over SSE (new `src/lib/stream.server.ts`), Phase B: `LiveTerminal` component in the Run tab. Until A exists, xterm is decoration — keep `<pre>` tail-refresh ([07 §4#9]).
- **UI wiring:** Run tab "Live output" collapsible under the existing "Run module (bounded)" button (`console.tsx:1086`).
- **Headless wiring:** CLI stays non-streaming (agents poll); document `--follow` as later.
- **Acceptance:** Phase A: SSE tail of a slow fixture run arrives incrementally; Phase B: xterm renders + resize works. Engine phase calls stay non-streaming (engine untouched — stream only the runner).

### 19 — Git sync & PR handoff (P2 · L)

- **They do:** Lovable syncs every project to GitHub/GitLab with Git sync — code ownership in your normal workflow (https://docs.lovable.dev/introduction/welcome, fetched 09-06); Copilot ends in a branch + PR; Tempo ships PRs with CI (same pages as 09).
- **RapidTool lacks it:** no git anywhere — grep `isomorphic-git|simple-git|child_process` over src = 0; a finished project cannot be handed to a repo without a human copy-paste.
- **Borrow:** **isomorphic-git/isomorphic-git** — https://github.com/isomorphic-git/isomorphic-git — MIT, 8.3k★ (pure-JS git; no native binary — respects the no-native-deps constraint) — **or** shelling to the system `git` CLI (zero dep; check `git --version` first, honest `not-configured`).
- **Integration spec:** new `src/lib/git.ts` (server-side): `initRepo(dir)`, `commitAll(message)`, `push(remote, branch)` with the house `{ok, error}` shapes; wired after gap 12's `materializeRelease` so the bundle lands in a repo with one command.
- **UI wiring:** release-bundle dialog gains "Init git repo" + "Create commit" buttons (server functions).
- **Headless wiring:** `release --git --remote <url>` — materialize → init → commit; push stays explicit (`--push`).
- **Acceptance:** on a temp dir, init+commit round-trips (assert `.git` exists + log has the commit); no remote → `{ok:false, error:"no remote"}`; never auto-push without the flag.
- **Honest constraint:** no PR creation against GitHub API this wave (that needs auth + `gh`); document as next step.

### 20 — Cross-project search (org memory) (P2 · S–M)

- **They do:** Notion AI answers across your whole connected workspace (https://www.notion.com/product/ai); v0 "remember[s] what you've built" (https://vercel.com/blog/v0-app); Claude Code memory persists across sessions (https://code.claude.com/docs/en/memory).
- **RapidTool lacks it:** vault + memory are per-project; `vaultSearch` takes one project (`headless.ts:684-690`); memory rows are engine/report-written only and never searched across projects; doc [06 §6#14] rates this the natural "ask my build history" feature.
- **Borrow:** in-house — `fusionRank` (`algorithms.ts:214`) already ranks memory; reuse as the cross-vault ranker over a directory of `project.json` files.
- **Integration spec:** headless.ts gains `searchAll(dir, query): Promise<{ok, hits: {project, noteTitle, score, kind}[]}>` walking sibling project files (atomic reader pattern `headless.ts:51-71`); optional per-project `memory.json` export keeps it file-based.
- **UI wiring:** vault tab footer "Search all projects…" prompt.
- **Headless wiring:** CLI `search --all --dir <folder>`.
- **Acceptance:** fixture dir with 2 seeded projects → query matches notes from both, ranked; deterministic order for equal scores; typecheck + headless suite green.

## 5. Deep spec A — `src/lib/design.ts` (gap 07; task-1 of this wave is building it — code against THIS contract)

**Manifest goal being served:** "deterministic design tokens + self-contained design-system HTML from a project, zero deps, reuse existing fnv1a + ≥12 thorough tests." Consumers this wave: task-3 (CLI `design` verb), task-4 (Design tab). Consumers next wave: engine P8 (`engine.ts:570-594`), release bundle (gap 12). **This contract is the tie-breaker when task-1's transcript diverges.**

### 5.1 Position & invariants

- Pure module: `src/lib/design.ts`, **zero imports from React/DOM/node**, only `types.ts` (`Project`) and `algorithms.ts` (`fnv1a`, export at `algorithms.ts:723`). No new dependencies — token data is vendored constants.
- **Determinism:** output is a pure function of `(project.name, project.brief, project.domain)`. No `Date`, `Math.random`, `crypto`, `process`, env, or network. Same project → byte-identical `DesignTokens` and `designHtml`. Document that rule in the file header (house style mirrors `vault.ts` header).
- **Honesty:** tokens must satisfy WCAG AA contrast for fg-on-bg and accent-on-accentFg pairs (assert in tests with a pure relative-luminance helper — no dep). Light/dark variants both contrast-safe. Never emit colors from raw brief text (no injection surface); brief text may appear in `designHtml` body **only HTML-escaped**.
- **Scope guard:** this module does NOT touch `engine.ts`/`types.ts` this wave (engine P8 wiring is next wave per §4 gap 07). Console `styles.css` `@theme` stays the app's own chrome tokens — `designTokens` targets the *generated product's* design system.

### 5.2 Borrowed patterns (license-verified 09-06; patterns, not code)

| Source | URL | License | What we take |
|---|---|---|---|
| open-props | https://github.com/argyleink/open-props | MIT | token *taxonomy*: semantic color roles, type steps, spacing scale, radius as named tokens |
| radix-ui/colors | https://github.com/radix-ui/colors | MIT | stepped scale structure with dark/light pairs; a11y-first neutral/accent hex tables to vendor as constants |
| radix-ui/themes | https://github.com/radix-ui/themes | MIT | mapping semantics (`accent`/`gray`/`panel`) → concrete roles |
| shadcn-ui/ui | https://github.com/shadcn-ui/ui | MIT | Tailwind-theme mapping pattern (`--background/--foreground/--primary/--muted/--border`) so generated UI can consume tokens via CSS vars |
| design-tokens/community-group | https://github.com/design-tokens/community-group | NOASSERTION — **spec reference only** | JSON shape convention `{name: {"$type": "color", "$value": "#hex"}}` for the `.tokens.json` export |
| tailwindlabs/tailwindcss | https://github.com/tailwindlabs/tailwindcss | MIT | `@theme` custom-property consumption (how the generated React+Tailwind UI would bind tokens) |

### 5.3 Required exports (exact)

```ts
// ---- public types ---------------------------------------------------------
export type DesignTokenName =
  | "bg" | "surface" | "raised" | "fg" | "muted" | "faint"
  | "accent" | "accentFg" | "ok" | "warn" | "danger" | "border" | "line";

export type DesignMode = "dark" | "light";

export type TypeStep = { name: string; px: number; lh: number }; // -2..+4, system stack

export type DesignTokens = {
  seed: number;                 // fnv1a(`${name}|${domain}|${brief}`) — document the exact string
  hue: number;                  // 0..359 (derived from seed — see palette rule)
  mode: DesignMode;             // "dark" unless seed bit 0 is set → "light" (document; tests pin it)
  colors: Record<DesignTokenName, string>;   // lowercase hex "#rrggbb" — contrast-safe pairs
  radius: number;               // px ∈ {4,6,8,10,12} chosen by seed
  space: number[];              // [4,8,12,16,24,32,48]
  font: { ui: string; mono: string };        // SYSTEM STACKS ONLY (no web fonts — offline/keyless)
  steps: TypeStep[];            // type ramp -2..+4
};

export type DesignTokenSpec = { token: DesignTokenName; value: string; role: string };

// ---- required functions ----------------------------------------------------
export function designTokens(project: Project): DesignTokens;
export function designCss(project: Project): string;
//  ^ ":root{--token-bg:#…; …}" block, keys exactly `--token-<DesignTokenName>`
//    + `--token-radius/--token-space-1..7/--token-step--2..4` — the shadcn-mapping
//    contract generated UI will bind to. Pure from designTokens().
export function designHtml(project: Project): string;
//  ^ COMPLETE standalone document: "<!doctype html>" + <head> with ONE inline <style>
//    (tokens as :root vars + component classes) + <body> design-system sheet:
//    header (project name + domain + mode/hue chips), color swatches w/ hex + role
//    labels, type-ramp scale, spacing bars, radius samples, ok/warn/danger row, and
//    a sample card + buttons proving contrast. ZERO external fetches (no fonts, no
//    images, no scripts). All project-derived text HTML-escaped. Valid, self-contained.
export function designSpecs(project: Project): DesignTokenSpec[];
//  ^ flat role/value/role-label list — what the console swatch grid + CLI --json render.
```

**Palette rule (deterministic + accessible):** vendor a constant table of 12 hue families × {dark, light} × 13 roles as precomputed hex (radix-colors-sourced values or hand-checked equivalents; ≤ 156 rows). `hue` = `seed % 360`, family index = `round(hue / 30) % 12` — i.e., nearest family, NOT free HSL math, so contrast guarantees live in the table, not in arithmetic. Tests assert the AA pairs for every family × mode.

### 5.4 Consumers' exact expectations (wired this wave)

- **CLI `design` verb (task-3):** `{ok:true, path, bytes, tokens: {seed, hue, mode}}` — writes `<slug>.design.html` = `designHtml(project)` and `<slug>.tokens.json` = `{…tokens, $schema: "https://design-tokens.github.io/community-group/format/"}` beside the project file. Dynamic import `await import("../src/lib/design.ts")` (the vault-layer pattern, `headless.ts:497-510`). Empty/brief-less project still renders (domain "custom-software" fallback — `engine.ts:92` `inferDomain`).
- **Design tab (task-4):** swatches from `designSpecs`; scale previews from `steps`/`space`/`radius`; CSS block = `designCss` with copy button; iframe `srcDoc={designHtml(project)}` sandboxed (`sandbox="allow-same-origin"` only, no scripts inside anyway); mode toggle re-renders both tokens (light) and html (light) — cheap because everything is pure.
- **`.tokens.json` shape convention (community-group):** `{"<name>": {"$type": "color", "$value": "<hex>"}}` + numeric token types for radius/space/steps.

### 5.5 Acceptance / DoD for task-1 (≥12 tests; keep typecheck + full suite green)

1. Byte-determinism: two `designTokens(seedProject)` calls deep-equal; `designHtml` string-identical across calls (and across separate process runs of the same fixture JSON).
2. Sensitivity: changing `brief` (or name/domain) changes seed/hue/family — at least two of {seed, hue, mode} differ.
3. Contrast: every role pair (fg/bg, accent/accentFg, muted/bg) ≥ 4.5:1 for both modes, all 12 families (loop in one test).
4. Format: all colors match `/^#[0-9a-f]{6}$/`; `designCss` emits every `--token-*` key and no `!important`/`url(`.
5. HTML: `designHtml` contains exactly one `<!doctype html>`, balanced `</html>`; zero `http://`/`https://`/`<script`; body text from a hostile brief (`<script>alert(1)</script>` + `&<>"`) appears escaped, never as markup.
6. No forbidden globals: source text of design.ts does not contain `Math.random`, `Date(`, `crypto`, `fetch(`, `process.` (lint-style test, precedent exists in repo tests).
7. Type ramp: 7 steps, strictly increasing px, UI + mono stacks are system-only (no `"font-family: '` web font names).
8. CLI-verb shape (with task-3): files exist, non-empty, tokens.json parses, `$type`/`$value` convention holds.
9. Empty-project floor: `emptyProject` fixture (engine) renders valid tokens/html (no throw, family 0 fallback).
10-12. Module-boundary hygiene: `design.ts` imports only types/algorithms (static assertion via reading its import lines or keeping it dependency-free by construction); `designSpecs` length = 13; `radius` ∈ allowed set.

## 6. Deep spec B — `src/lib/diagram.ts` (gap 08; task-2 of this wave is building it — code against THIS contract)

**Manifest goal being served:** "deterministic standalone SVGs: phase pipeline, architecture by artifacts, gate flowchart — zero deps, XML-safe + ≥10 thorough tests." Consumers this wave: task-3 (CLI `diagram` verb), task-4 (Diagram tab). Follow-wave: mermaid-fence fallback (gap 16), packet embed.

### 6.1 Position & invariants

- Pure module: `src/lib/diagram.ts`, imports `types.ts`, `phases.ts` (`PHASES`), `dod.ts` (`runGate`, `DOD`), `algorithms.ts` (`fnv1a` only if a stable id is needed). **Zero deps.** No React, no DOM, no node APIs.
- **Determinism:** `buildDiagram(project, kind)` is a pure function of project state. No Date/random/ids. Same project → byte-identical SVG string. All geometry derives from content: text width estimated by a constant `charW = 7` at 11px mono / `charW = 6.5` at 12px sans (document the estimator; tests pin wrapping behavior).
- **XML-safety (mandatory, tested):** every string that enters the SVG — titles, purposes, artifact bodies' first lines, brief, phase summaries, rejection notes — passes through one `esc()` (escape `& < > " '`); control chars `\u0000-\u001f` (except `\n`, `\t`) stripped **before** escaping; text nodes never contain raw `]]>`. Attribute values always quoted + escaped. No `foreignObject`, no external refs (`href`/`url(`/`<image`), no scripts, no `style` with `url()`.
- **SVG shape:** root `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H" role="img" font-family="…system stack…">` + `<title>` + `<desc>` (a11y + deterministic); shapes: `<rect rx>` boxes, `<path>`/`<line>` edges with `marker-end` arrowheads defined once in `<defs>`; status colors from a small internal constant table (not from design.ts — diagram.ts must not depend on design.ts this wave; both are pure but independent, and design tokens land on a different cadence).
- **Scale guard:** cap node count & text length — a pathological project renders, never explodes: max 64 boxes per diagram; text truncated with `…` at a per-shape budget; layers wrap. Document the caps in the header.
- **Header honesty:** file header states the module renders *structure deterministically* — "not a substitute for mermaid; agent-authored diagrams render via gap 16."

### 6.2 Borrowed patterns (license-verified 09-06; patterns, not code)

| Source | URL | License | What we take |
|---|---|---|---|
| mermaid-js/mermaid | https://github.com/mermaid-js/mermaid | MIT | flowchart node/edge conventions: rounded rects, `marker-end` arrows, rank direction left→right, title/desc hygiene |
| yuzutech/kroki | https://github.com/yuzutech/kroki | MIT | "diagram as a service" contract: one diagram → one self-contained SVG payload (what the CLI verb mimics file-wise) |
| excalidraw/excalidraw | https://github.com/excalidraw/excalidraw | MIT | SVG packaging: single-pass render, deterministic id-free structure, text-measure + wrap approach |
| dagrejs/dagre | https://github.com/dagrejs/dagre | MIT | layered (ranked) layout pattern for the architecture kind: longest-path rank, order within rank, straight edges between ranks |

### 6.3 Required exports (exact)

```ts
export type DiagramKind = "phase" | "architecture" | "gate";

export type DiagramMeta = { kind: DiagramKind; title: string; width: number; height: number };

// The ONE entry point: deterministic, standalone, XML-safe SVG string.
export function buildDiagram(project: Project, kind: DiagramKind): string;

// Optional-but-recommended: meta without rendering (CLI --json, UI tabs).
export function diagramMeta(project: Project, kind: DiagramKind): DiagramMeta;
```

**Kind semantics (fixed vocabulary — task-2 may add kinds later only by extending the union):**

- **`"phase"`** — the 13-edge governed pipeline (`PHASES`, `phases.ts:3-108`) as a horizontal stepper: one box per phase P0..P12, status-colored from `project.phases[].status` (complete/awaiting_hitl/running/ready/locked/rejected), `gate.passed` badge on completed phases with a recorded gate (`PhaseRecord.gate`, `types.ts:140`), HITL phases (stock `P4/P5/P8/P9`, `phases.ts` `hitl:true`) marked with a dot or ring; arrows Pn→Pn+1 only where `canEnter` holds (always, by construction). Rejected phase gets a red ring + the rejection note as `desc`. Wrap to two rows if width > 1600 (row 2 reverses direction "snake" — document it).
- **`"architecture"`** — layered architecture from **artifacts**: for each phase with artifacts (`project.artifacts` grouped by `phase`, order = artifact order), one column; each box = one artifact (`kind` + truncated title); P6 additionally shows the generated module state (`lastTest.ok`), P8 shows the interface artifact; a spine arrow Pn→Pn+1 between non-empty columns; when `project.specGraph` exists, a second lane below lists file nodes grouped by `owner` (`CrewRole`) with `dependsOn` edges drawn as straight lines between owner-group boxes (dagre layered pattern, ≤ 12 file boxes then "…+N" cap box). Title = project name + domain.
- **`"gate"`** — flowchart of the DoD gate for the **current phase** (`project.currentPhase`): left decision box = each `DOD[phase]` item (`dod.ts:40` registry) evaluated via `runGate` (pure; import from dod.ts) → pass/fail branches; right outcome box = "Advance to P{n+1}" (all pass) or "Blocked — unmet: p6-test, …" (any fail); when `project.hitl` is pending, an HITL diamond ("awaiting human — forceHuman?" per `hitl.forceHuman`) precedes the outcome. Empty DOD for a phase cannot happen (all 13 phases have probes); guard anyway with a single "no criteria" box.

### 6.4 Consumers' exact expectations (wired this wave)

- **CLI `diagram` verb (task-3):** `{ok:true, kind, path, bytes}` — writes `<slug>.<kind>.svg` (default kind `"phase"`; `--kind` flag). Same dynamic-import pattern as `design`/vault (`headless.ts:497-510`). `diagram --json` prints `diagramMeta` without rendering.
- **Diagram tab (task-4):** kind selector (3 tabs or segmented control); `<svg dangerouslySetInnerHTML>` is NOT used — render via `useMemo(() => ({__html: buildDiagram(project, kind)}), …)` inside a wrapper with `dangerouslySetInnerHTML` is acceptable ONLY because output is fully escaped by construction (add a dev-mode test that the string contains no `</svg>` early-termination from content); copy + download buttons use the string directly.
- **Deterministic ids:** none — no `id=` attributes on nodes (or ids derived only from static strings). Arrow markers use a single `defs` marker. This keeps multiple SVGs on one page collision-free (iframe/Design tab coexistence).

### 6.5 Acceptance / DoD for task-2 (≥10 tests; keep typecheck + full suite green)

1. Byte-determinism per kind: two calls on `seedProject` (fixtures) → identical strings.
2. Sensitivity: P6 module source change (or a phase status flip) changes `phase`/`architecture` output but NOT a frozen unrelated fixture's `gate` output (targeted diff).
3. XML-safety fuzz: hostile strings in artifact title/body/brief (`<script>`, `&`, `"`, `'`, `]]>`, `\u0001`) never appear raw in output; output contains no `<script`, no `http://`, no `url(`, balanced `<svg`/`</svg>`.
4. Well-formedness: for all three kinds on a seeded project the output starts `<svg` and ends `</svg>`; contains `viewBox`, `role="img"`, `<title>`, `<desc>`.
5. Phase kind: exactly 13 phase boxes (count `>P0<`-style markers or rect count), status colors match fixture statuses, HITL phases carry the marker.
6. Architecture kind: artifact count matches fixture (≤ cap), specGraph lane present when specGraph set; +N cap box when > 12 files.
7. Gate kind: on a project with unmet P0 (e.g. no scorecard), output contains the unmet probe id (`p0-scorecard`); after full run, contains "Advance".
8. No forbidden globals (source-text lint, as 5.5#6).
9. Import-boundary: diagram.ts imports only from types/phases/dod/algorithms (dependency-free by construction test).
10. Scale guard: synthetic project with 300 artifacts still renders (< 200 KB string, caps applied).
11-12. `diagramMeta` numbers equal the rendered string's `viewBox` W/H; empty/brief-less project renders all three kinds without throw (family fallback).

## 7. Sequencing & ownership (how this wave and the next consume the 20)

| Wave | Gaps | Who | Notes |
|---|---|---|---|
| **THIS wave (live, `deleg_7439ec60`)** | **07** (`design.ts`), **08** (`diagram.ts`), their CLI verbs (task-3), their console tabs (task-4) | tasks 1–5 | §5/§6 are the contracts; task-5's sweep keeps 01–06's target files honest. Do NOT let 07/08 touch engine.ts/types.ts (P8 wiring is next wave) |
| **Wave A (P0, next)** | 01, 02, 03, 04, 05, 06 | one UI agent + one headless agent | 01→02 share `markdown.ts`; 04+05 touch store/headless/dod (do together with task-5 review); all independent of the engine's phase contract |
| **Wave B (P1)** | 09, 10, 11, 12, 13, 14 | UI + headless + one release agent | 12 is the big one (M–L); 09/13 share report-intake; 14 depends on 01's packet render for the print slice |
| **Wave C (P2)** | 15, 16, 17, 18, 19, 20 | follow-wave | 16 → 01 + 08; 19 → 12; 20 → 03's index |

**Cross-doc reconciliation (merge notes):**
- 01–03 = [07 §2.1–2.4, §4#1–4] re-anchored to competitor claims; **07 stays the license/spec authority** — this file adds only the fresh 09-06 API checks in §3.2.
- 04 = [08 E-02] + [06 §6#4]; 05 = [08 E-03] + [10 G2]; 06 = [08 E-01 remainder after M-05/M-08] + [02 §B6/M-08]; 09 = [06 §6#6]; 10 = [06 §6#3]; 11 = [06 §6#5]; 12 = [10 E3/E5/E6, G1/G3/G4] + [08 E-15]; 13 = [08 E-16] + [06 §6#8]; 14 = [07 §2.10, §4#5–6]; 15 = [02 §B4-adjacent] MCP-as-content finding; 16–18 = [07 §2.2/§2.7/§2.5]; 19–20 = [06 §6#10/#14]. Where a sibling doc lists the same item, the sibling id is cited inline and kept authoritative.
- **Status flags recorded this pass (things already landed — do not rebuild):** M-05 store warn fixed (`store.ts:126,574-598`) · M-08 report memory on complete (`report-intake.ts:163-181`) · M-09 autopilot DoD guard (`store.ts:184`) · packet blank-line bug fixed (`packet.ts` tail, "BUG WAVE 27") · headless vault adapter still mirrors old shapes but `vaultSearch`/`searchVault` wiring works ([08 E-04] remains open) · [08 E-02] (headless gate record) remains open → gap 04.

---

## 8. Sources

**Fetched 2026-09-06 (this pass):** https://www.onlook.com/features/ai · https://replit.com/blog/introducing-agent-3-our-most-autonomous-agent-yet · https://vercel.com/blog/v0-app · https://docs.lovable.dev/introduction/welcome · GitHub REST API license checks (25 repos, §3.2) · npm registry (`marked`, `pdfmake`) · raw LICENSE reads (typescript-sdk, community-group).
**Carried from 06 (fetched 2026-09-05, cited `[06]`):** bolt.new / stackblitz/bolt.new · taskade bolt review · docs.lovable.dev/welcome · tempo.new · ycombinator tempo-2 · onlook.com/features/ai + onlook-dev/onlook · code.claude.com/docs (overview/memory/security/agent-sdk) · cursor.com/docs/cloud-agent · docs.github.com copilot cloud-agent · devin.ai · cognition.com · cline.bot + cline/cline · aaif-goose/goose · agpt.co + significant-gravitas/autogpt · warp.dev/ai · obsidian.md · notion.com/product/ai · vercel.com/blog/v0-app.
**Repo URLs (license-verified 09-06):** https://github.com/markedjs/marked · https://github.com/cure53/DOMPurify · https://github.com/shikijs/shiki · https://github.com/highlightjs/highlight.js · https://github.com/lucaong/minisearch · https://github.com/kpdecker/jsdiff · https://github.com/bpampuch/pdfmake · https://github.com/dolanmiu/docx · https://github.com/mermaid-js/mermaid · https://github.com/xyflow/xyflow · https://github.com/xtermjs/xterm.js · https://github.com/argyleink/open-props · https://github.com/radix-ui/colors · https://github.com/radix-ui/themes · https://github.com/shadcn-ui/ui · https://github.com/design-tokens/community-group · https://github.com/excalidraw/excalidraw · https://github.com/yuzutech/kroki · https://github.com/dagrejs/dagre · https://github.com/isomorphic-git/isomorphic-git · https://github.com/tailwindlabs/tailwindcss · https://github.com/modelcontextprotocol/typescript-sdk · https://github.com/vercel/ai.
**In-repo cross-references (read, not modified):** research/multiagent/06_competitor_survey.md · 07_opensource_steal_catalog.md · 08_enhancement_register.md · 09_agent_perfection_audit.md · 10_production_readiness.md · 05_guide_research.md · src/lib/{types,phases,engine,store,dod,packet,report-intake,io,vault,headless,algorithms,sandbox,verify.server,crew.server}.ts · src/components/console.tsx · scripts/rapidtool-cli.mjs · package.json · delegation live logs `deleg_7439ec60/task-1..5.log`.

---

## Appendix A — file:line verification notes (this pass, 00:15–00:35, live-editing wave — re-verify ±5 before patch)

- `types.ts`: Project `:215-261` · HitlRequest `:105-118` · PhaseRecord.gate `:131-141` · SpecNode/SpecGraph `:177-188` · ArtifactKind `:15-31`.
- `phases.ts`: PHASES P0–P12 `:3-108` · `hitl:true` on P4/P5/P8/P9 (`:42,51,74,82`) · canEnter `:118-120`.
- `engine.ts`: inferDomain `:92` · emptyProject `:1049` · P6 `case 6` region `:463-526` · P8 "Interface contract" prose `:570-594` · P9 sketches `:595-639` · runP6Real `:1416-1438` · forceHuman reject-rule `:905-906`.
- `store.ts`: canAutopilot `:178-186` (DoD check `:184`) · recordGate impl `:135`, call `:249` · runModuleReal `:518-561` (drops `out.project`) · ingestReport `:566-570` · rawReportCarriesTests `:126` · M-05 warn `:574-598`.
- `dod.ts`: header determinism contract `:1-14` · registry `:40` · p3-mcp `:80-86` · p6-test `:118-125` · p8-ui/p8-complete `:151-161` · runGate `:224` · readyFor `:257` · gateArtifact `:286`.
- `packet.ts`: PACKET_VERSION `:7` · System JSON gate_passed `:59` · section map `:142-242` · tail join/truncate `:240-262` (bug-wave-27 fix landed).
- `report-intake.ts`: validateReport `:56-124` (tests_run copy status: verify — may still drop at `:120-123`) · applyReport `:126-201` (detail `:138-148`; blocked → rejectionHistory `:152-161`; complete → memory `:163-181`).
- `vault.ts`: VaultNote `:45-56` · buildVaultNotes `:101` · vaultIndex `:334` · searchVault `:376-388`.
- `headless.ts`: atomic write `:51-71` · vault export validation `:497-510` · vaultSearch `:684-690`.
- `console.tsx`: RunTab `:80` · Tabs.Content map `:1427-1537` · packet pane ~`:1470` · spec flat `<ol>` `:1476-1493` · ArtifactPane `:1914` · VaultPane `:2126` · downloads `:790-810` · run-button `:1085-1086`.
- `io.ts`: exportProjectJson `:25` · exportPacketText `:93` · downloadFilename/Ext `:118`.
- `rapidtool-cli.mjs`: verb dispatch `create :108` … `verify :271`; single-JSON contract header `:1-10`.

## Appendix B — merge notes for sibling builders (deleg_7439ec60)

1. **task-1 (design.ts):** §5 is your contract. If you already committed different export names (your recon greps suggest you looked for `designHtml` — matches §5.3), reconcile now; task-3/task-4 will code against §5.3/§5.4. Keep engine.ts/types.ts untouched this wave.
2. **task-2 (diagram.ts):** §6 is your contract. Kinds are fixed: `phase | architecture | gate`. Import `runGate` from `dod.ts` — it is pure and exported (`dod.ts:224`). Do not import `design.ts` (independent cadence); status colors are diagram-local constants.
3. **task-3 (CLI):** verbs `design` and `diagram` per §5.4/§6.4; dynamic-import pattern per `headless.ts:497-510`; do not touch the vault adapter ([08 E-04] is a separate owner). `README-cli.md` update stays in your file set.
4. **task-4 (console):** new tabs extend `RunTab` (`console.tsx:80`) + `Tabs.Content` map (`:1427-1537`); Design tab consumes `designSpecs`/`designCss`/`designHtml`; Diagram tab consumes `buildDiagram`/`diagramMeta`; a11y: tabs keep `aria-label` (`:1385`), color swatches need text labels (never color-only).
5. **task-5 (bug sweep):** your file set includes store.ts/packet.ts/report-intake.ts — note 01–06's target lines above; bug-wave-27 fixes are landed, don't regress them (packet tail, store warn). `packet.test.ts` expects the new blank-line layout.
6. **All:** source is live-editing — re-read before patch, run the FULL mandated test command (package.json `test` includes every `src/lib/*.test.ts` + `scripts/*.test.mjs`; the suite now includes `vault.test.ts`, `design.test.ts`, `diagram.test.ts` once they land) and `npm run typecheck`; leave `npm run build` green. Live corrections accumulate in `research/multiagent/11_live_fixes.md`.
