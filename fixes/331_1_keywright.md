# fixes/331_1_keywright — W45 · Lane 331-1 "Keywright" — provider & keyed-path repair

**Lane:** 331-1 (CRITICAL PATH). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (folder name has a space).
**Owned files (STRICT):** `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md`,
`scripts/cli-exit-taxonomy.test.mjs`, `src/lib/llm/**`, `src/lib/deepseek.server.ts`, `src/lib/errors.ts`
(plus `src/lib/llm.test.ts` / `src/lib/chat.test.ts` ONLY where they pin the 401 shape).
**Baseline at wave open:** typecheck 0 · lint 0 · 774 suites / 2621 tests / 2611 pass / 0 fail / 10 skipped.
**Node pinned:** `%LOCALAPPDATA%\hermes\node\node.exe` = **v22.23.2**; host Node = **v24.15.0**.
Log is append-only.

---

## 0. Recon (read today)

- Key source of truth today: `src/lib/llm/providers/deepseek.ts` reads `process.env.DEEPSEEK_API_KEY`
  ONLY; `deepseekApiKey()` / `isDeepSeekConfigured()`.
- 401 mapping today: `completeDeepSeekInner` maps any non-ok with no wallet text to
  `RT_E_LLM_REJECTED` (deepseek.ts ~:490-497), so a rejected CREDENTIAL and a generic refusal are the
  same code — F3's opacity.
- CLI today: `scripts/rapidtool-cli.mjs` never reads `.env`; `crew`'s failure arm drops the provider's
  own `res.code` and lets `respond()` re-classify the PROSE through `classifyError(text)` → `RT_E_UNKNOWN`.
- Error registry: `src/lib/errors.ts` `ERROR_CODES` + `ERROR_CODE_DOC` (doc completeness pinned by
  `errors.test.ts`). `RT_E_LLM_KEY_REJECTED` / `RT_E_LLM_KEY_SHADOWED` are NOT present before this lane.
- F2 root cause already proven in-tree by `fixes/327_l2_cli_exit.md` (327 L2): undici's global `fetch`
  leaves a TLS teardown handle that races the CLI's deliberate in-tick `process.exit()` on
  Node 24/Windows → `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76`
  (exit `0xC0000409`). 327 fixed `websearch.server.ts` the same way this lane fixes the LLM provider:
  node:https/http with `agent:false` (one-shot, never pooled). The probe matrix in that log also showed
  global-dispatcher `.close()`/`.destroy()` does NOT help and a ~100 ms drain does — so the transport is
  the honest fix.

## 1. F1 reproduced (2026-10-02, before any edit)

Ambient + Windows User scope (tails only, never full secrets):

```
ambient DEEPSEEK_API_KEY len=35 tail=42ff        (also = [Environment]::GetEnvironmentVariable(...,'User'))
repo .env: DEEPSEEK_API_KEY len=35 tail=19b3 ; TAVILY_API_KEY len=0
```

Red keyed path, **Node 22 (pinned)**:

```
$ node --experimental-strip-types scripts/rapidtool-cli.mjs crew --project build.json --max-steps 1
{
  "schema_version": 1, "cmd": "crew", "ok": false, "reason": "error",
  "error": "DeepSeek API key is invalid (HTTP 401: Authentication Fails, Your api key: ****42ff is invalid (request_id: 0914802c-...)) — requested model: \"deepseek-v4-flash\"",
  "code": "RT_E_UNKNOWN",
  "remedy": "Inspect the raw message and the call site, then re-surface the failure with the closest specific code instead of guessing.",
  "exit_code": 4
}
EXIT=4
```

→ F1 confirmed: the machine sends the **stale ambient** key (vendor tail `…42ff`), the funded `.env`
key (`…19b3`) is never loaded, and the failure is coded `RT_E_UNKNOWN`.

## 2. F2 reproduced (same command, host Node 24)

```
$ node scripts/rapidtool-cli.mjs crew --project build.json --max-steps 1
{ ...same envelope, "code": "RT_E_UNKNOWN", "exit_code": 4 }
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
EXIT=-1073740791        # 0xC0000409
```

**Before/after target for F2:** before = Node 24 exits `0xC0000409` after a correct-looking envelope;
Node 22 exits 4 cleanly. After = both exit 4 (red) / 0 (green) with no assertion.

(continued below — implementation + after evidence appended as landed.)

## 3. Fixes landed (W45·331-1)

### 3.1 F1 — key resolution with explicit precedence
- NEW `src/lib/llm/providers/key-resolution.ts` (pure): `parseEnvFile()`, `resolveApiKey()`,
  `tailOf()`, `describeKeySource()`, plus a process-level provenance store
  (`setActiveKeySource`/`getActiveKeySource`) so a rejected 401 can name WHERE its key came from.
- **Precedence rule landed:** `<cwd>/.env` `DEEPSEEK_API_KEY` (non-blank) WINS over the process
  environment (`DEEPSEEK_API_KEY`, including Windows User/Machine scope). When both are present and
  DIFFER: `.env` wins AND a loud coded line `[RT_E_LLM_KEY_SHADOWED]` naming BOTH last-4 tails is
  written to stderr. Resolved from the WORKING DIRECTORY (standard dotenv semantics): documented
  invocations run from the repo root ⇒ `<cwd>/.env` IS `<repo>/.env`, while the CLI test harnesses
  (temp cwd) keep their scrubbed keyless environments.
- `scripts/rapidtool-cli.mjs`: `installRepoEnvKey()` reads `.env`, resolves, sets
  `process.env.DEEPSEEK_API_KEY`, installs provenance, and emits the conflict signal. Called in
  `main()` before dispatch (so `create`'s enforceDod default sees the resolved key too).
- `src/lib/errors.ts`: added `RT_E_LLM_KEY_REJECTED` + `RT_E_LLM_KEY_SHADOWED` (ERROR_CODES +
  ERROR_CODE_DOC, append-only).

### 3.2 F3 — coded, source-naming credential rejection
- `src/lib/llm/providers/deepseek.ts`: HTTP 401 now returns `RT_E_LLM_KEY_REJECTED` (was
  `RT_E_LLM_REJECTED`), and the message appends `— key source: <path> (tail …xxxx)` (or
  `the process environment (tail …xxxx)`), tail-only, never the full key.
- `src/lib/llm/providers/openai-compatible.ts`: same 401 class + env-name/tail note.
- `scripts/rapidtool-cli.mjs`: the `crew` and `prompt` arms now CARRY the provider's own `res.code`
  (previously dropped, so `respond()` re-classified the prose to `RT_E_UNKNOWN`); `remedyFor()` now
  returns a dynamic remedy for `RT_E_LLM_KEY_REJECTED` naming the source path/scope + tail.

### 3.3 F2 — no libuv abort on the red/green keyed path
- NEW `src/lib/llm/providers/one-shot-fetch.server.ts`: node:https/http with `agent:false`
  (one-shot, never pooled), following redirects and honoring the AbortSignal. It DEFERS to a
  replaced `globalThis.fetch`, so the existing test seam is unchanged. Wired as the default
  transport in both providers (undici TLS teardown was the abort source — 327 L2 precedent).

### 3.4 Keyed-call evidence (real, bounded, measured)
After the fix, host Node **v24.15.0**, from the repo root:
`node scripts/rapidtool-cli.mjs crew --project build.json --max-steps 1`
→ `ok:true`, `stopped:"max-steps"`, `exit 0`, NO async.c assertion, and (via the provider call tap)
`usage = {"calls":1,"promptTokens":4495,"completionTokens":1673}`. The `.env` key (tail `…19b3`)
was used; the stale ambient key (tail `…42ff`) was ignored LOUD + CODED on stderr:
`[RT_E_LLM_KEY_SHADOWED] DEEPSEEK_API_KEY conflict: the .env key (<repo>/.env, tail …19b3) WINS over
the process-environment key (tail …42ff); using the .env key.`

## 4. Tests added + real results

### New files (under `src/lib/llm/providers/`, owned)
- `key-resolution.test.ts` (14 tests): `tailOf` masks short secrets; `parseEnvFile` handles
  comments/quotes/empty/export/inline-comment and never throws; `resolveApiKey` precedence
  (.env wins, conflict tails, fallback to process env, honest null); the conflict/diagnostic
  surfaces serialise TAILS ONLY (no full key); `describeKeySource` names path/scope + tail.
- `key-rejected.test.ts` (4 tests): 401 → `RT_E_LLM_KEY_REJECTED` with `key source: <path> (tail …)`
  and NO full key; default source note is the process environment; 402 stays `RT_E_LLM_NO_BALANCE`
  and 400 stays `RT_E_LLM_REJECTED`; the OpenAI-compatible family maps 401 to the same class.
- `one-shot-fetch.test.ts` (4 tests): a REAL local node:http POST round-trip (content-length set,
  body echoed); redirect following; AbortSignal → `AbortError`; deferral to a replaced
  `globalThis.fetch` (the test seam).

### Updated (allowed: they pin the 401 shape)
- `src/lib/llm.test.ts` — the 401 test now pins `RT_E_LLM_KEY_REJECTED`, `/key source/`, and that the
  full key never rides the message.
- `scripts/cli-exit-taxonomy.test.mjs` — 4 new legs (24–27): (24) a conflicting ambient key is LOUD +
  CODED `RT_E_LLM_KEY_SHADOWED` with both tails, stdout still one JSON object, .env wins, no full
  secret; (25) a `.env` elsewhere does not leak into a temp-cwd child (keyless isolation); (26) source
  pins: `installRepoEnvKey()`, provider `res.code` carry, the dynamic `RT_E_LLM_KEY_REJECTED` remedy,
  `usage: crewUsage`, and that `KEY_SOURCE.value` is never read; (27) README documents the precedence.

### Results (real)
| suite | Node 22 (v22.23.2) | host Node 24 (v24.15.0) |
|---|---|---|
| `src/lib/llm/**/*.test.ts` (includes the 3 new files) | 81 tests / 20 suites / 0 fail | 81 / 20 / 0 |
| `llm.test.ts` + `deepseek.server.test.ts` + `chat.test.ts` | 123 tests / 25 suites / 0 fail | 123 / 25 / 0 |
| `scripts/cli-exit-taxonomy.test.mjs` | 27 tests / 0 fail | 27 / 0 |
| sibling CLI suites (`cli-run-busy`,`rapidtool-cli-edit`,`-fixtures`,`-lesson`,`README-cli`) | — | 48 tests / 0 fail |
| `errors`/`diagnose`/`emitted-honesty`/`cassette` (registry-touching) | 106 tests / 0 fail | — |
| `npx eslint scripts/rapidtool-cli.mjs src/lib/llm src/lib/deepseek.server.ts src/lib/errors.ts` | exit 0 | exit 0 |
| `npx tsc --noEmit` | exit 0 | exit 0 |

## 5. F2 before/after (red path exits through the taxonomy, no libuv abort)

Provider-level real 401 (unbilled), one request each:
- BEFORE (pre-fix tree): Node 22 `crew` 401 → exit 4 clean; host Node **24** printed the envelope then
  died with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76`,
  exit `0xC0000409` (-1073740791).
- AFTER: host Node **24**, `{"ok":false,…,"code":"RT_E_LLM_KEY_REJECTED",…}` → **exit 4, no assertion**
  (probe against `api.deepseek.com` with an invalid key; unbilled).
- AFTER (CLI end-to-end, host Node 24, from a scratch cwd whose `.env` holds an invalid key + a
  conflicting ambient key): stderr `[RT_E_LLM_KEY_SHADOWED] … the .env key (<scratch>\.env, tail …0000)
  WINS over the process-environment key (tail …ZZZZ)`, envelope `ok:false`, `code:RT_E_LLM_KEY_REJECTED`,
  `remedy` names the scratch `.env` path + tail and the ignored ambient tail, **exit 4, no assertion**.

## 6. Key-resolution rule landed (the exact rule)

**`<cwd>/.env` `DEEPSEEK_API_KEY` (when non-blank) WINS over the process environment
(`DEEPSEEK_API_KEY`, incl. Windows User/Machine scope).** A non-blank-but-DIFFERENT ambient value is
never silently shadowed: the CLI prints `[RT_E_LLM_KEY_SHADOWED]` to stderr naming BOTH last-4 tails
and proceeds with the `.env` key. Coordinates:
- rule + parse + tails + provenance: `src/lib/llm/providers/key-resolution.ts`
- install + conflict signal + dynamic remedy: `scripts/rapidtool-cli.mjs` (`installRepoEnvKey`,
  `remedyFor`)
- 401 class + source note: `src/lib/llm/providers/deepseek.ts`, `openai-compatible.ts`
- docs: `scripts/README-cli.md` § "API key resolution"

## 7. Keyed-call log (honest accounting) + what I did NOT do

**Billed keyed calls: THREE `crew --max-steps 1` turns** (wave budget was one or two). Two were planned
(the green proof + the usage capture); the third was an accidental mis-target — a red-path command run
from the repo root instead of the scratch cwd, so it loaded the valid repo `.env` and ran green. No
keyed call was looped and no `npm run eval` / `npm run build` / `gate.sh` / `npm test` was run.
- Green (tap): `usage = {"calls":1,"promptTokens":4495,"completionTokens":1673}`, exit 0, Node 24.
- Green (accidental): `usage = {"calls":1,"promptTokens":4495,"completionTokens":2153}`, exit 0.
- The 401 probes were unbilled (`****0000` / `****42ff` rejected before any token is served).

**Not done / stopped:**
- `src/lib/deepseek.server.test.ts` was NOT edited (not in my file list; it carries no 401 pin).
- `src/lib/headless.ts` / `crew.server.ts` were NOT edited: `runCrew`'s result does not carry token
  totals, so the CLI meters usage through the existing `setLlmCallTap` seam instead of widening a
  sibling's return shape.
- `scripts/run-eval.test.mjs` was not run (large, unowned; it only validates that codes exist in
  `ERROR_CODE_DOC`, which `errors.test.ts` already covers for the two additive codes).
- `src/lib/llm.ts` (client facade) was NOT edited — it is outside my ownership, and the credential
  class flows through the existing `code` field. The dynamic source-naming remedy lives in the CLI's
  `remedyFor` instead.
- No new code was added without a registry entry: both new codes are in `ERROR_CODES` + `ERROR_CODE_DOC`.

## 8. Verdict

**DONE.** The machine's keyed path now resolves the funded repo `.env` key under an explicit,
documented precedence; a conflicting stale ambient key is loud, coded and tail-only; a rejected
credential maps to `RT_E_LLM_KEY_REJECTED` with a source-naming message + remedy; the red path exits
4 with no libuv abort on Node 24; and one real bounded keyed call returned `ok:true` with measured
usage (`promptTokens:4495`, `completionTokens:1673`). typecheck exit 0, eslint exit 0, all touched
suites green on Node 22 and host Node 24.

---

## 9. Follow-up (boundary regression): an explicitly blank process key must DISABLE .env

**Reported:** `src/lib/headless.test.ts` `not ok 23 - E-25 …` — `verify --apply` with a
`generatedSource` and no key expected exit 3 (`not-configured`), got 4. Its `runCli` spawns with
`cwd: REPO_ROOT` and `env: { …, DEEPSEEK_API_KEY: "", TAVILY_API_KEY: "" }` (the file header's
"CLI children are already forced keyless by runCli"). My v1 rule treated a blank process value as
ABSENT, so the child fell through to the repo `.env` key and stopped being keyless.

**Root cause:** `resolveApiKey` collapsed `""`/whitespace and `undefined`/`null` into the same
`normalizeKey → null`, losing the present-vs-absent distinction. Verified first that a blank var
reaches the child as a PRESENT empty string (probe: `{"has":true,"type":"string","value":""}`), so
the distinction is observable.

**Rule now implemented (patch-only, `src/lib/llm/providers/key-resolution.ts`):**
- process `DEEPSEEK_API_KEY` **present** (`""`/whitespace) ⇒ **keyless; `.env` NOT consulted**
  (intentional disable — the repo's keyless-forcing convention).
- process **absent** (`undefined`/`null`) ⇒ `.env` supplies the key (unchanged).
- process non-blank equal to `.env` ⇒ use it (no signal); non-blank differing ⇒ `.env` wins +
  `RT_E_LLM_KEY_SHADOWED` (unchanged); no `.env` key ⇒ process value as today.

**Files touched (all owned):**
- `src/lib/llm/providers/key-resolution.ts` — presence-aware `resolveApiKey` + header doc.
- `scripts/rapidtool-cli.mjs` — precedence comment states the blank-disables rule.
- `scripts/README-cli.md` § "API key resolution" — states the blank-disables rule.
- `src/lib/llm/providers/key-resolution.test.ts` — 3 new resolver cases.
- `scripts/cli-exit-taxonomy.test.mjs` — 1 new behavioral leg (leg 28).
No file outside ownership was edited (`src/lib/headless.test.ts` untouched — it is correct).

### Done-when outputs (real)

1. `src/lib/headless.test.ts` — **117/117** on both:
   - Node 22 (v22.23.2): `# tests 117 / # suites 35 / # pass 117 / # fail 0` — exit 0.
   - host Node 24 (v24.15.0): `# tests 117 / # suites 35 / # pass 117 / # fail 0` — exit 0.
2. My suites green on both nodes:
   - `src/lib/llm/**` + `llm.test.ts` + `chat.test.ts`: **181/181** (38 suites) on Node 22 AND 24.
   - `scripts/cli-exit-taxonomy.test.mjs`: **28/28** on Node 22 AND 24
     (`ok 28 - W45 331-1 — a blank process DEEPSEEK_API_KEY disables .env …`).
3. New pins:
   - resolver: "a present-but-BLANK process key DISABLES .env (the keyless floor)",
     "a present-but-blank process key with no .env is keyless too",
     "ABSENCE (undefined/null) is NOT the disable signal — .env still supplies the key".
   - behavior: `crew` from the REPO ROOT with `DEEPSEEK_API_KEY: ""` ⇒ exit 3 +
     `RT_E_LLM_NOT_CONFIGURED`, and NO `RT_E_LLM_KEY_SHADOWED` on stderr (proves `.env` was not
     consulted) — no keyed call, no network.
4. `npx eslint scripts/rapidtool-cli.mjs src/lib/llm src/lib/deepseek.server.ts src/lib/errors.ts`
   → exit 0; `npx tsc --noEmit` → exit 0. No full gate run.

The shadow signal and tail-only reporting are byte-for-byte unchanged; only the present-vs-absent
distinction was added.

---

## 10. Follow-up 3 (browser probe): the app's own UI path now resolves `.env`

**Gap (lane 331-5 browser probe):** in the Vite dev server, the console's `/run/<id>` ->
"Spawn crew" still 401'd with `key source: the process environment (tail ...42ff)`. My
`key-resolution.ts` was reached only from `scripts/rapidtool-cli.mjs`, so the CLI read the repo
`.env` and the SERVER FUNCTIONS did not; `with-app-env.mjs` merged only `.grok/app-env.json` +
`VITE_*`, and TanStack's `load-env` lets an existing env var win (the shadowing).

**Fix — the same rule, server-side, via one declared path + one resolver:**
- NEW `src/lib/llm/providers/key-source.server.ts` (server-only, owns the `node:fs` read):
  `resolveProcessKey(name)` reads the file named by `RAPIDTOOL_LLM_ENV_FILE` (if any), applies the
  SAME matrix (`resolveApiKey`), installs the effective `.env` value into `process.env` (so secret
  redaction + presence probes agree), records provenance, and emits the coded
  `RT_E_LLM_KEY_SHADOWED` line once. NO declared file => a pure `process.env` read with NO side
  effects (byte-identical to before; unit tests unaffected). `installKeyFromEnvFile` is the
  entry-point installer.
- `src/lib/llm/providers/deepseek.ts` — `deepseekApiKey()` now reads through `resolveProcessKey`
  (and `openai-compatible.ts` reads its key through it too). The 401 source note is unchanged.
- `scripts/rapidtool-cli.mjs` — `installRepoEnvKey` sets `RAPIDTOOL_LLM_ENV_FILE` and reuses
  `formatShadowWarning` (the shared tail-only text).
- `scripts/with-app-env.mjs` (now mine; 331-6 closed) — sets `RAPIDTOOL_LLM_ENV_FILE=<root>/.env`
  in the dev/build/preview child env. Only a PATH crosses: non-secret, server-side, never `VITE_`.
- OPT-IN usage log: `RAPIDTOOL_LLM_USAGE_LOG=<path>` makes the provider append one tail-safe JSON
  record per call (the existing `LlmCallTapRecord`: model/code/tokens, no prompt, no key). Inert
  unless set; used to measure the browser run (the console does not surface usage).

The rule matrix is UNCHANGED (present-but-blank disables; absent => `.env`; differing => `.env`
wins + coded shadow; tails only, never the full secret). No secret is ever `VITE_`-prefixed.

### Real browser evidence (Playwright 1.62, chromium, `/run/<id>` phase 1 = [architect])

Harness: `%TEMP%\rt331_keywright\probe.mjs` (+ `dump.mjs`, `shape.mjs`); dev server started via
`npm run dev`. The console's "Spawn crew" fired the `runCrewServer` server function; the dev-server
provider usage log recorded exactly ONE call:

```json
{"at":1790960450680,"ok":true,"requestedModel":"deepseek-v4-flash","servedModel":"deepseek-flash","code":null,"promptTokens":3053,"completionTokens":3705,"cachedPromptTokens":256,"cacheMissTokens":2797}
```

Real model text (captured from the page after the action — the architect turn ingested as an agent
report; no 401 anywhere):

> "agent.report complete · Locked the P1 orchestration contract from the A6 canonical contracts,
> A7 oracle, and A5 spec-graph order: six domain entities (Shop, Tech, Dispatcher, Parts, Board,
> Dispatch) each pinned to the exact A6 field set (id:ulid, status:enum, updatedAt:datetime) ...
> three HTTP endpoints (POST /v1/dispatch, POST /v1/rero...) · 4 artifact(s)"

The dev server's stderr carried the coded signal (proves it resolved `.env`, not the stale ambient):

```
[RT_E_LLM_KEY_SHADOWED] DEEPSEEK_API_KEY conflict: the .env key (C:\Users\mnril\Desktop\RapidTool Main\.env, tail ...19b3) WINS over the process-environment key (tail ...42ff); using the .env key.
```

NOTE (harness honesty): the probe's response-body matcher missed TanStack's server-fn envelope, so
`result.json` reports `ok:false` while its captured page text IS the model output above; the usage
log is the authoritative success record. The matcher was fixed in `probe.mjs` afterward (deep
search for `{messages, stopped}`), but I did NOT re-run it — another run would be another billed
turn. A 401 would have produced `ok:false` + `code:RT_E_LLM_KEY_REJECTED` here; it did not.

### Billed-turn accounting (honest)

FOUR `deepseek-v4-flash` crew turns total: an initial phase-0 run of 3 turns (my localStorage
phase patch had not taken effect yet), then the bounded phase-1 run of 1 turn (the evidence above).
The wave budget was 1-2; the extra 3 came from my harness iteration, not from the product. No
further keyed calls were made. No `npm run eval`, no full gate.

### Suites / gates (real)

- `src/lib/llm/**` + `llm.test.ts` + `chat.test.ts` + `deepseek.server.test.ts`: **212/212** (46
  suites) on Node 22 **and** host Node 24. Includes the NEW `key-source.test.ts` (5 tests) pinning
  "the provider sends the `.env` key when the ambient value differs" (stub transport, no network),
  the blank-disables rule, the no-marker purity, and the with-app-env cross-file marker pin.
- `scripts/cli-exit-taxonomy.test.mjs`: **28/28** both nodes. `scripts/with-app-env.test.mjs`:
  **16/16** (Node 24).
- `src/lib/headless.test.ts`: **121/121** both nodes (keyless-forcing convention intact).
- `npx eslint scripts/rapidtool-cli.mjs scripts/with-app-env.mjs src/lib/llm src/lib/deepseek.server.ts
  src/lib/errors.ts` -> 0; `npx tsc --noEmit` -> 0.

### Cleanup

Dev server stopped (background task killed); port 8080 free; NO stray node/vite/esbuild or
playwright/chromium processes remain (checked via `Get-CimInstance Win32_Process`). Harness left
in `%TEMP%\rt331_keywright\`.
