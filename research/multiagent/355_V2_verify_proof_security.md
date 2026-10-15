# 355 V2 — Adversarial verification of five audit-lane claims

**Verdict:** READ-ONLY verification on HEAD `30bce78` (dirty tree). No server started, no keyed
call, no `npm test` / `npm run build` / `gate.sh`, no selfmod invocation, no product file touched.
Scratch scripts live in `%TEMP%` (`rt_verify_c14.mjs`, `rt_verify_stale.mjs`).

| Claim | Verdict | One-line |
|---|---|---|
| A | **CONFIRMED (with a count correction)** | 1 of 17 real `createServerFn` invocations is guarded; the 19/12 figure is raw grep (includes a string literal + a doc comment). Not exploitable in the shipped default; exploitable once auth is switched on (the documented deploy config). |
| B | **CONFIRMED (severity overstated)** | `ok:true` really is returned for `finish_reason:"length"`; the P6 consumer re-detects truncation from the raw text, so the "silent JSON acceptance" consequence does not land as described. |
| C | **PARTLY** | Default 1-case sample ✔, in-run-only grader freeze ✔, stale record + reader dropping `stale` ✔ (proved live). The "picks the cheapest case" mechanism is **false** — selection is alphabetical order, not cost. |
| D | **CONFIRMED** | Live probe: the C-14 control returns `false`, so `mutationRed` can never be `true`. |
| E | **CONFIRMED (M2 wording imprecise)** | Six entry points, zero non-test callers, no `selfmod` arm in the 39-arm CLI; the behavioral branch is dead. But M2's non-behavioral score is a tree-run, not an identifier-substring score. |

---

## CLAIM A — only 1 of the server functions is guarded

### Commands and raw output

Census of real invocations (test files and comment lines excluded):

```
Get-ChildItem -Recurse -File src -Include *.ts,*.tsx |
  Where-Object { $_.Name -notmatch '\.(test|spec)\.' } |
  Select-String -Pattern 'createServerFn\(' |
  Where-Object { $_.Line -notmatch '^\s*(\*|//)' }
```

```
src\lib\auth\account.ts:28      const fetchVerifiedAccount = createServerFn({ method: "GET" })
src\lib\chat.ts:20              const chatServer = createServerFn({ method: "POST" })
src\lib\chat.ts:38              const chatContextServer = createServerFn({ method: "POST" })
src\lib\crew.ts:172             const runCrewServer = createServerFn({ method: "POST" })
src\lib\crew.ts:179             const statusServer = createServerFn({ method: "GET" }).handler(...)
src\lib\exec.ts:62              const runServer = createServerFn({ method: "POST" })
src\lib\fixtures.review.ts:15   const fixturesServer = createServerFn({ method: "POST" })
src\lib\llm.ts:83               const completeServer = createServerFn({ method: "POST" })
src\lib\llm.ts:154              const statusServer = createServerFn({ method: "GET" }).handler(...)
src\lib\llm.ts:205              const callModelServer = createServerFn({ method: "POST" })
src\lib\preview-compile.ts:17   const compileServer = createServerFn({ method: "POST" })
src\lib\research.ts:230         const researchServer = createServerFn({ method: "POST" })
src\lib\research.ts:241         const statusServer = createServerFn({ method: "GET" }).handler(...)
src\lib\verify.ts:36            const verifyServer = createServerFn({ method: "POST" })
src\lib\wild-bridge.ts:26       const planServer = createServerFn({ method: "POST" })
src\lib\wild-bridge.ts:47       const classifierServer = createServerFn({ method: "POST" })
src\lib\wild-bridge.ts:72       const edgeServer = createServerFn({ method: "POST" })
```

(The raw `createServerFn\(` grep returns **19** lines across **12** files — exactly the lane's
figure — but two of those are not invocations: `src/lib/app-data/client.server.ts:278` is a
string literal `'a createServerFn({ method: "POST" }) handler'` and
`src/lib/auth/middleware.ts:14` is a doc-comment example. **True count: 17 invocations, 10 files.**)

Guard census — the only `.middleware(` in non-doc code:

```
Select-String -Path src\lib\auth\account.ts -Pattern '\.middleware\('
```
```
src\lib\auth\account.ts:29: .middleware([authMiddleware])
```

No global registration exists that could cover the other 16:

```
Select-String ... -Pattern 'createStart|globalMiddleware|requestMiddleware|createMiddleware'
```
```
src\lib\auth\middleware.ts:1   import { createMiddleware } from "@tanstack/react-start";
src\lib\auth\middleware.ts:28  export const authMiddleware = createMiddleware({ type: "function" })
```

`requireUserId` / `assertSameSiteRequest` are called from exactly one server-function path —
inside `authMiddleware` (`src/lib/auth/middleware.ts:44,47`). No other `*.ts`/`*.tsx` file calls
either one (`src/lib/app-data/client.server.ts:210` calls `assertSameSiteRequest()` in a
non-`createServerFn` module).

### Analysis

The security substance holds: all 16 unguarded endpoints — including the money-spending
`llm.ts` (`completeServer`, `callModelServer`) and the code-executing `exec.ts` (`runServer`) —
run their handlers with no session/identity check. `exec.ts:62-77` imports the private bounded
runner and executes `data.code` unconditionally.

**Exploitability depends on the flag, and the honest answer is "not by default":**

- Shipped default `VITE_AUTH_ENABLED=false` (`.grok/app-env.json:2`): auth is *intentionally*
  off; `requireUserId()` resolves the shared `dev-user`, so the app is a single-user local tool
  by design. There is no identity to bypass — this is not a latent break in the default.
- With `VITE_AUTH_ENABLED=true`: `src/routes/__root.tsx` gates *routes*, but TanStack Start
  server functions are separate HTTP endpoints. Nothing server-side checks the session on those
  16 endpoints, so an unauthenticated client can POST directly to them and spend the server's
  `DEEPSEEK_API_KEY` and execute generated code. Only `fetchVerifiedAccount` (a read-only
  identity echo) is protected. This is the real exposure, and it is the *documented deploy
  configuration*: `agentnotes.md:1593` records the Deployer injecting `VITE_AUTH_ENABLED=true`.

So: **CONFIRMED** — but scoped as "unauthenticated *when auth is on*", not "exploitable by
default." The count should be reported as **17 invocations / 10 files**, 1 guarded.

---

## CLAIM B — `ok:true` for `finish_reason:"length"`; truncation note only on the empty branch

### Commands and raw output

`src/lib/llm/providers/deepseek.ts` — `finish_reason` handling census:

```
Select-String -Path src\lib\llm\providers\deepseek.ts -Pattern 'finish_reason|finishClass|classifyFinishReason|"length"'
```
```
624: // W61 lane D (D4): insufficient_system_resource ... retry it here
632: if (finishReasonOf(rawSuccess) !== "insufficient_system_resource") break;
712: const reason = parsed.choices?.[0]?.finish_reason;
713: const finishClass = classifyFinishReason(reason);
718: const lengthNote = finishClass === "length" ? "; stopped at max_tokens (finish_reason length)" : "";
```

The success return:

```
748: const usage = usageFromParsed(parsed);
749: return {
750:   ok: true,
751:   text: content.trim(),
752:   model: ...,
```

`finishClass` is computed only inside the empty-content guard at `:705`
(`if (typeof content !== "string" || content.trim() === "")`), and `lengthNote` is used only in
the `ok:false` refusal at `:742`. The **only** `finish_reason` read on the success path is the D4
retry loop at `:630-636`, which breaks unless the value is `"insufficient_system_resource"` —
`"length"` is never consulted there. (`finishReasonOfRaw200` has zero usages anywhere.)

`LlmResult` ok-arm (`src/lib/llm.ts:62-70`):

```
export type LlmResult =
  | { ok: true; text: string; model: string; usage?: LlmUsage }
  | { ok: false; reason: "not-configured" | "error"; error?: string; usage?: LlmUsage; code?: ErrorCode };
```

No `finishReason` / `truncated` field on the ok-arm — confirmed.

Spec (`research/deepseek-api.md:241-243`):
> `length` ⇒ output was truncated (budget or context exhausted): raise `max_tokens` or trim input.
> With JSON mode this means the JSON may be cut — **treat as failure/retry**.

### Analysis — the layer facts are true; the P6 consequence is overstated

Every mechanical assertion in the claim is correct: a reply with `finish_reason:"length"` and
non-empty content is returned `ok:true`, the truncation note is unreachable on that path, and the
result type cannot carry the signal. That is a genuine loss of information at the LLM boundary.

But the stated consequence — "a truncated JSON body silently accepted as ok would be severe" for
P6 synthesis — does **not** land, because the one consumer that matters re-derives truncation from
the raw text. `liveP6Synthesis` (`src/lib/codegen.server.ts:7184`) feeds `res.text` (not a typed
flag) into `parseSynthesisEnvelope` (`:4960`), which on `JSON.parse` failure runs `jsonScan` and
emits a coded `truncated-json` read failure (`:4979-4994`); a cut inside the `module` string
returns `null`, and the caller re-asks with an explicit byte budget
(`p6SynthesisTruncationRepairPrompt`, `:7193-7205`) or refuses
(`"model returned an unparseable synthesis envelope after one repair attempt"`, `:7208`). A
truncation that did not cut into `module` is deliberately closed by `tryCloseTruncatedJson`
(`:4987`) — an intended recovery, and the recovered module still has to clear
`validateSynthesisModule` + brief-fit + pre-seal typecheck (`:7222-7238`).

So: **CONFIRMED as to the bytes; the "silent acceptance" severity is REFUTED for P6.** The honest
framing is "the provider drops the truncation signal; the JSON consumer recovers it by text
scanning", i.e. a design-fragile re-derivation, not an unmitigated data-integrity hole.

---

## CLAIM C — the acceptance "ok rate" is not trustworthy

### Sub-claim 1 — keyed runs default to a 1-case sample. **TRUE.**

`scripts/run-eval.mjs:3285`:
```
const cap = EVAL_ALL ? targets.length : Number.isFinite(EVAL_LIMIT) && EVAL_LIMIT > 0 ? EVAL_LIMIT
  : mode === "keyed" ? 1 : targets.length;
const selected = targets.slice(0, cap);
```
Record: `node -e "const r=require('./research/eval-out/results.json'); ..."`
```
mode: keyed | stale: true | entries: 1 | slugs: coffeehouse2home-property-ledger
summary: {"entries":1,"meanTotal":0.3333,"cases":1,"passAtK":{"k":1,"cases":1,"passed":0,...}}
```

### Sub-claim 2 — grader bytes are frozen only WITHIN a run. **TRUE.**

`graderFreezeAtStart` is captured before the first entry (`:3279-3281`) and re-verified just before
persist (`:3431`, `graderFreeze = verifyGraderFreeze(graderFreezeAtStart)`).
`verifyGraderFreeze` only compares `hashAtStart` to `hashNow` (`reasons: "unreadable-since-start" /
"bytes-changed-mid-run"`). Nothing pins the grader hash across runs, and the persisted block is
only `{"checked":7,"ok":true,"changed":[]}` — **no per-file hash lands in the record**. Editing a
grader JSON between runs silently becomes the new bar with no trace.

### Sub-claim 3 — `--limit=1` / reordering "picks the cheapest case". **FALSE as worded.**

`listCorpusEntries()` (`:387-391`) does `readdirSync(CORPUS_DIR).filter(f => f.endsWith(".md")).sort()`
— plain alphabetical, no cost/price/size ordering (no `cost`/`cheap` sort exists in the file).
`planTargets` preserves that order and `selected = targets.slice(0, cap)`. The real first `.md` is
`arcade-breakout.md`; it has no grader, so the default target is the alphabetically-first *graded*
entry, `coffeehouse2home-property-ledger`. Order-dependence is real; "cheapest" is not supported
by any byte.

### Sub-claim 4 — the consumed record is a stale 1-case record and the reader drops `stale`. **TRUE (proved live).**

`research/eval-out/results.json:1-10`:
```json
{ "generatedAt": "2026-09-25T00:03:43.504Z", "mode": "keyed",
  "stale": true, "staleStampedAt": "2026-09-29T21:45:54Z",
  "staleNote": "312 C5 ... read-side censuses report 'absent 1' by design ..." }
```

Consumer chain: `scripts/rapidtool-cli.mjs:3327` (`dir` = `research/eval-out`) → `:3350`
`readText(resultsPath)` → `:3363` `sc.parseEvalResults(resultsRead.text)`. The reader
(`src/lib/scorecard.ts:158-171` `EvalResultsDoc`, produced at `:280-300`) copies only
`generatedAt, mode, corpusDir, graderDir, graderFreeze, entries, sourceSummary, skips` — **no
`stale` / `staleStampedAt` / `staleNote` field exists**. Live proof
(`node --experimental-strip-types %TEMP%\rt_verify_stale.mjs`):

```
RAW record keys: generatedAt,mode,stale,staleStampedAt,staleNote,corpusDir,graderDir,graderFreeze,entries,summary
RAW stale: true | staleStampedAt: 2026-09-29T21:45:54Z
parseEvalResults ok: true
PARSED value keys: generatedAt,mode,corpusDir,graderDir,graderFreeze,entries,sourceSummary,skips
PARSED carries stale?: false
PARSED entries count: 1
```

**Verdict: PARTLY** — three of four sub-claims hold (and the fourth is proven by execution), but
the "cheapest case" mechanism is refuted.

---

## CLAIM D — C-14 is permanently pending because its control is built from a keyed build.json

### Commands and raw output

Named build.json:

```
Select-String -Path testruns\office-stock-tracker\build.json -Pattern 'p6\.synthesis\.attempt' -AllMatches
  → p6.synthesis.attempt x6
  → p6.synthesis.refused x2
```

Probe polarity (`src/lib/dod.ts:~1409-1421`): with no tree, `probe` returns
`!(newest === "p6.synthesis.attempt" || newest === "p6.synthesis.refused")`, where
`newestSynthesisEvent` takes the **last** `p6.synthesis.*` log row.

Harness seam (`scripts/prevention/replay-harness.mjs:587-595`):
```
const base = readJsonFile(join(ctx.runRoot, "office-stock-tracker", "build.json"));
...
wired:      item.probe(sentinel)                     === false,
mutationRed: item.probe({ ...base, generatedTree: [] }) === true,
```

**Live probe** (`node --experimental-strip-types %TEMP%\rt_verify_c14.mjs`), which imports the real
`headless.loadProject` + `dod.DOD[6]`:
```
generatedTree length in build.json: 2
p6.synthesis.* log rows: 8
newest p6.synthesis.* event: p6.synthesis.refused
CLAIM-D control probe({...base, generatedTree:[]}) = false (mutationRed requires true)
CLAIM-D wired probe(sentinel with keyed attempt) = false (wired requires false)
```

Twin defect, `scripts/guards/gate-invariants.test.mjs:205-213`:
```js
const base = headless.loadProject(join(TESTRUNS, "office-stock-tracker", "build.json"));
const keylessNoTree = { ...base, generatedTree: [] };
assert.equal(item.probe(keylessNoTree), true, "the keyless floor (no keyed attempt) still passes");
```
Same `base`, same `generatedTree: []` — the control is *not* keyless: its logs already record
`p6.synthesis.attempt` ×6 / `p6.synthesis.refused` ×2, so `newestSynthesisEvent` is `"refused"`
and the probe is `false`, not `true`. The assertion is unsatisfiable.

### Analysis

"C-14 can never pass" is the **correct** conclusion, and it is now verified by execution rather
than by reading. `mutationRed` is `item.probe({ ...base, generatedTree: [] }) === true`; `base` is
a static fixture on disk whose logs already carry terminal keyed-synthesis events, so the control
returns `false` every time. Since the harness requires `mutationRed` to prove the guard
discriminates (`:418` `ABSENT` and the `mutationRed: !!(c && c.mutationRed)` aggregation at
`:744-946`), C-14 is permanently `pending`. The identical construction in
`gate-invariants.test.mjs:207` cannot pass either and is a deterministic red in the suite.
**CONFIRMED.**

---

## CLAIM E — selfmod is unreachable; the behavioral maker branch is dead

### Absence queries (the queries that show absence)

Six exported entry points (`Select-String -Path src\lib\selfmod.server.ts -Pattern '^export '`):
`validateSelfmodWorktree` (:147), `preflightSelfmodRun` (:270), `collectSelfmodDiff` (:340),
`runSelfmodVerifyGate` (:389), `landSelfmodWorktree` (:461), `discardSelfmodWorktreeChanges`
(:570). Zero references outside `selfmod.ts` / `selfmod.server.ts` / their tests:

```
Get-ChildItem -Recurse -File -Include *.ts,*.tsx,*.mjs |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.vercel\\|\\\.git\\|\.test\.|selfmod\.ts|selfmod\.server\.ts' } |
  Select-String -Pattern 'validateSelfmodWorktree|preflightSelfmodRun|collectSelfmodDiff|runSelfmodVerifyGate|landSelfmodWorktree|discardSelfmodWorktreeChanges'
```
```
=== END ===        (no matches)
```

CLI: 39 `case "…"` arms, none `selfmod`; `Select-String -Path scripts\rapidtool-cli.mjs -Pattern 'selfmod'`
returns nothing.
```
case arms: 39
case "create" / "run" / "gate" / "resume" / "unattended" / "approve" / "reject" / "retry" /
"ingest" / "packet" / "export" / "emit" / "fixtures" / "eval" / "tree-run" / "repair" / "edit" /
"summary" / "vault" / "search" / "crew" / "verify" / "check" / "scan" / "design" / "diagram" /
"artifacts" / "harvest" / "swarm" / "prompt" / "bench" / "mine" / "knowledge" / "lesson" /
"wild" / "chat" / "deepen" / "doctor" / "diagnose"
```

Behavioral branch: the only non-test `scoreMaker({...})` call is `scripts/run-eval.mjs:2344`;
its object literal supplies `project, corpus, treeRun, journey, run, handover, budget, stop,
prior, synthesisSucceeded` — **no `behavioral`**. `input.behavioral` is only ever supplied by
`src/lib/maker-score.test.ts`.

### Analysis

Both absence claims hold. Six entry points, zero production callers, no CLI arm — self-modification
is unreachable; the guardrails are real but nothing reaches them (constraint observed: selfmod was
not invoked). The behavioral branch (`m1Substance`, `src/lib/maker-score.ts:415-434`) is dead in
production because the one caller never passes `behavioral`; the same is true of M2
(`m2Runs`, `:506-524`). M1 in tree mode is indeed identifier-stem coverage
(`capabilityCoverage`, `:460-468`), so the "hollow tree can earn M1" characterization is right.

One correction: **M2 is not an identifier-substring score.** Its non-behavioral path (`:525-548`)
requires a green `treeRun` with `testsPass > 0 && testsFail === 0` — a real run verdict, not a
token scan. So M1 is hollow-tree-earnable; M2 is bounded by the (deterministic-floor) tree run.
**CONFIRMED**, with that M2 nuance.

---

## Where the nine lanes appear to have got it wrong

1. **A counting.** "19 `createServerFn(` sites across 12 files" is the raw text grep; two hits are
   a string literal and a doc comment. The true population is **17 invocations / 10 files**.
2. **A severity.** The claim must not be read as "the shipped app is exploitable". In the shipped
   default (auth off) it is a deliberate single-user tool; the exposure exists only when
   `VITE_AUTH_ENABLED=true` (which the deploy path does set).
3. **C "cheapest case".** There is no cost-based selection anywhere in the harness; ordering is
   `readdirSync(...).sort()` (alphabetical) then `slice(0, cap)`. Replace "cheapest" with
   "alphabetically-first graded entry".
4. **B consequence.** The provider-level truncation-signal loss is real, but the P6 JSON path does
   not silently accept a body cut inside `module`; it emits a coded `truncated-json` failure and
   re-asks/refuses. The claim's P6 severity is not supported by `codegen.server.ts:7180-7208`.
5. **E M2.** "M1/M2 as identifier-substring scores" is only half right: M2 is a tree-run verdict.
