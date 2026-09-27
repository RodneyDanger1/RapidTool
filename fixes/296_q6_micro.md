# fixes/296_q6_micro.md — Q6 · K7'S REMAINING MICRO-ITEMS (the unclaimed tail, W41)

**Lane:** W41 Q6. **Mission:** land what N5/P2/P4 did NOT claim out of K7's 12-item ledger (+ the two README minors
+ the acceptance question), each as the smallest honest patch with one evidence line.
**Sources:** `fixes/290_k7_tinyfixes.md` (the 12 rows) · `fixes/285_g2_agent_visibility.md` (items 3/4/10 origins —
K8's re-landed map) · `fixes/285_g4_operator_visibility.md` (item 7 origin) · `fixes/287_z5_runtime_tail.md` Part 4
(12e/12f) · `fixes/286_readme_catalog.md` · N5's `fixes/294_n5_cli.md` · live sibling logs read fresh:
`295_p1_f2tail.md`, `295_p2_chatui.md`, `295_p4_sweeps.md`, `296_q1_a1tail.md`, `296_q3_w3.md`, `296_q4_output.md`,
`296_q5_register.md`, `296_q8_ops.md`.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell grep only; keep one-liners SHORT).
**HEAD:** `ac6b151` + live sibling edits (P1 dirty in `packet.ts`, P2 dirty in `console.tsx` at t0) — every hunk
re-read at patch time.
**Contract:** smallest honest patch per item · additive only · `node --check` on every code edit · log `for <lane>`
on a sibling box · no gates / keyed calls / full runs · declare-or-strike (no claim without bytes).

## t0 — claim-check (K7's 12 rows vs live sibling logs, this read)

| # | K7 item | State at this read | Owner / evidence |
|---|---|---|---|
| 1 | `packet.ts` systemJson `decided_via` | **LANDED** | d98643f; `packet.ts:146-148` |
| 2 | `packet.ts:642` P6 label de-hardcode | **LANDED** | d98643f (`lastTest.label` + `evidenceHash`) |
| 3 | `project.acceptance` label surfaced | **OPEN → Q6** | field EXISTS: `types.ts:472` (B5 stamp), writer `headless.ts:139 runAcceptance`; `packet.ts` grep = 0 hits ⇒ NO strike — land the additive machine key |
| 4 | `io.ts:511`-era notes block de-dupe | **OPEN → Q6** | `io.ts:518-523 exportPacketText` appends `## Operator notes` while `packet.ts:595-602` already embeds `## Operator notes (human steering)` (G2 edge 2) |
| 5 | `rt-client.ts:693` fake-0 → null | **LANDED** | d98643f ("rt-client: fake-0 bytes → honest nulls") |
| 6 | `console.tsx` `growth.counts` producer | **CLAIMED by P2** | `295_p2_chatui.md` landing order #1 ("K7-6"); console.tsx dirty at t0 |
| 7 | `headless.ts` `DoctorStatus.spend` | **CLAIMED by Q8** | `296_q8_ops.md` item 8 ("`doctor` computes+discards `spend`", walk pending) |
| 8 | `cli.mjs` `: undefined` → `: null` | **LANDED** | N5; `rapidtool-cli.mjs:3441` = `path: res.changed ? path : null` |
| 9 | `cli.mjs` diagnose `checkpoint:{…}` | **LANDED** | ac6b151 ("checkpoint in diagnose") |
| 10 | `AGENT_GUIDE.md` §4 wording | **OPEN → Q6** | N5's item 6 never landed (no commit touches the file); P2 logged `for n5` |
| 11 | heartbeat scope `wild-driver`→`sys` | **LANDED** | d98643f ("coalesce key") |
| 12a | `ui.boundary_crash` vs twin `boundary.crash` | **OPEN → Q6** | emit `error-component.tsx:60`; registry `rt-events.ts:139` (`boundary.crash` → scope "boundary"); emit grep: no consumer pins the stray name |
| 12b | `PaneBoundary` RunScreen unwrapped | **LANDED** | `console.tsx:2743` `<PaneBoundary label="Run screen">` (P2 recorded) |
| 12c | `store.runP6Journey` dead edge | **NOT Q6** | store.ts = Q1's live box; caller side = console (P2) |
| 12d | `DEEPEN_ACTION_NAMES` silent rename degradation | **NOT Q6** | `console.tsx:6180-6184` = P2's live box |
| 12e/12f | README §10.6 split + 'root 35' | **OPEN → Q6** | P4 t0: the docs items "never landed … still open, not covered by N5" |

**Live counts for the README pass (own re-derive, `git ls-files`, this read — agrees with P4's parallel re-census):**
total **1715** · root **42** · src **210** · src/lib **200** (161 direct = 82 modules + 79 tests; 39 subdir = 32 modules
+ 6 tests + 1 tracked 0-B stray `auth/.hermes-tmp.pw0XNe`) · scripts 45 · fixes 419 · wave_plans 105.

## Ledger (append-only — evidence per landed item)

_(items land below in order; command + observed bytes per row)_
