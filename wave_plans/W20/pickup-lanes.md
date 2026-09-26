# W20 · LANES 1–4 + WD-α + WD-β(v3) — PICKUP: finish the 3 dead lanes + drive the keyed run's named zeros

**All readers share this file.** Read your own section. Repo: `C:\Users\mnril\Desktop\RapidTool Main`
(Node v22.23.2; git-bash `/c/Users/mnril/Desktop/RapidTool Main`; SPACE → ripgrep FAILS, use `grep`).

```text
STATE: committed at 8e25180; 64 files uncommitted on top (W18's landings + W19's 3 landed lanes + logs).
W19 batch died mid-flight at ~14:51 ("delegation owner exited") — 3 lanes LANDED (F4=fixes/252_lane2,
OV-7=252_lane4, T5.7=252_lane6) and 3 are SKELETONS (OV-13=252_lane1, T5.1=252_lane3, F2=252_lane5).
If your lane is a pickup: FIRST read your skeleton log + `git diff` your files — if partial edits exist,
COMPLETE/FIX them (never restart from zero, never duplicate).

THE KEYED RUN HAPPENED (owner supplied the key). run #1 = 5/9, run #2 = 6/9, both `dod`, both in
`research/eval-out/history.json`. Run #2's notes NAME the remaining zeros' single cause:
  treeRunOk: false · stall "P6 DoD unmet: p6-verified, p6-brief-fit, p6-arch" · p6Refused: true ·
  synthesisSucceeded: true · emitError: null · acceptance filesOk:true contentOk:true BUT pass:false.
Run #2's emitted artifact is ON DISK: research/eval-out/coffeehouse2home-property-ledger/ (fresh).

⚠️ HOST ARTIFACT: node under Hermes's BACKGROUND harness dies `stdin is not a tty` exit 1 zero output —
run node tests FOREGROUND; that message is never a bug (C:/Users/mnril/w15_parent_evidence.txt).
⚠️ If you need a keyed call: DEEPSEEK_API_KEY is set in .env — but stay keyless unless your row
REQUIRES it; keyed runs cost money and the owner's instruction is FLASH ONLY (never deepseek-v4-pro).

QUALITY BAR: production-ready, no stubs/mocks/fake returns; a test that would pass with your change
reverted is a finding. Every claim = the command that produced it. Do-not-rebuild list (220_tasklist §2)
BINDING; no eslint-disable. WRITE EARLY: skeleton + bottom line within ~10 calls
(`fixes/255_lane<N>_<slug>.md`). FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build` (parent).
Scratch: `C:/Users/mnril/w20l<N>_scratch/`. Row how-tos: research/multiagent/230_task_execution_playbook.md.
The error register so far: fixes/254_error_ledger_v2.md (read it; add `[EXT-FAIL]` rows for what you see).
```

## LANE 1 — OV-3 + OV-4 · make the emitted tree's tree-run GREEN (the critical path to M2/M3/M4)
**Owns:** read-only diagnosis of `research/eval-out/coffeehouse2home-property-ledger/` (the fresh run-#2 emit);
edits allowed in `src/lib/scaffold.ts` / `src/lib/engine.ts` (scaffold emission + the tree-run wiring) and
their tests — NOT headless.ts's C-1 seams, NOT the run-eval drain.
Run the emitted tree's own tests YOURSELF first (`cd` into the emitted dir; run its `npm test`/vitest per its
own package.json — keyless, local). Find WHY `treeRunOk:false` and report the exact failing assertion(s).
Then decide: is the failure (a) a real defect in what RapidTool emits (→ fix the emitter, RED-first), or
(b) a defect in the emitted artifact's own tests/spec (→ fix the emitter's spec template)? **This is C-1's
counterpart: once the tree-run is genuinely green, the mint fires and p6-verified can be satisfied.**
If the fix is larger than one seam, STOP at a proven diagnosis + the patch proposal and say so.
**Done-when:** the exact failing test + its output pasted; if fixed, the emitted-tree run is green with the
command shown; scaffold/engine targeted suites stay green.

## LANE 2 — OV-5 + the acceptance oddity · why `pass:false` when files+content are OK
**Owns:** `src/lib/gates.ts`/`scorecard`-adjacent readers (read-only where the clause lives out of box),
`research/eval-corpus/graders/coffeehouse2home-property-ledger.grader.json` (read-only diagnosis).
Two questions, both from run #2's record: (1) `acceptance.pass:false` with `filesOk:true` + `contentOk:true`
— find the THIRD clause and name why it fails (is `checked.expectedContent:1` unsatisfied? a domain-match
clause? read the code that computes `pass`). (2) `p6-brief-fit` + `p6-arch` unmet — read what each probe
requires and check the emitted artifact against it (the artifact is on disk). Write the finding as a
precise, code-cited diagnosis + the smallest fix proposal per probe. **Diagnosis-first lane: edits only if
the fix is a small, testable seam inside your box** (state the box in your log).
**Done-when:** each of the three clauses (acceptance.pass, p6-brief-fit, p6-arch) has a file:line-cited
reason + a proposed fix; if a fix landed, its test is green.

## LANE 3 — PICKUP: OV-13 + OV-29 (the skeleton is yours — finish or fix it)
**Owns:** `src/lib/headless.ts` (:208/:231 region + silent-skip region — NOT the summary envelope, NOT C-1's
seams), `src/lib/engine.ts` (:3010-3012/:3028-3030 catch sites), the lesson-writers pin region.
FIRST: read `fixes/252_lane1_ov13.md` (37-line skeleton) + `git diff` on your two files. If the dead lane
left partial edits, complete them; if none, do the row: a keyed failure must leave a coded visible row
(`[EXT-FAIL]`-free, G2-pin style per `lesson-writers.test.ts:327-408`).
**Done-when:** the G2-style pin proves a keyed failure row ≠ keyless row; `headless.test.ts` (92/92 base) +
lesson-writers green; both sites named with lines.

## LANE 4 — PICKUP: T5.1 + F2 (two skeletons, disjoint files — finish both)
**Owns:** `src/lib/chat.ts` (+ test) + a new `scripts/chat-stream.test.mjs` (T5.1); `src/lib/llm/providers/registry.ts`
(+ `registry.test.ts`) and provider modules (F2 — additive only; DeepSeek pins untouched).
FIRST: read `fixes/252_lane3_t51.md` (23-line skeleton) + `fixes/252_lane5_f2.md` (31-line) + `git diff` the
files. Complete what the dead lanes started; if untouched, do the rows per the W19 brief
(`wave_plans/W19/lanes-and-watchdogs.md` LANE 3 + LANE 5 sections — read them).
T5.1: transport spike first, then ordered-chunk NDJSON test + coded terminal error path.
F2: ONE second provider family, live-probed (curl the docs; paste raw evidence), never an unprobed id.
**Done-when:** chat + registry/llm suites green (registry 29/29 + llm 14/14 base); the probe evidence pasted.

---

## WD-α — quality watchdog (`fixes/256_w20_wd_alpha.md`)
READ-ONLY (report + `C:/Users/mnril/w20wd_a_scratch/`; no repo edits; ≤2 FOREGROUND runs).
Poll all 4 lanes ≥4× (timestamped action log); ≥10 claim-vs-bytes checks with box enforcement (any
out-of-box or W18/W19-landed-file touch = P1 with git evidence); one named test re-run per lane (≤2 total);
no-mock/no-stub hunt; on-track/at-risk/stuck verdict + next-dispatch guidance. Bottom line at top.
ALSO: verify the three W19 landings (F4/OV-7/T5.7) against their logs — their own watchdogs died before
certifying, so you inherit that duty: are their claims backed by bytes?

## WD-β — ERROR LEDGER v3 (`fixes/257_error_ledger_v3.md`)
READ-ONLY (ledger + `C:/Users/mnril/w20wd_b_scratch/`; ≤2 FOREGROUND runs).
Extend `fixes/254_error_ledger_v2.md` (append + supersede-by-marking only). New rows this wave:
(1) **THE BATCH-DEATH INCIDENT**: W19 died with "delegation owner exited before recording a terminal
result" — 3 lanes landed, 3 skeletons; record each lane's disposition (landed/skeleton/partial-edit) with
the disk evidence (log line counts + mtimes). (2) run #1 → run #2 deltas: `emitError` nulled, M6 0→1, the
stale-dir root cause. (3) `acceptance.pass:false` oddity. (4) any `[EXT-FAIL]` your lanes log.
Re-run the two living diagnostics FOREGROUND: `headless.test.ts` (expect 92/92) + `npm run lint`
(check W19's landed lanes didn't break it — 3 lanes landed since the last measurement).
Bottom line: `total: N · open: N · fixed: N · env-artifact: N · ready-to-fix-now: N` + the ordered
shortlist. Skeleton first.
