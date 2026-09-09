# Pillar fixes — agent B5: codebase mining + knowledge store + reverse-handoff watcher

> Flash Pillar B5 (Pillars 5 + 11 + 7). New capability modules under `src/lib/`,
> zero npm dependencies, honest labels throughout. Verified below: my files
> typecheck clean, 17/17 new tests green across repeated runs, full suite + build
> status at the bottom.

## New files
- `src/lib/ast-mine.ts` — structural codebase map (Pillar 5).
- `src/lib/knowledge.ts` — JSON-backed cross-project pattern store (Pillar 11).
- `src/lib/watcher.ts` — bounded reverse-handoff watcher (Pillar 7 companion).
- `src/lib/ast-mine.test.ts`, `src/lib/knowledge.test.ts`, `src/lib/watcher.test.ts` — 17 tests total (requirement: ≥12).
- `fixes/66_pillars_mine.md` — this note.

## ast-mine.ts — `mineCodebase`, `conventionsMap`, `respectConventions`
- `mineCodebase(files: {path, body}[])` → `{files:[{path, lines, imports[], exports[], defaultExport, reExports[], functions[]}], dependencyGraph:{nodes, edges, externals, unresolved}, stats}`.
  - Imports: static (incl. multi-line braces, side-effect, `import type`), single-line dynamic `import()`, re-exports (`export * from`, `export {x} from`).
  - Functions: free functions, `const x = (…) =>` arrows, class methods (brace-depth-scoped so `if () {}` and interface signatures never count as methods), each with `kind` + 1-based `line` + `exported`.
  - Graph edges only between mined files: relative (`./x`, `../x`) and `@/` (→ `src/`) specifiers resolved with `.ts/.tsx/.js/.jsx/.json` + `/index.*` fallback; bare packages → `externals`, missing locals → `unresolved` (never fake edges).
- **HONEST LABEL (documented in the header):** regex-based structural extraction, NOT a real AST parser — no string/comment awareness; exotic layouts are missed, never guessed.
- Deterministic: sorted files/nodes/edges, source-order lists, no clock/RNG/IO → deep-equal maps for identical input (tested, incl. shuffled input and Windows `\` path normalization).
- `conventionsMap(project, files)` → naming-style tallies (file paths + function names), named-vs-default export ratio, top imports, deterministic notes.
- `respectConventions(packet, map)` → advisory-only verdict (`advisories[]` + optional `injected` markdown block). Zero advisories when the proposed name matches the dominant mined style; never enforces.

## knowledge.ts — `KnowledgeStore(filePath)`
- Append-only JSON store `{version: 1, entries[]}`; `savePattern(entry)` → `{entry, appended}`.
  - Idempotent (E-09 stance): entry id = `K` + fnv1a fingerprint (reuses `algorithms.ts` `fnv1a`); duplicate saves append nothing.
  - Atomic writes (`<file>.tmp` + rename); a corrupt store file throws rather than being silently overwritten.
- `findPatterns(query)` → deterministic FusionRank-**style** scoring: idf-weighted token overlap, title ×2 / tags ×1.5 / body ×1, normalized to [0,1]. **HONEST LABEL:** lexical token scoring, not a vector DB / embeddings.
- `injectProven(project)` → advisory research rows from OTHER projects' stored entries only (self-project excluded); purely advisory.

## watcher.ts — `startWatcher`, `stopWatcher`, `watcherNotes`
- `startWatcher(dir, onChange, {debounceMs = 800, persistent})` — recursive `fs.watch`; onChange gets one debounced batch of `{path, kind}` per quiet window.
- **Bounded:** only `.ts/.tsx/.js/.json` events fire; filename-less events ignored; pending set capped (200); listener errors caught + surfaced via `watcherNotes`, never crash.
- **HONEST LABEL:** opt-in only — nothing calls `startWatcher` automatically; kind labels (`created/removed`) are best-effort existence probes since fs.watch only gives `rename|change` (documented in header + `watcherNotes` first line).
- `stopWatcher(handle)` idempotent; `watcherNotes(dir?)` reports active watchers/errors/contract.

## Tests (17, all `node --experimental-strip-types --test`-compatible)
- ast-mine (8): imports/exports/default/functions + line numbers; interface signatures and keyword calls excluded from methods; graph resolution (relative ext-less, `@/`, externals, unresolved); determinism (same + shuffled input); backslash normalization; convention tallies; respectConventions conform + mismatch advisories.
- knowledge (5): JSON persistence round-trip incl. versioned file shape + no stray `.tmp`; append-only + idempotent duplicate; corrupt-file refusal; ranking determinism/limit/no-match; `injectProven` cross-project-only rows.
- watcher (4, real temp dirs + real writes): debounce batching + quiet-window suppression + restart; extension filter; stop idempotence + no delivery after stop + notes state; opt-in contract notes + throw on missing dir.
- Watcher tests use temp dirs (`os.tmpdir()`), shrunk debounce, `persistent: false`, and full cleanup; suite verified stable over repeated runs.

## Gates (measured 08:29–08:32, during concurrent sibling-agent edits)
- `tsc --noEmit` on my six files: **0 errors**. Whole-tree typecheck during my window showed transient errors only in sibling-owned files mid-edit (`src/lib/swarm.test.ts` 08:06–08:18, self-resolved; `src/components/console.tsx:784` `'startedAt' is possibly 'null'`, mtime 08:18, still red at 08:32).
- New suites: **17/17 pass** (4 consecutive combined runs; an early flake in one watcher timing assertion was fixed by asserting the debounce contract — delivery of all qualifying paths + quiet-window suppression + restart — instead of single-batch ordering).
- Full `src/lib` test chunk (`node --experimental-strip-types --test "src/lib/*.test.ts" …` exactly as package.json): **851/851 pass, 0 fail** — includes my 17 tests plus all lib suites (swarm etc.).
- `npm test` overall is currently RED for reasons that predate and are unrelated to this work: the `scripts/**/*.test.mjs` chunk fails 10 tests (`# tests 195, pass 185, fail 10`) and its `&&` short-circuit then skips the lib chunk. The 10 failures are environmental/pre-existing — scripts files untouched since Sep 4 (grok-pwa-plugin.test.mjs) / Sep 6 04:23 (check-auth-invariant.test.mjs): symlink tests die with `EPERM: operation not permitted, symlink` (Windows host without Developer Mode) and grok-pwa injection tests expect platform-chrome output this checkout doesn't produce. Nothing in my diff is reachable from scripts tests.
- `npm run build` is currently RED on a sibling-owned import-protection error, active during my window: `[import-protection] Import denied in client environment … src/lib/engine.ts:2328 → "./wild-mode.server.ts"` traced via `src/components/console.tsx:38` (console.tsx mtime 08:18, engine.ts 08:22, wild-mode.server.ts 08:08 — all concurrent agent edits). My modules are not imported by any app code, so they cannot enter the client bundle.

## Caveats (parent reconciliation)
- Full-tree typecheck/build red state during my window comes from concurrently-running sibling pillar agents mid-edit (`src/components/console.tsx`, `src/lib/engine.ts`, `src/lib/wild-mode.server.ts`, earlier `src/lib/swarm.*`), plus Windows-host-environment scripts failures that predate the session. None of those files are imported by or related to my modules; my edits cannot cause or fix them. Re-run `npm run typecheck` / `npm test` / `npm run build` after siblings land for a clean all-tree gate.
