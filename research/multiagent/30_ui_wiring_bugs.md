# 30 · UI / Wiring Bug Register — console.tsx ↔ styles.css ↔ store.ts

**Hunter:** Flash H1 (UI + wiring) · **Mode:** read-only code audit, no edits, no runtime.
**Files read in full:** `src/components/console.tsx` (4872 ln), `src/styles.css` (183 ln), `src/lib/store.ts` (1120 ln), `src/lib/types.ts` (347 ln), `src/lib/io.ts`, `src/routes/__root.tsx`, `src/routes/run.$id.tsx`, `src/routes/index.tsx`; targeted reads of `src/lib/engine.ts` (wildStep/hydrate/wildPatch), `crew.ts`, `chat.ts`, `errors.ts`, `vault.ts`, `handoff.ts`, `report-intake.ts`, `gate-stats.ts`, `llm.ts`, `research.ts`.
**Every claim below was read from the files; no runtime reproduction.**

---

## 0. Verified-clean matrices (checked so the parent does not re-hunt)

**Store actions called from console.tsx — all exist in `RapidState` with matching signatures** (store.ts:52–99): `approve(id,{force,requestedAt})` :889, `rejectAsync(id,note)` :951, `retry` :990, `remove` :998, `refreshPacket` :1043, `clone` :1003, `rename` :1032, `setNotes` :1039, `exportProject` :1052, `importProject` :1056, `setAutopilot` :513, `executeAsync` :671, `runUntilHitlAsync` :699, `runModuleReal` :759, `ingestReport` :811, `refreshStatuses` :845, `hasProject` :841, `setWildMode` :520, `toggleWildPause` :564, `stopWildRun` :556, `startWildRun` :526. `WildRunState` field names in store writes (store.ts:532–543) match types.ts:129–137 exactly (`active/phase/startedAt/lastAutoLog/lastAutoAt/stoppedAt/pause`).
**CSS classes referenced in JSX all exist** in styles.css: `.vault-link` :96 (+`:disabled` :117 — JSX adds a no-CSS `vault-link-dead` class at console.tsx:3072 but the `disabled` attribute carries the styling), `.chat-scroll`/`.scroll-thin` :131–149, `.wrap-any` :155, `.wild-live-dot` :172 (+ `@keyframes wild-live-pulse` :161). Tailwind tokens used (`text-wild`, `bg-wild/10`, `border-warn/40`, …) all resolve to `@theme` `--color-*` :3–27 / light overrides :75–90.
**9 tabs ↔ 9 contents wired**: triggers artifacts/packet/spec/crew/oracle/vault/design/diagram/chat (console.tsx:2117–2170) all have `Tabs.Content … forceMount` panels (:2174–2306). Chat tab is present and mounts.
**io.ts signatures match**: `exportPacketText(project)` :93, `downloadFilename(project, ext)` :118, `slugName` :106, `exportProjectJson` :25, `importProject` (hydrates) :47 — so copy/download/export/import paths (console.tsx:1453–1547) call real functions with the right shapes.
**Sibling modules match**: `chatOnce(project,text,history?)` chat.ts:37; `runCrew(project,opts?)` + `{ok,messages,artifacts,stopped,reason,error}` crew.ts:121–177; `ERROR_CODE_DOC` `{meaning,agentAction}` errors.ts:117; `approvalHealth` gate-stats.ts:38; `phaseHandoff(project,phase)` handoff.ts:24; `researchStatus` research.ts:99; `llmStatus` llm.ts:74; vault exports vault.ts:159/543/692; report schema accepts `"partial"` report-intake.ts:42/74 (crew partial-ingest path console.tsx:1411–1416 is legal).
**Route wiring**: `run.$id.tsx` renders `<RunScreen key={id} id={id}/>` — the `key` remount (run.$id.tsx:13–16) already kills every "stale local state across project switches" class of bug (chat thread, vault selection, wild feed). Theme is applied pre-hydration at the root (__root.tsx:47–49), so light-theme flash does **not** exist on the home screen.

---

## P0 — broken function

### P0-1 · Wild Mode can never be started from the UI (and the one start path that exists runs a single step, then stalls)
- **console.tsx:376–382** `wildSetEnabled` only ever calls `setWildMode` (enable/disable flag).
- **console.tsx:508–534** `WildToggle.flip()` only flips the `wildMode` boolean; its tooltip promises "Wild mode on — unattended auto-run to the next human gate" (console.tsx:544–548).
- **console.tsx:588–867** `WildConsole` offers Pause/Resume only — there is no Start control anywhere in the file, and `grep -rn "startWildRun" src` finds the store definition and **zero call sites**.
- **store.ts:526–555** `startWildRun` exists but is dead code from the UI's perspective; it executes exactly **one** `wildStep` (store.ts:546) and returns — no loop, no interval, no chained driver. engine.ts:1978–1997 documents that `wildStep` is a *bounded single-step primitive* and that a driver must loop it ("so a headless driver can loop wildStep", engine.ts:1982); the in-app driver does not exist (the loop driver lives only in `headless.ts`, CLI-side). engine.ts:2309–2313 additionally requires `wildRun.active === true`, so nothing in the app can ever put `wildRun` into an active state except the unbound `startWildRun`.
- **Net effect:** toggling Wild ON changes only `wildMode:true` (store.ts:520–525). Any later "Execute / Run to next gate" is an ordinary manual run (store.ts:671–754 never consult `wildMode`/`wildRun`), the `WildConsole` strip renders **IDLE forever** with "No auto activity yet — wild mode acts silently until the next gate decision." (console.tsx:854–863), and a phase that happens to be `running` is badge-labelled "WILD MODE RUNNING" (see P1-3) for a run that is not wild. The flagship feature of the build is unreachable.
- **Fix spec (pick one driver home; both sides must land):**
  1. *Store driver (recommended):* give `startWildRun` a loop — after store.ts:544 `set(...)`, install a per-id interval (clear on completion/pause/stop/removal) that calls `wildStep` until `next.wildRun?.pause`/`next.status === "complete"`/error (store.ts:549–551 already maps those stop states); make `stopWildRun`/`toggleWildPause` (store.ts:556–571) cancel the interval when they flip `active`/`pause`, and have `remove`/hydration-cleanup (store.ts:998, engine.ts:1299–1318) clear any timer.
  2. *Console driver:* in `WildConsole`'s poll tick (console.tsx:654–713), when `running` and the store exposes `startWildRun`, invoke it (it is idempotent per active step) — but the store must then tolerate repeated `startedAt` rewrites (store.ts:536–539) and never double-loop.
  - Then add a **Start** affordance in `WildConsole` (enabled when `wild.enabled && !wild.run?.active`) calling `startWildRun(projectId)` and surfacing `WildRunResult` errors (store.ts:528–530, 552–554 already return honest `{ok:false,error}` shapes), plus a **Stop** button (P2-4).
- **Severity: P0** — advertised autonomous loop is non-functional; the toggle is a placebo.

---

## P1 — wrong behavior / inverted control

### P1-1 · Canonical `pause` field is ignored — the pause UI is inverted and the paused state is never shown
- types.ts:136 + store.ts:564–571 write the pause flag as **`pause`**; engine.ts:2050 (`wildPause`) also writes `pause:true`. Nothing anywhere writes the legacy `paused` alias. Yet `WildConsole` computes and renders almost entirely from `paused`:
  - **console.tsx:597** `const running = wild.run?.active === true && wild.run?.paused !== true;` → a paused run (`pause:true`, active still true) computes `running === true`.
  - **console.tsx:731** `onPauseToggle` reads pause state only via `.run?.paused === true` → always `false` for canonical runs.
  - **console.tsx:754, 764** tone/colour ternary `wild.run?.paused === true` → unreachable.
  - **console.tsx:769–780** chip text: `running` wins → **"RUNNING" + live dot is displayed while the run is actually paused**; the `PAUSED` text at :774 (the *only* canonical-`pause` read) can never render because the `running` branch precedes it.
  - **console.tsx:812** button label `{running ? "Pause" : wild.run?.paused === true ? "Resume" : "Pause"}` → always "Pause".
- **Resulting behavior:** with a paused run, the strip claims RUNNING and the button reads "Pause". `onPauseToggle` (console.tsx:726–745): `paused=false → target=true → wildSetPaused(id,true)` → resolves to `toggleWildPause` (console.tsx:327–333; store.ts:564) → toggles `pause` false → **clicking "Pause" RESUMES the loop** — a fully inverted emergency control. While truly running, the same click pauses, but nothing on screen ever reflects the paused state, so a paused loop looks alive ("listening for auto decisions…" console.tsx:855–859 keeps pulsing) until the operator clicks again and unwittingly resumes it.
- **Root cause:** the dedicated helper `wildPaused()` (console.tsx:318–320: `pause === true || paused === true`) is **never called** anywhere in the file (grep: only its definition).
- **Fix spec:**
  1. Define once near console.tsx:597: `const paused = wildPaused(wild.run); const running = wild.run?.active === true && !paused;`
  2. Replace every `wild.run?.paused === true` with `paused` (lines 597, 731, 754, 764, 812); use `paused` (not `running`) for the PAUSED chip text branch (:774) and reorder chip text `RUNNING → PAUSED → STOPPED → IDLE` so :774's canonical read becomes reachable; rework :762–767 chip tone to key off `running/paused` consistently.
  3. `onPauseToggle` (:726–745): read `const paused = wildPaused(wildStateOf(live).run)` (both spellings) and then **call the toggle with the run's true current state** — or better, stop passing intent and call `toggleWildPause(projectId)` directly now that the store contract is known (drop the speculative `WILD_PAUSE_NAMES`/`WILD_RESUME_NAMES` shims at :327–340, which share `toggleWildPause` between both lists).
  4. Title/`aria` at :792–798 and the button label at :812 derive from `paused`, so a paused run offers "Resume".
- **Severity: P1** — emergency pause of an unattended run is mislabeled and its "Pause" press has the opposite effect.

### P1-2 · "WILD MODE RUNNING" badges are shown for ordinary manual runs whenever the toggle is on
- **console.tsx:434** `StatusBadge` takes `wild = wildStateOf(project).enabled` (the *flag*, not run activity); **console.tsx:453–457** a phase merely `running` then renders "WILD MODE RUNNING" with the violet `wild` tone and the `wild-live-dot` pulse (:481). Because enabling wild mode never starts a wild run (P0-1), **every** manual Execute/Run-to-gate now mislabels phases as unattended wild-mode work.
- **console.tsx:2428–2430** `PhaseProgressRail` repeats the same conflation ("Wild mode running" for `rec.status==="running"` whenever the flag is on).
- **Fix spec:** gate the wild presentation on an **active run**, not the opt-in flag. In `StatusBadge`, compute `const wildRunActive = wildStateOf(project).run?.active === true` (console.tsx:302–314 shape already exposes `active`/`pause`) and use `wildRunActive` for label/tone/live (:454–457, :481) — fall back to a plain "RUNNING"/`accent` tone for manual runs even with the flag on. Mirror in `PhaseProgressRail` :2430 (use `run.active === true`, and prefer `run.pause === true → "Wild mode paused"` over "running" when applicable).
- **Severity: P1** — false operational state on the phase rail for the app's core manual workflow.

---

## P2 — polish / edge wiring

### P2-1 · Wild strip has no Stop affordance, never shows STOPPED/stoppedAt, and misleads after reload
- `wildStop()` (console.tsx:407–409) and `WILD_STOP_NAMES` (:342) are **never invoked** — the comment at :341 promises a stop control "surfaced when a run is paused/stopped", but no button calls it; `stopWildRun` (store.ts:556–563) is therefore unreachable from the UI. An operator cannot end a wild run, only pause it (which, per P1-1, is itself mislabeled).
- **console.tsx:776–780** chip falls through to "IDLE" for a *stopped* run (`active:false`): the `STOPPED` branch at :776 is dead (it is only reachable when `active===true && !running`, i.e. `paused`-alias true, which never occurs, see P1-1). types.ts:135 `stoppedAt` (stamped by engine.ts:1318 and store.ts:560) is never displayed; after a reload the engine force-stops any persisted active run with a `wild.stop` log (engine.ts:1299–1318, :1505–1516) and the UI just shows IDLE with the "acts silently" copy (:861).
- **Fix spec:** render a Stop button next to Pause when `wild.run?.active` (console.tsx:788 area) that calls `wildStop(projectId)` (:407); label the chip state from `stoppedAt != null` as "STOPPED" before "IDLE" (:774–780); when `stoppedAt` exists show "ended {agoLabel(stoppedAt)}" beside the run clock (:782–786); replace the empty-feed copy (:854–863) with an honest line when no run has ever started (enabled but idle): "Wild mode is enabled — start a run to begin unattended execution."
- **Severity: P2** (blocked behind P0-1/P1-1 fixes to be visible).

### P2-2 · Single-key shortcuts fire while dialogs are open — approve/execute can run behind the Archive dialog
- The global handler (console.tsx:1174–1238) has no awareness of open dialogs: `Modal` (console.tsx:4737–4784) only registers its own Escape listener (:4750–4752) and never stops propagation, and the Archive `AlertDialog` (console.tsx:2002–2033) is Radix-managed with no window guard. Pressing `a`/`e`/`g`/`r`/`/`/`?` while the Guide/Settings/Shortcuts/Archive dialog is open still executes run/approve/reject-note-focus actions (console.tsx:1209–1232) — e.g. `a` can approve a pending HITL gate while the "Archive this build?" confirm is on screen.
- **Fix spec:** at the top of `onKey` (:1175–1183), bail when a modal is open: `if (document.querySelector('[role="dialog"], [data-state="open"][role="alertdialog"]')) return;` (the custom `Modal` sets `role="dialog"` at :4766; Radix AlertDialog exposes `role="alertdialog"`), or expose open-dialog state via a ref the handler checks. Keep Escape handling where it is.
- **Severity: P2.**

### P2-3 · Run errors, notices and the HITL dock vanish while viewing a past-phase record — keyboard-driven failures become silent
- When `viewPhase !== null` (a past phase is being inspected), the whole live console is replaced by `PhaseRecordView` (console.tsx:1709–1716). The `error`/`notice` paragraphs (:2035–2044), the `HitlDock` (:2101–2110), and the execute/copy toolbar all live **inside** the `viewPhase === null` branch (:1717–2309). But the global shortcuts still execute the **live** phase (`e`/`g`, :1209–1214) and `a` approves (:1215–1219) while a record is open → `run()`/`onApprove()` failures call `setError` (:1296, :1307) with nothing rendered to show them.
- **Fix spec:** hoist the `error`/`notice` banners above the `viewPhase` conditional (move :2035–2044 next to :1705–1708), or suppress `e/g/a` when `viewPhase !== null` inside the keyboard handler (it has `id` only — read `useRapid.getState()` for the project and compare a `viewPhase` ref), and show an inline note in `PhaseRecordView` that live actions still apply to the current phase.
- **Severity: P2.**

### P2-4 · Store pause/stop actions are silent — operator actions leave no ledger or UI trace
- `toggleWildPause` (store.ts:564–571) and `stopWildRun` (store.ts:556–563) flip state with **no log entry** (unlike every engine wild transition, which appends `wild.paused_*`/`wild.stop` ledger rows via engine.ts:2050/2217 etc.). Diagnostics (console.tsx:2371–2379) and the strip's own log feed (console.tsx:698–705, regex `^(wild|autopilot)\.`) will never show "operator paused/resumed/stopped", so multi-operator and post-hoc audits cannot distinguish a human pause from a classifier pause.
- **Fix spec:** in both store actions, append `{event:"wild.paused_operator"|"wild.resumed_operator"|"wild.stop_operator", level:"info", phase: p.currentPhase}` to `logs` (:200 cap like store.ts:190) inside the `set` updater. The console feed then renders them automatically.
- **Severity: P2.**

### P2-5 · Every keystroke in Notes / every toggle rewrites the whole persisted store
- The Notes textarea calls `setNotes(project.id, …)` per keystroke (console.tsx:2316–2324), and the Autopilot checkbox calls `setAutopilot` (console.tsx:1658–1665) — zustand `persist` (store.ts:1094–1120) synchronously `JSON.stringify`s **all projects** (packets can be ~100 KB+ with artifacts) to `localStorage` on every change; typing in Notes can visibly jank on large builds.
- **Fix spec:** debounce the notes commit (~300 ms trailing) client-side in `RunScreen` (local `draftNotes` state flushed to `setNotes` on blur/timer), and/or move `notes`/`autopilot` out of the persisted `projects` write path via a `partialize` split (store.ts:1096–1101) — at minimum debounce; do not lose the save-on-blur guarantee.
- **Severity: P2.**

### P2-6 · No theme control on the Home screen
- `ThemeToggle` is only rendered in the `RunScreen` header (console.tsx:1695); the Home screen header (console.tsx:1001–1010) has no toggle, so a light-theme user landing on `/` cannot switch without opening a build. (Theme application itself is correct — root pre-hydration script, __root.tsx:47–49.)
- **Fix spec:** render `<ThemeToggle />` in the HomeScreen header (:1001–1010), next to the tagline, or lift the control into the root layout.
- **Severity: P2.**

### P2-7 · Pause/resume wiring is semantic-luck, not contract — set-intent shims resolve to a toggle
- `wildSetPaused(id, paused)` (console.tsx:384–386) builds *set* semantics `(id, paused)` but the only real store action, `toggleWildPause` (store.ts:564–571), ignores the boolean and flips. Today it works only because the shim lists (console.tsx:327–340) place `toggleWildPause` third in both pause and resume lists and the click always computes the wrong-but-consistent target (see P1-1). `WILD_RESUME_NAMES` also lists `setWildPaused` second — if a future store ships only a setter, "Resume" would call `setWildPaused(id, true)` and *pause*.
- **Fix spec:** now that the store contract has landed (types.ts:129–137, store.ts:94–98), delete the speculative name arrays/shims (console.tsx:325–409) and call the store actions directly: `toggleWildPause(projectId)`, `stopWildRun(projectId)`, `setWildMode(projectId, on)` — with the P1-1 label fix, toggle semantics become self-consistent.
- **Severity: P2** (hardening; currently masked by P1-1).

### P2-8 · WildConsole renders a dead "activity strip" before any run exists and while idle
- `visible` = `wild.enabled || runSeen || feed.length > 0 || note` (console.tsx:723): with the toggle on but no run ever started, the strip permanently occupies the console with IDLE chip + "No auto activity yet — wild mode acts silently until the next gate decision." (:854–863) — text that is false once P0-1 is understood (nothing is acting). Also, once P0-1's Start exists, the strip should collapse to a single Start row rather than a full activity panel when `feed.length === 0 && !runSeen`.
- **Fix spec:** when `wild.enabled && !runSeen && feed.length === 0`, render the compact Start affordance (P0-1) plus the chip, and drop the "acts silently" copy in favor of "Not running — start unattended execution" or similar truthful text.
- **Severity: P2.**

---

## Informational notes (not bugs — verified)

- `WildRunShape.autoLogs`/`updatedAt` (console.tsx:259–260) are read defensively but engine/store never write them (engine wildRun patch fields: engine.ts:2050, 2217–2218, 2277, 2290–2291) — dead-but-harmless branches (console.tsx:624–630, 673–681). Leave or delete with P2-7's shim cleanup.
- `lastAutoLog` dedupe key includes the log text (console.tsx:665), so two successive identical entries collapse to one feed row — cosmetic, engine messages are unique in practice.
- Poll interval keeps ticking while paused/stopped (console.tsx:651–721) — ~1 wake/s; harmless, can be gated on `running` when the P1-1 state fix lands.
- `.vault-link-dead` (console.tsx:3072) has no stylesheet rule; the disabled-vault-link look comes from `.vault-link:disabled` (styles.css:117–125). Adding a matching rule is optional.

## Fix priority summary
1. P0-1 start wiring (store driver + Start control) — unblocks the whole Wild pillar.
2. P1-1 canonical-`pause` fix (use `wildPaused()`) — makes pause/resume honest.
3. P1-2 badge truth (wild badges only when `wildRun.active`).
4. P2-1..P2-8 as capacity allows; P2-4 (ledger logs) is the cheapest auditability win.
