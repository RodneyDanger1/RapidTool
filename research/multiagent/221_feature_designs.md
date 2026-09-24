# 221 · FEATURE DESIGNS — competitor evidence → RapidTool-native, lane-ready specs

**Persona 1 (Feature Architect) · W13 · written 2026-09-24 · READ-ONLY: this is the only file written.**
**Plan followed:** `wave_plans/W13/des-1.md` (read in full, first). Evidence base: `219f`, `219e` (WD-C-corrected),
`220`, `219c`, `219d` (WD-B-corrected), `219b` (WD-A-corrected), `fixes/217c` §3, `AGENTS.md` + `RESUME.md` §5.4, `90_LEAPFROG.md`.

**Provenance rule for this file (owner's standard, "no hallucinations/fake code/… 100% truth"):** every RapidTool
`file:line` below was read **today (2026-09-24)** in this session; every competitor mechanism cites a clone path +
symbol from `219f` and the path was re-listed on disk today; symbols re-read today are marked *(read today)*, the
few 219f-carried ones are marked as carried. Anything I could not verify today is marked **UNVERIFIED** and never
dressed up. I ran **zero** test runs (0 of the ≤2 allowed — reading sufficed; see §7).

## Bottom line (name · status · size · gated-by · what it buys the goal)

| # | Feature | Status | Size | Gated by | What it buys the goal |
|---|---|---|---|---|---|
| F1 | MCP runtime client — discovery-first | DESIGNED | M (first step S) | nothing for discovery; **owner decision** (trust boundary) + F4 for execution | Closes the widest "best harness" gap (6 clones ship a client; 7th ships a server example — §F1) without touching the trust boundary dishonestly |
| F2 | Provider breadth step 2 — live-verified second family | DESIGNED | M (step 1 already = W14-L3) | **owner's key** for the second family; sequenced after W14-L3 (same file) | Unblocks cross-family judging — the durable fix behind M3/M4 (219e §3.5); BYOK; ends provider monoculture |
| F3 | Cross-run learning measurement | DESIGNED | S (+S/M for the taught-set record) | Step 0 keyed run for a real number; T-11 stays muted (owner, unchanged) | Turns "self-improving" from a verb into a falsifiable number (219d's hop 6) |
| F4 | Per-action allow-lists / autonomy boundary | DESIGNED | M (first step S) | nothing for the narrowing rules; **owner decision** for any widening | Autonomy granularity the field has (opencode/Roo/codex) without weakening the one policy seam |
| F5 | Codebase-scale index | **NOT-RECOMMENDED** | — (this memo) | revisit triggers listed (§F5) | Prevents a wave being spent on a non-maker-test mechanism; keeps the determinism axis intact |

**If only ONE of these ships before the maker test: F2.** The maker test's zeros (M3 machine-verified verdict,
M4 evidence-hashed promotion, `219e` §3.3) are produced by model work currently judged by the *same family* that
produced it — `219e` §3.5 states cross-family judging is "blocked until at least a second family exists". F2 is the
only candidate here that changes the quality of what the scorer scores, and its honesty rules are the repo's own
(verify-or-refuse, `registry.ts:24-31`), so it cannot inflate the number it is meant to improve. F1 is the widest
*claim* gap but does not move the maker test; F3 needs a green keyed run to have any number worth reading; F4/F5 are
boundary hygiene and a stop-sign respectively.

---

## §0 · What I read and ran today (so nobody has to trust this file on vibes)

- **Repo reads (2026-09-24, this session):** `policy.ts` (full, 245 lines) · `types.ts:19-50, 388-395` ·
  `phases.ts:28-50, 145-158` · `dod.ts:120-150, 420-440` · `engine.ts:60-110, 311-346, 541-690, 1100-1120,
  1425-1505, 3499-3560` · `knowledge.ts:16-24, 745-760, 790-812, 937-1055` · `codegen.server.ts:2100-2160,
  2460-2490, 2545-2560, 2840-2856` · `report-intake.ts:20-40, 425-480` · `maker-score.ts:555-640` ·
  `registry.ts:1-60, 60-175, 175-270, 270-432` · `deepseek.ts:14-30, 39-58, 300-320` · `llm.ts:14-24, 66-78` ·
  `doctor.ts:155-215` · `node-runner.server.ts:1-100, 160-200, 267-330` · `errors.ts:28-40, registry lines` ·
  `headless.ts:336-375` · `store.ts:1118-1130` · `rapidtool-cli.mjs:1225-1265, 1860-1900` · `sandbox-policy.ts:33` ·
  `package.json:1-30` · `scripts/gate.sh:1-20` · `run-eval.mjs:359-400`.
- **Commands (read-only):** `grep -rniE 'embedding|qdrant|vectorstore|faiss|hnsw' src/lib` → prose hits only
  (`knowledge.ts:19` is the honest label); `grep -rniE 'tree-sitter|tree_sitter' src/lib scripts` → **0 hits**;
  `ls src/lib | grep -i mcp` → **nothing**; `grep -rIn "jsonrpc\|Model Context Protocol" src scripts` → **0 hits**;
 `grep -rn "alwaysAsk\|denyCommands\|autoApprovePhases" src scripts` → **0 hits**; `grep -rn "mcpServers" src scripts`
  → **0 hits**; `grep -c 'case "' scripts/rapidtool-cli.mjs` → **35**; `ls research/eval-out/` → `history.json`
  (10 499 B) + trial dirs; clone listings/greps under `/c/Users/mnril/rt-competitors/` (nothing executed).
- **Did NOT run:** any test (0/2 budget used), any keyed path, any clone code. 222 was **not on disk** at write time
  (§7) — no cross-check was possible.

---

## F1 · MCP runtime client (discovery-first)  (status: DESIGNED)

**Why it exists.** `219f` §2.11 row + §4 B2: MCP is the field's table stakes — RapidTool ships a *contract
artifact* (`types.ts:27` `"mcp"` in the ArtifactKind union — read today), a DoD probe (`dod.ts:428-430` `p3-mcp` →
`hasArtifact(p, 3, "mcp")` — read today) and an honest declaration (`phases.ts:33`: *"MCP/A2A server contracts are
roadmap declarations, not runtime (B-18)"* — read today) — and no runtime. `219e` row 10: **"OPEN-CLOSEABLE (MCP is
the largest one)"**. `219b` DF-04 residual to strike in the same lane: `engine.ts:922` still reads *"Architectural
advantage: deterministic 0–12 graph with HITL, MCP/A2A, and ADRs…"* with no MCP module in `src/lib` (read today).

**The field's version** *(all paths re-listed on disk today; symbols re-read where marked)*:
- **cline** @025baa8 — `apps/vscode/src/services/mcp/McpHub.ts`: `initializeMcpServers()` :370, a `tools/list`
  request :884, `callTool()` :1673, plus `McpOAuthManager.ts` / `StreamableHttpReconnectHandler.ts`; tests live in
  `__tests__/` (7 `McpHub.*.test.ts` + `schemas.test.ts` — listed today).
- **Roo-Code** @b867ec9 — `src/core/tools/UseMcpToolTool.ts`: `class UseMcpToolTool extends BaseTool<"use_mcp_tool">`
  :26, params `server_name`/`tool_name` :12-13; `accessMcpResourceTool.ts`; `src/services/mcp/`.
- **codex** @c56dda7 — `codex-rs/codex-mcp/` + `codex-rs/rmcp-client/` (includes `bounded_stdio_transport.rs`,
  `auth_status.rs` — listed today).
- **Dyad** @43bdd75 — `src/mcp_oauth/{registry,state,transition}.ts` + `src/ipc/handlers/mcp_error_classifiers.ts`
  (`classifyOAuthError` :8, `looksLikeUnauthorized` :63 — read today).
- **opencode** @88c6c7a — `packages/opencode/src/mcp/{auth,browser,catalog,index,oauth-callback,oauth-provider}.ts`
  (listed today).
- **bolt.diy** @2e254ac — `app/lib/services/mcpService.ts` (listed today).
- **ChatDev** @4fb2db0 — `mcp_example/mcp_server.py` (listed today): a **server** example, not a client. So the
  precise count is **6 client implementations + 1 server example**, not "7 clients" — 219f's row rounds; this file
  does not.
- **aider** — nothing matching MCP in its Python (219f §2.11; not re-verified today).

> [IMPROVER · 2026-09-24] FIELD'S-VERSION ADD (read today): codex bounds its local-MCP stdio transport — `codex/codex-rs/rmcp-client/src/bounded_stdio_transport.rs:26 MAX_MCP_STDIO_LINE_BYTES = 8 * 1024 * 1024`, `pending_line` accumulation for fragments (`:31`), and close-the-transport on an oversized line (`:56-63`: warn + `pending_line.clear()` + return None). Mirrors into this design: pick a byte cap, make oversize a coded refusal (never unbounded buffering), and test fragmented + oversized frames. — evidence: clone file read (nothing executed). (by PLAN-IMPROVER)

**RapidTool-native design (≤8 lines).**
1. New server-only module `src/lib/mcp.client.server.ts`: line-delimited **JSON-RPC 2.0 over stdio**;
   `mcpHandshake(child)` = `initialize` (protocolVersion + clientInfo) → `tools/list`. Discovery only.
2. The transport is a **new sibling spawner**, not `runNodeBounded`: that function hard-codes
   `stdio: ["ignore", "pipe", "pipe"]` (`node-runner.server.ts:310` — read today), i.e. **no stdin**, so it cannot
   host a session. The new spawner reuses `scrubbedEnv()` :196, `redactSecrets` :224, `clampRunnerOutput` :91,
   `CLOSE_GRACE_MS`/`KILL_GRACE_MS` :143-144, `removeScratchDir` :258, `treeKill` :157, and stamps `sandbox:false`
   on its own envelope type (mirror of `NodeRunResult` :49 / `withSandbox` :52).
3. Discovery output = one CLI JSON object (server name, protocol version, `tools[]`, probe timestamp, FNV-1a hash of
   the raw frames — integrity, not crypto) + a `mcp.discover` log event. **No project mutation in step 1** (no
   `Project` schema change — `mcpServers` does not exist today, `grep` → 0 hits).
4. Execution (`tools/call`) is **out of step 1**; when it lands it must (a) consult a new policy action `mcp.tool`
   through the existing pure seam `evaluatePolicy` (`policy.ts:170`), (b) honor F4's per-tool allow-list, (c) carry
   `sandbox:false` + the honest note that the tool runs **outside** the bounded runner and is **not isolated**.
5. No HTTP/SSE transport in the first two steps (streamable-HTTP + OAuth is what cline/Dyad/codex ship; it widens
   the trust surface and is not needed for the maker test).
6. Refusals: `RT_E_VALIDATION` (no/bad config — registered `errors.ts:36`), new codes `RT_E_MCP_SERVER_FAILED`
   (spawn/handshake/early-exit) and `RT_E_MCP_PROTOCOL` (unparseable frames) added to the `ErrorCode` union
   (`errors.ts:28-40` — read today) + `ERROR_CODE_DOC` (`errors.ts:310`).
7. CLI: one new verb arm, `mcp`, with **exactly one action flag** per call (`--discover` today) — the `lesson`
   family pattern (`rapidtool-cli.mjs:1869-1893` — read today: `actions.length !== 1` refusal at :1893 with
   `RT_E_VALIDATION`). Doc contract updated in the same commit (`scripts/README-cli.md` ↔ `scripts/README-cli.test.mjs`).
8. The P3 summary (`phases.ts:33`) may change **only** to what a fresh run can demonstrate (declare-or-strike), and
   `engine.ts:922`'s MCP/A2A claim must be qualified or struck in the same lane. `p3-mcp` (`dod.ts:428-430`) is
   **unchanged** — do not make a keyless deterministic gate depend on a live server.

**Seams (insertion points, read today).**
- New file: `src/lib/mcp.client.server.ts` (server-only; must be reached by dynamic import from CLI/headless — the
  `compile-check` seam precedent is documented in `RESUME.md` §5.3, i.e. `"./compile-check." + "server.ts"`).
- `scripts/rapidtool-cli.mjs` — new `case "mcp":` beside `case "lesson":` :1869; one-flag guard pattern.
- `src/lib/errors.ts` — `ErrorCode` union :28-40, `ERROR_CODE_DOC` :310.
- `src/lib/phases.ts:33` (claim text) · `src/lib/engine.ts:922` (P7 prose residual) · `src/lib/dod.ts:428-430`
  (existing probe — keep).
- `src/lib/node-runner.server.ts` :91 / :143-144 / :157 / :196 / :224 / :258 / :310 (helpers + the stdio fact).

**Reuse, don't rebuild.** `scrubbedEnv`/`redactSecrets`/`clampRunnerOutput`/kill semantics
(`node-runner.server.ts` as above) · `Artifact` shape `types.ts:41-47` if/when an artifact is minted · the
`p3-mcp` probe as the model for any future probe · CLI per-verb test precedent
(`scripts/rapidtool-cli-edit.test.mjs`, `scripts/rapidtool-cli-lesson.test.mjs` — both exist on disk today) and the
doc contract (`scripts/README-cli.test.mjs`).

**Honesty constraints it MUST satisfy.** (a) **No sandbox/isolation claim** — a stdio MCP server is a host
process; every envelope carries `sandbox:false` and the code must not say "safe"/"contained" (`sandbox-policy.ts:33`
`runnerIsolationClaim` is frozen; the node-runner header doctrine applies). (b) **Discovery ≠ capability** — the
only legal claim is "server contacted; N tools listed; execution not implemented"; never "RapidTool supports MCP
tools". (c) `ok:true` never carries `error`; a failed handshake is a coded refusal with **no partial tools list**.
(d) Never mint `decidedBy:"human"` — discovery makes no decision, so it writes a log event, not a decision row;
if it ever writes one, it uses `{decidedBy:"autopilot", seat:"harness"}` (`policy.ts:44-46`). (e) Declare-or-strike:
the P3/P7 prose changes in the same commit as the evidence. (f) Keyless path must stay byte-identical (MCP needs no
LLM key — do not touch any keyed seam).

**Minimal first step (one lane, size S).** `mcp.client.server.ts` (handshake + `tools/list` + refusal codes) +
`mcp --discover --config <file.json>` + fixture tests. **No execution, no HTTP, no policy change, no Project
schema change.**

**Tests to extend/create + exact verify command.**
- new `src/lib/mcp.client.server.test.ts` — frame parser (fragmented/oversized/garbage), handshake timeout,
  unknown `protocolVersion` refusal, early-exit refusal, `sandbox:false` on every envelope.
- new `scripts/rapidtool-cli-mcp.test.mjs` — exactly-one-action guard, coded refusals, temp-dir cwd isolation
  (AGENTS.md: "script tests … use temp-dir `cwd` isolation — never run them from the repo root").
- extend `scripts/README-cli.test.mjs` (doc contract).
- `node --experimental-strip-types --test --test-concurrency=2 src/lib/mcp.client.server.test.ts`
  then `node --test --test-concurrency=2 scripts/rapidtool-cli-mcp.test.mjs scripts/README-cli.test.mjs`.

**Risks / what it must NOT claim.** Protocol-version drift (the MCP spec moves; refuse unknown versions loudly —
never "assume v1"). Long-lived child lifecycle on Windows (kill on every exit path; a leaked server process must be
a test failure). Over-claiming "MCP support" in README/doctor — strike the word "support"; write "discovery".
Trust-boundary: when execution lands, an MCP server is untrusted code and the honest ceiling stays
"runs un-isolated" until an isolator exists (`219e` §5 items 1-2).

**Gated by.** Nothing for discovery (keyless-capable). Execution half: **owner decision on the trust boundary**
(record it like `217c` §3 decisions) + F4's allow-list.

---

## F2 · Provider breadth step 2 — the live-verified second family  (status: DESIGNED)

**Why it exists.** `219f` §4 B1 (1 vendor vs 12-22+ adapters) + `219e` §3.5: P6 and the auto-review classifier are
the same tier, so the durable P0-03 fix — cross-family judging — is blocked until a second family exists. The
stated bottleneck is the repo's own **live-verified-model rule** (registry header `registry.ts:20-31` — read today:
explicit ids must be EXACTLY `KNOWN_MODEL_IDS`; unverified ids are refused with `RT_E_VALIDATION` **before** any
network I/O). Step 1 (multi-provider *env selection* + doctor surfacing) is already planned as **W14-L3**
(`219e` W14 table; spec `101_provider_integration.md` §4). This is step 2: **add a second, verified family without
fabricating a single model claim.**

**The field's version** *(paths listed today; symbols re-read where marked)*:
- **bolt.diy** @2e254ac — 22 provider modules (`ls app/lib/modules/llm/providers/ | wc -l` → 22 today).
- **cline** @025baa8 — `sdk/packages/llms/src/providers/vendors/` (12 adapters + colocated tests; listed today).
- **opencode** @88c6c7a — `packages/opencode/src/provider/provider.ts:13` `import { ModelsDev } from
  "@opencode-ai/core/models-dev"` (read today): a **catalog-driven** registry.
- **aider** @5dc9490 — litellm catalog (219f; not re-verified today).

**RapidTool-native design (≤8 lines).**
1. **Descriptor widening, additive:** `LlmProviderDescriptor` (`registry.ts:117-142`) gains an optional
   `verification: { kind: "live-probe"; modelsEndpoint: string } | { kind: "static"; note: string }`. Absent ⇒
   behaviour byte-identical; DeepSeek declares `static` with its existing header evidence (served ids
   `deepseek-flash`/`deepseek-v4-pro`, `deepseek.ts:14-30` — read today).
2. **A probe, not a promise:** `probeProviderModels(descriptor, { fetch, env, timeoutMs })` (server-side, in or
   beside the provider module) implementing `101` §4.6's rules: 3 s cap, **never throws**, `configured` vs
   `reachable`/`authenticated` reported **separately**, failures never cached, success read back from the vendor's
   own response.
3. **Registration rule (the honesty core):** a provider may register with an **empty `requestModelIds`** (status
   "candidate"). Resolving a role tier for a candidate provider **refuses** with a new
   `RT_E_PROVIDER_MODEL_UNVERIFIED` unless the caller passes ids obtained from a probe — no vendor's model list is
   ever hardcoded before it was observed.
4. **Surface:** `provider --probe --id <id>` (new arm) prints one JSON object
   `{id, configured, reachable, authenticated, models[], probedAt, evidenceHash}`; keyless ⇒ `configured:false` +
   `RT_E_LLM_NOT_CONFIGURED` with **zero network I/O** (mirror of `completeDeepSeek`'s floor, `deepseek.ts:303-310`
   — read today: the key check precedes any fetch).
5. **Second adapter** = ONE OpenAI-compatible implementation conforming to the existing descriptor contract
   (`LlmProviderDescriptor` :117-142), covering OpenAI-/xAI-/Ollama-style
   endpoints. Its `requestModelIds` starts empty (rule 3) until a probe has run on a machine with that key.
6. **Do not widen the global namespace:** `KNOWN_MODEL_IDS` stays DeepSeek-scoped (`registry.ts:359-361`);
   provider-scoped validation already exists (`resolveExplicitProvider` :184-231).
7. **Failover/routing across families is NOT in this step** (`101` §4.5); cross-family judging remains an
   owner-gated follow-on — do not claim it.
8. `doctor`'s llm block gains `providers[]` from probes (step 1's W14-L3 surface); the label prints ids **read back
   from the probe**, never the static list (`101` §4.6 rule).

**Seams (read today).** `registry.ts` — `RapidToolModelRole` :69, `RAPIDTOOL_MODEL_ROLES` :72, `LlmProviderId` :94,
`isKnownModelId` :110, `LlmProviderDescriptor` :117-142, `PROVIDERS` :143-155, `getProvider` :158,
`resolveExplicitProvider` :184, `RoleTier` :233, `ROLE_TIERS` :240, `roleModelEnvKey` :262, `resolveRoleModel` :293
(the env pin read is at **:330-334** — see §7 for the des-1 line-cite discrepancy), `KNOWN_MODEL_IDS` :359,
`CallModelOptions` :366, `callModel` :396. Also `deepseek.ts` :39-58 (`DEEPSEEK_MODELS`/`DEEPSEEK_MODEL_IDS`) and
:112/:116 (`isDeepSeekConfigured`/`deepSeekModelIds`), `llm.ts:17` (`LlmModel` union — unchanged by design),
`errors.ts:28-40/:310` (new code), `doctor.ts` (surfacing), `scripts/README-cli.md` (doc contract).

**Reuse, don't rebuild.** The descriptor array itself is the multi-provider extension point
(`registry.ts:141-143`: "the array shape is the multi-provider extension point (101 §4.5)") · per-provider
namespaces (`resolveExplicitProvider`) · the keyless floor pattern · `101` §4.6's probe table (already specifies the
per-provider endpoints — **read today** at `101:773-800`) · test precedent `deepseek.server.test.ts` (byte-compat
snapshots) and `registry.test.ts`.

**Honesty constraints it MUST satisfy.** (a) **Never hardcode a model id for an unprobed vendor**; never advertise
a candidate provider's models in doctor/UI before a probe read them back. (b) Keyless floor: exact legacy envelope,
**refusal ≠ substitution** (`registry.ts:29-31`). (c) A probe `200` with an empty list is
`reachable:true, authenticated:true, models:[]` — it must NOT be shown as usable. (d) No cross-family-judging claim
until two families have live-verified evidence on this host (the claim string says "registered, unverified"). (e)
No new `node:fs` in client-safe modules; keys read server-side only. (f) Fix the known naming drift in the same
lane: `220 §0.3` read the error text vs `deepseek.ts` as inconsistent; **read today they agree** —
`KNOWN_MODEL_IDS` = `["deepseek-v4-flash","deepseek-v4-pro"]` (`registry.ts:359-361`, `deepseek.ts:39-42`) and
`registry.test.ts:281` asserts exactly those names; the apparent drift is the *served* vs *requested* id
(`deepseek-flash` served for alias `deepseek-v4-flash`, `deepseek.ts:44-47`). Resolve with one clarifying comment,
not a behavior change.

**Minimal first step (M).** Items 1-4 + tests: the probe mechanism proven against DeepSeek itself (we have a key
holder) with a fixture-fetch test matrix, and `provider --probe` refusing keylessly. The second adapter is a second
lane gated on the owner's key for that family.

**Tests to extend/create + exact verify command.**
- new `src/lib/llm/providers/probe.test.ts` — fixture fetch matrix: 200+list / 200+empty / 401 / timeout /
  network-error / never-throws / failed-probe-not-cached / success-cached.
- extend `src/lib/llm/providers/registry.test.ts` — candidate-provider refusal (`RT_E_PROVIDER_MODEL_UNVERIFIED`),
  default path byte-identical, unknown provider id ⇒ `RT_E_VALIDATION`.
- extend the doctor test surface (doctorStatus) with the `providers[]` snapshot for (no key / 401 / 200).
- `node --experimental-strip-types --test --test-concurrency=2 src/lib/llm/providers/probe.test.ts src/lib/llm/providers/registry.test.ts`
  (+ the doctor test file the lane touches).

**Risks / what it must NOT claim.** Probe cost/rate limits (free `/models` endpoints per `101` §4.6, but a wrong
endpoint burns failures); "reachable" is not "usable" (see constraint c); caching honesty (no stale "verified"
stamp — a stale verification is as dishonest as a fake one, `RESUME.md` §5.4); scope drift into `101` §4's full
8-wave plan — if the parent adopts `101` §4 wholesale, **this design collapses into its W2/W4 rows** and must be
retired rather than run in parallel.

**Gated by.** The second family's **key** (owner) for the adapter lane; sequenced **after W14-L3** (same file
`registry.ts` — disjoint-file ownership rule, `RESUME.md` §5.5).

---

## F3 · Cross-run learning measurement  (status: DESIGNED)

**Why it exists.** `219d` hop table: hop 6 — *"next run behaves differently"* — is **UNVERIFIED**, "the broken
hop"; its bottom line: *"nothing anywhere measures whether following a lesson made the next run better."* `219e`
row 7 and `217c` §5B agree (loop closure not verified). `90` Axis 5 item 4's own acceptance: *"`npm run eval`
prints the rejection-rate trend across runs."* What exists today is a *mechanism* without a *measurement*: rows
accrue a `reproducedCount` when the same failure signature recurs (`engine.ts:344-346` read today; ledger row
`lesson.reproduced` at `report-intake.ts:477-482` read today) and **nothing reads it** — `selectLessons` ranks on
static `score` then `id` (`knowledge.ts:1012-1033` read today), and M7 measures *score regression*, not lesson
effect (`maker-score.ts:566-582`: M1+M2+M3 vs prior; priors come from `history.json` — `run-eval.mjs:359-374` read
today, shape `{at, mode, slug, m1…m9, total, mean}`).

**The field's version.** **NOT IN THE CLONES as a lesson-effectiveness metric — design from scratch.** What the
clones have is *reuse*, not *measurement*: aider restores `.aider.chat.history.md` (`args.py:275`, `base_coder.py`
:520-522, 219f-carried) and caches repomap tags (`repomap.py:217/:224` — re-read today); MetaGPT has a typed memory
stack; Roo has task persistence; cline has session versioning (219f §2.8). 219f's own verdict: RapidTool's
distinctive mechanism is that memory's *authority is bounded* (advisory-only). Nothing in the clones scores whether
memory helped.

**RapidTool-native design (≤8 lines).**
1. **Step A (the number).** A pure function `lessonOutcomeReport(memory)` in `knowledge.ts` reads **only**
   lesson-tagged rows and returns `{censusWindow, total, reproduced, unreproduced, recurrenceRate, perClass[],
   evidence[]}` where each evidence entry is the row id + its `probe:<id>` tags + `reproducedCount` + the ledger
   row that accrued it. New read-only CLI arm `lesson --effect --project <file.json>` (the family's **8th** arm —
   it ships with 7 today: `list`/`propose`/`accept`/`supersede`/`refute`/`advise`/`verify`, `rapidtool-cli.mjs:1886`).
2. **Why this is falsifiable:** a lesson whose target probe **recurred after minting** is recorded evidence the
   advisory text did not prevent the failure mode; the number is `reproduced / total` per class. It *cannot* claim
   causation (label it verbatim: "recurrence after minting — not proof the lesson was followed").
3. **Step B (the taught set).** One additive log row `p6.lessons.readback` `{ids, limit}` written where the
   synthesis path already reads lessons: `codegen.server.ts:2553-2557` (single-module) and `:2846-2851` (chunked),
   both `selectLessons(project.memory ?? [], 6, EXPAND_LESSON_RANK_LIMIT)` (read today), plus the P0 reframe read
   (`engine.ts:649-660/671`) — which is shown to the **human**, so it is labelled "taught to the operator", not
   "taught to the model".
4. With B, `lesson --effect --taught` joins: injected-id runs ∩ later reproduction = `taught_then_recurred`.
5. **Nothing else changes:** `selectLessons` ranking stays static; the T-11 red-seal mute stays
   (`engine.ts:1452-1497` read today: a red seal mints **no** lesson and the `p*.seal.unmet` log is not
   lesson-tagged); no writer, no promotion, no demotion.
6. Optional third step, explicitly **owner-gated**: surface the number in `run-eval.mjs`'s *report* (never in the
   M1-M9 criteria — run-side graders are frozen, `219e` §5 item 8).
7. The 80-row memory cap (`engine.ts:1432-1433` `.slice(0, 80)` — read today) is part of the report's
   `censusWindow` disclosure so a rate is never read as all-time.
8. If the owner later flips OV-DEC-1 (red seal teaches — `220` §4.4), the report covers the new class
   automatically because it reads rows, not writers.

**Seams (read today).** `knowledge.ts` — honest label :19, `EXPAND_LESSON_RANK_LIMIT` :44, `rankBriefLessons` :90,
`lessonLinesForBrief` :128, `counterEvidence` field :216, `LessonSpec` :751-760, `FailureKind`/`FailureRecord`
:794-812, `failureSignature` :881, `probeTagsFromSignature` :911, `lessonRow` :937 (+ id mint :963, probe-tag spread
:952), `selectLessons` :1012, `shouldPromoteLesson` :1040. `engine.ts` :311-346 (`isLessonMemoryId`, dedupe/accrue;
`reproducedCount` accrual :344-346), :632-636 (`lesson.capture` row), :1432-1433, :1452-1497.
`report-intake.ts` :477-482. `rapidtool-cli.mjs` :1869 (family arm; add `--effect` to the action list at :1886 and the refusal string at
:1893). `maker-score.ts` :566 (`m7Learning`; the "no learning claim without data" string is at :570 — read,
unchanged). `run-eval.mjs` :359-374 (history).

**Reuse, don't rebuild.** The accrual machinery (`accrueReproducedCounts`, `dedupeMemoryIds`) and its ledger row
already produce all the evidence; the CLI family pattern (`lesson` verb, read today) and its test file
(`scripts/rapidtool-cli-lesson.test.mjs`) already exist; `scripts/rapidtool-cli-lesson.test.mjs` +
`src/lib/knowledge.test.ts` + `report-intake.test.ts:320-346` are the pin sites.

**Honesty constraints it MUST satisfy.** (a) **Recurrence ≠ causation** — the label rides inside the JSON object.
(b) **No learning claim below n=2 runs**: with one run the report must say "insufficient runs — baseline only"
(echoing `m7Learning`'s own "no learning claim without data", `maker-score.ts:568`). (c) Read-only: the arm must
never write memory/store/ledger (assert file bytes unchanged in the test). (d) Never mint `decidedBy:"human"`, never
mint `tested`; nothing here touches gates or criteria. (e) Do not present the number as an eval score — M1-M9 stay
the scorecard.

**Minimal first step (one lane, size S).** Step A only: `lessonOutcomeReport` + `lesson --effect` + tests.

**Tests + exact verify command.**
- extend `src/lib/knowledge.test.ts` — empty memory ⇒ zeros; one reproduced row ⇒ `1/1` with the evidence string;
  class grouping; census window; junk input tolerated.
- extend `scripts/rapidtool-cli-lesson.test.mjs` — arm selection (exactly one), coded refusal when `--project`
  is missing, project file byte-identical after the call.
- `node --experimental-strip-types --test --test-concurrency=2 src/lib/knowledge.test.ts`
  then `node --test --test-concurrency=2 scripts/rapidtool-cli-lesson.test.mjs`.

**Risks / what it must NOT claim.** The largest risk is a number that *sounds* like proof of learning (mitigate:
the label + n≥2 rule). Small-n noise (say so per row). FIFO eviction silently shrinks the census (disclose the
window). Wiring the number into gates/scores/M7 would be a grader change and an owner decision — forbidden here.

**Gated by.** Step 0 for a real keyed number (keyless still produces a labelled number). Not gated by OV-DEC-1.

---

## F4 · Per-action allow-lists / autonomy boundary  (status: DESIGNED)

**Why it exists.** `219f` §2.7 + B4: competitors allow-list at *action* level; RapidTool gates at *phase* level and
has **no per-action allow-list found in src/lib** (`grep -rn "alwaysAsk|denyCommands|autoApprovePhases" src scripts`
→ 0 hits today; `grep -rn "mcpServers"` → 0). `90` Axis 3 item 3 already names the shape (`project.wildPolicy =
{ autoApprovePhases, alwaysAsk, denyCommands }` consulted in `wildApproveGate`) — this design adopts the *narrowing*
half only.

**The field's version** *(paths listed/grepped today)*:
- **opencode** @88c6c7a — `packages/opencode/src/permission/index.ts:28` `evaluate(permission, pattern,
  ...rulesets)`: wildcard match, `findLast`, default `{action:"ask"}` (read today). Note
  `src/permission/evaluate.ts` merely re-exports it.
- **Roo-Code** @b867ec9 — `src/core/auto-approval/{AutoApprovalHandler.ts (:13 class), commands.ts, tools.ts,
  mcp.ts}` per-category sets (listed today).
- **cline** @025baa8 — `sdk/packages/core/src/runtime/tools/tool-approval.ts`: `requestDesktopToolApproval` :29,
  `timeoutMs`/`pollIntervalMs` options :8-9/:74-75 (read today).
- **codex** @c56dda7 — approval policy × sandbox mode (219f §2.7; I verified only its sandbox dirs today:
  `linux-sandbox`, `mxc-sandbox`, `sandboxing`, `windows-sandbox-rs`, `windows-sandbox-service`).

> [IMPROVER · 2026-09-24] FIELD'S-VERSION ADD (read today): codex's approval policy is concern-granular, not just ask/allow/deny — `codex-rs/protocol/src/protocol.rs:986` `pub enum AskForApproval { UnlessTrusted ("untrusted"), OnRequest, Granular { sandbox_approval, rules, skill_approval, request_permissions } }`, with `Granular` marked `#[experimental("askForApproval.granular")]` (mirrored at `app-server-protocol/src/protocol/v2/shared.rs:176`). Lesson: the field expresses granularity as disjoint concern sets — which the exact-match narrowing overlay (item 8) can credibly mirror without a pattern DSL. — evidence: clone reads (nothing executed). (by PLAN-IMPROVER)

**RapidTool-native design (≤8 lines).**
1. New optional Project field `wildPolicy?: { denyActions?: string[]; alwaysAsk?: string[]; denyCommands?: string[] }`
   (types.ts near `wildMode?` :393). `autoApprovePhases` is **deliberately omitted** — an auto-approve list can only
   *widen*, and widening needs the owner (see constraints).
2. A pure sibling of the policy leaf: `applyPolicyOverlay(verdict, overlay, action, resource): PolicyVerdict`
   (same types, `policy.ts:63-66`), with three rules: an exact `denyActions` match turns `allow` → `deny`
   (`fallback:"none"`); an `alwaysAsk` match turns `allow` → `deny` (`fallback:"human-seat-token"`); no match ⇒ the
   verdict passes through **unchanged** (byte-identical default).
3. Consult **only at seams that already consult policy**: (a) `wildApproveGate` (`engine.ts:3499`, before
   `resolveWildReview` :3442) → `wildPause(..., "wild.paused_policy", …)` via the exported pause writer
   (`engine.ts:3402`) — a coded pause, never a silent skip; (b) the CLI `edit` arm's policy-first block
   (`rapidtool-cli.mjs:1233-1245`, read today); (c) headless `approve` routing (`headless.ts:820`).
4. `denyCommands` is enforced at the runner seam `runNodeBounded` (`node-runner.server.ts:267`) pre-spawn: a match
   returns `{ok:false, reason:"refused", code:"RT_E_VALIDATION"}` — i.e. the tree-run verdict becomes **not green**
   (skip ≠ green; a denied command is a failed command, never an omitted one).
5. Overlay decisions are ledgered with provenance (`decidedVia` + the overlay rule id) like every routed decision,
   so a pause caused by policy is distinguishable from a DoD pause.
6. The overlay is consulted **in addition to** `forceHuman` (`engine.ts:3511`), `STOCK_HITL` (`phases.ts:151`;
   `headless.ts:346`), the DoD floor and the wild cap (`store.ts:1124`) — never instead of them.
7. Malformed overlay (wrong shape) ⇒ fail closed: treat as `alwaysAsk` for every matching action and emit a warn
   row; never silently ignore (the `policy.ts:26-30` default-deny doctrine).
8. Scope guard: matching is **exact string / literal prefix** only — no globbing, no regex, no DSL; a rule may not
   name a resource outside the action's namespace (mirror of `policy.ts:79-86`).

**Seams (read today).** `policy.ts` :44-46 seats, :49 `PolicyAction`, :60 fallbacks, :63-66 verdict types,
:88-99 `POLICY_RULES`, :102 `KNOWN_POLICY_ACTIONS`, :134 `isVerifiedHumanSeatToken`, :146 `seatLabel`, :170
`evaluatePolicy`, :195-221 Rule B, :223-225 autopilot allow, :241-244 no-seat deny. `engine.ts` :3402 `wildPause`,
:3442 `resolveWildReview`, :3494 `wildReviewLog`, :3499 `wildApproveGate`, :3511 forceHuman block, :3517 message.
`types.ts` :388-395. `headless.ts` :346 `canAutopilot` (excludes forceHuman, STOCK_HITL, tightness<7.2, failing
DoD), :820 policy consult. `store.ts:1124` cap. `node-runner.server.ts:267`. Test pin sites: `src/lib/policy.test.ts`,
`src/lib/wild-step.test.ts` (exists today), `src/lib/engine.test.ts` if present.

**Reuse, don't rebuild.** The verdict/fallback **types** and the seat classifier (`policy.ts`) — the overlay returns
the same union so every existing consumer keeps working · the routing-completeness precedent `KNOWN_POLICY_ACTIONS`
(a test that iterates it) to prove the overlay is consulted everywhere it must be · `wildPause` for coded pauses ·
the existing wild tests (`wild-step.test.ts`).

**Honesty constraints it MUST satisfy.** (a) **Narrowing-only** — the function's contract (and a test) must make
widening unreachable: it receives a `PolicyVerdict` and can only return `deny` or the same verdict; it may never
construct an `allow` that was not already one. (b) Never mint `decidedBy:"human"`; never change `requiresHumanSeat`.
(c) A denied command is **not a pass** (skip ≠ green). (d) Every overlay-caused pause carries a coded log row and a
provenance stamp. (e) Documentation may not say "configurable autonomy" — the overlay only *withholds*; it cannot
auto-approve anything, and it cannot cross `STOCK_HITL`.

**Minimal first step (one lane, size S).** The pure evaluator + truth-table tests + **one** consult point
(`wildApproveGate`) with a coded pause. Runner `denyCommands` and CLI/headless consults are follow-on lanes.

**Tests + exact verify command.**
- new `src/lib/policy-overlay.test.ts` — truth table (allow+deny→deny/none; allow+alwaysAsk→deny/human-seat-token;
  allow+no-match→identical object; deny input never becomes allow; malformed overlay → fail-closed; namespace
  escape refused).
- extend `src/lib/wild-step.test.ts` — an overlay `denyActions` entry pauses the wild loop with `wild.paused_policy`
  and **no** cursor move; forceHuman/stock/cap behavior unchanged.
- `node --experimental-strip-types --test --test-concurrency=2 src/lib/policy-overlay.test.ts src/lib/wild-step.test.ts src/lib/policy.test.ts`.

**Risks / what it must NOT claim.** A widening backdoor (mitigation: a). Precedence confusion — document one line:
"policy decides *who may decide*; the overlay only narrows *what this project permits*". Ledger noise (one row per
overlay-caused decision only). Scope creep into a permission DSL (refuse; revisit only if a real rule needs patterns).

**Gated by.** Nothing to land the narrowing rules. Any *widening* (autoApprovePhases, rule relaxations) is an
**owner decision** recorded like `220` §4.4's register; this design does not create it.

---

## F5 · Codebase-scale index — **NOT-RECOMMENDED**  (status: NOT-RECOMMENDED)

**Why the question is on the table.** `219f` §2.3/B3: RapidTool is lexical by design and behind the field's
indexers; `219e` row 10's handoff classifies it "(b) determinism stance today / (a) AST pass tomorrow".

**What the field's indexers actually serve** *(paths listed today; symbols re-read where marked)*:
- Roo-Code @b867ec9 — `src/services/code-index/` (`manager.ts`, `config-manager.ts`, `vector-store/`,
  `search-service.ts`, 8 embedders: bedrock, gemini, mistral, ollama, openai, openai-compatible, openrouter,
  vercel-ai-gateway — listed today): interactive Q&A over a developer's large repo inside an IDE.
- aider @5dc9490 — `aider/repomap.py` (`from tree_sitter import Query` :19, `get_repo_map` :103,
  `load_tags_cache`/`save_tags_cache` :217/:224 — read today): a repo map for its REPL.
- Dyad @43bdd75 — `src/ipc/processors/code_explorer.ts` (219f-carried).
- **RapidTool today** — deterministic lexical mining: `knowledge.ts:19` ("scoring on plain tokens, NOT a vector
  database and NOT embeddings" — read today), `ast-mine.ts:383` `mineCodebase` (read today),
  `algorithms.ts:512` `fusionRank` (read today); `grep -rniE 'embedding|qdrant|vectorstore|faiss|hnsw' src/lib` →
  prose hits only; `grep -rniE 'tree-sitter|tree_sitter' src/lib scripts` → **0 hits** (both run today).

**The honest verdict: do NOT build it now.** Evidence, in order of weight:
1. **It does not serve the maker test.** The artifact the mission is judged by is an **emitted new tree** produced
   from a brief (`RESUME.md` §1.0; `219e` §4 shortest path steps 6-7), not an edit of an existing large repo. The
   emitted trees on disk are small (the census target is `stubs:0 reexports:0 real≥3`); no lane in `219e`'s plan
   consumes an index.
2. **Its main use case is owner-gated and out of class.** "Which files matter in a large *existing* repo" is the
   edit-existing-project axis, which is gated by T4.3 patch preservation + the D-1/D-2 owner decisions
   (`fixes/217c` §3; `219e` §5 items 3 and 8) — building the index first would be building for a product decision
   that has not been taken.
3. **Both honest implementations carry a forbidden cost.** Embeddings reintroduce non-determinism, network and keys
   — they contradict Axis 2's byte-reproducibility claim (`90:201-210`) and the repo's own self-declaration
   (`knowledge.ts:19`). Tree-sitter adds a native dependency and a build step to a memory-tight Windows host
   (`RESUME.md` §5.5) — a real cost for zero measured benefit.
4. **There is no measured problem.** No dossier records a retrieval failure on a real brief; `219e` §5 item 6
   forbids chasing structural losses, and 219f's own framing is that RapidTool's lexical choice is a *design
   statement*, not an oversight.
5. **The cheap half already exists.** If cross-file awareness is ever needed, `ast-mine.ts`'s `mineCodebase`
   (deterministic, in-tree) + a persisted cache is the RapidTool-shaped answer — an *integration* task, not an
   index build. `90` Axis 2 item 3 already frames the ideal as "Aider-class repo awareness with zero LLM ranking".

**Revisit triggers (any one, with evidence, reopens this as a real design).** (1) a real user brief whose source is
an existing repo whose size makes `mineCodebase` measurably miss (quote the query + the miss); (2) T4.3
(patch preservation) lands **and** the product claim moves to "edit an existing repo"; (3) the emitted trees grow
past the point where lexical mining is fast — measure on the largest tree on disk first. If reopened: build a
**deterministic tree-sitter pass with a determinism test**, never embeddings, and label it static-vs-ranked per
`90` Axis 2 item 3.

**What it must NOT claim.** Never present "no codebase-scale index" as a defect against the maker test (it is a
different product's axis). Never write "RapidTool indexes your codebase" anywhere. Never let this memo drift into
"we decided the lexical path is good enough for *editing* big repos" — that question is unanswered, not answered.

**Minimal first step.** None — the deliverable *is* this memo (status NOT-RECOMMENDED). If a lane is ever opened
against it, the first step is a **measurement**: time `mineCodebase` (`ast-mine.ts:383`) on the largest tree on
disk and record whether it misses a real query — evidence first, build second.

**Gated by.** n/a (no build). The revisit triggers above are the gate.

---

## §6 · Considered but not designed here (honest de-scope)

- **Checkpoint/resume + patch preservation (candidate 6).** Both are already specced with done-when in `219e`'s own
  plan — **W16 L1** (checkpoint + `resume`; "kill mid-P6 → resume → same state hash, same next phase, same verdict",
  `remainingwaves.md:202,219`) and **W16 L2** (patch preservation over a user-modified tree: "preserve the user edit
  or refuse loudly — never silently overwrites"). A design here would add little over those rows; what I support
  instead are the two invariants any lane must keep: resume is **itself a ledgered event** (`90` Axis 3 item 2) and
  must reproduce the same state hash; a refused patch must **fail loudly** (never a skipped/soft pass).
- **Streaming (T5.1/S1), git landing tail (W15-L4), eval-corpus expansion (W16-L3), `nextAction` (W14-L1)** — all
  already carry rows with files + done-when in `219e`; not re-designed from competitor evidence here.
- **No escalation to the parent** was needed: none of `219e` §5's excluded moves (sandbox claims, E2E-of-a-running-app,
  multi-language/multi-tenant, second budget system, surface widening for its own sake) turned out to be the
  highest-leverage move; F5 exists precisely to keep one of them out, with evidence.

## §7 · Honest limits of this dossier

- **No tests were run** (0 of the ≤2 allowed) and no keyed path was exercised: every keyed behaviour above is
  traced-in-code, not observed. The test *commands* are the standard single-file forms the repo already uses
  (`package.json` test legs: `node --test "scripts/**/*.test.mjs"` then
  `node --experimental-strip-types --test "src/lib/*.test.ts" …` — read today).
- **Line-cite discrepancies found while reading (flag them so no lane is written against a stale line):**
  (i) `des-1.md` says "registry already does env selection at `registry.ts:35-38`" — read today, `:35-38` is the
  **deliberately-deferred** list in the header; the live env mechanism is the model-id pin read in
  `resolveRoleModel` (`registry.ts:330-334`). (ii) `219f` cites `sandbox-policy.ts:26`; today
  `runnerIsolationClaim()` is at **:33**. (iii) `219f` cites `registry.ts:94` for `LlmProviderId` — still :94 ✓.
  (iv) `220 §0.3`'s "registry-id drift" resolves on read as a naming nuance, not a live mismatch (§F2 constraint f).
- **Carried, not re-verified today:** the aider/MetaGPT/Roo/cline memory rows in F3's field paragraph (219f §2.8);
  codex's approval-policy files in F4's field paragraph (I listed only its sandbox dirs today); Dyad's
  `code_explorer.ts` and aider's litellm catalog in F5's field paragraph. Everything else cites a path/symbol listed
  or read on disk today.
- **`222_codebase_integration_map.md` did not exist on disk at write time** (checked today) — my seam rows are
  self-sourced; if 222 lands, cross-check F1/F2/F4 seam lists against it before writing lane briefs.
- **Sizes** are one-agent lane estimates in the repo's S/M/L vocabulary, not measured effort.
