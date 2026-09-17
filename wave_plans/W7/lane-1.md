# W7 · LANE 1 — T-107.1 patch integration (str_replace into the repair loop)

**Mission.** `src/lib/patch.ts` (W4 core, 48/48 with policy) is landed but UNUSED. Wire the
str_replace primitive into the P6 tree-repair path so a repair cycle can emit a bounded per-file
DELTA instead of always re-emitting whole modules — with patch-first, refusal-default semantics.

**Done-when:** at least ONE real repair site applies `applyStrReplace` for per-file deltas
(highest-value site per dossier 107 T-107.1 — read it and pick; the candidate sites are
`headless.ts repairTreeDir` :2337 and the chunk envelope repair in `codegen.server.ts`);
ambiguous/no-match deltas REFUSE (never fuzzy-hammer, never silent full-rewrite fallback that
skips validation); legacy byte-parity holds when no patch is used; typecheck 0; suites green
(grow); `fixes/216r_patch_integration.md` written.

**Owned:** `src/lib/codegen.server.ts` + test, `src/lib/headless.ts` + test,
`fixes/216r_patch_integration.md` (NEW). NOT yours: engine/compaction (L2), cli/scripts (L3),
llm/subagent (L4), verification (L5).

**MINI-TASK PLAN:**
1. Read dossier `research/multiagent/107_competitors_agentic.md` T-107.1 + `src/lib/patch.ts`
   fully (`PatchRequest/PatchKind/PatchResult`, `applyStrReplace` :279 — exact match → fuzzy
   graded similarity → refusal; `PATCH_MAX_LISTED` :117 caps listings) + `fixes/216n` §T-107.1.
2. Read the two candidate sites: `repairTreeDir` (`headless.ts` :2337 with the docblock at :1980 —
   the bounded repair cycle AGAINST a dir) and the chunk repair in `codegen.server.ts`
   (`repairTreeFailureTail` :471 + prompt builders :485/:505/:519). Pick per dossier intent;
   write the choice + rationale in 216r BEFORE patching.
3. Wire the patch path BEHIND the existing flow: a repair that produces a str_replace block for
   ONE already-accepted file applies via `applyStrReplace` and re-validates the result with the
   existing deterministic per-file validation; any refusal code returns the legacy full-rewrite
   repair path UNCHANGED. No new silent paths.
4. Tests: (a) unique-match delta applies + revalidates; (b) ambiguous and no-match REFUSE with
   the coded reason (and the legacy path still runs); (c) byte-parity: a repair with no patch
   block produces the exact legacy prompt/diff.
5. `fixes/216r` — skeleton FIRST; work log, commands + real output, old→new, not-done.

**TRAPS:** the envelope flow is byte-pinned in many tests (codegen 86) — do not alter existing
prompt bytes when no patch is in play. `applyStrReplace` never guesses: preserve that.
**Verify:** `npm run typecheck`; `node --experimental-strip-types --test src/lib/codegen.server.test.ts src/lib/headless.test.ts`;
baselines: codegen 86, headless 90 — grow, never drop.
