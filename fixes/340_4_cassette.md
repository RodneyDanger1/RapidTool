# 340-4 (persona: cassette) — T5.7 wired around the REAL provider seam

Repo `C:\Users\mnril\Desktop\RapidTool Main`, branch `main`, base HEAD `a097fa8`.
Scope: `src/lib/cassette.ts`, `src/lib/cassette.test.ts`,
`src/lib/llm/providers/deepseek.ts`, `src/lib/llm/providers/openai-compatible.ts`.
`src/lib/llm.ts` needed no change (its server functions already reach the provider
through the registry/`deepseek.server.ts`; the seam is below that boundary).

## Reconciliation

T5.7 on disk was exactly as the brief said: `src/lib/cassette.ts` is a complete,
tested module (`off|record|replay`, `canonicalizeRequest`/`canonRequest`,
`createFileCassetteStore`/`createMemoryCassetteStore`, `CASSETTE_MISS_CODE`,
`CassetteTransport`) with **zero non-test consumers** — the only importers were
`cassette.ts` itself and `cassette.test.ts` (the suite even pinned that fact in a
"nothing is wired" wiring scan). `finalsprint.md` T5.7 row: "replay = tests
without the network; wired to nothing today", done-when = "record/replay around
the provider seam + a miss = coded refusal; pin: identical bytes across replay".
This lane closes the wiring half; the module half was already correct.

## The seam that was wrapped (and why)

Wrapped: the **provider entry functions**, not `callModel`.

| File | Line | What |
|---|---|---|
| `src/lib/llm/providers/deepseek.ts` | `760` | `completeDeepSeek` routes its wire call through `wrapWithActiveCassette(completeDeepSeekInner)` |
| `src/lib/llm/providers/openai-compatible.ts` | `621` | `completeOpenAiCompatible` routes through `wrapWithActiveCassette((p,o) => completeOpenAiCompatibleInner(...))` |
| `src/lib/llm/providers/openai-compatible.ts` | `384` | the former exported body, renamed `completeOpenAiCompatibleInner` and no longer exported |

Why the provider function and not `callModel` (registry.ts):
- `registry.callModel` is only ONE of several callers. Direct `completeDeepSeek`
  importers (algo-tools, harvest, codegen P6, headless, llm-tasks), the
  explicit-provider path (`opts.provider`), and the eval driver all reach the
  provider without passing through the role-dispatch tail of `callModel`. The
  provider function is the funnel **every** traffic path actually crosses, and
  it is the exact seam `./mock.ts` mirrors.
- `registry.ts` is outside this lane's ownership box, and its `callModel` also
  owns non-provider refusals (env selection, unarmed failover) that must not be
  taped. Wrapping the provider keeps the tape keyed on what was *asked of the
  model*.
- Both providers are covered (DeepSeek + the xAI/OpenAI-compatible family). No
  exclusion to name.

`cassette.ts` gained the process-wide activation helper it was missing
(`cassette.ts:803-859`): `resetActiveCassette`, `activeCassette` (cached by a
`(mode, tapePath)` signature), and `wrapWithActiveCassette`.

## Mode precedence

| `RAPIDTOOL_CASSETTE_MODE` | `RAPIDTOOL_CASSETTE_TAPE` | Result at the seam |
|---|---|---|
| unset / blank / `off` | any | inert — `wrapWithActiveCassette` returns the transport **by identity** (`===`); `completeDeepSeekInner` is the call |
| `record` | set | live wire call, served envelope written through to the tape under the canonical key; first-wins per key |
| `replay` | set, tape present | served from the tape; the transport is **never** invoked |
| `replay` | set, tape missing/empty | `CASSETTE_MISS_CODE` (`RT_E_LLM_REJECTED`) coded refusal — no text field |
| `replay` | set, tape malformed/tampered | fail-closed at load → coded refusal (`RT_E_VALIDATION`) |
| `record`/`replay` | unset | coded refusal `RT_E_VALIDATION` per call — an armed mode never silently un-arms |
| any other value (`1`,`true`,`RECORD`,…) | any | coded refusal `RT_E_VALIDATION` per call — exact values only |

`CASSETTE_MISS_CODE` is reused as-is (`RT_E_LLM_REJECTED`, the registry's
existing "the model side refused to serve this call"); `errors.ts` was **not**
touched. No new registry row was needed.

## RED → GREEN (owned test file, both runtimes)

Red-first: the six seam tests were added and run **before** any production edit.
Pre-fix, four failed (the wiring did not exist): "record lands on the tape"
(ENOENT), "replay never calls the transport" (stub fetch hit 1×), "replay miss
is coded" (live call hit 1×), and the two-process test (replay process made 3
transport attempts — the provider's bounded retry). Two pins passed pre-fix by
construction (off stays live; record adds no wire fields).

| Run | Node 24 | Node 22 |
|---|---|---|
| `cassette.test.ts` RED (pre-implementation) | 43 tests, 39 pass / **4 fail** | 43 tests, 39 pass / **4 fail** |
| `cassette.test.ts` GREEN (post-implementation) | 47 tests, **47 pass / 0 fail** | 47 tests, **47 pass / 0 fail** |

Regression on the provider function changed (Node 24 and Node 22, both exit 0):
`llm.test.ts` + `deepseek.server.test.ts` + all `llm/providers/*.test.ts` =
**132 tests, 132 pass / 0 fail** on each runtime.

Also ran `npx tsc --noEmit` (extra, not the gate): exit 0.

## Two-process determinism proof (the row's pin)

`cassette.test.ts` → `two processes: record then replay return identical request
+ result bytes` spawns two real child `node --experimental-strip-types`
processes, each importing the real provider + cassette modules with an injected
stub `fetch` (no socket):

- process 1 (`RAPIDTOOL_CASSETTE_MODE=record`): exactly **1** wire call, writes
  the tape;
- process 2 (`=replay`, same tape, same prompt/opts): **0** wire calls (the stub
  throws if reached).

Asserted identical across the two: the canonical request bytes
(`canonRequest(...)`, printed by both children) and the returned envelope
(`deepEqual`). The tape's stored entry is verified to carry that same canonical
request, that same response, and `provenance.producer === "model"`. The recorded
wire body is parsed and asserted to contain no cassette-only field.

## Miss refusal

Replay of an unrecorded call (tape file absent) returns
`{ ok:false, reason:"error", code: CASSETTE_MISS_CODE }` with no `text` field,
and the stub transport is never called. The coded message carries the
`cassette miss:` prefix and the FNV-1a key. This holds keylessly (proved by the
keyless-replay assertion added to the round-trip test).

## Honesty contract

A replayed reply is the recorded envelope verbatim (`copyEnvelope` keeps the
full `LlmUsage`, cache fields included) — same usage/evidence shape as the live
call where the tape has it; a legacy 2-key tape replays with the legacy 2-key
shape (never a fabricated cache field). A recorded refusal replays as that
refusal, with no provenance stamp (nothing was produced). Where the tape cannot
give the live shape (no entry / collision / no usage recorded), the seam refuses
with a code rather than reconstructing anything. The provider tap
(`setLlmCallTap`) and `RAPIDTOOL_LLM_USAGE_LOG` are unchanged and observe the
final served envelope; a replayed call is **not** marked live by the cassette
itself — its provenance (`producer:"replay"`) and `served()` log are the honest
signal, while the tap record shape is intentionally unchanged.

## Keyed usage

**0 keyed calls.** The round-trip was proved with a stub transport and two
scratch child processes; no `DEEPSEEK_API_KEY`/`XAI_API_KEY` was spent and
`npm run eval` was never run.

## Mock / fake census

- Test transport doubles (legitimate, pre-existing): `liveTransport`,
  `forbiddenTransport` in `cassette.test.ts`.
- New stub `fetch` in the child process source + `okWireResponse()` helper —
  doubles for the network transport only.
- **No** fake/mock of `cassette.ts` or the provider module under test. No
  `as any`, `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`, no `TODO` bodies, no
  silent `catch {}`, no hardcoded fake of a computation (census grep = 0 hits).
- The wiring-scan pin in `cassette.test.ts` was updated from "nothing imports
  cassette" to "ONLY the two named provider files import cassette", and a second
  assertion checks those two files do cross the seam. `scripts/run-eval.mjs`
  still contains no `cassette` reference (unchanged).

## STOP-and-REPORT

None. No change was needed outside the ownership box (`errors.ts` reused an
existing code; `registry.ts` untouched; `llm.ts` untouched).

## Not done (named remainders)

- The run-eval `--record`/`--replay` flags and CLI flags (§T5.7 items 4–5) —
  out of this lane's file ownership. This lane makes the seam honor the env vars;
  a driver still has to set them.
- Cross-family key discrimination: the canonical key is provider-agnostic
  (prompt + provider-facing opts; the family id is not in the key — see
  `cassette.ts` header). Documented, not hidden.
- The tap record carries no live/replay marker (shape deliberately unchanged);
  replay provenance is available via the cassette's own surface.

## Files touched

- `src/lib/cassette.ts` (+80)
- `src/lib/cassette.test.ts` (+~370)
- `src/lib/llm/providers/deepseek.ts` (~+13)
- `src/lib/llm/providers/openai-compatible.ts` (~+26)
- this log.
Note: other concurrent lanes had uncommitted edits in the worktree
(`doctor*`, `scaffold*`, `verify*`, `mcp*`) during this run; none were touched by
this lane.

---

# 340-4 RESUME -- verifier A's two integrity gaps closed

Branch `main`, base HEAD `a097fa8` (the prior lane's cassette work was uncommitted
on disk; this resume patches those files). Same ownership box: `cassette.ts`,
`cassette.test.ts`, the two providers, their tests. `llm.ts` still needed no
change (the family is decided at the provider; the facade forwards opts verbatim).

## Decision: version 2, response binding required, family in the key

**No committed tape exists.** I searched the repo (excluding `node_modules`) for
tape-shaped JSON -- the v1 serialization would contain `"thinking": "default"` and
provenance `"inputHash"` -- and both searches returned zero files, under
`research/`, `fixes/`, or anywhere else. Since there is nothing to grandfather,
the honest choice is the strict one: **entry responses are bound, v1 tapes are
refused, no weaker guarantee is offered.**

- `CASSETTE_VERSION` 1 -> **2**. A mismatched version is a coded
  `RT_E_VALIDATION` refusal at load, and its message ends "re-record the tape
  with this build."
- **Entry shape** (bytes actually written by the recorder, read back from a
  memory store):
  ```json
  {"version":2,"entries":[{"key":"2926053259",
    "request":{"provider":"deepseek","prompt":"bound probe","model":"shared-model",
               "system":null,"maxTokens":null,"json":false,"thinking":"default","history":[]},
    "response":{"ok":true,"text":"LIVE","model":"deepseek-flash"},
    "responseHash":"1447216894",
    "provenance":{"producer":"model","model":"deepseek-flash","timestamp":1700000000000,
                  "inputHash":"2926053259"}}]}
  ```
- **Canonical request** gained `provider` as the first field. `canonRequest`
  bytes for the same prompt/model under two families:
  ```
  {"provider":"deepseek","prompt":"family probe","model":"shared-model",...,"history":[]}
  {"provider":"xai",     "prompt":"family probe","model":"shared-model",...,"history":[]}
  ```
  keys `1621303605` vs `1223158427` (no-family: `4046493558`) -- distinct by
  construction. Transport seams (`fetch`/`sleep`/`random`/`timeoutMs`) stay out
  of `CassetteRequest`; a test asserts none of those tokens can appear in the
  canonical bytes.

## Hole 1 -- response-hash verify path

`responseHash(res) = String(fnv1a(canonicalResponseJson(res)))`;
`canonicalResponseJson` is `JSON.stringify(copyEnvelope(res))`, so the response
is normalized to the module's fixed field order before hashing (key order in a
hand-written tape can never change the bytes). At record time the entry stores
`responseHash: responseHash(stored)`. In `parseTape`, after the existing
`key`<->`request` check, the loader now (a) refuses a missing/blank
`responseHash` with "`has no responseHash -- this build binds request AND
response ...; re-record`", and (b) refuses a mismatch. Never served -- the whole
tape fails closed at load:
```
TAMPER_load_ok=false error=cassette(mode=replay): entry 0 responseHash 1447216894
  does not match its response (expected 653503176)
V1_load_ok=false error=cassette(mode=replay): tape version 1 is not supported
  (this build reads/writes version 2); re-record the tape with this build.
```
A mismatch that survives to a **replay** arm is impossible at load: integrity is
enforced at cassette construction, before `wrap()` exists. The replay arm
re-checks `responseHash` immediately before serving as defense against an entry
mutated in memory after load (test "`Hole 1 (serve-time)`"), so a mismatched
envelope is never served on either path.

## Hole 2 -- family-in-key proof

`Cassette.wrap(transport, provider?)` and
`wrapWithActiveCassette(transport, provider, env?)` now take the family id.
`completeDeepSeek` passes `"deepseek"`; `completeOpenAiCompatible` passes
`spec.id` (`"xai"`). Same-family replay hits; cross-family replay misses with
`CASSETTE_MISS_CODE` and **zero** transport calls (test
"`Hole 2: a tape cannot serve across provider families`"): a tape recorded by
`completeDeepSeek` for model `deepseek-v4-flash` is replayed through
`completeOpenAiCompatible(XAI_SPEC, ["deepseek-v4-flash"], ...)` -- the stub fetch
throws "a cross-family replay must never touch the transport" and is never
reached, while the subsequent `completeDeepSeek` replay returns the recorded
envelope byte-identically. The prior log's "not done: cross-family key
discrimination" remainder is now landed.

## RED -> GREEN (both runtimes, real output)

RED (new tests only, before any production edit):
- node 24 (`v24.15.0`): exit 1 -- 49 tests, 47 pass / **2 fail**;
  Hole 1 `AssertionError ... true !== false` (the tampered tape LOADED); Hole 2
  `AssertionError: a deepseek tape must not be served to the xAI family true !== false`.
- node 22 (`v22.23.2`, `& "$env:LOCALAPPDATA\hermes\node\node.exe"`): exit 1 --
  49 tests, 47 pass / **2 fail** (same two `not ok`).

GREEN after the fix:
- `src/lib/cassette.test.ts` -- node 24: exit 0, 56 tests / 56 pass / 0 fail;
  node 22: exit 0, 56 tests / 56 pass / 0 fail.
- Provider suites touched (`llm.test.ts`, `deepseek.server.test.ts`, all seven
  `llm/providers/*.test.ts`) -- node 24: exit 0, 132/132/0; node 22: exit 0,
  132/132/0. No provider-suite pin encoded the old key or version (grep: no
  `cassetteKey`/`CASSETTE_VERSION` references outside `cassette.test.ts`).

Tests updated honestly for the new surface: pinned key literals re-derived
(`1844731533`->`2643817931`; `775478552`->`3530000090`), the canonical-string
literal now starts with `"provider":null`, the FNV collision pair was
**re-derived** for the changed hashed bytes -- the old pair no longer collides
once the provider field is hashed -- to `collision-probe-411962` /
`collision-probe-1413200`, both key `1673658087` (4e6-probe search); the
two-process child now canonicalizes with `provider:"deepseek"`; the version pin
is `2`; `wrapWithActiveCassette` calls pass a family. New pins: responseHash
determinism/sensitivity, missing-hash refusal, hash-mismatch refusal, serve-time
re-check refusal, v1 re-record refusal, family-key separation, transport-seam
exclusion.

## Corrected claims

- Header: now states an entry binds BOTH halves (`key` + `responseHash`) and the
  canonical request carries the family id.
- Header doctrine #2: names the load-time integrity failures (unsupported
  version, key<->request, missing/mismatched responseHash) as coded
  `RT_E_VALIDATION` refusals -- the whole tape is rejected, no unbound envelope
  served.
- Header "NOT in this module": removed the false "Nothing in the pipeline imports
  this module today"; the wrapper is wired at the two provider entry points.
- T5.7 wiring note: replaced "The canonical key is PROVIDER-AGNOSTIC ...
  cross-family conflation ... named here, not hidden" with the fact that the
  family id IS in the key.
- `CassetteEntry.response` doc: no longer claims "exactly as the live transport
  returned it" -- it is normalized by `copyEnvelope`.
- Version/miss notes: version doc explains the v1->v2 re-record decision; the
  version-refusal message names the fix.

## What I did not do

- Did not touch `src/lib/errors.ts` (outside the box): the miss reuses
  `RT_E_LLM_REJECTED`, load failures use the existing `RT_E_VALIDATION`; the
  "re-record" reason is a stable prose token in the coded refusal.
- Did not run the full gate (per the brief): only `cassette.test.ts` and the
  provider suites above, on both runtimes.
- Did not add run-eval `--record`/`--replay`/CLI flags, and did not change the
  tap record shape (still no live/replay marker) -- pre-existing, out of scope.
- Did not delete or rewrite any committed file beyond the code above; no
  committed tape existed to migrate.

## Keyed usage

**0 keyed calls.** All record/replay proof is stub-transport + in-process /
two child processes.

## Files touched (this resume)

- `src/lib/cassette.ts`, `src/lib/cassette.test.ts`,
  `src/lib/llm/providers/deepseek.ts`, `src/lib/llm/providers/openai-compatible.ts`,
  this log. Scratch under `%TEMP%\rt340_4\`.
