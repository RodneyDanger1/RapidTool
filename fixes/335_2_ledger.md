# W49 / 335-2 — "Ledger" — the journey driver + state integrity

Lane log (append-only). Repo `C:\Users\mnril\Desktop\RapidTool Main` (path has a space).
HEAD at open **`9cff073`**, tree clean except `?? wave_plans/W49/`. Pinned Node **22.23.2**
(`%LOCALAPPDATA%\hermes\node\node.exe`); host Node **24.15.0**; every parsed `node --test`
run uses `--test-reporter=tap`. Owned files (STRICT): `src/lib/headless.ts`, `src/lib/doctor.ts`,
`src/lib/token-ledger.ts`, `src/lib/io.ts` + their `*.test.ts`. No full gate (five siblings
edit concurrently); no `npm run eval`; no keyed call so far; scratch under `%TEMP%\rt335_2\`.
`src/lib/types.ts` / `engine.ts` / `checkpoint.server.ts` are **unowned** — requests, not edits.

## 0. Step 0 — claimed / on disk / still open

### Own lane history read
`fixes/331_2_assayer.md` (that persona's W45 work is not this lane), `fixes/332_2_ledger.md`
(W46: spend truth L1, cap L2, F-5 follow-up), `fixes/334_2_ledger.md` (W48: persisted keyed
outcome L1, `RunResult.code` L2, non-gate verb spend L3, doc correction L4),
`fixes/333_1_verifier.md` F-5, `fixes/334_0_parent.md`.

### Claimed (332-2 + 334-2) → **on disk** (re-verified today by grep/read)
- `token-ledger.ts`: `SpendSlice` (:158), `isMeasuredSpend` (:175), `normalizeLedger` (:195),
  `accumulateSpend` (:218), `spendDelta` (:245) — present.
- `headless.ts`: `runUntilGate` spend fold + `RunResult` (:802, `code` field), `keyedTrailOutcome`
  (:4353), `foldInvocationEvidence` (:4418), `resolveDoctorSpendSource` (:4435),
  `resolveDoctorKeyState` (:4477); spend baselines at :1060 (runUntilGate), :3540 (repairTreeDir),
  :5016 (wildStartHeadless), :5208 (wildStartRun).
- `doctor.ts`: `doctorSpend` (:712), `isKeyUnusableCode` (:787), `readLastKeyedOutcome` (:808),
  `doctorLlmKey` (:831) — the F-5 vocabulary is real bytes.
- **Claim-vs-bytes divergence: none.** Every falsifiable claim in the two prior logs reproduces.

### Baseline suites at HEAD (real `node --test` runs, Node 22.23.2)
`headless.test.ts` **134 / 0 fail**, `doctor.test.ts` **31 / 0 fail**, `token-ledger.test.ts`
**39 / 0 fail**, `io.test.ts` **60 / 0 fail** (the register asked for io's count → **60**).

### Still open (with `file:line` at HEAD `9cff073`) — this pass's work
1. **(b) save/load size-cap asymmetry — WORK LOST.** `saveProject` (headless.ts:233) writes
   any record via `exportProjectJson` (no cap); `loadProject` (:113) → `importProject`
   (io.ts:454) refuses anything over `IMPORT_MAX_CHARS` 5,000,000 (io.ts:47). A record the
   tool itself wrote can therefore be **unreadable by its own reader** — the wave's headline
   "no work is lost" violation. Reproduced on bytes (§2 A). FIX.
2. **(b) the two W46/W48 fields lack a dedicated save→load round-trip proof** — `tokenUsage`
   is only spot-pinned (headless.test.ts:3384), `lastKeyedOutcome` is pinned through a save in
   the refusal test (:3552) but not against a real driven record; the legacy "record lacking
   them still loads + migrates in place" is not pinned in one place. PROOF (RED-first where a
   gap exists — see §2 B).
3. **(a) no single test proves the driver advances and records all 13 phases** — the register's
   old P7–P12 "0 artifacts" finding is a driver-observable claim. PROOF (§2 C).
4. **(c) `RunResult.code` residual** — the coded class is exposed by headless (`RunResult.code`)
   but the CLI envelopes drop it: `scripts/rapidtool-cli.mjs:1142` (run/gate clean arm),
   `:795` `respondDriveOutcome` (resume/unattended). Owner 335-4 (**STOP-and-REPORT**, §6).
   `store.runUntilHitlAsync` (`store.ts:208`) has no `code` — owner 335-5 (report only).
5. **(c) atomic-write honest limit** — `saveProject` is write-temp-then-rename (process-crash
   safe, proven by the existing interrupted-save tests headless.test.ts:291–347) but the temp is
   **not fsync'd**: a power loss between the write and the rename can lose the newest bytes.
   No test can observe power loss, so this is reported, not changed (§6).

_Work log continues below (appended, never rewritten)._

---

## 1. (a) The journey actually advances and records — measured, all 13 phases

Probe (scratch, outside the repo): drive a fresh `FIXTURE_BRIEF` project with
`runUntilGate(p, { maxSteps: 1 })`, approving each stock HITL park with `approve(p)`, keyless
(`DEEPSEEK_API_KEY` deleted). Per phase: the transition, artifact delta (excluding the packet
row), log delta, memory delta, the live `runGate` verdict, and the persisted `PhaseRecord.gate`.
Real output (Node 22, post-fix; the driver is unaffected by the io fix):

```
P0  complete     artifacts+3[scorecard | algorithm | gate]      logs[phase.enter,scorecard.ready,algo.run,gate.verdict]  gate=pass  recordGate=pass
P1  complete     artifacts+1[gate]                              logs[phase.enter,algo.run,gate.verdict]                  gate=pass  recordGate=pass
P2  complete     artifacts+1[gate]                              logs[phase.enter,algo.run,gate.verdict]                  gate=pass  recordGate=pass
P3  complete     artifacts+1[gate]                              logs[phase.enter,algo.run,gate.verdict]                  gate=pass  recordGate=pass
P4  awaiting_hitl (stock gate)                                  logs[phase.enter,algo.run]                                parked     recordGate=null
P5  awaiting_hitl (stock gate)                                  logs[phase.enter,algo.run]                                parked     recordGate=null
P6  complete     artifacts+2[code:Sandbox result | gate]        logs[phase.enter,tests.pass,algo.run,p6.seal.unmet,gate.verdict] gate=FAIL(p6-verified+p6-brief-fit) recordGate=fail
P7  complete     artifacts+1[gate]                              logs[phase.enter,algo.run,p7.seal.unmet,gate.verdict]    gate=FAIL(p7-research) recordGate=fail
P8  awaiting_hitl (stock gate)                                  logs[phase.enter,algo.run]                                parked     recordGate=null
P9  awaiting_hitl (stock gate)                                  logs[phase.enter,algo.run]                                parked     recordGate=null  (cicd artifact +1)
P10 complete     artifacts+1[gate]                              logs[phase.enter,algo.run,gate.verdict]                  gate=pass  recordGate=pass
P11 complete     artifacts+1[gate]                              logs[phase.enter,algo.run,gate.verdict]                  gate=pass  recordGate=pass
P12 complete     artifacts+2[docs:OpenAPI 3.1 | gate]           logs[phase.enter,delivery.complete,algo.run,gate.verdict,run.complete.with.failed.gates,lesson.capture] gate=pass recordGate=pass
FINAL status=complete currentPhase=12 artifacts=31 complete=13/13
```

**Verdict.** Every phase is entered, records `phase.enter` + `algo.run`, and (once complete)
records a `gate` artifact + `gate.verdict` log + `PhaseRecord.gate`; every phase advances
exactly one step (`steps=1` each). The four HITL parks (P4/P5/P8/P9) are the **honest park
reasons** — a stock human gate by design, not a silent no-op; `approve` records the gate on the
approval edge. The keyless floor's red P6/P7 gates and the final `run.complete.with.failed.gates`
row are honest, not swallowed. Lane 335-1 owns the per-phase CONTENT (`phases.ts` / `codegen`):
P7's only phase-scoped deliverable in the keyless floor is its (red) gate artifact, which is a
content question for that lane, not a driver no-op. Pinned by the new test §3(a).

## 2. (b) Save/load is lossless and the atomic write is crash-safe — and one real LOSS bug, fixed

### B1 — the real defect: a record `saveProject` wrote could not be read by `loadProject`

Root cause (bytes). `saveProject` (headless.ts:233) serializes via `exportProjectJson` with **no
size bound**; `loadProject` (:113) delegates to `io.importProject` (io.ts:454) which refused any
string over `IMPORT_MAX_CHARS` = 5,000,000 (io.ts:47). A legitimate record past 5 MB was therefore
written but **unreadable by its own reader** — the wave's "no work is lost" violation. The cap's
own docblock says it is the hostile-**PASTE** bound (a giant string handed to the browser console);
`loadProject`'s `readFileSync` has already loaded the whole file, so the cap protects no memory
there and only strands the record.

**Fix, owned files only.**
- `io.ts` — `importProject` gains optional `opts.maxChars`; `undefined` ⇒ the historical 5 MB
  paste cap byte-for-byte, `Infinity` ⇒ no cap, any finite `>= 0` ⇒ that cap. Default behaviour is
  unchanged (the browser/console paste defense is intact).
- `headless.ts` — `loadProject` calls `importProject(raw, { maxChars: Number.POSITIVE_INFINITY, ...opts })`,
  so a caller may still pin a cap; the file it wrote is always readable.

**BEFORE / AFTER — real command (scratch, Node 22):** a `createProject` record padded past the cap.

```
BEFORE (HEAD 9cff073): loadProject THREW  loadProject(...big.json): Import payload too large (5,020,499 chars; cap 5,000,000)
AFTER  (this lane):    loadProject ok        id == the saved record's id; the same oversized STRING is still refused by importProject
```

### B2 — lossless + crash-safe proof for a REAL record (both new fields)

Real driven record (partial run, genuine phases/artifacts/logs) plus
`tokenUsage = { promptTokens:60000, completionTokens:17654, calls:12, cachedPromptTokens:5 }` and
`lastKeyedOutcome = { code:"RT_E_LLM_KEY_REJECTED", at:1759000000000, keySource:"the process environment (tail ...a1b2)" }`:

```
A1 tokenUsage preserved:            true  {"promptTokens":60000,"completionTokens":17654,"calls":12,"cachedPromptTokens":5}
A2 lastKeyedOutcome preserved:      true  {"code":"RT_E_LLM_KEY_REJECTED","at":1759000000000,"keySource":"the process environment (tail ...a1b2)"}
A3 byte-identical save→load→export: true
```

Legacy migration in place (both fields deleted, `_v` forced 1):

```
B1 legacy loads ok:            true
B2 tokenUsage stays absent:    true     (never fabricated)
B3 lastKeyedOutcome absent:    true     (never fabricated)
B4 _v migrated:                2        (hydrateProject stamps the current marker)
B5 no fabricated values:       true
C1 2-key legacy spend loads:   true  {"promptTokens":446,"completionTokens":0}  (calls read back honestly null)
```

Atomic write (the path `saveProject` uses: exclusive lock → temp write → `renameSync` → lock
release): the existing interrupted-save pins (headless.test.ts:291–347) already prove a killed
writer's half-written temp is inert, the original survives, and a retry lands. This lane adds the
residual facts directly:

```
D1 second save won:      true   (write-then-rename replaces the target atomically)
D2 no .tmp leftovers:    []
D3 no .lock leftovers:   []
E1 busyAware ok:         true, attempts 1
```

**Honest limit (not changed — see §5c).** `writeFileSync(tmp)` is not `fsync`'d before the rename,
so a power loss (not a process kill) between the two could lose the newest bytes. No test can
observe power loss, so per the RED-first rule I did not make an unobservable change; reported.

## 3. Tests added — RED-first where a fix exists, real results on both runtimes

- **headless.test.ts** `describe("W49 · 335-2 …")` +4 (134 → **138**):
  - (a) the 13-phase journey: each phase complete, `startedAt`, `PhaseRecord.gate`, a gate artifact,
    a `gate.verdict` log, a `phase.enter` log, and the seal at P12.
  - (b) driven record + `tokenUsage` + `lastKeyedOutcome`: `saveProject`→`loadProject` deep-equal
    for both fields **and** whole-record `exportJson(loaded) === exportJson(record)`.
  - (b) legacy record (fields deleted, `_v:1`) still loads, fields stay absent, `_v` migrates to 2,
    real artifacts survive.
  - (b) **RED-first**: the file loader reads back a record past the paste cap. Pre-fix it threw
    `Import payload too large (…cap 5,000,000)` (failure output captured above); post-fix green;
    the oversized PASTE is still refused.
- **io.test.ts** +1 (60 → **61**): `maxChars` lifts the cap only when asked; default cap unchanged;
  a caller-pinned cap still refuses.

| suite | baseline | after | Node 22.23.2 | Node 24.15.0 |
|---|---|---|---|---|
| `src/lib/headless.test.ts` | 134 | **138** (+4) | 138 pass / 0 fail | 138 pass / 0 fail |
| `src/lib/io.test.ts` | 60 | **61** (+1) | 61 pass / 0 fail | 61 pass / 0 fail |
| `src/lib/doctor.test.ts` | 31 | 31 (unchanged) | 31 pass / 0 fail | 31 pass / 0 fail |
| `src/lib/token-ledger.test.ts` | 39 | 39 (unchanged) | 39 pass / 0 fail | 39 pass / 0 fail |

`npx eslint` on all eight owned files → exit **0**. `npx tsc --noEmit` → exit **0**, 0 `error TS`
lines. No keyed call, no `npm run eval`, no full gate.

### Cross-lane test reconciliation (335-4's contract, my file)
The `E-25` subtest `emit --run … a green tree exits 0` (headless.test.ts, **owned by this lane**)
asserted W48's exit-5. Lane **335-4** deliberately changed that default to opt-in
(`--require-verified`), documented in its own log/USAGE. Because the consumer test is mine, I
reconciled it to the new contract and **added** the strict arm: default green tree → exit 0 with
`unverified:true` + `unverifiedDeclaredScripts`, and `emit --run --require-verified` → exit 5.
Both arms pass on both runtimes. One earlier full-suite run showed `E-25` red transiently while
335-4 was mid-edit; the reconciled suite is 138/0 and the failure no longer reproduces.

## 4. (c) Spend / doctor truth — verified end-to-end; `RunResult.code` residual REPORTED

Real CLI on a fresh process against a saved record carrying both fields:

```
doctor --project  → llm.configured true, keyState "rejected",
                    lastKeyed { code RT_E_LLM_KEY_REJECTED, keySource "the process environment (tail ...a1b2)" }
                    spend: "77654 tokens measured (prompt 60000 + completion 17654 · 12 call(s)) · est. cost n/a (no caller prices …)"
summary --project → budget { spent: 77654, cap: null, stop_reason: null }
```

So the W46/W48 spend + keyed truth reads back across a process boundary from the record alone —
confirmed, no keyed call.

**Residual (STOP-and-REPORT, not my files).** `headless.RunResult.code` (headless.ts:802/822) is
real bytes, but **no CLI envelope surfaces it**: `scripts/rapidtool-cli.mjs:1142` (the `run`/`gate`
clean arm) and `:795` `respondDriveOutcome` (the `resume`/`unattended` arm) construct their payloads
from `summary/steps/stopped/events` and omit `res.code`. A P6-synthesis 401 therefore cannot move
an agent driving `run`/`gate`/`resume` blind. Owner **335-4**; suggested exact shape: add
`...(typeof res.code === "string" ? { code: res.code } : {})` to both payloads. Likewise
`store.runUntilHitlAsync` (`store.ts:208`) carries no `code` for the console path — owner **335-5**.

## 5. What I did NOT do, and why

- **(a) Did not add per-phase CONTENT.** The driver records every phase; the thin keyless
  deliverables (e.g. P7's research artifact) are `phases.ts`/`codegen.server.ts` content owned by
  335-1 — reported, not edited (STOP-and-REPORT).
- **(b) Did not `fsync` the atomic write.** A process crash is already safe (rename + the existing
  interrupted-save pins); a power-loss window remains. A fix would be unobservable by any test, so
  it is reported as the honest limit, not landed against the RED-first rule.
- **(c) Did not edit `types.ts` / `engine.ts` / `checkpoint.server.ts` / `scripts/**`.** The
  `RunResult.code` CLI/store wiring is requested above with its exact shape.
- **Did not run the full gate, `npm test`, `npm run build`, `npm run eval`, or any keyed call.**
  Targeted suites only, five siblings mid-edit.
- **Did not print a secret** — only `configured: true` / tail-only source labels were inspected.
