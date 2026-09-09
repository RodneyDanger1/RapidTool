# 122 — Remaining bugs (post-fixes/121 sweep) — probe-proven specs

Encoded by the parent from A1's capped summary (5 live-probe batteries, zero speculation).
Probes: `C:\Users\mnril\AppData\Local\Temp\rt-a1\probe-a1.ts`…`probe-a5.ts`.

## A1-01 (P1) — hydrateProject still crashes on row-level junk INSIDE research items → store wipe
- **Anchor:** engine.ts hydrateProject research filter (~1735-39 filters at ENTRY level only:
  `Array.isArray(e.items)`) → packet.ts `researchSources` reads `it.title` on a null item.
- **Bug:** a `research` array whose entry `items` contain `null` throws inside hydrateProject's
  attachAlgorithms tail (`Cannot read properties of null (reading 'title')`) — the store's
  seedIfEmpty maps hydrateProject with no per-project try/catch → ONE corrupt row wipes ALL
  projects. (fixes/120 fixed the import boundary + the non-array container; the item level is
  still open. `research=5` regression IS fixed.)
- **Fix:** engine research filter must also drop non-plain-object items: filter items to
  `it && typeof it === "object" && typeof (it as {url?:unknown}).url === "string"` (mirror the
  entry-level drop), with a loud repair token when items were dropped.
- **Regression tests:** hydrateProject with `research:[{query:"q", items:[null]}]` → clean
  hydrate, packet compiles, `hydrate.repaired` log mentions the drop; store-level: seed 2
  projects (one with the corrupt items row) → BOTH survive rehydrate.

## A1-02 (P1) — same store-wipe vector via corrupt scorecard at engine hydrate
- **Anchor:** engine.ts hydrateProject — no scorecard normalization; attachAlgorithms does not
  regenerate it (io.ts importProject sanitizes, engine/store rehydrate does not).
- **Bug:** `scorecard.axes:[null]` → `reading 'label'`; `axes: 5` → `axes.map is not a
  function`; `scorecard:"hello"` → `reading 'map'` — same whole-store wipe path as A1-01.
- **Fix:** normalize scorecard at hydrate (drop/replace non-array axes entries, coerce
  non-object scorecard to null) + loud repair token; or regenerate via attachAlgorithms when
  corrupt (mirror lattice/schedule rebuild).
- **Regression tests:** hydrateProject with scorecard junk shapes → clean hydrate + packet
  compile; store 2-project rehydrate survives.

## A1-03 (P1) — refused-keyed-P6 mints TWO divergent L2 rows; the headless site mints a LIE
- **Anchor:** engine.applyPhaseResult seal-site L2 (content id …-2d72e3d2) vs
  headless.runUntilGate completion-site L2 (…-1aa53ef0, fixes/121).
- **Bug:** the headless site's guard is unsound — `p.lastTest.ok === true` for a refused keyed
  P6 (the placeholder self-test passed; the refusal lives only in the log), so it mints with
  `unmet=[]` → text "gate unmet (unknown)" — a content LIE whose content-address derives from
  wrong data. Two sites mint TWO divergent rows for one refusal.
- **Fix:** the completion-site guard must derive unmet from the recorded P6 gate
  (`phases[6].gate.unmet` when `gate.passed === false`), NOT from lastTest; and the two sites
  must agree on one content-address (share the unmet list + evidence hash). Prefer the
  seal-site row; make the completion site a no-op when the seal-site row already exists.
- **Regression tests:** a refused-keyed-P6 fixture drained to completion mints EXACTLY ONE L2
  row with the real unmet list; the row text contains the gate's unmet criteria, never
  "(unknown)".

## A1-04 (P2) — static CJS analysis fooled by comments (mechanical repair silently skips)
- **Anchor:** codegen.server.ts `injectMissingExports`/`unboundExportNames` regexes run over
  RAW source.
- **Bug:** a comment `// module.exports.add = add;` makes `unboundExportNames` return [] and
  `injectMissingExports` report changed=false while the runtime export is genuinely missing →
  the module dies at machine verify with the exact ReferenceError class fixes/121 targeted.
- **Fix:** run the already-bound scan over comment-stripped source (strip `//` and `/* */`
  before the regex pass — a tiny stripper, string literals protected).
- **Regression tests:** source with the comment-only export + a real declared function →
  injectMissingExports injects it; a genuinely-bound export in a comment is NOT double-injected.

## A1-05 (P2) — static binder misses async function / function* / class declarations
- **Anchor:** codegen.server.ts `injectMissingExports` name scan regexes only
  `^(?:export\s+)?function\s+` and const/let/var.
- **Bug:** `async function fetchTotal`, `function* gen`, `class Counter` are reported unbound
  (false positive → validateSynthesisModule fails / injection skips) even though declared.
- **Fix:** extend the declaration regexes: `(?:async\s+)?function`, `function\s*\*`, and
  `^class\s+NAME`.
- **Regression tests:** a module with async/gen/class declarations binds + validates.

## Verified NOT bugs this pass (leave out)
dedupeMemoryIds collision fix holds; inject idempotence on object-shorthand exports; row-level
junk in crew/oracle/contracts masked by attachAlgorithms rebuild; L2 double-mint idempotent on
re-run of the same stored project (no third row).
