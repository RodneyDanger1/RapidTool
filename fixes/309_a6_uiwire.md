# fixes/309_a6_uiwire.md — A6 · UI WIRING COMPLETIONS (M4-01 + M4-02 + M4-15 + U1 tail)

> Wave 309 · HEAD `7055994` (clean on entry except a sibling's `M scripts/rapidtool-cli.mjs`).
> Box (sole writer): `src/components/console.tsx` (the mount) + `src/components/pipeline-rail.tsx`
> (mine too) + this log + the parent-directed `fixes/307_u1_uiwiring.md` ledger fill (M4-15).
> Touched once, pin-only: `src/lib/rt-client.test.ts` (M4-02 stall-seed pin; no product code).
> Mandate: BUGS ONLY — wire what exists, additive, never remove a control. No keyed calls. Legs FOREGROUND.
> Sources: `fixes/308_map4_claims.md` (M4-01/02/15) · `fixes/308_bugmap.md` (BUG-308-08, NOTE-308-03,
> §6 FIX-D) · `fixes/308_map5_parent.md` (P-3/P-4) · `fixes/307_u2_pipeline.md` (the rail's handoff).
> (Log opened pre-edit per wave brief — 2026-09-29, A6.)

## 0 — Status board

| Item | Status |
|---|---|
| Early log | DONE (this file) |
| §1 (1) M4-01 — import `PipelineRail` into console.tsx + mount in RunScreen (additive) | DONE — `console.tsx:85` import · `:3218` mount |
| §2 (2) M4-02 — verify the stall-latch render path + correct the claim to the truth | DONE — comment `pipeline-rail.tsx:422-431` · pin `rt-client.test.ts:98-104` · render probe OK |
| §3 (3) `wild.auto` disposition (B3's flag / NOTE-308-03) | DONE — annotated `pipeline-rail.tsx:147-151`; display-only confirmed by grep |
| §4 (4) M4-15 — fill `fixes/307_u1_uiwiring.md`'s evidence ledger (U1 round-1 + this lane) | DONE — addendum + board + ledger |
| §5 (5) UI sweep of touched files (constant/empty-label class) | DONE — no constant-fed label; M4-17 `≈ tok` verified honest |
| §6 (6) Scoped eslint (console + rail) → 0 · typecheck · test pins | DONE — eslint exit 0 · tsc exit 0 · rt-client 14/14 |

## 1 — Recon (byte-verified at HEAD `7055994`, pre-edit)

- **M4-01 mount point.** `console.tsx:3209` `<PhaseProgressRail project={project} />` sits inside
  `RunScreen` (starts :1896) in the linear section stack (:3196 RunStatusPanel → :3207
  PendingFixturesBanner → :3209 PhaseProgressRail → :3211 WildConsole → traces → ScorecardBlock →
  HitlDock → Tabs.Root). The rail's own spec (:380-383) says "Additive sibling of
  `PhaseProgressRail` (mounted after it by the console)" and its header (:30) promises "a 2-line
  import + mount". ⇒ mount = 1 import line + 1 JSX line right after :3209. Nothing replaced.
- **Imports idiom.** `console.tsx:80-81` imports sibling components with explicit `.tsx` extensions
  (`@/components/cmd-palette.tsx`, `@/components/runtime-timeline-pane.tsx`).
- **M4-02 read path (trace).** Writer = `installRtClient`'s heartbeat (`rt-client.ts:528`
  `setStallLatch({ projectId, since, stepElapsedMs, class: "mainthread-stall" })`, only on critical
  lag while a run is busy); reader = `rtSnapshot().ring.stall` (`rt-client.ts:576-589` returns the
  RAW `RtRing` — no projection), read at `pipeline-rail.tsx:419`, rendered at `:476-481`.
  `StallLatch` (`rt-ring.ts:31-36`) carries exactly the fields the rail renders
  (projectId/since/stepElapsedMs/class). `peekStall` (`rt-client.ts:351`) consumers =
  `rt-client.test.ts` only. Note: `clearStall` also has no non-test consumer (latch is
  set-on-critical, cleared only by reload) — recorded for the parent, not fixed here.
- **`wild.auto`.** Repo-wide grep (`src/` + `scripts/`, today) = ONE hit — `pipeline-rail.tsx:145`
  (the now-line's wild-fallback display row). `grep "wild.auto" src/lib/rt-events.ts` = 0; never
  passed to `reportRt`. ⇒ display-only; annotate the line (NOTE-308-03 was right; parent P-3's
  "unregistered emit" was the census conflation).
- **console.tsx reportRt sites (3).** `sys.heartbeat` (:1183) · `wild.step_timeout` (:1195) ·
  `ui.pane_crash` (:1665) — all ∈ `RT_EVENT_NAMES` (rt-events.ts:135/:155/:145). ✅
- **M4-17 sweep hit (`console.tsx:3379/:3408`).** `≈{tokenEst.tokensEst} tok` label — estimator is
  `estimateTokens` (algorithms.ts:1135, gpt-tokenizer `encode().length`, pinned in
  algorithms.test.ts:641-693); label carries the estimate marker `≈` next to the byte-true
  `{project.packet.length} chars`. VERIFIED CLEAN — honest estimate, not a constant.

## 2 — Ledger (append-only)

- **(t0) open** — log landed BEFORE edits; recon read: 308_map4_claims M4-01/02/15 + 308_bugmap
  BUG-308-08/NOTE-308-03/FIX-D routing + 307_u2 handoff + rail source + console mount region.
- **(t1) M4-01 landed.** `console.tsx:85` — `import { PipelineRail } from "@/components/pipeline-rail.tsx";`
  + `console.tsx:3218` — `<PipelineRail project={project} />` in RunScreen right after
  `<PhaseProgressRail project={project} />` (a comment block cites the row; both inserted, nothing
  removed/renamed — `git diff` for this file is insertions only). `grep -rn "PipelineRail" src/`
  → 3 hits (decl + import + mount; pre-edit: 1).
- **(t2) M4-02 settled + proven.** Comment rewritten at `pipeline-rail.tsx:422-431` (was "First real
  reader" while unmounted — false at delivery, zero readers; now precise: first *continuous*
  app-surface reader, holds from the 309 mount; reads `snap.ring.stall` — the raw RtRing — not
  `peekStall()`; names the writer `rt-client.ts:528`; notes the click-only `buildClientDiagnosis`
  read at rt-client.ts:663). Proof stack:
  (a) **read-path pin** — `rt-client.test.ts:98-104` asserts `rtSnapshot().ring.stall` carries the
  seeded latch field-for-field and empties on `clearStall`;
  (b) **render proof** — scratch probe `~/a6_scratch/probe_a6_render.mjs` (vite `ssrLoadModule` +
  `renderToStaticMarkup(PipelineRail, { project })`, latch seeded via `setStallLatch`) → `A6_RENDER_PROBE_OK`;
  markup carries `Stalled · mainthread-stall · step 4321ms · since 12s ago · p-a6`; after
  `clearStall()` the row is gone; the idle now-line renders its honest text. Re-run from repo root:
  `cp ~/a6_scratch/probe_a6_render.mjs . && node probe_a6_render.mjs && rm probe_a6_render.mjs`.
  (c) mount compiled: `npm run typecheck` exit 0.
- **(t3) `wild.auto` annotated.** `pipeline-rail.tsx:147-151` — display-only note in place.
  Grep evidence this session: `grep -rn "wild.auto" src/ scripts/` → 1 hit (the display row itself);
  `grep "wild.auto" src/lib/rt-events.ts` → 0. No registry write — correct per NOTE-308-03.
- **(t4) M4-15 filled.** `fixes/307_u1_uiwiring.md` — addendum, board re-derived, U1's round-1
  findings (handlers resolve · no dead state · growth.counts) re-verified from machine evidence,
  this lane's tail appended. Sections U1 never staked are marked NOT EVIDENCED, not guessed.
- **(t5) UI sweep (touched files).** Targeted greps over `console.tsx` + `pipeline-rail.tsx` for
  the constant/empty-label class (`{0}` literal renders, `0 rows|files|tokens` prose, `""` labels,
  `: 0}` display fallbacks): no constant-fed label found — every reviewed label reads a real
  field or an honest conditional. M4-17 (`≈ tok`, console.tsx:2703/3388 post-edit) verified honest
  at the estimator: `estimateTokens` (algorithms.ts:1135, gpt-tokenizer `encode().length`,
  pinned in algorithms.test.ts:641-693) and the label carries the `≈` estimate marker.
  Rail labels all read project state (done/total/pct, status words, now-line, attention, park, stall).
- **(t6) Gates.** `npx eslint src/components/console.tsx src/components/pipeline-rail.tsx
  src/lib/rt-client.test.ts` → exit 0 · `npm run typecheck` → exit 0 ·
  `node --experimental-strip-types --test src/lib/rt-client.test.ts` → 14/14 pass.
- **(t7) Observations — NOT fixed this lane (out of the A6 brief; for the parent/FIX-D).**
  (a) `clearStall` still has no non-test consumer (`rt-client.ts:355` def; grep = tests only):
  once the heartbeat sets a critical-lag latch it stays for the page session, so the rail's stall
  row can outlive the stall until reload.
  (b) The rail's "Parked" renders gate on `park !== null`, not `wr.pause === true`; `stopWildRun`
  (store.ts:1281-1288) and `toggleWildPause` (store.ts:1289-1295) both leave `park` in place ⇒ the
  stale-park render B-08 flagged (pipeline-rail.tsx:474-490 / detail block :329-360). Coupled to
  FIX-A's hydrate fix — deferred, not touched.
- **(t8) committed** — one scoped commit on `main`, the 5 A6 files (`git log --oneline --grep "309 A6"`
  finds it). Deletions in it are REPLACED text only: the false stall comment (−3) + U1's stub TODO
  rows (−8) — no control removed. Sibling edits (cli.mjs, rt-*, store, packet, scaffold, run-eval…)
  left untouched/unstaged.
