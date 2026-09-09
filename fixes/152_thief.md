# 152 — FACTORY THIEF: three steals from real AI-API software factories

Source repos verified in their actual code (fetched raw.githubusercontent.com / GitHub API).
Landed by the thief lane (steal #1) + parent integration (steals #2/#3 + test fixes + log).

## Steal 1 — RESILIENT LLM RETRY (source: OpenHands `openhands/llm/retry_mixin.py`)
Source quote: tenacity `retry(stop=stop_after_attempt(num_retries), wait=wait_exponential(multiplier, min, max),
retry=retry_if_exception_type(LLM_RETRY_EXCEPTIONS))` over `(RateLimitError, Timeout, InternalServerError,
LLMNoResponseError)`.
Adaptation (src/lib/deepseek.server.ts, additive; existing exports byte-identical):
- `RETRY_BASE_MS=500`, `RETRY_MAX_JITTER_MS=8000`, pure `jitteredBackoffDelayMs(attempt, random?)` — full-jitter
  `random()·min(cap, 500·2ⁿ)` (attempt 1: ≤1s … attempt 4+: ≤8s cap), deterministic under injection.
- `postWithRetry`: bounded `MAX_ATTEMPTS` loop, retries 429/500/503 + network errors with the backoff; AbortError
  (absolute deadline) rethrown immediately; a network-exhausted call rethrows with `attempts` attached.
- Retry-count honesty: refusals after exhaustion speak `"(after N attempts)"`; first-attempt 400 stays byte-identical.
- Injectable `fetch`/`sleep`/`random` in `DeepSeekCompleteOptions` (test seams; defaults unchanged).
Tests: deepseek.server.test.ts 13/13 (pure jitter policy; 429-forever → 3 calls + delays [1000,2000] + coded refusal;
network-then-success lands on attempt 3; network exhaustion honest; 400 single-attempt byte-identical).
Parent fixed the test fixture (network mode threw on EVERY call, ignoring the status array → `[0,0,200]` now means
two network errors then success) + `r.error ?? ""` narrowing + postWithRetry's `Response | null` → `Response` type.

## Steal 2 — POST-HOC CLAIM GATES (source: disler/super-simple-software-factory)
Source: gates verify claims AFTER the fact against typed envelopes (`artifacts_exist`, `files_non_empty`,
`diff_matches_claims`, `tests_pass`); phase default fail; `run.finish(accepted=…)` — phase-pass ≠ run-acceptance.
Adaptation (src/lib/sandbox.ts): pure `ClaimRow` (`file-exists` | `dir-non-empty` | `contains-identifier`) +
`verifyClaims(claims, artifacts)` → `{ok, unmet[]}` — absent artifacts/met identifiers are unmet, never skipped;
malformed rows are LOUD (never silently dropped); identifier matching reuses the engine's own `identifierHits`
(lowercase tokens, code-only masking). Tests: sandbox.test.ts 28/28 (all-met; missing file / empty dir / absent
identifier → 3 unmet with exact messages; junk → 2 malformed-row unmet, never thrown).
Wiring note: the p6-arch/brief-fit probes already enforce identifier presence from the expanded spec, and the
10X wave's capability rows (fixes/150 G2) make capability absence a red test — verifyClaims stands as the pure
reusable gate core for those + future claim rows (no fake source was added: claims need a real producer first).

## Steal 3 — DIFF-AWARE REVIEW CONTEXT (source: aider + OpenAI Codex repair-cookbook / Foreman)
Source: the reviewer sees the CHANGE (diff/branch), never the implementer's reasoning ("judgment from proof":
review-no-edits → repair-only-edits → validation-executes).
Adaptation (src/lib/crew.server.ts): pure `treeReviewContext(project)` — bounded ≤1500 chars (exported
REVIEW_CONTEXT_CHAR_MAX) per-file change summary (path + char count + up to 12 exported identifiers via a
source regex); honest states: no artifact → "No generated artifact yet — nothing to review"; no tree but a
single module → explicit single-module line (never reads as a reviewed tree). Wired into `buildAgentContext`
for role === "reviewer" as an "Artifact under review (change summary)" block; other roles + artifact-free
projects byte-identical. Tests: crew.test.ts 42/42 (tree renders paths+exports bounded; no-tree/no-artifact
honest lines).

## Post-integration gate: typecheck 0 · deepseek 13/13 · sandbox 28/28 · crew 42/42 (full suite pending the
## in-flight watchdog wave — this log covers the thief's owned files only).
