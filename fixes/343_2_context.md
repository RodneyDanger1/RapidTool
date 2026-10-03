# 343-2 — Context intelligence + UI: the deterministic repo map

**Lane:** 343-2 (W57). **Root:** `C:\Users\mnril\Desktop\RapidTool Main`. **Branch:** `main`,
HEAD `73f660a`, tree clean at open. **Owner files:** `src/lib/repo-map.ts`,
`src/lib/repo-map.test.ts`, `src/lib/packet.ts`, `src/lib/packet.test.ts`,
`src/components/console.tsx`. **Append-only.** **0 keyed calls.** Scratch: `$env:TEMP\rt343_2\`.

Personas: **analyst** (§1–§5) + **engineer** (§6–§10).

---

## 1. ANALYST — what RapidTool gives the model today, on bytes

### 1.1 The P6 synthesis prompt (`src/lib/codegen.server.ts`)

Two strings reach the model, both built server-side only:

| Piece | Anchor | What it carries |
|---|---|---|
| System prompt | `codegen.server.ts:566-631` (`p6SynthesisSystemPrompt`) | **Rules only.** The JSON envelope, 11 rules (export exactly the listed signatures, zero imports, JSDoc, forbidden primitives, `// req-N`, no prose, await-async, strict-TS annotations incl. the 342-1 TS2322/TS2749/TS2440 rule). **No repo context of any kind** — no file list, no symbols, no sizes, no dependencies. |
| User prompt | `codegen.server.ts:1582-1715` (`p6SynthesisChunkUserPrompt`) | BRIEF (capped **2 000 chars**, `:189-191`), REQUIREMENTS, TYPE SIGNATURES *for this chunk*, NEGATIVE CONSTRAINTS, EDGE CASES, DATA FLOW, ERROR HANDLING, capped DATA CONTRACTS (`:219`, ≤12 rows), and — only for chunk >0 — **EARLIER FILES ALREADY GENERATED** (`:1663-1711`): per earlier chunk, `path exports: … · covers req-N · asynchronous (must await): …`. |

So the P6 prompt's only structural view of the tree being built is the **exports of the previous chunks**
(≤12 files, `P6_SYNTH_PRIOR_MAX_FILES` `:200`; total prompt budget 60 000 chars, `:208`) with a visible
`…[PRIOR-ELIDED…]` marker. It has **no in-degree, no size, no entry/barrel role, and no view of the
already-persisted tree when resuming** — a resumed run re-derives everything from the brief.

### 1.2 The Agent Packet (`src/lib/packet.ts`)

The packet is the paste-ready contract the continuing agent gets (`AGENT_GUIDE.md` §1–§3). Its generated
artifact knowledge is exactly one line, `packet.ts:940-953`:

> `Generated artifact: N tree file(s) recorded (project.generatedTree) — the bytes to continue from: <≤12 paths>, …(+M more).`

or `single module (project.generatedSource)` / `none recorded`. So the packet names **paths, not symbols**;
it never says which file exports what, how big it is, or what depends on what. The packet as a whole is
hard-capped at `PACKET_MAX_CHARS = 14 000` (`packet.ts:20`) with the budget-aware truncation at
`:1173-1234`, so any addition must be bounded and must leave no-tree packets byte-identical.

### 1.3 What the repo already owns that a repo map could stand on

- `src/lib/ast-mine.ts:383` `mineCodebase(files)` — a **regex-based** structural map: per-file
  imports/exports/functions + a dependency graph with in-edges, plus `externals`/`unresolved`. Its own
  HONEST LABEL (`ast-mine.ts:10-17`) calls it orientation-only, not a parser. It imports `node:path`
  (`ast-mine.ts:24`), so it is **not** client-safe today.
- `src/lib/algo-tools.ts:484` `exportedNamesOf(source)` — the canonical, well-tested (328/330/339-2)
  export inventory. **Server-only in practice**: `algo-tools.ts:33-35` statically imports
  `./deepseek.server.ts` and `./verify.server.ts`, and the TanStack import-protection plugin statically
  denies `*.server.*` from the client bundle (`server-spec.ts:5-13`). `packet.ts` is in the client graph
  (`console.tsx` → `store.ts:22` → `engine.ts:15` → `packet.ts`), so it cannot import `algo-tools.ts`.
- **Client-safe helpers that already do the hard parts**: `src/lib/sandbox.ts:85`
  `maskLiteralsAndComments(src)` — length-preserving spaces, so a string/comment can never forge a symbol;
  and `src/lib/dod.ts:264` `isReexportOnlySource(source)` — the barrel detector. Both are already imported
  into the client graph (`packet.ts:5` imports `sandboxClaim` from `sandbox.ts`; `packet.ts:9` imports
  `dod.ts`).
- **No AST dependency ships.** `package.json` has no `tree-sitter`, no `ts-morph`, no `acorn`/`swc`/`babel`
  — confirmed by reading `package.json` dependencies + devDependencies.

---

## 2. ANALYST — what competitor repo-map approaches add

Mined from the repo's own research (no new web fetch; every external claim below is the repo's, with its
proving path):

| Approach | Mechanism | Proving path in this repo |
|---|---|---|
| **Aider — repo map** | tree-sitter tags (classes/functions + signatures) over a **file-dependency graph**, ranked by **PageRank**, emitted under a **token budget** (`--map-tokens` default 1024), cached; expands when no files are pinned. | `research/multiagent/107_competitors_agentic.md:74` (`aider/repomap.py:19,49,70,120-138,365-382,525-529`; `aider/args.py:221,248`); `research/multiagent/90_LEAPFROG.md:81-83`; `agentnotes.md:2107` |
| **SWE-agent — filemap + history processors** | a tree-sitter `filemap` tool so the model reads a "skimmed" file, plus `LastNObservations`/`ClosedWindow`/`CacheControl` history processors that elide with a **visible marker**. | `107_competitors_agentic.md:48` (`sweagent/agent/history_processors.py:74-370`) |
| **Cline / OpenCode / Codex — compaction & budgets** | compaction stages with a measured trigger and recorded `tokensSaved`, output caps justified as cost-quadratic; OpenCode's fixed `SUMMARY_TEMPLATE`; Codex middle-truncation under a token budget. | `107_competitors_agentic.md:84` (`context/compaction.ts`, `output-limits.ts`), `:160` (`session/compaction.ts:13-30`), `:126` (`compact_token_budget.rs`) |
| **OpenHands — verify the effect** | compaction is only "successful" when the token count actually dropped; "no event = failure, not a no-op". | `107_competitors_agentic.md:113` (`use-await-context-compaction.ts:11-20`); `110_ui_audit_vs_competitors.md:242-248` |
| **The register that names this gap** | "Repo maps / codebase context — tree-sitter AST-based map, graph-ranked, token-budgeted, refreshed from git … Verify what RapidTool's `ast-mine.ts` emits vs a ranked repo map before claiming codebase-intelligence parity." | `90_LEAPFROG.md:707`; the budgeted-context gap G8 `agentnotes.md:2533`; "rank → budget → inject" `agentnotes.md:2109` |

**Net:** the field's repo map is *ranked tags under a budget, with visible elision*. RapidTool has the
ingredients (a structural miner, a client-safe masker, a barrel detector, an established
`…[ELIDED…]`/`…[TRUNCATED…]` marker idiom) but injects **raw bytes / path lists** into both the packet and
P6. The gap is context assembly, not a new subsystem.

---

## 3. ANALYST — shortlist and the smallest honest design

**Hard constraints discovered on bytes:**
1. `repo-map.ts` will be imported by `packet.ts`, which is in the client graph → it must be **client-safe**
   and **dependency-free** (no `node:*`; no static `*.server.*` transitively).
2. No AST library ships → any parser is out; use deterministic lexical extraction over the repo's own
   **client-safe** masker.
3. Every existing packet feature is conditional so that no-tree packets stay byte-identical; the new
   section must follow that precedent.

**Options considered:**

| # | Option | Verdict |
|---|---|---|
| A | Port Aider's PageRank + tree-sitter tags | **Discard** — no tree-sitter ships (constraint 2), and adding one is a new subsystem + a dependency the repo deliberately avoids (`algo-tools.ts:5-7`). |
| B | Import `ast-mine.mineCodebase` into repo-map | **Discard** — it imports `node:path` (`ast-mine.ts:24`), so it is not client-safe. Rewriting it is outside ownership. |
| C | Import `algo-tools.exportedNamesOf` into repo-map | **Discard** — transitively drags `*.server.*` into the console bundle (constraint 1). |
| D | New module: pure lexical inventory over the **client-safe masker**, in-degree from in-tree relative/alias imports, integer score, char budget + elision marker | **Take.** Reuses `maskLiteralsAndComments` (`sandbox.ts:85`) and `isReexportOnlySource` (`dod.ts:264`); no new dependency; deterministic; testable. |
| E | Surface the map only in the UI, not the packet | **Discard** — the packet is the handoff surface (`AGENT_GUIDE.md` §1); the map's value is for the *continuing agent*. Both get it. |

**Design (D):**

- **Input:** `readonly {path, source}[]`, or `repoMapForProject(project)` reading
  `project.generatedTree` (map `{path, source}`) with a `generatedSource` fallback at the emitter's fixed
  host path `src/generated.ts` (`codegen.server.ts:1736` `TREE_ENTRY_PATH`).
- **Symbols:** only names returned by the module's `runtimeExportNamesOf(source)`, computed over
  `maskLiteralsAndComments(source)` — ESM `function`/`class`/`const|let|var`/`export { a, b as c }`/
  `export * as ns from`, plus CJS `exports.x =` / `module.exports.x =`. Prose/strings/regex content can
  never become a symbol (the masker blanks them first). Types (`export interface`/`export type`) are not
  reported — matching `exportedNamesOf`'s runtime-name semantics. Never a guessed name.
- **Ranking (documented, integer, testable):**
  `score = inbound*10 + exports*5 + floor(min(lines,300)/10) + roleBonus`
  where `roleBonus` = 60 for `entry` (the configured entry path, or a basename `index|main|app`),
  30 for `barrel` (`isReexportOnlySource`), else 0. Ties break by `path` ascending. Rationale: in-degree and
  exported surface are the "importance" signals; size is a minor tiebreak (capped so one huge file cannot
  dominate); artifact role makes the entry the continuing agent must read visible.
- **Output:** a compact outline, one line per shown file —
  `<path>: <sym1, sym2, … (+K)> · in <D>, <L> ln< · entry|barrel>`. Hard **char budget** (default
  `REPO_MAP_DEFAULT_BUDGET = 1600`) with a visible elision marker
  `…[repo map elided — N file(s) omitted to fit the B-char budget]`; `rendered.length <= budget` invariant.
- **Empty/absent:** `buildRepoMap([])` ⇒ `{empty:true, rendered:""}`; `repoMapForProject` with neither tree
  nor source ⇒ empty. The packet omits the section, the UI shows an honest empty state.

---

## 4. ANALYST — where the map is wired

1. **Agent Packet** (`packet.ts`): a bounded `## Repo map` section, rendered **only when the project has
   generated bytes** (so every no-tree packet stays byte-identical). Placed just after the `## Current edge`
   rail that already names the generated artifact.
2. **P6 synthesis prompt** (`codegen.server.ts`) — **STOP-and-REPORT**, not reached into: that file belongs
   to another lane (342-1's P6 convergence owner). The exact shape is stated in §5 so its owner can wire it
   in one line.
3. **UI** (`console.tsx`): the packet tab gains a compact "Repo map" card above the packet body, rendered
   from the same `RepoMap` structure (entry list + symbol chips + per-file `in/ln`), with the elision marker
   when budget-truncated and an honest empty state when no tree exists. No placeholder content.

## 5. ANALYST — STOP-and-REPORT (exact shape for the P6 owner)

The P6 seam is `p6SynthesisChunkUserPrompt` (`codegen.server.ts:1582`) / its caller that assembles
`priorFiles: ChunkPriorFile[]`. To hand the model the same map, its owner adds, in the caller that already
has `Project` and `materialized`/`priorFiles` in scope (the tree synthesis path around
`codegen.server.ts:4678-4730`), one bounded block built from the SAME `repoMapForProject(project)` export —
e.g. append to the user prompt:

```
REPO MAP (deterministic outline of the tree so far — path: exported symbols, ranked):
<repoMapForProject(project, { budget: 1200 }).rendered>
```

No new algorithm, no new dependency; `repo-map.ts` is client-safe, so `codegen.server.ts` may import it
freely. This lane did **not** edit `codegen.server.ts` (strict ownership).

---

## 6. ENGINEER — the module (`src/lib/repo-map.ts`, +`repo-map.test.ts`)

Pure, deterministic, dependency-free. Public surface (`src/lib/repo-map.ts`):

| Export | Line | Role |
|---|---|---|
| `RepoMapFile` / `RepoMapRole` / `RepoMapEntry` / `RepoMap` | 37/43/46/65 | Types |
| `REPO_MAP_DEFAULT_BUDGET = 1_600` · `REPO_MAP_MIN_BUDGET = 200` · `REPO_MAP_DEFAULT_SYMBOLS = 6` · `REPO_MAP_ENTRY_PATH = "src/generated.ts"` · `REPO_MAP_ELISION_PREFIX` | 87/89/91/93/95 | Budget + marker constants |
| `repoMapElisionMarker(omitted, budget)` | 98 | The visible elision marker (one source of truth for text + UI) |
| `runtimeExportNamesOf(source)` | 298 | Client-safe export inventory over `maskLiteralsAndComments` |
| `buildRepoMap(files, opts?)` | 429 | The ranked, budgeted map |
| `repoMapForProject(project, opts?)` | 560 | Reads `generatedTree` → `generatedSource` fallback → empty |

**Reuse (both CLIENT-safe, both already in the packet/console graph):**
`maskLiteralsAndComments` (`sandbox.ts:85`) masks strings/comments/regex before any
symbol is read — so prose can never forge a name; `isReexportOnlySource` (`dod.ts:264`)
classifies barrels. The canonical `exportedNamesOf` (`algo-tools.ts:484`) is the
semantics model, but it is **server-only** (`algo-tools.ts:33-35` statically imports
`deepseek.server.ts`/`verify.server.ts`, which the TanStack import-protection plugin
denies to the client — `server-spec.ts:5-13`), so importing it here would break the
console bundle. `runtimeExportNamesOf` mirrors its runtime-name semantics over the
masked view instead (types excluded; `export *` alone never invents names).

## 7. ENGINEER — RED → GREEN (real output)

**RED (Node 22.23.2), before the module existed:**
```
not ok 1 - src\lib\repo-map.test.ts
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...\src\lib\repo-map.ts'
```
**RED (Node 22), packet wiring not yet added:**
```
not ok 1 - 343-2: the packet carries a ranked repo map when generated bytes exist
not ok 2 - 343-2: the repo map never invents a symbol (prose is not an export)
not ok 3 - 343-2: the repo map section is bounded and deterministic
ok     4 - 343-2 control: a project with no generated bytes stays byte-identical (no section)
# tests 4   # pass 1   # fail 3
```

**GREEN (both runtimes):**

| Suite | Node 22.23.2 | Node 24.15.0 |
|---|---|---|
| `repo-map.test.ts` | **15/15, fail 0** | **15/15, fail 0** |
| `packet.test.ts` | **85/85, fail 0** | **85/85, fail 0** |
| `headless.test.ts` (read-only pin) | **163/163, fail 0** | — |
| `io.test.ts` + `store.test.ts` (read-only pins) | **155/155, fail 0** | — |
| `determinism-guard.test.ts` | **4/4, fail 0** | — |
| `npm run typecheck` | **exit 0** | |
| `eslint` on the five owned files | **0 errors, 0 warnings** | |

*(An earlier full-headless run showed 2 failures in `#25 E-25 CLI machine contract` and
`#43 landEmittedTree (fixes/343_3)` — both are titles of OTHER lanes' in-flight files
(`headless.ts`, `headless.test.ts`, `scripts/rapidtool-cli.mjs` are concurrently modified
in this shared tree). A re-run of the full suite with my changes present is 163/163, and
the two tests pass under a name-filter run; they are not caused by this lane.)*

**The four required properties (pinned by tests):**
- **Determinism / order-independence** — `buildRepoMap: deterministic and independent of input order` asserts `deepEqual` across `[a,b]`, `[b,a]`, and cloned rows (test:34).
- **Budget + elision** — 40 files at a 400-char budget → `truncated`, `omitted > 0`, `shownFiles + omitted === totalFiles`, `chars ≤ budget`, marker present (test:71). The UI larger-budget case renders `5981/6000 chars` and the marker (browser, §9).
- **No invented symbols** — `runtimeExportNamesOf` on a comment/string/regex forgery returns only the one real export (test:31); the packet-level `never invents a symbol` test asserts a commented `ghost` and a string-literal `phantom` never appear (packet test).
- **Honest empty** — `buildRepoMap([])` and junk rows ⇒ `empty:true, rendered:""` (tests:96,103); `repoMapForProject` null/absent ⇒ empty (test:113).

## 8. ENGINEER — packet wiring (`src/lib/packet.ts`)

- Import at `packet.ts:15`: `repoMapForProject` (client-safe; `packet.ts` stays in the client graph).
- Compute at `packet.ts:964`: `const repoMap = repoMapForProject(project);`
- Section at `packet.ts:1062`: `...(repoMap.rendered ? [``, `## Repo map`, repoMap.rendered] : [])` — placed after the `## Current edge` rail and before `## Exit criteria (DoD)`.

**Real emitted section** (`engine.emptyProject` + a 3-file tree, `compileAgentPacket`):
```
## Repo map
src/generated.ts: (no named exports) · in 0, 2 ln · entry
src/jobs/rent.ts: applyLateFee, collectRent · in 1, 4 ln
src/core.ts: core · in 1, 2 ln
```
Because the section is conditional on `repoMap.rendered`, **a project with no generated bytes
renders byte-identically** (the control test, plus the full existing packet suite 85/85).

**P6 synthesis prompt — STOP-and-REPORT.** The seam is `p6SynthesisChunkUserPrompt`
(`codegen.server.ts:1582`) and its caller (~`4678-4730`), owned by 342-1. Exact one-line
shape to hand the model the same map (no algorithm/dependency change — `repo-map.ts` is
client-safe so `codegen.server.ts` may import it freely):
```
REPO MAP (deterministic outline of the tree so far — path: exported symbols, ranked):
<repoMapForProject(project, { budget: 1200 }).rendered>
```
This lane did **not** edit `codegen.server.ts`.

## 9. ENGINEER — UI wiring (`src/components/console.tsx`)

- Import at `console.tsx:60` (`repoMapElisionMarker`, `repoMapForProject`).
- `const repoMap = useMemo(() => repoMapForProject(project, { budget: 6_000 }), [project])` at `:2261` (declared before the null guard so hook order is stable).
- A "Repo map" card at `:3690+` inside the `Agent packet` pane (`<h3>Repo map</h3>` at `:3698`): header meta (`N of M file(s) · ranked by in-degree, exports, size, role · chars/budget`), a scrollable list (`path` + symbols + `role/in/ln`), the elision marker footer, and an honest empty state ("No generated tree yet … nothing is invented here"). Uses the existing design tokens (`border-border`, `bg-surface`, `text-fg/muted/faint`, `font-mono`, `text-2xs`, `scroll-thin`).

**Real browser check** (`npm run dev`, 127.0.0.1:8080, Playwright/Chromium, driven against the seeded demo project; injected a real `generatedTree` through the persisted store then reloaded `/run/<id>`, opened the `Agent packet` tab):

| View | Result |
|---|---|
| Desktop 1440×900 — empty | header `no generated tree recorded`; body "No generated tree yet — a keyed Phase 6 run records the file…" |
| Desktop 1440×900 — 3-file tree | `3 of 3 file(s) · ranked by in-degree, exports, size, role · 156/6000 chars`; rows `src/generated.ts · entry · in 2`, `…collect-rent-001.ts · collectRent1 · in 1`, `…002.ts · collectRent2 · in 0` |
| Desktop — 400-file tree | header `104 of 400 file(s) … 5981/6000 chars`; footer `…[repo map elided — 296 file(s) omitted to fit the 6000-char budget]` |
| Mobile 390×844 — 3-file + 400-file | identical map, wraps readably, **no page errors** |
| Console errors (both viewports) | **none** |

Screenshots: `$env:TEMP\rt343_2\console-desktop.png`, `$env:TEMP\rt343_2\console-mobile.png`.

## 10. ENGINEER — verdict, limits, STOP-and-REPORTs

**Verdict:** landed and verified. `repo-map.ts` is a deterministic, dependency-free,
client-safe ranked outline with a documented integer score, a hard char budget, a visible
elision marker, and a strict no-invention guarantee (masked bytes only). It is wired into the
Agent Packet (bounded, conditional — no-tree packets byte-identical) and surfaced in the
console's Agent-packet pane on desktop and mobile, with a genuine empty state. The P6 prompt
seam was **not** reached into (another lane owns `codegen.server.ts`); the exact one-line
shape is recorded in §5/§8.

**Honest limits:** lexical extraction (not a parser) — exotic export layouts are missed,
never guessed (the same scope `ast-mine.ts` declares). Ranking is a documented heuristic
(in-degree, exports, capped size, role), not Aider's PageRank; that is the deliberate
no-new-subsystem trade. The map reflects only persisted `generatedTree`/`generatedSource` —
keyless scaffold runs have no generated tree and therefore no map (correct, not a bug).

**STOP-and-REPORT:** one — the P6 synthesis-prompt wiring needs `src/lib/codegen.server.ts`
(owned by the P6 lane). Exact shape provided; no file touched.

