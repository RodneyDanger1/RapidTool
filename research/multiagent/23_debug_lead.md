<!-- DEBUG-LEAD-DOSSIER — research/multiagent/23_debug_lead.md -->
# 23 · Debug Lead Dossier — AI-facing surfaces: Chat · Wild Mode · Autonomous Agent Usage

**Role:** PRO DEBUG LEAD (read-only). Produced 2026-09-06 ~08:42 CDT, mid-wave.
**Scope:** (A) Chat surface, (B) Wild Mode autonomous loop, (C) autonomous-agent usage end-to-end (CLI/headless contract, error codes, idempotency). Ranked findings, every one with file:line + exact fix spec, plus a P0–P2 fix queue for the 6-agent final audit wave.
**Sibling dossiers 24–28** (Flash siblings) own the other slices: engine/store internals, dod/verify, packet/prompt-engine, console/UI, CLI/headless mechanics. This dossier references them by role and does NOT re-audit their files beyond the three surfaces named above. Chat-tab Radix activation is automation-only (mousedown needed) and is deliberately NOT re-filed (see skill `rapidtool-development` §Live E2E probes).

**Read-only discipline honored:** zero source edits this run. Every claim below was verified by reading the file or the pillar transcripts this session; as-of snapshots are dated. **PRE-LAND markers** flag findings whose anchors are expected to shift because the pillar wave (deleg_6611fbdd) is STILL EDITING — re-grep at apply time (fix-wave rule: verify anchor before every patch).

---

## 0 · Wave state at audit time (transcript reconciliation — tailed 2×, 08:25 & 08:35)

| Task | Pillar | State (from live logs) | Verified on disk |
|---|---|---|---|
| task-0 | 1+8 harvest | **CAP-DEATH pre-write** 07:55:11 (final line = "Writing src/lib/harvest.ts:") | `src/lib/harvest.ts` **ABSENT** (ls 08:41) |
| task-1 | 2+9 swarm | completed 08:24:51, 851/851 on rerun | swarm.ts + swarm.test.ts present |
| task-2 | 3+6 prompt-engine/exportProfiles | landed earlier (fixes/64) | present |
| task-3 | 4+12 verify/bench | running | bench.ts present |
| task-4 | 5+11+7 ast-mine/knowledge/watcher | running | present |
| task-5 | 10+13 hard-DoD + **Wild Mode** | **CAP-DEATH 08:44 (final verified)** — own summary: "hit the tool-iteration ceiling mid-task with the work partial and unverified — the codebase is currently in a state that will not typecheck (store interface declares the new actions but their implementations are not yet in the store body)" | engine.ts (08:22), types.ts (08:02), dod.ts (08:03), wild-mode.server.ts (08:08), store.ts (08:37, interface-only) |
| task-6 | UI overhaul (B7) | **CAP-DEATH 08:18:54** — honest handoff: "WildConsole body needs one more consistency pass… final gates/browser-verify outstanding" | console.tsx last edit 08:18:15; **leaves a live TS error** (see P0-2) |
| task-7 | verifier | running (read-only) | — |

**Live typecheck snapshot — taken 08:42 and re-confirmed 08:46 AFTER both tasks exited (`npm run typecheck`): EXIT 2, exactly 2 errors** — the whole repo compiles except these two, and NO builder remains to fix them (both owners died at cap):
- `src/lib/store.ts(504,19): TS2739 — initial state missing properties setEnforceDod, setWildMode, startWildRun, stopWildRun, toggleWildPause` → **B6's store actions are declared but NEVER implemented** (CONFIRMED final state, not mid-flight).
- `src/components/console.tsx(784,52): TS18047 — 'startedAt' is possibly 'null'` → **B7's last edit left a live compile error** (CONFIRMED final state).

---

# A · CHAT SURFACE

## A1 — P1 · Pre-network `not-configured` returns NO code and NO error text
**File:line:** `src/lib/chat.server.ts:181-183`
```ts
if (!isDeepSeekConfigured()) {
  return { ok: false, reason: "not-configured" };
}
```
**Evidence:** the mid-flight path forwards `res.code` (`:233-234`), but this pre-network arm carries neither `code` nor `error`. The console banner (`console.tsx:4374-4379`) promises "sends fail with a not-configured **error code**", yet the actual failure turn renders with `error: "Chat failed."` (chatOnceSafe fallback, `console.tsx:4273`) and **no badge** (`code` undefined → `ChatMsgRow` renders no RT_E pill, `console.tsx:4218`). A headless agent gets no machine signal that the failure is a key problem.
**Fix spec:**
```ts
return {
  ok: false,
  reason: "not-configured",
  error: "Copilot backend is not configured — set DEEPSEEK_API_KEY.",
  code: "RT_E_LLM_NOT_CONFIGURED",
};
```
**Test-pin collateral (MANDATORY):** `src/lib/chat.test.ts:148` pins the exact shape with `assert.deepEqual(res, { ok: false, reason: "not-configured" })` — update the expected literal to include `code: "RT_E_LLM_NOT_CONFIGURED"` (and `error` string) in the SAME fix, per the additive-result discipline (grep for `deepEqual` pins before extending result shapes).

## A2 — VERIFIED OK · Token budget is in-budget (no bug — recorded so nobody "fixes" it)
Worst-case input = system prompt (~800 chars) + grounded context ≤ **2,500** (`CHAT_CONTEXT_MAX_CHARS`, `chat.server.ts:41` + hard `slice(0, CHAT_CONTEXT_MAX_CHARS)` at `:160`) + user message ≤ **4,000** (`CHAT_USER_TEXT_MAX_CHARS` `:50`, `cutMarked` at `:202`) + history 6 × **800** (`CHAT_HISTORY_LIMIT` `:44`, `CHAT_HISTORY_TURN_MAX_CHARS` `:47`, `.slice(-6)` at `:216`). ≈ 12,100 chars ≈ 7–9k tokens worst case (code-heavy content inflates tokens/char). DeepSeek v4 flash context is 128k; output capped `maxTokens: 768` (`:226`). **In-budget with ~10× headroom.** No total-token cap constant exists and none is needed.

## A3 — P2 · NaN sort comparators can break the context's determinism claim
**File:line:** `src/lib/chat.server.ts:95` (`a.id - b.id`), `:107-109` (`b.gate.checkedAt - a.gate.checkedAt`), `:119-123` (`b.score - a.score`)
**Evidence:** hostile/legacy persisted payloads can carry phases without `id`, gates without `checkedAt`, memory rows without numeric `score`. `NaN` comparators are implementation-defined ordering (still stable in V8 today, but the header comment `:84-85` promises "Same input → same string" with "every sort has a total tiebreak" — NaN breaks that contract cross-engine).
**Fix spec:** coerce both operands: `(Number(a.id)||0) - (Number(b.id)||0)`, `(Number(b.gate?.checkedAt)||0) - (Number(a.gate?.checkedAt)||0) || (Number(b.id)||0) - (Number(a.id)||0)`, `(Number(b.score)||0) - (Number(a.score)||0)`. 3 lines, no test changes needed (existing determinism pins still pass; add one hostile-shape case to `chat.test.ts`).

## A4 — P2 · Cosmetic: `Pundefined (unknown)` and `status: undefined` on empty/partial projects
**File:line:** `src/lib/chat.server.ts:99-101` (`P${String(p.currentPhase)} (unknown)`), `:150` (`status: ${String(p.status)}`)
**Evidence:** `buildChatContext` correctly never throws on `{}` / null (`:90` coercion), but `String(undefined)` yields "Pundefined (unknown)" / "undefined" — ugly, honest-but-noise for a headless agent reading the context block.
**Fix spec:** `const cp = typeof p.currentPhase === "number" ? p.currentPhase : null;` → `cp === null ? "P? (no phase cursor)" : ...`; status → `String(p.status ?? "unset")`. (An empty project itself is valid input — chat must NOT hard-reject; this is a rendering polish only.)

## A5 — VERIFIED OK · History sanitization + turn caps are correct
`chat.server.ts:205-220`: non-array history → `[]`; role whitelist `user|assistant` only (**system-role smuggling dropped at the filter**, `:212`); per-turn 800-char `cutMarked` cap with marked tail; last-6 slice. UI side (`console.tsx:4305-4307`) sends only local rows (roles already constrained) and computes history BEFORE appending the current message (`:4314`) — the current message is never duplicated into history. UI render cap `trimTurns` 12 rows (`console.tsx:4163-4165`). **No fix.**

## A6 — VERIFIED OK · Grounding correctness (no stale-state leak at the seams)
- `buildChatContext` is built from the exact `project` object passed to `chatOnceServer` at send time (`chat.server.ts:204`) — a snapshot, never the store's mutable live object.
- `ChatPane.send` closes over the CURRENT render's `project` prop (`console.tsx:4302-4319`); the store updates immutably so a mid-flight wild-step cannot mutate the in-flight snapshot. Worst case is a one-render-old snapshot — acceptable, documented semantics, not a leak.
- Chips build prompts from LIVE state at click time (`explainGatePrompt`/`nextActionPrompt`/`packetPrompt`, `console.tsx:4338-4356`) — correct.
- UI wiring: `RunTab` union includes `"chat"` (`console.tsx:104`), trigger `value="chat"` at `:2166`, content `<ChatPane project={project}/>` at `:2304-2305`. Tab activation = Radix mousedown (NOT re-filed, automation-only).
- Error badge plumbing is honest and defensive: `normalizeCode` regex-whitelists `RT_E_[A-Z0-9_]+` (`:4168-4170`), `codeDocOf` never trusts `ERROR_CODE_DOC` shape (`:4184-4198`), warn-tone set matches the doc contract (`:4177-4182`), failure rows render badge + tooltip `agentAction` (`:4218-4235`).
**No fix.**

---

# B · WILD MODE AUTONOMOUS LOOP

## B0 — P0 · CONFIRMED-UNLANDED · The store contract is declared but NEVER implemented (and the UI is broken)
**File:line:** `src/lib/store.ts:95-98` (interface: `setWildMode` / `startWildRun` / `stopWildRun` / `toggleWildPause`), `:39-41` (`WildRunResult` type), `:504` (TS2739: initial state missing all four + `setEnforceDod`); `src/components/console.tsx:784` (TS18047 live error).
**Evidence:** B6 exited at the iteration cap 08:44 with the honest final: "the codebase is currently in a state that will **not** typecheck (store interface declares the new actions but their implementations are not yet in the store body)". B7 exited at cap 08:18:54 with `console.tsx:784` still erroring (`startedAt` read in the "since Ns" clock row; `WildRunShape.startedAt` is null-typed there). Re-verified 08:46: typecheck EXIT 2 with exactly these two errors. **The audit wave OWNS this landing — no builder is coming back for it.**
**Fix spec (audit wave):**
1. `console.tsx:784` — wrap the clock span in `typeof startedAt === "number" ?` (or change the shape read at `:305` to `number | undefined`).
2. Implement the four actions per B6's own pre-pinned contract (`types.ts:129-137` `WildRunState` field set), semantics to VERIFY at landing:
   - `setWildMode(id, on)` — sets `project.wildMode`; turning ON must NOT auto-start; turning OFF mid-run must stop the run (`active:false, stoppedAt`).
   - `startWildRun(id)` — returns `WildRunResult{ok, ran, stoppedReason}`; loop = `while (run active && !pause && steps < CAP)` calling `wildStep(snapshot, {})`; **natural stops** per the type doc (`store.ts:34-38`): `paused` (classifier/human/hard-DoD/error), `complete`, `cap` (defensive ceiling — recommend `WILD_RUN_MAX_STEPS = 20`, pause on cap with an honest `wild.paused_cap` log). MUST ride the ST-6 per-id serialization chain (`store.ts:105-115` comment) so a startWildRun can never race `executeAsync`/`runUntilHitlAsync`.
   - `stopWildRun(id)` — `active:false, pause:false, stoppedAt: Date.now()` + `wild.stop` log. A stop during an in-flight step takes effect at the NEXT `wildStep` gate check (engine.ts:2309-2314) — document that (no cancellation of an awaited step).
   - `toggleWildPause(id)` — toggles `pause`; `wildStep` honors pause at entry (`engine.ts:2312-2314`).
3. Re-run `npm run typecheck` — these are the ONLY two current errors; both must go to 0 before any other fix lands.

## B1 — P0 · engine.ts statically imports a `.server` module (client-boundary violation)
**File:line:** `src/lib/engine.ts:16` — `import { wildClassifierReview } from "./wild-mode.server.ts";` (+ type-only import `:17`)
**Evidence:** hard codebase rule: client modules must NEVER statically import `*.server.ts`. engine.ts is client-imported (store.ts → console). Today it bundles only because `wild-mode.server.ts` transitively imports only the client-safe `llm.ts` facade — but the rule exists for the server-boundary checker and future drift, and any future `.server` import inside wild-mode.server.ts silently breaks the client bundle.
**Fix spec (pick one, prefer (a)):**
(a) **Rename the module** `wild-mode.server.ts` → `wild-mode.ts` (it has NO server internals — only the `llm.ts` facade; the `.server` suffix is a misnomer). Update the 2 engine.ts imports, the module header comment, and any test/fixture references.
(b) Keep the name, dynamic-import inside `wildStep`: replace the default `opts?.reviewer ?? wildClassifierReview` with a cached lazy `getWildReviewer()` that does `await import("./wild-mode.server.ts")` and falls back to `{ ok:false, reason:"error", error:"reviewer unavailable" }` on failure — then engine.ts drops the static imports entirely. (Bare-Node import of the module itself is safe; it is the static CLIENT-side import that is the violation.)

## B2 — P0 · The classifier is structurally UNUSABLE from the CLI/headless host (mislabeled "not-configured")
**File:line:** `src/lib/wild-mode.server.ts:25` (`import { complete, llmStatus } from "./llm.ts"`), `:133` (default `statusFn = llmStatus`); `src/lib/llm.ts:46` (`statusServer = createServerFn`) + `:34` (`completeServer = createServerFn`), `llmStatus` catch → `{configured:false, models:[]}` (`llm.ts:78-83`).
**Evidence:** TanStack server-fns throw under bare Node ("No Start context"). On the CLI/headless host, `statusFn()` always resolves `configured:false` → `wildClassifierReview` returns `{ok:false, reason:"not-configured"}` (`wild-mode.server.ts:144`) **even with a valid DEEPSEEK_API_KEY** — Wild Mode's only advertised headless driver (loop `wildStep`) can therefore NEVER self-approve a gate via the CLI. Worse, the honesty label is wrong: the backend IS configured; the transport is what failed.
**Fix spec:** add a bare-Node reviewer binding following the proven `bareNodeLiveOverlay` precedent (headless.ts E-12): in `wild-mode.server.ts`, export `createBareWildClassifier()` that dynamic-imports `deepseek.server.ts` DIRECTLY (`isDeepSeekConfigured` / `completeDeepSeek`) and returns `{ok:false, reason:"error", error:"classifier transport unavailable (server-fn host)"}` when a Start context exists but the call throws. Wire it into the new headless wild export (see C1) as `opts.reviewer`. Do NOT change the browser path (client `complete()` works there).

## B3 — P0 · `wildLeavePhase` advance: stale packet + missing transition guards
**File:line:** `src/lib/engine.ts:2270-2279` (manual advance: `currentPhase: nextPhase`, `status:"running"`, next record → `"ready"`); compare `approveHitl`'s recompile at `engine.ts:989` (`sealPacketArtifact(attachAlgorithms(...))`) and `advanceOnce`'s guards at `headless.ts:409-416` (`canEnter` + `priorsSealed` before `advanceTo`).
**Evidence:** `applyPhaseResult` recompiles the packet (`engine.ts:866-867`), so after execution the packet describes "P{N} complete, cursor P{N}". `wildLeavePhase` then advances the cursor WITHOUT recompiling → the returned project's packet text (packet.ts derives `Next legal edge` from `project.currentPhase`, `packet.ts:293-295`) contradicts `currentPhase`, and `exportProjectJson`/`packet` CLI output is stale for a full step boundary. Also: the manual advance skips the `canEnter`/`priorsSealed` checks `advanceOnce` performs (`headless.ts:411-414`); a hand-imported project with an unsealed prior could be advanced past a broken edge.
**Fix spec (inside `wildLeavePhase`, after building `advanced`):**
```ts
const guardPhase = nextPhase;
if (!canEnter(phase, guardPhase)) return { project: wildPause(next, phase, "error", "wild.error", `Illegal transition P${phase}→P${guardPhase} — wild run paused.`), outcome: "paused", ran: true, error: "Illegal transition." };
if (!priorsSealed(advanced.phases, guardPhase)) return { project: wildPause(next, phase, "error", "wild.error", `P${guardPhase} priors not sealed — wild run paused.`), outcome: "paused", ran: true, error: "Priors not sealed." };
const packed = sealPacketArtifact(attachAlgorithms(advanced));
const stamped = wildPatch(packed, { lastAutoLog: `P${phase} sealed → P${nextPhase}`, lastAutoAt: Date.now() });
```
(imports `canEnter`, `priorsSealed` from `./phases.ts` already exist in engine.ts — verify; `sealPacketArtifact`/`attachAlgorithms` are module-local `:205`, `:758`.)

## B4 — P1 · 12-char feedback floor is bypassable (verdict line counts as feedback)
**File:line:** `src/lib/wild-mode.server.ts:116-125` (`parseWildReview`), guard at `:163-170`, engine-side re-check at `engine.ts:2103-2108`.
**Evidence:** if the model omits the `FEEDBACK:` marker, `feedback` falls back to the ENTIRE trimmed reply (`:122`), which still contains the matched `VERDICT: approve` line. A bare `"VERDICT: approve"` reply yields feedback `"VERDICT: approve"` (17 chars ≥ 12) → passes BOTH the classifier guard and the engine floor → logged to the ledger as a "review" with zero actual critique, and the phase advances. The honesty contract (header `:10-13`, "3+ sentences") is silently violated.
**Fix spec:** in `parseWildReview`, `if (!feedbackMatch) return null;` (a missing FEEDBACK marker is an unparseable payload → honest error path `:155-162`, loop pauses). Extra-prose tolerance is unaffected (prose around markers still parses). Add a regression test: `parseWildReview("VERDICT: approve") === null` and `parseWildReview("VERDICT: approve\nFEEDBACK: ok looks fine") === null` (7 chars < 12 handled downstream by the classifier guard; assert parser returns the verdict/feedback shape only when the marker exists).

## B5 — P1 · Wild surface emits NO RT_E_* codes (error-code coverage gap)
**File:line:** `src/lib/engine.ts:2008-2014` (`WildStepResult`: `{project, outcome, ran, error?}` — no `code`); `src/lib/store.ts:39-41` (`WildRunResult` — no `code`); `src/lib/wild-mode.server.ts:51-53` (`WildClassifierResult` — no `code`).
**Evidence:** every pause arm carries a prose `error` only; a delegation system driving the loop cannot branch on machine values (classifier failed vs human-only gate vs hard-DoD block vs cap). The CLI classifier (`classifyError`) matches none of this prose → all `RT_E_UNKNOWN`.
**Fix spec:** add optional `code?: ErrorCode` (import type from `./errors.ts`) to all three result types and stamp every `error` arm — mapping table: classifier error/unparseable → `RT_E_LLM_REJECTED`; classifier not-configured pause → `RT_E_LLM_NOT_CONFIGURED`; forceHuman/human-only pause → `RT_E_GATE_PENDING`; hard-DoD block → `RT_E_GATE_PENDING`; locked/rejected/missing-record/blocked pauses → `RT_E_PHASE_ILLEGAL`; engine exception (`:2381-2393`) → `RT_E_INTERNAL`; noop → no code. Additive field — no consumer breaks (they branch on `.ok`/`.error`), but grep for `deepEqual` pins on the result shapes before landing (test-file ownership: engine/store test suites).

## B6 — P1 · Emergency-pause race: `toggleWildPause` is toggle-semantics, UI passes a target
**File:line:** `src/lib/store.ts:98` (interface `toggleWildPause(id)` — 1-arg toggle); `src/components/console.tsx:726-745` (`onPauseToggle` reads live paused state, computes `target`, calls `wildSetPaused(projectId, target)` → shim maps to `toggleWildPause`, `:327-333`).
**Evidence:** if the live state flips between the read (`:728-731`) and the call (a wild step settling), a toggle executes in the WRONG direction — for an EMERGENCY pause that is the one control that must be race-proof. (Single-call-per-state-change is safe today only because no step is in flight during the read; not a guarantee.)
**Fix spec:** ship a value-taking action `setWildPaused(id, paused: boolean)` in the store (B6's contract gains one action; keep `toggleWildPause` for compatibility) and point `WILD_PAUSE_NAMES`/`WILD_RESUME_NAMES` at it FIRST in the lookup tables. If the store pillar refuses, the UI shim must call toggle ONLY after re-reading state immediately before the call (still racy — prefer the action).

## B7 — P2 · `status === "complete"` noop strands an active wild run
**File:line:** `src/lib/engine.ts:2325-2327`
**Evidence:** if the project reaches `complete` outside wildStep (sync store run / another surface), every subsequent `wildStep` returns `noop` WITHOUT finalizing — `wildRun.active` stays `true` forever in-session, the UI chip reads RUNNING on a complete project (only `hydrateWildRun` force-stops it on the NEXT reload, `engine.ts:1315-1319`).
**Fix spec:** change the branch to `return wildFinalize(project, project.currentPhase);` (the finalizer stamps `active:false, stoppedAt` + `wild.complete` log, `:2283-2296`).

## B8 — P2 · Zero Wild test coverage yet (PRE-LAND — re-check at wave end)
**Evidence:** `wild-mode.server.test.ts` does NOT exist; `engine.test.ts`/`store.test.ts` have zero `wildStep`/`wildRun` matches (grep 08:41). B6 is expected to add tests before finishing (brief: "Keep gates green") — the audit wave must VERIFY, and if absent, add at minimum: classifier parser floor regression (B4), wildStep noop/paused/completed paths, `hydrateWildRun` force-stop, `hardDodBlockInto` no-dup artifact, and a full `wildStep` DoD-floor advance with a stubbed reviewer.

## B9 — VERIFIED OK (recorded so nobody "fixes" them)
- **Self-approval ledger honesty:** approve row = `approveHitl(next, {decidedBy:"autopilot", note: feedback.slice(0,400)})` (`engine.ts:2191`) — machine actor named, classifier feedback is the note, nothing deleted; review + approval both logged (`wild.review` `:2135-2137`, `wild.approved` `:2220`).
- **forceHuman never self-approved:** checked BEFORE the reviewer (`engine.ts:2152-2161`), and `approveHitl` independently throws on autopilot×forceHuman (`engine.ts:914-916`) — double guard, unreachable but safe.
- **enforceDod interactions:** gate path re-checks DoD POST-approval and discards the candidate on failure (block stamped on the pre-approval shape — no fabricated row, no cursor move) (`engine.ts:2201-2214`); leave path blocks on unmet exit gate (`:2256-2269`); `hardDodBlockInto` replaces (never duplicates) the block artifact per phase (`dod.ts:480-485`).
- **Bounded loop:** one phase execution per call, no internal loops (`:1980-1986`, `:2357-2360`); driver cap is the store's job (B0).
- **Determinism floor preserved:** execution is `applyPhaseResult` (the exact sync-store synthesis, `:2369`) + the shared `recordGateInto` recorder (`:2379`); wild ledger entries are append-only with `slice(-200)` parity (`:2019-2024`).
- **Hydration honesty:** persisted ACTIVE runs are force-stopped with a `wild.stop` log (`engine.ts:1289-1318` hydrate + `:1508-1515` log emission) — session-break honesty landed.
- **Input immutability:** every helper spreads (`wildPatch` `:2027-2040`); `wildStep` never mutates its input.
- **Classifier context honesty:** review prompt built only from real artifacts/gate/lastTest/brief slices (`wild-mode.server.ts:77-109`); no invented evidence.

---

# C · AUTONOMOUS AGENT USAGE (CLI/headless contract)

## C1 — P0 · Capability coverage matrix: most agent-facing surfaces are UNWIRED from the headless driver and the CLI
| Capability | store action | headless export | CLI verb | Status |
|---|---|---|---|---|
| chat / copilot | — | **none** | **none** | **UNWIRED** — a delegation system cannot ground a question headlessly; `chatOnceServer` exists (`chat.server.ts:176`) but no driver exposes it |
| wildStep / wild run | declared, NEVER LANDED (store.ts:95-98, B6 cap-death) | **none** | **none** | **UNWIRED** — engine.wildStep exists (`engine.ts:2304`) but headless exports nothing (verified: `grep ^export headless.ts` — no wild/harvest/bench/chat/swarm/knowledge/watcher) |
| harvest | — | **none** | **none** | **UNWIRED + FILE ABSENT** — harvest.ts never landed (task-0 cap-death, §0) |
| bench (dry-run estimates) | — | **none** | **none** | **UNWIRED** |
| scaffold emit / ship-notes | — | **none** | **none** | **UNWIRED** — scaffold.ts exports `scaffoldProject`/`deplyNotes` but no CLI `emit`/`ship-notes` verb exists (CLI USAGE, rapidtool-cli.mjs:522-543 lists 17 verbs, none scaffold-adjacent) |
| swarm advisory | — | **none** | **none** | **UNWIRED** (landed library only) |
| knowledge / watcher / ast-mine | — | **none** | **none** | **UNWIRED** |
| `retry` after reject | store `retry` | headless `retry` EXISTS (`headless.ts:523`) | **NO VERB** | **UNWIRED** — the retry-after-rejection path (audit-46 open item) is unreachable from the CLI: an agent cannot apply a rejection note and retry |
| `enforceDod` opt-in | declared, guards landed (store.ts:294,359,477) | **none** | **none** | **UNWIRED** — hard-DoD can be toggled in the UI only |
| run/gate/approve/reject/ingest/packet/export/vault/search/crew/verify/design/diagram/artifacts/summary/doctor | ✓ | ✓ | ✓ (17 verbs) | **WIRED** — verified against `rapidtool-cli.mjs` switch (`:204-500`) |

**Fix spec (wiring wave — assign to the 6-agent audit wave as ONE coherent slice):**
1. headless.ts additive exports: `wildRunOnce(project, opts?)` (loop `wildStep` with a `maxSteps` cap, return `{project, steps, stoppedReason}` + `code` per B5), `chatOnceHeadless(project, text, history)` (direct `chatOnceServer` call), `harvestForPacket` passthrough (AFTER harvest lands), `runBench(project)`, `emitScaffold(project)` (pure — caller writes files), `retryCli` is already there (just wire the verb), `setEnforceDod(project, on)` pure passthrough.
2. rapidtool-cli.mjs new verbs (envelope + exit taxonomy untouched; `schema_version:1`): `chat --project --message` (exit 3 on not-configured via the existing exit-3 code pin, `:94-95`), `wild --project [--max-steps N]`, `retry --project`, `enforce-dod --project --on|--off`, `bench --project`, `emit --project --out <dir>`. Each must honor: one-JSON stdout (respond() single choke point `:89-110`), `@file`/stdin not needed (no raw payloads), `code` on every `{ok:false}` (respond() already adds it, `:91-106`).
3. README-cli.md: one row per new verb + RT_E_* table additions.

## C2 — P1 · Site-level error-code gaps (three known one-line fixes from wave-56, still open — verified on disk)
- **approve/reject no-pending-gate → `RT_E_UNKNOWN`:** `rapidtool-cli.mjs:243-245` and `:253-255` respond prose "No pending gate to approve/reject…" → text classifier has no matcher. **Fix:** add `code: "RT_E_GATE_PENDING"` to both `respond(...)` literals (respond() honors a pre-supplied `code`, `:91`).
- **ingest ReportRejectedError loses its name-based classification:** `rapidtool-cli.mjs:299-310` passes only `err.message` (a string) — `classifyError`'s `ReportRejectedError` name matcher never fires. **Fix:** call `ensureErrorCodes`-provided classifier on the REAL error object — expose the imported `classifyError` (currently only a text wrapper is stored, `:128-138`) or pre-supply `code: classifyError(err)` at the two respond sites (`:304`, `:309`). Expected: `RT_E_REPORT_PHASE_MISMATCH` / `RT_E_REPORT_INVALID`.
- **reject short-note → `RT_E_UNKNOWN`:** `rapidtool-cli.mjs:259-263`. **Fix:** add `code: "RT_E_VALIDATION"` to the literal.

## C3 — P1 · `ingest` duplicate-apply lie (idempotency honesty)
**File:line:** `scripts/rapidtool-cli.mjs:294` (`respond({ ok: true, path, summary, applied: true }, 0)` — hardcoded), `src/lib/headless.ts:544` (`export function ingest(project, rawReport): Project` — discards `applyReportResult`'s `applied` flag).
**Evidence:** re-ingesting the SAME report is a fingerprint no-op (`report-intake.ts` `applyReportResult` → `applied:false`), but the CLI always claims `applied: true` — an agent re-driving an idempotent ingest cannot detect the no-op (audit-46 open item, still true).
**Fix spec:** change `headless.ingest` to return `{ project, applied, reason }` (keep a 2-arg `ingest` facade if sibling tests pin the old shape — grep for `deepEqual`/direct `ingest(` callers first), CLI responds `applied: res.applied`. Update headless.test.ts pins.

## C4 — P2 · Idempotency of the remaining mutations (verified + two caveats)
- **VERIFIED:** `saveProject` is atomic (temp + rename, `headless.ts:58-74`); `recordGateInto` replaces (never duplicates) the per-phase gate artifact (`dod.ts:394-397`) but appends a fresh `gate.verdict` log per call (`:384-393`) — re-recording after a no-op advance is log noise, not corruption; `applyReportResult` fingerprint ids make ingest idempotent; `hardDodBlockInto` replaces its artifact per phase (`dod.ts:480-485`).
- **CAVEAT 1 — `create` silently overwrites:** `rapidtool-cli.mjs:208-211` + atomic save rename over an EXISTING `--out` file with no check — an agent re-running a create command destroys the prior project. **Fix:** `existsSync(out)` → exit 1 `code:"RT_E_VALIDATION"` ("out file exists; choose a new path or delete it") unless `--force`.
- **CAVEAT 2 — `verify --apply` re-apply:** a second `--apply` of a PASSED verdict re-stamps `lastTest` and appends another kind-"verify" artifact (`headless.ts:961` `applyVerifyOutcome`). **Fix:** make the verify artifact id evidence-hash-derived and replace-by-(kind+phase) like `recordGateInto` does, or no-op when `project.lastTest.evidenceHash === outcome.evidenceHash`.

## C5 — VERIFIED OK · Envelope + exit taxonomy discipline (recorded)
- One-JSON stdout through the single `respond()` choke point (`rapidtool-cli.mjs:89-110`); internal errors → exit 4 with stack on STDERR ONLY (`:505-512`); usage/validation exit 1; parked `awaiting_hitl|blocked` → exit 2 (`:226-236`); backend not-configured → exit 3 (`:395`, `:427-434`) with the exit-3 `RT_E_LLM_NOT_CONFIGURED` pin (`:94-95`); `schema_version:1, cmd, exit_code` on every envelope (`:90`, `:107`).
- `classifyError` cause-chain walk (≤4, cycle-safe) and the doc-completeness test are sound (`errors.ts:64-106`); all 14 codes documented (`ERROR_CODE_DOC`, `:113-184`).
- **Honest limitation (not a bug):** the CLI classifier receives error TEXT, so errno-only matchers can't fire — the README documents the emission subset (ENOENT appears in fs messages, so `RT_E_PROJECT_MISSING` works; verified `loadProject` throws raw `readFileSync` errors, `headless.ts:51-53`).

## C6 — P2 · `doctor` capability probe omits the new AI surfaces
**File:line:** `src/lib/headless.ts:1256-1294` (`doctorStatus` probes llm/research/runner/node only).
**Fix spec:** add `chat: {available: boolean}` and `wild: {classifier: boolean}` rows — both derive from the llm probe result (chat = llm.configured; wild classifier = llm.configured on a browser host / honest "server-fn host — bare reviewer required" note under bare Node, per B2). CLI `doctor` already passes the whole object through (`rapidtool-cli.mjs:491-500`), so this is headless-only.

## C7 — VERDICT · Can a Hermes-style delegation system drive this headlessly today?
**Partially — the deterministic spine is ready, the AI surfaces are not.**
What works NOW: create→run/gate→approve→reject→ingest→verify→export is a complete, envelope-clean, exit-code-clean loop (C5) with atomic persistence (C4) and one idempotency lie to fix (C3). What blocks true agentic use: no chat verb (C1), no wild verb (C1), the classifier is dead on the exact host a delegation system uses (B2), the store actions that the whole Wild pillar promises are not landed yet (B0), and error codes on the Wild loop don't exist (B5). After the P0+P1 queue below, a delegation system can drive: deterministic builds via the existing verbs; grounded Q&A via `chat`; unattended Wild runs via `wild --max-steps` with honest pause/stop/cap semantics; hard-DoD policy via `enforce-dod`. Remaining human-only gates (forceHuman) correctly pause Wild runs — a delegation system must still surface those to a human.

---

# FIX QUEUE for the 6-agent final audit wave (P0 → P2)

**Ordered. Each item = owner-hint + exact target + fix pointer to the section above. Verify every anchor on disk before patching (B6 may land more of store.ts; re-grep §0 markers).**

**P0 — must-fix (blocks build or blocks the autonomous mission):**
1. `console.tsx:784` TS18047 null-guard (B0) — one-line, unblocks typecheck.
2. `store.ts:504` TS2739 — implement `setEnforceDod` + the 4 wild actions per B0 spec (B6 exited at cap WITHOUT them — the audit wave owns this landing: ST-6 chain, ≤20-step cap, honest pause/stop). Then typecheck must be 0/0.
3. `engine.ts:16` static `.server` import (B1) — rename module or lazy default reviewer.
4. Bare-Node classifier (B2) — `createBareWildClassifier()` + wire via the new headless wild export; without it CLI Wild Mode is fake.
5. `engine.ts:2270-2279` stale packet + missing guards (B3) — recompile packet after advance; add `canEnter`/`priorsSealed`.
6. Headless wild + chat exports & CLI verbs (C1 matrix) — the autonomous-usage wiring wave.

**P1 — should-fix (honesty + agent-facing correctness):**
7. `chat.server.ts:181-183` not-configured code+error + `chat.test.ts:148` pin update (A1).
8. `wild-mode.server.ts:116-125` FEEDBACK-marker requirement + regression test (B4).
9. Wild result types gain `code` + stamp every arm (B5).
10. CLI site codes: approve/reject no-gate → `RT_E_GATE_PENDING`; ingest → `classifyError(err)`; reject short-note → `RT_E_VALIDATION` (C2).
11. `headless.ts:544` ingest `applied` honesty + CLI `:294` (C3).
12. `setWildPaused(id, bool)` action (B6) — race-proof emergency pause.

**P2 — polish (determinism hygiene, UX, completeness):**
13. `chat.server.ts:95/107/119` NaN sort coercion (A3) + `:99-101/:150` cosmetic nulls (A4).
14. `engine.ts:2325-2327` complete-noop → finalize (B7).
15. `rapidtool-cli.mjs:208-211` create overwrite guard (C4-CAVEAT1) + `verify --apply` re-stamp dedupe (C4-CAVEAT2).
16. `retry` CLI verb (headless export already exists) (C1).
17. `doctorStatus` chat/wild rows (C6).
18. Wild test coverage if B6's land lacks it (B8): parser floor, hydration force-stop, noop/pause/finalize, hardDod no-dup.
19. WildConsole polish if not completed by B7's successor: Stop button (WILD_STOP_NAMES already wired for lookup), STOPPED chip keying off `stoppedAt`, clock freezing on stop (seam doc "First at continue" list).

**Gate order at apply time:** land P0-1+P0-2 → `npm run typecheck` (must be 0) → P0-3..6 → per-module suites (chat 17/17, engine, store) → full lib suite foreground → `npm run build` → CLI smoke: `create→gate→approve→chat→wild --max-steps 3→export` with one-JSON asserts (cli-probe-harness.sh template) → browser-verify 9 RunTabs 0 console errors (dev server restart required — batch-owned servers die).

**Out of scope here (sibling dossiers own):** engine/store non-wild internals (24), dod/verify core (25), packet/prompt-engine (26), console/UI beyond the Chat+Wild seams (27), CLI/headless mechanics beyond the AI verbs (28).

---

## Appendix · Anchor drift log (reconcile at apply time)
- `engine.ts` grew to 2,394 lines at 08:22 (wildStep appended 1978+); re-anchor wildStep refs AFTER B6 finishes.
- `store.ts` 1,011 lines at 08:41, mtime 08:37 — **FINAL: wild actions absent** (B6 cap-death 08:44 confirmed; `:504` TS2739 proves interface-only). RE-GREP `startWildRun` before applying anything — the audit wave implements them.
- `console.tsx` 4,872 lines, mtime 08:18:15 (B7 cap-death). Chat anchors (`ChatPane` 4287, `chatOnceSafe` 4255) are stable (pre-wave); Wild anchors (WildConsole 588, WildToggle 492, `:784` error) are B7's latest and may shift only if a successor lands.
- `wild-mode.server.ts` 178 lines, mtime 08:08 (B6's classifier) — stable since 08:08.
- Typecheck snapshot 08:42 = EXIT 2 (store.ts:504, console.tsx:784) — the only two errors; if the audit wave sees MORE, a sibling landed mid-flight (attribute by `stat -c '%y'`).
