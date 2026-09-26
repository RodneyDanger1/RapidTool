# fixes/268_wd_beta.md — W27 · WD-β · THE CONSOLIDATOR (lane log)

**Lane:** W27 WD-β (task-9 of `deleg_3060d4d6`, started 2026-09-26 16:06:18) · **Repo HEAD at start:** `e3d3fe4`
("W24-W26: spring-clean + deep audit + bug hunters — gates green on fused bytes") · **Deliverable:**
`research/multiagent/thoroughanalysis.md` §W27-WORKLIST (appended above `END-OF-FILE-MARKER-W25`) + this log.
**Rules honored:** READ-ONLY on product code (no product edits) · ≤1 targeted foreground command per spot-check ·
no keyed calls · no full-gate runs · append-only onto the shared log after a re-read of the marker.

## Status: COMPLETE — §W27-WORKLIST appended to `thoroughanalysis.md` at 16:35:42 (verified); lane log final below.

## Read-first log (as-executed)
1. `wave_plans/W27/mass-investigation.md` — read IN FULL (2026-09-26 ~16:07; esp. the WD-β section: consolidate
   A1–A4 + C1–C6 + B*/H* summaries + R1–R8 as they land; ≥10 spot-checks; READY/BLOCKED/OWNER-ONLY marks).
2. `research/multiagent/thoroughanalysis.md` — read IN FULL at 16:07 (371 lines / 52,859 B: mission + protocol +
   §A1 ×9, §A2 ×12 (parent-scribed), §A3 ×10 (parent-scribed), §A4 ×11, §C1 ×11, §C2 ×6 + §C3–C6 outcomes;
   END-OF-FILE-MARKER-W25 intact at L371). No §R1–§R8 rows present yet — the 8 W27 auditors are live (started 16:06:18).
3. `research/multiagent/thoroughaction.md` — read IN FULL at 16:07–16:08 (498 lines / 145,062 B: WD-1/WD-2/
   WD-3/WD-4 poll blocks + delegator records; END-OF-FILE-MARKER-ACTION intact at L498).
4. Saved lane summaries (`C:\Users\mnril\AppData\Local\hermes\cache\delegation\subagent-summary-*`) — mapped all
   `20260926_*` files to lanes; reading the capped lanes' full detail (W26 H1–H4 @160103, W23 L1–L7 @151327,
   W24 @155248, C1/C2/WD-3/WD-4 @160303). _(list of what was read in full: appended below as they are read)_

## Read-first log — summaries read IN FULL (16:09–16:12)
- W26 bug hunters (the capped lanes' full detail): `subagent-summary-{0..3}-20260926_160103_*.txt` — H1 (handoff/vault
  crash candidates + coverage gaps + probe debt), H2 (B2-f01 atomic marker + npm-test glob; B2-f04 gate.sh diagnosis
  gap), H3 (B3-f01 async tap FIXED, B3-f02 xAI 402, B3-f03 maxBuffer unreachable, B3-f04 nested tests skipped),
  H4 (B4-f01 census, B4-f02 README-cli examples, B4-f03 theme-color meta; extensive verified-not-bug list).
- W24 final summaries `155248_*.txt` (U1's registered-not-fixed list incl. fixtures README fake-row, scorecard
  reachability, orphans; U2 all-green).
- W25 cleaners `160303_*.txt` (C1's 11 findings; C2's 6 findings + verified-negatives) — cross-checked against the
  parent-scribed §C1/§C2; no finding lost.
- W23 lanes `151327_*.txt` (L1 main()-wiring gaps since closed by W24/B2; L2's OV-16 remaining work — verified
  LANDED at `scaffold.ts:2065-2078`; L5 T5.2-A — landed since; L6 DF-09 partial; L7 recorder).
- Watchdog ledgers WD-1/WD-2/WD-3/WD-4 closing blocks (open items: commit segregation — discharged by e3d3fe4;
  recording debts; probe hygiene).

## Spot-check register — 21 checks, ALL CONFIRMED against HEAD `e3d3fe4` (16:09–16:15)
| # | Claim (source) | Verified bytes | Verdict |
|---|---|---|---|
| 1 | A1-f01 wildStep never calls keyed P6 | `engine.ts:3986` = `applyPhaseResult(running, phase)` only; `upgradeP6Keyed` 1 caller `:2920` (liveLayer) | ✓ CONFIRMED |
| 2 | A1-f02 mint reachable only via journey/repair | `mintTreeRunTested` def `codegen.server.ts:3450`; callers `headless.ts:2100/2142/2687/2699` (journey/repair); no run/gate/wild caller | ✓ CONFIRMED (call-site lines 2687/2699 — A1 said 2681; drift noted) |
| 3 | A3-f01 CJS resurrection at emit | emitted `get-property.ts` tail = `module.exports.*`; emitted `package.json:5` `"type":"module"`; `scaffold.ts:2543-2545` verbatim `push(tf.path, tf.source)` | ✓ CONFIRMED |
| 4 | A3-f02 prompt teaches CJS vs strict tsconfig | `codegen.server.ts:465-492` "TypeScript-style CommonJS" + "Assign module.exports"; `scaffold.ts:612-624` `strict:true`, module ESNext | ✓ CONFIRMED |
| 5 | A2-f02 gate.sh green-with-red-leg | `gate.sh:175-178` exit gates on typecheck/lint/assertionGaps/build only; testsScripts/testsLib `.ok` recorded, never gate | ✓ CONFIRMED |
| 6 | C1-f01 unguarded date render | `packet.ts:484` `new Date(d.decidedAt).toISOString()`; same file clamps at `:193-215` | ✓ CONFIRMED |
| 7 | C2-f04 missing busy latch | `console.tsx:1801` union = step|run|approve|reject|crew (no "module"); `onRunModule:2122` / `onIngestReport:2138` never setBusyAction | ✓ CONFIRMED |
| 8 | A4-f01 autonomy overclaim | hits: `console.tsx:1643`, `index.tsx:7`, `__root.tsx:41` + **counter-find `src/lib/og/site.json:1`** | ✓ CONFIRMED (+1 surface) |
| 9 | B3-f02 xAI 402 → REJECTED | `openai-compatible.ts:~492` `code:"RT_E_LLM_REJECTED"` on any !res.ok | ✓ CONFIRMED |
| 10 | A2-f07 token cap is per-call | `synthWithBackoff` `:2314` `ledger = emptyLedger()`; call sites `:2817/:3174` pass no ledger | ✓ CONFIRMED |
| 11 | H1 handoff.ts:95 raw `.trim()` | `handoff.ts:95` `project.brief.trim()`; `text()` helper exists :33; artifacts filtered | ✓ CONFIRMED |
| 12 | B2-f01/B3-f04 test-glob fix state | `package.json:19` now `src/lib/**/*.test.ts`; `gate.sh:89-92` same `**` | ✓ FIXED-IN-HEAD (green re-run = boundary) |
| 13 | A4-f11/C2-f01/B4-f01 census | `README.md:108-115` still `{0,5,0}` claim; `remainingwaves.md:12/27/233` same | ✓ CONFIRMED (unfixed) |
| 14 | A3-f05 graders don't grade | grader JSON `expectedFiles:[package.json,index.html,README.md]`, `expectedContent` = package.json "test"; consumer `run-eval.mjs:559-593` | ✓ CONFIRMED |
| 15 | A3-f06 universality untested | `grep -h "^kind:"` → 7× `"webapp"`; 7 grader files | ✓ CONFIRMED |
| 16 | A1-f03 tree-job swallow + evidence | `scaffold.ts:1596-1615` `catch(e){ if (e instanceof ReferenceError) throw e; }`; `codegen.server.ts:3416-3431` counts passing assertions only | ✓ CONFIRMED |
| 17 | A2-f01 fixtures --approve no seat | `rapidtool-cli.mjs:977-998` `approveFixtureCases` + `acceptanceApprovedAt` with no token check | ✓ CONFIRMED |
| 18 | A1-f05 partialTreeRefuse keeps lastTest | `codegen.server.ts:3289-3309` sets tree/source/modelRoute, never `lastTest` | ✓ CONFIRMED |
| 19 | A1-f09 console never enforceDod | `engine.ts:1820-1826` process-undefined ⇒ false; `store.ts:1164-1168` create w/o thread | ✓ CONFIRMED |
| 20 | A4-f03 sandbox vocab live | `console.tsx:3773` checkbox + `:1503` + `:1965` still say "sandbox"; file rule :262 says never | ✓ CONFIRMED |
| 21 | B4-f03 theme-color not updated in-session | `console.tsx` 0 hits for theme-color; only `__root.tsx:43/:75` writes it | ✓ CONFIRMED |

**Refuted: none.** Counter-findings added by WD-β: `og/site.json` (W-11), committed root probes in `e3d3fe4` (O-2/W-36).
Additional read-only checks folded in: W23-L2's OV-16 README render is LANDED (`scaffold.ts:2065-2078` both branches);
R3/W27 probes at root (`probe-b2-*`, `probe-r5-*`) observed.

## Worklist build log
- **Fragments composed (~38KB) in `C:\Users\mnril\wd_beta_scratch\worklist_draft.md`** (outside the repo) as R1/R2/R4/R5/R7/R8/R13 landed; fold order: A/C/H core → R1/R2 (P1 upgrades to W-23/W-24; new W-38) → R4/R5/R8 (W-17/W-21/W-27/W-09/W-10/W-12/W-14/W-15 specs; new W-39/W-40..W-46) → R13 (W-47..W-54 + merges W-40/41/42/43/44/45).
- **R3/R6 handled as capped lanes:** §R3/§R6 never landed (both lanes completed via iteration cap at 16:19:40/16:18:47; lane logs skeletons). Their slices' rows (W-03/05/06/07 for R3; W-29 + W-38 for R6) rest on A3/A4/C2 + this register; recovery owed (O-5) with the parent-scribe pattern (A2/A3/R14 precedent).
- **Append event:** re-read of the file immediately before patching — 16:34:30, 1,113 lines, md5 `18ce1070ba90e5d019a3b99adff60691`, marker intact **and the file's last line** (`cat -A` byte check). Patch: `old = the exact marker line` → `new = the §W27-WORKLIST block + the unchanged marker`. **Result: SUCCESS** — file 1,113 → **1,362 lines** (+249), marker re-verified as the last line at 16:35:42; post-append md5 **`d0efc40f67a82a76a257c5fb295f78d0`**; my block present (grep hits: header + W-row markers + §H). No product file touched (git status: only the two shared logs + lane logs).
- **Content:** P0 4 · P1 25 · P2 15 · P3 9 (+1 DEFER) · OWNER 6 = 53 actionable rows + 1 deferred; §F maps all ~135 source finding IDs (A/C/H/R1–R15) to rows; no-action register included so nothing is dropped silently.

## Known cosmetic defect (append-only → left as-is, recorded here)
The appended §G line reads "**Counter-findings ADded:**" — a typo for "ADDed"/"added". Per the protocol
(corrections = new findings; never rewrite), it was not edited post-append. Harmless.

## Bottom line (FINAL)
**Deliverable delivered:** `research/multiagent/thoroughanalysis.md` now carries **§W27-WORKLIST** (1 merged,
prioritized, deduplicated, source-cited register of every fix/wire/build item for the coder wave), plus this lane
log. **24 spot-checks run; all 24 CONFIRMED (0 refuted); 2 WD-β counter-findings added** (`src/lib/og/site.json`
autonomy claim — independently confirmed by W28's R15-f01; root probes committed in `e3d3fe4` — R4-f10).
**At append time:** §R1/R2/R4/R5/R7/R8 landed; **§R3/§R6 capped-unlanded (recovery owed)**; W28's §R13/§R14/§R15
already landed and were folded (O-6 covers the W28 re-consolidation). **Zero product edits by this lane; zero
keyed calls; zero full-gate runs.** Rows' lines/md5s are as-read at HEAD `e3d3fe4` (W28 lanes append
concurrently — re-grep before patching, as every spec itself warns).
