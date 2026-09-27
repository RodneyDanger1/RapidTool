# fixes/287_z2_contracts.md — W39 · LANE Z2 — THE CONTRACTS WIRE CODER

**Lane:** W39 Z2 — R10-f01's close (the synthesis chain's blind spot). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`), HEAD `0f85c32` + the W29–W39 uncommitted era.
**Tasks (two):**
- **(1) R10-f01 — THE CONTRACTS WIRE.** Thread a capped `DATA CONTRACTS` block into BOTH synthesis user-prompt builders from `project.contracts` at the `liveP6Synthesis` seam, per G3's exact instruction (`fixes/285_g3_model_visibility.md` §t0 + the register row `research/multiagent/thoroughanalysis.md:1449-1450`). Non-empty-gated (Y1's FM-08 precedent) so an absent/empty contract keeps the legacy prompt bytes. ≤12 rows total; `entities: <name> (<fields…>)` / `endpoints: <METHOD> <path> (<job>)`; visible cut marker when truncated.
- **(2) §Y1 record append** — Y1's owed `§Y1` block into `wave_plans/W35/factory-notes.md` (above `END-OF-FILE-MARKER-FACTORY`), if N4 hasn't. Attribution `fixes/282_y1_model.md`.
**Contract:** CODE-ONLY — no test runs, no typecheck, no builds, no gates, no keyed calls. Smallest honest patch, additive only, attribution comments at the logic lines, log-and-continue. Done-when: a contract entity name appearing in the emitted tree on a keyed run (not runnable here — keyless) + compile-clean via `node --check` on the file.

## [t0] Byte-state (verified reads — before any edit)

| Fact | Bytes today |
|---|---|
| `src/lib/codegen.server.ts` | **180,471 B / 3,698 lines** · mtime **Sep 26 20:43** (Y1's W37 edits landed since G3's t0 row: 180,055 B / 3,690) |
| `grep -c "contracts" src/lib/codegen.server.ts` | **0** → R10-f01 still OPEN at this lane's t0 |
| `p6SynthesisUserPrompt` | `:1245` — ≤8-signature legacy delegate; forwards at `:1257` to the chunk builder |
| `p6SynthesisChunkUserPrompt` | `:1284` — the real renderer; FM-08 non-empty-gated DATA FLOW/ERROR HANDLING spreads at `:1339-1352` (the pattern to mirror) |
| Call seams | `synthesizeSingleModule` `:2932` (`p6SynthesisUserPrompt(brief, specRecord, lessonLines)`) · `synthesizeChunkedTree` `:3264` (`p6SynthesisChunkUserPrompt(brief, specRecord, chunk.signatures, prior, lessonLines)`) — both functions have `project` in scope; `project.contracts` rides it |
| Repair prompts | both paths use DEDICATED repair builders (`p6Synthesis*RepairPrompt`) — the `user` prompt is never rebuilt ⇒ the two user-prompt builders ARE the complete wire |
| `DataContract` shape | `types.ts:300` (`entities: {name, fields:[{name,type}]}[]` · `endpoints: {method, path, job}[]`); `Project.contracts` `:381`; engine threads/repairs it (`engine.ts:1133/:1210/:2133-2143/:2449-2545`) |
| packet precedent (row forms) | `packet.ts:567-570`: entity `- <name>: <f>:<t>, …` · endpoint `- <METHOD> <path> (<job>)` |
| `codegen.server.test.ts` | **no fixture carries non-null `contracts`** (grep) ⇒ the non-empty gate makes every existing pin see zero byte delta |
| `wave_plans/W35/factory-notes.md` | 22 lines; marker at `:22`; §F1–§F5 **and §Y1 NOT live** (N4's log `fixes/281_n4_records.md` is a stub — paste pending) ⇒ Y1's §Y1 append is owed, mine |

## [t0] PLAN (smallest honest shapes)

1. Import `type DataContract` into `codegen.server.ts`'s existing types.ts type-only import.
2. New `P6_SYNTH_CONTRACTS_MAX_ROWS = 12` beside the R12-f01 caps; new pure `p6SynthesisContractsLines(contracts)` → `string[]` (rows: entities then endpoints; whitespace-collapsed values; non-empty gate ⇒ `[]`; visible `…[CONTRACTS-ELIDED: …]` marker past the cap).
3. `p6SynthesisChunkUserPrompt`: optional trailing `contracts?: DataContract | null`; spread `...contractLines` after the FM-08 blocks; legacy bytes when `[]`.
4. `p6SynthesisUserPrompt`: optional trailing `contracts` param, forwarded to the chunk builder (parity pins: 2-arg legacy call stays byte-identical).
5. Thread at both call seams: `project.contracts` (`:2932` / `:3264`).
6. `node --check` the file (module is TS — check via strip-types one-liner if `--check` can't parse; record exactly what was run).
7. §Y1 append to `wave_plans/W35/factory-notes.md` above the marker (re-read first).

## Log (append-only)

- **(t0)** Lane start. `wave_plans/W37/master-pack.md` (X1 lane, card 1/5 context) + `fixes/285_g3_model_visibility.md` + `fixes/282_y1_model.md` + `fixes/281_n4_records.md` read; byte-state table above verified with grep/wc TODAY. This log written EARLY (before any edit).

## LANDED (W39 Z2 — after the patches)

**R10-f01's wire — LANDED.** `src/lib/codegen.server.ts` (180,471 → 185,933 B · 3,698 → 3,795 lines):
- `P6_SYNTH_CONTRACTS_MAX_ROWS = 12` (`:192`) + pure `p6SynthesisContractsLines(contracts)` (`:1266`): entities `<name> (<field:type, …>)` under an `entities:` heading / endpoints `<METHOD> <path> (<job>)` under `endpoints:`; values whitespace-collapsed to single spaces (no line-structure injection); **non-empty gate ⇒ `[]`** (byte-parity); cap + visible `…[CONTRACTS-ELIDED: N row(s) …]` marker (R12-f01's marker convention).
- `p6SynthesisUserPrompt` (`:1320`): optional trailing `contracts?: DataContract | null` (`:1334`), forwarded to the chunk builder (`:1336`).
- `p6SynthesisChunkUserPrompt` (`:1365`): optional trailing `contracts` (`:1382`); `contractLines` computed beside the FM-08 filters (`:1399`); `...contractLines` spread after the ERROR HANDLING block (`:1446`).
- Call seams: `synthesizeSingleModule` → `p6SynthesisUserPrompt(brief, specRecord, lessonLines, project.contracts)` (`:3028`); `synthesizeChunkedTree` → `p6SynthesisChunkUserPrompt(…, lessonLines, project.contracts)` (`:3361`).
- `DataContract` added to the existing type-only types.ts import (`:128`) — no new runtime edge.

**Evidence (commands + observed output):**
- `node --check src/lib/codegen.server.ts` → **exit 0** (`CHECK-PLAIN: OK`; `--experimental-strip-types --check` form also OK). ← **DONE-WHEN (compile-clean) MET.**
- Targeted smoke (one-off, kept for re-run): `node C:/Users/mnril/z2_contracts_smoke.mjs` → **`Z2 SMOKE: ALL PASS`** — asserts: gate (null/undefined/empty/malformed → `[]`); render shape (heading + `entities:`/`endpoints:` + exact row forms); cap = 12 rows + visible cut marker; byte-parity (both builders unchanged with absent/null contracts; no `DATA CONTRACTS` in the legacy prompt); both builders emit the identical block when contracts ride; whitespace-collapse (`"Or\nder"` → `Or der`). No test-suite/gate/keyed run was performed (code-only contract).
- `grep -c "contracts" src/lib/codegen.server.ts` → **19** (was **0** at t0) ← R10-f01's "zero grep hits" gap CLOSED.
- **DONE-WHEN (keyed): "a contract entity name appears in the emitted tree"** — not runnable in this code-only/keyless lane; the wire above is the mechanism (`project.contracts` → builder → model prompt → module source). Recorded for the keyed run (owner keys, O-4 era).

**Contract compliance:**
- keyless byte-parity (T-01 pins): the non-empty gate renders nothing for absent/empty contracts; every existing test call (`codegen.server.test.ts:418 / :951-968 / :2078 / :2114`) keeps its arity and sees byte-identical output; no test fixture carries non-null `contracts` (grep) ⇒ zero pin deltas.
- FORBIDDEN_SOFT / validator rules: no new raw tokens — plain ASCII `- ` bullets, no fences/quotes/braces; no validator touched.
- Y1's FM-08 precedent honored: gated additive spread, attribution comments at every logic line.

**§Y1 record — LANDED (second task).** `wave_plans/W35/factory-notes.md`: `## §Y1 — W37 LANE Y1 · THE MODEL-PATH LANDINGS` appended above `END-OF-FILE-MARKER-FACTORY` (file 22 → 34 lines). §F1–§F5 + §Y1 were ALL non-live (`grep` at append time) — N4's paste never landed. Attribution `fixes/282_y1_model.md`; landings re-verified against today's bytes: FM-01/03/04/08 LANDED (markers cited) · FM-05/09/10/12 NOT LANDED (no markers in target files) · FM-02/06/07/11 log-only per Y1's plan.

## OWED / FOLLOW-UPS (for the parent)
- The keyed done-when (a contract entity name in the emitted tree) rides the next keyed run — no further code step.
- Y1's "two record appends": this lane landed the **factory-notes §Y1**; a second Y1 record append (if owed to another target) was out of this task's stated scope — untouched here.
- `wave_plans/W35/factory-notes.md` still owes N4's §F1–§F5 paste (not this lane's task; noted).
