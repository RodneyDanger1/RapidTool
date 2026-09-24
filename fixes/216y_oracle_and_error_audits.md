# 216y — TA-11 oracle-strength audit + TA-12 error-handling audit

**Wave:** W10 · **Lane:** L5 — verification lane: reports defects, fixes nothing, docs-only.
**Sources:** `wave_plans/W10/lane-5.md`; dossier 105 TA-11 (:576) / TA-12 (:585); dossier 102 §4 rec. 2
(:193-195, signal 9) / rec. 3 (:196-197, signal 10).
**Method:** static reads of `src/lib/scaffold.ts` · `codegen.server.ts` · `doctor.ts` · `compile-check.server.ts`
· `errors.ts` · `scripts/rapidtool-cli.mjs`; probe scripts live OUTSIDE the repo in
`C:\Users\mnril\w10l5_scratch\` (`scan_errors.mjs`, `probe_classify.mjs`, `probe_census.mjs`); emitted-tree runs
are read-only `node --experimental-strip-types --test` invocations. Every claim below is a file:line or a
command actually run (ledger at the bottom). No fixes.

## §1 TA-11 — oracle-strength audit

**Specimens on disk** (read-only; all emitted prior to this lane — no emissions performed by L5):
- **S1** `C:\Users\mnril\w9l5_scratch\w9l5_emit` — emitted 2026-09-17 09:29 (packet `6b77ad0f`), single-module mode.
- **S2** `research/eval-out/rental-portfolio` — emitted 2026-09-16 21:41, host-template mode.
- **S3** `research/eval-out/coffeehouse2home-property-ledger` — emitted 2026-09-10; the **only tree-mode spec**
  on disk (grep `"TREE mode"` across eval-out + all scratch tree roots → 1 hit).

### 1.1 Representative pins — classification (11 pins; emitter line = `src/lib/scaffold.ts`)

| # | Pin (emitted test) | Emitter | Class | Specimen:line | Evidence |
|---|---|---|---|---|---|
| 1 | `tree.entry` — tree loads, namespace has ≥1 export | :1367-1376 | **REAL** (the import IS the load assertion) | S3 spec:45 | RUN-3: whole spec FAILED to load (green→red is real) |
| 2 | `module.synthesize` — valid phase+job → ok | :1398-1403 | **REAL** (behavioral, template) | S2 spec:34 | RUN-2 pass |
| 3 | `module.synthesize` — out-of-range phase / unknown job rejected | :1405-1412 | REAL but **generic** (row-independent) | S2 spec:41-46 | RUN-2 pass |
| 4 | `module.synthesize` — rejection-note branches | :1414-1424 | **GUARDED** (branches on generated `REJECTION`; asserts in both arms) | S2 spec:50 | RUN-2 pass |
| 5 | `store.checkpoint` ×3 — write/read/replace | :1436-1456 | REAL, but asserts the scaffold-owned stub's semantics (`src/state/store.ts` is itself a `TODO(E-15)` file) | S1 spec:29-49 | RUN-1 pass |
| 6 | `api.endpoints` — `ENDPOINTS` deepEqual A6 contract | :1469-1472 | REAL **self-consistency only** (both sides generated from the same contract; `route()` never called) | S1 spec:55-57 | RUN-1 pass |
| 7 | bridged-host rows (`orc-2/3/4`) | :1521-1531 | **OBSERVED-ONLY, row-independent**: identical 2 generic `synthesize(phase 13/-1)` throws for every leftover job | S2 spec:118-143 | RUN-2 pass |
| 8 | endpoint-stub rows (`orc-1`, `orc-c-*`) | :1532-1550 | **OBSERVED-ONLY**: asserts the seam REJECTS `/TODO\(E-15\) stub/` — green while the row's `expect` ("200 + persisted entity + checkpoint") is unmet; FAILS the moment the seam is implemented | S1 spec:65-133 | RUN-1 pass (5 rows) |
| 9 | tree-job rows (`jobMod_*`) | :1551-1577 | **GUARDED probe**: export-surface asserts are real; the behaviour call is wrapped in a catch that swallows every non-ReferenceError throw (:1564-1569) — a job function throwing on `{payment:1}` still passes | none on disk (`grep jobMod_/jm_` = 0 hits) | **not run — static read only** |
| 10 | `capability.N` presence rows | :1646-1661 | **PRESENCE PROXY** by construction (identifier/source-text presence; the assert message says so, :1606-1619) | S3 spec:133+ (25 rows) | RUN-3: could not execute (spec load failure) |
| 11 | unimplemented row → `test.skip("<id> — NOT IMPLEMENTED")` | :1586-1601 | **SKIP** (visible; never green) | S1 spec:135-143 (`orc-phase`) | RUN-1: 1 skipped |

### 1.2 The honest strength envelope

What can actually fail today: template behaviour (#2-#4), the scaffold store's round-trips (#5), contract
equality (#6), tree load (#1), capability absence (#10), and stub-rejection divergence (#8 — it fails whenever
a seam gains an implementation). What cannot fail **for the row's own reason**: #7, #8, #9, #10 — i.e. every
row class that is supposed to speak for a *job's* acceptance criteria. Fresh keyless emissions are dominated
by that class: S1 has 5/6 row tests observed-only (#8), S2 has 4/5 pinned rows row-independent generic (#7/#3).

**Weakest classes (named).**
- **W1 — observed-only stub-rejection rows** (#8). The majority row class in S1 (5/6 tests). Green exactly
  while the brief is unimplemented; the "signal" is inverted (test goes red at implementation time).
- **W2 — row-independent generic assertions** (#7, #9-adjacent, #3/#6 variants). The same two `assert.throws`
  lines are emitted under any row id; the assertion would be byte-identical if pasted under any other row, so
  no row's prose is ever exercised.
- **W3 — guarded tree-job probe** (#9): the only call into real job code is exception-swallowing; plus **no
  emitted tree on disk exercises it at all** (`grep jobMod_`/`jm_` → 0) and the brief-fixture section 6
  (`scaffold.ts:~1666-1706`) is likewise unexercised — both unverifiable from specimens today.
- **W4 — presence proxies** (#10): identifier/source-text checks emitted as ordinary `test(...)` rows and
  counted by the same census as behavioural rows; explicitly "a PROXY, never behavioral proof"
  (`scaffold.ts:1204-1205`, `:1612-1619`).

### 1.3 Census machinery vs the claims

- `censusOracleRows` (`scaffold.ts:1071-1086`) has exactly **two buckets**: `assertable` / `notImplemented`.
  The claim template it feeds (`scaffold.ts:1994-1995`) renders as S1 `README.md:76` ("5 of 6 pinned row(s)
  assert the emitted modules' real current behavior; 1 are NOT IMPLEMENTED") and S2 `README.md:75` ("all 5
  pinned row(s) assert … — no NOT IMPLEMENTED skips"). Both are literally true; neither distinguishes
  observed-only from expected. There is **no assert-expected vs assert-observed axis anywhere**.
- `run-eval.mjs:816-846` records only `oracleSpec` boolean + byte count — no assert counting.
- The only strength-adjacent machinery is spec-level: `specSourceHasAssert` requires ≥1 `assert.*` in the
  whole spec (`compile-check.server.ts:589-591`; masked so comments/strings can't mint green) and tree-run
  reds a spec where "no behavioral assertion ran" (`:682`). Not per-row, no expected-vs-observed.
- `verify.server.ts` (TA-11's named home) currently has: seeded E-08 pinning that REJECTS dropping an oracle
  id (`:14-19`), expression sanitization (`:123`), and advisory lint limited to `no-console|no-var|eqeqeq`
  (`:54-58`) — no strength audit.
- **Claim delta (declare-or-strike evidence, no fix here):** `README.md:92` marks "Oracle rows: each job
  module must pass its OWN behavioral test ✅ (engine)" while the freshest verified specimen carries
  `real: 0` job modules (RUN-4) and every job row on disk is observed-only (W1/W2). `doctor.ts:65-83`
  classifies an empty-bodied export as `"real"` unless the file carries a literal `TODO(E-15)`
  (probe: `export function flip() {}` → `real`), so "real ≥ N" is marker-dependent, not behaviour-dependent.
- **Verdict:** TA-11's done-when (an emitted tree scored with assert-expected vs assert-observed counts; an
  observed-only fixture failing the audit with file:line) is **NOT met today** — no scoring exists to fail.

## §2 TA-12 — error-handling audit

### 2.1 Grep/scanner-verified inventory (`w10l5_scratch\scan_errors.mjs`, 214 files)

- **368 catch blocks** (350 non-test: 259 `src/` + 91 `scripts/`; 18 in test files) + **24 `.catch()` handlers**.
- Classification (heuristic; ≤2-statement bodies without a signal token counted as "swallow"): 155
  signal-bearing · 87 code-free · 126 sentinel-swallow. Of the 87 code-free: **4 truly bare**
  (`src/lib/auth/popup.server.ts:149,152,153`; `src/routes/__root.tsx:69`), 83 carry an intent comment
  (temp cleanup / telemetry purity — e.g. `rt-client.ts:251` "never throw from a crash path").
- Heaviest catch files: `headless.ts` 44 · `store.ts` 17 · `rt-client.ts` 15 · `compile-check.server.ts` 13 ·
  `websearch.server.ts` 9 · `engine.ts` 9.
- **RT_E registry is complete:** 23 codes == 23 `ERROR_CODE_DOC` entries (`errors.ts:22-45`, `:218+`).
- **CLI coded refusals:** 76 explicit `code: "RT_E_*"` sites + 26 `...errCode(err, …)` spreads
  (`scripts/rapidtool-cli.mjs`); `respond()` pins exit-3 → `RT_E_LLM_NOT_CONFIGURED` and otherwise
  prose-classifies (`:114-149`).
- **Classifier reach (probe):** maps only a thrown object's RT_E `.code`, `ReportRejectedError`, ENOENT,
  AbortError/TimeoutError/ETIMEDOUT (`errors.ts:109-152`); everything else → `RT_E_UNKNOWN`.
- **No process-level handlers exist** for `unhandledRejection`/`uncaughtException` anywhere in `src/` or
  `scripts/` (grep → 0 hits); the CLI's exit-4 catch (`:2858-2867`) covers awaited work only.

### 2.2 Named seam status — `compile-check.server.ts` (dossier's TA-12 wiring target)

Present and working: loud unreadable-dir verdict (`:168`), 2 MB oversize → FAIL, "no behavioral assertion
ran" red floor (`:682`), tree-run fail-closed on missing entry verdicts (`:994-1000`). Missing entirely:
any detection of empty `catch`, unchecked non-void returns, or unhandled rejections — grep for such signals
in this seam → none. The parse gate's deliberate fail-OPEN (commented rationale, `headless.ts:2316-2344`) is
an accepted residual, not scored as a gap below.

### 2.3 Top gaps ranked by blast radius

1. **G1 — CLI dispatch continues past a handled project-load refusal (observed, reproducible).**
   `makeLoader` calls async `respond()` **without `return`** (`rapidtool-cli.mjs:370-381`); `respond` awaits
   `cliLogEvent` before `process.exit` (`:135-149`), so the verb proceeds with `undefined` and throws.
   Observed 3/3: `summary --project <missing>`, `packet --project <missing>`, `summary` (no flag) → raw
   `TypeError` stack on stderr (`headless.ts:987` via CLI `:1419`; `io.ts:397` via `headless.ts:946` via CLI
   `:737`), 1 coded JSON envelope on stdout, exit 1; the loader's `respond` races main's outer catch
   (`:2858-2867`, which then also prints the stack as if internal). Blast: 31 `loadProjectFor(` call sites;
   "single JSON object" contract noise; exit code decided by a two-respond() race.
2. **G2 — engine silent catch-all.** `runPhaseAsync`'s bare `catch { return applyPhaseResult(project, phase); }`
   (`engine.ts:3195-3201`) swallows every unexpected live-layer error with no code, no ledger/NDJSON row;
   mirrored in the UI path `store.ts:552-577` ("or threw → deterministic fallback"). Blast: keyed live-layer
   failures are invisible; a degraded run is indistinguishable from a deterministic one.
3. **G3 — classifier coverage holes.** EACCES / ENOSPC / ECONNREFUSED / ENOTFOUND / EADDRINUSE / "fetch
   failed" / JSON-parse errors all classify to `RT_E_UNKNOWN` (probe, 7/7), whose own doc says "the failure
   is opaque" (`errors.ts:218-226`). Blast: agents lose actionable guidance for the commonest env/network
   failures; every unmatched CLI failure inherits an unactionable code.
4. **G4 — TA-12's signal does not exist.** No scan of an emitted tree for empty catch / unchecked non-void
   return / unhandled rejection exists (2.2); an emitted tree can be `ok:true` while containing them. Blast:
   generated-product reliability; the named seam has no such wiring today.
5. **G5 — emitted product carries ZERO RT_E codes.** `route()` throws a plain `Error("TODO(E-15) stub: …")`
   (S1 `src/api/routes.ts:26-29`); grep `RT_E` across S1/S2 `src/` + `tests/` → 0 hits. Blast: consumers of
   emitted trees get text-only failures; the coded-refusal contract stops at the artifact boundary.
6. **G6 — unlogged LLM-shape swallows.** `parseSynthesisPatchEnvelope` (`codegen.server.ts:572-583`) and
   `parseSynthesisEnvelope` (`:1703-1714`) return `null` on JSON.parse failure with no log/code — an
   unparseable model reply is indistinguishable from "no output". Blast: keyed repair/synthesis degrades
   silently.
7. **G7 — code-free catches (87).** 4 truly bare (`popup.server.ts:149-153`, `__root.tsx:69` inline theme
   script), remainder comment-explained best-effort/telemetry. Blast: low; the bare four touch popup
   messaging/theme only.

### 2.4 Notable positives (so the ledger is honest)

`check --dir <missing>` → coded `RT_E_CHECK_FAILED` exit 1; `edit` no-match → coded refusal
`RT_E_VALIDATION`, `written:false` dry-run; `tree-run`/`emit --run` carry `RT_E_TREE_RUN_FAILED`;
registry/doc parity is total (23/23); `dod.ts:637` treats a throwing probe as an unmet criterion.

## Evidence ledger (commands actually run — results as returned)

```
# RUN-1 (S1)  cd /c/Users/mnril/w9l5_scratch/w9l5_emit
node --experimental-strip-types --test tests/oracle.spec.ts
→ # tests 10 / # pass 9 / # fail 0 / # skipped 1   (skip = "orc-phase — NOT IMPLEMENTED")
# RUN-2 (S2)  cd "…/RapidTool Main/research/eval-out/rental-portfolio"  (same node command)
→ # tests 14 / # pass 14 / # fail 0 / # skipped 0
# RUN-3 (S3)  cd "…/research/eval-out/coffeehouse2home-property-ledger"  (same node command)
→ not ok 1 - tests\oracle.spec.ts  (SyntaxError [ERR_INVALID_TYPESCRIPT_SYNTAX]: Expression expected
  at src/generated/check-reorder-flags.ts:44) → # tests 1 / # pass 0 / # fail 1
# RUN-4  cd "…/RapidTool Main"
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --tree "C:/Users/mnril/w9l5_scratch/w9l5_emit"
→ ok:true; factory.inventory {stubs:3, reexports:0, real:0}; autonomousSoftwareFactory:false; exit 0
# RUN-5  summary --project C:/nonexistent_nope.json  (and packet, and no-flag variants; streams split)
→ stdout: 1 JSON {code:"RT_E_PROJECT_MISSING"|"RT_E_VALIDATION", exit_code:1}; stderr: TypeError stack
  (headless.ts:987 / io.ts:397); exit 1 — 3/3 runs
# RUN-6  check --dir C:/nonexistent_nope → {ok:false, code:"RT_E_CHECK_FAILED", exit_code:1}
# RUN-7  edit --dir …w9l5_emit --file src/api/routes.ts --find NOTHING_MATCHES_XYZ --replace Y
→ {ok:false, mode:"dry-run", written:false, code:"RT_E_VALIDATION", exit_code:1}
# RUN-8  node scan_errors.mjs (w10l5_scratch) → files 214 / catch 368 / dot-catch 24 / signal 155 /
        code-free 87 / sentinel-swallow 126
# RUN-9  node probe_classify.mjs → 23 codes == 23 docs; EACCES/ENOSPC/ECONNREFUSED/ENOTFOUND/EADDRINUSE/
        "fetch failed"/JSON-parse → RT_E_UNKNOWN; ENOENT → RT_E_PROJECT_MISSING
# RUN-10 node probe_census.mjs → "export function flip() {}" (no TODO marker) → classifyJobSource "real";
        comment-only → "stub"; re-export → "reexport"
```

*Not run (stated honestly): tree-job rows + brief-fixture section 6 (no specimen exists — static read only);
no typecheck/lint/suite runs (audit lane; no repo writes besides this file).*
