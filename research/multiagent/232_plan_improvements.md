# 232 · PLAN IMPROVEMENTS — fresh codebase + competitor analysis, additive insertions (PLAN-IMPROVER)

**Agent:** PLAN-IMPROVER (W13 delegation `deleg_109c3c44` sibling brief `wave_plans/W13/improver-c.md`, read in
full first). **Date:** 2026-09-24. **Read-only on `src/`/`scripts/` and all clones** (nothing executed from any
clone; every clone claim is a file read/ls/grep performed today). Test runs used: **0 of ≤3**. One light external
fetch (curl, single page) for the re-verification below. Scratch: `C:/Users/mnril/w13n_scratch/`.

**Status: COMPLETE (2026-09-24, ~12:36)** — all 16 insertion points applied and read back; per-file
`grep -c "PLAN-IMPROVER"`: canonical 5 · overhaul 3 · external 1 · 221 2 · 222 1 · 223 2 · 224 1 · 229 1 = 16.
Every write was an append-before-anchor patch (no deletions, no reorders; line counts only grew). Insertion
index for the guardian below.

---

## BOTTOM LINE

`improvements inserted: 13 distinct findings (14 ledger entries — IMP-11 re-expresses IMP-02 in `222`) applied
as 16 insertion points · by class (distinct findings, primary class): c1 missing-evidence ×5 · c2
better-verification ×1 · c3 competitor-lesson ×3 · c4 missing-trap ×2 · c5 consistency ×1 · external
re-verification ×1 · files touched: 8 (220_tasklist_canonical · 220_overhaul_plan · 220_external_verification ·
221_feature_designs · 222_codebase_integration_map · 223_critical_path_premortem · 224_advantage_gap_and_plan_audit ·
229_steering_and_goal_alignment) · files skipped permanently: none (the canonical list was HOT on first checks —
another agent wrote it at 12:25:17 and 12:25:37 — so canonical insertions were deferred and applied after its
cooldown; no file was left untouched) · rejected by self-rejection: 0 withdrawn, every entry below carries its
strongest self-rejection for the parent to weigh.`

**The single most valuable improvement:** the **guard-fix test-pin trap** (IMP-02, applied to `220_tasklist_canonical`,
`220_overhaul_plan` §4.2 and `222` row 4). `scripts/browser-smoke-verdict.test.mjs:375-383` asserts, via source-text
`assert.match`, that `browser-smoke.mjs` still contains the four literal `checkedOutputPath(…, ["/workspace"])`
calls — so the OV-2 lane can go red in the scripts leg without touching the guard's own file, or can be wrongly
blocked into thinking the literals are sacred when `checkedOutputPath` is the right fix site. This is exactly the
class of "problem causer" the owner's standard targets, and it cost three lanes nothing to know.

**The one I wanted but did NOT make:** a *competitor lesson for T-107.7/T4.2* sourced from cline's checkpoints
(`apps/vscode/proto/cline/checkpoints.proto`: `checkpointRestore`, `checkpointViewLatestChanges`,
`checkpointLatestChangesCount`; CLI/desktop picker components found today) and opencode snapshots. Reason: I could
verify only the RPC/picker surface in the clone — **not** the snapshot storage mechanism — and T-107.7's row is an
engine-state-hash probe, not a workspace snapshot. Writing "build it like cline" without having read cline's
storage code would be speculation, which the owner's standard forbids. Registered in §Deferred instead.

---

## Method (fixed before analysis)

1. Read all 8 target files in full today; note the rows/sections that claim evidence or verification.
2. For each candidate insertion, re-read the cited `file:line` in the repo (or clone path+symbol) **today**.
3. Insertions only — never delete/reorder/rewrite; each carries the mandated marker
   `> [IMPROVER · 2026-09-24] <what + why> — evidence: <…>. (by PLAN-IMPROVER)`; 1–4 lines each.
4. If an improvement would change a row's MEANING rather than strengthen its evidence → not inserted; listed in
   §Deferred for the parent.
5. mtime re-checked immediately before every write; the canonical list was hot twice (see Bottom line) and was
   only written after cooling; 3-min rule observed for every write, including re-writes of my own edits.

## Audited facts (yardstick — none contradicted; two of them directly reused)

MCP clients = 7 · lesson-writers = 18 · DF-09 anchor = `engine.ts:1629` · gate 261/1957 · WB-1 deadlock
parent-verified (`headless.ts:1917`, `:1958`; `dod.ts:500-517`; `codegen.server.ts:3142`) · known-broken:
`browser-smoke.mjs` flags + `browser-guard.mjs` Windows guard + `hermes verify` format step + `eval --limit=N`
only. My insertions cite the same numbers the parent verified; where I add a confirming trace (IMP-10) it agrees
byte-for-byte with the audited anchors.

---

## The improvement ledger — 13 distinct findings / 14 entries / 16 insertion points

Format per entry: **id · target(s) · insertion (short) · evidence (read today) · class · what it prevents ·
self-rejection.**

### IMP-01 · `220_tasklist_canonical.md` (TASK-01 row area, §A)
- **Insertion:** below §A's table (after the AUD-2 block): the seven-arm vocabulary is already pinned in code —
  `NEXT_ACTION_BUTTON: Record<UiNextAction["kind"], string|null>` at `console.tsx:382` with keys exactly
  `run · approve · fix-gate · retry · done · running · unknown`; `uiNextAction` at `:311`; per-arm CLI verbs
  `status`/`gate`/`approve`/`retry`/`emit`.
- **Evidence (read today):** `sed -n '311,400p' src/components/console.tsx` + `grep -n NEXT_ACTION_BUTTON`
  (the record's keys and the two `run` returns read directly; `uiNextAction` body :311-377).
- **Class:** 1 (missing evidence).
- **Prevents:** the W14-L1 lane inventing a vocabulary or deriving the arms from the brief prose; a wire contract
  that disagrees with the console's own button map.
- **Self-rejection:** the row already lists the seven arm names and cites `console.tsx:311`; the only genuinely
  new content is the pin record (`:382`) and the per-arm `cmd` mapping — a reviewer could call it citation
  completion rather than new evidence. Kept because a *wire* contract must be copied from code, not memory.

### IMP-02 · `220_tasklist_canonical.md` (OV-2) + `220_overhaul_plan.md` §4.2 (item 3) + `222` row 4  [3 insertion points]
- **Insertion:** the guard-fix test-pin trap: `scripts/browser-smoke-verdict.test.mjs:375-383` source-pins the
  four `["/workspace"]` literals in `browser-smoke.mjs` (callers `:30,:32,:33,:41`); fix inside
  `checkedOutputPath` (literals unchanged → pins stay green) or update the pins in the same commit.
- **Evidence (read today):** `sed -n '368,392p' scripts/browser-smoke-verdict.test.mjs` — the test
  `"browser-smoke wires the guard and verdict helpers"` reads the smoke source and `assert.match`es
  `/checkedOutputPath\(args\.outPng, \["\/workspace"\]\)/` plus three siblings; `grep -rn checkedOutputPath scripts/`.
- **Class:** 4 (missing trap).
- **Prevents:** an OV-2 lane that fixes the guard/callers and silently reddens the scripts leg (or wastes a cycle
  discovering the pin late); documents both legal fix shapes up front.
- **Self-rejection:** if the lane chooses the in-guard fix (the most likely one), the pins pass untouched and this
  note was informational only; and it is the same finding in three files (deliberately — each is an artifact a
  different lane fleet copies from). No behavioural claim is made beyond the literal asserts.

### IMP-03 · `220_tasklist_canonical.md` (OV-13 row area, §E)
- **Insertion:** exact anchors for the silent-degrade sites and the row shape to copy: catches at
  `engine.ts:3011`/`:3029` (comment-only bodies `:3012`/`:3030`), `store.ts:574` (comment `:575`), plus
  `verify.server.ts`; precedent `liveLayerFailureRow` at `engine.ts:3232` with `LIVE_FAILURE_MESSAGE_BUDGET = 160`
  clip at `:3230`.
- **Evidence (read today):** `grep -n "narrative unavailable|constraints unavailable|liveLayerFailureRow"` +
  `sed -n '3000,3035p'` + `sed -n '3225,3250p' src/lib/engine.ts` + `sed -n '565,585p' src/lib/store.ts`.
- **Class:** 1.
- **Prevents:** a lane re-locating the catches and re-inventing a row shape; anchor drift on a HOT file
  (`engine.ts` is HOT).
- **Self-rejection:** the row already cites `:3012`/`:3030` and the G2 precedent generally; the addition is the
  precedent's exact function line + clip constant. If the fix picks a different row budget, the constant is
  illustrative, not binding.

### IMP-04 · `220_tasklist_canonical.md` (OV-15 row area, §E)
- **Insertion:** the refusal string's exact home `headless.ts:1399-1408` (message `:1405`
  `… or emit with redTree:"banner" …`); today `grep -n 'redTree' scripts/rapidtool-cli.mjs` = 0 **and**
  `grep -n 'banner' scripts/rapidtool-cli.mjs` = 0; banner policy reachable only via the driver
  (`headless.ts:1746-1747` notes run-eval passes "banner").
- **Evidence (read today):** `sed -n '1215,1425p' src/lib/headless.ts` (refusal block + banner branch) +
  the two CLI greps (both 0).
- **Class:** 1.
- **Prevents:** a lane hunting for the advice string in the CLI (it is not there) or "fixing" the wrong end;
  gives both honest fixes (amend message / add flag) with anchors.
- **Self-rejection:** the row already says the advice is unreachable with `grep redTree` = 0; the new content is
  the exact refusal anchor + the second (`banner`) grep also being 0. If the parent prefers to keep the message
  and add a flag, part of the note is moot (still accurate).

### IMP-05 · `220_tasklist_canonical.md` (OV-16 row area, §E)
- **Insertion:** `doctor --tree` is a real flag — `const tree = typeof args.tree === "string" && …` at
  `scripts/rapidtool-cli.mjs:2767` inside `case "doctor":`; the row's probe command needs no change.
- **Evidence (read today):** `grep -n "args.tree" scripts/rapidtool-cli.mjs` (single hit, :2767).
- **Class:** 2 (better verification).
- **Prevents:** a lane treating `doctor --tree` as planned-new and inventing a flag; converts "verified by
  WATCHDOG E" into a citable in-repo anchor.
- **Self-rejection:** E's §6b already verified this flag exists; my addition only pins the line number — the most
  droppable of the 13 if the parent wants a tighter cap.

### IMP-06 · `220_overhaul_plan.md` §4.6 (WB findings area)
- **Insertion:** WB-6 addendum — both artifacts are written by ONE `persist()` call (`run-eval.mjs:1162-1207`):
  `results.json` first (`:1177`), `history.json` second (`:1206`); a kill inside `persist` leaves a fresh
  results.json beside a history row that never landed (M7 priors read history, `priorFor` `:371`). The
  run-start-marker fix should name this pair.
- **Evidence (read today):** `sed -n '1160,1215p' scripts/run-eval.mjs` (single function, sequential writes).
- **Class:** 4.
- **Prevents:** a partial fix (marker on results.json only) that still leaves the two artifacts inconsistent
  after a mid-`persist` kill — the exact misread class WB-6 exists to close.
- **Self-rejection:** WB-6's existing fix shape ("write a run-start marker… or move the old results aside")
  already covers the primary stale-read risk; the pair-order detail is a refinement a reviewer may judge
  second-order. Kept because the refinement is code-verified, not guessed.

### IMP-07 · `220_overhaul_plan.md` §4.8 (CI paragraph)
- **Insertion:** the remote EXISTS today — `git remote -v` → `origin git@github.com:RodneyDanger1/RapidTool.git`
  (fetch+push), so "the repo has no GitHub remote yet per the board" is stale; if a push blocker remains it is
  auth/permission, not remote absence. Plus the field's per-OS habit (aider `ubuntu-tests.yml:25` +
  `windows-tests.yml:25`) → pick the one-workflow runner deliberately; an ubuntu leg cannot catch this repo's
  Windows-path bug class (OV-2's `/workspace` guard).
- **Evidence (read today):** `git remote -v` (+ `git config --get remote.origin.url`);
  `grep -n runs-on aider/.github/workflows/{ubuntu,windows}-tests.yml`.
- **Class:** 5 (consistency) — the file's own text contradicted a verified fact (and AUD-2's §7 said the remote
  is real, so two W13 artifacts disagreed with each other before this note).
- **Prevents:** a CI lane planned around "no remote" (wrong push-blocker diagnosis); a runner choice (ubuntu
  default) that cannot catch the exact bug class this repo ships.
- **Self-rejection:** "board says no remote" may have meant *push access*, not remote config — my insertion says
  exactly what I verified (remote configured) and explicitly flags the interpretation gap rather than ruling on
  access. If the parent knows the board meant access, the note is still true.

### IMP-08 · `221_feature_designs.md` F1 (field's version)
- **Insertion:** codex bounds its local-MCP stdio transport — `bounded_stdio_transport.rs:26
  MAX_MCP_STDIO_LINE_BYTES = 8 * 1024 * 1024`, `pending_line` accumulation for fragments (`:31`),
  close-the-transport on an oversized line (`:56-63`: warn + `pending_line.clear()` + return None). Mirrors into
  this design: pick a byte cap, oversize = coded refusal, test fragmented + oversized frames.
- **Evidence (read today):** clone file read `codex/codex-rs/rmcp-client/src/bounded_stdio_transport.rs`
  (nothing executed).
- **Class:** 3 (competitor lesson).
- **Prevents:** an F1 frame parser that buffers unboundedly or treats oversize as a soft error; gives the "field's
  version" line a concrete bound to answer.
- **Self-rejection:** 8 MiB is *codex's* number, not a protocol requirement — the lesson is bound-and-close
  discipline; if a lane copies the number as if normative, that would be an over-read (flagged in the insertion
  text as "pick a byte cap").

### IMP-09 · `221_feature_designs.md` F4 (field's version)
- **Insertion:** codex's approval policy is concern-granular — `codex-rs/protocol/src/protocol.rs:986
  pub enum AskForApproval { UnlessTrusted ("untrusted"), OnRequest, Granular { sandbox_approval, rules,
  skill_approval, request_permissions } }` (marked experimental `"askForApproval.granular"`; mirrored at
  `app-server-protocol/src/protocol/v2/shared.rs:176`). Lesson: the field expresses granularity as disjoint
  concern sets, which an exact-match narrowing overlay can mirror without a pattern DSL.
- **Evidence (read today):** clone reads (enum + variant bodies; the `#[experimental]` attribute is in the read).
- **Class:** 3.
- **Prevents:** F4 drifting toward a glob/DSL design "to match the field" — the field's own shape is concern
  sets; also prevents citing codex as merely "approval × sandbox" (the row's current level of detail).
- **Self-rejection:** the `Granular` variant is experimental in the clone, so it must not be presented as stable
  API (the insertion says so); and the lesson *supports* the existing design rather than changing it, so a
  reviewer may judge it non-actionable decoration.

### IMP-10 · `223_critical_path_premortem.md` (WB table area)
- **Insertion:** confirming trace (no falsification found): the gate-before-mint order is literal in both seams —
  journey comment `headless.ts:1908-1912` ("record the P6 DoD gate honestly FIRST … NEVER mint
  lastTest:\"tested\" (T0.6 — mint-after-gate)"), `recordGate` `:1917`, mint `:1958`; repair mirror `recordGreen`
  `:2491` (comment `:2493`, `recordGateInto` `:2498`, mint gated on `gate.passed` `:2509`). Both seams need the
  same C-1 fix.
- **Evidence (read today):** `sed -n '1908,1975p'` + `sed -n '2490,2518p' src/lib/headless.ts` +
  `grep -n "recordGateInto(finalProject, 6"` (:2498).
- **Class:** 1 (evidence/confirming trace — exactly the "confirming/falsifying trace" the brief permits).
- **Prevents:** a fix applied to the journey seam only (WB-5's repair mirror has the same ordering, and the
  comment at `:2493` proves it is the same deliberate rule, not an accident).
- **Self-rejection:** the order was already claimed by 223 and parent-verified; a re-confirmation adds no new
  claim, only fresh bytes + the exact comment line — the weakest-new-information entry, kept because it is the
  one the WB-5 fix must not miss.

### IMP-11 · `222_codebase_integration_map.md` (row 4, W14) — re-anchor of IMP-02 (same finding, third artifact)
- **Insertion:** the test-pin landmine this row's "Tests to extend" cell omits — same finding as IMP-02,
  phrased for the seam map: the fix must either live inside `checkedOutputPath` (literals unchanged) or update
  the four pins in the same commit.
- **Evidence (read today):** `sed -n '368,392p' scripts/browser-smoke-verdict.test.mjs` +
  `grep -rn checkedOutputPath scripts/` (callers at `browser-smoke.mjs:30,:32,:33,:41`).
- **Class:** 4.
- **Prevents:** a W14-L4 lane whose ownership box (from this map) omits the test file it will be judged by.
- **Self-rejection:** same finding as IMP-02 (deliberately re-anchored in three artifacts); a strict reader
  could say one location suffices — kept because 222 is the artifact lane briefs copy seams from.

### IMP-12 · `224_advantage_gap_and_plan_audit.md` (§7 CI area)
- **Insertion:** the field's habit is per-OS legs — `aider/.github/workflows/ubuntu-tests.yml:25 runs-on:
  ubuntu-latest` and `windows-tests.yml:25 runs-on: windows-latest` are two separate workflow files in one repo;
  for this repo's one-workflow close the runner is a deliberate choice (Windows-path bug class cannot be caught
  by an ubuntu leg).
- **Evidence (read today):** `grep -n runs-on aider/.github/workflows/{ubuntu,windows}-tests.yml` + `ls
  aider/.github/workflows/`.
- **Class:** 3.
- **Prevents:** treating "one workflow" as a mechanical copy-paste (the runner choice is the substantive part,
  given this repo's shipped-bug profile).
- **Self-rejection:** aider is Python — the lesson is the habit (per-OS legs), not the stack; and 224's #7 already
  argues CI is cheap-and-close, so this only sharpens *how*. A reviewer could call it noise for a non-actionable
  decision (the workflow does not exist yet).

### IMP-13 · `229_steering_and_goal_alignment.md` (after the steer list, §4)
- **Insertion:** steer-2 evidence — the mint shape this decision asks to approve already has its floor in code:
  `failureLessonFromRecord` (`knowledge.ts:1340`) refuses without proof (`verdict: "refuse:no-proof"`, helper
  `:1353-1354`), probe tags spread at `:952`, and the lazy `LessonSurface` seam (`engine.ts:68` type, `:95`
  state — static import forbidden by the node:fs rule `:63-67`) is why the cost is ≈6+≈4 lines, not 6.
- **Evidence (read today):** `sed -n '1338,1362p' src/lib/knowledge.ts` + `sed -n '58,100p' src/lib/engine.ts`
  + greps.
- **Class:** 1.
- **Prevents:** an owner sign-off made on a cost figure without its reason (the lazy seam is the reason) or
  without seeing that the "keep the floor" promise is existing code, not new work.
- **Self-rejection:** the owner may consider the floor's location irrelevant to the yes/no; and the "≈6+≈4"
  figure originates in WD-B — my insertion supplies the *why*, not a new count. Kept because a decision input
  that is checkable is stronger than a promise.

### IMP-14 · `220_external_verification.md` (§2.3 boundary)
- **Insertion:** independent re-verification, same day — `https://api-docs.deepseek.com/quick_start/pricing/`
  fetched 2026-09-24 17:26 UTC by curl (exit 0; 23 982 B saved to `C:/Users/mnril/w13n_scratch/
  ds_pricing_recheck.html`); the page still carries `deepseek-flash` + `deepseek-v4-pro` and the legacy-footnote
  text verbatim: *"still accepted, but the corresponding models have been retired, their requests are served by
  the DeepSeek-V4.1-Flash model and billed at the Flash price."* §2's verdict stands under a second read.
- **Evidence:** the curl command + saved bytes (in scratch, outside the repo).
- **Class:** external re-verification (the file's own insertion rule: URL + quote + date — satisfied).
- **Prevents:** a single-reader dependency for the load-bearing Step-0 model-id claim; also demonstrates the
  claim survives ~30 minutes later.
- **Self-rejection:** E's read is only ~30 minutes older; a same-day re-read is weak independent evidence
  (same day, same page, no change expected) — the least "new knowledge" of the 13. Kept because the file's
  insertion contract allows exactly this and nothing stronger without the key or a browser launch (declined on
  the 8 GB host).

---

## Deferred to the parent (would change a row's MEANING or exceed the brief — NOT inserted)

1. **Competitor lesson for T-107.7 / T4.2 (cline checkpoints + opencode snapshots).** Verified today: cline
   `apps/vscode/proto/cline/checkpoints.proto` (`checkpointRestore` :12, `checkpointViewLatestChanges` :16,
   `checkpointLatestChangesCount` :20) + CLI/desktop picker components; opencode's `snapshot` hits were only
   console migrations (no equivalent found). Could not read the storage mechanism (shadow-git or otherwise), so
   no mechanism claim is made. If the parent wants a "field's version" line for T-107.7, this needs one more
   clone read by whoever owns that lane.
2. **Any recalculation of the MCP client count (7).** Not touched — audited fact; no re-count attempted.
3. **Push-access status implied by the remote.** I verified the remote is *configured*; whether `git push`
   works (auth/keys, the board's "push blocker") was out of scope. Flagged inside IMP-07 rather than claimed.
4. **The §6(b) coverage gaps in the canonical (scheduler / outcome-attributed ranking / patch-format
   breadth).** Already flagged by AUD-2; adding rows (OV-19+) is the parent's/WD chain's move, not mine.
5. **One meaning-changing candidate: re-labeling `store.ts:574` as "silent" vs "fallback".** The catch is
   deliberate with a comment; OV-13 treats it as a silent-degrade site. I only supplied the anchor (IMP-03) and
   did not touch the interpretation — that is a row-meaning question for the parent.
6. **Browser-based external checks** (MCP spec page, OpenHands/Cline docs refresh): declined on the memory-tight
   host; E's reads (same day, ~30 min earlier) stand, and my single curl re-check covers the load-bearing §2.

## Files skipped (hot/other)

- `220_tasklist_canonical.md` — **hot on first four checks** (written by another agent at 12:25:17 and again at
  12:25:37, growing +1.4 KB); canonical insertions were deferred to the post-cooldown pass (still applied; see
  the ledger — the two insertion blocks are flagged below).
- No other file was hot; `220_overhaul_plan.md` and `221_feature_designs.md` were written twice by me and each
  second write waited ≥3 minutes (mtime rule held for every write).

## Insertion index (for the guardian's snapshot/verify)

| file | insertion points (imp-ids, in file order) |
|---|---|
| `220_tasklist_canonical.md` | IMP-01 (before §B) · IMP-02a + IMP-03 + IMP-04 + IMP-05 (before §F) |
| `220_overhaul_plan.md` | IMP-02b (before §4.3) · IMP-06a (before §4.7) · IMP-07 (before the AUD-2 verdict para) |
| `220_external_verification.md` | IMP-14 (between §2.3 and §3) |
| `221_feature_designs.md` | IMP-08 (F1, after the aider line) · IMP-09 (F4, after the codex line) |
| `222_codebase_integration_map.md` | IMP-11 (below the W14 table, before §W15) |
| `223_critical_path_premortem.md` | IMP-06b + IMP-10 (two blockquote lines below the will-break table) |
| `224_advantage_gap_and_plan_audit.md` | IMP-12 (before "Ranked summary + what NOT to close") |
| `229_steering_and_goal_alignment.md` | IMP-13 (between the §4 list and §5) |

## Honest limits

- 0 of ≤3 permitted test runs used (nothing required execution — all claims are static reads + one curl).
- All clone access was read-only (`find`/`ls`/`grep`/`sed`); nothing from `/c/Users/mnril/rt-competitors/` was
  executed.
- Every `file:line` in the insertions was read today **by me**; the one anchor re-derivation inside the inserts
  (`recordGateInto` :2498) was a grep, not a dossier-copy.
- The canonical list changed under me mid-flight (other agents); insertions anchor on heading text, so they are
  position-stable, but the parent should re-read the two inserted blocks at merge time.
