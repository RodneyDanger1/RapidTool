# W45 — PARENT keyed findings (first funded keyed run since the W25 register)

Recorded by the boundary owner (parent) 2026-10-02, on `main` at `03a6d0b` + the W45 lanes' in-flight
edits. **Every claim below is a command's real output.** This file exists because the W25–W30 register
records "the DeepSeek account is unfunded — all keyed calls 402" as an owner-only blocker (O-1). That
premise is **false today**, and the correction changes what the next wave can do.

## 1. The key works; the machine was sending the wrong one

| Probe | Result |
|---|---|
| `GET https://api.deepseek.com/models` with the key in repo `.env` (tail `…19b3`) | **200** |
| `POST /chat/completions` `deepseek-v4-flash` with that key | **200**, real completion, tokens billed |
| `POST /chat/completions` `deepseek-v4-pro` with that key | **200** |
| repo's own keyed path, `crew --max-steps 1` (before the W45-1 fix) | **401** `Your api key: ****42ff is invalid` |
| `DEEPSEEK_API_KEY` at Windows **User** scope | present, tail `…42ff` (invalid) |
| `DEEPSEEK_API_KEY` in repo `.env` | present, tail `…19b3` (valid, funded) |
| `grep -rn 'loadEnvFile\|dotenv' src scripts .grok` (before the fix) | **0 hits** |

So: funded account + live-verified model ids (`deepseek-v4-flash` is accepted and served as
`deepseek-flash`) + documented invocation = 401, because a stale ambient variable won and nothing
loaded `.env`. The `…42ff`/`…19b3` split is a **machine state** fact, not a repo fact — the repo's
`.env` is right. **Lane 331-1 landed the fix during this wave**: the CLI now prefers the repo `.env`
key, prints the coded `RT_E_LLM_KEY_SHADOWED` signal naming both tails (tail-only, never the full
secret), and exits through the code taxonomy instead of aborting libuv.

**Owner action (not a code change):** clearing the stale User-scope `DEEPSEEK_API_KEY` silences the
signal. It was deliberately left in place — other tools on this machine may read it.

## 2. Real keyed P0→P6 run — what the factory actually does now

Scratch project outside the repo: `%LOCALAPPDATA%\Temp\rt331_parent_keyed2`. Brief prose passed
inline (see the parsing trap below), `--kind webapp`.

| Step | Result |
|---|---|
| `gate --autopilot --live` to the P4 HITL gate | `researchCount: 5` (keyless: 0), `spent: 446`, exit 2 |
| `approve --seat autopilot` ×2 | `decidedBy: "autopilot"`, note `[seat harness] autopilot seat — no human decision claimed` |
| keyed P6 synthesis | `spent: 77654`, exit 1 (DoD block) |

**Lattice (real brief prose):** domain `construction` (fixture provenance expects `real-estate`),
jobs `["flip","invoice","track","rehab","bid"]` (5 — `algorithms.ts` caps at `slice(0,5)`), entities
`["flipper","manager","contractor","invoice","dashboard","item","house","property","arv","budget"]`,
complexity 9.75.

**Keyed P6 output — 7 real files, no stubs:**

```
src/generated.ts                       251 b   (barrel)
src/generated/create-property.ts    14,755 b
src/generated/list-line-items.ts     2,760 b
src/generated/validate-line-item-input.ts 9,659 b
src/jobs/bid.ts                      5,507 b
src/jobs/invoice.ts                 16,888 b
src/jobs/flip.ts                    27,090 b
```

`docs/P6 architecture trace (reqTrace)` → **`p6-arch: PASS`**. `p6-brief-fit` also passed. This is the
multi-job product the register said did not exist — created by the live keyed path, not by the
deterministic template.

**What still blocks P6:** the DoD gate's unmet list is exactly
`p6-test` (*Last template self-test run passed*) and `p6-verified` (*Machine verification promoted a
tested verdict*), with `lastTest: null` on the project. The keyed synthesis path records **no
self-test artifact at all** (the keyless template path does record `Sandbox result {ok:true}`), so
`lastTest` stays null and those two criteria can never be satisfied by a keyed run. That is a real
defect in the P6 journey, not a code-quality problem.

**Why the tree is red regardless (the generator defect):** `src/jobs/flip.ts` line 2 imports
`estimateARV` from `../generated/list-line-items.ts` **and** line 546 declares
`async function estimateARV(propertyId)`. The tree's own `npm run test` fails with
`SyntaxError: Identifier 'estimateARV' has already been declared`. `create-property.ts` and
`list-line-items.ts` also both export `validatePropertyInput`. So a later synthesis chunk re-implements
a name it was told to import from an earlier chunk — the cross-chunk duplicate-declaration class the
W5-L1 chunk-order note warned about.

`emit` behaved correctly: it **refused** (`RT_E_TREE_RUN_FAILED`, exit 1) with the red trail and the
compiler's own tail, and only wrote the tree under `--red-tree banner` with the unmissable banner.
The remedy text points at `substance` (`stubs:N reexports:N real:N`) — read it, never exit 0 alone.

## 3. Two defects found in passing

1. **`create --brief` takes raw TEXT, not a file path — and says nothing.** Passing
   `--brief research/eval-corpus/house-flip-manager.md` creates a project whose brief *is* the literal
   path; `inferName` then names it after the path and the lattice extracts "flip" from "house-flip-manager".
   The corpus fixtures are front-matter documents (`name`, `expectedNouns`, `expectedCapabilities`)
   that the CLI path never parses (only `brief-fixtures.ts` / `run-eval` do). A silent
   misinterpretation of a plausible invocation is worth a coded refusal or an `@file` form.
   Owner: lane 331-1 (`scripts/rapidtool-cli.mjs` / `scripts/README-cli.md`).
2. **`summary.budget.spent` resets per invocation.** Observed `446` → `0` → `77654` across successive
   `gate` calls. Live confirmation of register `R12-f02` (`RAPIDTOOL_TOKEN_CAP` cannot stop a runaway
   because the ledger is per-call). Owner: whichever lane takes `R12-f02`.

## 3b. The factory's own repair loop — 3 cycles, all refused (this is what stands between the run and a green tree)

`repair --dir <tree> --project <proj> --budget 3` → `ok:false`, `RT_E_REPAIR_FAILED`, exit 1,
`cycles: 3`, budget exhausted. The two criteria inside it:

```
treeRun.substance: { stubs: 0, reexports: 0, real: 3, verdict: "real",
                     greenWhileStubbed: false, oracleStubTrap: false }
```
**The M-A substance bar is met.** Every cycle failed at the same place:
`src/jobs/flip.ts:546 async function estimateARV(propertyId) { … SyntaxError: Identifier 'estimateARV' has already been declared`.
But `applied.written` is `create-property.ts · list-line-items.ts · validate-line-item-input.ts · bid.ts`
— **`flip.ts`, the file named in the failure, is never written or even refused.** Three identical
cycles, zero progress on the error. One real defect class, four concrete instances:

1. **The repair directive never targets the syntax-error file.** `flip.ts` appears in neither
   `applied.written` nor `patchRefusals`, so the loop cannot converge. Owner: `headless.ts`
   (`repairTreeDir` / the delta-targeting path) — lane 331-3.
2. **`proseLineHits` has two live false positives that refuse valid code** (`codegen.server.ts:355`;
   its own docblock says the shapes below are *excluded up front*). Reproduced directly:

   | input | expected | actual |
   |---|---|---|
   | `return a.index - b.index;` | ok (spaced arithmetic minus) | **PROSE** |
   | `balance: amountDue - amountPaid` | ok (documented exclusion) | ok |
   | `return negative ? -cents : cents;` | ok (documented ternary exclusion) | ok |
   | `arvNote: arvAvailable ? undefined : 'ARV unavailable: no comparables',` | ok (ternary, string arm) | **PROSE** |
   | `I will write the code now and make sure it works.` | PROSE (control) | PROSE |

   So `PROSE_ARITH_MINUS` misses the `return`-prefixed / member-operand form, and `PROSE_TERNARY`
   misses the object-property form with a quoted arm. `repair`'s `patchRefusals` show both refusing
   the repair's own output (`invoice.ts` and `list-line-items.ts` "patched module still fails
   validation — prose-in-code"). This is the *third* and *fourth* recorded instance of this class
   (W23-262/B1 and 322 X3/BUG-4 are named in the same docblock). Owner: lane 331-4.
3. **`src/generated.ts` is written by the emitter but refused by the repair importer.**
   `import.refused` / `applied.refused`: `path "src/generated.ts" is outside the scaffold's src/
   subdirs and tests/ — row kept in the ledger, never read from the dir`. The tree's own barrel (and
   `TREE_ENTRY_PATH`) therefore cannot round-trip through `repair`. Owner: lane 331-3.
4. `budget.spent` per-call reset — see §3.2.

## 4. The complete causal chain from "real code" to "blocked P6" (why the run cannot finish)

`codegen.server.ts:3807` and `:3886` set `lastTest: null` on both tree paths, with the comment that
"the ONLY re-mint path is `mintTreeRunTested()` after a genuinely green tree-run"
(`codegen.server.ts:3991`). `engine.ts`'s self-test (`:900`) and its real-run helper
(`runP6Real`, `:3721`, which executes `project.generatedSource` and is called from `store.ts:1557`)
are **single-module** shapes. So in tree mode the only way to satisfy `p6-test` / `p6-verified` is a
green tree-run. That makes the chain:

1. keyed synthesis emits 7 real files — **good**, `p6-arch`/`p6-brief-fit` PASS;
2. the emitted code carries a cross-chunk duplicate declaration (`flip.ts` imports `estimateARV`
   at line 2 and declares it at line 546) → **tree-run RED** (`SyntaxError`);
3. the bounded repair loop that exists to fix exactly this cannot converge — it never targets
   `flip.ts`, and its own patched output is refused by the prose-in-code validator (§3b);
4. no green tree-run → no `mintTreeRunTested()` → `lastTest: null` → `p6-test`/`p6-verified` unmet
   → P6 blocked (exit 1), `emit` refuses, no product ships.

Steps 2 and 3 are the actionable defects. Step 4's design is correct and honest.

## 5. What this means for the maker test (M-A)

M-A was defined as `{reexports: 0, stubs: 0, real ≥ 3}` + ≥3 job modules passing their own oracle rows
+ a keyed end-to-end run. The keyed run above produces 7 real modules and passes `p6-arch`/`p6-brief-fit`.
The distance to M-A is now **two concrete defects**, both in the P6 journey rather than in the
architecture: (a) the keyed path never runs/persists the template self-test, and (b) the chunked
synthesis can emit a duplicate declaration that a later chunk was supposed to import.
