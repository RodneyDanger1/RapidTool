# fixes/344_a4_process.md — auditor A4 (process · infra · config · docs · tests · deploy)

**Auditor:** A4. **Root:** `C:\Users\mnril\Desktop\RapidTool Main` (git `main`, HEAD `4bd1988`, clean
tree at audit start). **Host:** Windows + PowerShell; host Node v24.15.0; Node 22.23.2 at
`%LOCALAPPDATA%\hermes\node\node.exe`. **Posture:** READ-ONLY — no source/test/config/doc/other-log
edits; scratch under `%TEMP%\rt344_a4\`; **0 keyed calls**. Every finding below is a FINDING, not an
edit.

**Method actually run:** read every file in the slice (CLI + 39 `case "` arms, all `scripts/**`,
root config, `migrations/**`, `.github/**`, `.grok/app-env.json`, the root/CLI docs); ran the real
process read-only on a scratch project (`create` → `gate` → `emit --check` → `tree-run` →
`emit --run` → `unattended` → `doctor`; `--help`; bare `run-eval.mjs`; `check-module-coverage.mjs`;
`tsc -p tsconfig.scripts.json`); re-derived every doc count with `git ls-files`.

Headline: the process/infra layer is unusually hardened and honest. The remaining work is
**documentation drift** (the docs repeatedly describe pre-W45/pre-343 behaviour), a **real
unwired security chokepoint** (`authMiddleware`), and the **structural autonomous-factory gap** (no
scheduler/queue; delivery is a manual flag). No mock/fake/placeholder in the CLI or tooling was
found; the only literal unfinished markers in my slice are `TODO(R15-f05)` in `.prettierignore`
(F-16) and the intentionally-not-defined `ERROR_BUDGET`/allowlist texts.

---

## 1. Findings table

| id | class | `file:line` | sev | evidence | autonomous-factory impact | recommended fix | effort |
|---|---|---|---|---|---|---|---|
| **F-01** | security / wiring + docs-truth | `src/lib/auth/middleware.ts:28`; `src/lib/auth/isolation.server.ts:29`; `scripts/check-module-coverage.mjs:79`; `src/lib/chat.ts:20`, `verify.ts:35`, `exec.ts:41`, `crew.ts:155`, `research.ts:44`, `fixtures.review.ts:15`, `llm.ts:83` | **High** | `grep -rn authMiddleware src` returns only its own definition, its doc-comment example, and `verify.server.ts` prose — **zero real importers**. The 7 `createServerFn` sites mount no `.middleware([authMiddleware])`. `check-module-coverage.mjs` allowlist entry for `src/lib/auth/middleware.ts` says verbatim *"ZERO importers in this repo (its only import is its own doc comment at :12)"*. `isolation.server.ts:29` claims *"Enforced at the `authMiddleware` chokepoint"*. | An emitted app that enables sign-in has **no** wired auth/CSRF chokepoint on its server functions; the doc/comment asserts enforcement that the bytes do not provide. Direct autonomous-shipping safety risk. | Either mount `authMiddleware` on every per-user server fn (src slice — STOP-and-REPORT from mine), or strike the enforcement claim and document the real posture. Add a guard test that every per-user `createServerFn` carries the middleware. | M |
| **F-02** | docs/config hazard | `README.md:142-144`; `.env.example:14-16`; `scripts/README-cli.md:342-351` (contradicts `README-cli.md:74-118`) | **High** | `installRepoEnvKey` (`rapidtool-cli.mjs:624-670`) reads **`<cwd>/.env`** and installs it (W45·331-1). The three docs still say the CLI "does **not** read `.env` — export the variable in your shell". README-cli's own §"API key resolution" (74-118) says the opposite: `.env` wins over the process env. | Operators/agents mis-model credential precedence; same-file contradiction. Credential behaviour is exactly the class that must never be mis-documented. | Correct all three to the W45 rule (`.env` > process env; present-but-blank ⇒ keyless; `RT_E_LLM_KEY_SHADOWED`), and cross-link §API key resolution. | XS |
| **F-03** | docs-truth (taxonomy) | `README.md:133`, `README.md:563`, `AGENTS.md:30` | Medium | CLI emits exit **2** (park — observed: keyless `gate` parked at P4, exit 2) and exit **5** (`--require-verified`, documented in `scripts/README-cli.md` §Agent contract). README/AGENTS say "0/1/2/3/4" (README) and "0/1/3/4" (AGENTS:30 — missing both 2 and 5). | An agent branching on the documented taxonomy reads a normal park as an unlisted failure. | State 0/1/2/3/4/**5** everywhere; fix AGENTS:30's "(0/1/3/4)". | XS |
| **F-04** | docs-truth | `README.md:226-228`, `README.md:280` | Medium | "No git landing / checkpoint-resume yet … not yet a shipped, pinned capability" is false: `emit --git` landed 343-3 (`fixes/343_3_delivery.md`; `rapidtool-cli.mjs:2205`; `git.server.ts:1565 gitLandEmitted`), and `resume`/`unattended` are REAL (W36; verified end-to-end — see §5). | Understates delivered capability; also internally contradicts README §7 which already marks checkpoint+resume REAL. | Rewrite limits #4 and the §7 "blocked" line; point to the delivery log. | XS |
| **F-05** | docs-truth | `scripts/README-cli.md:474-481`, `:1043-1055`; `AGENTS.md:77-79` | Medium | On HEAD `4bd1988`, a fresh keyless `emit --run` reported **`declaredScriptsVerified: true`, exit 0**; `tree-run`'s note reads *"the declared project scripts were resolved from the RapidTool repo's own node_modules/ (offline, no install)"*. The docs say *"Because a fresh scaffold has no node_modules, **every** fresh `emit --run` is unverified"* and present exit 5 as the everyday opt-in. | An agent that hard-codes "fresh emit ⇒ `unverified:true`" is wrong at this HEAD and will mis-handle the envelope. | State the conditional: verified when the declared scripts resolve from the repo's `node_modules`; `unverified` only when they cannot (then exit 5 is the opt-in). | S |
| **F-06** | deploy / docs-truth | `README.md:442-443` | Medium | `migrations/` contains **only** `auth/0001_auth.sql` + `auth/0002_account_unique.sql` (no top-level `.sql`). `migrate.mjs:39` uses a **non-recursive** `readdir`; `pendingMigrations` drops the `auth` dir → `length === 0` → *"[migrate] no migrations — nothing to do."* `errors.ts:570-577` documents that neither applier descends into `auth/`. So README's *"applied by `scripts/migrate.mjs` in `npm run build`"* is false; the real path is copy-up + the `RT_E_AUTH_SCHEMA_MISSING` preflight (which only fires when `VITE_AUTH_ENABLED !== "false"`). | A deployer following the README believes migrations apply in `npm run build`; in fact the auth schema is never applied unless copied up, and a deploy with auth on is refused (or silently schema-less when auth is off). | Correct README §10.3; add an explicit copy-up deploy step; consider asserting `DATABASE_URL`+auth-enabled ⇒ schema present. | S |
| **F-07** | docs-truth | `README.md:451` | Medium | Row says `tsconfig.scripts.json` has "error census = 1030 pre-existing". I ran `node_modules/typescript/bin/tsc -p tsconfig.scripts.json --noEmit` → **exit 0**; `typecheck-scripts.test.mjs`'s `ERROR_BUDGET` is empty and its header says the program is CLEAN. | Misstates the typecheck posture (the CLI is inside a clean program, not a 1030-error backlog). | Strike the "1030" clause. | XS |
| **F-08** | docs-truth (counts) | `README.md:560`, `README.md:538`, `README.md:477` | Medium | `README.md:560`: "`scripts/` (46 tracked = 24 tools + 22 tests)". Live: `git ls-files scripts` = **49**; 25 non-test tools + **24** `*.test.mjs`. §10.7's "Test suites (22):" list omits `check-module-coverage.test.mjs` and `typecheck-scripts.test.mjs`. `README.md:538` says "93 colocated test suites (`git ls-files src/lib \| grep -c '\.test\.'` = 93)" — that exact command returns **112**. `README.md:477` "213 files = 120 modules + 93 tests" vs live 239/123/112. | The catalog and "how it's verified" map are the artifact agents trust; wrong counts hide the two newest guards. | Re-derive counts (or make them generated); add the two missing suites to §10.7. | S |
| **F-09** | docs-truth (catalog totals) | `README.md:349`, `README.md:351`, `README.md:295-299` | Medium | `README.md:351`: "`git ls-files \| wc -l` = **1,908**". Live = **1926**. The 2026-10-03 (342-6) correction at `:295-299` claims "**2,096** … `.t4scratch/` is still **192 tracked files**" — but `Test-Path .t4scratch` = False and `git ls-files .t4scratch` = **0** (removed in `73f660a`). The correction is itself stale. | Stale totals repeatedly re-derived into new corrections; agents calibrate file ownership on wrong numbers. | Re-derive; record the `.t4scratch` removal as landed. | XS |
| **F-10** | docs-truth (RT_E table) | `scripts/README-cli.md:1143`, `:1147` | Medium | Row for `RT_E_GIT_UNAVAILABLE` says *"— (no live emitter today; landing tail unwired)"*; but `git.server.ts:242/303/723/776/905` emit it and it is wired to `emit --git` (`rapidtool-cli.mjs:2205`; `fixes/343_3_delivery.md` §6.6). Row for `RT_E_MCP_DISABLED` says *"— (owner-gated; no live emitter until the transport lands)"*; I **observed** the doctor emitting `RT_E_MCP_DISABLED` live, and `errors.ts:575-579` states the stdio transport IS implemented (`mcp.server.ts`). | The table is labelled "mirrors ERROR_CODE_DOC" but carries status notes the registry contradicts — misleads agents about which codes can actually fire. | Remove/replace both parentheticals with the registry truth. | XS |
| **F-11** | docs-truth (line refs) | `scripts/README-cli.md:30`, `:513-518` | Low | Both cite `rapidtool-cli.mjs:1184(-1195)` for the `emit --verify-kind` call; `grep` puts `verify-kind` at `rapidtool-cli.mjs:2076-2090`. Line 1184 is inside the `run`/`gate` arm (`saveProjectBusyAware`). | Pointless friction when an agent verifies the claim. | Update the refs or drop bare line numbers. | XS |
| **F-12** | docs-truth (count) | `scripts/README-cli.md:1246` | Low | §Tests says "leg 1 — the scripts suite (**21 contract suites**)". `(Get-ChildItem scripts -Filter *.test.mjs).Count` = **24**. | Understates the enforced surface. | Say 24 (or drop the number). | XS |
| **F-13** | docs-truth (status) | `START-HERE.md:96-101` | Medium | The "Shelled / in progress" list still names `unattended run (W-47)`, `checkpoint+resume (T-107.7)` and `MCP client (F1)` as shells. `unattended`+`resume` are REAL (W36; I drove keyless `unattended` to P12 complete), and the MCP stdio transport + doctor surface landed (340-1 / 342-5). The 2026-10-03 correction (`:175-181`) fixes only the counts + `unattended`. | The cold-start map tells a resuming agent three delivered capabilities are unfinished. | Refresh the list against `fixes/343_0_parent.md` and the doctor gaps. | S |
| **F-14** | config / `.env.example` drift | `.env.example:1-57`; `README.md:147` | Medium | Live knobs read in code but absent from `.env.example` (code-refs → 0 in the file): `RAPIDTOOL_MCP_ENABLED` (16), `RAPIDTOOL_MCP_SERVER` (11), `RAPIDTOOL_PROVIDER` (6), `P6_SYNTH_CANDIDATES` (25), `RAPIDTOOL_CASSETTE_MODE` (4), `RAPIDTOOL_BIND_ALL` (3). README `:147` claims `.env.example` "documents every knob". | Operators cannot discover the MCP gate, provider selection, best-of-N, cassette replay, or the LAN-bind opt-in from the template. | Add the missing rows; soften "every knob" or make it true. | S |
| **F-15** | process / infra | `vite.config.ts:160-164`; `fixes/343_0_parent.md` §6 | Medium | `server.strictPort: true` / `preview.strictPort: true` on fixed 8080/8081. `343_0_parent` records: *"the `strictPort` dev-server collision (a lane could not start a second `npm run dev`)"* — reported, not fixed. | Concurrent agent lanes collide on the fixed port; there is no dynamic-port escape, so parallel autonomous work stalls. | Honor `PORT` (or `--port`) while keeping the default, or document a strict single-server rule. | S |
| **F-16** | process / tooling | `.prettierignore:6-8` | Medium | The file carries `TODO(R15-f05): once the tree is formatted, add a `format:check` row (npx prettier --check src scripts) to scripts/gate.sh — today the formatter is shipped but never enforced.` `npm run format` exists; `gate.sh` has no format gate. | An agent running the shipped `format` script can rewrite the tree with no gate detecting drift; the TODO is a literal unfinished marker in my slice. | Add the `prettier --check src scripts` step (or remove `format` if it is not a contract). | S |
| **F-17** | process / CI | `.github/workflows/gate.yml:26-35`, `:73-92` | Medium | The workflow's own header states it has **never executed** and the ubuntu leg **cannot** catch the repo's Windows-path bug class; the `windows-leg` job is commented out. `node-version: "22.23.2"` is pinned "== the dev host (`node -v` → v22.23.2)" — but the dev host is **v24.15.0** now. | A green CI does not certify the host/Windows path handling; the "pin == dev host" comment is false. | Owner call: enable the Windows leg (or a targeted Windows-path job); correct the host-pin comment; assert the lockfile linux bindings (present: `package-lock.json:2309`). | M |
| **F-18** | autonomous-factory gap (product) | `scripts/README-cli.md:1004-1008`; `fixes/343_0_parent.md` §6; no scheduler in `src/lib` | **High** | No in-product scheduler/daemon/queue exists (`grep` for scheduler/daemon/cron in `src/lib` finds docs only). `unattended` is explicitly *"NOT a daemon — an external hook (Windows Task Scheduler / cron) invokes it on a cadence"*. Delivery (`emit --git`) is opt-in and is **not** invoked by `gate`/`unattended`. There is no multi-brief intake loop. | "Walk away and it ships" is not a shipped path: it requires an operator-authored host hook + a manual `emit`/`emit --git`, and processes one project at a time. This is the largest structural gap in my slice. | Ship a documented host-hook recipe + a `factory`/`watch` wrapper that drains a brief directory through `unattended` and then `emit --git`; or explicitly scope it out in the docs. | M–L |
| **F-19** | test-coverage debt | `scripts/check-module-coverage.mjs:50-91` | Medium | Guard output (ran): **110/126** `src/lib` modules reached, **16 allowlisted**, **0 unallowlisted**, 0 stale. The allowlist names the whole Better Auth surface (`auth/server.ts`, `client.ts`, `middleware.ts`, `use-current-user.ts`, `verify.server.ts`, `provider.tsx`, `gates.tsx`, `popup.server.ts`, `pglite-dialect.ts`, `gate-session.server.ts`), dormant `multiplayer/p2p.ts`, dead barrels `app-data/index.ts`, `multiplayer/index.ts`, `error-component.tsx`, `mcp/stub-server.ts`. | The security-critical auth surface has no node-drivable test; dormant/dead modules remain in-tree. The guard is honest (reasons per entry), but the debt is real. | Add behavioral tests where drivable; propose deletion of the dead barrels/p2p (owner call). | M–L |
| **F-20** | flakiness | `AGENTS.md:65-67`; `fixes/343_3_delivery.md` §7; `scripts/gate.sh:18-24` | Medium | Known load-sensitive child-spawn class: `exec.test.ts` grandchild (passes standalone), and 343-3's interim *"not ok 43 - landEmittedTree … # fail 2"* under concurrent load (two subsequent full runs green). `gate.sh --double` exists to catch flakes; latest gate-of-record `flakes:[]`. | Unattended/CI runs can flip a green to red under load, which is exactly the "walk away" failure mode. | Root-cause the `CLOSE_GRACE_MS`/scheduler-contention race or quarantine with explicit load markers; keep `--double` in the boundary gate. | M |
| **F-21** | docs / session-start staleness | `AGENTS.md:62-64`; `RESUME.md:18-20`; `remainingwaves.md:18-23`; `taskuniverselog.md:14-22` | Medium | All four cite **scripts 398/398 · src 2736/2726/10 skipped** (2026-10-02). The newest gate of record (`fixes/343_0_parent.md` §1/§7) is **scripts 427/0 · lib 3261/0/2 skipped**. No 343 correction exists in those docs. | A resuming session calibrates against a several-wave-old baseline; its "a drop is a regression YOU caused" heuristic is wrong. | Append a 343 correction line (or point at the newest gate-of-record). | XS |
| **F-22** | low / docs | `scripts/README-cli.md:460-518` | Low | `emit --git` is documented only in the command list (`:177-182`) and `USAGE.emit`; the §Emit prose section has `--red-tree`/`--verify-kind` paragraphs but no `--git` paragraph (343-3's own STOP-and-REPORT §8 item 1 is only half-closed). | Minor: the most consequential delivery flag lacks prose. | Add the `--git` paragraph beside `--red-tree`. | XS |

---

## 2. Docs-truth table (claim vs byte-truth)

| doc:line | claim (as written) | byte-truth (measured today) | verdict |
|---|---|---|---|
| `README.md:142-144` | "**Headless CLI:** it does **not** read `.env` — export the variable in the shell" | `rapidtool-cli.mjs:624-670` reads `<cwd>/.env` and installs it (W45·331-1) | **FALSE** |
| `.env.example:14-16` | "The headless CLI does NOT read .env — export the variable in your own shell first" | same as above | **FALSE** |
| `scripts/README-cli.md:349-351` | "Keys are read from `process.env` only (the CLI does **not** load `.env`…)" | contradicted by `README-cli.md:74-118` in the SAME file and by the source | **FALSE (intra-doc contradiction)** |
| `README.md:133`, `README.md:563` | "exit-code taxonomy (0/1/2/3/4)" | CLI also exits **5** (`--require-verified`); 2 is the park | **STALE** |
| `AGENTS.md:30` | "exit-code taxonomy (0/1/3/4)" | 0/1/**2**/3/4/**5** | **FALSE** |
| `README.md:226-228` | "No git landing / checkpoint-resume yet … not yet a shipped, pinned capability" | `emit --git` (343-3) + `resume`/`unattended` (W36) are real; drove keyless `unattended`→P12 | **FALSE** |
| `README.md:280` | "no git landing / no cross-machine reproducibility" | git landing landed 343-3 | **STALE** |
| `scripts/README-cli.md:476-481`, `:1048-1051` | "*every* fresh `emit --run` is unverified … exit 5 is opt-in" | fresh `emit --run` → `declaredScriptsVerified:true`, exit 0 (toolchain resolved from repo `node_modules`) | **FALSE** |
| `AGENTS.md:77-79` | exit 5 = "declared `typecheck`/`build` never ran" | true only when the declared scripts cannot resolve; not the fresh-emit default | **STALE** |
| `README.md:442-443` | `migrations/auth/0001_auth.sql` "applied by `scripts/migrate.mjs` in `npm run build`" | non-recursive `readdir` ⇒ nothing under `auth/` applies; `pendingMigrations` → "no migrations" | **FALSE** |
| `README.md:451` | `tsconfig.scripts.json` "error census = 1030 pre-existing" | `tsc -p tsconfig.scripts.json --noEmit` → exit **0**; `ERROR_BUDGET` empty | **FALSE** |
| `README.md:538` | "93 colocated test suites (`git ls-files src/lib \| grep -c '\.test\.'` = 93)" | that command returns **112** | **FALSE** |
| `README.md:477` | "`src/lib/` (213 files = 120 modules + 93 colocated tests)" | `git ls-files src/lib` = **239** (123 modules + 112 tests) | **STALE** |
| `README.md:560` | "`scripts/` (46 tracked = 24 tools + 22 tests)" | 49 = 25 tools + **24** tests | **STALE** |
| `README.md:591` | "Test suites (22):" (list) | 24 exist; missing `check-module-coverage.test.mjs`, `typecheck-scripts.test.mjs` | **STALE** |
| `README.md:349,351` | "THE CATALOG — every tracked file (1,908 today)" … `git ls-files \| wc -l` = 1,908 | live = **1926** | **STALE** |
| `README.md:295-299` | 342-6 correction: total **2,096** incl. `.t4scratch/` **192 tracked** | `.t4scratch` untracked/absent; `git ls-files .t4scratch` = **0** | **STALE (correction itself)** |
| `scripts/README-cli.md:1143` | `RT_E_GIT_UNAVAILABLE` "no live emitter today; landing tail unwired" | emitted by `git.server.ts`, wired to `emit --git` | **FALSE** |
| `scripts/README-cli.md:1147` | `RT_E_MCP_DISABLED` "no live emitter until the transport lands" | doctor emitted it live; transport implemented (`errors.ts:575-579`) | **FALSE** |
| `scripts/README-cli.md:30,513-518` | `--verify-kind` called from `rapidtool-cli.mjs:1184-1195` | actual `:2076-2090`; `:1184` is `run`/`gate` save | **FALSE** |
| `scripts/README-cli.md:1246` | "leg 1 — the scripts suite (21 contract suites)" | **24** `*.test.mjs` | **STALE** |
| `START-HERE.md:96-101` | `unattended` / `checkpoint+resume` / `MCP client` are "shelled / in progress" | all three delivered (W36 / 340-1 / 342-5) | **STALE** |
| `README.md:147` | "`.env.example` documents every knob" | 6 live knobs absent (MCP enable/server, PROVIDER, P6_SYNTH_CANDIDATES, CASSETTE_MODE, BIND_ALL) | **OVERCLAIM** |
| `AGENTS.md:62-64`, `RESUME.md:18-20`, `remainingwaves.md:18-23`, `taskuniverselog.md:14-22` | scripts 398 · src 2736/2726/10 | newest gate-of-record: scripts 427 · lib 3261/0/2 (`fixes/343_0_parent.md`) | **STALE** |
| `.github/workflows/gate.yml:60-62` | pin "== the dev host (`node -v` → v22.23.2)" | dev host = **v24.15.0** (22.23.2 is the Hermes-bundled runtime) | **STALE** |

**Docs safe to trust on my slice:** `scripts/README-cli.md` §Agent contract (exits 0/1/2/3/4/5), §API
key resolution, §Search/Check/Scan/Tree-run/repair, and its verb/UAGE parity (pinned by
`README-cli.test.mjs`); `AGENTS.md` §Honesty contract + §working rules; `docs-FOLDER-MAP.md`
conventions; `fixes/343_0_parent.md` and the newest `fixes/343_*_*.md` (gate-of-record + residuals);
`src/lib/doctor.ts` (well-derived factory claim). **Not safe:** the stale status/count sections of
`README.md`/`START-HERE.md`/`RESUME.md`/`remainingwaves.md`/`taskuniverselog.md`, `.env.example`,
the `README-cli.md` RT_E status notes, and every un-corrected `.env`/exit-5 claim.

---

## 3. Work plan for my slice (ordered by severity × leverage)

**Phase 1 — truth & safety (small, high leverage; ~1 half-day)**
1. **F-01 (src owner): wire or strike `authMiddleware`.** STOP-and-REPORT to the src slice: mount
   `.middleware([authMiddleware])` on the per-user `createServerFn` sites (`chat`, `verify`, `exec`,
   `crew`, `research`, `fixtures.review`, `llm`) or delete the "Enforced at the `authMiddleware`
   chokepoint" claim in `isolation.server.ts:29`. Add a guard test (a source scan asserting every
   per-user server fn mounts it). Risk: server-fn middleware changes auth behaviour — needs a keyed
   smoke or a targeted server test.
2. **F-02 + F-22 + F-11 + F-12 + F-10 (docs, one batch).** Fix the three `.env` claims, the
   `verify-kind` line refs, "21→24 suites", and the two RT_E status parentheticals. Test: none (docs);
   re-run `scripts/README-cli.test.mjs`.
3. **F-03 + F-04 + F-05 + F-07 + F-08 + F-09 + F-13 + F-21 (README/AGENTS/START-HERE corrections).**
   One "Corrections in force" append per file rather than rewriting history (the repo's own
   convention). Keep the numbers re-derived from `git ls-files` and the 343 gate-of-record. Risk:
   touching `README-cli.md` requires re-running its doc-contract pin.

**Phase 2 — infra/deploy correctness (~1 day)**
4. **F-06 (deploy).** Correct README §10.3; add an explicit copy-up step to the deploy docs; decide
   whether `npm run build` should assert the auth schema when `DATABASE_URL` is set. Test: extend
   `migration-plan.test.mjs` if the applier changes.
5. **F-16 (format gate).** Add `npx prettier --check src scripts` to `gate.sh` (or to a `format:check`
   script wired into the gate), verify on a frozen tree, and remove the `TODO(R15-f05)` line. Risk:
   the tree may not be prettier-clean — measure first; if it isn't, land a formatting-only commit or
   keep the check scoped.
6. **F-14 (`.env.example`).** Add the six missing knobs with one-line comments; soften `README.md:147`.

**Phase 3 — autonomous-factory structure (~1–2 days)**
7. **F-18 (the walk-away path).** Design and land a documented host-hook + wrapper: a scripted
   `factory` driver that drains a brief directory through `unattended` and then `emit --git`,
   recording per-brief outcome. Alternatively, explicitly scope the daemon out and state the manual
   procedure precisely. This is the item that decides "walk away and it ships".
8. **F-15 (port).** Make the dev/preview port overridable (`PORT`) with the 8080/8081 defaults kept.
9. **F-17 (CI).** Owner call on the Windows leg; fix the host-pin comment regardless.

**Phase 4 — coverage/flake debt (ongoing)**
10. **F-19.** Add drivable auth-surface tests; propose deletion of the dead barrels/`p2p.ts` (owner
    call — no deletions by me).
11. **F-20.** Root-cause/quarantine the load-sensitive child-spawn flake; keep `--double` green at
    every boundary.

---

## 4. Coverage statement

**Audited (read the bytes):** all `scripts/**` (49 tracked files: CLI 263 KB incl. all 39 `case "`
arms, `gate.sh`, `run-eval.mjs`, `with-app-env.mjs`, `migrate.mjs`, `migration-plan.mjs`,
`path-safety.mjs`, `check-module-coverage.mjs`+test, `docs-module-parity.mjs`,
`check-auth-invariant.mjs`+test, `typecheck-scripts.test.mjs`, `README-cli.md`+test); root config
(`package.json`, `package-lock.json` spot-checks, `tsconfig.json`, `tsconfig.scripts.json`,
`vite.config.ts`, `eslint.config.mjs`, `.gitignore`, `.prettierignore`, `.prettierrc`, `.env.example`);
`.github/workflows/gate.yml`; `migrations/**`; `.grok/app-env.json`; docs (`README.md`, `AGENTS.md`,
`AGENT_GUIDE.md`, `START-HERE.md`, `RESUME.md`, `docs-FOLDER-MAP.md` heads, `remainingwaves.md` head,
`taskuniverselog.md` head, `scripts/README-cli.md`, `fixes/343_0_parent.md`, `fixes/343_3_delivery.md`,
`fixes/343_1_synthesis.md`, `wave_plans/W52/README.md`). **Ran:** `--help`, `doctor` (bare +
`--project`), `create`/`gate`/`emit --check`/`tree-run`/`emit --run`/`--require-verified`/`unattended`/
`summary` on a keyless scratch project, 12 more verbs keyless, bare `run-eval.mjs` (refusal), the
module-coverage guard, and `tsc -p tsconfig.scripts.json`.

**Not audited / why:** the full gate and `npm test` (explicitly forbidden while a keyed eval + other
agents run — so the 427/3261 test-count claim is taken from `fixes/343_0_parent.md`, not re-measured);
`src/**` implementation bytes beyond the files a finding cites (another slice owns them — F-01 and
F-19 are cross-slice STOP-and-REPORTs); `finalsprint.md`, `agentnotes.md`, `research/**` bodies,
`wave_plans/W*` bodies, `fixes/**` history (too large; I read the newest parents and the docs that
cite them); `builds/`, `vault-e2e/`, `screenshots/`, `public/` assets; the eval corpus fixtures;
`node_modules`. All keyed calls: **0**.

---

## 5. The five most important findings (with evidence)

1. **F-01 — `authMiddleware` is documented as the enforced chokepoint and has zero importers.**
   `src/lib/auth/isolation.server.ts:29`: *"Enforced at the `authMiddleware` chokepoint (see
   `middleware.ts`)."* `auth/middleware.ts:28` exports it, but every `createServerFn` in
   `chat.ts/verify.ts/exec.ts/crew.ts/research.ts/fixtures.review.ts/llm.ts` mounts no middleware, and
   `scripts/check-module-coverage.mjs:79` itself records *"ZERO importers in this repo (its only
   import is its own doc comment at :12)"*. The app's per-user server functions are therefore not
   guarded by the mechanism the comments claim. **Fix first.**

2. **F-02 / F-22 — three docs say the CLI does not read `.env`; the CLI reads `<cwd>/.env` and it
   wins.** `rapidtool-cli.mjs:624-670` (`installRepoEnvKey`) implements the W45·331-1 precedence,
   while `README.md:142-144`, `.env.example:14-16`, and `scripts/README-cli.md:349-351` all still say
   the opposite — and `README-cli.md`'s own §"API key resolution" (`:74-118`) already documents the
   true rule. Credential plumbing is the last place to carry a false claim.

3. **F-18 — there is no walk-away path; the factory is single-shot and delivery is a manual flag.**
   No scheduler/daemon/queue exists in `src/lib`; `scripts/README-cli.md:1004-1008` states
   `unattended` is *"NOT a daemon — an external hook (Windows Task Scheduler / cron) invokes it on a
   cadence"*; `emit --git` (343-3) is opt-in and is not invoked by `gate`/`unattended`; there is no
   brief-queue intake. I confirmed the drive itself works (keyless `unattended` advanced to P12
   `complete`, honestly exiting 1 on the P6 gate) — the missing part is the orchestrator around it.

4. **F-06 — the README's deploy story is false.** `README.md:442-443` says the auth migration is
   *"applied by `scripts/migrate.mjs` in `npm run build`"*. `migrations/` holds only `auth/*.sql`;
   `migrate.mjs:39` reads non-recursively, so `pendingMigrations` is empty and the applier prints
   *"[migrate] no migrations — nothing to do."* The real path is copy-up plus the
   `RT_E_AUTH_SCHEMA_MISSING` preflight — a materially different deploy procedure.

5. **F-05 — the exit-5/`unverified` story is stale and will mislead a driving agent.** On HEAD
   `4bd1988` a fresh keyless `emit --run` returned `declaredScriptsVerified: true`, exit 0, with the
   note *"the declared project scripts were resolved from the RapidTool repo's own node_modules/
   (offline, no install)"*, yet `scripts/README-cli.md:476-481`/`:1048-1051` assert *"**every** fresh
   `emit --run` is unverified"* and present exit 5 as the everyday opt-in. An agent hard-coding the
   documented shape is wrong at this HEAD.
