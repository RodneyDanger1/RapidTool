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
