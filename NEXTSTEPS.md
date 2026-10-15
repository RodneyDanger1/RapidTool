# NEXTSTEPS — RapidTool

> ### ⏸ PAUSED 2026-10-15 — wave W359 was stopped mid-flight
> All agents were halted at the owner's request and everything on disk was committed and pushed.
> `npx tsc --noEmit` exits **0** at the pause, so the tree is syntactically sound. **Read §5b before
> resuming** — it names what landed, what is half-done and what is left, per lane and per file, and the
> per-file companion is **`wave_plans/W359/HANDOFF.md`**. The 19 files in flight each carry a one-line
> `W359 PAUSED` marker comment.

**Read this first.** It is the handoff: what RapidTool is, what changed recently, exactly how to run and
verify it, what is still broken, and the remaining waves in order. Everything here was measured on
2026-10-15; where a claim came from a document rather than a command, it says so.

---

## 1. What RapidTool is

RapidTool is a **governed 13-phase software-delivery harness** (P0 → P12). You give it a brief; it runs the
phases behind evidence-hashed definition-of-done gates, records an append-only decision ledger, and emits an
**Agent Packet** plus a real product tree. It has two thin surfaces over one engine: a browser console
(TanStack Start + React 19) and a headless CLI.

- It is **not** "type a sentence, get a finished app". It is the governed factory: research → architecture →
  contracts → synthesis → verification → emission → delivery, with every claim traceable to bytes.
- Its doctrine is **no fabrication**: a value that was not measured is `null` or `unavailable` with a coded
  reason (`RT_E_*`), never invented. `estimatedCostUsd` is always `null` because spend is never fabricated.
- **Stack:** TypeScript, TanStack Start/Router, React 19, zustand, zod, Tailwind v4, Radix, Kysely +
  PGLite (Postgres fallback so it runs with no database), Nitro (vercel preset). Node ≥ 22
  (this host runs v24.15.0).
- **Models:** DeepSeek — `deepseek-v4-flash` (default, thinking off for speed) and `deepseek-v4-pro`
  (thinking on). The live-verified API spec is `research/deepseek-api.md`.

---

## 2. Repo description (paste-ready)

> **RapidTool** — a governed 13-phase autonomous software-delivery harness in TypeScript. A brief goes in;
> P0–P12 run behind evidence-hashed DoD gates with an append-only decision ledger, and out comes a real
> product tree plus a paste-ready Agent Packet. One pure engine, two surfaces: a React 19 console and a
> 39-verb headless CLI. Built on a keyless-first honesty contract — every number is measured or reported
> `unavailable` with a coded `RT_E_*` reason, and nothing is fabricated. Includes a 34-guard keyless
> prevention harness and a 50-metric quality ratchet that refuses to let a regression read as progress.

---

## 3. How to run it

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"     # the path contains a space - always quote it
npm install                                    # no key needed for the keyless path

npm run dev            # console at http://127.0.0.1:8080   (loopback only)
npm run build          # production build + db:migrate (writes .vercel/output)
npm run launch         # quickstart wrapper (also launch:stop)

# day-to-day gates (keep all at 0/green)
npm run typecheck      # tsc --noEmit + the scripts ratchet leg
npm run lint           # eslint .
npm test               # scripts leg, then src/lib + src/components leg

# the full gate (typecheck -> lint -> gaps -> prevention -> moduleCoverage -> tests -> build -> ratchet)
& 'C:\Program Files\Git\bin\bash.exe' scripts/gate.sh
& 'C:\Program Files\Git\bin\bash.exe' scripts/gate.sh --double    # adds a flake check
```

**The key.** Put `DEEPSEEK_API_KEY=sk-...` in the **repo-root `.env`** (never committed, never
`VITE_`-prefixed). Precedence: `<cwd>/.env` wins over the process environment; a *present-but-blank* value
is an intentional keyless run; a differing non-blank ambient value loses behind `RT_E_LLM_KEY_SHADOWED`.
Run the CLI **from the repo root** so it finds `.env`. **A keyless run is honest, not broken**: it takes a
deterministic floor and reports `RT_E_LLM_NOT_CONFIGURED` rather than faking model text.

**CLI** — every verb prints exactly one JSON object on stdout:

```powershell
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor      # capability pre-flight
node --experimental-strip-types scripts/rapidtool-cli.mjs create --name "My Build" --brief "..." --out build.json
node --experimental-strip-types scripts/rapidtool-cli.mjs gate --project build.json --autopilot
node --experimental-strip-types scripts/rapidtool-cli.mjs approve --project build.json --seat autopilot
node --experimental-strip-types scripts/rapidtool-cli.mjs emit --project build.json --out emitted/ --run
```

Exit codes: **0** success · **1** red gate / red tree · **2** parked at a human gate · **3** backend not
configured · **4** runtime failure · **5** tree green but its declared toolchain could not be resolved.

**The quality ratchet** (new — this is the "is it improving?" instrument):

```powershell
node scripts/quality-ratchet.mjs --all        # 50 metrics, floors pinned; refuses a regression
node scripts/quality-ratchet.mjs --selftest   # planted-regression teeth (should catch every floor)
```

Floors live in `scripts/quality-ratchet.floors.json` and **may only rise**. A metric that cannot be
measured reports `unavailable` with a coded reason; it never passes silently.

---

## 4. Recent changes (this campaign)

Four waves, ~23 subagent lanes, all evidence-logged. Zero keyed spend so far.

**W355 — the audit (9 read-only lanes + a 2-agent adversarial verification panel).** Found, among others:
an uncommitted reader change had **doubled the substantive-tree rate 6/13 → 13/13 with zero product
change** and silently disarmed prevention guard **C-06**; an oracle-emitter change made any partial emission
fail its own tests (so `emit --git` withheld); and **`underProduced:"refuse"` did not refuse** — a caller
asking for refusal still got files. The panel confirmed both P0 mechanisms and **refuted five lane
overclaims**. Ledger: `fixes/355_0_audit_wave.md`; register append `AW355-f01…f22` + corrections
`c01…c05` in `research/multiagent/thoroughanalysis.md`.

**W356 — green recovery + the ratchet.** The census was split into two **distinctly named** readings
(`jobScoped`, `wholeTree`) so no single number can be moved by editing a reader; C-06 fires again and a
**canary now fails loudly on a renamed key field or a re-pointed alias** — the exact defect that defeated
it; C-14 is unblocked; `refuse` refuses (zero files); an unwired acceptance row is a **surfaced, counted
skip** instead of a reachable `assert.fail`; and `scripts/quality-ratchet.*` was built with 37/37 planted
floors caught.

**W357 — the remaining reds.** `build` was red because one glob in `src/lib/db.ts` lacked a `?raw` query,
so the bundler parsed `migrations/auth/*.sql` **as JavaScript** — latent since `be12c59`, reachable only
once the auth import chain closed. Fixed. Lint went 947 → 5 problems (`eslint` had been crawling the
untracked generated corpus) with **no rule weakened**; module coverage went green; the console Preview
works again for a below-floor run; and the residual test failures were attributed for the first time
(the src leg had never run).

**W358 — closure.** `EXIT_BY_CODE` is now **derived** from the README's own exit-code column in both
directions (a code with no CLI arm is an explicit `null` class — no invented exits, no deleted rows);
`RT_E_RATCHET_METRIC_UNAVAILABLE` registered; and the emitted-UI decision was **merge, not replace** — the
spec-derived page set and the real-field binding now ride the same emission (`scaffold.test.ts` 139/139).
The census shape's two scopes became **required at the type level**, with an `@ts-expect-error` plant.

**Vendored into git:** the 325-file prevention fixture corpus and its guard floor. **14 of those trees
carried their own `.git`** (from `emit --git`), which would have committed as gitlinks and left a clone
without the fixtures the guards read — stripped non-destructively and guarded by a `.gitignore` rule that
was verified by planting the defect.

---

## 5. Verified current state (measured at the last boundary)

```
typecheck      ok        lint           ok (5 warnings)      assertionGaps  ok
prevention     ok        moduleCoverage ok                   build          ok
ratchet        ok        testsScripts   661 pass / 0 fail     testsLib       4229 pass / 1 fail
```

**10 of 11 stages green. Exactly one failing test remains in the whole repo** — and it is the
kind-fidelity pin, which is intentional: see §6.

---

## 5b. PAUSED — W359 mid-flight: what landed, what is half-done, what is left

**Per-file companion: `wave_plans/W359/HANDOFF.md`.** Nothing below is a boundary-verified fact — no
boundary ran after the pause, so a lane's own reported test numbers are **lane claims** until re-derived.

| lane | state | files it touched | what is left to do |
|---|---|---|---|
| `kind-gate` | **LANDED — the wave's P0** | `src/lib/scaffold.ts`, `scaffold.test.ts` | Re-derive at a boundary. The lane reports the three previously-broken kinds (`game`, `tool`, `service`, `library`) going from **exit 2 with 167 errors → exit 0**, `scaffold.test.ts` **144/144** and `codegen.server.test.ts` **331/331**. If true, it clears the only failing test in the repo. |
| `resolve-kind` | **LANDED + 6 disclosed residuals** | `src/lib/engine.ts`, `engine.test.ts`, `src/lib/types.ts`, `src/lib/dod.ts`, `dod.test.ts`, `scripts/run-eval.mjs`, `run-eval.test.mjs` | The residuals in `fixes/359_resolve_kind.md` §6: calibrate the keyword table from measurement (needs `kind-corpus`), a stale comment in `src/lib/sandbox.ts:509`, a "declared" vs "resolved" wording item at `scaffold.ts:8269`, and the `app` surface contract for briefs with no page noun. |
| `inject-kind` | **LANDED + residuals** | `src/lib/codegen.server.ts`, `codegen.server.test.ts`, `src/lib/prompt-engine.ts`, `prompt-engine.test.ts` | Unmeasured by nature: the prompt change's effect needs a **keyed** run; the cache-hit gain is a placement argument; model obedience to the per-kind REQUIRED rows is run-side. It also repaired an encoding incident it caused (documented in its log) — the lesson is in the HANDOFF. |
| `thread-kind` | **HALF-DONE, log still a skeleton** | `scripts/rapidtool-cli.mjs` (16:55), `src/lib/headless.ts` (16:59), `scripts/README-cli.md` (17:02) | **Four jobs, none documented:** (1) wire the inert CLI `--kind` on `create` (`rapidtool-cli.mjs:1632`); (2) `headless.ts:6602` must print the **resolved** kind; (3) `headless.ts:6427` must carry the kind into `promptExpand`; (4) **the dead gate seam** `headless.ts:5855 stampEmittedSurfaceForGate` — one hit repo-wide (its own definition), so the DoD gate reads the *synthesized* surface and can produce a **false refusal**. Highest-value item in the wave after the P0. **Diff the three files against `HEAD` first.** |
| `kind-corpus` | **HALF-DONE, log still a skeleton** | `scripts/quality-ratchet.mjs` (17:17), `.test.mjs` (17:10), `.floors.json` (17:11), **created** `testruns/kind-corpus/units.json` + a real emitted `arcade-breakout` tree | All four jobs: the per-unit honest/mis-stamp verdict table; a per-kind coverage matrix so `kindFit.tool`/`service` stop being `uncovered`; each pin **able to fire** with a planted `floor − 1`; and `realProductOnly` re-verified over `src/**` (the no-mock rule) with the 3-module stub debt. **The reader, its test and the floors all moved without a log — diff all three against `HEAD` before trusting any reading.** |
| `cartographer` | **NOT STARTED** | — | The whole lane: verify the five lanes adversarially, map the wave's regressions, and re-measure the **P6 wall** into a W360 lane plan. |

### Resume order (also in the HANDOFF §3)

1. `git diff HEAD` the six undocumented files (`scripts/rapidtool-cli.mjs`, `src/lib/headless.ts`,
   `scripts/README-cli.md`, `scripts/quality-ratchet.mjs`, `quality-ratchet.test.mjs`,
   `quality-ratchet.floors.json`) — the only way to learn what those two lanes actually did.
2. `npx tsc --noEmit` → expect 0.
3. `node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts src/lib/codegen.server.test.ts`
   → expect green (that is the P0's proof).
4. `node scripts/quality-ratchet.mjs --all` → expect `ok:true`, and note the `kindFit` readings.
5. `& 'C:\Program Files\Git\bin\bash.exe' scripts/gate.sh` → **if `kind-gate` is right, this is the first
   fully green boundary of the campaign.**
6. Finish `thread-kind` (the dead seam first), then `kind-corpus`, then dispatch `cartographer`.

---

## 6. What is still broken / not done (honest list)

| # | item | where | why it matters |
|---|---|---|---|
| 1 | **One failing test: the kind-fidelity pin** (`BEFORE (the measured defect)…` / `fixes/341-1 pre-seal self-typecheck gate`) | `src/lib/codegen.server.test.ts` | **3 of 5 kinds emit source their own emitted `tsconfig.json` cannot compile** — `app` exit 0, `game` exit 2 with **97** errors, `tool`/`service`/`library` exit 2 with **180** each. Cause: `scaffold.ts:5092` `briefedSiteFiles` has **no kind gate**, and `tsconfigJson:984` decides `jsx` from a hard-coded kind list. The complete fix is written in `fixes/358_close_kindjsx.md` §2.3; W359 lane 2 owns it. |
| 2 | **The kind is mis-resolved and replicated** | `engine.ts:219-241` (first-hit keyword table), plus copies in `dod.ts:868-926`, `scaffold.ts:649`, `run-eval.mjs:2082` | The resolver **mis-resolves 3 of 10 corpus briefs**, including the only game brief (`arcade-breakout` → `app` via the word "screen"). Four instances of one decision means no single truth. |
| 3 | **No synthesis prompt contains the kind** | `codegen.server.ts`, `prompt-engine.ts` | The model re-infers the requested kind from prose — the root of "it built the wrong kind of thing". |
| 4 | **The kind reaches consumers through four holes** | `rapidtool-cli.mjs:1632` (inert `--kind`), `engine.ts:4074` (stamped only on the keyed path), `headless.ts:6602` (`(kind: undefined)`), `run-eval.mjs:2092/2122` (masks `service`/`library`) | An explicit `--kind` is ignored, and the eval driver hides the defect from measurement. |
| 5 | **The emitted-product gate seam is dead in production** | `headless.ts:5855 stampEmittedSurfaceForGate` → 1 hit = its own definition | The DoD gate reads the **synthesized** surface, not the emitted one, so a mismatch can produce a **false refusal**. |
| 6 | **3 stub modules in the shipped product trees** | the pinned corpus: `src/ui/console.tsx` and `src/main.ts` in two trees, marked `TODO(E-15)` | The owner's rule is **no mock/stub/demo code on a production path**; the bar is 0 and the ratchet reports the 3. The emitter writes a *throwing* stub at five sites (`scaffold.ts:1168, 1443, 1476, 5551, 5560`) — honest, but not a finished product. |
| 7 | **The P6 wall (the binding constraint)** | keyed synthesis quality | The repo's own campaigns scored `workingApp` 0/8 → 2/8 → 4/8, and the last 10-brief wave 1/10 `ok` with `productQuality 0/10`. Run-to-run variance is dominant. **No single run is the product.** |
| 8 | **No per-project agent bus** | absent (verified: zero matches for bus/inbox/pubsub across non-test `src/**`) | Agents cannot talk to each other per project. This is what **SH0RTBUS** is for — see §8. |
| 9 | **No seat schedules another seat; function calling unused** | `crew.server.ts:539` is a non-LLM router; `tools`/`tool_choice` appear nowhere in the provider bodies | Delegation is `currentPhase + 1`. DeepSeek function calling is live in the API and unused here. |
| 10 | **The learning loop is open at the join** | `iterateToSatisfaction` has **no production caller**; the defect→repair lesson functions are test-only (and their header claims otherwise); nothing reads `eval-out/results.json` back | Learning is failure-only at run level, and curation (consolidation/demotion) is test-only. |
| 11 | **Doc drift** | 2 `docClaims` mismatches remain | Counts and claims drift every wave; the ratchet now measures it. |
| 12 | **Owner actions** | a stale User-scope `DEEPSEEK_API_KEY` shadows the repo key (`RT_E_LLM_KEY_SHADOWED`) | Clear the ambient variable to silence the signal; it was left because other tools may read it. |
| 13 | **Honest limits that are not bugs** | `isolation.sandbox:false` (a runtime Permission-Model bound, **not** an OS sandbox; no network denial) · no in-product scheduler (an external host hook is the scheduler by design) · cross-family provider failover unimplemented · `autonomousSoftwareFactory:false` by design (it requires a human-approved fixture row) | Documented, deliberate. Do not "fix" them by weakening a claim. |

---

## 7. The remaining waves, in order

**W359 — kind fidelity (DISPATCHED, then PAUSED mid-flight 2026-10-15 — see §5b and
`wave_plans/W359/HANDOFF.md`; `wave_plans/W359/README.md` + 6 lane notes are the mandate).**
Its P0 (`kind-gate`) reports landed; `thread-kind` and `kind-corpus` are half-done and undocumented;
`cartographer` never started.
1. `resolve-kind` — one truth: a scored, evidence-recording resolution (`kindResolution{kind,confidence,
   evidence}`), the three replicated resolvers deleted, the kind stamped on the **keyless** path.
2. `kind-gate` — **the P0**: gate `briefedSiteFiles` on the kind and derive `jsx` from the emitted file set,
   so every kind's emitted source compiles. Carries the ready patch.
3. `inject-kind` — a project-stable `DELIVERY KIND` block in the synthesis prompt (~537 chars measured;
   54,574 chars of headroom) and a kind-correct expansion prompt (as prompt text, never a seventh key).
4. `thread-kind` — close the four holes; revive or honestly report the dead gate seam.
5. `kind-corpus` — an honest per-kind corpus, real pins that can fire, and re-verify the no-mock reader.
6. `cartographer` — verify, map regressions, and re-measure the wall.

**W360 — the P6 wall (the binding constraint).** Attack what actually loses runs: the emitted tree's own
`tsc`, empty-substance emissions, `p6-brief-fit` noun loss, and `p6-verified` promotion. Bounded keyed
sample, variance stated, floors pinned. *This is the first wave that spends money.*

**W361 — product quality.** The emitted product becomes a product: entry, router, distinct pages, styled
layout, wired flows. `productQuality.quality` moves up from 0/10 with no bar lowered.

**W362 — orchestration, the agent bus, and tool use.** Wire a real per-project message channel, make
delegation real, use DeepSeek function calling, and give every seat a deterministic, budgeted context pack.
**This is where SH0RTBUS (below) plugs in.**

**W363 — the learning loop, persistent memory, evaluation.** Close the loop: evaluation → lesson →
next-run change, with a measured delta that clears the sample's variance.

**W364 — autonomy, delivery, isolation.** Zero-human runs, an external scheduler, git/PR delivery, and an
isolation upgrade (or an honest refusal).

**W365 — consolidation.** Full re-measure, the final ratchet table, docs truth, browser proof
desktop+mobile, `gate.sh --double`, and the campaign report.

---

## 8. SH0RTBUS — the agent bus (its own repo)

**What it is:** a **message bus for agents and subagents to talk to each other** — a small, real, no-mock
library plus CLI that lets concurrent agents share a project-scoped, append-only channel: post a message,
subscribe to a topic, read a transcript, and replay it deterministically.

**Why it exists:** RapidTool's audit proved it has **no per-project agent bus** (zero matches for
bus/inbox/mailbox/pubsub across non-test source). Its seats cannot message each other, so "delegation" is
just `currentPhase + 1`. SH0RTBUS is that missing component, extracted so it stands alone and can be used
by any multi-agent system.

**Status: not yet built.** No `SH0RTBUS` / `SH0RTBUS` artifact exists anywhere on this machine — I searched
the Desktop (3 levels), the whole RapidTool tree, and every `.md`/`.ts`/`.tsx`/`.mjs`/`.json` for the token
and found nothing. So it is a **new project**, not an existing one to upload.

**Planned shape (real code only — no mocks, no stubs, no demos):**
- A file-backed, append-only log per project (NDJSON), with a stable message envelope
  `{id, at, from, topic, kind, payload, refs, causationId}` and content-addressed ids so a replay is
  byte-deterministic.
- A `Bus` API: `post`, `subscribe(topic, handler)`, `read(since)`, `transcript(project)`, `replay`.
- Delivery guarantees stated honestly: at-least-once within a process, durable across restarts, with
  bounded retention and explicit backpressure. No exactly-once claim we cannot prove.
- A CLI + a tiny HTTP/SSE surface for agents that are separate processes.
- Tests: concurrency (N writers, one bus), replay determinism, retention bounds, corrupt-log recovery.
- A README that states the guarantees and the non-guarantees plainly.

---

## 9. Invariants to preserve (do not break these)

1. **No fabrication.** Every number is measured or `unavailable` with an `RT_E_*` code. `estimatedCostUsd`
   stays `null`.
2. **100% working production code only.** No mock, stub, fake, demo or placeholder code on a production
   path; test doubles live only in test seams. The ratchet enforces this (`realProductOnly`).
3. **Floors may only rise.** A regression below a pinned floor is a hard failure; a metric that cannot be
   measured reports `unavailable`, never `pass`.
4. **A lane's log is never evidence for its own claim.** Verify against bytes; record a correction when the
   bytes disagree; an absence claim needs the query that shows absence.
5. **Never run the full gate while a lane is mid-edit.**
6. **Append-only logs**: `fixes/NN_*.md`; the register `research/multiagent/thoroughanalysis.md` is
   append-only above its end-marker.
7. **Disjoint file ownership per wave**; never edit another lane's files to work around a charter error.
8. **Never print or commit a secret.** `.env` is ignored and untracked; secrets are read server-side only.
9. **Bounded keyed spend.** Each wave behind `--token-ledger` + `RAPIDTOOL_CAMPAIGN_TOKEN_CAP`, every call's
   usage reported.

---

## 10. Where everything lives

| Path | What |
|---|---|
| `SETUP.md` | **Dependencies + the full step-by-step to install, verify and run it** (start here on a new machine) |
| `AGENTS.md` | The repo working contract (read it first, after this file) |
| `START-HERE.md` · `RUNBOOK.md` | Orientation · the human operator's runbook |
| `src/lib/` | The engine (13-phase machine, gates, synthesis, emission) |
| `src/components/`, `src/routes/` | The console UI (12 run tabs) |
| `scripts/rapidtool-cli.mjs` | The 39-verb headless CLI |
| `scripts/gate.sh` | The stability gate (11 stages, one JSON verdict) |
| `scripts/quality-ratchet.mjs` | The 50-metric improvement ratchet + its floors |
| `scripts/prevention/` | The 34-guard keyless prevention harness + its vendored fixtures |
| `wave_plans/W<N>/` | Per-lane dispatch notes, one file per lane, per wave |
| `fixes/NN_*.md` | Append-only landing logs (newest wave = highest number) |
| `research/multiagent/` | Lane reports + the finding register |
| `research/deepseek-api.md` | The live-verified DeepSeek API spec |
| `testruns/` | The pinned fixture corpus the guards replay |
| `NEXTSTEPS.md` | This file |

---

## 11. How to finish it

1. **Land W359** (`wave_plans/W359/README.md`): the kind gate first — it clears the last failing test — then
   the resolver, the injection, the threading, and the corpus. Re-run the boundary; it should be the first
   fully green boundary of the campaign.
2. **Then W360, the wall.** This is where quality actually moves. Do not skip the bounded keyed sample:
   pair-name the floors you intend to move before you spend, and refuse to read a single run as the result.
3. **Then build SH0RTBUS** (its own repo) and wire it in as W362's bus.
4. **After every wave:** run `gate.sh`, run `quality-ratchet.mjs --all`, update this file's §5 and §6 with
   the new measured numbers, and commit. Push.
5. **Never** let a claim outrun its evidence. If you cannot measure it, write `unavailable` and say why.
