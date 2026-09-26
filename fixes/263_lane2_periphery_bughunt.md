# 263 · LANE B2 — periphery bug hunt (`src/lib/llm/**`, `scripts/**`, telemetry, CLI)

Wave: W24 SPRING-CLEAN (`wave_plans/W24/spring-clean.md` §B2). HEAD at start: `b721f9c`.
Foreground targeted commands only (no full gate — repo rule). No keyed calls. Append-only log.

## B2-1 — the W23-L1 model-evidence tap was NEVER INSTALLED (fabricated zeros)

**Where:** `scripts/run-eval.mjs:737` (`export async function installLlmCallTap`) and
`:752` (`export function llmCallTapIsInstalled`).

**Finding (stale wiring / dead handler — the severe one):** `installLlmCallTap` has ZERO
call sites in the whole repo. Verified:

```
$ grep -n "installLlmCallTap(\|llmCallTapIsInstalled(" scripts/*.mjs src/lib/llm/providers/*.ts
scripts/run-eval.mjs:737:export async function installLlmCallTap() {
scripts/run-eval.mjs:752:export function llmCallTapIsInstalled() {
```

…and `setLlmCallTap` is only referenced *inside* `installLlmCallTap` (`:741-742`). The
trial window, however, IS opened/closed every keyed trial: `:1715 beginTrialCallTap()`,
`:1881 endTrialCallTap()`. With no tap installed, `endTrialCallTap()` always returns `[]`.

**Consequence (real, on disk, silent):** `llmEvidenceFromCallRecords([])` (`:684`) returns
`{records.length === 0}` → `:708-710` sets `estimatedCostUsd = 0` and
`costBasis = "no model call recorded in this trial's window (nothing billed)"`. That object
is then folded into every keyed row (`:1997-2002`): `usage: {0,0,0}`,
`estimatedCostUsd: 0`, `costBasis: "…nothing billed"`. So a keyed trial that DID make
synthesis calls records a $0.00 bill estimate and asserts "nothing billed" — while the
module's own contract three lines away (`:626-628`, `:1994-1996`, `:2044-2046`) says:
*"keyless trials (and a keyed run whose tap could not install) record `usage: null` /
`estimatedCostUsd: null` — never fabricated zeros"* and *"measured call counts (null when
the tap was unavailable)"*. Behaviour ≠ declared contract (AGENTS.md honesty rule 1 /
P0-04 declare-or-strike). The W23-L1 "per-trial model evidence" feature was dead wiring:
no run could ever record a served model id or measured usage.

**Fix (smallest honest patch, 4 spots):**
1. `main()` keyed leg: install the tap once, print the honest state
   (`preflight: provider call tap installed|UNAVAILABLE …`).
2. `runTrial`: gate the fold on the install flag —
   `llmEvidenceFromCallRecords(llmCallTapIsInstalled() ? callRecords : null)` so an
   unavailable tap yields `usage: null` / `estimatedCostUsd: null` (nulls, never zeros).
3. `costBasis` when `llmEvidence` is null: the old string said "keyless trial — …" for a
   KEYED row too; now keyed-unmeasured gets its own honest clause.
4. The install itself needed the FACADE fix — see B2-3 (without it, spot 1's install
   silently returned `false`).

**Evidence:** see the new end-to-end block in `scripts/run-eval.test.mjs` (installs the
tap, drives one stubbed-fetch provider call through `completeDeepSeek`, folds the records:
served model id + measured usage + non-null cost) + targeted run below.

## B2-2 — `formatFundednessLines` is dead code; the call site re-implements it (drift)

**Where:** `scripts/run-eval.mjs:1434` (definition, `export function formatFundednessLines`)
vs the fundedness wire at `:2570-2571`.

`formatFundednessLines` had zero call sites (grep repo-wide: definition only). The ONE
place that renders a fundedness probe result hand-inlined a second, already-drifted copy of
its first line and dropped the helper's verdict lines (NO-BALANCE / proven / unproven).
Class: duplicated logic that has drifted + dead export. **Fixed:** the call site now prints
`formatFundednessLines(fundedness)` and the helper gained the call site's extra fields
(`class`, `httpStatus` when known, `served=`) so ONE renderer is a superset.

## B2-3 — the provider call tap could never install: the FACADE had no tap exports

**Where:** `src/lib/deepseek.server.ts` (the "thin re-export" facade) vs
`scripts/run-eval.mjs:740-741`.

`installLlmCallTap()` imports `src/lib/deepseek.server.ts` (the P6 specifier the keyed leg
uses) and gates on `typeof ds.setLlmCallTap === "function"`. The facade re-exported only the
historical names — `setLlmCallTap` / `clearLlmCallTap` / `LlmCallTapRecord` (added by
W23-L1 in `llm/providers/deepseek.ts`) were NOT re-exported, so the install returned
`false` on this host: the tap was unreachable through the very seam the driver checks.
Found by the new test (`ds.setLlmCallTap is not a function` → then
`assert.equal(await installLlmCallTap(), true)` → false). **Fixed:** the facade now
re-exports `setLlmCallTap`, `clearLlmCallTap`, `LlmCallTapRecord` (additive; provider body
untouched). Evidence: `node --experimental-strip-types --test src/lib/deepseek.server.test.ts`
→ `# pass 21 # fail 0`.

## B2-4 — `classifyLlmPreflight`: `empty-completion` was UNREACHABLE behind the generic catch-all

**Where:** `scripts/run-eval.mjs:1095` (the pre-fix `if (status !== null)` branch).

The status ladder ran 401/402/400/422/429/≥500 and then a generic `status !== null` →
`provider-refused`. Every recorded status is non-null, so a **200 whose content came back
empty** (the expected shape of the fundedness probe's 1-output-token call: `max_tokens: 1`,
truncation/thinking) hit `provider-refused` before the coded `empty-completion` branch
below could see it. `probeFundedness`'s own contract (`:1327-1331`) says an answered 200 —
including `empty-completion` — means the account PAID (`funded:true`); pre-fix that input
yielded `funded:null`, i.e. the wire could not report a funded account it had just billed.
**Fixed:** the refusal catch-all is now `status !== null && status >= 400` (a sub-400
non-completion is not a vendor refusal; the coded branches own it). Pinned by the new test:
`classifyLlmPreflight({… httpStatus: 200, code: "RT_E_LLM_REJECTED", error: "…no text content…"})
→ class "empty-completion"` and `probeFundedness` (200 + truncated body) → `funded:true`.

## B2-5 — the fundedness stop recorded NO skip (the line claiming it did was false)

**Where:** `scripts/run-eval.mjs:2582-2586` (`/FUNDEDNESS STOP/` block).

The stop printed *"No trial runs; results will record the skip"* and cleared `selected`, but
`persist()` only writes the skip rows it is HANDED (`skips` = unreadable corpus entries +
no-grader cases). `funded:false` pushed nothing → a run stopped by an unfunded account
wrote `entries: []` with **zero** reasons. **Fixed:** the stop now pushes
`{ slug: null, kind: "account-unfunded", reason: "fundedness probe stopped the run: …" }`
into `skips` (the shape the summary/skip printer already reads).

## B2-6 — the W23-L1 rename left `run-eval.test.mjs` RED at HEAD (scripts leg, 1/35)

**Where:** `scripts/run-eval.test.mjs:622-637` (test "OV-35: preflight maps
not-configured/401/402/400 to distinct coded output").

The 402 case still pinned the PRE-W23-L1 names — class `"balance-exhausted"`, code
`"RT_E_BUDGET_EXHAUSTED"` — while the source (at HEAD, `run-eval.mjs:1054-1062`, W23-L1)
emits class `"no-balance"` / code `"RT_E_LLM_NO_BALANCE"` ("the vendor's balance class has
its OWN code — never conflated with the session budget"). Static proof it was red at HEAD:
`git show HEAD:scripts/run-eval.mjs | grep -c balance-exhausted` → 0 matches, while
`git show HEAD:scripts/run-eval.test.mjs` still contains the literal. **Fixed:** the pin now
matches the contract the fundedness verdict actually reads (`class === "no-balance"`).
Also the 402-adjacent duplicate note: the OLD code `RT_E_BUDGET_EXHAUSTED` was the session
budget — the W23-L1 doc says a wallet stop is NOT a budget stop, so the TEST was the stale
side. Evidence: full file `node --experimental-strip-types --test scripts/run-eval.test.mjs`
→ `# tests 35 # pass 35 # fail 0` (pre-fix: `# pass 34 # fail 1`).

## B2-7 — W23-L1 wires: verified coherent (after B2-1…B2-6)

- `probeFundedness` (`:1338`) → `classifyLlmPreflight` (`:1016`) → `formatFundednessLines`;
  options shape (`maxTokens`/`timeoutMs`/`fetch`) matches `DeepSeekCompleteOptions`
  (`deepseek.ts:155-190`, used at `:404`); `fetchImpl` is honored (pinned by the new test:
  the stub counts the requests, zero network).
- Keyless legs never probe (`KEYED_OK` gate at `:2550`, `:2568`) — no network, byte-identical.
- Provider 402 (`deepseek.ts:302`, `:436-443`) and the coded `RT_E_LLM_NO_BALANCE` both land
  on ONE `no-balance` class; `funded:false` clears `selected` (no scored trial).
- `funded:null` proceeds by design (`:2564-2566`) — not a defect.
- The tap: `deepseek.ts:586-594` wraps the invocation in try/catch, the record carries only
  booleans/enums/statuses (no prompt, no key), and `setLlmCallTap` coerces non-functions to
  null. Pinned by a new test that installs a THROWING tap and asserts the call still returns
  its own (keyless) result.
- `installLlmCallTap` → `beginTrialCallTap`/`endTrialCallTap` → `llmEvidenceFromCallRecords`
  → row `servedModels`/`usage`/`estimatedCostUsd`/`costBasis`/`llmCalls`: pinned end-to-end
  by a new test (stubbed fetch; served id `deepseek-flash` read back, 14 measured tokens,
  cost > 0). Plus a source-level WIRING GUARD pinning the four call sites (install, the
  installed-gate on the fold, the fundedness renderer, the `account-unfunded` skip row) —
  the only reachable check for seams that a live keyed run would exercise.

## Deliberately NOT touched (with reasons)

- `zero-byte-guard.test.ts` (extra target): read fully — scope (code-bearing exts incl.
  `.sh`), allowlist staleness check and the vacuity floor (`>= 300` tracked files) are all
  coherent; the two allowlist entries are out-of-scope-by-extension by design, documented.
  Not a bug. No change.
- `funded:null` proceeds to scored trials by design (`:2564-2566` "reported and proceeds —
  never guessed into a pass or a fail") — intended, not a defect.
- `run-eval.mjs:2713` / `:2689` exit 0 ("results are data, not failures") — the documented
  contract for this harness; the CLI `eval` verb (read-only reader) is where the exit
  taxonomy lives. Not changed.
