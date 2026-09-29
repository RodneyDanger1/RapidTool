# fixes/308_map3_runtime.md — MAPPER-3 · DYNAMIC/RUNTIME BUG MAP (RESCUED)

**Rescued by:** the parent (commander lane) from MAPPER-3's final summary — its file write never landed (iteration cap).
**Method:** hostile-input probe (98 cases, `~/rt308_m3/hostile1.ts`, log `probe1_full.log`), CLI fuzz-lite (`cli_fuzz.mjs`), keyless e2e (`e2e_run.sh`), `--unhandled-rejections=strict`.
**Headline:** **98 hostile cases → 22 raw throws, 0 coded refusals.** Method-4 (unhandled rejections): CLEAN on the pure libs (exit 0).
**LIVE test:** repro via a strip-types scratch importing `C:/Users/mnril/Desktop/RapidTool Main/src/lib/<mod>.ts`. HIGH = reachable from a hand-edited/foreign project or CLI input.
**BOX:** C = cli/rt-events/diagnose/scorecard/run-eval · B = packet/llm/crew/io · A = engine/store/headless.

| M3 | class | repro (call) | file:line | sev | box |
|---|---|---|---|---|---|
| M3-01 | throw-not-refusal | `rtPush(ring,null)` / `(ring,undefined)` → `TypeError: reading 'ts'` | rt-ring.ts:117 | MED | C |
| M3-02 | throw-not-refusal + **spin** | `rtPush(ring,row,{cap:-3})` → **~7.8 s busy loop then** `RangeError: Invalid array length` (timed in `t_capneg.mjs`) | rt-ring.ts:139 | **HIGH** | C |
| M3-03 | silent-wrong | `rtPush(ring,row,{cap:NaN})` → row uncapped (NaN compare always false) | rt-ring.ts:138 | LOW | C |
| M3-04 | throw-not-refusal | `rtPush(null,row)` → `TypeError: reading 'rows'` | rt-ring.ts:127 | MED | C |
| M3-05 | throw-not-refusal | `rtTail(null,3)` → TypeError | rt-ring.ts:240 | LOW | C |
| M3-06 | throw-not-refusal | `rtStats(null)` → TypeError; `rtStats({rows:[null]})` → TypeError `reading 'level'` | rt-ring.ts:245/250 | MED | C |
| M3-07 | throw-not-refusal | `rtSerialize(null)` → TypeError | rt-ring.ts:156 | LOW | C |
| M3-08 | throw-not-refusal | `checkpointAdmits(ckpt, null)` → `TypeError: reading 'projectId'` (guard covers `checkpoint`, **not `ask`**) | checkpoint.server.ts:324 | MED | A |
| M3-09 | throw-not-refusal | `boundProjectForCheckpoint(null)` → `TypeError: reading 'logs'` (writeCheckpoint guards this, the export does not) | checkpoint.server.ts:137 | MED | A |
| M3-10 | throw-not-refusal | `buildDiagnosis(null)` → `TypeError: reading 'errors'` (all other args `?? default`-guarded; input itself not) | diagnose.ts:144 | **HIGH** | C |
| M3-11 | throw-not-refusal | `buildDiagnosis({...errors:[null,5,{...}]})` → `TypeError: reading 'scope'` (junk rows not filtered) | diagnose.ts:212 | **HIGH** | C |
| M3-12 | throw-not-refusal | crashSnapshot `{at:"y"}` (any junk) → `RangeError: Invalid time value` from `new Date(...).toISOString()` | diagnose.ts:283 | MED | C |
| M3-13 | throw-not-refusal | `compileAgentPacket(null)` → TypeError | packet.ts:514 | MED | B |
| M3-14 | throw-not-refusal | `compileAgentPacket({})` → `TypeError: reading 'filter'` | packet.ts:603 | MED | B |
| M3-15 | throw-not-refusal | `compileAgentPacket(junk{brief:42})`/`{brief:null}` → `TypeError: brief.trim` | packet.ts:687 | **HIGH** | B |
| M3-16 | throw-not-refusal | `compileAgentPacket(junk{schedule:{tightness:"x"}})` → `TypeError: reading 'length'` | packet.ts:736 | MED | B |
| M3-17 | throw-not-refusal | `packetInputHash(null)` → TypeError | packet.ts:290 | LOW | B |
| M3-18 | throw-not-refusal | `convergeRealRun(null,null,null)` → TypeError; junk `artifacts` → `not iterable` | store.ts:406 | MED | A |

**FIX PATTERN (per row):** guard-at-entry → a coded refusal or a safe default, matching the repo's own guard conventions (the H1 probe's 2 by-design throws are the model for honest refusals). Test per row: the exact repro becomes a pin asserting the CODED outcome (never a throw).
**Harness notes:** `~/rt308_m3/` scratch lives OUTSIDE the repo (delete freely); two M3 harness bugs were fixed and re-run before the table above; background fuzz results were never collected before the cap (a re-run may add rows).

**END OF MAP3 (rescued verbatim from the summarizer's row set — no edits to the rows).**
