# 109 — Runtime error/telemetry architecture: event taxonomy, capture points, bounded storage, wild-loop watchdog, `diagnose` verb

- **File:** `fixes/109_runtime_log_design.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`).
- **Role:** FLASH LOG-DESIGNER (runtime error/telemetry architecture lane).
- **Date:** 2026-09-06. Trigger: user hit a **browser freeze in Wild Mode with zero diagnostics available** — no capture of the freeze, no crash tail, no way for an AI agent to ask "what happened?".
- **Discipline (strict):** READ-ONLY on source. No source file was edited or will be edited by this lane. The only artifact is this spec. Every `file:line` anchor below was **verified against the working tree on 2026-09-06** (grep/sed reads); anchors are stated as `file:line` of the *current* tree, not post-change lines.
- **Consumers:** PRO implementer lane (fixes wave ≥110) implements §8. Analyzer lanes may quote the taxonomy (§2) and capture map (§3).
- **Additive-only rule (kept from errors.ts:18-20):** this design adds NO new RT_E_* codes to `ERROR_CODES` — the existing registry (errors.ts:22-37) plus event-name taxonomy covers every new failure class. New telemetry rows *carry* an optional `code` drawn from the existing registry. Any future code addition must follow errors.ts:22-37 + `ERROR_CODE_DOC` (errors.ts:183-254) + the errors.test.ts sync test.

---

## §0 — The failure class this design exists for

Observed incident (user report, 2026-09-06): **Wild Mode active → browser tab froze → user had to kill the tab → nothing was recoverable**: no error, no ledger row, no console dump, no crash report. Post-incident analysis was impossible because:

1. There is **no global `error`/`unhandledrejection` capture** anywhere in the client (verified: no `window.onerror`, no `addEventListener("error"…)`, no `unhandledrejection` in `src/routes/**`, `src/components/**`, `src/lib/**`).
2. The React error boundary **renders a fallback but performs no reporting side effect** (error-component.tsx:50-86).
3. The only machine-readable event store, `Project.logs` (JsonLog), is a **human-prose ledger**: `{ts, phase, level, event, detail}` (types.ts:113-119) — no scope/module, no RT_E code, no stack, no context payload, no duration, no session id. Wild ledger rows carry rich *event strings* but the *error* rows collapse to `detail: "Wild step failed: <msg>"` (engine.ts:2597).
4. The Wild-Mode step driver (store.startWildRun store.ts:710-800) has an **iteration cap (20, store.ts:769) but no wall-clock step budget, no heartbeat, no stall detection**; the UI fires it fire-and-forget (`void wildStart(project.id)`, console.tsx:540) and the poller (console.tsx:728) only streams `wildRun` state.
5. Errors that are caught are **silently swallowed or envelope-only**: store.ts:425-427, store.ts:1125, store.ts:1142, store.ts:1246-1248, console.tsx:955-960, console.tsx:971-973 — no side channel ever learns they happened.
6. There is no persistence layer for runtime diagnostics: a crash tail survives only if it was written **before** the freeze, in a store that survives reload (localStorage), or to disk (CLI).

Design goals (numbered so the implementer can tick them):

| # | Goal |
|---|---|
| DG-1 | Capture **every** crash/error/telemetry event class in one bounded, schema'd, serializable stream. |
| DG-2 | Make every captured row **AI-agent readable**: machine fields (event, code, scope, phase), never prose-only. |
| DG-3 | Give every important event a **stable capture point** (file:line) so post-incident analysis maps a row back to code. |
| DG-4 | Keep storage **bounded** in every host (client ring ≤ 200 rows / ~64 KB; disk NDJSON size-capped + rotated). |
| DG-5 | Detect the **wild-loop freeze class** (stalled step, blocked main thread, dead heartbeat) and leave a recoverable tail. |
| DG-6 | Ship a **`diagnose` verb** (CLI + UI) emitting ONE JSON an agent can consume to answer "what happened and what do I do". |
| DG-7 | **Zero hallucination**: rows only ever contain observed facts; heuristic output is labeled `mostLikelyCause` + ranked `candidates`, never a fabricated "root cause". |
| DG-8 | Engine/lib purity preserved: `engine.ts`, `headless.ts`, `errors.ts`, `types.ts` stay side-effect-free; telemetry enters through an **optional injected sink** (`opts.onEvent`) or host glue, never a module-level side effect. |

---

## §1 — Current logging surface audit (verified)

### 1.1 The ledger (`Project.logs`, JsonLog)

| Where | Anchor (verified) | What it does |
|---|---|---|
| JsonLog type | types.ts:113-119 | `{ts, phase, level: "info"\|"warn"\|"error", event: string, detail: string}`. Human-first; no code/scope/stack/context/session. |
| Initial rows per phase | engine.ts:271-282 | `phase.enter` / `phase.regenerate` info rows created inside `synthesizePhase`. |
| Ring cap | engine.ts:2198 | `wildLog` appends `[...p.logs, row].slice(-200)` — the ONLY general ledger append helper; 200-row cap. |
| Other ledger append sites | engine.ts:601 (healLogs), 1084 (overrideLogs), 1222-1236 (store rejectAsync guidance row, `slice(-200)` at 1235), 1280-1289 (clone row), store.ts:750 (wild.start) | All funnel through the same `{ts,phase,level,event,detail}` shape + 200 cap. |
| Ledger render (UI) | console.tsx:2423-2431 | "Diagnostics" rail renders `project.logs.slice(-10).reverse()` (2425), event + detail only; rail header at 2423, SettingsDialog mounts at 2435. |
| Ledger render (wild feed) | console.tsx:655-658, 710-718 | `WildConsole` polls and shows only rows whose event matches `/^(wild\|autopilot)\./` (console.tsx:656, 715). |
| Persist of ledger | store.ts:658-663 partialize (whole project incl. logs), salvageTrim caps logs to 200 (store.ts:574) | Ledger travels with the project in localStorage + export JSON + project file. |

**Finding L-1:** the ledger is the *domain event journal* (per-project, human-readable, exported with the project). It is the wrong place for runtime crash telemetry (it is project-scoped, prose-shaped, and its error rows drop the thrown object, e.g. engine.ts:2591-2597). The design keeps the ledger as-is and adds a **separate runtime telemetry stream** that *mirrors* selected error rows into the ledger for UI visibility (§3.9).

### 1.2 Wild-Mode surface

| Where | Anchor | What it does |
|---|---|---|
| wildRun state | types.ts:129-137 | `{active, phase, startedAt, lastAutoLog, lastAutoAt, stoppedAt, pause}` — the live surface the UI streams. |
| P13 driver docs | engine.ts:2145-2194 | Documents wildStep contract: one bounded macro-action per call, pause classes, code mapping (engine.ts:2184-2190). |
| wildLog | engine.ts:2195-2200 | Ledger append (cap 200). |
| wildPatch / wildPause | engine.ts:2203-2216 / 2219-2228 | `wildPause` stamps `pause:true` + ledger row — the honesty floor used by every pause path. |
| wildStep guard/pause branches | engine.ts:2503-2511 (blocked), 2525-2528 (missing record), 2537-2539 (locked), 2541-2549 (rejected), 2558-2566 (priors guard), 2588-2600 (catch → wild.error + `RT_E_INTERNAL`) | Every illegal-state path already pauses with a ledger row + machine `code` on the result. |
| Gate/leave/finalize | engine.ts:2316 (wildApproveGate), 2404 (wildLeavePhase), 2471 (wildFinalize), 2259-2308 (resolveWildReview: honest `{kind:"error"}` branch 2273-2275, classifier-failed tail 2307) | Classifier decisions + reviews → `wild.*` ledger rows (e.g. 2311-2313 wildReviewLog). |
| Default classifier | wild-mode.server.ts:243-309; loaded via engine.ts:2520-2522 | Configured-only (llm.ts complete → server fn → deepseek.server.ts); classifier errors are honest results, not throws. |
| UI enable→start | console.tsx:500-545 (WildToggle) | `flip()` sets wildMode then **fire-and-forget** `void wildStart(project.id)` at console.tsx:540. |
| UI start action seam | console.tsx:387-390 | `wildStart` → `startWildRun`. |
| UI activity strip | console.tsx:601-733 | `WildConsole`: primes history (621-662), polls every `WILD_POLL_MS = 1100` (console.tsx:243, interval at 728), keeps a 40-row feed (661/723). |
| Store driver loop | store.ts:710-800 | `startWildRun`: bounded for-loop `step < 20` (store.ts:769), awaits each `wildStep` (770), commits per step via `commitWild` (755-761, 772), parks on pause/complete/cap (775-788), catch → `{ok:false, ran, error, code:"RT_E_INTERNAL"}` (789-799). |
| Headless wild macro | headless.ts:1645-1713 (wildStartRun, cap 24 clamped 1-48), 1715 (wildPauseRun), 1733 (wildResumeRun), 1761 (wildStopRun) | Same wildStep loop with `maxSteps`, breaks on non-advanced outcome; CLI `wild` dispatches at rapidtool-cli.mjs:850. |

**Finding L-2:** three separate wild drivers exist (store.ts:710-800 UI/async, headless.ts:1645-1713 CLI macro, plus per-step calls from tests). None has wall-clock budgeting; each is bounded only in *iteration count*. The freeze class (a step whose awaited promise never settles, or a main thread that wedges) is invisible to all three.

### 1.3 Store surface (actions + persistence)

| Where | Anchor | What it does |
|---|---|---|
| Async phase synthesis | store.ts:410-430 (`synthesizeAsync`; silent catch 425-427) | LLM/research path fails **silently** → deterministic floor. |
| Advance loops | store.ts:432-511 (`runReadyAsync`/`advanceOnceAsync`), sync mirrors 300-403 | Envelope errors only. |
| H4 persistence hardening | store.ts:513-684 | quota-safe storage 594-645 (`console.warn` only at 625-633), salvageTrim 569-582, `recoverFromCorruptPersistence` 650-653, `onRehydrateStorage` 664-684. **No telemetry rows are emitted for quota failures or corrupt-blob recovery.** |
| persist health probe | store.ts:533-540 | `persistStorageHealth()` — the only exposed health seam; UI never calls it (verified: no consumer in console.tsx). |
| Store creation | store.ts:686-687 | `create<RapidState>()(persist(...))` — zustand v5 (package.json:75). No subscribe wrapper, no action telemetry anywhere. |
| Wild lifecycle actions | store.ts:704-816 | setWildMode 704-709, startWildRun 710-800, stop 801-808, toggle pause 809-816. |
| Envelope-returning actions | store.ts:833-853 (execute), 854-911 (runUntilHitl), 916-943 (executeAsync), 944-999 (runUntilHitlAsync), 1004-1058 (runModuleReal), 1060-1100 (ingestReport), 1150-1207 (approve/reject), 1212-1250 (rejectAsync, silent catch 1246-1248), 1310-1320 (appendChatRows) | All return `{ok:false, error, code?}` envelopes — **none emit telemetry**. |
| Status refresh | store.ts:1106-1149 (silent catches 1125, 1142) | LLM/research probe failures swallowed. |
| seed/hydrate | store.ts:1355 (seedIfEmpty), 650-684 | Corruption recovery is silent to the operator. |

**Finding L-3:** store is the perfect single choke point for store-action + hydrate/persist telemetry, but today has zero instrumentation surface beyond envelopes.

### 1.4 Chat / LLM surface

| Where | Anchor | What it does |
|---|---|---|
| llm.ts complete() | llm.ts:53-72 | Wraps TanStack server fn; catch classifies → `code` (llm.ts:64-71). |
| llmStatus | llm.ts:74-83 | Swallows transport failure → `{configured:false}`. |
| chat.ts chatOnce | chat.ts:58-73 | Same envelope + `classifyError` code. |
| Chat row code field | types.ts:368-378 | `ChatLogRow.code?: string` — failed sends already carry RT_E codes. |
| Chat pane send | console.tsx:4460-4499 | Failed turn row: `text: res.error, error: true, code: res.code ?? undefined` (console.tsx:4489-4492), append at 4499. Liveness ticker 4448-4454. |
| Server-side provider | deepseek.server.ts:49 (MAX_ATTEMPTS 3), 113-141 (postWithRetry), 192 (timeoutMs select), 236-237 (AbortController), 291 (timeout error) | Bounded retries + abort timers on the server side of every LLM call. |
| Browser side of the LLM fetch | llm.ts:34-44, chat.ts:19-30 (createServerFn POST) | **No client-side timeout/abort** — a wedged server-fn request can hold the awaited step forever. |

**Finding L-4:** chat failure rows are the only UI surface that already attaches an RT_E code to an error (console.tsx:4489-4492); there is no equivalent anywhere else in the UI, and LLM calls made from engine/crew/verify paths never emit a machine-readable trace of *latency*, *attempts*, *model*, or *code*.

### 1.5 UI surfaces

| Where | Anchor | What it does |
|---|---|---|
| HomeScreen / RunScreen | console.tsx:1015 / 1140 | Whole app is one console component tree (~5062 lines). |
| Action error toasts | console.tsx:1167 (error state), 1334-1341 (run → setError), 1371-1390 (runUntil), 1401-1409 (runModuleReal), 1411-1428 (ingestReport), 2074-2076 (render) | Transient `setError` banners, auto-cleared (546), **no telemetry**. |
| Wild poll constant | console.tsx:243 | `WILD_POLL_MS = 1100`. |
| Theme pre-hydration script | __root.tsx:48-53 | Inline try/catch — only pre-hydration JS guard in the tree. |
| Route shells | index.tsx (13 lines), run.$id.tsx (17 lines) | Thin; `key={id}` remount at run.$id.tsx:15. |

**Finding L-5:** zero global error handlers (verified absent), zero crash reporting, error toasts are transient and not persisted, and the freeze itself means *no UI code can run to explain the freeze* — hence the crash-tail-in-storage requirement (§4.1) and the watchdog heartbeats (§5).

### 1.6 Error boundary

| Where | Anchor | What it does |
|---|---|---|
| AppErrorComponent | error-component.tsx:50-86 | Router-level fallback: message truncation (35-39), reload/home actions. **No reporting side effect.** |
| Router wiring | router.tsx:10 | `defaultErrorComponent: AppErrorComponent` in `getRouter()`. |
| Not-found | error-component.tsx:93-109, wired at router.tsx:14 + __root.tsx:12 | Fallback only. |

**Finding L-6:** per react.dev, `componentDidCatch` is the sanctioned reporting seam (see §7); today the boundary renders and forgets. In dev, React re-bubbles boundary-caught errors to `window.onerror` (react.dev caveat) — the global capture (§3.1) must dedupe against rows already emitted by the boundary (see §2.5).

### 1.7 CLI / headless surface

| Where | Anchor | What it does |
|---|---|---|
| Envelope writer | rapidtool-cli.mjs:106-125 (`respond`) | ONE JSON object on stdout + exit code; failure envelopes get `code` (classify / RT_E pinning, 112-121); `schema_version`/`cmd`/`exit_code` (110). |
| Error-code loader | rapidtool-cli.mjs:128-146 (classify/classifyErr), 213 (`ensureErrorCodes()`) | Lazily imports src/lib/errors.ts — absent module degrades gracefully. |
| Main catch | rapidtool-cli.mjs:1068-1080 | Stack to **stderr**, envelope to stdout, exit 4. |
| Project loader errors | rapidtool-cli.mjs:230-244 | Exit 1 + code (ENOENT → RT_E_PROJECT_MISSING via object classify). |
| doctor | rapidtool-cli.mjs:1051-1066 → headless.ts:1275-1317 | Capability pre-flight `{llm, research, runner, node}` — the closest existing relative of `diagnose`. |
| File I/O | headless.ts:50-55 (loadProject), 58-81 (saveProject, atomic tmp+rename) | Project = one JSON file. |
| Driver loop | headless.ts:441-497 (runUntilGate), 233-265 (runPhase) | Envelope + `events: string[]` — strings only, no structure. |

**Finding L-7:** per-command envelopes are one-shot; there is **no per-run log trail on disk** and no cross-command history — an agent can ask "what did the last 5 commands do?" only by re-running them. Doctor probes *capability*, not *incident history*.

### 1.8 Adjacent telemetry-shaped modules (do not duplicate; reuse)

| Module | Anchor | Notes |
|---|---|---|
| errors.ts | 22-37 codes, 45-47 codeError, 122-176 classifyError (cause-chain + AggregateError walk), 183-254 ERROR_CODE_DOC (meaning + agentAction per code) | **The classification engine of this design.** Reuse `classifyError` for every captured thrown error. |
| tracing.ts | 1-80 | Pure agent-run span model (`AgentTrace`/`TraceSpan`, no fs, no Date.now, recorder stamps wall-clock at call site). Telemetry rows follow the same *pure core + host glue* split and the same "flat JSON-safe detail, never prompt bodies" redaction (tracing.ts:23-26). |
| watcher.ts | 1-33 | Bounded opt-in fs.watch; error notes capped 25, max 32 watchers. Shows the house boundedness discipline (§4 inherits it). |
| wild-mode.server.ts | 243-309 | Classifier — the exact code whose awaited LLM completion can strand a wild step. |

### 1.9 Gap register (each maps to a design element)

| # | Gap | Evidence (verified) | Design response |
|---|---|---|---|
| G-1 | No global error/unhandledrejection capture | zero handlers in src/routes+components+lib | §3.1 global capture in `__root` bootstrap |
| G-2 | Boundary renders, never reports | error-component.tsx:50-86 | §3.2 boundary report seam |
| G-3 | Ledger rows are prose-only | types.ts:113-119; engine.ts:2597 | §2 schema (machine fields) on new stream |
| G-4 | Wild drivers have iteration caps only, no wall-clock budget/heartbeat | store.ts:769; headless.ts:1645-1713; console.tsx:728 | §5 watchdog |
| G-5 | Store swallows failures | store.ts:425-427, 1125, 1142, 1246-1248 | §3.3 store-action capture |
| G-6 | Fire-and-forget UI async with no completion telemetry | console.tsx:540 (`void wildStart`) | §3.4 + §5.2 |
| G-7 | No crash tail survives reload/freeze | persist layer is project-only (store.ts:658-663) | §4.1 ring + crash snapshot |
| G-8 | No client-side LLM deadline | llm.ts:34-44; chat.ts:19-30 | §5.2 step budget + §3.10 llm-call capture |
| G-9 | No incident history for CLI/agents | rapidtool-cli.mjs:106-125 one-shot envelopes | §4.2 NDJSON appender |
| G-10 | No `diagnose` anywhere | only `doctor` (capability pre-flight) | §6 |
| G-11 | UI Diagnostics panel is last-10 prose | console.tsx:2423-2431 | §6.4 drawer reuses telemetry stream |
| G-12 | No memory/growth visibility | nothing reads store sizes/bytes | §6.2 growth stats |
| G-13 | Quota/corruption events invisible | store.ts:620-634, 650-653 | §3.8 hydrate/persist events |
| G-14 | No file:line provenance on any error | all envelopes prose | §2 `capture` field baked into capture points |

---

## §2 — Event taxonomy

### 2.1 Design rules

1. **One stream, two hosts.** A runtime event row (`RtEvent`, schema below) is the single currency in both the client ring and the CLI disk log. Hosts differ only in sink and retention.
2. **Domain journal vs runtime telemetry stay separate.** `Project.logs` (JsonLog) = project history that ships with the project. `RtEvent` rows = runtime diagnostics that die with the host (or travel to the agent on demand). Mirror rule: engine-phase and wild-step **error-level** events additionally append a JsonLog row through the existing ledger helpers so the in-app surfaces (console.tsx:2423-2431 rail, wild feed console.tsx:655-718) keep showing them without schema change.
3. **Machine-first fields, human `message`.** An agent branches on `event`/`code`/`scope`; prose is only for humans.
4. **Additive and versioned.** `schema_version: 1` constant; new fields optional; consumers never depend on field order.
5. **Bounded everywhere.** Per-row byte budgets, per-ring caps, per-file rotation (§4).
6. **Redacted by construction.** Never log: API keys, prompt bodies, chat text, artifact bodies, full project JSON. `ctx` carries ≤ 8 scalars ≤ 160 chars each; `payload` carries flat scalars only (mirrors tracing.ts:23-26 redaction doctrine).
7. **Level discipline.** `debug` rows are off by default and never persisted; `info` rows are lifecycle/telemetry; `warn` = degraded but handled; `error` = failure surfaced or swallowed by a catch; `critical` = the host is likely dying (freeze detection, fatal boundary).
8. **Dedupe.** Same `scope+event+code+messageHash` within 5 s → count-up instead of append (see 2.5). Dev-mode React re-bubbling (react.dev caveat, §7) must not double-count boundary errors.

### 2.2 Common event schema (RtEvent v1)

```ts
/** src/lib/rt-events.ts — pure types + constants (no window/process/fs imports). */
export const RT_SCHEMA_VERSION = 1 as const;

export type RtLevel = "debug" | "info" | "warn" | "error" | "critical";

export type RtEvent = {
  schema_version: 1;
  /** Epoch ms, stamped by the HOST glue at capture (pure core never invents time — tracing.ts doctrine). */
  ts: number;
  level: RtLevel;
  /** Host: "client" | "cli" | "test". */
  host: "client" | "cli" | "test";
  /** One per page-load / per CLI invocation (crypto.randomUUID, fallback timestamp+rand). */
  sessionId: string;
  /** Stable module/area id, dotted — MUST match §3 capture-point table's scope column. */
  scope: RtScope;
  /** Dotted event name, catalogue in §2.4. */
  event: string;
  /** PhaseId 0-12 when in a project run, else null. */
  phase?: number | null;
  /** Optional project id / project file path. */
  projectId?: string | null;
  /** RT_E_* code from the existing registry when the failure classifies (errors.ts:22-37). */
  code?: string | null;
  /** Human one-liner (≤ 300 chars). */
  message: string;
  /** `file.ts:line` of the CAPTURE POINT (baked per hook — never parsed from stack). */
  capture: string;
  /** Stack tail when an Error object exists: ≤ 12 lines, each ≤ 240 chars, cause-chain flattened ≤ 3 levels. */
  stack?: string | null;
  /** Flat scalar context (≤ 8 keys, values string|number|boolean|null, each ≤ 160 chars). Redacted by construction. */
  ctx?: Record<string, string | number | boolean | null>;
  /** Machine payload for the event class (durations, counts, bytes, verdicts…). Flat scalars only. */
  payload?: Record<string, string | number | boolean | null>;
  /** Parent correlation id when inside a run/step (e.g. wildRun epoch or step ordinal). */
  runRef?: string | null;
  /** Monotonic ms since navigationStart / process start (host stamps). */
  elapsedMs?: number | null;
  /** Dedupe counter: same-fingerprint row seen N times in the window (§2.5). */
  count?: number;
};
```

Scope values (union `RtScope`, additively extended): `"boot" | "ui-render" | "boundary" | "store-action" | "store-persist" | "engine-phase" | "wild-step" | "wild-driver" | "verify-run" | "crew-turn" | "llm-call" | "chat" | "runner-exec" | "cli-command" | "cli-log" | "hydrate" | "watcher" | "harvest-search" | "research" | "sys" | "diagnose"`.

### 2.3 Event classes (taxonomy of the mission statement, mapped)

| Class (mission name) | scope | Emitted for | Typical `event` values | Default level | Existing capture anchor (today) | New capture point (§3) |
|---|---|---|---|---|---|---|
| window-onerror | sys | Uncaught exceptions reaching window | `sys.uncaught_error` | critical | — (none) | §3.1 `__root` bootstrap |
| unhandled-rejection | sys | Unhandled promise rejections | `sys.unhandled_rejection` | critical | — (none) | §3.1 |
| boundary-crash | boundary | React error boundary caught a render/load error | `boundary.crash` | error | error-component.tsx:50-86 (no report) | §3.2 |
| ui-render | ui-render | Component render throw inside a pane boundary; UI action handlers that catch | `ui.pane_crash`, `ui.action_error` | error/warn | console.tsx:370-372 (wildCall catch), 955-971 (theme storage catches), 1334-1428 (action handlers, setError only) | §3.4 |
| store-action | store-action | Async/sync store action envelope failures + silent catches | `store.action_error` | warn | store.ts:425-427, 789-799, 1125, 1142, 1246-1248 | §3.3 |
| engine-phase | engine-phase | Phase execution error/synthesis fallback (mirror into ledger) | `engine.phase_fallback`, `engine.phase_error` | warn/error | engine.ts:2588-2600 (wild catch) | §3.9 (opts.onEvent) |
| wild-step | wild-step | Per-step lifecycle: start, ok, paused, timeout, error (mirror error level into ledger via existing wildPause rows) | `wild.step_start`, `wild.step_ok`, `wild.step_timeout`, `wild.step_error` | info/warn/error | engine.ts:2492-2601 | §3.5 driver wrap + engine opts |
| wild-driver | wild-driver | Driver-loop level facts: cap hit, stall, double-start refusal, pause/resume | `wild.driver_cap`, `wild.driver_stall`, `wild.driver_start_refused` | warn | store.ts:769-788, console.tsx:540 | §3.6 |
| llm-call | llm-call | Every LLM completion result class (ok w/ tokens, not-configured, timeout, rejected) — latency, attempts, model | `llm.ok`, `llm.not_configured`, `llm.timeout`, `llm.rejected` | info/warn | llm.ts:53-72, deepseek.server.ts:113-141 | §3.10 wrapper in llm.ts/chat.ts (host-side, client budget) |
| verify-run | verify-run | Verify passes (machine verify-fix) outcome classes | `verify.error`, `verify.timeout`, `verify.ok` | warn/info | verify.ts:24 catch | §3.11 wrapper |
| crew-turn | crew-turn | Per-role crew turn result | `crew.turn_error`, `crew.turn_ok` | warn/info | crew.server.ts (server fn) | §3.11 |
| runner-exec | runner-exec | Bounded runner spawn/exit/timeout | `runner.unavailable`, `runner.failed`, `runner.ok` | warn/error | node-runner.server.ts; store.ts:1004-1058 | §3.11 |
| cli-command | cli-command | One row per CLI invocation: cmd, exit code, duration, envelope ok | `cli.invocation` | info | rapidtool-cli.mjs:106-125 (respond) | §3.7 |
| hydrate/persist | hydrate / store-persist | Hydration outcome, quota failure, salvage success, corrupt-blob recovery | `hydrate.ok`, `hydrate.recovered_corrupt`, `persist.quota_failed`, `persist.salvaged` | warn/error | store.ts:620-634, 650-653, 664-684 | §3.8 |
| watcher | watcher | fs.watch listener errors/refusals (module already counts them) | `watcher.error`, `watcher.refused` | warn | watcher.ts:1-33 (notes only) | §3.12 |
| harvest/search | harvest-search | Live-source harvest + websearch class failures | `harvest.error`, `search.unavailable` | warn | harvest.ts:188/248/277/378/423/443; websearch.server.ts:113-352 | §3.11 |
| sys.heartbeat / sys.stall / sys.memory | sys | Watchdog telemetry (§5) | `sys.heartbeat`, `sys.mainthread_stall`, `sys.step_overdue`, `sys.memory` | info/critical | — (none) | §5 |
| diagnose | diagnose | The diagnose verb itself ran; its verdict row | `diagnose.ran` | info | — | §6 |

### 2.4 Event-name catalogue (dotted, `scope.event`)

Catalogue lives as a `const` record in `src/lib/rt-events.ts` (`RT_EVENT_NAMES`) so tests can pin the full set, additive-only like `ERROR_CODES`. The implementer must NOT invent free-form event strings at call sites — a lint-friendly catalogue is the guardrail (same philosophy as ERROR_CODES sync test, errors.test.ts).

Full catalogue (class → names):

```
boot:            boot.start, boot.ready
sys:             sys.uncaught_error, sys.unhandled_rejection, sys.mainthread_stall,
                 sys.heartbeat, sys.memory, sys.step_overdue
boundary:        boundary.crash
ui-render:       ui.pane_crash, ui.action_error
store-action:    store.action_error
engine-phase:    engine.phase_fallback, engine.phase_error
wild-step:       wild.step_start, wild.step_ok, wild.step_timeout, wild.step_error
wild-driver:     wild.driver_cap, wild.driver_stall, wild.driver_start_refused,
                 wild.driver_paused_auto, wild.driver_resumed
llm-call:        llm.ok, llm.not_configured, llm.timeout, llm.rejected, llm.transport_error
chat:            chat.send_error
verify-run:      verify.error, verify.ok
crew-turn:       crew.turn_ok, crew.turn_error
runner-exec:     runner.unavailable, runner.failed, runner.ok
cli-command:     cli.invocation
hydrate:         hydrate.ok, hydrate.recovered_corrupt, hydrate.empty
persist:         persist.quota_failed, persist.salvaged, persist.ok
watcher:         watcher.error, watcher.refused
harvest-search:  harvest.error, search.unavailable
diagnose:        diagnose.ran
```

### 2.5 Level + dedupe + coalescing rules (pure functions in rt-events.ts, unit-tested)

- `shouldCoalesce(prev, next)`: same `scope`, `event`, `code`, `messageHash` (first 96 chars) and `ts` gap ≤ 5 000 ms → return `{count: prev.count+1}` — heartbeat tickers and retry storms collapse to one ring slot.
- Heartbeat rows are never persisted on their own; the ring keeps the **latest heartbeat only** as a sidecar `lastHeartbeat` cursor (§5.3).
- Boundary rows carry `ctx.rebubbled: true` when the global handler also saw them (dev-mode React re-bubble, react.dev caveat): the ring's `sys.uncaught_error` emitter checks a `seenError` WeakSet stamped by the boundary report seam and skips duplicates (also applies to `window.reportError` flows, MDN).
- `critical` rows trigger the crash-tail snapshot write (§4.1.3) and (when a wild run is active) the watchdog auto-pause decision (§5.2).

---

## §3 — Capture-point map (file:line anchors + mechanisms)

Mechanism ids `CAP-1…CAP-12` are referenced by the implementation plan (§8). All "existing anchor" lines are current-tree verified.

### 3.1 CAP-1 — Global capture (window-onerror, unhandled-rejection) — boot

- **Install point:** module top-level of `src/routes/__root.tsx` is imported for every route, but the *earliest* client module is `src/router.tsx` (imported by the route tree bootstrap). **Chosen install:** new module `src/lib/rt-client.ts` with an idempotent `installRtClient()` (guard `if (typeof window === "undefined" || (globalThis as any).__rtInstalled) return`), imported at the **top of `src/router.tsx`** (before `routeTree` import) AND called from `__root.tsx` layout effect for late-safe install; the module import alone performs the install on the client.
- **Handlers** (each emits one RtEvent):
  - `window.addEventListener("error", …)`: `event: "sys.uncaught_error"`, level critical, scope sys, `code: classifyError(event.error ?? event.message)` (errors.ts:122-176 handles string/object/Error + cause chains), `capture: "src/lib/rt-client.ts:install"`, `ctx: {filename, lineno, colno}` (MDN signature), stack when `event.error?.stack`.
  - `window.addEventListener("unhandledrejection", …)`: `event: "sys.unhandled_rejection"`, `ctx.reasonType`, classify `event.reason`; `event.preventDefault()` NOT called (keep browser default console noise — honest).
- **Why module scope, not an effect:** pre-React errors (router load, store module init) still land in the ring. SSR guard mandatory (TanStack Start renders __root server-side).
- **Dedupe with CAP-2/3** via the WeakSet (§2.5).

### 3.2 CAP-2 — Error-boundary report seam (boundary-crash)

- **Existing:** `AppErrorComponent` (error-component.tsx:50-86), wired `router.tsx:10`. It receives `error` but no `componentStack` (TanStack router passes the error object only; `errorInfo` is not part of `ErrorComponentProps`).
- **Change:** inside `AppErrorComponent`, call the pure reporter `reportRt({…})` (never throws, guarded try/catch) with `event: "boundary.crash"`, scope boundary, level error, `capture: "src/lib/error-component.tsx:AppErrorComponent"`, classify via errors.ts, `ctx: {route: location.pathname}` (hook `useLocation` from `@tanstack/react-router`), message = the already-clipped message (clipMessage error-component.tsx:35-39). Mark the error object in the shared WeakSet so CAP-1 skips the dev re-bubble.
- **Deeper pane boundary (optional in v1, spec'd):** `RtPaneBoundary` class component (getDerivedStateFromError + componentDidCatch → reportRt with `info.componentStack`), wrapping the two heavy panes `RunScreen` body (console.tsx:1140) and `HomeScreen` (console.tsx:1015) so a pane crash reports AND the shell survives (react.dev: error boundaries catch render/lifecycle/constructor errors of children; not event handlers — handler errors are covered by CAP-4).

### 3.3 CAP-3 — Store-action capture (store-action, hydrate/persist rows)

- **Choke point:** `create<RapidState>()(persist(...))` at store.ts:686-687. zustand v5.
- **Mechanism A (actions):** wrap `set` once inside the creator: `const setRt = (partial, replace?) => { const before = get(); const r = set(partial, replace); … }` — but the design does NOT want every set logged (noise). Instead: instrument the ~8 async/envelope actions by adding a **host-glue emit after each catch** — concrete sites:
  - `synthesizeAsync` catch store.ts:425-427 → `store.action_error` warn, `event` detail "engine.runPhaseAsync unavailable/threw — deterministic fallback", code RT_E_INTERNAL, capture `src/lib/store.ts:425`.
  - `startWildRun` catch store.ts:789-799 → handled by CAP-5 driver rows (keep envelope; add emit).
  - `refreshStatuses` catches store.ts:1125, 1142 → warn rows `store.action_error` code RT_E_LLM_NOT_CONFIGURED / RT_E_RESEARCH_UNAVAILABLE semantics (probe failed), capture anchors above.
  - `rejectAsync` guidance catch store.ts:1246-1248 → debug/info row `llm.transport_error`-adjacent `store.action_error` (warn only when llmStatus said configured).
- **Mechanism B (subscribe wrapper):** add one `useRapid.subscribe((s, prev) => …)` (zustand v5 vanilla subscribe) installed in the client glue (rt-client.ts), NOT in store.ts, with a microtask batching guard, that diffs only `wildRun.*` transitions and emits driver rows `wild.driver_paused_auto` etc. — keeps store.ts pure and test-friendly (store tests inject a recorder instead). Rationale: store.ts already returns envelopes; subscribe diffing is for **state-transition telemetry** (pause/resume/cap/complete transitions) that has no return value.
- **Purity rule:** every emit helper is imported lazily inside the catch (`const { reportRt } = await import("./rt-events-host.ts")`) or injected — never a top-level import of a side-effectful module from store.ts (node:test runs store.ts headless; reportRt degrades to no-op recorder when no sink is installed).

### 3.4 CAP-4 — UI action-error capture (ui-render/chat rows)

- **Existing:** all UI action handlers funnel into `setError`/`setNotice` states in RunScreen (console.tsx:1164-1428 region) and WildToggle (console.tsx:500-545).
- **Change (lowest-touch):** one helper `uiError(err, {capture, scope, event})` in the console file that calls the existing setError AND `reportRt` warn/error row. Sites: run() console.tsx:1334-1341, runUntil() 1371-1390, onRunModule 1401-1409, onIngestReport 1411-1428, crew spawn ~1450-1484 (catch 1484), WildToggle flip 524-541, wildCall catch console.tsx:370-372, plus the ~9 other `setError` call sites from the grep inventory (console.tsx:1346-1581 region).
- **Chat failure row already carries code** (console.tsx:4489-4492, ChatLogRow.code types.ts:374-375) → add `reportRt` at 4491 with event `chat.send_error`, scope chat, code passthrough, `payload: {elapsedMs: busy since send start}`. The liveness ticker (console.tsx:4448-4454) is reused by the watchdog (§5.3) to bound a chat send at CHAT_STEP_BUDGET_MS.
- **UI render crash without boundary:** pane boundary CAP-2 catches; event-handler throws are caught by the handlers' own try/catch (console.tsx:370) — reported there.

### 3.5 CAP-5 — wild-step capture (engine stays pure: `opts.onEvent`)

- **Anchor:** `wildStep(project, opts?)` engine.ts:2492-2495. `opts` today carries only `reviewer`.
- **Design:** extend the engine **optionally and additively** — this is a *pure seam* (the engine never calls a sink itself; hosts pass one):
  ```ts
  export type WildStepOptions = { reviewer?: WildReviewer;
    /** Optional telemetry sink — the engine invokes it with serializable rows at the
     *  defined points; absent ⇒ zero overhead, zero side effects (engine purity). */
    onEvent?: (e: RtEventSeed) => void };
  ```
  Emission points inside wildStep (each gets `capture` = engine.ts:<anchor> and phase/runRef from project):
  1. entry after guards pass (engine.ts:2523 `const phase = …`): `wild.step_start` info, `payload:{phase, outcome:undefined}`, elapsed since wildRun.startedAt.
  2. each guard-pause return (2511, 2527, 2539, 2549, 2566): the row the pause *already writes to the ledger* is mirrored to the sink as `wild.step_paused` warn with the result `code`.
  3. successful edge resolution (2576-2587 boundary): `wild.step_ok` info `payload:{phase, outcome}`.
  4. catch block (2588-2600): emit `wild.step_error` error/critical, `code: "RT_E_INTERNAL"` (2599), message, stack, before the existing wildPause ledger row (2592-2598).
- **Callers pass sinks:** store driver (store.ts:770) passes the client sink; headless wildStartRun (headless.ts:1645-1713) passes the CLI sink (new optional param, additive); tests pass a recorder array (zero behavior change when absent — all existing wildStep callers in engine tests keep working unmodified).

### 3.6 CAP-6 — wild-driver capture (driver loops, store + headless)

- store.ts:710-800 `startWildRun`: wrap the for-loop body: emit `wild.step_start`-correlated rows via sink from CAP-5; after each `commitWild`, watchdog stamp (§5.2); on cap (store.ts:786-788) emit `wild.driver_cap` warn `payload:{steps:20}`; on catch 789-799 emit `wild.driver_error`; on early-return refusals 712-735 emit `wild.driver_start_refused` warn with the code.
- console.tsx:540 `void wildStart(project.id)`: before firing, consult the client single-flight latch (§5.2) and emit `wild.driver_start_refused` when a start is already in flight for that project (double-start freeze vector).
- headless.ts:1645-1713: same pattern via a `sink?: RtSink` option threaded from the CLI `wild` case (rapidtool-cli.mjs:850); cap row (the "bounded: reached the N-step cap" return inside wildStartRun).

### 3.7 CAP-7 — CLI envelope capture (cli-command + disk appender)

- **Anchor:** `respond(result, exitCode)` rapidtool-cli.mjs:106-125 — the single exit point of every command. Add one line before `process.stdout.write`: `await appendRtLine({host:"cli", scope:"cli-command", event:"cli.invocation", level: exitCode===0?"info":"warn", code: out.code, payload:{exit_code:exitCode, durationMs: Date.now()-t0, cmd: CMD, ok: out.ok === true}})` — via new `scripts/log-sink.mjs` (§4.2), lazily required so an absent logger never breaks a command (same resilience pattern as classify, rapidtool-cli.mjs:128-146).
- **Anchor:** main catch rapidtool-cli.mjs:1068-1080 — after stderr stack write, append an `error`-level row with classifyError code before respond.
- **Anchor:** loader catch rapidtool-cli.mjs:230-244 — append row (load failures are high-value: ENOENT paths, corrupt JSON).
- t0 = `Date.now()` at main() entry (rapidtool-cli.mjs:200-ish, next to `CMD = cmd ?? null`).
- **Headless-level deep rows** (wild/run/gate/crew/verify/harvest envelopes) get appended by the same sink at their respond sites; a per-invocation `sessionId` ties them together.

### 3.8 CAP-8 — hydrate/persist capture (client storage events)

All inside store.ts's existing hardened paths — emit-only additions (never change control flow):
- `quotaSafePersistStorage.setItem` failure paths: store.ts:620-634 — `persist.quota_failed` error (first failure, 620-622) / `persist.salvaged` warn (successful salvage 623-628) / error (double failure 629-633). `persist.ok` info on 616-619 success is optional (low value; skip in v1 to cut noise).
- `getItem` corrupt-blob catch store.ts:604-608 → `hydrate.recovered_corrupt` warn with `ctx:{storageKey: name}` (the blob is dropped; the next write heals it).
- `onRehydrateStorage` error/shape-recovery store.ts:671-674 and belt-and-braces 678-682 → `hydrate.recovered_corrupt` error; success path 675-677 → `hydrate.ok` info `payload:{projects: state.projects.length}`.
- `recoverFromCorruptPersistence` store.ts:650-653 → emit once (guard against double-emit from 671 + 681 paths).
- `persistStorageHealth` store.ts:538-540 stays; **new UI consumer**: the Diagnose drawer (§6.4) reads it.

### 3.9 CAP-9 — engine-phase capture (mirror rows into ledger + sink)

- Engine phase synthesis never throws by contract (deterministic floor), so engine-phase *error* telemetry is really about **falls and degradations**:
  - `liveLayer` (engine.ts:1816) live-research failure inside runPhaseAsync (engine.ts:2091) → headless/store callers already envelope; telemetry emitted at caller catch sites (CAP-3) with `engine.phase_fallback`.
  - `runP6Real` (engine.ts:2112) → runner errors surface via CAP-11 runner capture + existing lastTest envelope.
- Ledger mirror rule (§2.1-2): error-level RtEvent rows for engine-phase/wild-step classes additionally call the existing `wildLog`/ledger appenders with `event: "rt." + event` so in-app Diagnostics (console.tsx:2423-2431) shows them. Implemented as one helper `mirrorToLedger(project, rtRow)` used ONLY by host glue that holds a project reference (store driver, headless), never inside engine.ts itself.

### 3.10 CAP-10 — llm-call capture (client + server rows)

- **Client wrapper** llm.ts:53-72 `complete()` and chat.ts:58-73 `chatOnce()`: these are the ONLY two client entry points to DeepSeek. Add host-side emit on every resolved result:
  - ok → `llm.ok` info `payload:{model, promptTokens?, completionTokens?, ms}` (usage fields exist in LlmResult llm.ts:18-32; ms measured around the await).
  - not-configured → `llm.not_configured` info.
  - error/timeout/rejected → `llm.timeout|llm.rejected|llm.transport_error` warn/error with existing `code` (llm.ts:69) + `payload:{ms}`.
  - **Client deadline (G-8):** wrap the createServerFn call in `Promise.race` with `LLM_CLIENT_BUDGET_MS` (§5.6) → on expiry emit `llm.timeout` critical + return honest envelope `{ok:false, reason:"error", code:"RT_E_LLM_TIMEOUT"}`. The abandoned promise settles later; a `.finally`-style latch records `llm.late_settle` warn (info value for the freeze class) so the agent sees the wedge.
- **Server rows** in `completeDeepSeek`/postWithRetry (deepseek.server.ts:113-141, 236-237): server-side fetch already aborts at timeoutMs (192, 236-237); add optional sink param to the module and have the server fn handler (llm.ts:41-44) pass it → rows carry `payload:{attempts, status, timeoutMs}`. Not strictly required for v1 (client rows suffice for the freeze class); implement server rows only where the sink is trivial.

### 3.11 CAP-11 — verify/crew/runner/harvest/search capture (host-side wrappers)

Not one-by-one seams in the engine; telemetry enters at the **host wrappers that already envelope results**:
- verify: headless.ts:961-978 (`verifyGeneratedSource`) + store/UI call sites; catch at verify.ts:24. Emit `verify.error` with classify code at wrapper catch sites (a future lane may move emission into verify.ts via opts.onEvent like CAP-5 — same pattern).
- crew: crew.server.ts (server fn) / crew.ts wrapper; emit `crew.turn_error` per role from the crew caller (store/console.tsx:1450-1484 crew spawn catch 1484).
- runner: node-runner.server.ts spawn/timeout sites; emit `runner.unavailable|failed|ok` from the existing wrapper (store.runModuleReal store.ts:1004-1058, headless wrappers) with `payload:{exitCode, durationMs}`.
- harvest/search: harvest.ts catches 188/248/277/378/423/443, websearch.server.ts catches 113-352 — emit `harvest.error`/`search.unavailable` from the caller-side wrappers (headless harvest 1319-1345 + store/UI call sites), code from classifyError (RT_E_RESEARCH_UNAVAILABLE etc.).
- Scope: these are warn/info rows with code + payload only — no new envelopes, no control-flow change.

### 3.12 CAP-12 — watcher capture

- watcher.ts:1-33 already counts listener errors and refuses >32 watchers with notes (watcherNotes()). Telemetry = read those notes at `diagnose` time (headless `diagnose()` imports watcherNotes when available) rather than adding a sink inside watcher.ts. Optional v1 row from the embedder when `startWatcher` refuses (caller-side emit).

### 3.13 Capture-point summary table (implementer checklist)

| CAP | class(es) | New/edited file | Anchor today | Rows |
|---|---|---|---|---|
| 1 | sys.uncaught_error, sys.unhandled_rejection | src/lib/rt-client.ts (+router.tsx import) | none | 2 handlers |
| 2 | boundary.crash, ui.pane_crash | error-component.tsx + RtPaneBoundary | error-component.tsx:50-86 | 1-2 |
| 3 | store.action_error, engine.phase_fallback | store.ts catches | 425, 789, 1125, 1142, 1246 | ~6 sites |
| 4 | ui.action_error, chat.send_error | console.tsx uiError helper | 370, 540, 1334-1581, 4489-4492 | ~12 sites |
| 5 | wild.step_* | engine.ts opts.onEvent (pure seam) | 2492-2601 | 4 points |
| 6 | wild.driver_* | store.ts 710-800, headless 1645-1713, console 540 | 769-788, 789-799 | 4-5 sites |
| 7 | cli.invocation + per-command rows | rapidtool-cli.mjs respond/main catch | 106-125, 1068-1080, 230-244 | 3 sites |
| 8 | hydrate.*, persist.* | store.ts storage paths | 604-608, 620-634, 650-684 | 5 paths |
| 9 | engine.phase_* mirror | host glue (store/headless) | §2.1-2 rule | mirror helper |
| 10 | llm.*, chat.* | llm.ts, chat.ts wrappers + client deadline | llm.ts:53-72, chat.ts:58-73 | 2 wrappers |
| 11 | verify/crew/runner/harvest/search | host wrappers | §3.11 anchors | per wrapper |
| 12 | watcher.* | diagnose-time read of watcherNotes | watcher.ts:1-33 | read-only |

---

## §4 — Storage & retention (bounded everywhere)

### 4.1 Client ring buffer (browser)

New pure core `src/lib/rt-ring.ts` (no window/fs imports — node:test runs it) + host glue in rt-client.ts.

| Rule | Value | Rationale |
|---|---|---|
| Ring capacity | 200 rows | Matches the ledger cap the engine already uses (engine.ts:2198) — house norm, bounded memory. |
| Byte budget | 64 KB serialized | localStorage quota headroom beside `rapidtool.v4` (store.ts:656); enforced at write, not per row. |
| Per-row budgets | message ≤ 300 ch; detail ctx values ≤ 160 ch; stack ≤ 12 lines × 240 ch | §2.2. |
| Persistence key | `rapidtool.rt.v1` (version-pinned like store.ts:656 `rapidtool.v4` and chat.ts:160 `rapidtool.chatlog.v1`) | Namespacing + migration. |
| Persist cadence | Write-through on every row **except** info-level rows (info rows persist only on `pagehide`/`visibilitychange:hidden` or when a warn+ row follows) | Cuts localStorage churn during wild runs; crash tail is warn+ heavy. |
| Coalescing | §2.5 | Heartbeat storms collapse. |
| Hydration | Corrupt blob → drop + `hydrate.recovered_corrupt` row (same doctrine as store.ts:604-608). Reads tolerate legacy shapes, additive fields ignored. | Never throws. |
| Quota | Same salvage discipline as store.ts:620-634: retry once with tail-64 KB trim, then drop-newest + keep lastPersistFailure. | Never throws through a caller. |
| Sidecar cursors | `lastHeartbeat` (single latest sys.heartbeat row, §5.3), `crashSnapshot` (§4.1.3), `sessionId` | Diagnose reads them cheaply. |

**4.1.1 API (pure, testable):**

```ts
// rt-ring.ts — pure
createRtRing(cap = 200, byteCap = 64 * 1024): RtRing            // empty ring + cursors
rtPush(ring, row): { ring, dropped: RtEvent[] }                 // bounds + coalesce + byte trim
rtSerialize(ring): string                                       // JSON {version, sessionId, rows[]}
rtHydrate(raw: unknown): RtRing                                 // corrupt ⇒ empty + flag
rtTail(ring, n): RtEvent[]                                      // newest-first tail (diagnose)
rtStats(ring): { rows, bytes, newestTs, oldestTs, errorCount, criticalCount }
```

**4.1.2 Host glue (rt-client.ts):** `reportRt(seed)` stamps ts/elapsedMs/sessionId/host/capture, classifies `code`, pushes to the singleton ring, persists per the cadence rule, and notifies `wildRunWatchdog` (§5) when level ≥ error or event ∈ {sys.mainthread_stall, sys.step_overdue, wild.step_timeout}.

**4.1.3 Crash tail / crash snapshot:** on any `critical` row, or on `pagehide` while the ring's last 30 s contain error+ rows, write `crashSnapshot` = `{at, sessionId, href, ua: navigator.userAgent.slice(0,200), ring: rtTail(ring, 50), wildRun: lastKnownWildRun}` to key `rapidtool.rt.crash.v1` (bounded 16 KB). On next load, if a crashSnapshot exists it is imported into the ring head as `sys.previous_session_crash` critical (so the agent sees the freeze tail immediately) and shown as a banner in the Diagnose drawer (§6.4). A freeze kills the tab before `pagehide`? Then the ring rows written up to the last heartbeat are what survive — which is exactly why the watchdog writes heartbeat + stall rows *through* the warn-cadence rule (heartbeat sidecar write every 5 s while a run is active, §5.3).

### 4.2 Headless / CLI disk appender (append-only NDJSON)

New `scripts/log-sink.mjs` (plain ESM, same style as rapidtool-cli.mjs:1-30; lazy-required so absence never breaks a command):

| Rule | Value |
|---|---|
| Location | `<RAPIDTOOL_LOG_DIR ?? dirname(resolvedProjectPath) + "/.rapidtool/logs">`; env `RAPIDTOOL_LOG_DIR` overrides. Global (non-project) commands (`doctor`, `diagnose --all`) use `process.cwd()/.rapidtool/logs`. |
| File | `rapidtool.ndjson` — one RtEvent JSON per line (NDJSON; schema §2.2 minus ring-only fields). |
| Append | `appendFileSync(path, line + "\n", "utf8")` single call per line (atomic for < 64 KB lines on all supported hosts; rows are ≤ ~2 KB by construction). |
| Rotation | Before append: if size > 5 MB → rename to `rapidtool.ndjson.1`, shift `.1→.2→.3`, drop `.3` (keep 4 files, ≤ 20 MB total). O_APPEND semantics via appendFileSync; rotation is best-effort try/catch (never breaks the command). |
| Per-invocation rows | One `cli.invocation` row per command (CAP-7); deep rows from wild/run/verify/etc. via optional sink threaded from the CLI into headless wrappers (CAP-5/6/11). |
| Read API | `readRtTail(logDir, n)` returns newest n rows (byte-bounded, line-validated — a torn final line is skipped, never thrown) for `diagnose`. |
| Durability | Best-effort: NDJSON is a diagnostic trail, not a transaction log. Sync writes are fine (commands are one-shot, single-process). |

**Why NDJSON + not SQLite/JSON-file:** the house already does line-append discipline (saveProject atomic tmp+rename headless.ts:58-81; chat log JSON chat.ts:156-206); NDJSON is the structured-logging norm for machine consumers (pino, §7), trivially tailed by an agent (`tail -n 40 …/rapidtool.ndjson | jq -s`), and rotation is 10 lines.

**CLI grep-ability contract for agents** (documented in README-cli.md §"Diagnostics"): each line is one complete JSON object; `jq -s 'sort_by(.ts) | .[-20:]'` gives the tail; `jq -s '[.[] | select(.level=="error" or .level=="critical")]'` gives the crash list.

---

## §5 — Watchdog design (wild-loop freeze class)

### 5.1 Failure-class analysis (honest bounds)

What a watchdog can and cannot do in this architecture (state each as fact, from the verified code):

1. **wildStep awaits the classifier** (engine.ts:2578/2586 via wildApproveGate/wildLeavePhase → resolveWildReview engine.ts:2259-2308 → wild-mode.server.ts:243-309 → llm.ts complete → server fn POST, llm.ts:34-44). The *server* side has abort timers (deepseek.server.ts:43-44, 192, 236-237) but the *client fetch* has none (G-8) → an unsettled server fn can hold a step open indefinitely. A watchdog **cannot cancel an in-flight awaited promise** from the same tab.
2. A wild step that resolved **late** can commit state after an auto-pause (commitWild store.ts:755-761 rebases onto live state but does not re-apply a pause the operator set meanwhile — pause lives on the step's own wildRun snapshot). → Auto-pause must be **pause-on-resolve** (below), never pause-by-abandonment.
3. The drivers are iteration-bounded already (store.ts:769 = 20; headless.ts:1645-1713 clamp 1-48) — a *live* loop cannot spin forever *by itself*, but overlapping starts (UI fire-and-forget console.tsx:540 with no single-flight latch) and a wedged main thread can still freeze the tab.
4. A blocked main thread cannot run watchdog JS *during* the block — detection is **post-hoc via interval lag** (the classic event-loop-lag probe) + Long Tasks API where available; the *tail* survives in the ring because rows are persisted as they're written (§4.1.3).

Design therefore separates: **step budget** (driver-level, pause-on-resolve), **liveness heartbeat** (interval-lag), **main-thread stall** (longtask + lag), and **prevention latches** (single-flight start, auto-pause refusal to auto-resume).

### 5.2 Step-time budget + pause-on-resolve (driver level)

Constants (§5.6): `WILD_STEP_BUDGET_MS = 90_000` (server-side DeepSeek aborts are 20 s flash / 60 s pro — deepseek.server.ts:43-44, selected at :192 — so a step that outlives the client budget implies a transport/server-fn wedge, since the client fetch has no abort of its own, G-8; the two tiers below handle both the legitimate slow step and the wedge):

- Tier 1 `wild.step_overdue` warn at `1.0 × budget` (step still awaited; UI shows "step N s overdue" via the existing wildRun.lastAutoAt lag — the WildConsole poll console.tsx:728 already ticks; add overdue rendering to the activity strip, §6.4).
- Tier 2 at `2.0 × budget`: emit `wild.step_timeout` critical + **set a stall latch** (client ring sidecar `stall = {projectId, since, stepElapsedMs}`) + **auto-pause on resolve**: when the awaited step finally resolves, the driver checks elapsed; if ≥ 2 × budget it does NOT commit the step's wildRun.pause=false as-is — it applies `wildPause(cur, phase, "error", "wild.timeout_autopause", …)` (engine.ts:2219-2228 helper, ledger row + pause:true) and returns `stoppedReason:"paused", code:"RT_E_LLM_TIMEOUT"`-style honestly (code drawn from the existing registry — a server timeout classifies RT_E_LLM_TIMEOUT, an unknown wedge RT_E_INTERNAL).
- Chat sends get the same two-tier treatment (chat pane send() busy latch console.tsx:4462-4475 + liveness ticker 4448-4454): `CHAT_STEP_BUDGET_MS = 60_000`, overdue warn at 1×, timeout row at 2× with honest failed-turn row (existing error-row machinery console.tsx:4489-4492).
- Implementation home: a small pure module `src/lib/watchdog.ts` (`watchdogDecision(elapsedMs, budgetMs) → {tier: 0|1|2}` + `shouldAutopause(step, stall)`), used by the store driver wrapper around `wildStep` (store.ts:770) and by the headless wild driver (headless.ts:1645-1713). Engine untouched (purity).

### 5.3 Heartbeat telemetry

- Browser: while `wildRun.active && !pause` (any project) OR a chat send/runUntilHitlAsync is busy, rt-client.ts runs a 1 s interval (reusing the pattern + constant family of console.tsx:243/728): each tick stamps `lastHeartbeatAt` (ring sidecar, §4.1) and every 5th tick pushes a coalesced `sys.heartbeat` info row with `payload:{lagMs}` where `lagMs = now - expectedTickTime`. Heartbeat rows are NOT persisted individually (sidecar write every 5 s while run active — crash-tail rule §4.1.3).
- CLI: heartbeat is per-invocation elapsed (`payload.durationMs` on `cli.invocation`, CAP-7) — long commands are their own stall signal; the CLI wild macro also emits `wild.step_ok` per step (CAP-5), so a `tail` of the NDJSON shows the last completed step + gap.
- Lag thresholds (§5.6): `lagMs > 3_000` while a run is active → `sys.heartbeat_lag` warn; `lagMs > 10_000` → `sys.mainthread_stall` critical + stall latch (the interval callback that finally runs writes the row — post-hoc but *persisted*).

### 5.4 Main-thread stall (Long Tasks + interval lag)

- Long Tasks API where available (PerformanceObserver `{type:"longtask", buffered:true}`, w3c.github.io/longtasks): tasks ≥ 50 ms are the spec'd threshold; log rows only for ≥ 250 ms (UI-freeze-perceptible, web.dev "long task" ≥ 50 ms definition; 250 ms chosen as the *report* floor to cut noise), `event: "sys.longtask"` warn `payload:{durationMs}`, capped 1 row / 10 s (coalesce §2.5).
- Interval-lag probe (§5.3) covers the no-Long-Tasks path (all modern Chromium/Firefox support longtask; the lag probe is the universal fallback and the only one that works in the freeze moment itself).
- **Freeze tail reconstruction:** on `sys.mainthread_stall` the stall row + preceding `sys.heartbeat` sidecar + last `wild.step_*` rows give the agent: last step start, last heartbeat, stall length — i.e. "step P5 started at T, heartbeats stopped at T+3.1 s, thread unblocked at T+11.4 s" — exactly the diagnostics that were missing in the incident.

### 5.5 Auto-pause semantics (table — implementer contract)

| Condition | Row(s) | Driver action | UI action |
|---|---|---|---|
| Step resolves OK < 1× budget | wild.step_ok | continue loop | stream feed |
| Step still pending at 1× budget | wild.step_overdue (warn, once/step) | keep waiting (honest: cannot cancel) | activity strip shows "step overdue Ns"; Stop button already present (console.tsx:759-772) |
| Step pending at 2× budget | wild.step_timeout (critical) + stall latch | keep waiting; latch set | strip shows stall banner + Stop highlighted |
| Step resolves ≥ 2× budget late | wild.step_timeout resolved + wild.timeout_autopause ledger row | apply wildPause, stop loop, return paused + code | strip shows auto-paused banner; Resume is a human act (matches existing wildRun.pause UX store.ts:809-816) |
| wildStep itself errors | wild.step_error (CAP-5) | existing catch path pauses (engine.ts:2588-2600) — unchanged | existing |
| Main thread lag > 10 s during run | sys.mainthread_stall critical | nothing to run (thread blocked); stall latch for next-resolve check | post-unblock banner |
| Second startWildRun for same project while one in flight | wild.driver_start_refused warn | refuse (store.ts:728-735 already refuses active runs; add in-flight latch for the fire-and-forget window console.tsx:540) | toast "run already starting" |

**Never:** auto-resume after auto-pause; abandon an in-flight step; fabricate a verdict (honesty floor kept: engine.ts:2276-2284; wild-mode.server.ts:243-309 classifier, vacuous-approve guard inside — untouched).

### 5.6 Constants (one table, rt-events.ts + watchdog.ts)

| Constant | Value | Notes |
|---|---|---|
| WILD_STEP_BUDGET_MS | 90 000 | §5.2 tier 1; client budget sits above the server aborts (20 s flash / 60 s pro, deepseek.server.ts:43-44, 192) |
| WILD_STEP_AUTOPAUSE_MS | 180 000 | §5.2 tier 2 |
| CHAT_STEP_BUDGET_MS | 60 000 | §5.2 |
| HEARTBEAT_MS | 1 000 | §5.3 (console.tsx:243 family) |
| HEARTBEAT_PERSIST_EVERY_MS | 5 000 | §5.3 |
| HEARTBEAT_LAG_WARN_MS | 3 000 | §5.3 |
| STALL_CRITICAL_MS | 10 000 | §5.3/5.4 |
| LONGTASK_REPORT_MS | 250 | §5.4 (spec floor 50 ms, w3c) |
| LONGTASK_COALESCE_MS | 10 000 | §5.4 |
| RING_CAP / RING_BYTES | 200 / 64 KB | §4.1 |
| CRASH_SNAPSHOT_BYTES | 16 KB | §4.1.3 |
| LOG_ROTATE_BYTES / LOG_KEEP | 5 MB / 4 files | §4.2 |

---

## §6 — The AI-agent `diagnose` verb

Goal (DG-6): one JSON, from CLI or UI, answering "what happened, what is the active state, what is most likely wrong, what should I do" — without the agent parsing prose or reading source.

### 6.1 Output contract (single JSON — CLI envelope + UI drawer share the shape)

```jsonc
{
  "schema_version": 1,
  "cmd": "diagnose",
  "ok": true,
  "exit_code": 0,
  "generatedAt": 1780000000000,
  "source": "cli" | "ui",
  "session": { "sessionId": "…", "host": "cli" | "client", "node": "v22.x", "href": "…", "ua": "…" },
  "project": {
    "ref": "path-or-id", "name": "…", "status": "running", "currentPhase": 5,
    "wildRun": { "active": true, "pause": false, "phase": 5, "startedAt": 1780000000000,
                 "lastAutoAt": 1780000000500, "lastAutoLog": "…", "stoppedAt": null,
                 "overdueMs": 89500 }            // null when no run
  },
  "errors": [ { "ts": 1780000000500, "level": "error", "scope": "wild-step", "event": "wild.step_timeout",
                "code": "RT_E_LLM_TIMEOUT", "message": "…", "capture": "src/lib/engine.ts:2492", "count": 1 } ],
  "timeline": [ { "ts": 1780000000000, "kind": "ledger" | "telemetry", "event": "wild.step_start",
                  "scope": "wild-step", "phase": 5, "detailOrMessage": "…" } ],
  "watchdog": { "lastHeartbeatAt": 1780000000499, "heartbeatLagMs": 90000,
                "stall": { "active": true, "since": 1780000000400, "stepElapsedMs": 90000, "class": "step-overdue" },
                "lastLongTaskMs": null, "budgetsMs": { "wildStep": 90000, "chat": 60000 } },
  "growth": { "rows": { "ledger": 200, "telemetryRing": 200, "chatLog": 40 },
              "bytes": { "projectFile": 482113, "logDirBytes": 1024, "localStorageEstimate": 212000 },
              "counts": { "artifacts": 23, "memory": 41, "decisions": 9, "projects": 3 } },
  "persistHealth": { "ok": true, "lastError": null },
  "mostLikelyCause": { "rank": 1, "class": "wild-step-timeout", "summary": "…", "evidence": ["…"] },
  "candidates": [ { "rank": 2, "class": "…", "summary": "…", "evidence": ["…"] } ],
  "actions": [ "Stop the wild run (store.stopWildRun) and resume after checking DEEPSEEK_API_KEY balance", "…" ],
  "codes": { "RT_E_LLM_TIMEOUT": { "meaning": "…", "agentAction": "…" } }   // from ERROR_CODE_DOC errors.ts:183-254 for every code present
}
```

Rule (DG-7): `mostLikelyCause` is a **ranked heuristic over observed rows** — every claim cites `evidence` row indices; when nothing ranks, it is `{rank:1, class:"none-detected", summary:"No error rows in window — incident predates capture or is environmental", evidence:[]}`, never a guessed root cause.

### 6.2 Heuristic (pure builder `buildDiagnosis(...)` in src/lib/diagnose.ts, unit-tested)

Ranking rules, first match wins (implemented as ordered pure predicates over the §6.1 inputs):

1. `wild-step-timeout`: wildRun.active && lastAutoAt && `now - lastAutoAt > WILD_STEP_BUDGET_MS` → evidence: last wild.step_start/ok rows + watchdog.stall.
2. `wild-paused-error`: wildRun.pause && newest ledger row level error/warn event wild.* → class from the row's code (map: RT_E_LLM_REJECTED → llm-provider; RT_E_GATE_PENDING → human gate; RT_E_PHASE_ILLEGAL → state corruption; RT_E_INTERNAL → engine bug).
3. `llm-unavailable`: ≥ 2 llm.* error rows in 5 min (not_configured/timeout/rejected) → check config + balance; code docs from ERROR_CODE_DOC.
4. `persist-failure`: persist.quota_failed / persistStorageHealth().ok === false → data-loss risk banner.
5. `corrupt-recovery`: hydrate.recovered_corrupt rows → state was repaired; expect side effects.
6. `runner-failing`: runner.failed cluster → generated module bug.
7. `mainthread-stall`: sys.mainthread_stall/longtask ≥ 1 row in window → environment/render hot-loop; evidence includes lag rows.
8. `freeze-pre-capture`: crashSnapshot exists (client) → `sys.previous_session_crash` row is the headline.
9. `none-detected` (honest floor).

`actions` are derived from the matched class + `ERROR_CODE_DOC[code].agentAction` (errors.ts:183-254) for every distinct code in `errors`.

### 6.3 CLI verb

- Dispatch: `diagnose` case beside `doctor` (rapidtool-cli.mjs:1051). Usage line added to USAGE (object at rapidtool-cli.mjs:1090, closing before `main()` at 1123).
- Flags: `--project <file.json>` (project-scoped) or `--all` (last 200 rows across `RAPIDTOOL_LOG_DIR`); `--errors N` (default 20); `--json` is the default output (envelope, §6.1) — no pretty mode needed; exit 0 on success even when the diagnosis is dire (info command; taxonomy note in README-cli.md), exit 1 for missing project/usage, exit 4 internal.
- Headless builder: `headless.diagnoseProject(path)` (new, pure-ish; reads project file via loadProject headless.ts:50-55 + NDJSON tail via log-sink readRtTail + doctorStatus headless.ts:1275-1317 for capability context + buildDiagnosis). No mutation ever — a diagnose must be a read-only command (mirrors doctor's never-throws wrapper, rapidtool-cli.mjs:1051-1066).
- Rows: emits its own `diagnose.ran` info row into the NDJSON (so future diagnoses see past ones).

### 6.4 UI button + drawer

- Entry: "Diagnose" button in the Diagnostics rail header (console.tsx:2423 region) and in Settings.
- Drawer content (reuses existing dialog patterns — SettingsDialog mounts at console.tsx:2435):
  - Banner strip when ring has error/critical rows or crashSnapshot exists ("Previous session ended with N errors — Diagnose").
  - Summary cards from §6.1: watchdog state (running/overdue/stalled + live elapsed), errors list (event/code/message/capture, newest first, count badges), persistHealth, growth numbers.
  - `<pre>` "Agent JSON" block with the full §6.1 object (auto-refreshed while a wild run is active via existing poll cadence) + **Copy** button (clipboard) + **Download crash bundle** (`.json` = §6.1 object + ring tail 200 + ledger tail 50 + crashSnapshot — blob download pattern already used at console.tsx:1536-1549/1549+).
  - While a wild run is active the drawer shows the live overdue ticker (same data the activity strip shows) so the freeze class is visible *before* it happens, not only after.
- Client builder: `buildClientDiagnosis()` in rt-client.ts reuses the same `buildDiagnosis` heuristic on ring + project + store stats (useRapid.getState()), so CLI and UI emit byte-identical field names (one contract for the agent).

### 6.5 Example agent flow (documented in README-cli.md)

```
$ node --experimental-strip-types scripts/rapidtool-cli.mjs diagnose --project build.json
→ read .mostLikelyCause / .errors[].code / .watchdog / .actions
→ act (e.g. code RT_E_LLM_TIMEOUT ⇒ ERROR_CODE_DOC.agentAction: "Retry once if idempotent, else fall back…")
```

---

## §7 — External verification (3 web-verified mechanisms + citations)

1. **Structured logging for agent/automation consumption (NDJSON).**
   - pino — the canonical Node JSON logger: every line is a self-describing JSON object (`{"level":30,"time":…,"msg":"…"}`) designed for machine piping and tooling, not human formatting (github.com/pinojs/pino). Dash0's pino guide covers the same "JSON lines for tooling" contract (dash0.com/guides/logging-in-node-js-with-pino).
   - 12-factor "logs" (12factor.net/logs): treat logs as event streams — append-only, time-ordered; the app never concerns itself with routing/storage of its own stream.
   - **Applied:** §4.2 NDJSON appender with per-line JSON, size rotation, and an agent grep contract; RtEvent machine fields §2.2; every CLI response already one-JSON (rapidtool-cli.mjs:106-125).
2. **Crash-report capture patterns (window.onerror + unhandledrejection + boundary).**
   - MDN Window `error` event (developer.mozilla.org/en-US/docs/Web/API/Window/error_event): onerror receives (message, source, lineno, colno, error); `unhandledrejection` (developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event) is the promise-rejection counterpart ("sent to the global scope when a Promise with no rejection handler is rejected").
   - Sentry blog "Capture & Report JavaScript Errors with window.onerror" (blog.sentry.io/client-javascript-reporting-window-onerror/): both handlers are essential for comprehensive coverage; unhandled rejections do NOT fire window.onerror; Sentry's own SDK hooks both under the hood. Sentry breadcrumbs (docs.sentry.io/platforms/javascript/enriching-events/breadcrumbs/) = the breadcrumb-trail pattern our ring + heartbeat sidecar implements.
   - MDN `reportError()` (developer.mozilla.org/en-US/docs/Web/API/Window/reportError): lets callback code route errors to the top-level handler while keeping the stack — pattern for CAP-4 uiError helper.
   - **Applied:** §3.1 (both handlers), §2.5 (dedupe), §4.1.3 (crash tail = breadcrumbs written before the crash).
3. **React error-boundary best practice (report in the boundary, dedupe with global).**
   - react.dev Component reference — "Catching rendering errors with an error boundary" (react.dev/reference/react/Component): an error boundary is a class component with `static getDerivedStateFromError` (fallback UI) + `componentDidCatch(error, info)` ("lets you log that error to an error reporting service in production"); boundaries catch render/lifecycle/constructor errors of children but **not** event handlers; `info.componentStack` is the reporting payload. Legacy docs (legacy.reactjs.org/docs/error-boundaries.html) add the "not caught by any boundary ⇒ whole tree unmounts" motivation for router-level boundaries.
   - Caveat (react.dev, same page): in **development** React re-bubbles boundary-caught errors to `window`, so `window.onerror` sees errors the boundary already reported — the dedupe WeakSet in §2.5/§3.2 exists precisely for this.
   - TanStack Router `defaultErrorComponent` (current app wiring, router.tsx:10) is the router-level boundary — report there, keep the fallback rendering.
   - **Applied:** §3.2 (report seam in AppErrorComponent + optional RtPaneBoundary), §2.5 (dev re-bubble dedupe), §6.4 (banner from reported rows).
4. **Long-task / event-loop stall detection (watchdog floor).**
   - Long Tasks API W3C spec (w3c.github.io/longtasks): PerformanceObserver `{type:"longtask"}`; a long task is any uninterrupted main-thread period ≥ 50 ms. MDN PerformanceLongTaskTiming (developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming) and web.dev "Optimize long tasks" (web.dev/articles/optimize-long-tasks) document the 50 ms threshold and the user-perceived freeze relationship.
   - **Applied:** §5.4 (longtask observer, 250 ms report floor, 10 s coalesce) + the interval-lag fallback (§5.3) that works even where longtask attribution is unavailable.

No claim above exceeds what the citations state; where the design goes beyond the citations (250 ms floor, coalesce windows, 90 s budgets) it is presented as a design decision with rationale, not as external fact.

---

## §8 — Implementation spec (for the PRO implementer)

### 8.1 New files (all under repo root; none touch existing source until §8.2)

| File | Contents | Host |
|---|---|---|
| `src/lib/rt-events.ts` | Pure: RtLevel/RtEvent/RtScope types, `RT_SCHEMA_VERSION`, `RT_EVENT_NAMES` catalogue (§2.4), `shouldCoalesce`/`messageHash` (§2.5), constants table (§5.6), `RT_ERROR_TAIL = 200`. Zero imports (node:test friendly, mirrors tracing.ts:1-30 header doctrine). | client + CLI + tests |
| `src/lib/rt-ring.ts` | Pure ring (§4.1.1): createRtRing/rtPush/rtSerialize/rtHydrate/rtTail/rtStats. Zero window/fs. | client + tests |
| `src/lib/rt-ring.test.ts` | Ring tests (§8.4). | tests |
| `src/lib/watchdog.ts` | Pure: watchdogDecision/elapsedMs/budget, stall latch helpers, heartbeat schedule math. | client + CLI + tests |
| `src/lib/watchdog.test.ts` | Watchdog tests. | tests |
| `src/lib/rt-client.ts` | Host glue (client): singleton ring, `installRtClient()` (CAP-1 handlers + longtask observer + heartbeat + crash snapshot + pagehide flush), `reportRt(seed)` (CAP-2/3/4/10 callers import this), `rtSnapshot()` for the drawer, single-flight wild-start latch. Guards: `typeof window === "undefined"`, idempotent install. | browser only (imported by router.tsx) |
| `src/lib/diagnose.ts` | Pure: `buildDiagnosis({errors, timeline, watchdog, growth, persistHealth, project})` (§6.1/6.2) + `clientDiagnosisShape()`/`cliDiagnosisShape()` glue types. | client + CLI + tests |
| `src/lib/diagnose.test.ts` | Heuristic tests (§8.4). | tests |
| `src/lib/error-boundary-report.tsx` | `RtPaneBoundary` class component (componentDidCatch → reportRt with componentStack) + `reportBoundaryError(error, capture)` used by AppErrorComponent. | browser |
| `scripts/log-sink.mjs` | NDJSON appender/reader/rotator (§4.2): `appendRtLine(row)`, `readRtTail(dir, n)`, `resolveLogDir(projectPath)`, rotation. Pure Node, no TS import (CLI resilience — same lazy pattern as classify rapidtool-cli.mjs:128-146). | CLI |
| `src/lib/headless-diagnose.ts` | `diagnoseProject(path, opts)` (loadProject + readRtTail + doctorStatus + buildDiagnosis; never mutates). | CLI |
| (no new npm deps — everything is stdlib/react/zustand) | | |

### 8.2 Wire points — ordered batches (each batch ends green: typecheck + lane tests)

**Batch A — pure core (no behavior change anywhere).** Add rt-events.ts, rt-ring.ts, watchdog.ts, diagnose.ts + their tests. `npm run typecheck`, `npm test` (existing suites must pass untouched).

**Batch B — engine seam (additive, purity-preserving).** engine.ts:2493-2495: extend `WildStepOptions` with `onEvent?: (seed: RtEventSeed) => void`; emit at the 4 points of CAP-5 (entry ~2523, guard returns, success ~2576-2587, catch 2588-2600). Type-only impact on existing callers (opts is optional); wildStep callers in engine tests unchanged. Typecheck + engine/wild tests.

**Batch C — client install + global capture.** rt-client.ts + import at top of src/router.tsx (`import "./lib/rt-client.ts"` before routeTree import — installRtClient runs on module load, client only) + report seam in error-component.tsx AppErrorComponent (CAP-2) + RtPaneBoundary wrapping HomeScreen/RunScreen bodies (console.tsx:1015/1140 return statements) + WeakSet dedupe. Typecheck + build (SSR guard verified: module must no-op server-side).

**Batch D — store + UI capture.** CAP-3 store.ts catch-site emits (lazy import of reportRt or injected recorder), CAP-4 uiError helper + setError-site sweep in console.tsx (grep-driven list from §3.4), chat send row (console.tsx:4489-4492), CAP-10 client deadline wrappers in llm.ts:53-72 + chat.ts:58-73 (Promise.race + late-settle latch). Store/chat/console tests + typecheck.

**Batch E — driver watchdog.** store.ts:710-800: pass onEvent sink into wildStep, per-step elapsed watchdogDecision, stall latch + pause-on-resolve path (§5.2), single-flight latch consulted by console.tsx:540 (via rt-client export); headless.ts:1645-1713 wildStartRun optional sink + cap row; heartbeat + longtask + interval-lag in rt-client.ts (§5.3/5.4). Watchdog tests + store.test wild suites (846-919 region) must stay green; new tests for pause-on-resolve with fake timers.

**Batch F — CLI log-sink + diagnose.** scripts/log-sink.mjs; rapidtool-cli.mjs: respond() append (CAP-7, 106-125), main catch 1068-1080, loader 230-244; `diagnose` case + USAGE entries + README-cli.md "Diagnostics"/"Exit codes" sections; headless-diagnose.ts; pass sink into wild/run/gate/verify/crew/harvest cases where envelopes land.

**Batch G — UI drawer.** Diagnose drawer + banner + Copy + crash-bundle download (console.tsx Diagnostics rail 2423-2431 + SettingsDialog at 2435), ledger-mirror helper (§3.9) wired in store driver + headless. Typecheck + lint + browser smoke (scripts/browser-smoke.mjs) + the repo's probe conventions.

### 8.3 Types addendum (additive only)

- types.ts:113-119 JsonLog: **unchanged** (decision: ledger stays v1; rt mirror rows reuse JsonLog shape with `event: "rt."+…`). If a future wave adds `scope?`/`code?` to JsonLog it must be optional + tolerated by hydrateProject (engine.ts:1470) and the sanitize paths (chat.ts:170-187 pattern).
- errors.ts: **no new codes** (§header). If the implementer finds an uncodable class, add to ERROR_CODES (errors.ts:22-37) + ERROR_CODE_DOC (183-254) + errors.test.ts sync — additive tail only.
- WildStepResult (engine.ts:2175-2191): unchanged; optional `timeoutMs` may ride in `WildStepOptions` for future engine-native budgets (not required for v1).

### 8.4 Test plan (runners: `node --test` suites as package.json:16; typecheck; lint)

| Area | Tests |
|---|---|
| rt-events | catalogue completeness pin (mirrors errors.test.ts sync pattern); coalesce window math; messageHash truncation; level order. |
| rt-ring | push under cap (200) drops oldest; byte cap trims; serialize→hydrate round-trip identity; corrupt blob → empty + flag; hydrate tolerates legacy/extra fields; rtTail newest-first; rtStats counts incl. error/critical counts. |
| watchdog | watchdogDecision tiers at 0.99×/1×/1.99×/2×; pause-on-resolve decision with stall latch; heartbeat schedule math; lag thresholds; never-auto-resume invariant. |
| engine seam | wildStep with recorder onEvent: assert exact emission sequence for noop/paused/exec/complete/catch paths (recorder array; existing fixtures); zero emissions when onEvent absent (byte-identical behavior: deep-equal project against no-sink run). |
| store driver | startWildRun with injected sink: rows for cap (fake 20-step), pause carry, catch path; pause-on-resolve: simulate 2×-budget step via injected reviewer that sleeps past budget then resolves → assert wildPause row + code + stoppedReason "paused"; single-flight latch refuses concurrent start (store.test.ts:882-896 pattern). |
| hydrate/persist | quota-fail path emits persist.quota_failed/persist.salvaged (swap storage like store tests do, store.ts:547-553 pattern); corrupt blob emits hydrate.recovered_corrupt exactly once (guard 671+681 double-emit). |
| CLI | log-sink: append creates dir/file; line-per-row; rotation at 5 MB (shrink constant in test via env override); torn last line skipped by readRtTail; diagnoseProject on temp project + temp log dir: envelope shape, errors tail, growth bytes, mostLikelyCause none-detected on clean project; wild macro writes wild.step_ok rows (temp dir, no API key → not-configured path). |
| UI | error-component: render AppErrorComponent with thrown Error → recorder captured boundary.crash row w/ code + clipped message; RtPaneBoundary componentDidCatch captures componentStack; dev re-bubble dedupe: same error object through boundary + window handler yields one row. Drawer: buildClientDiagnosis returns schema-conformant object on a seeded store (store.test fixture pattern). |
| Docs/CI | typecheck + lint green; README-cli.md updated; `npm test` full suite (existing tests untouched by design — verify zero edits to existing expectations except where a suite asserts console.warn silence on store persist paths, which now also emit rows: assert additive, not replacement). |

### 8.5 Out of scope (logged, not built here)

- Server-side NDJSON for the hosted (TanStack Start) server process itself — this design covers browser + file CLI; a server-wave may reuse rt-events schema.
- Remote crash reporting / backend ingestion (no server filesystem in hosted product — feasibility note at tracing.ts:11-13; ring + NDJSON are the transport-agnostic substrate).
- LLM latency tracing per-span (tracing.ts model exists; wiring recorder for crew/verify spans is a separate wave — §1.8).
- Auto-healing (auto-retry of failed steps): design only guarantees detect → honest pause → human/agent resume (matches the house honesty floor, engine.ts:2276-2284).

---

## Appendix A — Constants quick reference

See §5.6 table (single source of truth moves to rt-events.ts at implementation).

## Appendix B — Anchor index (verified 2026-09-06)

engine.ts:271-282, 933, 1209, 1470, 1816, 2091, 2112, 2145-2195, 2173-2191, 2195-2200, 2203-2228, 2259-2308, 2311-2313, 2316, 2404, 2471, 2492-2601 · types.ts:113-119, 129-137, 343, 368-378 · errors.ts:22-37, 45-47, 122-176, 183-254 · store.ts:300-403, 410-511, 513-518, 520-544, 547-553, 560-564, 569-582, 585-645, 647-684, 686-687, 700-816, 817-853, 854-911, 916-999, 1004-1100, 1106-1149, 1150-1250, 1264-1320, 1355 · console.tsx:34, 243, 269-316, 345-420, 500-545, 601-733, 955-993, 1015, 1140, 1156-1159, 1164-1428, 2074-2076, 2423-2431, 2435, 4245-4263, 4425-4454, 4460-4499 · chat.ts:19-30, 58-73, 156-206 · llm.ts:18-32, 34-44, 53-83 · deepseek.server.ts:43-44, 49, 113-141, 192, 236-237, 291 · wild-mode.server.ts:34, 243-309 · headless.ts:50-81, 233-265, 441-497, 961-978, 1275-1317, 1620-1631, 1645-1713, 1715, 1733, 1761 · rapidtool-cli.mjs:1-30, 98-125, 128-146, 213, 230-244, 246-1051, 850, 936, 1051-1066, 1068-1080, 1090-1123 · error-component.tsx:14-39, 50-86, 93-109 · router.tsx:5-17 · __root.tsx:9-12, 48-53, 64 · index.tsx:1-13 · run.$id.tsx:1-17 · watcher.ts:1-33 · tracing.ts:1-80 · store.test.ts:195-227, 846-919 · package.json:16, 75
