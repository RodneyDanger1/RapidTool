# W45 / 331-4 — "Composer" — codegen plan & census

Read `wave_plans/W45/README.md` first. Your log: `fixes/331_4_composer.md`.

## Owned files (STRICT)

`src/lib/codegen.server.ts` · `src/lib/doctor.ts` + their colocated `*.test.ts`.

## Mission

Make the multi-job **plan** real and the census honest, so the emitted product stops being one
module wearing one filename.

**C1 — the keyless floor emits ONE job, not the declared set.** Measured today:
`create --brief research/eval-corpus/house-flip-manager.md` → `gate --autopilot` → `emit`
produced `src/jobs/flip.ts` only (a throwing `TODO(E-15)` stub). `doctor` reports
`leftoverJobsAreReexportsOrStubs: true`, and its gap text names the shortfall. `engine.ts:1396`
already computes `jobScopeShortfall(project.lattice?.jobs ?? null, materialised)` via
`doctor.ts:148`; the **plan** side is `treeChunkPlan` (`codegen.server.ts:1776`) /
`orderTreeChunks` (`:3475`) with the recorded W5-L1 tension (a corpus signature split
non-contiguously at index 8, so sibling chunks must import earlier files in **reverse
signature-index order** or the tree emits a forward call).

Deliver: the plan produces a node/file per **declared** job (bounded, deterministic, in the recorded
order), so the emitted tree has one module per job with its own oracle row — or, where the recorded
evidence cannot support a node, the shortfall is **counted and surfaced** (warning + README line +
`doctor` field), never silently dropped. Exact census to move: today's emitted tree vs
`{reexports:0, stubs:0, real ≥ 3}` is the M-A bar.

**C2 — `doctor --tree` census must be real.** Probe it today: `doctor --tree <dir>` returned
`inventory: null` on a just-emitted tree. Determine the real invocation and either make the census
run there or fix the documented invocation so a reader can reproduce
`{stubs, reexports, real}` from a real command. Cite the correct form in your log.

**C3 — contracts never reach codegen (register R10-f01 / AR10).** The brief's entities/endpoints do
not appear in emitted tree code. Verify on disk; if the wire is genuinely missing, land it (or
register it with evidence if it needs a file you do not own — see contract C1/C2).

**C4 — sweep your two files** for the classes the 330 wave found: unbounded prompt growth
(`R12-f01`: every prior file re-sent in every later chunk), slice-before-signature, claims the bytes
do not support, silent drops.

## Rules

Node 22 pinned at `%LOCALAPPDATA%\hermes\node\node.exe`; also record host Node 24. No full gate.
Scratch work **outside the repo** (`%TEMP%\rt331_composer\…`). Targeted suites:
`node --experimental-strip-types --test --test-reporter=tap src/lib/codegen.server.test.ts`
(+ `doctor.test.ts`). Patch-only, explicit `.ts` extensions, append-only log, no fabrication, no
secrets. **No keyed calls in a loop** — if you need one keyed proof, make it a single bounded call
and report usage; the keyed path is being repaired by **331-1** today, so keyed proof may have to be
recorded as owed.

## Report back

Verdict · the plan shape you landed and the census numbers before/after (real command + output) ·
the exact `treeChunkPlan`/`orderTreeChunks` contract 331-3 must consume (per C1) · tests added +
real results · anything you stopped on.
