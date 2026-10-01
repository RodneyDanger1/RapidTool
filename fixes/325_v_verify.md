# 325 — V6/V7 · FINAL VERIFICATION (W44 six-professional bug-hunt era)

Lane: V6 + V7 (final verifiers; V7 = completion of V6). Repo: `C:\Users\mnril\Desktop\RapidTool Main`.
Base: commit `e2fbd9d` + the bug-hunt wave's edits (final quiet tree). Scratch: `v6_scratch/`, `v7_scratch/`.
**Keyless only — zero keyed calls. No code edits; the only repo writes are the hunter logs + this record.**

## Method
- Six hunters (A1..A6) in disjoint boxes; finishers A1b/A3b/A5b/A6b/A6c completed capped lanes; V6 built independent adversarial batteries (`v_a1..v_a6`, `v_suites.sh`) and audited diffs; V7 re-ran everything fresh, verified A6c's applies, audited pins/writers, and ran the final gate (parent-assisted close).

## Per-bug verdicts (all six hunters) — all VERIFIED unless noted

| Hunter | Bug (severity) | Verdict | Evidence |
|---|---|---|---|
| A1-1 | Sealed-park hydrate loss — `WILD_PARK_UNLOCKS` omitted `agent-seal`; persisted sealed park + `lastStep` silently dropped (HIGH) | **VERIFIED** | `v_a1` 22/22; `engine.test.ts` 10/10; seal+step 49/49; fix hardened to a DERIVED accept-set (`acceptedParkUnlock` ← `WILD_UNLOCK_TEXT`); mirror audit clean |
| A1-2 | `parkIfNull` stamped a non-existent `wild.paused` row on ~14 arms — lying `WildParkInfo.event` (MED, found by A1b) | **VERIFIED** | `repro2.mjs` pre/post; 4 pins; seal control unchanged |
| A2 B1 | `parseWildReview` quoted-verdict hole — reject note quoting approval text could parse as APPROVE (HIGH) | **VERIFIED** | `v_a2` 20/20; `wild-mode.server.test` 28/28 (12 new legs); 4 pins |
| A2 B2 | Artifact list slice dropped artifacts 9+ silently (MED) | **VERIFIED** | marker pins (9-small / 9-huge / 8-exact) |
| A3 A-1 | Postfix `++/--` division misread as regex open — forbidden-scan hole (`fetch`/`window` invisible) + mirror false refusals (HIGH) | **VERIFIED** | `v_a3` 14/14; TS-lexer battery 10/15→14/15; probes 1–4 |
| A3 A-2 | Depth walks ignored regex literals — `/}/g` dropped → dangling `};` SyntaxError; `/[{]/` swallowed rest of file (HIGH) | **VERIFIED** | pre/post byte pairs via base worktree probes 6–10 |
| A3 A-3 | `localBindingNames` missed bare/destructured decls → duplicate declaration kills tree at import (MED) | **VERIFIED** | probe + pin |
| A3 A-4 | Repair-prompt FIRST FORM example was invalid JSON (LOW) | **VERIFIED** | prompt byte fix + pin |
| A4-1 | Checkpoint staleness missed the REJECTION axis — resume overwrote the file, destroying the human rejection (HIGH) | **VERIFIED** | `v_a4` 7/7; `checkpoint.server.test` 18/18 (was 17); probe2 pre/post |
| A5 B1 | `--out=` empty value melted files into the CWD with exit 0 (emit 15 files / vault 17 files) (MED-HIGH) | **VERIFIED** | `v_a5` 11/11; taxonomy 16/16 (new refusal pins); keyless spawn repros |
| A5 B2 | Eval empty-corpus `results.json` non-atomic + shape-inconsistent (MED) | **VERIFIED** | `run-eval` 48/48 (+atomic/shape pin) |
| A5 B3 | (per A5 log) | **VERIFIED** | `cli-run-busy` 6/6 |
| A6 A | `compileAgentPacket` crashed on 12 junk-collection shapes (TypeErrors) + `packetInputHash` on 4 (HIGH) | **VERIFIED** | 14-site `Array.isArray` guard set (M3-14 idiom); `a6b_sites_pre/post` byte pair; `packet.test` M3-18 block |
| A6 B | Raw-domain return in algorithms (coerced domain dropped) | **VERIFIED** | `algorithms.test` pin beside the site |
| A6 C | `acceptedLessonEntry` `cls` resolver omitted `probe:`/`actor:` skips (docstring/code mismatch created mid-hunt, closed by A6c) | **VERIFIED** | one-liner `cls = lessonClassTag(rowTags)` + M-tier pin |
| A6 D | "23 emitted / 37 dead" registry claim | **FALSIFIED — no code change** | two independent re-counts: catalogue 60 / emitted 22 / dead 38 == the in-file list; the "23" counted test fixtures; the comment is truthful |
| A6 E | Lesson prompt re-cap 240 vs record 600 | **ADJUDICATED — 240 stays** (per `fixes/322_x3_fixes.md` §Coupling sweep); comment parity + differential pin |

## Fresh counts (V7's verification + parent confirmation)
- Adversarial batteries: `v_a1` 22/22 · `v_a2` 20/20 · `v_a3` 14/14 · `v_a4` 7/7 · `v_a5` 11/11 = **74/74** (spot re-run fresh by V7; parent re-ran v_a1's class via engine.test).
- `src/lib/engine.test.ts` (created): **10/10**. `wild-seal`+`wild-step`: **49/49**. `wild-mode.server`: **28/28**. `checkpoint.server`: **18/18**. Scripts: taxonomy **16/16**, run-eval **48/48**, busy **6/6** (parent-verified foreground; the A5b background triple was a "stdin is not a tty" harness artifact — foreground counts are of record).

## A6c applies verification (independent)
- `node --check` A6c's 7 edited files: 7/7 OK (+ parent: `packet.ts` OK).
- Junk-shape compile: `a6b_sites_post.txt` shows all previously-throwing shapes compiling; empty-form honesty preserved.
- `cls` one-liner re-verified with the predecessor repro (`Lesson L2 probe:p6-brief-fit` resolves `template-emission`).
- `prompt-engine` comment now states the deliberate differential (240 prompt cap vs 600 record; cut marked; source cited).
- Pins present + green: packet.test (M3-18), algorithms.test, knowledge.test M-tier, prompt-engine.test.
- Two noted leftovers: one second-order `contracts` shape remains unguarded (recorded by A6c, non-crashing class), `a6_scratch/packet_a6c_fixed.bak` = harmless backup.

## Pin integrity + writer map vs `e2fbd9d`
- All test-file changes are additive legs or recorded deliberate adaptations; **zero silent weakening, zero deletions** (V6/V7 diff audits: `v6_scratch/d_tests.txt`, `d_*` per-file, `v7_scratch/full_diff.txt`).
- Writer map: every edited file belongs to a lane box (engine=engine+engine.test; wild-*=A2; sandbox/codegen/dod=A3; headless/store/checkpoint/diagnose/io/phases/types=A4; scripts=A5; knowledge/packet/prompt-engine/rt-events/errors/algorithms=A6/A6c). No orphan edits.

## Zero-loss sweep
Six hunter logs: `325_a1..a6_hunt.md` — a1/a2/a4/a5 parent-closed with fresh counts; a3 + a6 closed by their finishers (a6: applies + proofs recorded). Finisher outcomes: A1b (2 fixes, 10 pins, proofs green), A3b (4 fixes, 6 pins), A5b (3 fixes, pins, suites green), A6b/A6c (5 defects: 4 fixed, 1 falsified, 1 adjudicated). V6/V7 batteries + gate archived in scratch + `v7_gate.log`.

## Gate (final boundary, quiet tree) — `C:/Users/mnril/v7_gate.log`
`{"ok":true,"double":false,"flakes":[],"hardFails":[],"skips":1,"wallMs":271143,"gates":{"typecheck":{"ok":true,"exit":0,"ms":21203},"lint":{"ok":true,"exit":0,"ms":27320,"problems":null},"assertionGaps":{"ok":true,"exit":0,"ms":888},"build":{"ok":true,"exit":0,"ms":45625},"testsScripts":{"ok":true,"exit":0,"ms":66302,"pass":367,"fail":0,"skipped":0},"testsLib":{"ok":true,"exit":0,"ms":108851,"pass":2548,"fail":0,"skipped":1}}}`

=== END 325_v_verify — COMPLETE (V6/V7 verification + parent close; gate run by parent on the quiet tree) ===
