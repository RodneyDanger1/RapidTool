# W45 / 331-3 — "Transit" — emitted-artifact integrity

Read `wave_plans/W45/README.md` first. Your log: `fixes/331_3_transit.md`.

## Owned files (STRICT)

`src/lib/headless.ts` · `src/lib/scaffold.ts` · `src/lib/compile-check.server.ts` + their colocated
`*.test.ts`.

## Mission

Guarantee the factory can never ship a product that cannot load, and materialize what it currently
refuses.

**T1 — the zero-row early return (this is the fix the 330 lane explicitly could not land; see
`fixes/330_1_transit.md` §6.1).** `headless.ts:2038-2039`: `materializeEmitTree` early-returns when
`Array.isArray(project.generatedTree) ? … : []` has **zero rows**, so a lone `generatedSource`
carrying CommonJS residue (`module.exports.add = add`) is **never materialized** into the
`"type":"module"` package. The 330 lane handled the symptom by making the emitter **refuse**
(its Fix A); the ideal fix it named is to **drop the zero-row early return and materialize
`generatedSource` too** (path `TREE_ENTRY_PATH` / the planned host) so every path **converts**
rather than refuses. Land that, and confirm Fix A's refusal still fires only where conversion is
genuinely impossible.

Repro it first, on a scratch dir **outside the repo**: a project record with `generatedTree: []` and
`generatedSource = "function add(){…}\nmodule.exports.add = add;\n"`, then `emit`. Expected today:
`ok:true` + an unloadable module. Expected after: a loadable ESM module (or a coded refusal with a
reason that survives review).

**T2 — every emit path is guarded.** After T1, sweep `headless.ts` and `scaffold.ts` for any other
place residue can reach an emitted file unmaterialized (direct `scaffoldProject` callers, the
`repairTreeDir` re-import path, `--force` survivors). `compile-check.server.ts` must **load the
product's generated core** (the 330 lane's Fix B) — keep that and extend it if T1 opens a path Fix B
does not cover.

**T3 — the emitted job is still a throwing stub.** Keyless `create` → `gate --autopilot` → `emit` on
`research/eval-corpus/house-flip-manager.md` writes exactly one job file (`src/jobs/flip.ts`) whose
body is `throw new Error("RT_E_VALIDATION · TODO(E-15) stub: implement job flip")`. Report what the
**scaffold** can honestly do about that given the keyless floor (a deterministic contract-faithful
body derived from the recorded oracle rows/signatures vs. an honest refusal) — and coordinate the
plan-shape half with **331-4** (`codegen.server.ts` owns `treeChunkPlan`/`orderTreeChunks`; per
cross-lane contract C1 you implement the consumer side). **Do not fake a job body**: a body that
returns a made-up value while claiming to satisfy an oracle row is worse than the honest stub.

## Rules

Node 22 pinned at `%LOCALAPPDATA%\hermes\node\node.exe`; also record host Node 24. No full gate.
Keep scratch projects/probes **outside the repo** (`%TEMP%\rt331_transit\…`) — the repo must never
gain a probe file. Targeted suites:
`node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts`
(+ `headless.test.ts`, `compile-check.server.test.ts`). Patch-only, explicit `.ts` extensions,
append-only log, no fabrication, no secrets, never run `npm run eval`.

## Report back

Verdict · the T1 probe bytes before/after (a real load of the emitted module) · the guard sweep result
per path · what you decided about T3 and why · tests added + real results · anything you stopped on.
