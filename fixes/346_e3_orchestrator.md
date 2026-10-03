# fixes/346_e3_orchestrator.md — lane 346-E3 (autonomy orchestrator & process)

**Boundary:** opened 2026-10-03, HEAD `988b158` (git `main`). Windows + PowerShell; host Node
v24.15.0, Node 22.23.2 at `%LOCALAPPDATA%\hermes\node\node.exe`. Owned files: `scripts/**`
(new `factory-watch.mjs` + test; `README-cli.md`; `gate.sh`), `vite.config.ts`, `package.json`,
`.github/workflows/gate.yml`. **Log is append-only.** No RapidTool-repo commit/stash/reset was
performed; the repo HEAD sha is asserted unchanged below. All orchestrator runs live under
`%TEMP%\rt346_e3\`; the keyed proof wrote no tracked file.

Headline: **F-18 — the walk-away orchestrator is now real.** Also landed: F-15 (`PORT`),
F-16 (prettier measured, scoped check), F-17 (CI certification boundary), F-20 (bounded
honest quarantine), F-22 (`--git` prose), plus the npm scripts.

---

## 1. F-18 — `scripts/factory-watch.mjs` (the walk-away orchestrator)

### 1.1 Design

ONE bounded tick — **not a daemon** — that drains a brief intake through the real CLI machine
contract and delivers each completed project. Per brief:

```
create  →  unattended (machine seat only)  →  emit --git (per-project dir)
```

The script shells out to `scripts/rapidtool-cli.mjs` (one JSON envelope per verb) with
`cwd = REPO_ROOT` (so key resolution and `.env` semantics match every other invocation) and
inherits the caller's environment (keyed, or keyless via a present-but-blank
`DEEPSEEK_API_KEY`). Its own stdout is one JSON object, like every other verb.

Key seams (`scripts/factory-watch.mjs`):

| seam | file:line | contract |
| --- | --- | --- |
| intake (dir) | `:318` `readIntake` | `*.md/*.txt/*.brief`, sorted; front-matter `name:` else stem |
| intake (queue) | `:345` `readQueue` | `[{name,brief}]` or `{briefs:[…]}`; `@path` reads a file |
| plan (idempotence/resume) | `:203` `planItem` | pure: new→create · delivered→skip · parked/stalled→terminal (retry→drive) · changed brief→changed · failed→drive until the attempt cap |
| drive classification | `:232` `classifyDrive` | exit 0 is the ONLY `complete`; 2→`parked`; 1→`stalled`+code; 3/4→`failed` (retryable) |
| delivery proof | `:265` `emitDelivered` | pure: `committed:true` or idempotent `noop:true` only |
| checkpoint write | `:275` `atomicWriteJson` | tmp + `renameSync` beside the state file |
| CLI child | `:289` `runCli` | `spawnSync(node, --experimental-strip-types, cli, …)`, bounded timeout |
| tick | `:392` `main` | create `:513` · drive `:537` · deliver `:557` |
| entry guard | `:655` | `isMainModule` (importable by the test without running a tick) |

State: `<work>/state/factory-state.json`, per project keyed by slug, carrying `briefHash`,
`projectFile`, `emitDir`, `status`, `attempts`, `phase`, `code`, `reason`, `delivery`. It is
written after every step, so a killed process leaves a `created`/`driving` record the next tick
resumes — and `unattended` itself resumes from the phase checkpoint
(`<dir>/.rapidtool/checkpoint.json`).

### 1.2 Intake / checkpoint / resume / idempotence / refusal — behaviours

- **Intake**: `--intake <dir>` or `--queue <file.json>` (exactly one, required); the CLI's
  `--brief @<path>` unwraps a corpus fixture's `brief:` scalar.
- **Per-project checkpoint**: `state/factory-state.json`, atomic, written after create / drive /
  deliver. A corrupt state is REFUSED (`RT_E_VALIDATION`), never overwritten — see the test.
- **Resume, not restart**: `planItem` returns `drive` for `created`/`driving`; the E2E proves a
  re-tick does not re-create. A crash mid-drive re-enters `unattended`, which reads the phase
  checkpoint.
- **Idempotence**: a `delivered` brief is skipped (`already-delivered`) with no CLI verb spawned
  (behavioural test: the project file is never created). A changed brief (`briefHash` differs) is
  reported `changed` and left for a human — never silently re-run.
- **Refusal / never invent success**: exit 0 from `unattended` is the only path to `emit --git`;
  a delivery is claimed only when the emit envelope proves a real commit. Everything else is
  `parked` (exit 2, human gate) or `stalled`/`failed` with the CLI's own coded reason, and the
  item is left for a human. The script prints an honest note; it never upgrades a stall.
- **Bounded attempts**: a transient `failed` is retried on the next tick up to
  `DEFAULT_MAX_ATTEMPTS = 3`, then reported `attempts-exhausted` (terminal).
- **Exit codes**: `0` all delivered (or already) · `2` parked/changed and none hard · `1`
  stalled/failed or usage · `4` factory-internal throw.

### 1.3 Real run output

Keyless end-to-end (the committed test drives the real script; deterministic floor):

```
# ok 5 - keyless end-to-end: intake → create → unattended → HONEST stall (no delivery), then an idempotent skip
# tests 9
# pass 9
# fail 0
```

The keyless fixture envelope (from the live script, trimmed):

```json
{ "ok": false, "cmd": "factory-watch", "exit_code": 1,
  "processes": [ { "slug": "expense-tracker", "action": "drive-stalled", "status": "stalled",
    "phase": 12, "code": "RT_E_GATES_FAILED", "needsHuman": true, "delivered": false, "delivery": null } ] }
```

A KEYED orchestrator tick DID deliver end-to-end (measured usage in §6):

```
{ "action": "delivered", "status": "delivered", "phase": 12, "delivered": true,
  "delivery": { "committed": true, "noop": false,
    "commit": { "hash": "976afe890f3a2711163df4127553c7b11601cddd",
      "subject": "feat(expense-tracker): The app must let a small team create expense records…" } } }
$ git -C <work>/expense-tracker/emitted log --oneline
976afe8 feat(expense-tracker): The app must let a small team create expense records, each record…
```

A second tick over the delivered intake returned in **0.3 s** with
`action:"deliver", reason:"already-delivered"`, commit count stayed **1**, and the project file
hash was byte-identical (idempotence, proven on the real artifact).

**Honest limit discovered on real bytes:** a keyless drive is the deterministic floor, which
cannot synthesise a brief-conformant module, so keyless `unattended` seals COMPLETE with the P6
DoD gate red (`RT_E_GATES_FAILED`) — the factory therefore reports a keyless brief as a *stall*,
never a delivery. A keyed drive defaults `enforceDod` ON and can still miss the P6 DoD (observed:
`RT_E_GATE_PENDING`, `p6-test`/`p6-verified` unmet), which is likewise reported with its code and
left for a human. Neither is a bug in the factory: it is the honest boundary of "walk away and it
ships". The human follow-up for a stalled project is `tree-run`/`repair --dir` or a `--retry`.

### 1.4 Test (`scripts/factory-watch.test.mjs`)

9 tests, green on Node 24.15.0 and Node 22.23.2 (both ~18 s). Legs: pure `planItem` /
`classifyDrive` / `emitDelivered` / intake helpers; a **keyless behavioural end-to-end** over a
throwaway intake+workspace (real `create` → real `unattended` → honest stall → idempotent skip);
a behavioural delivered-skip (pre-seeded durable state, no CLI runs); a corrupt-state refusal; a
queue `--dry-run` that writes nothing; coded usage refusals.

```
$ node --test --test-reporter=tap scripts/factory-watch.test.mjs
# tests 9  # pass 9  # fail 0
$ & "$env:LOCALAPPDATA\hermes\node\node.exe" --test --test-reporter=tap scripts/factory-watch.test.mjs
# tests 9  # pass 9  # fail 0
```

### 1.5 Docs added

- `scripts/README-cli.md` §The walk-away factory — intake/workspace, the per-brief pipeline,
  checkpoint/resume/idempotence, the "never invents success" terminal taxonomy, the honest
  limits, exit codes, and a **host-hook recipe** for Windows Task Scheduler (`schtasks /Create …
  /SC MINUTE`) and cron. Cross-linked from the `unattended` bullet.
- `package.json` script: `"factory": "node scripts/factory-watch.mjs"`.

---

## 2. F-15 — `vite.config.ts` honours `PORT`

`resolvePort()` (`vite.config.ts:29`) reads `PORT`; `server.port` (`:183`) and `preview.port`
(`:188`) use it with the **8080 / 8081 defaults kept** and `strictPort: true` unchanged. An
invalid/out-of-range `PORT` is ignored. Loading the real config through Vite proves it:

```
default      server.port=8080 strictPort=true preview.port=8081
PORT=9099    server.port=9099 preview.port=9099
PORT=not-a-port server.port=8080 preview.port=8081
```

`package.json` `"dev"` drops the hard-coded `--port 8080` so the config governs (default is
still 8080). **Honest caveat (in the code comment):** `src/lib/auth/server.ts` pins dev trusted
origins to `:8080`, so a non-default PORT serves the app but cross-origin auth callbacks do not
match — override PORT for parallel non-auth lanes, not as a general knob. This keeps AGENTS.md's
"8080 + strictPort stay fixed contracts" true for the default while adding the explicit escape
hatch the F-15 finding asked for.

---

## 3. F-16 — prettier: measured, NOT a red gate

`npx prettier --check "src/**" "scripts/**"` (2026-10-03) → **244 `[warn]` files + 1 `[error]**
(`scripts/gate.sh`: no inferable parser)**. The tree is far from prettier-clean, so a global
format gate would be a permanent red. Decision: **do not add it to `gate.sh`** (header documents
the measurement and why). Added a scoped, green check instead:
`"format:check": prettier --check "scripts/factory-watch.mjs" "scripts/factory-watch.test.mjs"`
— proven green (`All matched files use Prettier code style!`), and the two new files are
prettier-formatted.

**STOP-and-REPORT (outside ownership):** `.prettierignore:6-8` still carries the literal
`TODO(R15-f05)` asking for the gate step; removing it (or landing the tree-wide format commit it
presumes) is a different lane's file. A scoped check can be widened incrementally as the tree is
formatted.

---

## 4. F-17 — CI: the Windows leg, decided honestly; what CI certifies documented

`.github/workflows/gate.yml` header now carries a **"WHAT A GREEN CI CERTIFIES (and what it does
NOT)"** block: it certifies the four `gate.sh` gates on ubuntu-22.04 with the locked install on
Node 22.23.2; it does **not** certify Windows path handling (the `cygpath` branch, the native
`.cmd` spawn, the OV-2 class), anything keyed (no secret is declared), the browser surfaces, or
the deploy path. The dev-host pin comment remains corrected (pin = Hermes-bundled 22.23.2, not
the v24.15.0 dev host). **Windows leg decision:** the proposed `windows-leg` job stays commented
and disabled — it has never run green and doubles CI minutes; enabling it blind would trade a
documented gap for an unverified red job. The decision + rationale are in the header and point at
`fixes/247_lane5_infra.md` §A. No job was enabled (owner-gated).

---

## 5. F-20 — the child-spawn flake class: not reproduced → bounded, honest quarantine

**Root-cause attempt (bounded).** I ran `src/lib/exec.test.ts` three times under 6 CPU burners:
`run1/2/3 exit=0 pass=19 fail=0` (13.5 s total) — **not reproduced**. The class (documented in
`AGENTS.md:65-67`, `fixes/343_3_delivery.md` §7, `gate.sh:18-24`) is unbounded OS child-spawn
starvation under `node --test`'s parallel file execution: wall-clock-bounded assertions
(`CLOSE_GRACE_MS*4` in `exec.test.ts:279-282`; the commit-count assertions after `spawnSync git`
in `headless.test.ts:4669/4709`) can be crossed, or a spawn can return a null status, under
scheduler contention. The exact assertion in the 343-3 `landEmittedTree` flake was never
characterized (the filtered log lost it), so a true root-cause needs a host that reproduces.

**Bounded, honest quarantine (landed in `gate.sh`, opt-in).** A new `--quarantine` flag adds a
small, explicit `KNOWN_LOAD_FLAKES` allowlist of EXACT test names. When an allowlisted test
fails, it is re-run ALONE (its file + a `--test-name-pattern` for that one name) and only if the
isolated run shows that test's own `ok N - <name>` line **and** `# fail 0` is it reported under
`quarantined` (with the reason) instead of forcing a red gate. This is NOT laundering: bounded
(one isolated re-run), explicit allowlist, LOUD (verdict `quarantined[]` + stderr), and
**default OFF** — without `--quarantine` the default gate is byte-for-byte unchanged and the
candidate is merely diagnosed. A second failure, or any non-allowlisted test, stays a hard red.

Pinned by `scripts/gate-verdict.test.mjs` cases **G / G2 / H / I** (isolated retry injected via
`GATE_QUARANTINE_RUNNER`, so the classification is deterministic):

```
$ node --test --test-reporter=tap scripts/gate-verdict.test.mjs   # 10 pass / 0 fail (both runtimes)
```

The **production default spawn path was also verified once against the real test** (a scratch
harness drove the extracted verdict program with the exact allowlisted `exec.test.ts` name and NO
injected runner): the program re-ran `exec.test.ts` alone, observed the test's own `ok` line, and
returned `{ exit: 0, ok: true, hardFails: [], quarantined: [{ name: "settles when a pipe-holding
grandchild outlives the child (no 'close' hang)", isolated: true, … }] }`. A spawn problem can
never break the verdict program — `isolatedRetryGreen` is wrapped so the conservative answer is
"not green" (the gate stays red), never a crash.

**Follow-up note (in the gate.sh header):** delete the allowlist entry once the spawn-starvation
race is root-caused; until then `--double` remains the boundary flake detector (exit 3).

---

## 6. F-22 — README-cli `--git` prose

`scripts/README-cli.md` §Emit now carries a full `--git` paragraph beside `--red-tree` /
`--force`: the Conventional-Commits message shape, manifest-only staging, foreign-file reporting,
the structural host-repo refusal, the idempotent `noop` re-emit, the machine-callable-by-design
vs seat-gated split, and the "refusal flips ok:false, exit 1, emitted tree still on disk"
contract. `scripts/README-cli.test.mjs` re-run: **12 pass / 0 fail** both runtimes.

---

## 7. Keyed usage (real money — bounded ≤3, measured)

Env gotcha found and reported: **PowerShell `$env:DEEPSEEK_API_KEY=""` REMOVES the variable**
(`'DEEPSEEK_API_KEY' in process.env === false`), so `doctor` still reported `configured: true`
from the repo `.env` — i.e. my early "keyless" probes were actually KEYED. The committed test
forces keyless correctly (a JS env object with `DEEPSEEK_API_KEY: ""`), which is why it stalls at
the deterministic P6 red. All three keyed drives are measured (provider tap where set, plus the
project's persisted `tokenUsage` ledger):

| # | drive | outcome | calls | prompt | completion | total | est. cost† |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | `unattended` probe | complete (P12) | 7 | 11,967 | 9,712 | 21,679 | $0.0090 |
| B | factory tick (manual) | **delivered** (commit 976afe8) | 5 | 7,766 | 4,956 | 12,722 | $0.0050 |
| C | factory tick (measured) | stalled `RT_E_GATE_PENDING` | 12 (tap) / 9 (project) | 25,568 / 23,792 | 18,913 / 14,724 | 44,481 / 38,516 | $0.0181 |

† Estimated at the repo's documented off-peak cache-miss flash rates
(`research/multiagent/90_LEAPFROG.md` §12.3.1: $0.22/$0.66 per 1M) — an estimate, not a bill.
Run C's 12 tap records vs 9 project-ledger calls: the tap also observes live-research calls the
project ledger does not fold. **Total measured ≈ 78,882 tokens ≈ $0.032.** Only 3 keyed drives
were run (the bound). `RT_E_LLM_KEY_SHADOWED` was not surfaced (no ambient conflict this session).

---

## 8. Targeted suites (both runtimes; no full gate — siblings editing)

| suite | Node 24.15.0 | Node 22.23.2 |
| --- | --- | --- |
| `scripts/factory-watch.test.mjs` | 9 pass / 0 fail | 9 pass / 0 fail |
| `scripts/gate-verdict.test.mjs` | 10 pass / 0 fail | 10 pass / 0 fail |
| `scripts/README-cli.test.mjs` | 12 pass / 0 fail | 12 pass / 0 fail |
| `scripts/typecheck-scripts.test.mjs` | 6 pass / 0 fail | — |
| `npx tsc -p tsconfig.scripts.json --noEmit` | exit 0 | — |
| `npx eslint` (changed JS/TS) | exit 0 | — |
| `npm run format:check` (scoped) | green | — |
| `bash -n scripts/gate.sh` (git-bash) | exit 0 | — |

`git rev-parse HEAD` before/after every run: **`988b158f180c6cc92aafa4109f4d83a1483e4914`**
(unchanged). `git status` shows only the owned tracked files modified plus the two new scripts;
the `src/**` modifications are siblings'.

---

## 9. What remains / what is honestly NOT automatable

1. **Keyed completion is not guaranteed.** The factory can stall at a hard P6 DoD gate even with
   a funded key (run C). The factory does not repair and does not clear a `forceHuman` gate; a
   stalled project is left for a human with its coded reason. Walk-away delivery therefore means
   "drain and deliver the ones that seal clean", not "everything ships".
2. **Keyless never delivers** (the deterministic floor seals with the P6 red) — an honest,
   documented stall, not a bug.
3. **F-16 global prettier gate** stays out (244 drifts); `.prettierignore:6-8`'s `TODO(R15-f05)`
   is a STOP-and-REPORT (not owned). `format:check` is scoped to the new files, to widen as the
   tree is formatted.
4. **F-20** is mitigated (bounded, opt-in, loud) but not root-caused — needs a reproducing host;
   follow-up recorded in the `gate.sh` header.
5. **F-17 Windows leg** remains an owner decision; the workflow has still never executed.
6. **Multi-tick daemonisation** is deliberately absent: the host hook (Task Scheduler / cron) is
   the scheduler, and every tick is idempotent.
