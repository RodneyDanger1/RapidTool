# fixes/253 — W19 · WD-α (quality watchdog) — lanes 1–6

**Watchdog:** WD-α · **Read-only** (this report + `C:/Users/mnril/w19wd_a_scratch/`) · started 2026-09-24 19:31:51Z (14:31 local)
**Scope:** the six W19 lanes (L1 OV-13/OV-29 headless+engine; L2 F4 policy+console; L3 T5.1 chat; L4 OV-7 run-eval
corpus/graders; L5 F2 registry/providers; L6 T5.7 new cassette). Base `8e25180` (~clean: 10 W18-late-landing files
uncommitted on top, all hashed at p0 in `w19wd_a_scratch/baseline/`).
**Method:** read-only polls every 1–3 min via `w19wd_a_scratch/poll.sh` (mtime+size per lane box) + whole-tree
md5 snapshots (`hashes_p*.txt`); claims re-checked against bytes with pasted commands; FOREGROUND test re-runs only
(≤2 total); no-mock/no-stub hunt on landed bytes. HOST ARTIFACT (never a bug): node under the background harness
dies `stdin is not a tty`. No git mutations; no repo edits beyond this report.

## BOTTOM LINE (INTERIM @ p6 + ~19:44Z — updated as evidence lands)
**6/6 lanes ACTIVE and landing IN-BOX · 0 P1s · claims 29 OK / 0 wrong / 0 open-WATCH (C17 RESOLVED at 19:50Z —
L2's log now documents the landed namespaced `policy.action-*` codes verbatim; no unregistered RT_E minted) ·
incidents: 1 (.env, open attribution, P3) + W18-L5's own `codegen.server.test.ts` movement (attributed) ·
INDEPENDENT RUN #1: `policy-overlay.test.ts + policy.test.ts` → **52 pass / 0 fail** (~19:51Z) · at-risk: none.**

## 1 · Timestamped poll log (read-only snapshots)

| # | ts (UTC) | lane activity observed | bytes changed | notes |
|---|---------|------------------------|---------------|-------|
| p0 | 19:31:51 | pre-lane baseline | W18-late set: 10 dirty files; full-tree md5 baseline | W18-owned hashes captured; no W19 artifacts yet |
| p1 | 19:32:51 | L4 log up (2128 B); L4+L6 scratch dirs; WD-β log up | `codegen.server.test.ts` +104 (14:33:40, **W18-L5's own** — diff header says `T5.4 (W18 LANE 5)`) | `fixes/.hermes-tmp.2bz1Uw` = tool temp |
| p2 | ~19:35 | all 6 logs visible (L1 2204 · L2 1927 · L3 949 · L4 2128 · L5 1028 · L6 3275 B); L3 4 spike scripts; L5 `xai_openapi.json` 222 KB | no src edits yet | 6 node procs (spikes/probes) |
| p3 | 19:36:01 | L3 spikes s1/s1b/s2/s3; L5 probe spec cached | — | W18-late set stable |
| p4 | 19:37:17 | **first src landings**: L2 `policy.ts` (+types) · L1 `engine.ts` (factory) · L6 `cassette.ts` NEW 28.9 KB (14:36:53) · L3 `chat.ts` +1 import | in-box only | policy.ts edited 2× (14:36:28, 14:37:25) |
| p5 | 19:38:54 | L4 `run-eval.mjs` landing (90074→92039 B) | in-box | lane scratch dirs L3/L4/L5/L6 |
| p6 | 19:41:21 | **big landings**: `chat.ts` +305 · `policy.ts` +247 · `engine.ts` +134 · `run-eval.mjs` +162 · `headless.ts` +3 · `chat.test.ts` +13; NEW `policy-overlay.test.ts` · `cassette.test.ts` · `probe.ts` · `openai-compatible.ts` · `permit-inspection-tracker.{md,grader.json}` | all in-box (see §3) | `.env` rewritten 19:38:42Z (see §3 incidents) |
| p7 | 19:46:44 | L1 headless call sites (+1768B) · L2 console half landed (console.tsx 14:43:08) · L5 registry wiring (22112B) · L6 cassette.test.ts growing (28.6KB) | in-box | lane logs still skeletons |
| p8 | 19:49:30 | L1 `lesson-writers.test.ts` (G2-pin imports) · L5 `registry.test.ts` imports · L4 keyed eval emitting a tree under research/eval-out/ (generated) | in-box | WD-β log 19.2KB |
| p9 | 19:50:16 | L2 log updated → **evidence pasted** (25/25 · 52/52 · 75/75 · 12/12 · 92/92 · eslint 0 · render probe · revert probe) | — | C17 reconciled by the log itself |
| p10 | 19:50:39 | quiet (no src edits in last ~30 s) | — | **RUN #1 (mine): policy-overlay+policy → 52/52 green (19:53Z)** |

## 2 · Claim-vs-bytes verification (23 OK / 0 wrong / 1 WATCH)

| # | claim (source) | command / evidence | verdict |
|---|---|---|---|
| C1 | L4: graders live in `research/eval-corpus/graders/` (6 JSON today) | `ls -l` → 6 files (now 7 with permit-inspection-tracker) | OK |
| C2 | L4: seams `run-eval.mjs:260/:318/:608` | real :274 graderFileFor / :332 loadGrader / :622 graderLeakScan (+14 drift) | OK (drift) |
| C3 | L2: seam `policy.ts:170 evaluatePolicy`, already action-shaped | `grep -n` → :170 exact; signature `(action, resource, ctx?)` | OK |
| C4 | L1: `headless.ts:208-210` research catch comment-only (OV-29) | sed → comment only | OK |
| C5 | L1: `headless.ts:231-233` narrative catch = keyed-reads-keyless | sed → `narrative = null` silent | OK |
| C6 | L1: engine sites :3014-3016 / :3032-3034 comment-only | sed → both comment-only; lane's updated lines match (playbook's :3010/:3028 stale) | OK |
| C7 | L1: G2-pin recipe at `lesson-writers.test.ts:327-408` | describe block at :328 | OK |
| C8 | L6: miss code reuses registered `RT_E_LLM_REJECTED` ("same as mock") | errors.ts:34/:391; mock.ts:114 | OK |
| C9 | L6: `ARTIFACT_PRODUCERS={deterministic,model,replay}`, "replay" reserved | io.ts:73-74 + :50-55 | OK |
| C10 | L6: tape seam at registry `callModel`; mock never in `PROVIDERS` | registry.ts:146 PROVIDERS; mock absent | OK |
| C11 | L3: `chat.server.test.ts` does not exist (phantom-name trap) | ls → No such file | OK |
| C12 | W19 plan: git.server.ts errors incl. "unregistered RT_E_GIT_UNAVAILABLE" | errors.ts:62/:469 **register it** (landed in 8e25180) — plan text stale, harmless | OK (correction) |
| C13 | L3: "spike the transport FIRST" | 4 spike scripts s1/s1b/s2/s3 in scratch; chat.ts header carries the spike verdict (S2 = `createServerFn` unreachable from plain node, RT_E_INTERNAL; provider stays one-shot `stream:false` @deepseek.ts:391) | OK |
| C14 | L5: "probe FIRST; name nothing before it" | `xai_openapi.json` cache + live 401 probes documented in `openai-compatible.ts` header (no keyless). Raw log evidence (§1) pending | OK |
| C15 | L1 landed: `liveDegradeRow(phase,kind,failure,fallback)` exported; capped message (140); never throws (hostile-value arm); code validated against `ERROR_CODES` registry, else `classifyError(failure, fallback)`; `withLiveDegradeRows` returns the SAME reference when rows empty | `git diff src/lib/engine.ts` (+134) | OK |
| C16 | L1 landed call sites: narrative else-branch + catch; constraints else-if + catch; return paths wrapped w/ same-ref fast path (`extras.length===0` path preserved) | engine.ts diff hunks @2915/:3015/:3039 | OK |
| C17 | L2's refusal codes: bytes land namespaced `policy.action-*` (REFUSAL_IDS map), explicitly NOT minted from the RT_E registry | log updated 19:50Z documents exactly these codes + the rationale (§4.2); `grep RT_E_POLICY errors.ts` → 0; errors.ts hash-stable | **RESOLVED** (was WATCH) — log ⟷ bytes now agree; no unregistered RT_E minted |
| C18 | L2 landed: `PolicyOverlay{allowActions?,denyActions?,alwaysAsk?}`; `readPolicyOverlay` fail-closed + `ignored[]` for unknown keys (denyCommands reported, not silently dropped); `policyOverlayRefusal` (unreadable→escape→allowActions→denyActions→alwaysAsk; unregistered action in a list ⇒ escape-refusal; namespace mismatch ⇒ refusal); `applyPolicyOverlay` returns input verdict unchanged or a deny — never mints allow | `git diff src/lib/policy.ts` (+247) | OK |
| C19 | L3 landed: NDJSON leg — chunk frames `{seq,chunk}` + ONE terminal (`{done,ok:true,reply,grounded,provenance}` / coded failure); abort → `RT_E_ABORTED`; dead sink → coded summary; parser rejects failure terminal without registry-shaped `RT_E_*` code; **honest scope note**: chunks = deterministic segmentation of the RESOLVED reply, NOT model-token streaming | `git diff src/lib/chat.ts` (+305, header :17-47) | OK (scope note for parent — CLI opt-in leg still absent) |
| C20 | L4 landed: 2nd domain `permit-inspection-tracker` (md + grader.json, NEW) + `corpusDomainIndex`/`listCorpusEntries`/`priorFor` + `graderFreezeFingerprint`/`verifyGraderFreeze` (load-once + fingerprint before/after; mid-run change ⇒ `graderFreeze.ok=false`, scores INVALID, printed loudly) + `briefLeakScan` (grader text in brief) | run-eval diff (+162) + untracked corpus files | OK (progress) |
| C21 | L5 landed: `probe.ts` — 3 s hard cap; never throws; configured ≠ reachable/authenticated; keyless ⇒ `RT_E_LLM_NOT_CONFIGURED` + zero I/O; caches NOTHING; refuses non-live-probe descriptors (`RT_E_VALIDATION`); ids read back only | new `probe.ts` (9.4 KB) | OK |
| C22 | L5 landed: `openai-compatible.ts` — xAI family (probed 2026-09-24; live 401s show both paths exist, no 404s), candidate with EMPTY `requestModelIds`, `complete()` refuses until `applyProbedModels`; no invented ids; no silent `thinking` translation (pinned RED); `max_completion_tokens` only when passed; imports deepseek helpers, never edits | new `openai-compatible.ts` (23.5 KB) | OK |
| C23 | .env (gitignored, secrets) rewritten 19:38:42Z — var set unchanged {DEEPSEEK_API_KEY, TAVILY_API_KEY}; no git trail (ignored) | `stat`, `git check-ignore -v` | **INCIDENT (P3)** — attribution open (tool/harness vs lane); not a src touch |
| C24 | All W19 modifications are in-box: engine.ts/headless.ts (L1) · policy.ts/policy-overlay.test.ts (L2) · chat.ts/chat.test.ts (L3) · run-eval.mjs/research/eval-corpus/** (L4) · registry.ts/probe.ts/openai-compatible.ts (L5) · cassette.ts/cassette.test.ts (L6) | `git status` + drift diffs | OK |
| C25 | W18-late set stable since p0 EXCEPT `codegen.server.test.ts` (twice, then stable since ~19:38 — W18-L5's own T5.4 test landing; diff header `T5.4 (W18 LANE 5)`) | drift diffs p0→p6 | OK (attributed) |
| W1 | ~~L2's RT_E_POLICY_* unregistered~~ → merged into C17: the landed design avoids minting unregistered RT_E codes entirely | errors.ts untouched (hash stable since p0) | superseded by C17 |
| C26 | L2 console diff: 6 hunks / +54/-1, ALL in the approval/seat region (import; `policyAllowListsOf`; `onApprove` guard @1871-1885; dock compute @3470; disabled+aria @3543; refusal box @3575) — no ScorecardBlock/packet hunks | `git diff src/components/console.tsx` | OK |
| C27 | L2 console resource string `` `gate:P${currentPhase}` `` matches POLICY_RULES regex `/^gate:P[0-9]+$/` for both `hitl.approve`/`hitl.force` | policy.ts:108-119 read | OK |
| C28 | L2 test counts: `policy-overlay.test.ts` = 25 `it(`, `policy.test.ts` = 27 `it(` (static) — match the log's "25/25 · 27 unchanged" | `grep -c` | OK |
| C29 | L2's suite greenness (independent, mine): **52 pass / 0 fail** @19:53Z | `node --experimental-strip-types --test --test-concurrency=2 src/lib/policy-overlay.test.ts src/lib/policy.test.ts` (raw tail captured in scratch) | OK |
| C30 | L4 eval-mode nuance: `run-eval.mjs:1971` picks `mode = KEYED_OK ? "keyed" : "keyless"`; host `.env` holds a DeepSeek key ⇒ a plain `npm run eval` runs KEYED (auto cap 1 entry @:2031). The brief's "keyless" done-when needs an explicit keyless env; observed keyed smoke at 19:43 (`results.json mode:"keyed"`) | run-eval.mjs read + `research/eval-out/results.json` | OK (check L4's final evidence matches brief) |
| C31 | L6 `cassette.test.ts`: 30+ real tests incl. file-tape byte-determinism, real-FNV-1a collision refusal, corrupt/tampered-tape refusals, off-by-default selection, AND a wiring scan asserting `no module imports cassette.ts` + `run-eval.mjs carries no cassette mode` | `grep` test names | OK |

## 3 · Box enforcement (P1 screen)

- **Out-of-box edits: none so far** — every touched file is inside its lane's stated box (C24). No W18-owned file
  has been touched by any W19 lane (C25; errors.ts, io.ts, codegen.server.ts, doctor*, knowledge*, git.server*,
  plugin.ts, rapidtool-cli.mjs, dod.ts all hash-stable since p0).
- New files are the expected additions (probe/openai-compatible = L5 additive; policy-overlay.test = L2's test;
  cassette+cassette.test = L6; permit-inspection-tracker = L4's 2nd domain).
- `.env` incident C23 — watch for a second change (would escalate).
- Not-yet-touched lane deliverables: `console.tsx` (L2 console half), `policy.test.ts`, `chat-stream.test.mjs`,
  `run-eval.test.mjs`, `registry.test.ts`, `headless.test.ts`, `lesson-writers.test.ts`, `cassette.ts` wiring
  (L6 declares wiring OUT of box), L1 headless call sites (only +3 import lines so far).

## 4 · Foreground test re-runs (≤2 total)

Named target per lane (actual re-runs capped at 2, chosen late on landed bytes):
L1 `headless.test.ts` (base 92/92 static test count ✓) · L2 `policy.test.ts` + `policy-overlay.test.ts` ·
L3 `chat.test.ts` (70 tests static) + NEW `scripts/chat-stream.test.mjs` · L4 `scripts/run-eval.test.mjs` +
`npm run eval -- --trials=2` (keyless) · L5 `registry.test.ts` (29 static) + llm 14/14 · L6 `cassette.test.ts` +
keyless-eval byte-stability.

**RUN #1 EXECUTED (19:53Z): `node --experimental-strip-types --test --test-concurrency=2 src/lib/policy-overlay.test.ts
src/lib/policy.test.ts` → `# tests 52 · # pass 52 · # fail 0` — confirms L2's claimed counts on live bytes.**
Run #2 reserved for L1 (`headless.test.ts`, the 92/92 wave number) once L1's tests settle.

## 5 · No-mock / no-stub hunt — IN PROGRESS

- Landed bytes audited so far carry NO stubs/fake returns: L1's factory is pure + registry-validated, L2's overlay
  is total + fail-closed, L3's leg emits real frames over a real sink (segmentation disclosed), L4's freeze check is
  real before/after fingerprinting (residual stated: edit-and-revert out of reach), L5's probe does real I/O only
  when configured (nothing cached), L6's miss path is a coded refusal (no text), off = identity transport.
- Remaining at close: tests-that-pass-if-reverted check per lane; grep for TODO/FIXME/stub/fake in all landed hunks.

## 6 · Per-lane verdict + next-dispatch guidance — INTERIM

| lane | state @ p6 | verdict | next dispatch |
|---|---|---|---|
| L1 OV-13/OV-29 | engine factory+callsites + headless imports landed; headless call sites + tests pending | on-track | keep; verify headless :208/:231 wiring + G2-style pin; the 92/92 run |
| L2 F4 | policy.ts overlay + new test file landed; console half + policy.test.ts pending; log stale (C17) | on-track (guard) | ensure 252_lane2 log updated to landed code shape; console approval/seat region next |
| L3 T5.1 | spike done + streaming leg + chat.test updates landed; NDJSON test pending | on-track | the NDJSON scripts-leg test; remember CLI opt-in leg is parent-sequenced (not in box) |
| L4 OV-7 | corpus 2nd domain + freeze/leak fns landed; run-eval.test.mjs + keyless eval evidence pending | on-track | complete test leg; paste freeze evidence; confirm M7 ≥2-domain claim honestly (new domain has no prior — say so) |
| L5 F2 | probe.ts + openai-compatible.ts + registry wiring landed; registry.test.ts + raw probe evidence pending | on-track | pin probe matrix + candidate refusal; paste raw xAI probe output into 252_lane5 log |
| L6 T5.7 | cassette.ts + cassette.test.ts landed; round-trip/miss/off tests pending; wiring explicitly out of box | on-track | finish tests; paste keyless-eval stability command |
