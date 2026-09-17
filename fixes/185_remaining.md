# 185 — Ranked leftover / unwired RapidTool inventory

- **File:** `fixes/185_remaining.md`
- **Date:** 2026-09-09
- **Role:** leftover inventory + honesty-bug lane (`diagnose` / `harvest` only)
- **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (Windows + space in path; local `.git` exists, **no remotes**, GitHub not pushed)
- **Read-only except:** this file; `src/lib/diagnose.ts` + `src/lib/diagnose.test.ts` (patched this pass)
- **Parent-owned (untouched):** `store.ts`, `engine.ts`, `io.ts`, `headless.ts`, `codegen.server.ts`, `deepseek.server.ts`, `brief-fixtures.ts`, `scaffold.ts`, `maker-score.ts`, `compile-check.server.ts`, `dod.ts`, `types.ts`, `console.tsx`, `rapidtool-cli.mjs`
- **Explicitly not bugs:** `sandbox.ts` keyless P6 floor `synthesize(){ok:true}` is INTENTIONAL honesty; `chat.server.ts` is Composer 2.5 sibling-owned
- **Known truth (not rediscovered as news):** 1488/1488 tests, TC 0, lint 0e/18w, build 0; 4/5 Property Ledger jobs are TODO(E-15) stubs (only `track.ts` real ~38KB); eval 9/9 was identifier-stem M1 + stub-oracle green, not a shipped product; ChatPane is one-shot DeepSeek, no tools; node-runner is NOT a security sandbox; GitHub RapidTool repo not pushed (no credentials); A0–A6, B1–B6, 174-1/2/3/5/6/7 landed
- **Factory / competitor-bar:** **NO**

Anchors grepped this pass from inside the repo. Re-grep before any parent patch — parent is live on owned files; ±20 line drift is expected.

## 0. TL;DR

RapidTool is a governed 13-phase harness with a green gate board, not a finished factory. Phase A/B and the named 174-1/2/3/5/6/7 honesty holes landed; what remains is (a) leftover honesty dual-channels (`ok:true`+`error`, missing `RT_E_*`), (b) unwired predicates that look shipped (`shouldPromoteLesson` callers = tests only), (c) stub jobs that the oracle *expects* to throw, (d) advisory swarm / one-shot chat / non-streaming DeepSeek, (e) engine P1 never calling harvest.

This lane patched one real honesty bug in `diagnose.ts`: `none-detected` used to claim **"No error rows in window"** whenever no named heuristic matched, **even when `errors.length > 0`**. Harvest was audited; no fabrication / source-flag lie found; not patched.

## 1. TRUE vs FALSE claims

| Claim | Verdict | Evidence (this pass) |
|---|---|---|
| Four gates green (1488/1488, TC 0, lint 0e/18w, build 0) | **TRUE** (known; not re-run) | Task truth. Do not treat as a factory proof. |
| A0–A6 behavioral oracle path landed | **TRUE** | `fixes/181_a7_a6.md`; A4 TAP re-key at `maker-score.ts:301-314` |
| B1–B6 production wave landed | **TRUE** | `fixes/182_phase_b.md`; `scrubbedEnv` allowlist `node-runner.server.ts:81-108`; `runAcceptance` `headless.ts:96` |
| 174-1/2/3/5/6/7 landed | **TRUE** | `fixes/183_phase_d_wild.md` + 182 B4 + 184 174-6 |
| Keyless floor never fakes model text | **TRUE** (contract) | `AGENTS.md` honesty #2; sandbox P6 `synthesize(){ok:true}` is the **declared** floor, not a bug |
| node-runner is a **bounded runner**, not a jail | **TRUE** (honest label) | `node-runner.server.ts:4-18` |
| ChatPane is one-shot, no stream/stop | **TRUE** (honest UI copy) | `console.tsx:4799`, `console.tsx:4876`; `chat.server.ts:359` `completeDeepSeek` (no `tools`) |
| Harvest never fabricates a repo/license | **TRUE** | `harvest.ts:7-8,398,460`; `source:"llm"` only after usable JSON (`harvest.ts:248`) |
| `knowledge --find` exists | **TRUE** | `rapidtool-cli.mjs:1405-1415`, `knowledge.ts` `findPatterns` |
| RapidTool is a finished software factory | **FALSE** | §4 |
| Eval 9/9 = shipped product / behavioral software | **FALSE** | Identifier-stem M1 (`maker-score.ts:322`) unless `behavioral` TAP is supplied; 4/5 jobs still stub |
| All five Property Ledger jobs are real software | **FALSE** | eval-out: `track.ts` 38670 B; `flip.ts`/`publish.ts`/`record.ts`/`show.ts` ~713–728 B with `TODO(E-15)` at `:11` |
| ChatPane has tools / can act on the project | **FALSE** | `chat.server.ts:359-365` one `completeDeepSeek` call; Composer-owned |
| node-runner is a security sandbox | **FALSE** | Banner forbids the claim (`node-runner.server.ts:13-18`); `FORBIDDEN` (`sandbox.ts:12`) is template-path only |
| GitHub RapidTool repo is published | **FALSE** | `git remote -v` empty this pass; no credentials |
| Keyed swarm dispatches real LLM seats | **FALSE** | `swarm.ts:11-17,90` — "never dispatches"; CLI `advisory: true` (`rapidtool-cli.mjs` swarm case) |
| Keyed synthesis streams to the console | **FALSE** | `deepseek.server.ts:361` `stream: false`; ChatPane copy "no stop/stream yet" |
| `shouldPromoteLesson` gates live lesson writes | **FALSE** | Defined `knowledge.ts:722`; callers = `knowledge.test.ts` only |
| Harvest runs inside the 13-phase engine (P1) | **FALSE** | `grep harvest engine.ts store.ts` = **0**; CLI-only (`rapidtool-cli.mjs:1268` → `headless.ts:2580`) |
| `diagnose` `none-detected` ⇒ no errors in window | **FALSE** (was; **fixed this pass**) | Pre-patch floor lied when rows missed rules 1–8. Now `unclassified-errors` |
| `treeRun.ok` means the entry behaved | **FALSE** | `compile-check.server.ts:667-668` `skip` counts green (pin `compile-check.server.test.ts:304`) |
| `wild --start` on a complete project is a failure | **FALSE** | `headless.ts:2915-2923` `ok: true` + `error:`; `store.ts:1021` `ok: true, ran: 0` |
| Full-corpus keyed eval was run and proven | **FALSE** | `run-eval.mjs:636-640` keyed default still 1 entry; 184 says that run is **not claimed** |
| Wild Auto-Review is a blinded judge | **FALSE** | Prompt injects `Machine-checkable DoD verdict: PASS/FAIL` (`wild-mode.server.ts:123`) |

## 2. Unwired leftover inventory (file:line)

Landed items (A0–A6, B1–B6, 174-1/2/3/5/6/7, 184 decidedBy / `shouldPromoteLesson` *predicate*, A7 emit wipe) are **out** of this list. What remains on disk:

### 2.1 Honesty dual-channel / missing RT_E (P0)

| Id | What | file:line |
|---|---|---|
| 185-H1 | `wildStartRun` on `status==="complete"` returns `ok:true` **and** `error:` | `src/lib/headless.ts:2915-2923` |
| 185-H2 | Store `startWildRun` on complete: `ok:true, ran:0, stoppedReason:"complete"` (no `RT_E_*`) | `src/lib/store.ts:1021` |
| 185-H3 | `deepenResearch` / `runVerifyAsync` missing-project: `{ok:false, error}` **no code** | `src/lib/store.ts:857`, `:870` |
| 185-H4 | `executeAsync` missing project: `"Project missing."` **no code** (startWildRun *does* stamp `RT_E_PROJECT_MISSING` at `:993-994` — inconsistent) | `src/lib/store.ts:1245` |
| 185-H5 | CLI `diagnose` hardcodes `persistHealth:{ok:true}` and `wildRun:null` — rules 1/2/4 never fire from the verb | `scripts/rapidtool-cli.mjs:2010-2046` |
| 185-H6 | `defaultOutputDir` empty `catch` silently falls back to CWD with **no warning field** | `scripts/rapidtool-cli.mjs:324-334` |

### 2.2 Declared / tested / not on the write path (looks shipped)

| Id | What | file:line |
|---|---|---|
| 185-U1 | `shouldPromoteLesson` is a pure predicate; **zero product callers** (C eval-gated promotion not wired) | `src/lib/knowledge.ts:722` (callers: `knowledge.test.ts:448-454` only) |
| 185-U2 | Harvest is CLI + headless wrapper only; **engine P1 never calls it** | `scripts/rapidtool-cli.mjs:1268`; `src/lib/headless.ts:2580-2582`; `engine.ts`/`store.ts` harvest count **0** |
| 185-U3 | `verifyClaims` exists on sandbox; **no product caller** outside tests | `src/lib/sandbox.ts:471` (import sites: `sandbox.test.ts` only) |
| 185-U4 | Lesson read-back is **expandBrief only** — not P6 synthesize / repair / verify prompts (162 C1 leftover) | `src/lib/codegen.server.ts:1242-1256` |
| 185-U5 | Swarm is deterministic advisory; "LLM orchestrator … swarm.ts itself never dispatches" | `src/lib/swarm.ts:11-17,90`; CLI swarm case sets `advisory: true` |
| 185-U6 | DeepSeek client is non-streaming | `src/lib/deepseek.server.ts:361` `stream: false` |
| 185-U7 | ChatPane / `chatOnceServer` — one-shot FLASH, no tools, no stop | `src/lib/chat.server.ts:290,359`; `src/components/console.tsx:4620,4799` |
| 185-U8 | Auto-Review prompt is **not blind** — injects the precomputed DoD pass/fail (162 §9.4 leftover) | `src/lib/wild-mode.server.ts:123-124` |
| 185-U9 | `planning.ts` plan-then-act is crew-server-only; not the 13-phase engine | `src/lib/planning.ts:1-16`; used from `crew.server.ts:1088` |

### 2.3 Stub / floor software that tests treat as green

| Id | What | file:line |
|---|---|---|
| 185-S1 | Emitted job files still throw `TODO(E-15) stub: implement job ${label}` | `src/lib/scaffold.ts:712-718` |
| 185-S2 | Property Ledger eval-out: 4/5 jobs are those stubs; only `track.ts` is real (~38 KB) | `research/eval-out/coffeehouse2home-property-ledger/src/jobs/{flip,publish,record,show}.ts:4,11` vs `track.ts` 38670 B |
| 185-S3 | Oracle rows targeting a stub **assert the throw** (`/TODO\(E-15\) stub/`) — green = "stub still stubs" | `src/lib/scaffold.ts:1246-1252` |
| 185-S4 | M1 without `behavioral` TAP is still identifier-stem coverage | `src/lib/maker-score.ts:301-322` |
| 185-S5 | `treeRun.ok` treats entry `run:"skip"` as green | `src/lib/compile-check.server.ts:667-668`; pin `:304` in the test file |
| 185-S6 | P3/P11 domain surface is "declarations, not implemented bindings (honest)" | `src/lib/engine.ts:413,701` |
| 185-S7 | `ast-mine.ts` / `bench.ts` honestly label regex / synthetic estimates — orientation, not factory proof | `src/lib/ast-mine.ts:1-20`; `src/lib/bench.ts:1-20` |

### 2.4 Operator / Windows / concurrency leftovers (174 not landed)

| Id | What | file:line |
|---|---|---|
| 174-8 | Default emit path `<home>/RapidTool Software/<slug>/` contains a space; no parser test | `scripts/rapidtool-cli.mjs:312-326` |
| 174-13 | `saveProject` write-tmp-rename, **no lock** | `src/lib/headless.ts:74-91` |
| 174-14 | `FORBIDDEN` denylist is the **sync template** path; `treeRun` is full Node | `src/lib/sandbox.ts:12-16` vs `compile-check.server.ts` treeRun |
| 174-15 | No stdout secret redaction after allowlist | `src/lib/node-runner.server.ts` (grep `redact`/`secret-hidden` = 0) |
| 174-18 | Same as 185-H6 (silent CWD fallback) | `scripts/rapidtool-cli.mjs:330` |
| 174-9 | skip-counts-green pin will fight any A3 "entry must behave" tightening | `src/lib/compile-check.server.test.ts:304` |
| 174-F7 | No PreToolUse / plan-only spawn hook | (absent; would be new) |

### 2.5 Phase C / D / E leftovers vs 162 §18.6 DoD

| Phase | 162 done-clause still open | Why |
|---|---|---|
| **C** | Every synthesis/repair prompt carries domain lessons; eval-gated promotion with before/after delta | U4 expandBrief-only; U1 predicate unwired |
| **D** | Keyed swarm = real seats; streaming; blinded judge; durable checkpoint | U5/U6/U8; CLI wild resume *did* land (174-3) but complete-noop is still `ok:true` |
| **E** | Full-corpus keyed re-run + diverse corpus + eval regression + truth-in-docs | `run-eval.mjs:636-640` default 1 keyed entry; 184: run **not claimed**; corpus still real-estate-heavy |

## 3. Ranked next patches — PARENT vs Composer vs this lane

### P0 (honesty: stop lying about success)

| Rank | Id | Patch | Owner |
|---|---|---|---|
| 1 | 185-H1/H2 | Complete-project wild start → `ok:false`, `code:"RT_E_PHASE_ILLEGAL"`, exit 1. Match `execute`'s 0-progress contract (`store.ts:1230-1236`). | **PARENT** (`headless.ts`, `store.ts`) |
| 2 | 185-H3/H4 | Stamp `RT_E_PROJECT_MISSING` on deepen/verify/executeAsync missing-id (mirror `startWildRun:993`). | **PARENT** (`store.ts`) |
| 3 | 185-H5 | CLI `diagnose` must pass real `wildRun` + persist health from the loaded project / log dir, not `{ok:true}` / `null`. | **PARENT** (`rapidtool-cli.mjs`) — diagnose.ts already ranks if the input is honest |
| 4 | 185-U1 | Call `shouldPromoteLesson` on the lesson-accept / knowledge-write path; refuse regression with `RT_E_*`. Predicate already tested. | **PARENT** (`knowledge.ts` write seam + CLI `lesson --accept`) |
| 5 | Chat tools / stream | Out of this lane. | **Composer 2.5** (`chat.server.ts`); UI copy already honest |
| 6 | unclassified-errors | **DONE this pass** | this lane (`diagnose.ts`) |

### P1 (factory-shaped, still not a factory)

| Rank | Id | Patch | Owner |
|---|---|---|---|
| 7 | 185-U4 / C1 | Inject the same `lessonLinesForBrief` into P6 synthesize + repair + verify prompts (byte-parity when memory empty). | **PARENT** (`codegen.server.ts`, `verify.server.ts`) |
| 8 | 185-S1/S2 | Stop emitting TODO(E-15) job files **or** stop scoring them as a 9/9 product. Keyed synthesis must fill the four stub jobs. | **PARENT** (`scaffold.ts`, `codegen.server.ts`) — do not "fix" by deleting the oracle throw-assert |
| 9 | 185-S5 / 174-9 | Split `treeRun.ok` from `run==="skip"` when a headless `.ts` entry exists. Recast the skip pin. | **PARENT** (`compile-check.server.ts`) |
| 10 | 185-U8 | Blind the judge: drop `Machine-checkable DoD verdict` from the Auto-Review prompt; keep unmet ids if needed as evidence, not PASS/FAIL. | **PARENT** (`wild-mode.server.ts`) — parent-adjacent; currently not in the owned list, flag collision |
| 11 | D1 swarm | Either dispatch real bounded seats through `crew.server.ts` or keep the CLI `advisory:true` and **strike** any "swarm ran the phase" copy. | **PARENT** (`swarm.ts` is not parent-owned this wave — coordinate) |
| 12 | D3 stream | `stream: true` + buffered-then-parse to console. | **PARENT** (`deepseek.server.ts`) + **Composer** (ChatPane stop/stream) |
| 13 | 174-8 / 174-18 | Equals-form `--out=`; if `args.out === true` → `RT_E_VALIDATION`; fallback must set `fallback:true` on the envelope. | **PARENT** (`rapidtool-cli.mjs`) |
| 14 | 185-U2 | Opt-in is honest **if docs say so**. If P1 claims "live harvest", wire `harvestForPacket` into engine P1 with the existing empty-hit lesson (`harvest.ts:693`). | **PARENT** (`engine.ts`) — only if the claim exists; otherwise strike the claim |

### P2 (competitor-bar extras; after P0/P1)

| Rank | Id | Patch | Owner |
|---|---|---|---|
| 15 | 174-13 | `saveProject` exclusive lock | PARENT (`headless.ts`) |
| 16 | 174-15 / 174-F7 | stdout redaction + optional pre-spawn deny hook | PARENT (`node-runner.server.ts`) — not a sandbox; a backstop |
| 17 | 174-14 | Do **not** pretend `FORBIDDEN` applies to `treeRun`. Docs already say so. Optional lexical scan is P2, not a jail. | docs / PARENT |
| 18 | Phase E | `--all` keyed corpus with human fixture approve; diverse non-real-estate entries; eval harness regression | operator + PARENT (`run-eval.mjs` already has `--all`) |
| 19 | GitHub push | Needs credentials. Local `git remote -v` is empty. | human |
| 20 | harvest client-bundle | `harvest.ts:28-29` statically imports `*.server.ts`. Today: dynamic import from headless + tests only. If console ever value-imports `extractPatterns`, switch those two to concatenated-spec + `typeof window`. **Not patched** — not a live honesty bug. | this lane, later |

**This lane will not take P0 1–5 or P1 7–14** — those files are parent/Composer-owned. Residual this-lane work after unclassified-errors: none unless harvest is pulled into a client graph.

## 4. Factory / competitor-bar met?

**No.**

162 §18.6 Phase E done-clause requires a full-corpus keyed re-run whose **approved fixtures pass on LLM trees**, diverse corpus, eval regression, and a final audit of 8–9/10. None of that is claimed (184: keyed `--all` "is **not** claimed here"). Competitor bar (SSSF `run.finish(accepted=)`, Codex secret-strip-before-exec already partially landed as B4 allowlist, blinded judge, real multi-job software) is not met:

- The Property Ledger "product" is **one real job + four throw-stubs** whose oracle **asserts the throw**.
- M1 can still go green on identifier stems when `behavioral` is absent (`maker-score.ts:322`).
- Swarm does not dispatch (`swarm.ts:11`).
- Chat cannot tool-call (`chat.server.ts:359`).
- `treeRun` is not a sandbox (`node-runner.server.ts:5`) and `skip` is green (`compile-check.server.ts:667`).
- Complete-project wild start is `ok:true` (`headless.ts:2917`).

Green 1488/1488 is a **test board**, not a factory.

## 5. diagnose.ts / harvest.ts honesty audit

### diagnose.ts — **real bug, patched**

**Bug.** `buildDiagnosis` ranked rules 1–8 then fell through to `NONE_DETECTED` (`class:"none-detected"`, summary **"No error rows in window"**). That summary is only true when `errors.length === 0`. A lone `sys.uncaught_error`, a single `llm-call` (rule 3 needs ≥2), or the engine's live `hydrate.repaired` event (`engine.ts:2364`; diagnose rule 5 listens for `hydrate.recovered_corrupt` only) all produced a clean-looking `none-detected` while `errors[]` was non-empty. The existing test at `diagnose.test.ts` "errors array renders code…" already fed a `wild.step_error` **without** a paused run and never asserted `mostLikelyCause.class` — so the lie was unpinned.

**Fix (this pass).** After rule 8, if `matches.length === 0 && errors.length > 0`, emit `class:"unclassified-errors"` with `errors[i]` evidence and an action that says do not treat diagnose as none-detected. Empty window still `none-detected`. `ok:true` / `exit_code:0` stay — those mean "diagnosis JSON built", not "project healthy".

**Tests.** `src/lib/diagnose.test.ts` +3 honesty cases. Ran:

```
node --experimental-strip-types --test src/lib/diagnose.test.ts
# tests 14  pass 14  fail 0
```

Client-bundle: `diagnose.ts` has no `node:fs`; already imported by `rt-client.ts`. No new imports.

### harvest.ts — **no patch**

Audited `buildHarvestQueries` / `harvestRepos` / `harvestForPacket` / `harvestResultLesson`:

- `source:"llm"` only after configured + ok + parseable non-empty queries (`harvest.ts:235-248`); else `"keyword"` + note.
- Hits only from `github.com` URLs (`githubRepoOf`, `:273-288`); empty search → honest empty (`:398`).
- `license` absent unless GitHub API returned `spdx_id`/`name` (`:428-446`).
- Negative evidence lesson on empty/rate-limit (`:693-711`) — does not fabricate repos.

Not a product-path honesty bug. Engine P1 unwired is an **inventory** item (185-U2), not a harvest.ts lie. Static `import` of `deepseek.server.ts` / `websearch.server.ts` (`:28-29`) is fine while consumers are headless dynamic import + tests; concatenated-spec only if a client graph grows.

## 6. Verification log

| Check | Result |
|---|---|
| 162 §18 / 170_b leftovers vs landings 181–184 | A0–A6, B1–B6, 174-1/2/3/5/6/7 treated as landed; remainder inventoried |
| 174 items still live | 174-8, 174-9, 174-11 (H1), 174-12 (partial — wild missing-id now coded, deepen/verify not), 174-13, 174-14, 174-15, 174-18 |
| eval-out Property Ledger sizes | track 38670; flip 713; publish 728; record 723; show 713 |
| `git remote -v` | empty (no GitHub push) |
| diagnose tests | 14/14 pass (owned suite only; full `npm test` not run) |
| harvest | audited, not edited |
| Parent-owned files | not edited |
| `sandbox.ts` / `chat.server.ts` | not edited |

**Do not run full `npm test` / four-gate while parent is mid-edit on owned files.**
