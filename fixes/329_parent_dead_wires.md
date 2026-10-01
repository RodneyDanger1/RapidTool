# 329 · PARENT — dead-wire closures after the 328 wave

**Actor:** the wave parent (the 5 personas had stopped). **Tree:** working copy on `main`,
HEAD `7217b0c` (the 328 wave) + the edits below. **Runtime:** repo-pinned Node 22.23.2
(`%LOCALAPPDATA%\hermes\node\node.exe`) and the host default Node 24.15.0.

## Why this round exists

The 328 personas each STOP-AND-REPORTED a defect that lived outside their owned files
(rule 5). Those are cross-file, so the parent owns them. Three were real and bounded; the
rest are recorded below as honest forward work.

## Fixed

### 1. `engine.ts` declared LESS of the live-layer seam than it forwards (type lie)

`LiveLayerDeps` (`engine.ts:3062`) declared only `treeFailure` / `gateRepair`, and the codegen
import cast (`:3126`) declared only those two — while the real values on that object include
`deps.synthesisRefusal` (set by `p6CycleLiveDeps`, read by codegen since 328 P1) and
`deps.patchRepairs` (set by the repair drivers, read by codegen since 216r). The object is
passed by reference so nothing broke at runtime, but the seam's TYPE described less than the
wire carries — a caller could not pass or see either field without a cast.

Fix: both the type and the cast now name `synthesisRefusal?: string` and `patchRepairs?: boolean`.
Flagged by 328 P1 ("`engine.ts:3062` … and the cast at `:3126` omit `synthesisRefusal` … blast
radius `engine.ts` only").

### 2. `exportedNamesOf` did not inventory ESM re-export lists (328 P3's stated limit)

`algo-tools.ts` inventoried CJS assignments and every ESM *declaration* form (incl. 328 P3's
multi-declarator + destructuring), but not `export { a, b as c }` / `export { x } from "…"` —
the module's real, consumable export surface. The prompt tells the model "the module exports
these names ONLY", so a re-export list read as "(none)".

Fix: an `export { … }` list parser that adds the EXPORTED name (alias wins: `b as c` → `c`),
skips inline `type` specifiers, and never matches `export type { … }`. Two tests added
(alias/local forms, re-export-from, plus controls: a type-only list, an inline type specifier,
and masked strings/comments contributing no phantom). `algo-tools.test.ts` **38 → 40**.

### 3. `provenRowsFromStore` had no production caller (328 P5's T4 finding)

`knowledge.ts:167` is the documented store → rankable-rows resolver ("the missing half" of
216g/112 T4), and `packet.ts` already consumes `opts.proven` — but the only callers were tests,
while the CLI's `packet --knowledge` arm reimplemented the same logic inline with
`new KnowledgeStore(...).injectProven(...)`, so a read failure could only throw.

Fix: the CLI now calls `provenRowsFromStore` and surfaces its **degraded** state as the same
coded refusal the arm always returned. Smoke (real bytes, both paths):
- fresh store → `packet --knowledge <new store>` **exit 0**, `ok:true`.
- directory as `--knowledge` → **exit 4**, `ok:false`, `code:"RT_E_VALIDATION"`, error names the
  store's own reason ("is not valid JSON (EISDIR …). Refusing to overwrite append-only data").

## Recorded as forward work (verified present, deliberately NOT blind-wired)

| Finding | Anchor | Why not wired here |
|---|---|---|
| `judgePhase` has no production caller | `judgment.ts:149`; callers = `judgment.test.ts` only | Wiring it into the engine is a behaviour change to the phase verdict path — it needs its own wave spec (which rung applies at which phase), not a blind call site. |
| `harvestEvidenceLesson` / `harvestResultLesson` never run | `harvest.ts:714`, `harvest.ts:761`; callers = `harvest.test.ts` only | Lesson capture must not mint rows without proof (112 T2) and the permanent store is human-write-only; choosing the record seam is a design call. |
| T4's *synthesis-prompt* half | `codegen.server.ts:3034/3121/3464`, `engine.ts:679` pass `{ limit }` only | The rows now reach the PACKET; reaching the expansion prompt needs a store path/rows threaded from the CLI into the journey (a new flag + 4 hops). The engine is pure, so the resolver must stay at the edge. |
| `RT_E_UNATTENDED_UNSUPPORTED` has no emitter | `errors.ts:79/:533`, `scripts/README-cli.md:998` | **Not a bug**: the CLI doc already declares it `— (no live emitter today; console surface)`, alongside `RT_E_NOT_IMPLEMENTED` / `RT_E_MCP_DISABLED` / `RT_E_GIT_UNAVAILABLE`. The claim matches disk. |
| R6-f12 forced-throw pin | `console.tsx` PaneBoundary | Needs a DOM harness; the src leg runs `src/lib/*.test.ts` only (no jsdom / testing-library). |
| Emitted-tree ESM artifact defect | tracked `research/eval-out/…/src/generated/get-property.ts:250` (`module.exports = …` in an ESM package) | It is a TRACKED eval artifact — editing it would falsify recorded trial evidence. Regeneration is the honest path. |
| Service/console entry emitters | `scaffold.ts` `emitKindEntry` | 328 P2 refused rather than fake: wiring them is only real for a keyed run with recorded endpoints, and there is no such fixture to verify against. |

## Verification

See the gate block in the wave commit: typecheck / lint / scripts leg / src leg on BOTH
Node 22.23.2 and Node 24.15.0, after every writer stopped.
