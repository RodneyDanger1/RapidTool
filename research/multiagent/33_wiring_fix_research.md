# 33 · Wiring-Fix Research — keyless harvest, advisory CLI verbs, chat-history hygiene, provenance lines, bounded watch daemons (+ live corrections for Pro fixers A/B)

**Author:** Flash helper **F1** (fix-pattern research) · **Date:** 2026-09-06 (run ~09:26–09:45)
**Role:** strictly **read-only** on source; this file is the only artifact written.
**Consumers:** PRO fixer A (deleg task-0: `harvest.ts` + new-pillar CLI wiring) and PRO fixer B (deleg task-1: chat P2s + CLI error-object classification + Wild `RT_E_*` codes) — both running **right now**; live-correction notes in §6.
**Honesty pledge:** every external source below was fetched **this pass** (web_extract / curl, 2026-09-06); nothing cited from memory. Local anchors were re-verified on disk this pass; drift vs. earlier dossiers is logged in §6.3. One prior-wave source group (Claude Code CLI ref, AI SDK `useChat`, Node `fs.watch`, chokidar, watchman, inotify, Litestream) was fetched the same day in `32_fix_research.md` [S1/S8/S9/S13–S17] — cross-referenced rather than re-fetched, flagged as such in §7.

Deliverable map (who should use which section):

| § | Topic | Primary consumer | Dossier anchor |
|---|---|---|---|
| 1 | Keyless GitHub code harvesting (query-shaping, rate-limit honesty, license attribution) | **A** — `src/lib/harvest.ts` + tests | 29 ledger B1 row (:16, :35), 26 (:97, :158-159, :169), this-pass reads of `websearch.server.ts`/`research.ts` |
| 2 | CLI subcommand design: one-JSON envelopes, advisory-vs-mutation | **A** (new verbs) + **B** (error arm) | README-cli.md :279-301 (verified), `swarm.ts` header (:1-30 verified), 26 (:38) |
| 3 | Chat-history hygiene: display log ≠ sent history | **B** (F2 failed-send leak) | 28 F2 (:47-50), 24 §2, this-pass `console.tsx:64-65/:4317` |
| 4 | Provenance + freshness lines in grounded copilots | **B** (provenance P2, F4 lastGate) | 24 §1.4/§5.2/§6, 28 F4/F9, `chat.server.ts` consts (verified) |
| 5 | Bounded `fs.watch` CLI daemons | **A** (a `watch`-style verb is optional in scope) | 26 G7 (:94, :230), 32 §6 (S13–S17), `watcher.ts` (verified) |
| 6 | **Live corrections for Pro A/B** (dated; they poll this file) | A + B | their logs `deleg_e9738dc8/task-{0,1}.log` |

---

## 1 · Keyless GitHub code harvesting — design evidence for `harvest.ts` (Pillar 1+8)

### 1.1 The seam harvest must fit (verified on disk this pass)

- 29 ledger B1 row: harvest = **"research-row shape"**, `research.ts` **additive** wiring → packet/engine consumers; prior B1 cap-died pre-write (`fixes/62_pillars_harvest.md` never landed; `references/harvest-pillar-recon.md` is **not on disk** — design contract must be reconstructed from the ledger + seams below).
- 26:169 lists the intended headless export: `harvestForPacket` passthrough "(AFTER harvest lands)". 26:158-159: harvest is **UNWIRED + FILE ABSENT** today.
- **Keyless precedent already in the tree:** `freeWebSearch(query, opts) → Promise<ResearchResult>` in `src/lib/websearch.server.ts` (verified :305-330): honest header ("free, keyless, best-effort sources…"), UA string at :44, `FreeSearchOptions { maxResults?, timeoutMs?, attempts?, backoffMs? }` (verified :64-70) — retry/backoff knobs are the house idiom.
- **Bare-Node constraint (Pro A already caught it at 09:27:42):** `research()` (`research.ts:64`) is a TanStack `createServerFn` wrapper — it fails under bare Node, which is where the CLI lives. Harvest must call the keyless seam **directly** (dynamic `import("./websearch.server.ts")` in headless style, mirroring `runCrew`'s lazy import at `headless.ts:~904`) or be pure-typed with a `.server.ts` live twin.
- Row shapes to stay additive to: `ResearchItem { title; url; content; score? }` (`research.ts:14-18`) and the `ResearchResult` ok/`{ok:false, reason, code, error}` union (`research.ts:30-43`) — harvest rows should be a **superset** of `ResearchItem` (extra provenance/license fields) so existing consumers keep compiling.
- House honesty-header voice to copy: `swarm.ts:1-30` ("No network I/O … never mutate", "Everything is advisory").

### 1.2 What the field proves (all fetched this pass)

**(a) GitHub's own code-search is NOT available keyless — this is the load-bearing fact.**
- REST search docs: *"The [Search code] endpoint requires you to authenticate and limits you to 10 requests per minute. For unauthenticated requests, the rate limit allows you to make up to 10 requests per minute."* [S1] — i.e. unauthenticated search exists for non-code endpoints (repos/users) at 10/min, but **code search is auth-only**. Also: max "**up to 1,000 results for each search**"; queries longer than **256 characters** or with **more than five `AND`/`OR`/`NOT` operators** return "Validation failed"; timed-out queries return partial matches with `incomplete_results: true` [S1].
- UI code search has the same wall: *"You must be signed into a personal account on GitHub to search for code across all public repositories."* — and only the **default branch** is indexed, files **< 384 KB**, archived repos excluded, a bare `language:…` query is invalid (a search term is required unless `filename:` is used) [S2].
- **Consequence:** `harvest.ts` must treat code *discovery* and code *fetching* as separate keyless channels, and must be honest in its envelope when a channel is unavailable.

**(b) Query-shaping rules that transfer to any keyless channel.**
- Legacy code-search qualifiers (the only ones that work for code): `in:file / in:path / in:file,path`, `user:`, `org:`, `repo:`, `path:`, `language:`, `extension:`, `filename:`, `fork:`, `size:` — *"Search qualifiers specifically for repositories, users, or commits, will not work when searching for code."* [S2]. Examples verified on the page: `form path:cgi-bin extension:pm`, `filename:test_helper path:test language:ruby`.
- Query budget: ≤256 chars incl. qualifier values, ≤5 boolean operators, one required search term — same rules to enforce client-side before any network call (mirrors `research.ts`'s empty-query guard idiom, `research.ts:72-83`).

**(c) Keyless raw-file fetching: pin a ref, use a caching CDN.**
- jsDelivr GitHub CDN (README fetched this pass): URL form **`https://cdn.jsdelivr.net/gh/user/repo@version/file`** where version = *"any GitHub release, commit, or branch"* — a full commit hash is a valid pin (`/gh/jquery/jquery@32b00373…/dist/jquery.min.js`) [S3]. `@latest` *"falls back to the repository's default branch if there are no tagged releases"* and the README flags unpinned latest as *"not recommended for production usage"* → **harvest must pin `@<commit>` (or tag) and record the pin on the row**; `raw.githubusercontent.com/<owner>/<repo>/<commit>/<path>` is the direct alternative (no caching layer, no formal rate-limit doc — jsDelivr's permanent-S3 mirror is the citable, polite path: *"We use a permanent S3 storage to ensure all files remain available even if GitHub goes down or a repository or a release is deleted by its author"*; *"There are no bandwidth limits… and it's completely free to use"*; rate-limiting applies but is CDN-grade) [S3].
- **Live rate-limit honesty data point (this pass):** `grep.app` (the best-known keyless code index; homepage: *"search for code, files, and paths across a million GitHub repositories"*, © Vercel 2025 [S4]) returned **HTTP 429 + a "Vercel Security Checkpoint" HTML challenge to a plain `curl` from this machine** at 09:31 today. Conclusion for the module: keyless third-party indexes are **opportunistic, not load-bearing** — discovery may try repo-search REST (10/min unauth) + free web search (`freeWebSearch`, ddg/wikipedia/searxng — already in the tree) + known-path probes, and must surface `degraded: true` honestly instead of failing hard or scraping HTML.
- GitHub primary limits to budget against: *"The primary rate limit for unauthenticated requests is 60 requests per hour"* (per originating IP), 5,000/hr authenticated; search endpoints are the stricter 10/min bucket [S5]. Pattern: count every call, stop at a per-run budget, report `budget: { used, remaining }` in the envelope, never auto-retry past a 403/429 without backoff (house retry knobs already exist in `FreeSearchOptions`).

**(d) License attribution: detect, then carry the notice.**
- Detection tooling exists (`licensee` — GitHub's own gem: *"A Ruby Gem to detect under what license a project is distributed."*, description verified via the repos API this pass [S6]) but is a heavyweight Ruby dep — for a keyless harvester the documented shortcut is **probing for the license file at canonical paths** (`LICENSE`, `LICENSE.md`, `LICENSE.txt`, `COPYING`, `COPYING.md`…) at the pinned ref and classifying by SPDX short-identifier text.
- The obligation to carry is real and quotable — MIT (SPDX short id **`MIT`**, fetched from the SPDX list this pass): *"The above copyright notice and this permission notice … shall be included in all copies or substantial portions of the Software."* [S7] → every harvested row that will be copied into a generated artifact needs `license: "MIT"`-style SPDX id + the **copyright line** + source URL, so packet assembly can emit an attributions block without re-fetching.

### 1.3 RapidTool-shaped snippet (shape reference for `src/lib/harvest.ts` — keep `ResearchItem`/`ResearchResult` additive)

```ts
// Header honesty contract (swarm.ts voice): keyless by construction — this module
// NEVER calls api.github.com/search/code (auth-only per GitHub docs) and NEVER
// scrapes HTML. Discovery = repo-search REST (10/min unauth budget) + freeWebSearch
// + known-path probes; fetching = cdn.jsdelivr.net/gh/<owner>/<repo>@<commit>/<path>
// (pin a ref; never @latest). Advisory: returns rows; writes nothing, mutates nothing.

import type { ResearchItem } from "./research.ts";   // existing shape — do not edit
import type { ErrorCode } from "./errors.ts";

/** Harvest row = ResearchItem superset: provenance + license travel with the code. */
export type HarvestRow = ResearchItem & {
  repo: string;                 // "owner/repo"
  ref: string;                  // pinned commit (or tag) the file was fetched at
  path: string;                 // path inside the repo
  license?: { spdx: string; notice: string } | null; // null = unknown — never guess
  fetchedAt: string;            // ISO — freshness stamp (§4)
};

export type HarvestResult =
  | { ok: true; query: string; rows: HarvestRow[];
      degraded: boolean;        // true when a channel was rate-limited/unavailable
      budget: { used: number; remaining: number } }
  | { ok: false; reason: "error"; code: ErrorCode; error: string };

// shapeQuery: term + language/path intent -> ≤256-char qualifier query.
//   { term: "debounce watcher", lang: "ts" } ->
//   `debounce watcher language:typescript`   (validate: length, ≤5 booleans, term required)
// discover: optional unauth `GET /search/repositories?q=<shaped>&per_page=5`
//   guarded by a per-run REST budget (60/hr IP limit — count it, stop at budget);
//   on 403/429 -> { degraded: true, rows: [] } honest arm, never silent.
// fetchFile(owner, repo, commit, path): jsDelivr pin -> text + byte cap
// probeLicense(owner, repo, commit): canonical paths in order; classify by SPDX
//   short-id text match; keep the copyright line as `notice`.
// harvestForPacket(project, intent): the headless.ts:169 passthrough target — returns
//   rows already shaped for the packet's attribution appendix.
```

Acceptance shape (per 29 ledger: ≥12 tests, `node --experimental-strip-types --test`): query-shaping guard (256 chars/5 operators/empty term → `RT_E_VALIDATION`); budget exhaustion → `{ok:true, rows:[], degraded:true}` not a throw; jsDelivr URL builder pins the commit and refuses `@latest`; license probe returns `null` (never "MIT-guess") for an unknown file; `fetchFile` byte-cap truncation is honest (`content` truncated marker), not silent.

---

## 2 · CLI subcommand design for advisory tools — one-JSON envelopes, advisory-vs-mutation

### 2.1 Local contract (verified this pass)
- `scripts/rapidtool-cli.mjs` header + README-cli.md: every subcommand prints **one JSON object**; envelope carries `schema_version`, `cmd`, `exit_code`; failures add stable `RT_E_*` `code` (README-cli.md :16-18, :279-301). Exit taxonomy: 0 = executed+payload, 1 = could-not-execute, plus finer codes that *refine*, never replace (README :287-301).
- Advisory precedent in-tree: `crew` — README: *"its output is advisory"*, needs key, honest `{ok:false}` exit 1 when unconfigured (README-cli.md :162-177, :205). `swarm.ts` result carries `advisory: true` + `engineLinear: true` (verified :245-292).
- 26:38: 17 subcommands today, switch verified case-by-case (32 §8 has the case map; no `retry`, no harvest-family verbs).

### 2.2 What the field proves (fetched this pass)
- **The canonical advisory/mutation split is plan-vs-apply.** Terraform: *"The `terraform plan` command creates an execution plan, which lets you preview the changes"*; *"The plan command alone does not actually carry out the proposed changes"*; a plan run without `-out` produces a *"speculative plan, which is a description of the effect of the plan but without any intent to actually apply it"*; the two-step `plan -out=FILE` → `apply FILE` flow is *"primarily intended for … running Terraform in automation"* — apply still prompts/approves [S8].
- Machine-facing discipline (Claude Code `-p --output-format json`, one envelope per run, agents branch on structure) was fetched same-day in 32 [S1 — cross-ref §7].
- **Synthesis for the new verbs A is wiring** (`harvest/swarm/prompt/bench/mine/knowledge/wild`): nearly all of them are pure readers (Pillar modules are orphans today, 26 G7) → they belong to the **advisory family**: exit 0, `{ ok: true, advisory: true, … }`, **no project mutation possible through them**, and docs say so in the same sentence (crew precedent). Mutations (`knowledge add`, any `--apply` arm) are **separate verbs or explicit flags**; a verb that *would* mutate must never return `ok:true` pretending it did (32 §7.3 outcome-`noop` honesty applies).
- Errors keep traveling as **objects** to the classifier, not message strings — the exact seam B owns (32 §2; `errors.ts` fast-paths a carried `RT_E_*` `err.code`, verified `errors.ts:64-106` surface via grep this pass).

### 2.3 RapidTool-shaped snippet (target: `scripts/rapidtool-cli.mjs`, new case next to `crew`/`search`)

```js
// Advisory verbs share one skeleton: read → analyze → envelope; never write.
// (harvest/swarm/prompt/bench/mine/knowledge query arms = pure readers.)
case "harvest": {
  const p = loadProjectFor("harvest");          // existing helper (throws RT_E_PROJECT_MISSING path)
  const q = flags.query ?? argv._[1];
  if (!q) return respond({ ok: false, code: "RT_E_VALIDATION",
    error: "harvest needs a query: rapidtool harvest <intent> [--max N] [--lang ts]" }, 1);
  const res = await h.harvestForPacket(p, { query: q, max: flags.max ?? 5 });
  if (!res.ok) return respond({ ok: false, code: res.code ?? "RT_E_INTERNAL", error: res.error }, 1);
  // ADVISORY arm: rows are evidence for the packet/agent — nothing was written,
  // no gate, no phase. Envelope states it so agents never misread it as a mutation.
  return respond({ ok: true, advisory: true, path,
    query: res.query, rows: res.rows, degraded: res.degraded, budget: res.budget,
    summary: `${res.rows.length} row(s) harvested (${res.degraded ? "degraded: a channel was rate-limited" : "all channels nominal"})` }, 0);
}
// Mutation verbs keep the plan/apply shape (Terraform, S8):
//   rapidtool knowledge query <q>        -> advisory rows, exit 0
//   rapidtool knowledge add <json|file>  -> the ONLY arm that writes; validates first;
//     returns { ok:true, applied:true }  (or outcome:"noop" on identical fingerprint —
//     knowledge.ts ids are K+fnv1a content fingerprints, verified this pass)
// README-cli.md rows (A owns the file): label each verb "advisory — never mutates the
// project" vs the mutation arms, in the crew section's voice.
```

---

## 3 · Chat-history hygiene — display log vs sent history (B: F2 failed-send leak)

### 3.1 Local anchors (verified this pass)
- `console.tsx` defines its own structural `ChatTurn = { role: "user" | "assistant"; text: string }` (:64-65); `send()` builds model history at **`:4317 const history: ChatTurn[] = msgs…`** (drift note: 32 §3.1 said :4305-4307 — **verify at patch time**, file has moved).
- Failure rows are stored with `role: "assistant"` + `error: true` (28 F2, :47-50) → they leak into the next grounded call as copilot speech.
- Server-side caps verified: `CHAT_HISTORY_LIMIT = 6`, `CHAT_HISTORY_TURN_MAX_CHARS = 800`, `CHAT_USER_TEXT_MAX_CHARS = 4000`, `CHAT_CONTEXT_MAX_CHARS = 2500` (`chat.server.ts:41-50`).

### 3.2 What the field proves (fetched this pass)
- **Errors are hook-level state, never message content.** AI SDK UI error handling: every hook returns an `error` object *"to show an error message, disable the submit button, or show a retry button"* (with a generic "Something went wrong." recommended over leaking server detail) — the error is **not** a message in `messages` [S9].
- **Failed content is removed from the conversation, not labeled into it.** Same page, the "replace the failed message" pattern: *"you can write a custom submit handler that replaces the failed user message with new input. If the assistant response started streaming before the error, remove both the partial assistant response and its user message"* — implemented as `messages.slice(0, -2)` (or `-1` when the last row is the user's) before resending [S9]. Retry = re-send the *user's* turn, never replay the failed assistant text.
- **Display projection vs provider projection are different views.** Message Metadata docs: metadata is attached *"at the message level rather than being part of the message content"* — *"information about the message itself"* (timestamps, model info, token usage) [S10]. The AI SDK persistence guide stores the authoritative transcript **server-side** (client sends only the last message via `prepareSendMessagesRequest`; the server *"load[s] the previous messages and append[s] the new message"* and validates them) [S11] — i.e. the client's list is a view; what the model sees is rebuilt from the store by the caller.
- **Provider-side turn rules make replay of broken assistant turns a real failure mode.** Messages API: *"you always send the full conversational history to the API"*; synthetic `assistant` turns are legal [S12], but a turn that ended abnormally is not a completed assistant turn — the prefill example ends `stop_reason: "max_tokens"` mid-word ("The answer is ("), and the docs' stop-reasons page directs: *"Handle each `stop_reason` value and decide what to do when a response ends"* [S12]. A stored `error:true`/partial row replayed as `role:"assistant"` content is exactly that: truncated content the model will treat as its own completed speech.

**Synthesis for RapidTool:** (a) keep the failure row in the **display** list (it is the record; F9 label fix: render "failed", never "copilot"); (b) the **sent** history is a separate projection: drop `error` rows, drop partial/empty assistant texts, take the last N real turns, ensure roles alternate and the final turn is the user's; (c) retry re-sends the last *user* text (24 FC-11 Retry button already spec'd; `send(promptOverride)` mechanism exists at console.tsx ~4419).

### 3.3 RapidTool-shaped snippet

```ts
// Pure helper (28 F2(b): home it next to the ChatTurn type, console.tsx:64 or chat.ts).
// Model-visible history = last 12 REAL turns, ordered; failure/partial rows excluded.
export function chatHistoryTurns(rows: readonly ChatMsgView[]): ChatTurn[] {
  const real = rows.filter((m) => !m.error && (!m.partial) && m.text.trim().length > 0);
  const window = real.slice(-12);
  // Role-alternation guard (S12): a run of same-role rows collapses to the last one,
  // and the history handed to the provider must end with a USER turn — if the last
  // real turn is assistant (e.g. after a failed retry), drop it for the send.
  const out: ChatTurn[] = [];
  for (const m of window) {
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role) out.pop();       // keep provider alternation legal
    out.push({ role: m.role, text: m.text });
  }
  if (out.length && out[out.length - 1].role === "assistant") out.pop();
  return out;
}
// send() at console.tsx:4317 replaces `msgs.slice(-12).map(...)` with:
//   const history = chatHistoryTurns(msgs);
// Retry keeps AI-SDK semantics (S9): re-send the last USER text; the failed assistant
// row stays visible in the display list with an error label + Retry affordance (F9).
```

---

## 4 · Provenance + freshness lines in grounded copilots (B: provenance P2, lastGate F4)

### 4.1 Local anchors
- 24 dossier = the provenance spec B needs: **24_debug_chat_ux.md** §1.4 "staleness handling (snapshot → compare → disclose)", §5.2 stale-state answers (Air Canada failure mode), §6 fix-spec register. (B initially guessed `24_debug_lead.md` — wrong name; see §6.2.)
- `buildChatContext(project)` compacts deterministically ≤ 2500 chars and *"answers ONLY from it"* (`chat.server.ts:5, :87`); `COPILOT_SYSTEM_PROMPT` :53-56 admits when asked-out-of-context. No "as-of/context-built" stamp was found in `chat.server.ts` this pass (grep for provenance/fetchedAt/contextBuilt → empty) — the freshness line is **not landed**; B's provenance P2 has real work.
- UI: header renders `copilot · hh:mm` (console.tsx ~:4210 per 28 F9); console.tsx already has an E-07 provenance-label concept for `lastTest` (:129 comment: "optional; legacy payloads lack it") and a "never claims a provenance it cannot see" discipline (:142).

### 4.2 What the field proves (fetched this pass)
- **Grounded-answer contract + resolvable citations.** Vercel's RAG-citations guide: system prompt = *"Answer using only the sources provided. Cite sources by their `[id]` tag inline after each claim. If the sources do not contain the answer, say so."*; the model's `[id]` tags *"resolve against the exact sources retrieval returned, and those sources stream to the client with the message that cites them"* (rendered only when the id exists in the retrieved-sources map — no dangling links) [S13].
- **Structured citation metadata is part of the answer envelope.** Anthropic Citations: responses include claims + citations with exact locations (PDF page ranges 1-indexed; plain-text char ranges 0-indexed; block indices), and each document block carries optional `title` + `context`, with `context` explicitly recommended *"for storing document metadata as text or stringified JSON"* [S14] — i.e. provenance metadata rides beside content, exactly where RapidTool's chat rows should carry `fetchedAt`/source/phase refs.
- **Freshness is a push signal, not a re-ask.** MCP resources: every resource is *"uniquely identified by a URI"* with name/title/description metadata; servers may declare `subscribe` + `listChanged`, and *"servers that declared the `listChanged` capability SHOULD send a notification"* when the resource list changes — clients holding context get told it is stale [S15]. RapidTool analogue: the project snapshot backing `buildChatContext` changes between turns (gate records, memory rows) → the chat server knows the snapshot's build time; the copilot line must disclose it.
- **The dated-claim convention is per-statement, and the date is the source's date.** Wikipedia's "as of" guideline: *"Every individual, non-contiguous statement … that may date quickly should be so tagged"*, and *"The date used for a given statement should be the date of the most recent reliable source"* [S16]. For RapidTool: stamp the **context** ("built from project snapshot at <ts>"), stamp **claims about gate/verdict state** with their record time, and say *"no verdict yet"* explicitly when `lastGate` is stale/pending (F4) rather than echoing the previous verdict.

**Synthesis for B's provenance P2:** (1) `buildChatContext` output gets a first line: `Context: project <name> snapshot built <ISO-ts> · <N> memory rows · phase P<n> <status> — last gate verdict <ts | none yet>`; (2) the sent history and the display header surface the same stamp ("as of hh:mm:ss" beside the copilot label); (3) gate-state claims carry `(as of <ts>)` or the explicit none-yet form (F4); (4) metadata fields (not prose) for machine consumers — AI SDK metadata pattern (S10) and citation-`context` pattern (S14) both put this in structured fields.

### 4.3 RapidTool-shaped snippet

```ts
// chat.server.ts — buildChatContext(project) gains a first stamped line (keep ≤ cap):
//   `Context built ${new Date(now).toISOString()} from ${name} snapshot. ` +
//   `Phase P${p.currentPhase} ${statusOf(p)}. ` +
//   (lastGate ? `Last gate verdict: ${v} (${lastGateAt})` : "No gate verdict yet on this edge.")
// COPILOT_SYSTEM_PROMPT addition (24 §1.4 voice): "The context line carries its build
//   time. If the user asks about state that could have changed since it, say the state
//   is 'as of' that stamp and never guess the current value."
// console.tsx header (F9/F4): `copilot · as of ${stamp}` where stamp = the buildChatContext
//   timestamp the turn was answered from; when no answer exists yet for the pending gate:
//   render the lastGate line as "gate pending — no verdict" (never reuse the prior verdict).
```

---

## 5 · Bounded `fs.watch` CLI daemons (watcher.ts Pillar 7 is orphaned/opt-in; 26 :94, :230)

### 5.1 Local state (verified this pass)
- `src/lib/watcher.ts` already ships `startWatcher(dir, onChange, options): WatcherHandle` + `stopWatcher` + `watcherNotes`, one debounced batch per quiet window (800 ms), `PENDING_CAP = 200`, opt-in by design (header) — full overflow/reconcile gap analysis + fix shapes are in 32 §6 (S13–S17 fetched same day: Node inode/filename-null caveats, chokidar `atomic`/`awaitWriteFinish`/`usePolling`, watchman overflow→full rescan, inotify rebuild-on-race, Litestream gap→resnapshot). This section adds the **daemon** layer only.
- The reverse-handoff use case (agent writes files → orchestrator learns) means a CLI `watch` verb that stays up, bounded, and machine-readable.

### 5.2 What the field proves (fetched this pass)
- **Bound the daemon at the filter, before the debounce.** Watchexec's `--ignore`/`--filter` are *"matched against the path of a file affected by an event and include or exclude that event from triggering an action"*, matching over the **full absolute path** — with the classic trap documented: *"Ignoring a directory doesn't ignore files inside it, because the events will be delivered with the path for the files within, so you need to use a pattern like `*/foldername/**/*` instead"* [S17]. A bounded daemon = qualification filter first (path patterns + extension + size), then the bounded queue, then the debounce — never unbounded event capture with filtering later.
- Kernel/stream overrun ⇒ reconcile (watchman recrawl, inotify rebuild, Litestream resnapshot) — 32 §6 S15–S17 (fetched same day, cross-ref).
- Daemon ergonomics that keep it CLI-safe: stdout purity (JSON envelopes only on stdout; logs to stderr — matches README-cli.md purity contract), graceful stop on SIGINT/SIGTERM and stdin EOF, `--once`/`--watch` split (plan/apply shape from §2: `watch --once` = one bounded flush then exit 0).

### 5.3 RapidTool-shaped snippet (target: new `watch` case in `scripts/rapidtool-cli.mjs`, wrapping `watcher.ts`)

```js
case "watch": {
  const dir = resolve(flags.dir ?? ".");
  const w = h.startWatcher(dir, (changes) => {
    // ONE JSON envelope per debounced batch — stdout stays pure (README :279+):
    process.stdout.write(JSON.stringify({ ok: true, cmd: "watch", batch: true,
      at: new Date().toISOString(), changes, notes: h.watcherNotes() }) + "\n");
  }, { /* debounceMs, cap, ext filters — watcher.ts options */ });
  const stop = () => { h.stopWatcher(w); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  process.stdin.on("end", stop);              // EOF = clean daemon stop (CI pipes)
  // startWatcher throws when the dir cannot be watched -> catch -> respond(exit 1)
}
// Watch --once (bounded, CI-safe): startWatcher + a flush timer -> stop -> exit 0.
// Overflow discipline per 32 §6.3: cap-hit -> overflowed latch -> flush = full rescan
// batch (consumers treat it as reconcile, never as a silent gap).
```

---

## 6 · LIVE CORRECTIONS FOR PRO FIXERS A & B (dated 2026-09-06; transcripts read twice: ~09:27 and ~09:36)

Both logs are append-only under `…\hermes\cache\delegation\live\deleg_e9738dc8\task-{0,1}.log`. Observed through **09:31** (A) / **09:31** (B). Neither had written files yet at last read — these notes are for the **edit phase**; no dossiers were contradicted.

### 6.1 For PRO fixer A (task-0)
1. **09:26:06-07 — wrong-path probe, wrong inference.** `wc -l research/multiagent/63_pillars_swarm.md …` failed because **the pillar spec docs live in `fixes/`, not `research/multiagent/`**: `fixes/63_pillars_swarm.md`, `fixes/64_pillars_prompt.md`, `fixes/65_pillars_bench.md`, `fixes/66_pillars_mine.md` (verified on disk). Your 09:26:21 note "The pillar docs (63–66) don't exist" is a path artifact — **read them before wiring their modules**; `fixes/65_pillars_bench.md:75` even has "Exact export surface — compile against these". (There is no `fixes/62_pillars_harvest.md` anywhere — harvest was never landed, so its contract comes from 29 ledger + 26:169 + this file §1.)
2. **`references/harvest-pillar-recon.md` does not exist on disk** (verified by `find`, 09:34). Reconstruct the harvest contract from 29's B1 row (research-row shape; `research.ts` additive seam; `freeWebSearch`; ErrorCode reuse) + 26:169 (`harvestForPacket`) + §1 above.
3. **Keep `research()` out of bare-Node paths** — your 09:27:42 catch is correct and load-bearing: `research.ts:64` wraps a TanStack `createServerFn`. Use lazy `import("./websearch.server.ts")` → `freeWebSearch` directly (its own retry/backoff options are the house idiom).
4. **Baseline:** your `npx tsc --noEmit` at 09:31:15 was **EXIT 0** — preserve it; run it again after each edit chunk, plus the lib suite (`node --experimental-strip-types --test` on the files you touch + new `harvest.test.ts`, ≥12 tests per 29 ledger).
5. **Ownership overlap warning:** you and B both own `scripts/rapidtool-cli.mjs` (you: new `harvest/swarm/prompt/bench/mine/knowledge/wild` cases; B: error-object classification in `ensureErrorCodes`/`respond`). Your new cases must call `respond()` exactly as today and must **not** restructure the error arm B is editing — or you will collide mid-file. Coordinate via this file's §2/§6 and re-run the CLI smoke after both land.
6. `search_files`/rg cannot see this ROOT (space in path — see 6.2.1): keep using `terminal` grep/ls/find as you have been. Fine so far.

### 6.2 For PRO fixer B (task-1)
1. **09:26:04-08 — `search_files` is broken on this ROOT; don't retry it.** Both calls failed: `search_files(*24*)` returned 0 even though `24_debug_chat_ux.md` exists, and the regex search died with `rg: … RapidTool Main: The system cannot find the path specified. (os error 3)` — the **space in "RapidTool Main"** breaks rg's path handling. You recovered correctly with `terminal ls`; make that the rule for the rest of the run.
2. **09:25:55 — the provenance dossier is `24_debug_chat_ux.md`, not `24_debug_lead.md`** (you found it at 09:26:15 — good). The provenance P2 spec you need is 24 **§1.4** (snapshot → compare → disclose), **§5.2** (stale-state answers), **§6** (fix register) — plus 28 F4 (lastGate) and F9 (labels). See §4 above for the cited external patterns.
3. **Anchor drift — verify at patch time:** the history build line in `console.tsx` is now **`:4317`** (`const history: ChatTurn[] = msgs…`), not 32's `:4305-4307` — the file has shifted since H3's read (32 §8 warned). Also 32 §3.3's `chatHistoryTurns` helper idea is not yet landed (grep found only the local `ChatTurn` type at :64-65 and the build at :4317) — your F2 fix is greenfield; §3.3 above is shaped for it.
4. **Good drift-check instinct at 09:29:02** ("some fixes from the dossiers are already landed") — that matches 32 §8's post-dossier landings (store wild actions, parser floor). Re-check 32 §8 before re-applying anything from 23/28.
5. **Wild codes are safe to add additively** — your 09:30:33 check ("No wild pins exist in tests yet") was correct (grep of engine.test.ts/store.test.ts for wildStep/WildRunResult returned no pins). Keep `ERROR_CODES` additive (errors.ts:22 union) and note `wild-mode.server.ts` imports `llm.ts` (`complete`) + `errors.ts`-adjacent types — Wild result codes should reuse `codeError`/`CodedFailure` shapes (`errors.ts:42-45`).
6. **CLI error-object work + A's new verbs share `rapidtool-cli.mjs`** — patch the `ensureErrorCodes`/`respond` seam (32 §2.3) without moving the `switch` structure A is extending; re-run the CLI smoke after both land.

### 6.3 Anchor-drift / verification log (this pass)
- `console.tsx` ChatTurn :64-65 ✓; history build now **:4317** (32 said :4305-4307 — drifted).
- `chat.server.ts`: consts :41-50 ✓; no freshness/provenance stamp present (P2 open) ✓.
- `rapidtool-cli.mjs` respond() choke point + envelope header ✓ (read :1-40 this pass); README-cli.md exit taxonomy :279-301 ✓.
- `websearch.server.ts` freeWebSearch :305 ✓ (research.ts server-fn confirmed :64+).
- `errors.ts` surface (ERROR_CODES :22, ErrorCode :39, CodedFailure :42, codeError :45, classifyError :64) ✓ via export grep this pass.
- `swarm.ts` header advisory contract + SwarmPlanResult {ok, advisory:true, engineLinear:true} ✓.
- `watcher.ts` startWatcher/stopWatcher/watcherNotes header contract ✓.
- 29 ledger is the authoritative pillar ledger (B1 NOT-LANDED row at :16/:35) ✓; `fixes/63-66` exist ✓; `fixes/62` and `references/harvest-pillar-recon.md` do NOT ✓.
- Gates baseline: tsc EXIT 0 at 09:31:15 (A's run) — the bar both must hold.

---

## 7 · Sources (all fetched 2026-09-06 this pass unless noted; title = what this doc used them for)

- **[S1]** GitHub Docs — "REST API endpoints for search": code-search endpoint requires auth, 10 req/min (authed) vs 10 req/min unauthenticated (non-code search); 1,000-result cap; 256-char/5-operator query limits; `incomplete_results` on timeout; qualifier format. https://docs.github.com/en/rest/search/search
- **[S2]** GitHub Docs — "Searching code (legacy)": UI code search requires a signed-in account across public repos; code-only qualifier set (`in:/user:/org:/repo:/path:/language:/extension:/filename:/fork:`); default-branch-only index; <384 KB files; search term required. https://docs.github.com/en/search-github/searching-on-github/searching-code
- **[S3]** jsDelivr README (raw, `master`): `/gh/user/repo@version/file` incl. commit pins; @latest falls back to default branch (not for production); permanent S3 mirror + version fallback; free/no bandwidth limits; rate-limiting applies. https://raw.githubusercontent.com/jsdelivr/jsdelivr/master/README.md (mirror of the repo README)
- **[S4]** grep.app homepage (fetched): "search for code, files, and paths across a million GitHub repositories", © Vercel 2025. **Live API probe this pass → HTTP 429 Vercel Security Checkpoint** (curl, 09:31 CDT) — documented as unreliable-from-servers evidence, not a quote of intent. https://grep.app/
- **[S5]** GitHub Docs — "Rate limits for the REST API": unauthenticated primary limit **60 requests/hour** per originating IP; authenticated 5,000/hour; search bucket separate. https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- **[S6]** licensee repository metadata (GitHub repos API, fetched this pass): description "A Ruby Gem to detect under what license a project is distributed."; default branch `main`. https://api.github.com/repos/licensee/licensee
- **[S7]** SPDX — MIT License page: short identifier `MIT`; full text incl. the "above copyright notice and this permission notice … shall be included in all copies or substantial portions" condition. https://spdx.org/licenses/MIT.html
- **[S8]** Terraform CLI docs — `terraform plan` command: preview vs apply; "does not actually carry out the proposed changes"; speculative plan; `-out=FILE` two-step for automation. https://developer.hashicorp.com/terraform/cli/commands/plan
- **[S9]** AI SDK (Vercel) — "AI SDK UI: Error Handling" (v7): per-hook `error` object (message/disable/retry); generic user-facing message; "Alternative: replace the failed message" incl. `messages.slice(0,-2)` removal of partial assistant + user message. https://ai-sdk.dev/docs/ai-sdk-ui/error-handling
- **[S10]** AI SDK — "Message Metadata": message-level metadata for timestamps/model/token info; "information about the message itself" vs content data parts. https://ai-sdk.dev/docs/ai-sdk-ui/message-metadata
- **[S11]** AI SDK — "Chatbot Message Persistence": server-authoritative storage; client sends only the last message (`prepareSendMessagesRequest`); server reloads + appends + validates. https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
- **[S12]** Claude Platform docs — "Using the Messages API": stateless full-history calls; synthetic assistant messages allowed; `stop_reason` (`end_turn`/`max_tokens`/`refusal`); "Handle each stop_reason value and decide what to do when a response ends". https://platform.claude.com/docs/en/build-with-claude/working-with-messages
- **[S13]** Vercel KB — "Building an AI chat app with RAG and source citations": grounded system prompt ("answer using only the sources… cite by [id]… say so if absent"); citation resolution against retrieved sources; `source-url` parts streamed with the message. https://vercel.com/kb/guide/building-ai-chat-app-with-rag-and-citations-on-vercel
- **[S14]** Claude Platform docs — "Citations": document blocks with `title`/`context` metadata; per-claim citations with page/char/block indices; `cited_text`. https://docs.anthropic.com/en/docs/build-with-claude/citations
- **[S15]** Model Context Protocol spec (2025-06-18) — Resources: URI-identified context resources; `subscribe`/`listChanged` capabilities; `notifications/resources/list_changed` freshness push. https://modelcontextprotocol.io/specification/2025-06-18/server/resources
- **[S16]** Wikipedia — "Wikipedia:As of" guideline: dated-claim technique; tag every date-sensitive statement; date = most recent reliable source's date. https://en.wikipedia.org/wiki/Wikipedia:As_of
- **[S17]** Watchexec docs — glob/filter patterns: `--ignore`/`--filter` path-glob matching over full absolute paths; directory-ignore trap (`*/foldername/**/*`). https://watchexec.github.io/docs/
- **Cross-refs fetched earlier the same day in 32_fix_research.md (not re-fetched here):** Claude Code CLI reference (`-p --output-format json` etc.) = 32 [S1]; AI SDK `useChat` reference (per-message status, `regenerate`) = 32 [S8/S9]; Node.js `fs` watch caveats/inodes/null-filename = 32 [S13]; Chokidar README = 32 [S14]; Watchman recrawl = 32 [S15]; inotify(7) = 32 [S16]; Litestream = 32 [S17]. Verify quotes against 32 if reused verbatim.
