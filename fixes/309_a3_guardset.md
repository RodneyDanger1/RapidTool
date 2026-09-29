# fixes/309_a3_guardset.md — A3 · THE PACKET + CHECKPOINT GUARD SET (M3-13..18 · M3-08/09 · M4-16)

> Wave 308 fixers · A3 lane. HEAD `7055994` (suite green at open; clean tree except
> `scripts/rapidtool-cli.mjs` from a sibling — untouched by this lane).
> Box (sole writer): `src/lib/packet.ts` · `src/lib/checkpoint.server.ts` · `src/lib/store.ts`
> · `scaffold.ts` call-site only (M4-16) + their colocated tests. Siblings live: engine/store(P-*),
> rt-ring/diagnose (C), UI rail (D), claims (M4). Mandate: BUGS ONLY · no keyed calls · legs
> FOREGROUND · PATCH-FIRST. Source rows: `fixes/308_map3_runtime.md` (M3) + `fixes/308_map4_claims.md` (M4-16).
> Log opened pre-edit per brief — 2026-09-29, A3.

## 0 — Status board (updated as hunks land)

| Row | Result | Evidence (file:line → pin) |
|---|---|---|
| M3-15 brief:42/null | TODO | — |
| M3-13 compileAgentPacket(null) | TODO | — |
| M3-14 compileAgentPacket({}) | TODO | — |
| M3-16 schedule.extraHitl junk | TODO | — |
| M3-17 packetInputHash(null) | TODO | — |
| M3-08 checkpointAdmits(ckpt,null ask) | TODO | — |
| M3-09 boundProjectForCheckpoint(null) | TODO | — |
| M3-18 convergeRealRun junk | TODO | — |
| M4-16 deplyNotes/deployNotes twin | TODO | — |

**Fix pattern (from the map):** guard-at-entry → a coded refusal or a safe default, mirroring each
file's own guard idioms (`Array.isArray(x) ? x : []`, handoff.ts `text()` coercion precedent);
pin = the exact repro asserting the coded/safe outcome, never a throw.

**Legs:** per-touched-file foreground:
`node --experimental-strip-types --test src/lib/packet.test.ts` · `… src/lib/checkpoint.server.test.ts` ·
`… src/lib/store.test.ts` · `… src/lib/scaffold.test.ts`.

## 1 — Landings (evidence per row)

_(filled below as hunks land)_
