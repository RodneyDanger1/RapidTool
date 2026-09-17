# 101 — Provider/LLM Integration Layer: audit + multi-provider adapter design

**Date:** 2026-09-16 · **Scope:** READ-ONLY audit + design dossier (no source, test, or config file was
modified; the only write is this file) · **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`
(git-bash `/c/Users/mnril/Desktop/RapidTool Main`, HEAD `0e393ba`) · **Node:** v22.23.2

**Evidence convention used throughout**

| Tag | Meaning |
|---|---|
| **[V]** | Verified by me today against bytes on disk or a live endpoint, with the command / quoted fragment shown. |
| **[C]** | A claim made by the repo's own docs/comments (cited `file:line`) — trusted as *intent*, not as proof of current behavior. |
| **[P]** | Proposed design (not implemented). |
| **[U]** | UNVERIFIED — could not be fetched/executed on this host; do not treat as fact. |

Paths with a space break `search_files`/ripgrep on this host; every search below ran as
`cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n …` in `terminal`.

**Anchor provenance (read this before quoting a line number).** The working tree carried uncommitted
in-flight edits from other lanes when this audit ran — `git status --porcelain` reads
`M src/lib/codegen.server.ts` (+88/−5), `M src/lib/headless.ts`, `M src/lib/errors.ts`,
`M src/lib/dod.ts`, `?? src/lib/token-ledger.ts`, plus `scripts/` and `src/components/console.tsx`.
**Every `file:line` below was read from today's working-tree bytes, not from HEAD `0e393ba`.** The
audit's key anchor files `src/lib/deepseek.server.ts`, `llm.ts`, `llm-tasks.ts`, `types.ts`,
`phases.ts` are clean vs HEAD; for the four dirty files above, re-grep before applying a change.

---

## 0. Executive summary

RapidTool's entire live inference surface is **one 462-line server module**,
`src/lib/deepseek.server.ts`, called directly by 10 modules and through a TanStack server-fn facade
(`src/lib/llm.ts`) by the engine/UI. There is **no provider abstraction, no base-URL override, no key
validation, and no cost accounting outside the P6 synthesis path** — and the vendor renamed its model
ids on us (live-verified today: `/models` returns exactly `deepseek-flash` + `deepseek-v4-pro`, while the
repo still hardcodes `deepseek-v4-flash` and advertises a phantom `…-vision-exp`).

Five integration bugs lead the register (§3): a **facade kwargs asymmetry that re-enables the exact
"thinking+JSON → empty content" blocker the repo already fixed on the server call sites** (HIGH), a
**token cap that only meters one of eight paid call paths** (HIGH), an unguarded `res.json()` on the
success path that mislabels a gateway HTML page as a provider refusal (MED), a **key-presence-only
doctor** that advertises model ids the vendor no longer lists (MED), and **12 hardcoded model-id
literals across 8 files** behind a 2-member union type (MED).

The design (§4) adds a `provider-types.ts` (pure) + `provider.server.ts` (server-only) pair: six
adapters behind one `LlmProvider` interface, a router that owns *all* retry/failover/probe policy, an
env scheme (`RAPIDTOOL_PROVIDER`, `<P>_API_KEY`, `<P>_BASE_URL`, `<P>_MODEL_FLASH/_PRO`) whose **default
path is byte-identical to today**, and a keyless-floor rule that preserves the honesty contract per
provider. Existing callers adopt it with a **1-line diff** (`completeDeepSeek(prompt, opts)` keeps its
signature and its injectable `fetch`/`sleep`/`random` seams, so all 21 tests in
`deepseek.server.test.ts` stay green).

**Highest-risk item (§6):** the *persisted route-honesty coupling*. `ModelRoute` (`types.ts:21`) is
written into the Agent Packet (`packet.ts:106`) and asserted by a DoD claim —
`dod.ts:729` "No grok-4.5, no Ollama, no failover routes." — and `phases.ts:89` publishes "no
Ollama/local-edge handoff". Adding providers or failover **without** migrating that union + its hydrate
path (`engine.ts:1844-1865`) + those two claims would either stamp a false `deepseek-*` provenance on
non-DeepSeek runs or silently collapse real provider runs to `"deterministic"`. Provider work is
therefore *also* a claims-strike task (P0-04), not just an adapter task.

---

## 1. Verified current state

### 1.1 The single client — `src/lib/deepseek.server.ts` (462 lines)

| Fact | Evidence |
|---|---|
| Base URL is a hardcoded const, **not env-overridable** | `deepseek.server.ts:23` `export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";` **[V]** |
| Key read from `process.env.DEEPSEEK_API_KEY` only, trimmed, blank ⇒ undefined | `:87-94` `function env(key){const v = process.env[key]?.trim(); return v || undefined;}` / `deepseekApiKey()` **[V]** |
| Zero non-DeepSeek provider surface in the repo | `grep -rniE "OPENAI_API_KEY\|XAI_API_KEY\|ANTHROPIC_API_KEY\|OPENROUTER_API_KEY\|OLLAMA\|GROK" src scripts` → only (a) legacy Grok **platform** scaffolding (`src/lib/auth/*`, `src/lib/app-data/*`: `GROK_CONNECTORS_URL`, `GROK_PROVIDER_*`, `grok-auth.*` localStorage keys), (b) `algorithms.ts:1169` `{ name: "Ollama", role: "Edge draft/format loops" }` inside a **domain-library advice table** (`LIB_DOMAIN["agent-platform"]`), (c) `algorithms.ts:1061` a tokenizer-encoding comment. No chat-provider client exists. **[V]** |
| The historical x.ai shim is gone | `ls src/lib/ai.ts` → *No such file or directory*; `research/deepseek-api.md` §10 records "(The retired x.ai `src/lib/ai.ts` shim was deleted 2026-09-06 — E-30.)" **[V]** |
| Tier table | `:26-29` `DEEPSEEK_MODELS = { flash: "deepseek-v4-flash", pro: "deepseek-v4-pro" }` **[V]** |
| Advertised model list (3 ids incl. a vision model) | `:32-36` `DEEPSEEK_MODEL_IDS = [flash, pro, "deepseek-v4-flash-vision-exp"]` **[V]** — **stale vs live vendor state, see §1.5** |
| Defaults | `:43-46` flash 1024 tokens / 20 s; pro 8192 / 60 s; `:53` `DEEPSEEK_LONG_TIMEOUT_MS = 90_000` **[V]** |
| Retry | `:57-58` `RETRYABLE_STATUS = new Set([429,500,503]); MAX_ATTEMPTS = 3`; `:70-85` full-jitter backoff `RETRY_BASE_MS=500`, cap `RETRY_MAX_JITTER_MS=8000`; `:196-230` `postWithRetry` (AbortError rethrown, never retried; last response / last network error retained + attempt count attached) **[V]** |
| Error prose | `:232-285` `describeError` reads `res.text()` **once**, tries JSON for `error.message`, else surfaces a bounded 200-char raw excerpt with an honest label (`"non-JSON body"` / `"JSON body without error.message"`) — fixes/153 shape, correct **[V]** |
| Body build | `:313-362`: optional `system` message; when `json:true` **appends a second system message** `"Respond with valid JSON only — no prose, no markdown fences."`; history filtered to user/assistant, ≤6 entries, 4000-char `cutMarked`; one `user` turn appended; then `thinking` (disabled unless pro-with-default), `max_tokens`, optional `response_format:{type:"json_object"}`, `stream:false` hardcoded. **[V]** |
| Success parse | `:399` `const parsed = (await res.json()) as DeepSeekChatBody;` — see **§3 bug #3** |
| Served-model read-back **already exists** | `:424-425` `model: typeof parsed.model === "string" && parsed.model ? parsed.model : model` **[V]** — the one piece of the multi-provider design already done right |
| Usage | `:420-435` maps only `usage.prompt_tokens` / `completion_tokens`; new vendor fields ignored (see §1.5) **[V]** |
| Timeout / network failure mapping | `:437-458`: `isAbortError → RT_E_LLM_TIMEOUT`; else `classifyError(err, "RT_E_LLM_REJECTED")` **[V]** |
| Keyless envelope | `:291-294` `{ ok:false, reason:"not-configured", code:"RT_E_LLM_NOT_CONFIGURED" }` — no `error` field **[V]** |

### 1.2 Consumers (all `completeDeepSeek(`/`isDeepSeekConfigured()` sites, non-test)

| Module:line | Call | Model passed | Notes |
|---|---|---|---|
| `llm.ts:42-50` | server-fn facade + status | passthrough | validator whitelists **only** `{model,system,maxTokens,json}` (`:35-40`) — see bug #1 |
| `prompt-engine.ts:229-240` | brief expansion (`expansionCall`, def `:229`) | `DEEPSEEK_MODELS.flash` | `json:true`, `maxTokens:3000`, `timeoutMs: DEEPSEEK_LONG_TIMEOUT_MS`; one bounded unparseable-repair re-prompt (`expandBrief`, def `:260`) |
| `codegen.server.ts:1394-1430` | P6 single-module synthesis | `P6_SYNTH_MODEL` (`:133`) | `json:true`, `thinking:false`, 32 000 tokens, **240 000 ms** (`:113`, `:124`); one bounded repair class per failure kind (`synthesizeChunkEnvelope`, `:1662+`) |
| `codegen.server.ts:1573-1590` | P6 chunked synthesis (≤8 sigs/chunk, `P6_SYNTH_CHUNK_SIZE=8` at `:477`, `chunkTypeSignatures` at `:492`, entry path `TREE_ENTRY_PATH="src/generated.ts"` at `:483`) | `P6_SYNTH_MODEL` | sequential `for` loop over chunks (`:1600-1620`), same opts |
| `codegen.server.ts:1018` | `defaultDeps.complete = completeDeepSeek` (the injectable synthesis seam) | — | `synthWithBackoff` (`:989-1025`) retries **only** `RT_E_LLM_TIMEOUT`, 2 attempts |
| `verify.server.ts:639/655/683` | oracle case generation + 2 bounded repairs | literal `"deepseek-v4-flash"` | repairs fire **only** on `parseOracleJson === null` or dropped pinned ids — correct retry hygiene |
| `verify.server.ts:814` | source-patch prompt | literal `"deepseek-v4-flash"` | |
| `chat.server.ts:560-567` | grounded copilot turn | literal `"deepseek-v4-flash"` | flash ⇒ thinking off by tier default |
| `engine.ts:2887-2915` | live phase narrative + P2 constraint extraction (via `llm.ts` ⇒ `llm-tasks.ts`) | `"deepseek-v4-pro"` (`llm-tasks.ts:119/144/168`) | **pro + json + thinking ON** — see bug #1 |
| `store.ts:1576` | rejection-note interpretation (via `llm-tasks.ts`) | `"deepseek-v4-pro"` | same path |
| `crew.server.ts:871` | crew turn wrapper | opts from caller | forces `timeoutMs: DEEPSEEK_LONG_TIMEOUT_MS`; own 2-attempt timeout retry (`:863-885`) |
| `harvest.ts:230-241` | harvest query builder | `DEEPSEEK_MODELS.flash` | `json:true`, 512 tokens, custom system |
| `algo-tools.ts:119/237` | algorithm spec / property cases | literal `"deepseek-v4-flash"` | |
| `vector.ts:854-858` | vector/embedding-adjacent JSON task (dynamic-import seam) | literal `"deepseek-v4-flash"` | |
| `planning.ts:97-101` | planner completer **type** only | — | injected, no default binding |
| `headless.ts:213-230` | `--live` phase narrative | default (flash) | |
| `headless.ts:1325-1330`, `2636-2646` | keyed pre-flight, `doctorStatus` llm block | — | key-presence only |
| `engine.ts:2729-2745` | `upgradeP6Keyed` direct-env gate | — | deliberately bypasses the server-fn status (`"NEVER the server-fn llmStatus, which reports unconfigured under bare Node"`) |
| `crew.ts:162-166`, `crew.server.ts:1393-1395` | UI status fns | — | `{configured, models}` |
| `wild-mode.server.ts:25/335` | wild classifier | via client-safe `complete()` | |
| `scripts/rapidtool-cli.mjs:1620` | dynamic import of `deepseek.server.ts` | — | CLI stays thin (all work in `headless.ts`) |

### 1.3 Provider-agnostic plumbing that already exists (reuse, don't rebuild)

- **RT_E registry** — `src/lib/errors.ts:22-49` `ERROR_CODES` (additive-only, `:18-19`), `codeError`
  (`:57`), `dualChannelFailDetail` (`:72-82`, 185-H1), `classifyError` (`:157-211`, walks cause chains
  + AggregateError children) and `ERROR_CODE_DOC` (`:218-331`, doc-sync enforced by `errors.test.ts`). **[V]**
- **Exit taxonomy** — `scripts/README-cli.md` §"Error codes (RT_E_*)": `RT_E_LLM_NOT_CONFIGURED` ⇒
  **exit 3**, `RT_E_LLM_TIMEOUT` / `RT_E_LLM_REJECTED` / `RT_E_INTERNAL` ⇒ **exit 4**,
  `RT_E_BUDGET_EXHAUSTED` ⇒ exit 1 path. Agents branch on `code` first, `exit_code` second. **[V]**
- **Token ledger** — `src/lib/token-ledger.ts` (whole file): `RAPIDTOOL_TOKEN_CAP`,
  `assertWithinBudget` (`:104-108`, pre-call gate), `recordSpendWithinCap` (`:115-125`, throws
  `SessionBudgetExceeded`/`NoMoneyException` with `code = "RT_E_BUDGET_EXHAUSTED"`). **[V]**
- **Probe precedent** — `headless.ts:2567-2595` `probeKeylessSearch`/`probeTavily`: real 1-result call,
  3 s `withTimeout` (`:2555-2565`), **result-shape check** (`r.ok === true`), never caches a failure.
  That is the pattern the provider probes must copy. **[V]**
- **Honesty contract** — `AGENTS.md:71-89`: keyless floor + never fake model text; no `node:fs` in
  client-safe modules; server-only modules use dynamic import seams; every surfaced failure carries an
  RT_E code (`ERROR_CODE_DOC` canonical). **[V]**

### 1.4 Route provenance is a persisted, packet-visible contract (the coupling that bites)

- `types.ts:15-21` — `ModelRoute = "deepseek-flash" | "deepseek-pro" | "deterministic" | "none"`, with
  the comment that the retired `"grok-4.5" | "local-edge" | "failover"` labels "described a target
  architecture that was never implemented". **[V]**
- `engine.ts:1844-1865` `hydrateModelRoute`: known values pass through; `"grok-4.5" | "local-edge" |
  "failover"` **collapse to `"deterministic"`** (or `"deepseek-flash"` iff a log line shows a real LLM
  call); anything else ⇒ `"deterministic"`. **[V]**
- Writers: `codegen.server.ts:1223/1749/1813` (`"deepseek-pro"`), `engine.ts:3036-3041` and
  `headless.ts:276-284` (`"deepseek-flash"`), `engine.ts:1745` (`"deterministic"` default). **[V]**
- Rendered: `packet.ts:106` `model_route: project.modelRoute`. **[V]**
- Claims that the adapter work must strike or extend:
  `dod.ts:727-729` `implemented: ["deepseek-v4-flash","deepseek-v4-pro"]` + claim **"No grok-4.5, no
  Ollama, no failover routes. modelRoute honesty enforced (E-14)."**;
  `dod.ts:715-718` outbound claim "DeepSeek API + research providers only";
  `phases.ts:89` P10 summary **"deepseek-v4-flash / deepseek-v4-pro are the only configured routes; no
  Ollama/local-edge handoff."** **[V]**

### 1.5 LIVE vendor drift, re-verified today (2026-09-16) — the repo docs are stale

Commands (key read from the repo's own `.env`, never printed):

```
$ KEY=$(sed -n 's/^[[:space:]]*DEEPSEEK_API_KEY[[:space:]]*=[[:space:]]*//p' .env | tr -d '\r"' | head -1)
$ curl -s -H "Authorization: Bearer $KEY" https://api.deepseek.com/models
{"object":"list","data":[{"id":"deepseek-flash","object":"model","owned_by":"deepseek"},
 {"id":"deepseek-v4-pro","object":"model","owned_by":"deepseek"}]}
```

| Live fact | Result |
|---|---|
| `/models` now lists **exactly two** ids: `deepseek-flash`, `deepseek-v4-pro` | **[V]** (above) |
| Repo's `DEEPSEEK_MODELS.flash = "deepseek-v4-flash"` (`:27`) and `DEEPSEEK_MODEL_IDS` incl. `deepseek-v4-flash-vision-exp` (`:32-36`) are **not** in `/models` anymore | **[V]** — `research/deepseek-api.md` §2 (dated 2026-09-05) still documents the old 3-id list |
| `model:"deepseek-v4-flash"` → **200, alias accepted**, response `.model` = **`deepseek-flash`** | **[V]** `POST /chat/completions` (`max_tokens:8`, thinking disabled) ⇒ `{"model":"deepseek-flash","choices":[{"message":{"content":"OK"}},…}` |
| `model:"deepseek-flash"` → 200, `.model` = `deepseek-flash` | **[V]** (same probe) |
| Parent-supplied: the v4.1 id is **rejected** with "The supported API model names are deepseek-flash, deepseek-v4-pro, but you passed deepseek-v4.1-flash."; `deepseek-chat`/`deepseek-reasoner` are accepted but **silently served as `deepseek-flash`** | **[C]** parent live probe, consistent with `research/deepseek-api.md` §2 legacy-alias warning |
| Success responses now carry `usage.prompt_tokens_details.cached_tokens`, `prompt_cache_hit_tokens`, `prompt_cache_miss_tokens`, `system_fingerprint` | **[V]** (raw body above) — the client drops all of them (`:420-435`) |
| `thinking:{type:"enabled"|"disabled"}` and `reasoning_effort` are DeepSeek body keys; reasoning tokens **count against `max_tokens`** | **[V]** `research/deepseek-api.md` §4/§4b-4d; the code encodes the same contract at `:344-362` |

> **Consequence for the adapter:** never hardcode a `v4.1`-style id; treat the tier table as a
> *default* that is (a) env-overridable and (b) corrected by the served `.model` read-back (already at
> `:424-425`). Canonical today: flash = `deepseek-flash`, pro = `deepseek-v4-pro`.

### 1.6 Live third-party probes (endpoint existence + error envelopes)

| Probe | Result | Tag |
|---|---|---|
| `GET https://api.x.ai/v1/models` (no creds) | **401** `{"code":"unauthenticated:no-credentials","error":"No credentials presented."}` → endpoint + `/v1` prefix exist; **xAI's error body is a flat `{code,error:string}` — not OpenAI's nested shape** | **[V]** |
| `POST https://api.anthropic.com/v1/messages` (no creds) | **401** `{"type":"error","error":{"type":"authentication_error","message":"x-api-key header is required"},"request_id":"…"}` → confirms path, the **`x-api-key`** auth header, and the nested error envelope | **[V]** |
| `GET https://openrouter.ai/api/v1/models` | **200** (full public catalog) → base URL + endpoint shape confirmed; note the catalog is public, so it is **not** a key probe | **[V]** |
| `GET https://openrouter.ai/api/v1/key` (no creds) | **401** `{"error":{"message":"No cookie auth credentials found","code":401}}` → endpoint exists; with a Bearer key it is the cheapest key probe (returns limits/usage/credits — body **[U]**) | **[V]/[U]** |
| `GET https://api.openai.com/v1/models` (no creds) | **401** `{"error":{"message":"Missing bearer authentication in header","type":"invalid_request_error","param":null,"code":null}}` → classic OpenAI error envelope | **[V]** |
| Local Ollama | `curl http://localhost:11434/api/version` → **HTTP 000 (connection refused)** — Ollama is **not installed/running on this host** | **[V]** |
| Ollama native API contract | docs (`raw.githubusercontent.com/ollama/ollama/main/docs/api.md`): `POST /api/chat` and `POST /api/generate`; **streaming is the default**, disable with `{"stream":false}`; `format: "json"` or a JSON schema; `options.num_predict` etc. | **[V]** (docs fetch); `docs/openai.md` → **404 on `main`** ⇒ the OpenAI-compat path (`/v1/chat/completions`) is **[U]** from docs on this host |

---

## 2. The 10-pattern LLM-client checklist, applied to the real code

Checklist = `~/AppData/Local/hermes/skills/software-development/codebase-audit/references/llm-client-audit-checklist.md`.

| # | Pattern | Applies? | Evidence (file:line) |
|---|---|---|---|
| 1 | Uncaught `resp.json()` on a 200 | **PARTIAL — live, MED** | `deepseek.server.ts:399` runs inside the outer `try` (`:366`), so `SyntaxError` **is** caught — but at `:437-458` it maps to `classifyError(err,"RT_E_LLM_REJECTED")` ⇒ a gateway HTML page is reported as *the provider refusing*, whose documented agent action is "check key/balance/parameters" (`scripts/README-cli.md`). The body is already consumed, so no excerpt survives. Same class fixes/153 fixed on the **error** path (`:239-266`) but not here. **Fix:** `const raw = await res.text()` → `JSON.parse` in its own try ⇒ `RT_E_INTERNAL` + bounded excerpt. |
| 2 | Fallback-chain catch-width asymmetry | **N/A today; PREDICTED #1 risk for the new router** | No fallback chain exists (`grep` for a second provider = 0). The design must give every adapter **one** error surface (`ProviderCallError` with a typed `kind`), and the router must switch on `kind`, never on `instanceof`. |
| 3 | Kwargs forwarded to providers that reject them | **APPLIES — and already live in the mirrored form (HIGH, bug #1)** | DeepSeek-only body keys `thinking` / `reasoning_effort` are built at `:344-362`. Nothing else consumes them **today** (grep: no other client), so as raw cross-provider leakage it is latent — but the *inverse* leak is live: the client-safe facade `llm.ts:35-40` **drops** `thinking`/`timeoutMs`, so `llm-tasks.ts:118-121` runs pro+json with thinking ON (`engine.ts:2905`, `store.ts:1576`). Design rule: per-provider **whitelist** bodies, never a shared spread. |
| 4 | Mid-stream retry duplication | **N/A (no streaming at all)** | `grep -rniE "text/event-stream\|stream: true" src/lib scripts` → 0 hits; `stream: false` hardcoded at `:361`. The retry loop wraps a single non-stream request, so no duplication risk. Design pre-commits the `yielded_any` rule for any future SSE work (§4.5). |
| 5 | `ping()` treating `status < 500` as reachable + caching | **N/A-adjacent — the inverse bug is live (MED, bug #4)** | No LLM ping exists; `doctorStatus` (`headless.ts:2636-2646`) checks **key presence only** — no HTTP at all, so an invalid key reports `configured:true`. The correct in-repo precedent (`probeKeylessSearch`/`probeTavily`, `:2567-2595`) does a real call + shape check + 3 s cap; the provider probes must follow it and **cache only on success**. |
| 6 | Retry-loop hygiene | **(a) N/A (b) OK (c) OK (d) APPLIES-minor** | (a) sleep happens *before* attempt `n>0` (`:203-204`), so no post-final-attempt sleep; (b) `lastResponse`/`lastNetworkError` retained + `attempts` attached (`:220-229`) and surfaced as `" (after N attempts)"` (`:390`); (c) non-retryables (400/401/402/422) are outside `RETRYABLE_STATUS` (`:57`), and the "second chance" repairs fire only on **parse/validation** failure — `verify.server.ts:646-660`, `codegen.server.ts:1684-1705`; (d) **408/502/504 are not retried** (`:57`) — gateway timeouts land as one-shot failures. |
| 7 | OpenAI↔Anthropic conversion gaps | **N/A today (one OpenAI-shaped provider); design must specify** | The rules are enumerated in §4.3 (Anthropic: system top-level, merge alternating roles, never inject a fake user turn, drop `reasoning_content`, handle `role:"tool"` refusal). |
| 8 | Truncation edge cases | **PARTIAL — one latent edge** | `cutMarked` (`:117-123`) is safe and marked; history ≤6×4000 (`:328-338`); `P6_BRIEF_MAX_CHARS=2000` uses a visible `TRUNCATION_MARK` (`codegen.server.ts:134-136`). Latent: `cutMarked(s, cap)` with `cap < TRUNC_MARK.length` returns the bare `"…[TRUNCATED]"` marker (the checklist's own first item) — no caller passes such a cap today. Char-vs-token mismatch is documented (`P6_MODULE_MAX_CHARS=60_000` vs 32 000 output tokens). |
| 9 | Concurrency cap raising instead of queueing | **N/A (no cap, no queue)** | Chunked synthesis is a sequential `for … await` (`codegen.server.ts:1600-1620`); no `in_flight` counter in the LLM layer (grep). Design note: if a future wave parallelizes chunks, add a **bounded semaphore** (await, never raise) and decrement in `finally`. |
| 10 | Unsupported payloads attached to valid calls (vision) | **N/A (no image blocks anywhere)** | No `image_url`/content-part construction in the repo. `deepseek-v4-flash-vision-exp` is advertised in `DEEPSEEK_MODEL_IDS` (`:35`) but never sent. Design: gate any future vision payload behind a per-provider capability flag; on 400 drop the image and retry once. |

### 2.1 Verified OK (checked, not bugs) — say so explicitly

- **Empty-content diagnostics** (`:401-419`): distinguishes reasoning-only / `finish_reason:"length"` /
  silent — exactly the triage an agent needs; keep verbatim across providers.
- **History sanitization** (`:328-341`): non-array garbage degrades to no history; smuggled `system`
  turns are dropped; entries trimmed + `cutMarked`-capped.
- **Prompt validation before network I/O** (`:297-305`): empty prompt ⇒ `RT_E_VALIDATION`, no round trip.
- **Abort semantics** (`:104-111`, `:211-217`, `:364-365`, `:437-444`): one `AbortController` + timer,
  cleared in `finally`; AbortError is never retried; timeout is reported with the budget in seconds.
- **Repairs are parse-triggered, not error-triggered** (`verify.server.ts:646-660`;
  `codegen.server.ts:1678-1700`): a 401/429 can never burn a second billed "repair" call — the
  checklist's 6(c) trap is avoided.
- **Layering is non-overlapping**: the client retries HTTP-transient (429/5xx/network) only;
  `synthWithBackoff` (`codegen.server.ts:989-1025`), `expandBriefWithBackoff` (`:930-945`) and
  `completeCrewTurn` (`crew.server.ts:863-885`) retry **timeout-only**. No single failure is retried by
  both layers ⇒ no amplification, no double billing today.
- **Dual-channel guard** (`errors.ts:72-82`) is applied on every non-`.server` consumer
  (`chat.server.ts:571`, `harvest.ts:239`, `prompt-engine.ts:250-253`, `codegen.server.ts:1385`).

---

## 3. Findings register

Severity: CRITICAL = breaks the honesty contract or silently corrupts persisted provenance ·
HIGH = user-visible feature degrades or money can be spent unmetered · MED = wrong classification /
stale truth / blocked extension · LOW = hygiene.

### HIGH-1 — The client-safe facade drops `thinking`, so the pro+JSON empty-content class is still live on the UI path

- **Evidence.** `llm.ts:34-44` — the server fn's validator is
  `(input: { prompt: string; opts?: { model?; system?; maxTokens?; json? } })` and its handler calls
  `completeDeepSeek(data.prompt, data.opts)`; `DeepSeekCompleteOptions` has `thinking`/`timeoutMs`
  (`deepseek.server.ts:125-160`) but the facade's type/validator cannot carry them.
  `llm-tasks.ts:118-121` (and `:143-145`, `:167-169`) then calls `{ model: "deepseek-v4-pro", json: true }`
  **through** that facade ⇒ `deepseek.server.ts:344-362` keeps `thinking:{type:"enabled"}` +
  `reasoning_effort:"high"` for pro. Live callers: `engine.ts:2905` (P2 constraint extraction),
  `store.ts:1576` (rejection-note guidance), `engine.ts:2888` (phase narrative).
- **Why it's a regression, not a nit.** fixes/156 E1 (`codegen.server.ts:1403-1414`, `:1574-1585`)
  documents that pro + thinking + a JSON envelope returned `content:""` on *every* call at 32 k tokens
  with `finish_reason:"length"`, and the fix was exactly `thinking:false`. The same package runs
  unchanged through the facade at 8192 default tokens.
- **Blast radius.** The failure is honest (`RT_E_LLM_REJECTED` + the diagnostic note) — it degrades,
  never fabricates. But `RT_E_LLM_REJECTED`'s documented agent action is "check key/balance/parameters",
  which is the wrong triage for a budget-shaped empty response.
- **Fix (proposed).** `[P]` Widen the facade validator/type with `thinking?: boolean; timeoutMs?: number;
  provider?: string` and, in `llm-tasks.ts`, pass `thinking:false` whenever `json:true` and the resolved
  tier is pro (or centralize: `LlmProvider.normalizeBody` force-disables thinking for `json:true` unless
  the caller explicitly asked for it).

### HIGH-2 — `RAPIDTOOL_TOKEN_CAP` meters exactly one of the paid call paths

- **Evidence.** `recordSpend`/`p6TokenCapFromEnv` are wired **only** in `codegen.server.ts`
  (`:103` import, `:962-1013` `accountSynthUsage`/`synthWithBackoff`, `:995`). Every other paid caller —
  `chat.server.ts:560`, `verify.server.ts:639/655/683/814`, `algo-tools.ts:119/237`, `vector.ts:855`,
  `harvest.ts:230`, `prompt-engine.ts:230`, `crew.server.ts:871` (crew keeps its **own** session totals
  at `:1056-1061`, `:1263`), `headless.ts:222`, `engine.ts:2888/2905`, `store.ts:1576` — records nothing.
  `harvest.ts:237-238` says so in prose: *"Usage on res is dropped here — harvest.ts has no numeric token
  cap (parent must wire recordSpend at codegen.server.ts liveP6Synthesis)"*. `doctor.ts:174` only
  **reports** the cap.
- **Blast radius.** `RT_E_BUDGET_EXHAUSTED` can never fire outside P6; a copilot/verify/crew session can
  spend without bound. In a multi-provider world the same hole becomes the cost-control story.
- **Fix (proposed).** `[P]` Move the ledger handle into the router (`CompleteRequest.accounting?:
  { ledger: TokenLedger; cap?: number }`), call `assertWithinBudget` **before** each attempt (retries and
  failover cost money too) and `recordSpendWithinCap` after every response — including failures that
  still report usage.

### MED-3 — Unguarded `res.json()` on the success path mislabels internal/gateway failures as provider refusals

- **Evidence.** `deepseek.server.ts:399` `const parsed = (await res.json()) as DeepSeekChatBody;` inside
  the outer `try`; the catch at `:446-458` returns `code: classifyError(err, "RT_E_LLM_REJECTED")` with
  `error: "DeepSeek request failed: Unexpected token '<'…"`. Contrast the deliberate fixes/153 hardening
  of the *error* path (`:239-266`), which reads text once and keeps a bounded raw excerpt.
- **Blast radius.** Callers branch on the code: `RT_E_LLM_REJECTED` ⇒ "do not retry blindly; check
  key/balance/parameters" (`errors.ts:274-278`). A proxy interstitial page therefore produces the wrong
  remediation, with no excerpt of the offending body and no retry (a gateway blip is exactly the
  transient case `RETRYABLE_STATUS` was built for — it arrives as HTTP 200).
- **Fix (proposed).** `[P]` `const raw = await res.text()`, parse inside its own try/except, on failure
  return `{ ok:false, reason:"error", code:"RT_E_INTERNAL", error: `DeepSeek returned a non-JSON body
  (HTTP ${res.status}): ${excerpt}` }` (and make `parseJsonBody` a shared provider helper).

### MED-4 — `doctor` is key-presence only and advertises model ids the vendor no longer lists

- **Evidence.** `headless.ts:2636-2646`: `llm.configured = isDeepSeekConfigured(); llm.label =
  \`deepseek (${DEEPSEEK_MODEL_IDS.slice(0,2).join(" | ")})\``. No HTTP. `DEEPSEEK_MODEL_IDS`
  (`deepseek.server.ts:32-36`) = `["deepseek-v4-flash","deepseek-v4-pro","deepseek-v4-flash-vision-exp"]`;
  the live vendor list today is `["deepseek-flash","deepseek-v4-pro"]` (§1.5).
- **Blast radius.** `scripts/README-cli.md` §Doctor tells agents to "run this first when a keyed verb
  exits 3, to confirm *why*" — an invalid/rotated key or a dead base URL reports `configured:true`.
  The `llm` label also publishes a model id (`deepseek-v4-flash`) and a third model
  (`…-vision-exp`) that `/models` does not return — a drifted user-visible claim (P0-04).
- **Fix (proposed).** `[P]` Keep `configured`/`label` byte-compatible, add
  `llm.providers: [{ id, configured, reachable, status, models, detail, ms }]` populated by
  `provider.probe()` (§4.6), and replace the hardcoded `MODEL_IDS` label with ids read back from the
  probe (falling back to the configured model when the probe is unreachable, labeled as such).

### MED-5 — Twelve hardcoded model-id literals across eight files; the `LlmModel` union blocks every other provider

- **Evidence (non-test, `grep -rn '"deepseek-v4-\|deepseek-flash' src/lib scripts | grep -v '.test.'`).**
  `llm.ts:16` `export type LlmModel = "deepseek-v4-flash" | "deepseek-v4-pro";` ·
  `algo-tools.ts:120,238` · `chat.server.ts:562` · `llm-tasks.ts:119,144,168` (`"deepseek-v4-pro"`) ·
  `vector.ts:856` · `verify.server.ts:639,655,683,814` · `dod.ts:727` · `deepseek.server.ts:27,32-35`
  (constants) — plus route/prose literals at `engine.ts:1853/1863/2828-2829/3039-3041`,
  `headless.ts:276-278`, `codegen.server.ts:131-132,1169`, `types.ts:21`, `phases.ts:89`.
- **Blast radius.** A vendor rename/retirement is an N-site edit with no compiler help outside the union
  (the constants are bypassed by the literals); and `LlmModel` being a DeepSeek-id union means *no*
  second provider can be threaded through `complete()`/`crew`/`planning` types without widening it.
- **Fix (proposed).** `[P]` Introduce tier vocabulary `type ProviderTier = "flash" | "pro"` and
  `type ModelRef = string` (opaque, provider-resolved); keep the legacy literal branches for
  back-compat: `"deepseek-v4-flash" | "deepseek-flash" ⇒ tier flash`. Migrate the literals to
  `DEEPSEEK_MODELS.flash` / tier names in the same wave (mechanical, 12 sites), then flip
  `DEEPSEEK_MODELS.flash` to the canonical `"deepseek-flash"` with `"deepseek-v4-flash"` retained in an
  accepted-alias set (live-verified: both 200, both served as `deepseek-flash`).

### LOW-6 — `RETRYABLE_STATUS` misses 408/502/504; `Retry-After` is ignored

- `deepseek.server.ts:57` `new Set([429,500,503])`. 502/504 (gateway) and 408 are the classic transient
  HTTP failures behind proxies. DeepSeek documents no `Retry-After` guarantee (`research/deepseek-api.md`
  §6), so honoring it when present is a free win. `[P]` Add `{408,502,504}` and prefer
  `Retry-After` when parseable.

### LOW-7 — Backoff sleep is not abort-aware

- `deepseek.server.ts:204` `await deps.sleep(jitteredBackoffDelayMs(attempt, deps.random))` ignores the
  caller's signal; with `RETRY_MAX_JITTER_MS=8000` an aborted call can still sit up to ~8 s before the
  next (already-aborted) fetch rejects. `[P]` Race the sleep against the signal.

### LOW-8 — Served-model and cache-aware usage fields are dropped on the floor

- `:420-435` maps only `prompt_tokens`/`completion_tokens`; the live body also carries
  `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` / `usage.prompt_tokens_details.cached_tokens`
  (§1.5). Cache-hit tokens are discounted, so any future cost figure computed without them **overstates**
  spend (the honest-direction error, but still wrong). `[P]` Extend `LlmResult.usage` additively:
  `{ promptTokens, completionTokens, cachedPromptTokens?, servedModel? }`.

### CRITICAL-9 (risk, not yet a defect) — Provider work silently violates two published claims if landed naively

- **Evidence.** `dod.ts:727-729` and `phases.ts:89` (§1.4) assert "no Ollama, no failover routes" and
  "deepseek-* are the only configured routes". `types.ts:15-21` + `engine.ts:1844-1865` currently
  **collapse** the legacy `"grok-4.5" | "local-edge" | "failover"` labels to `"deterministic"`.
  `packet.ts:106` publishes `model_route` to every downstream agent.
- **Failure modes if the adapter lands without the migration.** (a) A Grok/OpenAI/Anthropic/Ollama run
  stamps `modelRoute:"deepseek-flash"` (`engine.ts:3039-3041`, `headless.ts:276-278`) — a false provenance
  in the paper trail; (b) a real failover run stamps a DeepSeek route — the exact architecture the repo
  says was never implemented, now falsely un-retired; (c) if the union isn't widened, a persisted
  provider label hydrates to `"deterministic"` on reload (`engine.ts:2258-2259`) — real LLM work
  reported as "no LLM ever ran".
- **Fix (proposed).** `[P]` Land the provenance migration **in the same wave** as the adapter:
  widen `ModelRoute` additively (`"deepseek-flash" | "deepseek-pro" | "grok" | "openai" | "anthropic" |
  "openrouter" | "ollama-local" | "deterministic" | "none"`, plus a separate `failoverFrom?: ModelRoute[]`
  field rather than a `"failover"` route value — a failover is a *path*, not a model), extend
  `hydrateModelRoute` to read the new labels honestly (unknown → `"deterministic"`, never guessed),
  update `dod.ts:715-729` + `phases.ts:89` in the same commit, and keep the legacy collapse for the
  three retired strings so old project files hydrate identically.

---

## 4. Design — a production multi-provider adapter

### 4.1 Non-negotiable invariants (all pre-existing repo law)

1. **Keyless floor** — resolved provider (and every failover candidate) lacks a usable key ⇒ return the
   *exact* legacy envelope `{ ok:false, reason:"not-configured", code:"RT_E_LLM_NOT_CONFIGURED" }`
   (`deepseek.server.ts:291-294`); never fabricate text, never substitute another provider silently.
2. **Server-only secrets** — keys read via `process.env` inside `*.server.ts` only; never
   `import.meta.env`, never `VITE_*`; no `node:fs` in client-safe modules; callers reach the client via
   dynamic `import()` seams (AGENTS.md:93-95).
3. **Honesty of provenance** — the route label records the provider that actually served, read back from
   the response where available; failover is disclosed, never laundered.
4. **Stable result contract** — `LlmResult` (llm.ts:18-32) keeps its discriminant; new fields are
   additive only. `components`/engine/store code must not need a rewrite.
5. **Every failure carries an RT_E code** and the provider's own words (bounded excerpt), per
   `errors.ts` + fixes/153.
6. **Default path byte-identical** — with no `RAPIDTOOL_PROVIDER*`/`<P>_*` env set, DeepSeek-only
   behavior, message strings, retry schedule, timeouts, and `DEEPSEEK_MODELS` resolution are unchanged
   (the 21 tests in `deepseek.server.test.ts` must pass untouched).

### 4.2 The interface (exact TypeScript)

`src/lib/provider-types.ts` — **pure, client-safe** (types + tiny pure helpers only; importable by
`llm.ts`, `llm-tasks.ts`, `crew.ts`, `planning.ts`):

```ts
// --- identity ---------------------------------------------------------------
export type ProviderId =
  | "deepseek" | "xai" | "openai" | "anthropic" | "openrouter" | "ollama";

/** Repo-native tier vocabulary (replaces the DeepSeek-id union as the call contract). */
export type ProviderTier = "flash" | "pro";

/** Opaque model reference: a tier name ("flash"|"pro") or a provider model id. */
export type ModelRef = string;

/** A prior chat turn. Deliberately user/assistant-only (mirrors deepseek.server.ts:163). */
export type LlmTurn = { role: "user" | "assistant"; content: string };

// --- request ----------------------------------------------------------------
export type CompleteRequest = {
  /** Final user turn (required, non-empty — validated before any network I/O). */
  prompt: string;
  /** System instructions. Placement is provider-specific (see PROVIDER_CAPS). */
  system?: string;
  /** Prior turns, appended between `system` and `prompt` (cap 6 × 4000 chars, as today). */
  history?: LlmTurn[];
  /** Tier name or provider model id. Omitted ⇒ provider default tier (flash). */
  model?: ModelRef;
  /** Ask for a JSON object envelope (mechanism is provider-specific). */
  json?: boolean;
  /** Reasoning toggle. Only providers that HAVE a thinking knob act on it. */
  thinking?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
  /** Additive: which provider to use for THIS call (overrides env). */
  provider?: ProviderId;
  /** Additive: caller cancellation (composed with the internal timeout signal). */
  signal?: AbortSignal;
  /** Additive: shared spend accounting (ledger is mutated in place by the router). */
  accounting?: { ledger: TokenLedger; cap?: number };
};

// --- telemetry --------------------------------------------------------------
export type AttemptOutcome =
  | "ok" | "http_error" | "network_error" | "timeout" | "invalid_response" | "not_configured";

export type ProviderAttempt = {
  provider: ProviderId;
  model: string;              // id SENT
  servedModel?: string;       // id the provider SAID it served (read back)
  outcome: AttemptOutcome;
  httpStatus?: number;
  attempts: number;           // in-provider retries used (1 = first try)
  ms: number;
  code?: ErrorCode;           // RT_E_* when outcome !== "ok"
  usage?: LlmUsage;
};

export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  cachedPromptTokens?: number;   // DeepSeek cache hits / Anthropic cache reads
  reasoningTokens?: number;
};

export type LlmCallTelemetry = {
  provider: ProviderId;          // the provider that produced the final result
  servedModel?: string;
  attempts: ProviderAttempt[];   // ordered, every provider touched
  failoverFrom?: ProviderId[];   // honesty trail; absent when no failover happened
};

export type RoutedLlmResult = LlmResult & { telemetry?: LlmCallTelemetry };

// --- probe ------------------------------------------------------------------
export type ProviderProbe = {
  provider: ProviderId;
  configured: boolean;            // key present / provider is keyless-by-design
  reachable: boolean;             // transport OK
  authenticated: boolean;         // provider accepted the credential
  status: number | null;          // HTTP status of the probe call
  models?: string[];              // ids read back from the provider
  detail: string;                 // one honest line for `doctor`
  ms: number;
};

// --- the adapter ------------------------------------------------------------
export type ProviderDeps = {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  env: NodeJS.ProcessEnv;
};

/** Capability flags — the ONE place body-shape differences are declared. */
export type ProviderCaps = {
  /** "messages" (OpenAI-shaped) or "top-level-system" (Anthropic). */
  systemPlacement: "messages" | "top-level-system";
  /** How a JSON envelope is requested. */
  jsonMode: "response_format" | "native-format" | "prompt-only";
  /** Provider-level thinking knob, if any. */
  thinkingKnob: "deepseek-thinking" | "reasoning-effort" | "anthropic-budget" | "ollama-think" | null;
  /** max-output field name. */
  maxTokensField: "max_tokens" | "max_completion_tokens" | "num_predict";
  /** Body keys this provider MUST NEVER receive (never spread a shared opts). */
  forbiddenBodyKeys: readonly string[];
  /** Error-body reader: where the provider hides its human message. */
  errorShape: "openai" | "anthropic" | "xai-flat";
  streaming: "sse-data-done" | "sse-events" | "ndjson" | "none";
  toolRole: boolean;               // accepts role:"tool"
  vision: boolean;                 // accepts image content parts
};

export interface LlmProvider {
  readonly id: ProviderId;
  readonly caps: ProviderCaps;
  /** Key env var; null for keyless-by-design providers (ollama). */
  readonly apiKeyEnv: string | null;
  /** Prefix for BASE_URL / MODEL_* / TIMEOUT_MS env overrides (e.g. "DEEPSEEK"). */
  readonly envPrefix: string;
  readonly defaultBaseUrl: string;

  /** Truthful readiness: usable key present (keyless provider: policy-enabled). */
  isConfigured(env?: NodeJS.ProcessEnv): boolean;
  /** Base URL: `<PREFIX>_BASE_URL` → default. Trailing slashs normalized. */
  resolveBaseUrl(env?: NodeJS.ProcessEnv): string;
  /** Tier/model → provider model id: `<PREFIX>_MODEL_FLASH|_PRO` → tier table → passthrough. */
  resolveModel(model: ModelRef | undefined, env?: NodeJS.ProcessEnv): string;
  /** ONE request, NO retry, NO failover. Returns a typed attempt (never throws for HTTP). */
  complete(req: CompleteRequest, deps: ProviderDeps): Promise<
    { ok: true; text: string; servedModel?: string; usage?: LlmUsage }
    | { ok: false; outcome: Exclude<AttemptOutcome, "ok">; code: ErrorCode; error: string; httpStatus?: number }
  >;
  /** Cheap authenticated probe for `doctor` (GET models / 1-token call / /api/tags). */
  probe(deps: ProviderDeps, opts?: { timeoutMs?: number }): Promise<ProviderProbe>;
}

// --- the router (implemented in provider.server.ts, re-exported for callers) --
export type RetryPolicy = {
  maxAttempts: number;                    // default 3 (today's MAX_ATTEMPTS)
  retryableStatuses: ReadonlySet<number>; // default {408,429,500,502,503,504}
  baseMs: number;                         // 500
  maxJitterMs: number;                    // 8000
};

export type FailoverPolicy = {
  /** Try the next configured provider ONLY for these outcomes. */
  on: ReadonlySet<AttemptOutcome | "provider_exhausted">; // default: network_error, timeout, http_error(429/5xx)
  /** Max providers touched per call (default 2: primary + 1 fallback). */
  maxProviders: number;
  /** Never fail over on 400/401/402/403/404/413/422 — a bad request is bad everywhere. */
  terminalStatuses: ReadonlySet<number>;
};
```

**Adoption cost for existing callers = one line, zero signature change.** The compat shim stays in
`deepseek.server.ts`:

```ts
// signature and options shape UNCHANGED (still includes fetch/sleep/random injection)
export async function completeDeepSeek(
  prompt: string,
  opts: DeepSeekCompleteOptions = {},
): Promise<LlmResult> {
  // 1. legacy resolution unchanged: opts.model ?? DEEPSEEK_MODELS.flash, tier defaults
  // 2. delegate the single request to the "deepseek" adapter; router adds retry+failover
  //    ONLY when RAPIDTOOL_PROVIDER/_FALLBACK are set — otherwise byte-identical path
  return completeViaRouter({ ...toRequest(prompt, opts) }, legacyDeps());
}
```

That is why the audit recommends **not** renaming anything: `prompt-engine.ts:230`,
`codegen.server.ts:1018`, `verify.server.ts:639`, `chat.server.ts:560`, `harvest.ts:230`,
`algo-tools.ts:119/237`, `vector.ts:855`, `headless.ts:222`, `engine.ts` and the 21 tests keep working
verbatim; the *new* capability is additive and env-gated.

### 4.3 Per-provider request/response mapping

Notation: `<base>` = `<PREFIX>_BASE_URL` else the default. **[V]** = live-verified on this host today;
**[U]** = unverified, must be smoke-tested before shipping.

#### (1) DeepSeek — `deepseek` · `DEEPSEEK_API_KEY` · default `https://api.deepseek.com`

| Aspect | Mapping |
|---|---|
| Auth header | `authorization: Bearer <key>` (today: `deepseek.server.ts:379`) **[V]** |
| Endpoint | `POST <base>/chat/completions` (a `/v1` alias is tolerated — `research/deepseek-api.md` §3) **[V/C]** |
| System placement | `messages: [{role:"system"…}, …]`; JSON mode **appends a second system turn** (`:315-322`) **[V]** |
| JSON mode | `response_format: {type:"json_object"}` **and** an explicit "respond with JSON only" system turn (docs requirement — whitespace-loop failure otherwise) **[V]** |
| Streaming | `stream:false` today; if enabled: SSE, `choices[0].delta.content`, `data:[DONE]`, usage on last chunk (`research/deepseek-api.md` §7) **[V-docs]** |
| Max output | `max_tokens` (reasoning tokens **count against it**) **[V]** |
| Thinking | `thinking:{type:"enabled"\|"disabled"}` + `reasoning_effort:"low"\|"high"\|"max"`; answer at `message.content`, CoT at `message.reasoning_content` (never echo it back, never surface it as the answer) **[V]** |
| Model ids (today) | flash **`deepseek-flash`** (canonical; `deepseek-v4-flash` is an accepted alias served as `deepseek-flash`), pro **`deepseek-v4-pro`**; **never** `deepseek-chat`/`deepseek-reasoner` (silently downgrade to flash), never a `v4.1` id (400) **[V]** |
| Usage | `usage.prompt_tokens`, `usage.completion_tokens`, `usage.prompt_cache_hit_tokens`, `usage.completion_tokens_details.reasoning_tokens` **[V]** |
| Errors | `{error:{message}}`; 401 auth · 402 balance · 422 params · 429 rate · 500/503 transient (`:267-284`) **[V]** |
| Key probe | `GET <base>/models` → 200 + exactly `[deepseek-flash, deepseek-v4-pro]`; 401 ⇒ invalid key **[V]** |
| Forbidden keys | none (this is the native dialect) |

#### (2) xAI Grok — `xai` · `XAI_API_KEY` · default `https://api.x.ai/v1`

| Aspect | Mapping |
|---|---|
| Auth header | `authorization: Bearer <key>` **[U]** (standard for the OpenAI-compatible xAI API; 401 body **[V]** proves the endpoint requires credentials) |
| Endpoint | `POST <base>/chat/completions` (`<base>` already contains `/v1`) **[U]** |
| System placement | `messages[0]` role `system` (OpenAI-shaped) **[U]** |
| JSON mode | `response_format:{type:"json_object"}` where the model supports it, else prompt-only + tolerant parse. **Design: prefer prompt-only + tolerant parse for the reasoning models** — the repo already owns robust parsers (`parseSynthesisEnvelope`, `parseOracleJson`, `parseConstraintList`) **[P/U]** |
| Streaming | OpenAI-style SSE, `data:[DONE]` **[U]** |
| Max output | `max_tokens` (newer reasoning models may require `max_completion_tokens` — capability flag, model-specific) **[U]** |
| Thinking | `reasoning_effort` on reasoning models; **never** send DeepSeek's `thinking:{type:…}` object — an unknown param is a 400 on strict validators **[P]** |
| Model ids | `grok-<n>` family as `XAI_MODEL_FLASH`/`XAI_MODEL_PRO` env (no built-in id is asserted here — **[U]** and must not be invented) |
| Usage | OpenAI-shaped `usage.prompt_tokens/completion_tokens` **[U]** |
| Errors | **Flat** `{"code":"unauthenticated:no-credentials","error":"No credentials presented."}` **[V]** — the `error` value may be a *string*, so the shared reader must accept both string and `{message}` |
| Key probe | `GET <base>/models` → 200 + ids with a key, 401 without **[V]** (401 verified) |
| Forbidden keys | `thinking`, `cache_control`, `anthropic-version` |

#### (3) OpenAI — `openai` · `OPENAI_API_KEY` · default `https://api.openai.com/v1`

| Aspect | Mapping |
|---|---|
| Auth header | `authorization: Bearer <key>` **[V]** (401 body: `{"error":{"message":"Missing bearer authentication in header",…}}`) |
| Endpoint | `POST <base>/chat/completions` **[V]** (path convention; `/v1/models` 401 verified) |
| System placement | `messages[0]` role `system` (reasoning models prefer role `developer` — **[U]**; map `system`→`developer` only when the model family requires it) |
| JSON mode | `response_format:{type:"json_object"}` **requires the literal word "json" in the messages**; `json_schema` for strict output on newer models **[U]**; reasoning models may reject `json_object` entirely ⇒ capability-gate per model |
| Streaming | SSE `data:` + `[DONE]`; usage arrives only with `stream_options:{include_usage:true}` **[U]** |
| Max output | `max_tokens`, **rejected by o-series/GPT-5-class models** ⇒ use `max_completion_tokens` (capability flag) **[U]** |
| Thinking | `reasoning_effort` (`low|medium|high`) on reasoning models; no `thinking` object; `temperature` must stay 1 (or unset) for several reasoning models **[U]** |
| Model ids | `OPENAI_MODEL_FLASH`/`OPENAI_MODEL_PRO` env only — no default id is asserted in this dossier |
| Usage | `usage.prompt_tokens`, `completion_tokens`, `completion_tokens_details.reasoning_tokens`, `prompt_tokens_details.cached_tokens` **[U]** |
| Errors | `{error:{message,type,param,code}}` **[V]**; 401 invalid key, 429 `insufficient_quota` vs `rate_limit_exceeded` must be distinguished (one is terminal, one is retryable) **[U]** |
| Key probe | `GET <base>/models` → 200 + ids with a key, 401 without **[V]** (401 verified) |
| Forbidden keys | `thinking`, `reasoning_content` (never echo), DeepSeek's second system turn is harmless here |

#### (4) Anthropic Messages — `anthropic` · `ANTHROPIC_API_KEY` · default `https://api.anthropic.com/v1`

| Aspect | Mapping |
|---|---|
| Auth header | **`x-api-key: <key>`** (no Bearer) + **`anthropic-version: 2023-06-01`** required — **[V]** 401: `{"type":"error","error":{"type":"authentication_error","message":"x-api-key header is required"}}` |
| Endpoint | `POST <base>/messages` **[V]** |
| System placement | **TOP-LEVEL `system` field, never a message** (Anthropic rejects unknown roles) — the single biggest conversion difference; the DeepSeek JSON-instruction system turn (`:315-322`) must be merged into `system` (or into the user prompt) **[V-API-shape]** |
| Message conversion | roles strictly `user`/`assistant`, **must alternate** (merge consecutive same-role turns; never inject a fake first user turn); `role:"tool"` is invalid — map tool results to `user` content blocks only if/when tools are introduced; content may be a string or a block array **[P]** |
| JSON mode | **none** — no `response_format`. Options: (a) prompt-only instruction + tolerant parse (default: it composes with the repo's parsers), (b) forced tool-use (`tools:[{name:"json",input_schema:…}], tool_choice:{type:"tool",name:"json"}`), (c) assistant prefill `{role:"assistant",content:"{"}` — **prefill is incompatible with extended thinking** (capability matrix) **[P/U]** |
| Streaming | SSE with **named events** (`message_start`, `content_block_delta`, `message_delta`, `message_stop`) and **no `[DONE]` sentinel**; text arrives at `delta.text` on `content_block_delta` **[U]** |
| Max output | **`max_tokens` is REQUIRED** (no server default) — the adapter must always send one (fall back to 4096 pro / 1024 flash when the caller omitted it) **[V-API-shape]** |
| Thinking | `thinking:{type:"enabled",budget_tokens:N}` with `max_tokens > budget_tokens`; `temperature` must be 1/unset; thinking blocks (`content[].type==="thinking"`) must be **filtered out of the text**, never surfaced as the answer **[U]** |
| Model ids | `ANTHROPIC_MODEL_FLASH`/`_PRO` env (e.g. a `claude-*` id) — no id is asserted here |
| Usage | **Renamed fields:** `usage.input_tokens`, `usage.output_tokens`, plus `cache_creation_input_tokens`/`cache_read_input_tokens` — the normalizer maps `input→promptTokens`, `output→completionTokens` **[U]** |
| Response text | `content: [{type:"text",text:"…"}, …]` — join **text** blocks only; `stop_reason:"max_tokens"` is the truncation signal (`finish_reason` does not exist) **[U]** |
| Errors | nested `{type:"error",error:{type,message}}` **[V]**; 429 `rate_limit_error` (retry), 529 `overloaded_error` (retry — **add 529 to the retryable set**), 400 `invalid_request_error` (terminal) |
| Key probe | `GET <base>/models` on recent API versions — **[U]**; fallback: a 1-token `POST /messages` (~<10 tokens) — cheap, always correct |
| Forbidden keys | `thinking`-object (DeepSeek dialect), `response_format`, `reasoning_effort`, `stream_options` |

#### (5) OpenRouter — `openrouter` · `OPENROUTER_API_KEY` · default `https://openrouter.ai/api/v1`

| Aspect | Mapping |
|---|---|
| Auth header | `authorization: Bearer <key>`; optional attribution headers `HTTP-Referer`, `X-Title` **[U]** (endpoint shape **[V]**) |
| Endpoint | `POST <base>/chat/completions`; public catalog at `GET <base>/models` **[V]** (200 unauthenticated — so the catalog is **not** a key probe) |
| System placement | `messages[0]` system (pass-through per upstream model) **[U]** |
| JSON mode | `response_format` **only where the routed upstream model supports it** — an unsupported combination returns an error; safe default = prompt-only + tolerant parse **[U]** |
| Model ids | `"<vendor>/<model>"` slugs (OpenRouter's own namespace) — must **never** reuse DeepSeek ids; `OPENROUTER_MODEL_FLASH/_PRO` env + an explicit `models:[…]` list only if we want OpenRouter's *server-side* fallback |
| Routing controls | `provider:{order:[…], allow_fallbacks:false}` and `models:[…]` — **design decision: set `allow_fallbacks:false` by default** so OUR telemetry is the only failover story (a hidden upstream fallback would falsify `servedModel` honesty) **[P]** |
| Streaming | OpenAI-style SSE `data:[DONE]` **[U]** |
| Max output | `max_tokens` **[U]** |
| Usage | OpenAI-shaped; responses may also carry `usage.cost` (USD) — if present, that is a *measured* cost and should be recorded verbatim rather than priced from a table **[U]** |
| Errors | `{error:{message,code}}` **[V]** (401 body: `{"error":{"message":"No cookie auth credentials found","code":401}}`) |
| Key probe | **`GET <base>/key`** → 200 with key limits/credits, 401 without **[V]** (401 verified; 200 body **[U]**) — the best probe of all six (it also returns the credit balance for honest cost reporting) |
| Forbidden keys | `thinking`-object |

#### (6) Ollama (local) — `ollama` · keyless-by-design · default `http://localhost:11434`

| Aspect | Mapping |
|---|---|
| Availability | **not running on this host** (`/api/version` → HTTP 000 refused) **[V]** — the probe must report that honestly, and the keyless floor must not pretend a local model exists |
| Auth header | none by default. If `OLLAMA_API_KEY` is set (LAN/behind a proxy), send `authorization: Bearer <key>`; never *require* it **[P]** |
| Endpoint | native `POST <base>/api/chat` (streaming by default — **must send `stream:false`** for the non-stream path) **[V-docs]**; OpenAI-compat `POST <base>/v1/chat/completions` exists in the wild but its doc page was 404 on `main` today ⇒ **[U]** |
| System placement | `messages[0]` role `system` in `/api/chat` **[V-docs]** |
| JSON mode | native: `format: "json"` — or a full JSON **schema** for structured output; docs explicitly say to *also* instruct JSON in the prompt **[V-docs]**; OpenAI-compat: `response_format` **[U]** |
| Streaming | **NDJSON** (one JSON object per line, final object has `done:true` + `done_reason` + `prompt_eval_count`/`eval_count`); *not* SSE **[V-docs]** |
| Max output | native `options.num_predict`; OpenAI-compat `max_tokens` **[V-docs/U]** |
| Thinking | `think: true|false` on recent versions (version-gated) **[U]** |
| Usage | native: `prompt_eval_count` / `eval_count` (final object) **[V-docs]** |
| Errors | non-JSON (`{"error":"model 'x' not found"}`) — the reader must tolerate a **plain-string error field** **[V-docs/U]** |
| Key probe | `GET <base>/api/tags` → 200 + local model list (0 models is a *valid* reachable answer) **[V-docs]** |
| Honesty rule | "configured" for Ollama = *reachable AND has ≥1 model*; unreachable ⇒ a distinct honest failure (`RT_E_LLM_NOT_CONFIGURED` is wrong for a keyless provider that simply isn't installed). Proposal: add `RT_E_LLM_UNREACHABLE` to the additive registry (`errors.ts:22-49` + an `ERROR_CODE_DOC` row + the `errors.test.ts` sync) **[P]** |
| Forbidden keys | `thinking`-object, `response_format` (native), `max_tokens` (native), `reasoning_effort`, `budget_tokens`, `anthropic-version` |

### 4.4 Env-var scheme, precedence, keyless floor

```
# primary selection
RAPIDTOOL_PROVIDER=deepseek|xai|openai|anthropic|openrouter|ollama   # default: deepseek (unset ⇒ today's behavior)
RAPIDTOOL_FALLBACK_PROVIDERS=xai,openrouter                          # ordered; default: empty ⇒ no failover
RAPIDTOOL_PROVIDER_AUTODETECT=1                                      # opt-in only (see rule 3)
RAPIDTOOL_LLM_MAX_ATTEMPTS=3                                         # per-provider retry cap (default 3)
RAPIDTOOL_LLM_PROBE_TTL_MS=60000                                     # successful-probe cache TTL
RAPIDTOOL_TOKEN_CAP=<int>                                            # unchanged (token-ledger.ts)

# per provider (PREFIX = DEEPSEEK|XAI|OPENAI|ANTHROPIC|OPENROUTER|OLLAMA)
<PREFIX>_API_KEY=…            # DEEPSEEK_API_KEY exists today; OLLAMA_API_KEY optional
<PREFIX>_BASE_URL=…           # overrides the adapter default
<PREFIX>_MODEL_FLASH=…        # tier → model id
<PREFIX>_MODEL_PRO=…
<PREFIX>_TIMEOUT_MS=…         # per-provider timeout override (tier defaults still apply)
RAPIDTOOL_PRICE_<PREFIX>=<usd_per_1M_in>/<usd_per_1M_out>   # only for cost ESTIMATES
```

**Resolution precedence (deterministic, first match wins):**

1. **Call-level** `opts.provider` — explicit; if that provider is not configured, return the keyless
   floor **for that provider** (never silently substitute).
2. **`RAPIDTOOL_PROVIDER`** — explicit deployment choice.
3. **Auto-detect** — **opt-in only** (`RAPIDTOOL_PROVIDER_AUTODETECT=1`), scanning the fixed order
   `deepseek → xai → openai → anthropic → openrouter → ollama` and taking the first configured entry.
   Rationale: defaulting to auto-detect would change behavior the moment an unrelated key (e.g. an
   `OPENAI_API_KEY` set for tooling) appears in the environment — a silent provider swap, violating
   invariant 6.
4. **Default: `deepseek`** (unset env ⇒ byte-identical today's behavior).

**Model resolution:** `opts.model` (tier name or provider id; legacy DeepSeek ids map to tiers:
`deepseek-v4-flash`/`deepseek-flash` ⇒ `flash`, `deepseek-v4-pro` ⇒ `pro`) → `<PREFIX>_MODEL_<TIER>` →
the adapter's built-in tier table → adapter default. The **served model** is always read back from the
response when the payload carries it (`choices[0].model` here; `response.model` there) and reported in
telemetry — the config is a *request*, the response is the *truth*.

**Keyless-floor rule (honesty contract preserved):**

```
resolved = [primary, ...fallbacks]
usable   = resolved.filter(p => p.isConfigured(env))
if (usable.length === 0)
    return { ok:false, reason:"not-configured", code:"RT_E_LLM_NOT_CONFIGURED" }   // exact legacy shape
```
- Keyless ⇒ the *same envelope bytes* as today for the default path (no `error` field added — two
  consumers compare the shape, `llm.test.ts` / `deepseek.server.test.ts`; and the CLI maps exit 3 on
  `reason === "not-configured"`). When `RAPIDTOOL_PROVIDER` **is** set, the floor MAY add
  `error: "provider <id> is not configured — set <PREFIX>_API_KEY"` (additive field, no consumer break).
- Never fabricate text; never downgrade a requested provider into an available one; never present a
  failover result as the primary provider's.

### 4.5 Failover, retry, backoff, timeouts, accounting

**Layering (one owner per concern — this is the answer to checklist patterns 2/3/4):**

```
completeViaRouter(req)
 └─ resolve chain (primary → fallbacks, capped by maxProviders)
     └─ for each provider:
          ├─ keyless floor check
          ├─ assertWithinBudget(ledger, cap)            // before EVERY attempt — retries cost money
          ├─ provider.complete(req, deps)               // ONE request, no retry, never throws on HTTP
          ├─ account usage (success OR failure-with-usage) via recordSpendWithinCap
          ├─ retry?  transient-only, per RetryPolicy (408,429,500,502,503,504 + network/timeout)
          │           jitteredBackoffDelayMs(attempt)   // reuse deepseek.server.ts:76-85 verbatim
          │           AbortError / timeout ⇒ terminal for THIS provider
          └─ failover? per FailoverPolicy — see the matrix below
```

**Failover matrix (normative):**

| Outcome | Action | Why |
|---|---|---|
| `network_error`, `timeout` | retry ×N, then failover | classic transient; provider may be down |
| `http_error` 429, ≥500 | retry ×N (honor `Retry-After` if parseable), then failover | capacity/overload |
| `http_error` 400/404/413/422 | **terminal — no retry, no failover** | a malformed request is malformed everywhere; failover hides a bug and bills another provider |
| `http_error` 401/403 | **terminal** + surface "config" wording | key problem; failover would mask it (and OpenRouter would happily serve the same request) |
| `http_error` 402 | **terminal** + billing wording | no balance anywhere is solved by moving |
| `invalid_response` (non-JSON 200) | retry ×1, then failover | gateway blip; the MED-3 fix classifies it `RT_E_INTERNAL` |
| `not_configured` | skip provider (zero attempts), continue chain | chain construction already filtered |
| `RT_E_BUDGET_EXHAUSTED` | **terminal, never failover** | the cap is the cap |

**Timeout policy.** Per tier defaults stay (`flash 20 s`, `pro 60 s`, `DEEPSEEK_LONG_TIMEOUT_MS 90 s`
for expansion/crew, `P6_SYNTH_TIMEOUT_MS 240 s` for synthesis); per-provider override
`<PREFIX>_TIMEOUT_MS`; per-call `opts.timeoutMs` wins; the router composes the caller's `signal` with
its own timer and makes the backoff sleep abortable (LOW-7 fix).

**Accounting / cost.**

- Router takes `req.accounting = {ledger, cap}` (additive). `assertWithinBudget` before each attempt,
  `recordSpendWithinCap` after each response, failures included (a 400 after 8 k prompt tokens really
  was billed).
- Extend `LlmUsage` with `cachedPromptTokens` (DeepSeek `prompt_cache_hit_tokens`; Anthropic
  `cache_read_input_tokens`) and `reasoningTokens`.
- **Cost estimates, not cost claims:** a table `PRICES[provider][tier][in|out]` filled only from
  `RAPIDTOOL_PRICE_<PREFIX>` env (default: unknown) ⇒ report `costUsd: null, costSource:"unknown"`
  rather than inventing a price. When a provider returns a *measured* cost (OpenRouter `usage.cost`
  **[U]**), record it with `source:"provider"`. DeepSeek pricing is *not* asserted in this dossier.
- Ledger extension (additive to `token-ledger.ts`): `byProvider: Record<ProviderId, TokenLedger>` +
  `costUsd?: number` — `recordSpend`'s existing semantics (`:82-89`) unchanged.
- Surface: extend the existing `p6.synthesis.attempt` journal detail
  (`codegen.server.ts:1054-1080`) with `provider=<id> model=<sent> served=<read-back>` and add
  `failover=<from>→<to>` when a chain link was crossed; CLI/NDJSON consumers need no schema change
  (detail is a string).

### 4.6 Key validation (real cheap probe) and where it surfaces

| Provider | Probe | Cost | Success criterion | Cache |
|---|---|---|---|---|
| deepseek | `GET <base>/models` **[V]** | free | 200 + id list; read ids back | success only, TTL 60 s |
| xai | `GET <base>/models` **[V]** | free | 200 + id list | success only |
| openai | `GET <base>/models` **[V]** | free | 200 + id list | success only |
| anthropic | `GET <base>/models` **[U]** → fallback `POST <base>/messages` `{max_tokens:1}` **[P]** | ~<10 tokens | 200; 401 ⇒ invalid key | success only |
| openrouter | `GET <base>/key` **[V]** | free | 200 + `{limit, usage, …}` ⇒ balance visibility | success only |
| ollama | `GET <base>/api/tags` **[V-docs]** | free | 200 + model list (≥1 model to be *usable*) | success only |

**Hard rules (checklist pattern 5):** status ≥400 is **never** "reachable"; a failure is **never**
cached; `configured` (credential present) and `reachable`/`authenticated` (probe result) are reported
**separately**; timeout 3 s (matches `probeTavily`'s 3 s cap, `headless.ts:2583-2590`); the probe never
throws (doctor must stay never-throwing — `headless.ts:2630`).

**Where it surfaces.**
1. `doctor` verb — `headless.ts:2636-2646` `doctorStatus`: keep `llm.configured` / `llm.label`
   byte-compatible (README-cli documents them) and **add** `llm.providers[]` from the probe array; the
   label must print ids **read back from the probe** when available.
2. Console capability chips — `crew.ts:162-166` and `crew.server.ts:1393-1395`
   (`crewConfigured()`), `llmStatus()` (`llm.ts:74-83`): add `providers` additively.
3. CLI exit mapping unchanged: unconfigured ⇒ `RT_E_LLM_NOT_CONFIGURED` / exit 3; unreachable-or-auth-failed
   ⇒ `RT_E_LLM_REJECTED` (or the new `RT_E_LLM_UNREACHABLE`) / exit 4.

### 4.7 Exact change list (files / functions / current line anchors)

**New files**

| Path | Content | Client-safety |
|---|---|---|
| `src/lib/provider-types.ts` | types from §4.2 + pure helpers (`resolveTier`, `tierFromLegacyModelId`, `normalizeUsage`) | **pure** — no `process`, no `fetch`, no `node:fs`; importable by `llm.ts`/`llm-tasks.ts`/`crew.ts` |
| `src/lib/provider.server.ts` | six adapters + registry + `completeViaRouter` + retry/failover + `probeAllProviders` + (optional) memoized probe cache | **server-only** — reached only via dynamic `import()` seams, same pattern as `deepseek.server.ts` today |
| `src/lib/provider.server.test.ts` | per-adapter fixture tests (fake `fetch`), failover matrix, keyless floor, probe caching, kwargs whitelisting, Anthropic conversion, error-envelope readers | test-only |
| `src/lib/provider-types.test.ts` | tier/legacy-id resolution matrix | test-only |

**Modified files (anchors current as of HEAD `0e393ba`)**

| File:line | Function / constant | Change |
|---|---|---|
| `src/lib/deepseek.server.ts:23` | `DEEPSEEK_BASE_URL` | keep as the **default**; adapter reads `DEEPSEEK_BASE_URL` env first |
| `:26-29` | `DEEPSEEK_MODELS` | `flash: "deepseek-flash"` (canonical, live-verified) with `deepseek-v4-flash` moved to an accepted-alias set; `pro` unchanged |
| `:32-36` | `DEEPSEEK_MODEL_IDS` | derive from the probe, or reduce to the two live ids; drop/mark the vision id **[U]** |
| `:57` | `RETRYABLE_STATUS` | `{408,429,500,502,503,504}` (+ provider-specific additions, e.g. 529 for Anthropic) |
| `:196-230` | `postWithRetry` | move to `provider.server.ts` as the shared `callWithRetries`; make the backoff sleep abort-aware |
| `:232-285` | `describeError` | generalize to `readErrorDetail(res, shape)` (OpenAI / Anthropic / xai-flat) and reuse |
| `:287-462` | `completeDeepSeek` | keep signature + `fetch/sleep/random/timeoutMs/model/thinking` seams; body delegates to the deepseek adapter through the router |
| `src/lib/llm.ts:16` | `LlmModel` | widen: keep the legacy union members, add `(string & {})`/`ModelRef`, or deprecate in favor of `ModelRef` + tier |
| `:35-40` | server-fn validator | add `thinking?`, `timeoutMs?`, `provider?` (fixes HIGH-1) |
| `:42-50`, `:74-83` | `complete`, `llmStatus` | `complete` unchanged; `llmStatus` adds `providers` |
| `src/lib/llm-tasks.ts:119,144,168` | `extractConstraints`, `interpretFeedback`, `phaseNarrative` | `model: "pro"` (tier) + `thinking: false` on the json paths |
| `src/lib/verify.server.ts:639,655,683,814` | `generateCases`, `verifyAndFixServer` patch prompt | literals → `DEEPSEEK_MODELS.flash`/tier |
| `src/lib/chat.server.ts:562` | copilot turn | literal → tier/`DEEPSEEK_MODELS.flash` |
| `src/lib/algo-tools.ts:120,238` | `specToAlgorithm`, `propertyCases` | same |
| `src/lib/vector.ts:856` | `callDeepSeekJson` | same |
| `src/lib/harvest.ts:230-241` | `defaultQueryLlm` | same; **wire `accounting`** (its own comment, `:237-238`, asks for the parent to do this) |
| `src/lib/prompt-engine.ts:230-240` | `expansionCall` | same; wire `accounting` |
| `src/lib/crew.server.ts:863-885` | `completeCrewTurn` | accept the router result; keep timeout-only retry, wire `accounting`; crew session totals (`:1056-1061`, `:1263`) become provider-aware |
| `src/lib/codegen.server.ts:133` | `P6_SYNTH_MODEL` | derived from `resolveModel("pro")` at call time (not a module-load const) so env overrides apply |
| `:989-1025` | `synthWithBackoff` | pass `accounting` into `complete`; keep timeout-only outer retry |
| `:1054-1080` | `synthAttemptLogEntry` | detail gains `provider=… model=… served=… failover=…` |
| `src/lib/headless.ts:2636-2646` | `doctorStatus` llm block | add the probe array; never throw; keep `configured`/`label` |
| `src/lib/crew.ts:162-166`, `crew.server.ts:1393-1395` | status fns | add `providers` |
| `src/lib/types.ts:21` | `ModelRoute` | widen additively (§CRITICAL-9) + optional `failoverFrom` |
| `src/lib/engine.ts:1844-1865` | `hydrateModelRoute` | accept the new labels; keep the legacy collapse; never guess |
| `engine.ts:2826-2835`, `3036-3041`; `headless.ts:276-284` | route stamping | derive the route from `telemetry.provider` |
| `src/lib/packet.ts:106` | `model_route` | no change to the key; value vocabulary widens with `ModelRoute` |
| `src/lib/dod.ts:715-729` | outbound + model claims | **strike/update text** in the same wave (P0-04) |
| `src/lib/phases.ts:89` | P10 summary | strike "no Ollama/local-edge handoff" (or re-scope it to "Ollama is an opt-in local provider") |
| `src/lib/token-ledger.ts:45-49,82-89` | `TokenLedger`, `recordSpend` | additive `byProvider`, `costUsd` |
| `.env.example` | key slots | add the five new `*_API_KEY` slots (currently `DEEPSEEK_API_KEY` + `TAVILY_API_KEY` only) **[V]** |
| `scripts/README-cli.md` §Doctor, §Error codes | docs | document `llm.providers`, the probe semantics, and any new code |
| `research/deepseek-api.md` §2/§9 | live-verified spec | re-verify note: `/models` now returns 2 ids; the flash alias serves as `deepseek-flash` |

**Explicitly NOT to touch** (legacy Grok *platform* scaffolding, out of scope per AGENTS.md:107-112):
`src/lib/auth/*`, `src/lib/app-data/*`, `src/components/preview-host-bridge.tsx`, `server/`,
`scripts/grok-pwa-*`, `AGENTS.project.md`, `startup.sh`. The only reason they appeared in the provider
grep is the substring "grok" — they are auth/connector code, not LLM clients.

### 4.8 Phased landing plan (recommended wave split)

| Wave | Scope | Gate |
|---|---|---|
| W1 (design-only, no behavior) | `provider-types.ts` + `provider-types.test.ts`; `LlmProvider` interface + caps tables; no call-site changes | typecheck/lint/suite green; zero runtime diff |
| W2 (single-provider router, env-gated) | `provider.server.ts` with the **deepseek** adapter only; `completeDeepSeek` delegates; retry/probe/telemetry live; **no new env set ⇒ byte-identical** | `deepseek.server.test.ts` (21) + `llm.test.ts` unchanged and green; new router tests green |
| W3 (provenance migration) | `ModelRoute` widening + `hydrateModelRoute` + route stamping + `dod.ts`/`phases.ts` claims + packet fixture updates | all four gates; packet snapshot diffs reviewed by hand |
| W4 (adapters) | xai, openai, anthropic, openrouter, ollama adapters + probes + `doctor` surface, one PR each with its own fixture suite | per-adapter tests; `doctor` manual run per provider |
| W5 (accounting + failover) | `accounting` wiring across all call sites; `assertWithinBudget` pre-attempt; failover chain + telemetry; cost table (env-only) | budget-exhaustion test; failover matrix test |

### 4.9 Test plan (what must be pinned)

1. **Byte-compat:** with no new env vars, the exact outbound body for a fixed call (snapshot test) and
   the exact retry schedule via injected `sleep`/`random` (already done in `deepseek.server.test.ts:94-230`).
2. **Kwarg whitelisting:** for each adapter, assert the serialized body contains **no** forbidden key
   (`thinking` on openai/anthropic/openrouter/xai/ollama-native; `response_format` on anthropic-native).
3. **Anthropic conversion:** system goes top-level and **never** into `messages`; consecutive same-role
   turns merged; no synthetic user turn; `tool` role never emitted; thinking blocks filtered from text.
4. **Error readers:** one fixture per envelope shape — OpenAI nested, Anthropic nested+`type`, xAI flat
   `{code,error:string}`, Ollama plain `{error:"…"}` — asserting the message survives into `error`.
5. **Non-JSON 200** ⇒ `RT_E_INTERNAL` with a bounded excerpt (MED-3 regression test).
6. **Keyless floor:** each provider unconfigured ⇒ exact legacy envelope; requested-but-unconfigured
   provider ⇒ floor, **not** substitution.
7. **Probe discipline:** 401 ⇒ `authenticated:false, reachable:true`; a failed probe is **not** cached;
   a successful probe is cached for the TTL; probe never throws.
8. **Failover matrix:** 401/400/422/402 ⇒ no failover; 429-after-retries/5xx/timeout/network ⇒ failover
   once, `failoverFrom` populated, `servedModel` read back from the *second* provider.
9. **Budget:** `assertWithinBudget` stops the chain pre-attempt; usage on a failed-but-billed response is
   recorded; `RT_E_BUDGET_EXHAUSTED` never triggers failover.
10. **Doctor:** snapshot of the `llm` block with `providers[]` for (a) no keys, (b) key present + probe
    401, (c) key present + probe 200.

---

## 5. UNVERIFIED / open questions (do not treat as fact)

1. **[U]** xAI/OpenAI/Anthropic/OpenRouter *chat* request/response bodies — I verified only endpoint
   existence, auth requirement, and the unauthenticated error envelopes (§1.6). No key for those
   providers exists in this repo's `.env` (`DEEPSEEK_API_KEY`, `TAVILY_API_KEY` only **[V]**), so every
   `[U]` row in §4.3 must be smoke-tested with a real key before landing.
2. **[U]** Anthropic `GET /v1/models` availability on the pinned API version; fallback probe is a
   1-token `POST /messages`.
3. **[U]** Ollama's OpenAI-compat path (`/v1/chat/completions`) — the docs page 404'd today; also
   unverified: `think` support/version gating, and whether `num_predict` is mirrored as `max_tokens` on
   the compat path. Ollama is not installed on this host (**[V]** refused).
4. **[U]** OpenRouter `usage.cost` presence/units, and the exact 200 body of `GET /api/v1/key`.
5. **[U]** Any USD price for any provider (deliberately not asserted; the design prices only from env).
6. **[U]** DeepSeek `deepseek-v4.1-*` ids (parent-reported rejection) and the alias list beyond
   `deepseek-v4-flash` — the adapter must never hardcode either.
7. **[U]** Whether `LlmResult` shape strictness in `llm.test.ts`/`deepseek.server.test.ts` tolerates an
   added `error` field on the keyless envelope — verify before adding it (invariant 6).

---

## 6. Highest-risk item (single)

**The persisted route-honesty coupling — CRITICAL-9.** `modelRoute` is written into the project file,
published in the Agent Packet (`packet.ts:106`), and asserted by a DoD claim that is *false the moment
a second provider exists*: `dod.ts:729` "No grok-4.5, no Ollama, no failover routes." A naive adapter
landing therefore has exactly three ways to corrupt the paper trail — stamp a false `deepseek-*` route
on non-DeepSeek runs (`engine.ts:3039-3041`, `headless.ts:276-284`), hydrate a real provider label to
`"deterministic"` on reload (`engine.ts:1844-1865`), or un-retire the `"failover"` label without a
truthful provenance model — and two published claims (`dod.ts:729`, `phases.ts:89`) that must be
struck in the same commit under P0-04. Mitigation is designed in §CRITICAL-9/§4.8-W3: provider labels
as first-class `ModelRoute` members, failover as a `failoverFrom[]` *path* field, legacy labels
hydrating exactly as they do today.

---

## Appendix A — raw evidence transcripts

```
# provider-surface census (substring hits only; all are platform scaffolding or advice-table labels)
$ cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -rniE "OPENAI_API_KEY|XAI_API_KEY|ANTHROPIC_API_KEY|OPENROUTER_API_KEY|OLLAMA|GROK" src scripts
src/components/preview-host-bridge.tsx:2  … Grok preview chrome …            (legacy platform chrome)
src/lib/algorithms.ts:1061                … grok / deepseek model families   (tokenizer comment)
src/lib/algorithms.ts:1169                { name: "Ollama", role: "Edge draft/format loops" }  (advice table)
src/lib/app-data/*, src/lib/auth/*        GROK_CONNECTORS_URL / GROK_PROVIDER_* / grok.me hosts  (legacy auth+connector)

# streaming / concurrency census
$ grep -rniE "text/event-stream|stream: true|aiter|reader\.read\(\)" src/lib/*.ts scripts/*.mjs   → 0 hits
$ grep -rn "in_flight|inFlight|semaphore|MAX_CONCURRENT" src/lib/*.ts → only bench.ts:495-519 (unrelated phase counter)

# model-id literals (non-test)
$ grep -rn '"deepseek-v4-\|deepseek-flash' src/lib/*.ts scripts/*.mjs | grep -v '\.test\.' | grep -v '^src/lib/deepseek.server.ts'
llm.ts:16 · algo-tools.ts:120,238 · chat.server.ts:562 · codegen.server.ts:8,31,127,1169 · dod.ts:727 ·
engine.ts:1741,1853,1863,2706,2828,2829,3039,3041 · headless.ts:277,278 · llm-tasks.ts:119,144,168 ·
phases.ts:89 · types.ts:21 · vector.ts:856 · verify.server.ts:639,655,683,814

# ledger wiring census
$ grep -rn "recordSpend|assertWithinBudget|recordSpendWithinCap|tokenCapFromEnv|p6TokenCapFromEnv|RAPIDTOOL_TOKEN_CAP" src/lib/*.ts scripts/*.mjs | grep -v token-ledger.ts | grep -v '\.test\.'
codegen.server.ts:103,962,963,971,995 · doctor.ts:174 · harvest.ts:238 (comment)
```

## Appendix B — live probe transcripts (2026-09-16)

```
GET  https://api.deepseek.com/models   (Bearer, repo .env key)   → 200
  {"object":"list","data":[{"id":"deepseek-flash",…},{"id":"deepseek-v4-pro",…}]}
POST https://api.deepseek.com/chat/completions  {"model":"deepseek-v4-flash", max_tokens:8, thinking:"disabled"}
  → 200 {"model":"deepseek-flash","choices":[{"message":{"content":"OK"},"finish_reason":"stop"}],
          "usage":{"prompt_tokens":6,"completion_tokens":1,"prompt_cache_hit_tokens":0,…},"system_fingerprint":"aeb56401…"}
POST https://api.deepseek.com/chat/completions  {"model":"deepseek-flash", …}   → 200, "model":"deepseek-flash"
GET  https://api.x.ai/v1/models                       → 401 {"code":"unauthenticated:no-credentials","error":"No credentials presented."}
POST https://api.anthropic.com/v1/messages            → 401 {"type":"error","error":{"type":"authentication_error","message":"x-api-key header is required"},"request_id":"req_011Cf7uxp6vAjFhxiN7bqi2N"}
GET  https://openrouter.ai/api/v1/models              → 200 (public catalog)
GET  https://openrouter.ai/api/v1/key                 → 401 {"error":{"message":"No cookie auth credentials found","code":401}}
GET  https://api.openai.com/v1/models                 → 401 {"error":{"message":"Missing bearer authentication in header","type":"invalid_request_error","param":null,"code":null}}
GET  http://localhost:11434/api/version               → HTTP 000 (connection refused — Ollama not installed)
GET  raw.githubusercontent.com/ollama/ollama/main/docs/api.md → 200 (POST /api/chat, stream default, format:"json", num_predict)
GET  raw.githubusercontent.com/ollama/ollama/main/docs/openai.md → 404
```

## Appendix C — read-before-acting sources

`AGENTS.md` (honesty contract §71-89, layout, quirks) · `src/lib/errors.ts` (RT_E registry,
`ERROR_CODE_DOC`) · `scripts/README-cli.md` (§Doctor, §Error codes taxonomy, exit 0/1/2/3/4) ·
`research/deepseek-api.md` (2026-09-05 live-verified DeepSeek spec — §2 ids now stale) ·
`src/lib/deepseek.server.ts` / `llm.ts` / `llm-tasks.ts` / `token-ledger.ts` / `codegen.server.ts` /
`prompt-engine.ts` / `verify.server.ts` / `chat.server.ts` / `crew.server.ts` / `harvest.ts` /
`algo-tools.ts` / `vector.ts` / `planning.ts` / `headless.ts` / `engine.ts` / `types.ts` / `packet.ts` /
`dod.ts` / `phases.ts` / `deepseek.server.test.ts`.
