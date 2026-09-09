# 32 · Fix Research — cited fix patterns + open-source references for the known bug list (feed to the fix wave)

**Author:** Flash bug-hunter H3 (fix-research agent) · **Date:** 2026-09-06
**Scope:** read-only research pass. Every external source below was fetched this pass (web_extract / curl / GitHub raw); nothing is cited from memory. Dossier anchors (23–28) were re-verified on disk where the fix lands; drift is logged in each section and in §8.
**Deliverable target:** one pattern + cited references + one concrete RapidTool-shaped snippet per known bug, so the parent wave can apply without further research.

Known-bug list mapped to dossiers:

| # | Bug | Primary dossier anchor |
|---|---|---|
| 1 | CLI `retry` subcommand semantics for a parked/rejected phase | 26 G1 (:193-196), 23 C1 row (:164) + queue item 16 (:227) |
| 2 | Structured error-code propagation through CLI wrappers (classify error OBJECTS, not message strings) | 27 Seam A (whole doc; :15, :62, :147), 23 C2 (:173-176), 26 G5 (:199-200) |
| 3 | Chat failed-send rows replaying as assistant turns | 28 F2 (:47-50), 24 FC-11 (:156, :164) |
| 4 | 12-char classifier feedback floor bypass | 23 B4 (:117-120) |
| 5 | Live activity streaming from a Zustand store to a React panel (selector + interval; no re-render storms) | 23 B0/B6 (:80-90), console.tsx WildConsole/ChatPane (verified this pass) |
| 6 | `fs.watch` watcher debounce + overflow handling | 26 G7 watcher row (:94), 23 C1 (:163); `src/lib/watcher.ts` (verified this pass) |
| 7 | Safe CLI retry idempotency for phase re-execution | 23 C3 (:178-181), C4 (:183-186), 27 P0-1 row (:113) |

---

## 1 · CLI `retry` subcommand semantics for a parked/rejected phase

### 1.1 The bug (recap + verified anchors)
- `headless.retry` exists and is unit-tested (`src/lib/headless.ts:523-525` → `unlockRetry`), but `scripts/rapidtool-cli.mjs`'s switch (verified this pass: cases `create`…`doctor` at `:205-491`) has **no `retry` case**; README-cli.md agent loop has no reject→retry branch (26:193-196).
- The reject path parks the project `blocked` with prose "Phase rejected — retry with the note applied." (`headless.ts:381-383` per 26; the engine transition itself is `unlockRetry`, verified `engine.ts:1051-1063`).
- `unlockRetry` is **guarded**: only `rec.status === "rejected" && project.status === "blocked"` re-opens; any other state returns the project untouched (`engine.ts:1058`). That guard is the semantic contract the CLI verb must expose.

### 1.2 What the field proves (cited)
- **Claude Code surfaces "retry with a note" as session continuation, not a bare re-run.** The CLI reference documents `claude -c` / `--continue` ("Load the most recent conversation in the current directory"), `claude -r <id>` / `--resume` ("Resume a specific session by ID or name"), and `--fork-session` ("When resuming, create a new session ID instead of reusing the original") — the retry note travels as a fresh prompt on a resumed session [S1]. The same reference documents the machine-facing discipline RapidTool already mirrors: `-p` print mode with `--output-format json|stream-json`, `--max-turns`, exit-on-error semantics — one JSON envelope per run, agents branch on structure [S1].
- **Aider's loop makes "continue after a no" a first-class verb.** Release history (main branch): "/ok as a shortcut for asking aider to go ahead with the proposed changes, **with optional extra instructions**" [S2]. The human-rejection→refine→re-issue loop is exactly RapidTool's reject→retry-with-note; the *note* is the payload of the next turn, not a flag on the old one. Aider's own failure protocol is "provide GPT with detailed error if it makes a bad edit block, ask for a retry" (v0.10.0 note) [S2] — i.e. error text is *context for the retry attempt*, and automatic retries are capped ("Limit automatic retries when GPT returns a malformed edit response") [S2].
- **Synthesis for a CLI verb:** (a) state-guard the verb (a rejected+blocked phase is the only legal retry target — Claude Code's picker/continue never fabricates a session); (b) the note was already persisted at reject time (`rejectHitl` requires ≥12 chars — `headless.ts:523-525` context, dossier 26:196: "note is already applied at reject time"); (c) wrong-state must be a distinguishable error, not a silent noop (aider surfaces "Failed to apply edit to _filename_" rather than pretending) [S3].

### 1.3 RapidTool-shaped snippet (target: `scripts/rapidtool-cli.mjs`, add next to `approve`/`reject` cases; response envelope via the single `respond()` choke point `:89-110`)
```js
// New verb — mirrors approve/reject shape (:241-270), honors the C5 envelope/exit
// taxonomy (23:189): 0 = applied transition, 1 = cannot-execute (wrong state),
// 2 = still parked (should not happen when the guard passes — defensive).
case "retry": {
  // loadProjectFor() + driver() are the existing per-verb helpers.
  const p = loadProjectFor();                 // throws RT_E_PROJECT_MISSING path (existing)
  const rec = p.phases[p.currentPhase];
  const retryable = p.status === "blocked" && rec?.status === "rejected";
  if (!retryable) {
    // unlockRetry's own guard (engine.ts:1058) means h.retry() would noop —
    // refuse BEFORE calling so the envelope never lies about what happened.
    return respond(
      { ok: false,
        reason: "not-retryable",
        code: "RT_E_PHASE_ILLEGAL",
        error: `Nothing to retry: phase P${p.currentPhase} is ${rec?.status ?? "unknown"} on a ${p.status} project. Only a REJECTED phase on a BLOCKED project can be retried.` },
      1,
    );
  }
  const next = h.retry(p);                    // headless.ts:523 = unlockRetry
  h.saveProject(next);                        // atomic temp+rename (headless.ts:58-74)
  return respond({ ok: true, path, summary: h.summary(next), outcome: "retried" }, 0);
}
```
Exit-code choice: keep `1` for the wrong-state arm (cannot-execute/validation bucket, per README-cli.md:287-294 taxonomy — verify `approve`/`reject` no-gate arms `:243-255` use the same bucket and reuse their `code` idiom; dossier 23 C2 pins those as `RT_E_GATE_PENDING` for approve/reject, so a *reject-shaped* guard may prefer `RT_E_GATE_PENDING` here too — apply-time pick per the site's convention).
Acceptance: mirror `headless.test.ts:211` ("reject → retry → regenerate applies the note and unblocks") at CLI level + a reject→retry→gate exit-taxonomy test (26:196). README-cli.md row + agent-loop branch added in the same change (26:251).

---

## 2 · Structured error-code propagation through CLI wrappers (classify thrown error OBJECTS, not message strings)

### 2.1 The bug (recap + verified anchors)
- `respond()` (`rapidtool-cli.mjs:96-104`) classifies **prose only**: it extracts `out.error`/`out.reason` strings and runs them through `classify(text)`; `ensureErrorCodes()` (`:128-138`, verified this pass) deliberately stores only a **text wrapper** around `classifyError`. The real error object never reaches the classifier.
- `classifyError` (`src/lib/errors.ts:64-106`, verified this pass) is already object-aware — it walks the cause chain (≤4) and matches `link.name === "ReportRejectedError"`, errno, and — crucially — **`link.code` starting with `RT_E_` wins immediately** (`errors.ts:71-75`). The `phases.ts:120`-style coded-error convention already exists server-side. The CLI is the one seam that stringifies before classifying → every report rejection exits `RT_E_UNKNOWN` (27:15, P0-1; README-cli.md:308-310 promises codes that cannot fire).
- `ReportRejectedError` (`headless.ts:536-541`) carries no `code` prop (27:113) — its name branch works only when the **object** is classified.

### 2.2 What the field proves (cited)
- **Classify the error object's structured fields; message text is a last resort.** openai-node's `APIError` keeps `status`, `error` (body), `code`, `param`, `type`, `requestID` as **typed readonly fields** on the thrown object and derives its subclasses per HTTP status (`AuthenticationError`, `RateLimitError`, …); `APIConnectionError` carries `cause`. Consumers branch on class/field, never on `.message` substrings [S4].
- **Coded errors must survive wrapper hops.** The same SDK's `APIError.generate()` re-wraps at the transport boundary but *preserves* the decoded fields; Node's own convention is `err.code` (e.g. `ENOENT`, `ETIMEDOUT`) plus `err.cause` for wrapped chains — RapidTool's cause-chain walk already follows it.
- **Synthesis:** (a) throwers attach `code` (phases.ts precedent); (b) wrappers pass the **object or its `code`** forward (drop the message-only reduction); (c) the classifier fast-paths a present `RT_E_*` code before any name/errno/prose matching (already true in `errors.ts:71-75`).

### 2.3 RapidTool-shaped snippet (target: `scripts/rapidtool-cli.mjs`)
```js
// ensureErrorCodes() — expose the OBJECT classifier (drop the text-only reduction, :128-138).
if (typeof mod.classifyError === "function") {
  classifyObject = (err) => {
    try {
      // fast-path a carried code BEFORE prose (errors.ts:71-75 does this on the object —
      // it can never fire today because the CLI hands it a string)
      if (err && typeof err.code === "string" && /^RT_E_[A-Z0-9_]+$/.test(err.code)) return err.code;
      const code = mod.classifyError(err);        // walks name/errno/cause on the REAL object
      return typeof code === "string" && /^RT_E_[A-Z0-9_]+$/.test(code) ? code : null;
    } catch { return null; }
  };
}
```
```js
// respond() keeps its exit-3 pin (:94-95); only the error arm changes (:96-104):
// result may now carry the original error object: respond({ok:false, error: err}, 1)
//   → out.code = codeOf(out.error) ?? classifyObject(out.error) ?? undefined
// Call sites that currently stringify must stop doing so:
//   ingest catch (cli.mjs:304,309):  respond({ ok:false, error: err.message ?? String(err), code: classifyObject(err) }, 1)
//     — ReportRejectedError name branch + /phase/i mapping (errors.ts:90-94) then fires;
//       expected RT_E_REPORT_PHASE_MISMATCH / RT_E_REPORT_INVALID (27 P0-1).
//   approve/reject no-gate arms (:243-255): pre-supply code:"RT_E_GATE_PENDING" literals (23 C2).
//   reject short-note arm (:259-263): pre-supply code:"RT_E_VALIDATION" (23 C2).
```
Optional hardening (27:113): give `ReportRejectedError` a `readonly code: ErrorCode` prop mirroring `phases.ts:120`, so even a future wrapper that loses the class keeps the code.
Acceptance: `errors.test.ts` gains a CLI-path case: `classifyObject(new ReportRejectedError("Invalid report: …phase…", p))` → `RT_E_REPORT_PHASE_MISMATCH`; live CLI smoke: ingest a wrong-phase report → envelope `code` present, exit 1 (27:81,147).

---

## 3 · Chat failed-send rows replaying as assistant turns (chat-history hygiene)

### 3.1 The bug (recap + verified anchors)
- `send()` builds LLM history from **all** visible rows: `msgs.slice(-12).map(...)` (`console.tsx:4305-4307`, verified this pass) and failure turns are stored with `role: "assistant"` (`:4320-4329`, `error: true, code`). The server filter (`chat.server.ts:208-215`) can't tell them apart. Consequences (28 F2): raw provider prose or "Chat failed." reads as copilot speech in the next grounded call; 6 consecutive failures wipe the real dialogue window. Failure rows also carry the header `copilot · hh:mm` (`:4210-4211`).

### 3.2 What the field proves (cited)
- **Errors are message metadata, never message content — and they never re-enter the model context.** Vercel AI SDK's `useChat` models exactly this: every message carries `status: 'submitted' | 'streaming' | 'ready' | 'error'`, the hook exposes a separate `error` object "to show an error message, disable the submit button, or show a retry button", and `regenerate()` "regenerates the last assistant message" from the **last user content** — the failed attempt is not replayed as an assistant turn [S8][S9]. The docs' error-handling page even shows the alternative: "replace the failed user message with new input. If the assistant response started streaming before the error, remove both the partial assistant response and its user message" — i.e. failed content is *removed from the conversation*, and retry re-sends the *user's* message [S8].
- **Retry affordance is part of the error state.** `regenerate`/`stop`/`clearError`/`error` are the canonical retry surface (24 FC-11 already specs a Retry button on the last failed row using `send(promptOverride)` — same mechanism as the chips at `console.tsx:4419`) [S8][S9].
- **Synthesis for RapidTool:** the model-visible history and the display list are **different projections** of the transcript. Display keeps the error row (history is the record); the LLM history projection drops `error` rows entirely.

### 3.3 RapidTool-shaped snippet (target: `src/components/console.tsx` + pure helper)
```ts
// Pure helper beside the ChatTurn type (console.tsx or src/lib/chat.ts — 28 F2(b))
// Rule: the model-visible window = last 12 NON-ERROR turns, order preserved.
export function chatHistoryTurns(rows: readonly ChatMsgView[]): ChatTurn[] {
  return rows
    .filter((m) => !m.error)          // failure rows are UI record, not conversation
    .slice(-12)                        // window over real turns only (28 F2-a)
    .map((m) => ({ role: m.role, text: m.text }));
}

// console.tsx:4305-4307 in send():
const history = chatHistoryTurns(msgs);
// (label fix rides along — :4210-4211 renders "failed"/"error" instead of "copilot" when msg.error — 28 F2-c/F9)
```
Unit cases (28 F2-b): error rows excluded; window = last 12 non-error rows when failures interleave; order preserved. Server-side stays as-is (its filter now only ever sees real turns).

---

## 4 · 12-char classifier feedback floor bypass (robust output parsing: verdict extraction + length enforcement)

### 4.1 The bug (recap + drift note)
- Dossier 23 B4: a reply of just `"VERDICT: approve"` fell back to the whole trimmed reply as `feedback` (17 chars ≥ 12) and passed both the classifier guard (`wild-mode.server.ts:163-170`) and the engine floor (`engine.ts:2103-2108`), logging a "review" with zero critique.
- **Drift verified at research time:** `parseWildReview` on disk NOW requires the `FEEDBACK:` marker and enforces the floor inside the parser (`wild-mode.server.ts:116-126`: `if (!feedbackMatch) return null;` + `feedback.length < WILD_FEEDBACK_MIN → null`), and `createWildClassifier` re-checks the floor on the parsed value (`:163-170`). The engine re-check stands (`engine.ts:2103-2108`). **B4's core fix appears already landed — the wave should verify, not re-apply** (see §8 drift log; if it is landed, the remaining value of this section is the *generalized* parsing contract + regression tests below).

### 4.2 What the field proves (cited)
- **Contract-first parsing beats prose coercion.** OpenAI Structured Outputs: schema conformance is enforced so you "don't need to worry about the model omitting a required key" and there is "no need to validate or retry incorrectly formatted responses"; SDK helpers parse straight into a schema object (`zodResponseFormat(...)` + `.message.parsed`) [S10].
- **Length/truncation is a distinct failure mode that must be detected, not papered over.** The same guide's client examples check `response.status == INCOMPLETE` and throw "The JSON response is incomplete." instead of parsing a truncated payload [S10] — the analogue of RapidTool's honest-error pause (`wild-mode.server.ts:155-162`).
- **Synthesis for marker-text parsing:** (a) extraction targets the *value after* the required marker only; (b) a missing required marker ⇒ unparseable ⇒ honest error (never fall back to the whole reply); (c) length enforcement applies to the **extracted, trimmed value**, never the serialized line with keys/colons counted.

### 4.3 RapidTool-shaped snippet (shape reference if the wave re-touches it; keep the landed semantics)
```ts
// wild-mode.server.ts — parseWildReview contract (landed semantics preserved):
// 1) verdict token required; 2) FEEDBACK marker required; 3) floor on the EXTRACTED
// value only. Marker labels must never contribute characters to the floor.
const feedbackMatch = /FEEDBACK\s*:\s*([\s\S]*)$/i.exec(trimmed);
if (!feedbackMatch) return null;                       // honest unparseable (23 B4 fix)
const feedback = feedbackMatch[1].trim();
if (feedback.length < WILD_FEEDBACK_MIN) return null;  // floor on content, not line
```
Regression tests (23 B4 / 25 B8, add if absent): `parseWildReview("VERDICT: approve") === null`; `parseWildReview("VERDICT: approve\nFEEDBACK: ok looks fine") === null` (7 chars); `parseWildReview("VERDICT: approve\nFEEDBACK: " + "x".repeat(12))` parses; prose around markers still parses; engine floor test with a stubbed reviewer returning a 5-char feedback → `kind:"error"` no verdict row (engine.ts:2103-2108).

---

## 5 · Live activity streaming from a Zustand store to a React panel (selector + interval patterns, no re-render storms)

### 5.1 The bug (recap + verified anchors)
- `WildConsole` (console.tsx:589+) renders live wild activity by **polling** the store with `getState()` inside a `setInterval` (`WILD_POLL_MS = 1100`, `:242`, `:715`) with incremental ref cursors (`:603-606`) and a capped feed (`slice(0, 40)`, `:710`). Sound core — but: (a) every tick calls `setClock(Date.now())` **unconditionally while wild is enabled**, even when the run is idle (`:656`) → the strip re-renders every 1.1 s for no new data; (b) consumers subscribe to the **whole store**: `const { llmStatus, autopilot } = useRapid()` in `ChatPane` (`:4288`, verified this pass) and whole-store destructures at `:978`/`:1125` — zustand's default identity selector re-renders on *any* store write (a persisted store that rewrites projects on every step, decision, or log).
- Related drift: dossier 23 B0 (store contract "never landed") is **out of date** — the four wild actions + `select` are implemented at `store.ts:520-586` with the ST-6 per-id serialization chain at `:105-130` (verified). The streaming polish in this section is what remains.

### 5.2 What the field proves (cited)
- **Selectors decide when you re-render; equality decides whether.** Zustand: "When you need to subscribe to a computed state from a store, the recommended way is to use a selector. The computed selector will cause a rerender if the output has changed according to `Object.is`" — and a computed object/array selector must be wrapped in `useShallow` or every store change rerenders you ("This change causes BearNames rerenders even though the actual output … has not changed according to shallow equal") [S12].
- **Snapshots must be cached, and subscriptions stable.** React's `useSyncExternalStore`: "repeated calls to `getSnapshot` must return the same value… If you always return a different value, you will enter an infinite loop"; also, a `subscribe` function defined inline causes re-subscribe every render — hoist it [S11].
- **Interval reads are fine when they diff against cursors and only setState on change** (the pattern WildConsole already has); the leak is *unconditional* setState on a timer tick with nothing new, plus whole-store subscriptions that defeat the selector machinery.

### 5.3 RapidTool-shaped snippets (targets: `console.tsx:715-721`, `:4288`, `:978`/`:1125`)
```tsx
// (a) ChatPane:4288 — narrow whole-store destructure to two selectors:
const llmStatus = useRapid((s) => s.llmStatus);   // primitive/stable object → re-render only on change
const autopilot = useRapid((s) => s.autopilot);
// If a multi-field object is ever needed: useRapid(useShallow((s) => ({ a: s.a, b: s.b })))
// from "zustand/react/shallow" — never a bare inline object selector (Object.is → storm, S11/S12).

// (b) WildConsole tick (console.tsx:654-721) — clock writes only when a live run needs them:
const tick = () => {
  const st = useRapid.getState();
  const proj = st.projects.find((p) => p.id === projectId);
  if (!proj) return;
  const w = wildStateOf(proj);
  const running = w.run?.active === true && w.run?.paused !== true;
  // feed diff unchanged (cursor refs, dedupe, cap 40) …
  if (rows.length) setFeed(...);
  if (running) setClock(Date.now());   // :656 — was unconditional per tick
};
// (c) hoist/dedupe the project lookup if WildConsole's parent subscribes whole-store (:978/:1125):
//     parent selects `useRapid((s) => s.projects.find((p) => p.id === id))` — the .find result is
//     referentially stable while THAT project is untouched; combined with (a)/(b) the panel only
//     re-renders when its own project object or its clock actually changes.
```
Acceptance: typecheck clean; React strict-mode double-interval guard already present (`alive` flag, `:653`); devtools verify: editing another project's state does not re-render the open ChatPane (selector check), and an idle wild-enabled strip stops re-rendering (no `setClock` while not running).

---

## 6 · `fs.watch` watcher debounce + overflow handling

### 6.1 The bug (recap + verified anchors)
- `src/lib/watcher.ts` (read in full this pass) already debounces to one batch per quiet window (`flush()` `:60-72`, `DEFAULT_DEBOUNCE_MS = 800`), caps pending at `PENDING_CAP = 200`, records listener errors, and stops idempotently. **The overflow gap:** when the cap is hit the event is *silently dropped* — `if (rec.pending.size >= PENDING_CAP) return;` (`:117`) — with no overflow signal, no reconciliation, and no note in `watcherNotes()`. For a reverse-handoff capture tool (agent writes files, orchestrator learns about them — header contract), a silent drop = a missed handoff file. Secondary: `filename === null` events are ignored (`:115` — Node documents this happens), and kind labels are best-effort probes (header honest about it).
- Module is a declared orphan (26:94 G7) — fixes are opt-in tooling hardening, no app behavior changes.

### 6.2 What the field proves (cited)
- **Node itself warns the raw API is lossy:** "The `fs.watch` API is not 100% consistent across platforms"; on Linux/macOS the watch binds an **inode** — delete+recreate gets a *new* inode and "events for the new inode will not be emitted"; and the `filename` callback argument is "not always guaranteed to be provided… have some fallback logic if it is `null`" (the docs ship exactly that fallback sample) [S13]. `fs.watchFile` (stat polling, default interval 5007 ms) is the documented degraded-mode alternative [S13].
- **Normalize editor write patterns.** Chokidar exists because raw events fire twice, report useless `rename`, and miss atomic writes; its `atomic` (temp+rename) and `awaitWriteFinish` (chunked writes → single event after a stability window) options are the canonical debounce story [S14]. When inotify limits are exhausted (`ENOSPC`), chokidar's documented recovery is `usePolling: true` (fall back to `fs.watchFile`) [S14].
- **Overflow ⇒ reconcile by full re-scan — never silently continue the delta.** Watchman: when the kernel cannot buffer the event rate it "detects the overflow and signals `IN_Q_OVERFLOW`. **The recovery is to recursively scan the root** to make sure that we know what is really there and re-sync with the notification stream"; recrawls mark files changed, so clients should treat them as reconcile events [S15]. The inotify(7) man page says the same in kernel terms: races "may leave the cache inconsistent… do some consistency checking, and rebuild the cache when inconsistencies are detected" [S16].
- **Litestream generalizes the pattern to change streams:** WAL pages are the "event log"; "if Litestream detects that there is a break in the WAL frames then it will automatically start a new generation … with a snapshot. This ensures we always have a contiguous set of files to replay even if Litestream is stopped and misses WAL frames" [S17] — gap detection ⇒ full resnapshot ⇒ resume.

### 6.3 RapidTool-shaped snippet (target: `src/lib/watcher.ts`)
```ts
// (1) Overflow becomes a latch, not a silent drop (:117):
interface ActiveWatcher { /* …existing… */ overflowed: boolean; }
// in the fs.watch callback, replace `if (rec.pending.size >= PENDING_CAP) return;` with:
if (rec.pending.size >= PENDING_CAP) { rec.overflowed = true; return; }
// (2) flush() reconciles when the stream was ever overrun (watchman-style full rescan, S15):
async function flush(rec: ActiveWatcher): Promise<void> {
  rec.timer = null;
  if (rec.overflowed) {
    rec.overflowed = false;
    rec.pending.clear();
    const changes = await rescanQualifying(rec.dir); // full walk → emit current truth as one
    // "changed/created/removed" batch (compare against rec.pending-driven last-known set);
    // kind derivation may mark all as "changed" — consumers treat it as a reconcile (S15).
    rec.flushed += changes.length;
    try { rec.onChange(changes); } catch (err) { rec.errors.push(`onChange listener threw: ${(err as Error).message}`); }
    return;
  }
  /* …existing pending-batch path… */
}
// (3) surface state: watcherNotes() adds `overflowed: true → "event queue overflowed — last flush was a full rescan"`.
```
```ts
// (4) Debounce/normalization hardening per the editor-save reality (S13/S14) — shape:
//   • keep the 800 ms quiet-window batch (already correct for rename storms);
//   • kind probe today is existsSync at event time (:119) — the documented rename/change
//     double-fire and atomic tmp→rename patterns mean a "removed" followed by "created"
//     within one window should collapse to "changed": set semantics on the pending Map
//     already collapse duplicate paths — only the kind needs the collapse rule;
//   • filename===null events (:115): do NOT ignore — treat a null-filename event on a
//     watched dir as an overflow-equivalent (unknown scope ⇒ schedule a reconcile), per
//     Node's "don't assume filename is always provided" caveat (S13).
//   • optional degraded mode: if the watcher errors with ENOSPC/EPERM (chokidar S14),
//     record `degraded:true` in watcherNotes and advise/fall back to fs.watchFile polling.
```
Tests (`watcher.test.ts` exists): flood >200 distinct qualifying files in one quiet window → exactly one onChange batch, `overflowed` surfaced, no silent loss (files present in the rescan batch); rapid delete+create of the same path in one window → single "changed" (not removed+created); null-filename event → reconcile scheduled.

---

## 7 · Safe CLI retry idempotency for phase re-execution (idempotency-key patterns)

### 7.1 The bug (recap + verified anchors)
- The mutation spine is *mostly* idempotent already (23 C4): `saveProject` atomic temp+rename (`headless.ts:58-74`); `applyReportResult` fingerprint ids make ingest a no-op on duplicates; `recordGateInto` replaces per-phase; `hardDodBlockInto` replaces per phase (`dod.ts:480-485`).
- Known lies/caveats: **C3** — `headless.ingest` discards `applyReportResult`'s `applied` flag and the CLI hardcodes `applied: true` (`cli.mjs:294`) so an agent cannot detect a no-op replay; **C4-CAVEAT1** — `create` silently overwrites an existing `--out` file (`cli.mjs:208-211`); **C4-CAVEAT2** — `verify --apply` re-stamps on repeat (`headless.ts:961`); **27:113** — `ReportRejectedError` thrower lacks a `code` prop (see §2).
- For `retry` itself: `unlockRetry` (`engine.ts:1051-1063`) is **naturally idempotent** — the second call on an already-unblocked project returns the project untouched (`:1058`). The verb must report that honestly instead of pretending a second unlock happened.

### 6/7.2 What the field proves (cited)
- **Idempotent endpoints + honest replay = safe retries.** Stripe: "implement server endpoints so that they're idempotent… they can be called any number of times while guaranteeing that side effects only occur once"; a client "can ensure the convergence of its own state with the server's by retrying, and can continue to retry until it verifiably succeeds" [S6]. AWS's idempotency-key design adds the two rules that matter for CLI phase re-execution: the server **stores the request parameters alongside the client key**, and "we receive a unique client request token that we have seen before, but there is a parameter combination that is different from the earlier request… we return a validation error indicating a parameter mismatch" — a replayed key with *different* inputs must NOT silently re-run [S5].
- **Synthesis for RapidTool's CLI:** (a) every mutation returns a result that distinguishes `applied` from `noop` (fingerprint equality = replay); (b) a retried phase transition reports `outcome: "retried" | "noop"` — the state record (phase `rejectedAt`/blocked marker) is the natural idempotency key, and `unlockRetry`'s guard *is* the replay detector; (c) destructive writes check-then-write (create `--out` exists → error unless `--force`).

### 7.3 RapidTool-shaped snippets
```ts
// (a) C3 — headless.ingest returns the flag (headless.ts:544; keep a 2-arg facade if tests pin it):
export function ingest(project: Project, rawReport: unknown): { project: Project; applied: boolean; reason: "applied" | "duplicate" } {
  const v = validateReport(rawReport, project.currentPhase);
  if (!v.ok) { /* …existing trail + throw… */ }
  const r = applyReport(project, v.report);        // applyReportResult → {applied:false} on fingerprint dup
  return { project: r.project, applied: r.applied, reason: r.applied ? "applied" : "duplicate" };
}
// cli.mjs:294 → respond({ ok: true, path, summary, applied: res.applied }, 0)   // envelope never lies

// (b) retry verb replay honesty (see §1.3) — unlockRetry is the replay detector (engine.ts:1058):
const next = h.retry(p);
const outcome = next === p ? "noop" : "retried";   // second identical retry → noop, exit 0, honest envelope
respond({ ok: true, path, summary: h.summary(next), outcome }, 0);
// Idempotency-key framing for docs: key = `${projectId}:P${phase}:${phaseRecord.rejectedAt}`;
// a "retry" whose key is already spent returns the recorded unlock (outcome:"noop") instead of re-running.

// (c) C4-CAVEAT1 — create overwrite guard (cli.mjs:208-211):
if (existsSync(out) && !flags.force)
  return respond({ ok: false, code: "RT_E_VALIDATION", error: `Out file exists: ${out} — choose a new --out path or pass --force.` }, 1);

// (d) C4-CAVEAT2 — verify --apply no-op when the verdict is already applied (headless.ts:961):
if (project.lastTest?.evidenceHash === outcome.evidenceHash) return project; // no re-stamp, no dup artifact
```
Acceptance: CLI double-`retry` → first exit 0 `outcome:"retried"`, second exit 0 `outcome:"noop"` (both one-JSON); double `ingest` of the same report → `applied:false` second time; `create` on existing path → exit 1 `RT_E_VALIDATION`; `verify --apply` twice → one artifact.

---

## 8 · Anchor drift log (verified this pass 2026-09-06; reconcile before applying)
- `console.tsx` is 4,872 lines; ChatPane at `:4287`, `send()` at `:4302-4335`, history slice `:4305-4307`, error-row store `:4320-4329`, whole-store destructure `:4288`, WildConsole at `:589`, `WILD_POLL_MS` `:242`, interval `:715`, `setClock` `:656`. Matches dossier 24/28 anchors (no drift).
- `rapidtool-cli.mjs` switch cases verified: `create 205 · run/gate 215-216 · approve 241 · reject 252 · ingest 271 · packet 316 · export 330 · summary 344 · vault 350 · search 363 · crew 378 · verify 401 · design 445 · diagram 464 · artifacts 484 · doctor 491` — **no `retry` case** (26 G1 confirmed open).
- `errors.ts:71-75` already fast-paths a carried `RT_E_*` `err.code` and walks the cause chain — the *only* dead seam is the CLI's string-only `classify()` (`cli.mjs:128-138`).
- `engine.ts:1051-1063` `unlockRetry` guarded (rejected+blocked only, else untouched) — idempotency-by-construction confirmed.
- **Post-dossier landings (do not re-apply):** `store.ts:520-586` now implements the four wild actions + `select` (dossier 23 B0 was stale by 08:46); ST-6 chain at `store.ts:105-130`. `wild-mode.server.ts:116-126` already requires the FEEDBACK marker + enforces the 12-char floor in-parser (dossier 23 B4's core fix appears landed — verify, add the regression tests if absent, and keep the engine re-check).
- Dossier-23 line refs for `store.ts:504`/`console.tsx:784` typecheck errors were pre-landing; typecheck status must be re-run at apply time regardless.

## 9 · Sources (all fetched 2026-09-06; title = what this doc used them for)
- **[S1]** Claude Code — CLI reference (Anthropic). `-c/--continue`, `-r/--resume`, `--fork-session`, `-p --output-format json|stream-json`, `--max-turns`. https://docs.anthropic.com/en/docs/claude-code/cli-reference
- **[S2]** Aider — Release history. `/ok` "go ahead … with optional extra instructions" (main); v0.10.0 "Provide GPT with detailed error if it makes a bad edit block, ask for a retry"; "Limit automatic retries when GPT returns a malformed edit response". https://aider.chat/HISTORY.html
- **[S3]** Aider — File editing problems ("Failed to apply edit to _filename_", context discipline). https://aider.chat/docs/troubleshooting/edit-errors.html
- **[S4]** openai-node — `src/core/error.ts` (raw). Typed `APIError` fields (`status/error/code/param/type/requestID`), per-status subclasses, `cause`. https://github.com/openai/openai-node/blob/master/src/core/error.ts
- **[S5]** AWS Builders Library — "Making retries safe with idempotent APIs" (client tokens stored with params; changed params on a replayed key ⇒ validation error). https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-apis/
- **[S6]** Stripe engineering blog — "Designing robust and predictable APIs with idempotency" (idempotent endpoints; retry until verifiably succeeds). https://stripe.com/blog/idempotency
- **[S7]** Stripe API docs — Idempotent requests. https://docs.stripe.com/api/idempotent_requests — *fetched but hCaptcha-blocked (content unusable); listed for completeness only — claims rest on [S5][S6].*
- **[S8]** Vercel AI SDK — UI Error Handling (error object ⇒ message/disable/retry; "replace the failed message"; remove partial assistant + user message). https://ai-sdk.dev/docs/ai-sdk-ui/error-handling
- **[S9]** Vercel AI SDK — `useChat` reference (message `status:'submitted'|'streaming'|'ready'|'error'`, per-message error, `regenerate`, `stop`, `clearError`, `setMessages`). https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- **[S10]** OpenAI — Structured Outputs guide (schema conformance; `zodResponseFormat`; INCOMPLETE-status truncation detection). https://platform.openai.com/docs/guides/structured-outputs
- **[S11]** React — `useSyncExternalStore` reference (cached `getSnapshot`; stable `subscribe`). https://react.dev/reference/react/useSyncExternalStore
- **[S12]** Zustand docs — "Prevent rerenders with useShallow" (selector equality; computed selectors need `useShallow`). https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/prevent-rerenders-with-use-shallow.md (repo copy of zustand.docs.wundergraph.com/guides/prevent-rerenders-with-use-shallow)
- **[S13]** Node.js — `fs` docs: `fs.watch` Caveats / Availability / Inodes / Filename argument (incl. the `filename`-null fallback sample); `fs.watchFile` default interval 5007 ms. https://nodejs.org/docs/latest/api/fs.html
- **[S14]** Chokidar — README (`atomic`, `awaitWriteFinish`, `usePolling` fallback on inotify exhaustion, event normalization). https://github.com/paulmillr/chokidar
- **[S15]** Watchman — Troubleshooting: Recrawl (IN_Q_OVERFLOW ⇒ full recursive rescan + re-sync; macOS `UserDropped` equivalent). https://facebook.github.io/watchman/docs/troubleshooting
- **[S16]** inotify(7) man page (consistency checking / rebuild cache on detected races). https://man7.org/linux/man-pages/man7/inotify.7.html
- **[S17]** Litestream — "How it works" (v0.3): WAL-frame break ⇒ automatic new generation + snapshot; contiguous replay. https://litestream.io/v0.3/how-it-works/
