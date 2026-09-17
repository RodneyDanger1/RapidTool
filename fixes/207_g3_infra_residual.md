# 207 G3 — infra residual (token-ledger / write-set / sandbox-policy / brief-fixtures)

Lane: G3 residual of 194 / 198 / 199. Owned files only. Incremental.

## Scope

- `src/lib/token-ledger.ts` + `token-ledger.test.ts`
- `src/lib/write-set.ts` + `write-set.test.ts`
- `src/lib/sandbox-policy.ts` + `sandbox-policy.test.ts`
- `src/lib/brief-fixtures.ts` + `brief-fixtures.test.ts`
- `fixes/207_g3_infra_residual.md` (this log)

**Do not touch:** headless / store / engine / CLI / chat / wild-mode / codegen / packet / types.

## Status

LANDED. Owned suite green (see Verification).

## Findings + fixes

### 1. token-ledger — unmetered path is a true no-op (194 / 199)

**Residual:** Cap parsing lived only on the parent codegen seam; the library had no
`RAPIDTOOL_TOKEN_CAP` reader, and post-add exhaust (`>` land-on-cap ok) was not a
first-class helper (callers re-implemented `>` vs `>=` inconsistently).

**Landed:**

| API | Behavior |
|---|---|
| `tokenCapFromEnv(env?)` | unset / blank / `0` / NaN / negative → `undefined` (unmetered) |
| `isUnmetered(cap)` | true when no positive finite cap |
| `wouldExceed` / `assertWithinBudget` | unmetered → never throw / never true |
| `recordSpendWithinCap` | record then throw only when total **exceeds** cap (`>`); landing on cap ok |
| `assertWithinBudget` | pre-call gate: spent already `>=` cap → exhausted for the *next* call |
| `recordSpend(null\|undefined)` | still a no-op (does not bump `calls`) |

No `Project.tokenCap` (types.ts is parent). Parent codegen keeps its own
`p6TokenCapFromEnv` until a later shared import.

### 2. write-set — emit rollback + path safety (198 / 174-F8)

**Residual:** Library restored bytes correctly one path at a time, but (a) relative
`..` / absolute paths could escape the root, (b) multi-file emit had no batch helper
that auto-rolled back on a mid-set throw (parent headless catch is still required for
O_EXCL flock + ghost wipe).

**Landed:**

- `assertSafeRelPath` — refuses absolute paths, null bytes, and any `..` segment
- `absOf` defense-in-depth: resolved path must stay under root
- `applyWrites(root, files, snapshot?)` — snapshot all first, write in order, on any
  throw **rollback the full snapshot and rethrow** (partial trees do not survive)
- `rollback` walks reverse insertion order

O_EXCL `.rapidtool-emit.lock` + ghost wipe remain parent/`headless.emitProject`
(out of ownership). This library is still **not** a sandbox.

### 3. sandbox-policy — always advertise non-sandbox (199)

**Residual:** Claim was honest but mutable and there was no coerce path for untrusted
input that might carry `sandbox: true`.

**Landed:**

- Frozen singleton claim (`Object.freeze`)
- `coerceIsolationClaim(raw?)` — **always** returns the honest claim; ignores hostile
  `sandbox/docker/bwrap: true`
- `isHonestIsolationClaim(raw)` — shape guard (false for `sandbox: true`)

`packet.ts` / `sandbox.ts` still emit legacy `isolated: true` on the project sandbox
object — **parent residual**, not owned here.

### 4. brief-fixtures — never mint `decidedBy:"human"` from agent (184 hole)

**Residual:** `approveFixtureCases` flipped `approval:"approved"` with no provenance.
An agent could treat that as a human act. Draft paths never set a decidedBy field.

**Landed:**

- Optional `decidedBy?: "human" | "autopilot"` on `BriefFixtureCase`
- Draft / `draftTypedLiterals` / `draftBriefFixtures` **never** set `decidedBy`
- `approveFixtureCases(cases, ids, opts?)`:
  - opts omitted → approve **without** stamping `decidedBy` (no default `"human"`)
  - strips any forged prior `decidedBy` unless opts re-stamps
  - `opts.decidedBy: "human" | "autopilot"` only when explicit
  - invalid decidedBy throws
- `coerceAcceptanceFixtures` copies decidedBy only when enum-valid; never invents
  `"human"`
- `validateFixtureCase` rejects unknown decidedBy values

CLI `fixtures --approve` still calls without opts (out of ownership) — approval
flips, provenance stays absent until parent wires `{ decidedBy: "human" }` behind
`--i-am-human` / TTY. Gate still keys on `approval === "approved"` only.

## Verification

```text
node --experimental-strip-types --test \
  src/lib/token-ledger.test.ts \
  src/lib/write-set.test.ts \
  src/lib/sandbox-policy.test.ts \
  src/lib/brief-fixtures.test.ts
# pass (owned suite green, 0 fail)
```

Full `npm test` **not** run (per task). No keyed eval `--all`. No live DeepSeek burns.

## Files touched

| File | Action |
|------|--------|
| `src/lib/token-ledger.ts` | `tokenCapFromEnv` / `isUnmetered` / `recordSpendWithinCap` |
| `src/lib/token-ledger.test.ts` | unmetered + cap-land + env parse pins |
| `src/lib/write-set.ts` | path escape refuse + `applyWrites` auto-rollback |
| `src/lib/write-set.test.ts` | escape + batch rollback pins |
| `src/lib/sandbox-policy.ts` | freeze + coerce + honesty guard |
| `src/lib/sandbox-policy.test.ts` | hostile coerce pins |
| `src/lib/brief-fixtures.ts` | `decidedBy` provenance; no default human |
| `src/lib/brief-fixtures.test.ts` | draft/approve/coerce decidedBy pins |
| `fixes/207_g3_infra_residual.md` | this log |

## Honest residual holes (could not fix in-lane)

1. **Parent emit flock** — O_EXCL `.rapidtool-emit.lock` + ghost wipe live in
   `headless.emitProject`; library batch rollback is ready but headless still uses
   per-file `applyWrite` in a try/catch (behavior OK today; not switched to
   `applyWrites` without headless ownership).
2. **Parent token wire** — `codegen.server.ts` still owns `p6TokenCapFromEnv` +
   `accountSynthUsage`; other usage-drop sites (chat / verify / prompt-engine /
   vector / algo-tools / harvest) still drop `usage` when uncapped or even when
   capped. No `Project.tokenCap`.
3. **Packet sandbox claim** — `packet.ts` + `sandbox.ts` still advertise
   `isolated: true` / engine-template runner wording. `runnerIsolationClaim()` is
   the honest typed claim; packet does not consume it yet.
4. **CLI fixtures approve** — still `approveFixtureCases(current, ids)` with no
   `decidedBy: "human"`. Provenance stays absent until CLI/headless grow an
   `--i-am-human` / TTY gate (same class as HITL `approve --force`).
5. **Gate does not require decidedBy:human** — `fixtureApprovalGate` still keys only
   on `approval`. Tightening would break CLI approve until parent wires provenance;
   left as intentional residual.
6. **Disk forgery** — a process that writes `project.json` with
   `approval:"approved", decidedBy:"human"` still passes coerce. Pure library cannot
   stop offline forgery; it only refuses to *mint* that shape itself.
7. **Binary write-set** — still utf8 string bodies (emit scaffold is text). Not a
   general FS transaction layer.
