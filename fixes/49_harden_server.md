# 49 — Server-layer hardening audit + wave-3 chat/CLI integration handoff

Wave 49 (Flash W1) lands the chat/CLI integration of `research/multiagent/19_chat_integration_plan.md`
and documents the machine-readable error-code hardening that already landed in the
server layer (foundations wave F2, `fixes/48` core + helper waves). Every `file:line`
below was re-verified against the on-disk bytes on 2026-09-06 by direct read.

## 1. Server hardening pass — error-code patches (verified on disk)

All hardened modules return the shared `{ ok: false, reason, code, error? }` shape
with `code` REQUIRED on failure arms (tsc-enforced via their result-type unions)
so every consumer can branch on the machine value. `reason` stays the fine
discriminator; `code` is the coarse family from `src/lib/errors.ts`
(`ERROR_CODES`, 14 codes; doc rows are `{ meaning, agentAction }`).

| Module | Result type / shape contract | Patch sites (file:line) |
| --- | --- | --- |
| `src/lib/research.ts` (client research wrapper) | `ResearchResult` failure arms carry `code` | `:74` non-string query → `RT_E_VALIDATION`; `:83` empty query → `RT_E_VALIDATION` (both validated BEFORE the server round-trip); `:93` thrown transport → `RT_E_INTERNAL` |
| `src/lib/websearch.server.ts` (keyless DuckDuckGo/SearXNG/Wikipedia) | header documents the `code` field at `:21` | `:313` non-string query → `RT_E_VALIDATION`; `:322` empty query → `RT_E_VALIDATION`; `:384` all-providers-failed / zero results → `RT_E_RESEARCH_UNAVAILABLE` (root-cause `lastFailure` surfaced verbatim, `:337-340`) |
| `src/lib/tavily.server.ts` (premium keyed research) | header documents `{ ok:false, reason:"not-configured", code:"RT_E_RESEARCH_UNAVAILABLE" }` at `:14` | `:123` no API key → `RT_E_RESEARCH_UNAVAILABLE` (not-configured, no fetch); `:131` non-string query → `RT_E_VALIDATION`; `:140` empty query → `RT_E_VALIDATION`; `:171` HTTP refusal → `RT_E_RESEARCH_UNAVAILABLE`; `:181` missing `results` array → `RT_E_RESEARCH_UNAVAILABLE`; `:203` catch (timeout/network) → `RT_E_RESEARCH_UNAVAILABLE` |
| `src/lib/exec.ts` (client run-code wrapper) | `ExecResult` union `:22-37` — `code` REQUIRED per reason: not-configured → `RT_E_RUNNER_UNAVAILABLE`, refused → `RT_E_VALIDATION`, timeout → `RT_E_RUNNER_FAILED`, error → `RT_E_RUNNER_FAILED \| RT_E_INTERNAL`; header contract `:7-14` | `:51` runner absent (server fn) → `RT_E_RUNNER_UNAVAILABLE`; `:66` empty source → `RT_E_VALIDATION`; `:78` non-positive `timeoutMs` → `RT_E_VALIDATION` (refused, never silently defaulted); `:89` test-injected null runner → `RT_E_RUNNER_UNAVAILABLE`; `:99` thrown transport → `RT_E_INTERNAL` |
| `src/lib/node-runner.server.ts` (bounded local runner) | `NodeRunResult` union `:32-37` mirrors exec.ts's code-per-reason contract | `:90` runner unavailable → `RT_E_RUNNER_UNAVAILABLE`; `:98` empty source → `RT_E_VALIDATION`; `:133` spawn-throw catch → `RT_E_RUNNER_FAILED`; `:170` `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` kill → `RT_E_RUNNER_FAILED` (reason "timeout" — honesty rules: a maxBuffer kill is a runaway-writer kill, and the child `error` event no longer blames "spawn failed", `:160-181`); `:178` child 'error' event → `RT_E_RUNNER_FAILED`; `:189` wall-clock timer kill (the ONLY honest "timeout") → `RT_E_RUNNER_FAILED`; `:201` external signal kill → `RT_E_RUNNER_FAILED` (never a fake-duration timeout) |
| `src/lib/phases.ts` (phase graph defs) | thrown `Error` carries a machine `code` property | `:116-120` unknown/out-of-graph phase id → `err.code = "RT_E_PHASE_ILLEGAL"` (comment cites errors.ts; deliberately NOT `RT_E_VALIDATION`) |

Design rules these patches follow (from `errors.ts` header + the F2 hardening reference):

- **`classifyError` is LLM/fs-domain-biased** (matchers: ReportRejectedError name,
  ENOENT, abort/timeout). Research/runner transport failures therefore set their
  codes DIRECTLY on result arms — they never route through `classifyError`.
- Runner honesty: timeout is minted only when the runner's OWN wall-clock timer
  fired (`:183-193`); maxBuffer kills and external signals are real failures, not
  fake timeouts (`:166-181`, `:194-205`).
- Validation failures (`RT_E_VALIDATION`) are returned before any fetch/spawn —
  a caller bug never burns a network call or a provider.

These are the surfaces the wave-49 consumers now branch on: the CLI envelope
`code` (§3) and the Chat tab badge (`ERROR_CODE_DOC`, console.tsx).

## 2. This wave's changes (W1 ownership list)

| File | Change |
| --- | --- |
| `scripts/rapidtool-cli.mjs` | Every `{ok:false}` envelope gains `code` at the single choke point `respond()` (:84-107): classified from the human `error`/`reason` text via a lazy, memoized, never-throw dynamic import of `src/lib/errors.ts` `classifyError` (`ensureErrorCodes`, :97-130; called first in `main()`, :174). Exit-3 (backend not configured, crew/verify) pins `RT_E_LLM_NOT_CONFIGURED`. Exit-code taxonomy and `SCHEMA_VERSION = 1` untouched. Header note updated (:5-9). |
| `scripts/README-cli.md` | Intro envelope sentence + new **Error codes (RT_E_\*)** section (one row per `ERROR_CODE_DOC` key: code / meaning / agentAction / typical exit_code) + classifier-subset honesty note. |
| `src/components/console.tsx` | 9th RunTab `"chat"` + Chat trigger/panel; `ChatPane` (grounded copilot via `chat.ts: chatOnce`, MarkdownBody render, Enter-to-send, busy latch, 12-row history trim, RT_E_\* error badge with `agentAction` tooltip, 3 live-state quick-action chips); additive only. |
| `src/styles.css` | `.chat-scroll` thin theme-token scrollbar for the message region (no raw hex). |
| `fixes/49_harden_server.md` | This file. |
| `fixes/50_wave3_chat_ui.md` | Landing report for the UI/CLI wave (contract deltas + verification). |

## 3. Gate status at handoff

- `npm run typecheck`: console.tsx + CLI clean. 5 residual `error TS` lines are
  ALL in sibling-owned in-flight files (`src/lib/algo-tools.ts:451`,
  `src/lib/vector.ts:354,1087,1097,1134`) — not touched here.
- Lib suite (`node --experimental-strip-types --test "src/lib/*.test.ts" "src/lib/app-data/app-data.test.ts" "src/lib/auth/*.test.ts"`):
  650/653 pass; the 3 failures are sibling mid-flight suites `algo-tools.test.ts`
  (complexityOf, parseAlgorithmSpecJson) and `arch-tools.test.ts` (codebaseMap).
- `npm test` scripts leg: exactly the 10 documented Windows env-baseline failures
  (symlink privilege ×2 + platform-chrome/og coupling ×8) — pre-existing.
- `npx eslint src/components/console.tsx scripts/rapidtool-cli.mjs`: clean.
- CLI live probes (bare Node): ENOENT load → `RT_E_PROJECT_MISSING` exit 1;
  crew no-key → `RT_E_LLM_NOT_CONFIGURED` exit 3; ok:true payloads carry NO
  `code`; usage/state prose → `RT_E_UNKNOWN` (honest classifier fallback).
