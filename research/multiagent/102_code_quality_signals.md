# 102 — How Good Code Is Written, and How AI Can Actually Tell Good From Bad

**Provenance.** Lane `task-2` of wave `deleg_9272975b` did the research (≈60 pages fetched to
`%LOCALAPPDATA%\Temp\rt102\`) but hit the 50-iteration cap **before** writing. The parent
carried the write from the lane's frozen, quote-safe evidence bank. **Nothing here is
invented**: every quote below was fetched by the lane from the URL cited, and every item the
lane could not fetch is listed as `UNVERIFIED` in §5 with instructions not to cite it.

---

## 0. Method note — what actually works for keyless research on this host

`web_search` / `web_extract` are **unconfigured** (no `FIRECRAWL_API_KEY`). Measured
behaviour, so future lanes don't waste iterations:

| Source | Result |
|---|---|
| DuckDuckGo HTML (`html.duckduckgo.com/html/?q=`) | **Rate-limits after ~2 queries** (HTTP 202, zero `result__a`) — do not rely on it for volume |
| **OpenAlex** (`api.openalex.org/works?filter=title.search:…`) | ✅ reliable |
| **arXiv API** (`export.arxiv.org/api/query`) | ✅ reliable |
| Wikipedia REST summaries | ✅ reliable |
| `raw.githubusercontent.com` | ✅ reliable (used for OWASP ASVS README) |
| `web.archive.org` | ✅ the workaround for 403s (ACM, openai.com) |
| Semantic Scholar API | ❌ HTTP 429 |

---

## PART 1 — How good code is actually written

### 1.1 Code review is the highest-leverage human gate — and it is measured

**Cisco/SmartBear case study** (`https://static0.smartbear.co/support/media/resources/cc/book/code-review-cisco-case-study.pdf`), verbatim:

- *"2500 reviews of 3.2 million lines of code written by 50 developers"*
- *"Our reviews had an average 32 defects per 1000 lines of code"*
- *"no review larger than 250 lines produced more than 37 defects per 1000 lines of code"*
- *"LOC under review should be under 200, not to exceed 400"*
- *"Inspection rates less than 300 LOC/hour result in best defect detection"*
- *"most formal meetings add hours to the process without uncovering additional defects"*

**Lesson that transfers to an AI factory:** review yield is governed by **unit size and rate**,
not by ceremony. A generator that emits one giant artifact per phase is structurally
unreviewable. (This is the strongest external argument for `104` T4.3 — small, reviewable units.)

**Fagan 1976** (`10.1147/sj.153.0182`) is the origin of formal inspection; **Rigby & Bird 2013**
(`10.1145/2491411.2491444`) and **Bacchelli & Bird ICSE'13** found reviews are *"less about
defects than expected"* and more about *"knowledge transfer, increased team awareness"* —
i.e. a review gate does double duty (correctness + shared understanding) that a pure
test-gate cannot replace. **Bosu et al. MSR'15** (`10.1109/MSR.2015.21`) documents
reviewer-side dynamics.

### 1.2 The standards actually worth anchoring to

- **ISO/IEC 25010:2023** — nine quality characteristics (`quality.arc42.org/standards/iso-25010`).
  Maintainability = Modularity / Reusability / **Analysability** / Modifiability; **Flexibility
  replaced Portability**; **Safety is now present**. (`iso.org/standard/78176.html` → 403.)
- **SWEBOK V4** = **18** knowledge areas (V3 had 15).
- **12-factor app** — all 12 verified; stated motive *"avoiding the cost of software erosion"*.
- **DORA** — five metrics: change lead time, deployment frequency, failed-deployment recovery
  time (throughput); change fail rate, deployment rework rate (instability).
- **Google eng-practices** — *"look at every line"*; over-engineering vigilance (*"solve the
  problem they know needs to be solved now"*); *"Don't accept CLs that degrade the code health
  of the system."*
- **Holzmann, "Power of Ten"** (`spinroot.com/gerard/pdf/P10.pdf`) — all 10 rules verified
  verbatim, incl. **Rule 5**: *"assertion density… minimum of two assertions per function"*
  with the explicit guard *"not possible to satisfy the rule by adding unhelpful `assert(true)`"*;
  **Rule 10**: most pedantic analyzer setting, *"preferably more than one state-of-the-art
  static source code analyzer"*.
- Supporting conventions/DOIs verified: **PEP 8**, **Microsoft C# conventions**, **SemVer 2.0.0**,
  **reproducible-builds.org**, **OWASP ASVS 5.0** (`raw.githubusercontent.com/OWASP/ASVS/master/README.md`),
  **ESLint rule taxonomy** (Possible Problems / Suggestions / Layout & Formatting with
  ✅Recommended / 🔧Fixable), **`tsconfig` `strict` family**, **Hypothesis**, **CodeQL about**,
  **TestPilot** (`10.1109/TSE.2023.3334955`).

### 1.3 Metrics: mostly proxies, and the field says so

- **SonarQube quality gates** — pass/fail on *new* vs *overall* code, with a deliberate
  *fudge factor*: duplication/coverage conditions are ignored under 20 new lines; test code is
  excluded from duplication/security conditions.
- **Sonar Cognitive Complexity** (G. Ann Campbell) — 3 rules (ignore shorthand; increment per
  flow break; increment more when flow breaks are nested) and 4 increment types
  (Nesting/Structural/Fundamental/Hybrid). ⚠️ **The commonly cited "15 threshold" was NOT in
  the fetched PDF — do not assert it.**
- **Cyclomatic complexity is a criticised metric** — **Bishop 1988** (`10.1049/sej.1988.0003`);
  **Fenton & Neil 1991** (`10.1109/32.106988`).
- **Clones** — correlation with defects is *contested*: "Do Code Clones Matter?"
  (`10.1109/ICSE.2009.5070549`); long-method/"Blob" smell (`10.1109/CSMR.2011.24`); naming
  flaws (`10.1109/WCRE.2009.50`); **Nagappan et al. 2008** (`10.1007/s10664-008-9062-z`).
- **Coverage is a weak proxy** — **Inozemtseva & Holmes 2014** (`10.1145/2568225.2568271`).

### 1.4 The "Clean Code" debate — cite real anchors, not folklore

- Critiques that exist and were fetched: `qntm.org/clean` (the *"two to four lines"* rule and
  its *"dreadful"* examples) and `bugzmanov.github.io/cleancode-critique/` (*"questionable to
  harmful"*).
- Empirical: **arXiv 2208.07056** — systematic literature review of **771 papers** + survey of
  **39 practitioners**; finds *"shared agreement… but developers tend to write messy code to be
  refactored later"*.
- ⚠️ **No Coplien/Schachaf "Clean Code critique" paper could be found — mark UNVERIFIED and do
  not cite it.** (The original brief suggested one; the lane correctly refused to repeat it.)

---

## PART 2 — How AI models can actually tell good code from bad

### 2.1 Execution and specification beat any judge

- **SWE-bench** (`2310.06770`) — 2,294 problems across 12 repos.
- **SWE-bench-Verified** (OpenAI, via Wayback) — *"500 samples verified to be non-problematic"*
  by *"93 software developers experienced in Python"*, from *"1,699 random samples"* annotated
  with severity 0–3 (2–3 = discard); defines **FAIL_TO_PASS** / **PASS_TO_PASS**.
- **Contamination is real**: `2512.10218` — models scored **3× better on SWE-bench-Verified**
  and **6× better at finding edited files** ⇒ the verified split is materially easier/leakier
  than the original.
- **Self-repair is over-sold**: `2306.09896` — gains are *"often modest… sometimes not present
  at all"* once cost is counted. `2310.01798` — LLMs cannot self-correct reasoning
  intrinsically. Positive counterpoints: `2304.05128` (Self-Debugging on execution results),
  `2207.10397` (CodeT).
- **LLMs miss what analyzers catch**: `2308.00245` (LLift) concludes *"LLMs are better used in
  an assistive role to complement static analysis"*. Google's **Tricorder** caught an SMT hash
  bug (`f ^ (f >>> 32)` after retyping `long`→`int`) in **31 places**; a brace linter caught
  "goto fail". Tricorder data (via Wayback of the CACM article): *"146 analyzers, with 125
  contributed from outside the Tricorder team"*, *"~50,000 code review changes per day"*,
  *">5,000 Please-Fix clicks/day"*, only **250 "Not useful"/day**, and an explicit tolerance of
  *"up to 10% effective false positives"*. Its own conclusion: *"Even in a mature codebase with
  full test coverage and a rigorous code-review process, bugs slip by."*
- **Static types help but do not solve it**: Gao/Bird/Barr ICSE'17
  (`discovery.ucl.ac.uk/10064729/1/typestudy.pdf`) — *"Flow 0.30 and TypeScript 2.0
  successfully detect 15%"*.

### 2.2 LLM-as-judge: measurable, reproducible bias — never a gate

- **MT-Bench** (`2306.05685`) — names position, verbosity and self-enhancement bias.
- **Position bias at scale** (`2406.07791`) — **15 judges, >150,000 evaluation instances**.
- **Self-preference** (`2410.21819`) — GPT-4 shows measurable self-preference.
- **Order swap alone is decisive** (`2305.17926`) — *"Vicuna-13B could beat ChatGPT on 66 over
  80 tested queries"* purely by swapping order.
- **Only the best/largest judges align with humans** (`2406.12624`).
- **Familiarity + anchoring bias, low inter-sample agreement** (`2405.01724`).

**Design consequence:** a judge may be an *advisory* signal with a cross-family, order-swapped
protocol — it must never satisfy a correctness gate that an executable oracle could.

### 2.3 The oracle problem: generated tests lock in the bug

This is the single most important failure mode for an AI factory that writes its own tests:

- `2410.21136` — *"LLM-based test generation approaches are also prone on generating oracles
  that capture the **actual** program behaviour rather than the **expected** one"*.
- `2601.05542` — *"they do not address the oracle problem"*.
- `2511.16858` — test overfitting: a suite that *"technically passes observed tests but actually
  misses important cases"*.
- **Assertion strength matters more than count**: HOLZMANN Rule 5 explicitly forbids satisfying
  an assertion-density rule with `assert(true)` — the same loophole a generator will find.

### 2.4 Mutation testing measures tests, not programs

- **Jia & Harman** (`10.1109/TSE.2010.62`) — the reference survey.
- `2406.09843` — LLM-generated mutants: **87.98% vs 41.64%** fault detection, but worse
  non-compilability / duplication / equivalent mutants by **26.60 / 10.14 / 3.51** pp.
- `2607.22880` — when the code-under-test is already buggy, coverage and mutation *"no longer
  serve as reliable indicators"*.

---

## PART 3 — The 12 signals, ranked (each with what it proves and what it cannot)

| # | Signal | Proves | Does **not** prove |
|---|---|---|---|
| 1 | Clean-checkout compile + `tsc --noEmit` under `"strict": true` | type-level impossibility of some bug classes | nothing about logic |
| 2 | **Spec-anchored FAIL_TO_PASS + PASS_TO_PASS execution, grader withheld from the generator** | the strongest correctness evidence available | only "these tests pass" |
| 3 | Full existing suite green in a hermetic sandbox (no network, pinned deps) | no regression vs the tests that exist | correctness of untested paths |
| 4 | Lint at a pinned config, scoped to new code | named rule violations absent | absence of violations ≠ absence of bugs |
| 5 | Security scan (secret-scan + SAST + dependency CVE), fail on new findings | named vulnerability patterns absent | security in general |
| 6 | Cognitive + cyclomatic complexity thresholds on changed functions | a comprehensibility *proxy* | quality (CC is criticised — Bishop 1988) |
| 7 | Duplication/clone density on new code | copy-paste surface | defect proneness (contested) |
| 8 | Mutation score of generated tests | *test strength* | program correctness; degrades when code is buggy |
| 9 | Assertion density + **oracle-strength audit** (assert expected vs observed) | catches the known LLM failure of locking in buggy behaviour | full specification coverage |
| 10 | Error-handling audit (unchecked non-void returns, empty `catch`, unhandled rejections) | Holzmann Rule 7's "most frequently violated rule" | that handled errors are handled *correctly* |
| 11 | Build reproducibility (byte-identical rebuild, no network at build) | determinism | correctness |
| 12 | **Cross-family, order-swapped LLM-judge advisory score — advisory only, never a gate** | a weak prior | anything gated (all measured biases apply) |

---

## PART 4 — Concrete recommendation set for RapidTool

Map each signal onto the repo's real seams (so this is actionable, not aspirational):

1. **Signal 2 must become the product's centre of gravity.** Today the emitted
   `tests/oracle.spec.ts` asserts the pipeline's own spec and the repo's README admits
   *"identifier presence is a proxy, never behavioral proof"*. Fix = `104` **T3.1/T3.2**
   (wire the G5 gate; derive behavioural cases from the brief, grader withheld).
2. **Signal 9 is the cheapest high-value addition** — an oracle-strength audit
   (assert-expected vs assert-observed classification) directly attacks the `2410.21136`
   failure mode. Add it to `verify.server.ts` next to the existing oracle cases.
3. **Signal 10 is nearly free and Holmzann-sanctioned** — grep the emitted tree for empty
   `catch`, unchecked non-void returns, unhandled rejections. Wire into `compile-check.server.ts`.
4. **Signals 1/3/4/5 are extensions of gates that already exist** — keep them pinned and
   scoped to *new* code (Sonar's fudge-factor logic is a good precedent), and never let a
   green lint be presented as correctness.
5. **Signal 8 (mutation) is optional and must be labelled as test-strength.** Do not ship it
   as a quality score.
6. **Signal 12 must be advisory-only and cross-family.** `103` P6/lane-101's adapter work
   (T1.5) makes cross-family judging possible for the first time — that is its real value.
7. **Do not assert a Sonar "15" cognitive-complexity threshold** — it was not in the fetched
   source. If a threshold is wanted, derive it internally and label it as a project choice.
8. **The `104` T0.* tasks (model tier + stale claims) matter here too**: a judge that cannot
   be trusted + a generator on the weaker tier is the worst combination for signals 1–3.

---

## PART 5 — UNVERIFIED / do-not-cite (disclosed in full)

**Dead or blocked URLs (do not present as citations):**
`iso.org/standard/78176.html` 403 · `openai.com/…swe-bench-verified` 403 (used Wayback) ·
`cacm.acm.org` 403 (used Wayback) · `owasp.org/www-project-application-security-verification-standard/`
**404** (used raw GitHub README) · `martinfowler.com/bliki/CyclomaticComplexity.html` **404** ·
`lars-lab.jpl.nasa.gov` JPL C standard timed out · Wikipedia `…/Test_oracle_problem` **404** ·
`sback.it` and `zora.uzh.ch` MCR PDFs blocked.

**Claims explicitly NOT verified — never quote these numbers:**
- Google's *"Modern Code Review: A Case Study at Google"* — **UNVERIFIED**.
- Coverity *"A few billion lines of code later"* — Wayback returned a 5,250-byte JS shell with
  no article — **UNVERIFIED**.
- arXiv **2507.19721** — title/abstract **mismatch** in what was fetched — **do not cite**.
- Sonar cognitive-complexity **"15 threshold"** — not present in the fetched PDF.
- A Coplien/Schachaf "Clean Code critique" paper — **does not appear to exist**.

**Parent-added caveat.** Part 2's bias literature was fetched by the lane; the *mapping* of
those findings onto RapidTool's seams (§4) is the parent's synthesis and is a design argument,
not a fetched fact.
