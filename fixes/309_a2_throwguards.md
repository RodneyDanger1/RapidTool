# fixes/309_a2_throwguards.md — A2 · THE rt-ring + diagnose THROW-GUARD CLUSTER (M3-01..07 · M3-10..12)

> Wave 308/309 fixers · A2 lane. HEAD at open `2d2c74a` (task brief said 7055994 — HEAD moved;
> suite green at open). Working tree at open: sibling edits `scripts/rapidtool-cli.mjs`,
> `src/components/console.tsx`, `src/components/pipeline-rail.tsx`, `src/lib/rt-client.test.ts`
> + sibling logs `fixes/309_a1_wildverb.md` / `309_a3_guardset.md` / `309_a6_uiwire.md` — all
> untouched by this lane.
> **Box (sole writer):** `src/lib/rt-ring.ts` · `src/lib/diagnose.ts` + their colocated tests
> + this log. Siblings live: packet/checkpoint/store (A3), UI rail (A6), wild verb (A1).
> **Mandate:** BUGS ONLY · no keyed calls · legs FOREGROUND · PATCH-FIRST · no full gates.
> **Source rows:** `fixes/308_map3_runtime.md` (18-row MAPPER-3 map; repros = `~/rt308_m3/hostile1.ts`,
> baseline log `~/rt308_m3/probe1_full.log` — `cases=98 ok=76 throw=22 coded=0`).
> Log opened pre-edit per brief — 2026-09-29, A2.

## t0 — recon (fresh bytes, this run)

**Baseline (probe of record, `probe1_rerun.log`): the 11 A2 rows, all raw throws (coded=0):**

| M3 | repro | before (file:line → error) | class |
|---|---|---|---|
| M3-01 | `rtPush(ring,null)` / `(ring,undefined)` | `rt-ring.ts:117:31` → `TypeError: reading 'ts'` | MED |
| M3-02 | `rtPush(ring,row,{cap:-3})` | `rt-ring.ts:139:13` → **7.8 s spin** then `RangeError: Invalid array length` | **HIGH** |
| M3-03 | `rtPush(ring,row,{cap:NaN})` | `rt-ring.ts:138` → cap silently OFF (NaN compare false), row uncapped | LOW |
| M3-04 | `rtPush(null,row)` | `rt-ring.ts:127:21` → `TypeError: reading 'rows'` | MED |
| M3-05 | `rtTail(null,3)` | `rt-ring.ts:240:15` → `TypeError: reading 'rows'` | LOW |
| M3-06 | `rtStats(null)` / `rtStats({rows:[null]})` | `rt-ring.ts:245:21` / `:250:11` → `TypeError: reading 'rows'` / `'level'` | MED |
| M3-07 | `rtSerialize(null)` | `rt-ring.ts:156:21` → `TypeError: reading 'sessionId'` | LOW |
| M3-10 | `buildDiagnosis(null)` | `diagnose.ts:144:38` → `TypeError: reading 'errors'` | **HIGH** |
| M3-11 | `buildDiagnosis({…errors:[null,5,{…}]})` | `diagnose.ts:212:9` → `TypeError: reading 'scope'` | **HIGH** |
| M3-12 | `crashSnapshot {at:"y"}` (any junk) | `diagnose.ts:283:68` → `RangeError: Invalid time value` | MED |

Adjacent probe cases that move with these guards (same call sites, currently thrown or junk):
`diag.watchdog-junk` (crashSnapshot `{at:"y",href:3}` → same :283 RangeError),
`diag.crashSnapshot-junk` (`crashSnapshot:42` → `(42).at` = undefined → :283 RangeError).

**Convention recon (why these guards look the way they do):**

- `rt-ring.ts` own posture = **never throws** (`rtHydrate` :176-181 "Corrupt/invalid → empty ring
  + recoveredCorrupt … Never throws"; `rtRowBytes` :89-95 try/catch → 0; `serializedRowsBytes`
  fallback). AGENTS.md contract §7: telemetry "must never throw into the code it observes" —
  so refusals here are **safe defaults**, not throws (the write-set style of coded throw is for
  validators; these are telemetry builders). `isRtEventLike` (:165-174, private) is the file's
  row-shape predicate — the natural single source of truth for "junk row".
- `diagnose.ts` own idiom = **floor every field** (`?? default` :146-163; `now` non-finite → 0
  :145; `Array.isArray` floors :144/:162). `{}` input already yields the honest empty-shape
  diagnosis (probe `diag.empty-obj` = OK, `none-detected`), so `null` must floor to the SAME
  shape, not a throw (`buildDiagnosis` is called live from the Runtime Log pane — a throw there
  is the R4-f06 UI-crash class; rt-client.ts:268-276 records that incident).
- Wave precedent (`fixes/294_n1_throws.md`): "land the smallest honest guard" with the file's
  own guard idiom; pins assert the CODED outcome (no raw TypeError/RangeError, no swallow).

## Plan (per row → guard → pin)

| Row | Guard (smallest honest) | Pin asserts |
|---|---|---|
| M3-01 | non-row (null/undefined/scalar/array) → no-op `{ring, dropped:[]}` | push of 5 junk shapes never throws; ring unchanged |
| M3-02 | junk cap (non-finite or <1) → module default `RING_CAP` (the `?? RING_CAP` idiom) | repro `cap:-3` completes **<50 ms**, no throw, row lands bounded |
| M3-03 | same normalize (NaN → `RING_CAP`) | 205 pushes with `cap:NaN` → ring holds exactly `RING_CAP` |
| M3-04 | junk ring → start fresh (`createRtRing()`) — rtHydrate's own posture; row still lands | `rtPush(null,row)` → fresh ring, 1 row, no throw |
| M3-05 | junk ring in `rtTail` → `[]` | `rtTail(null,3)` deepEquals `[]` |
| M3-06 | junk ring → zero-shape stats (`sessionId:""`); junk rows skipped in counters/ts window | `rtStats(null)` zero shape; `rows:[null,{level:"error"},5,…]` counts 1 error, no throw |
| M3-07 | junk ring → empty serialized frame (hydrates clean) | `rtSerialize(null)` → parses, `rows:[]`; `rtHydrate` of it = clean empty ring |
| M3-10 | `input ?? {}` (cast) — floor the input like every field; reuse `src` reads | `buildDiagnosis(null)` → `ok:true`, `errors:[]`, `none-detected` |
| M3-11 | filter `errors` through `isRtEventLike` (now exported from rt-ring) | junk rows dropped, real row still ranks (`unclassified-errors`, `errors[0]`) |
| M3-12 | non-object snapshot → absent; junk `at` → keep the match with honest "unreadable timestamp" text; junk `href` → "unknown href" | `{at:"y",href:3}` → `freeze-pre-capture`, summary carries "unreadable", no RangeError; `42` → not a snapshot |

Notes on deliberate deviations: (a) M3-02/03 fall back to `RING_CAP` rather than a floor of 1 —
the file's own absent-cap idiom, and floor-1 would silently nuke retained history (a fresh
silent-wrong of the same family); (b) M3-12 keeps the freeze-pre-capture match for a junk `at`
(a snapshot WAS imported — refusing the signal would under-report an incident) and refuses only
the *timestamp claim*; (c) `byteCap` junk (not in the map — `rt.push-bytecap-neg` is currently
OK) left untouched, noted below.

## Landed (evidence appended as each hunk lands)
