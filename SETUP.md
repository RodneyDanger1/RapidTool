# SETUP — everything you need to run RapidTool

This is the complete dependency and step list. It is written to be followed top to bottom by a person or
an agent on a fresh machine. Every command here was run on Windows 11 with PowerShell 5.1 and Node
v24.15.0 on 2026-10-15.

---

## 1. What you need (dependencies)

**Required**

| Dependency | Why | How to check |
|---|---|---|
| **Node.js ≥ 22** | The engine and tests run TypeScript directly via `--experimental-strip-types`; the contract is `engines.node: ">=22"` | `node -v` |
| **npm** (bundled with Node) | All scripts route through `npm run …` | `npm -v` |
| **Git** | History, and `emit --git` landing | `git --version` |
| **~2 GB free disk** | `node_modules` + the build output | — |

**Required for a *keyed* run** (one that actually calls a model)

| Dependency | Why |
|---|---|
| **A DeepSeek API key** (`sk-…`) | Live research narrative, P6 code synthesis, `crew`, `verify`, `chat`. Without it the tool still runs — keyless — on a deterministic floor and says so (`RT_E_LLM_NOT_CONFIGURED`) |

**Optional**

| Dependency | Why |
|---|---|
| **Git Bash** (`C:\Program Files\Git\bin\bash.exe`) | Runs `scripts/gate.sh`, the 11-stage stability gate |
| **Playwright browsers** | UI verification (`scripts/browser-smoke.mjs` takes desktop + mobile screenshots). Installed as a devDependency; browsers come from `npx playwright install chromium` |
| **GitHub CLI (`gh`)** | Only if you want to create/push repos from the terminal |
| **Tavily API key** (`TAVILY_API_KEY`) | Optional external search. The chat-completions API has no built-in web search, so grounding uses this or the free search seam |
| **A database** | Not required. With no `DATABASE_URL` the app uses **PGLite** (Postgres compiled to WASM) and persists to a local data dir |

**What Node version does *not* matter for:** the repo pins `>=22`; both v22 and v24 satisfy it. The docs'
`22.23.2` is the Hermes-bundled runtime, not a requirement.

---

## 2. Install

```powershell
git clone https://github.com/RodneyDanger1/RapidTool.git
cd RapidTool                       # or: cd "C:\Users\mnril\Desktop\RapidTool Main"
npm install
```

> **Windows path note:** if your path contains a space (e.g. `RapidTool Main`), **always quote it**.
> `ripgrep`-style tools fail on the space; use `Select-String` in PowerShell.

---

## 3. Configure the key (optional but recommended)

Create a file named `.env` in the **repo root**:

```
DEEPSEEK_API_KEY=sk-your-key-here
```

Rules the code actually enforces (verified on the bytes):

- `<cwd>/.env` **wins over** the process environment. Run the CLI from the repo root so it finds this file.
- A **present-but-blank** value is an intentional *keyless* run — not an error.
- A differing non-blank value in your environment **loses** to `.env`, and the CLI emits
  `RT_E_LLM_KEY_SHADOWED` (tails only) so you know a shadow exists.
- `.env` is **gitignored** and must never be committed. Never prefix a secret with `VITE_` — that inlines
  it into the browser bundle.
- Models used: `deepseek-v4-flash` (default; thinking disabled for speed) and `deepseek-v4-pro`
  (thinking enabled). The live-verified API spec is `research/deepseek-api.md`.

---

## 4. Verify the install (30 seconds, no key needed)

```powershell
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor
```

Expected: one JSON object with `"ok": true`, `llm.configured` (true/false per your key),
`runner.available: true`, `isolation.sandbox: false`, and the factory fields
(`autonomousSoftwareFactory: false` — that is **by design**, see §9).

Then the day-to-day gates — all should be green:

```powershell
npm run typecheck
npm run lint
npm test
```

And the full gate (needs Git Bash):

```powershell
& 'C:\Program Files\Git\bin\bash.exe' scripts/gate.sh
# add --double to detect flakes
```

The gate prints one JSON verdict and its stages: `typecheck`, `lint`, `assertionGaps`, `prevention`,
`moduleCoverage`, `testsScripts`, `testsLib`, `build`, `ratchet`. Exit 0 means every stage passed.

---

## 5. Run it

### 5a. The console (browser)

```powershell
npm run dev            # http://127.0.0.1:8080  (loopback only, strictPort)
```

Open the URL, create a project, and you get a run screen with a phase rail and 12 tabs: artifacts,
preview, agent packet, chat, spec graph, crew, oracle, vault, design, diagram, runtime log, and eval
fixtures. Keyboard: `e` execute phase · `g` run to next gate · `a` approve · `/` search · `Ctrl+K` palette.

`RAPIDTOOL_BIND_ALL=1 npm run dev` binds `0.0.0.0` — only on a network you trust.

### 5b. The headless CLI (39 verbs, one JSON object per call)

```powershell
# make a project from a brief
node --experimental-strip-types scripts/rapidtool-cli.mjs create --name "My Build" --brief "A CLI tool that ..." --out build.json

# drive it to its next human gate, approve, and advance
node --experimental-strip-types scripts/rapidtool-cli.mjs gate    --project build.json --autopilot
node --experimental-strip-types scripts/rapidtool-cli.mjs approve --project build.json --seat autopilot

# write the product tree out, and run the tree's OWN declared toolchain
node --experimental-strip-types scripts/rapidtool-cli.mjs emit --project build.json --out emitted/ --run
```

**Exit codes:** `0` success · `1` red gate / red tree · `2` parked at a human gate · `3` backend not
configured · `4` runtime failure · `5` tree green but its declared toolchain could not be resolved.

Useful verbs: `doctor` (pre-flight), `diagnose` (telemetry + likely cause), `summary`, `artifacts`,
`packet`, `export`, `tree-run`, `repair`, `wild`, `unattended`, `resume`.

### 5c. The quality ratchet — "is it actually improving?"

```powershell
node scripts/quality-ratchet.mjs --all        # 50 metrics against pinned floors
node scripts/quality-ratchet.mjs --selftest   # planted regressions; must catch every floor
```

Floors live in `scripts/quality-ratchet.floors.json` and **may only rise**. A metric that cannot be
measured reports `unavailable` with a coded reason and never passes silently. This is the instrument to
run after *any* change, and the reason a reader edit cannot masquerade as progress.

### 5d. The keyless proof layer

```powershell
node scripts/prevention/verify-prevention.mjs --all --selftest
```

34 guards replayed over pinned fixtures, reporting two independent signals: does each guard still **fire**
on the historical defect it was written for, and is its fixer seam **wired**. `missed:[]` and `pending:[]`
with `count >= countFloor` is the passing shape.

---

## 6. Run a bounded keyed campaign (costs real money)

```powershell
$env:RAPIDTOOL_CAMPAIGN_TOKEN_CAP = "1000000"     # a hard cap
node --experimental-strip-types scripts/acceptance-run.mjs `
  --suite <dir-of-briefs> --out <out-dir> --max-steps 14 --token-ledger <ledger.json>
```

Read the roll-up honestly: per-brief `verdict.json` files plus the summary line. `estimatedCostUsd` is
always `null` — spend is never fabricated. **Run-to-run variance is the dominant factor** for keyed
synthesis; the repo's own campaigns scored 0/8 → 2/8 → 4/8 `workingApp`. **No single run is the product.**

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `RT_E_LLM_KEY_SHADOWED` | a stale `DEEPSEEK_API_KEY` is set at Windows User scope | clear that variable, or ignore it — the `.env` key is the one used |
| Every keyed call fails 401/402 | wrong key, or an unfunded account | check `doctor`; the CLI names the key's source |
| `RT_E_LLM_NOT_CONFIGURED` | no key found | put `DEEPSEEK_API_KEY` in the repo-root `.env` and run from the repo root |
| `emit` writes nothing, exit 1 `RT_E_PLAN_UNDERPRODUCED` | the plan is below floor and the default policy is **refuse** | that is the safety default; pass `--red-tree banner` to deliberately ship a labelled partial |
| `emit --git` withholds the commit | the emitted tree's own toolchain is red | read the tree-run verdict; fix or use `--allow-empty` deliberately |
| `RT_E_SRC_EDITED_DURING_RUN` | `src/**` or `scripts/**` changed mid-run | the in-run lock is doing its job; re-run on a quiet tree |
| `npm test` stops after the scripts leg | the legs are chained with `&&`, so a red leg blocks the next | fix the scripts leg first; the src leg count is then the real one |
| Port 8080 in use | `strictPort` is a contract | `PORT=8090 npm run dev` (auth callbacks still expect 8080) |
| Windows Build Tools / native module errors | some optional deps want a compiler | `npm install` normally suffices; PGLite is WASM, so no database is needed |

---

## 8. What RapidTool *does* right now (verified)

- A deterministic **13-phase governed run** (P0→P12) with resumable state and an append-only decision ledger.
- **Keyless-first**: every path has an honest floor and a coded refusal, so it works with no key and never
  fakes model text.
- **Brief → plan → architecture → contracts → synthesis → verification → emission**, with the emitted tree
  forced through **its own** `typecheck`/`test` before it can be called ok.
- **Real multi-module emission** on a keyed run; the emitted product passes its own declared toolchain for
  the `app` kind (see §9 for the kinds still broken).
- **39-verb CLI** + a 12-tab console over one engine.
- **34 keyless prevention guards** and a **50-metric quality ratchet**, both with planted-regression teeth.
- **Auth that is real when enabled and byte-inert when disabled** (`VITE_AUTH_ENABLED=false` ships).
- **Honest cost/token accounting**: token usage measured, `estimatedCostUsd` never invented.

## 9. What it does **not** do yet (honest limits)

- **`doctor` reports `autonomousSoftwareFactory: false` — by design.** That flag requires a
  human-approved fixture row stamped through an out-of-band seat; a machine path may never mint
  `decidedBy:"human"`.
- **Three of five project kinds cannot compile their own emitted source** (`game`, `tool`, `service`,
  `library`): the site emitter is not kind-gated and the emitted `tsconfig`'s `jsx` is a hard-coded list.
  `app` is green. This is the **only failing test** in the repo and is the current wave's P0.
- **The keyed P6 DoD gate is the binding constraint.** Synthesis quality is the wall, and variance is
  dominant, so a single green run proves nothing.
- **No per-project agent bus** — agents cannot message each other; delegation is `currentPhase + 1`.
  (**SH0RTBUS** is the planned fix, as its own project.)
- **Function calling is unused** even though the API supports it.
- **The learning loop is open at the join**: the bounded improvement driver `iterateToSatisfaction` has no
  production caller, and nothing reads the eval results back into a prompt.
- **Isolation is a runtime bound, not an OS sandbox**: generated code runs under Node's Permission Model
  (fs writes confined, subprocess/worker/native denied, 512 MB heap) — no Docker/bwrap/AppContainer, and
  no network denial. `doctor` keeps `isolation.sandbox: false` and never claims otherwise.
- **No in-product scheduler/daemon** — an external host hook is the scheduler by design.
- **Cross-family provider failover is unimplemented.**
- **3 stub modules remain in the pinned product trees** (`TODO(E-15)` in two emitted trees), tracked at an
  honest bar of zero.

---

## 10. Where to go next

| Doc | What for |
|---|---|
| `NEXTSTEPS.md` | The handoff: state, recent changes, remaining waves, how to finish |
| `AGENTS.md` | The repo working contract (read before changing code) |
| `START-HERE.md` · `RUNBOOK.md` | Orientation · the human operator's runbook |
| `scripts/README-cli.md` | The CLI machine contract: every verb, exit code, `RT_E_*` registry |
| `research/deepseek-api.md` | The live-verified DeepSeek API spec |
| `wave_plans/W<N>/` | Per-lane dispatch notes for each wave |
| `fixes/NN_*.md` | Append-only landing logs (newest wave = highest number) |
| `research/multiagent/thoroughanalysis.md` | The append-only finding register |
