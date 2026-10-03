# 337-5 Guardian — W51 watchdog log (append-only)

Lane 337-5 (Guardian). Read-only on code; only writes are this log,
`wave_plans/W51/GUARDRAILS.md`, and the narrow J2 rescue (`git checkout HEAD -- <path>`, once,
only on proven destruction). Charter: `wave_plans/W51/README.md`; method reused from
`fixes/335_7_guardian.md`.

## J1 — guardrails published

- `wave_plans/W51/GUARDRAILS.md` written at check-out: ownership table (337-1 Core / 337-2 Pulse /
  337-3 Trust, strict + disjoint), do-not-touch register (`fixes/**` history, `research/eval-out/**`,
  register body, `migrations/**`, `research/eval-corpus/**`, `package.json`, `tsconfig*.json`,
  `scripts/gate.sh`, all of `scripts/**`), append-only log rule, patch discipline, wiring rule,
  no-deletions rule, prohibited ops, gate ownership, STOP-and-REPORT, and the §7 rescue procedure.

## J2 — baseline (T0)

- `git rev-parse HEAD` = `dd6194ce6dcf081503d8ee9b1c904b9d0b36d049` (matches wave-open `dd6194c`).
- `git status --porcelain` = `?? wave_plans/W51/` only. Tree otherwise clean; `git stash list` empty.
- Manifest OUTSIDE the repo: `%TEMP%\rt337_guardian\baseline_all.tsv` — **2046 tracked files**,
  path + index blob (`git ls-files -s`) + working-tree byte size + owner lane. 0 files without a size.
  Owner split: L1=20, L2=67, L3=91, unowned/outside=1868.
- `%TEMP%\rt337_guardian\baseline_manifest.tsv` — the 1868 outside-owned paths (watch list).
- Baseline counts for frozen sets: fixes=679, eval-out=345, eval-corpus=23, migrations=2.
- Monitor script `%TEMP%\rt337_guardian\check.ps1` (read-only, reusable).

### Coverage caveat for the owner (guardian finding, not destruction)

The README's claim that the three hunters are "jointly complete over the functional surface" is
**not accurate**. Functional `src/lib/*.ts` files in NO lane this round include: `prompt-engine.ts`,
`scorecard.ts`, `sandbox.ts`, `sandbox-policy.ts`, `selfmod.ts`, `selfmod.server.ts`, `settle.ts`,
`subagent.ts`, `token-ledger.ts`, `tracing.ts`, `templates.ts`, `server-spec.ts`, `doctor.ts`,
`write-set.ts`, `wild-mode.server.ts`, `wild-review.ts`, `websearch.server.ts`, `tavily.server.ts`,
`fixtures*.ts`, `brief-fixtures.ts`. Treated as frozen by GUARDRAILS §1/§2.

## Monitor checks

### Check 1 — 2026-10-02 20:11:53
HEAD=dd6194c (unchanged) | STASH=0 | reflog clean | CHANGED_TRACKED=0 DELETED=0
OUTSIDE_OWNED_CHANGED=0 NEW_TRACKED=0 | UNTRACKED=2 (fixes/337_4_verifier.md, wave_plans/W51/) |
SUSPECT_UNTRACKED=none -> CLEAN

### Check 2 — 2026-10-02 20:15:22
HEAD=dd6194c (unchanged) | STASH=0 | reflog clean | CHANGED_TRACKED=0 DELETED=0
OUTSIDE_OWNED_CHANGED=0 NEW_TRACKED=0 | UNTRACKED=4 (my log + GUARDRAILS + verifier log + wave dir) |
SUSPECT_UNTRACKED=none -> CLEAN

### Check 3 — 2026-10-02 20:18:25
HEAD=dd6194c | STASH=0 | reflog clean | CHANGED_TRACKED=6 DELETED=0 OUTSIDE_OWNED_CHANGED=0
NEW_TRACKED=0 | L1=0 L2=6 L3=0 (Pulse starting) | untracked: fixes/337_2_pulse.md + prior | CLEAN.
In-domain check: all 6 are L2 — `src/lib/auth/gate-session.server.ts`, `auth/middleware.ts`,
`auth/pglite-dialect.ts`, `auth/server.ts`, `crew.server.ts`, `db.ts`. No deletion, no truncation,
no outside-owned edit.

### Check 4 — 2026-10-02 20:21:26
HEAD=dd6194c | STASH=0 | reflog clean | CHANGED_TRACKED=13 DELETED=0 OUTSIDE_OWNED_CHANGED=0 NEW_TRACKED=0
L1=6 L2=7 L3=0 | untracked new: `src/lib/auth/auth-import-contract.test.ts`, `src/lib/db-bootstrap.test.ts`
(L2 test additions) | CLEAN. All changed in-domain.

### Check 5 — 2026-10-02 20:24:32
HEAD=dd6194c | STASH=0 | reflog clean | CHANGED_TRACKED=19 DELETED=0 OUTSIDE_OWNED_CHANGED=0 NEW_TRACKED=0
L1=8 L2=7 L3=4 | CLEAN. L3 started: codegen.server.ts(+test), verify.ts(+test).

### Check 6 — 2026-10-02 20:27:35
HEAD=dd6194c | STASH=0 | reflog clean | CHANGED_TRACKED=19 DELETED=0 OUTSIDE_OWNED_CHANGED=0 NEW_TRACKED=0
L1=8 L2=7 L3=4 | untracked new: `fixes/337_1_core.md` (Core's log now present) | CLEAN.
All 19 changed files map to their owning lane; no deletion, truncation, outside-owned edit, or
secret/probe/binary add.

## J3 peruse — independent findings (unowned functional modules; read-only)

Method: read the functional `src/lib/*.ts` modules that fall in NO hunter's lane, plus a
pattern census (TODO/as-any/ts-suppress/empty-catch) over that set. The repo is heavily
pre-audited; findings are minor. All are REPORTED, none fixed.

- **F1 (process, for the delegator): the wave README's "jointly complete" coverage claim is
  false.** ~20 functional `src/lib/*.ts` modules are in no lane this round:
  `prompt-engine.ts`, `scorecard.ts`, `sandbox.ts`, `sandbox-policy.ts`, `selfmod.ts`,
  `selfmod.server.ts`, `settle.ts`, `subagent.ts`, `token-ledger.ts`, `tracing.ts`,
  `templates.ts`, `server-spec.ts`, `doctor.ts`, `write-set.ts`, `wild-mode.server.ts`,
  `wild-review.ts`, `websearch.server.ts`, `tavily.server.ts`, `fixtures*.ts`,
  `brief-fixtures.ts`. So a "wire" followed out of a hunter's lane can land in a file nobody owns.
- **F2 (nonsense, minor): `src/lib/write-set.ts:59`** — `const absCmp = (absNorm + (absNorm.endsWith(sep) ? "" : "")).replace(...)`:
  the ternary has identical branches (`"" : ""`) — dead code, no behavioural effect.
- **F3 (robustness, minor): `src/lib/websearch.server.ts:349`** — `wikipediaSearch` computes the
  URL with `(r.title ?? "").replace(/ /g, "_")` while the sibling field read guards
  `typeof r.title === "string"`. A non-object `null` entry is hardened (W40·K4) but a
  non-string `title` (e.g. a number) throws a TypeError that fails the whole Wikipedia
  provider (the last fallback) — inconsistent with the module's own stated hardening.
- **F4 (robustness, minor): `src/lib/sandbox.ts:573`** — `verifyClaims` validates `kind` and
  `target` but calls `c.expect.toLowerCase()` unguarded; a hostile `contains-identifier`
  claim with a non-string `expect` throws out of a function documented as pure/hostile-tolerant.
- **F5 (leak, minor): `src/lib/sandbox.ts` `runSandboxed` (~466-476)** — if `URL.createObjectURL`
  succeeds and `workerFactory` then throws, the catch returns `{ok:false,"worker unavailable"}`
  without `URL.revokeObjectURL(blobUrl)`. Small blob-URL leak on the failure path.
- **F6 (design limitation): `src/lib/subagent.ts` `normalizeScopeEntry`** — sibling-overlap is
  exact-equality only (documented): two tasks claiming `src/lib` and `src/lib/x.ts` are not
  flagged as overlapping, so the "parallel children cannot fight over the same files" guarantee
  does not hold for directory-vs-file scopes.
- Clean (no findings) after full read: `templates.ts`, `server-spec.ts`, `wild-review.ts`
  (shell, wired correctly into store.ts:1350 + headless.ts:5124/5314 via `...(reviewer ? {reviewer} : {})`),
  `fixtures.server.ts`, `fixtures.review.ts`, `tavily.server.ts`, `token-ledger.ts`,
  `error-component.tsx`, `settle.ts`, `sandbox-policy.ts`, `prompt-engine.ts`, `tracing.ts`.

- **F7 (real defect, moderate): `src/lib/scorecard.ts:220-228` vs its own honesty contract.**
  `readEntry` stores a PRESENT criterion cell whose `score` is non-numeric as
  `criteria[id] = { score: 0, evidence }` (only a side `missingCriteria[]` flags it). The
  module's contract (lines 28-30) says an absent criterion "stays absent — never defaulted to 0
  (a 0 is a SCORE; absence is absence)". Downstream ignores `missingCriteria`:
  `aggregateCriteria` (line 515-519) counts the synthesised 0 as a real scored cell
  (`scoredBy`/`possible`/`zeros`), and `buildDelta` (line 554-556) reads
  `entry.criteria[id]?.score` as a number → a malformed current row fabricates a `0 − before`
  per-criterion delta and a `down` direction. Trigger: a results.json entry whose criterion cell
  is `{evidence:…}` with no numeric `score`. Not destruction; a correctness/honesty gap for the
  owner (scorecard.ts is in no lane).

## J2 — checks 7-15 (all CLEAN)

Checks 7-15 (20:30:35 → 20:54:38): HEAD=dd6194c, STASH=0, reflog clean, `fixes_tracked_now=679
(baseline 679)`. CHANGED_TRACKED=19, DELETED=0, OUTSIDE_OWNED_CHANGED=0, NEW_TRACKED=0, UNTRACKED=9;
OWNED_CHANGED stable at L1=8 L2=7 L3=4; SUSPECT_UNTRACKED=none. The 19-file set and the 9 untracked
entries were byte-stable from check 5 to check 15. No rescue was ever needed.

## J3 — wave audit (hunters reported final verdicts; tree stable 30 min)

### A. Claims vs bytes, per lane (every falsifiable claim re-checked on disk today)

| Lane | Landed claim | Bytes on disk | Test delta HEAD→tree |
|---|---|---|---|
| 337-1 Core | gate-stats raw-mean boundary; compaction cap-64..90 truncated marker; planning id marked cut; headless nextAction id-keyed | `gate-stats.ts:79/83/92` `rawMeanLatencyMs`; `compaction.ts:258` `out.length > cap \|\| !out.includes(marker)`; `planning.ts:163` `cutToChars(o.id.trim(), PLAN_ID_MAX_CHARS)`; `headless.ts:1634/:1675` `phases.find((r) => r.id === project.currentPhase)` | gate-stats 13→14, compaction 19→20, planning 16→17, headless 141→142 — **MATCH** |
| 337-2 Pulse | auth `.ts` specifiers; pglite parameter-properties→fields; db.ts bootstrap no-rethrow; plan-act uses validated roles | `auth/server.ts:41/48/267`, `auth/gate-session.server.ts:11-12`, `auth/middleware.ts:41-42` all explicit `.ts`; `pglite-dialect.ts:45/118` plain constructors (no param props); `db.ts:283-290` catch logs, no `throw`; `auth/server.ts:55` `.catch`; `crew.server.ts:1170` cfg.roles | crew 51→52; new `auth-import-contract.test.ts` 2; new `db-bootstrap.test.ts` 1 — **MATCH** |
| 337-3 Trust | verify evidence-hash boundary-separator at 3 twin sites | `verify.ts:173` and `codegen.server.ts:3498` + `:3586` all `` `${…}\u0002${…}` `` | verify 26→27, codegen.server 179→180 — **MATCH** |

Diff totals also match the logs exactly: 337-1 `+116/−13` over 8 files; 337-2 `+59/−13` over 7
tracked files (+2 new). No falsifiable claim was found false.

### B. Destruction audit (whole diff)

- **Deletions: NONE.** 19 tracked files changed, all `M` (0 `A`/`D`/`R`). No path removed.
- **Mass rewrites: NONE.** Largest proportional change is `gate-stats.ts` +10/−3 over 97 lines
  (13.4%); next `middleware.ts` 12.8% (47 lines), `gate-stats.test.ts` 12.3%; every other file
  <11%. All hunks are small and surgical.
- **Do-not-touch: NONE.** 0 of the changed paths are under `fixes/**`, `research/eval-out/**`,
  `research/eval-corpus/**`, `migrations/**`, `scripts/**`, `package.json`, `tsconfig*`, or the
  register. Frozen counts unchanged: fixes 679, eval-out 345, eval-corpus 23, migrations 2.
- **Ownership: clean.** All 19 tracked files fall inside an owning lane (L1 8, L2 7, L3 4). No
  unowned/`scripts/**` file changed.
- **New in-repo files:** 5 logs (`fixes/337_{1..5}_*.md`, untracked), `wave_plans/W51/README.md` +
  `GUARDRAILS.md`, and 2 new tests (`src/lib/auth/auth-import-contract.test.ts`,
  `src/lib/db-bootstrap.test.ts`). No probe/scratch file, no secret, no binary, no `.t4scratch`.

### C. Loss audit

- `git stash list` empty at all 15 checks. `git reflog -n 15` shows only the pre-wave commit
  history — no reset/rebase/checkout/stash/merge/revert/branch op; HEAD constant `dd6194c`; no
  commits made by any agent.
- `fixes/**` tracked history intact (679 = baseline); every prior-wave log byte-unchanged.
- Each lane's log appeared progressively (Core 20:27, Pulse 20:18, Trust 20:30) and none was
  rewritten, truncated, or deleted.

### D. Progress table

| Lane | Brief | What actually landed | Bytes | Tests | Compliant |
|---|---|---|---|---|---|
| 337-1 Core | engine/drivers/persistence | 4 real defects fixed RED-first: gate-stats rounded-mean boundary; compaction truncated elision marker at cap 64..90; planning silent id truncation; headless `nextAction` positional read | 8 files, +116/−13 | +4 (14/20/17/142) | yes |
| 337-2 Pulse | surface/AI runtime/transports | auth cluster made Node-loadable (7 specifiers + parameter properties); db.ts process-killing unhandled rejection removed; plan-act role-validation loss fixed | 7 tracked (+2 new), +59/−13 | +4 (crew 52; +2 new files) | yes (one ownership nuance) |
| 337-3 Trust | emissions/verification/learning | verify evidence-hash boundary conflation fixed at 3 twin sites (collision + silent drop) | 4 files, +83/−3 | +2 (verify 27, codegen 180) | yes |

**Ownership nuance (parent action):** 337-2 added `src/lib/db-bootstrap.test.ts` (a test for `db.ts`'s
bootstrap). `db.ts` is L2-owned and "their tests" is claimed, but the basename `db-bootstrap` is not a
literal member of L2's enumerated set. Recommend the parent bless it as `db.ts`'s test (no destruction,
not scratch, lives in `src/lib/` because that is the only discovered test glob). 337-2's other new file,
`src/lib/auth/auth-import-contract.test.ts`, is inside L2's `auth/**` glob.

### E. Gate sanity (targeted; the parent owns the full gate)

- `npx tsc --noEmit`: **exit 0**, 0 errors.
- `npm run lint`: **exit 0**, 0 warnings.
- Targeted suites (all 9 changed/new test files, pinned Node 22.23.2, TAP):
  **# tests 455 · # pass 455 · # fail 0 · # skipped 0**.
- NOT run by me (parent boundary): `npm test` (full 411 scripts + lib), `npm run build`,
  `bash scripts/gate.sh`, `npm run eval`.

### F. Cross-domain reports verified (read at the cited lines; not edited by anyone)

- 337-1/337-3 `src/lib/node-runner.server.ts:98/110/130` — real duplicate of the compaction defect:
  `clampRunnerOutput` has the same `cap < 64` guard and `out.length <= cap ? out : out.slice(0, cap)`
  fallback, so caps 64..90 truncate the marker. Confirmed. Owner: fix in a later lane (two writers).
- 337-3 `maker-score.ts:477` unguarded `gate.evidenceHash.slice(0,8)`; `entry-oracle.ts:377/385`
  vacuous `complete`/`pending`; `preview-embedder-origin.ts:62-63` sandbox-guest trusts any parent —
  all three confirmed at their lines.
- 337-2 `console.tsx:2404` `void rejectAsync(...).then(...).finally(...)` has no onRejected —
  confirmed (defensive-only today).
- 337-2 `scripts/check-module-coverage.mjs` stale allowlist reasons — `scripts/**` is unowned; the
  claim is a STOP-and-REPORT for the parent, not verified line-by-line by me.

**Destruction verdict: NO DESTRUCTION OBSERVED.**
