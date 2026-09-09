# 07 — Open-Source Steal Catalog: license-verified, wire-in candidates for RapidTool

- **File:** `research/multiagent/07_opensource_steal_catalog.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`)
- **Date / agent:** 2026-09-05 · Flash research agent #2 (OPEN-SOURCE STEAL CATALOG; strictly read-only on source — the ONLY file written this pass is this one)
- **Question:** which concrete open-source repos/libs should RapidTool wire in (npm-installable or vendor-able) to beat its competitors — each with a **verified license**, exact **integration point** in this codebase, and a **no-dep alternative** where one exists?
- **Scope guard (read first):** RapidTool already ships zod 4.4 (with native JSON-Schema generation), a zustand store, TanStack Start/Router/Query/Table, React 19.2, Tailwind v4, the full Radix kit, recharts, cmdk, vaul, sonner, gpt-tokenizer, better-auth, kysely + pglite + pg. **Anything redundant with that stack is marked SKIP below, not recommended.** Local claims are file:line-verified this pass; prior-adjacent research: `research/multiagent/02_capability_audit.md` (code-level gaps M-01..M-12), `01_open_source_harnesses.md` (harness landscape).
- **License-verification method (all claims dated 2026-09-05):** GitHub REST API (`api.github.com/repos/<owner>/<repo>` → `license.spdx_id`, `stargazers_count`, `pushed_at`, `archived`) for every repo; raw LICENSE text read for the three repos GitHub's detector flags NOASSERTION (marked, vercel/ai, pdfmake); npm registry `license` field checked where package-vs-repo nuance mattered. Only MIT / Apache-2.0 / BSD-* accepted; anything else is flagged in place.

---

## TL;DR — top 10 steals (details + rationale in §3 and §4)

| # | Repo | License (verified) | Verdict | What it buys | Effort |
|---|------|--------------------|---------|--------------|--------|
| 1 | marked + DOMPurify | MIT + Apache-2.0 | **STEAL-NOW** | Packet & artifacts render as real markdown (today they are raw `<pre>`, `console.tsx:1470-1474`) | S |
| 2 | shiki | MIT | **STEAL-NOW** | TextMate-grade code highlighting, server-side (SSR), no CLS | S–M |
| 3 | minisearch | MIT | **STEAL-NOW** | Upgrades vault/artifact substring search (`vault.ts:376-392`) to fuzzy FTS | S |
| 4 | jsdiff | BSD-3-Clause | **STEAL-NOW** | Unified diffs for HITL patch review + P6 code-variant flips | S |
| 5 | pdfmake | MIT | STEAL-LATER | Packet/run export to real PDF (print-CSS is the zero-dep first step) | M |
| 6 | docx | MIT | STEAL-LATER | .docx export companion (same export pipeline) | S |
| 7 | mermaid | MIT | STEAL-LATER | Diagram rendering of spec/phase graphs & agent artifacts (lazy-load only) | M |
| 8 | xyflow (React Flow) | MIT | STEAL-LATER | Node-edge viz of specGraph/phases to replace the flat `<ol>` spec tab | M |
| 9 | xterm.js | MIT | STEAL-LATER | Live terminal for bounded run output — blocked on a server push channel | L |
| 10 | esbuild-wasm / vercel AI SDK / mem0 / Letta | MIT / Apache-2.0 / Apache-2.0 / Apache-2.0 | **SKIP for now — watchlist** | Capabilities RapidTool's architecture already covers differently; steal patterns, not deps | — |

---

## 1. Ground truth: what RapidTool already has (so we never recommend redundancy)

Verified against `package.json` and the tree, 2026-09-05:

- **Framework:** TanStack Start 1.168 + Vite 8 + nitro (server functions live in `src/lib/*.server.ts`), React 19.2.
- **State/validation:** zustand 5 (`src/lib/store.ts`), zod 4.4.0 — **and zod 4.4 ships a native JSON-Schema generator**: `toJSONSchema` is exported from `zod/v4/core` (`node_modules/zod/v4/core/index.d.cts:17`, `json-schema-generator.d.cts` present; NOT re-exported from the root `zod` entry in this version). Any "send the contract as JSON Schema to the model" need is already covered locally.
- **UI kit:** full Radix set, cmdk (command menu), vaul, sonner, react-resizable-panels, recharts (charting!), lucide, tailwind v4 — a shadcn-level component base already exists; `console.tsx` builds the whole HITL dock on it.
- **Persistence/auth:** better-auth + jose, kysely, `pg`, and `@electric-sql/pglite` (browser Postgres) — so "add a memory store" does NOT require a new database technology.
- **Rendering reality today:** the Packet tab prints raw packet text in a `<pre>` (`console.tsx:1470-1474`); artifacts render as plain/preformatted text (`ArtifactPane`, `console.tsx:1915+`); the spec graph is a flat ordered list (`console.tsx:1476-1500`); downloads are raw `.json` / `.md` blobs (`console.tsx:791-810`, `exportProjectJson`/`exportPacketText`/`downloadFilename` in `src/lib/io.ts:25/93/118`). **No markdown renderer, no highlighter, no diff view, no diagram renderer, no search index exist anywhere in src** (grep-verified).
- **Search today:** `searchVault` is case-insensitive **substring** scoring over title(4)/tag(2)/body(1) (`src/lib/vault.ts:376-392`); ⌘/ focuses artifact search (`console.tsx:269,537`).
- **Execution:** bounded local Node runner (`node-runner.server.ts`, surfaced as "Run module (bounded)", `console.tsx:1086`); worker-isolate sandbox exists but is unused by product flows (audit 02 §B4).
- **Memory:** a browser-local, taggable **vault** of notes with MOC + tag-cloud markdown export (`vault.ts:340-375`) already implements the *idea* of agent memory.

**Consequence:** the catalog below targets genuine gaps: rendering quality (markdown/highlight/diff/diagram), search quality, export formats, and live-output surfaces — not new state layers, chart libs, or validation stacks.

---

## 2. Catalog (license-verified 2026-09-05, GitHub API unless noted)

### 2.1 Markdown rendering

**marked — https://github.com/markedjs/marked — VERDICT: STEAL-NOW (chosen renderer)**
- License: **MIT** (npm registry `license: MIT`, 0 runtime deps). ⚠️ Flag: the repo's LICENSE file is a *Contribution License Agreement* (raw LICENSE read; GitHub detector: NOASSERTION) — the distributed npm package `marked@latest` declares MIT, which is what you consume; keep the CLA nuance in the vendor notes.
- Signals: 37.1k★, pushed 2026-09-05, 22 open issues. Extremely active.
- Integration point: render `project.packet` (packet tab `<pre>`, `console.tsx:1470-1474`) and markdown-shaped artifact bodies (`ArtifactPane`, `console.tsx:1915+`) through `marked.parse()` with GFM on, output sanitized (see DOMPurify), inside a `prose`-style CSS container; the raw-text download path (`io.ts:93 exportPacketText`) stays untouched. Server components can pre-render to HTML in TanStack Start; client-side render for live artifact updates.
- Why better than competitors: zero-dep, GFM built-in, tiny (≈35 KB min), and the same `.md` bytes RapidTool already downloads (`downloadFilename(...,"md")`) become *readable* in-app — tables/headers/code in packets are currently undifferentiated monospace.
- No-dep alternative: none credible for GFM (hand-rolled regex markdown is a correctness/security liability — say so in review). If zero new deps is a hard gate, render only bold/links/code spans via a 60-line safe subset and keep the rest raw.
- Companion (required for client-side HTML): **DOMPurify — https://github.com/cure53/DOMPurify — Apache-2.0**, 17.4k★, pushed 2026-09-05, 1 open issue. Sanitize before `dangerouslySetInnerHTML` (the only current use, `__root.tsx:46`, is a static theme script — do not copy that pattern for artifact HTML without DOMPurify).
- Optional pattern (not a steal): `@tailwindcss/typography` (`prose` classes) — MIT, part of the tailwindlabs/tailwindcss monorepo (verified MIT, 97.5k★, pushed 2026-09-02) — only if the artifact HTML needs typographic styling beyond what `styles.css` already does.

**markdown-it — https://github.com/markdown-it/markdown-it — VERDICT: STEAL-LATER (equivalent alternative)**
- License: MIT. Signals: 21.9k★, pushed 2026-08-27, 8 open issues. Default preset already covers tables/strikethrough; brings 5 tiny deps (linkify-it, mdurl, uc.micro, entities, punycode.js).
- Choose it over marked **only** if the plugin ecosystem is needed (e.g. `markdown-it-attrs`, typographer, custom containers for phase/code artifacts). Recommendation: start with marked (zero deps); swap costs ~1 hour behind one `renderMarkdown()` module.

**remark / unified — https://github.com/remarkjs/remark (MIT, 9.0k★, pushed 2026-09-01) · https://github.com/unifiedjs/unified (MIT, 5.0k★, pushed 2026-04-29) — VERDICT: SKIP for now**
- The AST/plugin pipeline is overkill for display rendering and pulls a dozen+ packages. Revisit only if RapidTool needs markdown *transforms* (linting agent output, MDX, custom artifact ASTs). No integration point exists today.

### 2.2 Diagrams

**mermaid — https://github.com/mermaid-js/mermaid — VERDICT: STEAL-LATER**
- License: MIT. Signals: 90.1k★, pushed 2026-09-04, 22 npm deps — heavy (hundreds of KB rendered; 1.7k open issues is ecosystem noise at this scale).
- Integration point: lazy `import()` in the spec/phase tab and any artifact whose body contains a ```mermaid fence (detected during markdown render, §2.1). Candidate views: spec-graph dependency order (`algorithms.ts:326-374` per audit 02), crew table, phase flow. **Never** statically bundle — main-bundle bloat is the failure mode; code-split behind the tab.
- Why better: instantly turns the deterministic spec/phase graph into a visual the HITL reviewer and the pasted-into-agent packet both benefit from; competitors (raw agent consoles) show none of this.
- No-dep alternative: for the linear 13-phase flow (`phases.ts` graph), a ~40-line inline SVG/div stepper already matches the app's design language; mermaid pays off for *agent-authored* diagrams in artifacts, not for the fixed phase rail.

**flowchart.js — https://github.com/adrai/flowchart.js — VERDICT: SKIP (superseded)**
- License: MIT. Signals: 8.7k★ but pushed 2026-01-15 and 104 open issues; raphael-based, Canvas/SVG quirks, anemic grammar vs mermaid. If mermaid's weight is unacceptable, a hand-rolled stepper beats flowchart.js.

### 2.3 Client-side search

**minisearch — https://github.com/lucaong/minisearch — VERDICT: STEAL-NOW**
- License: MIT. Signals: 6.1k★, pushed 2025-09-16 (≈1 year quiet — but feature-complete and stable, 13 open issues; low churn here is maturity, not abandonment — it is the standard pick for docs sites).
- Integration point: replace the substring scorer in `searchVault` (`vault.ts:376-392`) with a MiniSearch instance over `title/body/tags` (prefix + fuzzy, ~10 KB); second instance over artifacts (title+body) to feed the existing ⌘/ artifact search (`console.tsx:269,537`). Both stay synchronous and in-memory — vault + current project artifacts are already fully client-side.
- Why better: "phase 5" will no longer miss "phase 5 gate" — substring search returns nothing for plural/prefix variants; fuzzy FTS with ranking is the single biggest search-quality win available for ~1 file of wiring. Competitors' consoles have filter boxes; RapidTool can have real retrieval over its own paper trail (vault + ledger + artifacts).
- No-dep alternative: extend the existing scorer with a small trigram/prefix index (~120 lines, `vault.ts` already centralizes scoring) — fine if the dep budget is zero; you lose ranking quality and stemming.
- **flexsearch — https://github.com/nextapps-de/flexsearch — VERDICT: SKIP (if minisearch is taken)**: Apache-2.0 (allowed), 13.8k★, pushed 2026-06-28, historically erratic maintenance windows and a heavier API; outperforms MiniSearch only at corpora far larger than RapidTool's browser-local vault. Do not carry two search libs.
- **fzf-for-js — https://github.com/ajitid/fzf-for-js — VERDICT: SKIP (redundant)**: BSD-3-Clause (allowed), 954★, pushed 2025-04-14. The fuzzy-picker UX it enables is already covered by **cmdk** (installed; ⌘/ focus, `console.tsx:269`). **junegunn/fzf — https://github.com/junegunn/fzf — MIT, 82.8k★** is a native Go binary and cannot be wired into the browser; its UX pattern is what cmdk already provides. Both SKIP on redundancy, not license.

### 2.4 Code highlighting

**shiki — https://github.com/shikijs/shiki — VERDICT: STEAL-NOW**
- License: MIT. Signals: 13.8k★, pushed 2026-08-10, 115 open issues.
- Integration point: highlight fenced code inside the §2.1 markdown pipeline AND existing raw `<pre>` code blocks (packet tab `console.tsx:1470-1474`, artifact panes). Because TanStack Start server-renders, run `createHighlighter` with a curated language subset **on the server** during render → ships plain highlighted HTML, zero client JS, zero CLS; client bundle impact ≈ 0. (Note: shiki's engine loads an oniguruma WASM asset — fine server-side and via Vite asset handling; if WASM is a hard no, see highlight.js.)
- Why better: TextMate-grammar fidelity beats highlight.js/prism for real code artifacts (the whole product is about agent-written code); themes match dark/light via the existing `data-theme` switch (`__root.tsx:44-47`).
- No-dep alternative: none with real grammar coverage — plain mono text is the current state; a <30-line tokenizer for one or two languages is not worth it next to shiki's server-side zero-bundle cost.

**highlight.js — https://github.com/highlightjs/highlight.js — VERDICT: STEAL-LATER (shiki's lighter sibling)**
- License: **BSD-3-Clause** (allowed). Signals: 25.0k★, pushed 2026-08-30. Single-file core, no WASM, easy subset builds. Choose it if the WASM dependency or shiki's grammar-package sprawl bothers the build — quality is a half-step below shiki and auto-detection is weaker; the swap is contained inside the same `highlight()` module.
- **PrismJS/prism — https://github.com/PrismJS/prism — VERDICT: SKIP**: MIT, 13.0k★, pushed 2026-06-29, 487 open issues; manual init/DOM-walk patterns, no SSR story, lowest fidelity of the three. Nothing Prism does is missing from the two above.

### 2.5 Terminal in browser

**xterm.js — https://github.com/xtermjs/xterm.js — VERDICT: STEAL-LATER (prerequisite missing)**
- License: MIT. Signals: 21.1k★, pushed 2026-09-05; `xterm` npm package: MIT, 0 deps (addons like `@xterm/addon-fit` are separate MIT packages).
- Integration point: a "Live run" surface for the bounded Node runner (`node-runner.server.ts`; "Run module (bounded)" button `console.tsx:1086`, runner entries `store.ts:452-488` per audit 02 §A6). Today run output is captured and returned request/response; xterm only pays off once a **server→client push channel** (SSE/WebSocket) streams stdout live, which the engine's phase-locked, non-streaming calls (`engine.ts` phase advance) do not provide yet.
- Why it would beat competitors: live subprocess I/O for agent-built code is a flagship demo (think CodeSandbox-in-a-governed-run). Cost is real: add push plumbing + xterm UI + fit/resize handling.
- No-dep alternative: monospace `<pre>` tail-refresh (the current artifact pattern) covers 80% of review needs with none of the protocol work — ship that first if live output matters.

### 2.6 Agent memory (licenses verified — both allowed, both SKIP on weight/architecture)

- **mem0 — https://github.com/mem0ai/mem0 — Apache-2.0**, 64.8k★, pushed 2026-09-04. Python SDK + optional OpenMemory server (MongoDB). **VERDICT: SKIP (as a dependency)** — license is clean, but wiring mem0 means a separate Python service + auth surface + HTTP contract, while RapidTool's memory model is deliberately *stateless handoffs + deterministic packet* (audit 02 §A2-A3) plus a browser-local vault (`vault.ts`). **Steal the pattern, not the package**: extract decision summaries from the existing append-only ledger (`engine.ts:973-1016`, audit 02 §A5) into vault notes — zero new deps, same outcome class (cross-run agent memory).
- **Letta (MemGPT) — https://github.com/letta-ai/letta — Apache-2.0**, 24.6k★, pushed 2026-08-23. Self-hosted agent-memory server (FastAPI + Postgres). **VERDICT: SKIP for now, STEAL-LATER only if persistent agent personas become a product goal** — and even then prefer pglite + kysely tables (both already installed) over a second service. Not AGPL, so the door stays open; nothing in the current 13-phase stateless design needs it.

### 2.7 Task / graph visualization

**xyflow (React Flow) — https://github.com/xyflow/xyflow — VERDICT: STEAL-LATER**
- License: MIT. Signals: 38.3k★, pushed 2026-09-05, 132 open issues (rename note: the old `reactflow` package is deprecated; use `@xyflow/react` v12+, which supports React 19).
- Integration point: replace/augment the spec-graph flat `<ol>` (`console.tsx:1476-1500`) with an interactive node-edge view of `project.specGraph` (dependency order + owners) and optionally the 13-phase graph (`phases.ts` edges per audit 02 §A1). Lazy-import behind the tab like mermaid; recharts (installed) covers data charts, xyflow covers *graph* drawing — different need, no overlap.
- Why better: reviewers and agents get the typed dependency structure at a glance instead of scrolling the packet; node owners/files/DoD state can live on nodes (data is already structured: `specGraph.nodes`, per audit 02 §A2).
- No-dep alternative: an SVG/div node layout for ≤15 nodes is a day of work and loses pan/zoom/auto-layout; xyflow is the better buy if graph viz ships at all.
- Cost/vetting: bundle ≈ 40-50 KB gz lazy-loaded; v12 React-19 compat is current — verify at install, then it's a contained component.

### 2.8 Tool-production helpers (in-browser bundling / esbuild)

**esbuild — https://github.com/evanw/esbuild — VERDICT: SKIP (for in-browser bundling), STEAL-LATER (as a product feature)**
- License: MIT. Signals: 40.0k★, pushed 2026-08-09, 619 open issues. Native-package note: esbuild installs **prebuilt** platform binaries via optionalDependencies (Windows included — no toolchain needed), so the "no native deps" constraint is not violated by esbuild itself; the constraint bites only for *in-browser* use, which requires **esbuild-wasm** (≈2 MB WASM, 3-10× slower).
- Integration point today: none — RapidTool executes agent code in the bounded server runner (`node-runner.server.ts`) and bundles its own UI with Vite. A browser-side bundler only becomes real if a feature ships "open this agent-built project as a live sandboxed app in the preview iframe" — at that point esbuild-wasm in a Web Worker is the candidate (MIT, no server round-trip per edit).
- Honest verdict: SKIP now — it solves a problem the current architecture routes through the server; revisit when/if the preview becomes a compile-in-browser surface. No-dep alternative for the *current* design: none needed (server runner already exists).

### 2.9 Structured LLM output

**zod native JSON Schema — VERDICT: already won, do not add anything**
- Verified locally: zod 4.4.0 ships `toJSONSchema` (exported from `zod/v4/core`, `node_modules/zod/v4/core/index.d.cts:17`). RapidTool already zod-validates every engine boundary; when a provider needs JSON Schema (tool defs, structured-output mode for DeepSeek et al.), use the native generator behind `src/lib/llm.ts`'s existing schema plumbing.
- **zod-to-json-schema — https://github.com/StefanTerdell/zod-to-json-schema — VERDICT: SKIP (redundant + archived)**: ISC license, 1.25k★, **archived=true** per GitHub API (2026-03-27). Do not install an archived ISC package for capability the installed zod already exports.

**Vercel AI SDK — https://github.com/vercel/ai — VERDICT: SKIP as a dependency; STEAL-LATER as patterns**
- License: **Apache-2.0** (raw LICENSE read: "Copyright 2023 Vercel, Inc. Licensed under the Apache License, Version 2.0"; GitHub detector NOASSERTION due to formatting; npm `ai` package: Apache-2.0). Signals: 26.6k★, pushed 2026-09-05.
- Integration: RapidTool has its own LLM layer (`llm.ts`, `deepseek.server.ts`, crew orchestration, zod-validated contract, honest `{ok:false}` results — audit 02 §A6). Bolting in the AI SDK's provider/stream abstraction would mean a contract migration for no user-visible win. **Steal the patterns**: (a) message/tool-call UI rendering conventions for the future agent-chat surface; (b) when live token streaming lands, *then* evaluate the AI SDK (or a thin SSE wrapper) against `engine.ts`'s phase calls — audit 02 M-list already flags streaming-adjacent gaps, but that is a redesign decision, not a catalog steal.

### 2.10 PDF / DOCX export

**pdfmake — https://github.com/bpampuch/pdfmake — VERDICT: STEAL-LATER (primary export target)**
- License: **MIT** (raw LICENSE read: "The MIT License (MIT) Copyright (c) 2014-2015 bpampuch, 2016-2026 liborm85"; GitHub detector NOASSERTION because fonts are bundled in-file; npm `pdfmake`: MIT, 3 deps). Signals: 12.3k★, pushed 2026-06-12, 237 open issues. ⚠️ Bundle note: pulls pdfkit + bundled Roboto fonts (Apache-2.0-licensed fonts — fine to ship, but it is the heaviest export option; code-split it).
- Integration point: extend the existing download menu (`console.tsx:791-810`, `io.ts:25/93`) with "Download packet as PDF" — the document-definition model maps 1:1 onto the packet's structured sections (status table, decision ledger, per-phase gates, files/patch/tests). Also enables *batch* export of a whole project paper trail (new `exportPacketPdf` in `io.ts`, same shape as `exportPacketText`).
- Why better: competitors hand you markdown; shipping the governed paper trail as a polished PDF is a "enterprise deliverable" move consistent with the DoD/gate philosophy.
- No-dep alternative (ship first): a print stylesheet (`@media print`) + `window.print()` renders the existing DOM to PDF with zero deps and covers ~80% of the ask; pdfmake's edge is server-side/offline/batch export and pixel control. **Recommendation: print-CSS now (S), pdfmake when export becomes a pipeline (M).**
- **pdf-lib — https://github.com/Hopding/pdf-lib — VERDICT: STEAL-LATER (lower priority)**: MIT, 8.6k★, but pushed **2024-07-17** (≈2 years quiet — maintenance flag) and 316 open issues; lower-level API (you draw every glyph run). Only pick it over pdfmake if dependency weight is critical and hand-drawn layout is acceptable.

**docx — https://github.com/dolanmiu/docx — VERDICT: STEAL-LATER**
- License: MIT. Signals: 5.9k★, pushed 2026-08-07, 161 open issues. Integration point: same export menu — "Download packet as .docx" for stakeholders who live in Word; `docx` builds a real OOXML document from a declarative tree (tables for phase/gate evidence). Only worth it once the §2.10 export pipeline exists (share the menu + filename logic: `downloadFilename(project, ext)` in `io.ts:118` needs its `Ext` union widened from `"json" | "md"`).

### 2.11 Chat / agent UI components

- **shadcn/ui — https://github.com/shadcn-ui/ui — MIT, 123.1k★, pushed 2026-09-04 — VERDICT: SKIP (as a package), steal patterns on demand.** RapidTool already owns the equivalent base: Radix kit + cva + clsx + tailwind-merge are all installed and `console.tsx` already composes HITL dock, tabs, dialogs, command menu. Copying an MIT component *pattern* (e.g. chat-bubble layout, tool-call cards) into `src/components` is always legal and cheap; adding the shadcn CLI/build chain to this repo buys nothing.
- AI-SDK chat UI (Vercel, Apache-2.0, see §2.9): same pattern-steal rule once a chat surface exists; the heavy lifting here is engine integration (phases/HITL), which is RapidTool's differentiator and must stay in-house.

---

## 3. Verdict roll-up (all licenses verified 2026-09-05)

| Repo | License | Stars | Last push | Verdict |
|------|---------|-------|-----------|---------|
| markedjs/marked | MIT (npm; repo file = CLA ⚠️) | 37.1k | 2026-09-05 | **STEAL-NOW** |
| cure53/DOMPurify | Apache-2.0 | 17.4k | 2026-09-05 | **STEAL-NOW** (companion) |
| shikijs/shiki | MIT | 13.8k | 2026-08-10 | **STEAL-NOW** |
| highlightjs/highlight.js | BSD-3-Clause | 25.0k | 2026-08-30 | STEAL-LATER (shiki-lite) |
| lucaong/minisearch | MIT | 6.1k | 2025-09-16 | **STEAL-NOW** |
| kpdecker/jsdiff | BSD-3-Clause | 9.2k | 2026-08-24 | **STEAL-NOW** |
| bpampuch/pdfmake | MIT (text read) | 12.3k | 2026-06-12 | STEAL-LATER |
| Hopding/pdf-lib | MIT | 8.6k | 2024-07-17 ⚠️ | STEAL-LATER (low) |
| dolanmiu/docx | MIT | 5.9k | 2026-08-07 | STEAL-LATER |
| mermaid-js/mermaid | MIT | 90.1k | 2026-09-04 | STEAL-LATER (lazy) |
| xyflow/xyflow | MIT | 38.3k | 2026-09-05 | STEAL-LATER |
| xtermjs/xterm.js | MIT | 21.1k | 2026-09-05 | STEAL-LATER (needs push channel) |
| markdown-it/markdown-it | MIT | 21.9k | 2026-08-27 | STEAL-LATER (alt to marked) |
| mem0ai/mem0 | Apache-2.0 | 64.8k | 2026-09-04 | SKIP (Python service; steal pattern) |
| letta-ai/letta | Apache-2.0 | 24.6k | 2026-08-23 | SKIP for now (watchlist) |
| evanw/esbuild | MIT | 40.0k | 2026-08-09 | SKIP (feature-gated) |
| vercel/ai | Apache-2.0 (text read) | 26.6k | 2026-09-05 | SKIP as dep; steal patterns |
| StefanTerdell/zod-to-json-schema | ISC | 1.3k | archived 2026-03-27 | SKIP (redundant/archived) |
| nextapps-de/flexsearch | Apache-2.0 | 13.8k | 2026-06-28 | SKIP (minisearch wins) |
| ajitid/fzf-for-js | BSD-3-Clause | 954 | 2025-04-14 | SKIP (cmdk covers) |
| junegunn/fzf | MIT | 82.8k | 2026-09-06 | SKIP (native binary, not browser) |
| remarkjs/remark · unifiedjs/unified | MIT | 9.0k/5.0k | 2026-09-01 / 2026-04-29 | SKIP for now |
| adrai/flowchart.js | MIT | 8.7k | 2026-01-15 | SKIP (superseded) |
| PrismJS/prism | MIT | 13.0k | 2026-06-29 | SKIP |
| shadcn-ui/ui | MIT | 123.1k | 2026-09-04 | SKIP as pkg; pattern-steal |
| tailwindlabs/tailwindcss (typography plugin source) | MIT | 97.5k | 2026-09-02 | optional pattern |

**License hygiene:** every STEAL-NOW/STEAL-LATER pick above is MIT, Apache-2.0, or BSD-3-Clause. Zero GPL/AGPL/SSPL/unknown entries recommended. Only caveats: marked's repo LICENSE is a CLA (npm package declares MIT — consume the package); pdfmake bundles Apache-2.0 Roboto fonts; shiki pulls an oniguruma WASM engine asset (server-side use avoids client cost).

---

## 4. Prioritized integration plan (top 10, effort estimates)

Effort: **S** ≤ half a day · **M** ≤ 2 days · **L** > 2 days. Order maximizes user-visible quality per unit of risk; steps 1-4 are one shared "rendering pass" and share a review.

1. **Markdown rendering of packet + artifacts — marked + DOMPurify (S).** New `src/lib/markdown.ts` (`renderMarkdown()`: marked.parse → DOMPurify.sanitize → HTML); swap the packet tab `<pre>` (`console.tsx:1470-1474`) and artifact bodies (`ArtifactPane`) to it; keep `.md` downloads raw. Replaces monospace walls with readable gates/ledgers — the single highest daily-visibility win.
2. **Syntax highlighting — shiki, server-side (S-M).** Highlight fenced code inside step 1 + existing `<pre>` code blocks; curated language subset (ts/js/json/md/bash/sql/css/html + agent outputs); render during SSR via a cached `createHighlighter`; theme pair follows `data-theme` (`__root.tsx:44-47`).
3. **Fuzzy full-text search — minisearch (S).** Two indexes in `src/lib/vault.ts`: vault notes (title/body/tags, replacing `searchVault` substring scorer `vault.ts:376-392`) and artifacts for ⌘/ (`console.tsx:269,537`). No backend change — everything is already client-side.
4. **Diff views — jsdiff (S).** Show unified diff between P6 code variants (variant flips at `engine.ts:469-470`, audit 02 §A5) and between agent patch and prior file state in the HITL artifact pane; new `DiffView` component in `src/components/`.
5. **Print-CSS PDF (zero-dep) now, pdfmake later (S then M).** Add `@media print` styles + print button (S, no deps). Then, if export demand materializes, `exportPacketPdf` via pdfmake in `io.ts` alongside `exportPacketText` (`io.ts:93`); widen `downloadFilename`'s `Ext` (`io.ts:118`) for `"pdf"`/`"docx"`.
6. **DOCX export — docx (S once export pipeline exists).** Same menu; declarative tables for phase status/DoD/ledger. Do together with #5's pdfmake pass to touch `io.ts` once.
7. **Diagram rendering — mermaid, lazy (M).** Dynamic import in spec/phase tab + `mermaid` fence rendering inside step 1's markdown output (detect fence → placeholder → render on mount). Never in the main bundle. Static 13-phase stepper can ship earlier as the no-dep slice.
8. **Graph visualization — @xyflow/react (M).** Interactive specGraph view replacing the flat `<ol>` (`console.tsx:1476-1500`); node = file+owner+DoD state, edges = dependency order from `project.specGraph`. Lazy-loaded tab; verify React-19 peer support at install (current v12 supports it).
9. **Live run terminal — xterm.js (L, two-phase).** Phase A: streaming pass — SSE/WS channel from `node-runner.server.ts` so "Run module (bounded)" (`console.tsx:1086`) can tail output (this is the real cost; also unblocks token-streaming later). Phase B: xterm surface with fit addon. Until Phase A exists, xterm is decoration — keep the `<pre>` tail.
10. **Watchlist (do NOT build now):** esbuild-wasm (only if in-browser bundling of agent projects becomes a feature), vercel AI SDK (only if/when a chat surface + streaming redesign is approved — patterns first), mem0/Letta patterns (fold ledger decisions into vault notes instead — S, no deps), zod native `toJSONSchema` (free, use it when a provider needs JSON Schema — do not add zod-to-json-schema, archived).

**Dependency map:** 1 → 2 (highlights inside markdown), 1 → 7 (mermaid fences), 5 → 6 (shared export menu/io changes), 9A → 9B (push channel before terminal UI). Steps 1-4 are independent of each other and of the engine — pure UI-layer steals, zero risk to the phase/gate contract; steps 5-8 are additive UI; step 9 touches server plumbing and should be scheduled with the streaming work from audit 02.
