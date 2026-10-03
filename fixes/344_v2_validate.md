# fixes/344_v2_validate.md — validator V2 (independent validation + the cross-cutting autonomous-factory judgement)

**Validator:** V2. **Root:** `C:\Users\mnril\Desktop\RapidTool Main` (git `main`, HEAD `4bd1988`, tree
clean at start). **Host:** Windows + PowerShell; host Node v24.15.0; Node 22.23.2 at
`%LOCALAPPDATA%\hermes\node\node.exe`. **Posture:** READ-ONLY — **no source/test/config/doc/other-log
edits**; scratch under `$env:TEMP\rt344_v2\`; **0 keyed calls**; the only write is this file. The CLI
runs I made stamped one gitignored `<repo>/.rapidtool/logs/rapidtool.ndjson` row each (`.gitignore:31`);
`git status --porcelain` stayed empty throughout.

**Method actually run:** byte-reads of the A3/A4 slice + the pivotal cross-slice claims; independent
repro (commands in §5); a bounded **keyless** journey in `%TEMP%` (`create → gate → approve --seat
autopilot → gate…`, no `--live`, so no model calls); a **Playwright** drive of the live dev server (a
lane already held `127.0.0.1:8080`; my own `npm run dev` correctly failed `Port 8080 is already in
use`); targeted test suites (`README-cli.test.mjs` 12/12, `check-assertion-gaps.test.mjs` 30/30,
`check-module-coverage.mjs`, `tsc -p tsconfig.scripts.json`); the assertion-gap lint (136 files, 0
findings).

> **A3 LOG ARRIVED LATE — after my poll window.** `fixes/344_a3_ui.md` did not exist through repeated
> polls; `a1` (11:12), `a2` (11:11) and `a4` (11:12) had landed. A3 landed at **11:16:01**, i.e. after I
> had drafted the body of this file. I therefore validated it **post-hoc, independently** (rows
> **A3-01…A3-15** below, all re-derived from bytes) rather than leaving it unreviewed. My own
> independently-derived UI findings (§2 M-3, M-4, M-6) remain, and §4 now critiques A3's work plan too.
>
> **Process note on A3's own evidence base:** A3 discloses (§ header) that the workspace `.env` has a
> key, so **two of its UI "Run to next gate" clicks traversed keyed phase paths** before it noticed. Its
> "keyless-only" findings are still byte/source/route-based, but its *run-state* observations came from
> a keyed browser session — a constraint violation for a wave that mandated 0 keyed calls, and a
> confound a reader must weigh.

---

## 1. Validation table — the auditors' top findings re-derived

Verdict key: **CONFIRMED** (bytes/command reproduce it) · **PARTIAL** (true core, wrong scope/severity)
· **REFUTED** (does not reproduce) · **UNVERIFIED** (not re-checked).

| finding | auditor | my verdict | my evidence (re-derived) | correction / note |
|---|---|---|---|---|
| **A4-F-01** `authMiddleware` zero importers / unwired chokepoint | A4 | **PARTIAL** | `grep authMiddleware src` → only its own definition + **doc comments** (`middleware.ts:12,15,28`; `isolation.server.ts:29`; `verify.server.ts:67,89`). `check-module-coverage.mjs` output verbatim: *"ZERO importers in this repo (its only `import` is its own doc comment at :12)"*. **BUT** the underlying guard `assertSameSiteRequest` **is** wired: `src/lib/app-data/client.server.ts:4` imports and `:202` calls it. | Core fact true, framing overstated. The claim "*per-user server functions are not guarded; direct autonomous-shipping safety risk*" ignores (a) the app-data connector half is guarded, (b) `VITE_AUTH_ENABLED=false` is the shipped default (`.grok/app-env.json`) and the dev bind is loopback, (c) the repo's server fns are not per-user. **Downgrade High → Medium** and correct the finding to say the `authMiddleware` *template* is unmounted while its isolation half runs at `app-data/client.server.ts:202`. |
| **A4-F-02** CLI reads `<cwd>/.env`; three docs say it doesn't | A4 | **CONFIRMED** | `scripts/rapidtool-cli.mjs:587-631` (`DOTENV_PATH = resolve(process.cwd(), ".env")`, `installRepoEnvKey`). Live: `node scripts/rapidtool-cli.mjs doctor` → stderr `[RT_E_LLM_KEY_SHADOWED] … the .env key … WINS over the process-environment key; using the .env key`. `README.md:142` still says the CLI "does **not** read `.env`". | Correct. Credential-precedence docs are the last place a false claim should live. |
| **A4-F-03** exit taxonomy drift | A4 | **CONFIRMED** | `AGENTS.md:30` = "exit-code taxonomy (0/1/3/4)" (drops 2 **and** 5) while `AGENTS.md:77` = "0/1/2/3/4 plus **5**". Same file contradicts itself. | Correct; a normal park (2) reads as an unlisted code to an agent that trusts line 30. |
| **A4-F-04** "No git landing / checkpoint-resume yet" | A4 | **CONFIRMED** | `README.md:226` and `:280` say so; `emit --git` is in the CLI USAGE (`rapidtool-cli.mjs` `emit` line) and README §7 already marks checkpoint+resume REAL. | Correct: internally contradictory limit text. |
| **A4-F-05** "every fresh `emit --run` is unverified" | A4 | **CONFIRMED** | Independent repro: fresh keyless `emit --run` on my scratch project → **EXIT=0**, `declaredScriptsVerified: true`, `note: "the declared project scripts were resolved from the RapidTool repo's own node_modules/ (offline, no install)"`. `scripts/README-cli.md:478-479` and `:1051` assert *"**every** fresh `emit --run` is unverified"*. | Correct; an agent hard-coding `unverified:true` is wrong at this HEAD. |
| **A4-F-06** README deploy story false (auth migration never applied by `npm run build`) | A4 | **CONFIRMED** | `migrations/` holds only `auth/*.sql`; `scripts/migrate.mjs:38` `readdir(migrationsDir)` is non-recursive; `:72` `pendingMigrations(entries, [])` → `:73` *"[migrate] no migrations - nothing to do."* The `auth/` dir is read only for the preflight (`:61`). `README.md:441` says the auth schema is "applied by `scripts/migrate.mjs` in `npm run build`". | Correct. (The truth is already documented in `README-cli.md`'s `RT_E_AUTH_SCHEMA_MISSING` row.) |
| **A4-F-07** `tsconfig.scripts.json` "1030 pre-existing" | A4 | **CONFIRMED** | `node node_modules/typescript/bin/tsc -p tsconfig.scripts.json --noEmit` → **exit 0**, zero diagnostics. `typecheck-scripts.test.mjs` `ERROR_BUDGET = {}`. `README.md:451` still says 1030. | Correct. |
| **A4-F-08** catalog script/test counts | A4 | **CONFIRMED** | Live: `git ls-files scripts` = **49**; `(Get-ChildItem scripts -Filter *.test.mjs).Count` = **24**; `git ls-files src/lib` = **239**; `git ls-files src/lib | grep '\.test\.'` = **112**. `README.md:560` says "46 = 24 + 22"; `:538` says "93"; `:477` says "213". | Correct; the two newest guards (`check-module-coverage.test.mjs`, `typecheck-scripts.test.mjs`) are omitted from §10.7. |
| **A4-F-09** catalog totals / stale `.t4scratch` correction | A4 | **CONFIRMED** | `git ls-files` = **1926**; `Test-Path .t4scratch` = **False**; `git ls-files .t4scratch` = **0**; `git ls-tree -r --name-only 686d7b6 | wc -l` = **2096** (so 2,096 was right pre-deletion, but `73f660a` deleted `.t4scratch` in that same 342 commit). `README.md:349/351` says 1,908 and `:295-299` says "still 192 tracked files … owes a `git rm`". | Correct — the 342-6 correction is **self-superseded by its own commit**. |
| **A4-F-10** RT_E table status parentheticals | A4 | **CONFIRMED** | `README-cli.md:1143` `RT_E_GIT_UNAVAILABLE` "— (no live emitter today; landing tail unwired)" and `:1147` `RT_E_MCP_DISABLED` "— (owner-gated; no live emitter until the transport lands)". The git tail landed in 343-3 (`emit --git`), the MCP stdio transport is implemented (`mcp.server.ts`), and I observed the **doctor emitting `RT_E_MCP_DISABLED` live**. | Correct. |
| **A4-F-11** `--verify-kind` line refs | A4 | **UNVERIFIED** | Not re-checked (low). | — |
| **A4-F-12** "21 contract suites" | A4 | **CONFIRMED** (number) | `README-cli.md:1241` "the scripts suite (**21 contract suites**)"; live `*.test.mjs` = **24**. | Correct on the count. |
| **A4-F-13** START-HERE shells stale | A4 | **CONFIRMED** | `START-HERE.md:96-101` "Shelled / in progress" still names `unattended run (W-47)`, `checkpoint+resume (T-107.7)`, `MCP client (F1)`. The 342-6 correction (`:177-181`) fixes counts + `unattended` only. | Correct, with a nuance: the file is append-correction layering; and even its newest snapshot (`src/lib 235` at `:178`) is now stale vs live **239**. |
| **A4-F-14** `.env.example` omits live knobs | A4 | **CONFIRMED** | Independent enumeration (code refs → absent from `.env.example`): `RAPIDTOOL_PROVIDER` (6), `RAPIDTOOL_MCP_ENABLED` (16), `RAPIDTOOL_MCP_SERVER` (11), `P6_SYNTH_CANDIDATES` (25), `RAPIDTOOL_CASSETTE_MODE` (4), `RAPIDTOOL_CASSETTE_TAPE` (3), `RAPIDTOOL_LLM_ENV_FILE` (4), `BROWSER_SMOKE_BASELINE` (2), plus `RAPIDTOOL_BIND_ALL` in `vite.config.ts`. `README.md:146` says "documents every knob". | Correct. |
| **A4-F-15** `strictPort` collision | A4 | **CONFIRMED** | I independently hit it: my `npm run dev` → `Error: Port 8080 is already in use`. `vite.config.ts:162,167` set `strictPort: true` on 8080/8081. | Correct; note the port was **deliberately** pinned by the owner's contract, so the fix is a documented dynamic-port escape, not a pin change. |
| **A4-F-16** format gate TODO | A4 | **CONFIRMED** | `.prettierignore:6-8` carries literal `TODO(R15-f05): … add a format:check row … today the formatter is shipped but never enforced`; `gate.sh` has no format step. | Correct. |
| **A4-F-17** CI never executed / host-pin comment false | A4 | **CONFIRMED** | `.github/workflows/gate.yml:26-35` header says it has never run and the ubuntu leg cannot catch the Windows-path class; `:61` "Pin == the dev host (`node -v` → v22.23.2)" while the **host is v24.15.0** (`node -v`). | Correct. |
| **A4-F-18** no scheduler / walk-away path | A4 | **CONFIRMED** | No scheduler/daemon/queue in the product; `README-cli.md:1004-1008` states `unattended` is *"NOT a daemon — an external hook … invokes it on a cadence"*; `emit --git` is opt-in and is not invoked by `gate`/`unattended`; no brief-queue intake. | Correct — the structural gap, and (see §3) one of the honest blockers. |
| **A4-F-19** module-coverage debt | A4 | **CONFIRMED** | `node scripts/check-module-coverage.mjs` → *"110/126 src/lib modules reached · 16 allowlisted · 0 unallowlisted · 0 stale"*, and its own text confirms `auth/middleware.ts` "ZERO importers". | Correct. |
| **A4-F-20** load-sensitive flake class | A4 | **UNVERIFIED / PLAUSIBLE** | I did not run the concurrent-load test (forbidden gate territory). The class is documented in `AGENTS.md:65-67` + gates-of-record `flakes:[]`. | Plausible; not re-derived. |
| **A4-F-21** session-start docs cite 398/2736 | A4 | **CONFIRMED** | `AGENTS.md:63` and `RESUME.md:19` cite "scripts 398/398 · src 2736/2726/10"; the newest gate of record (`fixes/343_0_parent.md` §1/§7) is **scripts 427 · lib 3261/0/2 skipped**. | Correct. |
| **A4-F-22** `emit --git` prose missing | A4 | **UNVERIFIED** | Not re-checked (low). | — |
| **A2-F1** verifier verdict forgery | A2 | **CONFIRMED (Critical)** | **My own minimal repro** against `runCases` (`src/lib/verify.server.ts`): `throw new Error('boom')` + one case `typeof exports === 'object'` → `{pass:false, compileError:"source failed to compile in the harness"}`; **adding a scheduled lookalike marker** `setTimeout(()=>{console.log('HARNESS_EXPORTS exports');console.log('HARNESS_COMPILE pass')},0)` → `{pass:true}`. Root cause: markers are emitted on the **same stdout** as the module (`verify.server.ts:739-740`) and parsed **last-line-wins** (`:971-976`); the timer fires after the harness's real markers. Mint linkage read: `:1711-1725` sets `status:"passed"`; `src/lib/verify.ts:303` returns `label:"tested"`. | **Stronger than as written** — no throw is even needed (a bare forged-marker module with zero exports also passes). This is the single most consequential claim in the wave. |
| **A1-12** console approve mints `decidedBy:"human"` without a token | A1 | **CONFIRMED** (cross-check) | `src/lib/store.ts:1884-1890` unconditionally `approveHitl(project, { decidedBy: "human" })`; contrast the CLI's `--i-am-human` + TTY `RT_HUMAN_SEAT_TOKEN` re-entry and `engine.ts:1803` requiring an explicit `decidedBy`. My Playwright session could click Approve with no token. | Cross-slice info; the browser is the *designed* human surface, but a scripted browser is a machine path that can mint `human`. |
| **A1-02** human-acceptance door is a by-design blocker | A1 | **CONFIRMED** (cross-check) | `src/lib/doctor.ts:520-523` latch requires `human===true` (a `decidedBy:"human"` fixture row); `:531-538` `awaitingHumanAcceptance` names it; `policy.ts:155-162` denies the autopilot seat on `fixtures.approve`. | Correct; the defect is the *claim*, not the gate. |

### A3 findings — validated post-hoc (A3 log landed at 11:16, after my poll window)

| finding | auditor | my verdict | my evidence (re-derived) | correction / note |
|---|---|---|---|---|
| **A3-01** pipeline now-line shows `sys.longtask` not the run | A3 | **CONFIRMED** | `src/components/pipeline-rail.tsx:126-183`: `pickNowLine` tests `tail.length>0` (client ring) **first** and returns `source:"ring"` before it ever falls through to `project.logs` (ledger) or `wildRun`. A newer jank row therefore outranks a parked ledger entry. | Correct (display-only). Nuance: it is not that diagnostic scopes are *always* preferred — the **ring as a whole** outranks the ledger; skipping `sys.*`/`ui-*` when a ledger/wild row exists is the right fix. |
| **A3-02** stall latch can never clear | A3 | **CONFIRMED** | `setStallLatch` is written on the production heartbeat (`rt-client.ts:548`), persisted and rehydrated, while `clearStall` (`rt-client.ts:359-363`) and `peekStall` have **no non-test caller** (grep: `rt-client.test.ts:96,103-105` only; `pipeline-rail.ts:437` is a comment). | Correct; a write-only latch that survives reload is a real stale-state bug. |
| **A3-03** `plugin.ts` (T5.5 hook registry, 412 lines) 0 production consumers | A3 | **CONFIRMED** | Importer census: the only `from "./plugin"` is `plugin.test.ts:31`; the other hits are the file's own header. | Correct. |
| **A3-04** `compaction.ts` 0 production consumers | A3 | **CONFIRMED** | Only `from "./compaction.ts"` is `compaction.test.ts:17`. | Correct. |
| **A3-05** `watchdog.ts` decisions unwired | A3 | **CONFIRMED** | `watchdogDecision`/`shouldAutopause`/`requiresHumanResume`/`boundedStepWatch` are consumed **only** by `watchdog.test.ts` (grep); the module header (`:5-17`) claims the store/headless/heartbeat drivers share them. | Correct (doc-vs-byte drift + unwired math). |
| **A3-06** auth UI dead; `/login` dangling | A3 | **CONFIRMED** | `gates.tsx` exports `SignedIn/SignedOut/SignInGate/SignInButtons/UserButton/RedirectToSignIn`; no file outside `src/lib/auth/` imports them (grep). `SIGN_IN_PATH="/login"` (`gates.tsx:21-22`, comment literally says "Create this route"), and `routeTree.gen.ts` exposes only `/` and `/run/$id` → enabling auth would **404** instead of signing in. | Correct, latent while `VITE_AUTH_ENABLED=false`. |
| **A3-09** vault helpers bypassed by the console | A3 | **CONFIRMED** | `searchVaultScored`/`backlinksFor` appear only in `vault.ts` (+ its internals), `vault.test.ts`, `sweep73-fuzz.test.ts`; **no console.tsx hit**. | Correct. |
| **A3-10** report-intake caps unpinned | A3 | **CONFIRMED (premise)** | `report-intake.ts:113-114` define `REPORT_MAX_ARTIFACTS=12`, body `50_000`; `report-intake.test.ts` contains **no** 12/13 or 50_000/50_001 boundary assertion (the only "13" is an unrelated bad-value list at `:24`). | Correct: the cap is documentation-only against regression; A3's surviving-mutation transcript is consistent. |
| **A3-11** Long-Tasks floor/coalesce unpinned | A3 | **CONFIRMED (premise)** | `rt-client.test.ts:431-476` asserts observer construct/observe/disconnect only; no assertion exercises the `durationMs < 250` floor or `RT_COALESCE_MS`. | Correct premise; I did not re-run the mutation. |
| **A3-15** factory partly opaque from the console | A3 | **CONFIRMED (existence)** | `grep quarantine src/components/console.tsx` = **0**; the `ShellSurfacesCard` disclosures (`console.tsx:7300-7474`) are the honest gap ledger. | Correct direction; the "what a browser cannot do" list is A3's reading of that card, which I did not line-verify in full. |
| **A3-13** seeded demo presented as user data | A3 | **CONFIRMED** | My own Playwright home-screen drive showed `Northwind Dispatch / logistics · Phase 1 of 13 · not started` with no "example/demo" label. | Correct (honest-scaffold polish). |
| **A3-12 / A3-14 / A3-17 / A3-18** | A3 | **UNVERIFIED** | Not re-derived (low/cosmetic, or need the mutation harness / full card read). | — |

*(My own A3-slice findings that A3's log does **not** contain: **M-3** the stale "ten/seven" tab-count
comments, and **M-4** the palette's "34-verb" header — see §2.)*

**Net:** of the ~22 A4 findings I re-derived **17 CONFIRMED**, **1 PARTIAL/mis-severity** (F-01), **1
CONFIRMED-on-count** (F-12), and **3 UNVERIFIED low** (F-11/F-20/F-22). Of the A3 findings I re-derived
**11 of 18, all 11 CONFIRMED** (two on-premise only), none refuted. **No auditor finding was REFUTED,
and I found no fabricated evidence.** The A2-F1 core reproduced exactly and more cheaply.

---

## 2. Missed findings (in the same two slices — things the logs did not cover)

### M-1 — `AGENTS.md` (the primary repo contract) contradicts the shipped bind hardening — **Medium/A4 missed**

`AGENTS.md:18`: *"the dev server binds `0.0.0.0:8080` (vite.config.ts). Do not change the host/port
contracts."* But `vite.config.ts:160` is `host: process.env.RAPIDTOOL_BIND_ALL === "1" ? "0.0.0.0" :
"127.0.0.1"` — the **loopback default** landed by R11-f01 (the security fix that closed the
"unauthenticated-`runNodeBounded` over the LAN" surface), and `README.md:90-92` documents it correctly.
The first file a resuming agent reads tells it the opposite of the shipped behaviour.

### M-2 — `diagnose` reports a false "not a clean bill of health" from benign CLI usage rows — **Medium/A4 missed (observability)**

`node scripts/rapidtool-cli.mjs diagnose` returns `mostLikelyCause.class = "unclassified-errors"`:
*"**96** error/critical row(s) in window did not match a named heuristic — not a clean bill of health."*
Every one of those rows is a prior `cli.invocation` **usage** error (`"create: missing required
--brief"`, `"Unknown subcommand: frobnicate"`) recorded at `level:"error"` in the shared repo-root
NDJSON log (6532 rows). `src/lib/diagnose.ts:201` only classifies `cli.invocation` as a **park** when
`payload.exitCode === 2`; there is no rule for exit-1 validation rows, so test/probe noise is ranked as
a product error class. This is the operator's "what's wrong?" surface; a false alarm here erodes the
observability the factory leans on. (It correctly reports `persistHealth.ok:true`, so the alarm is
specifically the unclassified-error bucket.)

### M-3 — console in-code docs claim the wrong tab count — **Low/A3 did not cover**

`src/components/console.tsx` says "ten peer tabs" / "all ten `RunTab` values" / "the ten `Tabs.Content
value=` blocks" / "the remaining seven behind 'More panels'" at `:169, :171, :205, :3575, :3576`. Live:
`RUN_TABS` has **11** entries (`:179-193`, `fixtures` is the 11th) and **8** are `advanced`. My
Playwright drive confirms **11** tab triggers (3 primary + 8 revealed) and the button computes its label
from `advancedTabCount` (`"More panels (8)"`, `:3598`) — **the UI is correct; only the comments drifted**
when the Eval-fixtures tab was added.

### M-4 — command-palette header cites a stale verb count — **Low/A3 did not cover**

`src/components/cmd-palette.tsx:6`: *"the **34**-verb surface was recall-only"*. The CLI dispatcher has
**39** verbs (`grep -c 'case "'` = 39; pinned by `README-cli.test.mjs`). Cosmetic, but it is the kind of
number the repo's own contract says must be re-derived, not remembered.

### M-5 — A4's "7 `createServerFn` sites" is actually 12 — **Low/accuracy**

A4-F-01 says "The 7 `createServerFn` sites mount no `.middleware([authMiddleware])`". The substantive
claim (no mounts) is right, but the count is wrong: `chat.ts:20,38`; `verify.ts:35`; `exec.ts:41`;
`crew.ts:155,162`; `research.ts:44,55`; `fixtures.review.ts:15`; `llm.ts:83,154,205` = **12**. A larger
count makes the same point.

### M-6 — environment hazard, not a repo defect: the shadowed ambient key

Every CLI invocation from this host prints `[RT_E_LLM_KEY_SHADOWED] … using the .env key` to **stderr**
(a stale Windows User-scope `DEEPSEEK_API_KEY` shadows the repo `.env`). It is handled honestly
(`START-HERE.md:150` calls clearing it an owner action; exit stays **0**). Flagging it because under
PowerShell a native command writing to stderr surfaces as `NativeCommandError`, and any wrapper that
reads a combined stream can mistake this benign signal for a failure — a real multi-agent harness hazard,
not a code bug.

### Not-a-finding (checked, to avoid a false positive)

`START-HERE.md:104` ("keyed evidence runs blocked by funding → 402") looked stale, but the file's own
**CORRECTION at `:121-150` explicitly supersedes it** (account funded; plumbing was the real cause). Not
a finding. Likewise, `console.tsx`'s approve/reject/run handlers all carry their own in-flight and
length guards (`:2375-2460`), the store survives corrupt localStorage (`store.ts:934-974` salvage), and
the preview postMessage bridge checks both `event.source === window.parent` **and**
`event.origin === parentOrigin` (`preview-host-bridge.ts:170-174`) — all sound.

---

## 3. The cross-cutting autonomous-factory judgement

**Question:** does anything still block RapidTool from being *a truly autonomous software factory* —
brief in → machine-verified delivery out, **zero human input**?

**Verdict: NO — not yet.** The pipeline, governance, parks, ledger, MCP surface, eval harness and
observability are largely built and honest, but **six blockers** remain. One of them (`B1`) is a
soundness hole in the very mechanism the phrase "machine-verified delivery" names, so it must lead any
fix wave. Everything else genuinely still-open is *polish*, listed separately.

### Blockers (each with evidence)

1. **B1 · The machine verifier can be forged (Critical).** `runCases` admits a module that throws on
   load and exports nothing as `pass:true` when it schedules a lookalike `HARNESS_EXPORTS`/
   `HARNESS_COMPILE` line (`verify.server.ts:739-740, 971-976`; `verify.ts:303` mints `label:"tested"`).
   Reproduced independently (§1, A2-F1). **This invalidates "machine-verified" for every run** — keyed
   or keyless — because the code under test can author the verdict that certifies it.
2. **B2 · The human-acceptance door is required by design (the literal zero-human definition cannot be
   met).** `doctor.ts:520-523` gates `autonomousSoftwareFactory` on a `decidedBy:"human"` fixture row,
   and `policy.ts:155-162` denies the machine seat on `fixtures.approve`. `awaitingHumanAcceptance`
   names it honestly. This is *deliberate and correct governance* (a machine must not set its own bar),
   but it is a blocker to the mandate's literal wording; the honest resolution is to grade against the
   **externally frozen** corpus graders (which already exist) instead of machine-drafted fixtures.
3. **B3 · There is no walk-away orchestrator (A4-F18).** No scheduler/daemon/queue; `unattended`
   explicitly expects an external Task Scheduler/cron hook and drives **one** project; `emit --git` is
   opt-in and is not chained by `gate`/`unattended`; there is no brief-queue intake. The drive works (I
   advanced a keyless run P0→P7 with machine approvals; A4 drove keyless `unattended` to P12 complete)
   — the missing part is the loop around it.
4. **B4 · Synthesis quality / product reality (quality blocker).** The newest measured keyed pass@1 is
   **0.182** (mean 6.09/9; `fixes/343_0_parent.md` §1), and every keyless tree I inspected is not a real
   product: `doctor --tree research/eval-out/coffeehouse2home-property-ledger--trial-1` →
   `{stubs:1, reexports:4, real:0}`; my fresh keyless `emit` → `substance {stubs:1, reexports:0,
   real:0}`. My keyless journey hard-stalled at P7 (`RT_E_GATE_PENDING`, `sealedWithFailures:true`) on
   the P6/P7 DoD ("no keyed model synthesis ran"). The factory cannot yet reliably produce a working
   multi-job app.
5. **B5 · No OS isolation (declared, honest).** `doctor` → `isolation {sandbox:false, kind:"none",
   docker:false, bwrap:false}`; the node-runner is a bounded timeout + env allowlist, "NOT a sandbox".
   Executing generated (untrusted) code unattended without an isolation boundary is a real risk
   blocker, not fixable on this host (docker/bwrap absent per the W11 L2 probe).
6. **B6 · Single provider; failover unarmed (resilience blocker).** `registry-failover.test.ts` pins
   that a configured `RAPIDTOOL_FALLBACK_PROVIDERS` chain **refuses pre-dispatch** ("NOT ARMED",
   `RT_E_VALIDATION`, zero fetch), and `probeProviderModels` has no production consumer. A DeepSeek
   outage / key death halts the factory; it fails loudly, but there is no cross-family reroute.

### Not blockers (polish / deliberate / honest limits — do **not** gate a fix wave on these)

- **MCP owner-gated OFF by default** — deliberate (discovery-first, `RT_E_MCP_DISABLED`); a feature
  gate, not a delivery blocker.
- **~two dozen doc-truth drifts** (A4-F-02…F-14, F-21, M-1, M-3, M-4) — truth/quality, zero runtime
  impact.
- **`strictPort` collision (F-15)** and **CI never executed / no Windows leg (F-17)** — agent-ergonomics
  and process gaps.
- **`format:check` TODO (F-16)**, **coverage debt (F-19)**, **flake class (F-20)** — hygiene.
- **`diagnose` false-alarm bucket (M-2)** — observability quality; the surfaces exist and are otherwise
  honest (NDJSON log, `diagnose`, runtime-log tab, `persistHealth`).
- **P7–P12 produce no artifacts on a stopped run** — reported honestly by the coverage census; roadmap,
  not a lie.

**Bottom line.** Even discounting the deliberate human-acceptance door (B2), RapidTool is not yet a
zero-human factory: the verification it depends on is presently forgeable (B1), there is nothing to
walk away behind (B3), and the keyed product is not yet reliably a working app (B4), with isolation and
failover unarmed (B5/B6). The governance/parks/ledger/honesty scaffolding around those gaps is
genuinely complete and was verified.

---

## 4. Work-plan critique + how much of the auditors' output is trustworthy

### A4's plan (`fixes/344_a4_process.md` §3)

- **Ordering is defensible but mis-prioritized for the mandate.** A4 leads with **F-01** (which I
  downgrade to Medium) and puts **F-18** (the walk-away path — A4's own "largest structural gap") in
  Phase 3. For the question the wave is actually asking, the fix order should be: **(1) B1 / A2-F1
  verifier unforgeability**, **(2) B3 / F-18 the orchestrator**, then the docs/truth batch. A4 correctly
  batches the ~10 doc corrections into Phase 1 — that part is right and matches the repo's
  append-a-correction convention.
- **Completeness gaps:** misses **M-1** (`AGENTS.md:18` `0.0.0.0` contradiction — high-visibility, in
  the primary contract), **M-2** (`diagnose` observability false alarm), and undercounts the
  `createServerFn` sites (7 vs **12**, M-5). **F-11/F-20/F-22** are unverified.
- **Feasibility risk in F-01's fix.** A4 proposes *"a guard test that every per-user `createServerFn`
  carries the middleware."* That guard would fail today against the repo's own 12 server fns, which
  intentionally mount nothing (auth is off by default and they are not per-user). Without first
  deciding the intended posture, the guard will either break the tree or be allowlisted to zero value —
  exactly the repo's own "declare-or-strike" trap.
- **Already-done items:** none of A4's plan items are already implemented in code. F-04/F-13 are
  *doc-only* fixes (the capabilities already shipped), F-16 adds a new gate rather than fixing a defect,
  and **F-22** is half-closed already (343-3 recorded the `--git` STOP; the flag is in the command list
  and `USAGE.emit`).
- **Honest coverage statement:** A4 disclosed that it did **not** run the full gate or `npm test` and
  took the 427/3261 counts from `fixes/343_0_parent.md`; that is the correct disclosure and I confirm
  it did not claim measured counts it did not measure.

### A3's plan (`fixes/344_a3_ui.md` §3)

- **Ordering is sound.** It leads with the two highest-facing defects (A3-01 now-line, A3-02 stall
  latch) then the unwired subsystem cluster, then test teeth, then cleanup — a reasonable
  severity×leverage order for a UI slice.
- **Completeness:** strong on client wiring (it found several genuinely unwired, tested subsystems —
  `plugin`, `compaction`, `watchdog`, swarm, vault helpers, auth UI, chat streaming, DB). It **misses
  M-3/M-4** (the stale tab- and verb-count comments in `console.tsx`/`cmd-palette.tsx`) and the
  `diagnose` observability false-alarm (M-2, which is closer to its slice than to A4's).
- **"Already-done" risk:** low — none of its items is already implemented; §"Not worth doing" is well
  argued (e.g. refusing a UI wrapper over a one-shot provider is correct).
- **One feasibility caution:** A3-06's proposed fix ("add the `/login` route + mount
  `SignInGate`/`UserButton`") is really a product decision about whether this local, auth-off tool ships
  a sign-in flow at all; while `VITE_AUTH_ENABLED=false` the honest fix is the other branch (delete the
  UI subtree, keep the server contract) — the plan offers both but should lead with the decision.
- **Evidence-quality caution:** A3's browser runs were **not keyless** (it discloses two accidental
  keyed UI runs), so its run-state screenshots are from a keyed session. Its strongest findings
  (A3-01…A3-06, A3-10/11/15) are all source/byte/route-level and stand independent of that, but any
  claim about *keyless* run behaviour from its browser passes is confounded.

### How much can be trusted as written

- **A4 — high.** 17/20 re-derived findings CONFIRMED with no fabricated evidence and no false
  positives; counts are accurate. The only corrections are **F-01's severity/framing** (High → Medium;
  it omits the `app-data/client.server.ts:202` wiring) and the 7-vs-12 site undercount. Treat its
  docs-truth table as reliable.
- **A1 / A2 — cross-checked, sound on the points I touched.** `A1-02` and `A1-12` match my independent
  reading of `doctor.ts`/`store.ts`; `A2-F2` matches my read of `registry-failover.test.ts`; and
  `A2-F1` I reproduced independently and *more strongly* than written. I did not validate their other
  findings (not my slice).
- **A3 — high (late).** Landed after my poll window; I re-derived **11 of 18** findings and **all 11
  CONFIRMED** (A3-01…A3-06, A3-09, A3-10/11 premises, A3-13, A3-15 existence); no false positives found.
  Two caveats: (a) its evidence base includes **two accidental keyed runs**, disclosed by A3 itself, so
  its run-state observations are not keyless; (b) it missed M-3/M-4 and the `diagnose` noise.

**My own limits (stated plainly):** I ran no keyed LLM call; I did not run `npm test` or the full
`gate.sh`; the UI checks ran against a live dev server held by another lane; and I validated the
`tested`-stamp linkage to `applyVerifyOutcome` by reading `verify.server.ts:1711-1725` + `verify.ts:303`,
not by driving a full verify-fix loop.

**Cross-log note — the "0 keyed calls" claim is not cleanly evidenced.** A3 discloses **two accidental
keyed UI runs** (its `.env` has a key). A4 claims *"All keyed calls: 0"* while also stating it drove
`unattended` to P12 — and `run`/`gate --unattended` **force `live=true`** (`rapidtool-cli.mjs:1159-1161`;
its own comment calls it "the keyed journey"), so a keyless outcome holds only if the CLI process never
saw a key (running from a scratch cwd makes `DOTENV_PATH = <scratch>/.env` absent). A4 does not state
its cwd/key state. This does not affect any byte-level finding, but the wave owner should verify the
keyless accounting before treating the wave as 0-keyed.

---

## 5. Evidence index (commands actually run)

```powershell
# repo state / counts
git rev-parse HEAD                         # 4bd198814f92e6eda460c37c2b24b4d0e6b41cd2
git ls-files                               # 1926
git ls-tree -r --name-only 686d7b6 | Measure-Object      # 2096 (pre-.t4scratch removal)
Test-Path .t4scratch                       # False
(Select-String scripts\rapidtool-cli.mjs -Pattern 'case "').Count   # 39

# capability truth
node scripts/rapidtool-cli.mjs doctor      # autonomousSoftwareFactory:false; sandbox:false; MCP disabled
node scripts/rapidtool-cli.mjs doctor --tree "research/eval-out/coffeehouse2home-property-ledger--trial-1"
                                           # {stubs:1, reexports:4, real:0}

# keyless journey (scratch; no --live => no model calls)
node scripts/rapidtool-cli.mjs create --brief "…" --out %TEMP%\rt344_v2\proj.json
node scripts/rapidtool-cli.mjs gate --project …        # exit 2, parked P4
node scripts/rapidtool-cli.mjs approve --project … --seat autopilot   # decidedBy:"autopilot"
# … loop -> P7 hard-DoD stall, RT_E_GATE_PENDING, sealedWithFailures:true
node scripts/rapidtool-cli.mjs emit --project … --run  # exit 0; declaredScriptsVerified:true; substance stubs:1 real:0

# verifier forgery (B1 / A2-F1)
node --experimental-strip-types %TEMP%\rt344_v2\probe-forge.mjs   # throw -> pass:false; +timer -> pass:true
node --experimental-strip-types %TEMP%\rt344_v2\probe-forge2.mjs  # PLAIN pass:false / FORGE_NO_THROW pass:true

# A4 re-derivations
node node_modules/typescript/bin/tsc -p tsconfig.scripts.json --noEmit   # exit 0
node scripts/check-module-coverage.mjs        # 110/126 · 16 allowlisted · 0 unallowlisted · 0 stale
node scripts/check-assertion-gaps.mjs         # clean — 136 test files, 0 findings
node scripts/run-eval.mjs                     # exit 2 (bare-run refusal, no keyed call)
node --test --test-reporter=tap scripts/README-cli.test.mjs          # 12/12
node --test --test-reporter=tap scripts/check-assertion-gaps.test.mjs # 30/30
grep -rn "assertSameSiteRequest" …            # wired at app-data/client.server.ts:4,202

# UI (Playwright against the lane-held 127.0.0.1:8080 instance)
%TEMP%\rt344_v2\probe-ui.mjs      # /, /run/does-not-exist, /unknown — no page errors; #main-content present
%TEMP%\rt344_v2\probe-run.mjs     # 11 tab triggers (3 primary + 8 via "More panels"); 0 console errors
```

*Written by validator V2. No source/test/config/doc/other-log file was modified; the only write is this
file (plus scratch under `%TEMP%\rt344_v2\` and one gitignored `.rapidtool/logs` telemetry row per CLI
call).*
