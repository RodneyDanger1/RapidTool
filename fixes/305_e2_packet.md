# 305 · CODER E2 — LANE L2 ROUND 3 (P-7 the F3-10 pin · P-8 verification · tail walk)

> Brief: `wave_plans/W42/SPEC.md` §2 · L2 (cards P-1…P-8). HEAD `0deca1e` (suite 2608/2608; lint 0).
> Round state re-verified fresh: P-1…P-6 DONE (rounds 1-2); P-8 store stamps LANDED in `store.ts` (commit `0deca1e`: `ingestReport` stamp `:1596`, `setNotes` stamp `:1860-1863`) with **no test pin**; P-7 **NOT STARTED** (`grep keepLiveWildRun src/lib/store.test.ts` → 0 at entry).
> Rules honored: PATCH-FIRST · additive pins only (assert MORE, never weaken; `store.test.ts` = L2-only box) · legs FOREGROUND · NO keyed calls · one writer per file · log opened pre-edit · `store.ts` never left modified (temporary red-check restored byte-identical, `git diff --stat src/lib/store.ts` empty).

## Seam bytes read BEFORE writing (P-7)

- helpers: `rebaseUserFields` `store.ts:268-288` (copies `name/notes/createdAt/enforceDod/wildMode/chatLog/kind`; `wildRun` deliberately NOT copied) · `keepLiveWildRun` `store.ts:299-301` (`live?.wildRun?.active === true ? {...committed, wildRun: live.wildRun} : committed` — minimal condition; phase-2 generalization scoped out, do not smuggle).
- seam sites pinned: the `executeAsync` success commit `:1425-1429` and its denial-log twin `:1407-1413` (F3-10 `fixes/293` M2) — both call `keepLiveWildRun(rebaseUserFields(next.project, live), live)`.
- interleave seam: `executeAsync` captures its snapshot at task start, commits after `await advanceOnceAsync(...)`; a `queueMicrotask` right after the call lands in the gap (the same interleave H-01 R1 pins — verified live, not assumed).
- deny branch made deterministic with the existing S2 recipe (`store.test.ts:1061-1091`): `setEnforceDod(true)` → `execute` to P1 → P1 marked complete WITHOUT its graph artifact → leaving fails the p1-graph probe.

## Ledger (card → status → evidence)

| Card | Status | Evidence |
|---|---|---|
| — | log opened pre-edit | this file; HEAD `0deca1e` re-verified; clean tree at entry |
| **P-7** | **DONE** | `store.test.ts` +143 lines: helper `liveWildRunMarker` `:1503` · pin **P-7a** `:1515` (success commit `:1425-1429`) · pin **P-7b** `:1552` (denial twin `:1407-1413`). Asserts MORE: step progress still lands; exact live-run marker re-attached (`deepEqual`, value-distinct so any snapshot-clobber mismatches); mid-flight `notes` + `rename` rebase from LIVE; deny pin also asserts the block artifact + `dod.blocked` log landed (proves the `:1407-1413` branch executed). grep `keepLiveWildRun store.test.ts` → 0 → 4. |
| **P-7 red-check** | **PASS** | temporarily neutralized `store.ts:300` helper (`return committed`), ran `--test-name-pattern="F3-10 P-7"` → **`# pass 0 / # fail 2`** (both pins fail without the helper — the card's Done-when). Restored from byte backup; `git diff --stat src/lib/store.ts` → empty; helper line byte-identical. |
| **P-8 verification** | **DONE (verified + pinned)** | Card names no pin (ends "Evidence line either way") ⇒ recorded + an additive pin was landed anyway (`store.test.ts:1596`): baseline packet notes-free → `setNotes` re-stamps (notes text + `## Operator notes (human steering)` ride the packet; exactly 1 packet artifact) → repeat write still 1 artifact (no accumulation) → `ingestReport` re-stamps (ingest artifact `report-0-0-*` applied + title visible in the compiled packet). Boundary evidence: store leg 74/74 green at `0deca1e`; now 77/77 with the pin. |
| P-1 | DONE (round 2) | `node --experimental-strip-types --check src/lib/packet.ts` → OK (owed by X1, now run); `packetBudgetBoundary` ×3 in packet.ts; `stop_reason` ×6; envelope `budget` key present; packet leg 57/57. |
| P-2 | DONE (round 1) | `grep -c "TODO(F2-07)" src/lib/packet.ts` → 1. |
| P-3 | DONE (round 1) | `grep -c "TODO(F2-09)" src/lib/crew.server.ts` → 1; crew leg 51/51. |
| P-4 | DONE (round 1) | `acceptance: project.acceptance` in `systemJson` → 1; packet leg 57/57. |
| P-5 | DONE (round 2, `0deca1e`) | `RT_E_BUDGET_EXHAUSTED` ×5 in `crew.server.ts` (3 sites + comments); crew 51/51 · planning 16/16. |
| P-6 | DONE (already-landed per D2) | `io.ts` heading-detection guard `:523-536` (2 hits of `Operator notes (human steering)` — check + comment); `io.test.ts:633-651` pins exactly ONE notes block; io leg 55/55. |
| P-8 (stamps) | DONE (`0deca1e`) + pin above | `store.ts:1596` (ingest) + `:1860-1863` (notes) + comments `:1592/:1854`. |

## End-state gates (all foreground, this round)

| Gate | Result |
|---|---|
| `node --experimental-strip-types --test src/lib/store.test.ts` | **77/77** (74 → 77: +P-7a +P-7b +P-8) · 0 fail · 0 skip |
| `node --experimental-strip-types --test src/lib/packet.test.ts` | 57/57 |
| `node --experimental-strip-types --test src/lib/crew.test.ts` | 51/51 |
| `node --experimental-strip-types --test src/lib/io.test.ts` | 55/55 |
| `node --experimental-strip-types --test src/lib/planning.test.ts` | 16/16 (L2-gate complement) |
| `npx eslint src/lib/store.test.ts src/lib/packet.ts src/lib/crew.server.ts src/lib/planning.ts src/lib/io.ts` | **0 problems** (exit 0) |
| `node --experimental-strip-types --check src/lib/packet.ts` | OK |
| `git diff --stat src/lib/store.ts` | empty (red-check fully reverted) |

## §Findings (recorded, NOT fixed here — W43-ENGINE material)

**F-1 · the rebase path leaves the persisted PACKET serving pre-edit notes (race window).**
On BOTH named seam sites, after the stale commit the notes FIELD is fresh but the compiled packet is NOT re-stamped — the live record's fresh `setNotes` compile is replaced by the step's pre-notes compile (`rebaseUserFields` copies `live.notes` but keeps `committed.packet`/artifacts/traces).
- **Probe (byte-backed, taken with temp diagnostics during this round):**
  `[P7-probe-a] packetHasNotes: false | notesField: "steer the crew mid-flight"` (success commit `:1425-1429`)
  `[P7-probe-b] packetHasNotes: false | notesField: "operator steering while the denial commits"` (denial twin `:1407-1413`)
- **Why it matters:** overbroad claim risk — `store.ts:1854-1858` says "the persisted packet (packet pane, export, tree consumers) never serves pre-edit notes"; true on the direct `setNotes` path, false in this window until the next stamp.
- **Blast radius:** all 8 `rebaseUserFields` call sites (`store.ts:984/:1016/:1065/:1413/:1429/:1484/:1538/:1773`).
- **Smallest fix sketch (for the engine lane, needs parity pins):** inside `rebaseUserFields` (`store.ts:268`), when `live.notes !== committed.notes`, return `stampPacket(rebased)` (store.ts already imports `stampPacket`); single site covers all 8 wraps; fires only on divergence (normal single-writer commits have equal notes — no behavior change). Verify against packet `contentKey` inputs (`packet.ts:270-293`) before landing; note A2/A4 trace `ranAt` churn is the same churn `setNotes` already produces.
- **Repro:** `store.test.ts:1515` (P-7a) with a temporary `after.packet.includes(...)` probe (removed from the committed pin; the pin asserts the CARD's contract — fields survive — and remains green).

**F-2 · per-keystroke stamp cost (D2's note, confirmed).** `console.tsx:3527` calls `setNotes` in `onChange`, so every keystroke now rebuilds the packet + A2/A4 traces (`stampPacket`). Behavior is correct per F2-03b; the cost/UX (debounce?) belongs to the parked console lane (§4 W43-CONSOLE) — recorded, no action here.

## Tail walk summary

All 8 L2 cards accounted for: P-1..P-6 DONE (bytes + legs re-verified above), P-7 DONE (this round, red-checked), P-8 DONE + pinned (this round). No L2 card left unlanded or un-struck.
