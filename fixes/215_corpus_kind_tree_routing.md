# 215 — corpus delivery-kind now reaches Project.kind (multi-file tree routing)

## What was broken

`run-eval.mjs` parsed the corpus frontmatter `kind: "webapp"` into `entry.kind`
but `createProject({ brief, name })` **dropped it**. `Project.kind`
(`"app"|"tool"|"game"`, E-15) stayed `undefined` on every eval entry.

Consequence: `singleModuleLibraryKind()` (codegen.server.ts) saw kind-absent →
true, so **every** declared webapp brief routed to the ≤8-signature
single-module path — shipping `generatedTree = [src/generated.ts]` ("tree 1
file(s)") and leaving the per-job scaffold nodes (`flip`/`record`/`publish`/
`show`) as TODO(E-15) stubs or reexport bridges.

The engine's `upgradeP6Keyed` brief-classifier (`uiKindOf`) stamps kind *only
as a fallback* at the live-layer P6 seam — and only when the caller is the
engine layer. The eval driver's `driveP6Journey` path could not rely on it, and
the corpus contract should be authoritative anyway: a `kind: "webapp"` brief is
a declared multi-file surface, not a library to guess.

## Fixes

1. **`emptyProject`** (engine.ts) — accepts optional `kind?: Project["kind"]`
   and stamps it on the project (additive; absent → byte-identical floor).
2. **`createProject`** (headless.ts) — forwards `kind`.
3. **`run-eval.mjs`** — `deliveryKindOf(entry.kind)` maps the corpus contract
   `webapp/app → "app"`, `game → "game"`, `tool/cli-tool → "tool"`, and
   `library/service/""` → absent (honest single-module library path). Passed
   through to `createProject` so the declared kind reaches `Project.kind`.

## Effect (keyed path only)

A keyed eval on a `kind:"webapp"` corpus entry now routes through
`synthesizeChunkedTree` (per-capability files + assembled tree entry) instead
of `synthesizeSingleModule`. This is the *actual* mechanism by which leftover
per-job stubs become real synthesized modules — no invented bodies; the tree
still must compile + pass its oracle specs + pass the P6 DoD gate to count.

Keyless floor is unchanged (byte-identical; kind has no effect without a key).

## Still false

- Not an autonomous software factory; not competitor-beating.
- Real flip/record/show/publish bodies still need keyed P6 + human fixtures.
- `keyed --all` still user-gated.
