# fixes/337_2_pulse.md — W51 · Lane 337-2 "Pulse" — surface, AI runtime, transports

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (folder name has a space → ripgrep-style search fails;
terminal `git grep` / `Select-String` only). **HEAD at open:** `dd6194c`, tree clean except
`?? wave_plans/W51/`, `?? fixes/337_4_verifier.md`.
**Runtime:** pinned Node 22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`); host Node v24.15.0; every parsed
`node --test` run used `--test-reporter=tap`. Scratch: `%TEMP%\rt337_2\`.
**Rules obeyed:** no full gate (siblings mid-edit); targeted suites only; no `npm run eval`; no keyed calls;
no secret printed; append-only log; NO tracked file deleted; minimal surgical patches.

> Step 0 read `wave_plans/W51/README.md` in full, then `fixes/336_0_parent.md`, `fixes/336_5_chrome.md`
> (my predecessor lane), `fixes/336_6_warden.md` (the auth-cluster finding), `fixes/335_0_parent.md`'s
> pointers, and the register appendices `AW45/AW46/AW47` (`research/multiagent/thoroughanalysis.md:1460-1521`).

## Step 0 — reconciliation

### Claimed (prior lanes that touched this domain)

- **336-5 Chrome** claimed: mobile header density fixed; `run.$id.tsx` state-aware `<title>`; global skip
  link; `ShellSurfacesCard` reads `store.wildPlanFor`; `WildToggle` handles `startWildRun`'s refusal;
  `ui-shell-guards.test.ts` (6 pins); owned suites `store/llm/fixtures.review/fixtures/ui-*` = 136/136.
- **336-6 Warden** claimed: `db.ts`, `gate-session-marker.ts`, `providers.ts`, `preview.ts` wired with real
  tests; the module-coverage allowlist 19 → 15; **`src/lib/auth/server.ts:48`** (extensionless `./preview`)
  is "the blocker for three live modules"; `src/lib/app-data/index.ts` + `src/lib/multiplayer/index.ts`
  proven dead; `auth/middleware.ts` has no caller.
- **334-5/332-5**: store run/approve failure arms carry `code?`; `codedFailureText`/`keyedRefusalSince`/
  `readLastKeyed` live; the console chip derives from the server keyed-outcome probe.

### On disk (verified today against bytes at `dd6194c`)

| Claim | Bytes found | Verdict |
|---|---|---|
| store failure arms carry `code?` | `store.ts:46`, `:72`, `:138`, `:147` | **present** |
| `codedFailureText` / `keyedRefusalSince` / `KEY_UNUSABLE_CODES` / `readLastKeyed` | `store.ts:69/79`, `:76`, `:99`, `:150` | **present** |
| `refreshStatuses` returns the fresh surface | `store.ts:1781` | **present** |
| `wildPlanFor` now has a consumer | `console.tsx:7280-7281` | **present (336-5 landed it)** |
| edge-triggered stale emit `staleEmitStep` | `store.ts:410` | **present** |
| `auth/server.ts:48` extensionless `./preview` | `server.ts:48` `} from "./preview";` | **present (the defect)** |
| `auth/server.ts` re-export is ALSO extensionless | `server.ts:261` `from "./providers";` (while `:41` is `./providers.ts`) | **new: a second one, not named by 336-6** |
| `gate-session.server.ts` extensionless imports | `:11` `./gate-identity.server`, `:12` `./gate-session-marker` | **present (unnamed by 336-6)** |
| `auth/middleware.ts` extensionless dynamic imports | `:33` `./client`, `:41` `./isolation.server`, `:42` `./verify.server` | **present (unnamed by 336-6)** |
| `auth/use-current-user.ts` doc points at `@/lib/auth/gates` | file `gates.tsx` (comment `:48`) | cosmetic only |
| `store.activeId` written/persisted, read only to clear itself | `store.ts:1070/:1966`; no consumer in `components/routes` | **present (still-open #3)** |
| `store.runP6Journey` no UI consumer | no hit in `components`/`routes` | **present (still-open #4)** |
| auth cluster cannot be loaded by the node runner | probe §1 below: `server.ts`, `verify.server.ts`, `popup.server.ts`, `gate-session.server.ts` all `ERR_MODULE_NOT_FOUND` | **present** |

### Still open (before this lane's edits, `file:line` for the last)

1. **`src/lib/auth/server.ts:48` + `:261`** — extensionless relative imports. `:48` blocks `server.ts`,
   `verify.server.ts`, `popup.server.ts` from the plain-ESM/node runner; `:261` blocks a re-export.
2. **`src/lib/auth/gate-session.server.ts:11-12`** — two more extensionless imports, blocking
   `gate-session.server.ts` (a live gate-identity plugin) from the runner.
3. **`src/lib/auth/middleware.ts:33,41,42`** — three extensionless dynamic imports.
4. **`store.activeId` dead state** (`store.ts:178`, `:1070`, `:1966`) — written/persisted, read only to
   clear itself; no render consumer. Candidate dead state → proposed (no deletion, rule 1).
5. **`store.runP6Journey` no UI consumer** (`store.ts:228`) — doc says "async UI face"; only tests drive it.
6. **`crew.server.ts:1210`** — plan-act reads `opts.roles` RAW, ignoring the `resolveRolesOverride`
   validation the same `runCrew` performed one screen earlier (see §2). **Found this lane.**
7. **`auth/server.ts:51`** `void ensureDbReady();` — floating promise; `db.ts:283-286`'s eager bootstrap
   `.catch` **rethrows**, producing an unhandled rejection that kills the process (the auth probe below
   died exactly this way: `triggerUncaughtException … (intermediate value).glob is not a function`).

---

## 1. Checkpoint — intended patch set (written BEFORE applying; rule 9)

All inside my owned files. Minimal, surgical; no reformatting.

| # | File | Change | Kind |
|---|---|---|---|
| P1 | `src/lib/auth/server.ts:48,261` | add explicit `.ts` to the two extensionless specifiers | contract (AGENTS.md: "Node imports use explicit `.ts` extensions") |
| P2 | `src/lib/auth/gate-session.server.ts:11,12` | add `.ts` | contract |
| P3 | `src/lib/auth/middleware.ts:33,41,42` | add `.ts` to the dynamic imports | contract |
| P4 | `src/lib/crew.server.ts:989-1000,1166-1174,1210` | thread the VALIDATED `roles` into `runPlanAct` instead of re-reading raw `opts.roles` | logic (RT_E code loss) |
| T1 | `src/lib/auth/auth-import-contract.test.ts` (new) | pin every relative import in `auth/**` carries `.ts`; import the now-loadable `gate-session.server.ts` | test (RED→GREEN) |
| T2 | `src/lib/crew.test.ts` | plan-act rejects/falls back on a non-array `roles` payload instead of throwing | test (RED→GREEN) |

**Not in scope / not landed:** `engine.ts`, `headless.ts`, `codegen.server.ts` (siblings); no store field
removed (rule 1).

---

## 2. What landed (diff: 7 files, +59/−13; 2 new test files)

### F1 · the auth cluster could not load under the pinned node runner (the named finding)

**Defect.** `src/lib/auth/server.ts:48` used an extensionless relative import (`} from "./preview";`),
violating AGENTS.md's explicit rule ("Node imports use explicit `.ts` extensions in the src chain
(strip-types)"). `:261` re-exported `./providers` extensionless while `:41` used `./providers.ts`.
`auth/gate-session.server.ts:11-12` and `auth/middleware.ts:33,41,42` had the same class.

**Probe (RED, HEAD bytes).** `%TEMP%\rt337_2\probe-import.mjs`, run on pinned Node 22.23.2:
```
FAIL src/lib/auth/server.ts :: ERR_MODULE_NOT_FOUND Cannot find module '…\src\lib\auth\preview' imported from …\server.ts
FAIL src/lib/auth/verify.server.ts :: ERR_MODULE_NOT_FOUND Cannot find module '…\auth\preview' imported from …\server.ts
FAIL src/lib/auth/popup.server.ts :: ERR_MODULE_NOT_FOUND Cannot find module '…\auth\preview' imported from …\server.ts
FAIL src/lib/auth/gate-session.server.ts :: ERR_MODULE_NOT_FOUND Cannot find module '…\auth\gate-identity.server'
```
**Fix (P1–P3).** Added the explicit `.ts` to those seven specifiers.

**The warden's remedy was necessary but NOT sufficient.** With the extensions fixed the same probe
advanced to a *second, independent* barrier:
```
FAIL src/lib/auth/server.ts :: ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX TypeScript parameter property is not supported in strip-only mode
```
`auth/pglite-dialect.ts` (imported by `server.ts:42`) used TS parameter properties
(`constructor(private readonly …)`), which strip-only mode rejects; `LazyPGliteDriver` also declared
`private readonly getClient` only as the parameter, so the class field had to become explicit. Fixed as
an explicit field assignment (behaviour-identical).

**GREEN (after).** `probe-import.mjs` on Node 22: **all 7 modules `OK`, process exit 0**:
```
OK src/lib/auth/server.ts · OK src/lib/auth/verify.server.ts · OK src/lib/auth/popup.server.ts ·
OK src/lib/auth/gate-session.server.ts · OK src/lib/auth/preview.ts · OK src/lib/auth/providers.ts · OK src/lib/db.ts
```
An all-module probe (`probe-allauth.mjs`) now loads 13/17 auth modules; the 4 remaining are structural
harness limits, not defects: `client.ts` + `use-current-user.ts` (`import.meta.env`, Vite-only) and
`gates.tsx` + `provider.tsx` (`.tsx`/JSX). Before this lane, 5 of those 13 (`server`, `verify.server`,
`popup.server`, `gate-session.server`, `middleware`) could not be loaded at all.

### F2 · `db.ts`'s eager PGLite bootstrap killed the process with an unhandled rejection

**Defect.** `src/lib/db.ts:283-287` (bottom-of-file, run at module load, never awaited) did
`console.error(...)` **and `throw err`** inside the `.catch`, re-creating a rejection that no one handles.
Node's default turns that into an uncaught exception: the whole server dies on any PGLite bootstrap
failure — including the benign "Vite `import.meta.glob` is absent outside Vite" case — even though every
later `getSql()` retries. `src/lib/auth/server.ts:51` added a second floater: `void ensureDbReady();`.

**Probe (RED).** `%TEMP%\rt337_2\spawn-probe.mjs` (imports `db.ts` in a child with no `DATABASE_URL`):
```
EXIT 1
STDOUT "IMPORT_OK\n"
STDERR-head "[db] PGLite bootstrap failed: … .glob is not a function …\r\nnode:internal/process/promises:394\r\n    triggerUncaughtException(err, true /* fromPromise */);"
```
**Fix.** `db.ts`: keep the log + slot-clear, drop the rethrow (the retry path already exists). `server.ts`:
attach an explicit `.catch` to the kick so it cannot float.

**GREEN (after).** same probe → `EXIT 0`, `IMPORT_OK`, and the failure **still reported**
(`[db] PGLite bootstrap failed: …`). New child-process test `src/lib/db-bootstrap.test.ts` pins exactly
that: module loads, failure reported, no `triggerUncaughtException`, exit 0.

### F3 · plan-act ignored the role validation the same function had just performed

**Defect.** `src/lib/crew.server.ts:1210` (old) re-read raw `opts.roles` in plan-act mode, while
`runCrew` had already run `resolveRolesOverride(opts.roles)` two screens earlier (which returns
`{roles:null}` — "no override" — for any non-array, and refuses unknown *names* with `RT_E_VALIDATION`).
A hostile server-fn payload (`roles` as a bare string; the crew server fn's validator is identity) made
plan-act index the string's characters into `ROLE_SPECS`, throwing a TypeError that escaped
`runCrewServer` and was mislabeled `RT_E_INTERNAL` by the client wrapper. Default mode handled the same
payload honestly.

**Probe (RED).** `%TEMP%\rt337_2\probeB.mjs`, Node 22, stub completer:
```
roles="coder"        => THREW TypeError: Cannot read properties of undefined (reading 'budgetTokens')
roles={"bogus":true} => ok=true mode=plan-act stopped=done
roles=5              => ok=true mode=plan-act stopped=done
```
**Fix.** Thread the validated `roles` into `runPlanAct` via `cfg`; delete the raw re-read. GREEN: same
probe → `roles="coder" => ok=true mode=plan-act stopped=done` (falls back to the P6 table).

---

## 3. RED → GREEN, as run

| Fix | Test | HEAD bytes | Lane bytes |
|---|---|---|---|
| F1/F2b auth imports + parameter properties | `src/lib/auth/auth-import-contract.test.ts` (2 pins) | **not ok 1 + not ok 2 → 0 pass / 2 fail** (temporarily reverted `./preview.ts`→`./preview` + one parameter property) | **ok 1 + ok 2 → 2 pass / 0 fail** |
| F2a `db.ts` bootstrap | `src/lib/db-bootstrap.test.ts` (1) | **not ok 1 → 0 pass / 1 fail** (`triggerUncaughtException … fromPromise`) | **ok 1 → 1 pass / 0 fail** |
| F3 plan-act roles | `src/lib/crew.test.ts` "uses the VALIDATED role table …" | probeB threw `reading 'budgetTokens'` | **ok → 52 pass** |

---

## 4. Wiring followed (the calls/importers that mattered)

- **`auth/server.ts`** (F1) ← imported by `auth/popup.server.ts:19` and `auth/verify.server.ts:3`;
  `verify.server.ts` ← `auth/middleware.ts:42`; `middleware.ts` ← the documented server-fn wrapper
  (no live importer). So one specifier blocked a 3-module chain — the warden's claim verified.
- **`auth/pglite-dialect.ts`** (F1) ← `auth/server.ts:42`. `LazyPGliteDriver.destroy()` deliberately does
  NOT close the shared PGlite singleton — confirmed by reading it; my field conversion preserves that.
- **`db.ts`** (F2) ← `auth/server.ts:38` (`ensureDbReady`, `getPglite`) and `vite.config.ts:40`
  (`ssrLoadModule`). The eager bootstrap is db.ts's own (bottom-of-file), and `ensureDbReady()` →
  `getSql()` → `createPgliteSql()` is the retry seam that makes dropping the rethrow safe.
- **`crew.server.ts`** (F3): `runCrew` → `resolveRolesOverride` → `runPlanAct`; the public
  `runCrewServer` server fn's validator is identity, and the client wrapper (`crew.ts:178-200`) is where
  the mislabel landed. Also read `token-ledger.runBudgetedCall` call sites (budget is threaded correctly
  into both default and plan-act paths — no seam ignores it).
- **Provider seams** (`llm/providers/*`): read `deepseek.postWithRetry`, `openai-compatible.getResponseWithRetry`,
  `registry.callModel` (role → provider → explicit-model validation), and `one-shot-fetch.server.ts`.
  The retry/backoff parameters (`sleep`, `random`) are threaded to the transports; timers are cleared
  (deepseek `:637`, openai `:596`, probe `:254`); the one-shot socket removes its abort listener on
  `close` and drains redirect sockets. **Clean verdict.**
- **`store.ts` / `console.tsx`**: every store action named in 336-5's wiring table still resolves;
  `wildPlanFor` has its consumer (`console.tsx:7280`); the `void` call sites at
  `console.tsx:490/985/1290/2155/4504` all carry rejection arms; `refreshStatuses` cannot reject (both
  probes are wrapped in `store.ts:1783-1828`), so its `void` call sites are safe; listeners/intervals are
  balanced (2/2 `addEventListener`/`removeEventListener`, 6/6 `setInterval`/`clearInterval`).
  **One latent exception, reported not fixed:** `console.tsx:2404` does
  `void rejectAsync(...).then(onFulfilled).finally(...)` with **no onRejected** — a `.finally` does not
  absorb a rejection, so IF `rejectAsync` ever rejected the record would float. It cannot today (the store
  action's own contract is "never throws"; its LLM block is try/wrapped), so this is defensive-only;
  left untouched to avoid a non-surgical edit in the 315 KB patch-only file. Exact patch if wanted:
  add an `onRejected` second arg to that `.then` (or a trailing `.catch`).

---

## 5. Mock / fake / placeholder census over every touched file

Pattern scan (`as any|@ts-ignore|@ts-expect-error|@ts-nocheck|TODO|FIXME|mock|fake|placeholder|stub|dummy`
+ empty `catch {}`) over `auth/server.ts`, `auth/gate-session.server.ts`, `auth/middleware.ts`,
`auth/pglite-dialect.ts`, `auth/auth-import-contract.test.ts`, `db.ts`, `db-bootstrap.test.ts`,
`crew.server.ts`, `crew.test.ts`:

| Term | Hits | Verdict |
|---|---|---|
| `as any` / `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` | 0 | clean |
| empty `catch {}` | 0 | clean |
| `TODO` | `crew.server.ts:1465` `TODO(F2-09)` (pre-existing: `crewToReport` has zero consumers, cited by the planned ingest path — the function IS implemented, honest provenance) | pre-existing, untouched |
| `mock`/`fake`/`stub`/`dummy` | `crew.server.ts:889/938/1450` + `crew.test.ts` (the documented DI *test seam* `createCrew`/`CrewCompleter` and its stubs) | honest test seam, not product fake |
| `placeholder` | `db.ts:88` "$1, $2 … placeholders" (SQL parameterization) | prose, not placeholder logic |

**Census result: clean.** My two new test files contain no prohibited tokens; no hardcoded return faking
a computation; no unfalsifiable assertion (the assertion-gap guard is clean over 131 files / 0 findings).

---

## 6. Tests added, with real results on BOTH runtimes

| File | new/changed | Node 22.23.2 | Node 24.15.0 |
|---|---|---|---|
| `src/lib/auth/auth-import-contract.test.ts` | **new** (2 pins) | 2/2 | 2/2 |
| `src/lib/db-bootstrap.test.ts` | **new** (1) | 1/1 | 1/1 |
| `src/lib/crew.test.ts` | +1 (51 → **52**) | 52/52 | 52/52 |

**Owned-suite totals (all of: `store` `llm` `chat` `crew` `llm-tasks` `db` `db-bootstrap` `app-data`
`auth/*` `llm/providers/*`):**
- Node **22.23.2**: **413 tests / 413 pass / 0 fail / 0 skipped**
- Node **24.15.0**: **413 tests / 413 pass / 0 fail / 0 skipped** (run as 197 + 218, overlap excluded)

**Requested per-suite counts (Node 22, before → after):** `store.test.ts` **93** (unchanged) ·
`llm.test.ts` 15 · `chat.test.ts` **82** · `crew.test.ts` 51 → **52** · `llm-tasks.test.ts` **17** ·
`db.test.ts` 5 · `auth/*` 34 → **36** · `llm/providers/*` **89**. Honest note on the README's grouping
"`llm.test.ts` + chat + fixtures 130": measured today `llm 15 + chat 82 = 97`, and adding
`fixtures.test.ts 8` + `fixtures.review.test.ts 7` gives 112, not 130 — I could not reproduce 130 from
those file names, so I report the measured per-file counts instead of asserting the group. The fixtures
suites are not in my ownership this wave (unchanged).

**Targeted guards (no full gate — siblings mid-edit):**

| Check | Result |
|---|---|
| `npx tsc --noEmit` (src leg) | **exit 0**, 0 errors |
| `npx eslint` on all 9 touched/new files | **exit 0, 0 warnings** |
| `node scripts/check-module-coverage.mjs` | **107/122 · 15 allowlisted · 0 unallowlisted · 0 stale · exit 0** |
| `node scripts/check-assertion-gaps.mjs` | **clean — 131 files, 0 findings · exit 0** |
| `scripts/check-module-coverage.test.mjs` / `check-assertion-gaps.test.mjs` / `check-auth-invariant.test.mjs` | **7/7 · 30/30 · 11/11** |
| keyed calls | **0** |

---

## 7. Cross-domain / STOP-and-REPORT (not edited)

1. **`scripts/check-module-coverage.mjs:56-67` — five allowlist reasons are now factually FALSE.**
   They describe exactly the blockers this lane fixed:
   - `:56-57` `auth/gate-session.server.ts` — "its own relative imports omit the extension" (now `.ts`);
   - `:58-59` `auth/pglite-dialect.ts` — "constructor parameter properties … rejected by strip-only mode"
     (now explicit fields);
   - `:60-61` `auth/popup.server.ts` — "transitively imports auth/server.ts, whose `./preview` specifier
     omits the extension" (now `.ts`);
   - `:62-63` `auth/server.ts` — same `./preview` claim (now `.ts`);
   - `:66-67` `auth/verify.server.ts` — same transitive claim (now `.ts`).
   **Proposed patch:** delete those five entries (their modules are now node-loadable, so a test CAN reach
   them) and re-word `:76-77` `auth/middleware.ts` (now loadable; still zero importers). **Not edited:
   `scripts/**` is unowned this round.** A future lane that imports those five from a test MUST delete
   the entries in the same patch or the guard's staleness check will fail (that is the ratchet working).
2. **`src/lib/auth/client.ts:38`** (`import.meta.env`) and **`use-current-user.ts`** (imports `client.ts`)
   — remain harness-blocked; a Vite-only transform, not a defect.
3. **`src/lib/auth/gates.tsx` / `provider.tsx`** — `.tsx`/JSX; the runner refuses the extension. No fix
   proposed (a `.tsx` test runner is out of contract).
4. **`src/lib/llm/providers/registry.ts:701`** `TODO(R13-f09)` — the unarmed fallback chain returns a
   coded `RT_E_VALIDATION` refusal rather than faking failover; honest by design, left as-is.

---

## 8. Still open (carried / confirmed; not fixed)

1. **`store.activeId` dead state** (`store.ts:178`, written at `:1464/:2016/:2082-2115`, persisted at
   `:1070`, read only to clear itself at `:1966`, plus tests) — no render consumer. Candidate dead state
   → **proposed, not deleted** (rule 1).
2. **`store.runP6Journey` has no UI consumer** (`store.ts:228`; only `store.test.ts`) — proposed, no new
   keyed control added (out of scope).
3. **`auth/middleware.ts` has zero importers** (`authMiddleware` is the documented server-fn wrapper) —
   wire or remove; proposed (unchanged from 336-6).
4. **`auth/gates.tsx` has zero importers** — proposed (unchanged from 336-6).
5. `app-data/index.ts`, `multiplayer/index.ts`, `multiplayer/p2p.ts` — dead/dormant, proven by 336-6;
   nothing deleted this lane.

---

## 9. Clean verdicts (probes / reads, no defect found)

- **Provider transports** (`one-shot-fetch.server.ts`, `deepseek.ts`, `openai-compatible.ts`, `probe.ts`):
  retry parameters threaded; timeout timers cleared (`deepseek:637`, `openai:596`, `probe:254`); the
  node:http one-shot removes its abort listener and drains redirect sockets; `agent:false` never pools.
- **`chat.server.ts` / `chat.ts`**: history is capped/forwarded (registry `CallModelOptions.history` is a
  real field), slash tools are keyless and dual-channel-safe, every failure arm carries an `RT_E_*` code,
  `parseChatFrame` rejects a codeless failure terminal. No defect.
- **`llm-tasks.ts`**: each task forwards its `thinking` pin and returns a coded refusal on unparseable
  output; no fabrication path.
- **`console.tsx` surface**: listeners/intervals balanced; every `void`-ed promise has an acceptance or
  rejection arm; `WildToggle`'s refusal is handled (336-5). No new defect.
- **`app-data/client.server.ts`**: empty-2xx and 3xx-with-empty-body no longer fabricate success; 401
  bypasses the failure memo; memo key hashes the concrete token. No defect.

---

## 10. Cleanup / rules

- **No tracked file deleted** (`git diff --name-status` for my paths: 7 `M`, 0 `D`; the two new test files
  are `??`). No file rewritten or reformatted.
- Scratch confined to `%TEMP%\rt337_2\`; **no probe file in the repo**. `git status` shows only my 7
  modified + 2 new test files + this log (siblings' edits are in other files).
- No dev server started → no port to release; no stray `node` process owned by this lane; no socket left
  open. 0 keyed calls; no secret printed (the `.env` key was never read).
- Re-ran the two RED probes only after restoring the fixes; the working tree carries no `RED-PROBE`
  marker (`git grep "RED-PROBE"` → 0 in tracked files).

## Verdict

Three defects in the surface/AI-runtime/auth domain, all RED-first and fixed: the **auth cluster's
unloadability** (extensionless imports in `server.ts`/`gate-session.server.ts`/`middleware.ts` *and* the
parameter properties in `pglite-dialect.ts` — the warden's single-line remedy was necessary but not
sufficient, now proven by probe: 13/17 auth modules load, 5 that could not before); **`db.ts`'s eager
bootstrap killing the process** with an unhandled rejection (`auth/server.ts` floated a second one); and
**plan-act ignoring its own role validation**, losing `RT_E_VALIDATION`/honest-fallback to a mislabeled
`RT_E_INTERNAL`. Owned suites **413/413 on both runtimes** (+4 tests); typecheck 0; lint 0; coverage
guard unchanged; assertion guard clean. Five stale `scripts/**` allowlist reasons are reported, not
edited. No fabrication, no mocks, no deletions, no secret printed, no probe left behind.

---

# FOLLOW-UP (watchdog round) — 2026-10-02

Read first: `fixes/337_4_verifier.md` (its §4/§14 REFUTED my import pin) and `fixes/337_5_guardian.md`
(§A/§F). All three fixes were independently confirmed by the watchdogs; three follow-up items were
assigned to me. **All three are LANDED.** Scratch: `%TEMP%\rt337_2\` (nothing in the repo).

## Item 1 — the import pin could not fail for its own class — FIXED

**The Verifier was right.** `auth-import-contract.test.ts`'s predicate `!/\.[A-Za-z0-9]+$/.test(last)`
accepted `.server` / `.client` as an "extension", so the three real `.server`-shaped offenders it
exists for were unprotected: reverting `gate-session.server.ts:11` and `middleware.ts:41-42` left the
pin GREEN.

**Fix.** Replaced the loose predicate with an explicit code-extension check
(`CODE_EXT_RE = /\.(?:ts|tsx|mts|cts|mjs|cjs|js|jsx|json)$/`), documented why `.server`/`.client` are
NAME segments (the real file is `gate-identity.server.ts`), and renamed the pin to say "code extension".

**Mutation proof (scratch copy `%TEMP%\rt337_2\mut-auth\`, the fixed bytes), pinned Node 22.23.2:**
each offender was reverted in that copy and the pin run against it — real output:

| Scratch mutation | Pin result | Offender(s) named |
|---|---|---|
| none (fixed bytes) | **GREEN** `# tests 2 / fail 0` | — |
| `server.ts` `./preview.ts` → `./preview` | **RED** `not ok 1 / fail 1` | `server.ts → ./preview` |
| `gate-session.server.ts` `./gate-identity.server.ts` → `./gate-identity.server` | **RED** `not ok 1 / fail 1` | `gate-session.server.ts → ./gate-identity.server` |
| `middleware.ts` `./isolation.server.ts` + `./verify.server.ts` → extensionless | **RED** `not ok 1 / fail 1` | `middleware.ts → ./isolation.server` **and** `middleware.ts → ./verify.server` |
| restored | **GREEN** `# tests 2 / fail 0` | — |

So all three offenders (two of which the Verifier proved were unprotected) now trip the pin.
Harness: `%TEMP%\rt337_2\mutate.ps1` (ASCII-only; the first draft's `→` broke PowerShell 5.1 parsing).

## Item 2 — five false allowlist reasons in the module-coverage guard — FIXED (granted this round)

`scripts/check-module-coverage.mjs`: the entries for `auth/gate-session.server.ts`,
`auth/pglite-dialect.ts`, `auth/popup.server.ts`, `auth/server.ts`, `auth/verify.server.ts` each
claimed a blocker this lane removed ("its own relative imports omit the extension", "transitively
imports auth/server.ts, whose `./preview` specifier omits the extension", "constructor parameter
properties … rejected by strip-only mode").

**Fix (reasons rewritten, entries KEPT because no test reaches these modules yet).** Each now reads
`NOW NODE-LOADABLE — W51 · 337-2 …` with the module's real remaining class: it is live and importable
but has **no driveable behaviour in the node harness** (Better Auth `/get-session` context, a PGlite
instance, `auth.api.signInWithOAuth2`, a live DB + broker, the TanStack `getRequest()` context). The
section header comment was corrected too (it said the whole block "cannot be imported by the runner"),
and the top docblock notes the extensionless-import/parameter-property classes were cleared in W51.
`auth/client.ts` and `auth/use-current-user.ts` keep their accurate `import.meta.env` HARNESS-BLOCKED
reasons. **Entries were not deleted**: the guard's own rule is "entries may only be REMOVED by adding a
real test", and no test reaches these five.

**Counts (before → after, measured):** reachability and allowlist are unchanged because only prose
changed — **107/122 reached · 15 allowlisted · 0 unallowlisted · 0 stale · exit 0** before **and** after.
`node scripts/check-module-coverage.test.mjs` → **7/7 pass / 0 fail**.

## Item 3 — `console.tsx:2404` floating rejection — FIXED

Decided to **handle it** (the WildToggle precedent), not merely pin it as unreachable. The store action
`rejectAsync` cannot reject today, but `void rejectAsync(...).then(onFulfilled).finally(...)` drops a
rejection (`.finally` does not absorb one), so the call site now takes an `onRejected` that surfaces the
message. Surgical: a 5-line insertion in the existing `.then(` argument list, **no reindent of existing
lines**, `console.tsx` non-null assertions stay **0** (bang-dot 0 / bang-paren 0 / bang-semi 0).

**RED-first via the existing harness hook** (`ui-shell-guards.test.ts` already supports
`RT336_CONSOLE_TX` to point a pin at a pre-change copy — no working-tree mutation needed). New pin
added: "Reject dock handles a rejection from rejectAsync (no floating promise)".

| Run | Result |
|---|---|
| `RT336_CONSOLE_TX=%TEMP%\rt337_2\console-pre.tsx` (pre-fix HEAD bytes) + the new pin | **RED** — `ok 1..6`, `not ok 7 - Reject dock …`, `# tests 7 / pass 6 / fail 1` (the other six pins stay green: the pin is specific, not over-broad) |
| working tree (post-fix) | **GREEN** — `# tests 7 / pass 7 / fail 0` |

## Verification (done-when)

| Check | Result |
|---|---|
| auth suites + import-contract pins, `store` (93), `ui-shell-guards`, `ui-surface-guards`, `crew`, `db`, `db-bootstrap` — **Node 22.23.2** | **201 tests / 201 pass / 0 fail / 0 skipped** |
| same set — **Node 24.15.0** | **201 tests / 201 pass / 0 fail / 0 skipped** |
| `scripts/check-module-coverage.test.mjs` (7) + guard | **7/7**, guard **107/122 · 15 allowlisted · 0 stale · exit 0** |
| `node scripts/check-assertion-gaps.mjs` | **clean — 133 files, 0 findings** |
| `npx tsc --noEmit` | **exit 0**, 0 diagnostics |
| `npx eslint` on all 12 touched files | **exit 0, 0 warnings** |
| full owned suite set (Node 22) | **413/413 pass / 0 fail** |
| `console.tsx` non-null assertions | **0** |

Note on suite sizing: `ui-shell-guards` (7 after this lane's +1) + `ui-surface-guards` (7) = **14**, not
the 13 the brief named — I report the measured 14.

**Prettier (honest note, no fix needed):** `npx prettier --check` flags `console.tsx`,
`ui-shell-guards.test.ts`, `scripts/check-module-coverage.mjs` — but a node-API probe proved **all three
already deviated from prettier canonical at HEAD** (`.prettierignore`'s own TODO says the formatter is
"shipped but never enforced"). `npm run lint` (eslint-config-prettier) is the enforced gate and is 0
warnings; my hunks introduce no new formatting class, and the console hunk deliberately avoids
reindenting unrelated lines.

**Rules:** no tracked file deleted (`console.tsx` 1 hunk, the guard 1 hunk, the two test files); no
reformat-only hunk; no mock/fake; no keyed calls; no `npm run eval`; no secret printed; scratch confined
to `%TEMP%\rt337_2\`; the two mutation/probe copies live outside the repo (`git status` shows only the
expected ` M`/`??`). **Verdict: all three watchdog items LANDED with RED/GREEN shown.**
