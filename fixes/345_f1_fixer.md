# fixes/345_f1_fixer.md — F1: land the A4 docs-truth findings

**Fixer:** A4 (same auditor, now fixer). **Root:** `C:\Users\mnril\Desktop\RapidTool Main`.
**Base:** HEAD `06cb089` (the wave A4 audited is committed), clean tree at start. **Scratch:**
`%TEMP%\rt345_f1\`. **Keyed calls: 0.** **No source/test edits, no tracked-file deletions.**

**Scope (STRICT):** `README.md`, `AGENTS.md`, `AGENT_GUIDE.md`, `START-HERE.md`, `RESUME.md`,
`docs-FOLDER-MAP.md`, `remainingwaves.md`, `taskuniverselog.md`, `scripts/README-cli.md`,
`.env.example`, `.github/workflows/gate.yml`. Every changed file in `git status` is in that set (the
`src/**` modifications visible in the working tree are a concurrent sibling fixer's, not mine —
untouched by this lane). Convention followed: **append dated "corrections in force" blocks; do not
rewrite history** — except where a line is presented as a live "today"/"current" claim, which was
corrected in place and the old value recorded in the appended block.

---

## 1. Corrected-claims table

| doc | old claim (verbatim, abbreviated) | new text | byte-truth source |
|---|---|---|---|
| `README.md` §Environment | "**Headless CLI:** it does **not** read `.env` — export the variable in the shell" | resolves `DEEPSEEK_API_KEY` from `<working directory>/.env` **first**, then the process env; `.env` wins when both non-blank; blank process value = keyless disable; run from repo root | `scripts/rapidtool-cli.mjs` `installRepoEnvKey` (`readFileSync(resolve(process.cwd(), ".env"))`, W45·331-1) |
| `README.md` §Environment | "`.env.example` documents **every** knob" | "documents the **common** knobs (… MCP gate, provider selection, best-of-N, cassette, dev LAN bind)" | 6 live knobs were absent from `.env.example` (see below) |
| `.env.example` intro | "The headless CLI does NOT read .env — export the variable in your own shell first" | CLI also resolves keys from `<cwd>/.env` (wins over the process env); precedence matrix stated | same CLI source + `README-cli.md` §API key resolution |
| `scripts/README-cli.md` §Live mode | "Keys are read from `process.env` only (the CLI does **not** load `.env` …)" | `.env`-first precedence; present-but-blank = keyless; ambient loses behind `RT_E_LLM_KEY_SHADOWED` | same; the same file's §API key resolution (`:74-118`) already had the truth |
| `README.md` §smoke note | "exit-code taxonomy (0/1/2/3/4)" | "(0/1/2/3/4/**5**)" | CLI emits 2 (park) and 5 (`--require-verified`); `README-cli.md` §Agent contract |
| `README.md` §10.7 CLI bullet | "exit taxonomy 0/1/2/3/4." | "0/1/2/3/4/**5**." | same |
| `AGENTS.md` read-before table | "exit-code taxonomy (0/1/3/4)" | "(0/1/2/3/4/**5**)" | same |
| `START-HERE.md` run commands | "taxonomy (0/1/2/3/4; 2 = parked …)" | "(0/1/2/3/4/**5**; 2 = parked …; 5 = `--require-verified`)" | same |
| `README.md` limit #4 | "**No git landing / checkpoint-resume yet** … not yet a shipped, pinned capability" | git landing + checkpoint+resume are REAL (`gitLandEmitted`, W36); residual = no in-product scheduler + no remote/push/PR | `fixes/343_3_delivery.md`; `rapidtool-cli.mjs:2205`; `git.server.ts` `gitLandEmitted` |
| `README.md` §7 blocked line | "no git landing / no cross-machine reproducibility" | "git landing + checkpoint-resume landed (residual: missing in-product scheduler/host-hook and remote/PR delivery …)" | same |
| `scripts/README-cli.md` §Emit | "Because a fresh scaffold has no `node_modules`, *every* fresh `emit --run` is unverified" | fresh emit is **verified** when declared scripts resolve from the repo's own `node_modules/`; unverified is the residual case | ran `emit --run` → `declaredScriptsVerified: true`, exit 0; `treeRun` note "resolved from the RapidTool repo's own node_modules/ (offline, no install)" |
| `scripts/README-cli.md` §Agent contract (exit 5) | "its DECLARED scripts … never executed … a freshly scaffolded tree has no `node_modules`, so *every* fresh `emit --run` is unverified" | same conditional correction | same |
| `AGENTS.md` exit-5 note | "its declared `typecheck`/`build` never ran" | "could not be resolved/run"; fresh emit with repo-`node_modules` resolution reports `declaredScriptsVerified: true` | same |
| `README.md` §10.3 | "`migrations/auth/0001_auth.sql` … applied by `scripts/migrate.mjs` in `npm run build`" | schema is **not** applied there: `migrate.mjs` reads non-recursively and nothing tops out under `migrations/`; copy the auth files up (`cp migrations/auth/*.sql migrations/`) then re-run; auth-on without a `user` table is refused `RT_E_AUTH_SCHEMA_MISSING` | `scripts/migrate.mjs` non-recursive `readdir`; `migrations/` holds only `auth/`; `src/lib/errors.ts` `RT_E_AUTH_SCHEMA_MISSING` doc |
| `README.md` §10.2 table | `tsconfig.scripts.json` "error census = 1030 pre-existing" | "**CLEAN as of 2026-10-03** — `tsc -p tsconfig.scripts.json --noEmit` exits 0; `ERROR_BUDGET` empty" | ran the command → exit 0; `scripts/typecheck-scripts.test.mjs` `ERROR_BUDGET = {}` |
| `README.md` catalog title + §10.1 | "every tracked file (**1,908** today)"; Total 1,908; `fixes/` 587; `src/` 224; `wave_plans/` 108; `scripts/` 46; `.t4scratch/` 192 | Total **1,933**; `fixes/` **744**; `src/` **250**; `wave_plans/` **139**; `scripts/` **49**; `.t4scratch/` **0** (untracked/removed) | `git ls-files` re-derivation (below) |
| `README.md` §10.6 | "213 files = 120 modules + 93 colocated tests"; "**88** direct modules"; "**32** subdirectory modules"; `llm/providers/` (5) | "**239** files = **123** modules + **112** tests"; "**90** direct `.ts` modules"; "**35** subdirectory modules (33 `.ts` + 2 `.tsx`)"; `llm/providers/` (**8**) | `git ls-files src/lib` re-derivation |
| `README.md` §10.6 suites | "**93** colocated test suites … `grep -c '\.test\.'` = 93 — 87 top-level + 6 subdir" | "**112** … = 112 — 99 top-level + 13 subdir" + "re-derive rather than trusting this list" | the quoted command now returns 112 |
| `README.md` §10.7 | "(**46** tracked = 24 tools + 22 tests)"; "**Test suites (22):**" (missing 2) | "(**49** tracked = 25 tools + **24** tests)"; "**Test suites (24):**" + added `check-module-coverage.test.mjs`, `typecheck-scripts.test.mjs` | `git ls-files scripts`; `Get-ChildItem scripts -Filter *.test.mjs` = 24 |
| `README.md` §10.9 / §10.10 | "**587** tracked"; "**108** tracked … (108 files incl. README.md)" | "**744** tracked"; "**139** tracked … (139 files incl. README.md)" | `git ls-files fixes` = 744; `git ls-files wave_plans` = 139 |
| `scripts/README-cli.md` RT_E table | `RT_E_GIT_UNAVAILABLE` → "— (no live emitter today; landing tail unwired)" | "1 (`emit --git` delivery tail; live emitter in `src/lib/git.server.ts`)" | `git.server.ts` emits it; wired at `rapidtool-cli.mjs:2205` |
| `scripts/README-cli.md` RT_E table | `RT_E_MCP_DISABLED` → meaning "no child process was spawned … discovery-first shell"; action "once the JSON-RPC 2.0 stdio transport lands, TODO(R8-f11)"; exit "— (owner-gated; no live emitter until the transport lands)" | transport **IS implemented** (`src/lib/mcp.server.ts`, 340-1); "1 (`doctor --mcp-call` / `doctorMcp`; live emitter)"; TODO clause removed | `src/lib/errors.ts` `RT_E_MCP_DISABLED` doc; doctor emitted it live during the A4 audit |
| `scripts/README-cli.md` §verify-kind | "rides inside `emit` (`rapidtool-cli.mjs:1184` …)" and "called from `rapidtool-cli.mjs:1184-1195`" | "`rapidtool-cli.mjs:2076`" / "`rapidtool-cli.mjs:2076-2090`" | `grep verifyKindDir` → `:2076`/`:2081` |
| `scripts/README-cli.md` §Tests | "leg 1 — the scripts suite (**21 contract suites**)" | "(**24 contract suites**)" | 24 `*.test.mjs` |
| `START-HERE.md` 10-line tour | `src/lib/` (213) · `scripts/` (46) · `fixes/` (587) · `wave_plans/` (108) | 239 · 49 · 744 · 139 | `git ls-files` |
| `START-HERE.md` shell list | "Shelled / in progress" names `unattended` (W-47), checkpoint+`resume` (T-107.7), MCP client (F1) as unfinished; blocked list "keyed evidence runs blocked by funding … 402" and "no git landing" | delivered items named with waves (341-6 / W36 / 340-1+342-5 / 340-4 / 341-1 / 343-3 / R11-f01); funding line struck with pointer to the file's own 2026-10-02 CORRECTION; git landing marked landed | `fixes/343_0_parent.md`; `README-cli.md` §Resume/unattended; `fixes/343_3_delivery.md` |
| `AGENTS.md` Reality-check | "the dev server binds `0.0.0.0:8080` (vite.config.ts)" | "binds **loopback `127.0.0.1:8080`** by default (`vite.config.ts:160`, R11-f01); `RAPIDTOOL_BIND_ALL=1` opts into `0.0.0.0:8080`" | `vite.config.ts:160` (`process.env.RAPIDTOOL_BIND_ALL === "1" ? "0.0.0.0" : "127.0.0.1"`) |
| `.github/workflows/gate.yml` | "Pin == the dev host (`node -v` → v22.23.2 …)" | "Pin = the Hermes-bundled Node … It is NOT the dev host: `node -v` is **v24.15.0**" + owner note retained | host `node --version` = v24.15.0; 22.23.2 is `%LOCALAPPDATA%\hermes\node\node.exe` |
| `AGENTS.md` Commands | "both are green (re-measured 2026-10-02 on `6575669`: scripts 398/398; src 2736 …)" | latest gate of record = **scripts 427 / lib 3261 / 2 skipped** (343 wave); 398/2736 kept as labeled history | `fixes/343_0_parent.md` §1/§7 |
| `RESUME.md`, `remainingwaves.md`, `taskuniverselog.md`, `START-HERE.md`, `AGENTS.md`, `README.md` | stale snapshot counts / unfunded-keyed / no-git-landing claims | each got an appended **"CORRECTION — 2026-10-03 (345-F1 …)"** block with the current gate-of-record, re-derived counts, and the corrected CLI truths | `fixes/343_0_parent.md`; `git ls-files`; the byte-checks above |
| `docs-FOLDER-MAP.md` | "total tracked **2,096** (includes the 192 tracked `.t4scratch/` files)" | appended a 2026-10-03 (345-F1) re-count line: total **1,933**, `.t4scratch` 0 | `git ls-files .t4scratch` = 0; total = 1933 |

---

## 2. Counts re-derived (and how)

All via `git ls-files <dir>` at HEAD `06cb089` (2026-10-03), cross-checked with `Get-ChildItem` for
`scripts/*.test.mjs`:

| Quantity | Old doc value | Re-derived | Method |
|---|---:|---:|---|
| Total tracked | 1,908 / 2,096 | **1,933** | `git ls-files \| wc -l` (and the §10.1 rows sum to exactly 1,933) |
| `.t4scratch/` | 192 tracked | **0** | `git ls-files .t4scratch` (removed in the 342 wave, `73f660a`; `Test-Path` = false) |
| `src/` | 224 | **250** | `git ls-files src` |
| `src/lib/` | 213 | **239** | `git ls-files src/lib` |
| `src/lib` modules | 120 | **123** | non-`.test` `.ts`: 90 top-level + 33 subdir; +3 `.tsx` top-level `.tsx` excluded from "direct `.ts`" |
| `src/lib` colocated tests | 93 (87+6) | **112** (99 top-level + 13 subdir) | `git ls-files src/lib \| grep '\.test\.'` |
| subdirectory groups | 32 | **35** (33 `.ts` + 2 `.tsx`) | app-data 6 · auth 17 · llm/providers 8 · mcp 1 · multiplayer 2 · testing 1 |
| `scripts/` | 46 = 24 tools + 22 tests | **49 = 25 tools + 24 tests** | `git ls-files scripts`; test file count 24 |
| `fixes/` | 587 | **744** | `git ls-files fixes` |
| `wave_plans/` | 108 | **139** | `git ls-files wave_plans` |
| `research/multiagent/` | 103 | 103 (unchanged) | `git ls-files research/multiagent` |
| `research/eval-corpus/` | 23 | 23 (unchanged) | `git ls-files research/eval-corpus` |
| `research/eval-out/` | 345 | 345 (unchanged) | `git ls-files research/eval-out` |
| CLI verbs | 39 | **39** (unchanged) | `grep -c 'case "'` — also pinned by `README-cli.test.mjs` |
| Gate of record | 398/2736 (2026-10-02) | **scripts 427/0 · lib 3261/0/2 skipped** | `fixes/343_0_parent.md` §1/§7 (full gate not re-run — forbidden this lane) |
| `tsc -p tsconfig.scripts.json --noEmit` | "1030 pre-existing" | **exit 0** | ran it |
| `.env.example` documented knobs | "every knob" | 6 missing → added | grep code refs vs file: `RAPIDTOOL_MCP_ENABLED` 16, `_SERVER` 11, `RAPIDTOOL_PROVIDER` 6, `P6_SYNTH_CANDIDATES` 25, `RAPIDTOOL_CASSETTE_MODE` 4, `RAPIDTOOL_BIND_ALL` 3 |

---

## 3. Suites run (targeted only; no full gate)

| Suite | Result |
|---|---|
| `node --test --test-reporter=tap scripts/README-cli.test.mjs` (Node 22.23.2) | **12 pass / 0 fail**, exit 0 — re-run after the final edit batch |
| `node scripts/docs-module-parity.mjs` (advisory doc-vs-disk scanner) | `ok:true`, `uniquePaths:46`, `missingCount:1` (`src/generated.ts`, pre-existing in `RESUME.md`/`remainingwaves.md`; **not introduced here**), `emptyCount:0` |
| `node_modules/typescript/bin/tsc -p tsconfig.scripts.json --noEmit` | **exit 0** (re-verified the F-07 claim before editing it) |

I did **not** run `npm test` / `gate.sh` (forbidden: siblings mid-edit, keyed eval running).

---

## 4. What I did NOT change, and why

- **`.github/workflows/gate.yml` Windows leg.** Per the task, the enable-or-not decision is the
  owner's: the commented `windows-leg` job and the in-file rationale are untouched. I fixed only the
  false "Pin == the dev host" comment.
- **`README.md` §10.1 sub-counts that are still correct** (`research` 476, `.grok` 89, `builds` 50,
  `vault-e2e` 47, `public` 10, `screenshots` 16, etc.) — left as-is; the table now sums to the
  re-derived 1,933.
- **`docs-FOLDER-MAP.md` per-node snapshot numbers** (e.g. `src/ (211)`, `lib/ (201)` in the tree
  diagram) — these are explicitly labeled "the 2026-09-26 snapshot" with superseding re-count
  blockquotes; I appended the 2026-10-03 re-count line but did not rewrite the diagram.
- **`AGENT_GUIDE.md`** — no claim in the A4 finding list; its §5 statements (real LLM only when
  configured, bounded runner ≠ sandbox, no persistence) still match the bytes. Left unchanged.
- **`RESUME.md` / `remainingwaves.md` / `taskuniverselog.md` bodies** — appended correction blocks
  only; the dated 2026-09-16/09-24 history was preserved (repo convention).
- **The `.t4scratch/` tracked-file deletion** — already untracked (0 files); nothing to delete. No
  tracked-file deletion performed anywhere.
- **`src/**` modifications visible in `git status`** — a concurrent sibling fixer's work; not mine,
  not touched.
- **The `README.md` 2026-09-26 status banner** — dated and explicitly superseded by the appended
  345-F1 "Corrections in force" block, which states it supersedes "every dated status block of this
  file". Left in place to avoid rewriting history.

---

## 5. Files changed (all in the owned set)

`.env.example`, `.github/workflows/gate.yml`, `AGENTS.md`, `README.md`, `RESUME.md`,
`START-HERE.md`, `docs-FOLDER-MAP.md`, `remainingwaves.md`, `scripts/README-cli.md`,
`taskuniverselog.md` — plus this log. No other file was edited by this lane.
