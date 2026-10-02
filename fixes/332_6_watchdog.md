# 332-6 · "Watchdog" — runtime telemetry & robustness (W46)

- **Lane:** 332-6 (Watchdog). **Wave:** W46 (332). **HEAD at open:** `6cd5123`, tree clean.
- **Owned files:** `src/lib/rt-events.ts`, `rt-ring.ts`, `rt-client.ts`, `watchdog.ts`,
  `diagnose.ts`, `runtime-log.server.ts` + their `*.test.ts`.
- **Method:** reproduce before fixing. Repros ran out-of-repo at `%TEMP%\rt332_6\` (the repo
  gained no probe file). No keyed calls, no `npm run eval`, no full gate (siblings mid-edit),
  no secret printed.

**Headline result:** at HEAD, **W1, W2 and W3 are already fixed** by earlier waves; the
register `§R12-f04/f06/f07` text describes a _pre-W29/W39/W42_ tree. **W4 is only half-fixed —
a live residual remains** (details below). I verified this rather than re-landing fixes that
are already in the bytes, and I added the missing regression pins for W1/W3/W4.

## Verdict per finding

| # | Register row | Verdict | Evidence |
|---|---|---|---|
| W1 | R12-f04 — step budget < legal P6 step | **ALREADY RESOLVED** (commit `2fa3cd9e`, W29 `fixes/271`) | measured below |
| W2 | R12-f07 — `diagnose` growth hardcoded zeros | **ALREADY RESOLVED** (CLI `R12-f07` landing; browser honest-null) | measured below |
| W3 | R12-f06 — `readRtTail` reads whole file | **ALREADY RESOLVED** (`0deca1e6`: W39 B2 + W42 L4-G6) | code + tests below |
| W4 | R12-f05 — stale telemetry defeats coalescer | **PARTIALLY RESOLVED — RESIDUAL LIVE** | measured below → STOP-AND-REPORT |
| W5 | telemetry-contract sweep | **swept, no new live defect in the six files** | notes below |

---

## W1 · R12-f04 — VERDICT: already resolved; not reproducible

`rt-events.ts:274/279` now reads:

```
export const P6_PHASE_MAX_MS = 240_000;
export const WILD_STEP_BUDGET_MS = P6_PHASE_MAX_MS + 15_000;   // 255_000
```

`codegen.server.ts:151` consumes it (`P6_SYNTH_TIMEOUT_MS = P6_PHASE_MAX_MS`). Every live
consumer (`diagnose.ts:232/249`, `rt-client.ts:698`, `console.tsx:1200/1214`,
`rapidtool-cli.mjs:4487`) imports the derived constant — no literal `90_000` for the wild step
survives anywhere (`grep` across `src/**`, `scripts/**`). The `90_000` in the register is the
old W29 value; `watchdog.test.ts:15`'s `B = 90_000` is a generic local test budget, unrelated.

**Before (the register repro — the old 90 s budget):** probe `%TEMP%\rt332_6\probe_rt.mts`:

```
=== W1: step budget vs legal P6 max ===
P6_PHASE_MAX_MS      = 240000
WILD_STEP_BUDGET_MS  = 255000 (old register value was 90000)
budget > phase max?  = true
legal 200s step tier = 0 (0 healthy)
legal 240s step tier = 0 (0 healthy)
stale 300s step tier = 1 (1 overdue)
frozen 512s autopause= true (true)
old budget would flag 200s: 2 (1/2 = false frozen)   <-- the R12-f04 defect, on the old value
```

**Stall decision at the real detector** (`buildDiagnosis`, probe `probe_diag.mts`):

```
budget = 255000 | phase max = 240000
legal 200s step  elapsed=200000  class=none-detected
legal 240s step  elapsed=240000  class=none-detected
frozen 300s step elapsed=300000  class=wild-step-timeout
frozen 600s step elapsed=600000  class=wild-step-timeout
```

A legal keyed P6 step (≤ 240 s) does **not** rank `wild-step-timeout`; a genuinely frozen run
(≥ 255 s, and the 2× latch at 510 s) still does. The CLI path confirms the reported budget:
`watchdog.budgetsMs = {"wildStep":255000,"chat":60000}`.

**Fix:** none needed (already derived, single source). Added a regression pin at the pure
decision seam (see Tests).

---

## W2 · R12-f07 — VERDICT: already resolved; reproduced at runtime

The CLI growth surface reads real sizes (`rapidtool-cli.mjs:4377-4499`): `statSync(CLI_PROJECT).size`
into `projectFileBytes`, `rtServer.logDirBytes(...)` into `logDirBytes`, real
`decisions.length` / `chatLog.length` counts, and `localStorageEstimate: null` (honest
not-measured). The browser path (`rt-client.ts:719-734`) returns real `rows` counts and
`bytes.projectFile/logDirBytes: null` (was a fake `0`, K7 item-5 class) — unit-tested at
`rt-client.test.ts:241-279`.

**Runtime repro** — copied a project JSON to `%TEMP%\rt332_6\proj.json`, padded to the
register's counter-example size, then `rapidtool-cli.mjs diagnose --project <copy>` (keyless;
the tracked `research/eval-out/**` dir was never touched — the copy and its log dir live in
`%TEMP%`):

```
ok=True cmd=diagnose
growth.rows      = {"ledger":2,"telemetryRing":1,"chatLog":0}
growth.bytes     = {"projectFile":158302,"logDirBytes":298,"localStorageEstimate":null}
watchdog.budgets = {"wildStep":255000,"chat":60000}
on-disk bytes    = 158302
```

`growth.bytes.projectFile = 158302` equals the on-disk size exactly — the register's
"158,302-byte counter-example" now reports **158302, not 0**. The detector is live.

**Fix:** none needed (CLI file is not mine; browser side already correct + tested).

---

## W3 · R12-f06 — VERDICT: already resolved; not reproducible

`runtime-log.server.ts:135-189` is already a true tail read: `statSync` size → `start = max(0,
size - 256 KB)` → `openSync` → `readSync` **exactly** `windowBytes = size - start` bytes
(≤ 256 KB) in one `Buffer`, short-read tolerant, then whole-window `buf.toString("utf8")`.
The whole-file `readFileSync`+slice path is gone (W39 B2 fixed the multibyte-boundary decode;
W42 L4-G6 replaced the read itself). **Allocation:** one `Buffer.alloc(windowBytes)` where
`windowBytes = min(size, 262144)`; the previous path allocated the whole file (∝ size) plus a
decoded string. A short file (`size < 256 KB`) sets `start = 0` and is read whole; a torn
first line at a split multibyte boundary decodes to a partial line that is skipped as junk —
whole rows are never corrupted.

**Fix:** none needed. Added the two missing pins (short file; split multibyte boundary) —
both pass (see Tests).

---

## W4 · R12-f05 — VERDICT: PARTIALLY RESOLVED — RESIDUAL LIVE (STOP-AND-REPORT)

The message-stabilisation IS landed in `console.tsx:1204-1218` (stable
`"Wild run P${phase} stale past budget"`, `staleSeconds`/`budgetMs` in `payload`, code
`RT_E_LLM_TIMEOUT`). **But it does not stop the churn the register describes.** Reproduced
with probe `probe_rt.mts` against the live `rt-ring`/`rt-events`:

```
=== W4: do two consecutive stale ticks coalesce? ===
RT_COALESCE_MS = 5000 | console emit cadence = 1100ms * 10 = 11000ms
11s-cadence stable-message rows: 3 (want 1 coalesced; count: undefined )
1s-cadence  stable-message rows: 1 (count: 3 )
1s-cadence OLD changing-message rows: 3
shouldCoalesce(prev, next@+11s): false
shouldCoalesce(prev, next@+1s):  true
```

The stale row is emitted on the **10th heartbeat tick** (`console.tsx:1185-1187`,
`hbTicks % 10`; `WILD_POLL_MS = 1100` at `console.tsx:780`) ⇒ an emit every **~11 s**.
`shouldCoalesce` windows on `now - prev.ts <= RT_COALESCE_MS` with `RT_COALESCE_MS = 5_000`
(`rt-events.ts:315/350`). **11 s > 5 s**, so consecutive ticks never coalesce: each appends a
row, and `reportRt` write-through-persists every warn+ row (`rt-client.ts:317-318`) ⇒ one
`localStorage.setItem` per tick. At the real cadence the message fix changes the write count
from **3 → 3** (no-op); 1 write only happens at a **sub-5 s** cadence.

So the register's causal claim ("changing `stale Ns` in the messageHash") is not the whole
story: the coalescer window is **shorter than the emit cadence**, which defeats coalescing even
with a perfectly stable message. The brief's required pin ("two consecutive stale ticks
coalesce to one write") is **not satisfiable at the production cadence** with the current
window.

**Why I did not fix it here:** the emit cadence lives in `src/components/console.tsx`
(owned by lane 332-5, not me). The clean fixes are (a) edge-trigger the stale row in
`console.tsx` (emit once on entry into stale, re-arm on recovery), or (b) emit it on the 1.1 s
tick; either collapses to one row under the existing 5 s window. Raising `RT_COALESCE_MS`
above ~11 s instead would change the documented §2.5 window and the long-task coalescing
(`rt-client.ts:483`) — a doctrine change beyond this lane's brief, so I deliberately did not
make it.

**STOP-AND-REPORT (AGENTS.md §7 / W46 rule 7):** the residual fix needs `console.tsx`, which I
do not own. Requested: 332-5 (or the parent) edge-trigger / re-cadence the stale emit in
`console.tsx:1185-1220`; after that, the existing coalescer collapses it and a pin at the real
cadence can assert one row. I added the payload-insensitivity pin that holds regardless (Tests).

---

## W5 · telemetry-contract sweep — no new live defect in the six files

- **Purity:** all six modules are side-effect-free at module scope; `rt-client` uses only
  `window`-guarded functions and every capture handler is wrapped (`reportRt` never throws —
  pinned at `rt-client.test.ts` "reportRt never throws on hostile inputs"). No fix needed.
- **Never throw into the observed code:** `appendRtLine`/`rotate` swallow all fs errors
  (`runtime-log.server.ts:106-128`); `rtPush`/`rtHydrate`/`rtStats`/`rtTail` have M3-01…07
  junk-input guards (pinned in `rt-ring.test.ts`). No fix needed.
- **Bounded + corrupt-safe:** ring cap 200 rows / 64 KB, heartbeat → sidecar, crash snapshot
  16 KB; NDJSON rotation 5 MB × `LOG_KEEP=4` (≤ 20 MB). Bounded. No fix needed.
- **`installRtClient` idempotence:** `installed`/`installedFailed` latch
  (`rt-client.ts:418-419`); `disposeRtClient` clears the observer, interval and every tracked
  listener (pinned: "installRtClient boots the capture host once under a fake window (A3-01)",
  "M6-08: disposeRtClient … tears down observer + heartbeat + listeners"). No fix needed.
- **Observation (not fixed, not owned):** `boundedStepWatch` and `WILD_STEP_AUTOPAUSE_MS` have
  no production consumer (the pure seam is exercised by tests only); already documented as a
  TODO in `rt-events.ts:280-284`. Removing/rewiring them touches the export surface — left
  as-is.

---

## Tests added (real results)

| File | Test | Pins |
|---|---|---|
| `watchdog.test.ts` | "R12-f04: the live step budget clears a legal P6 synthesis step yet still latches a frozen one" | W1 at the pure decision seam using the real `P6_PHASE_MAX_MS`/`WILD_STEP_BUDGET_MS` (was only pinned indirectly via `rt-client.test.ts`) |
| `runtime-log.server.test.ts` | "readRtTail reads a sub-256KB file whole (short-file tail, W3)" | W3 short-file |
| `runtime-log.server.test.ts` | "readRtTail: a window boundary that splits a multi-byte char yields only whole rows (W3)" | W3 split UTF-8 boundary (>256 KB fixture; asserts the window start is a continuation byte, no returned row contains U+FFFD) |
| `rt-ring.test.ts` | "R12-f05: a stable stale message + changing payload.staleSeconds coalesces" | W4 payload is not in the fingerprint (stable message ⇒ one slot, `count` 3) |

**Real suite results** — the six owned suites, `--test-reporter=tap`:

```
Node 22.23.2 (pinned):   # tests 88  # pass 88  # fail 0  # skipped 0  # todo 0
Node 24.15.0 (host):     # tests 88  # pass 88  # fail 0  # skipped 0  # todo 0
```

Baseline at wave open for these six files was **84** tests, all passing; the four added pins
bring it to **88**, all passing on both runtimes.

## What I deliberately did NOT do, and why

- **Did not edit `console.tsx`** (lane 332-5's file) — that is where W4's residual fix lives.
  Stop-and-report above; a coalescer-only change cannot honestly satisfy the brief's pin.
- **Did not change `RT_COALESCE_MS` / §2.5 window semantics** — it is a documented, tested
  design constant used by the long-task probe too; widening/sliding it to mask an 11 s emitter
  cadence is a doctrine change the brief did not ask for.
- **Did not "fix" W1 by editing `rt-events.ts`** — the value is already the derived
  `P6_PHASE_MAX_MS + 15_000`; re-landing it would be fabrication.
- **Did not run the full gate**, `npm run eval`, or any keyed call; targeted suites only
  (siblings were mid-edit: `console.tsx`, `codegen.server.ts`, `headless.ts`, `token-ledger.ts`
  all showed modified during this lane).
- **Did not run the CLI against tracked `research/eval-out/**`** — W2's repro used a `%TEMP%`
  copy so no tracked eval artifact was appended to.
