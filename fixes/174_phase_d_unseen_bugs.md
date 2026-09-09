# 174 — UNSEEN BUGS + COMPETITOR DELTAS (feed for 173 Phase F)

| Field | Value |
|---|---|
| **File** | `fixes/174_phase_d_unseen_bugs.md` |
| **Date / role** | 2026-09-09 · agent 174 (Grok 4.6) · unseen-bugs + web-research assistant |
| **Repo root** | `C:\Users\mnril\Desktop\RapidTool Main` (git-bash `/c/Users/mnril/Desktop/RapidTool Main`; **NOT git**) |
| **Audience** | Sibling `fixes/173_phase_d_reliability.md` (Phase F skeleton) and parent merging into 162. Local ids `174-1…`. |
| **Write scope** | **This file only.** READ-ONLY on `src/` + `scripts/`. Do **not** edit 162, 173, or any `src/`/`scripts/` (parent is mid-T0 on store/io/engine/headless). Do **not** touch vault/rt-client/bench/swarm (171). |
| **Method** | Grep from inside the repo (space in path breaks ripgrep tools). Competitor pages fetched 2026-09-09 via urllib+browser UA to `raw.githubusercontent.com` / `r.jina.ai` (Firecrawl `web_search` gated). |

> **Honest limits.** Disk is truth at read time; T0 edits may move lines ±20. Every `file:line` was grepped this pass — re-grep before any patch. This document does **not** re-litigate 162 C1–C6 / T0.1–T0.6 / A0 tree assembly, 165A Wild-pause UI, 167A OS-sandbox absence, 168A memory injection, or 169A upload. Those are known. 173 already owns characterization/mutation methodology and the "`.env` sourced in the gate shell flips `enforceDod`" class. Findings below are **orthogonal** to that skeleton.

---

## 0. TL;DR

The honesty contract can still lie in ways 155–170 and 173 will not catch, because they audit *features* and *test methodology*, not the **agent-using-the-CLI-to-ship** path or the **generated-code child** that actually executes the artifact.

**Highest-leverage unseen defects (do these first in Phase F, after A–E):**

| Id | One-liner | Class | Why 173 misses it |
|---|---|---|---|
| **174-1** | `startWildRun` / `deepenResearch` / `runVerifyAsync` are **not** on `serialized(id)` — `executeAsync` can roll `wildRun` back to a stale snapshot | Race | 173 F-items pin T0.3 dodBlocked, not the wild/execute overlap |
| **174-2** | `tryStartWild` latch taken, then early-return without `releaseWildStart`; Node has **no** `window.setTimeout` auto-expiry | Race / swallow | 173 F-20 hunts empty `catch{}`, not a latch leak |
| **174-3** | CLI `wild --pause/--resume/--step` hydrates first → force-stops the run → then operates on a corpse | TOCTOU | 163/165 treated hydrate-stop as UI honesty; CLI verbs are a **lie** |
| **174-4** | `emit` overwrites files in place, **never deletes leftovers**; `treeRun` then executes ghost `tests/*.spec.ts` | Emit vs tree-run | 173 F-11 is hash reconciliation, not stale-file execution |
| **174-5** | `scrubbedEnv()` copies **all** `process.env` except proxy keys — `DEEPSEEK_API_KEY` lands in the generated-code child | Secret leak | 173's "key leak" is *gate-shell keyed/keyless flip*, not child-env exfil |
| **174-6** | `treeRun` inner `spawnSync` has **no `cwd`**; `cpSync`/`mkdtempSync` imported and **never called** | Partial impl + cwd | Looks like isolation was designed; the live emit dir is still the subject |
| **174-7** | `emit --run/--check` exits 1 with **no** `RT_E_TREE_RUN_FAILED` / `RT_E_CHECK_FAILED` | Missing RT_E | tree-run/check verbs have the codes; emit's flags do not |
| **174-8** | Default out dir is `<home>/RapidTool Software/<slug>/` — **space in the path**, zero CLI tests | Windows/MSYS | Agents copy the documented path unquoted |

**Phase F competitor deltas (small, high-leverage, not 167A-1 Docker):** secret-strip-before-exec (Codex cloud), post-hoc path allowlist+rollback (SSSF `permissions.enforce`), PreToolUse deny hook (Claude Code), stdout secret redaction (OpenHands), `run.finish(accepted=)` single writer (SSSF — 173 cites the rule, does not wire a RapidTool equivalent on emit/wild).

---

## 1. Explicitly NOT in this document (coordinate, don't rebuild)

- 162 C1–C6 fixture semantics, T0.1–T0.6 store/io/headless foundation, A0 IIFE→modules.
- 165A-1…11 console Wild-pause chip, green-banner failures, Archive=delete.
- 167A-1 OS sandbox, 167A-2 token ledger, 167A-3 event-stream resume, 167A-8 `verifyClaims` unwired.
- 168A memory pin / chat compact; 169A codebase ingest; 171 vault/rt-client/bench/swarm.
- 173 F-01…F-14 characterization of the T0/A seams; F-20 empty-catch census; SWE-bench withheld-grader methodology.

If a 174 item looks adjacent, the *mechanism* is different. Call it out in the row.

---

## 2. Race / TOCTOU (persist vs async, wild vs hydrate, emit vs tree-run)

### 174-1 — Wild driver vs `executeAsync`: last committer wins on `wildRun`

- **BUG.** `serialized(id)` exists specifically so overlapping async actions cannot both compute from the same snapshot (`store.ts:169-179`). Call sites this pass: `executeAsync` (:1235), `runUntilHitlAsync` (:1266), `runModuleReal` (:1326), `rejectAsync` (:1534). **`startWildRun` (:973), `deepenResearch` (:854), `runVerifyAsync` (:867) are not wrapped.**
- `rebaseUserFields` (`store.ts:233-252`) deliberately does **not** copy `wildRun` from live — "the wild driver commits each step's OWN wildRun" (`store.ts:229-231`). That is correct **inside** the wild loop. It is fatal when `executeAsync` finishes mid-wild: the execute snapshot's `wildRun` (usually null/inactive) is spread onto the live project and the in-flight driver is silently rolled back. `commitWild`'s `rebaseConcurrentEngine` is not invoked on the execute path.
- **WHY it fails the honesty contract.** A paused-or-active wild run can vanish without a `wild.stop` log because a single-phase step settled later. The operator sees "run stopped after reload" copy (165A-4) for a stop that was a race, not a reload.
- **FIX (type-level).** Wrap `startWildRun` / `deepenResearch` / `runVerifyAsync` in `serialized(id, …)` OR teach `executeAsync`'s commit to union `wildRun` from live when `live.wildRun?.active === true`. Do not put this in T0.3 (dodBlocked) — different predicate.
- **TEST.** Start wild, pause at HITL, fire `executeAsync` from another caller, assert `wildRun.active` still true and `startedAt` unchanged.

### 174-2 — `tryStartWild` latch leak on every early return; Node never auto-expires

- **BUG.** `startWildRun` calls `tryStartWild(id)` at `store.ts:976` **before** the project/mode/active/complete guards (`:986, :994, :1008, :1019`). `releaseWildStart` lives only in the driver-loop `finally` (`:1114-1117`). A missing project, `wildMode !== true`, already-active unpaused run, or `status==="complete"` returns **without** release.
- `tryStartWild` (`rt-client.ts:367-377`) auto-expires via `window.setTimeout(..., WILD_START_LATCH_MS=8000)` **only when `typeof window !== "undefined"`**. Under Node (tests, any future headless store driver) the latch is a single global `{projectId, at}` (`:364`). After 8s the *next* `tryStartWild` for the **same** id overwrites it (the `< 8000` check fails); a second click inside 8s is refused with `RT_E_PHASE_ILLEGAL` "already in flight" even though nothing is in flight.
- Starting wild on project B **overwrites** project A's latch (`:378`). A's `finally` then no-ops (`releaseWildStart` checks `latch.projectId === A`). A's double-start protection is gone mid-run.
- **TEST.** `startWildRun("missing")` then immediately `startWildRun(realId)` must succeed. `startWildRun` on a complete project (`ok:true, ran:0` — see 174-11) must not block a subsequent start on a different in-progress project.

### 174-3 — CLI `wild` hydrates, force-stops, then claims to pause/resume/step

- **BUG.** `hydrateWildRun` (`engine.ts:1932-1964`) force-stops any persisted `active:true` run: "the driver loop is a session artifact and dies with the page." That is honest **for the browser**. The CLI `wild` verb (`rapidtool-cli.mjs:1669-1751`) always `loadProjectFor` → `importProject` → `hydrateProject` **before** dispatching. It peeks the raw file only to attach `priorRunNote` (`:1692-1701`) — then passes the **stopped** project to `wildPauseRun` / `wildResumeRun` / `wildStartHeadless`.
- `wildStartHeadless` (`headless.ts:2571-2578`) refuses `not-active`. `wildPauseRun` (`:2800-2803`) refuses `not-active`. So `wild --pause`, `wild --resume`, and bare `wild` (step) are **dead verbs** across process boundaries. Only `wild --start` works, and it always starts **fresh** (`wildStartRun` `:2735-2740` refuses already-active — which hydrate just made false, so `--start` after a crash silently begins a new epoch).
- The CLI comments admit this (`:1689-1691`, audit-77) and paper over it with a note. An agent following `scripts/README-cli.md` will `--start`, then `--pause` in a second process, get `RT_E_PHASE_ILLEGAL` / `not-active`, and conclude Wild Mode is broken.
- **FIX.** CLI load path for `wild --pause|--resume|--step` must **not** run `hydrateWildRun`'s force-stop (a `resumeAcrossProcess: true` flag, or peek-raw + skip hydrate of `wildRun`). Persist a durable checkpoint (173 F-item adjacent; this is the *CLI contract* hole). `--start` after a force-stop should refuse or take `--force` rather than silently mint a new `startedAt`.
- **TEST.** `wild --start` → persist `active:true` → new process `wild --pause` → `changed:true`, same `startedAt`. Today this is red. `store.test.ts:1498` currently **pins the opposite** (174-10).

### 174-4 — `emit` does not wipe; `treeRun` executes leftover specs

- **BUG.** `emitProject` (`headless.ts:1045-1066`) `mkdirSync` + `writeFileSync` per scaffold file. CLI emit (`rapidtool-cli.mjs:678-697`) snapshots `preExisting` and warns "overwritten in place … nothing was merged" — but files **not in the new scaffold stay on disk**. `treeRun` (`compile-check.server.ts:614-616`) walks **every** `tests/*.(spec|test).*` under the dir.
- **TOCTOU with a concurrent `tree-run --dir` on the same folder:** emit is writing file N of M while treeRun is compiling/running a mix of old and new. No flock (`grep flock/lockfile` over `src/lib` + `scripts/*.mjs` = empty except unrelated EPERM tests). `saveProject` (`headless.ts:72-88`) is write-tmp-then-`renameSync` with no lock either — two `run`/`wild --start` processes last-write-win the JSON.
- **WHY Phase A makes this worse.** A0 multi-file trees + A2 `tests/brief.spec.ts` mean a second emit of a *different* kind leaves the previous kind's specs. `treeRun.ok` can go red on a ghost, or stay green on a leftover passing oracle that no longer maps to the brief (honesty: green for the wrong software).
- **FIX.** Emit writes to a staging dir then `renameSync` the tree (or delete paths not in the new manifest). `treeRun --project` already has `dirDirty` hashes — refuse to run when the listing has files not in `generatedTree`. File-lock `project.json` around load/mutate/save.
- **TEST.** Emit kind=webapp into a dir that already has `tests/old.spec.ts` that `assert.fail()`s → without wipe, `emit --run` is red; after wipe, green-or-honest-skip. Concurrent two `saveProject`s: loser must error, not silently clobber.

### 174-13 — `saveProject` has no exclusive lock (CLI multi-process)

Covered in 174-4. Split out so 173 can schedule it independently: `headless.ts:72-88`. Windows AV holding `project.json` open turns `renameSync` into a thrown EPERM that the CLI maps to `RT_E_INTERNAL` rather than a retryable `RT_E_VALIDATION`. `scripts/write-atomic.mjs` already handles `EXDEV`; `saveProject` does not use it.

---

## 3. Error swallowing / missing RT_E / ok:true on failure

### 174-7 — `emit --run` / `emit --check` omit the codes the dedicated verbs have

- **BUG.** `tree-run` sets `payload.code = "RT_E_TREE_RUN_FAILED"` (`rapidtool-cli.mjs:826`). `check` sets `RT_E_CHECK_FAILED` (`:1063`). `emit --check` and `emit --run` (`:736`) set `payload.ok = false` + prose `error` and **never** set `code`. `respond()` then classifies from prose (`:113-127`); `"N of M emitted files failed compile-check"` / `"spec foo: fail"` does not match ENOENT/timeout/report-rejected → `code` omitted or `RT_E_UNKNOWN`.
- An agent branching on `code` treats emit-red as unclassifiable. The dedicated verbs work; the flags an agent will actually combine (`emit --out … --run`) do not.
- **TEST.** Fixture tree with one failing spec: `emit --run` JSON has `code:"RT_E_TREE_RUN_FAILED"` and `exit_code:1`. Same for `--check` → `RT_E_CHECK_FAILED`.

### 174-11 — `wildStartRun` on a complete project: `ok:true` **and** `error:`

- **BUG.** `headless.ts:2742-2750` returns `{ ok: true, changed: false, outcome: "noop", steps: 0, error: "Project already complete — no wild run started." }`. CLI then `respond({ ok: true, … error }, 0)` (`rapidtool-cli.mjs:1719-1740`). Store `startWildRun` on complete is `{ ok: true, ran: 0, stoppedReason: "complete" }` (`store.ts:1019`) — and that path **leaks the latch** (174-2).
- Sync `execute` documents the opposite contract: "ok requires progress … 0 iterations reports ok:false" (`store.ts:1223-1229`). Wild and execute disagree. An agent that checks `ok` will persist a no-op as success.
- **FIX.** `ok:false`, `reason:"complete"`, `code:"RT_E_PHASE_ILLEGAL"`, exit 1 (or exit 2 parked). Do not dual-channel `ok` and `error`.

### 174-12 — Store async actions drop `code` on "Project missing"

`executeAsync` (`store.ts:1238`), `deepenResearch` (`:856`), `runVerifyAsync` (`:869`) return `{ ok: false, error: "Project not found." }` with **no** `code`. The CLI layer adds RT_E; the console does not. 165A covered green banners, not this. Pair with 174-1 (deepen not serialized).

### 174-18 — `defaultOutputDir` empty catch

`rapidtool-cli.mjs:328-334`: `mkdirSync(home/RapidTool Software/…)` failure is swallowed (`catch {`) and silently falls back to `resolve(slug)` in **CWD**. An agent in `RapidTool Main` (space) then emits into a CWD-relative folder with no `warning` field. Contrast emit's loud `overwritten` flag. Log + include `fallback:true` on the envelope.

---

## 4. Windows / MSYS path bugs still live

### 174-8 — Default deliverable path contains a space; no test; argv vs shell

- **BUG.** `defaultOutputDir` (`rapidtool-cli.mjs:313-327`) is `join(homedir(), "RapidTool Software", slug, …sub)`. The product *documents* a space. `parseArgs` (`:64-92`) takes the next argv token as `--out`/`--dir`/`--project` value — Node's argv is already split, so **quoted** paths work. Unquoted MSYS/cmd:

  ```
  --out C:\Users\mnril\RapidTool Software\hvac-dispatch
  ```

  sets `--out` to `C:\Users\mnril\RapidTool` and pushes `Software\hvac-dispatch` onto `args._`. `--dir` whose next token starts with `--` becomes boolean `true` (`:80-81`).
- Repo root itself is `RapidTool Main` (space). `spawn(process.execPath, ["--check", file])` (`compile-check.server.ts:80`) is argv-safe. Shell-using helpers are not: `with-app-env.mjs:119` sets `shell: useShell` on win32 for bare commands.
- **ABSENT:** any `scripts/*.test.mjs` or `headless.test.ts` asserting a path with a space (grep `RapidTool Software` / `space` in those tests = 0 hits on the CLI parser).
- **FIX.** Prefer `--out=` equals-form in USAGE; if `args.out === true`, error `RT_E_VALIDATION` "missing value, quote paths with spaces". Add a test that round-trips `join(tmpdir(), "Rapid Tool Out", "x")`.
- **TEST.** `emit --project <file> --out <tmpdir>/dir with space` writes files; `tree-run --dir` same path is green/red honestly.

---

## 5. Test pins that lock in bugs

### 174-9 — `skip` counts as `treeRun.ok === true`

`compile-check.server.ts:623-625`: `entryGreen = pass OR skip`; `ok = compile.ok && specsGreen && entryGreen`. Pinned by `compile-check.server.test.ts:303`: `"skip counts green — compile pass + nothing red"`.

162 A3 wants a `.ts` data-entry to be executed and to fail the tree when it misbehaves. This pin will **fail the A3 patch** or, if left, keep UI-shells (and any unresolved entry) scoring as a green tree. Phase F must recast the pin: `run==="skip"` is honest **and** `ok` requires `dataEntry` when a headless `.ts` entry exists (A3). Do not delete the skip-is-honest assertion; split `ok` from `skip`.

### 174-10 — Hydrate-stop "never resume" is pinned as the product

`store.test.ts:1498-1517`: `"startWildRun starts FRESH, never resumes the dead session"` after `hydrateProject`. That is the correct **browser** invariant. Combined with 174-3 it makes a CLI resume **impossible to implement without breaking this test**. Phase F should split the pin: `hydrateProject` (browser rehydrate) vs `loadProjectForWild(resume=true)` (CLI). Otherwise 173's "durable run journal" item will land and this test will force it to start fresh anyway.

---

## 6. Dead / partial implementations that look wired

### 174-6 — Isolation imports in `compile-check.server.ts` are dead; inner test spawn has no cwd

- **Evidence this pass.** `compile-check.server.ts:24` imports `cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync`. Counts: `cpSync=1`, `mkdtempSync=1`, `rmSync=1`, `tmpdir=1`, `basename=1`, `dirname=1` (the import line only). Lint is 0 — unused-import is not a gate. The *shape* says "copy emit dir to temp, run there, delete". The *body* walks the **live** dir (`treeRun:604-616`) and runs specs via `runNodeBounded(specRunnerCode(abs))`.
- `specRunnerCode` (`:336-361`) `spawnSync(process.execPath, ["--test", spec], { encoding, timeout, maxBuffer, windowsHide })` — **no `cwd`, no `env`**. Outer `runNodeBounded` uses a scratch temp cwd (`node-runner.server.ts:158`) + `scrubbedEnv()` (174-5). Inner `node --test` therefore:
  1. Inherits the secret-full env.
  2. Sees `process.cwd()` = scratch temp, **not** the emit dir.
- A2's `tests/brief.spec.ts` that `readFileSync("tests/fixtures.brief.json")` (cwd-relative) will fail on a green module; one that uses `import.meta.url` will pass. 162 A2 does not specify which. Generated code that `writeFileSync(new URL("./pwned", import.meta.url))` mutates the artifact under test (the purity test at `compile-check.server.test.ts:309-317` only asserts the *harness* writes nothing).
- **FIX.** Wire the dead imports: `cpSync` emit dir → temp, `cwd: copyDir` on both outer spawn and inner `spawnSync`, `rmSync` after. Fail the tree if the copy's listing diverges. Pin A2 specs to `import.meta.url` (never cwd).
- **TEST.** Spec does `assert.equal(existsSync("package.json"), true)` with cwd=emit copy. Spec that writes next to itself: copy is discarded, live emit listing unchanged.

### 174-14 — `FORBIDDEN` denylist is template-only; `treeRun` is full Node

`sandbox.ts:12-16` bans `process|require|fetch|eval|…` for the **sync engine-template** path (`runGenerated`). `runSandboxed` has zero product callers (known; do not rebuild). `treeRun` executes emitted specs with stock Node — `node:fs`, `node:child_process`, `node:net` are all legal. The denylist that looks like a security control does not apply to the path that actually runs LLM-authored trees. Beyond 167A-1's "not a sandbox" caveat: even a *lexical* gate is absent on the production executor.

---

## 7. Generated-code execution security (beyond "not a sandbox")

### 174-5 — Child env is a copy of the host, minus proxy

- **BUG.** `scrubbedEnv` (`node-runner.server.ts:81-96`) copies **every** `process.env` key except `http(s)_proxy` / `all_proxy` / `no_proxy` / `npm_config_*proxy*`, then pins empty `HTTP(S)_PROXY` + `NO_PROXY=*`. Comments call this "scrubbed child env" (`:11`). What actually reaches LLM-authored `node -e` / `node --test`:
  - `DEEPSEEK_API_KEY`, `DATABASE_URL`, `npm_config_//registry.npmjs.org/:_authToken`
  - `NODE_OPTIONS` (inner `spawnSync` will honor `--require` / `--inspect` from the host)
  - `USERPROFILE`, `PATH`, `SSH_AUTH_SOCK`
- No test asserts a secret is **absent** from the child (grep `scrubbedEnv` / `API_KEY` in `node-runner` tests = 0).
- **Competitor delta.** Codex cloud: "Secrets configured for cloud environments are available only during setup and are **removed before the agent phase starts**."[2] Local CLI: network **off by default**; `workspace-write` keeps network off unless `[sandbox_workspace_write] network_access = true`.[2] Windows elevated sandbox: dedicated lower-privilege users + firewall; unelevated uses "environment-level offline controls".[3] RapidTool's proxy-emptying is not that.
- **FIX.** Allowlist: `PATH`, `SystemRoot`/`WINDIR`, `TEMP`/`TMP`, `USERPROFILE` (or a fake), `LANG`. Never copy `/(_)?(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i` or `NODE_OPTIONS`. Drop `DEEPSEEK_*`. Document the allowlist next to the existing honesty banner (`node-runner.server.ts:4-18`).
- **TEST.** Parent env has `DEEPSEEK_API_KEY=sk-test` + `NODE_OPTIONS=--require ./pwn.cjs`. Child code `process.stdout.write(String(!!process.env.DEEPSEEK_API_KEY)+process.env.NODE_OPTIONS)`. Assert `"falseundefined"` (or empty). Mutation: adding the key to the allowlist must fail the test.

### 174-15 — Artifact can exfil via stdout; no redaction

OpenHands ships a defensive redactor: `MASKED_PLACEHOLDER = "<secret-hidden>"` applied to any unmasked value inside `<CUSTOM_SECRETS>` before UI display.[6] RapidTool's runner returns up to 1 MB of stdout (`node-runner.server.ts:40-42`) into CLI JSON and the "Real module run" artifact (`store.ts:1334-1336`). Generated code `console.log(process.env.DEEPSEEK_API_KEY)` (174-5) or `readFileSync("%USERPROFILE%/.ssh/id_rsa")` lands in the packet. Phase F: redact known env values from runner stdout/stderr before persist (even after the allowlist, as a backstop).

---

## 8. Competitor techniques RapidTool still lacks (fetched, not remembered)

Fetched this pass (raw GitHub + r.jina.ai). 167A already owns OS-sandbox / cost / event-stream. These are the **next** slice.

| # | Technique | Source (fetched) | RapidTool today | Steal class |
|---|---|---|---|---|
| 1 | Secrets exist for setup, **stripped before the agent/exec phase**; network off by default | Codex approvals doc[2] | 174-5 copies the whole env | Pattern (docs); implement zero-dep allowlist |
| 2 | Windows elevated vs unelevated sandbox + private desktop | Codex Windows sandbox[3]; Seatbelt/bwrap on other OS[1] | Honesty banner only (`node-runner.server.ts:4-18`) | Pattern; 167A-1 owns the OS boundary — do not duplicate. Use **secret-strip + cwd-copy** as the Windows-cheap subset |
| 3 | Post-hoc **path allowlist**: snapshot git tree, rollback unauthorized writes, raise `PermissionBreach` | SSSF `permissions.py` `enforce()`[5] | `treeRun` purity test only checks the harness | **Code-steal candidate** (check LICENSE on disler/sssf before copying; otherwise recode the 80-line snapshot/rollback) |
| 4 | `run.finish(accepted=)` — exit code, session status, banner **cannot disagree**; a red test phase can still "succeed at its job" | SSSF SKILL.md rule 10[4] | 173 cites this as F's governance primitive. **Unseen wiring:** `emit --run` ok=false without `code` (174-7); `wildStartRun` ok=true+error (174-11) | Pattern; wire one writer on CLI `respond()` |
| 5 | Gates validate **envelope claims vs disk**, not guesses (`diff_matches_claims`, `verdict_consistent`) | SSSF `gates.py`[11] | `verifyClaims` unwired (167A-8). New: emit leftover files (174-4) make disk≠claim | Pattern |
| 6 | `PreToolUse` hook can `permissionDecision: "deny"` (example: block `rm -rf`) | Claude Code hooks[7] | `runModuleReal` / `treeRun` have no pre-spawn hook; 167A-4 noted missing ask/auto policy | Pattern |
| 7 | Permission modes `default` / `acceptEdits` / `plan` | Claude permissions[8] | HITL phases exist; no operator-level mode that makes `treeRun`/`runModuleReal` plan-only | Pattern |
| 8 | Lifecycle hooks + `allow_managed_hooks_only` in requirements.toml | Codex `docs/config.md`[10] | None | Pattern |
| 9 | Secret redaction in UI/logs as a **backstop** if backend masking regresses | OpenHands `redactCustomSecrets`[6] | 174-15 | Recode (~40 lines) |
| 10 | MetaGPT: `--no-implement` / `--code_review` as first-class CLI modes | MetaGPT usage.md[9] | `create --advisory` is the closest; no "plan-only emit" that refuses `treeRun` | Pattern |

SSSF rule 10 quote (verbatim from fetched SKILL.md): *"phases passing is not the same as the run being accepted. A test phase that ran a red suite succeeded at its job. Pass `accepted=` so the exit code, the session status, and the banner are decided together and cannot disagree."*[4]

SSSF `enforce` quote: *"Detection alone would leave the repo holding the unauthorized change while reporting a failure, so anything the agent introduced outside its allowlist is rolled back before the phase dies."*[5]

Codex cloud quote: *"Secrets configured for cloud environments are available only during setup and are removed before the agent phase starts."*[2]

---

## 9. Ranked Phase-F improvements (after A–E) — 8 small high-leverage items

These are **not** 173's F-01…F-14 (those characterize T0/A). Cross-link as `174-F1…`. Each is independently patchable; none edits 162 C1–C6 / T0 / A0.

### 174-F1 — Child-env allowlist (from 174-5)

- **What.** Replace `scrubbedEnv` copy-all with an allowlist; strip `/KEY|TOKEN|SECRET|PASSWORD|NODE_OPTIONS/`.
- **Why.** Codex removes secrets before the agent phase[2]. A green `treeRun` that printed the key is a factory-level honesty failure, not a "not a sandbox" footnote.
- **Where.** `src/lib/node-runner.server.ts:81-96`; pass the same env into `specRunnerCode`'s `spawnSync` (`compile-check.server.ts:343-348`).
- **How.** Build `{ PATH, TEMP, TMP, SystemRoot, WINDIR, LANG, HOME/USERPROFILE→scratch }`. Unit-test without spawning by exporting `scrubbedEnv`.
- **Test.** 174-5 test. Mutation: allowlisting `DEEPSEEK_API_KEY` must fail CI.

### 174-F2 — Wire the dead copy-to-temp isolation (from 174-6)

- **What.** Use the unused `cpSync`/`mkdtempSync`/`rmSync` to run `treeRun` against a snapshot; set `cwd` on inner `spawnSync`.
- **Why.** A2 cwd-relative fixtures will be red for the wrong reason; generated specs can mutate the artifact they are grading.
- **Where.** `compile-check.server.ts:24` (already imported), `treeRun:604`, `specRunnerCode:343`.
- **How.** `const copy = mkdtempSync(join(tmpdir(), "rt-tree-")); cpSync(dir, copy, { recursive: true }); try { run on copy } finally { rmSync(copy) }`.
- **Test.** Spec writes `pwned.txt` next to itself → live emit listing unchanged. Spec `existsSync("package.json")` with cwd=copy → true.

### 174-F3 — Serialize wild/deepen/verify; latch `finally` on all returns (174-1, 174-2)

- **What.** `serialized(id)` around `startWildRun` / `deepenResearch` / `runVerifyAsync`. `releaseWildStart` in a `finally` that covers early returns. Expire the latch in Node via `setTimeout` (not `window`).
- **Why.** executeAsync mid-wild is a silent rollback of the autonomous loop 162 Phase D will advertise.
- **Where.** `store.ts:169-196, 854-867, 973-1118`; `rt-client.ts:366-382`.
- **How.** Move guards *before* `tryStartWild`, or `try { … } finally { release }` wrapping the whole function.
- **Test.** 174-1 and 174-2. Also: two projects' wild starts must not steal each other's latch.

### 174-F4 — Emit manifest wipe + `project.json` lock (174-4, 174-13)

- **What.** Emit to staging, replace tree; delete files not in the new manifest. `lockfile` around `saveProject`.
- **Why.** Ghost specs make the behavioral oracle (Phase A) grade the wrong software. Two CLI processes are the way an agent actually retries.
- **Where.** `headless.ts:72-88, 1045-1066`; CLI emit `:678-697`.
- **How.** Write `.<slug>.partial/` then `rmSync(target)` + `renameSync`. Lock via `open + exclusive` (Windows: `FILE_SHARE_NONE` / Node `wx` flag on `.lock`).
- **Test.** Pre-seed `tests/old.spec.ts` that fails; emit new tree without that file; `treeRun.ok` ignores it because it is gone.

### 174-F5 — CLI wild resume that does not hydrate-stop (174-3, 174-10)

- **What.** `loadProjectForWild` skips `hydrateWildRun` force-stop when the verb is pause/resume/step. Split the store test pin.
- **Why.** Otherwise 173's durable-journal item cannot be consumed by an agent (every CLI process is a "reload").
- **Where.** `engine.ts:1932-1964` (add an option, default stop=true for browser); `rapidtool-cli.mjs:1688-1718`; `store.test.ts:1498`.
- **How.** `hydrateWildRun(v, phase, { sessionBreak: boolean })`. CLI passes `false`.
- **Test.** 174-3. Browser pin remains: `hydrateProject(parked).wildRun.active === false`.

### 174-F6 — One `respond()` writer: `ok`, `code`, `exit_code` cannot disagree (174-7, 174-11)

- **What.** SSSF `run.finish(accepted=)`[4] applied to RapidTool CLI: `ok:false` always has an `RT_E_*`; `ok:true` never carries `error`; emit flags reuse the dedicated codes.
- **Why.** 173 wants this as governance. The unseen holes are emit-flags and wild-complete.
- **Where.** `rapidtool-cli.mjs:respond 111-127`, emit `:699-739`, wild `:1719-1740`, `headless.ts:2742-2750`.
- **How.** `respond` asserts `ok===false ⇒ code`; `ok===true ⇒ !error`. Fail loud in tests if a verb violates it (lint-as-test over the case bodies).
- **Test.** Walk every verb's failure fixture; snapshot `code` presence. `wild --start` on complete → `ok:false`, `RT_E_PHASE_ILLEGAL`, exit 1.

### 174-F7 — Pre-spawn hook + stdout redaction (174-14, 174-15, Claude/OpenHands)

- **What.** Before `runNodeBounded` / `treeRun`, run an optional project hook (Claude `PreToolUse` deny[7]). After, redact any remaining allowlisted-secret values from stdout (OpenHands backstop[6]).
- **Why.** Lexical `FORBIDDEN` does not apply to `treeRun`. A `plan` permission mode[8] should make `emit --run` refuse with `RT_E_PHASE_ILLEGAL` instead of spawning.
- **Where.** `node-runner.server.ts:115`; `store.ts runModuleReal:1326`; new `src/lib/hooks.ts` (pure).
- **How.** Hook = optional `.rapidtool/hooks/pre-run` argv list, timeout 2s, non-zero = deny. Redact by replacing exact values of stripped keys if they still appear (defense in depth).
- **Test.** Hook script `exit 2` → runner `{ok:false, reason:"refused", code:RT_E_VALIDATION}` and **no** child spawn. Stdout containing a planted token is replaced with `<secret-hidden>`.

### 174-F8 — SSSF-style write-set rollback on the emit copy (174-6 + [5])

- **What.** Snapshot the copy's listing before specs; after, any path not in the snapshot and not under `tests/.rapidtool-scratch/` is rolled back and fails the tree with `RT_E_TREE_RUN_FAILED` "spec mutated the tree".
- **Why.** SSSF rolls back unauthorized writes before the phase dies[5]. RapidTool currently grades a tree the spec may have just rewritten.
- **Where.** `compile-check.server.ts treeRun` after 174-F2's copy exists.
- **How.** Recode `snapshot`/`changed_paths`/`_roll_back` (~80 lines, zero-dep). Do not vendor SSSF until LICENSE is verified this wave (not fetched).
- **Test.** Spec `writeFileSync("src/generated.ts", "export default 1")` → tree `ok:false`, live (and copy-after-rollback) bytes equal the pre-run snapshot.

**Do 174-F1 → F3 → F6 first** (secrets, races, envelope honesty). F2/F4/F5/F8 need A0/A2 to matter; F7 is the Claude-shaped operator control 167A-4 sketched but did not pin to `treeRun`.

---

## 10. Agent-using-the-CLI failure modes (the other hat)

An agent trying to ship with this CLI, today:

1. `emit` (no `--out`) → writes under `~/RapidTool Software/<slug>/`. Agent then `tree-run --dir ~/RapidTool Software/<slug>` **unquoted** → `--dir` is `~/RapidTool`, `Software/<slug>` is a positional (174-8).
2. `emit --run` red → JSON has no `code` (174-7). Agent retries `repair --dir` on a dir that still contains the previous kind's failing spec (174-4).
3. `wild --start` then a second process `wild --pause` → `not-active` (174-3). Agent `--start` again, mints a new epoch, double-advances phases.
4. `run` (execute) while the UI wild loop is up → wildRun clobbered (174-1).
5. Generated tests print `process.env` → key in `build.json` artifacts and NDJSON logs (174-5, 174-15).

None of these are "the floor is a no-op" (155) or "fixtures don't exist" (162 A). They are why a factory that *has* fixtures still cannot be operated by an agent.

---

## Appendix A — file:line verification (this pass)

| Anchor | Pattern (must still match) |
|---|---|
| `src/lib/store.ts:169-179` | `serialized` / `LAST committer wins` |
| `src/lib/store.ts:854,867,973,1235` | deepen / runVerifyAsync / startWildRun / executeAsync |
| `src/lib/store.ts:976,1019,1114` | `tryStartWild` / complete early return / `releaseWildStart` finally |
| `src/lib/store.ts:229-231,233-252` | wildRun not copied in `rebaseUserFields` |
| `src/lib/rt-client.ts:357-377` | `releaseWildStart` / `WILD_START_LATCH_MS` / `window.setTimeout` |
| `src/lib/engine.ts:1932-1964` | `hydrateWildRun` force-stop |
| `src/lib/headless.ts:72-88` | `saveProject` write-then-rename, no lock |
| `src/lib/headless.ts:1045-1066` | `emitProject` writeFileSync, no wipe |
| `src/lib/headless.ts:2571-2578,2742-2750,2800-2803` | wildStartHeadless not-active / complete ok:true+error / pause not-active |
| `src/lib/compile-check.server.ts:24,336-361,604-625` | dead `cpSync` import / specRunnerCode spawnSync / skip counts green |
| `src/lib/compile-check.server.test.ts:303` | `"skip counts green"` |
| `src/lib/store.test.ts:1498` | `"starts FRESH, never resumes"` |
| `src/lib/node-runner.server.ts:4-18,81-96,158-164` | honesty banner / `scrubbedEnv` / spawn cwd+env |
| `src/lib/sandbox.ts:12-16` | `FORBIDDEN` template denylist |
| `scripts/rapidtool-cli.mjs:64-92,313-334,736,826,1669-1751` | parseArgs / RapidTool Software / emit `--run` (no `code`) / `RT_E_TREE_RUN_FAILED` on `tree-run` only / wild hydrate |

Re-run: `grep -n` the pattern in the file before patching. Parent T0 may have moved store.ts.

---

## Appendix B — merge notes for 173 / parent

- **Local ids stay `174-*` / `174-F*`.** 173 uses `F-01…` for methodology items. Do not collide. Parent merge: 174-F1…F8 become Phase F *implementation* tickets *after* 173's characterization gates, or as a parallel "F-ops" lane.
- **173 already said** "leak the key into the suite" meaning *gate shell sourced `.env` flips keyed tests*. Keep that. 174-5 is *child process.env*. Both must exist.
- **173 F-20 empty-catch census** will see `defaultOutputDir`'s `catch {` (174-18) and `scrubbedEnv` is not a catch. Don't let the census close 174-5.
- **Do not start these while T0 is mid-edit on store.ts.** 174-F3 patches the same file as T0.3. Sequence: T0 green → 174-F3.
- **171 owns** vault/rt-client/bench/swarm. 174-2's latch lives in `rt-client.ts` — that is the *one* 171 file this lane must touch, or export a `releaseWildStartOnReturn` seam and let 171 land it. Flag for parent: **collision on `rt-client.ts`**.
- Scratch fetches lived in `C:\Users\mnril\174-web\` (not the repo) and should be deleted after merge; they are not deliverables.

---

## Sources

Fetched 2026-09-09 (urllib + browser UA; GitHub raw + r.jina.ai). Ledger: `ledger_174.json`.

[1] https://developers.openai.com/codex/concepts/sandboxing
[2] https://developers.openai.com/codex/agent-approvals-security
[3] https://developers.openai.com/codex/windows/windows-sandbox
[4] https://raw.githubusercontent.com/disler/super-simple-software-factory/main/.claude/skills/sssf/SKILL.md
[5] https://raw.githubusercontent.com/disler/super-simple-software-factory/main/.claude/skills/sssf/templates/adws/adw_modules/permissions.py
[6] https://raw.githubusercontent.com/OpenHands/OpenHands/main/src/utils/redact-custom-secrets.ts
[7] https://docs.anthropic.com/en/docs/claude-code/hooks
[8] https://code.claude.com/docs/en/permissions
[9] https://raw.githubusercontent.com/geekan/MetaGPT/main/docs/tutorial/usage.md
[10] https://raw.githubusercontent.com/openai/codex/main/docs/config.md
[11] https://raw.githubusercontent.com/disler/super-simple-software-factory/main/.claude/skills/sssf/templates/adws/adw_modules/gates.py
