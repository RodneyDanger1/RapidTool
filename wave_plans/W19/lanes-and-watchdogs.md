# W19 · LANES 1–6 + WD-α (quality) + WD-β (ERROR LEDGER v2) — same shape as W18, disjoint boxes

**All readers share this file.** Read your own section FIRST. Repo: `C:\Users\mnril\Desktop\RapidTool Main`
(Node v22.23.2; git-bash `/c/Users/mnril/Desktop/RapidTool Main`; SPACE in path → ripgrep FAILS, use `grep`).

```text
TREE: committed at 8e25180 (clean). W18's late landings sit uncommitted on top and OWN these files —
DO NOT TOUCH: src/lib/doctor.ts + dod.ts (W18-L1) · src/lib/knowledge.ts + the lesson arm of
scripts/rapidtool-cli.mjs (W18-L2) · src/lib/git.server.ts (W18-L3) · src/lib/plugin.ts (W18-L4) ·
src/lib/io.ts + codegen.server.ts provenance (W18-L5) · research/multiagent/249_define_first_specs.md (L6).
KNOWN ERRORS (from the ledger, do not re-chase): src/lib/git.server.ts carried 3 typecheck errors +
1 lint error from W18-L3's in-flight work (measured at the W18 14:16 boundary: unregistered
RT_E_GIT_UNAVAILABLE at :703 · type mismatches at :763 and :152; later two more TS2554 sites at :953/:1112) —
ALL RESOLVED since [corrected W22-L1 · ledger #62]: #53–#55 fixed by W18-L3, #52 + the :953/:1112 pair
cleared in W22-L1 (ledger v3 §W22-L1 markers). W18's lanes owned them. Your targeted tests may see OTHER
lanes' transients — log `[EXT-FAIL]` + CONTINUE.

⚠️ HOST ARTIFACT: node under Hermes's BACKGROUND harness dies `stdin is not a tty` (exit 1, zero output).
Run node tests FOREGROUND; that message is never a bug (ledger: C:/Users/mnril/w15_parent_evidence.txt).

QUALITY BAR (owner): production-ready, no stubs/mocks/fake returns; a test that would pass with your
change reverted is a finding. Every claim = the command that produced it. Do-not-rebuild list (§2 of
220_tasklist_canonical.md) BINDING; house style: no eslint-disable. WRITE EARLY: skeleton + bottom line
within ~10 calls (`fixes/252_lane<N>_<slug>.md`). FORBIDDEN: `npm run typecheck`, `npm test`,
`npm run build` (parent/boundary only). Scratch: `C:/Users/mnril/w19l<N>_scratch/`. Row how-tos:
research/multiagent/230_task_execution_playbook.md (now with 241's strengthened verifications folded).
```

## LANE 1 — OV-13 + OV-29 · silent-degrade rows: a keyed failure must not read like a keyless run
**Owns:** `src/lib/headless.ts` (the :208/:231 failure-row region + the silent-skip region), `src/lib/engine.ts`
(the :3010-3012/:3028-3030 catch sites), `src/lib/lesson-writers.test.ts` region if OV-13's G2 pin lives there.
Read the playbook's OV-13 block + 241's strengthened command for it (G2 pin recipe at `lesson-writers.test.ts:327-408`).
A failure that degrades silently must leave a coded, visible row; OV-29's `headless.ts:208/:231` pair (`:231`
is the real keyed-reads-keyless case) folds into the same shape. **Do not** touch the summary-envelope region
(TASK-01's, committed) or the journey/repair seams (C-1's, committed).
**Done-when:** the G2-style pin proves a keyed failure row differs from a keyless one; targeted
`headless.test.ts` (92/92 base) + `lesson-writers.test.ts` green; both sites named in your log with their lines.

## LANE 2 — F4 · per-action allow-lists (the autonomy boundary)
**Owns:** `src/lib/policy.ts` (+ test), `src/components/console.tsx` (the approval/seat region ONLY — do NOT
touch the ScorecardBlock/packet panels, W16 owns them).
Read 221's F4 design + 224's "cheapest high value" note (the seam exists at `policy.ts:170` and is already
action-shaped). Narrow the allow-list to per-ACTION granularity with a coded refusal naming the action; the
console surfaces it. Engineering-first: no widening of any default.
**Done-when:** a test proves an off-list action is refused with its own code (never a generic error) and an
on-list action passes; the console change renders (re-read your render path); targeted suites green.

## LANE 3 — T5.1 · streaming output (transport spike first)
**Owns:** `src/lib/chat.ts` (+ test), NEW `scripts/chat-stream.test.mjs` (or equivalent NDJSON leg).
Read the playbook's T5.1 block. Spike the transport FIRST (can the existing seam emit incremental NDJSON
without a new dependency?), write the spike result in your log, then implement only what the spike proves.
Tension noted in 229 §4.4: this is NOT a competitive-gap chase — it's the row's plain scope (a beginner-visible
improvement). Never fabricate a stream in tests; assert on real emitted chunks.
**Done-when:** the spike's verdict is in the log; the streaming leg has a real test asserting ≥2 ordered
chunks with a coded terminal error path; `chat.test.ts` green.

## LANE 4 — OV-7 · eval-corpus expansion + grader-freeze audit
**Owns:** `scripts/run-eval.mjs` (corpus/grader loading ONLY — the drain/stop logic is committed, do not
re-touch it), the graders/ folder (read all, edit only where the freeze audit demands), `scripts/run-eval.test.mjs`.
Read the playbook's OV-7 block + 235's verification. Expand the corpus so M7 is measurable across ≥2 domains;
audit the graders for the freeze property (a grader that can be edited mid-run invalidates the score) and for
leak-scans. **Done-when:** `npm run eval -- --trials=2` (keyless) shows the ≥2-domain corpus; the grader-freeze
check passes with its evidence pasted; run-eval.test.mjs stays green.

## LANE 5 — F2 · provider breadth step 2 (the growth lever)
**Owns:** `src/lib/llm/providers/registry.ts` (+ `registry.test.ts`), the provider modules under
`src/lib/llm/providers/` — additive only.
Read 221's F2 design + OV-1's row (its env-selection half is a SEPARATE later lane — do not implement it).
Add a second, live-verified provider family behind the SAME interface. NEVER hardcode an unprobed vendor id
(the live docs are the only source of truth; probe before naming). Keep the existing DeepSeek path byte-identical
in behaviour (its thinking pins are committed — do not disturb them).
**Done-when:** the new family resolves through the registry with a test pinning its id/endpoints from the
probe evidence; the DeepSeek suites stay green (registry 29/29 + llm 14/14); the probe's raw output is pasted.

## LANE 6 — T5.7 · deterministic LLM cassette (record/replay)
**Owns:** NEW `src/lib/cassette.ts` (+ `cassette.test.ts`). Consume T5.4's provenance fields (W18-L5 names
them in `fixes/249_lane5_t54.md` — read it; if it hasn't landed, design against the field NAMES it declares
and say so).
A cassette MISS must be a **coded refusal** (`RT_E_*`), never fabricated text. Round-trip + hash-key + miss
paths all pinned. Keyless `npm run eval` stays byte-identical when a cassette is present.
**Done-when:** round-trip, hash-key, and miss-refusal tests green; the eval-stability claim has its command.

---

## WD-α — quality watchdog (`fixes/253_w19_wd_alpha.md`)
READ-ONLY (report + `C:/Users/mnril/w19wd_a_scratch/`; no repo edits; no git mutations; ≤2 FOREGROUND runs).
Poll all six lanes ≥4 times (timestamped action log); ≥10 claim-vs-bytes checks with box enforcement (any
out-of-box or W18-file touch = P1); one named test re-run per lane (≤2 total); no-mock/no-stub hunt;
on-track/at-risk/stuck verdict + next-dispatch guidance. Bottom line at top.

## WD-β — ERROR LEDGER v2 (`fixes/254_error_ledger_v2.md`)
READ-ONLY (ledger + `C:/Users/mnril/w19wd_b_scratch/`; no repo edits; ≤2 FOREGROUND runs).
**Continue `fixes/251_error_ledger.md` as v2 — never rewrite v1; append and supersede only by marking.**
New obligations: (1) add every W18 finding: the git.server.ts typecheck errors (2) + lint error (1) with
their exact TS codes and owner (W18-L3); W18's lanes' `[EXT-FAIL]` entries when they land; WD-α's incidents.
(2) Re-run the two living diagnostics: `node --experimental-strip-types --test --test-concurrency=2
src/lib/headless.test.ts` (expect 92/92) and `npm run lint`. (3) Keep the master totals + the batch-fix ORDER
(real regressions → precision items → cosmetics) and add a 'ready-to-fix-now' shortlist: every OPEN row whose
owner has landed and whose files are uncommitted-but-stable. Bottom line: `total errors: N · open: N · fixed:
N · env-artifact: N · ready-to-fix-now: N` + the ordered shortlist.
