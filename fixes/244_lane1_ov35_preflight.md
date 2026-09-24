# fixes/244 — W16 LANE 1 · OV-35: the Step-0 preflight (OV-27 probe · failure-class triage · kill-safety marker)

**Lane:** W16-L1 (owns `scripts/run-eval.mjs`, `scripts/run-eval.test.mjs`, `src/lib/doctor.ts`, `src/lib/doctor.test.ts` — nothing else).
**Brief:** `wave_plans/W16/lanes-and-observer.md` LANE 1. **Intent rows:** `fixes/228` §3 #4 (OV-35) / #5 (OV-27); `227` §2a item 3 + §3 C2/C5; `223` WB-6/WB-7; `235` §2 row 3 (the three unasserted clauses: marker ordering / per-class codes / keyless identity) + §4 item 2 (internal order: marker → preflight/triage); `241` §OV-35 (definition step first: exported classifier + marker seam).
**Tree at start:** HEAD `7582771` + uncommitted W14/W15 landings; `run-eval.test.mjs` 17/17 green (re-ran, see §4). All runs FOREGROUND (host artifact never hit).

---

## BOTTOM LINE (refresh at close)

> **OV-35 LANDED, all three pieces, 25/25 suite green (17 original + 8 new).**
> **(a) OV-27 probe — the D1.1 door is OPEN.** Run keyless with a dummy key on this host, the probe reports `configured=true` **through the P6 separate specifiers** (`./deepseek.` + `server.ts`, `./codegen.` + `server.ts` — all three specifiers incl. `engine.ts` resolve on bare Node) and the **wire is REACHED**: the real vendor answered **HTTP 401** ("Authentication Fails … api key … is invalid", request_id returned) for the dummy key. So 226 A1's narrow doubt is settled for the path that matters: `isDeepSeekConfigured()` via the P6 idiom is TRUE with a key set, and the request shape travels to the vendor's auth check. What it **cannot** prove without a real key: that a completion returns (model reach) and that a full `liveP6Synthesis` converges — Step 0 itself measures those (stated in the probe's own output).
> **(b) Triage — no silent ending.** `classifyRunOutcome` covers all 7 `RunOutcome` values; `classifyDrainEnding` covers all 4 drain positions; the two stalls that had **no code** (approve-throw, 80-round guard) now carry `RT_E_GATE_PENDING` / `RT_E_BUDGET_EXHAUSTED`; an uncoded stall can never classify silently (reports `RT_E_UNKNOWN` + "emitter bug"). The W15-L2 registry boundary (`RT_EVAL_*` labels stay out of the registry) is respected — the labels survive only as the last-resort `stopCode` fallback.
> **(c) Kill-safety — a killed keyed run is unmistakeable.** The marker (`research/eval-out/run-in-progress.json`) is written **before the first corpus entry** and finalized **only after BOTH `results.json` and `history.json` are written** (WB-6 torn pair); `finishedAt:null` + `runMarkerState()==="unfinished"` is the durable "do not read that results.json as current" signal. Keyless legs write **nothing new** (pinned three ways, §3).
> **doctor.ts/doctor.test.ts: untouched — owned, not needed (reason in §5.6).** Scope: 2 files changed (`git diff --stat`: run-eval.mjs +654/−15, run-eval.test.mjs +296).

---

## §1 · OV-27 — the reachability probe (P6 separate-specifier path)

**The doubt it settles** (`226` A1 / `fixes/228` D1.1 / `229` decision #1): under the bare-Node host the CLI/eval drivers run on, the server-fn `llmStatus()` reports `configured:false` even with a key set and `callModel()` needs an AsyncLocalStorage Start context — does the CLI keyed path reach a model at all? The one open door: `upgradeP6Keyed` (`engine.ts:2851-2885`) imports the provider via a **runtime-concatenated specifier** (`"./deepseek." + "server.ts"`, `:2853`; `"./codegen." + "server.ts"`, `:2870`), which may behave differently from the pro probed seam.

**The probe** (`scripts/run-eval.mjs:887`, `probeP6Reachability`): imports **engine.ts**, then both specifiers built byte-for-byte as engine builds them (`:678-681`), reports each `resolved`, calls the provider's own `isDeepSeekConfigured()` through the specifier, and (wire step) makes **ONE bounded provider call** (`completeDeepSeek`, `maxTokens:8`, 20 s timeout) through the same module the P6 path resolves to — with an injectable fetch (tests stub; the status-recording wrapper observes `res.status` so classification does not depend on parsing the provider's prose). Pure classifier `classifyLlmPreflight` (`:693`) + `preflightLimits`/`formatPreflightLines`. Standalone mode: `--preflight` (exits before any entry); keyed runs auto-run it **before the first corpus entry** (`:1907-1915`).

**THE REAL RUN (keyless — dummy key, real wire, foreground, 2026-09-24T18:32:42Z):**

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
DEEPSEEK_API_KEY=sk-dummy-probe-not-a-real-key node --experimental-strip-types scripts/run-eval.mjs --preflight
```

```text
preflight: OV-27 reachability · configured=true · class=auth-rejected · code RT_E_LLM_REJECTED
preflight: specifier engine: resolved=true
preflight: specifier deepseek: resolved=true
preflight: specifier codegen: resolved=true
preflight: wire attempted=true · httpStatus=401 · ok=false · code RT_E_LLM_REJECTED · DeepSeek API key is invalid (HTTP 401: Authentication Fails, Your api key: ****-key is invalid (request_id: 1171b618-…))
preflight: proves: the wire is reachable from this host and the request shape passes to the auth check
preflight: cannot prove (keyless/dummy key): that the key can run anything (it was refused) — a real key must pass this probe before any keyed reading
```

**Reading it honestly.** `configured=true` through the P6 idiom **falsifies the pessimistic half of A1 for this path** (the `configured:false`/ALS failures belong to the server-fn seams, not to `upgradeP6Keyed`'s provider import — which is exactly why engine.ts uses the direct-env probe, `engine.ts:2840-2842`). Wire-reach is PROVEN at the HTTP level: DNS + TLS + POST + vendor auth-check + coded refusal all round-tripped. **Not proven without a real key:** (1) a completion returning text (model reach), (2) a full `liveP6Synthesis` convergence (the full journey is Step 0's own measurement — the probe does not run it). The vendor's 401 body masks the key (`****-key`); **no key material enters the probe result** (pinned by a test).

**Classes (each a distinct `class` + registry code; the four `235`-demanded ones are class- AND code-distinct):**

| ending | class | code |
|---|---|---|
| no key | `not-configured` | `RT_E_LLM_NOT_CONFIGURED` |
| configured, no wire probe | `configured-unprobed` | `null` (unproven ≠ pass — never a silent OK) |
| 200 completion | `wire-ok` | `null` (not a failure) |
| 401 | `auth-rejected` | `RT_E_LLM_REJECTED` (registry's own 401 doc) |
| 402 | `balance-exhausted` | `RT_E_BUDGET_EXHAUSTED` |
| 400 (detail names the **requested model id** — D1.4) | `request-rejected` | `RT_E_VALIDATION` |
| 422 / 429 / 5xx / other status | `params-rejected` / `rate-limited` / `provider-unavailable` / `provider-refused` | `RT_E_VALIDATION` / `RT_E_LLM_REJECTED` ×3 |
| timeout / unreachable | `timeout` / `unreachable` | `RT_E_LLM_TIMEOUT` / `RT_E_NETWORK_UNREACHABLE` |
| empty completion (vendor answered, content empty) / anything else | `empty-completion` / `internal` | `RT_E_LLM_REJECTED` / `RT_E_INTERNAL` |

## §2 · Failure-class triage — every ending coded, no silent `stalled`

`RUN_OUTCOME_CLASSES` (`:1015`) pins all seven `RunOutcome` values (`headless.ts:527`): complete · blocked→`RT_E_GATE_PENDING` · error→`RT_E_INTERNAL` · dod→`RT_E_GATE_PENDING` · hitl · progress · cap→`RT_E_BUDGET_EXHAUSTED`. `classifyDrainEnding` (`:1039`) covers the four drain positions; every drain return now carries `ending: {class, code, ok}` (`endingRecord`, all 5 sites). **The two formerly-silent stalls are wired** (`grep` anchors): approve-throw → `code: "RT_E_GATE_PENDING"` (`:1130`), round-guard → `code: "RT_E_BUDGET_EXHAUSTED"` (`:1186`), terminal endings carry their outcome's code (`:1172`), C-2's dod code untouched (`:1160`). Non-complete endings now also print a `ending: <status> · code <code>` line at the row (`:1933`); `stopCode` still ends at `RT_EVAL_STALL`/`RT_EVAL_REFUSED` only as last-resort fallback — the **W15-L2 boundary decision is respected** (`errors.ts:59-76`; `src/lib/errors.test.ts:445-485` pins the labels out of the registry; nothing there couples to run-eval source).

**Real-drain proof (not a stub):** a project genuinely parked on P4 (`autopilot:false`), then made `forceHuman` → `drainPipeline` returns `position:"stalled"`, `code:"RT_E_GATE_PENDING"`, `ending.class:"gate-unapprovable"`, `stall:"Autopilot may not approve a forceHuman gate (R3/B-03)."` (foreground scratch run + committed test `(e)…unapprovable gate…`).

**≤4/9 decision rule** (`keyedRunDecision`, `:1810`, 227 §2a item 3): ≤4/9 → `retrace-first` (worded **re-trace, do NOT re-run blind**); 5–6 → `band-expected`; >6 → `above-prediction`; keyless → `n/a` (no line — byte-identity). Printed for keyed runs and recorded on the finished marker.

## §3 · Kill-safety run marker (WB-6)

`run-in-progress.json` lives next to the results (`markerPathFor`, `:1720`). **Ordering**: `runWithMarker` (`:1781`) writes it **before the first corpus entry**, leaves it `finishedAt:null` while entries run; `main()` finalizes (`finishRunMarker`, `:1985`) **only after `persist()` returned** — i.e. after `results.json` AND `history.json` are both written. A kill anywhere → `runMarkerState()` (`:1764`) reports `unfinished` with the note "any results.json present predates or is torn relative to it and must not be read as this run's result" — WB-6's stale-2026-09-17-6/9 misread is closed. A stale unfinished marker from a previous kill is announced loudly at the next keyed start (`:1789`).

**Keyed-only by design**: the brief's clause (c) + `235`'s byte-identity contract — keyless runs write nothing new; the keyless wrapper is a no-op. Evidence: scratch keyless run (§4) → out dir contains NO marker; results.json top keys exactly `['corpusDir','entries','generatedAt','graderDir','mode','summary']`, summary keys exactly the legacy+W5L5 set (no `decision`, no `preflight`); real `research/eval-out/` untouched (mtimes Sep 10/17).

## §4 · Tests + commands (every claim = the command)

| command | result |
|---|---|
| `node --experimental-strip-types --test --test-concurrency=2 scripts/run-eval.test.mjs` | **25/25 pass** (baseline before edits: **17/17 pass**) |
| `node --experimental-strip-types --test --test-concurrency=2 --test-name-pattern 'OV-35' scripts/run-eval.test.mjs` | **8/8 pass** (4 of them the exact names `241` dictates) |
| `grep -cE 'test\("OV-35' scripts/run-eval.test.mjs` | **8** (≥3 required; 0 before) |
| probe run (§1) | `configured=true · class=auth-rejected · httpStatus=401` — real vendor answer |
| scratch keyless eval: `EVAL_CORPUS_DIR=C:/Users/mnril/w16l1_scratch/corpus EVAL_GRADER_DIR="…/research/eval-corpus/graders" EVAL_OUT_DIR=C:/Users/mnril/w16l1_scratch/out node --experimental-strip-types scripts/run-eval.mjs --limit=1` | `complete · 5/9` · exit 0 · wrote results+history, **no marker**, legacy key set |
| `git diff --stat` | run-eval.mjs +654/−15 · run-eval.test.mjs +296 — nothing else (doctor.* untouched) |

New tests: marker ordering (before entry 1, unfinished while running) · preflight 4-class distinctness + registry containment (`ERROR_CODE_DOC` import) + rest-of-classes coverage · keyless writes-nothing (dir empty + summary key-set pinned) · ≤4/9 branch wording · all-7-outcomes + 4-positions triage incl. uncoded-stall honesty · real unapprovable-gate stall · probe specifiers + stubbed 401/200/wire-off/keyless + no-key-leak · killed-marker stale-results pin. No `npm run typecheck` / `npm test` / `npm run build` (forbidden; parent's boundary).

## §5 · Honest limits / what this lane cannot prove

1. **No real key ⇒ no model reach.** The probe proves configured + wire; a completion and a converging `liveP6Synthesis` remain Step 0's measurements. The preflight now runs automatically before any `--keyed` entries, so the owner's window starts with this evidence printed.
2. **Keyless byte-identity is pinned by contract, not a literal diff**: no-marker + exact key sets + the 4 named committed pins (per `241`'s replacement of the manual diff); the scratch end-to-end run corroborates. A literal `diff` against the 2026-09-17 file is deliberately NOT claimed (that run used a different corpus/out state; the gate for the real leg is the parent's).
3. **Triage changes abnormal-ending evidence, deliberately**: a stalled/dod/blocked/error run's `notes.stopCode` now carries a registry code where it previously fell back to `RT_EVAL_STALL`/null. Complete-ending rows (the current corpus) are byte-unchanged. `m9OnTime` scoring semantics untouched (its checks are `onTime`/`refused`/`loud`+non-empty code).
4. **Full `liveP6Synthesis` is not executed by the probe** (by design — it would synthesize; bounded to a single 8-token call).
5. **Not covered**: the round-guard stall (80 sequential rounds — too slow to drive in a unit test) is covered by classification + wiring anchors, not by an executed 80-round run; the approve-throw stall IS executed for real (§2).
6. **`src/lib/doctor.ts` + `doctor.test.ts` untouched on purpose**: doctor is client-safe (no `node:fs`, no network by contract — `doctor.ts:18/26`), and `doctor --tree` exists (do-not-rebuild). The preflight's audience is the run, not the doctor verb; nothing in OV-35's done-when requires a doctor surface. Owned-but-unmodified, stated rather than invented.
7. **`--preflight` is a run-eval flag, not a new CLI verb** (the CLI is LANE 2's box this wave). Step-0's operator runs it as `node --experimental-strip-types scripts/run-eval.mjs --preflight` (or reads it from any `--keyed` run's head).
8. **Vendor text is carried, never parsed into semantics** (OV-37's discipline): classification uses the recorded HTTP status; the vendor's own message rides `wire.error`/`detail` for humans.

*Landing log for W16-L1 (OV-35). Every number above is the output of the command printed beside it. Skeleton written at lane start; body filled as evidence landed.*
