# 340-7 (verifier A) — adversarial re-derivation of the three NEW capabilities

**Role:** independent verifier A for the 340 wave. **Root:** `C:\Users\mnril\Desktop\RapidTool Main`
(git `main`, HEAD `a097fa8` + the uncommitted wave). **Runtimes:** host `node` v24.15.0 and
`& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2. **No keyed LLM calls. No
`git checkout/stash/reset/apply`. No edits to `src/**`, `scripts/**`, or `fixes/**` other than this
log.** All adversarial harnesses live in `%TEMP%\rt340_va\` and import the repo modules read-only.
The full gate was **not** run (the boundary owner runs it concurrently); only targeted test files.

Scope reviewed: `fixes/340_1_mcp.md`, `fixes/340_4_cassette.md`, `fixes/340_6_emitted-ui.md`,
`AGENTS.md`, and the live bytes of `src/lib/mcp.server.ts`, `src/lib/mcp/stub-server.ts`,
`src/lib/cassette.ts`, the two provider wrappers, and `src/lib/scaffold.ts` (+ their test files).

---

## Baseline (both runtimes, TAP)

```
node --experimental-strip-types --test --test-reporter=tap src/lib/mcp.server.test.ts
# tests 18  # pass 18  # fail 0  # skipped 0      (v24.15.0 AND v22.23.2, exit 0)

node --experimental-strip-types --test --test-reporter=tap src/lib/cassette.test.ts
# tests 47  # pass 47  # fail 0  # skipped 0      (both runtimes, exit 0)

node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts
# tests 69  # pass 69  # fail 0  # skipped 0      (both runtimes, exit 0)
```

Baselines match all three lane logs exactly.

---

## Claim 1 — 340-1 MCP stdio client (`src/lib/mcp.server.ts`) — **CONFIRMED, with two bounded holes**

### 1a. Enablement gate: off ⇒ `RT_E_MCP_DISABLED`, no child, no `tools`/`serverInfo` key — CONFIRMED

Independent probe (`%TEMP%\rt340_va\gate-driver.ts`) passed `env: {}` and a command that would drop
a sentinel file **if the child were spawned**:

```
PROBE disabled.result :: {"code":"RT_E_MCP_DISABLED","hasTools":false,"hasServerInfo":false}
PROBE disabled.sentinelExists :: false
```

No `tools`/`serverInfo` key, and the sentinel proves **the child was never spawned** (if the gate
leaked, the response would have been `RT_E_RUNNER_FAILED` from the spawn path).
Pure-function gate: `mcpEnabled` is ON only for `1`/`true` (case-insensitive), OFF for
unset/empty/false/0/anything else (suite tests 1–2).

### 1b. Child-env scrub (parent `DEEPSEEK_API_KEY` must not reach child; `PATH` must) — CONFIRMED

Set `DEEPSEEK_API_KEY`, `XAI_API_KEY`, `RAPIDTOOL_MCP_ENABLED`, `RAPIDTOOL_CASSETTE_MODE` in the
parent, then asked the spawned child (the stub's `env` tool) for `Object.keys(process.env)`:

```
PROBE env.leakedKeys :: []
PROBE env.hasPATH :: true
PROBE env.valueLeak :: false
```

Child env is built from `scrubbedEnv()` (`node-runner.server.ts:220`), an allowlist; the secret keys
and the MCP switch are absent. **Note:** `options.env` selects only the *gate*; the child env always
comes from the real parent via the allowlist — so even a synthetic `env:` argument cannot inject
anything into the child. The in-repo suite test `never forwards a secret into the child environment`
pins the same result (18/18).

### 1c. Unlisted tool refused; listed read-only tool works — CONFIRMED

```
PROBE phantom.callTool :: RT_E_VALIDATION  "did not list a tool named "phantom""
PROBE case("echo")   :: {"ok":true}
PROBE write_thing.callTool :: RT_E_VALIDATION "was not advertised read-only"
```

`callTool` re-lists at call time, so the "listed + read-only" guarantee is checked against what the
server actually advertised, never a cache. A tool advertised **only in `initialize`** (my stub's
`initialize` result carries a `phantom` entry that `tools/list` omits) is still refused — the client
never reads a tool name from `initialize`.

### 1d. Timeout / malformed / unknown-id / non-zero-exit — each a coded refusal, no partial pass — CONFIRMED

Suite tests pass 18/18 on both runtimes, covering: `hang-list` timeout ⇒ `RT_E_RUNNER_FAILED`
`/timed out after 5000ms/`; `malformed-json` ⇒ `RT_E_VALIDATION` `/not valid JSON/`; `unknown-id` ⇒
`RT_E_VALIDATION` `/unknown id/`; `error-response` ⇒ `RT_E_RUNNER_FAILED`; `exit-nonzero` ⇒
`RT_E_RUNNER_FAILED` `/exited/`; spawn failure ⇒ `RT_E_RUNNER_FAILED`.

### 1e. `tools/list` never fabricates — CONFIRMED

A stub whose `tools/list` result has **no `tools` array**:

```
PROBE notools.listTools {"ok":false,"code":"RT_E_VALIDATION","error":"tools/list result had no tools array"}
PROBE notools.callTool {"ok":false,"code":"RT_E_VALIDATION","error":"tools/list result had no tools array"}
```

An empty-but-present array is honestly reported as `{ok:true, tools:[]}` (server listed nothing),
not fabricated entries.

### Defeat attempts — results

| Attempt | Result |
|---|---|
| tool name differing by case/whitespace (`Echo`, `ECHO`, `" echo"`, `"echo "`, `"echo\t"`) | **all refused** `RT_E_VALIDATION` (exact match only); `echo` works |
| `tools/call` for an initialize-advertised but unlisted tool (`phantom`) | **refused** |
| non-zero exit / malformed / unknown-id / oversized | **coded refusal** |
| reply larger than the cap (5 MiB line, default 4 MiB cap) | `RT_E_VALIDATION` `"exceeded the 4194304-byte frame cap"` |
| string / null `id` | `RT_E_VALIDATION` `"unknown id"` |
| **duplicated id** (correlated valid reply, then a second reply with the same id) | **HOLE (bounded):** the first `listTools()` returns `{"ok":true,...}`; the duplicate only poisons later requests |
| **valid line then garbage** | **HOLE (bounded):** the first `listTools()` returns `{"ok":true}`; the garbage surfaces only on the next request |

Exact reproduction (Node 24 and Node 22 identical):

```
PROBE dup-id.listTools  :: {"ok":true,"tools":["echo","write_thing","env"]}
PROBE dup-id.listTools2 :: {"ok":false,"code":"RT_E_VALIDATION","error":"MCP reply carried an unknown id (2); ..."}
PROBE vtg.listTools     :: {"ok":true}
PROBE vtg.callTool      :: {"ok":false,"code":"RT_E_VALIDATION","error":"MCP reply was not valid JSON: ..."}
```

**Why:** `StdioMcpClient.onStdout` resolves a pending request synchronously as it consumes each
line; an unsolicited duplicate/unknown id or garbage on a *later* line calls `failAll`, but that only
rejects **still-in-flight** requests (there are none — the correlated one already resolved). So a
single-call consumer (`connectMcpServer` + one `listTools()`) accepts a genuine reply from a server
that has, in the same breath, emitted a protocol violation. **Scope/severity:** bounded — the server
cannot forge an unlisted tool (call re-lists), and the F1 round-trip `runReadOnlyToolRoundTrip`
follows `listTools` with a `tools/call`, so the poison kills that next request and the round-trip
fails closed. The lane log's claim "each fail the whole client … never a partial pass" is true only
for the four *named* conditions; it does not hold for these two after-the-fact violations.

---

## Claim 2 — 340-4 cassette (T5.7 wiring) — **CONFIRMED for the wrapped seam; two integrity gaps (one documented, one real)**

### 2a. Mode precedence — CONFIRMED

```
PROBE off.identity  :: {"activeNull":true,"unsetSame":true,"offSame":true,"blankSame":true,"selMode":"off"}
PROBE off.winsOverTape :: {"same":true}
PROBE sloppy("1"|"true"|"RECORD"|"recrod") :: {"called":0,"ok":false,"code":"RT_E_VALIDATION"}   (all four)
PROBE replay.noTape :: {"ok":false,"code":"RT_E_VALIDATION"}
```

Unset/blank/`off` ⇒ `wrapWithActiveCassette` returns the transport **by identity** (`===`), so the
provider call path is exactly the pre-cassette one; `off` wins even when a tape path is set. `record`
and `replay` armed without a tape path, and any non-exact value, are `RT_E_VALIDATION` refusals with
**0 transport calls** (never a silent fall-back to live). The existing `record adds no wire fields`
test pins the off-vs-record request-body byte-identity.

### 2b. record / replay / miss — CONFIRMED

```
PROBE rt.identity :: {"record":{...},"replay":{...},"deepEqual":true,"called":0}
PROBE rt.tapeKey  :: {"tapeKey":"1623088157","computed":"1623088157","match":true}
PROBE miss.result :: {"ok":false,"code":"RT_E_LLM_REJECTED","hasText":false,"called":0,"error":"cassette miss: no tape file at (unset) — ..."}
```

Replay serves the recorded envelope byte-identically and never calls the transport; a miss is a coded
refusal with **no `text` field** and **no transport call**.

### 2c. Two-process identity proof — CONFIRMED (re-derived independently)

Ran the in-repo test by name on both runtimes:

```
node --experimental-strip-types --test --test-reporter=tap \
  --test-name-pattern "two processes" src/lib/cassette.test.ts
ok 1 - two processes: record then replay return identical request + result bytes   (both runtimes)
```

I also wrote my **own** two-process harness (`cass-child.ts` + `cass-2proc.ts`) spawning real
`node --experimental-strip-types` children that import the real provider + cassette with an injected
stub `fetch`: process 1 (`record`) makes exactly 1 wire call and writes the tape; process 2 (`replay`)
makes 0 (its stub throws if reached); canonical request bytes and the returned envelope are
identical. This independently reproduces the lane's claim.

### 2d. Tampered/malformed tape fails closed — **PARTIAL** (key/request tampering yes; response tampering no)

Confirmed fail-closed at load for: non-JSON, unsupported version, `key` that does not match
`hash(request)` (tampered), malformed request/response rows, malformed provenance, and **present-but-
malformed usage**:

```
PROBE usage.noUsage      :: {"ok":true,"note":"accepted (legacy 2-key shape)"}
PROBE usage.partialUsage :: {"ok":false,"code":"RT_E_VALIDATION","err":"... entry 0 has a malformed response envelope"}
PROBE usage.nanUsage     :: {"ok":false,"code":"RT_E_VALIDATION","err":"... entry 0 has a malformed response envelope"}
```

**HOLE:** the integrity check binds `key`↔`request` only — **there is no hash/signature over
`response`**. Changing the response envelope while leaving `key` + `request` intact is accepted and
**served verbatim**:

```
PROBE tamper.response :: {"init":"accepted","served":"TAMPERED-RESPONSE","servedModel":"attacker-model",
  "note":"no response hash is verified — a swapped envelope with an intact key/request is served verbatim"}
```

So "a tampered tape fails closed" is true for request/key tampering but false for response tampering.
Given tapes are trusted local artifacts this may be acceptable, but the claim as written over-reaches;
the response is not verifiable input. `usage` **absent entirely** is accepted by design (legacy 2-key
shape) — not a hole, but the "missing usage field must fail closed" attempt only holds when a usage
block is present and malformed.

### Defeat attempts — results

| Attempt | Result |
|---|---|
| two different prompts with the **same** FNV-1a key (`collision-probe-30159` / `-533074`, both key `3138489782`) | **refused** `RT_E_LLM_REJECTED` `/FNV-1a collision/`; the other request's `A-ANSWER` never served |
| content-affecting opts change (`model`/`system`/`maxTokens`/`json`/`thinking`/`history`/history order) | **key changes** (all `true`) |
| transport-seam opts (`timeoutMs`/`fetch`/`sleep`/`random`) | key unchanged — documented exclusion (HOW, not WHAT) |
| documented aliases (`thinking:true`≡omitted, `json:false`≡omitted) | byte-identical (provider-documented equivalence) |
| replay for a **different model** (`deepseek-v4-pro` vs recorded `deepseek-v4-flash`) | **miss** (`RT_E_LLM_REJECTED`) |
| replay for a **different provider family, same model-id string** | **HOLE (documented):** served from the DeepSeek tape with 0 transport calls |
| entry with present-but-malformed usage | fail-closed `RT_E_VALIDATION` |
| entry with no usage at all | accepted (legacy shape) |
| sloppy mode values | coded refusal, 0 live calls |

Cross-family reproduction (Node 24 and 22 identical):

```
PROBE cross.record                 :: {"ok":true,"text":"DEEPSEEK-ANSWER"}
PROBE cross.replaySameProvider     :: {"ok":true,"text":"DEEPSEEK-ANSWER","transportCalls":0}
PROBE cross.replayDifferentModel   :: {"ok":false,"code":"RT_E_LLM_REJECTED"}
PROBE cross.replayDifferentProvider:: {"ok":true,"text":"DEEPSEEK-ANSWER","transportCalls":0,
  "note":"same model-id string, different family => served from the DeepSeek tape"}
```

A tape recorded by `completeDeepSeek` with model `deepseek-v4-flash` is served to
`completeOpenAiCompatible` (xAI spec) requesting the same model-id string, with zero network. This is
**disclosed** in the `cassette.ts` header ("the canonical key is provider-agnostic … cross-family
conflation needs two families to request the same prompt AND the same model-id string — named here,
not hidden"), so it is a documented limitation rather than a hidden one. It is nonetheless a real
cross-family conflation: nothing enforces that incompatible families cannot share a tape.

---

## Claim 3 — 340-6 emitted UI (`src/lib/scaffold.ts`) — **CONFIRMED**

Real keyless emit: `runHeadless(seedProject(), ALL_PHASES)` → `scaffoldProject(...)` (19 files).

### 3a. ≥2 real spec/export-derived fields + a real exported call name — CONFIRMED

```
PROBE real.files :: {"count":19,"entryPath":"src/jobs/dispatch.ts","entrySpec":"../jobs/dispatch.ts"}
PROBE real.ui    :: {"calledNames":["synthesize"],"inputNames":["name","phase","job"],"hasNameDump":false,"uiParses":{"ok":true,"diags":0}}
PROBE real.runtimeImport :: {"exports":{"JOBS":"object","REJECTION":"string","synthesize":"function"},"callable":true}
PROBE real.runtimeCall   :: {"args":{"name":"Fixture","phase":0,"job":"dispatch"},
                             "result":{"ok":true,"name":"Fixture","job":"dispatch","addressed":false}}
```

I wrote the emitted tree to a TEMP dir and **dynamically imported the entry** under strip-types:
`synthesize` is a genuine runtime export and the call executes (result matches the lane log verbatim).
The 3 fields `name`/`phase`/`job` are the generated function's own parameter-default keys
(`function synthesize(spec = { name: "", phase: 0, job: "" })` in the emitted `dispatch.ts`), each
present in the imported entry's source. The name-dump (`generated exports (…)`) is gone.

### 3b. Determinism — CONFIRMED for the emitter; a nuance for whole-run reproducibility

```
PROBE determinism.sameProject :: {"deepEqual":true,"uiEqual":true}
PROBE determinism.freshRuns   :: {"deepEqual":false,"uiEqual":false,"firstDiff":186,
  "around":{"c":"machine-generated from RapidTool packet d67a0a72-...","d":"machine-generated from RapidTool packet 6811370f-..."}}
```

Given the **same project bytes**, two `scaffoldProject` calls are `deepEqual` and the UI bodies are
byte-equal. Two *independent engine runs* differ only in the fresh packet UUID embedded in the
header comment — i.e. the engine fixture is nondeterministic, not the emitter. So "two builds
byte-equal" holds exactly in the sense the lane pins (same project in ⇒ same bytes out).

### 3c. Emitted UI parses; no-module branch honest — CONFIRMED

`ts.transpileModule` (repo's own `node_modules/typescript`, `jsx: ReactJSX`): the real UI, spec-derived,
tree-mode, no-module, non-callable and zero-field UIs all parse with **0 non-message diagnostics**.

```
PROBE noModule :: {"honestNotice":true,"hasInput":false,"hasOnSubmit":false,"usesState":true,"parses":{"ok":true,"diags":0}}
```

The null-`generatedNamespace` branch is **byte-identical to pre-340-6** (`git show a097fa8:src/lib/scaffold.ts`
carries the same `const [notice] = useState<string>(` / `"shell — no generated module yet; run P6 then re-emit"` lines).

### Defeat attempts — results

| Attempt | Result |
|---|---|
| spec/module whose only export is non-callable (`export const VERSION = "1.0.0"`) | **honest panel** `/exports no callable/`; no `<input>`, no `onSubmit=` |
| callable but 0 real domain fields (`export function ping()`, project lattice/contracts/spec all null) | **honest panel** `/fewer than two bindable domain fields/`; invented inputs `[]`; never calls `ping` |
| module exports extra names the UI does not use | all called names are real exports; extra names ignored |
| tree mode | pinned by the suite; UI imports the computed tree entry and calls its real export |

One behavioural note from the extra-exports probe: with two eligible callables
(`unusedHelper(a,b)` before spec-derived `createRequest(...)`), the generator selected
`unusedHelper` and bound `a`/`b`. Both are real exports and real fields, so it is honest — but it
means the spec-derived function is not necessarily the one wired when an earlier callable also
carries ≥2 fields.

---

## Mock / fake census (the three lanes)

Added lines: `cassette.ts` +80/-0, `cassette.test.ts` +337/-7, `deepseek.ts` +12/-1,
`openai-compatible.ts` +24/-2, `scaffold.ts` +358/-37, `scaffold.test.ts` +223/-0; new files
`mcp.server.ts` (22,248 B), `mcp.server.test.ts` (12,291 B), `mcp/stub-server.ts` (4,405 B).

- `as any` / `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` / `TODO` / `FIXME` / `hardcod` in added
  lines and new MCP files: **0 hits** (regex census over `git diff` `+` lines + the three new files).
- Empty `catch {}` in added lines / `mcp.server.ts`: **0 hits** (every `catch` is best-effort cleanup
  with a comment).
- **MCP:** the only stand-in is `src/lib/mcp/stub-server.ts`, a *real spawned child* speaking real
  JSON-RPC 2.0 over a real pipe; production code never imports it. Protocol doubles: 0 (no `fetch`
  stubbing in the client suite).
- **Cassette:** test doubles are the legitimate injected `transport`/`fetch` seams; no mock of
  `cassette.ts` or the provider module under test. The wiring scan is independently confirmed:
  `cassette.ts` is imported only by `llm/providers/deepseek.ts`, `llm/providers/openai-compatible.ts`,
  and `cassette.test.ts`.
- **Scaffold:** no doubles; the generator is driven by the real engine fixtures and real emitted bytes.
- Stale literal `default-name-dump`: **0 hits** repo-wide after the rename; the `scaffold.ts` diff is
  localized (helpers + generator body + doc/literal updates; all 37 deletions are the old name-dump
  body and its now-false comments).

---

## Not verified / caveats

- **Did not run the full gate** (`npm test` / `npm run build` / `gate.sh`), typecheck, or lint — the
  boundary owner is running it concurrently. Only the three targeted suites (both runtimes) and the
  TEMP harnesses were run.
- The emitted project's own `tsc --noEmit` / `vite build` was not run (build leg owned elsewhere).
- The MCP duplicate-id / valid-then-garbage boundary is real but bounded (single-call consumers only;
  the F1 round-trip still fails closed on the following call) — reported as a hole, not a break.
- The cassette response-content tamper gap and the cross-family key conflation are real; the latter is
  explicitly documented in the module header, the former is not.
- Pre-fix byte comparison for the no-module branch was done by reading `git show a097fa8` (lines
  match), not by a full pre-fix emit diff.

## Verdict summary

| Claim | Verdict |
|---|---|
| 340-1 gate / no-child / no fabricated keys | **CONFIRMED** |
| 340-1 env scrub | **CONFIRMED** |
| 340-1 unlisted refusal / read-only round-trip | **CONFIRMED** |
| 340-1 timeout/malformed/unknown-id/non-zero-exit coded | **CONFIRMED** |
| 340-1 "never a partial pass" under duplicate-id / trailing garbage | **PARTIAL** (bounded hole) |
| 340-2 cassette mode precedence + miss (no text, no transport) | **CONFIRMED** |
| 340-2 two-process identity | **CONFIRMED** |
| 340-2 tampered tape fails closed | **PARTIAL** (response tampering undetected) |
| 340-2 key discipline (collision / opts sensitivity) | **CONFIRMED** |
| 340-2 cross-provider replay | **documented hole** |
| 340-6 real fields + real exported call (runtime-proven) | **CONFIRMED** |
| 340-6 determinism (same project) | **CONFIRMED** |
| 340-6 parses + honest no-module | **CONFIRMED** |
| 340-6 no fabrication (non-callable / 0 fields / extra exports) | **CONFIRMED** |
