# fixes/256 — W20 · WD-α (quality watchdog) — lanes 1–4 + inherited certification of 3 W19 landings

**Watchdog:** WD-α · **Read-only** (this report + `C:/Users/mnril/w20wd_a_scratch/`; no repo edits, no git mutations)
· started 2026-09-24 17:58:48 local (22:58:48Z)
**Scope:** the four W20 lanes (L1 OV-3/OV-4 tree-green · L2 OV-5 probe-truth · L3 OV-13/OV-29 pickup ·
L4 T5.1+F2 pickup) **plus the inherited duty**: certify the three W19 landings whose own watchdog died before
certifying them (F4=`fixes/252_lane2` · OV-7=`fixes/252_lane4` · T5.7=`fixes/252_lane6`).
Base `8e25180`; 67 uncommitted at p0 → 72 at p5.
**Method:** read-only polls via `w20wd_a_scratch/poll.sh` (per-lane log size/mtime + box md5s + scratch dirs + node
procs; snapshots under `scratch/polls/`), a full-tree md5 baseline (`baseline_hashes.txt`, 233 files) for out-of-box
detection, claims re-checked against bytes with pasted commands, FOREGROUND test runs only (≤2 total), no-mock/no-stub
hunt. HOST ARTIFACT (never a bug): node under the background harness dies `stdin is not a tty` — all runs FOREGROUND.

## BOTTOM LINE (INTERIM @ p7, 18:12 local / 23:12Z)

**4/4 lanes polled ×8 (p0–p7) · incidents: 4 (1 P1-flagged for adjudication · 1 inherited-red found-and-fixed ·
2 benign/carry-forward) · claims 42 OK / 0 wrong / 1 attested-only · at-risk: none — all lanes active ·
RUN #1 = 113/113: ALL THREE W19 LANDINGS CERTIFIED (OV-7 30/30 · T5.7 31/31 · F4 25/25+27/27) ·
RUN #2 = 50/52, both fails = the two EXPECTED findings independently reproduced: L1's crash repro CONFIRMED
(`ReferenceError: module is not defined` @ `get-property.ts:250`) · L2's run-eval 31/31 CONFIRMED (W19 pins survive
its delta) · L2's EXT-FAIL claim CONFIRMED to the line (doctor.test.ts 19 pass / 1 fail, failing at :389
`stubFiles [] vs ["src/generated.ts"]`).**

Newest signals: L1 diagnosis COMPLETE (root cause + bytes cited; fix landing pending) · L2 LANDED (acceptanceFailReason
+ probe-truth diagnosis; §P1/§P2 proposals) · L3 landing in-region (engine export + headless runPhase catch + G2 pin
suite grown +2.9 KB) · L4 iterating (chat.test.ts, registry.test.ts) after repairing the inherited red pin.

## 0 · INHERITED DUTY — certification of the three uncertified W19 landings (F4 / OV-7 / T5.7)

Verdict: **ALL THREE BACKED BY BYTES.** Line-by-line re-verification incl. one fresh foreground run covering all
three at once (rows W19-1…W19-18 below; the run in §4). One inherited defect found *beside* the three (W19-19:
W19-L5's registry landing left a cross-file pin red — repaired by W20-L4).

## 1 · Timestamped poll log (read-only snapshots; full files in `scratch/polls/`)

| # | ts local (UTC) | lane activity observed | bytes changed | notes |
|---|-----------|------------------------|---------------|-------|
| p0 | 17:59:39 (22:59) | all 4 lane logs up (L1 894 · L2 677 · L3 1471 · L4 1476 B); scratch w20l2/w20l4; 4 node procs | L4 `chat.test.ts` 17:57:05 (first W20 src touch, in-box) | full-tree md5 baseline (233 files); 70 dirty |
| p1 | 18:01:37 (23:01) | L2 scratch grows (probe_full.ts, probe_p6.ts) | none | 71 dirty; 2 node procs |
| p2 | 18:02:38 (23:02) | L1 scratch born (base/probeB/probeC) · L3 `headless.ts.bak` · L4 12 files (live curl probes) | `headless.ts` mtime 18:02:42 but **md5 unchanged** 520a934a = no-op touch | L4 mock.test.ts fixed 18:01:10 (see I2) |
| p3 | 18:03:49 (23:03) | **L2 first src landing**: run-eval.mjs 18:03:47, run-eval.test.mjs 18:03:19 (+acceptanceFailReason) · L4 registry.test.ts 18:03:47 | run-eval pair = W19-L4-landed files (I1) | my RUN #1 completed 18:02:17 — BEFORE these edits (scope clean) |
| p4 | 18:05:31 (23:05) | **L1 log filled** (5773 B) · **L2 log filled** (11340 B) · registry.test.ts 18:05:06 | L1/L2 logs = evidence+deltas | 4 node procs |
| p5 | 18:07:16 (23:07) | **L3 first src landings**: engine.ts 18:06:23 (+191 B; export of `liveLayerFailureRow` for the CLI catch) · headless.ts 18:07:13 (+525 B; runPhase silent-skip catch now mints G2 row) · L2 log regrown (11599 B) | engine/headless = L3's box (see §3) | poll files: 225938→230716 |

## 2 · Claim-vs-bytes verification (39 OK / 0 wrong / 2 attested)

### W19 landings (inherited certification)

| # | claim (source) | command / evidence | verdict |
|---|---|---|---|
| W19-1 | F4: `policy.ts` +247, `console.tsx` +55/-3 | `git diff --numstat` → policy.ts **245/2**, console **54/1** (299/3 total; log's numbers are ±2 on an earlier revision — W19-WD's own C26 measured +54/-1, bytes agree with it) | OK (drift noted) |
| W19-2 | F4: five refusal codes `policy.action-*` | `grep -n "policy.action-" src/lib/policy.ts` → REFUSAL_IDS :329–333, all five exact | OK |
| W19-3 | F4: no unregistered RT_E minted; errors.ts untouched | `grep -c RT_E_POLICY errors.ts` → 0; git status clean | OK |
| W19-4 | F4: static counts 25/25 + 27/27 | `grep -cE '^\s+it\('` → 25 · 27; no it.skip/todo/only | OK |
| W19-5 | F4: console hunks ONLY in HITL approval/seat region | `git diff -U0 console.tsx \| grep '^@@'` → 6 hunks at +42/+306/+1874/+3470/+3544/+3575 — matches log's render-path re-read (±3-line drift) | OK |
| W19-6 | F4: 25/25 + 27/27 green | **RUN #1 (mine): 25+27 pass / 0 fail** | **CERTIFIED (fresh run)** |
| W19-7 | OV-7: corpus 7 fixtures / 2 domains | `ls research/eval-corpus/graders/` → 7 incl. permit-inspection-tracker | OK |
| W19-8 | OV-7: run-eval deletions = exactly the 5 signature/call lines | `grep '^-'` → the 5 named lines (W19's set intact at p3; later +1 line from L2's landing — separate row) | OK |
| W19-9 | OV-7: 5 new "OV-7:" pins | `grep -n "OV-7:"` → :837/:861/:888/:929/:949 | OK |
| W19-10 | OV-7: artifact `graderFreeze {checked:7, ok:true, changed:[]}`; all rows frozen; briefLeak false ×7 | `node -e` on `w19l4_scratch/main-out/results.json` → exact | OK |
| W19-11 | OV-7: M7=1 + citation for all 7 slugs across both domains (run #2) | same → 7/7 `criteria.M7 {score:1, evidence:"M1+M2+M3 1 ≥ prior same-domain 1 (m1 0/m2 1/m3 0)"}` | OK |
| W19-12 | OV-7: freeze check caught a REAL mid-run edit (2501968991→3372824095) | `freeze-probe.log:11–12` block + `fileFrozen:false` row stamp | OK |
| W19-13 | OV-7: run-eval.test.mjs 30/30 (base 25) | **RUN #1 (mine): 30 tests, all pass** (TAP tests 0–29) | **CERTIFIED (fresh run)** |
| W19-14 | T5.7: `CASSETTE_MISS_CODE = "RT_E_LLM_REJECTED"` | `cassette.ts:89` exact; registered code | OK |
| W19-15 | T5.7: FNV-1a collision guard real; literals pinned | `cassette.test.ts:393/:394` probe pair; `3138489782` ×5 | OK |
| W19-16 | T5.7: planted tape sha256 unchanged | `sha256sum` → `c7affb0a…fc63` EXACT | OK |
| W19-17 | T5.7: no module imports the cassette (keyless eval blind to it) | repo-wide grep → 0 imports outside self+test; run tests #59/#60 pass | OK |
| W19-18 | T5.7: cassette.test.ts 31/31 | **RUN #1 (mine): 31 tests, all pass** (TAP tests 30–60) | **CERTIFIED (fresh run)** |
| W19-19 | **(found by WD-α)** W19-L5's registry landing (PROVIDERS now [deepseek, XAI_PROVIDER]) broke `src/lib/llm/providers/mock.test.ts:123` (`assert.equal(PROVIDERS.length, 1, "DeepSeek only")`) → red from ~14:46 until **W20-L4 repaired it 18:01:10** (attributed "W20-L4 (pickup of fixes/252)"; new form pins the two ids explicitly). No W19 watchdog caught it (batch death). | `sed registry.ts:177-198` (2 entries) + `git diff mock.test.ts` (old assertion text) + PROVIDERS import in mock.test.ts | **INHERITED RED — FOUND + REPAIRED** |

### W20 lane claims

| # | claim (source) | command / evidence | verdict |
|---|---|---|---|
| WL1-1 | L1: tree-run dies at import: `ReferenceError: module is not defined in ES module scope` (entry = CJS bytes in an ESM tenant) | bytes corroborate the mechanism: `oracle.spec.ts:31` = static `import * as treeModule from "../src/generated/get-property.ts"`; `get-property.ts:250-258` = `module.exports.*`; `package.json:5` `"type":"module"` — load crash kills the spec before any assertion. **RUN #2 dynamically reproduced it: crash @ :250 on the untouched artifact** | OK (byte-verified + **repro CONFIRMED**) |
| WL1-2 | L1: artifact = 1 tree file, 8060 B, byte-identical to disk; generatedSource 8118 B; typeSignatures 36 | my `node -e` on the artifact's project.json → **1 / 8060 / identical:true / 8118 / 36** EXACT | OK |
| WL1-3 | L1: P6 contract is CJS (`codegen.server.ts:434-453`); single-file trees returned unchanged (`materializeImportableTree` :1759+, `raw.length<=1`); scaffold emits verbatim (:2522-2529) | sed reads → all three EXACT (CJS sentence at :436; `if (raw.length <= 1)` in materialize; "bodies must stay byte-identical" comment) | OK |
| WL1-4 | L1: emitted spec statically imports the entry (scaffold spec template ~:1380) | `grep scaffold.ts` → :1380 `import * as treeModule from ${jstr(tsImportPath("tests", ctx.treeEntryPath…))}` EXACT | OK |
| WL1-5 | L1: with module-system seam declared (`src/generated/package.json {"type":"commonjs"}`), the spec runs → 43 tests / 9 pass / 28 fail / 6 skipped (honest reds) | scratch dirs `base/probeB/probeC` exist; **attested-only** (no second run of mine; log's command is reproducible) | attested |
| WL2-1 | L2: `passesAcceptance` (`run-eval.mjs:1625-1631`) = FOUR clauses (finite mean → mean threshold → files → content); run-2 fails clause :1627 only | sed :1620-1680 → exact (clauses :1626-1629); grader `meanAtLeast:1`; run-2 mean 0.6667 → fires | OK |
| WL2-2 | L2: landed `acceptanceFailReason()` :1642, recorded :1675 + printed; test = 31/31 green (RED before) | `grep acceptanceFailReason run-eval.mjs` → :1642 def, :1675 wiring; `grep -c '^test(' run-eval.test.mjs` → **31** (+1 vs W19's 30). **RUN #2: 31/31 pass CONFIRMED** | OK + **CONFIRMED (fresh run)** |
| WL2-3 | L2: full 2026-09-10 tree = 5 files, barrel 194 B; chunk-0 36300 · create-flip-project 9737 · compute-rent-roll 2632 · check-reorder-flags 2731 | my `node -e` on `…run-2026-09-10/.rapidtool/project.json` → EXACT all five (disk copy shows 9739 for create-flip-project — 2 B CRLF nuance vs the pinned json; non-material) | OK |
| WL2-4 | L2: EXT-FAIL — `doctor.test.ts:382-390` red on the current worktree (suite 19 pass / 1 fail) because the tracked export lost its barrel (run #2 overwrote it with the 1-file partial) | static: test reads `readRealExport("coffeehouse2home-property-ledger")` (:280) and asserts `stubFiles === ["src/generated.ts"]`; current artifact's archTrace stubFiles=[] (L2's probe + my read of the partial tree) → assertion fails. **RUN #2 CONFIRMED: 19 pass / 1 fail; failing subtest :382 → assertion at :389 `actual [] vs expected ['src/generated.ts']`** | OK (static) + **CONFIRMED (fresh run)** |
| WL2-5 | L2's cross-cutting: with current code P6 can never pass on a multi-file tree (barrel read by brief-fit = 0 hits; barrel classified stub) | corroborated by WL2-3's barrel-only `generatedSource` (194 B) + `dod.ts` probes named at :533/:336-343 (cited; owner ruling flagged by L2 itself) | OK (citations; semantics = owner ruling) |
| WL3-1 | L3: W19-L1 left PARTIAL edits (engine +134 / headless +91 / lesson-writers +210 in git diff) | `git diff --numstat` → engine **132/7**, headless **75/28**, lesson-writers **208/2** — sizes approximate (±), the material claim (partial edits exist) TRUE | OK (drift noted) |
| WL3-2 | L3: landed edits are in-region — engine export `liveLayerFailureRow` + headless `runPhase` catch mints the G2 row (silent-skip closed); non-live records nothing | diff read: `-} catch { return applyPhaseResult(...)` → `+} catch (err) { … liveLayerFailureRow(phase, err) }` guarded by `opts.live`; export comment cites `fixes/255 · W20-L3`. No import cycle (engine has no headless import) | OK (in-box) |
| WL3-3 | L3: `headless.test.ts` green at the 92/92 base on landed bytes | raw TAP on disk `w20l3_scratch/headless-final.txt` (18:10:07 — AFTER the last headless.ts edit 18:09:05): **# tests 92 · # suites 28 · # pass 92 · # fail 0** · 0 `not ok` — read by me | OK (evidence on disk) |
| WL3-4 | L3: `lesson-writers.test.ts` green incl. the new G2-pin + W20 describes | raw TAP `lesson-writers-final.txt` (18:10:10, after the 18:07:56 edit): **25/25 · 0 fail**; new describes present (`fixes/252 (W19-L1 …)` keyed-rows suite + `fixes/255 (W20-L3) …silent skip` suite, 2 tests: thrown→G2 row; non-live→silent) | OK |
| WL4-1 | L4: live xAI probe evidence (raw curl responses on disk) | `live_cc.txt` = live `{"code":"400","error":"Bad data: Messages cannot be empty"}` · `live_cc2.txt`/`live_models.txt` = live `unauthenticated:no-credentials` · `live_root.txt` = 404 page — endpoints EXIST, no fabricated ids | OK |
| WL4-2 | L4: repaired the inherited census pin (see W19-19) | `git diff mock.test.ts` = exactly that + XAI import; new assertion pins `["deepseek", XAI_PROVIDER_ID]` matching registry bytes | OK |
| WL4-3 | L4: F2/T5.1 pickup state (partial edits in registry.ts/registry.test.ts/chat/chat-stream; spikes s1b/s2/s3) | `git status` + scratch (spikes 17:59, xai_openapi.json 222 KB, tsconfig.lane4.json 18:05) | OK (work in flight) |

## 3 · Box enforcement (P1 screen)

**p0→p8 full-tree sweep (find+md5 over src/scripts/research/eval-corpus, 233 files): EXACTLY 9 files changed since
baseline — every one attributable to a W20 lane; nothing else moved.** (`diff baseline_hashes.txt hashes_now.txt`)

| file | p0 md5 → now | owner / box verdict |
|---|---|---|
| src/lib/chat.test.ts | 7b9598cc → c33a19fd | L4 — in-box |
| src/lib/llm/providers/registry.test.ts | 0e7bb1e6 → 099f9566 | L4 — in-box |
| src/lib/llm/providers/openai-compatible.ts | c60ae82b → 2b02be27 | L4 — in-box (F2 provider module; untracked ⇒ no git diff, hash+size only) |
| src/lib/llm/providers/mock.test.ts | 87239fe0 → fa5acba5 | L4 — I2 repair (see below) |
| src/lib/engine.ts | 5977944f → 0ac5ac38 | L3 — in-box (export only; W19 hunks intact) |
| src/lib/headless.ts | 520a934a → 201bcabf | L3 — in-box (:192–:367 region) |
| src/lib/lesson-writers.test.ts | 63e942c1 → 8ab02235 | L3 — in-box (G2-pin suite appended) |
| scripts/run-eval.mjs | e7377277 → 20893cad | L2 — **I1** |
| scripts/run-eval.test.mjs | 62c30bc2 → 2ed60fb6 | L2 — **I1** |

- **I1 (P1-FLAGGED, adjudication):** W20-L2 edited **W19-landed** files `scripts/run-eval.mjs` (+200 cum vs W19's 167; new `acceptanceFailReason` :1642 + wiring :1675) and `scripts/run-eval.test.mjs` (+186 cum vs 161; +1 test). Git evidence: diffstat delta + attribution comments "255 (W20-L2)". L2's log **declares** the box ("`scripts/run-eval.mjs` acceptance readers (`checkAcceptance`/`passesAcceptance` region) + `scripts/run-eval.test.mjs`") — but the wave plan's L2 box says gates.ts/scorecard-adjacent readers with "(read-only where the clause lives out of box)", and the touch is on a W19-landed file → **parent adjudication requested**. Mitigations: additive (never flips a verdict; replaces one push line + adds a helper), tested, attributed, sized small.
- **I2:** inherited red found (W19-19) — fixed by L4; not a W20 violation (repair of W19's leftover; attributed). The repair file `mock.test.ts` is outside L4's literal box (providers additive-only) but materially required by the F2 pickup; flag for the record.
- **I3:** `headless.ts` no-op touch 18:02:42 (md5 identical 520a934a before/after; L3 `.bak` copy at 18:01:45 explains the read/copy cycle) — benign, watching.
- **I4 (carry-forward):** W19's `.env` rewrite (P3, attribution open) not re-triggered — `.env` mtime still 14:38:42, size 250 B.
- All other W20 edits in-box: chat.test.ts (L4), run-eval pair (L2, I1), engine+headless (L3); no W18 file touched; no other W19-landed file touched.

## 4 · Foreground runs (≤2 total)

**RUN #1 EXECUTED 18:02:17 local (23:02Z), ONE invocation covering all three W19 certifications:**
```
$ node --experimental-strip-types --test --test-concurrency=2 \
    scripts/run-eval.test.mjs src/lib/cassette.test.ts src/lib/policy-overlay.test.ts src/lib/policy.test.ts
# tests 113 · # suites 19 · # pass 113 · # fail 0 · # duration_ms 7324
```
Per-file binding (TAP-parsed): run-eval 30/30 (tests 0–29) · cassette 31/31 (30–60) · policy-overlay 25/25 (61–85)
· policy 27/27 (86–112) — **each exactly the count its W19 log claimed.** Output `scratch/run1_w19_certs.txt`.
Timing note: L2's edits to the run-eval pair landed at 18:03:19/47 — AFTER my run — so RUN #1 certifies the W19-state
bytes (and the OV-7 pins must survive L2's delta: RUN #2 checks this).

**RUN #2 EXECUTED 18:11:5x local (23:11Z), ONE invocation, three named targets (settled bytes only):**
```
$ node --experimental-strip-types --test --test-concurrency=2 \
    "research/eval-out/coffeehouse2home-property-ledger/tests/oracle.spec.ts" \
    scripts/run-eval.test.mjs src/lib/doctor.test.ts
# tests 52 · # pass 50 · # fail 2 · # duration_ms 3798
```
- **L1 crash repro CONFIRMED** — `not ok 1 … tests/oracle.spec.ts` with `ReferenceError: module is not defined in
  ES module scope` at `…/src/generated/get-property.ts:250` (`module.exports.getProperty = getProperty;`) — the exact
  failure L1's log §1 claims; reproduced by me on the untouched run-#2 artifact (mtime 14:48:59, unmodified).
- **L2 landing CONFIRMED** — `scripts/run-eval.test.mjs` = **31/31 pass** (W19's OV-7 pins + the new pin under L2's
  delta); total per-file: oracle 1 · run-eval 31 · doctor 20 (52).
- **L2 EXT-FAIL CONFIRMED to the line** — `src/lib/doctor.test.ts` = **19 pass / 1 fail**; the failing subtest is
  `doctor.test.ts:382` "the REAL café export refuses on its named leftover…" failing at `:389` with
  `deepStrictEqual actual [] vs expected ['src/generated.ts']` — i.e. the run-#2 emit replaced the tracked
  full tree and the pin reads the live artifact. A committed test is RED on the current worktree (wave-boundary
  relevance; L2's fix proposal = pin a committed fixture copy).
Output: `scratch/run2_w20_targets.txt`. Invocation count = **2/2** (cap respected).

Named targets NOT executed (cap + in-flight bytes): L3 → `src/lib/headless.test.ts` (92/92 base) + `lesson-writers.test.ts`
· L4 → `registry.test.ts` + `llm` suite — both lanes were mid-edit at run time; their logs must paste their own evidence.

## 5 · No-mock / no-stub hunt — running

- No stubs in landed bytes: `grep TODO/FIXME/stub/fake` across W19-landed + W20-touched production files → only
  honest mentions (e.g. `probe.ts` "never a fake reachability claim"; run-eval "not failed, not faked" notices).
- Teeth evidence from RUN #1's TAP: cassette "refuses instead of serving the wrong envelope on a REAL FNV-1a key
  collision", "never mints a stamp T5.4 would drop", wiring-scan pins; policy-overlay "can never mint an allow",
  "DENIES a human claim with no token — the P0-01 forgery".
- Anti-vacuity: L2's new pin is RED-before/pasted; L1's repro is a real crash (mechanism byte-verified); L4's fix
  makes a previously-RED pin exact rather than deleting it.

## 6 · Per-lane verdict + next-dispatch guidance — INTERIM (18:08)

| lane | state @ p5 | verdict | next dispatch |
|---|---|---|---|
| L1 OV-3/4 tree-green | diagnosis COMPLETE + byte-cited (log §1–3); fix §4 pending; no src edits yet | **on-track** | land the module-system declaration; then the emitted-tree spec must be run for the record; do not greenwash the 28 honest reds |
| L2 OV-5 probe-truth | LANDED (run-eval pair + log) + §P1/§P2 proposals; declares box | **on-track (I1 adjudication)** | parent: rule on I1 (run-eval.mjs touch) and on §P2 (barrel-as-stub vs doctor.test.ts pin); L2 must not edit dod.ts without the ruling |
| L3 OV-13/OV-29 pickup | first src landings in-region (engine export + headless runPhase catch); log still skeleton | **on-track** | finish G2-style pin + paste `headless.test.ts` 92/92 + lesson-writers evidence; coordinate engine.ts with L1 |
| L4 T5.1+F2 pickup | live probes on disk + inherited-red repair + spikes; log skeleton | **on-track** | finish T5.1 NDJSON test + F2 registration evidence; paste registry 29/29 + llm 14/14 |
