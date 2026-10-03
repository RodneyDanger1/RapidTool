# fixes/338_5_product.md — W52 lane 338-5 (Product): the emitted side of "product-complete" + the agent-facing deliverable

**Lane owner:** 338-5 (Product). **Opened:** 2026-10-02 at HEAD `e7da20e`, tree clean (only `wave_plans/W52/` untracked).
**Owned files (STRICT):** `src/lib/scaffold.ts`, `src/lib/packet.ts`, `src/lib/handoff.ts` + their tests
(`scaffold.test.ts`, `packet.test.ts`, `handoff.test.ts`). Everything else is STOP-and-REPORT.
**Runtime:** pinned Node 22 — `& "$env:LOCALAPPDATA\hermes\node\node.exe" --version` → `v22.23.2`
(host default `node` is v24.15.0). Every `node --test` run below passes `--test-reporter=tap`.
**Scratch (outside repo):** `%TEMP%\rt338_5\` (emit-out trees, probes, packet dumps). Nothing emitted into the repo.

## Step 0 — claimed / on disk / still open

Per `wave_plans/W52/README.md` Step 0 and `fixes/337_0_parent.md` §5, read this session: the W52 README,
`fixes/337_0_parent.md` (esp. §5), my prior product/scaffold/packet logs (`fixes/311_sd_product.md`,
`fixes/327_l5_verify_packet.md`, `fixes/303_c2_packet.md`, `fixes/304_d2_packet.md`, `fixes/305_e2_packet.md`),
and the `AW45-*`/`AW46-*`/`AW47-*` appendices in `research/multiagent/thoroughanalysis.md` (lines 1460-1520).

**Claimed (prior lanes / parent):**
- Gap 2's emitted side: the webapp tree declares `@tailwindcss/vite` + `tailwindcss` but never wires them —
  flagged by `fixes/168_c.md:18` ("Declared-but-unused drift: ... `@tailwindcss/vite` + `tailwindcss` ...
  yet `emitViteConfig` never loads them"), `fixes/162_master_execution_plan.md:1119-1121` (169C-2), and
  `fixes/169_c.md` §C-2. The W52 README (line 108) re-flags it as THIS lane's job.
- Gap 2's engine side (tree-run never runs declared `typecheck`/`build` ⇒ `declaredScriptsVerified:false`)
  belongs to **338-2** (`compile-check.server.ts`/`node-runner.server.ts`/`exec.ts`).
- The emitted docs truth fix (DEPLOY `npm test` on a no-`test`-script tree / "no todo stubs" on a
  NOT IMPLEMENTED tree) was already landed by W50/336-3 — `fixes/337_0_parent.md` §3 and
  `src/lib/scaffold.ts:2972-2986` (`deployNotes` census) pin it. Do not re-fix.
- The Agent Packet carries the current edge + DoD + oracle + contracts + report schema (W47 L5, `packet.ts`).

**On disk (read this session, HEAD `e7da20e`):**
- `src/lib/scaffold.ts:611-613` (`PKG_DEV_DEPS.webapp`) declares `@tailwindcss/vite` + `tailwindcss`;
  `emitViteConfig` (`:2422-2450`) webapp branch registers ONLY `react()` — no tailwind plugin, no CSS entry.
  No `.css` file is emitted anywhere (grep: zero `.css`/`@import` in the emitter).
- `PKG_DEV_DEPS["cli-tool"]`/`["service"]` declare `tsx` — no emitted script or import uses it.
- `emitMainEntry` (`:2459+`) webapp branches import `react-dom/client` + `src/ui`, never a stylesheet.
- `readmeBody` (`:2812-2816`) tables `src/main` (a path that does not exist — the real path is
  `src/main.tsx` for webapp / `src/main.ts` for game) and says `vite.config.ts` is "emitted for webapp"
  even on a GAME tree; cli-tool/library/service entry files (`src/main.ts`, cli-tool `bin/*.mjs`) are
  absent from the table although the emitter writes them and `package.json` declares them.
- `packet.ts`: the export profiles (`:1270`, `:1296`, `:1321`, `:1357`, `:1382`, `:1408`) each instruct
  "run the oracle tests … from the packet", but neither the packet nor any profile names a runnable
  command or the oracle spec path; `## Required output schema` (`:1073-1079`) states the report shape only.

**Still open (this lane's work, `file:line`):**
1. Emitted webapp: `@tailwindcss/vite` + `tailwindcss` declared but unwired — `scaffold.ts:612-613` vs
   `scaffold.ts:2444-2449` (vite config), no emitted CSS (`scaffold.ts:3578-3586` boot block).
2. Emitted cli-tool/service: `tsx` declared but unused — `scaffold.ts:617`, `:620`.
3. Emitted README file table false/incomplete — `scaffold.ts:2812-2816` (`src/main`, "emitted for webapp"
   on game; no cli/library/service entry rows).
4. Agent packet/handoff name no runnable acceptance command — `packet.ts:1073-1079`, `handoff.ts:178-198`.

---

## 1. The emitted-scaffold audit (declared vs wired) — real bytes

Method: emitted all five kinds to scratch (`%TEMP%\rt338_5\emit-out`, probe `probe_emit.mts`), then a static
audit (`probe_audit.mts`) parsed each `package.json` and scanned every emitted `.ts/.tsx` for bare import
specifiers, cross-checked scripts ↔ declared bins, and ran the repo's own `tsc`/`vite` over each tree via a
`node_modules` junction (offline, the repo's installed toolchain). "Wired" = consumed by a script, a config
`types`/import, or a stylesheet `@import`.

| Kind | Declared dep | Wired by | Verdict (before) |
|---|---|---|---|
| webapp | `@tailwindcss/vite` | — (vite.config registered only `react()`) | **ORPHAN → fixed** |
| webapp | `tailwindcss` | — (no `.css` import anywhere) | **ORPHAN → fixed** |
| cli-tool | `tsx` | — (scripts run `node --experimental-strip-types`) | **ORPHAN → struck** |
| service | `tsx` | — (same) | **ORPHAN → struck** |
| webapp | `vite`, `@vitejs/plugin-react`, `typescript`, `@types/node`, `@types/react(-dom)` | `dev`/`build`/`typecheck` scripts, `vite.config.ts` import, tsconfig `types`/`jsx` | OK |
| game | `vite`, `typescript`, `@types/node` | `dev`/`build`/`typecheck` scripts, tsconfig `types` | OK |
| cli-tool/library/service | `typescript`, `@types/node` | `typecheck` script, tsconfig `types` | OK |

Configs referencing a tool they do not use: none remain (`vite.config.ts` imports only declared plugins; every
tsconfig `types` entry is declared). Boot/entry paths: all five load/run (see §3 evidence). The audit's naive
"never imported" line flags `tailwindcss` because Tailwind v4 is consumed in **CSS** (`@import "tailwindcss"`),
not by a TS import — verified by the real build emitting a 4.6 kB Tailwind-compiled CSS asset.

### Doc-truth defects found and fixed (README/DEPLOY of the EMITTED tree)

| # | Emitted doc claim (before) | Byte reason | Fix |
|---|---|---|---|
| D1 | webapp/game README tabled `src/main` | no such file is written (`src/main.tsx` / `src/main.ts` are) | table names the real path per kind |
| D2 | game README: `vite.config.ts` "emitted for webapp" | false on a game tree (which has its own plain config) | kind-accurate origin line |
| D3 | cli-tool/library/service README omitted `src/main.ts` (and cli-tool `bin/*.mjs`) | the emitter writes them and `package.json` DECLARES them (`main`/`bin`/`start`) | rows added |
| D4 | webapp README omitted the new `src/styles.css` | README claims to table every emitted file | row added (webapp only) |

DEPLOY.md was re-read and found already true after W50/336-3 (the `npm test` / "no todo stubs" fixes hold —
`scaffold.test.ts` `W50 / 336-3` suite). No new DEPLOY defect.

---

## 2. Fixes (each RED-first, both results below)

### L5-01 — webapp: `@tailwindcss/vite` + `tailwindcss` declared but unwired (the flagged gap) — FIXED
- **Files:** `scaffold.ts` — new `emitStylesCss()` (`:2484`), `emitViteConfig` webapp branch (`:2455-2465`),
  `emitMainEntry` webapp import (`:2540`), assembly push (`:3683`), README table (`:2898`).
- **Fix:** emits `src/styles.css` (`@import "tailwindcss";` + a `@layer base` for the unclassed shell
  markup), `main.tsx` imports it, `vite.config.ts` registers `tailwindcss()`. Deterministic, no project text
  (injection-safe). This is the `fixes/169_c.md` §C-1/C-2 design, landed minimally.
- **RED (before):** `scaffold.test.ts` → `not ok 17 - W52 / 338-5 — emitted webapp wires its declared Tailwind devDeps` (`# fail 8`).
- **GREEN (after, both runtimes):** `scaffold.test.ts` **61/61 / 0 fail** (pinned v22.23.2 and host v24.15.0).
- **Real emitted-tree proof (offline):** `vite build` over the emitted webapp → `dist/assets/index-*.css 4.60 kB` — the Tailwind plugin compiled the entry. `tsc --noEmit` exit 0.

### L5-02 — cli-tool/service: `tsx` declared but unused (declare-or-strike) — FIXED
- **File:** `scaffold.ts:617,620` (`PKG_DEV_DEPS`). **Fix:** removed `tsx` from cli-tool + service (the emitted
  entries run `node --experimental-strip-types`; nothing imported or scripted `tsx`).
- **RED:** `scaffold.test.ts` "gives a tool kind … (no unused dev tool)" (`not ok 2`, part of the pre-fix `# fail 8`).
- **GREEN:** all kinds' `package.json` now declare only consumed deps (audit re-run: `tsx` gone).

### L5-03 — game: the DECLARED `npm run typecheck` failed on a clean tree (TS6142) — FIXED
- **Found by running the repo's own `tsc` over the emitted game tree**: `src/main.ts(7,26): error TS6142:
  Module './ui/console' was resolved to '…/src/ui/console.tsx', but '--jsx' is not set.` The game shell is
  plain TS but the spec-graph node path is `src/ui/console.tsx` (`algorithms.ts:775`), and the game tsconfig
  set no `jsx`.
- **File:** `scaffold.ts` `tsconfigJson` — game now sets `jsx: "preserve"` (admits the `.tsx` extension with
  no transform and no React runtime; the game kind declares no react). webapp keeps `react-jsx`.
- **RED:** real `tsc` exit 2 on the emitted game tree; new test `not ok 19` in `scaffold.test.ts`.
- **GREEN:** emitted game `tsc --noEmit` exit 0; `scaffold.test.ts` 61/61.

### L5-04 — Agent Packet: no runnable acceptance command — FIXED
- **Gap:** every export profile instructs "run the oracle tests from the packet", but neither the packet nor
  any profile named a command or the oracle spec path — a fresh agent could not self-check (the exact
  "missing input: a command it must run / the exact acceptance signal").
- **Fix:** `packet.ts` names the spec path (spec-graph tests node, default `tests/oracle.spec.ts`) and the
  tree's declared `npm test`, and tells the agent to record commands in `tests_run`; the line rides the
  invariant `## Required output schema` tail so truncation cannot strip it. When no oracle rows exist it
  states the DoD gate is the exit signal instead. `handoff.ts` mirrors it in `## Expected output`.
- **RED:** with HEAD's `packet.ts` restored (clean `git checkout`, no BOM), `packet.test.ts` → `# fail 2`
  (only tests 72/73). `handoff.test.ts` → `# fail 2` before its fix.
- **GREEN (both runtimes):** `packet.test.ts` **73/73**, `handoff.test.ts` **18/18**, 0 fail.

---

## 3. "Is the packet sufficient?" — a concrete fresh-agent walkthrough of the current edge

Emitted a real packet at the P6 edge (`seedProject` + P0–P6 run; `%TEMP%\rt338_5\packet-P6-edge.md`,
13,216 B) and read it as a cold agent. Given ONLY that packet, the agent can answer:

| Question | Present in the packet? |
|---|---|
| What edge am I on? | Yes — `## Current edge` → `P6 — Code Generation, Testing & Deployment`, `current_phase.id: 6`. |
| What is the mission? | Yes — `## Mission` (the brief) + `## Intent lattice (A1)`. |
| Which files do I own/produce? | Yes — `## Spec graph order (A5)` lists each path + owner + purpose (`src/jobs/dispatch.ts` …); export profiles add a `## File scope`. |
| What contracts must I honour? | Yes — `## Contracts (A6)` + `## Oracle (A7)` rows (`given ⇒ expect`). |
| What does DONE mean? | Yes — `## Exit criteria (DoD)` with a machine-checked `Gate P6: FAIL (n unmet)` + `[x]/[ ]` checklist. |
| How do I report? | Yes — `report_schema` (system JSON) + `## Required output schema`. |
| **What command do I run to self-check?** | **Was MISSING — now fixed (L5-04):** `npm test` over the named `tests/oracle.spec.ts`, recorded in `tests_run`. |
| When is my report accepted? | Yes — report_schema states `phase` must equal `current_phase.id`, caps (12 artifacts, ≤50000 chars). |

**Verdict:** the packet was sufficient except for the *runnable* acceptance command — every section named the
edge's *rules* but no way to *execute* them. With L5-04, a fresh agent has the edge, its inputs, its output
format, its acceptance signal, and the command that reproduces it. **Named residual (not this lane's file):**
two P6 DoD criteria are set by the engine's own verify, not by the agent
(`p6-verified` needs `lastTest.label:"tested"`; the agent cannot mint it) — that is `dod.ts` (338-3) territory;
the packet does render them honestly as unmet.

---

## 4. Tests added (all RED-first; both runtimes)

| File | Baseline → now | Added |
|---|---|---|
| `scaffold.test.ts` | 53 → **61** | +8 (Tailwind wiring ×3, README entry paths ×4, game tsconfig ×1); 2 existing assertions updated to the fixed behaviour (tsx strike; intake-only 11-file set) |
| `packet.test.ts` | 71 → **73** | +2 (acceptance command present/absent) |
| `handoff.test.ts` | 16 → **18** | +2 (acceptance command present/absent) |

Both pinned v22.23.2 and host v24.15.0: scaffold 61/61, packet 73/73, handoff 18/18, **0 fail**.
Consumer suites re-run green: `emitted-honesty` 5/5, `io` 61/61, `sweep73-fuzz` 52/52.

---

## 5. Mock/fake census

- **Owned source (6 files):** zero `@ts-ignore` / `@ts-expect-error` / `eslint-disable` / empty `catch {}`;
  zero `as any` added by this lane (the two existing `as any` in `scaffold.test.ts:197,200` are pre-existing
  game-manifest casts, untouched). No hardcoded-return fakes; every new assertion is falsifiable (proven RED).
- **Emitted trees (all 5 kinds):** zero `as any` / `@ts-ignore` / `@ts-expect-error`; the only
  `TODO` markers are the product contract `TODO(E-15)` (15–17 per tree, unchanged semantics).

---

## 6. STOP-and-REPORT (not this lane's files)

1. **`src/lib/verify.server.test.ts` typecheck error** — `tsc` fails on
   `verify.server.test.ts(1170,40) TS2345` (338-6's file, modified in the tree). The baseline was
   typecheck 0; my three source files produce zero type errors. Owner: 338-6.
2. **10 `src/lib` leg failures** are sibling in-flight, NOT this lane:
   `compile-check.server.test.ts` ×5 (338-2) — **proven independent**: re-running that suite with
   `scaffold.ts` reverted to HEAD reproduces the identical 5 failures (`# pass 75 / # fail 5`);
   `doctor.test.ts:596` "factory claim wired to REAL signals" (338-3); `headless.test.ts:1962` E-25 CLI
   contract (338-3); `llm/providers/mock.test.ts:399` "1 expansion + 3 chunk synthesis" → `5 !== 4`
   (338-1's synthesis determinism; an LLM-call-count assertion, unrelated to scaffold bytes).
3. **`algorithms.ts:775`** hardcodes the spec-graph ui node at `src/ui/console.tsx` for EVERY kind, while the
   game/cli/library/service shells carry no JSX. I fixed the consequence inside my file (`jsx: "preserve"` on
   the game tsconfig); the cleaner fix — emit a non-JSX kind's shell at `.ts` — needs `algorithms.ts` (338-1).
4. **Library `main`/`exports` point at raw `./src/main.ts`** with `engines.node: ">=22"`. It loads under Node
   ≥ 22.18 (unflagged type-stripping) and all bundlers, so it is runnable on the pinned runtime; but on
   22.0–22.17 a consumer `import` would need the flag. Named residual, not fixed (a JS entry/build for the
   library kind is a design change beyond this lane's gap).

## 7. What I did NOT do, and why

- No keyed calls (gap 1/2 emitted-side needs no live model; measured usage: **0**; 0 of the 2 allowed).
- No full `gate.sh` (siblings mid-edit; the parent runs the boundary gate). Targeted suites only.
- Did not touch `dod.ts`, `compile-check.server.ts`, `codegen.server.ts`, `headless.ts`, `algorithms.ts`,
  `verify*`, `doctor.ts`, `fixtures*`, `policy.ts`, `maker-score.ts` — all owned by siblings.
- Did not wire `tsx` (chose declare-or-strike, matching the entry scripts' `node --experimental-strip-types`).
- Did not add the full `design.ts` token engine to the emitted stylesheet (the `fixes/169` §C-3 breadth);
  landed the minimal honest wiring that removes the fake — no declared dep is inert, and the UI renders
  intentionally.

