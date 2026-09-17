# W8 · LANE 4 — T-107.10 closure: verify the mock E2E + write `fixes/216t`

**Mission.** The four modules landed and are parent-verified green (typecheck 0, subagent 22/22,
mock 12/12, registry 21/21, eslint clean). What's owed: proof the E2E test actually runs
brief→(mock) synthesis→emitted tree files with assertions, plus the `216t` body.

**Done-when:** `fixes/216t` complete (work log, commands + real output, old→new incl. parent
fixes, cross-file needs, not-done); the mock E2E verified end-to-end (if `mock.test.ts`'s E2E
case does not already assert emitted tree FILES, extend it — modest additions only); eslint
clean on the touched files; suites green (grow).

**Owned:** `fixes/216t_subagent_contract.md`, `src/lib/llm/providers/mock.test.ts` (extensions
only if the E2E lacks file assertions), `src/lib/subagent.test.ts` (only if a gap is proven).
NOT: src/lib/* others (L1), scripts (L3), fixes/216o/p/v (L2), codegen tests (L5).

**Context:** W7-L4's summary (`subagent-summary-3-20260917_083223_*.txt`) lists the landed
symbols; `fixes/216t` §6 records the parent fixes. The E2E seam notes are at mock.test.ts :363
(“e2e expansion request (not the production prompt)” — an explicit stand-in, keep it labeled).
**Verify:** `npm run typecheck`; `node --experimental-strip-types --test src/lib/subagent.test.ts src/lib/llm/providers/mock.test.ts`;
`npx eslint src/lib/subagent.ts src/lib/subagent.test.ts src/lib/llm/providers/mock.ts src/lib/llm/providers/mock.test.ts`.
