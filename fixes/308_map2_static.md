# 308 — MAPPER-2: STATIC-ANALYSIS BUG MAP (extended-strictness probe · eslint deep-pass · async-hazard sweep · coverage-gap map)

**Lane:** MAPPER-2 (static analysis) · **Probes executed at:** `800a40d` · **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`
**Provenance note:** while this lane ran, `70108c6` landed (P-1/P-2 wildStep fix — engine.ts only, hunks `@@4147+`). Every `engine.ts` line cited below is above 4147 and therefore valid at both commits; all other cites untouched.
**Rules honored:** map-only, ZERO product edits; no keyed calls; scratch configs deleted after the run (§6).
**Companion:** `fixes/308_bugmap.md` (TRACER, deleg_b476eb10) — read, untouched.
**Bottom line:** **1107 new shipped-file diagnostics** across 5 instruments (336 nuia + 87 eopt + 4 nup + 648 eslint-lib + 32 eslint-UI). **0 verified runtime-crash bugs** (every index-deref chain carries a guard); **1 theoretical latent crash** (M2-04, crew role table fallback); **2 lying-type chains** where the guard is load-bearing and the type is wrong (M2-01, M2-02) — these are the "don't let a lint cleanup delete the guard" register (M2-03). Shipped code has **zero floating promises**; the once-fatal async class is clean (M2-13).

---

## 0. Instrument battery (verbatim)

| # | Probe | Command | Result |
|---|-------|---------|--------|
| S0 | scoped baseline | `npx tsc -p tsconfig.probe2-base.json` (`include:["src/lib"]`, no extra flags) | **exit 0, 0 diagnostics** → every hit below is NEW |
| S1 | `noUncheckedIndexedAccess` | `npx tsc -p tsconfig.probe2-nuia.json` | exit 2 · **878 errors** (336 shipped / 542 test) · ~26s |
| S2 | `exactOptionalPropertyTypes` | `npx tsc -p tsconfig.probe2-eopt.json` | exit 2 · **108 errors** (87 shipped / 21 test) · ~27s |
| S3 | `noImplicitOverride` | `npx tsc -p tsconfig.probe2-nio.json` | exit 0 · **0 errors** |
| S4 | `noUnusedLocals` | `npx tsc -p tsconfig.probe2-nul.json` | exit 0 · **0 errors** |
| S5 | `noUnusedParameters` | `npx tsc -p tsconfig.probe2-nup.json` | exit 2 · **4 errors** (knowledge.ts) |
| L1 | eslint type-checked deep-pass (lib) | `npx eslint --config eslint.probe2.config.mjs src/lib` | **4359 errors**: no-floating-promises **2712** · no-unnecessary-condition **1353** · require-await **254** · no-base-to-string **36** · no-misused-promises **2** · await-thenable **2** |
| L2 | same, UI scope | `npx eslint --config eslint.probe2.config.mjs src/routes src/components src/router.tsx` | **32 errors, all in `src/components/console.tsx`** (routes + router.tsx clean) |
| A1 | async-hazard grep sweep | `.then(` / `async` callbacks / writers — see §5 | **0 shipped floating promises; writers synchronous** |
| C1 | coverage-gap walk | python walk of `src/lib` vs colocated tests + import scan — see §4 | **21 modules w/o tests anywhere · 2 weak** |

---

## 1. Recommendation table — which flags the repo SHOULD adopt

| flag | diagnostics now | recommendation | why |
|------|-----------------|----------------|-----|
| `noUnusedLocals` | 0 | **ADOPT now (free)** | zero cost; guards against future dead locals |
| `noImplicitOverride` | 0 | **ADOPT now (free)** | zero cost; cheap insurance for any class hierarchies added later |
| `noUnusedParameters` | 4 | **ADOPT after M2-06** (delete 4 unused `project` params in knowledge.ts) | 4-line fix, then permanent |
| `exactOptionalPropertyTypes` | 87 shipped | **ADOPT in a dedicated wave** (M2-05) | mechanical: widen `?: T` → `?: T \| undefined` on ~20 builder fields (Project, Artifact, ResearchCorpusEntry, HitlDecision, PolicyCtx) or omit keys |
| `noUncheckedIndexedAccess` | 336 shipped / 878 total | **DEFER — do not adopt this wave** | 878 sites, mostly loop-guard/regex-group noise (§3); adoption = large risky diff pre-freeze. Instead: keep this probe as a **ratchet** (scoped config in CI, new violations block, count must not grow). The probe is the instrument that caught M2-01/M2-02 (lyin' index types). |

For the eslint rules: `no-floating-promises` is **adoptable immediately after one config tweak** — everything it flags is the node:test registration idiom (§2 M2-13), so enable with a test-file carve-out (`it/test/describe` returns-promise ignored). `no-misused-promises` adopt with the D-box handler fixes (M2-09). `no-unnecessary-condition` — **do NOT adopt repo-wide yet**: 670 shipped hits, most are deliberate defense-in-depth guards (M2-03 register). Adopt file-by-file after triage, or enable as `warn`.

---

## 2. Ranked rows

| BUG-ID | class | file:line | diagnostic (verbatim) | sev | box | verify-when-fixed |
|--------|-------|-----------|----------------------|-----|-----|-------------------|
| M2-01 | lying-type | src/lib/headless.ts:3800–3806 | `error TS2769: No overload matches this call.` + `error TS2339: Property 'name' does not exist on type 'string'.` (×4) + `error TS2345: Argument of type 'string \| undefined' is not assignable to parameter of type 'string'.` | med | A | `npx tsc -p tsconfig.probe2-nuia.json` → no `headless.ts` diagnostics |
| M2-02 | lying-type | src/lib/codegen.server.ts:1675 | `Unnecessary conditional, the types have no overlap` — guard is load-bearing | med | B | lint clean + test proving empty-signature path still returns `leftover` |
| M2-03 | dead (per types) / load-bearing (at runtime) | engine.ts:347,354,1291,1596–1600 · knowledge.ts:309 · scaffold.ts:788 · dod.ts:157 · chat.server.ts:180 · console.tsx:876,1612,4192,5613–14,5763,6271 | see §2.3 | low | A/B/D | hostile-row/adversarial tests must still pass after ANY lint cleanup |
| M2-04 | latent-crash (theoretical) | src/lib/crew.server.ts:1227–1228 (+1016) | `error TS2538: Type 'undefined' cannot be used as an index type.` (×2) | low-med | B | add `roles.length===0` invariant + `npm test` crew suite |
| M2-05 | lying-type (contract) | engine.ts:266,570,882,1108,1696,2432 · store.ts:270,1056,1094,1703 · headless.ts:348,496,1020,1059 · dod.ts:137 · +72 more | `error TS2375/2379 … with 'exactOptionalPropertyTypes': true` | low | A/B | `npx tsc -p tsconfig.probe2-eopt.json` → 0 |
| M2-06 | dead | src/lib/knowledge.ts:1195,1234,1259,1284 | `error TS6133: 'project' is declared but its value is never read.` | low | A | `npx tsc -p tsconfig.probe2-nup.json` → 0 |
| M2-07 | dead | cassette.ts:267,270 · auth/pglite-dialect.ts:60,98 · llm/providers/mock.ts:117 · wild-review.ts:103 | `Async method 'read' has no 'await' expression` etc (see §2.7) | low | B | lint clean on those files |
| M2-08 | lying-type (stringify) | app-data/client.server.ts:110 · handoff.ts:36 · plugin.ts:286 · policy.ts:386 | `'v' may use Object's default stringification format ('[object Object]') when stringified` | low | A/B | lint clean on those files |
| M2-09 | async (UI) | auth/gates.tsx:73 · console.tsx:2841,2862,5884 | `Promise-returning function provided to attribute where a void return was expected` | low | D | lint clean; click handlers `void`-wrapped or sync |
| M2-10 | test-quality (vacuous) | llm.test.ts:314,319 | `Unexpected 'await' of a non-Promise (non-"Thenable") value` | low | B | fix awaits; test still asserts |
| M2-11 | dead/defensive (aggregate) | 637 shipped lib + 33 console hits | no-unnecessary-condition families (§3.3) | low | A/B/D | triage note — do not mass-autofix |
| M2-12 | coverage gap | 21 modules / 2 weak tests | §4 | med | A/B/C/D | colocated test exists & imports key runtime exports |
| M2-13 | async sweep (negative result) | src/** | 2712 floating-promise hits = **100% node:test registration calls**; 0 real | info | — | n/a |
| M2-14 | strictness aggregate (negative result) | 878 nuia diags | pattern buckets §3.1; 0 verified crashes | info | — | n/a |
| M2-15 | lying-type (silent-undefined write) | src/lib/design.ts:490–491 → 595 | `error TS2322: Type 'string \| undefined' is not assignable to type 'string'.` + `error TS2345 …` | low | A | `tokens[key]` never undefined for `TOKEN_KEYS`; probe test |

### 2.1 M2-01 — headless.ts index-type cascade (the sharpest lying-type)

`src/lib/headless.ts(3800,29): error TS2769: No overload matches this call.`
`src/lib/headless.ts(3804,31): error TS2339: Property 'name' does not exist on type 'string'.` (cols 31,40,54,63 — ×4)
`src/lib/headless.ts(3806,25): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.`

Cause: `while (cursor < queue.length) { const current = queue[cursor]; … readdirSync(current, { withFileTypes: true }) }` — `queue[cursor]` is typed `string` today (silently blessing a possibly-undefined read); under nuia it becomes `string | undefined`, the `readdirSync` overload fails, and `entries` degrades to `string[]` → four `.name` errors downstream. **Runtime-safe** (cursor is loop-guarded), but: the file only survives because the types under-describe the index read. Fix shape: `const current = queue[cursor] as string;` (or for-of/`?? ""`), then adopt nuia scoped.

### 2.2 M2-02 — codegen.server.ts:1675 (`[0] ?? null` guard that lint calls dead)

```
1674|    const name = signatureFunctionNames([raw])[0] ?? null;
1675|    const idx = name === null ? -1 : targets.findIndex((t) => name.toLowerCase()…
```
Lint: `1675:5  error  Unnecessary conditional, the types have no overlap  @typescript-eslint/no-unnecessary-condition`.
Today `signatureFunctionNames([raw])[0]` types as `string` (index read unchecked) → `?? null` collapses → `name === null` "no overlap". At runtime `[0]` **can be `undefined`** (empty result) and the `?? null` converts it; the `=== null` branch is exactly the empty-signature path. This is a **lying type propping up a "dead" branch** — deleting the branch per lint would silently misroute. Fix shape: widen the read (`as string | undefined` or adopt nuia) before touching the branch.

### 2.3 M2-03 — defensive-guard register (DO NOT delete during any lint cleanup)

These fire as `Unnecessary conditional, value is always truthy/falsy` / `types have no overlap` / `comparison is always …` but are **deliberate hostile-input guards** for JS callers / corrupt persisted rows (the repo's own style: "validated, not trusted"):

| site | verbatim message | what the guard protects against |
|------|------------------|--------------------------------|
| engine.ts:347/354 | `Unnecessary conditional, value is always falsy` | malformed `MemoryEntry` rows from JS callers; `!prev` on `out[i]` |
| engine.ts:1291 | `Unnecessary conditional, value is always falsy` | junk `logs[i]` rows in refusal scan |
| engine.ts:1596–1600 | `Unnecessary conditional, value is always truthy` | `const last = logs[logs.length - 1]; … last && …` — **load-bearing when `logs` is empty** (index read types as non-undefined; `last` is really `JsonLog \| undefined`) |
| engine.ts:1659 | `comparison is always false, since "autopilot" !== "autopilot" is false` | `decidedBy` runtime junk vs declared union (explicit-throw contract) |
| knowledge.ts:309 | `Unnecessary conditional, the types have no overlap` | `e === null` on a cast record — hostile input rejected by throw |
| scaffold.ts:788 | `Unnecessary conditional, the types have no overlap` | corrupt contract fields |
| dod.ts:157 | `comparison is always true, since "autopilot" === "autopilot" is true` | junk `decidedBy` in the decision journal |
| chat.server.ts:180–181 | `'last' is possibly 'undefined'`(nuia) | `last.gate.unmet` chain on sorted-gated rows |
| console.tsx:876/1612/4192/5613–14/5763/6271 | `value is always truthy/falsy`, `"assistant" !== "assistant" is false` | render-time junk-row filters (chatLog, markdown blocks, TERMS) |

Verbatim example (engine.ts:1600): `1600:9  error  Unnecessary conditional, value is always truthy  @typescript-eslint/no-unnecessary-condition` — source `const dupLog = last && last.event === "dod.reqtrace" && …`.

### 2.4 M2-04 — crew role-table fallback can produce `undefined` index (theoretical latent crash)

`src/lib/crew.server.ts(1016,31): error TS2538: Type 'undefined' cannot be used as an index type.`
`src/lib/crew.server.ts(1228,31): error TS2538: Type 'undefined' cannot be used as an index type.`

```ts
204| export function rolesForPhase(phase: PhaseId): CrewRole[] {
205|   return CREW_ROLE_BY_PHASE[normalizePhase(phase)] ?? [];   // ← empty-array escape hatch
...
1227| const role = roles[i % roles.length];   // roles.length === 0 → i % 0 = NaN → roles[NaN] = undefined
1228| const spec = ROLE_SPECS[role];          // → undefined → any spec.* deref crashes
```
Comment above `rolesForPhase` says "Every phase has ≥ 1 role (property-tested)" — so the `?? []` fallback is unreachable *by test contract only*. If a future phase/normalization loses its row, plan-mode crew runs crash with a bare TypeError instead of a coded refusal. Fix shape: assert/guard `roles.length === 0` explicitly (e.g. return a stopped session with an RT_E code) — never let the empty array flow into the modulo.

### 2.5 M2-05 — exactOptionalPropertyTypes contract drift (87 shipped)

Verbatim samples:
- `src/lib/engine.ts(266,3): error TS2375: Type '{ id: string; phase: …; language: string | undefined; }' is not assignable to type 'Artifact' with 'exactOptionalPropertyTypes: true'.`
- `src/lib/engine.ts(570,7): error TS2375: … 'hitl: {…} | undefined' … not assignable to type '{ … hitl?: HitlRequest; }' with 'exactOptionalPropertyTypes: true'.` (also 882, 1108)
- `src/lib/store.ts(270,3): error TS2375: …'not assignable to type 'Project' with 'exactOptionalPropertyTypes: true'.`
- `src/lib/headless.ts(496,50): error TS2379: Argument of type '{ live: boolean; p6Deps: Partial<P6JourneyDeps> | undefined; }' is not assignable to parameter of type '{ live?: boolean; p6Deps?: Partial<P6JourneyDeps>; }' with 'exactOptionalPropertyTypes: true'.`
- `src/lib/dod.ts(137,68): error TS2345: Argument of type '{ actor: PolicySeat; humanSeatToken: string | undefined; expectedHumanSeatToken: string | undefined; }' is not assignable to parameter of type 'PolicyCtx | PolicyCtxInput | undefined'.`

Family concentration: `engine.ts` 10 · `knowledge.ts` 6 · `app-data/errors.ts` 5 · `crew.server.ts` 5 · `codegen.server.ts` 4 · `compile-check.server.ts` 4 · `git.server.ts` 4 · `headless.ts` 4 · `store.ts` 4 · `db.ts`/`exec.ts`/`harvest.ts`/`llm-tasks.ts`/`verify.ts` 3 each. No runtime effect (explicit `undefined` assigned to an optional field reads back as `undefined` either way) — it is type/contract hygiene; fix by widening the ~20 target fields (`?: T | undefined`) or omitting keys at construction.

### 2.6 M2-06 — dead: knowledge.ts unused `project` params

`src/lib/knowledge.ts(1195,3): error TS6133: 'project' is declared but its value is never read.` (also 1234, 1259, 1284). Delete the parameter (check exports/callers) → then `noUnusedParameters` becomes adoptable for free.

### 2.7 M2-07 — shipped `require-await` (6)

```
auth\pglite-dialect.ts: 60:3  error  Async method 'releaseConnection' has no 'await' expression
auth\pglite-dialect.ts: 98:3  error  Async method 'destroy' has no 'await' expression
cassette.ts: 267:5  error  Async method 'read' has no 'await' expression
cassette.ts: 270:5  error  Async method 'write' has no 'await' expression
llm\providers\mock.ts: 117:99  error  Async arrow function 'complete' has no 'await' expression
wild-review.ts: 103:86  error  Async arrow function 'statusProbe' has no 'await' expression
```
Interface-compat asyncs (must return Promises). Benign; either drop `async` + return Promise directly, or add targeted disables with a comment.

### 2.8 M2-08 — no-base-to-string (4 shipped)

```
app-data\client.server.ts: 110:19  error  'v' will use Object's default stringification format ('[object Object]') when stringified
handoff.ts: 36:17  error  'v' will use Object's default stringification format ('[object Object]') when stringified
plugin.ts: 286:66  error  'writesState' may use Object's default stringification format ('[object Object]') when stringified
policy.ts: 386:63  error  'raw' may use Object's default stringification format ('[object Object]') when stringified
```
Verified deliberate in 2 of 4 (client.server.ts:110 is the `String(v)` fallback inside the `JSON.stringify` catch; handoff.ts:36 is the documented unknown→string coercer) — remaining 2 need a one-line look. Low risk; this is a grep-able class if any ships `[object Object]` into user-visible text.

### 2.9 M2-09 — no-misused-promises (shipped/UI)

`auth\gates.tsx: 73:19  error  Promise-returning function provided to attribute where a void return was expected`
`console.tsx: 2841:29 / 2862:29 / 5884:19  error  Promise-returning function provided to attribute where a void return was expected`
Async handlers passed straight to React attributes (`onClick={run}` etc.). React ignores the returned promise → a rejection is swallowed by the event system. Wrap as `onClick={() => void run()}` or make handlers sync.

### 2.10 M2-10 — await-thenable in tests (2)

`llm.test.ts: 314:22 / 319:16  error  Unexpected 'await' of a non-Promise (non-"Thenable") value` — awaiting a non-promise makes the assertion run before/without any async boundary; likely a stale mock. Same family as audit-B2-f01 but only 2 sites (see §4 note).

### 2.11 M2-11 — no-unnecessary-condition shipped aggregate (637 lib + 33 console)

| family | lib count | shares |
|--------|-----------|--------|
| `??` on non-nullish | 280 | defensive fallbacks (`project.logs ?? []` etc.) |
| unnecessary optional chain | 129 | `opts?.x` for JS callers |
| always truthy | 92 | junk-row guards |
| types no overlap | 69 | casted hostile input |
| always falsy | 50 | same |
| comparison always | 17 | union-compare guards |
| **total** | **637** | + console 33 (26 n-u-c, 3 require-await, 3 misused) |

Hot files: engine 76 · headless 70 · codegen.server 54 · packet 43 · scaffold 36 · dod 30 · knowledge 19 · maker-score 19 · judgment 15 · design 14 · token-ledger 14 · chat.server 13 · chat 13 · store 13 · verify.server 13. **Do not mass-autofix** — see M2-03 register; each `??`/`if` deletion is a behavior change candidate.

### 2.12 M2-15 — design tokens: silent-undefined write chain

```
src/lib/design.ts(491,33): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
src/lib/design.ts(595,37): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
```
`for (const key of TOKEN_KEYS) tokens[key] = assembled[key];` — under nuia, `assembled[key]` is `string | undefined`; if a `TOKEN_KEYS` entry ever drifts from `NEUTRALS/CASTS/SEMANTIC`, a token silently becomes `undefined` and flows to the CSS var swatch (design.ts:595 `swatchCell(key, t.palette.tokens[key])`). The re-map loop exists precisely to enforce the key set — it should assert non-undefined instead of writing through the lie.

---

## 3. Aggregate evidence

### 3.1 nuia buckets — all 878 diagnostics accounted (336 shipped / 542 test)

| bucket | shipped count | disposition after per-site read |
|--------|--------------|--------------------------------|
| loop-guard index reads (`arr[i]` under `i < arr.length`) | 39 classified + most of 148 NEEDS_READ | noise (runtime-dense arrays, guard in-loop) |
| regex-group reads (`m[1]`, `.exec/.match`) | 108 | noise (group mandatory when match) — verified on vector.ts:119 HEX_RE, engine.ts:1293 RT_E matcher, ast-mine `firstQuote` |
| split/first-element (`[0]`, `.split(`) | 29 | noise (length-checked or guarded) |
| record-index reads (`TBL[key]`) | 5 + remainder | noise (key derived from the table's own key list, e.g. engine.ts `DOMAIN_ORDER = Object.keys(DOMAIN_TERMS)`) |
| last-element (`.length - 1`) | 7 | noise (preceded by `length > 0`) |
| **verified crash-less** | **ALL** | 0 runtime crashes; 2 lying-type chains call out (M2-01, M2-02, M2-15) |

Top shipped files: ast-mine 50 · vector 26 · harvest 24 · crew.server 20 · render 20 · diagnose 18 · diagram 15 · design 13 · engine 10 · headless 10 · packet 10 · verify.server 10. (Test-file share 542 — tests index fixtures directly.)

### 3.2 eopt concentration (87 shipped)

engine 10 · knowledge 6 · app-data/errors 5 · crew.server 5 · codegen.server 4 · compile-check.server 4 · git.server 4 · headless 4 · store 4 · db/exec/harvest/llm-tasks/verify 3 each · (22 more files with 1–2).

### 3.3 Representative verbatim diagnostics

```
src/lib/engine.ts(219,23): error TS2532: Object is possibly 'undefined'.
src/lib/engine.ts(1426,16): error TS18048: 'last' is possibly 'undefined'.
src/lib/packet.ts(674,5): error TS2345: Argument of type 'PhaseDef | undefined' is not assignable to parameter of type 'PhaseDef'.
src/lib/vector.ts(197,11): error TS2488: Type 'string | undefined' must have a '[Symbol.iterator]()' method that returns an iterator.
src/lib/store.ts(1094,13): error TS2345: Argument of type '(s: RapidState) => { projects: (Project | … )[]; }' is not assignable to parameter of type '…'.
```
(engine.ts:219 = `DOMAIN_TERMS[domain]` keyed by `Object.keys` output → noise. packet.ts:674 = `PHASES[cur] ?? PHASES[0]` fallback where the fallback itself is `PhaseDef | undefined` under nuia → noise-per-runtime, type-hygiene real.)

---

## 4. Coverage-gap map (audit-B2-f01 class)

**4.1 — NO test file imports these modules at all (21):**

| module | exported runtime surface (sample) | risk note | box |
|--------|----------------------------------|-----------|-----|
| src/lib/db.ts | dbSource, getSql, getPglite, ensureDbReady | DB seam, exercised only via build/migrate | A |
| src/lib/fixtures.review.ts | fixturesReview | review fixture path | B |
| src/lib/fixtures.server.ts | loadFixtureReviewRows | server fixture loader | B |
| src/lib/wild-review.ts | createNodeWildReviewer | wild-run reviewer | B |
| src/lib/error-component.tsx | AppErrorComponent, AppNotFoundComponent | UI crash surface | D |
| src/lib/app-data/server-only.ts | assertAppDataServerOnly | H2-style seam guard | A |
| src/lib/auth/email-password.ts | emailAndPasswordEnabled | auth | A |
| src/lib/auth/gate-session-marker.ts | GATE_SESSION_MARKER_COOKIE, hasGateSessionMarker | auth | A |
| src/lib/auth/gate-session.server.ts | GATE_PROVIDER_ID, gateIdentitySessions | auth (also M2-13 chain site) | A |
| src/lib/auth/gates.tsx | SignedIn/SignedOut/RedirectToSignIn/SignInGate/SignInButtons | auth UI (M2-09 site) | D |
| src/lib/auth/isolation.server.ts | CrossSiteRequestError, assertSameSiteRequest | security guard, untested | A |
| src/lib/auth/middleware.ts | authMiddleware | request-path guard | A |
| src/lib/auth/pglite-dialect.ts | pgliteDialect | DB dialect (M2-07 site) | A |
| src/lib/auth/popup.server.ts | handleAuthPopupRequest | auth popup | A |
| src/lib/auth/preview.ts | PREVIEW_* consts | preview | A |
| src/lib/auth/provider.tsx | AuthProvider | auth UI | D |
| src/lib/auth/providers.ts | GROK_PROVIDERS | auth config | A |
| src/lib/auth/use-current-user.ts | DEV_USER, useCurrentUser(State) | auth hook | D |
| src/lib/multiplayer/p2p.ts | P2PRoom, defaultIceServers | serialized signal queue (§5) | B |
| src/lib/app-data/index.ts | (re-export barrel) | — | A |
| src/lib/multiplayer/index.ts | (re-export barrel) | — | B |

**4.2 — colocated test exists but never mentions most runtime exports:**

| module | key runtime exports | hit by its test |
|--------|--------------------|-----------------|
| src/lib/rt-events.ts | 29 runtime exports (RT_EVENT_NAMES, isKnownRtEvent, budget consts…) | 9 |
| src/lib/scorecard.ts | 10 (parseJsonDocument, parseEvalResults, parseEvalHistory, parseEvalRunMarker…) | 3 |

**4.3 — test-quality smokes:** the eslint deep-pass found 2712 floating-promise hits but **100% are node:test `describe()/it()/test()` registration calls** (Node's test API returns promises by design; no test body leaves a real promise unawaited). The only genuine test-defect smells: `llm.test.ts:314/319` (M2-10, await of non-promise) and `codegen.server.test.ts:287` (`Unnecessary conditional, value is always truthy` — vacuous assertion shape worth a glance). So the B2-f01 "tests that never ran the real thing" class is **NOT** present via floating promises; residual risk lives in §4.1/§4.2 coverage holes.

---

## 5. Async-hazard sweep (the once-fatal class) — result

**Verdict: shipped paths CLEAN.** Evidence:
1. **Floating promises (type-checked, all of `src/lib`)**: 0 in shipped files; the 2712 hits are exclusively the `describe/it/test` registration idiom in `*.test.ts` (§4.3).
2. **Writers are synchronous by construction** — every shipped write path uses sync fs: `runtime-log.server.ts:125 appendFileSync` (one NDJSON row per event, atomic by construction per its header comment) · `headless.ts:118/3175/3181 writeFileSync` · `knowledge.ts:535 writeFileSync(tmp)` · `checkpoint.server.ts:218` · `git.server.ts:664` · `write-set.ts:116/147/171`. **A missing `await` on a write is structurally impossible** in these modules.
3. **`void`-marked deliberate ignores**: 76 sites in shipped lib code — the repo already encodes the rule's "explicitly marked as ignored" standard.
4. **Every `.then(` in shipped src is handled** (verbatim):
   - `engine.ts:103` / `report-intake.ts:63` — `void import("./knowledge.ts").then(…).catch(…)` lazy-seam pattern, both with catch.
   - `db.ts:205-209` — `const pass = (…).catch(() => undefined).then(migrate); await pass;` migrate chain, awaited.
   - `store.ts:217-231 serialized()` — lock-chain tail swallows rejections by design, `void tail.then(…)` cleanup.
   - `auth/gate-session.server.ts:45` — materialization lock; `tail` never rejects (release-only promise).
   - `multiplayer/p2p.ts:445` — `prev.then(() => this.postSignal(...))`, stored as `next.catch(() => {})`.
   - `scripts/sign-out-plan.mjs:64` — `Promise.resolve(start()).then(ok, failed)` — both handlers present.
5. **Async timer callbacks**: zero (`setInterval/setTimeout` with async bodies: none in shipped code).

The once-fatal class is guarded by design here; no keyed calls were made.

---

## 6. Reproduction recipe + scratch-artifact log (all deleted)

Scratch files created at repo root and **deleted after the run** (verify: `git status` shows only `fixes/308_map2_static.md` as new):

- `tsconfig.probe2-{base,nuia,eopt,nio,nul,nup}.json` — each `{ "extends": "./tsconfig.json", "compilerOptions": { "<FLAG>": true }, "include": ["src/lib"] }`; then `npx tsc -p tsconfig.probe2-<tag>.json` (base = 0 diagnostics proves every hit is new).
- `eslint.probe2.config.mjs` — repo config + `parserOptions.projectService` + `no-floating-promises`, `no-misused-promises`, `await-thenable`, `require-await`, `no-unnecessary-condition`, `no-base-to-string` at error; run `npx eslint --config eslint.probe2.config.mjs src/lib` (and `src/routes src/components`).
- Raw outputs kept outside the repo at `%TEMP%\rt-p2\*.txt` (nuia/eopt/nio/nul/nup/eslint/eslint_shipped/base) for any fixer to re-diff.

**Zero product files were modified by this lane.**
