# 05 — Guide Research: 2nd-Brain Patterns, Steal-Later Libraries, Agent-CLI UX

**Author:** Flash agent #1 (web research + live guide)
**Date:** 2026-09-05 · **Delegation:** `deleg_4c58ec82`
**Scope:** Cited survey feeding 4 sibling builders (vault module / headless CLI / console UI / QA sweep). Read-only on `src/` — recommendations only.

Sibling map: **Agent-B** task-1 `src/lib/vault.ts` + tests · **Agent-C** task-2 `headless.ts` + `rapidtool-cli.mjs` + README-cli.md · **Agent-D** task-3 `console.tsx` Vault tab · **Agent-E** task-4 QA sweep.

---

## 0. TL;DR (read this first)

1. **The vault contract already maps 1:1 onto Obsidian's core loop.** `vaultIndex(notes)` ≈ Map-of-Content hub; `searchVault` ≈ backlinks + tag index; `buildVaultNotes(project)` should emit **one atomic note per memory row / artifact** (Zettelkasten atomicity), grouped by **kind ≈ type of note**, and MOC = phase/kind index. RapidTool's `MemoryEntry.kind` (`episodic|semantic|procedural`) is a ready-made note taxonomy — do NOT invent a second one.
2. **Zero new deps this wave is the right call and nothing is lost:** the vault's only real "library" needs are (a) a tokenizer — **`algorithms.ts` already exports `tokenizeWords`/`stemToken`/`fnv1a`, reuse them** for search + IDs; (b) `[[wikilink]]`/tag extraction — a ~15-line regex each, well-specified below. Candidate npm libs (FlexSearch, markdown-it, FTS5-via-`node:sqlite`) are documented for a later wave with exact wiring points.
3. **Agent-CLI UX: RapidTool's existing contract is already best-practice** (single JSON object on stdout, non-zero exit on error, `ok:true/false`, `--project` file arg, no prompts). The four Arcjet rules it must NOT regress: JSON→stdout only, errors parseable, defaults that change on non-TTY, and stable field names across subcommands.
4. **The vault must be pure + deterministic** (no network, no LLM, no `Date.now()` in outputs): it runs in the headless CLI under bare Node where nothing else exists, and deterministic output is what makes tests (and agent reuse) trustworthy.

---

## 1. What to steal — table

| # | Idea | Source (URL) | Concrete mapping into RapidTool files |
|---|------|--------------|----------------------------------------|
| S1 | **Wikilinks** `[[Note]]`, aliases `[[Note\|Display]]`, heading links `[[Note#h]]` | https://obsidian.md/help/links | `vault.ts`: regex-extract `\[\[([^\]\|#]+)(?:#[^\]]*)?(?:\|[^\]]*)?\]\]` from every note body → link graph. `vaultMarkdown` emits `[[note-id]]`; UI tab renders resolved links (dangling links shown as dead, like Obsidian's unresolved-link style). |
| S2 | **Backlinks panel** (notes linking to this note) | https://obsidian.md/help/links (backlinks section) + https://obsidian.md/help/plugins/graph | `searchVault(id)` / `vaultIndex`: invert the link graph → "linked from" list per note. UI tab: backlinks section under each note (Obsidian renders them bottom-left of a note). |
| S3 | **YAML frontmatter** properties (tags, aliases, dates, links) | https://obsidian.md/help/properties | Note body header block `---\nid, title, kind, phase, tags, score, created\n---` so exported `.md` vault is importable by Obsidian/logseq later; tags property + inline `#tag` both supported (S5). |
| S4 | **Atomic notes** (one idea per note) | https://zettelkasten.de/atomicity/guide/ | `buildVaultNotes(project)`: one `VaultNote` per `project.memory` row (memory rows already are atomic — see §2.2) and one per artifact whose body fits; **do not** concatenate a phase's whole output into a single note. |
| S5 | **Tags as an axis orthogonal to links** (folders ≠ structure) | https://forum.obsidian.md/t/a-guide-on-links-vs-tags-in-obsidian/28231 | `vaultIndex(notes)` returns a `tags` map `tag → noteIds[]`; derive tags from memory kinds + artifact kinds + phase codes (`episodic`, `semantic`, `procedural`, `gate`, `research`, `P0`…). UI: tag chips filter. |
| S6 | **MOC — Map of Content** hub notes that link to clusters | https://forum.obsidian.md/t/best-practices-to-start-with-obsedian-zettelkasten/11499 ; https://yordi.me/personal-knowledge-management-with-zettelkasten-and-obsidian/ | `vaultIndex(notes)`: return `{ mocs, byKind, byTag, links }`; vault markdown begins with a `## Map of Content` hub + per-kind MOC sections, each row a `[[wikilink]]`. UI tab shows MOC as the default landing list. |
| S7 | **Daily notes / journal as capture inbox** | https://obsidian.md/help/plugins/daily-notes | RapidTool analog is the phase-by-phase run: note `id` prefix `P{phase}-{n}` and `created` = artifact/memory timestamp gives a chronological spine without a daily-note file. Document in README, skip a separate daily-notes feature. |
| S8 | **FusionRank retrieval rather than graph-only browsing** | in-repo: `src/lib/algorithms.ts` `fusionRank` (kind-prior blend, R6/B-16); context: RRF concept https://en.wikipedia.org/wiki/Reciprocal_rank_fusion | `searchVault(query, notes)`: reuse `tokenizeWords`+`overlap`-style scoring on note text **plus** tags/link targets; keep `fusionRank` as the packet-facing ranker and let vault search be the human/agent-facing one. |
| S9 | **Honesty markers on provenance** (illustrative ≠ cited) | in-repo convention M-01 (types.ts `Competitor.source`); https://obsidian.md/help/editing (callouts `> [!note]`) | Vault notes derived from template/illustrative content get frontmatter `source: illustrative`; notes built from `project.research` corpus items or fetched findings get `source: cited` + `url`. Never promote (same rule as M-01). |
| S10 | **Graph view is a want, backlinks are a need** | https://obsidian.md/help/plugins/graph | Skip any graph rendering this wave; backlink lists (S2) deliver 80% of the value at ~5% of the cost. Note as later-wave option in README. |

### "Steal later" library table (do NOT install this wave)

| Lib | URL | Why later / what it would replace | Zero-dep alternative today |
|-----|-----|-----------------------------------|----------------------------|
| FlexSearch | https://github.com/nextapps-de/flexsearch | full-text search, typo tolerance, zero-dep itself; wire into `searchVault` when note count > ~1k | reuse `tokenizeWords`/`stemToken` (algorithms.ts) + prefix/overlap scoring; vaults here are ≤ a few hundred notes |
| `node:sqlite` FTS5 | https://nodejs.org/api/sqlite.html | Node 22 **built-in** — full FTS5 (`fts5` virtual tables, BM25 ranking) with **no npm dep**; ideal for headless CLI `search` at scale | in-memory index maps in `vaultIndex` |
| markdown-it | https://github.com/markdown-it/markdown-it | md→HTML for the UI note preview when bodies get rich (tables, code fences) | vault bodies are generated plain markdown; UI can render code/links only |
| micromark / unified | https://github.com/micromark/micromark | spec-grade md parsing + custom syntax (wikilinks via micromark-extension) | 15-line wikilink regex (S1); validate against test corpus instead |
| highlight.js | https://github.com/highlightjs/highlight.js | code highlighting in the preview pane | artifacts already carry `language`; plain `<pre>` w/ theme colors is honest |
| Mermaid | https://mermaid.js.org/ | rendered phase/spec diagrams in exported notes; large runtime — lazy-load only | ASCII/indented tree diagrams in md (the packet already does this) |
| obsidian-export | https://github.com/obsidian-export/obsidian-export | converts a RapidTool vault dir into standard md if we ever write note *files* to disk | vault stays in-memory + single export string; no file tree needed |
| gray-matter | https://github.com/jonschlinkert/gray-matter | parse YAML frontmatter when ingesting foreign vaults | we *generate* frontmatter; parse with a tiny splitter on `---\n` delimiters |

---

## 2. Deep dive: 2nd-brain patterns → vault.ts

### 2.1 The Obsidian loop (what to replicate, cited)

Obsidian's effectiveness rests on a **link graph over plain markdown files**: `[[wikilinks]]` ([help/links](https://obsidian.md/help/links)) create edges; every note shows its **backlinks**; **tags** add a flat orthogonal axis (forum guide: [Links vs Tags](https://forum.obsidian.md/t/a-guide-on-links-vs-tags-in-obsidian/28231)); **MOCs** are ordinary notes that curate clusters of links, giving hierarchy without folders (Obsidian forum [best practices thread](https://forum.obsidian.md/t/best-practices-to-start-with-obsedian-zettelkasten/11499); LYT/Zettelkasten hybrid write-ups e.g. https://yordi.me/personal-knowledge-management-with-zettelkasten-and-obsidian/). **Zettelkasten** contributes atomicity — one idea per note, connected by links, minimal folder hierarchy ([zettelkasten.de atomicity guide](https://zettelkasten.de/atomicity/guide/), and Adobe's practitioner summary https://www.adobe.com/acrobat/resources/zettelkasten-method.html). **Frontmatter/properties** carry structured metadata (tags, aliases, dates, typed links) ([help/properties](https://obsidian.md/help/properties)).

Agent-relevant finding from the field: people now use coding agents (Claude Code) to *maintain* such vaults — generating MOC files, checking link integrity, restructuring legacy notes (https://trailway.medium.com/using-claude-code-for-organizing-your-second-brain-39137af6f596). That is exactly RapidTool's pitch: **the vault is a byproduct of the build pipeline, machine-maintained, human-greppable.**

### 2.2 RapidTool mapping (what already exists)

- `MemoryEntry` (`types.ts`): `{id, kind: episodic|semantic|procedural, phase, text, score}` — atomic by construction. Engine phases each append 1–2 rows (`engine.ts` `mem()` sites). These are the atomic notes. **Mapping: kind → note type; `score` → frontmatter `score`; `phase` → frontmatter `phase`.**
- `project.artifacts` (title/body/language/kind) — long-form notes (research findings, narratives, packets). Research artifacts carry `Source: <url>` and honesty footers (M-07) — **preserve those markers in the vault**, don't strip them in `vaultMarkdown`.
- `project.research` corpus (M-01/M-06) — the "cited" tier; template rows must stay `illustrative` (S9).
- `algorithms.ts` already exports the search primitives the vault needs (`tokenizeWords`, `stemToken`, `fnv1a`, `overlap`, `fusionRank`) — **reuse, don't reimplement**.
- Engine writes memory via `dedupeMemoryIds` and caps at 80 rows (`engine.ts` ~820/952/1006) — vault must tolerate duplicate-ish ids and stable ordering.

### 2.3 Recommended vault.ts shape (contract the other 3 agents code against)

> **⚠️ STATUS UPDATE (23:43, after build):** `src/lib/vault.ts` landed 2026-09-05 23:40 and its actual API is now authoritative. Landed: `searchVault(notes, query): VaultNote[]` (notes-first!), `vaultIndex(notes): string` (returns **MOC markdown**, not an object), `vaultMarkdown(notes): string`, `buildVaultNotes(project): VaultNote[]`; `VaultNote = { title, body, tags, links, phase?, updatedAt, kind: "project"|"memory"|"decision"|"research"|"artifact"|"index" }` (no `id`/`score`/`source`; kinds do NOT mirror MemoryEntry kinds). The advisory shape below is retained for historical context only — consumers (CLI task-2, UI task-3) must code to the landed file.

Pure functions over `Project` → plain data → markdown. Deterministic: same project in ⇒ byte-identical markdown out (no timestamps, no `Math.random`, no network — headless CLI + tests depend on it).

```
buildVaultNotes(project) → VaultNote[]        // atomic notes + MOC entry, sorted (phase, kind, id)
vaultIndex(notes)        → VaultIndex         // { mocs, byKind, byTag, links: Map<id, id[]>, backlinks: Map<id, id[]> }
vaultMarkdown(notes)     → string             // frontmatter'd .md vault: MOC hub + per-kind sections + [[wikilinks]]
searchVault(query, notes) → Array<{note, score}>  // token overlap reuse; honor #tag: and [[link]]: prefixes
```

`VaultNote` fields to agree on (Agent-B must freeze these BEFORE Agents C/D code against them): `id` (stable, slug), `title`, `kind` (mirror `MemoryEntry.kind` + `"moc"` + `"artifact"` sub-kind), `phase: PhaseId | null`, `tags: string[]`, `body` (markdown), `links: string[]` (resolved wikilink targets), `score?`, `source?: "illustrative"|"cited"`, `url?`, `created?`.

**Pitfalls for Agent-B:**
- `.ts` import extensions required everywhere (`from "./types.ts"`), matching repo style.
- Test file `vault.test.ts` should use the repo's existing test idioms (check `algorithms.test.ts`/`headless.test.ts` for imports; vitest-style `node:test`? — confirm from `package.json` scripts before writing).
- Wikilink targets must be **slug-normalized the same way in emit and resolve** (reuse `slugName` from `io.ts` or a local slug that matches note ids) or the link graph will be full of dangling links.
- Only link to notes that exist; expose dangling count in the index for the QA agent to assert ≥ some threshold? No — assert *zero* dangling links in tests with seeded fixtures.
- Memory rows can repeat text across phases (engine reuses phrases) — dedupe by `text` when building notes or the vault reads as spam.

---

## 3. Deep dive: open-source libs (surveyed, cite above in §1 table)

Verdict for THIS wave: **zero new npm deps is correct.** Rationale: (a) the CLI runs under bare `node --experimental-strip-types` and must stay dependency-free like `headless.ts` today; (b) every need (token search, wikilink parse, frontmatter emit) is ≤ ~40 lines using already-exported primitives; (c) the repo's history (see `scripts/write-atomic.mjs`, zero-dep brand checks) treats dependency-free scripts as a feature. Later waves have excellent targets: **FlexSearch** for fuzzy full-text ([github.com/nextapps-de/flexsearch](https://github.com/nextapps-de/flexsearch), zero-dep, built for browser+Node), **FTS5 in `node:sqlite`** for true ranked search with *zero npm install* on Node 22 ([nodejs.org/api/sqlite.html](https://nodejs.org/api/sqlite.html)), **markdown-it** for rich rendering ([github.com/markdown-it/markdown-it](https://github.com/markdown-it/markdown-it)), **micromark** family if wikilink parsing must be spec-grade ([github.com/micromark/micromark](https://github.com/micromark/micromark)), **highlight.js** for code ([github.com/highlightjs/highlight.js](https://github.com/highlightjs/highlight.js)), **Mermaid** for diagrams ([mermaid.js.org](https://mermaid.js.org/)) — heavy, lazy-load only, and **obsidian-export** if note files on disk ever become a thing ([github.com/obsidian-export/obsidian-export](https://github.com/obsidian-export/obsidian-export)).

---

## 4. Deep dive: agent-CLI UX (for Agent-C, and the UX bar the UI mirrors)

Sources: Arcjet engineering blog "Designing a CLI for AI agents" (https://blog.arcjet.com/designing-a-cli-for-ai-agents/) and the community rules list "Writing CLI tools that AI agents actually want to use" (https://dev.to/uenyioha/writing-cli-tools-that-ai-agents-actually-want-to-use-39no).

Consensus rules, checked against RapidTool's current `rapidtool-cli.mjs`:

| Rule (source) | RapidTool today | Must keep for new subcommands |
|---|---|---|
| Structured output not optional — JSON to stdout only; messages/warnings to stderr (dev.to rule 1; Arcjet) | ✅ single `JSON.stringify` per command via `print()`; usage text embedded in the JSON `usage` key, not dumped to stdout | `vault`, `search`, `crew`, `verify` must print **one** JSON object; no progress lines on stdout |
| Errors parseable (Arcjet) | ✅ `{ok:false, error}` + exit 1 | same shape; **never throw stack traces to stdout**; catch → `print({ok:false,error})` |
| Exit codes meaningful (dev.to checklist) | ✅ 0 ok / 1 error | new subcommands: 0 ok, 1 error, and for `verify` consider 2 = "checks ran, failures found" if spec'd — document in README-cli.md |
| Output default changes on non-TTY / machine-readable by default (Arcjet) | n/a (always JSON — fine, it's an agent CLI) | keep always-JSON; document that in README-cli.md (it is a feature: https://blog.arcjet.com/designing-a-cli-for-ai-agents/) |
| Flat stable schemas, consistent types (dev.to) | ✅ `ok/path/summary/steps/stopped/events` | new subcommands share `ok`, plus `count`, `notes[]`, `index{}` — mirror names, don't invent per-command synonyms |
| Idempotent, no interactive prompts; `--force`/`--autopilot` style flags (dev.to checklist) | ✅ `--force`, `--autopilot`, no prompts | `verify` must never ask; `crew` runs deterministically |
| Help with realistic examples (Arcjet "Help output includes realistic examples") | ⚠️ `usage` is JSON with one-line signatures | extend `usage.commands` with the new commands + 1 realistic example each; README-cli.md examples must be copy-paste runnable |

**Concrete for Agent-C:**
- New subcommands consume **`vault.ts`'s exact exports** — wait for Agent-B's file to land, or import defensively (`await import` in try/catch with a clean `{ok:false,error}` if missing); coordinate on the export names in §2.3.
- `search` subcommand: `--query` required, `--limit` optional, reuse `searchVault`; output `{ok:true, count, results:[{id,title,score}]}`.
- `vault` subcommand: `--project` required; output `{ok:true, count, index:{byKind,byTag,linkCount,backlinkCount}, markdown?}` — **never** dump the whole markdown vault to stdout by default (context-window courtesy, Arcjet `--fields` philosophy); support `--out file.md` for the full export (mirror `packet --out`).
- Keep `headless.ts` as the only place that imports engine/io — CLI stays a thin argv wrapper (its stated design, lines 1–19).
- `README-cli.md` is **agent-facing documentation**: each command gets JSON output example + exit codes. This is the doc a future Hermes agent reads to drive RapidTool — make the "agent contract" section explicit.

---

## 5. Per-sibling exact recommendations & pitfalls

### Agent-B (vault.ts) — files: NEW `src/lib/vault.ts`, `vault.test.ts`
1. Freeze the export surface (§2.3) in the file header comment — C and D code against it blind.
2. Reuse `tokenizeWords`/`stemToken` (algorithms.ts) inside `searchVault`; reuse `slugName` semantics for ids. Zero new deps.
3. Deterministic output: no `Date.now()` in note bodies; `created` only if derived from project timestamps.
4. Emit frontmatter + MOC hub per §2.1 so the export is genuinely Obsidian-importable (that is the "second brain" payoff; cite obsidian.md/help/properties).
5. Tests: deterministic idempotence (build twice → identical), zero dangling links on a seeded fixture, tag/kind grouping counts, search ranking sanity, empty-project edge (no memory/artifacts → MOC with 0 entries, no throw).
6. **Pitfall:** import extension `.ts` mandatory; look at how `algorithms.test.ts` imports before writing tests; keep typecheck green (`npx tsc --noEmit` if that's the repo script — check package.json).

### Agent-C (headless CLI) — files: `src/lib/headless.ts`, `scripts/rapidtool-cli.mjs`, NEW `scripts/README-cli.md`
1. Re-export vault functions through headless.ts (`vaultNotes/project` etc.) so the CLI wrapper stays thin and type-safe — mirror how `packet()` wraps `exportPacketText` (headless.ts:364).
2. CLI: reuse `parseArgs`/`requireArg`/`flag`/`print` exactly; add `vault`, `search`, `crew`, `verify` to the `switch` AND `USAGE.commands`.
3. stdout purity: all four new commands single JSON; errors `{ok:false,error}` exit 1 (section 4).
4. **Pitfall:** don't write the vault .md inline in the CLI — route through `vaultMarkdown` so UI and CLI can't drift.
5. **Pitfall:** `crew`/`verify` already have server-side analogues (`crew.server.ts`, `verify.server.ts` are server-only, import node/net?) — the headless versions must be pure file-based; do not import `*.server.ts` into headless.ts (breaks bare-node CLI).

### Agent-D (console.tsx Vault tab) — files: `src/components/console.tsx`, `src/styles.css`
1. Add `"vault"` to `RunTab` (line 74), tab state at line 441 already generic; new `<Tabs.Trigger value="vault">` after the `oracle` trigger (~line 1408) and `<Tabs.Content value="vault">` before `</Tabs.Root>` (~line 1518). Follow the existing `forceMount` + `data-[state=inactive]:hidden` pattern of sibling contents.
2. Consume vault.ts exports directly (`buildVaultNotes(project)` in a `useMemo` on `project`), not a copy.
3. UI: MOC list default; note detail with rendered `[[wikilinks]]` as clickable buttons switching selected note (dangling → disabled); backlinks section; tag chips filter; copy (clipboard) + download (`downloadFilename(project,"md")` exists in io.ts) using the vault markdown export.
4. **Pitfall:** console.tsx renders under `project.memory.slice(0, 8)` strip (~line 1540) — if you surface memory there too, don't duplicate vault notes visually; vault tab owns notes.
5. a11y/theme: tab triggers are buttons with aria (Radix Tabs gives this free — keep `aria-label` on the list); reuse existing color tokens/classes from styles.css; don't add raw hex colors.
6. **Pitfall:** vault.ts may not exist yet when you start — build against the agreed contract (§2.3) and typecheck only after Agent-B lands it, or you'll churn.

### Agent-E (QA sweep)
1. Verify the "no dangling links" and determinism properties of vault output in your sweep if vault.ts exists by then (it's in your read-only observation set; findings → `audit-bugs/06_sweep.md`, do NOT fix outside your surface).
2. Check CLI stdout purity claims (§4) by piping commands and asserting parseable single JSON + correct exit codes — report any stray stderr/stdout mixing in the *new* subcommands to Agent-C via the live-guidance file.
3. Memory-related regressions to watch in engine/io paths: `dedupeMemoryIds` (engine.ts), hydrate memory filter (engine.ts ~1183) — confirm nothing in the QA surface breaks when memory rows are non-unique or `kind` unknown (A15 precedent: skip, don't throw).

---

## 6. Source list (all URLs cited above)
- Obsidian Help — Internal links / wikilinks: https://obsidian.md/help/links
- Obsidian Help — Properties/frontmatter: https://obsidian.md/help/properties
- Obsidian Help — Daily notes: https://obsidian.md/help/plugins/daily-notes
- Obsidian forum — Links vs Tags guide: https://forum.obsidian.md/t/a-guide-on-links-vs-tags-in-obsidian/28231
- Obsidian forum — Zettelkasten best practices: https://forum.obsidian.md/t/best-practices-to-start-with-obsedian-zettelkasten/11499
- Zettelkasten.de — Complete guide to atomic note-taking: https://zettelkasten.de/atomicity/guide/
- Adobe — Zettelkasten method: https://www.adobe.com/acrobat/resources/zettelkasten-method.html
- Yordi — PKM with Zettelkasten & Obsidian: https://yordi.me/personal-knowledge-management-with-zettelkasten-and-obsidian/
- Medium (T. Laitila) — Claude Code organizing a second brain: https://trailway.medium.com/using-claude-code-for-organizing-your-second-brain-39137af6f596
- Arcjet — Designing a CLI for AI agents: https://blog.arcjet.com/designing-a-cli-for-ai-agents/
- dev.to — Writing CLI tools that AI agents actually want to use: https://dev.to/uenyioha/writing-cli-tools-that-ai-agents-actually-want-to-use-39no
- FlexSearch: https://github.com/nextapps-de/flexsearch · Node sqlite/FTS5: https://nodejs.org/api/sqlite.html · markdown-it: https://github.com/markdown-it/markdown-it · micromark: https://github.com/micromark/micromark · highlight.js: https://github.com/highlightjs/highlight.js · Mermaid: https://mermaid.js.org/ · obsidian-export: https://github.com/obsidian-export/obsidian-export
- Wikipedia — Reciprocal rank fusion (FusionRank context): https://en.wikipedia.org/wiki/Reciprocal_rank_fusion
