# fixes/267_lane5_audit_harness.md — W27 · R5 · THE HARNESS (CLI + scripts + guards)

**Lane:** R5 (W27 mass investigation). **Slice:** `scripts/**`, `package.json`, `migrations/**`.
**Brief:** `wave_plans/W27/mass-investigation.md` §R5 (read in full 2026-09-26). **Shared log:** `research/multiagent/thoroughanalysis.md` §R5 (appended via the END-OF-FILE-MARKER-W25 protocol at line 803; marker verified unique + last line after the append).
**Rules honored:** no product edits; no keyed calls; no full-gate runs; every claim file:line (read today) or a real command output. Fixtures live OUTSIDE the repo (`C:/Users/mnril/r5_fixture/`).
**HEAD:** `e3d3fe4`. **md5s at read time:** gate.sh `347948cd…` · rapidtool-cli.mjs `44eabcf…` · README-cli.md `15f967ce…` · package.json `302add92…` · run-eval.mjs `b48e33b7…` · scorecard.ts `4a2fe415…` · policy.ts `4456dc64…` · brief-fixtures.ts `8eb27c19…` · write-atomic.mjs `3f47493c…` · browser-guard.mjs `38dbd378…`.

## Status: COMPLETE — §R5 appended (15 findings/spec items), no product edits.

## Findings landed in §R5 (R5-fNN → source ID · severity · one-line)
| R5 | source | sev | one-line | state at HEAD |
|---|---|---|---|---|
| f01 | A2-f02 | P1 | gate.sh green verdict with a red test leg | CONFIRMED + REPRODUCED LIVE (real fixture output below); fix + fixture spec'd |
| f02 | A2-f01 | P1 | `fixtures --approve` mints human approval with no seat/token | CONFIRMED (cli:977-997); evaluatePolicy route spec'd (`fixtures.approve`, requiresHumanSeat) |
| f03 | A2-f03 | P2 | internal-class failures exit 1 in 14 verbs (taxonomy says 4) | CONFIRMED + widened (A2 said ≥7; script-scan found 14); fix + mechanical guard spec'd |
| f04 | A2-f04 | P2 | `eval` "no writes" claim false | CONFIRMED live (log +809 B; results.json untouched); reword spec'd |
| f05 | A2-f05 | P2 | `balance-exhausted` has no producer, echoed verbatim | CONFIRMED (0 code hits; marker artifact lega); alias/resolver spec'd |
| f06 | A2-f06 | P2 | no envelope-level NOT-A-MEASUREMENT flag | CONFIRMED (no `measurement` key in real output); `measurement:false` spec'd |
| f07 | A2-f08 | P2 | README stale on `emit --verify-kind` (6 places) | leg LANDED on disk (cli:879-891 + verifyKindDir + 6 tests); doc rewrite spec'd |
| f08 | A2-f09 | P2 | no `## Fixtures`/`## Eval` sections; lesson list omits `--effect` | CONFIRMED; sections + test assertions spec'd |
| f09 | A2-f10 | P2/P3 | `--draft` clears `acceptanceApprovedAt` while keeping approved rows | CONFIRMED; stamp-recompute spec'd |
| f10 | A2-f11 | P3 | valueless `--out` refused in 2, silently ignored in 5 | CONFIRMED (emit:817/vault:1634 only); 5 guards spec'd |
| f11 | A2-f12 | P3 | win32 sandbox-only guard writes `C:\workspace` (S-04 open) | CONFIRMED; S-04 option (a) + test flip spec'd |
| f12 | C2-f02 | P2 | human-seat token check degenerate (same env both sides) | CONFIRMED at HEAD; two-channel design spec'd (Track 1 + Track 2 stopgap) |
| f13 | C2-f03 | P3 | 35-vs-37 + narrow doc test | numbers ALREADY fixed at HEAD (0 × "35"); test widening spec'd with helper fixture |
| f14 | C2-f05 | P3 | write-atomic legacy descope | CONFIRMED (zero callers; test reads `.grok/skills/og/**`; S-05 hole); descope/keep spec'd |
| f15 | — | — | verified-clean + adjacent | migrations/** + package.json clean; R4-f10 probe hand-off; census |

## The live reproductions (real outputs, run 2026-09-26, all outside the repo)

**1. gate.sh red-leg green verdict (R5-f01's proof).** Extracted the embedded verdict program byte-for-byte from `scripts/gate.sh` (`<<'NODE' … NODE`; 2,859 chars) to `C:/Users/mnril/r5_fixture/gate_program.js`. Fixture A (`testsScripts.exit=1`, log with ZERO `not ok` lines, all other gates 0):
```
{"ok":true,"double":false,"flakes":[],"hardFails":[],"skips":0,…,
 "gates":{…,"testsScripts":{"ok":false,"exit":1,"ms":900,"pass":0,"fail":0,…},…}}
EXIT=0
```
Control (same exit, log has `not ok 1 - some failing test` + `# fail 1`):
```
{"ok":false,…,"hardFails":["some failing test"],…,"testsScripts":{"ok":false,"exit":1,…}}
EXIT=1
```
→ the bug window is exactly the no-TAP-line class; the fix (`gate.sh:178` + the new `scripts/gate-verdict.test.mjs`) is specified in §R5.

**2. `eval` writes while claiming it doesn't (R5-f04/f05/f06).** `node --experimental-strip-types scripts/rapidtool-cli.mjs eval` → exit 0; `.rapidtool/logs/rapidtool.ndjson` **981,282 → 982,091 B** (`cli.eval.ok` row); `research/eval-out/results.json` md5 `2f83f2f0…` unchanged. Envelope: `derived.meanTotal 0.3333`, `runMarker.preflightClass "balance-exhausted"`, and **no `measurement` key** (top-level keys enumerated).

**3. Taxonomy scan (R5-f03).** Scripted map of every `errCode(err, "RT_E_INTERNAL")` site → verb + following exit arg: 27 occurrences; **14 exit 1** (packet:771, emit:939, fixtures:1002, vault:1651, search:1669, design:1835, diagram:1870, harvest:1914, swarm:1939, bench:1989, knowledge:2085, lesson:2827, wild:2905, deepen:3020); the rest already exit 4.

**4. Count/taxonomy greps (R5-f07/f13).** `grep -c 'case "' scripts/rapidtool-cli.mjs` = 37; `grep -n '35' scripts/README-cli.md` → 0 hits; four count claims all read 37. `grep -rn 'balance-exhausted' scripts/ src/` → 0 code hits.

## Deliverable
- `research/multiagent/thoroughanalysis.md` §R5 — lines 803-895, appended above the intact marker (marker re-verified unique + last line post-append). 15 items, each with exact patch shape + verify command.

## Trace limits
- No keyed calls; no full-gate runs. `with-app-env.mjs` head-only; `preview.mjs` beyond the `/proc` gate unread; `run-eval.mjs` read around the preflight/marker/fundedness regions only; `check-assertion-gaps.mjs` body not re-read (A2 verified-clean last wave).
- The Track-1 TTY prompt path (R5-f12) cannot be end-to-end proven from an agent (no TTY) — spec'd; manual terminal run recorded as the remaining proof, by design.
