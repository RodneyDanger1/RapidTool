# 345 F2 — core wiring fixer (engine + governance)

**Fixer:** this lane · **Root:** `C:\Users\mnril\Desktop\RapidTool Main` · **Wave base:** `06cb089` (clean)
**Ownership (STRICT):** `src/lib/engine.ts`, `src/lib/dod.ts`, `src/lib/store.ts` + `engine.test.ts`,
`dod.test.ts`, `store.test.ts`, `gates.test.ts`. Nothing else. **0 keyed calls.** No tracked-file deletion.
Scratch: `%TEMP%\rt345_f2\` (byte copy + `node_modules` junction, used only for mutation probes).
**Run command (both runtimes):** `node[22|24] --experimental-strip-types --test src/lib/{engine,store,gates,dod}.test.ts`

---

## 1. Landed fixes

### A1-03 — `verifyPriorPhases` (E-19) wired into the real report-ingest path — **WIRE**
**Decision:** wire it. The scanner needs only `report.files` + the report's phase, and `store.ingestReport`
(owned) already holds `v.report.files` after `validateReport`; no unowned file is required. Deleting the
guard would remove a real capability for no gain.
**Change:** `src/lib/store.ts` — imported `verifyPriorPhases` (engine) and, inside the `ingestReport` updater,
when the report applied and names files, run `verifyPriorPhases(live, v.report.phase, files)` and append one
`regression.drift` warn row per drifting prior phase (phase id + touching files + fresh unmet/recorded state).
Advisory only — prior records are never mutated (the scanner is pure). Fires on the pre-application `live`
record so the recorded prior gates are the comparison base.
**file:line:** `src/lib/store.ts:1753-1776` (`ingestReport` updater); consumer of `engine.ts:3620`.
**Tests:** `store.test.ts` (2) — drift emitted on a real touching report; no drift on a file-less report.
**RED (before wiring):** Node 22 `not ok 123 - 345 F2 (A1-03)… regresssion.drift` / `# pass 216 # fail 3`;
Node 24 exit 1, same assertion (`actual: 0, expected: 1`).
**GREEN (after):** Node 22 `# tests 219 # pass 219 # fail 0`; Node 24 `ℹ pass 219 ℹ fail 0`.

### A1-04 — A7 oracle seeds never reach the verify run — **STRIKE the claim + STOP-and-REPORT**
**Decision:** the *runtime* feed needs unowned files (`verify.server.ts` is not mine; its two callers are
`headless.ts` and `codegen.server.ts`, both unowned), so I took the task's "strike the claim" branch and
removed the false docblock claim in `dod.ts`. The enforcement mirror is real and wired in
`verify.server.ts` (`droppedPinnedOracleIds` guards `generateCases`'s `pinnedOracleIds`); it is simply
**un-fed**. See STOP-and-REPORT §3.
**Change:** `src/lib/dod.ts:1101-1117` — the E-08 comment now states the helpers are pure, names the wired
mirror, and declares the pinning DORMANT (the production callers pass neither `seeds` nor
`pinnedOracleIds`). No code behavior change; the helpers keep their pinned tests in `gates.test.ts`.
**RED/GREEN:** doc-only; no runtime assertion changes (`gates.test.ts` 88/88 both runtimes within the suite).

### A1-06 — console wild driver executes with no plan review — **ATTACH + LOUD ABSENCE**
**Decision:** the bytes do not support an unconditional refusal: `store.test.ts:1010` pins the keyless
console floor run (drives deterministically with no plan), and the browser has no server plan seam to call.
So the honest closure is (a) perform the SAME attach step headless performs — `headless.generateWildPlan`
is a public export — when the server reports a key, and (b) when no planner plan exists, record
`wild.plan_absent` (warn) so the run is never silently "plan-reviewed". A residual browser/server-fn gap is
reported in §3.
**Change:** `src/lib/store.ts:1352-1395` — before `stageWildPlan`, if the record has no planner plan, attempt
`headless.generateWildPlan` (lazy computed-specifier import; swallowed on browser/unavailable) and attach it
with a `wild.plan` row, else stamp `wild.plan_absent`. Explicitly **does not** fold adopted concurrent rows
into `cur` (only commits them) so H-06's union-merge semantics are preserved.
**file:line:** `src/lib/store.ts:1352-1395` (`startWildRun`), feeding `stageWildPlan` at `:1400`.
**Test:** `store.test.ts` — `wild.plan_absent` recorded on a keyless console start.
**RED (before):** Node 22 `not ok 126`; Node 24 exit 1 (`actual: false, expected: true`).
**GREEN (after):** as A1-03. Note: implementation first adopted concurrent rows into `cur`, which made the
H-06 pin fail (`0 !== 1`); fixed by committing the plan change without adopting it into `cur` — the isolated
regression is recorded here rather than hidden.

### A1-05 — four mutation-invisible guards + V1-M2 — **PINS (+ self-describing refusal)**
**Decision:** the four guards are correct on HEAD; the defect was that no test could fail on their removal.
Add fail-able pins. V1-M2's guard likewise already returns a shaped refusal on HEAD (probe:
`runGate(p,13)` → `{pass:false, unmet:[{id:"unregistered-13"}], evidenceHash:…}`), so the fix is the pin plus
a self-describing `reason` on the refusal item.
**Change:** `src/lib/dod.ts:864-877` — the unregistered-phase refusal item now carries
`reason: "phase N is outside the registered gate graph — runGate refuses rather than passing vacuously"`.
The four engine/store guards are unchanged (pinned, not altered).
**Tests added:**
- `engine.test.ts` — pause guard (`active+paused ⇒ noop`), priors-sealed guard (`ready edge, unsealed priors ⇒ paused RT_E_PHASE_ILLEGAL`), `approveHitl` forceHuman autopilot throw.
- `store.test.ts` — `canAutopilot` forceHuman excluded with a **passing** DoD gate (the old fixture's failing DoD masked it).
- `gates.test.ts` — `runGate(p, 13/-1/99)` coded refusal: id, reason, unregistered hash.
**RED (V1-M2 pin, before the reason was added):** Node 22 `not ok 28`; Node 24 exit 1.
**GREEN (after):** 219/219 both runtimes.
**Mutation proof (each pin fails when its guard is inerted, BOTH runtimes):**

| Mutation | Node 22 | Node 24 |
|---|---|---|
| `engine.ts:5137` `if (project.wildRun.pause) {` → `if (false) {` | CAUGHT | CAUGHT |
| `engine.ts:5220` `if (!priorsSealed(project.phases, phase)) {` → `if (false) {` | CAUGHT | CAUGHT |
| `engine.ts:1813` forceHuman throw guard → `if (false) {` | CAUGHT | CAUGHT |
| `store.ts:543` `if (project.hitl.forceHuman) return false;` → `if (false)` | CAUGHT | CAUGHT |
| `dod.ts:866` `if (!items) {` → `if (false) {` | CAUGHT | CAUGHT |

**Static:** `tsc --noEmit` = 0. Consumer suites unaffected: `wild-step · wild-seal · wild-mode.server ·
report-intake` = 105/105 (Node 22). Owned suites: Node 22 **219/219**, Node 24 **219/219**.

---

## 2. STOP-and-REPORT — items outside ownership (exact shapes, not edited)

### A1-07 — `io.ts:486` too-large import carries no code
Needs the registry code minted in `errors.ts` (also unowned). Exact edits:
1. `src/lib/errors.ts:108-112` — append to `ERROR_CODES` (after `"RT_E_LLM_KEY_SHADOWED",`):
   `"RT_E_IMPORT_TOO_LARGE",`
   and add a matching `ERROR_CODE_DOC` entry (meaning: import payload exceeds the paste cap; action: raise
   `opts.maxChars` for trusted file loads or trim the payload — never truncate silently). `errors.test.ts`
   pins registry/doc parity.
2. `src/lib/io.ts:484-487` — add the code to the existing return:
   ```ts
   return {
     ok: false,
     error: `Import payload too large (${json.length.toLocaleString("en-US")} chars; cap ${maxChars.toLocaleString("en-US")}).`,
     code: "RT_E_IMPORT_TOO_LARGE",
   };
   ```
   (`ImportResult`'s failure arm already carries `code?: ErrorCode`.)

### A1-08 — `token-ledger.ts:575` bare `Error` loses `.code`
Exact edit at `src/lib/token-ledger.ts:575-579`:
```ts
  if (!budget || typeof budget !== "object" || !budget.ledger || typeof budget.ledger !== "object") {
    const err = new Error(
      "recordBudgetSpend: budget must be a TokenBudget with a ledger object (RT_E_VALIDATION)",
    ) as Error & { code?: string };
    err.code = "RT_E_VALIDATION";
    throw err;
  }
```
No `errors.ts` change needed (`RT_E_VALIDATION` already registered); `classifyError` then returns the named
class instead of the caller's fallback.

### A1-04 — feed the pinned oracle ids (the owed wiring)
Two unowned call sites must forward the seeds + ids:
1. `src/lib/headless.ts:4288-4290` — `verifyGeneratedSource`:
   ```ts
   const { oracleToCaseSeeds } = await import("./dod.ts");
   return (await verifyAndFixServer(withCommonJsExports(source), project.brief, {
     seeds: oracleToCaseSeeds(project.oracle ?? []),
     pinnedOracleIds: (project.oracle ?? []).map((o) => o.id),
     budget: sessionTokenBudget(),
   })) as VerifyOutcomeShape;
   ```
2. `src/lib/codegen.server.ts:3633-3634` — the `defaultDeps.verify` binding must receive the same
   `seeds`/`pinnedOracleIds` in the `opts` its caller passes (`opts` is already threaded through the
   `verify` seam), so the keyed P6 verify run also pins the A7 rows.
`verify.server.ts` already consumes both (`verifyAndFixServer` opts → `generateCases` → `droppedPinnedOracleIds`),
so no change there. Until these land, the E-08 claim in `dod.ts` stays struck (now accurate).

### A1-06 residual — browser plan attach
The console can generate+attach a plan only where `headless.generateWildPlan` can load (node/SSR hosts, keyed).
In a real browser the dynamic import is denied, so the keyed console run honestly records `wild.plan_absent`
but cannot review a plan. A true browser fix needs a **server function** exposing plan generation (pattern:
`fixtures.review.ts` `createServerFn`) — new surface, unowned. Without it, the console remains a
floor/absent-plan driver; the headless/CLI drivers are the plan-reviewed path.

---

## 3. What remains (not mine / not landed here)
- A1-07 / A1-08 edits above (unowned files).
- A1-04 caller feeds (unowned files).
- A1-06 browser server-fn seam (unowned/new).
- A1-02 (factory claim wording), A1-09/A1-10/A1-11/A1-12/A1-13 from the audit — untouched, outside this
  ownership and not part of this fixer brief.

Only files written by this lane: `src/lib/engine.test.ts`, `src/lib/dod.ts`, `src/lib/store.ts`,
`src/lib/gates.test.ts`, `src/lib/store.test.ts`, and this log.
