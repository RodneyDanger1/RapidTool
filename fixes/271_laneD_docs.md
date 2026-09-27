# 271 · LANE D — DOCS + CORPUS + GRADERS (W29 coder wave) — lane log

**Slice (my box):** `README.md`, `AGENT_GUIDE.md`, `scripts/README-cli.md`, `research/eval-corpus/**`,
`research/multiagent/263_state_of_play.md`. **NOT mine:** `console.tsx` (LANE U wins it — Guide text
goes in the "for U" section below), `run-eval.mjs` (LANE B), `packet.ts` (LANE S), `scaffold.ts` (E1/B).

**HEAD at start:** `0f85c32`. **Status:** IN PROGRESS — skeleton first, kept current as fixes land.
**Rules:** additive/re-worded/re-ranked only; declare-or-strike; targeted checks only (no full gates,
no keyed calls); log-and-continue (`[EXT-FAIL]` + keep going).

## Rows assigned (from `wave_plans/W29/coders.md` §LANE D)

1. **R6-f05** — the census → measured `{stubs:0, reexports:4, real:1}` on the `--trial-1` dir (README:108-115)
   + the reconciled AGENT_GUIDE text (:4-7, :52-54) + the in-app Guide text (console.tsx:1421 — for U).
   Spec + full replacement text: `fixes/267_lane6_audit_ui.md` summary (R6-f05) = §R6-f05 fold.
2. **A3-f05 / R11-f12** — the graders: per-kind real assertions (grader v2) + the packet `verification`
   label naming what was asserted. Spec: §R7-f03 + §R11-f12.
3. **A3-f06 / R3-f06** — the four missing-kind fixtures: game (arcade-breakout), cli-tool (invoice-csv-cli),
   library (date-rrule-library), service (order-webhook-service) — briefs + expected shapes per §R7-f04/§R3-f06.
4. **A3-f08** — the (emitted) README "What ships" table overclaim — R7-f05's seam is `scaffold.ts` (NOT my
   box — record under "for E1/B"); my doc half = keep the repo README honest about it.
5. **R6-f06** — "no live feedback channel" (AGENT_GUIDE:69) → name `ingest`.
6. **R6-f09** — the `.env` split per surface (README:45 vs README-cli:231-233).
7. **R9-f07** — README test counts (README:12-14 vs :139-140).
8. **A2-f08/f09 doc halves** — README-cli.md: the `emit --verify-kind` staleness rewrite (A2-f08/R7-f06)
   + the missing `## Fixtures`/`## Eval` sections + `--effect` (A2-f09/R7-f07).

## Evidence log (read times, file:line)

- `wave_plans/W29/coders.md` read in full (call 1). HEAD `0f85c32`; only untracked change = `wave_plans/W29/`.
- `thoroughanalysis.md` §W27-WORKLIST (W-12/W-13/W-14/W-15), §R3, §R6, §R7, §A2, §A3, §R9, §R11 read (calls 2-6).
- R6-f05 full replacement text recovered from `subagent-summary-5-20260926_163612_315610.txt` (call 6) —
  the §R6-f05 "supplied in full in the summary" pointer resolved.
- **(fill as fixes land — every claim in this log must be traceable here or to a command output)**

## Fixes landed

_(fill as fixes land)_

## for U (LANE U owns console.tsx — do NOT edit here)

**R6-f05 in-app Guide text** (`console.tsx:1421` currently reproduces the old AGENT_GUIDE:4-7/:52-54 claim).
Replacement text (verbatim — same string must land in AGENT_GUIDE.md so both read alike):

> RapidTool is a governed delivery harness. It compiles a brief into a paste-ready Agent Packet and a
> 13-phase audit trail, and — when a DeepSeek key is configured — it also synthesizes and compile-checks
> a real module set for P6 (measured census on the reference corpus: `{stubs:0, reexports:4, real:1}`).
> Breadth beyond that corpus is re-export bridges and `TODO(E-15)` stubs, so treat the P6 module as a
> verified starting point, not a finished product; the build beyond it is yours.

_(more for-U items appended as found)_

## for S / for B / for E1 (other lanes' boxes)

_(fill as found)_

## [EXT-FAIL] / blockers

_(fill as found)_
