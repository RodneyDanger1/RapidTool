# Deterministic SVG diagram module — src/lib/diagram.ts + diagram.test.ts (flash agent #3)

- **Files touched:** NEW `src/lib/diagram.ts`, NEW `src/lib/diagram.test.ts`, NEW `fixes/29_agent_diagram.md` ONLY (repo root `C:/Users/mnril/Desktop/RapidTool Main`, NOT git). All other files read-only.
- **Date / agent:** 2026-09-06 · Flash agent #3 (vector/architecture diagram module).
- **Inputs:** `src/lib/types.ts` (Project/PhaseRecord/Artifact/ArtifactKind), `src/lib/phases.ts` (PHASES 0..12 codes/titles/hitl), `src/lib/dod.ts` (gate-state semantics), `src/lib/engine.ts` (`emptyProject` state shapes — read-only), `src/lib/testing/fixtures.ts` (seedProject/runHeadless for tests). `research/multiagent/11_agency_plan.md` not present — skipped.
- **Zero deps:** pure string builders — no DOM, no libs; deterministic (same Project ⇒ byte-identical SVG). Valid standalone SVG 1.1: `xmlns` + `viewBox` + dark `#0d1117` background + system font stack; no external fonts/images/CSS/JS.

## 1. Export surface (what the UI/merge owner codes against)

| Export | Shape | Notes |
|---|---|---|
| `buildDiagram(project, kind)` | `(Project, "phases"\|"architecture"\|"flow") → string` | Complete standalone SVG. Throws `Unknown diagram kind: …` on junk. |
| `buildPhasesDiagram(project)` / `buildArchitectureDiagram(project)` / `buildFlowDiagram(project)` | `Project → string` | Per-kind entry points (thin, still fully standalone). |
| `resolvePhaseStatus(project, phase)` | `→ "complete"\|"current"\|"ready"\|"locked"\|"blocked"\|"awaiting_hitl"` | Visual status used by the pipeline; reusable by UI. |
| `resolveFlowHighlight(project)` | `→ { node: "handoff"\|"run"\|"gate"\|"approve"\|"sealed"\|"reject", reason: string }` | Which flow node is live + one-line reason. |
| `STATUS_THEME` / `KIND_THEME` / `DOC_THEME` / `UNKNOWN_KIND_THEME` / `THEME` | fill/stroke (per-status adds `text`) | Dark-theme palette; `KIND_THEME` covers all 16 `ArtifactKind`s, pairwise-distinct fills & strokes. `kindTheme(kind)` falls back to the unknown theme for out-of-union runtime junk. |
| `DIAGRAM_KINDS`, `type DiagramKind`, `type PhaseVisualStatus` | | Vocabulary. |

## 2. The three views

- **`phases`** — two-row serpentine pipeline, 13 boxes P0..P12 (row 1 = P0..P6, row 2 = P7..P12, both L→R; P6→P7 elbow wrap). Arrows only on legal `Pn→Pn+1` edges (11 horizontal + 1 wrap). HITL phases (def.hitl ⇒ 4, 5, 8, 9) carry a purple diamond above the box (`data-hitl="true"`, assertable). Per-box `data-state` + status legend at the bottom (all six states + HITL gate).
- **`architecture`** — every `project.artifacts` box, colored by kind, in deterministic phase bands (sorted by phase → kind → title → id, grid 4/row, cap 72 with a `+N more …` note). Band labels in a fixed left column (code + tiny phase title). Header shows artifact/phase counts. **Specification layer strip** at the bottom, derived from Project fields (`data-kind="contract|openapi|adr"`) with counts/version subtext.
- **`flow`** — current-phase gate path: Handoff → Execute → gate diamond (label says `DoD + HITL gate · human decision` when `phaseDef(id).hitl`, else `DoD gate · machine checks`) → Approve/seal → Advance to next phase, with a Reject node and dashed red retry loop back into Execute. Status chip top-right (`<status> · <code>`). Exactly one node carries `data-highlight="true"` (yellow) per `resolveFlowHighlight`; a legend explains active-path vs retry-loop.

## 3. Semantics decisions (read before reviewing)

- **Status resolution order** (documented in `resolvePhaseStatus` JSDoc): sealed record ⇒ `complete` (survives a blocked project); project `blocked` ⇒ every unsealed phase `blocked` (engine parity: a rejected record lives under project status `blocked`); awaiting record ⇒ `awaiting_hitl` (beats the bare current-phase highlight); `running`/`rejected` records or `currentPhase` ⇒ `current`; other `ready` records ⇒ `ready`; else `locked`. Fresh seed ⇒ P0 `current`, rest `locked`.
- **Specification layer instead of artifact kinds `contract/adr/openapi/design`:** those four are NOT in `ArtifactKind` (types.ts: scorecard|graph|memory|mcp|security|validation|code|research|ui|cicd|edge|tools|docs|packet|algorithm|gate). Docs live on `Project.contracts/openapi/adr`, so the honest mapping is the derived strip; the parent brief's `design` kind does not exist anywhere in the model. Flag for the merge check if a UI spec says otherwise.
- **XML safety:** every label passes `esc()` (`&<>"'`) and a control-char strip + whitespace collapse + `…` clamp; coordinates go through a finite-integer helper (`NaN`/`Infinity` can never reach an attribute — regression-tested). No `Date`/`Math.random`/Map-iteration anywhere in layout.

## 4. Verification (all green at write time)

- `node --experimental-strip-types --test src/lib/diagram.test.ts` → **34/34 pass** (8 suites; ≥10 required). Coverage: valid standalone shell per kind; tag-balance well-formedness; determinism (same object, and across separately-seeded normalized projects); escaping of `<script>`, `&`, quotes + control-char strip; no NaN/Infinity/undefined over full-run/fresh/blocked/sparse projects; 13 boxes + P0..P12 codes; all-complete full run in theme fills; 11+1 legal edges; 4 HITL diamonds; 6-status legend; resolvePhaseStatus unit matrix; pairwise-distinct status/kind palettes; per-status theme fills on boxes; blocked project ⇒ 11 blocked boxes; band grouping order + no shared slots; full-run arch = 18 kind-themed boxes + contract/openapi/adr strip; unknown-kind fallback; empty state; 72-cap + overflow note; ellipsis truncation; flow highlight matrix (gate/sealed/handoff/run/reject) + human-vs-machine gate labels + next-phase advance label + P12 terminal.
- `npm run typecheck` → 0 errors. `npx eslint src/lib/diagram.ts src/lib/diagram.test.ts` → clean. `npx prettier --write` applied to both files.
- **Visual QA:** all three kinds rendered via Playwright screenshots for full-run, parked-at-P4, and blocked states — no overlaps, no clipped glyphs (ellipses clean), arrows correct, band labels aligned, spec layer separated, highlight semantics correct (execute yellow while running, reject yellow when blocked).

## 5. Merge notes

- **`package.json` wiring (NOT done — outside ownership):** append `src/lib/diagram.test.ts` to the `"test"` script's `node --experimental-strip-types --test …` file list so `npm test` picks the suite up. Until then run it standalone with the command in the file header.
- Determinism holds only for pure reads — never feed `runHeadless`/`runToGate` outputs across separate runs into equality tests (engine stamps ids/timestamps); the suite normalizes seeds for that case.
- `buildPhasesDiagram`/`buildArchitectureDiagram`/`buildFlowDiagram` are exported for direct use; `buildDiagram` is the intended single entry point.
