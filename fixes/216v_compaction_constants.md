# 216v — Compaction constants + SUMMARY_TEMPLATE (W7 · LANE 2 · T-107.9) — COMPLETE

**Status:** COMPLETE. Module + tests landed by W7-L2, parent-repaired at the W7 boundary; this body
was written by **W8-L2** (2026-09-17) with a **fresh verification run made this session** — the
numbers in §4 are that run's real output. Run log kept at `C:\Users\mnril\_w8l2\`.

**Mission.** Dossier 107 **T-107.9** (`107_competitors_agentic.md:334`): adopt the compaction
constants + `SUMMARY_TEMPLATE` from "the most copyable compaction spec in this study" (§9
runner-ups, `:165/:307` — `session/compaction.ts:13-30`: `DEFAULT_BUFFER = 20_000`,
`DEFAULT_KEEP_TOKENS = 8_000`, `TOOL_OUTPUT_MAX_CHARS = 2_000`, `SUMMARY_OUTPUT_TOKENS = 4_096` +
the fixed section-ordered template), plus the study's best pattern (§4, `:113` / `:243-245`):
**verify a compaction by EFFECT** — `"compacted" | "no_change" | "timeout"`, where *"No event in
time means the compaction never landed — a failure, not a 'nothing to compact' no-op."*

**Owned files:**
- `src/lib/compaction.ts` — NEW (pure leaf: constants + template + render/trigger/savings/outcome/clamp)
- `src/lib/compaction.test.ts` — NEW (6 describe blocks / 19 tests)
- `fixes/216v_compaction_constants.md` (THIS file — §3 is the wired-point/deferral decision the
  module header cites)

## 1. Work log (append-only)

1. **W7-L2 RECON** — `wave_plans/W7/lane-2.md`; dossier 107 T-107.9 row + §9 runner-ups; 104 §E6;
   103 A5/A6 (phase-granular only, "no durable checkpoint layer"); `fixes/216n`. Conclusion: a
   small pure module + tests, no I/O.
2. **W7-L2 AUTHORED `src/lib/compaction.ts`** (10,572 bytes on disk) — `DEFAULT_BUFFER` :34,
   `DEFAULT_KEEP_TOKENS` :40, `TOOL_OUTPUT_MAX_CHARS` :47, `SUMMARY_OUTPUT_TOKENS` :54; frozen
   `SUMMARY_SECTIONS` :62 + `SUMMARY_PLACEHOLDERS` :73 + `SUMMARY_TEMPLATE` :88;
   `renderCompactionSummary` :141 (total; absent fields ⇒ `(none)`); `shouldCompact` :157 (buffer
   trigger); `tokensSaved` :176; `compactionOutcome` :190 (3-outcome, FAIL-CLOSED: no event ⇒
   `timeout`, never a fabricated `compacted`); `clampToolOutput` :220 (middle-truncate, marked +
   counted, cap-fitting two-pass layout). Doctrines in the header: PURE LEAF / TOTAL /
   DETERMINISTIC.
3. **W7-L2 AUTHORED `src/lib/compaction.test.ts`** (6 describes: spec values / render /
   shouldCompact / compactionOutcome / tokensSaved / clampToolOutput; 19 tests) — **NEVER RUN**
   before budget death; the lane flagged ONE bogus tautological assertion in the clamp test as
   known-bad and made no green claim. Module never typechecked that session.
4. **W7 PARENT BOUNDARY REPAIRS** (task board: *"parent fixed 2 assertions + impl guard → 19/19"*)
   — the two broken assertions replaced (old→new in §2) and the `promptTokens < 0` guard added to
   `shouldCompact` (`compaction.ts:163`). Verified **19/19** at the W7 boundary sweep (src
   1894/1894, +53 = compaction 19 + subagent 22 + mock 12).
5. **W8-L2 (this session):** fresh re-run — **19/19** (§4); this body + the §3 decision written.

## 2. Old→new string/behavior ledger (incl. the parent fixes)

| # | Where | Old | New | Why |
|---|---|---|---|---|
| 1 | `compaction.test.ts` — clamp test | `assert.equal(r.text.includes("M".repeat(50)), false)` — a pin that **could never pass**: the head slice (1,200 of the 2,000-char cap) legitimately eats 900 of the 5,000 M's, so a 50-M run survives by construction | `assert.equal(r.text.includes("M".repeat(1_000)), false, "the central bulk of the middle is really gone")` (+ the comment recording the old→new) — now names the real property: the CENTRAL BULK is gone (the test comment says it: *"no run of 1,000 M's can survive a 900-max head run"*; `compaction.test.ts:276`) | parent boundary fix (W7) — the old pin contradicted the head slice |
| 2 | `compaction.test.ts` — clamp accounting | a chained tautological arithmetic equality (lane-flagged as bogus — it compared an expression to itself) | real sums computed from the marker's index/length: `headShown + r.elidedChars + tailShown === r.originalChars` (`:285`), with teeth: *"a silent slice(0, cap) implementation has no marker and fails the includes() pin; a marker with a wrong count fails the equation"* | parent boundary fix (W7) — replaced with the real sum |
| 3 | `compaction.ts` — `shouldCompact` | negative `promptTokens` could flow through the buffer math | `if (promptTokens < 0) return false;` (`:163`) — total: non-positive/non-finite inputs never fire | parent boundary fix (W7) — the `[-5, 100]` garbage case in the suite pins it |
| 4 | constants + template | — | **verbatim** from the copied spec (values above) | adopt-as-specified; the module invents no thresholds the dossier doesn't state |
| 5 | no-op boundary (by design) | — | `compactionOutcome` reports `timeout` for "no event", NEVER `no_change` | the dossier's core honesty rule: never conflate "nothing needed doing" with "the thing did not happen" |

## 3. Wired point + deferral decision (referenced by the `src/lib/compaction.ts` header)

**The honest decision, stated plainly: no compaction site exists in `engine.ts` today, and this
wave deliberately did NOT invent one.**

- **Verified:** `grep -in compact src/lib/engine.ts` → **zero hits** (run this session). Dossier 107
  T-107.9 names `engine.ts` + `codegen.server.ts` as candidate sites; neither was wired. Creating a
  call site just to "use" the module would be a declare-or-strike violation — there is no pipeline
  segment today that computes a prompt-token estimate against a context window and could honestly
  fire the trigger.
- **Named consumers (deferred; no caller yet):**
  1. **the chat-history rollup — `168A-2`.** `store.ts` trims `chatLog` to 40 rows on every append
     (:675 doc comment; the quota-salvage path uses `RESCUE_CHAT_CAP` :726-727) with **no
     auto-compaction** — `fixes/162_master_execution_plan.md:1048-1049` records exactly this gap
     ("`chatLog` silently `.slice(-40)` drops old rows with no auto-compaction (168A-2) → add a
     compaction/summary step"). This is the natural first caller: `shouldCompact` decides, the
     rollup LLM call uses `SUMMARY_OUTPUT_TOKENS`, `renderCompactionSummary` formats, and
     `compactionOutcome` verifies by effect.
  2. **codegen's chunk-prompt assembly.** The P6 chunked-synthesis prompts are assembled per run;
     the module was briefed as L1-owned during W7, so touching codegen was out of scope this wave.
- **Decision & rationale:** ship the **vocabulary** (constants, template, outcome enum, counted
  clamp) now as a pure leaf so the competing study's most copyable spec is adopted, durable, and
  tested; **defer the wiring** until a real context-holding caller lands. The module makes no
  decisions about WHERE a context is compacted — callers own the pipeline — which is exactly why it
  can land safely ahead of its caller. Every future wiring hop is additive.
- **Plan correction (recorded for future lanes):** `wave_plans/W7/lane-2.md` step 4's verify command
  names `src/lib/engine.test.ts`, which **does not exist in this repo and never has** (confirmed by
  `find` + `git log --all` in W7-L2; the engine is covered by `store.test.ts` / `wild-step.test.ts` /
  `packet.test.ts` / `handoff.test.ts`). Do not chase that filename.

## 4. Real command output (W8-L2 re-run, 2026-09-17 — real paste from `C:\Users\mnril\_w8l2\`)

```text
$ node --experimental-strip-types --test src/lib/compaction.test.ts
exit=0
# tests 19
# suites 6
# pass 19
# fail 0
# skipped 0

$ npx tsc --noEmit
typecheck exit=0
error TS lines: 0
```

(6 describes / 19 tests: the adopted spec values · `renderCompactionSummary` ·
`shouldCompact` (buffer trigger, boundary belongs to the trigger) · `compactionOutcome`
(verify-the-effect: event+drop ⇒ `compacted`; event, no drop ⇒ `no_change`; no event ⇒ `timeout`) ·
`tokensSaved` · `clampToolOutput` (marked + counted elision; totality on garbage).)

## 5. Cross-file needs (NOT this lane's files)

- **`engine.ts` / codegen / the chat rollup** — the wiring points named in §3. No file changes were
  made (by design; docs-only for the W8-L2 body). When a consumer lands it must keep the module's
  doctrines intact (pure leaf — the suite pins total/deterministic behaviour; do not import `fs`,
  a clock, or `process.env` into it).
- Nothing else — the module has zero imports by construction.

## 6. Not done / deferred

- **No caller wired** (deliberate — §3): the module is green and tested, but no pipeline segment
  fires it yet. That is the recorded, honest state.
- **No engine/integration test** — there is nothing to integrate yet; the colocated suite (19/19)
  is the durable evidence.
- The W7 plan's `src/lib/engine.test.ts` reference is stale (recorded in §3 so it stops being
  chased).
