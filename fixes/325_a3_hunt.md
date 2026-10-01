# 325 — A3 BUG-HUNTER lane (codegen/sandbox/dod box) — W44 six-professional wave

Lane: A3 (hunt; iteration cap hit) + **A3b (finisher pass — this file's author)**. Repo:
`C:\Users\mnril\Desktop\RapidTool Main` (git-bash `/c/Users/mnril/Desktop/RapidTool Main`).
Base: commit `e2fbd9d` (boundary GREEN: scripts 365/365, lib 2513 pass) + the wave's uncommitted
edits. Scratch: `C:/Users/mnril/a3_scratch/` (probes only, outside the repo — no tree dirt;
pre-fix bytes reconstructed from a throwaway `git worktree` at e2fbd9d, removed after use).
**KEYLESS ONLY — no DEEPSEEK_API_KEY in spawn env; no keyed runs. Real code only, no mocks/stubs.
Patch-only, minimal diffs. Pins additive; never weaken.**
Box: `src/lib/codegen.server.ts` + `src/lib/sandbox.ts` + `src/lib/dod.ts` + their suites
(`codegen.server.test.ts`, `sandbox.test.ts`, `gates.test.ts`; dod tests live in gates.test.ts).
Scoped proofs only: `node --check` (Windows-style), `node --experimental-strip-types --test <file>`,
`npx eslint <files>` — never npm test/build/gate.sh.

**What A3 landed but capped before finishing:** 4 real bugs fixed on disk (sandbox.ts ×1,
codegen.server.ts ×3) with keyless repros — **no log, no pins, no scoped proofs**. A3b re-verified
every fix against the base worktree byte-for-byte, added the regression pins, and ran the proofs.
`dod.ts`: inspected by A3, **no edits** (no confirmed defect beyond the fixed register); confirmed
0-byte diff vs base by A3b.

Diff vs base: `git diff e2fbd9d --numstat` → `src/lib/codegen.server.ts` **49+/33-**,
`src/lib/sandbox.ts` **15+/0**; `src/lib/dod.ts` — none.

---

## Bug records (pre-fix bytes = base worktree at `e2fbd9d`; post-fix = live tree)

### A-1 · HIGH (anti-gaming; rare trigger, total bypass when hit) · `sandbox.ts` `regexLiteralEnd` — postfix `++`/`--` division misread as a regex open

- **Evidence (pre-fix bytes):**
  - `maskLiteralsAndComments('const a = i++ / 2; const y = fetch / z;')`
    → `"const a = i++                        z;"` — the sign pair sat in the regex-opener set, so
    `/` after `++` "opened" a phantom regex and the scanner consumed to the next `/` on the line:
    **real code masked**. `identifierHits(["fetch","window"], …)` → `[]` — `fetch` invisible to the
    FORBIDDEN scan (an anti-gaming hole in the sync gate) and to brief-fit `identifierHits`.
  - Mirror direction: `'let n = 3; const q = n-- / 2; const re = /\bfetch\b/;'`
    → `"let n = 3; const q = n--                  \bfetch\b/;"` — mispaired scan leaves the REAL
    regex's body visible. `identifierHits(["fetch"], …)` → `["fetch"]` — a **false forbidden refusal**.
- **Repro:** `node --experimental-strip-types C:/Users/mnril/a3_scratch/probe7.mjs` (prints pre/post
  pairs; base worktree vs live tree); TS-lexer battery: `probe2.mjs` (10/15 agree → **14/15** post-fix).
- **Fix:** `src/lib/sandbox.ts` (hunk `@@ -37,6 +37,21 @@`; guard now at `sandbox.ts:40-54`,
  pre-fix anchor `sandbox.ts:39`): when the char before an opening-sign candidate `+`/`-` is ANOTHER
  sign, the pair is postfix `++`/`--` ⇒ division, `return -1`. Prefix `++i / 2` (prev = identifier
  char) was already handled; binary `a + /re/` (prev sign, prior operand) stays a regex.
- **Verify (post-fix):** division byte-identical to source; hits `["fetch"]` (visible, refusable);
  mirror regex masked to TS truth; no false hit; prefix leg unchanged.

### A-2 · HIGH (emitted ESM SyntaxError / undefined export; regex-brace shapes are common in generated code) · `codegen.server.ts` `bracketDelta` + `cjsStatementDelta` — depth walks ignored regex literals

- **Evidence (pre-fix bytes):**
  - *Dangling leg* — closing-brace regex INSIDE a dropped whole-object assign:
    ```
    function parse(s) { return String(s); }
    module.exports = {
      parse: parse,
      fmt: (s) => s.replace(/}/g, "!"),
    };
    function tail() { return 1; }
    ```
    `stripCjsExportAssignments(src, ["parse"])` → `"function parse(s) { return String(s); }\n};\nfunction tail() { return 1; }\n"`
    — the construct closes early on the regex `}`, **dangling `};` left** in the emitted ESM
    (SyntaxError at import; materialized chunk carries `…};\n…\nexport { parse };`).
  - *Swallow leg* — `[`-opening regex inside the object:
    `"module.exports = {\n  open: /[{]/,\n};\nconst keep = 1;"` with names `["open"]` → `""` — the
    walk gained one level too many and **swallowed the rest of the file**; materialized chunk becomes
    `export { keep };` with **no binding** (`Export 'keep' is not defined` at import).
- **Repro:** probes `probe1.mjs` P2/P2b (pre/post), `probe8.mjs` (byte pairs incl. materialize level),
  `probe3.mjs` (materialize → disk → `node --check`).
- **Fix:** both walks now count on `maskLiteralsAndComments(line)` (string/regex/comment bodies
  blanked to same-length spaces, indices preserved) — one masking authority, no second scanner.
  `bracketDelta` base `codegen.server.ts:1923` → now `:1939`; `cjsStatementDelta` base `:1959` → now
  `:1968` (hunks `@@ -1918,23 +1924,23 @@`, `@@ -1953,24 +1959,17 @@`).
- **Verify (post-fix):** dangling leg → `"function parse(s) { return String(s); }\nfunction tail() { return 1; }\n"`;
  swallow leg → `"const keep = 1;\n"`; materialized chunks clean and importable.

### A-3 · MED (duplicate declaration kills the whole tree at import; trigger = bare/destructured declaration + residual assign) · `codegen.server.ts` `localBindingNames` — bare/destructured declarations not seen as bound

- **Evidence (pre-fix bytes):**
  ```
  let cache;
  function compute() { return { ok: true }; }
  module.exports.cache = cache || compute();
  ```
  `neutralizeResidualCjsExports(…)` → `"let cache;\nfunction compute() { return { ok: true }; }\nconst cache = cache || compute();\n"`
  — residual converted to `const cache = …` **beside the file's own `let cache;`** (duplicate
  declaration; self-referencing RHS = TDZ). Materialized chunk:
  `…\nconst cache = cache || compute();\nexport { cache, compute };` →
  `node --check`-fatal: `Identifier 'cache' has already been declared`.
- **Repro:** `probe8.mjs` (C leg byte pairs); `probe1.mjs` P3 (pre/post); `probe3.mjs` caseC.
- **Fix:** `localBindingNames` (base `:1984` → now `:1993`; hunk `@@ -1980,13 +1979,30 @@`) gained
  bare-declaration (`let cache;`) and destructuring (`const { id } = …`) arms. Over-detection is the
  SAFE direction (the statement is dropped, never double-declared); the `^` anchor stays (inner-scope
  declarations are deliberately not top-level bindings — see Residual §2).
- **Verify (post-fix):** neutralize → `{"source":"let cache;\nfunction compute() { return { ok: true }; }\n","exported":["cache"]}`
  — statement dropped, declaration kept, name still exported; chunk imports clean.

### A-4 · LOW (wasted repair call on a technicality) · `codegen.server.ts` `p6SynthesisPatchRepairPrompt` — invalid-JSON FIRST FORM example

- **Evidence (pre-fix bytes):** FIRST FORM line (base `codegen.server.ts:1181`) ended
  `…empty deletes the matched text>"},}.` — a trailing comma inside the object. The prompt demands
  "JSON ONLY" twice, but its own preferred example was **invalid JSON**:
  `JSON.parse` → `FAIL — Expected double-quoted property name in JSON at position 174`. A model
  copying the example byte-for-byte yields an unreadable delta → refusal on a technicality + a wasted
  legacy full-rewrite repair call.
- **Repro:** `probe6.mjs` (base) / `probe4.mjs` (live) — extract the FIRST FORM example and
  `JSON.parse` it.
- **Fix:** `src/lib/codegen.server.ts` hunk `@@ -1178,7 +1178,13 @@` — trailing comma removed
  (line now `:1187`), comment added.
- **Verify (post-fix):** example `JSON.parse` OK (`oldStr`/`newStr` strings); prompt contains no
  `"},}`; pre-fix shape throws `SyntaxError` (teeth).

### dod.ts

No edits (0-byte diff vs base). A3 inspected `classifyRowSeat`/`provenanceConsistent`/`approvalActor`/
`runGate`/`evidenceHash`/threshold — no new confirmed defect beyond the fixed register. One
unpinned-but-correct observation: `p12-openapi` accepts quoted-JSON / `openapi: 3.1.0` forms while
`engine.ts:1167` is the only producer (no bug).

---

## Residual observations (recorded, NOT fixed — outside the four landed fixes)

1. **Masker template policy (not a defect):** the TS-lexer battery's one remaining post-fix
   divergence (`const t = \`a${b / 2}c\`; …`) is the masker masking template **interpolation bodies**
   by explicit documented policy (`sandbox.ts:74-75` docstring: "incl. `${…}` interpolation bodies");
   the in-test `tsTruthMask` harness does not model `TemplateExpression` spans. The new pins avoid
   template spans and compare against truth on modeled constructs only.
2. **A-3 LOW residual (deliberate):** inner-scope `function helper(){}` + `module.exports.helper = helper`
   still converts to `const helper = helper;` (module-scope self-reference → TDZ if evaluated).
   Inner declarations are deliberately not top-level bindings (`^` anchor); dropping instead would
   emit `export { helper }` with no binding. Pathological input; unfixed, recorded.
3. **A-1 conservative corner:** `a + +/re/` (two sign chars where the second is unary before a real
   regex) is treated as division. Exotic; the safe direction (never masks real code out — the
   anti-gaming hole direction); recorded, not pinned.

---

## Pins added (A3b — additive only; no existing assertion changed)

`git diff e2fbd9d --numstat` for the test files: `sandbox.test.ts` **21+/0-**,
`codegen.server.test.ts` **132+/0-** (0 deletions — nothing weakened).

| Fix | Pin | Home |
|---|---|---|
| A-1 | "postfix `++`/`--` — the following `/` is division, not a regex open": mask `== tsTruthMask` for the division + mirror + prefix legs; `fetch` stays visible to the FORBIDDEN scan; masked regex body never a false hit | `sandbox.test.ts:447` |
| A-2 | "a brace REGEX inside a dropped whole-object assign never leaves a dangling `};`" (parse assert + pre-fix-shape TEETH) | `codegen.server.test.ts:1098` |
| A-2 | "a `[`-opening regex inside a dropped whole-object assign does not swallow the rest of the file" | `codegen.server.test.ts:1125` |
| A-2+A-3 | "regex-brace assigns + bare-`let` residuals materialize to IMPORTABLE ESM (W21-258 import legs)" — real `node` ESM imports of the emitted trees (`TREE_IMPORT_OK exports=[parse]` / `[cache,compute]`; pre-fix both legs are import-fatal) | `codegen.server.test.ts:1248` |
| A-3 | "a bare `let cache;` is a local binding — the residual assign drops, never a duplicate const" (+ destructuring arm) | `codegen.server.test.ts:1327` |
| A-4 | "the FIRST FORM example is itself valid JSON (no trailing comma)" (extract + `JSON.parse` + pre-fix-shape TEETH) | `codegen.server.test.ts:2430` |

Existing assertions: **none changed** — the pre-existing FIRST-FORM prefix assertion in the prompt
test still passes as-is; every pin is additive.

## Proofs (A3b — scoped)

- `node --check` (Windows-style paths, Node v22.23.2): `…\src\lib\sandbox.ts` OK,
  `…\src\lib\codegen.server.ts` OK, `…\src\lib\sandbox.test.ts` OK, `…\src\lib\codegen.server.test.ts` OK.
- `node --experimental-strip-types --test src/lib/sandbox.test.ts` → **34 pass / 0 fail** (baseline 33; +1 pin).
- `node --experimental-strip-types --test src/lib/gates.test.ts` → **88 pass / 0 fail** (cross-regression; unchanged).
- `node --experimental-strip-types --test src/lib/codegen.server.test.ts` → **127 tests / 24 suites,
  127 pass / 0 fail** (base worktree baseline **122** → +5 pins; the import legs spawn real `node`).
- `npx eslint src/lib/sandbox.ts src/lib/codegen.server.ts src/lib/sandbox.test.ts src/lib/codegen.server.test.ts` → **exit 0**.
- Byte-anchored re-verification of all four fixes: `probe1`–`probe4` re-runs + `probe6`–`probe10`
  (base worktree `e2fbd9d` vs live tree byte pairs — see §Bug records for the exact bytes).

## Applies

- `src/lib/sandbox.ts` — A-1 fix (+15/−0). `src/lib/codegen.server.ts` — A-2/A-3/A-4 fixes (+49/−33).
- `src/lib/sandbox.test.ts` — A-1 pin (+21/−0). `src/lib/codegen.server.test.ts` — A-2/A-3/A-4 pins (+132/−0).
- `src/lib/dod.ts` — **no changes** (inspection recorded above; 0-byte diff vs base).
- Lane box totals vs `e2fbd9d`: **217 insertions / 33 deletions** — all inside the box.
- No keyed runs; no `npm test`/build/gate.sh; no edits outside the box. Scratch probes under
  `C:/Users/mnril/a3_scratch/` (outside the repo, delete-nothing); the base-reconstruction worktree
  was removed after use (probes keep the raw byte pairs).

=== END 325_a3_hunt — COMPLETE ===
