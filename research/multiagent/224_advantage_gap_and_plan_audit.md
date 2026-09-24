# 224 · AUDITOR 2 — the plan's prosecutor: task-list audit + competitor-advantage / RapidTool-disadvantage ledger

**AUD-2 · W13 · written 2026-09-24** · READ-ONLY except this file + 5 attributable markers in `220_tasklist_canonical.md`.
**Plan followed:** `wave_plans/W13/aud-2.md` (read in full, first). **Canonical list state:** landed mid-run (12:05),
audited at 299 lines / 42 rows; WATCHDOG E's file landed 12:05 (read before writing, to avoid duplicate corrections).
**Tree state:** HEAD `7582771`; `fixes/218` §5 gate of record (11:08) — not re-run (forbidden).
**Method:** every RapidTool anchor below was read/greped by me 2026-09-24; every competitor anchor is a clone
`ls`/`grep`/read by me today (nothing executed from any clone) or a marked E/dossier citation (E = live page
read, URL+date, `220_external_verification.md`). My test runs: **3 of ≤3** used (`honesty-guards` 5/5 ·
`token-ledger` 23/23 · `lesson-writers` 18/18, all `--test-concurrency=2`). Scratch: `C:/Users/mnril/w13i_scratch/`.

---

## BOTTOM LINE (read this first)

> **task-list rows audited: 42 (canonical) + 16 (219e W14–W16 cross-map) · corrections filed: 5 · unsupported rows: 0 · missing-from-list: 3**
> **advantage gaps found: 7 · ranked: #1 provider breadth** (the durable judge-fix and BYOK both sit behind it, and the entire
> proof runs through one vendor's one key) · **#2 sandboxed execution** (caps what may be claimed/automated; *not* closable on
> this host — infra decision) · **#3 MCP runtime client** (table stakes; engineering M, first step S, 221 F1 designed).
> **The single most consequential thing no earlier agent reported:** RapidTool has **zero CI** — 0 workflow files on a real
> GitHub remote (`git@github.com:RodneyDanger1/RapidTool.git`) while every sized competitor clone ships 7–30
> (`cline` 17 · `codex` 30 · `opencode` 26 · `Dyad` 20 · `bolt.diy` 12 · `aider` 10 · `Roo` 7 — counted today). The repo's
> winning axis is verification discipline, yet nothing enforces it outside one machine, and **no row of the 42** mentions it.
> Cheapest close in the whole ledger: one workflow that runs `scripts/gate.sh`.

*Corrections filed in `220_tasklist_canonical.md` (attributable markers, §1.7): DF-09 anchor · lesson-writers count ·
T5.3 `--limit` form · coverage gaps (scheduler / lesson-ranking / patch-format) · MCP-count precision. E's audit and mine
agree on the hard statuses (OV-2 known-broken; T4.3/DF-09/G4 honestly MISSING-cmd; 0 file-missing; 0 cmd-invalid) and
neither of us found an unearned `DONE-VERIFIED` row.*

---

## §1 · The task-list audit

### 1.1 What was audited, and when

| artifact | when | what I did |
|---|---|---|
| `220_tasklist_canonical.md` (D) | landed 12:05, audited after | all 42 rows: why-traces (spot-read ~25 anchors), §2 DONE-VERIFIED spot-checks (3 live runs + reads), every verification command vs a real entrypoint, §3 sequencing, §6 coverage/cuts |
| `219e` W14/W15/W16 tables + `220` §4 | fallback (canonical absent at my start) | cross-mapped; WD-C's plan-step table re-derived at key points; additions in §1.8 |
| `220_external_verification.md` (E) | 12:05, read in full | agreement check + dedupe of corrections (E: 42+16 rows, 1 invalid cmd = OV-2; mine: content corrections, below) |

### 1.2 Why-traces — all spot-checks resolved (selection, read today)

Read and confirmed exactly as the row says: `headless.ts` has 0 `nextAction` + `uiNextAction` at `console.tsx:311` ·
`phases.ts:150-151` `HITL_PHASES`+`STOCK_HITL` · `phases.ts:33` B-18 declaration · `dod.ts:428-430` `p3-mcp` probe ·
`dod.ts:232/:546` `archProductComplete` (consumers = `gates.test.ts` only: `:11,:932,:939,:1000,:1014`) ·
`store.ts:573-578` comment-only catch · `store.ts:1529-1534` no-note approve · `store.ts:1547` ≥12-char rejection guard ·
`verify.server.ts:271-276` silent null parse · `browser-guard.mjs:34-42` prefix guard · `registry.ts:35-38` deferred list,
`:94,:143,:396` · `knowledge.ts:19,:363-366,:952` · `compile-check.server.ts:939,:1024,:1036/:841,:918` ·
`codegen.server.ts:2055` repair-level comment · `scaffold.ts:491,:2480` · CLI `:781 emit :896 fixtures :1135 edit :2763 doctor`,
`redTree`=0, USAGE `diagnose:`=0, `case "new"` absent (real: `create` :421 / `run` :444 / `gate` :445) ·
`engine.ts:922` MCP/A2A text, `:1336-1340` shortfall, `:3012/:3030` silent catches, `:1464-1468` red-seal branch,
`:63-67` node:fs rule · `types.ts:27/:41-47/:187` · `deepseek.ts:377` `stream: false` ·
`fixes/217c:19` "outcome UNKNOWN, awaiting W11-L2 host probe" + `:592-595` `[W11-L2 PROBE RESULT — UNKNOWN at write time…]` ·
`taskuniverselog:533-539` TASK-01 decision · `remainingwaves:195/:202/:219` · `doctor.ts:157/:167/:185/:220` +
`doctor.test.ts:81-92` (latch setter — only a test sets it) · `headless.ts:730/:736` seats, `:3207` sole caller passing no `extra`.
**Verdict: no why-trace failed to resolve.** One inherited anchor error — see correction #1 (DF-09).

### 1.3 DONE-VERIFIED spot-checks (the dangerous status) — 3 live runs + reads

| §2 claim | check I ran today | result |
|---|---|---|
| **F1** `probe:<id>` tags wired (`knowledge.ts:952` spread) | `node --experimental-strip-types --test --test-concurrency=2 src/lib/honesty-guards.test.ts` | **5/5 pass, 0 fail** — matches 219b §1.3 ("5/5 green") and 218 §1 (lane C) |
| **T-107.6 ledger core** ("23/23, 217b E4") | `… src/lib/token-ledger.test.ts` | **23/23 pass** — matches 217b E4 exactly |
| **T-11 half 1** ("lesson-writers (15 after repair)") | `… src/lib/lesson-writers.test.ts` | **18/18 pass** — the suite is **18** tests today, not 15 → correction #2 |
| `patch.test.ts` "21 `it(`" (219a r18) | `grep -oE '(^|[^a-zA-Z_])it\(' src/lib/patch.test.ts \| wc -l` | **21** ✓ (strict count; note the naive `grep -c 'it('` over-counts via `await(` — `policy.test.ts` is 27 strict, not 28) |
| `policy.test.ts` "27 `it(`" (219a r19) | same strict count | **27** ✓ |
| T-18 `treeRun` anchors | `compile-check.server.ts:939/:1024/:1036/:841/:918` | all exact; `ok = compile.ok && specsGreen && entryGreen && projectLeg.verdict.ok` ✓ |
| `scaffold.test.ts:756/803/887` pins (219b §1.4 r3) | line reads | anchors resolve into test bodies; semantic pin claim remains 219b's (not re-derived) — no contradiction found |
| graders / fixtures | `ls research/eval-corpus/graders \| wc -l` = **6**; `*.md` = 7 (6 fixtures + README) | ✓ matches §2 and 219e §0 |

**Verdict: no unearned DONE-VERIFIED.** One stale parenthetical count (correction #2); everything else holds under
independent re-run/read. FALSIFIED-list cross-check (219b): C-09 `entries()` copy ✓ (`knowledge.ts:363-366`), T-04/T-05
pins region ✓, F1/F3/F4 ✓ — no falsified item resurfaces as a task; no falsified item is claimed done.

### 1.4 Verification-command validation — every command references a real entrypoint

All 42 rows checked against disk; agreement with E's independent pass, plus my additions:
- **Real and reachable (existing targets):** every `node … --test …` command names a file that exists — `headless.test.ts`,
  `verify.server.test.ts`, `compile-check.server.test.ts`, `registry.test.ts`, `doctor.test.ts`, `token-ledger.test.ts`,
  `node-runner.server.test.ts`, `chat.test.ts`, `crew.test.ts`, `brief-fixtures.test.ts`, `io/packet/codegen.server/store/gates`
  tests, `honesty-guards.test.ts`, `README-cli.test.mjs` (all `ls`-verified today). `npm run eval -- --keyed` and
  `--trials=2` are real flags (`package.json:21`, `run-eval.mjs:82,:89-93`). Flip-greps verified today: `TRUNC`=0,
  feasibility=0, `MCP/A2A`=1, `redTree`=0, `diagnose:`=0.
- **Honestly MISSING (3):** T4.3, DF-09, G4 — self-declared, "what's missing" stated; confirmed as stated. The DF-09
  suggested extension (`honesty-guards.test.ts`) exists.
- **Known-broken, self-declared (1):** OV-2's smoke command — both blockers re-confirmed by E and WD-C; row schedules the
  guard fix first (correct re-scope).
- **Semi-concrete but flagged (2):** T4.2 / T-107.7 "probe to name at dispatch" — acceptable for modules that don't exist yet.
- **My one new precision catch — correction #3:** T5.3's post-landing command `… eval --limit 1` uses a space form;
  `run-eval.mjs` parses **only** `--limit=N` (`LIMIT_ARG = argv.find(a => a.startsWith("--limit="))`, `:85-86`), so the
  space form would be silently ignored even after the verb lands. Use `eval --limit=1` (or define the new verb's grammar deliberately).
- `--limit` also worth noting: the keyed leg is bounded to ONE entry by default (`run-eval.mjs:1266-1270`) — T0.10's cost is small.

### 1.5 Sequencing graph — no cycles, no missing dependency found

Checked the spine (`T0.10 → {OV-3,OV-4,OV-5} → OV-8 → claim flips → M-A acceptance`), the independent spines
(`OV-2a guard → OV-2b smoke`; `T5.4 → T5.7`; `OV-1 → (later) TA-14`; `T5.2-A + OV-9 → M-B latch`), and the near-cycle
`T5.7⇄T5.4` (one-way only: provenance → cassette labels). No cycle; no arrow without a nameable dependency.
Cross-link (not a defect): AUD-1's `223` pre-mortem predicts **M3/M4 are deadlocked by construction** (gate recorded
before the only mint, `headless.ts:1916-1958` vs `codegen.server.ts:3209-3248`) and **M9 via an 80-round `dod` drain spin**
(`run-eval.mjs:692-704`) — i.e. OV-3/OV-4/OV-5 will need AUD-1's C-1/C-2/C-3 fix shapes, not just log-reading. The rows
as written do not contradict this; the parent should fold `223` §4 into the W15 dispatch.

### 1.6 Missing findings (dossiers demand → no row, no cut line)

1. **No scheduler/daemon/queue** — 219e axis 6 ("OPEN-CLOSEABLE for scheduling"; 100 P1-02). `grep -i 'scheduler|daemon|cron'`
   in the canonical = **0**; not in §6(b)'s cuts either. Either row it (OV) or cut it explicitly.
2. **Outcome-attributed lesson ranking** — 219d "WHAT SELF-IMPROVING WOULD REQUIRE" item 5: `selectLessons` ranks on static
   `score`; `reproducedCount`/`counterEvidence` are recorded but never read. `grep reproducedCount` in the canonical = **0**.
   *Note:* `221` F3 (12:06, after the list) now designs exactly this ("uses the already-recorded `reproducedCount` nothing
   reads today") — recommend a cross-ref from the list rather than a duplicate row.
3. **Patch-format breadth** — 219f §6 handoff row (aider's 20 formats vs one typed primitive; "(a) engineering, low priority").
   `grep 'format breadth|edit formats'` in the canonical = 0. Low priority; a one-line cut entry would close it.
*(Checked and NOT missing: the registry-id drift flagged in `220` §0.3 — E adjudicated it to "message, test and code all
agree — NO drift; at most an optional default-id switch"; my reads agree (`registry.ts:24-28,:350`; `registry.test.ts:281`).
Optional-only; no row needed.)*

### 1.7 Corrections filed (attributable markers placed in `220_tasklist_canonical.md`)

1. **DF-09 row:** "note field `engine.ts:1631`" → `note?: string` is at **`engine.ts:1629`**; `:1631` is `force?: boolean;`
   (function `approveHitl` at `:1625`; write `note: opts?.note` at `:1663` re-confirmed). The `:1631` misanchor originated
   in WD-A's marker and propagated into the list — the rest of the DF-09 row is exact.
2. **§2 T-11 half 1:** "`lesson-writers.test.ts` (15 after repair)" → the suite is **18 tests, 18/18 pass** today (my run).
3. **T5.3 verify cell:** `--limit 1` → `--limit=1` (parser is equals-form only, `run-eval.mjs:85-86`).
4. **§6(b) coverage:** names the three findings in §1.6 and asks for rows or explicit cut lines.
5. **OV-6 why:** MCP-count precision — "7 clones ship live MCP clients" is defensible **as written**: 6 first-party client
   hubs (cline `McpHub.ts` · Roo `UseMcpToolTool.ts` · opencode `mcp/` 6 files · codex `codex-mcp`+`rmcp-client` · Dyad
   `mcp_oauth/` · bolt.diy `mcpService.ts`) **plus ChatDev's live fastmcp client consumer**
   (`runtime/node/agent/tool/tool_manager.py:15` `from fastmcp import Client`, Stdio/StreamableHTTP transports, imported
   by `runtime/node/executor/agent_executor.py` and `workflow/graph.py`) — so the parent's §4.5 P1 note ("6 clients + 1
   server example") **undercounts ChatDev**: its `mcp_example/mcp_server.py` is the example *server for that client*.

**Unsupported rows: 0.** No row rests on a contradicted claim; the three UNVERIFIABLE-NOW rows are honest and
correctly labelled. Nothing was deleted or rewritten — markers only.

### 1.8 The fallback table audit (219e W14–W16), for the record

Before the canonical landed I audited the W14/W15/W16 tables: all named files exist; all commands real; WD-C's plan-step
table reproduced at every point I re-derived (`registry.test.ts` present; browser-smoke flag+guard findings; `--trials=N`
real; CLI 35 vs README 34; `nextAction` truly absent). Two additions of my own: (a) **WD-C's W15-L2 sub-claim
"`dod.test.ts` present" is false** — no such file exists (dod is covered by `gates.test.ts`, `verify.server.test.ts`,
`honesty-guards.test.ts`, …; E independently found the same); the canonical avoided the false name, so only the
watchdog record carries it — flagged here, no marker needed. (b) The T5.3 `--limit` catch in §1.4. The canonical
supersedes these tables; my corrections target it (and only it) so there is one list of record.

---

## §2 · The ledger — where competitors are genuinely better, and what each gap actually costs

**Ranking rule (stated so it can be argued with):** cost = (i) does it block the maker test / the honest score? (ii) does it
block the agent-workflow the product sells? (iii) does a buyer check it in the first five minutes? — then discounted by
closeability. Structural losses are ranked low *and* marked, per `90` §7's instruction not to fight them.

### #1 · Provider breadth — 1 real vendor vs 12–22+ · **closes the widest gap, cheapest to start**

- **Competitor advantage (read today in clones):** `bolt.diy/app/lib/modules/llm/providers/` = **22** modules (counted);
  `cline/sdk/packages/llms/src/providers/vendors/` = **12** non-test adapters (counted); `aider` via litellm (`llm.py`);
  `opencode` via models.dev (`provider/provider.ts:13`).
- **What it buys in practice:** (1) a second family makes **cross-family judging** possible — the durable fix behind M3/M4
  (219e §3.5: "blocked until at least a second family exists"); (2) **no single point of failure** — the vendor's model
  being retired/deprecated (which just happened historically: the docs' own footnote says the legacy ids' "corresponding
  models have been retired", E §2.1) becomes a config change, not a dead product; (3) cost/quality routing and **BYOK**.
- **RapidTool's weakness (read today):** `registry.ts:94` `LlmProviderId = "deepseek" | "mock"`; `:143` `PROVIDERS` = deepseek
  only; `llm.ts:18` `LlmModel` = 2 DeepSeek ids; deferral is explicit (`registry.ts:35-38`). Multi-provider env selection,
  failover, doctor surfacing = deliberately deferred.
- **The cost, concretely:** the **entire overhaul's proof** (`T0.10 → OV-3/4/5 → OV-8 → claim flips`) runs through **one
  vendor's one key** — liveness unverified until used (`taskuniverselog` §5 T0.10; 219c rank 1). Any key/model hiccup at
  Step 0 stalls the whole program with no second path. And the quality ceiling is one vendor's roadmap. A buyer sees
  "BYOK: no" against a field where BYOK is baseline.
- **Closeable?** **Engineering + needs keys/budget.** The registry is already descriptor/tier-shaped (`LlmProviderDescriptor`,
  `ROLE_TIERS`); the reason it holds one vendor is the live-VERIFIED-id rule (`registry.ts:24-31`) — breadth costs real,
  small API calls per model before it may be declared. W14-L3/OV-1 is step 1; `221` F2 ("chosen as the single highest-leverage
  feature") is the designed step 2.
- **What it takes:** one line: land OV-1, then verify one non-DeepSeek family live per 221 F2 (owner's key; cents per model).

### #2 · Sandboxed / containerized execution — **closable only off this host; the ceiling it caps**

- **Competitor advantage:** `codex` = first-class OS-isolation crates (`codex-rs/linux-sandbox/`, `mxc-sandbox/`, `bwrap/`,
  `core/src/sandboxing/`, seatbelt + Windows processor — listed today); `SWE-agent` = per-instance container
  (`sweagent/environment/swe_env.py`, `repo.py` — today); **OpenHands** = "With a Docker Sandbox" mode per live docs
  (E §3.1, 2026-09-24, quoting the README's own warning that the no-sandbox mode gives "full access to your filesystem").
  Nuance: `cline` is **process-level** (`subprocess-sandbox.ts`) — so the bar-setters have it, not the whole field.
- **What it buys in practice:** running untrusted/just-generated code without risking the host — which is exactly what
  "run what you built automatically" and unattended operation require; plus honest E2E of a running app.
- **RapidTool's weakness (read today):** `node-runner.server.ts:12-20` header, verbatim: *"What it does NOT provide …
  filesystem confinement (the scratch cwd is a courtesy — the child can touch anything the OS user can), memory/CPU
  rlimits, or real network denial … **Do not run untrusted third-party code here.**"*; `:49-53` `sandbox: false` stamped on
  every envelope; `sandbox-policy.ts:21-30` frozen `HONEST_CLAIM` (`kind:"none"`), `:41-43` coercion; `headless.ts:3174`
  repeats the non-claim. No isolator on this host (217b §2 probes: docker/bwrap → 127, WSL 0 distros; `taskuniverselog:513`;
  T-107.8 owns the decision).
- **The cost, concretely:** caps the honest ceiling at "builds and tests" (no browser-E2E claim, 219e §5 item 2); blocks
  unattended runs on real repros; blocks ever hosting "run your app" like Dyad does (Dyad Playwright against a running
  preview — WD-C C4a). Buyer checkbox: "can it run my code safely" — answer today is "we don't claim to".
- **Closeable?** **Product decision + infra (needs Docker/WSL2/VM).** Not engineering: the code already says why
  (`:12-20`). On this 8 GB host it is a **structural loss** until the environment changes; the honest non-claim is the
  right position meanwhile. T-107.8 = confirm Outcome 2 (claim stays frozen).
- **What it takes:** one line: owner decides the isolation bar (Docker/VM) — nothing in the code is wrong; the host is.

### #3 · MCP runtime client — 6 client hubs + 1 client consumer vs contract-artifact-only

- **Competitor advantage:** cline `McpHub.ts` (7 `McpHub.*.test.ts` in `__tests__/` — counted today) · Roo `UseMcpToolTool.ts` ·
  opencode `src/mcp/` (6 modules today) · codex `codex-mcp/` + `rmcp-client/` (today) · Dyad `mcp_oauth/` + handlers ·
  bolt.diy `mcpService.ts`; ChatDev consumes servers via `fastmcp.Client` (today). Live corroboration: OpenHands `openhands mcp`
  CLI + Cline `cline mcp` + Codex MCP docs (E §3.1-3.3, 2026-09-24).
- **What it buys in practice:** an agent can use the ecosystem's tools instead of the harness author's imagination, and the
  harness becomes callable/drivable through the coalescing interop standard (ACP-adjacent); 90 §7's "table stakes" row.
- **RapidTool's weakness (read today):** contract artifact only — `types.ts:27` (`"mcp"` in ArtifactKind), `dod.ts:428-430`
  (`p3-mcp` probe), `phases.ts:33` (B-18 declaration: *"roadmap declarations, not runtime"*); no module (`ls src/lib | grep -i mcp`
  → empty; `grep jsonrpc` → 0); `engine.ts:922` still prints the unqualified P7 claim (DF-04 residual).
- **The cost, concretely:** agent-workflow isolation — RapidTool's governed surface (35 verbs) is invisible to every MCP
  client, and the P3 promise is prose; buyer/interop cost. Not a maker-test blocker (maker test doesn't need MCP).
- **Closeable?** **Engineering (M; first step S) + owner trust-boundary decision** for execution beyond discovery. `221` F1
  is the lane-ready design: discovery-first JSON-RPC over stdio, reusing the runner's scrub/redact/clamp/kill helpers, with
  `sandbox:false` stamped and "discovery ≠ capability" honesty rules.
- **What it takes:** one line: land 221 F1 step 1 (`mcp --discover` verb + `mcp.client.server.ts`), execution gated on the owner.

### #4 · Per-action allow-lists / permission UX — phase-gates only, but the seam is already action-shaped

- **Competitor advantage:** opencode `permission/index.ts:28` `evaluate(permission, pattern, ...rulesets)` — wildcard rules
  with ask/allow/deny and an `approved` ruleset state (read today); Roo `core/auto-approval/` per-category sets (today);
  codex approval×sandbox modes + cline `tool-approval.ts` / loop-detection (219f §2.7, WD-C-audited).
- **What it buys in practice:** **safe unattended operation** — "allow read-only commands, ask for writes, deny network"
  is what makes an agent loop bounded without a human babysitting each step. It is the operational half of autonomy.
- **RapidTool's weakness (read today):** gates are **phase-level** — `phases.ts:150-151` (`HITL_PHASES`; `STOCK_HITL=[4,5,8,9]`);
  hard rules `engine.ts:814/:898` ("a FAILING sandbox can never be autopilot-approved"); my grep found **no per-action
  allow-list** in `src/lib` (only env/redirect allowlists). *But* the policy seam is already action/resource-shaped:
  `policy.ts:170` `evaluatePolicy(action, resource, ctx)`, action rule table `:98` (`repair.apply` → `tree:…`), seat logic
  `:223-225`. So the missing part is the **allow-list vocabulary/UX/config + wiring into unattended flows**, not a new system.
- **The cost, concretely:** every unattended step is all-or-nothing (approve the whole phase or nothing); a buyer comparing
  governance products sees *less* granular control here than in OSS tools; 221 F4 designed exactly this.
- **Closeable?** **Engineering (M; first step S) — the cheapest high-value close in the ledger.** The dossiers categorise it
  "product decision"; with `evaluatePolicy` already action-shaped, I'd call it **engineering-first**, with an owner decision
  only if the intent is to *widen* what machines may do.
- **What it takes:** one line: add an allow/deny rules table per action class to the existing seam + surface it (221 F4).

### #5 · Repo indexing / context at scale — real gap, wrong fight *for now*

- **Competitor advantage:** Roo `src/services/code-index/` — Qdrant default `http://localhost:6333` (`config-manager.ts:25`,
  read today) + **8 embedders** (`bedrock, gemini, mistral, ollama, openai, openai-compatible, openrouter, vercel-ai-gateway` —
  counted today) consumed by `CodebaseSearchTool.ts` (imports `CodeIndexManager`, today); aider `repomap.py` tree-sitter map
  with a tags cache; Dyad `code_explorer.ts`.
- **What it buys in practice:** on a 3 000-file existing repo, "which files matter" is answered by an index instead of token
  ranking — the difference between useful and useless on large codebases.
- **RapidTool's weakness (read today):** lexical only, by design — `knowledge.ts:19` *"scoring on plain tokens, NOT a vector
  database and NOT embeddings"*; `ast-mine.ts:383` `mineCodebase`; `algorithms.ts:512` `fusionRank`; no tree-sitter anywhere.
- **The cost, concretely:** near-zero for the current maker test (emitted trees are small); material only when RapidTool aims
  at **editing existing large repos** (T4.3's direction) or analysing a user's real codebase. Closing it with embeddings would
  **contradict the determinism axis** (90 Axis 2) the product sells.
- **Closeable?** **Mixed:** a deterministic **AST/tree-sitter pass** = engineering-compatible (if ever needed); an embedding
  index = product decision **against** the stance → do not do it. 221 F5 = "NOT-RECOMMENDED" (same verdict, independent).
- **What it takes:** one line: nothing today; revisit only if edit-existing-projects becomes core — then an AST pass, never embeddings.

### #6 · IDE-native surface + streaming — split: streaming closes, IDE is a structural loss

- **Competitor advantage:** cline/Roo ship VS Code extensions (Roo ships **17** UI locales — counted today); Dyad/bolt.diy
  ship desktop apps; **streaming is everywhere** — codex's SSE live in `core/src/client.rs` (today), cline's
  `agent-runtime.ts` streaming (today), Dyad's `chat_stream_handlers.ts` (219f).
- **What it buys in practice:** distribution (where developers live) + **mid-run steering** (watch, interrupt, correct)
  instead of one-shot waits.
- **RapidTool's weakness (read today):** web console + CLI only (`console.tsx:132` ten-tab union; 3 routes — `ls`);
  `deepseek.ts:377` `stream: false`; no SSE/ReadableStream in `src/` (grep → only the `sandbox.ts:316` denylist string);
  chat captioned one-shot (`console.tsx:5618-5620` read today: *"one-shot reply … (no stream/stop yet)"*).
- **The cost, concretely:** adoption (buyer: "does it live in my editor?" — no) and steering ergonomics (agent workflow:
  you can't watch tokens or stop a reply). Neither blocks the maker test.
- **Closeable?** **Split.** Streaming = **engineering (T5.1, M; transport spike first)** — close-worthy and already rowed.
  IDE-native extension = **structural loss** per `90` §7 (community gravity/distribution) — do not chase, per the plan's
  own exclusion list.
- **What it takes:** one line: land T5.1; politely decline the VS Code extension (90 §7).

### #7 · Test/CI discipline — RapidTool LEADS density; the gaps are kinds (and pipelines), not quantity

- **Competitor advantage:** test **kinds** and rails — Roo e2e app (`apps/vscode-e2e`), Dyad **e2e-tests/** (132 `*.spec.ts`
  by my count / 542 files), OpenHands frontend **Playwright + Stryker mutation configs** (both listed today); **CI**: every
  sized clone ships workflows (cline 17 · codex 30 · opencode 26 · Dyad 20 · bolt.diy 12 · aider 10 · Roo 7 — counted today).
- **What it buys in practice:** trust artifacts (badges/PR checks), regression catch beyond one machine, and browser-level
  proof the unit suites can't give. Counts re-derivable: cline 739 test files, Dyad 693, opencode 661, Roo 460 (219f/WD-C;
  I re-derived aider **41**, Roo **460** — exact).
- **RapidTool's position (read today):** **density leads** — 68 lib + 14 script test files / 137+32 source ≈ **0.49**
  (test-file counts counted by me today; source counts per 219f §2.14 / WD-C; suite sizes 261 scripts / 1957 lib per 218 §5)
  vs 0.13–0.29 for the large clones (pr-agent's 0.69 the outlier).
  **But:** no `.github/workflows` at all (and no other CI config; `.git/hooks` empty) despite a real
  `git@github.com:RodneyDanger1/RapidTool.git` remote; no e2e/mutation rails (the only browser driver is `browser-smoke.mjs`,
  never run — 218 §4 → OV-2).
- **The cost, concretely:** the identity ("verification-first") is enforced by **one person remembering to run `gate.sh`**;
  nothing external can see it; a regression between waves has no automated catcher; a buyer/dev cannot check a pipeline.
  Zero maker-test impact; pure trust/tooling cost — and it was reported by **no earlier agent**.
- **Closeable?** **Engineering, cheap:** one workflow that runs `scripts/gate.sh` (+ the node version pin); e2e rails =
  OV-2 as scheduled; **mutation testing = not worth closing** (no proportionate signal at this size).
- **What it takes:** one line: a 15-line `.github/workflows/gate.yml` calling the existing four-gate script.

> [IMPROVER · 2026-09-24] CI EVIDENCE ADD (clone read today): the field's habit is per-OS legs — `aider/.github/workflows/ubuntu-tests.yml:25 runs-on: ubuntu-latest` and `windows-tests.yml:25 runs-on: windows-latest` are two separate workflow files in one repo. For this repo's one-workflow close the runner is a deliberate choice: the repo's known-broken commands are Windows-path-class (browser-guard `/workspace`, OV-2), which an ubuntu leg cannot catch. — evidence: `grep -n runs-on aider/.github/workflows/{ubuntu,windows}-tests.yml`. (by PLAN-IMPROVER)

### Ranked summary + what NOT to close

| # | gap | cost type | closeable? | verdict |
|---|---|---|---|---|
| 1 | provider breadth | quality ceiling + SPOF + BYOK truth | engineering + keys/budget | **CLOSE (top)** — OV-1 then 221 F2 |
| 2 | sandboxed execution | claims ceiling + unattended trust | needs infra + product decision | **decide (T-107.8)**; structural on this host |
| 3 | MCP client | interop + table stakes | engineering M (step 1 S) + trust decision | **CLOSE** — 221 F1 |
| 4 | permission granularity | unattended-operation granularity | engineering M (seam exists) | **CLOSE (cheapest high value)** |
| 5 | index at scale | matters only for large existing repos | AST=eng / embeddings=anti-stance | **DEFER** — do not close now |
| 6 | streaming / IDE | adoption + steering | streaming=eng; IDE=structural | **CLOSE T5.1; decline the extension** |
| 7 | CI / test kinds | trust artifact + regression net | engineering, cheap; mutation=skip | **CLOSE CI now; skip mutation** |

**Not worth closing (with reasons):** embeddings index (contradicts the determinism axis; AST pass instead if ever) ·
IDE extension (structural distribution loss, `90` §7) · mutation testing (cost ≫ signal) · aider-style patch-format
breadth (one typed refusing primitive IS the design; breadth is compatibility politeness, 219f calls it low priority) ·
cloud fleets / visual polish (structural, `90` §7).

### Cross-check — are the plan's "behind" verdicts softer or harder than the clones show?

| plan claim | clone reality (today) | adjustment |
|---|---|---|
| "behind: provider breadth, 12–22+" | bolt 22, cline 12 — exact | **CONFIRMED, widest gap** |
| "behind: MCP (7 clones ship one)" | 6 hubs + ChatDev client consumer (today) | **CONFIRMED** (keep 7 with the count note) |
| "behind: sandbox (OpenHands runtime)" | codex/SWE-agent in-clone; OpenHands Docker per live docs; **cline is process-level too** | **CONFIRMED for the bar-setters; softer vs field-average** |
| "behind: index at scale" | Roo 8 embedders + Qdrant; aider repomap | **CONFIRMED but contextual** — only large existing repos |
| "behind: permission granularity" | opencode/Roo/codex per-action | **SOFTER than the dossier** — action-shaped seam exists (`policy.ts:170`); it's wire+UX, not architecture |
| "behind: IDE/streaming" | VS Code/desktop everywhere; streaming universal | **CONFIRMED**; split by closeability |
| "leads: treeRun / budgets / honesty / test density" | density 0.49 vs 0.13–0.29 (re-derived) | **CONFIRMED density; add: 0 CI workflows, no e2e/mutation rails** |

---

## §3 · Honest limits

- I did not re-run the full gate, typecheck, lint or build (forbidden; memory-tight host); gate numbers are `218` §5's.
  My test runs: 3 of ≤3 (results in §1.3), each `--test-concurrency=2`; nothing keyed, no clone code executed.
- The canonical list landed mid-run; my audit covers the 12:05 revision (299 lines). If it is revised again, re-check the
  five marker points first — they are the only places I found it wrong or incomplete.
- Rows whose `why` rests on 219a probe evidence (OV-15's redTree probe, OV-16's census, OV-17's Quickstart probe) were
  **not re-executed by me**; their anchors verify and E audited their commands — the probe semantics remain 219a's.
- Competitor counts are clone-state facts dated 2026-09-24 (revisions per 219f §0); live pages are E's (URL+quote+date).
  Dyad's e2e count differs by counting convention (219f "~190+" vs my 132 `*.spec.ts` / 542 files) — cite mine with the method.
- AUD-1's `223` pre-mortem (WB-1/WB-2 deadlocks, predicted 5/9) post-dates parts of this audit and is referenced, not
  re-derived; where it and a row disagree, neither was found to — it *strengthens* OV-4/OV-5 and should ride into W15.
