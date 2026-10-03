# 341-3 · evidence → delivery — the 340 spine residuals, the airtightness hunt, and a real packet

**Lane:** 341-3 (persona: evidence → delivery chain). **Opened** 2026-10-03 at HEAD `2d5ee35`.
**Owned (STRICT):** `src/lib/verify.ts`, `src/lib/verify.server.ts`, `src/lib/packet.ts`,
`src/lib/handoff.ts` + `verify.test.ts`, `verify.server.test.ts`, `packet.test.ts`, `handoff.test.ts`
+ this log. Nothing else edited.
**Runtimes:** host `node` v24.15.0; pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
Every `node --test` run passes `--test-reporter=tap`. **Scratch:** `%TEMP%\rt341_3\`.
**Keyed LLM calls: 0** (measured usage 0; every model seam was injected/tripwired — none was needed).

> **Environment note (honesty).** The tree was **not** clean during this lane: sibling 341 lanes were
> mid-edit on `doctor*`, `maker-score*`, `store*`, `llm/providers/*`, `console.tsx`, `headless.ts`,
> `engine.ts`, `scripts/run-eval.mjs` (and untracked `fixes/341_4_console.md`, `fixes/341_5_governance.md`).
> My edits are confined to the four source files + three test files above; `handoff.ts` was **not**
> changed (no fix was needed there). No sibling file was touched.

---

## 0. Reconciliation — the 340 wave's own named residuals

| # | Residual (from `fixes/340_3_spine.md` §4 / `fixes/340_0_parent.md` §4) | On disk at open | Disposition |
|---|---|---|---|
| 1 | `verify.server.ts` `oracleSignatureFunctionNames` — exported, **zero call sites repo-wide** | confirmed (declaration only; 0 code refs in `src/**`, `scripts/**`; docs/logs only) | **CLOSED** — removed (declare-or-strike) |
| 2 | `VerifyOutcome.lint` — produced, **never read** by any consumer | confirmed (`verify.server.ts:1820` produced; `verify.ts` `VerifyOutcomeShape` omitted it) | **CLOSED** — a real consumer now renders it into the verify artifact |
| 3 | `withCommonJsExports` under-covering `async function`/generators → honest `NO_CALLABLE_EXPORTS` | confirmed (`/^function\s+NAME\(/m`) | **CLOSED** — the declaration-family forms are now bound |
| + | verifier B (340-8 §2 hole): `applyVerifyOutcome` minted `tested` from a non-empty **junk** `cases` array | confirmed (`[null,42,{}]` mints) | **CLOSED** (airtightness, below) |

Baseline at open (targeted, both runtimes): owned `verify+verify.server+handoff+packet` **213 / 213 / 0**;
`codegen.server.test.ts` (read-only regression) **202 / 202 / 0**.

---

## 1. Residual 1 — the dead export `oracleSignatureFunctionNames` — CLOSED

`verify.server.ts` carried a duplicate of `codegen.server.ts`'s `signatureFunctionNames`
("duplicated here so verify.server.ts never has to import a module that imports it back"). Every
caller threads the derived names in (`generateCases(source, brief, signatureNames, …)`), so the
verify-side copy had **zero call sites** — not even its own tests. The 340-3 log declined it as "a
cross-module contract change"; re-measured, there is no contract (0 importers), so it is removed.

- **Patch:** deleted the function + its doc (26 lines) from `src/lib/verify.server.ts`.
- **RED (pre-fix, Node 24, `--test-name-pattern="341-3"`):**
  `not ok 3 - 341-3 — no dead oracle-signature duplicate is exported` →
  `not ok 1 - verify.server.ts no longer exports \`oracleSignatureFunctionNames\``.
- **GREEN:** the new wiring-guard test passes; owned suites green (below). codegen keeps its live
  `signatureFunctionNames` (untouched, 202/202).

## 2. Residual 2 — `VerifyOutcome.lint` (produced, never read) — CLOSED by giving it a consumer

`verify.server.ts` produced `lint?: LintFailure[]` on passed/failed outcomes, but the only consumer
seam (`verify.ts` `applyVerifyOutcome`) typed a `VerifyOutcomeShape` that **omitted** `lint`, so the
structured findings (rule · occurrences · first offending line · message) died after the one-line
`evidence` suffix — a declared field no consumer evaluated.

- **Patch (`verify.ts`):** `VerifyOutcomeShape` now carries `lint?: VerifyOutcome["lint"]` (the doc
  comment that said "consumers that need lint… use VerifyOutcome directly" was stale and is rewritten);
  `applyVerifyOutcome` renders the findings into the verify artifact body as a **non-blocking**
  `Lint advisory (non-blocking):` block (rule ×N @Lline — message). Advisory semantics unchanged: a
  lint-bearing pass still mints `tested`.
- **RED (pre-fix):** `not ok 6 - 341-3 — the produced \`lint\` field reaches the delivered verify artifact`
  → `not ok 1 - renders the structured findings into the artifact body … error: 'the first offending
  line reaches the artifact'` (the pre-fix artifact carried no rule/line).
- **GREEN:** the artifact body now carries `- no-var ×2 @L5 — …`, and the pass still mints `tested`.

## 3. Residual 3 — `withCommonJsExports` under-covering `async function`/generators — CLOSED

The audit-46 binding matched only `/^function\s+NAME\(/m`. An engine/foreign module whose only
callable was an `async function` or a generator was left unbound, the harness measured zero callables,
and the run refused with the honest but under-covering `NO_CALLABLE_EXPORTS` — a callable API the
transform failed to expose.

- **Patch (`verify.ts`):** the match is now the declaration family
  `/^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/gm` (plain · `async` ·
  generator · async generator, each optionally `export`-prefixed). The doc states what is **deliberately
  not** covered and why: `const f = () => {}` / `const f = function(){}` function-VALUES and classes
  still fall to the honest `NO_CALLABLE_EXPORTS` refusal — a bounded text transform cannot tell a
  function value from any other initializer without risking a false binding.
- **RED (pre-fix):** `not ok 4 - 341-3 — withCommonJsExports covers async + generator declarations` with
  `error: 'the async declaration is bound (got "async function loadData() { return 1; }")'` and
  `error: 'the generator is bound'`; plus the runner test
  `not ok 4 - an async-only module becomes machine-runnable` (the pre-fix transform's output compiled to
  zero exports).
- **GREEN:** `module.exports.loadData = loadData;` / `module.exports.stream = stream;` /
  `module.exports.drain = drain;` are appended; the runner test machine-passes
  `runCases(withCommonJsExports("async function loadData()…"), "typeof loadData === 'function'")`.

## 4. Airtightness hunt — findings in my slice

| # | Class | Finding (`file`) | Reachable? | Disposition |
|---|---|---|---|---|
| A1 | verdict minted without a genuine green run | `verify.ts` `applyVerifyOutcome` accepted `cases: [null, 42, {}]` (non-empty, no runnable expression) and minted `tested` (verifier B 340-8 §2 hole) | yes (foreign/corrupt envelope over the store/CLI/headless apply seam) | **CLOSED** — the passed mint now requires ≥1 case with a non-empty string `expression`; a well-formed case still mints (control test) |
| A2 | hash omits an input it claims to cover | `packet.ts` `packetInputHash` claimed to fold "the SAME inputs the compile reads, PLUS those content-only inputs" but omitted `brief` — a brief edit changed the Mission bytes while `input_hash` stood still | yes (the hash exists to catch exactly this class) | **CLOSED** — `brief` is folded (with the compile's own coercion); the doc now enumerates the folded fields instead of over-claiming |
| A3 | comment claims behaviour the bytes do not implement | `verify.ts` "No-op when the source already exports" — only `module.exports` was detected, not the `exports.x = …` style | n/a (doc) | **CLOSED** — doc + inline comment now state the real guard and why the `exports.x` alias is redundant-not-wrong |
| A4 | `every()`-on-empty vacuous truth | `runCases` `[...expected].every(...)` / `results.every(...)` | no — zero cases refused at entry; `expected`/`results` are non-empty at the `every` sites | re-audited: not vacuous |
| A5 | check that cannot fail | `handoff.ts` / `packet.ts` — none found (guards are real shape probes; DoD from `runGate`) | — | none |
| A6 | declared field no consumer reads | remaining exports audited (§6); the only truly dead one was A/R1 | — | closed (§1) |
| A7 | always-zero counter | none in the four files | — | none |

**Named, not closed (with the reason it must stay):**
- **`import.meta.url`-only ESM** is not matched by `esmModuleUnsupportedReason` (the `import` token
  must sit at a statement boundary), so it falls to the generic harness compile marker. Still **no
  false mint** (`runCases` returns `pass:false`), and it cannot appear in the materialized barrel the
  seam actually feeds (`export * from …`). Precision gap, not a correctness gap (verifier B, 340-8 §2).
- **`const f = () => {}` function-values / classes** are not bound by `withCommonJsExports` — an
  honest `NO_CALLABLE_EXPORTS` refusal; a wrong binding would assert an export the module never made.
- **`packet.ts` `// TODO(F2-07)`** (`exportProfiles`, zero non-test consumers, test-pinned key set) is
  pre-existing and out of this mission's scope; wiring the six tool wrappers is a UI/CLI surface change
  (STOP-and-REPORT shape), not touched here.
- **`applyVerifyOutcome` trusts the inbound `status: "passed"` label** — it is an APPLY seam, not a
  verifier, so it proves the envelope is *shaped* like a runner pass (evidence + a runnable case set +
  the executed source), never that one occurred; it cannot re-run the harness. The genuine-run
  guarantee is the transport (`store.runVerifyAsync` / `headless.verifyGeneratedSource` call
  `verify.server`'s runner). No pure apply function can prevent a hostile caller from fabricating any
  shape, so this is the honest boundary rather than a check that pretends to close it.

---

## 5. Packet completeness — proof on a REAL keyless run

A real keyless run (no `DEEPSEEK_API_KEY`, CLI only, scratch `%TEMP%\rt341_3\packetproof\`):
`create --brief "A logistics fleet healthcheck tool: dispatch, track, and reroute vans; offline
warehouse scan; techs manage parts." --name FleetHealth` → `gate --autopilot` (parked P4) →
`approve --seat autopilot` ×2 → P6 hard-DoD block (`sealedWithFailures: true`, exit 1). The project
records 18 artifact rows (17 deliverable + its own packet row), 6 A7 oracle rows, the deterministic
P6 floor source, and a genuinely RED `p6-verified`/`p6-brief-fit`.

The stored packet is served by `packet` (pre-stamped); a **live recompile** through the production
compiler was produced with `packet --project fleethealth.json --knowledge store.json --out packet_live.md`
(empty valid store `{"version":1,"entries":[]}`), so the packet reflects the current bytes. Its
`bytes: 14173` on disk is the UTF-8 byte count of a JS-`length` ≤ 14000 (multi-byte `—`/`≤`/`·`); the
truncation marker is present and the invariant-tail survives.

What an external agent actually gets (extracted from `packet_live.md`):

| Requirement | Present | Bytes |
|---|---|---|
| **Current edge/phase** | `## Current edge` → `P6 — Code Generation, Testing & Deployment`; System JSON `current_phase {id:6,code:"P6",hitl_gate:false}` | ✓ |
| **DoD + unmet items** | `Gate P6: FAIL (2 unmet)` + the `[x]/[ ]` checklist incl. the AUGMENTED `p6-brief-fit` state line (`— deterministic floor state — … missing: logistics, fleet, …`) | ✓ |
| **The inputs** | `## Mission` (brief), `## Intent lattice`, `## Spec graph order`, `## Contracts`, `## Oracle` (6 rows), `## Ranked memory`, `Generated artifact: single module (project.generatedSource)`, `input_hash`, `phase_coverage 7/13` | ✓ |
| **Expected output shape** | System JSON `report_schema {phase,status,summary,files,tests_run,artifacts}` + `## Required output schema` | ✓ |
| **Exact runnable command + spec path** | `` from the emitted tree root: `npm install`, then `npm run typecheck`, then `npm test` — `npm test` executes the emitted oracle spec (`tests/oracle.spec.ts`) `` | ✓ |
| **Persisted artifact census** | **NEW (341-3):** `Census: 17 artifact row(s) recorded — the newest 8 render below (window ≤ 8; the packet's own row is excluded).` | ✓ |

**Fix made:** the `## Artifacts` section previously listed the newest ≤8 bodies under a "(trimmed)"
heading but never stated how many rows were on record, so a continuation could not tell a complete
list from a window. The section now opens with the explicit census. The count excludes the packet's
own row (the same bookkeeping exclusion `phaseCoverage` applies), and the line is omitted when no rows
are recorded so the "(none yet)" form stays byte-identical — **including across `stampPacket`**, which
appends the packet row (the first cut counted `artifactRows.length` and broke H-05/D2 byte-idempotence;
caught by the suite and fixed to the non-packet count).

RED/GREEN:
- `not ok 1 - 341-3: the packet states the persisted artifact census … error: 'the census names the real
  row count (got "### P3 · DoD gate - P3")'` → GREEN `Census: 3 artifact row(s) recorded — the newest 3…`.
- Control: a zero-artifact project keeps `(none yet)` and gains no census line.

---

## 6. Wiring audit (exports consumed, or reasoned-allowlisted)

Non-test consumer counts (`src/lib`, `src/routes`, `src/components`, `scripts`, `.mjs`, tests excluded):

| File | Export | Non-test uses | Disposition |
|---|---|---|---|
| `verify.server.ts` | `oracleSignatureFunctionNames` | 1 (declaration only) | **REMOVED** (§1) |
| `verify.server.ts` | `VerifyServerFn`·`OracleExpressionCheck`·`OracleCasesParse`·`ExportProfileId`·`ExportProfile`·`PacketSpend`·`PacketBudget`·`PacketProvenSeed`·`LessonRefusal`·`CaseResult` | referenced by an **exported** signature/field | allowlisted: public seam types |
| `verify.server.ts` | `REJECTION_DETAIL_MAX_CHARS`·`REJECTION_EXPR_EXCERPT_MAX_CHARS` | internal read only | allowlisted: documented audit bounds |
| `verify.server.ts` | `runCases`·`sanitizeOracleExpression`·`parseOracleCases`·`parseOracleJson`·`lintFailures`·`stripTypeAnnotationsForHarness`·`esmModuleUnsupportedReason`·`undefinedCaseIdentifiers`·`caseNameBindingOffenders`·`oracleBriefGrounded`·`buildOracleCasesPrompt`·`droppedPinnedOracleIds`·`generateCases`·`verifyAndFixServer`·`NO_CALLABLE_EXPORTS_REASON`·`NO_EXPORT_REFERENCE_REASON`·`ESM_MODULE_UNSUPPORTED_REASON` | ≥2 | consumed |
| `verify.ts` | `verifyAndFix`·`withCommonJsExports`·`applyVerifyOutcome`·`VerifyOutcomeShape`·`VerifyOutcome` | ≥3 | consumed |
| `packet.ts` | `compileAgentPacket`·`exportProfiles`·`PACKET_VERSION`·`packetInputHash`·`packetBudgetBoundary`·`PacketBudget`·`PacketSpend`·`PacketProvenSeed`·`ExportProfileId`·`ExportProfile` | ≥2 | consumed (via packet itself + tests) |
| `packet.ts` | `packetSpendSummary` | 1 (internal + `compileAgentPacket`) | allowlisted: documented spend reader |
| `handoff.ts` | `phaseHandoff` | 10 | consumed |

`exportProfiles` remains non-test-consumed but test-pinned, with a pre-existing `TODO(F2-07)` KEEP note
(reported in §4, not touched).

Comments-vs-bytes: the one real drift found in my slice (`withCommonJsExports` "already exports") is
closed (§4 A3). No other added/modified comment was found to claim unimplemented behaviour.

---

## 7. Double-check of the two 340 verifier logs, for findings in this slice

- **`fixes/340_7_verifier-a.md`** — claims MCP (340-1), cassette (340-4), emitted UI (340-6). **No
  finding in `verify*` / `packet` / `handoff`.** Nothing to fix; not re-verified here (assigned scope).
- **`fixes/340_8_verifier-b.md` Claim 2 (spine)** — CONFIRMED the 340-3 work; its two holes:
  1. `applyVerifyOutcome` accepts a non-empty-but-JUNK `cases` array and still mints `tested` →
     **FIXED** (§4 A1).
  2. `import.meta.url`-only ESM falls to the generic compile marker, not the coded ESM reason →
     **NOT FIXED / named** (§4): honest (no false mint) and unreachable through the materialized-barrel
     path; the coded-reason precision gap remains as a disclosed boundary.
  Also re-confirmed: the 337-3 hash fixtures still distinguish their shape (340-8 §2.2 mutation test),
  and the ESM refusal precedes all model wire.

---

## 8. Regression counts (both runtimes)

| Suite | Node 24.15.0 | Node 22.23.2 |
|---|---|---|
| `verify.test.ts` + `verify.server.test.ts` + `handoff.test.ts` + `packet.test.ts` (owned) | **224 / 224 / 0** | **224 / 224 / 0** |
| `341-3` slice (`--test-name-pattern`) | **11 / 11 / 0** | **11 / 11 / 0** |
| `codegen.server.test.ts` (read-only regression) | **202 / 202 / 0** | **202 / 202 / 0** |
| `headless.test.ts` (extra read-only — `packet.ts` consumer) | **153 / 153 / 0** | not run |
| `wild-step.test.ts` (extra read-only — masks `input_hash`) | **35 / 35 / 0** | not run |

Owned baseline 213 → **224** (+11: 7 `withCommonJsExports`/junk-mint/lint in `verify.test.ts`, 1
dead-export guard in `verify.server.test.ts`, 3 census/brief in `packet.test.ts`). No test deleted or
weakened. **No full gate, no `npm test`, no build.** `headless`/`wild-step` were added beyond the
mandated set because a `packet.ts` change is cross-module; both green.

---

## 9. Mock / fake census

`git diff -U0` added-line scan over the seven changed files for
`TODO|FIXME|XXX|as any|@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable|catch {}|.only(|.skip(|
hardcoded|TEMP-RED`: **0 hits** (the temporary `void briefText` RED scaffold was removed before commit;
re-scanned clean). No hardcoded returns, no placeholder bodies, no silent catches. Test doubles: none
new — the async runner test uses the real bounded runner; the lint/census/junk tests use plain values;
the real-packet proof ran the real CLI against a real temp project. Every new assertion proved RED
before the fix.

## 10. Keyed usage

**0** keyed LLM calls. The real run and the packet proof are entirely keyless
(`DEEPSEEK_API_KEY` unset). No secret was read or printed.

---

## 11. Verdict

**Works.** The evidence→delivery chain is airtight across the four owned seams: a `tested` verdict can
no longer be minted without a real case set (junk `[null,42,{}]` refused) or without the bytes a run
produced; the produced `lint` field now reaches the delivered artifact; the dead duplicate export is
gone; and the agent packet, on a genuine keyless run, carries the current edge, the DoD + unmet items,
the inputs, the output shape, the exact command + spec path, and — newly — the persisted artifact
census.

**What remains (named):** `import.meta.url`-only ESM still falls to the generic compile marker (no
false mint; not reachable via the materialized-barrel seam); `const` function-values/classes remain an
honest `NO_CALLABLE_EXPORTS` refusal; `packet.ts` `TODO(F2-07)` (`exportProfiles` wiring) is a
UI/CLI surface change, untouched.

## 12. STOP-and-REPORT

None. Every residual was solvable inside the four owned files; no cross-file contract change was
required. The sibling-lane in-flight edits to `engine.ts`/`headless.ts`/`llm/providers/*` etc. were
read-only for me and did not affect the owned suites (both runtimes green).

## 13. What I did NOT do

- Did not run the full gate, `npm test`, `npm run build`, `gate.sh`, or a repo-wide `tsc`.
- Did not touch any file outside the seven owned paths (no `handoff.ts` edit was needed; no sibling,
  no docs, no CLI).
- Did not make any keyed/network call; did not print a secret.
- Did not delete or rename any tracked file; the only new file is this log.
- Did not close `TODO(F2-07)` or the two named ESM/function-value boundaries (reported with reasons).
