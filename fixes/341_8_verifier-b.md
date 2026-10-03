# fixes/341_8_verifier-b.md — verifier B, W341 wave (adversarial, no trust)

**Root:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD:** `2d5ee35` + the large uncommitted W341 wave.
**Runtimes:** host `node` v24.15.0; pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
**Scratch (outside the repo):** `%TEMP%\rt341_vb\` — independent probes only.
**Constraints honored:** working tree NOT modified (no `src/**`, `scripts/**`, `fixes/**` edits other
than this append-only log; no `git checkout/stash/reset/apply`); no full gate; targeted suites only, both
runtimes; no keyed LLM calls; no secret printed. Destruction compared against
`%TEMP%\rt341_parent\baseline_tracked.txt`.

**Verdict summary: claims 1, 2, 5 CONFIRMED; claim 3 PARTIAL (two stale on-screen claims the wave
itself created); claim 4 PARTIAL (the key/shadow, wallet-class, and scorecard-bar findings hold, but
the log's "both probes" fix claim is not matched by the bytes); census clean within `src/lib/**` +
`scripts/**`; destruction CLEAN.**

---

## Claim 1 — Governance (341-5): the forge latch is closed; M4 parity — **CONFIRMED**

Independent probe `%TEMP%\rt341_vb\probe_gov.mjs` (imports the repo's own `doctor.ts` /
`maker-score.ts`; Node 22 + Node 24, identical):

```
=== CLAIM 1: forge path ===
productComplete(ov9Project) = true
A) coerceFactoryClaim(forgeBlob, no-record) latch = false | gaps = ["no human-approved fixtures (decidedBy:\"human\")"]
B) coerceFactoryClaim(forgeBlob, human-record) latch = true | gaps = []
C) evidenceFromJobInventory extra.humanFixtures:true -> human = false | latch = false
D) evidenceFromJobInventory human-record -> human = true | latch = true

=== CLAIM 1b: M4 parity ===
M4 {ok:false, detail:'x', label:'tested', evidenceHash:'h'} = 0
M4 {ok:true, label:'tested', evidenceHash:'h'} (no detail) = 0
M4 {ok:true, detail:'x', label:'tested', evidenceHash:'h'} = 1
M4 {ok:true, detail:'x', label:'tested'} (no hash) = 0
M4 absent = 0
```

Pre-fix bytes prove the RED was real (`git show HEAD:src/lib/doctor.ts` /
`...:maker-score.ts`):
- `evidenceFromJobInventory`: `humanFixtures: extra?.humanFixtures === true || humanFixturesFromProject(extra?.project)`.
- `coerceFactoryClaim`: `humanFixtures: blob.humanFixtures === true || humanFixturesFromProject(project)`.
- `m4MachineVerifiable`: only `lt.label === "tested"` + non-empty `evidenceHash` — a hollow
  `{ok:false, label:"tested", evidenceHash:"h"}` scored 1.

Post-fix bytes (`doctor.ts:417-425,570-583`; `maker-score.ts:535-560`) derive the human term from the
project record only and require `label` + `ok===true` + non-empty `detail` + non-empty `evidenceHash`,
byte-identical to dod's `p6-verified` probe (`dod.ts:686-702`). Control B/D confirm the bar is untouched
(a real `{approval:"approved", decidedBy:"human"}` record still closes the latch). **CONFIRMED.**

---

## Claim 2 — Evidence→delivery (341-3) — **CONFIRMED**

Probe `%TEMP%\rt341_vb\probe_evidence.mjs` (Node 22 + 24, identical):

```
=== CLAIM 2: tested mint refusals ===
control full envelope -> minted: true
absent cases -> minted: false
empty cases [] -> minted: false
junk cases [null,42,{}] -> minted: false
no-expression cases [{id:'c1'}] -> minted: false
no finalSource -> minted: false
empty evidence -> minted: false

=== CLAIM 2: lint consumer ===
lint renders into artifact: true
lint-bearing pass still mints: true

=== CLAIM 2: packetInputHash covers brief ===
hash(alpha) = 302451549
hash(beta)  = 3876565035
brief edit moves hash: true
same input stable: true
```

- **Mint refusals** — `verify.ts:181-222` refuses a `passed` envelope with absent/empty `cases`, a
  non-empty-but-junk case set (no runnable `expression`), no `finalSource`, or empty evidence; the
  control still mints `tested`. **CONFIRMED.**
- **Dead export gone** — `oracleSignatureFunctionNames` existed at HEAD
  (`git show HEAD:src/lib/verify.server.ts`); a repo-wide grep now finds it only in
  `verify.server.test.ts:1511-1520` (the guard asserting its absence). **CONFIRMED.**
- **`packetInputHash` covers `brief`** — `packet.ts:391-397` folds the brief with the compile's own
  coercion; the probe shows a brief edit moves the hash. **CONFIRMED.**
- **`withCommonJsExports` async/generator family** — independent probe `probe_wcjs.mjs`:
  `async function loadData` → binds `loadData`; `export function* stream` → `stream`;
  `export async function* drain` → `drain`; `const f = () => 1` and `export class C` → honest no-binding.
  **CONFIRMED.**
- **Continuation fields on a real-shaped run** — probe `probe_packet.mjs` on a synthetic P6 project:
  `## Mission`, `## Current edge`, `## Required output schema`, `input_hash`, `phase_coverage`,
  DoD-unmet line, and the new census line
  `Census: 3 artifact row(s) recorded — the newest 3 render below (window ≤ 8; the packet's own row is excluded).`
  all render. **CONFIRMED** (the `npm run typecheck` + oracle-spec command line is state-conditional on
  an emitted tree, so it was absent from the synthetic project — not a defect).

---

## Claim 3 — Console (341-4) — **PARTIAL (wild-plan copy is now stale; cassette copy is honest)**

- **Cassette row — honest.** `console.tsx:7377-7381` claims "wired at the provider seam
  (deepseek.ts / openai-compatible.ts) … RAPIDTOOL_CASSETTE_MODE=record|replay plus
  RAPIDTOOL_CASSETTE_TAPE arms it … no console control; no run-eval/CLI --record/--replay flag". Bytes
  match: both provider entry points wrap the wire call (`deepseek.ts:763`,
  `openai-compatible.ts:626` `wrapWithActiveCassette(..., family)`), the env tokens exist
  (`cassette.ts:79,82`) and are read by providers; a repo-wide grep for `--record`/`--replay` finds
  none. **CONFIRMED.**

- **Wild-plan row — STALE / FALSE (hole).** `console.tsx:7325-7332` (both the `title` and the visible
  text, both ADDED by 341-4) says:
  > "The console's store driver (`store.startWildRun`) calls neither, so a console-started build
  > carries no stored plan." / "no plan on record — a console-started build is not planned …"

  The bytes now refute this: `store.ts:1357` (landed by the 341-6 resume, AFTER 341-4 closed)
  does `const staged = await stageWildPlan(cur, reviewer);` — the console driver now calls
  `stageWildPlan`, the same seam `engine.ts:4399` documents as "the ONE staging site for both real wild
  drivers (headless … **and the console store's `startWildRun`**)". `store.test.ts` (94/94 both
  runtimes) pins "a stored planner plan parks the console wild driver for review before any mutation
  (R13-f02)". So the surface describes a gap 341-6 closed. The 341-4 §7.1 STOP-and-REPORT was
  implemented by a sibling lane after this lane's copy was written. **REFUTED at the cross-lane boundary.**

- **Unattended row — STALE / FALSE (second hole, pre-existing text).** `console.tsx:7353-7358`
  (untouched by 341-4) says the CLI `unattended` verb drives "until parked — a stock HITL gate still
  parks with exit 2" and on screen "stock HITL gates still park". 341-6's resume landed `machineGates`
  (`headless.ts:678-690,711-712,1164-1191`; `rapidtool-cli.mjs:1162,1448` set it for the
  `run/gate --unattended` and `unattended` arms), so a stock HITL gate whose DoD passes is now cleared
  by the ledgered machine actor. The claim is false for the `unattended` verb (a `forceHuman`/red gate
  still parks). Not introduced by 341-4, but made false by 341-6.

No browser check is required for either finding — both are direct contradictions between a string and
the current bytes. (The cassette row's on-screen rendering was the only one needing a browser to see the
full 340-4 surface, and its bytes are proven above.)

---

## Claim 4 — Provider/eval (341-2) — **PARTIAL**

- **Key/shadow fix — holds.** `scripts/run-eval.mjs:3019-3022` declares `RAPIDTOOL_LLM_ENV_FILE =
  <ROOT>/.env` when `--keyed` and derives `keyedOk = resolveProcessKey("DEEPSEEK_API_KEY").effective
  !== null`; a repo key in `.env` now wins over a stale ambient key (coded `RT_E_LLM_KEY_SHADOWED`).
  **CONFIRMED.**
- **Wallet-class misclassification — holds.** `openai-compatible.ts:62` imports
  `isInsufficientFundsText` from `./deepseek.ts`; `:516` `noBalance = res.status === 402 ||
  isInsufficientFundsText(refusalText)`. The widened classifier
  (`deepseek.ts:322-324`) covers `insufficient_funds`/`insufficient-quota`/`insufficient_quota` on any
  status; the negative control ("insufficient permissions") stays `RT_E_LLM_REJECTED`.
  `key-rejected.test.ts` is green in the 609-test run. **CONFIRMED.**
- **Scorecard bar / cold-start — holds.** All 11 `research/eval-corpus/graders/*.json` carry
  `"passWhen": { "meanAtLeast": 1, … }` (grep over all 11 confirmed). `run-eval.mjs:2447`
  `if (row.mean < grader.passWhen.meanAtLeast) return false;` with `mean` out of nine criteria
  (`:2801 meanTotal`). `maker-score.ts:639-646` `m7Learning` returns `{score: 0, evidence: "no prior
  same-domain run — no learning claim without data"}` without a prior — so M7 = 0 on any first run,
  capping the ceiling at 8/9 < 1 and forcing `pass@1 = 0.000` by arithmetic. **CONFIRMED.**
- **Hole — the "both probes" fetch fix is overstated.** The 341-2 log §3.2 claims both probes'
  `baseFetch` were changed `globalThis.fetch → oneShotFetch`. The diff changes exactly one:
  `probeP6Reachability` (`run-eval.mjs:1602`) now uses `oneShotFetch`; `probeFundedness`
  (`run-eval.mjs:1711`) still reads `contextual: fetchImpl ?? globalThis.fetch`. `probeFundedness` is
  invoked in the keyed flow (`run-eval.mjs:3149`). `probeP6Reachability` is the probe that actually hit
  the W45/327 libuv abort (it is the one followed by an immediate `process.exit` in `--preflight`), so
  the live risk is plausibly closed — but the log's "both probes" statement is not matched by the bytes.
  Reported rather than judged harmful.
- The empirical "binding blocker is stochastic P6, not P7" reading comes from the lane's keyed runs; it
  is consistent with `run-eval.mjs`'s gate/stop taxonomy but is **not independently reproducible here**
  without keyed calls (budget/constraint).

---

## Claim 5 — Emitted UI barrel-following (341-1) — **CONFIRMED**

Probe `%TEMP%\rt341_vb\probe_ui.mjs` (Node 22 + 24, identical), driving the real `scaffoldProject`:

```
ui chars: 1522
imports barrel entry: true
calls re-exported name planRoute: true
binds origin field: true
binds destination field: true
no-callable fallback present: false
control: missing target -> no invented planRoute: true
control: honest no-callable fallback: true
```

An `export * from "./jobs/plan.ts"` entry whose callable lives only in the re-exported file now yields a
UI that calls `generated.planRoute(...)` and binds `origin`/`destination`; a barrel pointing at a
missing file does NOT invent the callable (honest "no callable" panel). The helpers
(`uiFollowStarExports` / `uiResolveTreeSpecifier`, `scaffold.ts:1414-1455`) are absent at HEAD
(`git show HEAD:src/lib/scaffold.ts` → no hits). **CONFIRMED.**

Targeted suites `scaffold.test.ts` + `compile-check.server.test.ts`: green in the 609-test run below.

---

## Claim 6 — Wave-wide census (`src/lib/**` + `scripts/**`, added lines of `git diff`)

Scope: **29 files, 1732 insertions / 178 deletions** (`git diff --shortstat -- src/lib scripts`;
the scoped set excludes `src/components/console.tsx`, which adds 20/…). No untracked source files in
scope (`git status --porcelain` → only `fixes/341_*.md`).

| Pattern | Added-line hits | Disposition |
|---|---|---|
| `as any` | **0** | — |
| `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` | **0** | — |
| `eslint-disable` | **0** | — |
| empty `catch {}` | **0** | the 7 added `} catch {` sites (`codegen.server.ts:3608,3636,3646,3651,3679`; `compile-check.server.ts:1477,1485`) all carry explanatory comments (best-effort cleanup / un-readable-guard fallback) |
| `.only(` / unconditional `.skip(` | **0** | — |
| `TODO`/`FIXME`/`XXX` | **2** | both NOT code TODO bodies: `codegen.server.ts:3567` is the regex doc string `path(line,col): error TSxxxx:` (substring `xxx`), and `doctor.test.ts:995` is a classifier fixture INPUT `'throw new Error("TODO(E-15) stub: implement x");'` |
| hardcoded `return true/false/null/undefined` | **7** | all guard clauses / fixture data: `headless.ts:683,685,686,687,689` (`machineApproveGate` refusal guards), `scaffold.ts:1444,1449` (parser not-found guards). No production `return` fakes a computation |
| comments claiming behaviour the bytes do not implement | **0 in scope** | every added comment checked against its bytes (governance, evidence, codegen gate, registry UNARMED, packet, verify) — see below |

Comment/byte spot-checks inside scope that hold: `registry.ts:282-300` "RESOLVED but deliberately NOT
ARMED" (callModel refuses a configured chain loudly, `:701-714`); `codegen.server.ts:3587-3598` +
`compile-check.server.ts:1455-1461` (the pre-seal `typecheckDir` gate runs the real compiler);
`engine.ts:4380-4396` (the moved `stageWildPlan` and its callers); `verify.ts`/`packet.ts` docs (proven
by the claim-2 probes). The only added comments that are now false are in `src/components/console.tsx`
(claim 3), which is outside the mandated census scope.

---

## Claim 7 — Destruction audit — **CLEAN**

```
git ls-files | Measure-Object -Line   -> 2087
baseline_tracked.txt                  -> 2087
Compare-Object baseline now           -> IDENTICAL SETS: baseline==now (base=2087 now=2087)
git diff --diff-filter=DR --name-status            -> (empty)
git diff --cached --diff-filter=DR --name-status   -> (empty)
git status --porcelain | where ^[DR]               -> (empty)
git stash list                                     -> (empty)
```

No tracked file was deleted, renamed, or stashed. The only additions are the untracked `fixes/341_*.md`
logs.

---

## Targeted suites (both runtimes)

| Suite set | node v24.15.0 | node v22.23.2 |
|---|---|---|
| `doctor` + `policy` + `maker-score` + `verify` + `verify.server` + `packet` + `handoff` + `scaffold` + `compile-check.server` + `key-rejected` + `cassette` | `# tests 609 / # pass 608 / # fail 0 / # skipped 1` | `# tests 609 / # pass 608 / # fail 0 / # skipped 1` |
| `scripts/run-eval.test.mjs` | `51 / 51 / 0` | `51 / 51 / 0` |
| `store.test.ts` | `94 / 94 / 0` | `94 / 94 / 0` |
| `headless.test.ts` | `157 / 157 / 0` | `157 / 157 / 0` |

The one skip is the pre-existing `RT_VERIFYKIND_INSTALL`-gated real-install test. No full gate, no
`npm test`, no build, no keyed call.

---

## Holes found (summary)

1. **Claim 3 (341-4) — `console.tsx:7325-7332` wild-plan copy is now false**: the console store driver
   *does* call `stageWildPlan` (`store.ts:1357`), so "calls neither / carries no stored plan" no longer
   matches the bytes. Introduced by the 341-6 resume landing after 341-4 closed.
2. **Claim 3 (341-4) — `console.tsx:7353-7358` unattended row is now false**: "stock HITL gates still
   park" is contradicted by 341-6's `machineGates` on the `unattended` arms.
3. **Claim 4 (341-2) — log §3.2 overstates the fetch fix**: `probeFundedness`
   (`run-eval.mjs:1711`) still uses `globalThis.fetch`; only `probeP6Reachability` was changed.
4. **Claim 3 note** — 341-4's own §7.2 (packet still does not render `Project.wildPlan`) remains true;
   `types.ts` stale planner comments outside the wave also remain (pre-existing).

## What I could not verify (and why)

- **The keyed scorecard's empirical stop taxonomy** (which fixtures stop at P6 vs P7, and the "binding
  blocker is stochastic P6") — reproducing it needs keyed LLM calls, which this verification is not
  permitted to make. The bar (`meanAtLeast:1`), the cold-start M7=0, and the resulting `pass@1 = 0`
  ceiling are proven from bytes.
- **A live-keyed end-to-end exercise of the 341-1 `defaultTreeTypecheck` gate** — same constraint;
  the gate's real-compiler RED/GREEN is covered by the targeted suite, not re-run keyed here.
- **Browser rendering of the console surfaces** — not needed: the two stale claims are string-vs-byte
  contradictions. The cassette row's provider-seam wiring is proven from bytes.

## Final message

Claims 1, 2, and 5 are **CONFIRMED** on bytes on both runtimes (the forge latch is closed and M4 is the
p6-verified probe; the junk-case mint is refused and `packetInputHash` covers `brief`; the barrel-follow
is real with an honest negative control). Claim 3 is **PARTIAL**: the cassette copy is honest, but the
wild-plan copy 341-4 corrected and the untouched unattended row are both false against the current bytes
because the 341-6 resume landed `stageWildPlan` in the console store driver and `machineGates` on the
`unattended` verb after 341-4 closed. Claim 4 is **PARTIAL**: the key/shadow fix, the shared wallet-class
classifier, and the `meanAtLeast:1` + M7-cold-start explanation of `pass@1 = 0.000` all hold, but the
log's "both probes" fetch fix is one probe, not two. The `src/lib/**` + `scripts/**` census is clean
(0 `as any`, 0 `@ts-*`, 0 empty catches, no code TODO bodies, no fake hardcoded returns), and the
destruction audit is CLEAN (2087 tracked files identical to baseline, no `D`/`R`, empty stash).
