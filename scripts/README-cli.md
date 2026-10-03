# rapidtool-cli.mjs — file-based headless RapidTool driver

Drive a RapidTool project with **no browser, no Vite server, no localStorage** —
just JSON files on disk. It is a thin `argv` wrapper over `src/lib/headless.ts`,
which imports the existing pure engine/io/phases/report-intake exports read-only
and dynamically imports the vault (`vault.ts`), crew (`crew.server.ts`),
verify (`verify.server.ts`), design (`design.ts`) and diagram (`diagram.ts`)
modules when their subcommands run.

**39 subcommands** (verified on disk: `grep -c 'case "' scripts/rapidtool-cli.mjs` = 39):
`create` `run` `gate` `resume` `unattended` `approve` `reject` `retry` `ingest` `packet` `export` `emit`
`tree-run` `repair` `edit` `summary` `vault` `search` `crew` `verify` `check` `design`
`diagram` `artifacts` `doctor` `diagnose` `harvest` `swarm` `prompt` `bench`
`mine` `knowledge` `lesson` `wild` `chat` `deepen` `fixtures` `scan` `eval` — from brief to verified artifact,
design tokens + SVG diagrams, an Obsidian-style knowledge vault, the
runnable-scaffold writer (`emit`), per-file compile checks (`check`), telemetry
diagnosis (`diagnose`), a bounded live-source harvester, the advisory
swarm/prompt/bench pillar tools, a cross-project pattern store, the human-gated
lesson family (`list`/`propose`/`accept`/`supersede`/`refute`/`advise`/`verify`), wild-mode
macro-runs (enable/start/pause/resume/stop), a grounded copilot turn, the E-13
research-deepen recovery, a capability pre-flight, the brief-fixture
drafter/approver (`fixtures` `--draft` / `--approve` — drafted cases stay
pending until a human approves), the in-place edit verb (`edit` — dry-run by
default, its own [Edit section](#edit-edit) below), and the emit→edit→re-emit
continuation verbs `tree-run` + `repair` (rows #31–32 below).

> **`tree-run` + `repair` + `edit` shipped (fixes/150 wave G1 + 216s); `emit --verify-kind` shipped
> too (fixes/216z · T4.1).** The dir-based continuation verbs are callable today — rows #31–32
> below and the [Tree-run and repair (landed); emit verify-kind (landed)](#tree-run-and-repair-landed-emit-verify-kind-landed)
> section describe their real envelopes (`edit`'s own section: [Edit (`edit`)](#edit-edit)). `emit --verify-kind` is a **flag of
> `emit`**, not its own case arm: `grep -c 'case "'` reads 39 and none of the 39 case arms is
> `verify-kind` — the flag rides inside `emit` (`rapidtool-cli.mjs:2076`, calling
> `verifyKindDir` at `compile-check.server.ts:1566`; a failed leg flips the envelope to
> `ok:false` + `RT_E_VERIFY_KIND_FAILED`, exit 1).

> **Ref note (W24-B4 · docs lane):** `fixes/150` is a **wave** reference — the per-lane logs
> `fixes/150_g*.md` were **never filed** (`fixes/151_watchdog.md:19`: "No `fixes/150_g*.md` logs
> exist yet (all 5 lanes)"; `:162`: "All 5 lanes owe fixes/150_gN.md logs"). `fixes/151_watchdog.md`
> §1 is their record. Mentions of `fixes/150 wave G1` in this file mean that wave's G1 lane
> (`tree-run` + `repair`) — there is no `fixes/150_g1.md` to read.

Every subcommand prints a **single JSON object** to stdout (parseable by an AI
agent) whose envelope always carries `schema_version: 1`, `cmd` and
`exit_code`, and exits with the machine **exit-code taxonomy** below. Failure
envelopes additionally carry a `code` — a stable `RT_E_*` id (see **Error
codes (RT_E_*)** below). This file
is the agent-facing contract: an AI driver (Hermes-style loop) can run a whole
project end-to-end by reading only the JSON below.

## Asking for help (W49 · 335-4)

`--help` / `-h` / `help` print the synopsis as a **SUCCESS**: `ok: true`, exit
0, with `usage` (the same object the refusal paths carry). A help request is not
an error, so an agent that branches on the exit code never reads discovery as a
failure. Name a verb (`--help emit`, `help emit`) to narrow `usage.commands` to
that verb's single line. Before W49 these three spellings were an empty/unknown
subcommand — a coded `RT_E_VALIDATION` refusal at exit 1.

## Requirements

- **Node 22** (verified on v22.23.2). The CLI dynamic-imports a `.ts` file, so it
  needs Node's type-stripping enabled via the `--experimental-strip-types` flag.

## The one invocation that works on Windows (Node 22)

```
node --experimental-strip-types scripts/rapidtool-cli.mjs <command> ...
```

Run it from the repo root: the CLI resolves `src/lib/headless.ts` relative to its
own location, and resolves `.env` (see "API key resolution") relative to the
**working directory**.

## API key resolution (DEEPSEEK_API_KEY)

`scripts/run-eval.mjs` (keyed mode) declares the checkout's `<ROOT>/.env` via `RAPIDTOOL_LLM_ENV_FILE`, so the eval driver resolves the same key as the keyed verbs below (341-2).

Keyed verbs (`crew`, `verify`, `prompt`, `chat`, `create`'s `enforceDod` default,
… ) resolve the key from TWO sources, in this order (W45 · 331-1):

1. **`<working directory>/.env`** — the `DEEPSEEK_API_KEY` entry. Run the CLI from
   the repo root (the documented invocation) and this is the repo's own `.env`.
2. **the process environment** — `DEEPSEEK_API_KEY` (on Windows this includes a
   User/Machine-scope variable inherited into the shell).

A process `DEEPSEEK_API_KEY` that is **present but blank/whitespace is an
intentional DISABLE**: it forces the keyless floor and `.env` is NOT consulted.
Absence is different — an *unset* variable lets `.env` supply the key. This is the
repo's keyless-forcing convention (a harness that spawns the CLI with
`DEEPSEEK_API_KEY: ""` keeps it keyless even when a real `.env` sits in the cwd).

**The `.env` value WINS when both are present (non-blank).** Rationale: the `.env`
beside the repo is the key store this checkout declares; a stale machine-scope
variable must never silently shadow it — exactly the defect W45 repaired (a stale
User-scope key made every keyed call 401 on a key the operator never chose).

When both sources hold a non-blank, DIFFERENT value the run is not silent: the CLI
prints a **loud, coded** signal to **stderr** naming BOTH last-4 tails and proceeds
with the `.env` key —

```
[RT_E_LLM_KEY_SHADOWED] DEEPSEEK_API_KEY conflict: the .env key (<path>, tail …xxxx)
WINS over the process-environment key (tail …yyyy); using the .env key.
```

Only the last 4 characters of any key are ever printed, logged, or returned; the
full key never appears in an envelope, a telemetry row, or a refusal. A rejected
credential (HTTP 401) is its own class — `RT_E_LLM_KEY_REJECTED` — and both the
message and the envelope's `remedy` name the SOURCE the key came from (the `.env`
path, or "the process environment"), by tail only.

Resolution is cwd-relative by design (standard dotenv semantics): run from a
directory with no `.env` (a scratch/temp dir) and the pure process-environment
behavior applies unchanged, so tooling that spawns the CLI elsewhere stays keyless.

### The app's own server path (dev / preview)

The Vite dev and preview servers run through `scripts/with-app-env.mjs`, which
declares the repo `.env` to the SERVER-SIDE resolver by setting
`RAPIDTOOL_LLM_ENV_FILE` (a PATH — never a secret, never `VITE_`) in the child
environment. The provider (`src/lib/llm/providers/key-source.server.ts`) applies
this SAME rule on read, so the console's server functions — e.g. **Spawn crew**
on `/run/<id>` — resolve the repo `.env` key instead of a stale User-scope one,
and a rejected key still names its source. With no declared file the read is a
plain `process.env` read, so a bare Node / unit-test process is unchanged.

## Commands

```bash
# 1. Create a new project (writes <file>.json atomically; no --out → <slug>.json in the CWD — the intermediate file stays where the shell chains the verbs)
node --experimental-strip-types scripts/rapidtool-cli.mjs create \
  --brief "Build a field-service dispatch board for HVAC." --name "HVAC Dispatch" --out build.json
#    --brief takes PROSE, or --brief @<path> reads the file (the same `@file`
#    convention as `ingest --report`). A YAML-front-matter corpus fixture
#    (research/eval-corpus/*.md, e.g. house-flip-manager.md) carries its prose
#    in the `brief:` scalar — `@file` unwraps that instead of feeding the front
#    matter to the lattice. A bare value that names an EXISTING, readable file
#    is REFUSED (exit 1, RT_E_VALIDATION) naming both forms: a file path is
#    never silently used as the brief prose (AW45-c07 — the pre-fix bug named
#    the project after the path and mined nouns from the filename).
node --experimental-strip-types scripts/rapidtool-cli.mjs create \
  --brief @research/eval-corpus/house-flip-manager.md --out build.json

# 2. Advance one phase (deterministic; add --live for real keyless research + optional DeepSeek narrative)
node --experimental-strip-types scripts/rapidtool-cli.mjs run --project build.json [--live]

# 3. Advance until the pipeline parks (awaiting_hitl / complete / blocked)
#    --autopilot auto-approves non-stock, non-forceHuman gates only
node --experimental-strip-types scripts/rapidtool-cli.mjs gate --project build.json [--autopilot] [--live]

# 4. Approve / reject the pending gate (`reject` requires ≥12 characters of --note;
#    a shorter note is refused — exit 1 RT_E_VALIDATION, nothing written. Both
#    verbs require an explicit seat: --seat autopilot (machine) or --i-am-human
#    (TTY + typed RT_HUMAN_SEAT_TOKEN re-entry; refused off-TTY))
node --experimental-strip-types scripts/rapidtool-cli.mjs approve --project build.json [--force]
node --experimental-strip-types scripts/rapidtool-cli.mjs reject  --project build.json --note "Must enumerate per-role OAuth scopes."

# 5. Retry a rejected/blocked phase (the rejection note stays applied; the phase re-opens as ready)
node --experimental-strip-types scripts/rapidtool-cli.mjs retry --project build.json

# 6. Ingest an external agent's report (append-only, rejection-free);
#    --report accepts inline JSON, @file.json, or '-' (stdin)
node --experimental-strip-types scripts/rapidtool-cli.mjs ingest --project build.json \
  --report '{"phase":1,"status":"complete","summary":"Reviewed topology.","artifacts":[{"title":"notes","body":"..."}]}'

# 7. Emit the compiled Agent Packet (stdout, or a .md file with --out)
node --experimental-strip-types scripts/rapidtool-cli.mjs packet --project build.json [--out packet.md]

# 8. Emit the full project JSON (stdout, or a file with --out)
node --experimental-strip-types scripts/rapidtool-cli.mjs export --project build.json [--out out.json]

# 9. Emit the runnable scaffold (project files + embedded generated module);
#    --check adds one compile verdict per emitted file; --run executes the emitted
#    tree in-loop (parse + every emitted *.spec.ts + entry smoke; exit 1 on red,
#    exit 0 when green — the envelope still names an unverified declared toolchain);
#    --require-verified opts into exit 5 for that green-but-unverified state;
#    --git lands the emitted tree in its own directory: init when absent, then ONE
#    Conventional-Commits commit staged from the emitted manifest only (idempotent;
#    a foreign file is reported, never committed; the RapidTool repo is never a target);
#    --red-tree banner admits an uncleared red tree-run WITH the unmissable banner
#    on the emitted README (default refuse — see the Emit section)
node --experimental-strip-types scripts/rapidtool-cli.mjs emit --project build.json [--out emitted/] [--check] [--run] [--git] [--red-tree refuse|banner] [--verify-kind] [--force] [--require-verified]

# 10. Compact JSON-safe snapshot (name, currentPhase, status, phaseCounts, lastGate,
#     researchCount, memoryCount, vaultReady)
node --experimental-strip-types scripts/rapidtool-cli.mjs summary --project build.json

# 11. Materialize the Obsidian-style vault: one .md file per atomic note + _index.md MOC
node --experimental-strip-types scripts/rapidtool-cli.mjs vault --project build.json [--out vault/]

# 12. Search the vault notes (pure token-overlap search; hits have title/kind/tags)
node --experimental-strip-types scripts/rapidtool-cli.mjs search --project build.json --query "auth scopes" [--limit 10]

# 13. Run the advisory multi-agent crew over the current phase (needs DEEPSEEK_API_KEY)
node --experimental-strip-types scripts/rapidtool-cli.mjs crew --project build.json [--max-steps 12]

# 14. Machine verify-fix loop over project.generatedSource (needs DEEPSEEK_API_KEY);
#     --apply persists the verdict into the project file (see the Verify section)
node --experimental-strip-types scripts/rapidtool-cli.mjs verify --project build.json [--apply]

# 15. Per-file compile verdicts over an emitted directory (see the Check section)
node --experimental-strip-types scripts/rapidtool-cli.mjs check --dir emitted/

# 16. Design tokens (stdout) + standalone HTML design-system preview (--html <file>)
node --experimental-strip-types scripts/rapidtool-cli.mjs design --project build.json [--html design.html]

# 17. SVG diagram of the project: --kind phases | architecture | flow
node --experimental-strip-types scripts/rapidtool-cli.mjs diagram --project build.json --kind architecture [--out architecture.svg]

# 18. Index the project's artifacts (agents: read this before deciding what to fetch)
node --experimental-strip-types scripts/rapidtool-cli.mjs artifacts --project build.json

# 19. Capability pre-flight: llm / research / runner / node — no project file needed
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor

# 20. Telemetry diagnosis: recent log tail, timeline + most-likely-cause heuristic
node --experimental-strip-types scripts/rapidtool-cli.mjs diagnose [--project build.json]

# 21. Bounded live-source harvest for the brief (repos + licenses + snippets; never fabricated)
node --experimental-strip-types scripts/rapidtool-cli.mjs harvest --project build.json

# 22. Deterministic advisory swarm critique of the current phase (pure state analysis, no LLM)
node --experimental-strip-types scripts/rapidtool-cli.mjs swarm --project build.json

# 23. Hyper-prompt expansion of the brief into an implementation spec (needs DEEPSEEK_API_KEY)
node --experimental-strip-types scripts/rapidtool-cli.mjs prompt --project build.json [--policies "DO NOT use eval,DO NOT log PII"]

# 24. Synthetic estimate suite: tokens / time / complexity / failure points (heuristic, labeled)
node --experimental-strip-types scripts/rapidtool-cli.mjs bench --project build.json

# 25. Bounded structural codebase map + convention map of a real directory
node --experimental-strip-types scripts/rapidtool-cli.mjs mine --dir src/lib [--limit 200]

# 26. Cross-project JSON pattern store: append one entry (idempotent) / search it
node --experimental-strip-types scripts/rapidtool-cli.mjs knowledge --store patterns.json \
  --save '{"project":"hvac","kind":"pattern","title":"Auth refresh pattern","tags":["auth"],"body":"…"}'
node --experimental-strip-types scripts/rapidtool-cli.mjs knowledge --store patterns.json --find "auth refresh" [--limit 5]

# 27. Bounded headless wild-mode macro-run + lifecycle (--start enables Wild Mode AND begins
#     a run; --pause/--resume/--stop control it; default steps an already-active run).
#     --agent-seal = THE agent seal (313 D1; a WILD-RUN concept — this is the ONLY verb that
#     accepts it): classifier-as-approver (coded [seat agent-seal] rows, never a human seat),
#     bounded classifier-reject retries, and ONE DoD-repair pass on a hard-DoD red.
#     approve/gate/run/resume/unattended REFUSE --agent-seal with RT_E_VALIDATION + the
#     pointer back here — a governance flag is never silently ignored (316 H3).
node --experimental-strip-types scripts/rapidtool-cli.mjs wild --project build.json [--start] [--steps 24] [--agent-seal]

# 28. Grounded copilot turn over the project (needs DEEPSEEK_API_KEY) — same chat.server.ts
#     function the UI Chat tab calls; --history is an optional JSON array of prior turns
node --experimental-strip-types scripts/rapidtool-cli.mjs chat --project build.json --ask "What is the isolation policy?" \
  [--history '[{"role":"user","text":"Summarize the architecture."}]']

# 29. E-13 deepen: re-run live research over a COMPLETED research phase (0/7/11) whose gate
#     failed with p7-research unmet — re-records the phase gate against the deepened corpus
node --experimental-strip-types scripts/rapidtool-cli.mjs deepen --project build.json [--phase 7]

# 30. The lesson family (fixes/98 §7 — project-local lesson memory ↔ the cross-project
#     knowledge store; list/propose never write, accept is THE human-gated cross-project
#     write, supersede/refute are append-only store telemetry)
node --experimental-strip-types scripts/rapidtool-cli.mjs lesson --list --project build.json [--brief "servo tuning"] [--limit 10]
node --experimental-strip-types scripts/rapidtool-cli.mjs lesson --propose --brief "raw evidence for the lesson…" [--project NAME] [--kind fix|pattern|note] [--tags a,b] [--title "…"]
node --experimental-strip-types scripts/rapidtool-cli.mjs lesson --accept --project build.json --out lessons.json [--actor NAME] [--limit 5]
node --experimental-strip-types scripts/rapidtool-cli.mjs lesson --supersede --knowledge-file lessons.json --id K1a2b3c4d [--evidence "newer guidance replaces this"]
node --experimental-strip-types scripts/rapidtool-cli.mjs lesson --refute --knowledge-file lessons.json --id K1a2b3c4d [--evidence "observed the opposite"]

# 31. tree-run (SHIPPED — fixes/150 wave G1): standalone dir-based treeRun over an EXISTING
#     emitted dir — read-only, never re-emits over the dir (an edited file is never
#     clobbered); green → exit 0; red → exit 1 with the first not-ok tail +
#     RT_E_TREE_RUN_FAILED. --project adds the read-only hash-checked dirDirty report.
# 32. repair (SHIPPED — fixes/150 wave G1): hash-checked re-import of an EDITED emitted dir
#     into the ledger (refused paths listed, never silently dropped), re-run the oracle,
#     bounded repair cycles against the dir (the dir is never re-emitted over); converged
#     → exit 0 (minted/gate/cycles/import in the envelope), budget exhausted → exit 1
#     RT_E_REPAIR_FAILED, pre-flight refusal → exit 1 RT_E_VALIDATION (ledger persisted
#     after every completed run — converged or failed). Keyless: no repair loop runs —
#     the deterministic floor stands and the budget exhausts honestly.
# 33. emit --verify-kind (SHIPPED — fixes/216z · T4.1): opt-in bounded scratch-copy install +
#     the tree's declared build/test leg (webapp/game kinds) in a temp dir. A FLAG of `emit`
#     (no own case arm); a failed leg flips the envelope to ok:false + RT_E_VERIFY_KIND_FAILED.
node --experimental-strip-types scripts/rapidtool-cli.mjs tree-run --dir emitted/          # standalone dir-based treeRun — no re-emit
node --experimental-strip-types scripts/rapidtool-cli.mjs repair --dir emitted/ --project build.json   # re-import edited tree, re-run oracle, bounded repair cycles
node --experimental-strip-types scripts/rapidtool-cli.mjs emit --project build.json --out emitted/ --verify-kind   # flag of `emit` (no own case arm)
# 34. eval (W23-L5 · T5.3 — SHIPPED, read-only): the M1–M9 rubric + per-case rows + history
#     deltas/trend over the keyed-eval harness's own documents (research/eval-out/results.json
#     + history.json + the run marker; $EVAL_OUT_DIR honored like run-eval.mjs; --dir overrides
#     the dir, --history overrides just the trend file, --slug filters to one corpus case).
#     No keyed calls, no writes, no network, nothing fabricated — a missing history prints as
#     'no history', never a fake 0 delta.
node --experimental-strip-types scripts/rapidtool-cli.mjs eval [--dir <eval-out>] [--history <history.json>] [--slug <slug>]
#     The HARNESS that WRITES this scorecard is `npm run eval` (scripts/run-eval.mjs). W50
#     (336-4): it refused the bare default into the working tree because that rewrites tracked
#     research/eval-out/**. Pass a scratch --out: `npm run eval -- --out <scratch-dir>` (or set
#     EVAL_OUT_DIR); to regenerate the tracked scorecard on purpose, name it:
#     `npm run eval -- --out research/eval-out`.

# 35. resume (T-107.7 — REAL, W36): read the per-phase checkpoint that run/gate wrote beside
#     the project dir, admit it (identity + mode + integer phase sanity), hydrate it, and
#     re-enter at the recorded phase through the same driver; the envelope prints the
#     snapshot age — never a silent resume. Exit taxonomy identical to gate (2 = parked).
node --experimental-strip-types scripts/rapidtool-cli.mjs resume --project build.json [--autopilot] [--live]

# 36. unattended (W-47 — REAL, W36): the scheduler-facing drive — re-enters from a checkpoint
#     when one exists (crash recovery), else starts from the named project file; autopilot +
#     live until parked. NOT a daemon: a host hook (Windows Task Scheduler / cron) invokes it
#     on a cadence. 341-6: it passes machineGates, so a stock HITL gate (P4/P5/P8/P9) whose DoD
#     passes is cleared through the ledgered machine actor (`approve --seat autopilot`) — only a
#     forceHuman gate, or any red DoD gate, still parks (exit 2).
node --experimental-strip-types scripts/rapidtool-cli.mjs unattended --project build.json
```

`run` performs exactly **one** `advanceOnce` step; `gate` loops until parked.
An agent can interleave them: `gate --autopilot` to reach the next stock HITL
gate, then `approve` (or `reject`) that gate explicitly, then `gate` again.

## Driving to completion (agent loop)

Stock HITL gates (P4, P5, P8, P9) — and any `forceHuman` gate — are **never**
auto-approved, even with `--autopilot` (governance rule R3/B-03). An
`approve --seat autopilot` on a `forceHuman` gate is refused CODED — exit 1,
`RT_E_VALIDATION`, remedy = the human door (`--i-am-human` / `reject --note`) —
never the exit-4 internal class: it is a deterministic governance refusal, not
a runtime failure. So the honest autopilot loop is:

```
loop:
  gate --project build.json --autopilot
  if summary.status == "complete" or "blocked": stop
  approve --project build.json        # human decision on the parked stock gate
```

**`refusalCode` (W49 boundary).** A drive verb's envelope carries `refusalCode`
when the invocation recorded a coded P6-synthesis refusal and still advanced on
the deterministic floor — most importantly a keyed 401, which surfaces as
`RT_E_LLM_KEY_REJECTED`. It rides under its own name because `code` is reserved
for a failed command: `ok:true` + `refusalCode` means *the step succeeded and a
refusal was recorded during it*. The field is absent when no refusal happened.
An agent that drives RapidTool blind should read `ok` for the command's fate and
`refusalCode` (when present) for what to fix.

## Live mode (`--live`)

Off by default. When on, research phases (P0/P7/P11) attempt:

1. **Real keyless web search** — `freeWebSearch` (DuckDuckGo Lite → Wikipedia
   fallback); Tavily when `TAVILY_API_KEY` is present in `process.env`.
2. **DeepSeek phase narrative** — `completeDeepSeek` when `DEEPSEEK_API_KEY` is
   present in `process.env`.

Every failure degrades gracefully to the deterministic result; no output is ever
fabricated. `DEEPSEEK_API_KEY` (and the other knobs) are resolved from
**`<working directory>/.env` first, then the process environment** — the `.env` value WINS when
both are non-blank (the ambient key loses behind the coded `RT_E_LLM_KEY_SHADOWED` signal, tails
only), and a present-but-blank process value is an intentional keyless disable. The full rule and
provenance rule are in "API key resolution" above; run the CLI from the repo root to use the repo's
own `.env`.

## Vault (`vault`)

Builds the project's **Obsidian-style knowledge vault**: one `.md` file per
atomic note (memory rows, artifacts, research findings — via
`vault.ts: buildVaultNotes`) plus an `_index.md` Map-of-Content hub
(`vault.ts: vaultIndex`). Files are written into `--out <dir>` (default
`<home>/RapidTool Software/<slug>/vault` — `<home>` = `os.homedir()`, `<slug>`
= the project name slugified exactly like the packet/JSON downloads, so the
vault sits beside the emitted software under `<home>/RapidTool Software/<slug>/`;
when the home location is unwritable it falls back to `<cwd>/<slug>/vault`;
`--out` always overrides), created recursively. Deterministic: the same project
always produces byte-identical files.

```json
{ "ok": true, "count": 42, "dir": "C:\\repo\\vault" }
```

`count` = number of atomic note files written (`_index.md` not counted). If the
vault module (`src/lib/vault.ts`) is not present yet, the command fails cleanly:
`{ "ok": false, "error": "…" }`, exit **4** (`RT_E_INTERNAL` — a missing/broken
module is a runtime failure in the arm's own catch, per the taxonomy below).
Note files carry YAML frontmatter
(`id/title/kind/phase/tags/score/source/url`) + the note body + a `## Links`
section of resolved `[[wikilinks]]`; the MOC lists every note grouped by kind
with wikilink rows, plus a tag index — Obsidian/Logseq-importable.

## Search (`search`)

Token-overlap search over the project's vault notes
(`vault.ts: searchVault` — pure and deterministic; no network, no LLM).
`--query` is required; `--limit` defaults to 10 (max 200). Hits are mapped to
their agent-facing shape, best score first:

```json
{
  "ok": true,
  "query": "auth scopes",
  "count": 2,
  "results": [
    { "title": "Isolation policy must enumerate per-role OAuth scopes", "kind": "semantic", "tags": ["P4", "security"] },
    { "title": "Threat model review", "kind": "episodic", "tags": ["gate"] }
  ]
}
```

## Crew (`crew`)

Runs the **advisory multi-agent crew** over the project's current phase
(`crew.server.ts: runCrewServer`, dynamically imported — bare-Node friendly).
The crew plans/researches/designs/reviews but never approves, rejects, or
advances: its output is advisory. Requires `DEEPSEEK_API_KEY`; `--max-steps`
caps turns (default 12, server clamps 1–24).

```json
{
  "ok": true,
  "messages": [ { "role": "planner", "type": "plan", "content": "…", "artifacts": [] } ],
  "artifacts": [ { "phase": 4, "title": "…", "body": "…" } ],
  "stopped": "done"
}
```

No key → honest failure, exit 3 (backend not configured):
`{ "ok": false, "reason": "not-configured", "code": "RT_E_LLM_NOT_CONFIGURED", "error": "… — set DEEPSEEK_API_KEY (repo .env or process environment) to enable the crew" }`.
An agent should treat this as *actionable*, not as a crash — the machine never
fabricates a session. A runtime/backend failure exits 4; a rejected credential
carries `RT_E_LLM_KEY_REJECTED` and names the key's source (see "API key
resolution").

## Verify (`verify`)

Machine-run **verify-fix loop** over `project.generatedSource` against
`project.brief` (`verify.server.ts: verifyAndFixServer`, dynamically imported):
DeepSeek writes executable boolean oracle cases → the local bounded Node runner
executes them → on failure DeepSeek patches the source → re-run, up to
`maxIterations` (3). Only a real machine-run pass mints `status: "passed"`.
Requires `DEEPSEEK_API_KEY`. Fails fast (exit 1) when the project has no
`generatedSource` yet (codegen phases never ran).

`--apply` persists the outcome into the project file: a **passed** verdict
stamps `lastTest` (label `"tested"` + evidence hash) and appends a `verify`
artifact; **failed/error** append a `verify.fail` artifact; **not-configured**
changes NOTHING (never a partial write). Without `--apply` the verdict is
printed but nothing is persisted.

Passed — exit 0:

```json
{
  "ok": true,
  "status": "passed",
  "iterations": 1,
  "evidence": "3/3 machine-run cases passed on iteration 1",
  "finalSource": "…",
  "cases": [ { "id": "case-1", "expression": "exports.add(2, 3) === 5" } ]
}
```

Anything else is a failure with the full outcome preserved plus an `error`
string: `{ "ok": false, "status": "failed" | "error" | "not-configured", "iterations": N, "evidence": "…", "error": "…" }`.
Exit mapping follows the taxonomy: a **failed** verdict → exit 1 (fix the
evidence and re-run), **not-configured** → exit 3 (RT_E_LLM_NOT_CONFIGURED —
surface the key requirement), backend **error** → exit 4. An agent loops on
`status !== "passed"` (for `not-configured`, surface the key requirement to the
user; for `failed`, ingest the evidence and steer the next phase).

## Emit (`emit`)

Writes the project out as a **runnable scaffold** (`headless.ts: emitProject`):
project files for the kind (e.g. `package.json`/`tsconfig.json`) with the
generated module embedded — the CODE→RUNNABLE-APP path. No build step; the
scaffold is emitted runnable for the caller.

`--out <dir>` selects the output folder (default `<home>/RapidTool Software/<slug>/`,
CWD fallback when the home location is unwritable). A second emit over an existing
folder **overwrites in place and says so** (`overwritten: true` + a warning — whole
files are replaced, nothing is merged or appended). `--check` runs the per-file
compile-check seam over the just-emitted dir (the same `check` below) and
carries one verdict per file. `--run` executes the emitted tree **in-loop** —
per-file parse verdicts + every emitted `tests/*.spec.ts` under the bounded
runner + one kind-entry smoke (`compile-check.server.ts: treeRun`) — and appends
the `TreeRunOutcome`; a red tree exits 1 (a red tree is never a clean emit). A
GREEN tree whose declared `typecheck`/`build` could not be resolved/run is `ok: true` but
**unverified**: it exits **0** and carries `unverified: true`, `declaredScriptsVerified: false`,
and `unverifiedDeclaredScripts: [...]`. This is NOT the usual fresh-emit state: when the declared
scripts resolve from the RapidTool repo's own `node_modules/` (the normal case), `treeRun` runs
them and reports `declaredScriptsVerified: true` at exit 0. The unverified state appears only when
those scripts genuinely cannot be resolved/run; pass `--require-verified` to make that state exit 5
instead of 0 (not 1 — nothing ran red). Install/link the tree's deps and re-run `--run` to reach a
verified `declaredScriptsVerified: true`.
All files parse → exit 0 with
`{ "ok": true, "dir": "…", "count": N, "moduleEmbedded": true|false, "summary": "…" }`.
With `--check`, any failed file flips the envelope to `ok: false` with the
verdicts and exit 1 — loud, never a faked all-clear. Missing project /
emit refusal → exit 1 (`RT_E_PROJECT_MISSING` / `RT_E_VALIDATION`).

`--red-tree <refuse|banner>` selects how an **uncleared red** tree-run trail
(`p6.tree.failure` with no green run since — the durable `treeRunTrail`) is
handled at emit time (W14-L2 · OV-15). The default `refuse` returns a coded
`RT_E_TREE_RUN_FAILED` refusal *before anything is written* (no partial tree,
not even an empty emit dir); `banner` emits anyway, prepends the unmissable
`[!CAUTION]` banner to the emitted `README.md`, and stamps
`redTreeBanner: true` + `redTree` on the success envelope — the eval path's
own policy. `probe` (no trail read) stays internal to the driver/journey
paths and is **not** exposed here; any other value is rejected with
`RT_E_VALIDATION`. This flag is what makes the refusal message's own advice —
*emit with `redTree:"banner"` to ship the unmissable banner* — reachable from
the CLI.

`--git` lands the freshly emitted tree as **one git delivery** (fixes/343_3 · 343-3
§6): `git init` when the directory is not already inside a work tree, then ONE
Conventional-Commits commit — `feat(<slug>): <first requirement, else the brief's
first line>` — staged from the **emitted manifest only** (`add -- <files>`). A
foreign file is reported on `git.foreign[]` and left untracked, never committed;
the RapidTool host repo is structurally refused, and re-emitting an identical tree
is an idempotent `git.noop: true` / `committed: false` (never an empty commit).
Unlike the human-seat-gated `gitLandInit/Commit/ReadBack`, the delivery tail is
machine-callable by design, guarded structurally (it requires the emitted record
`.rapidtool/project.json` and refuses any path that is not a RapidTool emission).
A landed delivery returns `ok: true` with `git: { dir, message, committed, noop,
commit, files, foreign }`; a refusal flips the envelope to `ok: false` + its coded
reason (`RT_E_GIT_UNAVAILABLE`, `RT_E_FOREIGN_FILES`, …) and exit 1 — **the emitted
tree still exists on disk**, so the failure is in delivery, never in the build.

`--force` admits an emit into a folder that already holds foreign files — without it the
emit is refused (`RT_E_FOREIGN_FILES`, exit 1, the `foreign` list on the envelope); with it
the foreign files are moved **aside** into `<dir>/.rapidtool-quarantine/<stamp>/` —
recoverable, never deleted, and never judged by a later tree-run — and reported on the
envelope (`quarantined` = the moved rel paths · `quarantineDir` = the stamp dir). A failed
move is loud: `ok:false` + `RT_E_FOREIGN_FILES` with `quarantineFailed` (R11-f08 · W42).

> **Shipped (fixes/216z · T4.1):** opt-in `--verify-kind` — a bounded scratch-copy
> install (`npm ci` / `npm install`) + the tree's own declared `build` + `test`
> scripts for webapp/game kinds in a temp dir (never mutating the emitted dir),
> asserting the kind's declared build actually runs. It is a **flag of `emit`**,
> not its own case arm (none of the 39 case arms is `verify-kind` —
> `grep -c 'case "' scripts/rapidtool-cli.mjs` reads 39); the seam is
> `verifyKindDir` (`compile-check.server.ts:1566`), called from
> `rapidtool-cli.mjs:2076-2090`; a failed leg flips the envelope to `ok:false` +
> `RT_E_VERIFY_KIND_FAILED`. See the
> [Tree-run and repair (landed); emit verify-kind (landed)](#tree-run-and-repair-landed-emit-verify-kind-landed)
> section before relying on it.

## Edit (`edit`)

In-place `str_replace` on ONE emitted tree file (`src/lib/patch.ts` primitive —
unique match required, never a silent fuzzy). **DRY-RUN is the default**: the
would-be diff + before/after hashes are returned and NOTHING is written.
`--write` (requires `--project <file.json>`) applies atomically (write-then-rename,
with a containment check on `--file`) only after the ONE policy seam
(`src/lib/policy.ts` `evaluatePolicy("repair.apply", \`tree:<dir>\`)`) allows the
seat, then lands ONE attributed ledger row — actor + `decidedVia` provenance +
the patch + before/after hashes. Ambiguous / missing / no-op matches are coded
refusals (`RT_E_VALIDATION`, exit 1); write or ledger failures exit 4. Dry-run
needs no `--project` and never writes.

```bash
# dry-run (default) — prints the diff, writes nothing:
node --experimental-strip-types scripts/rapidtool-cli.mjs edit --dir <dir> --file <relpath> --find "<old>" --replace "<new>"
# apply + attribute (atomic; policy-gated):
node --experimental-strip-types scripts/rapidtool-cli.mjs edit --dir <dir> --file <relpath> --find "<old>" --replace "<new>" --write --project <file.json>
```

## Check (`check`)

Per-file compile verdicts over an **emitted** directory (`compile-check.server.ts`:
.js via `node --check`, .ts via the typescript devDep). `emit --check` calls this
same seam. All files pass → exit 0 (`{ "ok": true, "checked": N, … }`); any file
fails → exit 1 with the honest per-file verdicts and the check-specific code
`RT_E_CHECK_FAILED` (an expected any-fail verdict is never `RT_E_UNKNOWN`);
a missing `--dir` argument → exit 1 (`RT_E_VALIDATION`); internal error → exit 4
(`RT_E_INTERNAL`). No project file needed.

## Scan (`scan`)

Advisory error-signal scan over an EXISTING emitted dir — read-only, no project
needed, and it never re-emits over the dir (W23 L6 · G4 ·
`research/multiagent/249_define_first_specs.md` SPEC 3; OV-21 folds in as rule
R3). Three lexer-level rules; every finding is a prompt to look, not a verdict:

- **R1 `catch-empty`** — a `catch` clause whose body holds no statement.
- **R2 `catch-swallowed`** — a `catch` clause with statements but no `throw`,
  `RT_E_` mention, `console.`, `.warn(`, `.error(` or `report(` (the allowlist is
  deliberate: a finding is a prompt, not an accusation).
- **R3 `neutral-return-unimplemented`** (OV-21) — a standalone `return "";` /
  `return '';` / `return [];` / `return -1;` whose 5 preceding lines name an
  unimplemented-family marker (`TODO` / `stub` / `placeholder` / …): a silent
  neutral return next to an "unimplemented" comment must require an `RT_E_*`
  code — or the marker's removal.

```
node --experimental-strip-types scripts/rapidtool-cli.mjs scan --dir <emitted-tree-dir>
```

Envelope: `{ ok, cmd: "scan", dir, scanned: {files, lines}, findings: [{path, line, rule, snippet, advisory: true}], advisory: true, note, exit_code }`.
Exit **0** clean · **1** findings (the `check-assertion-gaps.mjs` idiom) ·
**1** + `RT_E_VALIDATION` for a missing/unreadable dir, or a dir with zero
resolvable files (the scan is never silently empty). **Posture: this verb is
never wired into `scripts/gate.sh`, is never called by `emit`, and blocks
nothing** — the rules are heuristics, so every finding carries `advisory: true`
(fixes/218 §3 item 4 / OV-21).

## Tree-run and repair (landed); emit verify-kind (landed)

> **Status: `tree-run --dir` and `repair --dir` SHIPPED (fixes/150 wave
> G1, case arms present, `grep -c 'case "'` = 39). `emit --verify-kind` SHIPPED
> too (fixes/216z · T4.1) — a flag of `emit`, not its own case arm: none of the
> 39 case arms is `verify-kind` (the flag rides inside `emit`); the scratch-copy
> install + declared build/test leg is on disk (`verifyKindDir`,
> `compile-check.server.ts:1566`).**

- **`tree-run --dir <dir>`** (keyless, read-only) — the dir-based oracle runner
  (`compile-check.server.ts: treeRun`: per-file parse + every emitted
  `tests/*.spec.ts` under the bounded runner + kind-entry smoke) as a standalone
  verb over **an arbitrary emitted directory, without re-emitting** — the oracle
  an agent uses after hand-editing an emitted tree. Green tree → exit 0
  (`{ ok: true, dir, treeRun: { ok: true, … } }`); red → exit 1 with `ok: false`,
  the first not-ok tail in `error` and `code: "RT_E_TREE_RUN_FAILED"`. A green
  tree whose declared `typecheck`/`build` did not run still exits 0 and names the
  state on the envelope (`unverified` / `declaredScriptsVerified` /
  `unverifiedDeclaredScripts`); `--require-verified` opts into the strict exit 5.
  `--project <file.json>` adds the read-only, hash-checked `dirDirty` divergence
  report (ledger tree vs dir bytes — never persisted).
- **`repair --dir <dir> --project <file.json> [--budget N]`** (keyed repair loop;
  default budget = `P6_JOURNEY_DEFAULT_BUDGET`) — the emit→edit→re-emit
  continuation seam (`headless.ts: repairTreeDir`): hash-checked re-import of the
  edited dir into `project.generatedTree` (per-file fnv1a — changed/unchanged/
  missing/refused are all reported, refused paths are warnings, never silent
  drops), first `treeRun` verdict **read-only over the dir as-is** (never clobber
  before reading), then bounded cycles: red tail → one synthesis repair whose
  context reaches codegen as `deps.treeFailure` → repaired rows applied onto the
  dir in place (only changed files, never deletes) → re-import → `treeRun`. Green
  → the tested-equivalent mint + honest P6 gate record + `converged` (exit 0;
  envelope carries `cycles`/`minted`/`gate`/`treeRun`/`import`/`applied`).
  Budget exhausted → exit 1 with `code: "RT_E_REPAIR_FAILED"` and the first
  not-ok tail; pre-flight refusal (unreadable dir / ledger carries no
  generatedTree) → exit 1 `RT_E_VALIDATION`; internal throw → exit 4. The ledger
  is persisted after every completed run (converged or failed) — the dir is the
  artifact and is NEVER re-emitted over. **Keyless honesty:** with no
  `DEEPSEEK_API_KEY` the default synthesis seam is the deterministic floor, so a
  red dir exhausts the budget honestly (no fake repair, exit 1) — a green dir
  still converges at cycle 0 with the mint + honest gate record.
- **`emit --verify-kind`** (SHIPPED — fixes/216z · T4.1; keyless, network) — opt-in
  bounded scratch-copy install (`npm ci` / `npm install`) + the tree's declared
  build/test for webapp/game kinds in a temp dir (never mutating the emitted
  dir), asserting the kind's declared build actually runs; exits 0 on a real
  green build, or flips the emit envelope to `ok: false` +
  `RT_E_VERIFY_KIND_FAILED` (exit 1) with the honest install/build `detail`. It
  is a **flag of `emit`** — no own case arm; the seam is `verifyKindDir`
  (`compile-check.server.ts:1566`).

## Design (`design`)

Deterministic design system for the project (`design.ts: designTokens` +
`designHtml`, dynamically imported — same contract style as `vault.ts`). The
tokens object is printed **inline** on stdout so the next builder agent can
consume palette/typography/spacing directly; pass `--html <file.html>` to also
materialize a standalone HTML5 preview page embedding the tokens (zero JS, no
external assets).

```json
{
  "ok": true,
  "tokens": {
    "palette": { "name": "logistics · rust", "base": "#9a3412", "tokens": { "bg": "#f5f0e6", "brand": "#9a3412", "…": "…" } },
    "typography": { "scale": ["12px", "…"], "mono": "ui-monospace, …" },
    "spacing": [4, 8, 12, 16, 24, 32, 48],
    "radius": [4, 8, 12, 16],
    "shadows": ["…"]
  },
  "htmlWritten": "C:\\repo\\design.html"
}
```

The token **schema is owned by `design.ts`** (its header freezes it) — treat
`tokens` as opaque JSON; the CLI does not reshape it. `htmlWritten` is present
only when `--html` was given. If the design module is not present yet, the
command fails cleanly: `{ "ok": false, "error": "…" }`, exit 4 (`RT_E_INTERNAL`)
— same as the vault module contract.

## Diagram (`diagram`)

Deterministic standalone SVG for the project (`diagram.ts: buildDiagram`,
dynamically imported). `--kind` is required and must be exactly one of
`phases` (13-node pipeline P0–P12 with status fills + HITL diamonds),
`architecture` (artifact map in phase bands + spec strip), or `flow` (current
phase's gate-path flowchart). Anything else is a hard error, exit 1.

```json
{ "ok": true, "kind": "architecture", "bytes": 9629, "svgWritten": "C:\\repo\\architecture.svg" }
```

`bytes` = UTF-8 byte length of the SVG. Pass `--out <file.svg>` to persist the
SVG (then `svgWritten` carries the absolute path); without `--out` only the
size is reported — stdout stays a single JSON object, so the SVG itself never
leaks into the stream. Missing module → clean `{ "ok": false, "error": "…" }`,
exit 4 (`RT_E_INTERNAL` — the arm catch).

## Artifacts (`artifacts`)

Pure index of the project's artifacts (no module dependency — always
available). One row per artifact in stored order:

```json
{
  "ok": true,
  "count": 18,
  "items": [
    { "id": "0-scorecard-feasibility-architecture-scoreca", "phase": 0, "kind": "scorecard", "title": "Feasibility & Architecture Scorecard", "bytes": 962 },
    { "id": "6-code-typed-synthesis-module", "phase": 6, "kind": "code", "title": "Typed synthesis module", "bytes": 1024 },
    { "id": "12-docs-openapi-3-1", "phase": 12, "kind": "docs", "title": "OpenAPI 3.1", "bytes": 283 }
  ]
}
```

`bytes` = UTF-8 byte length of the artifact body. Bodies are **not** included —
an agent reads this index to decide which artifact matters next, then fetches
the full body via `export --project <file.json>` (the whole project JSON) or
`packet`.

## Doctor (`doctor`)

**Capability pre-flight** — the only subcommand that needs no project file
(`headless.ts: doctorStatus`). Probes the environment and reports what is
actually configured:

```json
{ "ok": true,
  "llm": { "configured": false, "label": "not configured (set DEEPSEEK_API_KEY)" },
  "research": { "configured": false, "probed": false, "label": "unavailable" },
  "runner": { "available": true },
  "node": "v22.23.2" }
```

- `llm` — DeepSeek key present → `configured: true` + the first two configured
  model ids; otherwise the honest not-configured label above.
- `research` — Tavily keyed and live-probed (`probed: true`), or the keyless
  free-search path (duckduckgo/searxng/wikipedia) and its probe; unreachable
  backends say so in `label`.
- `runner` — whether the bounded local Node runner is available
  (`node-runner.server.ts`).
- `node` — the running Node version.

Never throws: a module missing → the honest not-configured/unavailable label;
an unexpected failure exits 4 with `RT_E_INTERNAL`. An agent should run this
first when a keyed verb exits 3, to confirm *why* before surfacing anything to
a user.

## Diagnose (`diagnose`)

The **AI-agent diagnostic** verb: one JSON with the project's recent telemetry
tail (last rows of its NDJSON log), an event timeline, a most-likely-cause
heuristic, and growth stats. No project file is required; `--project <file.json>`
points it at that project's `.rapidtool/logs`. Never throws: success → exit 0;
an unexpected failure → exit 4 with `RT_E_INTERNAL`.

## Retry (`retry`)

Re-opens a **rejected/blocked** phase for another attempt — the rejection note
stays applied and visible in the record, the phase record returns to `ready`,
and the project leaves `blocked` (`unlockRetry`, the headless mirror of the
UI's retry affordance).

```json
{ "ok": true, "path": "build.json", "summary": { "status": "running", "…": "…" } }
```

Exit 0 on success. Wrong state (project is not `blocked`) → exit 1 with
`code: "RT_E_PHASE_ILLEGAL"` — nothing is mutated. `retry` is the headless
recovery after `reject --note "…"` parks the project: `reject` → `retry` →
`gate` again.

## Chat (`chat`)

One **grounded copilot turn** over the project — the exact server function the
UI Chat tab calls (`chat.server.ts: chatOnceServer`), so context building,
caps and honesty are byte-identical to the browser path. The reply is grounded
in the project record (phases, gate verdicts, memory, packet) and carries
`provenance`; history is optional (`--history '<json array>'`, server-capped
to the last 6 turns, 800 chars each).

```json
{ "ok": true, "reply": "The isolation policy lives in the P4 artifact…", "grounded": true, "provenance": "…" }
```

No key → exit 3 with `RT_E_LLM_NOT_CONFIGURED` (crew parity). Malformed or
non-array `--history`, or a missing `--ask` → exit 1 with
`RT_E_VALIDATION`. Provider/backend failure → exit 4.

## Deepen (`deepen`)

**E-13 recovery** for a **completed research phase (0/7/11)** whose recorded
gate failed with `p7-research` unmet (a deterministic P7 run honestly records
that dead-end — this is the recovery the UI's own fallback text points at:
"re-run research from the CLI instead"). Re-runs the live research layer over
the completed phase: appends one deduplicated corpus entry + research
artifacts, logs `research.deepened`, and **re-records the phase gate** with a
fresh evidence hash. MUTATING when changed (persisted back to `--project`);
an unchanged no-op never rewrites the file.

```json
{ "ok": true, "path": "build.json", "phase": 7, "changed": true,
  "liveUnavailable": true, "log": "… · 0 finding(s) · live research unavailable (not configured or failed)" }
```

`--phase` defaults to the current phase; pass `--phase 7` explicitly to deepen
an earlier completed research phase. `liveUnavailable: true` + a warn log is
the honest bare-Node outcome when the live backends cannot run (never
fabricated findings) — the gate re-records against the existing corpus either
way. Phase not in 0/7/11 or not complete → exit 1 with
`code: "RT_E_PHASE_ILLEGAL"`; a non-numeric `--phase` → exit 1 with
`RT_E_VALIDATION`.

## Harvest (`harvest`)

Bounded **live-source harvester** for the project brief (`harvest.ts` Pillar 1,
dynamically imported). Query building uses `deepseek-v4-flash` (`json: true`)
**only** when `DEEPSEEK_API_KEY` is present and the call succeeds; otherwise it
falls back to a deterministic keyword floor and the envelope's `querySource`
flag honestly says `"keyword"` (never `"llm"`). Harvesting itself is keyless
(`freeWebSearch` → GitHub candidates → at most **4** direct
`raw.githubusercontent.com` / GitHub-API fetches within a **12 s** budget).
Each row carries its per-hit `provenance`; `license` is present only when the
GitHub-API spot-check actually returned one.

```json
{
  "ok": true,
  "count": 2,
  "rows": [
    { "kind": "research", "provenance": "harvest", "repo": "acme/field-service",
      "title": "acme/field-service", "url": "https://github.com/acme/field-service",
      "snippet": "# Field Service …", "license": "MIT", "hitProvenance": "github-raw" }
  ],
  "queries": ["field service dispatch github open source", "…"],
  "querySource": "keyword",
  "notes": ["fetch budget (4) reached — 2 candidate(s) left unfetched"]
}
```

**Honesty contract:** this command never fabricates a repo, license, or
snippet. Unreachable backends yield `rows: []` plus explanatory `notes` and
**exit 0** — the honest empty payload is the outcome (there is no
"not-configured" failure mode: search is keyless). A missing/invalid project
file exits 1 as usual.

## Swarm (`swarm`)

Deterministic **advisory swarm critique** of the current phase
(`swarm.ts: swarmPlan` — pure state analysis; no LLM turn is dispatched).
Output is advisory: it never mutates the project, never advances
`currentPhase`, and the DoD gate remains the only approver.

```json
{
  "ok": true, "advisory": true, "phase": 0,
  "critiques": [ { "role": "lead-architect", "verdict": "revise", "findings": ["…"], "artifact": {…} } ],
  "refinedPlan": "Advisory swarm pass — P0 …\nverdicts: 0 keep · 2 revise\n…",
  "artifacts": [ … ]
}
```

An agent feeds the `findings` back through `ingest` and re-runs the phase's
work before sealing. Exit 0 on success, 1 on failure (bad project file /
missing module).

## Prompt (`prompt`)

**Hyper-prompt expansion** of the brief (`prompt-engine.ts: expandBrief`,
deepseek-v4-flash `json:true`). Returns a full `ExpandedSpec`
(`requirements` / `edgeCases` / `errorHandling` / `typeSignatures` /
`dataFlow` / `negativeConstraints`). `--policies a,b,c` appends negative
constraints (capped: 12 policies × 240 chars; brief capped at 4000 chars).

```json
{ "ok": true, "spec": { "requirements": ["…"], "edgeCases": ["…"], "typeSignatures": ["…"], "…": [] } }
```

No key → `{ "ok": false, "reason": "not-configured", "code": "RT_E_LLM_NOT_CONFIGURED", … }`, **exit 3**
(crew parity). Model/parse failure → **exit 4**.

## Bench (`bench`)

Synthetic **estimate suite** over the project (`bench.ts` pure estimators —
tokens, projected time, complexity, failure points). Every estimate is a
heuristic and the envelope carries the disclaimer verbatim; it is never
presented as a measured run.

```json
{ "ok": true,
  "disclaimer": "synthetic dry-run estimate — heuristic, not a measured run",
  "token": { "estimate": true, "tokenEstimate": 1630, "…": "…" },
  "time": { "estimate": true, "minutes": 124, "…": "…" },
  "complexity": { "estimate": true, "score": 3, "…": "…" },
  "failurePoints": { "estimate": true, "count": 2, "advisories": ["…"] } }
```

Exit 0. No key, no network — always available.

## Mine (`mine`)

Bounded **structural codebase map** of a real directory (`ast-mine.ts:
mineCodebase` + `conventionsMap` — file structure, imports, exports,
dependency graph, naming conventions). No project file needed: `--dir` is
required, `--limit` caps mapped files (default 200). The walk skips
`node_modules` / `.git` / `dist` / `build` / `coverage` / `out` / `.vite` and
non-source extensions, honors a 2 MB byte budget + 512 KB/file cap, and
**reports every skip** (`skipped.excluded` / `tooLarge` / `overLimit`) —
never silent.

```json
{ "ok": true, "dir": "C:\\repo\\src\\lib", "fileCount": 5,
  "files": [ { "path": "…", "body": "…" } ],
  "map": { "files": [ … ], "dependencyGraph": [ … ] },
  "conventions": { … }, "skipped": { "excluded": 1, "tooLarge": 0, "overLimit": ["…"] } }
```

Unreadable directory → `{ "ok": false, "error": "mine: …", "code": "RT_E_VALIDATION" }`, **exit 1**.
Note: `files[].body` is included so an agent can feed the sources onward;
the structural claim is pattern-level, not an AST.

## Knowledge (`knowledge`)

Cross-project **JSON pattern store** (`knowledge.ts: KnowledgeStore` —
append-only, content-fingerprinted, idempotent). Exactly one of `--save` or
`--find` is required, plus `--store <file.json>`.

```bash
# append (duplicate saves are idempotent no-ops: appended: false)
rapidtool-cli.mjs knowledge --store patterns.json \
  --save '{"project":"hvac","kind":"pattern","title":"Auth refresh pattern","tags":["auth"],"body":"rotate tokens before expiry"}'
# { "ok": true, "entry": { "id": "K1b801808", "…": "…" }, "appended": true }

# deterministic FusionRank-style lexical search
rapidtool-cli.mjs knowledge --store patterns.json --find "auth refresh" --limit 5
# { "ok": true, "count": 1, "matches": [ { "entry": { … }, "score": 1 } ] }
```

Malformed `--save` JSON or a shape missing `title`/`tags` →
`{ "ok": false, "error": "…", "code": "RT_E_VALIDATION" }`, **exit 1**. The store
file is append-only: a corrupt existing store is refused, never overwritten.

## Lessons (`lesson`)

The **human-gated cross-project learning verbs** (fixes/98 §7 — the read-back
and promotion code lives in `knowledge.ts`: `topLessonRows` /
`acceptedLessonEntry` / `buildSupersedeEntry`, M5-4). One verb, exactly one
action flag; every arm is deterministic. The project-local lesson rows live in
`--project`'s `memory` (tags carry `lesson` + a class like `vague-brief` /
`verify-failure` / `drift` + a level `L1`–`L5`); the cross-project rows live in
the append-only `knowledge` store files.

| action | flags | semantics |
| --- | --- | --- |
| `--list` | `--project <file.json>` `[--brief <text>]` `[--limit N]` | **Read-only** (never writes, `readOnly: true`): the project's lesson-tagged rows with kind/class/level/phase/score/evidence detail. `--brief` ranks them against that brief via `topLessonRows` (fusionRank — the same read-back semantics the tier-2 seams use; default top 10); without `--brief` they come score-desc / id-asc (all rows unless `--limit`). `rankedBy` states which order was used. |
| `--propose` | `--brief <text>` `[--project NAME]` `[--kind fix\|pattern\|note]` `[--tags a,b]` `[--title "…"]` | Bounded flash **DRAFT only — never writes**. Keyed (`DEEPSEEK_API_KEY` set): ONE bounded DeepSeek turn (json mode, small cap) polishes the draft. Keyless (or a failed keyed turn): the deterministic `proposeLessonFallback` draft, labeled `source: "draft (keyless)"` in the envelope — never fabricated, everything traces to the brief. `--project` is the origin project's NAME for the draft's `project` field (never a file to load). Save the reviewed draft with `knowledge --store <file.json> --save '<draft-json>'`. |
| `--accept` | `--project <file.json>` `--out <knowledge.json>` `[--actor NAME]` `[--limit N]` | **THE human-gated cross-project write**: promotes the project's top `topLessonRows` (ranked against its brief) into the store at `--out` via `acceptedLessonEntry` — the actor (default `$RAPIDTOOL_ACTOR` / `$USERNAME` / `$USER` / `cli-human`) is recorded IN each row (`actor:<name>` tag + body provenance line), so re-accept of identical rows by the same actor is an idempotent no-op (`appended: false`) and a different actor's accept is a distinct row. No machine path appends to the store. A project with no lesson rows, or a missing `--out`, is an honest refusal listing the flag — **exit 1** `RT_E_VALIDATION`. |
| `--supersede` | `--knowledge-file <knowledge.json>` `--id <K…>` `[--evidence <text>]` `[--by human\|machine]` | Append-only supersede (98 §6.2): `buildSupersedeEntry` + `savePattern` + `markSuperseded` — a NEW row declares the old entry dead; the old row stays on disk for audit but is filtered from every read-back. `--evidence` (alias: `--reason`) rides verbatim in the superseding row's body; absent → `"(no reason recorded)"`. Unknown id → **exit 1** `RT_E_VALIDATION`. |
| `--refute` | `--knowledge-file <knowledge.json>` `--id <K…>` `[--evidence <text>]` | One counter-evidence unit via `bumpCounterEvidence` (writer-only telemetry; content fields untouched). Read-back score decays by half per unit; at `LESSON_RETIRE_COUNTER` (3) the row is retired from read-back (kept on disk). The response echoes `counterEvidence`, `retired` and the optional `evidence` (store rows record counts only — keep reasons in your own ledger). Unknown id → **exit 1** `RT_E_VALIDATION`. |

Exactly two action flags in one call → **exit 1** `RT_E_VALIDATION`. `list` and
`propose` never touch the project file or any store; `accept`/`supersede`/`refute`
write only their `--out`/`--knowledge-file` store (append-only, atomic
write-then-rename, merge-on-save — concurrent appends never clobber).

```json
{ "ok": true, "action": "list", "project": "Servo Rig", "readOnly": true, "rankedBy": "fusion-rank",
  "count": 2, "rows": [ { "id": "lesson-verify-failure-1a2b3c4d", "kind": "semantic", "class": "verify-failure",
  "level": "L3", "phase": 6, "score": 0.4, "evidence": "calibrate servo loop tuning gains …", "tags": ["lesson", "verify-failure", "L3"] } ] }
{ "ok": true, "action": "propose", "mode": "keyless", "source": "draft (keyless)", "draft": { "project": "(proposed)", "kind": "note", "title": "…", "tags": ["lesson"], "body": "…" } }
{ "ok": true, "action": "accept", "store": "…\\lessons.json", "actor": "cli-human", "promoted": 2,
  "rows": [ { "entryId": "K1a2b3c4d", "appended": true, "lessonRow": "lesson-verify-failure-…", "title": "Lesson L3 verify-failure" } ] }
{ "ok": true, "action": "supersede", "supersedingId": "K9f8e7d6c", "appended": true, "superseded": { "id": "K1a2b3c4d", "supersededBy": ["K9f8e7d6c"] } }
{ "ok": true, "action": "refute", "id": "K1a2b3c4d", "counterEvidence": 1, "retired": false, "evidence": "…" }
```

## Wild (`wild`)

Bounded headless **wild-mode macro-run** plus the full lifecycle the UI toggle
offers. **Mutating:** a run-state change is persisted back to `--project`
(atomic write-then-rename, like `gate`); idempotent no-op controls (e.g.
`--pause` on an already-paused run) never rewrite the file.

| flag | meaning |
| --- | --- |
| *(none)* | **Step** an already-active run: one `engine.wildStep` loop per call (default 24 steps, `--steps` clamps 1–48). The loop stops on any non-`advanced` outcome (`paused` / `completed` / `noop`) — wild mode NEVER fabricates progress: gate decisions degrade to the deterministic DoD floor or pause with an honest log. |
| `--start` | **Enable Wild Mode AND begin a run** (store `setWildMode` + `startWildRun` parity): stamps the canonical active `wildRun`, logs `wild.start`, then runs the bounded loop above. This is the only way to reach wild mode from the CLI — without it a fresh project can never run. Refuses an already-active run (`RT_E_PHASE_ILLEGAL`, exit 1). A project already `complete` → exit 0 `outcome: "noop"`, `steps: 0`, nothing written. |
| `--pause` | Pause an active run (`pause: true`, `active` stays true, `wild.paused` ledger row). Idempotent on an already-paused run (`changed: false`). |
| `--resume` | Resume a paused run (`pause: false` + `wild.resume` ledger row). Idempotent on a non-paused run. |
| `--stop` | Stop the run (store `stopWildRun` parity: `active: false`, `stoppedAt` stamped, pause cleared, `wild.stop` ledger row). Idempotent on an already-stopped run. |

```json
{ "ok": true, "path": "build.json", "action": "start", "outcome": "paused", "steps": 5,
  "changed": true, "summary": { … }, "note": "…" }
```

A success envelope never carries `error` — a run detail rides as `note`, never the
dual `ok:true` + `error` shape (185-H1; failures use the coded `ok:false` shape below).
The keyless macro-run loop parks honestly at the first stock gate with
`outcome: "paused"` (the classifier cannot self-approve a human gate) — an
agent then `approve`s/rejects the gate and `wild --resume` continues the run.

Wild mode off, no active run, or a lifecycle flag on the wrong state →
`{ "ok": false, "reason": "not-wild" | "not-active" | "already-active", "code": "RT_E_PHASE_ILLEGAL", … }`, **exit 1**
(nothing was run, nothing was persisted). More than one of
`--start|--pause|--resume|--stop` → exit 1 with `RT_E_VALIDATION`.

## Resume and unattended (`resume` · `unattended`)

`run`/`gate` write a **bounded checkpoint** on every committed phase beside the project dir
(`<dir>/.rapidtool/checkpoint.json` — `checkpoint.server.ts`); a COMPLETE seal clears it. Both
verbs below are REAL drives wired through the same `runUntilGate` loop the original run used.

- **`resume --project <file.json|dir>`** (T-107.7) — read → admit → hydrate → re-enter. The
  admission is coded (`checkpointAdmits`): the snapshot's project id must match (a file
  argument pins the expected id, so an id reused by a different brief fails closed), the mode
  must match this process (`keyless`/`keyed` — a keyed snapshot never resumes keyless), and
  `run.phase`/`run.step` must be integers ≥ 0 with the recorded phase present in the
  snapshot's own phase records. The envelope carries `checkpoint: { path, savedAt, ageMs,
  resumedFrom }` — the snapshot age is always printed, resume is never silent. Exit taxonomy
  identical to `gate` (2 = parked; 1 = hard-DoD block / red-gate seal).
- **`unattended --project <file.json|dir>`** (W-47) — the scheduler-facing drive: re-enter
  from a checkpoint when one exists, else start from the project file; forces autopilot +
  live. **NOT a daemon** — there is no scheduler/queue in-product: an external hook (Windows
  Task Scheduler / cron) invokes this verb on a cadence, and each invocation is idempotent
  (it resumes instead of restarting). 341-6: it passes `machineGates`, so a stock HITL gate (P4/P5/P8/P9)
  whose DoD passes is cleared through the ledgered machine actor (`approve --seat autopilot`); only a
  `forceHuman` gate, or any red DoD gate, still parks (exit 2) — never a fake completion.
  The multi-brief wrapper that drains an intake directory and then delivers each
  completed project (`emit --run --git` — the tree is re-executed before it is
  committed) is [`scripts/factory-watch.mjs`](#the-walk-away-factory-scriptsfactory-watchmjs).

The earlier `run --unattended` / `gate --unattended` flags remain as the one-shot form of the
same drive (`--unattended` forces autopilot + live on those verbs). Neither verb is the wild
lifecycle: `wild --resume` is the wild-mode pause/resume action, unrelated to run resume.

> Honest follow-ups (do not claim them done): the shared `HISTORY_CAPS` across store/io/checkpoint
> (`A1-03` of `wave_plans/W34/code-notes.md`, landed partially in `fixes/281`). *(The former
> plan-before-first-mutation review entry is retired: `stageWildPlan` is the one staging site for both
> wild drivers and parks at `wild.plan_review` before the first mutation — `engine.ts:4398`,
> `store.ts:1357`, `headless.ts:5365/5592`; the browser reviewer is null and records the honest
> "not configured" review.)*

## The walk-away factory (`scripts/factory-watch.mjs`)

`unattended` drives ONE project to a terminal state; it is explicitly **not a
daemon**. `scripts/factory-watch.mjs` is the multi-brief orchestrator the
scheduler-facing story was missing (fixes/344 F-18): **ONE bounded tick** that
drains a brief intake and, per brief, runs the real CLI verbs

```
create  →  unattended (machine seat)  →  emit --run --git (per-project dir)
```

The deliver step **re-executes the emitted tree** (`emit --run`: per-file parse +
every emitted spec + the kind-entry smoke) and claims a delivery only when that
tree-run is green *and* the commit lands — a commit alone is never evidence the
artifact was built or tested.

It is the only "walk away and it ships" path in the repo, and it is honest about
the boundary: it delivers only a project whose drive reaches a clean terminal
seal **and** whose emitted tree re-runs green, and it reports every other outcome
with the CLI's own coded reason.

**Intake / workspace.** Exactly one of:

- `--intake <dir>` — a directory of brief files (`*.md` / `*.txt` / `*.brief`),
  sorted; each file is one brief. A leading `name:` front-matter scalar names the
  project, else the file stem does. The CLI's own `--brief @<path>` handling
  unwraps a corpus fixture's `brief:` front-matter scalar.
- `--queue <file.json>` — `[{ "name": ..., "brief": "<prose>" | "@<path>" }]`
  (also `{ "briefs": [...] }`).

`--work <dir>` is **required** — the factory workspace: it holds
`<work>/state/factory-state.json` (the durable checkpoint) and a per-project
directory `<work>/<slug>/` with `build.json` + `emitted/`. `--limit N` bounds the
briefs that do work in one tick; `--dry-run` plans and writes nothing; `--retry`
re-attempts a parked/stalled item (an explicit human decision).

**Checkpoint, resume, idempotence.** The factory persists the state after every
step, so a killed process **resumes rather than restarts** — a `driving` item
re-enters `unattended`, which itself resumes from the phase checkpoint the drive
writes beside the project (`<dir>/.rapidtool/checkpoint.json`). A brief already
`delivered` is **skipped**. If a brief's bytes changed under an existing record,
the item is reported as `changed` and left for a human — never silently re-run.
A corrupt state file is refused, never overwritten.

**Never invents success.** Delivery is claimed only after the `emit --run --git`
envelope proves BOTH a real commit (`committed: true`, or the idempotent
`noop: true` with a real `.git` on disk) AND a green tree-run verdict
(`treeRun.ok: true` — the emitted tree was re-executed at delivery time, not
merely committed). The persisted `delivery` record carries that verdict's
evidence (`treeRun.ok`, `declaredScriptsVerified`, the spec tally, and the minted
tree-test `evidenceHash` when `--run` promoted one). Every other terminal is
reported with its code and left for a human:

- `parked` — exit 2 from `unattended`: the machine seat is exhausted at a
  `forceHuman` gate (or a `blocked` project). A person must `approve`/`reject`.
- `stalled` — exit 1: a hard DoD block (`RT_E_GATE_PENDING`), a red-gate complete
  seal (`RT_E_GATES_FAILED` — a red seal is never a clean 0), a checkpoint
  refusal, or a delivery refusal (`RT_E_GIT_UNAVAILABLE`, `RT_E_FOREIGN_FILES`,
  `RT_E_TREE_RUN_FAILED` — a red re-run at delivery time — …).
- `failed` — a runtime/backend failure (exit 3/4), retried on the next tick until
  the bounded attempt cap, then left for a human.

**Honest limits (do not claim these are automated).** The factory does not repair
a red gate and does not clear a `forceHuman` gate. A **keyless** drive is the
deterministic floor, which cannot synthesise a brief-conformant module, so it
seals with the P6 DoD gate red and is reported `stalled` — keyless walk-away
therefore does **not** deliver; it produces an honest, coded stall for a human.
A keyed drive defaults DoD enforcement ON and may still miss the P6 DoD (the
synthesis is not guaranteed), which is likewise reported, never papered over.
The human follow-up for a stalled project is the repair loop (`tree-run` /
`repair --dir`) or a re-drive with `--retry` after a fix.

**Exit codes.** `0` every processed item is delivered (or was already);
`2` at least one item parked/changed and none stalled/failed; `1` a stall or
failure (or a usage error); `4` an unexpected factory-internal failure.

```bash
# one tick by hand
node scripts/factory-watch.mjs --intake "C:\briefs" --work "C:\factory"
# or via the npm script
npm run factory -- --intake "C:\briefs" --work "C:\factory" --limit 3
```

### Host-hook recipe (Windows Task Scheduler / cron)

The factory is a **bounded tick**, not a daemon — schedule it. Each run is
idempotent, so a missed tick simply does the work on the next one.

**Windows Task Scheduler** (every 30 minutes; adjust paths; `cmd /c` +
quoted `cd /d` because the repo path contains a space):

```
schtasks /Create /TN "RapidToolFactory" /SC MINUTE /MO 30 /RL LIMITED /F ^
  /TR "cmd /c cd /d \"C:\Users\me\Desktop\RapidTool Main\" && npm run factory -- --intake \"C:\briefs\" --work \"C:\factory\" >> \"C:\factory\tick.log\" 2>&1"
```

Run it once immediately with `schtasks /Run /TN "RapidToolFactory"`; delete with
`schtasks /Delete /TN "RapidToolFactory" /F`.

**cron** (POSIX host):

```
*/30 * * * * cd "/srv/rapidtool" && npm run factory -- --intake /srv/briefs --work /srv/factory >> /var/log/rt-factory.log 2>&1
```

The key resolution is the CLI's own (repo `.env` wins over the process env): a
keyed hook must run the command from the repo root (as above) so the funded
`.env` key applies; a keyless hook sets a **present-but-blank** `DEEPSEEK_API_KEY`
(the process env's keyless disable) so the deterministic floor runs. Measured
provider usage from a tick can be captured with the provider's opt-in log — set
`RAPIDTOOL_LLM_USAGE_LOG=<file>` in the hook's environment; the factory forwards
its environment to every child, and each completed provider call appends one
JSON line (model + token counts, never a prompt or key).

## Agent contract (exit codes + stdout purity)

This CLI is designed to be driven by an AI agent (e.g. a Hermes-style loop),
so the contract is strict and stable:

- **Every subcommand prints exactly ONE JSON object to stdout** — no progress
  lines, no banners, no stack traces. Human-facing chatter goes nowhere;
  parse stdout, branch on the JSON.
- **Exit 0** = the command executed and produced its payload
  (`ok: true`, or `ok: false` only when the JSON *is* the honest outcome).
  For `emit --run` / `tree-run`, exit 0 means the tree is not red; the envelope
  still distinguishes a fully verified toolchain from an unverified one via
  `unverified` / `declaredScriptsVerified` / `unverifiedDeclaredScripts`.
- **Exit 1** = the command could not execute (bad/missing args, missing
  project file) — stdout is `{ "ok": false, "error": "…" }`.
  `run`/`gate` also exit 1 (code `RT_E_GATES_FAILED`, `sealedWithFailures:
  true`) when the run sealed COMPLETE with one or more recorded FAILED DoD
  gates — a red-gate completion is never a clean exit 0.
- **Exit 2** = `run`/`gate` parked the project at a HITL gate or in `blocked`
  (full state is on stdout — `approve`/`reject`/`retry` next).
- **Exit 3** = a backend is not configured — no `DEEPSEEK_API_KEY` where one is
  required (`RT_E_LLM_NOT_CONFIGURED`).
- **Exit 4** = backend or internal runtime failure — including a missing/broken
  optional module in the vault/design/diagram arms (envelope carries the
  `RT_E_*` code).
- **Exit 5** (`emit --run` / `tree-run` only, **opt-in**) = the tree is GREEN but
  its DECLARED project scripts (e.g. `typecheck`, `build`) could not be resolved/run — the
  emitted toolchain is UNVERIFIED, not failed. `ok` stays `true` (nothing ran
  red, and the tested-mint is unaffected) and the envelope carries
  `unverified: true`, `declaredScriptsVerified: false`, and
  `unverifiedDeclaredScripts: [...]` naming exactly which scripts did not run.
  **The default is exit 0** for that state. Note (corrected 2026-10-03 by the 345-F1 docs-truth
  fix): a fresh emit whose declared scripts resolve from the RapidTool repo's own `node_modules/`
  is **verified** (`declaredScriptsVerified: true`, exit 0) — the unverified state is the residual
  case, not the fresh-emit default. Pass `--require-verified` to opt INTO the strict exit 5 for
  your gate; resolve/link the tree's deps and re-run `--run` to reach a verified
  state (exit 0 with `declaredScriptsVerified: true`). Exit 5 is deliberately
  NOT exit 1 (an honest unknown, not a red tree).
- `summary` carries agent hints: `researchCount` (cited findings across live
  corpus rounds; 0 on deterministic runs), `memoryCount` (atomic memory rows),
  and `vaultReady` (true when `src/lib/vault.ts` exists AND the project already
  holds note-able content — i.e. `vault` will succeed).
- **A value-taking flag is never silently ignored.** A value flag passed with
  no value (`--limit`, `--phase`, `--name`, `--steps`, `--budget`, `--dir`, …)
  parses as a bare `true`; the CLI refuses it before dispatch with exit 1 +
  `RT_E_VALIDATION`, naming the flag and the two spellings. A **documented
  numeric** flag (`--limit`, `--phase`, `--steps`, `--max-steps`, `--budget`)
  whose value is present but not a non-negative integer is refused the same way
  — before W49 it was silently dropped (live: `search --limit abc` exited 0 on
  the default, `deepen --phase abc` fell back to the live phase and reported a
  misleading phase error). Boolean flags (`--live`, `--apply`, `--force`,
  `--start`, `--require-verified`, the `lesson`/`wild` action flags) are
  unaffected. This closes the valueless-flag asymmetry of the 330/331 waves one
  class at a time (S3 · W46 · 332-4; numeric class W49 · 335-4).
- **A usage refusal names its own fix.** `remedy` rides every coded refusal;
  for a CLI usage error (`missing required --flag`, an unknown verb, a bad
  `--red-tree`/`--kind`/`--tree` value, …) it is the CLI's own concrete fix, not
  the registry's `RT_E_VALIDATION` action (which speaks to the engine validating
  model output). `--help <verb>` lists the verb's accepted flags (W49 · 335-4).

## Error codes (RT_E_*)

Every `{ "ok": false, … }` envelope carries `code`, a stable machine-readable
error id produced by `classifyError` (`src/lib/errors.ts`) from the human
`error` text. Codes never replace the exit-code taxonomy above — they refine
it: the same exit code can carry different codes, and agents should branch on
`code` first, `exit_code` second. Adding the optional `code` field is additive
for JSON consumers (they already branch on `ok`/`error`), so `schema_version`
stays `1` — schema-version bumps are reserved for breaking envelope changes.

The classifier matches a small set of signals — a thrown `RT_E_*` code passes
through; `ENOENT`; abort/timeout prose; report rejection by error name; the
OS/network errno families (`EACCES`/`EPERM`, `ENOSPC`, `EADDRINUSE`, connect/DNS,
a bare `fetch failed`); a failed `JSON.parse` → `RT_E_VALIDATION` — so a subset
of codes appears on CLI envelopes today: project-file load failures →
`RT_E_PROJECT_MISSING`; rejected reports → `RT_E_REPORT_INVALID` /
`RT_E_REPORT_PHASE_MISMATCH`; `emit`/`check` failures → `RT_E_FOREIGN_FILES` /
`RT_E_CHECK_FAILED`; exit-3 (backend not configured, crew/verify/prompt) →
`RT_E_LLM_NOT_CONFIGURED`; unmatched prose falls back to the caller's domain
code, else `RT_E_UNKNOWN`. The remaining codes are engine/UI-domain and
surface in `src/lib` results or the console instead. The canonical registry is
`ERROR_CODE_DOC` in `src/lib/errors.ts`; this table mirrors it — the full
registry, one row per code, `typical exit_code` from the taxonomy above:

**The lesson/wild pillar subcommands add NO new codes** — they reuse the existing
registry: `harvest` never fails for missing keys (keyless; honest-empty rows +
exit 0), `knowledge`/`mine`/`lesson` pin `RT_E_VALIDATION` for malformed input
(exit 1), `wild` pins `RT_E_PHASE_ILLEGAL` for not-wild/not-active refusals (exit 1), and
`prompt` exits 3 → `RT_E_LLM_NOT_CONFIGURED` exactly like `crew`/`verify`.
The emit→edit→re-emit verbs (`tree-run`/`repair`, fixes/150 wave G1) set their codes
**directly in their case arms** (not via the classifier): red tree →
`RT_E_TREE_RUN_FAILED`, exhausted repair → `RT_E_REPAIR_FAILED`.

| code | meaning | agentAction | typical exit_code |
| --- | --- | --- | --- |
| `RT_E_UNKNOWN` | No classifier matched — the failure is opaque. | Inspect the raw message and the call site, then re-surface the failure with the closest specific code instead of guessing. | 1–4 (fallback) |
| `RT_E_PROJECT_MISSING` | The referenced project (id or file) does not exist or cannot be loaded. | Check the project id/path against the registry; create or import the project first, or report an honest not-found to the user. | 1 |
| `RT_E_PHASE_ILLEGAL` | An operation targeted a phase that is not legal from the current state (unknown id, out of order, or sealed priors). | Re-read currentPhase against the phase graph (canEnter/priorsSealed) and either pick the correct next phase or explain why the requested one is not reachable yet. | 1 or 4 (engine-thrown via run/gate) |
| `RT_E_GATE_PENDING` | The operation requires a resolved gate, but a HITL gate is still pending. | Route the project through the open HITL prompt (approve/reject with feedback); do not auto-advance and never fabricate a decision. | 1 (approve/reject state guard) |
| `RT_E_REPORT_INVALID` | An ingested agent report failed shape validation. | Fix the report to match the AgentReport schema (phase 0-12, status enum, non-empty summary) and re-submit; never mutate project state. | 1 |
| `RT_E_REPORT_PHASE_MISMATCH` | A report targeted a phase other than the live current phase. | Re-emit the report for project.currentPhase, or advance the project to the phase the report covers first. | 1 |
| `RT_E_RUNNER_UNAVAILABLE` | The bounded code runner is not configured in this environment. | Fall back to the deterministic self-test path and label lastTest as self-test — never present a fallback as a real run. | 3 (verify/exec domain) |
| `RT_E_RUNNER_FAILED` | The runner executed but failed (refused, timed out, non-zero exit, or spawn failure). | Read the runner's stdout/stderr evidence, fix the generated module, and re-run before claiming any test verdict. | 4 (verify/exec domain) |
| `RT_E_CHECK_FAILED` | The compile-check pass found emitted files that do not parse (per-file verdicts carried on the result). | Read the per-file verdicts, fix the offending emitted modules at the generator, and re-emit before building further. | 1 (emit --check / `check`) |
| `RT_E_LLM_NOT_CONFIGURED` | No DeepSeek API key is present, so no LLM call can run. | Return the honest not-configured fallback (deterministic path), never fabricate model text, and tell the user to set DEEPSEEK_API_KEY. | 3 |
| `RT_E_LLM_TIMEOUT` | The LLM call exceeded its deadline. | Retry once if the task is idempotent, otherwise fall back to the deterministic path and report the timeout honestly. | 4 (crew/verify backend) |
| `RT_E_LLM_REJECTED` | The LLM provider refused the request (401 auth, 402 billing, 429 rate limit, invalid params, or empty content). | Do not retry blindly; check key/balance/parameters, and surface the provider's own message to the user. | 4 (crew/verify backend) |
| `RT_E_LLM_NO_BALANCE` | The LLM provider refused the call because the account balance is exhausted (the provider's HTTP 402 / "Insufficient Balance" — a wallet class, not a generic refusal). | Stop consuming this account: do not retry (billing is not transient) and read NO keyed score from a run in this state — top up the account or switch keys, re-pass the fundedness probe, then re-run. | 4 (crew/verify backend) |
| `RT_E_LLM_KEY_REJECTED` | The LLM provider rejected the API key it was sent (HTTP 401 authentication failure) — the credential is invalid/revoked, not the request. | Fix the key at the source named in the message and `remedy` (the `.env` path or the process environment, tail-only), confirm which source wins under "API key resolution", then re-run; never paste the full key into logs. | 4 (crew/verify backend) |
| `RT_E_LLM_KEY_SHADOWED` | A conflicting ambient `DEEPSEEK_API_KEY` and the `.env` key are both present and differ — the `.env` key wins by documented precedence and the ambient key was ignored (surfaced on stderr, never silently shadowed). | No action is needed to proceed; to silence the signal, clear the stale ambient variable (Windows: remove the User-scope `DEEPSEEK_API_KEY`) or make it match the `.env` key. Compare by last-4 tails only. | - (diagnostic; never fails the run) |
| `RT_E_RESEARCH_UNAVAILABLE` | The live web-research backend is not configured or unreachable. | Proceed with the deterministic corpus, set liveUnavailable so the documented gate waiver applies, and never present fabricated findings as real research. | 3 (engine live-overlay domain) |
| `RT_E_VALIDATION` | Input or model output failed validation and cannot be used. | Reject the payload, state the concrete validation rule that failed, and ask for corrected input instead of guessing. | 1 |
| `RT_E_INTERNAL` | Unexpected internal failure (transport, serialization, server). | Log the full error, retry once if it may be transient, and escalate with the raw message rather than paraphrasing. | 4 |
| `RT_E_GATES_FAILED` | The run sealed COMPLETE while one or more recorded DoD gates stand FAILED — a red-gate seal, never a clean one. | Read summary.failedGates (the census), repair the failing phase(s) and re-run — do not treat this exit as a successful completion or ship the artifact as-is. | 1 (run/gate red-gate complete) |
| `RT_E_TREE_RUN_FAILED` | `tree-run --dir` (or `emit --run`) executed the tree and it is RED — not all parse/spec/entry verdicts are ok. | Read the envelope's first not-ok tail, fix the emitted file(s) in the dir, re-run — never treat a red tree as clean. | 1 (tree-run / emit --run red tree) |
| `RT_E_REPAIR_FAILED` | `repair --dir` exhausted its cycle budget without a green tree-run — the deterministic floor stands, no fake repair was applied. | Read the failure tail/refusal in the envelope, hand-edit the dir or tighten the brief, re-run repair. | 1 (repair budget exhausted) |
| `RT_E_VERIFY_KIND_FAILED` | `emit --verify-kind` ran the bounded scratch-copy install + the declared build/test leg and it ended red (fixes/216z · T4.1). | Read the honest install/build `detail` and fix the emitted scaffold or the emitted package. | 1 (emit --verify-kind) |
| `RT_E_BUDGET_EXHAUSTED` | A journey or wild run hit its hard cycle/token budget and stopped without converging. | Read the last tree-failure tail, raise the budget only with a human decision, or repair the generator — never mint converged after exhaustion. | 4 (crew/engine budget stop) |
| `RT_E_ABORTED` | The process received SIGTERM/SIGINT and stamped acceptance:aborted before exit. | Resume from the persisted cursor if one exists; do not treat the run as accepted or failed. | 1 (chat abort; signal stamps exit 130/143) |
| `RT_E_BUSY` | Another writer holds the project file lock (saveProject O_EXCL). | Wait and retry the save; do not overwrite or delete the .lock file while a writer is live. | 1 (emit/save lock refusal) |
| `RT_E_FOREIGN_FILES` | emit refused because the target dir contains foreign files that are not leftover tests/ (also: a forced emit's quarantine move failed — `quarantineFailed`). | Pass --force only if you accept the foreign files moving aside into `<dir>/.rapidtool-quarantine/<stamp>/`, or emit into a clean directory. | 1 (emit --force refusal / quarantine move failure) |
| `RT_E_PERMISSION_DENIED` | The OS denied access to a file or directory (EACCES/EPERM). | Fix the path's permissions or run from a location the process may write to; do not retry the same path unchanged. | 1–4 (classified in place) |
| `RT_E_DISK_FULL` | A write failed because the filesystem has no space left (ENOSPC). | Free space or point the output at another volume before retrying; never report the write as done. | 1–4 (classified in place) |
| `RT_E_PORT_IN_USE` | A server could not bind because the address/port is already in use (EADDRINUSE). | Stop the process holding the port or bind a different port; do not kill processes blindly. | 1–4 (classified in place) |
| `RT_E_NETWORK_UNREACHABLE` | A network call never reached its target — DNS miss, refused or reset connection, unreachable host (includes undici's bare "fetch failed"). | Check the target host/port and connectivity; retry once if the failure may be transient, then report the unreachable endpoint honestly instead of fabricating the remote result. | 1–4 (classified in place) |
| `RT_E_GIT_UNAVAILABLE` | The git binary is not available in this environment, so the git landing tail cannot run. | Report the absence honestly and leave the tree uninitialized — install git, or run where git exists; never fake a landing or hand-roll repository metadata. | 1 (`emit --git` delivery tail; live emitter in `src/lib/git.server.ts`) |
| `RT_E_CHECKPOINT_MISSING` | T-107.7: `resume`/`unattended` found no checkpoint at <projectDir>/.rapidtool/checkpoint.json — the run never committed a phase with a known project dir, or a COMPLETE seal cleared it (there is no successor state to re-enter). | Continue with the normal run verbs — `gate`/`run --project` writes a fresh checkpoint on every committed phase (`unattended` starts from the project file when no checkpoint exists); re-run `resume` only after a run has committed a phase beside that dir. Never invent a resumption. | 1 (resume/unattended re-entry) |
| `RT_E_NOT_IMPLEMENTED` | The requested capability is a coded SHELL: its seam exists (types/parsing/refusal paths in place) but the full logic is not wired yet — the message names the owning TODO row. | Treat the refusal as the honest state of the build: read the named TODO(<row-id>) / lane log, implement that row, and re-run; never work around it by fabricating the missing behavior. | — (no live emitter today) |
| `RT_E_AUTH_SCHEMA_MISSING` | Sign-in is enabled (VITE_AUTH_ENABLED is not "false") but no migration creates the Better Auth "user" table — migrations/auth/*.sql is never applied (neither the deploy migrator nor the PGLite fallback descends into it). | Copy the auth schema into the migrated directory (`cp migrations/auth/0001_auth.sql migrations/0001_auth.sql`, plus any later migrations/auth/*.sql in name order), restart, and re-run; or set VITE_AUTH_ENABLED=false to run without sign-in. Never let the app serve sign-in against a schema-less database. | 1 (migrate/build preflight) |
| `RT_E_MCP_DISABLED` | F1 (R8-f11 / R13-f06): the MCP runtime client is owner-gated and DISABLED by default — no child process is spawned and zero network I/O is performed until the owner sets RAPIDTOOL_MCP_ENABLED=1. The JSON-RPC 2.0 stdio transport itself IS implemented (`src/lib/mcp.server.ts`, 340-1); the trust gate, not a missing transport, is why nothing runs. | Do not simulate MCP discovery or fabricate tool lists: wait for the owner's trust decision, then set RAPIDTOOL_MCP_ENABLED=1 and re-run the read-only tools/list discovery (the stdio transport is implemented — `src/lib/mcp.server.ts`). | 1 (`doctor --mcp-call` / `doctorMcp`; live emitter) |

## Full agent loop (Hermes-style)

Drive a project from brief to verified artifact by reading only the JSON:

```bash
B="node --experimental-strip-types scripts/rapidtool-cli.mjs"

# 1. create
$B create --brief "Build a field-service dispatch board for HVAC." --name "HVAC Dispatch" --out build.json
# 2. deterministic research phases until the first stock HITL gate (P4) parks
$B gate --project build.json                       # {ok, summary, steps, stopped}
# 3. human/agent decision on the parked gate → approve (or reject --note "…")
$B approve --project build.json                    # {ok, summary}
# 4. a rejected gate parks the project as blocked — retry re-opens the phase
$B retry --project build.json                      # {ok, summary.status: running}
# 5. loop gate → approve until complete or blocked
#    (stock gates P4/P5/P8/P9 and forceHuman gates are NEVER auto-approved)
# 6. ingest an external agent's report at any time (append-only)
$B ingest --project build.json --report '{"phase":4,"status":"complete","summary":"…","artifacts":[{"title":"…","body":"…"}]}'
# 7. run the advisory crew over the current phase (only with DEEPSEEK_API_KEY)
$B crew --project build.json --max-steps 12        # feed artifacts back via ingest
# 8. verify the generated source once codegen phases have run
$B verify --project build.json                     # loop on status != "passed"
# 9. vault + search the accumulated knowledge
$B vault --project build.json --out vault/
$B search --project build.json --query "OAuth scopes"
# 10. list artifacts → decide what to fetch next (rows: id/phase/kind/title/bytes)
$B artifacts --project build.json
# 11. design tokens (+ a standalone HTML preview with --html) for the next builder
$B design --project build.json --html design.html
# 12. SVG diagrams: phases | architecture | flow (--out persists the SVG)
$B diagram --project build.json --kind architecture --out architecture.svg
# 13. compile the agent packet / snapshot / full export for handoff
$B packet --project build.json --out packet.md
$B export --project build.json --out final.json
# 14. bounded live-source harvest for the brief (real repos/licenses — never fabricated)
$B harvest --project build.json                    # {ok, rows[], querySource, notes[]}
# 15. advisory swarm critique of the current phase (pure state analysis)
$B swarm --project build.json                      # {ok, critiques[], refinedPlan}
# 16. synthetic estimate suite (tokens/time/complexity/failure points)
$B bench --project build.json                      # {ok, token, time, complexity, failurePoints}
# 17. structural map of a real directory (bounded; skips reported)
$B mine --dir src/lib --limit 200                   # {ok, files[], map, conventions, skipped}
# 18. cross-project pattern store (append / search)
$B knowledge --store patterns.json --save '{"project":"p","kind":"pattern","title":"…","tags":["x"],"body":"…"}'
$B knowledge --store patterns.json --find "auth refresh"
# 19. the human-gated lesson family — list (read-only) / accept (THE cross-project write)
$B lesson --list --project build.json [--brief "…"]          # {ok, readOnly: true, rows[]}
$B lesson --accept --project build.json --out lessons.json --actor NAME   # {ok, promoted, rows[]}
# 20. wild mode: enable + begin a run; approve/reject parked gates; resume/stop
$B wild --project build.json --start --steps 24   # {ok, outcome, steps, summary} — parks at the first human gate
$B wild --project build.json --resume             # continue after the gate decision
# 21. grounded copilot turn over the project (only with DEEPSEEK_API_KEY)
$B chat --project build.json --ask "What is the isolation policy?"   # {ok, reply, provenance}
# 22. deepen a completed research phase (P7 dead-end recovery, keyless-honest)
$B deepen --project build.json --phase 7          # {ok, changed, liveUnavailable, log}
```

Pseudocode a driver agent can follow:

```
project = create(brief, out)
loop:
  r = gate(project, autopilot?)          # JSON: ok/summary/steps/stopped
  if r.summary.status == "blocked": retry(project)   # a rejection parked the project
  if r.summary.status in ("complete", "blocked"): break
  approve(project)                       # human decision on the stock gate
verify(project)                          # only when summary.currentPhase >= 10
vault(project); search(project, query)   # knowledge layer for the next agent
artifacts(project)                       # index → pick the artifact to fetch next
design(project, html?)                   # design tokens (+ optional HTML page)
diagram(project, kind, out?)             # SVG: phases / architecture / flow
```

Mutating commands (`create`, `run`, `gate`, `approve`, `reject`, `retry`,
`ingest`, `wild`, `deepen`) write the project back to
`--project`/`--out` atomically (write-then-rename); `vault` is the one writer
of the vault directory, and `design`/`diagram` are the writers of their
`--html` / `--out` files (`design --html`, `diagram --out`). Every other
command leaves the project file untouched. `wild`/`deepen` persist only when
the run state actually changed (an idempotent no-op control never rewrites the
file). `knowledge --save`, `lesson --accept` (its `--out` store),
`lesson --supersede` / `lesson --refute` (their `--knowledge-file`) mutate
cross-project STORE files only — the project file is never touched.

## Tests

This file is pinned by **two legs** — the `npm test` pair (`ls scripts/*.test.mjs` + the
`src/lib/**/*.test.ts` suite; both canonical commands are `package.json`'s `test` script):

```bash
npm test                                                 # both legs, in order
# leg 1 — the scripts suite (24 contract suites), incl. THIS file's doc-contract pins:
node --test "scripts/**/*.test.mjs"
# leg 2 — the engine suite (`headless.test.ts` + `harvest.test.ts` are part of it):
node --experimental-strip-types --test "src/lib/**/*.test.ts"
```

## The `approve` seat — `--i-am-human` + the out-of-band `RT_HUMAN_SEAT_TOKEN` (216 · TA-2 · R5-f12 two-channel)

Every HITL approval is recorded under an explicit **actor seat**, so a machine
path can never mint `decidedBy: "human"` (the pre-216 behaviour: `approve()`
hardcoded a human actor for every caller, including the eval harness).

- **Default seat (no seat claimed)** → `decidedBy: "autopilot"`, seat
  `harness`; the ledger row's note carries the `[seat harness]` tag. This is
  what an unattended/agent process gets. Consequence: a plain approve can
  never override a `forceHuman` gate (e.g. a failed P6 sandbox) — such a gate
  needs the human seat below plus `--force`.
- **Human seat** → `decidedBy: "human"`, seat `human-cli-i-am-human`. The seat
  needs TWO channels (R5-f12 — the two-channel claim, `humanSeatClaim`):
  - **Channel A — possession/claim:** the person at the keyboard exports
    `RT_HUMAN_SEAT_TOKEN` in their own shell; that environment value is the
    EXPECTED side.
  - **Channel B — presence/confirmation:** the CLI prompts on stderr and the
    person RE-ENTERS the same token; the typed value is the PRESENTED side.

  A TTY-typed `approve` thus presents BOTH pieces of evidence:
  1. `--i-am-human` on the command line (the T0.7 guard: a non-TTY `approve`
     without it exits 1 with `RT_E_VALIDATION` before anything is minted), and
  2. the two-channel token above, e.g.
     ```
     export RT_HUMAN_SEAT_TOKEN="$(head -c 24 /dev/urandom | base64)"
     node --experimental-strip-types scripts/rapidtool-cli.mjs approve \
       --project build.json --i-am-human
     # → Confirm human seat — re-enter RT_HUMAN_SEAT_TOKEN:  (type it again)
     ```
     On a match the row's note reads
     `[seat human-cli-i-am-human] out-of-band RT_HUMAN_SEAT_TOKEN verified`.

  A **non-TTY** `--i-am-human` is refused outright (exit 1, `RT_E_VALIDATION`):
  there is no second channel to type into, so no human row may be minted — use
  the autopilot seat (`gate --autopilot`) for machine approval. With a typo'd,
  empty, or non-matching re-entry/env, the call REFUSES: exit 1, envelope
  `code: "RT_E_VALIDATION"`, the message naming `RT_HUMAN_SEAT_TOKEN` — and
  **nothing is written** (the project stays parked at the gate, no ledger row,
  no human actor). A seat claim without its out-of-band evidence never lands.
  Ceiling (honest): an accountability control under the ledger-trust assumption
  (same-OS-user processes can read env/files), **not** a security boundary.

### The same seat on `reject` (322 · F-1)

The reject door carries the identical discipline: exactly one seat — `--seat autopilot`
(`decidedBy: "autopilot"`, seat harness) or `--i-am-human` (the human two-channel claim,
TTY only). A bare `reject` (either TTY state) is refused CODED — exit 1, `RT_E_VALIDATION`,
with both seat doors in the remedy — and the chosen actor is stamped on the minted ledger
row + `lastGate`, so a machine reject can never mint `decidedBy: "human"` (the pre-322
behaviour: `rejectHitl` hardcoded the human stamp for every caller; live bytes
`live1/05_sealed_reject_note.out`).

The token is deliberately out-of-band: do not bake it into scripts, config
files, `package.json`, or the project JSON — a process that merely inherited an
agent's environment does not hold it (and cannot type it). `approve` is the only
verb that REQUIRES the human seat (non-TTY calls); the same two-channel claim
backs `fixtures --approve` and `edit --write` when `--i-am-human` is passed; the
autopilot path (`gate --autopilot`, `wild`) never touches it.
