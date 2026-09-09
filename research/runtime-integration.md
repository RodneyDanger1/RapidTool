# RapidTool — Runtime & Integration Research

**File:** `research/runtime-integration.md`
**Date:** 2026-09-05 · **Author:** Flash research agent (read-only audit + web research)
**Repo root:** `C:/Users/mnril/Desktop/RapidTool Main` (NOT a git repo)
**Audience:** Pro build agents wiring P0/P7 real research, a local bounded code runner, and small governed-tool enhancements.

Everything below is grounded in the current tree (verified against `src/lib/*`, `src/components/console.tsx`, `package.json`, `.env.example`) plus live vendor docs fetched 2026-09-05. RapidTool's honesty conventions are load-bearing: the app ships with **zero invented output** — deterministic template artifacts are labeled `illustrative` and the `Competitor.source` type already reserves `"cited"` for real research (`src/lib/types.ts:58-65`). Any real-backend wiring must keep that contract.

---

## 1. Real web-research backend for P0 / P7 (RECOMMENDATION: Tavily)

### 1.1 Why RapidTool needs this

- P0 = "Deep Research & Feasibility" and P7 = "Domain & Market Research" (`src/lib/phases.ts:3-19, 60-67`). Today their artifacts are produced deterministically by `synthesizePhase()` in `src/lib/engine.ts` — competitor rows are template data stamped "illustrative — NOT live research" (engine.ts ~line 524) with `Competitor.source: "illustrative"`.
- The DeepSeek chat-completions API (the configured model backend, `.env`) has **no built-in web search**. The LLM cannot browse; "research" must come from a separate search API.
- The repo already anticipates this: `.env.example` ships an optional `TAVILY_API_KEY=tvly-...` with the comment *"Optional: real web-research backend… Leave blank to keep research in honest 'not-configured' deterministic-fallback mode."* The task is to make that promise real.
- Precedent to copy: `src/lib/llm.ts` is the house style for provider modules — typed `{ ok: true, ... } | { ok: false, reason: "not-configured" | "error", ... }` results, **never** a stand-in string presented as output. A Tavily module must mirror this.

### 1.2 Comparison: Tavily vs Serper.dev vs Brave Search API

| | **Tavily** ⭐ recommended | **Serper.dev** | **Brave Search API** |
|---|---|---|---|
| Auth | `Authorization: Bearer tvly-…` | `X-API-KEY: …` header | `X-Subscription-Token: …` header |
| Call | `POST https://api.tavily.com/search` JSON body | `POST https://google.serper.dev/search` JSON body | `GET https://api.search.brave.com/res/v1/web/search` query params |
| Free tier | **1,000 credits / month, resets monthly, no credit card** (basic search ≈ 1 credit) | 2,500 free **trial** credits (one-time), then prepaid credit packs | **Free tier removed (2025)** — now $5/mo credit with card on file (~1k searches), meter bills past it |
| Response for LLMs | Results carry a clean `content` snippet **ready to paste into a prompt**; optional `answer` field (LLM-generated short answer) | Raw Google SERP JSON (`organic[].snippet`, knowledge graph, news…) — you assemble context yourself | `web.results[].description` — you assemble context yourself |
| Extra tools | `/extract` (page-to-clean-text), `/crawl`, `/map`, `/research` | Google verticals (news/images/shopping) | Web + news + images (paid) |
| Best fit | Agent/RAG pipelines, "search → cite → answer" loops | SEO/SERP scraping workloads | High-volume general search at scale |

**Verdict: Tavily.** Single key, simplest call shape (one POST + one header), monthly-resetting free tier **with no card**, responses are already shaped for LLM consumption (which is exactly RapidTool's P0/P7 artifact use), it is the backend `.env.example` already names, and `/extract` covers follow-up page reads. Serper's free tier is one-time trial credit (not monthly) and its raw Google-SERP shape means more glue code; Brave now requires a payment card and its docs pages still advertise the removed free tier — a sign of churn to avoid. (Source check 2026-09-05: tavily.com/pricing; brave.com/search/api + coverage of Brave's 2025 free-tier removal; serper.dev homepage.)

### 1.3 Exact call shape (copy-paste build spec)

**Endpoint:** `POST https://api.tavily.com/search`

**Headers:**
```
Authorization: Bearer tvly-YOUR_API_KEY
Content-Type: application/json
```

**Minimal request body** (all other options have defaults; keep agent loops cheap):
```json
{
  "query": "latest React Server Components state management best practices 2026",
  "search_depth": "basic",
  "max_results": 5,
  "topic": "general",
  "include_answer": false,
  "include_raw_content": false,
  "include_domains": [],
  "exclude_domains": [],
  "time_range": null
}
```
Useful knobs: `search_depth: "advanced"` (deeper, costs more credits), `topic: "news"` (P7 market/competitor intel), `days: 7` (recency, alternative to `start_date`/`end_date`), `include_answer: true|"basic"|"advanced"` (LLM short answer), `max_results` 3–5 is plenty for an artifact bibliography.

**Example response** (abridged, annotated — this is the contract RapidTool should consume):
```json
{
  "query": "…",
  "answer": "…",                                  // only if include_answer requested
  "results": [
    {
      "title": "Page Title | Site",
      "url": "https://example.com/article",
      "content": "Clean, LLM-ready text snippet (not raw HTML).",  // ← feed this to the model / artifact
      "score": 0.81025416,
      "raw_content": null,
      "favicon": "https://example.com/favicon.png",
      "id": "a3f9c2-04"
    }
  ],
  "response_time": "1.67",
  "usage": { "credits": 1 },
  "request_id": "123e4567-e89b-12d3-a456-426614174111"
}
```
`results[].title / url / content` is the field set to persist into an artifact (plus `score` to rank).

**Node fetch snippet (server-side only — never `VITE_`-prefixed, never in a client bundle):**
```ts
export type TavilySearchResult = {
  ok: true;
  results: { title: string; url: string; content: string; score?: number }[];
  requestId?: string;
} | { ok: false; reason: "not-configured" | "http" | "network" | "invalid-response"; status?: number; message?: string };

export async function tavilySearch(query: string, opts?: { maxResults?: number; topic?: "general" | "news"; depth?: "basic" | "advanced" }): Promise<TavilySearchResult> {
  const key = process.env.TAVILY_API_KEY;                 // server-only env; .env is never inlined
  if (!key) return { ok: false, reason: "not-configured" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        query: query.slice(0, 500),
        search_depth: opts?.depth ?? "basic",
        max_results: opts?.maxResults ?? 5,
        topic: opts?.topic ?? "general",
        include_answer: false,
        include_raw_content: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: "http", status: res.status, message: `Tavily returned HTTP ${res.status}` };
    const body = (await res.json()) as { results?: unknown[]; request_id?: unknown };
    if (!Array.isArray(body.results)) return { ok: false, reason: "invalid-response", message: "no results array" };
    return { ok: true, results: (body.results as { title?: unknown; url?: unknown; content?: unknown; score?: unknown }[]).map((r) => ({
      title: String(r.title ?? ""), url: String(r.url ?? ""), content: String(r.content ?? ""), score: typeof r.score === "number" ? r.score : undefined,
    })), requestId: typeof body.request_id === "string" ? body.request_id : undefined };
  } catch (err) {
    return { ok: false, reason: "network", message: err instanceof Error ? err.message : String(err) };
  } finally { clearTimeout(timer); }
}
```

**curl smoke test** (run from this repo when a real key is present — a missing/invalid key returns 401):
```bash
curl -sS -X POST https://api.tavily.com/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tvly-YOUR_API_KEY" \
  -d '{"query":"Tavily web search API free tier","search_depth":"basic","max_results":3}' | head -c 2000
```

**Error map (handle every case as a typed `{ok:false}` — never crash the run):**
- `400` — bad request (e.g. invalid `topic`) → `reason:"invalid-response"`-style, surface detail.
- `401` — `{"detail":{"error":"Unauthorized: missing or invalid API key."}}`
- `429` — rate limit (`"Your request has been blocked due to excessive requests…"`)
- `432` — plan/usage cap (`"This request exceeds your plan's set usage limit…"`) and `433` — pay-as-you-go cap (`"This request exceeds the pay-as-you-go limit…"`) → treat like "not-configured" for UX: research step reports *"research backend credit exhausted"*, deterministic fallback artifact still ships, run never strands.
- `500` — server error → `reason:"http"` with retry-once policy.

**Cost guardrails for agent loops:** basic search ≈ 1 credit; advanced depth / `include_answer` cost more (exact multipliers per current plan — check the Tavily dashboard). Free tier = 1,000 credits/mo resetting the 1st. Budget P0+P7 research to ≤ 3–5 queries per phase and cache per-query results in the project (see 1.4) so re-runs don't reburn credits.

### 1.4 Integration contract for RapidTool (file targets)

1. **New server-only module `src/lib/tavily.server.ts`** holding `tavilySearch()` above (server-only naming matches the repo convention `src/lib/*.server.ts` reads `process.env`; `.env.example` note: never `VITE_` a secret).
2. **Expose over a TanStack Start `createServerFn`** (e.g. new `src/lib/research.ts` or inline in a route) — client code must never import the server module; this mirrors the `ai.ts` production note (ai.ts:28-32).
3. **Engine hook points:** `src/lib/engine.ts` `synthesizePhase()` — the phase-0 and phase-7 branches that currently emit `kind:"research"` artifacts with illustrative competitor rows (~engine.ts:524). Wire: if real research is available (key present + call ok), append a *real* artifact whose body lists `results[].title/url/content` and mark affected `Competitor` rows / summary lines `source:"cited"`; otherwise keep today's deterministic output untouched (honest fallback, B-23 convention intact).
4. **Data model:** `src/lib/types.ts` — `Competitor.source` already has `"cited"` reserved (types.ts:58-65). Suggest adding an optional `sources?: { title: string; url: string }[]` to `Artifact` (types.ts:33-40) or, lower-touch, embedding a markdown source list in `artifact.body`. Engine is synchronous today; a research fetch is async — so the practical wiring is: fire research in the run/execute action path (`src/lib/store.ts` `execute`/`advanceOnce` is sync; add an async pre-step or a dedicated "Run research" button on the P0/P7 cards in `src/components/console.tsx`) and stash results on the project before `advanceOnce` builds the artifact.
5. **Never invent:** when the key is absent, timeout, or credit-capped, the phase completes with the deterministic artifact and an honest note ("research backend not configured / unavailable — content is illustrative") — exactly the ai.ts philosophy.

---

## 2. Local bounded code execution (Node on Windows, no Docker)

### 2.1 Context and the honest framing (read first)

RapidTool already has a real executor for **in-browser** runs: `src/lib/sandbox.ts` `runSandboxed()` — a fresh blob **Worker** isolate per run with `fetch`/`WebSocket`/`XMLHttpRequest` stubbed to throw, captured `console`, a hard wall-clock `terminate()` (default 30 s, matching `types.ts` `sandbox.timeoutS`), and an honest `sandboxClaim()` string that tells the user exactly what it is ("Worker isolate, 30s hard cap, network primitives stubbed"). The sync path (`runGenerated`) is explicitly a *bounded engine-template runner only* and refuses non-template source. That is the right pattern and stays.

This section covers the **other case**: executing engine-/agent-authored JS on the **Node host (Windows)** with **no Docker** — e.g. server-side verification, a CLI/dev harness under `scripts/`, or a P10 "local-edge" handoff — where the browser Worker does not exist.

> **The one-sentence contract:** a *bounded runner* mitigates accidents and caps resource abuse; only an OS-level boundary (Docker, WSL2, Windows Sandbox, an AppContainer, or a VM) *contains* a determined adversary. Anything claiming more without such a boundary is dishonest — and this repo's whole culture is honest labeling (B-18, B-23). Label it in the UI exactly like `sandboxClaim()` does.

### 2.2 What IS enforceable without Docker — `child_process.spawn` (the pattern)

| Mechanism | What it actually does |
|---|---|
| `timeout: 30_000` | Wall-clock cap; on expiry Node kills the **direct** child (see Windows caveat below) |
| `killSignal: "SIGKILL"` | Uncatchable kill for the timed-out child (SIGTERM first if you want graceful-then-force) |
| `maxBuffer` (stdout/stderr) | Kills the child if it emits more than N bytes — output bomb guard |
| `windowsHide: true` | No console window flashes on the user's desktop |
| `cwd: <fresh mkdtemp dir>` | Working directory is a scratch folder — file writes land there (courtesy jail, see 2.3) |
| `env: scrubbed object` | Child gets only what you pass; strip secrets; set `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` empty + `NO_PROXY: "*"` so *cooperating* HTTP clients have no proxy route |
| `detached: false` | Child stays in your process group / job — no orphaned detach |
| `stdio: ["ignore", "pipe", "pipe"]` | No stdin; capture stdout/stderr through bounded pipes |
| Fresh temp dir per run + `fs.rm(…, {recursive: true, force: true})` in `finally` | No state leaks between runs |
| On Windows timeout: `taskkill /pid <pid> /T /F` | Kills the child **and its tree** — required because a plain `SIGKILL` on Windows kills only the direct process and grandchildren survive |

### 2.3 What is NOT enforceable without Docker (state it explicitly)

- **Filesystem confinement:** the temp `cwd` is a *courtesy*, not a jail. The child can read/write anywhere the OS user can. Node's `node:vm` is **not** a security mechanism (per official Node docs) — same-trust code only.
- **Memory caps:** there is no rlimit on a Windows `spawn`. The only in-process option is `worker_threads` + `resourceLimits` (`maxOldGenerationSizeMb`, `maxYoungGenerationSizeMb`, `stackSizeMb`) — still not a full sandbox, but a genuine heap ceiling for cooperative code.
- **CPU caps:** none without OS tooling (Job Objects via native code, WSL2, Windows Sandbox).
- **Real network deny:** proxy env vars only steer *well-behaved* clients; raw sockets bypass them. Without Docker the no-Docker "no-network" options are: run under a restricted Windows user, an AppContainer, or Windows Sandbox — or state *"network is assumed-absent, not enforced"* and scan for socket primitives (the repo already does lexical primitive denial in `sandbox.ts:12-13` as defense-in-depth — same spirit, same limits).
- **Process-tree kill reliability:** `timeout` + `SIGKILL` kills only the direct child on Windows → always follow with `taskkill /pid <pid> /T /F`.
- **User/kernel isolation:** none. Anything running as your user can, in principle, do what your user can do.

**Bottom line to print in any UI/CLI help:** *"Local runner is a bounded execution environment for engine-authored code — it enforces a time limit, output caps, and a scratch directory. It is not a security sandbox; do not run untrusted third-party code in it. Real isolation needs Docker/WSL2/Windows Sandbox."*

### 2.4 Recommended pattern (copy-paste reference implementation)

```ts
// src/lib/node-runner.ts  (server-only / scripts use — Node host, Windows-safe)
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type NodeRunResult =
  | { ok: true; exitCode: number; stdoutTail: string; stderrTail: string; ranMs: number }
  | { ok: false; detail: string; exitCode?: number; stderrTail?: string; killed?: boolean };

const MAX_OUTPUT = 1_000_000;   // 1 MB per stream — output-bomb guard (maxBuffer)
const DEFAULT_TIMEOUT_MS = 30_000;

function treeKill(pid: number): void {
  // Windows: SIGKILL on the parent does NOT kill grandchildren. taskkill /T /F takes the tree.
  try { spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true }); } catch { /* best effort */ }
}

export async function runNodeBounded(entry: string, opts?: { timeoutMs?: number; env?: Record<string, string> }): Promise<NodeRunResult> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const dir = mkdtempSync(join(tmpdir(), "rapidtool-run-"));          // fresh scratch per run
  const started = Date.now();
  const child = spawn(process.execPath, [entry], {
    cwd: dir,                                                        // courtesy jail (see 2.3)
    env: { ...opts?.env, HTTP_PROXY: "", HTTPS_PROXY: "", ALL_PROXY: "", NO_PROXY: "*" },
    timeout: timeoutMs,                                              // wall clock
    killSignal: "SIGKILL",
    maxBuffer: MAX_OUTPUT,                                           // output cap kills runaway writers
    windowsHide: true,                                               // no flashing console window
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "", stderr = "";
  child.stdout?.on("data", (d: Buffer) => { stdout = (stdout + d.toString()).slice(-MAX_OUTPUT); });
  child.stderr?.on("data", (d: Buffer) => { stderr = (stderr + d.toString()).slice(-MAX_OUTPUT); });
  return await new Promise<NodeRunResult>((resolve) => {
    let settled = false;
    const finish = (r: NodeRunResult) => { if (!settled) { settled = true; rmSync(dir, { recursive: true, force: true }); resolve(r); } };
    child.on("error", (err) => finish({ ok: false, detail: `spawn failed: ${err.message}` }));
    child.on("close", (code, signal) => {
      const killed = signal !== null;
      finish(killed
        ? { ok: false, detail: `killed after ${timeoutMs / 1000}s`, killed: true, stderrTail: stderr.slice(-2000) }
        : code === 0
          ? { ok: true, exitCode: code, stdoutTail: stdout.slice(-2000), stderrTail: stderr.slice(-2000), ranMs: Date.now() - started }
          : { ok: false, detail: `exited ${code}`, exitCode: code ?? undefined, stderrTail: stderr.slice(-2000) });
    });
    setTimeout(() => { try { treeKill(child.pid ?? -1); child.kill("SIGKILL"); } catch { /* already gone */ } }, timeoutMs);
  });
}
```

Notes for the builder: use `process.execPath` (same Node, no PATH surprises), pass a file (safer than `-e` for quoting/Windows), and keep the same `{ok, detail}` shape the rest of the codebase speaks. `resourceLimits` is only available via `worker_threads` — if a heap ceiling matters, run the same script in a `new Worker(entry, { resourceLimits: { maxOldGenerationSizeMb: 128 }, … })` and wrap it with the same timeout/`terminate()` pattern (`worker_threads` has no `timeout` option — you must `terminate()` on a timer, exactly like `sandbox.ts` does with `runSandboxed`).

### 2.5 Fit with the existing codebase (file targets)

- The browser path stays the primary executor (`src/lib/sandbox.ts`). If a Node-host run is needed behind a server fn, add `src/lib/node-runner.ts` (above) and expose it via a TanStack Start `createServerFn` — never import it client-side.
- Reuse/extend `sandboxClaim()` (sandbox.ts:158-167) and the `types.ts` `sandbox` record (`runtime`, `ramMb`, `timeoutS`, `isolated`, types.ts:211-216) so the UI prints one honest label regardless of which runtime executed. `runtime` today is `"worker" | "sync-template"` — a Node-host mode would add `"local-node"` with `isolated: false` (never claim isolation you don't have).
- Unit-test the boundary honestly: a fixture that `while(true){}` must return `killed`, a fixture writing outside `cwd` will (on Windows) *succeed* — assert the code documents that rather than pretending the jail held (mirror `src/lib/sandbox.test.ts` style).

---

## 3. Small enhancement recommendations (5–10, researched + file-targeted)

Ranked by value ÷ risk for a *governed agent-prompt/spec tool*. Every target below exists in the current tree.

### 3.1 Global keyboard shortcuts for the run loop
**What:** App-wide hotkeys — e.g. `⌘/Ctrl+Enter` = Run/advance phase, `A` = Approve + `R` = Reject in HITL dock, `⌘/Ctrl+Shift+C` = copy agent packet, `/` = focus search.
**Why:** The audit shows **exactly one** `onKeyDown` in all of `src/` (console.tsx:454) and no `ctrlKey`/`metaKey` handling anywhere; HITL approve/reject are click-only (console.tsx:349-360). Governed pipelines live and die on fast approve/reject loops; the phase-run UI is keyboard-first work. Radix + cmdk are already deps, so the pattern is available.
**Targets:** `src/components/console.tsx` (RunScreen `run`/`onApprove`/`onReject`, HitlDock) + a small new `src/lib/use-hotkey.ts` hook; document in the header comment. Low risk, additive.

### 3.2 Cross-artifact + cross-project full-text search
**What:** Broaden the existing artifact search (which filters only the open project's `artifacts` by `title/kind/body`, console.tsx:306-312) to also match `packet`, `spec`, `crew`, and `oracle` tab content — and add a HomeScreen search across all persisted projects.
**Why:** Research artifacts (P0/P7) and spec graphs grow fast; today a term living in the packet but not an artifact title is unfindable, and you can't search *across* builds at all. All data is already in the zustand store (`projects[]` in memory, localStorage-persisted) — no backend, no index needed at this scale; a simple lowercase substring pass over a memoized index is enough.
**Targets:** `src/components/console.tsx` (RunScreen query + new HomeScreen search UI) + `src/lib/store.ts` (selectors over all projects). Medium value, low risk.

### 3.3 "Copy all artifacts" bundle
**What:** One button that copies every artifact (phase header + title + body) as a single markdown document to the clipboard.
**Why:** Today only "Copy agent packet" and "Copy phase handoff" exist (console.tsx:598-607). Handing a colleague/another agent the full artifact trail currently means N copies. The builder's raw material is the artifact set; one-shot export is the obvious missing primitive.
**Targets:** `src/components/console.tsx` (button next to existing copy actions) + new `exportArtifactsText(project)` next to `exportPacketText` in `src/lib/io.ts` (io.ts:93). Trivial, additive.

### 3.4 Share-via-clipboard JSON (in addition to file download)
**What:** A "Copy project JSON" action that writes `exportProjectJson()` output to the clipboard, beside the existing download button (`downloadJson`, console.tsx:393-402).
**Why:** Download-`.json` is the only share path today; clipboard share is faster for pasting into chats/other tools and matches the approved `navigator.clipboard.writeText` pattern already used at console.tsx:372/385. Zero new concepts.
**Targets:** `src/components/console.tsx` (reuse `exportProjectJson` from `src/lib/io.ts:25`). Trivial.

### 3.5 Packet / artifact version history
**What:** Append-only snapshots: before each `advanceOnce` overwrites `project.packet` or appends an artifact, push `{ ts, phase, packetDigest|packet }` onto a new `Project.packetHistory` array; UI shows a version picker with the phase that produced each snapshot.
**Why:** `PACKET_VERSION = 2` (packet.ts:7) tracks *shape* version, not *content* history — and `Project.packet` is silently overwritten each phase (store.ts `advanceOnce`/`execute`). A *governed* spec tool's core promise is traceability of the evolving spec: reviewers and the HITL process ("what changed since I rejected?") need diffs, and packet history is the cheap, honest version of that. `PhaseRecord.rejectionHistory` (types.ts:116) is the established append-only pattern to copy.
**Targets:** `src/lib/types.ts` (new field), `src/lib/store.ts` (`advanceOnce` snapshot point), `src/components/console.tsx` (picker UI reusing the `viewPhase` pattern at console.tsx:298). Medium value; watch payload size (store already localStorage-persisted — store digests or cap depth at ~20).

### 3.6 Undo for rename (and last-name restore)
**What:** Keep the previous name and offer Undo after `commitRename()` (console.tsx:429-432); simplest form: store `prevName` and a 5 s toast with Undo (sonner is already a dep).
**Why:** Rename is destructive with no recovery and no confirm — one fat-fingered Enter loses a project name forever. In a tool whose artifacts become specs others cite, name integrity matters; this is the cheapest undo win.
**Targets:** `src/components/console.tsx` (`commitRename` + toast) + optionally `src/lib/store.ts` `rename` (keep last-name in state). Trivial.

### 3.7 Autosave / last-saved indicator + hydration surfacing
**What:** Show "Saved HH:MM" in the RunScreen top bar and a one-time "Restored N builds from local storage" chip; stamp `lastSavedAt` in the persist layer.
**Why:** Persistence is invisible today — zustand `persist` writes on every `set` (store.ts:186+) and the store even carries an unsurfaced `hydrated`/`setHydrated` flag (store.ts:189-191). Users of a governance tool need to *trust* that work is durable and know when a restore happened; right now there's no signal at all.
**Targets:** `src/components/console.tsx` (status chip) + `src/lib/store.ts` (stamp via `partialize`/`onRehydrateStorage`). Trivial, pure UX trust.

### 3.8 Empty-state onboarding hints
**What:** On `HomeScreen` (console.tsx:145) with zero projects, show 2–3 one-line example briefs (click-to-fill) plus a "what this does" line; on a fresh run, hint what the first Run will produce.
**Why:** The intake screen is just a textarea + button today; a governed 13-phase tool's value proposition is invisible to a first-time user. Example briefs double as instant demos of P0 research output. `src/lib/templates.ts` already exists as a natural home for sample briefs.
**Targets:** `src/components/console.tsx` (`HomeScreen`), `src/lib/templates.ts` (sample briefs). Trivial–low.

### 3.9 A11y polish: focus-visible rings, Escape handling, live regions
**What:** Audit custom (non-Radix) chrome — RunScreen inline rename editor, PhaseRail buttons, HitlDock approve/reject, copy feedback (which is visual-only `copied` state today, console.tsx:293/598) — for `:focus-visible` rings, Escape-to-cancel, and `aria-live` announcements of phase transitions and copy results.
**Why:** Radix dialogs get traps for free, but the custom inline controls are the long tail; a governance tool is used in long, focused sessions where keyboard + screen-reader flow is exactly the power-user path. Copy feedback especially is invisible to assistive tech.
**Targets:** `src/components/console.tsx` + `src/styles.css` (focus-visible token, e.g. consistent ring color). Low risk; medium polish value.

### 3.10 Dark-theme consistency pass (not a light mode)
**What:** The app is dark-only (`theme-color: #0b0c0e` in `__root.tsx:23`, no `prefers-color-scheme`/`.dark` anywhere in `src/styles.css`). Sweep hard-coded colors into the existing token system (`bg-bg`, `text-fg`, `text-muted`, `text-accent` classes are already used) and add selection/focus/scrollbar styling.
**Why:** Cheaper and more honest than adding light mode; inconsistent inline hexes are the top source of "looks broken" reports, and the tokens already exist — the sweep is mechanical.
**Targets:** `src/styles.css` + greps in `src/components/console.tsx` for inline hexes; `src/routes/__root.tsx` only if theme-color needs to follow. Low risk, mechanical.

**Recommended cut for a first sprint:** 3.3, 3.4, 3.6, 3.7, 3.8 (all trivial/additive, no data-model change) then 3.1, 3.2, 3.5 (behavioral, more test surface). 3.9 and 3.10 are background hygiene.

---

### Appendix — facts verified in-tree (so builders can trust the targets)
- `.env`/`.env.example`: `DEEPSEEK_API_KEY`, `TAVILY_API_KEY`; secrets server-side only, never `VITE_`.
- Engine research output is deterministic + labeled illustrative: `src/lib/engine.ts` ~L524 (`kind:"research"`, "NOT live research" note); `Competitor.source` reserves `"cited"` (`src/lib/types.ts:64`).
- Phases: P0 `id:0`, P7 `id:7` (`src/lib/phases.ts`); HITL phases [4,5,8,9].
- Executor: `src/lib/sandbox.ts` — worker isolate w/ network stubs + 30 s terminate; honest `sandboxClaim()`.
- UI: `src/components/console.tsx` — HomeScreen (L145), RunScreen (L270) tabs `artifacts|packet|spec|crew|oracle`, artifact search (L306), copy actions (L598-607), `downloadJson` (L393), `commitRename` (L429), single `onKeyDown` (L454).
- State: `src/lib/store.ts` zustand `persist` (L186+), `hydrated` flag exists; `Project.packet` overwritten per phase.
- Versioning today: `PACKET_VERSION = 2` shape marker only (`src/lib/packet.ts:7`); append-only precedent: `rejectionHistory` (`src/lib/types.ts:116`).
- Sharing: `src/lib/io.ts` `exportProjectJson`/`importProject`/`exportPacketText`/`downloadFilename`.
