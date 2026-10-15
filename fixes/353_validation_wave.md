# fixes/353 — the ten-brief validation wave + the harness/driver wiring it verified (W353)

**Lane:** W353 (single lane, this session). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`
(path contains a space). **Host:** Node **v24.15.0** (the contract requires ≥22; the frozen gate was
not re-derived on 22 — stated plainly).
**HEAD at start and for the whole wave:** `30bce78b84903d2d64a84c4902c732f40bd14a29` (`main`, **dirty
tree** — no commit was made; the wave measures a moving tree and says so).

**Owned files edited:** `scripts/acceptance-run.mjs` (all new/expanded), `scripts/acceptance-run.test.mjs`.
`src/lib/headless.ts` / `src/lib/store.ts` / `src/lib/io.ts` / `src/lib/write-set.ts` were **audited and
needed no change this lane** — the driver fixes they required (emit atomicity, below-floor banner opt-in,
`landEmittedTree` re-verification, resume/unattended RUNLOCK + no-progress + `outcome`, the wild keyed
edge) are already present on the tree, landed by the W352 lane whose log is `fixes/352_cli_drivers.md`.
`src/lib/product-quality.ts`, `codegen.server.ts`, `scaffold.ts`, `dod.ts`, `doctor.ts`, `acceptance.ts`,
`engine.ts`, `packet.ts` were read-only; needed changes are in §5.

---

## 0. The snapshot — what was in the tree when the wave started

**HEAD** `30bce78` throughout. **Sibling fixes already present at launch** (I did not touch these):

- **`fixes/352_cli_drivers.md`** — the driver/CLI boundary wave: `resume`/`unattended` RUNLOCK +
  no-progress + `outcome`; the acceptance harness's `--keyless` disable and front-matter unwrap; the
  **emit banner policy** (`EmitProjectOptions.underProduced`); `write-set` staged atomic batch +
  reclaimable lock; `landEmittedTree` re-verification; the wild keyed edge (`livePhaseEdge`); plus the
  CLI flag/taxonomy fixes. Its untracked artifacts (`scripts/rapidtool-cli-352.test.mjs`,
  `scripts/fixes352-pipeline.test.mjs`) were present.
- **`fixes/351_cli_wild_research.md`**, `research/multiagent/wildmode-diagnosis.md`, `RUNBOOK.md`, and a
  large dirty `src/**` + `scripts/**` set (acceptance/doctor/dod/engine/packet/phases/verify/… — siblings
  mid-edit). Files changed **during** the wave included `src/lib/compile-check.server.ts`,
  `src/lib/errors.ts`, `src/lib/packet.ts`, `src/lib/phases.ts`, `src/lib/verify*.ts`; two transient
  sibling typecheck errors were visible in `tsc --noEmit` at separate moments and cleared (§6).

**This is a snapshot, not a frozen-tree verdict.** The tree was edited by sibling lanes during the wave;
the runs consumed whatever bytes were on disk when each module was imported.

---

## 1. What the ten runs did

One command, one run per brief, sequential, never a loop (`--suite` is new this lane):

```powershell
cd 'C:\Users\mnril\Desktop\RapidTool Main'
node --experimental-strip-types scripts/acceptance-run.mjs `
  --suite "C:\Users\mnril\AppData\Local\Temp\rt10" `
  --out   "C:\Users\mnril\AppData\Local\Temp\rt10\results-wave353" `
  --max-steps 12 --p6-retries 1
```

Keyed from the repo `.env` (`keySource: repo-env-file`, tails only; the ambient key lost behind
`RT_E_LLM_KEY_SHADOWED`). Wall **5,799,605 ms (~96.7 min)**; one `verdict.json` per brief + a roll-up
JSON on stdout + the table on stderr.

**Honest roll-up (verbatim from `suite.stderr.log`):**

```
BRIEF                   OK   EXIT  STATUS         P   TREE  SCRIPTS   QUALITY  FLOOR  TOKENS
01-bakery-website       no   1     running        12  36    verified  no       ok     76246
02-pet-supply-store     yes  0     complete       12  26    verified  no       ok     252774
03-arcade-game          no   1     running        6   20    verified  no       BELOW  284750
04-puzzle-game          no   1     running        6   25    verified  no       BELOW  373405
05-cli-log-analyzer     no   1     running        6   23    verified  no       BELOW  447267
06-sales-dashboard      no   1     running        6   22    verified  no       BELOW  357967
07-clinic-booking       no   1     awaiting_hitl  6   24    verified  no       ok     216255
08-warehouse-inventory  no   1     running        6   26    verified  no       ok     161541
09-webhooks-service     no   1     running        6   24    verified  no       BELOW  418012
10-notes-pwa            no   1     running        6   20    verified  no       BELOW  293655
```

`rollup`: `total 10 · ok 1 · failed 9 · belowFloor 6 · productQuality 0 · declaredScriptsVerified 10`.
**Spend 2,881,872 tokens / 444 calls** (`estimatedCostUsd: null`, never fabricated). The 01 re-run in §3
adds **520,885 tokens / 83 calls** — **wave total 3,402,757 tokens / 527 calls**.

**Every emitted tree was measured by its OWN declared `npm run typecheck` / `npm test`** — 10/10 carry
`declaredScriptsVerified: true` (the scripts really ran over the emitted bytes). 6/10 failed their own
`tsc`; 3/10 built a green tree but an empty-substance one; 1/10 sealed complete.

**`ok:true` is 02-pet-supply-store** — and `productQuality.quality` is **false** for it (no router, no
distinct page files). The harness's `ok` bar is "landed + real entry + green tree-run + verified declared
toolchain + clean seal"; the product-quality reading is additive and was **0/10**. An `ok:true` here is
*not* a product-quality claim — say so wherever it is quoted.

---

## 2. Driver-caused vs synthesis-caused (per brief)

| brief | kind | what failed | class |
|---|---|---|---|
| 01-bakery-website | app | **only** `run.cleanSeal` — `status running · phase 12`, tree **green**, substance real | **driver/harness-config**: the 13-phase pipeline needs 13 advancing steps; `--max-steps 12` capped it one short. Not a product failure. |
| 02-pet-supply-store | app | nothing (ok:true) | — |
| 03-arcade-game | app | `treeRun.ok` (`tsc` TS1117 duplicate prop, TS2304 `InputState`), `tree.substantive` empty | **synthesis** (model) |
| 04-puzzle-game | game | `treeRun.ok` (`tsc` TS2322) + `npm test` fail | **synthesis** |
| 05-cli-log-analyzer | tool | `tree.webEntry` ("index.html missing") **+** `tsc` TS2345 | **driver (fixed)** + synthesis |
| 06-sales-dashboard | app | `tree.substantive` empty (tsc green) | **synthesis/emission** |
| 07-clinic-booking | service | `tree.webEntry` ("index.html missing") **+** `tsc` TS2345 | **driver (fixed)** + synthesis |
| 08-warehouse-inventory | app | `tsc` TS2554 | **synthesis** |
| 09-webhooks-service | library | `tree.webEntry` ("index.html missing") **+** `tsc` TS7006/TS2345 + test fail | **driver (fixed)** + synthesis |
| 10-notes-pwa | app | `tree.substantive` empty (tsc green) | **synthesis/emission** |

**Driver-caused components** (fixed this lane): the unconditional web-entry assertion falsely failed the
`tool`/`service`/`library` briefs (05/07/09) for a missing `index.html` the emit path never writes for
those kinds; and 01's step-cap was invisible in the verdict.

**The old wave's one hard driver failure did NOT recur.** Last wave 07 emitted **nothing** (`RT_E_VALIDATION
· CommonJS body vs "type":"module"`, `tree.exists:false`). This wave 07 **landed a 24-file tree** and failed
its own `tsc` instead — the CJS-guard bytes that tripped the scaffold did not recur. That failure was
**synthesis-caused** (a model-written runtime `module.exports` guard the materializer does not rewrite), not
driver.

**No brief failed for a purely driver reason that a keyed re-run could flip green** (see §3). That is the
honest classification, not a claim that the driver is clean.

---

## 3. The driver re-run

**01-bakery-website, re-run keyed with the FIXED harness at `--max-steps 14`** (the one brief whose wave
failure was driver/harness-config):

```
node --experimental-strip-types scripts/acceptance-run.mjs \
  --brief "...\rt10\01-bakery-website.md" --out "...\rt10\results-wave353-rerun\01-bakery-website" \
  --max-steps 14 --p6-retries 1
```

Result (`verdict.json`): **`ok:false`, exit 1**, `status running · phase 6 · steps 0 · outcome dod ·
capped false`, tree **33 files**, `tree.entry {ok:true, mode:"web", entry:"src/main.tsx"}`,
`belowFloor {belowFloor:true, emittedBelowFloorBanner:true, recordedUnderProduced:true, underProduced:{code:"RT_E_PLAN_UNDERPRODUCED", …}}`,
`treeRun {ok:true, typecheck:"pass", test:"pass", declaredScriptsVerified:true}`.
**520,885 tokens / 83 calls.**

**Read it honestly:** the re-run did **not** reproduce the wave sample. The wave's 01 reached P12 with a
green tree and only failed the 12-step cap; the re-run stalled at P6 on a hard-DoD block with a below-floor
partial — **variance**, exactly the phenomenon `AGENTS.md` documents ("no single run is the product"). The
re-run **did** exercise the new additive readings live: the below-floor partial landed **with the caution
banner** and `belowFloor` reported the writer's recorded `RT_E_PLAN_UNDERPRODUCED` seal, and `run.cleanSeal`
named `sealedWithFailures true`. It did **not** confirm the step-cap hypothesis, because it produced a
different failure; I am not claiming it did.

**Cheap deterministic verification of the entry fix** (no key, no pipeline) — the fixed kind-aware resolver
run over the ten trees the wave already wrote to disk
(`C:\Users\mnril\AppData\Local\Temp\rt10\verify-entry.mjs`):

```
01-bakery-website      kind=app      entry.ok=true  mode=web      entry=src/main.tsx
02-pet-supply-store    kind=app      entry.ok=true  mode=web      entry=src/main.tsx
03-arcade-game         kind=app      entry.ok=true  mode=web      entry=src/main.tsx
04-puzzle-game         kind=game     entry.ok=true  mode=web      entry=src/main.ts
05-cli-log-analyzer    kind=tool     entry.ok=true  mode=tool     entry=bin/logscope.mjs
06-sales-dashboard     kind=app      entry.ok=true  mode=web      entry=src/main.tsx
07-clinic-booking      kind=service  entry.ok=true  mode=service  entry=src/main.ts
08-warehouse-inventory kind=app      entry.ok=true  mode=web      entry=src/main.tsx
09-webhooks-service    kind=library  entry.ok=true  mode=library  entry=src/main.ts
10-notes-pwa           kind=app      entry.ok=true  mode=web      entry=src/main.tsx
```

The three briefs that failed `tree.webEntry` in the wave (05/07/09) now resolve their **own** entry
(`bin/logscope.mjs` / `src/main.ts` / `src/main.ts`). 05/07/09 were **not** keyed-re-run: their remaining
failures are synthesis-caused (`tsc`), so a re-run would burn ~1.1 M tokens to re-confirm red.

---

## 4. Wiring bugs fixed (each with its test)

All in `scripts/acceptance-run.mjs` + `scripts/acceptance-run.test.mjs` (24 tests, 24 pass).

1. **Batch mode `--suite <dir-or-list>`** (`resolveSuiteBriefs`, `runSuite`, `formatRollupTable`).
   Runs many briefs sequentially, writes `<out>/<slug>/verdict.json` per brief, prints a roll-up table
   (stderr + `rollup.table`), and is `ok:true` only when **every** brief is ok. Directory → sorted
   `*.md/*.markdown/*.txt`; anything else → a `,`/`;`/newline list; slugs de-duped so one brief is never
   run twice. Tests: `resolveSuiteBriefs` (dir/list/empty), `formatRollupTable`, and a behavioral
   `--keyless --suite` run asserting one JSON object + one verdict file per brief with its own reasons.

2. **The entry assertion was kind-blind** (`resolveTreeEntry`, `inspectTree(dir, kind)`,
   `evaluateAcceptance`). It demanded `index.html` + a src mount for **every** project, so a
   `tool`/`service`/`library` tree (no HTML by design — the emit path adds `index.html` only for
   `app`/`game`) was falsely failed for "index.html missing" (live: 05, 07, 09). Now a web kind requires
   the HTML entry and every other kind requires its own program entry (a `bin`/`main` package field,
   `bin/*.{mjs,js,cjs}`, or `src/main.*` / `src/cli.*`); an absent kind keeps the historical web
   requirement (fail-closed). Assertion id is now `tree.entry`; `tree.webEntry` is kept as the raw web
   sub-reading. Tests: web-kind, non-web-kind, absent-kind, and a tool tree reaching `ok:true`.

3. **The below-floor / banner state was not reported** (`readBelowFloorState`, payload `belowFloor` +
   `gates`). The harness landed below-floor partials (the banner policy) but did not say so; the verdict
   now carries `belowFloor { belowFloor, emittedBelowFloorBanner, recordedUnderProduced, underProduced }`,
   `tree.underProducedBanner` / `tree.redTreeRunBanner` (two distinct markers read off the emitted README),
   `tree.emit.underProduced`, the project's own `planUnderproduced` seal (`planUnderproductionSeal`), and a
   compact `gates` block. All additive — none can turn a red tree green. Tests: recorded seal, banner-only,
   red-tree-banner-is-not-below-floor.

4. **A suite attributed cumulative spend to each brief** (`spendDelta`). `sessionSpendTotal` is
   process-global, so the per-brief `verdict.json` reported the running total as that brief's cost. The
   persisted verdict now carries the **measured delta** and keeps the cumulative beside it as
   `spend.processCumulative`. Tests: `spendDelta` (own-delta, later-brief, clamp) and the behavioral suite
   asserting `spend.tokens <= spend.processCumulative.tokens`.

5. **A step-capped run was indistinguishable from a bad one** (`run.capped` / `run.maxSteps`, and the
   `run.cleanSeal` detail). The verdict now names the cap (`capped at 12 step(s) (incomplete, not a product
   failure)`) and carries `project.capped` / `project.maxSteps`; `ok` is unchanged. Test: a capped fact set
   is `ok:false` and its `run.cleanSeal` detail names the cap.

**Wiring verified, not changed:** the driver seams W352 landed (emit banner policy, `landEmittedTree`
re-verification, `write-set` atomic batch/lock, `respondDriveOutcome` RUNLOCK/no-progress/`outcome`, the
wild `livePhaseEdge`) are present and were exercised end-to-end by this wave (10/10 emits landed, 10/10
trees ran their own scripts, the below-floor banner landed live in the 01 re-run).

---

## 5. Synthesis-side failures left to the other agents (reported, not fixed)

- **The tree's own `tsc` fails on 6/10 briefs** — TS2345/TS2554/TS2322/TS2304/TS7006/TS1117: the model
  emits code that calls with the wrong arity, annotates a `Record<string,unknown>` return as `void`,
  duplicates an object-literal property, or names a type it never declared. These are codegen/prompt
  classes, not driver.
- **Empty-substance trees with a GREEN `tsc`** (03/06/10): `substance.real:0`, `verdict:"empty"` — the
  emitted tree is a shell. Class (d) emission.
- **`RT_E_PLAN_UNDERPRODUCED` below-floor partials: 6/10** landed WITH the banner (correct behavior); the
  floor is genuine (e.g. 01 re-run: "accepted tree has 1 module(s) but the brief demands >= 8").
- **`productQuality.quality: 0/10** — no router / distinct pages / wired ordering flow anywhere. The
  binding wall remains UI wiring/emission (`scaffold.ts`, `product-quality.ts` — not mine).
- **`scaffold.ts` / `materializeImportableTree`:** a generated module that carries `module.exports` inside
  a **runtime guard** (`typeof module !== 'undefined' && module.exports ? …`) is what refused 07 last wave;
  the CJS stripper handles `module.exports.NAME =` statements, not an expression guard. Not reproduced this
  wave, but structurally live. Owner: codegen/scaffold.
- **`AGENTS.md` claim drift** (owner): the 346 "Corrections in force" still says *"`emit --git` WITHOUT
  `--run` still commits — it has no verdict to consult"*; W352 R-19 removed that residual. Also the
  binding contract says Node 22 while this host runs 24.15.0.

---

## 6. Verification (raw, this box)

```
npx tsc --noEmit                              -> exit 0
npx tsc -p tsconfig.scripts.json --noEmit     -> exit 0
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor -> exit 0, ok:true
node --test --test-reporter=tap scripts/acceptance-run.test.mjs
  -> # tests 24  pass 24  fail 0
node --test --test-reporter=tap scripts/rapidtool-cli-352.test.mjs
  -> # tests 17  pass 17  fail 0   (the W352 suite that consumes acceptance-run.mjs — unbroken)
```

`doctor` (keyless/keyed pre-flight) returned `ok:true`, `llm.configured:true` (keyState `unverified`),
`research.probed:true`, `runner.available:true`, `node:v24.15.0`, `isolation.sandbox:false` with the
permission-model bound enforced. Two transient `tsc --noEmit` errors appeared in **sibling** files during
the wave (`src/lib/codegen.server.ts` TS7006 ×2; `src/lib/packet.ts` TS2451 ×2) and cleared on re-run —
that is the mid-edit signal, not this lane's bytes.

**Landing log path:** `C:\Users\mnril\Desktop\RapidTool Main\fixes\353_validation_wave.md` (this file).
**Wave artifacts:** `C:\Users\mnril\AppData\Local\Temp\rt10\results-wave353\<slug>\verdict.json`,
`…\results-wave353\suite.json` (stdout; PowerShell wrote it **UTF-16LE** — read with `utf16le`),
`…\results-wave353\suite.stderr.log` (the roll-up table),
`…\results-wave353-rerun\01-bakery-website\verdict.json`, `…\rt10\verify-entry.mjs`.

---

## 7. Unverified / residual

- **The wave is a moving-tree snapshot**, not a frozen-tree gate. Sibling lanes edited `src/**` +
  `scripts/**` during the runs; the numbers describe the bytes each run imported, not a frozen commit.
- **No full `npm test` / `gate.sh` / `npm run build`** was run (siblings mid-edit — the task forbids it).
  Only the two `tsc` commands, the scripts test file I touched, `doctor`, and the bounded keyed runs.
- **05/09 were not keyed-re-run** (their failures are synthesis-caused); the entry fix for them is verified
  deterministically over their on-disk trees, not by a fresh run.
- **The suite's stdout (roll-up JSON) is not written by the harness itself** — it goes to stdout and the
  shell redirect decides the encoding (PowerShell chose UTF-16LE). The per-brief `verdict.json` files are
  written by the harness as UTF-8 (no BOM) and read cleanly.
- **The 01 step-cap finding is a configuration artifact** of `--max-steps 12` for a 13-phase pipeline; the
  harness now *reports* it (`capped`), it does not *fix* the pipeline to seal sooner.
