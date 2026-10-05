# LANE DBG-1 — file-by-file bug hunt (CORE / GATES)

Branch: `rt349-dbgcore` · base `e06595d` · worktree `.../rt_final_wt/dbgcore`.

Scope: read every OWNED module end-to-end; fix only bugs provable with a
failing-before / passing-after keyless test. No keyed calls. No edits outside
OWNED.

## Files reviewed (file-by-file)

- `src/lib/errors.ts` — registry, `codeError`, `dualChannelFailDetail`,
  `classifyError` (chain/aggregate walk, matcher order, tier-2 generic). No
  provable defect.
- `src/lib/types.ts` — type-only module. No logic.
- `src/lib/sandbox.ts` — `runGenerated`, masker/regex-literal scanner,
  `buildPhase6Module`, brief-vocabulary helpers, `verifyClaims`,
  `runSandboxed` (deprecated). No provable defect.
- `src/lib/packet.ts` — `packetInputHash`, spend/budget helpers,
  `compileAgentPacket`/`systemJson`, `truncateToBudget`, export profiles. No
  provable defect.
- `src/lib/dod.ts` — registry probes, seat/provenance policy, `archTrace` +
  re-export resolver, brief-fit state line, oracle E-08 helpers, hard-DoD.
  **One bug fixed.**
- `src/lib/knowledge.ts` — `KnowledgeStore` (save/collision/lesson gate,
  findPatterns ranking), lesson row/signature/compare/select, defect-repair
  loop, outcome report. No provable defect.
- `src/lib/store.ts` — persistence hardening (rescue/quota), cross-tab
  merge/reconcile, advance/finish loops, approve/reject, helpers
  (`codedFailureText`, `keyedRefusalSince`, `measuredSpendFromUsage`,
  `foldStepSpend`, `staleEmitStep`, `windowArtifacts`). No provable defect.
- Test files read: `dod.test.ts`, `gates.test.ts`, `packet.test.ts`,
  `knowledge.test.ts`, `store.test.ts`, `errors.test.ts`,
  `brief-fixtures.test.ts`, `verify.server.test.ts`.

## Real bug fixed

### DBG1-01 — E-08 oracle helpers throw on a junk oracle row (live keyed P6 seam)

- **Where:** `src/lib/dod.ts` — `oracleToCaseSeeds` (:1240) and
  `missingOracleCaseIds` (:1251, pre-fix).
- **What was wrong:** both dereferenced `row.id` on every element with no
  object guard:
  - `oracleToCaseSeeds`: `.filter((row) => typeof row.id === "string" …)` — a
    `null`/primitive row throws `TypeError: Cannot read properties of null`.
  - `missingOracleCaseIds`: `oracle.map((row) => row.id)` — same throw, and it
    also reported invalid-id rows as "dropped" even though `oracleToCaseSeeds`
    never seeded them (the verify-side mirror `droppedPinnedOracleIds` filters
    ids by `typeof s === "string" && s.length > 0`, so the two had diverged).

  Reachable on the LIVE path: `engine.hydrateProject` keeps oracle rows raw
  (`engine.ts:2953` — `oracle: Array.isArray(raw.oracle) ? raw.oracle : []`, no
  per-row filter), and `codegen.server.ts:5760` / `headless.ts:4859` pass
  `project.oracle` straight to `oracleToCaseSeeds` at the keyed P6 verify seam.
  One hand-edited/imported/persisted junk row therefore threw out of the seam.
  This is the same hostile-row class the sibling `str()`/`rows()` helpers in
  `packet.ts` (R2-f05) and `hydrateProject` guards already document.
- **Fix:** both helpers now (a) tolerate a non-array input, (b) skip rows that
  are not objects or lack a non-empty string `id`, and (c)
  `missingOracleCaseIds` filters non-string `returnedIds` and shares the SAME
  valid-id filter as `oracleToCaseSeeds` (restoring parity with the mirror).
  Valid-row behavior is byte-identical.
- **Proving test:** `src/lib/dod.test.ts` —
  `describe("E-08 oracle helpers — junk-row tolerance (hostile persisted payload)")`,
  two cases. Verified RED→GREEN: with the original `dod.ts` restored (test kept)
  the run reports `# fail 2` with `name: 'TypeError'`; with the fix,
  `dod.test.ts # pass 39 # fail 0`.

## Candidate findings — NOT fixed (could not prove, or out of OWNED)

1. `src/lib/dod.ts:373` (pre-fix numbering) — `targetResolvesToReal` uses
   `reexportSpecifiers(target.source).some(...)` in its recursive branch while
   its doc and its top-level caller `reexportTargetsResolveToReal` both use
   `.every(...)`. I attempted a `.some`→`.every` fix with a partial-alias-bridge
   test; the test PASSED on the original code, because every re-export-only file
   is also evaluated directly in `archTrace`'s stub filter with `.every`, so the
   deepest dead target is always flagged regardless — no observable gate-outcome
   difference. Reverted as unprovable. (Semantic doc/impl mismatch only.)
2. `src/lib/store.ts:1516` — `reconcileCrossTabProjects` returns
   `adopted: drifted.length` (adopted count == drifted count), while the field
   name/type doc says "adopted". No consumer reads `merged.adopted`
   (`applyCrossTabSnapshot` recomputes `merged.drifted.length`), so there is no
   observable defect; it is a misleading field name only. Left unchanged.
3. `src/lib/dod.ts:809-810` — stale comment: the `p6-brief-fit` block still
   says "the conformance bar was recalibrated ½ → 0.35", but the probe now
   delegates to `briefFitSubstancePasses` (the W61 C1 core bar, `ceil(core×0.6)`
   via `BRIEF_FIT_CORE_BAR`). Comment vs behavior drift; comment-only, no test
   can pin it, so left as-is.
4. `src/lib/dod.ts` `oracleToCaseSeeds` doc renders the line as
   `# orc-<id> …` while the code emits `# ${row.id} …`; this is correct because
   real ids already carry the `orc-` prefix (`algorithms.ts:858`). Not a bug.
5. Out of OWNED (report only): `src/lib/phases.ts` and
   `src/lib/token-ledger.ts` were read for cross-checks; no defects proven.

## Verification

- `node --experimental-strip-types --test --test-reporter=tap` on
  `dod.test.ts gates.test.ts brief-fixtures.test.ts verify.server.test.ts`
  → `# tests 321 # pass 321 # fail 0` (60 suites).
- `node_modules/.bin/tsc.cmd --noEmit` → exit 0.
- RED→GREEN proof: original `dod.ts` + new tests → `# fail 2` (`TypeError`);
  fixed `dod.ts` → `# pass 39 # fail 0`.
