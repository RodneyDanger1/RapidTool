# Vault tab in console.tsx — MOC + notes + search + copy/download + [[wikilinks]] (flash agent #4)

- **File touched:** `src/components/console.tsx` + `src/styles.css` ONLY (repo root `C:/Users/mnril/Desktop/RapidTool Main`, NOT git). All other files read-only.
- **Date / agent:** 2026-09-05 · Flash UI agent #4 (vault panel + polish).
- **Inputs:** `research/multiagent/05_guide_research.md` §2.3 + §5 Agent-D (the frozen vault.ts contract Agent-B codes against) — consumed blind since `src/lib/vault.ts` had not landed at write time.
- **Concurrency note:** typecheck at write time showed ONLY missing-module errors — console.tsx's `@/lib/vault` import + `src/lib/headless.ts(431)` `vaultModuleAvailable` (Agent-C's in-flight file). Both resolve when Agent-B's vault.ts lands; re-run `npm run typecheck` after the merge.
- **Additive only:** every change is an addition (one union member, one trigger, one content panel, one component) or a label reword (Tabs.List aria-label). No existing control flow, handler, or style was rewritten.

---

## 1. Vault tab (consumes vault.ts's exact export surface)

Consumed blind against the §2.3 contract, frozen in the research doc that Agent-B codes against:

| Export (contract §2.3) | Consumed by |
|---|---|
| `buildVaultNotes(project) → VaultNote[]` | `useMemo` in `VaultPane` — the vault's note list (MOC hub entry included, `kind === "moc"`) |
| `vaultIndex(notes) → {mocs, byKind, byTag, links: Map<id,id[]>, backlinks: Map<id,id[]>}` | `.backlinks.get(active.id)` for the Obsidian-style “Linked from” panel (only the doc-frozen Map member is read) |
| `vaultMarkdown(notes) → string` | “Copy whole vault” + “Download vault.md” (blob, `downloadFilename(project, "md")` from io.ts) |
| `searchVault(query, notes) → {note, score}[]` | search box; **query-first order per §2.3** (parent brief listed notes-first — flagged for the merge check) |
| `type VaultNote` | All rendering keys off the frozen fields only: `id, title, kind, phase, tags, body, links, score?, source?, url?` — never `mocs/byKind/byTag` inner shapes (not frozen in §2.3) |

New UI in the `vault` tab (added after the `oracle` trigger/content, matching the existing `forceMount` + `data-[state=inactive]:hidden` panel pattern):

1. **Toolbar** — search input (`aria-label="Search vault notes"`; filters through `searchVault`, ranked results shown flat with `score.toFixed(2)` badges), “Copy whole vault” (`vaultMarkdown` → clipboard, label flips to “Copied vault”), “Download vault.md” (`Blob` text/markdown → `downloadFilename(project, "md")`, revoke after 1 s — mirrors the existing `downloadPacket`/`downloadJson` pattern).
2. **Tag chips** — derived from `VaultNote.tags` + counts (`#tag · n`), toggleable filter (`aria-pressed`), composes with search. Grouped headers never read `vaultIndex.byTag` (shape not frozen) — tags come from the frozen note field.
3. **Navigator list** — MOC hub pinned at top under a “Map of content · n” header; remaining notes grouped by kind (headers via `humanizeKind`); **default detail selection = the MOC hub note first** (auto-fallback keeps a visible selection when search/tag filters hide the old one, mirroring `ArtifactPane`'s `activeArt`).
4. **Note detail** — mono caption (`kind · P{phase} · title`, `map of content` for hub), per-note **Copy note** button (copies the markdown `body`; flash + `role="alert"` error on clipboard failure), honesty badge when `source` is present (`cited` ok-tone / `illustrative template` warn-tone, matching the M-01 scorecard badges) with optional `url` link (`target="_blank" rel="noreferrer"`), body rendered **monospace pre-wrap**, `tags:` line, and a **“Linked from”** backlinks panel (each backlink is a button that navigates).
5. **Clickable [[wikilinks]]** — `renderVaultBody` splits body text with `WIKILINK_RE = /\[\[([^[\]]+)\]\]/g` and renders each link as a `<button class="vault-link">` that switches the selected note. Aliases `[[id|label]]` and heading links `[[id#h]]` tolerated (display = alias ?? raw target). Resolution: exact `id` first, then `title` match (both frozen fields). **Dangling links** (target not in the vault) render as disabled buttons (`vault-link-dead`: dashed border, strike-through, `--color-faint`) — Obsidian's unresolved-link style, with `title`/`aria-label` naming the missing target.
6. Empty states: no notes → “run a phase to write memory rows and artifacts into the vault”; search/tag with no hits → “No notes match this filter.”

## 2. a11y / theme-consistency polish

- `RunTab` union grew `"vault"` (line ~74); Radix `Tabs.Trigger value="vault"` reuses the exact trigger classes of its siblings.
- `Tabs.List` `aria-label` reworded “Run artifacts and agents” → “Run artifacts, agents, and vault notes” (list was gaining a tab whose content is neither an artifact nor an agent).
- Rows: `aria-current="true"` on the active note button; `aria-pressed` on tag chips; icon-bearing buttons all carry visible labels + `aria-label`s; the pane-level error renders `role="alert"`.
- **styles.css:** new `.vault-link` / `.vault-link-dead` component classes use ONLY `--color-*` tokens + `color-mix` (same technique as the existing `::selection` rule), so both `data-theme="light"` and default dark re-theme them automatically — no raw hex added. Global `:focus-visible` accent outline already covers the chips; `prefers-reduced-motion` block untouched.

## 3. Notes / risks for the merge

- **searchVault param order:** UI calls `searchVault(query, notes)` (doc §2.3, lines 31/74/112 all query-first). If the landed vault.ts instead ships notes-first, flip the two args in `VaultPane`'s `results` memo.
- **vaultIndex usage:** only `backlinks` (a `Map<id, id[]>` per §2.3) is read; `mocs/byKind/byTag` inner shapes are not frozen, so the UI deliberately derives MOC/tags/groups from `VaultNote` fields instead.
- Selection state is pane-local (`selectedId`, `q`, `tag`) — no store changes; the vault is a pure view over the existing project, so nothing new persists and Export/Import round-trips are unaffected.
- MOC hub default-open means a project with zero memory/artifacts still shows the hub note (buildVaultNotes returns the MOC entry per the contract's empty-project test).
