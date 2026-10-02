# W49 / 335-3 — "Transit" — the emitted product + the agent-facing packet

**Lane:** 335-3, persona "Transit". **HEAD at open:** `9cff073`, tree clean (only untracked
`wave_plans/W49/`). **Owned (STRICT):** `src/lib/scaffold.ts`, `src/lib/compile-check.server.ts`,
`src/lib/dod.ts`, `src/lib/packet.ts`, `src/lib/handoff.ts` + their `*.test.ts`; this log.
**Runtime:** repo-pinned Node **22.23.2** (`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node
**v24.15.0**; every suite below on BOTH. **Scratch (outside the repo):** `%TEMP%\rt335_3\`
(`probe-packet.mjs`, `probe-red-entry.mjs`, `probe-cli-main.mjs`, captured bodies) — the repo gained
no probe file. Keyless; no full gate (five siblings editing); no `npm run eval`; no secret printed.
Guardrails read: `wave_plans/W49/GUARDRAILS.md` (guardian).

## 0. Step 0 — reconciliation (claimed / on disk / still open)

Read: `fixes/331_3_transit.md`, `fixes/332_3_transit.md` (both rounds), `fixes/334_3_transit.md`,
`fixes/333_1_verifier.md` (F-4/F-6), `fixes/334_0_parent.md`, `wave_plans/W49/README.md`.

**Claimed (prior lanes):**
- 332-3 / 332-3b (F-4): `treeRun` carries a first-class `declaredScriptsVerified` +
  `unverifiedDeclaredScripts` (renamed from the over-broad `verified`) and `unverifiedEntry` for a
  deliberate kind-entry skip; `treeVerdictHash` folds the declared-script state.
- 334-3: `p6-verified` requires a genuinely EXECUTED-green `tested` stamp (`ok === true` + non-empty
  detail); the emitted README **leads** with a declared-scripts-unverified banner; a `./`-prefixed
  declared `main` is honored (W48 T3); `dod.test.ts` created.
- 334-0 §3.3 / 334-1: `treeRunTestedEvidence` (`codegen.server.ts`) folds `declaredScriptsVerified`
  + sorted `unverifiedDeclaredScripts` + `entrySkipped` into the minted evidence hash.

**On disk (verified by reading the bytes today):**
- `src/lib/compile-check.server.ts:461` / `:466-467` — the field types; `:1708-1716` — the
  computation (`declaredScriptsVerified = ok && no unverified declared scripts`; `unverifiedEntry`
  set iff the entry run was a deliberate skip). **CONFIRMED.**
- `src/lib/compile-check.server.ts:720-733` — `treeVerdictHash` folds the declared state +
  `entrySkipped`. **CONFIRMED.**
- `src/lib/scaffold.ts:2772` `declaredScriptsBanner` and its emission in `readmeBody`; baseline
  `scaffold.test.ts` 50/50 includes the two banner pins. **CONFIRMED.**
- `src/lib/codegen.server.ts:4584-4625` `treeRunTestedEvidence` folds the declared-script state
  (335-1's file — read-only here). **CONFIRMED.**
- `src/lib/dod.ts` `p6-verified` guard (334-3) — `dod.test.ts` 3/3. **CONFIRMED.**

**Still open (file:line), actioned or reported below:**
1. `src/lib/compile-check.server.ts` `treeRun` (`entryGreen`/`coreGreen` at `:1685-1698`): a RED
   kind-entry (run `fail`/`error`/`timeout`) leaves top-level `outcome.error` **unset** — reproduced
   (`%TEMP%\rt335_3\probe-red-entry.mjs` → `ok:false, run.run:"fail", error:null`). **FIX (§4).**
2. `src/lib/scaffold.ts:695-698` `packageJson` cli-tool branch declares only `bin`, no `main`;
   `resolveHeadlessEntry` then falls through to a job module, so corrupting the declared cli entry
   `src/main.ts` stays GREEN — reproduced (`probe-cli-main.mjs` → `corruptEntry:"src/jobs/dispatch.ts",
   corruptOk:true`). **FIX (§5).**
3. `src/lib/packet.ts` — the packet never renders the CURRENT phase's DoD exit criteria (no `dod`
   import; `handoff.ts:126-159` renders them). Probe `has DOD/Exit criteria section: false`. **FIX (§3).**
4. `src/lib/packet.ts:119-127` `REPORT_SCHEMA` calls itself "the exact machine report shape the
   ingest seam validates", but omits the seam's phase-match rule and caps
   (`report-intake.ts:140-146`, `:110-111`, `:155-159`, `:175-179`). **FIX (§3).**
5. `src/lib/packet.ts:1009` Scorecard fallback "Not written — run Phase 0 first." contradicts the
   packet's own "work ONLY the current phase" rule when `currentPhase > 0`. **FIX (§3).**

**Not mine (reported, not touched):** the CLI `emit --run` exit for a fresh unverified tree
(`scripts/rapidtool-cli.mjs`, 335-4); `codegen.server.ts` mint internals (335-1).

## 1. Baseline (measured today)

| Suite (Node 22.23.2 / Node 24.15.0) | tests | pass | fail | skip |
|---|---|---|---|---|
| `packet.test.ts` | 66 | 66 | 0 | 0 |
| `handoff.test.ts` | 15 | 15 | 0 | 0 |
| `scaffold.test.ts` | 50 | 50 | 0 | 0 |
| `compile-check.server.test.ts` | 79 | 78 | 0 | 1 |
| `dod.test.ts` | 3 | 3 | 0 | 0 |
| combined owned (5 files) | 213 | 212 | 0 | 1 |

## 2. The Agent Packet audit (packet.ts + handoff.ts)

**The real packet body BEFORE** is captured at `%TEMP%\rt335_3\packet-before.txt`
(`probe-packet.mjs`, engine-backed `emptyProject`, P4/HITL/decisions/crew/contracts/oracle). Audit:

| # | Finding | Kind | Evidence |
|---|---|---|---|
| P-1 | The current phase's **DoD exit criteria** are absent — the agent gets the rules and the output schema but never what "done" means for the edge | completeness | probe `has DOD…: false`; `handoff.ts:126-159` has them |
| P-2 | `report_schema` is not the "exact" shape the seam validates: the seam also requires `phase === current_phase.id` and caps artifacts at 12 / body at 50 000 | correctness | `report-intake.ts:122-181` |
| P-3 | Scorecard fallback instructs "run Phase 0 first" even when the edge is >0 — contradicts the packet's own current-edge-only rule | misleading | `packet.ts:1009` |
| P-4 | job/contract context present (lattice Jobs, spec-graph nodes, Contracts A6, Oracle A7) | OK | real body |
| P-5 | `capabilities.vault_search: true` / `ingest: true` / `verify: "config-gated"` are real surfaces (`vault.ts`, `report-intake.ts`, config-gated verify) — no over-claim | OK | real body |

**Intended packet patch (checkpoint before applying):**
1. import `DOD`/`runGate` from `./dod.ts` (client-safe: `handoff.ts` already imports it);
2. compute `const gate = runGate(project, phase)` and `unmetIds`, mirroring `handoff.ts`;
3. insert a `## Exit criteria (DoD)` section (gate PASS/FAIL line + `- [x]/[ ]` checklist) after the
   Current-edge sub-lines, before the decision ledger;
4. extend `REPORT_SCHEMA` strings: `phase` → `"integer 0..12 (must equal current_phase.id)"`,
   `artifacts` → `"{title, body, language?}[] (optional; max 12, body ≤ 50000 chars)"`;
5. reword the Scorecard fallback to `"Not written — the scorecard is a Phase 0 output."`
   (no out-of-scope instruction).

---

## 3. The packet audit — fixes and the REAL before/after body

Probe `%TEMP%\rt335_3\probe-packet.mjs` compiles the REAL packet for an engine-backed
`emptyProject` at P4 (HITL pending, one decision row, crew/contracts/oracle populated). Body captured:
`packet-before.txt` (HEAD) → `packet-after.txt` (fixed). The two afters differ only in the
per-run `project_id`/`compiled_at`/`input_hash` (the fixture mints a fresh id); every structural line
is byte-identical across runs.

**Fix P-1 (completeness) — the current edge DoD exit criteria now render.** `packet.ts:9` imports
`DOD`/`runGate`; `:858-861` computes the gate exactly as `handoff.ts` does; `:956` adds the section.
BEFORE: the packet's section list had no DoD (probe `has DOD/Exit criteria section: false`). AFTER:

```
## Exit criteria (DoD)
Gate P4: FAIL (1 unmet) — the criteria below are machine-checked against this project's state; satisfy them, do not restate them.
- [ ] Security isolation artifact exists for P4
- [x] P4 approved — decision ledger records the approver (human or autopilot)
```

**Fix P-2 (correctness) — `report_schema` now states the seam's ACTUAL acceptance rules.**

```
BEFORE:  "phase": "integer 0..12",
         "artifacts": "{title: string, body: string, language?: string}[] (optional)"
AFTER:   "phase": "integer 0..12 (must equal current_phase.id)",
         "artifacts": "{title: string, body: string, language?: string}[] (optional; max 12, each body ≤ 50000 chars)"
```
(Seam of record: `report-intake.ts:122` int-range, `:140-146` phase must match, `:155-159` max 12,
`:175-179` body cap. The packet used to call itself "the exact shape" while omitting three rules.)

**Fix P-3 (misleading) — the Scorecard fallback no longer instructs an out-of-scope phase run.**
`packet.ts:1027`: BEFORE `"Not written — run Phase 0 first."` (at P4) → AFTER
`"Not written — the scorecard is a Phase 0 output."`

**Fix P-4 (correctness) — `handoff.ts:188` states the same seam rules** ("`phase` must be N (this
edge); the seam accepts at most 12 artifacts, each body ≤ 50000 chars") so the per-phase prompt and
the packet cannot contradict each other.

**Audited clean (no change):** job context (Intent-lattice Jobs + A5 spec-graph nodes with owner/
file/purpose), contract context (A6 entities/endpoints), oracle (A7), sandbox claim vs `sandboxClaim`,
`capabilities` (`ingest`/`verify`/`vault_search` all real surfaces), deterministic `compiled_at`, the
Phase-12 terminal edge, and the truncation guard. `handoff.ts` otherwise renders role/mission/prior
context/deliverable/DoD/constraints/JSON output with no stale claim.

## 4. Fix (a1) — a RED kind entry left `outcome.error` unset

Reproduced `probe-red-entry.mjs` (headless tree, `main: src/main.ts` throws on import, real `treeRun`):
BEFORE `{"ok":false,"error":null,"run":{"run":"fail",...}}`. Fix `compile-check.server.ts:1701-1711`
adds the entry leg to the top-level error (verb-mapped: fail→"failed to LOAD", error→"errored",
timeout→"timed out"); a deliberate `skip` stays out (its reason rides `run.detail`). Doc `:432-436`
updated. AFTER:

```
{"ok":false,"error":"the emitted product's kind entry failed to LOAD (src/main.ts): Error: RT_E_VALIDATION: boom on import …","run":{"run":"fail",...}}
```

## 5. Fix (a2) — `cli-tool` declared no `main`

Reproduced `probe-cli-main.mjs` (real `scaffoldProject` of a `kind:"tool"` run, written to a temp dir):
BEFORE `pkgMain:null`, `cleanEntry:"src/jobs/dispatch.ts"`, and corrupting the real entry
`src/main.ts` STILL read `corruptOk:true` (false green). Fix `scaffold.ts:703` declares
`pkg.main = "./src/main.ts"` (the entry `emitBinLauncher` delegates to; importing it runs nothing —
the direct-run guard), alongside `bin`. Comment at `:3570-3574` updated. AFTER:

```
pkgMain:"./src/main.ts"  cleanEntry:"src/main.ts" cleanOk:true  corruptEntry:"src/main.ts" corruptOk:false
```
Resolver path is the W48 T3 `./`-strip (`compile-check.server.ts:1280`), so no resolver change needed.

## 6. Residuals verified landed (no further change)

- `declaredScriptsVerified` / `unverifiedDeclaredScripts` / `unverifiedEntry` — `compile-check.server.ts:461`,
  `:466-467`, `:1708-1716`; `treeVerdictHash` folds them (`:720-733`). F-4 semantics intact.
- The mint evidence hash — `codegen.server.ts:4584-4625` folds `declaredScriptsVerified` + sorted
  `unverifiedDeclaredScripts` + `entrySkipped` (335-1's file, read-only here). CONFIRMED.
- The unsupported-toolchain README banner — `scaffold.ts` `declaredScriptsBanner`, emitted first;
  `scaffold.test.ts` banner pins green. CONFIRMED.

## 7. Tests added + real results

| Test | File | Node 22.23.2 | Node 24.15.0 |
|---|---|---|---|
| W49/335-3: packet carries the current edge DoD exit criteria | `packet.test.ts` | pass | pass |
| W49/335-3: report_schema states the phase-match rule + artifact caps | `packet.test.ts` | pass | pass |
| W49/335-3: Scorecard fallback never instructs an out-of-scope Phase 0 run | `packet.test.ts` | pass | pass |
| W49/335-3: handoff states the seam's phase-match + caps | `handoff.test.ts` | pass | pass |
| W49/335-3: a throwing kind entry sets outcome.error (was unset) | `compile-check.server.test.ts` | pass | pass |
| W49/335-3: a cli-tool-shaped tree resolves the declared main; corrupting it REDs | `compile-check.server.test.ts` | pass | pass |
| W49/335-3: cli-tool package.json declares `main: './src/main.ts'` | `scaffold.test.ts` | pass | pass |

| Suite | Node 22 | Node 24 |
|---|---|---|
| packet (baseline 66) | **69 / 69 / 0** | 69 / 69 / 0 |
| handoff (baseline 15) | **16 / 16 / 0** | 16 / 16 / 0 |
| scaffold (baseline 50) | **51 / 51 / 0** | 51 / 51 / 0 |
| compile-check (baseline 79 / 1 skip) | **81 / 80 / 0 / 1 skip** | 81 / 80 / 0 / 1 skip |
| dod (baseline 3) | 3 / 3 / 0 | 3 / 3 / 0 |
| combined owned (5 files) | **220 / 219 / 0 / 1** | 220 / 219 / 0 / 1 |
| dependents emitted-honesty + sweep73-fuzz + honesty-guards + maker-score + wild-step + patch-preservation + gates | **268 / 268 / 0** | 268 / 268 / 0 |
| io.test.ts (consumer of both) | **60 / 60 / 0** | — |
| `npx eslint` on the changed owned files | **exit 0** | — |
| `npx tsc --noEmit` | my files clean (the only diagnostic is 335-5's `ui-surface-guards.test.ts:29`) | — |

## 8. RED-first teeth (each fix disabled in place, run, then restored)

- (a1) entry-error block `if (false && outcome.run)` → the RED-entry test: `# tests 2 / pass 1 / fail 1`
  (`not ok` on the entry test); restored → green.
- (a2) `pkg.main` line removed → the scaffold test: `# tests 1 / pass 0 / fail 1`
  (actual `undefined` vs expected `'./src/main.ts'`); restored → green.
- packet P-1/P-2/P-3 section disabled + schema/scorecard reverted → `# tests 3 / pass 0 / fail 3`;
  restored → green.
- handoff P-4 clause `if (false)` → the caps test `# tests 1 / pass 0 / fail 1`; restored → green.

## 9. What I did NOT do and why

- Did not redefine `outcome.ok`, `declaredScriptsVerified`, the CLI exit code, or the DoD mint.
- Did not touch `codegen.server.ts` (335-1), `headless.ts` (335-2), the CLI (335-4) or any unowned file.
- Did not change the R4/B-05-pinned memory-empty phrase "(empty — treat Phase 0 research as first
  write)" — it renders only for a degenerate truly-empty payload and is a named pinned contract; the
  Scorecard fix covered the reachable out-of-scope instruction. Reported as a same-class residual.
- Did not run the full gate / `npm test` / `npm run eval`; targeted suites only; no keyed call; no
  secret printed; no probe file written inside the repo (`git status` shows only owned edits + this log).
