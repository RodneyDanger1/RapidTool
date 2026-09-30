# 318 — A1: THE ORACLE FINISHER (wrong-output pin + run-eval dedup + T5.4 telemetry)

Lane: A1 (wave W44, Phase 1). Repo: `C:\Users\mnril\Desktop\RapidTool Main`.
Entry: HEAD=`091b389`, tree clean at dispatch (verified below).
Siblings live — one writer per file. No keyed calls. All legs FOREGROUND. Space in path ⇒ `rg`/search-tools fail; grep via terminal.
Box (one writer): `src/lib/compile-check.server.test.ts` · `scripts/run-eval.mjs` · `scripts/run-eval.test.mjs` · `src/lib/rt-events.ts` · `src/lib/rt-events.test.ts` · `fixes/318_a1_oracle.md`.
Maps: `fixes/317_j1_oracle.md` (J1 brief) · `fixes/317_k1_bugcheck.md` (K1-R1/R2/R3 + wire-don't-delete).

## Scope (task brief)

- **A1(1) THE WRONG-OUTPUT PIN** (K1-R1 authority): in `src/lib/compile-check.server.test.ts` — three cases:
  (a) good tree + correct declared row ⇒ `behavior.ok` true + `outcome.ok` true;
  (b) HEART: tree declares an `entry-runs` row the entry does NOT satisfy ⇒ `outcome.ok === false` AND the error names the failed row;
  (c) absent declaration ⇒ NO `behavior` key + byte-stable verdict hash (`treeVerdictHash` same across runs, same as no-declaration run).
- **A1(2) RUN-EVAL DEDUP** (K1-R2): wire the 9 dead imports in `scripts/run-eval.mjs` to `src/lib/entry-oracle.ts` / rt-events (NOT delete): replace inline expectedBehavior validation in `parseGrader` with `validateExpectedBehavior`; make local `checkExpectedBehavior` delegate to `checkEntryContract`+`runEntryOracle`+`manifestHas`/`manifestFind`; remove `evaluateEntryRunsRow` only if `runEntryOracle` fully covers its call site. `npx eslint scripts/run-eval.mjs` → 0 problems; `run-eval.test.mjs` green; records byte-identical; every kept symbol ≥2 grep hits.
- **A1(3) T5.4**: bounded run-level rt-events emissions from `run-eval.mjs` (host `cli`; scope per scaffolding comment; additive catalogue additions in `rt-events.ts`; update `rt-events.test.ts` pins + census note; behavioral pin in `run-eval.test.mjs`).

## Verdict table (filled as work completes)

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| S0 | Entry state: HEAD/tree/box files | DONE | HEAD `091b389`, tree clean (S0 log below) |
| S1 | Wrong-output pin (heart) lands; (a)/(b)/(c) all pass | **LANDED + PROVEN (A1)** | compile-check.server.test.ts +138; 60 tests · 59 pass · 1 skip · 0 fail; heart asserts ok:false + `/expectedBehavior contract FAILED/` + `r-wrong` + `/stdout lacks/`; (c) same-file-set hash cross-check |
| S2 | run-eval dedup wired; eslint 0; records byte-identical; test green | **LANDED + PROVEN (A1)** | −355/+43 lines; `BYTE-IDENTICAL — checks=36 fails=0` (19 parseGrader + 17 behavior cases); run-eval.test.mjs 43/43; ≥2 hits per kept symbol |
| S3 | T5.4 emissions + catalogue additions + pins | **COMPLETE (A1 catalogue + parent completion)** | rt-events.ts scope+3 names; emitter + 4 bounded sites landed by parent; census 60/22/38; behavioral proof: real `eval.run_end` ndjson row (host cli, scope eval-run) |
| S4 | rt-events.test.ts + run-eval.test.mjs green; typecheck/lint ≤1 | **GREEN** | rt-events 7/7 · run-eval.test 45/45 · eslint scoped 0 problems (typecheck at wave boundary) |

## Log

### S0 — entry state (2026-09-30)

```
$ cd "/c/Users/mnril/Desktop/RapidTool Main" && git rev-parse --short HEAD && git status --short
091b389
(clean)
```

(verbatim pending — recorded at first command above)

### S1 — the wrong-output pin (A1, landed + proven)

- `src/lib/compile-check.server.test.ts` (+138 lines, appended after the K3 substance suite); 3 cases:
  - (a) satisfied declaration ⇒ `behavior.ok:true`, `outcome.ok:true`
  - (b) HEART — `entry-runs` declaring `expectStdout:"NEVER-PRINTED"` ⇒ `ok:false` while `compile.ok:true`, all specs pass, load-import smoke passes; `behavior.failed:1`; error names the row (`/expectedBehavior contract FAILED/` + `r-wrong` + `/stdout lacks/`)
  - (c) absent declaration ⇒ `"behavior" in r1 === false`; hash byte-stable across reruns; same-file-set cross-check `treeVerdictHash({...rD, behavior:undefined}) === rN.verdictHash`
- Proof: `node --experimental-strip-types --test src/lib/compile-check.server.test.ts` → exit 0 · # tests 60 · # pass 59 · # fail 0 · # skipped 1 (pre-existing skip).
- Honesty note: first (c) cross-check compared trees with different file sets (hash moved on `compile.skipped`) — fixed, not weakened.

### S2 — run-eval dedup (A1, landed + proven)

- `scripts/run-eval.mjs` (43 insertions / 355 deletions): `parseGrader` now returns `validateExpectedBehavior(doc.expectedBehavior)`; oracle machinery deleted (budget/tail/env-allowlist/`packageTargetPaths`/inline loop); `checkExpectedBehavior` delegates to `checkEntryContract(rows, dir, manifestHas(files), manifestFind(files))`; `evaluateEntryRunsRow` kept as an exported thin delegate to `runEntryOracle`; dead `spawnSync` import removed.
- Proof: `npx eslint scripts/run-eval.mjs` → 0 errors; `node --experimental-strip-types --test scripts/run-eval.test.mjs` → 43/43; byte-identity harness vs `091b389` copy — 36 cases (19 parseGrader + 17 behavior battery): `BYTE-IDENTICAL — checks=36 fails=0`.
- Kept-symbol hits: checkEntryContract 3 · manifestFind 3 · manifestHas 3 · runEntryOracle 4 · validateExpectedBehavior 3 · normalizeEmittedFiles 5 · evaluateEntryRunsRow 2.

### S3 — T5.4 (A1 catalogue + PARENT COMPLETION, 2026-09-30 ~10:30 local)

- A1 landed (rt-events.ts): `RT_SCOPES` + `"eval-run"`; `RT_EVENT_NAMES` + `eval.run_start` / `eval.run_end` / `eval.run_error` (≤3 rows/run design).
- Parent completed (log: fixes/318_parent_complete.md): `scripts/run-eval.mjs` emitter `emitEvalRunRow(seed)` (guardrail `isKnownRtEvent`; `makeCliRow` + `appendRtLine` via `resolveLogDir(null)`; failures swallowed — telemetry never alters the run) + 4 bounded call sites (`eval.run_start` post-target-selection · `eval.run_end` post-persist main · `eval.run_end` empty-corpus · `eval.run_error` top-catch); `rt-events.test.ts` sorted-name pin gains the 3 names (was RED); `rt-events.ts` census re-count appended (catalogue 60 · emitted 22 · dead 38); `run-eval.test.mjs` +2 pins (behavioral legal-row/refusal + wiring guard 4 sites).
- Behavioral proof (real empty-corpus scratch run — not just pins), ndjson row verbatim:
  `{"schema_version":1,"ts":1790782285084,"level":"info","host":"cli","sessionId":"ev-muo9jai8","scope":"eval-run","event":"eval.run_end","message":"eval run end (empty corpus) · mode=keyless · 0 entries","capture":"run-eval.mjs:2950","phase":null,"projectId":null,"code":null,"stack":null,"payload":{"mode":"keyless","entries":0,"empty":true},"runRef":null,"elapsedMs":null}`

### S4 — scoped gates

- `node --experimental-strip-types --test src/lib/rt-events.test.ts` → exit 0 · 7/7 · 0 fail.
- `node --test scripts/run-eval.test.mjs` → exit 0 · 45/45 · 0 fail (43 + the 2 new T5.4 pins).
- `npx eslint scripts/run-eval.mjs scripts/run-eval.test.mjs src/lib/rt-events.ts src/lib/rt-events.test.ts` → exit 0 · 0 problems.
- Full gates (typecheck/lint/npm test/gate.sh) at the wave boundary — parent.

=== END 318_a1_oracle — COMPLETE (A1: items 1–2 + catalogue; parent: emissions/pins/census — see 318_parent_complete.md) ===

