# fixes/292_l2_uiux.md — L2 · THE UI/UX REMAINDER (W40 lane L2)

**Lane:** W40 L2. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash). **HEAD:** `2fa3cd9` (clean tree at lane start; only `?? fixes/290_k8_records.md` untracked).
**Scope:** the UI items NONE of K1–K15 own — R6's outstanding rows (verify each; several are already landed), S5 Part B leftover surfaces, the help/onboarding/docs-in-app surfaces, honest-label/disabled-with-reason gaps in `console.tsx` (FixturesPanel pattern).
**Rules:** additive-only in UI (never remove a control) · smallest honest patch per item + an evidence line (component:line → state shown) · CODE + scoped eslint where quick · NO full gates · NO keyed calls · re-read every target region immediately before its patch · lower-ID lane wins any console.tsx/routes conflict.
**Log discipline:** this file lands EARLY and is appended after every landing (evidence = command + observed output).

## [t0] Mandatory reads (verified this session)

- `research/multiagent/thoroughanalysis.md` §R6 worklist (:1370-1386) + the W-27 register rows (:1259 W-29, :1399-1408 §R6 folds, WA-01) + §C6 H4/A4 rows (:79-251).
- `fixes/281_n3_ui.md` (N3's surfacing: ShellSurfacesCard + §S5 append — verified live below).
- `fixes/276_f3_ui_close.md` (24-line skeleton; its byte-state table never landed).
- `fixes/272_s5_finish_ui.md` §B (the 6 planned S5 surfaces) + `fixes/272_s4_floor.md` §3 (the two clobber-check hunks for R6-f12).
- `fixes/290_k8_records.md` (W40 lane-log discipline) — the only K-log on disk at t0; K5/K7 logs absent → treat console.tsx/routes with additive, anchor-re-read discipline.

## [t0] Byte-state table (R6 rows re-verified in the CURRENT tree — code = truth)

| R6 row | Verified state at t0 | Verdict |
|---|---|---|
| R6-f01 busy-latch | `onRunModule` :2238 has `busyRef` latch + try/catch/finally; union :1915 has `"module"`; spinner :2847 | **DONE** (no action) |
| R6-f02 autonomy overclaim ×4 | `grep -rn "autonomous software" src/` → 2 comment-only hits (rules), 0 claims; `index.tsx:9`, `__root.tsx:41`, `og/site.json:1` reworded | **DONE** |
| R6-f03 fixtures label ×3 | all three files carry "approval is a CLI action (fixtures --approve --ids …)"; `grep "approving here" src/` → 1 comment-only hit (:496) | **DONE** |
| R6-f04 sandbox ×3 UI strings | `:1522` SHORTCUTS · `:2081` a-key error · `:3914` override checkbox all say "bounded-runner" | **DONE** |
| R6-f05 census measured | README.md:188-192 carries `{stubs:0, reexports:4, real:1}` + `{0,4,1}` + the `{0,5,0}` vintage note | **README done; AGENT_GUIDE + in-app Guide OWED → this lane** |
| R6-f06 ingest vs "no live feedback channel" | AGENT_GUIDE.md:69 still reads "RapidTool has no live LLM/research/sandbox feedback channel…"; `ingest` ships (`rapidtool-cli.mjs`, console Ingest panel) | **OWED → this lane** |
| R6-f07 Home help + 12-char hint | "How it works" button :1731-1739 (spawns GuideDialog) + `{n}/12` hint :1781-1791 | **DONE** |
| R6-f08 manifest dependency | owner decision; record only | record in log |
| R6-f09 `.env` split | R7's box (check at close) | out of lane |
| R6-f10 Autopilot label/title | label = "Autopilot · auto-approve eligible gates" :2687 + title present | title DONE; caption shape re-checked below |
| R6-f11 paused badge tone | :1292/:1302 both use `wildPaused(wild.run)` | **DONE** |
| R6-f12 pane boundary + RunScreen | `PaneBoundary` :1642 exists, HomeScreen wrapped :1745-1846; **RunScreen NOT wrapped**; `markBoundaryError` dedupe missing from `componentDidCatch` (S4's hunks clobbered per `fixes/272_s4_floor.md` §3) | **PARTIAL → this lane** |
| R6-f13 "Phase n of 13" | :1834 `Phase {p.currentPhase + 1} of 13` with `title={P{n}}` | **DONE** |
| R6-f14 `?? arts[arts.length-1]` → `?? null` | :6307 ends `?? arts[arts.length - 1] ?? null;` | **DONE** |
| R6-f15 advanced-tier Tabs a11y | verify region :3217/:3241 | verify → this lane (record) |
| W-29(g) fixtures README fake row | `fixtures.server.ts:54` filters only `*.md` → `research/eval-corpus/README.md` (no frontmatter) becomes a fake "bar-missing" row | **OWED → this lane** |
| W-29(h) H4 suspicions | `PhaseRecordView` `project.phases[phase]` → `rec.status` unguarded (~:6309); `PHASES[...]` bare-index sites :2746/:2754/:2757/:2817/:3626 (`:2319` already guarded) | **confirm-then-fix → this lane** |
| T5.3 client-reachability | `buildScorecard` used ONLY by `rapidtool-cli.mjs:1464`; no server-fn wrapper; console `ScorecardBlock` reads `project.scorecard` (phase-0 feasibility — a different row) | assessed below |
| T5.2-A honest store action / orphans | Disposition RECORDED in the `FixturesPanel` doc comment :460-470 (declare-or-strike); `fixtureDecisionEntry` still 0 consumers | record-only (no fake seat) |
| ShellSurfacesCard (S5 §B 1-6) | live :6714 + render :3546 (plan/checkpoint/unattended/stream/cassette/seat/isolation rows) — seat/isolation modules NOT on disk (S4 capped; codes NOT in errors.ts) → card labels stay honest | **DONE** |

## Plan (locked)

1. R6-f12 remainder: `markBoundaryError` import + dedupe call in `componentDidCatch`; wrap RunScreen body in `<PaneBoundary label="Run screen">` (S4's two hunks, re-applied).
2. W-29(g): `fixtures.server.ts` — non-frontmatter docs stop minting fake rows; each skipped doc lands in `problems` with its reason.
3. W-29(h): guard the two H4 suspicion sites (`PhaseRecordView` record lookup; the bare `PHASES[...]` index renders) with honest fallbacks.
4. R6-f06 + in-app help: AGENT_GUIDE §4 names `ingest --report …` + the console Ingest panel (localStorage caveat kept); in-app Guide gets the same one-line honesty.
5. R6-f05: AGENT_GUIDE §1/§2 get the reconciled P6 story + measured census `{0,4,1}` (README is the anchor).
6. R6-f10 caption + R6-f15 a11y + W-29(d) manifest record: verify / record.
7. Scoped checks: eslint on every touched file; static greps; NO gates/keyed calls.

## Log (append-only)

- [t0] Lane start. All mandatory reads + the byte-state table verified by direct reads/greps on THIS tree at `2fa3cd9`. Decision: 11 of the 15 R6 rows are already landed — this lane lands the remainder (f12 RunScreen+dedupe, f05/f06 docs, W-29g/h) and records the verify-only rows with evidence.
