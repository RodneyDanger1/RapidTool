# 322 · X3 FIXER #3 — src/lib box (W44 "10 EXPERIMENTS" campaign, window-3 prep lane)

Lane X3 (fixer #3, **src/lib/** box). Repo `C:\Users\mnril\Desktop\RapidTool Main` — HEAD `20802b1`
plus **in-flight window-2 edits** (as of t0: `M src/lib/sandbox.ts` [X1b P6-A/P6-B already on disk],
`M scripts/rapidtool-cli.mjs`, `M scripts/cli-exit-taxonomy.test.mjs`, `M scripts/README-cli.md` [X2b];
`codegen.server.ts`/`dod.ts`/`engine.ts`/`headless.ts` threshold+reject edits **not yet visible** — re-read ALL
touched files fresh before any window-3 apply).

**Hard rules honored:** single write surface = THIS log (+ src/lib/**.ts patches ONLY once
`C:/Users/mnril/w44_trial/fix_go3.md` exists and names the cleared subset). No keyed calls
(`DEEPSEEK_API_KEY` verified unset). No repo edits before the marker; no boundary runs. Space-in-path ⇒
terminal `grep` only. Repros read-only/keyless; scratch under `C:/Users/mnril/x3_scratch/`.

Status: **IN PROGRESS — marker absent (poll #0 @ 16:40 CDT)**. All five register items investigated;
patches + pins prepared below; window-3 applies pending.

## Ticket register (X3 claims)

| # | sev | ticket | state |
|---|---|---|---|
| **BUG-4** | MED-candidate | prose-in-code refusal flagged a CODE line (ternary, EXP03 cycle 3) | **CONFIRMED false positive — reproduced keyless**; fix + regression prepped (§BUG-4) |
| **BUG-2** | LOW-MED | L2 lesson rows clipped at 240 (`knowledge.ts:762`,`:956`) | prep complete: 600+ellipsis raise + pins (§BUG-2) |
| **BUG-3** | LOW | L2 row text "0 hits … none computed" vs real 6/7 union hits | prep complete: measured census wired at the template (§BUG-3) |
| **OBS-6** | tiny | `dod.ts:763-766` docstring overstates evidenceHash | doc correction prepped (§OBS-6) |
| **OBS-8** | adjudicate | census job-scope vs understated counts | **ACCEPTABLE-BY-DESIGN — closed, no patch** (§OBS-8) |

## Repro environment (keyless, read-only)

- Node `v22.23.2`; scratch `C:/Users/mnril/x3_scratch/` — `bug4_repro.mjs` (+ outputs `bug4_table.txt`),
  `bug23_check.mjs`; both import repo modules via `pathToFileURL` (no repo writes).
- Campaign artifacts read: `C:/Users/mnril/w44_trial/exp/{01_website,02_game,03_cli}/build.json`
  (E2's `e2_scratch/check_fit.mjs` re-run on them for truth numbers).

---

## BUG-4 — "prose-in-code" refused a ternary code line (CONFIRMED false positive)

### The heuristic (exact scan logic — src/lib/codegen.server.ts)

`proseLineHits(source)` (`codegen.server.ts:334-495`) is the ONLY prose scanner (`validateSynthesisModule`
`:2357-2365` refuses on any hit; grep: no other callers in the repo). Per line, with comment content +
string/template content blanked (line-scoped masker): a line is prose when it survives ALL of —

1. `PROSE_ARITH_MINUS` exclusion (`:303`, W23-262/B1): spaced-minus `operand - operand` ⇒ skipped.
2. code-char veto (`:281`): any of `()[]{}<>=|&+*_\@#$%^~` vetoes (bare `/` ⇒ stricter sentence branch).
   **`?`, `:`, `;`, `-`, `.`, `,` are deliberately NOT code chars** (sentence punctuation, handled by shape).
3. shape test `PROSE_LINE_SHAPE` (`:283`): `^[A-Za-z][A-Za-z0-9 ,.:;!?'"()-]*$` — **admits `? : ; -`**.
4. floors: no parens/code-char ⇒ ≥4 words / ≥15 letters (else the ≥6-word / ≥30-letter sentence branch).

### Why `return negative ? -cents : cents;` trips it (trace, then measured)

- masker leaves it intact (no strings/comments/slashes); `PROSE_ARITH_MINUS` MISSES (the minus is
  unary-attached `-cents`, not a spaced binary minus); no code char; shape passes (`? : ; -` all admitted);
  6 words ≥ 4; 24 letters ≥ 15 ⇒ **refused as "1 prose line"**.
- Measured against the CURRENT repo code (imported function, keyless): `proseLineHits('return negative ? -cents : cents;')` ⇒ `[{line:1, text:"return negative ? -cents : cents;"}]`. Broad class: any single-line ternary with
  identifier arms and no other code-significant char (`return flag ? alpha : beta;` trips identically).

### Exact bytes from the campaign (EXP03 cycle 3 = final cycle, burned before exhaustion)

`exp/03_cli/build.json` logs[43].detail = `RT_E_VALIDATION · chunk 1/3 refused · prose-in-code in generated
module (1 prose line; first at line 78: "return negative ? -cents : cents;")` — same bytes in
`fixes/322_e2_monitor.md` (~L101-104) + `fixes/322_e1_ten.md` EXP03.

### Fix (prepared, codegen.server.ts — two edits + docstring)

**Edit 1** — insert after the `PROSE_ARITH_MINUS` const (`:303`), before the `proseLineHits` docstring:

```ts
/**
 * 322 X3 (BUG-4): ternary-expression code shape — a single-line `cond ? a : b`
 * whose arms are single identifier/numeric tokens (unary minus and dotted
 * paths admitted) at the end of the line (optional `;`/`,` terminal). `?`,
 * `:`, `;` and `-` are sentence punctuation to PROSE_LINE_SHAPE and such a
 * line carries no code-significant character at all, so it satisfied every
 * prose floor and was refused as prose — burning EXP03's final synthesis cycle
 * (`prose-in-code … line 78: "return negative ? -cents : cents;"`,
 * 322_e2_monitor §BUG-4). Excluded up front like PROSE_ARITH_MINUS, end-
 * anchored: a ternary is a whole-expression tail while deliberation prose
 * ends in a sentence terminal (`.`/`!`/`?`) and stays caught. Accepted
 * residual (same trade as W23-262/B1): a deliberation line ending exactly
 * `word? word: word` with NO sentence terminal is no longer flagged — rare.
 */
const PROSE_TERNARY = /\?\s*-?(?:[A-Za-z_$][\w$]*(?:\.\w+)*|\d+(?:\.\d+)?)\s*:\s*-?(?:[A-Za-z_$][\w$]*(?:\.\w+)*|\d+(?:\.\d+)?)\s*[;,]?\s*$/;
```

**Edit 2** — insert after `    if (PROSE_ARITH_MINUS.test(flat)) continue;` (`:455`):

```ts
    // 322 X3 (BUG-4): end-anchored ternary expression — code, never prose (see
    // PROSE_TERNARY above). Tested on the MASKED text like PROSE_ARITH_MINUS,
    // so arms inside strings/comments are already blanked away.
    if (PROSE_TERNARY.test(flat)) continue;
```

**Edit 3 (docstring truth)** — in the `proseLineHits` doc (`:313-320`), replace the claim
`…can match that shape —\n * prose-as-code always can. The one legal shape the raw sentence test WOULD\n * match — a spaced arithmetic minus…` so the two known legal shapes are both named:

```ts
 * …can match that shape — prose-as-code always can; the two legal shapes that
 * DO are excluded up front: a spaced arithmetic minus between two operands
 * (`balance: amountDue - amountPaid`) via PROSE_ARITH_MINUS (W23-262/B1: that
 * exact line refused run #2's chunk 2/7 and cascaded into 28 honest coverage
 * reds in the emitted suite; fixes/255 §2 + fixes/260 §2), and a single-line
 * ternary `cond ? a : b` with single-token arms (`return negative ? -cents :
 * cents;`) via PROSE_TERNARY (322 X3, BUG-4: that exact line refused EXP03's
 * final synthesis cycle; 322_e2_monitor §BUG-4).
```

### Repro / discrimination table (measured, keyless — both modules run side by side)

Extraction = `proseLineHits` block verbatim from the repo (scratch `prose_original.ts`) vs the same block
with Edits 1+2 applied textually (`prose_patched.ts`); full output in `bug4_table.txt`.

| corpus line | original hits | patched hits | expected |
|---|---|---|---|
| `return negative ? -cents : cents;` (EXACT EXP03 bytes) | **[1]** | **[]** | drop (was the false positive) |
| `return flag ? alpha : beta;` | [1] | [] | drop |
| `balance: negative ? -cents : cents,` | [1] | [] | drop |
| `return items.length ? items : defaultItems;` | [1] | [] | drop |
| `return negative ? -cents : cents` (no semi) | [1] | [] | drop (optional terminal) |
| `const sign = negative ? -1 : 1;` | [] | [] | already safe (`=`) |
| `return (negative ? -cents : cents);` | [] | [] | already safe (parens branch) |
| `balance: amountDue - amountPaid` | [] | [] | already safe (W23-262) |
| `return net - fees;` | [] | [] | already safe |
| `Should we ship it? Yes: ship.` | [1] | **[1]** | STAYS prose (pin) |
| `Was it good? Yes: great.` | [1] | **[1]** | STAYS prose (pin) |
| `Is that right? Yes: indeed` (no terminal) | [1] | [] | **accepted residual** (documented) |
| `I'll write the code now.` (blob line 3) | [1] | [1] | MUST stay (pin) |
| `return firstName / lastName / department / section;` | [] | [] | already safe |
| LEAKED_BLOB_PROSE (3-line fixture) | [1,2,3] | **[1,2,3]** | pinned blob unchanged |
| SCAFFOLD_UI_FIXTURE (multiline) | [11] | **[11]** | pinned scaffold hit unchanged |

Discriminator summary: **end-anchored `? arm : arm` with single-token arms** (`arm = ident(\.ident)* | number`, optional unary `-`); the earlier draft that allowed a trailing `.` inside the arm class was caught by the
control test (it absorbed the sentence period and exempted `…Yes: ship.`) — tightened to `(?:\.\w+)*`; both
controls now stay flagged. If the parent wants MORE prose teeth, make the terminal `[;,]` mandatory
(one-char change) — that also re-catches the no-terminal residual at the cost of a no-semicolon ternary
still being refused; recommended as-is (code-safety bias, W23-262 precedent).

### Regression case + pins (codegen.server.test.ts)

- Add to `LEGAL_PROSE_LOOKALIKES` (`:1800-1814`) — three lines:

```ts
  "return negative ? -cents : cents;",
  "return flag ? alpha : beta;",
  "balance: negative ? -cents : cents,",
```

- Add a new `it(...)` in the `"216f T-09/T-15 detectors"` describe (after the control test at `:1866-1875`):

```ts
  it("T-09 322 X3 (BUG-4): ternaries are code — prose question/colon shapes stay flagged", () => {
    // The exact line the shipped heuristic refused (EXP03 cycle-3 log bytes).
    assert.deepEqual(proseLineHits("return negative ? -cents : cents;"), []);
    assert.deepEqual(proseLineHits("return items.length ? items : defaultItems;"), []);
    // The exclusion must not widen to prose: sentence-terminal question/colon
    // lines carry the same punctuation and MUST stay prose hits.
    assert.equal(proseLineHits("Should we ship it? Yes: ship.").length, 1);
    assert.equal(proseLineHits("Was it good? Yes: great.").length, 1);
  });
```

- **Pin never weakens:** no existing assertion changes; blob fixture (3/3), scaffold ([11]), and the
  split e2e refusals re-checked in the table above — all byte-stable. Apply-time proof:
  `node --experimental-strip-types --test src/lib/codegen.server.test.ts` (fresh, post-X1b threshold edit).

---

## BUG-2 — L2 lesson rows clipped at 240 (payload severed)

### Mechanism

`LESSON_TEXT_MAX = 240` (`knowledge.ts:762`), applied in `lessonRow` (`:956`) as
`.replace(/\s+/g," ").trim().slice(0, LESSON_TEXT_MAX)` — a silent cut with no marker. Measured on all
three stopped experiments: row len == 240, ending mid-phrase, e.g. EXP01 `'…required brief nouns with 0
hits in '`, EXP03 `'…required brief nouns appear as identifiers in the generated source (si'` — the cut
severs exactly the noun list + evidence hash the row exists to carry (322_e2_monitor §BUG-2 +
`exp/*/build.json` rows read directly). With the BUG-3 fix the EXP03-shaped row payload is **440 chars**
(validated in `bug23_check.mjs` against the real build.json criterion texts) — i.e. the intended payload
fits under 600 with room; 240 can never carry it.

### Fix (prepared: raise to 600 + explicit ellipsis marker, house `clipSurface` idiom)

**Edit 1** — `knowledge.ts:761-762`:

```ts
/** Hard cap on a lesson row's text (bounded prompt injection, H43-P2-2).
 *  322 X3 (BUG-2): 240 → 600. At 240 the cut severed exactly the payload the
 *  L2 row exists to carry (required-noun list + evidence hash; 322_e2_monitor
 *  §BUG-2 — every live row len==240 ending mid-phrase, vs a 440-char intended
 *  payload for the EXP03 shape). 600 is the house surface cap (engine.ts
 *  `clipSurface`, SURFACE_CAP) with the same explicit-ellipsis convention
 *  (≤ LESSON_TEXT_MAX + 1 chars emitted when a cut happens). */
export const LESSON_TEXT_MAX = 600;
```

**Edit 2** — new helper directly above `lessonRow`'s docstring (`~:938`):

```ts
/**
 * 322 X3 (BUG-2): the house clip idiom (engine.ts `clipSurface`): collapse
 * whitespace; when the cap actually cut, append ONE explicit ellipsis so a
 * reader can never mistake a clipped row for a complete one (≤ LESSON_TEXT_MAX
 * + 1 chars emitted). Short texts pass through byte-identically.
 */
function clipLessonText(raw: string): string {
  const flat = raw.replace(/\s+/g, " ").trim();
  return flat.length > LESSON_TEXT_MAX ? `${flat.slice(0, LESSON_TEXT_MAX)}…` : flat;
}
```

**Edit 3** — `lessonRow` text construction (`:954-957`):

```ts
  const text =
    typeof spec.text === "string" ? clipLessonText(spec.text) : "";
```

**Edit 4 (comment parity)** — two docstrings:
- `:942` `…text collapsed to ≤ LESSON_TEXT_MAX.` → `…text collapsed to ≤ LESSON_TEXT_MAX (+1 when an explicit ellipsis marks a cut).`
- `:1184` `clipped to 140 chars inside the 240-char row budget.` → `clipped to 140 chars inside the LESSON_TEXT_MAX row budget.`

### Coupling sweep (measured, keyless — `x3_scratch/calc_pin_lengths.mjs`)

- `lesson-writers.test.ts:52` (`row.text.length <= 240`) — the L1 fixture row measures **219 chars, NOT cut**
  (natural length) ⇒ stays green after the raise, no change needed.
- `report-intake.test.ts:271` (`lesson.text.length <= 240`) — the L2 record-path row measures **153 chars**
  today, ~179 after the BUG-3 wording change ⇒ stays green, no change needed.
- All other `<= 240` hits in tests are LOG-DETAIL budgets (`row.detail`, `seal.detail`) — different code path,
  untouched by LESSON_TEXT_MAX.
- Comment parity (prompt layer): `prompt-engine.ts:69-72` says "lesson rows are ≤240 chars by construction
  (LESSON_TEXT_MAX)" — update the 240 phrase to `≤ LESSON_TEXT_MAX`; the per-line prompt re-cap stays at 240
  WITH its explicit `[TRUNCATED]` marker (`:173-174`), so prompt injection remains bounded regardless of the
  raised record cap. **No prompt-cap change** (record vs prompt are different budgets).

### Pin adjustments (a pin never weakens)

- `knowledge.test.ts:373/378` — fixture is `"x".repeat(500)` and asserts `row.text.length === LESSON_TEXT_MAX`.
  With the raise, 500 < 600 ⇒ no cut ⇒ assertion would break. Update the fixture to `"x".repeat(700)` (still
  exercises the cap) and tighten the assertion so truncation must be MARKED:

```ts
    assert.equal(row.text.length, LESSON_TEXT_MAX + 1, "H43-P2-2 (322 X3): capped at the raise cap");
    assert.ok(row.text.endsWith("…"), "a clipped row is marked as clipped");
```

- `:605` (`l1.text.length <= LESSON_TEXT_MAX`) and `:617` (`l3.text.length <= LESSON_TEXT_MAX`) stay true ⇒ keep;
  update only the stale message at `:617` (`"hypothesis + evidence fit the 240-char budget"` → `"…fit the row budget"`).
- NEW pin (same describe as the class-builders test, after `:620`-ish):

```ts
  it("322 X3 (BUG-2): an L2 seal row's noun list + evidence hash survive inside the raised cap", () => {
    const p = seedProject();
    const row = templateEmissionLesson(
      p,
      6,
      ["p6-verified", "p6-brief-fit"],
      ["static", "marketing", "website", "shop", "visitors"],
      "deadbeef",
    );
    assert.ok(row.text.includes("evidenceHash=deadbeef"), "the evidence hash survives the cap");
    assert.ok(row.text.includes("visitors"), "the noun list tail survives the cap");
    assert.ok(row.text.length <= LESSON_TEXT_MAX + 1);
  });
```

---

## BUG-3 — L2 text "0 hits … none computed" vs measured union-tree hits

### Mechanism + truth

Template (`knowledge.ts:1164`): ``required brief nouns with 0 hits in emitted source: ${nounText};`` where
`nounText = nounList.length ? nounList.join(", ") : "none computed"` (`:1157`). Caller `headless.ts:1012-1019`
(keyed P6 refusal path — the writer that minted ALL THREE campaign rows: each build.json has
`lesson.capture … (keyed P6 synthesis refused — red gate on a live run)`) passes `undefined` nouns ⇒
`"none computed"`; the record path (`knowledge.ts:1415`) passes `[]` ⇒ same. The literal "0 hits" then
reads as the tree's hit count — **false**: measured union-tree census (repo helpers, `check_fit.mjs`
re-run on the real artifacts; register truth at E2 time = 6/22 and 7/18, now with in-flight window-2
masker+stem fixes = **9/22 (EXP01), 9/18 (EXP02)**; EXP03 refused skeleton = 0/16 placeholder). The
"0 hits" reading was true only of the older barrel-only surface (fixes/255 note, dod.ts:633-638).

### Fix (prepared: measure the census at the template — single authority for every writer)

**Edit 1** — import after `knowledge.ts:29`:

```ts
import { briefNounHits, identifierHits } from "./sandbox.ts";
```

(sandbox.ts is import-free/pure ⇒ no cycle; knowledge.ts is already the node:fs disk-backed server module.)

**Edit 2** — helper directly above `templateEmissionLesson`'s docstring (`~:1134`):

```ts
/**
 * 322 X3 (BUG-3): the union-tree brief-noun census for the L2 row — runs the
 * SAME measurement the p6-brief-fit DoD probe runs (dod.ts:630-648): required
 * brief nouns vs identifierHits over the union of the barrel `generatedSource`
 * plus every `generatedTree` file. Returns null when there is no brief or no
 * emitted artifact to measure — the row then says so instead of any hit claim.
 * Pre-fix the row printed a literal "0 hits … none computed" on every live P6
 * refusal while the sealed trees measured 6/22 (EXP01) and 7/18 (EXP02) — it
 * misinformed about the red's cause (322_e2_monitor §BUG-3). Pure.
 */
function briefCensusOf(
  project: Project,
): { hits: number; required: number; missing: string[] } | null {
  const brief = typeof project.brief === "string" ? project.brief : "";
  if (!brief.trim()) return null;
  const tree = Array.isArray(project.generatedTree) ? project.generatedTree : [];
  const source =
    tree.length > 0
      ? [
          project.generatedSource ?? "",
          ...tree.map((f) => (f && typeof f.source === "string" ? f.source : "")),
        ].join("\n")
      : project.generatedSource ?? "";
  if (!source) return null;
  const { required } = briefNounHits(brief);
  if (required.length === 0) return null;
  const hits = identifierHits(required, source);
  return {
    hits: hits.length,
    required: required.length,
    missing: required.filter((t) => !hits.includes(t)),
  };
}
```

**Edit 3** — replace `knowledge.ts:1153-1164` (noun list + text):

```ts
  const nounList = (Array.isArray(nouns) ? nouns : [])
    .filter((n): n is string => typeof n === "string" && n.trim() !== "")
    .map((n) => n.trim())
    .slice(0, 5);
  // 322 X3 (BUG-3): never print a hit claim that was not measured. With an
  // emitted artifact present, state the real union-tree census (hits/total +
  // the 0-hit nouns — caller-supplied nouns win as the 0-hit list); without
  // one, say so. The pre-fix "0 hits … none computed" text read as "zero hits"
  // on rows whose sealed trees measured 6/22 and 7/18 (322_e2_monitor §BUG-3).
  const census = briefCensusOf(project);
  const missingText = nounList.length
    ? nounList.join(", ")
    : census && census.missing.length > 0
      ? census.missing.slice(0, 5).join(", ") + (census.missing.length > 5 ? ", …" : "")
      : "none";
  const nounText = census
    ? `required brief nouns present as identifiers in emitted source: ${census.hits}/${census.required} (0 hits: ${missingText})`
    : nounList.length
      ? `required brief nouns with 0 hits in emitted source: ${nounList.join(", ")}`
      : `required brief noun hit census not computed (no emitted artifact on this project)`;
  const hash =
    typeof evidenceHash === "string" && evidenceHash.trim()
      ? evidenceHash.trim().slice(0, 16)
      : fnv8(`${project.brief}:${phase}:${ids.join(",")}:${nounText}`);
  const text =
    `L2 template-emission: phase P${phase} sealed with gate unmet (${ids.join(", ") || "unknown"}); ` +
    `${nounText}; evidenceHash=${hash}.`;
```

**Edit 4 (doc)** — append to the `templateEmissionLesson` docstring (`:1134-1140`): “322 X3 (BUG-3): the
text carries the real union-tree brief-noun census when the project holds an emitted artifact
(`briefCensusOf`) — never a literal "0 hits" claim from an unmeasured surface; `nouns` callers supply
the 0-hit list explicitly.”

**No caller change needed:** `headless.ts:1012-1018` keeps passing `undefined` — the template now computes
the measured census from the project (`p`), which is exactly the "real union-tree hit count" the register
asked for. (Fallback if the parent vetoes the knowledge→sandbox import: compute `missing` at
`headless.ts:1012` with the same two helpers and pass it as `nouns`, and change only the template's
fallback branch to neutral wording; less complete — the record path would stay unmeasured.)

**Validated rendering (scratch mirror on the REAL EXP03 build.json):**

```
L2 template-emission: phase P6 sealed with gate unmet (Machine verification promoted a tested verdict
(lastTest.label === "tested" with evidenceHash), Brief-conformance: required brief nouns appear as
identifiers in the generated source (single-module, or the union of the tree files in tree mode));
required brief nouns present as identifiers in emitted source: 0/16 (0 hits: office, admin, parse, csv,
expenses, …); evidenceHash=abc12345.        [440 chars — fits under the 600 cap; no cut]
```

### Pin (knowledge.test.ts — new it()):

```ts
  it("322 X3 (BUG-3): the L2 row states the measured census — never an unmeasured '0 hits'", () => {
    const p = seedProject();
    const withArtifact = templateEmissionLesson(
      {
        ...p,
        brief: "Build a kanban board with columns and cards",
        generatedSource: "function createBoard() { return { columns: [] }; }",
      },
      6,
      ["p6-brief-fit"],
    );
    assert.match(withArtifact.text, /present as identifiers in emitted source: \d+\/\d+/);
    assert.ok(!withArtifact.text.includes("none computed"), "no unmeasured 'none computed' claim");
    const noArtifact = templateEmissionLesson(
      { ...p, generatedSource: "", generatedTree: [] },
      6,
      ["p6-brief-fit"],
    );
    assert.ok(noArtifact.text.includes("census not computed"), "neutral wording without an artifact");
  });
```

(Apply-time: adapt spreads to `Project` typing if the strict compiler objects; ids/values keep, no pin weakens.
Existing knowledge/honesty-guards pins checked read-only: ids are signature-hashed (`:1168`) so text changes
fork nothing; the only text assertions are the `evidenceHash=[0-9a-f]{8}` regex — still matched.)

---

## OBS-6 — `evidenceHash` docstring overstates (doc-only)

`dod.ts:763-766` says the hash flips on "any content change"; the implementation (`:789-793`) covers only
the sorted `id:pass|fail` probe verdict pairs — distinct projects with equal verdict sets share hashes
byte-for-byte (all 7 phases D1↔EXP01, 322_e2_monitor §OBS-6). **Prepared correction** (re-read fresh in
window 3 — X1b's threshold edit is in this file):

```ts
/**
 * Machine-checkable DoD gate for one phase. evidenceHash = FNV-1a over the
 * sorted "id:pass|fail" pairs of every probe — a VERDICT-VECTOR fingerprint,
 * not artifact evidence: the same probe verdict set always yields the same
 * hash and any VERDICT change flips it, but it cannot attest artifact
 * content — a content change that leaves every probe verdict unchanged, and
 * two distinct projects with equal verdict sets, share a hash byte-for-byte
 * (322 X3, OBS-6: e.g. every phase of D1 and EXP01 matched).
 */
```

Comment parity at the implementation, above `const evidence = items` (`:789`):

```ts
  // 322 X3 (OBS-6): verdict-vector fingerprint only — see the runGate docstring;
  // it does not cover artifact content.
```

No test pins the docstring; doc-only ⇒ scoped proof at apply = `node --check` (Windows path) on the file +
a re-run of the dod/gates test files if X1b's edits are already verified there.

---

## OBS-8 — emit/doctor substance census is job-scoped (ADJUDICATED, closed)

- **Scope is by construction and documented:** `collectJobSources`/`collectTreeJobSources` walk only
  `src/jobs/` + `jobs/` (headless.ts:3786-3810; compile-check.server.ts:554); `TreeSubstance.verdict`
  defines `empty = "no job modules under src/jobs/ or jobs/ — nothing to census"` (compile-check.server.ts:459-462),
  and the loud `note` is deliberately suppressed for job-file-less trees ("no job modules is not this trap",
  :605-608) because the K3/K4 trap is about JOB stubs.
- **Counts are correct FOR THE STATED SCOPE:** EXP04's 2 `TODO(E-15)` throws + 3 reexport bridges live
  outside `src/jobs/`, so `{stubs:0,reexports:0,real:0,verdict:"empty"}` claims nothing about them; the
  same verdict carries `greenWhileStubbed:false` only because no job module exists to phrase a trap about.
- **Disclosure is present on the named surfaces:** emitted/README.md names “3 declared spec-graph job
  node(s) … NOT materialised” + “3 non-job module(s) … thin bridges”; `doctor` gaps carry “skip≠green;
  stubs≠complete” (doctor.ts:248); the emitted suite visibly skips 6/12 rows “NOT IMPLEMENTED”. No consumer
  is told the tree is product-complete.
- **Residual nit only:** the emit summary’s “(see warnings)” (scaffold.ts:3200) does not NAME the README
  surface; cosmetic, outside the register’s byte-anchored sites — logged as optional follow-up, not prepped.
- **Verdict: acceptable-by-design labeling + adequate disclosure ⇒ OBS-8 CLOSED, no src change.**

---

## Window-3 apply checklist (when `fix_go3.md` names the subset)

1. RE-READ fresh: `src/lib/codegen.server.ts` (BUG-4; X1b threshold edits expected), `src/lib/knowledge.ts`
   (BUG-2/3), `src/lib/dod.ts` (OBS-6; X1b threshold edits expected), `src/lib/headless.ts` (BUG-3 caller
   context; X1b reject-seam edits expected), `src/lib/codegen.server.test.ts` + `src/lib/knowledge.test.ts`
   (X1b may have touched codegen tests for the threshold).
2. Apply per-file patches with unique anchors (line numbers will have shifted); one writer per file.
3. Scoped proofs only: `node --check` (Windows-style paths) on edited .ts files · `node --experimental-strip-types --test`
   on `src/lib/codegen.server.test.ts`, `src/lib/knowledge.test.ts` (+ `src/lib/headless.test.ts` if BUG-3
   touches are re-verified there) · `npx eslint` on edited files. No boundary runs.
4. Append applies + proof outputs here; flip the END marker.

## Poll log (fix_go3.md)

| # | time | marker | notes |
|---|---|---|---|
| P0 | 16:40 | absent | window-2 in flight (X1b applied sandbox.ts P6-A/P6-B by now; scripts X2b landed; codegen/dod/engine/headless pending) |
| P1 | 16:43 | absent | coupling sweep done (L1 219 / L2 153 — both pins stay green); prompt-layer comment parity noted |

<!-- APPEND-ANCHOR -->

## Window-3 applies (parent-appended 2026-09-30; lane X3b capped after LANDING ALL EDITS and withheld proofs rather than record unverified counts — correct)

- **Applied (all on disk):** `codegen.server.ts` end-anchored `PROSE_TERNARY` const + guard in `proseLineHits` + docstring truth update; `codegen.server.test.ts` +3 lines to `LEGAL_PROSE_LOOKALIKES` + new BUG-4 ternary case; `knowledge.ts` `LESSON_TEXT_MAX` 240→**600** + `clipLessonText` (clipSurface idiom, verified at engine.ts:3904-3906) + `briefCensusOf` (sandbox import) wired into `templateEmissionLesson` + doc parity; `knowledge.test.ts` recorded fixture 500→700 + tightened assertion (`LESSON_TEXT_MAX + 1` + `endsWith("…")`) + 2 new pins (payload-survives + measured census); `dod.ts` `runGate` docstring → "VERDICT-VECTOR fingerprint" + comment parity (doc-only).
- **Fresh proofs:** see `fixes/322c_v4_verify.md` (V5 battery: codegen.server + knowledge + sandbox + gates suites fresh counts; the ternary no longer flags; pinned prose controls unchanged (blob 3/3, scaffold [11]); census text truthful on a real artifact).

=== END 322_x3_fixes — COMPLETE (parent-completed; edits by X3b; proofs in 322c_v4_verify.md) ===
