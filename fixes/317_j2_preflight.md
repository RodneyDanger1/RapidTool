# fixes/317_j2_preflight.md — THE KEYED-RUN CHECKLIST

**Lane:** J2 (pre-flight verifier) · **Written:** 2026-09-29 evening local / 2026-09-30 ~01:20 UTC.
**HEAD:** `6a9ff96` + in-flight J/L-lane working-tree edits (all runs below are stamped against that host; see the snapshot note at the end).
**Rule:** NO keyed calls were made. Every item below is keyless and re-runnable; the one condition that can only be settled with the owner's key is marked **OWNER-ACTION**.

**How to read this:** it mirrors `wave_plans/W43/COMPLETION-TASKS.md` §TOP-BLOCK (the merge rule). The keyed run happens ONLY when all five conditions hold. Each section: **STATUS · evidence command · real output (trimmed) · date/HEAD**.

## Conditions at a glance

| # | Condition (W43 merge rule) | Status | One-line evidence |
|---|---|---|---|
| 1 | The seal is complete (T4.4/E1) | **MET** | P7 probe re-run: SEAM HONORED; seal scratch: coded `[seat agent-seal]` rows, keyless floor honest; sealed full run = 13 steps → `wild.complete` |
| 2 | Waves land + a green boundary exists | **MET** (re-verify at freeze) | typecheck 0 · lint 0 errors · suite green · `gate.sh ok:true` (all 6 gates exit 0) at `6a9ff96`+wt |
| 3 | The keyless probes have answered | **MET** | 13 steps ≤ cap 20 (margin 7, both arms) · no-mint path honest-coded · K1 door works non-TTY / bare approve refuses coded |
| 4 | The wallet is funded (T1.5) | **OWNER-ACTION** | keyless `--preflight` proves the command, not the wallet; last keyed run 2026-09-25T00:03:43Z = `balance-exhausted` (402). Owner: top up + run preflight with the key |
| 5 | The user's word (merge rule) | **OWNER-ACTION** | owner reviews this doc; the exact run commands + first steps in §5 |

---

## 1 · Condition 'seal complete' (T4.4 / E1) — **STATUS: MET**

Claim that now stands on real behavior: `--agent-seal` is driveable on disk, its P7 `liveEdge` seam is consumed, its approvals record coded `[seat agent-seal]` provenance (never a human), and its keyless floors refuse honestly instead of fabricating an approval.

### 1a · P7 probe re-run, BOTH arms — SEAM HONORED

Command (repo root): `node --experimental-strip-types probe-h1-p7.mjs`
(keyless, no network, injected reviewer; full output saved: `~/j2_p7_probe.json`)

Real output (trimmed to the decisive fields, verbatim):
- **armA (no seam)** — `outcome:"paused"` · `code:"RT_E_GATE_PENDING"` · `error:"P7 DoD unmet — hard gate blocks advance: p7-research."` · `park:{RT_E_GATE_PENDING, wild.paused, human-gate}` · `p7Gate:{pass:false, unmet:["p7-research"]}` · `researchCorpus:0` · events: `wild.exec: P7 executed (deterministic floor)` → `wild.review (classifier)` → `wild.paused_dod`.
- **armB (injected `opts.liveEdge`)** — `outcome:"advanced"` · `p7Gate:{pass:true, unmet:[]}` · `researchCorpus:1` · `park:null` · events: `wild.exec: P7 executed (injected edge seam)` → `wild.review` → `wild.advance: P7 sealed → P8 (classifier)`.
- **verdict line:** `"SEAM HONORED — opts.liveEdge was consumed: P7 executed through the edge, p7-research cleared, the enforceDod leave check advanced to P8."`

→ the seam CHANGES P7's behavior on identical fresh fixtures: armB advances through the injected live edge; armA keeps the keyless floor (the hard-DoD pause). This is the falsification the probe exists for, re-run at HEAD `6a9ff96`.

*Honesty note:* the probe's own printed `head` field still reads `"564db1f + working tree"` (a stale constant inside the probe script) — the REAL host of this run was HEAD `6a9ff96` + working tree. Cosmetic, not a product bug; left as-is (J3 owns probe hygiene).

### 1b · seal behavioral scratch (CLI `wild --agent-seal`) — seal engaged; control unchanged

Scratch dir: `C:\Users\mnril\j2_seal_check\` (fresh v1_seal_check re-run). Commands:

```
node --experimental-strip-types scripts/rapidtool-cli.mjs create --brief "J2 seal behavioral check (vague brief, deliberately)" --name "J2 Seal Behavioral Check" --out "C:/Users/mnril/j2_seal_check/j2-seal-behavioral-check.json"
node --experimental-strip-types scripts/rapidtool-cli.mjs wild --project "C:/Users/mnril/j2_seal_check/j2-seal-behavioral-check.json" --start --steps 4 --agent-seal
```

Control (identical create/wild, no `--agent-seal`): `C:/Users/mnril/j2_seal_check/control/j2-seal-control.json`.

Real outputs (trimmed, verbatim):
- **SEAL** — envelope: `outcome:"paused"`, `steps:1`, `note:"P0 is a human-only gate."`, status `awaiting_hitl`; project row:
  `wild.paused_human` — *"P0 gate is human-only (forceHuman) — the agent seal refuses it (R3/B-03): opening it would need an autopilot.force policy rule that would also open the CLI 'approve --force' door. A human must decide."* · decisions 0.
- **CONTROL** — envelope: `outcome:"paused"`, `steps:1`, `note:"P0 is a human-only gate."`, status `awaiting_hitl`; project row:
  `wild.paused_human` — *"P0 gate is human-only (forceHuman) — Wild Mode cannot self-approve it."* · decisions 0.

→ the sealed run's coded refusal row is present (the seal-specific R3/B-03 reason — the "coded rows" of the behavioral check); the control's behavior/bytes are unchanged (plain human-only text). Both parks are the same forceHuman policy, told differently — which is the point.

### 1c · the sealed run's coded rows / seat labels (full drive) + the keyless floor (CLI)

**(i) Engine-level sealed full run** — command: `node --experimental-strip-types "C:/Users/mnril/j2_arith_check.mjs"` (ARM-seal; keyless, injected reviewer; full output `~/j2_arith_out2.txt`):

- `ARM-seal STEPS: 13 | oneStepPerPhase: true | 13<=20: true | margin: 7` · `FINAL status: complete`.
- Every gate decision (P4/P5/P8/P9): `{"decidedBy":"autopilot","decidedVia":{"action":"hitl.approve","resource":"gate:P4","reason":"agent-seal — the keyed Auto-Review classifier (classifier) consented to P4; unattended approval recorded under the seal.","label":"autopilot/agent-seal","tokenPath":false},"seatTag":"[seat agent-seal]"}` — **never `human`**.
- The plain arm (no seal) carries the same 13 steps but plain `decidedBy:"autopilot"` rows with no seal provenance — the seal is what adds the coded row.

**(ii) Keyless floor, live CLI** — `wild --start --steps 8 --agent-seal` on a warehouse-brief scratch (`C:/Users/mnril/j2_seal_check/j2-seal-forward.json`) advanced P0→P3, then parked at P4 with:
`wild.paused_classifier` · code `RT_E_LLM_NOT_CONFIGURED` · park `{"unlock":"agent-seal","unlockText":"The agent seal could not consent (keyed classifier unavailable) — configure the classifier (DEEPSEEK_API_KEY), then resume the sealed run.","resumePhase":4,"resumeAction":"gate"}` · envelope `note:"Classifier not configured."`

→ keyless, the seal cannot self-approve: it parks with the coded reason and names the fix. No fabricated approval anywhere.

### 1d · the seal's pin legs (standalone, foreground)

Command: `node --experimental-strip-types --test src/lib/wild-seal.test.ts src/lib/wild-step.test.ts` → `# tests 39 · # pass 39 · # fail 0 · # skipped 0` (exit 0; log `~/j2_seal_legs.txt`). The full suite (§2) is green over the same files.

**Condition 1 verdict: MET.** The seal's switch, P7 seam, coded provenance, and keyless floors all re-verified at `6a9ff96`+wt. (The CLI-level sealed run completing to `wild.complete` is a KEYED-path event — keyless it correctly parks at the first stock gate, §1c-ii.)

---

## 2 · Condition 'boundary-green' — **STATUS: MET** (re-verify at freeze)

Evidence commands and real outputs (2026-09-30 ~01:00–01:15 UTC):

| Gate | Command | Result |
|---|---|---|
| typecheck | `npm run typecheck` | **exit 0** |
| lint | `npm run lint` | **exit 0** — `✖ 10 problems (0 errors, 10 warnings)` |
| full suite | `npm test` | **exit 0** — scripts leg `# tests 355 · # pass 355 · # fail 0`; src leg `# tests 2459 · # pass 2458 · # fail 0 · # skipped 1` |
| THE GATE | `bash scripts/gate.sh` | **exit 0** → `{"ok":true,"double":false,"flakes":[],"hardFails":[],"skips":1,"wallMs":594143,"gates":{"typecheck":{"ok":true,"exit":0},"lint":{"ok":true,"exit":0,"problems":10},"assertionGaps":{"ok":true,"exit":0},"build":{"ok":true,"exit":0},"testsScripts":{"ok":true,"pass":355,"fail":0},"testsLib":{"ok":true,"pass":2459,"fail":0,"skipped":1}}}` |

Logs: `~/j2_typecheck.log` · `~/j2_lint.log` · `~/j2_npmtest.log` · `~/j2_gate.json` (+ `~/j2_gate.err`).

Notes (honesty):
- The 10 lint warnings are **not errors** (exit 0): 9 of them are J1's in-flight `scripts/run-eval.mjs` unused entry-oracle/rt-events imports (`:112-124` — J1's lane, expected to vanish with the caller wire) and 1 is the pre-existing `wild-seal.test.ts:67` unused `rejecting`.
- The src-leg pass count prints 2458 via `npm test` and 2459 via `gate.sh` (a ±1 TAP accounting difference around the 1 skip; both runs: **0 fail**).
- **Snapshot caveat:** measured at committed HEAD `6a9ff96` + in-flight J/L-lane working-tree edits (modified at capture: `src/lib/{compile-check.server.ts,engine.ts,headless.ts,store.ts,wild-mode.server.ts,wild-seal.test.ts}`, `fixes/312_c3_lifecycle.md`; untracked `src/lib/budget-coverage.test.ts` + `fixes/317_*.md`). The tree kept moving (L1/L2 lanes appeared mid-session). **The gate.sh run is done — J4/K1 should cite `~/j2_gate.json` and re-run only once the tree is frozen for the run.**

**Condition 2 verdict: MET at the snapshot above; the freeze-boundary re-run is the standing pre-run step.**

---

## 3 · Condition 'probes answered' — **STATUS: MET**

### 3a · step arithmetic — 13 steps ≤ cap 20 (margin 7)

Probe recreated at `~/j2_arith_check.mjs` (adapted verbatim from the deleted `probe_c1_arith.mjs`, `git f270b38^:probe_c1_arith.mjs`; keyless + injected approve reviewer). Output (`~/j2_arith_out2.txt`):

```
1 | in=P0(ready) out=advanced cur=1 … 13 | in=P12(ready) out=completed cur=12 | wild.exec,gate.verdict,wild.complete
STEPS: 13 | oneStepPerPhase: true | 13<=20: true | margin: 7
FINAL status: complete | decisions: P4:autopilot P5:autopilot P8:autopilot P9:autopilot
```

→ re-confirms C1's S6 finding (`312_c1_ignition.md`): a gated phase costs **1** step (the approval moves the cursor in the same step), real minimum **13** (1/phase, finalize in-step), cap 20, margin 7. No cap raise needed. (Same numbers hold in the ARM-seal run, §1c-i.)

### 3b · the no-mint path — a keyless run mints nothing it cannot prove

**(i) The honesty gate itself** — probe `~/j2_nomint_check.mjs` (drives `mintTreeRunTested`, `codegen.server.ts:3772`; keyless, read-only). Output (`~/j2_nomint_out.txt`):

- **CASE-A** (green tree-run, NO spec executed): `lastTest: null` · logs: `p6.tree.tested` = 0, **`p6.tree.tested.skipped` = 1** — *"tree-run ok but no executable spec ran (0 spec file(s), 0 assertion(s)) — no \"tested\" stamp minted (honest: nothing executed headless)"* · gate P6: `p6-verified` **RED** (in unmet).
- **CASE-B** (green, 1 spec / 2 assertions executed — control): `lastTest: {"label":"tested","evidenceHash":"3655235467"}` · 1 mint · `p6-verified` no longer unmet → the gate discriminates.
- **CASE-C** (red tree-run): same project reference returned, no mint, no new log rows.

**(ii) A live keyless run's mint state** — the §1c-ii scratch project at P4: `lesson --list --project …` → `"count": 0, "rows": []`; project `lastTest: null`; `generatedTree` absent; park = the coded `wild.paused_classifier` row. Envelope note: `"Classifier not configured."`

→ keyless mint state = **no lesson rows, no tested stamp, no fabricated gate line** — the honest codes (`p6.tree.tested.skipped`, `RT_E_LLM_NOT_CONFIGURED`) are what a reader sees. This is exactly the T6.2c no-mint→P6-red behavior, verified keyless.

### 3c · the class-K1 door — works non-TTY; bare approve refuses coded

Scratch: the parked P4 project from §1c-ii. Commands + real outputs:

- `approve --project "C:/Users/mnril/j2_seal_check/j2-seal-forward.json"` (no seat, non-TTY) → **exit 1**:
  `{"ok":false,"error":"approve from a non-TTY names no claimable seat — the human seat needs an interactive terminal (--i-am-human + typed RT_HUMAN_SEAT_TOKEN re-entry; refused off-TTY) and a machine decision must be explicit. Next step: `approve --project <p> --seat autopilot` for an explicit machine approval, or run the verb from a terminal where a person can confirm.","code":"RT_E_VALIDATION","remedy":"Name exactly one seat: `--seat autopilot` (explicit machine attribution, works non-TTY) or `--i-am-human` from an interactive terminal (human seat, typed token re-entry)."}` (log `~/j2_seal_check/approve_bare_out.json`)
- `approve --project "…/j2-seal-forward.json" --seat autopilot` → **exit 0**: `lastGate:{phase:4, decision:"approve", note:"[seat harness] autopilot seat — no human decision claimed", decidedBy:"autopilot"}` · P4 `complete` → P5 `running` (log `~/j2_seal_check/approve_autopilot_out.json`).

→ no seat is ever guessed; the machine door is explicit, non-TTY-safe, and stamps its own attribution; the bare door refuses with a coded remedy.

**Condition 3 verdict: MET.**

---

## 4 · Condition 'wallet funded' (T1.5) — **STATUS: OWNER-ACTION**

**What was run (keyless-safe — read first, then ran):**

```
node scripts/run-eval.mjs --preflight
```

The script's own contract (`run-eval.mjs:3212-3221`): *"standalone probe mode … Works keyless (dummy key) and keyed."* The wire step only fires when `configured` is true; with no key in the environment it makes **no network call** and spends nothing. Real output (`~/j2_preflight_out.txt`, verbatim):

```
rapidtool eval · preflight probe (OV-27) · 2026-09-30T01:12:04.595Z
preflight: OV-27 reachability · configured=false · class=not-configured · code RT_E_LLM_NOT_CONFIGURED
preflight: specifier engine: resolved=true
preflight: specifier deepseek: resolved=true
preflight: specifier codegen: resolved=true
preflight: wire not attempted (key not configured or wire probe disabled)
preflight: proves: the honest keyless state
preflight: cannot prove (keyless/dummy key): anything keyed (no key is present)
```

**Honest reading:** this proves the command runs and reports — it cannot prove the wallet. Only a keyed `--preflight` can (and with a key it makes ONE bounded call, then the keyed leg additionally runs the 1-token fundedness probe which **stops the scored trials** if the account cannot pay).

**Recorded 402 evidence (the last keyed attempt):** `research/eval-out/run-in-progress.json` (on disk): `mode:"keyed"`, `startedAt "2026-09-25T00:03:40.910Z"`, `finishedAt "2026-09-25T00:03:43.510Z"`, **`preflightClass:"balance-exhausted"`**, `meanOfNine:2.9997`, `decision:"retrace-first"`. History rows (last 3 keyed): 0.5556, 0.6667, then **0.3333 = the 3/9 refused run**. (`fixes/311_da2_data.md` §NEWEST-RUN; W43 T1.5.)

**OWNER ACTIONS:**
1. Top up the DeepSeek account (or switch keys).
2. Then run, WITH the key in the shell env (the CLI needs the export; browser reads `.env` — README:138-148):

   ```
   cd "/c/Users/mnril/Desktop/RapidTool Main"
   DEEPSEEK_API_KEY=<key> node scripts/run-eval.mjs --preflight
   ```

   Accept: `class` must be anything other than `not-configured` / `no-balance`; `wire.ok:true` is the green form. A `no-balance` class = still unfunded → stop.
3. Optional but advised for the run itself: arm a process cap, e.g. `RAPIDTOOL_TOKEN_CAP=<tokens>` — unmetered-by-default stays legal (T5.1), but an uncapped keyed run has no coded spend stop.

**Condition 4 verdict: OWNER-ACTION (unfunded as of the last evidence).**

---

## 5 · Condition 'user word' (the merge rule) — **STATUS: OWNER-ACTION**

The owner reviews this checklist and gives the word + the exact command. Both candidate runs, with their first-step commands:

**Option A — the eval run (`run-eval --keyed`, the scored measurement; T1.2):**
```
cd "/c/Users/mnril/Desktop/RapidTool Main"
DEEPSEEK_API_KEY=<key> node scripts/run-eval.mjs --preflight        # first step — must not report not-configured/no-balance
DEEPSEEK_API_KEY=<key> npm run eval -- --keyed                      # the run: 1 bounded corpus entry, JOURNEY_BUDGET=3, marker + results.json + history.json
```
Precedent launcher (loads the key from `.env` without echoing it, tees to a log): `research/eval-out/_keyed-launcher.sh`. Expectation framing (W43 T1.6): target **mean ≥ 7/9 + mint evidence**; `acceptance.pass` is structurally unreachable (record-don't-fix); a ≤4/9 result routes to `keyedDecision "retrace-first"` — read the log, don't blind-re-run.

**Option B — the sealed wild run (`wild --start --agent-seal`, the unattended completion path; T4.4):**
```
cd "/c/Users/mnril/Desktop/RapidTool Main"
DEEPSEEK_API_KEY=<key> node --experimental-strip-types scripts/rapidtool-cli.mjs create --brief "<crisp brief>" --name "<run name>" --out "C:/Users/mnril/run4.json"   # first step (or point --project at an existing project)
DEEPSEEK_API_KEY=<key> node --experimental-strip-types scripts/rapidtool-cli.mjs wild --project "C:/Users/mnril/run4.json" --start --steps 24 --agent-seal
```
Caveats (all observed, not guessed): choose a brief with real lattice vocabulary — a reframe brief mints `forceHuman` at P0 and **the seal refuses P0 by design** (R3/B-03; §1b) — clear that gate as a human, or use a crisp brief. Keyless, the sealed run parks at the first stock gate with `RT_E_LLM_NOT_CONFIGURED` + unlock `agent-seal` (§1c-ii); keyed, the classifier self-approves the stock gates with `[seat agent-seal]` rows (§1c-i). Step arithmetic: 13 ≤ 20 (§3a).

Both options are keyless-rehearsed above; nothing else on this list blocks them.

---

## Snapshot + raw artifacts

- **Host:** committed HEAD `6a9ff96` + in-flight J/L-lane working-tree edits (modified at capture: `compile-check.server.ts`, `engine.ts`, `headless.ts`, `store.ts`, `wild-mode.server.ts`, `wild-seal.test.ts`; untracked `src/lib/budget-coverage.test.ts`, `fixes/317_*.md`). The tree continued to move (L1/L2 lanes appeared). All §2 numbers are stamped to that snapshot; the run itself should start from a frozen boundary commit (J4/K1 re-verify).
- **Raw outputs:** `~/j2_p7_probe.json` · `~/j2_arith_out2.txt` · `~/j2_nomint_out.txt` · `~/j2_preflight_out.txt` · `~/j2_typecheck.log` · `~/j2_lint.log` · `~/j2_npmtest.log` · `~/j2_gate.json` · `~/j2_seal_legs.txt` · `~/j2_seal_check/{seal_out,control_out,seal_forward_out,approve_bare_out,approve_autopilot_out}.json`.
- **Scratch probes (outside the repo, keyless):** `~/j2_arith_check.mjs`, `~/j2_nomint_check.mjs` (self-contained; the deleted `probe_c1_arith.mjs` lives again as the former).

## CHECKLIST VERDICTS (final)

| # | Condition | Verdict |
|---|---|---|
| 1 | THE SEAL IS COMPLETE | **MET** — P7 seam honored (both arms), coded `[seat agent-seal]` provenance, keyless floors park honestly, 39/39 seal+step pins green |
| 2 | A GREEN BOUNDARY EXISTS | **MET** at `6a9ff96`+wt — typecheck 0 / lint 0 errors / suite 0 fail / `gate.sh ok:true` (6/6 gates); re-run once at the freeze commit |
| 3 | THE KEYLESS PROBES HAVE ANSWERED | **MET** — 13≤20 (margin 7) · no-mint honest-coded + keyless mint state = no lesson rows/no stamp · K1 door works non-TTY, bare approve refuses coded |
| 4 | THE WALLET IS FUNDED | **OWNER-ACTION** — top up, then keyed `node scripts/run-eval.mjs --preflight`; last keyed attempt `balance-exhausted` (2026-09-25T00:03:43Z) |
| 5 | THE USER'S WORD | **OWNER-ACTION** — pick Option A and/or B (§5), record the command + env, then run |

**The machine side of the merge rule is answered. What remains before the keyed run is the owner's two moves: fund the wallet, and give the word with the exact command.**

---

## 6 · RE-VERIFY AT THE W44 PHASE-1 EXIT — new HEAD `cdf2510` (2026-09-30)

W44 finished the code remainder and re-ran the condition 1–3 evidence at the new HEAD. All commands keyless, foreground, run 2026-09-30 (logs: `~/w44_rv_*.log`; call-scope logs under `fixes/318_*`).

| # | Condition | Re-verify evidence (at `cdf2510`) |
|---|---|---|
| 1 | **SEAL COMPLETE** | `node --experimental-strip-types fixes/318_probe_h1_p7.mjs` (moved path) → **SEAM HONORED**: armA `paused` (keyless floor) / armB `advanced` (edge consumed) · `node --experimental-strip-types --test src/lib/wild-seal.test.ts src/lib/wild-step.test.ts` → **39 tests · 39 pass · 0 fail** (incl. §S5 13-step arithmetic + margin 7) |
| 2 | **GREEN BOUNDARY** | `bash scripts/gate.sh` → **`ok:true`** — all six gates exit 0 (typecheck 0 · lint 0 — first fully-warning-free run on record · gaps 0 · scripts 357/357 · lib 2465/2465 +1 skip · build 0), `wallMs` 248064. `npm test` standalone: 2823 tests · 2822 pass · 0 fail. Full JSON: `fixes/318_a5_verify.md`. |
| 3 | **PROBES ANSWERED** | step arithmetic: `j2_arith_check.mjs` re-run → **both arms 13 steps · 13<=20 true · margin 7 · FINAL complete** (decisions P4/P5/P8/P9 autopilot) · no-mint: `j2_nomint_check.mjs` re-run → CASE-A no-mint + honest `p6.tree.tested.skipped` · CASE-B control mints · CASE-C red ⇒ no mint · the K1 door: the CLI taxonomy legs are green within the scripts suite (bare approve refuses coded; `--seat autopilot` works non-TTY) |

**W44 code remainder — CLOSED (committed `cdf2510`):** the wrong-output pin (3 cases; the negative FAILS the verdict naming the row) · run-eval's 9 dead imports WIRED (dedup to `src/lib/entry-oracle.ts`; byte-identical 36/36; lint 0) · T5.4 (`eval-run` scope + `eval.run_start/end/error`; emitter + 4 bounded sites; census 60/22/38; behavioral emission proven) · store.ts's last uncoded catch (deepenResearch → `classifyError RT_E_INTERNAL`; pins incl. a real TypeError induction) · MAX_FILES loud truncation (+ probe) · W43 flipped to reality (27 LANDED / 1 LANDING / 15 OWED) · probes relocated (`fixes/318_probe_*`) · README/START-HERE counts (total 1,908) · lint 0 warnings.

**Conditions 4 (wallet) + 5 (owner's word) are the run's last gates — Phase 2 owns them (the owner's key is staged; the keyed preflight is Phase 2's first command).**
