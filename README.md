# RapidTool

A **deterministic, governed workbench for building software with AI agents**. RapidTool compiles
a client brief into an audited, phase-by-phase build: research → architecture → interface →
synthesis → verification → a paste-ready **Agent Packet** — all behind evidence-hashed DoD
gates, an append-only decision ledger, and a hard no-fabrication **honesty contract**.

**Two surfaces, one engine:** a browser app (TanStack Start + React 19, `http://localhost:8080`)
and a file-based headless CLI (`scripts/rapidtool-cli.mjs`, **34 verbs**) that drives the same
pure engine with no browser and no server.

> **Status (2026-09-16, after Waves 1–4 of the factory-upgrade program):**
> `bash scripts/gate.sh` → **`ok:true`** (typecheck 0 · lint 0 · assertion-gap lint 0 ·
> scripts **220/220** + src **1803/1803** tests · build 0). All of that is re-runnable by you:
> the gate script emits a single JSON verdict. RapidTool is **not yet** an autonomous software
> factory that beats Codex/OpenHands/Claude Code — and it **tells you that itself**:
> `doctor` reports `autonomousSoftwareFactory: false` with named `gaps[]`. The remaining
> code-level work is catalogued wave-by-wave in **[`remainingwaves.md`](remainingwaves.md)**.

---

## Quickstart

```bash
# Requirements: Node 22 (verified on v22.23.2), npm
npm install

# Browser app → http://localhost:8080 (host/port are a fixed contract in vite.config.ts)
npm run dev

# Full stability gate (6 checks + JSON verdict; --double adds a flake detector)
bash scripts/gate.sh

# Headless CLI — the factory without a browser
node scripts/rapidtool-cli.mjs doctor                       # environment truth
node scripts/rapidtool-cli.mjs new "your brief here"        # intake → project
node scripts/rapidtool-cli.mjs run --until-hitl             # run to the next human gate
node scripts/rapidtool-cli.mjs approve --i-am-human         # pass the HITL seat (or autopilot)
node scripts/rapidtool-cli.mjs doctor --tree <project-dir>  # job-file census for an emitted tree
```

Environment: `DEEPSEEK_API_KEY` in `.env` enables LLM-backed phases (P6 synthesis, Chat,
expansion). Without it the engine still runs and is honest about skips. Research probes use
free keyless sources (duckduckgo/searxng/wikipedia) and report what they could not reach.

---

## What RapidTool is (and its architecture in one screen)

```
brief ──► intake ──► P0..P12 phase engine (pure, deterministic, headless-capable)
                        │
                        ├─ P0-P6  research → architecture → interface → SYNTHESIS (the build)
                        │           · chunked LLM synthesis, validated + bounded repair
                        │           · compile-check, oracle rows (A7), tree-run verdicts
                        ├─ P7-P12 packet/tail artifacts (see "limits" — candidly partial)
                        │
                        └─► DoD gates (evidence-hashed) · decision ledger (append-only)
                            · verify-fix loop (machine) · Agent Packet (paste-ready)
                            · knowledge vault (Obsidian-style) · self-learning store
```

- **Engine:** pure TypeScript modules in `src/lib/*.server.ts`, driven by
  `headless.ts` (journey/runHeadless) and `engine.ts` (phase state machine). The browser and
  CLI are both thin surfaces over it.
- **Governance:** every approval carries a **seat** (`autopilot` vs a human seat that requires
  an out-of-band token), every phase transition needs evidence, and refusals are **coded**
  (`RT_E_*`) rather than silent.
- **Synthesis:** P6 asks a model for module code in **signature-bound chunks**, then
  compile-checks and runs each job module's own oracle. Prose-in-code, `Math.random`, and
  forbidden primitives are **refused** (with one bounded repair attempt each, then a coded
  refusal — never a fabricated pass).
- **Trust model:** byte-level. If the product's own `npm test` fails, `tree-run` can never
  report `ok: true`; a red verdict survives in the durable trail and `emit` refuses (or
  banners, on the eval path) — it cannot be shipped quietly.

Key files: `src/lib/engine.ts` · `headless.ts` · `codegen.server.ts` (P6 + chunk planning) ·
`scaffold.ts` (tree writer) · `compile-check.server.ts` + `node-runner.server.ts` (bounded
runner — **not a sandbox**) · `verify.server.ts` + `dod.ts` (oracles) · `doctor.ts` (environment
truth) · `packet.ts` + `phases.ts` · `console.tsx` (UI) · `scripts/rapidtool-cli.mjs` (34 verbs).

---

## What it does today — capabilities that pass tests right now

| Capability | State | Proof |
|---|---|---|
| 13-phase engine, resumable state, append-only ledger | ✅ | `src/lib/engine.ts` + suite; `runHeadless` tests |
| Brief → plan → architecture → interface artifacts | ✅ | P0–P5 module suites |
| Chunked LLM synthesis with gates + bounded repair | ✅ | `codegen.server.test.ts` (86 tests) incl. refusal e2e |
| Prose-in-code / `Math.random` / forbidden-primitive refusal | ✅ | T-09/T-15 wiring + e2e pins (Wave 2–3) |
| Oracle rows: each job module must pass its OWN behavioral test | ✅ (engine) | `verify.server.ts`; tree-run executes them |
| **tree-run = the product builds and tests** | ✅ | T-18 (Wave 3): runs the tree's own `npm run typecheck`+`npm test`; a failing tree can never be `ok:true` |
| Honest emission: refuse/banner on an uncleared red tree | ✅ | T-07 (Wave 2): `redTree` policy; refusal leaves nothing on disk |
| HITL seats: no machine path can mint `decidedBy:"human"` | ✅ | TA-2 (Wave 2): `ApproveActor` + out-of-band token |
| Lesson loop: failure signatures, refusal rows, accrual | ✅ wired+pinned | 112 T1/T2 (Waves 3–4); `knowledge.ts`/`engine.ts`/`verify.server.ts` |
| Assertion-gap lint (tautology detection repo-wide) | ✅ | `scripts/check-assertion-gaps.mjs`; wired into `gate.sh`; 0 findings |
| `str_replace` patch primitive (unique-match + graded fuzzy) | ✅ core | `src/lib/patch.ts` (21 tests). **Not yet wired into P6/repair — W6** |
| One-seam policy engine (default-deny approvals) | ✅ core | `src/lib/policy.ts` (27 tests). **Routing not yet wired — W5** |
| UI: console, phase rail, HITL dock, runtime log, **command palette (⌘K)**, typed timeline | ✅ | `console.tsx` + `cmd-palette.tsx` + `runtime-timeline-pane.tsx` |
| Headless CLI: 34 verbs, JSON output, doctor, eval harness | ✅ | `scripts/rapidtool-cli.mjs`; `README-cli.md` (doc-contract tested) |
| Stability gate with flake detection | ✅ | `bash scripts/gate.sh [--double]` (first green run 2026-09-16) |

## What it does **not** do yet — the honest limits

1. **The emitted product is still ONE module wearing several filenames.**
   The headline open item (TA-15). On the reference corpus,
   `doctor --tree research/eval-out/coffeehouse2home-property-ledger` → `{stubs: 0,
   reexports: 5, real: 0}`: every `src/jobs/*.ts` re-exports the single hosted module. The
   rewire is fully designed (Wave 4) and lands in **W5** — until then, RapidTool does **not**
   emit a real multi-job product, and it must not be claimed to.
2. **P7–P12 phases often produce no artifacts.** The engine reports this honestly now
   ("Phase coverage: N of 13 / M artifacts from P7–P12" in every packet). Unblocking them is
   roadmap, not reality.
3. **No real isolation.** The bounded runner executes with timeouts + scrubbed env but it is
   **not** a sandbox — no Docker/bwrap. Doctor says `sandbox: false`, and nothing may claim
   otherwise.
4. **No git landing / checkpoint-resume yet** (T4.x, T-107.7): the factory emits trees; it
   does not commit them or snapshot/resume mid-run.
5. **LLM work needs a key.** Without `DEEPSEEK_API_KEY` the phases that call a model skip
   honestly; a *keyed* full run also costs tokens — budgets/ledger unification is roadmap
   (T-107.6).
6. **Chat is grounded tools + one-shot model text.** No shell, no disk patch, no agents from
   chat.
7. **Verification is deep but local.** 2000+ tests run on this machine; CI wiring, cross-machine
   reproducibility, and pass@k eval statistics are roadmap (T-107.5).

## Progress so far (the paper trail)

Four multi-agent waves ran 2026-09-16 (20 flash subagents, ~4h wall, every wave closed with
`gate.sh`-class green): W1 corruption-class fixes → W2 repair/consolidation (T-07/TA-2, gates
wired) → W3 tree-run builds+tests (T-18), lesson-loop wiring, UI wave → W4 Wave-H cores +
UI finish + T-14 pins + gate.sh's first green run. **Every landing is verified against bytes
and logged:**

- `taskuniverselog.md` — the live board: every task, status, and what remains, per dossier.
- `fixes/216b…216n_*.md` — per-workstream landing logs (what/why/file:line/evidence).
- `wave_plans/W4/lane-*.md` — the per-lane dispatch plans the agents actually followed.
- `RESUME.md` — full session handoff + hard rules + settled decisions.
- `research/multiagent/*.md` (36 dossiers) — the analysis program behind all of it.
- **`remainingwaves.md` — every remaining wave, task by task, with the files each touches,
  estimates, likely bugs, and the tests each needs.** ← start there for "what's left".

## Verification — how to check every claim above

```bash
bash scripts/gate.sh          # the one command: 6 gates, JSON verdict, exit 0 required
node scripts/rapidtool-cli.mjs doctor          # env/factory truth incl. autonomousSoftwareFactory
npm run eval                  # the acceptance harness (fixtures); needs a key for real runs
```

Nothing in this README is a promise — each row above is pinned by a test or a command you can
re-run. Where reality is behind, the docs say so, the packets say so, and `doctor` says so.

## Docs index

| Doc | Purpose |
|---|---|
| `remainingwaves.md` | **Every remaining wave** with tasks/files/estimates/bugs/tests |
| `taskuniverselog.md` | Live task board (status of every task from every dossier) |
| `RESUME.md` | Session handoff: gates contract, hard rules, settled decisions |
| `AGENTS.md` | Agent contract: mandatory reads, working rules |
| `README-cli.md` (in `scripts/`) | CLI verb reference (doc-contract tested) |
| `AGENT_GUIDE.md`, `packet-e2e.md` | Operational guides |
| `research/multiagent/` | The 36-dossier analysis program (what/why behind every fix) |

## License

MIT (see `LICENSE`).
