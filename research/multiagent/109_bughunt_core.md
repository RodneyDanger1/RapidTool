# 109 — Bug Hunt #1: Core Engine (algorithm errors, mock/fake code, bad-code smells)

**Lane:** Bug hunt #1 — core engine
**Date:** 2026-09-16
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main`
**Mode:** READ-ONLY hunt (only write is this file). Probes ran via `node --experimental-strip-types --input-type=module -e` — no files created.
**Baseline:** `npm test` 1634/1634 green, `typecheck` 0, `lint` 0 (not re-run by this lane, per instructions).
**Method note:** every finding below was reproduced with a real execution probe or read at the exact cited line. Nothing here is a hypothesis. Where the impact is bounded or reachability is narrow, that is stated in the finding rather than hidden.

---

## 1. Verdict on core-code health

The core is **honest-by-construction in its data paths and sloppy in its guard paths**. The pure algorithm modules (`algorithms.ts`, `knowledge.ts`, `harvest.ts`) are defensive to a fault — malformed rows are skipped, non-finite scores are floored, caps are named constants, and the comments explain *why* each guard exists; I found no fabricated data, no `TODO`-presented-as-done, no `Math.random`/`Date.now` leaking into an artifact that claims determinism, and no `ok:true`-with-empty-data lie in the five files in scope. The real defects cluster in two places: (a) **the verify lane's two safety gates are text-level pattern matches, and text-level guards fail in both directions** — they can be satisfied by a case that never touches the module (so a *machine-verified* pass can be minted for a module that exports nothing — finding C-01, the only P1 here), while claiming a break-out impossibility they do not actually enforce (C-05); and (b) **several guards only fire on one of two symmetric branches** — the `=`-assignment guard misses `>>=`/`<<=`/`>>>=` and its arrow branch is dead code (C-04), the CJS export regex matches `my_module.exports.x` (C-02), the complexity heuristic treats any `0.5` inside a loop body as a binary-search step (C-03), the harvest candidate cap is checked one push late (C-08). One stemmer-asymmetry bug (C-06) makes brief-faithful plural nouns invisible to a node's weight. Nothing found corrupts persisted data, bricks a run, or turns a red gate green *wirelessly*: the P1 requires the generated case list to be permissive, and the fix is a two-line gate. Health: **good bones, real soft spots in the guard layer — all cheap to close.**

---

## 2. Findings table

| ID | Severity | Category | Title | file:line | Status |
|---|---|---|---|---|---|
| **C-01** | **P1** | mock/fake | A machine-verified PASS can be minted by a case that never touches the module (grounding + `runCases` both satisfied by a self-contained literal) | `verify.server.ts:449-458` + `:495-518`; `sandbox.ts:251-260` | **CONFIRMED** (end-to-end probe) |
| C-02 | P2 | mock/fake | `exportedNamesOf` invents an export from `my_module.exports.x = …` — contradicts its own doc claim that member chains are excluded | `algo-tools.ts:185` | **CONFIRMED** (probe) |
| C-03 | P2 | algorithm | `complexityOf` reports **O(log n)** for a plain linear loop whose body merely contains `0.5` (or `x / 2`) — the halving probe is run over the loop *body*, not the step | `algo-tools.ts:437, 560, 596-606` | **CONFIRMED** (probe) |
| C-04 | P2 | algorithm (guard) | `sanitizeOracleExpression` accepts `>>=`, `<<=`, `>>>=` as "not assignments", and its arrow-rejection branch is unreachable | `verify.server.ts:140-152` | **CONFIRMED** (probe) |
| C-05 | P2 | determinism / security | The stated "a hostile reply can never break out of the return-expression context" guarantee is false — `[].constructor.constructor(...)()` passes the sanitizer and reaches globals | `verify.server.ts:196-202` + `:352-363` | **CONFIRMED** (probe), impact bounded — see detail |
| C-06 | P2 | algorithm | `intentLattice` frequency count mixes `stemToken` (one pass) with a canonical (fixed-point) stem, so plural register nouns score weight 0.35 instead of 0.55 even when the brief literally contains them | `algorithms.ts:373` (+ `:1139-1155`) | **CONFIRMED** (probe) |
| C-07 | P2 | error-handling | `module.exports = { … }` compiles clean but exports nothing → every case fails with a bare `ReferenceError`; the harness's `module` parameter is a decoy never read back | `verify.server.ts:356, 449-458` | **CONFIRMED** (probe) |
| C-08 | P3 | smell | The harvest candidate cap (magic `6`) leaks one candidate per extra query, and a zero fetch budget reports "all candidate fetches failed" when none was attempted | `harvest.ts:430, 441-444, 495-497` | **CONFIRMED** (probe) |
| C-09 | P3 | smell | `KnowledgeStore.entries()` hands out the internal cache array by reference (state mutable through a getter-shaped accessor) | `knowledge.ts:301-304` | CONFIRMED (read); impact latent — no current caller mutates |
| C-10 | P3 | smell | Three different stemmers plus one unstemmed matcher all operate under the "FusionRank"-adjacent names, with different match semantics | `algorithms.ts:1111/1139`, `engine.ts:2508`, `knowledge.ts:217-221` | CONFIRMED (read) |

Severity counts: **P1 = 1, P2 = 6, P3 = 3**.
Category counts: mock/fake = 2, algorithm = 3, algorithm-guard = 1, determinism/security = 1, error-handling = 1, smell = 3.

---

## 3. Per-finding detail

### C-01 — P1 — A "machine-verified" pass for a module that exports nothing

**Where:** `src/lib/verify.server.ts:449-458` (the pass conjunction), `:495-518` (`oracleBriefGrounded`), `src/lib/sandbox.ts:251-260` (`identifierHits`).

**The two gates, as written:**

```ts
// verify.server.ts:449-458
  return {
    pass:
      !compileFail &&
      !forged &&
      allSeen &&
      results.length === validated.length &&
      results.every((r) => r.pass),
```

The harness evaluates `return ( <case expression> );` inside `with(exports){ with(__sandbox){ … } }` (`verify.server.ts:363`) — so a case is *allowed* to be a self-contained literal; nothing requires it to touch an export.

`oracleBriefGrounded` (`:495-518`) is the only anti-vacuity guard, and it is satisfied by **any identifier-shaped substring** appearing anywhere in the joined expressions:

```ts
  const hits = identifierHits(targets, joined);          // verify.server.ts:511
  return hits.length > 0 ? { ok: true } : { ok: false, reason: `oracle cases reference no brief noun…` };
```
```ts
// sandbox.ts:256-258
  for (const t of required) {
    if (lowers.some((i) => i === t || i.includes(t))) out.push(t);
  }
```

**Reproduction (real probe, `const helper = 1;` exports nothing):**

```
({board: 1}).board === 1           grounded=true | module-exports-nothing pass=true ["true"]
"board".toUpperCase() === "BOARD"  grounded=false | module-exports-nothing pass=true ["true"]
("columns").length === 7           grounded=false | module-exports-nothing pass=true ["true"]
```

The first line clears **both** gates: `oracleBriefGrounded` returns `{ok:true}` (the brief noun `board` appears as an object-literal key), and `runCases("const helper = 1;", …)` returns `pass:true`. Downstream, `verifyAndFixServer` (`:770-781`) then stamps `status: "passed"`, `finalSource`, and mints the L4 `verified-procedure` lesson. The module under test was never called.

**Why it matters more than a normal false-positive:** this is the product's evidence spine — the P6 "verified" probe and the eval's M-probes consume exactly this path, and 100_factory_blockers P0-05 is literally "it cannot pass its own gates". A pass that requires zero contact with the module is the one shape that must be impossible, and the doc comment at `:485-494` claims it is ("self-referential certification that says nothing about the brief… never a vacuous machine pass").

**Honest boundary:** reaching it requires the generated case list to contain such a case. A well-behaved model following the prompt will not. The guard's *contract* is what fails — it does not require the case to reference an export, only a noun, and it accepts the noun as data.

**Concrete fix (two independent halves, either of which closes it):**
1. In `buildHarness`, after compiling, emit the export inventory and have `runCases` require it to be non-empty and to intersect the identifiers each case references — e.g. emit `HARNESS_EXPORTS <comma-list>` and fail with `compileError: "module exports no callables — machine verification is vacuous"` when the list is empty. `algo-tools.ts:177` (`exportedNamesOf`) already exists for the source side, but the *runner's* own inventory is the honest one (it cannot lie about what actually compiled).
2. Tighten `oracleBriefGrounded` to reject an expression whose only "grounding" is a string/object-key occurrence: strip literals (`stripStringsAndComments` is already imported at `:27`) before `identifierHits`, and require the hit to be on a *called* identifier when the source exports functions.

---

### C-02 — P2 — `exportedNamesOf` invents an export from `my_module.exports.x`

**Where:** `src/lib/algo-tools.ts:177-196`, the CJS regex at `:185`:

```ts
  const cjs = /(^|[^A-Za-z0-9_$.]|module\.)exports\.([A-Za-z_$][\w$]*)\s*=/g;
```

The comment above it (`:181-184`) states the design intent: *"Member-chain lookalikes (`obj.exports.x = …`) are excluded — they are properties, not module exports."* The `module\.` alternative is meant to allow the real `module.exports.x =` spelling, but it matches **the tail of any identifier ending in `module`**.

**Probe:**
```
my_module.exports.x = 1  -> ["x"]     ← phantom export
obj.exports.y = 2        -> []        ← correctly excluded
module.exports.z = 3     -> ["z"]
exports.real = 4         -> ["real"]
```

**Impact:** `propertyTestsFor` (`:221-257`) feeds this list into the prompt as *"The module exports these names ONLY — never invent others: …"* (`:213`). A phantom name is therefore advertised as real, and the model is pushed to write cases referencing an export that does not exist — which the harness then fails at runtime, sending the verify loop into iterations against a source that was never wrong. Small blast radius, but it is a false statement about the code under test emitted by a function whose whole purpose is to enumerate truthfully.

**Fix:** split the alternation so the `module.exports.` form requires a non-identifier boundary:
```ts
const cjs = /(^|[^A-Za-z0-9_$])(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=/g;
```
plus keep the existing `[^…$]` guard for the bare form (this one-regex form matches `module.exports.x` because `(^|[^A-Za-z0-9_$])` can match the `.` after `module` only if `.` is excluded from the class — it is not, so the two-regex version below is the safe one):
```ts
const cjsBare = /(^|[^A-Za-z0-9_$.])exports\.([A-Za-z_$][\w$]*)\s*=/g;
const cjsModule = /(^|[^A-Za-z0-9_$])module\.exports\.([A-Za-z_$][\w$]*)\s*=/g;
```

---

### C-03 — P2 — `complexityOf` publishes O(log n) for a linear loop that merely contains `0.5`

**Where:** `src/lib/algo-tools.ts:437` and `:560`, feeding the notation branch at `:596`:

```ts
/** Halving-step heuristics: `>>1`, `>>=1`, `>>>1`, `/ 2`, `/= 2`, `* 0.5`. */
const HALVING_RE = />>+={0,1}\s*1\b|\/=?\s*2\b|0\.5/;          // :437
…
    const bodyHead = braced ? loopBodyHead(masked, bodyAt) : "";
    const halving = HALVING_RE.test(header + bodyHead);        // :560
```

`loopBodyHead` (`:475-490`) returns up to 240 chars of the loop body **up to the first nested block** — it is body text, not a step. So any `0.5` or `/ 2` anywhere in that window is classified as a halving step, and a `lin === 0` chain is then reported as **O(log n)** (`:596-598`).

**Probe:**
```
single loop, nothing tricky                O(n)        loops=1 nest=1 halving=0
single loop whose body computes *0.5       O(log n)    loops=1 nest=1 halving=1   ← wrong
single loop whose body has 0.5 literal     O(log n)    loops=1 nest=1 halving=1   ← wrong
nested loops                               O(n^2)      loops=2 nest=2 halving=0
while halving                               O(log n)    loops=1 nest=1 halving=1
for with /2 step                            O(log n)    loops=1 nest=1 halving=1
```

**Impact:** the notation is written into a shipped artifact — `benchmarkHarness` embeds it as `// Static complexity (heuristic — not a proof): ${rep.notation}` (`:635`) — and the caveat (`:282-283`) disclaims recursion/callbacks/braceless nesting, not this. `x * 0.5` inside a loop body is an everyday line in the kinds of modules this lane generates (percentages, half-widths, averages), so the over-optimistic claim is the *likely* case, not the corner. This is a wrong-answer bug in a function named `complexityOf`, i.e. it is read as a fact.

**Fix:** keep `HALVING_RE` for the header, and for the body require a self-assignment shape that names the loop variable / a `>>=`:
```ts
const halving = HALVING_RE.test(header) || /\b[A-Za-z_$][\w$]*\s*(?:>>=|>>>=|\/=|\*=)\s*0?\.?5?\b/.test(bodyHead) /* + the `/2`, `>>1` forms */;
```
Simplest defensible version: test `HALVING_RE` against `header` only, and add `extras` when a `>>`/`/ 2` step is seen in the body but not the header ("body-level halving detected — not counted"). Either way, add the two probe rows above as test cases.

---

### C-04 — P2 — The `=` guard fires on `=` but not on `>>=` / `<<=` / `>>>=`, and its arrow branch is dead

**Where:** `src/lib/verify.server.ts:137-152`:

```ts
    // Assignment/arrow detection: `=` is allowed only as part of a comparison
    // (`==`, `===`, `!=`, `!==`, `<=`, `>=`); `=>` arrows and bare `=`
    // assignments are statement-level and rejected.
    if (ch === "=") {
      const prev = i > 0 ? src[i - 1] : "";
      if (prev === "=" && next === ">") return { ok: false, reason: "arrow functions are not allowed" };   // :142
      if (
        next !== "=" && prev !== "=" && prev !== "!" && prev !== "<" && prev !== ">"
      ) {
        return { ok: false, reason: "assignment is not allowed" };
      }
    }
```

Two defects in six lines:
1. `prev !== "<"` / `prev !== ">"` exist to allow `<=` / `>=` — and that exemption is exactly what the **shift-assignment operators** need: `>>=`, `<<=`, `>>>=` all have `prev ∈ {"<", ">"}`.
2. The arrow check at `:142` can never be true: for `a => b` the character before the `=` is a space, so `prev === "="` requires the sequence `==>`. Arrows are in fact rejected — but by the *next* branch (`:143-151`), which reports the wrong reason, so the branch that documents arrow handling is unreachable code.

**Probe:**
```
x = 1        {"ok":false,"reason":"assignment is not allowed"}
x >>= 1      {"ok":true,"expression":"x >>= 1"}      ← accepted
x <<= 1      {"ok":true,"expression":"x <<= 1"}      ← accepted
x >>>= 1     {"ok":true,"expression":"x >>>= 1"}     ← accepted
x ||= 1      {"ok":false,"reason":"assignment is not allowed"}
x += 1       {"ok":false,"reason":"assignment is not allowed"}
(a) => a     {"ok":false,"reason":"assignment is not allowed"}
```

**Impact:** (a) an accepted case can mutate an exported binding (`counter >>= 1` inside `with(exports)`) — module state is shared across the whole case loop, so a later case's verdict can depend on an earlier case's side effect, i.e. the machine pass becomes **order-dependent**; (b) the generated-case prompt tells the model "FORBIDDEN in every case: … assignments" while the sanitizer disagrees; (c) the dead branch is a maintenance trap for the next reader who trusts the comment. No statement smuggling is enabled — `>>=` is still an expression.

**Fix:** replace the two checks with an explicit operator decision:
```ts
if (ch === "=") {
  if (next === ">") return { ok: false, reason: "arrow functions are not allowed" };
  const isCompare = prev === "=" || next === "=" || prev === "!" || prev === "<" || prev === ">";
  const isShiftAssign = prev === "<" || prev === ">" ? next === "=" || (prev === ">" && next === ">") : false;
  if (!isCompare || /(?:>>|<<|>>>)=/.test(src.slice(Math.max(0, i - 3), i + 1))) return { ok: false, reason: "assignment is not allowed" };
}
```
(or the minimal version: reject when the 2-3 chars before `=` are `<<`, `>>`, `>>>`; keep everything else as-is and delete the dead branch). Add the six probe rows as regression tests.

---

### C-05 — P2 — The sanitizer's "no break-out" guarantee is false (`constructor.constructor` escape)

**Where:** `src/lib/verify.server.ts:192-202` (the keyword scan) and `:352-363` (the harness that the claim protects):

```ts
  if (
    /\b(?:function|class|new\s+Function|eval|require|process|globalThis|console|import|export|yield)\b/.test(
      stripStringsAndComments(expression),
    )
  ) return { ok: false, reason: "disallowed construct (function/eval/global access)" };
```

The scan runs over the *string-stripped* form, so any escape whose payload lives inside a string literal is invisible, and the blocklist is name-based — `constructor`, `prototype` and `__proto__` are not on it.

**Probe:**
```
[].constructor.constructor("return console")().log("ORACLE_RESULT case-1 pass")   {"ok":true,…}
[].constructor.constructor("return process")().platform.length > 0               {"ok":true,…}
```

`Function`-constructed functions run in global scope, so the second one really does reach `process` from inside a "sanitized" case.

**Honest impact statement — do not overstate this:** `runCases` already turns a forged verdict line into a *failure*, not a pass — any `ORACLE_RESULT` id that is unknown or already seen sets `forged = true` (`:436-446`), and a forged line for an expected id therefore forces a duplicate → `forged` → `pass:false`. And the module source itself is executed with full globals via `new Function('exports','module','require', __SRC)` (`:355`) in the same child process, so a hostile *source* already owns the runner. The defect is that the module's own stated guarantee — *"a hostile reply can never break out of the return-expression context and execute its own statements (which could print forged ORACLE_RESULT verdict lines)"* (`:74-77`) — is not delivered by the code beneath it, and a reader (or a downstream lane) will treat case expressions as inert data. It is a false security claim adjacent to a real machine-verdict path, which is why it is reported rather than filed as "by design".

**Fix:** add `\b(?:constructor|prototype|__proto__)\b` to the stripped-form keyword scan (cheap, catches this class), and amend the comment to state exactly what the sanitizer is: *a statement-form gate, not a sandbox — the runner is `node-runner.server.ts`, which is bounded, not isolated*. Add a regression test pinning both probe expressions to `ok:false`.

---

### C-06 — P2 — `intentLattice` frequency misses plural forms of gerund register nouns (stemToken vs canonicalStem asymmetry)

**Where:** `src/lib/algorithms.ts:366-379`:

```ts
      const termStem = tokenizeWords(term)[0] ?? term;                    // canonical (fixed-point) stem
      const freq = bag.filter((t) => stemToken(t) === termStem).length;   // :373 — ONE pass
```

`bag` comes from `tokens(text)` (`:321-329`) — raw lowercased words, not stems. `tokenizeWords` maps through `canonicalStem` (`:1139-1147`), which iterates `stemToken` to a fixed point (max 4 passes), while `:373` applies `stemToken` exactly once. For any word needing two passes, the comparison can never be true even when the brief contains the register term verbatim.

**Probe:**
```
listing    stem=list       canonical=list
listings   stem=listing    canonical=list      ← one pass ≠ fixed point
showing    stem=show       canonical=show
showings   stem=showing    canonical=show
embedded   stem=embed      canonical=emb
```
```
brief: 'A tool to track properties and show property listings to buyers'  (domain real-estate)
{"kind":"object","label":"property","weight":0.55}
{"kind":"object","label":"listing","weight":0.35}    ← freq counted 0 despite the literal word "listings"
```

**Impact:** node weight drives the weight-desc ordering of `lattice.nodes` (`:388`) and every consumer that ranks or truncates by it (the 18-node cap at `:421`, the packet's rank/render path). A brief that uses a plural/singular mix therefore ranks its *literal* vocabulary below unrelated nodes. Weight only — matching itself (`phraseHits`) is consistent because both sides go through `tokenizeWords`. This is the exact "tokenizer/stemmer asymmetry" class: two ways to stem, used on the two sides of one `===`.

**Fix:** compare like with like — `bag.filter((t) => canonicalStem(t) === termStem).length` (one word, and `canonicalStem` is already imported in the same module). Add a test asserting equal weight for `"…property listing…"` and `"…property listings…"`.

---

### C-07 — P2 — `module.exports = { … }` compiles clean, exports nothing, and fails every case with a bare `ReferenceError`; the `module` parameter is a decoy

**Where:** `src/lib/verify.server.ts:355-356` (the compile call) and `:449-458` (the verdict):

```ts
    "  const __fn = new Function('exports', 'module', 'require', __SRC + '\\n; return exports;');",
    "  __fn(__exports, { exports: __exports }, () => {});",
```

`module` is passed as a fresh `{ exports: __exports }` object and **never read back** — so the harness supports only the `exports.x = …` style. A source written in the far more common `module.exports = { … }` style reassigns the property on a throwaway object; `__exports` stays empty; every case raises a `ReferenceError`; and the verdict is a plain failure with no diagnosis.

**Probe (real runner, `node-runner.server.ts`):**
```
exports.x style                pass=true  compileError=- [{"id":"case-1","pass":true,"detail":"true"}]
module.exports = {...} style   pass=false compileError=- [{"id":"case-1","pass":false,"detail":"error ReferenceError: add is not defined"}]
```

**Impact:** the fail-to-pass loop's repair prompt is *"Return ONLY the complete corrected module source"* (`:804-815`) — the model is told to fix code, and the evidence it is given is `ReferenceError: add is not defined`, which is consistent with a *hundred* different mistakes; on a source with genuinely correct logic in the reassignment style the loop can burn all `MAX_ITERATIONS` (3) and stamp `status:"failed"` with misleading evidence. Direction of failure is honest (never a false pass), but the diagnosis is not: nothing in the evidence says "your module exported nothing" even though the harness knows the export inventory.

**Fix:** after compiling, fold the reassignment back and report the inventory:
```js
"  if (__mod.exports && __mod.exports !== __exports) { for (const k of Object.keys(__mod.exports)) __exports[k] = __mod.exports[k]; }",
"  __emit('HARNESS_EXPORTS ' + Object.keys(__exports).filter(k => typeof __exports[k] === 'function').join(','));",
```
and in `runCases`, fail with an explicit `compileError: "module exports no callable names — cases cannot reference the module"` when that list is empty (which also hardens C-01). Keep the `module` parameter honest by actually consuming it.

---

### C-08 — P3 — Harvest candidate cap leaks, and a zero fetch budget reports a failure that never happened

**Where:** `src/lib/harvest.ts:430` (cap), `:441-444` (budget note), `:495-497` (empty-result note):

```ts
      seenRepos.add(repo);
      candidates.push({ repo, url: item.url, snippet });
      if (candidates.length >= 6) break;      // :430 — checked AFTER the push, inside the INNER loop only
```
The comment at `:403` calls Phase A *"deduped, capped"*. The `break` only exits the per-query item loop; the outer `for (const q of qs)` loop (`:406`) has no cap re-check, so each additional query appends one more candidate past the cap (then breaks again).

**Probe:** 3 queries × 4 results, `maxQueries: 6`, `maxFetches: 1`:
```
hits: 1 | notes:
  - raw README fetch failed for o1/r1 — snippet is the search summary (provenance "web-search")
  - fetch budget exhausted — license spot-check skipped for o1/r1
  - fetch budget (1) reached — 6 candidate(s) left unfetched
```
`1 hit + 6 left unfetched = 7 candidates` against a documented cap of 6. (With the default `maxQueries: 2` the cap holds; the leak needs ≥3 queries.)

**Second, independent nit in the same area:** with `maxFetches: 0` nothing is fetched at all, yet `:495-497` still appends *"all candidate fetches failed — honest empty result (no repos fabricated)"* — a note that asserts a failure that never occurred (observed in the first probe run for this finding).

**Impact:** an internal cap that is off by `queries - 2` (bounded by `maxFetches` for network work, so no runaway), plus a user-visible note whose count is wrong and, at zero budget, whose wording is wrong. Both are the "small dishonest string in a paper-trail artifact" class this repo holds itself to.

**Fix:** move the cap to a named constant (`HARVEST_MAX_CANDIDATES = 6` — every other cap in this file is named) and re-check it at the top of the outer loop (`if (candidates.length >= HARVEST_MAX_CANDIDATES) break;`); push the "all candidate fetches failed" note only when `fetches > 0`, otherwise `"fetch budget is 0 — no candidate fetched"`.

---

### C-09 — P3 — `KnowledgeStore.entries()` returns the internal cache array by reference

**Where:** `src/lib/knowledge.ts:301-304`:

```ts
  entries(): KnowledgeEntry[] {
    if (this.cache === null) this.cache = this.readStore();
    return this.cache;
  }
```

The store's own header (`:8-15`) promises append-only semantics and atomic writes; the accessor hands out the live array, so any caller that sorts, splices, or pushes the result mutates store state (and, worse, can make the on-disk file differ from the intended append order without a write). Current call sites are read-only — `this.entries().length` (`:307`), the local snapshot in `savePattern` (`:377`), `findPatterns` (`:489`), and `store.entries().some(...)` in `scripts/rapidtool-cli.mjs:1757` — so **the impact today is latent**, not live. Reported as a smell because the next caller that sorts a "read" will silently rewrite the append order, and the failure looks like a data bug much later.

**Fix:** `return [...this.cache];` (or `Object.freeze([...this.cache])`). One line; no behavioural change for existing callers.

---

### C-10 — P3 — Three stemmers and one unstemmed matcher under the same conceptual name

**Where:** `algorithms.ts:1111` (`stemToken`, one-pass inflectional + `er` strip + doubled-consonant collapse), `algorithms.ts:1139` (`canonicalStem`, fixed point of the above), `engine.ts:2508` (`researchStem`, `ies→y` / `ss` guard / trailing `s`), `knowledge.ts:217-221` (`tokenize` — no stemming at all) used by `findPatterns` (`:497-527`).

The header of `knowledge.ts` is candid about its own case (*"HONEST LABEL: this is FusionRank-STYLE lexical scoring on plain tokens, NOT a vector database"*), and `researchStem`'s comment scopes it to mining. The smell is that "FusionRank" now denotes three different match behaviours: `fusionRank` (stemmed, `CORE-09` deliberately so "rerouted"/"reroute" match), `KnowledgeStore.findPatterns` (unstemmed — same query, different results), and research-query mining (`researchStem` — the only one that handles `properties → property`). A reader who learns one cannot predict the other two, and C-06 is the same disease inside a single function.

**Fix (cheap, non-breaking):** route `knowledge.tokenize` through `tokenizeWords` (stemmed), or rename the claim to "token-overlap search" so the three are visibly distinct; and add a one-paragraph "stemming" note at the top of `algorithms.ts` naming `stemToken`/`canonicalStem` as the canonical pair with everything else derivative.

---

## 4. Checked and clean (ruled out — do not re-hunt these)

Read line-by-line; the ones marked **[probe]** were additionally executed.

**`algorithms.ts`**
- `topo()` (`:616-645`) — correct Kahn's algorithm; self-dependencies and missing nodes are handled (`incoming.has(d)` guard at `:625`); the cycle throw is reachable and correct (all nodes not in `order`).
- `synthesizeContracts` (`:731-760`) — longest-key match over stemmed tokens is stable (`bankKeys` sorted by length desc, `:737-739`); bank rows are copied per entity (`:751`), so no `FIELD_BANK` aliasing; `default` excluded from the key search.
- `feasibilityScorecard` (`:941-990`) arithmetic — the stated calibration holds: complexity 3 → `10-1.8=8.2→8`; complexity 10 → `10-6-1.5=2.5→round 3`; hard rules HR-1/HR-2 applied after the mean, not instead of it.
- Health-ops defaults (`:389-408`) — the F2-84 kind-aware `hipaa`/`phi` fix is correct as written (each default guards its own `(kind,label)`), and the re-sort after the push keeps the 18-node cap from dropping the heaviest rows.
- `fusionRank` (`:467-583`) — malformed/unknown-kind/non-string-text rows skipped (`:508-514`); `limit` clamped to whole ∈ [0,∞) (`:492`) so `slice(0,-5)` cannot return all-but-five; per-kind RRF normalized by kind size; duplicate ids collapsed keeping the best-ranked row; query tokens de-duplicated (H3). **[probe]** exercised indirectly — `oracleBriefGrounded`/`runCases` probes plus the intentLattice probe gave stable, repeatable ordering.
- `estimateTokens` LRU (`:1068-1089`) — cap 100 enforced on the insert path, get-path deletes-then-sets to refresh recency, no unbounded growth, empty/whitespace short-circuits to 0.
- `librariesFor` (`:1191-1207`) — dedupe by name; the `hipaa`/`phi` duplicate entries in `LIB_CONSTRAINT` (`:1182-1183`) cannot double-push because of the `seen` guard.

**`algo-tools.ts`**
- `maskNonCode` (`:295-432`) — string/comment/template/regex-aware, same-length output, line-accurate. I specifically tried to make the regex-literal heuristic hide a loop and could not: a `/` is only ever treated as a regex after `= : , ( [ { ! & | ? ; + - * % ^ ~ < > /` or a value keyword, and a false candidate needs an unescaped closing `/` on the same line; the realistic cost is a masked division read, not a hidden `for`.
- `exportedNamesOf` ESM forms (`:190-192`) — `export function`, `async`, generators, `class`, `const/let/var` all covered; `export default` deliberately has no name to inventory (documented).
- `benchmarkHarness` (`:622-714`) — deterministic string builder, fixed `N_ITERS`/`N_INPUT`/`SEED`, mulberry32 (no `Math.random`), embeds the source as a JSON literal, and the generated file's only assertions are "compiles" + "target exists" + "timing is finite" — no fabricated numbers.

**`knowledge.ts`**
- **The engine↔head knowledge twin is genuinely byte-identical**: `engine.ts:1199-1213` (private) vs `knowledge.ts:760-774` (exported) — same filter, same `parts.push` order, same ` · ` join, same 300-char tail collapse. The parity contract in the doc comment holds today; the fix history said "extend the lazy LessonSurface seam and drop the inline copy" — that is a de-duplication task, not a bug.
- `savePattern`/`saveLessonIfImproved` (`:375-460`) — merge-on-save prevents last-writer-wins; the eval gate refuses on regression/missing score; refusal never deletes; the human-accepted exception (`accepted` + `actor:*`) is deliberate and documented at `:408-411`.
- `assertValidNewEntry` (`:250+`) vs `isEntryRow` (`:227-239`) — write/read field parity checked; the writer mints `id` so the reader's `id` requirement can never disagree with the writer.
- `findPatterns` (`:482-556`) — deterministic tie-break (score desc → title asc → id asc), idf-weighted, decay applied multiplicatively so `counterEvidence`-free rows are byte-identical to legacy, `limit` clamped with `Math.max(0, limit)`.
- `lessonRow` (`:715-743`) — content-addressed id from the collapsed text, tags sorted+deduped, 240-char cap, non-finite score floored to 0.5 (no NaN sort).
- `pressureAt`, `selectLessons`, `topLessonRows`, `dismissLessonRows` — all bound their inputs and clamp limits; no mutations of the passed arrays.

**`harvest.ts`**
- `githubRepoOf` (`:309-325`) — `new URL` in try/catch, hostname allowlist, owner/repo name regex, path blocklist; `ssrf`-ish inputs degrade to `null` rather than a fetch.
- `stripMarkup`/`clipSnippet` (`:327-352`) — non-string input fails closed to `""`; clipping stays within `cap` (+ ellipsis) and prefers a word boundary.
- `extractPatterns` (`:541-577`) — column-0 only (indented = nested, so no AST-grade overclaim), dedupe key includes the line, schema key collection is depth-bounded (60 lines / 20 keys).
- `trendNotes` (`:598-625`) — **no `lastIndex` bug**: every `TREND_MARKERS` regex is non-global (`:583-591`), and the defensive `marker.re.lastIndex = 0` at `:610` is a no-op by construction; the note cap is enforced and the "no signals detected" branch is honest about coverage.
- `harvestRepos` — time budget (`remainingMs`) and fetch budget both checked; every failure path pushes a note (the only two problems are C-08).
- `harvestResultLesson` (`:729-748`) — pure, deterministic, and correctly returns `null` for a clean non-empty harvest (no invented negative evidence).

**`verify.server.ts`** (beyond the findings)
- `parseOracleJson` (`:207-264`) — quote-aware `;` split (escapes handled), final-statement repair documented, tolerant of fences, returns `null` (not `[]`) when nothing parses so callers branch on absence.
- `runCases` (`:374-459`) — refuses zero cases (no vacuous truth), rejects non-string payloads, fails the *whole* run on one rejected expression with a per-case reason, and the forged/duplicate rule is airtight: unknown id or repeat id → `forged = true` → fail. A hostile forged line can force a FAIL, never a pass.
- `oracleSignatureFunctionNames` (`:466-483`) — three declaration forms + dedupe, deterministic order.
- Pinned-oracle handling (`:665-706`) — drop detection + one bounded repair + merge-by-id so the model's own cases survive; refuses after the retry (`RT_E_VALIDATION`), never a silent reduced oracle.
- `verifyAndFixServer` (`:717-835`) — iteration clamp [1,5]; cases are generated once and never regenerated/weakened inside the loop; the model never declares the pass; every exit path carries evidence and the not-configured path mints no lesson.

**Engine / repo-wide**
- `researchQueryText`/`researchStem` are single-sourced: `headless.ts` imports rather than re-implementing (grep for `researchStem` in `headless.ts` → no hits), so the "no mirror drift" claim at `engine.ts:2551-2553` holds.
- `inferDomain` (`engine.ts:197-218`) — deterministic tie-break by count then summed raw-term length; the `stemToken(raw)` one-pass vs `tokenizeWords` canonical mismatch I hunted for here does not bite any current `DOMAIN_TERMS` entry (checked each list for words where one pass ≠ fixed point).
- `sealHonesty` (`:1182-1185`) delegates to `failedGates` (no second implementation of the census).
- No `Math.random` in any module that claims determinism — only `deepseek.server.ts:86-191` (retry jitter, injectable) and `rt-ring.ts:73` (id minting), both appropriate. `design.ts`, `diagram.ts`, `vector.ts`, `brief-fixtures.ts` all keep their "no Date.now(), no Math.random" promises in fact.
- No `throw new Error("…not implemented")`, no `todo!`-style placeholder that presents as done, no `ok:true` with empty data, and no `catch {}` that hides a failure without a note **in the five files in scope**. `TODO(E-15)` appears only as the *intended*, honestly-labelled stub marker that `doctor.ts:51-75` and `dod.ts:102-133` classify as `"stub"` and refuse product-complete on — that is the system working.
- No module-level unbounded growth found: the only top-level mutable containers in the core are constant lookup Sets plus `tokenEstimateCache` (capped).
- `vault.ts:949`'s `b.score - a.score || b.note.updatedAt - a.note.updatedAt` is NOT a NaN comparator — `VaultNote.updatedAt` is `number` (`:108`), so the `||` tie-break is numeric and correct.

---

## 5. Could not verify

1. **End-to-end reachability of C-01 through the CLI with a live key.** Both gates and the downstream stamp were verified independently (probe + read of `verifyAndFixServer:770-781`), but I have no `DEEPSEEK_API_KEY` here, so "the model would have to emit such a case" is my inference from the prompt at `:565-585`, not an observed run.
2. **How often a real model emits `module.exports = {…}`** (C-07). The harness behaviour is proven; the frequency of the trigger is not.
3. **`npm test` / `typecheck` / `lint` after my reading** — per instructions I did not re-run them, and I changed no repo code (this file only). My probes imported the real modules, so those files were exercised live regardless.
4. **`node-runner.server.ts` internals** — used successfully through `runCases` (the probes ran real child processes), but its timeout/kill semantics were not audited.
5. **`dod.ts` / `maker-score.ts` threshold arithmetic and the eval scripts** (`scripts/run-eval.mjs`) — out of this lane; 100-104 own those surfaces. The only `dod.ts` lines I read were the stub classifiers cited above.
6. **Whether any future caller mutates `KnowledgeStore.entries()`** (C-09) — current call sites are read-only; the risk is latent by construction.
7. **The full operator-family matrix inside `sanitizeOracleExpression`** — I probed `=`/`==`/`>=`/`<=`/`>>=`/`<<=`/`>>>=`/`||=`/`+=`/arrows and read the rest of the guard; I did not exhaustively enumerate every compound-assignment operator (`**=`, `&&=`, `??=` are rejected by the same branch as `+=`, by reading).

---

## 6. TASKS THIS IMPLIES

Ordered by value-per-line. "Done when" is meant to be literally testable.

| # | Task | Why (finding) | Where (file:line) | Fix | Done when | Size |
|---|---|---|---|---|---|---|
| **T-01** | **Emit and require the module export inventory in the machine harness** | C-01: a pass can be minted for a module that exports nothing, because nothing in `runCases` requires a case to reference an export | `verify.server.ts:343-370` (harness), `:429-458` (parser/pass) | Have `buildHarness` emit `HARNESS_EXPORTS <names>` after compile; in `runCases` fail with `compileError: "module exports no callable names — machine verification is vacuous"` when the inventory is empty | `runCases('const helper = 1;', [{id:'c1',expression:'({board:1}).board===1'}]).pass === false` with that reason, while `exports.add` modules still pass | S |
| **T-02** | **Stop string/object-key data from satisfying brief-grounding** | C-01 (second half): `identifierHits` matches substrings, so an object literal key grounds a case that never calls the module | `verify.server.ts:495-518`; `sandbox.ts:251-260` | Run `identifierHits` over `stripStringsAndComments(joined)` (already imported) and, when the source exports functions, require at least one hit on an identifier that is *called* | The literal case is rejected with the 116 vacuity reason; existing 116 tests stay green | S |
| **T-03** | **Close the `=` guard's operator hole and delete the dead arrow branch** | C-04: `>>=`/`<<=`/`>>>=` are accepted as "not assignments" (shared exemption with `>=`/`<=`), and `verify.server.ts:142` is unreachable (`prev === "=" && next === ">"` can never describe `=>`) | `verify.server.ts:137-152` | Reject `(?:<<\|>>\|>>>)=` explicitly (check the 2-3 chars before `=`); detect arrows via `next === ">"`; delete the unreachable branch | Six regression rows: `>>=`, `<<=`, `>>>=` rejected; `>=`, `<=`, `==` accepted; `a => a` rejected *with the arrow reason* | S |
| **T-04** | **Add `constructor`/`prototype`/`__proto__` to the sanitizer blocklist; correct the guarantee comment** | C-05: `[].constructor.constructor("return console")().log(...)` passes the sanitizer, so the stated "can never break out" claim is false (posture, not a fake pass — the duplicate rule forces a fail) | `verify.server.ts:192-202` (scan), `:74-77` (claim) | Extend the keyword regex; rewrite the comment to say "statement-form gate, not a sandbox — execution bounds are `node-runner.server.ts`" | Both probe expressions rejected; comment matches behaviour | S |
| **T-05** | **Consume the `module` parameter: support `module.exports = {…}` and diagnose zero exports** | C-07: the common CJS style compiles clean, exports nothing, and fails every case with a bare `ReferenceError`; the repair prompt then asks the model to fix correct code | `verify.server.ts:355-356`, `:447-458` | After compile, fold `Object.keys(mod.exports)` into `__exports`; fail with `"module exports no callable names — cases cannot reference the module"` when empty | Both CJS styles produce `pass:true`; the zero-export case fails with the actionable reason (not a `ReferenceError`) | S |
| **T-06** | **Restrict the halving probe to the loop header** | C-03: any `0.5` (or `x / 2`) in a loop *body* makes `complexityOf` publish **O(log n)** for a linear loop, and that notation ships inside the generated benchmark file | `algo-tools.ts:437`, `:557-565`, `:596-606` | Test `HALVING_RE` against `header` only; if a body-level halving shape is seen, append it to `extras` ("body-level halving detected — not counted") instead of changing the class | `for (x of a) { s += x * 0.5 }` → `O(n)`; `i /= 2` header → `O(log n)`; both pinned in `algo-tools.test.ts` | S |
| **T-07** | **Make `intentLattice`'s frequency count canonical-stem on both sides** | C-06: `stemToken(t)` (one pass) vs a `canonicalStem` term stem means plural register nouns count 0 — a brief containing "listings" gives the `listing` node weight 0.35 instead of 0.55 | `algorithms.ts:373` | `bag.filter((t) => canonicalStem(t) === termStem).length` | Test: `intentLattice("…property listing…").nodes` and `"…property listings…"` produce equal weights for `listing` | S |
| **T-08** | **Fix the CJS export regex so only real `module.exports.` matches** | C-02: `my_module.exports.x = 1` is reported as an export (phantom name injected into the property-case prompt as "the module exports these names ONLY") | `algo-tools.ts:185` | Split into two regexes — bare `exports.` requiring a non-identifier boundary, and `module.exports.` requiring the literal `module` at a boundary | `my_module.exports.x` → `[]`; `module.exports.z` → `["z"]`; four probe rows as tests | S |
| **T-09** | **Name + enforce the harvest candidate cap; fix the zero-budget note** | C-08: the cap (`6`, a magic number) is only checked inside the per-query loop, so 3 queries yield 7 candidates (visible in the "N candidate(s) left unfetched" note); a `maxFetches: 0` run reports "all candidate fetches failed" when none was attempted | `harvest.ts:430`, `:441-444`, `:495-497`, constants block `:40-48` | `HARVEST_MAX_CANDIDATES = 6`; re-check at the top of the outer query loop; gate the failed-fetch note on `fetches > 0` | 3 queries + `maxFetches: 1` → exactly 6 candidates in the note; 0-budget run says "fetch budget is 0 — no candidate fetched" | S |
| **T-10** | **Return a defensive copy from `KnowledgeStore.entries()`** | C-09: the append-only store hands out its live cache array; the next caller that sorts a "read" mutates store state and breaks append order with no write | `knowledge.ts:301-304` | `return [...this.cache];` | Test: mutate the returned array, then assert `store.count()` and `findPatterns` are unchanged | S |
| **T-11** | **One stemmer, stated once** | C-10 / C-06: three stemmers (`stemToken`, `canonicalStem`, engine's `researchStem`) + one unstemmed `tokenize` all feed "FusionRank"-named ranking with different match behaviour | `algorithms.ts:1111/1139`, `engine.ts:2508`, `knowledge.ts:217-221, 497-527` | Add the canonical-pair note to `algorithms.ts`; either route `knowledge.tokenize` through `tokenizeWords` or relabel the claim as "token-overlap search"; document `researchStem` as mining-only | A single comment block names the canonical pair; no module implements its own stemmer without a pointer to it | M |
| **T-12** | **Add the verify-safety regression block** | C-01/C-04/C-05/C-07 are all live in a **green 1634/1634 suite** — the suite simply never tests a literal-only case, a shift-assignment, a `constructor` escape, or a `module.exports` module | `src/lib/verify.server.test.ts` (extend) | Pin six cases: literal-only case fails; `>>=` fails; `constructor.constructor` fails; `module.exports` style passes; zero-export module fails; `exports.add` passes | The six assertions run in the existing suite; each fails if its fix is reverted | M |
| **T-13** | **Audit the remaining text-level name guards for the same two-directional failure** | The C-01/C-02/C-04/C-06 pattern (`name/pattern matching standing in for behaviour`) recurs: `oracleSignatureFunctionNames` (three regexes, first-match-wins), `oracleBriefGrounded`'s plural/singular form-exactness (a plural-only brief with no contract names can false-*reject* a legitimate case — fails closed today), and `dod.ts`'s seed/case id matching | `verify.server.ts:466-483`, `:495-518`; `dod.ts` oracle-id helpers | For each guard, add one positive + one negative test with a *differently shaped* input (plural noun, member-chain, shift-assign, `module.exports`) | Each guard has both directions pinned; a false accept and a false reject are both test-visible | M |
| **T-14** | **Publish the verify lane's real capability contract where its users read it** | C-04/C-05/C-07: the generated-case prompt, the sanitizer, and the harness disagree about what is allowed and what works; the CLI docs describe the verify verb without its limits | `verify.server.ts:565-585` (prompt), `scripts/README-cli.md` (verify section), `AGENT_GUIDE.md` | State the four limits — single boolean expression; no arrow/assignment/template; `exports.x =` modules only (reassignment supported per T-05); the runner is bounded, not a sandbox | Prompt text and docs carry the same list; a doc-drift test (or a comment link) ties them together | S |
| **T-15** | **Add a source-level determinism guard test** | `design.ts`, `diagram.ts`, `vector.ts`, `algorithms.estimateTokens`, `brief-fixtures.ts` all *promise* "no Date.now(), no Math.random" in comments and nothing enforces it repo-wide; one copy-pasted `Date.now()` in an artifact builder silently breaks byte-parity | repo-wide `src/lib/*.ts` vs the determinism claims at `design.ts:9`, `diagram.ts:25`, `vector.ts:44`, `brief-fixtures.ts:24` | A test that scans the claimed-deterministic modules for `Date.now(`/`Math.random(` and fails with the file:line | Test present and green; adding `Date.now()` to `design.ts` turns it red | S |
| **T-16** | **Commit the probe evidence for this report as a runnable scratch file** | The 10 findings above rest on `node -e` probes that are currently one-off shell history; the parent (or a later lane) should be able to re-run the evidence without re-deriving it | new `probe-109-core.ts` (the repo already carries `probe-r5-*.ts` scratch files in this style) | Port the five probes: stemmer asymmetry, `sanitizeOracleExpression` operator matrix, complexity matrix, harvest cap, CJS regex matrix | `node --experimental-strip-types probe-109-core.ts` prints the same lines quoted in this report | S |

**Cross-lane note for the parent (not a task here):** T-01/T-02 are the only items in this report that touch the product's *claims* rather than its mechanics (a "machine-verified" stamp obtainable without touching the module). If only one thing lands from lane 109, land T-01.
