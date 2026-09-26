# W24 · SPRING-CLEAN WAVE — 6 agents: 4 bug-hunt/organize + 2 UI-wire/organize

**All readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`).
Owner instruction: *fix bugs everywhere, clean up/organize the codebase + folders + files, fix calls between
things and wiring; then wire the UI to unwired things, organize the UI logically, fix errors in it.*

```text
RULES (all lanes)
- HEAD = b721f9c (W18–W23 committed; typecheck+lint green there). Your work rides on top; the parent commits.
- NEVER run the full gate (`npm run typecheck|test|build|lint` at repo scope) while siblings edit — the repo rule.
  You MAY run TARGETED FOREGROUND commands for evidence: `node --experimental-strip-types --test <one-file>`,
  `npx eslint <your files>`, a scoped tsc via a scratch tsconfig. No node under the BACKGROUND harness.
- NO keyed DeepSeek calls (account unfunded — every call 402s). No `deepseek-v4-pro` ever.
- Real fixes only: no stubs/mocks/TODO/eslint-disable; a fix without a re-runnable check is a finding, not a fix.
- `fixes/**` and `research/**` logs are APPEND-ONLY: never rewrite an existing log; add a new one if needed.
- AGENTS.md is PROTECTED — do not edit it; propose changes in your log.
- Don't rename/move product source files (importers would collide across lanes) — report proposals instead.
  Stray/untracked/scratch files MAY be tidied (see B3).
- WRITE EARLY: `fixes/263_lane<N>_<slug>.md` within ~8 calls: what you found (file:line), what you fixed
  (before→after), what you deliberately did NOT touch + why.
```

## B1 — bug hunt: `src/lib/` core (engine, store, phases, dod, gates, packet, io)
**Box:** those files + their `.test.ts`. NOT console/routes (U1/U2), NOT `src/lib/llm/**` or `scripts/**` (B2).
Hunt REAL defects: dead branches, wrong guards, unreachable code, mismatched types/ids, silent catches,
stale wiring between modules (e.g. a function whose caller passes the wrong shape), off-by-one bounds,
duplicated logic that has drifted. Fix each with the smallest honest patch + a targeted foreground run as
evidence (one file at a time). If a suspicion needs a keyed run to settle — do NOT fix, log it.
**Done-when:** each finding has file:line + evidence + fix (or an explicit "not a bug, because…").

## B2 — bug hunt: periphery (`src/lib/llm/**`, `scripts/**`, telemetry, CLI)
**Box:** those + their tests. Same hunt/fix/evidence bar. Extra targets: the new `eval` verb + `scorecard.ts`
(coherence, exit taxonomy), `run-eval.mjs` (the W23-L1 wires — verify the fundedness block + probe compile
and read coherently), `deepseek.ts`'s call-tap (a throwing tap must never break a call), zero-byte guard.

## B3 — organization: repo structure, stray files, wiring between things
**Box:** repo root, `.gitignore`, untracked/stray files, `wave_plans/**`, `C:/Users/mnril/*_scratch` references.
1. Inventory stray/untracked files in the repo (`git status --porcelain`); anything that is scratch/output
   (not source, not a log) → propose (or, if clearly junk with zero references, delete) and record each action.
2. Verify `.gitignore` covers the real outputs (`.rapidtool/logs`, `research/eval-out/*` run artifacts,
   `node_modules`, `.env`). Fix gaps — appending only.
3. **Wiring audit**: walk 10–15 key cross-module calls (console → store → engine; CLI → lib; run-eval → lib)
   and confirm the imported names/shapes actually exist and match (a static grep-level audit; report any drift
   as a finding for B1/B2/U1/U2 with the exact file:line — do NOT edit their boxes yourself).
4. Index `wave_plans/` + `fixes/` newest-first in a NEW `fixes/263_index.md` (links only, no rewrites).

## B4 — organization: docs, plans, logs, cross-references
**Box:** `research/**` (new files only), `fixes/**` (new/append only), `README.md`, `scripts/README-cli.md`,
`AGENT_GUIDE.md` (read-only unless a factual error), `docs`-ish root files.
1. Fix STALE FACTS where proofs exist: the CLI verb count (35→36 after the `eval` verb — re-derive with
   `grep -c 'case "' scripts/rapidtool-cli.mjs` and update the claims in `README-cli.md`/`README.md`/USAGE
   consistently), the `eval` verb's missing README-cli row (add it, mirroring the table's shape).
2. Broken cross-references: grep for `fixes/NN_` + `research/multiagent/NN_` references whose targets don't
   exist; fix the reference or mark it as historical — never delete the sentence's meaning.
3. Add a `research/multiagent/263_state_of_play.md`: the ONE-PAGE current state (what's done, what's left,
   the run arc 5/9→6/9→3/9@2.6s-unfunded, the fundedness wire) — sourced ONLY from committed logs, every
   number with its source file.

## U1 — UI: wire + organize `src/components/console.tsx`
**Box:** `src/components/console.tsx` ONLY (+ its tests if any). NOT routes/** or styles.css (U2).
1. **The parent just wired T5.2-A** (`FixturesPanel`, the `fixtures` tab, import from `@/lib/fixtures.review`)
   — verify it is coherent end-to-end (types, the panel's states, the tab entry/tier placement) and fix any
   error you find in it; the panel is yours to polish now.
2. **Unwired-UI hunt**: find console state/actions/panes that render but do nothing, or actions with no UI
   entry; wire the cheap, honest ones (e.g. surface the T5.3 scorecard if the eval output is reachable;
   link tabs logically). Never remove a control; additive/re-worded/re-ranked only.
3. **Logical order**: the tab tiers (primary vs advanced) and their purposes — re-rank/rename LABELS only if
   the current logic is genuinely confusing; every change listed before→after.
4. Targeted evidence: `npx eslint src/components/console.tsx` + any console test that exists.

## U2 — UI: wire + organize routes / styles / other components + fix UI errors
**Box:** `src/routes/**`, `src/styles.css` (or the tailwind entry), `src/components/**` EXCEPT console.tsx.
1. Same unwired-UI hunt in the route layer + secondary components; fix real UI errors (bad conditionals,
   wrong aria wiring, dead handlers, layout logic that contradicts its label).
2. Organize: consistent import ordering/aliases per the codebase's dominant style; remove dead styles only
   when provably unreferenced (grep the class name repo-wide first — report each removal).
3. Targeted evidence: `npx eslint <your files>`; any route/component tests if present.
