# 339-6 · Spine — "continuously improves" (keyed A/B) + the airtight `tested` mint

**Lane:** 339-6 (Spine). **Opened** 2026-10-02 at HEAD `c4348f4`, tree clean.
**Owned (STRICT):** `src/lib/verify.ts`, `entry-oracle.ts`, `harvest.ts`, `knowledge.ts`
+ colocated tests (`entry-oracle.test.ts`, `harvest.test.ts`, `knowledge.test.ts`,
`verify.server.test.ts`). `verify.test.ts` is lane 339-1's — read, never edited.
`verify.server.ts` is NOT owned this wave (339-1). **Scratch:** `%TEMP%\rt339_6\`.
**Keyed budget:** 2 · **used: 2 / 2** (reported below).

## Step 0 — claimed / on disk / still open

**Claimed:** (1) the factory "continuously improves" — a second run on the same brief gets a
measurably better P6 expansion because run 1's harvested/ranked lesson is seeded into it;
(2) `label:"tested"` can never be minted without a genuine green runner result.

**On disk at open (verified today, `file:line`):**
- Lesson ranking/seeding primitives real: `knowledge.ts:91` `rankBriefLessons`, `:129`
  `lessonLinesForBrief`, `:1056` `selectLessons`, `:1476` `failureLessonFromRecord`.
- The ACTUAL P6 expansion site consumes `project.memory` lessons: `codegen.server.ts:3876`
  (spec expand → `expandBrief(brief, undefined, lessons)` via `:3456`), `:3968` (single
  module), plus the tree chunks. 338-6 proved (deterministically) a real `runCases` failure
  anchors an L3 row that reaches this site's `lessons` argument.
- 338-6's two fixes are on disk: `entry-oracle.ts:443` refuses a row field its check never
  evaluates; `verify.ts:199` commits the oracle case set in the evidence hash, and the
  `codegen.server.ts` twins were aligned by 338-1b (`verifyEvidenceHash`, shared).

**Still open at open:**
- The loop's *effect on the model* was never measured — 338-6 stopped at "the expansion INPUT
  bytes change". That is the half this lane settles.
- The client `tested` mint (`verify.ts:229`) trusts `status:"passed"` alone: an envelope with
  `cases: []` or empty `evidence` could still stamp `tested` (read as proof by `maker-score.ts`
  M4 and `judgment.ts`, which check label+hash, not `detail`).
- `runEntryOracle` (the shared runner consumed directly by `run-eval.mjs`
  `evaluateEntryRunsRow`) vacuously satisfied an empty-string `expectStdout`/`expectStderr`
  pin (`String(out).includes("")` is always true) and silently coerced a non-integer
  `expectExit` to the default 0.

---

## Gap 1 — the keyed A/B: "continuously improves" is REAL, measured (2 keyed calls)

Probe: `%TEMP%\rt339_6\ab_probe.ts` — drives the ACTUAL site `codegen.server.ts
liveP6Synthesis` twice on the same brief with the real `expandBrief` injected, a `complete`
stub that stops after the expansion, and a **fetch tap that hard-refuses call #3**.

Run 1 = no lesson (`project.memory: []`). The same run's deterministic machine-run failure
(`runCases(src, [column-order-persisted-after-reload])` → `pass:false`) mints the anchored L3
row `lesson-verify-failure-a1425c10` via `failureLessonFromRecord`, persisted to
`project.memory` by `applyVerifyOutcome` (the 338-6 rail, 0 keyed calls). Run 2 = that lesson
seeded. **2 keyed calls total** (the cap tripped at zero).

```
runCases pass: false | results: [{"id":"column-order-persisted-after-reload","pass":false,"detail":"false"}]
harvested lesson: lesson-verify-failure-a1425c10
memory rows carrying the lesson: 1

[RUN-1 no-lesson] expand lessons = undefined
[RUN-2 seeded]    expand lessons = ["[episodic 0.22] L3 verify-failure: ... column-order-persisted-after-reload: false; evidenceHash=640689f9."]

prompt#1 has PRIOR LESSONS block: false
prompt#2 has PRIOR LESSONS block: true
prompt#2 carries the harvested case id: true
prompt bytes: 2810 -> 3149 (delta 339)

specs byte-identical: false
  requirements: 8 -> 11   edgeCases: 12 -> 12   typeSignatures: 20 -> 15
  dataFlow: 15 -> 11      negativeConstraints: 10 -> 9
  edgeCases ADDED: [ ... "Reordering a card within a column and reloading must yield exactly
                    the same card order (guards prior failure: column-order-persisted-after-reload)." ... ]
  requirements ADDED: [ ..."persist the resulting order so it survives a page reload"...

tap records: [
  {"requestedModel":"deepseek-v4-flash","servedModel":"deepseek-flash","promptTokens":594,"completionTokens":1490,"code":null},
  {"requestedModel":"deepseek-v4-flash","servedModel":"deepseek-flash","promptTokens":675,"completionTokens":1511,"code":null}
]
keyed calls made (fetch): 2
```

**Verdict: the loop is REAL and load-bearing through the MODEL boundary, not just the input.**
The seeded lesson (a) appears verbatim in the real expansion prompt the model received
(+339 bytes, the `Known failure modes from prior runs` block, carrying the harvested case id),
and (b) the emitted spec **explicitly guards the harvested failure** — an edge case naming
`column-order-persisted-after-reload`, plus requirements that persist card/column order across
reload. Run 1's spec contains no such case id (it only exists as run 1's failure).

**Named residual (do not overclaim):** n = 1 per arm, and both specs differ wholesale because
the model is stochastic — the *whole* delta is NOT attributable to the lesson. The
attributable, measured signal is exactly two things: the lesson rides the real prompt, and the
run-2 spec carries an explicit guard of the harvested case. A pass-rate claim ("run 2 is better
on average") is NOT measured and is not made.

**Traceable, not fabricated:** `runCases` was the real local runner; the lesson id is
content-addressed; the prompts and usage are the tap's own records.

---

## Gap 2 — Fix A: the `tested` mint refuses a hollow "passed" envelope (RED → GREEN)

`verify.ts` `applyVerifyOutcome` minted `label:"tested"` from `status === "passed"` alone. A
genuine `verify.server.ts` pass always carries BOTH the non-empty case set it evaluated and a
non-empty evidence string; an envelope with a present-but-empty `cases` or no evidence is
hollow, yet still stamped `tested` — which `maker-score.ts` M4 and `judgment.ts` read as
machine proof. Now refused on the existing no-state-change path. Also: a foreign (non-array)
`cases` value threw out of this "never throws" seam.

- **RED** (`verify.server.test.ts`, `--test-name-pattern=339-6`): `# tests 4 / pass 1 / fail 3`
  (empty case set, whitespace evidence, non-iterable `cases`).
- **GREEN**: **4 / 4 / 0**, both runtimes.

**Known limit (STOP-and-REPORT):** an envelope with an ABSENT `cases` field is still accepted,
because `verify.test.ts:286-311` (lane 339-1) pins that exact shape for the 337-3 hash test.
Closing it fully needs that test to carry a case set — exact shape recorded below.

## Gap 2 — Fix B: `entry-oracle` runner sibling hunt (RED → GREEN)

`runEntryOracle` accepted a declaration it could never evaluate: an empty-string
`expectStdout`/`expectStderr` (satisfied by `includes("")` on EVERY run) and a non-integer
`expectExit` (silently defaulted to 0). The validator refuses both, but this module is the
shared runner `run-eval.mjs` `evaluateEntryRunsRow` calls directly — so the runner now refuses
them too, before the spawn. Same "a verifier that cannot fail" class as 338-6, one layer down.

- **RED** (`entry-oracle.test.ts`, `--test-name-pattern=339-6`): `4 / pass 1 / fail 3`.
- **GREEN**: **4 / 4 / 0**, both runtimes.

## `tested`-minting audit table

| # | Path (`file:line`) | Reachable? | Status |
|---|---|---|---|
| 1 | `verify.server.ts:1205` `status:"passed"` (via `runCases` green) | yes (product) | NOT mine (339-1); zero-case / no-callable / no-export-ref / forged-dup / compile-fail guards at `:521,:569-608,:614,:621-641` |
| 2 | `verify.ts:229` `label:"tested"` (client apply) | yes (store/CLI/headless) | **closed here** for present-but-empty `cases` + empty evidence (Fix A); absent-`cases` residual → STOP-and-REPORT |
| 3 | `codegen.server.ts` `upgraded()` tested stamp | yes (keyed P6) | NOT mine; guarded by the real verify pass it consumed |
| 4 | `codegen.server.ts` `mintTreeRunTested` | yes (keyed P6) | NOT mine; `ev.executed` requires ≥1 spec file AND ≥1 assertion |
| 5 | `headless.ts` `promoteEmittedTreeTested` | yes (CLI) | NOT mine (339-3); label-flip + hash-change guard |
| 6 | `rapidtool-cli.mjs:2152,:2636` tested stamps | yes (CLI) | NOT mine; verdict-derived |
| a | empty case set | yes | `runCases:521` (338-6/prior) + **Fix A** at the client mint |
| b | error-vs-fail confusion | yes | `verify.ts` `passed = status === "passed"`; `"error"` never mints; unchanged |
| c | case set never references an export | yes | `runCases:621-641` (328/330); not my file |
| d | hash collision / dedupe drops a different source | latent | 337-3 + 338-6 (`verify.ts:199`) + codegen twin alignment (338-1b). Residual: FNV-1a is non-cryptographic and the `\u0002` separator has no length prefix — declared repo limits, no verifier output carries `\u0002` |
| e | oracle row whose declared field is ignored | latent (direct call) | 338-6 validator gate (`:443`) + **Fix B** at the runner |

## Part 3 — entry-oracle module audit (declared-but-not-checked / vacuous / always-0)

| Finding | Reachable? | Disposition |
|---|---|---|
| `runEntryOracle` empty-string stdout/stderr pin vacuously true | latent (direct call; validator refuses) | **closed** (Fix B) |
| `runEntryOracle` non-integer `expectExit` silently → 0 | latent (direct call) | **closed** (Fix B) |
| `runEntryOracle` `args` ignored in `mode:"import"` | latent (validator refuses at `:470`) | **reported, NOT closed** — an import still actually runs, so no hollow green is minted; minimal-patch rule |
| `checkEntryContract` `ok: rows.every(≠fail)` vacuously true on ZERO rows | yes (empty `expectedBehavior: []`) | **must stay true**: `run-eval.mjs:2437` vetoes only on `behaviorOk === false`, so clearing it would red every legacy "files+content only" grader. Disambiguated by `complete:false` + `note` (`:389,:390`) |
| `pending` counter is structurally always 0 | no status can be `"pending"` | honest; pinned by `run-eval.test.mjs:1439` |
| `oracleBriefGrounded` returns `ok:true` for a vocabulary-free brief | yes | declared in its own docstring; `runCases`' export-reference gate still applies (never a fully vacuous pass) |
| `validateExpectedBehavior` field-scope gate (338-6) | — | re-audited: `file-exists→{path}`, `package-target-exists→{target}`, `uiShell→{uiShell}`, else `{entry,mode,args,expectExit,expectStdout,expectStderr,timeoutMs,uiShell}`; no accepted-but-unevaluated field remains |

## Keyed usage

**2 / 2.** Both `deepseek-v4-flash` (served `deepseek-flash`). Call 1: 594 prompt / 1490
completion. Call 2: 675 prompt / 1511 completion. `npm run eval` never run; no secret printed;
`.env` read only to inject the key into the probe's `process.env`.

## Mock/fake census (changed files)

Scripted over `verify.ts`, `entry-oracle.ts`, `entry-oracle.test.ts`, `verify.server.test.ts`
(and re-checked owned `knowledge.ts`, `harvest.ts`): no `TODO`/`FIXME`/`as any`/`@ts-ignore`/
`@ts-expect-error`/silent `catch {}`/`assert.ok(true)`/`.only(`/unconditional `.skip`. The only
hits are PRE-EXISTING test transport (`mockChat`, injected `fake` DeepSeek seams at
`verify.server.test.ts:85/123+`) and prose ("placeholder") in existing strings; none are in the
bytes this lane added. `runEntryOracle`'s one spawn in the new test is a REAL bounded child
process; the A/B's "stub" seams are inverted real seams (the real `expandBrief` runs; the
`complete` stub exists to STOP after the expansion, and it never fabricates a verdict).

## STOP-and-REPORT (unowned — not applied)

1. **`src/lib/verify.test.ts`** (lane 339-1) — to close the last hollow-`passed` path at the
   client mint, the two 337-3 outcomes need a case set. Exact shape (current line numbers after
   339-1's own edits; the 337-3 describe is at `:335`):
   - after `finalSource: "abc",` (`:342`): add `cases: [{ id: "case-1", expression: "add(2,3) === 5" }],`
   - after `finalSource: "abcD",` (`:353`): add `cases: [{ id: "case-1", expression: "add(2,3) === 5" }],`
   Then `verify.ts`'s guard can tighten from "present-but-empty" to "must be a non-empty array"
   (`emptyCaseSet` → `!(Array.isArray(outcome.cases) && outcome.cases.length > 0)`), which then
   also refuses an ABSENT `cases`. Reported, not applied (other lane's file).
2. **`src/lib/verify.server.ts`** (lane 339-1): `runCases`' rejected-case detail at `:550-553`
   — the runner-side path is that lane's; observed mid-edit (2 red tests there today, none on
   my files' path).

## Verification (real command output)

Owned suites, Node **24.15.0** (host) and Node **22.23.2** (`%LOCALAPPDATA%\hermes\node`) —
identical:

```
entry-oracle.test.ts      12 -> 16 tests   16/16/0     (both runtimes)
verify.server.test.ts     46 -> 50 tests   50/50/0     (both runtimes)
verify.test.ts (full, 339-1's file)        31/31/0     (my change keeps it green; 337-3 + 338-6 blocks both pass)
harvest.test.ts + knowledge.test.ts        96 tests / 95 pass / 1 skip  (unchanged)
headless.test.ts E-06 block                 3/3/0      (consumer)
compile-check.server.test.ts (entry-oracle consumer) 83 tests / 82 pass / 1 skip / 0 fail
```

Targeted `eslint` on the four changed files: exit 0, 0 warnings. Filtered `tsc --noEmit`:
**0 errors in any file this lane touched** (the unfiltered project typecheck is nonzero because
five sibling lanes are mid-edit; not run as a gate).

**Observed mid-wave, NOT this lane:** at one point `verify.test.ts` read two red `runCases` tests
(`surfaces the rejected case id and the sanitizer's own reason on every row`; the `runCases
safety guards` suite) — a transient snapshot while lane 339-1 was mid-edit on
`verify.server.ts`/`verify.test.ts`; none of `verify.ts`/`entry-oracle.ts` is on that path.
Re-measured at the end of this lane: `verify.test.ts` **31/31/0** (339-1's fixes landed), so the
interim red is gone and my change leaves that file fully green.

## What I did NOT do and why

- Did **not** run the full gate, `npm test`, `npm run build`, or `npm run eval` — six lanes are
  mid-edit (the working tree shows sibling edits in `codegen.server.ts`, `dod.ts`, `packet.ts`,
  `prompt-engine.ts`, `verify.server.ts`, the llm providers, …).
- Did **not** edit `verify.test.ts`, `verify.server.ts`, or any consumer — other lanes' files.
- Did **not** re-run the keyed probe (would exceed the 2-call budget; the output above is the
  single real run).
- Did **not** claim a pass-rate improvement — only the measured prompt/spec effect at n=1.
- Did **not** close the absent-`cases` client-mint path (needs 339-1's test; STOP-and-REPORT 1).
