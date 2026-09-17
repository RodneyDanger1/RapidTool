# fixes/215b — forbidden-primitive prompt/validator parity (+ keyed chunked-tree proof)

Status: LANDED. Four-gate green (typecheck 0 · lint 0e · `npm test` 1632/1632 · TC 0).
Follows **fixes/215** (corpus delivery-kind → `Project.kind`).

## 1. The keyed proof that 215 unlocked the chunked tree

Fired the user-approved bounded keyed run — one corpus entry, `JOURNEY_BUDGET`
cycles, live DeepSeek, `research/eval-out/_keyed-launcher.sh` (key read from
`.env` without echo; deleted after). Result (`research/eval-out/results.json`,
`mode: "keyed"`):

| field | value |
|---|---|
| entry | coffeehouse2home-property-ledger |
| status | `dod` (honest stop at the DoD gate — not converged) |
| M1..M9 | 6/9 (mean 0.67) — M1 coverage **1** (keyless floor was M1 **0**) |
| project.kind | **`app`** — 215 wiring confirmed end-to-end |

**Chunked-tree evidence** (`p6.synthesis.attempt` journal in project.json):

```
p6.synthesis.attempt :: chunk 1/4 · attempt 1 · ok
p6.synthesis.attempt :: chunk 2/4 · attempt 1 · ok
p6.synthesis.attempt :: chunk 2/4 · attempt 2 · ok
p6.synthesis.refused :: RT_E_VALIDATION · chunk 2/4 refused ·
                        forbidden primitive in generated module code (globalThis)
p6.journey.failed    :: tree-run ok after 1/3 cycle(s) but P6 gate FAIL · 3 unmet
```

Before 215 the corpus `kind:"webapp"` was dropped, `Project.kind` was undefined,
`singleModuleLibraryKind()` returned true and codegen took the ≤8-signature
single-module path — **the chunked tree could never fire**. After 215 the
declared kind reaches codegen and the tree path fires with **4 chunks**. So the
remaining failure is **synthesis quality**, not routing: the model emitted the
forbidden primitive `globalThis`, the validator refused chunk 2/4, and
`synthesizeChunkedTree` honestly recorded a **partial** tree via
`partialTreeRefuse` (accepted chunks materialized, `refuse()` marks the project)
rather than fabricating a green tree.

## 2. Root cause of the refusal — a prompt/validator drift (the real fix)

`p6SynthesisSystemPrompt()` rule 4 told the model to avoid:

```
process/window/fetch/WebSocket/eval/Function/import/document/localStorage/indexedDB
```

but the validator (`FORBIDDEN_HARD` + `FORBIDDEN_SOFT`, ==
`sandbox.ts FORBIDDEN_PRIMITIVES`) also bans **`require`, `globalThis`, `self`,
`XMLHttpRequest`**. The model was never told `globalThis` was illegal — and
`globalThis` is exactly the primitive that killed chunk 2/4. The prompt and the
enforcer had silently drifted; the failure was therefore not a model-quality
lottery but an under-specified contract.

### Fix
- Added `export const FORBIDDEN_PRIMITIVE_NAMES` — the canonical list of all 14
  banned primitives (3 hard + 11 soft), the single source the prompt quotes.
- Rule 4 now renders `FORBIDDEN_PRIMITIVE_NAMES.join(", ")`, so the prompt can
  never omit an enforced primitive again.
- Two drift-proof tests in `codegen.server.test.ts`:
  1. the system prompt names **every** entry in `FORBIDDEN_PRIMITIVE_NAMES`;
  2. `FORBIDDEN_PRIMITIVE_NAMES` is **exactly** the validator denylist — each
     name matches `forbiddenPrimitiveHit`, and every hard/soft alternative is
     represented, so a newly-banned primitive cannot be enforced unadvertised.

### Bonus (same class of bug): hydration kind clamp
`hydrateProject` spreads `...raw`, so a persisted `Project.kind` survives the
save/load round-trip (no bug there) — **but** an unknown/hand-edited kind passed
through unchecked, and codegen's tree trigger reads `kind` directly. Added a
defensive clamp: a hydrated kind is kept only when it is one of
`"app" | "tool" | "game"`, otherwise deleted (absent == the legacy single-module
path, byte-identical for kind-less payloads). Test in `io.test.ts`.

## 3. Honest status (unchanged in kind)

- The **routing** defect is fixed (215) and **proven** under a keyed run (215b):
  a declared `webapp` kind now selects the chunked multi-file tree.
- The **one-shot-creator gap** is now a synthesis-quality problem: chunks must
  pass the forbidden-primitive + envelope + brief-fit validators. This run
  accepted 1 of 4 chunks; 3 unmet DoD criteria remain. `factory.*` stays
  **false** (doctor computes it from `src/jobs/*` bytes) — a keyed probe with a
  partial tree does **not** flip it.
- No invented bodies, no auto-approved fixtures, no `ok:true`+`error` dual
  channel, engines still advertise `sandbox: false` / `isolated: false`.
- Keyed `--all` remains opt-in and was **not** run.
