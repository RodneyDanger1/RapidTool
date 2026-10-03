# 342-8 verifier B — wave-wide audit, destruction, and the honesty of the new grading

Root `C:\Users\mnril\Desktop\RapidTool Main` · git `main` HEAD `686d7b6` + uncommitted wave.
Runtimes: host Node v24.15.0 and Node 22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`).
No working-tree edit except this log; pre-fix artifacts copied read-only to `%TEMP%\rt342_vb\`.
Full gate and eval driver NOT run (boundary owner's); targeted test files only; no keyed calls.

## Task 2 — destruction audit: CLEAN

Exact output of the checks:

| check | result |
|---|---|
| `git ls-files` count | **1904** (expected) |
| `baseline_tracked.txt` count | **2096** |
| missing vs baseline | **192**, every one under `.t4scratch/` |
| added vs baseline | **0** |
| `git diff --cached --diff-filter=D` | **192**, all under `.t4scratch/` |
| cached non-delete / rename entries | **0 / 0** |
| unstaged file deletions/renames | **0** |
| `.t4scratch/` on disk / tracked | **absent / 0** |
| `git stash list` | empty |

1904 + 192 = 2096. The exact missing-entry set is the 192 tracked files under `.t4scratch/**`
(sample: `.t4scratch/lib/algorithms.test.ts`, `.t4scratch/lib/app-data/index.ts`, …);
**no entry outside `.t4scratch/` is missing**. Removal is index + disk. Nothing else deleted or renamed.

## Task 1 — wave census (added lines, `git diff` + `git diff --cached`)

Scanned every added line across `src/lib/**`, `src/components/**`, `scripts/**` for
`TODO`/`FIXME` bodies, `as any`, `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`, empty
`catch {}`, `.only(`, unconditional `.skip(`/`xit`/`xdescribe`, `eslint-disable`,
hardcoded `return true`/`exit 0`, and `console.log` leftovers. Cached diff adds no content
(pure deletions), 0 hits. Working diff: **3 hits, all honest**, no others:

- `src/lib/llm/providers/registry.ts:315` [TODO] — inside the `failoverArmingGap` doc: the failover
  chain cannot honestly be armed (candidate `xai` has 0 verified ids; nothing registers a probed
  descriptor). **Honest** — the bytes return a coded refusal derived from the registry, not a fake arm.
- `src/lib/llm/providers/registry.ts:744` [TODO(R13-f09)] — the call site stays UNARMED and returns
  `RT_E_VALIDATION` naming the exact missing pieces. **Honest** (explicit incomplete-feature marker,
  loudly refused).
- `src/lib/llm/providers/registry.ts:760` [TODO(R13-f09)] — same refusal message. **Honest.**

No `as any`, no `@ts-*`, no empty catch (all added catches bind `err` and rethrow/log/return coded),
no `.only`/unconditional `.skip`, no `eslint-disable`, no debug `console.log`, no hardcoded
`return true`/`exit 0`. No comment found that claims behaviour the bytes do not implement *in the
added lines* — except the cross-file claims listed under Task 5 (one stale pre-existing comment and
one overstated lane-doc claim).

## Task 3 — honesty of the new `firstRun` bar

Mechanism (verified in `maker-score.ts` + `run-eval.mjs`):
- `barForRunKind(when, "first")` returns the grader's `firstRun` block iff declared;
  `barForRunKind(when, "warm")` (or no `firstRun`) returns the warm bar with **no exclusions**.
- `passesAcceptance` now judges `criteriaMeanExcluding(row, bar.excludeCriteria) >= bar.meanAtLeast`.
- All **11 graders** declare `{ meanAtLeast: 1, firstRun: { meanAtLeast: 1, excludeCriteria: ["M7"] } }`
  (checked by parsing all 11 `.grader.json`).

Re-derivation over the real records (temp script driving the repo's own `maker-score.ts` +
`run-eval.mjs` `loadGrader`), **identical on host v24 and Node 22**:

```
graders loaded: 11
history rows: 40 oldPass: 2 newPass: 2 bothFail: 38
newly pass (new && !old): 0
results coffeehouse2home-property-ledger: runKind=first oldMean=0.3333 newMean=0.375 oldOk=false newOk=false
counterfactual all-8-green first run: newMean 1 newOk true
```

- (a) **keyless/floor still fails both bars** — the one stored results row (M1–M4=0, M5/M8/M9=1, M6=0)
  is 0.3333 old / 0.375 new, fail both. The keyless history floor shape (M1–M4=0, M5/M6/M8/M9=1) is
  4/8 = 0.5 < 1, fail both.
- (b) **warm still requires M7** — warm bar has no exclusions, so `mean >= 1` needs all nine incl. M7;
  pinned by maker-score/run-eval tests and by the arithmetic.
- (c) **only all-8 scoreable cards newly pass** — with `firstRun.meanAtLeast = 1`, a first run clears
  iff all eight non-M7 criteria are 1. Such a card had old mean 8/9 < 1, so old refused. The
  counterfactual confirms exactly this shape passes new while failing old.

### Holes that could let a hollow run pass
1. **The grader is trusted, not bounded.** `parseGrader` accepts any `firstRun.meanAtLeast ∈ (0, 1]`
   and any `excludeCriteria` subset of the nine ids; nothing pins `1` or restricts exclusions to
   `FIRST_RUN_UNSCOREABLE_CRITERIA`. Demonstrated: `{meanAtLeast: 0.5, excludeCriteria:["M7"]}` and
   `{meanAtLeast: 1, excludeCriteria:["M1","M2","M3","M4"]}` both parse `ok:true`. With the former, the
   keyless floor (4/8 = 0.5) **passes** — a pass the old bar refused. Current 11 graders are safe; the
   mechanism is not. This is the strongest hole versus the "cannot mint" claim.
2. **Keyless runs escape the floor gate.** `synthesisSucceeded` is `undefined` for keyless mode, so
   `scoreMaker`'s M1–M4=0 override never fires. The "keyless floor fails" result is therefore
   empirical (stored keyless cards score M2=1 but M1/M3/M4=0), **not structural**. A keyless first
   run scoring all eight non-M7 greens would newly pass; the tests model the keyless floor as
   M1–M4=0, which is an assumption, not an enforced invariant.
3. **`rubricMeanForRow` defaults an absent/unknown `runKind` to `"first"`.** Live rows always carry
   `runKind` (set in `runTrial`), and `passesAcceptance` has no other caller; but any legacy/external
   caller handing a warm row without `runKind` gets the M7-excluded bar.
4. **Partial `criteria` maps.** `criteriaMeanExcluding` averages whatever keys exist; a row with only
   green subset keys would compute 1. Real cards always carry all nine, so not currently reachable.

## Task 4 — M7 semantics

Guard: `m7Learning` now returns `score:0` when `priorSum === 0`, **before** `mineSum >= priorSum`.
- Pre-fix `mineSum >= 0` was vacuously true, so every row whose prior had m1+m2+m3 = 0 minted M7=1.
- history.json: **29 rows with m7=1; exactly 8 flip 1→0** under the guard (prior all-zero:
  i=6,12,13,14,15,16,25,31). The lane's count is confirmed.
- Real prior: the `priorSum > 0` path is byte-identical — 1 iff `mineSum >= priorSum`, 0 on
  regression. Non-regression is still required.

### Residual hole
`priorSum > 0` does not mean the prior carried real substance. **19 of the 29 m7=1 rows** have a
prior `[m1=0, m2=1, m3=0]` — M2 is the deterministic tree-run verdict, which a keyless/floor run
earns — and the current run mints M7=1 with `mineSum = 1` (often the same `[0,1,0]`). So the guard
closes the exact-zero variant but not the "prior substance is floor-level M2 only" variant; the doc's
"a prior … that itself carried substance" overstates the guarantee. These rows fail acceptance on
other criteria, so this is an over-claimed criterion, not (today) a minted pass.

## Task 5 — wiring census

New exports/fields/flags with **no production consumer**:
- `src/lib/maker-score.ts` `FIRST_RUN_UNSCOREABLE_CRITERIA` — imported only by its own test; the
  driver defines its own `CRITERIA_IDS` set and the graders hardcode `["M7"]`. The lane doc
  (`fixes/342_3_corpus-bar.md:68`) claiming it is "exported so the driver and the grader JSON cite one
  list" is **false against the bytes**.
- `src/lib/maker-score.ts` `meetsRunKindBar` — imported only by its own test. The wired predicate is
  `passesAcceptance`/`rubricMeanForRow`, which re-implements the comparison; if the two ever diverge,
  the test would stay green while the driver drifts.
- `src/lib/doctor.ts:58` `export type { McpToolsSurface as DoctorMcp }` — zero consumers anywhere.

Consumed as intended: `runKindOf`/`barForRunKind`/`criteriaMeanExcluding` (run-eval.mjs:97,2329,2524);
`researchLive` (run-eval→headless→runPhase); `deliveryKindOf`/`withDeliveryKind` (engine, scaffold,
codegen); `mcpToolsSurface` (doctorMcp→CLI); `MCP_*_ENV` (internal to mcp.server.ts).

Claim comments contradicting bytes:
- `scripts/run-eval.mjs:2062` (pre-existing, made stale by this wave) still says `Project.kind` is the
  "3-way `app|tool|game` (types.ts E-15)"; `types.ts` is now the 5-way `DeliveryKind`.
- `maker-score.ts` M7 doc says "prior same-domain run"; `run-eval.priorFor` matches by **slug**, not
  domain. Pre-existing terminology drift.
- Verified **true**: `codegen.server.ts` claim that run-eval maps a corpus `service` to kind-absent
  (`run-eval.mjs:2079` returns `undefined` for library/service/""); engine stamps `kind:"service"`,
  and `singleModuleLibraryKind` does accept `"library" | "service"` (codegen.server.ts:4136-4144).
- Verified **true**: `errors.ts` removed `RT_E_UNATTENDED_UNSUPPORTED` with zero remaining live
  references (only comments/docs), and `console.tsx`'s updated comment matches.

Dead exports removed by the wave (verified zero importers): `DEFAULT_EVAL_OUT_DIR`,
`GitLandSeat`, `resolveGateAppDataBase`/`getConnectorAccessToken`, `overdueRowSeed`/`timeoutRowSeed`.
Their tests still pass.

## Targeted tests (both runtimes, TAP)

| file(s) | host v24 | Node 22 |
|---|---|---|
| `src/lib/maker-score.test.ts` | 91/91 | 91/91 |
| `scripts/run-eval.test.mjs` | 55/55 | 55/55 |
| `engine + scaffold + mcp.server + headless` | 294/294 | 294/294 |
| `codegen.server + registry` | 259/259 | 259/259 |
| `scripts/cli-exit-taxonomy.test.mjs` | 42/42 | 42/42 |
| `src/lib/errors.test.ts` | 39/39 | 39/39 |
| `git.server + scorecard + watchdog + app-data` | 74/74 | 74/74 |

0 fail anywhere. No `.only`/unconditional `.skip` in the added test bytes.

## Not verified / limits
- Full gate and eval driver not run (out of rules): no end-to-end keyed pass data; the honesty
  derivation is over stored JSON + source + unit tests.
- The keyless floor's actual M1–M4 under the current driver was not re-measured (would require the
  driver); evidence is the stored history (M1/M3/M4=0, M2=1).
- `tsc --noEmit` not run (part of the gate); compile safety inferred from the passing test runs.
- The `researchLive` p7-research claim (that the keyed drain now runs a live research layer) is not
  end-to-end verified.

## Verdict
Destruction: clean. Census: 3 honest TODOs, no real violations. New bar: no stored row newly passes,
and with the current 11 graders a newly-passing card must have all eight scoreable criteria = 1 —
but the *mechanism* trusts the grader for both the threshold and the exclusions, and the keyless
floor guarantee is empirical rather than structural. M7: closes the 8 vacuous rows exactly; a prior
whose only substance is floor-level M2 still mints. Three new exports have no production consumer.
