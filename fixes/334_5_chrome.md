# fixes/334_5_chrome.md — W48 · Lane 334-5 "Chrome" — console honesty, pass 3

**Lane:** 334-5. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (folder name has a space).
**HEAD at wave open / lane open:** `0d5b250` (tree clean; only `wave_plans/W48/` untracked).
**Owned files (STRICT):** `src/components/console.tsx` · `src/routes/**` · `src/lib/fixtures.ts` ·
`src/lib/fixtures.server.ts` · `src/lib/fixtures.review.ts` · `src/lib/store.ts` · `src/lib/llm.ts`
+ new tests. **This log is append-only.**
**Browser:** Playwright (repo `node_modules`), headless Chromium, driven from harnesses kept OUTSIDE
the repo (`%TEMP%\rt334_5\…`). Dev server `npm run dev` (`0.0.0.0:8080`, reached as `127.0.0.1:8080`)
on **host Node v24.15.0**; harness + tests run on **pinned Node 22.23.2**
(`%LOCALAPPDATA%\hermes\node\node.exe`) AND host Node 24.15.0. No `npm run eval`, no full gate,
no secret printed, nothing committed from `%TEMP%`.

Baseline at wave open (measured): typecheck 0 (both legs) · lint 0 warnings · 398 scripts + 2747 lib
tests / 0 fail. **Lane baseline (my owned suites, measured before any edit):** `store.test.ts` +
`llm.test.ts` + `fixtures.review.test.ts` → **109 tests / 3 suites / 109 pass / 0 fail** on Node 22.23.2
**and** Node 24.15.0; non-null assertions in `console.tsx` = **0** (bang-dot 0, bang-paren 0, bang-semi 0).

---

## 0. Step 0 reconciliation — claimed / on disk / still open

### Claimed (my own former lane logs)

`fixes/331_5_chrome.md` — **claimed zero edits**; every cited row (UI1/UI2/UI3, R6-f01/f07/f12/f13/f14/f15)
already landed in ancestor commits; proved each in a real browser. Noted the open item: `run` /
`runUntilHitlAsync` keyed failures expose no `code`, so a P6-synthesis 401 cannot move the chip.

`fixes/332_5_chrome.md` + its appended follow-up —
- **C1 claimed FIXED:** header chip renders the last keyed-call OUTCOME CLASS (`KEY_UNUSABLE_CODES`) with
  tone danger; sources = persisted chat thread, this screen's crew run, and (follow-up) the server probe's
  live `lastKeyed`; store `readLastKeyed` validation and `llm.ts captureKeyedOutcomes` tap.
- **C2 claimed FIXED:** new `fixtures.review.test.ts` (7 tests); two `console.tsx` non-null assertions
  removed → 0; one stale fixtures comment corrected.
- **Follow-up claimed LANDED:** edge-triggered stale emit (`store.staleEmitStep`) and the live validity
  probe (`llm.captureKeyedOutcomes` → `statusServer.lastKeyed` → `store.readLastKeyed` → chip).
- Carried/owed: `run`/`runUntilHitlAsync` expose no `code`; the live-validity chip fires only after the
  mount/crew/chat refreshes.

### On disk (verified today against bytes)

| Claim | Bytes found | Verdict |
|---|---|---|
| chip keyed-class derivation + two states | `console.tsx:2243-2278` (`serverKeyed`, `lastKeyed`, `keyUnusableCode`, `llmChipLabel/Tone/Title`); `:5974` `KEY_UNUSABLE_CODES` | **present** |
| store `readLastKeyed` | `store.ts:95-104` | **present** |
| store `LlmStatusSurface.lastKeyed` | `store.ts:108-117`; mapped in `refreshStatuses` `:1742-1743` | **present** |
| `llm.captureKeyedOutcomes` + `statusServer.lastKeyed` | `llm.ts:120-166` | **present** |
| edge-triggered stale emit | `store.ts:350` `staleEmitStep`; consumer `console.tsx:1053/1205-1230` | **present** |
| `fixtures.review.test.ts` | 7 tests, green on both runtimes (lane baseline above) | **present** |
| fixtures copy honest | `fixtures.ts:19` `FIXTURE_REVIEW_LABEL`, `fixtures.server.ts:24` `LOAD_LABEL`, console copy `console.tsx:504-509` all say "read-only review … approval is a CLI action … records no decision" | **matches bytes** (loader has no write path; `fixtures.ts:22-30` de-scope note intact) |
| non-null assertions in `console.tsx` | 0 | **present (held)** |
| chip's two states (proved 332-5) | not re-landed; not touched | **held** |
| R6-f01/f07/f12/f13/f14/f15 | present (331-5 proof; not re-landed) | **held** |
| `COVERAGE_ALLOWLIST` cleanup requested of 332 | 333-2 verified `check-module-coverage.mjs` entries removed; guard 0 unallowlisted | **done by 332-6** |

### Still open (with `file:line`) — the C1/C2 targets

1. **`store.ts:51-53` `RunResult` failure arm carries no `code`.** `runUntilHitl`/`runUntilHitlAsync`
   (`store.ts:1434-1492`, `:1540-1596`) return `{ ok: false; error }` only — even "Project missing."
   is uncoded, while the sibling `executeAsync` (`store.ts:1501`) already returns
   `RT_E_PROJECT_MISSING`. Nothing to consume.
2. **`store.ts:44` `ApproveResult` failure arm carries no `code`**, so `executeAsync`'s genuinely
   classified `code` (`store.ts:1501`) is invisible at the call site and `console.tsx:2306`
   (`run()` → `setError(res.error)`) drops it; same for `console.tsx:2334` (approve) / `:2357` (reject).
3. **`console.tsx:2366-2380` `runUntil()` never refreshes the validity probe and never names a code.**
   `refreshStatuses()` is called only on mount (`:2035`), after crew (`:2454`) and after chat (`:6373`).
   A P6-synthesis keyed 401 during a run is observed by the process-global tap (`llm.ts:125`) but never
   pulled to the chip, and `res.error` renders as generic prose. This is the live residual of the 331-5
   note.
4. **`console.tsx:2607` import failure drops `ImportProjectResult.code`** (`store.ts:80` carries it).
5. **`refreshStatuses` returns `Promise<void>`** (`store.ts:149`), so a caller cannot read the fresh
   probe synchronously after a run.

**Not a gap (recorded):** the fixtures review copy still matches the bytes; the acceptance-fixtures
banner (`console.tsx:604-640`) honestly says "pending" and names the CLI as the single flip path.

---

## 1. C1 — the run path's refusal class now reaches the operator

### Presumption (334-2 not landed)
`fixes/334_2_ledger.md` **does not exist** at lane time; nothing 334-2 owned was on disk when I began.
Mid-lane, 334-2 became active in `src/lib/headless.ts` (`foldLastKeyedOutcome`, a duck-typed
`Project & { lastKeyedOutcome?: DoctorLastKeyed }`, with a comment naming "the `types.ts` request") —
its direction is a **persisted `Project.lastKeyedOutcome`** for `doctor`, not necessarily a
`RunResult.code`. Per the brief I used the shape on disk and landed my half in my own file:
the store's run/approve failure arms expose `code`, the console consumes it, and the chip half rides
the already-landed validity probe. **If 334-2 lands a differently-named field, reconcile at the
boundary** — my code is additive (`code?`, never required) and behavior-neutral when absent.

### The fix (all inside my owned files)
| File | Before | After |
|---|---|---|
| `store.ts:44` `ApproveResult` | `{ ok:false; error }` | `{ ok:false; error; code?: ErrorCode }` |
| `store.ts:51-53` `RunResult` | `{ ok:false; ran; stoppedReason; error }` | + `code?: ErrorCode` |
| `store.ts:149` `refreshStatuses` | `() => Promise<void>` | `() => Promise<LlmStatusSurface>` (returns the fresh probe) |
| `store.ts` run/execute/ingest arms | "Project missing." uncoded | `RT_E_PROJECT_MISSING`; `ingestReport` malformed → `RT_E_VALIDATION` |
| `store.ts` new exports | — | `KEY_UNUSABLE_CODES`, `codedFailureText`, `keyedRefusalSince` |
| `console.tsx` `run()`/`runUntil()` | `setError(res.error)`, no probe refresh | `await refreshStatuses()`, coded text, keyed-class on the run surface |

`codedFailureText` uses the result's own code first, else the last keyed refusal the probe witnessed,
else the raw prose — no class is ever invented. `keyedRefusalSince` attributes a refusal **only when
the probe's `at` is ≥ this run's start**, so a stale pre-run refusal is never blamed on this run
(the 333 **F-4** lesson: no label may out-claim what it measured).

### Browser proof — one bounded keyed action (desktop 1440×900)
Dev server pointed at a **non-secret invalid probe key** (`%TEMP%\rt334_5\bad.env`, tail `…0000`) so a
keyed call 401s **before completion (0 tokens)**. One `Execute P0` step (`%TEMP%\rt334_5\verify.mjs`):

| | Before the step | After the step |
|---|---|---|
| chip text | `configured` | **`RT_E_LLM_KEY_REJECTED`** |
| chip tone (class / color) | `text-ok` / `rgb(140,196,147)` | **`text-danger` / `rgb(224,142,142)`** |
| chip title | `LLM backend status` | coded meaning + **tail-only** source: `…\rt334_5\bad.env (tail …0000)` (no full key) |
| run surface alert | (none) | `RT_E_LLM_KEY_REJECTED — the step continued on the deterministic floor; a keyed call during this step was refused.` |

- **The refresh fired:** `6` status server-fn requests during the step (the chip could not have moved
  without them — it derives from `llmStatus.lastKeyed`, updateable only by `refreshStatuses`).
- **Usage (measured, `RAPIDTOOL_LLM_USAGE_LOG`): exactly ONE keyed call, 0 tokens billed** —
  `{"ok":false,"code":"RT_E_LLM_KEY_REJECTED","promptTokens":null,"completionTokens":null}`.
  Bag: 0 console / 0 page errors / 0 HTTP≥400.

**Before-state note (honest):** the chip-flip before-state was **not** re-run in the browser — doing so
needs a second keyed call, which the wave rule forbids. It is evidenced by the pre-change bytes
(`git diff`: the old handlers had no `refreshStatuses()` call and dropped `res.code`) and by the
fails-before test set (§4). The **coded-error before/after WAS re-run in the browser with zero keyed
calls** (§2).

---

## 2. C2 — the coded-error and honesty sweep (all in my owned files)

Every error path whose result carried a code but rendered prose only, now names the class. Verified
reachable end-to-end in the browser where free.

| Path (console.tsx) | Result type's code | Before → After |
|---|---|---|
| `run()` (execute) | `ApproveResult.code` + probe | `res.error` → `codedFailureText(res.error, res.code, keyedDuringRun)` + probe refresh |
| `runUntil()` | `RunResult.code` + probe | generic → coded, or keyed-class when the run degraded |
| `onApprove` / `onReject` | `ApproveResult.code` | prose-only → coded |
| `onRunModule` | `runModuleReal.code` | prose-only → coded |
| `onIngestReport` | `ingestReport.code` | prose-only → coded |
| crew start / crew ingest | `CrewRunResult.code` / `ingestReport.code` | prose-only → coded |
| import project | `ImportProjectResult.code` | prose-only → coded |
| Oracle verify | `runVerifyAsync.code` | prose-only → coded |
| Deepen research | `deepenResearch.code` | prose-only → coded |
| wild resume | `WildRunResult.code` | prose-only → coded |

**Browser before/after for the coded-error consumption — FREE (no keyed call), `%TEMP%\rt334_5\ingest.mjs`:**
the "Ingest report" panel with a syntactically valid but invalid report (`{"phase":99,"status":"bogus"}`).

| Console build | Alert text |
|---|---|
| **HEAD** (`git checkout -- src/components/console.tsx`; hash `15bc5d36…`) | `Report phase must be an integer between 0 and 12.` |
| **mine** (restored; hash `e2841777…`) | **`RT_E_VALIDATION — Report phase must be an integer between 0 and 12.`** |

Bag on both: 0 console / 0 page / 0 HTTP≥400.

**Fixtures copy (re-checked, no change needed):** `fixtures.ts:19` (`FIXTURE_REVIEW_LABEL`),
`fixtures.server.ts:24` (`LOAD_LABEL`) and the console copy (`console.tsx:504-509`) all still read
"read-only review … approval is a CLI action … records no decision"; the loader has no write path and
`fixtures.ts:22-30`'s de-scope note stands. The acceptance-fixtures banner still says `pending` and
names the CLI. **No drift.**

---

## 3. Browser sweep — desktop + mobile + all routes (no keyed calls)

`%TEMP%\rt334_5\sweep.mjs`. The invalid-key server was used (chip `configured` on a fresh load — the
in-process tap had reset across the HMR/SSR reloads this session — see §6 caveat).

**Desktop 1440×900** — `/`, `/run/<id>`, `/run/<bad-id>`, `/run`, unmatched:

| Route | Observed |
|---|---|
| `/` | title `RapidTool — governed 13-phase delivery harness`; counter `0/12 · no brief yet — 12+ characters required before a build can open` |
| `/run/<id>` | run screen renders; chip + 3 primary tabs (`Artifacts`/`Agent packet`/`Chat`) |
| `/run/does-not-exist-334` | `This build doesn't exist or was archived.` — 0 HTTP≥400 |
| `/run` | `Page not found …` (the 404 is the URL itself) |
| `/no-such-route-334` | `Page not found …` (the 404 is the URL itself) |

Regression: Guide dialog opens (`Agent guide`), Settings dialog opens (1), Ctrl+K palette opens (1),
Escape closes each. Bag: 0 page errors; the only console errors are the two expected 404s.

**Mobile 390×844** (isMobile + hasTouch):
| Check | Observed |
|---|---|
| overflow `/`, `/run/<id>`, `/run/<bad-id>` | `scrollWidth 390 == innerWidth 390` (**0 horizontal overflow**) |
| primary tabs | 3 |
| sidebar drawer | opens (`#run-sidebar` visible false → true) and Close dismisses it (→ false) |
| `/run/<bad-id>` | honest message; 390 == 390 |
| bag | 0 console / 0 page / 0 HTTP≥400 |

---

## 4. Tests added + real results on both runtimes

**`src/lib/store.test.ts`** — extended one test + added six (all C1-334):
`codedFailureText` (own-code wins / keyed fallback / empty code ignored / transient never rendered as a
key class / raw error otherwise); `KEY_UNUSABLE_CODES` membership; `keyedRefusalSince` (only a refusal
stamped during the run is attributed; stale pre-run, non-key, non-finite, absent all → null);
both run paths carry `RT_E_PROJECT_MISSING`; `refreshStatuses` returns the fresh surface;
`ingestReport` refuses with `RT_E_PROJECT_MISSING` / `RT_E_VALIDATION`.

**Fails-before (real, on HEAD's `store.ts`, hash `9827b55…`):** `93 tests / 86 pass / **7 fail**` —
`not ok 28` (the extended test) + `not ok 88-93` (all six new). Restored to my bytes
(`82555148…`) → **93 / 93 pass**. Every new assertion is falsifiable against the pre-change shape.

| Runtime | Command | Result |
|---|---|---|
| Node **22.23.2** (pinned) | `node --experimental-strip-types --test --test-reporter=tap src/lib/store.test.ts src/lib/llm.test.ts src/lib/fixtures.review.test.ts src/lib/fixtures.test.ts` | **123 tests / 5 suites / 123 pass / 0 fail** |
| Node **24.15.0** (host) | same | **123 tests / 5 suites / 123 pass / 0 fail** |

(Lane baseline before any edit: 109/3/0 on both runtimes. Delta **+14**: +7 store assertions, and the
4th suite `fixtures.test.ts` added to the run for completeness.)

---

## 5. Gates / targeted checks (no full gate, no `npm run eval`)

| Check | Result |
|---|---|
| `npx eslint` on `console.tsx`, `store.ts`, `store.test.ts`, `llm.ts`, `fixtures*.ts`, `routes/` | **exit 0**, 0 warnings |
| `npx tsc --noEmit` filtered to my files | **0 diagnostics** (the only project error is a sibling's in-flight `headless.ts` edit) |
| non-null assertions in `console.tsx` | **0** (bang-dot 0, bang-paren 0, bang-semi 0) |
| owned suites, Node 22 + Node 24 | 123/123 each |
| keyed calls | **1** (the intentional 401; **0 tokens**), reported above |
| secrets | none printed; the invalid probe key is a non-secret `…0000` placeholder; the provider masks its own key |

**No re-land:** the chip's two states (R6/332-5), `readLastKeyed`, `staleEmitStep`, the pane boundary,
and R6-f01/f07/f12/f13/f14/f15 were **not** re-landed — I moved `KEY_UNUSABLE_CODES` to the store and
consumed it, which is behavior-identical for the chip.

---

## 6. What I did NOT do / could not reach / cleanup

1. **334-2's log never landed**; I did not touch `headless.ts`/`doctor.ts`/`token-ledger.ts`. My
   `RunResult.code` plumbing is my own file's shape; reconcile the field name at the boundary if
   334-2 lands a persisted `Project.lastKeyedOutcome` (reported presumption, §1).
2. **A keyed run's 401 could not be re-run with the console REVERTED** (would need a 2nd keyed call);
   the before-state there is the pre-change bytes + the fails-before tests. The coded-error
   before/after WAS a real reverting browser run (§2).
3. **Caveat observed (not my change):** the validity probe's tap is module-state in the dev-server
   process; across the HMR/SSR reload churn this session a fresh page read `configured` again — so the
   chip's persistence is bounded by server-process/module lifetime. Same class as 332's own note
   ("the tap is process-global"). Not fixed here (would need the persisted `Project.lastKeyedOutcome`
   that 334-2 is building).
4. **`npx tsc --noEmit`** showed one transient error in the sibling's `headless.ts`; my files stay at
   0. No full gate was run (five siblings editing).
5. **Cleanup:** dev server stopped; **0 listeners on `:8080`; 0 `node` processes**; two orphaned
   `tsc --noEmit` processes from my own typecheck were terminated. The running Chrome processes are the
   machine's installed Google Chrome (not Playwright), left untouched. All harnesses/probes live only
   under `%TEMP%\rt334_5\` — **nothing committed into the repo** except the owned source/test changes
   and this log.
