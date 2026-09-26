# fixes/252_lane4_ov7.md — W19 LANE 4 · OV-7 · eval-corpus expansion + grader-freeze audit

**Lane:** W19-L4 · **Row:** OV-7 (`230_task_execution_playbook.md:899-920`, canonical `220:95`) · **Tree:** 8e25180 + W18/W19 uncommitted landings
**Owns:** `scripts/run-eval.mjs` (corpus/grader loading ONLY) · `research/eval-corpus/**` · `scripts/run-eval.test.mjs` · this log
**Scratch:** `C:/Users/mnril/w19l4_scratch/` (`run1.log`, `run2.log`, `freeze-probe.log`, `main-out/`, `freeze-out/`, `freezecorpus/`)

## BOTTOM LINE

```text
corpus:     6 fixtures / 1 domain with ≥2 fixtures  →  7 fixtures / 2 domains with ≥2 fixtures
            (new: permit-inspection-tracker.md + its grader — second `construction` fixture; authored, NOT transcribed, and it says so)
freeze:     was UNSCOPED (no run-level check existed) → now fingerprint-at-plan + re-verify-before-persist;
            a REAL mid-run grader edit against the driver was CAUGHT and recorded, not averaged in
leak scan:  emitted-tree-only → emitted tree + AGENT-FACING brief/name (briefLeakScan)
tests:      scripts/run-eval.test.mjs 25/25 → 30/30 (5 new OV-7 pins, section (e)) · 0 fail
runs:       keyless `npm run eval -- --trials=2` ×2 (scratch out dir) → run#2 shows M7=1 citing "prior same-domain"
            for all 7 slugs across BOTH domains; `graderFreeze {checked:7, ok:true, changed:[]}`
drain/stop: UNTOUCHED — `git diff` deletions on run-eval.mjs are exactly 5 signature/call lines (below), all re-added additively
```

## Scope / ground rules (respected)

- Playbook OV-7: expand the corpus so M7 is measurable across ≥2 domains; audit the freeze (graders live in
  `research/eval-corpus/graders/`, load via `:260 graderFileFor`/`:318 loadGrader`; leak scan `:608 graderLeakScan`).
- Traps named by the playbook: never edit a grader to make a run pass · a new domain whose brief duplicates an existing one · a leak scan
  that only checks the emitted tree misses grader text in the *brief* (all three addressed; §Audit).
- `--trials=2` in ONE invocation is two trials of one run — it does NOT substitute for run #2 (235 §17/OV-5). The M7 demonstration
  below is therefore **two sequential invocations**; the keyed run-#2 citation path stays OV-8 (owner-run).
- Node runs FOREGROUND only (host artifact). No `npm run typecheck` / `npm test` / `npm run build`. No eslint-disable. No stubs.

## Landing — corpus (a)

**Before:** 6 fixtures — `real-estate`×5 + `construction`×1 (`field-ops-suite`). A single construction fixture means no
same-domain peer exists inside it: the M7 prior is citable inside exactly one domain.

**After:** + `research/eval-corpus/permit-inspection-tracker.md` (brief: permits → authority status/expiry, per-permit
required inspections with an assigned inspector, pass/fail results with deficiency punch lists + re-inspection dates,
per-project compliance summary) + `research/eval-corpus/graders/permit-inspection-tracker.grader.json` (same schema as the
six existing graders; acceptanceBar = the acceptance line; expectedFiles package.json/index.html/README.md +
`"test"` in package.json — the emitter's real output, verified in run #1 below).

**Honesty of the new fixture:** it is **authored, not transcribed** — no dossier and no run behind it; its `baseline` reads
"not yet measured — authored 2026-09-24 by W19-L4 (OV-7) …". The corpus README's layout, provenance table and a new
"Domain spread & the M7 reading (OV-7)" section say the same. Nothing was copied from an existing brief (pinned by test #26).

**M7's honest reading (stated, per playbook):** the prior is read by SLUG (`priorFor`) — a slug's first run reports
"no prior same-domain run" (M7=0), a new domain starts with no prior until its first run records one. Run #1 below shows
exactly that state; run #2 shows the citation.

## Audit — grader freeze (b)

**Attack surface found (pre-change):** the driver loaded each grader ONCE at plan time (`planTargets` → `loadGrader`) and scored
every trial against that in-memory object — but **nothing re-checked that the file had not moved while the run was in flight**.
A grader edited mid-run silently graded against the stale in-memory copy while the file on disk (the "source of truth" the
evidence points at) said something else. The row's freeze property was unscoped.

**Fix — the form of the check, fixed at dispatch (additive, corpus/grader-loading region only):**
1. `graderFreezeFingerprint(path)` — raw-byte FNV-1a + byte length, taken per target **before the first entry runs**
   (same ordering discipline as the keyed run marker).
2. `verifyGraderFreeze(fingerprints)` — re-reads each file before `persist()`; `changed[]` carries `{slug, path, reason:
   "bytes-changed-mid-run" | "unreadable-since-start", hashAtStart, hashNow}`; `ok` only when every frozen grader is byte-identical.
3. Wiring: loud `!!!!! GRADER MOVED MID-RUN` block when `!ok`; `results.json.graderFreeze = {checked, ok, changed}`;
   per-row `grader.fileHashAtStart` + `grader.fileFrozen`.
4. Pins: test #28 (unit: unchanged ok / edited flagged / deleted flagged / missing-at-start honest) + test #29 (load-once:
   one resolution per entry at plan time — the freeze-by-construction half).

**Residual, stated not hidden:** FNV-1a is an integrity hash (house rule), not cryptographic — an edit that is reverted between
the two reads is outside the check's reach. The check detects "the bar moved during my run", which is the property the score needs.

## Audit — leak scans (c)

- **Existing (kept, re-verified):** `graderLeakScan` over the emitted tree (markers: acceptanceBar ≥24 chars, grader path, grader file
  name; planted-leak control pinned) · `results.json` must not echo the bar (pin at `run-eval.test.mjs:482`) · `project.json` must not
  carry a grader field.
- **Gap closed:** the AGENT-FACING surface. `createProject` receives `entry.brief` + `entry.name` ONLY (read: `run-eval.mjs:1241`);
  the frontmatter copies (`acceptance`/`expectedNouns`/`expectedCapabilities`) are documentation and never handed to the agent —
  but nothing scanned the brief for grader text, which is the playbook's named trap. `briefLeakScan(entry, grader)` now scans
  `brief` + `name` for the same markers; wired into `runTrial` (loud print once per case + per-row `briefLeak`).
- **Finding:** all 7 real fixtures are clean today (test #27 iterates the real corpus). The control proves the scan can fail
  (bar planted in a brief → `{field:"brief", marker:"acceptanceBar"}`; grader file name in `name` → flagged; capability nouns
  legitimately in the brief → NOT flagged).

## EVIDENCE

### E1 — test suite (FOREGROUND; whole file)
```text
$ node --experimental-strip-types --test --test-concurrency=2 scripts/run-eval.test.mjs
ok 26 - OV-7: the corpus spans ≥2 domains and ≥2 of them carry ≥2 fixtures (a citable same-domain peer)
ok 27 - OV-7: the agent-facing brief carries no grader text (real corpus) and a planted leak is caught
ok 28 - OV-7: grader freeze — an untouched grader verifies ok; a mid-run edit is caught and named
ok 29 - OV-7: the driver resolves each grader exactly once, at plan time (freeze by construction)
ok 30 - OV-7: M7 prior resolution — rows resolve per slug across domains; a first run is honestly null
# tests 30 · # pass 30 · # fail 0 · # skipped 0
```
Base before this lane (same command, same tree): `# tests 25 · # pass 25 · # fail 0` — the wave plan's "17/17 base" is stale
(W16-L4's OV-35 pins landed since). Anti-vacuity: with this lane's corpus/export changes reverted, tests 26-30 cannot pass
(26 fails `entries.length >= 7` + `construction >= 2`; 27-30 import symbols that would not exist).

### E2 — the freeze check against a REAL mid-run edit (integration; scratch corpus copy)
Scratch launcher `C:/Users/mnril/w19l4_scratch/freeze-probe.mjs` spawns the real driver (`--trials=2 --all`) over a copied corpus
and edits `field-ops-suite.grader.json` after trial 1 prints (trial 2 + persist still to come). Driver output:
```text
     trial 1/2: complete · 5/9 (mean 0.56) · pass=no · 12.3s      ← probe edits the grader file HERE
[probe] MID-RUN EDIT applied to .../freezecorpus/graders/field-ops-suite.grader.json
     trial 2/2: complete · 5/9 (mean 0.56) · pass=no · 6.6s
!!!!! GRADER MOVED MID-RUN — the acceptance bar changed while the run was in flight:
      field-ops-suite: bytes-changed-mid-run (hash 2501968991 -> 3372824095)
      the scores recorded for the affected cases are INVALID — re-run against a frozen grader
[probe] driver exit=0 · mid-run edit applied=true
$ results.json.graderFreeze → {"checked":1,"ok":false,"changed":[{"slug":"field-ops-suite","reason":"bytes-changed-mid-run","hashAtStart":"2501968991","hashNow":"3372824095"}]}
$ entry.grader → {"fileHashAtStart":"2501968991","fileFrozen":false, ...}
```
(The clean control is E3: the same driver over the real corpus reports `ok:true`.)

### E3 — done-when run: keyless `npm run eval -- --trials=2` over the REAL corpus (scratch out dir)
Command (the row's verify flag, FOREGROUND; `EVAL_OUT_DIR` documented override — see note 1):
```text
$ EVAL_OUT_DIR="C:/Users/mnril/w19l4_scratch/main-out" npm run eval -- --trials=2
rapidtool eval · mode=keyless · corpus=...\research\eval-corpus · trials=2
ok   coffeehouse2home-property-ledger: complete · 5/9 · 2 trial(s) · pass@1=0 · 40.6s
ok   field-ops-suite: complete · 5/9 · 2 trial(s) · pass@1=0 · 23.6s
ok   house-flip-manager: complete · 5/9 · 2 trial(s) · pass@1=0 · 32.4s
ok   permit-inspection-tracker: complete · 5/9 · 2 trial(s) · pass@1=0 · 22.7s     ← NEW fixture runs end-to-end
ok   real-estate-crm: complete · 5/9 · 2 trial(s) · pass@1=0 · 17.0s
ok   rental-portfolio: complete · 5/9 · 2 trial(s) · pass@1=0 · 16.3s
ok   showing-booking: complete · 5/9 · 2 trial(s) · pass@1=0 · 14.2s
trials: pass@1 mean=0.000 · flaky=none · grader leaks=none
wrote C:\Users\mnril\w19l4_scratch\main-out\results.json · 7 entries · history appended …
exit 0 — results are data, not failures
```
Domain census from that results.json (`node -e` on the artifact):
```text
DOMAIN CENSUS: {"real-estate":["coffeehouse2home-property-ledger","house-flip-manager","real-estate-crm","rental-portfolio","showing-booking"],
                "construction":["field-ops-suite","permit-inspection-tracker"]}
graderFreeze (run 1, fresh scratch history): {"checked":7,"ok":true,"changed":[]}   [E4 shows this too]
M7 rows run 1: 0 for all 7 — "no prior same-domain run — no learning claim without data" (the honest first-run state)
```

### E4 — run #2 (second invocation, same scratch history): M7 measurable across ≥2 domains
```text
$ EVAL_OUT_DIR="C:/Users/mnril/w19l4_scratch/main-out" npm run eval -- --trials=2
ok   coffeehouse2home-property-ledger: complete · 6/9 (mean 0.67) · 2 trial(s) · …   (all 7 slugs: 6/9)
$ results.json.graderFreeze → {"checked":7,"ok":true,"changed":[]}
$ per-row M7 (score | evidence), with domain:
M7 real-estate   coffeehouse2home-property-ledger 1 | M1+M2+M3 1 ≥ prior same-domain 1 (m1 0/m2 1/m3 0)
M7 construction  field-ops-suite                  1 | M1+M2+M3 1 ≥ prior same-domain 1 (m1 0/m2 1/m3 0)
M7 construction  permit-inspection-tracker        1 | M1+M2+M3 1 ≥ prior same-domain 1 (m1 0/m2 1/m3 0)   ← new fixture's 2nd run
M7 real-estate   {rental-portfolio, showing-booking, real-estate-crm, house-flip-manager} → 1 each, same citation shape
briefLeak rows: false for all 7 · grader.fileHashAtStart present + fileFrozen=true for all 7
```
That is the M7 citation row measured in **both** domains (5 real-estate + 2 construction), from two real invocations — not trials,
not fabrication. Boundaries stated: this is the KEYLESS prior path; OV-8's keyed run-#2 citation and the README/claim flips stay owner-run.

### E5 — files + footprint
```text
$ git status --porcelain   (mine only)
 M research/eval-corpus/README.md          (layout + provenance row + OV-7 domain-spread/M7 section)
 M scripts/run-eval.mjs                    (additive: header note, corpusDomainIndex, listCorpusEntries export,
                                            priorFor(historyPath) export, freeze pair, briefLeakScan, main()-wiring)
 M scripts/run-eval.test.mjs               (imports + section (e): 5 tests)
?? research/eval-corpus/permit-inspection-tracker.md
?? research/eval-corpus/graders/permit-inspection-tracker.grader.json
?? fixes/252_lane4_ov7.md
$ git diff --stat -- scripts/run-eval.mjs scripts/run-eval.test.mjs research/eval-corpus/README.md
 research/eval-corpus/README.md |  27 ++++++-
 scripts/run-eval.mjs           | 167 +++++++++++++++++++++++++++++++++++++++--
 scripts/run-eval.test.mjs      | 161 ++++++++++++++++++++++++++++++++++++++++
 3 files changed, 348 insertions(+), 7 deletions(-)
$ git diff -- scripts/run-eval.mjs | grep '^-' (non-header)      # the committed drain/stop logic is untouched
-function listCorpusEntries() {                                   # → export added
-function priorFor(slug) {                                        # → injectable historyPath default
-  const history = readJson(HISTORY_PATH, []);
-function persist(rows, mode, skips = []) {                       # → additive 4th arg (graderFreeze evidence)
-  const results = persist(rows, mode, skips);                    # → passes it
```
No drain/stop/marker/journey line changed; no W18-owned file touched (doctor/knowledge/git.server/plugin/io+codegen/lesson arm).

## ISSUES / NOTES (honest)

1. **Why `EVAL_OUT_DIR` on the done-when run:** the lane owns `run-eval.mjs` + the corpus, not `research/eval-out` — and a
   sibling W19 lane was mid-KEYED run there while this lane worked (repo `history.json` gained `coffeehouse2home… keyed` rows at
   19:43/19:49Z and a `run-in-progress.json` appeared; `research/eval-out/results.json` has 0 mentions of the new slug). Writing
   scratch out dirs kept both evidence sets clean; the flag is the driver's documented isolation switch.
2. **The freeze check is a detection + invalidation verdict, not a silent re-score**: on `ok:false` the scores stay in the data
   (results-are-data contract, exit 0) but are labeled INVALID + loud. Changing the exit code would break the committed contract
   and its pins — out of scope for a loader-region lane.
3. **`buildSummary` key set is a pinned contract** (`run-eval.test.mjs:649`): the freeze verdict therefore lives at
   `results.json` top level + per-row `grader.*`, never inside `summary`.
4. **Two readings of "M7 measurable across ≥2 domains"** — the corpus half now satisfies both: ≥2 domains with ≥2 fixtures each
   (same-domain peer citable inside each; pinned) AND the run-side evidence shows the citation in both domains (E4). The
   slug-vs-domain prior semantics were NOT changed (`maker-score.ts` is out of this lane's box and pinned byte-identical).
5. **The new fixture's first-run M7 is 0 by construction** (no prior). That is the honest new-domain state the playbook asks to
   state — E3 shows it, E4 shows the flip on run #2.
6. `npm run lint` was not run (parent/boundary-owned); the driver is `.mjs` and no eslint-disable was introduced.
