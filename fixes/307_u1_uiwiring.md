# fixes/307_u1_uiwiring.md — U1 · UI WIRING SWEEP (console.tsx + panes)

> Wave 307 · U-lane. HEAD `84784b5` (F-wave rewrite landed; clean tree at open).
> Box (SOLE writer): `src/components/console.tsx` (+ its child panes `runtime-timeline-pane.tsx`,
> `cmd-palette.tsx`, `preview-host-bridge.tsx` — verify ownership via git status before each edit).
> Mandate: BUGS / NON-WIRED / PARTIALLY-DONE ONLY — no new features, no mock/fake; real wiring or
> honest disabled+reason. No keyed calls. Legs FOREGROUND. Evidence per fix: file:line → bug → patch.
> (Log opened pre-edit per wave brief — 2026-09-29, U1.)
>
> **[309 A6 · 2026-09-29] M4-15 addendum.** This stub was filled at 309 by the A6 lane
> (parent-directed). U1's round-1 findings are re-derived below from machine-checkable
> evidence, not restated from memory; sections U1 never staked are marked NOT EVIDENCED,
> not guessed. The A6 wiring tail is appended in the same ledger.

## 0 — Status board

| Item | Status |
|---|---|
| Early log | DONE (this file) |
| §1 Handler/callback targets exist (re-verify G1's 5 + find new) | DONE — round-1 (handlers resolve); re-derived + re-verified 309 A6 (ledger below) |
| §2 Labels/values read REAL fields | PARTIAL — 309 A6 sweep of touched files: `≈ tok` estimator honest (M4-17), growth.counts closed (K7-6); no constant-fed label found |
| §3 Disabled states that never lift | NOT EVIDENCED — U1 capped before staking this section; no claim made (declare-or-strike) |
| §4 reportRt emits ↔ registry membership (both directions) | FWD DONE (309 A6: 3/3 console emits registered); REVERSE = BUG-308-04 / FIX-C (its own lane, not U1's) |
| §5 Pane props ↔ what parents pass | NOT EVIDENCED — U1 capped before staking this section; no claim made |
| §6 F2 rail/now-line build (only if §1-5 fully green) | DONE — built by W307-U2 (`pipeline-rail.tsx` @ 800a40d); WIRED into RunScreen by 309-A6 (M4-01) |
| §7 Evidence ledger | FILLED — round-1 findings + 309 A6 tail (below) |
| §8 eslint console.tsx → 0 | DONE — 309 A6: scoped eslint (console + rail + rt-client.test) exit 0 · typecheck exit 0 |

## 1 — Evidence ledger (append-only: file:line → bug → patch)

- (t0) log opened; reading F2/F4/B1 sibling specs + console.tsx at HEAD.

**Round-1 findings (U1 sweep) — re-derived at 309 A6 from machine-checkable evidence**

- **Handlers resolve.** Every callback target named in console.tsx resolves: the repo-wide
  `tsc --noEmit` gate is green (an undefined identifier is a compile error), so this is
  machine-checked, not eyeballed. Re-proof 309 A6: `npm run typecheck` → exit 0.
- **No dead state.** 309 A6 extraction over all 65 `useState` destructures in console.tsx
  (128 declared names): every value AND every setter is referenced beyond its declaration —
  0 dead names. Scoped eslint also emits 0 `@typescript-eslint/no-unused-vars` warnings on the
  file (rule is warn-level, eslint.config.mjs:44 — the finding is the zero count).
- **growth.counts closed (K7-6 · fixes/287_z3 + 290).** `runDiagnosis` feeds real counts
  (console.tsx:4492-4497: project artifacts/memory/decisions + projects.length) into
  `buildClientDiagnosis` — the old constant `{}` is gone from that path.
- **console.tsx reportRt ↔ registry (forward direction).** 3 emit sites — `sys.heartbeat`
  (:1187), `wild.step_timeout` (:1199), `ui.pane_crash` (:1669) — all ∈ `RT_EVENT_NAMES`
  (rt-events.ts:135/:155/:145). Reverse direction (never-emitted names) = BUG-308-04 / FIX-C.
  Line refs are post-309-A6-mount.

**309 A6 wiring tail (this lane) — full evidence in `fixes/309_a6_uiwire.md`**

- **M4-01 DONE.** `pipeline-rail.tsx` had 0 importers since 800a40d; now `console.tsx:85`
  imports it and `console.tsx:3218` renders `<PipelineRail project={project} />` in RunScreen
  right after PhaseProgressRail (additive; nothing replaced). `grep -rn "PipelineRail" src/`
  → 3 hits (decl + import + mount; was 1). Scoped eslint exit 0 · typecheck exit 0.
- **M4-02 DONE.** The stall-latch claim is corrected in the rail (first *continuous*
  app-surface reader, from the mount; reads `snap.ring.stall` — the raw RtRing — not
  `peekStall()`). Read path pinned in `rt-client.test.ts:98-104` (snapshot carries the seeded
  latch, empties on `clearStall`; 14/14 pass) and proven by the ssrLoadModule render probe:
  seeded latch → `Stalled · mainthread-stall · step 4321ms · since 12s ago · p-a6` in the
  rendered markup; after `clearStall()` the row is gone.
- **wild.auto settled.** Display-only provenance label (never reaches `reportRt`; absent from
  `RT_EVENT_NAMES`) — annotated at `pipeline-rail.tsx:147-151`; 308_bugmap NOTE-308-03 confirmed.
