# 247 — W17 LANE 5: the infrastructure trio (CI-workflow + OV-19 + OV-43)

**BOTTOM LINE (2026-09-24, all runs FOREGROUND; every claim = the command below it):**
- **CI-workflow** — `.github/workflows/gate.yml` (NEW): ONE deliberate workflow running `scripts/gate.sh`, node pinned `22.23.2` (= the dev host; `nodejs.org/dist/v22.23.2/` → HTTP 200), ubuntu-22.04 leg, **zero secret refs**. The runner gap (an ubuntu leg cannot catch this repo's Windows-path class) is documented in-file; a Windows leg is a commented PROPOSAL, not enabled. YAML parse-checked + structure asserted (`node -e` js-yaml, paste below).
- **OV-19** — `src/lib/zero-byte-guard.test.ts` (NEW): 0-byte guard scoped to source+test extensions with an explicit allowlist. Runs on THIS repo → **0 offenders** (429 tracked files scanned; the only 2 zero-byte tracked files are `.gitkeep`/`.lock`, out of scope + allowlisted). Its own test file: **4/4 green**, including detector self-tests (no vacuous pass).
- **OV-43** — `src/lib/compile-check.server.ts` (+`.test.ts`): report-only supply-chain floor — `supplyChainFloorFor()` + `SUPPLY_CHAIN_AUDIT_COMMAND` + the posture wired into the install verdict (`gate: false`, machine-pinned). Targeted suite: **46 tests · 45 pass · 1 opt-in skip · 0 fail**. Real emitted tree probe: 10/10 deps caret-pinned, no lockfile, `audited: false`.
- **NOT in my box / not done (named):** OV-43's other half — the emitted README line in `scaffold.ts` ("caret-pinned and un-audited") — is NOT in this lane's file ownership; recorded as a follow-up (see §C.4). The CI workflow has never executed (no push run yet) — §A.4.

Repo `C:\Users\mnril\Desktop\RapidTool Main` (base `4328d20`) · scratch `C:/Users/mnril/w17l5_scratch/` · node v22.23.2.

---

## A. CI-workflow — `.github/workflows/gate.yml`

### A.1 Runner inventory (competitor habit read: 2 workflows + the per-OS split)
- `MetaGPT/.github/workflows/unittest.yaml` — `runs-on: ubuntu-22.04` (**pinned major-OS, not `-latest`**), version matrix, artifacts with `if: ${{ always() }}`.
  Evidence: `cat ~/rt-competitors/MetaGPT/.github/workflows/unittest.yaml`.
- `cline/.github/workflows/desktop-test.yml` — **`permissions: contents: read`** (least privilege), path-filtered triggers, `workflow_dispatch`, a comment explaining WHY ubuntu suffices for that suite. Both habits adopted.
  Evidence: `head -80 ~/rt-competitors/cline/.github/workflows/desktop-test.yml`.
- The per-OS split is the field's real pattern; aider carries two files (from `224`, re-verified the dirs exist): `ls -d ~/rt-competitors/*/.github/workflows` → 14 clones with workflows; aider/opencode/cline/MetaGPT workflow lists printed 2026-09-24.

### A.2 The file (deliberate choices)
- `on: push(main) · pull_request · workflow_dispatch`; `permissions: contents: read`; `concurrency` with cancel-in-progress; `timeout-minutes: 45`.
- Steps: `actions/checkout@v4` → `actions/setup-node@v4` with **`node-version: "22.23.2"`** + `cache: npm` → `npm ci --no-audit --no-fund` → **`bash scripts/gate.sh`** (the repo's own four-gate script, unchanged; `bash` explicit so the mode bit is irrelevant).
- **No keys:** `grep -c "secrets\." .github/workflows/gate.yml` → 0. The only `DEEPSEEK|API_KEY` hits (2) are the comment stating why no key may ever land here.
- **Runner gap documented in-file:** the ubuntu leg cannot catch the Windows-path bug class — `scripts/gate.sh:51-53`'s MSYS `cygpath -m` conversion (dead code on ubuntu → never defended), `src/lib/node-runner.server.ts` Windows-native spawn (.cmd shims, `windowsHide`), and OV-2's browser-guard `/workspace` bug (`fixes/224` · PLAN-IMPROVER note, read during recon). The YAML comment says so and points here.
- **Windows leg = PROPOSAL, commented out** (not enabled: never run green, doubles CI minutes). Uncommenting is a one-move owner decision; sketch mirrors aider's split.

### A.3 YAML validity (parsed, not eyeballed)
`node -e '<js-yaml load + structure asserts>'` →
```
PARSE OK · top keys: name,on,permissions,concurrency,jobs · on-key: on
jobs: gate
runs-on: ubuntu-22.04 | timeout: 45
permissions: {"contents":"read"}
node-version: 22.23.2
steps: ["actions/checkout@v4","actions/setup-node@v4","npm ci --no-audit --no-fund","bash scripts/gate.sh"]
gate.sh step present: true
secrets refs: 0
```
Also: `curl -s -o /dev/null -w "%{http_code}" https://nodejs.org/dist/v22.23.2/` → `200`; `nodejs.org/dist/index.json` → `22.23.2 present: true` (the pin is a real release).

### A.4 Honest limits (CI)
- **The workflow has never executed** — no push run happened at landing. Everything above is static evidence.
- The lockfile DOES carry linux optional bindings (`grep -o '"[^"]*linux[^"]*"' package-lock.json` → `@rolldown/binding-linux-x64-gnu`, `@tailwindcss/oxide-linux-*`, `lightningcss-linux-*`…), so `npm ci` on ubuntu is EXPECTED to resolve — expectation, not evidence, until the first green run.
- Schema-level validation (actionlint) was not run (not installed); js-yaml parse + structure asserts only.
- `ubuntu-22.04` pinned deliberately (MetaGPT habit) instead of `-latest`; if GitHub ever retires 22.04 this file needs the bump.

---

## B. OV-19 — zero-byte-source guard (`src/lib/zero-byte-guard.test.ts`, NEW)

### B.1 Shape decision (read before choosing)
- The playbook (230) has NO OV-19 block; the row lives in `225` hunt 2 + `227`/`fixes/228` §3 (row 17: **MODIFY — "scope to source+test extensions with an explicit allowlist"**; "new check/test (safe)").
- I put the check in a **test file** (not a new script) because it then rides the existing `src/lib/**/*.test.ts` leg of `scripts/gate.sh` — no new CLI surface, no new gate wiring.
- **Overlap named, not duplicated:** the row's second clause ("a named test file contains ≥1 case") is ALREADY owned by the T-17 assertion-gap lint (`scripts/check-assertion-gaps.mjs`, gate 3, "zero-assertion test blocks" — read in recon). This guard covers clause 1 (0-byte) only, and says so in its header.

### B.2 Scope + allowlist (explicit, as modified)
- In scope: tracked (`git ls-files`) files with code-bearing extensions — `.ts .tsx .mts .cts .js .jsx .mjs .cjs .sh`. `.sh` included because `scripts/*.sh` is executable surface (a 0-byte gate.sh breaks everything).
- Out of scope on purpose: `.md/.json/.yaml/.css/.gitkeep/.lock` — config/data/asset files where 0 B can be legitimate (225's own self-rejection of the naive version).
- Allowlist (2 entries, each with a one-line reason, staleness-tested): `screenshots/.gitkeep`, `.node_modules.lock` — both already out of extension scope today; listed so a scope widening can't silently flag them.
- Tracked-but-deleted paths are skipped, not flagged — deletions are `git status`'s class. If git is unavailable the guard THROWS (fails loudly, never passes vacuously).

### B.3 Run + evidence
- `git ls-files | grep -E '\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$' | <size scan>` → **no output** (0 offenders); tracked count = 429.
- ALL tracked 0-byte files regardless of extension: `.node_modules.lock`, `screenshots/.gitkeep` (2, both out of scope).
- Guard's own test: `node --experimental-strip-types --test src/lib/zero-byte-guard.test.ts` → **4 pass / 0 fail**, incl. anti-vacuity (`tracked.length >= 300`), detector self-test (flags 0-byte `.ts` + 0-byte `.test.mjs`, ignores `.txt`/`.gitkeep`/non-empty), scope assertions, and the stale-allowlist test.

---

## C. OV-43 — report-only supply-chain floor (`src/lib/compile-check.server.ts` + test)

### C.1 The facts the floor makes visible (both by design)
- Install leg runs **`npm ci|install --no-audit --no-fund`** (`installToolFor`, `compile-check.server.ts:1149-1156`) — advisory audit is OFF on the verify path.
- Emitted trees are **caret-pinned with no lockfile** (`scaffold.ts` PKG_DEPS/`PKG_DEV_DEPS`; real tree probe below) — a fresh emit resolves current patches; the honest cost is drift.
- Lesson anchor: gpt-pilot supply-chain incident (`RESUME.md:628`, cited by `227`).

### C.2 What landed (additive only; W16 HOT map respected)
- `SUPPLY_CHAIN_AUDIT_COMMAND = "npm audit --omit=dev"` — named, never executed by the surface.
- `supplyChainFloorFor(dir, opts?)` → `SupplyChainPosture` — **`report: "supply-chain-posture"`, `gate: false`, `audited: false`** (literal types: a gate interpretation cannot even be constructed), lockfile present/absent, install tool+command, `--no-audit` flag, caret/exact/other range counts + up to 5 caret examples, and an `auditNote` that names the real check and says a host that cannot audit must say so. Never throws (unreadable package.json → `packageJson: false`).
- Wired into `runInstallStep`'s verdict as `install.supplyChain` — the posture travels with the install evidence; it changes NO run/ok classification (report-only).

### C.3 Targeted run + emission evidence
- `node --experimental-strip-types --test src/lib/compile-check.server.test.ts` → `# tests 46 · # pass 45 · # fail 0 · # skipped 1` (the 1 skip = the pre-existing opt-in real-npm test, `RT_VERIFYKIND_INSTALL=1`; OV-43 block `ok 8`).
- Probe (scratch `C:/Users/mnril/w17l5_scratch/ov43_probe.mjs`) on an emitted-style fixture → emitted posture with `gate:false`, `audited:false`, `caretPinned:3`, `noAuditFlag:true`, auditNote naming `npm audit --omit=dev`.
- Probe on a REAL emitted tree (`ov43_probe_real.mjs research/eval-out/coffeehouse2home-property-ledger`) → `lockfile:"absent" · installTool:"npm install" · caretPinned:10 · exactPinned:0 · otherRange:0 · gate:false · audited:false`.
- eslint on the three touched files → exit 0, no output.

### C.4 Not done (named, outside this lane's ownership — do NOT read as landed)
- The emitted-README line ("deps are caret-pinned and un-audited") lives in `scaffold.ts` — **not owned by this lane** (W16/W17 file map). Follow-up row needed.
- The `--no-audit` flag itself was NOT changed (report-only by design; the row says "S first, never a gate").

---

## D. Evidence index (one line per claim = the command)

| Claim | Command (cwd = repo root unless noted) |
|---|---|
| YAML parses + structure | `node -e '<js-yaml load; asserts>'` → "PARSE OK" block in §A.3 |
| node pin is real | `curl -s -o /dev/null -w "%{http_code}" https://nodejs.org/dist/v22.23.2/` → `200` |
| no keys in CI | `grep -c "secrets\." .github/workflows/gate.yml` → 0 |
| 0 zero-byte code files | `git ls-files | grep -E '\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$' | <size scan>` → empty |
| guard test green | `node --experimental-strip-types --test src/lib/zero-byte-guard.test.ts` → 4/4 |
| OV-43 suite green | `node --experimental-strip-types --test src/lib/compile-check.server.test.ts` → 46/45 pass/1 skip/0 fail |
| **scoped typecheck (my closure, real strict settings)** | `node node_modules/typescript/bin/tsc --noEmit -p C:/Users/mnril/w17l5_scratch/tsconfig.lane5.json` → **exit 0** (config extends the repo tsconfig; files = my 3 changed paths; closure imports `node-runner.server.ts`/`sandbox.ts`, both unmodified) |
| real-tree posture | `node --experimental-strip-types C:/Users/mnril/w17l5_scratch/ov43_probe_real.mjs "…/research/eval-out/coffeehouse2home-property-ledger"` |
| file map | `git status --short` → new: `.github/`, `src/lib/zero-byte-guard.test.ts`; modified: `src/lib/compile-check.server.ts` (+`.test.ts`), this log |

## E. Honest limits / not done
- CI file never executed (§A.4); no actionlint.
- OV-19 does not scan untracked files (a fresh, never-added 0-byte file is invisible until `git add`) — documented in the guard; `git status` shows it.
- OV-43 is report-only by contract: nothing audits, nothing gates, no behavior change to `verifyKindDir`'s ok/code path (the suite's pre-existing 45 pass prove no regression).
- `fixes/247_lane5_infra.md` skeleton was written first (call ~6) per the wave rule; this fill preserves the skeleton's headings.
