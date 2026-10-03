# START-HERE — RapidTool (read me first)

> **Written:** 2026-09-26 by the W32 organizer lane (log: `fixes/275_organizer.md`). Commands below were
> **executed and verified** on this machine the same day (HEAD `0f85c32` + the 13 live lanes' uncommitted
> edits). The folder is under **active multi-agent construction** — the disk is truth, status docs are
> snapshots; verify before trusting.

**What this is.** RapidTool (repo folder `RapidTool Main`) is a **governed 13-phase delivery harness**:
a brief goes in, the pure TypeScript engine runs P0–P12 behind evidence-hashed DoD gates, an append-only
decision ledger and a hard no-fabrication honesty contract, and produces a paste-ready **Agent Packet** —
driven either by the browser console (TanStack Start + React 19) or by the file-based headless CLI. It is
one engine with two thin surfaces, not a starter template. It is **not yet** an autonomous software
factory that beats Codex/OpenHands/Claude Code — and it says so itself (`doctor` →
`autonomousSoftwareFactory:false` + named `gaps[]`). The remaining autonomous-factory capabilities are
**shelled or in progress** (each shell compiles, is wired to ≥1 real call site or refuses honestly with a
coded reason, and marks its gap `TODO(<row-id>)`): see **`finalsprint.md`** (the W30 shell-sprint master
table). The authoritative **finding register** is **`research/multiagent/thoroughanalysis.md`** (the
W25–W28 deep audit, IDs `A*`/`C*`/`W-*`/`R*`/`T*`; append-only protocol in its header).

---

## The 10-line tour

| # | Where | What lives there |
|---|---|---|
| 1 | `src/lib/` (213 files) | The pure engine + logic. Start with `engine.ts` (phase state machine), `headless.ts` (journey driver), `codegen.server.ts` (P6 synthesis), `store.ts`, then `phases.ts` · `packet.ts` · `dod.ts` · `io.ts` · `errors.ts` (the `RT_E_*` registry). Tests are colocated `*.test.ts`. |
| 2 | `src/components/` + `src/routes/` | The UI: `console.tsx` (main console) + TanStack routes. |
| 3 | `scripts/rapidtool-cli.mjs` | The headless CLI — **39 verbs** (`grep -c 'case "'` is the count source of truth), single JSON object per call; contract = `scripts/README-cli.md`. |
| 4 | `scripts/` (46) | `gate.sh` (the stability gate) · `run-eval.mjs` (eval harness) · guards/tooling + `*.test.mjs` suites. |
| 5 | `fixes/` (587) | The **append-only landing logs** — one per lane per wave. The newest number = the current wave. Read the last few to know what just landed. |
| 6 | `wave_plans/` (108) | Per-lane dispatch plans (`W4`→`W43`, one file per lane) + the convention note in `wave_plans/README.md`. |
| 7 | `research/multiagent/` (103) | The analysis program: dossiers, readiness plans (`94`, `104`), defect ledgers (`93`), and the register **`thoroughanalysis.md`**. |
| 8 | `research/eval-corpus/` (23) | The acceptance corpus: 11 brief fixtures + `graders/`. `research/eval-out/` = **tracked** trial outputs (`results.json`, `history.json`, emitted trees). |
| 9 | Root docs | `README.md` (quickstart + honest limits) · `AGENTS.md` (working contract) · `RESUME.md` · `taskuniverselog.md` · `remainingwaves.md` · `finalsprint.md`. Full depth-2 map: **`docs-FOLDER-MAP.md`**. |
| 10 | `migrations/` · `public/` · `.github/` | Deploy SQL · static assets · CI workflow. |

**Path gotcha:** the folder name has a space — `cd "/c/Users/mnril/Desktop/RapidTool Main"`, and
ripgrep-style tools fail on it; use terminal `grep`. Node **22** required (verified v22.23.2).

---

## Read order for agents (cold start)

1. **`AGENTS.md`** — the repo working contract (layout, commands, honesty rules). Mandatory.
2. Repo's own session-start set, per `AGENTS.md`: **`RESUME.md`** → **`taskuniverselog.md`** → **`remainingwaves.md`**.
3. **`research/multiagent/thoroughanalysis.md`** — the register: every defect/gap finding vs the mission, with `file:line` evidence. Read the header protocol before appending anything.
4. **`finalsprint.md`** — the W30 shell-sprint master table: every remaining capability, its shell status, and what it needs to become real.
5. **The live lane logs** — `fixes/271_*` (W29 coders) · `fixes/272_*` (W30 shells) · `fixes/273_*` · `fixes/274_*` · `fixes/275_*` (this wave) + your dispatch note in `wave_plans/W32/<lane>.md`.
6. **`docs-FOLDER-MAP.md`** — the depth-2 map so you can navigate without grepping blindly.

---

## Run commands (each one verified or explicitly marked with why not)

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"          # the space matters

# 1) Environment/factory truth — runs in ~4s, exit 0, single JSON object. VERIFIED 2026-09-26.
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor

# 2) Day-to-day gates — read-only w.r.t. files. Run them; keep them at 0.
npm run typecheck   # VERIFIED to run (~75s). Can be RED mid-wave from lanes' in-flight edits.
npm run lint        # VERIFIED: exit 0 + 1 warning (scaffold.ts 'kindHandoff' unused) as of 2026-09-26.

# 3) Full test suite — BOTH legs: scripts first, then the src suite.
npm test            # NOT re-run mid-wave (full-gate rule — 13 lanes editing). Last full green:
                    # W12 boundary gate of record, fixes/218 §5 — scripts 261/261, src 1957/1957.

# 4) Eval harness — keyless = deterministic floor; live runs need --keyed + a funded DEEPSEEK_API_KEY.
#    NOTE: even keyless rewrites TRACKED artifacts (research/eval-out/results.json, history.json).
npm run eval        # NOT run mid-wave (would dirty the tree; account unfunded → keyed calls 402).

# 5) The full gate — boundary-only: typecheck → lint → scripts → src suite → build (+ JSON verdict).
bash scripts/gate.sh   # --double adds a flake detector. NEVER while agents are mid-edit.
```

`npm run dev` serves the console at `http://localhost:8080` (host/port are a fixed contract in
`vite.config.ts`). CLI verbs and the exit-code taxonomy (0/1/2/3/4; 2 = parked at a HITL gate or `blocked`)
are documented in `scripts/README-cli.md` §Agent contract.

---

## Honest state (2026-09-26, HEAD `0f85c32` + uncommitted lanes)

**Works today** (pinned by tests/commands you can re-run): the 13-phase deterministic engine with
resumable state + append-only ledger · brief→plan→architecture→interface artifacts · chunked LLM
synthesis with gates + bounded repair (keyless = honest floors + `RT_E_LLM_NOT_CONFIGURED`, never fake
text) · banned-primitive refusals (prose-in-code / `Math.random`) · oracle rows + `tree-run` (the emitted
product must pass its OWN `npm run typecheck`+`npm test`; a red tree can never be `ok:true`) · honest
emission (redTree refuse/banner) · HITL two-channel seats (no machine path mints `decidedBy:"human"`) ·
CLI 39 verbs incl. `doctor`/`diagnose`/read-only `eval` scorecard · the console UI (9+ tabs, ⌘K palette,
runtime log) · `gate.sh` with flake detection (first green run 2026-09-16).

**Shelled / in progress** (per `finalsprint.md`; shells only — no fake behavior, each has
`TODO(<row-id>)` at its gap): the autonomy spine (wild keyed seam W-01 · mint reachability W-02 · emit
materialization W-03, landing) · wild supervisor completer (R14-f01) · unattended run (W-47) ·
plan-before-execute (R13-f02) · checkpoint+`resume` (T-107.7) · 4 kind emitters + real graders + emitted
UI seam (S2) · cassette replay (T5.7) · streaming surface (T5.1) · MCP client (F1) · second provider
(F2) · per-action allow-lists (F4) · per-run token ledger · dev-server bind hardening (R11-f01) ·
`--force` quarantine (R11-f08 — CLI wire landed W42; in-engine lift owed) · pane error boundary (R6-f12) · human-seat console surface.

**Blocked / known limits** (honest, not bugs to paper over): no isolation boundary — the bounded
node-runner is **NOT a sandbox** (R13-f04 = honest refusal; needs a host isolator) · keyed evidence runs
blocked by funding (DeepSeek account unfunded → 402; O-1) · the emitted product is still ONE module
wearing several filenames (TA-15) · P7–P12 phases often produce no artifacts · no git landing / no
cross-machine reproducibility · Chat = grounded tools + one-shot text, no shell/agents.

---

## Never do (hard rules, earned by breaking things)

1. **Never print or copy secrets** — `.env`, `.env.bak-*` (keys are server-side only; never `VITE_`-prefix them).
2. **Never run the full gate while agents are mid-edit** (`gate.sh`, `npm test`, `npm run build`) — targeted checks only; attribute any red by comparing the failing file's mtime against your run window first.
3. **No keyed LLM calls while the account is unfunded** (all calls 402). Keyless = honest floors; never fake model text.
4. **Never move, rename, or delete anything under `src/`, `scripts/`, `migrations/`, `research/eval-corpus/`** — imports, tests and running lanes depend on exact paths. (Reorganization there needs a boundary + codemod: see `fixes/275_organizer.md` future items.)
5. **No commits, no fabrication, no silent mutations.** Deletions only when untracked + zero-references + not in any live lane log. Logs are append-only. The boundary owner commits.
6. **Don't touch another lane's files.** Ownership is disjoint per wave; cross-lane needs go in the final report, not in the tree.

---

## CORRECTION — 2026-10-02 (the 331 wave): the keyed path is NOT funding-blocked

This supersedes three lines above and one hard rule. **The DeepSeek account is funded, and the key in
this repo's `.env` works.**

**Measured (2026-10-02):** `GET https://api.deepseek.com/models` and `POST /chat/completions` with the
repo `.env` key both return **200** for `deepseek-v4-flash` and `deepseek-v4-pro`, with real completions
and billed usage.

**Why every earlier wave saw 401/402 and wrote "account unfunded":** the machine had a stale
`DEEPSEEK_API_KEY` set at **Windows User scope** (an invalid value) and **nothing in the repo loaded
`.env`** — `grep -rn 'loadEnvFile|dotenv' src scripts .grok` returned zero hits, and
`scripts/with-app-env.mjs` merges only `.grok/app-env.json` and only `VITE_*` keys. So the CLI sent the
stale key and every keyed call failed. The funding diagnosis was wrong; the credential plumbing was
broken.

**Fixed** on all three surfaces — CLI, provider read, and the Vite dev server — with a documented
precedence matrix (present-but-blank ⇒ keyless; absent ⇒ `.env`; a differing non-blank ambient value
loses to `.env` behind the coded `RT_E_LLM_KEY_SHADOWED` signal, tails only), a 401 now classified as
`RT_E_LLM_KEY_REJECTED` with its source named, and no more libuv abort on the red path. A real browser
keyed action from the console returns real model text.

- Supersedes line 71 (`npm run eval` comment: "account unfunded → keyed calls 402"). The reason not to
  run `npm run eval` remains that it **rewrites tracked** `research/eval-out/**`.
- Supersedes line 104 ("keyed evidence runs blocked by funding … O-1"). Keyed runs work; the emitted
  multi-job product is real (`treeRun.substance {stubs:0, reexports:0, real:3}` on a keyed run). The
  remaining gap is the last mile recorded in `fixes/331_0_parent.md` §6.8.
- Supersedes **hard rule 3**. Replacement: **"Never fake model text, and never run keyed calls in a
  loop — bounded calls only, each reported with its measured usage. Keyless = honest floors."** The
  key is funded; spend is real money.
- Owner action, not code: clearing the stale User-scope `DEEPSEEK_API_KEY` silences the shadow signal.
  It was left in place because other tools on this host may read it.

Evidence: `wave_plans/W45/parent-keyed-findings.md`, `fixes/331_0_parent.md`, register `AW45-c01…c08`.

## CORRECTION — 2026-10-02 (W47 record audit): the "ONE module" qualifier + drifted snapshot counts

Completes the funding correction above and supersedes the snapshot values in "The 10-line tour" and
"Honest state (2026-09-26)".

- **The emitted product is no longer "still ONE module wearing several filenames" on a keyed run.** Line
  105's flat claim now holds only on the **keyless floor**. A keyed run emits a real multi-job product:
  the 331 wave's run emitted **7 real job modules** (`fixes/331_0_parent.md` §2) and the 332 wave's run
  reached `inventory {stubs:0, reexports:0, real:2}`, `leftoverJobsAreReexportsOrStubs:false`
  (`fixes/332_0_parent.md` §4). (The previous CORRECTION superseded line 104's funding half only; this
  supersedes line 105.)
- **Drifted snapshot counts (measured 2026-10-02, HEAD `6575669`):** `src/lib/` is now **222** tracked
  files (was 213) · `scripts/` **49** (was 46) · `fixes/` **654** (was 587) · `wave_plans/` **123** (was
  108). `npm test` is now **scripts 398/398 · src 2736 tests / 2726 pass / 10 skipped**, exit 0 (line 67's
  "261/261 + 1957/1957" is the several-waves-old W12 gate of record). `npm run lint` is **exit 0, 0
  warnings** (line 62's "1 warning" is gone). `npm run typecheck` now covers `scripts/**` as a per-file
  ratchet (both legs exit 0); the older "'scripts/rapidtool-cli.mjs' carries typecheck errors" note is
  retired — the CLI reads **0**.

## CORRECTION — 2026-10-03 (342-6 sweep): the W47 counts have drifted again

The W47 correction's counts (src/lib 222 · scripts 49 · fixes 654 · wave_plans 123 at `6575669`) are
stale at HEAD `686d7b6`. Live `git ls-files`: **src 246 · src/lib 235 · scripts 49 · fixes 719 ·
wave_plans 139 · total 2,096**. Also: the `unattended` verb is now self-sufficient (341-6) — a stock HITL
gate whose DoD passes is cleared through the ledgered machine actor; only a `forceHuman` gate, or any red
DoD gate, still parks (`scripts/README-cli.md` §Resume and unattended).

<!-- END START-HERE · maintained by organizers · append corrections, never rewrite history -->
