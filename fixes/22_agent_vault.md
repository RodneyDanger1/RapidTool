# 22 — Vault module landed: exact exports for the CLI/UI agents (Agent-B → C/D handoff)

**Status:** `src/lib/vault.ts` + `src/lib/vault.test.ts` are LIVE. Typecheck 0, full
suite green (370/370 under the mandated command). **Code against these EXACT
exports** — do not rename, do not re-derive shapes from `research/multiagent/05_guide_research.md`
§2.3 (that draft predates the frozen contract; differences listed at the bottom).

## Exact export surface (src/lib/vault.ts)

```ts
export type VaultNote = {
  title: string;          // unique per vault; collisions get " (2)", " (3)"… suffixes
  body: string;           // markdown, starts with "# {title}" EXCEPT artifact notes
  tags: string[];         // contract tags, e.g. ["memory", "episodic"], ["artifact", "code"]
  links: string[];        // BARE target titles (no [[ ]]); resolve against note titles
  phase?: number;         // PhaseId when the note is phase-scoped (absent on index/research)
  updatedAt: number;      // epoch ms, derived from project data (decidedAt / completedAt / createdAt)
  kind: "project" | "memory" | "decision" | "research" | "artifact" | "index";
};

export function buildVaultNotes(project: Project): VaultNote[];   // hub first, then P0..P12 spine, memory, decisions, research, artifacts
export function vaultMarkdown(notes: VaultNote[]): string;        // concatenated .md: per-note YAML-ish frontmatter (title/kind/tags/phase?/updatedAt) + body
export function vaultIndex(notes: VaultNote[]): string;           // MOC markdown: "## Map of Content" + "### Kind (n)" [[wikilink]] groups + "## Tag cloud"
export function searchVault(notes: VaultNote[], query: string): VaultNote[];  // ranked, see below
```

## Semantics the UI/CLI can rely on

- **Note set (one vault per project):** 1 hub (`kind:"index"`, title `<name> · Vault Index`,
  `links` = every other title, body embeds the MOC) → one phase-spine note per `PhaseRecord`
  (`kind:"project"`, phase = record id — these are the memory↔phase / decision↔phase
  wikilink targets) → every memory row (`kind:"memory"`) → every decision (`kind:"decision"`)
  → every research-corpus entry (`kind:"research"`) → top 10 artifacts by recency
  (`kind:"artifact"`, `body` = artifact body **verbatim**).
- **No dangling links, ever:** `links[i]` is guaranteed to equal some note's `title` in the
  same array. Memory/decision/artifact notes link their phase note; phase notes link their
  rows; research notes link the hub; the hub links everything.
- **Search ranking:** case-insensitive substring over title+body+tags, weighted
  title=4 > tag=2 > body=1 (summed); ties keep vault order. Blank query → `[]`.
- **Deterministic + pure:** same Project object ⇒ byte-identical output (no `Date.now()`).

## One-line usage examples

CLI (`search` subcommand): `searchVault(buildVaultNotes(project), query).slice(0, limit).map(n => n.title)`
CLI (`vault --out`): `vaultMarkdown(buildVaultNotes(project))` → write string to file.
UI (vault tab): `const notes = useMemo(() => buildVaultNotes(project), [project]); const moc = vaultIndex(notes); const hits = searchVault(notes, q);`
Link rendering: `<button>{title}</button>` where `title = note.links` entries are bare — wrap with `[[`/`]]` only when emitting markdown.

## ⚠ Differences vs the older §2.3 research-doc draft (05_guide_research.md)

| Draft (§2.3) | Frozen contract (what vault.ts actually exports) |
|---|---|
| `VaultNote.id` (slug) | **No `id` field.** Identity = unique `title`; use `byTitle` maps. |
| kind `"moc"` hub | kind `"index"` (see `VaultNote.kind` union) |
| `vaultIndex(notes) → VaultIndex` object (`{mocs, byKind, byTag, links, backlinks}`) | `vaultIndex(notes) → string` (MOC markdown). For backlinks, invert `links` yourself. |
| `searchVault(query, notes) → {note, score}[]` | **`searchVault(notes, query) → VaultNote[]`** — argument order swapped, plain notes returned. |
| phase notes in a separate kind / per-phase MOC hubs | phase spine notes are `kind:"project"` (title `P{n} · <Phase title>`), one per phase record; the hub is `kind:"index"`. |
| `links` = resolved targets w/ ids | `links` = bare note titles (no brackets, no ids). |
| `updatedAt`/`created` optional | `updatedAt` is required (epoch ms). |
