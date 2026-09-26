# fixes/269_lane14_audit_wiring.md — W28 R14 · THE FULL-STACK WIRING TRACE (UI ↔ backend, every call edge)

**Lane:** R14 (W28 extension). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · START HEAD `e3d3fe4`.
**Deliverables:** (1) §R14 appended to `research/multiagent/thoroughanalysis.md` via the END-OF-FILE-MARKER-W25 protocol; (2) this lane log.
**Rules honored:** no keyed calls · no full-gate runs · **no product edits** · marker re-read before every append.

## Status: IN PROGRESS — skeleton first (per the W27/W28 write-early rule)

## Method (planned)
1. Read `wave_plans/W28/extension.md` §R14 + `wave_plans/W27/mass-investigation.md` (done).
2. Read `research/multiagent/thoroughanalysis.md` + `thoroughaction.md` + `AGENTS.md` (done).
3. Inventory: `src/components/**`, `src/routes/**`, `*.server.ts`, `createServerFn` sites, `fetch(`/`spawn`/network sites, `router.tsx`/`routeTree.gen.ts`, `vite.config.ts`.
4. Build the EDGE TABLE: user action (component) → store action → server-fn/route → lib call → side effect → return path. Verdict per edge: wired ✓ / broken ✗ / dead (no caller) / ghost (calls nothing), each with file:line.
5. Fix specs per broken/ghost/dead item.
6. Append §R14 above the end-marker (re-read first), then finalize this log.

## Evidence notes (as read)
- TBD (file:line anchors accumulate below).

## Edge catalogue (DRAFT — built during the trace)
| # | From (action/component) | To (store → server-fn/route → lib → side effect) | Verdict | file:line |
|---|---|---|---|---|
| — | (filling in) | — | — | — |

## Findings (R14-fNN)
- TBD.

## Verification performed
- TBD (read-only greps/reads; commands quoted).
