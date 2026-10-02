# W46 / 332-2 — "Ledger" — spend truth & budget

Lane log. HEAD at open `6cd5123`. Owned files touched (patch-only):
`src/lib/token-ledger.ts`, `src/lib/headless.ts`, `src/lib/doctor.ts` +
`token-ledger.test.ts`, `headless.test.ts`, `doctor.test.ts`.
`src/lib/types.ts` / `src/lib/engine.ts` were **NOT edited** (W46 C2).

Baseline asserted after every edit: `npx tsc --noEmit` exit 0; `npx eslint` on
the six files exit 0 / 0 warnings. No keyed calls, no `npm run eval`, no full gate.

---

## Verdict per finding

### L1 — `summary.budget.spent` reports per-invocation spend (FIXED)

**Root cause (read on bytes).** `headless.summary()` built `budget` from
`packetBudgetBoundary(sessionTokenBudget())` — the PROCESS session ledger. A CLI
verb is a fresh process, so the ledger starts empty and only ever holds the
current invocation (the measured `446 → 0 → 77654`). Nothing wrote the run's
spend back onto the project, even though `Project.tokenUsage` already existed
(types.ts:564, "accumulated ... for this run") and `packet.ts:643` already read
it — it was never populated. `doctor`'s spend block had the same defect
(`doctorStatus` passed `sessionTokenBudget().ledger`, empty → `calls: 0`); worse,
when `--tree` was given the `factoryClaim` call **dropped the spend argument
entirely** (headless.ts, treeDir branch), so the block read `measured:false`.

**Fix, all inside the owned files.**
1. `token-ledger.ts` — new pure, additive seam: `SpendSlice` (the persisted
   shape), `normalizeLedger`, `accumulateSpend`, `spendDelta`. They never read
   env, never set a cap, never clamp spend away. The session ledger/cap
   semantics are untouched (docblock updated to say so).
2. `headless.runUntilGate` — snapshots `sessionTokenBudget().ledger` at entry,
   and at the run boundary folds `spendDelta(current, baseline)` into
   `project.tokenUsage` via `accumulateSpend` **only when the invocation really
   spent** (a zero-spend run never rewrites a legacy 2-key record into a
   fabricated-zero shape). This is the one seam every drive verb shares
   (`run` / `gate` / `resume` / `unattended` all call `runUntilGate`).
3. `headless.summary` — `budget.spent` is the project's persisted cumulative
   total when `project.tokenUsage` is present, else the session number (legacy
   fallback, so a never-persisted project is byte-identical). `cap` /
   `stop_reason` stay the PROCESS session's — the `RAPIDTOOL_TOKEN_CAP` runaway
   stop is not re-derived and not weakened.
4. `headless.doctorStatus` — resolves the spend source through the new
   `resolveDoctorSpendSource` seam (priority: explicit `opts.spend` → the
   `projectPath` file's `tokenUsage` → the tree's `.rapidtool/project.json`
   record → the session ledger), and now passes it to the `--tree`
   `factoryClaim` too. `doctor.estimatedCostUsd` stays `null` with the honest
   "no caller prices — token-ledger ships no price catalog" line.

### L2 — the cap must stop a runaway, not just one call (VERIFIED; no hole in owned files)

Grep of every production (non-test) module for `emptyLedger()` /
`createTokenBudget(` (2026-10-02):

```
codegen.server.ts:3141  const { ledger, cap } = sessionTokenBudget();
codegen.server.ts:3163  ledger: TokenLedger = sessionTokenBudget().ledger,
codegen.server.ts:3164  cap: number | undefined = sessionTokenBudget().cap,
crew.server.ts:956      const budget = opts.budget ?? sessionTokenBudget();
headless.ts:3936        budget: sessionTokenBudget(),        // verify seam
packet.ts:647           const budget = opts?.budget ?? sessionTokenBudget();
token-ledger.ts:129     emptyLedger() definition
token-ledger.ts:439     createTokenBudget(ledger = emptyLedger()) default param
token-ledger.ts:499     recordSessionSpend defensive repair
```

No production call site passes `emptyLedger()` or a fresh per-call ledger.
`synthWithBackoff` (codegen:3685, :4124) omits `ledger`/`cap` → session
defaults; the bounded repair calls go through `accountRepairUsage` →
`accountSynthUsage` on the same session ledger; `verify.server` runs through the
session budget threaded by `headless.verifyGeneratedSource`. So `R12-f02`'s
"cap cannot stop a runaway because the ledger is per-call" is closed on bytes —
the per-process cap binds across synth retries, repair re-prompts and verify.
This lane's change does NOT feed persisted spend into the cap (asserted by a
new test: `accumulateSpend`/`spendDelta` leave `sessionTokenBudget().ledger`
untouched).

### L3 — sweep of the three files (DONE)

- `doctorSpend` reads only ledger fields / ledger helpers (`totalTokens`,
  `estimateCostUsd`); a legacy 2-key slice reports `calls: null`, never a
  fabricated `0` (new test). `estimatedCostUsd` stays `null` without prices and
  the line says so.
- `summary.budget.spent` uses `totalTokens` over the normalized slice — the same
  sum the ledger itself computes; no independent arithmetic.
- No budget stop is swallowed in the three files; `recordSessionSpend` is
  deliberately non-throwing (documented), and enforcement stays at the gate
  seams (`assertBudgetHeadroom` / `recordBudgetSpend`) in codegen/verify.
- No silent drop introduced: `runUntilGate`'s fold is conditional but nothing is
  removed; unreadable/corrupt project records degrade to the honest session
  floor via a caught read (never a throw, never a printed file body).

---

## Before / after — real commands

Scratch: a copy of the recorded project `research/eval-out/real-estate-crm` at
`%TEMP%\rt332_ledger\proj` with a persisted run slice injected into
`.rapidtool/project.json`: `tokenUsage = { promptTokens: 60000,
completionTokens: 17654, calls: 12 }` (total 77654 — the run cost the operator
must be able to read; no keys involved).

```
node --experimental-strip-types scripts/rapidtool-cli.mjs summary --project <tmp>/.rapidtool/project.json
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --tree <tmp>/proj
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor
```

**BEFORE (HEAD `6cd5123` bytes):**

```
summary.budget            = { "spent": 0, "cap": null, "stop_reason": null }
doctor --tree factory.spend = { "measured": false, "totalTokens": null, "calls": null,
                                "estimatedCostUsd": null, ... }
doctor (plain) factory.spend = { "measured": true, "totalTokens": 0, "calls": 0,
                                 "estimatedCostUsd": null, ... }
```

**AFTER (this lane):**

```
summary.budget            = { "spent": 77654, "cap": null, "stop_reason": null }
doctor --tree factory.spend = { "measured": true, "promptTokens": 60000,
                                "completionTokens": 17654, "totalTokens": 77654,
                                "calls": 12, "estimatedCostUsd": null,
                                "pricesSupplied": false,
                                "line": "spend: 77654 tokens measured (prompt 60000 +
                                         completion 17654 · 12 call(s)) · est. cost n/a
                                         (no caller prices — token-ledger ships no price
                                         catalog)" }
```

The same run now reads 77654 in `summary` and in `doctor --tree` instead of `0`
/ `measured:false`; the cap line is unchanged (`null` here because no
`RAPIDTOOL_TOKEN_CAP` is set), and the no-price-catalog honesty line is intact.

`doctor` **without** `--tree`/`--project` still reports `calls: 0`: it is handed
no project at all (documented as "the only subcommand that needs no project
file"), so the honest floor stands. `doctor --tree <projectdir>` and the new
`doctorStatus({ projectPath })` seam both report the project's real spend. To
make a bare `doctor --project <file>` do the same, the CLI doctor arm must pass
`projectPath` (see "stopped / cross-boundary" below).

---

## C2 request — exact `types.ts` shape (parent may grant)

**Requested change (types.ts, mechanical, additive — no runtime behaviour):**

```ts
// before (types.ts:564)
/** B3: accumulated DeepSeek token usage for this run. Absence = unmetered. */
tokenUsage?: { promptTokens: number; completionTokens: number };

// requested
/** B3/W46 · 332-2: accumulated provider token usage for this project's run
 *  across every invocation. Absence = unmetered. `calls`/cache are optional so
 *  a legacy 2-key record stays type-valid; readers never invent a missing 0. */
tokenUsage?: import("./token-ledger.ts").SpendSlice;
```

`SpendSlice` (exported in `token-ledger.ts`) is
`{ promptTokens: number; completionTokens: number; calls?: number;
cachedPromptTokens?: number; cacheWriteTokens?: number; reasoningTokens?: number }`.

- **Default:** none — the field stays optional/absent (absence = unmetered).
- **Read sites:** `packet.ts:643` (`packetSpendSummary`), `doctor.doctorSpend`
  (via `doctorStatus`), `headless.summary`, `headless.runUntilGate` baseline
  arithmetic, `exportProjectJson`/`hydrateProject` (`...raw` spread passes it
  through — verified).
- **Write site:** `headless.runUntilGate` (the fold) — the ONLY writer.
- **Migration-in-place rule:** a record with no `tokenUsage` stays absent and
  keeps the session-ledger fallback; a legacy 2-key record reads as-is with
  `calls`/cache absent (readers emit `null`, never a fabricated `0`); the writer
  only touches the field when an invocation actually spent. No `_v` bump (pure
  additive widening).
- **Consumer impact:** none breaking — widening an optional field; `packet.ts`
  and `doctor.ts` accept `SpendSlice` structurally.

**No `engine.ts` change is requested (and one must NOT be added).** Evidence:
the measured `gate` spend flows through `headless.runLayer → runP6Edge →
driveP6Journey → codegen`, never through `engine.runPhaseAsync`; `liveLayer`
(P6 excluded) is therefore not a complete write site. Adding a second per-phase
fold in engine while `runUntilGate` folds the whole-session delta would
double-count. If the parent prefers the engine to own the write instead, the
`runUntilGate` fold must be removed in the same change — otherwise the pending
`projectSpendDelta` seam already lives in `token-ledger.ts` for that shape.

---

## Tests added (real results, both runtimes)

Run under Node 22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node
24.15.0; both `--experimental-strip-types --test --test-reporter=tap`.

| suite | baseline | after | Node 22 | Node 24 |
|---|---|---|---|---|
| `src/lib/token-ledger.test.ts` | 31 | **39** (+8) | 39 pass / 0 fail / 5 suites | 39 pass / 0 fail / 5 suites |
| `src/lib/headless.test.ts` | 121 | **126** (+5) | 126 pass / 0 fail / 37 suites | 126 pass / 0 fail / 37 suites |
| `src/lib/doctor.test.ts` | 23 | **26** (+3) | 26 pass / 0 fail / 4 suites | 26 pass / 0 fail / 4 suites |

Added:
- token-ledger: `isMeasuredSpend` (the two required counts decide; calls/cache
  optional; junk false), `normalizeLedger` (foreign/null→empty, negatives floor,
  cache keys never invented), `accumulateSpend` (counts summed as-is, no
  +1/call, legacy slice + delta), `spendDelta` (field-wise, clamped ≥0), and a
  purity pin that the helpers never touch the session ledger/cap.
- headless: `summary.budget.spent` = persisted 77654 (fails pre-fix, which read
  the empty session); the session cap still crosses while `spent` stays the run
  total; `runUntilGate` folds this invocation's measured P6 spend into
  `project.tokenUsage` (injected synthesize, key-policy-independent); a
  save→load round-trip so the next process still sees the cost;
  `resolveDoctorSpendSource` priority (explicit → projectPath → tree record →
  session, including the legacy no-`tokenUsage` fallback).
- doctor: a persisted slice reports real tokens + `calls: 12` with
  `estimatedCostUsd: null` and the honest no-catalog line; a legacy 2-key slice
  reads `calls: null` (never 0); an empty session ledger is a measured zero.

"Fails before": the CLI before/after above is the pre-fix/fixed evidence for the
same project bytes, and the new `summary.budget.spent` test asserts 77654 where
the pre-fix code returned 0.

---

## Stopped / cross-boundary (not fixed by this lane)

1. **Bare `doctor --project <file>`** still reports the session floor: the CLI
   doctor arm (`scripts/rapidtool-cli.mjs`, owned by 332-4) calls
   `h.doctorStatus(tree ? { treeDir: tree } : undefined)` and never passes
   `CLI_PROJECT`. The headless seam is ready — request one line for 332-4:
   `h.doctorStatus({ ...(tree ? { treeDir: tree } : {}), ...(CLI_PROJECT ? { projectPath: CLI_PROJECT } : {}) })`.
   `doctor --tree <projectdir>` already works today.
2. **`engine.ts` / `types.ts` not edited** (C2) — the `tokenUsage` widening is
   requested above. Typecheck passes today because the production write assigns
   a `TokenLedger` (a named value, no excess-property check), but an object
   *literal* carrying `calls` is a TS2353 against the narrowed field — the new
   headless tests therefore build their persisted slice through an intermediate
   variable, and `tsc --noEmit` was confirmed 0 after that. The widening is
   still needed for the type to advertise `calls`/cache and to document the
   contract.
3. **Non-`runUntilGate` spend** (`repairTreeDir`, `wildStep`, console
   `runPhaseAsync`) does not fold into a project's persisted slice — those verbs
   never call the run boundary. Out of this finding's scope (L1 is about the
   `gate` run); folding there would need its own per-verb baselines.
4. **`packet.ts`'s disk envelope** still carries the process-snapshot
   `budget.spent` with its `PACKET_BUDGET_SCOPE` label (packet.ts is unowned).
   It is honest by its own label; not changed here.
