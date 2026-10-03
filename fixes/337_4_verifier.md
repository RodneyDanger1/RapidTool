# 337-4 Verifier (adversarial watchdog) — lane log

**Opened:** 2026-10-02 at HEAD `dd6194c`, tree clean (only `wave_plans/W51/` untracked).
Read-only on code. Only file written: this log (append-only). Scratch: `%TEMP%\rt337_4\`.

Contract: `wave_plans/W51/README.md`. Auditing from: `fixes/336_0_parent.md`.

## 0. Round start state
- `git log -1` = `dd6194c`; `git status --short` = `?? wave_plans/W51/` only (no hunter edits yet).
- No `fixes/337_{1,2,3}_*.md` on disk at open.
- Node 22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`), host v24.15.0.

Baseline to hold: typecheck 0 · lint 0 · 411 scripts + 2848 lib / 0 fail / 2 skipped · gate ok.

## 1. Opening claims (to verify)

- claimed: round just opened, no code changed.
- on disk: git status clean except wave_plans/W51 (untracked, contract).
- still open: all three hunter lanes unstarted; no diff to audit yet.

## 2. Independent baseline re-measurement (my own commands)
- `npm run typecheck` → exit 0 (`# tests 6 / pass 6`), 72.9s.
- `npx eslint .` → exit 0, no warnings emitted.
- No hunter edits yet; Guardian log `fixes/337_5_guardian.md` present (their unowned-list
  matches mine: prompt-engine, scorecard, sandbox*, selfmod*, settle, subagent, token-ledger,
  tracing, templates, server-spec, doctor, write-set, wild-mode.server, wild-review,
  websearch.server, tavily.server, fixtures*, brief-fixtures).

## 3. Independent perusal notes (unowned/untested territory)
- `wild-review.ts:36,96` carry two `TODO(R14-f01)` shell markers (unowned). Pre-existing, not
  this round's diff — flag only, no behaviour gap (keyed path returns null honestly).
- `write-set.ts:61` `const absCmp = (absNorm + (absNorm.endsWith(sep) ? "" : ""))...` — the
  ternary is a no-op (`+ ""` either way); dead expression, no behavioural effect. Cosmetic.
- `tavily.server.ts`, `entry-oracle.ts`, `sandbox-policy.ts`, `selfmod.ts`, `token-ledger.ts`,
  `subagent.ts`, `settle.ts`, `fixtures.server.ts` read in full: no defect found so far.
- `auth/popup.server.ts:163-173` empty catches are inside an inline <script> template string,
  documented best-effort (AW45-c08). Not defects.

## 4. Hunter verification (in progress)

### 337-2 Pulse — first wave of edits (~20:14–20:18)
Files: auth/{server,gate-session.server,middleware,pglite-dialect}.ts, crew.server.ts,
crew.test.ts, db.ts + new auth/auth-import-contract.test.ts, db-bootstrap.test.ts.

**VERIFIED CONFIRMED (re-derived RED in `%TEMP%\rt337_4\mut`):**
- `crew.server.ts` plan-act raw-`opts.roles` fix. Pre-fix line restored in scratch →
  `crew.test.ts` new case goes RED (`not ok … VALIDATED role table`, tests 1 / fail 1). Fix is
  minimal and correct: threads the `resolveRolesOverride`-validated `roles` into `runPlanAct`.
- `db.ts` eager-bootstrap `throw err` removal. Scratch (which captured the pre-fix `throw err;`)
  → `db-bootstrap.test.ts` RED (`triggerUncaughtException`). Fix removes a genuine unhandled
  rejection; no consumer awaits `__pgBootstrapPromise__` (grep: only db.ts itself), and
  `getSql()` still rejects+clears per call, so per-request errors still surface (not silent).

**FALSIFIED / WEAK (my finding):**
- **337-2 T1 `src/lib/auth/auth-import-contract.test.ts:56` — the extension guard cannot fail
  for `.server`/`.client`-suffixed extensionless specifiers.** The check
  `!/\.[A-Za-z0-9]+$/.test(last)` treats `isolation.server` / `verify.server` /
  `gate-identity.server` as "has an extension". Proof (scratch): reverted
  `middleware.ts:41-42` to `./isolation.server`/`./verify.server` and
  `gate-session.server.ts:11` to `./gate-identity.server`; test still reported only the no-dot
  `./preview` offender and `ok 2/…, ok 1/…` (pass) for those three. Severity MEDIUM (test
  integrity: claims "every relative specifier carries an explicit extension", enforces only
  no-dot forms — the `.server` class is exactly what `middleware.ts`/`gate-session` carried).
  Smallest fix: require a real code extension, e.g. `const CODE_EXT = /\.(ts|tsx|mjs|js|json)$/;`
  and flag `!CODE_EXT.test(last)`.

**Still to check:** Pulse's `auth/server.ts` `.catch` change vs. the `db.ts` fix (both correct
individually; no double-report concern), and their remaining log claims (§2 crew).

## 5. Core (337-1) and Trust (337-3) verification
- Core edits present (compaction/planning/gate-stats + tests) but no `337_1_core.md` yet.

### 337-1 Core — first edits (~20:16–20:22), all three re-derived RED in scratch
- `compaction.ts` `clampToolOutput` small-cap fallback. Pre-fix line restored in
  `%TEMP%\rt337_4\mut` → new test RED (`not ok 4 … truncated marker stub`). Logic verified:
  fallback fires exactly when `marker.length > cap - head`.
- `gate-stats.ts` raw-mean threshold. Pre-fix (`meanLatencyMs < 20000`) → new test RED
  (`not ok 10`). Correct: rounding moved the 20 s boundary by ≤0.5 ms.
- `planning.ts` marked id cut (`cutToChars`). Pre-fix `.slice(0,48)` → new test RED
  (`not ok 2`). Correct: `cutToChars` keeps ≤cap and appends `…[TRUNCATED]`.

**BAD-CODE (my find, LOW): `src/lib/compaction.ts:256` — `!out.includes(marker)` can never
be true.** `out` is constructed as `` `${head}${marker}${tail}` `` so the full `marker` is always
a substring; the second disjunct is dead. The intended check (a *sliced* marker) would have to
test `out.slice(0, cap)`. No behavioural effect — the branch still fires correctly via
`out.length > cap` — but it is a guard that cannot fail and its comment claims a case it cannot
detect. Smallest fix: `out.length > cap || !out.slice(0, cap).includes(marker)`.

- Trust: no edits or log yet.

### 337-3 Trust (codegen/verify) + 337-1 Core (headless) — second edit wave (~20:16–20:24)

**CONFIRMED RED-FIRST (all three new tests re-derived RED in scratch):**
- `verify.ts` `applyVerifyOutcome` boundary `\u0002`. Pre-fix (`${finalSource}${evidence}`) →
  `verify.test.ts` new test RED (`not ok 1 … boundary-safe`).
- `codegen.server.ts` `verifyOutcomeArtifact` + `upgraded` boundary `\u0002`. Pre-fix →
  `codegen.server.test.ts` new test RED (`not ok 1 … separates the module/evidence boundary`).
- `headless.ts` `nextAction` A20 (`.find(r => r.id === project.currentPhase)` vs positional).
  Pre-fix (`project.phases[project.currentPhase]`) → `headless.test.ts` new test RED
  (`not ok 1 … A20`). `types.ts` confirms `phases: PhaseRecord[]`, so `.find` is valid.

**REGRESSION FOUND (must be fixed before the boundary) — Trust's separator changed a persisted
hash but left the existing pin on the old formula:**
- `src/lib/codegen.server.test.ts:3824` still asserts
  `vProv.inputHash === String(fnv1a(\`${KANBAN_MODULE.trim()}${evidence}\`))` (bare concat), while
  production now hashes `finalModule + "\u0002" + evidence`. Live run today:
  `node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="the verify record is deterministic" src/lib/codegen.server.test.ts`
  → `not ok 1 … expected: '368828860' actual: '3060450434'`. Baseline is 0 fail; this is RED on the
  current tree. Smallest honest fix: update that one expected value to include `\u0002` (the same
  change Trust made in production), OR compute it via the production helper. Until then the round's
  lib leg is red. Trust's log is not yet on disk — re-check at the boundary.

- Also note (not a defect, just scope): `headless.ts` edits are Core's, applied to a file Core owns.

## 6. Independent perusal — confirmed finding (unowned module)

**scorecard.ts — a present-but-non-numeric criterion score silently becomes a real 0.**
`src/lib/scorecard.ts:221-226` (`readEntry`): a PRESENT cell (`isRecord(cell)`) whose `score`
is not a finite number is stored as `{score: 0, evidence}` and only side-recorded in
`missingCriteria`. `aggregateCriteria` (`:517-520`) and `buildDelta` (`:554-557`) never consult
`missingCriteria`; `grep missingCriteria` over `src/`+`scripts/` shows the field has **no
consumer** (assigned at `:217/226/228`, stored at `:242`, read nowhere). Repro (probe
`%TEMP%\rt337_4\probe_scorecard.mjs`, real command today):
`node --experimental-strip-types %TEMP%\rt337_4\probe_scorecard.mjs` →
```
M1 cell as parsed : {"score":0,"evidence":"cell present, score missing"}
aggregate M1      : {"scoredBy":1,"scored":0,"zeros":1,"zerosSlugs":["s1"]}
historyDelta.M1   : {"before":1,"after":0,"delta":-1}
historyDelta dir  : "down"
```
So one malformed `results.json` cell fabricates a scored 0, a zero-count, and a `down` regression.
The module header (`:27-30`) claims absence is never defaulted to 0 — an absent cell is handled
(`:228`), but a present malformed one is not. Severity LOW-MEDIUM (only a corrupt/hand-edited
`results.json` triggers it; `run-eval` writes correct cells). Unowned this round → REPORTED, not
fixed. Smallest fix: leave the cell out of `criteria` when `score === null` (or have
`aggregateCriteria`/`buildDelta` skip ids listed in `missingCriteria`). Independent of the
Guardian's F7 — same bytes, my own probe.

## 7. Status
- `codegen.server.test.ts` full: 180 tests / **179 pass / 1 fail** (the stale pin above).
- `headless.test.ts` full: 142/142 pass (A20 has no side effects).
- `verify.test.ts` + `gates.test.ts`: 115/115 pass.
- `node scripts/check-module-coverage.mjs`: 107/122 · 15 allowlisted · 0 unallowlisted · 0 stale · exit 0.
- `node scripts/check-assertion-gaps.mjs`: clean — 131 files, 0 findings.
- No `fixes/337_3_trust.md` on disk yet despite edits.

## 8. Independent re-derivation of Pulse F1/F2 root causes (end-to-end)
- **Parameter properties are rejected by strip-only mode — CONFIRMED.** Scratch probe
  `%TEMP%\rt337_4\paramprop.ts` (`class A { constructor(private x: number) {} }`) under the pinned
  Node 22 → `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` at the `private x` token. So the `pglite-dialect.ts`
  conversion was necessary, not cosmetic.
- **The auth cluster now loads — CONFIRMED.** Probe `%TEMP%\rt337_4\probe_auth_load.mjs` (imports the
  four modules) → `OK src/lib/auth/{server,verify.server,popup.server,gate-session.server}.ts`,
  exit 0; the PGLite bootstrap failure is logged but does not kill the process. Both F1 and F2 hold.

## 9. Cross-domain defect Trust has NOT picked up (Core's §6 report — independently confirmed)
**`src/lib/node-runner.server.ts:110-133` (`clampRunnerOutput`) carries the same truncated-marker
defect Core fixed in `compaction.ts`** — `node-runner.server.ts` is 337-3's file, so Core reported it
instead of editing. My probe `%TEMP%\rt337_4\probe_node_runner.mjs` (real command today):
```
cap 64: fullyMarked=false countedHeadCut=false tail="AAAAAA\n… [76 chars elided by run"
cap 90: fullyMarked=false countedHeadCut=false tail="86 chars elided by runner output"
cap 100: fullyMarked=false countedHeadCut=false tail="hars elided by runner output cap"
```
The marker text is longer than compaction's, so the broken range is wider (bad through ≥100). Not in
Trust's diff (status shows no `node-runner.server.ts`). Wiring rule says Trust should fix it or report
it. Severity LOW (only a caller passing cap 64..~105 triggers it; default `RUNNER_OUTPUT_MAX_CHARS` is
large), but it is the same defect in the same round under the same owner.

## 10. Minor notes (do not affect behaviour)
- `codegen.server.ts`/`verify.ts` separator `\u0002`: reduces but does not eliminate concatenation
  collisions (fields could themselves contain `\u0002`), so the comment "no byte can enter either field
  undetected" overstates. The referenced `packet.ts` precedent presumably has the same property. LOW;
  a length-prefix (`${len}:${a}${b}`) would be truly boundary-safe. Not a blocker.
- Core used `git stash push -- <path>` for two RED probes; working tree shows no stash entry now, but
  the boundary must confirm `git stash list` is empty (Guardian watches this).
- Pulse's `console.tsx:2404` `void …then().finally()` (no onRejected) reported-not-fixed by Pulse; I
  did not independently confirm reachability (documented as defensive-only).

## 11. Correction to §5 — the Trust pin regression was TRANSIENT and is now FIXED
My §5 RED (`codegen.server.test.ts:3824 expected '368828860' actual '3060450434'`) was real at the
moment I ran it (Trust was mid-edit). Trust then added the second hunk
(`@@ -3788,7 +3821,9 @@`: `String(fnv1a(\`${KANBAN_MODULE.trim()}\u0002${evidence}\`))`) and the
test now passes. Re-verified on the settled bytes: `--test-name-pattern="the verify record is
deterministic"` → `ok 1`, `# tests 1 / pass 1 / fail 0`. So the final tree has NO stale pin from
this change. No lane log outran its bytes here (Trust's §2 claim matches the final bytes).

## 12. Trust (337-3) verification — CONFIRMED with one OMISSION
**CONFIRMED RED-FIRST (my scratch):** the `\u0002` boundary at `verify.ts` `applyVerifyOutcome` and
`codegen.server.ts` `verifyOutcomeArtifact`+`upgraded`. Reverting the separator in scratch → the two
new tests RED (`not ok … boundary-safe`, `not ok … separates the module/evidence boundary`).
The `packet.ts:390` citation is accurate (`rows.join("\u0002")`), so the comment is honest.

**OMISSION (in-round wiring miss):** Trust §9 states "No cross-domain defect was found this lane".
But Core's §6 reported that **`node-runner.server.ts:110-133` (`clampRunnerOutput`) — Trust's own
file — carries the exact truncated-marker defect Core fixed in `compaction.ts`**, and I confirmed it
by probe (§9 above: caps 64..100 ship an unmarked marker stub). Trust's log never mentions it; their
own `node-runner` residual (§4.1) is a different, unrelated dead-catch. This is a missed mirror of
the round's own fix under the owner's "proper wiring" rule. Severity LOW (default cap is large), but
it belongs in the boundary's open list: apply the same 3-line fallback to `clampRunnerOutput`.

## 13. Final state (all writers stopped ~20:27; no src file newer than the logs)
- Round diff: 19 tracked files modified (+258/−30), 2 new untracked tests
  (`auth/auth-import-contract.test.ts`, `db-bootstrap.test.ts`), **0 deletions**, no reformat-only
  hunks, no rewrite. `git stash list` empty; reflog shows no new entry.
- Touched-suite run (Node 22, final bytes): the 11 suites above →
  **`# tests 548 / pass 548 / fail 0 / skipped 0`**, exit 0.
- typecheck exit 0; lint 0 warnings (my runs).
- Lane logs present for all three (337-1, 337-2, 337-3). All src edits stopped by 20:25:36;
  no writer active after the logs.

## 14. Falsification summary (what survived, what did not)
- **Pulse auth-import pin — REFUTED (weak).** `auth/auth-import-contract.test.ts:56` cannot fail for
  `.server`/`.client`-suffixed extensionless imports; two of the three files Pulse fixed
  (`gate-session.server.ts:11`, `middleware.ts:41-42`) carry exactly that class. Proof above.
- **Trust pin — WAS REFUTED, THEN REPAIRED.** The `3824` RED I found was fixed by Trust before the
  tree settled; final bytes pass. No claim now outruns its bytes.
- **Everything else — CONFIRMED** (each fix's new test driven RED in scratch, GREEN on the tree).
- **Could not falsify:** the four Core fixes (validated), the three Pulse fixes (validated end-to-end,
  including a live auth-module load probe), and Trust's separator; no `as any`/`@ts-ignore`/empty
  catch/hardcoded return/deletion/reformat in the round diff.
- **Auth test, case 2 HAS teeth:** reverting `pglite-dialect.ts` to a parameter property in scratch →
  `not ok 1 - no TS parameter properties …` (offender `pglite-dialect.ts: constructor(private readonly …
  )`). Only case 1 (the extension check) is the weak half.
- **Diff census:** 0 added lines carry `as any`/`@ts-ignore`/`@ts-expect-error`/TODO/empty-catch/
  hardcoded return; the only `stub`/`marker` hits are prose in tests/comments. `git diff` `-` lines = 30,
  all replaced content; `--name-status` = 19 `M`, **0 `D`**; `git stash list` empty; no reformat-only
  hunk (every hunk is behavioural or a test).

## 15. Full lib leg on the settled tree (my independent run)
`node --experimental-strip-types --test --test-reporter=tap "src/lib/**/*.test.ts"` →
**`# tests 2860 / pass 2850 / fail 0 / skipped 10`, exit 0**. (Baseline in the W51 README is
"2848 lib tests / 0 fail"; +12 tests from the round, 0 fail.) Skip list checked separately.
Scripts leg not re-run by me (parent owns the boundary gate).
</content>
</invoke>
