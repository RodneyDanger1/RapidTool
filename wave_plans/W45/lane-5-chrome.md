# W45 / 331-5 — "Chrome" — console UI + real-browser proof

Read `wave_plans/W45/README.md` first. Your log: `fixes/331_5_chrome.md`.

## Owned files (STRICT)

`src/components/console.tsx` · `src/routes/**` (+ any test colocated with them).

## Mission

Fix the real UI defects the register already located with `file:line`, and **prove every change in a
real browser**. No MCP browser tool exists in this session — **Playwright is installed**
(`node_modules/playwright`, `playwright-core`); the 330 Chrome lane used exactly this, with a harness
outside the repo. Drive `npm run dev` (binds `0.0.0.0:8080`; do not change the host/port contract).

**UI1 (real bug, register R6-f01/R6-f04 + C2-f04) — busy latch missing on `onRunModule`.**
`console.tsx` ≈`:2122-2136`: `onRunModule` sets no in-flight latch, so a double-click fires **two
bounded runs** (real child processes). It is also the only async handler lacking
try/catch/finally. Land a latch + a finally that always clears it, and pin it (a test and/or a
browser proof showing the second click is a no-op while the first is in flight).

**UI2 (register R6-f07) — HomeScreen: unexplained disabled launch.** ≈`:1613-1736`; launch button
disabled at ≈`:1676` when the brief is < 12 chars, silently at ≈`:1629`. Make the disabled state
explain itself (why + what to do), and add a help entry.

**UI3 — sweep the register's remaining located UI rows and land what is real:**
`R6-f13` "Phase n of 13" render (≈`:1723`); `R6-f14` `?? arts[arts.length - 1]` (≈`:6161`) → `?? null`
+ confirm the consumer handles null; `R6-f15` advanced-tier `Tabs.List` a11y
(`aria-controls`/roving tabindex). Verify `R6-f12`'s `PaneBoundary` containment claims still hold
(the 330 lane landed Home/rail/run-center/run-sidebar wraps and a forced-throw harness — re-run it,
do not re-land it).

**UI4 — prove the keyed path in the console once 331-1 lands.** The 330 lane saw "Spawn crew" 401
because the machine was sending a stale key; 331-1 is repairing key resolution today. If it lands in
time, browser-prove a keyed action end-to-end (real model text, not a 401). If it has not landed,
record it as owed with the exact evidence — do not fake it.

## Required verification (this is the point of the lane)

Exercise the changed flows the way a user does — click, type, submit, navigate — and check **both
desktop and a mobile viewport (~390×844)**. Visit every route that shares the state you touched
(`/`, `/run/<id>`, `/run`, unmatched). Hunt regressions in the surrounding flows, not just the happy
path. Screenshots alone are not verification; confirm **behavior**.

## Rules

Node 22 for repo commands where the repo pins it; the dev server is fine on host Node 24 (record
which you used). No full gate. Zero non-null assertions in this file today — keep it that way. Harness
scripts live **outside the repo** (`%TEMP%\rt331_chrome\…`). Append-only log, no fabrication, no
secrets. Never commit `.rapidtool/logs`, screenshots, or `%TEMP%` artifacts into the repo.

## Report back

Verdict · per fix: the file:line, the before behavior, the after behavior, and the browser proof
(what you clicked, what changed) · desktop + mobile results · the regression sweep result · what you
could not reach and why.
