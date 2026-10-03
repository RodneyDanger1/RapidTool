# fixes/337_3_trust.md - W51 lane 337-3 "Trust" - emissions, verification and the learning loop

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (space in path; terminal `git grep` only - ripgrep fails on the space).
**HEAD at open:** `dd6194c`, tree clean except untracked `wave_plans/W51/` and `fixes/337_4_verifier.md`.
**Runtime:** repo-pinned Node **22.23.2** (`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node **24.15.0**;
every parsed `node --test` run used `--test-reporter=tap`.
**Scratch (outside the repo):** `%TEMP%\rt337_3\` - the repo gains no probe file.
**Rules obeyed:** minimal surgical patches; no tracked file deleted; no full gate (siblings editing); targeted
suites only; **0 of the 1 allowed keyed call used**; no `npm run eval`; no secret printed; append-only log.
**Owned (STRICT):** the `codegen/verification/learning-loop` surface listed in the W51 brief.

---

## 0. Step 0 - reconciliation (claimed / on disk / still open)

Read this pass: `wave_plans/W51/README.md` (full), `fixes/336_0_parent.md`, `fixes/335_0_parent.md`,
`fixes/333_0_parent.md`, `fixes/336_3_transit.md`, `fixes/336_6_warden.md`, `fixes/335_6_warden.md`,
`fixes/330_4_cartographer.md`, and the register's `AW45-*`/`AW46-*`/`AW47-*` appendices in
`research/multiagent/thoroughanalysis.md` (lines 1460-1518).

### claimed (what prior waves said they landed)

- **336-3 (Transit, my predecessor):** the emit -> tree-run -> DoD -> packet chain holds; the packet-refresh on
  mint (`mintTreeRunTested` recompiles the packet; the already-`tested` early return is hash-aware); the
  artifact-truncation budget is decided on a volatile-length-normalized copy; `scaffold.test.ts` 53,
  `packet.test.ts` 71.
- **336-6 (Warden):** module coverage 107/122 reached, allowlist 15, every reason rewritten; `vector.ts`
  dead rung deleted; `algo-tools.ts` `while`-method fixed; 6 dead/dormant modules proposed (nothing deleted).
- **335-6 (Warden):** `bench.ts` `?.`-as-ternary fixed; `ast-mine.ts` export alias fixed; the 14 pure algorithm
  modules otherwise SOUND.
- **330-4 (Cartographer):** `knowledge.ts` L2 signature full-anchor-set fix, `drift` false-claim fix,
  `lessonLog` throw fix; `harvestResultLesson`/`harvestEvidenceLesson` are declared NOT wired (strike landed).
- **333-0/335-0:** no deletions authorized; dead code proposed only.

### on disk (verified by reading/running today at `dd6194c`)

- `src/lib/verify.ts:167` used `String(fnv1a(`${outcome.finalSource ?? ""}${evidence}`))`; the **same
  boundary-less expression** at `src/lib/codegen.server.ts:3495` (`verifyOutcomeArtifact`) and `:3581`
  (`upgraded` -> the `"tested"` `lastTest.evidenceHash`). **CONFIRMED - DEFECT (section 2).**
- `src/lib/cassette.ts` - **zero importers**; `git grep cassette -- src scripts` returns only
  `console.tsx` honesty-tooltip prose, `io.ts`'s T5.4 producer vocabulary, and `cassette.test.ts` itself.
  The "zero wire points" report from two waves ago **holds and is deliberate** (pinned by
  `cassette.test.ts`'s wiring scan). Not a defect.
- `mintTreeRunTested` (`codegen.server.ts:4671`) - the 336-2 hash-aware early return is present and reads
  `String(fnv1a(ev.summary))`, a DIFFERENT hash from the ones I changed. Untouched.
- `treeRunTestedEvidence` (`codegen.server.ts:4612`) - folds the sorted spec paths + declared-script state,
  exactly as 336-2 described. CONFIRMED.
- Per-module test counts on Node 22 (measured today, before my edits) - see section 3.
- `npx tsc --noEmit` = exit 0; `npx eslint` on my 4 files = exit 0.

### still open (before my edits, with `file:line`)

1. `src/lib/verify.ts:167` + `src/lib/codegen.server.ts:3495,:3581` - the evidence hash conflates the
   module/evidence boundary. **FIXED (section 2).**
2. `src/lib/node-runner.server.ts:401-411` - a `try/catch` deferral branch that can never run
   (`removeScratchDir` is total). **Reported with probe (section 4.1).**
3. `src/lib/maker-score.ts:477` - `gate.evidenceHash.slice(0, 8)` is unguarded where its siblings guard;
   throws on a gate that is not the typed shape. **Reported with probe (section 4.2).**
4. `src/lib/entry-oracle.ts:385` - `complete` is vacuously true and `pending` is always 0.
   **Reported with probe (section 4.3).**
5. `src/lib/preview-embedder-origin.ts:62` - a `*.grok-sandbox.com` guest trusts ANY parent origin, which is
   broader than the doc comment's "same-suffix parent host". **Reported (section 4.4).**
6. Carried from 336-0 and not mine: `.t4scratch/` (192 files), the three dead modules, the extensionless
   `auth/server.ts:48` import.

---

## 1. Baseline (measured today, after siblings began editing)

Priority-set suites, one file per run, Node 22 TAP totals (0 fail, 1 skip):

`cassette 37 - exec 19 - policy 28 - policy-overlay 25 - patch 25 - patch-preservation 1 - quarantine 5 -
plugin 23 - render 34 - research 11 - error-scan.server 5 - preview-host-bridge 13 - vault 43 -
report-intake 23 - maker-score 74 - harvest 45(1 skip) - knowledge 51 - git.server 37 -
node-runner.server 12 - runtime-log.server 12 - diagnose 25 - watchdog 8 - rt-client 16 - rt-events 7 -
rt-ring 20 - rt-timeline 28 - algorithms 80 - algo-tools 52 - arch-tools 13 - ast-mine 10 - iterate 32 -
judgment 7 - vector 37 - swarm 33 - design 31 - diagram 34 - bench 24 - errors 39 - deepseek.server 26 -
verify.server 42 - verify 26 - dod 3 - packet 71 - scaffold 53 - compile-check.server 81(1 skip)`.

Touched suites before my edits: `verify.test.ts` **26**, `codegen.server.test.ts` **179**.

---

## 2. DEFECT FOUND + FIXED - the "tested" evidence hash ignored its inputs' boundary (3 twin sites)

### What was wrong

The machine-verified stamp's `evidenceHash` was `String(fnv1a(`${module}${evidence}`))` - two distinct
inputs concatenated with no separator. Two DIFFERENT verified outcomes whose concatenation is equal
((`"ab"`,`"c"`) vs (`"a"`,`"bc"`) -> `"abc"`) mint the **same** hash. Consequences:

- `verify.ts` `applyVerifyOutcome`: the P0-09 dedupe `prior.evidenceHash === evidenceHash` then treats the
  second verdict as a re-apply of the first and **returns the project unchanged** - a genuinely different
  machine-verified source is silently dropped and `generatedSource` keeps the old one.
- `codegen.server.ts` `upgraded`: the same value IS `project.lastTest.evidenceHash` - the `"tested"` stamp
  `dod.ts` `p6-verified` reads. Two different machine-verified modules can share one verification state.
- `codegen.server.ts` `verifyOutcomeArtifact`: the same value names the artifact id and its deterministic
  provenance `inputHash`.

This is the exact class the codebase itself names at `codegen.server.ts:4605-4608` ("an evidence hash must
not conflate a state the system takes care to distinguish") and the house hygiene `packet.ts:390` already
applies (`rows.join("\u0002")`).

### Probe (RED-first artifact, outside the repo)

`%TEMP%\rt337_3\probe-verify.mjs` (node 22, keyless):

```
first.generatedSource  = "abc"
first.lastTest.label   = tested
first.evidenceHash     = 1099054474
second.generatedSource = "abc"      <- the DIFFERENT source "abcD" was dropped
second === first       = true       <- treated as a duplicate
EXPECTED: second.generatedSource === "abcD" and second !== first
```

### RED - both new tests, before the patch

`node --experimental-strip-types --test --test-reporter=tap --test-name-pattern=boundary src/lib/verify.test.ts src/lib/codegen.server.test.ts`:

```
    not ok 1 - the tested stamp's evidence hash separates the module/evidence boundary (no collision)
      error: 'two different verified modules must not share one tested evidence hash'
      expected: '149725102'
      actual:   '149725102'
    not ok 1 - a different verified source is never dropped as a duplicate of an unrelated one
# tests 3
# pass 1
# fail 2
```

### Fix (one expression per site, minimal)

- `src/lib/verify.ts`: `${outcome.finalSource ?? ""}\u0002${evidence}`
- `src/lib/codegen.server.ts` `verifyOutcomeArtifact`: `${finalModule}\u0002${outcome.evidence}`
- `src/lib/codegen.server.ts` `upgraded`: `${finalModule}\u0002${outcome.evidence}`

`\u0002` is a source-escaped (not raw) separator, the same byte `packet.ts:390` uses. No field can absorb it
undetected. The tests I appended:

- `src/lib/verify.test.ts` - `applyVerifyOutcome - the evidence hash is boundary-safe` (new describe).
- `src/lib/codegen.server.test.ts` - `the tested stamp's evidence hash separates the module/evidence boundary
  (no collision)` (in the existing `liveP6Synthesis` describe; drives the real keyed seam with injected deps).

### GREEN - after the patch

Filtered, Node 22: `# tests 3 / pass 3 / fail 0`.

Full suites, both runtimes:

| suite | Node 22.23.2 | Node 24.15.0 |
|---|---|---|
| `verify.test.ts` (baseline 26 -> 27) | **27 / 27 / 0** | 27 / 27 / 0 |
| `codegen.server.test.ts` (baseline 179 -> 180) | **180 / 180 / 0** | 180 / 180 / 0 |

### Consumer reconciliation (the changed hash is pinned by one mirror)

`codegen.server.test.ts:3824` independently recomputes the verify record's provenance `inputHash` with the
production formula; it was updated to the boundary-safe form (comment names 337-3). That is the only test
that pins a value derived from the changed expression. `npx tsc --noEmit` exit 0 and `npx eslint` exit 0 on
all four touched files.

**Named compatibility limit:** an already-persisted project carries the old hash, so the next re-apply of the
identical passed outcome appends one extra verify artifact before de-duping again. Best-effort dedupe only -
no correctness break; stated rather than hidden.

---

## 3. Per-module verdict (audited this lane)

"Probe" = what I actually ran/read today. Counts are the module's OWN colocated suite (Node 22).

| module | own tests | verdict | probe / evidence |
|---|---|---|---|
| `cassette.ts` | 37 | **SOUND (deliberate gap)** | `git grep cassette` = 0 importers; only console tooltip + `io.ts` vocabulary + its own test. Header declares the gap; the wiring-scan test pins it. The two-wave-old "zero consumers" report **holds**. |
| `exec.ts` | 19 | **SOUND** | read; `runCode` validates empty/non-string source and a non-positive/non-finite `timeoutMs` BEFORE the server round-trip; DI runner seam; every failure coded. Consumer `node-runner.server.ts` read. |
| `policy.ts` | 28 (+25 overlay) | **SOUND** | read in full; default-deny, total `classifySeat`, narrow-only overlay. `git.server.ts` consumer read. |
| `patch.ts` | 25 (+1 preservation) | **SOUND** | read; unique-match contract, strict-best fuzzy, no-op refuse, overlap counting verified. |
| `quarantine.ts` | 5 | **SOUND** | read; lexical containment (`isInside`) refuses escapes before any move; copy+unlink fallback; missing/failed never swallowed. |
| `plugin.ts` | 23 | **SOUND** | read; registration refuses a state-writer without a routable claim; dispatch total; thenable neutralized; unknown kind default-denied. No caller today (declared). |
| `render.ts` | 34 | **SOUND** | read; deterministic block parser, documented grammar matches bytes, XSS-by-construction. |
| `research.ts` | 11 | **SOUND** | read; validates before the network call; status fallback honest. |
| `error-scan.server.ts` | 5 | **SOUND** | read; advisory-only, length-preserving mask keeps line numbers, coded refusal on an empty/unreadable tree. |
| `preview-host-bridge.ts` | 13 | **SOUND** | read; origin+source checked on every message; `isSafeBridgePath` rejects scheme/`//`/backslash; dispose restores history + listeners. |
| `preview-embedder-origin.ts` | 0 (covered indirectly) | **DEFECT-CLASS CAVEAT (reported, 4.4)** | probe: a sandbox guest trusts any parent origin, broader than the doc comment. Reachability analysis says the sandbox disjunct is load-bearing - left to the owner. |
| `vault.ts` | 43 | **SOUND** | read scoring/ranking/MOC; stem fixed-point, stable sort with a documented tiebreak; no fs. |
| `report-intake.ts` | 23 | **SOUND** | read; validation-first caps, E-09 content ids, E-16 advisory cross-check, H43-P2-1 drop-before-merge. |
| `maker-score.ts` | 74 | **DEFECT FOUND (reported, 4.2)** | `probe-report.mjs`: `m3Iterates` THREW `TypeError ... reading 'slice'` on an untyped gate. |
| `harvest.ts` | 45 (1 skip) | **SOUND** | read; bounded fetches/budget, honest provenance, collision-free lesson signatures; `harvestResultLesson` unwired (declared). |
| `knowledge.ts` | 51 | **SOUND** | read store/lesson/rank paths; full-anchor-set signature, content-addressed ids, stable sorts; 330-4 fixes hold. |
| `git.server.ts` | 37 | **SOUND** | read in full; human-seat-only mutators routed through `policy.ts`, argv-array-only spawn, work-tree refusal, scrubbed child env, landing marker. |
| `node-runner.server.ts` | 12 | **DEFECT FOUND (reported, 4.1)** | probe: `removeScratchDir` never throws -> the `finish()` catch/deferral branch is unreachable. |
| `runtime-log.server.ts` | 12 | **SOUND** | read; byte-window read with `fd` closed in `finally`, torn lines skipped, best-effort rotate. |
| `rt-events.ts` / `rt-ring.ts` / `rt-timeline.ts` / `rt-client.ts` | 7 / 20 / 28 / 16 | **SOUND** | read ring/events (+client surface); junk-tolerant, bounded, deterministic; hydrate distinguishes corrupt from empty. |
| `watchdog.ts` | 8 | **SOUND** | read; bounded two-tier watch clears both timers; tiers/thresholds consistent with `rt-events`. |
| `diagnose.ts` | 25 | **SOUND** | read; pure ranking, parks separated from errors, evidence refs aligned to the filtered array, no fabricated timestamp. |
| `diagnose`/`watchdog` consumers `rt-ring`/`rt-timeline` | - | SOUND | shared `isRtEventLike` predicate used consistently. |
| `entry-oracle.ts` | 0 (reached by compile-check/fuzz) | **DEFECT-CLASS (reported, 4.3)** | probe: `complete` vacuous, `pending` always 0. |
| `algorithms.ts` `algo-tools.ts` `arch-tools.ts` `ast-mine.ts` `iterate.ts` `judgment.ts` `vector.ts` `swarm.ts` `design.ts` `diagram.ts` `bench.ts` | 80 / 52 / 13 / 10 / 32 / 7 / 37 / 33 / 31 / 34 / 24 | **SOUND (prior-waved)** | re-read the changed areas; 335-6/336-6 fixes hold; `iterate` decision order matches its doc. |
| `verify.ts` | 26 -> 27 | **DEFECT FOUND + FIXED (section 2)** | RED/GREEN both runtimes. |
| `codegen.server.ts` | 179 -> 180 | **DEFECT FOUND + FIXED (section 2)** | two twin sites; RED/GREEN both runtimes. |
| `verify.server.ts` | 42 | **SOUND** | re-run green as the consumer of the changed hash. |
| `dod.ts` `packet.ts` `scaffold.ts` `compile-check.server.ts` | 3 / 71 / 53 / 81 | **SOUND (consumers re-run)** | 336-3's chain work holds; `treeRunTestedEvidence` / `mintTreeRunTested` read. |
| `deepseek.server.ts` | 26 | **SHIM (not read for behavior)** | re-export of `llm/providers/deepseek.ts` (337-2's surface); no implementation here. |
| `types.ts` | 0 (type-only) | **NOT READ for behavior** | pure type declarations; its `PhaseRecord.gate` shape grounds 4.2. |
| `research.ts` siblings `tavily.server.ts` / `websearch.server.ts` | 0 own | **NOT READ** | no own test; outside the priority list and reached only through `research.ts` (read). Wired via dynamic import. |

**Modules with NO own test file:** `entry-oracle.ts`, `preview-embedder-origin.ts`, `types.ts`,
`tavily.server.ts`, `websearch.server.ts`, `fixtures.server.ts`.

---

## 4. Reported, not edited (each with a probe)

### 4.1 `src/lib/node-runner.server.ts:401-411` - the cleanup deferral branch is unreachable

`finish()` wraps `removeScratchDir(dir, ownsScratchDir)` in `try { ... } catch { resolve(...); setImmediate(retry); return; }`,
but `removeScratchDir` (`:267-272`) swallows every error internally, so it **can never throw** and the whole
catch/defer path (the comment's "On Windows rmSync THROWS ... then defer") is dead. The observable effect is
the opposite of the comment: a locked scratch dir is never retried later; it is simply left to the OS.
Probe `%TEMP%\rt337_3\probe-node-runner.mjs`:

```
removeScratchDir(owned, existing) threw?  false  dir still exists? false
removeScratchDir(missing/other) threw?  false
=> the finish() `catch` branch is unreachable: removeScratchDir is total.
```

Not patched: the two paths are byte-identical, so no RED-first test can exist (the delete-the-dead-branch
class the repo deferred before). Proposed minimal patch if the owner wants the retry real: have `finish()`
call `removeScratchDir`, then `if (ownsScratchDir && existsSync(dir))` resolve + `setImmediate(retry)` and
return, instead of the `try/catch`; or strike the comment and delete the dead block.

### 4.2 `src/lib/maker-score.ts:477` - unguarded `gate.evidenceHash.slice` (latent crash)

`m2Runs` and `m4MachineVerifiable` guard every optional hash with `typeof`; `m3Iterates` does not:

```
m3Iterates THREW: TypeError - Cannot read properties of undefined (reading 'slice')
```

`PhaseRecord.gate.evidenceHash` is typed `string`, so this is only reachable via a project built outside the
typed/validated path - not through `run-eval.mjs` (it builds its own project). Proposed: read it through
`typeof gate.evidenceHash === "string" ? gate.evidenceHash.slice(0,8) : "(no hash)"` (m2/m4 parity). Left as a
reported residual because the module's header does not claim totality and the crashing input is not produced
by any current caller.

### 4.3 `src/lib/entry-oracle.ts:385` - `complete` is vacuously true, `pending` is always 0

`complete: rows.every((r) => (r.status as string) !== "pending")` and `pending: rows.filter(... === "pending").length`;
no row can ever carry `"pending"` after U1. `scripts/run-eval.mjs:817` still renders the `${pending} pending
runtime evidence` bit, which is therefore unreachable. Probe:

```
entry contract failed rows: 2 pending: 0 complete: true ok: false
```

The file's own comment acknowledges the counter "stays so the record shape cannot silently rot" - so this is a
declared vestige, not a lie. Reported for an owner decision (keep as a shape pin or strike the dead bit).

### 4.4 `src/lib/preview-embedder-origin.ts:62` - sandbox-guest parent trust is broader than the doc

```ts
if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
```

Probe: `resolveParentEmbedderOrigin(false, "https://evil.example/", "https://evil.example", "preview.grok-sandbox.com")`
-> `https://evil.example`; for a non-sandbox guest the same parent is correctly `null`. The header claims
sandbox guests "may additionally be paired with a same-suffix parent host (see isRemintPreviewPair)" - the
bytes trust ANY http(s) parent when the guest is a sandbox host (the `isRemintPreviewPair` arm is then
short-circuited). Analysis: the app IS served on a dynamic `*.grok-sandbox.com` host (`auth/preview.ts:4-7,
:32`), so the sandbox disjunct is the mechanism that makes the live bridge work at all; tightening it to the
pair rule would disable the bridge (a `*.grok-sandbox.com` host contains no `.preview.`). The likely defect is
in the COMMENT, not the code. Left to the owner (changing it risks over-refusal); the honest statement is
"a sandbox guest trusts its direct parent frame; an attacker who can frame the guest URL becomes the trusted
parent and can drive in-preview navigation + read the reported location".

---

## 5. Wiring followed (the owner's instruction)

- **`verify.ts`** - traced up: `store.ts:28,517,1141` (`applyVerifyOutcome` from the UI action),
  `headless.ts:4039-4044` (re-export + CLI `verify --apply`, `rapidtool-cli.mjs:3166`), `lesson-writers.test.ts`,
  `verify.server.test.ts`. Traced down: `dod.ts` `recordGateInto` + `engine.ts` `stampPacket` (P6 gate +
  packet re-stamp), `verify.server.ts` `VerifyOutcome`. All re-run green.
- **`codegen.server.ts`** - traced the two minting sites up to `liveP6Synthesis` (`:3686`) and down to
  `dod.ts:595-635` (`p6-verified` reads `lastTest.label === "tested"` + non-empty `evidenceHash`),
  `packet.ts` (stamp), `engine.ts` `runP6Real`. The hash change is consistent across all three twin sites.
- **`cassette.ts`** - traced its intended wire points (`llm/providers/registry.ts` `callModel`, the run-eval
  `--record/--replay`) and confirmed none exists; the test's wiring scan is the pin. No edit.
- **`exec.ts` -> `node-runner.server.ts`** - read both; the `scrubbedEnv`/`redactSecrets` seam is shared with
  `git.server.ts`, all three read.
- **`report-intake.ts` -> `knowledge.ts`** - the lazy `import("./knowledge.ts")` seam and the direct lesson
  builder path both read; `harvest.ts` shares `failureSignature`/`lessonRow`.
- **`deepseek.server.ts` -> `llm/providers/deepseek.ts`** - the implementation is a 337-2 file; my read found
  no defect there and I did not edit it.

No cross-domain defect was found this lane (nothing to hand to 337-1/337-2). The one adjacent item is that
`deepseek.server.ts` is a pure re-export shim, so its 26 tests exercise `llm/providers/deepseek.ts`.

---

## 6. Mock / fake / placeholder census (files touched)

Pattern scan (`TODO(|FIXME|@ts-ignore|@ts-expect-error|@ts-nocheck|as any|catch {}|placeholder|mock|fake`) over
`verify.ts`, `verify.test.ts`, `codegen.server.ts`, `codegen.server.test.ts`:

- **0 prohibited constructs in any line I added.** My added lines carry no cast, no empty catch, no TODO.
- All hits are pre-existing and honest: doc-comment uses of "placeholder" (the keyless floor module),
  pre-existing `TODO(FM-03b)`/`TODO(FM-04b)` markers owned by earlier lanes, and test *inputs*/injectable
  fakes (the repo's documented fake-injection precedent). The two new tests inject deps (no network, no key)
  and assert real invariants - both fail on the pre-fix bytes (shown in section 2), so neither is a test that
  cannot fail.
- No new `as unknown as`, no `@ts-ignore`, no silent `catch {}`.

---

## 7. Tests added + real results (both runtimes)

| test | file | Node 22.23.2 | Node 24.15.0 |
|---|---|---|---|
| `applyVerifyOutcome - the evidence hash is boundary-safe` | `verify.test.ts` | pass | pass |
| `the tested stamp's evidence hash separates the module/evidence boundary (no collision)` | `codegen.server.test.ts` | pass | pass |

| suite | before | after (Node 22) | Node 24 |
|---|---|---|---|
| `verify.test.ts` | 26 | **27 / 27 / 0** | 27 / 27 / 0 |
| `codegen.server.test.ts` | 179 | **180 / 180 / 0** | 180 / 180 / 0 |

Dependents re-run on Node 22 after the patch (all 0 fail): `verify.server 42 - lesson-writers 25 - store 93 -
gates 88 - headless 142 - emitted-honesty 5 - honesty-guards 13 - sweep73-fuzz 52`.
`npx tsc --noEmit` exit 0; `npx eslint` on the 4 touched files exit 0.

---

## 8. What I did NOT do, and why

- Did not touch `engine.ts`/`headless.ts`/`store.ts`/`llm/**` (337-1/337-2) or any unowned file.
- Did not "fix" the four reported residuals (4.1-4.4): each has a reason stated above (byte-identical dead
  branch, unproduced input, declared vestige, load-bearing trust disjunct with a wrong comment). No fix
  without a falsifiable RED-first test.
- Did not delete anything; no probe file left in the repo (all under `%TEMP%\rt337_3\`).
- No keyed call (0 of 1); no `npm run eval`; no full gate (siblings mid-edit); no secret printed; append-only
  log.

---

## 9. Verdict

One genuine, high-value defect class - **a verification hash that ignored the boundary between its two inputs**
- found at three twin sites and **fixed with RED-first tests shown both ways on both runtimes**: two different
machine-verified modules/sources can no longer share one `"tested"` evidence hash, and `applyVerifyOutcome`
can no longer silently drop a different verified source as a "duplicate". The rest of the audited surface
(`cassette`, `exec`, `policy`, `patch`, `quarantine`, `plugin`, `render`, `research`, `error-scan`, `vault`,
`report-intake`, `harvest`, `knowledge`, `git.server`, `runtime-log.server`, the `rt-*` cluster, `watchdog`,
`diagnose`, `preview-*`) is **SOUND under the probes above**, with four named, probed residuals left to the
owner and the cassette "zero consumers" report re-verified as deliberate and pinned.

---

# Follow-up (337-3b) - W51 watchdog hand-back: the missed mirror + six defects in my own modules

**Dated correction, appended 2026-10-02.** Read `fixes/337_4_verifier.md` (§9, §12) and
`fixes/337_5_guardian.md` (J3 §F). All eight items below are now LANDED unless stated; every touched suite
is green on Node 22.23.2 AND host Node 24.15.0. Scratch: `%TEMP%\rt337_3\`. `npx tsc --noEmit` = 0,
`npx eslint` on every touched file = exit 0.

## 0. Correction to section 9 - "No cross-domain defect was found this lane" was WRONG

The Verifier (section 12) and the Guardian (J3 §F) both found that `clampRunnerOutput`
(`src/lib/node-runner.server.ts` - MY file) carried the exact truncated-elision-marker defect Core fixed in
`compaction.ts`, and my section 9 claim that my perusal found nothing cross-domain is refuted: the mirror
was in my own territory and I had already read the function. Corrected here by landing the fix (item 1).
The narrower true statement: I found no defect in another hunter's file; I missed one in mine.

## 1. LANDED - `node-runner.server.ts` `clampRunnerOutput` (mirror of Core's compaction fix)

For caps ≈64-115 the marked layout could not fit, so the old `out.slice(0, cap)` shipped a sliced marker
stub AND under-counted the elision. Applied the same fallback Core used: if
`out.length > cap || !out.includes(marker)`, return the counted plain head-cut.

- **RED (final assertion, pre-fix bytes restored in place then restored):**
  `--test-name-pattern="small caps never ship"` ->
  `not ok 1 ... cap 64: neither a plain head-cut nor a fully-rendered marker -> "AAAA...\n… [1962 chars elided by r"`,
  `# tests 2 / pass 1 / fail 1`.
- **Probe (new regime, measured):** caps 64-115 L=50000 -> plain head-cut, `elided = L - cap`; 116+ intact
  marker; full tail at 136. L=1000 edges 110/111/131.
- **GREEN:** `node-runner.server.test.ts` **12 -> 14 / 14 / 0** on both runtimes.

## 2. LANDED (removal) - `node-runner.server.ts` unreachable deferral branch

Chosen: **removed**, not made reachable. Reason: its only trigger was a `removeScratchDir` throw, and that
helper is total by construction (probe `%TEMP%\rt337_3\probe-node-runner.mjs`: never throws on an existing,
missing or OS-temp path). Making it reachable would mean engineering an unremovable dir purely to test a
retry whose observable behavior (residue left for the OS) is identical to the sync path - a test that could
not fail. The `finish()` cleanup is now a direct `removeScratchDir` call; the comment was corrected to state
that a locked dir is left for the OS temp cleaner (no false "defer" claim). Behavior-preserving; the full
`node-runner.server` suite is green (14/14) and the probe documents the unreachability.

## 3. LANDED - `maker-score.ts:477` `m3Iterates` crash on an untyped gate

- **RED:** probe reproduced `TypeError: Cannot read properties of undefined (reading 'slice')`; the new test
  went RED with that exact message (`--test-name-pattern="without an evidenceHash"`,
  `# tests 2 / pass 1 / fail 1`).
- **Fix:** read the hash through `typeof gate.evidenceHash === "string"` (m2/m4 parity); a hash-less gate
  now renders `(no hash)`.
- **GREEN:** `maker-score.test.ts` **74 -> 75 / 75 / 0** on both runtimes.

## 4. LANDED - `entry-oracle.ts` verifier that could not fail (+ its first test file)

`complete` was `rows.every((r) => r.status !== "pending")` over a status no row can carry: vacuously true
for every contract, including one that declared NOTHING. Fixed to
`complete: rows.length > 0 && pending === 0` (something declared AND nothing pending); `pending` is computed
once and stays structurally 0. `ok` (no row failed) is intentionally left vacuously true for zero rows -
that is the "files+content only" state, not a completeness claim.

- **RED:** the new `entry-oracle.test.ts` (the module's FIRST test) had the zero-row case fail:
  `not ok 1 - a declaration with ZERO rows is NOT complete`, `# tests 9 / pass 8 / fail 1`.
- **GREEN:** `entry-oracle.test.ts` **0 -> 9 / 9 / 0** on both runtimes.

## 5. LANDED (comment is the wrong half) - `preview-embedder-origin.ts:62-63`

Decided: the CODE is right, the COMMENT was wrong. A `*.grok-sandbox.com` guest is the host this app is
served on inside the Grok preview (`auth/preview.ts:4-7,:32`), and such a host carries no `.preview.` label -
so requiring `isRemintPreviewPair` there would disable the live bridge entirely. The header now states the
real model (sandbox guest trusts its direct parent; the per-message source+origin gate lives in
`preview-host-bridge.ts`), and the module got its first test file pinning both arms (grok/loopback, the
sandbox arm, the remint pair, unrelated-parent refusal).

- No RED is possible: the chosen change is documentation, and the bytes are unchanged.
- **GREEN:** `preview-embedder-origin.test.ts` **0 -> 9 / 9 / 0** on both runtimes.

## 6. LANDED - `scorecard.ts` fabricated score (`readEntry` + aggregates + deltas)

`readEntry` stored a present cell with a non-numeric `score` as `{score: 0}` while the module's contract says
absence is never defaulted to 0; `aggregateCriteria` then counted it as a real scored zero and `buildDelta`
minted a `0 - before` per-criterion regression. Fixed by omitting the cell (id still named in
`missingCriteria`), which makes the aggregates and deltas skip it by construction.

- **RED:** `--test-name-pattern="present cell with no numeric score"` ->
  `# tests 1 / pass 0 / fail 1` (the cell read as `{score: 0}`, aggregate M1 `scoredBy 1 / zeros 1`, delta
  `{before:1, after:0, delta:-1}`).
- **GREEN:** `scorecard.test.ts` **5 -> 6 / 6 / 0** on both runtimes. (`missingCriteria` now has a real
  reason to exist: it is the only record of a present-but-unscored cell.)

## 7. LANDED - `write-set.ts:59` no-op ternary; `websearch.server.ts:349` unguarded title

- `write-set.ts`: the `(absNorm.endsWith(sep) ? "" : "")` dead sub-expression is removed (the separator-safe
  prefix check below is the whole rule). **Behavior-preserving, so no RED exists**; the three existing
  escape/inside tests are the guard and `write-set.test.ts` stays **8 / 8 / 0** on both runtimes.
- `websearch.server.ts`: `(r.title ?? "").replace(...)` returned a non-string as-is and threw, failing the
  last-resort Wikipedia provider. Now the title is guarded once (`typeof r.title === "string" ? r.title : ""`)
  and reused for the URL.
  - **RED:** new test -> `# tests 12 / pass 11 / fail 1`.
  - **GREEN:** `websearch.test.ts` **11 -> 12 / 12 / 0** on both runtimes.

## 8. LANDED - `sandbox.ts` (claim guard + blob-URL leak)

- `verifyClaims`: a `contains-identifier` row with a non-string `expect` now reports
  `malformed claim row (no expect)` instead of throwing `c.expect.toLowerCase is not a function`.
- `runSandboxed`: the `workerFactory`-throw catch now `revokeObjectURL`s the blob URL it created.
- **RED:** `# tests 36 / pass 34 / fail 2` (both new tests RED, one naming the exact TypeError).
- **GREEN:** `sandbox.test.ts` **34 -> 36 / 36 / 0** on both runtimes (URL API stubbed deterministically).

## 9. Guard reconciliation - `honesty-guards.test.ts` OV-18 block flipped

The OV-18 block explicitly pinned the TORN-marker regime for `clampRunnerOutput` and its own header said the
rows were "expected to FLIP when the fix lands". Item 1 is that fix, so the block was rewritten to the new
regime: `scanEdges` now asserts `{lastPlain:115, firstIntact:116, firstTailFull:136}` (L=50 000) and
`{110,111,131}` (L=1 000); the literal capture table was re-measured (plain-cut rows `elided = L - cap`,
intact rows `elided = L - head - tail`); the "torn window is LABELLED" test became "the too-small window is
a COUNTED plain head-cut, never a torn marker"; the sweep now requires each result to be the exact head-cut
or the intact marker, with no partial marker anywhere. `honesty-guards.test.ts` stays **13 / 13 / 0** on both
runtimes. This file is outside my enumerated set but pins MY module's behavior; flagged for the boundary.

## 10. Tests + counts (both runtimes) and evidence hygiene

| suite | before | after | Node 22 | Node 24 |
|---|---|---|---|---|
| `node-runner.server.test.ts` | 12 | **14** | 14 / 14 / 0 | 14 / 14 / 0 |
| `maker-score.test.ts` | 74 | **75** | 75 / 75 / 0 | 75 / 75 / 0 |
| `entry-oracle.test.ts` (new) | 0 | **9** | 9 / 9 / 0 | 9 / 9 / 0 |
| `scorecard.test.ts` | 5 | **6** | 6 / 6 / 0 | 6 / 6 / 0 |
| `write-set.test.ts` | 8 | 8 | 8 / 8 / 0 | 8 / 8 / 0 |
| `websearch.test.ts` | 11 | **12** | 12 / 12 / 0 | 12 / 12 / 0 |
| `sandbox.test.ts` | 34 | **36** | 36 / 36 / 0 | 36 / 36 / 0 |
| `preview-embedder-origin.test.ts` (new) | 0 | **9** | 9 / 9 / 0 | 9 / 9 / 0 |
| `honesty-guards.test.ts` | 13 | 13 | 13 / 13 / 0 | 13 / 13 / 0 |
| `verify.test.ts` | 27 | 27 | 27 / 27 / 0 | 27 / 27 / 0 |
| `codegen.server.test.ts` | 180 | 180 | 180 / 180 / 0 | 180 / 180 / 0 |

Dependents re-run green (Node 22): `exec 19 - git.server 37 - compile-check.server 81 (1 skip) -
sweep73-fuzz 52 - sandbox-policy 3`.

Evidence hygiene: `node scripts/check-assertion-gaps.mjs` clean (133 files, 0 findings);
`node scripts/check-module-coverage.mjs` 107/122 reached / 15 allowlisted / 0 unallowlisted / 0 stale.
Mock/fake census over the eight touched production files: 0 prohibited constructs in any line I added (the
only hit is `maker-score.ts:365`'s pre-existing doc-comment naming the product's `TODO(E-15)` marker).

## 11. Honesty limits named, not hidden

- `verify.ts`'s boundary comment was softened (Verifier section 10): `\u0002` names the boundary for every
  input the verifier produces, but a field that itself contained `\u0002` would stay theoretically ambiguous
  (a length prefix is strictly safer). No behaviour change; `verify.test.ts` still 27/27.
- Items 5 and 7a have no possible RED (a comment fix and a behavior-preserving dead-expression removal);
  stated rather than dressed up with a test that would pass both ways.
- Item 2 was resolved by removal because the alternative admits no falsifiable test; the unreachability
  probe is the evidence.
- No keyed call (0 of 1); no `npm run eval`; no full gate (parent owns the boundary); no secret printed; no
  tracked file deleted; all scratch under `%TEMP%\rt337_3\`.
