# W48 / 334-5 — "Chrome" — console honesty, pass 2

Read `wave_plans/W48/README.md` first (Step 0 and the hard rules are there). Your log:
`fixes/334_5_chrome.md`. Owned files: `src/components/console.tsx`, `src/routes/**`,
`src/lib/fixtures.ts`, `src/lib/fixtures.server.ts`, `src/lib/fixtures.review.ts`,
**`src/lib/store.ts`**, **`src/lib/llm.ts`** + new tests.

## Step 0 reconciliation (do this before any edit)

Read your own `fixes/331_5_chrome.md` and `fixes/332_5_chrome.md` (including the appended follow-up that
landed the stale-row edge trigger and the live validity probe), then your files on disk. Open your log
with **claimed / on disk / still open**, with `file:line` for the last one.

## Fix work

**C1 — the run path's failure class must reach the operator.** Your own last-pass note records it: `run` /
`runUntilHitlAsync` expose **no `code`**, so a P6-synthesis 401 cannot move the status chip — the operator
sees a generic failure instead of `RT_E_LLM_KEY_REJECTED`. Lane 334-2 is surfacing the code on the run
result this wave; land the console half: consume it so the chip and the run surface show the coded class.
Read `fixes/334_2_ledger.md` at the end for the exact field name; if 334-2 has not landed it yet, use the
shape as it stands and report the presumption.

**C2 — sweep the console for honesty gaps in the same class.** Places worth checking, all of which are
yours: a surface that shows a value without its provenance; the fixtures panel (drafts are pending,
approval needs the human seat — verify the copy still matches the bytes); an error path that shows a
message with no code; anything that can read as "done" while a gate is unmet. The audit's F-4 lesson
applies generally: **a field or label must not be readable as a stronger claim than it measures.**

**C3 — re-prove, do not re-land.** The rows earlier passes proved landed (`R6-f01/f07/f12/f13/f14/f15`,
the pane-boundary containment, the chip's two states) must not be re-landed. Re-prove only what your
changes touch.

## Verification (required)

Playwright is installed (`node_modules/playwright`); no MCP browser tool exists. Drive `npm run dev`
(port 8080 is a fixed contract) and exercise the changed flow like a user — click, type, submit, navigate
— on **desktop 1440×900 and mobile ~390×844**, visiting every route that shares the state you touched
(`/`, `/run/<id>`, `/run/<bad-id>`, `/run`, unmatched). A screenshot is not verification. Keep harnesses
in `%TEMP%\rt334_chrome\…`, **stop the dev server and leave no stray node processes when you finish**.
Bounded keyed calls only (at most one, reported with usage) — the keyed path works, so use it if a real
call is the only honest proof; otherwise stub it and say which you did.

## Done-when

Your touched suites green on Node 22 (`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node 24 (report
counts; `store.test.ts`, `llm.test.ts`, `fixtures.review.test.ts` are the likely set). `npx eslint` on
your files exits 0; `npx tsc --noEmit` zero diagnostics in your files; zero non-null assertions in
`console.tsx`. No full gate, no `npm run eval`, no secrets, nothing committed from `%TEMP%`. Append to
your log; never rewrite it.
