# 263 · LANE U1 — UI: wire + organize `src/components/console.tsx`

Wave: W24 spring-clean (U1). Repo HEAD at start: `b721f9c`. Box: `src/components/console.tsx` only
(+ any console tests). Parent already wired T5.2-A (`FixturesPanel`, `fixtures` tab, import from
`@/lib/fixtures.review`) as uncommitted work in my box — this log verifies + polishes it.

Targeted evidence only: `npx eslint src/components/console.tsx` (siblings edit; full gate is forbidden).

## 1. T5.2-A fixtures wiring — verification

Verified end-to-end (static, file:line):

| Link | Status |
|---|---|
| `RunTab` union has `"fixtures"` | ✅ console.tsx:137 |
| `RUN_TABS` entry `{id:"fixtures", tier:"advanced"}` | ✅ console.tsx:169 |
| `Tabs.Trigger` renders from `RUN_TABS` (both tiers) | ✅ console.tsx:2930-2953 — no hand-written trigger to drift |
| `Tabs.Content value="fixtures"` exists, `forceMount` + inactive hidden | ✅ console.tsx:3149-3151, sibling to the other 10 blocks |
| Panel import `fixturesReview` from `@/lib/fixtures.review` | ✅ console.tsx:70 |
| Client-safe seam (no `node:fs` in client) | ✅ `fixtures.review.ts:18` lazy-imports `fixtures.server.ts` in the server-fn handler (chat.ts pattern) |
| Honest failure shape (never invented rows) | ✅ `fixtures.review.ts:30-38` catch → `{ok:false, rows:[], problems:[…]}`, and `fixtures.server.ts` owns `FixtureLoadResult` |
| Panel states: error / loading / data | ✅ console.tsx:458-459 + data branch |

## 2. Findings + fixes (before → after)

_(filled in below as each lands; this file is append-only — later sections get appended, never rewritten)_

**F1 — declare-or-strike: the panel's doc comment claims a decision path it does not have.**
`console.tsx:437-440` said: *“Approving/rejecting records a decision through the decision path — this
pane never edits a bar (run-side authority).”* The panel (console.tsx:441-493) renders **zero**
controls — no approve, no reject, no handler. `fixtures.ts:73` defines
`reviewState: "awaiting-decision" | "bar-missing"`, which promises a decision seat that the UI never
renders. Claim ≠ behavior (AGENTS.md honesty contract #3).
