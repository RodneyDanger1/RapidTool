# W27 · R2 — audit: state / persistence / gates / packet (lane log)

**Lane:** R2 · **Wave:** W27 mass investigation · **Brief:** `wave_plans/W27/mass-investigation.md` §R2
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD at start:** e3d3fe4
**Slice (box):** `src/lib/store.ts`, `src/lib/io.ts`, `src/lib/packet.ts`, `src/lib/dod.ts` (+ their tests) + gates-adjacent engine code they call.
**Deliverable:** §R2 findings + coder-ready fix specs appended to `research/multiagent/thoroughanalysis.md` via the end-marker protocol (above `<!-- END-OF-FILE-MARKER-W25 … -->`).
**Rules observed:** append-only, re-read before every append, no keyed calls, no full-gate runs, NO product edits.

## Status
- [x] Brief read (`wave_plans/W27/mass-investigation.md` in full)
- [x] Shared logs read: `thoroughanalysis.md` (protocol, mission, A1–A4, C1–C6) + `thoroughaction.md` + `fixes/263_index.md` + AGENTS.md
- [x] Code read IN FULL: packet.ts (993 L) · io.ts (516 L) · store.ts (1765 L) · dod.ts (1057 L) + the engine persistence layer they call (`hydrateProject` 2107–2539, `attachAlgorithms` 1193–1222, `stampPacket` 373–375, `wellFormedDecisionRow` 2021–2037) + test pins (`store.test.ts` · `io.test.ts` · `packet.test.ts` · `gates.test.ts` greps)
- [x] §R2 append LANDED via the end-marker protocol
- [x] Final summary

## Targets from the brief (hunt list)
1. **C1-f01** — unguarded date render (`packet.ts:484`) → RangeError → whole-store-wipe class. *Spec the clamp/guard fix.*
2. **C1-f02** — missing 174-1 in-flight guard in `runUntilHitlAsync` (`store.ts:1345-1351`).
3. **C1-f04** — io↔hydrate validator divergence (`io.ts:247-262` vs `engine.ts:2290-2301`).
4. **C1-f05** — prose-coupled gate criteria (`dod.ts:114`, `via.reason.includes(" — ")`).
5. **C1-f06** — defensive-posture inconsistency (`packet.ts:465,483,531` vs `dod.ts:866-868`).
6. **C1-f10 / four-way duplication** — `store.ts:415-478 / 604-661 / 1201-1259 / 1300-1356` near-identical transition/stop-reason impls → spec a safe consolidation with pins.
7. Every validator divergence (io↔hydrate↔dod), every silent path that should carry a coded row.

## Findings register (mirror of §R2 append; coder-ready specs live in the shared log)
**R2-f01 · P1 · C1-f01 confirmed + widened — unguarded date render is a live whole-store-wipe vector; the sibling clamp is upper-bound-only.**
- `packet.ts:484` `new Date(d.decidedAt).toISOString()` unguarded; `packet.ts:213-214` clamps only the TOP (`Math.min(latest, 8.64e15)`) — `-1e300` passes `Number.isFinite` and throws too. Node proof run today: `new Date(1e300).toISOString()` → `RangeError: Invalid time value`; `new Date(Infinity)` same.
- Row guard `engine.ts:2021-2037 wellFormedDecisionRow` accepts any `typeof decidedAt === "number"` (NaN/±Infinity/±1e300 ride through hydrate, `engine.ts:2203`).
- Chain: persist reload → `store.ts:1733-1744 seedIfEmpty` `.map(hydrateProject)` → repair/mining path `engine.ts:2538 → 1193-1222 attachAlgorithms → compileAgentPacket` (no try/catch anywhere) → `store.ts:850-857 onRehydrateStorage catch → 812-815 recoverFromCorruptPersistence` sets `projects: []` + demo seed → persist write overwrites the blob. Same throw escapes `execute/approve/refreshPacket` (no try/catch) → UI crash.
- Fix: `isoFromMs` clamp helper in packet.ts (both call sites) + `Number.isFinite` in wellFormedDecisionRow + RED pins (packet.test.ts hostile stamp; store.test.ts no-wipe regression).

**R2-f02 · P1 · C1-f02 confirmed + widened — the 174-1 wild-run guard exists in executeAsync alone; six sibling async commits clobber an in-flight wild run.**
- Guard: `store.ts:1291-1294`. Missing at `runUntilHitlAsync` commit `store.ts:1345-1351`; also `deepenResearch :874-876`, `runVerifyAsync :905-907`, `runP6Journey :952-956`, `runModuleReal :1399-1405`, `rejectAsync :1615-1621`. `rebaseUserFields` excludes wildRun by design (`:243-245, :256-258`), so a stale snapshot reverts start/stop/pause mid-flight. Only the driver's `commitWild` (:1084-1095) may own wildRun.
- Fix: `keepLiveWildRun()` helper + apply at the 6 sites (executeAsync refactored onto it); do not touch commitWild. Pins: RED first (paused active run survives runUntilHitlAsync settle).

**R2-f03 · P1 · Validator divergence io ↔ hydrate — crew/oracle/chatLog row junk filtered only on import (reload keeps it → packet throws → same wipe class); scorecard predicate disagrees both directions; url-less research items kept by io, dropped by hydrate.**
- `engine.ts:2238, 2405-2406` keep rows raw (no filter); `io.ts:213, :217, :221` filter (io.test.ts:490-593 pins). Renders: `packet.ts:526-528` (c.role…), `:535` (t.name…). Scorecard: `io.ts:247-262` vs `engine.ts:2290-2301`; direction A `{overall:"8"}` io keeps / engine drops; direction B `{overall:8, axes:[null,good]}` io path keeps (filters first) / reload path drops. Research: `io.ts:197-199` vs `engine.ts:2257-2259`.
- Fix: move the row filters into hydrateProject (+ loud row tokens), export ONE `scorecardUsable` predicate used by both, single research-item predicate; parity pins import vs hydrate.

**R2-f04 · P2 · C1-f05 confirmed — dod.ts:114 hard-requires the literal " — " in via.reason (policy prose); cosmetic builder edits flip legitimate approvals to FAIL (fail-closed); unpinned (gates.test.ts has 0 hits).**
- Writers: `policy.ts:235/:262/:265` under the documented contract `:32-33`; mint: `headless.ts:787+`, `:901`; consumers: `dod.ts:530-533, 542-545, 682-685, 694-697`.
- Fix: export `POLICY_REASON_SEPARATOR` (or `reasonHasIdAndClause`) from policy.ts; build + check from it; add the missing pin.

**R2-f05 · P2 · C1-f06 confirmed — packet.ts renders assume a hydrated project while dod.ts:866-868 defends hand-built shapes (clean no-op).**
- Unguarded: `packet.ts:465` (a.body.length), `:483+531` (decisions/e.fields .map), `:666` (scorecard .map/.join), `:526-528/:535` (crew/oracle field reads), `:605` loose `lastTest.ok` (renders "pass" for `{ok:"yes"}` while p6-test requires `ok === true`).
- Fix: local `str()/rows()` coercion helpers routed through the six sites; strict `ok === true`; minimal-shape + junk-row pins.

**R2-f06 · P2 · C1-f10 confirmed — the four-way duplication plus a third hard-DoD copy and a fifth copy the brief did not name (store.recordGate vs dod.recordGateInto).**
- `advanceOnce 415-478` ≈ `advanceOnceAsync 604-661`; `runUntilHitl 1201-1259` ≈ `runUntilHitlAsync 1300-1356` (stop-reason ladder duplicated `:1220-1228` vs `:1318-1326`); `runReady 480-498` ≈ `runReadyAsync 582-601`; hard-DoD block 3× (`:455-464`, `:638-647`, `:520-529`); `store.recordGate 316-357` ≈ `dod.recordGateInto 865-909` (dod header says the store "can delegate" — it never did; dod's is more defensive).
- Fix: 3 mechanical steps (`decideTransition`, `stopReasonFor`, async loop core) + delegate recordGate; existing pins listed (store.test.ts:478-576, 1057, 1613, 716-740) + new parity matrix pins.

**R2-f07 · P2 · OV-13 gap on the store face — silent live-degrade paths carry no coded row.**
- `store.ts:575-577` bare `catch {}` swallows every `engine.runPhaseAsync` throw (keyed failure reads like keyless); `:1624-1626` bare catch for guidance; `executeAsync`/`runUntilHitlAsync` wrap nothing (a throw rejects the promise instead of the documented envelope); run-result shapes carry no `code` while `startWildRun` codes every refusal.
- Fix: coded `p<phase>.live.degrade` row via `classifyError`, coded guidance-failure row, try/catch → `RT_E_INTERNAL` envelope on both async runners.

## Notes / method
- Re-read `thoroughanalysis.md` immediately before the §R2 append (10 writers share it).
- Every claim carries file:line (read today) or a command's real output.
- No product edits made by this lane; scratch probes (if any) outside the repo.

## Log
- 2026-09-26 ~15:5x: skeleton created; brief + shared logs read; code reading begins.
- 2026-09-26 ~16:15: code reading complete; findings register written; §R2 appended to `research/multiagent/thoroughanalysis.md` via the end-marker protocol (re-read immediately before the append; `old_string` = the exact `END-OF-FILE-MARKER-W25` line; block inserted strictly above it).
- **Append verification (16:1x):** file 371 → 430 lines; `§R2` block at lines 371–429; marker count = 1 and it remains the file's LAST line; no existing section edited; no sibling R-sections present at append time (R2 was first of the W27 lanes to land).
- **§W27-WORKLIST cross-check:** not possible yet — `grep "W27-WORKLIST"` on `thoroughanalysis.md` = 0 hits at 16:15 (the WD-β consolidator has not written it). §R2 findings cite the original C1-fNN ids so the consolidator can merge directly; each finding is self-contained (evidence + fix spec + done-when).
- **Process notes:** one harness-level hardline command block occurred (an inline `sed` + command-substitution one-liner) — recovered by splitting the command; no wave rule breached. No keyed calls, no full-gate runs, no product edits by this lane (the only in-repo writes are this log + the §R2 append, both in-lane).
- **Anchor hygiene:** read-time md5s — `packet.ts 73e52444dc7d7d530cfa18d099d1ff88` · `store.ts 29bd412a5f01fbbe9bb3fdacd9204e85` · `io.ts e3efdfb2533b341e0ec89dfc37b67294` · `dod.ts 1b97f4ebde7576745dffd7d0b73ab458`; HEAD `e3d3fe4`. Re-read those anchors before patching (coders).
