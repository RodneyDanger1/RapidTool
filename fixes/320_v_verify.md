# 320 · V · INDEPENDENT VERIFIER + WATCHDOG — W44 wave-2 (G1 park/review · G2 diagnose · G3 T9.3 promotion)

Lane V (verifier) of the W44 Phase-2 wave-2, batch `deleg_0b7a2ee5` (task-0 G1 · task-1 G2 · task-2 G3 · task-3 V).
Repo: `C:\Users\mnril\Desktop\RapidTool Main`. HEAD at wave open: `c1049ba` (tree clean; wave-1 boundary
green at `21c4731`). V edit discipline honored: **no code edits, no edits to sibling logs**; V wrote only
this file + `C:/Users/mnril/v2_scratch/**` (+ gate log `C:/Users/mnril/v2_gate.log`). Every proof below was
re-run fresh, foreground, keyless, on THIS tree; every count is V-measured, not quoted.

## Status

**COMPLETE.** All three lanes ended (G1 11:33:32 · G2 11:36:28 · G3 11:39:03 local). Every landed claim
re-verified with fresh bytes; **boundary gate on the quiet tree → `ok:true`**; phantom tripwire clean;
zero-loss sweep done (G1's zero-edit investigation rescued in §5). Lane G1 landed nothing (iteration cap) —
its tickets are OWED, see §7. No stray edits anywhere.

Lane durations: G1 441.95s (cap, `status=completed`) · G2 618.11s · G3 773.58s.

---

## 1 · Boundary gate — ONE run, V's own, quiet tree

`bash scripts/gate.sh` (no `--double`), foreground, alone (verified 0 node processes before the run).
JSON (verbatim; full log at `/c/Users/mnril/v2_gate.log`):

```json
{"ok":true,"double":false,"flakes":[],"hardFails":[],"skips":1,"wallMs":233345,"gates":{"typecheck":{"ok":true,"exit":0,"ms":23273},"lint":{"ok":true,"exit":0,"ms":27497,"problems":null},"assertionGaps":{"ok":true,"exit":0,"ms":1361},"build":{"ok":true,"exit":0,"ms":17103},"testsScripts":{"ok":true,"exit":0,"ms":56984,"pass":359,"fail":0,"skipped":0},"testsLib":{"ok":true,"exit":0,"ms":106280,"pass":2474,"fail":0,"skipped":1}}}
```

Reading: `ok:true`, exit 0, wallMs 233345 (~3.9 min). scripts **359/359** (+1 vs wave-1's 358 = G3's new
run-eval pin); lib **2474 pass · 1 skip** (+5 vs wave-1's 2469+1skip: G2 +4 pins, G3 +1 headless pin);
typecheck 0 · lint 0 (`problems:null`) · assertionGaps 0 · build 0 · no flakes/hardFails. The wave-2 tree
is boundary-green.

---

## 2 · Per-lane verdict tables

### G2 — diagnose wildRun (task-1, log `fixes/320_g2_diagnose.md`, END at :247)

| Claim (theirs) | V evidence (fresh) | Verdict |
|---|---|---|
| `projectWildRun` in `diagnose.ts`: disk truth; `stoppedAt` verbatim (never read-time); `overdueMs` only while `active && !pause`; junk → null | V's own module probe (5 groups): parked → `active:true,pause:true,stoppedAt:null,overdueMs:null`; stop `123` passes verbatim; progressing → 5000ms; junk(null/5/[]/"x"/true) → null; input not mutated — all pass | **VERIFIED** |
| 4 new pins; suite 21/21 (17 baseline + 4) | V re-run: `# tests 21 / # pass 21 / # fail 0`, exit 0; pre-state count measured 17 (git show), now 21; diff = +150/−1 (import line only) | **VERIFIED** |
| eslint 0 | V re-run: exit 0 | **VERIFIED** |
| Fixture integrity; trial untouched | `w44_trial/game/build.json` sha256 `2d37abe4…e5db` == their copy's; unchanged across all runs | **VERIFIED** |
| "CLI §6 is [FOR-PARENT], NOT applied; the verb still fabricates until then" | V's own CLI repro on a scratch copy: post-in-box verb still `active:false,pause:false`, `stoppedAt` MOVED 1790786415037→1790786418068, `overdueMs` +3029ms on a parked run whose disk says `active:true,pause:true,stoppedAt:null`; sha unchanged, exit 0, stderr 0 | **VERIFIED** (honest partial) |
| Ticket #6 fixed end-to-end | Not landed by design (their §6 owed) | **UNSUPPORTED** — owed to parent (§7.2) |

### G3 — T9.3 promotion (task-2, log `fixes/320_g3_promote.md`, END at :92)

| Claim (theirs) | V evidence (fresh) | Verdict |
|---|---|---|
| §C applied, 5 files, 144 insertions/1 deletion, zero new imports | `git diff --numstat` = 27+15+34+35+33 = **144/1** (1 del = run-eval.test import line); diffs match §C literal (headless helper verbatim; cli wire; run-eval wire + import; 2 pins); no import additions in product files | **VERIFIED** |
| headless.test.ts 107/107 incl. new T9.3 pin | V re-run: 107/107, exit 0, `ok 4 - T9.3 …promotes…` ran | **VERIFIED** |
| run-eval.test.mjs 46/46 incl. new pin | V re-run: 46/46, exit 0, T9.3 pin ran | **VERIFIED** |
| CLI neighbor legs 24/24 | V re-run: 24/24, exit 0 | **VERIFIED** |
| eslint 0 (5 files) | V re-run: exit 0 | **VERIFIED** |
| GREEN `emit --run` → envelope `tested{promoted:true,label:"tested",evidenceHash:"3488319203",ledgerSaved:true}`; emitted record carries the stamp; ledger absorbed; tested-log row | V's OWN scratch E2E (create → emit --run, keyless): envelope identical incl. **evidenceHash 3488319203**; `treeRun.ok:true`, `verdictHash:"890750497"` (deterministic); record `lastTest` = `{ok:true,detail:"tree-run green: …",label:"tested",evidenceHash:"3488319203"}`; ledger absorbed; 1 tested row; exit 0/stderr 0 | **VERIFIED** |
| RED `emit --run` exit 1; record byte-identical; no stamp; ledger untouched | V's OWN red probe (broken `generatedSource`): exit 1 `RT_E_TREE_RUN_FAILED`, compile `failed:1`; record sha1 `1306c288…` IDENTICAL for no-run vs red-run; `lastTest:null`; `"label": "tested"` absent in both; ledger sha unchanged before/after both emits | **VERIFIED** |
| §C4 (repair parity) withheld as structurally inert | V checked `recordGreen` (headless.ts :3170+): it runs `applyTreeRunTestedMint(finalProject, verdict)` BEFORE returning `res.project` ⇒ the §C1 guard (`before === "tested"` → `promoted:false`) makes the drafted §C4 call a no-op | **VERIFIED** (withheld correctly) |
| "no stamp fabricated" | V probe + E2E: the only stamps are those earned by real green verdicts; red/no-spec/recordless branches write nothing (pins + V's red bytes) | **VERIFIED** |

### G1 — park/review machinery (task-0) — log `fixes/320_g1_review_park.md` NEVER CREATED

| Claim | V evidence | Verdict |
|---|---|---|
| "investigation complete; no edits landed (iteration cap before log/edit phase)" | `git status`: zero writes in G1's would-be home (no engine/store/types edits); no log file exists; transcript ends `final | status=completed duration=441.95s` at 11:33:32; no keyed calls, no boundary runs, no key reads (checked transcript) | **VERIFIED** (the no-edits claim) |
| GAP-1 fix — mint a legitimate HUMAN decision gate on review-reject parks; approve→complete/advance + reject-note→re-run loop works; machine seats stay refused; seal stays refused; pure-floor parks unchanged | NOTHING LANDED | **UNSUPPORTED** (owed — §7.1) |
| Raise reject-text surfaces (note / park.reason / lastAutoLog) | NOTHING LANDED | **UNSUPPORTED** (owed — §7.1) |

---

## 3 · Stray-edit / one-writer map

At wave close (pre-gate, and again post-gate — unchanged): `git status --porcelain` =
`M scripts/rapidtool-cli.mjs · M scripts/run-eval.mjs · M scripts/run-eval.test.mjs · M src/lib/diagnose.test.ts ·
M src/lib/diagnose.ts · M src/lib/headless.test.ts · M src/lib/headless.ts · ?? fixes/320_g2_diagnose.md ·
?? fixes/320_g3_promote.md (+ V's log after this write)`.

- Attribution: every `M` file is in G2's box (`diagnose.ts|test`) or G3's box (`cli`, `run-eval*`, `headless*`); **G1 wrote zero**.
- **No stray edits found — no [BUG] findings.** No edits to `engine.ts`/`store.ts`/`io.ts`/`types.ts`; no untracked strays beyond the two lane logs; `git stash` empty; single worktree; `git diff --check` exit 0.
- No writes under `C:/Users/mnril/w44_trial/**` (game build.json sha re-verified; G2 re-hashed; G1 read-only).

## 4 · Phantom tripwire

Node processes sampled across the wave: mid-wave 2 (G2's own probe `C:/Users/mnril/g2_scratch/g2_probe.mjs`, PID 7160 — a script probe, not a test runner; exited by 11:39), **0 at every V re-run time and at gate time**. No backgrounded `node --test` anywhere; every V leg ran foreground with captured exit codes; gate ran alone. **No [PARENT CORRECTION] needed.**

## 5 · [V-RESCUE] — G1's found-but-unwritten (from `task-0.log`; no lane log exists to hold it)

GAP-1 mechanics, verified by G1 against live bytes (quoted essentials):
- Review-park disk shape: `status:"running"` + **`hitl:null`** + `wildRun{active:true,pause:true,stoppedAt:null, park:{code:"RT_E_GATE_PENDING", unlock:"human-gate", unlockText:"A human must approve or reject…", resumeAction:"advance"}}`.
- CLI refusals: `approve` refuses at `rapidtool-cli.mjs:932` ("No pending gate to approve (status: …)", `RT_E_GATE_PENDING`); `reject` at `:1079` same class — both keyed on `project.hitl`, which is null on review-parks ⇒ dead end.
- Seat/policy seam to preserve: `headless.ts:596` (`if (project.hitl.forceHuman) return false`); `store.ts:432/450` (autopilot exclusion); pins already in-tree: `store.test.ts:310` ("autopilot can never approve a forceHuman gate"), `wild-step.test.ts:855` ("seal, keyless, no seam ⇒ the honest no-edge park (B-07)").
- Surfaces measured (BUG-5): envelope `note` len **1495** (full, ends "…and (3)"), `lastAutoLog` len **300** (slice site `engine.ts:1287/:1307`), `park.reason` len **200**; `wild.reject` detail 1515 / `wild.review` 1519 (full only in `logs[]`).
- Fix loci G1 inspected (for the next lane's benefit): `types.ts` `HitlRequest :275-319`; `engine.ts` `rejectHitl :1785`, `recordGateInline :1630`, `WILD_UNLOCK_TEXT :3872`, `resolveWildReviewBounded :4232`; CLI `approve/reject` arms `:905-1010` / `:1079`; `at.json`/`_approvetest/` probe bytes = `hitl:null` confirmed.
- **Implementation owed** (G1 consumed its budget reading; no design doc written) — see §7.1.

## 6 · Zero-loss sweep

- **G2**: log complete (§1 recon → §2 repro → §3 fix → §4 pin → §5 proofs → §6 [FOR-PARENT] → END, with a fresh re-verification addendum embedded before END). V read the full transcript: **nothing found-but-unwritten**.
- **G3**: log complete (A pre-flight → B application + logged deviations → C proofs → D parent notes → END). Transcript matches; **nothing unlogged**.
- **G1**: no log — rescued above.
- Carry-forward notes (already in lane logs, re-floated for the parent): (a) G2 §5/§6 — a scripts-leg spawn pin for the wired `diagnose` verb is the candidate to close the "verb not pinned in-repo" gap; `rt-client.ts:652-653` inline dedupe optional. (b) G3 §D.2 — run-eval wire coverage honesty note (driver self-executes; next real eval run exercises it; `treeEv.minted` records whether promotion fired). (c) G3 §D.1 — a real repair-dir promotion needs a record-reading variant (new semantic; beyond T9.3 done-when).

## 7 · Owed after this wave (exact)

1. **GAP-1 + surfaces #4/#5 (G1's whole ticket): untouched.** Next lane needs: log-first brief; engine.ts mint of a legitimate human `HitlRequest` on review-park (with `forceHuman` semantics per B-03/R-3 so machine seats + seal stay refused and pure-floor parks stay unchanged); approve routing (`approveHitl` → complete/advance) + reject (`≥12-char note` → rejectionHistory → re-run); raise `park.reason`/`lastAutoLog` caps (200/300 → full or ellipsized) with pins. All probe bytes in §5 + `fixes/319_keyed_trial.md` §FINDING-2.
2. **#6 diagnose verb wiring: apply G2's §6 hunks A+B** (content-anchored; the tree already carries G3's +27-line cli hunk). Until applied, the verb still fabricates (V repro bytes in §2-G2). Optional: scripts-leg spawn pin.
3. Gate/boundary: already green on this tree (§1) — commit is the parent's call.

Artifacts: `C:/Users/mnril/v2_gate.log` (gate), `C:/Users/mnril/v2_scratch/` (poll.sh, notes.md, v_probe_g2.mjs, v_repro_g2.sh, v_e2e_g3_green.sh, v_e2e_g3_red.sh + outputs g2_cli/, g3_e2e/).

=== END 320_v_verify — COMPLETE ===
