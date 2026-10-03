# 346 · lane e2 — provider resilience & robustness

**Root:** `C:\Users\mnril\Desktop\RapidTool Main` (git `main`, base HEAD `988b158`; working tree also
carries concurrent sibling lanes — not mine, untouched). **Keyed calls: 0.** Scratch: `%TEMP%\rt346_e2\`.
**Runtime:** Node host `v24.15.0`; Node `v22.23.2` at `& "$env:LOCALAPPDATA\hermes\node\node.exe"`.
**Owned suites GREEN both runtimes:** `# tests 341 · pass 340 · fail 0 · skipped 1` (the skip is the
pre-existing key-gated one). `tsc --noEmit` exit 0. Scoped `eslint` on the 20 changed files: 0 problems.
No full gate. No tracked-file deletion. No secret printed.

---

## A2-F4 — one shared transient-retry set

- **Files:** `src/lib/llm/providers/deepseek.ts`, `src/lib/llm/providers/openai-compatible.ts`.
- **Change:** exported `TRANSIENT_RETRY_STATUS = {429,500,502,503,504}` from `deepseek.ts` (the wider set —
  502/504 are gateway-transient) and made BOTH adapters import/use it; deleted
  `openai-compatible.ts`'s private `RETRYABLE_STATUS` and `deepseek.ts`'s `{429,500,503}`.
- **Pins added** (`registry.test.ts`, `fixes/346 A2-F4`): the exported set equals `[429,500,502,503,504]`;
  a DeepSeek call over `[502,504,200]` is retried and succeeds on attempt 3 (3 fetches).
- **RED (both runtimes)** — set temporarily narrowed to `{429,500,503}`:
  `not ok 9 - fixes/346 A2-F4 … | # tests 43 # pass 41 # fail 2` (Node 24 and Node 22).
- **GREEN:** included in the owned-suite run above.

## A2-F5 — finish the transport migration

- **Files:** `src/lib/llm/providers/probe.ts:175`, `src/lib/tavily.server.ts:84`,
  `src/lib/harvest.ts:373,388`.
- **Change:** routed the default transports through the existing one-shot seam
  (`oneShotFetch` from `one-shot-fetch.server.ts`): `probe.ts opts.fetch ?? oneShotFetch`,
  `tavily.postWithRetry … oneShotFetch(url, init)`, harvest's `defaultFetchText`/`defaultFetchJson`.
  Injection seams (`opts.fetch`, `opts.fetchText`/`fetchJson`) and the replaced-`globalThis.fetch`
  test seam are preserved (`oneShotFetch` defers to a replaced reference).
- **Pin added** (`one-shot-fetch.test.ts`, `fixes/346 A2-F5`): static bytes guard — none of the three
  files contains a bare global `fetch(`; each references `oneShotFetch`.
- **RED (both runtimes)** — three source files stashed to HEAD:
  `not ok 2 - fixes/346 A2-F5 … | # tests 8 # pass 5 # fail 3` (Node 24 and Node 22).

## A2-F6 — redaction coverage

- **File:** `src/lib/node-runner.server.ts` (**taken via STOP-and-REPORT — see below**).
- **Change:** `redactSecrets` now redacts the exact `XAI_API_KEY`/`TAVILY_API_KEY` values (alongside the
  existing `DEEPSEEK_API_KEY`), plus the `xai-`/`tvly-` vendor shapes (alnum body ≥16, so hyphenated
  prose like `xai-based-tool`/`tvly-dev` is left byte-identical — no over-match). `sk-…` was already covered.
- **Pins added** (`node-runner.server.test.ts`, `fixes/346 A2-F6`): xai-/tvly- shape redaction; exact
  XAI/TAVILY env-value redaction; a no-over-match control for short/hyphenated lookalikes.
- **RED (both runtimes)** — source stashed to HEAD:
  `not ok 9 … redacts xai- and tvly- …`, `not ok 10 … XAI_API_KEY / TAVILY_API_KEY values …`;
  `# tests 21 # pass 19 # fail 2` (Node 24 and Node 22).

## A2-F7 — injective content addresses

- **File:** `src/lib/knowledge.ts` (`fingerprint`, `failureSignature`, `probeTagsFromSignature`).
- **Change:** added an injective field codec (`\u0001` escape introducer: `e`/`n`/`p`/`c` → escape char /
  NUL / `|` / `,`). `fingerprint` escapes each field for the NUL join and the tags/supersedes lists for the
  inner `,` join; `failureSignature` escapes `kind`/`class`/anchors (and `tail`) for the `|`/`,` joins;
  `probeTagsFromSignature` decodes anchors back to their real ids. Delimiter-free input is byte-identical,
  so ordinary row ids do not churn (the exact-signature pin at `knowledge.test.ts:929` stays green).
- **Pins added** (`knowledge.test.ts`, `fixes/346 A2-F7`): a NUL-in-title vs tags row pair now get distinct
  ids (was swallowed by the old NUL join); `anchors:["a,b"]` ≠ `anchors:["a","b"]`; the escaped anchor
  round-trips to the `probe:a,b` tag.
- **RED (both runtimes)** — `knowledge.ts` stashed to HEAD:
  `not ok 2 - a NUL inside a field cannot collide two distinct knowledge rows`,
  `not ok 3 - failureSignature: anchors ['a,b'] and ['a','b'] are distinct…`;
  `# tests 53 # pass 51 # fail 2` (Node 24 and Node 22).

## A2-F8 — MCP trust boundary, stated honestly

- **File:** `src/lib/mcp.server.ts` (header HONESTY bullet, `McpToolInfo.readOnly` doc, `callTool` gate
  comment).
- **Change:** states that `annotations.readOnlyHint` is the SERVER'S SELF-DECLARATION, that the gate cannot
  stop a lying server from writing, and that the feature is owner-gated. No capability invented; no gate
  weakened (a non-read-only advertised tool is still refused — unchanged).
- **Pin added** (`mcp.server.test.ts`, `fixes/346 A2-F8`): static guard that the source keeps the words
  "self-declaration", "lying server", and "owner-gated".
- **RED (both runtimes)** — `mcp.server.ts` stashed to HEAD:
  `not ok 1 - the module documents … | # tests 40 # pass 39 # fail 1` (Node 24 and Node 22).

## A2-F2 — failover: DELETED the un-armed shell (decision + evidence)

**Decision: delete, not arm.** Arming needs all three of: (1) a *registered* probe-verified second-family
descriptor (today `applyProbedModels` only MINTS one; nothing registers it), (2) a served-provider
provenance field the router can stamp, and (3) a *funded* live probe to actually mint ids (`xai` is the only
non-DeepSeek family and is a CANDIDATE with `requestModelIds: []`). With **0 keyed calls** and no production
probe consumer, (1)+(3) are unreachable this wave — an "armed" router would still have nothing to route to.
So the honest action is to remove the switch that implied resilience.

- **File:** `src/lib/llm/providers/registry.ts`.
- **Change:** removed `FALLBACK_PROVIDERS_ENV_VAR`, `failoverArmingGap`, `resolveFallbackChain`, and the
  `callModel` "configured-but-NOT-ARMED" refusal; header/comment corrected to state plainly that there is NO
  failover and every role tiers to `deepseek`. `RAPIDTOOL_FALLBACK_PROVIDERS` is now inert (not read).
- **Pins** (`registry-failover.test.ts` — rewritten in place, since tracked-file deletion is barred):
  the module exports neither the switch name nor a chain resolver; a configured
  `RAPIDTOOL_FALLBACK_PROVIDERS=xai,deepseek` produces the exact keyless-floor result (proves it is not
  consulted); `xai` stays an empty CANDIDATE and every role still routes to `deepseek`.
- **RED (both runtimes)** — `registry.ts` stashed to the pre-deletion code:
  `not ok 1 - … no un-armed failover switch is exported`, `not ok 2 - … legacy env var is inert`;
  `# tests 3 # pass 1 # fail 2` (Node 24 and Node 22).

## A1-08 — coded validation error in token-ledger

- **File:** `src/lib/token-ledger.ts:575` (`recordBudgetSpend`).
- **Change:** the bare `Error` now carries `.code = "RT_E_VALIDATION"` via `Error & { code?: string }`;
  message byte-identical.
- **Pin added** (`token-ledger.test.ts`): the malformed-budget refusal asserts `.code`.
- **RED (both runtimes)** — source stashed to HEAD: `not ok 6 … coded error (A1-08)`;
  `# tests 39 # pass 38 # fail 1` (Node 24 and Node 22).

## checkpointAdmits `savedAt` — validated

- **File:** `src/lib/checkpoint.server.ts:407` (`checkpointAdmits`).
- **Change:** before the admission return, validate `savedAt` is a finite number in `[0, 8.64e15]`
  (ECMAScript time range, so a later `new Date(savedAt)` cannot throw); absent/`"x"`/`NaN`/negative/
  out-of-range now return `RT_E_VALIDATION`. The reader's `isRunCheckpoint` guard only covered the file-read
  path; this export accepts a foreign object directly.
- **Pin added** (`checkpoint.server.test.ts`, `fixes/346`): the boundary loop plus a finite in-range control.
- **RED (both runtimes)** — source stashed to HEAD: `not ok 7 - fixes/346: checkpointAdmits validates
  savedAt itself …`; `# tests 29 # pass 28 # fail 1` (Node 24 and Node 22).

## `requiresHumanResume` — claim STRUCK (no in-module consumer; STOP-and-REPORT)

- **File:** `src/lib/watchdog.ts`.
- **Change:** the module header claimed the store driver / headless macro / heartbeat share these decisions;
  only `heartbeatLagClass`/`HEARTBEAT_TICKS_PER_PERSIST` are actually consumed. Corrected the header + the
  `requiresHumanResume` doc to state plainly that `watchdogDecision`/`shouldAutopause`/
  `requiresHumanResume`/`boundedStepWatch` have NO production consumer yet and are test-only until the store
  driver wires them. The bytes do not support wiring inside `watchdog.ts` itself, so the claim is struck
  rather than a driver invented. No behavioral RED (doc-only); `watchdog.test.ts` stays green.

---

## STOP-and-REPORTs

1. **`node-runner.server.ts` (A2-F6 — taken under the item's own "if you take it via STOP-and-REPORT").**
   `redactSecrets` is defined only there; the coverage fix required ~1 line-list + 2 regexes + doc. No other
   file in this lane defines redaction. Reported per the ownership rule.
2. **`requiresHumanResume` consumer is out of ownership.** Exact call site to wire:
   `src/lib/store.ts:1432` `startWildRun: async (id) => { … }` — the resume branch at
   `src/lib/store.ts:1464` ("re-entering the loop here is exactly the resume path"), which should gate on
   `requiresHumanResume(stallLatch)`. Secondary sites: the headless macro `src/lib/headless.ts:5553`
   (`wildStartRun`) and the client heartbeat `src/lib/rt-client.ts`. `store.ts` is another lane's file (it is
   being edited concurrently — these line numbers were read live during this lane and will shift with that
   lane's edits), so it is reported, not touched.

## What remains

- Cross-family failover is still unimplemented (deleted switch, not a capability): needs a funded live probe
  → a `PROVIDERS` registration seam → a served-provider provenance field on `LlmResult` → a transient-class
  router. Owner-gated on keyed evidence.
- `requiresHumanResume` / `shouldAutopause` / `boundedStepWatch` remain unwired until the store wild driver
  is updated (STOP-and-REPORT #2).
- Historical docs (`fixes/*`, `wave_plans/*`, `finalsprint.md`, `research/multiagent/101_*.md`) still
  describe `RAPIDTOOL_FALLBACK_PROVIDERS` as a planned/landed switch; those are other owners' historical
  records and were left untouched.
- Not in this lane: A2-F3 (repo map on the single-module lane), A2-F9 (dead exports), the remaining
  L3/A4 open items from `fixes/345_0_parent.md` §5.
