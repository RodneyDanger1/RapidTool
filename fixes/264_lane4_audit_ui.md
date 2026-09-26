# 264 · LANE 4 (W25 · A4) — RAPIDTOOL'S OWN UI/UX + DOCS — audit log

**Lane:** W25 A4 (audit only — NO product edits). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`.
**Shared log:** `research/multiagent/thoroughanalysis.md` §A4 — 11 findings + 2 obsoleted notes APPENDED
2026-09-26 ~15:50 via the end-marker protocol (marker verified intact, all 6 lane sections + A4 text present).
**Mission bar:** truly autonomous software factory with PERFECT UI/UX — plain language (owner hates jargon +
dense UIs), beginner-AND-agent readable, honest limit surfaces.

## Snapshot (every cited file read at these times; churn is real — W24 U1/U2 were editing mid-audit)

| Read time | File | Bytes / lines | md5 at read |
|---|---|---|---|
| 15:35 | src/components/console.tsx | 264 798 / 6369 | `a8c805048e749f8ff0ec3c49a093c86d` |
| 15:38 | src/components/console.tsx | 268 977 / 6441 | `697e7062ac3bd65ecd8aabff0055eb16` |
| 15:40 | src/components/console.tsx | 272 287 / 6506 | `1d865676d14ab42c3a6355e23aa9b310` |
| 15:47 | src/components/console.tsx | 272 342 / 6522 | `fa6aa7965a71b7c8b1afa1c01d36d2db` (pre-final) |
| 15:48 | src/components/console.tsx (FINAL ANCHOR SWEEP) | 6537 | `fa6aa7965a71b7c8b1afa1c01d36d2db` |
| 15:43 | src/routes/__root.tsx | — | `a9111390d2c7608c2089ecf01227d2e5` |
| 15:35 | src/routes/index.tsx | 317 / 13 | `3dee6e700b1979afc9f5de2b0a5c5df9` |
| 15:35→15:42 | README.md | 11 416→11 759 | `f8a85e5eb8f57f2b034da8e39a05b78b` |
| 15:36 | scripts/README-cli.md | 64 525 / 1029 | `b450c5706a4c4edce2b5a46cf79cbd95` |
| 15:35 | AGENT_GUIDE.md | 6 612 / 95 | `d3a3034a5f94a012221e45fcb6d7cf37` |

## Findings (full text in §A4 of the shared log — IDs authoritative there)

- **f01 · HONESTY · P1** — "autonomous software agency" on home tagline (`console.tsx:1643`), `/` page title
  (`index.tsx:7`), meta description (`__root.tsx:41`) vs `doctor` `autonomousSoftwareFactory: false`
  (`doctor.test.ts:28-30`) + README "not yet an autonomous software factory" + in-app Guide "does not build
  software itself". Declare-or-strike violation on every tab.
- **f02 · LABEL vs EFFECT · P2** — `fixtures.server.ts:25-26` (`+fixtures.review.ts:36`) LOAD_LABEL "approving
  here records a decision" shown at `console.tsx:490` while the panel itself (493-497) says nothing can record a
  decision; store has no fixture action. Fix = reword the loader string (outside U1's box).
- **f03 · HONESTY/VOCAB · P2** — "sandbox" user-visible in the override path: `console.tsx:3773` (checkbox),
  `:1503` (SHORTCUTS), `:1965` (error) vs in-file rule `:262` "NEVER sandbox" + README "not a sandbox";
  engine stakes line `engine.ts:801` also says Sandbox (A1's lane).
- **f04 · DOCS vs PRODUCT · P1/P2** — AGENT_GUIDE.md:4-7,:52-54 + in-app Guide (`console.tsx:1421`) "does not
  build software itself" vs README.md:71-74 (P6 chunked synthesis) + :95 (tree-run builds+tests).
- **f05 · AGENT ONBOARDING · P2** — AGENT_GUIDE.md:69 "no … feedback channel" omits the real `ingest` verb
  (CLI `rapidtool-cli.mjs:680`; README-cli.md:80-83,:933) + console Ingest report panel (`console.tsx:2834`,
  `onIngestReport` :2138).
- **f06 · BEGINNER ONBOARDING · P3** — home screen has no Guide/help entry (all `setGuideOpen` occurrences are
  RunScreen: `:1983`, `:2563`); 12-char minimum undisclosed (`:1629` silent return, `:1676` disabled, no hint).
- **f07 · ORGANIZATION/RISK · P3** — `__root.tsx:48` manifest link is served only by legacy scaffolding
  (`server/middleware/grok-pwa.ts:73` prod, `scripts/grok-pwa-plugin.mjs:55` dev; **not** a `public/` file —
  verified `find public -iname "*manifest*"` empty). CORRECTION to my first pass: NOT a 404 — but it is a
  load-bearing dependency on code AGENTS.md declares non-contract (94 §B1 fate undecided).
- **f08 · DOCS CONTRADICTION · P2** — README.md:45 ".env enables LLM-backed phases" (under the CLI quickstart)
  vs README-cli.md:231-233 "the CLI does **not** load .env". Beginner follows README → silent keyless skips.
- **f09 · JARGON · P3** — "Autopilot · extra gates" (`console.tsx:2558`) with no title; semantics
  (store.ts:378-386 `canAutopilot`: auto-approves non-stock/non-forceHuman DoD-passing gates) unexplained at the
  control; label implies more gates, effect is fewer human stops.
- **f10 · UI DRIFT · P3** — Wild paused badge: text uses canonical `pause` (`console.tsx:1298-1299`) but warn
  tint uses legacy `paused` (`:1288`) instead of the file's own `wildPaused()` (`:846`).
- **f11 · DOCS CURRENCY · P2** — TA-15: README.md:108-114 ("lands in **W6**", corpus `reexports: 5`) +
  remainingwaves.md:12,:27,:233 ("TA-15 → W6-L1") vs taskuniverselog.md:466-468 ("wave 8 close — TA-15
  ACCEPTANCE MET … census {0,0,3}"). Also README.md:139-140 "test counts **now** 235/1811" vs header 261/1957.
  COULD-NOT-TRACE: needs one fresh keyless emit + `doctor --tree` (A1/A3 owned) to settle.
- **x01/x02 · OBSOLETED mid-audit, no action** — README "35 verbs"→"37 verbs" fixed by B4 at 15:42; FixturesPanel
  label problem mitigated by U1 at ~15:38 (the loader string in f02 still stands).

## What held up (honesty surfaces that are GOOD — do not "fix")

RunStatusPanel ("What's happening" + ONE next action + verb chip), EnforceDodToggle per-state captions,
ExportSoftwareBlock (says emit is CLI-only + exact command), SettingsDialog (no client-side key field),
RuntimeLogPane ("Honest silence, not a broken tab"), ScorecardBlock caveat mirror, PendingFixturesBanner
(names the one real flip path), packet-truncation banners, `lastTest` caption never claiming provenance it
can't see, cmd-palette verb chips ("console only" where no verb exists), ChatPane no-backend honesty.

## Journey trace (functional, read-only)

open → brief → run → WILD → gates → emit → hand-over: **traced clean** on the code — every visible control
maps to a real store action; no dead buttons found; the tiered tab organization (3 primary + 8 advanced behind
"More panels") is coherent post-U1. Remaining friction is the findings above (jargon labels, help discoverability),
not wiring.

## Deliberately NOT touched / not done

- No product source edits (audit lane); no full-gate runs; no keyed calls; AGENTS.md untouched (read only).
- Browser QA not run (console under active sibling edit — a live pass would have been against a moving tree).
  Tooltip/palette/tab interactions were read, not exercised — say so, don't imply otherwise.
- Did not adjudicate engine internals (A1/A3) or CLI mechanics (A2/C-lanes) beyond call-shape checks.

## Bottom line

The console is in materially better shape than its size suggests — the honesty discipline (truthful empty
states, coded refusals, "no fake pass" surfaces) holds across the journey, and U1's mid-audit fixes landed
live. The real A4 defects are four honesty/doc contradictions a reader would hit on day one: the
**"autonomous software agency" claim** (f01) and the **"it does not build software itself" framing** (f04)
against a doctor that says false and a README that says it does build; the **fixtures label promising an
approval** (f02); and the **.env setup contradiction** (f08). Highest-value fixes, in order: f01 → f04 → f11
(one verified TA-15 census) → f02 → f08. Then the cheap polish: f03 (sandbox wording), f05/f06 (onboarding),
f09/f10 (labels/drift).
