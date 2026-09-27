# fixes/281_n6_pins.md — W36 · LANE N6 — THE PINS + THE SUITE TRUTH (test-owner)

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD:** `0f85c32` + the W29–W36 uncommitted era.
**Box:** test files ONLY — `src/lib/headless.test.ts` · `scripts/rapidtool-cli-edit.test.mjs` · NEW `scripts/rapidtool-cli-fixtures.test.mjs`.
**Rules honored (W36 contract):** no test runs · no full gates · no keyed calls · smallest honest patches · additive only · never weaken an assertion to pass (`262`'s no-op-trap doctrine) · log-and-continue · this log EARLY.

## [t0] Mandatory reads

- Read in full: `wave_plans/W36/completion.md` (N6 brief = 3 items) · `fixes/278_p1_remainders.md` (the reds table + TRUE-STATE table) · `fixes/278_p3_waveplan.md` · `fixes/277_l3_ui_records.md` (E-25 evidence chain + "CLI per spec, pins stale" verdict).
- Key facts carried in: E-25 = 2 nested subtests (① re-pointed 19:06:58 → `headless.test.ts:1608`; ② re-pointed 19:39:11 → `:1753`) · edit-test 3 pins (`:300`/:327`/:401`) unwinnable post-two-channel, mtime Sep 17 · scripts leg last full run = W12 · headline 96/94/2 @19:11 (2 remaining = the E-25 pins at that stamp).

## [t1] Recon findings (byte reads only — nothing executed)

**E-25 state — the 2 remaining subtests @96/94/2 (19:11) are BOTH RE-POINTED; verified by reading the test file:**
- Leg describe: `headless.test.ts:1220` `describe("E-25 — CLI machine contract (exit codes + envelope + doctor)")`.
- ① (:1608, last test of nested `describe("216 TA-2 — approve() records an actor seat; no machine path mints decidedBy:human")` @:1520): `"CLI: a non-TTY --i-am-human is refused even WITH the env token — the two-channel seat needs the TTY re-entry (R5-f12 Track 1)"` — asserts exit 1 + `ok:false` + `RT_E_VALIDATION` + `/needs an interactive confirmation/` + `/not a TTY/` + `/RT_HUMAN_SEAT_TOKEN/` + zero rows + `awaiting_hitl`. Matches CLI bytes `:3459-3467` (humanSeatClaim) + `:649-666`. **LANDED CORRECTLY.**
- ② (:1753, nested `describe("216o / W6-L2 — the seam's DENY is un-bypassable by both seats; approve() rows record provenance")` @:1644): `"CLI — a non-TTY approve mints NO row: no provenance may land from a machine"` — asserts exit 1 + `RT_E_VALIDATION` + BEFORE/AFTER ledger comparison (non-vacuous) + no `decidedBy:"human"` + `awaiting_hitl`. **LANDED CORRECTLY.**
- The brief's `:1741` = line drift from ①'s re-point expansion; the current bytes place ② at :1753 (P1's log agrees; `:1740-1751` is the library-seam "default approve records provenance" test — unchanged, not a CLI re-point).
- Boundary expectation: **both EXPECTED GREEN** — every asserted substring is present in `rapidtool-cli.mjs` bytes, and the refusal precedes any row write (no timing/state dependency).
- TAP ergonomics: the two subtests nest under the describes named above; grep the boundary TAP for each `it` title (t3 rows 1–2) and require its own `ok N - …` line (262 doctrine).

**edit-test 3 reds (not ok 6/7/9; 10 cases · 7 pass · 3 fail @19:08; mtime Sep 17) — confirmed stale vs the landed CLI:**
- CLI edit arm `:1620-1635`: `--i-am-human` → `humanSeatClaim("edit")`; non-TTY → refusal envelope `{ok:false, action:"edit", mode, written:false, error, code:"RT_E_VALIDATION", dir, file}` — **NO `policy` field** (refusal precedes the seam). Refusal text `:3459-3467`.
- `:300` (write-mode "policy deny") + `:327` (dry-run "policy deny"): asserted `j.policy.decision === "deny"` + `policy.fallback` + `policy.reason /^human-seat-unverified/` — **unreachable** post-two-channel. RE-POINTED (below).
- `:401` ("VERIFIED human seat (token presented) writes"): token ⇒ exit 0 + write + human attribution — the exact degeneracy R5-f12 closed. RE-POINTED: refused even WITH token; refusal bytes equal with/without token; nothing written.
- Also updated the file's top doc-comment bullet 4 + §3 header (they described the pre-two-channel contract).

**Fixtures arm — recon for the new file (`rapidtool-cli.mjs:1051-1182`):**
- `--draft` (:1057-1089): exit 0; `{ok:true, drafted, redCards, pending, approvedKept, note}`; saves merged `acceptanceFixtures` (all born `pending`) + `acceptanceBriefHash = String(fnv1a(brief))`; `acceptanceApprovedAt` kept iff approved rows survive the merge (:1075-1079).
- `--approve/--approve-all` (:1091-1172): ids required (:1099-1102); `--i-am-human` → humanSeatClaim — non-TTY REFUSED (:1114-1117, no `policy` field); no seat → autopilot → `evaluatePolicy("fixtures.approve", "fixtures:<path>")` — requiresHumanSeat (`policy.ts:141`) → deny `force-requires-human-seat — a autopilot/harness seat…`, fallback `human-seat-token` (:1124-1143).
- Neither flag (:1174): `RT_E_VALIDATION` "fixtures requires --draft or --approve".
- `respond()` (:128-146): every envelope gains `schema_version` + `cmd` + `exit_code` (OPS-1's shape).
- Seeding trick (no runs): hand-seed ONE well-formed A7 oracle row (types.ts:305-311) into a REAL `create` output; `importProject` keeps rows with a string `name` (io.ts:221-223); `draftTypedLiterals` then gives it a non-vacuous typed literal (:152-178) ⇒ deterministic `drafted:1`.
- Discovery: `npm test` scripts leg = `node --test "scripts/**/*.test.mjs"` ⇒ the new file auto-registers (+4 tests at the boundary; no registration step).

## [t2] Landings (bytes on disk — nothing executed all lane)

**`scripts/rapidtool-cli-edit.test.mjs`** (512 lines; 10 top-level `test()` — unchanged count; was mtime Sep 17):
1. Top doc-comment bullet 4 → the two-channel contract (replaces the pre-two-channel description).
2. §3 header → "the R5-f12 two-channel seat…".
3. Test @:307 (was :300, red 6) REPLACED → `"W9-L3 edit: --i-am-human on a non-TTY is refused BEFORE the seam — WRITE mode, coded, nothing written (W36-N6 re-point, R5-f12)"`: exit 1 · `RT_E_VALIDATION` · `action:"edit"` · `mode:"write"` · `written:false` · `dir`/`file` echoed · **`"policy" in j === false`** (refusal precedes the seam) · error bytes: `/^edit: --i-am-human refused/` + `/needs an interactive confirmation/` + `/not a TTY/` + `/RT_HUMAN_SEAT_TOKEN/` + `/autopilot seat instead/` · target + BUILD byte-identical.
4. Test @:350 (was :327, red 7) REPLACED → dry-run variant of the same refusal: `mode:"dry-run"`, no `policy`, dirDigest unchanged.
5. §4 header note + test @:433 (was :401, red 9) REPLACED → `"…refused EVEN WITH the env token…"`: **two invocations (with/without `RT_HUMAN_SEAT_TOKEN`)**; both exit 1 coded no-`policy`; **the two refusal error strings asserted EQUAL** (the token changes nothing — Channel A alone is never the seat); target untouched + `notEqual(afterBytes, PATCHED_DIV)` (keeps `PATCHED_DIV` live for lint) + no ledger row.
   - No assertion weakened: the three old expectations are unreachable by design post-R5-f12 (documented in each pin's comment with the spec cite); the new pins assert the refusal's actual bytes + the pre-seam firing + token-invariance.
   - `PATCHED_SUB`/`PATCHED_MUL`/`DUP`/etc. all still referenced (lint-clean by inspection).

**`scripts/rapidtool-cli-fixtures.test.mjs`** — NEW (273 lines, 4 tests, 12,544 B) — the OPS-2 fixtures-verb behavioral leg (never-caught class):
- `:146` `--draft`: exit 0 · `schema_version:1` · `cmd:"fixtures"` · `exit_code:0` · `drafted:1` (seeded A7 row → `draftTypedLiterals` case) · `redCards:[]` · `pending:1` · `approvedKept:0` · note /draft is pending/; on disk: row `{id:"orc-b-dispatch", requirementId, capability:"dispatch", given:{}, expect:{kind:"shape",value:{id:"<draft>"}}, kind:"pure", source:"a7", approval:"pending"}` + `acceptanceBriefHash === String(fnv1a(BRIEF))` (local-copy cross-check) + no `acceptanceApprovedAt` (`exportProjectJson` = plain stringify ⇒ delete ⇒ absent).
- `:187` autopilot `--approve`+`--ids` AND `--approve-all`: exit 1 · `RT_E_VALIDATION` · `policy.decision:"deny"` · `reason /^force-requires-human-seat/` + `/autopilot\/harness seat/` · `fallback:"human-seat-token"` · `resource === fixtures:<BUILD>` · error /refused by the policy seam/ + /nothing was written/; project byte-identical; rows stay pending.
- `:223` `--i-am-human` non-TTY (token / no token): exit 1 · coded · **no `policy` key** · error /^fixtures: --i-am-human refused/ + /needs an interactive confirmation/ + /not a TTY/ + /RT_HUMAN_SEAT_TOKEN/; error strings EQUAL across variants; byte-identical project.
- `:257` usage: no-flag / no-ids refusals coded (`requires --draft or --approve` · `needs --ids id1,id2 or --approve-all`); nothing touched.
- Fixture: REAL `create` (keyless, established precedent) + ONE hand-seeded well-formed A7 row (survives `importProject`'s name-guard) + `implementationSpec.requirements:=[]` to pin the draft count deterministically.

**Not needed / untouched:** `src/lib/headless.test.ts` — read-only verified, L3's re-points are correct, no edit required (my box does not touch it further). `scripts/rapidtool-cli-lesson.test.mjs` — grepped: no seat/policy/exit_code-class stale pins (only the generic cliJson contract, still true). Product code: zero writes.

## [t3] What the boundary must expect — per pin

| # | Pin (TAP name) | File:line | Expect | Basis / caveat |
|---|---|---|---|---|
| 1 | `CLI: a non-TTY --i-am-human is refused even WITH the env token — the two-channel seat needs the TTY re-entry (R5-f12 Track 1)` | headless.test.ts:1608 | **GREEN** | Refusal text + field behavior verbatim in CLI bytes `:3459-3467`; no mint. HIGH |
| 2 | `CLI — a non-TTY approve mints NO row: no provenance may land from a machine` | headless.test.ts:1753 | **GREEN** | Same class; ledger BEFORE/AFTER read (non-vacuous). HIGH |
| 3 | `W9-L3 edit: --i-am-human on a non-TTY is refused BEFORE the seam — WRITE mode…(W36-N6 re-point)` | rapidtool-cli-edit.test.mjs:307 | **GREEN** | Envelope `{action,mode:write,written:false,dir,file}` + error text verbatim from the arm (`:1621-1635`); `"policy"` absent by construction. HIGH |
| 4 | `W9-L3 edit: the seat refusal fires in the DRY-RUN pre-flight too…(W36-N6 re-point)` | rapidtool-cli-edit.test.mjs:350 | **GREEN** | Same, `mode:"dry-run"`. HIGH |
| 5 | `W9-L3 edit: a non-TTY --i-am-human is refused EVEN WITH the env token…(W36-N6 re-point)` | rapidtool-cli-edit.test.mjs:433 | **GREEN** | Error-equality holds because `humanSeatClaim` refuses at the non-TTY check BEFORE reading the env token. HIGH |
| 6 | `W36-N6 fixtures: --draft returns the drafting envelope…` | rapidtool-cli-fixtures.test.mjs:146 | **GREEN-expected** | All bytes from the arm; `drafted:1` is engineered (seeded row + neutralized capabilities). First-ever execution of this file; the `create` fixture precedent was green (edit file). MED-HIGH |
| 7 | `W36-N6 fixtures: --approve by the autopilot seat is refused by the policy seam…` | rapidtool-cli-fixtures.test.mjs:187 | **GREEN-expected** | Deny reason/fallback from `policy.ts:248-252` under the `requiresHumanSeat` rule (`:141`); resource echo exact. MED-HIGH |
| 8 | `W36-N6 fixtures: --approve --i-am-human on a non-TTY is refused by the SEAT…` | rapidtool-cli-fixtures.test.mjs:223 | **GREEN-expected** | Same refusal-before-seam class as #1; string equality by refusal order. MED-HIGH |
| 9 | `W36-N6 fixtures: usage refusals are coded…` | rapidtool-cli-fixtures.test.mjs:257 | **GREEN-expected** | Error strings verbatim `:1100`/`:1174`. MED-HIGH |

**Genuinely-unknown (NOT covered by this lane; boundary must not infer them from here):**
- headless full-leg **96/96**: depends on N1/N2/N3 product edits (scaffold/headless/console) + F1's W-02 `stripVolatiles` holding (MED-HIGH per P3 §3.1) + CF-2 typecheck pass. My box adds no product-code risk.
- **CF-2 typecheck** (`scaffold.ts` TS2554): N1's fix; un-re-verified since 18:12.
- **scripts leg = first full run since W12**: other files may carry stale pins outside this box (none found statically in edit/lesson/README-cli/fixtures). Count moves **+4 tests** (new file is auto-discovered by the `scripts/**/*.test.mjs` glob — no registration step).
- **Sibling landings shift the count too** (observed at t2, untracked): `scripts/cli-exit-taxonomy.test.mjs` (N5's OPS-3 — previously ABSENT per P1) + `scripts/gate-verdict.test.mjs` + modified `scripts/README-cli.test.mjs` are already dirty in the tree — the boundary scripts total is the W12 baseline + my 4 + whichever sibling files registered before then (their truth is their owners' rows, not mine).
- **262 doctrine at the boundary**: read each pin's own `ok N - <name>` line from the TAP output — never a filtered run's exit code (the no-op trap).
- Caveat: N2/N5 still own `rapidtool-cli.mjs` this wave. If the `humanSeatClaim` text, the edit-arm refusal envelope, or the fixtures-arm envelopes change before the boundary, re-diff these pins' asserted strings first (all cited at t1 against the `~20:0x` bytes).

## HYGIENE

- **No test executions this lane** (sprint rule): no suite runs, no full gates, no `hermes verify`, no keyed calls. After landing, TWO non-executing static checks were run on the changed files only: `node --check` on both `.mjs` files (a syntax parse — executes nothing) → **PARSE-OK**; `npx eslint` scoped to exactly those two files → **exit 0** (no unused vars — the `PATCHED_DIV` keep is lint-clean). Neither executes test/product code nor writes captures, so both stay inside "no test runs"; the suites (scripts leg + headless) remain UNRUN by design — the boundary owns them.
- Scope note: full verification (`npm test` / `hermes verify --json`) was deliberately NOT run — the sprint contract forbids full gates mid-wave ("never run the full gate while agents are mid-edit", AGENTS.md) and this lane's brief is explicit: "no-test rule stands until the boundary". Verification evidence for this workspace must come from the boundary lane's run.
- Files touched: `scripts/rapidtool-cli-edit.test.mjs` (6 hunks) · `scripts/rapidtool-cli-fixtures.test.mjs` (new) · this log. Nothing else.
- Disclosed overrun risk: none beyond the above; box boundaries respected (test files only).
