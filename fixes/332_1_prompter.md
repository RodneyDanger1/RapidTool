# W46 / 332-1 — "Prompter" — synthesis correctness (async + coverage)

**Actor:** Prompter (code-synthesis correctness). **Owned files (STRICT):**
`src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts`; this log.
**HEAD at open:** `6cd5123`, tree clean (other lanes' edits appeared during the wave).
**Runtime:** Node 22.23.2 pinned (`%LOCALAPPDATA%\hermes\node\node.exe`) **and** host Node
v24.15.0; every parse used `--test-reporter=tap`. **Scratch:** `%TEMP%\rt332_1\` (outside the repo).
No keyed call, no full gate, no `npm run eval`, no secret printed.

---

## §1 P1 — generated modules call async sibling imports without `await`

### 1.1 Reproduction (before the fix, real command output)

Pre-fix probe (`%TEMP%\rt332_1\probe-p1.ts`) against HEAD's `validateSynthesisModule` — the
recorded `src/jobs/rehab.ts` shape (`var property = getProperty(propertyId); … property.ok` inside
a `Promise.resolve().then(…)` body), plus the two other value-position forms:

```
REHAB (wrapper + var->.ok): {"ok":true,"exports":["getRehabTimeline"]}
DIRECT (.ok on call): {"ok":true,"exports":["f"]}
DESTRUCTURE: {"ok":true,"exports":["f"]}
```

Every value-position form of an **un-awaited** async call sailed through validation. The spec's
consequence is recorded, not re-run (the keyed scratch tree `%TEMP%\rt331_final` no longer exists on
this machine): `fixes/331_0_parent.md:119-127` / `wave_plans/W45/parent-keyed-findings.md` record
that run's own spec as **24 pass / 1 fail**, where node:test reds the whole file on the floating
rejection. I could not reproduce the live 24/1 line without a keyed run; the module bytes quoted in
`wave_plans/W46/lane-1-prompter.md:14-25` are the reproduction input, and they are what the probe
above consumes.

### 1.2 "Test fails before, passes after" (genuine, both directions)

I ran the **new test's core assertion** against two sources — a scratch copy of `src/lib` with
`git show HEAD:src/lib/codegen.server.ts` restored (`%TEMP%\rt332_1\libhead`, node_modules junction)
and the working tree:

| source | command | result |
|---|---|---|
| HEAD (pre-fix) | `node --experimental-strip-types before-after.ts` | **FAIL** — `{"ok":true,"exports":["getRehabTimeline"]}` (exit 1) |
| working tree (post-fix) | `node --experimental-strip-types after.ts` | **PASS** — `{"ok":false,"code":"RT_E_VALIDATION","error":"un-awaited async call used as a value: \"getProperty\" at line 9 (bound-then-read) — …"}` (exit 0) |

The committed test also pins the pre-fix behaviour permanently as its negative control
(`withoutMark.ok === true` with the async mark absent).

### 1.3 Decision — why a validator refusal (plus a prompt rule), not a prompt rule alone

The lane brief asks for the honest defense and the reason. A prompt rule alone cannot stop a model
slip: run #2 already proved that — the model was told (rule 2) not to import and to call earlier
exports by name, yet emitted a fire-and-forget call whose result it read as a value. The
materialized ESM imports every earlier chunk's exports as plain bindings, so only synthesis-time
knowledge (which sibling exports are `async`) plus a deterministic refusal can catch the class
before the tree is emitted. The refusal is routed into the existing **one bounded repair re-prompt**
(precedent: 331-4's cross-chunk duplicate refusal), so a single slip is repaired, not stranded.

**Detector.** `unawaitedAsyncValueUses(module, asyncNames)` masks per line (`maskCodeLine`,
line-preserving), then refuses an un-awaited call to an async callable when its result is consumed
as a value:

- `getProperty(id).ok` → `property-read`;
- `const { ok } = getProperty(id)` → `destructure`;
- `const p = getProperty(id); … p.ok` → `bound-then-read` (the exact rehab shape);
- a var bound to one inside a `Promise.resolve().then(…)` body → `floating-in-then` (that callback
  is not `async`, so the promise can never be awaited later).

`await getProperty(id)` and `.then/.catch/.finally` consumers are **accepted** — refusing a legal
promise chain would over-refuse valid code. A `Promise.resolve().then` body that merely
`return`s the call is also accepted (`.then` flattens returned promises, so that is correct), which
is why the wrapper is an *amplifier* of a bound value, not a standalone refusal.

**Async-name source.** A module's own `async function` declarations (`declaredAsyncFunctionNames`)
union every earlier chunk's `asyncExports` mark. `ChunkPriorFile` gained an optional
`asyncExports?: readonly string[]`, computed at accept time via `asyncExportNames(module, exports)`
and threaded into both the validator and the prompt. Absent ⇒ legacy byte-identity (pinned).

**Landed in `codegen.server.ts`:**
- `declaredAsyncFunctionNames`, `asyncExportNames`, `asyncNamesInScope`, `unawaitedAsyncValueUses`.
- `ChunkPriorFile.asyncExports` (optional).
- `validateSynthesisModule` refuses the class (`RT_E_VALIDATION`), checked LAST so the
  export-surface / duplicate repairs keep priority; `RT_E_VALIDATION` is reused (no new `RT_E_*`,
  so no C1 request).
- `p6SynthesisAsyncAwaitRepairPrompt(uses, treeFailure?)`, wired into **both** repair chains
  (`synthesizeSingleModule`, `synthesizeChunkEnvelope`).
- Prompt advertising (215b drift-proof): system-prompt rule 9; a static await instruction in the
  chunk prompt's earlier-files block; and a per-file `· asynchronous (must await): <names>` marker
  when `asyncExports` is present.

**Limitation (reported, not hidden):** the sibling's async-ness is read from its `async function`
declaration. A sibling that returns a Promise without `async` is not lexically detectable; the local
declaration path has the same limit. This still covers the recorded defect (the brief states the
real `getProperty` is an async import) and every `async function`/`async` arrow it can see.

---

## §2 P2 — keyed coverage varies; make the shortfall deterministic and legible

The recorded bytes both run shapes are pinned against are tracked in `research/eval-out/`
(`doctor.test.ts` reads them the same way). Final census on the working tree:

**Run-B shape — `research/eval-out/coffeehouse2home-property-ledger/.rapidtool/project.json`**
(36 signatures; the p6-arch-FAIL run):

```
CENSUS declared: ["track","record","flip","show","lease"]
CENSUS planned : ["record","flip","show","lease"]
CENSUS unbound : ["track"]
CENSUS legacy  : false
CENSUS paths   : ["src/jobs/record.ts","src/jobs/flip.ts","src/jobs/show.ts","src/jobs/lease.ts",
                  "src/generated/get-property.ts","src/generated/get-deal-pipeline.ts",
                  "src/generated/create-maintenance-request.ts"]
ARCH note      : tree (1 file)
ARCH missing   : 28 capabilities (e.g. getDealPipeline(…), createLease(…), postRentPayment(…), …)
```

**Run-A shape — `…coffeehouse2home-property-ledger.run-2026-09-10/.rapidtool/project.json`**
(25 signatures; the p6-arch-PASS run):

```
CENSUS declared: ["track","record","flip","show","publish"]
CENSUS planned : ["record","flip","show"]
CENSUS unbound : ["track","publish"]
CENSUS legacy  : false
CENSUS paths   : ["src/jobs/record.ts","src/jobs/flip.ts","src/jobs/show.ts",
                  "src/generated/append-ledger-event.ts","src/generated/create-maintenance-request.ts"]
ARCH note      : tree (5 files)
ARCH missing   : []
```

Both are now deterministic and legible: run B's surviving tree is the partial/floor one a refusal
left behind (`tree (1 file)`), and its uncovered capabilities are named by `archTrace`; run A carries
every capability. In both, the declared-but-unkeyable job (`track`, and `publish` in run A) is
**counted**, never silent.

**Landed in `codegen.server.ts`:**
- `treeChunkPlanCensus` now partitions by **label** (spec-graph targets de-dupe by file, so two
  nodes could share a label and double-count the shortfall); the plan-side coverage unit is the label.
- `treePlanCensusReconciles(census)` — the guard that every declared job is in exactly one of
  {planned, unbound}; `silent` is the violation list (empty by construction, pinned so a future plan
  change cannot drop a declared job silently).
- `synthesizeChunkedTree` persists the full partition on the one `p6.tree.shortfall` row
  (`declared N, planned M, unbound K`) and emits a separate coded row if `!reconciles.ok`.

**Honest scope note (P2).** "p6-arch's unmet list agrees with the census" cannot mean set-equality:
the census counts **job labels** (spec-graph nodes) while `archCapabilities` (dod.ts, unowned this
wave) demands **typeSignature primary names**. An unkeyable job with no signature is therefore a
coverage shortfall the census names and p6-arch does not demand — which is exactly why run B's census
says `unbound:["track"]` while `archTrace` lists 28 signature capabilities the surviving partial tree
did not carry. The tests pin both surfaces on the same recorded bytes; no claim of equality is made.

---

## §3 Tests added + real results

| suite | before | after | added |
|---|---|---|---|
| `src/lib/codegen.server.test.ts` | 148/148 | **161/161** | 13 |

Real TAP totals, both runtimes:

```
Node 22.23.2 : # tests 161 · # pass 161 · # fail 0
Node 24.15.0 : # tests 161 · # pass 161 · # fail 0
```

Regression check on the p6-arch consumer: `src/lib/gates.test.ts` **88/88 pass** (Node 22).

New tests (13): rehab shape refused + pre-fix negative control; direct/destructure refused and
awaited/`.then`/sync accepted; local-async refused; `asyncExportNames`/`unawaitedAsyncValueUses`
determinism (comments/strings inert); async repair-prompt bytes; system-prompt rule 9 advertised;
chunk-prompt async mark + legacy bytes when absent; **single-module e2e** (bad → ONE async re-prompt
→ accepted, emitted chunk carries `await`); **chunked e2e** (a later chunk reading `.ok` off an async
sibling is refused → ONE re-prompt → accepted, emitted chunk imports and awaits the sibling);
run-B recorded-bytes census + p6-arch FAIL; run-A recorded-bytes census + p6-arch PASS; duplicate
label dedupe; persisted shortfall partition counts.

---

## §4 What I did NOT do / stopped on

- **Did not reproduce the keyed run's 24 pass / 1 fail line live.** The scratch tree is gone and the
  rules forbid unnecessary keyed calls. Before/after evidence is the validator refusal on the
  recorded defect bytes (real command output in §1.2); the 24/1 line is cited to the parent's
  recorded findings, not re-claimed.
- **Did not edit `dod.ts` (p6-arch), `algorithms.ts` (the `slice(0,5)` cap), `scaffold.ts`,
  `headless.ts`, or any test other than my own** — not owned this wave. The P2 reconciliation is
  tested *against* `archTrace`, never by changing it.
- **Did not extend the patch (`str_replace`) repair level** to the async class. The fix is `await`
  + `async` on the enclosing function, not a localized text delta the patch window can express; the
  legacy full-rewrite repair handles it, matching the duplicate-declaration precedent.
- **Did not sweep further prose/forbidden classes.** `validateSynthesisModule`'s earlier checks and
  the prompt caps (R12-f01 prior render, contracts cap) are unchanged and still covered by the
  existing tests; no unbounded-growth or silent-drop issue found in the touched code.
- **No full gate, no `npm run eval`, no repo probe file** — all scratch lives under
  `%TEMP%\rt332_1\` (the `libhead` copy + node_modules junction are outside the repo).
- `npx tsc --noEmit` reports **zero** diagnostics in my two files; `npx eslint` on them → exit 0.

## Verdict

**P1 — landed.** The recorded async-without-`await` class is refused by `validateSynthesisModule`
(four value-position forms), advertised in both prompts, and routed into the existing ONE bounded
await re-prompt on both synthesis paths. Real before/after on the pre-fix vs working source: accepts
→ refuses. The chunked e2e proves the async mark is threaded from an accepted chunk to the next
chunk's validator.

**P2 — deterministic and legible.** The plan census partitions by label, the one persisted
`p6.tree.shortfall` row carries declared/planned/unbound counts, and a `reconciles` guard makes a
silent drop impossible. Both recorded run shapes are pinned with their real census and p6-arch
verdicts.

**Not done:** the live keyed 24/1 reproduction (scratch bytes gone; no keyed calls run).
