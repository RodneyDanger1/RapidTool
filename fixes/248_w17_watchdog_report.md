# fixes/248 — W17 WATCHDOG REPORT (lanes 1–5 + W16 tail)

**WATCHDOG:** read-only observer · **Base:** `4328d20` (clean) · **Watch window:** 2026-09-24 13:34 → 14:10 CDT (19 polls).
**Scratch (raw evidence):** `C:/Users/mnril/w17wd_scratch/` — `poll_1.txt`…`poll_19.txt` (full per-poll snapshots), `run2.txt`.
**Host artifact accounted:** node under Hermes's BACKGROUND harness dies `stdin is not a tty` (ledger `C:/Users/mnril/w15_parent_evidence.txt`); every watchdog run was FOREGROUND. No git mutations. Files written: this report + scratch only.

---

## BOTTOM LINE

| metric | value |
|---|---|
| lanes polled | **5/5** (19 polls, ~33 min) + W16 tail tracked |
| incidents | **1 live** — C-1: `scaffold.ts:741` fails type-stripping (L4, mid-flight; breaks every scaffold-importing suite) |
| claims ok / wrong / unverifiable | **26 ok / 0 wrong / 1 unverifiable** (L4's named-test green — blocked by C-1) |
| at-risk lanes | **L4 only** (stalled ~18 min, log still skeleton, own named test cannot load) |
| cross-wave (new) | **W18 dispatched mid-watch** (~14:04–14:09): 6 lanes + WD-α + WD-β; its boundary run reports **9 `headless.test.ts` failures (83/92)** attributed to W17's emit path — consistent with C-1, see §7 |

**L1 / L2 / L3 / L5: done + independently verified** (byte-level, incl. sha256 matches and both watchdog test re-runs). **L4: STUCK-at-risk** — G5/DF-04/TA-21 all landed *in bytes* (and verified), but the file does not parse; see §5–§6 for the exact recovery dispatch.

---

## 1. Timestamped action log (per poll, per lane)

Raw snapshots: `w17wd_scratch/poll_<n>.txt`. `—` = unchanged since previous poll. Claim counts = verifiable claims present in each lane's log at that poll.

| poll · time (CDT) | L1 (corpus fold) | L2 (T-107.6) | L3 (thinking trio) | L4 (emitted honesty) | L5 (infra) | W16 tail / notes | claims in logs |
|---|---|---|---|---|---|---|---|
| P1 13:35:07 | scratch only; corpus 56593B @12:33 | base files | base files | base files | base files; no new files yet | W16 dirty: run-eval.mjs 13:30:44, run-eval.test 13:32:28, gates/honesty/packet tests; 244 logs M | 0 (all skeletons) |
| P2 13:37:04 | **log created 13:36:02** | — | — | — | — | honesty-guards 13:36:55 | 0 |
| P3 13:38:48 | — | **token-ledger.ts 13:38:13** | — | — | **gate.yml 13:37:28 · zero-byte-guard 13:37:27 · compile-check 13:38:34** | gates.test 13:35:56 | 1–2 (L5 skeleton plan) |
| P4 13:40:39 | — | verify.server.ts 13:39:46 | **llm-tasks.ts 13:39:30 · deepseek.ts M** | **scaffold.ts M** | compile-check.test 13:40:54 | README-cli.test.mjs M (W16-L2 arm) | 2 |
| P5 13:42:30 | **corpus edited 13:42:20 → 90246B; numstat 90/0** | token-ledger.test.ts 13:40:57 | registry.ts M | — | — | — | 4 |
| P6 13:44:47 | corpus 13:43:52 → 90249B | verify.server.test.ts 13:42:35 | registry.test.ts M | — | — | — | 6 |
| P7 13:46:38 | **log filled 13:44:48 (99 ln)** | log filled 13:47:40 (65 ln) | — | — | log filled 13:49:35 → (P9) 113 ln | — | 12 |
| P8 13:48:40 | done | done | — | **engine.ts 13:49:53** | done | gates/honesty static since 13:35–13:37 | 15 |
| P9 13:50:33 | done | done | — | — | done | — | 17 |
| P10 13:52:17 | done | done | — | **emitted-honesty.test.ts NEW 13:50:48** | done | — | 18 |
| P11 13:54:05 | done | done | — | — | done | — | 18 |
| P12 13:55:43 | done | done | **log filled 13:53:37 (73 ln)** | — | done | W16 quiescent since ~13:38 | 21 |
| P13 13:57:33 | done | done | done | **STALLED** (last write 13:50:48) | done | — | 21 |
| P14 13:59:18 | done | done | done | stalled; **L3 §6 flags scaffold.ts:741 as in-flight, not theirs** | done | — | 22 |
| P15–P17 14:01–14:04 | done | done | done | stalled (no writes) | done | — | 22 |
| P18 14:06:01 | done | done | done | stalled; **RUN2 -> L4 test load-FAIL** | done | — | 24 |
| P19 14:08:20 | done; numstat still **90/0** | done | done | stalled ~18 min; `IMPORT FAIL` persists | done | W16 tail: all logs filled, no writes since 13:38; its dirt awaits boundary commit | 26 |

Per-lane lane-log claim counts at close: **L1 99 ln / 24 checks · L2 65 ln / 17 checks · L3 73 ln / 14 checks · L4 31 ln skeleton / 0 claims · L5 113 ln / 14 checks.**

---

## 2. Claim verification vs bytes (26 verified, 0 wrong, 1 unverifiable)

Every row = a claim read from a lane log (or done-when) and the command the watchdog ran on the live bytes.

| # | Lane | Claim | Watchdog command → result | Verdict |
|---|---|---|---|---|
| 1 | L1 | fold is insertions-only, **0 deletions** | `git diff --numstat -- research/multiagent/220_tasklist_canonical.md` → `90 0` (P5, P6, P19 — stable to close) | ✅ |
| 2 | L1 | `grep -c "FOLD-2026-09-24"` = 42 ≥ folded row count (20 new rows) | grep → `42` | ✅ |
| 3 | L1 | final sha256 `e6f30807…ae7ad3` | `sha256sum` → **exact match** | ✅ |
| 4 | L1 | final 412 lines / 90249 bytes | `wc -c -l` → `412 90249` | ✅ |
| 5 | L1 | row census 62 | `grep -cE '^\| \*\*'` → `62` | ✅ |
| 6 | L2 | 4 seams wired at verify.server.ts | `grep -c "runBudgetedCall("` → `4` | ✅ |
| 7 | L2 | node-runner seam scoped out (no token surface) | `grep -cE "TokenBudget\|usage\|spend\|callModel\|deepseek\|tokenCap" src/lib/node-runner.server.ts` → `0`; file untouched | ✅ |
| 8 | L2 | only its 4 files changed; node-runner files absent | `git status --porcelain` path-scoped → 4×` M`, node-runner absent | ✅ |
| 9 | L2 | final file shas `f7297a0d… / 82885e32… / d7a7b0e1… / 4728cc80…` | `sha256sum` prefixes → **all 4 match** | ✅ |
| 10 | L2 | named trio 67/67 green | watchdog RUN2 (below) → 67/67 pass | ✅ |
| 11 | L2 | default cap stays UNSET (D2.3) | read `tokenCapFromEnv` (unset→undefined) + `grep -cE "createTokenBudget\|tokenCapFromEnv\|RAPIDTOOL_TOKEN_CAP" src/lib/verify.server.ts` → `0` | ✅ |
| 12 | L3 | 3 per-site thinking decisions (json→`false`, prose×2→`true`) | `git diff src/lib/llm-tasks.ts` → `thinking: false` @site1, `thinking: true` @sites 2–3, + `CompleteOptions.thinking?` | ✅ |
| 13 | L3 | refusal NAMES the requested id | `git diff deepseek.ts` → `` — requested model: "${model}" `` appended to every non-OK refusal | ✅ |
| 14 | L3 | registry.ts: zero behaviour change (OV-28 test-pin only) | `git diff registry.ts` → comment lines only | ✅ |
| 15 | L3 | flips A/B/C produce RED on exactly the intended pins | grep of `w17l3_scratch/flip{A,B,C}_registry_red.txt` → A: `+ type:'enabled' / - type:'disabled'` on the boundary+site pins (27/29); C: id-less refusal shape, `# fail 2` | ✅ |
| 16 | L3 | `registry.test.ts` 29/29 green | watchdog RUN1 → included 29/29 | ✅ |
| 17 | L4 | DF-04: `grep -c 'MCP/A2A' engine.ts` = 1 and it is the **labeled** line | grep → `1`; diff shows claim line reworded + `MCP/A2A server contracts are roadmap declarations, not runtime (B-18).` | ✅ (bytes) |
| 18 | L4 | TA-21: "template — not executed" marker FIRST line of both P9 artifacts | `sed -n '1022,1034p;1046,1056p' engine.ts` → marker is line 1 of the GH-Actions YAML and of the IaC sketch | ✅ (bytes) |
| 19 | L4 | G5: coded-refusal sites across scaffold.ts | diff → `EMITTED_REFUSAL_CODE="RT_E_VALIDATION"` + 10 hunks (emitApi/emitJobStub/emitUi×2/emitOracleSpec/emitMainEntry×4) | ✅ (bytes) — ⚠️ file does not load, see C-1 |
| 20 | L5 | gate.yml parses; one job | `python -c "yaml.safe_load(...)"` → `YAML OK, jobs: ['gate']` | ✅ |
| 21 | L5 | no keys in CI | `grep -c "secrets\." .github/workflows/gate.yml` → `0` | ✅ |
| 22 | L5 | node pinned 22.23.2 (== dev host) | bytes: `node-version: "22.23.2"` (+ setup-node@v4, cache npm) | ✅ |
| 23 | L5 | zero-byte guard green on this repo | watchdog RUN1 → guard suite `ok 8`, 4/4 | ✅ |
| 24 | L5 | OV-43 report-only surface (`gate:false`, never a gate) | diff: `SupplyChainPosture.gate: false`, `audited: false`, `SUPPLY_CHAIN_AUDIT_COMMAND`, no ok/fail type | ✅ (bytes; suite not re-run — budget) |
| 25 | multi | L1 is the ONE corpus editor; no other research/ file touched | `git status` → only ` M research/multiagent/220_tasklist_canonical.md` under research/ | ✅ |
| 26 | multi | W16 boxes untouched by W17 lanes | W17-dirty set ∩ W16-dirty set = ∅ across all 19 polls | ✅ |

**Unverifiable: 1** — "L4's named test green": `emitted-honesty.test.ts` cannot even load (C-1). Verdict deferred; not a lane claim yet (log still skeleton).

**Box enforcement — corpus rule:** L1's fold grew the file 56,593 → 90,249 B **strictly by insertions** (`90 0` at P5/P6/P19, `grep "^-"` = 0 for real removals). **No P1.** No other lane touched `research/`. **W16-owned files (run-eval.mjs/.test, gates.test.ts, honesty-guards.test.ts, packet.test.ts, headless.ts, console.tsx, doctor.ts, styles.css): zero W17-lane writes** (`git status` intersection empty; headless.ts/console.tsx byte-identical to HEAD).

---

## 3. Named test re-runs (≤2, foreground — both used)

| # | Lanes covered | Command | Result |
|---|---|---|---|
| RUN1 13:55:51 | **L5** (guard) + **L3** (pins) | `node --experimental-strip-types --test --test-concurrency=2 src/lib/zero-byte-guard.test.ts src/lib/llm/providers/registry.test.ts` | **exit 0 · # tests 33 · # pass 33 · # fail 0** (guard 4/4 = "OV-19 — zero-byte source/test guard" ok; registry 29/29) |
| RUN2 14:06:01 | **L2** (named trio) + **L4** (named test) | `… --test-concurrency=2 src/lib/token-ledger.test.ts src/lib/verify.server.test.ts src/lib/node-runner.server.test.ts src/lib/emitted-honesty.test.ts` | **L2 trio: 67/67 pass.** L4: `not ok 1 - src\lib\emitted-honesty.test.ts` → `SyntaxError [ERR_INVALID_TYPESCRIPT_SYNTAX]: Expected ',', got 'ident'`. Exit 1. Raw: `w17wd_scratch/run2.txt` |

**L1:** no test exists (text fold, by design) — verified via commands + sha (§2 rows 1–5). Run budget now 2/2; L5's OV-43 suite (claimed 46 tests / 45 pass / 1 opt-in skip) was **not** re-run — bytes verified instead.

---

## 4. Incidents

**C-1 (LIVE, P1-candidate — L4): `src/lib/scaffold.ts:741` does not type-strip.**
- Evidence: `node --experimental-strip-types -e "import('./src/lib/scaffold.ts')…"` → `IMPORT FAIL: Expected ',', got 'ident'` — reproduced at 13:56, 13:59, 14:06 (RUN2), 14:08. File mtime 13:47:57, unchanged since.
- Locus: the emitApi stub line — `` `  throw new Error(\\`${emittedRefusal(…)} \\${method} \\${path}\\`);`, `` — the nested-template escaping is wrong; sibling sites use `${jstr(…)}` and are fine. First reporter: L3 §6 (correctly did NOT touch it — box respected).
- Collateral: any suite importing scaffold.ts is red right now — L3 observed `mock.test.ts` 11/12 (13:50, `mock_baseline.txt`); RUN2 shows L4's own named test cannot load.
- Status: **mid-flight** (L4's log is still a skeleton) → not yet a violation, but it becomes **P1 at wave close if unfixed**. Recovery steps in §6.

No other incidents. Zero box violations. Zero corpus deletions.

---

## 5. Collision map (spotted before they happen)

1. **REALIZED — L4 ↔ scaffold-importing suites** (C-1): `mock.test.ts`, `emitted-honesty.test.ts`, and any W16/parent suite that pulls scaffold.ts are red until line 741 is fixed. Do not run wave-boundary suites before then.
2. **L4 ↔ W16 test files (sequencing)**: `gates.test.ts` / `honesty-guards.test.ts` / `packet.test.ts` (W16's, quiescent) may import engine/scaffold — they must not be trusted green while C-1 stands.
3. **L2's residual seams are unowned**: `chat.server.ts:561`, `crew.server.ts:885` (L2 log §4) are in no W17 box and no W16 box — safe to dispatch a W18 lane on those two files only; wrapper applies verbatim.
4. **L5's noted follow-up lands in L4's box**: the emitted-README supply-chain line (`scaffold.ts`, L5 log §C.4) must NOT be dispatched while L4 holds scaffold.ts — sequence it after L4 lands.
5. **Working-tree interleave (W16 dirt + W17 work)**: `git status` mixes both waves' files; the boundary commit must attribute per-file — the poll snapshots give the write-time timeline (all W17 writes ≥13:36; W16's last writes ≤13:37:25).
6. **Line-number drift**: L3 shifted its sites 119/144/168 → 133/164/193; L4 shifted engine.ts 922 → 925-region and 1027/1048 → 1030/1052. Docs citing pre-wave line numbers (incl. the wave plan) are stale — anchor by symbol.
7. **Guard scan gap (documented, not a bug)**: zero-byte guard scans `git ls-files` only — `emitted-honesty.test.ts`, `zero-byte-guard.test.ts`, `.github/` are untracked until the parent `git add`s them; guard sees them only after.
8. **No corpus collision**: L1 verified sole editor; no other lane or W16 lane wrote under `research/` in the window.

---

## 6. Help-the-delegator verdict + next dispatch

| lane | verdict | basis |
|---|---|---|
| **L1 corpus fold** | **ON-TRACK → DONE** | 56,593→90,249 B, 90/0 numstat, 42 FOLD markers, sha matched; §G + §7 appendix present; nothing deleted. |
| **L2 T-107.6** | **DONE** | 4 seams wrapped, catch wrapper + pins verified, 67/67 re-run. Row stays *open* on 2 out-of-box seams (honest, named). |
| **L3 thinking trio** | **DONE** | Per-site pins, id-naming refusal, flip-RED falsifiability all verified; 29/29 re-run. |
| **L4 emitted honesty** | **STUCK / AT-RISK** | All three sub-edits landed in bytes but `scaffold.ts` does not parse; log still skeleton; no writes for ~18 min; own named test cannot load. |
| **L5 infra** | **DONE** | gate.yml parse+no-keys verified; guard re-run green; OV-43 surface verified in bytes. |
| **W16 tail** | **QUIESCENT** | No writes since ~13:38–13:40; logs filled; 5 dirty files + 244/245/246 logs await the boundary commit — none touched by W17. |

**Next-dispatch guidance (in order):**
1. **Recover L4 (highest priority).** Resume L4 (or re-dispatch the same narrow box) with: fix `scaffold.ts:741` (use the `${jstr(emittedRefusal(…))}` pattern already used at the 9 sibling sites — never raw `\\\`` nesting); then `node --experimental-strip-types -e "import('./src/lib/scaffold.ts').then(()=>console.log('OK'))"`; then `node --experimental-strip-types --test src/lib/emitted-honesty.test.ts src/lib/scaffold.test.ts`; then fill `fixes/247_lane4_emitted_honesty.md`. Do not touch any other lane's files. **This also clears the 9 `headless.test.ts` emit-path failures the W18 boundary run recorded (83/92) — fix C-1 before WD-β re-runs that suite (§7).**
2. **Then boundary gates** (parent): typecheck / lint / full suite / build on the frozen tree; watch `mock.test.ts` and any scaffold importer first.
3. **Commit hygiene**: separate W16's leftovers (run-eval.mjs, run-eval.test.mjs, gates/honesty-guards/packet `.test.ts`, README-cli.test.mjs, fixes/244-245, fixes/246) from W17's deliverables (research 220; L2/L3/L5 files; `.github/`; 2 new test files; 5 lane logs; this report). `git add` new files before any guard/CI run (collision-map #7).
4. **W18 candidates now unblocked**: (a) T-107.6 residual seams `chat.server.ts` + `crew.server.ts` (verbatim wrapper) — unowned, safe; (b) OV-28 behaviour arm — needs the owner's tier-intent decision (228 §3 #9); (c) L5's scaffold.ts emitted-README follow-up — **only after L4 releases scaffold.ts**.

**Honest limits of this watch:** L4's final state is measured as of 14:08 (stalled — it may still land after this report; re-check with the §6.1 commands). L5's OV-43 suite and L4's eventual green run were not re-run by the watchdog (2-run budget). W16 tail was observed via mtimes/logs, not opened lane-by-lane. Every number above is a command output from this session; raw snapshots kept in `C:/Users/mnril/w17wd_scratch/`.

---

## 7. Appendix — W18 wave observed mid-watch (read-only, ~14:04–14:10)

- **What appeared:** `wave_plans/W18/lanes-and-watchdogs.md`; lane logs `fixes/249_lane{1..5}*`; `fixes/250_w18_wd_alpha.md` (WD-α quality); `fixes/251_error_ledger.md` (WD-β); `research/multiagent/249_define_first_specs.md`; new `src/lib/plugin.ts` (14:09:15, W18-L4 in flight). Git status now 45 entries (24 M + 21 ??).
- **W18 boxes (from its plan):** L1 `doctor.ts`/`dod.ts` · L2 `knowledge.ts` + `scripts/rapidtool-cli.mjs` **lesson/eval arms only** + lesson test · L3 NEW `git.server.ts` · L4 NEW `plugin.ts` · L5 `io.ts` + `codegen.server.ts` · L6 `research/multiagent/249_define_first_specs.md` (spec-only). **Disjoint from every W17 box** — no W18 lane owns `220`, `llm-tasks.ts`, `registry.ts`, `deepseek.ts`, `engine.ts`, `phases.ts`, `scaffold.ts`, `token-ledger.ts`, `verify.server.ts`, `compile-check.server.ts`, or `.github/`. Two notes:
  1. `scripts/rapidtool-cli.mjs` is **clean vs HEAD** (mtime 13:28:46, not in git status) — W18's plan lists it under W16-owned files. If W16-L2 ever resumes the summary arm while W18-L2 holds the lesson/eval arms, serialize the writers (same file, different regions).
  2. Any W18 lane running a suite that imports `scaffold.ts` inherits C-1 as false reds — WD-β's headless run is the first instance.
- **The 9 headless failures, re: C-1.** W18's boundary run recorded `headless.test.ts` at **83/92** (9 CLI/emit integration failures: E-25, A7, T-07 …), attributed to W17's emit-path edits; `headless.ts` itself is byte-identical to `4328d20` (my diff checks agree). Watchdog narrowing: the only W17 emit-path edit that **cannot load** is `scaffold.ts:741` (C-1); every other W17 emit edit (engine.ts labels/markers; the 9 `jstr`-based scaffold hunks) parses cleanly. C-1 is therefore the leading suspect for import-mediated subtests; a second candidate is L4's G5 change itself — emitted stub text now carries the `RT_E_VALIDATION · ` prefix, so any subtest asserting the OLD emitted text would also fail. Both are inside L4's box; reconcile before its log closes (§6.1 order).
- **Handover value for W18's watchdogs:** C-1 locus + repro (this §, §4); the W17 per-lane status table (§6) for `[EXT-FAIL]` attribution; `poll_*.txt` snapshots for per-file write timelines (W16 ≤13:37 · W17 13:36–13:53 · W18 ≥14:04); the corpus 220 is frozen at L1's fold — `90 0` numstat, sha256 `e6f30807…` — re-verify before any W18 read-only cites.
