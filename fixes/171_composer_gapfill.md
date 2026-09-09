# 171 Composer Gap-Fill

Agent: 171 (Composer 2.5 / grok-composer-2.5-fast)
Scope: DISJOINT modules only — vault / rt-client / rt-events / rt-ring / bench / swarm / design / diagram / harvest / watchdog / diagnose
Constraint: no plan-owned files (store/engine/io/headless/codegen/deepseek/scaffold/dod/types/console/cli/errors/phases/packet/knowledge/wild-mode/node-runner/verify/crew)

## Findings

### 1. vault.ts — wire dead corrupt-store helpers + fix dailyNote RangeError
- **Where:** `src/lib/vault.ts` — `strField` / `tsField` / `row` / `rowsOf` (formerly unused ~L128–152); `iso`, `utcDay`, `utcTime`, `cleanTitle`, `tagClean`, `excerpt`, `oneLine`, `buildVaultNotes`, `dailyNote`, `latestActivityDay`, `phaseLessonRows`, `lessonNote`
- **What:** Wired the four dead coercion helpers into real consumers. Collections go through `rowsOf` + `row` (non-arrays → `[]`, scalar junk skipped). Timestamps go through `tsField` (clamped to ISO-safe range). Strings through `strField`.
- **Why (real bug):** `dailyNote` called `new Date(ts).toISOString()` on hostile/out-of-range epoch values → **RangeError: Invalid time value**. Header already promised MAX_EPOCH_MS clamping but `utcDay` / daily time formatting did not use it.
- **Test:** `src/lib/vault.test.ts` — suite `vault corrupt-store hardening (strField/tsField/row/rowsOf)` (4 cases: non-array collections, junk rows, out-of-range ts, non-array logs/decisions).

### 2. rt-client.ts — drop unused imports (lint)
- **Where:** `src/lib/rt-client.ts` L36–58 imports
- **What:** Removed unused `HEARTBEAT_PERSIST_EVERY_MS`, `overdueRowSeed`, `timeoutRowSeed`.
- **Why:** Heartbeat path already uses `HEARTBEAT_TICKS_PER_PERSIST` (derived from `HEARTBEAT_PERSIST_EVERY_MS` inside watchdog). `overdueRowSeed` / `timeoutRowSeed` belong to store/headless wild-step drivers (plan-owned) — client heartbeat emits lag/stall events, not step overdue/timeout seeds. No invented persistence.
- **Test:** existing `src/lib/rt-client.test.ts` (unchanged surface).

### 3. harvest.ts — unused `joined` lint
- **Where:** `src/lib/harvest.ts` ~L701 `harvestResultLesson`
- **What:** Deleted dead `const joined = notes.join(" ").toLowerCase()` (rate-limit detection already uses `notes.find` + `RATE_LIMIT_RE` per-note).
- **Test:** existing harvest lesson suite still green.

### 4. rt-events.ts — sanitizeRtEvent did not clamp seed stacks
- **Where:** `src/lib/rt-events.ts` `sanitizeRtEvent`
- **What:** Stack strings now split → ≤12 lines × ≤240 chars (same budgets as `flattenStack`), including host-supplied `seed.stack`.
- **Why:** Prior path only null-checked; a huge single-line or multi-line seed stack passed through unbounded into the ring.
- **Test:** `src/lib/rt-events.test.ts` — `sanitizeRtEvent clamps stack to ≤12 lines × ≤240 chars (seed stacks included)`.

### 5. rt-ring.ts — hydrate trusted junk stall.class
- **Where:** `src/lib/rt-ring.ts` `rtHydrate` stall sidecar
- **What:** Validate `stall.class` against `step-overdue | mainthread-stall | step-timeout`; unknown → `"step-overdue"`.
- **Why:** Cast-through allowed arbitrary strings into the typed latch (honest floor, never throw).
- **Test:** `src/lib/rt-ring.test.ts` — `hydrate clamps unknown stall.class to step-overdue`.

### 6. diagnose.ts — hostile/partial input floors
- **Where:** `src/lib/diagnose.ts` `buildDiagnosis`
- **What:** Non-array `errors`/`timeline` → `[]`; missing `project`/`watchdog`/`persistHealth`/`growth`/`crashSnapshot` get safe defaults (watchdog budgets use real `WILD_STEP_BUDGET_MS` / `CHAT_STEP_BUDGET_MS`). `row.message` nullish → `String(...).slice` (no throw on wild-paused-error summary).
- **Test:** `src/lib/diagnose.test.ts` — `buildDiagnosis floors missing errors/timeline arrays and nullish message`.

## Not changed (intentional)
- **bench.ts** — synthetic estimates remain honest floors (Phase-B meters are plan-owned on deepseek/engine).
- **swarm / design / diagram** — no unused-lint hits; no silent ok:true-on-failure found in a quick pass.
- **watchdog.ts** — already clean; overdue/timeout seed builders stay here for drivers.
- **Plan-owned files** — never touched.

## Verification
```text
node --experimental-strip-types --test \
  src/lib/vault.test.ts src/lib/bench.test.ts src/lib/swarm.test.ts \
  src/lib/design.test.ts src/lib/diagram.test.ts src/lib/harvest.test.ts \
  src/lib/rt-client.test.ts src/lib/rt-events.test.ts src/lib/rt-ring.test.ts \
  src/lib/watchdog.test.ts src/lib/diagnose.test.ts
# → 242 pass / 0 fail

npx eslint <owned .ts modules>
# → 0 warnings (was 8: vault×4, rt-client×3, harvest×1)
```

## Files touched
- `src/lib/vault.ts`, `src/lib/vault.test.ts`
- `src/lib/rt-client.ts`
- `src/lib/rt-events.ts`, `src/lib/rt-events.test.ts`
- `src/lib/rt-ring.ts`, `src/lib/rt-ring.test.ts`
- `src/lib/harvest.ts`
- `src/lib/diagnose.ts`, `src/lib/diagnose.test.ts`
- `fixes/171_composer_gapfill.md` (this file)
