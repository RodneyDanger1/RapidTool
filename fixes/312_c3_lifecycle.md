# fixes/312_c3_lifecycle.md — C3 · THE LIFECYCLE FIXER (races, hangs, kills, budget)

**Lane:** C3 (this agent). **Baseline:** HEAD `59dc573` (suite green). **Inputs read:** `fixes/308_map6_time.md` (M6-03/M6-04), `fixes/311_se2_surfaces.md` (mock-arm hang, CF-SE2-3).
**Scope:** (1) mock-arm hang → bounded + structural refusal + pin; (2) M6-03 descendant reap (`taskkill /T`) + pin; (3) M6-04 `ingest ∥ run` lost update → coded busy on the run verb + preserved work + pin; (4) CF-SE2-3 budget default + ledger completeness + pins.

## FILE CLAIMS (log-note coordination — one writer per file)

C3 claims these surfaces:
- `src/lib/settle.ts` — **NEW**: bounded settlement + trust gates for never-settling awaits.
- `src/lib/settle.test.ts` — **NEW**: pins for the above.
- `src/lib/engine.ts` — **narrow regions only**: the wild reviewer resolution + `resolveWildReview` bound (`wildStep` area), `upgradeP6Keyed`, the narrative/research `recordBudgetSpend` wiring (CF-SE2-3b). No other regions.
- `src/lib/wild-step.test.ts` — C3 pins appended.
- `scripts/with-app-env.mjs` — M6-03 tree-kill (win32).
- `scripts/with-app-env.test.mjs` (existing test file — appended pins; verify actual name first).
- `src/lib/headless.ts` — `saveProject` busy-refusal classification (M6-04) + `runPhase` ledger spend if owed.
- `scripts/rapidtool-cli.mjs` — run-verb busy classification (M6-04) only (C6 owns remedy-text; C1 owns approval doors).
- `src/lib/token-ledger.ts` — budget default (CF-SE2-3a) + doc fix (CF-SE2-4).
- `src/lib/token-ledger.test.ts` / `budget.test.ts` (whichever exists) — pins appended.
- `src/lib/deepseek.server.ts` / provider seam — ledger completeness check (CF-SE2-3b) only if the trace lands there.
- `fixes/312_c3_lifecycle.md` — this log.
- `probe_c3_mockstarve.mjs` (repo root, temp) — removed before finishing.

## Status — IN PROGRESS

### 1. Mock-arm hang — ROOT CAUSE PROVEN, fix landing

**The exact arm (SE2's file):** `engine.ts:4332-4334` — `wildStep`'s default reviewer `(await import(clientSafeServerSpecifier("wild-mode"))).wildClassifierReview` — and `engine.ts:3030-3056` — `upgradeP6Keyed`'s `await codegen.liveP6Synthesis(p, deps)`. On the browser host the TanStack import-protection plugin rewrites the denied `*.server.*` specifier to a mock module whose **named exports are child proxies of a callable proxy** (`generateDevSelfDenialModule`: `export const wildClassifierReview = mock.wildClassifierReview`). `typeof … === "function"` is TRUE on a function proxy, so the engine's shape checks pass and the eventual `await` hits the mock's `then` trap.

**Probe (this lane, `probe_c3_mockstarve.mjs` — replicated the plugin's mock byte-for-byte):**
- a plain never-settling promise raced vs an 80 ms timer → timer FIRED at 106 ms (boundable);
- `await mock.someFn({})` raced vs a 200 ms timer → **EXIT=124 under `timeout 10`** — the `then` trap (`(f) => Promise.resolve(f(proxy))`) creates an **infinite microtask loop that starves the macrotask queue**; timers can never fire. So NO AbortController / Promise.race / setTimeout bound can ever rescue an await on the mock — the fix must REFUSE the value before awaiting (SE2's CF-SE2-1), and the settle bound is defense-in-depth for real never-settling promises (pending fetches).
- Transport note (why AbortController is not the missing piece): the real provider fetch is ALREADY AbortController-bounded — `llm/providers/deepseek.ts:449-450` (20 s flash / 60 s pro), `probe.ts:176-177`, `openai-compatible.ts:465-466`. The unbound arm was the mock-proxy await, which no abort can reach.

**Fix:**
- NEW `src/lib/settle.ts`: `isBareNodeHost`, `isTrustedCallable` (a callable whose `.name` is not a string = the exact mock shape → refused), `settleWithin` (race a REAL thenable vs timer; returns a discriminated result; never rejects; mock-shaped values refused WITHOUT touching `then`).
- `engine.ts`: host-gate both specifier arms (`isBareNodeHost()` — off-host → floor / honest unavailable reviewer); trust-check the resolved reviewer (provided + module export); `resolveWildReview` calls through `settleWithin` with a bounded window (`WILD_REVIEW_TIMEOUT_MS`, overridable via `WildStepOptions.reviewTimeoutMs`); a never-settling call now pauses **RT_E_LLM_TIMEOUT**; `upgradeP6Keyed`'s synthesis call gets the same hang bound → floor.
- Consequence: the store's `finally { releaseWildStart(id) }` (`store.ts:1292-1297`) now RUNS → the wild-start latch releases (SE2's latch observation closes with the same fix).

### 2. M6-03 descendant reap
### 3. M6-04 lost update
### 4. CF-SE2-3 budget

---

# D3 — THE LIFECYCLE COMPLETER (C3's items 2–4) — IN PROGRESS

**Lane:** D3 (finishing C3's owed items). **HEAD at start:** `de7deae` (tree clean; C-wave committed §1). **Read first:** §1 above + the C3 rescue summary (items 2–4's exact anchors).
**Rules honored:** NO keyed calls. Legs FOREGROUND. One writer per file — every file below re-read immediately before patching (siblings C1/C2/C6/D1 are live on `engine.ts`, `rapidtool-cli.mjs`, `headless.ts`).

## D3 scope (C3's items 2–4, anchors verbatim)

- **(2) M6-03** — `scripts/with-app-env.mjs:120-124`: a wrapper kill must reap DESCENDANTS (map6 probe: child 10696 + grandchild 15468 survived; heartbeats 14→27). Fix: win32 signal path shells to `taskkill /pid <child> /T /F` (the `node-runner.server.ts:164-171` pattern); POSIX keeps `child.kill(signal)`. Pins in `scripts/with-app-env.test.mjs`.
- **(3) M6-04** — `ingest ∥ run` lost update: run's save of completed phase work was refused `RT_E_BUSY` by the live lock and the process exited 4 with the work discarded. Fix: the run/gate arm's save goes through ONE busy-aware helper — bounded wait-and-retry (the errors.ts `RT_E_BUSY` agentAction remedy), then a coded refusal at the README-documented busy exit (**1**) carrying the `preserved` per-phase checkpoint (where the completed work lives; `resume` re-enters). Pin: NEW `scripts/cli-run-busy.test.mjs`.
- **(4) CF-SE2-3a** — budget default: unmetered-by-default STAYS (no silent arming of a ceiling; the ledger contract is caller-supplied). The ENVELOPE now says so EXPLICITLY: `packet.ts` `packetBudgetBoundary` reports a present-but-unmetered budget as `{spent, cap: null, stop_reason: null}` instead of `null` (`null` only when there is no budget object at all). Pins updated/appended in `src/lib/packet.test.ts`.
- **(4) CF-SE2-3b** — ledger completeness, wired where usage is in hand: engine narrative (`engine.ts` `fetchResearch`), bare-Node research overlay narrative (`headless.ts` `bareNodeLiveOverlay`), auto-review classifier (`wild-mode.server.ts` `wildClassifierReview`) → `recordSpend(sessionTokenBudget().ledger, usage)`. Pins: NEW `src/lib/budget-coverage.test.ts` (+ a behavioral classifier leg).
- **CF-SE2-4** — verified resolved on bytes at HEAD (`recordSpendWithinCap` IS exported at `token-ledger.ts:540`; the §12 doc already carries the "disproven on bytes" correction) — no edit.
- **§1 re-verification** — grep the `engine.ts` hang-fix markers + run `settle.test.ts` + `wild-step.test.ts` foreground.

## D3 file claims (additive to C3's list; coordination note)

- `src/lib/packet.ts` + `src/lib/packet.test.ts` — CF-SE2-3a envelope explicitness (unclaimed by any 312/313 lane).
- `src/lib/wild-mode.server.ts` — reviewer spend wiring only (unclaimed).
- `scripts/cli-run-busy.test.mjs` — **NEW**: M6-04 pins.
- `src/lib/budget-coverage.test.ts` — **NEW**: CF-SE2-3b pins.
- (No change planned to `cli-exit-taxonomy.test.mjs`: the run-verb refusal sets its code literally in the case arm, the emit/repair precedent — keeps C2's scripts-suite region untouched.)

## Evidence ledger (appended as items land)

---

# E2 — THE LIFECYCLE FINISHER (D3's owed items 3–4) — IN PROGRESS

**Lane:** E2 (finishing D3's owed items: M6-04 + CF-SE2-3a/b). **HEAD at start:** `54c6649` (tree clean; suite green). **Read first done:** the D3 section above + the D3 rescue summary (`subagent-summary-2-20260929_172353_350998.txt` — M6-04 + CF-SE2-3 confirmed UNLANDED).
**Rules honored:** NO keyed calls; legs FOREGROUND; one writer per file — every file below re-read immediately before patching (siblings live on `engine.ts` / `headless.ts` / `rapidtool-cli.mjs` / `packet.ts`).

## E2 scope (D3's owed items, anchors verbatim)

- **(3) M6-04** — the run/gate arm's save goes through ONE busy-aware helper (`headless.saveProjectBusyAware`): bounded wait-and-retry (each attempt re-enters `saveProject`, so the fixes/310 `reclaimStaleLock` discipline runs on every retry — a dead-holder orphan is reclaimed); still-busy ⇒ CODED `RT_E_BUSY` refusal at the README-documented busy exit **1** (never the global net's exit 4) carrying `preserved` — the run checkpoint beside the project dir where the completed phase work lives (`resume` re-enters from it). Pin: NEW `scripts/cli-run-busy.test.mjs` (source legs + behavioral two-writer spawn + retry-after-reap unit legs).
- **(4a) CF-SE2-3a** — unmetered-by-default STAYS (`tokenCapFromEnv` unset ⇒ unmetered; no silent arming). The ENVELOPE now states a PRESENT budget explicitly: `packet.ts` `packetBudgetBoundary` returns `{spent, cap: null, stop_reason: null}` for an unmetered budget (`null` ONLY when there is no budget object at all). Pins updated in `src/lib/packet.test.ts`.
- **(4b) CF-SE2-3b** — ledger completeness at the three unrecorded keyed sites, via ONE new helper `token-ledger.recordSessionSpend` (in-place into the process session ledger; NEVER throws — these are post-call recorders, not dispatch gates; I2: record every response that reports usage, success or refusal): `engine.ts` `fetchResearch` narrative, `headless.ts` `bareNodeLiveOverlay` narrative, `wild-mode.server.ts` `wildClassifierReview`. Pins: NEW `src/lib/budget-coverage.test.ts` (helper legs + behavioral classifier leg + source legs per site).
- **Verify-only (no edits expected):** M6-03 reap guards (`scripts/with-app-env.mjs` `reapChildTree` + the three signal routes) intact + `with-app-env.test.mjs`; §1 legs (`settle.test.ts`, `wild-step.test.ts`).

## E2 file claims (additive to C3/D3; coordination)

- `src/lib/token-ledger.ts` (CF-SE2-3b helper) — one insertion after `resetSessionBudget`; no other regions.
- `src/lib/packet.ts` + `src/lib/packet.test.ts` (CF-SE2-3a).
- `src/lib/engine.ts` — fetchResearch narrative spend line ONLY.
- `src/lib/headless.ts` — `saveProjectBusyAware` (after `saveProject`) + overlay spend line ONLY.
- `src/lib/wild-mode.server.ts` — classifier spend line ONLY.
- `scripts/rapidtool-cli.mjs` — run/gate arm save + busy-refusal block ONLY.
- `scripts/cli-run-busy.test.mjs` — **NEW** (M6-04 pins; imports headless.ts directly per the `next-action-arm-parity.test.mjs` precedent).
- `src/lib/budget-coverage.test.ts` — **NEW** (CF-SE2-3b pins).
- `fixes/312_c3_lifecycle.md` — this log.

## E2 evidence ledger (appended as items land)

*Filled post-hoc by 317 · J3: E2's lane ended before appending. At 317 entry, two of the three CF-SE2-3b sites + the named pin file were still open (byte-checked `fixes/314_f3_merge.md:29`: "token-ledger + engine so far (headless/wild-mode pending)"). J3 landed the tail; the legs E2 never ran were run foreground.*

- **[E2 scope · I4 landed · J3 verified]** M6-04: `headless.saveProjectBusyAware` (`headless.ts:278`) + CLI run/gate arm wiring (`rapidtool-cli.mjs:726`) + coded refusal block (`:723-742`, `preserved {checkpoint, present, resume}`) + pin `scripts/cli-run-busy.test.mjs` (4 tests). J3 re-ran @317: **4/4 pass** foreground (source leg + unit battery [free/live-refuse/transient/dead-pid-reap] + real two-writer spawn [exit 1 · RT_E_BUSY · preserved checkpoint · no stack] + crew leg).
- **[E2 → tree]** CF-SE2-3a envelope: `packet.ts:441 packetBudgetBoundary` (present-but-unmetered ⇒ `{spent, cap: null, stop_reason: null}`; `null` ONLY when no budget object) + pins `packet.test.ts:990-1043`. J3 re-ran: **62/62 pass**.
- **[E2 → tree]** CF-SE2-3b helper: `token-ledger.ts:387 recordSessionSpend` (in-place, never-throws; I2 record-success-and-refusal contract) + site 1 `engine.ts:2997` (fetchResearch narrative).
- **[J3 tail → tree]** CF-SE2-3b sites 2–3 landed: `headless.ts:442` (bareNodeLiveOverlay narrative) + `wild-mode.server.ts:276` (wildClassifierReview; the meter sits BEFORE the `!res.ok` early-returns so a refusal that burned tokens still counts) — both carrying the CF-SE2-3b/I2 comment; `recordSessionSpend` imported from the client-safe `token-ledger.ts` in both.
- **[J3 tail → pins]** NEW `src/lib/budget-coverage.test.ts` (10 tests): helper legs (in-place accumulation · null/undefined no-op · hostile numbers floor without escaping · records PAST a strict cap crossing without throwing) + behavioral classifier legs (refusal-with-usage records · ok-with-usage records · not-configured short-circuits before any provider call) + source pins per site + import.
- **[J3 legs]** foreground: `budget-coverage.test.ts` **10/10** · `token-ledger.test.ts` **31/31** · `packet.test.ts` **62/62** · `headless.test.ts` **106/106** · `wild-mode.server.test.ts` **10/10**. `grep -rn "recordSessionSpend(" src/lib/*.ts` sighted (excl. the helper def + tests) = **exactly the 3 sites** — T5.1's done-when.
- **[J3 note — no second half owed]** "loadProject-busy": `loadProject` (`headless.ts:102-107`) is a pure read; writes are temp+rename (`saveProject`), so readers never see a torn file and there is no busy semantics to carry. The refusal's `resume` re-entry is the T-107.7 checkpoint seam (`rapidtool-cli.mjs:818`). R2 fully closed — nothing further owed on this row.
- **[J3 boundary note — recorded, NOT landed]** `ingest`'s save (`rapidtool-cli.mjs:1167`) is a bare `saveProject` — outside E2's "run/gate arm ONLY" scope. A busy hit there surfaces via the global error net rather than the run arm's coded exit-1 + `preserved` block. Not an owed row (the report is re-ingestable; the `applied:false` duplicate-retry is pre-pinned, E-09); candidate for a future tiny swing — blocked this wave while J1 holds the CLI file (emit arm).
