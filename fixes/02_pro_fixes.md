# Pro fixes — agent B (store + console + new io/handoff modules)

> Written by the parent after agent B hit its iteration cap before logging. Changes are
> verified on disk (typecheck 0, full TS suite 247/247, build green).

## New files
- `src/lib/io.ts` — pure helpers: `exportProjectJson`, `importProject` (JSON parse → shape
  validation: id/name/brief strings, exactly 13 phases, currentPhase 0–12, artifacts+logs
  arrays → `engine.hydrateProject` repair), `exportPacketText`, `slugName`, `downloadFilename`.
- `src/lib/handoff.ts` — `phaseHandoff(project, phase)`: role, mission, prior-phase artifact
  context, deliverable, machine-checkable DoD checklist from `dod.ts`, lattice+scheduler
  constraints, expected output format + single legal next edge.
- `src/lib/io.test.ts` (14 cases) + `src/lib/handoff.test.ts` (9 cases) — 26/26 combined.

## Modified
- `src/lib/store.ts` — added `exportProject(id): string|null` and
  `importProject(json): {ok:true;id}|{ok:false;error}` delegating to `io.ts`. No existing action disturbed.
- `src/lib/store.test.ts` — +6 cases (round-trip, null-on-missing, replace-same-id, prepend+select,
  invalid JSON, bad-shape leaves state untouched).
- `src/components/console.tsx` — "Export" downloads JSON; "Download packet (.md)"; "Import"
  (hidden file input → `store.importProject`, inline error); "Copy phase handoff" next to Execute;
  persistence-honesty note "Saved to this browser only · Export for backup".
- `src/lib/dod.ts` — A22: `runGate` on an unregistered phase returns `pass:false` + named unmet item.
- `src/lib/gate-stats.ts` — A27 (window on `requestedAt`) + A03 wrong-signal half (zero-mean from
  zero timed rows never flags `rubber`/`fast`).

## Verification
typecheck 0 · io/handoff 26/26 · store 28/28 · full TS suite 247/247 · build exit 0.
