# fixes/250 — W18 · WD-α (quality watchdog) — lanes 1–6

**Watchdog:** WD-α · **Read-only** (this report + `C:/Users/mnril/w18wd_a_scratch/`) · started 2026-09-24 14:04
**Scope:** the six W18 lanes (L1 OV-9 doctor; L2 F3 knowledge+lesson CLI; L3 T4.2 git.server; L4 T5.5 plugin;
L5 T5.4 io/codegen provenance; L6 define-first specs). Base commit `4328d20`, tree interleaved with W16/W17
uncommitted landings (rule: W18 lane touching those = P1).

**Method:** read-only poll of lane boxes every ~2–4 min (mtime+sha1+size) via `w18wd_a_scratch/poll.sh`;
claims re-checked against bytes with pasted commands; FOREGROUND test re-runs only (≤2); no-mock/no-stub hunt
on landed bytes. HOST ARTIFACT (not a bug): node under the background harness dies `stdin is not a tty`;
everything here runs FOREGROUND.

## BOTTOM LINE
**INTERIM (final at close):** 6 lanes polled · 1 P1-candidate resolved to W17's own activity (scaffold.ts — not a
W18 incident) · claims: **17 OK / 0 wrong / 1 watch** · at-risk: **L3** (`RT_E_GIT_UNAVAILABLE` used 9× but not
registered in `src/lib/errors.ts`; the header claims a coded git-absent path) · mid-flight: L1 tests, L5
io.test/codegen.test, all six lane logs still carry PENDING bottom lines.

> **[RECORDER note — W23 LANE 7]** *[RECORDER-FILLED from the author's own summary; author absent]* The
> author's final summary supersedes this freeze's counts: **claims: 20 OK / 0 wrong / 1 WATCH** · incidents: **0
> P1** (the scaffold.ts movement resolved to W17-L4's own G5 landing) · per-lane: L1/L2/L4/L5/L6 on-track,
> **L3 at-risk** on the registration gap. **Hand-off items (author's own list):** (1) run the two planned
> foreground suites (§4) and paste results — **never executed by this lane** (iteration cap; report froze
> INTERIM; no fabricated results); (2) confirm L3's `RT_E_GIT_UNAVAILABLE` registration — **CLOSED** (W23-L7
> re-read 2026-09-26: registered in `src/lib/errors.ts` — ERROR_CODE_DOC `:62`, registry `:482`; 9 uses in
> `git.server.ts`); (3) flip INTERIM→FINAL — **not done** (the runs remain owed; residuals register row 25
> marks this report SUPERSEDED by the W22-WD — which itself never landed; see ledger v4).

## 1 · Timestamped poll log (read-only snapshots; more polls follow)

| # | ts | lane activity observed | bytes changed (sha1 drift) | notes |
|---|----|------------------------|----------------------------|-------|
| p0 | 14:04:59 | L1/L2 logs up (skeletons) | baseline captured (HEAD 4328d20, 38 dirty) | pre-lane baseline; L3/L4/L5/L6 not yet visible |
| p1 | 14:06:12 | L3+L4 skeletons up (14:05); L6 created `research/multiagent/249_define_first_specs.md` (1750 B) | no src edits yet | all lanes in read/plan |
| p2 | 14:06:45 | L5 log absent yet | — | — |
| p3 | 14:07:17 | unchanged | — | — |
| p4 | 14:08:01 | L5 log up (14:07:58, 3754 B) | — | all six lanes now visible (L6 via its spec file) |
| p5 | 14:08:27 | no changes | — | — |
| p6 | 14:11:44 | **first src landings**: L1 doctor.ts (14:10:29), L5 io.ts (14:10:22), L2 knowledge.ts (14:10:36), L4 plugin.ts NEW (14:11:19) | doctor 14137→14649; knowledge 70129→80687; io 18221→22139; plugin NEW 16388 | ⚠ scaffold.ts mtime moved 13:47:57→14:11:37 — investigated: **W17-L4's G5 landing** (its box names scaffold.ts; diff carries `fixes/247 (G5)` comments) → NOT a W18 P1 |
| p7 | 14:13:58 | L2 touched CLI (allowed: lesson arms), L5 codegen landed | cli 138671→141040; codegen.server 155092→155383; doctor →16838; io →23099 | CLI diff hunks ALL in lesson regions (no hunk near `case "summary"`) |
| p8 | 14:14:58 | L3 `git.server.ts` LANDED (14:14:03); L2 knowledge.test.ts updated (14:14:28) | git.server NEW 44015 | plugin.test.ts / doctor.test.ts / io.test.ts pending |
| p9 | 14:16:40 | L4 `plugin.test.ts` LANDED (14:15:35); L6 spec →29.9 KB | git.server →44102; codegen →157104 | — |
| p10 | 14:18:48 | L1 `doctor.test.ts` in flight (imports only, 14:17:22); L3 `git.server.test.ts` LANDED (14:17:45, 26846 B) | — | io.test.ts + codegen.server.test.ts still pre-lane |
| p11+ | — | — | — | — |

## 2 · Claim-vs-bytes verification

| # | claim (source) | command / evidence | verdict |
|---|---|---|---|
| C1 | L1: `doctor.ts:167` gates `productComplete` behind `realMulti && !leftover` (no producer today) | `sed -n '150,175p' src/lib/doctor.ts` | OK |
| C2 | L1/220: sole caller of `evidenceFromJobInventory` passes no `extra` | grep → `headless.ts:3350` (doc said `:3207`; W16/W17 line drift) | OK |
| C3 | L1: `doctor.test.ts:81-92` is the latch-semantics proof | read | OK |
| C4 | L2: design `lessonOutcomeReport` + `lesson --effect` in `221 §F3` | `sed -n '252,331p'` | OK |
| C5 | L2: T-11 red-seal mute exists and stays muted | `engine.ts:1455` comment + L2's landed code says "T-11 stays muted" | OK |
| C6 | L2: lesson family = 7 arms today; `--effect` = 8th | pre-lane arms list (7) + landed diff adds `"effect"` + error string | OK |
| C7 | L3: `.gitignore` half already landed; `git.server.ts` absent pre-lane | `.gitignore` read; scaffold.ts `gitignoreFile()` push (`:2503`) | OK |
| C8 | L4: no plugin module existed; T5.5 row at playbook `:1082` | `ls` absent + grep | OK |
| C9 | L5: no provenance fields in `io.ts` pre-lane | `grep provenance src/lib/io.ts` → 0 hits | OK |
| C10 | L6: DF-09/T4.3/G4 = UNVERIFIABLE-NOW w/ cited candidate definitions | `240_missing_tasks_audit.md:73/82/86/+220:+221:+222` | OK |
| C11 | baseline no-mock: doctor/dod TODO/stub hits are stub-DETECTORS; io.ts clean | grep of both files | OK |
| C12 | L1 landed: `productCompleteFromProject()` derives from real project state (`archProductComplete(archTrace(project))`), `extra` type no longer offers `productComplete` | `git diff src/lib/doctor.ts` | OK |
| C13 | L1 client-safety claim: dod.ts graph has no `node:fs` | dod.ts imports types/algorithms/policy/sandbox — all 0 node:fs; doctor.ts's 3 hits are comments | OK |
| C14 | L2 landed: `lessonOutcomeReport` real census (MIN_N=2, CAP=80), honest small-n labels, "recurrence ≠ causation", read-only | read `knowledge.ts:1540-1680` | OK |
| C15 | L2 box: CLI edits confined to lesson family (summary arm untouched) | `git diff -U0` hunks: only lesson regions + top comment + USAGE | OK |
| C16 | L3 landed: argv-only spawn, allowlisted subcommands, no `shell:true`, seat token via policy seam, host-repo guard | read module header + `GIT_LANDING_SUBCOMMANDS` + spawn site; grep `shell:` = comment only | OK |
| C17 | L4 landed: versioned shape (v1), registration order dispatch, duplicate refusal, coded containment naming the hook | read `plugin.ts` + 20+ test names in `plugin.test.ts` | OK |
| C18 | L4 box: `policy.ts` untouched (`KNOWN_POLICY_ACTIONS` pre-existed at `:102`) | `git status policy.ts` empty + export pre-exists | OK |
| C19 | L5 landed: codegen stamps (`modelProvenance`/`deterministicProvenance`) at the claimed emit sites | `git diff src/lib/codegen.server.ts` hunks @2275/2329/2360/2371 | OK |
| C20 | W17-L4's G5 landing explains scaffold.ts movement (not a W18 touch) | `git diff scaffold.ts` shows `fixes/247 (G5)` additions; 247_lane4 box names scaffold.ts | OK |
| C21 | W16/W17 file set otherwise untouched by all six lanes | p0↔p9 diff of mtimes: only scaffold.ts (W17's own) | OK |
| W1 | **L3 watch:** header claims coded `RT_E_GIT_UNAVAILABLE` on git-absent — the code is used 9× in `git.server.ts` but **not registered** in `errors.ts` (which is NOT in L3's box) | `grep RT_E_GIT src/` → only git.server.ts; `errors.ts` untouched | **WATCH** — must close before final (either reuse a registered code or it is an I13 violation; an out-of-box edit of errors.ts by L3 would be a P1) |

## 3 · Box enforcement (P1 screen)

- **Scaffold.ts movement (14:11:37) = W17-L4 G5, not a W18 incident.** Evidence: `git diff scaffold.ts` carries
  `fixes/247 (G5 · 216y §2.3)` comments; `fixes/247_lane4_emitted_honesty.md` box explicitly includes
  `src/lib/scaffold.ts`; W17-L5's log *declines* the scaffold.ts README half. W17 lanes are still
  finishing (not stale-capped) — this is their own in-flight tuple.
- **No W18 lane has touched any W16/W17-owned file** (run-eval.mjs/test, headless.ts/test, console.tsx,
  styles.css, gates.test.ts, honesty-guards.test.ts, packet.test.ts, README-cli.test.mjs, llm-tasks.ts,
  registry.ts/test, deepseek.ts, engine.ts, phases.ts, token-ledger.\*, verify.server.\*, compile-check.\*,
  220_tasklist_canonical.md) — p0↔p9+ mtime diff: only scaffold.ts (W17).
- **New files** (untracked, as expected): `src/lib/plugin.ts`, `src/lib/plugin.test.ts`, `src/lib/git.server.ts`.
- **Out-of-box edits so far: none** — every lane's diff is inside its stated box (verified per file above).

## 4 · Foreground test re-runs (≤2 total) — PENDING

Plan: Run A = `node --experimental-strip-types --test --test-concurrency=2 src/lib/doctor.test.ts src/lib/plugin.test.ts src/lib/git.server.test.ts` (L1/L4/L3); Run B = same runner over `src/lib/knowledge.test.ts src/lib/io.test.ts` + `node --test scripts/rapidtool-cli-lesson.test.mjs` (L2/L5) — held until the lanes close (L1/L5 tests still in flight). L6 is docs-only (no test; its checks are verified by path existence).

> **[RECORDER note — W23 LANE 7]** Both planned runs were **never executed** by this lane and no fabricated
> results exist. Dated downstream runs on the same boxes (cited, not re-run here): `doctor.test.ts` **20/20**
> (W18-L1's own landing run) — later re-derived **19 pass / 1 fail** on the live worktree (the live-artifact
> red, register row 6); `plugin.test.ts` **23/23** (W18-L4's own landing run); `git.server.test.ts` inside
> W22-L1's **65/65** pair. `knowledge.test.ts` / `io.test.ts` were **not** re-measured in the W20–W22 sweeps —
> labelled as not-re-measured, not claimed.

## 5 · No-mock / no-stub hunt — IN PROGRESS

- Baseline (pre-lane) audit: lane-owned files carried no real stub markers (doctor/dod's TODO/stub hits are the
  product's stub-DETECTORS; io.ts/knowledge.ts/knowledge.test.ts/lesson-test clean).
- Landed so far: (a) L1 — no boolean backdoor: `extra` type omits `productComplete`, producer derivation is real
  (`archTrace`), no fake return; (b) L2 — census math is real, small-n honestly labelled, junk tolerated (not
  silently dropped); (c) L3 — argv-only spawn w/ plan verifier; no stub branches (every branch returns coded);
  (d) L4 — containment returns coded failures (no silent catch); dispatch total; (e) L5 — stamps from real emit
  data (`servedModel`, `Date.now()`, `evidenceHash`/`briefHash`), no invented values; absence stays absent.
- **Tests-that-would-pass-reverted:** checked per suite — plugin tests import the exact module under test and
  assert behaviour (would fail if module reverted); git.server tests exercise real scratch dirs + host guard;
  L1/L2/L5 test bodies still landing — will re-check at close.
- One nuance: L2's diff also fixed the pre-existing `--list` classifier (probe tags reported as class) by routing
  it through the new `lessonClassTag` — in-box (lesson arm), but a behaviour change in an existing arm; watch
  the README-cli parity test.

## 6 · Per-lane verdict + next-dispatch guidance — INTERIM

| lane | state @ p10 | verdict | next dispatch |
|---|---|---|---|
| L1 OV-9 | doctor.ts landed; tests imported but not yet written | on-track | let it finish tests; verify fire+refusal pair |
| L2 F3 | knowledge.ts + CLI + test updated | on-track | verify `--effect` probe run + parity test |
| L3 T4.2 | module + tests landed | **at-risk** | close the `RT_E_GIT_UNAVAILABLE` registration gap (W1) before calling done |
| L4 T5.5 | module + tests landed | on-track | none — await close |
| L5 T5.4 | codegen landed; io.ts in flight; tests pending | on-track | verify io round-trip test + fail-closed contradiction |
| L6 specs | spec file growing (29.9 KB @ 14:16) | on-track | verify zero-code-edit claim at close (`git status` for src/scripts) |
