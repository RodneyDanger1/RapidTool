# 343 · lane bh1 — bug-hunter 1 (pipeline / engine / governance core)

**Scope:** `engine.ts`, `types.ts`, `phases.ts`, `dod.ts`, `judgment.ts`, `store.ts`, `io.ts`,
`checkpoint.server.ts`, `token-ledger.ts`, `quarantine.ts`, `planning.ts`, `wild-mode.server.ts`,
`wild-review.ts`, `policy.ts`, `errors.ts`, `maker-score.ts`, `scorecard.ts`, `doctor.ts`,
`fixtures*.ts`, `brief-fixtures.ts` + colocated tests. **0 keyed LLM calls.**
Root `C:\Users\mnril\Desktop\RapidTool Main`, HEAD `73f660a`. Scratch: `%TEMP%\rt343_bh1\`.

Baseline (both runtimes, slice suites): host node v24 **687 pass / 0 fail**;
Node 22 `& "$env:LOCALAPPDATA\hermes\node\node.exe"` **687 pass / 0 fail**. Unchanged after fixes.

## Findings

| # | Class | file:line | Severity | Reproduction | Status |
|---|---|---|---|---|---|
| 1 | Claim-vs-byte (user-visible phase summary) | `phases.ts:25` | **Medium** | P2 summary claimed "T-107.7's checkpoint module ships in-tree but unwired — no wired durable checkpoint layer yet". The wiring is real: `headless.runUntilGate` → `commitRunCheckpoint` (`headless.ts:935-938`, caller `:1250`), read side `loadResumableCheckpoint` (`:973`), CLI `resume`/`unattended`. The summary is rendered into the Agent Packet (`packet.ts:1029`), crew prompts (`crew.server.ts:411/740/760`), `report-intake`/`llm-tasks`. A stale, false, user-visible claim. | **FIXED** |
| 2 | Claim-vs-byte (capability registry) | `dod.ts:1058-1065` | **Medium** | `CAPABILITIES.memory.claim` said "No wired durable checkpoint layer (T-107.7's module is in-tree, no call site yet)" with `"durable-checkpoints"` under `declared`. Same false claim as #1; the module doc says the claim text "copies into user-visible artifacts" and the adjacent comment ordered the move "IN THE SAME commit" the wiring landed — it did not. | **FIXED** |
| 3 | Claim-vs-byte (doc overclaim) | `wild-mode.server.ts:265` | Low | Doc said `"no issues"` is flagged vacuous, but `isVacuousFeedback("no issues") === false` (probe: words `["no","issues"]`, `issues` (6 chars) is not an approval stop-word so it counts as substantive). The stated RULE (≥1 token ≥5 letters that is not a generic **approval** word) is implemented correctly; only the example was false. Corrected the example to the tested set. | **FIXED** (comment) |
| 4 | Test teeth (verdict ladder) | `checkpoint.server.ts:166` | Low-Med | Mutation: `\|\| run.phase > CHECKPOINT_PHASE_MAX) return false` → `> 999` in `isRunCheckpoint`; the pre-existing `checkpoint.server.test.ts` stayed **GREEN** (27/27). The read-side test pinned only the fractional phase (1.5, caught by `Number.isInteger`), never the out-of-graph integer upper bound — only `checkpointAdmits` (line 161) was pinned. Added a raw-file `run.phase: PHASES.length` read-side pin. | **FIXED** |
| 5 | Test teeth (equiv mutation) | `judgment.ts:220` | — (not a defect) | Mutation `if (anchor && proofProbes.length > 0 && proof)` → `if (anchor && proofProbes.length > 0)` stayed green. Analysis: only P6 registers a `*-verified` probe (`machineProofProbeIds`), and `p6-verified` (`dod.ts:683-703`) is met **iff** `lastTest` is `tested`+hash, which is exactly `machineProofOf`. So the `&& proof` clause is unreachable-when-false today → semantically-equivalent mutation, not a coverage hole. | **REPORTED** |
| 6 | Silent-ish catch / lost message | `wild-review.ts:109-112` | Low | `createNodeWildReviewer` `catch { return null; }` drops the loader error. Documented as intentional degradation to the engine's honest default, but the message is lost. No production key present in this lane to exercise it. | **REPORTED** (not fixed; intentional) |
| 7 | Mis-coded / documented-open gap | `io.ts:36-45,485-489` | Low | The import "too large" arm returns a message with **no** `code`; the comment (A1-25) is explicit that `RT_E_IMPORT_TOO_LARGE` does not exist and is a follow-up. Honest, not a false claim. Adding it needs an `errors.ts` registry entry + `ImportResult` threading — a feature, out of minimal-patch scope. | **REPORTED** |
| 8 | Boundary (foreign input TypeError) | `token-ledger.ts:327, 677-710` | Low | `recordSpend(null, spend)`, `wouldExceed(null,…)`, `recordSpendWithinCap(null,…)` throw `TypeError` on a null/foreign ledger, while sibling `totalTokens`/`normalizeLedger` guard it. The module doc marks these three ledger-object helpers as seam-callable with **no production call site** today. | **REPORTED** |
| 9 | Boundary (throw on bad clock) | `quarantine.ts:59-61` | Low | `quarantineStamp(NaN)` throws `RangeError` (`Invalid time value`) instead of refusing. Only reachable from test/explicit `opts.now`; no production caller passes a non-finite now. | **REPORTED** |
| 10 | Stale TODO comments | `wild-review.ts:35, 95` | Low | `TODO(R14-f01): full logic after the shell` sits above code that is complete for its declared seam. Slightly misleading, but it honestly declares the *keyed evidence run* is pending (a verification gap, not a code placeholder). | **REPORTED** |
| 11 | Untested modules | `wild-review.ts` (no test), `fixtures.server.ts` (no test) | Low | Both are in-slice with **no colocated `*.test.ts`**. `fixtures.server.ts`'s loader path is IO-heavy; `wild-review.ts` is key-gated. | **REPORTED** |

Coverage note: `fixtures.server.test.ts` does **not** exist (my baseline command named it; node silently
ignored the absent file — cross-checked with `Get-ChildItem`). `wild-review.ts` likewise has no test.

## Fixes (RED-first, both runtimes)

### F1 — stale checkpoint claim (phases.ts + dod.ts)
Repro: `grep -rn "ships in-tree but unwired|no call site yet" src/lib` returned the two claims while
`headless.ts:935-938/973/1250` and `scripts/rapidtool-cli.mjs:1172-1193` show the write+read wiring.
Fix: P2 summary and `CAPABILITIES.memory` now state the wired per-phase checkpoint; `durable-checkpoints`
moved to `implemented`; `cross-encoder-rerank` stays `declared`.
GREEN: `phases.test.ts` + `dod.test.ts` + `gates.test.ts` green on both runtimes (see below).

### F2 — missing read-side out-of-graph pin (checkpoint.server.test.ts)
Before fix the guard mutation stayed green (27/27). Added pin:
`run.phase: PHASES.length` written raw, `readCheckpoint` must refuse.
- RED-before (guard removed): `# pass 26  # fail 1` → exit 1.
- GREEN-after (guard intact): `# tests 27  # pass 27  # fail 0` → exit 0 (both runtimes).

### F3 — doc overclaim (wild-mode.server.ts comment)
Probe before: `isVacuousFeedback("no issues") === false`. Corrected the example list to the
tested set (`"ok fine"`); the implemented rule text is unchanged.

## Mutation-test results (scratch harness `%TEMP%\rt343_bh1\mutate*.mjs`; original bytes always restored)

| Target | Mutation | Result |
|---|---|---|
| `checkpoint.server.ts:166` | drop out-of-graph phase bound in `isRunCheckpoint` | **GREEN pre-fix → test gap**; RED after F2 |
| `token-ledger.ts:289` | loosen cap regex to `text.length === 0` | RED (caught) |
| `token-ledger.ts:593` | cap crossing `>` → `>=` | RED (caught, 2 fail) |
| `phases.ts:139` | drop phantom-phase guard in `priorsSealed` | RED (caught) |
| `policy.ts:134` | `hitl.force` `requiresHumanSeat: true` → `false` | RED (caught, 3 fail) |
| `wild-mode.server.ts:242` | drop quoted-echo verdict guard | RED (caught, 3 fail) |
| `io.ts:127` | drop deterministic `model` contradiction guard | RED (caught, 2 fail) |
| `judgment.ts:220` | drop `&& proof` from rung 3 | green — semantically equivalent (see finding 5) |

## Mock / fake census over changed lines
Changed lines: 4 files. `as any` = 0 · `@ts-ignore`/`@ts-expect-error` = 0 · `TODO` bodies = 0 ·
hardcoded fake returns = 0 · silent `catch {}` = 0 · unfalsifiable tests = 0. Only comments, two
user-visible strings, and one new assertion were touched.

## Could not verify
- **Full `typecheck` / `lint`** — eight agents are editing the tree (13 reserved/dirty files at
  session start); a repo-wide run would report their in-flight state, not mine. All changed files are
  comment/string/test-only and run clean under type-stripping on both runtimes.
- **`wild-review.ts` keyed path** — needs `DEEPSEEK_API_KEY` (0 keyed calls by instruction).
- **`judgment.ts` `&& proof` reachability** is argued from the current `DOD` registry (only P6
  registers a `*-verified` probe); a future phase registering one not backed by `lastTest` would make
  the clause live and a negative test necessary then.
