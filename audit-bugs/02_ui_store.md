# RapidTool — Audit-bugs 02: UI / Store / Routes / Shell + LLM-integration UI gaps

Audit agent: Flash (read-only). Deliverable: verified bug register with proposed patches.
Source tree audited against on-disk bytes at `C:/Users/mnril/Desktop/RapidTool Main/`.
**No source files were modified.**

## Scope & files examined (current line counts)

| File | Lines | Role |
|---|---|---|
| `src/lib/store.ts` | 427 | zustand + persist store, run loop, DoD recording |
| `src/lib/dod.ts` | 293 | machine-checkable DoD registry + `runGate`/`readyFor` |
| `src/lib/gate-stats.ts` | 74 | approval-health / rubber-stamp whisper (pure) |
| `src/lib/handoff.ts` | 96 | per-phase handoff prompt compiler |
| `src/lib/io.ts` | 112 | project import/export, packet file export |
| `src/components/console.tsx` | 1290 | HomeScreen + RunScreen + all subcomponents |
| `src/routes/index.tsx`, `src/routes/run.$id.tsx`, `src/routes/__root.tsx` | 13/14/52 | route mounts + shell |
| `src/router.tsx` | 16 | error/not-found wiring |
| `src/lib/error-component.tsx` | 81 | AppErrorComponent / AppNotFoundComponent |
| `src/components/preview-host-bridge.tsx` | 26 | embedded-preview navigation bridge |
| `src/lib/engine.ts` (support) | 1118 | phase synthesis, approve/reject/hydrate, packet stamping |
| `src/lib/packet.ts` (support) | 243 | Agent Packet compiler (System JSON) |
| `src/lib/ai.ts` (support) | 137 | config-gated LLM provider stub (unwired) |
| `src/styles.css` | 72 | tailwind v4 theme + tokens |

## Method / verification statement

- Every finding below was verified by reading the cited file:line bytes, not by assumption.
- `npx tsc --noEmit` exits 0; `node --experimental-strip-types --test` over store/gates/gate-stats/io/handoff/sandbox/packet = **147/147 pass** (engine & DoD math currently consistent with tests).
- Consumer greps performed for `approvalHealth`, `ai.ts` imports, `rec.gate`, `modelRoute` assignments, `.gate` reads in console.
- A previous audit (`audit/02_ui_console_multiplayer_audit.md`) covered an older 801-line console; the file has since grown to 1290 lines and **several old bugs are already fixed** (noted in §8). Findings below are against the current code only.
- Note for readers: tool outputs redact secret-looking tokens; `src/lib/ai.ts:95` **is not** corrupted — it is `authorization: \`Bearer ${key}\`` (verified via `od -c`). Do not "fix" it.

Severity: **High** = data loss/corruption or core interaction broken · **Medium** = real defect with workaround · **Low** = polish/defense-in-depth.

---

## 1. Store & state-layer defects

### ST-1 — DoD gate verdict recorded *after* the packet is compiled → stale `gate_passed` in the flagship output — Medium (data freshness)
- **file:line** `src/lib/store.ts:293-299` (approve order), `src/lib/store.ts:161-174` (runReady order), `src/lib/engine.ts:900` (approveHitl stamps inside), `src/lib/engine.ts:822-823` (applyPhaseResult stamps inside), `src/lib/packet.ts:55-60` (System JSON reads `p.gate.passed` at compile time).
- **verified** Flow: HITL approve → `approveHitl()` runs `sealPacketArtifact(attachAlgorithms(base))` (engine.ts:900) which calls `compileAgentPacket` (packet.ts:68) **while `PhaseRecord.gate` is still `null`**, then `recordGate()` (store.ts:299) sets `rec.gate` and appends the gate artifact/logs **but never re-stamps the packet**. Same hole on the auto path: `applyPhaseResult` compiles the packet (engine.ts:822-823), `recordGate` runs at store.ts:161, and the packet is re-stamped **only** when a phase<12 auto-advance occurs (store.ts:165-174). A pipeline **completing at P12** therefore also ships a packet whose System JSON says `"gate_passed": null` for P12 while the gate artifact says PASS/FAIL.
- **why** After every HITL approval (P4/P5/P8/P9 + scheduler extras), the Agent Packet tab, "Download packet (.md)", the packet artifact in the artifacts pane, and any downstream agent parsing the `## System JSON` block read `gate_passed: null` for the just-decided phase — the exact field the DoD/handoff contract (AGENT_GUIDE §1/§3) tells agents to trust. Only "Copy agent packet" masks it because `copyPacket()` calls `refreshPacket()` first (console.tsx:369).
- **proposed fix** Re-stamp after gate recording:
```ts
// store.ts approve(): record the verdict, THEN recompile the packet over it.
const updated = recordGate(approved, project.currentPhase);
set((s) => ({
  projects: s.projects.map((p) => (p.id === id ? stampPacket(updated) : p)),
}));
```
```ts
// store.ts runReady(): cover the no-auto-advance leaves (complete at P12).
if (updated.status !== "awaiting_hitl" && phase < 12) {
  updated = { ...updated, currentPhase: next, phases: /* … */ };
  updated = stampPacket(updated);
} else if (updated.status === "complete") {
  updated = stampPacket(updated); // P12 completion keeps gate_passed fresh
}
```

### ST-2 — `reject()` lacks the phase-match guard that `approve()` has — asymmetric gate validation — Low
- **file:line** `src/lib/store.ts:270-276` (approve rejects when `project.hitl.phase !== project.currentPhase`) vs `src/lib/store.ts:305-315` (reject checks only `project.hitl` presence, never that `hitl.phase === currentPhase`).
- **verified** Byte-diff of the two action bodies: approve validates phase + forceHuman; reject validates note length and `hitl` existence only, then calls `rejectHitl(project, note)` (engine.ts:903) which trusts `project.currentPhase`.
- **why** Unreachable in the current state machine (a parked gate is always on `currentPhase`), but it is a one-line defense-in-depth parity gap: a stale/duplicated `hitl` object (persisted corruption, import) could be rejected out-of-phase while approve would refuse. Rejections are the steering input with the longest downstream consequences (`rejectionHistory`, regeneration), so they deserve the same guard.
- **proposed fix** Mirror the approve guard:
```ts
reject: (id, note) => {
  if (note.trim().length < 12) return { ok: false, error: "…" };
  const project = byId(get().projects, id);
  if (!project) return { ok: false, error: "Project missing." };
  if (!project.hitl) return { ok: false, error: "No pending approval." };
  if (project.hitl.phase !== project.currentPhase)
    return { ok: false, error: "HITL phase does not match the current edge." };
  // also: guard rec status === "awaiting_hitl" before rejectHitl
  …
}
```

### ST-3 — Archiving the last project is undone on reload: `seedIfEmpty` resurrects the demo forever; no durable empty state — Medium (UX/data expectation)
- **file:line** `src/lib/store.ts:400-412` (`seedIfEmpty`), `src/lib/store.ts:421-424` (`onRehydrateStorage` → seed), `src/lib/store.ts:324-328` (`remove` → `projects: []`, `activeId: null`), `src/components/console.tsx:434-437` (`archiveAndHome`), plus the backstop effect `console.tsx:151-158` (seeds 80 ms after mount if still empty).
- **verified** Fresh visit with empty localStorage → rehydrate → `seedIfEmpty` creates the "Northwind Dispatch" demo project (persisted). Archive that last project → `projects: []` **in-session** shows the honest "No builds yet" empty state (console.tsx:237-240) — but any reload re-seeds Northwind. The empty state is therefore transient and "Archive this build permanently" is impossible for the final project. Intentional per `store.test.ts:41-42` (tests wait for the demo seed), but product-wise the user is never told the demo is a demo and cannot delete it permanently.
- **proposed fix** Seed once per storage, never after an explicit removal:
```ts
// partialize: add `demoSeeded: boolean`
onRehydrateStorage: () => (state) => {
  state?.setHydrated(true);
  if (!state?.demoSeeded) state?.seedIfEmpty(); // seedIfEmpty sets demoSeeded: true
  // … and seedIfEmpty() early-returns when projects.length === 0 && demoSeeded
},
```
Optionally mark the demo row `name: "Northwind Dispatch (demo)"` so it is recognizable and deletable for good.

### ST-4 — `clone()` copies the full decision ledger + rejection history onto a fresh identity — Low (data semantics, future gate-stats pollution)
- **file:line** `src/lib/store.ts:329-357` (structuredClone of the whole project, fresh id only), `src/lib/types.ts:98-119` (decisions/rejectionHistory are project-less, actor rows).
- **verified** The clone keeps every `HitlDecision` and `PhaseRecord.rejectionHistory` row. Those rows carry no project id, so the clone's GATE LOG (console.tsx:920-946) and packet ledger (packet.ts:47-54) present approvals/rejections the clone never experienced. Deliberate per B-08 "clone = snapshot", but note: if/when `approvalHealth` (gate-stats.ts) is wired to aggregate human decisions across projects (see LLM-GAP-7), every clone double-counts its source's human approvals into the rubber-stamp signal.
- **proposed fix (optional trim)** Keep snapshot semantics for artifacts/memory but reset the decision journal + rejectionHistory on clone, adding a `project.cloned` decision row with `decidedBy: "autopilot"`-style provenance or a log-only note. If snapshot semantics are required, at least keep the source `id` in a `clonedFrom` field so the ledger can be attributed later.

### ST-5 — `select()` accepts any id with no existence check — Low (robustness)
- **file:line** `src/lib/store.ts:206` (`select: (id) => set({ activeId: id })`); `remove` nulls `activeId` (store.ts:327) but nothing else validates.
- **verified** All current callers pass real ids (`console.tsx:247`, `355`), so unreachable today; persisted `activeId` pointing at a deleted project would leave `RunScreen` in its fallback state with no way to highlight anything on Home.
- **proposed fix**
```ts
select: (id) => set((s) => ({ activeId: id !== null && byId(s.projects, id) ? id : null })),
```

---

## 2. Console / React-correctness / UX defects

### UI-1 — RunScreen local UI state leaks across project switches (clone nav keeps stale note/error/tab) — Medium (React correctness)
- **file:line** `src/routes/run.$id.tsx:13` (`<RunScreen id={id} />`, no `key`), `src/components/console.tsx:290-301` (12 `useState`s), `console.tsx:611-614` (clone → `nav` to `/run/$newid`).
- **verified** Home→run is a route change (fresh mount), but **clone** and any future same-route param navigation reuse the mounted `RunScreen` (TanStack Router does not remount on param change). No effect resets state when `id` changes. Consequence: a rejection note draft typed for project A is still in the HITL textarea of cloned project B — clicking **Reject** would submit A's stale note as B's steering feedback (it clears only after a reject, console.tsx:359). Stale `error` (`role="alert"`), active tab, artifact selection, and `viewPhase` also carry over.
- **proposed fix** Force a fresh instance per project id in the route:
```tsx
// run.$id.tsx
function RunPage() {
  const { id } = Route.useParams();
  return <RunScreen key={id} id={id} />; // remount per project → local state reset
}
```
(Alternative: `useEffect(() => { setNote(""); setError(null); setTab("artifacts"); … }, [id])` — but `key` is simpler and also resets transient `copied` timers.)

### UI-2 — Successful Import neither navigates to the imported project nor confirms; screen shows a different project than `activeId` — Medium (UX/data-flow)
- **file:line** `src/components/console.tsx:415-427` (`onImportFile`), `src/lib/store.ts:382-399` (`importProject` sets `activeId` to the imported project).
- **verified** `onImportFile` only sets `error` on failure; on success it does nothing — no navigation, no message. Because `RunScreen` derives its project from the **URL** id (console.tsx:289) while the store's `activeId` is switched to the imported project (store.ts:395), a new-id import leaves the console showing the old project and the store/Home disagreeing about what is active. Same-id replacement silently swaps the content under the user (no diff/confirmation) — destructive without consent for a "backup restore" flow.
- **proposed fix**
```ts
// store.importProject returns id (already does). onImportFile:
const res = importProject(json);
if (res.ok) {
  setError(null);
  void nav({ to: "/run/$id", params: { id: res.id } }); // after import; archive later
} else setError(res.error);
```
Add a confirm step when the imported id already exists (`window.confirm` or a small dialog: "Replace the existing build with this file?"), and surface the imported name/id via a transient success message (the `copied`-style flash pattern already used at console.tsx:373-374).

### UI-3 — Notes textarea: per-keystroke `setNotes` on a whole-store subscription re-renders the entire console — Medium (performance/jank)
- **file:line** `src/components/console.tsx:897-899` (textarea → `setNotes(project.id, e.target.value)` each keystroke), `console.tsx:288` (`useRapid()` whole-store), `src/lib/store.ts:365-368` (`setNotes` maps all projects).
- **verified** `RunScreen` subscribes without a selector (`= useRapid()`), so **any** store write re-renders it; `setNotes` fires per keystroke; the render includes the packet `<pre>` (console.tsx:832), artifact bodies (1195-1197), lattice chip loops, etc. Long notes on a large project will visibly lag. (Old audit BUG-02 same root; still present.)
- **proposed fix (recommended)** Local draft + commit on blur, matching the rename pattern (console.tsx:448-464):
```tsx
const [notesDraft, setNotesDraft] = useState<string | null>(null); // null = synced
<textarea
  value={notesDraft ?? project.notes}
  onChange={(e) => setNotesDraft(e.target.value)}
  onBlur={() => { if (notesDraft !== null) { setNotes(project.id, notesDraft); setNotesDraft(null); } }}
  …
/>
```
Also convert the two store subscriptions to slices (`useRapid((s) => s.projects)`, `useRapid((s) => s.autopilot)`, …) so keystrokes elsewhere don't re-render the rail/tabs.

### UI-4 — Double-click "Execute" runs the phase twice (no busy latch); the `running` affordance is unobservable by design — Medium
- **file:line** `src/components/console.tsx:343-347` (`run()`: no latch), `:564-581` (buttons disabled only `while running`), `:582-590` ("running…" indicator), `:511` (`aria-busy={running || undefined}`), `src/lib/store.ts:207-216` (execute is synchronous).
- **verified** The engine runs synchronously inside the click handler, so `rec.status === "running"` never survives to a render: the spinner and `aria-busy` can never be observed, and the `disabled={running}` guard never engages. Two rapid clicks both read updated store state and each advances one phase — a double-click can silently execute P0 **and** P1 in one gesture. (HomeScreen's `launch()` correctly uses a `busy` latch — console.tsx:149/162-164 — RunScreen does not.)
- **proposed fix** Synchronous busy latch per action + disable until state settles:
```tsx
const [busyAction, setBusyAction] = useState<null | "step" | "run" | "approve" | "reject">(null);
function run() {
  if (busyAction) return;
  setError(null); setBusyAction("step");
  // execute() is sync today; for async engine (LLM-GAP-1) await it
  const res = execute(projectId);
  if (!res.ok) setError(res.error);
  setBusyAction(null);
}
// disabled={running || busyAction !== null} on all four action buttons
```
When the engine goes async (LLM-GAP-1) this latch becomes the real in-flight gate.

### UI-5 — Approve leaves stale rejection-note text in the HITL textarea for the next gate — Low
- **file:line** `src/components/console.tsx:349-353` (`onApprove`: no note clear) vs `:355-360` (`onReject`: clears note on success).
- **verified** Reject clears the note (line 359); approve does not. In a P4→P5 (or P6-override→P8) approval chain the textarea keeps the old draft, and the store's 12-char guard means a stray old draft enables Reject without the user noticing it will be sent as feedback.
- **proposed fix** `else setNote("");` on approve success, and clear `forceOverride` (HitlDock remounts per gate today, but clear anyway for safety).

### UI-6 — Import/Export/Clone affordances ignore current-phase/view state and error text persists across actions — Low
- **file:line** `console.tsx:619-651` (Export/Import/Clone/Archive always enabled), `:691-695` (error `<p role="alert">` cleared only at the start of run/approve/reject/runUntil/copyHandoff — console.tsx:344/350/356/363/382).
- **verified** After a failed approve ("Failing sandbox output requires explicit override…") the user can click "Copy agent packet" (which never clears `error`) and the stale red alert still claims a failure — misleading. All "copy/export" actions should clear the error banner first.
- **proposed fix** Call `setError(null)` at the top of `copyPacket`/`copyHandoff`/`downloadJson`/`downloadPacket`/clone/import handlers (one-line each).

### UI-7 — Double-click Copy packet/handoff: overlapping 1.6 s timers flip `copied` back early; timers never cleaned up on unmount — Low
- **file:line** `console.tsx:368-391` (`window.setTimeout(() => setCopied(false), 1600)` without cleanup or guard).
- **verified** Two quick copies: the first timer fires after the second's `setCopied(true)`, hiding "Copied packet" 1.6 s after the *first* click. Timers also fire after unmount (harmless today, setState-on-unmounted is a no-op warning in React 18+ only in dev — still untidy).
- **proposed fix** Track the timer id and clear on re-click/unmount, or stamp a monotonic click id and only clear when the latest id's timer fires:
```tsx
const copyTs = useRef(0);
async function copyPacket() {
  const my = ++copyTs.current;
  …
  window.setTimeout(() => { if (copyTs.current === my) setCopied(false); }, 1600);
}
```

### UI-8 — Oracle tab has no empty state; the contracts footer is a `<li>` inside the oracle `<ul>` — Low
- **file:line** `console.tsx:873-889` (oracle `ul` renders nothing when `project.oracle` is empty; the contracts row is appended as a bare `<li>` at 882-887).
- **verified** Oracle is normally primed at creation (`attachAlgorithms`, engine.ts:719), but an imported/legacy project with `oracle: []` (hydrate keeps `[]`, engine.ts:1090) shows a blank panel — no "no oracle cases" message, unlike the Spec-graph tab which has one (console.tsx:852-854). The contracts row also gets oracle-list list semantics (`listitem` role) which is wrong for a summary footer.
- **proposed fix** Add `{(project.oracle ?? []).length === 0 && (<li className="text-sm text-muted">No oracle cases — run a phase to synthesize acceptance cases.</li>)}` and move the contracts row outside the `<ul>` into a following `<p>`.

### UI-9 — `Running`-state & read-only record view gaps around phase rails — Low (see also LLM-GAP-1)
- **file:line** `console.tsx:513-520` (record view only for `viewPhase !== currentPhase`), `console.tsx:963-1007` (PhaseRail).
- **verified** You cannot open the *current* phase as a read-only record while it is live (clicking the current rail button toggles `viewPhase` to it, but the branch at 513 then shows the live view again — the toggle can never "select" the live phase, so `aria-pressed` (line 987) is only ever meaningful for past phases). Minor, but the rail button's toggle affordance promises a state it cannot reach for the live phase.
- **proposed fix** Either allow record view of the live phase (read-only snapshot) or drop the toggle affordance for the current rail item (`aria-pressed` only when the phase is viewable as a record).

---

## 3. Accessibility defects

### A11Y-1 — Operator-notes textarea has no programmatic label — Medium
- **file:line** `console.tsx:895-903` (h2 "Notes" + textarea with `placeholder` only, no `id`/`aria-label`/`htmlFor` pairing).
- **verified** The visible heading is not associated with the control, so the accessible name comes from the placeholder ("Operator notes for the crew…") — placeholder-as-label is unreliable across AT and disappears when the user types. Compare the correctly-paired HITL note (`htmlFor="hitl-note"`, console.tsx:1110-1116) and the brief textarea (`htmlFor="brief"`, console.tsx:194-200).
- **proposed fix**
```tsx
<h2 …><label htmlFor="notes">Notes</label></h2>
<textarea id="notes" aria-label="Operator notes for the crew" … />
```

### A11Y-2 — No focus management after dismissive/phase-changing actions — Low/Medium
- **file:line** `console.tsx:434-437` + `658-689` (Archive dialog → unmounts screen), `:1133-1152` (Reject → dock unmounts, phase becomes blocked), `:691-695` (error banner never receives focus).
- **verified** After Reject, the whole HITL dock (including the focused button) unmounts and focus drops to `<body>`; keyboard users must tab from the top of the document. Same after Archive. Errors appear in a `role="alert"` that is announced only if it exists *when* the live region updates — moving focus to it (or the phase heading) is the reliable pattern.
- **proposed fix** After `onReject`/`onApprove`/`run`, move focus to the phase `<h1>` (console.tsx:527) or the error paragraph via a ref; after `archiveAndHome` the router focuses the new route's first heading by convention (add `tabIndex={-1}` to the Home `<h1>`).

### A11Y-3 — Artifact list active row not exposed (`aria-current`), artifact pane buttons lack states — Low
- **file:line** `console.tsx:1180-1191` (list buttons style `active?.id === a.id` with classes only), `console.tsx:1157-1200`.
- **verified** Visual active state has no ARIA equivalent (`aria-current="true"` or `aria-pressed`); the phase rail already models this correctly with `aria-pressed` (console.tsx:987).
- **proposed fix** `aria-current={active?.id === a.id ? "true" : undefined}` on the artifact buttons; give the `<ul>` an `aria-label="Artifacts for P{phase}"`.

---

## 4. DoD / gate-stats data & math notes

### DM-1 — P12 DoD probe only accepts YAML-form `openapi: 3.1.0`; JSON OpenAPI (or JSON-string content) can never pass — Low
- **file:line** `src/lib/dod.ts:176-187` (p12-openapi probe: `p.openapi.includes("openapi: 3.1.0")`).
- **verified** The engine's P12 synthesis emits YAML, so the shipped path passes its own gate; but `Project.openapi` is a free string that io.ts imports verbatim (no normalization, io.ts:47-90). A hand-authored/imported JSON OpenAPI document (`{"openapi": "3.1.0", …}` or `"openapi": "3.1.0"` inside a JSON string) makes the criterion permanently unmet even though the spec *does* declare 3.1.0 — the handoff then tells the agent "P12 FAIL" forever (handoff.ts:66 re-runs `runGate` live).
- **proposed fix** Loosen the deterministic probe:
```ts
probe: (p) =>
  typeof p.openapi === "string" &&
  (p.openapi.includes("openapi: 3.1.0") || p.openapi.includes('"openapi":"3.1.0"') || p.openapi.includes('"openapi": "3.1.0"')),
```

### DM-2 — DoD gate verdicts (`PhaseRecord.gate`) are recorded but never rendered; `approvalHealth` (gate-stats) has zero UI consumers — Medium (feature/visibility gap)
- **file:line** Recorded at `src/lib/store.ts:63-104`; no reads of `rec.gate`/`gate.passed`/`evidenceHash` anywhere in `console.tsx` (grep-verified; the 13 "gate" string hits are labels like "Gate log"/"Gate decisions"/artifact kind). `approvalHealth` defined `gate-stats.ts:38-74`; grep shows **no importer outside its own file and test**.
- **verified** After a phase completes, the machine-checkable verdict (PASS/FAIL, unmet criteria, FNV evidence hash) exists in state and in the `gate` artifact body, but the phase rail, record view and GATE LOG show only decisions — the rubber-stamp whisper (the entire point of gate-stats.ts, per its header "watches the … journal … a gate that resolves too fast … is a rubber stamp") is never surfaced to the operator.
- **proposed fix** Render per-phase verdict chips from `rec.gate` in `PhaseRecordView` (console.tsx:1203) and the live header: `PASS/FAIL · n unmet · hash 8` with `title={evidenceHash}`; and mount a small `GateHealthCard` in the right rail (or GATE LOG header) computing `approvalHealth(project.decisions)` — color/n labeling for `rubber`/`fast`/`ok`. Both are pure reads; patch sketch:
```tsx
// PhaseRecordView gate trail — after the decisions <ul>
{rec.gate ? (
  <p className="mt-3 font-mono text-[11px]">
    DoD {rec.gate.passed ? <span className="text-ok">PASS</span> : <span className="text-danger">FAIL</span>}
    {rec.gate.unmet.length ? ` · unmet: ${rec.gate.unmet.join("; ")}` : ""}
    <span className="text-faint"> · {rec.gate.evidenceHash}</span>
  </p>
) : null}
```

### DM-3 — Imported projects never re-derive recorded gate verdicts (rec.gate stays null) even though verdicts are recomputable — Low
- **file:line** `src/lib/io.ts:47-90` (import → `hydrateProject`), `src/lib/engine.ts:1069-1118` (`hydrateProject` fills fields but never calls `recordGate`-equivalent; early return at 1116 keeps stored `rec.gate` as-is).
- **verified** Export→Import round-trips a project whose completed phases carry `gate` records (they serialize with the JSON), so normal round-trips are fine; but a JSON produced by an older version, or hand-edited, with completed phases and no `rec.gate`, will never gain verdicts — while `handoff.ts:28` and the packet System JSON (packet.ts:59) both report `null`. Since `runGate` is deterministic over content, verdicts could be re-derived on import.
- **proposed fix** In `hydrateProject`, after the phase-repair pass, backfill `rec.gate` for every `status === "complete"` record where `rec.gate == null` by running `runGate(filled, id)` (guard with try/catch; append one `gate.verdict` log when backfilled so the repair stays loud, mirroring the `hydrate.repaired` pattern at engine.ts:1103-1115).

---

## 5. Shell / routes / error components

### SH-1 — Home list card click has no keyboard-visible affordance gap; and "No builds yet" flashes during rehydration — Low
- **file:line** `console.tsx:242-260` (project buttons: full-row button — keyboard fine), `console.tsx:237-240` (empty state), `console.tsx:151-158` (80 ms seed backstop).
- **verified** Minor only: because seeding happens post-rehydrate (async storage) and again at 80 ms, a fresh session can briefly paint "No builds yet. Paste a brief…" before the demo/builds appear (ST-3). Not a correctness bug; flagging for the empty-state design: prefer an explicit `hydrated`-gated skeleton (`{!hydrated ? <p className="…">Loading…</p> : …}`). `HomeScreen` reads `hydrated` nowhere today despite the store tracking it (store.ts:33).

### SH-2 — Error component theming is hardcoded `zinc` while the app theme is `bg-bg/text-fg` tokens — Low (cosmetic consistency)
- **file:line** `src/lib/error-component.tsx:28-57, 65-81` (zinc-950/zinc-400/zinc-100 classes) vs `src/routes/__root.tsx:43` (`bg-bg font-sans text-fg`) and console screens (`bg-bg`, styles.css tokens).
- **verified** If a route throws, the error screen paints zinc (light-ish card in a dark-zinc page: `bg-zinc-950` with `text-zinc-50` — actually dark, so not a contrast bug) but breaks the brand tokens and, more importantly, does not include the app shell header — a hard jump from the app's look. Functionally correct (message truncation at 500 chars, Reload + home escape hatches).
- **proposed fix** Swap the class names to app tokens (`bg-bg text-fg`, `text-danger` for the icon) so error/not-found pages match the shell; optionally render inside a minimal header. Keep the 500-char truncation — that is good.

### SH-3 — Router/bridge: `PreviewHostBridge` reports `/run/$id` as a navigable route to the host — Low (platform)
- **file:line** `src/components/preview-host-bridge.tsx:16-23` → `collectRoutePathsFromTree` (lib/preview-host-bridge.ts, exercised by its test).
- **verified** The host address-bar/autosuggest receives raw patterns including `/run/$id`; navigating the host to that literal pattern yields the run page with `id === "$id"`, which renders the "This build doesn't exist or was archived" fallback (console.tsx:326-335). Old audit BUG-12, still present. Low because the embedded preview is a dev convenience, but the fallback message ("archived") is actively misleading for this case.
- **proposed fix** Either filter `$`-parameterized patterns from `collectRoutePathsFromTree`, or make the run page fallback distinguish "bad/missing id" from "archived" by checking whether the id *looks like* a route param (`/^\$|^[a-f0-9-]{36}$/` heuristic) and showing a neutral message.

---

## 6. Previously reported and now verified FIXED (current code)

| Old audit item | Status in current code |
|---|---|
| Archive destructive w/o confirm (BUG-01) | **Fixed** — Radix AlertDialog confirm + navigates home (console.tsx:658-689, 434-437) |
| Clipboard failure hijacked tab (BUG-08) | **Fixed** — error message only (console.tsx:375-378) |
| Filter/selection hidden-artifact (BUG-05) | **Fixed** — `setSelected(null)` on filter change (console.tsx:794-807) |
| Reject guard only in disabled attr (BUG-17) | **Fixed** — store enforces 12-char note (store.ts:306) |
| Escape in rename (BUG-28) | **Fixed** (console.tsx:454-461) |
| Running/ready glyphs indistinguishable (BUG-18) | **Fixed** — `PHASE_STATUS_META` distinct glyphs+tone+sr-only label (console.tsx:29-63) |
| Token estimate recomputed per render (BUG-06) | **Fixed** — memoized on `project?.packet` (console.tsx:324) |

---

## 7. LLM / chat / agent-integration UI gaps (required for real chat-on-screen + live agents)

Grounded in: `src/lib/ai.ts` (provider stub, **zero importers** — grep-verified), `.env.example` (server-only `DEEPSEEK_API_KEY`, "NEVER prefix any secret with VITE_"), `AGENT_GUIDE.md` §4 ("paste … back into the phase's Notes", "Import the resulting report JSON **if the app offers it**" — the app does not), and the synchronous engine/store.

### LLM-GAP-1 — Engine/store are synchronous; no in-flight state, progress, or cancel exists to hang a live agent on
- **file:line** `src/lib/store.ts:207-269` (`execute`/`runUntilHitl` sync), `console.tsx:343-366` (fire-and-forget clicks), `console.tsx:511/582-590` (unobservable `running`).
- **what's missing** `activity` slice (`{status: idle|running, projectId, phase, startedAt, stage?}`), async action variants (`executeLive`, `runUntilHitlLive`) returning promises, cancel semantics, and a render path that can *actually* show the spinner/`aria-busy`. The deterministic runner stays as a "simulate" mode; the engine boundary needs an adapter interface so a live-agent provider can be swapped in without rewriting store actions:
```ts
type PhaseExecutor = (ctx: { project: Project; phase: PhaseId; signal: AbortSignal; onEvent: (e: EngineEvent) => void }) => Promise<PhaseOutcome>;
// store: activity.phase-streaming + lastEngineEvent → console renders a live transcript pane
```
### LLM-GAP-2 — No settings surface for provider base URL / model / API key (build-time `VITE_*` only)
- **file:line** `src/lib/ai.ts:20-33, 58-71` (env-only wiring, `isAiConfigured`/`aiWiringState` unused), `.env.example` (secrets are server-side only).
- **what's missing** a Settings dialog (gear in the header, console.tsx:478-500) with: base URL + model (safe to persist in a `settings` localStorage slice via the existing persist store), and an API key field that is **never written to localStorage** (kept in memory, or sent to a server fn). Because `.env.example` and repo convention put keys server-side, the honest design is a TanStack Start `createServerFn` proxy (`POST /api/llm/chat`) that reads `process.env.DEEPSEEK_API_KEY`; `ai.ts:complete()` becomes the shared client contract calling that fn (its header comment already says exactly this). The header chip should show wiring state from `aiWiringState()` + a "deterministic mode" badge when not configured, instead of the current static label (below).
### LLM-GAP-3 — `modelRoute` is a frozen cosmetic label, not a route — the chip silently over-claims
- **file:line** `src/lib/engine.ts:992` (`modelRoute: "local-edge"` — the *only* assignment in src, grep-verified), rendered at `console.tsx:480` and packet.ts:35 (`model_route`).
- **what's missing** `modelRoute` is a union type (`grok-4.5 | local-edge | failover`, types.ts:13) but nothing ever sets anything but `local-edge`, so the UI chip reads "local-edge" even though no local model runs (the deterministic engine does). Before/while wiring real LLMs, either (a) rename the displayed value to "deterministic engine" / "simulated" (honesty, matches AGENT_GUIDE §5), or (b) actually drive it from `aiWiringState()` + real provider responses and record per-phase `modelRoute` in the trace/log so the packet's `model_route` means something.
### LLM-GAP-4 — Chat-on-screen: no transcript surface for agent/human exchange
- **what's missing** A chat pane (new right-rail section or tab, e.g. next to "Agent packet") with a persisted per-project thread slice in the store (`thread: {role, ts, text, phase, kind: user|agent|tool|system}[]`), rendered with the packet/handoff as grounding context. Reusable primitives already exist: `phaseHandoff(project, phase)` (handoff.ts:24), `evidenceForGate` (console.tsx:70-120), `compileAgentPacket` (packet.ts:68). Minimum flow: user prompt → context = packet + phase handoff + evidence + last N thread rows → `complete()` → append agent row → optional "apply as note/artifact" action. Streaming (SSE from the proxy) should append tokens into the last agent row. No such state exists in `types.ts`/`store.ts` today.
### LLM-GAP-5 — Agent-report intake: AGENT_GUIDE promises a report round-trip the UI cannot perform
- **file:line** AGENT_GUIDE.md §2.4/§4 ("Import the resulting report JSON if the app offers it"); today only freeform notes (console.tsx:897) and whole-project JSON import (io.ts:47-90).
- **what's missing** A structured `AgentReport` schema (phase worked, files, patch, tests-run, risks, artifacts/ADR/OpenAPI deltas, self-assessed DoD criteria), a validating parser in io.ts (mirroring `importProject`'s fail-fast shape checks), a store action `ingestReport(json)` that writes artifacts/memory/notes, re-runs `runGate` for the reported phase, and appends a `report.intake` log + decision-journal-style row, and a console affordance (e.g. "Paste agent report" in the action cluster console.tsx:535-652 or Import dropdown) with a success view that navigates to the affected phase record. This is the honest loop the guide describes and the single highest-value integration.
### LLM-GAP-6 — Gate-health & DoD verdicts invisible to the operator and to any future agent loop (see DM-2)
- Same proposal as DM-2: render `rec.gate` verdicts and the `approvalHealth` flag in the GATE LOG rail. With live agents, these become the steering signal (a `rubber` flag should route future gates to human attention); with autopilot rows already excluded (gate-stats.ts:44-53) the signal stays human-only.
### LLM-GAP-7 — No budget/usage meter for chat; token estimation exists but is packet-only
- **file:line** `estimateTokens` (algorithms.ts:683-702, gpt-tokenizer-backed, cached) used only for the packet chip (console.tsx:324/490); crew `budgetTokens` rendered (console.tsx:863) but never enforced anywhere.
- **what's missing** A running usage meter in the chat pane (prompt+completion tokens per turn, cumulative per project, vs crew budgetTokens) and a hard cap wired to `complete()`'s `maxTokens` (ai.ts:87). Cheap: reuse `estimateTokens` on each thread row.

### Fix ordering (if executed)
1. ST-1 (packet freshness after gate) — 3 lines, restores trust in the flagship output.
2. UI-1 (`key={id}`) — 1 line, prevents stale steering data across clone.
3. UI-2 (import navigate + replace confirm) — data-loss-adjacent UX.
4. UI-4 (busy latch) — prerequisite for LLM-GAP-1 async engine.
5. ST-3 (seed-once) + A11Y-1 (notes label) + UI-3 (notes local draft).
6. DM-2/LLM-GAP-6 (surface verdicts + gate health) — pure renders.
7. LLM-GAP-2 → LLM-GAP-4/5 in order (settings → chat → report intake), keeping the deterministic mode as the default and the honesty contract (ai.ts header) intact.
