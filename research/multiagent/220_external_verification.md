# 220 · WATCHDOG E — external reality check (live web) + command-realism audit

**Written 2026-09-24 by WATCHDOG E (W13) — read-only lane; this file is the deliverable.**
All page reads below were taken **2026-09-24** (machine clock at first read: `Thu, Sep 24, 2026 16:58:18 PM -u`;
last local reads ≈17:10). Methods: `browser_navigate` (local Chromium — works, see §1) and/or direct HTTPS
fetch of the same live URL (the response text is what is quoted; saves in `C:/Users/mnril/w13e_scratch/`).
Every external claim carries **URL + short verbatim quote + date**. Where a page was silent, this file says so.
Competitor clones were never executed; live pages were the evidence.

---

## BOTTOM LINE

- **`web research: WORKS`** — browser test: `browser_navigate https://example.com` → title "Example Domain" (2026-09-24).
- **`external claims verified: 20`** (§2–§5; each with URL + quote + date).
- **`plan rows audited: 42 (canonical) + 16 (W14/W15/W16 cross-map); invalid: 1`** — `220_tasklist_canonical.md`
  (WATCHDOG D) **landed mid-run**; §6b audits its **42 rows** row-by-row (on top of §6a's 16 W14–W16 rows). The one
  KNOWN-BROKEN command is **OV-2** (the browser-smoke call — both blockers re-confirmed live today:
  `{"ok": false, "error": "unknown flag: --url"}`, exit 1; `/workspace` guard unsatisfiable on Windows; the row itself
  schedules the guard fix first). 3 further rows self-declare a MISSING verification command (T4.3, DF-09, G4) and are
  confirmed as stated; everything else resolves to OK (5 rows carry a *(planned-new)* note because they build their own
  target). FILE-MISSING = 0, CMD-INVALID = 0.
- **Most consequential finding (external): the model-id check PASSES — Step 0 has no wrong-model-id landmine.**
  The live DeepSeek docs (2026-09-24) list exactly `deepseek-flash` (DeepSeek-V4.1-Flash) and `deepseek-v4-pro`, and
  state verbatim that the legacy name `deepseek-v4-flash` "is still accepted". RapidTool's default wire id IS the
  legacy alias — so the keyed run's model id is documented-accepted. Only nuance: the docs now *prefer*
  `deepseek-flash` as the name to send (an optional 1-line default change, **not** a blocker).
- **Most consequential finding (local):** W14-L4's verify command still cannot run as written (flags rejected;
  the `/workspace` path guard is Windows-unsatisfiable) — WD-C re-confirmed, and I re-confirmed both today.
- No external evidence found that contradicts the plan's OpenHands/Cline/MCP claims; the MCP spec has a new
  revision (**2026-07-28**) with **Roots deprecated** — concrete input for W15-L5 (§4).

---

## §1 · Capability test and method (as instructed)

1. `browser_navigate https://example.com` → **success**, title "Example Domain" (1 call, 2026-09-24). Browser path works.
   A second browser load (the DeepSeek pricing page, §2) also rendered fully — the key check was done **twice**,
   once in the browser and once via direct fetch, and both agree.
2. `web_search`/`web_extract` remain unconfigured (parent-verified; not re-litigated).
3. For verbatim quoting I fetched the same live URLs over HTTPS and read the full page text from disk; for
   JS-heavy pages the browser console was used to read rendered text. Every quote below is from the actual page
   bytes/rendered DOM, never from a search snippet.

---

## §2 · THE KEY CHECK — provider live docs vs the model id RapidTool's Step 0 will use

### 2.1 What the live docs say (read 2026-09-24)

**URL A:** `https://api-docs.deepseek.com/quick_start/pricing/` (Models & Pricing — DeepSeek API Docs; HTTP 200;
read via direct fetch and independently via browser; the page title is "Models & Pricing | DeepSeek API Docs").

Quotes (table cells, verbatim):
- Model column: **`deepseek-flash` (1)** | **`deepseek-v4-pro`**
- `MODEL VERSION`: `DeepSeek-V4.1-Flash` | `DeepSeek-V4-Pro-0813`
- `CONTEXT LENGTH`: `1M` · `MAX OUTPUT`: `MAXIMUM: 384K` · `THINKING MODE`: "Supports both non-thinking and
  thinking (default) modes" · `Tool Calls`: ✓ on both.

Footnote (1), verbatim (verified twice — fetched text and browser console):
> "Use deepseek-flash as the model name. The legacy names deepseek-v4-flash and deepseek-v4-flash-vision-exp are
> still accepted, but the corresponding models have been retired, their requests are served by the
> DeepSeek-V4.1-Flash model and billed at the Flash price."

**URL B:** `https://api-docs.deepseek.com/` ("Your First API Call"; HTTP 200): `model deepseek-flash (1) deepseek-v4-pro (1)`
— same footnote. Also quoted there (relevant to the field refresh, §5): "DeepSeek Harness is now in developer
preview for agent harness developers worldwide."

**URL C:** `https://api-docs.deepseek.com/api/list-models` ("Lists Models"; HTTP 200): documents `GET /models`;
it does not hardcode ids — "Check Models & Pricing for our currently supported models." (So URL A is the
authoritative public list.)

### 2.2 What RapidTool will actually send (local, read today)

- `src/lib/llm/providers/deepseek.ts:39-42` — `DEEPSEEK_MODELS = { flash: "deepseek-v4-flash", pro: "deepseek-v4-pro" }`.
- `:323` — default `opts.model ?? DEEPSEEK_MODELS.flash` ⇒ the wire id RapidTool sends is **`deepseek-v4-flash`**.
- `src/lib/llm/providers/registry.ts:96-99` (own header) — "`deepseek-flash` is the id the vendor SERVES for the
  alias `deepseek-v4-flash`; we keep requesting the alias (byte-identical to the pre-registry code)…".
- Step 0's command is `npm run eval -- --keyed` (package.json `"eval": "node --experimental-strip-types scripts/run-eval.mjs"`;
  `scripts/run-eval.mjs:82` parses `--keyed`; `research/eval-out/_keyed-run.log:2` shows the same command previously).
  The keyed run routes through the same default model id.

### 2.3 Verdict + what I could NOT verify

**Verdict: `deepseek-flash` IS in the live documented model list** — the exact id RapidTool's memory records is
today's primary documented name; the id RapidTool actually sends (`deepseek-v4-flash`) is explicitly "still
accepted" per the docs. **No Step-0 landmine.** Optional (not required): switch the default request id to the
docs-preferred `deepseek-flash`; the repo's current choice is documented as intentional.
- NOT VERIFIED: the live `/models` HTTP call (requires the owner's key — not used by this lane).
- NOT VERIFIED from public docs: the repo header's claim (`deepseek.ts:22-23`) that `deepseek-chat`/`deepseek-reasoner`
  "are still accepted but BOTH silently resolve to `deepseek-flash`" — today's pages are **silent** on those two ids
  (the pricing footnote names only `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` as accepted legacy names).
  Not load-bearing for Step 0 (RapidTool never sends them); a keyed probe would settle it.

---

> [IMPROVER · 2026-09-24] RE-VERIFIED (independent fetch, same day): `https://api-docs.deepseek.com/quick_start/pricing/` fetched 2026-09-24 17:26 UTC by curl (exit 0; 23 982 B saved to `C:/Users/mnril/w13n_scratch/ds_pricing_recheck.html`) — the page still carries `deepseek-flash` and `deepseek-v4-pro` and the legacy-footnote text verbatim: "still accepted, but the corresponding models have been retired, their requests are served by the DeepSeek-V4.1-Flash model and billed at the Flash price." §2's verdict (no Step-0 model-id landmine; `deepseek-v4-flash` is the accepted alias) stands under a second, independent read. — evidence: the curl command + saved bytes above. (by PLAN-IMPROVER)

## §3 · Competitor mechanisms the plan leans on (live pages, read 2026-09-24)

### 3.1 OpenHands — MCP client + sandboxed runtime

**Repo page:** `https://github.com/OpenHands/OpenHands` (README fetched 2026-09-24; HTTP 200). The live README
brands the product **"Agent Canvas"**: "The self-hosted developer control center for coding agents and automations."
Repo API meta (same day): `"full_name": "OpenHands/OpenHands"`, `"description": "🙌 OpenHands: AI-Driven Development"`,
`"pushed_at": "2026-09-24T16:54:54Z"`, stars 89069.

**Sandbox runtime (the isolation bar) — quotes:**
- "It runs locally on your machine by default, but can connect to multiple “agent backends”, e.g. running agents
  in Docker containers, on VMs, or within your company infrastructure."
- "### Option 1: Without a Sandbox" → warning block: "This runs the agent-server directly on the machine you're
  installing on — the agent will have full access to your filesystem!"
- "### Option 2: With a Docker Sandbox" → `docker run -it --rm -p 8000:8000 … ghcr.io/openhands/agent-canvas:1.23.0`
  (mounts `$HOME/.openhands` and `$PROJECTS_PATH`).

⇒ CONFIRMS the plan's premise: OpenHands ships a **Docker-sandbox mode** (isolation bar). Honest nuance: its
default quickstart is *also* unsandboxed — the Docker mode is opt-in, and the README says so with a warning.

**MCP client — quotes:** The README itself has **zero** `MCP` hits (checked). The MCP docs are live:
`https://docs.openhands.dev/openhands/usage/cli/mcp-servers` (HTTP 200):
- "Manage Model Context Protocol servers to extend OpenHands capabilities"
- "MCP servers provide additional tools and context to OpenHands agents. You can add HTTP/SSE servers with
  authentication or stdio-based local servers to extend what OpenHands can do."
- "The CLI provides two ways to manage MCP servers: CLI commands ( openhands mcp ) …"
Docs sitemap also lists `…/usage/settings/mcp-settings` and `…/sdk/guides/mcp`.

⇒ CONFIRMS (in the direction the plan claims): OpenHands is an MCP client; RapidTool has 0 MCP hits in-repo
(219e §0.10). The dossier's "no MCP runtime client" gap is not contradicted by the live repos — it is reinforced.

### 3.2 Cline — MCP client

**Repo page:** `https://github.com/cline/cline` (README; HTTP 200):
- "…or use MCPs to connect to databases, query APIs, manage cloud infrastructure, and interact with external
  systems. Use community-built servers or ask Cline to create custom tools on the fly. **In the CLI, manage servers
  with `cline mcp`.**"
- "routines, and manage models, plugins, and MCP servers."
Repo API meta: `"description": "Autonomous coding agent as an SDK, IDE extension, or CLI assistant."`,
`"pushed_at": "2026-09-24T16:58:15Z"`, stars 69227.

**Docs page:** `https://docs.cline.bot/mcp/mcp-overview` (HTTP 200):
- "MCP (Model Context Protocol) lets Cline use external tools and data sources through MCP servers."
- "Use either local servers or remote hosted servers" · "Local server (STDIO)" · "Remote server (Streamable HTTP)".
- Config location: "CLI: ~/.cline/mcp.json".

⇒ CONFIRMS: Cline is an MCP client with STDIO + Streamable HTTP transports.

### 3.3 Bonus (outside the minimum set): Codex

`https://developers.openai.com/codex/mcp/` redirects (HTTP 200) to `https://learn.chatgpt.com/docs/extend/mcp`
(markdown variant `…/mcp.md`, read 2026-09-24):
- "Model Context Protocol (MCP) connects models to tools and context."
- "Local Codex clients can also connect directly to MCP servers and share their configuration."
- "**STDIO servers**: Servers that run as a local process (started by a command)." / "**Streamable HTTP servers**:
  Servers that you access at an address."

⇒ The dossier's "MCP is table stakes" row is not contradicted (three of the four named tools verified live).

---

## §4 · The MCP spec state — concrete input for W15-L5's interop spike

Read 2026-09-24:

- **Current revision: `2026-07-28`.** `https://modelcontextprotocol.io/specification/latest` → **redirects to
  `/specification/2026-07-28`**; nav reads "Version 2026-07-28 (latest)".
- **Revision history (live repo dir listing,** `https://api.github.com/repos/modelcontextprotocol/modelcontextprotocol/contents/docs/specification`**):**
  `2024-11-05`, `2025-03-26`, `2025-06-18`, `2025-11-25`, `2026-07-28`, `draft`. Spec repo README:
  "The schema is defined in TypeScript (schema/2026-07-28/schema.ts) first, but made available as JSON Schema…as well".
- **What a compliant client must implement (as the spec pages state):**
  - Architecture (`…/2026-07-28/index`): "The protocol uses JSON-RPC 2.0 messages to establish communication
    between: Hosts: LLM applications that initiate connections / Clients: Connectors within the host application /
    Servers: Services that provide context and capabilities". Key details: "Base Protocol — JSON-RPC message
    format; Stateless, self-contained requests; **Per-request capability negotiation**".
  - Tools (`…/2026-07-28/server/tools`): "The Model Context Protocol (MCP) allows servers to expose tools that
    can be invoked by language models." Both protocol methods appear verbatim on the page — **`tools/list`**
    (18 occurrences) and **`tools/call`** (19 occurrences).
  - Transports (`…/2026-07-28/basic/transports`): "A transport is a binding… the standard transports: **stdio**:
    newline-delimited messages over the standard streams of a client-l[ocal process]…" + **Streamable HTTP**
    (page shows "stdio" 21×, "Streamable HTTP" 7×).
  - Client features (`…/2026-07-28/client/roots`): **Roots is DEPRECATED**: "Deprecated: The Roots feature is
    deprecated as of protocol version 2026-07-28 (SEP-2577). Under the feature lifecycle policy, it remains in
    the specification for at least twelve months after this revision's release before it becomes eligible for
    removal. New implementations SHOULD NOT adopt it; existing implementations SHOULD migrate to passing
    directories or files via tool parameters, resource URIs, or server configuration."
- **Interop-spike implications (my read, from the quotes):** a compliant RapidTool client spike should target
  revision `2026-07-28`, speak JSON-RPC 2.0 over stdio and/or Streamable HTTP, implement `tools/list` + `tools/call`
  (plus per-request capability negotiation), and **NOT** implement Roots. Nothing here contradicts the plan;
  it gives W15-L5's memo its concrete bar.

---

## §5 · Field refresh — anything newer than the 2026-09-16 clones

Two live aggregating sources, both read 2026-09-24 (the GitHub *topic* HTML page did not yield parseable repo
cards to my extractor in one attempt, so the star-ordered view was taken from the documented REST endpoint —
both are live sources, quotes below):

**(a) `https://github.com/trending?since=weekly`** (weekly snapshot; extracted page text) — selections relevant
to this repo's class, exactly as the page showed: `anthropics/claude-code` ("Claude Code is an agentic coding tool
that lives in your terminal…" — also "Built by … stars this week"), `addyosmani/agent-skills` ("Production-grade
engineering skills for AI coding agents. … Built by 3,867 stars this week"), `stablyai/orca` ("Orca is the ADE for
working with a fleet of parallel agents. Run any coding agent with your own subscription."), `vectorize-io/hindsight`
("Hindsight: Agent Memory That Learns"), `affaan-m/ECC` ("The agent harness performance optimization system.
Skills, instincts, memory, security, and research-first development…"), `Tencent/WeKnora`, `TencentCloud/Octop`,
`alibaba/open-code-review`, `davila7/claude-code-templates`, `Fission-AI/OpenSpec`, `JustVugg/colibri`.

**(b) `https://api.github.com/search/repositories?q=topic:ai-agents&sort=stars&order=desc&per_page=15`**
(REST response, 2026-09-24; stars / last-push as returned): `affaan-m/ECC` (266,646★) "The agent harness
performance optimization system…" · `NousResearch/hermes-agent` (248,651★) "The agent that grows with you" ·
`deepseek-ai/deepseek-harness` (235,034★) "DeepSeek Harness: Everything is a Plugin." · `firecrawl/firecrawl`,
`langchain-ai/langchain`, `DietrichGebert/ponytail`, `Graphify-Labs/graphify`, `browser-use/browser-use`,
`google-gemini/gemini-cli`, `thedotmack/claude-mem`, `infiniflow/ragflow`, `bytedance/deer-flow` "An open-source
long-horizon SuperAgent harness that researches, codes, and creates. With the help of sandboxes…",
`dair-ai/Prompt-Engineering-Guide`, `stablyai/orca`, `ComposioHQ/awesome-claude-skills`.

**Flagged as post-clone newcomers / changes a reader of the 17 clones would not know:**
- `stablyai/orca` (parallel-agent fleet ADE), `bytedance/deer-flow` (superagent harness w/ sandboxes),
  `affaan-m/ECC` (harness perf: skills/instincts/memory/security), `deepseek-ai/deepseek-harness` (first-party
  plugin harness — corroborated by the DeepSeek docs quote in §2.1: "DeepSeek Harness is now in developer preview
  for agent harness developers worldwide."), `vectorize-io/hindsight` (agent memory), `Fission-AI/OpenSpec`.
  None of these appear in the 17-repo clone set; they are adjacent to RapidTool's axes and belong in any
  "compare against the field" table that claims to be current.
- The live OpenHands README (2026-09-24) presents the product as **"Agent Canvas"** — a naming/product change
  not visible from the clone set; flagged as a field change (I did not date the rename — that page is today's README).

---

## §6 · Command-realism audit (local, read 2026-09-24)

Convention: **OK** = every named file exists and every command references a real entrypoint; **OK (planned-new)**
= same, but the row deliberately creates its own target (a verb/module/file that does not exist yet), so the
command is not runnable until the row lands; **FILE-MISSING / CMD-INVALID / KNOWN-BROKEN(reason)** kept literal.
Scope: `220_tasklist_canonical.md` (WATCHDOG D) **landed while this lane was running** (absent at my ~17:05 check,
present by my final listing). The audit therefore covers both: **(a)** the 16 W14–W16 rows of `219e` audited first
(below — these are the rows the canonical list descends from), and **(b)** the canonical list's **42 rows**, audited
after it landed (§6b at the end of this section). Plus 4 spine citations spot-checked.

### §6a · the 16 W14/W15/W16 rows of `219e` (cross-map; audited first)

| # | Row | Files (existence) | Verification command → entrypoint | Verdict | Notes |
|---|---|---|---|---|---|
| 1 | **Step 0** (owner keyed run) | `research/eval-out/` ✔; `taskuniverselog.md` ✔ | `npm run eval -- --keyed` → package.json `"eval"` script ✔ (`node --experimental-strip-types scripts/run-eval.mjs`); `--keyed` parsed (`run-eval.mjs:82`) ✔; `_keyed-run.log:2` records exactly this command ✔ | **OK** | Needs `DEEPSEEK_API_KEY` (liveness itself = T0.10, unverified here). Model id OK per §2. |
| 2 | W14-L1 | `src/lib/headless.ts` ✔ `headless.test.ts` ✔ `scripts/rapidtool-cli.mjs` ✔ `scripts/README-cli.md` ✔ | `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts` ✔ (file exists; `--test-concurrency` is a real flag in Node v22.23.2 — help-grep = 1). 2nd cmd `… rapidtool-cli.mjs eval` | **OK (planned-new)** | `eval` verb does **not** exist today (35 verbs on disk; none named `eval`) — L1 creates it; 2nd command runnable only post-landing. |
| 3 | W14-L2 | `token-ledger.ts` ✔ `verify.server.ts` ✔ `chat.server.ts` ✔ `crew.server.ts` ✔ `node-runner.server.ts` ✔ `fixes/216w_token_ledger_seams.md` ✔ | "the four seam test files at `--test-concurrency=2`" | **OK** | Actual test files: `token-ledger.test.ts`, `verify.server.test.ts`, `node-runner.server.test.ts`, `chat.test.ts`, `crew.test.ts`. NOTE: **no `chat.server.test.ts` / `crew.server.test.ts` exist** — name the real files in the canonical list. |
| 4 | W14-L3 | `llm/providers/registry.ts` ✔ `registry.test.ts` ✔ `doctor.ts` ✔ `doctor.test.ts` ✔ | `node --experimental-strip-types --test --test-concurrency=2 src/lib/llm/providers/registry.test.ts` ✔ + doctor test ✔ | **OK** | |
| 5 | W14-L4 | `console.tsx` ✔ `styles.css` ✔ `browser-smoke-verdict.mjs` ✔ (+ `browser-smoke.mjs`, `browser-guard.mjs` ✔) | `node scripts/browser-smoke.mjs --url http://localhost:8080 --out-png <scratch>.png` | **KNOWN-BROKEN** | **Reproduced live today**: `{"ok": false, "error": "unknown flag: --url"}`, exit 1 (`browser-smoke-verdict.mjs:30-31` rejects any `--` flag; url/outPng are positional `:37-38`). And the positional form then dies on the path guard: `browser-smoke.mjs:30-33` requires output under literal `["/workspace"]`; `browser-guard.mjs:34-42` compares `resolve(target)` → on Windows `C:\…` can never satisfy `/workspace\…`. Fix target per WD-C: `browser-guard.mjs` (+callers). Needs dev server on 8080. |
| 6 | W14-L5 | `README.md` ✔ `AGENTS.md` ✔ `taskuniverselog.md` ✔ `remainingwaves.md` ✔ | `grep -c 'case "' scripts/rapidtool-cli.mjs` → **35** ✔ | **OK** | Drift confirmed: README `:9/:80/:101` say "**34** verbs"; disk = 35. |
| 7 | W15-L1 | `compile-check.server.ts` ✔ `compile-check.server.test.ts` ✔ `scaffold.ts` ✔ `scaffold.test.ts` ✔ `codegen.server.ts` ✔ `codegen.server.test.ts` ✔ | `node --experimental-strip-types --test --test-concurrency=2 src/lib/compile-check.server.test.ts` ✔ | **OK** | |
| 8 | W15-L2 | `verify.server.ts` ✔ `verify.server.test.ts` ✔ `dod.ts` ✔ | `… src/lib/verify.server.test.ts` ✔ | **OK** | **No `src/lib/dod.test.ts` exists.** `dod.ts` is exercised by: `gates.test.ts`, `verify.server.test.ts`, `headless.test.ts`, `honesty-guards.test.ts`, `judgment.test.ts`, `store.test.ts`, `brief-fixtures.test.ts` (grep today). The row's "`dod.ts` (+test)" has no canonical filename — name it when canonicalising. |
| 9 | W15-L3 | `scripts/run-eval.mjs` ✔ `src/lib/maker-score.ts` ✔ `src/lib/headless.ts` ✔ | `npm run eval -- --trials=2` ✔ (package.json eval script + `--trials=N` parsed at `run-eval.mjs:92-93`) | **OK** | Plan itself flags "heavy — owner-window"; keep off concurrent lanes. |
| 10 | W15-L4 | `src/lib/git.server.ts` — absent (row says "new … name at dispatch"); `rapidtool-cli.mjs` ✔ `scaffold.ts` ✔ | "new module test + scratch-dir CLI probe" | **OK (planned-new)** | No concrete command yet; acceptable for a to-be-created module, but the canonical list should name the test file at dispatch. |
| 11 | W15-L5 | `research/multiagent/219g_interop_spike.md` — absent (it is the row's deliverable); `research/multiagent/` ✔ | — (memo; no core edits) | **OK (planned-new)** | §4 above supplies the spike's external bar (target 2026-07-28, stdio/Streamable HTTP, tools/list+tools/call, no Roots). |
| 12 | W16-L1 | `engine.ts` ✔ `types.ts` ✔ `headless.ts` ✔ `rapidtool-cli.mjs` ✔ | "targeted resume probe + lib tests" | **OK (planned-new)** | `resume` verb absent today (35 verbs; `--resume` exists only as Wild-Mode action flag, `rapidtool-cli.mjs:2577`). |
| 13 | W16-L2 | `patch.ts` ✔ `io.ts` ✔ `codegen.server.ts` ✔ | (no command named) | **OK** | |
| 14 | W16-L3 | `research/eval-corpus/` ✔ (fixtures + `graders/`) `scripts/run-eval.mjs` ✔ | (no command named) | **OK** | |
| 15 | W16-L4 | — (owner run) | same mechanism as Step 0 | **OK** | Owner-gated; same model-id check applies (§2). |
| — | boundary / helper refs | `scripts/gate.sh` ✔ `scripts/with-app-env.mjs` ✔ | | **OK** | |

### Re-confirmations of WD-C's two known-broken items ("re-confirm only if you touch them" — I touched both)

1. **`browser-smoke.mjs` flag rejection — re-reproduced today** (2026-09-24):
   `node scripts/browser-smoke.mjs --url http://127.0.0.1:59999/ --out-png C:/Users/mnril/w13e_scratch/x.png`
   → stdout `{"ok": false, "error": "unknown flag: --url"}`, **exit 1**. Code: `scripts/browser-smoke-verdict.mjs:30-31`.
2. **`browser-guard.mjs` path guard — re-confirmed statically** (did not re-run the positional form: it launches
   Chromium, avoided on this memory-tight host): `browser-smoke.mjs:30-33` passes allowed dirs `["/workspace"]`;
   `browser-guard.mjs:34-42` requires `resolve(target).startsWith("/workspace" + sep)` — on Windows `resolve()`
   yields `C:\…`, so every output path fails, exactly as WD-C reproduced ("…must be under /workspace, got C:\workspace\…").

### Spine §0.3 — the flagged "registry inconsistency": RESOLVED

Read the actual bytes (all today): `registry.test.ts:281` asserts the refusal names `/deepseek-v4-flash, deepseek-v4-pro/`;
`registry.ts:346-352` builds `"${source} is not a known model id — known ids: ${KNOWN_MODEL_IDS.join(", ")}. Refusing
rather than silently defaulting."`; `KNOWN_MODEL_IDS = Object.freeze([...DEEPSEEK_REQUEST_MODEL_IDS])` (`:359-361`) =
`["deepseek-v4-flash", "deepseek-v4-pro"]`; `deepseek.ts:40-41` maps flash→`deepseek-v4-flash`, pro→`deepseek-v4-pro`.
⇒ **Message, test and code all agree — NO drift.** The spine's "odd one out" suspicion resolves to the documented
naming-layer nuance (`deepseek-flash` is the *served* name; the alias is requested deliberately — `registry.ts:96-99`).
Against live docs the alias is still accepted (docs prefer `deepseek-flash`) ⇒ at most an **optional OV** ("switch the
default request id to the docs-preferred name"), never a defect. Suggested de-risking for any future rename:
`registry.test.ts:267-283` covers refusal paths only; a live acceptance probe needs the key.

### Spine citations spot-checked (not rows; all OK)

`engine.ts:1464-1495` ✔ (red-seal block: `p{phase}.seal.unmet` … "red seal — N unmet DoD probe(s)") ·
`compaction.ts:159-166` ✔ (`contextWindowTokens` parameter + trigger comparison) · `registry.ts:24-28, 94-99` ✔ ·
`deepseek.ts:19-27, 39-42` ✔ · `doctor.ts:166-167` + `doctor.test.ts:81-92` ✔ (the `humanFixtures`/`productComplete`
fields and the only test that sets them).

### §6b · `220_tasklist_canonical.md` — all 42 rows, audited independently (after it landed)

Method: every row's `files` cell re-checked on disk by me (independent of WD-D's own pass — all cited *existing*
paths were present); every verification command checked against a real entrypoint; WD-D's `[me]` spot-claims re-run
(all matched, bracketed = the list's claim): `grep -c 'diagnose:'` cli = **0** ✔ · `grep -c nextAction src/lib/headless.ts` = **0** ✔ ·
`grep -c 'MCP/A2A' src/lib/engine.ts` = **1** ✔ · `grep -c TRUNC src/components/console.tsx` = **0** ✔ ·
feasibility/template-derived caveat grep in console.tsx = **0** ✔ · `grep -c redTree` cli = **0** ✔ ·
`fixes/217c:592` drop-in slot literally `[W11-L2 PROBE RESULT — UNKNOWN at write time…]` ✔ · `scripts/README-cli.md:10`
already says 35 ✔ · `format:check` absent from package.json ✔ · 14 `scripts/*.test.mjs` incl. `README-cli.test.mjs` ✔ ·
second existence batch all OK (`patch.test.ts`, `vault.ts`, `io.test.ts`, `packet.test.ts`, `gates.test.ts`,
`lesson-writers.test.ts`, `sandbox-policy.ts`, `AGENT_GUIDE.md`, `.hermes/environment.json`, `fixes/217b` ✔).

| row | verdict | note |
|---|---|---|
| TASK-01 | OK | files ✔; `headless.test.ts` runnable ✔; `grep nextAction` re-ran = 0 (as claimed). |
| T5.3 | OK (planned-new) | files ✔ (incl. `scripts/README-cli.test.mjs`); `eval` verb absent today — the row itself says "post-landing". |
| T-107.6 | OK | all five seam test files exist under the WD-C-corrected names ✔. |
| OV-1 | OK | `registry.test.ts` + `doctor.test.ts` ✔; cmd ✔. |
| OV-2 | **KNOWN-BROKEN** | **re-confirmed live today** (`--url` → `{"ok": false, "error": "unknown flag: --url"}`, exit 1; `/workspace` guard unsatisfiable on Windows). The row already schedules the guard fix first — acknowledged, not hidden. |
| TA-3 | OK | `grep -c 'case "'` re-ran = 35 ✔; `README-cli.md:10` says 35 ✔; USAGE `diagnose:` = 0 ✔. |
| OV-3 | OK (BLOCKED-KEY) | files ✔; `compile-check.server.test.ts` ✔. |
| OV-4 | OK (BLOCKED-KEY) | files ✔; `verify.server.test.ts` ✔ (`dod.ts` — no dedicated `dod.test.ts`; the row doesn't claim one). |
| OV-5 | OK (BLOCKED-KEY) | files ✔; `--trials=N` real (run-eval.mjs). |
| T4.2 | OK (planned-new) | `git.server.ts` correctly absent; probe "to name at dispatch" (row states it). |
| OV-6 | OK (planned-new) | `219g_interop_spike.md` correctly absent; memo row; §4 above supplies its external bar. |
| T-107.7 | OK (planned-new) | files ✔; `resume` verb absent today; probe "to name at dispatch" (row states it). |
| T4.3 | MISSING cmd (as stated) | row is `UNVERIFIABLE-NOW` by its own text; `patch.test.ts` exists ✔. |
| OV-7 | OK | `eval-corpus` + `graders` ✔; `npm run eval -- --trials=2` ✔; freeze-check "to fix at dispatch" (row states it). |
| T0.10 | OK | cmd triple-verified (package.json script · `--keyed` parse · `_keyed-run.log:2`); key = owner's (§2). |
| OV-8 | OK | files ✔; cmd ✔. |
| T5.1 | OK | files ✔; cmd `chat.test.ts` ✔ (phantom `chat.server.test.ts` correctly avoided). |
| T5.2 | OK | files ✔; `brief-fixtures.test.ts` ✔. |
| T5.4 | OK | `types/engine/codegen/packet/vault/io` all exist ✔; the three test files exist ✔. |
| T5.5 | OK (planned-new) | `plugin.ts` correctly absent. |
| T5.7 | OK (planned-new) | `cassette.ts` correctly absent; keyless-eval invariant cmd real. |
| DF-09 | MISSING cmd (as stated) | row `UNVERIFIABLE-NOW`; proof-grep `grep -n "note:" src/lib/engine.ts` real. |
| DF-18 | OK | flip-grep re-ran = 0 ✔ (as claimed). |
| DF-26 | OK | flip-grep re-ran: `TRUNC` = 0 ✔. |
| DF-04 | OK | `grep -c 'MCP/A2A'` re-ran = **1** ✔ (as claimed). |
| G4 | MISSING cmd (as stated) | scan + test do not exist — row states it. |
| G5 | OK | probe pattern real (fresh emit; `emit` verb ✔). |
| OV-9 | OK | files ✔; extend `doctor.test.ts` ✔. |
| OV-12 | OK | drop-in slot confirmed at `fixes/217c:592` (see above). |
| OV-13 | OK | files ✔; `store.test.ts` + `verify.server.test.ts` ✔. |
| OV-14 | OK | `dod.ts`/`packet.ts` ✔; `gates.test.ts`/`packet.test.ts` ✔. |
| OV-15 | OK | `grep redTree` cli re-ran = 0 ✔ (still unreachable, as stated). |
| OV-16 | OK | `doctor --tree` **flag verified real** (`args.tree` branch inside the `doctor` case). |
| OV-17 | OK | probe-shaped cmd; `README.md` ✔. |
| TA-21 | OK | grep/read cmd real; `engine.ts` ✔. |
| OV-18 | OK | `honesty-guards.test.ts` ✔. |
| T-107.8 | OK | `sandbox-policy.ts` ✔; probe record `fixes/217b` §2 exists ✔. |
| OV-10 | OK | `doctor.ts` ✔; decision row ("— until decided"). |
| OV-11 | OK | `lesson-writers.test.ts` ✔. |
| D-1 | OK | `README.md` + `AGENT_GUIDE.md` ✔. |
| D-2 | OK | `README.md` ✔. |
| T3.6 | OK | `package.json` ✔; `format:check` absent as stated ✔; `.hermes/environment.json` ✔. |

**Counts: 42 rows audited · OK = 38 (of which 5 planned-new) · KNOWN-BROKEN = 1 (OV-2) · MISSING-cmd-as-stated = 3
(T4.3, DF-09, G4) · FILE-MISSING = 0 · CMD-INVALID = 0.** No row of the canonical list references a file that is
absent without saying so, and no command references an entrypoint that does not exist (post-landing where the row
says "post-landing").

---

## §7 · Honest limits of this verification

- Quotes are short excerpts of the named pages; full fetched texts/renderings are saved in
  `C:/Users/mnril/w13e_scratch/` (`ds_pricing.html`, `oh_readme.md`, `cline_readme.md`, `mcp_*.html`,
  `codex_mcp_md.txt`, `gh_trending.html`, `gh_search.json`, …). Pages are live and can change after 2026-09-24.
- The competitor clones were never executed; the 17-clone set was not re-surveyed here (219f/WD-C own that).
- Proprietary, non-public dossier claims (e.g. "Antigravity MCP Store", "DSH `mcp__<server>__<tool>`") were
  **not** re-verified — not in the minimum set and no public page was loaded for them.
- The `/models` endpoint was not called (needs the owner key). `deepseek-chat`/`deepseek-reasoner` acceptance:
  UNVERIFIED (docs silent, §2.3).
- Star counts are as the aggregating pages/API returned on 2026-09-24 (moving numbers).
- `220_tasklist_canonical.md` landed mid-run; **its 42 rows are audited in §6b** (its own file-existence pass was
  independently re-done here — all cited existing paths were present). Rows added after my §6b audit are not covered;
  §2's model-id result and §4's spec bar remain valid inputs to any later revision of it.
