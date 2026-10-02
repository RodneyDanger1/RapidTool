# fixes/332_5_chrome.md — W46 · Lane 332-5 "Chrome" — console honesty + fixtures coverage

**Lane:** 332-5. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (folder name has a space).
**HEAD at wave open / lane open:** `6cd5123` (tree clean at open; only `wave_plans/W46/` untracked).
**Owned files (STRICT):** `src/components/console.tsx` · `src/routes/**` · `src/lib/fixtures.ts` ·
`src/lib/fixtures.server.ts` · `src/lib/fixtures.review.ts` · **new** `src/lib/fixtures*.test.ts`.
**This log is append-only.**
**Browser:** Playwright `1.62.1` (repo `node_modules`), headless Chromium, driven from harnesses kept
OUTSIDE the repo (`%TEMP%\rt332_chrome\…`). Dev server `npm run dev` (`0.0.0.0:8080`, reached as
`127.0.0.1:8080`) on **host Node v24.15.0**; harness + new test run on **pinned Node 22.23.2**
(`%LOCALAPPDATA%\hermes\node\node.exe`) AND host Node 24. No `npm run eval`, no full gate.

Baseline at wave open: typecheck 0 · lint 0 warnings · 788 suites / 2682 tests / 2672 pass / 0 fail.

---

## 0. HEADLINE

- **C1 — FIXED in `console.tsx`.** The header LLM chip now renders the last keyed-call OUTCOME CLASS
  (a key-unusable RT_E code) instead of only the server probe's key *presence*. Browser-proven in both
  states on desktop and mobile.
- **C2 — FIXED.** New `src/lib/fixtures.review.test.ts` (7 tests) drives `fixtures.review.ts` +
  `fixtures.server.ts` and pins the honesty contract; the module-coverage guard now reports those two
  modules as REACHED (103/122, 0 unallowlisted gaps, exit 0).
- **C3 — SWEPT.** Every cited UI row is already landed; I re-landed **none** of the rows 331-5 proved.
  I fixed ONE real in-scope honesty defect (a stale `console.tsx` comment) and recorded the register
  state. Two now-dead allowlist entries must be removed by a `scripts/**` owner (requested, §7).
- **Bonus honesty:** removed the **2 pre-existing non-null assertions** the brief said did not exist
  (`console.tsx` had `byKind.get(...)!` at two sites) — `console.tsx` now has **0**.

---

## 1. C1 — the console surfaced key PRESENCE, not key VALIDITY

### The defect (reproduced, not assumed)

`store.ts`'s `LlmStatusSurface = { configured; label; model? }` is filled from `llm.ts`'s status
server-fn, which returns only `{ configured: isDeepSeekConfigured(), models }`. `store.refreshStatuses`
reads `anyS.configured` + `anyS.model` (there is no `model` in the response) → `llm.label ===
"configured"`. The header chip rendered `label={llmStatus.label}` with `tone={configured ? "ok" :
"faint"}`. So the chip says **`configured`** (ok, green) whenever a key merely EXISTS — even when every
keyed call 401s. Browser-confirmed "before" state: `{"text":"configured","tone":"ok"}`.

### The fix (all inside my owned `src/components/console.tsx`)

- `KeyedOutcome` + `KEY_UNUSABLE_CODES` (`{RT_E_LLM_KEY_REJECTED, RT_E_LLM_KEY_SHADOWED}`) —
  `console.tsx:5927-5934`.
- `lastChatKeyedOutcome(rows)` — the newest persisted chat outcome (`project.chatLog`, the one keyed
  surface whose class is persisted; `chatOnce` writes `{error:true, code}` rows) — `:5938`.
- `laterKeyedOutcome(a,b)` — newest-wins (`:5955`).
- RunScreen: `keyedOutcome` state (`:1965`) records the console's own keyed `Spawn crew` result
  (`res.code` is typed on `CrewRunResult`'s failure arm) at `:2418`; success clears a stale chat failure.
- Derived `lastKeyed` / `keyUnusableCode` / chip label+tone+title at `:2231-2248`; chip at `:2783`.
  `StatusChip.tone` widened to `"ok" | "faint" | "danger"` (`:6772`).

**Honesty:** the title carries the code's catalogued meaning + agent action and the provider's own
tail-only message (`…42ff`); the provider masks the key itself (`****42ff`) and never emits the full
key — nothing here prints a secret. No prose is parsed: only the typed/persisted `code` field selects
the class.

### Chip copy — before / after (browser proof, desktop 1440×900)

| State | Chip text | tone | Evidence |
|---|---|---|---|
| **Before** (key present, no keyed outcome yet) | `configured` | ok (green) | `verify.json → chip_before` |
| **After — rejected key** (one keyed call refused) | `RT_E_LLM_KEY_REJECTED` | **danger (red)** | `verify.json → chip_rejected_state` |
| **After — keyed call succeeded** | `configured` | ok (green) | `verify.json → keyed_turn.chipAfter` |

Rejected-state title (verbatim from the browser, tail only):
`RT_E_LLM_KEY_REJECTED: The LLM provider rejected the API key it was sent (HTTP 401 authentication
failure) — … ; never paste the full key into logs. Last error: DeepSeek API key is invalid (HTTP 401 …,
Your api key: ****42ff is invalid) — key source: the process environment (tail …42ff)`

The rejected row was seeded into the persisted `chatLog` with **the exact shape `chatOnce` writes on a
401** (verified against the code path + `errors.ts`), not by causing a real 401 — so this proves the
chip's derivation against the real persisted contract. The chip then returned to `configured` after the
REAL keyed turn below, proving it tracks the LAST outcome, not a latch.

### Real keyed action — the happy path (bounded: 2 billed turns total)

Turn 1 (`verify.mjs`): one real chat turn on a fresh build. Reply (verbatim):
`There's no parked gate — the context shows lastGate: none and hitl: none, so no gate has been reached
yet. Next legal action: run P0 Deep Research & Feasibility (status: ready) via the console Run control
or the rapidtool CLI — this chat cannot run it. Grounded in build context v184625 as of P0/2026-10-02`

Turn 2 (`turn.mjs`, prompt "Reply with exactly the word: ready", with the provider's opt-in
`RAPIDTOOL_LLM_USAGE_LOG`): reply `ready`, grounded `v184625`. Measured usage (provider log line):
`{"ok":true,"requestedModel":"deepseek-v4-flash","servedModel":"deepseek-flash","code":null,
"promptTokens":519,"completionTokens":1,"cachedPromptTokens":256,"cacheMissTokens":263}`.

Total billed: **2 turns** (the cap). Both returned real model text; neither printed a secret.

### STOP-and-REPORT — the durable fix needs files I do not own

The console-side derivation only sees keyed outcomes the console can reach. A live VALIDITY probe is the
correct end state and it needs the status seam. **Exact requested shapes (do NOT edit from this lane):**

`src/lib/store.ts` (unowned):
```ts
/** In-memory surface for LLM wiring (never persisted — derived from llmStatus()). */
export type LlmStatusSurface = {
  configured: boolean;
  label: string;
  model?: string;
  /** C1 (332-5): the LAST keyed-call validity signal from the server probe.
   *  Absent until a keyed call has failed. NEVER carries the key. */
  lastKeyed?: { code: string; keySource?: string; detail?: string; at: number };
};
```
`refreshStatuses` must additionally map a validated `s.lastKeyed` (object with a string `code`) onto
`llm.lastKeyed`.

`src/lib/llm.ts` (unowned) — `statusServer` should return it:
```ts
{ configured: isDeepSeekConfigured(), models: deepSeekModelIds(), lastKeyed?: LastKeyed }
```
**When it fires / remedy:** the provider already builds a tail-safe `LlmCallTapRecord` on every call
(`deepseek.ts:735`, incl. `code`); a module-level *last record* + `getActiveKeySource()` /
`describeKeySource()` (key-source.server.ts) can populate `lastKeyed` with `{code, keySource: "…(tail
…42ff)", at}`. `RT_E_LLM_KEY_REJECTED` / `RT_E_LLM_KEY_SHADOWED` already exist in `errors.ts` — no new
code is requested. With that seam, the chip drops the chat-log derivation and reads the live probe.

---

## 2. C2 — the T5.2-A fixtures honesty surface had NO test (R9-f05)

**New file:** `src/lib/fixtures.review.test.ts` (imports `fixtures.ts` + `fixtures.server.ts` +
`fixtures.review.ts`). It drives a temp corpus OUTSIDE the repo (`mkdtemp` under `%TEMP%`, removed in
`after`) and asserts the contract:

1. a drafted fixture is **pending** (`reviewState:"awaiting-decision"`), never auto-approved;
2. the label names approval as a **CLI/human-seat** action and "records no decision";
3. `fixtureDecisionEntry` carries the acting human (`actor`) and no anonymous seat;
4. **a denied verdict writes nothing and stamps no `decidedBy`** — key set exactly
   `["actor","at","kind","note","slug","verdict"]`, `!("decidedBy" in entry)`, and the corpus is
   **byte-identical** (names + sizes + mtimes + contents) after a reject, row still pending;
5. a missing corpus returns an honest `ok:false` floor with the reason, never invented rows;
6. an orphan grader is surfaced, never dropped;
7. `fixturesReview()` (client wrapper) is callable outside a request and returns the honest
   `{ok:false, rows:[]}` shape — it never throws.

**Real results — both runtimes:**

| Runtime | Command | Result |
|---|---|---|
| Node **22.23.2** (pinned) | `node --experimental-strip-types --test --test-reporter=tap src/lib/fixtures.review.test.ts` | **7 tests / 1 suite / 7 pass / 0 fail**, exit 0 |
| Node **24.15.0** (host) | same | **7 tests / 1 suite / 7 pass / 0 fail**, exit 0 |
| Node 22, both fixtures suites | `… src/lib/fixtures.test.ts src/lib/fixtures.review.test.ts` | **15 tests / 3 suites / 15 pass / 0 fail**, exit 0 |

**Coverage guard (module-coverage):** `node scripts/check-module-coverage.mjs` →
`[module-coverage] 103/122 src/lib modules reached by a test · 19 allowlisted · 0 unallowlisted gap(s)`,
exit 0. `fixtures.review.ts` and `fixtures.server.ts` **no longer appear** in the allowlisted-gap output
(reached now). The guard's own suite `node --test scripts/check-module-coverage.test.mjs` → **6 pass /
0 fail**. The two `COVERAGE_ALLOWLIST` entries in `scripts/check-module-coverage.mjs:45-46` are now
stale (their reason string still says "reached by no test") — a `scripts/**` owner should delete those
two lines; I do **not** own that file (requested, §7).

---

## 3. C3 — register `AR6` / `R6-*` sweep

- **`AR6` does not exist anywhere in the repo** (repo-wide search: only this lane's own brief mentions
  the token). Treated as the register's `R6` rows (`research/multiagent/thoroughanalysis.md:1371-1385`).
- **All cited R6 rows are already landed.** Re-verified against CURRENT bytes today (I re-landed NONE of
  the rows 331-5 proved: f01/f07/f12/f13/f14/f15):

| Row | State today (bytes read) | Action |
|---|---|---|
| R6-f01 busy latch | landed; **not re-landed** | none |
| R6-f02 autonomy overclaim ×4 | `grep "autonomous software" src/` → comment-only rule hits; `og/site.json` = `"governed delivery harness"`; `index.tsx:7` / `__root.tsx` clean | none |
| R6-f03 fixtures label ×3 | all three files carry "approval is a CLI action … records no decision"; **one stale `console.tsx` comment** still quoted the OLD label | **FIXED** (comment only, `:502`) |
| R6-f04 "sandbox" ×3 UI | sites now read "bounded-runner" (`:1542` shortcuts · `:2151` a-key · `:4177` override) | none |
| R6-f05 census | doc-only; in-app Guide carries **no** census claim (nothing false); README done by W-12; AGENT_GUIDE not my file | recorded |
| R6-f06 ingest | in-app Guide names the Ingest seam (R6-f06 comment present) | none |
| R6-f07 Home help | landed (331-5 proved) | none |
| R6-f08 manifest | owner decision — record only | recorded |
| R6-f09 `.env` split | README/docs, not my files | recorded |
| R6-f10 Autopilot label | label `Autopilot · auto-approve eligible gates` + scope `title` present | none (W-29(e) landed) |
| R6-f11 wild badge | `wildPaused()` used at every site (`:856` helper + consumers) | none |
| R6-f12 pane boundary | landed (331-5); I did not touch it | none |
| R6-f13/f14/f15 | landed (331-5); I did not touch them | none |

Only in-scope honesty defect found and fixed: the FixturesPanel comment at `console.tsx:502` claimed
the loader label said "approving here records a decision" — it says the opposite. Rewritten to match the
bytes. This is a comment-only change (no behaviour).

---

## 4. Browser verification — desktop 1440×900

Raw evidence: `%TEMP%\rt332_chrome\verify.json`. Console/pageerror/HTTP≥400 captured per step; the only
4xx are the two unmatched URLs themselves.

| Check | Observed |
|---|---|
| `/` title + hero | `RapidTool — governed 13-phase delivery harness`; "Research first. Code second. Ship with a paper trail." |
| create build → `/run/<id>` | navigated; header chip present |
| chip BEFORE | `configured` / ok |
| primary tabs | `Artifacts`, `Agent packet`, `Chat` |
| `/run/<bad-id>` | `This build doesn't exist or was archived.` — 0 HTTP≥400 |
| `/run` (no param) | `Page not found …` (404 is the URL itself) |
| unmatched `/no-such-route-332` | `Page not found …` (404 is the URL itself) |
| chip AFTER rejected keyed outcome | `RT_E_LLM_KEY_REJECTED` / **danger** + full title |
| real keyed chat turn | real model reply (quoted §1); `chipAfter` = `configured` |
| bag | 0 pageerrors; console errors = the two expected 404s |

## 5. Browser verification — mobile ~390×844

| Check | Observed |
|---|---|
| `/` horizontal overflow | `scrollWidth 390 == innerWidth 390` |
| `/run/<id>` overflow | `390 == 390` |
| chip | `configured` / ok |
| primary tabs | 3 tabs render |
| sidebar drawer | toggle `aria-controls="run-sidebar"` opens (`aria-expanded="true"`, drawer visible) and Close dismisses it (`drawerAfterClose:false`) |
| `/run/<bad-id>` | honest message; `scrollWidth 390` (no blow-out) |
| bag | 0 console / 0 page / 0 HTTP≥400 |

## 6. Regression sweep (surrounding flows, desktop)

| Flow | Observed |
|---|---|
| Guide dialog | opens, heading `Agent guide`, Escape closes |
| Settings dialog | opens, Escape closes |
| Command palette (Ctrl+K) | opens (1 dialog), Escape closes |
| Execute/run step | body grew; `P0` / `Phase 1 of 13` present |
| bag | 0 console / 0 page / 0 HTTP≥400 |

Regression harness: `%TEMP%\rt332_chrome\verify.mjs`. Because this lane's console change is additive
(chip label/tone + one comment + assertion removal), the surrounding flows are unchanged.

---

## 7. What I could NOT reach / owed / requests

1. **A live VALIDITY probe** needs `src/lib/store.ts` + `src/lib/llm.ts` (both unowned) — exact shape in
   §1. Not edited.
2. **Removing the two now-dead `COVERAGE_ALLOWLIST` entries** needs `scripts/check-module-coverage.mjs`
   (unowned) — lines 45-46. Requested: delete `src/lib/fixtures.review.ts` and
   `src/lib/fixtures.server.ts` entries (the guard now reaches them).
3. **`run`/`runUntilHitlAsync` keyed failures are not classifiable in the console**: their return types
   (`RunResult`/`ApproveResult`) do not expose `code`, so a P6-synthesis 401 cannot move the chip today.
   Chat (persisted) and crew (typed `code`) are the reachable keyed classes. Fix belongs to the store
   seam in §1/`RunResult`.
4. The rejected chip state was proven with a **seeded persisted outcome of the real 401 shape**, not a
   real 401 (a real 401 would require pointing the dev server at an invalid key — unsafe/secret-touching).
   The happy path WAS a real keyed call.
5. `AR6` is not a register token anywhere in the repo (only my brief uses it) — inferred `§R6`.
6. **Non-null assertions:** the brief said `console.tsx` "has none today"; it actually had **two**
   (`byKind.get(n.kind)!` / `byKind.get(k)!`). I removed both → machine count **0** now.

## 8. Gates / targeted checks (no full gate per wave rules)

| Check | Result |
|---|---|
| `npx eslint src/components/console.tsx` | exit 0, 0 warnings |
| `npx eslint` on routes + fixtures files | exit 0, 0 warnings |
| `npx tsc --noEmit` (pinned Node 22) | 0 errors in `console.tsx` (whole-project run: no `error TS` lines) |
| non-null assertions in `console.tsx` | **0** (`[A-Za-z0-9_)\]]!\.` count 0; `!)` count 0) |
| new fixtures test, Node 22 + Node 24 | 7/7 pass each |
| module-coverage guard + its suite | 103/122, 0 unallowlisted, exit 0; suite 6/6 |
| keyed turns | 2 (cap), usage measured, both real model text |

**Dev server stopped; no listener on `:8080`; no stray node processes owned by this lane** (remaining
node processes belong to a live sibling lane — a `rapidtool-cli` run and `cli-exit-taxonomy.test.mjs` —
and were left untouched). Harness + all artifacts live only under `%TEMP%\rt332_chrome\`; nothing was
written into the repo except the owned source changes and this log.

---

# FOLLOW-UP (332 wave, post-lane) — Item 1 (R12-f05) + Item 2 (live validity probe)

**Granted files this follow-up:** `src/components/console.tsx` · `src/lib/store.ts` · `src/lib/llm.ts`
(+ the store suite). All other lanes closed. `npm run dev` still on **host Node 24**; harness + probe on
**Node 22.23.2** and **Node 24.15.0**. One keyed call total (the intentional 401, §9.2).

## 9.1 — Item 1: stale-run telemetry (R12-f05) — FIXED

**Root cause (confirmed against bytes, not the brief alone).** The WildFeed watchdog evaluated the stale
condition on a `hb` interval (`WILD_POLL_MS = 1100`, `console.tsx:781`) and emitted on every 10th tick
(≈11 s). The §2.5 coalescer window is `RT_COALESCE_MS = 5_000` (`rt-events.ts:315`), so an 11 s tick
**never** merges — a repeating emit wrote one row per tick. The message/seconds half was already fixed
(seconds ride `payload`), so the residual was purely the repeating emit.

**Fix — edge-triggered** (I did NOT touch `RT_COALESCE_MS`):
- `store.ts:350` `export function staleEmitStep(prev, staleNow): { emit; next }` — pure latch:
  `emit = staleNow && !prev`, `next = staleNow`. Fires once when the run ENTERS the stale state; a
  healthy tick resets the latch so the next episode reports again.
- `console.tsx:1053` `staleReported = useRef(false)`; `console.tsx:1205-1230` computes `lastAutoAt` /
  `staleNow`, advances the latch, and reports only on `staleStep.emit`.

**Probe (real modules, real coalescer) — `%TEMP%\rt332_chrome\probe-stale.ts`** imports the shipped
`store.ts` + `rt-events.ts` and drives three stale ticks at the real cadence:

```
Node 22: {"coalesceWindowMs":5000,"tickMs":11000,"staleTicks":3,
          "before_emitEveryTick":{"emits":3,"ringRows":3},
          "after_edgeTriggered":{"emits":1,"ringRows":1},
          "shouldCoalesceAt11s":false}
Node 24: identical output.
```

So the measured **write/row count is 3 before → 1 after** across the same elapsed time, and
`shouldCoalesce(@+11 s) === false` confirms the window is why.

**Test (fails-before / passes-after) — `store.test.ts`:** two pins —
(a) *"the real ~11 s tick exceeds the 5 s coalescing window"*: asserts `11000 > RT_COALESCE_MS`, that
two identical stale rows 11 s apart do **not** coalesce (`shouldCoalesce === false`), and that the
pre-fix repeating emit leaves **3** distinct rows; (b) *"edge-triggered stale emit writes ONE row per
episode"*: three stale ticks emit **1**, a healthy tick resets, a fresh episode reports once, a
still-stale tick stays quiet. Before the fix the suite won't even import (`staleEmitStep` absent).

**Browser note (honest):** I tried to force a live stale run by seeding an ACTIVE `wildRun` with an old
`lastAutoAt` and reloading — hydration correctly **stopped** the persisted active run
(`active` → false; the "persisted ACTIVE run is a session artifact" doctrine, store.ts clone/hydrate),
so `staleNow` was never true and 0 rows emitted. A genuine browser stale run therefore cannot be forced
from outside the driver; per the brief's own done-when ("a probe (stub reportRt/ring …)"), the probe +
unit tests are the Item-1 artifact.

## 9.2 — Item 2: the live LLM-status validity probe — LANDED

**The chain now carries a live keyed outcome to the chip**, with **no provider call in the probe**:

1. `llm.ts:125` `captureKeyedOutcomes()` installs the provider's existing `LlmCallTapRecord` tap once
   (server-side, lazy) and keeps the LAST outcome in module state; a genuine success CLEARS it
   (`llm.ts:143-147`). `keySource` is a tail-only label derived from `getActiveKeySource()`
   (`.env path (tail …NNNN)` / `the process environment (tail …NNNN)`) — the key value is never emitted.
2. `llm.ts:154` `statusServer` returns `{ configured, models, ...(lastKeyed ? { lastKeyed } : {}) }` —
   **additive + conditional**, so every existing shape pin stays byte-identical. `llmStatus()` now
   types and forwards `lastKeyed`.
3. `store.ts:95` `readLastKeyed(v)` validates the payload (hostile/partial dropped): a non-object, a
   non-string/empty `code`, or a non-finite `at` → `undefined`. `refreshStatuses` maps it onto
   `LlmStatusSurface.lastKeyed` (`store.ts:116`).
4. `console.tsx:2243` the chip merges the server `lastKeyed` with the persisted-chat and crew outcomes
   (newest wins); a server-derived note renders as **"Key source: …"** vs the chat-derived **"Last
   error: …"** (`console.tsx:2274`). The `configured` copy is kept whenever the last keyed call
   genuinely succeeded or none was seen.

**No money on render.** `statusServer` only READS the captured tap record — it makes no provider call.
`refreshStatuses` runs from an effect (mount) and after a keyed action (`console.tsx:2035`/`:2454`
crew, `:6373` chat `finally`), never during render.

**Browser proof — the live FAILURE path (one real 401, 0 tokens).** Dev server launched on an invalid
probe key via a temp env file (`%TEMP%\rt332_chrome\bad.env`, non-secret), ambient key differing:
- ONE chat send → `DeepSeek API key is invalid (HTTP 401 …Your api key: ****0000 is invalid…) — key
  source: …\bad.env (tail …0000)`. **Usage: promptTokens 0 / completionTokens 0 (401 before completion).**
- `probe-live.mjs`: chip after = `RT_E_LLM_KEY_REJECTED` / **danger**, title ends
  `… Key source: C:\…\bad.env (tail …0000)`; `fullKeyLeaked:false`.
- `probe-live2.mjs` isolates the SERVER surface: a **fresh** build with `persistedChatLog: 0` (no local
  rejection source) still shows `RT_E_LLM_KEY_REJECTED` / danger with the **"Key source:"** phrasing —
  the only source that renders that is `lastKeyed`. The captured `statusServer` response body (TanStack
  serialization) carried
  `lastKeyed = { code:"RT_E_LLM_KEY_REJECTED", at:1790968057606, keySource:"…bad.env (tail …0000)" }`.
  `fullKeyLeaked:false`.

**Browser proof — the live ABSENT/`configured` path (fresh-key server, no keyed call).** Restarting on
the repo key (fresh process ⇒ empty tap): desktop 1440×900 and mobile 390×844 both read
`configured` / ok with title `LLM backend status` (`check-configured.mjs`), 0 console/page errors. So a
genuine success (tap cleared) honestly returns the chip to `configured`.

## 9.3 — Desktop + mobile + regression sweep (no keyed calls)

`sweep2.mjs`, desktop 1440×900 + mobile 390×844, run on both the bad-key and fresh-key servers:
- chip: danger `RT_E_LLM_KEY_REJECTED` (bad-key) and `configured` (fresh-key) on BOTH viewports.
- 3 primary tabs render; `/run/<bad-id>` → honest "This build doesn't exist or was archived.";
  `/run` and unmatched → "Page not found" (404 is the URL itself).
- Guide dialog ("Agent guide"), Settings dialog, Ctrl+K palette (1 dialog) all work.
- mobile: `scrollWidth 390 == innerWidth 390` (home + run); sidebar drawer opens
  (`aria-expanded="true"`) and Close dismisses it.
- bag: **0 console / 0 page errors** on both viewports.

## 9.4 — Gates / suites / cleanup

| Check | Result |
|---|---|
| `npx eslint src/components/console.tsx src/lib/store.ts src/lib/llm.ts src/lib/store.test.ts` | exit 0, 0 warnings |
| `npx tsc --noEmit` | 0 diagnostics in my files |
| non-null assertions in `console.tsx` | **0** (unchanged) |
| `store.test.ts` + `llm.test.ts` + `fixtures.review.test.ts` on **Node 22.23.2** | **109 tests / 3 suites / 109 pass / 0 fail** |
| same suites on **Node 24.15.0** | **109 tests / 3 suites / 109 pass / 0 fail** |
| `probe-stale.ts` Node 22 + Node 24 | 3 → 1 rows, identical |
| keyed calls | **1** (the intentional 401; 0 tokens) |

**Cleanup:** dev server stopped; `0` listeners on `:8080`; `0` vite/`with-app-env` node processes; `0`
Playwright chromium processes. All harnesses/probes live only under `%TEMP%\rt332_chrome\` — nothing
committed into the repo. `RT_COALESCE_MS` and the §2.5 window were **not** touched.

**Still owed / not fixed (carried):** (1) the two now-dead `COVERAGE_ALLOWLIST` entries in
`scripts/check-module-coverage.mjs:45-46` — a `scripts/**` owner should delete them (unchanged request);
(2) `run`/`runUntilHitlAsync` keyed failures still expose no `code`, so a P6-synthesis 401 can't move
the chip (a `RunResult`/store change, unowned); (3) the tap is process-global and installed by the
status probe — correct for this single-user local console, but a second in-process tap consumer would
be overwritten (no such consumer in the app server today).
