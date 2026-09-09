# 19 — Chat Integration Plan: Chat tab (UI) + CLI error-code surfacing

- **File:** `research/multiagent/19_chat_integration_plan.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`)
- **Date / agent:** 2026-09-06 · Flash integration-planner F3 (STRICTLY read-only on source — the only file written this pass is this one)
- **Host:** Windows 10 (git-bash), Node `v22.23.2`. Repo is NOT git.
- **0-hallucination rule:** every `file:line` anchor below was re-verified against the on-disk bytes on 2026-09-06 by direct read. Two contract files (`src/lib/chat.ts`, `src/lib/errors.ts`) are **absent from disk today** (verified by `ls src/lib`) — everything this plan says about their shapes is labeled **[CONTRACT — assumed from mission; re-verify on disk before coding]** and every consumer is specced to normalize their output defensively (the repo's standing pattern for sibling drift, e.g. `mdBlocksOf` at `src/components/console.tsx:2122-2148`, DesignPane/DiagramPane normalization comments at `console.tsx:44-47`).
- **Apply timing:** the CLI file and `console.tsx` are currently owned by running auditors. **Do NOT apply this plan until both auditors land**; then re-grep the anchor snippets below before patching (line numbers shift if their diffs land first). Every anchor lists its unique surrounding text so a fuzzy re-locate is possible.
- **Scope boundary:** Chat tab renders inside `RunScreen`'s tab bar and reads store state read-only. It calls `chatOnce` (a lib call) — **no store actions change, no persisted schema change, no exit-code taxonomy change.**

---

## 0. Verified landscape (what the plan builds on)

| Fact | Verified anchor |
|---|---|
| `RunTab` union (8 tabs today) | `src/components/console.tsx:91` — `type RunTab = "artifacts" \| "packet" \| "spec" \| "crew" \| "oracle" \| "design" \| "diagram" \| "vault";` |
| Tab bar: `Tabs.Root` / `Tabs.List` / triggers | `console.tsx:1422` (`Tabs.Root value={tab} onValueChange={…setTab(v as RunTab)}`), `1423-1425` (`Tabs.List` + aria-label), last trigger (Diagram) `1469-1474`, `</Tabs.List>` at `1475` |
| Panel pattern — every panel `Tabs.Content value=… forceMount className="data-[state=inactive]:hidden"`; last panel (Diagram) `1604-1606`, `</Tabs.Root>` at `1607` | `console.tsx:1477-1607` (comment at `1477`: forceMount keeps every panel mounted) |
| Pane component pattern = `function XPane({ project }: { project: Project })` | `VaultPane` `console.tsx:2392`, `DesignPane` `2994`, `DiagramPane` `3293` (closes `3410`; `DeepenAction` section starts `3412`) |
| Markdown renderer: `renderMarkdownBlocks(text): MdBlock[]` (pure, XSS-safe by construction, NEVER innerHTML) | `src/lib/render.ts:119`; grammar header `render.ts:11-36`; defensive consumer `mdBlocksOf` `console.tsx:2122-2148`; `MarkdownBody({text})` component `console.tsx:2157-2263` (function declaration — hoisted, callable from a later-defined ChatPane) |
| RunScreen store access + state | `console.tsx:444` `RunScreen({id})`; `useRapid()` destructure `446-468` (incl. `llmStatus` `466`); `project = projects.find(p => p.id === id)` `469`; tab state `482`; busy latch pattern `475` (`busyRef`) + `631-644` (`run()`); `rec = project?.phases[project.currentPhase]` `583` |
| Input / chip / badge class conventions | search input `console.tsx:1489`; mono chips `1368-1381`; tone classes `text-ok/text-danger/text-warn/text-faint` `59-77`; error line `role="alert" … text-danger` `3384-3388`; busy glyph `animate-pulse` `63` |
| Project / phase / gate field shapes | `src/lib/types.ts`: `PhaseStatus` `:4`, `ProjectStatus` `:6-11`, `HitlRequest` `:121-133+` (`phase,title,prompt,stakes,forceHuman?,requestedAt?`), `Project` `:231+` (`brief` `:234`, `status` `:237`, `currentPhase` `:238`, `phases: PhaseRecord[]` `:239`, `hitl: HitlRequest \| null` `:261`, `lastTest: {ok,detail,label?} \| null` `:290`). `Project.packet: string` read at `console.tsx:1528`, stamped by `store.ts:915-923` |
| Phase titles | `src/lib/phases.ts`: `PHASES: PhaseDef[]` `:3` (id/code/title…), `phaseDef(id)` `:112`, `STOCK_HITL=[4,5,8,9]` `:134` |
| Store (zustand, persisted `"rapidtool.v4"`) — actions enumerated, none change | `src/lib/store.ts:40-80` (state/actions), persist+partialize `966-992` (projects/activeId/autopilot/demoSeeded — **chat history intentionally NOT persisted**), `llmStatus` surface `445` `{configured,label,model?}`, `autopilot` `:443` (init `false`) |
| CLI envelope single choke point | `scripts/rapidtool-cli.mjs:84-89` `respond(result, exitCode)` — every `{ok:false,…}` leaves through this one function; all respond call sites enumerated §4.3 |
| CLI exit taxonomy (UNCHANGED by this plan) | `0` payload · `1` usage/validation/state · `2` parked HITL/blocked (`run`/`gate`) · `3` backend not configured · `4` internal/backend runtime error — `rapidtool-cli.mjs:169-182, 339-341, 372-379, 451-456`; README contract `scripts/README-cli.md:277-292` |
| CLI dynamic-import pattern for sibling `.ts` (memoized, `pathToFileURL`) | `rapidtool-cli.mjs:95-103`; test files static-import `.ts` with explicit extension (e.g. `src/lib/crew.test.ts` → `import … from "./crew.server.ts"`) |
| README-cli structure | `scripts/README-cli.md` — exit-code prose `277-292`; `## Full agent loop (Hermes-style)` heading at `294`; tests note `350-354` |
| Test invocation | `package.json:19` — `node --test "scripts/**/*.test.mjs" && node --experimental-strip-types --test "src/lib/*.test.ts" "src/lib/app-data/app-data.test.ts" "src/lib/auth/*.test.ts"`; typecheck `package.json:17` (`tsc --noEmit`) |

---

## 1. Contract surface the plan codes against [CONTRACT — assumed from mission; re-verify]

Both modules are mid-flight under a Pro sibling. **Gate rule: the parent must confirm both files exist and export the names below BEFORE handing this plan to a builder** (the Chat tab and CLI `code` field are dead code without them).

### 1.1 `src/lib/errors.ts` (assumed exports)

```ts
export type ErrorCode = string;            // values are "RT_E_*", e.g. RT_E_NOT_CONFIGURED (exact union is sibling-owned)
export type ErrorTone = "ok" | "warn" | "danger" | "faint";
export type ErrorDocRow = { label: string; tone: ErrorTone; agentAction: string };
export const ERROR_CODE_DOC: Readonly<Record<ErrorCode, ErrorDocRow>>;
export function classifyError(err: unknown, fallback?: ErrorCode): ErrorCode;  // string | Error | anything → stable code
export function codeError(message: string, code?: ErrorCode): Error & { code: ErrorCode };
```

UI contract notes (what the Chat tab depends on):
- `ERROR_CODE_DOC[code]` gives `{label, tone, agentAction}`. `tone` maps 1:1 onto the console's existing tone classes (`text-ok|text-warn|text-danger|text-faint`, verified `console.tsx:59-77`) — the plan never invents colors.
- `agentAction` is a short imperative tooltip string ("set DEEPSEEK_API_KEY and retry", "approve the parked gate", …).
- `classifyError` is pure and total (never throws, always returns a code the doc covers). **Unit test requirement passed to the sibling:** every key of `ERROR_CODE_DOC` must have a row; `classifyError` must return only doc-covered codes.

### 1.2 `src/lib/chat.ts` (assumed exports)

```ts
export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ChatResult =
  | { ok: true; reply: string; model?: string; usage?: { promptTokens: number; completionTokens: number } }
  | { ok: false; code: ErrorCode; error: string; reason?: "not-configured" | "error" };
export async function chatOnce(
  project: Project,
  prompt: string,
  opts?: { history?: ChatTurn[]; model?: LlmModel },
): Promise<ChatResult>;
```

- `chatOnce` is client-side, calls the existing server-fn boundary `llm.ts: complete()` (`src/lib/llm.ts:44-62`; `LlmResult` shape `llm.ts:16-23`), and follows the honesty lattice: no key → `{ok:false, code: <not-configured code>, reason:"not-configured"}` — never fabricated text (pattern: `src/lib/deepseek.server.ts:55-61`).
- `chatOnce` builds its own system context from `project` (brief/name/currentPhase/hitl/packet) — the ChatPane does NOT need to assemble context.
- **Unit test requirement passed to the sibling:** `src/lib/chat.test.ts` with a stubbed completer (crew.test.ts style) covering ok path, not-configured path, and backend-error → `code` path.

If the landed shapes differ, the builder records the delta at the top of this plan and adjusts only the two thin import/normalize seams (§3.4, §4.1) — nothing else.

---

## 2. Part A — Chat tab: exact spec

### 2.1 Insertion anchors (`src/components/console.tsx`, current bytes)

| # | Edit | Anchor (verified 2026-09-06) |
|---|---|---|
| A1 | Extend the union | `console.tsx:91` — replace `"diagram" | "vault";` with `"diagram" | "chat" | "vault";` (unique in file) |
| A2 | Add `phaseDef` to the phases import | `console.tsx:27` — `import { PHASES } from "@/lib/phases";` → `import { PHASES, phaseDef } from "@/lib/phases";` |
| A3 | Add sibling imports | after `console.tsx:52` (`import { renderMarkdownBlocks } from "@/lib/render";`) add: `import { chatOnce, type ChatTurn } from "@/lib/chat";` and `import { ERROR_CODE_DOC } from "@/lib/errors";` (comment: sibling lib modules — see 19_chat_integration_plan.md §1; static import is the gate that errors.ts/chat.ts landed) |
| A4 | Add trigger | between `console.tsx:1474` (`</Tabs.Trigger>` closing Diagram) and `1475` (`</Tabs.List>`): copy the Diagram trigger block verbatim (`.trigger` className string identical at `1429`), `value="chat"`, label `Chat` |
| A5 | Update tab-bar aria-label | `console.tsx:1424` — append `chat` to the label list: `"Run console tabs: artifacts, agent packet, spec graph, crew, oracle, design, diagram, chat, vault"` |
| A6 | Add panel | between `console.tsx:1606` (`</Tabs.Content>` closing Diagram) and `1607` (`</Tabs.Root>`): `<Tabs.Content value="chat" forceMount className="data-[state=inactive]:hidden"><ChatPane project={project} /></Tabs.Content>` (project is in scope in `RunScreen`, `console.tsx:469`/`621`) |
| A7 | Add ChatPane component | after `console.tsx:3410` (closing `}` of `DiagramPane`), before the `DeepenAction` comment block at `3412` — insert the full component (§2.2). Function declaration → hoisted, so its use of `MarkdownBody` (`:2157`) is safe regardless of position |

No `RunScreen` state/`busyAction`/keyboard-handler changes are needed. The pane is self-contained; `forceMount` keeps its message state alive across tab switches (comment `console.tsx:1477`).

### 2.2 ChatPane component spec

**Signature.** `function ChatPane({ project }: { project: Project })` — identical prop shape to `VaultPane` (`console.tsx:2392`).

**Local view types + state** (mirrors `CrewMsgView` pattern `console.tsx:94-111`):

```ts
type ChatMsgView = {
  id: number;                    // incrementing local counter
  role: "user" | "assistant";
  text: string;
  ts: number;
  code?: string;                 // normalized "RT_E_*" when the turn failed (or not-configured)
  error?: boolean;               // true ⇒ rendered as a failure row with badge
};
```

State (all local, nothing persisted — store partialize untouched, `store.ts:966-992`):
- `msgs: ChatMsgView[]` — trimmed to **last 6 turns = last 12 entries** after every send (drop oldest 2 when over). Rendered list = `msgs.slice(-12)` (defensive).
- `draft: string`, `busy: boolean` + `busyRef` latch (copy the RunScreen pattern `console.tsx:475, 631-644`: set before await, clear in `finally`, re-entrant sends ignored while busy).
- `scrollRef` (auto-scroll the message region on `msgs` change — `useEffect` on `msgs` + `scrollRef.current?.scrollTo`).
- Capability read: `const { llmStatus } = useRapid();` (store surface `store.ts:445`: `{configured,label,model?}`) — caption only, never blocks input.

**Handlers.**

1. `send(promptOverride?: string)` — used by both the input (Enter) and the chips:
   - `const text = (promptOverride ?? draft).trim(); if (!text || busyRef.current) return;`
   - push `{role:"user"}` row; clear `draft`; `busyRef.current = true`; `setBusy(true)`.
   - `const res = await chatOnceSafe(project, text, lastSixTurns())` (§2.3 wrapper); `finally` clears busy.
   - On `res.ok` → push `{role:"assistant", text: res.reply, …}`; on failure → push `{role:"assistant", text: res.error ?? "Chat failed.", error: true, code: normalizeCode(res.code) ?? undefined}`.
   - Trim to last 12; auto-scroll.
2. Send-on-Enter: on the input, `onKeyDown` → `if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }` (plain Enter sends; the busy latch absorbs repeats). No other RunScreen key handling is touched (`console.tsx:517-581` global handler already ignores events while typing in INPUT/TEXTAREA, `:520-526`).
3. Chips (§2.4) call `send(prompt)` — they **prefill by sending the built prompt** (mission: chips prefill prompts built from live state); the draft box is not pre-populated, avoiding stale-text traps. Each chip is disabled while `busy`.

**Render tree** (all classes are existing console conventions):

- Pane header row: `font-mono text-xs text-muted` title — `Chat · {llmStatus.configured ? (llmStatus.model ?? llmStatus.label) : llmStatus.label}` (`label` is `"deterministic engine"` when unconfigured, `store.ts:445`) + short honest hint when `!llmStatus.configured`: `"No LLM backend — sends fail with a not-configured error code until DEEPSEEK_API_KEY is set."` (matches the honesty-lattice caption style of the crew UI).
- Message region: `role="region" aria-label="Chat history" className="max-h-[480px] overflow-auto px-5 py-4 space-y-3"` (packet panel sizing precedent `console.tsx:1526`). Empty state (no msgs): bordered dashed box (precedent `3403`) with the three chip hints + backend note.
- User row: `rounded-md border border-border bg-raised px-3 py-2` with a `font-mono text-[10px] text-faint` timestamp (`fmtClock` style `console.tsx:207-210`) + body `whitespace-pre-wrap text-sm` (plain text, React-escaped).
- Assistant row: same container; body rendered **via `<MarkdownBody text={…} />`** (`console.tsx:2157` — reuses the XSS-safe block renderer; inline markdown stays literal per `render.ts:6-9`). Failure rows (`error:true`) render: `<MarkdownBody>`-free error text (keep the raw error mono, `text-danger`), then the **error-code badge** (§2.3). Never `innerHTML` anywhere.
- Badge: `<span title={agentAction} aria-label={`Error ${code}: ${label}. ${agentAction}`} className="…border …px-1.5 py-0.5 font-mono text-[11px] rounded-sm">` where classes derive from the doc row tone: `tone==="danger"` → `text-danger border-danger/30`; `"warn"` → `text-warn border-warn/30` (border-warn/30 precedent `console.tsx:1379`); `"ok"` → `text-ok`; `"faint"` → `text-faint`; base `border-border`. Native `title` tooltip (console imports no Tooltip; `@radix-ui/react-tooltip` is installed at `package.json:46` but introducing it is out of scope — native title + aria-label keep the plan additive).
- Input row: `<input aria-label="Ask about this build" placeholder="Ask about this build… (Enter to send)" className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-accent/40" disabled={busy} value={draft} onChange={…} onKeyDown={…} />` (input styling verbatim from `console.tsx:1489`) + a Send button (`disabled={busy || !draft.trim()}`, `RotateCcw`-style glyph optional — reuse an imported lucide icon or text label "Ask"; glyph list at `console.tsx:6-26`).
- Chips row (above the input): three buttons, class = chip base `rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-muted hover:text-fg` (precedent `1368-1381`), labels: `explain current gate` · `next legal action` · `summarize packet`.
- Busy indicator: while `busy`, append an assistant row with `<span className="h-2 w-2 animate-pulse rounded-full bg-current inline-block" /> thinking…` (glyph precedent `console.tsx:63`).

### 2.3 Defensive normalization seams (repo drift rule)

```ts
function normalizeCode(c: unknown): string | null {
  return typeof c === "string" && /^RT_E_[A-Z0-9_]+$/.test(c) ? c : null;
}
function codeDocOf(code: string) {   // ERROR_CODE_DOC is a sibling export — never trust its shape
  try {
    const d = (ERROR_CODE_DOC as Record<string, unknown>)[code];
    if (!d || typeof d !== "object") return null;
    const anyD = d as { label?: unknown; tone?: unknown; agentAction?: unknown };
    if (typeof anyD.label !== "string" || typeof anyD.agentAction !== "string") return null;
    const tone = anyD.tone;
    const t = tone === "ok" || tone === "warn" || tone === "danger" || tone === "faint" ? tone : "faint";
    return { label: anyD.label, tone: t, agentAction: anyD.agentAction };
  } catch { return null; }
}
```

- Badge behavior: code present + doc row → colored badge + tooltip `agentAction`; code present + no row (drift) → neutral badge showing the raw code with `title="Uncatalogued error code"`; no code (malformed result) → generic `text-danger` row, **no badge invented**.
- `chatOnceSafe` wraps `chatOnce` in try/catch (never trust a lib to keep its `{ok:false}` contract) and shape-checks the ok branch (`typeof res.reply === "string"`); malformed → synthetic `{ok:false, code: null-ish, error: "Chat backend returned an unparseable response."}`.
- History to send: `msgs` → `ChatTurn[]` mapping (`role`/`content` from stored rows; user rows and assistant rows alternate; error rows map to assistant turns with their error text) — pass only when `opts.history` is accepted by the landed `chatOnce` (probe once: `typeof chatOnce === "function"` at module use is implicit via import; history passing is optional per landed signature — if the landed signature lacks `history`, drop it; **last-6-turns display stays regardless**).

### 2.4 Quick-action chips — prompt builders from live state

Chips read live fields (all verified in §0): `project.currentPhase`/`status`/`hitl`/`phases`/`packet`/`lastTest`/`artifacts`/`name`/`brief`, `phaseDef(currentPhase).title`, `llmStatus`, and (via `useRapid()`) `autopilot`. Prompt strings are exact template literals, null-tolerant:

1. **explain current gate** — `const h = project.hitl;`
   - `h` → `` `Explain the approval gate now open at P${h.phase} — ${h.title}: what it is asking (${h.prompt}), its stakes (${h.stakes}), and exactly what evidence an approval needs${h.forceHuman ? " (this is a human-only forceHuman gate)" : ""}. What makes its DoD pass or fail?` ``
   - no `h`, `status === "blocked"` → `` `This build is blocked at P${project.currentPhase} (${phaseDef(project.currentPhase).title}). Explain why a build parks as blocked, what a retry does, and what a rejection note must contain to unlock it.` ``
   - no `h`, else → `` `No gate is open: project status "${project.status}" at P${project.currentPhase} (${phaseDef(project.currentPhase).title}), phase status ${project.phases[project.currentPhase]?.status ?? "unknown"}. Explain the current pipeline state and what would open the next gate.` ``
2. **next legal action** — `` `What is the single next legal action for this build? State: project "${project.status}" at P${project.currentPhase} (${phaseDef(project.currentPhase).title}); that phase's status: ${project.phases[project.currentPhase]?.status ?? "unknown"}; autopilot: ${autopilot ? "on" : "off"}. Evaluate run/gate step, approve, reject, retry-after-rejection, ingest agent report, and packet/export — say which are legal now and which are not, and why, per the phase machine's transition rules.` ``
3. **summarize packet** — packet-length-aware:
   - `project.packet` → `` `Summarize this build's agent packet (currently ${project.packet.length} chars) for a fresh agent: goal, architecture, current phase, gate status, top constraints, and the single most useful next step. Keep it under 200 words; do not invent details not in the packet.` ``
   - no packet → `` `The agent packet for "${project.name}" is not compiled yet (project at P${project.currentPhase}, status ${project.status}). Summarize where the build stands from the phase state instead, and say what action compiles the packet.` ``

Chip builders live as pure local functions in ChatPane (unit-testable by extraction later); they may reference `lastTestCaption`-style text only through a local helper over `project.lastTest` (`types.ts:290`) — do not call console's private helper.

---

## 3. Part B — CLI error-code integration (`scripts/rapidtool-cli.mjs`)

### 3.1 The one-line choke point

`respond()` (`rapidtool-cli.mjs:84-89`) is the ONLY writer of stdout envelopes and every failure leaves through it, so the whole integration is: **attach `code` inside `respond` when `ok === false`**. Zero per-call-site edits; exit codes are already passed explicitly at every call site and stay byte-identical.

Sketch (apply by hand):

```js
// :82-89 today —
// E-25: single JSON object on stdout + the machine exit code. Every result
// gains schema_version/cmd/exit_code; the legacy `ok` field is kept.
// NEW: every {ok:false} envelope also gains `code` (RT_E_* from src/lib/errors.ts
// classifyError) — additive; exit-code taxonomy unchanged.
function respond(result, exitCode) {
  const out = { schema_version: SCHEMA_VERSION, cmd: CMD ?? null, ...result };
  if (out.ok === false && typeof out.code === "undefined") {
    const code = classify(result.error ?? result.reason ?? "");
    if (code) out.code = code;   // code omitted only if errors.ts is absent (resilience)
  }
  out.exit_code = exitCode;
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  process.exit(exitCode);
}
```

`classify` is a module-level function ref seeded by a loader that mirrors the driver pattern (`rapidtool-cli.mjs:95-103`):

```js
// Lazy, memoized, never-throw load of the sibling errors module (same
// pathToFileURL mechanics as DRIVER_PATH at :95-97).
let classify = () => null;                       // default: omit code (module absent)
let errorCodesLoaded = false;
async function ensureErrorCodes() {
  if (errorCodesLoaded) return; errorCodesLoaded = true;
  try {
    const mod = await import(pathToFileURL(
      join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "errors.ts")).href);
    if (typeof mod.classifyError === "function") {
      const fn = mod.classifyError;
      classify = (text) => { try { return fn(text); } catch { return null; } };
    }
  } catch { /* errors.ts absent — respond omits `code`; CLI stays fully functional */ }
}
```

`main()` (`rapidtool-cli.mjs:123`) gains `await ensureErrorCodes();` as its first statement (after `CMD = cmd ?? null;` at `:126`, before the `:129` no-cmd respond). Rationale for dynamic-import + fallback instead of a static `import "../src/lib/errors.ts"`: it matches the CLI's established optional-sibling loader convention (glossary `17_agent_ux_review.md:16`) and keeps every command working even if the sibling module is missing — a static import would brick `doctor` too. `node --experimental-strip-types` strips `.ts` in the graph (proven by `src/lib/crew.test.ts` static-importing `./crew.server.ts`).

Also update the E-25 comment block at `rapidtool-cli.mjs:82-83` and the header note at `:7-8` (one line: "failures carry `code` (RT_E_*, see scripts/README-cli.md 'Error codes')").

### 3.2 Failure sites automatically covered (verified call sites — spot-check list for the builder)

`{ok:false}` respond calls, all via the single `respond()`: missing subcommand `:129`; missing `--project` `:137`; load failure `:141`; create missing `--brief` `:152`; approve no-gate `:189`; reject no-gate `:200`, missing `--note` `:203`, short note `:205-208`; ingest missing `--report` `:219`, unreadable source `:224-227`, bad JSON `:233`, persist-fail `:249-252`, rejected report `:254`; vault module/write failure `:303`; search missing `--query` `:311`, runtime `:318`; crew not-configured/error `:340`; verify no-generatedSource `:355`, failed/error payload `:387`; design error `:404`; diagram error `:424`; doctor failure `:442`; unknown subcommand `:448`; outer internal catch `:456`. Exit codes at each site are untouched (taxonomy §0).

### 3.3 README-cli error-code table (`scripts/README-cli.md`)

- Edit the intro envelope sentence at `README-cli.md:15-19` (one clause: "…and failures additionally carry a `code` (RT_E_*, table below)").
- **Insert a new section between `README-cli.md:292` (end of the exit-code bullet list / `summary` note) and `:294` (`## Full agent loop`):**

```
## Error codes (RT_E_*)

Every `{ "ok": false, … }` envelope carries `code`, a stable machine-readable
error id produced by `classifyError` (`src/lib/errors.ts`) from the human
`error` text. Codes never replace the exit-code taxonomy above — they refine
it: the same exit code can carry different codes, and agents should branch on
`code` first, `exit_code` second. The canonical registry is `ERROR_CODE_DOC` in
`src/lib/errors.ts`; this table mirrors it (one row per code):
<generate one row per ERROR_CODE_DOC key at apply time: code | label | agentAction | typical exit_code>
```

The exact rows are filled from the landed `ERROR_CODE_DOC` at apply time (the table must not be hand-invented before the sibling lands — this plan intentionally lists no RT_E_ literals). Expected coverage: usage-class codes (exit 1), not-configured (exit 3), backend/internal (exit 4) — confirm against the classify mapping of the strings at §3.2.

### 3.4 Envelope versioning

Adding an optional `code` on the failure branch is additive for JSON consumers (they already branch on `ok`/`error`); keep `SCHEMA_VERSION = 1` (`rapidtool-cli.mjs:34`) and say so in the README paragraph (schema-version bumps are for breaking envelope changes, not new fields).

---

## 4. Test plan

**Suites.** (a) NEW `src/lib/errors.test.ts` + `src/lib/chat.test.ts` — sibling-owned, must be green BEFORE this plan is applied (they are the contract). (b) Existing full suite, unchanged: `npm test` (`package.json:19`). (c) `npm run typecheck` (`package.json:17`) — the Chat tab imports sibling modules, so typecheck is the UI wiring gate. (d) CLI behavior has no automated suite today (README contract + manual); keep it that way — the change is one function.

**Key cases (5).**
1. `errors.test.ts` — `classifyError` is total and doc-covered: for each of the current CLI failure strings (e.g. `"Project missing."`, `"No pending approval."`, `"Rejection requires at least 12 characters of qualitative feedback."`, `"Waiting on human approval."`, `"crew unavailable (not-configured)…"`, `"Report is not valid JSON: …"`, `"Failing sandbox output requires explicit override…"`, and the outer-catch `Error` instances) the returned code exists in `ERROR_CODE_DOC`; a novel string maps to a stable fallback code; every `ERROR_CODE_DOC` row has `label/tone/agentAction`, tone ∈ the 4-tone set.
2. `chat.test.ts` — stub completer: (i) ok → `{ok:true, reply}`; (ii) completer returns not-configured → `{ok:false, code:<not-configured>, reason:"not-configured"}` with no fabricated text; (iii) completer throws → `{ok:false, code:<internal>, error}`; (iv) history param passes through when provided.
3. CLI envelope — manual (no suite): `node --experimental-strip-types scripts/rapidtool-cli.mjs approve --project <file-with-no-gate>` → stdout `{ok:false, code:"RT_E_…", exit_code:1}` and exit 1; repeat for a `reject` with a 4-char note and for `crew` with no key (exit 3, code present); then a happy `packet`/`summary` run → `ok:true` payloads have NO `code` field and identical bytes to pre-change output (regression).
4. UI wiring — `npm run typecheck` + manual browser pass: open a project → Chat tab present, panel renders, chips build prompts containing the live phase title/gate text; not-configured send renders the error badge row; artifacts/packet/design tabs render identically (regression).
5. Store/engine regression — full `npm test` green with zero store changes (this plan touches none of `store.ts`; `store.test.ts`, `headless.test.ts`, `render.test.ts` all run unmodified).

---

## 5. Ordered integration checklist (hand to ONE agent, after both auditors land)

- [ ] **0. Land-check the contract.** Read `src/lib/errors.ts` and `src/lib/chat.ts`. Confirm exports named in §1 (or record deltas at the top of this plan). Confirm their tests pass: `node --experimental-strip-types --test src/lib/errors.test.ts src/lib/chat.test.ts`. If either file is missing → STOP, report to parent (do not invent shapes).
- [ ] **1. Re-anchor.** Re-grep every anchor in §2.1/§3.1 against the post-auditor bytes (auditors own console.tsx/CLI right now): `grep -n "type RunTab" src/components/console.tsx`, `grep -n "</Tabs.List>" src/components/console.tsx`, `grep -n "</Tabs.Root>" src/components/console.tsx`, `grep -n "function DiagramPane" src/components/console.tsx`, `grep -n "function respond" scripts/rapidtool-cli.mjs`. Update line numbers in this plan before patching.
- [ ] **2. CLI first (smallest, independent).** `scripts/rapidtool-cli.mjs`: add the `classify` loader + `ensureErrorCodes()` (§3.1); call it first in `main()`; extend `respond()`; update the two comments. Verify §4 case 3 (three failure invocations + one happy regression). Do NOT touch exit codes.
- [ ] **3. README-cli.** `scripts/README-cli.md`: intro sentence `:15-19`; insert the "Error codes (RT_E_*)" section between `:292` and `:294` with rows generated from the landed `ERROR_CODE_DOC`.
- [ ] **4. console.tsx tabs.** Apply A1 (union), A5 (aria-label), A4 (trigger), A6 (panel) from §2.1 — four tiny edits; keep the trigger/content class strings byte-identical to their neighbors.
- [ ] **5. console.tsx imports.** Apply A2 (`phaseDef`) and A3 (`chatOnce`, `ERROR_CODE_DOC`) from §2.1.
- [ ] **6. ChatPane component.** Insert the component after `console.tsx:3410` (A7) implementing §2.2-2.4 verbatim: state + trim-to-6-turns, `send` with busy latch, Enter-to-send, MarkdownBody assistant rows, error badge with `normalizeCode`/`codeDocOf` seams, three chips, `llmStatus` caption, auto-scroll. Reuse only existing class tokens.
- [ ] **7. Typecheck + unit suite.** `npm run typecheck` (gate: sibling modules resolve) then `npm test` — all existing suites must pass unmodified.
- [ ] **8. Manual UI pass.** `npm run dev` (or existing preview flow): open a project; click Chat; verify (a) chips prefill prompts with correct live phase/gate text, (b) send with no API key → error badge row with `RT_E_*` code + agentAction tooltip, (c) tab-switch away and back preserves the thread (forceMount), (d) packet/artifacts/design tabs unchanged.
- [ ] **9. Regression sanity.** `packet`/`export`/`vault` CLI runs byte-identical on a sample project; console tabs other than Chat render identically.
- [ ] **10. Report back.** Note any contract deltas recorded in step 0 (they belong to the sibling owner, not this builder) and any anchor drift found in step 1.

---

## 6. Out of scope (do not sneak in)

- Persisting chat history into the store / localStorage (partialize at `store.ts:966-973` stays untouched).
- Error-code badges anywhere outside the Chat tab (ArtifactPane error surfaces, `setError` banners in `RunScreen`) — separate decision, not in this mission.
- A CLI `chat` subcommand, model selection UI, streaming responses, or Radix Tooltip adoption.
- Any change to the exit-code taxonomy or to `SCHEMA_VERSION`.
