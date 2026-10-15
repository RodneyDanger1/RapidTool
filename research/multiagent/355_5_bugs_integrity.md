# 355_5 — lane `inspector-integrity` (W355) · the honesty layer vs the bytes

**Lane:** `inspector-integrity` (bug inspector 2 of 2). **Kind:** read-only integrity inspection.
**Tree:** `C:\Users\mnril\Desktop\RapidTool Main`, branch `main`, HEAD `30bce78`
(`git rev-parse HEAD` → `30bce78b84903d2d64a84c4902c732f40bd14a29`), dirty (below).
**Host:** Windows PowerShell 5.1 · `node -v` → `v24.15.0`.
**Doctrine applied:** "if a doc and the bytes disagree, the bytes win". No doc is evidence for itself.

**Wrote exactly one file:** this one. No product file, doc, register or sibling-lane file was edited;
`npm test`, `npm run build` and `scripts/gate.sh` were not run.

---

## 1. Method — the re-derivation command beside each claim

Tree state re-derived first (the baseline the brief gave was slightly off):

| Fact | Command | Result |
|---|---|---|
| HEAD / branch | `git rev-parse HEAD` · `git rev-parse --abbrev-ref HEAD` | `30bce78…` / `main` |
| modified files | `git status --porcelain \| Where-Object { $_ -match '^ ?M' } \| Measure-Object -Line` | **98** |
| untracked entries (porcelain `??`, dirs collapse) | `git status --short \| Where-Object { $_ -match '^\?\?' } \| Measure-Object -Line` | **33** at first read → **36** at end of session (sibling W355 lanes added files; brief said 32) |
| untracked files | `git ls-files --others --exclude-standard \| Measure-Object -Line` | **78** (excludes my own new file's siblings added later) |
| node | `node -v` | `v24.15.0` |
| Node contract | `Select-String package.json -Pattern node` | `"engines":{"node":">=22"}` (`package.json:8`) |

Counts (all `git ls-files <dir> | Measure-Object -Line`, today):

```
total 2088 · src 262 · src/lib 250 · src/components 6 · src/routes 3
scripts 152 · scripts/prevention 77 · fixes 783 · wave_plans 139 (46 dirs)
research 476 · research/multiagent 103 · research/eval-out 345 · research/eval-corpus 23
migrations 2 · public 10 · .github 1 · root (top-level) 42
src/lib by ext: ts 246 (128 non-test + 118 *.test.ts) · tsx 3 · json 1
scripts split: scripts/*.mjs 72 (39 *.test.mjs + 33 non-test) + scripts/prevention 77 + gate.sh/README-cli.md/skip-registry.json
```

Inventories:

| Inventory | Command | Result |
|---|---|---|
| CLI verbs | `(Select-String -Path scripts\rapidtool-cli.mjs -Pattern 'case "' -SimpleMatch).Count` | **39** |
| console run tabs | `Select-String src\components\console.tsx -Pattern 'RUN_TABS' -Context 0,3` → count entries in the array at `console.tsx:196-214` | **12** (4 primary + 8 advanced) |
| prevention guards | `(Get-Content scripts\guards\guard-registry.json -Raw \| ConvertFrom-Json).guards.Count` and `.countFloor` | **34 / 34**; `scripts/prevention/cassettes/guard-floor.json` pins `countFloor:34` + the same 34 ids |
| `.grok` legacy | `git ls-files .grok/skills` (unique dirs) · `.grok/references` · `git ls-files .grok` | 18 · 6 · 89 |
| tracked `.env*` | `git ls-files '.env*'` | only `.env.example` |
| tracked `*.log` | `git ls-files '*.log'` | **0** |

---

## 2. Claim-vs-bytes table

Verdict legend: **TRUE** = bytes agree · **STALE** = false today but a later block in the same file
supersedes it (annotated) · **FALSE** = false today and **nothing** in the repo strikes it (or the
strike itself is refuted by the bytes).

### 2a. Counts and inventories (Q1)

| # | claim | where (file:line) | what the bytes say | command | verdict |
|---|---|---|---|---|---|
| 1 | total tracked **2,014** · `src` 256 · `src/lib` 244 · `scripts` 107 · `fixes` 761 · root 41 | `AGENTS.md:243-246` | 2,088 · 262 · 250 · 152 · 783 · 42 | `git ls-files …` (§1) | **STALE, unannotated** — this is the *newest* count block in `AGENTS.md`; nothing after it re-counts |
| 2 | `src/lib` 244 = 129 non-test + 115 tests | `README.md:730` | 250 = 128 non-test `*.ts` + 118 `*.test.ts` (+3 tsx +1 json) | `git ls-files src/lib` | **STALE, unannotated** |
| 3 | `scripts/` **107** | `README.md:634` | **152** | `git ls-files scripts` | **STALE, unannotated** |
| 4 | README batch-10 counts (2,014 / 256 / 244 / 107 / 761) | `README.md:454-456` | §1 | `git ls-files` | **STALE, unannotated** — newest count block in `README.md` |
| 5 | `docs-FOLDER-MAP` newest re-count: total 1,933 · src 250 · src/lib 239 · scripts 49 · fixes 744 · wave_plans 139 | `docs-FOLDER-MAP.md:18-20` | 2,088 · 262 · 250 · 152 · 783 · 139 | `git ls-files` | **STALE, unannotated** — no 354-wave re-count was appended to this file |
| 6 | `src/lib/` **(239 files)** (10-line tour) | `START-HERE.md:22` | 250 | `git ls-files src/lib` | STALE, **annotated** (`START-HERE.md:207-213` supersedes the tour) |
| 7 | `scripts/` **(49)** | `START-HERE.md:29` | 152 | `git ls-files scripts` | STALE, annotated (same block) |
| 8 | `fixes/` **(744)** | `START-HERE.md:30` | 783 | `git ls-files fixes` | STALE, annotated |
| 9 | `wave_plans/` (139) | `START-HERE.md:31`, `AGENTS.md:245` | 139 | `git ls-files wave_plans` | **TRUE** |
| 10 | `research/multiagent/` (103) · `research/eval-corpus/` (23) · `eval-out` 345 | `START-HERE.md:37-38` | 103 · 23 · 345 | `git ls-files research/…` | **TRUE** |
| 11 | START-HERE 354-wave census: total 2,088 · src 262 · src/lib 250 · scripts 152 · fixes 783 · wave_plans 139; `node -v` → v24.15.0 | `START-HERE.md:206-213` | §1 | `git ls-files` + `node -v` | **TRUE** (this is the one re-derived census that holds today) |
| 12 | CLI **39** verbs (`grep -c 'case "'` is the source of truth) | `AGENTS.md:52`; `START-HERE.md:23,91`; `README.md:9,138,193,214,348,386,832` | 39 | `Select-String -Pattern 'case "'` | **TRUE** |
| 13 | run-console tabs are **TWELVE** | `AGENTS.md:490-492` | `RUN_TABS` at `console.tsx:196-214` = 12 entries | read | **TRUE** |
| 14 | console has "**9+ tabs**" | `AGENTS.md:51`; `START-HERE.md:92` | 12 | read | TRUE (vague, not false) |
| 15 | `codegen.server.test.ts` **119 tests** ("counted `it(`/`test(` today") | `README.md:203` | **325** top-level `it(` blocks (0 `test(`) | `Select-String -Pattern '^\s*(it|test)\(' \| Measure-Object -Line` | **STALE, unannotated** (off by 206) |
| 16 | prevention **20/20 guards** | `README.md:15` | 34 | registry + guard-floor | STALE, annotated (`README.md:505`, `:1053-1057`) |
| 17 | prevention **20 guards** / **27 guards** | `AGENTS.md:270` (quoted JSON), `:366`, `:369` | 34 | registry + guard-floor | STALE, annotated (`AGENTS.md:440`) |
| 18 | prevention **34 guards**, `countFloor:34` | `AGENTS.md:440-444` | 34 / 34 | registry + guard-floor | **TRUE** |
| 19 | "Node **22** required (verified v22.23.2)" | `START-HERE.md:39`; `README.md:92` | contract `>=22`; this host is **v24.15.0**; 22.23.2 is the Hermes-bundled runtime | `node -v` + `package.json:8` | **STALE** (README/START-HERE have no 354-wave Node correction; `AGENTS.md:482-484` does) |
| 20 | "`scripts/gate.sh` (the **four-gate** stability script)" | `AGENTS.md:56` | `gate.sh:496` iterates **ten** stage names — `typecheck lint assertionGaps prevention moduleCoverage testsScripts testsLib testsScripts2 testsLib2 build`; `prevention` is wired at `gate.sh:134` and `moduleCoverage` at `:135` (`AGENTS.md:436-438` / `README.md:449` JSONs show 7 and list `prevention`) | `Select-String scripts\gate.sh -Pattern 'for id in'` | **FALSE** (never struck; `README.md:1043-1048` describes the extra stages but does not strike the "four-gate" wording) |
| 21 | "`.grok/` (18 `skills/*`, 6 `references/*`)" | `AGENTS.md:136` | 18 · 6 (89 tracked) | `git ls-files .grok` | **TRUE** |
| 21b | `RUNBOOK.md` is a root doc (listed as "Root docs" / part of the read set) | `START-HERE.md:33-36`; `docs-FOLDER-MAP.md:73-91` (root-files node list) | `git ls-files RUNBOOK.md` = **0** — the file is **untracked** (`git status --short` → `?? RUNBOOK.md`), 19,548 bytes; neither doc lists it; only `fixes/353_validation_wave.md:29` names it | `git ls-files RUNBOOK.md` + `git status --short` | **FALSE as an inventory** — a root doc that exists only in the working tree is absent from every `git ls-files`-derived census and would not survive a clean checkout |

### 2b. The `emit --git` family (Q2, the brief's known candidate)

| # | claim | where | bytes | command | verdict |
|---|---|---|---|---|---|
| 22 | "`emit --git` WITHOUT `--run` still commits — it has no verdict to consult (by design)" | `AGENTS.md:215` | `headless.ts:3028-3045` `verifyEmittedDirBeforeCommit` re-runs the oracle over the dir **before every landing**; `landEmittedTree` (`:3045-3066`) returns `{ok:false, reason:"tree-run-red", code:"RT_E_TREE_RUN_FAILED"}` when it is not green, before any git call | read `src/lib/headless.ts:3028-3066` | **STALE, but struck**: `AGENTS.md:485-489` (354-wave block) strikes it; the phrase at `:215` is still literal, so a cold reader hits the false line first. `fixes/353_validation_wave.md:227-228` already flagged this as owed |
| 23 | "`resumeAccepted` is plumbed through `headless.ts` but **not yet consumed by codegen** (`grep resumeAccepted src/lib/codegen.server.ts` = 0)" | `AGENTS.md:347-348` | **7** hits in `codegen.server.ts` (`:6041, :6955, :7057, :7607, :7610, :7640, :7641`) — `synthesizeChunkedTree` at `:6955`/`:7057` and the plan-row reuse path at `:7607-7640` consume it | `Select-String src\lib\codegen.server.ts -Pattern resumeAccepted` | **FALSE, nothing strikes it.** The repo's own `RUNBOOK.md:333-339` (corrected 2026-10-05) says the opposite ("`resumeAccepted` IS now consumed by codegen") |
| 24 | `AGENTS.md`/`README.md` "Known residuals" `lint.problems:5` | `AGENTS.md:349`; `README.md:15` | `AGENTS.md:468` (later block) says "`lint.problems` is `null` again" | — (lint not run: would write a cache / is a broad run) | **Internal contradiction**, unresolved on the bytes from here |
| 25 | batch-10 JSON block quotes `prevention … "count":20,"countFloor":20` | `AGENTS.md:248`; `README.md:449` | 34 | registry + guard-floor | STALE, annotated |

### 2c. Registry, provenance, cost, secrets, determinism (Q3–Q7)

| # | claim | where | bytes | command | verdict |
|---|---|---|---|---|---|
| 26 | "**Every surfaced failure** carries a code from `src/lib/errors.ts` (`ERROR_CODE_DOC` is the canonical registry)" | `AGENTS.md:105-106` | 12 raised codes are absent from `ERROR_CODE_DOC` (11 in live non-test paths + 1 test fixture), plus 1 comment-only mention — §3 | §3 commands | **FALSE** (partially self-declared at `src/lib/selfmod.ts:117-119`) |
| 27 | "**Eleven** guard `expectedCode` values are registered, with a test that every registry `RT_E_*` resolves in `ERROR_CODE_DOC`" | `AGENTS.md:466-467` | `guard-registry.json` has **34** guards, **28** distinct `expectedCode` strings, **20** distinct `RT_E_*` codes — all 20 present in `ERROR_CODE_DOC`; the test exists at `src/lib/errors.test.ts:557-580` | `ConvertFrom-Json` on the registry + `errors.test.ts:557` read | **count STALE** ("eleven" ≠ 20); the *coverage* half is **TRUE** |
| 28 | "A machine path may never mint `decidedBy:"human"`" | `AGENTS.md:308-310` | `acceptance.ts:192-193` refuses `decidedBy:"human" \|\| seat:"human"`; `:332` gates `autonomousFactoryV2` on `!forgedHumanStamp`; pinned by `acceptance.test.ts:148-228` (`:186/:208`), `doctor.test.ts:1345,1420`, `headless.test.ts:532` | read + `Select-String` | **TRUE** (test-pinned) |
| 29 | console seat is a registered **UNATTESTED** human seat | `AGENTS.md:217-222` | `policy.ts:203-206` registers it, `:295-305` refuses `hitl.force` with `force-requires-human-seat`, `:345-348` allows `hitl.approve` under `console-seat-unattested`; `dod.ts:258-306` recognises `[seat console]` and requires `tokenPath === seatTokenPath(seat)`; pinned by `policy.test.ts:371-386`, `dod.test.ts:244-315`, `store.test.ts:2888-2916`, `headless.test.ts:3462-3481` | read + `Select-String` | **TRUE** (test-pinned) |
| 30 | `fleetMetrics`/`fleetAlarms`: "`estimatedCostUsd` always `null` (spend is never fabricated)" | `AGENTS.md:305-306`; `doctor.ts:158` | `acceptance.ts:582`, `:665` hard-code `null`; the honesty alarm trips on any non-null (`:700`, `:736-737`) | read | **TRUE** as scoped to `fleetMetrics` |
| 31 | "Spend 615,533 tokens / **~US$0.38** (label-only; `estimatedCostUsd:null`)" | `AGENTS.md:338-339` | the code deliberately refuses to price without caller prices (`doctor.ts:1387`, `run-eval.mjs:1018`); the citing artifact `testruns\_report\CAMPAIGN1.md` is **not in this checkout** (`Test-Path testruns\_report` → False) | `Test-Path` + read | **unverifiable here**; the USD figure is a hand-computed doc number the machine refuses to emit |
| 32 | campaign evidence at `testruns\_report\CAMPAIGN1.md` / `CAMPAIGN3.md` | `AGENTS.md:336-337,392,455` | `git ls-files testruns` = 0 and `testruns\_report` does not exist in the repo; the reports live in the **sibling** `C:\Users\mnril\Desktop\testruns\_report` (`README.md:1090-1093`) | `Test-Path` (both) | **STALE path** — the doc reads as an in-repo path |
| 33 | no secret is read via `import.meta.env`; no `VITE_`-prefixed secret | `AGENTS.md:119`; `.env.example:1-4` | the only `import.meta.env` reads in `src/**` are `VITE_AUTH_ENABLED` (`auth/client.ts:44`) and `VITE_STUN_URLS` (`multiplayer/p2p.ts:91`) — neither is a secret; `key-source.test.ts:92` asserts a server secret is never `VITE_`-prefixed | `Select-String -Pattern 'import\.meta\.env\|VITE_'` | **TRUE** |
| 34 | determinism reading names the right carriers | `RUNBOOK.md:255-260`; `README.md:1064-1069` | `product-quality.ts:163-319` reports `id ← crypto.randomUUID()` (mint at `engine.ts:2425`, `store.ts:2662`), `createdAt`/`traces[].ranAt`/`logs[].ts ← Date.now()`, `lastTest.evidenceHash ← fnv1a(source+evidence+caseCommitment)` (`codegen.server.ts:6671-6681`), and the emitted `package.json`/`README.md` UUID + ISO stamp | read | **TRUE**, one detail wrong (finding `I355-07`) |

---

## 3. `RT_E_*` registry delta (Q3)

Commands (both re-derived today):

```powershell
# documented keys
Select-String -Path src\lib\errors.ts -Pattern '^\s*RT_E_[A-Z_]+:\s*\{'        # 56
# array entries
Select-String -Path src\lib\errors.ts -Pattern '^\s*"RT_E_[A-Z_]+",'             # 56
# every code literal outside errors.ts, in src/** + scripts/** (*.ts,*.mjs)
Get-ChildItem src,scripts -Recurse -File | ? {$_.Extension -in '.ts','.mjs'} |
  Select-String -Pattern 'RT_E_[A-Z][A-Z_]{2,}' -AllMatches                          # 69 distinct
```

`ERROR_CODES` (56) and `ERROR_CODE_DOC` (56) are the **same** set — `errors.test.ts:436-445` pins it,
and `Record<ErrorCode, …>` would fail to compile otherwise.

**A. Raised-but-undocumented — 13 codes (11 real raises, 1 test-only, 1 comment-only):**

| code | raised at | kind |
|---|---|---|
| `RT_E_SELFMOD_PROTECTED` | `src/lib/selfmod.ts:121` | live (enum `SELFMOD_CODES`) |
| `RT_E_SELFMOD_CAP_EXCEEDED` | `src/lib/selfmod.ts:122` | live |
| `RT_E_SELFMOD_UNGOVERNED` | `src/lib/selfmod.ts:123` | live |
| `RT_E_SELFMOD_VERIFY_FAILED` | `src/lib/selfmod.ts:124` | live |
| `RT_E_RUNLOCK_BAD_START` | `scripts/guards/runlock-preflight.mjs:102` | live (guard violation) |
| `RT_E_RUNLOCK_NO_INPUT` | `scripts/guards/runlock-preflight.mjs:114` | live |
| `RT_E_RUNLOCK_MISSING` | `scripts/guards/runlock-preflight.mjs:124` | live |
| `RT_E_RUNLOCK_BAD_MTIME` | `scripts/guards/runlock-preflight.mjs:130` | live |
| `RT_E_README_PARITY_UNREADABLE` | `scripts/guards/readme-parity.mjs:73` | live |
| `RT_E_PARITY_STALE_ALLOWLIST` | `scripts/guards/readme-parity.mjs:114` | live |
| `RT_E_SRC_DIRTY` | `scripts/factory-watch.mjs:891` | live (envelope code) |
| `RT_E_DOD_UNMET` | `src/lib/rt-client.test.ts:276,304` | test fixture only |
| `RT_E_CASSETTE_MISS` | `src/lib/cassette.ts:100` | **comment only** ("*would be* an improvement") |

**B. Documented-but-unraised — 0.** Every one of the 56 documented codes appears as a literal
somewhere in `src/**` or `scripts/**` (set difference `DOC \ RAISED` is empty).

Note the mitigation that keeps this from being a P0: `scripts/guards/guard-registry.json`'s own
`expectedCode` values **are** all registered (the `errors.test.ts:557` test enforces exactly that),
and `selfmod.ts:117-119` states up front that its four codes are not yet mounted —
*"registered into `src/lib/errors.ts` (ERROR_CODES + ERROR_CODE_DOC) by the mounting change — until
then the CLI cannot carry them and the mount is incomplete"*. The registry gap is therefore
**declared in code but never declared in the contract doc** (`AGENTS.md:105-106` still claims
universality), and the seven scripts-side codes (4 `runlock-preflight`, 2 `readme-parity`, 1
`factory-watch`) have no such declaration anywhere.

---

## 4. Honesty findings

| id | sev | title | evidence | why it matters |
|---|---|---|---|---|
| **I355-01** | **P1** | `AGENTS.md` (the repo contract agents read first) states a **landed** capability is missing: "`resumeAccepted` … not yet consumed by codegen (`grep … = 0`)" | `AGENTS.md:347-348` vs 7 hits in `src/lib/codegen.server.ts` (`:6041,:6955,:7057,:7607,:7610,:7640,:7641`); `RUNBOOK.md:333-339` states the opposite | A doc that lies about behavior is how a future session ships a regression — here it would cause a lane to *re-implement* a landed seam, or to refuse a feature as impossible. Nothing in `AGENTS.md` strikes it (the 354-wave block supersedes only port/Node/`emit --git`/tabs) |
| **I355-02** | **P1** | 11 live `RT_E_*` codes are raised but absent from the canonical registry, against honesty rule 4 | §3 list; `src/lib/selfmod.ts:121-124`; `scripts/guards/runlock-preflight.mjs:102-130`; `scripts/guards/readme-parity.mjs:73,114`; `scripts/factory-watch.mjs:891` vs `AGENTS.md:105-106` | The registry is the machine contract an agent branches on; a code the registry does not carry is a failure an agent cannot look up. `selfmod.ts` admits the gap in code — the contract doc does not, so the claim stays aspirational |
| **I355-03** | **P1** | The count census is false in **three** docs, each at its own *newest* count block | `AGENTS.md:243-246` (2,014/256/244/107/761/41 vs 2,088/262/250/152/783/42); `README.md:454-456` + `:634` + `:730`; `docs-FOLDER-MAP.md:18-20` (1,933/250/239/49/744) | Drift survived a whole correction wave: the 354 wave re-derived the counts into `START-HERE.md:207-213` (which is **true** today) but never propagated them to the other three roots. A cold session that starts at `README.md` or `docs-FOLDER-MAP.md` gets a 2026-10-03/05 census |
| **I355-04** | **P2** | The register's own protocol header carries a refuted standing rule ("NO KEYED CALLS — the DeepSeek account is unfunded — all calls 402") and a stale ID rule | `research/multiagent/thoroughanalysis.md:22` vs `START-HERE.md:128-133` (funded, 200s, measured 2026-10-02) and `AGENTS.md:338-339,392-399` (keyed campaigns with real token spend); header `:17-19` says "Your IDs. A1-fNN … A4-fNN" while the file now carries `C1-C6`, `R1-R15`, `B2-B4`, `AW45/AW46/AW47` ids | A lane that trusts the header either refuses permitted (bounded) work or mis-numbers findings. `:22` is a *standing* rule, not a dated lane log, so it reads as current |
| **I355-05** | **P2** | Register findings that are **fixed, with no strike/annotation** | `A4-f01` (`thoroughanalysis.md:89`) fixed — `grep 'autonomous software agency' src/` now returns only two "never …" guard comments (`console.tsx:303`, `routes/index.tsx:7`) and `src/lib/og/site.json` reads `"description":"governed delivery harness"` (was the 4th home, `R15-f01`/`R6-f02`, `:964-968`, `:1372`); `A4-f02` (`:103`) fixed — `fixtures.server.ts:25-26` LOAD_LABEL now says "read-only review … this view records no decision" and `grep 'approving here' src/` = 0; `A4-f03` (`:115`) fixed — `console.tsx:4699` now says "failing bounded-runner output". `Select-String` for a FIXED/struck marker naming `A4-f0x` → 0 hits | The register is the repo's finding ledger; a reader cannot tell a live defect from a repaired one, so fixed P1/P2s sit as if open |
| **I355-06** | **P2** | `.env.example` documents the wrong armed default for the chunked P6 resample | `.env.example:52-53` "resamples a refused chunk **BY DEFAULT (2, validator-selected**" vs `src/lib/synthesis-policy.ts:54` `P6_SYNTH_CHUNK_RETRY_CANDIDATES = 3` (and `AGENTS.md:357-360` says "3 this session") | It is the file an operator reads to predict spend; a wrong default understates the keyed call multiplier (the lever measured at 27 extra keyed calls in campaign #3, `AGENTS.md:410-412`) |
| **I355-07** | **P3** | One determinism-reading rationale does not match the hash it describes | `product-quality.ts:250-259` classifies `treeRun.verdictHash` volatile with detail "carried from a run whose rows are timestamped", but `treeVerdictHash` (`compile-check.server.ts:870-912`) folds only decisive non-time fields (`ok`, declared-script state, compile counts, `tests[].file/run`, substance counts) — no timestamp. The *verdict* (`stable:false`) is defensible (the hash needs an execution), the *stated reason* is not | The reading is the repo's determinism disclosure; a wrong reason undermines the one artifact built to be exact about reproducibility |
| **I355-08** | **P3** | `AGENTS.md`'s dev-bind line-reference is stale | `AGENTS.md:19` cites `vite.config.ts:160` for the loopback default; the actual `host:` line is `vite.config.ts:182` (`:160` ends the auth-popup handler) | Cheap to hit, cheap to fix; a lane following the pointer lands in the wrong block |
| **I355-09** | **P3** | A key-*shaped* literal is committed in a research dossier | `research/multiagent/40_hunt_delegation_algorithms.md:28` — value **redacted**: shape `sk-A********`, length 27, in a "Reproduction (probe)" line (the other three matches are `FUNDED`/`AMBIENT` dummies in `src/lib/llm/providers/key-{rejected,resolution,source}.test.ts`). I cannot prove it is not live; it is shaped like a credential | Even as a fixture it trains the "commit a fake key" habit and trips secret scanners. No real key was found: `git ls-files '.env*'` = only `.env.example` (placeholders), `git ls-files '*.log'` = 0 |
| **I355-10** | **P3** | A no-observation window records `estimatedCostUsd: 0` where the repo's own discipline is "null, never a fake 0" | `scripts/run-eval.mjs:1067-1078` sets `estimatedCostUsd = 0` when `records.length === 0` (its `costBasis` does disclaim it; `run-eval.test.mjs:1425` only pins the *measured* case) vs `doctor.ts:1290` "no ledger … every token field null — a fake 0 is never emitted" | A reader/aggregator can read `0` as "spent nothing"; the same repo calls that a fabricated zero elsewhere |
| **I355-11** | **P3** | The operator `RUNBOOK.md` (19,548 bytes / 354 lines, a root doc) is **untracked**, and no inventory lists it | `git ls-files RUNBOOK.md` = 0; `git status --short` → `?? RUNBOOK.md`; `START-HERE.md:33-36` "Root docs" and `docs-FOLDER-MAP.md:73-91` omit it; `AGENTS.md:24-38` "Read before acting" omits it | It is simultaneously (a) outside every `git ls-files` census the docs use as ground truth, (b) not part of any documented read order, and (c) not guaranteed to exist after a clean checkout — while carrying the §6a/§9 corrections the 354 wave made |

---

## 5. What is genuinely honest (evidence, not vibes)

1. **The `emit --git` repair is real, not claimed.** `headless.ts:3028-3045` (`verifyEmittedDirBeforeCommit`)
   + `:3050-3066` (`landEmittedTree`) return `{ok:false, reason:"tree-run-red", code:"RT_E_TREE_RUN_FAILED",
   dir}` before any git call, so the 346 residual at `AGENTS.md:215` is refuted by the bytes and struck by
   `AGENTS.md:485-489`. The strike text ("re-run `treeRun` immediately before landing", "creates no `.git`")
   matches the code.
2. **Provenance is the strongest part of the doctrine — and it is test-pinned.** `acceptance.ts:192-193`
   refuses a human-seat record, `:332` fails `autonomousFactoryV2` on `forgedHumanStamp`, and four suites
   pin it (`acceptance.test.ts:148-228`, `doctor.test.ts:1345,1420`, `policy.test.ts:371-386`,
   `store.test.ts:2888-2916`, `dod.test.ts:244-315`, `headless.test.ts:3462-3481`). The console seat really
   is UNATTESTED (`policy.ts:295-305,345-348`, `dod.ts:299-306` requires `tokenPath:false`) and a forced
   override really is refused (`force-requires-human-seat`).
3. **Cost honesty holds where it is claimed.** `fleetMetrics.estimatedCostUsd` is hard-coded `null`
   (`acceptance.ts:582,665`) and non-null trips a hard alarm (`:700,736-737`); `doctorSpend` emits a figure
   only under caller prices and labels it "an estimate, not a vendor bill" (`doctor.ts:1387-1391`);
   `run-eval.mjs:1018` refuses to price an undocumented model rather than guess. No path invents a spend number.
4. **Secret handling is clean on the bytes.** No secret via `import.meta.env` (only `VITE_AUTH_ENABLED`,
   `VITE_STUN_URLS`); no `VITE_`-prefixed secret (`key-source.test.ts:92` asserts it); only `.env.example`
   is tracked (`git ls-files '.env*'`), with `sk-...`/`tvly-...` placeholders and the "NEVER prefix any
   secret with `VITE_`" rule at the top; zero tracked `*.log`; `.gitignore:9-16,19` covers `.env`,
   `.env.*`, `!.env.example`, `*.log`.
5. **The `RT_E` doc/coverage test is real and passes its own contract.** `errors.test.ts:436-445`
   (doc ⊆/⊇ codes), `:557-580` (every `guard-registry.json` `expectedCode` resolves in `ERROR_CODE_DOC` —
   verified: 20 distinct codes, all present). Documented-but-unraised = **0**.
6. **Counts that are current are genuinely current.** `START-HERE.md:207-213`'s 354 census re-derives
   exactly today (2,088 / 262 / 250 / 152 / 783 / 139, `node -v` v24.15.0); the CLI verb count 39 and the
   guard count 34 hold wherever they are labelled as such (`AGENTS.md:52`, `:440-444`, `guard-floor.json`).
7. **Some doc/claims guards are real and wired.** `scripts/check-module-coverage.mjs` is an additive
   `gate.sh` stage (`gate.sh:135`, folded into the verdict at `:224`), and `prevention` at `:134`;
   `scripts/brand-check.mjs` + `scripts/docs-module-parity.mjs` exist with suites (`brand-check.test.mjs`,
   `check-module-coverage.test.mjs`). I did **not** verify that `brand-check`/`docs-module-parity` are
   invoked by `gate.sh` — `Select-String scripts\gate.sh -Pattern 'brand-check|docs-module-parity'` finds
   nothing, so they are not gate stages. The gaps in §4 are the ones no guard covers.

---

## 6. What I could not verify

- **Lint warning count.** `lint.problems` is `5` at `AGENTS.md:349` and `null` at `:468`, `README.md:15`
  says "0 … with **5 warnings**". Verifying requires a lint run (writes `.eslintcache` / is a broad run);
  the brief forbids `npm test`/`npm run build`/`gate.sh`, and I chose not to dirty a shared tree. Reported
  as an unresolved internal contradiction, not a verdict.
- **The gate of record / test totals** (`AGENTS.md:180-186,240-256,432-438`; `README.md:449`). Every
  quoted JSON is from a frozen tree at `c16220b`/`2f0e3d7`/`b33c84e`; the current tree is RED by the
  brief's baseline (`npx tsc --noEmit` exit 2 / 5 errors; `npm test` exit 1) and I ran neither.
- **Campaign/product-position numbers** (`workingApp 4/8`, ledger 948,586 tokens, `~US$0.38`,
  `testruns\_report\*`). The artifacts are outside this checkout (`Test-Path testruns\_report` → False;
  the sibling `C:\Users\mnril\Desktop\testruns\_report` exists). I confirmed only the **path** claim and
  that `git ls-files testruns` = 0 — the numbers themselves are not re-derivable here, which is itself
  the finding (§2c rows #31/#32).
- **`guard-floor.json` provenance.** I read the pinned 34 ids and `countFloor:34` (immutable-floor
  mechanism confirmed by reading `replay-harness.mjs:1488-1528,1732-1745`), but I did **not** run
  `verify-prevention.mjs --all --selftest` (it touches `testruns/`, which is outside the repo and absent),
  so I cannot confirm `fixtureIntegrity.missed:[]` / `fixPresence.pending:[]` today.
- **README's 89 KB long tail.** I checked the count/inventory/claim lines and skimmed for checkable
  assertions (`:15, :92, :203, :258, :384, :405, :449, :634, :730` and the dated blocks from `:1040` on);
  I did not read all 1,096 lines, so further stale claims may survive below the sections I touched.
- **Whether `sk-A…` at `research/multiagent/40_hunt_delegation_algorithms.md:28` is live.** I report only
  its shape and length and explicitly redacted the value; I have no way to test it, and did not.

---

*Read-only lane. No product file, doc, register or sibling report was modified; this is the only file written.*
