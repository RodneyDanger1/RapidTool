# fixes/295_p3_eval.md — W41 · LANE P3 · THE EVAL/GRADER TAIL (grader v2 · 4 kind fixtures · L3's label/end-class/marker)

**Lane:** P3. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; short one-liners). HEAD `ac6b151` at open. P1/P2/P4 LIVE elsewhere — read fresh; log `for p3` on files other lanes own.
**Box:** `scripts/run-eval.mjs` + `research/eval-corpus/**` + `src/lib/scorecard.ts` (plus the named L3 tail items where they live).
**Sources read (bytes, t≈04:20):** `fixes/294_n4_eval.md` (F6 + boundedInt landed; grader work partial) · `fixes/290_k9_universality.md` (byte-truth table: grader parse shape landed, nothing consumed) · `fixes/292_l3_eval.md` (stub — L3 items listed, none landed) · `research/multiagent/thoroughanalysis.md` §R7-f03 (grader-v2 spec) / §R7-f04 (4 missing-kind fixtures spec, exact slugs `arcade-breakout`·`invoice-csv-cli`·`date-rrule-library`·`order-webhook-service`) · `probe-k9-kinds.mjs` (+ its emitted trees under `/tmp/k9-*`).
**Contract:** patch-first · smallest honest patches · run only touched legs FOREGROUND (backgrounded `node --test` legs die on no-TTY — parent-verified) · NO full gates (lanes live) · NO keyed calls. Evidence per item.

## t0 byte-truth (verified before edits)

| Item | Byte truth at t0 |
|---|---|
| run-eval grader MACHINERY | **LANDED in HEAD** (ac6b151, +293 lines): `parseGrader` consumes `expectedKind` + `expectedBehavior` rows (`file-exists`/`package-target-exists`/`entry-runs`), `checkExpectedBehavior`, `checkExpectedKind`, `verificationLabel`, `checkAcceptance` carries `behavior`/`behaviorOk`/`kind`/`kindOk`/`verification`, `passesAcceptance`/`acceptanceFailReason` have the two new clauses, `historyEndClass` + `endClass` in history rows, `finishRunMarker` after both persists with `resultsWritten`/`historyWritten` from `existsSync` |
| run-eval grader TESTS | **MISSING** — `grep expectedKind\|expectedBehavior\|verification\|endClass scripts/run-eval.test.mjs` → 0 hits. Baseline: 35 tests green (parent foreground run 04:09:28) |
| 7 webapp graders | still v1: `expectedFiles [package.json,index.html,README.md]`, one `expectedContent` (package.json `"test"`), no `expectedKind`, no `expectedBehavior`, `graderVersion:1` |
| 4 kind fixtures | **ABSENT** (corpus = 7 webapp fixtures only) |
| kind emitters | N1/K9-verified: game/cli-tool/library/service emit real trees — probe `probe-k9-kinds.mjs` truths: game `pkg.main=src/main.ts` + `index.html` refs `/src/main.ts` + `vite.config.ts` + `assets/manifest.json`; cli `pkg.bin` target `bin/<slug>.mjs` (--help exit 0 · bare exit 1 `RT_E_VALIDATION`); library `main`+`exports`+`files:["src"]` resolve; service `scripts.start` + `.env.example` PORT + `resolvePort`. README Kind lines: `game`/`cli-tool`/`library`/`service` respectively |
| emitted webapp trees (evidence) | 18/19 trees under `research/eval-out/**` carry `"type": "module"`, the oracle test script, `index.html` → `/src/main.tsx` and `vite.config.ts` (only the legacy pre-emitter-fix `real-estate-crm/` lacks them) |
| scorecard.ts | no `verification`/`endClass`/`behavior`/`kind` reading; `EvalAcceptance`/`EvalHistoryRow` drop the new driver fields (the operator never sees the label) |
| L3 marker item | landed in HEAD (finalize after `persist()`; flags read from the FS at finalize time) — needs a durable pin |
| `FixtureVerdict`/`FixtureDecisionEntry` | zero consumers (grep: only their own definitions + the console.tsx W24 comment). `fixtureDecisionEntry` cannot be appended to `project.decisions` (`HitlDecision` requires `phase`/`title`/`requestedAt`/`decidedAt`; the engine's `wellFormedDecisionRow` would drop a mismatched row → declared corruption). ⇒ **STRIKE** (declare-or-strike), log `for p3` |

## Ledger (append-only; evidence = command + observed output)

- **(t0) log opened early** — recon table above verified by grep/read on today's bytes. Plan: (1) 7 webapp graders → v2 (kind-correct files/content + `expectedKind`); (2) 4 fixtures + graders with `expectedBehavior` drawn from the probe facts; (3) scorecard reads + renders `verification`/`behavior`/`kind`/`endClass`; (4) strike the dead fixture-decision exports; (5) pins in `run-eval.test.mjs` + a colocated `src/lib/scorecard.test.ts`; (6) foreground legs.
