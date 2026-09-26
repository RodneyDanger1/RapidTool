# 262 — LANE 5 (W23): T5.3 the `eval` verb + T5.2-A the fixtures review surface

**Status:** landed (code-only wave; NO test/typecheck/build/lint runs — verification is a later boundary).
**Box:** `scripts/rapidtool-cli.mjs` (add `eval`; lesson/summary arms untouched), NEW `src/lib/scorecard.ts`,
`src/components/console.tsx` (fixtures-review region only, additive hunks).

## 1. T5.3 — the `eval` verb (read-only scorecard)

**Shape.** `node --experimental-strip-types scripts/rapidtool-cli.mjs eval [--dir <eval-out>] [--history <history.json>] [--slug <slug>]`

- **One JSON object on stdout** (schema_version/cmd/exit_code envelope from `respond()` — same as every verb).
- **Read-only**: no writes, no ledger rows, no `DEEPSEEK_API_KEY` touch, no network. It only `readFileSync`s
  `results.json` + `history.json` under `--dir` (default `research/eval-out` resolved against the CLI's own
  module location — the same anchor the driver import uses, so CWD does not matter).
- **Exit taxonomy** (scripts/README-cli.md §Agent contract):
  - `0` — scorecard read + printed (`ok: true`).
  - `1` — usage/validation class (`RT_E_VALIDATION`): missing/unreadable/malformed `results.json`, bad `--dir`.
  - No keyed path exists, so exits 3/4 are unreachable by design (4 only if the reader itself throws unexpectedly).

**Reader API (`src/lib/scorecard.ts`, NEW, pure + server-agnostic):**

| Export | Contract |
|---|---|
| `DEFAULT_EVAL_OUT_DIR` | `"research/eval-out"` — relative anchor; the CLI resolves it. |
| `readEvalResults(dir)` | → `{ ok, path, results }` \| `{ ok:false, code, error }`; zod-free defensive shape checks, never throws. |
| `readEvalHistory(dir)` | → `{ ok, path, rows }`; a MISSING history file is honest (`ok:true, rows:[], missing:true`) — an absent trend is not an error. |
| `buildScorecard({ results, history, dir, slug? })` | → the printable object: `criteria` (M1–M9 rows: scoredBy/total/max/mean + evidence samples), `entries` (per-slug rubric rows + acceptance + trial data), `summary`, `historyDeltas` (latest history row per slug vs the current row — per-criterion + total/mean deltas + `at`), `historyTrend` (first→last per slug), `provenance` (paths + generatedAt + mode). |
| `generateAtLabel(...)/criterionAggregate(...)` | internal helpers; no new deps. |

**Honesty:** every number is read from the two files as-is (no recompute of scores; deltas are printed with the
`at`/`mode`/source row they came from). A missing history row prints `deltas: null` + `reason`, never a fake 0.
A `pass:false` row is never coerced (`acceptance.passReason` rides through).

**USAGE** gains one `eval:` row (identical text in the file and in `USAGE.commands`); the subcommand count
claims in `scripts/README-cli.md` ("35") are **denoted as re-derived later** — this lane does not renumber them.

## 2. T5.2-A — the fixtures review surface (console)

Additive region in `src/components/console.tsx` (F4's HITL lead-in patterns reused): corpus fixtures + grader
bars surfaced read-only; approve/reject recorded to the decision ledger. Exact hunk line map appended in §4.

## 3. Files touched (line map)

- `scripts/rapidtool-cli.mjs` — the `eval` verb (author's summary: **T5.3 landed and coherent**).
- `src/lib/scorecard.ts` (new) — the results/history reader (author's reconnaissance also mapped the UI targets: `MemoryEntry` `:97/:333`, `OracleVerifyBlock` `:5371`).
- **[PARENT-ADDENDUM]** `src/lib/fixtures.ts` + `src/lib/fixtures.server.ts` — the T5.2-A **data layer**, written and syntax-load-verified by the parent (`fixtures.ts OK · exports: FIXTURE_REVIEW_LABEL, bodyHeadings, fixtureDecisionEntry, fixtureReviewRows, parseFixtureFrontmatter, parseGrader`). Pure parse/join/decision-entry; read-only; the run-side-grader honesty label is carried on every row.

## 4. UI hunks by line

**[PARENT-ADDENDUM]** The console panel was **not landed** by the author (T5.2-A incomplete at the call cap). The data layer is now on disk; the panel is a small additive block, deliberately NOT blind-written into the live 5000-line console:
1. `src/components/console.tsx:136` — add `"fixtures"` to the `RunTab` union.
2. `:157` — a `RUN_TABS` entry: `{ id: "fixtures", label: "Fixtures", purpose: "Review eval fixtures against their run-side bars", tier: "advanced" }`.
3. A `Tabs.Content value="fixtures"` block mirroring the spec tab (`:3000-3021`), rendering `loadFixtureReviewRows()` through a server-fn (`src/lib/chat.ts:20` `createServerFn` pattern), showing `FIXTURE_REVIEW_LABEL` verbatim and approve/reject → `fixtureDecisionEntry(...)` recorded via the project's decision path.
4. The block must be confirmed in a running app (the data-loading path is the one thing a blind edit could get wrong).
