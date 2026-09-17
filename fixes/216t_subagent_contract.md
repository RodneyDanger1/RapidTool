# fixes/216t — T-107.10 sub-agent contract + mock-LLM provider + E2E (W7 · L4)

**Status:** COMPLETE (W8-L4 closure, 2026-09-17) — §1-§5 filled from real command output; the E2E's
brief→(mock) synthesis→emitted-tree-FILES assertions verified against the source (no test extension
needed, Owned rule = extend only if lacking); typecheck 0 / subagent 22/22 / mock 12/12 / eslint 0.
§6 keeps the W7 boundary record verbatim and appends the W8 closure notes (not-done / cross-file).

**Lane:** W7-L4 · `wave_plans/W7/lane-4.md` · task `T-107.10`
(`research/multiagent/107_competitors_agentic.md:335`: "Sub-agent contract + claim lifecycle for `crew`;
deterministic mock-LLM E2E in CI"; steal §:311 "Sub-agent contracts, not just spawn calls" +
§:316 "Deterministic LLM-free E2E").
**Owned files:** NEW `src/lib/subagent.ts` + `src/lib/subagent.test.ts`, NEW
`src/lib/llm/providers/mock.ts` + `src/lib/llm/providers/mock.test.ts`, `src/lib/crew.server.ts` +
`src/lib/crew.test.ts` (seam hunks only), `src/lib/llm/providers/registry.ts` (additive explicit-provider
seam — required by the mock's "its own provider, not a deepseek model id" rule; recorded here because the
lane's Owned list does not name it), this log (NEW).

## 1. Mission (from the lane plan)

T-107.10 (`research/multiagent/107_competitors_agentic.md:335`): "Sub-agent contract + claim
lifecycle for `crew`; deterministic mock-LLM E2E in CI" — steal §:311 ("Sub-agent contracts, not
just spawn calls") + §:316 ("Deterministic LLM-free E2E"). Concretely, two modules plus their
proof:

1. `src/lib/subagent.ts` — a claim → complete|block contract for child seats (hard caps, coded
   refusals, append-only ledger attribution, bounded-concurrency batch) modeled on the crew's fixed
   phase→role transcript and the team-tools.ts:399 claim shape.
2. `src/lib/llm/providers/mock.ts` — an EXPLICIT-SELECTION-ONLY canned-transport provider, so the
   REAL P6 pipeline (real prompts, real parser, real per-file validation, real emission) can run
   end-to-end with zero network — plus ONE E2E that proves brief → (mock) synthesis → emitted tree
   FILES on disk.

W7-L4 wrote all four modules but hit the iteration cap BEFORE any verification (its own summary:
"NO verification command was executed — nothing is claimed green"); the parent then repaired the
boundary to green and recorded those fixes in §6. This W8-L4 lane owes: verify the E2E actually
asserts the brief→synthesis→emitted-FILES chain, fill this body with real output, and keep eslint
clean on the touched files.

## 2. Recon (facts with refs)

- **Requirements source:** dossier 107 :335 (task row) + :311/:316 (steal lines); the mock's
  honesty rules are derived from AGENTS.md's honesty contract (§1-§4: never a default / never
  "configured" / never fabrication / provider-scoped model ids).
- **Forced registry seam:** `getProvider("mock")` must stay `undefined` while an explicitly-passed
  descriptor is still dispatchable → an additive explicit-provider seam was required in
  `src/lib/llm/providers/registry.ts` (header note :39-44; `mock` named in the provider-id doc :91;
  `ExplicitProviderSelection` :173; `resolveExplicitProvider` :184; `CallModelOptions.provider`
  :376; the `callModel` explicit branch :405). Patched although the lane's Owned list does not name
  registry.ts (recorded in W7-L4's summary; ratified by the W7 close commit `ecc5c0b`, whose stat
  includes registry.ts).
- **Crew seam deliberately not written:** W7-L4 recorded "crew.server.ts seam hunks NOT written
  (deliberate: the registry path already carries crew → callModel, and the crew's CrewCompleter DI
  takes `mock.complete` verbatim); crew.test.ts not grown." The crew DI surface is
  `CrewCompleter` (crew.server.ts:842) + `crewRegistryCompleter` (:884-885) — the natural wiring
  point for a later lane.
- **Consumer census (W8-L4, re-verified):** `grep -rln "createSubagentContract" src/ scripts/` →
  only `src/lib/subagent.ts` + its test; `grep -rln "providers/mock" src/ scripts/` → only
  `mock.test.ts`; case-insensitive "subagent" hits no non-test file outside subagent.ts. Both new
  modules are therefore **landed but unwired in production** — a cross-file need, not a claim (§6).
- **Test-discovery fact (re-verified, decisive):** `package.json:19` runs
  `node --experimental-strip-types --test "src/lib/*.test.ts" ...` — a SINGLE star, i.e. direct
  children only → it does NOT pick up `src/lib/llm/providers/*.test.ts`.
  `node -e "fs.globSync(...)"` → `single-star files: 67 | includes providers? false`;
  `double-star files: 72 | includes providers? true`. `scripts/gate.sh:90` uses
  `"src/lib/**/*.test.ts"` → DOES reach the nested dirs (direct run of
  `--test "src/lib/llm/**/*.test.ts"` = 33 tests = 12 mock + 21 registry). Net: `npm test` misses
  both provider suites; `gate.sh` catches them — a package.json glob widening is owed (§6).
- **E2E seam note:** mock.test.ts:363-377 calls the expansion stand-in "e2e expansion request (not
  the production prompt)" — an explicitly labeled substitute (the production expansion prompt needs
  the network), kept labeled per the lane instruction; the REAL `parseExpandedSpecJson` still parses
  the mock's canned text.
- **Pipeline facts used by the verification (codegen.server.ts):** `liveP6Synthesis` :2229;
  declared-kind projects always take the chunked branch :2331 → `synthesizeChunkedTree` :2593;
  a refused chunk returns an honest partial via `partialTreeRefuse` :2833-2853 (accepted rows only,
  base untouched when nothing was accepted — never a deterministic-floor substitute); the ≤8-
  signature single-module path is unreachable for the E2E's `kind: "app"` base; the tree-level
  brief-fit gate runs on the ASSEMBLED entry :2682-2692.

## 3. What landed (files + line refs)

NEW `src/lib/subagent.ts` (615 lines) — the sub-agent contract:
- caps :49-61 (`SUBAGENT_MAX_CONCURRENCY = 4`, `SUBAGENT_MAX_TASKS = 24`,
  `SUBAGENT_DEFAULT_BUDGET_TOKENS = 12_000`, `SUBAGENT_MAX_BRIEF_CHARS = 8_000`);
- types :67-140 (`SubagentTask`, `SubagentUsage`, `SubagentResult` = `{ok:true, code:null, note}` or
  a coded refusal, `SubagentLedgerRow` (append-only attribution), `SubagentBatchReport`,
  `SubagentClaimOutcome`, `SubagentSettleOutcome`, `SubagentCompleter`, `SubagentContract`);
- helpers: `normalizeScopeEntry` :183, `subagentConcurrencyRefusal` :189 (hostile numbers refused,
  never clamped), `subagentLedgerLines` :206;
- `createSubagentContract` :320 — claim/complete/block lifecycle + `runBatch` (bounded-concurrency
  worker pool, input-ordered results, pre-dispatch budget refusal, per-task budget overspend
  blocked with the honest spend kept).

NEW `src/lib/subagent.test.ts` (428 lines) — 22 tests in 4 suites: caps :74, validation + sibling
scope :171, transport refusals + config gate :255, claim lifecycle + ledger attribution :300
(injected fake dispatch, pinned clock, concurrency bound observed).

NEW `src/lib/llm/providers/mock.ts` (189 lines) — the explicit-select mock LLM:
- ids/constants: `MOCK_PROVIDER_ID` :42, `MOCK_MODEL_ID` :45 (`mock-canned-v1` — its OWN namespace),
  `MOCK_MODEL_IDS` :48, `MOCK_SELECT_ENV` :51 (`RAPIDTOOL_MOCK_LLM`), `MOCK_SELECT_VALUE` :55 (exact
  `1`, trimmed; anything else counts as unset);
- `createMockProvider` :100 — canned queue, `calls()`/`remaining()`/`push()`/`reset()`, exhausted
  queue → coded `RT_E_LLM_REJECTED` naming the mock (:111-118, "the mock NEVER fabricates text"),
  descriptor with `isConfigured: () => false` hard-wired (:132), served ok envelopes stamped
  `next.model ?? MOCK_MODEL_ID` (:120);
- `mockSelected` :156 (exact-value env), `selectMockProvider` :170 (coded `RT_E_VALIDATION` unless
  explicitly selected via `explicit: true` or the env).

NEW `src/lib/llm/providers/mock.test.ts` (427 lines) — 12 tests: honesty :113 (never a default /
never "configured" / coded exhaustion), explicit selection :205 (env/param, hostile descriptors,
registry explicit path, untouched default path), E2E :335.

PATCHED `src/lib/llm/providers/registry.ts` — additive explicit-provider seam (line refs in §2; the
default path is byte-identical — regression 21/21 in §4).

PATCHED `src/lib/crew.server.ts` / `src/lib/crew.test.ts` — NONE (seam hunks deliberately not
written, §2/§6).

## 4. Commands + real results

All run from `cd "/c/Users/mnril/Desktop/RapidTool Main"` (Node v22.23.2), W8-L4 closure, 2026-09-17.

1. **Typecheck** — `npm run typecheck` → exit 0. Raw direct leg:
   `npx tsc --noEmit > /tmp/tsc.txt 2>&1; echo "TSC_EXIT:$?"` →
   `TSC_EXIT:0`, `TSC_LINES:2` (only the harness's npm-notice lines; ZERO diagnostics).
2. **Named suites** — `node --experimental-strip-types --test src/lib/subagent.test.ts src/lib/llm/providers/mock.test.ts`
   → `# tests 34 / # pass 34 / # fail 0`. Per file:
   - `src/lib/subagent.test.ts` → `# tests 22 / # pass 22 / # fail 0`
   - `src/lib/llm/providers/mock.test.ts` → `# tests 12 / # pass 12 / # fail 0`
3. **E2E case itself** (mock run alone, tap) →
   `# Subtest: mock provider — E2E (brief → mock synthesis → emitted tree files)` /
   `    ok 1 - runs the real P6 chunked pipeline over canned envelopes and emits the tree verbatim (zero network)` /
   `ok 3 - mock provider — E2E (brief → mock synthesis → emitted tree files)`.
4. **Regressions** — `... registry.test.ts` → 21/21; `... crew.test.ts` → 46/46.
5. **ESLint on the touched files** —
   `npx eslint src/lib/subagent.ts src/lib/subagent.test.ts src/lib/llm/providers/mock.ts src/lib/llm/providers/mock.test.ts > /tmp/eslint_w8_l4.txt 2>&1; echo "ESLINT_EXIT:$?"`
   → `ESLINT_EXIT:0`; the output file holds only the harness npm-notice lines (no warnings, no
   errors).
6. **Discovery leg** — `node -e "fs.globSync(...)"` → `single-star files: 67 | includes providers?
   false` / `double-star files: 72 | includes providers? true`; and
   `node --experimental-strip-types --test "src/lib/llm/**/*.test.ts"` → 33/33.

### E2E verification (the lane's task 1) — brief → (mock) synthesis → emitted tree FILES

Verdict: the E2E at `mock.test.ts:335-427` DOES assert the full chain with genuine FILE assertions
on disk; per the Owned rule ("extensions only if the E2E lacks file assertions") **no extension was
made** — the test file is untouched by this lane.

- **brief leg:** `:396-399` — every chunk prompt (the REAL prompt builders' output, logged by the
  mock) carries the brief and the requirement list; the expansion call goes through the labeled
  stand-in (:363-377) into the REAL `parseExpandedSpecJson` (:373).
- **synthesis leg:** `:347` fixture precondition (20 signatures → 3 chunk groups); `:392` the
  deterministic floor was replaced (`q.generatedSource !== base.generatedSource`); `:393` the
  verify leg is never called; `:394` exactly 4 model calls (1 expansion + 3 chunks); `:395` every
  canned envelope consumed (`remaining() === 0`).
- **emitted tree FILES leg:** `:402-407` `tree.length === 4` and the exact paths
  `[src/generated.ts, src/jobs/rent.ts, src/jobs/rent-2.ts, src/jobs/rent-3.ts]`; `:408-410`
  `emitProject(q, dir, {redTree: "probe"})` ok; `:411-416` per file — `existsSync`, content
  `=== row.source` (byte-identical), and present in `emitted.files`; `:417` `README.md` scaffold
  landed around the tree.
- **zero network:** `:419-420` the fetch tripwire saw 0 calls.

Why those assertions bind (checked against the pipeline, not assumed): a declared-kind project
always takes the chunked branch (`liveP6Synthesis` codegen.server.ts:2331), and the chunked driver
has NO floor fallback — a refused chunk returns an honest partial via `partialTreeRefuse`
(:2833-2853) built from accepted rows only (or the untouched base), which cannot reproduce the
4-row expected-path tree; the tree-level brief-fit gate runs on the ASSEMBLED entry (:2682-2692);
and `mock.remaining() === 0` + `calls === 4` leave no room for a substituted path. `readFileSync
=== row.source` therefore binds the disk bytes to tree rows produced by `liveP6Synthesis` with the
mock as its ONLY completer.

**Post-capture note:** these numbers were captured with the tree at this lane's own state; other W8
lanes were mid-edit when this log was finalized, so a same-minute re-run is red — see §6's "W8-L4
concurrency caveat" for the exact attribution.

## 5. Old → new

Parent fixes are recorded at the W7 boundary (§6) and verified here at their final state with refs;
the module diffs below are what the boundary repairs changed.

- **Import specifiers (mock.ts / mock.test.ts).** Old: the lane's first write used `../`-style
  specifiers that TypeScript could not resolve (the "parent fixed `../` → `./` import slips" item).
  New (final state, verified resolving by the green suite): mock.test.ts:39 `./mock.ts`, :47
  `./registry.ts`, :48 `./deepseek.ts`, :49 `../../llm.ts`; mock.ts:36-39 `../../errors.ts`,
  `../../llm.ts`, `./deepseek.ts`, `./registry.ts`.
- **`LlmResult` ok arm — `model` (parent boundary fix).** Old: the okEnvelope fixture omitted
  `model` while `LlmResult`'s ok arm carries the serving model id. New: fixture returns
  `model: MOCK_MODEL_ID` (mock.test.ts:104-107, comment in place), and the provider stamps
  `next.model ?? MOCK_MODEL_ID` on served ok envelopes (mock.ts:120).
- **`LlmResult` refusal arm — `error?: string` (parent boundary fix).** Old: `res.error` was read
  unguarded while the refusal arm types `error?: string`. New: `assert.match(res.error ?? "", …)`
  guards (mock.test.ts:159-160, comment in place).
- **Subagent completer seam — `role: null` → absent (parent boundary fix).** Old: `NormalizedTask`
  carries `role: string | null` while the public completer contract takes the optional-field input
  shape. New: the dispatch maps null back to absent at exactly one seam (subagent.ts:547-550,
  comment in place): `deps.complete({ ...task, role: task.role ?? undefined })` — no contract change.
- **registry.ts — NEW additive explicit-provider seam.** Old: no way to dispatch to an
  explicitly-passed provider; the only transport was the role-tier DeepSeek path. New:
  `resolveExplicitProvider` (registry.ts:184) + `CallModelOptions.provider` (:376) + the `callModel`
  explicit branch (:405) with provider-scoped model validation (*the mock's namespace rejects
  DeepSeek ids, and the tier path rejects `mock-canned-v1`* — both sides asserted at
  mock.test.ts:249-261). The DEFAULT path is unchanged (keyless not-configured envelope still
  asserted at :290-297; registry regression 21/21).
- **crew.server.ts / crew.test.ts — untouched.** No diff to record; the seam hunks were
  deliberately not written in W7 (rationale quoted in §2).
- **Lint repairs at the W7 boundary** — per commit `ecc5c0b`'s message: "prefer-const + unused-arg
  lint items". The current hunks were not re-derived (the commit carries the final state); final
  state re-verified by this lane: `ESLINT_EXIT:0` on all four files (§4.5).

## 6. Not done / deferred

**W7 boundary status (parent, 2026-09-17):** ALL four modules verified — typecheck 0 (after the
parent fixed `../` → `./` import slips in mock.ts/mock.test.ts), subagent 22/22, mock 12/12,
registry 21/21, eslint clean. Parent repairs also: `LlmResult.model` on okEnvelope, `error ?? ""`
guards, NormalizedTask `role: null` → absent mapping at the completer seam. Sections 1-6
(work log + real-output evidence) STILL OWED → W8-L4.

**W8-L4 closure (2026-09-17):** §1-§5 are now filled from real command output (see §4). The W7
boundary paragraph above is kept verbatim as the historical record; its "STILL OWED" line is
discharged by this lane: typecheck 0, subagent 22/22, mock 12/12, eslint 0, and the E2E's
brief→(mock)→emitted-FILES assertions verified in-source (no test extension made — the Owned rule
"extensions only if the E2E lacks file assertions" was not triggered).

Not done / handed off (cross-file needs, none of them claim-blocking here):

- **`npm test` misses the provider suites.** `package.json:19` globs `"src/lib/*.test.ts"` (single
  star → direct children only), so `src/lib/llm/providers/mock.test.ts` (12) and
  `registry.test.ts` (21) run only under `scripts/gate.sh` (`"src/lib/**/*.test.ts"`, :90; verified
  reaching nested dirs — §4.6). Widening the package.json glob to `src/lib/**/*.test.ts` is owed to
  whoever owns package.json — not this lane's owned list.
- **`src/lib/subagent.ts` is landed but UNWIRED.** No production consumer exists in the current
  tree (`grep -rln "createSubagentContract" src/ scripts/` → module + test only; case-insensitive
  "subagent" hits no other non-test file; `providers/mock` likewise appears only in its own test).
  The crew wiring seam — `CrewCompleter` (crew.server.ts:842) / `crewRegistryCompleter` (:884) —
  was deliberately not written in W7 and no later lane has wired it. T-107.10's "contract for
  `crew`" consumer is therefore the next crew-side lane's work.
- **The E2E's expansion call uses the labeled stand-in prompt** (mock.test.ts:363-377) — explicitly
  named "not the production prompt"; the production expansion prompt remains network-bound by
  design. Keep the label if the E2E is ever extended.
- **registry.ts ownership ratification** — W7-L4 flagged the patch as outside its Owned list; the
  W7 close commit (`ecc5c0b`) shipped it, and this lane's regression run (registry 21/21) confirms
  the default path is intact. Recorded here as ratified-by-commit, not re-litigated.
- Nothing else is owed by this lane; deferred/skipped items and any struck claims: none.

**W8-L4 concurrency caveat (2026-09-17, at lane close):** the §4 evidence was captured on the tree
*at this lane's own state* — verified free of the other lanes' in-flight edits (a tsc run with exit 0
scans every file, scaffold.ts included). While this lane finished writing this log, W8-L1/L3/L5 were
mid-edit (`git status --short`: `M src/lib/scaffold.ts`, `M src/lib/codegen.server.test.ts`,
`M scripts/rapidtool-cli.mjs`, `M scripts/README-cli.md`, `M scripts/README-cli.test.mjs`, untracked
`probe-w8l5*.ts`; diff vs HEAD: scaffold.ts +111/-23, codegen.server.test.ts +363, rapidtool-cli.mjs
+680). A same-minute re-run is therefore red, and the failures are NOT in this lane's files:

- `npx tsc --noEmit` → exit 2; every diagnostic is in `src/lib/scaffold.ts` (mid-flight:
  :2325 `jobModules` not in the window-args type; :2337 `unmaterialisedJobs` used before its
  declaration; :2502 `treeJobModules` not in `OracleSurfaceCtx`).
- `node --experimental-strip-types --test src/lib/llm/providers/mock.test.ts` → 11/12; the E2E
  fails INSIDE the real pipeline's scaffold leg: `ReferenceError: Cannot access 'unmaterialisedJobs'
  before initialization`, stack `Module.scaffoldProject (scaffold.ts:2351:7)` →
  `emitProject (headless.ts:1412)` → `mock.test.ts:408`. The E2E is doing its job (running the REAL
  pipeline against a broken upstream file); its own fixture and assertions are unchanged.
- This lane touched NO TypeScript: its only working-tree change is
  `M fixes/216t_subagent_contract.md`.

The W8 boundary gate must (re-)run after ALL lanes stop; once W8-L1's scaffold edit (216u §5: D3
bridge policy / D2 oracle job-row ctx) is complete, typecheck and the two suites are expected to
return to §4's numbers on the merged tree. This caveat is appended rather than resolved because
`src/lib/scaffold.ts` is explicitly NOT this lane's file (Owned list: fixes/216t + the two test
files only).
