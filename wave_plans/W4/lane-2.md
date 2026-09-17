# W4 · LANE 2 — Wave H primitives: T-107.1 `str_replace` + T-107.3 policy engine (CORES ONLY)

**Mission.** Start Wave H with its two pure primitives as NEW modules + tests. This wave is
CORES ONLY: no integration edits (codegen/headless/dod/cli wiring is deliberately deferred
to W5 so file ownership stays disjoint).

**Done-when:** `npm run typecheck` 0; both new suites green; ZERO edits outside your owned files.

**Owned files (yours alone):** NEW `src/lib/patch.ts` + NEW `src/lib/patch.test.ts`;
NEW `src/lib/policy.ts` + NEW `src/lib/policy.test.ts`; NEW `fixes/216n_wave_h_primitives.md`.
Neighbors you must NOT touch: ANY existing `src/lib/*` file (patch.ts/policy.ts are the only
modules you write), console/UI, codegen, headless, dod, scripts.

**MINI-TASK PLAN (follow in order):**
1. RECON: read dossier `research/multiagent/107_competitors_agentic.md` rows T-107.1 + T-107.3
   (and their 103 A9 / 100 P0-01·P0-02·P0-06 references if present). Read `src/lib/rt-timeline.ts`
   + `src/lib/rt-timeline.test.ts` as the HOUSE-STYLE exemplar for a pure module + tests
   (TSDoc with finding ids, pure/total/honest doctrine). `grep -n "RT_E_" src/lib/*.ts` to
   learn the error-code namespace before allocating new codes.
2. `patch.ts` (T-107.1 core): `applyStrReplace(source, { oldStr, newStr, fuzzy? })` —
   UNIQUE-match requirement: 0 matches ⇒ coded refusal; >1 ⇒ coded refusal naming the count
   (and line numbers if cheap); exactly 1 ⇒ replace. Graded FUZZY fallback as a separate
   opt-in level (explicit threshold; the result must SAY it was fuzzy — never silently fuzzy).
   Result = `{ ok, text?, diff?, kind: "exact" | "fuzzy", code?, error? }` — diff-as-result.
   PURE + deterministic + total (no fs, no throw on bad input; garbage in ⇒ honest refusal).
3. `patch.test.ts`: unique happy path; 0-match; multi-match (count correct); fuzzy path +
   threshold behavior; determinism; input non-mutation; degenerate inputs (empty old, empty
   source); diff shape. ~15-25 tests. Prove teeth (at least one test that would fail if
   unique-match downgraded to first-match).
4. `policy.ts` (T-107.3 core): pure evaluator — `evaluatePolicy(action, resource, ctx)` →
   `{ decision: "allow" | "deny", reason, fallback? }` designed as the ONE seam every
   approval will route through in W5. Default-DENY on unknown action/resource; mandatory
   fallback semantics per P0-01 (read the dossier row; if it lists autopilot/human seats,
   keep the shape compatible with W2's `ApproveActor` in headless.ts — read it, don't edit it).
5. `policy.test.ts`: allow/deny matrix; unknown ⇒ deny (default-deny proof); fallback
   returned for the documented cases; determinism; no throw on malformed ctx.
6. `fixes/216n_wave_h_primitives.md` — skeleton FIRST; fill work log + real command output
   + what W5 must wire (explicit integration list: codegen P6 emit deltas, headless
   repairTreeDir, headless:734 / cli:517 / dod:337-483 routing).

**PARENT FINDINGS & TRAPS:**
- Two W3 lanes died mid-file last wave; the discipline that saved the tree: skeleton-first
  logs, patch-only, small verified steps. Budget dies at ~50 calls — plan the writing order
  so patch.ts + its tests are DONE before you start policy.ts.
- cmdk/Radix and other UI deps are NOT yours. No new npm dependencies.
- Error codes: follow the existing `RT_E_*` allocation pattern; grep first.

**Verification (exact commands):**
```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
npm run typecheck
node --experimental-strip-types --test src/lib/patch.test.ts src/lib/policy.test.ts
npx eslint src/lib/patch.ts src/lib/policy.ts src/lib/patch.test.ts src/lib/policy.test.ts
```

**Logging:** `fixes/216n_wave_h_primitives.md` — skeleton first; you are its only writer.
If you run out of budget mid-edit, say so PLAINLY with the real state on disk.
