# fixes/269_lane9_audit_tests.md — R9 · THE TEST SUITES AS A SYSTEM (W28 mass-investigation part 2)

**Lane:** R9 · **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD at start:** e3d3fe4
**Goal:** audit the test suites as a system — which pins really bite, which are vacuous / reverted-pass,
tests asserting implementation ≠ contract, coverage gaps vs the mission's claims, suites that never run
(the H2 79-vs-81 class), the guard suites' real teeth. Deliverable: §R9 appended to
`research/multiagent/thoroughanalysis.md` via the END-MARKER protocol + the coder REPLACE/ADD list.

**Status:** IN PROGRESS — skeleton first, findings below as they land.

## Inventory (as of read)
- `git ls-files | grep -E '\.test\.(ts|mjs)$'` → **99 files**: 81 `src/lib/**/*.test.ts` + 18 `scripts/*.test.mjs` (incl. llm/providers/mock.test.ts + registry.test.ts — the H2 pair).

## Method
1. Read `wave_plans/W28/extension.md` (R9 box) + `wave_plans/W27/mass-investigation.md` (mission+protocol) — done.
2. Re-read `research/multiagent/thoroughanalysis.md` + `thoroughaction.md` (A1–A4, C1–C6, R1–R8 as landed) — done (baseline read; re-read before append).
3. Infrastructure: `package.json` test legs, `scripts/gate.sh` leg definitions + exit condition, the guard suites.
4. Per-suite read: every critical pin mentally reverted — does it bite? Vacuous asserts (`assert.ok(true)`-class)? implementation-pins vs contract-pins? coverage gaps vs mission claims?
5. Verify the H2 glob fix (`package.json:19` includes the 2 previously-missed files) with a real discovery-only command.

_(findings land below — every claim carries file:line + read time or a command's output)_
