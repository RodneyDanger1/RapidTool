# 341-2 (provider + key path + real scorecard) — append-only log

**Lane:** engineer 341-2. **Root:** `C:\Users\mnril\Desktop\RapidTool Main` (git `main`, HEAD `2d5ee35`, tree clean at open).
**Runtimes:** host `node` v24.15.0 and `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
**Ownership:** `src/lib/llm/providers/**` + `scripts/run-eval.mjs` only. Scratch: `$env:TEMP\rt341_2\`.
**Keyed budget:** the eval run (its own cost) + 2 extra calls (1 free 401 RED probe, 1 tiny GREEN preflight).
**No full gate.** No tracked-file deletions. Never printed a secret (tails only).

---

## 1. Key-path audit (on bytes)

**Precedence** — `key-resolution.ts` `resolveApiKey` (`:145-175`) + `key-source.server.ts` `resolveProcessKey` (`:73-105`):
- present-but-**blank** process value ⇒ `{effective:null}` **before** `.env` is consulted (`resolveApiKey:152-158`) — the keyless-forcing convention; pinned by `key-resolution.test.ts:115-139`.
- **absent** (`undefined`/`null`) ⇒ `.env` supplies the key (`:143-153`).
- **shadowed ambient**: `.env` wins over a differing non-blank process value, `conflict` carries both last-4 tails (`:164-171`), `formatShadowWarning` emits the coded `[RT_E_LLM_KEY_SHADOWED]` line; `resolveProcessKey` installs the `.env` value into `env[name]` so direct readers agree (`key-source.server.ts:92-100`). **The signal only fires when a caller declares `RAPIDTOOL_LLM_ENV_FILE`.**
- **DEFECT (fixed, §3.1):** `scripts/run-eval.mjs` never declared the marker, so a keyed eval read the stale machine-scope key and never printed the coded signal. Measured RED: preflight sent `…42ff` → HTTP 401, no shadow line. After the fix: shadow line + HTTP 200 on the repo `.env` key `…19b3`.

**401 / 402 / 429 classification** — `deepseek.ts:510-545`, `openai-compatible.ts:504-529`:
- 401 ⇒ `KEY_REJECTED_CODE` (`RT_E_LLM_KEY_REJECTED`), message names the key source (path or process env, tail-only).
- HTTP 402 **or** the wallet text class ⇒ `RT_E_LLM_NO_BALANCE`; never retried (billing is not transient).
- 429/500/503 ⇒ retryable set, final refusal keeps `RT_E_LLM_REJECTED` (+ "after N attempts").
- **DEFECT (fixed, §3.3):** the OpenAI-compatible adapter re-declared a NARROW `/insufficient balance/i` instead of the shared widened `isInsufficientFundsText` (deepseek.ts:323) that its own header claims both families import, so `insufficient_funds`/`insufficient_quota` on a non-402 status misclassified as a generic refusal.

**Retry / timeout** — `postWithRetry` (deepseek.ts:271-305) / `getResponseWithRetry` (openai-compatible.ts:297-318): 3 attempts, full-jitter backoff capped at 8 s, AbortError (the caller's deadline) never retried, bounded — no infinite loop, attempt count rides the refusal. One shared AbortController bounds the whole retry sequence.

**Ledger / cap** — `completeDeepSeek` parses vendor usage incl. the cache split (`:596-631`); the opt-in tap `setLlmCallTap` (`:760-790`) folds served model + usage + code; `RAPIDTOOL_LLM_USAGE_LOG` appends a tail-safe record per call. `run-eval` consumes `recordSpend`/`totalTokens` (never recomputes). Session cap `RAPIDTOOL_TOKEN_CAP` binds the codegen session budget (`token-ledger.ts` `sessionTokenBudget()`); this run used a 30 M cap that never tripped.

**Failover (F2 / R13-f09)** — `resolveFallbackChain` (`registry.ts:300-332`) resolves + validates the chain purely; `callModel` (`:696-715`) refuses a configured chain LOUDLY (`RT_E_VALIDATION`, "NOT ARMED") before any dispatch. **It is resolved-but-UNARMED, and the bytes cannot honestly arm it yet:** the only second family (`XAI_PROVIDER`) is a CANDIDATE with an EMPTY `requestModelIds`, there is no `XAI_API_KEY` on this host, and there is no per-call failover router or cross-family provenance stamp. `TODO(R13-f09)` at `registry.ts:701` stays (genuinely open). The exact arming gap: a live probe must mint a verified xAI descriptor (`probeProviderModels` → `applyProbedModels`) AND a transient-class failover routine must be written into `callModel`.

---

## 2. The real acceptance scorecard (the missing evidence)

`npm run eval -- --keyed --out %TEMP%\rt341_2\eval-out --all` · mode **keyed** · 11 corpus fixtures · trials=1 · graderFreeze `checked:11 ok:true` · run finalized (results.json + history.json written, exit 0).

| slug | status | total | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M9 | pass@1 | stop |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| arcade-breakout | dod | **8/9** | 1 1 1 1 1 1 0 1 1 | 0 | P7 |
| date-rrule-library | dod | **8/9** | 1 1 1 1 1 1 0 1 1 | 0 | P7 |
| field-ops-suite | dod | **8/9** | 1 1 1 1 1 1 0 1 1 | 0 | P7 |
| showing-booking | dod | **8/9** | 1 1 1 1 1 1 0 1 1 | 0 | P7 |
| permit-inspection-tracker | dod | 7/9 | 1 1 0 1 1 1 0 1 1 | 0 | P6 (`p6-arch`) |
| order-webhook-service | dod | 6/9 | 1 1 0 0 1 1 0 1 1 | 0 | P7 |
| coffeehouse2home-property-ledger | dod | 5/9 | 1 0 0 0 1 1 0 1 1 | 0 | P6 (`p6-test,p6-verified,p6-arch`) |
| invoice-csv-cli | dod | 5/9 | 0 1 0 0 1 1 0 1 1 | 0 | P7 |
| real-estate-crm | dod | 5/9 | 1 0 0 0 1 1 0 1 1 | 0 | P6 (`p6-test,p6-verified`) |
| rental-portfolio | dod | 5/9 | 1 0 0 0 1 1 0 1 1 | 0 | P6 (`p6-test,p6-verified`) |
| house-flip-manager | dod | 4/9 | 0 0 0 0 1 1 0 1 1 | 0 | P6 (`p6-verified,p6-brief-fit,p6-arch`) |

**Mean total = 6.27/9 (0.6970). pass@1 = 0.000 for every fixture. Flaky: none. Grader leaks: none.**

**Failure taxonomy (which fixtures fail and why):**
1. **Every run ends `dod` / `RT_E_GATE_PENDING`** — a hard DoD stop, never `complete`. M9=1 everywhere (parked LOUDLY with a registry code).
2. **M7=0 universally** — the first keyed scorecard per slug: no prior history, so no learning claim (honest cold start, not a defect). This alone caps 4 fixtures at 8/9.
3. **P7 `p7-research` unmet (6 fixtures)** — arcade/date-rrule/field-ops/showing-booking have a *green, machine-verified P6* (M1–M4=1, `lastTest "tested"` + evidenceHash) and stop only at the P7 research gate. `TAVILY_API_KEY` is blank in this workspace (live research backend unavailable), and the documented `RT_E_RESEARCH_UNAVAILABLE` waiver did not apply. **Cluster mechanism (engine/dod-owned — see STOP-2).**
4. **P6 gates unmet (5 fixtures)** — dominated by the keyed synthesis refusing a chunk: `RT_E_VALIDATION · chunk N/M refused · typeSignature functions not exported: <names>` (coffeehouse chunk 3/9; house-flip chunk 1/7; rental/real-estate/crm similar), i.e. the generated chunk did not export the oracle-contract functions. Downstream M2 is then red from real emitted TS errors — e.g. coffeehouse `send-booking-confirmation.ts(394,62) TS2554 Expected 2 arguments, but got 4`; house-flip `list-overdue-milestones.ts(77,23) TS2323 Cannot redeclare exported variable 'listOverdueMilestones'`.
5. **M1=0** for house-flip (`Contractor bids and invoices`, `Flip P&L dashboard` have no identifier) and invoice-csv.
6. **order-webhook-service** additionally fails run-side acceptance: `.env.example` missing `"PORT"`, and 3/4 `expectedBehavior` rows FAILED (the only fixture where files/content/behavior/kind did not pass).
7. **Top-line bar:** every grader demands `meanAtLeast: 1` (10/10); the ceiling observed is 8/9, so pass@1=0 is threshold-driven, not a files/content miss (all other fixtures pass files/content/behavior/kind).

**Honest reading:** the factory produces machine-gated, machine-verified, paste-ready trees on its diverse corpus (M2/M5/M6/M8/M9 largely 1) but meets **none** of the corpus acceptance bars, and **no run reaches `complete`**. The 339 parent's "unattended journey completes" was on a narrow `statlib` library brief; on this 11-fixture spread it does not.

---

## 3. Fixes (RED-first)

### 3.1 `scripts/run-eval.mjs` — the driver read the stale ambient key, not the repo `.env`
**RED (measured):** `npm run eval -- --keyed --preflight` → `wire httpStatus=401 … your api key ****42ff is invalid` and **no** `RT_E_LLM_KEY_SHADOWED` line (the driver never declared `RAPIDTOOL_LLM_ENV_FILE`; `KEYED_OK` was a raw `process.env` read). A keyed eval would 401 on every call.
**FIX:** at the top of `main()`, when `--keyed`, declare `<ROOT>/.env` via `RAPIDTOOL_LLM_ENV_FILE` (the same seam the CLI and `with-app-env.mjs` use) and derive `keyedOk` from `resolveProcessKey(...).effective !== null`; `KEYED_OK` const → module-level `let keyedOk` (crash-tombstone initial value retained).
**GREEN (measured):** preflight now prints the coded shadow line (`…19b3` WINS over `…42ff`) and `class=wire-ok · httpStatus=200`; a workspace whose only key lives in `.env` now runs keyed; keyless runs are untouched.
**Tests:** `scripts/run-eval.test.mjs` 51/51 (both spawn-to-keyless cases still keyless).

### 3.2 `scripts/run-eval.mjs` — the reachability preflight reintroduced the W45/327 libuv abort
**RED (measured):** the preflight exited through `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76` (exit 1) — the probe injected `globalThis.fetch` (undici), whose TLS teardown handle races the driver's in-tick `process.exit()`, defeating `oneShotFetch`.
**FIX:** `probeP6Reachability`'s `baseFetch = fetchImpl ?? globalThis.fetch` → `?? oneShotFetch` (`one-shot-fetch.server.ts`).
**GREEN (measured):** the preflight exits **0** with no assertion; `EVAL_EXIT=0`.
~~**FIX:** both probes' `baseFetch = fetchImpl ?? globalThis.fetch` → `?? oneShotFetch` (`one-shot-fetch.server.ts`).~~
~~**GREEN (measured):** preflight and the full 11-fixture keyed run both exit **0** with no assertion; `EVAL_EXIT=0`.~~
> **STRIKE (341-2 resume, verifier B):** the struck sentences claimed *both* probes were switched to `oneShotFetch`. Only `probeP6Reachability` was; `probeFundedness` kept `const baseFetch = fetchImpl ?? globalThis.fetch` (`run-eval.mjs:1711`) and is reached in the keyed flow (`main()` → `probeFundedness({})`, `:3149`). The `--preflight` GREEN never calls `probeFundedness`, so it proved nothing about that seam (the keyed run merely did not lose the race that draw). The fundedness seam is fixed — `:1711` → `?? oneShotFetch` — and RED/GREEN-measured in **§18**.

### 3.3 `src/lib/llm/providers/openai-compatible.ts` — wallet classifier not shared
**RED:** new test (key-rejected.test.ts) — xAI family, `insufficient_funds` on HTTP 400 → `RT_E_LLM_REJECTED` (expected `RT_E_LLM_NO_BALANCE`); 4/1 fail.
**FIX:** import `isInsufficientFundsText` from `./deepseek.ts`; `noBalance = status===402 || isInsufficientFundsText(refusalText)` (one regex, both families — the deepseek header claim is now literally true). Negative control (`insufficient permissions`) stays `RT_E_LLM_REJECTED`.
**GREEN:** 5/5 on host + Node 22.

### 3.4 Comment-vs-bytes corrections (no behaviour)
- `registry.ts` header: it claimed failover, `RAPIDTOOL_FALLBACK_PROVIDERS`, and per-call telemetry were "still deferred" — the chain resolver (R13-f09) and the call tap (W23-L1) have landed. Reworded to "chain resolves but stays UNARMED; routing/autodetect remain deferred; telemetry landed as the call tap".
- `mock.ts` header: claimed env routing "is a later wave's" — OV-1 landed it; the mock stays explicit-only because it is absent from `PROVIDERS`. Reworded.

**Targeted suites (both runtimes):** providers `90/90` (host + Node 22), `run-eval.test.mjs 51/51`, `cassette.test.ts 56/56`. `tsc --noEmit` exit 0 (src) and `tsc -p tsconfig.scripts.json --noEmit` exit 0.

---

## 4. Wiring audit (this slice)

- `registry.callModel` consumers: `crew.server.ts`, `chat.server.ts`, `verify.server.ts`. `resolveEnvProvider`/`resolveEnvSelectedRoute`/`PROVIDERS`/`ROLE_TIERS`/`roleModelEnvKey`/`resolveRoleModel` consumed by `doctor.ts` (lazy `import()` seam) + tests. `KNOWN_MODEL_IDS`/`isKnownModelId` used in-file + tests.
- `probe.ts` (`probeProviderModels`) and `applyProbedModels` have **test-only** consumers — the F2 second-family mint shell is owner-gated on the OV-1 trust/key decision (allowlisted, named in `finalsprint.md` F2 / `fixes/272_s3_depth.md`).
- `mock.ts` has **test-only** consumers by contract (explicit-selection only; never in `PROVIDERS`, never a configured probe).
- `key-resolution.ts` / `key-source.server.ts` consumed by both providers, `rapidtool-cli.mjs`, and now `run-eval.mjs`. `oneShotFetch` consumed by both providers and now `run-eval.mjs`.
- Comments now match bytes (see §3.4). Over-claim check: the failover/second-provider claim is exactly as armed as the bytes (unarmed, loud).

## 5. 340 verifier findings touching providers/cassette — FIXED

Verifier A (`fixes/340_7_verifier-a.md`) found (a) no response binding and (b) provider-agnostic key ⇒ cross-family conflation. `cassette.ts` now: `CASSETTE_VERSION = 2`, `responseHash` re-derived at load (`parseTape`) and at serve, `provider` family folded into `canonicalRequest`/`cassetteKey`, v1 tapes refused with a re-record reason; both providers pass their family id (“deepseek” / `spec.id`). Independently re-verified here: `cassette.test.ts` **56/56 on both runtimes**, pins at `:204-212` (family in key), `:225-232` (responseHash), `:578-602` (version/responseHash refusals), `:951-990` (cross-family miss, 0 transport calls). **State: FIXED and pinned.**

## 6. Keyed usage (measured, server-reported)

- Eval: **130 provider calls, 0 failed**, served `deepseek-flash` for all; **prompt 332,042 + completion 412,434 = 744,476 tokens**; estimated **$0.3453** (deepseek off-peak cache-miss list). Per-fixture `estimatedCostUsd` in `results.json` sums to $0.345251 (128 tap-observed calls; the 2 Step-0 probes predate the tap install and appear only in the raw `RAPIDTOOL_LLM_USAGE_LOG`, which totals 130).
- Extra lane calls: 2 (RED preflight 401 = unbilled; GREEN preflight 200 ≈ a few tokens). Within the ≤4 budget. No secret printed — tails only.

## 7. Mock / fake census (this lane's edits)

Lines added/touched: `run-eval.mjs` (+~30), `openai-compatible.ts` (+~10), `key-rejected.test.ts` (+~33), `registry.ts`/`mock.ts` (comments). **0** `TODO` bodies added, **0** `as any`/`@ts-ignore` variants, **0** silent `catch {}`, **0** hardcoded-return fakes, **0** unfalsifiable tests. The only doubles are the legitimate injected `fetch` stubs in tests. Production run-eval now uses the real `oneShotFetch`.

## 8. Verdict

**Key path: WORKS after this lane's fixes** — precedence (`.env` wins over stale ambient, blank disables, absent falls back), the coded `RT_E_LLM_KEY_SHADOWED` signal, the 401/402/429 classes, bounded retry/timeout, usage/ledger accounting, and the 340 cassette integrity are all real and pinned. The eval driver was the one broken seam (stale key + undici crash) and is now honest. **Failover: resolved-but-unarmed, correctly and loudly** — arming is not supported by the bytes (no verified second family/route/provenance). **Acceptance: measured at 0/11 pass@1, mean 6.27/9, all runs hard-stopped at a coded gate** — the factory does not meet its own corpus bars; this is the honest, unsmoothed grade.

**Remaining / STOP-and-REPORT (outside this slice):**
1. `run-eval.mjs` `classifyLlmPreflight` maps 401 to the coarse `RT_E_LLM_REJECTED` while the provider returns the precise `RT_E_LLM_KEY_REJECTED`. Harmonizing needs `scripts/run-eval.test.mjs:886` (not owned). Low severity (`errors.ts` still documents 401 under REJECTED).
2. The 6× P7 `p7-research` hard stops (live research unavailable, blank `TAVILY_API_KEY`) and the P6 `p6-arch`/`p6-brief-fit` stops are `engine.ts`/`dod.ts`-owned. If `RT_E_RESEARCH_UNAVAILABLE`'s documented waiver should apply keyed, that is their call.
3. `scripts/README-cli.md` "API key resolution" (not owned) should note the eval driver now declares the same repo `.env`.
4. `--preflight` without `--keyed` still reads the process key (no marker); documented residual.

---

# 341-2 · resume sub-task — the P7 `p7-research` hard stop (root cause, in bytes)

**New slice (STRICT):** `src/lib/dod.ts`, `src/lib/websearch.server.ts`. Nothing else edited.
**Env:** host `node` v24.15.0; pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
**Scratch:** `%TEMP%\rt341_2\` (`before/`, `eval-after/`, `p7live.mjs`, `p7run.mjs`, `p7complete.mjs`).
**No keyed calls in the investigation probes** (key cleared ⇒ no LLM narrative); keyed budget spent on the one required eval re-run (§12).

## 9. Root cause, on the bytes — the keyed eval never runs P7's LIVE layer

`dod.ts:770-778` (unchanged):
```ts
{
  id: "p7-research",
  criterion: "Live research corpus exists for P7 (≥1 fetched finding)",
  probe: (p) => (p.research?.length ?? 0) > 0 || p.meta?.liveUnavailable === true,
},
```

On the real keyed fixture state (`%TEMP%\rt341_2\eval-out\arcade-breakout\.rapidtool\project.json`):
```
research: <ABSENT>          meta: <ABSENT>          modelRoute: "deepseek-flash"
phases[7] = { status:"complete",
  gate:{ passed:false, evidenceHash:"425504246",
         unmet:["Live research corpus exists for P7 (≥1 fetched finding)"] } }
logs(phase 7) = phase.enter · algo.run · p7.seal.unmet(warn) · gate.verdict FAIL · dod.blocked
             → NO research.* · NO *.live.* · NO p7.live.degrade · NO narrative artifact
```
and `results.json.notes.stall = "P7 DoD unmet — hard gate blocks advance: p7-research."`,
`stopCode RT_E_GATE_PENDING`; `eval-run.log`: `ending: dod · code RT_E_GATE_PENDING`.

**Neither disjunct can be satisfied because the live layer never runs for P7 in keyed mode.**
`scripts/run-eval.mjs` keyed flow:
- `:2068` `const pre = await drainPipeline(project0, { keyed: false, p6Gate: true });`
- `:2074` `drain = await drainPipeline(afterJourney, { keyed: false });`  ← **post-journey drain is KEYLESS**
- `:1921` `const res = await runUntilGate(p, { autopilot: false, live: keyed, maxSteps: 60 });`
  so `live:false` ⇒ `headless.runPhase` returns `applyPhaseResult` directly (`headless.ts:725`, `:587-591`),
  and the two live implementations — `engine.liveLayer`/`fetchResearch` (`engine.ts:3244`, `:3044`) that stamps
  `meta.liveUnavailable` (`engine.ts:3276-3294`), and the bare-Node overlay `headless.bareNodeLiveOverlay`
  (`headless.ts:387-558`, which runs `freeWebSearch`) — are never invoked.

So the criterion requires an artifact (`project.research` **or** `meta.liveUnavailable`) that this run never writes.
The blank `TAVILY_API_KEY` is **not** the cause: `.env` carries it present-but-empty and `isTavilyConfigured()`
is false (`tavily.server.ts:55`), so the **free** path is the intended backend — and it works (below).

**Proof the probe/waiver are correct (cost-free, key cleared):**
`node --experimental-strip-types %TEMP%\rt341_2\p7live.mjs` on the real project rewound to P7:
```
AFTER research: 1  provider: duckduckgo
AFTER p7 research-kind artifacts: Competitive analysis matrix, GitHub - zenUnicorn/VibeGame …,
        Recreating Breakout for the Web - DEV Community, Player paddle and controls | MDN, …
```
`p7complete.mjs` (live drain + stock-gate approvals, eval `drainPipeline` parity):
```
outcome: complete currentPhase: 12 status: complete approved: P8,P9
research entries: 2 provider: duckduckgo
failed gates: none
phases: 0..12 all complete/G
```
A live P7 lands the corpus and the gate goes GREEN; a live drain completes. **The gate is not the defect — the
keyed eval simply never invokes the live layer for P7.** This matches the standing UNVERIFIED note
(`research/multiagent/219c_autonomy_blockers.md:97`): "the empty P7 corpus is a path gap, not a key gap".

## 10. Why no in-scope fix is possible (the probe/waiver are test-pinned)

Changing `p7-research` to waive/soften the deterministic floor is blocked by tests on disk (both runtimes green):
- `wild-step.test.ts:631` `"P7 executed (deterministic floor)"`; `:647` `"P7 DoD unmet — hard gate blocks advance: p7-research."`;
  `:652` `assert.notEqual(res.project.meta?.liveUnavailable, true, "no waiver is fabricated by the keyless floor")`.
- `lesson-writers.test.ts:284` asserts the `p7.seal.unmet` detail carries `unmet: Live research corpus exists for P7 (≥1 fetched finding)` **verbatim**
  (so even adding an `unmetReason` to the item — which `runGate` appends to `criterion` — breaks it, `dod.ts:886-891`).

Because the probe reads only pure project state, it cannot distinguish "live research never attempted" (this eval path)
from "live attempted, zero findings" (which the engine deliberately keeps UNMET, `engine.ts:3066-3070`), and the
keyless floor's honest FAIL is *intended* semantics. Hence no honest change to `dod.ts`/`websearch.server.ts` moves this.

## 11. STOP-and-REPORT — exact fix shape (outside this slice)

**Need:** the keyed eval must actually run the live research layer for the research phases after the journey.

- **Primary — `scripts/run-eval.mjs:2074`**
  `old:` `drain = await drainPipeline(afterJourney, { keyed: false });`
  `new:` `drain = await drainPipeline(afterJourney, { keyed: true });`
  (P6 is already `complete` post-journey, so no second synthesis; `live:true` then drives P7 live → free-search corpus
  or the `liveUnavailable` waiver. Cost: adds keyed phase narratives for P7–P12.)
- **Surgical alternative — `src/lib/headless.ts`** thread a `researchLive?: boolean` from
  `runUntilGate` (`:1096`) → `advanceOnce` (`:779`) → `runReady` (`:701`) → `runPhase` (`:725`) and, when set,
  dispatch `bareNodeLiveOverlay` for `RESEARCH_PHASES` even when `live:false`; `run-eval.mjs` passes it for the
  post-journey drain. (Free search is keyless; avoids non-research keyed narratives.)
- **Do NOT** take the engine shortcut of stamping `meta.liveUnavailable` on the deterministic research floor — it
  directly contradicts the pinned `wild-step.test.ts:652` and the intended "no waiver is fabricated by the keyless floor".

## 12. Re-measure (required keyed eval re-run) — no in-scope change ⇒ the taxonomy moves on its own

`npm run eval -- --keyed --out %TEMP%\rt341_2\eval-after --all` · exit 0 · finalized (results.json + history.json).

| | before (`eval-out`, prior run) | after (`eval-after`, this run) |
|---|---|---|
| mean total | **6.27/9 (0.69699)** | **5.91/9 (0.65657)** |
| pass@1 | 0.000 (0/11) | 0.000 (0/11) |
| P7 `p7-research` stalls | 6 (arcade, date-rrule, field-ops, showing-booking, order-webhook, invoice-csv) | 5 (date-rrule, field-ops, invoice-csv, order-webhook, real-estate-crm) |
| P6 stalls | 5 | 6 |

**Reading (honest):** with **no code change**, the P7-stop *set* is not stable — `arcade-breakout` (8/9→5/9) and
`showing-booking` (8/9→5/9) regressed to a P6 stop, and `real-estate-crm` (5/9→8/9) and `house-flip-manager`
(4/9→5/9) improved. The binding blocker is the **stochastic keyed P6 synthesis** (upstream), not P7. And even a
fixture that does stall at P7 cannot pass the bar by clearing it: the grader demands `meanAtLeast: 1`
(`research/eval-corpus/graders/arcade-breakout.grader.json` `passWhen`), while `M7` is 0 on any first run
(no prior same-domain run, `maker-score.ts:639-658`) — so those fixtures top out at 8/9. P7 is therefore **not**
the acceptance/pass@1 blocker; the "6 of 11 stop only at P7" reading was an artifact of one stochastic draw.

## 13. RED / GREEN both runtimes

No probe/waiver behaviour changed, so no new RED-first test was authored (the semantics are already pinned):
- `wild-step.test.ts` P7 pins — **1/1 pass** host v24.15.0 **and** v22.23.2.
- `lesson-writers.test.ts` T-11 P7-digest pin — **2/2 pass** host v24.15.0.
- `dod.test.ts` + `gates.test.ts` — **97/97 pass** host v24.15.0.

## 14. Keyed usage (measured, this resume)

One keyed eval re-run: **11 fixtures / 1 trial**; sum of per-trial usage from `results.json.entries[]`:
**prompt 440,386 + completion 485,511 = 925,897 tokens**, estimated **$0.4173**. Investigation probes made **0**
keyed LLM calls (key cleared; only keyless free search). No secret printed (key names/tails only).

## 15. Mock / fake census (this resume)

**0** lines added to tracked files (`git diff` unchanged by this resume). Scratch `.mjs` probes only — no mocks,
no fakes, no injected transport, no unfalsifiable assertions. The live P7 evidence is a REAL `freeWebSearch`
(duckduckgo) result over the network on the real emitted project.

## 16. The two prior "small items" + STOP-and-REPORTs

- README-cli doc line — **NOT mine → STOP-and-REPORT:** `scripts/README-cli.md` §"API key resolution"
  (heading `:74`, keyed-verbs list `:76-80`) should note that `scripts/run-eval.mjs` (keyed mode) now also
  declares the checkout's `<ROOT>/.env` via `RAPIDTOOL_LLM_ENV_FILE`, exactly like the CLI — otherwise the
  section's "keyed verbs" list reads as if the eval driver does not.
- `run-eval.mjs` `classifyLlmPreflight` 401 mapping (§8 item 1) — **run-eval.mjs, not mine.**
- `--preflight` without `--keyed` (§8 item 4) — **run-eval.mjs, not mine.**
- The P7 hard stop (§8 item 2) — this resume's subject; the fix is the flow, not the probe/waiver → **STOP-and-REPORT §11.**

## 17. Verdict (this resume)

**Root cause established on bytes and it is a PATH gap, not a key/probe gap:** the keyed eval drains P7 with
`live:false` (`run-eval.mjs:2074` → `:1921`), so neither the free-search corpus nor the `liveUnavailable` waiver is
ever produced; `p7-research` (`dod.ts:777`) correctly reports UNMET. A live P7 (free duckduckgo search) lands the
corpus and the gate goes green, and a live drain completes — proven cost-free. The probe/waiver are correct and
test-pinned, so **no honest change exists inside this slice**; the fix is STOP-and-REPORTed (§11). The required
keyed re-run with no change (mean 5.91/9, pass@1 0) shows the P7-stop set is not stable and that P7 is not the
pass@1 blocker — the stochastic P6 synthesis and the cold-start `M7` are.

---

# 341-2 · resume sub-task — verifier B: `probeFundedness` transport hole + §3.2 overstatement

**Slice (STRICT):** `scripts/run-eval.mjs`, `fixes/341_2_provider-key.md`. Nothing else edited.
**Env:** host `node` v24.15.0; pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
**Scratch:** `%TEMP%\rt341_2\redgreen\`. Billed keyed calls: **0**; wire usage reported in §21.

## 18. The code hole — `probeFundedness` still defaulted to undici's global `fetch`

**Byte:** `scripts/run-eval.mjs:1711` (pre-fix) `const baseFetch = fetchImpl ?? globalThis.fetch;` — the only remaining `globalThis.fetch` default in the driver. `probeP6Reachability:1602` had been switched (`?? oneShotFetch`); this probe had not. It is reached in the keyed flow: `main()` → `probeFundedness({})` (`:3149`) → `completeDeepSeek(..., { fetch: recordingFetch })`, the same in-tick-`process.exit()` environment that makes the undici TLS teardown handle abort.

**RED (measured on the real probe, no vendor call):** `redgreen\probe_red.mjs` invokes the real `probeFundedness({})` with a dummy key and wraps `globalThis.fetch` so it still runs **undici** (the aborting transport) but points at `https://example.com/chat/completions` with the `authorization` header stripped — no vendor request, no key leaves the process. The probe completes (`class: provider-refused · httpStatus 405`) and the in-tick `process.exit(0)` then aborts **3/3**:
`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76` → exit `-1073740791` (`0xC0000409`).

**FIX:** `scripts/run-eval.mjs:1716` (post-fix) `const baseFetch = fetchImpl ?? oneShotFetch;` plus a 5-line why-comment above it. One statement changed; the injectable `fetchImpl` test seam is untouched (existing tests inject it and never hit the network).

**GREEN (measured):**
- Offline transport controls: `redgreen\b_oneshot.mjs` (`oneShotFetch` + in-tick exit) exit **0**, 5/5; `redgreen\a_undici.mjs` (`globalThis.fetch` + in-tick exit) abort `-1073740791`, 5/5.
- Real probe, post-fix default (`redgreen\probe_green.mjs`, dummy key, native `globalThis.fetch`): `class: auth-rejected · httpStatus 401`, exit **0**, 3/3.

## 19. The log overstatement (§3.2) — declare-and-strike

§3.2's struck sentences claimed **both** probes were switched to `oneShotFetch` and that the keyed-run GREEN covered the fundedness seam. Neither held: only `probeP6Reachability` changed in the prior lane; `probeFundedness` was fixed in this resume; and `--preflight` never calls `probeFundedness`, so that GREEN could not exercise it. §3.2 is corrected in place (strikethrough retained for the audit trail) and points here.

## 20. Suite counts (both runtimes)

`node --test --test-reporter=tap scripts/run-eval.test.mjs`:
- host `node` v24.15.0 — **51 tests · 51 pass · 0 fail**.
- pinned Node v22.23.2 — **51 tests · 51 pass · 0 fail**.

No test file was edited; no full gate was run.

## 21. Keyed usage (measured, this resume)

- Billed keyed / LLM calls: **0**; no secret printed (self-labelled dummy values only).
- Provider requests over the wire: **3** — the GREEN real-probe runs, all unbilled HTTP 401 auth failures on a dummy key (`funded:null`, 0 tokens billed). The intent was ≤1; the probe was run 3× for determinism. The RED harness and all transport controls made **0** provider requests (they target `example.com`).
- This resume changed one statement in `scripts/run-eval.mjs` (`baseFetch` → `oneShotFetch` at `:1716`) plus its why-comment, and this log. The rest of the working-tree diff vs `HEAD` is the prior lane's §3.1/§3.2 work.

## 22. What I did not do

- Did **not** touch any test file (not owned), so no in-suite pin was added for `baseFetch`; the guard is the RED/GREEN harness above.
- Did **not** run the full gate, a keyed eval, or `--preflight`.
- Did **not** delete any tracked file, and did **not** modify anything outside `scripts/run-eval.mjs` and `fixes/341_2_provider-key.md`.
- Did **not** print, echo, or export any real secret.
