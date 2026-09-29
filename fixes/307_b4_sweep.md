# fixes/307_b4_sweep.md — THE BUG-SPRINT SWEEPER (B4)

**Lane:** B4 — bug-sprint sweeper. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`.
**Baseline HEAD on entry:** `84784b5` ("F-wave: engine step-summary rewire completed (parent repair), safe() registry gate, doctor spend, USAGE fix") — clean tree.
**Box (read-side + battery):** `src/lib/diagnose.ts` / `src/lib/scorecard.ts` / `scripts/run-eval.mjs` read-sides; THE SWEEP BATTERY (typecheck / lint / tests / gate.sh / build / preview curl / keyless CLI e2e); scratch smokes. No other lane edits those read-sides; edits elsewhere → log `for <lane>`, don't touch. NO keyed calls.
**Mandate:** bugs / non-wired / partial only. Every hit triaged; every battery result recorded real.

---

## 1 — THE SWEEP BATTERY (all results REAL; tree = HEAD 84784b5 + live sibling edits)

| # | Leg | Command (exact) | Result |
|---|---|---|---|
| B1 | typecheck | `npm run typecheck` | **exit 0** (19.6s; re-confirmed inside gate.sh) |
| B2 | lint | `npm run lint` | **exit 0** (24.5s; 0 problems — gate.sh JSON recorded `problems:null`) |
| B3 | assertion gaps | `node scripts/check-assertion-gaps.mjs` | **exit 0** — `[assertion-gap] clean — 107 test files scanned, 0 findings` |
| B4 | tests — scripts leg | `node --test --test-reporter=tap "scripts/**/*.test.mjs"` | **338 tests / 338 pass / 0 fail / 0 skipped** |
| B5 | tests — src/lib leg | `node --experimental-strip-types --test --test-reporter=tap "src/lib/**/*.test.ts"` | **2276 tests / 2275 pass / 0 fail / 1 skip** — the skip is `216z opt-in: the REAL npm install leg runs (RT_VERIFYKIND_INSTALL=1)` (env-gated by design) |
| B6 | build | `npm run build` | **exit 0** — vite built in 6.99s; `db:migrate` → `DATABASE_URL not set — skipping (the PGLite fallback migrates itself)` (expected local path) |
| B7 | full gate | `bash scripts/gate.sh` | **exit 0 — verdict JSON verbatim:** `{"ok":true,"double":false,"flakes":[],"hardFails":[],"skips":1,"wallMs":176902,"gates":{"typecheck":{"ok":true,"exit":0,"ms":19601},"lint":{"ok":true,"exit":0,"ms":24503,"problems":null},"assertionGaps":{"ok":true,"exit":0,"ms":760},"build":{"ok":true,"exit":0,"ms":13870},"testsScripts":{"ok":true,"exit":0,"ms":38114,"pass":338,"fail":0,"skipped":0},"testsLib":{"ok":true,"exit":0,"ms":79247,"pass":2275,"fail":0,"skipped":1}}}` |
| B8 | preview boot + curl | `npm run preview` (direct) → `curl http://127.0.0.1:8081/` | **HTTP 200, 7489 bytes**. Note: `npm run preview:restart` refuses here — `[preview] no /proc — this script only runs inside the sandbox`; used vite preview directly, killed after the curl. |
| B9 | keyless CLI e2e | scratch dir `~/b4_scratch` (outside the repo — repo tree untouched) | `create` ✅ ok:true (P0 ready, enforceDod:false keyless) → `gate --autopilot` ✅ **parks P0 `awaiting_hitl`, exit 2 (by design)** → `approve --force` from non-TTY ✅ **refused** `RT_E_VALIDATION` ("never mint decidedBy:human from an agent") → `.rapidtool/checkpoint.json` (28,181 B) + `.rapidtool/logs/rapidtool.ndjson` written → `diagnose` ✅ exit 0 → `packet` ✅ exit 0 → `eval` ✅ exit 0 |
| B10 | targeted consumer legs | `node --experimental-strip-types --test scripts/run-eval.test.mjs src/lib/scorecard.test.ts src/lib/diagnose.test.ts` | **60 tests / 60 pass / 0 fail / 0 skipped** |

Honesty notes:
- `npm test` is exactly B4+B5 chained (package.json:23); run as two invocations for separate counts — both green.
- `gate.sh --double` deliberately NOT run (flake re-run): the single full gate is green with zero flakes/hardFails; budget went to the e2e + hunt. Nothing red observed to chase.
- Two sibling files were mid-edit during the battery (`M src/lib/deepseek.server.test.ts`, `M src/lib/llm/providers/deepseek.ts` — B2's window): every leg stayed green across runs; attributed, not absorbed.
- B4 wrote zero repo files except this log; all e2e artifacts live under `~/b4_scratch`.
- Preview teardown (re-verified close): the first `kill` hit the npm wrapper only — the vite child stayed detached; listener PID 4040 stopped via `Stop-Process`; re-`curl` → `000` (connection refused). **Port 8081 released.**

## 2 — THE NEW FIELDS — CONSUMER VERIFICATION (4/4 WIRED, live-proven)

| Field (card) | Producer (bytes read fresh) | Consumer(s) | Live proof |
|---|---|---|---|
| **budget boundary** (L2-P1) | `packet.ts` `packetBudgetBoundary()` :426-441 → envelope key `budget:{spent,cap,stop_reason}` :198-201 (ordered after `spend:`) | `packet.test.ts` :987-1038 (cases a/b/c incl. strict-`>` boundary) + repo lint 0 covers `packet.ts` | CLI `packet` md carries `"budget": null` (keyless: present key, honest null — no spend/cap) |
| **endClass** (L1-E1/E2) | `run-eval.mjs` :2575 (entries) · :2931 (history rows) · :3298 (crash row `"unmeasured"`) | `scorecard.ts` :151/:249 entries · :316/:345 history · census :685-690 → `derived.endClass` :757 + notes :722; CLI `eval` verb renders scorecard verbatim | CLI `eval` output: `"endClass": null` on a legacy entry + `derived.endClass` census + note `endClass census (1 entries): funded 0 · unfunded 0 · unmeasured 0 · absent 1 — "absent" = the row carried no endClass (a legacy artifact predating the key); never guessed into a class.` — tolerant absence proven on a real legacy artifact |
| **entry-runs** (L1-E3) | `run-eval.mjs` `evaluateEntryRunsRow()` :795 ← `checkExpectedBehavior` :884/:929 ← (grading) `passesAcceptance` :1065/:2578-2586 | `run-eval.test.mjs` pins :12/:1200-1278 — REAL bounded spawn through the exported seams | B10 targeted run 60/60 (incl. those pins); also scripts leg 338/338 |
| **checkpoint** (K7#9) | `checkpoint.server.ts` (`readCheckpoint`/`checkpointAdmits`); CLI resume/admission :472-770 | CLI `diagnose` arm :3630-3643 (read-only), rides envelope :3705-3707 | `diagnose --project p.json` → `"checkpoint": {"present": true, "path": "C:\\Users\\mnril\\b4_scratch\\.rapidtool\\checkpoint.json", "savedAt": 1790693896235}` |

Nothing needed wiring from B4's box — all four consumers exist and were exercised live (or via pinned real-spawn tests). `diagnose`'s own budget reads (`WILD_STEP_BUDGET_MS`/`CHAT_STEP_BUDGET_MS`) also confirmed single-sourced from rt-events (CLI :3688).

## 3 — THE HUNT (class → count → disposition)

| Class | Non-test hits | Disposition |
|---|---|---|
| `TODO(` (incl. .tsx) | **73** | 38 = scaffold's designed **E-15 stub vocabulary** (emitted visible refusals; doctor/dod census them — by design) · 30 non-E-15 = **25 tracked coded-shell rows** (FM-03b · FM-04b · F2-09 · R13-f02 ×4 · R13-f09 · R13-f14 · R11-f08 · A1-25 · A1-17 · R14-f01 ×2 · R3-f03 ×3 · R3-f06 ×4 · A3-f07 ×2; each message/comment names its owning row) + **4 rt-events dead-constant notes** (F-2a) + **1 closed citation** (run-eval.mjs:876 — "the TODO(A3-f05) `pending` push is GONE") · 5 `console.tsx` = U1's honest UI disclosures (`title=` texts: "the planner is not wired", "one-shot transport") |
| `FIXME` / `XXX` / `coming soon` | **0 / 0 / 0** | clean repo-wide |
| placeholder-family (`placeholder`·`not implemented`·`unimplemented`·`not wired`·…) | **123** | sampled 50/50 read in full → benign vocabulary (SUMMARY_PLACEHOLDERS · PLACEHOLDER .env values · brief-fixture `<draft>`/`<any>` · HTML `placeholder=` attrs · engine's honest "placeholder module" labels · scaffold `test.skip("<id> — NOT IMPLEMENTED")` visible markers · error-scan rule name). Every non-wiring CLAIM in the class individually verified (F-1). |
| `stub` / `mock` / `fake` | **234** | sampled 50/50 read in full → benign: mock **provider** (cassette replay doctrine) · `mocked:true` honest compile-check flag · doctor's stub **classifier** · crew prompt prose · "never a fake pass/N" pins. No fabricated-pass paths in non-test code. |
| bare empty catch (`catch {}` / `catch (e) {}`) | **3** | `auth/popup.server.ts:163/:169/:173` — inside the popup HTML inline script; each has an explicit comment (parse failure ⇒ default `token:null` ⇒ opener reports "cancelled/failed"; postMessage/close best-effort). **Honest-by-design — NOT bugs.** |
| `any` in new code | **0** | no `: any`/`as any`/`<any>` in non-test `src/lib` (grep hits were prose only) |
| commented-out code blocks | **0** | 2 grep variants; every `//`+keyword line was doc prose |
| suppressions | **3+1** | `design.ts:525`, `vault.ts:118`, `vector.ts:150` = `no-control-regex` (documented regex class) + generated `routeTree.gen.ts`. **No `@ts-ignore`/`@ts-expect-error` anywhere non-test.** |

### F-1 · zero-consumer / de-scope claims — each falsified or confirmed against the tree
- `crew.server.ts:1460` TODO(F2-09) `crewToReport` — **0 consumers CONFIRMED** (grep: definition only). Comment accurate; KEEP-marked de-scope. → `for B2`, no action.
- `subagent.ts:38-51` TODO(R13-f14) — explicit **wave de-scope + wire plan**; contract complete, "nothing here is fake". → track.
- `fixtures.ts:246-254` `fixtureDecisionEntry` — `@de-scoped (W42·L1-E5)` documented (HitlDecision shape mismatch). → track.
- `quarantine.ts:16` R11-f08 — **wired** (CLI emit arm :285-300 / :1215); lift INTO `emitProject` explicitly sequenced. → track.
- `wild-review.ts:35/:95` R14-f01 — **wired**: `createNodeWildReviewer` consumed at `headless.ts:4000/:4166` + `store.ts:1217`; keyed evidence run pending. → track.
- `error-scan.server.ts:11` "not wired into gate.sh / never called by emit" — BY DESIGN (advisory; wired to the `scan` verb). → honest.
- `console.tsx:6825/:6827/:6866` — honest live "not wired" disclosures in titles. → `for U1`.

### F-2 · OPEN items found (logged, NOT fixed — outside B4's box)
- **[P3 · for B3] `rt-events.ts` dead constants still dead (re-verified today):** `WILD_STEP_AUTOPAUSE_MS` (:250) — 0 refs; `LONGTASK_REPORT_MS` (:262) / `LONGTASK_COALESCE_MS` (:263) — 0 external refs; `RtScope` — 0 external refs (:56). Self-documented TODO(N6-W6); owner decision = wire or remove.
- **[P3 · for B3/F1] `scripts/rapidtool-cli.mjs:156` — a healthy PARK stamps `level:"error"`.** `level: exitCode === 0 ? "info" : "error"` maps exit 2 (parked at HITL, `ok:true`, by-design per the 0/1/2/3/4 taxonomy) to error level. LIVE proof from B9: after a healthy `gate` park, `diagnose` reports `mostLikelyCause.class:"unclassified-errors"` citing `{"level":"error","scope":"cli-command","event":"cli.invocation","message":"gate exit 2"}` — an incident signal for a success state; a second row (the non-TTY approve refusal) is correctly error. No test pins the mapping (grep: none). PROPOSED FIX (owner's call): `level: exitCode === 0 || exitCode === 2 ? "info" : "error"` (or "warn" for 2), keeping 1/3/4 + failures at error. NOT touched (cli.mjs outside B4 box).
- **Debris note:** repo root carries sibling scratch `probe-b1.ts` + `tsconfig.scratch-u2.json` (B1/U2) — flagged so a boundary sweep doesn't read them as artifacts.

## 4 — FINAL STATUS TABLE (class → count → disposition)

| Class | Count | Disposition |
|---|---|---|
| TODO( non-test | 73 | 38 designed-E-15 · 30 tracked (25 coded shells + 4 dead-const notes + 1 closed) · 5 console disclosures — **0 untracked non-wired** |
| FIXME / XXX / coming soon | 0 / 0 / 0 | clean |
| placeholder-family | 123 | sampled 50 full + every non-wiring claim verified → **0 bugs** |
| stub/mock/fake | 234 | sampled 50 full → **0 bugs** |
| bare catch | 3 | popup best-effort, documented → **0 bugs** |
| `any` (new code) | 0 | clean |
| commented-out blocks | 0 | clean |
| suppressions | 3 | documented regex class → **0 bugs** |
| OPEN findings handed off | 2 | F-2a `for B3` · F-2b `for B3/F1` |
| Battery legs | 10 | **ALL GREEN** (gate.sh `ok:true`; e2e behaves exactly as designed keyless) |
| New-field consumers | 4/4 | **ALL WIRED** + live-proven |

**Bottom line:** no real-not-wired bug survived triage in B4's classes; every consumer claim was checked against fresh bytes; the full runtime battery is green in one `gate.sh` invocation (`ok:true`, wallMs=176902); the sweeper's only open items are the two precise B3 findings above.
