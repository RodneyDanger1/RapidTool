# fixes/327 — Lane 2: CLI process-exit crash on Node 24 (doctor success path)

**Lane:** 2 of the 327 professional bug-fixing wave.
**Owned files:** `scripts/rapidtool-cli.mjs` · `scripts/cli-exit-taxonomy.test.mjs` ·
`src/lib/websearch.server.ts` · `src/lib/websearch.test.ts`.
**Changed by this lane:** `src/lib/websearch.server.ts`, `src/lib/websearch.test.ts` only.
(`scripts/rapidtool-cli.mjs` and `scripts/cli-exit-taxonomy.test.mjs` were already dirty from the
inherited 326 wave; this lane did **not** need to touch them — the crash is fixed at its source and
the refusals/exit taxonomy are unchanged.)
**Status:** DONE.

## 1. Symptom (reproduced)

On the host's default Node **v24.15.0** (Windows), a SUCCESSFUL `doctor` prints a correct JSON
envelope whose own field says `"exit_code": 0`, then the PROCESS DIES at teardown:

```
stderr: Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
exit status: 3221226505  (0xC0000409)
```

Under the pinned Node **v22.23.2** the same command exits 0 cleanly. The CLI therefore lied about
its exit code on Node 24, and the two inherited `doctor --tree` tests (`scripts/cli-exit-taxonomy
.test.mjs`, tests 19 & 20 of that file — the "140 & 141" of the wave-wide run) failed at their
CONTROL scan (`control scan failed`, a VALID stub tree that must exit 0). The `doctor` refusal
paths (non-existent path, file-as-path, POSIX literal) exited 1 cleanly because they `respond()`
BEFORE the network probe runs.

## 2. Root cause (verified, byte-anchored)

`doctor` success path:
- `scripts/rapidtool-cli.mjs:4057` — `const status = await h.doctorStatus(tree ? { treeDir: tree } : undefined);`
- `scripts/rapidtool-cli.mjs:4058` — `respond({ ok: true, ...status }, 0);`
- `scripts/rapidtool-cli.mjs:243` — `respond()` ends with `process.exit(exitCode)` **in-tick**
  (deliberate; `fixes/217e G1` — the sync exit is what makes a guard-position `return respond(...)`
  actually END the verb).
- `src/lib/headless.ts:4080` — `research.configured = await probeKeylessSearch();`
- `src/lib/headless.ts:3966-3977` — `probeKeylessSearch()` → `freeWebSearch(...)` wrapped in
  `withTimeout(..., 3000)`.
- `src/lib/websearch.server.ts` (pre-fix) `fetchText()` used the **global undici `fetch`**.

The probe performs a REAL HTTPS fetch (DuckDuckGo/SearXNG/Wikipedia). Node 24/Windows leaves an
undici TLS teardown handle that has not settled when `respond()` calls `process.exit()`; libuv then
asserts (`win/async.c:76`) while shutting the loop down → 0xC0000409 AFTER the correct
`"exit_code": 0` was already written. Node 22 does not trip it.

**Mechanism probes (throwaway, out-of-repo; Node 24 unless noted):**

| probe | result |
|---|---|
| `await fetch("https://example.com/"); await res.text(); process.exit(0)` | **CRASH** (async.c) |
| same, fetched via `node:https` (`agent:false` / default / keepAlive) | clean, exit 0 |
| `fetch("http://example.com/")` (DNS, no TLS) then exit | clean |
| `fetch("http://127.0.0.1:<port>/")` local server then exit | clean |
| `https://example.com/` then exit | **CRASH** — so the trigger is **TLS-via-undici**, not DNS/sockets |
| global-dispatcher `.close()`/`.destroy()` before exit | still CRASH |
| destroy the pooled `Socket` (`process._getActiveHandles()`) before exit | still CRASH |
| wait ≥ ~100 ms after the body, then exit | clean |
| natural exit (`process.exitCode`, no `process.exit`) | clean (~ +250 ms) |

So the parent's "keep-alive socket" lead is close but not exact: closing/destroying the connection
does **not** fix it, and a ~100 ms drain does. The offending handle is intrinsically undici's — the
honest fix is to stop using undici's global `fetch` for the free-search transport, so **the probe's
connection cannot outlive the probe at all**.

## 3. Fix

`src/lib/websearch.server.ts` — the free-search transport is now `node:https`/`node:http` with
`agent: false` (a one-shot, never-pooled connection), replacing the global undici `fetch`:

- New imports: `node:http` `request`, `node:https` `request`, `node:zlib`
  (`gunzipSync`/`inflateSync`/`brotliDecompressSync`).
- New `requestText()` — one provider request: one-shot agent, follows ≤5 redirects, honors the
  caller's `AbortSignal` (the bounded timeout still lives in `fetchText`), drains redirect sockets.
- New `decodeBody()` — decompresses by `content-encoding` (gzip/deflate/br), identity otherwise.
- New `nodeFetch: SearchFetch` — the production default.
- `fetchText()` now calls `opts.fetchImpl(url, …)` instead of the global `fetch`. Retry/backoff,
  the non-transient `HTTP NNN` marker, and the `HTTP NNN`-only-throws contract are unchanged.
- `FreeSearchOptions` gains `fetchImpl?` (the file already documents "Test/dev hooks"); default is
  `nodeFetch`.

Real in-process `fetch` calls in the running app are gone from this module; the probe stays a REAL
network probe (`doctor` still reports `research.probed:true` against live providers). No stubbing,
no probe disabling, no `process.exit` suppression, no exit-code change.

`src/lib/websearch.test.ts` — adapted to the new seam: tests inject their fake through
`{ ...FAST, fetchImpl }` instead of monkeypatching `globalThis.fetch` (which no longer intercepts).
**Every assertion is unchanged** (same 11 tests, same expectations). The `realFetch`/`afterEach`
reset is gone because there is no global to restore.

## 4. Before/after evidence — space-path validation probe

Throwaway probe at `%TEMP%\rt_l2_probe\space_probe.mjs` (outside the repo). It creates a validation
repo under a path that **contains a space** (`…\rt l2 space probe …\tree with space\src\jobs\…`,
one `TODO(E-15)` stub), spawns `doctor` (plain and `--tree`, cwd = the space dir), and reports the
real status + assertion presence, under BOTH node binaries.

**BEFORE** (module temporarily restored to HEAD, then the fix re-applied and re-verified):

```json
{
  "node24-host": {
    "version": "v24.15.0",
    "doctor (plain)": { "status": 3221226505, "assertion": true,
      "stderrTail": "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\\win\\async.c, line 76",
      "exitCodeField": 0, "ok": true },
    "doctor --tree <space path>": { "status": 3221226505, "assertion": true,
      "stderrTail": "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\\win\\async.c, line 76",
      "exitCodeField": 0, "ok": true }
  },
  "node22-pinned": {
    "version": "v22.23.2",
    "doctor (plain)": { "status": 0, "assertion": false, "exitCodeField": 0, "ok": true },
    "doctor --tree <space path>": { "status": 0, "assertion": false, "exitCodeField": 0, "ok": true }
  }
}
```

**AFTER** (re-run on the restored fixed tree):

```json
{
  "node24-host": {
    "version": "v24.15.0",
    "doctor (plain)": { "status": 0, "signal": null, "assertion": false, "stderrTail": "", "exitCodeField": 0, "ok": true },
    "doctor --tree <space path>": { "status": 0, "signal": null, "assertion": false, "stderrTail": "", "exitCodeField": 0, "ok": true }
  },
  "node22-pinned": {
    "version": "v22.23.2",
    "doctor (plain)": { "status": 0, "signal": null, "assertion": false, "stderrTail": "", "exitCodeField": 0, "ok": true },
    "doctor --tree <space path>": { "status": 0, "signal": null, "assertion": false, "stderrTail": "", "exitCodeField": 0, "ok": true }
  }
}
```

Direct `doctor` runs (repo path also contains a space):

- pre-fix Node 24: stderr = the async.c assertion; envelope `"exit_code": 0` but process 0xC0000409.
- pre-fix Node 22: clean, `"exit_code": 0`.
- post-fix Node 24: stderr empty, exit 0, `"exit_code": 0`, `"ok": true`, `"probed": true`.
- post-fix Node 22: stderr empty, exit 0, `"exit_code": 0`, `"probed": true`.

## 5. Test counts (both node versions)

`scripts/cli-exit-taxonomy.test.mjs` (the inherited file with the two `doctor --tree` tests):

- Node **v24.15.0** (`node --test --test-reporter=tap …`): `# tests 20 / # pass 20 / # fail 0`.
  `ok 19 - 326 F2d — doctor --tree refuses CODED …`; `ok 20 - 326 F2d — doctor --tree translates MSYS …`.
- Node **v22.23.2** (pinned binary): `# tests 20 / # pass 20 / # fail 0`. Same two `ok 19/20`.

`src/lib/websearch.test.ts` (`node --experimental-strip-types --test --test-reporter=tap …`):
`# tests 11 / # pass 11 / # fail 0` (same 11 tests, same assertions).

## 6. Typecheck

`npm run typecheck` → **TYPECHECK_EXIT=0** (no `error TS*`), run against the final restored tree.

## 7. Unresolved / notes

- The offending libuv handle is intrinsic to undici's TLS teardown on Node 24/Windows; it is not the
  pooled socket (destroying it, or closing/destroying the global dispatcher, did not help). The fix
  removes undici from the CLI's critical path rather than papering over the teardown.
- The running TanStack app also now uses node:https for free search (via this module). That is a
  transport swap with the same semantics (redirects, retries, timeouts, content-encoding decoding);
  it does not change `doctor`'s JSON contract or the 0/1/2/3/4 exit taxonomy.
- `withTimeout`'s 3000 ms cap in `headless.ts` is unchanged and still bounds the probe; the
  per-attempt `timeoutMs` still bounds each hop.
- No files outside this lane's ownership were modified. `scripts/rapidtool-cli.mjs` and
  `scripts/cli-exit-taxonomy.test.mjs` remain as the inherited 326 wave left them.

---

## 8. Follow-up (parent verification) — integration fallout + seam restore

**Fallout (parent-measured, pinned Node 22, full src/lib leg):** `# tests 2560 / # pass 2548 / # fail 2`,
both in `src/lib/lesson-writers.test.ts` (not this lane's file).

**Cause:** those two tests fake the network by replacing the global:
`lesson-writers.test.ts:565 globalThis.fetch = stubRefusal;` and
`:614 globalThis.fetch = stubWikipedia;`. The §3 fix routed `doctor`/search through `nodeFetch`
(node:https), so those global stubs were never consulted and the tests hit the real network.

**Seam (in `src/lib/websearch.server.ts` only — no other edited):** `nodeFetch` now defers to
`globalThis.fetch` when the global has been replaced:

```ts
const INITIAL_FETCH = globalThis.fetch;
const CAPTURED_NATIVE = INITIAL_FETCH.name === "fetch";

const nodeFetch: SearchFetch = (url, init) => {
  const current = globalThis.fetch;
  if (current !== INITIAL_FETCH || !CAPTURED_NATIVE) return current(url, init);
  return requestText(url, init.signal, MAX_HTTP_REDIRECTS);
};
```

The `.name` guard is load-order-critical, **proven** here: `websearch.server.ts` is only reached
through a dynamic import (`headless.ts:392`), so in `lesson-writers.test.ts` it first evaluates at
line 566 — *after* `globalThis.fetch = stubRefusal` at 565. Identity alone therefore captured the
stub as "initial". Removing `|| !CAPTURED_NATIVE` re-broke it exactly as the parent saw:

```
$ node --experimental-strip-types --test --test-reporter=tap src/lib/lesson-writers.test.ts   # guard removed
not ok 8 - fixes/252 (W19-L1 · OV-13 + OV-29) — keyed live failures leave coded rows, never a keyless look
# tests 25 / # pass 24 / # fail 1
```

With the guard restored (a test stub is never the native `fetch`): **25/25**. Production never
replaces the global, so `CAPTURED_NATIVE` is true and the non-pooled node:https transport is used —
crash fix intact (probe below).

### Verification (this follow-up)

| command | result |
|---|---|
| `node --experimental-strip-types --test --test-reporter=tap src/lib/lesson-writers.test.ts` | `# tests 25 / # pass 25 / # fail 0` (before: 2 fail) |
| `node --experimental-strip-types --test --test-reporter=tap src/lib/websearch.test.ts` | `# tests 11 / # pass 11 / # fail 0` |
| both files together | `# tests 36 / # pass 36 / # fail 0` |
| `src/lib/crew.test.ts src/lib/harvest.test.ts src/lib/research.test.ts` | `# tests 106 / # pass 105 / # fail 0 / # skipped 1` (pre-existing skip) |
| `npm run typecheck` | `TYPECHECK_EXIT=0` |
| `space_probe.mjs` (outside repo, space path) | Node 24 + Node 22, `doctor` and `doctor --tree`: `status 0`, `assertion false`, `exitCodeField 0` |

`space_probe.mjs` re-run output (after the seam):

```json
{ "node24-host":   { "version": "v24.15.0", "doctor (plain)": { "status": 0, "assertion": false, "exitCodeField": 0, "ok": true },
                     "doctor --tree <space path>": { "status": 0, "assertion": false, "exitCodeField": 0, "ok": true } },
  "node22-pinned": { "version": "v22.23.2", "doctor (plain)": { "status": 0, "assertion": false, "exitCodeField": 0, "ok": true },
                     "doctor --tree <space path>": { "status": 0, "assertion": false, "exitCodeField": 0, "ok": true } } }
```

**Not mine (attributed, not edited):** `src/lib/headless.test.ts` has one red subtest,
`E-25 … emit --run: … a green tree exits 0`. It is unrelated to this change — isolated
(`--test-name-pattern "green tree exits 0"`) it fails identically with the **pristine HEAD**
`websearch.server.ts` — i.e. it is collateral from a sibling lane's in-flight emit/codegen edits, and
`emit --run` never touches `doctor`/websearch.

### Vacuity audit — every `globalThis.fetch` monkeypatch site (`grep -rn "globalThis.fetch" src scripts`)

| file (site lines) | stubs | still intercepts search? | vacuous risk |
|---|---|---|---|
| `src/lib/lesson-writers.test.ts:565,614` | headless live overlay → `freeWebSearch` | **yes** — via the new deferral seam (was the fallout; now green) | **No.** The stub returns deterministic `Response`s; `:617` even asserts `clean.research?.some(e => e.provider === "wikipedia")` ("the stub really served the live leg … not vacuous"). |
| `src/lib/research.test.ts:20…216` | `tavilySearch` (`tavily.server.ts`, which calls `globalThis.fetch` directly) | yes — unchanged (not routed through `websearch.server.ts`) | No — direct global stub, unaffected by this lane. |
| `src/lib/crew.test.ts:877,882,942` | DeepSeek completions (`deepseek.server.ts`, direct global fetch); `runCrewServer(..., { live:false })` so the researcher search is off | n/a for search; LLM stub unchanged | No — asserts every call is `api.deepseek.com/chat/completions`. |
| `src/lib/app-data/app-data.test.ts:38-64` | app-data module fetch | n/a (not search) | No — direct global stub. |
| `src/lib/llm/providers/mock.test.ts:57-66` | mock LLM provider | n/a | No. |
| `src/lib/algo-tools.test.ts:22-29,392-511` | LLM tool calls | n/a | No. |
| `src/lib/chat.test.ts:44-1245` | chat/LLM | n/a | No. |
| `src/lib/llm-tasks.test.ts:37-159` | LLM tasks | n/a | No. |
| `src/lib/llm.test.ts:30-284` | LLM | n/a | No. |
| `src/lib/prompt-engine.test.ts:32-503` | prompt-expansion LLM | n/a | No. |
| `src/lib/vector.test.ts:25-510` | embeddings | n/a | No. |
| `src/lib/verify.server.test.ts:144-720` | verify LLM | n/a | No. |
| `src/lib/verify.test.ts:174-191` | verify LLM | n/a | No. |
| `scripts/chat-stream.test.mjs:69` | chat stream | n/a | No. |
| `scripts/run-eval.mjs:1535,1642` | not a stub — reads `fetchImpl ?? globalThis.fetch` as its own base | n/a | No. |
| `src/lib/websearch.test.ts` (comment only) | migrated to the `fetchImpl` seam | n/a | No — deterministic fakes. |

**Net:** the only search-stubbing sites are `lesson-writers.test.ts` (websearch) and
`research.test.ts`/`crew.test.ts` (provider/LLM modules untouched by this lane). All still intercept;
none gains a vacuous pass, because interception is restored for the websearch path and was never
altered for the direct-global-fetch modules. There is no production code that replaces
`globalThis.fetch` (only tests do), so the node:https crash fix is unaffected in the CLI/app.
