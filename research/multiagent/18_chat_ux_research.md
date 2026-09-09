# 18 — Chat-Tab UX & AI-Analyzable Error Codes: research for a project-grounded in-app assistant

- **File:** `research/multiagent/18_chat_ux_research.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`)
- **Date / agent:** 2026-09-06 · Flash research agent F1 (chat-UX + error-code research; strictly read-only on source — the only file written this pass is this one)
- **Inputs:** live working tree (`src/components/console.tsx`, `src/lib/store.ts`, `src/lib/deepseek.server.ts`, `src/lib/crew.ts`, `src/lib/packet.ts`), sibling research `research/multiagent/17_agent_ux_review.md`, and 20+ fetched web sources (every cited URL fetched 2026-09-06 — see §5).
- **0-hallucination rule:** every `console.tsx:<line>` / `store.ts:<line>` anchor below was re-verified by this agent against the working tree on 2026-09-06 (read_file/search_files). Every external claim is attributed to a fetched source (§5); claims about competitor UIs are scoped strictly to what those sources say — no invented screenshots or unverifiable "I saw X" claims.
- **Scope:** (1) cited chat-UX pattern survey (streaming, markdown, suggestion chips, artifacts, grounding/citations, history); (2) error-code taxonomy survey + recommended surface shape for RapidTool's `RT_E_*` system (does not exist in source yet — this doc proposes it); (3) honest competitive analysis vs Hermes / Codex / Claude / Gemini; (4) concrete Chat-tab UX spec anchored to `console.tsx` with a build-order and test plan.

---

## 0. TL;DR (recommendations this file argues for)

1. **Stream, don't poll.** A Chat tab must render tokens incrementally over a single fetch stream (SSE-style), managed like Vercel `useChat`'s state machine — RapidTool's console already keeps every tab mounted `forceMount` so a live stream survives tab switches (`console.tsx:1477`). No new dependency needed: `fetch` + `ReadableStream` reader + the existing Radix tab shell.
2. **Reuse `MarkdownBody`** (`console.tsx:2157`) for assistant replies — it is already XSS-safe (plain React, never innerHTML, `console.tsx:2150-2155`), already renders fenced code with a language caption (`console.tsx:2229-2245`), and already degrades to raw pre-wrap text (`console.tsx:2159-2166`). Add streaming + copy button, do not fork a markdown renderer.
3. **Error codes must be machine-readable, not prose.** Today every store failure is a plain string in `{ ok: false; error: string }` (`store.ts:21-33`) surfaced as one red paragraph (`console.tsx:1347-1351`). Recommend a `RT_E_*` snake_case code + stable-envelope field + per-code docs table (Stripe/Postgres pattern, §2.3), rendered as a monospace badge next to the message and in packet/docs — this is what makes errors *AI-analyzable* (chat can cite, look up, and act on them deterministically).
4. **Quick-action chips are the killer feature and are cheap.** Because the chat is grounded in live project state (`project.currentPhase`, `hitl`, `gate_unmet`, rejection history), chips like *"Run to next gate"*, *"Why is this gate blocked?"*, *"Show unmet DoD"* can call store functions RapidTool already exposes (`console.tsx:446-468`, `store.ts:55-80`). No competitor chat is wired to a governed 13-phase pipeline, so none can offer this (§3.3).
5. **Every assistant message needs a grounding footer** — chips naming the artifacts / phases / log entries it read, clickable to jump tabs. Pattern sources: Gemini grounding citations and the AI SDK "Sources" part (§1.5).

---

## 1. Chat-UX pattern survey (what the best chat surfaces do, with receipts)

### 1.1 Streaming-first architecture (Vercel AI SDK `useChat`, SSE)

Vercel's `useChat` is the de-facto reference React chat primitive. Its docs state it "enables the streaming of chat messages from your AI provider, manages the chat state, and updates the UI automatically as new messages are received" — one hook owns messages state, the wire call, and the live-updating UI [S1]. Key design facts for us:

- **Transport, not polling:** since v5 `useChat` is transport-based (default `POST /api/chat`) and exposes `stop`/regenerate/reconnect flows (parameters `trigger: 'submit-message' | 'regenerate-message'`, `prepareReconnectToStreamRequest`) [S1]. There is an explicit "Chatbot Resume Streams" pattern and a "Chatbot Message Persistence" guide in the same docs tree [S2].
- **Structured wire format:** the AI SDK UI stream protocol is a JSON-lines-ish stream of typed **parts** — text deltas plus `start-step`/`finish-step`, tool-output, `finish-message`, abort — so the UI can render text, tool state, and errors from one stream [S3].
- **Why streaming beats polling:** MDN frames SSE as the server pushing "new data to a web page at any time" over one long-lived request, vs. the traditional request→response model [S4]. For token LLMs the perceived-latency win is the dominant UX factor in every major product (§3.1); a poll loop that waits for a full response would make RapidTool's assistant feel like a batch job.
- **What we should copy:** message state as an array of typed parts (not one giant string), an in-flight assistant message that mutates as deltas arrive, an explicit stop/abort affordance, and "regenerate" re-sending the last user turn. All implementable with `fetch` + a reader loop — no SDK install required; RapidTool already calls DeepSeek over HTTP with a 60 s AbortController timeout today (`deepseek.server.ts:170-185`) and would add `stream:true` plus a chunk parser.

### 1.2 Markdown & structured rendering

Every modern assistant UI renders markdown with syntax-highlighted fenced code and copy buttons; Claude Code's desktop/terminal UIs add a diff viewer, a transcript viewer, and fullscreen rendering modes [S5, S6]. RapidTool already has the safe half of this: `MarkdownBody` renders heading/code/list/hr blocks as React elements (never innerHTML) with a `lang` caption bar on fenced code (`console.tsx:2122-2263`; blocks come from `renderMarkdownBlocks`, `src/lib/render.ts`, via `console.tsx:2124`). The Chat tab should reuse it verbatim for assistant replies and add: (a) per-block copy button for code fences; (b) inline `<details>` collapsing for long transcripts; (c) a dedicated "mono transcript" view for raw/JSON artifacts (the `whitespace-pre-wrap` fallback path already does this, `console.tsx:2164`).

### 1.3 Action-suggestion chips & next-prompt suggestions

Claude Code's interactive mode ships **prompt suggestions**: after a response it can suggest the *next* prompt from conversation history ("a natural continuation of your workflow"); `Tab`/`Right-arrow` places the suggestion, typing dismisses it, and generation reuses the prompt cache so it is cheap; notably it *skips* suggestions after an error or in plan mode [S6]. GitHub Copilot Chat's IDE panel makes **mode** a first-class bottom-of-chat control (Agent / Plan / Ask agents dropdown) [S7]. Implications:

- Suggestion chips must be **state-aware**: don't offer "Run to next gate" while `busyAction !== null` or when `project.status` is `blocked`/`complete` — the console already encodes these exact states in the hero area (`console.tsx:1066-1132`).
- RapidTool's chip set should be **deterministic** (derived from live project state, §4.4), unlike generative next-prompt guesses — deterministic chips are free, instant, honest, and can be unit-tested. Generative continuation suggestions can come later via the crew/DeepSeek seam.

### 1.4 Artifacts / side-panel pattern (Claude & Claude Code)

Claude.ai's artifact system: content created in chat that is "a powerful way to create content within Claude," versioned (a version picker), publishable to a link or org, embeddable, remixable ("copy the code into a chat of your own"), and listed in a sidebar Artifacts section outside the original conversation [S8]. Claude Code artifacts go further: a session publishes a **live interactive page** that "updates in place as the session continues," and the docs explicitly argue artifacts are for output "easier to look at and interact with than to read line by line" — e.g., annotated diffs, dashboards, side-by-side options, investigation timelines [S9].

RapidTool already half-owns this pattern with its tab layout: artifacts land in the Artifacts tab (`console.tsx:1478-1519`), packet renders as markdown (`console.tsx:1521-1535`), spec/crew/oracle/vault/design/diagram each have panes. The Chat tab should treat *tabs as the artifact canvas*: when the assistant answers with a table or JSON, offer "Open in Artifacts / Vault / Packet" jumps rather than trying to become a rich preview host. One genuinely new idea worth stealing: **the chat can mint reviewable things** (e.g., "here is a candidate rejection note" or "here is the DoD gap table") as clickable chips that open existing panes — no new renderer, no new storage.

### 1.5 Grounding & citation display (Gemini, AI SDK, context engineering)

- Gemini's "Grounding with Google Search" exists explicitly to "provide more accurate answers and cite verifiable sources," "reduce model hallucinations by basing responses on real-world information," and "build user trust by showing the sources for the model's claims"; responses carry grounding metadata used to render inline citations [S10]. The AI SDK chatbot surface documents a **Sources** part type in message streams [S2].
- Anthropic's context-engineering post is the conceptual backbone for a project-grounded assistant: treat context as "a critical but finite resource"; an agent loop generates ever more possibly-relevant data that "must be cyclically refined"; and LLMs suffer "context rot" as token counts grow — so **grounding = curating which project slices enter each turn** [S11].
- For RapidTool this maps to a *structured grounding block per user turn*: the Chat tab composes the model prompt from live project slices (current phase record, pending HITL evidence via `evidenceForGate`, `console.tsx:139-191`; latest rejection guidance, `console.tsx:1983-2009`; tail of gate log + diagnostics, `console.tsx:1641-1684`; memory rows, `console.tsx:1625-1640`) and then renders a **"Grounded in" footer** of clickable chips under each assistant message — artifact chips jump to the Artifacts tab, phase chips open `PhaseRecordView` (`console.tsx:3543`). This is Gemini-style source display applied to *project objects* instead of web URLs. §4.5 specifies it.

### 1.6 History & session management

- `useChat` keeps `messages` in hook state with persistence and resume-stream guides [S1, S2] — i.e., history is an explicit UI concern with reload/regenerate semantics, not an afterthought.
- Claude Code desktop documents **parallel sessions with Git isolation, side chats ("ask a side question without derailing the session"), task lists, and session recap**, plus checkpointing/rewind for edits [S5, S6, S12].
- For a localStorage-only client (honesty contract, `AGENT_GUIDE.md §4`), the right scope is: per-project chat history persisted under the project id (same lifecycle as `project.notes`, `console.tsx:1616-1623`), with **regenerate** and **clear** affordances; no multi-session tree in v1. The console's own "last saved" convention (`console.tsx:494, 504-506, 985-992`) gives the visual vocabulary for a "saved" indicator.

### 1.7 Synthesis — the patterns that transfer (and the ones that don't)

| Pattern | Adopt? | Evidence |
|---|---|---|
| Streamed token deltas over one HTTP request | ✅ v1 | [S1][S3][S4] |
| Typed message parts (text/tool/error) | ✅ v1 | [S3] |
| Markdown + fenced-code caption + copy | ✅ v1 (reuse `MarkdownBody`) | [S5][S6] + `console.tsx:2157` |
| Regenerate + stop on the last assistant turn | ✅ v1 | [S1] |
| Deterministic, state-derived quick-action chips | ✅ v1 (§4.4) | [S6] (state-aware suggestions) |
| Generative next-prompt suggestions | ⏸ v2 (cost/UX; skip-after-error rule is a must) | [S6] |
| Rich artifact canvas in the chat pane | ⛔ — route to existing tabs instead | [S8][S9] |
| Multi-session tree / parallel chats | ⛔ v1 (localStorage scope) | [S12] + honesty contract |
| Web-search grounding + citations | ⏸ only via existing research backends (`researchStatus`, `console.tsx:969-973`) | [S10] |
| Context curation per turn (project slices) | ✅ v1 — this is RapidTool's moat (§3.3) | [S11] |

---

## 2. Error-code taxonomies an AI agent can actually analyze — and the shape for `RT_E_*`

### 2.1 Survey of mature systems (all fetched §5)

**Stripe (string codes + doc link + type class).** Every API error object carries stable snake_case `code` values (`card_declined`, `account_number_invalid`, …) plus `type` (request/API/authentication/permission/rate-limit/idempotency/connection classes), a `decline_code` when a card issuer declined, and — critically — `doc_url`, which "contains a link to that error code's entry in the table" of the human-readable error-codes page [S13][S14]. Error *types* are coarse and stable; error *codes* are fine-grained and open (Stripe explicitly documents closed vs open enums and tells clients to default-branch unknown open-enum values) [S13]. Handling guidance is per type class (retry on connection/rate-limit; fix payload on invalid_request) [S15].

**OpenAI (typed SDK errors + legacy envelope).** Official docs route handling through typed exceptions (`APIConnectionError`, `RateLimitError`, `APIError` with `status`) so code branches on error *class* first [S16]. The widely-seen JSON envelope is `{ "error": { "message", "type", "param", "code" } }` where `code` may be null and `type` carries the class (`insufficient_quota`, …) [S17 — community thread reproduced for envelope shape; official table lives in the fetched error-codes page].

**PostgreSQL (SQLSTATE — the canonical "test the code, not the message" system).** Five-character codes: first two chars = error *class*, last three = specific condition; apps "should usually test the error code, rather than looking at the textual error message," because codes "are less likely to change across releases" and "are not subject to change due to localization." Codes ship with stable **condition names** (`unique_violation`), a per-class generic `XX000`-style code, and — the part AI agents love — **structured detail fields**: constraint/table/column names arrive in separate fields so apps "need not try to extract them from the possibly-localized human-readable text" [S18].

**Win32/HRESULT (stable symbolic names over raw hex).** HRESULTs are 32-bit values (`E_ACCESSDENIED = 0x80070005`, …); docs present a canonical name↔value table and point to `Winerror.h` as the source of more [S19]. The lesson is *never display or log the raw hex without the symbolic name*, and keep a single registry file that docs and tooling both read.

### 2.2 What makes an error code AI-analyzable (criteria distilled from §2.1)

1. **Stable, opaque, unique identifier** — never a localized/human sentence; survives renames of messages. (Postgres [S18], Stripe `code` [S13].)
2. **Class hierarchy in the identifier itself** — Postgres class prefix (`23` = integrity-constraint → all `23xxx`) lets an agent fall back to the class when the exact code is unknown [S18]. A `RT_E_<DOMAIN>_<NNN>` grammar gives the same property.
3. **Machine-readable envelope fields around the code** — `code`, plus structured context (Stripe `decline_code`/`doc_url` [S13]; Postgres constraint-name fields [S18]; OpenAI `param` [S17]) so the fix is derivable without parsing prose.
4. **One canonical registry table** — code → human description → guidance → related codes, documented (Stripe's error-codes table [S14]) so the *same* table can be (a) linked from the UI badge, (b) included in packet/docs, and (c) injected into the model prompt for grounded error explanations.
5. **Type class for retry/flow decisions separate from detail code** — Stripe types vs codes [S15]; OpenAI exception classes [S16].
6. **Unknown-code default branch** — open enums must not crash the UI; render code + "see registry" (Stripe open-enum guidance [S13]).

### 2.3 Recommended surface shape for RapidTool's `RT_E_*` system

Current state (verified): every store failure returns a **plain prose string** inside `{ ok: false; error: string }`-style unions (`store.ts:21-33`, and call sites such as `console.tsx:639, 650, 671, 683, 705`), rendered as one red `<p role="alert">` (`console.tsx:1347-1351`). There is no error registry. Proposal (additive, backward-compatible — `error` string stays for legacy consumers):

**Envelope field (recommended):**
```ts
// store.ts result unions grow an optional code; `error` text remains for humans.
type RtFailure = {
  ok: false;
  error: string;            // human sentence (unchanged)
  code?: RtErrorCode;       // NEW: "RT_E_ENGINE_0201" — stable, registry-keyed
  ctx?: Record<string, string | number>;  // NEW: structured context, e.g. { phase: 4, criterionId: "C4.1" }
  docUrl?: string;          // NEW: ../docs/#rt-e-engine-0201 (mirrors Stripe doc_url)
};
```
Grammar: `RT_E_` + `<DOMAIN 2-8 chars>` + `_` + `<4-digit number>` (Postgres-style class prefix inside the name, Stripe-style snake_case readability). Example seed set (each maps to a *real* failure the console already distinguishes):
- `RT_E_ENGINE_0001` phase-execute failed / `RT_E_ENGINE_0201` run stopped `error` (RunStopReason `"error"`, `store.ts:23-29`)
- `RT_E_GATE_0101` approval rejected by DoD gate (unmet criteria ids in `ctx.criterionIds`) — today: `ingestReport` returns `gate_unmet?: string[]` (`store.ts:76-77`, E-16) and autopilot denials log `detail: "P<n> unmet: <ids>"` (`console.tsx:1971-1979`)
- `RT_E_GATE_0102` human override required (`forceHuman` path — `console.tsx:1873-1879`, 1924-1934)
- `RT_E_HITL_0301` rejection note too short (12-char rule, `console.tsx:1911-1923, 1948`)
- `RT_E_LLM_0401` no backend configured / `RT_E_LLM_0402` provider transport error / `RT_E_LLM_0403` empty model output (`deepseek.server.ts:1-16, 185-195`; honest `reason:"not-configured"` contract per `17_agent_ux_review.md:18`)
- `RT_E_IMPORT_0501` invalid report JSON / `RT_E_IMPORT_0502` duplicate report (`store.ts:74-77`, report-intake no-op semantics per `17_agent_ux_review.md:20`)
- `RT_E_CLIP_0601` clipboard blocked (`console.tsx:541, 799`)
- `RT_E_UI_0701` operation rejected by busy latch (`busyRef`, `console.tsx:475, 632, 719`)

**UI badge (Chat tab + console):** replace nothing; *add* a monospace badge row under any error paragraph: `RT_E_GATE_0101` in `text-danger` mono + "Registry" link + one-line fix suggestion from the registry. The chat uses the code to answer "why did this fail?" with the registry row + live project context (§4.3).

**Registry table:** `docs/error-codes.md` (or a `src/lib/errors.ts` const table rendered into packet docs) with columns: code · domain · message template · retryable? · user action · related codes — one source of truth consumed by UI badge, packet appendix, and the chat system prompt. This is the Stripe table [S14] + Postgres structured fields [S18] lesson applied at RapidTool scale.

---

## 3. Honest competitive analysis (what the four do that we don't — and the one thing none of them can do)

Scope note: claims below are limited to each product's own docs/README, all fetched 2026-09-06 (§5). "RapidTool's console" = the verified `console.tsx` surface.

### 3.1 What each product has (verified)

- **Hermes Agent / Hermes Desktop** — self-described as "an autonomous agent," *not* "a coding copilot tethered to an IDE or a chatbot wrapper around a single API": runs in CLI, desktop, or on a server/VPS; **persistent memory across sessions**, a self-improving **skills** system, subagent delegation ("spawn isolated subagents for parallel workstreams"), 60+ tools, MCP support, voice mode, and messaging gateways (Telegram/Discord/…); the docs homepage foregrounds its "learning loop" [S20].
- **OpenAI Codex CLI** — "a coding agent from OpenAI that runs locally"; ships CLI, IDE extensions, a desktop app (`codex app`), and a cloud/chat surface (ChatGPT Codex); installable via npm/brew, signs in with a ChatGPT plan or API key [S21].
- **Claude Code (Anthropic)** — agentic coding tool "in your terminal, IDE, desktop app, and browser": reads the codebase, edits files, runs commands; CLAUDE.md project memory + auto memory; skills/subagents/hooks/MCP; desktop app adds parallel Git-isolated sessions, drag-and-drop panes, integrated terminal + file editor, **side chats**, visual diff review, app previews, PR monitoring; terminal UX has transcript viewer, diff panel, task lists, session recap, voice input, prompt suggestions [S5][S6][S12][S22]. Its **artifacts** publish live shareable pages that update in place [S9]. Claude.ai (chat product) adds the original artifact canvas pattern with versioning/publishing/remixing [S8].
- **GitHub Copilot Chat (IDE)** — three explicit modes in a dropdown (Ask / Agent / Plan), agent mode streams edits into the editor and can run terminal commands, supports **subagents** with isolated context that return results into the main thread, and self-corrects [S7]. (Copilot in the IDE is the strongest "chat that acts on your repo" benchmark.)
- **Gemini CLI / Gemini API** — terminal agent with built-in Google Search grounding, file ops, shell, web fetch; MCP; free tier; non-interactive script mode [S23]. The Gemini API documents grounding-with-citations [S10] and schema-constrained structured outputs (JSON Schema `responseSchema`, streaming results) [S24].

### 3.2 What RapidTool's console lacks vs all four (honest, anchored)

| Gap | Evidence (console today) | Who has it |
|---|---|---|
| **No conversational surface at all.** The only "chat-like" UI is the post-hoc Crew transcript block (`console.tsx:1221-1260`) and the notes textarea (`console.tsx:1616-1623`). LLM output arrives only as *written artifacts* ("Phase narrative (LLM)", "Rejection guidance (LLM)", `console.tsx:1983-2009`) — read after the fact, never conversational. | `RunTab` union has 8 tabs, no chat (`console.tsx:91`); no streaming anywhere (`deepseek.server.ts:170` hardcodes `stream:false`) | Hermes, Codex, Claude, Copilot, Gemini |
| **No token streaming / live progress.** Runs show an indeterminate pulsing dot ("running…", `console.tsx:1123-1131`); there is no partial output. | `busyAction` strings only (`console.tsx:474`) | all five |
| **No regenerate/stop/retry on LLM output.** Rejection guidance is regenerated only by another reject cycle; crew re-run re-spawns everything (`console.tsx:718-788`). | `run()` clears errors and re-executes whole phase (`console.tsx:631-644`) | Hermes, Codex, Claude, Copilot, Gemini |
| **No ask-mode / explain-mode.** You cannot ask "why is this gate blocked?" of the project — you must read the dock (`console.tsx:1854-1968`), the denial log line (`console.tsx:1955-1965`), and the guidance artifact yourself. | read-only evidence `<details>` (`console.tsx:1889-1910`) | Hermes (chat), Codex/Claude/Copilot (`/explain`-style), Gemini |
| **No mode/suggestion affordances.** Buttons exist per action, but nothing proposes the *next* action; no state-aware suggestions (Claude Code's prompt suggestions, `S6`). | hero buttons + shortcut hints (`console.tsx:1095-1132, 1289-1312`) | Claude Code, Copilot modes [S6][S7] |
| **No chat history.** Crew transcripts live in component state and vanish on reload (`CrewRunView`, `console.tsx:103-112, 473`); the project JSON keeps decisions/logs but no question/answer history. | `exportProjectJson` includes logs (`console.tsx:1180-1187`) | all |
| **No citations/grounding display.** LLM artifacts are shown as plain bodies with a one-line "advisory" disclaimer (`console.tsx:2002-2006`); nothing links a claim to the phase/artifact it came from. | `BlockedGuidanceBlock` (`console.tsx:1998-2009`) | Gemini grounding [S10], AI SDK Sources [S2], Claude artifacts [S9] |
| **Errors are prose-only** (§2.3). | `store.ts:21-33`; `console.tsx:1347-1351` | Stripe/OpenAI/Postgres-grade APIs (not chat products, but the bar for our error surface) |
| **No parallel/background sessions, no side chats.** Single project, single run loop, busy latch forbids overlap (`console.tsx:632`). | one `busyAction` (`console.tsx:474`) | Hermes subagents [S20], Claude Code side chats/parallel sessions [S12], Copilot subagents [S7], Codex cloud sessions [S21] |

### 3.3 What RapidTool can do better than all four — project grounding (the moat)

None of Hermes, Codex, Claude Code, Copilot, or Gemini CLI is grounded in a **governed, deterministic pipeline** with a machine-readable phase machine. RapidTool's chat will be able to answer questions those products *cannot even parse*, because the answer requires state only RapidTool holds:

1. **"Why are we parked here?"** — the chat reads `project.hitl` (stakes/title/prompt, `console.tsx:1886-1888`), the evidence bundle `evidenceForGate` (`console.tsx:139-191`), the latest autopilot denial (`detail: "P<n> unmet: <ids>"`, `console.tsx:1976-1981`) and rejection-guidance artifact (`console.tsx:1983-2009`), then explains in one grounded paragraph with chips. Codex/Claude see a git repo; they do not see gate verdicts, evidence hashes, or HITL stakes. Claude Code's "auto memory" is *learned*, ours is *structured* (memory rows with `kind · P<phase> · score`, `console.tsx:1628-1636`).
2. **"What happens if I approve/reject?"** — the chat knows the *next* phase contract from `PHASES`/`project.currentPhase` (`console.tsx:583, 1054-1058`), DoD exit criteria, and the decision ledger (`project.decisions`, `console.tsx:1641-1668`). It can draft the 12+ char rejection note that actually steers regeneration (`console.tsx:1911-1923`) — a task every competitor leaves entirely to the human.
3. **"Show me the unmet DoD for P4."** — machine-checkable seams already exist: `ingestReport` returns `gate_unmet?: string[]` (`store.ts:76-77`), denial logs carry unmet ids (`console.tsx:1977-1978`), `approvalHealth`/`DOD` are imported (`console.tsx:32-33`). The chat renders these as a table + one-line fixes, *then offers* "Run the phase again" (deterministic `executeAsync`, `console.tsx:638`).
4. **Answers that never drift from state.** Because the chat composes context from the live project slice each turn (§1.5), it cannot describe a stale phase status — the same guarantee the rest of the console already enforces (`rec = project?.phases[project.currentPhase]`, `console.tsx:583`; store `refreshPacket` on copy, `console.tsx:790-793`).
5. **Actions, not just answers.** Every chip calls the *same* store functions the buttons call (`executeAsync`, `runUntilHitlAsync`, `approve`, `rejectAsync`, `ingestReport`, `console.tsx:446-468`) — so the chat inherits the UI-4 busy latch, the HITL force-override rule (`console.tsx:1873-1879`), and the honesty contract for free. No competitor chat can *execute the governed pipeline*; the best they can do is edit files and hope.
6. **Governance-native transcripts.** Chat turns can themselves be recorded as project artifacts (reuse the `ingestReport` seam, `console.tsx:694-711`) or memory rows — i.e., the conversation becomes part of the audit trail, exactly like gate decisions. None of the four products has an audit-trail concept at all (closest: Claude Code checkpoints [S12] and Hermes session memory [S20], neither is a *governance ledger*).

### 3.4 Honest limitations (so the spec does not over-promise)

- RapidTool is **client-side + localStorage, advisory-LLM, deterministic engine** (honesty contract, `AGENT_GUIDE.md §4-5`): the chat is *advisory like the crew* — DoD gates keep ruling; the chat can propose an approve but the human presses it (mirror `console.tsx:1134-1145`'s crew disclaimer and `store.ts` guard pattern).
- With **no `DEEPSEEK_API_KEY`** the chat must degrade honestly to "not configured" (`llmStatus.configured` drives the Spawn-crew button today, `console.tsx:1134-1135`; same gate applies to the Chat tab), while chips/grounding/FAQ remain fully functional.
- No OS sandbox, no deployment, no multi-device sync (export/import JSON is the handoff path, `AGENT_GUIDE.md §4`) — the chat inherits those boundaries.
- Streaming adds latency/UX complexity the crew flow never had; the spec (§4.2) scopes v1 to text-only streaming of the existing DeepSeek endpoint (`deepseek.server.ts:174`) — no tool-calling loop inside the chat in v1 (tool *calls* happen via chips → store functions).

---

## 4. Concrete Chat-tab UX spec (all anchors verified 2026-09-06)

### 4.0 Summary of the change

Add a ninth tab, `"chat"`, to `RunTab` (`console.tsx:91`) — present for every non-archived project, next to Artifacts. The tab hosts a project-grounded assistant: streamed markdown replies (reusing `MarkdownBody`), state-derived quick-action chips, `RT_E_*` error badges, a "Grounded in" citation footer per message, and per-project history in localStorage. Advisory-only: it never calls `approve`/`execute` without the same human confirmation the buttons require; all mutations go through existing store actions.

### 4.1 Layout & placement

- `RunTab` union gains `"chat"` (`console.tsx:91`); add a trigger after `Artifacts` in `Tabs.List` (`console.tsx:1423-1475`) and update the `aria-label` at `console.tsx:1424` ("…, chat, vault, …").
- Panel: `<Tabs.Content value="chat" forceMount className="data-[state=inactive]:hidden">` following the established pattern (`console.tsx:1477-1478`) — **forceMount is load-bearing**: the comment at `1477` already anticipates "future live streams survive tab switches," so the stream keeps flowing while the user glances at the Artifacts tab.
- Grid: the chat needs width. Two options — (a) render inside the center column like every other tab (3-col grid `console.tsx:1033` stays); (b) v2 option: widen by letting the Chat panel span the aside (the aside's Notes/Memory/Gate-log/diagnostics, `console.tsx:1612-1695`, are exactly the context the chat cites; keep them visible on the right as the "evidence rail"). Spec v1 = (a); keep (b) as a stretch goal.

### 4.2 Transcript, streaming, and message parts

**State (new `ChatPane` component, sibling of `VaultPane` at `console.tsx:2392` / `DesignPane` at `2994`):**
```ts
type ChatTurn = {
  id: string; role: "user" | "assistant";
  parts: ChatPart[];            // text deltas accumulate into the last text part
  status: "done" | "streaming" | "error" | "stopped";
  errorCode?: RtErrorCode;      // RT_E_LLM_* on failure (§2.3)
  groundedIn: GroundingRef[];   // artifact/phase/log chips (§4.5)
  ts: number;
};
```
Modeled on `useChat`'s typed parts [S1][S3] and the existing `CrewMsgView` (`console.tsx:94-112`) / crew transcript renderer (`console.tsx:1237-1258`) for the visual shell.

**Wire path:** client `chatRequest(turn)` → existing server-function seam used by `runCrew` (`src/lib/crew.ts:4-6` wrapper pattern → `crew.server.ts`) → DeepSeek `/chat/completions` with `stream:true` (endpoint verified at `deepseek.server.ts:174`; today `stream:false` at `:170`; key stays server-side per `deepseek.server.ts:1-16`). Client consumes the fetch body with a `ReadableStream` reader (SSE rationale [S4]), appending token deltas to the in-flight assistant turn; abort via `AbortController` mirrors the existing timeout pattern (`deepseek.server.ts:178-181`).

**UI rules (borrowed from the console's own conventions):**
- Streaming indicator: reuse the pulsing-dot motif (`console.tsx:1125-1128`) + an explicit **Stop** button while `status === "streaming"`; **Regenerate** on the last assistant turn (resend last user message) — `useChat` semantics [S1].
- Assistant text renders through `MarkdownBody` (`console.tsx:2157-2263`) so code fences get the language-caption treatment (`console.tsx:2235-2239`) for free; add a small copy button per code block later (same `flashCopied` pattern as packet copy, `console.tsx:623-629, 1146-1153`).
- User turns echo as plain pre-wrap text (same styling as crew messages, `console.tsx:1249-1251`).
- Disable the composer + chips while `busyRef.current` is true for *any* engine action (`busyAction !== null`, `console.tsx:474`) — one busy latch for the whole run loop, consistent with UI-4 (`console.tsx:632`).

### 4.3 Error-code badges inside chat (and console-wide later)

- When a turn (or a chip action) fails, show under the failure: mono badge `RT_E_LLM_0402` in `text-danger`, the existing `role="alert"` paragraph style (`console.tsx:1347-1351`), a one-line "what to do" from the registry (§2.3), and a link to the registry row (Stripe `doc_url` pattern [S13]).
- Chat prompt contract: the system prompt includes the error registry (§2.3) so the assistant can answer "what does RT_E_GATE_0101 mean here?" grounded in code + live state — Postgres's "structured fields, not prose" rule [S18] is what makes this answer deterministic.
- Chip actions map their failures: e.g. "Approve" chip → `RT_E_GATE_0102` (needs `forceHuman` override, `console.tsx:1873-1879`), note-too-short → `RT_E_HITL_0301` (`console.tsx:1948`), engine failure mid-run → `RT_E_ENGINE_0201` (`store.ts:23-29`).

### 4.4 Quick-action chips (state-derived, deterministic — §1.3)

Chip row sits above the composer. Derivation from live project state, one chip set per state (the console already branches on these states at `console.tsx:1066-1132`):

| Project state | Chips (label → action → store fn anchor) |
|---|---|
| Running (`rec.status === "running"` / `busyAction`) | none — disabled; show pulse (`console.tsx:585, 1123-1131`) |
| Ready / current phase | **Run phase** → `executeAsync` (`console.tsx:631-644`); **Run to next gate** → `runUntilHitlAsync` (`console.tsx:663-676`); **Why this phase?** → grounded explanation from `PHASES[project.currentPhase]` record (`console.tsx:1054-1063`) |
| HITL parked (`project.hitl`) | **Explain gate failure** → reads `evidenceForGate` (`console.tsx:139-191`) + denial log (`console.tsx:1955-1965`) + guidance artifact (`console.tsx:1998-2009`); **Show unmet DoD** → `gate_unmet` seams (`store.ts:76-77`, denial `detail` `console.tsx:1977-1978`); **Draft rejection note** → proposes ≥12-char note (`console.tsx:1911-1923`) with the rejection-history constraints |
| Blocked (`project.status === "blocked"`, `console.tsx:1066`) | **Why blocked?** (last rejection note `console.tsx:1076-1080` + guidance `console.tsx:1998-2009`); **Retry with my note** → drafts note → human presses Retry (`console.tsx:1070-1075`) |
| Complete (`console.tsx:1088-1092`) | **Summarize delivery** (scorecard `console.tsx:1789`, packet tail); **Export/JSON** hints (`console.tsx:1180-1195`) |
| Always | **Ask about memory** (memory rows `console.tsx:1625-1640`, vault tab `console.tsx:2392`); **Recent gate log** (`console.tsx:1641-1668`); **Diagnostics tail** (`console.tsx:1671-1684`) |

Chip = button styled like hero buttons (`console.tsx:1095-1112`); click either (a) executes a store action and reports the result in-chat (with `RT_E_*` on failure), or (b) inserts a *prefilled user prompt* and submits — deterministic, unit-testable, no model call needed to *render* the chip. Keyboard: chips are reachable via existing shortcut conventions (`console.tsx:517-581`); suggest `Ctrl+Shift+Enter`-style composer submit and keep single-key letters untouched.

### 4.5 Grounding footer ("Grounded in" citations) — §1.5 pattern

Each assistant turn carries `groundedIn: GroundingRef[]`; the context assembler records which slices it passed to the model:
- `{ type: "artifact", id, title, phase }` — from the artifacts list (`console.tsx:584-598`) → chip jumps to Artifacts tab and selects it (`setSelected`, `console.tsx:479, 596-597`).
- `{ type: "phase", phase, status }` — opens `PhaseRecordView` via `setViewPhase` (`console.tsx:484, 1036-1037, 1043-1050`; component at `3543`).
- `{ type: "decision" | "log" }` — highlights the aside rail row (`console.tsx:1641-1684`).
- `{ type: "memory", id }` — vault/memory (`console.tsx:1625-1640`; `VaultPane` `2392`).

Render as a muted `<details>` ("Grounded in · 4 refs") under the message, styled after the evidence `<details>` in `HitlDock` (`console.tsx:1889-1910`). This is Gemini-citation honesty [S10] applied to project objects, and it enforces the no-hallucination culture: if the assistant cites nothing, the footer says "deterministic answer — no project slices read" (advisory-only reasoning can be purely conversational).

### 4.6 History & persistence

- Per-project transcript persisted to localStorage keyed by project id, alongside `project.notes` (`console.tsx:1616-1623`); prune to last ~50 turns with a "Clear chat" action (context-engineering hygiene [S11]).
- A **Compact** toggle: strip transcripts to the last N turns + summary before *copy/export* so the JSON stays lean (`exportProjectJson`, `console.tsx:1180-1187`) — v1 does **not** put chat history inside the project JSON (keeps `report-intake`/packet schema untouched); revisit with `PACKET_VERSION` bump (`packet.ts:12`, System JSON envelope `packet.ts:193-201`).
- "Saved to this browser only" caption matches the console convention (`console.tsx:1289-1291`).

### 4.7 Honesty & accessibility (non-negotiables from existing code)

- Assistant banner: "Advisory — DoD gates keep ruling," mirroring the crew disclaimer tone (`console.tsx:714-717` comment, `1134-1145` button title) and the guidance-artifact footnote ("advisory — deterministic deltas on regeneration may differ", `console.tsx:2003-2004`).
- No LLM configured → composer disabled with the exact honest line the crew uses ("no LLM backend configured — the deterministic engine stands", `console.tsx:776-777`); chips + "ask about state" deterministic answers still work.
- Streamed content region: `aria-live="polite"`; errors `role="alert"` (console precedent `console.tsx:1347-1356`); `aria-busy` on the pane while streaming (`console.tsx:1041` precedent).
- Never render model HTML; only `MarkdownBody`-safe paths (`console.tsx:2150-2155`).

### 4.8 Anchors table (every file:line cited in this spec, verified)

| Anchor | Verified content |
|---|---|
| `console.tsx:91` | `RunTab` union (8 tabs today — chat is #9) |
| `console.tsx:94-112` | `CrewMsgView` / `CrewRunView` (chat-part modeling reference) |
| `console.tsx:139-191` | `evidenceForGate` — HITL evidence bundle the chat explains |
| `console.tsx:446-468` | `useRapid()` store surface: `approve, rejectAsync, retry, executeAsync, runUntilHitlAsync, runModuleReal, ingestReport, llmStatus, researchStatus, autopilot` |
| `console.tsx:470-496` | RunScreen state: `error/notice/busyAction/tab/…` |
| `console.tsx:517-581` | Global shortcuts (Ctrl+Enter run, e/g/a/r, `/` search, `?` guide) — new chat shortcuts must not collide |
| `console.tsx:583-604` | `rec` = current phase record; artifact list + search/filter memos |
| `console.tsx:631-644` | `run()` → `executeAsync`, busy `"step"`, error surface pattern |
| `console.tsx:646-661` | `onApprove` / `onReject` (12-char note enforced at `1948`) |
| `console.tsx:663-676` | `runUntil()` → `runUntilHitlAsync` |
| `console.tsx:694-711` | `onIngestReport` — the governed intake seam chat artifacts could reuse |
| `console.tsx:718-788` | `onSpawnCrew` — advisory LLM flow + honest not-configured message |
| `console.tsx:776-777` | "no LLM backend configured" honest line (reuse for chat) |
| `console.tsx:1033` | 3-col grid `[240px_minmax(0,1fr)_300px]` |
| `console.tsx:1054-1063` | Current-phase hero (code/status/title/summary/brief) |
| `console.tsx:1066-1132` | State branch: blocked / HITL chip / complete / run buttons + running pulse |
| `console.tsx:1134-1145` | Spawn-crew gated on `llmStatus.configured` (chat uses same gate) |
| `console.tsx:1221-1260` | Crew transcript panel (visual shell for chat turns) |
| `console.tsx:1347-1356` | `role="alert"` error + `role="status"` notice patterns |
| `console.tsx:1411-1420` | `HitlDock` sits above tabs — chat may also surface pending-gate CTA here later |
| `console.tsx:1422-1475` | `Tabs.Root/List` + triggers; `aria-label` at `1424` |
| `console.tsx:1477-1478` | `forceMount` + `data-[state=inactive]:hidden` (stream survives tab switches) |
| `console.tsx:1521-1535` | Packet tab: `MarkdownBody` in `max-h-[480px]` scroll region (chat reply container pattern) |
| `console.tsx:1612-1695` | Right aside: Notes `1614-1623`, Memory `1625-1640`, Gate log `1641-1668`, `GateHealthCard` `1669`, Diagnostics `1671-1684` |
| `console.tsx:1854-1968` | `HitlDock` — stakes/title/prompt `1886-1888`, evidence `<details>` `1889-1910`, force-override `1873-1879, 1924-1934`, approve/reject `1936-1953` |
| `console.tsx:1976-1981` | `latestAutopilotDenial` — `autopilot.gate_denied`, `detail "P<n> unmet: <ids>"` |
| `console.tsx:1983-2009` | `latestRejectionGuidance` + `BlockedGuidanceBlock` ("Rejection guidance (LLM)") |
| `console.tsx:2113-2148` | `MdBlock` / `mdBlocksOf` (renderer contract, defensive folding) |
| `console.tsx:2157-2263` | `MarkdownBody` — safe React markdown, fence captions `2229-2245`, raw fallback `2159-2166` |
| `console.tsx:2392, 2994, 3293, 3543, 3653, 3673` | `VaultPane`, `DesignPane`, `DiagramPane`, `PhaseRecordView`, `StatusChip`, `GateHealthCard` |
| `store.ts:21-33` | `ApproveResult` / `RunResult` / `ImportProjectResult` — `{ ok:false; error:string }` unions to extend with `code/ctx` (§2.3) |
| `store.ts:55-80` | `RapidState` — incl. `execute`, `runUntilHitl`, `approve`, `reject`, `ingestReport` with `gate_unmet?: string[]` (`76-77`), `llmStatus`, `refreshStatuses` |
| `deepseek.server.ts:1-16, 163-185` | Server-side key boundary; body builder (`stream:false` at `170`); `/chat/completions` `174`; abort/timeout `178-181`; empty-content handling `185-195` |
| `crew.ts:4-6` | Client-wrapper-over-server module pattern (chat server seam follows it) |
| `packet.ts:193-201` | `## System JSON (machine-readable)` — future home for `rt_error_codes` block (§2.3) |

### 4.9 Build order, risks, tests

**Build order:** (1) `RT_E_*` registry + envelope fields in `store.ts` result unions + badge component (pure, testable first); (2) `ChatPane` shell: tab trigger, transcript state machine, composer, history persistence, deterministic chips with prefilled prompts (no model calls yet); (3) streaming seam: `stream:true` server function + reader loop + Stop/Regenerate; (4) grounding assembler + footer; (5) error-badge wiring on chip actions. Each step is shippable alone and honest without a key.

**Risks:** busy-latch contention (chips must respect `busyRef`/`busyAction`, `console.tsx:474-475`); forceMount memory growth (prune history, §4.6); stale grounding when project changes mid-stream (snapshot the grounding refs at send time, re-verify chips at render time via `project` — the store is the single source, `console.tsx:469`); DeepSeek `stream:true` response shape differs from `json` mode (reuse `describeError`, `deepseek.server.ts:186-187`); never let the chat mutate project state except through store actions (keeps `approve`/`execute` guards and the honesty contract intact).

**Tests:** unit — chip-state derivation table (state → chips) for all `project.status`/`rec.status` combos; registry completeness (every `setError`/`{ok:false}` site in console.tsx maps to a code); part-state machine (delta append, stop, error); persistence round-trip. Integration — `node --experimental-strip-types --test src/lib/*.test.ts` pattern (`17_agent_ux_review.md:26`); UI via the existing Playwright conventions if the harness runs it.

---

## 5. Sources (all fetched 2026-09-06; title = what this doc used them for)

- [S1] Vercel AI SDK — `useChat` reference. https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat — streaming state machine, transport default `/api/chat`, regenerate/reconnect params, messages state.
- [S2] Vercel AI SDK — Chatbot guide (incl. Sources part, persistence, resume-streams, tool usage pages in nav). https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
- [S3] Vercel AI SDK — Stream Protocols (typed parts: text/start-step/finish-step/tool-output/finish-message/abort). https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
- [S4] MDN — Server-sent events (server push vs request/response; EventSource). https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- [S5] Anthropic — Claude Code docs: Desktop application (parallel Git-isolated sessions, side chats, panes, terminal/file editor, previews, diff review, PR monitoring). https://code.claude.com/docs/en/desktop
- [S6] Anthropic — Claude Code docs: Interactive mode (transcript viewer, task list, session recap, voice input, prompt suggestions incl. Tab-to-accept, skip-after-error rules). https://code.claude.com/docs/en/interactive-mode
- [S7] GitHub Docs — Asking GitHub Copilot questions in your IDE (Ask/Agent/Plan mode dropdown, subagents with isolated context, streaming edits, self-correction). https://docs.github.com/en/copilot/using-github-copilot/asking-github-copilot-questions-in-your-ide
- [S8] Claude Help Center — Publish and share artifacts (versions, publish/share/embed, remix, Artifacts sidebar section). https://support.claude.com/en/articles/9547008-publish-and-share-artifacts
- [S9] Anthropic — Claude Code docs: Artifacts (live interactive pages that update in place; "easier to look at than to read"). https://code.claude.com/docs/en/artifacts
- [S10] Google AI for Developers — Grounding with Google Search (citations, verifiable sources, reduce hallucination; grounding metadata for inline citation UI). https://ai.google.dev/gemini-api/docs/google-search
- [S11] Anthropic Engineering — Effective context engineering for AI agents (context as finite resource, cyclic curation, context rot). https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- [S12] Anthropic — Claude Code docs: Checkpointing (track/rewind/summarize edits and conversation). https://code.claude.com/docs/en/checkpointing (via llms.txt index of code.claude.com/docs/llms.txt, fetched)
- [S13] Stripe Docs — Errors (API reference; error object with `code`, `doc_url`, `decline_code`; open vs closed enums). https://docs.stripe.com/api/errors
- [S14] Stripe Docs — Error codes (canonical per-code table; doc_url links into it). https://docs.stripe.com/error-codes
- [S15] Stripe Docs — Handle errors (type classes: invalid request, connection, API, authentication, idempotency, permission, rate limit, signature verification). https://docs.stripe.com/error-handling
- [S16] OpenAI — Error codes guide (typed SDK exceptions: `APIConnectionError`, `RateLimitError`, `APIError` with status). https://developers.openai.com/api/docs/guides/error-codes
- [S17] OpenAI Developer Community — Where to find all values of error type? (legacy JSON envelope `{error:{message,type,param,code}}` reproduced; secondary source for the envelope shape). https://community.openai.com/t/where-to-find-all-values-of-error-type/158707
- [S18] PostgreSQL Docs — Appendix A: Error codes (SQLSTATE five-char class/condition grammar; test code not message; stability vs localization; structured object-name fields). https://www.postgresql.org/docs/current/errcodes-appendix.html
- [S19] Microsoft Learn — Common HRESULT values (32-bit hex, symbolic names over raw values, Winerror.h registry). https://learn.microsoft.com/en-us/windows/win32/seccrypto/common-hresult-values
- [S20] Nous Research — Hermes Agent documentation (autonomous agent positioning, persistent memory, skills/learning loop, subagents, 60+ tools, MCP, voice, messaging gateways). https://hermes-agent.nousresearch.com/docs
- [S21] OpenAI — Codex CLI README (local coding agent; CLI/IDE/desktop/cloud surfaces; ChatGPT-plan or API-key auth). https://raw.githubusercontent.com/openai/codex/main/README.md
- [S22] Anthropic — Claude Code docs: Overview (multi-surface agentic coding tool; CLAUDE.md + auto memory; features index). https://code.claude.com/docs/en/overview
- [S23] Google — Gemini CLI README (terminal agent; Google Search grounding tool, file ops, shell, web fetch, MCP, free tier, non-interactive mode). https://raw.githubusercontent.com/google-gemini/gemini-cli/main/README.md
- [S24] Google AI for Developers — Structured outputs (JSON Schema `responseSchema`, streaming results, vs function calling). https://ai.google.dev/gemini-api/docs/structured-output

*Repo-local cross-references (read this pass): `research/multiagent/17_agent_ux_review.md` (machine-contract glossary `:9-27`), `AGENT_GUIDE.md` (§4 feedback loop, §5 honesty boundaries). No source file was modified.*
