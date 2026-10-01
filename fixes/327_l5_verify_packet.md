# fixes/327 — Lane 5 (W47 wave): verification engine · agent packet · phase/DoD plumbing

**Lane owner:** L5 (this is the lane's only landing log). **Files owned (only these):**
`src/lib/verify.server.ts`, `src/lib/verify.server.test.ts`, `src/lib/verify.test.ts`,
`src/lib/packet.ts`, `src/lib/packet.test.ts`, `src/lib/phases.ts`, `src/lib/phases.test.ts`.

**Runtime:** pinned Node 22 —
`& "C:\Users\mnril\AppData\Local\hermes\node\node.exe" --version` → `v22.23.2`.
The host default `node` is v24.15.0; every command below used the pinned binary.

**Shell reality:** this host has no bash/WSL (`bash -lc …` → *"Windows Subsystem for Linux has no
installed distributions"*), so repository greps used PowerShell
`Select-String -Path <file> -Pattern <re>` instead of `grep`.

## Baselines and final state (pinned Node 22)

| Suite / check | Command | Before | After | Δ |
|---|---|---|---|---|
| `verify.server.test.ts` | `… --test src/lib/verify.server.test.ts` | 25 / 25 / 0 | **27 / 27 / 0** | +2 tests |
| `packet.test.ts` | `… --test src/lib/packet.test.ts` | 64 / 64 / 0 | **66 / 66 / 0** | +2 tests |
| `phases.test.ts` | `… --test src/lib/phases.test.ts` | 10 / 10 / 0 | **10 / 10 / 0** | 0 (untouched) |
| full `src/lib` leg | `… --test "src/lib/**/*.test.ts"` | 2554 / 2531 / **13** | 2560 / 2548 / **2** | see note |
| typecheck | `npm run typecheck` | exit 0 | exit 0 | — |
| lint (my files) | `npx eslint <6 files>` | — | exit 0 | — |

**Attribution — the red tests are NOT this lane's.** Baseline (13 red) → owning files, via
`Select-String -Path "src\lib\*.test.ts" -Pattern "<test titles>"`:
`headless.test.ts` (573/1464/1648/1693/2738/2792), `lesson-writers.test.ts` (151),
`wild-seal.test.ts` (14/19/90/173/295) — all sibling lanes (Lane 1/2 own `headless.ts`, which is
hot this wave). Final run (2 red): `lesson-writers.test.ts:563` and `:612`
(`headless.ts:231` / `headless.ts:208/231` OV-13 rows) — again a sibling suite, not mine. The leg
moved 2554→2560 tests and 13→2 red because siblings were editing concurrently; my 3 suites are green
and my +4 tests are the only ones this lane added.

---

## L5-01 — `packet.ts` row-level junk throws a TypeError out of `compileAgentPacket` (R2-f05 / W-25e) — FIXED

**Finding id:** R2-f05 (`research/multiagent/thoroughanalysis.md`, task W-25(e)) — the *row-level*
residual of the A6c/M3-18 *container* guards (pinned by
`packet.test.ts` "A6c/M3-18: junk collection containers compile…"). The register lists the exact
unguarded reads at `packet.ts:465/483/531/605/666` (drifted; re-grepped today).

**Why it matters (reachability, read this session, not inferred):**
- `hydrateProject` keeps crew/oracle rows **raw**: `engine.ts:2611-2612`
  (`oracle: Array.isArray(raw.oracle) ? raw.oracle : []` / `crew: … raw.crew …`) — container-only.
- `io.ts`'s `defendRowArray` repairs those rows on the **import path only**
  (`io.ts:238/242/246`), and its own comments state the consequence verbatim:
  *"a null row crashes the packet crew render (c.role read)"* / *"a null row crashes the packet
  oracle render (t.name read)"*.
- `compileAgentPacket` is called by `stampPacket` (`engine.ts:373-375` ← store `approve/execute/
  refreshPacket`, no try/catch) and by `emptyProject`'s tail. A throw there walks
  `seedIfEmpty` → `store.ts:812-815 recoverFromCorruptPersistence`, which re-seeds EMPTY — the wipe
  chain `packet.ts`'s own `isoFromMs` docblock documents (`store.ts:839-858`).

**Files/lines (after fix):** `packet.ts:55-74` (new `str()` / `rows()` helpers), `:145` (System-JSON
decision/phase rows), `:199-217` (both envelope maps, `?.` + `str`), `:260-262` (`isoFromMs` param
widened to `unknown` — its body already guarded), `:631-635` (compile rows), `:720-727` (artifacts),
`:761-767` (ledger rows), `:782-796` (current-edge / prior-rejection rows), `:830-846`
(crew/contracts/oracle rows), `:894-900` (spec-graph node rows), `:929-933` (`lastTest.ok`),
`:1000-1003` (scorecard axes), `:1143-1148` (`profileScopeFiles` node rows).

**Probe BEFORE** — `C:\Users\mnril\_rt_l5_probe.ts` (scratch, outside repo, imports the real module):

```
THREW TypeError: Cannot read properties of null (reading 'kind')       <= artifacts:[null]
THREW TypeError: Cannot read properties of undefined (reading 'length') <= artifacts:[{no body}]
THREW TypeError: Cannot read properties of null (reading 'role')       <= crew:[null]
THREW TypeError: Cannot read properties of null (reading 'name')       <= oracle:[null]
THREW TypeError: Cannot read properties of undefined (reading 'map')   <= contracts:{entities:[{name:'x'}]} (fields missing)
THREW TypeError: Cannot read properties of null (reading 'name')       <= contracts:{entities:[null]}
THREW TypeError: Cannot read properties of null (reading 'label')      <= scorecard:{axes:[null]}
THREW TypeError: Cannot read properties of null (reading 'decidedAt')  <= decisions:[null]
THREW TypeError: Cannot read properties of null (reading 'id')         <= phases:[null]
OK                                                                     <= logs:[null]
OK                                                                     <= memory:[null]
OK                                                                     <= research:[{items:[null]}]
lastTest.ok="yes" => "P6 template self-test (last run): pass — not a boolean"
```

**Probe AFTER** (same file):

```
OK  … (all 12 shapes)
lastTest.ok="yes" => "P6 template self-test (last run): FAIL — not a boolean"
```

A **second, wider matrix** (`C:\Users\mnril\_rt_l5_probe3.ts`, 22 shapes) surfaced one shape the
first probe missed — `specGraph:{order:[42],nodes:[null]}` threw
`Cannot read properties of null (reading 'id')` inside the A5 `.find((x) => x.id === id)`. Fixed in
the same class (`packet.ts:896`, `:1145`). After:

```
matrix: 22 shapes, 0 threw
```

**Fix (patch-only):** a module-local total floor — `str(v)` (non-string ⇒ `""`) and `rows(v)`
(non-array ⇒ `[]`, rows read as opaque records) — applied at every row-level read, plus
`lastTest.ok === true` (declare-or-strike: the P6 gate `dod.ts` demands `ok === true`, so a
hand-edited `{ok:"yes"}` must render **FAIL**). Valid rows render byte-identically, so the 64
pre-existing `packet.test.ts` pins stayed green untouched.

**Regression tests added** (`packet.test.ts`, +2 tests → 64→66):
1. `R2-f05: a null/foreign ROW in any project collection compiles — never a TypeError`
   (11 row shapes + a `profileScopeFiles` wrapper check).
2. `R2-f05: lastTest.ok must be the boolean TRUE to render pass (declare-or-strike)`
   (negative `"yes"` → FAIL; positive `true` → pass — the fix tightens, never weakens).

**TEETH check** (repo standard, RESUME.md §13.3): copied `src/lib` to
`C:\Users\mnril\_l5_teeth` (outside the repo), reverted **only** `packet.ts` there with
`git show HEAD:src/lib/packet.ts > …\packet.ts` (verified: `has rows(): false | has str(): false`),
and ran the identical assertions from a scratch test (`r2f05_teeth.test.ts`):

```
REVERTED (git HEAD)  → not ok 1 (first shape: "Cannot read properties of null (reading 'kind')"
                       at packet.ts:691) · not ok 2 ("a non-boolean ok is not a pass")
                       # tests 2 / # pass 0 / # fail 2
FIXED (repo copy)    → ok 1 · ok 2   # tests 2 / # pass 2 / # fail 0
```

Two fix assertions RED on HEAD, GREEN on the fix. Controls (the pre-existing 64 packet pins) stay
green in the repo suite.

---

## L5-02 — `runCases` compile verdict was parsed position-0, so module stdout could forge a refusal — FIXED

**Finding:** the harness's own `HARNESS_EXPORTS` parser is explicitly *last-line-wins*
(`verify.server.ts:526-531`), but the compile verdict used `/^HARNESS_COMPILE fail/.test(out)` — a
regex with **no `m` flag**, so `^` anchors at string index 0 only. Any line the module under test
printed before the harness's marker could displace the real verdict.

**File/line:** `verify.server.ts` — `runCases`, the parse loop `:531-552` and the verdict `:555`
(before: the single line `const compileFail = /^HARNESS_COMPILE fail/.test(out);`).

**Probe BEFORE** — `C:\Users\mnril\_rt_l5_probe2.ts`:

```
pass=false compileError="source failed to compile in the harness"  <= silent + syntax error (control)
pass=false compileError="source failed to compile in the harness"  <= console.log FIRST + syntax error
pass=false compileError="source failed to compile in the harness"  <= module logs "HARNESS_COMPILE fail" but COMPILES fine  ← BUG
pass=true  compileError=null                                       <= control: module logs then compiles; case passes
```

Row 3 is the defect: a module that **compiles and exports `add`** is refused with
"source failed to compile in the harness" purely because its own first stdout line is the marker
text. (The harness's real marker is emitted *after* the module body, so last-wins is safe: on a real
compile failure the construction throws, the module never runs, and the harness's `fail` line is the
only marker.)

**Probe AFTER:**

```
pass=false "source failed to compile in the harness"   <= silent + syntax error (control unchanged)
pass=false "source failed to compile in the harness"   <= console.log FIRST + syntax error (unchanged)
pass=true  compileError=null                           <= marker-printing module now passes  ← FIXED
pass=true  compileError=null                           <= control unchanged
```

**Fix (patch-only):** track `compileMarker` inside the existing per-line scan —
`if (trimmed.startsWith("HARNESS_COMPILE ")) compileMarker = trimmed.slice("HARNESS_COMPILE ".length).trim();`
— then `if (compileMarker.startsWith("fail"))` returns the same coded refusal. Fail-closed is
preserved; a missing marker still falls through to the `!callables` refusal.

**Regression tests added** (`verify.server.test.ts` +2 → 25→27): the marker-printing module must
pass; a real syntax error must still name the compile failure.

**TEETH check** (`verify.server.ts` reverted to HEAD in the scratch tree, same procedure):

```
REVERTED (git HEAD)  → not ok 1 (marker-printing module) · ok 2 (control syntax error)
                       # tests 2 / # pass 1 / # fail 1
FIXED (repo copy)    → ok 1 · ok 2   # tests 2 / # pass 2 / # fail 0
```

---

## Items examined and NOT changed (honest report)

### N-1 — `parseOracleJson` collapses "unparseable" vs "zero cases" (owes the fixes/257 pin) — NOT ENACTED

`fixes/257_error_ledger_v3.md:230` registers this residual: `verify.server.ts` "model returned an
unparseable oracle payload" (`:840`/`:845` region) vs "no cases to run" (`:469`) have **no pin
distinguishing them**. Reproduced (`C:\Users\mnril\_rt_l5_probe4.ts`):

```
null    <= not json
null    <= {} (no cases key)
null    <= {"cases":[]} (valid JSON, zero cases)
[{"id":"a","expression":"1===1"}]   <= {"cases":[{"id":"a","expression":"1===1"}]}
```

So a **valid** model reply carrying zero cases is reported as "unparseable" — a wrong diagnosis
(the run still refuses, fail-closed). The honest fix needs `parseOracleJson` to distinguish
empty-vs-malformed, which changes its `VerifyCase[] | null` contract and every existing
`parseOracleJson(...) === null` pin; that is a return-type change, not a small patch, and the file is
in this lane but the change is not low-risk under a 5-lane concurrent wave. **Registered here as
owed** (the pin is still owed per fixes/257); no code changed.

### N-2 — C-02 "phantom export" is `algo-tools.ts`, not this lane's files

The brief's `109` C-02 pointer resolves to `exportedNamesOf` (`algo-tools.ts:185`), fixed by 109's
T-08. Falsifier: `Select-String -Path "src\lib\*.ts" -Pattern "exportedNamesOf"` → the symbol lives
in `algo-tools.ts` / `algo-tools.test.ts` only — neither is an L5-owned file.

### N-3 — R10-f03 (rail mislabels a "tree-run" mint) — could NOT reproduce

The register (thoroughanalysis R10-f03) claims the current-edge rail renders a tree-run mint as
"P6 template self-test". Falsifier — every `lastTest.label` minted in non-test `src/lib`:

```
Select-String -Path "src\lib\*.ts" -Pattern 'label:\s*"(tested|real-run|tree-run|template[^"]*)"' | Where-Object Filename -notlike "*.test.ts"
→ codegen.server.ts:2801/2804 → label:"tested";  verify.ts:204 → label:"tested"
```

No production path mints a `"tree-run"` label, and the rail already special-cases `"real-run"`
(`packet.ts:930-936`). There is nothing today to mislabel → not reproducible, no change made.

### N-4 — `runCases` vacuity when a callable-exporting module's case never touches it

`oracleBriefGrounded` requires a *called* hit only when the brief supplies nouns / contract
signatures (`verify.server.ts:646-682`: `if (targets.length === 0) return { ok: true }`). With a
vocabulary-free brief and no signatures, a self-contained literal case against a callable-exporting
module can pass. This is the **documented, deliberate** floor (`oracleBriefGrounded` docblock:
*"A vocabulary-free brief with no contract signatures passes vacuously (nothing to ground
against)"*), and `runCases`' own T-01 gate correctly refuses the no-export shape. I did **not**
treat it as a defect: tightening it would false-reject the prompt's own allowed case form
(`typeof buildPlan === 'function'` — no call). Recorded, not changed.

---

## T-14 (`canEnter` strictly linear → a red P6 makes P7–P12 unreachable) — DOCUMENTED ONLY, NOT ENACTED

**Hard scope constraint this wave:** the brief forbids changing `canEnter` / the phase-advance gate,
because the journey step arithmetic is being stabilised concurrently in `headless.ts` (Lane 1).
**No behaviour was changed in `phases.ts`** (10/10 unchanged). Evidence + proposed fix only.

**Evidence (read this session):** `phases.ts:126-132` —

```ts
export function canEnter(from: PhaseId, to: PhaseId): boolean {
  if (!PHASE_BY_ID.has(from) || !PHASE_BY_ID.has(to)) return false;
  return to === ((from + 1) as PhaseId);
}
```

Command (pinned Node 22): `canEnter(6,7) = true · canEnter(7,8) = true · canEnter(6,8) = false` —
the graph admits **only** `from + 1`, with no skip/bypass edge. The engine advances a phase only on
completion, so a phase that never completes (the shipped end-to-end run stopped at a red P6) leaves
P7–P12 permanently un-enterable. The consequence is already surfaced honestly by the landside T-14
census (`phaseCoverage` / `phaseCoverageLine`, `phases.ts:200-243`; pinned in `packet.test.ts`
"T-14: a stopped 7-phase run reports 7 of 13 / 0 — never implies all 13 ran"), i.e. **the honest
reporting half of T-14 is landed; only the graph-reachability half is open.**

**Proposed fix (NOT enacted):** give the graph a declared, explicit recovery edge (e.g. allow
`canEnter(P6, P7)` to be gated by a *coded, ledger-recorded* HITL override rather than by P6
completion), or — cheaper and lower-risk — keep the linear graph and make the rail/envelope state
*"7 of 13 phases executed; P7–P12 are unreachable until P6 completes; a red P6 halts the tail"*
instead of leaving the reader to infer it. Either change touches the journey step arithmetic and
must land alone after Lane 1's `headless.ts` stabilisation.

---

## Commands run (all pinned Node 22)

```powershell
npm run typecheck                                                        # exit 0 (before & after)
& $node22 --experimental-strip-types --test --test-reporter=tap "src/lib/verify.server.test.ts"   # 27/27
& $node22 --experimental-strip-types --test --test-reporter=tap "src/lib/packet.test.ts"          # 66/66
& $node22 --experimental-strip-types --test --test-reporter=tap "src/lib/phases.test.ts"          # 10/10
& $node22 --experimental-strip-types --test --test-reporter=tap "src/lib/**/*.test.ts"            # 2560/2548/2 (2 = lesson-writers, sibling)
npx eslint src/lib/packet.ts src/lib/packet.test.ts src/lib/verify.server.ts src/lib/verify.server.test.ts src/lib/phases.ts src/lib/phases.test.ts  # exit 0
```

Scratch artefacts (outside the repo, disposable): `C:\Users\mnril\_rt_l5_probe.ts`,
`_rt_l5_probe2.ts`, `_rt_l5_probe3.ts`, `_rt_l5_probe4.ts`, and the teeth tree
`C:\Users\mnril\_l5_teeth\` (a copy of `src/lib` + a `node_modules` junction + `package.json
{"type":"module"}`). No repo file outside this lane's seven was modified.
