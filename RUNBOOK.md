# RapidTool RUNBOOK

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (Windows; the path contains a space — quote it).
**Node:** 22 or newer (the `src/**` tests run under `--experimental-strip-types`; `package.json` `engines.node` = `>=22`).
**Audience:** a human operator running RapidTool for the first time.

> **Honesty note.** Every command, flag and limit below was read from the bytes in this
> tree or run in this session. Where a claim rests on another document it is named. Where
> this RUNBOOK cannot verify something, it says so instead of guessing. The companion
> machine contract is `scripts/README-cli.md`; the repo working contract is `AGENTS.md`.

---

## 1. What RapidTool is (and what it is not)

RapidTool is a deterministic 13-phase agent-governance harness: you give it a brief, it runs
P0→P12 as a governed **run**, and produces an **Agent Packet** plus an audit trail. A separate
**`emit`** step writes out the generated product tree (`src/lib/headless.ts` `emitProject` →
`src/lib/scaffold.ts`).

It is **not** a "type a sentence, get a finished app" button. The gates measure *internal
consistency* (identifier fit, the emitted tree's own tests); see §7 for what that does and
does not prove.

---

## 2. Install

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
node -v            # must be >= 22
npm install
```

`npm install` installs the dev toolchain. No API key is required to launch the console or run
the deterministic (keyless) path.

### Optional: the DeepSeek key

Keyed phases (live research narrative, P6 code synthesis, `crew`, `verify`, `chat`) need
`DEEPSEEK_API_KEY`. The CLI and the server resolve it from **`<working directory>/.env` first,
then the process environment; a non-blank `.env` value wins.** Run the CLI **from the repo
root** to use the repo's own `.env`. A *present-but-blank* `DEEPSEEK_API_KEY` is an intentional
keyless disable. Full rules and the `RT_E_LLM_KEY_SHADOWED` diagnostic are in
`scripts/README-cli.md` §"API key resolution".

---

## 3. Launch

| Command | What it does | URL / notes |
| --- | --- | --- |
| `npm run dev` | TanStack Start dev server | **http://127.0.0.1:8080** (loopback only) |
| `RAPIDTOOL_BIND_ALL=1 npm run dev` | explicit opt-in to bind all interfaces | `0.0.0.0:8080` — only on a trusted network |
| `npm run build` | production build + `db:migrate` | writes `dist/`; PGLite fallback needs no DB |
| `npm run preview` | preview the built app | **http://127.0.0.1:8081** |
| `npm run launch` | start helper (`scripts/launch-rapidtool.mjs`) | quickstart wrapper; `launch:stop` stops it |

The dev/preview ports are a **hard contract** (`strictPort: true`, `vite.config.ts:180-189`).
Override with `PORT` if 8080/8081 are taken — but a port collision fails loudly rather than
silently drifting.

Day-to-day quality gates (all should be 0 / green before you trust a change):

```powershell
npm run typecheck   # tsc --noEmit (+ the scripts typecheck leg)
npm run lint        # eslint .
npm test            # scripts/**/*.test.mjs  then  src/lib/**/*.test.ts
```

---

## 4. The console tour

Open `http://127.0.0.1:8080`, then `/run/<id>` for a project. The run screen has a phase rail
and a tabbed workspace (`src/components/console.tsx:191-207`):

**Primary tabs**
- **Artifacts** — every file the build produced (the audit surface).
- **Preview** — *"See the built product and download it"* (`software-preview.tsx`).
- **Agent packet** — the markdown handoff you paste into a coding agent.
- **Chat** — grounded questions about this build.

**Advanced tabs** — Spec graph (role→file ownership), Crew (advisory agent roles), Oracle
(acceptance cases), Vault (run notes, searchable), Design (P6 design tokens), Diagram
(architecture picture), Runtime log (operator diagnostics), Eval fixtures (corpus bars).

**Keyboard** (`console.tsx:1641-1656`): `e` execute current phase · `g` run to next gate ·
`a` approve the waiting gate (a failed bounded-runner gate needs the override tick first) ·
`r` focus the rejection note · `/` artifact search · `?` agent guide · `Ctrl+K` command
palette · `Ctrl+Enter` execute · `Ctrl+Shift+Enter` run-to-gate · `Ctrl+Shift+C` copy packet.

**The gates never block silently.** A run parks at a HITL gate (P4/P5/P8/P9) or on a red DoD
gate and waits for an explicit decision. Keyed runs default **enforce-DoD ON** (a red gate
parks instead of sealing past it); `create --advisory` or the console toggle relaxes that.

---

## 5. Running Wild Mode correctly

Wild Mode is the bounded autonomous loop (`engine.wildStep`): execute the legal phase →
Auto-Review classifier judges → self-approve gates → loop P0→P12. It is **bounded and never
fabricates progress**: a decision it cannot make honestly becomes a *park*.

### 5a. From the console

1. Open a project at `/run/<id>`.
2. Flip the **Wild** toggle in the header (`WildToggle`, `console.tsx:987`). Enabling stamps
   `wildMode: true` and starts the driver (`store.startWildRun`); if the start fails the
   toggle reverts rather than claiming a run that did not start.
3. Watch the **Wild activity strip** under the phase rail (`WildConsole`). **Pause** and
   **Resume** are the two emergency controls; **Stop** ends the run.

### 5b. From the CLI (the machine contract)

```powershell
# enable Wild Mode AND begin a bounded run
node --experimental-strip-types scripts/rapidtool-cli.mjs wild --project build.json --start

# step an already-active run (default 24 steps, --steps clamps 1..48)
node --experimental-strip-types scripts/rapidtool-cli.mjs wild --project build.json --steps 12

# lifecycle
node --experimental-strip-types scripts/rapidtool-cli.mjs wild --project build.json --pause
node --experimental-strip-types scripts/rapidtool-cli.mjs wild --project build.json --resume
node --experimental-strip-types scripts/rapidtool-cli.mjs wild --project build.json --stop
```

`wild --start` is the **only** way to reach Wild Mode from the CLI. `--agent-seal` is accepted
by `--start`, `--resume` and the bare step (the actions that *drive*); it is refused by
`--pause`/`--stop` and by `approve`/`gate`/`run`/`resume`/`unattended` (`RT_E_VALIDATION`).
See `scripts/README-cli.md` §"Wild (`wild`)".

### 5c. What a park means (this is the correct behavior, not a bug)

A parked Wild run is the design working. The common parks:

| Park row | Meaning | How to proceed |
| --- | --- | --- |
| `wild.paused_plan` | The stored plan was reviewed, but execution is **parked before the first mutation**. Under the agent seal a classifier **approve** proceeds; a reject or an unconfigured review always parks (`engine.ts:5103-5179`). | Approve/resume, or configure a classifier key. |
| `wild.paused_classifier` | An open gate needed a judgment the Auto-Review classifier could not make (`not-configured`), so it parked instead of fabricating a verdict (`engine.ts:5491`). | Configure `DEEPSEEK_API_KEY` and resume, or approve the gate by hand. |
| `wild.paused_human` | A `forceHuman` gate (e.g. a low-feasibility P0 reframe, or a failed-P6 sandbox gate) — deliberately **not machine-clearable**. | A human must decide. |
| `wild.paused` / hard-DoD block | `enforceDod` ON and P6's gate is red. | Fix the recorded unmet criteria, or run advisory. |

### 5d. Resuming

- **Console:** press **Resume** in the Wild strip — this calls `startWildRun` (the PA-01
  resume path), not a bare unpause, because a paused run's driver has exited.
- **CLI:** `wild --resume` clears the pause **and continues** the bounded run.
- A run that is still active after a page reload is a session artifact in the console; the
  strip says so and refuses to pretend it can resume (`console.tsx:1471-1475`).

> **Current classifier reach (verify before promising zero-human).** A browser host asks the
> *server* whether the key is configured and, when it is, routes the review through a server
> `createServerFn` bridge (`src/lib/wild-review.ts` `createHostWildReviewer`). When the server
> reports **no key**, the honest `not-configured` path stands and gates park. So "Wild Mode
> runs unattended with zero human input" is true only when a key is configured on the server.

---

## 6. Export / download the product

There are two surfaces; both write **files**, not a running host.

### 6a. Console — the Preview tab

The Preview tab renders the project's emission into a sandboxed iframe and offers a **ZIP
download** (`src/components/software-preview.tsx` → `software-export.ts` `emitSoftware` /
`buildSoftwareArchive`).

**Below-floor behavior (corrected 2026-10-15 — the bytes changed after this section first landed):**
for a **below-floor** run (`RT_E_PLAN_UNDERPRODUCED`) the Preview tab does not dead-end on the refusal.
`software-export.ts` `emitSoftware` calls `scaffoldProject(project, { underProduced: "partial" })` — the
explicit banner opt-in — because the 356 wave restored `refuse` as the scaffold's safety default (a
no-options call would return the coded refusal here). Under that opt-in the scaffold lands the partial
with its **own** unmissable `> [!CAUTION]` / `## BELOW-FLOOR PLAN` banner at the top of the emitted
`README.md` (`scaffold.belowFloorBanner`) and reports `underProduced`, which `emitSoftware` surfaces as
`redTree:{code:"RT_E_PLAN_UNDERPRODUCED",detail}`; `buildSoftwareArchive` then **does return a ZIP**
whose README carries that banner (the Preview tab shows a loud alert and the download works). For a red
tree the scaffold did **not** banner — an uncleared `p6.tree.failure`, or a partial synthesis — the seam
prepends its own RED TREE banner (`redTreeBannerText`) instead, so the README never carries a duplicate
caution. A run red for any *other* reason (an invented figure literal, an unloadable CommonJS body, an
invalid project) still returns the coded refusal with **no** archive. So the surface is honest **and**
non-inert: the artifact is labeled, never silently presented as cleared.
See `research/multiagent/wildmode-diagnosis.md` §5.5 and its 2026-10-05 corrections block.

### 6b. CLI — `emit`

```powershell
# write the runnable scaffold to a directory
node --experimental-strip-types scripts/rapidtool-cli.mjs emit --project build.json --out emitted/

# also execute the emitted tree in-loop (per-file parse + every emitted *.spec.ts + entry smoke)
node --experimental-strip-types scripts/rapidtool-cli.mjs emit --project build.json --out emitted/ --run

# land it as ONE Conventional-Commits git commit (only on a green --run verdict)
node --experimental-strip-types scripts/rapidtool-cli.mjs emit --project build.json --out emitted/ --run --git
```

- A **red** tree exits 1 (`RT_E_TREE_RUN_FAILED`); `--run --git` then **withholds** the commit
  while keeping the emitted tree on disk. `--red-tree banner` is the deliberate opt-in that
  ships an uncleared red tree **with** the unmissable `[!CAUTION]` banner on its README.
- Other continuation verbs: `tree-run --dir <emitted>` (read-only re-run of an existing tree)
  and `repair --dir <emitted> --project build.json` (hash-checked re-import + bounded repair).

---

## 7. Running the CLI verbs

**Canonical invocation (Node 22):**

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
node --experimental-strip-types scripts/rapidtool-cli.mjs <verb> [flags]
```

Every subcommand prints **exactly one JSON object on stdout** — parse it, branch on it. Run
`node --experimental-strip-types scripts/rapidtool-cli.mjs --help` (or `--help <verb>`) for the
verb's own flags; `grep -c 'case "' scripts/rapidtool-cli.mjs` is the verb-count source of
truth (39 today).

**A minimal keyless→keyed loop:**

```powershell
node --experimental-strip-types scripts/rapidtool-cli.mjs create --name "My Build" --brief "…" --out build.json
node --experimental-strip-types scripts/rapidtool-cli.mjs gate  --project build.json --autopilot   # advance to the next park
node --experimental-strip-types scripts/rapidtool-cli.mjs approve --project build.json --seat autopilot
node --experimental-strip-types scripts/rapidtool-cli.mjs emit  --project build.json --out emitted/ --run
```

**Exit codes** (`scripts/README-cli.md` §"Agent contract"): **0** success · **1** could-not-execute
/ red-gate completion / red tree · **2** parked at a HITL gate or `blocked` · **3** backend not
configured (no key where one is required) · **4** backend/runtime failure · **5** (opt-in
`--require-verified` on `emit --run`/`tree-run`) tree is GREEN but its declared `typecheck`/`build`
could not be resolved/run — an honest unknown, not a red tree.

**Useful diagnostics:** `doctor` (capability pre-flight + factory fields), `diagnose`
(telemetry + most-likely cause), `summary`, `artifacts`, `packet`, `export`.

---

## 8. The product-quality reading (what the gates do not measure)

RapidTool's DoD gates check **internal consistency**. To ask "is this actually a product?", use
the additive, byte-derived reader in `src/lib/product-quality.ts`:

```powershell
node --experimental-strip-types -e "import('./src/lib/product-quality.ts').then(async m => { const p = JSON.parse(require('fs').readFileSync('build.json','utf8')); console.log(JSON.stringify(m.readProductQuality(p), null, 2)); })"
```

It reports, from real bytes only (absent evidence is reported absent, never guessed):

- a real **web entry** (`index.html` + a `src` entry from the same list `acceptance-run.mjs` checks);
- **per-page files and a router**; the **count of distinct pages**;
- a **styled layout** (CSS / Tailwind / `className` / style objects);
- a **working ordering flow** for an ordering brief (an order-named callable referenced by
  another tree file **and** a form with wired submit);
- the count of **real (non-stub, non-reexport) modules**;
- **artifacts per phase** and the empty phases;
- the CLI flags `--no-empty-tree` and `--no-placeholder-only-tree` (exposed as
  `QUALITY_CLI_FLAGS` + `qualityFlagViolations()`);
- an **additive determinism reading** (`determinismReading` / `q.determinism`): which fields are
  reproducible from the brief alone, which are not, and their sources (`id` ← `crypto.randomUUID()`,
  `createdAt`/`logs[].ts`/`traces[].ranAt` ← `Date.now()`, `lastTest.evidenceHash` ← `fnv1a(...)`
  over timestamped rows, the emitted `package.json`/`README.md` UUID + ISO stamp). It never changes
  emitted bytes (codegen is a sibling's surface) and never affects `quality`.

It is also surfaced additively as `doctor`/`fleetAcceptance.productQuality`; it never flips
`autonomousSoftwareFactory`, `autonomousFactoryV2`, or any existing field.

**Measured example — a real keyed bakery run** (`%TEMP%\bloedow-e2e\bloedow-bakery.json`,
status `running`, `currentPhase` 6, `lastTest` null, 9-file tree):

```json
{ "quality": false, "flagViolations": [], "reasons": [
  "no web entry — index.html missing — no web HTML entry (the emit path adds one only for webapp/game kinds)",
  "no router — nothing navigates between pages",
  "0 distinct page files",
  "no styled layout (no CSS/Tailwind/className evidence)",
  "ordering flow incomplete: no form element with a wired submit handler" ],
  "modules": { "total": 9, "examined": 9, "real": 8, "stubs": 0, "reexports": 1, "unknown": 0 },
  "artifacts": { "total": 25, "emptyPhases": [7,8,9,10,11,12] } }
```

Read that plainly: the tree has **real domain logic and an ordering flow**, and it is **not a
website** — no entry, no pages, no router, no styling, no form. Internal gates can be green on
that tree; the product reading is not.

---

## 9. Known limits — what it cannot do yet (evidence-backed)

1. **The gates do not measure product quality.** `p6-brief-fit` is a lexical identifier test
   (`src/lib/dod.ts`). `p6-verified` only means the emitted tree's *own* tests went green — and the
   gate now **records that evidence class explicitly** (`runGate(…, 6).evidenceClass`:
   `p6-verified` = `executed-tree-tests`, `productBuildVerified:false`, so a green gate cannot be
   read as "the emitted product builds"). The `product-quality.ts` reading exists precisely because
   of this.

2. **`p6-arch` passes vacuously with no tree — and that is a SKIP, not product-complete.**
   The code itself says so (`dod.ts` `archTrace` + `archProductComplete`). This session made
   that honest: `runGate` now returns an `advisories` list, and the recorded gate artifact prints
   *"Qualified passes (**NOT** product-complete): p6-arch: SKIP — no generatedTree…"*. The recorded
   gate artifact also now prints **which evidence class each PASS accepted** (`evidenceClass`),
   including that `p6-arch` = `structural-tree-map` (a no-tree pass is a SKIP). No bar was lowered;
   the verdict and the evidence hash are unchanged.

3. **Keyless runs use a placeholder.** Without a key, P6 is a deterministic floor whose module
   implements phase bookkeeping only and fails `p6-brief-fit` by construction (`dod.ts`
   `briefFitUnmetReason`). A keyless run can seal "complete" with a red P6 gate — read
   `sealedWithFailures` / the exit code, not the phase count.

4. **The keyed P6 DoD gate is the binding wall.** The repo's own campaign records (in
   `AGENTS.md`'s dated correction blocks; their raw `testruns\**` artifacts are **not present in
   this checkout**, so this RUNBOOK does not restate a number it cannot re-derive here) report
   `RT_E_GATE_PENDING` at P6 as the dominant stall, with run-to-run variance. The live evidence
   available in this tree is the bakery sample in §8, which is `quality:false`.

5. **Isolation is a runtime bound, not an OS sandbox.** Generated code runs under Node's
   Permission Model (fs writes confined to the per-run scratch dir, `child_process` /
   `worker_threads` / native addons denied, 512 MB heap cap). `doctor` keeps
   `isolation.sandbox: false`; there is **no** network denial and no Docker / bwrap /
   AppContainer / Windows-Job-Object boundary.

6. **No in-product scheduler / daemon.** `unattended` drives one project per invocation; a host
   hook (Windows Task Scheduler / cron) is the scheduler by design. `npm run factory`
   (`scripts/factory-watch.mjs`) is one bounded multi-brief tick (create → unattended →
   `emit --run` verify → `emit --git`). There is no branch/remote/push/PR delivery.

7. **The Preview surface is no longer inert for a below-floor run** (corrected 2026-10-05; mechanism
   re-verified against the bytes 2026-10-15). A below-floor (`RT_E_PLAN_UNDERPRODUCED`) run surfaces
   the tree it did produce, with the unmissable `> [!CAUTION]` / `## BELOW-FLOOR PLAN` banner on the
   README and a downloadable ZIP that carries the same banner; only a red tree that fails for another
   reason shows a bare coded refusal with no ZIP (§6a).

8. **The console Wild classifier depends on the server key.** With no server-configured key,
   stock gates park as `wild.paused_classifier`; with one, the browser reaches the keyed
   classifier through a server bridge (`wild-review.ts`). Do not promise zero-human runs
   without a key.

9. **`resumeAccepted` IS now consumed by codegen** (corrected 2026-10-05): the consumer
   (`codegen.server.ts` `resumeByPath` / the `p6.synthesis.reused` event, `:6559-6762`) reuses a
   resumed path with zero synthesis prompts, and `headless.ts` `resumeAcceptedFromTree` /
   `driveP6Journey` threads the previous cycle's accepted chunks into `ctx.resumeAccepted`
   (`:3760`, `:3851-3886`). The residual honest limit is **cross-family provider failover**, which is
   still genuinely unimplemented (`RAPIDTOOL_FALLBACK_PROVIDERS` is inert). Recorded in `AGENTS.md`.

---

## 10. Where to go next

| Doc | Purpose |
| --- | --- |
| `README.md` | What RapidTool is, capabilities matrix, honest limits. |
| `AGENTS.md` | Repo working contract + the dated "corrections in force". |
| `AGENT_GUIDE.md` | How an agent consumes a RapidTool project (full honesty contract). |
| `scripts/README-cli.md` | The CLI machine contract: every verb, exit code, `RT_E_*` registry. |
| `research/multiagent/wildmode-diagnosis.md` | The step-by-step P0→P12 wild/emit diagnosis this RUNBOOK cites. |
| `src/lib/product-quality.ts` | The product-quality reading (§8). |

If a claim here disagrees with the bytes, the bytes win — fix this file.
