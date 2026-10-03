# 343-2 (bug hunter 2) — model / verification / runner layer

**Lane:** bh2 ("the model / verification / runner layer"). HEAD `73f660a`. Slice: `src/lib/llm.ts`,
`src/lib/llm/**`, `deepseek.server.ts`, `prompt-engine.ts`, `verify(.server).ts`, `entry-oracle.ts`,
`compile-check.server.ts`, `node-runner.server.ts`, `sandbox.ts`, `algo-tools.ts`, `algorithms.ts`,
`harvest.ts`, `knowledge.ts`, `cassette.ts`, `mcp.server.ts`, `websearch.server.ts`, `tavily.server.ts`,
`crew.server.ts`, `bench.ts`, `ast-mine.ts` (+ tests). **0 keyed LLM calls.** Tails only.

## 1. Findings

| # | Class | `file:line` | Sev | Reproduction | Disposition |
|---|-------|-------------|-----|--------------|-------------|
| F1 | security — credential leak on redirect | `src/lib/llm/providers/one-shot-fetch.server.ts:115-130` (pre-fix) | **Medium** | two local HTTP servers, A 302 → B different origin; `oneShotFetch(A, {headers:{authorization:"Bearer …"}})` → B **receives the Authorization header**. Standard fetch strips it. Both provider families (deepseek + xai) use this transport to carry the API key, so a redirect from the trusted endpoint (or a hijacked edge) hands the key to any host. | **FIXED** (§2.1) |
| F2 | usage/ledger accounting — silent under-count | `src/lib/llm/providers/openai-compatible.ts:567-584` | Low (latent) | `completeOpenAiCompatible(..., fetch: 200 with usage.prompt_tokens_details.cached_tokens=80)` → `res.usage` had **no `cachedPromptTokens`**, though `LlmUsage.cachedPromptTokens` (llm.ts:44-52) documents exactly `prompt_tokens_details.cached_tokens`. The DeepSeek twin parses its half; this adapter dropped the whole block. Currently unreachable in production (xai is a CANDIDATE with 0 verified ids, so no seam dispatches it) — latent, not live. | **FIXED** (§2.2) |
| F3 | claim-vs-byte drift | `src/lib/harvest.ts:58` vs `:405,:425` | Low | `HARVEST_BOUNDS_LABEL` claims "a 12 s wall-clock budget", but the search leg is given a **fixed** `timeoutMs: 8000` (default search) and the deadline is only checked *between* queries. Scratch repro: budget 50 ms, two 40 ms searches → returns at **65 ms**. A real `freeWebSearch` leg can run up to 8 s each, so ≤2 queries + fetches can overrun the nominal 12 s by ~5-10 s. Still bounded (each leg is itself bounded), hence Low. | **REPORTED** (fix direction: thread `Math.min(remainingMs(), 8000)` into the search opts and clamp to a single attempt; requires widening `HarvestOptions.search`, a policy change beyond a minimal patch) |
| F4 | claim-vs-byte drift | `src/lib/mcp.server.ts:271,282,289` | Low | The frame cap is named/documented in **bytes** (`MCP_DEFAULT_MAX_FRAME_BYTES`, "exceeded the N-byte frame cap") but enforced with `String.length` (UTF-16 code units). A server sending multibyte UTF-8 admits up to ~3-4× the stated byte budget. Default-OFF, owner-gated feature; not a security boundary. | **REPORTED** (fix direction: `Buffer.byteLength`; deferred because a naive per-chunk byteLength adds an O(n²) scan — needs a running counter) |
| F5 | classification inconsistency | `src/lib/llm/providers/deepseek.ts:103` vs `openai-compatible.ts:274` | Low | DeepSeek retries `{429,500,503}`; the OpenAI-compatible family retries `{429,500,502,503,504}`. A gateway 502/504 on the DeepSeek path fails on the first attempt. | **REPORTED** — DeepSeek's set is its own documented §6 policy (the sibling's "same policy" claim is about the jitter *schedule*), so adding 502/504 is an enhancement, not a bug fix; not changed. |
| F6 | hash-delimiter ambiguity | `src/lib/knowledge.ts:335-345` | Low (theoretical) | `fingerprint()` joins fields with `\u0000`; a body containing a NUL could shift boundaries and collide with a different (body, sourcePath) split, silently de-duping a genuinely different row. Same theoretical class `verify.ts:231-232` already acknowledges (and there the delimiter is `\u0002`). | **REPORTED** — changing the delimiter re-keys every stored `K…` id (migration hazard); report-only. |

No high-severity defect was found in the key-resolution precedence/shadow signal, the
retry/timeout/429-5xx loop structure, the cassette key/response binding, the MCP framing/refusal set,
the runner bound/env allowlist, or the verify harness's compile/refusal paths — those held under
adversarial reads and mutation (§3).

## 2. Fixes (RED → GREEN, both runtimes)

### 2.1 F1 — oneShotFetch cross-origin redirect credential leak
- **RED:** new test `src/lib/llm/providers/one-shot-fetch.test.ts` "a cross-origin redirect never
  forwards the Authorization header" →
  `not ok 3 … authorization must NOT cross an origin-changing redirect`
  `+ actual 'Bearer sk-abcdef0123456789'  - expected undefined` (Node 22; Node 24 identical).
- **Fix:** `stripCrossOriginSecrets()` + in the redirect branch widen `nextInit` with
  `...(nextUrl.origin !== parsed.origin ? { headers: stripCrossOriginSecrets(init.headers) } : {})`
  — drops `authorization` / `cookie` / `proxy-authorization` across an origin change (fetch's own
  rule); same-origin redirects keep headers. Non-credential headers still travel (pinned).
- **GREEN:** `one-shot-fetch.test.ts` 5/5 on Node 22 + Node 24; provider regression 195/195 both
  runtimes (§2.3).

### 2.2 F2 — OpenAI-compatible adapter drops the cache-hit split
- **RED:** new test `registry.test.ts` "343 bh2: the OpenAI-compatible adapter records OpenAI-style
  cache-hit tokens" → `the OpenAI cache-hit split must survive  undefined !== 80`.
- **Fix:** widen `OpenAiChatBody.usage` with `prompt_tokens_details?: { cached_tokens?: unknown }` and
  add the conditional `cachedPromptTokens` to the success usage rebuild (additive; a response without
  the field keeps the byte-identical legacy 2-key object, matching `deepseek.ts:624`).
- **GREEN:** `registry.test.ts` 45/45 both runtimes.

### 2.3 Regression (targeted suites, both runtimes)
`llm.test.ts`, `one-shot-fetch`, `key-resolution`, `key-source`, `key-rejected`, `registry`,
`registry-failover`, `mock`, `deepseek.server`, `cassette` → **195 pass / 0 fail** on Node 22.23.2 and
host Node 24.15.0. Plus `node-runner` / `mcp` / `entry-oracle` / `harvest` / `prompt-engine` →
**155 pass / 1 skipped / 0 fail** (Node 22). ESLint clean on the four changed files.

## 3. Mutation testing (scratch `git worktree` of HEAD, node_modules junctioned)

Eight targeted mutations of the most consequential pins; **8/8 killed** by the existing suites:

| # | File / mutation | Killed by |
|---|---|---|
| A | `key-resolution.ts` — swap `.env`/process precedence | `key-resolution.test.ts` 3 fail |
| B | `cassette.ts` — bypass the load+serve `responseHash` binding | `cassette.test.ts` 3 fail |
| C | `deepseek.ts` — remove 429 from `RETRYABLE_STATUS` | `deepseek.server.test.ts` (retry suite) |
| D | `node-runner.server.ts` — add `DEEPSEEK_API_KEY` to `CHILD_ENV_ALLOW` | `node-runner.server.test.ts` (scrubbedEnv pin) |
| E | `mcp.server.ts` — disable the oversized-frame refusal | `mcp.server.test.ts` (coded-refusal suite) |
| F | `cassette.ts` — drop `provider` from the canonical key | `cassette.test.ts` 2 fail |
| G | `verify.server.ts` — bypass the no-callable-exports gate | `verify.server.test.ts` (verify-safety block) |
| H | `entry-oracle.ts` — force `complete: true` (vacuous) | `entry-oracle.test.ts` (337-3 completeness) |

The verifier-layer teeth are real, not decorative.

## 4. Mock / fake / placeholder census (slice source, tests excluded)

- `src/lib/llm/providers/mock.ts` — the **only** deliberate mock: a canned-envelope provider, never a
  default, absent from `PROVIDERS`/`ROLE_TIERS`/`KNOWN_MODEL_IDS`, `isConfigured()` hard-`false`,
  refusals-not-fabrication on an exhausted queue. Legitimate and honestly documented.
- No `as any` / `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` anywhere in the slice.
- No `TODO`/`FIXME` function body; every `catch {}` either has a stated reason comment or returns an
  honest value. The lone unimplemented marker is `crew.server.ts:1465 TODO(F2-09)` — a documented
  zero-consumer builder explicitly marked "KEEP until the ingest pass", not a fake body.
- `algorithms.ts:1291 librariesFor` rows are a **declared** "illustrative baseline" (static
  suggestions), not a computation pretending to be derived.
- All "fabricat*"/"fake"/"stub" hits in the census are negative invariants in comments (never
  fabricate), not fabricated code.

## 5. Not verified / residual

- No keyed run was made (0 keyed calls by contract), so F2's production impact is reasoned from the
  dispatch gate (xai carries 0 verified request ids), not observed live.
- F3's overrun was reproduced with an injected slow search (no real network); the default
  `freeWebSearch` leg's 8 s is read from the source, not measured against a live provider.
- F1's fix strips credentials on `nextUrl.origin !== parsed.origin`; the same-origin path is pinned,
  but I did not exercise a real cross-host (non-loopback) redirect.
- Full-project `typecheck`/`build`/whole `npm test` were deliberately not run (concurrent editors;
  targeted suites only per the lane rules). The two changed source files carry only type-simple,
  additively-widened shapes.

## 6. Resume — F4 + F3 closed (343-2)

Both were claim-vs-byte drifts that were left REPORTED in §1. Fix direction from §1 was followed,
RED-first, on both runtimes. **0 keyed calls** (all seams injected). Scratch `$env:TEMP\rt343_bh2\`.

### 6.1 F4 — the MCP frame cap is now enforced in real UTF-8 bytes
- **`src/lib/mcp.server.ts:60`** doc now says "in UTF-8 bytes"; `:128` option says "Max UTF-8
  bytes"; `:201-203` adds `stdoutBufferedBytes`; **`:271-302`** `onStdout` is byte-accurate:
  the running counter is bumped by `Buffer.byteLength(text,"utf8")` per chunk (`:277`), decremented
  by `lineBytes + 1` when a line is peeled (`:289`), and all three cap checks (pre-newline buffer
  `:278`, per-line `:290`, trailing buffer `:298`) compare bytes. The counter keeps the check
  amortized O(1) per chunk — no per-chunk full-buffer rescan (the O(n²) the §1 note flagged).
  `setEncoding("utf8")` never splits a code point, so per-chunk byteLength sums to the concatenation.
- **RED:** new `mcp.server.test.ts:263-283` — real child, `echo` tool returns a `€`×400 payload →
  `not ok 5 - 343 bh2 F4: refuses a multibyte frame whose UTF-8 bytes exceed the cap though its
  UTF-16 length does not` · `expected the multibyte frame to be refused at the documented byte cap`
  (Node 24 + Node 22 identical).
- **GREEN:** refusal `RT_E_VALIDATION` / `frame cap` on both runtimes.
- **Multibyte-frame proof** (scratch probe, one real reply frame
  `{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"€"×400}],"isError":false}}`):

  | cap (bytes) | UTF-16 length | UTF-8 bytes | BEFORE (HEAD `73f660a`) | AFTER |
  |---|---|---|---|---|
  | 600 | 489 | 1289 | `callOk:true` — **admitted** | `RT_E_VALIDATION: MCP reply exceeded the 600-byte frame cap` |
  | 1289 (= bytes) | 489 | 1289 | admitted | **admitted** (exact boundary) |
  | 1288 (= bytes−1) | 489 | 1289 | admitted | `RT_E_VALIDATION … 1288-byte frame cap` |

  Identical output on Node 24 and Node 22: a frame that `String.length` called 489 bytes is now
  metered at its true 1289 bytes and refused at the documented limit, admitted exactly at it.

### 6.2 F3 — the harvest wall-clock budget is now real for the search leg
- **`src/lib/harvest.ts:50`** adds `HARVEST_SEARCH_TIMEOUT_MS = 8_000`; `:116-118` widens the
  `HarvestOptions.search` seam with `timeoutMs?: number`; `:401` forwards `o.timeoutMs ??
  HARVEST_SEARCH_TIMEOUT_MS` to the real `freeWebSearch`; **`:436`** hands each dispatched leg
  `timeoutMs: Math.min(remainingMs(), HARVEST_SEARCH_TIMEOUT_MS)` (the remaining slice, not a fixed
  8000); **`:441-447`** detects a leg that ignored its slice (`remainingMs() <= 0` after the await)
  and emits the coded degraded note `… overran the N ms wall-clock budget [RT_E_BUDGET_EXHAUSTED] —
  no further queries dispatched`. Hits already received are still returned honestly — no fabricated
  result on a stop. Header `:15-20` now states the same contract.
- **RED:** new `harvest.test.ts:411-465` — two tests:
  `not ok 12 … the first leg must get a positive slice of the budget, got -1` (the seam was handed
  no `timeoutMs` at all), and
  `not ok 13 … an ignored budget must surface as a coded degraded result: ["fetch budget (0) reached
  — 2 candidate(s) left unfetched","fetch budget is 0 — no candidate fetched"]` (both legs ran to
  completion with no coded note). Node 24 + Node 22 identical.
- **GREEN:** both tests pass; the pre-existing `timeoutMs:1` / zero-fetch-budget pins are untouched
  and still pass (the post-await note is additive).
- **Deadline proof** (scratch probe: budget 300 ms, two 220 ms legs, `maxQueries:2`, `maxFetches:0`;
  the cooperating fake aborts at the `timeoutMs` it is handed — as the real `freeWebSearch`
  AbortController does):

  | run | elapsed | timeouts handed per leg | coded note |
  |---|---|---|---|
  | BEFORE cooperating | 448–472 ms | `[null, null]` | none |
  | AFTER cooperating | 307–310 ms | `[300, 55–69]` | `RT_E_BUDGET_EXHAUSTED` |
  | AFTER leg that ignores its slice | ~452–473 ms | `[300, 64–75]` | `RT_E_BUDGET_EXHAUSTED` |

  Node 24 and Node 22 agree. A cooperating backend now finishes inside the budget (307 ms vs the
  old 448–472 ms); a hostile leg that ignores its slice cannot pass as clean — it is reported coded.
  The §1 50 ms repro (`[null,null]`, no note before) now hands `[50, remaining]` and emits the coded
  note.

### 6.3 Regression / hygiene
- `mcp.server.test.ts` + `harvest.test.ts` together: **baseline 83 tests / 82 pass / 1 skipped / 0 fail**
  → RED **86 / 82 pass / 3 fail / 1 skipped** → GREEN **86 tests / 85 pass / 1 skipped / 0 fail**,
  identical on Node 24.15.0 (`node`) and Node 22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`). The 1
  skip is the pre-existing environmental `promptExpand` not-configured skip (a `DEEPSEEK_API_KEY` is
  set on this host) — no keyed call was made.
- `npx tsc --noEmit` exit 0 (whole project, 0 errors); `npx eslint` exit 0 on the four owned files.
  Full `gate.sh` / whole `npm test` deliberately not run (concurrent editors; lane rules).
- No tracked-file deletion; only the four owned files + this report changed. `stub-server.ts`,
  `node-runner.server.ts`, `registry` untouched (no pin moved).

### 6.4 What remains
- F5 (DeepSeek retry set 502/504) and F6 (knowledge fingerprint NUL delimiter) stay REPORTED as
  before — both are policy/migration calls, not defects to patch here.
- F3's deadline is enforced for a leg that honours its slice and *detected+coded* for one that
  ignores it; a leg that ignores its slice still physically runs to completion inside this call
  (no `Promise.race`). Hard-aborting a hostile seam was deliberately not taken: it would rewrite the
  existing `timeoutMs:1` zero-attempt pins and complicate the no-fake-result contract. The real
  backends (`freeWebSearch`, the AbortController fetchers) honour their slices, so the 12 s claim is
  true for production seams.
- F4 meters the *decoded* UTF-8 stream; invalid UTF-8 decodes to U+FFFD and is therefore counted at
  3 bytes per replacement — an over-approximation that fails closed.
