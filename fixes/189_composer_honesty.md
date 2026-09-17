# 189 — Composer honesty (blind Auto-Review + node-runner stdout redaction)

## Scope
- **185-U8**: Blind Wild Mode Auto-Review — drop pre-chewed `Machine-checkable DoD verdict: PASS/FAIL` from the judge prompt; keep unmet criteria as evidence lists only.
- **174-15**: Redact secrets from node-runner captured stdout/stderr (`sk-` / `sk-or-` / `Bearer eyJ` tokens; `DEEPSEEK_API_KEY` value when set).

## Owned files
- `src/lib/wild-mode.server.ts` (+ `src/lib/wild-mode.server.test.ts`)
- `src/lib/node-runner.server.ts` (+ `src/lib/node-runner.server.test.ts`)
- `fixes/189_composer_honesty.md`

## Do not touch
Parent-owned: store/engine/io/headless/codegen/deepseek/brief-fixtures/scaffold/maker-score/compile-check/dod/types/console/cli/chat/diagnose/harvest/sandbox/knowledge.

## Landing log

### 185-U8 — Blinded Auto-Review (wild-mode.server.ts)
- **Deleted** the prompt line  
  `Machine-checkable DoD verdict: ${ctx.gate.pass ? "PASS" : "FAIL"}`  
  from `buildWildReviewPrompt` (was ~L123). That line pre-chewed a machine verdict for the judge — not a blinded review.
- **Kept** `Unmet DoD criteria:` as a list of `id: criterion` evidence (or `(all criteria met)`).
- **Kept** `Last module test: PASS|FAIL — …` as a factual lastTest line (not a DoD machine-verdict token).
- Header comment updated: review context is artifacts + unmet criteria + lastTest; no injected PASS/FAIL DoD verdict.
- Keyless floors unchanged — `createWildClassifier` still returns `{ ok:false, reason:"not-configured" }` with no fabricated LLM verdict.
- `buildWildReviewPrompt` was already exported; tests call it directly.

### 174-15 — stdout/stderr redaction (node-runner.server.ts)
- Added exported `redactSecrets(text: string): string`:
  - Replaces 40+ char tokens matching `sk-or-…`, `sk-…` (negative lookahead so `sk-or-` is not double-hit), and `Bearer eyJ…` with `[secret-hidden]`.
  - Replaces live `process.env.DEEPSEEK_API_KEY` value via split/join (never builds a RegExp from the key; never logs the key).
  - Empty / short / non-secret strings stay byte-identical.
- Applied `redactSecrets` to **both** `stdout` and `stderr` on the successful settle path of `runNodeBounded` before results return.
- **Did not** weaken `scrubbedEnv` (PATH allowlist; still never copies `DEEPSEEK_API_KEY`).
- Honesty: this is output scrubbing only — **not** a sandbox (module header claim unchanged).

### Tests (owned only)
- Created `src/lib/wild-mode.server.test.ts`:
  - Asserts exact string `Machine-checkable DoD verdict` is **absent**.
  - Unmet criteria + lastTest FAIL fact still present.
  - Smoke: parseWildReview / isVacuousFeedback.
- Created `src/lib/node-runner.server.test.ts`:
  - Fake `sk-` / `sk-or-` / `Bearer eyJ` redacted.
  - Empty/short byte-identical.
  - Control chars via `String.fromCharCode` (no-control-regex).
  - Env key value redacted when set.
  - `scrubbedEnv` still omits `DEEPSEEK_API_KEY`.
  - Live `runNodeBounded` stdout/stderr scrubbed end-to-end.

### Verification
```text
node --experimental-strip-types --test src/lib/wild-mode.server.test.ts src/lib/node-runner.server.test.ts
# tests 13
# pass 13
# fail 0
```
Full `npm test` **not** run (per task).

### Files touched
| File | Action |
|------|--------|
| `src/lib/wild-mode.server.ts` | drop DoD PASS/FAIL machine-verdict line |
| `src/lib/wild-mode.server.test.ts` | **create** |
| `src/lib/node-runner.server.ts` | `redactSecrets` + apply on settle |
| `src/lib/node-runner.server.test.ts` | **create** |
| `fixes/189_composer_honesty.md` | this log |

### Out of scope / honesty notes
- No parent-owned files edited.
- No client-reachable static `node:fs` introduced (both modules remain `.server.ts`).
- Does not claim node-runner is a sandbox.
- Does not fabricate LLM Auto-Review verdicts when keyless.
