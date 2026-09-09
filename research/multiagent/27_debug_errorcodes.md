# 27 — Debug & Error-Code Coverage Map: failure path → RT_E_* + exit code

- **File:** `research/multiagent/27_debug_errorcodes.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`)
- **Date / agent:** 2026-09-06 · Flash debug-helper F4 — **read-only on source**; this file is the only write.
- **Scope:** every `{ok:false}` / `throw` / catch site in `src/lib` + `scripts` that can reach an agent-facing surface (CLI JSON envelopes, chat/copilot result objects, exec/runner results). `src/components/console.tsx` was read only to confirm how the UI consumes codes.
- **0-hallucination rule:** every row below was read from the file at the cited `file:line` (grep + read, no execution). Codes are quoted from the canonical registry `src/lib/errors.ts:22-37`.

---

## 0. Verdict (TL;DR)

The RT_E_* taxonomy (14 codes, `errors.ts:22-37`) is **well-wired inside the LLM/runner/research modules but breaks at the three seams an AI agent actually touches**: the CLI (`scripts/rapidtool-cli.mjs`), report ingestion, and machine-verify outcomes.

- **10 of 14 codes are producible** on a live envelope today. **4 are dead in production**: `RT_E_PHASE_ILLEGAL`, `RT_E_GATE_PENDING`, `RT_E_REPORT_INVALID`, `RT_E_REPORT_PHASE_MISMATCH` — precisely the state/report codes a driver loop needs.
- The CLI documents (README-cli.md:308-310) that rejected reports surface as `RT_E_REPORT_INVALID` / `RT_E_REPORT_PHASE_MISMATCH`; **they cannot** — the CLI's `respond()` classifier receives only the message *string* (`rapidtool-cli.mjs:97-104`), and `classifyError`'s report branch matches on the error *name* (`errors.ts:90-94`), which a string never has. Every rejected report exits 1 with `RT_E_UNKNOWN`.
- `verify` failure envelopes carry **no `error`/`reason` text at all** (payload = `{ok:false, ...outcome, applied}`, `rapidtool-cli.mjs:424`), so the prose classifier receives `""` and stamps **`RT_E_UNKNOWN` on every verify failure — including LLM timeouts** that the underlying layer already coded `RT_E_LLM_TIMEOUT` (`deepseek.server.ts:292`).
- `run`/`gate` "cannot advance" conditions (locked phase, unknown phase, priors not sealed) exit **0 with `ok:true`** and carry **no code** — the failure lives only in `events[]` + `outcome:"error"` (`rapidtool-cli.mjs:226-237`, `headless.ts:380-418`).
- Root cause, one line: **`classifyError` matches error objects, but the CLI hands it strings; `respond()` never sees the thrown `Error`, and `classifyError` also ignores the `.code = "RT_E_*"` property** that `phases.ts:119-121` already attaches to thrown errors.

Exit-code taxonomy (E-25, README-cli.md:287-294) is otherwise consistent and was honored at every site.

---

## 1. Canonical registry + live-producer inventory

Registry: `src/lib/errors.ts:22-37` (14 codes), docs `ERROR_CODE_DOC` `errors.ts:113-184`, enforced complete by `errors.test.ts:124-145`. `classifyError` matchers: `errors.ts:64-106` (name `ReportRejectedError` → report codes; errno/message `ENOENT` → `RT_E_PROJECT_MISSING`; `AbortError`/`TimeoutError`/`ETIMEDOUT`/timeout prose → `RT_E_LLM_TIMEOUT`; else caller fallback), cause-chain walked ≤ 4 levels.

| Code | Live producers (verified) | Live on a CLI envelope? | Notes |
|---|---|---|---|
| `RT_E_UNKNOWN` | `errors.ts:105` fallback; CLI empty-text classify | yes (default) | CLI default for nearly every non-ENOENT failure |
| `RT_E_PROJECT_MISSING` | `classifyError` ENOENT branch | yes | CLI project-load & `ingest @file` read (ENOENT in text) |
| `RT_E_PHASE_ILLEGAL` | `phases.ts:120` sets `err.code` on the thrown Error | **no** | property is never read by `classifyError` → dead signal |
| `RT_E_GATE_PENDING` | — (no producer anywhere) | **no** | dead; only referenced in console tone set `console.tsx:4181` + README |
| `RT_E_REPORT_INVALID` | `errors.ts:90-94` name branch | **no** | sole production thrower `headless.ts:565` is caught by the CLI, which passes the message string |
| `RT_E_REPORT_PHASE_MISMATCH` | same | **no** | same reason |
| `RT_E_RUNNER_UNAVAILABLE` | `exec.ts:51,89`; `node-runner.server.ts:107` | no (CLI has no exec cmd) | UI/engine domain |
| `RT_E_RUNNER_FAILED` | `node-runner.server.ts:154,191,199,210,222` | no (CLI has no exec cmd) | UI/engine domain |
| `RT_E_LLM_NOT_CONFIGURED` | `deepseek.server.ts:174`; CLI exit-3 pin `rapidtool-cli.mjs:95` | yes | correct at both sites today |
| `RT_E_LLM_TIMEOUT` | `deepseek.server.ts:292`; `classifyError` abort/ETIMEDOUT | partially | reaches CLI only when crew prose says "timed out" |
| `RT_E_LLM_REJECTED` | `deepseek.server.ts:255,266,299` | **no** | dropped by `crew.server.ts` wrappers → CLI sees exit 4 + UNKNOWN |
| `RT_E_RESEARCH_UNAVAILABLE` | `tavily.server.ts:123,171,181,203`; `websearch.server.ts:384` | no | engine/UI domain; headless live-overlay swallows it (`headless.ts:152-154`) |
| `RT_E_VALIDATION` | `deepseek.server.ts:184`; `exec.ts:66,78`; `node-runner.server.ts:115`; `research.ts:74,83`; `tavily.server.ts:131,140`; `websearch.server.ts:313,322`; `llm-tasks.ts:133`; `chat.server.ts:189,198` | **no** | none of the CLI usage/arg failures map to it (all fall to UNKNOWN) |
| `RT_E_INTERNAL` | `chat.ts:49`; `llm.ts:69`; `exec.ts:99` (fallbacks) | **no** | CLI outer catch exits 4 but classifies prose → UNKNOWN |

**Coverage summary (module level, every `{ok:false}` site verified):**
- **Fully coded** (every failure carries `code`): `exec.ts`, `node-runner.server.ts`, `deepseek.server.ts`, `tavily.server.ts`, `websearch.server.ts`, `research.ts`, `llm.ts`, `chat.ts`, `chat.server.ts`, `llm-tasks.ts`.
- **Code-less `{ok:false}` surfaces:** `crew.server.ts` (6 sites), `verify.server.ts` (outcomes), `algo-tools.ts` (6), `planning.ts` (3), `io.ts` (9 import-validation), `store.ts` ingest + HITL guards (`store.ts:751-763,831,873`), `app-data/client.server.ts` (~9), `engine.ts:1953-1973` (`runP6Real` `{ok:false,result:null}` — intentional degrade, not agent-facing), `report-intake.ts:52` (`ValidateReportResult`), all `headless.ts` throws (8+).
- **CLI (`rapidtool-cli.mjs`):** every `{ok:false}` envelope *does* carry a `code` field mechanically (`respond()`, lines 89-110) — but the value is wrong/UNKNOWN for most failure classes (§3).

---

## 2. The three seams where codes die

1. **Seam A — CLI string-only classify** (`rapidtool-cli.mjs:97-104`): `respond()` extracts `out.error`/`out.reason` text and passes it to `classify(text)` (wrapper 130-137 → `classifyError`). `classifyError` only reaches its report-name branch when `typeof link === "object"` (`errors.ts:79-82`) — a string has `name === undefined`. **Result: name-based and errno-based matching can never fire at the CLI**; only prose heuristics (ENOENT, timeout) and the exit-3 pin survive. `fixes/48_chat_errors.md:41-48` shows the intended integrator contract was `classifyError(err)` with the **Error object**.
2. **Seam B — `err.code` never read** (`errors.ts:83-86` reads `link.code` only as an *errno* candidate, compared against `"ENOENT"`): the pattern of attaching `err.code = "RT_E_PHASE_ILLEGAL"` before throwing (`phases.ts:119-121`, same intent at `headless.ts:533-541` for report errors — not implemented there) is invisible to every classifier consumer.
3. **Seam C — empty-text envelopes**: any `ok:false` payload with neither `error` nor `reason` classifies to `RT_E_UNKNOWN` even when the underlying layer produced a precise code — `verify` outcomes (`rapidtool-cli.mjs:424`, no `error` key in `VerifyOutcomeShape`, `headless.ts:910-916`) are the standing case. `errors.test.ts` never tests string/empty input on the CLI path (only objects, `errors.test.ts:41-121`), so this shipped green.

---

## 3. CLI failure-path map (every `{ok:false}`/throw site in `scripts/rapidtool-cli.mjs`)

`respond()` mechanics: exit-3 pin (`RT_E_LLM_NOT_CONFIGURED`) at 94-95; prose classify at 96-104; if `errors.ts` cannot be imported, `code` is **omitted entirely** (117-142). Exit taxonomy: 0 ok · 1 cannot-execute/usage/validation · 2 parked HITL (ok:true) · 3 backend not-configured · 4 internal/backend runtime (`README-cli.md:287-294`).

| Site | Failure mode | Exit today | Code today | Correct code | Notes / fix |
|---|---|---|---|---|---|
| cli:183-186 | no subcommand | 1 | UNKNOWN | `RT_E_VALIDATION` | usage-class |
| cli:192 | `--project` flag missing (makeLoader) | 1 | UNKNOWN | `RT_E_VALIDATION` | usage-class |
| cli:195-197 | project file read/parse throw | 1 | `PROJECT_MISSING` (ENOENT text) or UNKNOWN | read-ENOENT → `PROJECT_MISSING`; invalid JSON/shape → `RT_E_VALIDATION` | file-exists-but-malformed has no classifier signal |
| cli:207 | `create` missing `--brief` | 1 | UNKNOWN | `RT_E_VALIDATION` | |
| cli:210 (+outer 505-512) | `saveProject` write fails (create) | 4 | UNKNOWN (or `PROJECT_MISSING` if ENOENT in msg) | `RT_E_INTERNAL` | ENOENT text-collision: a *write* ENOENT mislabels as "project missing" (gap P2-12) |
| cli:223, 247, 266, 301, 421 (+outer 511) | `saveProject` write fails (run/gate/approve/reject/ingest/verify --apply) | 4 | UNKNOWN | `RT_E_INTERNAL` | same collision |
| cli:244 | `approve` — no pending gate | 1 | UNKNOWN | `RT_E_GATE_PENDING` (re-doc) or new `RT_E_GATE_NONE` | README:322 already promises a gate-state code at exit 1 |
| cli:246 → `headless.ts:502-506` | `approve` — gate phase ≠ currentPhase (drift) | **4** (outer catch) | UNKNOWN | exit **1** + `RT_E_PHASE_ILLEGAL` | state drift is not internal; escapes the approve guard |
| cli:255 | `reject` — no pending gate | 1 | UNKNOWN | `RT_E_GATE_PENDING` (re-doc) / `RT_E_GATE_NONE` | |
| cli:258 | `reject` missing `--note` | 1 | UNKNOWN | `RT_E_VALIDATION` | |
| cli:259-264 | `reject` note < 12 chars | 1 | UNKNOWN | `RT_E_VALIDATION` | engine policy mirror `engine.ts:999` |
| cli:274 | `ingest` missing `--report` | 1 | UNKNOWN | `RT_E_VALIDATION` | |
| cli:279-282 | `ingest` — `@file` unreadable | 1 | `PROJECT_MISSING` (ENOENT) or UNKNOWN | `RT_E_PROJECT_MISSING` ("cannot be loaded", errors.ts:122) | EACCES → UNKNOWN today |
| cli:287-288 | `ingest` — report not valid JSON | 1 | UNKNOWN | `RT_E_REPORT_INVALID` | **P0-1** |
| cli:304-307 | `ingest` — ReportRejected + trail persist failed | 4 | UNKNOWN | `RT_E_INTERNAL` (primary failure = persist) | report code, if any, is secondary |
| cli:309 | `ingest` — report rejected (shape/phase) | 1 | **UNKNOWN (always)** | `RT_E_REPORT_INVALID` / `RT_E_REPORT_PHASE_MISMATCH` | **P0-1**; README-cli.md:308-310 claims these fire — they cannot (Seam A). Message examples: `report-intake.ts:66-91` |
| cli:358 | `vault` — module missing / fs write | 1 | UNKNOWN | `RT_E_INTERNAL` (module contract drift) | README-cli.md:135-136 documents exit 1; code still UNKNOWN |
| cli:372-374 | `search` — vault module missing | 1 | UNKNOWN | `RT_E_INTERNAL` | empty query pre-validated by requireArg (366) |
| cli:385-396 | `crew` — `reason:"not-configured"` | 3 | `LLM_NOT_CONFIGURED` (pin) | ✓ correct | |
| cli:385-396 | `crew` — `reason:"error"` (backend) | 4 | UNKNOWN unless prose says "timed out" | pass through `LLM_REJECTED`/`LLM_TIMEOUT` | `crew.server.ts:765-766,849-850,914-915` **drop** `completeDeepSeek`'s `res.code` — **P1-4** |
| cli:405-413 | `verify` — no `generatedSource` | 1 | UNKNOWN | `RT_E_PHASE_ILLEGAL` | README-cli.md:407 calls it validation/state error; code is UNKNOWN |
| cli:424-442 | `verify` — outcome `failed` (incl. **runner unavailable**, compile fail, code fails) | 1 | **UNKNOWN (always; no error text)** | runner-unavailable → `RT_E_RUNNER_UNAVAILABLE`; compile → `RT_E_RUNNER_FAILED`; verdict-failed → keep UNKNOWN (it is an outcome, not a fault) | **P0-2**. `verify.server.ts:365-373` collapses runner-unavailable into `compileError`, `verifyAndFixServer` returns `status:"failed"` (462-473) → agent fix-loops on an env problem |
| cli:424-442 | `verify` — outcome `error` (LLM backend: timeout/rejected/parse) | 4 | **UNKNOWN (always)** | `RT_E_LLM_TIMEOUT` / `RT_E_LLM_REJECTED` from evidence | code derives from `evidence`, which `respond()` never reads (Seam C) |
| cli:424-442 | `verify` — `not-configured` | 3 | `LLM_NOT_CONFIGURED` (pin) | ✓ correct (only LLM key gates it, `verify.server.ts:435-437`) | note: README-cli.md:325 says `RUNNER_UNAVAILABLE` typical exit 3 in verify domain — unreachable today |
| cli:458-460 | `design` — module missing / non-object tokens | 1 | UNKNOWN | `RT_E_INTERNAL` | `headless.ts:1114-1118` |
| cli:478-480 | `diagram` — unknown `--kind` | 1 | UNKNOWN | `RT_E_VALIDATION` (validate kind in CLI, or map `headless.ts:1146`) | |
| cli:478-480 | `diagram` — module missing / non-string SVG | 1 | UNKNOWN | `RT_E_INTERNAL` | |
| cli:496-498 | `doctor` — defensive catch (never throws by contract) | 4 | UNKNOWN | `RT_E_INTERNAL` | |
| cli:503 | unknown subcommand | 1 | UNKNOWN | `RT_E_VALIDATION` | usage-class |
| cli:505-512 | **outer catch** — any thrown Error (engine throws, drift, save failures) | 4 | UNKNOWN (or `PROJECT_MISSING` via ENOENT text) | `RT_E_INTERNAL`; classify the **object** (err.code fast-path) not the string | **P1-7**; `phases.ts:120`'s `err.code` dies here |

**Soft-stop rows (not `{ok:false}` but failure-path):** `run`/`gate` cannot-advance conditions surface as `ok:true` envelopes — exit **0** for `outcome:"error"` (locked/unknown-phase/priors-unsealed) and exit 2 for parked (`awaiting_hitl`/`blocked`) (`rapidtool-cli.mjs:226-237`; conditions at `headless.ts:327-328, 380-418`; outcome derivation 474-485). No code, no `ok:false` — an exit-code-driven agent misreads "Phase is locked." / "Unknown phase." as success. `events[]` + `stopped` + `outcome` are the only signals (CLI header comment 8-10 and README-cli.md:429 warn agents to check `outcome`). **Gap P1-3.**

---

## 4. Library failure-path coverage (all `{ok:false}` / code sites, `src/lib`)

| Module | Failure sites | Code present? | Verdict |
|---|---|---|---|
| `errors.ts` | registry + classify + docs | — | registry complete; matcher gap: never emits `PHASE_ILLEGAL`/`GATE_PENDING`, report branch object-only |
| `errors.test.ts` | classify tests 41-121 | — | tests only the **object** API; the CLI's string path is untested (Seam A shipped green) |
| `phases.ts:112-124` | unknown phase id throw | `err.code` property only | **dead signal** (Seam B); add classify fast-path |
| `io.ts:47-90` | 9 import-validation failures | **no** (`ImportResult`, line 19) | `VALIDATION` family; reaches CLI as prose → UNKNOWN |
| `report-intake.ts:65-91` | 7+ report-validation failures | **no** (line 50-52) | correct codes = `REPORT_INVALID` / `REPORT_PHASE_MISMATCH` (message at 89 contains "phase") |
| `headless.ts:50-55` | loadProject | throws | covered by CLI rows |
| `headless.ts:58-74` | saveProject | throws raw | CLI outer catch → 4 |
| `headless.ts:498-515` | approve guards | throws | CLI rows 244/246 |
| `headless.ts:533-568` | `ReportRejectedError` + ingest | throws, **no `code` prop** | add `code` prop (pattern of `phases.ts:120`) → P0-1 fix |
| `headless.ts:695-710, 1072-1105` | module loaders (vault/design/diagram) | throws ("contract drift") | `INTERNAL` |
| `headless.ts:831-885` | writeVault / vaultSearch | throws | `INTERNAL` / `VALIDATION` |
| `headless.ts:942-949` | verifyGeneratedSource no-source | throws | `PHASE_ILLEGAL` |
| `headless.ts:1144-1156` | buildDiagram kind guard | throws | `VALIDATION` (kind) |
| `deepseek.server.ts:174-304` | LLM failures | **yes — all 5** | NOT_CONFIGURED 174 · VALIDATION 184 · REJECTED 255/266 · TIMEOUT 292 · classify(err, REJECTED) 299. Note: 5xx provider errors → REJECTED is a documented choice (fixes/48:136); fetch-level network throw (no status) also falls to REJECTED — slight doc stretch (P2-13) |
| `exec.ts:47-102` | runner client | **yes — all 4** | UNAVAILABLE 51/89 · VALIDATION 66/78 · INTERNAL 99 |
| `node-runner.server.ts:103-246` | runner server | **yes — all 6** | UNAVAILABLE 107 · VALIDATION 115 · RUNNER_FAILED 154/191/199/210/222. MaxBuffer kill honestly ≠ timeout prose (185-194); non-timer signal ≠ timeout (215-225) |
| `tavily.server.ts:114-213` | research (keyed) | **yes — all 5** | RESEARCH_UNAVAILABLE 123/171/181/203 · VALIDATION 131/140 |
| `websearch.server.ts:305-389` | free research | **yes — all 3** | VALIDATION 313/322 · RESEARCH_UNAVAILABLE 384; per-provider degrades keep last failure text (337-340) |
| `research.ts:64-97` | research client | **yes** | VALIDATION 74/83 · INTERNAL 93 |
| `llm.ts:53-72` | LLM client | **yes** | classify(err, INTERNAL) 69 — object-based ✓ |
| `chat.ts:37-52` | chat client | **yes** | classify(err, INTERNAL) 49 ✓ |
| `chat.server.ts:176-236` | chatOnceServer | mostly | VALIDATION 189/198 ✓; **`not-configured` (181-183) has no code** → console badge-less (P2-11); deepseek failure codes forwarded 233-235 ✓ |
| `llm-tasks.ts:116-188` | LLM tasks | **yes** | forwards codes; VALIDATION 133 · REJECTED 157/181 |
| `crew.server.ts:489-509, 683-766, 849-915` | crew agents | **no — 6 sites** | drops deepseek `res.code` → P1-4 |
| `crew.ts:135-175` | crew client mirror | **no** | same |
| `verify.server.ts:388-508` | verify outcomes | **no** | `status` enum only (`failed`/`error`/`not-configured`); runner-unavailable collapsed into failed (365-373) → P0-2 |
| `algo-tools.ts:99-114, 175-192` | algo/property synthesis | **no** | engine-internal advisory; degrades (P2-10) |
| `planning.ts:200-221` | plan steps | **no** | engine-internal (P2-10) |
| `engine.ts:899-919, 999` | approveHitl guards | throws / silent no-op | autopilot-forceHuman throw (918) unreachable via headless (canAutopilot 266-280 excludes forceHuman); short-note throw (999) pre-validated by CLI (259-264) — add codes for UI paths (P2-10) |
| `engine.ts:1949-1975` | `runP6Real` | **no** | `{ok:false,result:null}` degrade — honest, engine-internal |
| `store.ts:751-763, 831, 873` | UI ingest + HITL guards | **no** | `{ok:false,error}` prose — UI domain; attach REPORT/PHASE codes (P2-10) |
| `app-data/client.server.ts:136-328` | external data connectors | **no** (`errorMessage` only) | UI-domain (P2-10) |
| `console.tsx:4158-4280` | chat rendering | consumes codes | normalizes + renders badge only when a code arrived; `WARN_TONE_CODES` 4177-4182 includes dead `GATE_PENDING`; "Uncatalogued error code" fallback 4221 |

---

## 5. Ranked gaps

### P0 — an AI agent cannot branch correctly today (or burns money doing it)

| # | Gap | Evidence | Agent impact | Fix |
|---|---|---|---|---|
| **P0-1** | Report-rejection codes never fire on the CLI; every rejected report exits 1 + `RT_E_UNKNOWN` despite README-cli.md:308-310 promising `REPORT_INVALID`/`REPORT_PHASE_MISMATCH` | Seam A; `rapidtool-cli.mjs:97-104` string-only; sole thrower `headless.ts:565` (ReportRejectedError, message prefix "Invalid report:", mismatch text `report-intake.ts:89` contains "phase") | Driver cannot distinguish "fix your report shape" from "re-submit for currentPhase" — wrong corrective loop on the exact path external agents use | (a) attach `code` prop on `ReportRejectedError` (`headless.ts:536-541`, mirroring `phases.ts:120`); (b) `respond()` pass-through `err.code`; (c) `classifyError` fast-path for `code ∈ ERROR_CODES`; (d) update `errors.test.ts` to cover the string/CLI path |
| **P0-2** | Verify: runner-unavailable masquerades as verdict `failed` (exit 1, `RT_E_UNKNOWN`); LLM timeouts/rejections as `error` (exit 4, `RT_E_UNKNOWN`) — code is UNKNOWN on **every** verify failure because payload has no `error` text (Seam C) | `verify.server.ts:365-373` → `failed`; `rapidtool-cli.mjs:424`; `VerifyOutcomeShape` `headless.ts:910-916` | Agent loops DeepSeek fix iterations (LLM cost) against an environment problem (no runner), and cannot distinguish billing (429/402) from outage from timeout | `verifyAndFixServer` pre-check `runnerAvailable()` → return runner-unavailable status/reason; CLI map outcome+evidence → code (`RUNNER_UNAVAILABLE`/`RUNNER_FAILED`/`LLM_TIMEOUT`/`LLM_REJECTED`) or have verify outcomes carry the underlying code |
| **P0-3** | 4 of 14 codes are unproducible in production (table §1): `PHASE_ILLEGAL`, `GATE_PENDING`, `REPORT_INVALID`, `REPORT_PHASE_MISMATCH` — the exact state/report codes a driver loop keys on | producers inventory §1 | Taxonomy promises a machine contract its own surfaces never emit; agents can only string-match prose | P0-1 + P1-7 fixes activate 3 of 4; assign `GATE_PENDING` at the approve/reject guards (row P1-5) |

### P1 — distinguishable only by prose or by fields agents are told to ignore

| # | Gap | Evidence | Fix |
|---|---|---|---|
| **P1-3** | `run`/`gate` cannot-advance exits **0 with `ok:true`** and no code (locked / unknown phase / priors-unsealed / illegal transition); drift inside `approve` exits **4** (internal family) | `rapidtool-cli.mjs:226-237,505-512`; `headless.ts:380-418`; `headless.ts:502-506` | `outcome:"error"` envelopes: exit 1 + `code` (state family); drift → exit 1 + `RT_E_PHASE_ILLEGAL` |
| **P1-4** | Crew/verify LLM failure codes dropped at wrapper boundaries | `crew.server.ts:765-766,849-850,914-915` map `res.error` but not `res.code` | forward `code` from `completeDeepSeek` results; CLI crew branch then needs no prose classify |
| **P1-5** | approve/reject "no pending gate" (exit 1, UNKNOWN) and README's promised gate-state code | `rapidtool-cli.mjs:244,255`; README-cli.md:322 | assign `RT_E_GATE_PENDING` (re-doc meaning to "HITL-gate state mismatch") or add `RT_E_GATE_NONE` (additive-safe); agent action: run `gate`/`summary` first |
| **P1-6** | Verify `no generatedSource` (exit 1) classified UNKNOWN | `rapidtool-cli.mjs:405-413`; `headless.ts:945` | `RT_E_PHASE_ILLEGAL` (state ordering), matching README-cli.md:189-190's own wording |
| **P1-7** | `classifyError` ignores thrown `.code = "RT_E_*"` and CLI outer catch classifies prose of a 4-level-cause error | `phases.ts:119-121`; `errors.ts:83-104`; `rapidtool-cli.mjs:505-512` | fast-path: `if (typeof link.code === "string" && ERROR_CODES.includes(link.code as ErrorCode)) return link.code` before the errno check; CLI catch → `classifyError(err, "RT_E_INTERNAL")` on the **object** |
| **P1-8** | Usage/arg + module-missing + project-file-invalid failures all classify UNKNOWN at exit 1 (12 sites in §3) | rows §3 | site-level `code` assignment in `respond()` callers: `VALIDATION` (args/usage/JSON-of-project), `INTERNAL` (missing sibling modules/fs write), `REPORT_INVALID` (ingest JSON) |
| **P1-9** | Tests encode only the object API; CLI string path + empty-text + `.code` fast-path untested | `errors.test.ts:41-121` | add string/empty/prose coverage (the actual CLI contract) |

### P2 — UI/engine-internal or niche (fix opportunistically)

| # | Gap | Evidence |
|---|---|---|
| P2-10 | Code-less `{ok:false}` in UI/engine-internal surfaces: `store.ts:751-763,831,873`, `algo-tools`, `planning`, `app-data/client.server`, `engine.ts:999,1953-1973`, `crew.ts:175` | §4 rows |
| P2-11 | Chat `not-configured` returns reason-only, no code (`chat.server.ts:181-183`); console renders badge-less rows though `WARN_TONE_CODES` anticipates the code (`console.tsx:4177-4182`) | mirror `deepseek.server.ts:174` |
| P2-12 | Text-only ENOENT classify cannot distinguish read (→ `PROJECT_MISSING` correct) from **write** ENOENT (→ mislabeled `PROJECT_MISSING`; should be `INTERNAL`) on save failures | `rapidtool-cli.mjs:96-104` vs save sites 210/223/247/266/301/421 |
| P2-13 | fetch-level network failure (retries exhausted, no HTTP status) classifies to `LLM_REJECTED` at `deepseek.server.ts:299` — doc says "provider refused (401/402/429/params/empty)" | `errors.ts:164-168`; suggest `INTERNAL` fallback or doc note |
| P2-14 | README drifts: `RUNNER_UNAVAILABLE` "typical exit 3 (verify/exec domain)" unreachable (README-cli.md:325); verify failure payload documented with an `error` string that the code never emits (README-cli.md:205-206 vs cli:424); exit-3 pin comment assumes all exit-3 = LLM not-configured (cli:92-95 — true today, brittle if verify ever exits 3 for runner) | cross-ref §3 |
| P2-15 | `GATE_PENDING` sits in console warn-tone set with no producer; `PHASE_ILLEGAL` doc (errors.ts:124-128) describes engine paths that never surface it | §1 |

---

## 6. Numbers at a glance

- Registry: **14 codes** (`errors.ts:22-37`), doc-complete + test-enforced (`errors.test.ts:124-145`).
- Live-producible on a CLI envelope today: **3** (`PROJECT_MISSING`, `LLM_NOT_CONFIGURED`, `LLM_TIMEOUT`-by-prose, `UNKNOWN`); across all surfaces: **10**; never producible: **4** (P0-3).
- CLI `{ok:false}` respond sites mapped: **23** (plus ~6 `saveProject`/engine throw paths that reach the outer catch) — correct code at only **2** (exit-3 pin sites); correct code *by accident* at 2 more (ENOENT read paths); everywhere else `RT_E_UNKNOWN` or a mislabeled family.
- Module-level `{ok:false}` sites: fully coded **10 modules** (chat.server exception: not-configured is reason-only, §4); code-less **12 surfaces** (mostly engine/UI domain or wrapper drops).
- Ranked gaps: **3 P0, 7 P1, 6 P2**.

**Recommended sequencing for the final audit wave:** fix P0-1 (headless throw-site code + CLI object classify + `classifyError` `.code` fast-path) and P0-2 (verify runner pre-check + outcome-derived codes) first — both are small, local edits that activate the exact codes external agents were promised; then P1-3/P1-5 to make `run/gate/approve` state failures honest; the rest are mechanical site-level assignments.
