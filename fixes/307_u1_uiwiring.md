# fixes/307_u1_uiwiring.md — U1 · UI WIRING SWEEP (console.tsx + panes)

> Wave 307 · U-lane. HEAD `84784b5` (F-wave rewrite landed; clean tree at open).
> Box (SOLE writer): `src/components/console.tsx` (+ its child panes `runtime-timeline-pane.tsx`,
> `cmd-palette.tsx`, `preview-host-bridge.tsx` — verify ownership via git status before each edit).
> Mandate: BUGS / NON-WIRED / PARTIALLY-DONE ONLY — no new features, no mock/fake; real wiring or
> honest disabled+reason. No keyed calls. Legs FOREGROUND. Evidence per fix: file:line → bug → patch.
> (Log opened pre-edit per wave brief — 2026-09-29, U1.)

## 0 — Status board

| Item | Status |
|---|---|
| Early log | DONE (this file) |
| §1 Handler/callback targets exist (re-verify G1's 5 + find new) | IN PROGRESS |
| §2 Labels/values read REAL fields | TODO |
| §3 Disabled states that never lift | TODO |
| §4 reportRt emits ↔ registry membership (both directions) | TODO |
| §5 Pane props ↔ what parents pass | TODO |
| §6 F2 rail/now-line build (only if §1-5 fully green) | TODO |
| §7 Evidence ledger | TODO |
| §8 eslint console.tsx → 0 | TODO |

## 1 — Evidence ledger (append-only: file:line → bug → patch)

- (t0) log opened; reading F2/F4/B1 sibling specs + console.tsx at HEAD.
