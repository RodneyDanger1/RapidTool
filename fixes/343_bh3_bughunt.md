# 343 · lane bh3 — Bug-hunter 3 (UI / routes / product surfaces / tooling)

**Boundary:** bug-hunter 3. **Lane slice:** `src/components/**` except `console.tsx`; `src/routes/**`;
the named lib surfaces (`vault`, `report-intake`, `design`, `diagram`, `plugin`, `swarm`, `db`, `auth/**`,
`app-data/**`, `rt-events`, `rt-ring`, `rt-client`, `watchdog`, `diagnose`, `runtime-log.server`,
`compaction`, `chat*`); `scripts/**` except the reserved files; colocated tests.
**Base:** `main` @ `73f660a`, tree dirty only from concurrent lanes. **Keyed LLM calls:** 0.
**Scratch:** `%TEMP%\rt343_bh3\` (browser probes, fuzz, mutation drivers — outside the repo).
**Log:** append-only.

Seven other lanes were editing concurrently (notably `console.tsx`). No reserved file was touched.

---

## 1. Findings table

| # | Class | `file:line` | Severity | Reproduction | Status |
|---|---|---|---|---|---|
| F1 | Boundary/edge — ring bounds not re-applied on hydrate | `src/lib/rt-ring.ts:234` (`rtHydrate`) | Low | Node 22/24: a persisted blob with 400 valid rows (77,928 chars) hydrates to **400 rows / 83,091 serialized bytes** — both the 200-row `RING_CAP` and 64 KB `RING_BYTES` contracts exceeded. `localStorage` is user-writable, so a tampered/foreign blob loads unbounded rows into the in-memory ring, `rtStats` and the diagnose panes. | **FIXED** |
| F2 | Prototype-key lookup → crash (H1 class) | `src/lib/design.ts:441` (`familyFor`) | Medium | `designTokens({ domain: "constructor", name: "Acme" })` → `TypeError: Cannot read properties of undefined (reading 'length')`; `"__proto__"` throws too. `Project.domain` is a free string (`engine.ts:2530` keeps any string `raw.domain`; imports/hand edits carry it), and a plain-object read returns `Object.prototype.constructor`/`__proto__`, so `CASTS[family]` is undefined. | **FIXED** |
| F3 | Prototype-key lookup → wrong fallback (claim drift) | `src/lib/diagram.ts:109` (`kindTheme`) | Low | `kindTheme("constructor")` / `("__proto__")` returned an `Object.prototype` member instead of the documented `UNKNOWN_KIND_THEME`; callers then read `.fill`/`.stroke` off a function/object. The function's own contract says "unknown/runtime-garbage artifact kinds" get the fallback. | **FIXED** |
| F4 | Unhandled promise in a click path | `src/lib/auth/gates.tsx:80` (`SignInButtons`) | Low-Med | `onClick={() => signIn(...)}` returned a genuinely rejectable promise (pop-up blocked, cancelled popup, broker/provider error) with no handler: the visitor saw nothing and the rejection floated to `window` (→ rt-client `sys.unhandled_rejection`, critical). Contrast `UserButton`, which wraps `signOut().catch(...)`. | **FIXED** |
| F5 | Claim-vs-byte drift (doc census) | `src/lib/rt-events.ts:226,260` | Low | HEAD's 342-6 sweep deleted `watchdog.overdueRowSeed`, whose `event: "sys.step_overdue"` was that name's only emit-site literal. A fresh non-test `event:` scan now finds **39** dead names (incl. `sys.step_overdue`); the census comment still claimed 38 and its list omitted the name (and claimed to be "byte-identical to the scan"). | **FIXED** |
| F6 | Test teeth gap (unfalsifiable boundary) | `src/lib/rt-events.test.ts:110` | Low | Mutation `shouldCoalesce` `now - prev.ts <= RT_COALESCE_MS` → `<` **survived** both `rt-events.test.ts` and `rt-ring.test.ts` (28/28 pass): the exact 5 000 ms boundary was never sampled (9 999/10 001 only). | **FIXED** (boundary pin added) |
| F7 | Request validation gap | `src/lib/chat.ts:21,39` | Low | Both server-fn validators are identity (`.validator((input) => input)`). A `null`/non-object payload reaches `data.project` in the handler before `chatOnceServer`'s guard, so the module's promised *coded* `RT_E_VALIDATION` envelope cannot be produced for that shape (generic throw instead). | Reported (owner decision) |
| F8 | Hostile-input inconsistency | `src/lib/vault.ts:764` (`lessonNotes`) | Very Low | `lessonNotes({})` / `lessonNotes(null)` throws (`project.phases is not iterable` / cannot read 'phases') while the rest of `vault.ts` guards corrupt collections ("never a TypeError"); `backlinksFor` was hardened for the same `[null,5]` input. **No production caller** (tests + a probe only) → low reachability. | Reported |
| F9 | Dead-branch claim | `src/lib/diagnose.ts:349` (rule 7) | Very Low | Rule 7 summary says "stall/longtask rows in window", but `sys.longtask` is emitted at `level:"warn"` (`rt-client.ts:489`) and both consumers pre-filter `errors[]` to error/critical (`rt-client.ts:668`; CLI `rapidtool-cli.mjs:4814`), so the `sys.longtask` half is unreachable; only `sys.mainthread_stall` (critical) can fire it. | Reported |

Observations with no defect (checked, left alone):
- `/run/does-not-exist` first paint is racy by design: SSR/pre-hydration keeps the neutral title "Delivery run", post-hydration flips it to "build not found" (`routes/run.$id.tsx:10-18`, documented). The body always names the missing build; no fix.
- `swarmPlan`/`parallelDag`/`branchSuggest`/`designTokens` are only total for a well-formed `Project` (typed internal contract; no totality claim). Junk-`project` throws are outside their declared contract. F2 is the exception because a *well-formed* string domain crashed.
- The vault/timeline panes already render honest clipboard-failure and empty states (verified below).

---

## 2. Fixes, RED → GREEN

**F1 — hydrate re-applies the ring bounds** (`src/lib/rt-ring.ts:228-235`)
Trim oldest-first after the junk filter, using the same two caps `rtPush` enforces. `getRtRing()` reads
`localStorage`, so the persisted bound must hold on read, not only until the next push.
- RED: new `rt-ring.test.ts` test "hydrate enforces the ring bounds…" → `not ok 21` (400 rows / 83 KB).
- GREEN: `rt-ring.test.ts` **21/21 pass** (row-cap trim + byte-cap trim, newest kept, oldest dropped).

**F2 — own-key domain lookup** (`src/lib/design.ts:441`) and status-chip lookup (`:704`)
`Object.prototype.hasOwnProperty.call(CANONICAL_DOMAIN, domain)` / `(STATUS_TONE, status)` before the read.
- RED: two new `design.test.ts` cases (prototype domains; prototype status) → `2 fail`.
- GREEN: `design.test.ts` **33/33 pass**.

**F3 — own-key kind lookup** (`src/lib/diagram.ts:109`)
Same guard so `kindTheme` honours its documented `UNKNOWN_KIND_THEME` fallback.
- RED: new `diagram.test.ts` case under "palette integrity" with the pre-fix body → `not ok`.
- GREEN: `design.test.ts` + `diagram.test.ts` **68/68 pass**.

**F4 — handle a rejected sign-in** (`src/lib/auth/gates.tsx:74-95`)
Local `failed` state + `void signIn(...).catch(...)` + a `role="alert"` row; the popup still opens
synchronously inside the gesture (no `await` before `signIn`).
- Guard: new source pin in `sign-in-gate.test.ts` → **GREEN** on the fixed bytes; **RED** with
  `RT_GATES_TX` pointed at the pre-fix snippet (`not ok 2 - SignInButtons handles a rejected signIn`).
- Not browser-reachable in this app (see §5).

**F5 — append-only re-count** (`src/lib/rt-events.ts:226,260`)
Added `sys.step_overdue` to the dead list and appended a W56 re-count paragraph (catalogue 60 · emitted
21 · dead 39), re-derived from a fresh scan, not inherited. Comment-only.

**F6 — boundary pin** (`src/lib/rt-events.test.ts:115`)
Added the exact `RT_COALESCE_MS` sample so a `<` mutant dies. Verified by re-applying the mutant.

---

## 3. Mutation-test results (scratch, reverted)

| Mutation | Target | Before | After my changes |
|---|---|---|---|
| `now - prev.ts <= RT_COALESCE_MS` → `<` | `rt-events.ts:357` `shouldCoalesce` | **SURVIVED** (rt-events + rt-ring: 28/28 pass) — test gap | **KILLED** (`rt-events.test.ts` not ok 2, via the new exact-boundary pin) |
| `payload.parked === true` → `=== "yes"` | `diagnose.ts:200` `isParkRow` | KILLED (`diagnose.test.ts` not ok 25) | KILLED (unchanged) |
| delete the `rtHydrate` trim | `rt-ring.ts:234` | KILLED by the new test (not ok 21) | KILLED |

All mutations were reverted; residue check: `prev.ts <=`, `parked === true`, and both `rows.shift()` loops
present exactly once.

---

## 4. Browser verification log

`npm run dev` → `http://127.0.0.1:8080` (host node v24.15.0), headless Chromium (Playwright), driven
programmatically and DOM-asserted (screenshots captured but not the verdict).

| Viewport | Routes / actions | Result |
|---|---|---|
| desktop 1280×900 | `/` → "Field dispatch" → "Open intake" → `/run/<id>`; "More panels (8)"; **Design** tab; **Runtime log** tab → typed-timeline disclosure (open, 1 row) → "Copy raw NDJSON"; `Ctrl+K` palette → filter "export" (2 items) → Escape; merged phase rail → `#pipeline-rail-detail`; theme toggle | 0 console errors · 0 page errors · no horizontal overflow · design palette rendered · detail opened |
| mobile 390×844 | same flow | 0 console errors · 0 page errors · no horizontal overflow · design palette rendered · detail opened |

The "Copy raw NDJSON" click under headless Chromium surfaced the pane's honest **"Clipboard blocked —
select the raw NDJSON in the disclosure below instead."** failure branch (permission denied) — the error
state works rather than pretending success. `/no/such/route` renders the in-shell 404; `/run/does-not-exist`
renders "This build doesn't exist or was archived." (title race noted in §1, by design).

---

## 5. Mock / fake census

Across the changed + key slice files (`rt-events`, `rt-ring`, `rt-client`, `watchdog`, `diagnose`,
`runtime-log.server`, `chat(.server)`, `plugin`, `swarm`, `vault`, `report-intake`, `design`, `diagram`,
`compaction`, `db`, `auth/gates.tsx` + the touched test files): **0** `as any`, `@ts-ignore`/`@ts-expect-error`/
`@ts-nocheck`, empty `catch {}`, hardcoded fake returns, or unfalsifiable assertions. The only `TODO`s are
the pre-existing `TODO(N6-*)` census comments in `rt-events.ts` (owned by the dead-const settlement, not
this lane). No new placeholder/mock code was introduced.

---

## 6. What I could not verify

- **F4 is not browser-reachable here:** no route/component in this app renders `SignInGate`/`SignInButtons`
  (grep: exported + doc references only), and auth is off by default (`.grok/app-env.json`
  `VITE_AUTH_ENABLED=false`). The fix is covered by a source guard + `tsc`/lint; the live popup-failure path
  was not exercised.
- **F7** was not reproduced with a live POST: `createServerFn` is "not invocable outside the Start runtime"
  (`chat.ts:209-210` documents this), so the finding is derived from the bytes, not a request.
- **F8/F9** are static findings; no production caller (F8) / no warn-level longtask reaches `errors[]` (F9),
  so the impact is bounded as stated.
- **No full gate** (rule) and **0 keyed LLM calls**; only the targeted suites, `tsc --noEmit` (exit 0), and
  `eslint` on the changed files (0 problems) were run. Concurrent lanes were editing `console.tsx` and many
  libs throughout; I did not touch any reserved file.
- **Targeted suites green on both runtimes:** 458 tests, 458 pass / 0 fail / 0 skipped (Node 22.23.2 and
  host Node 24.15.0) over rt-events, rt-ring, rt-client, watchdog, diagnose, runtime-log.server, chat,
  plugin, swarm, vault, report-intake, design, diagram, compaction, db, app-data, auth (sign-in-gate,
  import-contract, gate-session-marker, gate-identity), and the ui-shell/ui-surface guards.
