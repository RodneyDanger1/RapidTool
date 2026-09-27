# fixes/282_y1_model.md — W37 · LANE Y1 — THE MODEL-PATH CODER

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD** `0f85c32` + the W29–W37 uncommitted era.
**Box:** `src/lib/codegen.server.ts` (synthesis chain — NOT the prompt-rule text; N1 owns that reword) ·
`src/lib/llm/**` (providers/registry/cassette/api-key plumbing) · `src/lib/token-ledger.ts` (F1 gaps).
**Contract:** CODE-ONLY sprint — no test runs, no typecheck, no builds, no gates, no keyed calls.
Smallest honest patch · additive only · `TODO(<id>)` at the logic line · log-and-continue · never
weaken a pin to pass (262 doctrine) · claims only against bytes read TODAY.

**Sources (read at t0, 20:0x):** `wave_plans/W37/master-pack.md` (X1 card list) · F1 payload
`~/AppData/Local/hermes/cache/delegation/subagent-summary-0-20260926_195114_767464.txt` (FM-01…FM-12) ·
`fixes/280_f1_factory_model.md` (F1 lane log).

## [t0] LIVE-TREE STATE (verified reads — before any edit)

- **N1 log `fixes/281_n1_rescue.md`: ABSENT** (20:02). No codegen.server.ts edits by N1 visible yet.
  `src/lib/codegen.server.ts` mtime **18:15:43** (pre-W36-lane; not mid-edit at t0). `src/lib/llm/providers/*`
  mtimes 17:28–18:25; `token-ledger.ts` 18:02 — none in the active-edit window.
- **Files edited within the last ~40 min (live lanes — DO NOT TOUCH):** `checkpoint.server.ts`, `engine.ts`,
  `headless.ts` + `headless.test.ts`, `scaffold.ts`, `store.ts`, `scripts/rapidtool-cli.mjs` → any card whose
  fix would land in THOSE files is recorded `for X2 / for N6` instead of edited.
- **§F1 paste check:** `wave_plans/W35/factory-notes.md` exists; §F1 **NOT live** at t0 (N4's log
  `fixes/281_n4_records.md` confirms paste pending). → RE-CHECK before appending §Y1; if §F1 pasted, this log
  carries the delta only.
- **R12-f01 (the "cost curve" card) = VERIFIED LANDED at synthesis scope:** `P6_SYNTH_PRIOR_MAX_FILES=12`
  (`codegen.server.ts:165`) + `P6_SYNTH_PROMPT_MAX_CHARS=60_000` (`:174`) + the capped/elided prior render with
  visible `…[PRIOR-ELIDED: …]` markers (`:1310-1342`). Done-when read against today's bytes. No further edit
  needed in this lane; test pins for it not run (code-only).
- **FM-01 seam bytes (read today):** single-module path returns `generatedTree: [toGeneratedTreeFile(TREE_ENTRY_PATH, finalModule)]`
  with raw-CJS `finalModule` (`codegen.server.ts:3044`), plus `upgraded()` sets `generatedSource: finalModule`
  (`:2637`); the chunked path materializes at `:3183` (`materializeImportableTree`) and the emit-time backstop
  lives in `headless.ts` (`CJS_RESIDUE_RE` / `materializeEmitTree` — box X2; read-only for me). `:333` in
  `codegen.server.test.ts` = the **system-prompt worked-example pin** (`/module\.exports\.add = add/` on
  `p6SynthesisSystemPrompt()`) — my fix rewrites the module AFTER synthesis/verify, so that fixture stays
  byte-true (re-verified at edit time).

## [t0] PLAN (smallest honest shapes, in order)

1. **FM-01 (P0):** call `materializeImportableTree` inside `synthesizeSingleModule` at the same seam as the
   chunked path (`:3183` row) — `generatedTree` + `generatedSource` become the ESM barrel + materialized
   chunk file; emit-time guard untouched as the backstop. Re-point the legacy byte-parity pins in
   `codegen.server.test.ts` (each re-point asserts the NEW contract with equal-or-more teeth, commented).
2. **FM-04:** derive `modelRoute` from the SERVED model id in `upgraded` / `treeUpgraded` / `partialTreeRefuse`;
   fix the stale `:3330-3331` doc comment.
3. **FM-03:** account repair-re-prompt spend (record usage on every response that reports it, success or not)
   + surface `RT_E_BUDGET_EXHAUSTED` from repair steps as a coded refusal.
4. **FM-08:** render `dataFlow` + `errorHandling` in the chunk user prompt (capped + marker, non-empty gate).
5. **FM-05 / FM-12** (llm/providers), **FM-09** (reviewer), **FM-10** (token-ledger) — window permitting.
6. Log-only: FM-02 (rt-events/cli pins — live-lane files), FM-06/FM-07 (prompt-engine/llm-tasks — outside
   stated box), FM-11 (OWNER/keys).

## Log (append-only)

- **(t0)** Lane start. Pack + F1 payload + F1 log read in full; live-tree census above. This log written early.
