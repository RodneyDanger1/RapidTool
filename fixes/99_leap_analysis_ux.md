# 99 — LEAPFROG analysis (H-C lane): chat UX/persistence, verification visibility, cheap production checks, RT_E coverage

**Role**: Flash ANALYZER H-C (chat/UX/verification lane) — strictly read-only on RapidTool source; this file is the only output. A Pro sibling consumes this LIVE; every item below is a buildable spec (target files, exact changes, test plan), 0 hallucination.
**Date**: 2026-09-06 · deepseek-v4-flash.
**Consumes**: `90_LEAPFROG.md` §11/§13–§16 · `research/multiagent/42_competitive_analysis.md` (chat vs Codex/DSH/Gemini/Antigravity) · `research/multiagent/93_design_flaws.md` (DF ledger). **Feeds**: P0-1/P0-2/P1-5 (chat trust wave), P1-1 (verification lattice), §13.10/§14.6 rows (production checks), Phase-0 #3 (approval-note symmetry).
**Anchor discipline**: every `file:line` below was re-grepped/re-read THIS pass on the 2026-09-06 tree (console.tsx 4 958 ln, store.ts 1 206 ln, engine.ts 2 439 ln — sizes match the 93/§15 reads; treat as ±5 if a sibling edits `src/`). External claims cite pages fetched ✓TODAY by this pass (register in §9); competitor-mechanics claims are inherited from 42/93 same-day fetches and marked as such.
**Source files read this pass**: `package.json`, `eslint.config.mjs`, `src/lib/{chat,chat.server,deepseek.server,verify,verify.server,errors,types,store,engine,dod,headless,exec,algo-tools,crew.server,report-intake}.ts`, `src/components/console.tsx` (chat/HITL/oracle/evidence regions).

---

## §0 TL;DR (the five deliverables, ranked by build order)

1. **CHAT — honest interim first, bounded stream second.** Ship (a) persistence to `Project.chatLog` (S2 of 42 — effort L), (b) context meter + version chip (P1-5/42 S4-lite), (c) live elapsed-status instead of the dead pulse — all **without** touching transport. Then (d) P0-1 streaming **as a typed async-generator server function** — this is now officially documented TanStack Start (✓TODAY, §9 [T1]), so NO raw SSE route, NO NDJSON parsing, NO client protocol is needed. Stop button: **do not fake it** — the `createServerFn` call API exposes no abort signal (verified absent from official docs); ship Stop only with the raw-fetch Server-Route variant (phase 2, documented tradeoffs).
2. **Chat/HITL UX P1s (93)**: DF-09 null-note approval symmetry (note ≥12 chars required exactly when the gate FAILED or `forceHuman` override is used — engine+store+UI triple mirror of the rejection law), error-row classification completion (never `code:null`), distinct failure tombstone kept, dead/empty-state copy fixes, persisted-thread affordances.
3. **VERIFICATION VISIBILITY (DF-15/16, P1-1)**: the machine verify loop (`verify.server.ts`) and its persistence half (`headless.ts` `applyVerifyOutcome`) are both real, tested, and invisible. Wiring spec: extract the two pure helpers into the client-safe contract module, add one store action + one P6 card button + a verify-outcome panel in the Oracle tab + a HITL-dock evidence row. `p6-verified` (dod.ts:153-171) already exists to receive it.
4. **Production-grade checks (§13) — top 3 by impact/effort, all zero-dep, all S**: (1) `npm run ci` unified gate + `test:cov` (Node built-in thresholds, verified on this host v22.23.2) + `audit:deps`; (2) generated-code hygiene probes `p6-lint` + `p6-secrets` registered additively in DOD[6] (deterministic regex, E-07 pattern); (3) `check-fix-register.mjs` postmortem→guardrail gate. `npm run eval` follows (corpus harness spec included, not in top-3: M effort, depends on corpus fixtures that do not exist on disk yet).
5. **RT_E coverage completion**: verified inventory of `{ok:false}` seams **without** a `code` — `algo-tools.ts` (8 returns), `crew.server.ts` search seam, `report-intake.ts` validation returns, console catch-branch `code:null`. All fixable additively with EXISTING codes (no new code needed); one new code deferred (`RT_E_ABORTED`) until Stop ships.

**Sequencing**: item 1a→1b→1c→2 are one UI wave; item 3 is independent (engine/store/console); item 4 is pure repo-tooling (can land same day as anything); item 5 rides with item 2/3 edits (test-enforced by a typed-failure inventory test, §7.4).

---

## §1 CHAT-1: persistence (P0-2, 42 rank #2) — exact spec

**Verified gap**: `console.tsx:4360-4363` — "Local state only — nothing persisted, store partialize untouched"; `ChatPane` seeds `useState<ChatMsgView[]>([])` at `console.tsx:4366`; refresh erases the thread. `ChatHistoryRow` exists (`chat.ts:56-66`) but lacks `ts` and `code`; store partialize persists the whole `projects` array (`store.ts:1182-1187`), so **any field added to `Project` persists with zero partialize change**.

**Target files / exact changes**:

| # | File | Change |
|---|---|---|
| 1.1 | `src/lib/types.ts` | Add to `Project` (after `wildRun?` block, ~`:337`): `/** P0-2: persisted chat thread (console ChatPane). Absent on legacy/imported payloads; additive — never inferred. Rows mirror console's ChatMsgView minus the local id counter. */ chatLog?: ChatLogRow[];` — and a new exported type near `Project`: `export type ChatLogRow = { role: "user" \| "assistant"; text: string; ts: number; error?: boolean; code?: string; provenance?: string };` (comment: `error` rows are display-only, never replayed as model speech — `chat.ts:76-94` filter is the replay law). |
| 1.2 | `src/lib/engine.ts` | `emptyProject` base object (~`:1067-1130`, near `_v: 2` at `:1130`): add `chatLog: []`. `hydrateProject` (~`:1324-1535`): additive read — do NOT repair-churn; ChatPane guards with `?? []`. If present-but-not-array, drop loudly in the existing `hydrate.repaired` log (row pattern at `:1465-1501`). No `_v` bump required (additive field, guarded read; bump only if a later wave makes it mandatory). |
| 1.3 | `src/lib/store.ts` | New action (pattern = `setNotes` map-action at `:1125-1127`): `appendChatRows: (id: string, rows: ChatLogRow[]) => void` → map `projects`, concat, cap `slice(-40)` (≈10 turns; display cap is 12 rows `console.tsx:4481`, server history cap is 6 turns `chat.server.ts:44-47` — 40 is headroom so a reload shows more than the model ever sees; trim on write, never on read). Type entry next to `setNotes` at `:72`. |
| 1.4 | `src/components/console.tsx` | `ChatPane` (`:4364-4418`): (a) seed `useState` initializer from `project.chatLog ?? []`, mapped to `ChatMsgView` with fresh `id`s from a ref counter (ids stay local — `:4370` `nextId` unchanged); (b) in `send()` after `trimTurns`, persist **both** the user row and the terminal turn (success or error) in one `appendChatRows(project.id, [userRow, turn])` call — the whole store update is atomic per turn; persist in the `finally` is wrong (would store nothing on throw — the send already converts throws to error rows at `:4393-4417`, so the single call after `setMsgs` covers every path); (c) `useEffect` on `project.id` to reset local state when the route remounts a different project (`run.$id.tsx:10-12` key remount already handles it — verify no manual reset needed); (d) update the header doc-comment `:4359-4362` (drop "nothing persisted"). |
| 1.5 | `src/lib/chat.ts` | No change required — `ChatHistoryRow` stays the *wire* shape; persistence uses `ChatLogRow`. (Do not collapse the two: wire rows carry no `ts`, display rows do.) |

**Tests**:
- `engine.test.ts` or `store.test.ts`: `emptyProject` carries `chatLog: []`; `appendChatRows` appends, caps at 40, leaves other projects untouched.
- `hydrateProject`: legacy payload without `chatLog` hydrates cleanly (no `hydrate.repaired` row); garbage non-array `chatLog` dropped loudly.
- Round-trip: `exportProjectJson`/`importProject` (`io.ts:25`) preserve `chatLog` (additive field rides the existing shape validation — assert in `io`/import tests).
- Regression anchor name for `check-fix-register.mjs` (§5-3): `chat-log-persist.test.ts`-style case in `store.test.ts`.

**Web-verified parity note**: session persistence with resume is Codex `resume/fork/archive` [C1] and DSH JSONL journal [D3] (42 §2.1/§2.2, inherited same-day fetches). RapidTool's localStorage+zustand is the honest local analog — the *product* is single-machine keyless (§15.1), so "durable" here means "survives reload", which `rapidtool.v4` partialize already does for every other Project field.

---

## §2 CHAT-2: streaming (P0-1, 42 rank #1) — bounded typed-stream design, web-verified

**Verified gap**: one-shot POST — `chat.ts:17-28` `createServerFn({method:"POST"})` → `deepseek.server.ts:233` `stream: false`; UI renders a pulsing "thinking…" placeholder (`console.tsx:4483-4495`) while waiting; no Stop; Codex/Gemini/DSH all stream [42 §2, inherited]. **The perceived-latency gap is the whole chat product** (42 §5 rank 1).

### 2.1 Pattern decision (web-verified, ✓TODAY)

- **Chosen: typed async-generator server function.** Official TanStack Start docs, "Streaming Data from Server Functions" (fetched ✓TODAY): a `createServerFn().handler(async function* () { … yield msg })` streams **typed chunks** to the client; client consumption is `for await (const chunk of await fn())` (§9 [T1]). The docs also document `ReadableStream<T>` returns with `reader.read()` for the same purpose. Both are first-class in this app's exact stack (`@tanstack/react-start ^1.168.0`, `package.json:50`).
- **Rejected: raw SSE endpoint.** TanStack Server Routes are "meant for HTTP endpoints that need to be called from **outside** your Start application… If you only need to call server-side logic from within your Start app and want Start to handle serialization for you, use server functions" (§9 [T2], verbatim). Chat is inside-app → server function is the documented-correct choice; a raw `text/event-stream` route buys nothing here and loses typed chunks + Start's error serialization ("Errors are serialized to the client", §9 [T3]).
- **Rejected: NDJSON-over-Response hand-rolling** — unnecessary; chunk objects are framework-serialized and typed.
- **Stop button honest-limitation**: the typed `createServerFn()` call API exposes **no abort/signal parameter** in official docs ([T1][T3] — absence verified, not assumed). A Stop that only stops *rendering* while the server keeps generating would lie about state — do not ship it. Interim liveness affordance instead (§2.4). Phase-2 Stop: a Server Route (`server.handlers.POST`, §9 [T2]) + raw `fetch` + `AbortController` — loses typed serialization, must re-implement CSRF/error mapping; spec deferred, noted here so nobody "adds a Stop" to the fn path.

### 2.2 Backend — exact changes

| # | File | Change |
|---|---|---|
| 2.1 | `src/lib/deepseek.server.ts` | New export beside `completeDeepSeek` (`:168`): `export async function* streamDeepSeek(prompt: string, opts?: DeepSeekCompleteOptions): AsyncGenerator<{ type: "delta"; text: string } \| { type: "done"; model: string }>` — same key/validation pre-flight as `completeDeepSeek` (`:172-186` returns — yield an honest `{type:"error"…}` shape instead? No: keep generator pure-transport; see 2.2 for the typed envelope). Body: `stream: true` (`:233` flips per-call via `opts.stream`), `accept: "text/event-stream"`, parse `data:` lines (`[DONE]` terminator; DeepSeek API surface per 90 §12.3 fact card + `research/deepseek-api.md`, both same-day-verified corpus — do NOT re-fetch), re-use `describeError` (`:158-166`) and the AbortController timeout pattern (`:236-248`; a timeout mid-stream → yield done with error flag — see 2.2). Keep `stream: false` default so ALL existing callers are byte-identical. |
| 2.2 | `src/lib/chat.server.ts` | New export `export async function* chatStreamServer(project: Project, userText: string, history?: ChatTurn[]): AsyncGenerator<ChatStreamChunk>` where `ChatStreamChunk = { type: "context"; chars: number; max: number; version: number } \| { type: "delta"; text: string } \| { type: "provenance"; stamp: string } \| { type: "error"; code: ErrorCode; message: string } \| { type: "done" }`. Reuse **verbatim** the guards of `chatOnceServer` (`:274-330`: not-configured → `{type:"error", code:"RT_E_LLM_NOT_CONFIGURED"}` first, project/text validation, `cutMarked` caps, C2 context snapshot at `:304-306` — capture `contextAt`, `buildChatContext`, `chatContextVersion` BEFORE first yield, emit `context` as chunk 1, `provenance` = `chatProvenance(project, context, contextAt)` emitted after the last delta, `done` last). Mid-stream failures inside the generator: **yield `{type:"error"}` then `return`** — never throw mid-stream (Start serializes thrown errors, but a half-consumed stream then reads as transport failure; typed error chunk is the honest terminal). |
| 2.3 | `src/lib/chat.ts` | Second server fn next to `chatServer` (`:17-28`): `const chatStream = createServerFn({ method: "POST" }).validator(same input).handler(async ({data}) => { const { chatStreamServer } = await import("./chat.server.ts"); return chatStreamServer(data.project, data.userText, data.history); });` — Start's handler return type is the AsyncGenerator; client receives the typed async iterable (verified pattern [T1]). Wrapper: `export async function chatStreamOnce(project, userText, history): Promise<ChatStreamResult>` where the result union = `{ok:true; text:string; provenance:string; context:{chars,max,version}} \| {ok:false; reason:"not-configured"\|"error"; error?:string; code?:ErrorCode}` — i.e. **the UI-facing contract stays one-shot-shaped**; streaming is an internal accumulation (`for await` → concat deltas). This keeps `ChatPane` logic, failure-row rules, and `chatHistoryTurns` untouched while transport streams. |
| 2.4 | `src/lib/chat.server.ts` / tests | All context/history/staleness logic is shared by construction: `chatStreamServer` calls the same pure builders `chatOnceServer` uses. Extract nothing; add a thin private `buildMessages(...)` if duplication appears (>10 lines), otherwise accept the overlap (both call `completeDeepSeek`/`streamDeepSeek` with identical message assembly). |

### 2.3 UI — exact changes

`ChatPane` (`console.tsx:4364-4510`):

- `send()` switches to `chatStreamOnce` when the stream fn exists; **honest fallback**: if the streamed call returns `ok:false reason:"error"` with `RT_E_INTERNAL`/transport failure, retry once through `chatOnceSafe` (one-shot path stays forever as the deterministic floor — keyless/deterministic runs and older hosts keep working).
- Live row: on first `delta` create the assistant row (placeholder text ""), append deltas to it, render with existing `MarkdownBody` per row (`:4308-4311`) — deltas accumulate in state, row re-renders (existing pattern; no DOM streaming needed).
- Replace the dead pulse (`:4483-4495`) with a **status row**: `thinking… {elapsed}s · one-shot reply — streaming when the backend supports it` while the legacy path runs; the pulse only shows during the pre-first-delta window of the streamed path (real: waiting on first token).
- Provenance renders exactly as today (`:4310` `chat-prov`) once the `provenance` chunk lands.
- Busy latch (`busyRef`, `:4369`) unchanged; chips/composer disable while busy unchanged.

### 2.4 Interim (ship BEFORE 2.2/2.3 — independent, additive)

1. **Elapsed liveness ticker**: while `busy`, a 1s interval advancing a `elapsedSec` state rendered in the thinking row ("waiting… 12s — flash replies usually land <20s; timeouts surface as RT_E_LLM_TIMEOUT"). Kills the "hung or working?" ambiguity without streaming.
2. **Honest caption under the composer when unconfigured** — already present (`:4457-4462`); add the timeout note to it (server 20s cap, `deepseek.server.ts:192`/`TIMEOUT_FLASH_MS`).
3. **No Stop button** (see 2.1 rationale) — document in the pane's tooltip-free caption instead: the chat tab header (`:4453-4456`) gains `· no stop/stream yet` ONLY until 2.3 lands; remove the line the day streaming ships (a stale "no stream" caption is the same lie class the honesty rules forbid).

**Tests**:
- `deepseek.server` stream parser: fixture SSE byte stream (2 deltas + `[DONE]`), timeout mid-stream, HTTP error mid-stream, `data:` lines split across chunks (the one real parser hazard).
- `chat.server`: `chatStreamServer` yields `context` first with exact `chars/max/version` equal to `buildChatContext(...).length`/`CHAT_CONTEXT_MAX_CHARS`/`chatContextVersion(...)`; not-configured yields `{type:"error", code:"RT_E_LLM_NOT_CONFIGURED"}` and nothing else; history caps applied (6 turns/800 chars); stale provenance tagging identical to one-shot.
- `chat.ts`: `chatStreamOnce` accumulates deltas → single `{ok:true,text,provenance}`; transport throw → `{ok:false, code}` via `classifyError(err,"RT_E_INTERNAL")` (`:50` pattern).
- Determinism floor: streamed and one-shot paths must produce identical *message assembly* for identical input (byte-compare the pre-body message arrays in tests).

---

## §3 CHAT-3 / HITL UX P1s from 93 (DF-09 error display, empty states, DF-13 context meter)

### 3.1 DF-09 — approval-note symmetry over FAILED/override gates (Phase-0 #3, 90 §11.3 P1-4)

**Verified gap**: reject requires ≥12 chars in three layers (`engine.ts:999-1001`, `store.ts:1015`, `console.tsx:1355-1358`); approve requires none — even when the approver ticks "I reviewed the failing sandbox output and approve anyway" (`console.tsx:2712-2722`) or approves a `forceHuman` reframe with no note (87 S2 null-note class, 93 DF-09). `approveHitl` already accepts `note?: string` (`engine.ts:900-902`) and writes it to the decision row (`:925-935`) — **the plumbing exists; only the guard is missing**.

**Exact spec — mirror the rejection law on the override classes only** (plain approvals of PASSED gates stay note-optional; forcing a note on every approval would drown the legit fast path — the ledger keeps the decision row either way):

| Layer | File:line | Change |
|---|---|---|
| UI | `console.tsx:2712-2733` | When `needsOverride` (`:2652-2656`: `forceHuman` + P6 + `lastTest.ok === false`), the Approve button is disabled until the note textarea (`:2691`) holds ≥12 chars; the note textarea label flips contextually ("Approval note — you are approving over a failing gate (min 12)"), and `onApprove(forceOverride)` (`:2642`) passes the note. Mirror for **forceHuman reframe** approvals: `needsOverride` is currently P6-only (`:2654`); extend the computed flag to `Boolean(h.forceHuman) && (gate failed \|\| phase has no passed gate)` — cheapest correct definition: note required whenever `h.forceHuman === true`. |
| Store | `store.ts:975-1013` | `approve: (id, opts)` — extend `opts` with `note?: string`; when `project.hitl.forceHuman` (guard region `:984-995`) and `!note \|\| note.trim().length < 12` → `return { ok:false, error: "Approving a forceHuman gate requires at least 12 characters of note." }` (same shape as the reject guard at `:1015`). |
| Engine | `engine.ts:900-991` | `approveHitl`: add the same guard for `decidedBy:"human"` + `forceHuman` + short-note → return project untouched or throw typed `codeError("RT_E_VALIDATION", …)` (engine is pure; store/headless callers decide). Headless `approve` (`headless.ts:498`) passes `opts.note` through — CLI operators get the same law. |
| Autopilot | unchanged | `canAutopilotApprove` (`store.ts:228-234`) already excludes `forceHuman` — no note path exists there. |

**Tests**: approve-override with `note:""`/11 chars → refused at store AND engine; 12-char note → approved with `note` in the decision row (`HitlDecision.note`, `types.ts:154-163`); plain approval of a passing gate with no note still works; headless approve passes note. Regression anchors: one per layer, named in `fixes/` entry (check-fix-register §5-3).

### 3.2 Error display + classification completion

- **`console.tsx:4354-4356`**: the catch branch returns `code: null` with prose "Chat backend returned an unparseable response." → change to `code: "RT_E_INTERNAL"` (it IS an internal transport/serialization failure; the badge + `ERROR_CODE_DOC` row already exist at `:4284-4301`/`errors.ts:249-253`). Same for the unparseable-success-shape branch at `:4342-4343`. `ChatOutcome.code` (`:4324`) becomes `string` (never null) — keeps `normalizeCode` (`:4229-4231`) as belt-and-braces.
- **Tombstone distinctness (93 §3.14 P2 note)**: `chat-row-error` class already styles failure rows (`:4271`); keep the "error" role label (`:4269`) — the label + code badge + meaning line (`:4297-4299`) already prevent error rows reading as copilot speech; add one affordance: an error-row **"Retry" chip** that copies the failed text back into the draft (`setDraft(msg.text)`) — the honest retry is a new send, not a silent replay (failure rows are never replayed by `chatHistoryTurns`, `chat.ts:76-94`).
- **Server-side code completeness**: audit result — every `{ok:false}` in `chatOnceServer` carries `code` (`chat.server.ts:276-298` verified); `ChatResult.code` is typed optional (`:36-44`) → make it required-on-failure (narrow the union: `reason:"not-configured"\|"error"` always with `code: ErrorCode`) — compile-time enforcement of §7's inventory for this module.

### 3.3 Empty / dead states (chat + adjacent surfaces)

- Chat initial empty state (`console.tsx:4471-4479`) is honest copy — keep; add the persisted-thread caption when `project.chatLog` is non-empty on first mount: `Thread restored from this build's log · {n} rows` (one line under the header, `:4453-4463` region) so a reload doesn't look like amnesia.
- Dead empty states elsewhere (spec graph "open a brief first" `:2301`, memory "until Phase 0 writes" `:2389` — DF-31) are P2s owned by 93 §6 #15; this lane only registers the pointer here so the Pro sibling doesn't re-derive them.
- **Stop/status honesty**: the busy state must never say "thinking…" for a turn that already errored (send clears busy in `finally`, `:4414-4417` — already correct).

### 3.4 DF-13 — context meter (P1-5 / 42 S4-lite)

**Verified gap**: `CHAT_CONTEXT_MAX_CHARS = 2500` (`chat.server.ts:48`) is invisible; no meter, no version chip. Codex shows "100% context left" [C3, inherited].

**Exact spec (honest-by-construction, no duplicated context logic)**:
- The meter number MUST equal what the server actually uses → compute server-side. In the streaming design (§2.2) the `context` chunk (chars/max/version) rides every reply for free. For the interim (pre-streaming) add the tiniest server fn in `chat.ts` next to `chatServer`: `const chatContextServer = createServerFn({method:"POST"}).validator((input:{project:Project}) => input).handler(async ({data}) => { const { buildChatContext, chatContextVersion, CHAT_CONTEXT_MAX_CHARS } = await import("./chat.server.ts"); const ctx = buildChatContext(data.project); return { chars: ctx.length, max: CHAT_CONTEXT_MAX_CHARS, version: chatContextVersion(ctx) }; })` → client `chatContextInfo(project)`.
- UI (`console.tsx:4453-4463` header): `ChatContextMeter` component — mono line `context {chars.toLocaleString()}/{2500} · v{version}` with a 4-segment bar; refetch on `project.id` / `project.currentPhase` / `project.status` / `project.memory.length` change (deps array in `useEffect`) and after each send. When `project.chatLog`-based turns exist the meter is unaffected (history is separate from the ground context — honest caption tooltip: "grounding block for the next reply").
- No compaction chip yet (42 S4 compaction = flash one-shot summary + `trimTurns`; P1-5 scope is the meter; compaction is a later P-item — the meter is what makes the 2500 budget visible, per [CB] "the context window is the most important resource to manage", 93 §3.14).

**Tests**: `chatContextServer` handler equivalence — chars equals `buildChatContext(project).length` for a fixture project (byte assertion); version changes when memory/gate state changes, stable otherwise (determinism); UI render test is out of scope (0 `*.test.tsx` rig, §13.3 — keep the pure math in `chat.server` tests).

---

## §4 VERIFICATION VISIBILITY (93 DF-15 + DF-16 → P1-1) — wiring spec

**Verified state**: the machine verify-fix loop is real and tested — `generateCases` (`verify.server.ts:446-499`), `runCases` (`:359-443`, anti-forgery exact-id parsing), `verifyAndFixServer` (`:503`, maxIterations 3); client contract `verify.ts:17-31` exists; `headless.ts` has the persistence half — `withCommonJsExports` (`:939-958`) + `applyVerifyOutcome` (`:980-1010`+, stamps `lastTest` label `"tested"` + evidenceHash, appends `verify` artifact + `verify.pass/fail` log). **Reach today**: CLI `verify` verb only (`rapidtool-cli.mjs:529-549`). The Oracle tab (`console.tsx:2321-2342`) renders `project.oracle` prose (A7 `buildTestOracle`, `algorithms.ts:510`) that nothing ever runs; the HITL dock's evidence (`:152-205`) never shows a machine verdict. `p6-verified` probe (`dod.ts:153-171`) exists to be satisfied by exactly this.

**The honest frame (write into the UI copy)**: the A7 oracle prose cases are template acceptance prose, not executable checks (93 DF-15) — the *executable* machine cases live in `verify.server.ts` and are generated from brief+source at run time. The UI fix is to make the machine system visible and its outcomes land in the gate evidence — NOT to pretend the prose cases run.

### 4.1 Extraction (client-safe pure module)

| # | File | Change |
|---|---|---|
| 4.1 | `src/lib/verify.ts` (new home) | Move `withCommonJsExports` + `applyVerifyOutcome` (+ the tiny `VerifyOutcomeShape` type they need) from `headless.ts:929-1010` into `verify.ts` (client-safe: pure, no fs — verified `applyVerifyOutcome` only uses `fnv1a`, `Artifact`, types; `fnv1a` import must be added). Keep `headless.ts` re-exporting both names (`export { withCommonJsExports, applyVerifyOutcome } from "./verify.ts"`) so the CLI surface is untouched (zero consumer break — additive move, verify with `npm run typecheck` + CLI contract tests). |
| 4.2 | `src/lib/verify.server.ts` | Additive outcome field: extend `VerifyOutcome` (`:38-49`) with `caseResults?: CaseResult[]` (`:357` type exists) so the UI can render per-case pass/fail. `verifyAndFixServer` populates it from the final `runCases` pass. Purely additive — `VerifyOutcomeShape` in headless stays loose (`cases?: unknown[]`). |

### 4.2 Store action

| # | File | Change |
|---|---|---|
| 4.3 | `src/lib/store.ts` | `runVerifyAsync: (id: string) => Promise<{ok:true; outcome: VerifyOutcomeShape} \| {ok:false; error: string}>` — pattern: `runModuleReal`/`rejectAsync` (`:1037-1047`). Steps: load project; if `!generatedSource.trim()` → `{ok:false, error:"No generated source yet — run the codegen phases first."}` (mirror `headless.ts:964-966`); call `verifyAndFix` from `./verify.ts` (busy latch like `executeAsync`); apply `applyVerifyOutcome` (pure); commit project; append `logs` `verify.ui` row with `{status, iterations}`; return outcome. `not-configured` outcome → `{ok:true, outcome}` (UI renders the honest state; no artifact minted — `applyVerifyOutcome` already no-ops on not-configured, `headless.ts:985-987`). Do NOT touch `forceHuman`/autopilot paths — verify is advisory evidence, never an approval. |

### 4.3 UI — three surfaces

| # | Surface | Change |
|---|---|---|
| 4.4 | P6 phase card (`console.tsx:1836-1844` "Run module (bounded)" region) | Add button **"Run machine verify (needs API key)"** next to it → `runVerifyAsync`; busy latch; render `outcome.status` inline (passed/failed/not-configured/error + iterations). After `passed`, the `p6-verified` probe becomes satisfiable — the gate drill-down (`:4620-4669`) already renders probes; nothing else needed there. |
| 4.5 | Oracle tab (`console.tsx:2321-2342`) | Split into two labeled blocks: (a) **"Acceptance prose (A7 template)"** — existing `project.oracle` list, now with the honest template caption (93 DF-07 label pattern: "template-derived from the fixed lattice — not runnable checks"); (b) **"Machine verify outcomes"** — list of `verify` artifacts from `project.artifacts` (kind `"verify"`, `applyVerifyOutcome` id prefix `verify-`, `headless.ts:1004-1010`) newest-first: status line + iterations + per-case rows from `caseResults` (4.2) + rerun button (4.4 action). Empty state: "No machine verify run yet — run it from the P6 card." |
| 4.6 | HITL dock evidence (`evidenceForGate`, `console.tsx:152-205`) | When a `verify` artifact exists for the current edge, push an `EvidenceRow` — `id:"verify", text: "Machine verify · {PASSED\|failed\|not-configured} · {n} iterations"`, tone ok/danger/faint — so the approver sees machine evidence at the exact moment of decision (DF-16's "the HITL dock should render VerifyOutcome when it exists", 93 §4.15). Cheap: same scan as `latestRejectionGuidance` (`:2786-2790`). |

**Tests**: pure — `verify.ts` `applyVerifyOutcome` moved-code equivalence (same fixture project → same artifact/log/lastTest as headless before the move; byte-compare artifact bodies); `withCommonJsExports` cases already covered (`headless.test.ts`) — re-run after move; store action unit test with a stubbed server fn (inject via the `verify.ts` import boundary — follow the `exec.ts` DI pattern `exec.ts:27-30` "dependency injection for tests only"); oracle-tab rendering stays out of scope (no `.test.tsx` rig — §13.3 honest note). E2E option: `scripts/browser-smoke-verdict.mjs` precedent can later assert the button exists (P2).

**Roadmap mapping**: this is §10.1 P1-1's "wire, don't build" half for verify (93 §6 #9) + DF-16's fix; the DF-15 prose-oracle honesty label is 93 §6 #4's template-provenance work applied to the Oracle tab.

---

## §5 Production-grade checks (§13) — top 3 by impact/effort, all zero-dep, ship-now

> Rank logic (§13.10): protects the governance claim, zero-dep, single-script-first-step. All verified this pass (package.json read; eslint.config.mjs read; node v22.23.2 flags verified on this host).

### 5-1. `npm run ci` unified gate + coverage + dep scan (§13.10 rows 1+2+5)

**Gap**: scripts = `typecheck/lint/test/check:auth/format` only (`package.json:17-21`); no single "the check"; no coverage run; `npm audit` never invoked.

**Exact change** (`package.json`):
```jsonc
"test:cov": "node --experimental-strip-types --experimental-test-coverage --test-coverage-lines=70 --test-coverage-functions=70 --test-coverage-branches=60 src/lib/*.test.ts src/lib/app-data/app-data.test.ts src/lib/auth/*.test.ts",
"audit:deps": "npm audit --audit-level=high",
"ci": "npm run typecheck && npm run lint && npm run check:auth && npm run test && npm run test:cov && npm run audit:deps"
```
- Coverage scope note: the full glob includes the pure shelf; thresholds (70/70/60) are a starting floor — the *governance core* (`engine.ts`, `dod.ts`, `verify.server.ts`) is what §13.10 row 1 names; start with the whole-suite floor, add a core-only second run (`--test-coverage-include='src/lib/engine.ts'` style, flags verified `node --help` ✓TODAY) once the floor is green. Do NOT set thresholds blindly — run once, read the report, set floors ≥ current measured on the core files, then commit (the gate must fail forward, not trip on day 1).
- `ci` runs `test` twice (plain + cov) — acceptable (cov run doubles as the report); if runtime hurts, make `ci` = `typecheck && lint && check:auth && test:cov && audit:deps` (cov run executes the tests once with coverage) — pick the latter to avoid double execution.
- Honest caveat to document in the script comment: 10 pre-existing `EPERM` symlink failures in `scripts/check-auth-invariant.test.mjs` on Windows (fixes/42 header, verified unchanged baseline) — `npm run test` already surfaces them; do not mask them, exclude only if the suite gains a Windows-skip marker.

**Tests**: none needed (script change); verification = run `npm run ci` once and record the result in the fixes/ entry. **File:line anchors**: `package.json:17-21`.

### 5-2. Generated-code hygiene probes `p6-lint` + `p6-secrets` (§14.6 rows 1+2, E-07 additive pattern)

**Gap**: DOD[6] probes check presence + lastTest only (`dod.ts:126-171`); "never emit secrets" is prompt prose in 4 places (`crew.server.ts:86,87-88,108`, `packet.ts:336` — 93 §14.6 #1 evidence); the P6 harness compiles at runtime only (`verify.server.ts:339-354`) — no lint/secret pass between coder artifact and `p6-verified`.

**Exact change**:
- New pure module `src/lib/code-hygiene.ts` (zero-dep, deterministic, no imports from server modules): `export function hygieneFindings(source: string): { rule: "no-console" \| "no-var" \| "eqeqeq" \| "secret"; occurrences: number; firstLine: number | null; message: string }[]`. Rules: no-console/no-var/eqeqeq = deterministic regexes mirroring `verify.server.ts` `lintFailures` semantics (`:284+` — single implementation home would be better; if the Pro sibling prefers, MOVE `lintFailures` into `code-hygiene.ts` and re-export from `verify.server.ts` to keep its callers; choose the move — one implementation, zero behavior change, verify by existing lint tests); `secret` = gitleaks-class regex set (AWS `AKIA[0-9A-Z]{16}`, GitHub `gh[pousr]_[A-Za-z0-9_]{20,}`, OpenAI `sk-[A-Za-z0-9]{20,}`, DeepSeek `sk-[a-f0-9]{32,}`, `-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY`, generic `(api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}` with case-insensitive key name) — cite gitleaks rule classes [Q2-7, inherited §14.3], deterministic subset, documented as "regex heuristic, not gitleaks".
- Register two **additive** probes in `DOD[6]` after `p6-verified` (`dod.ts:171`): `p6-lint` (criterion "Generated source has no console/var/loose-equality findings", probe = `hygieneFindings(p.generatedSource).every(f => f.rule !== "no-console" && f.rule !== "no-var" && f.rule !== "eqeqeq")`) and `p6-secrets` (criterion "Generated source carries no secret-shaped strings", probe = no `secret` findings). Both read only `p.generatedSource`; empty source → probe logic: `p6-source` already fails then, let hygiene probes return true on empty (avoid double-noise) — spec explicitly.
- Impact honesty: additive probes flip the P6 gate verdict for any project whose generated source violates them. Gate verdicts are recorded at phase completion only (`recordGateInto`, `dod.ts:362`), so **existing completed projects are unaffected**; new runs get the honest FAIL recorded (advisory by default — `enforceDod` semantics untouched, §15.8). The template emitter `buildPhase6Module` (`sandbox.ts:125-161`) must be lint-clean before this lands — run `hygieneFindings` on a generated fixture in tests and fix the template if it trips (that is the point: the floor applies to the emitter too).
- Optionally surface findings in the P6 evidence: `gateArtifact` (`dod.ts:325`) body gains a `Hygiene:` line when findings exist (advisory detail, never silent).

**Tests**: `code-hygiene.test.ts` — each rule's positive/negative fixtures (secret regexes: real-shaped keys detected, benign strings like `tokenizer` not flagged, `sk-` short strings not flagged per length guard); DOD[6] fixture project with/without console.log / secret → probe pass/fail; additive-registry test (new probes present in the P6 gate id list — the "parser list freshness" pattern, §13.4 #3).

### 5-3. `check-fix-register.mjs` — postmortem→guardrail gate (§13.10 row 3)

**Gap**: rich `fixes/` + `audit-bugs/` registers (30+ files) but no enforced link fix-doc → regression test; precedent: `errors.test.ts` doc-sync (`errors.ts:17-26`) and `scripts/check-auth-invariant.mjs` + its test.

**Exact change**: new `scripts/check-fix-register.mjs` (pattern: `check-auth-invariant.mjs` — plain node, zero deps, exits non-zero with file:line):
- Parse every `fixes/*.md` whose front-matter/header contains `**Date**: 2026-09-06` is NOT the rule — instead: **docs created after the gate's adoption date** (an `ADOPTED_AFTER` constant = the day this lands) must carry a `regression-test:` line naming a `*.test.ts`/`*.test.mjs` case that covers the fix; older docs ride an explicit `LEGACY_OK` list (documented, shrinkable).
- Also verify the named test file exists on disk and contains the named case string (grep) — a named-but-nonexistent anchor fails too (that is the 93/§13.6 loop: "every fixed bug must become a permanent check" [Q7][Q15], cited via §13.6).
- Wire into `npm run ci` (5-1) after `check:auth`.

**Tests**: `scripts/check-fix-register.test.mjs` — fixture dir with a compliant doc (passes), a doc missing the field (fails with the file:line), a doc naming a missing test (fails), a legacy doc (passes via LEGACY_OK).

### 5-4. Follow-on (NOT top-3): `npm run eval` corpus harness (93 DF-38 / Phase-0 #5)

**Why not top-3**: no machine corpus exists on disk — the 86/87/88 briefs live in research dossiers, not as fixtures; a golden-corpus layout + headless driver + wrong-product detectors is M effort and is Phase-0 #5's ownership (90 §11.3 row, §10.5 #5). **Spec seed for the Pro sibling**: `research/eval-corpus/` with one JSON per verdict run (`{name, brief, kind, expected: {noWrongProduct: true}}`), a `scripts/run-eval.mjs` that drives `headless.ts` create→run-to-complete per corpus entry and prints per-run: phases sealed, `passed:false` gate count, wrong-product signals (brief nouns absent from P6 artifact body — the DF-01 detector), rejection rate; exit non-zero when `wrong-product complete > 0`. Register the corpus in `sweep73`-style parser-freshness tests later.

---

## §6 RT_E coverage completion + remaining classify-string seams

**Inventory method**: grep `ok: false` across `src/lib/*.ts` (non-test) and classify whether a `code` rides within 3 lines (this pass, verified above). Result:

| Seam | Verified state | AI-agent exposure | Fix (all additive, EXISTING codes — no new code) |
|---|---|---|---|
| `chat.server.ts` | `ChatResult` failure branches all carry `code` (`:276-298`); type has `code?` optional (`:36-44`) | ChatPane + CLI chat | Narrow the union: failures always carry `code: ErrorCode` (compile-enforced) — §3.2. |
| `chat.ts` `chatOnce` catch | `classifyError(err,"RT_E_INTERNAL")` (`:50`) — good | UI | None. |
| Console catch branches | `code: null` (`console.tsx:4342,4355`) | UI | → `RT_E_INTERNAL` (§3.2). |
| `exec.ts` | Full code map (`:17-29` header) — good | Run module UI/CLI | None. |
| `deepseek.server.ts` | Codes on all failure returns (`:174,184,255,266,292,299`) | all LLM paths | None. |
| **`algo-tools.ts`** | 8 `{ok:false, reason}` returns, NO code — type at `:54,134` | CLI `bench/specToAlgorithm/property` verbs | Add `code: ErrorCode` to both result unions; not-configured → `RT_E_LLM_NOT_CONFIGURED` (`:100,110,176,187`); unparseable model payload → `RT_E_VALIDATION` (`:115,193`); propagate upstream `res.code` (`:111,188`). Update `algo-tools.test.ts` fixtures (`:215,305`). |
| **`crew.server.ts`** search seam | `SearchOutcome` `{ok:false, reason?, error?}` NO code (`:537`, normalize at `:557`); not-configured `:731` | CLI crew verb | Add `code?: ErrorCode`; `normalizeSearch` maps `reason:"not-configured"` → `RT_E_RESEARCH_UNAVAILABLE`, else classify the error string via `classifyError(err,"RT_E_RESEARCH_UNAVAILABLE")`; internal crew not-configured returns (`:731,839,932,1024`) → `RT_E_LLM_NOT_CONFIGURED`. `crew.ts` client type (`:135`) + fallback (`:175`) mirror the code. |
| **`report-intake.ts`** | Validation failures return `{ok:false, error}` prose, NO code (`:52-131`); errors.ts already knows `RT_E_REPORT_INVALID` + the `ReportRejectedError` name matcher (`errors.ts:95-99`) which report-intake never throws | CLI `ingest`, store `ingestReport` | Add `code: "RT_E_REPORT_INVALID"` to the `{ok:false}` validation union (`:52`) and stamp every validation return; keep `applyReport`'s `applied:false, reason:"duplicate"/"phase-mismatch"` as RESULTS (not failures — no code; consumers branch on `reason`, `:264`). |
| `engine.ts` `runP6Real` | `{ok:false, result:null}` (`:1954-1978`) — internal, store maps to text | — | Leave (engine-internal, no AI-facing envelope); note in the inventory so nobody "fixes" it into a code that would leak engine internals. |
| `wild-mode.server.ts` | Verdict parser demands `VERDICT:`/`FEEDBACK:` tokens (`:116-129`) — a deterministic OUTPUT contract, not error classification | — | Leave; document as contract-parse, not classify-string. |
| `headless.ts` throws | `verifyGeneratedSource` throws prose when no source (`:964-966`) | CLI | CLI catch classifies; optionally `throw codeError("RT_E_VALIDATION", …)` — additive, matches `phases.ts`/`report-intake.ts` coded-throw precedent (`errors.ts:91-94`). |

**Remaining classify-string seams** (prose pattern-matching where a code should travel): none after the table above — the only remaining prose matches are *output contracts* (wild VERDICT/FEEDBACK) and the engine keyword rejection templates (DF-22 — a different lane's P1, registered here only to prevent re-derivation).

**New code deferred**: `RT_E_ABORTED` — only when the Stop/abort transport lands (§2.1 phase 2). Adding a code requires an `ERROR_CODE_DOC` entry or `errors.test.ts` fails (`errors.ts:14-16`) — note it in the doc when added.

### 6.1 Enforcement (keeps this class dead)

Add to `errors.test.ts` (or a sibling `typed-failures.test.ts`): an inventory test that greps the AI-interface seam files (`algo-tools.ts`, `crew.ts`, `crew.server.ts` search seam, `report-intake.ts`, `chat.server.ts`) for `ok: false` and asserts a `code:` appears within 3 lines — the "parser list freshness" pattern (§13.4 #3) applied to typed failures. This is what makes §6 a permanent check instead of a one-pass audit.

---

## §7 RT_E / verification / chat — cross-cutting test plan summary

| Change | Test home | Assertion core |
|---|---|---|
| chatLog persist | store/engine/io tests | defaults, cap 40, round-trip, legacy-safe hydration |
| chatStreamServer | chat.server.test.ts | chunk order context→delta*→provenance→done; guards; caps; stale tagging parity |
| streamDeepSeek | deepseek tests | SSE parse split-chunk hazard, mid-stream timeout/HTTP error |
| note-symmetry | engine+store+headless tests | forceHuman approve <12 refused; ≥12 lands note in decision |
| verify wiring | verify.ts + store tests | moved-pure equivalence; outcome→artifact/lastTest; not-configured no-op |
| hygiene probes | code-hygiene.test.ts + dod tests | regex pos/neg; additive registry; template emitter clean |
| ci gate | — | run once, record; thresholds from measured core coverage |
| fix-register | scripts/*.test.mjs | compliant/legacy/missing-anchor fixtures |
| typed-failure inventory | errors-side test | no bare `ok:false` in seam files |

**Determinism-preserving notes** (90 §11.4 C.2 / §10.4): all items are additive or presentation-only; no new runtime deps; keyless floors untouched (`chatOnce` stays; verify stays config-gated); no `enforceDod` default change; stream path adds no nondeterminism (context snapshot C2 pattern reused).

---

## §8 Honest negatives (not claimed this pass)

- Streaming through `createServerFn` was verified against official docs ([T1]—typed chunks, generators, error serialization), but **not executed in this tree** (read-only pass). One known ecosystem caveat exists (Cloudflare-specific dev-middleware issue, §9 [T4]) — this app's dev server is Vite/nitro on Node (not Cloudflare), so the caveat is noted, not asserted as a blocker. The Pro sibling must verify with a live smoke before declaring P0-1 done.
- Client-abort/Stop on the fn path: verified *absent from docs*, not proven impossible in the installed `@tanstack/react-start` version — the build agent should grep the installed package's client call for an `AbortSignal` option before committing to the phase-2 raw-fetch route.
- No UI test rig exists (`0 *.test.tsx`, §13.3) — all UI specs above are covered by module/store tests + honest render-out-of-scope notes; deep UI verification remains P2 (per §13.10 row 11).
- Line anchors are from the 2026-09-06 tree (sizes re-verified this pass); ±5 drift tolerance if siblings edit `src/` (90 §11.2 rule 2 — re-grep before patching).

---

## §9 Source register (web-verified THIS pass, 2026-09-06 ✓TODAY)

- [T1] TanStack Start — "Streaming Data from Server Functions": typed `ReadableStream` AND async-generator server functions; client `for await`; example repo linked. https://tanstack.com/start/latest/docs/framework/react/guide/streaming-data-from-server-functions (+ `.md` variant)
- [T2] TanStack Start — "Server Routes": server routes for endpoints "called from outside your Start application"; use server functions when Start should "handle serialization for you"; `server.handlers.{GET,POST}` returning `Response`. https://tanstack.com/start/latest/docs/framework/react/guide/server-routes (+ `.md`)
- [T3] TanStack Start — "Server Functions": POST/GET fns; "Errors are serialized to the client". https://tanstack.com/start/latest/docs/framework/react/guide/server-functions
- [T4] TanStack Router issue #6045 — streaming server-fn responses broken under `@cloudflare/vite-plugin` dev middleware (ReadableStream consumed by h3/srvx) — flagged as ecosystem caveat, Cloudflare-specific. https://github.com/TanStack/router/issues/6045
- Host check: `node v22.23.2` + `--experimental-test-coverage` / `--test-coverage-{lines,functions,branches,include,exclude}` flags verified via `node --help` this pass.
- Inherited same-day fetches (42/93 registers, cited as inherited, not re-fetched): [C1]-[C5] Codex · [D1]-[D7] DeepSeek Harness · [G1]-[G4] Gemini CLI · [A1]-[A8] Antigravity · [Q1]-[Q20] §13 production-checking sources · [Q2-1..16] §14 write-time sources · DeepSeek API facts via 90 §12.3 + `research/deepseek-api.md`.
- **Files created**: `fixes/99_leap_analysis_ux.md` (this file). **No RapidTool source file modified or read-for-modification.**
