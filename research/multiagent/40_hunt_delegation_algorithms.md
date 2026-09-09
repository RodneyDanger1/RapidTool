# 40 — Bug Hunt: AI-Agent Delegation + Algorithms (H3)

**Scope:** `src/lib/crew.server.ts`, `swarm.ts`, `planning.ts`, `wild-mode.server.ts`, `chat.server.ts`, `algorithms.ts`, `vault.ts` (vault search), `knowledge.ts`, `bench.ts`, `ast-mine.ts`.
**Method:** read-only deep read + execution probes via `node --experimental-strip-types` against the real modules (repo `node_modules`). All probes were scratch files in the repo root and were deleted after each run; only pre-existing `probe-r5-*` / `probe*.test.ts` files remain.
**Date:** 2026-09-06. Line numbers refer to current working tree.

**Findings: 1 × P1, 11 × P2, 4 × P3. Clean bill (verified): planning.ts core, backtrack, crew retry discipline, chat.server.ts.** Every finding below was reproduced with real module execution unless marked [by-reading] (pure control-flow facts).

---

## P1 — Wild Mode classifier: verdict parse reads the FIRST marker — a false-approve / false-reject vector

- **File:** `src/lib/wild-mode.server.ts:116-129` (`parseWildReview`), driven from `:159-166`.
- **Bug:** The parser takes the **first** `VERDICT\s*:\s*(approve|reject)` and the **first** `FEEDBACK\s*:` anywhere in the model reply. The review prompt embeds untrusted project text (brief, artifacts, unmet criteria — `:77-109`), and the classifier prompt itself prints `VERDICT: approve|reject\nFEEDBACK: …` (`:73-74`). Any reply that *echoes the requested format* or *quotes artifact content before its real verdict* is parsed as the echoed/quoted verdict; the model's actual final verdict is ignored. Because `approve` is a prefix of the format token `approve|reject`, even the honest "I will reply VERDICT: approve|reject …" format echo parses as **approve**.
- **Reproduction (probe output, real `parseWildReview`):**
  - `"Format: VERDICT: approve|reject then FEEDBACK: your critique.\nMy assessment:\nVERDICT: reject\nFEEDBACK: The schema module is missing entirely …"` → `{verdict:"approve", feedback:"your critique.\nMy assessment:\nVERDICT: reject\nFEEDBACK: …"}` (model explicitly rejected; gate records approve).
  - `"The artifact literally says: \"VERDICT: approve\" but that is the agent's self-claim.\nVERDICT: reject\nFEEDBACK: Deliverables are vague; …"` → `{verdict:"approve", …}`.
- **Impact:** Wrong `approve` (or wrong `reject`) recorded by the Auto-Review Supervisor in Wild Mode. A false approve is the dangerous direction: the loop can leave a phase / clear an approval gate on a verdict the model never gave. Feedback is also polluted (starts mid-template), weakening the 12-char honesty log.
- **Fix spec:** (1) collect all `VERDICT\s*:\s*(approve|reject)` matches and drop any whose matched token is followed by `|` or `\w` (kills the `approve|reject` template token); (2) of the survivors take the **last** one that has a `FEEDBACK\s*:` marker after it; (3) feedback = text after that FEEDBACK marker; (4) keep the ≥12-char floor on the winning feedback. Add regression tests for format-echo and quoted-content replies.

---

## P2 findings

### P2-1 — Swarm SecOps scan silently truncates at 8000 chars, then reports "clean"
- **File:** `src/lib/swarm.ts:292-306` — `scanForMarkers`, truncation at `:296` (`text.length > 8000 ? text.slice(0, 8000) : text`). The "clean" info note is at `:425-429`.
- **Bug:** The sources are concatenated as `brief + notes + openapi + every artifact title+body` (`:417-422`) and then the whole string is cut to the first 8000 chars. Secrets living past char 8000 — which, given the join order, is where the **artifact bodies** always sit once brief+notes+openapi are long — are never scanned, yet the seat emits "pattern scan clean across brief/notes/openapi/edge artifacts" when nothing matched.
- **Reproduction (probe):** brief = 4000 × "x", notes = 4000 × "y", artifact body ending in `sk-ABCDEFGHIJKLMNOPQRSTUVWX` → `scanForMarkers(...)` = `[]`; the same secret scanned alone → `[{severity:"block", …}]`.
- **Impact:** SecOps-sentinel verdict `keep` + "scan clean" artifact on a project whose code artifacts carry a live secret — exactly the case the seat exists to catch (advisory, but it feeds swarm verdict/refinedPlan).
- **Fix spec:** scan each field separately (per-artifact) with the 8000-char cap applied per field, or drop the cap and bound the *join*; when truncation occurs, emit a warn finding "scan truncated at N chars — tail not scanned" instead of the clean note.

### P2-2 — Swarm marker regexes: case-blindness misses real secrets, env-read patterns false-positive
- **File:** `src/lib/swarm.ts:280` (inline-secret rule, no `/i`), `:274` (secret-key), `:286` (phi).
- **Bug:** `api[_-]?key|passw[o0]rd|auth[_-]?token|access[_-]?token` is case-sensitive, so the canonical env-file forms are missed, while benign env-read assignments match.
- **Reproduction (probe):** `scanForMarkers("API_KEY=abc123def456ghi789")` → `[]` (miss), but `scanForMarkers("api_key=abc123def456ghi789")` → `[{severity:"warn", …}]`, and `scanForMarkers("const secret = process.env.SECRET;")` → warn FP (that is the *safe* idiom). Also `scanForMarkers("example AKIAIOSFODNN7EXAMPLE")` — the AWS docs sample key — → `block`.
- **Impact:** warn/block findings (and whole-phase `revise` verdicts via `verdictOf` `:377-381`) fire on ordinary code, while the all-caps secrets the seat claims to catch sail through.
- **Fix spec:** add `/i` and add a negative guard for the env-read idiom: require the value to not begin with `process.env` / `process\.env` / `${...}`, and skip matches inside double-quoted doc examples only by keeping severity "warn" and rewording the note. Add tests for `API_KEY=` and `secret = process.env.X`.

### P2-3 — runCrew cumulative cost guard fires one turn late (up to ~+60% over the cap)
- **File:** `src/lib/crew.server.ts:724-727` (default mode), `:872-875` (plan-act). Guard compares `session.promptTokens + session.completionTokens > maxTotalTokens` **before** a turn, so a turn whose own prompt+completion (~up to 16k + 8k tokens) pushes total spend far past `maxTotalTokens` is still dispatched; the stop only takes effect for the *next* turn.
- **Reproduction (probe, stub usage 20,000 tokens/turn, `maxTotalTokens: 25_000`):** 2 role turns executed, `stopped: "cost-limit"`, total spend **40,000 vs a 25,000 cap (60% over)**. With defaults (60k cap, 24k max turn) worst case ≈ 84k.
- **Impact:** documented "Cumulative cost guard" (`:637-638`) does not bound spend; Wild Mode / headless runs can overrun budgets by a full turn.
- **Fix spec:** after building the prompt and before dispatch, stop when `session.promptTokens + session.completionTokens + estimateTokens(prompt).tokensHi + spec.budgetTokens > maxTotalTokens` (report `cost-limit`); keep the existing check as a second net. Same fix at both loop sites.

### P2-4 — Grounding + step-directive appended AFTER the token-budget enforcement (measured guard bypassed)
- **File:** `src/lib/crew.server.ts:733-751` (default mode) and `:880-900` (plan-act: grounding **and** `stepDirective` at `:900`). `buildAgentContext` enforces `maxPromptTokens` (`:330`, `enforceTokenBudget` `:211-226`), but the researcher grounding section (`formatGrounding`, up to 5 items × ~560 chars + header ≈ 0.7-0.9k tokens) and the step directive are concatenated **after** that enforcement, unmeasured.
- **Impact:** the documented invariant "the final prompt is measured against maxPromptTokens and enforced" (`:207-210`) is false by up to ~1k tokens per researcher/plan-act turn; context can drift over budget without any marked cut.
- **Fix spec:** move `enforceTokenBudget` to cover the final assembled prompt (grounding + directive included), or pass a headroom-reduced budget into `buildAgentContext` and enforce once more after the appends.

### P2-5 — parseAgentOutput: JSON envelope preceded by one line of prose silently discards the structured payload
- **File:** `src/lib/crew.server.ts:446-447` — JSON branch is gated on `cleaned.startsWith("{")`; a reply like `"ok, here is the envelope\n{...}"` falls through to the markdown splitter, which keeps the whole blob as `content` and produces **no artifacts** (JSON roles' entities/endpoints/verdicts are lost).
- **Reproduction (probe):** `parseAgentOutput("architect", 'ok here is the envelope\n{"type":"design","content":"hi","artifacts":[{"title":"E","body":"b"}]}')` → `{role:"architect", type:"design", content:"ok here is the envelope\n{…full JSON…}"}` — no `artifacts`, envelope unparsed.
- **Impact:** reviewer/architect/tester JSON deliverables (PASS/FAIL verdict artifacts, contracts) silently vanish from the transcript whenever the model adds a one-line preface — a realistic flash-tier behavior. (Content is kept, so honesty holds, but the structured product is lost.)
- **Fix spec:** attempt JSON parse on the substring from the first `{` when the trimmed reply does not start with `{` but contains `{\n`… — bounded: try `JSON.parse(text.slice(text.indexOf("{")))` on the *tail from the first `{` to the last `}`* when that tail round-trips; keep current behavior otherwise. Add a regression test for prefixed envelopes.

### P2-6 — Hyphenated lexicon terms are unreachable from spaced prose (intentLattice misses "same day" / "follow up" briefs)
- **File:** `src/lib/algorithms.ts:133-142` (`phraseHits`) over lexicon entries `:61` (`follow-up`), `:83` (`same-day`), `:88` (`air-gapped`), `:89` (`on-prem`), `:92` (`multi-tenant`), `:108` (`rate-limit`). `tokenizeWords` keeps hyphenated compounds as one token (`algorithms.test.ts:114-116` pins this), so a vocab term `same-day` only matches text containing the literal token `same-day`; prose `same day` tokenizes to `same`, `day` and never matches.
- **Reproduction (probe):**
  - `intentLattice("same day dispatch to drivers", "logistics").constraints` → `[]`; with `"same-day dispatch…"` → `["same-day"]`.
  - `intentLattice("follow up on tickets", …).jobs` → `["deliver-core-workflow"]` (fallback fires, vague stays false) vs `"follow-up on tickets"` → `["follow-up"]`.
- **Impact:** constraints/jobs silently undetected depending on the user's hyphenation; a "same day" delivery app gets no same-day constraint and no scheduler/HITL consequence.
- **Fix spec:** in `phraseHits`, build the text set from word-boundary tokens **plus** each hyphenated token's `+/-`-split word parts, and tokenize multi-word/hyphenated vocab terms the same way (component words), i.e., match on stemmed word components instead of raw compound tokens. Keep `tokenizeWords` output as-is (pinned); only the matcher changes.

### P2-7 — Stemmer asymmetry: 4-letter "-e" words never match their -ing/-s forms ("code" ⇎ "coding", "make" ⇎ "making")
- **File:** `src/lib/algorithms.ts:748-763` (`stemToken`; e-drop guard `w.length > 4` at `:752`), consumed by vault search `src/lib/vault.ts:645-647` (`tokenMatch`), `:628-636` (canonicalStem fixed-point — cannot fix a genuine divergence), and by `fusionRank` overlap (`algorithms.ts:224-253`).
- **Bug:** `code` (4 chars) never drops the `e` → stem `code`; `codes`/`coding` → `cod`. The fixed-point canonicalization (`vault.ts:628-636`) iterates to a fixed point on each side and therefore cannot unify them. `tokenMatch` (equality or q-prefix-of-c) is then **asymmetric**: query `coding` (stem `cod`) prefix-matches note text `code`, but query `code` does **not** match a note containing only `coding`/`codes`. Words ≥5 chars are fine (`route`/`routing` → `rout`).
- **Reproduction (probe):** `stemToken("code")="code"`, `stemToken("codes")="cod"`, `stemToken("coding")="cod"`; `tokenMatch(stem("code"), stem("coding"))` → `false`, reverse → `true`. `stemToken("make")="make"` vs `stemToken("making")="mak"`. fusionRank `overlap("code", "coding standards")` → 0 (exact-set compare, no prefix).
- **Impact:** vault search and memory ranking miss documents depending on which side of the inflection the query is on; "code" queries silently return fewer results than "coding" queries.
- **Fix spec:** drop the `w.length > 4` guard for the e-drop (allow `code`→`cod`, keeping the `w.length - 1 >= 3` invariant already enforced by the return clause `:762`), i.e. mirror the suffix-strip rule: e-drop when `w.length > 3 && !w.endsWith("le")`. Update pinned tests (`algorithms.test.ts:110` etc.) and add vault search regression tests for `code`/`coding`/`codes`.

### P2-8 — bench complexityScore counts optional-chaining / optional-param / regex "?" as ternaries (verified 6 vs 1)
- **File:** `src/lib/bench.ts:338-343` — a `?` is counted as ternary unless preceded by `?`/`.` or followed by `?`; TS optional chaining `a?.b`, optional call, optional params `a?: string`, and regex quantifiers all pass those guards.
- **Reproduction (probe):** a 7-line TS snippet with exactly **1 real ternary** (`x ? y : z`) plus `a?: string`, `obj?.name`, `arr?.[0]`, `a?.b?.c` → `ternaryCount: 6`. (Strings/comments are pre-scrubbed, so this is pure code noise.)
- **Impact:** complexity score inflates systematically on idiomatic TS (score `:356-357` feeds complexity level and the estimate band). Honesty label says "heuristic", but the signal is near-meaningless for modern TS.
- **Fix spec:** only count `?` when it is a genuine ternary: require the next non-space char to be neither `.`, `?`, `:`, `(`, `[` nor `,` (kills `?.`, `??`, `?:` param marker, `?(`/`?[`), or switch to a lightweight balance check (`cond ? a : b`). Add a regression test with the snippet above.

### P2-9 — ast-mine brace counter is corrupted by braces inside comments/strings → phantom methods AND missed methods
- **File:** `src/lib/ast-mine.ts:129-139` (`delta` per-line brace count, no string/comment awareness), method harvesting `:317-326`, scope close `:328-332`.
- **Bug A (phantom methods):** a comment/string line with an unmatched `{` (e.g. `// regex: /\{/` or a template literal containing `{` alone) leaves `braceDepth > typeBase` forever, so every later top-level `name(`-style line inside `{…}` is harvested as a class method.
- **Reproduction (probe):** file = `class A { // … /\{/ … m() {} }` followed by `describe("suite", function () { it("deep", function () {}); });` → `functions` = `[m(method), describe(method), it(method)]` — `describe`/`it` are free test declarations, not methods of A.
- **Bug B (missed methods):** a comment line containing `}` (e.g. `// } of previous block`) closes the scope early; real methods after it are dropped. Probe: `class A { // } fake close\n  m() { return 1; }\n}` + `export function realFn(){}` → `functions` = `[realFn]` only — `m()` is missing from the inventory.
- **Impact:** mined function inventory and conventions (`conventionsMap`) are wrong on ordinary files with brace-ish comments/strings; advisory, but the map is the product of the miner.
- **Fix spec:** track string/comment state while counting braces (a small quote-aware line walker, or reuse the scrubber approach of `bench.ts:96-150` `stripStringsAndComments` and count `{`/`}` only on the scrubbed text — it keeps 1:1 line mapping, so per-line deltas still work).

### P2-10 — KnowledgeStore dedupes by a 32-bit FNV-1a id — hash collisions silently drop distinct entries as "duplicates"
- **File:** `src/lib/knowledge.ts:166-182` — `id = "K" + fnv1a(fingerprint).toString(16).padStart(8, "0")` (`:168`), idempotency check `entries.find((e) => e.id === id)` (`:169-170`) — the full fingerprint (`:111-120`) is never compared.
- **Bug:** a 32-bit id space means two *different* entries can share an id; the second `savePattern` then returns `{entry: <first entry>, appended: false}` and the new entry is **permanently lost** while reporting the idempotent no-op lie. Birthday bound: ~10k rows ≈ 1.2% cumulative collision chance; probe found a real collision among 400k synthetic fingerprints (`entry-179599-…` == `entry-362382-…`).
- **Impact:** append-only store loses data silently; `injectProven`/`findPatterns` return the wrong row for that id.
- **Fix spec:** dedupe on the full fingerprint string (store a `fingerprint` field or compare the canonical string), keep the short id only for display/keys; if 8-hex ids must stay, widen to two independent FNV passes (64-bit) — still compare fingerprints for correctness.

### P2-11 — Wild Mode: 12-char feedback floor accepts rubber-stamp approvals; distinct "too short" error is dead code
- **File:** `src/lib/wild-mode.server.ts:73-74` (system prompt demands "3+ sentences"), `:127` + `:34` (12-char floor), `:167-174` (second floor check — unreachable because `parseWildReview` already returns null below 12 chars at `:127`, so the `feedback too short` error at `:169-173` can never fire; callers always get the misleading "unparseable verdict payload" error instead).
- **Reproduction (probe):** `parseWildReview("VERDICT: approve\nFEEDBACK: It looks good.")` (13 chars, one sentence, zero substance) → `{verdict:"approve", feedback:"It looks good."}` — accepted and loggable. `"…FEEDBACK: ok fine"` (< 12) → `null` (floor works, but error path mislabels it).
- **Impact:** the honesty floor does not enforce its own system-prompt contract; a one-sentence rubber stamp passes as a review.
- **Fix spec:** enforce a structural floor matching the system prompt — require the feedback to contain ≥ 2 sentence-ending punctuation marks (`.!?`) or ≥ 3 whitespace-separated words beyond 12 chars, and delete the dead branch (or move the length check before `parseWildReview` so the specific error surfaces).

### P2-12 — health-ops mandated hipaa/phi nodes are pushed after the 18-node slice and silently dropped on crowded briefs
- **File:** `src/lib/algorithms.ts:170-175` (push after the sort) + `:188` (`unique.slice(0, 18)`). The push happens after sorting and the node cap slices the tail, so on briefs that already produced 18 nodes the forced `hipaa`/`phi` nodes disappear from `lattice.nodes` while `lattice.constraints` (computed from the full list at `:176-178`) still contains `hipaa`.
- **Reproduction (probe):** a vocab-rich health-ops brief → `nodes.length = 18`, `hasHipaaNode: false`, `hasPhiNode: false`, yet `constraints: ["same-day","offline","audit","realtime","hipaa"]`. The comment's promise that health-ops briefs carry hipaa/phi nodes (`:170`) breaks exactly when the brief is biggest.
- **Impact:** node consumers (packet/UI) don't see the mandated constraint markers; constraints-derived consumers disagree with node-derived consumers about the same lattice.
- **Fix spec:** insert the forced nodes *before* the slice and re-sort, or reserve 2 slots: push first, then `unique.sort(...)`, then slice; add a property test that health-ops lattices always include hipaa/phi in `nodes` regardless of vocabulary size.

---

## P3 findings

- **P3-1** `src/lib/algorithms.ts:705-726` — `estimateTokens` memoizes on a 32-bit `fnv1a` key with no collision check; a colliding pair returns the wrong token estimate (affects budget enforcement at the margins). Collision odds are tiny inside the 100-entry LRU (probe needed 400k strings to force one); widen the key or store a short text prefix with the value.
- **P3-2** `src/lib/algorithms.ts:588-589` vs `:594` — the recalibration comment claims "sec/api widen downward via their scheduler Δs", but `sec = 7 + securityDelta*1.5` (upward). Tests pin the upward behavior (`algorithms.test.ts:425-437` requires a health-ops Δ3 brief to reach overall ≥ 7.5), so the code is intended and the comment is stale — but note the axis is inverted relative to the api axis (`:595`) for the same risk class, which inflates the overall of high-risk briefs (health-ops Δ3 → sec 10).
- **P3-3** `src/lib/crew.server.ts:380-392` vs `:466-479` — JSON-path artifacts with an empty `body` are kept (`parseArtifacts` only requires a title), while the markdown path drops empty-body sections (`:474-476`); a JSON reply with `{"title":"T","body":""}` yields an empty artifact that downstream report intake will carry.
- **P3-4** `src/lib/knowledge.ts:141-162` — a corrupt store file makes `entries()`/`findPatterns` **throw** (documented "refuse" contract in the header `:12-15`, so behavior is intended); any UI/server caller that does not catch the throw will surface a 500 instead of an empty result. Consider a typed `{ok:false, reason:"corrupt-store"}` return alongside the throw for server-fn surfaces.

---

## Clean bill (probed, no verified bugs)

- **planning.ts** — retry discipline verified: garbage reply → exactly 1 bounded re-prompt → honest `ok:false` on second failure (`planSteps` probe: 2 calls, ok:true on valid retry). `normalizePlanSteps` id fallback is collision-safe (`step-N` / `step-N-k`), caps respected. `backtrack` purity verified: input plan deep-copied, `failedStep`/`rewound` correct, unknown id is a copy no-op.
- **crew.server.ts roles/loop bounds** — `resolveRolesOverride` rejects unknown roles with an honest error before dispatch; role sequences and `maxSteps` clamping verified by reading and by the existing suite; the plan-act reflection dispatch past `maxSteps` (executed steps + 1 reflect call) is **intended and pinned** (`crew.test.ts:245-262` counts it via role filter).
- **chat.server.ts** — `buildChatContext` is null-safe and deterministic; the F4 gate-honesty logic, memory staleness demotion, and bounded history all read correct. No verified bug (strongest candidates — gate-present `awaiting_hitl` records, hostile-phase sorting — are either unreachable through `hydrateProject` or harmless).
- **bench.ts empty project / div-by-zero** — none: `estimateTokenCost({})`, `projectedTime({})`, `complexityScore({})` all return clean 0 estimates (no NaN, no division by zero).
- **knowledge.ts empty store** — `findPatterns` on an empty store returns `[]` (`:200`).
- **fusionRank** — deterministic, tie-stable (stable sort keeps input order), every id once; kind-normalized rrf behaves as documented.

## Quick fix-priority summary

| ID | Sev | File:line | One-liner |
|---|---|---|---|
| P1-1 | P1 | wild-mode.server.ts:119-128 | parse FIRST verdict marker → false approve/reject from format echoes / quoted content |
| P2-1 | P2 | swarm.ts:296 | 8k scan truncation + false "clean" note |
| P2-2 | P2 | swarm.ts:280 | marker regex case-blindness + env-read FP |
| P2-3 | P2 | crew.server.ts:724-727, 872-875 | cost guard fires one turn late (60% over cap in probe) |
| P2-4 | P2 | crew.server.ts:733-751, 880-900 | grounding/directive appended after token-budget enforcement |
| P2-5 | P2 | crew.server.ts:446-447 | prose-prefixed JSON envelopes lose structured artifacts |
| P2-6 | P2 | algorithms.ts:133-142 | "same day"/"follow up" prose never matches hyphenated lexicon terms |
| P2-7 | P2 | algorithms.ts:752 / vault.ts:645-647 | 4-letter -e words never stem-match their -ing/-s forms (search asymmetry) |
| P2-8 | P2 | bench.ts:339-343 | `?.`/`?:`/`?[` counted as ternaries (6 vs 1 verified) |
| P2-9 | P2 | ast-mine.ts:129-139, 317-332 | comment/string braces corrupt class scope → phantom + missed methods |
| P2-10 | P2 | knowledge.ts:168-170 | 32-bit-hash id dedupe silently loses colliding distinct entries |
| P2-11 | P2 | wild-mode.server.ts:127, 167-174 | 12-char floor accepts "It looks good."; distinct short-feedback error is dead code |
| P2-12 | P2 | algorithms.ts:170-188 | health-ops hipaa/phi push dropped by 18-node slice on crowded briefs |
| P3-1..4 | P3 | algorithms.ts:705-726; :588-594; crew.server.ts:380-392; knowledge.ts:141-162 | cache-key collision; stale/inverted sec comment; JSON empty-body artifacts; corrupt-store throw contract |
