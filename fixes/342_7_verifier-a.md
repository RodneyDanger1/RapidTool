# 342-7 — verifier A (adversarial re-derivation of the W56 headline claims)

**Verifier A.** Root `C:\Users\mnril\Desktop\RapidTool Main` (git `main`, HEAD `686d7b6` + the uncommitted
342 wave). Windows + PowerShell. Runtimes: host `node` **v24.15.0** and pinned
`& "$env:LOCALAPPDATA\hermes\node\node.exe"` **v22.23.2**. Scratch: `$env:TEMP\rt342_va\` (probes only; the
working tree was NOT modified — no `src/**`, `scripts/**`, `fixes/**` edits, no `git checkout/stash/reset/apply`).
**No full gate, no eval driver, no keyed calls, no secret printed.** Targeted suites only, both runtimes.

Verdicts: **C1 PARTIAL** (core confirmed, TS2440 class not fully closed) · **C2 CONFIRMED** ·
**C3 CONFIRMED with a bounded fallback hole** · **C4 CONFIRMED** · **C5 CONFIRMED** · **C6 CONFIRMED**.

---

## Claim 1 — P6 rule 11 + TS2440 detector (342-1) — **PARTIAL**

### 1a. Prompt names the three classes + required shape — CONFIRMED
`p6SynthesisSystemPrompt()` (`src/lib/codegen.server.ts:565`) rule 11 (`:628`) is real prompt text naming
TS2322 / TS2749 / TS2440 with a required shape for each (verified by reading the bytes and by the probe):

```
cd "C:\Users\mnril\Desktop\RapidTool Main"
& "...\node.exe" --experimental-strip-types "$env:TEMP\rt342_va\detector.mjs"
=== prompt rule 11 presence ===
TS2322 true | TS2749 true | TS2440 true | TextDecoder true
rule11: true
```
`p6SynthesisSystemPrompt` is the system prompt at both synthesis sites (`codegen.server.ts:4363`, `:4703`).
The drift-proof pin (`codegen.server.test.ts:3866`) also asserts rule 11 carries no `(validator-enforced)`
claim — real `tsc` is the gate. Target suite: **215/215 pass, 0 fail** on both runtimes.

### 1b. `localBindingLines` catches type/interface/`declare function` — CONFIRMED
`localBindingLines` (`:2446`) now matches `type`/`interface` (incl. `export`/`declare`) and
`declare function`; `crossChunkDuplicateDeclarations` (`:2484`) refuses the collision before materialization.
Re-derived against the real functions:

```
type_alias     -> crossChunkDuplicateDeclarations=[{"name":"InvoiceRow","line":1,"priorPath":"src/generated/a.ts"}]
interface      -> [{"name":"InvoiceRow",...}]
declare_fn     -> [{"name":"validate",...}]
comment        -> (none)
stringlit      -> (none)   # a string-bound `s`, never a false `InvoiceRow`
block_comment  -> (none)
```

### 1c. Real-compiler reproduction (crafted two-chunk module, real `tsc`)
`a.ts` exports; `b.ts` = `import { X } from "./a"` + a local redeclaration; run
`node node_modules/typescript/bin/tsc --noEmit --strict --moduleResolution node --module commonjs --target es2020 b.ts`:

| local form in `b.ts` | real `tsc` | detector |
|---|---|---|
| `type InvoiceRow` | **TS2440** ✓ | caught ✓ |
| `interface InvoiceRow` | **TS2440** ✓ | caught ✓ |
| `declare function validate` | **TS2440** ✓ | caught ✓ |
| `namespace InvoiceRow {}` | no error | not flagged (correct) |
| `declare namespace InvoiceRow {}` | no error | not flagged (correct) |
| `declare const InvoiceRow` | no error | not flagged (correct) |
| **`enum InvoiceRow`** | **TS2440** | **missed** ✗ |
| **`export enum InvoiceRow`** | **TS2440 (+TS2395)** | **missed** ✗ |
| **`const enum InvoiceRow`** | **TS2440** | **missed** ✗ |
| **`declare class InvoiceRow`** | **TS2440** | **missed** ✗ |
| **`abstract class InvoiceRow`** | **TS2440** | **missed** ✗ |

The task's named defeaters do **not** defeat the fix: a namespace/`declare module` redeclaration is *not* a
TS2440 conflict (real `tsc` is silent) and is correctly not flagged, so no over-refusal; a same-module
`type`/`interface` merge is only refused cross-chunk when a prior chunk exports the name (which really is a
TS2440), and comments/strings are masked by `maskCodeLine` (never report). **But** the claim "the TS2440
class is closed" is **over-broad**: `enum` / `const enum` / `export enum` / `declare class` /
`abstract class` are real TS2440 emitters the widened detector still misses (`localBindingLines` regexes
cover only `function`/`class` (no `abstract`/`declare`)/`const` (`= ` or bare, no `declare`)/`let`/`var`,
`type`/`interface`, `declare function`; none cover `enum`/`abstract`/`declare class`). The measured keyed
failure was a `type`, which is closed; these are narrower residual holes, not the original defect.

Target suite (`src/lib/codegen.server.test.ts`): **215/215** on host24 and pinned22.

---

## Claim 2 — Eval drain `researchLive` (342-2) — **CONFIRMED**

Re-derived with the real modules (`headless.ts` `runPhase`/`runUntilGate`, `run-eval.mjs` `drainPipeline`),
keyless, real network free search:

```
& "...\node.exe" --experimental-strip-types "$env:TEMP\rt342_va\probe2.mjs"
=== byte identity (P7, frozen clock) ===
unset.research: 0 | research artifacts: 1
JSON(unset)===JSON(off)   : true
JSON(unset)===JSON(floor) : true
=== stored project (as saved) ===
research: 0 | p7 gate: {...,"evidenceHash":"425504246"}
=== rewound -> drainPipeline(researchLive:true) ===
research entries: 2 | provider: duckduckgo
p7 gate: {"passed":true,"unmet":[],"evidenceHash":"1119028455"}
first title: Free Excel construction templates for every project [2026]
first url  : https://monday.com/blog/construction/free-excel-construction-templates/
live research-7 artifacts: 5
drain ending: {"position":"terminal","onTime":true,"stall":null,"code":null}
=== rewound -> drainPipeline(default control) ===
research entries: 0 | p7 gate: {"passed":false,...,"evidenceHash":"425504246"}
live research-7 artifacts: 0
```

The default path is byte-identical (`JSON(unset) === JSON(off) === JSON(floor)`), and the same stored
P7-stalled project flips red→green with **real** DuckDuckGo findings + re-minted gate hash, while the
control stays unchanged (same absent corpus, same red hash). 0 keyed calls (no key needed; `researchOnly`
skips the P7/P11 LLM narrative). Suites: `headless.test.ts` 342-2 = **3/3** both runtimes;
`scripts/run-eval.test.mjs` = **55/55** both.

---

## Claim 3 — Corpus bar wiring (342-3 + 342-2 resume) — **CONFIRMED, with a bounded fallback hole**

### 3a. `parseGrader` reads + validates `firstRun` — CONFIRMED
All 11 real graders parse to `{meanAtLeast:1, excludeCriteria:["M7"]}`, warm bar untouched. Adversarial:

```
valid                          ok=true  {"meanAtLeast":1,"excludeCriteria":["M7"]}
absent (omitted)               ok=true  null
null                           ok=true  null
EMPTY excludeCriteria          ok=true  {"meanAtLeast":1,"excludeCriteria":[]}   # warm-equivalent, safe
unknown criterion M11          ok=false RT_E_VALIDATION
non-string criterion           ok=false RT_E_VALIDATION
meanAtLeast 0 / 1.5 / "1"      ok=false RT_E_VALIDATION
excludeCriteria string         ok=false RT_E_VALIDATION
firstRun string                ok=false RT_E_VALIDATION
duplicate ids                  ok=true  {"meanAtLeast":1,"excludeCriteria":["M7"]}  # de-duped
```

### 3b. `runKind` persists; `passesAcceptance` selects the bar — CONFIRMED (source + pins)
`runTrial` resolves `const prior = priorFor(slug)` / `const runKind = runKindOf(prior)` once
(`run-eval.mjs:2329`), passes the **same `prior`** to `scoreMaker` (`:2344`) and persists `runKind` on the
row (`:2410`). `rubricMeanForRow` (`:2522`) + `passesAcceptance` (`:2505`) + `acceptanceFailReason`
(`:2540`) select the per-kind bar. (Driver itself not run per the boundary rule — verified by source and
the unit pins.)

### 3c. Stored-result recompute (real modules, 0 keyed calls)
- Stored **warm** row `coffeehouse2home-property-ledger` (3/9): warm bar `{1,[]}` effMean 0.3333 → **FAIL**;
  the same card re-judged as **first**: `{1,["M7"]}` effMean **0.3750 (3/8)** → **FAIL**.
- Stored **keyless first** rows (6 slugs, `history.json` earliest, 4/9 bands): first effMean **0.5000 (4/8)**
  → **FAIL** (no false green).
- Constructed 8/9 card (M7 only zero): `runKind:"first"` → **PASS**; `runKind:"warm"` → **FAIL**;
  keyless-floor card → FAIL both kinds.
- `priorFor(coffeehouse)` today returns `{m1:0,m2:0,m3:0}` (log §10.4 narrates `{1,0,0}`); the verdict is
  unchanged (M7=0 either way), only the evidence branch differs — a minor log-vs-bytes drift.

### HOLE found (bounded): `runKind` absent falls back **leniently**
`rubricMeanForRow` defaults `row.runKind === "warm" ? "warm" : "first"`, so a legacy/synthetic row that has
a `criteria` map but **no** `runKind` is judged on the **first-run** bar (M7 excluded):

```
8/9 runKind ABSENT (criteria present): true    <-- a warm card passes without M7
8/9 no criteria map, mean=0.8889, runKind absent: false   (falls back to stored mean — safe)
```

A row *without* the map falls back safely (stored `mean`), but a row *with* the map and no `runKind`
(the shape of the stored `research/eval-out/results.json` entries) gets the lenient bar. The only production
call site (`run-eval.mjs:2644`) passes a freshly-built row that always carries `runKind`, so this only bites
re-judging legacy/synthetic rows — but the safe default for an unknown kind is the **stricter** (`warm`)
bar, not the lenient one. Reported, not fixed (verifier does not edit).

Suites: `run-eval.test.mjs` (incl. 342-2 parse/consume/passesAcceptance pins) **55/55** both runtimes.

---

## Claim 4 — Kind single source of truth (342-4) — **CONFIRMED**

Re-derived with the real engine + real scaffold emitter:

| brief | deliveryKindOf | stamped | projectKindOf | singleMod | index.html | package |
|---|---|---|---|---|---|---|
| "…kanban board **library**…" | library | library | library | true | false | `main`/`exports`/`files`, private:false |
| "A dashboard **UI**…" | app | app | webapp | false | true | private:true |
| "an arcade breakout **game**…" | game | game | game | false | true | main src/main.ts |
| "a **CLI** tool…" | tool | tool | cli-tool | false | false | — |
| "a webhook worker **service**…" | service | service | service | true | false | — |

`withDeliveryKind` returns the SAME reference for an already-decided project (never re-derived). Explicit
stored kinds override the brief (`stored=library → projectKindOf=library` even for a webapp-shaped brief).
`KIND_ORDER`/`KIND_KEYWORDS` are gone from `scaffold.ts`; `projectKindOf` (`:526`) is a pure `switch` over
`deliveryKindOf`. `Project.kind` is widened to 5-way `DeliveryKind` (`types.ts:31/454`) and
`hydrateProject` clamps junk (`engine.ts:2753`). The `"…kanban board library…"` brief resolves one kind at
every layer and emits a real library package (no `index.html`, `private:false`). `singleModuleLibraryKind`
routing unchanged for the multi-file kinds (`app`/`tool`/`game` → false; `library`/`service`/absent → true).
Suites: maker-score + engine + scaffold **186/186** both runtimes.

---

## Claim 5 — MCP surface + failover (342-5) — **CONFIRMED**

Re-derived with the **real stub child** (`src/lib/mcp/stub-server.ts`, spawned over stdio):

```
disabled + missing binary config   enabled=false configured=true  spawn=false tools=null refusal=RT_E_MCP_DISABLED
disabled + injected stub server    enabled=false configured=true  spawn=false tools=null refusal=RT_E_MCP_DISABLED
enabled but unconfigured           enabled=true  configured=false spawn=false tools=null refusal=RT_E_VALIDATION
enabled + configured (REAL child)  enabled=true  configured=true  spawn=true  tools=["echo","env","write_thing(rw)"] server=stub-mcp refusal=null
enabled + missing binary           enabled=true  configured=true  spawn=true  tools=null refusal=RT_E_RUNNER_FAILED
call echo: {"tool":"echo","isError":false,"content":[{"type":"text","text":"hi-va"}]}
call unlisted:  refusal=RT_E_VALIDATION / "did not list a tool named \"delete_everything\"" (never invented)
call write_thing: refusal=RT_E_VALIDATION / "was not advertised read-only"
doctorMcp off: refusal=RT_E_MCP_DISABLED, tools=null, spawn=false
```

The disabled case is proven with a **missing binary** — had the gate leaked and spawned, the code would be
`RT_E_RUNNER_FAILED`; it is `RT_E_MCP_DISABLED` ⇒ zero spawn. Enabled+configured returns the server's real
`tools/list`, never a fabricated one. Failover: `resolveFallbackChain(env)` parses/validates
(`xai`→ok, `nope`/`xai,xai`→coded refusal); the registry stays UNARMED and `callModel`
(`registry.ts:758`) refuses with the three byte-derived missing pieces. Suites:
`mcp.server.test.ts` **38/38** both; `registry.test.ts` + `registry-failover.test.ts` **51/51** both.

---

## Claim 6 — Removals + registry completeness (342-6) — **CONFIRMED**

- `RT_E_UNATTENDED_UNSUPPORTED`: absent from `ERROR_CODES`/`ERROR_CODE_DOC` (only a removal-note comment
  at `errors.ts:77`) and from `scripts/README-cli.md`; no `throw`/`codeError`/envelope emitter anywhere.
  The one remaining `src/` mention (`console.tsx:7275`) is an **accurate** removal note, not a live
  reference. (Historical mentions remain in `fixes/**`/`wave_plans/**`, as append-only history should.)
- Six dead-export names (`DEFAULT_EVAL_OUT_DIR`, `GitLandSeat`, `resolveGateAppDataBase`,
  `getConnectorAccessToken`, `overdueRowSeed`, `timeoutRowSeed`): **zero** references repo-wide outside
  `fixes/`/`wave_plans/`/`finalsprint.md` (`git grep` exit 1 = no hits).
- Registry completeness: `ERROR_CODES` ⟷ `ERROR_CODE_DOC` = **36 ⟷ 36**, 0 duplicates, 0 missing rows,
  0 orphan rows; `RT_E_UNATTENDED_UNSUPPORTED` absent. Suites: `errors.test.ts` **39/39** both;
  `README-cli.test.mjs` + `cli-exit-taxonomy.test.mjs` **54/54** host, `cli-exit-taxonomy` **42/42** pinned22.
- **Pre-existing drift (not this wave):** `scripts/README-cli.md` mirrors 35 of 36 registry codes —
  `RT_E_PATH_KIND_MISMATCH` has no row, and it was already missing at HEAD (`git show HEAD:…README-cli.md`
  has no match). The wave removed the `RT_E_UNATTENDED_UNSUPPORTED` row correctly; the PATH_KIND gap
  predates it.

---

## Mock / fake census (this wave's added lines, product code vs tests)

Scanned `git diff HEAD` added lines over the 26 touched source/script files
(`+1948` lines in that set; `.t4scratch` deletions excluded).

```
as any 0 · @ts-ignore 0 · @ts-expect-error 0 · @ts-nocheck 0 · eslint-disable 0
FIXME 0 · .only( 0 · .skip( 0 · empty catch {} 0
TODO 3   -> all three are `TODO(R13-f09)` REFERENCES in registry.ts (the genuinely-open row), not new
            TODO bodies or placeholders
fake 1   -> prose ("never a fake …"), not a fake implementation
```

**Product-code doubles: 0.** Restricting to non-test files, the only hits are the 3 `TODO(R13-f09)`
references in `registry.ts`; no `stub`/`globalThis.fetch`/suppression/empty-catch in any product file.
The test doubles are the documented ones: `globalThis.fetch` transport stubs in the headless/run-eval
suites, and the **real** spawned `src/lib/mcp/stub-server.ts` child for the MCP client (a live pipe, not a
mocked protocol). Every cross-runtime suite cited above ran green on **both** v24.15.0 and v22.23.2.

---

## Could not verify (and why)

1. **Keyed acceptance scorecard / keyed P6 convergence probe** — the boundary owner runs the keyed eval
   concurrently; this verifier made **0 keyed calls** and printed no secret. The keyed claims in 342-1 §4
   and the 341-2 §2 four 8/9 fixtures cannot be re-derived here (their scratch dirs are gone).
2. **Full gate / repo-wide `typecheck`** — forbidden by the boundary. Targeted suites only.
3. **`runKind` persistence across a real driver run** — the eval driver was not run; verified by source
   (`run-eval.mjs:2329/2344/2410`) and the `passesAcceptance` unit pins only.
4. **`service` end-to-end keyed stamp on the wire** (342-4 §7) — keyed budget 0; the stamp is a pure
   function, unit-tested, and the scaffold routing is re-derived above.

## Net

The wave's headline claims are **substantially true and re-derived on bytes**, with two honest
residuals: (i) the TS2440 detector closes the measured `type`/`interface`/`declare function` class but
still misses `enum`/`const enum`/`export enum`/`declare class`/`abstract class`, all real TS2440 emitters;
and (ii) `passesAcceptance` defaults an absent `runKind` **with a criteria map** to the lenient first-run
bar — the safe default is the stricter warm bar. Neither is a false-green in the only production call path
today, but both are defects the wave owner should record rather than claim closed.
