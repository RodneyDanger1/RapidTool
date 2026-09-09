# RapidTool — Audit 02: UI/Console + Preview Bridge + Multiplayer (P2P) Layer

**Audit scope:** `src/components/console.tsx`, `src/components/preview-host-bridge.tsx`, `src/lib/preview-host-bridge.ts`, `src/lib/preview-embedder-origin.ts`, `src/lib/multiplayer/index.ts`, `src/lib/multiplayer/p2p.ts`, `src/styles.css`, `screenshots/app-builder-built.json`, `screenshots/app-builder-preview.json`.
**Cross-referenced (read-only):** `AGENTS.md` (platform contract), `attachments/RapidTool_Complete_Master.md` (vision), `package.json`, route mounts (`src/routes/*.tsx` via grep), `server/` layout, `.grok/skills/multiplayer-p2p/SKILL.md`, screenshots dir + two `.png` files (visual check).
**Out of scope (owned by sibling audits):** `src/lib/{auth,app-data}`, `engine.ts`, `algorithms.ts`, `phases.ts`, `store.ts`, `types.ts`, `templates.ts`, `db.ts`, `sandbox.ts`, `packet.ts`, `scripts/`, `server/middleware/`, migrations.
**Date:** 2026-09-04. **App not run** (per instructions); all findings are static, line-referenced readings. Every line of every scoped file was read.

**Line counts:** console.tsx 801, preview-host-bridge.tsx 26, preview-host-bridge.ts 283, preview-embedder-origin.ts 56, multiplayer/index.ts 9, p2p.ts 570, styles.css 59, two screenshot JSONs 37+35. **Total: 1,876 lines.**

---

## 0. Executive summary

RapidTool's console is a compact, well-crafted **local-first, single-user orchestration UI** for a deterministic 13-phase "software factory" graph (Phase 0 … Phase 12). It is two screens: an intake/home (`HomeScreen`) and a per-project run console (`RunScreen`), routed via TanStack Router (`/` and `/run/$id`). The UI is almost purely a *view and action layer over the zustand store* (`useRapid`); the deepest UI logic is a handful of derived views (scorecard, spec graph order, crew roster, oracle list, memory/diagnostics rails).

Headline findings:

1. **The entire Multiplayer/P2P subsystem is dead weight for RapidTool.** `p2p.ts` is a generic, well-engineered WebRTC full-mesh room client that ships with the platform ("App Builder workspace") kit, but **nothing in the app imports `@/lib/multiplayer`**, **no `/api/rtc` route or `signaling.server.ts` exists anywhere in the repo**, and the console has zero peer awareness. It is template residue, kept alive only by the "kit" convention. (Sections 4, 7.)
2. **The Preview Host Bridge is correctly implemented, correctly mounted, and inert outside the Grok preview frame** — origin-allowlisted `postMessage` with zod-validated envelopes, history-root flooring, and a clean dispose path. A handful of edge bugs (stale location report race, param-route paths leaked to host autosuggest). (Section 3.)
3. **Console UX quality is high but has structural gaps:** no way to revisit a completed phase from the rail (rail is display-only), no per-phase artifact filtering, no run-progress/cancel affordance, Execute buttons remain active while a phase is `running`, Archive is one click with no confirm/undo, whole-store subscription makes every keystroke re-render the entire 801-line tree, and the five tab buttons have no tab semantics. (Sections 1, 6, 8, 9.)
4. **Zero TODOs/FIXMEs** in audited files; error paths are handled quietly (UI `error` string + `console.warn` in p2p only). (Section 7.)
5. Styling is Tailwind v4 with a coherent dark design-token theme; one unused token (`--color-accent-fg`); low-contrast `faint` text and color-only status dots are the main a11y risks. (Sections 5, 9.)

Severity legend used in the Bugs register (Section 6): **P0** = ships broken / data loss / must fix now; **P1** = feature broken in a supported path; **P2** = significant defect or risk, workaround exists; **P3** = polish / minor / latent.

---

## 1. Console walkdown (`src/components/console.tsx`, 801 lines)

### 1.0 Module surface & imports

| Import | Source | Used for |
|---|---|---|
| `useEffect, useMemo, useState` | react (L1) | hydration seed, active-artifact memo, all local UI state |
| `Link, useNavigate` | `@tanstack/react-router` (L2) | Home ↔ Run navigation |
| 11 lucide icons | `lucide-react` (L3–15) | `ArrowRight, Check, ChevronRight, Copy, Download, FastForward, Lock, Play, RotateCcw, Shield, X` (all 11 are used — verified each) |
| `PHASES` | `@/lib/phases` (L16) | ordered 13-phase graph meta (code/title/summary/hitl flag per phase) |
| `useRapid` | `@/lib/store` (L17) | zustand store hook — the entire data + action surface |
| `BRIEF_TEMPLATES` | `@/lib/templates` (L18) | home screen brief chips |
| `estimateTokens` | `@/lib/algorithms` (L19) | header token estimate chip |
| `Artifact, PhaseStatus, Project` (types) | `@/lib/types` (L20) | props/state typing |

**Store integration surface used by the console** (all consumed through `useRapid()`): state `projects`, `autopilot`, `hydrated` (via `getState`); actions `create`, `select`, `execute`, `approve`, `reject`, `retry`, `remove`, `runUntilHitl`, `refreshPacket`, `clone`, `rename`, `setNotes`, `setAutopilot`, `seedIfEmpty`, `setHydrated`. Project fields rendered: `id, name, domain, modelRoute, currentPhase, status, brief, notes, packet, memory[], logs[], lastTest, lattice, scorecard, competitors[], specGraph, crew[], oracle[], contracts, artifacts[], phases`, and `sandbox.{runtime, ramMb}`.

### 1.1 Module-level helpers

- **`statusTone(status)` (L22–29)** — color class map: `complete→text-ok`, `awaiting_hitl→text-warn`, `running→text-accent`, `rejected→text-danger`, `ready→text-fg`, everything else → `text-faint`. Consumed by PhaseRail text (L634). Duplicates the glyph logic in `StatusGlyph` (two separate mappings of the same PhaseStatus enum → drift risk, BUG-19).
- **`Mark()` (L31–39)** — brand glyph: 7×7 raised box containing three vertical bars (accent/fg/muted) mimicking a bar chart/logo; used in both headers.

### 1.2 `HomeScreen()` (L41–164) — intake screen at route `/`

Local state: `brief` string (L44), `busy` (L45).

**Hydration effect (L47–54):** 80 ms after mount, reads `useRapid.getState()`; if `!hydrated` calls `setHydrated(true)`, then always `seedIfEmpty()`. Cleanup clears the timeout. This seeds a demo project ("Northwind Dispatch", per screenshots) for first-run discovery. (Quirk: `setHydrated` fires *before* `seedIfEmpty`, so other subscribers see "hydrated" while seeding is still pending — benign because seeding is synchronous.)

**`launch()` (L56–62):** guards `brief.trim().length < 12`, sets `busy` true, calls `create(brief.trim())`, sets `busy` false, then `nav({to:"/run/$id", params:{id}})` — **note:** `busy` toggles are synchronous around a synchronous store call, so the busy state can never actually be observed as true by the button (dead pattern, BUG-07).

JSX tree:

```
div.min-h-dvh (L65)
├─ header (L66–75): Mark + wordmark "RapidTool"/"autonomous software agency" (L68–73);
│   right: "phases 0–12 · graph locked" mono caption, hidden below sm (L74)
└─ main.grid max-w-6xl 2-col on lg (L77)
   ├─ section (L78–125)
   │  ├─ eyebrow "GOVERNED DELIVERY" (L79)
   │  ├─ h1 hero "Research first. Code second. Ship with a paper trail." (L80–82)
   │  ├─ pitch paragraph naming the four onboard algorithms (L83–88)
   │  ├─ <label htmlFor="brief"> "Client brief" (L90–92) + <textarea id="brief"> 6 rows,
   │  │   placeholder "Describe the system to build …" (L93–100)
   │  ├─ action row (L101–112):
   │  │   ├─ button "Open intake" + ArrowRight (L102–110), disabled when brief <12 chars or busy
   │  │   └─ hint "Phase 0 starts locked to the brief" (L111)
   │  └─ template chips (L113–124): BRIEF_TEMPLATES.map → buttons that setBrief(t.brief)
   │       (observed labels in screenshots: Field dispatch / Shop quoting / Clinicos / Marketplace)
   └─ aside "Builds" card (L127–160)
      ├─ h2 "Builds" + mono count chip {projects.length} (L129–131)
      └─ ul: empty state "No builds yet. Paste a brief to open Phase 0." (L133–136)
          else per-project button rows (L138–157): select(p.id) + nav /run/$id;
          row shows name + "domain · P{currentPhase} · status" mono line (L149–153), ChevronRight (L154)
```

User-visible behavior: typing a brief ≥12 chars enables "Open intake"; clicking creates a project in the store (persisted) and navigates to its run console. Chips fill the brief for one extra click — they never launch directly. The Builds list resumes any prior project.

### 1.3 `RunScreen({ id })` (L166–616) — per-project console at route `/run/$id`

Store destructure (L168–182): `projects, execute, approve, reject, retry, remove, runUntilHitl, refreshPacket, clone, rename, setNotes, autopilot, setAutopilot`. Project lookup `projects.find(p => p.id === id)` (L183). Local state: `note` (HITL rejection note), `error` (inline error string), `selected` (artifact id), `copied` (packet-copy flash), `tab` (union `"artifacts" | "packet" | "spec" | "crew" | "tests"`, default `"artifacts"`), `query` (artifact filter), `editingName` (L184–190).

Derived: `rec = project.phases[project.currentPhase]` (L192), `artifacts` (L193), `activeArt` memo (L194–198): if `selected` set → find it, falling back to `artifacts.at(-1)` (newest); else newest. (Filter/selection inconsistency → BUG-05.)

**Missing-project fallback (L200–209):** centered "That build is not on this station." + `Link` "Back to intake". (Copy smells like a leftover from a shared/multi-station era — the only "multiplayer-ish" string in the console; see Section 7.)

Local action wrappers — each clears `error`, calls the store action, surfaces `{ok:false, error}` into the inline error line:
- `run()` L213–217 → `execute(projectId)`
- `onApprove()` L219–223 → `approve(projectId)`
- `onReject()` L225–230 → `reject(projectId, note)`; clears note on success
- `runUntil()` L232–236 → `runUntilHitl(projectId)`
- `copyPacket()` L238–249 → `refreshPacket(projectId)` then re-reads the **fresh** packet from `useRapid.getState()` (L240) and `navigator.clipboard.writeText`; on success flashes `copied` 1600 ms; on clipboard failure sets error "Clipboard blocked — open the Agent packet tab and select the text." and force-switches `setTab("packet")` (side-effecting fallback, BUG-08).

JSX tree:

```
div.flex.min-h-dvh (L252)
├─ header (L253–302)
│  ├─ Link "/" with Mark + "RapidTool" (L255–258), "/" divider, then inline name editor:
│  │   editing ? <input aria-label="Build name"> (L261–273, commit onBlur via rename(),
│  │   Enter→blur, autoFocus) : <button> showing project.name (L275–282, click → edit mode;
│  │   hidden below sm breakpoint)
│  └─ right meta chip cluster (mono, wraps) (L284–301):
│     ├─ chip {project.domain} (L285)
│     ├─ chip {project.modelRoute} (L286)
│     ├─ chip "{project.sandbox.runtime} · {project.sandbox.ramMb}MB" (L287–289)
│     ├─ chip "~{estimateTokens(project.packet).tokensEst} tok" (L290–292) — recomputed on every render, BUG-06
│     └─ <label> autopilot checkbox "Autopilot · extra gates" (L293–300) → setAutopilot(checked)
├─ div.grid flex-1, 3-col on lg: [240px | minmax(0,1fr) | 300px] (L304)
│  ├─ <PhaseRail project> (L305; defn L618–646)
│  ├─ section center, min-w-0, right border on lg (L306–574)
│  │  ├─ Phase header block (L307–435)
│  │  │  ├─ mono line "{code} · {rec.status…}" (L308–310)
│  │  │  ├─ h1 phase title (L311–313) + summary paragraph (L314–316) + brief paragraph (L317)
│  │  │  ├─ ACTION CLUSTER (L319–409), mutually exclusive by project status:
│  │  │  │  ├─ status "blocked" → primary "Retry phase with notes" (RotateCcw) → retry(id) (L320–328)
│  │  │  │  ├─ else project.hitl → non-interactive badge "Human approval required" (Shield) (L329–333)
│  │  │  │  ├─ else status "complete" → badge "Delivery sealed" (Check) (L334–338)
│  │  │  │  └─ else (incl. "running"!) → [primary "Execute {code}" (Play)→run() (L341–348)
│  │  │  │      + secondary "Run to next gate" (FastForward)→runUntil() (L349–356)]
│  │  │  │      ⚠ no branch disables these while rec.status === "running" — double-execute affordance, BUG-04
│  │  │  │  ├─ ghost "Copy agent packet" (Copy, L359–366) — label flips to "Copied packet"
│  │  │  │  ├─ text "Clone" (L367–376) → clone(id), navs to new run
│  │  │  │  ├─ text "Export" (Download, L377–401) → refreshPacket + Blob(packet + "## Operator notes" +
│  │  │  │  │   notes) → anchor download "{slug}-packet.md"; URL.revokeObjectURL called synchronously
│  │  │  │  │   after click (BUG-09)
│  │  │  │  └─ text "Archive" (L402–408) → remove(id), NO confirm/undo, no navigation (BUG-01)
│  │  │  ├─ inline error line text-danger (L410)
│  │  │  ├─ lastTest line "sandbox pass|fail · {detail}" mono, ok/danger (L411–415)
│  │  │  └─ lattice chips (L416–434): jobs.slice(0,6) accent chips "job:{j}", entities.slice(0,5)
│  │  │      muted chips, constraints rendered UNBOUNDED (L428–432) warn chips (BUG-10)
│  │  ├─ "Onboard algorithms" traces block, when project.traces.length (L437–450): 1/2/4-col cards,
│  │  │   each: trace id, name, summary (L441–447)
│  │  ├─ <ScorecardBlock project> when project.scorecard (L452; defn L655–703)
│  │  ├─ <HitlDock …> when project.hitl (L454–462; defn L705–758)
│  │  ├─ TAB BAR (L464–500): five plain <button>s — Artifacts | Agent packet | Spec graph | Crew |
│  │  │   Oracle — selected style = border-b border-fg text-fg vs text-muted; NO role="tab"/
│  │  │   aria-selected/keyboard arrow handling (BUG-15, §9)
│  │  └─ TAB PANELS (L501–573):
│  │     ├─ "packet": <pre> max-h-[480px] scroll, packet text or "Execute a phase to compile the packet."
│  │     ├─ "spec": <ol> of specGraph.order → node cards (position, owner, file, purpose);
│  │     │   empty msg "Lattice empty — open a brief first." (L520–522)
│  │     ├─ "crew": 1/2-col grid of crew member cards: role+active+budgetTokens line, mandate,
│  │     │   handoff, tools join (L524–536)
│  │     ├─ "tests" (labeled Oracle): oracle case list (name/given/expect) + contracts summary line
│  │     │   (entities names + endpoint count) (L537–552)
│  │     └─ default "artifacts": filter <input> placeholder "Filter artifacts", no <label> (L555–562) →
│  │         <ArtifactPane> filtered on title/kind/body lowercase includes (L563–571)
│  └─ aside right rail, bg-surface (L576–612)
│     ├─ "NOTES": h2 + <textarea> bound to project.notes → setNotes(id, …) per keystroke (L577–584)
│     │   — no label association, no debounce (BUG-02)
│     ├─ "MEMORY": last 8 items: mono "{kind} · P{phase} · {score.toFixed(2)}" + text; empty msg
│     │   "Empty until Phase 0 writes a checkpoint." (L586–599)
│     └─ "DIAGNOSTICS": logs.slice(-10).reverse(): mono "{event} {detail}" (L601–611)
```

### 1.4 Subcomponents

- **`PhaseRail({ project })` (L618–646)** — display-only navigation strip. Mobile: horizontal scroll (overflow-x-auto, min-w-[148px] per row); lg: vertical column. Renders **every** phase in `PHASES` with `StatusGlyph` + mono code (with "· HITL" suffix when `p.hitl`) + truncated title; active phase gets `bg-raised`. **Rows are `<div>`s, not buttons** — the rail conveys state but you cannot click a past phase to review it (Section 8).
- **`StatusGlyph({ status })` (L648–653)** — `complete`→Check(text-ok), `locked`→Lock(text-faint), `rejected`→X(text-danger); otherwise a 2×2 dot, accent when `ready|running|awaiting_hitl`, faint otherwise. **`ready`, `running`, `awaiting_hitl` share one color/shape** — indistinguishable at a glance (BUG-18, §9).
- **`ScorecardBlock({ project })` (L655–703)** — renders when `project.scorecard` (Phase-0 deliverable): header "Phase 0 scorecard", `sc.overall / 10` + mono `sc.verdict` (L661–669); 5 axis cards (`a.label, a.score, a.note`) in 1/2/5-col grid (L670–678); competitor table (name / class / gap) with horizontal scroll, only when `competitors.length` (L679–700).
- **`HitlDock` (L705–758)** — props `{project, note, setNote, onApprove, onReject}`. HITL approval panel: mono "{h.stakes}", title, prompt; `<label htmlFor="hitl-note">` "Rejection note (min 12 characters)" + textarea (id matches) + live counter "{n}/12" (L736); Approve (primary, Check, L738–745) and Reject (danger outline, X, **disabled until note ≥ 12 chars**, L746–754). Note: the 12-char gate lives only in the disabled attribute, not in `onReject` (defense-in-depth gap, BUG-17).
- **`ArtifactPane({ artifacts, active, onSelect })` (L760–801)** — empty state (L769–775); else 2-col on md `[200px | minmax(0,1fr)]`: list of artifact buttons (mono "P{phase} · {kind}" over title; active row bg-raised) + `<pre>` of `active.body` (unbounded height — page grows; no copy button).

### 1.5 State/action → store mapping (console → `useRapid`)

| UI affordance | Location | Store action | Visible result |
|---|---|---|---|
| Brief textarea / Open intake | L93–110 | `create(brief)` | New project persisted; nav to `/run/$id` |
| Template chips | L113–124 | — (local setBrief) | Fills textarea |
| Build row click | L140–155 | `select(id)` + nav | Opens run screen for project |
| Name inline edit | L261–273 | `rename(id, name)` | Header name replaced on blur/Enter |
| Autopilot checkbox | L293–300 | `setAutopilot(bool)` | Global store flag; enables "extra gates" in engine runs |
| Execute {code} | L341–348 | `execute(id)` | Runs current phase; errors → inline red line; on completion artifacts/traces/etc. update |
| Run to next gate | L349–356 | `runUntilHitl(id)` | Runs phases until next `awaiting_hitl` gate or completion |
| Retry phase w/ notes | L320–328 | `retry(id)` | Re-opens blocked phase |
| Approve / Reject | L738–754 | `approve(id)` / `reject(id, note)` | Advances phase or returns it with rejection note |
| Copy agent packet | L359–366 | `refreshPacket(id)` + clipboard | "Copied packet" flash |
| Clone | L367–376 | `clone(id)` | New project copy; nav to it |
| Export | L377–401 | `refreshPacket(id)` | Downloads `<name>-packet.md` (packet + operator notes) |
| Archive | L402–408 | `remove(id)` | Project gone; current view falls into "not on this station" fallback |
| Notes textarea | L578–584 | `setNotes(id, text)` per keystroke | Persisted notes; whole tree re-renders (BUG-02) |
| Artifact filter / select | L555–571, L781–793 | local state | Filters list, shows body in pre |

**What the user sees happen while a phase runs:** only the mono status line under the phase title flips to "running" and the rail dot goes accent — there is no spinner, progress, cancellation, or disablement of the action buttons (Sections 6/8).

---

## 2. Component inventory

### 2.1 Components defined in `console.tsx`

| Component | Lines | Props | Purpose |
|---|---|---|---|
| `Mark` | 31–39 | none | Brand glyph (3 bars in raised tile) |
| `HomeScreen` | 41–164 | none | Intake screen: hero, brief editor, templates, Builds list |
| `RunScreen` | 166–616 | `{ id: string }` | Per-project orchestration console (route `/run/$id`) |
| `PhaseRail` | 618–646 | `{ project: Project }` | Display-only 13-phase status rail (mobile: horizontal strip) |
| `StatusGlyph` | 648–653 | `{ status: PhaseStatus }` | Phase status icon/dot |
| `ScorecardBlock` | 655–703 | `{ project: Project }` | Phase-0 feasibility scorecard + competitor table |
| `HitlDock` | 705–758 | `{ project, note, setNote, onApprove, onReject }` | HITL approval/rejection panel with 12-char rejection note |
| `ArtifactPane` | 760–801 | `{ artifacts: Artifact[], active: Artifact\|null, onSelect: (id)=>void }` | Artifact list + body viewer |

### 2.2 Components defined elsewhere but part of this layer

| Component | File:lines | Props | Purpose |
|---|---|---|---|
| `PreviewHostBridge` | `src/components/preview-host-bridge.tsx` 13–26 | none | Mounts the guest-side postMessage bridge; renders null; mounted once in `__root.tsx` L40 |

### 2.3 Route mounts (verified by grep, not full read)

- `src/routes/index.tsx` L2/L7 → `<HomeScreen />`
- `src/routes/run.$id.tsx` L2/L10 → `<RunScreen id={id} />`
- `src/routes/__root.tsx` L3/L40 → `<PreviewHostBridge />` (inside the document shell)

### 2.4 Library/module inventory used by the console UI

react 19.2 (hooks), `@tanstack/react-router` (Link/useNavigate; router v1.170), `lucide-react` 0.510 (11 icons), `@/lib/{phases,store,templates,algorithms,types}` (integration surface per §1.0), zustand 5 (store hook), Tailwind v4 via `src/styles.css`. Radix, TanStack Query/Table/Start, sonner, vaul, recharts, react-hook-form, cmdk etc. are installed (package.json L23–75) but **not referenced by any audited file** — the console is hand-rolled with plain elements.

---

## 3. Preview system (host ↔ guest bridge)

### 3.1 Architecture & mechanism

RapidTool runs **inside the Grok App Builder preview frame**. The preview chrome (host page on grok.com) embeds the app in an iframe; the app is the *guest*. Communication is **`window.postMessage` over the parent frame**, strictly guest→parent and parent→guest:

- `src/components/preview-host-bridge.tsx` (26 lines): React wrapper mounted in `__root.tsx` (L40). Its effect (L16–23) calls `installPreviewHostBridge({ navigate: path => router.history.push(path), getRoutePaths: () => collectRoutePathsFromTree(router.routeTree) })` and returns the dispose fn. `useEffect` deps `[router]`. Renders `null`.
- `src/lib/preview-host-bridge.ts` (283 lines): the guest-side protocol engine. Header contract (L1–6): "Activates only when this page is framed by an allowlisted Grok embedder. Top-level runs … noop."
- `src/lib/preview-embedder-origin.ts` (56 lines): the parent-origin allowlist resolver.

**Channel constants:** `PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge"`, `PREVIEW_BRIDGE_VERSION = 1` (L17–18).

**Envelopes are zod-validated** (L20–38): base `EnvelopeSchema { channel: literal, version: positive int, type: min-1 string }`; `HelloSchema` (type "hello"), `NavigateSchema` (type "navigate", `path: string min 1`), `HistorySchema` (type "history", `delta: -1|1`).

### 3.2 Activation / origin allowlist

`installPreviewHostBridge` (L63–78): noops when `typeof window === "undefined"`; reads `location.ancestorOrigins[0]` when available (L68–71), then `resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname)`; `null` → returns no-op dispose (L78) — **silent noop when top-level or un-allowlisted** (per AGENTS.md rule 3 this is mandatory platform behavior).

`resolveParentEmbedderOrigin` (`preview-embedder-origin.ts` L31–56):
1. `parentIsSelf` → null (L37).
2. For each candidate in `[referrer, ancestorOrigin ?? ""]` (filtered):
   - coerces scheme (`candidate.includes("://") ? candidate : "https://" + candidate`, L40–42), requires http/https (L43),
   - accepts if `isGrokEmbedderOrigin(url.origin)` (L44): `grok.com` / `*.grok.com` / `localhost` / `127.0.0.1` / `[::1]` (L1–12),
   - else accepts if the **guest hostname itself** is a sandbox preview host — `isSandboxPreviewGuestHost`: `grok-sandbox.com`/`*.grok-sandbox.com` (L14–17) — or the guest matches the remint pair shape `isRemintPreviewPair(guest, parent)`: guest `<label>.preview.<rest>` with dot-free label, and parent equals `<rest>` or `grok.<rest>` (L19–29) (covers `*.preview.<domain>` iframe hosts whose parent is the domain or its grok subdomain).

So the security model is: **parent must be grok.com-family, localhost (dev), or a known sandbox/preview guest-parent pair; the guest never messages an unverified parent.**

### 3.3 Message protocol

Guest → host (all posted with `window.parent.postMessage(msg, parentOrigin)` — target-origin locked, L113–115):

| type | payload | when | lines |
|---|---|---|---|
| `location` | `{path, search, hash}` | on every pushState/replaceState (patched), popstate, hashchange, and after host navigate | L117–126, 204–232 |
| `routes` | `{paths: string[]}` | at announce; paths from `collectRoutePathsFromTree` | L128–136 |
| `ready` | — | at announce (initial install and on host re-handshake) | L163–168 |

Host → guest:

| type | payload | handling | lines |
|---|---|---|---|
| `hello` | — | re-announce (`announce()`) — covers host remount / pre-hydration asks | L179–183 |
| `navigate` | `{path}` | `navigate(path)`; then `queueMicrotask(reportLocation)` | L185–192 |
| `history` | `{delta: -1\|1}` | guard: refuse `-1` when at history root (stamped state); else `window.history.go(delta)` | L194–201 |

**Path safety (`isSafeBridgePath`, L47–57):** must start with `/`, must not start with `//`, must not contain `\`, and a `new URL(path, "https://preview.invalid")` must resolve to the same dummy origin (kills scheme-relative and encoded-scheme tricks). `navigate` then re-checks the resolved URL origin against `window.location.origin` before pushing (L138–149) — defense in depth. The router-aware path (L151–158) trusts `options.navigate` (which is `router.history.push`) only after the same path check.

**History-root flooring (L80–111, 194–201):** the guest stamps its own history state with `__grokPreviewBridgeRoot`. On install, if the current entry is untagged it tags `history.length <= 1` as root via `replaceState` (L95–108). `pushState` is patched to stamp `false` (L214–221); `replaceState` is patched to *preserve/restore* the root tag when currently at root (L222–232). Rationale in comment (L91–94): a full document navigation reinstalls the bridge on a deep URL; re-stamping would let host Back no-op while older in-preview history exists. Host Back at root is refused (L197–199) so the user can't navigate *out of the preview*. Both patches `reportLocation()` after applying. Dispose restores the pristine functions (L240–246).

**Dispatcher** (L170–202): requires `event.source === window.parent` **and** `event.origin === parentOrigin`; schema-parses the envelope; version mismatch (≠1) drops the message (future-proofing, L175); type-specific schema re-validation before acting (L179–201).

### 3.4 Failure modes

1. **Not embedded** → install returns noop; host URL bar simply won't track the app (by design; AGENTS.md calls the component "a silent noop everywhere else").
2. **Embedded but origin-unverifiable** — sandboxed iframe without `allow-same-origin` kills `ancestorOrigins`, and a missing/empty `Referer` leaves only the empty candidates → `null` → noop. Degraded but safe. (Referrer-Policy: `no-referrer` would break the bridge.)
3. **Parent sends `version` ≠ 1** → messages dropped silently (no negotiation/downgrade path — L175).
4. **Malformed envelope / wrong channel** → `safeParse` fail → dropped (L174–175).
5. **navigate to a foreign origin / non-path string** → rejected at `isSafeBridgePath` or the origin re-check; nothing happens.
6. **Host Back at guest history root** → refused (L197–199) — preview stays put.
7. **Router navigation timing**: `navigate` pushes through TanStack's `router.history` and reports the location one microtask later (L189–191) — if the router flushes its location asynchronously (loader/lazy route), the report can race ahead and the host address bar lags until the next real navigation (BUG-11).
8. **Double-install risk**: two live installs would double-patch history and double-report; guarded in practice by single mount in `__root.tsx` and React 18/19 effect cleanup (StrictMode mount→cleanup→mount is safe because dispose restores originals before the second install).
9. **Route-path leakage**: `collectRoutePathsFromTree` (L249–283) walks `fullPath`/`path`/`children` and returns **every static pattern including parameterized ones** (e.g. `/run/$id`) — host autosuggest receiving `/run/$id` and navigating there would render the "not on this station" fallback (BUG-12).
10. **Attacker on localhost** (dev-only allowlist, L7): any other local web page can frame the dev server and drive `navigate`/`history` — same-origin navigation only, root floor holds; impact negligible, but it is a permanent dev-mode trust expansion.

**Overall preview verdict:** sound, minimal, spec-compliant with AGENTS.md rule 3; no P0/P1 defects found. Remaining issues are the timing/leakage nits above and the general postMessage hygiene caveat that app-internal listeners elsewhere (none found in audited files) should never trust `event.data` without the same checks.

---

## 4. Multiplayer / P2P (`src/lib/multiplayer/*`)

### 4.0 Reality check: what multiplayer does *for RapidTool*

**Nothing — it is not wired anywhere.** Evidence:

- `src/lib/multiplayer/index.ts` (9 lines) re-exports `P2PRoom`, `defaultIceServers` and types `PeerInfo, P2PRoomOptions, SignalKind, PeerRow, SignalRow, RtcPollResponse`.
- A repo-wide grep for `P2PRoom|multiplayer|/api/rtc|defaultIceServers|PeerInfo` outside `src/lib/multiplayer/` returns **zero matches**. No component imports it; no store action touches it; `console.tsx` has no peer/room/session concept.
- A repo-wide grep for `rtc|RTC` in `src` + `server` matches **only `p2p.ts` itself**: there is **no `src/routes/api/rtc.ts`, no `signaling.server.ts` anywhere** (`server/` contains only `middleware/grok-pwa.ts`), and **no `api/` directory exists under `src/routes/`**. The signaling relay the client hard-depends on is absent.
- The platform kit's own skill (`.grok/skills/multiplayer-p2p/SKILL.md`) says: "A tiny relay at `/api/rtc` handles only … | Signaling relay (you create) `src/lib/multiplayer/signaling.server.ts` | HTTP mount (you create) `src/routes/api/rtc.ts`". p2p.ts's header comment ("signaled through /api/rtc (see signaling.server.ts)", L3–4) documents a file that was never created in this workspace.
- The only "shared session" residue in the console is the fallback copy **"That build is not on this station."** (`console.tsx` L203) — a stranded phrase from a multi-station mental model; everything else is strictly local-single-user.

Conclusion: `p2p.ts` is **platform template residue** (the kit ships it into every workspace), not a RapidTool feature. It is a *latent* capability: a future shared-session console could consume it. The deep dive below therefore audits it as a standalone library, with the standing caveat that its endpoint does not exist.

### 4.1 Transport & topology

Full-mesh **WebRTC**: one `RTCPeerConnection` per remote peer (L2, L248), two `RTCDataChannel`s per pair — `"state"` (unordered, `ordered:false, maxRetransmits:0`, unreliable) and `"reliable"` (ordered) — created by the **dialer** side only (L304–311); the receiver gets them via `ondatachannel` (L302, L315–346). Signaling (SDP/ICE) goes through the app's HTTP relay at `/api/rtc`; **game data never touches the server** (mesh). Comments (L4–10) state client-authoritative by construction, and reference "perfect negotiation": on glare the *polite* peer (lexicographically smaller id) rolls back.

### 4.2 Wire contracts (client ↔ relay)

```ts
PeerRow        { id: string; name: string }                              // p2p.ts L19–22
SignalRow      { id: number; from: string; kind: SignalKind; payload: unknown }  // L23–28
RtcPollResponse{ peers: PeerRow[]; signals: SignalRow[] }                // L29–32
SignalKind     = "offer" | "answer" | "ice"                              // L12
```

Relay HTTP API the client assumes (never implemented in this repo):
- `GET /api/rtc?room=<r>&peer=<selfId>&name=<n>&since=<cursor>` → `RtcPollResponse` (L188–195). `since` = last-seen `SignalRow.id` — cursor-based log replay; the relay must persist signals and hand out monotonic ids. **First poll = join + roster fetch** ("The first poll IS the join", L114–118).
- `POST /api/rtc` `{op:"signal", room, from, to, kind, payload}` (L447–462).
- `POST /api/rtc` `{op:"leave", room, peer}` with `keepalive:true` on close (L141–146).

### 4.3 Peer-to-peer protocol

Data-channel frames are JSON `{ t: "d"|"ping"|"pong", d?: unknown }` (L151, L322–344):
- app data `{t:"d", d}` → delivered to `onMessage(from, data, channel)` where channel is `"state"` or `"reliable"` (L339–344);
- `{t:"ping"}` → replied `{t:"pong"}` **on the state channel only** (L328–331); pong computes RTT when a `pingSentAt` is pending (L332–337).

Public API: `join()` (L119–131: one immediate poll, then schedule + 2 s ping/watchdog interval), `close()` (L133–147), `broadcast(data)` — unreliable state channel to all open peers (L150–155), `send(data, peerId?)` — reliable channel to one/all (L158–164), `peerList()` (L166–168). Options L44–55: `{room, selfId, name?, iceServers?, onPeersChanged?, onMessage?, onConnected?}`.

**Constants** (L77–82): `FAST_POLL_MS=400`, `IDLE_POLL_MS=2000`, `PING_INTERVAL_MS=2000`, `STALL_MS=10000`, `MAX_RECOVERY_ATTEMPTS=3`, `SIGNAL_RETRY_DELAYS_MS=[250,750]`.

**ICE servers:** `defaultIceServers()` (L84–96) reads comma-separated `import.meta.env.VITE_STUN_URLS`, falling back to Google + Cloudflare public STUN. **No TURN is configured** ("none configured by default", L539) — symmetric-NAT peers can never connect, which the recovery machinery then grinds through (§4.5). Note the env var is referenced nowhere else in the repo (grep: only p2p.ts L48/L85).

### 4.4 Session lifecycle & sync algorithm

- **Join:** `join()` → `pollOnce()` (register; roster; signals since cursor=0). Failure of the very first poll is swallowed (L122–124) and the loop retries — "must not strand the room". `onConnected` fires exactly once on first successful poll (L200–203).
- **Poll loop:** `poll()` → try `pollOnce()`, swallow errors, reschedule at 400 ms while any non-terminal pair is not `connected`, else 2000 ms (L172–221). **There is no fetch timeout** (BUG-22).
- **Roster reconciliation** (L223–242): new peers → `connectTo(id, name, initiator = selfId > p.id)` — exactly one side dials per pair, the lexicographically **larger** id dials (L232). Missing peers → `pc.close()` + delete (L235–240). Peer names refresh on every poll (L228–230).
- **Per-pair connect** (`connectTo`, L246–313): creates pc with `iceServers`; `onicecandidate` posts ICE immediately (L268–270); `onconnectionstatechange` updates info, resets recovery on `connected`, reads candidate type via getStats (L271–290, L538–557), `restartIce()` on `failed` (L282–286), fast-polls on `failed`/`disconnected` (L287–289); `onnegotiationneeded` → `setLocalDescription()` + offer signal (L291–301).
- **Signal handling** (`onSignal`, L361–431): unknown sender allowed only if the roster vouches (L371–372); polite = `selfId < from` (L377). Offer collisions: impolite peer sets `ignoreOffer` when it is making an offer or not stable (L382–385). `setRemoteDescription` failure on an offer → **one-shot pc rebuild** (`recreatedForOffer`) to defeat the suspend/resume stale-DTLS-fingerprint wedge (L386–403). Candidates arriving before remote description are buffered (`pendingCandidates`, L412–419) and flushed after each `setRemoteDescription` (L349–359, L405). Offers always get answers (L407–411).
- **Signal delivery:** per-peer promise chains preserve order — "a candidate must never overtake its SDP into the DB" (L433–445); `postSignal` retries `[250, 750] ms` then logs and gives up (L447–475).
- **Heartbeat & watchdog:** every 2 s `pingAll()` (L479–491) — pings state channel, expires pongs older than 2 intervals, updates `rttMs`; then `watchdog()` (L500–536) reads the *live* `pc.connectionState` (silent-death detection, L508–513), and any pair with no progress for 10 s: dialer rebuilds the pair with a fresh pc (new DTLS identity), receiver counts the window and waits for a fresh offer; after 3 attempts the pair is marked `terminal` (visible to the app, excluded from fast-poll pressure, L516–520).
- **Leave:** `close()` closes pcs and POSTs `leave` with `keepalive` — roster teardown is broadcast by absence at everyone's next poll (L133–147). `closed` is permanent: `join()` cannot be called again on the same instance (no documented rejoin).

**Sync semantics:** there is **no CRDT, no operation log, no last-write-wins** at this layer. `P2PRoom` is a *transport* primitive: it delivers opaque `data` blobs (`broadcast`/`send`). Conflict resolution is entirely the consumer's job (the skill's trust model: every peer runs its own copy of the rules). Identity is a caller-supplied `selfId` string; the relay stores no credentials.

### 4.5 Bugs & weaknesses (library-level)

| # | Loc | Issue |
|---|---|---|
| M-1 | p2p.ts L3–4, L195 | **Documented relay (`/api/rtc`, `signaling.server.ts`) does not exist in this repo** — every poll 404s. Because `join()` swallows first-poll errors and `poll()` swallows all errors (L213–221), failure is *silent and infinite*: timers keep running, `onConnected` never fires, no diagnostics surface. Any future adoption must build the relay first. |
| M-2 | p2p.ts L84–96 | **No TURN**: default STUN only. Users behind symmetric NATs (most carrier CGNAT, many corp networks) can never connect; the watchdog burns all 3 recovery attempts and marks pairs `terminal` — user-visible as "peer never connects" with no hint that a TURN server is required. |
| M-3 | p2p.ts L188–211 | **No fetch timeout/abort**: a relay that accepts the connection but never responds stalls the *entire* signaling loop permanently (the only reschedule happens after `pollOnce` resolves); peers added meanwhile are never discovered. |
| M-4 | p2p.ts L213–221 | **No backoff on persistent relay failure**: 2 s polling forever against a dead/500ing server; no battery/network consideration; also no `document.visibilityState` pause (background tabs keep polling). |
| M-5 | p2p.ts L150–164 | **Unbounded payloads on an unreliable channel**: `JSON.stringify` + single `send()`; browsers cap SCTP messages (~64 KB typical, some lower); oversized sends throw synchronously out of `broadcast`/`send` (no try/catch) and could take down the caller's event loop tick; no chunking, no `bufferedAmount` backpressure. |
| M-6 | p2p.ts L500–536 | **Connected-zombie pairs are never reaped**: watchdog skips pairs whose live state is `connected` (L514). If a path black-holes without ICE loss detection (NAT rebind, laptop sleep with DTLS alive), the pair shows `connected` forever; pings stop getting pongs (rtt expires) but nothing rebuilds the pair. Needs a "no data for N s despite pings" reap. |
| M-7 | p2p.ts L377, L382–385 | Glare logic relies on `selfId` string ordering; ids are client-chosen — two clients picking the *same* id produce two dialers or two polite peers for the same pair (no tie-break beyond string equality, which then never dials each other — `selfId > p.id` is false both ways → **nobody dials**). Relay should enforce unique ids per room. |
| M-8 | p2p.ts L447–475 | Give-up on signal delivery is silent-ish (one `console.warn`); recovery leans on "next offer cycle" (L466–469) but a lost *answer* has no natural refire — only `restartIce` on `failed` (L282–286) or the watchdog rebuilds; transiently wedged pairs can sit `connecting` for up to 10 s. Acceptable, but the answer path deserves a nudge. |
| M-9 | p2p.ts L133–147 | `close()` does not abort an in-flight `pollOnce` fetch; harmless today (result dropped via `closed` checks L196/L199) but the socket lingers. Also no visibility into "am I joined?" state beyond `onConnected`. |
| M-10 | p2p.ts L19–32 | Relay wire types are `payload: unknown` — no schema validation of signal payloads client-side before `setRemoteDescription`/`addIceCandidate`; a compromised/misbehaving relay (or an attacker who can POST signals as any `from`) feeds arbitrary SDP/ICE. Impact is limited to failed connections/spam (DTLS still authenticates) but roster/name spoofing is trivial (client-sent `name`/`peer`, L189–194) — fake peers and fake names in `peerList()`. Consistent with the documented client-authoritative trust model, but worth restating for RapidTool: **never build competitive/authoritative features on this**. |
| M-11 | p2p.ts L500–536 | Watchdog dialer rebuild races: `connectTo` re-creates `slot.state/reliable` asynchronously; a `broadcast` during rebuild targets the new slot's not-yet-open channels → silently dropped (fine for unreliable semantics, worth knowing). |
| M-12 | p2p.ts L559–569 | `emitPeers` fingerprint includes `rttMs` — every completed pong re-notifies React consumers (fine, deduped), but RTT jitter causes re-render churn at 2 s cadence on connected rooms; consider decimation. |

**Security summary:** transport security is DTLS (WebRTC mandatory); the relay is plain HTTP with no auth — anyone who can reach it can join any room whose name they guess ("all visitors on the same deployed domain join one default room" per the skill), poll rosters, and inject signals. ICE reveals peer IPs (documented in the skill's trust model). For a public "software factory console" this would need room secrets/allowlists, but since nothing mounts it, current exposure = **zero**.

---

## 5. Styling (`src/styles.css`, 59 lines)

- Tailwind **v4** import (`@import "tailwindcss";`, L1) with the `@tailwindcss/vite` plugin (package.json L51) — no `tailwind.config.js`; tokens are CSS-first.
- **`@theme` block (L3–24)** defines the design tokens consumed as utilities throughout the console:
  - Colors: `bg #0b0c0e` (near-black), `surface #14161a`, `raised #1c1f25`, `fg #ecece8` (off-white), `muted #8b908c`, `faint #5c615e`, `accent #9eb0a4` (sage), `accent-fg #0b0c0e`, `border #2a2e34`, `line #22262c`, `ok #7d9b7f`, `warn #c4b08a`, `danger #c48a8a`.
  - Fonts: `--font-sans: "Instrument Sans", "Segoe UI", system-ui`; `--font-mono: "IBM Plex Mono", ui-monospace…` (L17–18). Fonts are fetched from Google Fonts via `<link>` preconnects in `__root.tsx` (L26–30) — external dependency; offline/no-network falls back to Segoe UI/system-ui gracefully.
  - Radii `xs 4 / sm 8 / md 12 / lg 20 / xl 28` (L19–23) — used sparsely (most cards use `rounded-md`/`rounded-lg`).
- **`@layer base` (L26–50):** antialiasing; `html/body/#app` min-height 100% with bg/fg; `button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer }` (L38–41) — satisfies AGENTS.md's scaffold contract for styles.css; `text-wrap: balance` on h1–h3, `pretty` on p.
- **Reduced motion (L52–59):** global animation/transition duration kill-switch honoring `prefers-reduced-motion: reduce`. No animations/transitions are defined anywhere in the audited files anyway (the UI is static — no spinner, no skeleton, no hover transition classes beyond Tailwind defaults like `hover:text-fg` which are color-only).
- **Dark theme only** — no `prefers-color-scheme` light variant; the palette is a monochrome+sage "ops console" look consistent across the screenshots.
- Unused token: `--color-accent-fg` defined (L11) but **never referenced in any tsx/css** (grep-verified) — residue or intended for a button style never built.
- Contrast notes (§9): `faint #5c615e` on `bg #0b0c0e` ≈ 2.9:1 — used for many 11–12 px mono captions (below WCAG AA 4.5:1 for normal text); `muted #8b908c` ≈ 5.6:1 passes.
- All layout styling lives inline in `console.tsx` class strings (typical Tailwind v4 utility usage); `styles.css` carries no component classes — full separation: tokens only.

---

## 6. Bugs register

Numbered, severity-tagged, actionable. File:line are exact.

**BUG-01 — Archive is destructive, unconfirmed, and strands the user — P2**
`console.tsx` L402–408. `remove(project.id)` fires with zero confirmation/undo and no follow-up navigation. The store is persisted (zustand), so this is permanent data loss on one click; after removal the current URL `/run/$id` renders the L200–209 fallback ("That build is not on this station.") — the user is left on a ghost screen. Fix: `window.confirm` or an inline two-step ("Archive? Yes/No") and navigate to `/` on success; alternatively soft-delete with restore in the Builds list.

**BUG-02 — Per-keystroke whole-tree re-render — P2**
`console.tsx` L578–584 (`setNotes` on every keystroke) combined with L168–182 (`useRapid()` with **no selector** → subscribes to the entire store) and L291 (`estimateTokens(project.packet)` un-memoized). Typing one character in Notes re-renders the full 801-line tree: header chips (re-estimating tokens over the whole packet), phase blocks, tab panels, artifact `<pre>`, memory/log rails. Same for the rename input (L261–273) and HITL note (L728–735) if the store were touched per keystroke (note is local state — fine). Fix: selector-based subscriptions (`useRapid(s => s.projects)`), memoize `estimateTokens`, and debounce/`onBlur`-commit `setNotes`.

**BUG-03 — Execute/Run-to-gate remain active while a phase is running — P2**
`console.tsx` L339–357. The "else" branch (showing Execute + Run to next gate) is entered for **every** status that isn't `blocked`, `hitl`, or `complete` — including `running` and `ready`. While a phase executes, both buttons stay enabled, inviting double execution / overlapping runs; the engine may guard internally, but the UI neither disables them nor shows progress. Fix: branch on `rec.status` (disable when `running`, show a progress affordance).

**BUG-04 — One-click delete is the only destructive path; no restore — P2**
(same as BUG-01? — merge. *Kept distinct below as design note:*)

*(deduplicated into BUG-01)*

**BUG-05 — Artifact selection can detach from the filtered list — P3**
`console.tsx` L194–198 + L563–571. `activeArt` prefers `selected`, and the filter (L564–568) only filters the *list*, not `activeArt`. If the user selects artifact A, then types a query that excludes A, the preview pane keeps showing A (unselected, invisible in the list) while "No artifacts match" is not shown either — the list can even be empty while the pre still has content. Fix: clear `selected` when the query changes, or resolve `active` inside the filtered set with fallback.

**BUG-06 — Token estimate recomputed every render — P3**
`console.tsx` L290–292. `estimateTokens(project.packet)` runs on every RunScreen render (see BUG-02 for the trigger frequency) over a packet that grows to many KB. Fix: `useMemo(() => estimateTokens(project.packet).tokensEst, [project.packet])`.

**BUG-07 — `busy` state is unobservable (synchronous dead pattern) — P3**
`console.tsx` L56–62: `setBusy(true)` → synchronous `create()` → `setBusy(false)` in the same tick — React never paints the disabled state, so the disabled button/`busy` guard (L104) is cosmetic; if `create()` ever throws, `busy` stays `true` forever (no try/finally) and the button is stuck disabled. Fix: drop `busy` or wrap in try/finally if `create` can become async.

**BUG-08 — Clipboard fallback hijacks the active tab — P3**
`console.tsx` L238–249. When the clipboard API rejects (permission iframe/sandbox), the handler *force-switches* the user to the Packet tab (`setTab("packet")`, L247). A user mid-review of Artifacts gets yanked to another tab. Fix: show the error only; let the user choose to open Packet.

**BUG-09 — Object URL revoked synchronously after click — P3**
`console.tsx` L390–395: `URL.createObjectURL` → `a.click()` → `URL.revokeObjectURL(url)` in the same tick. Works in Chromium/Firefox today, but revoking before the download is *scheduled* is a documented flake source (Safari historically aborts). Fix: `setTimeout(() => URL.revokeObjectURL(url), 1000)`.

**BUG-10 — Constraint chips unbounded (inconsistent with jobs/entities) — P3**
`console.tsx` L416–434: jobs sliced to 6 (L418) and entities to 5 (L423), but `constraints` render **all** (L428–432). A brief with many constraints balloons the phase header. Fix: consistent cap + "and N more" affordance.

**BUG-11 — Location report can race router state — P3**
`src/lib/preview-host-bridge.ts` L185–191: after `navigate()`, location is reported via `queueMicrotask`. TanStack's `router.history.push` (supplied at `preview-host-bridge.tsx` L18–20) resolves synchronously for the history entry but route matching/loaders may not have settled; a stale `pathname` report can leave the host URL bar behind. Fix: report after the router's `onResolved`/`subscriber` callback, or on the next `popstate`.

**BUG-12 — Parameterized route patterns leak into host autosuggest — P3**
`src/lib/preview-host-bridge.ts` L249–283. `collectRoutePathsFromTree` returns patterns verbatim, including `/run/$id` (no filtering of `$`/`:` segments). Hosts driving "navigate" from this list would send the literal pattern and land on the not-found fallback. Fix: filter param segments or return only static paths (`/`).

**BUG-13 — Bridge versioning is drop-silent — P3**
`src/lib/preview-host-bridge.ts` L175. A future host speaking version 2 gets every message dropped with no observable signal to the host (no error envelope). Acceptable as forward-compat, but a `version-mismatch` reply would aid debugging. Also the guest never validates its own `reportLocation` payloads against a schema (built by hand, L117–126) — drift risk.

**BUG-14 — Dev-mode localhost trust expansion — P3**
`src/lib/preview-embedder-origin.ts` L7. `localhost`/`127.0.0.1`/`[::1]` are allowlisted as embedder origins unconditionally. In dev any local page can frame the app and send `navigate`/`history` (same-origin nav only, root floor still applies — impact low, but the trust surface is broader than "the preview chrome"). Fix: constrain to the actual dev server port(s) when feasible.

**BUG-15 — Tab bar has no tab semantics — P2 (a11y)**
`console.tsx` L464–500. Five buttons styled as tabs with no `role="tablist"/"tab"/"tabpanel"`, no `aria-selected`, no `id`/`aria-controls`, no keyboard arrow navigation, and the active indicator is purely visual (`border-b border-fg`). Screen readers announce plain buttons; panel switches are not announced. Fix: proper tablist pattern (or `<Tabs>` from the installed Radix kit — package.json has `@radix-ui/react-tabs`).

**BUG-16 — No disabled/in-flight affordances + no failure announcement — P2 (a11y/perf)**
`console.tsx` L341–357 vs L410. While `execute()` runs (engine phases can take seconds-to-minutes of LLM time), there is no spinner, no aria-busy, no live region; errors appear only as static red text (L410) with no `role="alert"`. Screen-reader and glance users get no state change. Fix: `aria-busy` on the phase block while `running`, `role="alert"` on the error line, disable the run buttons (BUG-03).

**BUG-17 — 12-character rejection gate enforced in the view only — P3**
`console.tsx` L746–754. The "min 12 chars" contract lives solely in the Reject button's `disabled` attribute. Any future caller of `onReject` (or keyboard/AT path if the attribute logic regresses) bypasses it; `reject(id, note)` (L225–230) would happily persist a 1-char note. Fix: guard in `onReject` too (`if (note.trim().length < 12) return`).

**BUG-18 — Ready/running/awaiting_hitl share one dot glyph — P3 (a11y)**
`console.tsx` L652. `StatusGlyph` renders the same accent dot for `ready`, `running`, and `awaiting_hitl`; `statusTone` (L22–29) colors them all identically in the rail text too (`text-accent` for running vs `text-fg` for ready vs `text-warn` for awaiting_hitl — actually distinct tones, but the *glyph* isn't). Rail scanning cannot tell "ready to run" from "currently running" without reading the code text. Fix: distinct glyphs (pulsing dot for running; shield/dot for awaiting_hitl).

**BUG-19 — Duplicated PhaseStatus→presentation maps — P3**
`statusTone` (L22–29) and `StatusGlyph` (L648–653) each map `PhaseStatus` separately; a new status (e.g. `failed`) added in `types.ts` would need edits in both to stay coherent (and currently unknown statuses fall through to `text-faint`/faint dot — likely wrong for a hypothetical `failed`). Fix: single `phaseStatusMeta` map.

**BUG-20 — `running`-era double action also applies to "Run to next gate" — P2**
(merged into BUG-03 — see there.)

**BUG-21 — Packet tab shows stale packet if refresh fails silently — P3**
`console.tsx` L501–504 renders `project.packet` directly. `refreshPacket` errors (if any) are not surfaced on this path; the copy path (L238–249) refreshes first but the pre itself may lag behind the last executed phase until a refresh happens. Engine-owned; UI-side mitigation: refresh on tab open.

**BUG-22 — No visibility into multiplayer adoption failure (library) — P1 *if adopted***
`src/lib/multiplayer/p2p.ts` L119–131 + L213–221 — see §4.5 M-1: with the relay absent, `join()` fails silently forever. For the *current* app this is inert (nothing imports it); the moment a future console feature mounts P2PRoom without building the relay, it will look "connected-ish" while doing nothing. Fix at adoption time: surface poll-failure state to the UI.

**BUG-23 — `pingAll` pings only the state channel; pong never arrives on reliable-only flows — P3**
`p2p.ts` L328–337, L479–491. RTT is measured over the *unreliable* channel: under congestion pings are dropped (expiry logic L483–487 handles it), but if the state channel is open while `reliable` never opens, RTT still works — inverse case (reliable open, state not yet) yields no RTT and no ping traffic until state opens. Cosmetic; documented for completeness.

**BUG-24 — `send`/`broadcast` exceptions are unguarded — P2 (library)**
`p2p.ts` L150–164. `RTCDataChannel.send` can throw (payload too large, channel closing race). Neither method catches; a throwing peer takes down the caller's loop. Fix: try/catch + drop, and enforce a max payload size (§4.5 M-5).

**BUG-25 — Watchdog never reaps connected zombies — P2 (library)**
`p2p.ts` L514 (`if (slot.terminal || live === "connected") continue;`). See §4.5 M-6.

**BUG-26 — HomeScreen "Builds" list is unbounded and unscrollable — P3**
`console.tsx` L132–159. Every project renders as a full row in the page flow; dozens of builds make the intake page very long (no internal scroll cap, no pagination/search, no archive affordance from home). Fix: cap height + scroll, or search box.

**BUG-27 — No way to reach a specific phase's artifacts — P2 (UX)**
`console.tsx` L464–573. The Artifacts tab's only filter is free-text across `title/kind/body` (L564–568); there is no phase filter despite every artifact carrying `a.phase` (rendered at L789). With 13 phases × multiple artifacts, "show me Phase 0's scorecard artifacts" requires text guessing. Fix: add a phase `<select>` next to the filter.

**BUG-28 — Keyboard trap risk in inline rename — P3**
`console.tsx` L261–273. The rename input commits on blur and Enter but **Escape does not cancel**; a user who clicks edit and changes their mind must commit (rename) or click elsewhere with the same effect. Fix: on Escape → restore name, exit edit mode.

**BUG-29 — Screenshot metadata mismatch: two verdict files, same content hash — P3 (process)**
`app-builder-built.json` L12 vs `app-builder-preview.json` L11: identical `bodyTextHash` and `bodyTextLen` for desktop and mobile pairs — expected (same app), but *built* ran against `:8081` (L2) and *preview* against `:8080` (L2), and the built JSON lacks the `divergesFromBaseline` fields (present in the preview JSON L36–37) — the built file's baseline was the preview run, so "no divergence" here only proves parity with the dev server, not with a *previous* build. Fine for this snapshot; worth knowing when comparing future builds.

**BUG-30 — `Mark`/status glyphs use color+shape but no text alternatives in the rail — P3**
`console.tsx` L31–39, L648–653 — decorative-only `<span>`s and lucide SVGs with no `aria-hidden`/alt coordination; adjacent text carries the meaning for SR users, but the glyphs are announced inconsistently depending on how the SVG is exposed. (Lucide defaults to decorative; verify in the running app with a screen reader — listed as a check, not a confirmed defect.)

**BUG-31 — Hidden phase rows on mobile: 148px minimum causes heavy horizontal scroll — P3 (responsive)**
`console.tsx` L628 (`min-w-[148px]` per phase row in horizontal strip). 13 phases ≈ 1,924 px of scroll on a 390 px viewport; no snap, no visual "you are here" cue beyond the active row. Screenshots (`app-builder-*-mobile.png` JSONs) report no horizontal overflow at page level — the rail scrolls internally — but discoverability of the rail's 13 entries on mobile is poor. Fix: collapsible rail or a compact phase `<select>` on <lg.

---

## 7. Dead code / TODOs / stubs / orphaned capability

**7.1 Marker scan:** grep for `TODO|FIXME|HACK|XXX|@ts-ignore|eslint-disable` across all seven audited source files returns **nothing**. No stubs, no commented-out blocks, no `eslint-disable` suppressions. (Cleanest layer of the app in this regard.)

**7.2 Orphaned module — the entire multiplayer kit (biggest dead-code finding):**
- `src/lib/multiplayer/index.ts` (all 9 lines) and `src/lib/multiplayer/p2p.ts` (570 lines) — **zero importers** anywhere in `src/`. Grep-verified.
- Its server counterpart is also absent (`signaling.server.ts`, `routes/api/rtc.ts`) — see §4.0.
- Net effect: ~580 lines of maintained-looking, commented, well-engineered template code with no consumer, plus a *documented endpoint that doesn't exist* (p2p.ts L3–4: "signaled through /api/rtc (see signaling.server.ts)").
- Recommendation: either (a) delete the directory (kit restores it on scaffold — check platform conventions first), or (b) adopt it deliberately for a shared-session console (see §8.4) and build the relay. Leaving it in place un-wired is a standing trap: its header comment promises a file that is not there.

**7.3 Stranded copy (evidence of an abandoned model):**
- `console.tsx` L203 — "That build is not on this station." There is exactly one station (the local browser). The phrase implies shared/multi-station sessions that don't exist. Recommend rewording ("This build doesn't exist or was archived.") or wiring the concept.

**7.4 Unused design token:**
- `styles.css` L11 `--color-accent-fg: #0b0c0e` — defined, never used (grep-verified). Candidate for a "primary-on-accent" button style that was never built, or delete.

**7.5 Unused/inert UI machinery:**
- `console.tsx` L45, L58, L60 — `busy` state is functionally dead (BUG-07).
- `console.tsx` L46–54 — `hydrated`/`setHydrated`/`seedIfEmpty` timing dance exists so first paint isn't empty; only meaningful on the first mount ever (subsequent runs are hydrated instantly from persistence). Benign but fragile-looking.
- `browser-smoke` artifact `screenshots/app-builder-built.json` lacks `divergesFromBaseline`/`baselineReasons` (L36–37 in preview JSON vs absent in built JSON) — schema drift between smoke runs, not code.
- Server surface `server/middleware/grok-pwa.ts` + `public/__grok/` are platform chrome (out of scope, but note the app's UI never references them).

**7.6 No tests** exist for any audited file. The repo's `npm test` covers `app-data` and `auth` only (package.json L19). `preview-embedder-origin.ts` (pure functions — highly testable allowlist logic), `isSafeBridgePath`, and `p2p.ts`'s state machine are untested. The two `.test.ts` files under `src/lib/app-data/`/`auth/` show the convention exists.

---

## 8. UX gaps + potentiality

### 8.1 Gaps in the shipped console

1. **No phase review.** PhaseRail (L618–646) is display-only; completed phases can't be reopened. The center column always shows the *current* phase (L308–317). For an audit-heavy "paper trail" product (hero: "Ship with a paper trail"), the inability to re-read Phase 0's scorecard *in situ* (it only appears while it is the current phase, L452) is the single biggest storytelling gap. Artifacts persist and are browsable (L760–801) — the raw material exists; a "revisit phase" affordance or per-phase artifact filter (BUG-27) would close it.
2. **No run progress / cancel.** During long phases: no spinner, no ETA, no cancel, buttons stay live (BUG-03, BUG-16). The engine/store presumably resolves phases in finite time; the UI gives no heartbeat. A minimal "running…" state with the trace stream (L437–450 already renders completed traces) would make the factory feel alive.
3. **No history/timeline of HITL decisions.** Approvals/rejections only exist as log events (L601–611). The rejection note (the *why*) is never shown back once the phase regenerates — the loop closes but the audit trail of "operator said X at gate Y" vanishes from view.
4. **Single-window, no overview.** The Builds list (L127–160) is the only multi-project surface; no aggregate "all builds / phases across builds" view, no search on home (BUG-26).
5. **Autopilot is global and unexplained.** The checkbox (L293–300) says "Autopilot · extra gates" — no tooltip/description of what extra gates mean, and it applies store-wide while living in the run header. First-time users will toggle it blind.
6. **Copy affordances are thin.** Artifact bodies (`<pre>` L796–798) and the packet tab (L501–504) have no per-pane copy button; only the header "Copy agent packet" exists (L359–366). Users who want to lift one spec graph node's text must hand-select.
7. **Tab label mismatch:** the store/tab key is `"tests"` (L188, L493–499) but the visible label is **"Oracle"** and the content is oracle cases — consistent visually, but the internal name will confuse future maintainers. (Also the packet tab empty-state text "Execute a phase to compile the packet." presumes the packet is empty — a *stale* packet after edits is indistinguishable from a fresh one.)

### 8.2 Capabilities that exist but nothing wires up

1. **`estimateTokens`** (L291) is the only consumer of the algorithms module in the UI — yet it powers just a passive chip. It could gate briefs ("est. budget") or show per-phase token burn on the rail.
2. **`contracts`** data renders as a single summary line (L546–551) — endpoints are counted but never listed; the Spec graph tab (L505–523) shows files, not contracts. A "contracts" panel is latent.
3. **`clone`** (L367–376) duplicates a project silently — no rename prompt, no "clone and advance to phase X" options; the user must immediately rename via the header. Low-hanging polish.
4. **`refreshPacket`** only runs on copy/export — a background refresh on phase completion would keep the tab honest (BUG-21).
5. **Radix kit is installed but unused** — `@radix-ui/react-tabs` (tabs BUG-15), `react-dialog` (confirm BUG-01), `tooltip` (autopilot explainer) could all be adopted for free.
6. **The `P2PRoom` library (see §8.4)** — the only genuinely powerful dormant capability.

### 8.3 What would unlock the console (priority-ordered)

1. Live execution telemetry (per-phase log stream into the traces block + running indicator) — turns a form into a "factory."
2. Revisit-any-phase view (read-only) with per-phase artifacts filter.
3. Undo/archive-restore for projects; confirm dialogs for Archive.
4. Artifact diffing across clones (clone exists → compare runs) — a natural "software factory" superpower: side-by-side packet/artifact diff between the original and a clone after a regenerate loop.
5. Store-subscription refactor (selectors) so the console stays smooth as projects grow (BUG-02).
6. Home-screen "resume where you left off" (deep-link to the last active project) and multi-project status chips.

### 8.4 Potentiality: multiplayer for the console (if ever adopted)

A shared-session console would be a genuine product story — "the factory floor as a shared room": a host runs the graph; observers watch phase transitions, HITL docks, and artifacts stream in real time. The plumbing would be:
- one `P2PRoom` per project (`room = project.id`), host = dialer/authority; **authoritative-state broadcasting on the reliable channel** (whole-project snapshots on join, then deltas), presence on the state channel;
- operator actions (approve/reject) are **host-only** — client-authoritative mesh is fine for *viewers*, never for control (skill trust model);
- requires building the missing relay (`/api/rtc` + `signaling.server.ts`) and a small `use-p2p-room.ts` hook (the skill's table lists it as "optional, you create").
Given the console currently persists projects locally (single user) and the auth layer is opt-in, this is a feature decision, not a bug — but every primitive needed is already in the tree (p2p.ts), and its UI language ("station") is already written.

---

## 9. Accessibility + responsive review

### 9.1 Semantic structure — the good

- Native landmarks: `header` (L66–75, L253–302), `main` (L77), `nav` (PhaseRail L620), `aside` (L127, L576), `section` (L78, L306), `ol/ul/li` for lists, `table` with `thead/th` (L681–688).
- Real `<button type="button">` everywhere; `<label htmlFor>` correctly paired for `brief` (L90–94) and `hitl-note` (L725–729).
- One input has `aria-label` (Build name, L262); headings are hierarchical on both screens (h1 hero L80; h1 phase title L311; h2 subsections).
- Text contrast is generally strong for `fg`/`muted`; focus rings exist on text inputs (`focus:ring-2 focus:ring-accent/40`, L99, L560, L733) but **not** on buttons (no `focus-visible` classes; browsers fall back to the default outline — verify in-app, it may be nearly invisible on dark raised surfaces).

### 9.2 The gaps

1. **Tabs are not tabs** (BUG-15): no `role=tablist/tab/tabpanel`, no `aria-selected`, no arrow-key support, no `aria-controls`; state change is color+border only. **P2.**
2. **Status is color/shape-only in places** (BUG-18): the three "active-ish" phase statuses share one dot; the rail relies on tiny 11 px mono text for the discriminator. **P3.**
3. **No live regions**: nothing announces phase completion/errors while a run executes; error text (L410) is not `role="alert"`; no `aria-busy` (BUG-16). **P2.**
4. **Unlabeled inputs**: Notes textarea (L578–584) is labeled only by a preceding `<h2>` (no `aria-label`/`htmlFor`); artifact filter (L555–562) has placeholder-only labeling. **P3.**
5. **Contrast:** `text-faint` (#5c615e) sits below 3:1 against `bg` and worse against `raised`/`surface` — used for 11 px captions (L111, L130, L591, L607, L736, L788…). WCAG AA for normal text is 4.5:1; these are decorative-adjacent but content-bearing. **P3.**
6. **Keyboard flows:** rename editor has no Escape-to-cancel (BUG-28); nothing else traps focus; no skip-to-content link on either screen (minor for an app this size — still standard for a console used daily).
7. **Touch targets:** primary actions are `min-h-11` (44 px, L106/L324/L344/L352/L362…) — good; chip/template buttons are `min-h-10` (40 px, L119) and header chips ~36 px (L285–292) — below the 44 px comfort line but acceptable for secondary controls.
8. **prefers-reduced-motion** handled globally (styles.css L52–59); the UI defines no animations at all, so nothing to disable.

### 9.3 Responsive behavior (validated against the mobile screenshot JSONs)

- `app-builder-built.json`/`app-builder-preview.json`: 390×844 run reports **no horizontal overflow**, no console errors, `bodyTextLen` 525 (mobile) vs 552 (desktop) — content reflows rather than truncating.
- Layout strategy is sound: home stacks to one column < lg (L77); run console stacks rail→center→right rail < lg (L304, rails lose their border logic at L306/L620); header chips wrap (L253, L284); traces/scorecard/crew grids collapse 4→2→1 (L440, L670, L525); ArtifactPane goes single-column < md (L777); competitor table scrolls horizontally inside its container (L680–681).
- Known rough edges: PhaseRail horizontal strip of 13 × 148 px rows on phones (BUG-31); the phase-header action cluster (L319–409) is a long button stack on mobile with no grouping; the right rail lands *below* the artifacts section on mobile (L576), so Notes/Memory/Diagnostics are a long scroll away from the phase header.
- The mobile screenshots (per JSON `bodyTextPrefix`: "RapidTool autonomous software agency GOVERNED DELIVERY Research …") confirm the home hero reflows; the visual PNG pair exists (`app-builder-*-mobile.png`) and the smoke harness's verdict fields are green (`horizontalOverflow: false`, empty `consoleErrors`/`pageErrors`).

---

## 10. Screenshot artifacts (JSON) — what they actually are

The two JSON files are **browser-smoke verdict outputs** (the AGENTS.md §2 step-7 harness), not UI state dumps:

| Field | `app-builder-preview.json` | `app-builder-built.json` |
|---|---|---|
| URL | `http://127.0.0.1:8080/` (dev) | `http://127.0.0.1:8081/` (built-output preview) |
| Desktop 1280×800 | 200, title "RapidTool", body 552 chars, prefix "…phases 0–12 · graph locked …" | identical hash `4fb34…` |
| Mobile 390×844 | 200, body 525 chars, prefix "…GOVERNED DELIVERY Research…" | identical hash `12c98…` |
| Errors | none (console + page) | none |
| Overflow | none | none |
| Brand/auth warnings | none | none |
| Baseline | (absent fields) | `divergesFromBaseline:false` |

Meaning: the app renders on both dev and production-built servers, desktop and mobile, with clean consoles, no overflow, and **byte-identical body text between dev and built runs** (hash equality across L11/L25 of both files). The body text captured is the *intake screen* (matches HomeScreen copy: "autonomous software agency", "GOVERNED DELIVERY", "phases 0–12 · graph locked", "Research"). The desktop hash equals the *preview* hash — this JSON pair documents one QA pass of the home screen only; the deeper run-console screens (`console-run.png`, `crew.png`, `oracle.png`, `packet.png`, `spec.png`, `sandbox-pass.png`, `clinic-p4.png`, `app-builder-built.png/preview.png`) are human-visible PNG evidence that the run console, crew/oracle tabs, sandbox verdict line, and HITL/scorecard blocks render with content (visual check of `console-run.png`: 3-column run layout — phase rail with lock glyphs and HITL tags, center scorecard block "6.4/10 proceed-with-guards" with five axis cards, right rail memory entries (`episodic · P2 · 0.88` style) and DIAGNOSTICS log (`phase.enter`, `scorecard.ready`, `project.created`) — consistent with RunScreen's ScorecardBlock/Memory/Diagnostics; visual check of `app-builder-preview.png`: intake screen with hero, brief textarea, "Open intake", template chips, and a Builds card "Northwind Dispatch · operations · P0 · intake" — consistent with HomeScreen + seeded project).

One caveat: `console-run.png` shows a run for a different project domain ("A Parts-and-labor Quoting Desk") and a center-left phase selector (P0…P4 with a selected P4) that does not match the current `RunScreen` structure exactly — these PNGs are historical QA snapshots from an earlier iteration of the console (current code has no center-left phase selector column; PhaseRail is full-height left). Treat PNG content as "the console family of screens", current code as ground truth.

---

## 11. Conformance to the platform contract & vision doc

**AGENTS.md conformance (UI-layer rules only):**
- ✔ `PreviewHostBridge` mounted near the top of the shell (`__root.tsx` L40) — AGENTS.md rule 3 ("keep the bridge… silent noop everywhere else"): `preview-host-bridge.ts` L66–78 implements exactly that.
- ✔ `styles.css` starts with `@import "tailwindcss";` and gives `button`/`[role=button]` `cursor:pointer` (L1, L38–41) — the scaffold contract.
- ✔ No `og:*`/`twitter:card` in `__root.tsx` (not present in audited files; PWA injector owns them).
- ✔ No CSP blocking `grok.com` anywhere in the audited layer (the bridge requires messaging grok.com parents).
- ✔ No auth routes/buttons in the console (auth is opt-in per §0.5 and RapidTool's console shows no sign-in surface) — consistent with a local-first tool.
- ✔ Mobile 390 px: no horizontal overflow per smoke JSONs; buttons ≥40 px.
- Note: the multiplayer skill's own table ("Signaling relay (you create)") explains why `/api/rtc` is missing — the platform ships the client, apps build the relay; RapidTool never did (see §4.0). Not a platform violation; an incomplete adoption.

**Vision doc conformance (`RapidTool_Complete_Master.md`):** the console is the *operator surface* of the 13-phase graph described in the master doc. Mapping of visible UI to the doc's phases: Phase 0 scorecard (L655–703 ↔ "structured Feasibility & Architecture Scorecard" §Phase 0), graph-locked sequencing (rail lock glyphs ↔ "State Transition Validation… cannot force invalid graph transitions" §Additions/Fixes Phase 1), HITL gates (HitlDock ↔ §Phase 5 "approval prompts for high-stakes modifications… rejection forces loop iteration" — implemented as reject-with-note), sandbox verdict line (L411–415 ↔ §Phase 4/6 isolation), crew/oracle/spec tabs (↔ §Phase 8 component generation + Phase 6 adversarial verification "oracle"), agent packet (↔ "paste-ready prompt" — the copy/export affordance, L359–401), memory rail (↔ §Phase 2 hierarchical memory, shown as episodic/procedural/semantic with scores), diagnostics log (↔ "log all orchestration steps into unified JSON streams" §Phase 5). The doc's grander ambitions (MCP/A2A live wiring, cloud deployment routing, local-model handoff) exist as *phases in the graph* but the console makes no claims about live external integration — its pitch line is honest about scope: "deterministic 13-phase graph… turns the run into a paste-ready prompt for other agents" (L83–88).

---

## 12. Final tally & top recommendations

| Section | Verdict |
|---|---|
| Console (console.tsx) | High-quality local-first control surface; structural gaps: no phase revisit, no live progress, Archive/confirm, perf (whole-store re-renders). |
| Preview bridge (3 files) | Correct, minimal, safe; P3 nits (location-report race, param-route leak, silent version drops). |
| Multiplayer (2 files) | Excellent standalone WebRTC kit, **zero integration**; missing relay endpoint; adopt-or-delete decision needed. |
| Styles (styles.css) | Coherent Tailwind v4 token theme; one unused token; faint-contrast + color-only status caveats. |
| Bugs | 31 registered (0 P0, 2 P1-contextual* [BUG-22/§4.5 M-1 if adopted, preview none], ~10 P2, ~19 P3). *No P0/P1 defects in the shipped console path.* |

**Top 5 fixes, in order:** (1) BUG-01 Archive confirm + navigate; (2) BUG-02/BUG-06 store selectors + memoized token estimate; (3) BUG-03/BUG-16 running-state UX (disable + progress + aria); (4) BUG-15 tab semantics; (5) adopt-or-delete the multiplayer kit (§7.2) with its missing relay as the explicit cost of adoption.

---

*End of audit 02. All line references verified against the files as they exist at audit time; nothing in this report was produced by running the application.*
