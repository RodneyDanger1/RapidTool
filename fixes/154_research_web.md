# fixes/154_research_web.md — RESEARCHER-W web dossier: empty-content thinking models, eval honesty, bounded refusal, DeepSeek v4-pro

Wave 154 · Researcher W · 2026-09-08 · **analysis-only pass** (no src/scripts writes; this file is the only write).
Method: `web_search`/`web_extract` were Firecrawl-gated (keyless host), so every source below was fetched directly this pass via curl/urllib with a browser UA — canonical docs, GitHub issue/PR bodies (API), raw GitHub markdown, arXiv abstracts, HF API. Every URL in the Source index was fetched and read this pass. No source cited from memory or from search snippets alone.

Repo context read at wave start (may drift while fixers F1–F4 work): synthesis calls go through `src/lib/deepseek.server.ts` (call builder ~L333 already sends `thinking:{type:"enabled"}, reasoning_effort:"high"` and `response_format:{type:"json_object"}` when `opts.json`, `max_tokens: maxTokens`; ~L378 already detects empty content + reasoning-only + `finish_reason:"length"` — fixes/152-153 work), `src/lib/codegen.server.ts` `liveP6Synthesis` (comment at L32: `maxTokens 32 000 — thinking must not starve content: fixes/153`). Scoring is `src/lib/maker-score.ts` (pure M1..M9 rubric; M1 "substance" via `identifierHits`/`briefNounHits` from `src/lib/sandbox.ts` L236/L251). The danger this dossier addresses: **the deterministic keyless floor is scaffolded from the brief's own nouns, so identifier/coverage checks are satisfiable BY CONSTRUCTION by the floor — if the thinking model returns nothing and the system degrades to the floor, M1..M9 can read green with zero LLM-produced content.**

---

## BOTTOM LINE (read this first)

- **The empty-`content` failure is a documented, cross-vendor token-budget mechanism, not a mystery.** OpenAI, Anthropic and the OpenAI-compatible ecosystem all count reasoning tokens against one shared output budget; when thinking consumes it all you get `finish_reason:"length"` (or OpenAI `status:"incomplete"`, `reason:"max_output_tokens"`) **with zero visible output** — "you could incur costs for input and reasoning tokens without receiving a visible response" (OpenAI [S7]). DeepSeek additionally acknowledges JSON-mode empty content in its own docs [S1], and the ecosystem reports DeepSeek v4-flash/v4-pro returning `content:""` with everything in `reasoning_content` [S11][S10][S12].
- **Two distinct traps, two different fixes.** (a) *Budget starvation* → fix by raising/separating the budget or dropping thinking for structured envelopes; (b) *payload in the wrong field* (`reasoning_content` carries the answer/JSON) → fix by reading `content || reasoning_content` and by **not** treating empty content as failure before checking `tool_calls`, `finish_reason`, and `usage` — tool-call turns legitimately return `content:""` [S2][S16].
- **Eval honesty against a by-construction floor is solved the same way every serious benchmark solves it: the success criteria must not be derivable from the brief.** SWE-bench withholds the tests and applies them itself; the model's patch can never touch them [S18][S19][S20]. RapidTool's analogue: score **provenance-gated evidence** (which files were produced by a real, logged, non-empty LLM synthesis) and diff emitted artifacts against the floor — never let brief-derived identifier checks alone carry M1.
- **Refusal/degradation must be loud and bounded: circuit-breaker semantics (bounded retries → trip → degrade-with-banner), every trip stamped into the audit trail and the scorecard.** The published failure modes are all *silent* ones (goose [S10], hermes-agent [S13][S14], SkillClaw blind re-issue doubling cost [S11]) — a scorecard that cannot distinguish baseline-green from product-green is precisely the silent failure class the industry keeps getting bitten by.

---

## Q1 — Why a thinking-enabled LLM API returns `content:""` while `reasoning_content` is populated (mechanisms + field fixes)

### Q1.1 Mechanism A — one shared token budget: reasoning starves the answer (the dominant cause)

All major providers budget reasoning and visible output from **one pool**, so long thinking can exhaust it before a single answer token is emitted:

- **OpenAI (docs, fetched)**: "reasoning tokens ... are billed as output tokens"; "you can limit the total number of tokens the model generates, including reasoning tokens, visible output tokens, and non-visible formatting tokens, by using the `max_output_tokens` parameter"; "If the generated tokens reach the context window limit or the `max_output_tokens` value you've set, you'll receive a response with a status of `incomplete` and `incomplete_details` with reason set to `max_output_tokens`. **This might occur before any visible output tokens are produced**, meaning you could incur costs for input and reasoning tokens without receiving a visible response." Official guidance: reserve ≥25,000 tokens for reasoning+outputs; usage exposes `output_tokens_details.reasoning_tokens` [S7].
- **Anthropic (docs, fetched)**: extended thinking `budget_tokens` must be "Less than `max_tokens`" because "**Thinking tokens count toward the `max_tokens` limit for the turn, so the budget must leave room for the final response.**" [S9]
- **OpenAI-compatible ecosystem (llama.cpp/vLLM/Ollama/DeepSeek)**, goose issue #11142 (fetched body): "Goose does not adjust `max_tokens` to account for `reasoning_content` token consumption. The model's thinking tokens count against the same `max_tokens` budget as content tokens. When a reasoning model produces verbose thinking (common with DeepSeek, Nemotron, Qwen3-thinking), the entire budget is consumed by `reasoning_content`, producing **0 content tokens** — the user sees an empty response. **This is a silent failure: no error, no warning, just `finish_reason: "length"` with empty content.**" Reference fix cited there: pi coding agent adjusts `max_tokens` when reasoning is on [S10].
- claude-code-router PR #1596 (fetched body): "Reasoning models (GLM-5.2, DeepSeek-R1, Qwen) may return `content: ""` with all actual output in `reasoning_content`. This happens when `max_tokens` is consumed entirely by the thinking process." Fix: fallback chain `content || reasoning_content || ""` [S12].
- **DeepSeek API reference (fetched)**: `max_tokens` = "The maximum number of tokens that can be generated in the chat completion" (single pool), and explicitly: "the message content may be partially cut off if `finish_reason="length"`" — and in JSON Output mode, "Set the `max_tokens` parameter reasonably to prevent the JSON string from being truncated midway" [S3].

**Signature of this mechanism:** `finish_reason: "length"` (or OpenAI `status:"incomplete"`/`reason:"max_output_tokens"`) + non-trivial `reasoning_content` + empty/short `content`.

### Q1.2 Mechanism B — JSON output mode on DeepSeek can itself return empty content

DeepSeek's official JSON Output guide (fetched) says, verbatim: "**When using the JSON Output feature, the API may occasionally return empty content. We are actively working on optimizing this issue. You can try modifying the prompt to mitigate such problems.**" [S1] — i.e., vendor-known flakiness of `response_format:{type:"json_object"}` plus thinking, with no `max_tokens` fix promised; prompt change is the vendor suggestion. The API reference adds the two classic JSON-mode footguns: you must include the word "json" in the prompt or the model "may generate an unending stream of whitespace until the generation reaches the token limit, resulting in a long-running and seemingly 'stuck' request" [S3]. So on DeepSeek, **long JSON-mode prompt + thinking enabled** is the exact configuration the vendor flags as occasionally-empty.

### Q1.3 Mechanism C — the whole structured response lands in `reasoning_content`, not `content`

hermes-agent issue #82291 (fetched body): session-title JSON-schema call against a reasoning model (glm-5 via opencode-go) returned `content = ''`, `reasoning_content = '{"title": "..."}'` — "the whole response" in the CoT field. Client read only `content` → permanent silent failure (title stayed `derived`, no retry) [S13]. Same shape as SkillClaw #70 for DeepSeek v4 (Q1.4). **A client that treats `content:""` as failure without looking at `reasoning_content` will discard valid structured output.** (Caveat: `reasoning_content` is *defined* as pre-answer CoT [S2]; when it carries parseable JSON the backend/proxy has misfiled the payload — treat as "salvage if parseable, but fix the route".)

### Q1.4 Mechanism D — proxies/relay layers strip or re-field `content` (DeepSeek v4-specific)

SkillClaw issue #70 (fetched body) — the closest published match to the RapidTool scenario: "When SkillClaw proxies DeepSeek v4 reasoning models (deepseek-v4-flash / deepseek-v4-pro via the opencode.ai / zen/go upstream), the response arrives with `content: ""` and the actual answer stuffed into the non-standard `reasoning_content` field." Reproduction shows a **direct** call works (content populated) while the **same call through the proxy** returns `200 OK`, `message.content: ""`, `message.reasoning_content: "The user wants me to..."`, `finish_reason: "length"`; "Clients that read only `content` ... receive empty output and treat the call as a blank/failed completion"; the client's fallback chain then re-issues the request to a direct provider, "roughly doubling effective latency and cost" [S11]. **Takeaway: reproduce against the direct endpoint before blaming the model** — if direct calls populate `content`, the proxy is the defect.

### Q1.5 Mechanism E — legitimate empty-`content` turns (do NOT flag these as failures)

- Tool-call turns: the DeepSeek Thinking Mode guide's own worked example shows `Turn 2.1 reasoning_content='…' content='' tool_calls=[…]` — an assistant turn that thinks and emits a tool call has **empty content by design** [S2]. Any "empty content ⇒ failed synthesis" check must exclude turns carrying `tool_calls`.
- Empty-string field presence matters: opencode-cc PR #13 (fetched body) documents a *valid* streamed tool-call turn where `delta.reasoning_content` is present-but-empty; serializers that drop the empty field (`omitempty`) cause the *next* DeepSeek request to be rejected (see Q4) [S16].
- Safety refusals are the one case where empty-ish is a genuine product signal: OpenAI Structured Outputs docs make refusals "programmatically detectable" (`message.refusal`) and their canonical edge-case handler checks, in order: `finish_reason === "length"` → throw "Incomplete response"; `refusal` → handle; `content` → use; else → throw "No response content" [S8].

### Q1.6 Fixes the field actually uses

| Fix | What it is | Evidence |
|---|---|---|
| **Raise / split the output budget** | Reserve reasoning headroom: OpenAI recommends ≥25k tokens buffer for reasoning+output; pi coding agent scales `max_tokens` when reasoning is enabled | [S7][S10] |
| **Read `content \|\| reasoning_content`** | Salvage payload misfiled into the CoT field; CCR #1596 ships exactly this fallback | [S12][S13] |
| **Disable thinking for structured envelopes** | DeepSeek supports per-request `thinking:{type:"disabled"}` (+ `reasoning_effort` low/high/max); pure JSON extraction doesn't need CoT; avoids the whole starvation class | [S3][S2] |
| **Two-pass reason→answer** | Let thinking happen on a cheap "plan" call; make the structured call non-thinking with a plan in context | [S7][S3] (pattern implied by per-request effort/thinking toggles) |
| **Check finish_reason/status/usage before declaring failure** | `finish_reason:"length"` + `usage.output_tokens_details.reasoning_tokens` distinguishes "starved" from "empty-for-other-reasons"; OpenAI's code checks `length`, then `refusal`, then content | [S7][S8][S10] |
| **Round-trip `reasoning_content` correctly in tool loops** | Thinking mode requires passing it back when `tools` is present; proxies must not strip it (or even its empty-string presence) | [S15][S17][S16][S2] |
| **Prompt mitigation** | DeepSeek's own suggestion for JSON-mode empty content | [S1] |

### Q1.7 Implication for RapidTool (repo-anchored)

`deepseek.server.ts` already detects the failure shape (~L378: reasoning-only, `finish_reason:"length"` notes; fixes/152-153), and `codegen.server.ts` already budgets 32k so thinking doesn't starve content. What the web evidence adds: **the retry ladder should use the API's own levers** — attempt 1 thinking-high, attempt 2 `thinking:{type:"disabled"}` (or `reasoning_effort:"low"`) for the same JSON envelope, attempt 3 the bounded floor; and empty-content classification must check `tool_calls` (legit) and try `reasoning_content` as a JSON salvage source before declaring the call failed [S12][S13][S11]. Every failed/starved attempt must be *recorded* (see Q3) so the scorer sees refusal counts, not just a floor that happens to satisfy M1.

---

## Q2 — Keeping an eval HONEST when the deterministic baseline satisfies identifier/coverage checks BY CONSTRUCTION

### Q2.1 The problem is benchmark leakage, and the benchmarks already solved it

RapidTool's floor is scaffolded from the brief's nouns, and M1 counts identifier-stem hits via `briefNounHits`/`identifierHits` (`sandbox.ts` L236/L251) — so the floor trivially satisfies "substance". This is exactly the failure mode SWE-bench's design exists to prevent:

- **Withheld success criteria.** SWE-bench tasks give the model issue text + codebase, but the grading tests (FAIL_TO_PASS / PASS_TO_PASS) are never shown to the model; the harness applies them itself in a container. "Resolving issues in SWE-bench frequently requires modifying multiple functions across multiple files... models are evaluated on held-out tests" [S18][S20]. The arXiv abstract: "Given a codebase along with a description of an issue to be resolved, a language model is tasked with editing the codebase to address the issue" — and correctness is judged by tests the model never saw [S20].
- **The solution can't touch the yardstick.** SWE-bench predictions carry only a `model_patch`; the harness owns the `test_patch` and applies it separately — a model that "fixed" the tests would be caught because test files are not part of its patch surface [S19]. This is the precise analogue of "don't let the thing being scored be satisfiable by the thing that defines success".
- **Solvability itself is human-verified.** SWE-bench Verified = 500 instances "real software engineers have confirmed are solvable", evaluated in the containerized harness [S18] — i.e., a floor/trivial baseline can't launder itself through an unverified dataset.
- **Logs are first-class evidence.** The harness writes per-run logs (`--run_id` names the run, "logs will be written to…") [S19]; evaluations are rerunnable artifacts, not vibes.

### Q2.2 What agent platforms actually grade on (beyond hidden tests)

- **OpenHands** (paper, fetched abstract): a platform where agents act "by writing code, interacting with a command line, and browsing the web" — evaluation is over *interactions with a real environment*, judged on artifacts the agent actually produced in a sandbox, not on self-reports [S21]. (Repo note: the All-Hands-AI/OpenHands repo README has since pivoted to the "Agent Canvas" product README — code-level eval docs now live under docs.openhands.dev; the paper remains the canonical methodology cite.)
- **MetaGPT** (paper, fetched abstract): multi-agent with SOPs/executable artifacts, explicitly motivated by reducing "cascading hallucinations caused by naively chaining LLMs" — the design response to LLM-produced garbage reading as progress [S22].
- **Provenance/production-route evidence**: no serious agent eval scores a file as "LLM-produced" without a trace tying that file to a real model invocation — the trace IS the discriminator. (OpenAI exposes per-call `reasoning_tokens` usage so a "thinking happened" claim is checkable [S7]; logs + containerized reruns are the norm [S19][S18].)

### Q2.3 Discriminators RapidTool can adopt (ranked by leverage)

1. **Provenance stamps (strongest, cheapest):** record per-artifact `producer ∈ {llm, floor, hybrid}` + the synthesis call's log id + content length at emit time. A criterion can then require `producer === "llm"` with a **logged non-empty completion** before its identifiers count toward M1. The floor cannot fabricate an LLM provenance stamp because the stamp is written by the call layer, not the scorer.
2. **Artifact-diff vs floor (strong):** hash-compare the emitted tree against the deterministic floor scaffold for the same brief. A run whose emitted files are byte-identical (or trivially re-ordered) to the floor gets M-substance evidence `false` for "LLM content exists" regardless of identifier hits. This is the model_patch-vs-gold separation idea from SWE-bench [S19] applied to your own floor.
3. **Log-based call evidence (required baseline):** the NDJSON call log must show ≥1 synthesis call with `content.length > 0` (post-salvage, see Q1.6) before any "LLM produced X" claim is admissible anywhere in the packet — mirrors SWE-bench's rerunnable logs [S19] and OpenHands' trajectory-grounded evaluation [S21].
4. **Keep the rubric deterministic but feed it honest evidence:** maker-score.ts's existing design ("every impure observation arrives as a precomputed parameter") is exactly right — add `llmEvidence` (non-empty synthesis completions count, refused/empty count, provenance map) as a parameter, and let M1 (and/or a new M-criterion above the M1..M9 mean) be gated on it. Deterministic scorer + provenance-gated inputs = no drift, no gaming.
5. **Do NOT over-rotate:** hidden tests are the gold standard but not always available for generative scaffolds; provenance + artifact-diff gets you most of the honesty for a fraction of the machinery, and matches the repo's own honesty contract (declare-or-strike, RT_E codes, paper trail).

---

## Q3 — Bounded-refusal loop design and honest reporting (so baseline-green ≠ product-green)

### Q3.1 Stop-loudly vs degrade-to-baseline: the canonical answer is *both*, in a circuit-breaker shape

Microsoft's Circuit Breaker pattern (fetched): three states — **Closed** (normal), **Open** ("fail fast": requests are short-circuited, no further attempts), **Half-Open** (limited probe traffic; success → Closed, failure → back to Open). Critically, the Open state does not just fail silently: in the reference flow "the circuit breaker ... trips to an Open state. Subsequent requests are immediately short-circuited, which **returns default or cached responses and informs users of temporary degradation**" [S24]. And it is explicitly complementary to the Retry pattern — "An application can combine these two patterns by using the Retry pattern to retry an operation any number of times... and using the Circuit Breaker to prevent the application from performing an operation that's likely to fail" [S24]. **Design translation: bounded retries (N=2-3) → trip → serve the deterministic floor as the degraded default → surface a loud, coded degradation notice.** The floor is a legitimate "cached/default response"; the sin is serving it silently.

### Q3.2 The published failure modes are all SILENT degradation — avoid each

| Anti-pattern (fetched evidence) | What happened | The fix it implies |
|---|---|---|
| goose #11142: client sends same `max_tokens` with reasoning on → 0 content tokens → "silent failure: no error, no warning, just `finish_reason:"length"` with empty content" [S10] | Budget bug reads as model failure | Budget ladder (Q1.6) + classify `length`+reasoning as "starved", not "empty" |
| hermes-agent #82291: JSON in `reasoning_content`, content empty → "no error, no warning, no retry", title permanently degraded [S13] | Field-misfiled payload silently discarded | Read `content \|\| reasoning_content` before declaring empty (Q1.6) |
| hermes-agent #83390: DeepSeek rejects `response_format:{type:"json_schema"}` with HTTP 400 "This response_format type is unavailable now" — but the exception-handling chain "only retries/degrades for: HTTP 402 (insufficient balance), transient errors, `temperature`/`max_tokens` parameter issues" — a 400 invalid_request falls through [S14] | Error-class gaps in the fallback chain → permanent silent failure | Retry/refusal handling must be *exhaustive over error classes*, and every class must end in a coded loud outcome |
| SkillClaw #70: empty content through proxy → client fallback chain "re-issues the request to a direct provider, roughly doubling effective latency and cost" [S11] | Unbounded fallback churn without surfacing | Circuit-breaker the fallback route too; trip once, then report (Q3.3) |
| OpenAI refusal handling (canonical *good* example): explicit `refusal` field + documented handler ordering — length → refusal → content → else throw "No response content" [S8] | Refusals are detectable and handled, not swallowed | Model your handler ordering on this |

### Q3.3 Reporting so a scorecard can't read baseline-green as product-green

1. **Degradation is a run-level fact, recorded at the trip, in the artifact.** Every tripped synthesis writes an RT_E-style coded event (e.g. `RT_E_LLM_EMPTY`/`RT_E_LLM_REFUSED` with `finish_reason`, `reasoning_tokens` usage, attempt count) into the audit trail — mirroring the repo's existing "red results are never a clean 0 / sealedWithFailures" honesty contract.
2. **The scorer's evidence inputs must carry the degradation flag.** Following maker-score.ts's own param pattern, the driver should pass `synthesisRefusals`, `synthesisEmptyCount`, `degraded: boolean` (and the Q2 provenance map) into the pure scorer. When `degraded` is true, criteria that need LLM-produced content (M1 substance at the "product" bar) are scored against the floor's honest level or capped — a card can say "green floor, degraded product" but never imply product-green.
3. **Stop-loudly beats degrade-silently in every cited case.** The pattern that keeps failing in the wild is *exit quietly to the fallback*. The pattern that reads correctly is *degrade to the baseline AND stamp the reason*: users and scorecards see both the artifact and the loud code [S24][S10][S14]. RapidTool already has the seams (RT_E registry, NDJSON logs, `sealedWithFailures` semantics, M9's "parked LOUDLY with a code"); extend them to synthesis.

---

## Q4 — DeepSeek v4-pro quirks documented in the wild (Sept-2026 state)

Timeline & identity (from DeepSeek's own docs/news, fetched):
- **DeepSeek-V4 Preview: 2026-04-24; DeepSeek-V4-Flash update: 2026-07-31; legacy names `deepseek-chat`/`deepseek-reasoner` (→ v4-flash non-thinking/thinking modes) discontinued 2026-07-24; V4-Pro GA: 2026-08-13; V4-Flash-Vision-Exp: 2026-08-21** [S4][S5][S6]. GA notes: "Flexible reasoning effort for V4-Pro & V4-Flash: low for simple tasks, high for daily Agent workflows, max for complex tasks"; native OpenAI Responses API support optimized for Codex; peak/off-peak pricing from 2026-08-16 [S5].
- **API models now:** `deepseek-v4-flash`, `deepseek-v4-pro`, `deepseek-v4-flash-vision-exp` [S3]. Open weights exist on HF: `deepseek-ai/DeepSeek-V4-Pro-0813`, `DeepSeek-V4-Flash-0731`, `DeepSeek-V4-Flash`, `DeepSeek-V4-Flash-Vision-Exp` [S25].

Thinking-mode quirks (all fetched):
1. **Thinking is ON by default** (`thinking.type` default `enabled`, default `reasoning_effort` `high`) — every call without explicit `thinking:{type:"disabled"}` is a thinking call [S3]. If RapidTool intends non-thinking JSON calls, it must say so per request.
2. **Effort mapping has holes:** accepted values `low|high|max`; `medium` and `xhigh` are *mapped to high*, not rejected [S3][S2]. Same mapping for v4-flash and v4-pro [S2]. Setting `reasoning_effort:"medium"` quietly buys you `high` (and its token appetite).
3. **Sampling params are no-ops in thinking mode** — `temperature`, `top_p`, `presence_penalty`, `frequency_penalty` "will not trigger an error but will also have no effect" [S2]. Clients must not assume temperature tweaks do anything on thinking calls.
4. **`reasoning_content` round-trip is enforced:** with `tools` present, prior `reasoning_content` must be passed back or DeepSeek rejects the continuation: HTTP 400 "The `reasoning_content` in the thinking mode must be passed back to the API" — reproduced in fennara-godot-ai #151 (tool call then next request 400s) [S15] and in vllm semantic-router #3553 (proxy silently strips the field → 400) [S17]. Even the *empty-string presence* of the field matters on replay: dropping it via `omitempty` triggers the same 400 (opencode-cc #13) [S16].
5. **JSON-output empty content is vendor-acknowledged** ("the API may occasionally return empty content", prompt-mitigation suggested) [S1], and `json_object` mode requires the literal word "json" in the prompt or whitespace-loop risk [S3].
6. **`response_format` support is narrow:** DeepSeek accepts `text|json_object` only — `json_schema` returns HTTP 400 "This response_format type is unavailable now" [S14]. If any layer sends OpenAI-style `json_schema`, it will 400 on DeepSeek (hermes-agent hit exactly this on its title-generation path [S14]).
7. **Proxy re-fielding reports for v4-flash/v4-pro** (`content:""`, payload in `reasoning_content`, `finish_reason:"length"` through an opencode zen/go relay; direct calls fine) [S11] — when RapidTool sees empty content, first re-run the same request against `api.deepseek.com` directly to separate model behavior from relay behavior.
8. **Streaming shape:** `delta.reasoning_content` and `delta.content` are separate; official sample accumulates both and warns against mixing (thinking may arrive interleaved with tool-call turns) [S2].

---

## Honest negatives (what this pass could NOT verify)

- No vendor doc states an explicit "thinking + `json_object` conflict" rule for DeepSeek v4; the closest official statements are the JSON-mode empty-content note [S1], the length-cutoff note [S3], and hermes-agent's 400-class report for `json_schema` [S14]. The starvation mechanism is documented by OpenAI [S7], Anthropic [S9] and the ecosystem [S10][S12], not by DeepSeek's own docs.
- Whether RapidTool's observed empty content is mechanism A (budget), B (JSON-mode flake), or D (proxy re-fielding) could not be determined from outside the repo; the decision tree in Q1/Q4 (direct-call repro + `finish_reason`/`usage` inspection) is the discriminator.
- DeepSeek v4 docs do not publish whether `max_tokens` covers reasoning tokens for v4 (the reference reuses V3-era "total length of input tokens and generated tokens is limited by the model's context length" phrasing [S3]); ecosystem behavior (goose #11142, single-pool servers) strongly implies shared budget, but treat as ecosystem inference, not DeepSeek documentation.
- Qwen-specific docs were not fetched this pass; Qwen's same-pattern behavior is attested via claude-code-router #1596 and goose #11142 [S12][S10].

---

## TOP 3 RECOMMENDATIONS (actionable, repo-anchored)

**R1 — Add a thinking-off / effort-low retry rung before the floor (fixes empty content at the source).**
In the synthesis call path (`deepseek.server.ts` call builder ~L333 + `codegen.server.ts` `liveP6Synthesis` retry site), when a response comes back with empty `content` and populated `reasoning_content` and `finish_reason:"length"`, retry the same JSON envelope with `thinking:{type:"disabled"}` (or `reasoning_effort:"low"`) rather than going straight to the deterministic floor — DeepSeek's API makes thinking per-request optional [S3], and structured envelopes don't need CoT. Before classifying empty as failure: (a) exclude turns carrying `tool_calls` [S2][S16]; (b) attempt to salvage parseable JSON from `reasoning_content` (`content || reasoning_content`, the shipped field fix in claude-code-router #1596 [S12], which hermes-agent #82291 shows can carry the *whole* structured answer [S13]); (c) if a proxy/relay is in the path, re-run the identical request direct to `api.deepseek.com` once to separate relay re-fielding (SkillClaw #70 [S11]) from model behavior. Keep the raised budget (fixes/153) as the first rung: OpenAI's own number is ≥25k headroom for reasoning+output [S7].

**R2 — Gate M1 substance (and the top band of the card) on provenance, not on identifier hits alone.**
The floor is built from the brief's nouns, so `identifierHits`/`briefNounHits` checks are satisfiable by construction — that is benchmark leakage, and the industry fix is withheld/independent success criteria (SWE-bench keeps tests out of the model's reach [S18][S19][S20]). Concretely in `maker-score.ts` (keeping the pure-param design): add driver-gathered evidence `llmEvidence = { nonEmptySynthesisCompletions: n, emptyOrRefusedCount: m, perFileProducer: {path: "llm"|"floor"} }`; M1 substance only counts identifier hits in files whose producer is `llm` backed by a logged non-empty completion, and emit a run-level `degraded` flag when any synthesis rung tripped. Optionally hash-diff the emitted tree against the keyless-floor scaffold for the same brief — a floor-identical tree earns floor-level substance, never product-level. This is the difference between "green floor" and "green product", and it is exactly what the current scorecard cannot yet express.

**R3 — Make synthesis refusal/degradation loud, bounded and coded (circuit breaker + scorecard-visible).**
Implement a bounded ladder with breaker semantics: N consecutive empty/refused synthesis calls (N=2-3) on the same job → trip for the remainder of the run (no unbounded re-issue — SkillClaw #70 shows blind fallback re-issue doubles cost without surfacing anything [S11]; Azure Circuit Breaker is the canonical Closed/Open/Half-Open shape with "default or cached responses **and informs users of temporary degradation**" [S24]). Every trip and every refused/starved call (with `finish_reason`, reasoning-token usage, attempt count) is written as a coded RT_E event into the NDJSON audit trail, and the driver passes refusal counts + the `degraded` flag into the scorer so the card and packet show it (M9's "parked loudly with a code" philosophy extended to synthesis). The error-class handling must be exhaustive — hermes-agent #83390 shows a fallback chain that misses the 400 class leaves a permanent silent failure [S14], and goose #11142 shows the silent-empty class is the default failure mode to kill [S10]. Baseline-green must never be readable as product-green: degrade to the floor is fine; degrade silently is the bug.

---

## Source index (all fetched this pass, 2026-09-08)

Thinking-model empty content / token budgeting:
- [S1] DeepSeek API docs — JSON Output (incl. "occasionally return empty content"): https://api-docs.deepseek.com/guides/json_mode
- [S2] DeepSeek API docs — Thinking Mode (reasoning_content semantics, effort mapping, tool-call example): https://api-docs.deepseek.com/guides/thinking_mode
- [S3] DeepSeek API docs — Chat Completions API reference (thinking/reasoning_effort/max_tokens/response_format/finish_reason): https://api-docs.deepseek.com/api/create-chat-completion
- [S4] DeepSeek API docs — Change Log (V4 timeline, legacy name discontinuation): https://api-docs.deepseek.com/updates
- [S5] DeepSeek news — V4-Pro GA (2026-08-13): https://api-docs.deepseek.com/news/news260813
- [S6] DeepSeek news — V4-Flash-Vision-Exp (2026-08-21; page carries full news index incl. V4 Preview 2026-04-24): https://api-docs.deepseek.com/news/news260821
- [S7] OpenAI — Reasoning models guide (shared budget, incomplete/max_output_tokens, 25k buffer, reasoning_tokens usage): https://developers.openai.com/docs/guides/reasoning
- [S8] OpenAI — Structured Outputs guide (explicit refusals; length/refusal/no-content handler): https://developers.openai.com/docs/guides/structured-outputs
- [S9] Anthropic — Extended thinking (budget_tokens; thinking counts toward max_tokens): https://docs.claude.com/en/docs/build-with-claude/extended-thinking
- [S10] goose issue #11142 — empty content, shared max_tokens, silent finish_reason:length: https://github.com/aaif-goose/goose/issues/11142
- [S11] SkillClaw issue #70 — DeepSeek v4-flash/v4-pro empty content through proxy: https://github.com/AMAP-ML/SkillClaw/issues/70
- [S12] claude-code-router PR #1596 — content||reasoning_content fallback: https://github.com/musistudio/claude-code-router/pull/1596
- [S13] hermes-agent issue #82291 — JSON schema output in reasoning_content, content empty, silent: https://github.com/NousResearch/hermes-agent/issues/82291
- [S14] hermes-agent issue #83390 — DeepSeek HTTP 400 "This response_format type is unavailable now"; fallback-chain gap: https://github.com/NousResearch/hermes-agent/issues/83390
- [S15] fennara-godot-ai issue #151 — HTTP 400 "reasoning_content ... must be passed back" after tool call: https://github.com/fennaraOfficial/fennara-godot-ai/issues/151
- [S16] opencode-cc PR #13 — replay explicitly-empty reasoning_content: https://github.com/Kiowx/opencode-cc/pull/13
- [S17] vllm semantic-router PR #3553 — proxy strips reasoning_content → 400 on DeepSeek V4 thinking mode: https://github.com/vllm-project/semantic-router/pull/3553

Eval honesty / agent evaluation:
- [S18] SWE-bench repo README (harness, Verified subset): https://github.com/SWE-bench/SWE-bench
- [S19] SWE-bench evaluation tutorial (model_patch predictions, harness logs): https://github.com/SWE-bench/SWE-bench/blob/main/docs/assets/evaluation.md
- [S20] SWE-bench paper (2310.06770): https://arxiv.org/abs/2310.06770
- [S21] OpenHands paper (2407.16741): https://arxiv.org/abs/2407.16741
- [S22] MetaGPT paper (2308.00352): https://arxiv.org/abs/2308.00352
- [S23] Anthropic — Building effective agents: https://www.anthropic.com/engineering/building-effective-agents

Bounded refusal / degradation:
- [S24] Microsoft Azure Architecture Center — Circuit Breaker pattern: https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker

DeepSeek v4 identity/weights:
- [S25] Hugging Face model search — DeepSeek-V4 (deepseek-ai/DeepSeek-V4-Pro-0813, V4-Flash-0731, …): https://huggingface.co/api/models?search=DeepSeek-V4 (browseable at https://huggingface.co/models?search=DeepSeek-V4)

Fetched but superseded/not cited in body: `api-docs.deepseek.com/guides/reasoning_model` and `/news/news250903` both Mintlify-redirected to the Quick Start shell (title verified before discarding); `developers.openai.com/docs/guides/reasoning` etc. all title-verified on fetch. Search-engine discovery was unavailable (Firecrawl keyless), so discovery ran on GitHub issue-search API + known canonical URLs.
