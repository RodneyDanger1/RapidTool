# 290 — K1 components/routes sweep (B1's payout: `src/components/**` minus console.tsx + `src/routes/**`)

Lane: K1 (finishing B1's sweep — B1 died mid-work, W39). Started: 2026-09-27.
Read fresh by siblings. Log `for <lane>` instead of colliding.

## B1 handoff state (from `fixes/288_b1_components.md` + its transcript `deleg_5f2a88c4/task-0.log`)

- B1 read everything (components + routes + the lib contracts they wire to), verified routes/theme/nav
  wiring, **found a real bug** — `rtSnapshot().tail` is newest-first (`rtTail` reverses), `parseTimeline`
  pairs in line order → every completed span mispaired ("no matching start" + fabricated "still
  running") — proved it with `scratch_b1_timeline_probe.mjs`, and landed 3 patches in
  `runtime-timeline-pane.tsx` (duration rounding, unmount timer cleanup, chronological re-feed)
  before dying at 00:21:27 mid-4th-patch. Its log stayed a 411 B skeleton; those 3 patches were
  committed in `2fa3cd9`.
- Never swept: `cmd-palette.tsx`, `preview-host-bridge.tsx`, `__root.tsx`, `index.tsx`,
  `run.$id.tsx`. Also committed: a root-level scratch probe + a lint warning at
  `runtime-timeline-pane.tsx:111`. K1 continues from there.

## Findings (append-only)

### F1 — newest-first ring feed fabricates pair state (B1's finding — verified, evidence preserved)
`rtTail()` returns newest-first (`slice(-n).reverse()`); the pane fed it straight to `parseTimeline`,
which pairs `*_start` with terminals **in line order**, so a start row arrives *after* its terminal:
terminal renders "no matching start", start renders "still running — no finish in the ring yet", no
duration is ever computed. Fix landed in `runtime-timeline-pane.tsx:127` (feed oldest-first via
`[...snap.tail].reverse()`; the raw ring list above stays newest-first, unchanged). Probe evidence
rescued from repo root into `fixes/290_k1_timeline_probe.mjs` (same program + a K1 addendum that
prints the F3 paired-count old-vs-fixed; import path rebased; run from repo root:
`node --experimental-strip-types fixes/290_k1_timeline_probe.mjs`).

### F2 — copy-flash timer ref was never assigned → unmount cleanup was dead code
`runtime-timeline-pane.tsx` read `copyFlashRef.current` in an unmount cleanup, but nothing in the
file ever **wrote** the ref — B1 landed the cleanup without the assignment it depends on. So the
"pending flash can never fire into an unmounted pane" claim was false on disk, a mid-flash
re-copy had its flash truncated by the older timer, and react-hooks flagged the read-only ref
(`:111` "ref value will likely have changed…" — the rule only fires for refs with **no** `.current`
assignment). Fixed in §Fix-1.

### F3 — "paired" badge double-counted every span
`paired` counted rows with `durationMs !== null`; `parseTimeline` stamps duration on **both** ends
of a pair, so one completed span displayed as "2 paired", while a pair whose `ts` is missing (no
duration possible) wasn't counted at all — and the header contradicted the panel's own
"completed 1". Fixed in §Fix-2.

### F4 — doc drift: `__root.tsx` called a `useEffect` a "layout effect"
Stale mechanism claim (declare-or-strike hygiene, comment-only). Fixed in §Fix-4.

---

## Fix log (append-only)

| # | file:line | bug | patch | evidence |
|---|---|---|---|---|
| 1 | `src/components/runtime-timeline-pane.tsx:109-118` + `:135-146` (F2) | `copyFlashRef` never assigned → unmount cleanup dead; re-copy mid-flash cut short; committed lint warning at `:111` | `flashCopied` now clears any pending flash, stores the new `setTimeout` id in the ref, and nulls it when it fires (unmount cleanup becomes real) | `npx eslint src/components/runtime-timeline-pane.tsx` → **0 problems, exit 0** (was `111:75 warning react-hooks/exhaustive-deps`); rule internals confirm: it warns only when no `.current` assignment exists (eslint-plugin-react-hooks 5.2.0, "foundCurrentAssignment") |
| 2 | `src/components/runtime-timeline-pane.tsx:159` + badge `:177` (F3) | `paired` doubled every span (both ends carry `durationMs`) and missed ts-less pairs | count closed spans (`closes !== null` — one terminal = one pair); label now `pair`/`pairs` | probe addendum on the 2-row/1-span feed: OLD `{newestFirst:0, chronological:2}`, FIXED `{newestFirst:0, chronological:1}` — matches the pane predicate; header now says "1 pair" against panel "completed 1" (was "2 paired") |
| 3 | `src/components/runtime-timeline-pane.tsx:127` (F1 ref) | comment cited `fixes/288_b1_components.md §F1` — a section B1 died before writing (unresolvable doc ref) | repointed to `fixes/290_k1_components.md §F1` | `grep -rn "288_b1" src/` → none left |
| 4 | `src/routes/__root.tsx:16-18` (F4) | docblock called `TelemetryBoot`'s effect a "layout effect" while the code is `useEffect` | reworded to "mount effect" + one-line note | current docblock read back |
| 5 | `scratch_b1_timeline_probe.mjs` → `fixes/290_k1_timeline_probe.mjs` | repo-root scratch file committed by accident at `2fa3cd9` — but it is real evidence (proves F1), referenced by the pane's fix comment | `git mv` under `fixes/`; header documents origin + run command; import rebased to `../src/lib/rt-timeline.ts` | ran from repo root: newest-first feed still shows `closes=null closedBy=null dur=null` + `openSpans:1`; chronological shows `closedBy=2 dur=500` + `openSpans:0`; `npx eslint` on it → clean |

## Wire checks (verified fresh, read-only)

- **exports→importers**: `PreviewHostBridge` (`__root.tsx:8` → mounted `:81`), `CmdPalette`/`CmdPaletteEntry`
  (`console.tsx:80` → mounted `:3575`), `RuntimeTimelinePane` (`console.tsx:81` → mounted `:3463`) — all mounted,
  no orphans. Route `Route` exports ↔ `routeTree.gen.ts` (`/`, `/run/$id` present).
- **props→producers**: `CmdPalette` receives exactly `open`/`onOpenChange`/`entries` (matches its signature);
  `RuntimeTimelinePane`/`PreviewHostBridge` take no props; `run.$id.tsx` passes `key={id} id={id}` matching
  `RunScreen({ id }: { id: string })`.
- **callbacks→handlers**: `onOpenChange={setPaletteOpen}` (state setter, gated by `paletteOpenRef` upstream);
  bridge `navigate` → `router.history.push` after `isSafeBridgePath` validation (lib), router subscribes to
  history so SPA nav lands.
- **palette data** (read-only check of console's producer): ids unique — 11 manual (`approve`, `run-until`,
  `copy-packet`, `download-packet`, `copy-project-json`, `download-json`, `copy-handoff`, `settings`,
  `shortcuts`, `report`) + `tab-${t.id}` ×12 → no React key collisions; every non-null `verb` chip
  (`approve`/`gate`/`packet`/`export`/`ingest`) exists in `scripts/rapidtool-cli.mjs`'s case list; null verbs
  render "console only" (no invented verbs).
- **pane pipeline**: `rtSnapshot().tail` = `rtTail` = `slice(-n).reverse()` newest-first (`rt-ring.ts:239`);
  pane reverses before `parseTimeline` → line-order pairing correct; `durationMs` on both ends
  (`rt-timeline.ts:235-240`) is why F3's old count doubled.
- **bridge lifecycle**: `installPreviewHostBridge` returns a dispose fn (`preview-host-bridge.ts:240-246`) and a
  no-op dispose when not embedded (`:66`, `:78`) → `useEffect` return contract correct; listeners + patched
  `pushState`/`replaceState` restored on dispose.
- **clean re-pass** of the files B1 never swept: `cmd-palette.tsx` (grouping memo, id/key uniqueness, no
  state/effects/listeners — only rendering + dispatch), `preview-host-bridge.tsx`, `index.tsx`, `run.$id.tsx`:
  no real bugs found; scoped `npx eslint` on the whole box → **0 problems** after fixes.

## Lane notes
- **Fresh evidence battery at close:** scoped `node --experimental-strip-types --test src/lib/rt-timeline.test.ts
  src/lib/rt-ring.test.ts src/lib/preview-host-bridge.test.ts` → **53/53 pass, 0 fail, 0 skipped** (same
  runner/flags as the `npm test` src leg, scoped to the modules this box wires to); scoped `npx eslint` on the
  three changed paths → 0 problems; `node --experimental-strip-types fixes/290_k1_timeline_probe.mjs` → exit 0
  (F1 + F3 output as quoted in the fix rows). Full gates (`npm test` both legs / `typecheck` / repo `lint` /
  `hermes verify`) intentionally **not** run here: lane boundary + AGENTS.md's "never run the full gate while
  agents are mid-edit" (siblings K1–K9/L1–L2/W1–W5 live in `src/lib/**`); the parent owns the boundary gate.
- No tests exist that touch these components/routes (verified: none in the repo's test inventory; the only
  script-side mention, `scripts/brand-check.test.mjs:146-150`, writes a `src/routes/__root.tsx` **fixture
  inside its own temp workspace** and never reads this repo's file — my wording edit is invisible to it).
  Scoped eslint was the targeted check; full gates are the parent's boundary.
- Files touched by K1: `src/components/runtime-timeline-pane.tsx`, `src/routes/__root.tsx`,
  `fixes/290_k1_components.md` (new), `fixes/288_b1_components.md` (pointer appended),
  `fixes/290_k1_timeline_probe.mjs` (moved from repo root). `console.tsx` deliberately untouched.
- **Verifier loop — W4 D1 closed.** `fixes/292_w4_jobs.md` checked mid-flight and found the F1
  "rescued" sentence not yet true (the `git mv` landed after its check — fair catch: the claim was
  written early with the log). Closing state, re-verified on disk: `fixes/290_k1_timeline_probe.mjs`
  exists (1631 B), the root file is gone, `git status` shows
  `RM scratch_b1_timeline_probe.mjs -> fixes/290_k1_timeline_probe.mjs`, and the probe runs +
  lints clean from the repo root. (W3's `fixes/292_w3_codequality.md` F5 cites this relocation as
  precedent for K9's `probe-k9-kinds.mjs` — noted for the parent at close.)
