# 333 audit pass (W47) — parent / boundary record

**Two independent watchdogs** were run against the landed 331 + 332 waves at HEAD `6575669`. Neither
took a lane log at its word: the **Verifier** tried to falsify the boundary claims and hunted for
mock/fake code and tests that cannot fail; the **Registrar** audited the record against the bytes and
made the handoff truthful. Briefs: `wave_plans/W47/watchdog-1-verifier.md`,
`wave_plans/W47/watchdog-2-registrar.md`. Their logs: `fixes/333_1_verifier.md`,
`fixes/333_2_registrar.md`.

## 1. The Verifier's verdicts on the boundary claims

| Claim | Verdict | Evidence |
|---|---|---|
| typecheck 0 (both legs) | **CONFIRMED** | `npm run typecheck` exit 0; gate `typecheck {ok:true, exit:0}` |
| lint 0 warnings | **CONFIRMED** | `eslint .` → 503 files, 0 errors, 0 warnings |
| 398 scripts + 2734 lib, 0 fail, 2 skipped | **CONFIRMED** | isolated `gate.sh`: `testsScripts {pass:398}`, `testsLib {pass:2734, fail:0, skipped:2}` |
| build 0 | **CONFIRMED** | `npm run build` exit 0 |
| `gate.sh` `ok:true` | **CONFIRMED in isolation**; load-sensitive (F-3, now fixed) | see §3 |

**Count caveat, now recorded in `fixes/332_0_parent.md` §1:** the lib figures are environment-dependent.
`gate.sh` under git-bash reports 2734 with 2 skips; a plain `npm test` from PowerShell reports 2736
tests / 2726 pass / **10 skipped**, because eight suites `skip` when git-bash is absent. Both are real.

**Mock / fake-code census over the two waves (added lines, `src` + `scripts`):** 0 new placeholders,
0 new empty catches, 0 new production double-casts, 0 findings from the repo's own assertion-gap guard
(123 files). The three pattern hits are a remedy string, a deliberate JSDoc `@param {any}` in
`run-eval.mjs` under `checkJs`, and the emitted product's own canonical `TODO(E-15) stub` fixture.

**Ratchet teeth were proven adversarially:** the Verifier planted a real type error in
`rapidtool-cli.mjs`, watched the scripts ratchet fail 2/6 citing it, reverted, and proved with
`git hash-object` that the file returned to its committed bytes.

## 2. The Registrar's verdicts on the record

- **Claims with no bytes: none.** All twelve lane logs were read; every falsifiable claim was
  reproduced on current bytes.
- **Orphan list: empty.** Every file in all four commits traces to a lane log, a boundary report, or a
  register row — including each boundary-owner edit.
- **Hygiene: clean.** No probe file in any commit, nothing staged that needed not to be, `.env`
  untracked and un-prefixed, both append-only end-markers intact with all appends above them,
  `.gitignore` still covering build/test output.
- **The record was misleading a cold session in ten places**, the worst being the register's own body
  (`thoroughanalysis.md:22`) still asserting "the DeepSeek account is unfunded — all calls 402", which
  the 331 wave had disproved. All ten are corrected (see §4); every correction is additive or a dated
  in-place edit, and the register's fix went in as an append (`AW47-c01…c06`) because its body is
  protocol-frozen.

## 3. Findings and dispositions

| ID | Sev | Finding | Disposition |
|---|---|---|---|
| **F-1** | P2 | The async-await refusal — the 332 wave's headline guard — was **bypassable**: `getProperty(id)?.ok`, `getProperty(id)["ok"]`, `?.["ok"]`, and any `const NAME = async (…) =>` / `async function (…)` / class-method emission escaped it, because the property-read rule only matched a tail beginning `.` and async-name discovery only matched `async function NAME(`. | **FIXED** (lane 332-1). Optional and computed member reads are now refused (`property-read` / `computed-read`), async-name discovery covers arrow / function-expression / method / CJS-export forms, legal `await` and `.then/.catch/.finally` chains stay accepted, and the genuinely undecidable shapes are now named in the code and the log instead of implied away. `codegen.server.test.ts` 161 → 163. |
| **F-2** | P3 | A census "does not reconcile" branch could never fire (`planned`/`unbound` are complementary filters of `declared`), and its tests asserted the derivation's own invariant — tests no production change could fail. | **FIXED** (332-1) by deletion: the unreachable row, the helper, and the tautological assertions are gone; the partition is documented as holding by construction. |
| **F-3** | P3 | `gate.sh` was load-sensitive: run concurrently with another suite it returned `ok:false` with a phantom scratch-dir leak. | **FIXED** (332-6). Root cause: the test diffed *all* `tmpdir()/rapidtool-run-*` dirs, so any concurrent process's directory was blamed. It now runs the runner inside a **private temp root** and scans only that, with a 5 s settle. Teeth re-proven by planting a real leak (`finish()` skipping `removeScratchDir`) → the test still fails, in ~5 s instead of 45 s; reverted byte-identically. `exec.test.ts` 19/19. |
| **F-4** | P3 | `TreeRunOutcome.verified` over-claimed: a tree whose entry was a **deliberate UI-shell skip** still read `verified:true`, so a consumer could read "behavior verified" where nothing ran. | **FIXED** (332-3). Renamed to `declaredScriptsVerified` / `unverifiedDeclaredScripts`, per-script `verified` → `executed`, and a new `unverifiedEntry` carries the skip reason; `treeVerdictHash` distinguishes an entry-skipped verdict. No consumer branches on the field (the verdict flip remains owed), so the rename is behavior-neutral. |
| **F-5** | P3 | `doctor`'s `llm.configured` remained presence-only while the console chip had been fixed. | **FIXED** (332-2). `doctor`'s LLM block now carries `keyState` (`not-configured` / `unverified` / `rejected`) plus `lastKeyed` when a key-unusable outcome is known, tail-only. A transient class (timeout/402/5xx) stays `unverified` so it can never condemn a working key, and no case invents a green. `doctor.test.ts` 26 → 31, `headless.test.ts` 126 → 129. |
| **F-6** | P3 | 192 tracked files under `.t4scratch/` duplicate `src/lib/**`. | **NOT FIXED — pre-existing**, from an ancestor commit, outside both audited waves. Recorded for a future cleanup with its own decision. |
| **R-1** | P0 | The register's body still asserted the funding block the 331 wave disproved. | **CORRECTED** — `AW47-c01` appended (body left per its protocol). |
| **R-2** | P1 | `AGENTS.md` said 35 CLI verbs; the count source of truth gives **39**. | **CORRECTED** with a dated note. |
| **R-3** | P1 | Stale suite counts ("261/261, ~1957") in `AGENTS.md`, `START-HERE.md`, `README.md`. | **CORRECTED** to the measured values, both contexts named. |
| **R-4** | P1 | **This parent's own** `fixes/332_0_parent.md` §1 mis-attributed the test deltas (`+6/+2/+6`; the truth is +2/+2/0) and quoted one skipped-count context as the only one. | **CORRECTED** by an appended correction block in that file (append-only respected). |
| **R-5** | P1 | Flat "still ONE module wearing several filenames" claims in `RESUME.md`, `remainingwaves.md`, `README.md`, `START-HERE.md`, disproved for keyed runs. | **CORRECTED** with the keyless-floor qualifier and the measured keyed census. |
| **R-6** | P2 | `remainingwaves.md` / `taskuniverselog.md` / `finalsprint.md` read as a six-wave-old map, with keyed runs still "owed / owner-gated". | **CORRECTED** with dated blocks. |
| **R-7** | P2 | Tracked file counts in `START-HERE.md` / `docs-FOLDER-MAP.md` (213/46/587/108 vs 222/49/654/123). | **CORRECTED** with dated re-count notes. |
| **R-8** | P2 | `START-HERE.md` claimed lint carried 1 warning; it is 0. | **CORRECTED.** |
| **R-9** | P2 | A register row still said all 40 `scripts/**` files were unchecked. | **CORRECTED** — `AW47-c05`. |
| **R-10** | P3 | `fixes/331_0_parent.md` still said the CLI carried 38 typecheck errors (now 0). | **REPORTED** (that log is out of the Registrar's scope) — recorded here. |
| **R-11** | P3 | `fixes/332_0_parent.md` §5 items 3/4/6/8 name no owner or decision-maker. | **REPORTED** — `AW47-c06`; see §5 below, where owners are now named. |

## 4. Boundary gates after the fixes (every writer stopped)

| Gate | Result |
|---|---|
| typecheck | **exit 0** (both legs) |
| lint | **exit 0**, 0 warnings |
| assertions | **exit 0** |
| tests | **scripts 398 / lib 2747 / 0 fail / 2 skipped**, exit 0 |
| build | **exit 0** |
| `gate.sh` | **`ok:true`, exit 0**, `flakes: []`, `hardFails: []` |

The lib leg grew 2734 → **2747** (+13) from the five fixes, all green.

## 5. What remains open, with owners named

1. **No consumer refuses on `declaredScriptsVerified`** (the tree-run's declared scripts that did not
   run). Owner: whoever takes the CLI exit code / DoD mint / README banner. Constraint measured: a
   single `npm install` in that leg costs ~47 s, and flipping `ok` inside `treeRun` would red every
   fresh tree and block the P6 mint.
2. **134 type errors remain budgeted in `scripts/**`** across 14 files. Owner: the untyped-`.mjs`
   migration. The ratchet fails on any new error meanwhile.
3. **`doctor` on a bare Node CLI host cannot see a *prior* process's key rejection** — the tap is
   process-local, so `doctor` honestly degrades to `unverified`. Surfacing a previous run's rejection
   means persisting the outcome on the project record (the same shape as the `tokenUsage` fix). Owner:
   decision needed.
4. **`run` / `runUntilHitlAsync` expose no `code`**, so a P6-synthesis 401 cannot move the console chip
   or the doctor state. Owner: the `RunResult`/store shape.
5. **The async guard is lexical and now names its limits** — a Promise-returning callable not spelled
   `async`, a receiver call `obj.m()` / `this.m()`, and a dynamic computed key remain undecidable by
   design. Owner: no action; recorded as the guard's honest boundary.
6. **`R11-f01`**: the dev server binds `0.0.0.0` with no auth middleware. Owner: **the product owner**
   (it changes a documented host/port contract).
7. **`.t4scratch/`**: 192 tracked duplicate files. Owner: a future cleanup decision.
8. **`npm run eval` still not run** — it rewrites tracked `research/eval-out/**`. Owner: a wave that
   accepts the artifact churn.
9. **The stale User-scope `DEEPSEEK_API_KEY`** is still set on this machine; the repo wins over it and
   says so by tail. Owner: the machine owner.
