# 197 G3 — debug chat / wild-mode / node-runner (already-landed)

Lane: G3. Owned files only. Incremental.

## Scope

- `src/lib/chat.server.ts` + `chat.test.ts`
- `src/lib/wild-mode.server.ts` + `wild-mode.server.test.ts`
- `src/lib/node-runner.server.ts` + `node-runner.server.test.ts`
- `src/lib/verify.server.ts` + `verify.server.test.ts` (present — in scope)

Do not edit G1/G2 or parent: store/engine/io/headless/codegen/deepseek/brief-fixtures/scaffold/maker-score/compile-check/dod/types/console/cli. Do not edit `sandbox.ts`.

## Hunt list

1. Dual-channel `ok:true` + `error` → `ok:false` + `code`.
2. Slash tools: hostile `/rm` / missing project refused; `/help` keyless ok. Missing pins.
3. `redactSecrets` remaining leak shapes. Do not weaken `scrubbedEnv`.
4. Wild-mode: prompt builder blinded; lastTest fact line may contain PASS/FAIL; vacuous feedback flagged.
5. Owned-test bugs. Kind fixture is ArtifactKind `"docs"` not `"doc"`.

## Status

Landed. Owned suite green: **88/88**.

## Findings + fixes

### 1. Dual-channel `ok:true` + `error`

No production return in owned files minted `{ ok: true, error }`. Types were already unions except:

- `oracleBriefGrounded` returned `{ ok: boolean; reason?: string }` — a type that *allows* `ok:true` + `reason`. Tightened to `{ ok: true } | { ok: false; reason: string }`.
- `generateCases` `ok:false` had no `code`. Every false branch now stamps `code` (`RT_E_LLM_NOT_CONFIGURED` / `RT_E_VALIDATION` / `RT_E_INTERNAL`).
- `WildClassifierResult` `ok:false` had no `code`. Classifier failures now stamp `code` (optional on the type so parent `wild-step.test.ts` stubs stay assignable).

Pins: `ok:true` results must not have an `error` channel (chat slash tools, wild classifier, node-runner settle, generateCases).

### 2. Slash tools

Already-landed behavior kept:

- `/status` `/gate` `/packet` `/fixtures` `/help` work **keyless**.
- Free-text still `RT_E_LLM_NOT_CONFIGURED` without a key.
- Empty / null project → `RT_E_VALIDATION` **even keyless** (sweep73).
- Hostile `/rm` is **not** a tool (`parseChatTool` null) — keyless path is not-configured, never shell/file execution.
- `COPILOT_SYSTEM_PROMPT` remains advisory-only for LLM turns. Slash tools are local pre-LLM actions.

Missing pins added (chat.test.ts).

### 3. `redactSecrets`

Hole: hyphen `sk-` did not match underscore `sk_live_…`. Also no explicit `sk-proj-` pin.

- Added `sk-proj-` (8 + ≥32) before generic `sk-`.
- Added `sk_live_` (8 + ≥32). Fakes only in tests.
- Generic `sk-` negative lookahead now `(?!or-)(?!proj-)`.
- Hyphen unescaped at end of character class (lint).
- `scrubbedEnv` untouched (PATH allowlist; never copies `DEEPSEEK_API_KEY`).

### 4. Wild-mode

- Prompt still blinded: no `Machine-checkable DoD verdict`.
- lastTest fact line: FAIL and PASS both pinned; `(all criteria met)` when unmet empty.
- Vacuous approve → `ok:false` + `RT_E_VALIDATION`.
- ArtifactKind fixture remains `"docs"` (not `"doc"`).

### 5. Tests

Kind fixture was already `"docs"`. No production-type widening.

## Verification

```text
node --experimental-strip-types --test \
  src/lib/chat.test.ts \
  src/lib/wild-mode.server.test.ts \
  src/lib/node-runner.server.test.ts \
  src/lib/verify.server.test.ts
# tests 88
# pass 88
# fail 0
```

Full `npm test` **not** run (per task). Parent owns four-gate on intake.

## Files touched

| File | Action |
|------|--------|
| `src/lib/chat.server.ts` | no production change (already honest) |
| `src/lib/chat.test.ts` | slash / dual-channel / keyless validation pins |
| `src/lib/wild-mode.server.ts` | stamp `code` on classifier failures |
| `src/lib/wild-mode.server.test.ts` | lastTest PASS, vacuous, classifier honesty |
| `src/lib/node-runner.server.ts` | `sk-proj-` + `sk_live_` redaction |
| `src/lib/node-runner.server.test.ts` | fake-shape pins + dual-channel |
| `src/lib/verify.server.ts` | `oracleBriefGrounded` union; `generateCases` `code` |
| `src/lib/verify.server.test.ts` | dual-channel + `RT_E_VALIDATION` on dropped pin |
| `fixes/197_g3_debug.md` | this log |

## Out of scope / honesty notes

- Dual-channel `ok:true` + `error` still lives in **parent** `headless.ts` / `store.ts` — not owned.
- Did not add required `code` on `WildClassifierResult` (would break parent `wild-step.test.ts` stubs).
- Did not add shell/file execution to chat.
- Did not weaken `scrubbedEnv`. Not a sandbox.
- Did not make the LLM claim it ran phases.
