# W46 / 332-5 — "Chrome" — console honesty and the fixtures surface

Read `wave_plans/W46/README.md` first, then `fixes/331_5_chrome.md` (your lane's history). Your log:
`fixes/332_5_chrome.md`.

## Owned files (STRICT)

`src/components/console.tsx` · `src/routes/**` · `src/lib/fixtures.ts` · `src/lib/fixtures.server.ts` ·
`src/lib/fixtures.review.ts` · **new** `src/lib/fixtures*.test.ts`

## Findings you are fixing

**C1 — the console can display `configured` while keyed actions are rejected.**
`src/lib/store.ts` (NOT yours — request changes there via your log) defines
`LlmStatusSurface = { configured: boolean; label: string; model?: string }`, and the chip reflects key
**presence**, so a rejected key still reads "configured" and an operator only discovers the truth when
a keyed action fails. In your files, make the console surface **validity, not presence**: render the
last keyed outcome class when there is one (the provider now returns `RT_E_LLM_KEY_REJECTED` /
`RT_E_LLM_KEY_SHADOWED` from the 331 wave, with the key source named by last-4 tail — never print a
full key), and make the chip's copy honest in both states. If the honest version needs
`store.ts`/the server status seam, write the exact requested shape into your log and report it — do not
edit `store.ts`.

**C2 — the T5.2-A honesty surface has no test** (`src/lib/fixtures.review.ts` +
`src/lib/fixtures.server.ts` are reached only by untested `console.tsx`; register `R9-f05`). These two
modules are the fixtures honesty surface: fixtures are drafted as **pending** and never auto-approved.
Add a real test file that drives them and asserts the contract (a draft is pending; approval requires
the human seat; a denied verdict writes nothing and stamps no `decidedBy`). This closes the module
coverage guard's named gap — verify with `node scripts/check-module-coverage.mjs` that the two modules
drop off the allowlist (or that the allowlist entry is removed because it is now reached).

**C3 — the register's remaining located UI rows.** Sweep `AR6`/`R6-*` for anything still open and land
what is real. `R6-f12` (pane boundary) and `R6-f01/f07/f13/f14/f15` were proven landed by 331-5 — do
not re-land them; re-prove only if you change their code.

## Required verification (real browser)

Playwright is installed (`node_modules/playwright`). No MCP browser tool exists. Start `npm run dev`
(`0.0.0.0:8080` is a fixed contract). Exercise the changed flow the way a user does — click, type,
submit, navigate — on **desktop (1440×900) and mobile (~390×844)**, visit every route that shares the
state you touched (`/`, `/run/<id>`, `/run/<bad-id>`, `/run`, unmatched), and hunt regressions in the
surrounding flows. A screenshot is not verification; confirm behavior. Keep harnesses in
`%TEMP%\rt332_chrome\…`, and **stop the dev server and leave no stray node processes when you finish**
(the machine owner has complained about that).

**The keyed path now works** (`.env` is preferred over the stale ambient key), so you can browser-prove
a real keyed action. Bounded: at most 1–2 billed turns, reported with usage. If you prefer, prove the
chip's honesty with a stubbed/failed call instead — say which you did.

## Rules

Node 22 for repo commands where the repo pins it; the dev server is fine on host Node 24 (say which you
used). Zero non-null assertions in `console.tsx` today — keep it that way. No full gate, no
`npm run eval`, no secrets. Do not commit screenshots or temp artifacts into the repo.

## Report back

Verdict per finding · the chip's before/after copy and the browser proof of both states · the new
fixtures test with its real results on both runtimes · the coverage-guard result · desktop + mobile +
regression sweep · what you could not reach and why.
