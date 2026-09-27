# 281 · N1 — THE RESCUE + UNIVERSALITY COMPLETION (`scaffold.ts` owner)

**Lane owner:** N1 (W36 completion wave). **Box:** `src/lib/scaffold.ts` + `src/lib/codegen.server.ts` (R3-f02 prompt text ONLY) + run-eval **structure** coordination with N5 (N5 owns assertion logic + label population — see `fixes/281_n5_ops.md` item 3). Repo: `C:\Users\mnril\Desktop\RapidTool Main`. HEAD `0f85c32` + W29–W36 uncommitted era.
**Sources:** `wave_plans/W36/completion.md` (N1 brief) · `fixes/277_l1_universality.md` (9-item board, 7 claimed / 6 remaining anchors) · `fixes/272_s2_universality.md` (touch-point map + constraints).
**Contract:** smallest honest patches · additive only · `TODO(<id>)` at the exact logic line · no fake behavior · targeted checks only (NO full gates; NO keyed calls) · log-and-continue · webapp bytes unchanged · `scaffold.test.ts:338` (E-15 sweep) · `emitted-honesty.test.ts:42` (`RT_E_VALIDATION · ` prefix).

## Ground truth at lane start (scoped tsc, 20:0x)

`npx tsc --noEmit` → exactly 4 errors, all `src/lib/scaffold.ts` (the known transient break):
- `(1021,10) TS2488` — `...genBody` spread: `uiGeneration()` returns `string[] | null`; no null-fallback to `defaultUiGeneration`.
- `(2913,51) TS2554` — `emitViteConfig()` called with 0 args; signature is `(kind: ProjectKind)`. Site also still webapp-only (game's R3-f06 `vite.config.ts` push was never wired).
- `(2968,16)` + `(3015,14) TS2554` — both `emitUi(...)` call sites pass 4 args; signature now takes 5 (`uiGeneration` hook).

## L1 board vs bytes (found at lane start)

| L1 board row (claimed DONE) | Byte truth | N1 action |
|---|---|---|
| A3-f07 `defaultUiGeneration` + single call point | fn exists (`:949`), call point exists (`:1007`), but **never passed** by callers → lint warning `:949`; `ScaffoldResult.uiGeneration` record never written | wire through `ScaffoldOptions` → both `emitUi` sites + record |
| R3-f06 `emitKindEntry` + `emitBinLauncher` | both defined (`:2134`/`:2224`), **zero call sites** → lint warnings; packageJson declares `bin`/`main`/`exports` pointing at NEVER-EMITTED files (honest-wiring break) | push `src/main.ts` (cli-tool/library/service) + `bin/<slug>.mjs` (cli-tool) |
| R3-f03 `redTree`/`partial` on envelope + skip path | skip path LANDED (`:1832-1874`); envelope fields DECLARED (`:142/:143`) but **`trailVerdictOf` referenced in docs, never defined**; `ctx.partial` never passed by `scaffoldProject` → skip path unreachable | define `trailVerdictOf`, plumb `partial` into `emitOracleSpec` ctx, attach envelope fields |
| R3-f02 prompt reword | **NOT landed**: `codegen.server.ts:503` still "Assign module.exports" (grep 20:0x) | reword rule 2 (below) |
| A3-f05/R11-f12 run-eval structure + `verification` | **NOT in bytes** (grep: 0 hits `expectedBehavior`/`verification`) | N1 lands STRUCTURE; N5 owns assertions — 'for N5' notes |

## R3-f02 constraint check (empirical, 20:0x)

- `codegen.server.test.ts:333` pins `module.exports.add = add` in the **worked example** (`:491`) → untouched.
- `verify.server.ts:417` runs module source through `new Function('exports','module','require', …)` → **raw `export` syntax breaks it** (never order it).
- **NEW constraint found:** the same harness cannot parse TS annotations either — proved live (`node --experimental-strip-types -e "new Function(…'function add(a: number…')"` → `SyntaxError: Unexpected token ':'`; Node v22.23.2). And `runNodeBounded` spawns plain `node -e` (no strip flags). JSDoc `@param` does NOT silence TS7006 in .ts either (proved: `tsc --strict` exit 2). ⇒ the spec's alternative branch applies: reword to the **ESM named-export CONTRACT + documented noImplicitAny caveat** (never order annotations into module source — same class as raw `export`).

## Board

- [ ] 1. Compile break: TS2488 `:1021` (null-fallback) + TS2554 `:2913` + `:2968`/`:3015` (call sites).
- [ ] 2. Wire `defaultUiGeneration` (ScaffoldOptions → emitUi; result record) + `emitKindEntry`/`emitBinLauncher` to their emit call points (kind wiring completion).
- [ ] 3. R3-f03: `trailVerdictOf` + envelope `redTree`/`partial` + `ctx.partial` → skip path reachable.
- [ ] 4. R3-f02: rule-2 reword (ESM named-export contract + documented noImplicitAny caveat; worked example + harness untouched).
- [ ] 5. run-eval STRUCTURE (redTree/partial on handover; per-kind `expectedBehavior` shape; `verification` label) — 'for N5' note; re-read bytes before edit (N5 shares the file).
- [ ] 6. Targeted checks: scoped tsc scaffold+codegen; `scaffold.test.ts`; `emitted-honesty.test.ts`; `codegen.server.test.ts`; byte spot-checks (webapp emit unchanged).

## Log (append-only, newest last)

- **20:0x start** — read `W36/completion.md` + L1/S2 logs + L1's row specs (thoroughanalysis §R3-f02/f03, W34/prep §P1.3). Scoped tsc captured (4 errors above). Harness constraints proved empirically (above). Writing this log EARLY; starting edits: compile break → wiring → R3-f03 → R3-f02 → run-eval structure.
