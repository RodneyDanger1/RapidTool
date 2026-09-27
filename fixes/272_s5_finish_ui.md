# fixes/272_s5_finish_ui.md — W30 · LANE S5 — THE FINISHER + UI SURFACER

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD:** `0f85c32` + W29/W29b/W30 uncommitted edits.
**Box:** the W29 leftovers (Lane B/P/H/D rows, verified fresh before each edit) + `src/components/console.tsx`
(own hunks only — U done, S4 may be appending), `src/routes/**`, `src/styles.css` (additive UI surfacing of every W30 shell).
**Rules:** targeted checks only · NO full gates · NO keyed calls · log-and-continue (`[EXT-FAIL]`) · append-only
· never remove a control · honest labels only (disabled + coded reason in `title` is honest; enabled no-op is not).

## A) Owed baseline verified at lane start (code = truth, logs were skeletons)

| Lane | Row | Verified state at start (grep/read) | S5 action |
|---|---|---|---|
| B | R12-f01 prior cap + elision + byte budget (codegen.server.ts) | OPEN (:1255-1300 priorFiles unbounded) | LAND |
| B | R12-f05 stable coalescer message + seconds payload (console.tsx:1198) | OPEN (`stale Ns` in messageHash) | LAND |
| B | R12-f07 diagnose real counts (CLI :3282 `projectFile: 0`) | OPEN (hardcoded 0) | LAND |
| B | R12-f08 rebase caps + salvageTrim (store.ts:284/:719) | OPEN | LAND |
| B | R12-f09 persist debounce + flush seam (store.ts) | OPEN | LAND |
| B | R12-f11 import cap / tooLargeToPersist (io.ts:32/:429) | OPEN (10MB cap only) | LAND |
| B | R11-f06 browser-guard win32 fail-closed | OPEN (no win32 branch) | LAND |
| B | R11-f07 realpath containment — ONE shared helper | OPEN (no realpath hits) | LAND |
| B | R11-f03 tree-run honest label (CLI usage + README-cli) | OPEN | LAND |
| B | R11-f08 --force quarantine seam | OPEN; headless.ts mid-edit (E1 W-03 + S4 owns it) → CLI/scaffold side + `for R11/S4` | SEE LOG |
| P | R4-f01 xAI 402 → NO_BALANCE mirror | verify | SEE LOG |
| P | R4-f02 async-tap twin test | verify | SEE LOG |
| P | R4-f03/A2-f07/R12-f02 ledger | S3's per W30 brief (verify grep before touching) | don't double-work |
| P | C1-f08 facade `thinking` | verify | SEE LOG |
| P | C1-f09/R4-f05 model-id validation | verify | SEE LOG |
| P | R11-f09 redaction widening | verify | SEE LOG |
| P | R12-f06 readRtTail true tail read | verify | SEE LOG |
| H | R12-f10 run-eval crash-clobber | verify | SEE LOG |
| H | remaining rows (A2-f01/03/04/05/06/08/09/10/11, R11-f04, R11-f13, gate.sh A2-f02) | verify | best-value fits |
| D | A3-f05 graders + A3-f06 four kind fixtures + A2-f08/f09 README-cli sections | OPEN | best-value fits, TODO-mark rest |

## B) UI surfacing (additive, `console.tsx` + `styles.css`) — planned surfaces

1. wild plan (S1 `wild.plan`) — read-only pane/section; honest 'no plan yet, TODO(W-XX)' when absent.
2. checkpoint/resume (S1) — read-only line when a checkpoint exists; honest absence label.
3. unattended-run refusal (S1) — coded reason where runs launch.
4. stream + cassette flags (S3) — labels/disabled states naming 'not yet wired'.
5. seat hook (S4) — reflect read-only or wire if landed.
6. honest refusal labels — no isolator (S4 R13-f04); streaming-not-wired.

## Log (append-only)

- [t0] Lane start. Mandatory reads done: `wave_plans/W30/shell-sprint.md`, `finalsprint.md` (MASTER TABLE + S1-S4 pending),
  `wave_plans/W29/coders.md`, all `fixes/271_lane*` logs, §R11/§R12 specs (`thoroughanalysis.md:1432-1458`).
- [t0] KEY FINDING: the W29 lane logs are early skeletons (rows listed TODO) but the CODE contains landings from
  W29/W29b (R6-f12 PaneBoundary IS in console.tsx; R9-f01 landed in tests; ledger may be S3's). Every row below is
  re-verified in code before editing; per-row verdicts land here as they complete.
