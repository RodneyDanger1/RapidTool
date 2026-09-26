# fixes/260 — W22 · LANE 1 · the ready-to-fix-now queue (fix in severity order, each with a test)

**OWNER:** W22-L1 (Flash lane) · **started:** 2026-09-24 18:37 · **STATUS: COMPLETED (5 of 6) — lane NOT fully closed; see FLAGS** — *[RECORDER-FILLED from the author's own summary; author absent]* (the author exited at its iteration cap leaving this log all-TBD; the content below transcribes its final summary: `C:/Users/mnril/AppData/Local/hermes/cache/delegation/subagent-summary-0-20260924_185719_495607.txt`).
**Scope:** fix queue #52 → #24 → #14 → #62 → #50 → #28 (+flagged #37/#51) from `fixes/257`'s
§READY-TO-FIX-NOW; mark each row in `fixes/257` **append-only** (`FIXED-APPLIED (W22-L1)` or a
written SKIP reason). Scratch: `C:/Users/mnril/w22l1_scratch/`. Host rule: FOREGROUND node only.

## BOTTOM LINE

```text
#52 → FIXED · #24 → FIXED · #14 → FIXED · #62 → FIXED · #50 → HALF-LANDED (test half; doc half BLOCKED) · #28 → NOT STARTED (owner decision) · (#37 → NOT STARTED · #51 → NOT STARTED)
```

**Ledger status:** `fixes/257` carries append-only `[W22-L1]` markers for **#52** (+ the new find), **#24**,
**#14**, **#62**. **#50's marker was NOT appended** (the guard landed after the marker batch) — still true at
W23-L7 read time.

## Per-item ledger (as per the author's summary)

| #id | site | disposition | evidence command |
|---|---|---|---|
| #52 | `git.server.ts:152` TS2345 | **FIXED** — cleared by widening the policy seam's *input* type (`policy.ts` gains `PolicyCtxInput`; `evaluatePolicy(…, ctx?: PolicyCtx \| PolicyCtxInput)`), **NOT** caller-side narrowing (narrowing erased the "claimed seat (…)" refusal echo). Zero runtime drift; seam's documented total contract now type-true. | scoped tsc `C:/Users/mnril/w22l1_scratch/tsconfig.fix52.json`: **RED 5 diagnostics → exit 0**; `git.server.test.ts`+`policy.test.ts` **65/65** (+1 new pin "accepts an untrusted, unknown-typed actor claim verbatim and ECHOES it"); scoped eslint exit 0 |
| #52-adjacent (NEW, unledgered) | `git.server.ts:953` + `:1112` | **FIXED** — two more TS2554 sites no prior measurement saw (vestigial `(f) => f` third arg on the 2-param `gateSeatAndTarget`; present in committed HEAD `8e25180`). Arg deleted; runtime identical. ← flagged for the v4 ledger to number | same scoped tsc: 5 → **0** |
| #24 | `fixes/241_lane3_browser_residuals.md:38` `[fill]` | **FIXED** — filled with the byte-verified lane-end re-check (foreign holder `LISTENING 14140`; parent 13:26 + own `netstat` 18:47:13) | `grep -c "\[fill\]"` → **0**; 0 placeholders repo-wide |
| #14 | `fixes/236_c1_wb1_deadlock_fix.md:51` typo | **FIXED** — `verifyAndServever` → real symbol `verifyAndFixServer` (`verify.server.ts:946`) | `grep -c "verifyAndServever"` → **0**; `verifyAndFixServer` → 1 |
| #62 | `wave_plans/W19/lanes-and-watchdogs.md:12` | **FIXED** — KNOWN-ERRORS rewritten to measured truth (3 TS + 1 lint @ W18 boundary, all resolved); tagged `[corrected W22-L1 · ledger #62]` | `grep -c "has 2 typecheck errors"` → **0**; `corrected W22-L1` → 1 |
| #50 | `--test-name-pattern` no-op-trap codification | **HALF-LANDED (test half)** — `scripts/test-name-pattern-guard.test.mjs` (3 cases) codifies the trap + pairing recipe. Trap measured **first** (a no-match filter exits 0, prints `1..0`, yet summary says `# pass 1` — and **masks a genuinely red test**). Instrument itself RED 3/3 → GREEN 3/3 (real bug found+fixed: child inherited `NODE_TEST_CONTEXT`). **Doc half BLOCKED** (see FLAGS #1). | `node --test scripts/test-name-pattern-guard.test.mjs` → **exit 0, 3/3** |
| #28 | Hermes skill file `…/skills/software-development/rapidtool-development/SKILL.md` (**101,307 B > 100K cap**) | **NOT STARTED — owner decision** (curate-vs-split) | — |
| #37 (flagged) | `chat.server.ts:561` `callModel` seam; note `crew.server.ts:877` is now an arrow (`crewRegistryCompleter`, not a wrapped `callModel` — v3's site line has drifted) | **NOT STARTED — owner decision**; wrapper recipe in `fixes/247_lane2` §4 | — |
| #51 (flagged) | `io.ts` exports `ArtifactProvenance`; `types.ts` `Artifact` (:41) lacks it → folding adds a `types.ts → io.ts` coupling | **NOT STARTED — owner decision** | — |

## ⚠️ FLAGS (the lane is NOT fully closed — read these)

1. **`#50` doc half incomplete**: the repo-wide prose note was to go in `AGENTS.md` — that write was
   **BLOCKED by file protection (approval timed out; no consent — silence is not consent)**. It was not
   retried. The recipe now lives in the guard's header comment; **the owner must add the AGENTS.md note** —
   exact patch text drafted: `research/multiagent/262_agents_md_proposal.md` (W23 LANE 7).
2. **`#50` ledger marker NOT appended** to `fixes/257` (guard landed after the marker batch).
3. **`#28`, `#37`, `#51` never started** (no disposition, no marker) — details in the table above; all three
   are owner decisions by nature.
4. **This log was a SKELETON at hand-off** — the author: "the biggest paper-trail gap; resume me (or Lane
   3/WD) to fill it from this summary." → filled by W23-L7 (this fill, `[RECORDER-FILLED …]`).
5. **#52 fix is one file-pair outside its box**: `policy.ts`/`policy.test.ts` were unowned and stable, so the
   author took the seam-side widening rather than the ledger's suggested caller-side narrow — reason
   documented in the code + the ledger marker.
6. **Watcher readiness (author's note)**: code edits green under a *scoped* program (direct
   `./node_modules/.bin/tsc -p` — `npm run typecheck/test/build` never invoked). No half-applied edits; all
   8 repo files consistent. The added guard costs ~1.6 s in `npm test`, no cwd dependency.
7. **File-mutation verifier (author's run)**: `AGENTS.md` was NOT modified despite the attempted patch —
   `[patch] BLOCKED: write to protected agent-instruction file(s)`. Reproduced in this fill's provenance: the
   block is the correct behavior; apply deliberately via the proposal doc.

## Scratch / evidence

- `C:/Users/mnril/w22l1_scratch/`: `tsc_fix52_RED.txt` (5 diagnostics) · `tsc_fix52_GREEN.txt` (0 B) ·
  `suites_fix52_GREEN.txt` (65/65) · `noop_fixture.test.mjs`/`noop_nomatch.txt`/`noop_match.txt` ·
  `mask_fixture.test.mjs`/`mask_nomatch.txt`/`mask_full.txt` · `guard50_run.txt` (3/3) · `git.server.HEAD.ts`.

---

**[RECORDER note — W23 LANE 7]** Filled from the author's own final summary (file cited in the header) +
`fixes/257`'s append-only markers. No test/typecheck/build/lint runs performed (docs-only wave rule).
